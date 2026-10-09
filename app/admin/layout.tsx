import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { logout } from "@/lib/auth/actions";
import { requireAdmin } from "@/lib/auth/session";
import { getSupabaseConfigStatus } from "@/lib/env";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · ServiceIT Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  // The session is request data, so the gate renders inside Suspense.
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" aria-busy="true" aria-label="Loading" />}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}

/** Server-side check on every admin page: signed in AND role = admin. */
async function AdminGate({ children }: { children: ReactNode }) {
  const status = getSupabaseConfigStatus();
  if (status !== "ok") {
    const reason = {
      missing_url: "NEXT_PUBLIC_SUPABASE_URL is missing.",
      missing_key: "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.",
      invalid_url: "NEXT_PUBLIC_SUPABASE_URL is not a valid URL (expected https://<project>.supabase.co).",
    }[status];
    return (
      <Notice
        title="Sign-in is not configured"
        text={`${reason} Add it in Vercel → Settings → Environment Variables, then redeploy.`}
      />
    );
  }
  const user = await requireAdmin();
  if (!user) {
    return (
      <Notice title="No admin access" text="You're signed in, but this account doesn't have the admin role.">
        <form action={logout}>
          <button type="submit" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
            Sign out
          </button>
        </form>
      </Notice>
    );
  }
  return <AdminShell user={{ email: user.email, role: user.role }}>{children}</AdminShell>;
}

function Notice({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-center text-zinc-200">
      <div className="max-w-sm space-y-3">
        <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
        <p className="text-sm text-zinc-400">{text}</p>
        {children ? <div className="flex justify-center pt-2">{children}</div> : null}
      </div>
    </main>
  );
}
