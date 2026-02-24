import { generateText, tool, jsonSchema, type CoreTool } from "ai";
import { createProviderRegistry } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { Executor, Registry } from "tiptap-apcore";

export interface ToolCallLog {
  moduleId: string;
  inputs: Record<string, unknown>;
  result: Record<string, unknown>;
}

export interface ToolLoopResult {
  reply: string;
  toolCalls: ToolCallLog[];
}

const registry = createProviderRegistry({ openai, anthropic });

/**
 * Convert APCore modules into AI SDK tool definitions.
 *
 * Tool names use hyphens (e.g. "tiptap-format-toggleBold") because
 * dots are not valid in AI SDK tool names.
 */
function buildTools(apcoreRegistry: Registry, executor: Executor) {
  const tools: Record<string, CoreTool> = {};

  for (const moduleId of apcoreRegistry.list()) {
    const descriptor = apcoreRegistry.getDefinition(moduleId);
    if (!descriptor) continue;

    const toolName = moduleId.replaceAll(".", "-");

    // Ensure schema has properties (some providers require it)
    const schema = { ...descriptor.inputSchema } as Record<string, unknown>;
    if (!schema.properties) {
      schema.properties = {};
    }

    tools[toolName] = tool({
      description: descriptor.description,
      parameters: jsonSchema(schema),
      execute: async (args) => {
        const denormalized = toolName.replaceAll("-", ".");
        return executor.call(denormalized, args as Record<string, unknown>);
      },
    });
  }

  return tools;
}

export async function toolLoop(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  apcoreRegistry: Registry,
  executor: Executor,
  modelId: string,
): Promise<ToolLoopResult> {
  const model = registry.languageModel(modelId as Parameters<typeof registry.languageModel>[0]);
  const tools = buildTools(apcoreRegistry, executor);

  const allToolCalls: ToolCallLog[] = [];

  const result = await generateText({
    model,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    tools,
    maxSteps: 10,
    onStepFinish: (step) => {
      const stepToolCalls = step.toolCalls as { toolName: string; args: unknown }[] | undefined;
      const stepToolResults = step.toolResults as { result: unknown }[] | undefined;
      if (!stepToolCalls || stepToolCalls.length === 0) return;

      for (let i = 0; i < stepToolCalls.length; i++) {
        const tc = stepToolCalls[i];
        const moduleId = tc.toolName.replaceAll("-", ".");
        const resultValue = stepToolResults?.[i]?.result ?? stepToolResults?.[i] ?? {};
        allToolCalls.push({
          moduleId,
          inputs: tc.args as Record<string, unknown>,
          result: resultValue as Record<string, unknown>,
        });
      }
    },
  });

  return {
    reply: result.text,
    toolCalls: allToolCalls,
  };
}
