begin;

create table if not exists public.world_environment_history (
  revision bigint primary key check (revision > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  biome text not null check (biome in ('plaza','city','forest','swamp','desert','snow','coast')),
  weather text not null check (weather in ('clear','rain','fog','storm','snow')),
  time_of_day text not null check (time_of_day in ('dawn','day','sunset','night')),
  ambient_density smallint not null check (ambient_density between 0 and 100),
  music_mood text not null check (char_length(music_mood) between 1 and 80),
  accent text not null check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  action text not null default 'publish' check (action in ('bootstrap','publish','rollback')),
  source_revision bigint,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now()
);

insert into public.world_environment_history(
  revision,schema_version,biome,weather,time_of_day,ambient_density,music_mood,accent,action,source_revision,published_by,published_at
)
select revision,schema_version,biome,weather,time_of_day,ambient_density,music_mood,accent,'bootstrap',null,updated_by,updated_at
from public.world_environment_state
where id='global'
on conflict (revision) do nothing;

create or replace function public.publish_world_environment(p_state jsonb, p_expected_revision bigint default null)
returns public.world_environment_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_current public.world_environment_state;
  v_row public.world_environment_state;
  v_biome text := coalesce(nullif(trim(p_state->>'biome'),''),'plaza');
  v_weather text := coalesce(nullif(trim(p_state->>'weather'),''),'clear');
  v_time text := coalesce(nullif(trim(p_state->>'timeOfDay'),''),nullif(trim(p_state->>'time_of_day'),''),'day');
  v_density integer := coalesce((p_state->>'ambientDensity')::integer,(p_state->>'ambient_density')::integer,50);
  v_mood text := coalesce(nullif(trim(p_state->>'musicMood'),''),nullif(trim(p_state->>'music_mood'),''),'calm');
  v_accent text := coalesce(nullif(trim(p_state->>'accent'),''),'#c9a55f');
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (kelo_private.has_role('admin') or kelo_private.has_role('official')) then raise exception 'WORLD_ENVIRONMENT_PUBLISH_FORBIDDEN'; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then raise exception 'ENVIRONMENT_STATE_OBJECT_REQUIRED'; end if;
  if v_biome not in ('plaza','city','forest','swamp','desert','snow','coast') then raise exception 'INVALID_ENVIRONMENT_BIOME'; end if;
  if v_weather not in ('clear','rain','fog','storm','snow') then raise exception 'INVALID_ENVIRONMENT_WEATHER'; end if;
  if v_time not in ('dawn','day','sunset','night') then raise exception 'INVALID_ENVIRONMENT_TIME'; end if;
  if v_density < 0 or v_density > 100 then raise exception 'INVALID_ENVIRONMENT_DENSITY'; end if;
  if char_length(v_mood) < 1 or char_length(v_mood) > 80 then raise exception 'INVALID_ENVIRONMENT_MOOD'; end if;
  if v_accent !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'INVALID_ENVIRONMENT_ACCENT'; end if;

  select * into v_current from public.world_environment_state where id='global' for update;
  if v_current.id is null then raise exception 'WORLD_ENVIRONMENT_STATE_MISSING'; end if;
  if p_expected_revision is not null and p_expected_revision <> v_current.revision then
    raise exception 'ENVIRONMENT_REVISION_CONFLICT expected=% actual=%', p_expected_revision, v_current.revision;
  end if;

  update public.world_environment_state
     set revision = v_current.revision + 1,
         schema_version = 1,
         biome = v_biome,
         weather = v_weather,
         time_of_day = v_time,
         ambient_density = v_density,
         music_mood = v_mood,
         accent = lower(v_accent),
         updated_by = v_uid,
         updated_at = now()
   where id='global'
   returning * into v_row;

  insert into public.world_environment_history(
    revision,schema_version,biome,weather,time_of_day,ambient_density,music_mood,accent,action,source_revision,published_by,published_at
  ) values (
    v_row.revision,v_row.schema_version,v_row.biome,v_row.weather,v_row.time_of_day,v_row.ambient_density,v_row.music_mood,v_row.accent,'publish',v_current.revision,v_row.updated_by,v_row.updated_at
  );

  perform realtime.send(
    jsonb_build_object(
      'id',v_row.id,
      'revision',v_row.revision,
      'schemaVersion',v_row.schema_version,
      'action','publish',
      'sourceRevision',v_current.revision,
      'state',jsonb_build_object(
        'biome',v_row.biome,
        'weather',v_row.weather,
        'timeOfDay',v_row.time_of_day,
        'ambientDensity',v_row.ambient_density,
        'musicMood',v_row.music_mood,
        'accent',v_row.accent
      ),
      'updatedAt',v_row.updated_at,
      'updatedBy',v_row.updated_by
    ),
    'environment_changed',
    'world:environment',
    false
  );

  return v_row;
end;
$$;

create or replace function public.rollback_world_environment(p_target_revision bigint, p_expected_revision bigint default null)
returns public.world_environment_state
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_current public.world_environment_state;
  v_target public.world_environment_history;
  v_row public.world_environment_state;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (kelo_private.has_role('admin') or kelo_private.has_role('official')) then raise exception 'WORLD_ENVIRONMENT_ROLLBACK_FORBIDDEN'; end if;
  if p_target_revision is null or p_target_revision < 1 then raise exception 'INVALID_TARGET_REVISION'; end if;

  select * into v_current from public.world_environment_state where id='global' for update;
  if v_current.id is null then raise exception 'WORLD_ENVIRONMENT_STATE_MISSING'; end if;
  if p_expected_revision is not null and p_expected_revision <> v_current.revision then
    raise exception 'ENVIRONMENT_REVISION_CONFLICT expected=% actual=%', p_expected_revision, v_current.revision;
  end if;
  if p_target_revision >= v_current.revision then raise exception 'ROLLBACK_TARGET_MUST_BE_OLDER'; end if;

  select * into v_target from public.world_environment_history where revision=p_target_revision;
  if v_target.revision is null then raise exception 'ENVIRONMENT_HISTORY_REVISION_NOT_FOUND'; end if;

  update public.world_environment_state
     set revision = v_current.revision + 1,
         schema_version = v_target.schema_version,
         biome = v_target.biome,
         weather = v_target.weather,
         time_of_day = v_target.time_of_day,
         ambient_density = v_target.ambient_density,
         music_mood = v_target.music_mood,
         accent = v_target.accent,
         updated_by = v_uid,
         updated_at = now()
   where id='global'
   returning * into v_row;

  insert into public.world_environment_history(
    revision,schema_version,biome,weather,time_of_day,ambient_density,music_mood,accent,action,source_revision,published_by,published_at
  ) values (
    v_row.revision,v_row.schema_version,v_row.biome,v_row.weather,v_row.time_of_day,v_row.ambient_density,v_row.music_mood,v_row.accent,'rollback',p_target_revision,v_row.updated_by,v_row.updated_at
  );

  perform realtime.send(
    jsonb_build_object(
      'id',v_row.id,
      'revision',v_row.revision,
      'schemaVersion',v_row.schema_version,
      'action','rollback',
      'sourceRevision',p_target_revision,
      'state',jsonb_build_object(
        'biome',v_row.biome,
        'weather',v_row.weather,
        'timeOfDay',v_row.time_of_day,
        'ambientDensity',v_row.ambient_density,
        'musicMood',v_row.music_mood,
        'accent',v_row.accent
      ),
      'updatedAt',v_row.updated_at,
      'updatedBy',v_row.updated_by
    ),
    'environment_changed',
    'world:environment',
    false
  );

  return v_row;
end;
$$;

revoke all on public.world_environment_history from anon, authenticated;
alter table public.world_environment_history enable row level security;

revoke all on function public.rollback_world_environment(bigint,bigint) from public, anon;
grant execute on function public.rollback_world_environment(bigint,bigint) to authenticated, service_role;

comment on table public.world_environment_history is 'Immutable revision history for global environment state. Rollbacks create a new monotonic revision rather than rewinding the revision counter.';
comment on function public.rollback_world_environment(bigint,bigint) is 'Role-gated CAS rollback to an older environment snapshot. Emits the same Realtime environment_changed broadcast as normal publishing.';

commit;
