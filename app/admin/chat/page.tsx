import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChatPanel } from "@/components/admin/chat/chat-panel";
import { PageTitle } from "@/components/admin/page-title";
import { isAiConfigured } from "@/lib/ai/copilot";
import { requireAdmin } from "@/lib/auth/session";
import { deleteConversation } from "@/lib/chat/actions";
import { getConversation, listConversations, type Conversation } from "@/lib/chat/history";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage({ searchParams }: PageProps<"/admin/chat">) {
  return (
    <>
      <PageTitle title="Chat" description="Talk to the AI support copilot. Conversations are saved to your account." />
      <Suspense fallback={<div className="h-[420px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60" aria-busy="true" aria-label="Loading chat" />}>
        <ChatView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ChatView({ searchParams }: { searchParams: PageProps<"/admin/chat">["searchParams"] }) {
  const me = await requireAdmin("/admin/chat");
  if (!me) return null;

  const params = await searchParams;
  const selectedId = typeof params.c === "string" ? params.c : null;
  const [conversations, selected] = await Promise.all([
    listConversations(),
    selectedId ? getConversation(selectedId) : Promise.resolve(null),
  ]);
  const aiConfigured = isAiConfigured();

  return (
    <div className="space-y-4">
      {!aiConfigured ? (
        <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <p className="font-medium">AI chat isn&apos;t set up yet</p>
          <p className="mt-1 text-amber-200/80">
            Add <code className="font-mono">ANTHROPIC_API_KEY</code> in Vercel → Settings → Environment Variables (type:
            Secret), then redeploy.
          </p>
        </div>
      ) : null}
      {selectedId && !selected ? (
        <p role="alert" className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-300">
          That conversation doesn&apos;t exist (it may have been deleted).{" "}
          <Link href="/admin/chat" className="text-emerald-400 hover:underline">
            Start a new chat
          </Link>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
        <ConversationList conversations={conversations} selectedId={selected?.conversation.id ?? null} />
        <div className="min-w-0 space-y-2">
          {selected ? (
            <div className="flex items-center justify-between gap-3">
              <h2 className="truncate text-sm font-medium text-zinc-300">{selected.conversation.title}</h2>
              <form action={deleteConversation}>
                <input type="hidden" name="conversationId" value={selected.conversation.id} />
                <button type="submit" className="shrink-0 rounded-lg px-2 py-1 text-xs whitespace-nowrap text-zinc-500 hover:bg-red-500/10 hover:text-red-300">
                  Delete conversation
                </button>
              </form>
            </div>
          ) : null}
          <ChatPanel
            key={selected?.conversation.id ?? "new"}
            conversationId={selected?.conversation.id ?? null}
            aiConfigured={aiConfigured}
            initialMessages={(selected?.messages ?? []).map((m) => ({
              id: String(m.id),
              role: m.role,
              content: m.content,
              costUsd: m.costUsd,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function ConversationList({ conversations, selectedId }: { conversations: Conversation[]; selectedId: string | null }) {
  return (
    <nav aria-label="Conversations" className="min-w-0 space-y-2">
      <Link
        href="/admin/chat"
        className="block rounded-lg bg-emerald-500 px-3 py-2 text-center text-sm font-medium text-zinc-950 hover:bg-emerald-400"
      >
        + New chat
      </Link>
      {conversations.length ? (
        <ul className="flex gap-2 overflow-x-auto pb-1 lg:block lg:max-h-[calc(100dvh-17rem)] lg:space-y-1 lg:overflow-y-auto">
          {conversations.map((c) => (
            <li key={c.id} className="shrink-0 lg:shrink">
              <Link
                href={`/admin/chat?c=${c.id}`}
                aria-current={c.id === selectedId ? "page" : undefined}
                title={c.title}
                className={`block max-w-[14rem] truncate rounded-lg px-3 py-2 text-sm lg:max-w-none ${
                  c.id === selectedId ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 text-xs text-zinc-500">No conversations yet.</p>
      )}
    </nav>
  );
}
