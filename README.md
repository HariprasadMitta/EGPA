# Momentum-LOC AI CV — Centralized View

An enterprise AI governance & framework advisor. Submit an AI/agentic use
case, get a computed risk tier, a real LLM-generated architecture
recommendation, an enforced governance gate, an auto-generated Architecture
Decision Record, and — for approved use cases — a real multi-agent
execution with full audit lineage, running through a real self-hosted AI
Gateway.

Built as a portfolio/interview demo for an Enterprise AI Architect role at
Momentum (a South African financial services company) — enforced
architecture, not optional policy, for an organization with federated
business units. What started as a front-end-only demo was rebuilt,
incrementally, into a genuinely working system: a real database, real
authentication, real tool-calling agents, real live multi-user sync, real
runtime governance, and a real AI Gateway — see [What's real, and in what
order](#whats-real-and-in-what-order) below for how and why.

## What you get for every use case

1. **A recommended framework & tool stack** — real LLM call, framework-agnostic
2. **Harness, loop, and context strategy** — with an iteration ceiling matched to risk
3. **A computed governance verdict** — risk tier, required controls, and HITL level you must satisfy, not opt into
4. **An auto-generated, versioned Architecture Decision Record** — downloadable, traceable to every decision above
5. **A real multi-agent execution** (once approved) — real LLM-backed sub-agents, real tool calls, real cost/token tracking, streamed live
6. **Real runtime enforcement** — a kill-switch that actually blocks the next execution step, and a webhook that can trigger a run with zero human click

## Who it's for

| Role | Pages they use | What they get |
|---|---|---|
| Requester | Intake, Portfolio | Turn a business idea into a governed, documented use case without knowing AI architecture yourself |
| Steward / Architect | Recommendation, Guide | Validate the recommended architecture against real technical constraints |
| Governance Owner | Governance Gate, ADR | Enforce required controls are actually satisfied; can halt a running execution in real time |
| Developer | Execution, Model Builder, Observability | The only role that can run an approved use case, or wire up a webhook to trigger it automatically |
| Review Board (ARB) | Governance Gate (Critical tier) | The one sign-off no other role can substitute for on Critical-tier use cases |
| Admin | Everything | Full access, for testing/demoing every role's view |

Full walkthrough with every button and control explained: open the app and
go to **Guide** (`/guide`) — it's built as a one-stop in-app reference, not
just this file.

## How to use it

**As a visitor:** sign up (pick any role — Admin gives full access), then
walk the pipeline: Intake → Risk & Compliance Profile → Recommendation →
Governance Gate → ADR → Execution → Observability. Or open Portfolio and
click into one of the pre-seeded sample use cases to see a fully populated
run without typing anything.

**Running it locally:**

```bash
npm install
npm run dev      # Turbopack dev server on :3000
```

Prerequisites (all free-tier, real accounts you provision yourself — see
`.env.local.example` for every variable):

- **Neon Postgres** (neon.tech) — the app's own database
- **Anthropic and/or OpenRouter/Groq/Gemini API keys** — at least one, for
  the AI Gateway to route to
- **Pinecone + Cohere** (free tiers) — real vector search backing the
  `knowledge_base_search` tool sub-agents can call
- **Python 3 + `pip install 'litellm[proxy]'`** — the AI Gateway proxy
  (see `litellm-config.yaml`), plus its own separate free Neon Postgres
  project for virtual-key/spend state (deliberately not the same database
  the app uses)

```bash
npx prisma migrate deploy   # app's own schema
npx prisma db seed          # 3 pre-built sample use cases
# start the LiteLLM proxy per litellm-config.yaml, then generate a virtual
# key via its /key/generate endpoint and put it in .env.local
```

Then `npx tsc --noEmit && npx eslint . && npm run build` before considering
any change done.

## What's real, and in what order

Built incrementally, each capability shipped, verified live in the browser,
and committed before the next started.

**Foundation**
- **Database** — Prisma + Neon Postgres, replacing an earlier sessionStorage-only prototype
- **Authentication** — Auth.js v5, real accounts, real hashed passwords, real sessions
- **Database-backed store** — the full intake→recommendation→gate→ADR→execution pipeline persists for real, shared across every signed-in user (a federated org's reviewers all see the same record)

**Execution**
- **Real tool-calling execution** — LangGraph + Pinecone + Cohere; sub-agents can actually retrieve real documents, not narrate; token-by-token streaming
- **Live multi-user sync** — one person's action shows up on another's screen within ~1s, no refresh (SSE broadcast)
- **Real event triggering** — a real webhook lets an external caller start an execution with zero human clicking "Run execution," under identical governance checks

**Governance & observability**
- **Real runtime governance** — audit log, tool allowlist enforcement (the concrete version of "the agent may have access to everything, tag what it's actually allowed to touch"), and a kill-switch actually enforced at execution time, not just a checkbox
- **Real audit/telemetry** — Observability shows only real, measured data across the whole portfolio (stat tiles, time series, by-model/by-tool/by-risk-tier breakdowns, expandable execution history); all seeded-random "simulated telemetry" removed
- **Deeper intake & real risk scoring** — a second questionnaire page captures real risk/compliance/security/accountability/transparency due-diligence, and two of those answers (human oversight frequency, customer-impact decision) genuinely move the computed risk tier, not just get recorded

**Platform**
- **Real AI Gateway** — a self-hosted LiteLLM Proxy in front of every LLM call, replacing hand-rolled provider fallback; the app holds one scoped virtual key, never raw provider keys — covering API management, integration, model serving/fallback, and feeding this app's own observability layer
- **One-stop in-app guide** — `/guide` documents every page, button, role, and governance concept in the app itself
- **Real deployment** — planned (Vercel + Upstash Redis), deliberately paused until the application itself is finished

### What's honestly still not real

- **No real external system integrations** — the demo use cases (a Slack
  notification, an internal contract repository, etc.) have no real backend
  to integrate with; this would need a real target system to be worth
  building.
- **No hosting/deployment yet** — both the app and the AI Gateway run
  locally only, by design, until the application itself is finished.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
Prisma 7 + Neon Postgres · Auth.js v5 · LangGraph + LangChain · Pinecone +
Cohere (RAG) · LiteLLM Proxy (AI Gateway) · Server-Sent Events (streaming +
live sync)
