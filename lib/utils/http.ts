import type { Context } from "@/lib/utils/middleware";

/** JSON response that always carries the requestId (body + x-request-id header). */
export function json(ctx: Context, status: number, body: Record<string, unknown>): Response {
  return Response.json(
    { ...body, requestId: ctx.requestId },
    { status, headers: { "Cache-Control": "no-store", "x-request-id": ctx.requestId } },
  );
}

/** Error response: { error: { code, message, fields? }, requestId }. */
export function errorResponse(
  ctx: Context,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): Response {
  return json(ctx, status, { error: { code, message, ...(fields ? { fields } : {}) } });
}
