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

export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseKey } = publicEnv;
  if (!supabaseUrl || !supabaseKey) return false;
  try {
    const { protocol } = new URL(supabaseUrl);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export function getSupabaseEnv(): { url: string; key: string } {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
  return { url: publicEnv.supabaseUrl, key: publicEnv.supabaseKey };
}
