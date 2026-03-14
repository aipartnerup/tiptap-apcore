/**
 * AnnotationCatalog: Static mapping of TipTap command names to safety annotations.
 *
 * Maps all 79 known TipTap commands across 6 categories (query, format, content,
 * destructive, selection, history) to their APCore annotation metadata.
 */

import type { AnnotationEntry, ModuleAnnotations, SelectionEffect } from "../types.js";

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
  cacheable: true,
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
  selectionEffect: SelectionEffect = "preserve",
): AnnotationEntry {
  return { annotations, tags, category, selectionEffect };
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

// ------------------------------------------------------------------
// Per-command selection effect overrides.
// Default: category-level (query=preserve, format=require, content=destroy,
//          destructive=destroy, selection=preserve, history=preserve).
// Commands listed here override the category default.
// ------------------------------------------------------------------

/** Mark-level format commands that require an active text selection */
const MARK_FORMAT_COMMANDS = new Set([
  "toggleBold", "toggleItalic", "toggleStrike", "toggleCode",
  "toggleUnderline", "toggleSubscript", "toggleSuperscript", "toggleHighlight",
  "setBold", "setItalic", "setStrike", "setCode", "setLink",
  "setMark", "unsetMark", "unsetAllMarks",
  "unsetBold", "unsetItalic", "unsetStrike", "unsetCode", "unsetLink",
]);

/** Node-level format commands that operate on block at cursor (no selection needed) */
const NODE_FORMAT_COMMANDS = new Set([
  "toggleHeading", "setHeading", "setParagraph",
  "toggleBlockquote", "setBlockquote", "unsetBlockquote",
  "toggleBulletList", "toggleOrderedList", "toggleTaskList", "toggleCodeBlock",
  "setTextAlign", "clearNodes", "updateAttributes",
]);

/** Category-level defaults for selectionEffect */
const CATEGORY_SELECTION_DEFAULTS: Record<string, SelectionEffect> = {
  query: "preserve",
  format: "require",      // overridden per-command below
  content: "destroy",
  destructive: "destroy",
  selection: "preserve",
  history: "preserve",
};

function getSelectionEffect(cmd: string, category: string): SelectionEffect {
  // Per-command overrides for format category
  if (category === "format") {
    if (MARK_FORMAT_COMMANDS.has(cmd)) return "require";
    if (NODE_FORMAT_COMMANDS.has(cmd)) return "none";
    // Non-idempotent formats (setHardBreak, setHorizontalRule) insert content
    return "destroy";
  }
  // Content commands that don't destroy selection
  if (category === "content") {
    // List manipulation and structural commands preserve cursor context
    if (["splitBlock", "liftListItem", "sinkListItem", "wrapIn",
         "joinBackward", "joinForward", "lift", "splitListItem",
         "wrapInList", "toggleList", "exitCode", "setNode"].includes(cmd)) {
      return "none";
    }
    return "destroy";
  }
  return CATEGORY_SELECTION_DEFAULTS[category] ?? "preserve";
}

function buildCatalog(): Map<string, AnnotationEntry> {
  const map = new Map<string, AnnotationEntry>();

  for (const cmd of QUERY_COMMANDS) {
    map.set(cmd, entry(QUERY_ANNOTATIONS, ["query"], "query", getSelectionEffect(cmd, "query")));
  }

  for (const cmd of FORMAT_COMMANDS) {
    map.set(cmd, entry(FORMAT_ANNOTATIONS, ["format"], "format", getSelectionEffect(cmd, "format")));
  }

  for (const cmd of FORMAT_NON_IDEMPOTENT_COMMANDS) {
    map.set(
      cmd,
      entry(FORMAT_NON_IDEMPOTENT_ANNOTATIONS, ["format"], "format", getSelectionEffect(cmd, "format")),
    );
  }

  for (const cmd of CONTENT_COMMANDS) {
    map.set(cmd, entry(CONTENT_ANNOTATIONS, ["content"], "content", getSelectionEffect(cmd, "content")));
  }

  for (const cmd of DESTRUCTIVE_COMMANDS) {
    map.set(
      cmd,
      entry(DESTRUCTIVE_ANNOTATIONS, ["destructive"], "destructive", getSelectionEffect(cmd, "destructive")),
    );
  }

  for (const cmd of SELECTION_COMMANDS) {
    map.set(cmd, entry(SELECTION_ANNOTATIONS, ["selection"], "selection", getSelectionEffect(cmd, "selection")));
  }

  for (const cmd of HISTORY_COMMANDS) {
    map.set(cmd, entry(HISTORY_ANNOTATIONS, ["history"], "history", getSelectionEffect(cmd, "history")));
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
