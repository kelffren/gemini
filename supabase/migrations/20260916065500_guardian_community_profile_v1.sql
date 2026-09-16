-- KELO-INDEX
-- area: SUPABASE / GUARDIAN COMMUNITY PROFILE
-- owner: KeloGuardianCommunity
-- keys: GUARDIAN COMMUNITY PROFILE CONTRIBUTION ATTESTATION QUORUM CROSS-DEVICE
-- purpose: persiste reconocimiento Community Builder solo desde atestaciones autenticadas y consenso de al menos dos cuentas Guardian activas
-- online: RPC autenticado; localStorage puede cachear pero nunca otorgar crédito
-- do-not: NO KC; NO leaderboard global; NO confiar contadores cliente; NO exponer node_id
begin;

create table if not exists kelo_private.guardian_community_attestations (
  job_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id text not null,
  asset_hash text not null,
  preset text not null,
  master_epoch bigint not null,
  created_at timestamptz not null default now(),
  primary key(job_id,user_id,node_id),
  constraint guardian_community_attest_job_format check (job_id ~ '^community:[a-f0-9]{64}$'),
  constraint guardian_community_attest_hash_format check (asset_hash ~ '^[a-f0-9]{64}$'),
  constraint guardian_community_attest_node_format check (node_id ~ '^[A-Za-z0-9:_-]{8,96}$'),
  constraint guardian_community_attest_preset check (preset in ('material-noise-v1','aura-field-v1','terrain-speckle-v1'))
);
create index if not exists guardian_community_attest_lookup_idx on kelo_private.guardian_community_attestations(job_id,master_epoch,asset_hash,created_at desc);

create table if not exists kelo_private.guardian_community_assets (
  asset_hash text primary key,
  job_id text not null unique,
  preset text not null,
  master_epoch bigint not null,
  contributor_count integer not null default 0 check (contributor_count between 2 and 1000),
  verified_at timestamptz not null default now(),
  constraint guardian_community_assets_hash_format check (asset_hash ~ '^[a-f0-9]{64}$'),
  constraint guardian_community_assets_job_format check (job_id ~ '^community:[a-f0-9]{64}$'),
  constraint guardian_community_assets_preset check (preset in ('material-noise-v1','aura-field-v1','terrain-speckle-v1'))
);

create table if not exists public.guardian_community_contributions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_hash text not null,
  preset text not null,
  contributor_count integer not null check (contributor_count between 2 and 1000),
  verified_at timestamptz not null default now(),
  unique(user_id,asset_hash),
  constraint guardian_community_contrib_hash_format check (asset_hash ~ '^[a-f0-9]{64}$'),
  constraint guardian_community_contrib_preset check (preset in ('material-noise-v1','aura-field-v1','terrain-speckle-v1'))
);
create index if not exists guardian_community_contributions_user_idx on public.guardian_community_contributions(user_id,verified_at desc);

alter table public.guardian_community_contributions enable row level security;
revoke all on public.guardian_community_contributions from public,anon,authenticated;
revoke all on kelo_private.guardian_community_attestations,kelo_private.guardian_community_assets from public,anon,authenticated;

create or replace function kelo_private.guardian_community_profile_json(p_uid uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_count bigint:=0;
  v_first timestamptz;
  v_last timestamptz;
  v_receipts jsonb:='[]'::jsonb;
begin
  select count(*),min(verified_at),max(verified_at)
    into v_count,v_first,v_last
    from public.guardian_community_contributions
    where user_id=p_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
      'receiptId','gc:'||c.id::text,
      'assetHash',c.asset_hash,
      'preset',c.preset,
      'contributors',c.contributor_count,
      'at',(extract(epoch from c.verified_at)*1000)::bigint,
      'consensus',true
    ) order by c.verified_at desc),'[]'::jsonb)
    into v_receipts
    from (
      select id,asset_hash,preset,contributor_count,verified_at
      from public.guardian_community_contributions
      where user_id=p_uid
      order by verified_at desc
      limit 50
    ) c;

  return jsonb_build_object(
    'consensusBuilds',v_count,
    'firstContributionAt',case when v_first is null then null else (extract(epoch from v_first)*1000)::bigint end,
    'lastContributionAt',case when v_last is null then null else (extract(epoch from v_last)*1000)::bigint end,
    'recentReceipts',v_receipts,
    'serverAuthoritative',true,
    'economicValue',0,
    'gameplayAdvantage',false
  );
end;
$$;
revoke all on function kelo_private.guardian_community_profile_json(uuid) from public,anon,authenticated;

create or replace function public.guardian_community_profile()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return jsonb_build_object(
    'ok',true,
    'source','guardian-community-supabase-v1',
    'serverTime',(extract(epoch from now())*1000)::bigint,
    'profile',kelo_private.guardian_community_profile_json(v_uid)
  );
end;
$$;
revoke all on function public.guardian_community_profile() from public,anon;
grant execute on function public.guardian_community_profile() to authenticated,service_role;

create or replace function public.guardian_community_attest(
  p_node_id text,
  p_job_id text,
  p_asset_hash text,
  p_preset text,
  p_master_epoch bigint
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=(select auth.uid());
  v_matching integer:=0;
  v_verified boolean:=false;
  v_asset kelo_private.guardian_community_assets%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  p_node_id:=coalesce(p_node_id,'');
  p_job_id:=lower(coalesce(p_job_id,''));
  p_asset_hash:=lower(coalesce(p_asset_hash,''));
  p_preset:=coalesce(p_preset,'');
  if p_node_id !~ '^[A-Za-z0-9:_-]{8,96}$' then raise exception 'GUARDIAN_NODE_ID_INVALID'; end if;
  if p_job_id !~ '^community:[a-f0-9]{64}$' then raise exception 'GUARDIAN_COMMUNITY_JOB_INVALID'; end if;
  if p_asset_hash !~ '^[a-f0-9]{64}$' then raise exception 'GUARDIAN_COMMUNITY_HASH_INVALID'; end if;
  if p_job_id <> 'community:'||p_asset_hash then raise exception 'GUARDIAN_COMMUNITY_JOB_HASH_MISMATCH'; end if;
  if p_preset not in ('material-noise-v1','aura-field-v1','terrain-speckle-v1') then raise exception 'GUARDIAN_COMMUNITY_PRESET_INVALID'; end if;
  if p_master_epoch is null or p_master_epoch<1 then raise exception 'GUARDIAN_COMMUNITY_EPOCH_INVALID'; end if;

  if not exists(
    select 1 from public.guardian_master_lease l
    where l.singleton=1 and l.epoch=p_master_epoch and l.user_id is not null and l.expires_at>now()
  ) then raise exception 'GUARDIAN_COMMUNITY_MASTER_EPOCH_STALE'; end if;

  if not exists(
    select 1 from public.guardian_nodes n
    where n.user_id=v_uid and n.node_id=p_node_id and n.enabled=true
      and n.last_heartbeat_at>now()-interval '45 seconds'
      and n.recommended_roles@>array['asset-gpu-worker']::text[]
  ) then raise exception 'GUARDIAN_COMMUNITY_GPU_NODE_NOT_ELIGIBLE'; end if;

  delete from kelo_private.guardian_community_attestations where created_at<now()-interval '10 minutes';

  insert into kelo_private.guardian_community_attestations(job_id,user_id,node_id,asset_hash,preset,master_epoch)
  values(p_job_id,v_uid,p_node_id,p_asset_hash,p_preset,p_master_epoch)
  on conflict(job_id,user_id,node_id) do nothing;

  select count(distinct a.user_id)
    into v_matching
    from kelo_private.guardian_community_attestations a
    where a.job_id=p_job_id and a.master_epoch=p_master_epoch and a.asset_hash=p_asset_hash and a.preset=p_preset;

  if v_matching>=2 then
    insert into kelo_private.guardian_community_assets(asset_hash,job_id,preset,master_epoch,contributor_count,verified_at)
    values(p_asset_hash,p_job_id,p_preset,p_master_epoch,v_matching,now())
    on conflict(asset_hash) do update set contributor_count=greatest(kelo_private.guardian_community_assets.contributor_count,excluded.contributor_count);

    insert into public.guardian_community_contributions(user_id,asset_hash,preset,contributor_count,verified_at)
    select distinct a.user_id,p_asset_hash,p_preset,v_matching,now()
    from kelo_private.guardian_community_attestations a
    where a.job_id=p_job_id and a.master_epoch=p_master_epoch and a.asset_hash=p_asset_hash and a.preset=p_preset
    on conflict(user_id,asset_hash) do update set contributor_count=greatest(public.guardian_community_contributions.contributor_count,excluded.contributor_count);
  end if;

  select * into v_asset from kelo_private.guardian_community_assets where asset_hash=p_asset_hash and job_id=p_job_id;
  v_verified:=found;

  if v_verified and not exists(select 1 from public.guardian_community_contributions where user_id=v_uid and asset_hash=p_asset_hash) then
    insert into public.guardian_community_contributions(user_id,asset_hash,preset,contributor_count,verified_at)
    values(v_uid,p_asset_hash,p_preset,greatest(2,v_asset.contributor_count),now())
    on conflict(user_id,asset_hash) do nothing;
  end if;

  return jsonb_build_object(
    'ok',true,
    'source','guardian-community-supabase-v1',
    'verified',v_verified,
    'quorum',2,
    'matchingAccounts',v_matching,
    'asset',case when v_verified then jsonb_build_object(
      'assetHash',v_asset.asset_hash,
      'preset',v_asset.preset,
      'contributors',v_asset.contributor_count,
      'verifiedAt',(extract(epoch from v_asset.verified_at)*1000)::bigint
    ) else null end,
    'profile',kelo_private.guardian_community_profile_json(v_uid)
  );
end;
$$;
revoke all on function public.guardian_community_attest(text,text,text,text,bigint) from public,anon;
grant execute on function public.guardian_community_attest(text,text,text,text,bigint) to authenticated,service_role;

create or replace function public.guardian_community_asset_status(p_asset_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=(select auth.uid());v_asset kelo_private.guardian_community_assets%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;
  p_asset_hash:=lower(coalesce(p_asset_hash,''));
  if p_asset_hash !~ '^[a-f0-9]{64}$' then raise exception 'GUARDIAN_COMMUNITY_HASH_INVALID'; end if;
  select * into v_asset from kelo_private.guardian_community_assets where asset_hash=p_asset_hash;
  if not found then return jsonb_build_object('ok',true,'verified',false,'asset',null); end if;
  return jsonb_build_object('ok',true,'verified',true,'asset',jsonb_build_object(
    'assetHash',v_asset.asset_hash,'preset',v_asset.preset,'contributors',v_asset.contributor_count,
    'verifiedAt',(extract(epoch from v_asset.verified_at)*1000)::bigint
  ));
end;
$$;
revoke all on function public.guardian_community_asset_status(text) from public,anon;
grant execute on function public.guardian_community_asset_status(text) to authenticated,service_role;

commit;
