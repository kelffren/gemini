begin;

create table if not exists public.guardian_master_standby (
  singleton smallint primary key default 1 check (singleton=1),
  master_epoch bigint not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  node_id text,
  assignment_epoch bigint not null default 0,
  assigned_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint guardian_master_standby_node_format check (node_id is null or node_id ~ '^[A-Za-z0-9:_-]{8,96}$')
);
insert into public.guardian_master_standby(singleton) values (1) on conflict (singleton) do nothing;
alter table public.guardian_master_standby enable row level security;
revoke all on public.guardian_master_standby from public,anon,authenticated;

create or replace function kelo_private.guardian_recommended_roles(p_capabilities jsonb,p_preferences jsonb)
returns text[] language plpgsql immutable set search_path='' as $$
declare
  v_roles text[]:=array['witness-ready']::text[];
  v_cores numeric:=case when coalesce(p_capabilities->>'cores','') ~ '^[0-9]+(?:\.[0-9]+)?$' then (p_capabilities->>'cores')::numeric else 0 end;
begin
  if coalesce(p_preferences->>'allowAssets','true') <> 'false' then v_roles:=array_append(v_roles,'asset-seeder-ready'); end if;
  if coalesce(p_preferences->>'allowRelay','true') <> 'false' and coalesce(p_capabilities->>'webrtc','false')='true' then v_roles:=array_append(v_roles,'relay-ready'); end if;
  if coalesce(p_preferences->>'allowCompute','false')='true' and v_cores>=4 and coalesce(p_capabilities->>'visibility','unknown')='visible' then v_roles:=array_append(v_roles,'compute-candidate'); end if;
  if coalesce(p_capabilities->>'webrtc','false')='true'
     and v_cores>=4
     and coalesce(p_capabilities->>'visibility','unknown')='visible'
     and coalesce(p_capabilities->>'saveData','false')<>'true' then
    v_roles:=array_append(v_roles,'host-ready');
  end if;
  return v_roles;
end;
$$;

create or replace function kelo_private.guardian_refresh_standby(p_master_epoch bigint,p_master_user_id uuid,p_master_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_row public.guardian_master_standby%rowtype;
  v_user_id uuid;
  v_node_id text;
begin
  select * into v_row from public.guardian_master_standby where singleton=1 for update;
  if v_row.user_id is not null
     and v_row.master_epoch=p_master_epoch
     and v_row.expires_at>now()
     and exists(
       select 1 from public.guardian_nodes n
       where n.user_id=v_row.user_id and n.node_id=v_row.node_id
         and n.enabled=true and n.last_heartbeat_at>now()-interval '45 seconds'
         and n.recommended_roles@>array['host-ready']::text[]
         and coalesce(n.capabilities->>'visibility','unknown')='visible'
     ) then
    update public.guardian_master_standby
      set expires_at=now()+interval '90 seconds',updated_at=now()
      where singleton=1;
    return jsonb_build_object('nodeId',v_row.node_id,'masterEpoch',p_master_epoch,'assignmentEpoch',v_row.assignment_epoch,'reused',true);
  end if;

  select n.user_id,n.node_id into v_user_id,v_node_id
  from public.guardian_nodes n
  where n.enabled=true
    and n.last_heartbeat_at>now()-interval '45 seconds'
    and n.recommended_roles@>array['host-ready']::text[]
    and coalesce(n.capabilities->>'visibility','unknown')='visible'
    and not (n.user_id=p_master_user_id and n.node_id=p_master_node_id)
  order by
    case when coalesce(n.capabilities->>'charging','false')='true' then 1 else 0 end desc,
    case when coalesce(n.capabilities->>'platform','web')='desktop' then 1 else 0 end desc,
    case when coalesce(n.capabilities->>'cores','') ~ '^[0-9]+(?:\.[0-9]+)?$' then (n.capabilities->>'cores')::numeric else 0 end desc,
    case when coalesce(n.capabilities->>'memoryGb','') ~ '^[0-9]+(?:\.[0-9]+)?$' then (n.capabilities->>'memoryGb')::numeric else 0 end desc,
    n.last_heartbeat_at desc,
    n.node_id asc
  limit 1;

  if v_user_id is null then
    update public.guardian_master_standby
      set master_epoch=p_master_epoch,user_id=null,node_id=null,assigned_at=null,expires_at=null,updated_at=now()
      where singleton=1;
    return null;
  end if;

  update public.guardian_master_standby
    set master_epoch=p_master_epoch,user_id=v_user_id,node_id=v_node_id,
        assignment_epoch=assignment_epoch+1,assigned_at=now(),expires_at=now()+interval '90 seconds',updated_at=now()
    where singleton=1
    returning * into v_row;
  return jsonb_build_object('nodeId',v_row.node_id,'masterEpoch',v_row.master_epoch,'assignmentEpoch',v_row.assignment_epoch,'reused',false);
end;
$$;

create or replace function kelo_private.guardian_cleanup()
returns void language plpgsql security definer set search_path='' as $$
declare v_uid uuid;v_node text;
begin
  select l.user_id,l.node_id into v_uid,v_node
  from public.guardian_master_lease l
  where l.singleton=1 and l.user_id is not null and (
    l.expires_at is null or l.expires_at<=now() or not exists(
      select 1 from public.guardian_nodes n
      where n.user_id=l.user_id and n.node_id=l.node_id and n.enabled=true and n.last_heartbeat_at>now()-interval '45 seconds'
    )
  );
  if v_uid is not null then
    update public.guardian_nodes set role='donor-ready',updated_at=now() where user_id=v_uid and node_id=v_node;
    update public.guardian_master_lease set user_id=null,node_id=null,started_at=null,expires_at=null,updated_at=now() where singleton=1;
  end if;
  update public.guardian_master_standby s
    set user_id=null,node_id=null,assigned_at=null,expires_at=null,updated_at=now()
    where s.singleton=1 and s.user_id is not null and (
      s.expires_at is null or s.expires_at<=now() or not exists(
        select 1 from public.guardian_nodes n
        where n.user_id=s.user_id and n.node_id=s.node_id and n.enabled=true
          and n.last_heartbeat_at>now()-interval '45 seconds'
          and n.recommended_roles@>array['host-ready']::text[]
          and coalesce(n.capabilities->>'visibility','unknown')='visible'
      )
    );
  delete from public.guardian_signals where expires_at<=now() or (consumed_at is not null and consumed_at<now()-interval '60 seconds');
end;
$$;

create or replace function kelo_private.guardian_response(p_uid uuid,p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_node public.guardian_nodes%rowtype;
  v_lease public.guardian_master_lease%rowtype;
  v_standby public.guardian_master_standby%rowtype;
  v_active bigint:=0;v_ios bigint:=0;v_relay bigint:=0;v_assets bigint:=0;v_compute bigint:=0;v_host bigint:=0;
  v_node_json jsonb:=null;v_master jsonb:=null;v_standby_json jsonb:=null;
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
  select * into v_standby from public.guardian_master_standby where singleton=1 and user_id is not null and expires_at>now();
  if found then
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
    'ok',true,'source','guardian-supabase-v4-standby','serverTime',(extract(epoch from now())*1000)::bigint,
    'masterEligible',kelo_private.guardian_master_eligible(p_uid),'node',v_node_json,'master',v_master,'standby',v_standby_json,
    'network',jsonb_build_object('activeNodes',v_active,'iosNodes',v_ios,'relayReady',v_relay,'assetReady',v_assets,'computeReady',v_compute,'hostReady',v_host,'masterActive',v_master is not null,'masterEpoch',coalesce(v_lease.epoch,0),'masterNodeId',v_lease.node_id,'standbyActive',v_standby_json is not null,'standbyNodeId',v_standby.node_id)
  );
end;
$$;

create or replace function public.guardian_heartbeat(p_node_id text,p_capabilities jsonb default null,p_preferences jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_visibility text;v_epoch bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform kelo_private.guardian_cleanup();
  if not exists(select 1 from public.guardian_nodes where user_id=v_uid and node_id=p_node_id and enabled=true) then raise exception 'GUARDIAN_NODE_NOT_ENABLED'; end if;
  update public.guardian_nodes set
    capabilities=coalesce(p_capabilities,capabilities),preferences=coalesce(p_preferences,preferences),
    recommended_roles=kelo_private.guardian_recommended_roles(coalesce(p_capabilities,capabilities),coalesce(p_preferences,preferences)),
    last_heartbeat_at=now(),updated_at=now()
    where user_id=v_uid and node_id=p_node_id;
  select capabilities->>'visibility' into v_visibility from public.guardian_nodes where user_id=v_uid and node_id=p_node_id;
  select epoch into v_epoch from public.guardian_master_lease where singleton=1 and user_id=v_uid and node_id=p_node_id and expires_at>now();
  if v_epoch is not null then
    if v_visibility='visible' then
      update public.guardian_master_lease set expires_at=now()+interval '25 seconds',updated_at=now() where singleton=1;
      update public.guardian_nodes set role='master-host' where user_id=v_uid and node_id=p_node_id;
      perform kelo_private.guardian_refresh_standby(v_epoch,v_uid,p_node_id);
    else
      update public.guardian_master_lease set user_id=null,node_id=null,started_at=null,expires_at=null,updated_at=now() where singleton=1;
      update public.guardian_nodes set role='donor-ready' where user_id=v_uid and node_id=p_node_id;
    end if;
  end if;
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_disable(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_epoch bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select epoch into v_epoch from public.guardian_master_lease where singleton=1 and user_id=v_uid and node_id=p_node_id;
  if v_epoch is not null then
    update public.guardian_master_standby set user_id=null,node_id=null,assigned_at=null,expires_at=null,updated_at=now() where singleton=1 and master_epoch=v_epoch;
    update public.guardian_master_lease set user_id=null,node_id=null,started_at=null,expires_at=null,updated_at=now() where singleton=1;
  end if;
  update public.guardian_master_standby set user_id=null,node_id=null,assigned_at=null,expires_at=null,updated_at=now() where singleton=1 and user_id=v_uid and node_id=p_node_id;
  delete from public.guardian_signals where (from_user_id=v_uid and from_node_id=p_node_id) or (to_user_id=v_uid and to_node_id=p_node_id);
  delete from public.guardian_nodes where user_id=v_uid and node_id=p_node_id;
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_master_start(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_lease public.guardian_master_lease%rowtype;v_visibility text;v_new_epoch bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.guardian_master_eligible(v_uid) then raise exception 'GUARDIAN_MASTER_PERMISSION_DENIED'; end if;
  perform kelo_private.guardian_cleanup();
  select capabilities->>'visibility' into v_visibility from public.guardian_nodes where user_id=v_uid and node_id=p_node_id and enabled=true and last_heartbeat_at>now()-interval '45 seconds';
  if v_visibility is null then raise exception 'GUARDIAN_NODE_NOT_ENABLED'; end if;
  if v_visibility<>'visible' then raise exception 'GUARDIAN_FOREGROUND_REQUIRED'; end if;
  select * into v_lease from public.guardian_master_lease where singleton=1 for update;
  if v_lease.user_id is not null and v_lease.expires_at>now() and (v_lease.user_id<>v_uid or v_lease.node_id<>p_node_id) then raise exception 'GUARDIAN_MASTER_BUSY'; end if;
  if v_lease.user_id is not null and (v_lease.user_id<>v_uid or v_lease.node_id<>p_node_id) then update public.guardian_nodes set role='donor-ready',updated_at=now() where user_id=v_lease.user_id and node_id=v_lease.node_id; end if;
  update public.guardian_master_lease set user_id=v_uid,node_id=p_node_id,epoch=epoch+1,started_at=now(),expires_at=now()+interval '25 seconds',updated_at=now() where singleton=1 returning epoch into v_new_epoch;
  update public.guardian_nodes set role='master-host',last_heartbeat_at=now(),updated_at=now() where user_id=v_uid and node_id=p_node_id;
  perform kelo_private.guardian_refresh_standby(v_new_epoch,v_uid,p_node_id);
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_master_stop(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_epoch bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.guardian_master_eligible(v_uid) then raise exception 'GUARDIAN_MASTER_PERMISSION_DENIED'; end if;
  select epoch into v_epoch from public.guardian_master_lease where singleton=1 and user_id=v_uid and node_id=p_node_id;
  if v_epoch is not null then
    update public.guardian_master_standby set user_id=null,node_id=null,assigned_at=null,expires_at=null,updated_at=now() where singleton=1 and master_epoch=v_epoch;
    update public.guardian_master_lease set user_id=null,node_id=null,started_at=null,expires_at=null,updated_at=now() where singleton=1;
  end if;
  update public.guardian_nodes set role='donor-ready',updated_at=now() where user_id=v_uid and node_id=p_node_id;
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

create or replace function public.guardian_master_claim_standby(p_node_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=(select auth.uid());
  v_lease public.guardian_master_lease%rowtype;
  v_standby public.guardian_master_standby%rowtype;
  v_visibility text;
  v_new_epoch bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform kelo_private.guardian_cleanup();
  select * into v_lease from public.guardian_master_lease where singleton=1 for update;
  if v_lease.user_id is not null and v_lease.expires_at>now() then raise exception 'GUARDIAN_MASTER_BUSY'; end if;
  select * into v_standby from public.guardian_master_standby where singleton=1 for update;
  if v_standby.user_id is null
     or v_standby.user_id<>v_uid
     or v_standby.node_id<>p_node_id
     or v_standby.expires_at is null
     or v_standby.expires_at<=now()
     or v_standby.master_epoch<>v_lease.epoch then
    raise exception 'GUARDIAN_STANDBY_NOT_ASSIGNED';
  end if;
  select capabilities->>'visibility' into v_visibility
    from public.guardian_nodes
    where user_id=v_uid and node_id=p_node_id and enabled=true and last_heartbeat_at>now()-interval '45 seconds'
      and recommended_roles@>array['host-ready']::text[];
  if v_visibility is null then raise exception 'GUARDIAN_NODE_NOT_ENABLED'; end if;
  if v_visibility<>'visible' then raise exception 'GUARDIAN_FOREGROUND_REQUIRED'; end if;
  update public.guardian_master_lease
    set user_id=v_uid,node_id=p_node_id,epoch=epoch+1,started_at=now(),expires_at=now()+interval '25 seconds',updated_at=now()
    where singleton=1 returning epoch into v_new_epoch;
  update public.guardian_nodes set role='master-host',last_heartbeat_at=now(),updated_at=now() where user_id=v_uid and node_id=p_node_id;
  update public.guardian_master_standby set user_id=null,node_id=null,assigned_at=null,expires_at=null,updated_at=now() where singleton=1;
  perform kelo_private.guardian_refresh_standby(v_new_epoch,v_uid,p_node_id);
  return kelo_private.guardian_response(v_uid,p_node_id);
end;
$$;

revoke all on function public.guardian_master_claim_standby(text) from public,anon;
grant execute on function public.guardian_master_claim_standby(text) to authenticated,service_role;

commit;
