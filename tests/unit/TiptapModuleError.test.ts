import { describe, it, expect } from "vitest";
import { TiptapModuleError, ErrorCodes } from "../../src/errors/index.js";

describe("TiptapModuleError", () => {
  it("should have name 'ModuleError' for SDK compatibility", () => {
    const err = new TiptapModuleError("TEST", "test message");
    expect(err.name).toBe("ModuleError");
  });

  it("should store code and message", () => {
    const err = new TiptapModuleError("ACL_DENIED", "Access denied");
    expect(err.code).toBe("ACL_DENIED");
    expect(err.message).toBe("Access denied");
  });

  it("should store details when provided", () => {
    const details = { module_id: "tiptap.format.toggleBold", role: "readonly" };
    const err = new TiptapModuleError("ACL_DENIED", "Access denied", details);
    expect(err.details).toEqual(details);
  });

  it("should default details to null when not provided", () => {
    const err = new TiptapModuleError("TEST", "test");
    expect(err.details).toBeNull();
  });

  it("should be an instance of Error", () => {
    const err = new TiptapModuleError("TEST", "test");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("ErrorCodes", () => {
  it("should define all 7 error codes", () => {
    expect(ErrorCodes.MODULE_NOT_FOUND).toBe("MODULE_NOT_FOUND");
    expect(ErrorCodes.COMMAND_NOT_FOUND).toBe("COMMAND_NOT_FOUND");
    expect(ErrorCodes.SCHEMA_VALIDATION_ERROR).toBe("SCHEMA_VALIDATION_ERROR");
    expect(ErrorCodes.ACL_DENIED).toBe("ACL_DENIED");
    expect(ErrorCodes.EDITOR_NOT_READY).toBe("EDITOR_NOT_READY");
    expect(ErrorCodes.COMMAND_FAILED).toBe("COMMAND_FAILED");
    expect(ErrorCodes.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
  });
});
