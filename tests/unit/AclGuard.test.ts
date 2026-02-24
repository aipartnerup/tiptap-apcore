import { describe, it, expect, vi } from "vitest";
import { AclGuard } from "../../src/security/AclGuard.js";
import { TiptapModuleError, ErrorCodes } from "../../src/errors/index.js";
import type { ModuleDescriptor, Logger } from "../../src/types.js";

/** Helper to create a minimal ModuleDescriptor with the given tags */
function makeDescriptor(
  tags: string[],
  overrides?: Partial<ModuleDescriptor>,
): ModuleDescriptor {
  return {
    moduleId: overrides?.moduleId ?? "test.module",
    description: "test module",
    inputSchema: {},
    outputSchema: {},
    annotations: null,
    tags,
    ...overrides,
  };
}

describe("AclGuard", () => {
  // ─── No config → allows everything ─────────────────────────────
  describe("no config (opt-in security)", () => {
    it("should allow everything when no config is provided", () => {
      const guard = new AclGuard();
      expect(guard.isAllowed("any.module", makeDescriptor(["destructive"]))).toBe(true);
    });

    it("should allow modules with no tags", () => {
      const guard = new AclGuard();
      expect(guard.isAllowed("any.module", makeDescriptor([]))).toBe(true);
    });

    it("check() should not throw when no config is provided", () => {
      const guard = new AclGuard();
      expect(() =>
        guard.check("any.module", makeDescriptor(["destructive"])),
      ).not.toThrow();
    });
  });

  // ─── Role: readonly ────────────────────────────────────────────
  describe('role: "readonly"', () => {
    const guard = new AclGuard({ role: "readonly" });

    it("should allow modules with 'query' tag", () => {
      expect(guard.isAllowed("tiptap.getContent", makeDescriptor(["query"]))).toBe(true);
    });

    it("should deny modules with 'format' tag", () => {
      expect(guard.isAllowed("tiptap.toggleBold", makeDescriptor(["format"]))).toBe(false);
    });

    it("should deny modules with 'content' tag", () => {
      expect(guard.isAllowed("tiptap.insertText", makeDescriptor(["content"]))).toBe(false);
    });

    it("should deny modules with 'destructive' tag", () => {
      expect(guard.isAllowed("tiptap.clearAll", makeDescriptor(["destructive"]))).toBe(false);
    });

    it("should deny modules with 'history' tag", () => {
      expect(guard.isAllowed("tiptap.undo", makeDescriptor(["history"]))).toBe(false);
    });

    it("should deny modules with 'selection' tag", () => {
      expect(guard.isAllowed("tiptap.selectAll", makeDescriptor(["selection"]))).toBe(false);
    });

    it("should allow if at least one tag matches (mixed tags)", () => {
      expect(guard.isAllowed("tiptap.mixed", makeDescriptor(["query", "format"]))).toBe(true);
    });

    it("should deny modules with no tags (no overlap with role tags)", () => {
      expect(guard.isAllowed("tiptap.noTags", makeDescriptor([]))).toBe(false);
    });
  });

  // ─── Role: editor ──────────────────────────────────────────────
  describe('role: "editor"', () => {
    const guard = new AclGuard({ role: "editor" });

    it("should allow modules with 'query' tag", () => {
      expect(guard.isAllowed("tiptap.getContent", makeDescriptor(["query"]))).toBe(true);
    });

    it("should allow modules with 'format' tag", () => {
      expect(guard.isAllowed("tiptap.toggleBold", makeDescriptor(["format"]))).toBe(true);
    });

    it("should allow modules with 'content' tag", () => {
      expect(guard.isAllowed("tiptap.insertText", makeDescriptor(["content"]))).toBe(true);
    });

    it("should allow modules with 'history' tag", () => {
      expect(guard.isAllowed("tiptap.undo", makeDescriptor(["history"]))).toBe(true);
    });

    it("should allow modules with 'selection' tag", () => {
      expect(guard.isAllowed("tiptap.selectAll", makeDescriptor(["selection"]))).toBe(true);
    });

    it("should deny modules with 'destructive' tag", () => {
      expect(guard.isAllowed("tiptap.clearAll", makeDescriptor(["destructive"]))).toBe(false);
    });

    it("should allow if at least one tag is permitted (mixed with destructive)", () => {
      expect(guard.isAllowed("tiptap.mixed", makeDescriptor(["destructive", "query"]))).toBe(true);
    });
  });

  // ─── Role: admin ───────────────────────────────────────────────
  describe('role: "admin"', () => {
    const guard = new AclGuard({ role: "admin" });

    it("should allow modules with 'query' tag", () => {
      expect(guard.isAllowed("tiptap.getContent", makeDescriptor(["query"]))).toBe(true);
    });

    it("should allow modules with 'format' tag", () => {
      expect(guard.isAllowed("tiptap.toggleBold", makeDescriptor(["format"]))).toBe(true);
    });

    it("should allow modules with 'content' tag", () => {
      expect(guard.isAllowed("tiptap.insertText", makeDescriptor(["content"]))).toBe(true);
    });

    it("should allow modules with 'destructive' tag", () => {
      expect(guard.isAllowed("tiptap.clearAll", makeDescriptor(["destructive"]))).toBe(true);
    });

    it("should allow modules with 'history' tag", () => {
      expect(guard.isAllowed("tiptap.undo", makeDescriptor(["history"]))).toBe(true);
    });

    it("should allow modules with 'selection' tag", () => {
      expect(guard.isAllowed("tiptap.selectAll", makeDescriptor(["selection"]))).toBe(true);
    });
  });

  // ─── denyModules precedence ────────────────────────────────────
  describe("denyModules precedence", () => {
    it("should deny a module even if role would allow it", () => {
      const guard = new AclGuard({
        role: "admin",
        denyModules: ["tiptap.dangerous"],
      });
      expect(guard.isAllowed("tiptap.dangerous", makeDescriptor(["query"]))).toBe(false);
    });

    it("should deny a module even if allowModules includes it", () => {
      const guard = new AclGuard({
        denyModules: ["tiptap.blocked"],
        allowModules: ["tiptap.blocked"],
      });
      expect(guard.isAllowed("tiptap.blocked", makeDescriptor(["query"]))).toBe(false);
    });

    it("should deny a module even if allowTags would allow it", () => {
      const guard = new AclGuard({
        denyModules: ["tiptap.blocked"],
        allowTags: ["query"],
      });
      expect(guard.isAllowed("tiptap.blocked", makeDescriptor(["query"]))).toBe(false);
    });
  });

  // ─── allowModules precedence ───────────────────────────────────
  describe("allowModules precedence", () => {
    it("should allow a module even if role would deny it", () => {
      const guard = new AclGuard({
        role: "readonly",
        allowModules: ["tiptap.specialFormat"],
      });
      expect(
        guard.isAllowed("tiptap.specialFormat", makeDescriptor(["format"])),
      ).toBe(true);
    });

    it("should allow a module even if denyTags would deny it", () => {
      const guard = new AclGuard({
        denyTags: ["destructive"],
        allowModules: ["tiptap.specialClear"],
      });
      expect(
        guard.isAllowed("tiptap.specialClear", makeDescriptor(["destructive"])),
      ).toBe(true);
    });

    it("C-5: should deny a module not in allowModules when allowModules is set (fail-closed)", () => {
      const guard = new AclGuard({
        allowModules: ["tiptap.allowed"],
      });
      // With C-5 fix: allowModules is an allow-list → unlisted modules are denied
      expect(guard.isAllowed("tiptap.other", makeDescriptor(["query"]))).toBe(false);
    });
  });

  // ─── denyTags precedence over allowTags ────────────────────────
  describe("denyTags precedence over allowTags", () => {
    it("should deny when a tag is in both denyTags and allowTags", () => {
      const guard = new AclGuard({
        denyTags: ["destructive"],
        allowTags: ["destructive", "query"],
      });
      expect(guard.isAllowed("tiptap.clear", makeDescriptor(["destructive"]))).toBe(false);
    });

    it("should allow when tag is only in allowTags", () => {
      const guard = new AclGuard({
        denyTags: ["destructive"],
        allowTags: ["query"],
      });
      expect(guard.isAllowed("tiptap.get", makeDescriptor(["query"]))).toBe(true);
    });

    it("should deny when tag overlaps denyTags even if other tags are in allowTags", () => {
      const guard = new AclGuard({
        denyTags: ["destructive"],
        allowTags: ["query"],
      });
      expect(
        guard.isAllowed("tiptap.mixed", makeDescriptor(["destructive", "query"])),
      ).toBe(false);
    });
  });

  // ─── check() throws TiptapModuleError ──────────────────────────
  describe("check() throws TiptapModuleError", () => {
    it("should throw TiptapModuleError with code ACL_DENIED", () => {
      const guard = new AclGuard({ role: "readonly" });
      try {
        guard.check("tiptap.toggleBold", makeDescriptor(["format"]));
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(TiptapModuleError);
        expect((err as TiptapModuleError).code).toBe(ErrorCodes.ACL_DENIED);
      }
    });

    it("should include moduleId in error message", () => {
      const guard = new AclGuard({ role: "readonly" });
      try {
        guard.check("tiptap.toggleBold", makeDescriptor(["format"]));
        expect.unreachable("should have thrown");
      } catch (err) {
        expect((err as TiptapModuleError).message).toContain("tiptap.toggleBold");
      }
    });

    it("H-7: error message should NOT contain role details", () => {
      const guard = new AclGuard({ role: "readonly" });
      try {
        guard.check("tiptap.toggleBold", makeDescriptor(["format"]));
        expect.unreachable("should have thrown");
      } catch (err) {
        // The stripped error message should NOT leak role
        expect((err as TiptapModuleError).message).not.toContain("readonly");
      }
    });
  });

  // ─── H-7: Error details stripped ───────────────────────────────
  describe("H-7: error details stripped of policy info", () => {
    it("should only include moduleId in details (no role, tags, reason)", () => {
      const guard = new AclGuard({ role: "readonly" });
      const descriptor = makeDescriptor(["format", "content"]);
      try {
        guard.check("tiptap.toggleBold", descriptor);
        expect.unreachable("should have thrown");
      } catch (err) {
        const details = (err as TiptapModuleError).details;
        expect(details).not.toBeNull();
        expect(details!.moduleId).toBe("tiptap.toggleBold");
        // These should NOT be present anymore
        expect(details!).not.toHaveProperty("role");
        expect(details!).not.toHaveProperty("tags");
        expect(details!).not.toHaveProperty("reason");
      }
    });

    it("should log denial reason via logger.warn when logger is provided", () => {
      const logger: Logger = { warn: vi.fn(), error: vi.fn() };
      const guard = new AclGuard({ role: "readonly" }, logger);
      try {
        guard.check("tiptap.toggleBold", makeDescriptor(["format"]));
        expect.unreachable("should have thrown");
      } catch {
        // Expected
      }
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        "ACL denied: tiptap.toggleBold",
        expect.objectContaining({ reason: expect.any(String) }),
      );
    });

    it("should not throw when logger is not provided", () => {
      const guard = new AclGuard({ denyModules: ["tiptap.blocked"] });
      expect(() =>
        guard.check("tiptap.blocked", makeDescriptor(["query"])),
      ).toThrow(TiptapModuleError);
    });
  });

  // ─── C-5: fail-closed when allow-lists present ─────────────────
  describe("C-5: fail-closed when allow-lists present", () => {
    it("should deny when allowModules is set and module is not in it (no role)", () => {
      const guard = new AclGuard({
        allowModules: ["tiptap.allowed"],
      });
      expect(guard.isAllowed("tiptap.other", makeDescriptor(["query"]))).toBe(false);
    });

    it("should deny when allowTags is set and module has no matching tag (no role)", () => {
      const guard = new AclGuard({ allowTags: ["query"] });
      // Tag doesn't match allowTags, no role → now denied (was permissive before)
      expect(guard.isAllowed("mod", makeDescriptor(["format"]))).toBe(false);
    });

    it("should still allow when allowTags matches", () => {
      const guard = new AclGuard({ allowTags: ["query"] });
      expect(guard.isAllowed("mod", makeDescriptor(["query"]))).toBe(true);
    });

    it("should allow everything when no allow-list and no role", () => {
      // Empty config (just denyTags empty, etc.) still permissive
      const guard = new AclGuard({});
      expect(guard.isAllowed("any.module", makeDescriptor(["destructive"]))).toBe(true);
    });
  });

  // ─── isAllowed() returns boolean without throwing ──────────────
  describe("isAllowed() returns boolean without throwing", () => {
    it("should return true for allowed access", () => {
      const guard = new AclGuard({ role: "admin" });
      const result = guard.isAllowed("tiptap.get", makeDescriptor(["query"]));
      expect(result).toBe(true);
    });

    it("should return false for denied access", () => {
      const guard = new AclGuard({ role: "readonly" });
      const result = guard.isAllowed("tiptap.format", makeDescriptor(["format"]));
      expect(result).toBe(false);
    });

    it("should never throw", () => {
      const guard = new AclGuard({ role: "readonly" });
      expect(() =>
        guard.isAllowed("tiptap.format", makeDescriptor(["destructive"])),
      ).not.toThrow();
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────
  describe("edge cases", () => {
    it("should handle empty config object (permissive default)", () => {
      const guard = new AclGuard({});
      expect(guard.isAllowed("any.module", makeDescriptor(["destructive"]))).toBe(true);
    });

    it("should handle empty denyModules array", () => {
      const guard = new AclGuard({ denyModules: [] });
      expect(guard.isAllowed("any.module", makeDescriptor(["query"]))).toBe(true);
    });

    it("should handle empty allowModules array", () => {
      const guard = new AclGuard({ allowModules: [] });
      expect(guard.isAllowed("any.module", makeDescriptor(["query"]))).toBe(true);
    });

    it("should handle empty denyTags array", () => {
      const guard = new AclGuard({ denyTags: [] });
      expect(guard.isAllowed("any.module", makeDescriptor(["query"]))).toBe(true);
    });

    it("should handle empty allowTags array", () => {
      const guard = new AclGuard({ allowTags: [] });
      expect(guard.isAllowed("any.module", makeDescriptor(["query"]))).toBe(true);
    });

    it("should handle module with multiple tags where some are allowed and some denied by role", () => {
      const guard = new AclGuard({ role: "editor" });
      // "format" is allowed, "destructive" is not — but one match is enough
      expect(
        guard.isAllowed("tiptap.mixed", makeDescriptor(["format", "destructive"])),
      ).toBe(true);
    });

    it("should handle allowModules with denyTags interaction", () => {
      // Module is explicitly allowed by allowModules, even though its tags are denied
      const guard = new AclGuard({
        allowModules: ["tiptap.special"],
        denyTags: ["destructive"],
      });
      expect(
        guard.isAllowed("tiptap.special", makeDescriptor(["destructive"])),
      ).toBe(true);
    });

    it("should handle config with only denyTags and no role", () => {
      const guard = new AclGuard({ denyTags: ["destructive"] });
      expect(guard.isAllowed("mod", makeDescriptor(["destructive"]))).toBe(false);
      expect(guard.isAllowed("mod", makeDescriptor(["query"]))).toBe(true);
    });
  });

  // ─── Combined configurations ───────────────────────────────────
  describe("combined configurations", () => {
    it("full config: denyModules > allowModules > denyTags > allowTags > role", () => {
      const guard = new AclGuard({
        role: "editor",
        denyModules: ["tiptap.forbidden"],
        allowModules: ["tiptap.special"],
        denyTags: ["dangerous"],
        allowTags: ["safe"],
      });

      // Step 1: denyModules
      expect(guard.isAllowed("tiptap.forbidden", makeDescriptor(["query"]))).toBe(false);

      // Step 2: allowModules
      expect(guard.isAllowed("tiptap.special", makeDescriptor(["dangerous"]))).toBe(true);

      // Step 3: denyTags
      expect(guard.isAllowed("tiptap.other", makeDescriptor(["dangerous"]))).toBe(false);

      // Step 4: allowTags
      expect(guard.isAllowed("tiptap.safe", makeDescriptor(["safe"]))).toBe(true);

      // Step 5: role (editor allows format)
      expect(guard.isAllowed("tiptap.format", makeDescriptor(["format"]))).toBe(true);

      // Step 5: role (editor denies destructive)
      expect(guard.isAllowed("tiptap.destroy", makeDescriptor(["destructive"]))).toBe(false);
    });
  });

  // ─── getDenialReason edge cases (via logger) ───────────────────
  describe("getDenialReason edge cases (via logger)", () => {
    it("should report unknown role reason for unrecognized role", () => {
      const logger: Logger = { warn: vi.fn(), error: vi.fn() };
      const guard = new AclGuard({ role: "superuser" as "admin" }, logger);
      try {
        guard.check("tiptap.mod", makeDescriptor(["query"]));
        expect.unreachable("should have thrown");
      } catch {
        // Expected
      }
      const reason = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][1].reason as string;
      expect(reason).toContain("Unknown role");
      expect(reason).toContain("superuser");
    });

    it("should report role denial reason", () => {
      const logger: Logger = { warn: vi.fn(), error: vi.fn() };
      const guard = new AclGuard({ role: "readonly" }, logger);
      try {
        guard.check("tiptap.format", makeDescriptor(["format"]));
        expect.unreachable("should have thrown");
      } catch {
        // Expected
      }
      const reason = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][1].reason as string;
      expect(reason).toContain("readonly");
    });

    it("should report denyModules reason via logger", () => {
      const logger: Logger = { warn: vi.fn(), error: vi.fn() };
      const guard = new AclGuard({ role: "admin", denyModules: ["tiptap.blocked"] }, logger);
      try {
        guard.check("tiptap.blocked", makeDescriptor(["query"]));
        expect.unreachable("should have thrown");
      } catch {
        // Expected
      }
      const reason = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][1].reason as string;
      expect(reason).toContain("denyModules");
    });

    it("should report denyTags reason via logger", () => {
      const logger: Logger = { warn: vi.fn(), error: vi.fn() };
      const guard = new AclGuard({ denyTags: ["destructive"] }, logger);
      try {
        guard.check("tiptap.clear", makeDescriptor(["destructive"]));
        expect.unreachable("should have thrown");
      } catch {
        // Expected
      }
      const reason = (logger.warn as ReturnType<typeof vi.fn>).mock.calls[0][1].reason as string;
      expect(reason).toContain("denyTags");
    });
  });
});
