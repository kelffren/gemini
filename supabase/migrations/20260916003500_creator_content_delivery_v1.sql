begin;

-- Public Creator Content Delivery V1
-- The browser receives only a published, immutable revision manifest after exact-revision access is proven.
-- Asset bytes remain in the existing authority-published creator-global bucket; a public URL is transport, not a license.
create or replace function public.get_creator_content_delivery(p_revision_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_revision public.content_definition_revisions;
  v_definition public.content_definitions;
  v_publication public.content_publications;
  v_access_reason text;
  v_license_key text;
  v_binding_count integer := 0;
  v_published_count integer := 0;
  v_assets jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_revision_id is null then raise exception 'REVISION_REQUIRED'; end if;

  select * into v_revision
  from public.content_definition_revisions r
  where r.id = p_revision_id;
  if v_revision.id is null then raise exception 'CONTENT_REVISION_NOT_FOUND'; end if;

  if v_revision.owner_user_id = v_uid then
    v_access_reason := 'creator_owner';
    v_license_key := 'creator-owner';
  else
    select e.license_key into v_license_key
    from public.creator_content_entitlements e
    where e.buyer_user_id = v_uid and e.revision_id = p_revision_id;
    if v_license_key is null then raise exception 'ENTITLEMENT_REQUIRED'; end if;
    v_access_reason := 'entitlement';
  end if;

  select * into v_publication
  from public.content_publications p
  where p.revision_id = p_revision_id and p.is_active = true;
  if v_publication.id is null then raise exception 'CONTENT_NOT_PUBLISHED_FOR_DELIVERY'; end if;

  select * into v_definition
  from public.content_definitions d
  where d.id = v_revision.definition_id;
  if v_definition.id is null then raise exception 'CONTENT_DEFINITION_NOT_FOUND'; end if;

  select count(*) into v_binding_count
  from public.content_asset_bindings b
  where b.content_revision_id = p_revision_id;

  select count(*) into v_published_count
  from public.content_asset_bindings b
  join public.asset_publications ap on ap.revision_id = b.asset_revision_id and ap.is_active = true
  where b.content_revision_id = p_revision_id;

  if v_published_count <> v_binding_count then raise exception 'CONTENT_ASSET_PUBLICATION_INCOMPLETE'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'role', b.role,
    'ordinal', b.ordinal,
    'bindingMetadata', b.metadata,
    'assetRevisionId', ar.id,
    'assetId', ar.asset_id,
    'contentHash', ar.content_hash,
    'mimeType', ar.mime_type,
    'byteSize', ar.byte_size,
    'pixelWidth', ar.pixel_width,
    'pixelHeight', ar.pixel_height,
    'worldWidth', ar.world_width,
    'worldHeight', ar.world_height,
    'collisionMode', ar.collision_mode,
    'renderPhase', ar.render_phase,
    'metadata', ar.metadata,
    'publicStorageBucket', ap.public_storage_bucket,
    'publicStoragePath', ap.public_storage_path,
    'assetVisibility', ap.visibility,
    'assetPublishedAt', ap.published_at
  ) order by b.ordinal, b.role), '[]'::jsonb) into v_assets
  from public.content_asset_bindings b
  join public.asset_revisions ar on ar.id = b.asset_revision_id
  join public.asset_publications ap on ap.revision_id = ar.id and ap.is_active = true
  where b.content_revision_id = p_revision_id;

  return jsonb_build_object(
    'revisionId', v_revision.id,
    'definitionId', v_revision.definition_id,
    'ownerUserId', v_revision.owner_user_id,
    'contentId', v_revision.content_id,
    'stableKey', v_definition.stable_key,
    'revision', v_revision.revision,
    'schemaVersion', v_revision.schema_version,
    'contentHash', v_revision.content_hash,
    'contentType', v_definition.content_type,
    'displayName', v_definition.display_name,
    'tags', v_definition.tags,
    'payload', v_revision.payload,
    'publicationId', v_publication.id,
    'visibility', v_publication.visibility,
    'publishedAt', v_publication.published_at,
    'accessReason', v_access_reason,
    'licenseKey', v_license_key,
    'assets', v_assets
  );
end;
$$;
revoke all on function public.get_creator_content_delivery(uuid) from public, anon;
grant execute on function public.get_creator_content_delivery(uuid) to authenticated, service_role;

-- Existing local avatar selection becomes entitlement-aware. The server, not the UI, decides whether the account may use the exact immutable character revision.
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
      and coalesce(r.payload->'avatarRuntime'->>'bucket','') <> ''
      and char_length(coalesce(r.payload->'avatarRuntime'->>'path','')) > 3
      and (
        r.owner_user_id = v_uid
        or (
          exists(select 1 from public.creator_content_entitlements e where e.buyer_user_id = v_uid and e.revision_id = r.id)
          and exists(select 1 from public.content_publications cp where cp.revision_id = r.id and cp.is_active = true)
        )
      )
  ) then raise exception 'AVATAR_CONTENT_NOT_OWNED_OR_ENTITLED'; end if;

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

-- Remote clients may still render a globally published avatar, but the manifest now carries immutable revision identity so local selection can enforce entitlement.
create or replace function public.get_avatar_manifest(p_content_id text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text := coalesce((select auth.role()), 'anon');
  v_row jsonb;
begin
  select jsonb_build_object(
    'revisionId', r.id,
    'ownerUserId', r.owner_user_id,
    'contentId', r.content_id,
    'revision', r.revision,
    'displayName', d.display_name,
    'stableKey', d.stable_key,
    'payload', r.payload,
    'contentHash', r.content_hash,
    'source', 'creator-content'
  ) into v_row
  from public.content_definition_revisions r
  join public.content_definitions d on d.id = r.definition_id
  where r.content_id = p_content_id
    and d.content_type = 'character'
    and (
      v_role = 'service_role'
      or r.owner_user_id = v_uid
      or exists(select 1 from public.content_publications p where p.revision_id = r.id and p.is_active = true)
    )
  limit 1;
  return v_row;
end;
$$;
revoke all on function public.get_avatar_manifest(text) from public, anon;
grant execute on function public.get_avatar_manifest(text) to authenticated, service_role;

comment on function public.get_creator_content_delivery(uuid) is 'Entitlement-gated metadata manifest for one immutable published Creator revision. Returns published asset locations only; no private storage paths.';
comment on function public.set_active_character_avatar(uuid,text) is 'Server-authoritative exact-revision character selection; creator-owned or entitled published Creator character content only.';

commit;