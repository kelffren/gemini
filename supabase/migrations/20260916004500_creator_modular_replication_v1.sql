begin;

-- Creator Modular Appearance Replication V1
-- Returns only the authenticated character's CURRENT server-authorized modular Creator visuals.
-- The result is presentation metadata for replication; it is not ownership proof for viewers.
create or replace function public.get_my_public_creator_character_appearance(p_character_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_loadout jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_character_id is null then raise exception 'CHARACTER_REQUIRED'; end if;
  if not exists(
    select 1 from public.characters c
    where c.id=p_character_id and c.account_id=v_uid and c.status='active'
  ) then raise exception 'CHARACTER_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'slotKey', b.slot_key,
    'bindingKind', b.binding_kind,
    'revisionId', r.id,
    'contentId', r.content_id,
    'stableKey', d.stable_key,
    'revision', r.revision,
    'contentHash', r.content_hash,
    'contentType', d.content_type,
    'displayName', d.display_name,
    'tags', d.tags,
    'payload', r.payload,
    'asset', asset.public_asset
  ) order by b.slot_key), '[]'::jsonb)
  into v_loadout
  from public.creator_character_content_bindings b
  join public.content_definition_revisions r on r.id=b.revision_id
  join public.content_definitions d on d.id=r.definition_id
  join lateral (
    select jsonb_build_object(
      'role', cab.role,
      'ordinal', cab.ordinal,
      'assetRevisionId', ar.id,
      'assetId', ar.asset_id,
      'contentHash', ar.content_hash,
      'mimeType', ar.mime_type,
      'byteSize', ar.byte_size,
      'pixelWidth', ar.pixel_width,
      'pixelHeight', ar.pixel_height,
      'worldWidth', ar.world_width,
      'worldHeight', ar.world_height,
      'metadata', ar.metadata,
      'publicStorageBucket', ap.public_storage_bucket,
      'publicStoragePath', ap.public_storage_path,
      'assetVisibility', ap.visibility,
      'assetPublishedAt', ap.published_at
    ) as public_asset
    from public.content_asset_bindings cab
    join public.asset_revisions ar on ar.id=cab.asset_revision_id
    join public.asset_publications ap on ap.revision_id=ar.id and ap.is_active=true
    where cab.content_revision_id=r.id
    order by case when cab.role='primary' then 0 else 1 end, cab.ordinal, cab.role
    limit 1
  ) asset on true
  where b.character_id=p_character_id
    and d.content_type in ('appearance','equipment')
    and b.binding_kind=d.content_type
    and coalesce(nullif(trim(r.payload->>'slotId'),''),nullif(trim(r.payload->>'slot'),''))=b.slot_key
    and lower(coalesce(nullif(trim(r.payload->>'targetType'),''),'character')) in ('character','player')
    and exists(select 1 from public.content_publications cp where cp.revision_id=r.id and cp.is_active=true)
    and (
      r.owner_user_id=v_uid
      or exists(select 1 from public.creator_content_entitlements e where e.buyer_user_id=v_uid and e.revision_id=r.id)
    )
    and exists(select 1 from public.content_asset_bindings any_asset where any_asset.content_revision_id=r.id)
    and not exists(
      select 1
      from public.content_asset_bindings missing
      where missing.content_revision_id=r.id
        and not exists(
          select 1 from public.asset_publications ap2
          where ap2.revision_id=missing.asset_revision_id and ap2.is_active=true
        )
    );

  return jsonb_build_object(
    'characterId', p_character_id,
    'source', 'server-authoritative-published',
    'loadout', v_loadout
  );
end;
$$;

revoke all on function public.get_my_public_creator_character_appearance(uuid) from public, anon;
grant execute on function public.get_my_public_creator_character_appearance(uuid) to authenticated, service_role;

comment on function public.get_my_public_creator_character_appearance(uuid) is
  'Presentation-only snapshot of the caller character current published Creator appearance/equipment bindings. Viewers receive this only through the authoritative game server; it does not grant ownership or use rights.';

commit;
