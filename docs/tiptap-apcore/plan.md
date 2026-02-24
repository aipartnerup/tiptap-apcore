# Implementation Plan: tiptap-apcore

| Field | Value |
|-------|-------|
| **Source** | `docs/tiptap-apcore/tech-design.md` |
| **Created** | 2026-02-19 |
| **Status** | Ready |
| **Total Tasks** | 12 |
| **Estimated Modules** | 61 (10 query, 24 format, 10 content, 6 destructive, 9 selection, 2 history) |

---

## Dependency Graph

```
Task 1: Project Scaffolding
    ↓
Task 2: Types & Error Classes
    ↓
    ├→ Task 3: AnnotationCatalog
    ├→ Task 4: SchemaCatalog
    │       ↓
    │   Task 5: ModuleBuilder (depends on 3, 4)
    │
    ├→ Task 6: TiptapRegistry
    ├→ Task 7: AclGuard
    │       ↓
    │   Task 8: ExtensionScanner
    │       ↓
    │   Task 9: TiptapExecutor (depends on 6, 7, 8)
    │       ↓
    │   Task 10: withApcore (depends on 5, 9)
    │       ↓
    │   Task 11: Integration Tests (depends on 10)
    │       ↓
    │   Task 12: Demo App (depends on 10)
```

---

## Task 1: Project Scaffolding

**Status**: `pending`
**Depends on**: None
**Priority**: P0 — Foundation

### Description
Initialize the project structure, package.json, TypeScript config, and Vitest config. Must match the package structure defined in tech-design Section 10.1.

### Acceptance Criteria
- [ ] `package.json` with correct name, version, type, exports, peerDependencies, devDependencies (Section 10.2)
- [ ] `tsconfig.json` targeting ESNext, ESM, with declaration output
- [ ] `vitest.config.ts` with jsdom environment for browser simulation
- [ ] Directory structure: `src/{discovery,builder,runtime,security,errors}/`, `tests/{unit,integration}/`
- [ ] `.gitignore`, `LICENSE` (Apache-2.0)
- [ ] `npm install` succeeds, `npx tsc --noEmit` succeeds
- [ ] `npx vitest run` succeeds (no tests yet, zero failures)

### Files to Create
```
package.json
tsconfig.json
vitest.config.ts
.gitignore
LICENSE
src/index.ts              (empty barrel export)
src/types.ts              (placeholder)
src/discovery/index.ts    (placeholder)
src/builder/index.ts      (placeholder)
src/runtime/index.ts      (placeholder)
src/security/index.ts     (placeholder)
src/errors/index.ts       (placeholder)
```

### TDD Steps
1. Create package.json with all fields from Section 10.2
2. Create tsconfig.json (target: ESNext, module: NodeNext, declaration: true)
3. Create vitest.config.ts with jsdom environment
4. Create empty barrel exports
5. Verify: `npm install && npx tsc --noEmit && npx vitest run`

---

## Task 2: Types & Error Classes

**Status**: `pending`
**Depends on**: Task 1
**Priority**: P0 — Foundation

### Description
Define all TypeScript types and the `TiptapModuleError` class. These are used by every other component.

### Acceptance Criteria
- [ ] `ApcoreOptions` interface with `acl`, `prefix`, `includeUnsafe` fields (Section 5.1)
- [ ] `AclConfig` interface with `role`, `allowTags`, `denyTags`, `allowModules`, `denyModules` (Section 5.1)
- [ ] `ApcoreResult` interface with `registry`, `executor` fields
- [ ] `ExtensionCommandInfo` interface
- [ ] `AnnotationEntry` and `SchemaEntry` types
- [ ] `TiptapModuleError` class extending `Error` with `code`, `details` (Section 4.7.2)
- [ ] Error codes as constants: `MODULE_NOT_FOUND`, `COMMAND_NOT_FOUND`, `SCHEMA_VALIDATION_ERROR`, `ACL_DENIED`, `EDITOR_NOT_READY`, `COMMAND_FAILED`, `INTERNAL_ERROR` (Section 4.7.1)
- [ ] All types exported from `src/index.ts`

### Files to Create/Edit
```
src/types.ts                       # All interfaces and type aliases
src/errors/TiptapModuleError.ts    # Error class
src/errors/index.ts                # Barrel export
tests/unit/TiptapModuleError.test.ts
```

### TDD Steps
1. **Test**: `TiptapModuleError` has `name: "ModuleError"`, correct `code`, `message`, `details`
2. **Implement**: `TiptapModuleError` class
3. **Test**: Error with `details: null` when no details provided
4. **Test**: Error codes are string constants
5. **Implement**: Error code constants
6. **Verify**: All types compile with `tsc --noEmit`

---

## Task 3: AnnotationCatalog

**Status**: `pending`
**Depends on**: Task 2
**Priority**: P0 — Discovery Layer

### Description
Static mapping of all 61 TipTap command names to their `ModuleAnnotations` and category tags. This is the curated safety knowledge of the system. Reference: tech-design Section 6.3 (Complete Module Catalog).

### Acceptance Criteria
- [ ] `AnnotationCatalog` class with `get(commandName): AnnotationEntry | null`
- [ ] `getCategory(commandName): string` method
- [ ] All 61 commands mapped with correct annotations from Section 6.3:
  - 10 query commands: `readonly=true, destructive=false, idempotent=true, requires_approval=false, open_world=false`
  - 24 format commands: `readonly=false, destructive=false, idempotent=true, requires_approval=false, open_world=false`
  - 10 content commands: `readonly=false, destructive=false, idempotent=false, requires_approval=false, open_world=false`
  - 6 destructive commands: `readonly=false, destructive=true, idempotent=false, requires_approval=true, open_world=false`
  - 9 selection commands: `readonly=false, destructive=false, idempotent=true, requires_approval=false, open_world=false`
  - 2 history commands: `readonly=false, destructive=false, idempotent=false, requires_approval=false, open_world=false`
- [ ] Unknown commands return `null`
- [ ] 100% line and branch coverage

### Files to Create
```
src/builder/AnnotationCatalog.ts
tests/unit/AnnotationCatalog.test.ts
```

### TDD Steps
1. **Test**: `get("getHTML")` returns `{ annotations: { readonly: true, ... }, tags: ["query"], category: "query" }`
2. **Test**: `get("toggleBold")` returns format annotations
3. **Test**: `get("clearContent")` returns `{ destructive: true, requires_approval: true, ... }`
4. **Test**: `get("undo")` returns history annotations
5. **Test**: `get("unknownCommand")` returns `null`
6. **Test**: `getCategory("toggleBold")` returns `"format"`
7. **Implement**: AnnotationCatalog with all 61 entries
8. **Test**: Every command in the catalog (parametric test over all 61)

---

## Task 4: SchemaCatalog

**Status**: `pending`
**Depends on**: Task 2
**Priority**: P0 — Discovery Layer

### Description
Static mapping of all 61 TipTap command names to their JSON Schema input/output definitions. Reference: tech-design Section 5.4 and Section 6.3.

### Acceptance Criteria
- [ ] `SchemaCatalog` class with `get(commandName): SchemaEntry`
- [ ] Input schemas for all 61 commands with proper types, constraints, required fields
- [ ] Output schemas: query modules return typed data; command modules return `{ success: boolean }`
- [ ] Key schema validations from tech-design:
  - `toggleHeading`: `level` is integer, minimum 1, maximum 6
  - `insertContent`: `value` accepts string, object, or array
  - `setTextAlign`: `alignment` is enum `["left","center","right","justify"]`
  - `deleteRange`: `from` and `to` are integers >= 0
  - `focus`: `position` is optional, accepts `"start"|"end"|"all"` or integer
- [ ] Unknown commands return default open schema
- [ ] 100% line and branch coverage

### Files to Create
```
src/builder/SchemaCatalog.ts
tests/unit/SchemaCatalog.test.ts
```

### TDD Steps
1. **Test**: `get("getHTML")` returns empty input, `{ html: string }` output
2. **Test**: `get("toggleHeading")` input has `level` with min 1, max 6
3. **Test**: `get("insertContent")` input has `value` with oneOf string/object/array
4. **Test**: `get("setTextAlign")` input has `alignment` enum
5. **Test**: `get("unknownCommand")` returns default schema with `additionalProperties: true`
6. **Implement**: SchemaCatalog with all 61 entries
7. **Test**: Every schema is valid JSON Schema (structural validation)

---

## Task 5: ModuleBuilder

**Status**: `pending`
**Depends on**: Task 3, Task 4
**Priority**: P1 — Discovery Layer

### Description
Transforms a TipTap command name + extension info into a `ModuleDescriptor`. Uses AnnotationCatalog and SchemaCatalog. Reference: tech-design Section 4.4.

### Acceptance Criteria
- [ ] `ModuleBuilder` class with `build(commandName, extensionInfo): ModuleDescriptor`
- [ ] `buildModuleId(commandName): string` generates `tiptap.<category>.<commandName>` (Section 4.4.1)
- [ ] Custom prefix support: `options.prefix = "myapp"` → `myapp.<category>.<commandName>`
- [ ] Unknown commands get category `"unknown"` and default annotations (Section 4.3.3)
- [ ] Description generation includes command name and context
- [ ] `documentation` field links to TipTap docs
- [ ] `version` set to `"0.1.0"`
- [ ] `tags` from AnnotationCatalog

### Files to Create
```
src/builder/ModuleBuilder.ts
tests/unit/ModuleBuilder.test.ts
```

### TDD Steps
1. **Test**: `buildModuleId("toggleBold")` → `"tiptap.format.toggleBold"`
2. **Test**: `buildModuleId("getHTML")` → `"tiptap.query.getHTML"`
3. **Test**: Custom prefix: `"myapp.format.toggleBold"`
4. **Test**: `build("toggleBold", extensionInfo)` returns complete ModuleDescriptor
5. **Test**: Unknown command gets `"tiptap.unknown.customCommand"` with default annotations
6. **Implement**: ModuleBuilder
7. **Verify**: Built descriptors match ModuleDescriptor interface from SDK

---

## Task 6: TiptapRegistry

**Status**: `pending`
**Depends on**: Task 2
**Priority**: P0 — Runtime Layer

### Description
Implements the APCore `Registry` interface. Stores `ModuleDescriptor` objects in a `Map`, supports listing/filtering by tags/prefix, emits events. Reference: tech-design Section 5.2.

### Acceptance Criteria
- [ ] Implements `list(options?)` with tag filtering (OR logic) and prefix filtering (startsWith)
- [ ] Implements `get_definition(module_id): ModuleDescriptor | null`
- [ ] Implements `get(module_id): CommandHandler | null`
- [ ] Implements `on(event, callback)` for events: `module:registered`, `module:removed`, `discover:complete`
- [ ] Implements `discover(): number` (re-scan)
- [ ] `register(descriptor)` adds to map and fires `module:registered` event
- [ ] `list()` with both tags and prefix applies AND logic
- [ ] Returns `null` for unknown module IDs
- [ ] >= 95% line coverage, >= 90% branch coverage

### Files to Create
```
src/runtime/TiptapRegistry.ts
tests/unit/TiptapRegistry.test.ts
```

### TDD Steps
1. **Test**: Empty registry `list()` returns `[]`
2. **Test**: `register()` then `list()` returns the module ID
3. **Test**: `get_definition()` returns descriptor for registered module
4. **Test**: `get_definition()` returns `null` for unknown module
5. **Test**: `list({ tags: ["query"] })` filters correctly
6. **Test**: `list({ prefix: "tiptap.format" })` filters correctly
7. **Test**: `list({ tags: ["format"], prefix: "tiptap.format.toggle" })` applies AND
8. **Test**: `on("module:registered", cb)` fires callback on register
9. **Test**: `on("module:removed", cb)` fires callback on remove
10. **Implement**: TiptapRegistry

---

## Task 7: AclGuard

**Status**: `pending`
**Depends on**: Task 2
**Priority**: P0 — Security Layer

### Description
Enforces role-based and fine-grained access control. Reference: tech-design Section 4.6.

### Acceptance Criteria
- [ ] `AclGuard` class with `check(module_id, descriptor): void` (throws on deny)
- [ ] `isAllowed(module_id, descriptor): boolean` (returns boolean)
- [ ] Role presets (Section 4.6.1):
  - `readonly` → only `["query"]`
  - `editor` → `["query", "format", "content", "history", "selection"]`
  - `admin` → all tags
- [ ] Evaluation order (Section 4.6.2): denyModules > allowModules > denyTags > allowTags > role > permissive default
- [ ] No ACL config → all allowed (opt-in security)
- [ ] Throws `TiptapModuleError` with code `ACL_DENIED` and correct details
- [ ] 100% line and branch coverage

### Files to Create
```
src/security/AclGuard.ts
tests/unit/AclGuard.test.ts
```

### TDD Steps
1. **Test**: No ACL config → `check()` passes for any module
2. **Test**: `role: "readonly"` allows query tag, denies format tag
3. **Test**: `role: "editor"` allows query/format/content/history/selection, denies destructive
4. **Test**: `role: "admin"` allows everything including destructive
5. **Test**: `denyModules` takes precedence over role allow
6. **Test**: `allowModules` takes precedence over role deny
7. **Test**: `denyTags` takes precedence over `allowTags`
8. **Test**: Thrown error has code `ACL_DENIED` with correct details
9. **Test**: `isAllowed()` returns boolean without throwing
10. **Implement**: AclGuard with full evaluation chain

---

## Task 8: ExtensionScanner

**Status**: `pending`
**Depends on**: Task 2
**Priority**: P1 — Discovery Layer

### Description
Scans `editor.extensionManager.extensions` to discover installed extensions and their commands. Reference: tech-design Section 4.3.

### Acceptance Criteria
- [ ] `ExtensionScanner` class with `scan(editor): Map<string, ExtensionCommandInfo>`
- [ ] Discovers commands from `extension.addCommands()` return value
- [ ] Discovers built-in query methods (`getHTML`, `getJSON`, `getText`, `isActive`, `getAttributes`, `isEmpty`, `isEditable`, `isFocused`)
- [ ] Handles extensions without `addCommands` gracefully (skip, no error)
- [ ] Returns `extensionType` ("node" | "mark" | "extension") for each extension
- [ ] Handles duplicate command names from different extensions (last wins)
- [ ] >= 95% line coverage, >= 90% branch coverage

### Files to Create
```
src/discovery/ExtensionScanner.ts
tests/unit/ExtensionScanner.test.ts
```

### TDD Steps
1. **Test**: Mock editor with StarterKit-like extensions → discovers commands
2. **Test**: Extension without `addCommands` → skipped gracefully
3. **Test**: Built-in query methods always included (`__builtin__` entry)
4. **Test**: Returns correct `extensionType` per extension
5. **Test**: Empty editor (no extensions) → only built-in queries
6. **Implement**: ExtensionScanner
7. **Integration verify**: Works with real `@tiptap/starter-kit` in jsdom

---

## Task 9: TiptapExecutor

**Status**: `pending`
**Depends on**: Task 6, Task 7
**Priority**: P1 — Runtime Layer

### Description
Implements the APCore `Executor` interface. Routes `call`/`call_async` to TipTap editor commands with ACL enforcement and input validation. Reference: tech-design Section 4.5.

### Acceptance Criteria
- [ ] Implements `call(module_id, inputs): Record<string, unknown>`
- [ ] Implements `call_async(module_id, inputs): Promise<Record<string, unknown>>`
- [ ] `call_async` wraps `call` in `Promise.resolve()` (TipTap commands are sync)
- [ ] Query commands route to `editor.getHTML()`, `editor.getJSON()`, etc. (Section 4.5.1)
- [ ] Format/content/destructive commands route to `editor.chain().focus().<command>().run()`
- [ ] ACL check before execution (throws `ACL_DENIED`)
- [ ] Input validation against `input_schema` (throws `SCHEMA_VALIDATION_ERROR`)
- [ ] Module not found → throws `MODULE_NOT_FOUND`
- [ ] Editor destroyed → throws `EDITOR_NOT_READY`
- [ ] Command returns `false` → throws `COMMAND_FAILED`
- [ ] Has `registry` property (required by Executor interface)
- [ ] >= 90% line coverage, >= 85% branch coverage

### Files to Create
```
src/runtime/TiptapExecutor.ts
tests/unit/TiptapExecutor.test.ts
```

### TDD Steps
1. **Test**: `call("tiptap.query.getHTML", {})` returns `{ html: "..." }`
2. **Test**: `call("tiptap.format.toggleBold", {})` returns `{ success: true }`
3. **Test**: `call("nonexistent", {})` throws `MODULE_NOT_FOUND`
4. **Test**: ACL-denied call throws `ACL_DENIED`
5. **Test**: Invalid input throws `SCHEMA_VALIDATION_ERROR`
6. **Test**: Destroyed editor throws `EDITOR_NOT_READY`
7. **Test**: Command returning `false` throws `COMMAND_FAILED`
8. **Test**: `call_async` resolves with same result as `call`
9. **Test**: `executor.registry` returns the TiptapRegistry
10. **Implement**: TiptapExecutor with query routing + command routing

---

## Task 10: withApcore Factory Function

**Status**: `pending`
**Depends on**: Task 5, Task 9
**Priority**: P1 — Entry Point

### Description
The public API entry point. Orchestrates ExtensionScanner → ModuleBuilder → TiptapRegistry → TiptapExecutor with ACL configuration. Reference: tech-design Section 5.1.

### Acceptance Criteria
- [ ] `withApcore(editor, options?): ApcoreResult` function
- [ ] Auto-discovers all commands from editor extensions
- [ ] Builds ModuleDescriptors for each discovered command
- [ ] Registers all descriptors in TiptapRegistry
- [ ] Creates TiptapExecutor with ACL from options
- [ ] Validates `editor` parameter (not null, not destroyed, has extensions)
- [ ] Validates `options.prefix` matches `/^[a-z][a-z0-9]*$/`
- [ ] Validates `options.acl.role` is valid
- [ ] Returns `{ registry, executor }`
- [ ] Exported from `src/index.ts` as named export

### Files to Create/Edit
```
src/withApcore.ts
src/index.ts                  # Update to export withApcore + types
tests/unit/withApcore.test.ts
```

### TDD Steps
1. **Test**: `withApcore(editor)` returns `{ registry, executor }`
2. **Test**: `registry.list()` contains discovered modules
3. **Test**: `executor.call("tiptap.query.getHTML", {})` works
4. **Test**: `withApcore(null)` throws TypeError
5. **Test**: `withApcore(destroyedEditor)` throws EDITOR_NOT_READY
6. **Test**: ACL option passed through to executor
7. **Test**: Custom prefix generates correct module IDs
8. **Test**: `includeUnsafe: false` excludes unknown commands
9. **Implement**: withApcore factory function
10. **Verify**: Full public API export from index.ts

---

## Task 11: Integration Tests

**Status**: `pending`
**Depends on**: Task 10
**Priority**: P1 — Verification

### Description
End-to-end tests with real TipTap editor instances. Verifies the full flow: withApcore → registry → executor → editor commands. Reference: tech-design Section 9.4.

### Acceptance Criteria
- [ ] Test with real `@tiptap/core` + `@tiptap/starter-kit` in jsdom
- [ ] All key integration test cases from Section 9.4:
  - `withApcore` discovers StarterKit commands (>= 40 modules)
  - `getHTML` returns editor content
  - `toggleBold` formats selection
  - `insertContent` adds HTML
  - `clearContent` empties editor
  - `undo` reverts last change
  - ACL readonly blocks format
  - ACL editor blocks destructive
  - ACL admin allows all
  - Invalid input rejected
- [ ] MCP bridge test: `serve()` and `toOpenaiTools()` work with tiptap-apcore executor
- [ ] All tests pass in CI

### Files to Create
```
tests/integration/withApcore.test.ts
tests/integration/queryModules.test.ts
tests/integration/formatModules.test.ts
tests/integration/contentModules.test.ts
tests/integration/destructiveModules.test.ts
tests/integration/historyModules.test.ts
tests/integration/selectionModules.test.ts
tests/integration/aclIntegration.test.ts
```

### TDD Steps
1. Create test helper: `createTestEditor(content?)` using StarterKit
2. Test: `withApcore(editor)` discovers >= 40 modules
3. Test: All 10 query modules return expected data
4. Test: All 24 format modules toggle correctly
5. Test: Content modules insert/modify content
6. Test: Destructive modules require admin role
7. Test: History (undo/redo) works
8. Test: Selection modules manipulate cursor
9. Test: ACL role presets enforce correctly
10. Test: End-to-end with `toOpenaiTools(executor)` produces valid tool definitions

---

## Task 12: React + Vite Demo App

**Status**: `pending`
**Depends on**: Task 10
**Priority**: P2 — Showcase

### Description
A working demo that shows AI controlling a TipTap editor via APCore. Reference: tech-design Section 3.1 (G8).

### Acceptance Criteria
- [ ] React + Vite project in `demo/` directory
- [ ] TipTap editor with StarterKit + common extensions
- [ ] `withApcore(editor)` integration
- [ ] Demo scenarios from the original spec:
  1. AI inserts heading → APCore lets AI directly control your editor
  2. AI writes paragraph → auto-generated content
  3. AI formats → bold, italic, lists
  4. AI clears document → APCore intercepts → "Confirm clearing?"
- [ ] Shows available MCP tools in a sidebar panel
- [ ] ACL role switcher (readonly/editor/admin) in UI
- [ ] `npm run dev` starts the demo

### Files to Create
```
demo/package.json
demo/vite.config.ts
demo/tsconfig.json
demo/index.html
demo/src/main.tsx
demo/src/App.tsx
demo/src/components/Editor.tsx
demo/src/components/ToolPanel.tsx
demo/src/components/AclSwitcher.tsx
```

### Implementation Steps
1. Initialize Vite React project
2. Install @tiptap/react, @tiptap/starter-kit, tiptap-apcore (local link)
3. Build Editor component with TipTap
4. Integrate withApcore and display tool list
5. Build demo scenario buttons (insert heading, format, clear)
6. Add ACL role switcher UI
7. Test all 4 demo scenarios manually

---

## Execution Order Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| **Phase 1: Foundation** | 1, 2 | Project setup + types/errors |
| **Phase 2: Catalogs** | 3, 4 | AnnotationCatalog + SchemaCatalog (parallelizable) |
| **Phase 3: Core** | 5, 6, 7, 8 | ModuleBuilder, Registry, AclGuard, Scanner (partially parallelizable: 6+7 parallel, then 5+8) |
| **Phase 4: Integration** | 9, 10 | Executor + withApcore |
| **Phase 5: Verification** | 11 | Integration tests |
| **Phase 6: Demo** | 12 | React demo app |

---

## Progress Tracker

| Task | Status | Tests | Coverage |
|------|--------|-------|----------|
| 1. Project Scaffolding | `pending` | — | — |
| 2. Types & Errors | `pending` | 0/5 | — |
| 3. AnnotationCatalog | `pending` | 0/8 | — |
| 4. SchemaCatalog | `pending` | 0/7 | — |
| 5. ModuleBuilder | `pending` | 0/7 | — |
| 6. TiptapRegistry | `pending` | 0/10 | — |
| 7. AclGuard | `pending` | 0/10 | — |
| 8. ExtensionScanner | `pending` | 0/7 | — |
| 9. TiptapExecutor | `pending` | 0/10 | — |
| 10. withApcore | `pending` | 0/10 | — |
| 11. Integration Tests | `pending` | 0/10 | — |
| 12. Demo App | `pending` | — | — |
