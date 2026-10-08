import { logger } from "@/lib/logging/logger";
import { errorResponse, json } from "@/lib/utils/http";
import { withMiddleware } from "@/lib/utils/middleware";
import { parseJsonBody, readRawBody, requestLogger, requireWebhookSignature } from "@/lib/utils/middlewares";
import { validateTicket } from "@/lib/utils/validation";

/**
 * POST /api/tickets
 * Auth: x-webhook-secret = hex HMAC-SHA256(raw body, WEBHOOK_SECRET)
 * Body: { subject, description, priority: low|medium|high|critical, customerId }
 *
 * Skeleton: the ticket is validated and acknowledged; saving it to the
 * database is added in a later step.
 */
export const POST = withMiddleware(
  "/api/tickets",
  [requestLogger, readRawBody, requireWebhookSignature, parseJsonBody],
  async (ctx) => {
    const parsed = validateTicket(ctx.body);
    if (!parsed.ok) return errorResponse(ctx, 400, "validation_error", "Invalid request body.", parsed.fields);

    const ticketId = `TKT-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const created = new Date().toISOString();
    logger.info("ticket_received", {
      requestId: ctx.requestId,
      ticketId,
      customerId: parsed.data.customerId,
      priority: parsed.data.priority,
    });

    return json(ctx, 201, { ticketId, created });
  },
);
