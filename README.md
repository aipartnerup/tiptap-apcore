# tiptap-apcore

Let AI safely control your TipTap editor via the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) and OpenAI Function Calling.

**tiptap-apcore** wraps every TipTap editor command as a schema-driven [APCore](https://github.com/aipartnerup) module — complete with JSON Schema validation, safety annotations, and fine-grained access control. Any MCP-compatible AI agent can then discover and invoke these modules to read, format, insert, or restructure rich-text content.

## Features

- **79 built-in commands** across 7 categories (query, format, content, destructive, selection, history, unknown)
- **Automatic extension discovery** — scans TipTap extensions at runtime, no manual wiring
- **MCP Server** in one line — `serve(executor)` exposes all commands via stdio / HTTP / SSE
- **OpenAI Function Calling** — `toOpenaiTools(executor)` exports tool definitions for GPT
- **Role-based ACL** — `readonly`, `editor`, `admin` roles with tag-level and module-level overrides
- **Safety annotations** — every command tagged `readonly`, `destructive`, `idempotent`, `requiresApproval`, `openWorld`, `streaming`
- **Strict JSON Schemas** — `inputSchema` + `outputSchema` with `additionalProperties: false` for all known commands
- **Dynamic re-discovery** — call `registry.discover()` to pick up extensions added at runtime
- **925 tests**, 99.7% statement coverage

## Installation

```bash
npm install tiptap-apcore apcore-js apcore-mcp @tiptap/core
```

`apcore-js`, `apcore-mcp`, and `@tiptap/core` are peer dependencies.

## Quick Start

```typescript
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { withApcore, serve, toOpenaiTools } from "tiptap-apcore";

// 1. Create a TipTap editor
const editor = new Editor({
  extensions: [StarterKit],
  content: "<p>Hello world</p>",
});

// 2. Create APCore registry + executor
const { registry, executor } = withApcore(editor, {
  acl: { role: "editor" },   // no destructive ops
});

// 3a. Launch an MCP Server (stdio)
await serve(executor);

// 3b. Or export OpenAI tool definitions
const tools = toOpenaiTools(executor);

// 3c. Or call commands directly
await executor.call("tiptap.format.toggleBold", {});
const { html } = await executor.call("tiptap.query.getHTML", {});
```

## Commands

All commands follow the module ID pattern `{prefix}.{category}.{commandName}`.

### Query (10 commands) — `readonly`, `idempotent`

| Command | Input | Output |
|---------|-------|--------|
| `getHTML` | — | `{ html: string }` |
| `getJSON` | — | `{ json: object }` |
| `getText` | `{ blockSeparator?: string }` | `{ text: string }` |
| `isActive` | `{ name: string, attrs?: object }` | `{ active: boolean }` |
| `getAttributes` | `{ typeOrName: string }` | `{ attributes: object }` |
| `isEmpty` | — | `{ value: boolean }` |
| `isEditable` | — | `{ value: boolean }` |
| `isFocused` | — | `{ value: boolean }` |
| `getCharacterCount` | — | `{ count: number }` |
| `getWordCount` | — | `{ count: number }` |

### Format (36 commands) — non-destructive

`toggleBold`, `toggleItalic`, `toggleStrike`, `toggleCode`, `toggleUnderline`, `toggleSubscript`, `toggleSuperscript`, `toggleHighlight`, `toggleHeading`, `toggleBulletList`, `toggleOrderedList`, `toggleTaskList`, `toggleCodeBlock`, `toggleBlockquote`, `setTextAlign`, `setMark`, `unsetMark`, `unsetAllMarks`, `clearNodes`, `updateAttributes`, `setLink`, `unsetLink`, `setHardBreak`, `setHorizontalRule`, `setBold`, `setItalic`, `setStrike`, `setCode`, `unsetBold`, `unsetItalic`, `unsetStrike`, `unsetCode`, `setBlockquote`, `unsetBlockquote`, `setHeading`, `setParagraph`

### Content (15 commands)

`insertContent`, `insertContentAt`, `setNode`, `splitBlock`, `liftListItem`, `sinkListItem`, `wrapIn`, `joinBackward`, `joinForward`, `lift`, `splitListItem`, `wrapInList`, `toggleList`, `exitCode`, `deleteNode`

### Destructive (6 commands) — `requiresApproval`

`clearContent`, `setContent`, `deleteSelection`, `deleteRange`, `deleteCurrentNode`, `cut`

### Selection (10 commands) — `idempotent`

`setTextSelection`, `setNodeSelection`, `selectAll`, `selectParentNode`, `selectTextblockStart`, `selectTextblockEnd`, `selectText`, `focus`, `blur`, `scrollIntoView`

### History (2 commands)

`undo`, `redo`

### Unknown

Commands discovered from extensions but not in the built-in catalog. Excluded by default (`includeUnsafe: false`). Set `includeUnsafe: true` to include them with permissive schemas.

## Access Control (ACL)

```typescript
// Read-only: only query commands
withApcore(editor, { acl: { role: "readonly" } });

// Editor: query + format + content + history + selection
withApcore(editor, { acl: { role: "editor" } });

// Admin: everything including destructive
withApcore(editor, { acl: { role: "admin" } });

// Custom: readonly base + allow format tag
withApcore(editor, { acl: { role: "readonly", allowTags: ["format"] } });

// Custom: admin but deny destructive tag
withApcore(editor, { acl: { role: "admin", denyTags: ["destructive"] } });

// Module-level: deny specific commands
withApcore(editor, {
  acl: { role: "admin", denyModules: ["tiptap.destructive.clearContent"] },
});
```

**Precedence:** `denyModules` > `allowModules` > `denyTags` > `allowTags` > role

> **Note:** `allowModules` is additive — it grants access to listed modules but does not deny unlisted ones. Combine with a role to restrict the baseline.

## MCP Server

```typescript
import { withApcore, serve } from "tiptap-apcore";

const { executor } = withApcore(editor);

// stdio (default)
await serve(executor);

// HTTP streaming
await serve(executor, {
  transport: "streamable-http",
  host: "127.0.0.1",
  port: 8000,
});

// Server-Sent Events
await serve(executor, { transport: "sse", port: 3000 });
```

## OpenAI Function Calling

```typescript
import { withApcore, toOpenaiTools } from "tiptap-apcore";

const { executor } = withApcore(editor);
const tools = toOpenaiTools(executor);

// Use with OpenAI API
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [...],
  tools,
});
```

## Vercel AI SDK

APCore's JSON schemas work directly with AI SDK's `jsonSchema()` — no Zod conversion needed. Combined with `generateText({ maxSteps })`, the tool-use loop is fully automatic.

```typescript
import { generateText, tool, jsonSchema } from "ai";
import { openai } from "@ai-sdk/openai";
import { withApcore } from "tiptap-apcore";

const { registry, executor } = withApcore(editor, { acl: { role: "editor" } });

// Convert APCore modules to AI SDK tools
const tools: Record<string, CoreTool> = {};
for (const id of registry.list()) {
  const def = registry.getDefinition(id)!;
  tools[id.replaceAll(".", "-")] = tool({
    description: def.description,
    parameters: jsonSchema(def.inputSchema),
    execute: (args) => executor.call(id, args),
  });
}

const { text, steps } = await generateText({
  model: openai("gpt-4o"),
  system: "You are an editor assistant...",
  messages,
  tools,
  maxSteps: 10,
});
```

## API Reference

### `withApcore(editor, options?)`

Creates an APCore `{ registry, executor }` pair from a TipTap editor.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | `"tiptap"` | Module ID prefix (lowercase alphanumeric) |
| `acl` | `AclConfig` | `undefined` | Access control configuration (permissive if omitted) |
| `includeUnsafe` | `boolean` | `false` | Include commands not in the built-in catalog |

### Registry Methods

| Method | Description |
|--------|-------------|
| `list(options?)` | List module IDs, optionally filtered by `tags` (OR) and/or `prefix` |
| `getDefinition(moduleId)` | Get full `ModuleDescriptor` or `null` |
| `has(moduleId)` | Check if a module exists |
| `iter()` | Iterate `[moduleId, descriptor]` pairs |
| `count` | Number of registered modules |
| `moduleIds` | Array of all module IDs |
| `on(event, callback)` | Listen for `"register"` / `"unregister"` events |
| `discover()` | Re-scan extensions and update registry |

### Executor Methods

| Method | Description |
|--------|-------------|
| `call(moduleId, inputs)` | Execute a module (async) |
| `callAsync(moduleId, inputs)` | Alias for `call()` |

### Error Codes

| Code | Description |
|------|-------------|
| `MODULE_NOT_FOUND` | Module ID not registered |
| `COMMAND_NOT_FOUND` | Command not available on editor |
| `ACL_DENIED` | Access denied by ACL policy |
| `EDITOR_NOT_READY` | Editor is destroyed |
| `COMMAND_FAILED` | TipTap command returned false |
| `SCHEMA_VALIDATION_ERROR` | Invalid options (bad prefix, bad role) |
| `INTERNAL_ERROR` | Unexpected error |

## Comparison with TipTap AI Toolkit

TipTap's official AI solution is the **[AI Toolkit](https://tiptap.dev/docs/ai-toolkit/getting-started/overview)** (`@tiptap-pro/ai-toolkit`), a paid extension for client-side AI-powered editing. The two projects serve different use cases and are complementary.

### Architecture

| | TipTap AI Toolkit | tiptap-apcore |
|---|---|---|
| **Type** | Client-side TipTap extension | Server-side / headless adapter |
| **License** | Proprietary (TipTap Pro subscription) | Apache-2.0 (open source) |
| **Runtime** | Browser only | Browser + Node.js + headless |
| **Protocol** | Provider-specific adapters | MCP standard + OpenAI Function Calling |
| **Approach** | AI generates content, streams into editor | AI invokes structured commands on editor |

### Command Granularity

| | TipTap AI Toolkit | tiptap-apcore |
|---|---|---|
| **Tools exposed** | 5 coarse tools | 79+ fine-grained commands |
| **Read** | `tiptapRead`, `tiptapReadSelection` | `getHTML`, `getJSON`, `getText`, `isActive`, `getAttributes`, `isEmpty`, `isEditable`, `isFocused`, `getCharacterCount`, `getWordCount` |
| **Write** | `tiptapEdit` (accepts operations array) | Individual commands: `toggleBold`, `insertContent`, `setNode`, `wrapIn`, ... |
| **Comments** | `getThreads`, `editThreads` | Not supported |
| **Schemas** | Tool parameters with descriptions | Strict JSON Schema per command (`additionalProperties: false`) |

The AI Toolkit bundles all editing into a single `tiptapEdit` tool that accepts an array of operations. tiptap-apcore exposes each operation as a standalone tool with its own schema — this gives the LLM more precise tool selection and lower token usage per call.

### Security

| | TipTap AI Toolkit | tiptap-apcore |
|---|---|---|
| **Access control** | None built-in | 3 roles + tag/module allow/deny lists |
| **Safety annotations** | None | `readonly`, `destructive`, `idempotent`, `requiresApproval`, `openWorld`, `streaming` per command |
| **Approval workflow** | Review mode (accept/reject UI) | `requiresApproval` annotation for MCP clients |
| **Input validation** | Basic parameter types | Strict JSON Schema with `additionalProperties: false` |

### Protocol Support

| | TipTap AI Toolkit | tiptap-apcore |
|---|---|---|
| **MCP** | Not supported | stdio, streamable-http, SSE |
| **OpenAI** | Via adapter (`@tiptap-pro/ai-adapter-openai`) | `toOpenaiTools()` one-liner |
| **Anthropic** | Via adapter (`@tiptap-pro/ai-adapter-anthropic`) | Via MCP (any MCP client) |
| **Vercel AI SDK** | Via adapter | Direct (`generateText` + `tool` + `jsonSchema`) or via MCP |
| **Custom agents** | Adapter required per provider | Any MCP-compatible agent works |

### AI Content Generation

| | TipTap AI Toolkit | tiptap-apcore |
|---|---|---|
| **Streaming output** | `streamText()`, `streamHtml()` | Not yet supported |
| **Review mode** | Accept / Reject UI | Not supported (planned) |
| **Content generation** | Built-in (prompts → editor) | Delegated to LLM (tool use → commands) |

The AI Toolkit streams LLM-generated content directly into the editor with a review UI. tiptap-apcore takes a different approach: the LLM decides *which commands* to call, and the executor applies them. Content generation is the LLM's responsibility, not the editor's.

### Server-Side & Headless

| | TipTap AI Toolkit | tiptap-apcore |
|---|---|---|
| **Headless mode** | Not supported | Full support |
| **Batch processing** | Not possible | Process multiple documents programmatically |
| **CI/CD pipelines** | Not applicable | Can validate, transform, or test content |
| **Multi-tenant** | One editor per user | One executor per editor, server-side isolation |

### When to Use Which

**Use TipTap AI Toolkit when:**
- You need real-time streaming of AI-generated content into the editor
- You want a built-in accept/reject review UI
- You're building a client-side-only application
- You need comment thread management with AI

**Use tiptap-apcore when:**
- You want any MCP-compatible agent to control the editor
- You need fine-grained access control (roles, tag/module blocking)
- You're running headless / server-side (batch processing, CI/CD)
- You want strict schema validation and safety annotations
- You need to support multiple AI providers without per-provider adapters
- You want open-source with no licensing fees

**Use both when:**
- You want streaming AI content generation (AI Toolkit) AND structured command control (tiptap-apcore) in the same application
- You want client-side AI chat + server-side AI automation on the same editor

## AI Capabilities

### Supported (79 commands)

tiptap-apcore exposes 79 built-in commands that an AI agent can invoke:

| Category | Count | Commands |
|----------|-------|----------|
| **Query** | 10 | `getHTML`, `getJSON`, `getText`, `isActive`, `getAttributes`, `isEmpty`, `isEditable`, `isFocused`, `getCharacterCount`, `getWordCount` |
| **Format** | 36 | Toggle: `toggleBold`, `toggleItalic`, `toggleStrike`, `toggleCode`, `toggleUnderline`, `toggleSubscript`, `toggleSuperscript`, `toggleHighlight`, `toggleHeading`, `toggleBulletList`, `toggleOrderedList`, `toggleTaskList`, `toggleCodeBlock`, `toggleBlockquote`. Set/Unset: `setBold`, `setItalic`, `setStrike`, `setCode`, `unsetBold`, `unsetItalic`, `unsetStrike`, `unsetCode`, `setBlockquote`, `unsetBlockquote`, `setHeading`, `setParagraph`. Other: `setTextAlign`, `setMark`, `unsetMark`, `unsetAllMarks`, `clearNodes`, `updateAttributes`, `setLink`, `unsetLink`, `setHardBreak`, `setHorizontalRule` |
| **Content** | 15 | `insertContent`, `insertContentAt`, `setNode`, `splitBlock`, `liftListItem`, `sinkListItem`, `wrapIn`, `joinBackward`, `joinForward`, `lift`, `splitListItem`, `wrapInList`, `toggleList`, `exitCode`, `deleteNode` |
| **Destructive** | 6 | `clearContent`, `setContent`, `deleteSelection`, `deleteRange`, `deleteCurrentNode`, `cut` |
| **Selection** | 10 | `setTextSelection`, `setNodeSelection`, `selectAll`, `selectParentNode`, `selectTextblockStart`, `selectTextblockEnd`, `selectText`, `focus`, `blur`, `scrollIntoView` |
| **History** | 2 | `undo`, `redo` |

The `selectText` command enables semantic text selection — the AI can select text by content rather than by position, which is more natural for LLM-driven editing.

### Not Supported

| Feature | Reason |
|---------|--------|
| Clipboard operations (`copy`, `paste`) | Requires browser Clipboard API — not available in headless / server-side |
| Drag and drop | Requires browser DOM events |
| IME / composition events | Requires browser input events |
| Real-time collaboration (Yjs/Hocuspocus) | Collaboration is handled at the transport layer, not the command layer |
| Streaming content generation | Content generation is delegated to the LLM; the executor applies discrete commands |
| Comment threads | Not part of core TipTap — requires `@tiptap-pro` extensions |

## Architecture

### tiptap-apcore vs apcore-mcp

**tiptap-apcore** is the TipTap adapter that wraps editor commands as APCore modules. **apcore-mcp** is the protocol layer that exposes those modules to AI agents via MCP or OpenAI Function Calling.

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  TipTap Editor   │────▶│  tiptap-apcore   │────▶│  apcore-mcp  │
│  (@tiptap/core)  │     │  (this package)  │     │  (protocol)  │
└──────────────────┘     └──────────────────┘     └──────────────┘
                          Registry + Executor       MCP / OpenAI
```

**tiptap-apcore provides:**
- Extension discovery (`ExtensionScanner`)
- Module building (`ModuleBuilder` + `AnnotationCatalog` + `SchemaCatalog`)
- Command execution (`TiptapExecutor`)
- Access control (`AclGuard`)

**apcore-mcp provides:**
- `serve(executor)` — Launch an MCP server (stdio / HTTP / SSE)
- `toOpenaiTools(executor)` — Export OpenAI Function Calling tool definitions
- `resolveRegistry(executor)` — Access the registry from an executor
- `resolveExecutor(registry)` — Create an executor from a registry
- Types and constants for the APCore protocol

## Demo

The `demo/` directory contains a full-stack example: a React + Vite frontend with a TipTap editor, and an Express backend that uses the [Vercel AI SDK](https://ai-sdk.dev/) to let any LLM edit the document via APCore tools.

```bash
cd demo/server && npm install && npm run dev   # Terminal 1
cd demo && npm install && npm run dev           # Terminal 2
```

Set `LLM_MODEL` (e.g. `openai:gpt-4o`, `anthropic:claude-sonnet-4-5`) in `demo/.env`. See [`demo/README.md`](demo/README.md) for details.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## License

Apache-2.0
