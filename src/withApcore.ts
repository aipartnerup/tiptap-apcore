/**
 * withApcore - Factory function that creates a TiptapAPCore instance.
 *
 * This function is kept for backward compatibility and as a shortcut
 * for simple integrations.
 */

import type { ApcoreOptions, ApcoreResult, EditorLike } from "./types.js";
import { TiptapAPCore } from "./runtime/TiptapAPCore.js";

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
  const instance = new TiptapAPCore(editor, options);
  return {
    registry: instance.registry,
    executor: instance.executor,
  };
}
