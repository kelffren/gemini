import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../src/physics/collision-utils.js');
function assert(ok,msg){if(!ok)throw new Error(msg);}
function overlapsCircleAabb(cx,cy,r,b){const x=Math.max(b.x,Math.min(cx,b.x+b.w)),y=Math.max(b.y,Math.min(cy,b.y+b.h));const dx=cx-x,dy=cy-y;return dx*dx+dy*dy<r*r;}

// Geometry primitives remain deterministic.
const box={x:100,y:100,w:80,h:40};
for(const [x,y] of [[140,120],[101,120],[179,120],[140,101],[140,139]]){
  const r=C.resolveCircleAABB(x,y,20,box);assert(r.collided,`inside point not detected ${x},${y}`);
  assert(!overlapsCircleAabb(x+r.pushX,y+r.pushY,20,box),`inside resolution did not exit box ${x},${y}`);
}
const wall={x:100,y:100,w:150,h:24};
const t=C.segmentAabbHitT(140,90,140,132,wall,16);
assert(t!=null,'42px projectile step tunneled through 24px wall');
assert(C.segmentAabbHitT(20,20,40,20,wall,16)==null,'false positive segment hit');

// Foundation V2 lifecycle: one owner can replace its whole set without touching another owner.
const obstacles=[{id:'legacy-wall',x:0,y:0,w:10,h:10}];
C.attachLegacyObstacleArray(obstacles,{adoptExistingOwner:'core-static'});
let audit=C.ownerSnapshot();
assert(audit.legacyAttached&&audit.owners['core-static']===1,'legacy core obstacles were not adopted');
C.replaceOwner('property:placements',[
  {id:'property:a',x:20,y:20,w:8,h:8},
  {id:'property:b',x:40,y:20,w:8,h:8}
]);
assert(obstacles.length===3,'property owner did not publish exactly two colliders');
C.replaceOwner('property:placements',[{id:'property:b',x:44,y:24,w:8,h:8}]);
assert(obstacles.length===2,'owner replacement duplicated colliders');
assert(obstacles.some(x=>x.id==='legacy-wall'),'owner replacement deleted foreign/core collider');
assert(obstacles.filter(x=>x._keloCollisionOwner==='property:placements').length===1,'property bucket count mismatch');
C.upsert('abilities:walls',{id:'wall-1',x:60,y:20,w:20,h:6,blocksProjectiles:true});
assert(obstacles.some(x=>x.id==='wall-1'&&x._keloCollisionOwner==='abilities:walls'),'dynamic collider upsert missing');
C.remove('abilities:walls','wall-1');
assert(!obstacles.some(x=>x.id==='wall-1'),'dynamic collider remove failed');
C.clearOwner('property:placements');
assert(obstacles.length===1&&obstacles[0].id==='legacy-wall','clearOwner affected foreign collider');

// Boot contract: collision owner attaches immediately after engine-a creates the legacy array.
const index=fs.readFileSync('index.html','utf8');
const engineAt=index.indexOf('engine-a.js?');
const attachAt=index.indexOf('attachLegacyObstacleArray(obstacles');
const inputAt=index.indexOf('src/core/input-system.js?');
assert(engineAt>=0&&attachAt>engineAt&&inputAt>attachAt,'legacy obstacle view is not attached between engine-a and KeloInput');

// Migrated LIVE producers must publish through KELO_COLLISION, never splice/push the shared view.
for(const file of [
  'src/environment/generic-props.js',
  'src/property/property-system.js',
  'src/environment/world-builder-system.js'
]){
  const src=fs.readFileSync(file,'utf8');
  assert(!/\bobstacles\s*\.\s*(?:push|splice|pop|shift|unshift)\s*\(/.test(src),`${file} still mutates obstacles directly`);
  assert(/KELO_COLLISION|\bK=window\.KELO_COLLISION\b/.test(src),`${file} does not consume KELO_COLLISION owner`);
}

console.log(JSON.stringify({
  ok:true,
  version:C.version,
  primitives:true,
  ownership:true,
  foreignOwnerIsolation:true,
  legacyView:true,
  migratedProducers:['generic-props','property','world-builder']
},null,2));
