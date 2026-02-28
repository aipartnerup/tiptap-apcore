import type { Request, Response } from "express";
import { JSDOM } from "jsdom";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { withApcore } from "tiptap-apcore";
import type { Registry } from "tiptap-apcore";
import { toolLoop } from "./toolLoop.js";

interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  editorHtml: string;
  model?: string;
  role: "readonly" | "editor" | "admin";
}

const DEFAULT_MODEL = process.env.LLM_MODEL || "openai:gpt-4o";

/** Extract command name from a moduleId like "tiptap.format.toggleBold" */
function commandName(moduleId: string): string {
  const parts = moduleId.split(".");
  return parts[parts.length - 1];
}

/** Extract category from a moduleId like "tiptap.format.toggleBold" -> "format" */
function categoryOf(moduleId: string): string {
  const parts = moduleId.split(".");
  return parts.length >= 3 ? parts[1] : "unknown";
}

/**
 * Build a dynamic command map grouped by category from the registry.
 * Only includes commands actually available (respects ACL filtering).
 */
function buildCommandMap(registry: Registry): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const moduleId of registry.list()) {
    const cat = categoryOf(moduleId);
    if (!map[cat]) map[cat] = [];
    map[cat].push(commandName(moduleId));
  }
  return map;
}

/**
 * Classify available commands by selection behavior.
 * Reads selectionEffect from each module's metadata (set by AnnotationCatalog).
 * Fully dynamic — no hardcoded command names.
 */
function classifySelectionBehavior(registry: Registry): {
  require: string[];
  preserve: string[];
  destroy: string[];
  none: string[];
} {
  const result: Record<string, string[]> = {
    require: [],
    preserve: [],
    destroy: [],
    none: [],
  };

  for (const moduleId of registry.list()) {
    const desc = registry.getDefinition(moduleId);
    const effect = (desc?.metadata as Record<string, unknown>)?.selectionEffect as string ?? "preserve";
    const name = commandName(moduleId);
    if (result[effect]) {
      result[effect].push(name);
    } else {
      result.preserve.push(name);
    }
  }

  return result as { require: string[]; preserve: string[]; destroy: string[]; none: string[] };
}

/**
 * Build the system prompt dynamically from the registry.
 *
 * Static: behavioral rules, patterns, anti-patterns (generic, no hardcoded command names).
 * Dynamic: available commands grouped by category, selection behavior classification.
 */
function buildSystemPrompt(registry: Registry, editorHtml: string): string {
  const cmdMap = buildCommandMap(registry);
  const sel = classifySelectionBehavior(registry);

  // Build available commands section
  const commandSections = Object.entries(cmdMap)
    .map(([cat, cmds]) => `  ${cat}: ${cmds.join(", ")}`)
    .join("\n");

  return `You are an AI assistant for rich-text editing via a TipTap editor. You have access to TipTap editor commands as tools. You may use up to 10 tool calls per request. After making changes, summarize what you did.

## Available Commands (by category)

${commandSections}

## Selection State Machine — THE CORE RULE

Every command interacts with the editor's invisible "selection state." You MUST mentally track it:

REQUIRE SELECTION (do nothing without an active text range):
  ${sel.require.join(", ") || "(none available)"}

PRESERVE SELECTION (selection survives after execution):
  ${sel.preserve.join(", ") || "(none available)"}

DESTROY SELECTION (cursor collapses — subsequent format has no effect):
  ${sel.destroy.join(", ") || "(none available)"}

NO SELECTION NEEDED (operate on the block at cursor position):
  ${sel.none.join(", ") || "(none available)"}

KEY RULE: After any selection-destroying command, you MUST re-select text before applying formatting.

MULTI-OCCURRENCE RULE: When the user says "change X" or "make X bold" without saying "first" or "one", you MUST apply the change to ALL occurrences. Loop with selectText(text, occurrence=1) -> edit, repeat until selectText returns { found: false }. Do NOT stop after the first match.

## Common Task Patterns

1. Format existing text: selectText -> format command (e.g. toggleBold)
2. Replace + format (preferred, fewer tool calls): selectText -> insertContent with HTML (e.g. "<strong>new text</strong>")
3. Replace + format (alternative): selectText -> insertContent -> selectText (re-select) -> format command. Caution: re-select may match a different occurrence — use the occurrence parameter to target the correct one.
4. Multi-format same text: selectText -> toggleBold -> toggleItalic (formats preserve selection)
5. Change block type: selectText (any text in target block) -> node-level command (e.g. toggleHeading)
6. Add content at end: focus("end") -> insertContent
7. Delete specific text: selectText -> deleteSelection
8. Replace entire document: setContent (single command, no selection needed)
9. Check before acting: getText -> read result -> plan edits -> execute
10. Change ALL occurrences: selectText(text, occurrence=1) -> edit -> repeat with occurrence=1 until { found: false }. After each replacement remaining matches shift down, so always use occurrence=1.

## Command Category Rules

QUERY: Safe anytime, no state changes. Use getText/getHTML to inspect content before ambiguous edits.

FORMAT: Mark-level commands need an active text selection. Node-level commands operate on the block at the cursor. insertContent accepts HTML strings for inline formatting (e.g. "<em>italic</em>").

CONTENT: insertContent replaces the current selection if one exists; accepts plain text or HTML.

DESTRUCTIVE: Commands like clearContent and setContent affect the entire document — only use for full document replacement. deleteSelection requires a prior selectText.

SELECTION: selectText is your PRIMARY tool for targeting text. It performs SUBSTRING matching — a short string will match inside longer words. When the same text appears multiple times, use the occurrence parameter (1-based integer) to target the correct one. Analyze the user's intent and document context to determine which occurrence they mean. Always check the "found" field in the result before proceeding. Never calculate ProseMirror positions manually.

HISTORY: undo/redo only work for changes made within the SAME request (the editor is recreated per request, so history from previous requests is lost). If the user asks to "undo" or "rollback" a change from a PREVIOUS message, do NOT use the undo command — it will fail. Instead, tell the user to click the "Undo" button in the UI. Within the same request, undo works normally.

## Error Handling & Recovery

- If selectText returns { found: false }: inform the user. Use getText to show actual content.
- If a format command has no visible effect: you likely forgot to select text first.
- User asks to undo a previous change: tell them to use the Undo button (undo command only works within the same request).
- Do not retry failed commands blindly — diagnose why they failed first.

## Anti-Patterns — NEVER DO THESE

- NEVER apply a format command right after insertContent (selection is destroyed — re-select first)
- NEVER use setTextSelection with guessed positions (use selectText instead)
- NEVER use clearContent/setContent unless the user explicitly wants full document replacement
- NEVER assume selectText succeeded without checking the "found" field
- NEVER apply a mark-level format command without a preceding selectText
- CAUTION: selectText does substring matching. When re-selecting after insertContent, the text may match at the wrong location. Use the occurrence parameter or prefer insertContent with HTML formatting to avoid ambiguity.

## Current Document HTML

${editorHtml}`;
}

const GLOBAL_KEYS = ["document", "window", "navigator", "Node", "HTMLElement", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"] as const;

function setGlobal(key: string, value: unknown): void {
  try {
    (globalThis as Record<string, unknown>)[key] = value;
  } catch {
    // Some properties (e.g. navigator in Node 22+) are getter-only
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  }
}

function createHeadlessEditor(html: string): Editor {
  // Set up a minimal DOM environment for TipTap
  const dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"editor\"></div></body></html>");
  const document = dom.window.document;

  // Assign globals that TipTap/ProseMirror need
  setGlobal("document", document);
  setGlobal("window", dom.window);
  setGlobal("navigator", dom.window.navigator);
  setGlobal("Node", dom.window.Node);
  setGlobal("HTMLElement", dom.window.HTMLElement);
  setGlobal("getComputedStyle", dom.window.getComputedStyle);
  setGlobal("requestAnimationFrame", (cb: () => void) => setTimeout(cb, 0));
  setGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));

  const element = document.getElementById("editor")!;

  const editor = new Editor({
    element,
    extensions: [StarterKit],
    content: html,
  });

  return editor;
}

function cleanupGlobals(): void {
  for (const key of GLOBAL_KEYS) {
    try {
      delete (globalThis as Record<string, unknown>)[key];
    } catch {
      // Restore original by removing our override
      Object.defineProperty(globalThis, key, {
        value: undefined,
        writable: true,
        configurable: true,
      });
    }
  }
}

export async function chatHandler(req: Request, res: Response): Promise<void> {
  const { messages, editorHtml, model: requestModel, role } = req.body as ChatRequest;

  // Validate request
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }
  if (typeof editorHtml !== "string") {
    res.status(400).json({ error: "editorHtml string is required" });
    return;
  }
  if (!["readonly", "editor", "admin"].includes(role)) {
    res.status(400).json({ error: "role must be 'readonly', 'editor', or 'admin'" });
    return;
  }

  const model = requestModel || DEFAULT_MODEL;

  let editor: Editor | null = null;

  try {
    // 1. Create headless TipTap editor
    editor = createHeadlessEditor(editorHtml);

    // 2. Create APCore executor with ACL
    const { executor } = withApcore(editor, { acl: { role }, includeUnsafe: false });

    // 3. Build system prompt dynamically from registry + document
    const systemPrompt = buildSystemPrompt(executor.registry, editorHtml);

    // 4. Run tool loop via AI SDK
    const result = await toolLoop(systemPrompt, messages, executor.registry, executor, model);

    // 5. Return response
    res.json({
      reply: result.reply,
      updatedHtml: editor.getHTML(),
      toolCalls: result.toolCalls,
    });
  } catch (err: unknown) {
    console.error("Chat handler error:", err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  } finally {
    if (editor) {
      editor.destroy();
    }
    cleanupGlobals();
  }
}
