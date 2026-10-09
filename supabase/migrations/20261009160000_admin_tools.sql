-- =============================================================================
-- ServiceIT Support Copilot: Rate Limits, Audit Log, Security, Settings (Part 5).
--
-- Run in Supabase -> SQL Editor AFTER the earlier migrations (safe to run
-- more than once).
--
-- Adds:
--   * app_settings: one row of app configuration, changed only through
--     admin_update_settings (admin check + audit entry).
--   * get_app_settings: read by the server for every AI request. The values
--     are not secret (the public anon key can read them), so never store
--     passwords or keys in them.
--   * admin_chat_usage / admin_security_overview: data for the Rate Limits
--     and Security pages (admins only).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Settings (single row)
-- -----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  ai_enabled boolean not null default true,
  ai_effort text not null default 'medium' check (ai_effort in ('low', 'medium', 'high')),
  chat_messages_per_minute integer not null default 10 check (chat_messages_per_minute between 1 and 60),
  support_notes text not null default '' check (char_length(support_notes) <= 2000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

comment on table public.app_settings is 'App configuration (one row). Not secret. Changed only via admin_update_settings.';

insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

create or replace function public.get_app_settings()
returns table (
  ai_enabled boolean,
  ai_effort text,
  chat_messages_per_minute integer,
  support_notes text,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.ai_enabled, s.ai_effort, s.chat_messages_per_minute, s.support_notes, s.updated_at
  from public.app_settings s
  where s.id;
$$;

revoke execute on function public.get_app_settings() from public;
grant execute on function public.get_app_settings() to anon, authenticated;

-- Updates the settings and records what changed (notes by length, not content).
create or replace function public.admin_update_settings(
  p_ai_enabled boolean,
  p_ai_effort text,
  p_chat_messages_per_minute integer,
  p_support_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_old public.app_settings;
  v_notes text := coalesce(trim(p_support_notes), '');
  v_changes jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_ai_enabled is null
     or p_ai_effort is null or p_ai_effort not in ('low', 'medium', 'high')
     or p_chat_messages_per_minute is null or p_chat_messages_per_minute not between 1 and 60
     or char_length(v_notes) > 2000 then
    raise exception 'invalid_settings' using errcode = '22023';
  end if;

  select * into v_old from public.app_settings where id for update;

  if v_old.ai_enabled is distinct from p_ai_enabled then
    v_changes := v_changes || jsonb_build_object('ai_enabled', jsonb_build_object('from', v_old.ai_enabled, 'to', p_ai_enabled));
  end if;
  if v_old.ai_effort is distinct from p_ai_effort then
    v_changes := v_changes || jsonb_build_object('ai_effort', jsonb_build_object('from', v_old.ai_effort, 'to', p_ai_effort));
  end if;
  if v_old.chat_messages_per_minute is distinct from p_chat_messages_per_minute then
    v_changes := v_changes || jsonb_build_object('chat_messages_per_minute',
      jsonb_build_object('from', v_old.chat_messages_per_minute, 'to', p_chat_messages_per_minute));
  end if;
  if v_old.support_notes is distinct from v_notes then
    v_changes := v_changes || jsonb_build_object('support_notes',
      jsonb_build_object('from_length', char_length(v_old.support_notes), 'to_length', char_length(v_notes)));
  end if;

  if v_changes = '{}'::jsonb then
    return;
  end if;

  update public.app_settings
  set ai_enabled = p_ai_enabled,
      ai_effort = p_ai_effort,
      chat_messages_per_minute = p_chat_messages_per_minute,
      support_notes = v_notes,
      updated_at = now(),
      updated_by = v_actor
  where id;

  insert into public.audit_log (actor_id, actor_email, action, details)
  values (v_actor, (select p.email from public.profiles p where p.id = v_actor), 'settings.updated', v_changes);
end;
$$;

revoke execute on function public.admin_update_settings(boolean, text, integer, text) from public, anon;
grant execute on function public.admin_update_settings(boolean, text, integer, text) to authenticated;


-- -----------------------------------------------------------------------------
-- Rate Limits page: chat usage per admin (anyone active in the last 24 hours).
-- -----------------------------------------------------------------------------
create or replace function public.admin_chat_usage()
returns table (
  user_id uuid,
  email text,
  last_minute bigint,
  last_hour bigint,
  last_day bigint,
  cost_last_day numeric,
  last_message_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  return query
    select m.user_id,
           p.email,
           count(*) filter (where m.role = 'user' and m.created_at > now() - interval '1 minute'),
           count(*) filter (where m.role = 'user' and m.created_at > now() - interval '1 hour'),
           count(*) filter (where m.role = 'user'),
           coalesce(sum(m.cost_usd), 0),
           max(m.created_at)
    from public.chat_messages m
    left join public.profiles p on p.id = m.user_id
    where m.created_at > now() - interval '24 hours'
    group by m.user_id, p.email
    order by max(m.created_at) desc;
end;
$$;

revoke execute on function public.admin_chat_usage() from public, anon;
grant execute on function public.admin_chat_usage() to authenticated;


-- -----------------------------------------------------------------------------
-- Security page: Row Level Security status of every table in public.
-- -----------------------------------------------------------------------------
create or replace function public.admin_security_overview()
returns table (table_name text, rls_enabled boolean, policy_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;

  return query
    select c.relname::text,
           c.relrowsecurity,
           (select count(*) from pg_catalog.pg_policy pol where pol.polrelid = c.oid)
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
    order by c.relname;
end;
$$;

revoke execute on function public.admin_security_overview() from public, anon;
grant execute on function public.admin_security_overview() to authenticated;
