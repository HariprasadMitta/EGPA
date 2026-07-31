"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import {
  ExecutionRun,
  Recommendation,
  SubAgentStep,
  UseCase,
  UseCaseBundle,
} from "@/types";

const ACTIVE_ID_KEY = "momentum-control-plane-active-id-v1";

interface StoreContextValue {
  bundles: UseCaseBundle[];
  active: UseCaseBundle | null;
  setActiveId: (id: string) => void;
  createUseCase: (
    input: Omit<UseCase, "id" | "status" | "createdAt" | "killSwitchEngaged">
  ) => Promise<UseCase>;
  toggleKillSwitch: (useCaseId: string, engaged: boolean) => Promise<void>;
  setRecommendation: (useCaseId: string, recommendation: Recommendation) => Promise<void>;
  acknowledgeGateItem: (useCaseId: string, control: string) => Promise<void>;
  finalizeGate: (useCaseId: string) => Promise<void>;
  approveArb: (useCaseId: string) => Promise<void>;
  generateADR: (useCaseId: string) => Promise<void>;
  loadSample: (id: string) => void;
  startExecution: (
    useCaseId: string,
    executionId: string,
    runNumber: number,
    masterAgentSummary: string,
    steps: SubAgentStep[]
  ) => Promise<void>;
  updateExecutionStep: (
    useCaseId: string,
    executionId: string,
    stepId: string,
    patch: Partial<SubAgentStep>
  ) => Promise<void>;
  failExecution: (useCaseId: string, executionId: string, error: string) => Promise<void>;
  generateWebhookTrigger: (useCaseId: string) => Promise<string>;
  toggleWebhookTrigger: (useCaseId: string, enabled: boolean) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function loadActiveId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(ACTIVE_ID_KEY);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [bundlesMap, setBundlesMap] = useState<Record<string, UseCaseBundle>>({});
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    // activeId is pure client navigation state (which use case is currently
    // being viewed), not business data - it lives in sessionStorage only,
    // never in the database. See auth.tsx for the same post-mount hydration
    // pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIdState(loadActiveId());
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/use-cases");
      if (!res.ok || cancelled) return;
      const data = await res.json();
      const map: Record<string, UseCaseBundle> = {};
      for (const b of data.bundles as UseCaseBundle[]) map[b.useCase.id] = b;
      if (!cancelled) {
        setBundlesMap(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    // Live multi-user sync: any mutation route broadcasts the fresh bundle
    // after it commits (src/lib/broadcastBundle.ts), so another signed-in
    // user's action on this use case shows up here without a reload.
    const source = new EventSource("/api/use-cases/events");
    source.onmessage = (event) => {
      try {
        const { useCaseId, bundle } = JSON.parse(event.data) as {
          useCaseId: string;
          bundle: UseCaseBundle;
        };
        setBundlesMap((prev) => ({ ...prev, [useCaseId]: bundle }));
      } catch {
        // Skip a malformed event rather than crash the subscription.
      }
    };
    return () => {
      source.close();
    };
  }, [status]);

  const setActiveId = useCallback((id: string) => {
    setActiveIdState(id);
    window.sessionStorage.setItem(ACTIVE_ID_KEY, id);
  }, []);

  const createUseCase = useCallback(
    async (
      input: Omit<UseCase, "id" | "status" | "createdAt" | "killSwitchEngaged">
    ): Promise<UseCase> => {
      const res = await fetch("/api/use-cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create use case.");
      const useCase: UseCase = data.useCase;
      setBundlesMap((prev) => ({
        ...prev,
        [useCase.id]: {
          useCase,
          recommendation: null,
          gate: null,
          adr: null,
          executions: [],
          webhookTrigger: null,
        },
      }));
      setActiveId(useCase.id);
      return useCase;
    },
    [setActiveId]
  );

  const toggleKillSwitch = useCallback(async (useCaseId: string, engaged: boolean) => {
    const res = await fetch(`/api/use-cases/${useCaseId}/kill-switch`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ engaged }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update kill switch.");
    setBundlesMap((prev) => {
      const existing = prev[useCaseId];
      if (!existing) return prev;
      return { ...prev, [useCaseId]: { ...existing, useCase: data.useCase } };
    });
  }, []);

  const setRecommendation = useCallback(async (useCaseId: string, recommendation: Recommendation) => {
    const res = await fetch(`/api/use-cases/${useCaseId}/recommendation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        framework: recommendation.framework,
        tools: recommendation.tools,
        harnessPattern: recommendation.harnessPattern,
        loopPattern: recommendation.loopPattern,
        iterationCeiling: recommendation.iterationCeiling,
        contextStrategy: recommendation.contextStrategy,
        rationale: recommendation.rationale,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save recommendation.");
    setBundlesMap((prev) => {
      const existing = prev[useCaseId];
      if (!existing) return prev;
      return {
        ...prev,
        [useCaseId]: {
          ...existing,
          recommendation: data.recommendation,
          gate: data.gate,
          useCase: { ...existing.useCase, status: "recommended" },
        },
      };
    });
  }, []);

  const acknowledgeGateItem = useCallback(async (useCaseId: string, control: string) => {
    const res = await fetch(`/api/use-cases/${useCaseId}/gate`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "toggle", control }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setBundlesMap((prev) => {
      const existing = prev[useCaseId];
      if (!existing) return prev;
      return { ...prev, [useCaseId]: { ...existing, gate: data.gate } };
    });
  }, []);

  const finalizeGate = useCallback(async (useCaseId: string) => {
    const res = await fetch(`/api/use-cases/${useCaseId}/gate`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "finalize" }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setBundlesMap((prev) => {
      const existing = prev[useCaseId];
      if (!existing) return prev;
      return {
        ...prev,
        [useCaseId]: {
          ...existing,
          gate: data.gate,
          useCase: data.gate.acknowledged
            ? { ...existing.useCase, status: "gated" }
            : existing.useCase,
        },
      };
    });
  }, []);

  const approveArb = useCallback(async (useCaseId: string) => {
    const res = await fetch(`/api/use-cases/${useCaseId}/gate`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "approveArb" }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setBundlesMap((prev) => {
      const existing = prev[useCaseId];
      if (!existing) return prev;
      return { ...prev, [useCaseId]: { ...existing, gate: data.gate } };
    });
  }, []);

  const generateADR = useCallback(async (useCaseId: string) => {
    const res = await fetch(`/api/use-cases/${useCaseId}/adr`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) return;
    setBundlesMap((prev) => {
      const existing = prev[useCaseId];
      if (!existing) return prev;
      return {
        ...prev,
        [useCaseId]: {
          ...existing,
          adr: data.adr,
          useCase: existing.gate?.acknowledged
            ? { ...existing.useCase, status: "approved" }
            : existing.useCase,
        },
      };
    });
  }, []);

  const loadSample = useCallback(
    (id: string) => {
      setActiveId(id);
    },
    [setActiveId]
  );

  const startExecution = useCallback(
    async (
      useCaseId: string,
      executionId: string,
      runNumber: number,
      masterAgentSummary: string,
      steps: SubAgentStep[]
    ) => {
      const res = await fetch(`/api/use-cases/${useCaseId}/executions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          executionId,
          runNumber,
          masterAgentSummary,
          steps: steps.map((s) => ({ id: s.id, name: s.name, tool: s.tool, task: s.task })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start execution.");
      setBundlesMap((prev) => {
        const existing = prev[useCaseId];
        if (!existing) return prev;
        const execution = data.execution as ExecutionRun;
        // Guard against the SSE broadcast for this same creation (Phase 5)
        // already having landed in state first - appending unconditionally
        // would leave two entries sharing one id (a real bug: caused a
        // React duplicate-key warning and could make an execution appear
        // to vanish from the list).
        const executions = existing.executions.some((e) => e.id === execution.id)
          ? existing.executions.map((e) => (e.id === execution.id ? execution : e))
          : [...existing.executions, execution];
        return {
          ...prev,
          [useCaseId]: {
            ...existing,
            executions,
            useCase: { ...existing.useCase, status: "executing" },
          },
        };
      });
    },
    []
  );

  const updateExecutionStep = useCallback(
    async (useCaseId: string, executionId: string, stepId: string, patch: Partial<SubAgentStep>) => {
      const res = await fetch(`/api/use-cases/${useCaseId}/executions/${executionId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) return;
      const execution: ExecutionRun = data.execution;
      const allSettled = execution.status === "completed" || execution.status === "failed";
      setBundlesMap((prev) => {
        const existing = prev[useCaseId];
        if (!existing) return prev;
        const executions = existing.executions.some((e) => e.id === execution.id)
          ? existing.executions.map((e) => (e.id === execution.id ? execution : e))
          : [...existing.executions, execution];
        return {
          ...prev,
          [useCaseId]: {
            ...existing,
            executions,
            useCase: allSettled ? { ...existing.useCase, status: "executed" } : existing.useCase,
          },
        };
      });
    },
    []
  );

  const failExecution = useCallback(async (useCaseId: string, executionId: string, error: string) => {
    const res = await fetch(`/api/use-cases/${useCaseId}/executions/${executionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ error }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setBundlesMap((prev) => {
      const existing = prev[useCaseId];
      if (!existing) return prev;
      const executions = existing.executions.map((e) => (e.id === executionId ? data.execution : e));
      return { ...prev, [useCaseId]: { ...existing, executions } };
    });
  }, []);

  // Both webhook-trigger actions rely on the mutation route's own
  // broadcastBundle call (Phase 5's live-sync SSE) to reflect the new state
  // here - no separate bundlesMap merge needed, the EventSource handler
  // above already merges any incoming bundle by id.
  const generateWebhookTrigger = useCallback(async (useCaseId: string): Promise<string> => {
    const res = await fetch(`/api/use-cases/${useCaseId}/webhook-trigger`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to generate webhook trigger.");
    return data.token as string;
  }, []);

  const toggleWebhookTrigger = useCallback(async (useCaseId: string, enabled: boolean) => {
    const res = await fetch(`/api/use-cases/${useCaseId}/webhook-trigger`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update webhook trigger.");
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      bundles: Object.values(bundlesMap).sort(
        (a, b) => new Date(b.useCase.createdAt).getTime() - new Date(a.useCase.createdAt).getTime()
      ),
      active: activeId ? bundlesMap[activeId] ?? null : null,
      setActiveId,
      createUseCase,
      toggleKillSwitch,
      setRecommendation,
      acknowledgeGateItem,
      finalizeGate,
      approveArb,
      generateADR,
      loadSample,
      startExecution,
      updateExecutionStep,
      failExecution,
      generateWebhookTrigger,
      toggleWebhookTrigger,
    }),
    [
      bundlesMap,
      activeId,
      setActiveId,
      createUseCase,
      toggleKillSwitch,
      setRecommendation,
      acknowledgeGateItem,
      finalizeGate,
      approveArb,
      generateADR,
      loadSample,
      startExecution,
      updateExecutionStep,
      failExecution,
      generateWebhookTrigger,
      toggleWebhookTrigger,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
