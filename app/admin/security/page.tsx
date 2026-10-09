import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { PageTitle } from "@/components/admin/page-title";
import { isAiConfigured } from "@/lib/ai/copilot";
import { listUsers } from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth/session";
import { checkSupabaseAuth, getSupabaseConfigStatus, getSupabaseProjectRef } from "@/lib/env";
import { securityHeaders } from "@/lib/security/headers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Security" };

type Status = "ok" | "warn" | "fail";
type Check = { name: string; status: Status; detail: string };

const dateTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/** Recommended minimum length for the server's shared secrets. */
const MIN_SECRET_LENGTH = 32;

export default function SecurityPage() {
  return (
    <>
      <PageTitle title="Security" description="Live checks of secrets, database protection, admin access and HTTP headers. Secret values are never shown." />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60" aria-busy="true" aria-label="Loading security checks" />}>
        <SecurityView />
      </Suspense>
    </>
  );
}

/** Presence and length of a server-only secret (the value itself never leaves this function). */
function secretCheck(name: string, purpose: string, feature: string): Check {
  const value = process.env[name]?.trim() ?? "";
  if (!value) return { name, status: "fail", detail: `Missing. ${feature} won't work until it's set in Vercel.` };
  if (value.length < MIN_SECRET_LENGTH) {
    return { name, status: "warn", detail: `Set, but shorter than ${MIN_SECRET_LENGTH} characters. Use a longer random value.` };
  }
  return { name, status: "ok", detail: `Set (${purpose}).` };
}

async function SecurityView() {
  const me = await requireAdmin("/admin/security");
  if (!me) return null;

  const supabase = await createClient();
  const [authStatus, tables, admins] = await Promise.all([
    checkSupabaseAuth(),
    supabase.rpc("admin_security_overview"),
    listUsers({ q: "", role: "admin", page: 1 }),
  ]);

  const configStatus = getSupabaseConfigStatus();
  const checks: Check[] = [
    {
      name: "Supabase connection",
      status: configStatus === "ok" && authStatus === "ok" ? "ok" : "fail",
      detail:
        configStatus !== "ok"
          ? `Configuration problem: ${configStatus}.`
          : authStatus === "ok"
            ? `Connected to project ${getSupabaseProjectRef()}; the key is accepted.`
            : authStatus === "key_rejected"
              ? "The key doesn't belong to this project. Fix NEXT_PUBLIC_SUPABASE_ANON_KEY."
              : "Supabase couldn't be reached.",
    },
    secretCheck("API_KEY", "authenticates POST /api/chat", "POST /api/chat"),
    secretCheck("WEBHOOK_SECRET", "verifies POST /api/tickets signatures", "POST /api/tickets"),
    isAiConfigured()
      ? { name: "ANTHROPIC_API_KEY", status: "ok", detail: "Set (server-only; used for AI answers)." }
      : { name: "ANTHROPIC_API_KEY", status: "fail", detail: "Missing. AI chat won't work until it's set in Vercel." },
  ];

  type Table = { table_name: string; rls_enabled: boolean; policy_count: number };
  const tableRows = (tables.data ?? []) as Table[];
  const rlsOff = tableRows.filter((t) => !t.rls_enabled);
  checks.push(
    tables.error
      ? { name: "Row Level Security", status: "warn", detail: "Couldn't check: run the Part 5 database migration." }
      : rlsOff.length
        ? { name: "Row Level Security", status: "fail", detail: `Off on: ${rlsOff.map((t) => t.table_name).join(", ")}.` }
        : { name: "Row Level Security", status: "ok", detail: `On for all ${tableRows.length} tables.` },
  );
  checks.push(
    admins.total === 1
      ? { name: "Admin accounts", status: "warn", detail: "Only one admin. Consider a second trusted admin so you can't be locked out." }
      : { name: "Admin accounts", status: "ok", detail: `${admins.total} admins.` },
  );

  const failing = checks.filter((c) => c.status === "fail").length;
  const warnings = checks.filter((c) => c.status === "warn").length;

  return (
    <div className="space-y-6">
      <p
        role="status"
        className={`rounded-xl border px-4 py-3 text-sm ${
          failing
            ? "border-red-500/30 bg-red-500/10 text-red-200"
            : warnings
              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        }`}
      >
        {failing
          ? `${failing} check${failing === 1 ? "" : "s"} failing${warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}.`
          : warnings
            ? `All critical checks pass, ${warnings} warning${warnings === 1 ? "" : "s"}.`
            : "All checks pass."}
      </p>

      <Section title="Checks">
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {checks.map((c) => (
            <li key={c.name} className="flex items-start gap-3 bg-zinc-950/40 px-4 py-3">
              <Badge status={c.status} />
              <div className="min-w-0">
                <p className="font-mono text-sm text-zinc-100">{c.name}</p>
                <p className="text-sm text-zinc-400">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Admin accounts">
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {admins.rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 bg-zinc-950/40 px-4 py-3 text-sm">
              <span className="text-zinc-100">
                {a.email}
                {a.id === me.id ? <span className="ml-2 text-xs text-zinc-500">(you)</span> : null}
              </span>
              <span className="text-xs text-zinc-500">
                Last sign-in: {a.lastSignInAt ? `${dateTime.format(new Date(a.lastSignInAt))} UTC` : "never"}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {tableRows.length ? (
        <Section title="Database tables">
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-zinc-900/80 text-xs tracking-wider text-zinc-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Table</th>
                  <th scope="col" className="px-4 py-3 font-medium">Row Level Security</th>
                  <th scope="col" className="px-4 py-3 font-medium">Policies</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {tableRows.map((t) => (
                  <tr key={t.table_name} className="bg-zinc-950/40">
                    <td className="px-4 py-3 font-mono text-zinc-200">{t.table_name}</td>
                    <td className="px-4 py-3">
                      <Badge status={t.rls_enabled ? "ok" : "fail"} label={t.rls_enabled ? "On" : "Off"} />
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400">{Number(t.policy_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-500">A table with no policies is closed to the app&apos;s users; only database functions can use it.</p>
        </Section>
      ) : null}

      <Section title="HTTP security headers">
        <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
          {securityHeaders.map((h) => (
            <li key={h.key} className="bg-zinc-950/40 px-4 py-3">
              <p className="font-mono text-sm text-zinc-100">{h.key}</p>
              <p className="text-sm text-zinc-400">{h.purpose}</p>
              <p className="mt-1 font-mono text-xs break-all text-zinc-500">{h.value}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-zinc-200">{title}</h2>
      {children}
    </section>
  );
}

function Badge({ status, label }: { status: Status; label?: string }) {
  const styles: Record<Status, string> = {
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    fail: "border-red-500/30 bg-red-500/10 text-red-300",
  };
  const text = label ?? { ok: "OK", warn: "Warning", fail: "Fix" }[status];
  return (
    <span className={`mt-0.5 inline-block shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${styles[status]}`}>
      {text}
    </span>
  );
}
