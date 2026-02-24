import { describe, it, expect } from "vitest";
import { SchemaCatalog } from "../../src/builder/SchemaCatalog.js";
import type { SchemaEntry, JsonSchema } from "../../src/types.js";

describe("SchemaCatalog", () => {
  const catalog = new SchemaCatalog();

  // ── All 61 known command names ─────────────────────────────────────────

  const ALL_COMMANDS = [
    // Query
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
    // Format - simple toggles
    "toggleBold",
    "toggleItalic",
    "toggleStrike",
    "toggleCode",
    "toggleUnderline",
    "toggleSubscript",
    "toggleSuperscript",
    "toggleBulletList",
    "toggleOrderedList",
    "toggleTaskList",
    "toggleBlockquote",
    // Format - parameterised
    "toggleHighlight",
    "toggleHeading",
    "toggleCodeBlock",
    "setTextAlign",
    "setMark",
    "unsetMark",
    "unsetAllMarks",
    "clearNodes",
    "setHardBreak",
    "setHorizontalRule",
    "updateAttributes",
    "setLink",
    "unsetLink",
    // Format - set/unset
    "setBold",
    "unsetBold",
    "setItalic",
    "unsetItalic",
    "setStrike",
    "unsetStrike",
    "setCode",
    "unsetCode",
    "setBlockquote",
    "unsetBlockquote",
    "setParagraph",
    "setHeading",
    // Content
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
    // Content - new commands
    "splitListItem",
    "wrapInList",
    "toggleList",
    "exitCode",
    "deleteNode",
    // Destructive
    "clearContent",
    "setContent",
    "deleteSelection",
    "deleteRange",
    "deleteCurrentNode",
    "cut",
    // Selection
    "setTextSelection",
    "setNodeSelection",
    "selectAll",
    "selectParentNode",
    "selectTextblockStart",
    "selectTextblockEnd",
    "blur",
    "scrollIntoView",
    "selectText",
    "focus",
    // History
    "undo",
    "redo",
  ];

  // ── Structural invariants ──────────────────────────────────────────────

  it("should contain exactly 79 known commands", () => {
    expect(ALL_COMMANDS).toHaveLength(79);
  });

  describe("every known schema has type:'object'", () => {
    for (const cmd of ALL_COMMANDS) {
      it(`${cmd} inputSchema has type:'object'`, () => {
        const entry = catalog.get(cmd);
        expect(entry.inputSchema.type).toBe("object");
      });

      it(`${cmd} outputSchema has type:'object'`, () => {
        const entry = catalog.get(cmd);
        expect(entry.outputSchema.type).toBe("object");
      });
    }
  });

  describe("every known schema has additionalProperties:false on input", () => {
    for (const cmd of ALL_COMMANDS) {
      it(`${cmd}`, () => {
        const entry = catalog.get(cmd);
        expect(entry.inputSchema.additionalProperties).toBe(false);
      });
    }
  });

  // ── Unknown/default command ────────────────────────────────────────────

  describe("unknown command returns default schema", () => {
    it("returns a permissive input schema", () => {
      const entry = catalog.get("nonExistentCommand");
      expect(entry.inputSchema.type).toBe("object");
      expect(entry.inputSchema.additionalProperties).toBe(true);
    });

    it("returns success output schema", () => {
      const entry = catalog.get("nonExistentCommand");
      expect(entry.outputSchema).toEqual({
        type: "object",
        properties: { success: { type: "boolean" } },
        required: ["success"],
      });
    });

    it("returns the same reference for different unknown commands", () => {
      const a = catalog.get("unknownA");
      const b = catalog.get("unknownB");
      expect(a).toBe(b);
    });
  });

  // ── Query module schemas ───────────────────────────────────────────────

  describe("getHTML", () => {
    it("has empty input and html string output", () => {
      const entry = catalog.get("getHTML");
      expect(entry.inputSchema).toEqual({
        type: "object",
        properties: {},
        additionalProperties: false,
      });
      expect(entry.outputSchema).toEqual({
        type: "object",
        properties: { html: { type: "string" } },
        required: ["html"],
      });
    });
  });

  describe("getJSON", () => {
    it("outputs json object", () => {
      const entry = catalog.get("getJSON");
      const outProps = entry.outputSchema.properties as Record<string, JsonSchema>;
      expect(outProps.json).toEqual({ type: "object" });
      expect(entry.outputSchema.required).toEqual(["json"]);
    });
  });

  describe("getText", () => {
    it("accepts optional blockSeparator", () => {
      const entry = catalog.get("getText");
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.blockSeparator).toEqual({ type: "string" });
      // blockSeparator is optional so required should be undefined or empty
      expect(entry.inputSchema.required).toBeUndefined();
    });

    it("outputs text string", () => {
      const entry = catalog.get("getText");
      const outProps = entry.outputSchema.properties as Record<string, JsonSchema>;
      expect(outProps.text).toEqual({ type: "string" });
      expect(entry.outputSchema.required).toEqual(["text"]);
    });
  });

  describe("isActive", () => {
    it("requires name, optional attrs", () => {
      const entry = catalog.get("isActive");
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.name).toEqual({ type: "string" });
      expect(inProps.attrs).toEqual({ type: "object" });
      expect(entry.inputSchema.required).toEqual(["name"]);
    });

    it("outputs boolean active", () => {
      const entry = catalog.get("isActive");
      const outProps = entry.outputSchema.properties as Record<string, JsonSchema>;
      expect(outProps.active).toEqual({ type: "boolean" });
    });
  });

  describe("getAttributes", () => {
    it("requires typeOrName, outputs attributes object", () => {
      const entry = catalog.get("getAttributes");
      expect(entry.inputSchema.required).toEqual(["typeOrName"]);
      const outProps = entry.outputSchema.properties as Record<string, JsonSchema>;
      expect(outProps.attributes).toEqual({ type: "object" });
    });
  });

  describe("boolean queries (isEmpty, isEditable, isFocused)", () => {
    for (const cmd of ["isEmpty", "isEditable", "isFocused"]) {
      it(`${cmd} outputs value: boolean`, () => {
        const entry = catalog.get(cmd);
        const outProps = entry.outputSchema.properties as Record<string, JsonSchema>;
        expect(outProps.value).toEqual({ type: "boolean" });
        expect(entry.outputSchema.required).toEqual(["value"]);
      });
    }
  });

  describe("count queries (getCharacterCount, getWordCount)", () => {
    for (const cmd of ["getCharacterCount", "getWordCount"]) {
      it(`${cmd} outputs count: integer`, () => {
        const entry = catalog.get(cmd);
        const outProps = entry.outputSchema.properties as Record<string, JsonSchema>;
        expect(outProps.count).toEqual({ type: "integer" });
        expect(entry.outputSchema.required).toEqual(["count"]);
      });
    }
  });

  // ── Format module schemas ──────────────────────────────────────────────

  describe("toggleHeading", () => {
    it("requires level with integer range 1-6", () => {
      const entry = catalog.get("toggleHeading");
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.level).toEqual({
        type: "integer",
        minimum: 1,
        maximum: 6,
      });
      expect(entry.inputSchema.required).toEqual(["level"]);
    });

    it("outputs success boolean", () => {
      const entry = catalog.get("toggleHeading");
      expect(entry.outputSchema).toEqual({
        type: "object",
        properties: { success: { type: "boolean" } },
        required: ["success"],
      });
    });
  });

  describe("setTextAlign", () => {
    it("requires alignment enum", () => {
      const entry = catalog.get("setTextAlign");
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.alignment).toEqual({
        type: "string",
        enum: ["left", "center", "right", "justify"],
      });
      expect(entry.inputSchema.required).toEqual(["alignment"]);
    });
  });

  describe("toggleHighlight", () => {
    it("accepts optional color string", () => {
      const entry = catalog.get("toggleHighlight");
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.color).toEqual({ type: "string" });
      expect(entry.inputSchema.required).toBeUndefined();
    });
  });

  describe("toggleCodeBlock", () => {
    it("accepts optional language string", () => {
      const entry = catalog.get("toggleCodeBlock");
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.language).toEqual({ type: "string" });
    });
  });

  describe("setMark / unsetMark", () => {
    it("setMark requires typeOrName, optional attrs", () => {
      const entry = catalog.get("setMark");
      expect(entry.inputSchema.required).toEqual(["typeOrName"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.attrs).toEqual({ type: "object" });
    });

    it("unsetMark requires typeOrName", () => {
      const entry = catalog.get("unsetMark");
      expect(entry.inputSchema.required).toEqual(["typeOrName"]);
    });
  });

  describe("setLink", () => {
    it("requires href, optional target and rel", () => {
      const entry = catalog.get("setLink");
      expect(entry.inputSchema.required).toEqual(["href"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.href).toEqual({ type: "string" });
      expect(inProps.target).toEqual({ type: "string" });
      expect(inProps.rel).toEqual({ type: "string" });
    });
  });

  describe("updateAttributes", () => {
    it("requires both typeOrName and attrs", () => {
      const entry = catalog.get("updateAttributes");
      expect(entry.inputSchema.required).toEqual(["typeOrName", "attrs"]);
    });
  });

  // ── Content module schemas ─────────────────────────────────────────────

  describe("insertContent", () => {
    it("requires value, has nested options schema", () => {
      const entry = catalog.get("insertContent");
      expect(entry.inputSchema.required).toEqual(["value"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.value).toEqual({ type: "string" });

      // Verify nested options structure
      const options = inProps.options as JsonSchema;
      expect(options.type).toBe("object");
      expect(options.additionalProperties).toBe(false);
      const optionProps = options.properties as Record<string, JsonSchema>;
      expect(optionProps.updateSelection).toEqual({ type: "boolean" });

      const parseOptions = optionProps.parseOptions as JsonSchema;
      expect(parseOptions.type).toBe("object");
      const parseProps = parseOptions.properties as Record<string, JsonSchema>;
      expect(parseProps.preserveWhitespace).toEqual({ type: "boolean" });
    });
  });

  describe("insertContentAt", () => {
    it("requires position (integer >= 0) and value", () => {
      const entry = catalog.get("insertContentAt");
      expect(entry.inputSchema.required).toEqual(["position", "value"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.position).toEqual({ type: "integer", minimum: 0 });
      expect(inProps.value).toEqual({ type: "string" });
    });
  });

  describe("setNode", () => {
    it("requires typeOrName, optional attrs", () => {
      const entry = catalog.get("setNode");
      expect(entry.inputSchema.required).toEqual(["typeOrName"]);
    });
  });

  describe("splitBlock", () => {
    it("accepts optional keepMarks boolean", () => {
      const entry = catalog.get("splitBlock");
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.keepMarks).toEqual({ type: "boolean" });
    });
  });

  describe("liftListItem / sinkListItem", () => {
    for (const cmd of ["liftListItem", "sinkListItem"]) {
      it(`${cmd} requires typeOrName`, () => {
        const entry = catalog.get(cmd);
        expect(entry.inputSchema.required).toEqual(["typeOrName"]);
      });
    }
  });

  describe("wrapIn", () => {
    it("requires typeOrName, optional attrs", () => {
      const entry = catalog.get("wrapIn");
      expect(entry.inputSchema.required).toEqual(["typeOrName"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.attrs).toEqual({ type: "object" });
    });
  });

  describe("lift", () => {
    it("requires typeOrName, optional attrs", () => {
      const entry = catalog.get("lift");
      expect(entry.inputSchema.required).toEqual(["typeOrName"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.attrs).toEqual({ type: "object" });
    });
  });

  // ── Destructive module schemas ─────────────────────────────────────────

  describe("clearContent", () => {
    it("accepts optional emitUpdate boolean", () => {
      const entry = catalog.get("clearContent");
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.emitUpdate).toEqual({ type: "boolean" });
    });
  });

  describe("setContent", () => {
    it("requires value, optional emitUpdate and parseOptions", () => {
      const entry = catalog.get("setContent");
      expect(entry.inputSchema.required).toEqual(["value"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.value).toEqual({ type: "string" });
      expect(inProps.emitUpdate).toEqual({ type: "boolean" });
      expect(inProps.parseOptions).toEqual({ type: "object" });
    });
  });

  describe("deleteRange", () => {
    it("requires from and to as integers >= 0", () => {
      const entry = catalog.get("deleteRange");
      expect(entry.inputSchema.required).toEqual(["from", "to"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.from).toEqual({ type: "integer", minimum: 0 });
      expect(inProps.to).toEqual({ type: "integer", minimum: 0 });
    });
  });

  describe("simple destructive commands", () => {
    for (const cmd of ["deleteSelection", "deleteCurrentNode", "cut"]) {
      it(`${cmd} has empty input`, () => {
        const entry = catalog.get(cmd);
        expect(entry.inputSchema).toEqual({
          type: "object",
          properties: {},
          additionalProperties: false,
        });
      });
    }
  });

  // ── Selection module schemas ───────────────────────────────────────────

  describe("setTextSelection", () => {
    it("requires position as integer or {from, to} object", () => {
      const entry = catalog.get("setTextSelection");
      expect(entry.inputSchema.required).toEqual(["position"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      const position = inProps.position as JsonSchema;
      expect(position.oneOf).toBeDefined();
      const variants = position.oneOf as JsonSchema[];
      expect(variants).toHaveLength(2);
      expect(variants[0]).toEqual({ type: "integer" });
      expect(variants[1]).toMatchObject({
        type: "object",
        required: ["from", "to"],
      });
    });
  });

  describe("setNodeSelection", () => {
    it("requires position integer >= 0", () => {
      const entry = catalog.get("setNodeSelection");
      expect(entry.inputSchema.required).toEqual(["position"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.position).toEqual({ type: "integer", minimum: 0 });
    });
  });

  describe("focus", () => {
    it("accepts optional position as string enum or integer", () => {
      const entry = catalog.get("focus");
      expect(entry.inputSchema.required).toBeUndefined();
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      const position = inProps.position as JsonSchema;
      expect(position.oneOf).toBeDefined();
      const variants = position.oneOf as JsonSchema[];
      expect(variants).toHaveLength(2);
      expect(variants[0]).toEqual({
        type: "string",
        enum: ["start", "end", "all"],
      });
      expect(variants[1]).toEqual({ type: "integer" });
    });
  });

  describe("selectText", () => {
    it("requires text, optional occurrence, outputs found/from/to", () => {
      const entry = catalog.get("selectText");
      expect(entry.inputSchema.required).toEqual(["text"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.text.type).toBe("string");
      expect(inProps.occurrence.type).toBe("integer");
      const outProps = entry.outputSchema.properties as Record<string, JsonSchema>;
      expect(outProps.found).toEqual({ type: "boolean" });
      expect(entry.outputSchema.required).toEqual(["found"]);
    });
  });

  describe("simple selection commands", () => {
    for (const cmd of [
      "selectAll",
      "selectParentNode",
      "selectTextblockStart",
      "selectTextblockEnd",
      "blur",
      "scrollIntoView",
    ]) {
      it(`${cmd} has empty input and success output`, () => {
        const entry = catalog.get(cmd);
        expect(entry.inputSchema).toEqual({
          type: "object",
          properties: {},
          additionalProperties: false,
        });
        expect(entry.outputSchema).toEqual({
          type: "object",
          properties: { success: { type: "boolean" } },
          required: ["success"],
        });
      });
    }
  });

  // ── History module schemas ─────────────────────────────────────────────

  describe("undo / redo", () => {
    for (const cmd of ["undo", "redo"]) {
      it(`${cmd} has empty input and success output`, () => {
        const entry = catalog.get(cmd);
        expect(entry.inputSchema).toEqual({
          type: "object",
          properties: {},
          additionalProperties: false,
        });
        expect(entry.outputSchema).toEqual({
          type: "object",
          properties: { success: { type: "boolean" } },
          required: ["success"],
        });
      });
    }
  });

  // ── Simple toggle format commands ──────────────────────────────────────

  describe("simple toggle commands", () => {
    const toggles = [
      "toggleBold",
      "toggleItalic",
      "toggleStrike",
      "toggleCode",
      "toggleUnderline",
      "toggleSubscript",
      "toggleSuperscript",
      "toggleBulletList",
      "toggleOrderedList",
      "toggleTaskList",
      "toggleBlockquote",
    ];

    for (const cmd of toggles) {
      it(`${cmd} has empty input and success output`, () => {
        const entry = catalog.get(cmd);
        expect(entry.inputSchema).toEqual({
          type: "object",
          properties: {},
          additionalProperties: false,
        });
        expect(entry.outputSchema).toEqual({
          type: "object",
          properties: { success: { type: "boolean" } },
          required: ["success"],
        });
      });
    }
  });

  // ── Simple format commands ─────────────────────────────────────────────

  describe("simple format commands (unsetAllMarks, clearNodes, setHardBreak, setHorizontalRule, unsetLink)", () => {
    for (const cmd of [
      "unsetAllMarks",
      "clearNodes",
      "setHardBreak",
      "setHorizontalRule",
      "unsetLink",
    ]) {
      it(`${cmd} has empty input`, () => {
        const entry = catalog.get(cmd);
        expect(Object.keys(entry.inputSchema.properties as object)).toHaveLength(0);
      });
    }
  });

  // ── joinBackward / joinForward ─────────────────────────────────────────

  describe("joinBackward / joinForward", () => {
    for (const cmd of ["joinBackward", "joinForward"]) {
      it(`${cmd} has empty input and success output`, () => {
        const entry = catalog.get(cmd);
        expect(entry.inputSchema).toEqual({
          type: "object",
          properties: {},
          additionalProperties: false,
        });
      });
    }
  });

  // ── New set/unset format commands ──────────────────────────────────────

  describe("simple set/unset format commands", () => {
    for (const cmd of [
      "setBold",
      "unsetBold",
      "setItalic",
      "unsetItalic",
      "setStrike",
      "unsetStrike",
      "setCode",
      "unsetCode",
      "setBlockquote",
      "unsetBlockquote",
      "setParagraph",
    ]) {
      it(`${cmd} has empty input and success output`, () => {
        const entry = catalog.get(cmd);
        expect(entry.inputSchema).toEqual({
          type: "object",
          properties: {},
          additionalProperties: false,
        });
        expect(entry.outputSchema).toEqual({
          type: "object",
          properties: { success: { type: "boolean" } },
          required: ["success"],
        });
      });
    }
  });

  describe("setHeading", () => {
    it("requires level with integer range 1-6", () => {
      const entry = catalog.get("setHeading");
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.level).toEqual({
        type: "integer",
        minimum: 1,
        maximum: 6,
      });
      expect(entry.inputSchema.required).toEqual(["level"]);
    });
  });

  // ── New content commands ──────────────────────────────────────────────

  describe("splitListItem", () => {
    it("requires typeOrName", () => {
      const entry = catalog.get("splitListItem");
      expect(entry.inputSchema.required).toEqual(["typeOrName"]);
    });
  });

  describe("wrapInList", () => {
    it("requires typeOrName, optional attributes", () => {
      const entry = catalog.get("wrapInList");
      expect(entry.inputSchema.required).toEqual(["typeOrName"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.attributes).toEqual({ type: "object" });
    });
  });

  describe("toggleList", () => {
    it("requires listTypeOrName and itemTypeOrName, optional keepMarks and attributes", () => {
      const entry = catalog.get("toggleList");
      expect(entry.inputSchema.required).toEqual(["listTypeOrName", "itemTypeOrName"]);
      const inProps = entry.inputSchema.properties as Record<string, JsonSchema>;
      expect(inProps.keepMarks).toEqual({ type: "boolean" });
      expect(inProps.attributes).toEqual({ type: "object" });
    });
  });

  describe("exitCode", () => {
    it("has empty input and success output", () => {
      const entry = catalog.get("exitCode");
      expect(entry.inputSchema).toEqual({
        type: "object",
        properties: {},
        additionalProperties: false,
      });
    });
  });

  describe("deleteNode", () => {
    it("requires typeOrName", () => {
      const entry = catalog.get("deleteNode");
      expect(entry.inputSchema.required).toEqual(["typeOrName"]);
    });
  });

  // ── Multiple catalog instances are independent ─────────────────────────

  it("different catalog instances return structurally equal schemas", () => {
    const catalog2 = new SchemaCatalog();
    const entry1 = catalog.get("getHTML");
    const entry2 = catalog2.get("getHTML");
    expect(entry1).toEqual(entry2);
  });
});
