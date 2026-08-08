import Link from "next/link";

// Static, purely explanatory flow diagram for first-time visitors on the
// landing page - unlike PipelineTrain (a live per-use-case progress
// tracker) or ArchitectureDiagram (computed from a specific
// recommendation), this always shows the same 7 real stages in order, each
// a real page in the app. Colors come from the app's own validated
// categorical --series-1..8 tokens (light/dark theme aware, see
// globals.css) - one hue per stage, not a status color, since these are
// categories, not states.
interface FlowStage {
  n: number;
  title: string;
  description: string;
  href: string;
  color: string;
}

const STAGES: FlowStage[] = [
  {
    n: 1,
    title: "Discovery",
    description: "Question the default before building anything - chat, check what exists.",
    href: "/discovery",
    color: "var(--series-7)",
  },
  {
    n: 2,
    title: "Intake",
    description: "Describe the use case - risk tier starts computing live as you answer.",
    href: "/intake",
    color: "var(--series-1)",
  },
  {
    n: 3,
    title: "Recommendation",
    description: "Real LLM proposes the architecture, tools, and alternatives it passed over.",
    href: "/recommendation",
    color: "var(--series-2)",
  },
  {
    n: 4,
    title: "Governance Gate",
    description: "Required controls plus, at Critical tier, a named reviewer's real reasoning.",
    href: "/gate",
    color: "var(--series-4)",
  },
  {
    n: 5,
    title: "ADR",
    description: "A versioned decision record assembles automatically once the gate clears.",
    href: "/adr",
    color: "var(--series-3)",
  },
  {
    n: 6,
    title: "Execution",
    description: "A real multi-agent run - live token stream, real tool calls, real cost.",
    href: "/execution",
    color: "var(--series-8)",
  },
  {
    n: 7,
    title: "Observability",
    description: "Portfolio-wide cost, usage, and decision trail - nothing simulated.",
    href: "/dashboard",
    color: "var(--series-5)",
  },
];

function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4 flex-none text-[var(--muted)]">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4 flex-none text-[var(--muted)]">
      <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PipelineFlowDiagram() {
  return (
    <div>
      <div className="flex flex-col gap-0 sm:hidden">
        {STAGES.map((stage, i) => (
          <div key={stage.n}>
            <Link
              href={stage.href}
              className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-transform hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: stage.color }}
              >
                {stage.n}
              </span>
              <span>
                <span className="block text-sm font-semibold text-[var(--brand-strong)]">{stage.title}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{stage.description}</span>
              </span>
            </Link>
            {i < STAGES.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="hidden sm:flex sm:flex-wrap sm:items-stretch sm:gap-x-2 sm:gap-y-6">
        {STAGES.map((stage, i) => (
          <div key={stage.n} className="flex items-center gap-2">
            <Link
              href={stage.href}
              className="flex w-40 flex-col items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-transform hover:-translate-y-0.5 hover:shadow-md lg:w-44"
            >
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: stage.color }}
              >
                {stage.n}
              </span>
              <span className="text-sm font-semibold text-[var(--brand-strong)]">{stage.title}</span>
              <span className="text-xs leading-snug text-[var(--muted)]">{stage.description}</span>
            </Link>
            {i < STAGES.length - 1 && <ArrowRight />}
          </div>
        ))}
      </div>
    </div>
  );
}
