-- =============================================================================
-- ServiceIT Support Copilot: Users page (Part 3).
--
-- Run in Supabase -> SQL Editor AFTER 20261009100000_profiles_and_roles.sql
-- (safe to run more than once).
--
-- Adds:
--   * audit_log: append-only record of admin actions (read by admins only).
--   * admin_list_users / admin_role_counts: the Users page data, including
--     last sign-in from auth.users (which the API can't read directly).
--   * admin_set_user_role: the only way to change a role from the app. It
--     checks the caller is an admin in the database, refuses changes to the
--     caller's own role (so the last admin can't lock everyone out) and
--     writes an audit entry in the same transaction.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Audit log
-- -----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null check (char_length(action) <= 64),
  target_id uuid,
  target_email text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_log is 'Admin actions. Written only by security definer functions; admins can read.';

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id) where actor_id is not null;

alter table public.audit_log enable row level security;

drop policy if exists "Admins can read the audit log" on public.audit_log;
create policy "Admins can read the audit log"
  on public.audit_log for select to authenticated
  using (public.is_admin());

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;


-- -----------------------------------------------------------------------------
-- admin_list_users: one page of users, newest first, with optional search
-- (email or name) and role filter. total_count is the number of matches.
-- -----------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_search text default null,
  p_role text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pattern text;
begin
  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_role is not null and p_role not in ('customer', 'technician', 'admin') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  -- Literal match: escape LIKE wildcards in the search text.
  if nullif(trim(p_search), '') is not null then
    v_pattern := '%' || replace(replace(replace(left(trim(p_search), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
    select p.id, p.email, p.full_name, p.role, p.created_at,
           u.last_sign_in_at, u.email_confirmed_at is not null,
           count(*) over ()
    from public.profiles p
    left join auth.users u on u.id = p.id
    where (p_role is null or p.role = p_role)
      and (v_pattern is null or p.email ilike v_pattern or p.full_name ilike v_pattern)
    order by p.created_at desc, p.id
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.admin_list_users(text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, integer, integer) to authenticated;


-- -----------------------------------------------------------------------------
-- admin_role_counts: totals for the summary cards.
-- -----------------------------------------------------------------------------
create or replace function public.admin_role_counts()
returns table (total bigint, admins bigint, technicians bigint, customers bigint)
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
    select count(*),
           count(*) filter (where p.role = 'admin'),
           count(*) filter (where p.role = 'technician'),
           count(*) filter (where p.role = 'customer')
    from public.profiles p;
end;
$$;

revoke execute on function public.admin_role_counts() from public, anon;
grant execute on function public.admin_role_counts() to authenticated;


-- -----------------------------------------------------------------------------
-- admin_set_user_role
-- -----------------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_email text;
  v_target public.profiles;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_role is null or p_role not in ('customer', 'technician', 'admin') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  -- One role change at a time, so two admins can't demote each other at once.
  perform pg_advisory_xact_lock(hashtext('public.admin_set_user_role'));

  if not public.is_admin() then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if p_user_id = v_actor then
    raise exception 'cannot_change_own_role' using errcode = '42501';
  end if;

  select * into v_target from public.profiles p where p.id = p_user_id for update;
  if not found then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if v_target.role = p_role then
    return;
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  select p.email into v_actor_email from public.profiles p where p.id = v_actor;
  insert into public.audit_log (actor_id, actor_email, action, target_id, target_email, details)
  values (v_actor, v_actor_email, 'user.role_changed', p_user_id, v_target.email,
          jsonb_build_object('from', v_target.role, 'to', p_role));
end;
$$;

revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
