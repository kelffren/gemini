-- KELO-INDEX
-- area: SUPABASE / GUARDIAN GPU ASSETS
-- owner: Kelo Guardian control plane
-- keys: GUARDIAN WEBGPU GPU DONATION ASSET CAPACITY HEARTBEAT
-- purpose: añade rol asset-gpu-worker y capacidad comunitaria GPU agregada sin exponer modelo/vendor ni conceder autoridad/recompensas
-- online: guardian_nodes conserva capabilities/preferences JSONB autenticados; response solo publica agregados de nodos frescos
-- do-not: NO usar capacidad autodeclarada como proof/reward; NO autoridad gameplay/economy
begin;

create or replace function kelo_private.guardian_recommended_roles(p_capabilities jsonb,p_preferences jsonb)
returns text[] language plpgsql immutable set search_path='' as $$
declare
  v_roles text[]:=array['witness-ready']::text[];
  v_cores numeric:=case when coalesce(p_capabilities->>'cores','') ~ '^[0-9]+(?:\.[0-9]+)?$' then (p_capabilities->>'cores')::numeric else 0 end;
  v_gpu_units numeric:=case when coalesce(p_capabilities->>'gpuCapacityUnits','') ~ '^[0-9]+(?:\.[0-9]+)?$' then least(100,greatest(0,(p_capabilities->>'gpuCapacityUnits')::numeric)) else 0 end;
begin
  if coalesce(p_preferences->>'allowAssets','true') <> 'false' then v_roles:=array_append(v_roles,'asset-seeder-ready'); end if;
  if coalesce(p_preferences->>'allowRelay','true') <> 'false' and coalesce(p_capabilities->>'webrtc','false')='true' then v_roles:=array_append(v_roles,'relay-ready'); end if;
  if coalesce(p_preferences->>'allowCompute','false')='true' and v_cores>=4 and coalesce(p_capabilities->>'visibility','unknown')='visible' then v_roles:=array_append(v_roles,'compute-candidate'); end if;
  if coalesce(p_preferences->>'allowGpuAssets','false')='true'
     and coalesce(p_capabilities->>'webgpu','false')='true'
     and v_gpu_units>0
     and coalesce(p_capabilities->>'visibility','unknown')='visible'
  then v_roles:=array_append(v_roles,'asset-gpu-worker'); end if;
  return v_roles;
end;
$$;

create or replace function kelo_private.guardian_response(p_uid uuid,p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_node public.guardian_nodes%rowtype;
  v_lease public.guardian_master_lease%rowtype;
  v_active bigint:=0;v_ios bigint:=0;v_relay bigint:=0;v_assets bigint:=0;v_compute bigint:=0;v_gpu_donors bigint:=0;
  v_gpu_units numeric:=0;
  v_node_json jsonb:=null;v_master jsonb:=null;
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
  if found then v_master:=jsonb_build_object('nodeId',v_lease.node_id,'epoch',v_lease.epoch,'expiresAt',(extract(epoch from v_lease.expires_at)*1000)::bigint); end if;

  with active as (
    select * from public.guardian_nodes
    where enabled=true and last_heartbeat_at>now()-interval '45 seconds'
  ), normalized as (
    select *,
      case when coalesce(capabilities->>'gpuCapacityUnits','') ~ '^[0-9]+(?:\.[0-9]+)?$'
        then least(100,greatest(0,(capabilities->>'gpuCapacityUnits')::numeric)) else 0 end as gpu_units,
      case when coalesce(preferences->>'gpuSharePct','') ~ '^[0-9]+(?:\.[0-9]+)?$'
        then least(100,greatest(10,(preferences->>'gpuSharePct')::numeric)) else 25 end as gpu_share
    from active
  )
  select count(*),
    count(*) filter(where capabilities->>'platform'='ios'),
    count(*) filter(where recommended_roles@>array['relay-ready']::text[]),
    count(*) filter(where recommended_roles@>array['asset-seeder-ready']::text[]),
    count(*) filter(where recommended_roles@>array['compute-candidate']::text[]),
    count(*) filter(where recommended_roles@>array['asset-gpu-worker']::text[]),
    coalesce(sum(case when recommended_roles@>array['asset-gpu-worker']::text[] then gpu_units*gpu_share/100 else 0 end),0)
  into v_active,v_ios,v_relay,v_assets,v_compute,v_gpu_donors,v_gpu_units
  from normalized;

  return jsonb_build_object(
    'ok',true,'source','guardian-supabase-v3-gpu-assets','serverTime',(extract(epoch from now())*1000)::bigint,
    'masterEligible',kelo_private.guardian_master_eligible(p_uid),'node',v_node_json,'master',v_master,
    'network',jsonb_build_object(
      'activeNodes',v_active,'iosNodes',v_ios,'relayReady',v_relay,'assetReady',v_assets,'computeReady',v_compute,
      'gpuAssetDonors',v_gpu_donors,'gpuCapacityUnits',round(v_gpu_units,2),'gpuCapacityTargetUnits',1000,
      'gpuCapacityPct',round(least(100,v_gpu_units/10),2),'gpuCapacityVerified',false,
      'masterActive',v_master is not null,'masterEpoch',coalesce(v_lease.epoch,0),'masterNodeId',v_lease.node_id
    )
  );
end;
$$;

commit;
