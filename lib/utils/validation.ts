/**
 * Input validation (server-side, the source of truth). Each validator returns
 * the cleaned value or an error message per field.
 */

export type FieldErrors = Record<string, string>;
export type Validated<T> = { ok: true; data: T } | { ok: false; fields: FieldErrors };

export const LIMITS = {
  message: 4000,
  subject: 200,
  description: 5000,
} as const;

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Customer ids: 3-64 characters, letters, digits, "_" or "-", starting with a letter or digit. */
const CUSTOMER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;

function asObject(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function checkCustomerId(value: unknown, fields: FieldErrors): string {
  const id = text(value);
  if (!id) fields.customerId = "customerId is required.";
  else if (!CUSTOMER_ID.test(id)) {
    fields.customerId = "customerId must be 3-64 characters: letters, digits, '_' or '-'.";
  }
  return id ?? "";
}

export function validateChat(body: unknown): Validated<{ message: string; customerId: string }> {
  const input = asObject(body);
  if (!input) return { ok: false, fields: { body: "Expected a JSON object." } };
  const fields: FieldErrors = {};

  const message = text(input.message);
  if (!message) fields.message = "message is required and cannot be empty.";
  else if (message.length > LIMITS.message) fields.message = `message must be at most ${LIMITS.message} characters.`;
  const customerId = checkCustomerId(input.customerId, fields);

  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, data: { message: message!, customerId } };
}

export function validateTicket(
  body: unknown,
): Validated<{ subject: string; description: string; priority: Priority; customerId: string }> {
  const input = asObject(body);
  if (!input) return { ok: false, fields: { body: "Expected a JSON object." } };
  const fields: FieldErrors = {};

  const subject = text(input.subject);
  if (!subject) fields.subject = "subject is required.";
  else if (subject.length > LIMITS.subject) fields.subject = `subject must be at most ${LIMITS.subject} characters.`;

  const description = text(input.description);
  if (!description) fields.description = "description is required.";
  else if (description.length > LIMITS.description) {
    fields.description = `description must be at most ${LIMITS.description} characters.`;
  }

  const priority = text(input.priority)?.toLowerCase();
  if (!priority) fields.priority = "priority is required.";
  else if (!(PRIORITIES as readonly string[]).includes(priority)) {
    fields.priority = `priority must be one of: ${PRIORITIES.join(", ")}.`;
  }

  const customerId = checkCustomerId(input.customerId, fields);

  return Object.keys(fields).length
    ? { ok: false, fields }
    : { ok: true, data: { subject: subject!, description: description!, priority: priority as Priority, customerId } };
}
