import { describe, it, expect, vi } from "vitest";
import { TiptapRegistry } from "../../src/runtime/TiptapRegistry.js";
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
    ...overrides,
  };
}

describe("TiptapRegistry", () => {
  // ------- list() basics -------

  it("empty registry list() returns []", () => {
    const registry = new TiptapRegistry();
    expect(registry.list()).toEqual([]);
  });

  it("register() then list() returns module ID", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    expect(registry.list()).toEqual(["tiptap.format.toggleBold"]);
  });

  it("list() returns all registered module IDs", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.register(makeDescriptor("tiptap.format.toggleItalic"));
    registry.register(makeDescriptor("tiptap.query.isBold"));

    const ids = registry.list();
    expect(ids).toHaveLength(3);
    expect(ids).toContain("tiptap.format.toggleBold");
    expect(ids).toContain("tiptap.format.toggleItalic");
    expect(ids).toContain("tiptap.query.isBold");
  });

  // ------- getDefinition() -------

  it("getDefinition() returns descriptor for registered module", () => {
    const registry = new TiptapRegistry();
    const descriptor = makeDescriptor("tiptap.format.toggleBold", {
      tags: ["format"],
    });
    registry.register(descriptor);

    const result = registry.getDefinition("tiptap.format.toggleBold");
    expect(result).toBe(descriptor);
  });

  it("getDefinition() returns null for unknown module", () => {
    const registry = new TiptapRegistry();
    expect(registry.getDefinition("nonexistent")).toBeNull();
  });

  // ------- has() -------

  it("has() returns true if registered", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    expect(registry.has("tiptap.format.toggleBold")).toBe(true);
  });

  it("has() returns false if not registered", () => {
    const registry = new TiptapRegistry();
    expect(registry.has("nonexistent")).toBe(false);
  });

  // ------- list() with tags filter -------

  it("list with tags filters correctly (OR logic)", () => {
    const registry = new TiptapRegistry();
    registry.register(
      makeDescriptor("tiptap.format.toggleBold", { tags: ["format"] }),
    );
    registry.register(
      makeDescriptor("tiptap.query.isBold", { tags: ["query"] }),
    );
    registry.register(
      makeDescriptor("tiptap.format.toggleItalic", {
        tags: ["format", "inline"],
      }),
    );

    // Single tag
    const formatIds = registry.list({ tags: ["format"] });
    expect(formatIds).toHaveLength(2);
    expect(formatIds).toContain("tiptap.format.toggleBold");
    expect(formatIds).toContain("tiptap.format.toggleItalic");

    // Multiple tags (OR logic) - matches any module with "query" OR "inline"
    const orIds = registry.list({ tags: ["query", "inline"] });
    expect(orIds).toHaveLength(2);
    expect(orIds).toContain("tiptap.query.isBold");
    expect(orIds).toContain("tiptap.format.toggleItalic");
  });

  it("list with tags returns empty when no module matches", () => {
    const registry = new TiptapRegistry();
    registry.register(
      makeDescriptor("tiptap.format.toggleBold", { tags: ["format"] }),
    );

    expect(registry.list({ tags: ["nonexistent"] })).toEqual([]);
  });

  it("list with tags handles modules without tags", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold")); // no tags
    registry.register(
      makeDescriptor("tiptap.query.isBold", { tags: ["query"] }),
    );

    const result = registry.list({ tags: ["query"] });
    expect(result).toEqual(["tiptap.query.isBold"]);
  });

  it("list with null tags returns all modules", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.register(makeDescriptor("tiptap.query.isBold"));

    expect(registry.list({ tags: null })).toHaveLength(2);
  });

  it("list with empty tags array returns all modules", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.register(makeDescriptor("tiptap.query.isBold"));

    expect(registry.list({ tags: [] })).toHaveLength(2);
  });

  // ------- list() with prefix filter -------

  it("list with prefix filters correctly", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.register(makeDescriptor("tiptap.format.toggleItalic"));
    registry.register(makeDescriptor("tiptap.query.isBold"));

    const result = registry.list({ prefix: "tiptap.format" });
    expect(result).toHaveLength(2);
    expect(result).toContain("tiptap.format.toggleBold");
    expect(result).toContain("tiptap.format.toggleItalic");
  });

  it("list with prefix returns empty when no module matches", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));

    expect(registry.list({ prefix: "tiptap.query" })).toEqual([]);
  });

  it("list with null prefix returns all modules", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.register(makeDescriptor("tiptap.query.isBold"));

    expect(registry.list({ prefix: null })).toHaveLength(2);
  });

  // ------- list() with both tags AND prefix -------

  it("list with both tags and prefix applies AND logic", () => {
    const registry = new TiptapRegistry();
    registry.register(
      makeDescriptor("tiptap.format.toggleBold", { tags: ["format"] }),
    );
    registry.register(
      makeDescriptor("tiptap.format.toggleItalic", {
        tags: ["format", "inline"],
      }),
    );
    registry.register(
      makeDescriptor("tiptap.query.isBold", { tags: ["query"] }),
    );
    registry.register(
      makeDescriptor("tiptap.query.isItalic", { tags: ["query", "inline"] }),
    );

    // Must match tag "inline" AND prefix "tiptap.format"
    const result = registry.list({
      tags: ["inline"],
      prefix: "tiptap.format",
    });
    expect(result).toEqual(["tiptap.format.toggleItalic"]);
  });

  it("list with tags and prefix returns empty when AND yields no matches", () => {
    const registry = new TiptapRegistry();
    registry.register(
      makeDescriptor("tiptap.format.toggleBold", { tags: ["format"] }),
    );
    registry.register(
      makeDescriptor("tiptap.query.isBold", { tags: ["query"] }),
    );

    // "format" tag AND "tiptap.query" prefix -> nothing matches both
    const result = registry.list({
      tags: ["format"],
      prefix: "tiptap.query",
    });
    expect(result).toEqual([]);
  });

  // ------- Events: on() / register / unregister -------

  it('on("register") fires on register', () => {
    const registry = new TiptapRegistry();
    const callback = vi.fn();
    registry.on("register", callback);

    const descriptor = makeDescriptor("tiptap.format.toggleBold");
    registry.register(descriptor);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      "tiptap.format.toggleBold",
      descriptor,
    );
  });

  it('on("unregister") fires on unregister', () => {
    const registry = new TiptapRegistry();
    const callback = vi.fn();
    registry.on("unregister", callback);

    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.unregister("tiptap.format.toggleBold");

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("tiptap.format.toggleBold");
  });

  it("multiple listeners for the same event are all called", () => {
    const registry = new TiptapRegistry();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    registry.on("register", cb1);
    registry.on("register", cb2);

    registry.register(makeDescriptor("tiptap.format.toggleBold"));

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("emitting event with no listeners does not throw", () => {
    const registry = new TiptapRegistry();
    // No listener registered — should not throw
    expect(() =>
      registry.register(makeDescriptor("tiptap.format.toggleBold")),
    ).not.toThrow();
  });

  // ------- unregister() -------

  it("unregister removes module from registry", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.register(makeDescriptor("tiptap.query.isBold"));

    registry.unregister("tiptap.format.toggleBold");

    expect(registry.list()).toEqual(["tiptap.query.isBold"]);
    expect(registry.getDefinition("tiptap.format.toggleBold")).toBeNull();
    expect(registry.has("tiptap.format.toggleBold")).toBe(false);
  });

  // ------- discover() -------

  it("discover() returns modules.size when no scanFn set", async () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.register(makeDescriptor("tiptap.query.isBold"));

    expect(await registry.discover()).toBe(2);
  });

  it("discover() calls scanFn and returns its result when set", async () => {
    const registry = new TiptapRegistry();
    const scanFn = vi.fn().mockReturnValue(42);
    registry.setScanFunction(scanFn);

    const result = await registry.discover();

    expect(scanFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(42);
  });

  it("discover() returns 0 for empty registry with no scanFn", async () => {
    const registry = new TiptapRegistry();
    expect(await registry.discover()).toBe(0);
  });

  // ------- setScanFunction() -------

  it("setScanFunction replaces previous scanFn", async () => {
    const registry = new TiptapRegistry();
    const firstFn = vi.fn().mockReturnValue(1);
    const secondFn = vi.fn().mockReturnValue(2);

    registry.setScanFunction(firstFn);
    expect(await registry.discover()).toBe(1);

    registry.setScanFunction(secondFn);
    expect(await registry.discover()).toBe(2);
    expect(firstFn).toHaveBeenCalledTimes(1);
    expect(secondFn).toHaveBeenCalledTimes(1);
  });

  // ------- iter() -------

  it("iter() returns an iterator over [moduleId, descriptor] pairs", () => {
    const registry = new TiptapRegistry();
    const d1 = makeDescriptor("tiptap.format.toggleBold");
    const d2 = makeDescriptor("tiptap.query.getHTML");
    registry.register(d1);
    registry.register(d2);

    const entries = Array.from(registry.iter());
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual(["tiptap.format.toggleBold", d1]);
    expect(entries).toContainEqual(["tiptap.query.getHTML", d2]);
  });

  it("iter() returns empty iterator for empty registry", () => {
    const registry = new TiptapRegistry();
    expect(Array.from(registry.iter())).toEqual([]);
  });

  // ------- count -------

  it("count returns the number of registered modules", () => {
    const registry = new TiptapRegistry();
    expect(registry.count).toBe(0);

    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    expect(registry.count).toBe(1);

    registry.register(makeDescriptor("tiptap.query.getHTML"));
    expect(registry.count).toBe(2);

    registry.unregister("tiptap.format.toggleBold");
    expect(registry.count).toBe(1);
  });

  // ------- moduleIds -------

  it("moduleIds returns array of all registered IDs", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.register(makeDescriptor("tiptap.query.getHTML"));

    const ids = registry.moduleIds;
    expect(ids).toHaveLength(2);
    expect(ids).toContain("tiptap.format.toggleBold");
    expect(ids).toContain("tiptap.query.getHTML");
  });

  it("moduleIds returns empty array for empty registry", () => {
    const registry = new TiptapRegistry();
    expect(registry.moduleIds).toEqual([]);
  });

  // ------- clearCache() -------

  it("clearCache() does not throw", () => {
    const registry = new TiptapRegistry();
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    expect(() => registry.clearCache()).not.toThrow();
    // Modules should still be accessible after clearCache
    expect(registry.has("tiptap.format.toggleBold")).toBe(true);
  });

  // ------- off() -------

  it("off() removes a specific listener", () => {
    const registry = new TiptapRegistry();
    const cb = vi.fn();
    registry.on("register", cb);

    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    expect(cb).toHaveBeenCalledTimes(1);

    registry.off("register", cb);
    registry.register(makeDescriptor("tiptap.format.toggleItalic"));
    expect(cb).toHaveBeenCalledTimes(1); // Not called again
  });

  it("off() is a no-op for non-existent event", () => {
    const registry = new TiptapRegistry();
    const cb = vi.fn();
    expect(() => registry.off("nonexistent", cb)).not.toThrow();
  });

  it("off() is a no-op for non-registered callback", () => {
    const registry = new TiptapRegistry();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    registry.on("register", cb1);
    expect(() => registry.off("register", cb2)).not.toThrow();
    // cb1 should still work
    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    expect(cb1).toHaveBeenCalledTimes(1);
  });

  // ------- removeAllListeners() -------

  it("removeAllListeners(event) removes listeners for that event", () => {
    const registry = new TiptapRegistry();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    registry.on("register", cb1);
    registry.on("unregister", cb2);

    registry.removeAllListeners("register");

    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    expect(cb1).toHaveBeenCalledTimes(0); // Removed

    registry.unregister("tiptap.format.toggleBold");
    expect(cb2).toHaveBeenCalledTimes(1); // Still active
  });

  it("removeAllListeners() with no argument removes all listeners", () => {
    const registry = new TiptapRegistry();
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    registry.on("register", cb1);
    registry.on("unregister", cb2);

    registry.removeAllListeners();

    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    registry.unregister("tiptap.format.toggleBold");
    expect(cb1).toHaveBeenCalledTimes(0);
    expect(cb2).toHaveBeenCalledTimes(0);
  });

  // ------- on() returns unsubscribe function -------

  it("on() returns an unsubscribe function", () => {
    const registry = new TiptapRegistry();
    const cb = vi.fn();
    const unsub = registry.on("register", cb);

    registry.register(makeDescriptor("tiptap.format.toggleBold"));
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
    registry.register(makeDescriptor("tiptap.format.toggleItalic"));
    expect(cb).toHaveBeenCalledTimes(1); // Not called again
  });

  // ------- Re-registration -------

  it("re-registering a module overwrites the previous descriptor", () => {
    const registry = new TiptapRegistry();
    const v1 = makeDescriptor("tiptap.format.toggleBold", {
      description: "v1",
    });
    const v2 = makeDescriptor("tiptap.format.toggleBold", {
      description: "v2",
    });

    registry.register(v1);
    registry.register(v2);

    expect(registry.getDefinition("tiptap.format.toggleBold")?.description).toBe("v2");
    // list() should not duplicate
    expect(registry.list()).toEqual(["tiptap.format.toggleBold"]);
  });
});
