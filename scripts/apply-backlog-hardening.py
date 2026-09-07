from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'anchor missing in {path}: {old[:120]!r}')
    p.write_text(s.replace(old, new, 1))


# Pure collision primitives shared by engine + ability runtime and directly testable in Node.
Path('src/physics').mkdir(parents=True, exist_ok=True)
Path('src/physics/collision-utils.js').write_text(r'''(function(root,factory){
  const api=factory();
  if(root) root.KELO_COLLISION=api;
  if(typeof module==='object'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function resolveCircleAABB(cx,cy,r,box){
    const closestX=Math.max(box.x,Math.min(cx,box.x+box.w));
    const closestY=Math.max(box.y,Math.min(cy,box.y+box.h));
    const distX=cx-closestX,distY=cy-closestY,distSq=distX*distX+distY*distY;
    if(distSq<r*r&&distSq>0){
      const dist=Math.sqrt(distSq),overlap=r-dist;
      return{collided:true,pushX:(distX/dist)*overlap,pushY:(distY/dist)*overlap};
    }
    if(distSq===0){
      const left=cx-box.x,right=box.x+box.w-cx,top=cy-box.y,bottom=box.y+box.h-cy;
      const min=Math.min(left,right,top,bottom);
      if(min===left)return{collided:true,pushX:-(left+r),pushY:0};
      if(min===right)return{collided:true,pushX:right+r,pushY:0};
      if(min===top)return{collided:true,pushX:0,pushY:-(top+r)};
      return{collided:true,pushX:0,pushY:bottom+r};
    }
    return{collided:false,pushX:0,pushY:0};
  }
  function segmentAabbHitT(x0,y0,x1,y1,box,padding){
    const p=Math.max(0,Number(padding)||0);
    const minX=box.x-p,maxX=box.x+box.w+p,minY=box.y-p,maxY=box.y+box.h+p;
    const dx=x1-x0,dy=y1-y0;
    let tMin=0,tMax=1;
    function axis(origin,delta,min,max){
      if(Math.abs(delta)<1e-12)return origin>=min&&origin<=max;
      let a=(min-origin)/delta,b=(max-origin)/delta;
      if(a>b){const tmp=a;a=b;b=tmp;}
      tMin=Math.max(tMin,a);tMax=Math.min(tMax,b);
      return tMin<=tMax;
    }
    if(!axis(x0,dx,minX,maxX)||!axis(y0,dy,minY,maxY))return null;
    return tMin>=0&&tMin<=1?tMin:null;
  }
  return Object.freeze({resolveCircleAABB,segmentAabbHitT});
});
''')

# Load collision primitives before the core engine.
replace_once(
    'index.html',
    '<script src="engine-a.js?v=149"></script>',
    '<script src="src/physics/collision-utils.js?v=1"></script><script src="engine-a.js?v=150"></script>',
)

# Core physics: use shared resolver, honor explicit movement policy, preserve legacy default blocking.
replace_once(
    'engine-a.js',
    '''function resolveCircleAABB(cx,cy,r,box){
  const closestX=Math.max(box.x, Math.min(cx, box.x+box.w));
  const closestY=Math.max(box.y, Math.min(cy, box.y+box.h));
  const distX=cx-closestX, distY=cy-closestY, distSq=distX*distX+distY*distY;
  if (distSq < r*r && distSq>0) { const dist=Math.sqrt(distSq), overlap=r-dist; return {collided:true, pushX:(distX/dist)*overlap, pushY:(distY/dist)*overlap}; }
  if (distSq===0) return {collided:true, pushX:0, pushY:-r};
  return {collided:false, pushX:0, pushY:0};
}''',
    '''function resolveCircleAABB(cx,cy,r,box){
  if (!window.KELO_COLLISION) throw new Error('KELO_COLLISION unavailable');
  return window.KELO_COLLISION.resolveCircleAABB(cx,cy,r,box);
}''',
)
replace_once(
    'engine-a.js',
    'for (const b of obstacles) { const res=resolveCircleAABB(localPlayer.x,localPlayer.y,localPlayer.radius,b); if(res.collided) localPlayer.x+=res.pushX; }',
    'for (const b of obstacles) { if (!b || b.blocksMovement === false) continue; const res=resolveCircleAABB(localPlayer.x,localPlayer.y,localPlayer.radius,b); if(res.collided) localPlayer.x+=res.pushX; }',
)
replace_once(
    'engine-a.js',
    'for (const b of obstacles) { const res=resolveCircleAABB(localPlayer.x,localPlayer.y,localPlayer.radius,b); if(res.collided) localPlayer.y+=res.pushY; }',
    'for (const b of obstacles) { if (!b || b.blocksMovement === false) continue; const res=resolveCircleAABB(localPlayer.x,localPlayer.y,localPlayer.radius,b); if(res.collided) localPlayer.y+=res.pushY; }',
)

# Rendering must never erase the physics registry.
replace_once(
    'engine-c.js',
    '''  } else if (Array.isArray(obstacles) && obstacles.length) {
    obstacles.length = 0;
  }''',
    '''  }''',
)

# Ability runtime: explicit collider policies.
replace_once(
    'src/abilities/kelo-ability-boot.js',
    '''  function castWall(request, owner, def) {
    const p = request.position || owner;
    const width = def.delivery.width || 150;
    const wall = { x: p.x - width / 2, y: p.y - 12, w: width, h: 24, hp: def.delivery.hp || 250, time: def.delivery.duration || 4 };
    fx.walls.push(wall);
    if (typeof obstacles !== 'undefined') obstacles.push(wall);
  }''',
    '''  function castWall(request, owner, def) {
    const p = request.position || owner;
    const width = def.delivery.width || 150;
    const wall = {
      x: p.x - width / 2, y: p.y - 12, w: width, h: 24,
      hp: def.delivery.hp || 250, time: def.delivery.duration || 4,
      blocksMovement: def.delivery.blocksMovement !== false,
      blocksProjectiles: def.delivery.blocksProjectiles !== false,
    };
    fx.walls.push(wall);
    if (typeof obstacles !== 'undefined') obstacles.push(wall);
  }''',
)

# Dispatch and preflight are one source of truth. swap_sword remains explicitly pending.
old_cast = '''  function cast(request) {
    const slot = Number(request && request.slotIndex);
    if (!Number.isInteger(slot) || slot < 0 || slot >= hotbar.slots.length) return { valid: false, reason: 'INVALID_SLOT' };
    const instance = hotbar.slots[slot];
    const def = instance && instance.definition;
    const validation = validateCast(request || {}, instance, def);
    if (!validation.valid) {
      emit('ABILITY_FAILED', { request, reason: validation.reason });
      return validation;
    }

    localPlayer.mana -= def.resource.cost || 0;
    instance.cooldown = def.cooldown;
    emit('ABILITY_CAST', {
      playerId: localPlayer.id || 'local', stoneUid: instance.stoneUid,
      abilityId: def.id, abilityKey: def.key, slotIndex: slot,
      clientSequence: sequence++, loadoutFingerprint: fingerprint,
    });

    const type = def.delivery.type;
    if (type === 'projectile') castProjectile(request, localPlayer, def);
    else if (type === 'self_aoe') castSelfAoe(localPlayer, def);
    else if (type === 'chain') castChain(localPlayer, def);
    else if (type === 'dash') castDash(request, localPlayer, def);
    else if (type === 'blink') castBlink(request, localPlayer, def);
    else if (type === 'instant') applyEffects(def, localPlayer, localPlayer, false);
    else if (type === 'persistent_area') castArea(request, localPlayer, def);
    else if (type === 'wall') castWall(request, localPlayer, def);
    else if (type === 'trap') castTrap(request, localPlayer, def);
    else if (type === 'aura') castAura(localPlayer, def);
    else return { valid: false, reason: 'UNSUPPORTED_DELIVERY' };
    return { valid: true, abilityId: def.id, stoneUid: instance.stoneUid };
  }

  const engine = Object.freeze({ cast });'''
new_cast = '''  const deliveryHandlers = Object.freeze({
    projectile: (request, owner, def) => castProjectile(request, owner, def),
    self_aoe: (request, owner, def) => castSelfAoe(owner, def),
    chain: (request, owner, def) => castChain(owner, def),
    dash: (request, owner, def) => castDash(request, owner, def),
    blink: (request, owner, def) => castBlink(request, owner, def),
    instant: (request, owner, def) => applyEffects(def, owner, owner, false),
    persistent_area: (request, owner, def) => castArea(request, owner, def),
    wall: (request, owner, def) => castWall(request, owner, def),
    trap: (request, owner, def) => castTrap(request, owner, def),
    aura: (request, owner, def) => castAura(owner, def),
  });
  const pendingDeliveryTypes = Object.freeze(['swap_sword']);

  function cast(request) {
    const slot = Number(request && request.slotIndex);
    if (!Number.isInteger(slot) || slot < 0 || slot >= hotbar.slots.length) return { valid: false, reason: 'INVALID_SLOT' };
    const instance = hotbar.slots[slot];
    const def = instance && instance.definition;
    const validation = validateCast(request || {}, instance, def);
    if (!validation.valid) {
      emit('ABILITY_FAILED', { request, reason: validation.reason });
      return validation;
    }

    const type = def.delivery.type;
    const handler = deliveryHandlers[type];
    if (!handler) {
      const failed = { valid: false, reason: 'UNSUPPORTED_DELIVERY', deliveryType: type };
      emit('ABILITY_FAILED', { request, reason: failed.reason, deliveryType: type });
      return failed;
    }

    localPlayer.mana -= def.resource.cost || 0;
    instance.cooldown = def.cooldown;
    emit('ABILITY_CAST', {
      playerId: localPlayer.id || 'local', stoneUid: instance.stoneUid,
      abilityId: def.id, abilityKey: def.key, slotIndex: slot,
      clientSequence: sequence++, loadoutFingerprint: fingerprint,
    });

    handler(request || {}, localPlayer, def);
    return { valid: true, abilityId: def.id, stoneUid: instance.stoneUid };
  }

  const engine = Object.freeze({
    cast,
    getSupportedDeliveryTypes: () => Object.keys(deliveryHandlers),
    getPendingDeliveryTypes: () => pendingDeliveryTypes.slice(),
  });'''
replace_once('src/abilities/kelo-ability-boot.js', old_cast, new_cast)

# Dash: clamp interpolation at first solid AABB hit. Blink remains untouched pending explicit gameplay policy.
replace_once(
    'src/abilities/kelo-ability-boot.js',
    '''        localPlayer.x = dash.sx + (dash.tx - dash.sx) * Math.min(1, k);
        localPlayer.y = dash.sy + (dash.ty - dash.sy) * Math.min(1, k);
        if (dash.time <= 0) localPlayer._dash = null;''',
    '''        let nextX = dash.sx + (dash.tx - dash.sx) * Math.min(1, k);
        let nextY = dash.sy + (dash.ty - dash.sy) * Math.min(1, k);
        if (window.KELO_COLLISION && typeof obstacles !== 'undefined') {
          let hitT = null;
          for (const box of obstacles) {
            if (!box || box.blocksMovement === false) continue;
            const t = window.KELO_COLLISION.segmentAabbHitT(dash.sx, dash.sy, nextX, nextY, box, localPlayer.radius || 20);
            if (t != null && (hitT == null || t < hitT)) hitT = t;
          }
          if (hitT != null) {
            const safeT = Math.max(0, hitT - 1e-4);
            nextX = dash.sx + (nextX - dash.sx) * safeT;
            nextY = dash.sy + (nextY - dash.sy) * safeT;
            dash.time = 0;
          }
        }
        localPlayer.x = nextX;
        localPlayer.y = nextY;
        if (dash.time <= 0) localPlayer._dash = null;''',
)

# Projectiles: swept segment against AABB expanded by projectile radius; explicit policy with legacy-blocking default.
replace_once(
    'src/abilities/kelo-ability-boot.js',
    '''      const p = fx.projectiles[i];
      const step = Math.hypot(p.vx, p.vy) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.traveled += step;
      let hit = enemies(p.owner).find((enemy) => distance(p, enemy) < p.radius + (enemy.radius || 16));
      if (typeof obstacles !== 'undefined' && obstacles.some((wall) => p.x > wall.x && p.x < wall.x + wall.w && p.y > wall.y && p.y < wall.y + wall.h)) hit = hit || false;
      if (hit) applyEffects(p.def, p.owner, hit, false);
      if (hit !== undefined || p.traveled >= p.maxDistance) fx.projectiles.splice(i, 1);''',
    '''      const p = fx.projectiles[i];
      const step = Math.hypot(p.vx, p.vy) * dt;
      const oldX = p.x, oldY = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt; p.traveled += step;
      let hit = enemies(p.owner).find((enemy) => distance(p, enemy) < p.radius + (enemy.radius || 16));
      let blocked = false;
      if (window.KELO_COLLISION && typeof obstacles !== 'undefined') {
        blocked = obstacles.some((wall) => wall && wall.blocksProjectiles !== false &&
          window.KELO_COLLISION.segmentAabbHitT(oldX, oldY, p.x, p.y, wall, p.radius || 0) != null);
      }
      if (hit) applyEffects(p.def, p.owner, hit, false);
      if (blocked || hit !== undefined || p.traveled >= p.maxDistance) fx.projectiles.splice(i, 1);''',
)

# Catalog QA: invariants instead of stale hard-coded 10.
replace_once(
    'tests/stone-system.spec.js',
    '''  test('catalog keeps 10 unique scalable abilities', () => {
    expect(data.ABILITIES).toHaveLength(10);
    const keys = new Set(data.ABILITIES.map((ability) => ability.key));
    const recipes = new Set(data.ABILITIES.map((ability) => [...ability.recipe].sort().join('|')));
    expect(keys.size).toBe(10);
    expect(recipes.size).toBe(10);
  });''',
    '''  test('catalog keeps unique scalable abilities', () => {
    expect(data.ABILITIES.length).toBeGreaterThan(0);
    const keys = new Set(data.ABILITIES.map((ability) => ability.key));
    const ids = new Set(data.ABILITIES.map((ability) => ability.id));
    const recipes = new Set(data.ABILITIES.map((ability) => [...ability.recipe].sort().join('|')));
    expect(keys.size).toBe(data.ABILITIES.length);
    expect(ids.size).toBe(data.ABILITIES.length);
    expect(recipes.size).toBe(data.ABILITIES.length);
  });''',
)

# Deterministic contract audit; swap_sword is explicitly blocked rather than silently treated as live.
Path('scripts/validate-ability-runtime-contract.mjs').write_text(r'''import fs from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const data=require('../src/abilities/abilityData.js');
const boot=fs.readFileSync('src/abilities/kelo-ability-boot.js','utf8');
const engineA=fs.readFileSync('engine-a.js','utf8');
const engineC=fs.readFileSync('engine-c.js','utf8');
const implemented=['projectile','self_aoe','chain','dash','blink','instant','persistent_area','wall','trap','aura'];
const pending=['swap_sword'];
const declared=[...new Set(data.ABILITIES.map(a=>a.delivery.type))].sort();
const classified=[...new Set([...implemented,...pending])].sort();
if(JSON.stringify(declared)!==JSON.stringify(classified))throw new Error(`delivery contract drift declared=${declared} classified=${classified}`);
for(const type of implemented){if(!new RegExp(`\\b${type}: \\(`).test(boot))throw new Error(`missing runtime delivery handler: ${type}`);}
if(!boot.includes("const pendingDeliveryTypes = Object.freeze(['swap_sword'])"))throw new Error('swap_sword must remain explicitly pending until gameplay contract is complete');
if(!boot.includes("reason: 'UNSUPPORTED_DELIVERY'"))throw new Error('unsupported delivery preflight missing');
if(/obstacles\.length\s*=\s*0/.test(engineC))throw new Error('render still clears physics registry');
if(!engineA.includes('b.blocksMovement === false'))throw new Error('movement policy is not explicit');
if(!boot.includes('wall.blocksProjectiles !== false'))throw new Error('projectile policy is not explicit');
console.log('PASS ability/runtime/collider ownership contract', {declared,implemented,pending});
''')

Path('scripts/validate-collision-contract.mjs').write_text(r'''import { createRequire } from 'node:module';
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
''')

# CI protects the LIVE-critical ability/physics files and deterministic contracts.
p = Path('.github/workflows/ci.yml')
s = p.read_text()
anchor = '''      - name: Frame telemetry contract
        run: node scripts/validate-performance-telemetry.mjs
'''
insert = '''      - name: Ability and collision runtime contracts
        run: |
          node --check src/physics/collision-utils.js
          node --check src/abilities/abilityData.js
          node --check src/abilities/stone-system.js
          node --check src/abilities/kelo-ability-boot.js
          node --check src/visuals/ability-visuals.js
          node --check scripts/validate-ability-runtime-contract.mjs
          node --check scripts/validate-collision-contract.mjs
          node scripts/validate-ability-runtime-contract.mjs
          node scripts/validate-collision-contract.mjs

'''
if anchor not in s:
    raise SystemExit('CI anchor missing')
p.write_text(s.replace(anchor, insert + anchor, 1))
