-- Kelo World Supabase hardening sync.
-- Mirrors the already-applied production migration of the same version/name.
-- Goal: preserve current browser/RPC behavior while making direct-table access
-- and future schema rebuilds match production.

-- Foreign-key support indexes. These are non-behavioral and reduce FK lookup/delete costs.
create index if not exists account_moderation_updated_by_idx
  on public.account_moderation(updated_by);
create index if not exists account_permissions_granted_by_idx
  on public.account_permissions(granted_by);
create index if not exists account_permissions_permission_key_idx
  on public.account_permissions(permission_key);
create index if not exists account_runtime_commands_created_by_idx
  on public.account_runtime_commands(created_by);
create index if not exists approval_requests_decided_by_idx
  on public.approval_requests(decided_by);
create index if not exists guardian_master_lease_user_id_idx
  on public.guardian_master_lease(user_id);
create index if not exists guardian_master_standby_user_id_idx
  on public.guardian_master_standby(user_id);
create index if not exists guardian_signals_from_user_id_idx
  on public.guardian_signals(from_user_id);
create index if not exists role_permissions_permission_key_idx
  on public.role_permissions(permission_key);
create index if not exists world_environment_history_published_by_idx
  on public.world_environment_history(published_by);
create index if not exists world_environment_state_updated_by_idx
  on public.world_environment_state(updated_by);

-- These tables are intentionally RPC-controlled. RLS stays enabled and direct
-- access from anon/authenticated remains denied. SECURITY DEFINER RPCs continue
-- to enforce auth.uid(), ownership, role and permission checks internally.
drop policy if exists rpc_only_direct_deny on public.approval_requests;
create policy rpc_only_direct_deny on public.approval_requests
  for all to anon, authenticated using (false) with check (false);

drop policy if exists rpc_only_direct_deny on public.guardian_master_lease;
create policy rpc_only_direct_deny on public.guardian_master_lease
  for all to anon, authenticated using (false) with check (false);

drop policy if exists rpc_only_direct_deny on public.guardian_master_standby;
create policy rpc_only_direct_deny on public.guardian_master_standby
  for all to anon, authenticated using (false) with check (false);

drop policy if exists rpc_only_direct_deny on public.guardian_nodes;
create policy rpc_only_direct_deny on public.guardian_nodes
  for all to anon, authenticated using (false) with check (false);

drop policy if exists rpc_only_direct_deny on public.guardian_signals;
create policy rpc_only_direct_deny on public.guardian_signals
  for all to anon, authenticated using (false) with check (false);

drop policy if exists rpc_only_direct_deny on public.world_environment_history;
create policy rpc_only_direct_deny on public.world_environment_history
  for all to anon, authenticated using (false) with check (false);

-- Harden the legacy privileged function against search_path object shadowing.
-- EXECUTE grants are intentionally unchanged so existing callers are preserved.
alter function public.nobility_donate(uuid, text, bigint)
  set search_path = '';
