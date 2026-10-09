"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "live" | "offline";

/** Polls GET /api/health; shows "Live" only when the API really answers. */
export function LiveStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const body = await res.json();
        if (!cancelled) setStatus(res.ok && body?.status === "ok" ? "live" : "offline");
      } catch {
        if (!cancelled) setStatus("offline");
      }
    }
    check();
    const timer = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const styles = {
    checking: "border-zinc-700 text-zinc-400",
    live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    offline: "border-red-500/30 bg-red-500/10 text-red-400",
  }[status];
  const label = { checking: "Checking…", live: "Live", offline: "Offline" }[status];

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${status === "live" ? "bg-emerald-400" : status === "offline" ? "bg-red-400" : "bg-zinc-500"}`}
      />
      {label}
    </span>
  );
}
