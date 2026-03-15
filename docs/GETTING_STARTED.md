# Getting Started with tiptap-apcore

This guide walks you through integrating `tiptap-apcore` into your application to let AI agents safely control your TipTap editor.

## Installation

```bash
# Using npm
npm install tiptap-apcore apcore-js apcore-mcp @tiptap/core @tiptap/starter-kit

# Using pnpm
pnpm add tiptap-apcore apcore-js apcore-mcp @tiptap/core @tiptap/starter-kit
```

> `apcore-js`, `apcore-mcp`, and `@tiptap/core` are peer dependencies and must be installed alongside `tiptap-apcore`.

## Basic Integration (React)

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TiptapAPCore } from 'tiptap-apcore';

export const MyEditor = () => {
  const apcoreRef = useRef<TiptapAPCore | null>(null);
  const [role, setRole] = useState<'readonly' | 'editor' | 'admin'>('editor');

  const editor = useEditor({
    extensions: [StarterKit],
    content: '<p>Hello world!</p>',
  });

  useEffect(() => {
    if (!editor) return;

    if (!apcoreRef.current) {
      // Initialize once
      apcoreRef.current = new TiptapAPCore(editor, {
        acl: { role },
      });
    } else {
      // Update ACL dynamically — no need to recreate
      apcoreRef.current.setAcl({ role });
    }
  }, [editor, role]);

  return (
    <div>
      <select value={role} onChange={(e) => setRole(e.target.value as any)}>
        <option value="readonly">Readonly</option>
        <option value="editor">Editor</option>
        <option value="admin">Admin</option>
      </select>
      <EditorContent editor={editor} />
    </div>
  );
};
```

## Basic Integration (Vanilla JS / Vue / Node.js)

```typescript
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TiptapAPCore } from 'tiptap-apcore';

const editor = new Editor({
  extensions: [StarterKit],
  content: '<p>Hello world</p>',
});

const apcore = new TiptapAPCore(editor, {
  acl: { role: 'editor' },
});

// Call commands
await apcore.call('tiptap.format.toggleBold', {});
const { html } = await apcore.call('tiptap.query.getHTML', {});

// List available modules
console.log(apcore.list()); // ['tiptap.query.getHTML', 'tiptap.format.toggleBold', ...]

// Get a module definition
const def = apcore.getDefinition('tiptap.format.toggleBold');
console.log(def?.description, def?.tags, def?.annotations);
```

## Using `withApcore` (shortcut)

If you don't need dynamic ACL or the convenience methods, the factory function returns a plain `{ registry, executor }` pair:

```typescript
import { withApcore } from 'tiptap-apcore';

const { registry, executor } = withApcore(editor, {
  acl: { role: 'editor' },
});

await executor.call('tiptap.format.toggleBold', {});
```

## Understanding ACL Roles

`tiptap-apcore` provides three built-in roles to control AI access:

| Role | Permitted Tags | Use Case |
|------|----------------|----------|
| `readonly` | `query` | AI just needs context, no changes allowed. |
| `editor` | `query`, `format`, `content`, `history`, `selection` | AI can format, insert, and undo, but cannot delete the entire document. |
| `admin` | `query`, `format`, `content`, `destructive`, `history`, `selection` | AI has full control over the editor. |

### Fine-grained Control

You can combine a role with explicit allow/deny lists:

```typescript
const apcore = new TiptapAPCore(editor, {
  acl: {
    role: 'editor',
    denyModules: ['tiptap.content.insertContent'],  // Block a specific command
    allowTags: ['custom_tag'],                       // Allow custom tagged commands
  }
});
```

**Precedence:** `denyModules` > `allowModules` > `denyTags` > `allowTags` > `role`

### Dynamic ACL Updates

Switch roles at runtime without recreating the instance:

```typescript
// Start as readonly
const apcore = new TiptapAPCore(editor, { acl: { role: 'readonly' } });

// User clicks "Enable editing"
apcore.setAcl({ role: 'editor' });

// User clicks "Admin mode"
apcore.setAcl({ role: 'admin' });
```

## Exposing to AI

### MCP Server (Node.js)

Import server functions from the `tiptap-apcore/server` subpath:

```typescript
import { TiptapAPCore } from 'tiptap-apcore';
import { serve } from 'tiptap-apcore/server';

const editor = new Editor({ extensions: [StarterKit] });
const apcore = new TiptapAPCore(editor);

// stdio (default — for MCP clients like Claude Desktop)
await serve(apcore.executor);

// HTTP streaming
await serve(apcore.executor, {
  transport: 'streamable-http',
  host: '127.0.0.1',
  port: 8000,
});

// Server-Sent Events
await serve(apcore.executor, { transport: 'sse', port: 3000 });
```

### OpenAI Function Calling

```typescript
import { TiptapAPCore } from 'tiptap-apcore';
import { toOpenaiTools } from 'tiptap-apcore/server';

const apcore = new TiptapAPCore(editor);
const tools = toOpenaiTools(apcore.executor);

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [...],
  tools,
});
```

### Vercel AI SDK

APCore's JSON schemas work directly with AI SDK's `jsonSchema()` — no Zod conversion needed:

```typescript
import { generateText, tool, jsonSchema } from 'ai';
import { openai } from '@ai-sdk/openai';
import { TiptapAPCore } from 'tiptap-apcore';

const apcore = new TiptapAPCore(editor, { acl: { role: 'editor' } });

// Convert APCore modules to AI SDK tools
const tools: Record<string, CoreTool> = {};
for (const id of apcore.list()) {
  const def = apcore.getDefinition(id)!;
  tools[id.replaceAll('.', '--')] = tool({
    description: def.description,
    parameters: jsonSchema(def.inputSchema),
    execute: (args) => apcore.call(id, args),
  });
}

const { text, steps } = await generateText({
  model: openai('gpt-4o'),
  system: 'You are an editor assistant. Use the available tools to modify the document.',
  messages,
  tools,
  maxSteps: 10,
});
```

## Error Handling

All errors are instances of `TiptapModuleError`:

```typescript
import { TiptapModuleError, ErrorCodes } from 'tiptap-apcore';

try {
  await apcore.call('tiptap.format.toggleBold', {});
} catch (err) {
  if (err instanceof TiptapModuleError) {
    switch (err.code) {
      case ErrorCodes.ACL_DENIED:
        console.log('Permission denied — check your ACL role');
        break;
      case ErrorCodes.MODULE_NOT_FOUND:
        console.log('Module not found — is the extension installed?');
        break;
      case ErrorCodes.EDITOR_NOT_READY:
        console.log('Editor is destroyed');
        break;
      default:
        console.log(err.code, err.message);
    }
  }
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `acl` | `AclConfig` | `undefined` | Access control (permissive if omitted) |
| `prefix` | `string` | `"tiptap"` | Module ID prefix (lowercase alphanumeric only) |
| `includeUnsafe` | `boolean` | `false` | Include unknown commands not in the built-in catalog |
| `logger` | `Logger` | `undefined` | Diagnostic logger (`{ info?, warn, error }`) |
| `sanitizeHtml` | `(html: string) => string` | `undefined` | HTML sanitizer applied to `insertContent`/`setContent` values |

## Next Steps

- See the [README](../README.md) for the full command reference and API documentation.
- Check the [Technical Design](tiptap-apcore/tech-design.md) for architecture details.
- Explore the [`demo/`](../demo/README.md) folder for a full working React + Express application with AI chat.
