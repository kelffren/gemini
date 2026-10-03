create table if not exists public.world_cell_snapshots (
  cell_id text primary key,
  revision bigint not null default 0 check (revision >= 0),
  schema_version integer not null default 1 check (schema_version > 0),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  last_event_id text,
  updated_at timestamptz not null default now(),
  constraint world_cell_snapshots_cell_id_format check (cell_id ~ '^[A-Za-z0-9_-]{1,48}:-?[0-9]{1,8}:-?[0-9]{1,8}$')
);

create table if not exists public.world_event_ledger (
  id bigint generated always as identity primary key,
  event_id text not null unique,
  cell_id text not null references public.world_cell_snapshots(cell_id) on delete restrict,
  revision bigint not null check (revision > 0),
  aggregate_id text not null default 'world',
  event_type text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  actor_user_id uuid references auth.users(id) on delete set null,
  character_id uuid references public.characters(id) on delete set null,
  request_id text,
  created_at timestamptz not null default now(),
  unique(cell_id, revision),
  constraint world_event_ledger_event_id_format check (event_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
  constraint world_event_ledger_event_type_format check (event_type ~ '^[a-z][a-z0-9_.:-]{0,95}$'),
  constraint world_event_ledger_aggregate_len check (char_length(aggregate_id) between 1 and 128)
);

create index if not exists world_event_ledger_cell_revision_idx on public.world_event_ledger(cell_id, revision);
create index if not exists world_event_ledger_aggregate_idx on public.world_event_ledger(aggregate_id, created_at desc);
create index if not exists world_event_ledger_type_idx on public.world_event_ledger(event_type, created_at desc);

alter table public.world_cell_snapshots enable row level security;
alter table public.world_event_ledger enable row level security;

revoke all on public.world_cell_snapshots, public.world_event_ledger from anon, authenticated;
grant select, insert, update on public.world_cell_snapshots to service_role;
grant select, insert on public.world_event_ledger to service_role;
grant usage, select on sequence public.world_event_ledger_id_seq to service_role;
grant select, insert on public.server_idempotency, public.server_outbox, public.server_audit_events to service_role;

create or replace function public.world_get_snapshot(p_cell_id text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select case when s.cell_id is null then null::jsonb else jsonb_build_object(
    'cellId', s.cell_id,
    'revision', s.revision,
    'schemaVersion', s.schema_version,
    'state', s.state,
    'lastEventId', s.last_event_id,
    'updatedAt', s.updated_at
  ) end
  from (select p_cell_id as requested_cell) q
  left join public.world_cell_snapshots s on s.cell_id=q.requested_cell;
$$;

create or replace function public.world_replay_events(
  p_cell_id text,
  p_after_revision bigint default 0,
  p_limit integer default 500
)
returns table(
  sequence_id bigint,
  event_id text,
  cell_id text,
  revision bigint,
  aggregate_id text,
  event_type text,
  payload jsonb,
  actor_user_id uuid,
  character_id uuid,
  request_id text,
  created_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select e.id,e.event_id,e.cell_id,e.revision,e.aggregate_id,e.event_type,e.payload,e.actor_user_id,e.character_id,e.request_id,e.created_at
  from public.world_event_ledger e
  where e.cell_id=p_cell_id and e.revision > greatest(coalesce(p_after_revision,0),0)
  order by e.revision asc
  limit least(greatest(coalesce(p_limit,500),1),1000);
$$;

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
    'state',v_new_state,
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

revoke execute on function public.world_get_snapshot(text) from public, anon, authenticated;
revoke execute on function public.world_replay_events(text,bigint,integer) from public, anon, authenticated;
revoke execute on function public.world_apply_mutation(text,text,bigint,text,jsonb,text,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.world_get_snapshot(text) to service_role;
grant execute on function public.world_replay_events(text,bigint,integer) to service_role;
grant execute on function public.world_apply_mutation(text,text,bigint,text,jsonb,text,uuid,uuid,text) to service_role;

comment on table public.world_cell_snapshots is 'Durable materialized world state per deterministic cell. Trusted server writes only; revisioned CAS via world_apply_mutation.';
comment on table public.world_event_ledger is 'Append-only durable world mutation ledger. One event per cell revision; service-only writes and replay.';
comment on function public.world_apply_mutation(text,text,bigint,text,jsonb,text,uuid,uuid,text) is 'Atomic trusted-server world mutation: idempotency + revision CAS + event append + snapshot + audit + outbox.';
