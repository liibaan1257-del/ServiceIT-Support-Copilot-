"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { UUID } from "@/lib/chat/history";
import { createClient } from "@/lib/supabase/server";

/** Deletes one of the signed-in admin's conversations (RLS: only their own). */
export async function deleteConversation(formData: FormData): Promise<void> {
  const id = String(formData.get("conversationId") ?? "");
  const me = await getSessionUser();
  if (!me || me.role !== "admin" || !UUID.test(id)) return;
  const supabase = await createClient();
  await supabase.from("chat_conversations").delete().eq("id", id);
  redirect("/admin/chat");
}
