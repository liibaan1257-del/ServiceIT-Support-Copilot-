import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/auth/redirect";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-200">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
              <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
            </svg>
          </span>
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">ServiceIT Admin</h1>
            <p className="text-sm text-zinc-500">Sign in to continue</p>
          </div>
        </div>
        {/* searchParams are request data, so the form streams in. */}
        <Suspense fallback={<LoginForm next="/admin/metrics" />}>
          <FormWithNext searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function FormWithNext({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(next)} />;
}
