begin;

create unique index if not exists approval_requests_creator_pending_unique_idx
  on public.approval_requests(submitted_by,source_type,entity_type,entity_id)
  where status='pending' and source_type='creator_workspace' and entity_id is not null;

create or replace function public.submit_creator_workspace_approval(
  p_workspace text,
  p_entity_id text,
  p_title text,
  p_summary text default null,
  p_request_type text default 'other',
  p_metadata jsonb default '{}'::jsonb
)
returns public.approval_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_workspace text := lower(trim(coalesce(p_workspace,'')));
  v_entity_id text := trim(coalesce(p_entity_id,''));
  v_title text := trim(coalesce(p_title,''));
  v_summary text := nullif(trim(coalesce(p_summary,'')),'');
  v_type text := lower(trim(coalesce(p_request_type,'other')));
  v_row public.approval_requests;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.has_permission('approval.submit') then raise exception 'APPROVAL_SUBMIT_DENIED'; end if;
  if v_workspace !~ '^[a-z0-9][a-z0-9_-]{0,63}$' then raise exception 'INVALID_CREATOR_WORKSPACE'; end if;
  if char_length(v_entity_id)<1 or char_length(v_entity_id)>240 then raise exception 'INVALID_CREATOR_ENTITY_ID'; end if;
  if char_length(v_title)<1 or char_length(v_title)>120 then raise exception 'INVALID_APPROVAL_TITLE'; end if;
  if v_summary is not null and char_length(v_summary)>1200 then raise exception 'APPROVAL_SUMMARY_TOO_LONG'; end if;
  if v_type not in ('asset','map','scene','skin','item','animation','vfx','ability','world','other') then raise exception 'INVALID_APPROVAL_TYPE'; end if;
  if octet_length(coalesce(p_metadata,'{}'::jsonb)::text)>32768 then raise exception 'APPROVAL_METADATA_TOO_LARGE'; end if;

  insert into public.approval_requests(
    request_type,title,summary,status,submitted_by,entity_type,entity_id,source_type,metadata
  ) values (
    v_type,v_title,v_summary,'pending',v_uid,v_workspace,v_entity_id,'creator_workspace',
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object('workspace',v_workspace,'entity_id',v_entity_id)
  )
  on conflict (submitted_by,source_type,entity_type,entity_id)
    where status='pending' and source_type='creator_workspace' and entity_id is not null
  do update set
    title=excluded.title,
    summary=excluded.summary,
    request_type=excluded.request_type,
    metadata=public.approval_requests.metadata || excluded.metadata
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_creator_workspace_approval(text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.submit_creator_workspace_approval(text,text,text,text,text,jsonb) to authenticated,service_role;

create or replace function public.get_my_creator_workspace_approval(
  p_workspace text,
  p_entity_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_workspace text := lower(trim(coalesce(p_workspace,'')));
  v_entity_id text := trim(coalesce(p_entity_id,''));
  v_row public.approval_requests;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_workspace='' or v_entity_id='' then raise exception 'APPROVAL_TARGET_REQUIRED'; end if;

  select * into v_row
  from public.approval_requests q
  where q.submitted_by=v_uid
    and q.source_type='creator_workspace'
    and q.entity_type=v_workspace
    and q.entity_id=v_entity_id
  order by q.submitted_at desc
  limit 1;

  if v_row.id is null then
    return jsonb_build_object('status','draft','request_id',null);
  end if;

  return jsonb_build_object(
    'status',v_row.status,
    'request_id',v_row.id,
    'request_type',v_row.request_type,
    'title',v_row.title,
    'submitted_at',v_row.submitted_at,
    'decided_at',v_row.decided_at,
    'decision_note',v_row.decision_note,
    'entity_type',v_row.entity_type,
    'entity_id',v_row.entity_id
  );
end;
$$;

revoke all on function public.get_my_creator_workspace_approval(text,text) from public,anon;
grant execute on function public.get_my_creator_workspace_approval(text,text) to authenticated,service_role;

comment on function public.submit_creator_workspace_approval(text,text,text,text,text,jsonb) is
  'Idempotent Creator editor submit: one pending ApprovalRequest per user/workspace/entity. Re-submit while pending refreshes metadata instead of duplicating the request.';
comment on function public.get_my_creator_workspace_approval(text,text) is
  'Returns the latest approval state for the authenticated Creator user and workspace entity.';

commit;
