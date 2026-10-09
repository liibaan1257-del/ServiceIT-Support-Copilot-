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

/** The project ref from the Supabase URL (e.g. "abcd1234" from https://abcd1234.supabase.co). Not a secret. */
export function getSupabaseProjectRef(): string | null {
  if (!isSupabaseConfigured()) return null;
  return new URL(publicEnv.supabaseUrl).hostname.split(".")[0] || null;
}

export type SupabaseAuthStatus = "ok" | "key_rejected" | "unreachable" | "not_configured";

/**
 * Checks that the URL and key belong together: Supabase Auth answers 200 to
 * /auth/v1/settings only when the key matches the project.
 */
export async function checkSupabaseAuth(): Promise<SupabaseAuthStatus> {
  if (!isSupabaseConfigured()) return "not_configured";
  const { supabaseUrl, supabaseKey } = publicEnv;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseKey },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) return "ok";
    return res.status === 401 || res.status === 403 ? "key_rejected" : "unreachable";
  } catch {
    return "unreachable";
  }
}
