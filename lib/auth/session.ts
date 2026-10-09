import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { LOGIN_PATH } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export type Role = "customer" | "technician" | "admin";
export type SessionUser = { id: string; email: string | null; role: Role };

/**
 * The signed-in user and their role, verified on the server (JWT via
 * getClaims, role from the database under RLS). Never trusts the client.
 * Deduplicated per request.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("email, role").eq("id", userId).maybeSingle();
  const email = typeof data.claims.email === "string" ? data.claims.email : (profile?.email ?? null);
  return { id: userId, email, role: (profile?.role as Role | undefined) ?? "customer" };
});

/** For admin pages: signed-out → login; signed in without the admin role → null (caller shows "no access"). */
export async function requireAdmin(nextPath = "/admin"): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) redirect(`${LOGIN_PATH}?next=${encodeURIComponent(nextPath)}`);
  return user.role === "admin" ? user : null;
}
