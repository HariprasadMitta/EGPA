import { auth } from "@/auth";
import { getReconciliationView } from "@/lib/reconciliation";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  const view = await getReconciliationView(id);
  if (!view) return Response.json({ error: "Use case not found." }, { status: 404 });

  return Response.json(view);
}
