import "server-only";
import { logger } from "@/lib/logging/logger";
import { createClient } from "@/lib/supabase/server";

export const EFFORTS = ["low", "medium", "high"] as const;
export type Effort = (typeof EFFORTS)[number];

export type AppSettings = {
  aiEnabled: boolean;
  aiEffort: Effort;
  chatMessagesPerMinute: number;
  supportNotes: string;
  updatedAt: string | null;
};

export const SETTINGS_LIMITS = { minPerMinute: 1, maxPerMinute: 60, notes: 2000 } as const;

/** Used until the settings migration has run, or if the database can't be reached. */
export const DEFAULT_SETTINGS: AppSettings = {
  aiEnabled: true,
  aiEffort: "medium",
  chatMessagesPerMinute: 10,
  supportNotes: "",
  updatedAt: null,
};

/** Current settings from the database (falls back to the defaults). */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_app_settings").maybeSingle<{
      ai_enabled: boolean;
      ai_effort: Effort;
      chat_messages_per_minute: number;
      support_notes: string;
      updated_at: string;
    }>();
    if (error || !data) {
      logger.warn("settings_unavailable", { code: error?.code ?? "no_row" });
      return DEFAULT_SETTINGS;
    }
    return {
      aiEnabled: data.ai_enabled,
      aiEffort: data.ai_effort,
      chatMessagesPerMinute: data.chat_messages_per_minute,
      supportNotes: data.support_notes,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    logger.warn("settings_unavailable", { error: error instanceof Error ? error.message : String(error) });
    return DEFAULT_SETTINGS;
  }
}
