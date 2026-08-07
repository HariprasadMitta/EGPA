"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { canAccessDeveloperTools, canSeeAllUseCases, ROLE_LABELS } from "@/lib/roles";

const CONTROL_PLANE_LINKS = [
  { href: "/guide", label: "Guide" },
  { href: "/intake", label: "Intake" },
  { href: "/registry", label: "Model Registry" },
  { href: "/portfolio", label: "Portfolio" },
];

function pillClasses(active: boolean, activeBg = "bg-[var(--brand)]") {
  return `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
    active
      ? `${activeBg} border-transparent text-white`
      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--background)]"
  }`;
}

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [inboxCount, setInboxCount] = useState<number | null>(null);

  useEffect(() => {
    // No reset-to-null on sign-out: the badge only renders inside the
    // `user &&` block below, so a stale count is simply never shown once
    // signed out - no need to trigger an extra render for it.
    if (!user) return;
    let cancelled = false;
    fetch("/api/action-inbox")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setInboxCount(d.items?.length ?? 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  function handleSignOut() {
    logout();
    router.push("/");
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-[var(--brand-strong)]">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--brand-red)] text-sm font-bold text-white">
            E
          </span>
          <span className="flex flex-col leading-tight">
            <span>EGPA</span>
            <span className="hidden text-[10px] font-normal uppercase tracking-wide text-[var(--muted)] sm:inline">
              Enterprise Governance Platform for AI
            </span>
          </span>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {CONTROL_PLANE_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={pillClasses(pathname === link.href)}>
              {link.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className={pillClasses(pathname === "/dashboard", "bg-[var(--accent)]")}
          >
            Observability
          </Link>
          {user && canAccessDeveloperTools(user.role) && (
            <Link
              href="/execution"
              className={pillClasses(pathname === "/execution", "bg-[var(--accent)]")}
            >
              Execute
            </Link>
          )}
          {user && canAccessDeveloperTools(user.role) && (
            <Link
              href="/mlops"
              className={pillClasses(pathname === "/mlops", "bg-[var(--accent)]")}
            >
              Model Builder
            </Link>
          )}
          {user && (
            <Link
              href="/inbox"
              className={`${pillClasses(pathname === "/inbox")} relative`}
            >
              Inbox
              {inboxCount !== null && inboxCount > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand-red)] px-1 text-[10px] font-bold text-white">
                  {inboxCount}
                </span>
              )}
            </Link>
          )}
          {user && canSeeAllUseCases(user.role) && (
            <Link
              href="/governance"
              className={pillClasses(pathname === "/governance", "bg-[var(--brand-red)]")}
            >
              Governance
            </Link>
          )}
          {user && user.role === "admin" && (
            <Link
              href="/admin"
              className={pillClasses(pathname === "/admin", "bg-[var(--brand-red)]")}
            >
              Admin
            </Link>
          )}

          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          {user ? (
            <div className="flex items-center gap-2 pl-1">
              <span className="text-xs text-[var(--muted)]">
                {user.name} <span className="text-[var(--foreground)]">&middot; {ROLE_LABELS[user.role]}</span>
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-full px-3 py-1.5 text-xs text-[var(--muted)] hover:bg-[var(--background)]"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-[var(--brand-red)] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
