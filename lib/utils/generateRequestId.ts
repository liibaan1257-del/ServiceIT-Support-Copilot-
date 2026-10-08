import { randomUUID } from "node:crypto";

/** Unique id for one request, returned in every response and log line. */
export function generateRequestId(): string {
  return `req_${randomUUID().replace(/-/g, "")}`;
}
