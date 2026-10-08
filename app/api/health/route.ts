import { connection } from "next/server";
import { json } from "@/lib/utils/http";
import { withMiddleware } from "@/lib/utils/middleware";
import { requestLogger } from "@/lib/utils/middlewares";

const VERSION = "0.1.0";

/**
 * GET /api/health (no auth). Liveness check for monitoring.
 * connection() makes it run per request instead of being prerendered at
 * build time (Cache Components), so the timestamp is always current.
 */
export const GET = withMiddleware("/api/health", [requestLogger], async (ctx) => {
  await connection();
  return json(ctx, 200, { status: "ok", timestamp: new Date().toISOString(), version: VERSION });
});
