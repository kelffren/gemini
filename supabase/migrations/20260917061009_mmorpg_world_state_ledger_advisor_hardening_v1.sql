drop index if exists public.world_event_ledger_cell_revision_idx;

create index if not exists world_event_ledger_actor_user_idx
  on public.world_event_ledger(actor_user_id, created_at desc)
  where actor_user_id is not null;

create index if not exists world_event_ledger_character_idx
  on public.world_event_ledger(character_id, created_at desc)
  where character_id is not null;

create policy world_cell_snapshots_deny_clients
on public.world_cell_snapshots
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

create policy world_event_ledger_deny_clients
on public.world_event_ledger
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

comment on policy world_cell_snapshots_deny_clients on public.world_cell_snapshots is 'Explicit deny: world state is trusted-server only.';
comment on policy world_event_ledger_deny_clients on public.world_event_ledger is 'Explicit deny: world event ledger is trusted-server only.';
