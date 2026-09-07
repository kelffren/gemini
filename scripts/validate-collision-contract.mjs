import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const C=require('../src/physics/collision-utils.js');
function assert(ok,msg){if(!ok)throw new Error(msg);}
function overlapsCircleAabb(cx,cy,r,b){const x=Math.max(b.x,Math.min(cx,b.x+b.w)),y=Math.max(b.y,Math.min(cy,b.y+b.h));const dx=cx-x,dy=cy-y;return dx*dx+dy*dy<r*r;}
const box={x:100,y:100,w:80,h:40};
for(const [x,y] of [[140,120],[101,120],[179,120],[140,101],[140,139]]){
  const r=C.resolveCircleAABB(x,y,20,box);assert(r.collided,`inside point not detected ${x},${y}`);
  assert(!overlapsCircleAabb(x+r.pushX,y+r.pushY,20,box),`inside resolution did not exit box ${x},${y}`);
}
const wall={x:100,y:100,w:150,h:24};
const t=C.segmentAabbHitT(140,90,140,132,wall,16);
assert(t!=null,'42px projectile step tunneled through 24px wall');
assert(C.segmentAabbHitT(20,20,40,20,wall,16)==null,'false positive segment hit');
console.log('PASS collision primitives: inside-AABB recovery + swept wall hit');
