begin;

create or replace function public.list_world_environment_history(p_limit integer default 10)
returns table(
  revision bigint,
  schema_version integer,
  biome text,
  weather text,
  time_of_day text,
  ambient_density smallint,
  music_mood text,
  accent text,
  action text,
  source_revision bigint,
  published_by uuid,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_limit integer := greatest(1,least(coalesce(p_limit,10),25));
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (kelo_private.has_role('admin') or kelo_private.has_role('official')) then raise exception 'WORLD_ENVIRONMENT_HISTORY_FORBIDDEN'; end if;

  return query
  select h.revision,h.schema_version,h.biome,h.weather,h.time_of_day,h.ambient_density,h.music_mood,h.accent,h.action,h.source_revision,h.published_by,h.published_at
  from public.world_environment_history h
  order by h.revision desc
  limit v_limit;
end;
$$;

revoke all on function public.list_world_environment_history(integer) from public, anon;
grant execute on function public.list_world_environment_history(integer) to authenticated, service_role;

comment on function public.list_world_environment_history(integer) is 'Admin/official-only bounded read of immutable global environment revision history for Creator rollback UI.';

commit;
