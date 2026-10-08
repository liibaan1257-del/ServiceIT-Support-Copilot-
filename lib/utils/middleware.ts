import type { NextRequest } from "next/server";
import { generateRequestId } from "@/lib/utils/generateRequestId";

/**
 * Express-style middleware for Route Handlers: each middleware receives the
 * request context and a `next()` function, and either returns a response
 * itself (e.g. 401) or calls `next()` to continue down the chain.
 *
 *   export const POST = withMiddleware("/api/chat", [requestLogger, requireApiKey], handler);
 */

export type Context = {
  req: NextRequest;
  route: string;
  requestId: string;
  startedAt: number;
  /** Raw request body (set by readRawBody). */
  rawBody?: string;
  /** Parsed JSON body (set by parseJsonBody). */
  body?: unknown;
};

export type NextFn = () => Promise<Response>;
export type Middleware = (ctx: Context, next: NextFn) => Promise<Response>;
export type Handler = (ctx: Context) => Promise<Response>;

export function withMiddleware(route: string, middlewares: Middleware[], handler: Handler) {
  return async function routeHandler(req: NextRequest): Promise<Response> {
    const ctx: Context = { req, route, requestId: generateRequestId(), startedAt: performance.now() };
    const dispatch = (index: number): Promise<Response> =>
      index === middlewares.length ? handler(ctx) : middlewares[index](ctx, () => dispatch(index + 1));
    return dispatch(0);
  };
}
