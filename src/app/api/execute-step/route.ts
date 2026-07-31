import { StateGraph, MessagesAnnotation, START, END } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { HumanMessage, SystemMessage, AIMessageChunk } from "@langchain/core/messages";
import { buildAgentModel, resolveAgentProvider } from "@/lib/agentModel";
import { knowledgeBaseSearch } from "@/lib/knowledgeBase";
import { estimateCostUsd } from "@/lib/pricing";
import { clientIp } from "@/lib/rateLimit";
import { executionLimiter } from "@/lib/executionLimiter";

export const runtime = "nodejs";

interface ExecuteStepRequestBody {
  useCaseTitle: string;
  useCaseDescription: string;
  masterAgentSummary: string;
  step: { name: string; tool: string; task: string };
}

function buildSystemPrompt(step: ExecuteStepRequestBody["step"]): string {
  return `You are the sub-agent "${step.name}", responsible for the tool "${step.tool}"
within a larger multi-agent execution. Carry out your assigned task and report
back to the master agent in 2-4 concise sentences: what you did and what you
found or produced. Be specific and concrete for this use case, not generic.
You have a knowledge_base_search tool available - use it if this task would
genuinely benefit from citing real policy or reference material, otherwise
just answer directly. Plain text only - no JSON, no markdown, no preamble
like "As the sub-agent...".`;
}

const TOOLS = [knowledgeBaseSearch];

function buildGraph(provider: ReturnType<typeof resolveAgentProvider>) {
  const model = buildAgentModel(provider).bindTools(TOOLS);

  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);
    return { messages: [response] };
  }

  return new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", new ToolNode(TOOLS))
    .addEdge(START, "agent")
    .addConditionalEdges("agent", toolsCondition, ["tools", END])
    .addEdge("tools", "agent")
    .compile();
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  const gate = executionLimiter.check(ip);
  if (!gate.allowed) {
    return Response.json({ error: gate.reason }, { status: 429 });
  }

  let provider: ReturnType<typeof resolveAgentProvider>;
  try {
    provider = resolveAgentProvider();
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  let body: ExecuteStepRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.step?.name || !body.step?.tool || !body.step?.task) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  const userMessage = `Use case: ${body.useCaseTitle}
Description: ${body.useCaseDescription}
Master agent's plan: ${body.masterAgentSummary}

Your task: ${body.step.task}`;

  const graph = buildGraph(provider);
  const start = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      let output = "";
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const events = await graph.stream(
          {
            messages: [new SystemMessage(buildSystemPrompt(body.step)), new HumanMessage(userMessage)],
          },
          { streamMode: "messages" }
        );

        for await (const event of events) {
          const [chunk, metadata] = event as [AIMessageChunk, { langgraph_node?: string }];
          if (metadata?.langgraph_node !== "agent") continue;
          if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) continue;

          const text = typeof chunk.content === "string" ? chunk.content : "";
          if (text) {
            output += text;
            send({ type: "token", text });
          }
          if (chunk.usage_metadata) {
            inputTokens = chunk.usage_metadata.input_tokens ?? inputTokens;
            outputTokens = chunk.usage_metadata.output_tokens ?? outputTokens;
          }
        }

        executionLimiter.record(ip);

        send({
          type: "done",
          output: output.trim(),
          provider,
          inputTokens,
          outputTokens,
          costUsd: estimateCostUsd(provider, inputTokens, outputTokens),
          durationMs: Date.now() - start,
        });
      } catch (err) {
        send({ type: "error", error: `Sub-agent execution error: ${(err as Error).message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
