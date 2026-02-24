/**
 * TiptapModuleError - structured error class for tiptap-apcore.
 */

export class TiptapModuleError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | null;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ModuleError";
    this.code = code;
    this.details = details ?? null;
  }
}

export const ErrorCodes = {
  MODULE_NOT_FOUND: "MODULE_NOT_FOUND",
  COMMAND_NOT_FOUND: "COMMAND_NOT_FOUND",
  SCHEMA_VALIDATION_ERROR: "SCHEMA_VALIDATION_ERROR",
  ACL_DENIED: "ACL_DENIED",
  EDITOR_NOT_READY: "EDITOR_NOT_READY",
  COMMAND_FAILED: "COMMAND_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
