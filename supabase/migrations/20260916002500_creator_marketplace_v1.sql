begin;

-- Creator profile details extend public.profiles without creating a second identity owner.
create table if not exists public.creator_profile_details (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  tagline text not null default '',
  bio text not null default '',
  is_public boolean not null default true,
  creator_since timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_profile_tagline_len check (char_length(tagline) <= 80),
  constraint creator_profile_bio_len check (char_length(bio) <= 600)
);

-- One authority-owned fee policy. V1 starts at 100% creator / 0% platform.
create table if not exists public.creator_market_config (
  singleton boolean primary key default true check (singleton = true),
  seller_share_bps integer not null default 10000 check (seller_share_bps between 0 and 10000),
  platform_treasury_character_id uuid references public.characters(id) on delete restrict,
  updated_at timestamptz not null default now()
);
insert into public.creator_market_config(singleton,seller_share_bps)
values(true,10000) on conflict(singleton) do nothing;

create table if not exists public.creator_market_listings (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.content_publications(id) on delete restrict,
  revision_id uuid not null references public.content_definition_revisions(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  payout_character_id uuid not null references public.characters(id) on delete restrict,
  price_kc bigint not null check (price_kc >= 0),
  seller_share_bps integer not null check (seller_share_bps between 0 and 10000),
  license_key text not null default 'standard' check (license_key ~ '^[a-z][a-z0-9_-]{1,31}$'),
  status text not null default 'active' check (status in ('active','paused','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists creator_market_one_active_revision_uidx
  on public.creator_market_listings(revision_id) where status='active';
create index if not exists creator_market_listing_owner_idx on public.creator_market_listings(owner_user_id,created_at desc);
create index if not exists creator_market_listing_discover_idx on public.creator_market_listings(status,created_at desc);

create table if not exists public.creator_market_transactions (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null unique,
  listing_id uuid not null references public.creator_market_listings(id) on delete restrict,
  publication_id uuid not null references public.content_publications(id) on delete restrict,
  revision_id uuid not null references public.content_definition_revisions(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  buyer_character_id uuid not null references public.characters(id) on delete restrict,
  seller_user_id uuid not null references auth.users(id) on delete restrict,
  seller_character_id uuid not null references public.characters(id) on delete restrict,
  currency_key text not null default 'kc' check (currency_key='kc'),
  price_kc bigint not null check (price_kc >= 0),
  creator_payout_kc bigint not null check (creator_payout_kc >= 0),
  platform_fee_kc bigint not null check (platform_fee_kc >= 0),
  license_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists creator_market_tx_buyer_idx on public.creator_market_transactions(buyer_user_id,created_at desc);
create index if not exists creator_market_tx_seller_idx on public.creator_market_transactions(seller_user_id,created_at desc);
create index if not exists creator_market_tx_listing_idx on public.creator_market_transactions(listing_id,created_at desc);

create table if not exists public.creator_content_entitlements (
  buyer_user_id uuid not null references auth.users(id) on delete cascade,
  revision_id uuid not null references public.content_definition_revisions(id) on delete restrict,
  listing_id uuid not null references public.creator_market_listings(id) on delete restrict,
  transaction_id uuid references public.creator_market_transactions(id) on delete restrict,
  license_key text not null,
  acquired_at timestamptz not null default now(),
  primary key(buyer_user_id,revision_id)
);
create index if not exists creator_entitlements_user_idx on public.creator_content_entitlements(buyer_user_id,acquired_at desc);

create trigger creator_profile_details_touch_updated_at before update on public.creator_profile_details
for each row execute function kelo_private.touch_updated_at();
create trigger creator_market_listings_touch_updated_at before update on public.creator_market_listings
for each row execute function kelo_private.touch_updated_at();
create trigger creator_market_config_touch_updated_at before update on public.creator_market_config
for each row execute function kelo_private.touch_updated_at();

create or replace function public.upsert_creator_profile(
  p_display_name text default null,
  p_handle text default null,
  p_tagline text default '',
  p_bio text default ''
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_profile public.profiles; v_detail public.creator_profile_details;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_display_name is not null and (char_length(trim(p_display_name)) < 1 or char_length(trim(p_display_name)) > 40) then raise exception 'INVALID_DISPLAY_NAME'; end if;
  if p_handle is not null and (char_length(trim(p_handle)) < 3 or char_length(trim(p_handle)) > 24 or trim(p_handle) !~ '^[A-Za-z0-9_]+$') then raise exception 'INVALID_HANDLE'; end if;
  if char_length(coalesce(p_tagline,'')) > 80 then raise exception 'INVALID_TAGLINE'; end if;
  if char_length(coalesce(p_bio,'')) > 600 then raise exception 'INVALID_BIO'; end if;
  update public.profiles set
    display_name=coalesce(nullif(trim(p_display_name),''),display_name),
    handle=coalesce(nullif(trim(p_handle),''),handle),
    updated_at=now()
  where user_id=v_uid returning * into v_profile;
  if v_profile.user_id is null then raise exception 'PROFILE_NOT_FOUND'; end if;
  insert into public.creator_profile_details(user_id,tagline,bio,is_public)
  values(v_uid,trim(coalesce(p_tagline,'')),trim(coalesce(p_bio,'')),true)
  on conflict(user_id) do update set tagline=excluded.tagline,bio=excluded.bio,updated_at=now()
  returning * into v_detail;
  return jsonb_build_object('userId',v_uid,'handle',v_profile.handle,'displayName',v_profile.display_name,'avatarPath',v_profile.avatar_path,'tagline',v_detail.tagline,'bio',v_detail.bio,'creatorSince',v_detail.creator_since);
end;
$$;
revoke all on function public.upsert_creator_profile(text,text,text,text) from public,anon;
grant execute on function public.upsert_creator_profile(text,text,text,text) to authenticated,service_role;

create or replace function public.get_creator_profile(p_user_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid := coalesce(p_user_id,(select auth.uid())); v_profile public.profiles; v_detail public.creator_profile_details;
begin
  if v_uid is null then return null; end if;
  select * into v_profile from public.profiles where user_id=v_uid;
  select * into v_detail from public.creator_profile_details where user_id=v_uid and (is_public=true or user_id=(select auth.uid()));
  if v_profile.user_id is null then return null; end if;
  return jsonb_build_object('userId',v_profile.user_id,'handle',v_profile.handle,'displayName',v_profile.display_name,'avatarPath',v_profile.avatar_path,'tagline',coalesce(v_detail.tagline,''),'bio',coalesce(v_detail.bio,''),'creatorSince',v_detail.creator_since);
end;
$$;
revoke all on function public.get_creator_profile(uuid) from public;
grant execute on function public.get_creator_profile(uuid) to anon,authenticated,service_role;

create or replace function public.create_creator_market_listing(
  p_revision_id uuid,
  p_payout_character_id uuid,
  p_price_kc bigint,
  p_license_key text default 'standard'
)
returns public.creator_market_listings language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_pub public.content_publications; v_owner uuid; v_share integer; v_existing public.creator_market_listings; v_row public.creator_market_listings;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_price_kc is null or p_price_kc < 0 or p_price_kc > 1000000000 then raise exception 'INVALID_PRICE'; end if;
  if p_license_key is null or lower(trim(p_license_key)) !~ '^[a-z][a-z0-9_-]{1,31}$' then raise exception 'INVALID_LICENSE'; end if;
  select p.* into v_pub from public.content_publications p where p.revision_id=p_revision_id and p.is_active=true;
  if v_pub.id is null then raise exception 'PUBLISHED_CONTENT_REQUIRED'; end if;
  select d.owner_user_id into v_owner from public.content_definition_revisions r join public.content_definitions d on d.id=r.definition_id where r.id=p_revision_id;
  if v_owner is null or v_owner<>v_uid then raise exception 'CONTENT_NOT_OWNED'; end if;
  if not exists(select 1 from public.characters c where c.id=p_payout_character_id and c.account_id=v_uid and c.status='active') then raise exception 'PAYOUT_CHARACTER_NOT_OWNED'; end if;
  select seller_share_bps into v_share from public.creator_market_config where singleton=true;
  v_share:=coalesce(v_share,10000);
  select * into v_existing from public.creator_market_listings where revision_id=p_revision_id and status='active' for update;
  if v_existing.id is not null then
    update public.creator_market_listings set payout_character_id=p_payout_character_id,price_kc=p_price_kc,license_key=lower(trim(p_license_key)),seller_share_bps=v_share,updated_at=now()
    where id=v_existing.id returning * into v_row;
    return v_row;
  end if;
  insert into public.creator_market_listings(publication_id,revision_id,owner_user_id,payout_character_id,price_kc,seller_share_bps,license_key)
  values(v_pub.id,p_revision_id,v_uid,p_payout_character_id,p_price_kc,v_share,lower(trim(p_license_key))) returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.create_creator_market_listing(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.create_creator_market_listing(uuid,uuid,bigint,text) to authenticated,service_role;

create or replace function public.cancel_creator_market_listing(p_listing_id uuid)
returns public.creator_market_listings language plpgsql security definer set search_path='' as $$
declare v_uid uuid := (select auth.uid()); v_row public.creator_market_listings;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.creator_market_listings set status='cancelled',updated_at=now()
  where id=p_listing_id and owner_user_id=v_uid and status in ('active','paused') returning * into v_row;
  if v_row.id is null then raise exception 'LISTING_NOT_FOUND_OR_NOT_OWNED'; end if;
  return v_row;
end;
$$;
revoke all on function public.cancel_creator_market_listing(uuid) from public,anon;
grant execute on function public.cancel_creator_market_listing(uuid) to authenticated,service_role;

create or replace function public.discover_creator_market(
  p_query text default null,
  p_content_type text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns table(
  listing_id uuid,revision_id uuid,content_id text,content_type text,display_name text,tags text[],price_kc bigint,license_key text,
  creator_user_id uuid,creator_handle text,creator_display_name text,creator_avatar_path text,creator_tagline text,
  visibility text,published_at timestamptz,listed_at timestamptz,preview_bucket text,preview_path text
) language sql stable security definer set search_path='' as $$
  select l.id,r.id,r.content_id,d.content_type,d.display_name,d.tags,l.price_kc,l.license_key,
         d.owner_user_id,p.handle,p.display_name,p.avatar_path,coalesce(cpd.tagline,''),cp.visibility,cp.published_at,l.created_at,
         preview.public_storage_bucket,preview.public_storage_path
  from public.creator_market_listings l
  join public.content_publications cp on cp.id=l.publication_id and cp.revision_id=l.revision_id and cp.is_active=true
  join public.content_definition_revisions r on r.id=l.revision_id
  join public.content_definitions d on d.id=r.definition_id
  left join public.profiles p on p.user_id=d.owner_user_id
  left join public.creator_profile_details cpd on cpd.user_id=d.owner_user_id and cpd.is_public=true
  left join lateral (
    select ap.public_storage_bucket,ap.public_storage_path
    from public.content_asset_bindings cab join public.asset_publications ap on ap.revision_id=cab.asset_revision_id and ap.is_active=true
    where cab.content_revision_id=r.id order by cab.ordinal asc limit 1
  ) preview on true
  where l.status='active'
    and (p_content_type is null or trim(p_content_type)='' or d.content_type=lower(trim(p_content_type)))
    and (p_query is null or trim(p_query)='' or d.display_name ilike '%'||trim(p_query)||'%' or array_to_string(d.tags,' ') ilike '%'||trim(p_query)||'%' or coalesce(p.handle,'') ilike '%'||trim(p_query)||'%')
  order by l.created_at desc
  limit greatest(1,least(100,coalesce(p_limit,40))) offset greatest(0,coalesce(p_offset,0));
$$;
revoke all on function public.discover_creator_market(text,text,integer,integer) from public;
grant execute on function public.discover_creator_market(text,text,integer,integer) to anon,authenticated,service_role;

create or replace function public.list_my_creator_market_listings()
returns table(listing_id uuid,revision_id uuid,content_id text,content_type text,display_name text,price_kc bigint,license_key text,status text,seller_share_bps integer,created_at timestamptz,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
  select l.id,l.revision_id,r.content_id,d.content_type,d.display_name,l.price_kc,l.license_key,l.status,l.seller_share_bps,l.created_at,l.updated_at
  from public.creator_market_listings l join public.content_definition_revisions r on r.id=l.revision_id join public.content_definitions d on d.id=r.definition_id
  where l.owner_user_id=(select auth.uid()) order by l.created_at desc limit 500;
$$;
revoke all on function public.list_my_creator_market_listings() from public,anon;
grant execute on function public.list_my_creator_market_listings() to authenticated,service_role;

create or replace function public.purchase_creator_market_listing(
  p_listing_id uuid,
  p_buyer_character_id uuid,
  p_correlation_id uuid
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid := (select auth.uid()); v_listing public.creator_market_listings; v_pub public.content_publications;
  v_existing public.creator_market_transactions; v_tx public.creator_market_transactions; v_price bigint; v_payout bigint; v_fee bigint; v_treasury uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_correlation_id is null then raise exception 'CORRELATION_ID_REQUIRED'; end if;
  select * into v_existing from public.creator_market_transactions where correlation_id=p_correlation_id;
  if v_existing.id is not null then
    if v_existing.buyer_user_id<>v_uid then raise exception 'CORRELATION_CONFLICT'; end if;
    return jsonb_build_object('ok',true,'idempotent',true,'transactionId',v_existing.id,'listingId',v_existing.listing_id,'revisionId',v_existing.revision_id,'priceKc',v_existing.price_kc,'creatorPayoutKc',v_existing.creator_payout_kc,'platformFeeKc',v_existing.platform_fee_kc);
  end if;
  if not exists(select 1 from public.characters c where c.id=p_buyer_character_id and c.account_id=v_uid and c.status='active') then raise exception 'BUYER_CHARACTER_NOT_OWNED'; end if;
  select * into v_listing from public.creator_market_listings where id=p_listing_id and status='active' for update;
  if v_listing.id is null then raise exception 'LISTING_NOT_FOUND'; end if;
  if v_listing.owner_user_id=v_uid then raise exception 'SELF_PURCHASE_FORBIDDEN'; end if;
  select * into v_pub from public.content_publications where id=v_listing.publication_id and revision_id=v_listing.revision_id and is_active=true;
  if v_pub.id is null then raise exception 'CONTENT_NOT_PUBLISHED'; end if;
  if exists(select 1 from public.creator_content_entitlements e where e.buyer_user_id=v_uid and e.revision_id=v_listing.revision_id) then raise exception 'ALREADY_OWNED'; end if;
  v_price:=v_listing.price_kc;
  v_payout:=floor((v_price::numeric*v_listing.seller_share_bps::numeric)/10000)::bigint;
  v_fee:=v_price-v_payout;
  select platform_treasury_character_id into v_treasury from public.creator_market_config where singleton=true;
  if v_fee>0 and v_treasury is null then raise exception 'PLATFORM_TREASURY_NOT_CONFIGURED'; end if;
  if v_price>0 then
    perform public.apply_wallet_delta(p_buyer_character_id,'kc',-v_price,'creator_market_purchase',gen_random_uuid(),jsonb_build_object('listingId',v_listing.id,'correlationId',p_correlation_id));
  end if;
  if v_payout>0 then
    perform public.apply_wallet_delta(v_listing.payout_character_id,'kc',v_payout,'creator_market_sale',gen_random_uuid(),jsonb_build_object('listingId',v_listing.id,'buyerUserId',v_uid,'correlationId',p_correlation_id));
  end if;
  if v_fee>0 then
    perform public.apply_wallet_delta(v_treasury,'kc',v_fee,'creator_market_platform_fee',gen_random_uuid(),jsonb_build_object('listingId',v_listing.id,'correlationId',p_correlation_id));
  end if;
  insert into public.creator_market_transactions(correlation_id,listing_id,publication_id,revision_id,buyer_user_id,buyer_character_id,seller_user_id,seller_character_id,price_kc,creator_payout_kc,platform_fee_kc,license_key)
  values(p_correlation_id,v_listing.id,v_listing.publication_id,v_listing.revision_id,v_uid,p_buyer_character_id,v_listing.owner_user_id,v_listing.payout_character_id,v_price,v_payout,v_fee,v_listing.license_key)
  returning * into v_tx;
  insert into public.creator_content_entitlements(buyer_user_id,revision_id,listing_id,transaction_id,license_key)
  values(v_uid,v_listing.revision_id,v_listing.id,v_tx.id,v_listing.license_key);
  insert into public.server_audit_events(actor_user_id,character_id,event_key,target_type,target_id,request_id,metadata)
  values(v_uid,p_buyer_character_id,'creator_market_purchase','creator_market_listing',v_listing.id::text,p_correlation_id::text,jsonb_build_object('revisionId',v_listing.revision_id,'priceKc',v_price,'creatorPayoutKc',v_payout,'platformFeeKc',v_fee));
  return jsonb_build_object('ok',true,'idempotent',false,'transactionId',v_tx.id,'listingId',v_listing.id,'revisionId',v_listing.revision_id,'priceKc',v_price,'creatorPayoutKc',v_payout,'platformFeeKc',v_fee,'licenseKey',v_listing.license_key);
end;
$$;
revoke all on function public.purchase_creator_market_listing(uuid,uuid,uuid) from public,anon;
grant execute on function public.purchase_creator_market_listing(uuid,uuid,uuid) to authenticated,service_role;

create or replace function public.list_my_creator_entitlements()
returns table(revision_id uuid,content_id text,content_type text,display_name text,license_key text,acquired_at timestamptz,listing_id uuid,transaction_id uuid)
language sql stable security definer set search_path='' as $$
  select e.revision_id,r.content_id,d.content_type,d.display_name,e.license_key,e.acquired_at,e.listing_id,e.transaction_id
  from public.creator_content_entitlements e join public.content_definition_revisions r on r.id=e.revision_id join public.content_definitions d on d.id=r.definition_id
  where e.buyer_user_id=(select auth.uid()) order by e.acquired_at desc;
$$;
revoke all on function public.list_my_creator_entitlements() from public,anon;
grant execute on function public.list_my_creator_entitlements() to authenticated,service_role;

alter table public.creator_profile_details enable row level security;
alter table public.creator_market_config enable row level security;
alter table public.creator_market_listings enable row level security;
alter table public.creator_market_transactions enable row level security;
alter table public.creator_content_entitlements enable row level security;

revoke all on public.creator_profile_details,public.creator_market_config,public.creator_market_listings,public.creator_market_transactions,public.creator_content_entitlements from anon,authenticated;
grant select on public.creator_profile_details to anon,authenticated;
grant select on public.creator_market_transactions,public.creator_content_entitlements to authenticated;

create policy creator_profile_public_read on public.creator_profile_details for select to anon,authenticated using(is_public=true or user_id=(select auth.uid()));
create policy creator_market_tx_party_read on public.creator_market_transactions for select to authenticated using(buyer_user_id=(select auth.uid()) or seller_user_id=(select auth.uid()));
create policy creator_entitlement_owner_read on public.creator_content_entitlements for select to authenticated using(buyer_user_id=(select auth.uid()));

comment on table public.creator_market_listings is 'Server-backed listings over authority-published Creator content. Listing does not duplicate asset bytes.';
comment on table public.creator_content_entitlements is 'Account-level license/entitlement to use a purchased Creator content revision.';
comment on table public.creator_market_transactions is 'Append-only Creator marketplace KC transaction record; price and split are resolved server-side.';
comment on table public.creator_market_config is 'Authority-owned Creator marketplace policy. V1 defaults to seller_share_bps=10000 until a platform treasury/split policy is explicitly configured.';

commit;
