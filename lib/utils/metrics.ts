/**
 * In-memory request metrics.
 *
 * Note: on serverless hosting (Vercel) each instance keeps its own counters
 * and they reset when an instance restarts. Good enough for a skeleton;
 * move to a database or a metrics service before relying on the numbers.
 */

const state = {
  totalRequests: 0,
  totalLatencyMs: 0,
  completedRequests: 0,
  activeRequests: 0,
  totalCost: 0,
};

export const metrics = {
  start() {
    state.totalRequests += 1;
    state.activeRequests += 1;
  },
  end(latencyMs: number) {
    state.activeRequests = Math.max(0, state.activeRequests - 1);
    state.completedRequests += 1;
    state.totalLatencyMs += latencyMs;
  },
  /** For the AI step later: add the cost (USD) of a model call. */
  addCost(usd: number) {
    if (Number.isFinite(usd) && usd > 0) state.totalCost += usd;
  },
  snapshot() {
    return {
      totalRequests: state.totalRequests,
      totalCost: Number(state.totalCost.toFixed(6)),
      averageLatency: state.completedRequests ? Math.round(state.totalLatencyMs / state.completedRequests) : 0,
      activeRequests: state.activeRequests,
    };
  },
};
