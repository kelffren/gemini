begin;

create table if not exists public.asset_guardian_provenance (
  revision_id uuid primary key references public.asset_revisions(id) on delete cascade,
  asset_hash text not null,
  preset text not null check (preset in ('material-noise-v1','aura-field-v1','terrain-speckle-v1')),
  contributor_count integer not null check (contributor_count >= 2),
  guardian_verified_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  constraint asset_guardian_provenance_hash_format check (asset_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists asset_guardian_provenance_hash_idx
  on public.asset_guardian_provenance(asset_hash);

alter table public.asset_guardian_provenance enable row level security;

revoke all on public.asset_guardian_provenance from anon, authenticated;
grant select on public.asset_guardian_provenance to anon, authenticated;

drop policy if exists asset_guardian_provenance_published_read on public.asset_guardian_provenance;
create policy asset_guardian_provenance_published_read
on public.asset_guardian_provenance
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.asset_publications p
    where p.revision_id = asset_guardian_provenance.revision_id
      and p.is_active = true
  )
);

create or replace function public.record_asset_guardian_provenance(
  p_revision_id uuid,
  p_asset_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := lower(trim(coalesce(p_asset_hash,'')));
  v_revision public.asset_revisions%rowtype;
  v_guardian kelo_private.guardian_community_assets%rowtype;
  v_row public.asset_guardian_provenance%rowtype;
begin
  if p_revision_id is null then
    raise exception 'REVISION_ID_REQUIRED';
  end if;
  if v_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_ASSET_HASH';
  end if;

  select * into v_revision
  from public.asset_revisions
  where id = p_revision_id;
  if not found then
    raise exception 'ASSET_REVISION_NOT_FOUND';
  end if;
  if lower(v_revision.content_hash) <> v_hash then
    raise exception 'ASSET_HASH_REVISION_MISMATCH';
  end if;

  select * into v_guardian
  from kelo_private.guardian_community_assets
  where asset_hash = v_hash;

  if not found then
    delete from public.asset_guardian_provenance
    where revision_id = p_revision_id;
    return jsonb_build_object(
      'ok', true,
      'verified', false,
      'source', 'guardian-community-supabase-v1',
      'assetHash', v_hash
    );
  end if;

  if v_guardian.contributor_count < 2 then
    raise exception 'GUARDIAN_QUORUM_INVALID';
  end if;

  insert into public.asset_guardian_provenance(
    revision_id,
    asset_hash,
    preset,
    contributor_count,
    guardian_verified_at,
    recorded_at
  ) values (
    p_revision_id,
    v_hash,
    v_guardian.preset,
    v_guardian.contributor_count,
    v_guardian.verified_at,
    now()
  )
  on conflict (revision_id) do update set
    asset_hash = excluded.asset_hash,
    preset = excluded.preset,
    contributor_count = excluded.contributor_count,
    guardian_verified_at = excluded.guardian_verified_at,
    recorded_at = now()
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'verified', true,
    'source', 'guardian-community-supabase-v1',
    'assetHash', v_row.asset_hash,
    'communityBuilt', true,
    'preset', v_row.preset,
    'contributorCount', v_row.contributor_count,
    'verifiedAt', extract(epoch from v_row.guardian_verified_at) * 1000
  );
end;
$$;

revoke all on function public.record_asset_guardian_provenance(uuid,text) from public, anon, authenticated;
grant execute on function public.record_asset_guardian_provenance(uuid,text) to service_role;

comment on table public.asset_guardian_provenance is
  'Server-owned public aggregate proof that a published immutable revision matches a Guardian community-compute asset sealed by authenticated quorum. No node IDs or contributor tokens are stored.';
comment on function public.record_asset_guardian_provenance(uuid,text) is
  'Service-role-only bridge from private Guardian quorum truth to public aggregate publication provenance. Never trusts client provenance fields.';

commit;
