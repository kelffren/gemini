create or replace function public.world_apply_mutation(
  p_cell_id text,
  p_event_id text,
  p_expected_revision bigint,
  p_event_type text,
  p_patch jsonb,
  p_aggregate_id text default 'world',
  p_actor_user_id uuid default null,
  p_character_id uuid default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_scope text := 'world-event';
  v_existing jsonb;
  v_snapshot public.world_cell_snapshots%rowtype;
  v_new_state jsonb;
  v_new_revision bigint;
  v_result jsonb;
begin
  if p_cell_id is null or p_cell_id !~ '^[A-Za-z0-9_-]{1,48}:-?[0-9]{1,8}:-?[0-9]{1,8}$' then raise exception 'WORLD_CELL_ID_INVALID'; end if;
  if p_event_id is null or p_event_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' then raise exception 'WORLD_EVENT_ID_INVALID'; end if;
  if p_event_type is null or p_event_type !~ '^[a-z][a-z0-9_.:-]{0,95}$' then raise exception 'WORLD_EVENT_TYPE_INVALID'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'WORLD_EXPECTED_REVISION_INVALID'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'WORLD_PATCH_INVALID'; end if;
  if pg_column_size(p_patch) > 120000 then raise exception 'WORLD_PATCH_TOO_LARGE'; end if;
  if p_aggregate_id is null or char_length(p_aggregate_id) < 1 or char_length(p_aggregate_id) > 128 then raise exception 'WORLD_AGGREGATE_INVALID'; end if;

  perform pg_advisory_xact_lock(hashtextextended('kelo-world-cell:' || p_cell_id, 0));

  select result into v_existing
  from public.server_idempotency
  where scope=v_scope and idempotency_key=p_event_id;

  if v_existing is not null then
    if coalesce(v_existing->>'cellId','') <> p_cell_id then raise exception 'WORLD_EVENT_ID_REUSED'; end if;
    return v_existing;
  end if;

  insert into public.world_cell_snapshots(cell_id,revision,schema_version,state,last_event_id,updated_at)
  values(p_cell_id,0,1,'{}'::jsonb,null,now())
  on conflict(cell_id) do nothing;

  select * into v_snapshot
  from public.world_cell_snapshots
  where cell_id=p_cell_id
  for update;

  if v_snapshot.revision <> p_expected_revision then
    raise exception 'WORLD_REVISION_CONFLICT:expected=% actual=%',p_expected_revision,v_snapshot.revision;
  end if;

  v_new_revision := v_snapshot.revision + 1;
  v_new_state := v_snapshot.state || p_patch;
  if pg_column_size(v_new_state) > 450000 then raise exception 'WORLD_STATE_TOO_LARGE'; end if;

  insert into public.world_event_ledger(event_id,cell_id,revision,aggregate_id,event_type,payload,actor_user_id,character_id,request_id)
  values(
    p_event_id,p_cell_id,v_new_revision,p_aggregate_id,p_event_type,
    jsonb_build_object('patch',p_patch,'resultingRevision',v_new_revision),
    p_actor_user_id,p_character_id,left(p_request_id,160)
  );

  update public.world_cell_snapshots
  set revision=v_new_revision,state=v_new_state,last_event_id=p_event_id,updated_at=now()
  where cell_id=p_cell_id;

  v_result := jsonb_build_object(
    'cellId',p_cell_id,
    'revision',v_new_revision,
    'schemaVersion',1,
    'eventId',p_event_id,
    'eventType',p_event_type,
    'aggregateId',p_aggregate_id
  );

  insert into public.server_audit_events(actor_user_id,character_id,event_key,target_type,target_id,request_id,metadata)
  values(p_actor_user_id,p_character_id,'world.mutation','world-cell',p_cell_id,left(p_request_id,160),jsonb_build_object('eventId',p_event_id,'revision',v_new_revision,'eventType',p_event_type));

  insert into public.server_outbox(topic,event_key,aggregate_type,aggregate_id,payload)
  values('world.event',p_event_id,'world-cell',p_cell_id,jsonb_build_object('cellId',p_cell_id,'revision',v_new_revision,'eventType',p_event_type,'aggregateId',p_aggregate_id));

  insert into public.server_idempotency(scope,idempotency_key,result)
  values(v_scope,p_event_id,v_result);

  return v_result;
end;
$$;

revoke execute on function public.world_apply_mutation(text,text,bigint,text,jsonb,text,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.world_apply_mutation(text,text,bigint,text,jsonb,text,uuid,uuid,text) to service_role;
comment on function public.world_apply_mutation(text,text,bigint,text,jsonb,text,uuid,uuid,text) is 'Atomic trusted-server world mutation with compact idempotency result and bounded patch/state size.';
