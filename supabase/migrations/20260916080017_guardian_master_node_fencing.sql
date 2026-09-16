create or replace function public.guardian_master_start(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_lease public.guardian_master_lease%rowtype;v_visibility text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.guardian_master_eligible(v_uid) then raise exception 'GUARDIAN_MASTER_PERMISSION_DENIED'; end if;
  perform kelo_private.guardian_cleanup();
  select capabilities->>'visibility' into v_visibility
    from public.guardian_nodes
    where user_id=v_uid and node_id=p_node_id and enabled=true and last_heartbeat_at>now()-interval '45 seconds';
  if v_visibility is null then raise exception 'GUARDIAN_NODE_NOT_ENABLED'; end if;
  if v_visibility<>'visible' then raise exception 'GUARDIAN_FOREGROUND_REQUIRED'; end if;
  select * into v_lease from public.guardian_master_lease where singleton=1 for update;

  -- Fence by account + device node. A second device on the same account cannot
  -- preempt a still-valid Master lease; takeover requires expiry or explicit stop.
  if v_lease.user_id is not null and v_lease.expires_at>now()
     and (v_lease.user_id<>v_uid or v_lease.node_id<>p_node_id) then
    raise exception 'GUARDIAN_MASTER_BUSY';
  end if;

  if v_lease.user_id is not null and (v_lease.user_id<>v_uid or v_lease.node_id<>p_node_id) then
    update public.guardian_nodes set role='donor-ready',updated_at=now()
      where user_id=v_lease.user_id and node_id=v_lease.node_id;
  end if;
  update public.guardian_master_lease
    set user_id=v_uid,node_id=p_node_id,epoch=epoch+1,started_at=now(),expires_at=now()+interval '25 seconds',updated_at=now()
    where singleton=1;
  update public.guardian_nodes set role='master-host',last_heartbeat_at=now(),updated_at=now()
    where user_id=v_uid and node_id=p_node_id;
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

comment on function public.guardian_master_start(text) is
'Acquires or renews the Guardian Master lease. An unexpired lease is fenced by both user_id and node_id so another device, including one on the same account, cannot preempt it.';
