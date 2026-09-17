-- Kelo World Supabase security compatibility contract
-- Read-only assertions. This file must never mutate application data.
-- Purpose: future hardening must not silently break browser RPCs or reopen
-- privileged access that production currently keeps closed.

do $$
declare
  fn text;
  tbl text;
  idx text;
  unsafe_count integer;
begin
  -- 1) No anonymous caller may execute a public SECURITY DEFINER function.
  select count(*) into unsafe_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE');

  if unsafe_count <> 0 then
    raise exception 'SECURITY_CONTRACT: % public SECURITY DEFINER functions are executable by anon', unsafe_count;
  end if;

  -- 2) Browser/app RPCs that Kelo World actively depends on must remain callable
  -- by authenticated users. Authorization still happens inside each RPC.
  foreach fn in array array[
    'public.create_character(text)',
    'public.guardian_enable(text,jsonb,jsonb)',
    'public.guardian_heartbeat(text,jsonb,jsonb)',
    'public.guardian_disable(text)',
    'public.guardian_status(text)',
    'public.guardian_signal_poll(text)',
    'public.guardian_signal_send(text,text,text,jsonb)',
    'public.publish_world_environment(jsonb,bigint)',
    'public.rollback_world_environment(bigint,bigint)',
    'public.list_world_environment_history(integer)',
    'public.get_my_creator_workspace_approval(text,text)',
    'public.submit_creator_workspace_approval(text,text,text,text,text,jsonb)',
    'public.list_approval_requests(text,integer)',
    'public.get_approval_request_detail(uuid)',
    'public.review_approval_request(uuid,text,text)',
    'public.admin_set_role(uuid,text,boolean)',
    'public.admin_set_permission(uuid,text,boolean)',
    'public.admin_adjust_account_currency(uuid,text,bigint,text)'
  ] loop
    if to_regprocedure(fn) is null then
      raise exception 'SECURITY_CONTRACT: required RPC missing: %', fn;
    end if;
    if not has_function_privilege('authenticated', to_regprocedure(fn), 'EXECUTE') then
      raise exception 'SECURITY_CONTRACT: authenticated lost EXECUTE on required RPC: %', fn;
    end if;
  end loop;

  -- 3) Internal privileged mutation helpers must not be exposed directly to
  -- authenticated browser clients.
  foreach fn in array array[
    'public.apply_wallet_delta(uuid,text,bigint,text,uuid,jsonb)',
    'public.nobility_donate(uuid,text,bigint)',
    'public.publish_asset_revision(uuid,text,text,uuid)',
    'public.publish_content_revision(uuid,text,uuid)',
    'public.publish_map_version(uuid,text,uuid)'
  ] loop
    if to_regprocedure(fn) is null then
      raise exception 'SECURITY_CONTRACT: required internal function missing: %', fn;
    end if;
    if has_function_privilege('authenticated', to_regprocedure(fn), 'EXECUTE') then
      raise exception 'SECURITY_CONTRACT: internal function exposed to authenticated: %', fn;
    end if;
  end loop;

  -- 4) RPC-controlled tables must keep an explicit deny-all direct-client RLS
  -- policy. SECURITY DEFINER RPCs are the intended path into these tables.
  foreach tbl in array array[
    'approval_requests',
    'guardian_master_lease',
    'guardian_master_standby',
    'guardian_nodes',
    'guardian_signals',
    'world_environment_history'
  ] loop
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = tbl
        and policyname = 'rpc_only_direct_deny'
        and cmd = 'ALL'
        and qual = 'false'
        and with_check = 'false'
        and 'anon' = any(roles)
        and 'authenticated' = any(roles)
    ) then
      raise exception 'SECURITY_CONTRACT: RPC-only deny policy missing or changed on public.%', tbl;
    end if;
  end loop;

  -- 5) The FK support indexes introduced by the production hardening migration
  -- must remain present. These are performance guards, not authorization rules.
  foreach idx in array array[
    'account_moderation_updated_by_idx',
    'account_permissions_granted_by_idx',
    'account_permissions_permission_key_idx',
    'account_runtime_commands_created_by_idx',
    'approval_requests_decided_by_idx',
    'guardian_master_lease_user_id_idx',
    'guardian_master_standby_user_id_idx',
    'guardian_signals_from_user_id_idx',
    'role_permissions_permission_key_idx',
    'world_environment_history_published_by_idx',
    'world_environment_state_updated_by_idx'
  ] loop
    if to_regclass('public.' || idx) is null then
      raise exception 'SECURITY_CONTRACT: required FK index missing: public.%', idx;
    end if;
  end loop;

  -- 6) Public SECURITY DEFINER routines must pin search_path. Empty search_path
  -- or pg_catalog-only is the current hardened contract.
  select count(*) into unsafe_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not (
      coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']::text[]
      or coalesce(p.proconfig, array[]::text[]) @> array['search_path=pg_catalog']::text[]
    );

  if unsafe_count <> 0 then
    raise exception 'SECURITY_CONTRACT: % public SECURITY DEFINER functions have an unsafe/unpinned search_path', unsafe_count;
  end if;
end
$$;

select 'kelo_world_security_contract_ok' as result;
