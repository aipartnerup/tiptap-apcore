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

const SYSTEM_PROMPT = `You are an AI assistant that helps edit a rich-text document using a TipTap editor.
You have access to TipTap editor commands as tools. Use these tools to modify the document as the user requests.
After making changes, summarize what you did.

Guidelines:
- Use query tools (like getHTML, getText) to inspect the current document state when needed.
- Use format tools (toggleBold, toggleItalic, etc.) for styling changes.
- Use content tools (insertContent) to add new content.
- For destructive operations like clearContent, explain what will happen before proceeding.
- Always try to fulfill the user's request using the available tools.

IMPORTANT - Text Selection:
- To format specific text (e.g. "make 'hello' bold"), ALWAYS use selectText first to find and select the text by content, then apply the format command.
  Example: selectText({ text: "hello" }) → toggleBold()
- To replace specific text, use selectText to select it, then insertContent with the new text.
  Example: selectText({ text: "old text" }) → insertContent({ value: "new text" })
- Do NOT try to calculate ProseMirror positions manually. Always use selectText to find text by content.
- Use selectAll only when you need to format the entire document.
- If selectText returns { found: false }, inform the user that the text was not found.`;

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
