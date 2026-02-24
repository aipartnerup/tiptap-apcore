/**
 * Integration tests for withApcore using REAL TipTap editor instances.
 *
 * These tests verify end-to-end behavior: extension scanning, module building,
 * registry population, executor routing, and ACL enforcement -- all wired
 * together through the withApcore() factory with a real TipTap Editor in jsdom.
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import { withApcore } from "../../src/withApcore.js";
import { TiptapModuleError } from "../../src/errors/index.js";

// ---------------------------------------------------------------------------
// Test helper
// ---------------------------------------------------------------------------

function createTestEditor(content: string = "<p>Test content</p>"): Editor {
  return new Editor({
    extensions: [StarterKit],
    content,
  });
}

// ---------------------------------------------------------------------------
// Integration test suite
// ---------------------------------------------------------------------------

describe("Integration: withApcore with real TipTap editor", () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createTestEditor();
  });

  afterEach(() => {
    editor.destroy();
  });

  // =========================================================================
  // Module discovery
  // =========================================================================

  describe("module discovery", () => {
    it("discovers StarterKit commands and registers >= 40 modules", () => {
      const { registry } = withApcore(editor as any, { includeUnsafe: true });
      const modules = registry.list();

      // StarterKit includes: Document, Paragraph, Text, Bold, Italic, Strike,
      // Code, Heading, BulletList, OrderedList, ListItem, Blockquote,
      // CodeBlock, HorizontalRule, HardBreak, History, Dropcursor, Gapcursor
      // plus 8 built-in query methods.
      expect(modules.length).toBeGreaterThanOrEqual(40);
    });

    it("module IDs follow the prefix.category.commandName pattern", () => {
      const { registry } = withApcore(editor as any, { includeUnsafe: true });
      const modules = registry.list();

      for (const id of modules) {
        const parts = id.split(".");
        expect(parts.length).toBe(3);
        expect(parts[0]).toBe("tiptap");
        // category is a known string
        expect(["query", "format", "content", "destructive", "selection", "history", "unknown"]).toContain(parts[1]);
        // command name is non-empty
        expect(parts[2].length).toBeGreaterThan(0);
      }
    });

    it("custom prefix is applied to all module IDs", () => {
      const { registry } = withApcore(editor as any, { prefix: "myeditor", includeUnsafe: true });
      const modules = registry.list();

      expect(modules.length).toBeGreaterThan(0);
      for (const id of modules) {
        expect(id.startsWith("myeditor.")).toBe(true);
      }
    });

    it("includes expected categories from StarterKit", () => {
      const { registry } = withApcore(editor as any, { includeUnsafe: true });
      const modules = registry.list();

      const categories = new Set(modules.map((id) => id.split(".")[1]));
      expect(categories.has("query")).toBe(true);
      expect(categories.has("format")).toBe(true);
      expect(categories.has("content")).toBe(true);
      expect(categories.has("destructive")).toBe(true);
      expect(categories.has("history")).toBe(true);
      expect(categories.has("selection")).toBe(true);
    });

    it("each module has a valid ModuleDescriptor", () => {
      const { registry } = withApcore(editor as any, { includeUnsafe: true });
      const modules = registry.list();

      for (const id of modules) {
        const descriptor = registry.getDefinition(id);
        expect(descriptor).not.toBeNull();
        expect(descriptor!.moduleId).toBe(id);
        expect(typeof descriptor!.description).toBe("string");
        expect(descriptor!.description.length).toBeGreaterThan(0);
        expect(descriptor!.inputSchema).toBeDefined();
        expect(descriptor!.outputSchema).toBeDefined();
        expect(descriptor!.annotations).toBeDefined();
        expect(Array.isArray(descriptor!.tags)).toBe(true);
      }
    });

    it("discovers well-known StarterKit modules by ID", () => {
      const { registry } = withApcore(editor as any, { includeUnsafe: true });
      const modules = registry.list();

      // Commands that should exist from StarterKit extensions
      const expectedModules = [
        "tiptap.query.getHTML",
        "tiptap.query.getJSON",
        "tiptap.query.getText",
        "tiptap.query.isEmpty",
        "tiptap.query.isEditable",
        "tiptap.format.toggleBold",
        "tiptap.format.toggleItalic",
        "tiptap.format.toggleStrike",
        "tiptap.format.toggleCode",
        "tiptap.format.toggleHeading",
        "tiptap.format.toggleBulletList",
        "tiptap.format.toggleOrderedList",
        "tiptap.format.toggleBlockquote",
        "tiptap.format.toggleCodeBlock",
        "tiptap.format.setHorizontalRule",
        "tiptap.format.setHardBreak",
        "tiptap.content.insertContent",
        "tiptap.destructive.clearContent",
        "tiptap.destructive.setContent",
        "tiptap.history.undo",
        "tiptap.history.redo",
        "tiptap.selection.selectAll",
        "tiptap.selection.focus",
      ];

      for (const expected of expectedModules) {
        expect(modules).toContain(expected);
      }
    });

    it("registry.discover() re-scans and returns module count", async () => {
      const { registry } = withApcore(editor as any, { includeUnsafe: true });
      const count = await registry.discover!();
      expect(count).toBeGreaterThanOrEqual(40);
      // Re-discover should return same count for same editor
      const count2 = await registry.discover!();
      expect(count2).toBe(count);
    });

    it("includeUnsafe: false filters out unknown-tagged modules", () => {
      const { registry: safeRegistry } = withApcore(editor as any, { includeUnsafe: false });
      const { registry: fullRegistry } = withApcore(editor as any, { includeUnsafe: true });

      const safeModules = safeRegistry.list();
      const fullModules = fullRegistry.list();

      // Safe should have <= full set
      expect(safeModules.length).toBeLessThanOrEqual(fullModules.length);

      // No safe module should have the "unknown" tag
      for (const id of safeModules) {
        const descriptor = safeRegistry.getDefinition(id);
        expect(descriptor!.tags).not.toContain("unknown");
      }
    });

    it("includeUnsafe defaults to false (unknown commands excluded)", () => {
      const { registry: defaultRegistry } = withApcore(editor as any);
      const { registry: fullRegistry } = withApcore(editor as any, { includeUnsafe: true });

      const defaultModules = defaultRegistry.list();
      const fullModules = fullRegistry.list();

      // Default should not include unknown-tagged modules
      for (const id of defaultModules) {
        const descriptor = defaultRegistry.getDefinition(id);
        expect(descriptor!.tags).not.toContain("unknown");
      }

      // Full set may be larger
      expect(fullModules.length).toBeGreaterThanOrEqual(defaultModules.length);
    });

    it("registry.list() supports filtering by tags", () => {
      const { registry } = withApcore(editor as any, { includeUnsafe: true });

      const queryModules = registry.list({ tags: ["query"] });
      const formatModules = registry.list({ tags: ["format"] });
      const destructiveModules = registry.list({ tags: ["destructive"] });

      expect(queryModules.length).toBeGreaterThan(0);
      expect(formatModules.length).toBeGreaterThan(0);
      expect(destructiveModules.length).toBeGreaterThan(0);

      // All query modules should start with tiptap.query
      for (const id of queryModules) {
        expect(id).toMatch(/^tiptap\.query\./);
      }
    });

    it("registry.list() supports filtering by prefix", () => {
      const { registry } = withApcore(editor as any, { includeUnsafe: true });

      const formatModules = registry.list({ prefix: "tiptap.format" });
      expect(formatModules.length).toBeGreaterThan(0);

      for (const id of formatModules) {
        expect(id.startsWith("tiptap.format")).toBe(true);
      }
    });
  });

  // =========================================================================
  // Query modules
  // =========================================================================

  describe("query modules", () => {
    it("getHTML returns editor HTML content", async () => {
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.getHTML", {});
      expect(result).toHaveProperty("html");
      expect(result.html).toBe("<p>Test content</p>");
    });

    it("getHTML reflects initial content variations", async () => {
      editor.destroy();
      editor = createTestEditor("<p>Hello <strong>world</strong></p>");
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.getHTML", {});
      expect(result.html).toBe("<p>Hello <strong>world</strong></p>");
    });

    it("getJSON returns editor JSON content", async () => {
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.getJSON", {});
      expect(result).toHaveProperty("json");
      expect(result.json).toHaveProperty("type", "doc");
      expect(result.json).toHaveProperty("content");
    });

    it("getText returns plain text content", async () => {
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.getText", {});
      expect(result).toHaveProperty("text");
      expect(typeof result.text).toBe("string");
      expect((result.text as string)).toContain("Test content");
    });

    it("getText accepts blockSeparator option", async () => {
      editor.destroy();
      editor = createTestEditor("<p>First</p><p>Second</p>");
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.getText", { blockSeparator: " | " });
      expect((result.text as string)).toContain("First");
      expect((result.text as string)).toContain("Second");
    });

    it("isEmpty returns false for non-empty editor", async () => {
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.isEmpty", {});
      expect(result).toHaveProperty("value");
      expect(result.value).toBe(false);
    });

    it("isEmpty returns true for empty editor", async () => {
      editor.destroy();
      editor = createTestEditor("");
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.isEmpty", {});
      expect(result.value).toBe(true);
    });

    it("isEditable returns boolean", async () => {
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.isEditable", {});
      expect(result).toHaveProperty("value");
      expect(typeof result.value).toBe("boolean");
    });

    it("isFocused returns boolean", async () => {
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.isFocused", {});
      expect(result).toHaveProperty("value");
      expect(typeof result.value).toBe("boolean");
    });

    it("isActive returns boolean for a node type", async () => {
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.isActive", { name: "paragraph" });
      expect(result).toHaveProperty("active");
      expect(typeof result.active).toBe("boolean");
    });

    it("getAttributes returns attributes object", async () => {
      const { executor } = withApcore(editor as any);
      const result = await executor.call("tiptap.query.getAttributes", { typeOrName: "paragraph" });
      expect(result).toHaveProperty("attributes");
      expect(typeof result.attributes).toBe("object");
    });

    it("callAsync works for query modules", async () => {
      const { executor } = withApcore(editor as any);
      const result = await executor.callAsync("tiptap.query.getHTML", {});
      expect(result).toHaveProperty("html");
      expect(result.html).toBe("<p>Test content</p>");
    });
  });

  // =========================================================================
  // Format modules
  // =========================================================================

  describe("format modules", () => {
    it("toggleBold applies bold formatting to selected text", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      // Select all text: "Test content"
      editor.commands.selectAll();

      // Apply bold
      const result = await executor.call("tiptap.format.toggleBold", {});
      expect(result).toEqual({ success: true });

      // Verify bold was applied
      const html = editor.getHTML();
      expect(html).toContain("<strong>");
      expect(html).toContain("Test content");
    });

    it("toggleBold can be toggled off", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      editor.commands.selectAll();

      // Toggle on
      await executor.call("tiptap.format.toggleBold", {});
      expect(editor.getHTML()).toContain("<strong>");

      // Toggle off (re-select since focus may shift)
      editor.commands.selectAll();
      await executor.call("tiptap.format.toggleBold", {});
      expect(editor.getHTML()).not.toContain("<strong>");
    });

    it("toggleItalic applies italic formatting", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.format.toggleItalic", {});
      expect(result).toEqual({ success: true });
      expect(editor.getHTML()).toContain("<em>");
    });

    it("toggleStrike applies strikethrough formatting", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.format.toggleStrike", {});
      expect(result).toEqual({ success: true });
      expect(editor.getHTML()).toContain("<s>");
    });

    it("toggleCode applies inline code formatting", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.format.toggleCode", {});
      expect(result).toEqual({ success: true });
      expect(editor.getHTML()).toContain("<code>");
    });

    it("toggleHeading converts paragraph to heading", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.format.toggleHeading", { level: 2 });
      expect(result).toEqual({ success: true });
      expect(editor.getHTML()).toContain("<h2>");
    });

    it("toggleHeading with different levels", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      for (const level of [1, 2, 3, 4, 5, 6]) {
        editor.commands.selectAll();
        // First reset to paragraph by toggling off current heading
        editor.commands.setParagraph();
        editor.commands.selectAll();
        await executor.call("tiptap.format.toggleHeading", { level });
        expect(editor.getHTML()).toContain(`<h${level}>`);
      }
    });

    it("toggleBulletList wraps content in bullet list", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.format.toggleBulletList", {});
      expect(result).toEqual({ success: true });

      const html = editor.getHTML();
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>");
    });

    it("toggleOrderedList wraps content in ordered list", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.format.toggleOrderedList", {});
      expect(result).toEqual({ success: true });

      const html = editor.getHTML();
      expect(html).toContain("<ol>");
      expect(html).toContain("<li>");
    });

    it("toggleBlockquote wraps content in blockquote", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.format.toggleBlockquote", {});
      expect(result).toEqual({ success: true });
      expect(editor.getHTML()).toContain("<blockquote>");
    });

    it("toggleCodeBlock converts to code block", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.format.toggleCodeBlock", {});
      expect(result).toEqual({ success: true });
      expect(editor.getHTML()).toContain("<pre>");
    });

    it("setHorizontalRule inserts a horizontal rule", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      const result = await executor.call("tiptap.format.setHorizontalRule", {});
      expect(result).toEqual({ success: true });
      expect(editor.getHTML()).toContain("<hr>");
    });

    it("setHardBreak inserts a hard break", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      const result = await executor.call("tiptap.format.setHardBreak", {});
      expect(result).toEqual({ success: true });
      // Hard break appears as <br> in HTML
      const html = editor.getHTML();
      expect(html).toMatch(/<br\s*\/?>/);
    });

    it("multiple formatting commands can be applied sequentially", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      // Apply bold
      editor.commands.selectAll();
      await executor.call("tiptap.format.toggleBold", {});

      // Apply italic on top
      editor.commands.selectAll();
      await executor.call("tiptap.format.toggleItalic", {});

      const html = editor.getHTML();
      expect(html).toContain("<strong>");
      expect(html).toContain("<em>");
    });
  });

  // =========================================================================
  // Content modules
  // =========================================================================

  describe("content modules", () => {
    it("insertContent adds HTML to the document", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      const result = await executor.call("tiptap.content.insertContent", {
        value: "<p>New paragraph</p>",
      });
      expect(result).toEqual({ success: true });

      const html = editor.getHTML();
      expect(html).toContain("New paragraph");
    });

    it("insertContent adds plain text", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      await executor.call("tiptap.content.insertContent", {
        value: "Added text",
      });

      const html = editor.getHTML();
      expect(html).toContain("Added text");
    });

    it("insertContent adds multiple paragraphs", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      await executor.call("tiptap.content.insertContent", {
        value: "<p>Para1</p><p>Para2</p>",
      });

      const html = editor.getHTML();
      expect(html).toContain("Para1");
      expect(html).toContain("Para2");
    });

    it("setNode changes the current node type", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.content.setNode", {
        typeOrName: "heading",
        attrs: { level: 3 },
      });
      expect(result).toEqual({ success: true });
      expect(editor.getHTML()).toContain("<h3>");
    });

    it("wrapIn wraps content in a blockquote", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      editor.commands.selectAll();

      const result = await executor.call("tiptap.content.wrapIn", {
        typeOrName: "blockquote",
      });
      expect(result).toEqual({ success: true });
      expect(editor.getHTML()).toContain("<blockquote>");
    });
  });

  // =========================================================================
  // Destructive modules
  // =========================================================================

  describe("destructive modules", () => {
    it("clearContent empties the editor", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      // Verify editor has content
      expect(editor.getHTML()).toContain("Test content");

      const result = await executor.call("tiptap.destructive.clearContent", {});
      expect(result).toEqual({ success: true });

      // After clearing, editor should contain just an empty paragraph
      const html = editor.getHTML();
      expect(html).not.toContain("Test content");
    });

    it("setContent replaces all content", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      const result = await executor.call("tiptap.destructive.setContent", {
        value: "<p>Replaced content</p>",
      });
      expect(result).toEqual({ success: true });

      const html = editor.getHTML();
      expect(html).toContain("Replaced content");
      expect(html).not.toContain("Test content");
    });

    it("setContent with complex HTML", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      await executor.call("tiptap.destructive.setContent", {
        value: "<h1>Title</h1><p>Body <strong>bold</strong></p>",
      });

      const html = editor.getHTML();
      expect(html).toContain("<h1>");
      expect(html).toContain("Title");
      expect(html).toContain("<strong>bold</strong>");
    });

    it("deleteSelection removes selected content", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      // Select all then delete
      editor.commands.selectAll();
      const result = await executor.call("tiptap.destructive.deleteSelection", {});
      expect(result).toEqual({ success: true });

      // Content should be gone (empty doc)
      expect(editor.getHTML()).not.toContain("Test content");
    });
  });

  // =========================================================================
  // History modules
  // =========================================================================

  describe("history modules", () => {
    it("undo reverts the last change", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      const originalHtml = editor.getHTML();

      // Make a change
      await executor.call("tiptap.content.insertContent", {
        value: "<p>Extra paragraph</p>",
      });
      expect(editor.getHTML()).toContain("Extra paragraph");

      // Undo
      const result = await executor.call("tiptap.history.undo", {});
      expect(result).toEqual({ success: true });

      // Content should revert
      expect(editor.getHTML()).toBe(originalHtml);
    });

    it("redo re-applies an undone change", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      // Make a change
      await executor.call("tiptap.content.insertContent", {
        value: "<p>Extra paragraph</p>",
      });
      const afterInsertHtml = editor.getHTML();

      // Undo
      await executor.call("tiptap.history.undo", {});
      expect(editor.getHTML()).not.toContain("Extra paragraph");

      // Redo
      const result = await executor.call("tiptap.history.redo", {});
      expect(result).toEqual({ success: true });

      expect(editor.getHTML()).toBe(afterInsertHtml);
    });

    it("multiple undo operations revert grouped changes", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      const originalHtml = editor.getHTML();

      // Change 1
      await executor.call("tiptap.content.insertContent", {
        value: "<p>Change 1</p>",
      });

      // Change 2 (grouped with change 1 by TipTap history)
      await executor.call("tiptap.content.insertContent", {
        value: "<p>Change 2</p>",
      });
      expect(editor.getHTML()).toContain("Change 1");
      expect(editor.getHTML()).toContain("Change 2");

      // Single undo reverts all grouped changes back to original
      await executor.call("tiptap.history.undo", {});
      expect(editor.getHTML()).toBe(originalHtml);
    });
  });

  // =========================================================================
  // Selection modules
  // =========================================================================

  describe("selection modules", () => {
    it("selectAll selects all content", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      const result = await executor.call("tiptap.selection.selectAll", {});
      expect(result).toEqual({ success: true });
    });

    it("focus positions the cursor", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      const result = await executor.call("tiptap.selection.focus", { position: "start" });
      expect(result).toEqual({ success: true });
    });

    it("setTextSelection sets a text selection position", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      // Set cursor to position 1 (start of content)
      const result = await executor.call("tiptap.selection.setTextSelection", { position: 1 });
      expect(result).toEqual({ success: true });
    });

    it("setTextSelection with range object", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      // Select a range within the content
      const result = await executor.call("tiptap.selection.setTextSelection", {
        position: { from: 1, to: 5 },
      });
      expect(result).toEqual({ success: true });
    });

    it("selectTextblockStart selects to start of text block", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      const result = await executor.call("tiptap.selection.selectTextblockStart", {});
      expect(result).toEqual({ success: true });
    });

    it("selectTextblockEnd selects to end of text block", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      const result = await executor.call("tiptap.selection.selectTextblockEnd", {});
      expect(result).toEqual({ success: true });
    });
  });

  // =========================================================================
  // ACL enforcement
  // =========================================================================

  describe("ACL enforcement", () => {
    describe("readonly role", () => {
      it("allows query modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });

        const result = await executor.call("tiptap.query.getHTML", {});
        expect(result).toHaveProperty("html");
      });

      it("blocks format modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });
        editor.commands.selectAll();

        await expect(
          executor.call("tiptap.format.toggleBold", {}),
        ).rejects.toThrow(TiptapModuleError);

        try {
          await executor.call("tiptap.format.toggleBold", {});
        } catch (e) {
          expect((e as TiptapModuleError).code).toBe("ACL_DENIED");
        }
      });

      it("blocks content modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });

        await expect(
          executor.call("tiptap.content.insertContent", { value: "<p>New</p>" }),
        ).rejects.toThrow(TiptapModuleError);
      });

      it("blocks destructive modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });

        await expect(
          executor.call("tiptap.destructive.clearContent", {}),
        ).rejects.toThrow(TiptapModuleError);
      });

      it("blocks history modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });

        await expect(
          executor.call("tiptap.history.undo", {}),
        ).rejects.toThrow(TiptapModuleError);
      });

      it("blocks selection modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });

        await expect(
          executor.call("tiptap.selection.selectAll", {}),
        ).rejects.toThrow(TiptapModuleError);
      });
    });

    describe("editor role", () => {
      it("allows query modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "editor" }, includeUnsafe: true });
        const result = await executor.call("tiptap.query.getHTML", {});
        expect(result).toHaveProperty("html");
      });

      it("allows format modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "editor" }, includeUnsafe: true });
        editor.commands.selectAll();

        const result = await executor.call("tiptap.format.toggleBold", {});
        expect(result).toEqual({ success: true });
      });

      it("allows content modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "editor" }, includeUnsafe: true });

        const result = await executor.call("tiptap.content.insertContent", {
          value: "<p>New</p>",
        });
        expect(result).toEqual({ success: true });
      });

      it("allows history modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "editor" }, includeUnsafe: true });

        // Make a change first so undo has something to revert
        await executor.call("tiptap.content.insertContent", { value: "change" });
        const result = await executor.call("tiptap.history.undo", {});
        expect(result).toEqual({ success: true });
      });

      it("allows selection modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "editor" }, includeUnsafe: true });

        const result = await executor.call("tiptap.selection.selectAll", {});
        expect(result).toEqual({ success: true });
      });

      it("blocks destructive modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "editor" }, includeUnsafe: true });

        await expect(
          executor.call("tiptap.destructive.clearContent", {}),
        ).rejects.toThrow(TiptapModuleError);

        try {
          await executor.call("tiptap.destructive.clearContent", {});
        } catch (e) {
          expect((e as TiptapModuleError).code).toBe("ACL_DENIED");
        }
      });

      it("blocks setContent (destructive)", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "editor" }, includeUnsafe: true });

        await expect(
          executor.call("tiptap.destructive.setContent", {
            value: "<p>Replace</p>",
          }),
        ).rejects.toThrow(TiptapModuleError);
      });
    });

    describe("admin role", () => {
      it("allows query modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "admin" }, includeUnsafe: true });
        const result = await executor.call("tiptap.query.getHTML", {});
        expect(result).toHaveProperty("html");
      });

      it("allows format modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "admin" }, includeUnsafe: true });
        editor.commands.selectAll();

        const result = await executor.call("tiptap.format.toggleBold", {});
        expect(result).toEqual({ success: true });
      });

      it("allows content modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "admin" }, includeUnsafe: true });

        const result = await executor.call("tiptap.content.insertContent", {
          value: "<p>New</p>",
        });
        expect(result).toEqual({ success: true });
      });

      it("allows destructive modules (clearContent)", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "admin" }, includeUnsafe: true });

        const result = await executor.call("tiptap.destructive.clearContent", {});
        expect(result).toEqual({ success: true });
      });

      it("allows destructive modules (setContent)", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "admin" }, includeUnsafe: true });

        const result = await executor.call("tiptap.destructive.setContent", {
          value: "<p>Admin content</p>",
        });
        expect(result).toEqual({ success: true });
        expect(editor.getHTML()).toContain("Admin content");
      });

      it("allows history modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "admin" }, includeUnsafe: true });

        await executor.call("tiptap.content.insertContent", { value: "change" });
        const result = await executor.call("tiptap.history.undo", {});
        expect(result).toEqual({ success: true });
      });

      it("allows selection modules", async () => {
        const { executor } = withApcore(editor as any, { acl: { role: "admin" }, includeUnsafe: true });

        const result = await executor.call("tiptap.selection.selectAll", {});
        expect(result).toEqual({ success: true });
      });
    });

    describe("no ACL (default, permissive)", () => {
      it("allows all modules when no ACL is configured", async () => {
        const { executor } = withApcore(editor as any, { includeUnsafe: true });

        // Query
        expect(await executor.call("tiptap.query.getHTML", {})).toHaveProperty("html");

        // Format
        editor.commands.selectAll();
        expect(await executor.call("tiptap.format.toggleBold", {})).toEqual({ success: true });

        // Content
        expect(
          await executor.call("tiptap.content.insertContent", { value: "new" }),
        ).toEqual({ success: true });

        // Destructive
        expect(await executor.call("tiptap.destructive.clearContent", {})).toEqual({
          success: true,
        });

        // History -- undo the clear
        expect(await executor.call("tiptap.history.undo", {})).toEqual({
          success: true,
        });

        // Selection
        expect(await executor.call("tiptap.selection.selectAll", {})).toEqual({
          success: true,
        });
      });
    });

    describe("custom ACL with allowTags / denyTags", () => {
      it("allowTags with role restricts to specified tags", async () => {
        const { executor } = withApcore(editor as any, {
          acl: { role: "readonly", allowTags: ["format"] },
          includeUnsafe: true,
        });

        // Query: allowed by role
        expect(await executor.call("tiptap.query.getHTML", {})).toHaveProperty("html");

        // Format: allowed by allowTags override
        editor.commands.selectAll();
        expect(await executor.call("tiptap.format.toggleBold", {})).toEqual({ success: true });

        // Destructive: denied (not in role and not in allowTags)
        await expect(
          executor.call("tiptap.destructive.clearContent", {}),
        ).rejects.toThrow(TiptapModuleError);
      });

      it("denyTags blocks specified tags", async () => {
        const { executor } = withApcore(editor as any, {
          acl: { role: "admin", denyTags: ["destructive"] },
          includeUnsafe: true,
        });

        // Query still works
        expect(await executor.call("tiptap.query.getHTML", {})).toHaveProperty("html");

        // Destructive is denied even for admin
        await expect(
          executor.call("tiptap.destructive.clearContent", {}),
        ).rejects.toThrow(TiptapModuleError);
      });
    });

    describe("custom ACL with allowModules / denyModules", () => {
      it("allowModules grants access to specific modules", async () => {
        const { executor } = withApcore(editor as any, {
          acl: {
            allowModules: ["tiptap.query.getHTML", "tiptap.destructive.clearContent"],
          },
          includeUnsafe: true,
        });

        // Allowed module
        expect(await executor.call("tiptap.query.getHTML", {})).toHaveProperty("html");

        // Also allowed
        expect(await executor.call("tiptap.destructive.clearContent", {})).toEqual({
          success: true,
        });
      });

      it("denyModules blocks specific modules", async () => {
        const { executor } = withApcore(editor as any, {
          acl: {
            role: "admin",
            denyModules: ["tiptap.destructive.clearContent"],
          },
          includeUnsafe: true,
        });

        // Other admin modules still work
        expect(await executor.call("tiptap.query.getHTML", {})).toHaveProperty("html");

        // Specifically denied module
        await expect(
          executor.call("tiptap.destructive.clearContent", {}),
        ).rejects.toThrow(TiptapModuleError);
      });
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe("error handling", () => {
    it("throws MODULE_NOT_FOUND for non-existent module", async () => {
      const { executor } = withApcore(editor as any);

      await expect(
        executor.call("tiptap.query.nonExistent", {}),
      ).rejects.toThrow(TiptapModuleError);

      try {
        await executor.call("tiptap.query.nonExistent", {});
      } catch (e) {
        const err = e as TiptapModuleError;
        expect(err.code).toBe("MODULE_NOT_FOUND");
        expect(err.details).toHaveProperty("moduleId", "tiptap.query.nonExistent");
      }
    });

    it("throws TypeError for null editor", () => {
      expect(() => {
        withApcore(null as unknown as Editor);
      }).toThrow(TypeError);
    });

    it("throws TypeError for undefined editor", () => {
      expect(() => {
        withApcore(undefined as unknown as Editor);
      }).toThrow(TypeError);
    });

    it("throws EDITOR_NOT_READY for destroyed editor", () => {
      const destroyedEditor = createTestEditor();
      destroyedEditor.destroy();

      expect(() => {
        withApcore(destroyedEditor as any);
      }).toThrow(TiptapModuleError);

      try {
        withApcore(destroyedEditor as any);
      } catch (e) {
        expect((e as TiptapModuleError).code).toBe("EDITOR_NOT_READY");
      }
    });

    it("throws SCHEMA_VALIDATION_ERROR for invalid prefix", () => {
      expect(() => {
        withApcore(editor as any, { prefix: "Invalid-Prefix!" });
      }).toThrow(TiptapModuleError);

      try {
        withApcore(editor as any, { prefix: "Invalid-Prefix!" });
      } catch (e) {
        expect((e as TiptapModuleError).code).toBe("SCHEMA_VALIDATION_ERROR");
      }
    });

    it("throws SCHEMA_VALIDATION_ERROR for invalid ACL role", () => {
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withApcore(editor as any, { acl: { role: "superuser" as any } });
      }).toThrow(TiptapModuleError);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withApcore(editor as any, { acl: { role: "superuser" as any } });
      } catch (e) {
        expect((e as TiptapModuleError).code).toBe("SCHEMA_VALIDATION_ERROR");
      }
    });

    it("ACL_DENIED error has stripped details (only moduleId)", async () => {
      const { executor } = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });

      try {
        await executor.call("tiptap.format.toggleBold", {});
        // Should not reach here
        expect.unreachable("Expected ACL_DENIED error");
      } catch (e) {
        const err = e as TiptapModuleError;
        expect(err.code).toBe("ACL_DENIED");
        expect(err.message).toContain("tiptap.format.toggleBold");
        // H-7: details should only have moduleId — no role, tags, or reason
        expect(err.details).toHaveProperty("moduleId", "tiptap.format.toggleBold");
        expect(err.details).not.toHaveProperty("role");
        expect(err.details).not.toHaveProperty("tags");
        expect(err.details).not.toHaveProperty("reason");
      }
    });

    it("EDITOR_NOT_READY when calling on destroyed editor", async () => {
      const { executor } = withApcore(editor as any);
      editor.destroy();

      await expect(
        executor.call("tiptap.query.getHTML", {}),
      ).rejects.toThrow(TiptapModuleError);

      // Recreate the editor for the afterEach cleanup
      editor = createTestEditor();
    });

    it("callAsync rejects for ACL violations", async () => {
      const { executor } = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });

      await expect(
        executor.callAsync("tiptap.format.toggleBold", {}),
      ).rejects.toThrow(TiptapModuleError);
    });
  });

  // =========================================================================
  // End-to-end workflows
  // =========================================================================

  describe("end-to-end workflows", () => {
    it("full editing workflow: insert, format, query, undo", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      // 1. Check initial content
      const initial = await executor.call("tiptap.query.getHTML", {});
      expect(initial.html).toBe("<p>Test content</p>");

      // 2. Insert new content
      await executor.call("tiptap.content.insertContent", {
        value: "<p>Added paragraph</p>",
      });
      expect(editor.getHTML()).toContain("Added paragraph");

      // 3. Select all and bold
      editor.commands.selectAll();
      await executor.call("tiptap.format.toggleBold", {});
      expect(editor.getHTML()).toContain("<strong>");

      // 4. Query updated content
      const updated = await executor.call("tiptap.query.getHTML", {});
      expect(updated.html).toContain("<strong>");

      // 5. Undo bold
      await executor.call("tiptap.history.undo", {});
      expect(editor.getHTML()).not.toContain("<strong>");
    });

    it("destructive workflow: set content, clear, then undo reverts", async () => {
      const { executor } = withApcore(editor as any, { includeUnsafe: true });
      const originalHtml = editor.getHTML();

      // Replace content
      await executor.call("tiptap.destructive.setContent", {
        value: "<h1>New doc</h1><p>Body text</p>",
      });
      expect(editor.getHTML()).toContain("<h1>New doc</h1>");

      // Clear content
      await executor.call("tiptap.destructive.clearContent", {});
      expect(editor.getHTML()).not.toContain("New doc");

      // Undo: TipTap groups rapid changes, so undo may revert
      // all the way back to original content. Verify undo works
      // and produces a state different from the cleared state.
      const clearedHtml = editor.getHTML();
      await executor.call("tiptap.history.undo", {});
      const afterUndo = editor.getHTML();

      // After undo, the editor should have content again (not be cleared)
      // It may restore to the setContent state or original, depending on grouping
      expect(afterUndo !== clearedHtml || afterUndo === originalHtml).toBe(true);
    });

    it("registry and executor reference each other correctly", () => {
      const { registry, executor } = withApcore(editor as any);

      // Executor's registry should be the same instance
      expect(executor.registry).toBe(registry);
    });

    it("multiple withApcore instances on same editor are independent", async () => {
      const result1 = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });
      const result2 = withApcore(editor as any, { acl: { role: "admin" }, includeUnsafe: true });

      // readonly can query
      expect(await result1.executor.call("tiptap.query.getHTML", {})).toHaveProperty("html");

      // readonly cannot format
      await expect(
        result1.executor.call("tiptap.format.toggleBold", {}),
      ).rejects.toThrow(TiptapModuleError);

      // admin CAN format
      editor.commands.selectAll();
      expect(await result2.executor.call("tiptap.format.toggleBold", {})).toEqual({
        success: true,
      });
    });

    it("works with multi-paragraph content", async () => {
      editor.destroy();
      editor = createTestEditor(
        "<h1>Title</h1><p>Paragraph one</p><p>Paragraph two</p><ul><li>Item 1</li><li>Item 2</li></ul>",
      );

      const { executor } = withApcore(editor as any, { includeUnsafe: true });

      // Query
      const result = await executor.call("tiptap.query.getHTML", {});
      expect(result.html).toContain("<h1>Title</h1>");
      expect(result.html).toContain("Paragraph one");
      expect(result.html).toContain("<li>");

      // JSON
      const json = await executor.call("tiptap.query.getJSON", {});
      expect(json.json).toHaveProperty("content");

      // Text
      const text = await executor.call("tiptap.query.getText", {});
      expect(text.text).toContain("Title");
      expect(text.text).toContain("Item 1");
    });

    it("annotations are set correctly on discovered modules", () => {
      const { registry } = withApcore(editor as any, { includeUnsafe: true });

      // Query modules should be readonly
      const getHtmlDef = registry.getDefinition("tiptap.query.getHTML");
      expect(getHtmlDef!.annotations!.readonly).toBe(true);
      expect(getHtmlDef!.annotations!.destructive).toBe(false);

      // Format modules should not be readonly or destructive
      const toggleBoldDef = registry.getDefinition("tiptap.format.toggleBold");
      expect(toggleBoldDef!.annotations!.readonly).toBe(false);
      expect(toggleBoldDef!.annotations!.destructive).toBe(false);

      // Destructive modules should be marked destructive and requiresApproval
      const clearContentDef = registry.getDefinition("tiptap.destructive.clearContent");
      expect(clearContentDef!.annotations!.destructive).toBe(true);
      expect(clearContentDef!.annotations!.requiresApproval).toBe(true);

      // History modules: not readonly, not destructive
      const undoDef = registry.getDefinition("tiptap.history.undo");
      expect(undoDef!.annotations!.readonly).toBe(false);
      expect(undoDef!.annotations!.destructive).toBe(false);
    });
  });
});
