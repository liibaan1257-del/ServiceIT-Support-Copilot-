import { connection } from "next/server";
import { json } from "@/lib/utils/http";
import { withMiddleware } from "@/lib/utils/middleware";
import { requestLogger } from "@/lib/utils/middlewares";
import { metrics } from "@/lib/utils/metrics";

/**
 * GET /api/metrics (no auth). Request counters for this server instance:
 * totalRequests, totalCost (USD, AI calls later), averageLatency (ms),
 * activeRequests. Contains no customer data.
 */
export const GET = withMiddleware("/api/metrics", [requestLogger], async (ctx) => {
  await connection();
  return json(ctx, 200, metrics.snapshot());
});
