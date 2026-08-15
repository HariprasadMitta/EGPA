// Source content for the Help Assistant's real docs index (search_app_docs,
// see src/lib/knowledgeBase.ts) - a compact prose summary of the same real
// pipeline/pages/concepts the Guide page documents in full, kept here as
// plain text rather than importing a "use client" page component. Update
// this alongside src/app/guide/page.tsx when a page's real behavior
// changes, then re-run scripts/seed-app-docs.ts to re-embed it - stale
// help-bot answers are worse than no help bot.
export const PLATFORM_GUIDE_CONTEXT = `EGPA (Enterprise Governance Platform for AI) is a real, working governance
pipeline for AI/agentic use cases - not a mockup. Seven real pages, in order:

1. Discovery (/discovery) - Anyone signed in. A real chat (Discovery Advisor) that asks clarifying
   questions before anyone commits to "build an agent," searches this org's existing use cases via a
   real tool call, and concludes with one of four paths: process-only (no agent needed), extend-existing,
   research-first, or build. A "build" conclusion hands a detailed problem statement into Intake.

2. Intake (/intake) - Requester role. Two steps: core questionnaire (data sensitivity, autonomy level,
   integration surface, expected users) with a live preliminary risk tier, then a deeper Risk &
   Compliance Profile page (human oversight frequency, customer-impact decision) that finalizes the
   risk tier and creates the real use case.

3. Recommendation (/recommendation) - Steward/Architect role. A real LLM call proposes a framework,
   tool stack, harness pattern, loop pattern, and context strategy, plus the alternatives it considered
   and why they lost, and a preview of the required governance checklist.

4. Governance Gate (/gate) - Governance Owner role. Every required control for the computed risk tier
   must be checked off before proceeding. Critical tier also requires a named Architecture Review Board
   (ARB) member's real written reasoning. A Governance Owner/Admin can engage a real, server-enforced
   kill-switch here at any time.

5. ADR (/adr) - Governance Owner role. A versioned Architecture Decision Record assembles automatically
   once the gate clears - downloadable, traceable to every prior decision.

6. Agentic System (/execution) - Developer/Admin role only. Runs a real master agent that plans steps,
   then real sub-agent LLM calls execute each one live. Each sub-agent has exactly one real callable
   tool (knowledge_base_search - a genuine Pinecone/Cohere RAG lookup); other tool names on a plan (a
   CRM, a ticketing system) are descriptive labels for what a production build would call, not live
   integrations. A real webhook token can trigger a run from outside the browser.

7. Observability (/dashboard) - All roles. Portfolio-wide cost, usage, and decision-trail charts, plus
   per-use-case token/cost/duration and step-by-step trace - nothing simulated.

Beyond the pipeline: Portfolio (/portfolio, every use case across business units), Model Registry
(/registry, approved models/MCP servers), Model Builder (/mlops, Developer/Admin - connect a real
OpenRouter/Hugging Face account and try a real RAG demo), Governance (/governance, org-wide posture +
approval delegation), Admin (/admin, platform configuration) and Admin Overview (/admin/overview,
Admin-only KPI dashboard), Inbox (/inbox, personal action items).

Key concepts:
- Risk tier (Low/Medium/High/Critical) is computed deterministically (OSCAR scoring) from data
  sensitivity, autonomy level, integration surface, human oversight frequency, and customer-impact
  decision - never a manual choice.
- HITL tier (none/advisory/manual) sets how much human-in-the-loop this use case needs, driven by risk
  tier.
- Kill-switch, PII redaction, the tamper-evident hash-chained audit trail, required written reasoning
  on every governance decision, and segregation of duties (a use case's owner can't also approve it)
  are all real, server-enforced controls - see the Responsible AI section on the Guide page for detail.
- The AI Gateway is a self-hosted LiteLLM Proxy in front of every real LLM call this app makes, with
  automatic multi-provider fallback - EGPA itself is the Control Plane (policy as code), not the
  data-plane traffic path.

Answer questions about how to use the app, what a page/button does, or what a governance concept means,
grounded only in what's described above. If asked about something outside this platform, say so plainly
rather than guessing.`;
