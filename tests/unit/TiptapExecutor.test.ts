import { describe, it, expect, vi } from "vitest";
import { TiptapExecutor } from "../../src/runtime/TiptapExecutor.js";
import { TiptapRegistry } from "../../src/runtime/TiptapRegistry.js";
import { AclGuard } from "../../src/security/AclGuard.js";
import { TiptapModuleError, ErrorCodes } from "../../src/errors/index.js";
import type { ModuleDescriptor } from "../../src/types.js";

/** Helper to create a minimal ModuleDescriptor for testing. */
function makeDescriptor(
  moduleId: string,
  overrides: Partial<ModuleDescriptor> = {},
): ModuleDescriptor {
  return {
    moduleId,
    description: `Description for ${moduleId}`,
    inputSchema: {},
    outputSchema: {},
    annotations: null,
    tags: ["query"],
    ...overrides,
  };
}

/** Create a mock editor with a proxy-based chain builder. */
function createMockEditor(overrides: Partial<Record<string, unknown>> = {}): any {
  const mockChain: any = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "run") return () => true;
        if (prop === "focus") return () => mockChain;
        return (..._args: unknown[]) => mockChain;
      },
    },
  );

  return {
    isDestroyed: false,
    getHTML: () => "<p>Test</p>",
    getJSON: () => ({ type: "doc", content: [] }),
    getText: (opts?: any) =>
      opts?.blockSeparator ? `Test${opts.blockSeparator}content` : "Test content",
    isActive: (name: string) => name === "bold",
    getAttributes: (name: string) => ({ name }),
    isEmpty: false,
    isEditable: true,
    isFocused: true,
    state: {
      doc: {
        content: { size: 100 },
        descendants: (cb: (node: { isText: boolean; text?: string | null }, pos: number) => boolean | void) => {
          // Default mock: single paragraph with "Test content" at pos 1
          cb({ isText: true, text: "Test content" }, 1);
        },
      },
    },
    storage: {},
    commands: {},
    chain: () => mockChain,
    can: () => ({ chain: () => mockChain }),
    extensionManager: { extensions: [] },
    ...overrides,
  };
}

/** Helper: register a descriptor in a registry and return the executor. */
function setup(
  editorOverrides: Partial<Record<string, unknown>> = {},
  aclConfig?: Parameters<typeof AclGuard>[0],
) {
  const editor = createMockEditor(editorOverrides);
  const registry = new TiptapRegistry();
  const aclGuard = new AclGuard(aclConfig);
  const executor = new TiptapExecutor(editor, registry, aclGuard);
  return { editor, registry, aclGuard, executor };
}

describe("TiptapExecutor", () => {
  // ─── Query: getHTML ───────────────────────────────────────────
  describe("query: getHTML", () => {
    it("returns { html: '...' }", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.getHTML"));

      const result = await executor.call("tiptap.query.getHTML", {});
      expect(result).toEqual({ html: "<p>Test</p>" });
    });
  });

  // ─── Query: getJSON ───────────────────────────────────────────
  describe("query: getJSON", () => {
    it("returns { json: {...} }", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.getJSON"));

      const result = await executor.call("tiptap.query.getJSON", {});
      expect(result).toEqual({ json: { type: "doc", content: [] } });
    });
  });

  // ─── Query: getText ───────────────────────────────────────────
  describe("query: getText", () => {
    it("returns text with blockSeparator", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.getText"));

      const result = await executor.call("tiptap.query.getText", {
        blockSeparator: "\n",
      });
      expect(result).toEqual({ text: "Test\ncontent" });
    });

    it("returns text without blockSeparator", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.getText"));

      const result = await executor.call("tiptap.query.getText", {});
      expect(result).toEqual({ text: "Test content" });
    });

    it("ignores non-string blockSeparator", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.getText"));

      const result = await executor.call("tiptap.query.getText", {
        blockSeparator: 123,
      });
      expect(result).toEqual({ text: "Test content" });
    });
  });

  // ─── Query: isActive ──────────────────────────────────────────
  describe("query: isActive", () => {
    it("returns { active: true } when mark is active", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.isActive"));

      const result = await executor.call("tiptap.query.isActive", { name: "bold" });
      expect(result).toEqual({ active: true });
    });

    it("returns { active: false } when mark is not active", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.isActive"));

      const result = await executor.call("tiptap.query.isActive", {
        name: "italic",
      });
      expect(result).toEqual({ active: false });
    });

    it("passes attrs to isActive", async () => {
      const isActiveSpy = vi.fn().mockReturnValue(true);
      const { registry, executor } = setup({ isActive: isActiveSpy });
      registry.register(makeDescriptor("tiptap.query.isActive"));

      await executor.call("tiptap.query.isActive", {
        name: "heading",
        attrs: { level: 2 },
      });
      expect(isActiveSpy).toHaveBeenCalledWith("heading", { level: 2 });
    });

    it("H-2: throws SCHEMA_VALIDATION_ERROR when name is missing", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.isActive"));

      try {
        await executor.call("tiptap.query.isActive", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.SCHEMA_VALIDATION_ERROR);
        expect((err as TiptapModuleError).details?.field).toBe("name");
      }
    });

    it("H-2: throws SCHEMA_VALIDATION_ERROR when name is not a string", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.isActive"));

      try {
        await executor.call("tiptap.query.isActive", { name: 42 });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.SCHEMA_VALIDATION_ERROR);
      }
    });
  });

  // ─── Query: getAttributes ─────────────────────────────────────
  describe("query: getAttributes", () => {
    it("returns { attributes: {...} }", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.getAttributes"));

      const result = await executor.call("tiptap.query.getAttributes", {
        typeOrName: "heading",
      });
      expect(result).toEqual({ attributes: { name: "heading" } });
    });

    it("H-2: throws SCHEMA_VALIDATION_ERROR when typeOrName is missing", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.getAttributes"));

      try {
        await executor.call("tiptap.query.getAttributes", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.SCHEMA_VALIDATION_ERROR);
        expect((err as TiptapModuleError).details?.field).toBe("typeOrName");
      }
    });
  });

  // ─── Query: isEmpty / isEditable / isFocused ─────────────────
  describe("query: boolean properties", () => {
    it("isEmpty returns { value: false }", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.isEmpty"));

      const result = await executor.call("tiptap.query.isEmpty", {});
      expect(result).toEqual({ value: false });
    });

    it("isEmpty returns { value: true } when editor is empty", async () => {
      const { registry, executor } = setup({ isEmpty: true });
      registry.register(makeDescriptor("tiptap.query.isEmpty"));

      const result = await executor.call("tiptap.query.isEmpty", {});
      expect(result).toEqual({ value: true });
    });

    it("isEditable returns { value: true }", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.isEditable"));

      const result = await executor.call("tiptap.query.isEditable", {});
      expect(result).toEqual({ value: true });
    });

    it("isEditable returns { value: false } when not editable", async () => {
      const { registry, executor } = setup({ isEditable: false });
      registry.register(makeDescriptor("tiptap.query.isEditable"));

      const result = await executor.call("tiptap.query.isEditable", {});
      expect(result).toEqual({ value: false });
    });

    it("isFocused returns { value: true }", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.isFocused"));

      const result = await executor.call("tiptap.query.isFocused", {});
      expect(result).toEqual({ value: true });
    });

    it("isFocused returns { value: false } when not focused", async () => {
      const { registry, executor } = setup({ isFocused: false });
      registry.register(makeDescriptor("tiptap.query.isFocused"));

      const result = await executor.call("tiptap.query.isFocused", {});
      expect(result).toEqual({ value: false });
    });
  });

  // ─── Command: toggleBold ──────────────────────────────────────
  describe("command: toggleBold", () => {
    it("returns { success: true }", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.toggleBold", { tags: ["format"] }),
      );

      const result = await executor.call("tiptap.format.toggleBold", {});
      expect(result).toEqual({ success: true });
    });
  });

  // ─── Command: toggleHeading ───────────────────────────────────
  describe("command: toggleHeading", () => {
    it("passes level argument", async () => {
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

      const { registry, executor } = setup({ chain: () => mockChain });
      registry.register(
        makeDescriptor("tiptap.format.toggleHeading", { tags: ["format"] }),
      );

      const result = await executor.call("tiptap.format.toggleHeading", { level: 2 });
      expect(result).toEqual({ success: true });
      expect(chainCalls).toContainEqual({
        method: "toggleHeading",
        args: [{ level: 2 }],
      });
    });
  });

  // ─── Command: insertContent ───────────────────────────────────
  describe("command: insertContent", () => {
    it("passes value argument", async () => {
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

      const { registry, executor } = setup({ chain: () => mockChain });
      registry.register(
        makeDescriptor("tiptap.content.insertContent", { tags: ["content"] }),
      );

      const result = await executor.call("tiptap.content.insertContent", {
        value: "Hello",
      });
      expect(result).toEqual({ success: true });
      expect(chainCalls).toContainEqual({
        method: "insertContent",
        args: ["Hello", {}],
      });
    });
  });

  // ─── C-1: setLink XSS protection ──────────────────────────────
  describe("C-1: setLink XSS protection", () => {
    it("rejects javascript: URLs", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.setLink", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.setLink", { href: "javascript:alert(1)" });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.SCHEMA_VALIDATION_ERROR);
        expect((err as TiptapModuleError).message).toContain("unsafe URL");
      }
    });

    it("rejects data: URLs", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.setLink", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.setLink", { href: "data:text/html,<script>alert(1)</script>" });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.SCHEMA_VALIDATION_ERROR);
      }
    });

    it("rejects vbscript: URLs", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.setLink", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.setLink", { href: "vbscript:MsgBox" });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.SCHEMA_VALIDATION_ERROR);
      }
    });

    it("allows https: URLs", async () => {
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

      const editor = createMockEditor({ chain: () => mockChain });
      const registry = new TiptapRegistry();
      const aclGuard = new AclGuard();
      const executor = new TiptapExecutor(editor, registry, aclGuard);

      registry.register(
        makeDescriptor("tiptap.format.setLink", { tags: ["format"] }),
      );

      const result = await executor.call("tiptap.format.setLink", {
        href: "https://example.com",
      });
      expect(result).toEqual({ success: true });
    });

    it("allows mailto: URLs", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.setLink", { tags: ["format"] }),
      );

      const result = await executor.call("tiptap.format.setLink", {
        href: "mailto:test@example.com",
      });
      expect(result).toEqual({ success: true });
    });

    it("allows relative URLs starting with /", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.setLink", { tags: ["format"] }),
      );

      const result = await executor.call("tiptap.format.setLink", {
        href: "/page",
      });
      expect(result).toEqual({ success: true });
    });

    it("allows relative URLs starting with #", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.setLink", { tags: ["format"] }),
      );

      const result = await executor.call("tiptap.format.setLink", {
        href: "#section",
      });
      expect(result).toEqual({ success: true });
    });

    it("rejects non-string href", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.setLink", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.setLink", { href: 42 });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.SCHEMA_VALIDATION_ERROR);
      }
    });
  });

  // ─── C-2 + H-8: Prototype pollution guard ─────────────────────
  describe("C-2 + H-8: prototype pollution guard", () => {
    it("rejects __proto__ command", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.__proto__", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.__proto__", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.COMMAND_NOT_FOUND);
        expect((err as TiptapModuleError).message).toContain("not allowed");
      }
    });

    it("rejects constructor command", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.constructor", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.constructor", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.COMMAND_NOT_FOUND);
        expect((err as TiptapModuleError).message).toContain("not allowed");
      }
    });

    it("rejects prototype command", async () => {
      const { registry, executor } = setup();
      registry.register(
        makeDescriptor("tiptap.format.prototype", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.prototype", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.COMMAND_NOT_FOUND);
      }
    });
  });

  // ─── H-1: sanitizeHtml callback ───────────────────────────────
  describe("H-1: sanitizeHtml callback", () => {
    it("calls sanitizeHtml for insertContent with string value", async () => {
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

      const editor = createMockEditor({ chain: () => mockChain });
      const registry = new TiptapRegistry();
      const aclGuard = new AclGuard();
      const executor = new TiptapExecutor(editor, registry, aclGuard, sanitize);

      registry.register(
        makeDescriptor("tiptap.content.insertContent", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.insertContent", {
        value: "<p>Hello</p><script>",
      });
      expect(sanitize).toHaveBeenCalledWith("<p>Hello</p><script>");
      expect(chainCalls).toContainEqual({
        method: "insertContent",
        args: ["<p>Hello</p>", {}],
      });
    });

    it("calls sanitizeHtml for setContent with string value", async () => {
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

      const editor = createMockEditor({ chain: () => mockChain });
      const registry = new TiptapRegistry();
      const aclGuard = new AclGuard();
      const executor = new TiptapExecutor(editor, registry, aclGuard, sanitize);

      registry.register(
        makeDescriptor("tiptap.destructive.setContent", { tags: ["destructive"] }),
      );

      await executor.call("tiptap.destructive.setContent", {
        value: "<p>New</p><script>",
      });
      expect(sanitize).toHaveBeenCalledWith("<p>New</p><script>");
      expect(chainCalls).toContainEqual({
        method: "setContent",
        args: ["<p>New</p>", true, {}],
      });
    });

    it("does not call sanitizeHtml when not provided", async () => {
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

      const editor = createMockEditor({ chain: () => mockChain });
      const registry = new TiptapRegistry();
      const aclGuard = new AclGuard();
      const executor = new TiptapExecutor(editor, registry, aclGuard);

      registry.register(
        makeDescriptor("tiptap.content.insertContent", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.insertContent", {
        value: "<p>Hello</p>",
      });
      expect(chainCalls).toContainEqual({
        method: "insertContent",
        args: ["<p>Hello</p>", {}],
      });
    });
  });

  // ─── Error: MODULE_NOT_FOUND ──────────────────────────────────
  describe("error: MODULE_NOT_FOUND", () => {
    it("throws for unknown module", async () => {
      const { executor } = setup();

      try {
        await executor.call("tiptap.format.nonExistent", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.MODULE_NOT_FOUND);
        expect((err as TiptapModuleError).message).toContain("nonExistent");
        expect((err as TiptapModuleError).details?.moduleId).toBe(
          "tiptap.format.nonExistent",
        );
      }
    });
  });

  // ─── Error: EDITOR_NOT_READY ──────────────────────────────────
  describe("error: EDITOR_NOT_READY", () => {
    it("throws when editor is destroyed", async () => {
      const { registry, executor } = setup({ isDestroyed: true });
      registry.register(makeDescriptor("tiptap.query.getHTML"));

      try {
        await executor.call("tiptap.query.getHTML", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.EDITOR_NOT_READY);
        expect((err as TiptapModuleError).details?.editorDestroyed).toBe(true);
      }
    });
  });

  // ─── Error: COMMAND_FAILED ────────────────────────────────────
  describe("error: COMMAND_FAILED", () => {
    it("throws when chain.run() returns false", async () => {
      const failChain: any = new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (prop === "run") return () => false;
            if (prop === "focus") return () => failChain;
            return (..._args: unknown[]) => failChain;
          },
        },
      );

      const { registry, executor } = setup({ chain: () => failChain });
      registry.register(
        makeDescriptor("tiptap.format.toggleBold", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.toggleBold", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.COMMAND_FAILED);
        expect((err as TiptapModuleError).details?.commandName).toBe("toggleBold");
      }
    });
  });

  // ─── Error: ACL_DENIED ────────────────────────────────────────
  describe("error: ACL_DENIED", () => {
    it("throws when AclGuard denies access", async () => {
      const { registry, executor } = setup({}, { role: "readonly" });
      registry.register(
        makeDescriptor("tiptap.format.toggleBold", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.toggleBold", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.ACL_DENIED);
        expect((err as TiptapModuleError).message).toContain("toggleBold");
      }
    });
  });

  // ─── Error: COMMAND_NOT_FOUND ─────────────────────────────────
  describe("error: COMMAND_NOT_FOUND", () => {
    it("throws for unknown query command", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.unknownQuery"));

      try {
        await executor.call("tiptap.query.unknownQuery", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.COMMAND_NOT_FOUND);
        expect((err as TiptapModuleError).details?.commandName).toBe("unknownQuery");
      }
    });

    it("throws for unknown command when chain method is not a function", async () => {
      // Create a chain where the command method doesn't exist
      const limitedChain: any = {
        focus: () => limitedChain,
        run: () => true,
        // No other methods
      };

      const { registry, executor } = setup({ chain: () => limitedChain });
      registry.register(
        makeDescriptor("tiptap.format.nonExistentCmd", { tags: ["format"] }),
      );

      try {
        await executor.call("tiptap.format.nonExistentCmd", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.COMMAND_NOT_FOUND);
        expect((err as TiptapModuleError).details?.commandName).toBe("nonExistentCmd");
      }
    });
  });

  // ─── callAsync ─────────────────────────────────────────────────
  describe("callAsync", () => {
    it("resolves with same result as call", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.getHTML"));

      const result = await executor.callAsync("tiptap.query.getHTML", {});
      expect(result).toEqual({ html: "<p>Test</p>" });
    });

    it("rejects with same error as call", async () => {
      const { executor } = setup();

      try {
        await executor.callAsync("tiptap.format.nonExistent", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.MODULE_NOT_FOUND);
      }
    });
  });

  // ─── executor.registry ────────────────────────────────────────
  describe("executor.registry", () => {
    it("returns the TiptapRegistry instance", () => {
      const { registry, executor } = setup();
      expect(executor.registry).toBe(registry);
    });

    it("registry is functional through executor", () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query.getHTML"));

      const ids = executor.registry.list();
      expect(ids).toContain("tiptap.query.getHTML");
    });
  });

  // ─── buildArgs coverage for various commands ──────────────────
  describe("buildArgs routing", () => {
    /** Helper to capture chain calls. */
    function createCapturingSetup() {
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

      const editor = createMockEditor({ chain: () => mockChain });
      const registry = new TiptapRegistry();
      const aclGuard = new AclGuard();
      const executor = new TiptapExecutor(editor, registry, aclGuard);
      return { chainCalls, registry, executor };
    }

    it("toggleItalic sends no args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.toggleItalic", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.toggleItalic", {});
      expect(chainCalls).toContainEqual({ method: "toggleItalic", args: [] });
    });

    it("toggleHighlight sends color arg when provided", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.toggleHighlight", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.toggleHighlight", { color: "yellow" });
      expect(chainCalls).toContainEqual({
        method: "toggleHighlight",
        args: [{ color: "yellow" }],
      });
    });

    it("toggleHighlight sends no args when color not provided", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.toggleHighlight", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.toggleHighlight", {});
      expect(chainCalls).toContainEqual({ method: "toggleHighlight", args: [] });
    });

    it("toggleCodeBlock sends language arg when provided", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.toggleCodeBlock", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.toggleCodeBlock", { language: "typescript" });
      expect(chainCalls).toContainEqual({
        method: "toggleCodeBlock",
        args: [{ language: "typescript" }],
      });
    });

    it("toggleCodeBlock sends no args when language not provided", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.toggleCodeBlock", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.toggleCodeBlock", {});
      expect(chainCalls).toContainEqual({ method: "toggleCodeBlock", args: [] });
    });

    it("setTextAlign sends alignment string", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.setTextAlign", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.setTextAlign", { alignment: "center" });
      expect(chainCalls).toContainEqual({
        method: "setTextAlign",
        args: ["center"],
      });
    });

    it("setMark sends typeOrName and attrs", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.setMark", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.setMark", {
        typeOrName: "textStyle",
        attrs: { color: "red" },
      });
      expect(chainCalls).toContainEqual({
        method: "setMark",
        args: ["textStyle", { color: "red" }],
      });
    });

    it("unsetMark sends typeOrName", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.unsetMark", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.unsetMark", { typeOrName: "bold" });
      expect(chainCalls).toContainEqual({
        method: "unsetMark",
        args: ["bold"],
      });
    });

    it("updateAttributes sends typeOrName and attrs", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.updateAttributes", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.updateAttributes", {
        typeOrName: "image",
        attrs: { src: "test.png" },
      });
      expect(chainCalls).toContainEqual({
        method: "updateAttributes",
        args: ["image", { src: "test.png" }],
      });
    });

    it("setLink sends href, target, rel", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.setLink", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.setLink", {
        href: "https://example.com",
        target: "_blank",
        rel: "noopener",
      });
      expect(chainCalls).toContainEqual({
        method: "setLink",
        args: [{ href: "https://example.com", target: "_blank", rel: "noopener" }],
      });
    });

    it("insertContentAt sends position, value, options", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.insertContentAt", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.insertContentAt", {
        position: 5,
        value: "Hello",
      });
      expect(chainCalls).toContainEqual({
        method: "insertContentAt",
        args: [5, "Hello", {}],
      });
    });

    it("setNode sends typeOrName and attrs", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.setNode", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.setNode", {
        typeOrName: "paragraph",
        attrs: {},
      });
      expect(chainCalls).toContainEqual({
        method: "setNode",
        args: ["paragraph", {}],
      });
    });

    it("liftListItem sends typeOrName", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.liftListItem", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.liftListItem", { typeOrName: "listItem" });
      expect(chainCalls).toContainEqual({
        method: "liftListItem",
        args: ["listItem"],
      });
    });

    it("sinkListItem sends typeOrName", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.sinkListItem", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.sinkListItem", { typeOrName: "listItem" });
      expect(chainCalls).toContainEqual({
        method: "sinkListItem",
        args: ["listItem"],
      });
    });

    it("wrapIn sends typeOrName and attrs", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.wrapIn", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.wrapIn", {
        typeOrName: "blockquote",
        attrs: {},
      });
      expect(chainCalls).toContainEqual({
        method: "wrapIn",
        args: ["blockquote", {}],
      });
    });

    it("lift sends typeOrName and attrs", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.lift", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.lift", {
        typeOrName: "blockquote",
        attrs: {},
      });
      expect(chainCalls).toContainEqual({
        method: "lift",
        args: ["blockquote", {}],
      });
    });

    it("clearContent sends emitUpdate when provided", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.destructive.clearContent", {
          tags: ["destructive"],
        }),
      );

      await executor.call("tiptap.destructive.clearContent", { emitUpdate: true });
      expect(chainCalls).toContainEqual({
        method: "clearContent",
        args: [true],
      });
    });

    it("clearContent sends no args when emitUpdate not provided", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.destructive.clearContent", {
          tags: ["destructive"],
        }),
      );

      await executor.call("tiptap.destructive.clearContent", {});
      expect(chainCalls).toContainEqual({
        method: "clearContent",
        args: [],
      });
    });

    it("setContent sends value, emitUpdate, parseOptions", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.destructive.setContent", {
          tags: ["destructive"],
        }),
      );

      await executor.call("tiptap.destructive.setContent", {
        value: "<p>New</p>",
        emitUpdate: false,
      });
      expect(chainCalls).toContainEqual({
        method: "setContent",
        args: ["<p>New</p>", false, {}],
      });
    });

    it("deleteRange sends from and to", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.destructive.deleteRange", {
          tags: ["destructive"],
        }),
      );

      await executor.call("tiptap.destructive.deleteRange", { from: 0, to: 10 });
      expect(chainCalls).toContainEqual({
        method: "deleteRange",
        args: [{ from: 0, to: 10 }],
      });
    });

    it("setTextSelection sends position", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.selection.setTextSelection", {
          tags: ["selection"],
        }),
      );

      await executor.call("tiptap.selection.setTextSelection", { position: 5 });
      expect(chainCalls).toContainEqual({
        method: "setTextSelection",
        args: [5],
      });
    });

    it("setNodeSelection sends position", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.selection.setNodeSelection", {
          tags: ["selection"],
        }),
      );

      await executor.call("tiptap.selection.setNodeSelection", { position: 3 });
      expect(chainCalls).toContainEqual({
        method: "setNodeSelection",
        args: [3],
      });
    });

    it("focus sends position when provided", async () => {
      // For the "focus" command, we need a chain that captures ALL calls including focus
      const allCalls: { method: string; args: unknown[] }[] = [];
      const capturingChain: any = new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (prop === "run") return () => true;
            return (...args: unknown[]) => {
              allCalls.push({ method: String(prop), args });
              return capturingChain;
            };
          },
        },
      );

      const editor = createMockEditor({ chain: () => capturingChain });
      const registry = new TiptapRegistry();
      const aclGuard = new AclGuard();
      const executor = new TiptapExecutor(editor, registry, aclGuard);

      registry.register(
        makeDescriptor("tiptap.selection.focus", { tags: ["selection"] }),
      );

      await executor.call("tiptap.selection.focus", { position: "end" });
      // First focus call is chain().focus(), second is the command focus("end")
      const focusCalls = allCalls.filter((c) => c.method === "focus");
      expect(focusCalls.length).toBe(2);
      expect(focusCalls[1].args).toEqual(["end"]);
    });

    it("focus sends no args when position not provided", async () => {
      const allCalls: { method: string; args: unknown[] }[] = [];
      const capturingChain: any = new Proxy(
        {},
        {
          get: (_target, prop) => {
            if (prop === "run") return () => true;
            return (...args: unknown[]) => {
              allCalls.push({ method: String(prop), args });
              return capturingChain;
            };
          },
        },
      );

      const editor = createMockEditor({ chain: () => capturingChain });
      const registry = new TiptapRegistry();
      const aclGuard = new AclGuard();
      const executor = new TiptapExecutor(editor, registry, aclGuard);

      registry.register(
        makeDescriptor("tiptap.selection.focus", { tags: ["selection"] }),
      );

      await executor.call("tiptap.selection.focus", {});
      // First focus call is chain().focus(), second is the command focus()
      const focusCalls = allCalls.filter((c) => c.method === "focus");
      expect(focusCalls.length).toBe(2);
      expect(focusCalls[1].args).toEqual([]);
    });

    it("setBold sends no args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.setBold", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.setBold", {});
      expect(chainCalls).toContainEqual({ method: "setBold", args: [] });
    });

    it("unsetItalic sends no args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.unsetItalic", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.unsetItalic", {});
      expect(chainCalls).toContainEqual({ method: "unsetItalic", args: [] });
    });

    it("setParagraph sends no args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.setParagraph", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.setParagraph", {});
      expect(chainCalls).toContainEqual({ method: "setParagraph", args: [] });
    });

    it("exitCode sends no args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.exitCode", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.exitCode", {});
      expect(chainCalls).toContainEqual({ method: "exitCode", args: [] });
    });

    it("setHeading sends level arg", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.setHeading", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.setHeading", { level: 2 });
      expect(chainCalls).toContainEqual({
        method: "setHeading",
        args: [{ level: 2 }],
      });
    });

    it("splitListItem sends typeOrName and overrideAttrs", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.splitListItem", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.splitListItem", { typeOrName: "listItem" });
      expect(chainCalls).toContainEqual({
        method: "splitListItem",
        args: ["listItem", {}],
      });
    });

    it("wrapInList sends typeOrName and attributes", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.wrapInList", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.wrapInList", {
        typeOrName: "bulletList",
        attributes: { tight: true },
      });
      expect(chainCalls).toContainEqual({
        method: "wrapInList",
        args: ["bulletList", { tight: true }],
      });
    });

    it("toggleList sends all four args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.toggleList", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.toggleList", {
        listTypeOrName: "bulletList",
        itemTypeOrName: "listItem",
        keepMarks: true,
        attributes: {},
      });
      expect(chainCalls).toContainEqual({
        method: "toggleList",
        args: ["bulletList", "listItem", true, {}],
      });
    });

    it("deleteNode sends typeOrName", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.content.deleteNode", { tags: ["content"] }),
      );

      await executor.call("tiptap.content.deleteNode", { typeOrName: "image" });
      expect(chainCalls).toContainEqual({
        method: "deleteNode",
        args: ["image"],
      });
    });

    it("unknown command passes inputs as single object arg", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.customExtensionCmd", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.customExtensionCmd", { foo: "bar", baz: 42 });
      expect(chainCalls).toContainEqual({
        method: "customExtensionCmd",
        args: [{ foo: "bar", baz: 42 }],
      });
    });

    it("unknown command with no inputs passes no args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.format.customNoArgs", { tags: ["format"] }),
      );

      await executor.call("tiptap.format.customNoArgs", {});
      expect(chainCalls).toContainEqual({
        method: "customNoArgs",
        args: [],
      });
    });

    it("undo sends no args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.history.undo", { tags: ["history"] }),
      );

      await executor.call("tiptap.history.undo", {});
      expect(chainCalls).toContainEqual({ method: "undo", args: [] });
    });

    it("redo sends no args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.history.redo", { tags: ["history"] }),
      );

      await executor.call("tiptap.history.redo", {});
      expect(chainCalls).toContainEqual({ method: "redo", args: [] });
    });

    it("selectAll sends no args", async () => {
      const { chainCalls, registry, executor } = createCapturingSetup();
      registry.register(
        makeDescriptor("tiptap.selection.selectAll", { tags: ["selection"] }),
      );

      await executor.call("tiptap.selection.selectAll", {});
      expect(chainCalls).toContainEqual({ method: "selectAll", args: [] });
    });
  });

  // ─── extractCategory / extractCommandName edge cases ──────────
  describe("moduleId parsing edge cases", () => {
    it("handles moduleId with only one segment", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("singleSegment", { tags: ["query"] }));

      // extractCategory returns "unknown" (not "query"), so it routes to executeCommand
      // extractCommandName returns "singleSegment" (the full id)
      // This should attempt to run as a command with the proxy chain
      const result = await executor.call("singleSegment", {});
      expect(result).toEqual({ success: true });
    });

    it("handles moduleId with two segments routed to query", async () => {
      const { registry, executor } = setup();
      registry.register(makeDescriptor("tiptap.query", { tags: ["query"] }));

      // extractCategory returns "query", so routes to executeQuery
      // extractCommandName returns "tiptap.query" (full id since parts < 3)
      // This should hit the default case in executeQuery and throw COMMAND_NOT_FOUND
      try {
        await executor.call("tiptap.query", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.COMMAND_NOT_FOUND);
      }
    });
  });

  // ─── setContent default emitUpdate ────────────────────────────
  describe("setContent defaults", () => {
    it("uses default emitUpdate=true when not provided", async () => {
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

      const editor = createMockEditor({ chain: () => mockChain });
      const registry = new TiptapRegistry();
      const aclGuard = new AclGuard();
      const executor = new TiptapExecutor(editor, registry, aclGuard);

      registry.register(
        makeDescriptor("tiptap.destructive.setContent", { tags: ["destructive"] }),
      );

      await executor.call("tiptap.destructive.setContent", { value: "<p>Hi</p>" });
      expect(chainCalls).toContainEqual({
        method: "setContent",
        args: ["<p>Hi</p>", true, {}],
      });
    });
  });

  // ─── selectText: semantic text search and selection ──────────
  describe("selectText", () => {
    /** Create a mock editor with a document containing specific text nodes. */
    function createDocEditor(
      textNodes: Array<{ text: string; pos: number }>,
    ) {
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

      const editor = createMockEditor({
        chain: () => mockChain,
        state: {
          doc: {
            content: { size: 100 },
            descendants: (
              cb: (node: { isText: boolean; text?: string | null }, pos: number) => boolean | void,
            ) => {
              for (const { text, pos } of textNodes) {
                const result = cb({ isText: true, text }, pos);
                if (result === false) break;
              }
            },
          },
        },
      });

      const registry = new TiptapRegistry();
      const aclGuard = new AclGuard();
      const executor = new TiptapExecutor(editor, registry, aclGuard);
      registry.register(
        makeDescriptor("tiptap.selection.selectText", { tags: ["selection"] }),
      );

      return { executor, chainCalls };
    }

    it("finds and selects text in a single text node", async () => {
      const { executor, chainCalls } = createDocEditor([
        { text: "Hello world, apcore is great", pos: 1 },
      ]);

      const result = await executor.call("tiptap.selection.selectText", {
        text: "apcore",
      });

      expect(result).toEqual({ found: true, from: 14, to: 20 });
      expect(chainCalls).toContainEqual({
        method: "setTextSelection",
        args: [{ from: 14, to: 20 }],
      });
    });

    it("finds text across multiple text nodes", async () => {
      const { executor, chainCalls } = createDocEditor([
        { text: "First paragraph", pos: 1 },
        { text: "Second paragraph with apcore here", pos: 20 },
      ]);

      const result = await executor.call("tiptap.selection.selectText", {
        text: "apcore",
      });

      expect(result).toEqual({ found: true, from: 42, to: 48 });
      expect(chainCalls).toContainEqual({
        method: "setTextSelection",
        args: [{ from: 42, to: 48 }],
      });
    });

    it("returns found: false when text not found", async () => {
      const { executor, chainCalls } = createDocEditor([
        { text: "Hello world", pos: 1 },
      ]);

      const result = await executor.call("tiptap.selection.selectText", {
        text: "nonexistent",
      });

      expect(result).toEqual({ found: false });
      // No setTextSelection should be called
      expect(chainCalls).not.toContainEqual(
        expect.objectContaining({ method: "setTextSelection" }),
      );
    });

    it("selects the Nth occurrence when occurrence param is set", async () => {
      const { executor } = createDocEditor([
        { text: "foo bar foo baz foo", pos: 1 },
      ]);

      const result = await executor.call("tiptap.selection.selectText", {
        text: "foo",
        occurrence: 2,
      });

      // "foo" at index 8 in text, pos starts at 1 → from: 9, to: 12
      expect(result).toEqual({ found: true, from: 9, to: 12 });
    });

    it("selects 3rd occurrence across text nodes", async () => {
      const { executor } = createDocEditor([
        { text: "foo bar foo", pos: 1 },
        { text: "baz foo end", pos: 15 },
      ]);

      const result = await executor.call("tiptap.selection.selectText", {
        text: "foo",
        occurrence: 3,
      });

      // 3rd "foo" is at index 4 in second text node (pos 15) → from: 19, to: 22
      expect(result).toEqual({ found: true, from: 19, to: 22 });
    });

    it("throws SCHEMA_VALIDATION_ERROR when text is missing", async () => {
      const { executor } = createDocEditor([
        { text: "Hello", pos: 1 },
      ]);

      try {
        await executor.call("tiptap.selection.selectText", {});
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(
          ErrorCodes.SCHEMA_VALIDATION_ERROR,
        );
        expect((err as TiptapModuleError).message).toContain("text");
      }
    });

    it("throws SCHEMA_VALIDATION_ERROR when text is empty string", async () => {
      const { executor } = createDocEditor([
        { text: "Hello", pos: 1 },
      ]);

      try {
        await executor.call("tiptap.selection.selectText", { text: "" });
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(
          ErrorCodes.SCHEMA_VALIDATION_ERROR,
        );
      }
    });

    it("defaults occurrence to 1 when not provided", async () => {
      const { executor } = createDocEditor([
        { text: "abc abc abc", pos: 1 },
      ]);

      const result = await executor.call("tiptap.selection.selectText", {
        text: "abc",
      });

      // First occurrence at index 0, pos 1 → from: 1, to: 4
      expect(result).toEqual({ found: true, from: 1, to: 4 });
    });
  });
});
