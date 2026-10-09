-- =============================================================================
-- Users page test: listing, role changes, audit log, access rules.
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
  ('a0000000-0000-4000-8000-00000000000a', 'users-test-admin@example.invalid', 'authenticated', 'authenticated'),
  ('b0000000-0000-4000-8000-00000000000b', 'users-test-tech@example.invalid', 'authenticated', 'authenticated'),
  ('c0000000-0000-4000-8000-00000000000c', 'users-test_cust@example.invalid', 'authenticated', 'authenticated');
update public.profiles set role = 'admin' where id = 'a0000000-0000-4000-8000-00000000000a';

-- ---------------------------------------------------------------- as a customer
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"c0000000-0000-4000-8000-00000000000c","role":"authenticated"}', true); end $$;

do $$
begin
  perform public.admin_list_users();
  raise exception 'FAIL: customer listed users';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  perform public.admin_role_counts();
  raise exception 'FAIL: customer read role counts';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  perform public.admin_set_user_role('c0000000-0000-4000-8000-00000000000c', 'admin');
  raise exception 'FAIL: customer made themselves admin';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  insert into public.audit_log (action) values ('forged');
  raise exception 'FAIL: customer wrote to the audit log';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  if exists (select 1 from public.audit_log) then raise exception 'FAIL: customer can read the audit log'; end if;
end $$;

-- ---------------------------------------------------------------- as an admin
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-00000000000a","role":"authenticated"}', true); end $$;

do $$
declare n integer; t bigint;
begin
  select count(*), max(total_count) into n, t
  from public.admin_list_users('users-test', null, 2, 0);
  if n <> 2 or t <> 3 then raise exception 'FAIL: paging/total wrong (% rows, total %)', n, t; end if;

  -- "_" is matched literally, not as a wildcard.
  select count(*) into n from public.admin_list_users('test_', null, 25, 0);
  if n <> 1 then raise exception 'FAIL: LIKE wildcard not escaped (% rows)', n; end if;

  select count(*) into n from public.admin_list_users('users-test', 'admin', 25, 0);
  if n <> 1 then raise exception 'FAIL: role filter wrong (% rows)', n; end if;

  if (select admins from public.admin_role_counts()) < 1 then raise exception 'FAIL: role counts wrong'; end if;
end $$;

do $$
begin
  perform public.admin_list_users(null, 'superuser', 25, 0);
  raise exception 'FAIL: invalid role filter accepted';
exception when invalid_parameter_value then null;
end $$;

-- Promote the customer to technician: changes the role and writes one audit entry.
do $$
declare n integer;
begin
  perform public.admin_set_user_role('c0000000-0000-4000-8000-00000000000c', 'technician');
  if (select role from public.profiles where id = 'c0000000-0000-4000-8000-00000000000c') <> 'technician'
    then raise exception 'FAIL: role not changed'; end if;

  select count(*) into n from public.audit_log
  where action = 'user.role_changed' and target_id = 'c0000000-0000-4000-8000-00000000000c'
    and actor_id = 'a0000000-0000-4000-8000-00000000000a'
    and details = '{"from":"customer","to":"technician"}'::jsonb;
  if n <> 1 then raise exception 'FAIL: audit entry missing'; end if;

  -- Same role again: no change, no extra audit entry.
  perform public.admin_set_user_role('c0000000-0000-4000-8000-00000000000c', 'technician');
  select count(*) into n from public.audit_log where target_id = 'c0000000-0000-4000-8000-00000000000c';
  if n <> 1 then raise exception 'FAIL: no-op change was audited'; end if;
end $$;

do $$
begin
  perform public.admin_set_user_role('a0000000-0000-4000-8000-00000000000a', 'customer');
  raise exception 'FAIL: admin changed their own role';
exception when insufficient_privilege then
  if sqlerrm <> 'cannot_change_own_role' then raise; end if;
end $$;

do $$
begin
  perform public.admin_set_user_role('b0000000-0000-4000-8000-00000000000b', 'owner');
  raise exception 'FAIL: invalid role accepted';
exception when invalid_parameter_value then null;
end $$;

do $$
begin
  perform public.admin_set_user_role('d0000000-0000-4000-8000-00000000000d', 'admin');
  raise exception 'FAIL: unknown user accepted';
exception when no_data_found then null;
end $$;

-- Direct writes are still blocked, even for admins (only the function may).
do $$
begin
  update public.profiles set role = 'admin' where id = 'b0000000-0000-4000-8000-00000000000b';
  raise exception 'FAIL: direct role update allowed';
exception when insufficient_privilege then null;
end $$;

-- ---------------------------------------------------------------- anonymous
reset role;
set local role anon;
do $$
begin
  perform public.admin_list_users();
  raise exception 'FAIL: anon called admin_list_users';
exception when insufficient_privilege then null;
end $$;

rollback;
