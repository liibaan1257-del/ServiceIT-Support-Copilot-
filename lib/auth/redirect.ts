export const LOGIN_PATH = "/login";
export const ADMIN_HOME = "/admin/metrics";

/**
 * Only same-site relative paths are allowed as a post-login destination
 * (blocks ?next=https://evil.example and //evil.example).
 */
export function safeNextPath(value: unknown, fallback: string = ADMIN_HOME): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
