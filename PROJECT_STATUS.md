# EGPA — Project Status

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

- App code: fully built, committed, pushed to a private GitHub repo
  (branch `main`). `master` (local) tracks `origin/main`. **Note:** the
  repo's own name/slug on GitHub may still contain the old branding until
  renamed via GitHub Settings - I can't rename it from here (no `gh` CLI
  access in this environment).
- Vercel: linked and deployed to production. **Note:** the Vercel project's
  name/URL may still contain the old branding until renamed - see the
  "Naming and branding" section above.
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
    billing on it → `gcloud run deploy egpa-litellm-gateway --source .
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
   `https://egpa-litellm-gateway-xxxxx-uc.a.run.app` URL.
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
7. Optional cleanup: delete the abandoned `egpa-litellm-gateway`
   service on Render (free tier, not costing anything, no rush).

---
