/* KELO-INDEX
 * area: QA / GUARDIAN PVP
 * keys: GUARDIAN PVP SHARED AUTHORITY PARITY FIXED STEP LEASE DOUBLE AUTHORITY FIRST USE
 * purpose: smoke test del core compartido y contratos estáticos del host/adaptador Guardian
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

const sharedSource=read('src/systems/pvp/shared-pvp-authority.js');
const serverSource=read('server/pvp-authority.js');
const hostSource=read('src/systems/guardian-pvp-host.js');
const adapterSource=read('src/systems/guardian-pvp-net-adapter.js');
const uiSource=read('src/ui/guardian-pvp-ui.js');
const registrySource=read('src/core/feature-registry.js');

assert.match(sharedSource,/KeloSharedPvPAuthority/);
assert.match(sharedSource,/module\.exports/);
assert.match(sharedSource,/FIXED_DT=1\/60/);
assert.match(sharedSource,/persistentAuthority:false/);
assert.match(sharedSource,/economyAuthority:false/);
assert.doesNotMatch(sharedSource,/localStorage|indexedDB|fetch\(/);

assert.match(serverSource,/shared-pvp-authority\.js/);
assert.doesNotMatch(serverSource,/function step\s*\(/);
assert.doesNotMatch(serverSource,/function resolveMelee\s*\(/);

assert.match(hostSource,/KeloSharedPvPAuthority\.createPvpAuthority/);
assert.match(hostSource,/KeloSimulation\.after\('guardian:pvp-host'/);
assert.match(hostSource,/MAX_CATCHUP_STEPS=5/);
assert.match(hostSource,/masterValid\(msg\.epoch\)/);
assert.match(hostSource,/persistentAuthority:false/);
assert.match(hostSource,/economyAuthority:false/);
assert.match(hostSource,/inventoryAuthority:false/);
assert.match(hostSource,/rewardsAuthority:false/);
assert.doesNotMatch(hostSource,/setInterval|localStorage|indexedDB/);

assert.match(adapterSource,/GUARDIAN_PVP_DOUBLE_AUTHORITY_BLOCKED/);
assert.match(adapterSource,/GUARDIAN_PVP_CENTRAL_SERVER_RETURNED/);
assert.match(adapterSource,/base\.sendCombatIntent/);
assert.match(adapterSource,/KeloSimulation\.after\('guardian:pvp-net-adapter'/);
assert.doesNotMatch(adapterSource,/setInterval/);

assert.match(uiSource,/INICIAR PVP LAB/);
assert.match(uiSource,/SERVIDOR CENTRAL ACTIVO/);
assert.match(uiSource,/permissionGrant:false/);

const order=[
 'src/systems/pvp/shared-pvp-authority.js?v=1',
 'src/systems/guardian-pvp-host.js?v=1',
 'engine-net.js?v=20260916-pvp-first-use-1',
 'src/systems/guardian-pvp-net-adapter.js?v=1',
 'src/systems/pvp-world.js?v=20260916-pvp-first-use-1',
 'src/ui/guardian-pvp-ui.js?v=1'
].map(x=>registrySource.indexOf(x));
assert.ok(order.every(n=>n>=0),'Guardian PvP files must exist in registry');
for(let i=1;i<order.length;i++)assert.ok(order[i]>order[i-1],`Guardian PvP load order invalid at ${i}`);

const pvp=require('../server/pvp-authority.js');
assert.equal(pvp.FIXED_DT,1/60);
const authority=pvp.createPvpAuthority();
const a={id:'audit-a',name:'A'},b={id:'audit-b',name:'B'};
assert.equal(authority.ingest(a,{sequence:1,action:'enter_pvp',phase:'none',moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()}).ok,true);
assert.equal(authority.ingest(b,{sequence:1,action:'enter_pvp',phase:'none',moveX:0,moveY:0,aimX:-1,aimY:0,clientTime:Date.now()}).ok,true);
const before=authority.snapshot(Date.now()).players['audit-a'];
assert.ok(before&&before.zone==='pvp');
assert.equal(authority.ingest(a,{sequence:2,action:'input',phase:'held',moveX:1,moveY:0,aimX:1,aimY:0,clientTime:Date.now()}).ok,true);
for(let i=0;i<12;i++)authority.step(pvp.FIXED_DT,Date.now()+i*17);
const after=authority.snapshot(Date.now()).players['audit-a'];
assert.ok(after.x>before.x,'shared authority must advance movement');
const stale=authority.ingest(a,{sequence:2,action:'input',phase:'held',moveX:0,moveY:0,aimX:1,aimY:0,clientTime:Date.now()});
assert.equal(stale.ok,false);
assert.equal(stale.reason,'STALE_SEQUENCE');
assert.equal(authority.audit().persistentAuthority,false);
assert.equal(authority.audit().economyAuthority,false);
authority.dispose();

console.log('GUARDIAN_PVP_HOST_AUDIT_OK',{fixedDt:pvp.FIXED_DT,doubleAuthorityBlocked:true,persistentAuthority:false});
