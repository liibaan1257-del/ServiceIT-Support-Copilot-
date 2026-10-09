/**
 * Public environment values (NEXT_PUBLIC_*). They are inlined into the
 * browser bundle at build time, so never put secrets here. Each variable is
 * referenced literally so Next.js can inline it.
 */

/** Trims whitespace and stray quotes/backticks pasted into dashboards. */
function clean(value: string | undefined): string {
  return (value ?? "").trim().replace(/^[`"']+|[`"']+$/g, "").trim();
}

export const publicEnv = {
  supabaseUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, ""),
  // The anon key or the newer publishable key (sb_publishable_...). Safe in
  // the browser: Row Level Security protects the data.
  supabaseKey:
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
} as const;

export type SupabaseConfigStatus = "ok" | "missing_url" | "missing_key" | "invalid_url";

/** Non-secret summary of the Supabase setup (safe to show and return from /api/health). */
export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const { supabaseUrl, supabaseKey } = publicEnv;
  if (!supabaseUrl) return "missing_url";
  if (!supabaseKey) return "missing_key";
  try {
    const { protocol } = new URL(supabaseUrl);
    return protocol === "https:" || protocol === "http:" ? "ok" : "invalid_url";
  } catch {
    return "invalid_url";
  }
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigStatus() === "ok";
}

export function getSupabaseEnv(): { url: string; key: string } {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return { url: publicEnv.supabaseUrl, key: publicEnv.supabaseKey };
}
