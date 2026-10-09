"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export type PanelMessage = { id: string; role: "user" | "assistant"; content: string; costUsd?: number | null };

const MAX_CHARS = 4000;

const SUGGESTIONS = [
  "A customer's laptop won't connect to the office Wi-Fi. What should I check first?",
  "Outlook keeps asking for the password. How do I fix it?",
  "The printer shows 'offline' on Windows 11 but it's switched on.",
  "How do I help a user set up multi-factor sign-in on their phone?",
];

type StreamEvent =
  | { type: "start"; conversationId: string }
  | { type: "text"; text: string }
  | { type: "done"; text: string; refused: boolean; costUsd: number }
  | { type: "error"; code: string; message: string };

/** The conversation view: message list, streaming reply and composer. */
export function ChatPanel({
  conversationId,
  initialMessages,
  aiConfigured,
}: {
  conversationId: string | null;
  initialMessages: PanelMessage[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<PanelMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setError(null);
    setInput("");
    setBusy(true);
    const replyId = `a-${Date.now()}`;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: message }, { id: replyId, role: "assistant", content: "" }]);
    const setReply = (update: (prev: PanelMessage) => PanelMessage) =>
      setMessages((m) => m.map((msg) => (msg.id === replyId ? update(msg) : msg)));

    const controller = new AbortController();
    abortRef.current = controller;
    let newConversationId: string | null = null;
    let failed = false;
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Request failed (${res.status}).`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;
          if (event.type === "start" && !conversationId) newConversationId = event.conversationId;
          else if (event.type === "text") setReply((r) => ({ ...r, content: r.content + event.text }));
          else if (event.type === "done") setReply((r) => ({ ...r, content: event.text, costUsd: event.costUsd }));
          else if (event.type === "error") {
            failed = true;
            setError(event.message);
          }
        }
      }
    } catch (e) {
      failed = true;
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
    if (failed) setMessages((m) => m.filter((msg) => msg.id !== replyId || msg.content));
    // Show the new conversation in the URL and refresh the sidebar list.
    if (newConversationId) router.replace(`/admin/chat?c=${newConversationId}`);
    else router.refresh();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-20rem)] min-h-[360px] flex-col lg:h-[calc(100dvh-13rem)] lg:min-h-[420px] rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl py-8 text-center">
            <p className="text-sm font-medium text-zinc-300">Ask the support copilot anything about an IT problem.</p>
            <p className="mt-1 text-xs text-zinc-500">Answers come from Claude. Don&apos;t paste passwords or other secrets.</p>
            {aiConfigured ? (
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-left text-xs text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-emerald-500/15 text-emerald-50 ring-1 ring-emerald-500/20"
                    : "bg-zinc-800/70 text-zinc-100 ring-1 ring-zinc-700/50"
                }`}
              >
                <span className="sr-only">{m.role === "user" ? "You: " : "Copilot: "}</span>
                {m.content || <span className="animate-pulse text-zinc-400">Thinking…</span>}
                {m.role === "assistant" && typeof m.costUsd === "number" ? (
                  <span className="mt-1.5 block text-[10px] text-zinc-500">${m.costUsd.toFixed(4)}</span>
                ) : null}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {error ? (
        <p role="alert" className="mx-4 mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="border-t border-zinc-800 p-3">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={onKeyDown}
            rows={2}
            disabled={!aiConfigured}
            placeholder={aiConfigured ? "Describe the problem… (Enter to send, Shift+Enter for a new line)" : "AI chat isn't set up yet."}
            className="max-h-40 min-h-[44px] flex-1 resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!aiConfigured || !input.trim()}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          )}
        </div>
        <p className="mt-1 text-right text-[10px] text-zinc-500">
          {input.length}/{MAX_CHARS}
        </p>
      </form>
    </div>
  );
}
