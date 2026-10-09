import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle } from "@/components/admin/page-title";
import { requireAdmin } from "@/lib/auth/session";
import { getAppSettings } from "@/lib/settings/settings";
import { createClient } from "@/lib/supabase/server";
import { MAX_BODY_BYTES } from "@/lib/utils/middlewares";
import { LIMITS } from "@/lib/utils/validation";

export const metadata: Metadata = { title: "Rate Limits" };

type Usage = {
  user_id: string;
  email: string | null;
  last_minute: number;
  last_hour: number;
  last_day: number;
  cost_last_day: number;
  last_message_at: string;
};

const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "UTC" });

export default function RateLimitsPage() {
  return (
    <>
      <PageTitle title="Rate Limits" description="The limits that protect the API and your AI bill, and current usage." />
      <Suspense fallback={<div className="h-80 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60" aria-busy="true" aria-label="Loading rate limits" />}>
        <RateLimitsView />
      </Suspense>
    </>
  );
}

async function RateLimitsView() {
  const me = await requireAdmin("/admin/rate-limits");
  if (!me) return null;

  const settings = await getAppSettings();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_chat_usage");
  const usage = ((data ?? []) as Usage[]).map((u) => ({ ...u, cost_last_day: Number(u.cost_last_day) }));
  const perMinute = settings.chatMessagesPerMinute;

  const limits: { what: string; limit: string; scope: string; source?: { href: string; label: string } }[] = [
    { what: "Admin AI chat", limit: `${perMinute} messages / minute`, scope: "per admin", source: { href: "/admin/settings", label: "Change in Settings" } },
    { what: "Chat message length", limit: `${LIMITS.message.toLocaleString()} characters`, scope: "per message" },
    { what: "Request body (all JSON APIs)", limit: `${MAX_BODY_BYTES / 1024} KB`, scope: "per request" },
    { what: "Ticket description", limit: `${LIMITS.description.toLocaleString()} characters`, scope: "per ticket" },
    { what: "POST /api/chat, POST /api/tickets", limit: "No per-client limit", scope: "protected by API key / HMAC signature" },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-200">Limits</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs tracking-wider text-zinc-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">What</th>
                <th scope="col" className="px-4 py-3 font-medium">Limit</th>
                <th scope="col" className="px-4 py-3 font-medium">Applies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {limits.map((l) => (
                <tr key={l.what} className="bg-zinc-950/40">
                  <td className="px-4 py-3 text-zinc-200">{l.what}</td>
                  <td className="px-4 py-3 font-mono text-zinc-100">
                    {l.limit}
                    {l.source ? (
                      <Link href={l.source.href} className="ml-2 font-sans text-xs text-emerald-400 hover:underline">
                        {l.source.label}
                      </Link>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{l.scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!settings.aiEnabled ? (
          <p className="mt-2 text-xs text-amber-300">AI answers are currently turned off in Settings.</p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-zinc-200">AI chat usage (last 24 hours)</h2>
        {error ? (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Couldn&apos;t load usage. Run the Part 5 database migration if you haven&apos;t yet.
          </p>
        ) : usage.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-500">
            No chat messages in the last 24 hours.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-zinc-900/80 text-xs tracking-wider text-zinc-500 uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Admin</th>
                  <th scope="col" className="px-4 py-3 font-medium">This minute</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last hour</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last 24h</th>
                  <th scope="col" className="px-4 py-3 font-medium">AI cost 24h</th>
                  <th scope="col" className="px-4 py-3 font-medium">Last message (UTC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {usage.map((u) => {
                  const pct = Math.min(100, Math.round((u.last_minute / perMinute) * 100));
                  const atLimit = u.last_minute >= perMinute;
                  return (
                    <tr key={u.user_id} className="bg-zinc-950/40">
                      <td className="px-4 py-3 text-zinc-200">{u.email ?? "Deleted user"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800"
                            role="meter"
                            aria-valuemin={0}
                            aria-valuemax={perMinute}
                            aria-valuenow={u.last_minute}
                            aria-label={`${u.last_minute} of ${perMinute} messages this minute`}
                          >
                            <div className={`h-full ${atLimit ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`font-mono text-xs ${atLimit ? "text-red-300" : "text-zinc-300"}`}>
                            {u.last_minute}/{perMinute}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{u.last_hour}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">{u.last_day}</td>
                      <td className="px-4 py-3 font-mono text-zinc-300">${u.cost_last_day.toFixed(4)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-400">{time.format(new Date(u.last_message_at))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-zinc-500">Counts are messages sent by each admin; cost is the AI cost of the replies.</p>
      </section>
    </div>
  );
}
