import type { Executor, EditorLike, ChainLike } from "../types.js";
import type { TiptapRegistry } from "./TiptapRegistry.js";
import { AclGuard } from "../security/AclGuard.js";
import { TiptapModuleError, ErrorCodes } from "../errors/index.js";

// Re-export for backwards compatibility
export type { EditorLike, ChainLike } from "../types.js";

// ── URL safety (C-1) ──────────────────────────────────────────────

const SAFE_PROTOCOLS = /^(https?|mailto|tel):/i;
const SAFE_RELATIVE = /^[/#?]/;

function isSafeUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  return SAFE_PROTOCOLS.test(trimmed) || SAFE_RELATIVE.test(trimmed);
}

// ── Prototype pollution guard (C-2 + H-8) ─────────────────────────

const FORBIDDEN_PROPS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
]);

// ── Input validation helpers (H-2) ────────────────────────────────

function requireString(
  inputs: Record<string, unknown>,
  field: string,
  moduleId: string,
): string {
  const val = inputs[field];
  if (typeof val !== "string" || val.length === 0) {
    throw new TiptapModuleError(
      ErrorCodes.SCHEMA_VALIDATION_ERROR,
      `'${field}' must be a non-empty string`,
      { moduleId, field },
    );
  }
  return val;
}

function requireNumber(
  inputs: Record<string, unknown>,
  field: string,
  moduleId: string,
): number {
  const val = inputs[field];
  if (typeof val !== "number" || !Number.isFinite(val)) {
    throw new TiptapModuleError(
      ErrorCodes.SCHEMA_VALIDATION_ERROR,
      `'${field}' must be a finite number`,
      { moduleId, field },
    );
  }
  return val;
}

// ── Executor ──────────────────────────────────────────────────────

export class TiptapExecutor implements Executor {
  readonly registry: TiptapRegistry;
  private editor: EditorLike;
  private aclGuard: AclGuard;
  private sanitizeHtml: ((html: string) => string) | undefined;

  constructor(
    editor: EditorLike,
    registry: TiptapRegistry,
    aclGuard: AclGuard,
    sanitizeHtml?: (html: string) => string,
  ) {
    this.editor = editor;
    this.registry = registry;
    this.aclGuard = aclGuard;
    this.sanitizeHtml = sanitizeHtml;
  }

  async call(moduleId: string, inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    // 1. Check editor ready
    if (this.editor.isDestroyed) {
      throw new TiptapModuleError(ErrorCodes.EDITOR_NOT_READY, "Editor is not ready", { editorDestroyed: true });
    }

    // 2. Resolve descriptor
    const descriptor = this.registry.getDefinition(moduleId);
    if (!descriptor) {
      throw new TiptapModuleError(ErrorCodes.MODULE_NOT_FOUND, `Module '${moduleId}' not found`, { moduleId });
    }

    // 3. ACL check (throws ACL_DENIED)
    this.aclGuard.check(moduleId, descriptor);

    // 4. Route to handler
    const category = this.extractCategory(moduleId);
    if (category === "query") {
      return this.executeQuery(moduleId, inputs);
    }
    return this.executeCommand(moduleId, inputs);
  }

  async callAsync(moduleId: string, inputs: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.call(moduleId, inputs);
  }

  private extractCategory(moduleId: string): string {
    // "tiptap.format.toggleBold" → "format"
    const parts = moduleId.split(".");
    return parts.length >= 2 ? parts[1] : "unknown";
  }

  private extractCommandName(moduleId: string): string {
    // "tiptap.format.toggleBold" → "toggleBold"
    const parts = moduleId.split(".");
    return parts.length >= 3 ? parts[2] : moduleId;
  }

  private executeQuery(moduleId: string, inputs: Record<string, unknown>): Record<string, unknown> {
    const commandName = this.extractCommandName(moduleId);

    switch (commandName) {
      case "getHTML":
        return { html: this.editor.getHTML() };
      case "getJSON":
        return { json: this.editor.getJSON() };
      case "getText": {
        const options: { blockSeparator?: string } = {};
        if (typeof inputs.blockSeparator === "string") {
          options.blockSeparator = inputs.blockSeparator;
        }
        return { text: this.editor.getText(options) };
      }
      case "isActive": {
        const name = requireString(inputs, "name", moduleId);
        return { active: this.editor.isActive(name, (inputs.attrs as Record<string, unknown>) ?? {}) };
      }
      case "getAttributes": {
        const typeOrName = requireString(inputs, "typeOrName", moduleId);
        return { attributes: this.editor.getAttributes(typeOrName) };
      }
      case "isEmpty":
        return { value: this.editor.isEmpty };
      case "isEditable":
        return { value: this.editor.isEditable };
      case "isFocused":
        return { value: this.editor.isFocused };
      case "getCharacterCount": {
        const cc = this.editor.storage?.characterCount;
        if (!cc || typeof cc.characters !== "function") {
          throw new TiptapModuleError(ErrorCodes.COMMAND_NOT_FOUND,
            "Character count extension not available", { moduleId, commandName });
        }
        return { count: cc.characters() as number };
      }
      case "getWordCount": {
        const cc = this.editor.storage?.characterCount;
        if (!cc || typeof cc.words !== "function") {
          throw new TiptapModuleError(ErrorCodes.COMMAND_NOT_FOUND,
            "Character count extension not available", { moduleId, commandName });
        }
        return { count: cc.words() as number };
      }
      default:
        throw new TiptapModuleError(ErrorCodes.COMMAND_NOT_FOUND,
          `Command '${commandName}' not available on editor`, { moduleId, commandName });
    }
  }

  private executeCommand(moduleId: string, inputs: Record<string, unknown>): Record<string, unknown> {
    const commandName = this.extractCommandName(moduleId);

    // Built-in: selectText — find text content and set selection
    if (commandName === "selectText") {
      return this.handleSelectText(inputs, moduleId);
    }

    // C-2 + H-8: Prototype pollution / arbitrary command guard
    if (FORBIDDEN_PROPS.has(commandName)) {
      throw new TiptapModuleError(ErrorCodes.COMMAND_NOT_FOUND,
        `Command '${commandName}' is not allowed`, { moduleId, commandName });
    }

    // Build chain: editor.chain().focus().<commandName>(...args).run()
    const chain = this.editor.chain().focus();
    const commandFn = chain[commandName];

    if (typeof commandFn !== "function") {
      throw new TiptapModuleError(ErrorCodes.COMMAND_NOT_FOUND,
        `Command '${commandName}' not available on editor`, { moduleId, commandName });
    }

    // Spread input arguments into the command
    const args = this.buildArgs(commandName, inputs, moduleId);
    const resultChain = commandFn.call(chain, ...args);
    const success = resultChain.run();

    if (!success) {
      // undo/redo return false when history stack is empty — this is a normal
      // condition (editor is recreated per request), not an execution error.
      if (commandName === "undo" || commandName === "redo") {
        return { success: false, reason: `Nothing to ${commandName}` };
      }
      throw new TiptapModuleError(ErrorCodes.COMMAND_FAILED,
        `Command '${commandName}' failed`, { moduleId, commandName });
    }

    return { success: true };
  }

  private handleSelectText(inputs: Record<string, unknown>, moduleId: string): Record<string, unknown> {
    const text = requireString(inputs, "text", moduleId);
    const occurrence = typeof inputs.occurrence === "number" ? Math.max(1, inputs.occurrence) : 1;

    const doc = this.editor.state.doc;
    let count = 0;
    let foundFrom = -1;
    let foundTo = -1;

    doc.descendants((node, pos) => {
      if (foundFrom >= 0) return false;
      if (node.isText && node.text) {
        let searchFrom = 0;
        while (searchFrom < node.text.length) {
          const idx = node.text.indexOf(text, searchFrom);
          if (idx === -1) break;
          count++;
          if (count === occurrence) {
            foundFrom = pos + idx;
            foundTo = foundFrom + text.length;
            return false;
          }
          searchFrom = idx + 1;
        }
      }
    });

    if (foundFrom < 0) {
      return { found: false };
    }

    // Set text selection around the found text
    const chain = this.editor.chain().focus();
    chain.setTextSelection({ from: foundFrom, to: foundTo }).run();

    return { found: true, from: foundFrom, to: foundTo };
  }

  private buildArgs(commandName: string, inputs: Record<string, unknown>, moduleId: string): unknown[] {
    // Map input object fields to positional command arguments based on command name
    // Most commands take 0 or 1 args
    switch (commandName) {
      // Commands with no args
      case "toggleBold": case "toggleItalic": case "toggleStrike": case "toggleCode":
      case "toggleUnderline": case "toggleSubscript": case "toggleSuperscript":
      case "toggleBulletList": case "toggleOrderedList": case "toggleTaskList":
      case "toggleBlockquote": case "unsetAllMarks": case "clearNodes":
      case "setHardBreak": case "setHorizontalRule": case "unsetLink":
      case "selectAll": case "selectParentNode": case "selectTextblockStart":
      case "selectTextblockEnd": case "blur": case "scrollIntoView":
      case "undo": case "redo": case "deleteSelection": case "deleteCurrentNode":
      case "cut": case "joinBackward": case "joinForward":
      case "setBold": case "unsetBold": case "setItalic": case "unsetItalic":
      case "setStrike": case "unsetStrike": case "setCode": case "unsetCode":
      case "setBlockquote": case "unsetBlockquote": case "setParagraph":
      case "exitCode":
        return [];

      case "splitBlock":
        return inputs.keepMarks !== undefined ? [{ keepMarks: inputs.keepMarks }] : [];

      // Commands with single object arg
      case "toggleHeading":
        return [{ level: inputs.level }];
      case "setHeading":
        return [{ level: inputs.level }];
      case "toggleHighlight":
        return inputs.color ? [{ color: inputs.color }] : [];
      case "toggleCodeBlock":
        return inputs.language ? [{ language: inputs.language }] : [];
      case "setTextAlign":
        return [inputs.alignment as string];
      case "setMark":
        return [inputs.typeOrName as string, inputs.attrs ?? {}];
      case "unsetMark":
        return [inputs.typeOrName as string];
      case "updateAttributes":
        return [inputs.typeOrName as string, inputs.attrs as Record<string, unknown>];
      case "setLink": {
        // C-1: URL protocol validation
        if (!isSafeUrl(inputs.href)) {
          throw new TiptapModuleError(ErrorCodes.SCHEMA_VALIDATION_ERROR,
            "Invalid or unsafe URL protocol", { field: "href" });
        }
        const linkAttrs: Record<string, unknown> = { href: inputs.href };
        if (inputs.target !== undefined) linkAttrs.target = inputs.target;
        if (inputs.rel !== undefined) linkAttrs.rel = inputs.rel;
        return [linkAttrs];
      }

      // Content commands — H-1: sanitize HTML
      case "insertContent": {
        let value = inputs.value;
        if (typeof value === "string" && this.sanitizeHtml) {
          value = this.sanitizeHtml(value);
        }
        return [value, inputs.options ?? {}];
      }
      case "insertContentAt": {
        const position = requireNumber(inputs, "position", moduleId);
        let value = inputs.value;
        if (typeof value === "string" && this.sanitizeHtml) {
          value = this.sanitizeHtml(value);
        }
        return [position, value, inputs.options ?? {}];
      }
      case "setNode":
        return [inputs.typeOrName as string, inputs.attrs ?? {}];
      case "liftListItem": case "sinkListItem":
        return [inputs.typeOrName as string];
      case "wrapIn":
        return [inputs.typeOrName as string, inputs.attrs ?? {}];
      case "lift":
        return [inputs.typeOrName as string, inputs.attrs ?? {}];
      case "splitListItem":
        return [inputs.typeOrName as string, inputs.overrideAttrs ?? {}];
      case "wrapInList":
        return [inputs.typeOrName as string, inputs.attributes ?? {}];
      case "toggleList":
        return [inputs.listTypeOrName as string, inputs.itemTypeOrName as string, inputs.keepMarks ?? false, inputs.attributes ?? {}];
      case "deleteNode":
        return [inputs.typeOrName as string];

      // Destructive commands
      case "clearContent":
        return inputs.emitUpdate !== undefined ? [inputs.emitUpdate] : [];
      case "setContent": {
        let value = inputs.value as string;
        if (typeof value === "string" && this.sanitizeHtml) {
          value = this.sanitizeHtml(value);
        }
        return [value, inputs.emitUpdate ?? true, inputs.parseOptions ?? {}];
      }
      case "deleteRange":
        return [{ from: inputs.from, to: inputs.to }];

      // Selection commands
      case "setTextSelection":
        return [inputs.position];
      case "setNodeSelection": {
        const position = requireNumber(inputs, "position", moduleId);
        return [position];
      }
      case "focus":
        return inputs.position !== undefined ? [inputs.position] : [];

      default:
        // Unknown commands: pass all inputs as single object arg
        return Object.keys(inputs).length > 0 ? [inputs] : [];
    }
  }
}
