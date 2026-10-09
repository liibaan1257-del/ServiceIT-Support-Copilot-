"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ADMIN_NAV } from "@/components/admin/nav";
import { LiveStatus } from "@/components/admin/live-status";
import { logout } from "@/lib/auth/actions";

export type AdminUser = { email: string | null; role: string };

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
          <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
        </svg>
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-zinc-100">ServiceIT</p>
        <p className="text-xs text-zinc-500">Admin</p>
      </div>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg border-l-2 px-3 py-2 text-sm transition-colors ${
              active
                ? "border-emerald-400 bg-zinc-800/80 font-medium text-zinc-100"
                : "border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ user }: { user: AdminUser }) {
  return (
    <div className="space-y-2 border-t border-zinc-800 p-4">
      <p className="truncate text-xs text-zinc-400" title={user.email ?? undefined}>
        {user.email ?? "Signed in"}
      </p>
      <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
        {user.role}
      </span>
    </div>
  );
}

function SignOutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
      >
        Sign out
      </button>
    </form>
  );
}

/** Dark admin layout: fixed sidebar on desktop, slide-in drawer on mobile. */
export function AdminShell({ children, user }: { children: ReactNode; user: AdminUser }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the drawer with Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-200">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-zinc-800 bg-zinc-900/60 lg:flex">
        <div className="p-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <NavLinks />
        </div>
        <SidebarFooter user={user} />
      </aside>

      {/* Mobile drawer */}
      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/70"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between p-5">
              <Logo />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Close menu"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
            </div>
            <SidebarFooter user={user} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 lg:hidden"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-sm font-medium text-zinc-300 lg:hidden">ServiceIT Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <LiveStatus />
            <SignOutButton />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
