import { describe, it, expect } from "vitest";
import { AnnotationCatalog } from "../../src/builder/AnnotationCatalog.js";
import type { AnnotationEntry } from "../../src/types.js";

// ------------------------------------------------------------------
// Expected command lists per category
// ------------------------------------------------------------------

const QUERY_COMMANDS = [
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

const FORMAT_IDEMPOTENT_COMMANDS = [
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

const FORMAT_NON_IDEMPOTENT_COMMANDS = ["setHardBreak", "setHorizontalRule"];

const CONTENT_COMMANDS = [
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

const DESTRUCTIVE_COMMANDS = [
  "clearContent",
  "setContent",
  "deleteSelection",
  "deleteRange",
  "deleteCurrentNode",
  "cut",
];

const SELECTION_COMMANDS = [
  "setTextSelection",
  "setNodeSelection",
  "selectAll",
  "selectParentNode",
  "selectTextblockStart",
  "selectTextblockEnd",
  "selectText",
  "focus",
  "blur",
  "scrollIntoView",
];

const HISTORY_COMMANDS = ["undo", "redo"];

const ALL_COMMANDS = [
  ...QUERY_COMMANDS,
  ...FORMAT_IDEMPOTENT_COMMANDS,
  ...FORMAT_NON_IDEMPOTENT_COMMANDS,
  ...CONTENT_COMMANDS,
  ...DESTRUCTIVE_COMMANDS,
  ...SELECTION_COMMANDS,
  ...HISTORY_COMMANDS,
];

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("AnnotationCatalog", () => {
  const catalog = new AnnotationCatalog();

  // ----------------------------------------------------------------
  // Total count
  // ----------------------------------------------------------------

  it("should contain exactly 79 commands", () => {
    expect(ALL_COMMANDS.length).toBe(79);
    // Every command should resolve
    for (const cmd of ALL_COMMANDS) {
      expect(catalog.get(cmd)).not.toBeNull();
    }
  });

  // ----------------------------------------------------------------
  // Query category (10)
  // ----------------------------------------------------------------

  describe("query commands", () => {
    it.each(QUERY_COMMANDS)("%s — readonly, non-destructive, idempotent", (cmd) => {
      const entry = catalog.get(cmd)!;
      expect(entry).not.toBeNull();
      expect(entry.category).toBe("query");
      expect(entry.tags).toEqual(["query"]);
      expect(entry.annotations.readonly).toBe(true);
      expect(entry.annotations.destructive).toBe(false);
      expect(entry.annotations.idempotent).toBe(true);
      expect(entry.annotations.requiresApproval).toBe(false);
      expect(entry.annotations.openWorld).toBe(false);
    });

    it("should have 10 query commands", () => {
      expect(QUERY_COMMANDS.length).toBe(10);
    });
  });

  // ----------------------------------------------------------------
  // Format category (24 = 22 idempotent + 2 non-idempotent)
  // ----------------------------------------------------------------

  describe("format commands (idempotent)", () => {
    it.each(FORMAT_IDEMPOTENT_COMMANDS)(
      "%s — non-readonly, non-destructive, idempotent",
      (cmd) => {
        const entry = catalog.get(cmd)!;
        expect(entry).not.toBeNull();
        expect(entry.category).toBe("format");
        expect(entry.tags).toEqual(["format"]);
        expect(entry.annotations.readonly).toBe(false);
        expect(entry.annotations.destructive).toBe(false);
        expect(entry.annotations.idempotent).toBe(true);
        expect(entry.annotations.requiresApproval).toBe(false);
        expect(entry.annotations.openWorld).toBe(false);
      },
    );

    it("should have 34 idempotent format commands", () => {
      expect(FORMAT_IDEMPOTENT_COMMANDS.length).toBe(34);
    });
  });

  describe("format commands (non-idempotent)", () => {
    it.each(FORMAT_NON_IDEMPOTENT_COMMANDS)(
      "%s — non-readonly, non-destructive, NOT idempotent",
      (cmd) => {
        const entry = catalog.get(cmd)!;
        expect(entry).not.toBeNull();
        expect(entry.category).toBe("format");
        expect(entry.tags).toEqual(["format"]);
        expect(entry.annotations.readonly).toBe(false);
        expect(entry.annotations.destructive).toBe(false);
        expect(entry.annotations.idempotent).toBe(false);
        expect(entry.annotations.requiresApproval).toBe(false);
        expect(entry.annotations.openWorld).toBe(false);
      },
    );

    it("should have 2 non-idempotent format commands", () => {
      expect(FORMAT_NON_IDEMPOTENT_COMMANDS.length).toBe(2);
    });

    it("total format commands should be 36", () => {
      expect(
        FORMAT_IDEMPOTENT_COMMANDS.length + FORMAT_NON_IDEMPOTENT_COMMANDS.length,
      ).toBe(36);
    });
  });

  // ----------------------------------------------------------------
  // Content category (10)
  // ----------------------------------------------------------------

  describe("content commands", () => {
    it.each(CONTENT_COMMANDS)(
      "%s — non-readonly, non-destructive, non-idempotent",
      (cmd) => {
        const entry = catalog.get(cmd)!;
        expect(entry).not.toBeNull();
        expect(entry.category).toBe("content");
        expect(entry.tags).toEqual(["content"]);
        expect(entry.annotations.readonly).toBe(false);
        expect(entry.annotations.destructive).toBe(false);
        expect(entry.annotations.idempotent).toBe(false);
        expect(entry.annotations.requiresApproval).toBe(false);
        expect(entry.annotations.openWorld).toBe(false);
      },
    );

    it("should have 15 content commands", () => {
      expect(CONTENT_COMMANDS.length).toBe(15);
    });
  });

  // ----------------------------------------------------------------
  // Destructive category (6)
  // ----------------------------------------------------------------

  describe("destructive commands", () => {
    it.each(DESTRUCTIVE_COMMANDS)(
      "%s — destructive, requires approval",
      (cmd) => {
        const entry = catalog.get(cmd)!;
        expect(entry).not.toBeNull();
        expect(entry.category).toBe("destructive");
        expect(entry.tags).toEqual(["destructive"]);
        expect(entry.annotations.readonly).toBe(false);
        expect(entry.annotations.destructive).toBe(true);
        expect(entry.annotations.idempotent).toBe(false);
        expect(entry.annotations.requiresApproval).toBe(true);
        expect(entry.annotations.openWorld).toBe(false);
      },
    );

    it("should have 6 destructive commands", () => {
      expect(DESTRUCTIVE_COMMANDS.length).toBe(6);
    });
  });

  // ----------------------------------------------------------------
  // Selection category (9)
  // ----------------------------------------------------------------

  describe("selection commands", () => {
    it.each(SELECTION_COMMANDS)(
      "%s — non-destructive, idempotent",
      (cmd) => {
        const entry = catalog.get(cmd)!;
        expect(entry).not.toBeNull();
        expect(entry.category).toBe("selection");
        expect(entry.tags).toEqual(["selection"]);
        expect(entry.annotations.readonly).toBe(false);
        expect(entry.annotations.destructive).toBe(false);
        expect(entry.annotations.idempotent).toBe(true);
        expect(entry.annotations.requiresApproval).toBe(false);
        expect(entry.annotations.openWorld).toBe(false);
      },
    );

    it("should have 10 selection commands", () => {
      expect(SELECTION_COMMANDS.length).toBe(10);
    });
  });

  // ----------------------------------------------------------------
  // History category (2)
  // ----------------------------------------------------------------

  describe("history commands", () => {
    it.each(HISTORY_COMMANDS)(
      "%s — non-idempotent",
      (cmd) => {
        const entry = catalog.get(cmd)!;
        expect(entry).not.toBeNull();
        expect(entry.category).toBe("history");
        expect(entry.tags).toEqual(["history"]);
        expect(entry.annotations.readonly).toBe(false);
        expect(entry.annotations.destructive).toBe(false);
        expect(entry.annotations.idempotent).toBe(false);
        expect(entry.annotations.requiresApproval).toBe(false);
        expect(entry.annotations.openWorld).toBe(false);
      },
    );

    it("should have 2 history commands", () => {
      expect(HISTORY_COMMANDS.length).toBe(2);
    });
  });

  // ----------------------------------------------------------------
  // Unknown commands
  // ----------------------------------------------------------------

  describe("unknown commands", () => {
    it("get() should return null for an unknown command", () => {
      expect(catalog.get("nonExistentCommand")).toBeNull();
    });

    it("get() should return null for an empty string", () => {
      expect(catalog.get("")).toBeNull();
    });

    it("getCategory() should return 'unknown' for an unknown command", () => {
      expect(catalog.getCategory("nonExistentCommand")).toBe("unknown");
    });

    it("getCategory() should return 'unknown' for an empty string", () => {
      expect(catalog.getCategory("")).toBe("unknown");
    });
  });

  // ----------------------------------------------------------------
  // getCategory() happy path
  // ----------------------------------------------------------------

  describe("getCategory()", () => {
    it.each([
      ["getHTML", "query"],
      ["toggleBold", "format"],
      ["setHardBreak", "format"],
      ["insertContent", "content"],
      ["clearContent", "destructive"],
      ["selectAll", "selection"],
      ["undo", "history"],
    ])("getCategory('%s') === '%s'", (cmd, expected) => {
      expect(catalog.getCategory(cmd)).toBe(expected);
    });
  });

  // ----------------------------------------------------------------
  // Structural validation: every entry must conform to AnnotationEntry
  // ----------------------------------------------------------------

  describe("structural validation", () => {
    it.each(ALL_COMMANDS)(
      "%s has a valid AnnotationEntry structure",
      (cmd) => {
        const entry: AnnotationEntry | null = catalog.get(cmd);
        expect(entry).not.toBeNull();

        // annotations object must have exactly the 5 boolean keys
        const ann = entry!.annotations;
        expect(typeof ann.readonly).toBe("boolean");
        expect(typeof ann.destructive).toBe("boolean");
        expect(typeof ann.idempotent).toBe("boolean");
        expect(typeof ann.requiresApproval).toBe("boolean");
        expect(typeof ann.openWorld).toBe("boolean");

        // tags must be a non-empty string array
        expect(Array.isArray(entry!.tags)).toBe(true);
        expect(entry!.tags.length).toBeGreaterThan(0);
        for (const tag of entry!.tags) {
          expect(typeof tag).toBe("string");
        }

        // category must be a non-empty string
        expect(typeof entry!.category).toBe("string");
        expect(entry!.category.length).toBeGreaterThan(0);
      },
    );
  });

  // ----------------------------------------------------------------
  // Independent instances do not share state
  // ----------------------------------------------------------------

  it("multiple instances are independent", () => {
    const a = new AnnotationCatalog();
    const b = new AnnotationCatalog();
    expect(a.get("undo")).toEqual(b.get("undo"));
    // They should be structurally equal but not referentially identical maps
    expect(a).not.toBe(b);
  });
});
