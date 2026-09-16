begin;

create table if not exists public.character_community_equipment (
  character_id uuid not null references public.characters(id) on delete cascade,
  slot text not null check (slot in ('body','outfit','head','hair','face','weapon','offhand','back','aura','pet','mount','effect')),
  publication_id uuid not null references public.asset_publications(id) on delete restrict,
  equipped_by uuid not null references auth.users(id) on delete cascade,
  equipped_at timestamptz not null default now(),
  primary key (character_id, slot)
);

create index if not exists character_community_equipment_publication_idx
  on public.character_community_equipment(publication_id);
create index if not exists character_community_equipment_user_idx
  on public.character_community_equipment(equipped_by, equipped_at desc);

alter table public.character_community_equipment enable row level security;
revoke all on public.character_community_equipment from public, anon, authenticated;
grant select, insert, update, delete on public.character_community_equipment to authenticated;

drop policy if exists character_community_equipment_owner_read on public.character_community_equipment;
create policy character_community_equipment_owner_read
on public.character_community_equipment
for select to authenticated
using (
  (select auth.uid()) is not null
  and equipped_by = (select auth.uid())
  and exists (
    select 1
    from public.characters c
    where c.id = character_community_equipment.character_id
      and c.account_id = (select auth.uid())
      and c.status = 'active'
  )
);

drop policy if exists character_community_equipment_owner_insert on public.character_community_equipment;
create policy character_community_equipment_owner_insert
on public.character_community_equipment
for insert to authenticated
with check (
  (select auth.uid()) is not null
  and equipped_by = (select auth.uid())
  and exists (
    select 1 from public.characters c
    where c.id = character_community_equipment.character_id
      and c.account_id = (select auth.uid())
      and c.status = 'active'
  )
  and exists (
    select 1 from public.asset_publications ap
    where ap.id = character_community_equipment.publication_id
      and ap.is_active = true
      and ap.visibility in ('global','official')
  )
);

drop policy if exists character_community_equipment_owner_update on public.character_community_equipment;
create policy character_community_equipment_owner_update
on public.character_community_equipment
for update to authenticated
using (
  (select auth.uid()) is not null
  and equipped_by = (select auth.uid())
  and exists (
    select 1 from public.characters c
    where c.id = character_community_equipment.character_id
      and c.account_id = (select auth.uid())
      and c.status = 'active'
  )
)
with check (
  equipped_by = (select auth.uid())
  and exists (
    select 1 from public.characters c
    where c.id = character_community_equipment.character_id
      and c.account_id = (select auth.uid())
      and c.status = 'active'
  )
  and exists (
    select 1 from public.asset_publications ap
    where ap.id = character_community_equipment.publication_id
      and ap.is_active = true
      and ap.visibility in ('global','official')
  )
);

drop policy if exists character_community_equipment_owner_delete on public.character_community_equipment;
create policy character_community_equipment_owner_delete
on public.character_community_equipment
for delete to authenticated
using (
  (select auth.uid()) is not null
  and equipped_by = (select auth.uid())
  and exists (
    select 1 from public.characters c
    where c.id = character_community_equipment.character_id
      and c.account_id = (select auth.uid())
      and c.status = 'active'
  )
);

create or replace function public.equip_character_community_asset(
  p_character_id uuid,
  p_slot text,
  p_publication_id uuid
)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_slot text := lower(trim(coalesce(p_slot,'')));
  v_asset_id text;
  v_revision integer;
  v_hash text;
  v_kind text;
  v_public_path text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_slot not in ('body','outfit','head','hair','face','weapon','offhand','back','aura','pet','mount','effect') then
    raise exception 'COMMUNITY_ASSET_SLOT_INVALID';
  end if;

  if not exists(
    select 1 from public.characters c
    where c.id = p_character_id
      and c.account_id = v_uid
      and c.status = 'active'
  ) then raise exception 'CHARACTER_NOT_FOUND'; end if;

  select ar.asset_id, ar.revision, ar.content_hash, af.kind, ap.public_storage_path
    into v_asset_id, v_revision, v_hash, v_kind, v_public_path
  from public.asset_publications ap
  join public.asset_revisions ar on ar.id = ap.revision_id
  join public.asset_families af on af.id = ar.family_id
  where ap.id = p_publication_id
    and ap.is_active = true
    and ap.visibility in ('global','official')
    and ar.mime_type in ('image/png','image/webp','image/jpeg')
  limit 1;

  if v_asset_id is null then raise exception 'COMMUNITY_ASSET_PUBLICATION_NOT_ACTIVE'; end if;
  if v_kind in ('tile','ui','audio') then raise exception 'COMMUNITY_ASSET_NOT_EQUIPPABLE'; end if;

  insert into public.character_community_equipment(character_id,slot,publication_id,equipped_by,equipped_at)
  values (p_character_id,v_slot,p_publication_id,v_uid,now())
  on conflict (character_id,slot) do update set
    publication_id = excluded.publication_id,
    equipped_by = excluded.equipped_by,
    equipped_at = excluded.equipped_at;

  return jsonb_build_object(
    'ok',true,
    'characterId',p_character_id,
    'slot',v_slot,
    'publicationId',p_publication_id,
    'assetId',v_asset_id,
    'revision',v_revision,
    'sha256',v_hash,
    'kind',v_kind,
    'publicStoragePath',v_public_path
  );
end;
$$;
revoke all on function public.equip_character_community_asset(uuid,text,uuid) from public, anon;
grant execute on function public.equip_character_community_asset(uuid,text,uuid) to authenticated;

create or replace function public.unequip_character_community_asset(
  p_character_id uuid,
  p_slot text
)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_slot text := lower(trim(coalesce(p_slot,'')));
  v_removed integer := 0;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_slot not in ('body','outfit','head','hair','face','weapon','offhand','back','aura','pet','mount','effect') then
    raise exception 'COMMUNITY_ASSET_SLOT_INVALID';
  end if;
  if not exists(
    select 1 from public.characters c
    where c.id = p_character_id
      and c.account_id = v_uid
      and c.status = 'active'
  ) then raise exception 'CHARACTER_NOT_FOUND'; end if;

  delete from public.character_community_equipment e
  where e.character_id = p_character_id and e.slot = v_slot;
  get diagnostics v_removed = row_count;
  return jsonb_build_object('ok',true,'characterId',p_character_id,'slot',v_slot,'removed',v_removed > 0);
end;
$$;
revoke all on function public.unequip_character_community_asset(uuid,text) from public, anon;
grant execute on function public.unequip_character_community_asset(uuid,text) to authenticated;

create or replace function public.get_character_avatar_manifest(p_character_id uuid)
returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_content_id text;
  v_assets jsonb := '[]'::jsonb;
  v_row jsonb;
begin
  if v_uid is null then return null; end if;

  select c.active_avatar_content_id into v_content_id
  from public.characters c
  where c.id = p_character_id
    and c.status = 'active'
    and c.account_id = v_uid
  limit 1;

  if v_content_id is null then return null; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'schema','kelo.community-asset.v1',
      'slot',e.slot,
      'assetId',ar.asset_id,
      'id',ar.asset_id,
      'version',ar.revision,
      'revisionId',ar.id,
      'publicationId',ap.id,
      'bucket','creator-global',
      'publicStoragePath',ap.public_storage_path,
      'mime',ar.mime_type,
      'bytes',ar.byte_size,
      'width',ar.pixel_width,
      'height',ar.pixel_height,
      'sha256',ar.content_hash,
      'type',af.kind,
      'moderation','server-verified'
    ) order by e.slot
  ), '[]'::jsonb) into v_assets
  from public.character_community_equipment e
  join public.asset_publications ap on ap.id = e.publication_id and ap.is_active = true
  join public.asset_revisions ar on ar.id = ap.revision_id
  join public.asset_families af on af.id = ar.family_id
  where e.character_id = p_character_id;

  select jsonb_build_object(
    'contentId', cr.content_id,
    'revision', cr.revision,
    'displayName', cd.display_name,
    'stableKey', cd.stable_key,
    'payload', cr.payload || jsonb_build_object('communityAssets',v_assets),
    'contentHash', cr.content_hash
  ) into v_row
  from public.content_definition_revisions cr
  join public.content_definitions cd on cd.id = cr.definition_id
  where cr.content_id = v_content_id
    and cd.content_type = 'character'
    and cr.owner_user_id = v_uid
  limit 1;

  return v_row;
end;
$$;
revoke all on function public.get_character_avatar_manifest(uuid) from public, anon;
grant execute on function public.get_character_avatar_manifest(uuid) to authenticated;

comment on table public.character_community_equipment is 'Per-character references to active immutable community asset publications. No binary or client URL is stored here.';
comment on function public.equip_character_community_asset(uuid,text,uuid) is 'RLS-protected owner cosmetic equip by active publication id; replaces one slot atomically.';
comment on function public.get_character_avatar_manifest(uuid) is 'RLS-protected avatar manifest plus active community cosmetic references for one owned character.';

commit;
