begin;

create or replace function kelo_private.is_valid_avatar_runtime(p_owner uuid, p_payload jsonb)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    p_owner is not null
    and jsonb_typeof(coalesce(p_payload->'avatarRuntime','{}'::jsonb)) = 'object'
    and coalesce(p_payload->'avatarRuntime'->>'bucket','') = 'avatars'
    and coalesce(p_payload->'avatarRuntime'->>'path','') <> ''
    and split_part(p_payload->'avatarRuntime'->>'path','/',1) = p_owner::text
    and split_part(p_payload->'avatarRuntime'->>'path','/',2) = 'characters'
    and lower(coalesce(p_payload->'avatarRuntime'->>'runtimeHash','')) ~ '^[0-9a-f]{32,128}$'
    and split_part(p_payload->'avatarRuntime'->>'path','/',3) in (
      left(lower(p_payload->'avatarRuntime'->>'runtimeHash'),24) || '.png',
      left(lower(p_payload->'avatarRuntime'->>'runtimeHash'),24) || '.webp'
    )
    and exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'avatars'
        and o.name = p_payload->'avatarRuntime'->>'path'
        and o.owner_id = p_owner::text
    );
$$;
revoke all on function kelo_private.is_valid_avatar_runtime(uuid,jsonb) from public,anon;
grant execute on function kelo_private.is_valid_avatar_runtime(uuid,jsonb) to authenticated,service_role;

create or replace function kelo_private.guard_character_avatar_runtime()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_type text;
begin
  select d.content_type into v_type
  from public.content_definitions d
  where d.id = new.definition_id;

  if v_type = 'character' and new.payload ? 'avatarRuntime' then
    if not kelo_private.is_valid_avatar_runtime(new.owner_user_id,new.payload) then
      raise exception 'INVALID_CHARACTER_AVATAR_RUNTIME';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function kelo_private.guard_character_avatar_runtime() from public,anon,authenticated;
grant execute on function kelo_private.guard_character_avatar_runtime() to service_role;

drop trigger if exists content_revision_avatar_runtime_guard on public.content_definition_revisions;
create trigger content_revision_avatar_runtime_guard
before insert or update of definition_id, owner_user_id, payload
on public.content_definition_revisions
for each row execute function kelo_private.guard_character_avatar_runtime();

create index if not exists content_revisions_avatar_runtime_path_idx
on public.content_definition_revisions ((payload->'avatarRuntime'->>'path'))
where payload ? 'avatarRuntime';

create or replace function public.set_active_character_avatar(p_character_id uuid, p_content_id text)
returns public.characters
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.characters;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_content_id is not null and not exists(
    select 1
    from public.content_definition_revisions r
    join public.content_definitions d on d.id = r.definition_id
    where r.content_id = p_content_id
      and d.content_type = 'character'
      and r.owner_user_id = v_uid
      and kelo_private.is_valid_avatar_runtime(v_uid,r.payload)
  ) then raise exception 'AVATAR_CONTENT_NOT_OWNED_OR_INVALID'; end if;

  update public.characters
     set active_avatar_content_id = p_content_id,
         updated_at = now()
   where id = p_character_id
     and account_id = v_uid
     and status = 'active'
  returning * into v_row;

  if v_row.id is null then raise exception 'CHARACTER_NOT_FOUND'; end if;
  return v_row;
end;
$$;
revoke all on function public.set_active_character_avatar(uuid,text) from public, anon;
grant execute on function public.set_active_character_avatar(uuid,text) to authenticated, service_role;

-- Runtime avatar paths are content-addressed and uploaded with upsert=false.
-- They must never be overwritten after registration.
drop policy if exists avatars_update_own on storage.objects;

-- Owners may delete only avatar bytes that are not referenced by any immutable
-- content revision. Referenced or active avatar bytes become append-only.
drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id='avatars'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists (
    select 1
    from public.content_definition_revisions r
    where r.owner_user_id=(select auth.uid())
      and r.payload->'avatarRuntime'->>'bucket'='avatars'
      and r.payload->'avatarRuntime'->>'path'=name
  )
);

-- Creator source bytes back immutable asset revisions and ApprovalRequest previews.
-- Allow cleanup only before a path has been registered as a revision.
drop policy if exists creator_private_delete_own on storage.objects;
create policy creator_private_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id='creator-private'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists (
    select 1
    from public.asset_revisions ar
    where ar.owner_user_id=(select auth.uid())
      and ar.storage_bucket='creator-private'
      and ar.storage_path=name
  )
);

comment on function kelo_private.is_valid_avatar_runtime(uuid,jsonb) is 'Validates that a character avatar runtime points to an existing owner-scoped, content-addressed avatars object.';
comment on function kelo_private.guard_character_avatar_runtime() is 'Prevents character content revisions from referencing foreign or non-existent avatar Storage objects.';

commit;
