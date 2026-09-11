import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveSelectHitRadius } from '../src/studio/tools/select-tool.mjs';

assert.equal(resolveSelectHitRadius(null,{root:{innerWidth:390,matchMedia:()=>({matches:true})}}),18,'coarse mobile pointers need an 18 world-unit hit radius');
assert.equal(resolveSelectHitRadius(null,{root:{innerWidth:1200,matchMedia:()=>({matches:true})}}),0,'wide coarse layouts must not silently enlarge desktop selection');
assert.equal(resolveSelectHitRadius(null,{root:{innerWidth:390,matchMedia:()=>({matches:false})}}),0,'fine pointers must retain exact desktop selection');
assert.equal(resolveSelectHitRadius(7,{root:{innerWidth:390,matchMedia:()=>({matches:true})}}),7,'explicit radius must override automatic mobile tolerance');
assert.equal(resolveSelectHitRadius(0,{root:{innerWidth:390,matchMedia:()=>({matches:true})}}),0,'callers must be able to request exact hit testing');

const source=fs.readFileSync(new URL('../src/studio/tools/select-tool.mjs',import.meta.url),'utf8');
assert.match(source,/MOBILE_HIT_RADIUS=18/,'mobile hit radius must remain explicit and auditable');
assert.match(source,/\(pointer: coarse\)/,'touch tolerance must be gated by coarse pointer capability');
assert.match(source,/innerWidth\|\|9999\)<=MOBILE_MAX/,'touch tolerance must remain mobile-scoped');
assert.match(source,/kernel\.spatial\.queryRect/,'expanded hit testing must reuse the spatial index');
assert.match(source,/hitDistanceSquared/,'expanded candidates must be ranked by distance to the tap');
assert.match(source,/\.sort\(\(a,b\)=>a\.d-b\.d\|\|a\.index-b\.index\)/,'nearest object must win while preserving stack order on ties');
assert.match(source,/kernel\.spatial\.queryPoint/,'desktop exact hit testing must remain available');
assert.doesNotMatch(source,/kernel\.execute/,'selection hit slop must not create world commands');
assert.doesNotMatch(source,/KELO_WORLD_EDIT/,'selection hit slop must not write authority directly');

console.log(JSON.stringify({ok:true,mobileHitSlop:true,radius:18,coarsePointerOnly:true,nearestCandidate:true,desktopExact:true,commandBusUntouched:true},null,2));
