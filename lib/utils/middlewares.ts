import { unstable_rethrow } from "next/navigation";
import { verifyApiKey } from "@/lib/auth/verifyApiKey";
import { verifyWebhook } from "@/lib/auth/verifyWebhook";
import { logger } from "@/lib/logging/logger";
import { errorResponse } from "@/lib/utils/http";
import { metrics } from "@/lib/utils/metrics";
import type { Middleware } from "@/lib/utils/middleware";

/** Largest JSON body accepted (bytes). */
export const MAX_BODY_BYTES = 64 * 1024;

/**
 * Outermost middleware: counts the request, logs one JSON line when it
 * finishes, and turns unexpected errors into a 500 without leaking details.
 */
export const requestLogger: Middleware = async (ctx, next) => {
  metrics.start();
  let response: Response | undefined;
  try {
    response = await next();
  } catch (error) {
    // Let Next.js's own control-flow signals (e.g. connection() during the
    // build's prerender pass, redirects) through instead of treating them as errors.
    unstable_rethrow(error);
    logger.error("unhandled_error", {
      requestId: ctx.requestId,
      route: ctx.route,
      error: error instanceof Error ? error.message : String(error),
    });
    response = errorResponse(ctx, 500, "internal_error", "Something went wrong. Please try again.");
  } finally {
    const latencyMs = Math.round(performance.now() - ctx.startedAt);
    metrics.end(latencyMs);
    if (response) {
      logger.info("request", {
        requestId: ctx.requestId,
        method: ctx.req.method,
        route: ctx.route,
        status: response.status,
        latencyMs,
      });
    }
  }
  return response;
};

/** `Authorization: Bearer <API_KEY>`; 401 when missing or wrong. */
export const requireApiKey: Middleware = async (ctx, next) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    logger.error("missing_config", { requestId: ctx.requestId, variable: "API_KEY" });
    return errorResponse(ctx, 500, "server_misconfigured", "The server is not configured.");
  }
  if (!verifyApiKey(ctx.req.headers.get("authorization"), apiKey)) {
    logger.warn("auth_failed", { requestId: ctx.requestId, route: ctx.route, reason: "api_key" });
    return errorResponse(ctx, 401, "unauthorized", "Missing or invalid API key.");
  }
  return next();
};

/** Reads the raw JSON body (needed for HMAC) with a size limit. */
export const readRawBody: Middleware = async (ctx, next) => {
  if (!ctx.req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return errorResponse(ctx, 400, "invalid_content_type", "Content-Type must be application/json.");
  }
  const declared = Number(ctx.req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return errorResponse(ctx, 413, "payload_too_large", `Body must be at most ${MAX_BODY_BYTES} bytes.`);
  }
  const raw = await ctx.req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return errorResponse(ctx, 413, "payload_too_large", `Body must be at most ${MAX_BODY_BYTES} bytes.`);
  }
  ctx.rawBody = raw;
  return next();
};

/** HMAC-SHA256 signature of the raw body in `x-webhook-secret`; 401 when missing or wrong. */
export const requireWebhookSignature: Middleware = async (ctx, next) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    logger.error("missing_config", { requestId: ctx.requestId, variable: "WEBHOOK_SECRET" });
    return errorResponse(ctx, 500, "server_misconfigured", "The server is not configured.");
  }
  if (!verifyWebhook(ctx.rawBody ?? "", ctx.req.headers.get("x-webhook-secret"), secret)) {
    logger.warn("auth_failed", { requestId: ctx.requestId, route: ctx.route, reason: "webhook_signature" });
    return errorResponse(ctx, 401, "unauthorized", "Missing or invalid webhook signature.");
  }
  return next();
};

/** Parses ctx.rawBody as JSON; 400 when it isn't valid JSON. */
export const parseJsonBody: Middleware = async (ctx, next) => {
  try {
    ctx.body = JSON.parse(ctx.rawBody ?? "");
  } catch {
    return errorResponse(ctx, 400, "invalid_json", "Request body must be valid JSON.");
  }
  return next();
};
