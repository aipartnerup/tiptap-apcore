/**
 * withApcore - Factory function that creates an APCore Registry + Executor
 * from a TipTap editor instance.
 */

import type { ApcoreOptions, ApcoreResult, EditorLike } from "./types.js";
import { ExtensionScanner } from "./discovery/index.js";
import { ModuleBuilder } from "./builder/index.js";
import { TiptapRegistry } from "./runtime/TiptapRegistry.js";
import { TiptapExecutor } from "./runtime/TiptapExecutor.js";
import { AclGuard } from "./security/index.js";
import { TiptapModuleError, ErrorCodes } from "./errors/index.js";

const PREFIX_PATTERN = /^[a-z][a-z0-9]*$/;

/**
 * Create an APCore Registry + Executor from a TipTap editor instance.
 *
 * @param editor - A TipTap Editor instance (must not be destroyed)
 * @param options - Configuration options (ACL, prefix, includeUnsafe)
 * @returns { registry, executor } pair compatible with apcore-mcp SDK
 */
export function withApcore(
  editor: EditorLike,
  options?: ApcoreOptions,
): ApcoreResult {
  // Validate editor
  if (editor == null) {
    throw new TypeError("editor must be a valid TipTap Editor instance");
  }

  if (editor.isDestroyed) {
    throw new TiptapModuleError(
      ErrorCodes.EDITOR_NOT_READY,
      "Editor is not ready",
      { editorDestroyed: true },
    );
  }

  // Validate options
  const prefix = options?.prefix ?? "tiptap";
  if (!PREFIX_PATTERN.test(prefix)) {
    throw new TiptapModuleError(
      ErrorCodes.SCHEMA_VALIDATION_ERROR,
      `Invalid prefix '${prefix}': must match /^[a-z][a-z0-9]*$/`,
      { field: "prefix", value: prefix },
    );
  }

  const validRoles = ["readonly", "editor", "admin"];
  if (options?.acl?.role && !validRoles.includes(options.acl.role)) {
    throw new TiptapModuleError(
      ErrorCodes.SCHEMA_VALIDATION_ERROR,
      `Invalid ACL role '${options.acl.role}': must be one of ${validRoles.join(", ")}`,
      { field: "acl.role", value: options.acl.role },
    );
  }

  // C-2: Default includeUnsafe to false
  const includeUnsafe = options?.includeUnsafe ?? false;
  const logger = options?.logger;

  // 1. Scan extensions (H-11 + H-12: wire logger)
  const scanner = new ExtensionScanner(logger);
  const extensionMap = scanner.scan(editor);

  // 2. Build module descriptors
  const builder = new ModuleBuilder(prefix);
  const registry = new TiptapRegistry();

  for (const [, extensionInfo] of extensionMap) {
    for (const commandName of extensionInfo.commandNames) {
      const descriptor = builder.build(commandName, extensionInfo);

      // Skip unknown commands if includeUnsafe is false
      if (!includeUnsafe && descriptor.tags?.includes("unknown")) {
        continue;
      }

      registry.register(descriptor);
    }
  }

  // 3. Create executor with ACL (H-7 + H-11: wire logger to AclGuard; H-1: wire sanitizeHtml)
  const aclGuard = new AclGuard(options?.acl, logger);
  const executor = new TiptapExecutor(editor, registry, aclGuard, options?.sanitizeHtml);

  // 4. H-5: Diff-based discover — only emit register/unregister for changed modules
  registry.setScanFunction(() => {
    const newExtensionMap = scanner.scan(editor);
    const newIds = new Set<string>();

    // Register new/updated
    for (const [, extInfo] of newExtensionMap) {
      for (const cmdName of extInfo.commandNames) {
        const desc = builder.build(cmdName, extInfo);
        if (!includeUnsafe && desc.tags?.includes("unknown")) continue;
        newIds.add(desc.moduleId);
        registry.register(desc);
      }
    }

    // Unregister removed
    for (const oldId of registry.list()) {
      if (!newIds.has(oldId)) registry.unregister(oldId);
    }

    return newIds.size;
  });

  return { registry, executor };
}
