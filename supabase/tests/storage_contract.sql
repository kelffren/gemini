-- Kelo World Storage security/immutability contract.
-- Read-only assertions; safe to run against production.

do $$
declare
  bad_count integer;
begin
  -- 1) Bucket exposure and upload limits are deliberate.
  if not exists (
    select 1 from storage.buckets
    where id='avatars' and public=true and file_size_limit=2097152
      and allowed_mime_types @> array['image/png','image/webp','image/jpeg']::text[]
  ) then raise exception 'STORAGE_CONTRACT: avatars bucket configuration changed'; end if;

  if not exists (
    select 1 from storage.buckets
    where id='creator-private' and public=false and file_size_limit=5242880
      and allowed_mime_types @> array['image/png','image/webp','image/jpeg']::text[]
  ) then raise exception 'STORAGE_CONTRACT: creator-private bucket configuration changed'; end if;

  if not exists (
    select 1 from storage.buckets
    where id='creator-global' and public=true and file_size_limit=5242880
      and allowed_mime_types @> array['image/png','image/webp','image/jpeg']::text[]
  ) then raise exception 'STORAGE_CONTRACT: creator-global bucket configuration changed'; end if;

  -- 2) Runtime avatar bytes are append-only after upload. The client uses
  -- content-addressed paths with upsert=false, so authenticated UPDATE is not needed.
  if exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='avatars_update_own'
  ) then raise exception 'STORAGE_CONTRACT: avatars_update_own reopened mutable avatar bytes'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='avatars_delete_own' and cmd='DELETE'
      and 'authenticated'=any(roles)
      and qual like '%content_definition_revisions%'
  ) then raise exception 'STORAGE_CONTRACT: referenced-avatar delete guard missing'; end if;

  -- 3) Creator source bytes back immutable asset revisions and review previews.
  if not exists (
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname='creator_private_delete_own' and cmd='DELETE'
      and 'authenticated'=any(roles)
      and qual like '%asset_revisions%'
  ) then raise exception 'STORAGE_CONTRACT: registered creator-private delete guard missing'; end if;

  -- 4) Character revisions that carry avatarRuntime must be guarded at write time.
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='content_definition_revisions'
      and t.tgname='content_revision_avatar_runtime_guard'
      and not t.tgisinternal and t.tgenabled <> 'D'
  ) then raise exception 'STORAGE_CONTRACT: avatar runtime validation trigger missing'; end if;

  if to_regprocedure('kelo_private.is_valid_avatar_runtime(uuid,jsonb)') is null then
    raise exception 'STORAGE_CONTRACT: avatar runtime validator missing';
  end if;

  -- 5) Existing avatar revisions must remain owner-scoped, content-addressed,
  -- and backed by a real Storage object owned by the same account.
  select count(*) into bad_count
  from public.content_definition_revisions r
  join public.content_definitions d on d.id=r.definition_id
  where d.content_type='character'
    and r.payload ? 'avatarRuntime'
    and not (
      r.payload->'avatarRuntime'->>'bucket'='avatars'
      and split_part(r.payload->'avatarRuntime'->>'path','/',1)=r.owner_user_id::text
      and split_part(r.payload->'avatarRuntime'->>'path','/',2)='characters'
      and lower(coalesce(r.payload->'avatarRuntime'->>'runtimeHash','')) ~ '^[0-9a-f]{32,128}$'
      and split_part(r.payload->'avatarRuntime'->>'path','/',3) in (
        left(lower(r.payload->'avatarRuntime'->>'runtimeHash'),24)||'.png',
        left(lower(r.payload->'avatarRuntime'->>'runtimeHash'),24)||'.webp'
      )
      and exists (
        select 1 from storage.objects o
        where o.bucket_id='avatars'
          and o.name=r.payload->'avatarRuntime'->>'path'
          and o.owner_id=r.owner_user_id::text
      )
    );
  if bad_count <> 0 then
    raise exception 'STORAGE_CONTRACT: % invalid character avatar runtime revisions', bad_count;
  end if;

  -- 6) Every registered creator-private asset revision must still have its bytes.
  select count(*) into bad_count
  from public.asset_revisions ar
  where ar.storage_bucket='creator-private'
    and not exists (
      select 1 from storage.objects o
      where o.bucket_id=ar.storage_bucket and o.name=ar.storage_path
    );
  if bad_count <> 0 then
    raise exception 'STORAGE_CONTRACT: % registered asset revisions have missing private bytes', bad_count;
  end if;
end
$$;

select 'kelo_world_storage_contract_ok' as result;
