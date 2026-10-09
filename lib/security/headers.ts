/**
 * HTTP security headers for every response. Used by next.config.ts and shown
 * on the admin Security page, so the page always reflects the real config.
 * (No imports: next.config.ts loads this file directly.)
 */

const isDev = process.env.NODE_ENV === "development";

/** Supabase origin for connect-src (null if unset or malformed). */
function supabaseOrigin(): string | null {
  const raw = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/[`'"\s]/g, "");
  try {
    return raw ? new URL(raw).origin : null;
  } catch {
    return null;
  }
}

/**
 * Content Security Policy. Pages are partially prerendered, so a per-request
 * nonce isn't possible and inline scripts are allowed; everything else is
 * locked down: no plugins, no framing, no foreign form targets or <base>
 * hijacking, network requests only to this site and Supabase.
 */
function contentSecurityPolicy(): string {
  const supabase = supabaseOrigin();
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(supabase ? [supabase] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(" ")}`)
    .join("; ");
}

export const securityHeaders: { key: string; value: string; purpose: string }[] = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy(), purpose: "Limits where scripts, styles and requests can come from." },
  { key: "X-Frame-Options", value: "DENY", purpose: "Stops other sites from framing the app (clickjacking)." },
  { key: "X-Content-Type-Options", value: "nosniff", purpose: "Stops browsers from guessing file types." },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin", purpose: "Doesn't leak full URLs to other sites." },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()", purpose: "Turns off device features the app doesn't use." },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains", purpose: "Forces HTTPS for two years." },
];
