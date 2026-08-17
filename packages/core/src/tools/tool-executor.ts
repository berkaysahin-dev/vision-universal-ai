import type { AITool, ToolCall, ToolResult } from "../types/tools.js";
import type { ChatMessage, ChatOptions, AIResponse } from "../types/chat.js";
import type { AIProvider } from "../types/provider.js";
import { ToolExecutionError } from "../errors/index.js";

/**
 * Runs a single tool call against registered tools
 */
export async function executeSingleTool(
  toolCall: ToolCall,
  tools: AITool[]
): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === toolCall.name);
  if (!tool) {
    return {
      toolCallId: toolCall.id,
      name: toolCall.name,
      result: null,
      error: `Tool '${toolCall.name}' is not registered.`
    };
  }

  if (!tool.execute) {
    return {
      toolCallId: toolCall.id,
      name: toolCall.name,
      result: null,
      error: `Tool '${toolCall.name}' does not have an execute function.`
    };
  }

  try {
    const result = await tool.execute(toolCall.arguments);
    return {
      toolCallId: toolCall.id,
      name: toolCall.name,
      result
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      toolCallId: toolCall.id,
      name: toolCall.name,
      result: null,
      error: `Execution error in tool '${toolCall.name}': ${errMsg}`
    };
  }
}

/**
 * Orchestrates multi-step recursive tool calling loop
 */
export async function runToolLoop(
  provider: AIProvider,
  initialOptions: ChatOptions
): Promise<AIResponse> {
  const maxSteps = initialOptions.maxToolSteps ?? 5;
  const tools = initialOptions.tools ?? [];

  // Normalize initial messages
  let messages: ChatMessage[] = [];
  if (initialOptions.messages) {
    messages = [...initialOptions.messages];
  } else if (initialOptions.prompt) {
    messages = [{ role: "user", content: initialOptions.prompt }];
  }

  let currentOptions: ChatOptions = {
    ...initialOptions,
    messages
  };

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalTokens = 0;

  for (let step = 0; step < maxSteps; step++) {
    const response = await provider.chat(currentOptions);

    if (response.usage) {
      totalPromptTokens += response.usage.promptTokens;
      totalCompletionTokens += response.usage.completionTokens;
      totalTokens += response.usage.totalTokens;
    }

    // If no tool calls were requested or tools list is empty, return final response
    if (!response.toolCalls || response.toolCalls.length === 0 || tools.length === 0) {
      if (totalTokens > 0 && response.usage) {
        response.usage = {
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalTokens
        };
      }
      return response;
    }

    // Model requested tool calls. Add assistant message with toolCalls
    messages.push({
      role: "assistant",
      content: response.text || "",
      toolCalls: response.toolCalls
    });

    // Execute all requested tool calls in parallel
    const toolResults = await Promise.all(
      response.toolCalls.map((tc) => executeSingleTool(tc, tools))
    );

    // Append each tool result as a tool message
    for (const res of toolResults) {
      messages.push({
        role: "tool",
        toolCallId: res.toolCallId,
        name: res.name,
        content: res.error
          ? JSON.stringify({ error: res.error })
          : typeof res.result === "string"
          ? res.result
          : JSON.stringify(res.result)
      });
    }

    // Update messages for next turn
    currentOptions = {
      ...currentOptions,
      messages
    };
  }

  // If max steps reached without stopping, make one final call without tools
  const finalOptions: ChatOptions = {
    ...currentOptions,
    tools: undefined,
    messages
  };

  return await provider.chat(finalOptions);
}
