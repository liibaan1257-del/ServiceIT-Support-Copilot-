"use server";

import { refresh } from "next/cache";
import { isRole } from "@/lib/admin/users";
import { getSessionUser } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { createClient } from "@/lib/supabase/server";

export type RoleFormState = { ok?: boolean; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Changes a user's role. The admin check, the "not your own role" rule and the
 * audit entry are enforced again inside the database function, so a forged
 * request can't get around them.
 */
export async function updateUserRole(_prev: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const userId = String(formData.get("userId") ?? "");
  const role = formData.get("role");
  if (!UUID.test(userId) || !isRole(role)) return { error: "Invalid request." };

  const me = await getSessionUser();
  if (!me || me.role !== "admin") return { error: "Only admins can change roles." };
  if (me.id === userId) return { error: "You can't change your own role." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_user_role", { p_user_id: userId, p_role: role });
  if (error) {
    logger.warn("role_change_failed", { code: error.code ?? "unknown", reason: error.message });
    if (error.message === "cannot_change_own_role") return { error: "You can't change your own role." };
    if (error.message === "user_not_found") return { error: "This user no longer exists." };
    if (error.message === "admin_only") return { error: "Only admins can change roles." };
    return { error: "Couldn't change the role. Please try again." };
  }

  logger.info("role_changed", { actorId: me.id, targetId: userId, role });
  refresh();
  return { ok: true };
}
