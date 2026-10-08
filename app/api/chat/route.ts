import { logger } from "@/lib/logging/logger";
import { errorResponse, json } from "@/lib/utils/http";
import { withMiddleware } from "@/lib/utils/middleware";
import { parseJsonBody, readRawBody, requestLogger, requireApiKey } from "@/lib/utils/middlewares";
import { validateChat } from "@/lib/utils/validation";

/**
 * POST /api/chat
 * Auth: Authorization: Bearer <API_KEY>
 * Body: { message: string, customerId: string }
 *
 * Skeleton: the message is accepted and acknowledged; the AI answer is added
 * in a later step.
 */
export const POST = withMiddleware(
  "/api/chat",
  [requestLogger, requireApiKey, readRawBody, parseJsonBody],
  async (ctx) => {
    const parsed = validateChat(ctx.body);
    if (!parsed.ok) return errorResponse(ctx, 400, "validation_error", "Invalid request body.", parsed.fields);

    const id = `msg_${crypto.randomUUID().replace(/-/g, "")}`;
    // Log metadata only, never the message text (it may contain personal data).
    logger.info("chat_received", {
      requestId: ctx.requestId,
      messageId: id,
      customerId: parsed.data.customerId,
      messageLength: parsed.data.message.length,
    });

    return json(ctx, 200, { id, timestamp: new Date().toISOString(), status: "received" });
  },
);
