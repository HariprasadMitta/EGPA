"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { canAccessDeveloperTools } from "@/lib/roles";
import { useMlOps } from "@/lib/mlops";
import { randomCodeVerifier, codeChallengeFromVerifier } from "@/lib/pkce";
import { chunkText, toEmbeddingVector, cosineSimilarity } from "@/lib/ragUtils";
import {
  HUGGINGFACE_EMBEDDING_MODEL,
  HUGGINGFACE_TEXT_MODELS,
  OPENROUTER_FREE_MODELS,
} from "@/lib/mlopsModels";
import { RagChunk } from "@/types";

const OR_VERIFIER_KEY = "momentum-cv-openrouter-pkce-verifier";

function PingBadge({ ping, busy }: { ping: { ok: boolean; latencyMs: number; checkedAt: string; message?: string } | null; busy: boolean }) {
  if (busy) return <span className="text-xs text-[var(--muted)]">Pinging...</span>;
  if (!ping) return <span className="text-xs text-[var(--muted)]">Never pinged</span>;
  return (
    <span className={`text-xs font-medium ${ping.ok ? "text-[var(--status-done)]" : "text-[var(--tier-critical)]"}`}>
      {ping.ok ? `OK - ${ping.latencyMs}ms` : `Failed - ${ping.message ?? "error"}`}
      <span className="ml-1 text-[var(--muted)]" suppressHydrationWarning>
        ({new Date(ping.checkedAt).toLocaleTimeString("en-US")})
      </span>
    </span>
  );
}

export default function MlOpsPage() {
  const { user } = useAuth();
  const mlops = useMlOps();

  const [orBusy, setOrBusy] = useState(false);
  const [orError, setOrError] = useState<string | null>(null);
  const [pingingOr, setPingingOr] = useState(false);

  const [hfError, setHfError] = useState<string | null>(null);
  const [pingingHf, setPingingHf] = useState(false);

  const [ragText, setRagText] = useState("");
  const [ragBusy, setRagBusy] = useState(false);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState<{ chunk: RagChunk; score: number }[]>([]);
  const [ragQueryBusy, setRagQueryBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const verifier = window.sessionStorage.getItem(OR_VERIFIER_KEY);
      window.sessionStorage.removeItem(OR_VERIFIER_KEY);
      window.history.replaceState({}, "", "/mlops");
      if (verifier) {
        (async () => {
          setOrBusy(true);
          try {
            const res = await fetch("/api/mlops/openrouter/exchange", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ code, codeVerifier: verifier }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Exchange failed.");
            mlops.connectOpenRouter(data.key);
          } catch (err) {
            setOrError((err as Error).message);
          } finally {
            setOrBusy(false);
          }
        })();
      }
    }

    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const hfToken = hashParams.get("hf_token");
      const hfUser = hashParams.get("hf_user");
      const hfErr = hashParams.get("hf_error");
      if (hfToken) mlops.connectHuggingFace(hfToken, hfUser);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (hfErr) setHfError(hfErr);
      window.history.replaceState({}, "", "/mlops");
    }
    // Intentional one-time check of the return URL on mount, not on every
    // mlops-context change - see auth.tsx for the same hydration pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Sign in required</h1>
        <p className="mt-2 text-[var(--muted)]">
          Model Builder is single-sign-on access for developers. Sign in to continue.
        </p>
        <Link href="/login" className="mt-6 inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white">
          Sign in
        </Link>
      </div>
    );
  }

  if (!canAccessDeveloperTools(user.role)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-[var(--brand-strong)]">Developer access required</h1>
        <p className="mt-2 text-[var(--muted)]">
          Signed in as {user.name} ({user.role}). Only the Developer or Admin
          role can connect and build models here.
        </p>
      </div>
    );
  }

  async function handleConnectOpenRouter() {
    setOrError(null);
    const verifier = randomCodeVerifier();
    window.sessionStorage.setItem(OR_VERIFIER_KEY, verifier);
    const challenge = await codeChallengeFromVerifier(verifier);
    const callbackUrl = `${window.location.origin}/mlops`;
    const authUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256`;
    window.location.href = authUrl;
  }

  function handleConnectHuggingFace() {
    setHfError(null);
    const clientId = process.env.NEXT_PUBLIC_HF_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_HF_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      setHfError(
        "Hugging Face OAuth is not configured yet (NEXT_PUBLIC_HF_CLIENT_ID / NEXT_PUBLIC_HF_REDIRECT_URI)."
      );
      return;
    }
    const authUrl = `https://huggingface.co/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid profile inference-api")}&state=${randomCodeVerifier()}`;
    window.location.href = authUrl;
  }

  async function pingOpenRouter() {
    if (!mlops.openRouter.apiKey || !mlops.openRouter.selectedModel) return;
    setPingingOr(true);
    const start = Date.now();
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${mlops.openRouter.apiKey}`,
        },
        body: JSON.stringify({
          model: mlops.openRouter.selectedModel,
          messages: [{ role: "user", content: "Reply with just the word OK." }],
          max_tokens: 5,
        }),
      });
      const data = await res.json();
      const latencyMs = Date.now() - start;
      mlops.recordPing("openRouter", {
        ok: res.ok,
        latencyMs,
        checkedAt: new Date().toISOString(),
        message: res.ok ? undefined : data.error?.message || "Request failed.",
      });
    } catch (err) {
      mlops.recordPing("openRouter", {
        ok: false,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
        message: (err as Error).message,
      });
    } finally {
      setPingingOr(false);
    }
  }

  async function pingHuggingFace() {
    if (!mlops.huggingFace.accessToken || !mlops.huggingFace.selectedModel) return;
    setPingingHf(true);
    const start = Date.now();
    try {
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${mlops.huggingFace.selectedModel}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${mlops.huggingFace.accessToken}`,
          },
          body: JSON.stringify({ inputs: "Say hello.", parameters: { max_new_tokens: 5 } }),
        }
      );
      const data = await res.json();
      const latencyMs = Date.now() - start;
      mlops.recordPing("huggingFace", {
        ok: res.ok,
        latencyMs,
        checkedAt: new Date().toISOString(),
        message: res.ok ? undefined : data.error || "Request failed (model may be cold-starting - try again).",
      });
    } catch (err) {
      mlops.recordPing("huggingFace", {
        ok: false,
        latencyMs: Date.now() - start,
        checkedAt: new Date().toISOString(),
        message: (err as Error).message,
      });
    } finally {
      setPingingHf(false);
    }
  }

  async function embedText(text: string): Promise<number[]> {
    const res = await fetch(
      `https://api-inference.huggingface.co/models/${HUGGINGFACE_EMBEDDING_MODEL.id}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${mlops.huggingFace.accessToken}`,
        },
        body: JSON.stringify({ inputs: text }),
      }
    );
    const raw = await res.json();
    if (!res.ok) throw new Error(raw.error || "Embedding request failed.");
    return toEmbeddingVector(raw);
  }

  async function ingestRagText() {
    if (!mlops.huggingFace.accessToken || !ragText.trim()) return;
    setRagBusy(true);
    setHfError(null);
    try {
      const pieces = chunkText(ragText);
      const newChunks: RagChunk[] = [];
      for (const text of pieces) {
        const embedding = await embedText(text);
        newChunks.push({
          id: `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text,
          embedding,
          addedAt: new Date().toISOString(),
        });
      }
      mlops.addRagChunks(newChunks);
      setRagText("");
    } catch (err) {
      setHfError((err as Error).message);
    } finally {
      setRagBusy(false);
    }
  }

  async function runRagQuery() {
    if (!mlops.huggingFace.accessToken || !ragQuery.trim() || mlops.ragChunks.length === 0) return;
    setRagQueryBusy(true);
    setHfError(null);
    try {
      const queryEmbedding = await embedText(ragQuery);
      const scored = mlops.ragChunks
        .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      setRagResults(scored);
    } catch (err) {
      setHfError((err as Error).message);
    } finally {
      setRagQueryBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--brand-strong)]">Model Builder</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Connect your own free-tier model accounts, build a small RAG demo, and monitor live status.
          </p>
        </div>
        <span className="whitespace-nowrap rounded-full border border-[var(--status-done)]/30 bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--status-done)]">
          Real connections - your own accounts, real API calls
        </span>
      </div>

      {/* Off-the-shelf models: OpenRouter */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Off-the-shelf models &middot; OpenRouter
          </h2>
          {mlops.openRouter.connected && (
            <button
              onClick={mlops.disconnectOpenRouter}
              className="text-xs text-[var(--muted)] hover:underline"
            >
              Disconnect
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          OAuth PKCE sign-in - no app registration needed, no key ever pasted into this page.
        </p>

        {!mlops.openRouter.connected ? (
          <button
            onClick={handleConnectOpenRouter}
            disabled={orBusy}
            className="mt-4 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {orBusy ? "Connecting..." : "Connect with OpenRouter"}
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--status-done)]">Connected</p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={mlops.openRouter.selectedModel ?? ""}
                onChange={(e) => mlops.selectOpenRouterModel(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Choose a free model...
                </option>
                {OPENROUTER_FREE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                onClick={pingOpenRouter}
                disabled={!mlops.openRouter.selectedModel || pingingOr}
                className="rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ping
              </button>
              <PingBadge ping={mlops.pings.openRouter} busy={pingingOr} />
            </div>
          </div>
        )}
        {orError && <p className="mt-3 text-sm text-[var(--tier-critical)]">{orError}</p>}
      </div>

      {/* Custom models: Hugging Face */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
            Custom models &middot; Hugging Face
          </h2>
          {mlops.huggingFace.connected && (
            <button
              onClick={mlops.disconnectHuggingFace}
              className="text-xs text-[var(--muted)] hover:underline"
            >
              Disconnect
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Sign in with Hugging Face - requires a one-time OAuth app registration (see setup notes).
        </p>

        {!mlops.huggingFace.connected ? (
          <button
            onClick={handleConnectHuggingFace}
            className="mt-4 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Sign in with Hugging Face
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[var(--status-done)]">
              Connected{mlops.huggingFace.username ? ` as ${mlops.huggingFace.username}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={mlops.huggingFace.selectedModel ?? ""}
                onChange={(e) => mlops.selectHuggingFaceModel(e.target.value)}
                className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Choose a model...
                </option>
                {HUGGINGFACE_TEXT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <button
                onClick={pingHuggingFace}
                disabled={!mlops.huggingFace.selectedModel || pingingHf}
                className="rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                Ping
              </button>
              <PingBadge ping={mlops.pings.huggingFace} busy={pingingHf} />
            </div>
          </div>
        )}
        {hfError && <p className="mt-3 text-sm text-[var(--tier-critical)]">{hfError}</p>}
      </div>

      {/* RAG demo */}
      <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          RAG demo
        </h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Connecting Hugging Face above is what supplies the real embedding model
          ({HUGGINGFACE_EMBEDDING_MODEL.label}) these ingest/query calls actually run against - text you
          paste below is really chunked and embedded, then retrieved by real cosine similarity, not
          keyword matching. &quot;Session only&quot; is literal: the embedded chunks live in this
          browser tab&apos;s memory and are gone on reload - unlike everything else in this app since
          the database landed, nothing here is written to Postgres.
        </p>

        {!mlops.huggingFace.connected ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            Connect Hugging Face above to enable RAG (it powers the embedding calls).
          </p>
        ) : (
          <>
            <div className="mt-4">
              <textarea
                value={ragText}
                onChange={(e) => setRagText(e.target.value)}
                placeholder="Paste a short document to ingest..."
                rows={4}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              />
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={ingestRagText}
                  disabled={ragBusy || !ragText.trim()}
                  className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {ragBusy ? "Embedding..." : "Ingest"}
                </button>
                <span className="text-xs text-[var(--muted)]">
                  {mlops.ragChunks.length} chunk{mlops.ragChunks.length === 1 ? "" : "s"} stored this session
                </span>
                {mlops.ragChunks.length > 0 && (
                  <button
                    onClick={mlops.clearRagDocuments}
                    className="text-xs text-[var(--muted)] hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <div className="flex items-center gap-3">
                <input
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  placeholder="Ask a question about the ingested text..."
                  className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                />
                <button
                  onClick={runRagQuery}
                  disabled={ragQueryBusy || !ragQuery.trim() || mlops.ragChunks.length === 0}
                  className="rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {ragQueryBusy ? "Searching..." : "Ask"}
                </button>
              </div>

              {ragResults.length > 0 && (
                <div className="mt-4 space-y-2">
                  {ragResults.map(({ chunk, score }) => (
                    <div
                      key={chunk.id}
                      className="rounded-md border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-sm"
                    >
                      <p className="text-xs text-[var(--muted)]">similarity {score.toFixed(3)}</p>
                      <p className="mt-1">{chunk.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
