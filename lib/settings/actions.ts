"use server";

import { refresh } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { EFFORTS, SETTINGS_LIMITS, type Effort } from "@/lib/settings/settings";
import { createClient } from "@/lib/supabase/server";

export type SettingsFormState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Saves the settings. The database function re-checks the admin role and writes the audit entry. */
export async function saveSettings(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const me = await getSessionUser();
  if (!me || me.role !== "admin") return { error: "Only admins can change settings." };

  const aiEnabled = formData.get("aiEnabled") === "on";
  const effort = String(formData.get("aiEffort") ?? "");
  const perMinute = Number(formData.get("chatMessagesPerMinute"));
  const notes = String(formData.get("supportNotes") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!(EFFORTS as readonly string[]).includes(effort)) fieldErrors.aiEffort = "Choose low, medium or high.";
  if (!Number.isInteger(perMinute) || perMinute < SETTINGS_LIMITS.minPerMinute || perMinute > SETTINGS_LIMITS.maxPerMinute) {
    fieldErrors.chatMessagesPerMinute = `Enter a whole number from ${SETTINGS_LIMITS.minPerMinute} to ${SETTINGS_LIMITS.maxPerMinute}.`;
  }
  if (notes.length > SETTINGS_LIMITS.notes) fieldErrors.supportNotes = `At most ${SETTINGS_LIMITS.notes} characters.`;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_settings", {
    p_ai_enabled: aiEnabled,
    p_ai_effort: effort as Effort,
    p_chat_messages_per_minute: perMinute,
    p_support_notes: notes,
  });
  if (error) {
    logger.warn("settings_update_failed", { code: error.code ?? "unknown", reason: error.message });
    if (error.message === "admin_only") return { error: "Only admins can change settings." };
    if (error.code === "PGRST202") return { error: "Run the Part 5 database migration first." };
    return { error: "Couldn't save the settings. Please try again." };
  }
  logger.info("settings_updated", { actorId: me.id });
  refresh();
  return { ok: true };
}
