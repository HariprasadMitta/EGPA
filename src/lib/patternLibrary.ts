export interface CatalogEntry {
  name: string;
  description: string;
  whenToUse: string;
}

export const FRAMEWORKS: CatalogEntry[] = [
  {
    name: "LangGraph",
    description: "Graph-based orchestration where each node is a step and edges define control flow explicitly.",
    whenToUse: "Multi-step pipelines that need an auditable, explicit state graph - good fit for Medium/High tier work.",
  },
  {
    name: "AutoGen",
    description: "Multi-agent conversation framework where agents exchange messages to reach a result.",
    whenToUse: "Tasks that decompose naturally into a handful of specialist agents talking to each other.",
  },
  {
    name: "Bedrock Agents",
    description: "AWS-managed agent runtime with built-in action groups and knowledge base retrieval.",
    whenToUse: "Teams already standardized on AWS wanting a managed runtime instead of self-hosting orchestration.",
  },
  {
    name: "Custom orchestrator on the Claude Agent SDK",
    description: "Hand-rolled control loop using the Agent SDK directly, for full control over prompts and tool dispatch.",
    whenToUse: "Safety-critical or highly bespoke harness requirements that off-the-shelf frameworks don't fit cleanly.",
  },
  {
    name: "CrewAI",
    description: "Role-based multi-agent framework where each agent has a defined role, goal, and backstory.",
    whenToUse: "Business-process-shaped work that maps naturally onto named roles (e.g. researcher, writer, reviewer).",
  },
];

export const HARNESS_PATTERNS: CatalogEntry[] = [
  {
    name: "Single-agent with tool-calling loop",
    description: "One agent, a fixed tool list, loops until it decides it's done.",
    whenToUse: "Low risk, narrow-scope tasks with a small, well-understood tool surface.",
  },
  {
    name: "Supervisor + worker sub-agents",
    description: "A supervisor agent decomposes work and dispatches to specialized workers, then assembles results.",
    whenToUse: "Medium/High tier work spanning multiple distinct capabilities (e.g. classify, then draft, then route).",
  },
  {
    name: "Single-agent with mandatory approval gate before write actions",
    description: "The agent can read and reason freely, but every state-changing action is hard-blocked pending human sign-off.",
    whenToUse: "Critical tier or anything with a safety-adjacent blast radius - the harness enforces HITL, not just policy.",
  },
  {
    name: "Multi-agent debate/critique",
    description: "Two or more agents propose and critique each other's answer before a final decision.",
    whenToUse: "High-stakes judgment calls where a second perspective materially reduces error rate.",
  },
];

export const LOOP_PATTERNS: CatalogEntry[] = [
  {
    name: "Simple ReAct",
    description: "Reason, act, observe, repeat - no extra reflection step.",
    whenToUse: "Low risk tasks where the first reasonable answer is good enough.",
  },
  {
    name: "ReAct with reflection step",
    description: "Same as ReAct, but the agent critiques its own draft answer before finalizing.",
    whenToUse: "Medium/High tier tasks where a self-check meaningfully improves quality without a second agent.",
  },
  {
    name: "Plan-then-execute",
    description: "Produce a full plan up front, then execute steps against it rather than deciding one step at a time.",
    whenToUse: "Multi-step pipelines where the plan itself should be auditable before any action runs.",
  },
];

export const CONTEXT_STRATEGIES: CatalogEntry[] = [
  {
    name: "Full context, no compaction needed",
    description: "Everything relevant fits comfortably in the model's context window as-is.",
    whenToUse: "Short-lived, single-shot tasks with small inputs.",
  },
  {
    name: "Sliding window with tool-result summarization",
    description: "Older tool results get summarized down as the loop progresses so the window stays bounded.",
    whenToUse: "Longer-running loops with many tool calls where raw results would blow the budget.",
  },
  {
    name: "Full context per ticket, no cross-ticket carryover",
    description: "Each unit of work gets a clean context; nothing leaks between items processed in sequence.",
    whenToUse: "Batch processing where cross-contamination between items would be a real risk (e.g. PII isolation).",
  },
];

export const MCP_EXPLAINER = {
  name: "Model Context Protocol (MCP)",
  description:
    "An open standard for exposing tools, data, and prompts to an LLM through a common server interface, instead of writing a bespoke integration per tool per framework.",
  whyItMatters: [
    "Decouples the tool's implementation from any one agent framework - swap LangGraph for AutoGen and the same MCP server still works.",
    "Gives governance a single chokepoint: approve an MCP server once (see the Model Registry) rather than auditing every framework-specific integration separately.",
    "Growing ecosystem of ready-made servers (filesystem, GitHub, databases, Slack) means less bespoke integration code to build and maintain.",
  ],
  tradeoff:
    "Adds a network hop and a process to run/monitor per server - for a single throwaway script, a direct API call is still simpler.",
};
