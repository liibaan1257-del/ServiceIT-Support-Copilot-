"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "@/lib/auth/actions";

const input =
  "mt-1.5 block w-full rounded-lg border bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  // Controlled so the email survives a failed attempt (forms reset after submit).
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="text-sm font-medium text-zinc-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          className={`${input} ${state.fieldErrors?.email ? "border-red-500/60" : "border-zinc-700"}`}
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="mt-1 text-sm text-red-400">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-zinc-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.password ? true : undefined}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          className={`${input} ${state.fieldErrors?.password ? "border-red-500/60" : "border-zinc-700"}`}
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" className="mt-1 text-sm text-red-400">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>
      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
