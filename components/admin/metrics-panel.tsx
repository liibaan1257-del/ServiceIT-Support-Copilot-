"use client";

import { useCallback, useEffect, useState } from "react";

type Metrics = {
  totalRequests: number;
  totalCost: number;
  averageLatency: number;
  activeRequests: number;
  requestId: string;
};

const REFRESH_MS = 10_000;

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="text-xs font-medium tracking-wider text-zinc-500 uppercase">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-zinc-100 sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

/** Live view of GET /api/metrics, refreshed every 10 seconds. */
export function MetricsPanel() {
  const [data, setData] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
      setUpdatedAt(new Date());
    } catch {
      setError("Couldn't load metrics. Retrying automatically.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()} · refreshes every 10s` : "Loading…"}
        </p>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
          <Card label="Total requests" value={data.totalRequests.toLocaleString()} hint="since this server started" />
          <Card label="Total cost" value={`$${data.totalCost.toFixed(4)}`} hint="USD · AI usage (from Part 4)" />
          <Card label="Average latency" value={`${data.averageLatency} ms`} hint="per request" />
          <Card label="Active requests" value={String(data.activeRequests)} hint="right now" />
        </div>
      ) : !error ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading metrics">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[116px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60" />
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-400">
        <p className="font-medium text-zinc-300">About these numbers</p>
        <p className="mt-1">
          Counted in memory by each server instance, so on Vercel they reset when an instance restarts and
          can differ between refreshes. Request logs are written as JSON to stdout (Vercel → Logs). Lasting
          history arrives with the database in Part 3.
        </p>
      </div>
    </div>
  );
}
