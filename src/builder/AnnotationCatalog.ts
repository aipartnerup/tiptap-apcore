/**
 * AnnotationCatalog: Static mapping of TipTap command names to safety annotations.
 *
 * Maps all 79 known TipTap commands across 6 categories (query, format, content,
 * destructive, selection, history) to their APCore annotation metadata.
 */

import type { AnnotationEntry, ModuleAnnotations } from "../types.js";

// ------------------------------------------------------------------
// Shared annotation templates per category
// ------------------------------------------------------------------

const QUERY_ANNOTATIONS: ModuleAnnotations = Object.freeze({
  readonly: true,
  destructive: false,
  idempotent: true,
  requiresApproval: false,
  openWorld: false,
  streaming: false,
});

const FORMAT_ANNOTATIONS: ModuleAnnotations = Object.freeze({
  readonly: false,
  destructive: false,
  idempotent: true,
  requiresApproval: false,
  openWorld: false,
  streaming: false,
});

const FORMAT_NON_IDEMPOTENT_ANNOTATIONS: ModuleAnnotations = Object.freeze({
  readonly: false,
  destructive: false,
  idempotent: false,
  requiresApproval: false,
  openWorld: false,
  streaming: false,
});

const CONTENT_ANNOTATIONS: ModuleAnnotations = Object.freeze({
  readonly: false,
  destructive: false,
  idempotent: false,
  requiresApproval: false,
  openWorld: false,
  streaming: false,
});

const DESTRUCTIVE_ANNOTATIONS: ModuleAnnotations = Object.freeze({
  readonly: false,
  destructive: true,
  idempotent: false,
  requiresApproval: true,
  openWorld: false,
  streaming: false,
});

const SELECTION_ANNOTATIONS: ModuleAnnotations = Object.freeze({
  readonly: false,
  destructive: false,
  idempotent: true,
  requiresApproval: false,
  openWorld: false,
  streaming: false,
});

const HISTORY_ANNOTATIONS: ModuleAnnotations = Object.freeze({
  readonly: false,
  destructive: false,
  idempotent: false,
  requiresApproval: false,
  openWorld: false,
  streaming: false,
});

// ------------------------------------------------------------------
// Helper to build an AnnotationEntry
// ------------------------------------------------------------------

function entry(
  annotations: ModuleAnnotations,
  tags: string[],
  category: string,
): AnnotationEntry {
  return { annotations, tags, category };
}

// ------------------------------------------------------------------
// Command lists per category
// ------------------------------------------------------------------

const QUERY_COMMANDS: string[] = [
  "getHTML",
  "getJSON",
  "getText",
  "isActive",
  "getAttributes",
  "isEmpty",
  "isEditable",
  "isFocused",
  "getCharacterCount",
  "getWordCount",
];

const FORMAT_COMMANDS: string[] = [
  "toggleBold",
  "toggleItalic",
  "toggleStrike",
  "toggleCode",
  "toggleUnderline",
  "toggleSubscript",
  "toggleSuperscript",
  "toggleHighlight",
  "toggleHeading",
  "toggleBulletList",
  "toggleOrderedList",
  "toggleTaskList",
  "toggleCodeBlock",
  "toggleBlockquote",
  "setTextAlign",
  "setMark",
  "unsetMark",
  "unsetAllMarks",
  "clearNodes",
  "updateAttributes",
  "setLink",
  "unsetLink",
  "setBold",
  "setItalic",
  "setStrike",
  "setCode",
  "unsetBold",
  "unsetItalic",
  "unsetStrike",
  "unsetCode",
  "setBlockquote",
  "unsetBlockquote",
  "setHeading",
  "setParagraph",
];

/** Format commands that are NOT idempotent (they insert new elements). */
const FORMAT_NON_IDEMPOTENT_COMMANDS: string[] = [
  "setHardBreak",
  "setHorizontalRule",
];

const CONTENT_COMMANDS: string[] = [
  "insertContent",
  "insertContentAt",
  "setNode",
  "splitBlock",
  "liftListItem",
  "sinkListItem",
  "wrapIn",
  "joinBackward",
  "joinForward",
  "lift",
  "splitListItem",
  "wrapInList",
  "toggleList",
  "exitCode",
  "deleteNode",
];

const DESTRUCTIVE_COMMANDS: string[] = [
  "clearContent",
  "setContent",
  "deleteSelection",
  "deleteRange",
  "deleteCurrentNode",
  "cut",
];

const SELECTION_COMMANDS: string[] = [
  "setTextSelection",
  "setNodeSelection",
  "selectAll",
  "selectParentNode",
  "selectTextblockStart",
  "selectTextblockEnd",
  "selectText", // Custom APCore command (not native TipTap)
  "focus",
  "blur",
  "scrollIntoView",
];

const HISTORY_COMMANDS: string[] = ["undo", "redo"];

// ------------------------------------------------------------------
// Build the full catalog map
// ------------------------------------------------------------------

function buildCatalog(): Map<string, AnnotationEntry> {
  const map = new Map<string, AnnotationEntry>();

  for (const cmd of QUERY_COMMANDS) {
    map.set(cmd, entry(QUERY_ANNOTATIONS, ["query"], "query"));
  }

  for (const cmd of FORMAT_COMMANDS) {
    map.set(cmd, entry(FORMAT_ANNOTATIONS, ["format"], "format"));
  }

  for (const cmd of FORMAT_NON_IDEMPOTENT_COMMANDS) {
    map.set(
      cmd,
      entry(FORMAT_NON_IDEMPOTENT_ANNOTATIONS, ["format"], "format"),
    );
  }

  for (const cmd of CONTENT_COMMANDS) {
    map.set(cmd, entry(CONTENT_ANNOTATIONS, ["content"], "content"));
  }

  for (const cmd of DESTRUCTIVE_COMMANDS) {
    map.set(
      cmd,
      entry(DESTRUCTIVE_ANNOTATIONS, ["destructive"], "destructive"),
    );
  }

  for (const cmd of SELECTION_COMMANDS) {
    map.set(cmd, entry(SELECTION_ANNOTATIONS, ["selection"], "selection"));
  }

  for (const cmd of HISTORY_COMMANDS) {
    map.set(cmd, entry(HISTORY_ANNOTATIONS, ["history"], "history"));
  }

  return map;
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

export class AnnotationCatalog {
  private catalog: Map<string, AnnotationEntry>;

  constructor() {
    this.catalog = buildCatalog();
  }

  /**
   * Look up the annotation entry for a command name.
   * Returns `null` when the command is not in the catalog.
   */
  get(commandName: string): AnnotationEntry | null {
    return this.catalog.get(commandName) ?? null;
  }

  /**
   * Convenience helper that returns the category string for a command,
   * or `"unknown"` when the command is not in the catalog.
   */
  getCategory(commandName: string): string {
    return this.catalog.get(commandName)?.category ?? "unknown";
  }
}
