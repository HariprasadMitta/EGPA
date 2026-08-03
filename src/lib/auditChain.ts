import { createHash } from "crypto";

const GENESIS = "GENESIS";

export interface ChainableEntryFields {
  useCaseId: string;
  actorUserId: string | null;
  actorName: string;
  action: string;
  detail: string | null;
  createdAt: Date;
}

// Real tamper-evident hash chain, not a checkbox: each entry's hash covers
// the previous entry's hash plus its own real fields, so editing any past
// row (in the DB directly, bypassing the app entirely) changes that row's
// recomputed hash and breaks every hash after it in the same use case's
// chain. Deliberately per-use-case, not global - matches how the audit
// trail is already read and exported (per use case), and keeps the chain
// short enough to verify on every page load without scanning the whole
// table.
export function computeEntryHash(prevHash: string, fields: ChainableEntryFields): string {
  const payload = [
    prevHash,
    fields.useCaseId,
    fields.actorUserId ?? "",
    fields.actorName,
    fields.action,
    fields.detail ?? "",
    fields.createdAt.toISOString(),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export { GENESIS };
