-- =============================================================================
-- Part 5 test: settings, audit entries, chat usage, security overview.
--
-- Run in Supabase -> SQL Editor AFTER all migrations. Everything runs inside a
-- transaction that is ROLLED BACK at the end: nothing is saved.
--
--   Success: "Success. No rows returned"
--   Failure: an error starting with "FAIL:".
-- =============================================================================

begin;

insert into auth.users (id, email, aud, role)
values
  ('a1000000-0000-4000-8000-00000000000a', 'tools-test-admin@example.invalid', 'authenticated', 'authenticated'),
  ('c1000000-0000-4000-8000-00000000000c', 'tools-test-cust@example.invalid', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'a1000000-0000-4000-8000-00000000000a';
insert into public.chat_conversations (id, user_id, title)
values ('e1000000-0000-4000-8000-00000000000e', 'a1000000-0000-4000-8000-00000000000a', 'Test');
insert into public.chat_messages (conversation_id, user_id, role, content, cost_usd)
values
  ('e1000000-0000-4000-8000-00000000000e', 'a1000000-0000-4000-8000-00000000000a', 'user', 'q1', null),
  ('e1000000-0000-4000-8000-00000000000e', 'a1000000-0000-4000-8000-00000000000a', 'assistant', 'a1', 0.01),
  ('e1000000-0000-4000-8000-00000000000e', 'a1000000-0000-4000-8000-00000000000a', 'user', 'q2', null);

-- ---------------------------------------------------------------- anonymous
set local role anon;
do $$
begin
  if (select count(*) from public.get_app_settings()) <> 1 then raise exception 'FAIL: anon cannot read settings'; end if;
end $$;
do $$
begin
  perform public.admin_update_settings(false, 'low', 5, '');
  raise exception 'FAIL: anon changed settings';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform * from public.app_settings;
  raise exception 'FAIL: anon read app_settings directly';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------- customer
reset role;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"c1000000-0000-4000-8000-00000000000c","role":"authenticated"}', true); end $$;
do $$
begin
  perform public.admin_update_settings(false, 'low', 5, '');
  raise exception 'FAIL: customer changed settings';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.admin_chat_usage();
  raise exception 'FAIL: customer read chat usage';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  perform public.admin_security_overview();
  raise exception 'FAIL: customer read security overview';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------- admin
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"a1000000-0000-4000-8000-00000000000a","role":"authenticated"}', true); end $$;

do $$
declare s record; n integer; d jsonb;
begin
  perform public.admin_update_settings(false, 'high', 20, '  Help desk: ext. 100  ');
  select * into s from public.get_app_settings();
  if s.ai_enabled or s.ai_effort <> 'high' or s.chat_messages_per_minute <> 20 or s.support_notes <> 'Help desk: ext. 100'
    then raise exception 'FAIL: settings not saved'; end if;

  select count(*), max(details::text)::jsonb into n, d from public.audit_log
  where action = 'settings.updated' and actor_id = 'a1000000-0000-4000-8000-00000000000a';
  if n <> 1 then raise exception 'FAIL: expected 1 audit entry, got %', n; end if;
  if d -> 'chat_messages_per_minute' ->> 'to' <> '20' or d -> 'support_notes' ->> 'to_length' <> '19'
     or d -> 'support_notes' ? 'to' then
    raise exception 'FAIL: audit details wrong: %', d;
  end if;

  -- Saving the same values: no change, no new audit entry.
  perform public.admin_update_settings(false, 'high', 20, 'Help desk: ext. 100');
  select count(*) into n from public.audit_log where action = 'settings.updated' and actor_id = 'a1000000-0000-4000-8000-00000000000a';
  if n <> 1 then raise exception 'FAIL: no-op save was audited'; end if;
end $$;

do $$
begin
  perform public.admin_update_settings(true, 'max', 10, '');
  raise exception 'FAIL: invalid effort accepted';
exception when invalid_parameter_value then null;
end $$;
do $$
begin
  perform public.admin_update_settings(true, 'low', 0, '');
  raise exception 'FAIL: zero rate limit accepted';
exception when invalid_parameter_value then null;
end $$;
do $$
begin
  perform public.admin_update_settings(true, 'low', 10, repeat('x', 2001));
  raise exception 'FAIL: over-long notes accepted';
exception when invalid_parameter_value then null;
end $$;

do $$
declare u record;
begin
  select * into u from public.admin_chat_usage() where user_id = 'a1000000-0000-4000-8000-00000000000a';
  if u.last_minute <> 2 or u.last_day <> 2 or u.cost_last_day <> 0.01 then
    raise exception 'FAIL: chat usage wrong: % % %', u.last_minute, u.last_day, u.cost_last_day;
  end if;
end $$;

do $$
begin
  if exists (select 1 from public.admin_security_overview() where not rls_enabled) then
    raise exception 'FAIL: a public table has Row Level Security off';
  end if;
  if not exists (select 1 from public.admin_security_overview() where table_name = 'app_settings') then
    raise exception 'FAIL: security overview misses tables';
  end if;
end $$;

-- Admins still can't write the audit log or settings directly.
do $$
begin
  insert into public.audit_log (action) values ('forged');
  raise exception 'FAIL: admin wrote to the audit log directly';
exception when insufficient_privilege then null;
end $$;
do $$
begin
  update public.app_settings set ai_enabled = true;
  raise exception 'FAIL: admin updated app_settings directly';
exception when insufficient_privilege then null;
end $$;

rollback;
