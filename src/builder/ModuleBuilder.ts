/**
 * ModuleBuilder: Transforms TipTap command names into APCore ModuleDescriptor objects.
 *
 * Combines metadata from the AnnotationCatalog (safety annotations, tags, categories)
 * and SchemaCatalog (input/output JSON schemas) to produce complete ModuleDescriptor
 * objects suitable for registration in an APCore Registry.
 */

import type { ModuleDescriptor, ExtensionCommandInfo } from "../types.js";
import { AnnotationCatalog } from "./AnnotationCatalog.js";
import { SchemaCatalog } from "./SchemaCatalog.js";

// ------------------------------------------------------------------
// Description templates per category
// ------------------------------------------------------------------

const CATEGORY_VERB: Record<string, string> = {
  query: "Query",
  format: "Apply",
  content: "Modify content via",
  destructive: "Destructively perform",
  selection: "Adjust selection via",
  history: "Perform history action",
  unknown: "Execute",
};

// ------------------------------------------------------------------
// Default annotations for unknown commands
// ------------------------------------------------------------------

const DEFAULT_ANNOTATIONS = {
  readonly: false,
  destructive: false,
  idempotent: false,
  requiresApproval: false,
  openWorld: false,
  streaming: false,
} as const;

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------

export class ModuleBuilder {
  private annotationCatalog: AnnotationCatalog;
  private schemaCatalog: SchemaCatalog;
  private prefix: string;

  constructor(prefix: string = "tiptap") {
    this.annotationCatalog = new AnnotationCatalog();
    this.schemaCatalog = new SchemaCatalog();
    this.prefix = prefix;
  }

  /**
   * Build a complete ModuleDescriptor for the given TipTap command.
   */
  build(
    commandName: string,
    extensionInfo: ExtensionCommandInfo,
  ): ModuleDescriptor {
    const annotationEntry = this.annotationCatalog.get(commandName);
    const schemaEntry = this.schemaCatalog.get(commandName);
    const category = annotationEntry?.category ?? "unknown";
    const moduleId = this.buildModuleId(commandName, category);

    return {
      moduleId,
      description: this.generateDescription(
        commandName,
        extensionInfo,
        category,
      ),
      inputSchema: schemaEntry.inputSchema,
      outputSchema: schemaEntry.outputSchema,
      annotations: annotationEntry?.annotations ?? { ...DEFAULT_ANNOTATIONS },
      tags: annotationEntry?.tags ?? ["unknown"],
      version: "0.1.0",
      documentation: `https://tiptap.dev/docs/editor/api/commands/${commandName}`,
      metadata: {
        selectionEffect: annotationEntry?.selectionEffect ?? "preserve",
      },
    };
  }

  /**
   * Build the dot-separated module ID for a command.
   *
   * @example buildModuleId("toggleBold")      → "tiptap.format.toggleBold"
   * @example buildModuleId("getHTML")          → "tiptap.query.getHTML"
   * @example buildModuleId("clearContent")     → "tiptap.destructive.clearContent"
   * @example buildModuleId("customCmd")        → "tiptap.unknown.customCmd"
   */
  buildModuleId(commandName: string, category?: string): string {
    const cat =
      category ?? this.annotationCatalog.getCategory(commandName);
    return `${this.prefix}.${cat}.${commandName}`;
  }

  /**
   * Generate a human-readable description string.
   *
   * Template: "<Verb> <humanized command name> (from <Extension> extension)"
   */
  private generateDescription(
    commandName: string,
    extensionInfo: ExtensionCommandInfo,
    category: string,
  ): string {
    const verb = CATEGORY_VERB[category] ?? CATEGORY_VERB.unknown;
    const humanized = this.humanize(commandName);
    return `${verb} ${humanized} (from ${extensionInfo.extensionName} extension)`;
  }

  /**
   * Convert a camelCase command name into a human-readable phrase.
   *
   * "toggleBold"     → "toggle bold"
   * "getHTML"         → "get HTML"
   * "insertContentAt" → "insert content at"
   */
  private humanize(commandName: string): string {
    // Insert a space before each uppercase letter that follows a lowercase letter,
    // or before a sequence of uppercase letters followed by a lowercase letter.
    const spaced = commandName
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");

    // Lowercase the first character and preserve acronym casing
    return spaced.charAt(0).toLowerCase() + spaced.slice(1);
  }
}
