import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Conversation = { id: string; title: string; updatedAt: string };
export type StoredMessage = { id: number; role: "user" | "assistant"; content: string; createdAt: string; costUsd: number | null };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Messages sent to the model per request: the most recent ones only. */
export const HISTORY_LIMIT = 40;

/** The signed-in admin's conversations, newest first (RLS limits them to their own). */
export async function listConversations(limit = 30): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`list conversations failed: ${error.code ?? error.message}`);
  return (data ?? []).map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }));
}

/** A conversation's messages in order, or null if it doesn't exist or isn't yours. */
export async function getConversation(
  id: string,
): Promise<{ conversation: Conversation; messages: StoredMessage[] } | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data: c } = await supabase.from("chat_conversations").select("id, title, updated_at").eq("id", id).maybeSingle();
  if (!c) return null;
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at, cost_usd")
    .eq("conversation_id", id)
    .order("id", { ascending: true })
    .limit(500);
  if (error) throw new Error(`load messages failed: ${error.code ?? error.message}`);
  return {
    conversation: { id: c.id, title: c.title, updatedAt: c.updated_at },
    messages: (data ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      costUsd: m.cost_usd === null ? null : Number(m.cost_usd),
    })),
  };
}

/** A title from the first message: first line, at most 60 characters. */
export function titleFrom(message: string): string {
  const line = message.split("\n").find((l) => l.trim())?.trim() ?? "New chat";
  return line.length > 60 ? `${line.slice(0, 57).trimEnd()}…` : line;
}
