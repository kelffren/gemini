begin;

create or replace function kelo_private.can_review_private_asset_path(p_path text)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    (select auth.uid()) is not null
    and (
      kelo_private.has_permission('approval.view')
      or kelo_private.has_permission('approval.review')
    )
    and (
      exists (
        select 1
        from public.asset_revisions ar
        join public.asset_review_requests rr on rr.revision_id = ar.id
        join public.approval_requests q on q.source_type = 'asset_review' and q.source_id = rr.id
        where ar.storage_bucket = 'creator-private'
          and ar.storage_path = p_path
      )
      or exists (
        select 1
        from public.asset_revisions ar
        join public.content_asset_bindings cab on cab.asset_revision_id = ar.id
        join public.content_review_requests rr on rr.revision_id = cab.content_revision_id
        join public.approval_requests q on q.source_type = 'content_review' and q.source_id = rr.id
        where ar.storage_bucket = 'creator-private'
          and ar.storage_path = p_path
      )
    );
$$;

revoke all on function kelo_private.can_review_private_asset_path(text) from public,anon;
grant execute on function kelo_private.can_review_private_asset_path(text) to authenticated,service_role;

create or replace function public.get_approval_request_detail(p_request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_q public.approval_requests;
  v_detail jsonb := '{}'::jsonb;
  v_assets jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not (
    kelo_private.has_permission('approval.view')
    or kelo_private.has_permission('approval.review')
  ) then raise exception 'APPROVAL_VIEW_DENIED'; end if;

  select * into v_q from public.approval_requests where id = p_request_id;
  if v_q.id is null then raise exception 'APPROVAL_REQUEST_NOT_FOUND'; end if;

  if v_q.source_type = 'asset_review' and v_q.source_id is not null then
    select jsonb_strip_nulls(jsonb_build_object(
      'kind','asset',
      'familyId',f.id,
      'familyName',f.name,
      'assetKind',f.kind,
      'category',f.category,
      'semanticFamily',f.semantic_family,
      'tags',to_jsonb(f.tags),
      'revisionId',ar.id,
      'revision',ar.revision,
      'assetId',ar.asset_id,
      'mimeType',ar.mime_type,
      'byteSize',ar.byte_size,
      'pixelWidth',ar.pixel_width,
      'pixelHeight',ar.pixel_height,
      'worldWidth',ar.world_width,
      'worldHeight',ar.world_height,
      'collisionMode',ar.collision_mode,
      'renderPhase',ar.render_phase,
      'revisionMetadata',ar.metadata,
      'familyMetadata',f.metadata
    )),
    jsonb_build_array(jsonb_build_object(
      'role','primary',
      'assetId',ar.asset_id,
      'revisionId',ar.id,
      'bucket',ar.storage_bucket,
      'path',ar.storage_path,
      'mimeType',ar.mime_type,
      'pixelWidth',ar.pixel_width,
      'pixelHeight',ar.pixel_height,
      'byteSize',ar.byte_size
    ))
    into v_detail,v_assets
    from public.asset_review_requests rr
    join public.asset_revisions ar on ar.id = rr.revision_id
    join public.asset_families f on f.id = ar.family_id
    where rr.id = v_q.source_id;

  elsif v_q.source_type = 'content_review' and v_q.source_id is not null then
    select jsonb_strip_nulls(jsonb_build_object(
      'kind','content',
      'definitionId',d.id,
      'stableKey',d.stable_key,
      'contentType',d.content_type,
      'slug',d.slug,
      'displayName',d.display_name,
      'tags',to_jsonb(d.tags),
      'definitionMetadata',d.metadata,
      'revisionId',cr.id,
      'revision',cr.revision,
      'contentId',cr.content_id,
      'schemaVersion',cr.schema_version,
      'contentHash',cr.content_hash,
      'payload',cr.payload
    ))
    into v_detail
    from public.content_review_requests rr
    join public.content_definition_revisions cr on cr.id = rr.revision_id
    join public.content_definitions d on d.id = cr.definition_id
    where rr.id = v_q.source_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'role',cab.role,
      'ordinal',cab.ordinal,
      'assetId',ar.asset_id,
      'revisionId',ar.id,
      'bucket',ar.storage_bucket,
      'path',ar.storage_path,
      'mimeType',ar.mime_type,
      'pixelWidth',ar.pixel_width,
      'pixelHeight',ar.pixel_height,
      'byteSize',ar.byte_size,
      'metadata',cab.metadata
    ) order by cab.ordinal,cab.role),'[]'::jsonb)
    into v_assets
    from public.content_review_requests rr
    join public.content_asset_bindings cab on cab.content_revision_id = rr.revision_id
    join public.asset_revisions ar on ar.id = cab.asset_revision_id
    where rr.id = v_q.source_id;
  end if;

  return jsonb_build_object(
    'request',jsonb_strip_nulls(jsonb_build_object(
      'id',v_q.id,
      'requestType',v_q.request_type,
      'title',v_q.title,
      'summary',v_q.summary,
      'status',v_q.status,
      'submittedBy',v_q.submitted_by,
      'submittedAt',v_q.submitted_at,
      'decidedBy',v_q.decided_by,
      'decidedAt',v_q.decided_at,
      'decisionNote',v_q.decision_note,
      'entityType',v_q.entity_type,
      'entityId',v_q.entity_id,
      'sourceType',v_q.source_type,
      'sourceId',v_q.source_id,
      'metadata',v_q.metadata
    )),
    'detail',coalesce(v_detail,'{}'::jsonb),
    'previewAssets',coalesce(v_assets,'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_approval_request_detail(uuid) from public,anon;
grant execute on function public.get_approval_request_detail(uuid) to authenticated,service_role;

-- Reviewers may only read private Creator objects that are attached to an ApprovalRequest.
-- This keeps creator-private private while allowing short-lived signed previews in the review UI.
drop policy if exists creator_private_approval_review_read on storage.objects;
create policy creator_private_approval_review_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'creator-private'
  and kelo_private.can_review_private_asset_path(name)
);

comment on function public.get_approval_request_detail(uuid) is 'Reviewer-only detail endpoint for ApprovalRequest; includes immutable metadata and private preview asset locators.';
comment on function kelo_private.can_review_private_asset_path(text) is 'RLS helper: permits reviewer SELECT only for creator-private objects linked to an ApprovalRequest.';

commit;