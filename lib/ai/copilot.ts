import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * The ServiceIT support copilot: one place for the model, prompt and cost
 * math, shared by the admin chat and POST /api/chat.
 *
 * ANTHROPIC_API_KEY is a server-only secret (Vercel env var, never
 * NEXT_PUBLIC_). This module is server-only so it can't end up in the browser.
 */

export const MODEL = "claude-opus-5-5";

/** USD per million tokens for MODEL (input, output, cache write, cache read). */
const PRICE_PER_MTOK = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 } as const;

/** Server-side refusal fallback: a declined request is retried on Anthropic's recommended model. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const SYSTEM_PROMPT = `You are ServiceIT Support Copilot, an IT support assistant for the ServiceIT help desk.

You help support staff and customers with everyday IT problems: computers and laptops, Windows and macOS, printers, Wi-Fi and networking, email and Microsoft 365 / Google Workspace accounts, passwords and multi-factor sign-in, phones, common business software, and basic security hygiene.

How to answer:
- Start with the most likely fix. Give numbered steps that a non-technical person can follow, and say what they should see after each important step.
- Ask one short clarifying question when the problem is too vague to act on (for example the device, operating system or exact error message).
- Keep answers short and practical. Use plain language; explain any technical term you have to use.
- Reply in the language the user writes in.
- If a fix needs admin rights, physical repair, or carries a risk of data loss, say so clearly and suggest backing up or escalating to a technician by opening a support ticket.

Safety and privacy:
- Never ask for or repeat passwords, one-time codes, recovery keys or full payment details. If someone shares one, tell them to change it.
- Don't help bypass security controls on systems the user doesn't own or administer.
- If you are not sure, say so instead of guessing.`;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!isAiConfigured()) throw new Error("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim(), maxRetries: 2 });
  return client;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export function costUsd(u: Usage): number {
  const usd =
    (u.inputTokens * PRICE_PER_MTOK.input +
      u.outputTokens * PRICE_PER_MTOK.output +
      u.cacheWriteTokens * PRICE_PER_MTOK.cacheWrite +
      u.cacheReadTokens * PRICE_PER_MTOK.cacheRead) /
    1_000_000;
  return Number(usd.toFixed(6));
}

function usageOf(message: Anthropic.Beta.BetaMessage): Usage {
  return {
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

function textOf(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Per-request options, from the admin Settings page. */
export type ReplyOptions = { effort?: "low" | "medium" | "high"; supportNotes?: string };

function request(turns: ChatTurn[], { effort = "medium", supportNotes = "" }: ReplyOptions = {}) {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    // The base prompt never changes, so it is cached across requests.
    { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
  ];
  if (supportNotes.trim()) {
    system.push({
      type: "text",
      text: `Help desk information from the ServiceIT admins (use it when relevant):\n${supportNotes.trim()}`,
    });
  }
  return {
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default" as const,
    output_config: { effort },
    system,
    messages: turns.map((t) => ({ role: t.role, content: t.content })),
  };
}

export type Reply = { text: string; usage: Usage; cost: number; model: string; refused: boolean };

const REFUSAL_TEXT = "Sorry, I can't help with that request.";

/** One complete answer (used by POST /api/chat). */
export async function reply(turns: ChatTurn[], options?: ReplyOptions): Promise<Reply> {
  const message = await getClient().beta.messages.create(request(turns, options));
  const usage = usageOf(message);
  const refused = message.stop_reason === "refusal";
  return {
    text: refused ? REFUSAL_TEXT : textOf(message) || REFUSAL_TEXT,
    usage,
    cost: costUsd(usage),
    model: message.model,
    refused,
  };
}

/**
 * Streams an answer: calls onText for each piece of text as it arrives and
 * resolves with the final reply. A refusal discards any partial text.
 */
export async function streamReply(
  turns: ChatTurn[],
  onText: (delta: string) => void,
  options?: ReplyOptions & { signal?: AbortSignal },
): Promise<Reply> {
  const stream = getClient().beta.messages.stream(request(turns, options), { signal: options?.signal });
  stream.on("text", onText);
  const message = await stream.finalMessage();
  const usage = usageOf(message);
  const refused = message.stop_reason === "refusal";
  return {
    text: refused ? REFUSAL_TEXT : textOf(message) || REFUSAL_TEXT,
    usage,
    cost: costUsd(usage),
    model: message.model,
    refused,
  };
}

/** Short, user-safe description of an API error (no secrets, no raw bodies). */
export function describeAiError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return { status: 503, code: "ai_auth_failed", message: "The AI service rejected the server's API key." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, code: "ai_rate_limited", message: "The AI service is busy. Please try again shortly." };
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { status: 502, code: "ai_bad_request", message: "The AI service couldn't process this conversation." };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: 502, code: "ai_unavailable", message: "The AI service is unavailable. Please try again." };
  }
  return { status: 502, code: "ai_error", message: "Couldn't get an answer. Please try again." };
}
