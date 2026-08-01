import { auth } from "@/auth";

export const runtime = "nodejs";

const NEON_API_BASE = "https://console.neon.tech/api/v2";

interface NeonBranch {
  default?: boolean;
  logical_size?: number;
  cpu_used_sec?: number;
  active_time_seconds?: number;
  data_transfer_bytes?: number;
  written_data_bytes?: number;
}

interface NeonEndpoint {
  current_state?: string;
  autoscaling_limit_min_cu?: number;
  autoscaling_limit_max_cu?: number;
  suspend_timeout_seconds?: number;
  last_active?: string;
}

// Real Neon Monitoring API data for the Observability page's "Database"
// panel - confirmed via the API itself (not assumed) which of this
// account's two projects is the app's real database (matched
// NEON_PROJECT_ID's endpoint host against DATABASE_URL's host). This is
// the public v2 API's real project/branch/endpoint data - live RAM/CPU
// percentage time series like Neon's own Monitoring page uses an internal
// metrics API not exposed publicly, so this deliberately doesn't fake that;
// what's shown here (compute state, CU limits, real storage/compute-time/
// active-time/data-transfer totals) is everything the public API actually
// gives.
export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  if (!apiKey || !projectId) {
    return Response.json({ configured: false });
  }

  const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };

  const [branchesRes, endpointsRes] = await Promise.all([
    fetch(`${NEON_API_BASE}/projects/${projectId}/branches`, { headers, cache: "no-store" }),
    fetch(`${NEON_API_BASE}/projects/${projectId}/endpoints`, { headers, cache: "no-store" }),
  ]);

  if (!branchesRes.ok || !endpointsRes.ok) {
    return Response.json(
      { configured: true, error: "Neon API request failed - check NEON_API_KEY / NEON_PROJECT_ID." },
      { status: 502 }
    );
  }

  const branchesData = (await branchesRes.json()) as { branches: NeonBranch[] };
  const endpointsData = (await endpointsRes.json()) as { endpoints: NeonEndpoint[] };

  const branch = branchesData.branches.find((b) => b.default) ?? branchesData.branches[0] ?? null;
  const endpoint = endpointsData.endpoints[0] ?? null;

  return Response.json({
    configured: true,
    databaseSizeBytes: branch?.logical_size ?? null,
    computeState: endpoint?.current_state ?? null,
    minCu: endpoint?.autoscaling_limit_min_cu ?? null,
    maxCu: endpoint?.autoscaling_limit_max_cu ?? null,
    autosuspendSeconds: endpoint?.suspend_timeout_seconds ?? null,
    lastActiveAt: endpoint?.last_active ?? null,
    cpuUsedSec: branch?.cpu_used_sec ?? null,
    activeTimeSeconds: branch?.active_time_seconds ?? null,
    dataTransferBytes: branch?.data_transfer_bytes ?? null,
    writtenDataBytes: branch?.written_data_bytes ?? null,
  });
}
