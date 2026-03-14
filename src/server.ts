/**
 * tiptap-apcore/server — Server-only entry point.
 *
 * Import from "tiptap-apcore/server" for Node.js runtime functions
 * that should not be bundled in browser builds.
 */

export { serve, asyncServe, toOpenaiTools, resolveRegistry, resolveExecutor } from "apcore-mcp";
export type {
  ServeOptions,
  AsyncServeOptions,
  AsyncServeApp,
  ToOpenaiToolsOptions,
  RegistryOrExecutor,
  OpenAIToolDef,
} from "apcore-mcp";
