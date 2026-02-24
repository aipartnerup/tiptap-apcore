import { describe, it, expect } from "vitest";
import { ModuleBuilder } from "../../src/builder/ModuleBuilder.js";
import type {
  ExtensionCommandInfo,
  ModuleDescriptor,
  ModuleAnnotations,
} from "../../src/types.js";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

/** Convenience factory for ExtensionCommandInfo used across tests. */
function extensionInfo(
  extensionName: string = "Bold",
  commandNames: string[] = ["toggleBold"],
  extensionType: "node" | "mark" | "extension" = "mark",
): ExtensionCommandInfo {
  return { extensionName, commandNames, extensionType };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("ModuleBuilder", () => {
  const builder = new ModuleBuilder();

  // ================================================================
  // buildModuleId
  // ================================================================

  describe("buildModuleId", () => {
    // ── Known commands across all categories ─────────────────────────

    describe("known commands produce correct module IDs", () => {
      it.each([
        // Query
        ["getHTML", "tiptap.query.getHTML"],
        ["getJSON", "tiptap.query.getJSON"],
        ["getText", "tiptap.query.getText"],
        ["isActive", "tiptap.query.isActive"],
        ["getAttributes", "tiptap.query.getAttributes"],
        ["isEmpty", "tiptap.query.isEmpty"],
        ["isEditable", "tiptap.query.isEditable"],
        ["isFocused", "tiptap.query.isFocused"],
        ["getCharacterCount", "tiptap.query.getCharacterCount"],
        ["getWordCount", "tiptap.query.getWordCount"],
        // Format
        ["toggleBold", "tiptap.format.toggleBold"],
        ["toggleItalic", "tiptap.format.toggleItalic"],
        ["setTextAlign", "tiptap.format.setTextAlign"],
        ["setLink", "tiptap.format.setLink"],
        ["setHardBreak", "tiptap.format.setHardBreak"],
        ["setHorizontalRule", "tiptap.format.setHorizontalRule"],
        // Content
        ["insertContent", "tiptap.content.insertContent"],
        ["insertContentAt", "tiptap.content.insertContentAt"],
        ["setNode", "tiptap.content.setNode"],
        ["wrapIn", "tiptap.content.wrapIn"],
        // Destructive
        ["clearContent", "tiptap.destructive.clearContent"],
        ["setContent", "tiptap.destructive.setContent"],
        ["deleteSelection", "tiptap.destructive.deleteSelection"],
        ["deleteRange", "tiptap.destructive.deleteRange"],
        ["deleteCurrentNode", "tiptap.destructive.deleteCurrentNode"],
        ["cut", "tiptap.destructive.cut"],
        // Selection
        ["setTextSelection", "tiptap.selection.setTextSelection"],
        ["selectAll", "tiptap.selection.selectAll"],
        ["focus", "tiptap.selection.focus"],
        ["blur", "tiptap.selection.blur"],
        // History
        ["undo", "tiptap.history.undo"],
        ["redo", "tiptap.history.redo"],
      ])("buildModuleId('%s') → '%s'", (cmd, expected) => {
        expect(builder.buildModuleId(cmd)).toBe(expected);
      });
    });

    // ── Custom prefix ────────────────────────────────────────────────

    describe("custom prefix", () => {
      const custom = new ModuleBuilder("myapp");

      it("uses the custom prefix for known commands", () => {
        expect(custom.buildModuleId("toggleBold")).toBe(
          "myapp.format.toggleBold",
        );
      });

      it("uses the custom prefix for unknown commands", () => {
        expect(custom.buildModuleId("customCmd")).toBe(
          "myapp.unknown.customCmd",
        );
      });
    });

    // ── Unknown commands ─────────────────────────────────────────────

    describe("unknown commands", () => {
      it("assigns 'unknown' category", () => {
        expect(builder.buildModuleId("customCmd")).toBe(
          "tiptap.unknown.customCmd",
        );
      });

      it("handles empty string command name", () => {
        expect(builder.buildModuleId("")).toBe("tiptap.unknown.");
      });
    });

    // ── Explicit category override ───────────────────────────────────

    describe("explicit category parameter", () => {
      it("uses the provided category instead of looking it up", () => {
        expect(builder.buildModuleId("toggleBold", "custom")).toBe(
          "tiptap.custom.toggleBold",
        );
      });
    });
  });

  // ================================================================
  // build()
  // ================================================================

  describe("build()", () => {
    // ── Complete descriptor for a known command ──────────────────────

    describe("known command — toggleBold", () => {
      const info = extensionInfo("Bold", ["toggleBold"], "mark");
      const descriptor = builder.build("toggleBold", info);

      it("returns a valid moduleId", () => {
        expect(descriptor.moduleId).toBe("tiptap.format.toggleBold");
      });

      it("generates a description string", () => {
        expect(descriptor.description).toBeTypeOf("string");
        expect(descriptor.description.length).toBeGreaterThan(0);
        expect(descriptor.description).toContain("Bold");
      });

      it("includes inputSchema from SchemaCatalog", () => {
        expect(descriptor.inputSchema).toBeDefined();
        expect(descriptor.inputSchema.type).toBe("object");
      });

      it("includes outputSchema from SchemaCatalog", () => {
        expect(descriptor.outputSchema).toBeDefined();
        expect(descriptor.outputSchema.type).toBe("object");
      });

      it("includes annotations from AnnotationCatalog", () => {
        expect(descriptor.annotations).not.toBeNull();
        const ann = descriptor.annotations as ModuleAnnotations;
        expect(ann.readonly).toBe(false);
        expect(ann.destructive).toBe(false);
        expect(ann.idempotent).toBe(true);
        expect(ann.requiresApproval).toBe(false);
        expect(ann.openWorld).toBe(false);
      });

      it("includes tags from AnnotationCatalog", () => {
        expect(descriptor.tags).toEqual(["format"]);
      });

      it("sets version to '0.1.0'", () => {
        expect(descriptor.version).toBe("0.1.0");
      });

      it("sets documentation URL", () => {
        expect(descriptor.documentation).toBe(
          "https://tiptap.dev/docs/editor/api/commands/toggleBold",
        );
      });
    });

    // ── Known query command ──────────────────────────────────────────

    describe("known command — getHTML (query category)", () => {
      const info = extensionInfo("Core", ["getHTML"], "extension");
      const descriptor = builder.build("getHTML", info);

      it("has the correct moduleId", () => {
        expect(descriptor.moduleId).toBe("tiptap.query.getHTML");
      });

      it("has readonly annotations", () => {
        const ann = descriptor.annotations as ModuleAnnotations;
        expect(ann.readonly).toBe(true);
        expect(ann.idempotent).toBe(true);
      });

      it("has query tags", () => {
        expect(descriptor.tags).toEqual(["query"]);
      });

      it("description mentions the extension name", () => {
        expect(descriptor.description).toContain("Core");
      });
    });

    // ── Known destructive command ────────────────────────────────────

    describe("known command — clearContent (destructive category)", () => {
      const info = extensionInfo("Core", ["clearContent"], "extension");
      const descriptor = builder.build("clearContent", info);

      it("has the correct moduleId", () => {
        expect(descriptor.moduleId).toBe(
          "tiptap.destructive.clearContent",
        );
      });

      it("is marked destructive and requires approval", () => {
        const ann = descriptor.annotations as ModuleAnnotations;
        expect(ann.destructive).toBe(true);
        expect(ann.requiresApproval).toBe(true);
      });

      it("has destructive tags", () => {
        expect(descriptor.tags).toEqual(["destructive"]);
      });
    });

    // ── Known selection command ──────────────────────────────────────

    describe("known command — selectAll (selection category)", () => {
      const info = extensionInfo("Core", ["selectAll"], "extension");
      const descriptor = builder.build("selectAll", info);

      it("has the correct moduleId", () => {
        expect(descriptor.moduleId).toBe("tiptap.selection.selectAll");
      });

      it("has selection tags", () => {
        expect(descriptor.tags).toEqual(["selection"]);
      });
    });

    // ── Known history command ────────────────────────────────────────

    describe("known command — undo (history category)", () => {
      const info = extensionInfo("History", ["undo"], "extension");
      const descriptor = builder.build("undo", info);

      it("has the correct moduleId", () => {
        expect(descriptor.moduleId).toBe("tiptap.history.undo");
      });

      it("has history tags", () => {
        expect(descriptor.tags).toEqual(["history"]);
      });
    });

    // ── Known content command ────────────────────────────────────────

    describe("known command — insertContent (content category)", () => {
      const info = extensionInfo("Core", ["insertContent"], "extension");
      const descriptor = builder.build("insertContent", info);

      it("has the correct moduleId", () => {
        expect(descriptor.moduleId).toBe("tiptap.content.insertContent");
      });

      it("has content tags", () => {
        expect(descriptor.tags).toEqual(["content"]);
      });
    });

    // ── Unknown command ──────────────────────────────────────────────

    describe("unknown command", () => {
      const info = extensionInfo("CustomExtension", ["customCmd"], "extension");
      const descriptor = builder.build("customCmd", info);

      it("assigns unknown category in moduleId", () => {
        expect(descriptor.moduleId).toBe("tiptap.unknown.customCmd");
      });

      it("gets default annotations", () => {
        expect(descriptor.annotations).toEqual({
          readonly: false,
          destructive: false,
          idempotent: false,
          requiresApproval: false,
          openWorld: false,
          streaming: false,
        });
      });

      it("gets ['unknown'] tags", () => {
        expect(descriptor.tags).toEqual(["unknown"]);
      });

      it("sets version to '0.1.0'", () => {
        expect(descriptor.version).toBe("0.1.0");
      });

      it("sets documentation URL", () => {
        expect(descriptor.documentation).toBe(
          "https://tiptap.dev/docs/editor/api/commands/customCmd",
        );
      });

      it("generates a description string with extension name", () => {
        expect(descriptor.description).toBeTypeOf("string");
        expect(descriptor.description).toContain("CustomExtension");
      });

      it("uses permissive default input schema", () => {
        expect(descriptor.inputSchema.additionalProperties).toBe(true);
      });
    });

    // ── Structural validation ────────────────────────────────────────

    describe("structural validation — all required ModuleDescriptor fields", () => {
      const REQUIRED_KEYS: (keyof ModuleDescriptor)[] = [
        "moduleId",
        "description",
        "inputSchema",
        "outputSchema",
        "annotations",
      ];

      const OPTIONAL_KEYS: (keyof ModuleDescriptor)[] = [
        "documentation",
        "tags",
        "version",
      ];

      const info = extensionInfo("Bold", ["toggleBold"], "mark");
      const descriptor = builder.build("toggleBold", info);

      for (const key of REQUIRED_KEYS) {
        it(`has required field: ${key}`, () => {
          expect(descriptor).toHaveProperty(key);
          expect(descriptor[key]).toBeDefined();
        });
      }

      for (const key of OPTIONAL_KEYS) {
        it(`has optional field: ${key}`, () => {
          expect(descriptor).toHaveProperty(key);
        });
      }
    });

    // ── build() with custom prefix ───────────────────────────────────

    describe("custom prefix in build()", () => {
      const custom = new ModuleBuilder("myapp");
      const info = extensionInfo("Bold", ["toggleBold"], "mark");
      const descriptor = custom.build("toggleBold", info);

      it("uses the custom prefix in moduleId", () => {
        expect(descriptor.moduleId).toBe("myapp.format.toggleBold");
      });
    });

    // ── Description generation ───────────────────────────────────────

    describe("description generation", () => {
      it("query commands use 'Query' verb", () => {
        const info = extensionInfo("Core", ["getHTML"], "extension");
        const d = builder.build("getHTML", info);
        expect(d.description).toMatch(/^Query /);
      });

      it("format commands use 'Apply' verb", () => {
        const info = extensionInfo("Bold", ["toggleBold"], "mark");
        const d = builder.build("toggleBold", info);
        expect(d.description).toMatch(/^Apply /);
      });

      it("content commands use 'Modify content via' verb", () => {
        const info = extensionInfo("Core", ["insertContent"], "extension");
        const d = builder.build("insertContent", info);
        expect(d.description).toMatch(/^Modify content via /);
      });

      it("destructive commands use 'Destructively perform' verb", () => {
        const info = extensionInfo("Core", ["clearContent"], "extension");
        const d = builder.build("clearContent", info);
        expect(d.description).toMatch(/^Destructively perform /);
      });

      it("selection commands use 'Adjust selection via' verb", () => {
        const info = extensionInfo("Core", ["selectAll"], "extension");
        const d = builder.build("selectAll", info);
        expect(d.description).toMatch(/^Adjust selection via /);
      });

      it("history commands use 'Perform history action' verb", () => {
        const info = extensionInfo("History", ["undo"], "extension");
        const d = builder.build("undo", info);
        expect(d.description).toMatch(/^Perform history action /);
      });

      it("unknown commands use 'Execute' verb", () => {
        const info = extensionInfo("Custom", ["customCmd"], "extension");
        const d = builder.build("customCmd", info);
        expect(d.description).toMatch(/^Execute /);
      });

      it("description ends with '(from <Extension> extension)'", () => {
        const info = extensionInfo("Bold", ["toggleBold"], "mark");
        const d = builder.build("toggleBold", info);
        expect(d.description).toMatch(/\(from Bold extension\)$/);
      });
    });
  });

  // ================================================================
  // Multiple instances are independent
  // ================================================================

  it("multiple instances are independent", () => {
    const a = new ModuleBuilder();
    const b = new ModuleBuilder("other");
    expect(a.buildModuleId("toggleBold")).toBe("tiptap.format.toggleBold");
    expect(b.buildModuleId("toggleBold")).toBe("other.format.toggleBold");
  });
});
