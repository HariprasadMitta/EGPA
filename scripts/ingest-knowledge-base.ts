import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const {
    getPineconeClient,
    getDocumentEmbeddings,
    KB_INDEX_NAME,
    KB_DIMENSION,
    KB_CLOUD,
    KB_REGION,
  } = await import("../src/lib/knowledgeBase");
  const { GOVERNANCE_TEMPLATES } = await import("../src/lib/governance");

  const pc = getPineconeClient();

  const existing = await pc.listIndexes();
  const alreadyExists = existing.indexes?.some((i) => i.name === KB_INDEX_NAME);
  if (!alreadyExists) {
    console.log(`Creating Pinecone index "${KB_INDEX_NAME}"...`);
    await pc.createIndex({
      name: KB_INDEX_NAME,
      dimension: KB_DIMENSION,
      metric: "cosine",
      spec: { serverless: { cloud: KB_CLOUD, region: KB_REGION } },
      waitUntilReady: true,
    });
  } else {
    console.log(`Index "${KB_INDEX_NAME}" already exists - reusing it.`);
  }

  const documents: { id: string; text: string }[] = [];

  for (const template of Object.values(GOVERNANCE_TEMPLATES)) {
    documents.push({
      id: `gov-${template.riskTier.toLowerCase()}`,
      text: `Momentum AI Governance Policy - ${template.riskTier} risk tier (template v${template.version}). Required approvals: ${template.requiredApprovals.join(", ")}. Required controls: ${template.requiredControls.join(", ")}. Human-in-the-loop tier: ${template.hitlTier}. ${
        template.recertificationDays
          ? `Recertification required every ${template.recertificationDays} days.`
          : "No recertification required at this tier."
      }`,
    });
  }

  documents.push(
    {
      id: "domain-contract-risk-categories",
      text: "Vendor Contract Risk Policy: Contracts are flagged high-risk if they contain indemnification clauses without a liability cap, termination-for-convenience clauses shorter than 30 days notice, or auto-renewal clauses without an opt-out reminder. Legal review is mandatory before signature for any contract exceeding $250,000 annual value or containing a data-processing addendum.",
    },
    {
      id: "domain-network-incident-severity",
      text: "Network Operations Incident Severity Definitions: Severity 1 (Critical) - full outage affecting org-wide services, requires immediate escalation and a kill-switch review. Severity 2 (High) - partial outage or degraded performance affecting a single business unit. Severity 3 (Medium) - isolated fault with a known workaround. Severity 4 (Low) - cosmetic or non-blocking issue. Any auto-generated change ticket for a Severity 1 or 2 incident requires manual approval before execution.",
    },
    {
      id: "domain-expense-anomaly-thresholds",
      text: "Expense Report Anomaly Detection Policy: An expense line item is flagged as anomalous if it exceeds 2 standard deviations above the peer-group category average, lacks a receipt for amounts over $75, or falls on a weekend/holiday for a category typically incurred on business days. Flagged items are routed to the finance reviewer with a plain-language explanation; the agent never auto-approves or auto-rejects.",
    },
    {
      id: "domain-customer-complaint-escalation",
      text: "Customer Complaint Escalation SLA: Complaints classified as high-severity (safety, discrimination, or regulatory complaint) must be escalated to a human reviewer within 1 hour. Standard complaints receive a drafted response within 4 business hours. All drafted responses require human sign-off before sending when the complaint involves a customer in a regulated data-sensitivity category.",
    }
  );

  console.log(`Embedding ${documents.length} documents via Cohere...`);
  const embeddings = getDocumentEmbeddings();
  const vectors = await embeddings.embedDocuments(documents.map((d) => d.text));

  const index = pc.index(KB_INDEX_NAME);
  await index.upsert(
    documents.map((doc, i) => ({
      id: doc.id,
      values: vectors[i],
      metadata: { text: doc.text },
    }))
  );

  console.log(`Ingested ${documents.length} documents into "${KB_INDEX_NAME}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
