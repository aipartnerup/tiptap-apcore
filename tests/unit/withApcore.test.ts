import { describe, it, expect, vi } from "vitest";
import { withApcore } from "../../src/withApcore.js";
import { TiptapModuleError } from "../../src/errors/index.js";

// Mock editor factory
function createMockEditor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const mockChain: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "run") return () => true;
        if (prop === "focus") return () => mockChain;
        return () => mockChain;
      },
    },
  );

  return {
    isDestroyed: false,
    getHTML: () => "<p>Test</p>",
    getJSON: () => ({ type: "doc", content: [] }),
    getText: () => "Test",
    isActive: () => false,
    getAttributes: () => ({}),
    isEmpty: false,
    isEditable: true,
    isFocused: false,
    state: {
      doc: {
        content: { size: 100 },
        descendants: () => {},
      },
    },
    storage: {},
    commands: {},
    chain: () => mockChain,
    can: () => ({ chain: () => mockChain }),
    extensionManager: {
      extensions: [
        {
          name: "bold",
          type: "mark",
          addCommands: () => ({
            toggleBold: () => () => true,
          }),
        },
        {
          name: "heading",
          type: "node",
          addCommands: () => ({
            toggleHeading: () => () => true,
          }),
        },
        {
          name: "history",
          type: "extension",
          addCommands: () => ({
            undo: () => () => true,
            redo: () => () => true,
          }),
        },
      ],
    },
    ...overrides,
  };
}

describe("withApcore", () => {
  it("should return { registry, executor }", () => {
    const editor = createMockEditor();
    const result = withApcore(editor as any);
    expect(result).toHaveProperty("registry");
    expect(result).toHaveProperty("executor");
  });

  it("should discover commands from extensions (includeUnsafe: true)", () => {
    const editor = createMockEditor();
    const { registry } = withApcore(editor as any, { includeUnsafe: true });
    const modules = registry.list();
    // Should have: toggleBold, toggleHeading, undo, redo + 8 builtins
    expect(modules.length).toBeGreaterThanOrEqual(12);
  });

  it("should include builtin query modules", () => {
    const editor = createMockEditor();
    const { registry } = withApcore(editor as any, { includeUnsafe: true });
    const modules = registry.list();
    expect(modules).toContain("tiptap.query.getHTML");
    expect(modules).toContain("tiptap.query.getJSON");
    expect(modules).toContain("tiptap.query.getText");
  });

  it("should include extension commands (with includeUnsafe: true)", () => {
    const editor = createMockEditor();
    const { registry } = withApcore(editor as any, { includeUnsafe: true });
    const modules = registry.list();
    expect(modules).toContain("tiptap.format.toggleBold");
    expect(modules).toContain("tiptap.format.toggleHeading");
    expect(modules).toContain("tiptap.history.undo");
    expect(modules).toContain("tiptap.history.redo");
  });

  it("executor should call query commands", async () => {
    const editor = createMockEditor();
    const { executor } = withApcore(editor as any);
    const result = await executor.call("tiptap.query.getHTML", {});
    expect(result).toEqual({ html: "<p>Test</p>" });
  });

  it("executor should call format commands (with includeUnsafe: true)", async () => {
    const editor = createMockEditor();
    const { executor } = withApcore(editor as any, { includeUnsafe: true });
    const result = await executor.call("tiptap.format.toggleBold", {});
    expect(result).toEqual({ success: true });
  });

  it("should throw TypeError for null editor", () => {
    expect(() => withApcore(null as any)).toThrow(TypeError);
  });

  it("should throw TypeError for undefined editor", () => {
    expect(() => withApcore(undefined as any)).toThrow(TypeError);
  });

  it("should throw EDITOR_NOT_READY for destroyed editor", () => {
    const editor = createMockEditor({ isDestroyed: true });
    expect(() => withApcore(editor as any)).toThrow(TiptapModuleError);
    try {
      withApcore(editor as any);
    } catch (e) {
      expect((e as TiptapModuleError).code).toBe("EDITOR_NOT_READY");
    }
  });

  it("should throw SCHEMA_VALIDATION_ERROR for invalid prefix", () => {
    const editor = createMockEditor();
    expect(() => withApcore(editor as any, { prefix: "My-App" })).toThrow(
      TiptapModuleError,
    );
    try {
      withApcore(editor as any, { prefix: "123" });
    } catch (e) {
      expect((e as TiptapModuleError).code).toBe("SCHEMA_VALIDATION_ERROR");
    }
  });

  it("should use custom prefix", () => {
    const editor = createMockEditor();
    const { registry } = withApcore(editor as any, { prefix: "myapp", includeUnsafe: true });
    const modules = registry.list();
    expect(modules).toContain("myapp.query.getHTML");
    expect(modules).toContain("myapp.format.toggleBold");
  });

  it("should apply ACL restrictions via role", async () => {
    const editor = createMockEditor();
    const { executor } = withApcore(editor as any, { acl: { role: "readonly" }, includeUnsafe: true });

    // Query should work
    const result = await executor.call("tiptap.query.getHTML", {});
    expect(result).toEqual({ html: "<p>Test</p>" });

    // Format should be denied
    await expect(
      executor.call("tiptap.format.toggleBold", {}),
    ).rejects.toThrow(TiptapModuleError);
  });

  // C-2: includeUnsafe now defaults to false
  it("should exclude unknown commands by default (includeUnsafe defaults to false)", () => {
    const editor = createMockEditor({
      extensionManager: {
        extensions: [
          {
            name: "custom",
            type: "extension",
            addCommands: () => ({
              customCommand: () => () => true,
            }),
          },
        ],
      },
    });

    // Default: includeUnsafe=false
    const { registry: defaultRegistry } = withApcore(editor as any);
    const defaultModules = defaultRegistry.list();
    expect(defaultModules).not.toContain("tiptap.unknown.customCommand");

    // Explicitly opt-in
    const { registry: inclRegistry } = withApcore(editor as any, { includeUnsafe: true });
    const inclModules = inclRegistry.list();
    expect(inclModules).toContain("tiptap.unknown.customCommand");
  });

  it("should support registry.discover() for re-scanning", async () => {
    const editor = createMockEditor();
    const { registry } = withApcore(editor as any);
    const count = await registry.discover!();
    expect(count).toBeGreaterThan(0);
  });

  it("executor.registry should return the registry", () => {
    const editor = createMockEditor();
    const { registry, executor } = withApcore(editor as any);
    expect(executor.registry).toBe(registry);
  });

  it("should list modules filtered by tags", () => {
    const editor = createMockEditor();
    const { registry } = withApcore(editor as any);
    const queryModules = registry.list({ tags: ["query"] });
    expect(queryModules.every((m: string) => m.includes(".query."))).toBe(true);
  });

  // H-5: diff-based discover doesn't fire unnecessary events
  describe("H-5: diff-based discover", () => {
    it("should not fire unregister events when extensions haven't changed", async () => {
      const editor = createMockEditor();
      const { registry } = withApcore(editor as any, { includeUnsafe: true });

      const unregisterCb = vi.fn();
      registry.on("unregister", unregisterCb);

      // Re-discover with same editor
      await registry.discover!();

      expect(unregisterCb).not.toHaveBeenCalled();
    });

    it("should unregister removed modules when extensions change", async () => {
      const extensions = [
        {
          name: "bold",
          type: "mark",
          addCommands: () => ({
            toggleBold: () => () => true,
          }),
        },
        {
          name: "history",
          type: "extension",
          addCommands: () => ({
            undo: () => () => true,
          }),
        },
      ];

      const editor = createMockEditor({
        extensionManager: { extensions },
      }) as any;

      const { registry } = withApcore(editor, { includeUnsafe: true });

      // Verify initial state
      expect(registry.list()).toContain("tiptap.format.toggleBold");
      expect(registry.list()).toContain("tiptap.history.undo");

      // Remove bold extension
      editor.extensionManager.extensions = [extensions[1]];

      const unregisterCb = vi.fn();
      registry.on("unregister", unregisterCb);

      await registry.discover!();

      // Bold should have been unregistered
      expect(registry.list()).not.toContain("tiptap.format.toggleBold");
      expect(registry.list()).toContain("tiptap.history.undo");
    });
  });

  // H-1: wire sanitizeHtml
  describe("H-1: sanitizeHtml wiring", () => {
    it("should pass sanitizeHtml to executor", async () => {
      const sanitize = vi.fn((html: string) => html.replace(/<script>/g, ""));
      const chainCalls: { method: string; args: unknown[] }[] = [];
      const mockChain: any = new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (prop === "run") return () => true;
            if (prop === "focus") return () => mockChain;
            return (...args: unknown[]) => {
              chainCalls.push({ method: String(prop), args });
              return mockChain;
            };
          },
        },
      );

      // Need an extension that exposes insertContent for it to be registered
      const editor = createMockEditor({
        chain: () => mockChain,
        extensionManager: {
          extensions: [
            {
              name: "doc",
              type: "node",
              addCommands: () => ({
                insertContent: () => () => true,
              }),
            },
          ],
        },
      });
      const { executor } = withApcore(editor as any, {
        sanitizeHtml: sanitize,
        includeUnsafe: true,
      });

      await executor.call("tiptap.content.insertContent", {
        value: "<p>Hello</p><script>",
      });

      expect(sanitize).toHaveBeenCalledWith("<p>Hello</p><script>");
    });
  });
});
