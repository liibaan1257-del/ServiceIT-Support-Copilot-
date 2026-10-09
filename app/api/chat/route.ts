import { describeAiError, isAiConfigured, reply } from "@/lib/ai/copilot";
import { logger } from "@/lib/logging/logger";
import { errorResponse, json } from "@/lib/utils/http";
import { metrics } from "@/lib/utils/metrics";
import { withMiddleware } from "@/lib/utils/middleware";
import { parseJsonBody, readRawBody, requestLogger, requireApiKey } from "@/lib/utils/middlewares";
import { validateChat } from "@/lib/utils/validation";

/**
 * POST /api/chat
 * Auth: Authorization: Bearer <API_KEY>
 * Body: { message: string, customerId: string }
 *
 * Answers one support question with the AI copilot (no stored history).
 */
export const POST = withMiddleware(
  "/api/chat",
  [requestLogger, requireApiKey, readRawBody, parseJsonBody],
  async (ctx) => {
    const parsed = validateChat(ctx.body);
    if (!parsed.ok) return errorResponse(ctx, 400, "validation_error", "Invalid request body.", parsed.fields);
    if (!isAiConfigured()) {
      logger.error("missing_config", { requestId: ctx.requestId, variable: "ANTHROPIC_API_KEY" });
      return errorResponse(ctx, 503, "ai_not_configured", "The AI service is not configured.");
    }

    const id = `msg_${crypto.randomUUID().replace(/-/g, "")}`;
    try {
      const result = await reply([{ role: "user", content: parsed.data.message }]);
      metrics.addCost(result.cost);
      // Log metadata only, never the message text (it may contain personal data).
      logger.info("chat_answered", {
        requestId: ctx.requestId,
        messageId: id,
        customerId: parsed.data.customerId,
        messageLength: parsed.data.message.length,
        model: result.model,
        refused: result.refused,
        outputTokens: result.usage.outputTokens,
        costUsd: result.cost,
      });
      return json(ctx, 200, {
        id,
        timestamp: new Date().toISOString(),
        status: result.refused ? "refused" : "answered",
        reply: result.text,
        model: result.model,
        usage: { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens },
        costUsd: result.cost,
      });
    } catch (error) {
      const info = describeAiError(error);
      logger.error("chat_failed", { requestId: ctx.requestId, messageId: id, code: info.code });
      return errorResponse(ctx, info.status, info.code, info.message);
    }
  },
);
