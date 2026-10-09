"use server";

import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { LOGIN_PATH, safeNextPath } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  const fieldErrors: LoginState["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Email is required.";
  else if (email.length > 254 || !EMAIL.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (!password) fieldErrors.password = "Password is required.";
  if (fieldErrors.email || fieldErrors.password) return { fieldErrors };

  if (!isSupabaseConfigured()) {
    return { error: "Sign-in is not configured on this server yet." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Log the reason code only, never the password.
    logger.warn("login_failed", { code: error.code ?? "unknown" });
    if (error.code === "over_request_rate_limit") return { error: "Too many attempts. Please wait and try again." };
    if (error.code === "email_not_confirmed") return { error: "Please confirm your email address first." };
    // Same message for wrong email or wrong password (doesn't reveal which accounts exist).
    if (error.code === "invalid_credentials") return { error: "Incorrect email or password." };
    // Anything else is a server/setup problem (e.g. a key from another project), not the user's password.
    return { error: `Sign-in failed on the server (${error.code ?? `status ${error.status ?? "unknown"}`}). Check the Supabase settings.` };
  }

  redirect(next);
}

export async function logout(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(LOGIN_PATH);
}
