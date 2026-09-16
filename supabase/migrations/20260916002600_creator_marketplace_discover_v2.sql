begin;

create or replace function public.discover_creator_market_v2(
  p_query text default null,
  p_content_type text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns table(
  listing_id uuid,revision_id uuid,content_id text,content_type text,display_name text,tags text[],price_kc bigint,license_key text,
  creator_handle text,creator_display_name text,creator_avatar_path text,creator_tagline text,
  visibility text,published_at timestamptz,listed_at timestamptz,preview_bucket text,preview_path text,is_own boolean,is_owned boolean
) language sql stable security definer set search_path='' as $$
  select l.id,r.id,r.content_id,d.content_type,d.display_name,d.tags,l.price_kc,l.license_key,
         p.handle,p.display_name,p.avatar_path,coalesce(cpd.tagline,''),cp.visibility,cp.published_at,l.created_at,
         preview.public_storage_bucket,preview.public_storage_path,
         d.owner_user_id=(select auth.uid()),
         exists(select 1 from public.creator_content_entitlements e where e.buyer_user_id=(select auth.uid()) and e.revision_id=r.id)
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
revoke all on function public.discover_creator_market_v2(text,text,integer,integer) from public;
grant execute on function public.discover_creator_market_v2(text,text,integer,integer) to anon,authenticated,service_role;

comment on function public.discover_creator_market_v2(text,text,integer,integer) is 'Metadata-first Creator marketplace discovery. Does not expose raw account IDs; returns caller-relative ownership flags.';

commit;
