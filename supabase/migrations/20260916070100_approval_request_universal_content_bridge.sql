begin;

create or replace function kelo_private.mirror_content_review_to_approval()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_name text;
  v_content_id text;
  v_content_type text;
  v_request_type text;
begin
  select d.display_name,r.content_id,d.content_type into v_name,v_content_id,v_content_type
  from public.content_definition_revisions r
  join public.content_definitions d on d.id=r.definition_id
  where r.id=new.revision_id;

  v_request_type:=case
    when lower(coalesce(v_content_type,'')) like '%vfx%' then 'vfx'
    when lower(coalesce(v_content_type,'')) like '%abilit%' then 'ability'
    when lower(coalesce(v_content_type,'')) like '%anim%' then 'animation'
    when lower(coalesce(v_content_type,'')) like '%map%' then 'map'
    when lower(coalesce(v_content_type,'')) like '%world%' then 'world'
    when lower(coalesce(v_content_type,'')) like '%skin%' or lower(coalesce(v_content_type,'')) like '%appearance%' then 'skin'
    when lower(coalesce(v_content_type,'')) like '%item%' or lower(coalesce(v_content_type,'')) like '%equipment%' then 'item'
    else 'other'
  end;

  insert into public.approval_requests(
    request_type,title,summary,status,submitted_by,submitted_at,decided_by,decided_at,decision_note,
    entity_type,entity_id,source_type,source_id,metadata
  ) values (
    v_request_type,coalesce(nullif(v_name,''),'Contenido sin nombre'),
    'Contenido universal enviado por un editor para revisión.',new.status,new.owner_user_id,new.submitted_at,
    new.decided_by,new.decided_at,new.note,coalesce(nullif(v_content_type,''),'content_revision'),new.revision_id::text,
    'content_review',new.id,jsonb_build_object('revision_id',new.revision_id,'content_id',v_content_id,'content_type',v_content_type)
  )
  on conflict(source_type,source_id) where source_id is not null do update set
    request_type=excluded.request_type,title=excluded.title,status=excluded.status,decided_by=excluded.decided_by,
    decided_at=excluded.decided_at,decision_note=excluded.decision_note,entity_type=excluded.entity_type,
    metadata=public.approval_requests.metadata || excluded.metadata;
  return new;
end;
$$;

create or replace function public.review_approval_request(p_request_id uuid,p_decision text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=(select auth.uid());
  v_decision text:=lower(trim(coalesce(p_decision,'')));
  v_note text:=nullif(trim(coalesce(p_note,'')),'');
  v_row public.approval_requests;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.has_permission('approval.review') then raise exception 'APPROVAL_REVIEW_DENIED'; end if;
  if v_decision not in ('approved','rejected') then raise exception 'INVALID_APPROVAL_DECISION'; end if;
  if v_note is not null and char_length(v_note)>1200 then raise exception 'APPROVAL_NOTE_TOO_LONG'; end if;

  select * into v_row from public.approval_requests where id=p_request_id for update;
  if v_row.id is null then raise exception 'APPROVAL_REQUEST_NOT_FOUND'; end if;
  if v_row.status<>'pending' then raise exception 'APPROVAL_REQUEST_ALREADY_DECIDED'; end if;
  if v_row.submitted_by=v_actor then raise exception 'CANNOT_REVIEW_OWN_REQUEST'; end if;

  update public.approval_requests
  set status=v_decision,decided_by=v_actor,decided_at=now(),decision_note=v_note
  where id=p_request_id
  returning * into v_row;

  if v_row.source_type='asset_review' and v_row.source_id is not null then
    update public.asset_review_requests
    set status=v_decision,decided_by=v_actor,decided_at=v_row.decided_at,note=v_note
    where id=v_row.source_id and status='pending';
  elsif v_row.source_type='content_review' and v_row.source_id is not null then
    update public.content_review_requests
    set status=v_decision,decided_by=v_actor,decided_at=v_row.decided_at,note=v_note
    where id=v_row.source_id and status='pending';
  end if;

  insert into public.account_notifications(user_id,kind,title,body,topic,entity_type,entity_id,data)
  values(v_row.submitted_by,case when v_decision='approved' then 'success' else 'warning' end,
    case when v_decision='approved' then 'Solicitud aprobada' else 'Solicitud rechazada' end,
    left(coalesce(v_note,v_row.title),1000),'approval_decision','approval_request',v_row.id::text,
    jsonb_build_object('request_id',v_row.id,'request_type',v_row.request_type,'decision',v_decision,'decided_by',v_actor));

  insert into public.account_admin_audit_events(actor_user_id,target_user_id,action,reason,metadata)
  values(v_actor,v_row.submitted_by,'approval.'||v_decision,v_note,
    jsonb_build_object('request_id',v_row.id,'request_type',v_row.request_type,'source_type',v_row.source_type,'source_id',v_row.source_id));

  return jsonb_build_object('ok',true,'request_id',v_row.id,'decision',v_decision,'decided_at',v_row.decided_at);
end;
$$;
revoke all on function public.review_approval_request(uuid,text,text) from public,anon;
grant execute on function public.review_approval_request(uuid,text,text) to authenticated,service_role;

insert into public.approval_requests(
  request_type,title,summary,status,submitted_by,submitted_at,decided_by,decided_at,decision_note,
  entity_type,entity_id,source_type,source_id,metadata
)
select case
         when lower(d.content_type) like '%vfx%' then 'vfx'
         when lower(d.content_type) like '%abilit%' then 'ability'
         when lower(d.content_type) like '%anim%' then 'animation'
         when lower(d.content_type) like '%map%' then 'map'
         when lower(d.content_type) like '%world%' then 'world'
         when lower(d.content_type) like '%skin%' or lower(d.content_type) like '%appearance%' then 'skin'
         when lower(d.content_type) like '%item%' or lower(d.content_type) like '%equipment%' then 'item'
         else 'other'
       end,
       coalesce(nullif(d.display_name,''),'Contenido sin nombre'),'Contenido universal enviado por un editor para revisión.',
       cr.status,cr.owner_user_id,cr.submitted_at,cr.decided_by,cr.decided_at,cr.note,d.content_type,cr.revision_id::text,
       'content_review',cr.id,jsonb_build_object('revision_id',cr.revision_id,'content_id',rev.content_id,'content_type',d.content_type)
from public.content_review_requests cr
join public.content_definition_revisions rev on rev.id=cr.revision_id
join public.content_definitions d on d.id=rev.definition_id
on conflict(source_type,source_id) where source_id is not null do nothing;

drop trigger if exists content_review_mirror_approval on public.content_review_requests;
create trigger content_review_mirror_approval after insert or update of status,decided_by,decided_at,note on public.content_review_requests
for each row execute function kelo_private.mirror_content_review_to_approval();

drop trigger if exists approval_request_renotify_admins on public.approval_requests;
create trigger approval_request_renotify_admins after update of status on public.approval_requests
for each row when (old.status<>'pending' and new.status='pending') execute function kelo_private.notify_new_approval_request();

comment on function kelo_private.mirror_content_review_to_approval() is 'Mirrors universal creator content reviews into the central ApprovalRequest inbox.';

commit;
