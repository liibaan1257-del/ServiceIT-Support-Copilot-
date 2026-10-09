"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { updateUserRole, type RoleFormState } from "@/lib/admin/actions";
import type { Role } from "@/lib/auth/session";

const LABELS: Record<Role, string> = { customer: "Customer", technician: "Technician", admin: "Admin" };

/** Role picker for one user. Save is enabled only when the choice differs. */
export function RoleForm({ userId, role, email }: { userId: string; role: Role; email: string | null }) {
  const [state, action, pending] = useActionState<RoleFormState, FormData>(updateUserRole, {});
  const [value, setValue] = useState<Role>(role);
  // Follow the saved role after the page refreshes with new data.
  const [savedRole, setSavedRole] = useState<Role>(role);
  if (savedRole !== role) {
    setSavedRole(role);
    setValue(role);
  }
  const dirty = value !== role;

  // Submit without React's automatic form reset, which would put the
  // controlled <select> back on its initial option after saving.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role for {email ?? "this user"}
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        value={value}
        onChange={(e) => setValue(e.target.value as Role)}
        disabled={pending}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
      >
        {(Object.keys(LABELS) as Role[]).map((r) => (
          <option key={r} value={r}>
            {LABELS[r]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!dirty || pending}
        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <span aria-live="polite" className="text-xs">
        {state.error ? <span className="text-red-400">{state.error}</span> : state.ok && !dirty ? <span className="text-emerald-400">Saved</span> : null}
      </span>
    </form>
  );
}
