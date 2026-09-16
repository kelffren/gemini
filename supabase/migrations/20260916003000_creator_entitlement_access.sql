begin;

-- Creator content usage is revision-specific. Publication makes content discoverable;
-- ownership/entitlement makes a revision usable by an account.
create or replace function public.list_my_creator_content_access()
returns table(
  revision_id uuid,
  content_id text,
  content_type text,
  display_name text,
  access_reason text,
  license_key text,
  owner_user_id uuid
)
language sql stable security definer set search_path='' as $$
  with me as (select auth.uid() as uid),
  owned as (
    select r.id as revision_id,r.content_id,d.content_type,d.display_name,'creator_owner'::text as access_reason,
           'owner'::text as license_key,d.owner_user_id
    from public.content_definition_revisions r
    join public.content_definitions d on d.id=r.definition_id
    join me on me.uid=d.owner_user_id
  ),
  entitled as (
    select e.revision_id,r.content_id,d.content_type,d.display_name,'entitlement'::text as access_reason,
           e.license_key,d.owner_user_id
    from public.creator_content_entitlements e
    join public.content_definition_revisions r on r.id=e.revision_id
    join public.content_definitions d on d.id=r.definition_id
    join me on me.uid=e.buyer_user_id
  )
  select * from owned
  union all
  select * from entitled e
  where not exists(select 1 from owned o where o.revision_id=e.revision_id)
  order by display_name,revision_id;
$$;
revoke all on function public.list_my_creator_content_access() from public,anon;
grant execute on function public.list_my_creator_content_access() to authenticated,service_role;

create or replace function public.check_creator_content_access(p_revision_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_uid uuid := (select auth.uid());
  v_content_id text;
  v_owner uuid;
  v_type text;
  v_license text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_revision_id is null then raise exception 'REVISION_REQUIRED'; end if;

  select r.content_id,d.owner_user_id,d.content_type
    into v_content_id,v_owner,v_type
  from public.content_definition_revisions r
  join public.content_definitions d on d.id=r.definition_id
  where r.id=p_revision_id;

  if v_content_id is null then
    return jsonb_build_object('allowed',false,'reason','REVISION_NOT_FOUND','revisionId',p_revision_id);
  end if;

  if v_owner=v_uid then
    return jsonb_build_object('allowed',true,'reason','CREATOR_OWNER','revisionId',p_revision_id,'contentId',v_content_id,'contentType',v_type,'licenseKey','owner');
  end if;

  select e.license_key into v_license
  from public.creator_content_entitlements e
  where e.buyer_user_id=v_uid and e.revision_id=p_revision_id;

  if v_license is not null then
    return jsonb_build_object('allowed',true,'reason','ENTITLEMENT','revisionId',p_revision_id,'contentId',v_content_id,'contentType',v_type,'licenseKey',v_license);
  end if;

  return jsonb_build_object('allowed',false,'reason','ENTITLEMENT_REQUIRED','revisionId',p_revision_id,'contentId',v_content_id,'contentType',v_type);
end;
$$;
revoke all on function public.check_creator_content_access(uuid) from public,anon;
grant execute on function public.check_creator_content_access(uuid) to authenticated,service_role;

comment on function public.list_my_creator_content_access() is 'Canonical account-level usable Creator revisions: own authored revisions plus purchased entitlements.';
comment on function public.check_creator_content_access(uuid) is 'Authoritative revision-specific Creator content usage check. Publication alone never grants use.';

commit;
