import type { ExtensionCommandInfo, Logger } from "../types.js";

/** The minimal Editor interface we need for scanning */
interface ScannerEditorLike {
  extensionManager: {
    extensions: Array<{
      name: string;
      type: string;
      addCommands?: () => Record<string, unknown>;
      config?: {
        addCommands?: () => Record<string, unknown>;
        [key: string]: unknown;
      };
      options?: Record<string, unknown>;
      storage?: Record<string, unknown>;
    }>;
  };
  commands: Record<string, unknown>;
}

/** Built-in methods available on every TipTap editor */
const BUILTIN_QUERIES = [
  "getHTML", "getJSON", "getText", "isActive", "getAttributes",
  "isEmpty", "isEditable", "isFocused",
];

/** Built-in selection methods provided by apcore (not from extensions) */
const BUILTIN_SELECTIONS = [
  "selectText",
];

export class ExtensionScanner {
  private logger: Logger | undefined;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  scan(editor: ScannerEditorLike): Map<string, ExtensionCommandInfo> {
    const result = new Map<string, ExtensionCommandInfo>();

    // Scan each extension for commands
    for (const extension of editor.extensionManager.extensions) {
      const extensionName = extension.name;
      const extensionType = (extension.type as "node" | "mark" | "extension") ?? "extension";

      let commandNames: string[] = [];

      // Try to get commands from extension.
      // TipTap v2 stores addCommands on extension.config (runtime instances),
      // while direct Extension objects may have it as a direct method.
      const addCommandsFn =
        (typeof extension.addCommands === "function" ? extension.addCommands : null) ??
        (extension.config && typeof extension.config.addCommands === "function"
          ? extension.config.addCommands
          : null);

      if (addCommandsFn) {
        try {
          // H-3: Bind extension as `this` when calling addCommands
          const commands = addCommandsFn.call(extension);
          if (commands && typeof commands === "object") {
            commandNames = Object.keys(commands);
          }
        } catch (err) {
          // H-12: Log instead of silently swallowing
          this.logger?.warn(`Failed to scan extension '${extensionName}'`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (commandNames.length > 0) {
        result.set(extensionName, {
          extensionName,
          commandNames,
          extensionType,
        });
      }
    }

    // Add built-in query methods
    result.set("__builtin__", {
      extensionName: "__builtin__",
      commandNames: [...BUILTIN_QUERIES, ...BUILTIN_SELECTIONS],
      extensionType: "extension",
    });

    return result;
  }
}
