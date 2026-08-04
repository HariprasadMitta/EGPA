# Project Context: Enterprise AI Governance & Framework Advisor (Demo Build)

## 1. What this is

A front-end SaaS product that lets an enterprise submit an AI/agentic use case
and receive, instantly:

1. A recommended agent **framework and tool stack** for that use case
2. Recommended **harness pattern, loop engineering approach, and context
   window strategy**
3. A **governance verdict** — risk tier, mandatory controls, and required
   human-in-the-loop (HITL) level — that the requester must satisfy, not opt
   into
4. Visibility into the **model registry**, **decision explainability**, and
   (as a live demo layer) simulated **drift/cost monitoring**

The platform is **framework-agnostic**: it advises based on a structured
questionnaire plus a free-text use case description, not on any one vendor
stack (LangGraph, AutoGen, Bedrock Agents, etc. are all just entries in its
catalog).

This is being built to demo to a prospective employer (an enterprise
evaluating AI architecture practices) on a short timeline. **Scope for this
build is an MVP demo, not the full production platform.** Section 3 draws the
line explicitly.

## 2. Governance methodology: the OSCAR framework

All governance logic in this app is built on a five-part framework. Every
screen, gate, and generated document should be traceable back to one of
these:

- **O — Ownership**: every use case has a named business owner and technical
  owner captured at intake. No use case can proceed without this.
- **S — Stewardship**: a designated steward bridges business intent and
  technical implementation (modeled as a role: Requester → Steward/Architect
  → Governance Owner).
- **C — Classification**: every use case is classified by risk (data
  sensitivity × agent autonomy × blast radius) into a tier: Low / Medium /
  High / Critical. This tier is *computed*, not selected by the user, and it
  drives every downstream requirement.
- **A — Auditability**: every recommendation and every simulated agent
  decision produces a traceable record — why this tool/framework was chosen,
  why an agent took an action, timestamped and versioned.
- **R — Retain-and-Reinvent**: recommendations and governance rules are
  versioned, not static — the UI should show that standards evolve (e.g. a
  "supersedes v1" note on a rule change), not present them as immutable law.

## 3. MVP scope for tomorrow's demo — what's real vs. what's simulated

Build all of the following as **working, navigable UI** with real
interaction (forms submit, state updates, data persists across the session).
Be explicit in code comments about what's real logic vs. simulated data, so
it's honest in a live demo if asked.

**Real logic (should actually work):**
- The full intake questionnaire and use-case submission flow
- Risk classification logic (rule-based: a deterministic scoring function
  over questionnaire answers — data sensitivity, autonomy level, integration
  surface, blast radius — producing Low/Medium/High/Critical)
- The recommendation engine: call an LLM (Anthropic API, `claude-sonnet-4-6`)
  with the use case description + questionnaire answers + risk tier, and a
  system prompt instructing it to recommend a framework, tool stack, harness
  pattern, loop pattern (with iteration ceiling), and context window strategy,
  each with a one-line rationale. This should be a genuine API call, not
  canned text — it's the most impressive, honest thing to show live.
- Governance gate logic: given the risk tier, deterministically compute the
  mandatory controls checklist and HITL tier (none / advisory / approval-
  required / manual), and block "proceed to build" until required fields are
  acknowledged.
- Auto-generated Architecture Decision Record (ADR): a formatted, versioned,
  timestamped document assembled from the above (use case, tier,
  recommendation, rationale, required controls, owner/steward) — downloadable
  or copyable.

**Simulated (clearly mocked, seeded with realistic sample data):**
- Model Management Registry — a table of models (name, vendor, version,
  status: approved/deprecated/under-review, allowed risk tiers) — static seed
  data, but the UI to browse/filter should be real.
- Runtime Observability dashboard — simulated telemetry: decision trace log
  (mock agent steps with "why" reasoning strings), loop iteration counts,
  context usage vs. budget, drift indicator, cost-vs-value gauge. Use a timer
  or randomized-but-plausible data generator so it looks live, and label it
  clearly (e.g. a small "simulated telemetry" badge) so you can speak to it
  honestly as "this is what the connected version streams in via SDK/webhook
  once agents are wired up."

**Explicitly out of scope for this build (mention as roadmap only):**
- Real auth/multi-user accounts, real RBAC enforcement
- Real SDK/webhook ingestion pipeline from live deployed agents
- Multi-tenant SaaS billing/provisioning
- Policy-as-code engine (OPA) integration
- Re-certification scheduling / drift-triggered re-review workflows

## 4. Core screens

1. **Landing / value proposition** — one-screen pitch: "Submit a use case.
   Get a governed, explainable AI architecture recommendation in minutes —
   enforced, not optional."
2. **Use Case Intake** — structured questionnaire (business domain, data
   sensitivity classification, agent autonomy level, integration surface,
   expected user base) + free-text use case description box.
3. **Recommendation Result** — risk tier badge, recommended
   framework/tools/harness/loop/context strategy with rationale (from the
   real LLM call), and the OSCAR-labeled governance checklist for that tier.
4. **Governance Gate / Sign-off** — shows required controls and HITL tier as
   *blocking* requirements (visually: greyed "Proceed" button until
   acknowledged) — reinforces "mandatory, not opt-in."
5. **Generated ADR** — the auto-assembled decision record, versioned,
   downloadable.
6. **Model Registry** — browsable table of approved/deprecated models.
7. **Observability Dashboard** — simulated live view: decision trace/
   explainability log, loop behavior, context usage, drift, cost-vs-value.
8. **(Optional, if time allows) Use Case Portfolio** — a list view of all
   submitted use cases across the org with their risk tier and status, to
   sell the "enterprise-wide visibility" story that was specifically asked
   for.

## 4a. Control Plane vs. AI Gateway — keep these conceptually separate

This distinction matters and should be visible in both the architecture and
the UI's information architecture (even though this build is front-end only):

- **AI Gateway (data plane)** — sits in the path of live agent/model traffic.
  Responsible for routing requests to model endpoints, auth, rate limiting,
  and enforcing whatever the Control Plane has configured. In production,
  this is the *only* path to model endpoints (no direct engineer access to
  Bedrock/SageMaker/etc.) — that's what makes governance non-optional (see
  Section 3's enforcement discussion).
- **Control Plane (management plane)** — where governance actually lives:
  risk tier templates, approval workflows, the model registry, ADRs, and the
  observability dashboards. It configures and observes the Gateway; it does
  not sit in the live traffic path itself.

In this build, the app **is** the Control Plane UI. Structure navigation so
this is implicit: intake/recommendation/governance-gate/ADR/model-registry
all live under a "Control Plane" conceptual umbrella, while the Observability
Dashboard is framed as "telemetry reported up from the Gateway" — reinforcing
that the two are distinct systems that talk to each other, not one screen.

## 4b. Governance templates (per risk tier)

Represent each risk tier's requirements as a data object, not hardcoded
logic, so it's the thing that gets versioned (the "R" in OSCAR):

```
GovernanceTemplate {
  riskTier,              // Low | Medium | High | Critical
  requiredApprovals[],   // e.g. ["Owner self-attest"] or ["Owner","Governance Owner","Named Reviewer"]
  requiredControls[],    // e.g. ["PII masking","Audit logging","HITL approval step"]
  hitlTier,              // none | advisory | approval-required | manual
  recertificationDays,   // null for Low, 90 for Critical, etc.
  version, supersedes     // for Retain-and-Reinvent history
}
```

A use case cannot reach "approved" status until every field required by its
tier's template is satisfied — this is the workflow-state-machine enforcement
layer described in Section 3. The UI should make unmet requirements visibly
blocking (greyed button, listed missing items), not just informational.

```
UseCase {
  id, title, description, businessDomain,
  dataSensitivity, autonomyLevel, integrationSurface, expectedUsers,
  owner, steward,
  riskTier,          // computed
  status             // draft | submitted | recommended | gated | approved
}

Recommendation {
  useCaseId,
  framework, tools[], harnessPattern, loopPattern, iterationCeiling,
  contextStrategy,
  rationale,         // from LLM
  createdAt, version
}

GovernanceGate {
  useCaseId, riskTier,
  requiredControls[], hitlTier, acknowledged (bool)
}

ADR {
  useCaseId, version, createdAt, content   // assembled markdown/text
}

ModelRegistryEntry {
  name, vendor, version, status, allowedRiskTiers[]
}

TelemetryEvent (simulated) {
  useCaseId, timestamp, agentStep, decisionReason, durationMs,
  contextTokensUsed, loopIteration
}
```

## 6. Tech stack

- Next.js (React) front end
- Anthropic API (`claude-sonnet-4-6`) for the real recommendation engine call
- Client-side or lightweight in-memory/local state for persistence during
  the demo (no need for a real database for tomorrow)
- Tailwind for styling — clean, enterprise/compliance aesthetic (think:
  trustworthy, not flashy — this is a governance tool, not a consumer app)

## 7. Deployment — this will be shared as a URL, not demoed live

**No one will narrate this.** The panel will open a link and click around
alone. That changes several things from a typical demo build:

- **Landing page must fully explain itself** — what the product is, the
  problem it solves, and a clear "Try it" path, with zero assumed context.
  Assume the visitor has ~2 minutes of attention.
- **Pre-seed 2–3 realistic sample use cases** (e.g. "Customer complaint
  triage agent," "Network ticket classification agent" — drawing on the kind
  of federated, multi-business-unit scenario discussed) that a visitor can
  open with one click and immediately see a full recommendation, governance
  gate, ADR, and observability dashboard populated — **don't make them type a
  use case from scratch to see the product work.** Still let them submit
  their own if they want.
- **Every simulated section needs a visible, unmissable label** (e.g. a small
  badge: "Simulated telemetry — connects live via SDK once agents are
  wired up") since there's no one there to explain which parts are real.
  This must read as intentional design, not an unfinished feature.
- **Protect the Anthropic API key** — the recommendation engine call must go
  through a server-side API route (Next.js API route / route handler), never
  called directly from the client. The key must not be exposed in any
  client-side bundle or network request visible in devtools.
- **Guard against cost/abuse on a public link** — add a simple rate limit
  (e.g. cap requests per IP per hour, or a max total number of live LLM
  calls) so an unmonitored public URL can't run up API costs unexpectedly.
  A visible "X free recommendations remaining" is an acceptable, honest way
  to surface this if a hard cap is used.
- **Deploy to Vercel** (native fit for Next.js, fast to stand up, free tier
  is sufficient) unless another host is already set up. Set the Anthropic
  API key as a server-side environment variable there, never committed to
  the repo.
- **No login required** for this shared link — keep friction at zero for an
  unsupervised visitor, but this also means don't persist anything sensitive
  server-side per visitor; session-local state is enough.

## 8. Tone and positioning notes for the build

- Every screen should visually reinforce **"enforced, not advisory."**
  Governance requirements should look like gates, not suggestions or
  checkboxes the user can freely skip.
- The explainability and observability screens are inspired by a personal
  project of the author's (an agent lineage/decision-explainability tool)
  and by direct enterprise conversations about real gaps (no visibility into
  running models, no cost/value tracking, agents with excessive data access,
  shadow AI sprawl across federated business units) — the product should feel
  like it was built from lived architecture experience, not a generic
  governance template.
