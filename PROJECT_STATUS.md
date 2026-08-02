# Momentum-LOC AI CV — Project Status

> **For a new Claude Code session:** read this file first. It has everything
> needed to resume without re-deriving context. Ask the user "anything changed
> since this was written?" if it's been a while.

## ⚠️ Current checkpoint (2026-08-02) — read this before anything below

Everything below this section describes an **early** version of the app and
is stale (no database, wrong app name, old feature list). **README.md is the
accurate, maintained doc** for what the app actually is and does now - it's
been through 11+ real build phases since this file was last touched (real DB,
real auth, real tool-calling execution, real live sync, real governance, real
AI Gateway, deeper risk-scored intake, a real Observability overhaul). Read
README.md for the real picture; treat this file's sections below only as
historical color if useful.

**Enterprise backlog: all 23 items done (2026-08-02).** The user asked
(after three brainstorming rounds) to add 23 "make this a great enterprise
product" ideas to a task list, then said "complete all of it" - all 23 are
now real, fully-wired features (schema + backend + UI + verified in browser
or via `npx tsc --noEmit && npx eslint . && npm run build`, consistent with
this app's "no fake data" ethos): governance audit trail, recertification
enforcement, org-scoped visibility + real multi-tenancy (`Organization`
model, tenant + business-unit filtering in `GET /api/use-cases`), Slack
notifications, cost budgets/alerts, a real unit-test suite (Vitest -
`npm test`, 26 tests across `governance.ts`/`adr.ts`/`piiDetection.ts`/
`confidence.ts`/`lineDiff.ts`), a real public REST API with API keys, Google
SSO alongside local auth, CSV compliance export, real PII
detection/redaction, real drift/anomaly monitoring, real scheduled data
retention purge (Vercel Cron), confidence scoring on step outputs, dry-run
execution mode, Model Registry CRUD, per-tenant usage quotas, comments
threads, live presence indicators, ADR version diffing, data-sensitivity
tool restrictions, and historical-performance-informed model recommendations.
See the full file list in git history / `git log` around
2026-08-02 for exact commits. **Nothing left on that backlog** - if the user
says "keep going" with no specific ask, the honest answer is deployment
(below) is the only real open thread.

**What's actively in progress right now: real deployment.** State:

- App code: fully built, committed, pushed to
  `https://github.com/HariprasadMitta/Momentum-LOC-AICV` (branch `main`).
  `master` (local) tracks `origin/main`.
- Vercel: project `momentum-loc-aicv` is **linked** (`.vercel/project.json`
  exists) under team `momentum-aicv`, but **not yet deployed** - no
  `vercel --prod` has been run yet.
- Redis (Upstash): real `REDIS_URL` is in `.env.local`, the live-sync code
  (`src/lib/eventBus.ts`) is swapped to real ioredis pub/sub and **verified
  working** (two-tab cross-browser test passed against real Upstash).
- AI Gateway hosting (the blocker): the local-only LiteLLM proxy needs a
  public URL for the deployed app to reach (it can't call `localhost:4000`).
  - First tried **Render** (`render.yaml`, now deleted) - free tier (512MB
    RAM) OOM-killed the process at startup; a real prisma-version-drift bug
    was found and fixed along the way (pin `prisma==0.15.0` in
    `requirements.txt` - litellm's own dependency spec is an open range and
    resolves differently each install) but didn't fix the memory ceiling.
  - Now targeting **Google Cloud Run** instead (`Dockerfile` + `.dockerignore`
    at repo root, real memory headroom configurable). User has a GCP project
    (`project-58c05d21-8d4c-4df7-868`) and was working through: enable
    billing on it → `gcloud run deploy momentum-litellm-gateway --source .
    --region us-central1 --memory 1Gi --allow-unauthenticated
    --set-env-vars "..."` (full command with real values was given in chat,
    not repeated here since it contains real secrets - check chat history
    or `.env.local` for the actual key values if the command needs
    reconstructing).
  - **As of this checkpoint: billing was not yet confirmed enabled, deploy
    command had not yet succeeded.** This is the very next step.
- A `LITELLM_MASTER_KEY` was freshly generated for the hosted instance
  (different from the local one) - it's already embedded in the deploy
  command above; don't regenerate it, reuse the same one so past deploy
  attempts and the next one stay consistent.
- Real fallback built either way: `LLM_DIRECT_MODE=true` (env var, set only
  on the deployed app, never locally) makes the app call OpenRouter directly,
  bypassing the Gateway entirely - a real, working escape hatch
  (`src/lib/llmDirect.ts`) if the Gateway hosting saga doesn't resolve
  quickly. Not currently enabled anywhere.

**Next steps in order, once resumed:**
1. Confirm Cloud Run deploy succeeded; get the real
   `https://momentum-litellm-gateway-xxxxx-uc.a.run.app` URL.
2. Mint a fresh virtual key against that hosted instance (`/key/generate`
   with the master key above), set it + the real base URL as
   `LITELLM_VIRTUAL_KEY` / `LITELLM_BASE_URL` on Vercel (production env).
3. Push all other real env vars (DATABASE_URL, AUTH_SECRET, NEON_API_KEY,
   NEON_PROJECT_ID, REDIS_URL, PINECONE_API_KEY, COHERE_API_KEY, HF_*,
   OPENROUTER/ANTHROPIC/GROQ/GEMINI keys - see `.env.local` for real values,
   never commit them) to Vercel.
4. Run `npx vercel --prod` - **confirm with the user immediately before
   this step**, it's a real publish.
5. Fix `HF_REDIRECT_URI` / `NEXT_PUBLIC_HF_REDIRECT_URI` to the real
   assigned `*.vercel.app` domain and redeploy.
6. Verify against the live URL: sign-in, a real execution end-to-end, a
   webhook trigger from outside the browser, live sync across two tabs,
   kill-switch/gate rejections - same proof pattern as every other phase.
7. Optional cleanup: delete the abandoned `momentum-litellm-gateway`
   service on Render (free tier, not costing anything, no rush).

---

## Stale historical content below (pre-database era) - see README.md instead

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
