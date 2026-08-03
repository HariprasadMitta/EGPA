# Momentum-LOC AI CV — Centralized View

An enterprise AI governance & control-plane platform, live in production at
[momentum-loc-aicv.vercel.app](https://momentum-loc-aicv.vercel.app). Submit
an AI/agentic use case, get a computed risk tier, a real LLM-generated
architecture recommendation, an enforced governance gate (with real ARB
sign-off and segregation of duties), an auto-generated Architecture Decision
Record, and — for approved use cases — a real multi-agent execution with
full audit lineage, running through a real self-hosted AI Gateway.

Enforced architecture, not optional policy, for an organization with
federated business units and real multi-tenancy. What started as a
front-end-only demo was rebuilt, incrementally, into a genuinely working
system: a real database, real authentication (local + Google SSO), real
tool-calling agents, real live multi-user sync, real runtime governance,
real deployment on Vercel + Google Cloud Run, and a tamper-evident audit
log — see [What's real, and in what order](#whats-real-and-in-what-order)
below for how and why.

## What you get for every use case

1. **A recommended framework & tool stack** — real LLM call, framework-agnostic
2. **Harness, loop, and context strategy** — with an iteration ceiling matched to risk
3. **A computed governance verdict** — risk tier, required controls, and HITL level you must satisfy, not opt into
4. **An auto-generated, versioned Architecture Decision Record** — downloadable as markdown, traceable to every decision above; this is the real spec for whatever gets built in production
5. **A real multi-agent execution** (once approved) — real LLM-backed sub-agents, real tool calls, real cost/token tracking, real PII detection/redaction, streamed live
6. **Real runtime enforcement** — a kill-switch that actually blocks the next execution step, a tool-allowlist enforced server-side (not just checked), and a webhook that can trigger a run with zero human click
7. **A path to real production deployment** — a real, scoped preflight-check API and an actual-usage reconciliation API so an agent built and run *outside* this platform (with real tool/system integrations) still can't deviate from what was declared without it being caught, audited, and alerted
8. **Reject / resubmit** — an ARB member or Governance Owner can reject a use case with a required, audited reason; the owner resubmits through a fresh gate
9. **In-app password reset** — no third-party email vendor; a real, hashed, single-use reset token, link shown in-app

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

**Live now:** [momentum-loc-aicv.vercel.app](https://momentum-loc-aicv.vercel.app)

**As a visitor:** sign up (pick any role — Admin gives full access), then
walk the pipeline: Intake → Risk & Compliance Profile → Recommendation →
Governance Gate → ADR → Execution → Observability. Or open Portfolio and
click into one of the existing use cases to see a fully populated run
without typing anything — the Portfolio includes real examples across every
status, including Rejected and Rejected-then-resubmitted.

Forgot your password? Use the "Forgot password?" link on the sign-in page —
the reset link is shown directly in-app (no email service is wired up, by
design).

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
- **Real AI Gateway** — a self-hosted LiteLLM Proxy on Google Cloud Run in front of every LLM call, replacing hand-rolled provider fallback; the app holds one scoped virtual key, never raw provider keys — covering API management, integration, model serving/fallback, and feeding this app's own observability layer
- **One-stop in-app guide** — `/guide` documents every page, button, role, and governance concept in the app itself
- **Real deployment** — the Next.js app runs on Vercel, the AI Gateway on Google Cloud Run, the database on Neon, rate limiting/presence/SSE state on Redis — all live in production, not local-only

**Enterprise hardening**
- **Multi-tenancy** — real Organization + business-unit scoped visibility, enforced server-side on every query
- **SSO** — Google OIDC alongside local credentials auth
- **Tamper-evident audit log** — a SHA-256 hash chain over every entry; editing history breaks verification, checkable on demand
- **Segregation of duties** — a use case owner can never clear their own ARB sign-off, even holding the ARB role
- **Real PII masking** — regex-based detection/redaction run against every real sub-agent step output (including a South African ID-number pattern), not a one-time checkbox
- **Real data retention enforcement** — a scheduled purge job deletes real rows once they pass each use case's own declared retention window, logged for audit
- **Declared-vs-actual reconciliation & preflight-check API** — the two mechanisms that let an agent built and run *outside* this platform still be governed: a real-time "am I allowed to do this" check, and after-the-fact usage reporting that flags any deviation
- **Rate limiting, scoped API keys, cost budgets/quotas, recertification, delegation, escalation, evidence export** — see the full list in the in-app Guide

### What's honestly still not real

- **No real external system integrations** — the platform enforces a
  *declared* tool allowlist and reconciles *actual* usage, but building the
  real integration (a real wire-transfer system, a real ticketing API, etc.)
  is deliberately out of scope — that's the org's own engineering work,
  informed by the ADR this platform produces.
- **Momentum's own execution engine is a validation sandbox, not a
  production host** — it runs a real LLM against a real Gateway, but its
  only real callable tool is an internal knowledge-base search. It's for
  validating the recommended pattern and governance behavior, not for
  running an agent against real production data.

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 ·
Prisma 7 + Neon Postgres · Auth.js v5 (credentials + Google OIDC) ·
LangGraph + LangChain · Pinecone + Cohere (RAG) · LiteLLM Proxy (AI Gateway,
on Google Cloud Run) · Redis (rate limiting, presence, quotas) ·
Server-Sent Events (streaming + live sync) · deployed on Vercel
