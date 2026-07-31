# Momentum AI CV — Project Status

> **For a new Claude Code session:** read this file first. It has everything
> needed to resume without re-deriving context. Ask the user "anything changed
> since this was written?" if it's been a while.

## What this is

A Next.js 16 app called **Momentum AI CV (Centralized View)** — an enterprise
AI governance & framework advisor demo. Submit an AI/agentic use case,
get a computed risk tier, a real LLM-generated architecture recommendation,
an enforced governance gate, an auto-generated ADR, and (for Developers) real
multi-agent execution with full audit lineage.

**Context on why this exists:** built as a portfolio/interview demo for an
Enterprise AI Architect / Solution Architect role at **Momentum** (a real
South African financial services company), via a recruiter/partner referred
to as "LoC". The visual theme (red/navy, pill-shaped buttons) is deliberately
modeled on momentum.co.za's real branding — this is intentional and was
explicitly requested, not accidental scope creep. Treat any future "make it
look more like Momentum" feedback in that light.

## Tech stack

- Next.js 16.2.12 (App Router, Turbopack) — **this version has real breaking
  changes vs. older training data**: all of `cookies()`, `headers()`,
  `params`, `searchParams` are async now; `middleware` is renamed `proxy`.
  Check `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
  before assuming old Next.js APIs still work.
- React 19.2, TypeScript, Tailwind v4 (CSS-based theme in `src/app/globals.css`)
- No database — all state lives in the browser's `sessionStorage` via
  `src/lib/store.tsx` (a React Context + reducer-ish pattern)
- Multi-provider LLM fallback chain: Anthropic → OpenRouter → Groq → Gemini
  (`src/lib/llmProviders.ts`), configured via `.env.local` (see
  `.env.local.example` for the shape — **never commit real keys**)

## Dev workflow

```bash
npm run dev      # Turbopack dev server on :3000
npm run build    # production build — run this + tsc + eslint before calling anything done
npx tsc --noEmit
npx eslint .
```

The Claude Code Browser pane launch config lives at
`C:\Users\prasa\.claude\launch.json` (home-level, not project-level, because
the harness's cwd is the home directory) — points `npm run dev --prefix` at
this folder.

## Feature map (all built and verified working)

| Area | File(s) | Notes |
|---|---|---|
| Landing page | `src/app/page.tsx` | Colored navy hero band + 3 pre-seeded sample cards |
| Guide (roadmap + pattern library) | `src/app/guide/page.tsx`, `src/lib/patternLibrary.ts` | Step-by-step OSCAR pipeline walkthrough + frameworks/harness/loop/context catalog + MCP explainer |
| Intake | `src/app/intake/page.tsx` | Real-time computed risk tier as you fill the form |
| Risk classification | `src/lib/governance.ts` | Deterministic scoring: sensitivity × autonomy × blast-radius |
| Recommendation engine | `src/app/api/recommend/route.ts` | Real LLM call, rate-limited (5/IP/hr, 60 global/hr) |
| Architecture diagram | `src/components/ArchitectureDiagram.tsx` | **Just redesigned**: dark glowing "wired diagram" style (user-referenced image), real SVG connector lines computed via refs/ResizeObserver, animated loop-back arrow, status-colored nodes during live execution |
| Governance Gate | `src/app/gate/page.tsx` | Blocking checklist; **Critical tier also requires a separate ARB (Architecture Review Board) manual sign-off** that only the `arb` role can clear |
| ADR | `src/app/adr/page.tsx`, `src/lib/adr.ts` | Versioned, auto-generated once gate (incl. ARB if required) clears |
| Model Registry | `src/app/registry/page.tsx` | Models table + separate MCP Servers table |
| Portfolio | `src/app/portfolio/page.tsx` | All use cases + clickable pipeline-stage dots |
| Pipeline train | `src/components/PipelineTrain.tsx` | Always-visible stage labels; green=done, light-orange=pending, blinking-blue=current |
| Auth (simulated SSO) | `src/lib/auth.tsx`, `src/app/login/page.tsx` | 5 roles: requester, steward, governance-owner, developer, **arb** |
| Real execution engine | `src/app/api/plan/route.ts`, `src/app/api/execute-step/route.ts`, `src/app/execution/page.tsx` | Developer-only, gated behind cleared governance gate. Master agent plans (1 LLM call) → up to 4 sub-agent steps (1 LLM call each). Real tokens/cost/duration tracked. |
| Execution history / audit trail | `src/lib/store.tsx` (`executions: ExecutionRun[]`) | Every run gets a unique `id` + sequential `runNumber`; full step-level output preserved forever, never overwritten by the next run |
| Observability Dashboard | `src/app/dashboard/page.tsx`, `src/lib/telemetry.ts` | Real execution usage panel (measured) + simulated Gateway telemetry (randomized but seeded, clearly labeled) |
| Unified status colors | `src/app/globals.css` (`--status-*` vars, `.status-blink`) | Shared language: green/light-orange/blinking-blue, used by pipeline train + architecture diagram |

## Design decisions worth knowing

- **Samples never get clobbered on reload.** `store.tsx`'s `loadState()` only
  seeds a sample bundle if it's *not already* in sessionStorage — never
  overwrites one that exists, so a visitor's progress (gate acks, ARB
  approval, executions) survives a hard refresh. There's also a migration
  step in the same function that backfills missing fields (`executions`,
  ARB fields) on old-shaped bundles from earlier in dev, so schema changes
  don't crash returning sessions — **keep this pattern when adding new
  bundle/gate fields in the future.**
- **ARB approval is a separate gate from the regular controls checklist.**
  Only Critical tier requires it (`GovernanceTemplate.requiresArbApproval`).
  `finalizeGate` in `store.tsx` checks both `allAcknowledged` AND
  `(!requiresArbApproval || arbApproved)` before letting the use case
  proceed to ADR.
- **Telemetry PRNG**: `src/lib/telemetry.ts` uses a proper hash finalizer +
  mulberry32, not a naive LCG — the naive version produced long repeated
  runs of the same fake decision-trace entry when seeded with
  `id + incrementing-counter` (nearby seeds weren't decorrelated). If you
  ever touch this file, re-run the reproduction check before/after (see git
  history / ask for the node one-liner used to verify).

## Known non-blocking issues

- **Anthropic API key fails silently** and falls through to OpenRouter every
  time (fallback chain absorbs it, so the app works, but Claude is never
  actually the one answering). Never diagnosed *why* the key fails — worth
  checking if the user wants Claude as primary.
- **OpenRouter's free-tier model occasionally returns garbled/degenerate
  text** for a sub-agent step output (seen during testing: repeated `!!!!`
  spam, and once fully incoherent text). Not fixed. Options discussed but
  not built: reject-and-retry a step if output looks corrupted (e.g. regex
  for excessive repeated chars), or just accept it as an occasional rough
  edge in the demo since it's clearly attributed per-step (`openrouter ·
  tokens · cost · duration` shown under each step output).

## Nothing currently pending

As of this writing every discussed feature is built and verified (`npm run
build`, `tsc`, `eslint` all clean). If the user says "keep going" with no
specific ask, good next candidates *they've mentioned wanting to think
about* but not committed to:
- First-run interactive tour (tooltips on nav) — they chose the static Guide
  page instead, but floated this as a "maybe both" option earlier.
- Retry/quality-check for garbled sub-agent execution output (see above).

## How to verify quickly after resuming

1. `npm run build` (or `npx tsc --noEmit && npx eslint .` for a fast check)
2. Start the dev server, clear `sessionStorage`, click through: Landing →
   sample card → Recommendation (check diagram) → Gate (check controls +
   ARB section if Critical) → ADR → sign in as Developer → Execute → check
   Dashboard shows real usage.
3. Sign in as each of the 5 roles once to confirm nav/redirects/access
   gating still behave (`requester`/`steward`/`governance-owner` → intake;
   `developer`/`arb` → portfolio; only `developer` sees Execute nav link;
   only `arb` can approve the Critical-tier sign-off).
