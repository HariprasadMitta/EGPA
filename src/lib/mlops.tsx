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
  HuggingFaceConnection,
  MlOpsPings,
  OpenRouterConnection,
  PingResult,
  RagChunk,
} from "@/types";

const STORAGE_KEY = "momentum-cv-mlops-v1";

interface MlOpsState {
  openRouter: OpenRouterConnection;
  huggingFace: HuggingFaceConnection;
  ragChunks: RagChunk[];
  pings: MlOpsPings;
}

function defaultState(): MlOpsState {
  return {
    openRouter: { connected: false, apiKey: null, selectedModel: null },
    huggingFace: { connected: false, accessToken: null, username: null, selectedModel: null },
    ragChunks: [],
    pings: { openRouter: null, huggingFace: null },
  };
}

interface MlOpsContextValue extends MlOpsState {
  connectOpenRouter: (apiKey: string) => void;
  disconnectOpenRouter: () => void;
  selectOpenRouterModel: (id: string) => void;
  connectHuggingFace: (accessToken: string, username: string | null) => void;
  disconnectHuggingFace: () => void;
  selectHuggingFaceModel: (id: string) => void;
  addRagChunks: (chunks: RagChunk[]) => void;
  clearRagDocuments: () => void;
  recordPing: (provider: "openRouter" | "huggingFace", result: PingResult) => void;
}

const MlOpsContext = createContext<MlOpsContextValue | null>(null);

function loadState(): MlOpsState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<MlOpsState>;
    return {
      openRouter: parsed.openRouter ?? defaultState().openRouter,
      huggingFace: parsed.huggingFace ?? defaultState().huggingFace,
      ragChunks: Array.isArray(parsed.ragChunks) ? parsed.ragChunks : [],
      pings: parsed.pings ?? defaultState().pings,
    };
  } catch {
    return defaultState();
  }
}

export function MlOpsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MlOpsState>(defaultState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // See store.tsx for why this one-time post-mount sessionStorage read is
    // intentional rather than a lint-flagged setState-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const connectOpenRouter = useCallback((apiKey: string) => {
    setState((s) => ({ ...s, openRouter: { ...s.openRouter, connected: true, apiKey } }));
  }, []);

  const disconnectOpenRouter = useCallback(() => {
    setState((s) => ({
      ...s,
      openRouter: { connected: false, apiKey: null, selectedModel: null },
      pings: { ...s.pings, openRouter: null },
    }));
  }, []);

  const selectOpenRouterModel = useCallback((id: string) => {
    setState((s) => ({ ...s, openRouter: { ...s.openRouter, selectedModel: id } }));
  }, []);

  const connectHuggingFace = useCallback((accessToken: string, username: string | null) => {
    setState((s) => ({
      ...s,
      huggingFace: { ...s.huggingFace, connected: true, accessToken, username },
    }));
  }, []);

  const disconnectHuggingFace = useCallback(() => {
    setState((s) => ({
      ...s,
      huggingFace: { connected: false, accessToken: null, username: null, selectedModel: null },
      pings: { ...s.pings, huggingFace: null },
    }));
  }, []);

  const selectHuggingFaceModel = useCallback((id: string) => {
    setState((s) => ({ ...s, huggingFace: { ...s.huggingFace, selectedModel: id } }));
  }, []);

  const addRagChunks = useCallback((chunks: RagChunk[]) => {
    setState((s) => ({ ...s, ragChunks: [...s.ragChunks, ...chunks] }));
  }, []);

  const clearRagDocuments = useCallback(() => {
    setState((s) => ({ ...s, ragChunks: [] }));
  }, []);

  const recordPing = useCallback((provider: "openRouter" | "huggingFace", result: PingResult) => {
    setState((s) => ({ ...s, pings: { ...s.pings, [provider]: result } }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      connectOpenRouter,
      disconnectOpenRouter,
      selectOpenRouterModel,
      connectHuggingFace,
      disconnectHuggingFace,
      selectHuggingFaceModel,
      addRagChunks,
      clearRagDocuments,
      recordPing,
    }),
    [
      state,
      connectOpenRouter,
      disconnectOpenRouter,
      selectOpenRouterModel,
      connectHuggingFace,
      disconnectHuggingFace,
      selectHuggingFaceModel,
      addRagChunks,
      clearRagDocuments,
      recordPing,
    ]
  );

  return <MlOpsContext.Provider value={value}>{children}</MlOpsContext.Provider>;
}

export function useMlOps(): MlOpsContextValue {
  const ctx = useContext(MlOpsContext);
  if (!ctx) throw new Error("useMlOps must be used within MlOpsProvider");
  return ctx;
}
