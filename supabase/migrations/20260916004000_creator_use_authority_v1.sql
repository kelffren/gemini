begin;

-- Creator Use Authority V1
-- Persistent use of paid Creator content is authorized by exact immutable revision on the server.
-- This layer authorizes Creator-content use; domain owners keep their own gameplay/geometry rules.

create table if not exists public.creator_character_content_bindings (
  character_id uuid not null references public.characters(id) on delete cascade,
  binding_kind text not null check (binding_kind in ('appearance','equipment')),
  slot_key text not null check (slot_key ~ '^[A-Za-z0-9_.:-]{1,64}$'),
  revision_id uuid not null references public.content_definition_revisions(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key(character_id, slot_key)
);
create index if not exists creator_character_content_revision_idx on public.creator_character_content_bindings(revision_id);

create table if not exists public.creator_character_mount_bindings (
  character_id uuid primary key references public.characters(id) on delete cascade,
  revision_id uuid not null references public.content_definition_revisions(id) on delete restrict,
  updated_at timestamptz not null default now()
);
create index if not exists creator_character_mount_revision_idx on public.creator_character_mount_bindings(revision_id);

create table if not exists public.creator_property_use_authorizations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  revision_id uuid not null references public.content_definition_revisions(id) on delete restrict,
  parcel_key text not null check (char_length(parcel_key) between 1 and 160),
  transform jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists creator_property_use_account_idx on public.creator_property_use_authorizations(account_id, created_at desc);
create index if not exists creator_property_use_revision_idx on public.creator_property_use_authorizations(revision_id, created_at desc);

-- One internal rule for every persistent Creator-use mutation.
-- Foreign content requires an exact entitlement; all persistent online use requires an active publication.
create or replace function kelo_private.require_creator_revision_use(
  p_user_id uuid,
  p_revision_id uuid,
  p_allowed_types text[]
)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_revision public.content_definition_revisions;
  v_definition public.content_definitions;
  v_access_reason text;
  v_slot text;
  v_target text;
begin
  if p_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_revision_id is null then raise exception 'REVISION_REQUIRED'; end if;
  if p_allowed_types is null or cardinality(p_allowed_types) < 1 then raise exception 'ALLOWED_TYPES_REQUIRED'; end if;

  select * into v_revision from public.content_definition_revisions where id = p_revision_id;
  if v_revision.id is null then raise exception 'CONTENT_REVISION_NOT_FOUND'; end if;
  select * into v_definition from public.content_definitions where id = v_revision.definition_id;
  if v_definition.id is null then raise exception 'CONTENT_DEFINITION_NOT_FOUND'; end if;
  if not (v_definition.content_type = any(p_allowed_types)) then raise exception 'CREATOR_CONTENT_TYPE_NOT_ALLOWED'; end if;

  if not exists(select 1 from public.content_publications p where p.revision_id=p_revision_id and p.is_active=true) then
    raise exception 'CREATOR_CONTENT_NOT_PUBLISHED';
  end if;

  if v_revision.owner_user_id = p_user_id then
    v_access_reason := 'creator_owner';
  elsif exists(select 1 from public.creator_content_entitlements e where e.buyer_user_id=p_user_id and e.revision_id=p_revision_id) then
    v_access_reason := 'entitlement';
  else
    raise exception 'CREATOR_CONTENT_ACCESS_REQUIRED';
  end if;

  v_slot := nullif(trim(coalesce(v_revision.payload->>'slotId',v_revision.payload->>'slot','')), '');
  v_target := nullif(trim(coalesce(v_revision.payload->>'targetType','')), '');
  return jsonb_build_object(
    'revisionId',v_revision.id,
    'contentId',v_revision.content_id,
    'contentType',v_definition.content_type,
    'ownerUserId',v_revision.owner_user_id,
    'slotKey',v_slot,
    'targetType',v_target,
    'accessReason',v_access_reason
  );
end;
$$;
revoke all on function kelo_private.require_creator_revision_use(uuid,uuid,text[]) from public, anon, authenticated;
grant execute on function kelo_private.require_creator_revision_use(uuid,uuid,text[]) to service_role;

create or replace function public.set_character_creator_content(
  p_character_id uuid,
  p_slot_key text,
  p_revision_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_access jsonb;
  v_slot text := trim(coalesce(p_slot_key,''));
  v_server_slot text;
  v_kind text;
  v_target text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.characters c where c.id=p_character_id and c.account_id=v_uid and c.status='active') then raise exception 'CHARACTER_NOT_FOUND'; end if;
  if v_slot !~ '^[A-Za-z0-9_.:-]{1,64}$' then raise exception 'INVALID_SLOT_KEY'; end if;

  if p_revision_id is null then
    delete from public.creator_character_content_bindings where character_id=p_character_id and slot_key=v_slot;
    return jsonb_build_object('ok',true,'characterId',p_character_id,'slotKey',v_slot,'revisionId',null);
  end if;

  v_access := kelo_private.require_creator_revision_use(v_uid,p_revision_id,array['appearance','equipment']);
  v_server_slot := coalesce(v_access->>'slotKey','');
  v_target := lower(coalesce(v_access->>'targetType',''));
  if v_server_slot = '' then raise exception 'CREATOR_CONTENT_SLOT_REQUIRED'; end if;
  if v_server_slot <> v_slot then raise exception 'CREATOR_CONTENT_SLOT_MISMATCH'; end if;
  if v_target <> '' and v_target not in ('character','player') then raise exception 'CREATOR_CONTENT_TARGET_NOT_CHARACTER'; end if;
  v_kind := v_access->>'contentType';

  insert into public.creator_character_content_bindings(character_id,binding_kind,slot_key,revision_id,updated_at)
  values(p_character_id,v_kind,v_slot,p_revision_id,now())
  on conflict(character_id,slot_key) do update set binding_kind=excluded.binding_kind,revision_id=excluded.revision_id,updated_at=now();

  return jsonb_build_object('ok',true,'characterId',p_character_id,'slotKey',v_slot,'bindingKind',v_kind,'revisionId',p_revision_id,'accessReason',v_access->>'accessReason');
end;
$$;
revoke all on function public.set_character_creator_content(uuid,text,uuid) from public, anon;
grant execute on function public.set_character_creator_content(uuid,text,uuid) to authenticated, service_role;

create or replace function public.set_character_creator_mount(
  p_character_id uuid,
  p_revision_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_access jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.characters c where c.id=p_character_id and c.account_id=v_uid and c.status='active') then raise exception 'CHARACTER_NOT_FOUND'; end if;

  if p_revision_id is null then
    delete from public.creator_character_mount_bindings where character_id=p_character_id;
    return jsonb_build_object('ok',true,'characterId',p_character_id,'revisionId',null);
  end if;

  v_access := kelo_private.require_creator_revision_use(v_uid,p_revision_id,array['mount']);
  insert into public.creator_character_mount_bindings(character_id,revision_id,updated_at)
  values(p_character_id,p_revision_id,now())
  on conflict(character_id) do update set revision_id=excluded.revision_id,updated_at=now();
  return jsonb_build_object('ok',true,'characterId',p_character_id,'revisionId',p_revision_id,'accessReason',v_access->>'accessReason');
end;
$$;
revoke all on function public.set_character_creator_mount(uuid,uuid) from public, anon;
grant execute on function public.set_character_creator_mount(uuid,uuid) to authenticated, service_role;

-- Property is still a replaceable domain authority today. This RPC authorizes the paid Creator revision
-- before the local/remote Property owner performs its own parcel, balance, bounds and placement rules.
create or replace function public.authorize_creator_property_placement(
  p_character_id uuid,
  p_revision_id uuid,
  p_parcel_key text,
  p_transform jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_access jsonb;
  v_id uuid;
  v_parcel text := trim(coalesce(p_parcel_key,''));
  v_transform jsonb := coalesce(p_transform,'{}'::jsonb);
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.characters c where c.id=p_character_id and c.account_id=v_uid and c.status='active') then raise exception 'CHARACTER_NOT_FOUND'; end if;
  if char_length(v_parcel) < 1 or char_length(v_parcel) > 160 then raise exception 'INVALID_PARCEL_KEY'; end if;
  if jsonb_typeof(v_transform) <> 'object' then raise exception 'INVALID_TRANSFORM'; end if;
  if octet_length(v_transform::text) > 2048 then raise exception 'TRANSFORM_TOO_LARGE'; end if;

  v_access := kelo_private.require_creator_revision_use(v_uid,p_revision_id,array['world','tile']);
  insert into public.creator_property_use_authorizations(account_id,character_id,revision_id,parcel_key,transform)
  values(v_uid,p_character_id,p_revision_id,v_parcel,v_transform)
  returning id into v_id;
  return jsonb_build_object('ok',true,'authorizationId',v_id,'characterId',p_character_id,'revisionId',p_revision_id,'parcelKey',v_parcel,'accessReason',v_access->>'accessReason');
end;
$$;
revoke all on function public.authorize_creator_property_placement(uuid,uuid,text,jsonb) from public, anon;
grant execute on function public.authorize_creator_property_placement(uuid,uuid,text,jsonb) to authenticated, service_role;

create or replace function public.get_my_creator_use_state(p_character_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_loadout jsonb;
  v_mount jsonb;
  v_avatar jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists(select 1 from public.characters c where c.id=p_character_id and c.account_id=v_uid and c.status='active') then raise exception 'CHARACTER_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('slotKey',b.slot_key,'bindingKind',b.binding_kind,'revisionId',b.revision_id,'updatedAt',b.updated_at) order by b.slot_key),'[]'::jsonb)
    into v_loadout from public.creator_character_content_bindings b where b.character_id=p_character_id;
  select jsonb_build_object('revisionId',m.revision_id,'updatedAt',m.updated_at) into v_mount
    from public.creator_character_mount_bindings m where m.character_id=p_character_id;
  select case when r.id is null then null else jsonb_build_object('revisionId',r.id,'contentId',r.content_id) end into v_avatar
    from public.characters c left join public.content_definition_revisions r on r.content_id=c.active_avatar_content_id
    where c.id=p_character_id and c.account_id=v_uid and c.status='active';
  return jsonb_build_object('characterId',p_character_id,'loadout',v_loadout,'mount',v_mount,'avatar',v_avatar);
end;
$$;
revoke all on function public.get_my_creator_use_state(uuid) from public, anon;
grant execute on function public.get_my_creator_use_state(uuid) to authenticated, service_role;

alter table public.creator_character_content_bindings enable row level security;
alter table public.creator_character_mount_bindings enable row level security;
alter table public.creator_property_use_authorizations enable row level security;
revoke all on public.creator_character_content_bindings,public.creator_character_mount_bindings,public.creator_property_use_authorizations from anon,authenticated;

comment on table public.creator_character_content_bindings is 'Server-authoritative exact-revision Creator appearance/equipment selections by character and slot.';
comment on table public.creator_character_mount_bindings is 'Server-authoritative selected Creator mount revision per character.';
comment on table public.creator_property_use_authorizations is 'Audit receipt proving exact-revision Creator content access before Property owner placement; not parcel geometry authority.';
comment on function public.set_character_creator_content(uuid,text,uuid) is 'Persists Creator appearance/equipment slot selection only after exact-revision access + active publication.';
comment on function public.set_character_creator_mount(uuid,uuid) is 'Persists selected Creator mount only after exact-revision access + active publication.';
comment on function public.authorize_creator_property_placement(uuid,uuid,text,jsonb) is 'Authorizes paid Creator world/tile use before the Property owner applies parcel and geometry rules.';

commit;
