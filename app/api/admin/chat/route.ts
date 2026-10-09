import { describeAiError, isAiConfigured, MODEL, streamReply, type ChatTurn } from "@/lib/ai/copilot";
import { getSessionUser } from "@/lib/auth/session";
import { HISTORY_LIMIT, titleFrom, UUID } from "@/lib/chat/history";
import { logger } from "@/lib/logging/logger";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/utils/http";
import { metrics } from "@/lib/utils/metrics";
import { withMiddleware, type Middleware } from "@/lib/utils/middleware";
import { parseJsonBody, readRawBody, requestLogger } from "@/lib/utils/middlewares";
import { LIMITS } from "@/lib/utils/validation";

/** Messages one admin may send per minute. */
const PER_MINUTE = 10;

/**
 * Cookie-authenticated, so refuse cross-site requests: the browser always
 * sends Origin on POST, and it must be this site.
 */
const sameOrigin: Middleware = async (ctx, next) => {
  const origin = ctx.req.headers.get("origin");
  if (origin && origin !== ctx.req.nextUrl.origin) {
    return errorResponse(ctx, 403, "forbidden", "Cross-site requests are not allowed.");
  }
  return next();
};

/**
 * POST /api/admin/chat (admins only, Supabase session cookie)
 * Body: { message: string, conversationId?: string }
 * Response: newline-delimited JSON events, streamed:
 *   {"type":"start","conversationId":"…"}
 *   {"type":"text","text":"…"}            (repeated)
 *   {"type":"done","text":"…","refused":false,"costUsd":0.0123}
 *   {"type":"error","code":"…","message":"…"}
 */
export const POST = withMiddleware(
  "/api/admin/chat",
  [requestLogger, sameOrigin, readRawBody, parseJsonBody],
  async (ctx) => {
    const user = await getSessionUser();
    if (!user) return errorResponse(ctx, 401, "unauthorized", "Please sign in.");
    if (user.role !== "admin") return errorResponse(ctx, 403, "forbidden", "Admins only.");

    const body = (typeof ctx.body === "object" && ctx.body !== null ? ctx.body : {}) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
    if (!message) return errorResponse(ctx, 400, "validation_error", "Message is required.", { message: "Required." });
    if (message.length > LIMITS.message) {
      return errorResponse(ctx, 400, "validation_error", `Message must be at most ${LIMITS.message} characters.`, {
        message: "Too long.",
      });
    }
    if (conversationId !== null && !UUID.test(conversationId)) {
      return errorResponse(ctx, 400, "validation_error", "Invalid conversation.", { conversationId: "Invalid." });
    }
    if (!isAiConfigured()) {
      return errorResponse(ctx, 503, "ai_not_configured", "AI chat isn't set up yet: add ANTHROPIC_API_KEY in Vercel and redeploy.");
    }

    const supabase = await createClient();

    // Per-admin rate limit, counted from the stored messages.
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", since);
    if ((count ?? 0) >= PER_MINUTE) {
      return errorResponse(ctx, 429, "rate_limited", `Limit reached (${PER_MINUTE} messages per minute). Please wait a moment.`);
    }

    // Find or create the conversation (RLS: only the admin's own).
    let convId = conversationId;
    let history: ChatTurn[] = [];
    if (convId) {
      const { data: conv } = await supabase.from("chat_conversations").select("id").eq("id", convId).maybeSingle();
      if (!conv) return errorResponse(ctx, 404, "not_found", "Conversation not found.");
      const { data: rows, error } = await supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", convId)
        .order("id", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw new Error(`load history failed: ${error.code}`);
      history = (rows ?? []).reverse().map((r) => ({ role: r.role, content: r.content }));
      // The model expects the conversation to start with the user.
      while (history.length && history[0].role !== "user") history.shift();
    } else {
      const { data: conv, error } = await supabase
        .from("chat_conversations")
        .insert({ user_id: user.id, title: titleFrom(message) })
        .select("id")
        .single();
      if (error || !conv) throw new Error(`create conversation failed: ${error?.code}`);
      convId = conv.id as string;
    }

    const { error: insertError } = await supabase
      .from("chat_messages")
      .insert({ conversation_id: convId, user_id: user.id, role: "user", content: message });
    if (insertError) throw new Error(`save message failed: ${insertError.code}`);

    const turns: ChatTurn[] = [...history, { role: "user", content: message }];
    const encoder = new TextEncoder();
    const requestId = ctx.requestId;
    const signal = ctx.req.signal;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        send({ type: "start", conversationId: convId });
        try {
          const result = await streamReply(turns, (text) => send({ type: "text", text }), signal);
          metrics.addCost(result.cost);
          const { error } = await supabase.from("chat_messages").insert({
            conversation_id: convId,
            user_id: user.id,
            role: "assistant",
            content: result.text,
            model: result.model || MODEL,
            input_tokens: result.usage.inputTokens + result.usage.cacheReadTokens + result.usage.cacheWriteTokens,
            output_tokens: result.usage.outputTokens,
            cost_usd: result.cost,
          });
          if (error) logger.error("save_reply_failed", { requestId, code: error.code });
          // Metadata only: never log message text.
          logger.info("chat_reply", {
            requestId,
            conversationId: convId,
            model: result.model,
            refused: result.refused,
            outputTokens: result.usage.outputTokens,
            costUsd: result.cost,
          });
          send({ type: "done", text: result.text, refused: result.refused, costUsd: result.cost });
        } catch (error) {
          if (signal.aborted) {
            logger.info("chat_aborted", { requestId, conversationId: convId });
          } else {
            const info = describeAiError(error);
            logger.error("chat_failed", { requestId, code: info.code, error: error instanceof Error ? error.message : String(error) });
            send({ type: "error", code: info.code, message: info.message });
          }
        } finally {
          try {
            controller.close();
          } catch {
            // Client already gone.
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "x-request-id": ctx.requestId,
      },
    });
  },
);
