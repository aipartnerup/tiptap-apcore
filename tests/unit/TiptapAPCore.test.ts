import { describe, it, expect, vi } from "vitest";
import { TiptapAPCore } from "../../src/runtime/TiptapAPCore.js";
import { EditorLike } from "../../src/types.js";

describe("TiptapAPCore Class", () => {
  const mockEditor: EditorLike = {
    isDestroyed: false,
    getHTML: () => "<p>Hello</p>",
    getJSON: () => ({ type: "doc", content: [] }),
    getText: () => "Hello",
    isActive: () => false,
    getAttributes: () => ({}),
    isEmpty: false,
    isEditable: true,
    isFocused: true,
    state: { doc: { content: { size: 10 }, descendants: vi.fn() } } as any,
    storage: {},
    commands: {
      toggleBold: vi.fn(() => true),
    },
    chain: vi.fn(() => ({
      focus: vi.fn().mockReturnThis(),
      run: vi.fn(() => true),
      toggleBold: vi.fn().mockReturnThis(),
    })),
    can: vi.fn(() => ({ chain: vi.fn() })) as any,
    extensionManager: {
      extensions: [
        {
          name: "starter-kit",
          type: "extension",
          addCommands: () => ({ toggleBold: () => {} }),
        },
      ],
    },
  };

  it("should initialize and scan extensions", () => {
    const apcore = new TiptapAPCore(mockEditor);
    expect(apcore.registry).toBeDefined();
    expect(apcore.executor).toBeDefined();
    expect(apcore.list()).toContain("tiptap.format.toggleBold");
  });

  it("should delegate call to executor", async () => {
    const apcore = new TiptapAPCore(mockEditor);
    const result = await apcore.call("tiptap.format.toggleBold", {});
    expect(result).toEqual({ success: true });
    expect(mockEditor.chain).toHaveBeenCalled();
  });

  it("should update ACL on the fly", async () => {
    const apcore = new TiptapAPCore(mockEditor, { acl: { role: "readonly" } });
    
    // Should fail in readonly
    await expect(apcore.call("tiptap.format.toggleBold", {})).rejects.toThrow(/Access denied/);

    // Update to editor role
    apcore.setAcl({ role: "editor" });
    
    // Should now pass
    const result = await apcore.call("tiptap.format.toggleBold", {});
    expect(result).toEqual({ success: true });
  });

  it("should refresh registry on demand", () => {
    const apcore = new TiptapAPCore(mockEditor);
    const count = apcore.refresh();
    expect(count).toBeGreaterThan(0);
  });

  it("should throw SCHEMA_VALIDATION_ERROR when setAcl receives an invalid role", () => {
    const apcore = new TiptapAPCore(mockEditor, { acl: { role: "editor" } });
    expect(() => apcore.setAcl({ role: "superuser" as any })).toThrow(/Invalid ACL role/);
  });

  it("should return null for getDefinition of non-existent module", () => {
    const apcore = new TiptapAPCore(mockEditor);
    expect(apcore.getDefinition("tiptap.nonexistent.module")).toBeNull();
  });
});
