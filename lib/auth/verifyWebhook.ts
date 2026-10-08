import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies an HMAC-SHA256 webhook signature.
 *
 * The sender computes HMAC-SHA256(rawBody, WEBHOOK_SECRET) and sends it as
 * hex in the `x-webhook-secret` header (an optional "sha256=" prefix is
 * accepted). The secret itself is never sent over the wire.
 *
 * Uses a constant-time comparison so the signature can't be guessed byte by
 * byte from response timing.
 */
export function signPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

export function verifyWebhook(rawBody: string, signatureHeader: string | null, secret: string | undefined): boolean {
  if (!secret || !signatureHeader) return false;
  const received = signatureHeader.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(received)) return false;

  const expected = Buffer.from(signPayload(rawBody, secret), "hex");
  const actual = Buffer.from(received, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
