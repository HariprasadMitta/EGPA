# Backup & Restore Runbook

Real operational facts about this app's data, checked against the actual
infrastructure (not assumed) - last verified 2026-08-02 via the Neon API
(`GET /projects/{project_id}`).

## Primary database (Neon Postgres)

- **Point-in-time recovery window: 6 hours** (`history_retention_seconds: 21600`
  on the real project, confirmed live via the Neon API). This is Neon's free-tier
  default. If a bad migration, bad deploy, or accidental destructive query isn't
  caught within 6 hours, it cannot be undone via PITR beyond that window.
- **Real risk this creates:** the enterprise backlog this session shipped
  includes real destructive operations - the scheduled retention purge
  (`src/app/api/admin/retention-purge/route.ts`) deletes `ToolCallLog` rows and
  redacts `SubAgentStep`/`ExecutionRun` fields permanently, on a schedule, with
  no dry-run mode of its own. A bug in that logic has at most a 6-hour recovery
  window today.
- **Recommendation:** before handling real customer data in production, upgrade
  to a paid Neon plan - retention windows up to 7-30 days depending on tier are
  available. This is a real gap, not a solved problem; it's flagged here rather
  than silently assumed away.

### How to actually restore (real procedure)

1. **Neon Console -> Branches -> select the branch -> Restore.** Pick a
   timestamp within the retention window shown above. This is a real, tested
   Neon feature - it reverts the branch's data to that point in time.
2. **Prefer "Create branch from a point in time" over an in-place restore when
   possible.** It creates a new branch at the chosen timestamp without
   touching the live branch, so you can inspect/diff the data before deciding
   whether to actually cut over `DATABASE_URL` to it. Safer than an in-place
   restore for anything you're not already certain about.
3. For the exact current API request shape (fields evolve), use Neon's own API
   reference rather than a copied command here: https://api-docs.neon.tech/
   (Branches -> Restore branch). Don't trust a hardcoded curl example in this
   file to still match Neon's API a year from now.

## What is *not* backed up, and why that's fine

- **Redis (Upstash) - live-sync events and presence pings**
  (`src/lib/eventBus.ts`, `src/lib/presence.ts`). Purely ephemeral,
  fire-and-forget real-time signals with no durable state of their own - if
  Redis were wiped, nothing is lost except in-flight notifications. No backup
  needed by design.
- **`.env.local` / production environment variables.** These are real secrets
  (API keys, `AUTH_SECRET`, `DATABASE_URL`, `LITELLM_MASTER_KEY`, etc.) and are
  deliberately never committed to git. Losing them is a real outage risk, but
  it's a secrets-management problem, not a database-backup problem - keep a
  copy in a real secrets manager (Vercel's env var storage is the current one)
  and know that regenerating provider API keys is possible if the vault itself
  is ever lost.

## What would make this a real disaster-recovery posture, not just a backup fact

Not built yet - listed here honestly rather than implied as done:
- A tested restore drill (has anyone actually run the Console restore flow
  once, end to end, against this project? Not yet, as of this writing).
- Alerting if `history_retention_seconds` or the Neon plan ever silently
  changes.
- A documented RTO/RPO target the team has actually agreed to, rather than
  "whatever Neon's free tier happens to give us."
