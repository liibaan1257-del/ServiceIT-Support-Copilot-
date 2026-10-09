import "server-only";
import type { Role } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const ROLES: readonly Role[] = ["customer", "technician", "admin"];
export const PAGE_SIZE = 25;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type AdminUserRow = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: Role;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
};

export type UserFilters = { q: string; role: Role | null; page: number };

/** Reads ?q=&role=&page= into safe values (anything invalid falls back to the default). */
export function parseUserFilters(params: Record<string, string | string[] | undefined>): UserFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(params.q).trim().slice(0, 100);
  const role = isRole(one(params.role)) ? (one(params.role) as Role) : null;
  const page = Math.min(Math.max(Number.parseInt(one(params.page), 10) || 1, 1), 10_000);
  return { q, role, page };
}

/**
 * One page of users. The database function checks the caller is an admin,
 * so this can't leak data even if a page forgets its own check.
 */
export async function listUsers({ q, role, page }: UserFilters): Promise<{ rows: AdminUserRow[]; total: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_search: q || null,
    p_role: role,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error(`admin_list_users failed: ${error.code ?? error.message}`);

  type Raw = {
    id: string;
    email: string | null;
    full_name: string | null;
    role: Role;
    created_at: string;
    last_sign_in_at: string | null;
    email_confirmed: boolean;
    total_count: number;
  };
  const raw = (data ?? []) as Raw[];
  return {
    total: raw.length ? Number(raw[0].total_count) : 0,
    rows: raw.map((r) => ({
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      role: r.role,
      createdAt: r.created_at,
      lastSignInAt: r.last_sign_in_at,
      emailConfirmed: r.email_confirmed,
    })),
  };
}

export type RoleCounts = { total: number; admins: number; technicians: number; customers: number };

export async function getRoleCounts(): Promise<RoleCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_role_counts").single<RoleCounts>();
  if (error || !data) throw new Error(`admin_role_counts failed: ${error?.code ?? "no data"}`);
  return {
    total: Number(data.total),
    admins: Number(data.admins),
    technicians: Number(data.technicians),
    customers: Number(data.customers),
  };
}
