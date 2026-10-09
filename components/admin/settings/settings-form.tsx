"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { saveSettings, type SettingsFormState } from "@/lib/settings/actions";
import type { AppSettings, Effort } from "@/lib/settings/settings";

const EFFORT_HELP: Record<Effort, string> = {
  low: "Fastest and cheapest. Good for short, simple questions.",
  medium: "Balanced (recommended).",
  high: "Most thorough answers for hard problems; slower and costs more.",
};

const NOTES_MAX = 2000;

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, action, pending] = useActionState<SettingsFormState, FormData>(saveSettings, {});
  const [effort, setEffort] = useState<Effort>(settings.aiEffort);
  const [notes, setNotes] = useState(settings.supportNotes);
  const fe = state.fieldErrors ?? {};

  // Submit without React's automatic form reset, which would put the
  // controlled <select> back on its first option after saving.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">AI copilot</h2>
        <div className="mt-4 space-y-5">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="aiEnabled"
              defaultChecked={settings.aiEnabled}
              className="mt-0.5 size-4 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
            />
            <span>
              <span className="block text-sm text-zinc-200">AI answers enabled</span>
              <span className="block text-xs text-zinc-500">
                Turn off to stop all AI calls (admin Chat and <code className="font-mono">POST /api/chat</code>) right away.
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="aiEffort" className="block text-sm text-zinc-200">
              Answer depth (effort)
            </label>
            <select
              id="aiEffort"
              name="aiEffort"
              value={effort}
              onChange={(e) => setEffort(e.target.value as Effort)}
              aria-describedby="aiEffort-help"
              className="mt-1.5 w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <p id="aiEffort-help" className="mt-1 text-xs text-zinc-500">
              {EFFORT_HELP[effort]}
            </p>
            {fe.aiEffort ? <p className="mt-1 text-xs text-red-400">{fe.aiEffort}</p> : null}
          </div>

          <div>
            <label htmlFor="supportNotes" className="block text-sm text-zinc-200">
              Help desk notes for the AI
            </label>
            <p className="mt-0.5 text-xs text-zinc-500">
              Facts the copilot should know, e.g. opening hours, the help desk phone number, which email system you use.
              Not secret: never put passwords, keys or personal data here.
            </p>
            <textarea
              id="supportNotes"
              name="supportNotes"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
              placeholder={"Help desk: +252 61 000 0000, Sat–Thu 8:00–17:00\nEmail: Microsoft 365"}
              aria-invalid={fe.supportNotes ? true : undefined}
              className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
            />
            <p className="text-right text-[10px] text-zinc-500">
              {notes.length}/{NOTES_MAX}
            </p>
            {fe.supportNotes ? <p className="text-xs text-red-400">{fe.supportNotes}</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="text-sm font-semibold text-zinc-100">Limits</h2>
        <div className="mt-4">
          <label htmlFor="chatMessagesPerMinute" className="block text-sm text-zinc-200">
            Chat messages per admin per minute
          </label>
          <input
            id="chatMessagesPerMinute"
            name="chatMessagesPerMinute"
            type="number"
            min={1}
            max={60}
            step={1}
            required
            defaultValue={settings.chatMessagesPerMinute}
            aria-invalid={fe.chatMessagesPerMinute ? true : undefined}
            className="mt-1.5 w-28 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-zinc-500">1–60. Protects your Anthropic bill from runaway use.</p>
          {fe.chatMessagesPerMinute ? <p className="mt-1 text-xs text-red-400">{fe.chatMessagesPerMinute}</p> : null}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save settings"}
        </button>
        <span aria-live="polite" className="text-sm">
          {state.error ? (
            <span role="alert" className="text-red-400">
              {state.error}
            </span>
          ) : state.ok && !pending ? (
            <span className="text-emerald-400">Saved. Changes are recorded in the audit log.</span>
          ) : null}
        </span>
      </div>
    </form>
  );
}
