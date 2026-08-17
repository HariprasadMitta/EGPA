"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { canAccessDeveloperTools, canSeeAllUseCases, ROLE_LABELS } from "@/lib/roles";

interface NavLink {
  href: string;
  label: string;
}

const PIPELINE_LINKS: NavLink[] = [
  { href: "/guide", label: "Guide" },
  { href: "/discovery", label: "Discovery" },
  { href: "/intake", label: "Intake" },
  { href: "/portfolio", label: "Portfolio" },
];

const BUILD_LINKS: NavLink[] = [
  { href: "/execution", label: "Agentic System" },
  { href: "/registry", label: "Model Registry" },
  { href: "/mlops", label: "Model Builder" },
];

function pillClasses(active: boolean, activeBg = "bg-[var(--brand)]") {
  return `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
    active
      ? `${activeBg} border-transparent text-white`
      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--background)]"
  }`;
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      className={`h-3.5 w-3.5 flex-none transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Groups several related links behind one top-level pill instead of each
// getting its own slot in the row - the flat 11-pill layout this replaced
// got clumsy as more real pages were added. Click-toggle (not hover-only)
// so it behaves the same on touch as it does with a mouse.
function NavDropdown({
  label,
  links,
  activeBg,
  isOpen,
  onToggle,
  onClose,
  isActive,
}: {
  label: string;
  links: NavLink[];
  activeBg: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isActive: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={`${pillClasses(isActive, activeBg)} flex items-center gap-1.5`}
      >
        {label}
        <ChevronIcon open={isOpen} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-40 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1.5 shadow-lg">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className="block px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--background)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<"pipeline" | "build" | null>(null);

  const userId = user?.id;
  useEffect(() => {
    // No reset-to-null on sign-out: the badge only renders inside the
    // `user &&` block below, so a stale count is simply never shown once
    // signed out - no need to trigger an extra render for it. Depends on
    // userId (a stable primitive), not the user object itself - useAuth()
    // returns a brand-new object literal every render, so depending on the
    // object would re-fire this effect (and re-fetch) on every render,
    // forever, since the fetch's own setState triggers the next render.
    if (!userId) return;
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
  }, [userId, pathname]);

  function handleSignOut() {
    logout();
    router.push("/");
  }

  const showBuildLinks = user && canAccessDeveloperTools(user.role);
  const pipelineActive = PIPELINE_LINKS.some((l) => l.href === pathname);
  const buildActive = BUILD_LINKS.some((l) => l.href === pathname);

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
          <NavDropdown
            label="Pipeline"
            links={PIPELINE_LINKS}
            activeBg="bg-[var(--brand)]"
            isOpen={openMenu === "pipeline"}
            onToggle={() => setOpenMenu((m) => (m === "pipeline" ? null : "pipeline"))}
            onClose={() => setOpenMenu(null)}
            isActive={pipelineActive}
          />
          <Link
            href="/dashboard"
            className={pillClasses(pathname === "/dashboard", "bg-[var(--accent)]")}
          >
            Observability
          </Link>
          {showBuildLinks && (
            <NavDropdown
              label="Build"
              links={BUILD_LINKS}
              activeBg="bg-[var(--accent)]"
              isOpen={openMenu === "build"}
              onToggle={() => setOpenMenu((m) => (m === "build" ? null : "build"))}
              onClose={() => setOpenMenu(null)}
              isActive={buildActive}
            />
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
