begin;

insert into public.permission_definitions(permission_key,description) values
  ('approval.submit','Enviar trabajo de editor a ApprovalRequest'),
  ('approval.view','Ver solicitudes de ApprovalRequest'),
  ('approval.review','Aprobar o rechazar solicitudes de ApprovalRequest'),
  ('approval.notifications','Recibir notificaciones de nuevas solicitudes de ApprovalRequest')
on conflict(permission_key) do update set description=excluded.description;

insert into public.role_permissions(role_key,permission_key) values
  ('creator','approval.submit')
on conflict do nothing;

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('asset','map','scene','skin','item','animation','vfx','ability','world','other')),
  title text not null,
  summary text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  entity_type text,
  entity_id text,
  source_type text not null default 'generic',
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  constraint approval_request_title_length check (char_length(title) between 1 and 120),
  constraint approval_request_summary_length check (summary is null or char_length(summary) <= 1200),
  constraint approval_request_decision_note_length check (decision_note is null or char_length(decision_note) <= 1200)
);
create index if not exists approval_requests_status_idx on public.approval_requests(status,submitted_at desc);
create index if not exists approval_requests_submitter_idx on public.approval_requests(submitted_by,submitted_at desc);
create unique index if not exists approval_requests_source_unique_idx on public.approval_requests(source_type,source_id) where source_id is not null;

create table if not exists public.account_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  topic text not null,
  entity_type text,
  entity_id text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_notification_kind_check check (kind in ('info','success','warning','error','approval')),
  constraint account_notification_title_length check (char_length(title) between 1 and 140),
  constraint account_notification_body_length check (body is null or char_length(body) <= 1000)
);
create index if not exists account_notifications_user_idx on public.account_notifications(user_id,created_at desc);
create index if not exists account_notifications_unread_idx on public.account_notifications(user_id,created_at desc) where read_at is null;

create or replace function kelo_private.approval_notification_targets()
returns table(user_id uuid) language sql stable security definer set search_path='' as $$
  with candidates as (
    select ar.user_id, true as is_admin
    from public.account_roles ar
    where ar.role_key='admin'
    union all
    select ap.user_id, false as is_admin
    from public.account_permissions ap
    where ap.permission_key='approval.notifications' and ap.enabled=true
    union all
    select ar.user_id, false as is_admin
    from public.account_roles ar
    join public.role_permissions rp on rp.role_key=ar.role_key
    where rp.permission_key='approval.notifications'
  )
  select distinct c.user_id
  from candidates c
  where c.is_admin
     or not exists(
       select 1 from public.account_permissions denied
       where denied.user_id=c.user_id
         and denied.permission_key='approval.notifications'
         and denied.enabled=false
     );
$$;
revoke all on function kelo_private.approval_notification_targets() from public,anon,authenticated;
grant execute on function kelo_private.approval_notification_targets() to service_role;

create or replace function kelo_private.notify_new_approval_request()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.account_notifications(user_id,kind,title,body,topic,entity_type,entity_id,data)
  select t.user_id,
         'approval',
         'Nueva solicitud en ApprovalRequest',
         left(new.title,1000),
         'approval_request',
         'approval_request',
         new.id::text,
         jsonb_build_object('request_id',new.id,'request_type',new.request_type,'status',new.status,'submitted_by',new.submitted_by)
  from kelo_private.approval_notification_targets() t
  where t.user_id<>new.submitted_by;
  return new;
end;
$$;

create or replace function kelo_private.mirror_asset_review_to_approval()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_name text;
  v_asset_id text;
begin
  select f.name,r.asset_id into v_name,v_asset_id
  from public.asset_revisions r
  join public.asset_families f on f.id=r.family_id
  where r.id=new.revision_id;

  insert into public.approval_requests(
    request_type,title,summary,status,submitted_by,submitted_at,decided_by,decided_at,decision_note,
    entity_type,entity_id,source_type,source_id,metadata
  ) values (
    'asset',
    coalesce(nullif(v_name,''),'Asset sin nombre'),
    'Asset enviado por Kelo Creators para revisión.',
    new.status,
    new.owner_user_id,
    new.submitted_at,
    new.decided_by,
    new.decided_at,
    new.note,
    'asset_revision',
    new.revision_id::text,
    'asset_review',
    new.id,
    jsonb_build_object('revision_id',new.revision_id,'asset_id',v_asset_id)
  )
  on conflict(source_type,source_id) where source_id is not null do update set
    status=excluded.status,
    decided_by=excluded.decided_by,
    decided_at=excluded.decided_at,
    decision_note=excluded.decision_note,
    metadata=public.approval_requests.metadata || excluded.metadata;
  return new;
end;
$$;

create or replace function public.submit_approval_request(
  p_request_type text,
  p_title text,
  p_summary text default null,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.approval_requests language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=(select auth.uid());
  v_type text:=lower(trim(coalesce(p_request_type,'')));
  v_title text:=trim(coalesce(p_title,''));
  v_summary text:=nullif(trim(coalesce(p_summary,'')),'');
  v_row public.approval_requests;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not kelo_private.has_permission('approval.submit') then raise exception 'APPROVAL_SUBMIT_DENIED'; end if;
  if v_type not in ('asset','map','scene','skin','item','animation','vfx','ability','world','other') then raise exception 'INVALID_APPROVAL_TYPE'; end if;
  if char_length(v_title)<1 or char_length(v_title)>120 then raise exception 'INVALID_APPROVAL_TITLE'; end if;
  if v_summary is not null and char_length(v_summary)>1200 then raise exception 'APPROVAL_SUMMARY_TOO_LONG'; end if;
  if octet_length(coalesce(p_metadata,'{}'::jsonb)::text)>32768 then raise exception 'APPROVAL_METADATA_TOO_LARGE'; end if;

  insert into public.approval_requests(request_type,title,summary,submitted_by,entity_type,entity_id,metadata)
  values(v_type,v_title,v_summary,v_uid,nullif(trim(coalesce(p_entity_type,'')),''),nullif(trim(coalesce(p_entity_id,'')),''),coalesce(p_metadata,'{}'::jsonb))
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.submit_approval_request(text,text,text,text,text,jsonb) from public,anon;
grant execute on function public.submit_approval_request(text,text,text,text,text,jsonb) to authenticated,service_role;

create or replace function public.list_approval_requests(p_status text default 'pending',p_limit integer default 100)
returns table(
  id uuid,request_type text,title text,summary text,status text,submitted_by uuid,submitted_by_name text,submitted_at timestamptz,
  decided_by uuid,decided_at timestamptz,decision_note text,entity_type text,entity_id text,source_type text,source_id uuid,metadata jsonb
) language plpgsql stable security definer set search_path='' as $$
declare
  v_status text:=lower(trim(coalesce(p_status,'pending')));
  v_limit integer:=greatest(1,least(coalesce(p_limit,100),250));
begin
  if not (kelo_private.has_permission('approval.view') or kelo_private.has_permission('approval.review')) then raise exception 'APPROVAL_VIEW_DENIED'; end if;
  if v_status not in ('pending','approved','rejected','cancelled','all') then raise exception 'INVALID_APPROVAL_STATUS'; end if;
  return query
  select q.id,q.request_type,q.title,q.summary,q.status,q.submitted_by,p.display_name,q.submitted_at,
         q.decided_by,q.decided_at,q.decision_note,q.entity_type,q.entity_id,q.source_type,q.source_id,q.metadata
  from public.approval_requests q
  left join public.profiles p on p.user_id=q.submitted_by
  where v_status='all' or q.status=v_status
  order by case when q.status='pending' then 0 else 1 end,q.submitted_at desc
  limit v_limit;
end;
$$;
revoke all on function public.list_approval_requests(text,integer) from public,anon;
grant execute on function public.list_approval_requests(text,integer) to authenticated,service_role;

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
  end if;

  insert into public.account_notifications(user_id,kind,title,body,topic,entity_type,entity_id,data)
  values(
    v_row.submitted_by,
    case when v_decision='approved' then 'success' else 'warning' end,
    case when v_decision='approved' then 'Solicitud aprobada' else 'Solicitud rechazada' end,
    left(coalesce(v_note,v_row.title),1000),
    'approval_decision',
    'approval_request',
    v_row.id::text,
    jsonb_build_object('request_id',v_row.id,'request_type',v_row.request_type,'decision',v_decision,'decided_by',v_actor)
  );

  insert into public.account_admin_audit_events(actor_user_id,target_user_id,action,reason,metadata)
  values(v_actor,v_row.submitted_by,'approval.'||v_decision,v_note,jsonb_build_object('request_id',v_row.id,'request_type',v_row.request_type,'source_type',v_row.source_type,'source_id',v_row.source_id));

  return jsonb_build_object('ok',true,'request_id',v_row.id,'decision',v_decision,'decided_at',v_row.decided_at);
end;
$$;
revoke all on function public.review_approval_request(uuid,text,text) from public,anon;
grant execute on function public.review_approval_request(uuid,text,text) to authenticated,service_role;

create or replace function public.get_my_approval_unread_count()
returns integer language sql stable security definer set search_path='' as $$
  select count(*)::integer
  from public.account_notifications n
  where n.user_id=(select auth.uid())
    and n.read_at is null
    and n.topic='approval_request';
$$;
revoke all on function public.get_my_approval_unread_count() from public,anon;
grant execute on function public.get_my_approval_unread_count() to authenticated,service_role;

create or replace function public.mark_my_approval_notifications_read()
returns integer language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid()); v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.account_notifications
  set read_at=now()
  where user_id=v_uid and topic='approval_request' and read_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.mark_my_approval_notifications_read() from public,anon;
grant execute on function public.mark_my_approval_notifications_read() to authenticated,service_role;

alter table public.approval_requests enable row level security;
alter table public.account_notifications enable row level security;
revoke all on public.approval_requests,public.account_notifications from anon,authenticated;
grant select on public.account_notifications to authenticated;

drop policy if exists account_notifications_read_own on public.account_notifications;
create policy account_notifications_read_own on public.account_notifications for select to authenticated
using ((select auth.uid()) is not null and user_id=(select auth.uid()));

insert into public.approval_requests(
  request_type,title,summary,status,submitted_by,submitted_at,decided_by,decided_at,decision_note,
  entity_type,entity_id,source_type,source_id,metadata
)
select 'asset',coalesce(nullif(f.name,''),'Asset sin nombre'),'Asset enviado por Kelo Creators para revisión.',r.status,r.owner_user_id,r.submitted_at,r.decided_by,r.decided_at,r.note,
       'asset_revision',r.revision_id::text,'asset_review',r.id,jsonb_build_object('revision_id',r.revision_id,'asset_id',rev.asset_id)
from public.asset_review_requests r
join public.asset_revisions rev on rev.id=r.revision_id
join public.asset_families f on f.id=rev.family_id
on conflict(source_type,source_id) where source_id is not null do nothing;

drop trigger if exists asset_review_mirror_approval on public.asset_review_requests;
create trigger asset_review_mirror_approval after insert or update of status,decided_by,decided_at,note on public.asset_review_requests
for each row execute function kelo_private.mirror_asset_review_to_approval();

drop trigger if exists approval_request_notify_admins on public.approval_requests;
create trigger approval_request_notify_admins after insert on public.approval_requests
for each row when (new.status='pending') execute function kelo_private.notify_new_approval_request();

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='account_notifications') then
    alter publication supabase_realtime add table public.account_notifications;
  end if;
end $$;

comment on table public.approval_requests is 'Universal editor-to-admin approval inbox. Asset reviews are mirrored here; approval does not bypass server-authoritative publication.';
comment on table public.account_notifications is 'Per-account notification inbox. ApprovalRequest notifications are created server-side for authorized reviewers.';

commit;
