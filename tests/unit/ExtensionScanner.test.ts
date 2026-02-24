import { describe, it, expect, vi } from "vitest";
import { ExtensionScanner } from "../../src/discovery/ExtensionScanner.js";
import type { Logger } from "../../src/types.js";

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function createMockEditor(extensions: any[] = []): any {
  return {
    extensionManager: { extensions },
    commands: {},
  };
}

function createMockExtension(
  name: string,
  type: string,
  commands: Record<string, unknown> = {},
): any {
  return {
    name,
    type,
    addCommands: () => commands,
  };
}

const EXPECTED_BUILTIN_COMMANDS = [
  "getHTML", "getJSON", "getText", "isActive", "getAttributes",
  "isEmpty", "isEditable", "isFocused",
  "selectText",
];

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe("ExtensionScanner", () => {
  const scanner = new ExtensionScanner();

  // ----------------------------------------------------------------
  // Empty editor
  // ----------------------------------------------------------------

  describe("empty editor (no extensions)", () => {
    it("should return only the __builtin__ entry", () => {
      const editor = createMockEditor();
      const result = scanner.scan(editor);

      expect(result.size).toBe(1);
      expect(result.has("__builtin__")).toBe(true);
    });

    it("__builtin__ entry should contain all query methods", () => {
      const editor = createMockEditor();
      const result = scanner.scan(editor);
      const builtin = result.get("__builtin__")!;

      expect(builtin.commandNames).toEqual(EXPECTED_BUILTIN_COMMANDS);
    });
  });

  // ----------------------------------------------------------------
  // Extension with addCommands
  // ----------------------------------------------------------------

  describe("extension with addCommands", () => {
    it("should discover command names from addCommands()", () => {
      const ext = createMockExtension("bold", "mark", {
        toggleBold: () => {},
        setBold: () => {},
        unsetBold: () => {},
      });
      const editor = createMockEditor([ext]);
      const result = scanner.scan(editor);

      expect(result.has("bold")).toBe(true);
      const info = result.get("bold")!;
      expect(info.extensionName).toBe("bold");
      expect(info.commandNames).toEqual(["toggleBold", "setBold", "unsetBold"]);
    });

    it("should preserve the extension type", () => {
      const ext = createMockExtension("bold", "mark", { toggleBold: () => {} });
      const editor = createMockEditor([ext]);
      const result = scanner.scan(editor);

      expect(result.get("bold")!.extensionType).toBe("mark");
    });
  });

  // ----------------------------------------------------------------
  // Extension without addCommands
  // ----------------------------------------------------------------

  describe("extension without addCommands", () => {
    it("should be skipped without error", () => {
      const ext = { name: "placeholder", type: "extension" };
      const editor = createMockEditor([ext]);
      const result = scanner.scan(editor);

      expect(result.has("placeholder")).toBe(false);
      // Only __builtin__ should be present
      expect(result.size).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  // Extension where addCommands throws
  // ----------------------------------------------------------------

  describe("extension where addCommands throws", () => {
    it("should be skipped without error", () => {
      const ext = {
        name: "broken",
        type: "extension",
        addCommands: () => {
          throw new Error("broken extension");
        },
      };
      const editor = createMockEditor([ext]);

      expect(() => scanner.scan(editor)).not.toThrow();
      const result = scanner.scan(editor);

      expect(result.has("broken")).toBe(false);
      expect(result.size).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  // Extension with addCommands returning empty object
  // ----------------------------------------------------------------

  describe("extension with empty commands", () => {
    it("should be skipped when addCommands returns empty object", () => {
      const ext = createMockExtension("empty", "extension", {});
      const editor = createMockEditor([ext]);
      const result = scanner.scan(editor);

      expect(result.has("empty")).toBe(false);
      expect(result.size).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  // Multiple extensions
  // ----------------------------------------------------------------

  describe("multiple extensions", () => {
    it("should discover commands from all extensions", () => {
      const bold = createMockExtension("bold", "mark", {
        toggleBold: () => {},
        setBold: () => {},
      });
      const italic = createMockExtension("italic", "mark", {
        toggleItalic: () => {},
      });
      const history = createMockExtension("history", "extension", {
        undo: () => {},
        redo: () => {},
      });
      const editor = createMockEditor([bold, italic, history]);
      const result = scanner.scan(editor);

      // 3 extensions + __builtin__
      expect(result.size).toBe(4);
      expect(result.has("bold")).toBe(true);
      expect(result.has("italic")).toBe(true);
      expect(result.has("history")).toBe(true);
      expect(result.has("__builtin__")).toBe(true);

      expect(result.get("bold")!.commandNames).toEqual(["toggleBold", "setBold"]);
      expect(result.get("italic")!.commandNames).toEqual(["toggleItalic"]);
      expect(result.get("history")!.commandNames).toEqual(["undo", "redo"]);
    });
  });

  // ----------------------------------------------------------------
  // Extension type preservation
  // ----------------------------------------------------------------

  describe("extension type preservation", () => {
    it.each([
      ["paragraph", "node"],
      ["bold", "mark"],
      ["history", "extension"],
    ] as const)("extension '%s' preserves type '%s'", (name, type) => {
      const ext = createMockExtension(name, type, { someCommand: () => {} });
      const editor = createMockEditor([ext]);
      const result = scanner.scan(editor);

      expect(result.get(name)!.extensionType).toBe(type);
    });
  });

  // ----------------------------------------------------------------
  // __builtin__ always present
  // ----------------------------------------------------------------

  describe("__builtin__ entry", () => {
    it("is always present even with extensions", () => {
      const ext = createMockExtension("bold", "mark", { toggleBold: () => {} });
      const editor = createMockEditor([ext]);
      const result = scanner.scan(editor);

      expect(result.has("__builtin__")).toBe(true);
    });

    it("has extensionType 'extension'", () => {
      const editor = createMockEditor();
      const result = scanner.scan(editor);

      expect(result.get("__builtin__")!.extensionType).toBe("extension");
    });

    it("has extensionName '__builtin__'", () => {
      const editor = createMockEditor();
      const result = scanner.scan(editor);

      expect(result.get("__builtin__")!.extensionName).toBe("__builtin__");
    });

    it("contains exactly 9 built-in methods", () => {
      const editor = createMockEditor();
      const result = scanner.scan(editor);
      const builtin = result.get("__builtin__")!;

      expect(builtin.commandNames).toHaveLength(9);
      expect(builtin.commandNames).toEqual(EXPECTED_BUILTIN_COMMANDS);
    });
  });

  // ----------------------------------------------------------------
  // Mixed scenario: some valid, some broken, some without addCommands
  // ----------------------------------------------------------------

  describe("mixed scenario", () => {
    it("handles a mix of valid, broken, and command-less extensions", () => {
      const valid = createMockExtension("bold", "mark", { toggleBold: () => {} });
      const noCommands = { name: "dropcursor", type: "extension" };
      const broken = {
        name: "broken",
        type: "node",
        addCommands: () => { throw new Error("oops"); },
      };
      const alsoValid = createMockExtension("italic", "mark", { toggleItalic: () => {} });

      const editor = createMockEditor([valid, noCommands, broken, alsoValid]);
      const result = scanner.scan(editor);

      // valid + alsoValid + __builtin__
      expect(result.size).toBe(3);
      expect(result.has("bold")).toBe(true);
      expect(result.has("italic")).toBe(true);
      expect(result.has("dropcursor")).toBe(false);
      expect(result.has("broken")).toBe(false);
      expect(result.has("__builtin__")).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // Extension with falsy type defaults to "extension"
  // ----------------------------------------------------------------

  describe("extension with missing type", () => {
    it("should default extensionType when type is undefined", () => {
      const ext = {
        name: "custom",
        type: undefined as any,
        addCommands: () => ({ doThing: () => {} }),
      };
      const editor = createMockEditor([ext]);
      const result = scanner.scan(editor);

      expect(result.has("custom")).toBe(true);
      expect(result.get("custom")!.extensionType).toBe("extension");
    });
  });

  // ----------------------------------------------------------------
  // addCommands returns non-object
  // ----------------------------------------------------------------

  describe("addCommands returns non-object", () => {
    it("should be skipped when addCommands returns null", () => {
      const ext = {
        name: "weird",
        type: "extension",
        addCommands: () => null as any,
      };
      const editor = createMockEditor([ext]);
      const result = scanner.scan(editor);

      expect(result.has("weird")).toBe(false);
      expect(result.size).toBe(1);
    });

    it("should be skipped when addCommands returns undefined", () => {
      const ext = {
        name: "weird",
        type: "extension",
        addCommands: () => undefined as any,
      };
      const editor = createMockEditor([ext]);
      const result = scanner.scan(editor);

      expect(result.has("weird")).toBe(false);
      expect(result.size).toBe(1);
    });
  });

  // ----------------------------------------------------------------
  // Return value is a proper Map
  // ----------------------------------------------------------------

  describe("return type", () => {
    it("returns an instance of Map", () => {
      const editor = createMockEditor();
      const result = scanner.scan(editor);

      expect(result).toBeInstanceOf(Map);
    });
  });

  // ----------------------------------------------------------------
  // H-3: addCommands() receives correct `this` context
  // ----------------------------------------------------------------

  describe("H-3: addCommands receives correct this context", () => {
    it("should pass extension as this when calling addCommands", () => {
      let capturedThis: unknown = null;
      const ext = {
        name: "contextTest",
        type: "extension",
        addCommands() {
          capturedThis = this;
          return { testCmd: () => {} };
        },
      };
      const editor = createMockEditor([ext]);
      scanner.scan(editor);

      expect(capturedThis).toBe(ext);
    });

    it("should pass extension as this when calling config.addCommands", () => {
      let capturedThis: unknown = null;
      const ext = {
        name: "configTest",
        type: "extension",
        config: {
          addCommands() {
            capturedThis = this;
            return { testCmd: () => {} };
          },
        },
      };
      const editor = createMockEditor([ext]);
      scanner.scan(editor);

      expect(capturedThis).toBe(ext);
    });
  });

  // ----------------------------------------------------------------
  // H-12: Logger receives warnings on extension errors
  // ----------------------------------------------------------------

  describe("H-12: logger receives warnings on extension errors", () => {
    it("should call logger.warn when addCommands throws", () => {
      const logger: Logger = { warn: vi.fn(), error: vi.fn() };
      const loggedScanner = new ExtensionScanner(logger);
      const ext = {
        name: "broken",
        type: "extension",
        addCommands: () => {
          throw new Error("broken extension");
        },
      };
      const editor = createMockEditor([ext]);

      loggedScanner.scan(editor);

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        "Failed to scan extension 'broken'",
        expect.objectContaining({ error: "broken extension" }),
      );
    });

    it("should not call logger.warn for valid extensions", () => {
      const logger: Logger = { warn: vi.fn(), error: vi.fn() };
      const loggedScanner = new ExtensionScanner(logger);
      const ext = createMockExtension("bold", "mark", { toggleBold: () => {} });
      const editor = createMockEditor([ext]);

      loggedScanner.scan(editor);

      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("should still skip broken extensions gracefully without logger", () => {
      const noLogScanner = new ExtensionScanner();
      const ext = {
        name: "broken",
        type: "extension",
        addCommands: () => {
          throw new Error("broken extension");
        },
      };
      const editor = createMockEditor([ext]);

      expect(() => noLogScanner.scan(editor)).not.toThrow();
      const result = noLogScanner.scan(editor);
      expect(result.has("broken")).toBe(false);
    });
  });
});
