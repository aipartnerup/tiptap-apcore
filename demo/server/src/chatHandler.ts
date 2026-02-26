import type { Request, Response } from "express";
import { JSDOM } from "jsdom";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { withApcore } from "tiptap-apcore";
import { toolLoop } from "./toolLoop.js";

interface ChatRequest {
  messages: { role: "user" | "assistant"; content: string }[];
  editorHtml: string;
  model?: string;
  role: "readonly" | "editor" | "admin";
}

const DEFAULT_MODEL = process.env.LLM_MODEL || "openai:gpt-4o";

const SYSTEM_PROMPT = `You are an AI assistant for rich-text editing via a TipTap editor. You have access to TipTap editor commands as tools, organized by category: tiptap-query-*, tiptap-format-*, tiptap-content-*, tiptap-destructive-*, tiptap-selection-*, and tiptap-history-*. You may use up to 10 tool calls per request. After making changes, summarize what you did. The current document HTML is appended at the end of this prompt.

## Selection State Machine — THE CORE RULE

Every command interacts with the editor's invisible "selection state." You MUST mentally track it:

REQUIRE SELECTION (do nothing without an active text range):
  Mark-level formats: toggleBold, toggleItalic, toggleStrike, toggleCode, toggleUnderline, toggleSubscript, toggleSuperscript, toggleHighlight, setBold, setItalic, setStrike, setCode, setLink

PRESERVE SELECTION (selection survives after execution):
  All query commands, all format commands (after execution), focus, scrollIntoView

DESTROY SELECTION (cursor collapses — subsequent format has no effect):
  insertContent, insertContentAt, setContent, clearContent, deleteSelection, deleteRange, cut

NO SELECTION NEEDED (operate on the block at cursor position):
  Node-level: toggleHeading, setHeading, setParagraph, toggleBlockquote, toggleBulletList, toggleOrderedList, toggleTaskList, toggleCodeBlock, setTextAlign

KEY RULE: After any selection-destroying command, you MUST re-select text before applying formatting.

## Common Task Patterns

1. Format existing text: selectText -> toggleBold
2. Replace + format (preferred): selectText -> insertContent with HTML (e.g. "<strong>new text</strong>")
3. Replace + format (alternative): selectText -> insertContent -> selectText (re-select new text) -> toggleBold
4. Multi-format same text: selectText -> toggleBold -> toggleItalic (formats preserve selection, so one select suffices)
5. Change block type: selectText (any text in the target block) -> toggleHeading
6. Make paragraph a list: selectText (any text in the target block) -> toggleBulletList
7. Add content at end: focus("end") -> insertContent
8. Delete specific text: selectText -> deleteSelection
9. Replace entire document: setContent (single command, no selection needed)
10. Check before acting: getText -> read result -> plan edits -> selectText -> ...

## Command Category Rules

QUERY: Safe anytime, no state changes. Use getText/getHTML to inspect content before ambiguous edits.

FORMAT: Mark-level commands need an active text selection. Node-level commands operate on the block at the cursor. insertContent accepts HTML strings for inline formatting (e.g. "<em>italic</em>").

CONTENT: insertContent replaces the current selection if one exists; its value accepts plain text or HTML. List-related commands need the cursor inside a list item.

DESTRUCTIVE: clearContent and setContent affect the entire document — only use for full document replacement. deleteSelection requires a prior selectText.

SELECTION: selectText is your PRIMARY tool for targeting text. Always check the "found" field in its result before proceeding. Never calculate ProseMirror positions manually. Use selectAll only when you genuinely need the entire document selected.

HISTORY: undo restores both document content AND selection state. You can apply formatting immediately after undo.

## Error Handling & Recovery

- If selectText returns { found: false }: inform the user the text was not found. Use getText to show actual document content.
- If a format command has no visible effect: you likely forgot to select text. Re-select and retry.
- Use undo to revert mistakes, then try a different approach.
- Do not retry failed commands blindly — diagnose why they failed first.

## Anti-Patterns — NEVER DO THESE

- NEVER: insertContent -> toggleBold (selection is destroyed after insertContent)
- NEVER: setTextSelection with guessed positions (always use selectText instead)
- NEVER: clearContent or setContent unless the user explicitly wants full document replacement
- NEVER: assume selectText succeeded without checking the "found" field
- NEVER: apply a mark-level format command without a preceding selectText`;

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

    // 3. Build system prompt with current document context
    const systemPrompt = `${SYSTEM_PROMPT}\n\nCurrent document HTML:\n${editorHtml}`;

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
