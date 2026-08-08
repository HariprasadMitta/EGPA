import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { toolsCondition } from "@langchain/langgraph/prebuilt";
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { buildAgentModel } from "@/lib/agentModel";
import { knowledgeBaseSearch } from "@/lib/knowledgeBase";
import { logToolCall } from "@/lib/toolCallLog";
import { estimateCostUsd } from "@/lib/pricing";

export interface StepInput {
  useCaseTitle: string;
  useCaseDescription: string;
  masterAgentSummary: string;
  executionId: string;
  stepId: string;
  step: { name: string; tool: string; task: string; rationale?: string };
  // Real output from every already-completed step in this run, in order -
  // genuine inter-step feedback the sub-agent actually reads, not just a
  // UI display artifact. Empty for the first step.
  priorSteps: { name: string; output: string }[];
}

// Real agent-loop telemetry, additive to the existing token/done/error
// events every consumer already handles (execute-step's SSE relay, the
// webhook background loop) - a consumer that only switches on "token" and
// "done"/"error" (the webhook loop does exactly this) simply ignores these,
// so adding them can't change existing execution behavior. Lets the UI show
// which LangGraph node is active and when the one real tool this graph can
// call (knowledge_base_search) is actually invoked, instead of only ever
// showing the token stream.
export type StepEvent =
  | { type: "token"; text: string }
  | { type: "node"; node: "agent" | "tools" }
  | { type: "model"; provider: string }
  | { type: "tool_call"; toolName: string }
  | { type: "tool_result"; toolName: string; result: string }
  | { type: "usage_delta"; inputTokens: number; outputTokens: number }
  | {
      type: "done";
      output: string;
      provider: string;
      inputTokens: number;
      outputTokens: number;
      costUsd: number;
      durationMs: number;
    }
  | { type: "error"; error: string };

function buildSystemPrompt(step: StepInput["step"], hasPriorSteps: boolean): string {
  return `You are the sub-agent "${step.name}", responsible for the tool "${step.tool}"
within a larger multi-agent execution. Carry out your assigned task and report
back to the master agent in 2-4 concise sentences: what you did and what you
found or produced. Be specific and concrete for this use case, not generic.
${
  hasPriorSteps
    ? `Real output from every already-completed step in this run is included below as
"Prior step output" - actually use it (build on it, reference specific facts
from it, flag a contradiction if there is one) rather than starting fresh as
if this were the first step.`
    : ""
}
You have a knowledge_base_search tool available - use it if this task would
genuinely benefit from citing real policy or reference material, otherwise
just answer directly. Plain text only - no JSON, no markdown, no preamble
like "As the sub-agent...".`;
}

const TOOLS = [knowledgeBaseSearch];

// A custom tools node (rather than the prebuilt ToolNode) so every real
// invocation is persisted to ToolCallLog - real audit logging of the
// "Audit logging" governance control, not just a one-time acknowledgment.
export function buildGraph(executionId: string, stepId: string) {
  const { model: gatewayModel, getLastModelName } = buildAgentModel();
  const model = gatewayModel.bindTools(TOOLS);

  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  }

  async function callTools(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
    const toolMessages: ToolMessage[] = [];
    for (const call of lastMessage.tool_calls ?? []) {
      const argsJson = JSON.stringify(call.args);
      let result: string;
      try {
        result = String(await knowledgeBaseSearch.invoke(call.args as { query: string }));
      } catch (err) {
        result = `Tool error: ${(err as Error).message}`;
      }
      await logToolCall({ executionId, stepId, toolName: call.name, argsJson, result });
      toolMessages.push(new ToolMessage({ content: result, tool_call_id: call.id ?? "" }));
    }
    return { messages: toolMessages };
  }

  const graph = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", callTools)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition, ["tools", END])
    .addEdge("tools", "agent")
    .compile();

  return { graph, getLastModelName };
}

// Shared by both /api/execute-step (streams tokens to the browser as SSE)
// and the webhook trigger route's headless background loop (consumes the
// same generator, just ignoring token events since nobody's watching) - one
// implementation of the graph invocation and cost accounting.
export async function* runStep(input: StepInput): AsyncGenerator<StepEvent> {
  const start = Date.now();
  const priorStepsBlock =
    input.priorSteps.length > 0
      ? `\n\nPrior step output (real, from this same run, in order):\n${input.priorSteps
          .map((s) => `- ${s.name}: ${s.output}`)
          .join("\n")}`
      : "";
  const userMessage = `Use case: ${input.useCaseTitle}
Description: ${input.useCaseDescription}
Master agent's plan: ${input.masterAgentSummary}
${input.step.rationale ? `Why this tool was assigned to this step: ${input.step.rationale}` : ""}
Your task: ${input.step.task}${priorStepsBlock}`;

  const { graph, getLastModelName } = buildGraph(input.executionId, input.stepId);

  let output = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const events = await graph.stream(
      { messages: [new SystemMessage(buildSystemPrompt(input.step, input.priorSteps.length > 0)), new HumanMessage(userMessage)] },
      { streamMode: "messages" }
    );

    let lastNode: string | undefined;
    let modelAnnounced = false;
    let toolCallAnnounced = false;

    for await (const event of events) {
      const [chunk, metadata] = event as [AIMessageChunk, { langgraph_node?: string }];
      const node = metadata?.langgraph_node;

      if ((node === "agent" || node === "tools") && node !== lastNode) {
        lastNode = node;
        yield { type: "node", node };
      }

      if (node === "tools") {
        // The tools node (buildGraph's callTools) returns its ToolMessage(s)
        // whole, not as streamed deltas - chunk.content here is already the
        // real, complete tool result text. TOOLS has exactly one entry
        // (knowledgeBaseSearch), so attributing this result to it is a real
        // fact, not a guess.
        const resultText = typeof chunk.content === "string" ? chunk.content : "";
        if (resultText) yield { type: "tool_result", toolName: "knowledge_base_search", result: resultText };
        continue;
      }
      if (node !== "agent") continue;

      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        if (!toolCallAnnounced) {
          toolCallAnnounced = true;
          yield { type: "tool_call", toolName: "knowledge_base_search" };
        }
        continue;
      }

      if (!modelAnnounced) {
        // Real per-request provider attribution (x-litellm-model-name) is
        // captured by agentModel.ts's custom fetch as soon as the response
        // headers arrive, which happens before any content chunk reaches
        // this loop - safe to read here, not just at the end.
        const modelName = getLastModelName();
        if (modelName) {
          modelAnnounced = true;
          yield { type: "model", provider: modelName };
        }
      }

      const text = typeof chunk.content === "string" ? chunk.content : "";
      if (text) {
        output += text;
        yield { type: "token", text };
      }
      if (chunk.usage_metadata) {
        inputTokens = chunk.usage_metadata.input_tokens ?? inputTokens;
        outputTokens = chunk.usage_metadata.output_tokens ?? outputTokens;
        yield { type: "usage_delta", inputTokens, outputTokens };
      }
    }

    const modelName = getLastModelName();
    yield {
      type: "done",
      output: output.trim(),
      provider: modelName ?? "egpa-primary",
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(modelName, inputTokens, outputTokens),
      durationMs: Date.now() - start,
    };
  } catch (err) {
    yield { type: "error", error: `Sub-agent execution error: ${(err as Error).message}` };
  }
}
