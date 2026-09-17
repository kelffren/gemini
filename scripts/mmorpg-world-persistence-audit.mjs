/* KELO-INDEX
 * area: MMORPG / WAVE 1 WORLD PERSISTENCE QA
 * owner: Main Stability Gate
 * purpose: prove durable world state + event ledger contracts without touching production from CI
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createWorldStateStore}=require('../server/world-state-store.js');

let tick=Date.parse('2026-09-17T06:00:00Z');
const local=createWorldStateStore({clock:()=>tick++});
assert.equal(local.audit().durable,false);
assert.equal(local.audit().source,'memory-world-transition');
assert.equal(local.audit().clientWritable,false);

const first=await local.mutate({cellId:'world:0:0',eventId:'qa.event.1',expectedRevision:0,eventType:'world.qa',patch:{treeCount:2},aggregateId:'qa'});
assert.deepEqual(first,{cellId:'world:0:0',revision:1,schemaVersion:1,eventId:'qa.event.1',eventType:'world.qa',aggregateId:'qa'});
assert.equal(Object.prototype.hasOwnProperty.call(first,'state'),false,'idempotency result must stay compact');
let snapshot=await local.load('world:0:0');
assert.equal(snapshot.revision,1);
assert.deepEqual(snapshot.state,{treeCount:2});
let replay=await local.replay('world:0:0',0,10);
assert.equal(replay.length,1);
assert.equal(replay[0].eventId,'qa.event.1');
assert.deepEqual(replay[0].payload.patch,{treeCount:2});

const retry=await local.mutate({cellId:'world:0:0',eventId:'qa.event.1',expectedRevision:0,eventType:'world.qa',patch:{treeCount:999},aggregateId:'qa'});
assert.deepEqual(retry,first,'same event ID must return original compact result');
snapshot=await local.load('world:0:0');
assert.equal(snapshot.state.treeCount,2,'idempotent retry must not reapply patch');
assert.equal((await local.replay('world:0:0')).length,1,'idempotent retry must not append duplicate event');

await assert.rejects(()=>local.mutate({cellId:'world:0:0',eventId:'qa.event.stale',expectedRevision:0,eventType:'world.qa',patch:{treeCount:3}}),/WORLD_REVISION_CONFLICT/);
const second=await local.mutate({cellId:'world:0:0',eventId:'qa.event.2',expectedRevision:1,eventType:'world.qa',patch:{fountainOpen:true}});
assert.equal(second.revision,2);
snapshot=await local.load('world:0:0');
assert.deepEqual(snapshot.state,{treeCount:2,fountainOpen:true});
replay=await local.replay('world:0:0',1,10);
assert.equal(replay.length,1);
assert.equal(replay[0].revision,2);
await assert.rejects(()=>local.mutate({cellId:'world:0:0',eventId:'qa.event.big',expectedRevision:2,eventType:'world.qa',patch:{blob:'x'.repeat(130000)}}),/WORLD_PATCH_TOO_LARGE/);

const calls=[];
const fakeBridge={
  configured:true,
  async worldLoad(cellId){calls.push(['load',cellId]);return{cellId,revision:7,state:{durable:true}};},
  async worldMutate(input){calls.push(['mutate',input.cellId,input.eventId]);return{cellId:input.cellId,revision:8,eventId:input.eventId,eventType:input.eventType,aggregateId:input.aggregateId,schemaVersion:1};},
  async worldReplay(cellId,after,limit){calls.push(['replay',cellId,after,limit]);return[{cell_id:cellId,revision:8}];}
};
const durable=createWorldStateStore({bridge:fakeBridge});
assert.equal(durable.audit().durable,true);
assert.equal(durable.audit().source,'supabase-world-ledger');
assert.equal((await durable.load('world:4:-2')).revision,7);
assert.equal((await durable.mutate({cellId:'world:4:-2',eventId:'evt.durable.1',expectedRevision:7,eventType:'world.test',patch:{x:1}})).revision,8);
assert.equal((await durable.replay('world:4:-2',7,25)).length,1);
assert.deepEqual(calls.map(row=>row[0]),['load','mutate','replay']);

const baseMigration=fs.readFileSync('supabase/migrations/20260917060152_mmorpg_world_state_ledger_v1.sql','utf8');
const hardening=fs.readFileSync('supabase/migrations/20260917060425_mmorpg_world_state_ledger_hardening_v1.sql','utf8');
for(const token of [
  'public.world_cell_snapshots','public.world_event_ledger','world_apply_mutation','world_replay_events','world_get_snapshot',
  'pg_advisory_xact_lock','public.server_idempotency','public.server_outbox','public.server_audit_events',
  'enable row level security','revoke all on public.world_cell_snapshots, public.world_event_ledger from anon, authenticated',
  'grant execute on function public.world_apply_mutation'
])assert.ok(baseMigration.includes(token),`base world migration missing ${token}`);
assert.match(baseMigration,/unique\(cell_id, revision\)/);
assert.match(baseMigration,/event_id text not null unique/);
assert.match(baseMigration,/security invoker/);
for(const token of ['pg_column_size(p_patch) > 120000','pg_column_size(v_new_state) > 450000','WORLD_PATCH_TOO_LARGE','WORLD_STATE_TOO_LARGE'])assert.ok(hardening.includes(token),`hardening missing ${token}`);
assert.ok(!hardening.includes("'state',v_new_state"),'idempotency result must not duplicate full world state');

const edge=fs.readFileSync('supabase/functions/kelo-server-state/index.ts','utf8');
for(const token of ["op==='world:load'","op==='world:replay'","op==='world:mutate'",'/rest/v1/rpc/world_get_snapshot','/rest/v1/rpc/world_replay_events','/rest/v1/rpc/world_apply_mutation','x-kelo-server-key'])assert.ok(edge.includes(token),`edge world bridge missing ${token}`);
assert.match(edge,/MAX_WORLD_PATCH_BYTES = 120_000/);
assert.match(edge,/WORLD_REVISION_CONFLICT'\?409:400/);

const bridge=fs.readFileSync('server/server-state-bridge.js','utf8');
for(const token of ['worldLoad','worldReplay','worldMutate','kelo-server-state-bridge-v3-world-ledger'])assert.ok(bridge.includes(token),`server bridge missing ${token}`);
assert.match(bridge,/x-kelo-server-key/);

const bootstrap=fs.readFileSync('server/sprite-ai-bootstrap.js','utf8');
assert.match(bootstrap,/createWorldStateStore/);
assert.match(bootstrap,/globalThis\.KeloWorldStateStore=worldState/);
assert.match(bootstrap,/createServerStateBridge/);

const serverIndex=fs.readFileSync('server/index.js','utf8');
assert.ok(!serverIndex.includes("msg.t==='world:mutate'"),'public websocket must not expose direct world mutation');
assert.ok(!serverIndex.includes("msg.t==='world:commit'"),'public websocket must not expose direct world commit');

const bindings=JSON.parse(fs.readFileSync('docs/mmorpg-wave1-owner-bindings.json','utf8'));
const statuses=Object.fromEntries(bindings.bindings.map(row=>[row.systemId,row.status]));
assert.equal(statuses['persistent-world-state'],'integrated');
assert.equal(statuses['world-event-ledger'],'integrated');
assert.equal(bindings.bindings.filter(row=>row.status==='integrated').length,6);
assert.equal(bindings.bindings.filter(row=>row.status==='foundation-active').length,3);

console.log('MMORPG WORLD PERSISTENCE AUDIT PASS durable-contract=ok memory-fallback=ok idempotency=ok revision-cas=ok replay=ok rls=ok edge=ok websocket-write=blocked integrated=6 foundation=3');
