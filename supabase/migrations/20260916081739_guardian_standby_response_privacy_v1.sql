create or replace function kelo_private.guardian_response(p_uid uuid,p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_node public.guardian_nodes%rowtype;
  v_lease public.guardian_master_lease%rowtype;
  v_standby public.guardian_master_standby%rowtype;
  v_active bigint:=0;v_ios bigint:=0;v_relay bigint:=0;v_assets bigint:=0;v_compute bigint:=0;v_host bigint:=0;
  v_node_json jsonb:=null;v_master jsonb:=null;v_standby_json jsonb:=null;
  v_standby_active boolean:=false;
begin
  perform kelo_private.guardian_cleanup();
  select * into v_node from public.guardian_nodes n where n.user_id=p_uid and n.node_id=p_node_id and n.enabled=true and n.last_heartbeat_at>now()-interval '45 seconds';
  if found then
    v_node_json:=jsonb_build_object(
      'nodeId',v_node.node_id,'enabled',true,'role',v_node.role,'recommendedRoles',to_jsonb(v_node.recommended_roles),
      'capabilities',v_node.capabilities,'preferences',v_node.preferences,
      'lastHeartbeatAt',(extract(epoch from v_node.last_heartbeat_at)*1000)::bigint,
      'masterLeaseExpiresAt',case when v_node.role='master-host' then (select (extract(epoch from expires_at)*1000)::bigint from public.guardian_master_lease where singleton=1 and user_id=p_uid and node_id=p_node_id) else null end,
      'masterEpoch',case when v_node.role='master-host' then (select epoch from public.guardian_master_lease where singleton=1 and user_id=p_uid and node_id=p_node_id) else null end
    );
  end if;

  select * into v_lease from public.guardian_master_lease where singleton=1 and user_id is not null and expires_at>now();
  if found then
    v_master:=jsonb_build_object('nodeId',v_lease.node_id,'epoch',v_lease.epoch,'expiresAt',(extract(epoch from v_lease.expires_at)*1000)::bigint);
  end if;

  select * into v_standby from public.guardian_master_standby where singleton=1 and user_id is not null and expires_at>now();
  v_standby_active:=found;
  if v_standby_active and (
       (v_standby.user_id=p_uid and v_standby.node_id=p_node_id)
       or (v_lease.user_id=p_uid and v_lease.node_id=p_node_id)
     ) then
    v_standby_json:=jsonb_build_object(
      'nodeId',v_standby.node_id,
      'masterEpoch',v_standby.master_epoch,
      'assignmentEpoch',v_standby.assignment_epoch,
      'expiresAt',(extract(epoch from v_standby.expires_at)*1000)::bigint,
      'mine',(v_standby.user_id=p_uid and v_standby.node_id=p_node_id)
    );
  end if;

  select count(*),
         count(*) filter(where capabilities->>'platform'='ios'),
         count(*) filter(where recommended_roles@>array['relay-ready']::text[]),
         count(*) filter(where recommended_roles@>array['asset-seeder-ready']::text[]),
         count(*) filter(where recommended_roles@>array['compute-candidate']::text[]),
         count(*) filter(where recommended_roles@>array['host-ready']::text[])
    into v_active,v_ios,v_relay,v_assets,v_compute,v_host
    from public.guardian_nodes where enabled=true and last_heartbeat_at>now()-interval '45 seconds';

  return jsonb_build_object(
    'ok',true,'source','guardian-supabase-v4-standby-private','serverTime',(extract(epoch from now())*1000)::bigint,
    'masterEligible',kelo_private.guardian_master_eligible(p_uid),'node',v_node_json,'master',v_master,'standby',v_standby_json,
    'network',jsonb_build_object(
      'activeNodes',v_active,'iosNodes',v_ios,'relayReady',v_relay,'assetReady',v_assets,
      'computeReady',v_compute,'hostReady',v_host,'masterActive',v_master is not null,
      'masterEpoch',coalesce(v_lease.epoch,0),'masterNodeId',v_lease.node_id,
      'standbyActive',v_standby_active
    )
  );
end;
$$;
