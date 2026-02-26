/**
 * SchemaCatalog: Static mapping of TipTap command names to JSON Schema
 * input/output definitions.
 *
 * Every known command has explicit schemas with additionalProperties: false.
 * Unknown commands fall back to a permissive default schema.
 */

import type { SchemaEntry, JsonSchema } from "../types.js";

// ── Reusable schema fragments ──────────────────────────────────────────────

const SUCCESS_OUTPUT: JsonSchema = Object.freeze({
  type: "object",
  properties: Object.freeze({ success: Object.freeze({ type: "boolean" }) }),
  required: Object.freeze(["success"]),
});

const EMPTY_INPUT: JsonSchema = Object.freeze({
  type: "object",
  properties: Object.freeze({}),
  additionalProperties: false,
});

/** Shorthand for the most common pattern: {} -> {success: boolean} */
function simpleCommand(): SchemaEntry {
  return { inputSchema: EMPTY_INPUT, outputSchema: SUCCESS_OUTPUT };
}

/** Builds a SchemaEntry with typed input properties. */
function entry(input: JsonSchema, output: JsonSchema): SchemaEntry {
  return { inputSchema: input, outputSchema: output };
}

/**
 * Wraps properties + required into a strict object schema.
 *
 * For OpenAI strict mode compatibility, ALL property keys are listed
 * in `required`. Properties not in the caller's `required` list are
 * made nullable (type becomes [originalType, "null"]) so they can
 * accept null as a value.
 */
function inputSchema(
  properties: Record<string, JsonSchema>,
  required: string[] = [],
): JsonSchema {
  const allKeys = Object.keys(properties);
  if (allKeys.length === 0) {
    return { type: "object", properties: {}, additionalProperties: false };
  }
  const requiredSet = new Set(required);
  const processed: Record<string, JsonSchema> = {};
  for (const [key, schema] of Object.entries(properties)) {
    const strict = ensureStrictObject(schema);
    if (requiredSet.has(key)) {
      processed[key] = strict;
    } else {
      processed[key] = makeNullable(strict);
    }
  }
  return {
    type: "object",
    properties: processed,
    required: allKeys,
    additionalProperties: false,
  };
}

/**
 * Ensure bare { type: "object" } schemas have explicit properties and
 * additionalProperties: false, as required by OpenAI strict mode.
 */
function ensureStrictObject(schema: JsonSchema): JsonSchema {
  if (schema.type === "object" && !schema.properties) {
    return { ...schema, properties: {}, additionalProperties: false };
  }
  return schema;
}

/** Make a schema accept null in addition to its original type. */
function makeNullable(schema: JsonSchema): JsonSchema {
  const copy = { ...schema };
  if (typeof copy.type === "string") {
    copy.type = [copy.type, "null"];
  } else if (copy.anyOf) {
    copy.anyOf = [...(copy.anyOf as unknown[]), { type: "null" }];
  }
  return copy;
}

// ── Catalog class ──────────────────────────────────────────────────────────

export class SchemaCatalog {
  private catalog: Map<string, SchemaEntry>;

  private static readonly DEFAULT_ENTRY: SchemaEntry = {
    inputSchema: { type: "object", additionalProperties: true },
    outputSchema: SUCCESS_OUTPUT,
  };

  constructor() {
    this.catalog = new Map<string, SchemaEntry>();
    this.populate();
  }

  /**
   * Returns the SchemaEntry for the given command name.
   * Falls back to a permissive default for unknown commands.
   */
  get(commandName: string): SchemaEntry {
    return this.catalog.get(commandName) ?? SchemaCatalog.DEFAULT_ENTRY;
  }

  // ── Private population ─────────────────────────────────────────────────

  private populate(): void {
    // ── Query modules ────────────────────────────────────────────────────

    this.catalog.set(
      "getHTML",
      entry(EMPTY_INPUT, {
        type: "object",
        properties: { html: { type: "string" } },
        required: ["html"],
      }),
    );

    this.catalog.set(
      "getJSON",
      entry(EMPTY_INPUT, {
        type: "object",
        properties: { json: { type: "object" } },
        required: ["json"],
      }),
    );

    this.catalog.set(
      "getText",
      entry(
        inputSchema({ blockSeparator: { type: "string" } }),
        {
          type: "object",
          properties: { text: { type: "string" } },
          required: ["text"],
        },
      ),
    );

    this.catalog.set(
      "isActive",
      entry(
        inputSchema(
          {
            name: { type: "string" },
            attrs: { type: "object" },
          },
          ["name"],
        ),
        {
          type: "object",
          properties: { active: { type: "boolean" } },
          required: ["active"],
        },
      ),
    );

    this.catalog.set(
      "getAttributes",
      entry(
        inputSchema({ typeOrName: { type: "string" } }, ["typeOrName"]),
        {
          type: "object",
          properties: { attributes: { type: "object" } },
          required: ["attributes"],
        },
      ),
    );

    // Boolean query commands
    for (const cmd of ["isEmpty", "isEditable", "isFocused"]) {
      this.catalog.set(
        cmd,
        entry(EMPTY_INPUT, {
          type: "object",
          properties: { value: { type: "boolean" } },
          required: ["value"],
        }),
      );
    }

    // Count query commands
    for (const cmd of ["getCharacterCount", "getWordCount"]) {
      this.catalog.set(
        cmd,
        entry(EMPTY_INPUT, {
          type: "object",
          properties: { count: { type: "integer" } },
          required: ["count"],
        }),
      );
    }

    // ── Format modules ───────────────────────────────────────────────────

    // Simple toggles: {} -> {success: boolean}
    const simpleToggles = [
      "toggleBold",
      "toggleItalic",
      "toggleStrike",
      "toggleCode",
      "toggleUnderline",
      "toggleSubscript",
      "toggleSuperscript",
      "toggleBulletList",
      "toggleOrderedList",
      "toggleTaskList",
      "toggleBlockquote",
    ];
    for (const cmd of simpleToggles) {
      this.catalog.set(cmd, simpleCommand());
    }

    this.catalog.set(
      "toggleHighlight",
      entry(inputSchema({ color: { type: "string" } }), SUCCESS_OUTPUT),
    );

    this.catalog.set(
      "toggleHeading",
      entry(
        inputSchema(
          {
            level: {
              type: "integer",
              minimum: 1,
              maximum: 6,
            },
          },
          ["level"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "toggleCodeBlock",
      entry(inputSchema({ language: { type: "string" } }), SUCCESS_OUTPUT),
    );

    this.catalog.set(
      "setTextAlign",
      entry(
        inputSchema(
          {
            alignment: {
              type: "string",
              enum: ["left", "center", "right", "justify"],
            },
          },
          ["alignment"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "setMark",
      entry(
        inputSchema(
          {
            typeOrName: { type: "string" },
            attrs: { type: "object" },
          },
          ["typeOrName"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "unsetMark",
      entry(
        inputSchema({ typeOrName: { type: "string" } }, ["typeOrName"]),
        SUCCESS_OUTPUT,
      ),
    );

    // Simple format commands with empty input
    for (const cmd of [
      "unsetAllMarks",
      "clearNodes",
      "setHardBreak",
      "setHorizontalRule",
    ]) {
      this.catalog.set(cmd, simpleCommand());
    }

    this.catalog.set(
      "updateAttributes",
      entry(
        inputSchema(
          {
            typeOrName: { type: "string" },
            attrs: { type: "object" },
          },
          ["typeOrName", "attrs"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "setLink",
      entry(
        inputSchema(
          {
            href: { type: "string" },
            target: { type: "string" },
            rel: { type: "string" },
          },
          ["href"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set("unsetLink", simpleCommand());

    // Simple set/unset format commands
    for (const cmd of [
      "setBold",
      "unsetBold",
      "setItalic",
      "unsetItalic",
      "setStrike",
      "unsetStrike",
      "setCode",
      "unsetCode",
      "setBlockquote",
      "unsetBlockquote",
      "setParagraph",
    ]) {
      this.catalog.set(cmd, simpleCommand());
    }

    this.catalog.set(
      "setHeading",
      entry(
        inputSchema(
          {
            level: {
              type: "integer",
              minimum: 1,
              maximum: 6,
            },
          },
          ["level"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    // ── Content modules ──────────────────────────────────────────────────

    this.catalog.set(
      "insertContent",
      entry(
        inputSchema(
          {
            value: { type: "string" },
            options: {
              type: "object",
              properties: {
                parseOptions: {
                  type: "object",
                  properties: {
                    preserveWhitespace: { type: ["boolean", "null"] },
                  },
                  required: ["preserveWhitespace"],
                  additionalProperties: false,
                },
                updateSelection: { type: ["boolean", "null"] },
              },
              required: ["parseOptions", "updateSelection"],
              additionalProperties: false,
            },
          },
          ["value"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "insertContentAt",
      entry(
        inputSchema(
          {
            position: { type: "integer", minimum: 0 },
            value: { type: "string" },
            options: { type: "object" },
          },
          ["position", "value"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "setNode",
      entry(
        inputSchema(
          {
            typeOrName: { type: "string" },
            attrs: { type: "object" },
          },
          ["typeOrName"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "splitBlock",
      entry(inputSchema({ keepMarks: { type: "boolean" } }), SUCCESS_OUTPUT),
    );

    for (const cmd of ["liftListItem", "sinkListItem"]) {
      this.catalog.set(
        cmd,
        entry(
          inputSchema({ typeOrName: { type: "string" } }, ["typeOrName"]),
          SUCCESS_OUTPUT,
        ),
      );
    }

    this.catalog.set(
      "wrapIn",
      entry(
        inputSchema(
          {
            typeOrName: { type: "string" },
            attrs: { type: "object" },
          },
          ["typeOrName"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    for (const cmd of ["joinBackward", "joinForward"]) {
      this.catalog.set(cmd, simpleCommand());
    }

    this.catalog.set(
      "lift",
      entry(
        inputSchema(
          {
            typeOrName: { type: "string" },
            attrs: { type: "object" },
          },
          ["typeOrName"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "splitListItem",
      entry(
        inputSchema(
          {
            typeOrName: { type: "string" },
            overrideAttrs: { type: "object" },
          },
          ["typeOrName"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "wrapInList",
      entry(
        inputSchema(
          {
            typeOrName: { type: "string" },
            attributes: { type: "object" },
          },
          ["typeOrName"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "toggleList",
      entry(
        inputSchema(
          {
            listTypeOrName: { type: "string" },
            itemTypeOrName: { type: "string" },
            keepMarks: { type: "boolean" },
            attributes: { type: "object" },
          },
          ["listTypeOrName", "itemTypeOrName"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set("exitCode", simpleCommand());

    this.catalog.set(
      "deleteNode",
      entry(
        inputSchema({ typeOrName: { type: "string" } }, ["typeOrName"]),
        SUCCESS_OUTPUT,
      ),
    );

    // ── Destructive modules ──────────────────────────────────────────────

    this.catalog.set(
      "clearContent",
      entry(
        inputSchema({ emitUpdate: { type: "boolean" } }),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "setContent",
      entry(
        inputSchema(
          {
            value: { type: "string" },
            emitUpdate: { type: "boolean" },
            parseOptions: { type: "object" },
          },
          ["value"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set("deleteSelection", simpleCommand());

    this.catalog.set(
      "deleteRange",
      entry(
        inputSchema(
          {
            from: { type: "integer", minimum: 0 },
            to: { type: "integer", minimum: 0 },
          },
          ["from", "to"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set("deleteCurrentNode", simpleCommand());
    this.catalog.set("cut", simpleCommand());

    // ── Selection modules ────────────────────────────────────────────────

    this.catalog.set(
      "setTextSelection",
      entry(
        inputSchema(
          {
            position: {
              anyOf: [
                { type: "integer" },
                {
                  type: "object",
                  properties: {
                    from: { type: "integer" },
                    to: { type: "integer" },
                  },
                  required: ["from", "to"],
                  additionalProperties: false,
                },
              ],
            },
          },
          ["position"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    this.catalog.set(
      "setNodeSelection",
      entry(
        inputSchema(
          { position: { type: "integer", minimum: 0 } },
          ["position"],
        ),
        SUCCESS_OUTPUT,
      ),
    );

    // Custom APCore command (not native TipTap) — semantic text selection
    this.catalog.set(
      "selectText",
      entry(
        inputSchema(
          {
            text: { type: "string", description: "The text content to search for and select" },
            occurrence: { type: "integer", minimum: 1, description: "Which occurrence to select (1-based, defaults to 1)" },
          },
          ["text"],
        ),
        {
          type: "object",
          properties: {
            found: { type: "boolean" },
            from: { type: "integer" },
            to: { type: "integer" },
          },
          required: ["found"],
        },
      ),
    );

    for (const cmd of [
      "selectAll",
      "selectParentNode",
      "selectTextblockStart",
      "selectTextblockEnd",
      "blur",
      "scrollIntoView",
    ]) {
      this.catalog.set(cmd, simpleCommand());
    }

    this.catalog.set(
      "focus",
      entry(
        inputSchema({
          position: {
            anyOf: [
              { type: "string", enum: ["start", "end", "all"] },
              { type: "integer" },
            ],
          },
        }),
        SUCCESS_OUTPUT,
      ),
    );

    // ── History modules ──────────────────────────────────────────────────

    this.catalog.set("undo", simpleCommand());
    this.catalog.set("redo", simpleCommand());
  }
}
