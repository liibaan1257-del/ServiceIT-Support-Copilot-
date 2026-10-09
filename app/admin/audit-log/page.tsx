import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle } from "@/components/admin/page-title";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit Log" };

const PAGE_SIZE = 50;

/** Known actions: label + filter value. Unknown actions still display. */
const ACTIONS: Record<string, string> = {
  "user.role_changed": "Role changed",
  "settings.updated": "Settings updated",
};

const SETTING_LABELS: Record<string, string> = {
  ai_enabled: "AI enabled",
  ai_effort: "Answer depth",
  chat_messages_per_minute: "Chat messages / minute",
  support_notes: "Help desk notes",
};

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
});

type Entry = {
  id: number;
  actor_email: string | null;
  action: string;
  target_email: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export default function AuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  return (
    <>
      <PageTitle title="Audit Log" description="Who changed what, and when. Entries can't be edited or deleted from the app." />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60" aria-busy="true" aria-label="Loading audit log" />}>
        <AuditView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function href(action: string | null, page = 1) {
  const p = new URLSearchParams();
  if (action) p.set("action", action);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
}

/** Human-readable summary of an entry's details. */
function describe(entry: Entry): string {
  const d = entry.details ?? {};
  if (entry.action === "user.role_changed") return `${String(d.from)} → ${String(d.to)}`;
  if (entry.action === "settings.updated") {
    return Object.entries(d)
      .map(([key, change]) => {
        const c = (change ?? {}) as Record<string, unknown>;
        const label = SETTING_LABELS[key] ?? key;
        if ("from_length" in c) return `${label}: ${String(c.from_length)} → ${String(c.to_length)} characters`;
        return `${label}: ${String(c.from)} → ${String(c.to)}`;
      })
      .join(" · ");
  }
  return JSON.stringify(d);
}

async function AuditView({ searchParams }: { searchParams: PageProps<"/admin/audit-log">["searchParams"] }) {
  const me = await requireAdmin("/admin/audit-log");
  if (!me) return null;

  const params = await searchParams;
  const action = typeof params.action === "string" && params.action in ACTIONS ? params.action : null;
  const page = Math.min(Math.max(Number.parseInt(String(params.page ?? "1"), 10) || 1, 1), 10_000);

  const supabase = await createClient();
  let query = supabase
    .from("audit_log")
    .select("id, actor_email, action, target_email, details, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (action) query = query.eq("action", action);
  const { data, count, error } = await query;
  if (error) throw new Error(`audit log query failed: ${error.code ?? error.message}`);
  const entries = (data ?? []) as Entry[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <nav aria-label="Filter by action" className="flex flex-wrap gap-2">
        {[null, ...Object.keys(ACTIONS)].map((a) => (
          <Link
            key={a ?? "all"}
            href={href(a)}
            aria-current={action === a ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs ${
              action === a ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {a ? ACTIONS[a] : "All"}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center">
          <p className="text-sm font-medium text-zinc-300">No entries yet</p>
          <p className="mt-1 text-sm text-zinc-500">Role changes and settings changes will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs tracking-wider text-zinc-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Time (UTC)</th>
                <th scope="col" className="px-4 py-3 font-medium">Who</th>
                <th scope="col" className="px-4 py-3 font-medium">Action</th>
                <th scope="col" className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {entries.map((e) => (
                <tr key={e.id} className="bg-zinc-950/40 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-400">{dateTime.format(new Date(e.created_at))}</td>
                  <td className="px-4 py-3 text-zinc-200">{e.actor_email ?? "Unknown"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs whitespace-nowrap text-zinc-300">
                      {ACTIONS[e.action] ?? e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {e.target_email ? <span className="font-medium text-zinc-100">{e.target_email}: </span> : null}
                    {describe(e)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
        <p>{total ? `${total.toLocaleString()} entr${total === 1 ? "y" : "ies"}` : ""}</p>
        {pages > 1 ? (
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={href(action, page - 1)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800">
                Newer
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={href(action, page + 1)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800">
                Older
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
