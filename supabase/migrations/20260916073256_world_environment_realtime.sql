begin;

create table if not exists public.world_environment_state (
  id text primary key,
  revision bigint not null default 1 check (revision > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  biome text not null default 'plaza' check (biome in ('plaza','city','forest','swamp','desert','snow','coast')),
  weather text not null default 'clear' check (weather in ('clear','rain','fog','storm','snow')),
  time_of_day text not null default 'day' check (time_of_day in ('dawn','day','sunset','night')),
  ambient_density smallint not null default 50 check (ambient_density between 0 and 100),
  music_mood text not null default 'calm' check (char_length(music_mood) between 1 and 80),
  accent text not null default '#c9a55f' check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint world_environment_singleton check (id = 'global')
);

insert into public.world_environment_state(id)
values ('global')
on conflict (id) do nothing;

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

  perform realtime.send(
    jsonb_build_object(
      'id',v_row.id,
      'revision',v_row.revision,
      'schemaVersion',v_row.schema_version,
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

revoke all on function public.publish_world_environment(jsonb,bigint) from public, anon;
grant execute on function public.publish_world_environment(jsonb,bigint) to authenticated, service_role;

alter table public.world_environment_state enable row level security;
revoke all on public.world_environment_state from anon, authenticated;
grant select on public.world_environment_state to anon, authenticated;

drop policy if exists world_environment_public_read on public.world_environment_state;
create policy world_environment_public_read on public.world_environment_state
for select to anon, authenticated using (id='global');

comment on table public.world_environment_state is 'Canonical singleton environment state seen by all Kelo World clients. Writes only through role-gated publish_world_environment RPC.';
comment on function public.publish_world_environment(jsonb,bigint) is 'Publishes one globally synchronized environment revision and broadcasts it over Supabase Realtime.';

commit;
