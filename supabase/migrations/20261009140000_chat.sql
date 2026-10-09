-- =============================================================================
-- ServiceIT Support Copilot: AI chat history (Part 4).
--
-- Run in Supabase -> SQL Editor AFTER the earlier migrations (safe to run
-- more than once).
--
-- Each admin sees only their own conversations. Messages are written by the
-- server acting as the signed-in admin (Row Level Security applies), and
-- every policy also requires the admin role.
-- =============================================================================

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_conversations_user_updated_idx
  on public.chat_conversations (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 100000),
  model text check (char_length(model) <= 64),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cost_usd numeric(12, 6) check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_idx on public.chat_messages (conversation_id, id);
create index if not exists chat_messages_user_created_idx on public.chat_messages (user_id, created_at desc);

comment on table public.chat_conversations is 'Admin AI chat conversations. Owner-only, admins only.';
comment on table public.chat_messages is 'Messages in admin AI chats, with token usage and cost for assistant replies.';

-- A new message moves its conversation to the top of the list.
create or replace function public.touch_chat_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

revoke execute on function public.touch_chat_conversation() from public, anon, authenticated;

drop trigger if exists chat_messages_touch_conversation on public.chat_messages;
create trigger chat_messages_touch_conversation
  after insert on public.chat_messages
  for each row execute function public.touch_chat_conversation();


-- Row Level Security --------------------------------------------------------
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "Admins manage their own conversations" on public.chat_conversations;
create policy "Admins manage their own conversations"
  on public.chat_conversations for all to authenticated
  using ((select auth.uid()) = user_id and public.is_admin())
  with check ((select auth.uid()) = user_id and public.is_admin());

drop policy if exists "Admins read their own messages" on public.chat_messages;
create policy "Admins read their own messages"
  on public.chat_messages for select to authenticated
  using ((select auth.uid()) = user_id and public.is_admin());

-- Messages can only be added to a conversation the same admin owns.
drop policy if exists "Admins add messages to their own conversations" on public.chat_messages;
create policy "Admins add messages to their own conversations"
  on public.chat_messages for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_admin()
    and exists (
      select 1 from public.chat_conversations c
      where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

-- Least privilege: no updates to messages (history is append-only).
revoke all on public.chat_conversations from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
grant select, insert, delete on public.chat_conversations to authenticated;
grant select, insert on public.chat_messages to authenticated;
