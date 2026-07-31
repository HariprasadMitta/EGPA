"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { RiskBadge } from "@/components/RiskBadge";
import { SAMPLE_BUNDLES } from "@/lib/seed";

export default function LandingPage() {
  const router = useRouter();
  const { loadSample } = useStore();

  function openSample(id: string) {
    loadSample(id);
    router.push("/recommendation");
  }

  return (
    <div>
      <section className="bg-gradient-to-br from-[var(--brand)] to-[var(--brand-strong)] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#7fe0d8]">
              Enterprise AI Governance &amp; Framework Advisor
            </p>
            <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl">
              Submit a use case. Get a governed, explainable AI architecture
              recommendation in minutes.
            </h1>
            <p className="mt-5 text-lg text-white/80">
              Enforced, not optional. Momentum computes a risk tier from your use
              case, recommends a concrete agent framework and tool stack, and
              blocks progress until the required governance controls for that
              tier are satisfied &mdash; with a full decision record every time.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/intake"
                className="rounded-full bg-[var(--brand-red)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-90"
              >
                Try it: submit a use case
              </Link>
              <a
                href="#samples"
                className="rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                See a sample recommendation
              </a>
            </div>
            <p className="mt-4 text-xs text-white/60">
              New here?{" "}
              <Link href="/guide" className="font-semibold text-white underline underline-offset-2">
                Start with the Guide
              </Link>{" "}
              for a walkthrough of the whole pipeline.
            </p>
            <p className="mt-2 text-xs text-white/60">
              No login required. Nothing sensitive is stored server-side &mdash;
              state lives in your browser session.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
              What you get for every use case
            </h2>
            <ul className="mt-4 space-y-4 text-sm text-[var(--foreground)]">
              <li className="flex gap-3">
                <span className="mt-0.5 h-5 w-5 flex-none rounded-full bg-[var(--tier-low-bg)] text-center text-xs font-bold text-[var(--tier-low)]">
                  1
                </span>
                <span>
                  <strong>Recommended framework &amp; tool stack</strong> &mdash;
                  framework-agnostic, drawn from a structured catalog.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-5 w-5 flex-none rounded-full bg-[var(--tier-medium-bg)] text-center text-xs font-bold text-[var(--tier-medium)]">
                  2
                </span>
                <span>
                  <strong>Harness, loop, and context strategy</strong> &mdash;
                  with an iteration ceiling matched to risk.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-5 w-5 flex-none rounded-full bg-[var(--tier-high-bg)] text-center text-xs font-bold text-[var(--tier-high)]">
                  3
                </span>
                <span>
                  <strong>A computed governance verdict</strong> &mdash; risk
                  tier, required controls, and HITL level you must satisfy, not
                  opt into.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 h-5 w-5 flex-none rounded-full bg-[var(--tier-critical-bg)] text-center text-xs font-bold text-[var(--tier-critical)]">
                  4
                </span>
                <span>
                  <strong>An auto-generated, versioned ADR</strong> &mdash;
                  downloadable, traceable to every decision above.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-14">
        <section id="samples" className="scroll-mt-20">
          <h2 className="text-2xl font-bold text-[var(--brand-strong)]">
            Try a pre-loaded example
          </h2>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">
            Open one of these to see a full recommendation, governance gate,
            ADR, and observability dashboard already populated &mdash; no typing
            required.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_BUNDLES.map((bundle) => (
              <button
                key={bundle.useCase.id}
                onClick={() => openSample(bundle.useCase.id)}
                className="flex flex-col items-start rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
              >
                <RiskBadge tier={bundle.useCase.riskTier} />
                <h3 className="mt-3 font-semibold text-[var(--foreground)]">
                  {bundle.useCase.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--muted)] line-clamp-3">
                  {bundle.useCase.description}
                </p>
                <span className="mt-4 text-sm font-semibold text-[var(--accent)]">
                  Open recommendation &rarr;
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-20 grid gap-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold text-[var(--brand-strong)]">
              Control Plane vs. AI Gateway
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Momentum <strong>is</strong> the Control Plane: risk templates,
              approval workflows, the model registry, and ADRs. It configures
              and observes the Gateway &mdash; the data-plane layer that
              actually routes live agent traffic &mdash; but does not sit in
              that traffic path itself.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--brand-strong)]">
              Framework-agnostic by design
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              LangGraph, AutoGen, Bedrock Agents, and a growing catalog of others
              are just entries the advisor can recommend from &mdash; the
              governance verdict is computed independently of which one you
              pick.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
