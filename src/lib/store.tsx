"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ADR,
  ExecutionRun,
  GovernanceGate,
  Recommendation,
  SubAgentStep,
  UseCase,
  UseCaseBundle,
} from "@/types";
import { GOVERNANCE_TEMPLATES } from "@/lib/governance";
import { buildADRContent } from "@/lib/adr";
import { SAMPLE_BUNDLES } from "@/lib/seed";

const STORAGE_KEY = "momentum-control-plane-state-v1";

interface StoreState {
  bundles: Record<string, UseCaseBundle>;
  activeId: string | null;
}

interface StoreContextValue {
  bundles: UseCaseBundle[];
  active: UseCaseBundle | null;
  setActiveId: (id: string) => void;
  createUseCase: (input: Omit<UseCase, "id" | "status" | "createdAt">) => UseCase;
  setRecommendation: (useCaseId: string, recommendation: Recommendation) => void;
  acknowledgeGateItem: (useCaseId: string, control: string) => void;
  finalizeGate: (useCaseId: string) => void;
  approveArb: (useCaseId: string, approverName: string) => void;
  generateADR: (useCaseId: string) => void;
  loadSample: (id: string) => void;
  startExecution: (
    useCaseId: string,
    executionId: string,
    runNumber: number,
    masterAgentSummary: string,
    steps: SubAgentStep[]
  ) => void;
  updateExecutionStep: (
    useCaseId: string,
    executionId: string,
    stepId: string,
    patch: Partial<SubAgentStep>
  ) => void;
  failExecution: (useCaseId: string, executionId: string, error: string) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function defaultState(): StoreState {
  const bundles: Record<string, UseCaseBundle> = {};
  for (const b of SAMPLE_BUNDLES) bundles[b.useCase.id] = b;
  return { bundles, activeId: null };
}

function loadState(): StoreState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as StoreState;
    const bundles = { ...parsed.bundles };
    // Seed any sample not yet in storage, but never clobber one that's
    // already there - a visitor may have acknowledged its gate, generated
    // its ADR, or run a real execution against it, and that must survive a
    // reload rather than being reset back to the pristine seed definition.
    for (const b of SAMPLE_BUNDLES) {
      if (!bundles[b.useCase.id]) bundles[b.useCase.id] = b;
    }
    // Migrate bundles persisted before `executions` became an array (was a
    // single nullable `execution` field) so old sessionStorage data doesn't
    // crash reads like `bundle.executions.length`.
    for (const id of Object.keys(bundles)) {
      if (!Array.isArray(bundles[id].executions)) {
        bundles[id] = { ...bundles[id], executions: [] };
      }
    }
    // Migrate gates persisted before ARB review-board fields existed.
    for (const id of Object.keys(bundles)) {
      const gate = bundles[id].gate;
      if (gate && gate.requiresArbApproval === undefined) {
        bundles[id] = {
          ...bundles[id],
          gate: {
            ...gate,
            requiresArbApproval: gate.riskTier === "Critical",
            arbApproved: gate.acknowledged,
            arbApprovedBy: null,
            arbApprovedAt: null,
          },
        };
      }
    }
    return { bundles, activeId: parsed.activeId };
  } catch {
    return defaultState();
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // sessionStorage is unavailable during SSR, so the real state can only be
    // read after mount - this one-time hydration sync is intentional, not a
    // derivable-from-props case the lint rule is meant to catch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const setActiveId = useCallback((id: string) => {
    setState((s) => ({ ...s, activeId: id }));
  }, []);

  const createUseCase = useCallback(
    (input: Omit<UseCase, "id" | "status" | "createdAt">): UseCase => {
      const id = `uc-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const useCase: UseCase = {
        ...input,
        id,
        status: "submitted",
        createdAt: new Date().toISOString(),
      };
      setState((s) => ({
        bundles: {
          ...s.bundles,
          [id]: { useCase, recommendation: null, gate: null, adr: null, executions: [] },
        },
        activeId: id,
      }));
      return useCase;
    },
    []
  );

  const setRecommendation = useCallback(
    (useCaseId: string, recommendation: Recommendation) => {
      setState((s) => {
        const bundle = s.bundles[useCaseId];
        if (!bundle) return s;
        const template = GOVERNANCE_TEMPLATES[bundle.useCase.riskTier];
        const gate: GovernanceGate = {
          useCaseId,
          riskTier: bundle.useCase.riskTier,
          requiredControls: template.requiredControls,
          hitlTier: template.hitlTier,
          acknowledged: false,
          acknowledgedItems: [],
          requiresArbApproval: template.requiresArbApproval,
          arbApproved: false,
          arbApprovedBy: null,
          arbApprovedAt: null,
        };
        return {
          ...s,
          bundles: {
            ...s.bundles,
            [useCaseId]: {
              ...bundle,
              recommendation,
              gate,
              useCase: { ...bundle.useCase, status: "recommended" },
            },
          },
        };
      });
    },
    []
  );

  const acknowledgeGateItem = useCallback((useCaseId: string, control: string) => {
    setState((s) => {
      const bundle = s.bundles[useCaseId];
      if (!bundle || !bundle.gate) return s;
      const already = bundle.gate.acknowledgedItems.includes(control);
      const acknowledgedItems = already
        ? bundle.gate.acknowledgedItems.filter((c) => c !== control)
        : [...bundle.gate.acknowledgedItems, control];
      return {
        ...s,
        bundles: {
          ...s.bundles,
          [useCaseId]: {
            ...bundle,
            gate: { ...bundle.gate, acknowledgedItems },
          },
        },
      };
    });
  }, []);

  const finalizeGate = useCallback((useCaseId: string) => {
    setState((s) => {
      const bundle = s.bundles[useCaseId];
      if (!bundle || !bundle.gate) return s;
      const allAcknowledged = bundle.gate.requiredControls.every((c) =>
        bundle.gate!.acknowledgedItems.includes(c)
      );
      if (!allAcknowledged) return s;
      if (bundle.gate.requiresArbApproval && !bundle.gate.arbApproved) return s;
      return {
        ...s,
        bundles: {
          ...s.bundles,
          [useCaseId]: {
            ...bundle,
            gate: { ...bundle.gate, acknowledged: true },
            useCase: { ...bundle.useCase, status: "gated" },
          },
        },
      };
    });
  }, []);

  const approveArb = useCallback((useCaseId: string, approverName: string) => {
    setState((s) => {
      const bundle = s.bundles[useCaseId];
      if (!bundle || !bundle.gate) return s;
      return {
        ...s,
        bundles: {
          ...s.bundles,
          [useCaseId]: {
            ...bundle,
            gate: {
              ...bundle.gate,
              arbApproved: true,
              arbApprovedBy: approverName,
              arbApprovedAt: new Date().toISOString(),
            },
          },
        },
      };
    });
  }, []);

  const generateADR = useCallback((useCaseId: string) => {
    setState((s) => {
      const bundle = s.bundles[useCaseId];
      if (!bundle || !bundle.recommendation || !bundle.gate) return s;
      const version = (bundle.adr?.version ?? 0) + 1;
      const adr: ADR = {
        useCaseId,
        version,
        createdAt: new Date().toISOString(),
        content: buildADRContent(
          bundle.useCase,
          bundle.recommendation,
          bundle.gate,
          version
        ),
      };
      return {
        ...s,
        bundles: {
          ...s.bundles,
          [useCaseId]: {
            ...bundle,
            adr,
            useCase: {
              ...bundle.useCase,
              status: bundle.gate.acknowledged ? "approved" : bundle.useCase.status,
            },
          },
        },
      };
    });
  }, []);

  const loadSample = useCallback((id: string) => {
    setState((s) => ({ ...s, activeId: id }));
  }, []);

  const startExecution = useCallback(
    (
      useCaseId: string,
      executionId: string,
      runNumber: number,
      masterAgentSummary: string,
      steps: SubAgentStep[]
    ) => {
      setState((s) => {
        const bundle = s.bundles[useCaseId];
        if (!bundle) return s;
        const execution: ExecutionRun = {
          id: executionId,
          runNumber,
          useCaseId,
          masterAgentSummary,
          steps,
          status: "running",
          startedAt: new Date().toISOString(),
          completedAt: null,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostUsd: 0,
          error: null,
        };
        return {
          ...s,
          bundles: {
            ...s.bundles,
            [useCaseId]: {
              ...bundle,
              executions: [...bundle.executions, execution],
              useCase: { ...bundle.useCase, status: "executing" },
            },
          },
        };
      });
    },
    []
  );

  const updateExecutionStep = useCallback(
    (useCaseId: string, executionId: string, stepId: string, patch: Partial<SubAgentStep>) => {
      setState((s) => {
        const bundle = s.bundles[useCaseId];
        if (!bundle) return s;
        const target = bundle.executions.find((e) => e.id === executionId);
        if (!target) return s;

        const steps = target.steps.map((step) =>
          step.id === stepId ? { ...step, ...patch } : step
        );
        const totalInputTokens = steps.reduce((sum, st) => sum + st.inputTokens, 0);
        const totalOutputTokens = steps.reduce((sum, st) => sum + st.outputTokens, 0);
        const totalCostUsd = steps.reduce((sum, st) => sum + st.costUsd, 0);
        const allSettled = steps.every((st) => st.status === "done" || st.status === "error");
        const anyError = steps.some((st) => st.status === "error");
        const status = allSettled ? (anyError ? "failed" : "completed") : "running";

        const executions = bundle.executions.map((e) =>
          e.id === executionId
            ? {
                ...e,
                steps,
                totalInputTokens,
                totalOutputTokens,
                totalCostUsd,
                status: status as ExecutionRun["status"],
                completedAt: allSettled ? new Date().toISOString() : null,
              }
            : e
        );

        return {
          ...s,
          bundles: {
            ...s.bundles,
            [useCaseId]: {
              ...bundle,
              executions,
              useCase: {
                ...bundle.useCase,
                status: allSettled ? "executed" : bundle.useCase.status,
              },
            },
          },
        };
      });
    },
    []
  );

  const failExecution = useCallback((useCaseId: string, executionId: string, error: string) => {
    setState((s) => {
      const bundle = s.bundles[useCaseId];
      if (!bundle) return s;
      const executions = bundle.executions.map((e) =>
        e.id === executionId
          ? { ...e, status: "failed" as const, error, completedAt: new Date().toISOString() }
          : e
      );
      return {
        ...s,
        bundles: {
          ...s.bundles,
          [useCaseId]: { ...bundle, executions },
        },
      };
    });
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      bundles: Object.values(state.bundles).sort(
        (a, b) => new Date(b.useCase.createdAt).getTime() - new Date(a.useCase.createdAt).getTime()
      ),
      active: state.activeId ? state.bundles[state.activeId] ?? null : null,
      setActiveId,
      createUseCase,
      setRecommendation,
      acknowledgeGateItem,
      finalizeGate,
      approveArb,
      generateADR,
      loadSample,
      startExecution,
      updateExecutionStep,
      failExecution,
    }),
    [
      state,
      setActiveId,
      createUseCase,
      setRecommendation,
      acknowledgeGateItem,
      finalizeGate,
      approveArb,
      generateADR,
      loadSample,
      startExecution,
      updateExecutionStep,
      failExecution,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
