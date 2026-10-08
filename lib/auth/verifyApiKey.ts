import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Checks `Authorization: Bearer <API_KEY>` against the API_KEY env var.
 * Both values are hashed first so the constant-time comparison works even
 * when the lengths differ, without leaking the key's length.
 */
export function verifyApiKey(authorizationHeader: string | null, apiKey: string | undefined): boolean {
  if (!apiKey || !authorizationHeader) return false;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  if (!match) return false;

  const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
  return timingSafeEqual(digest(match[1]), digest(apiKey));
}
