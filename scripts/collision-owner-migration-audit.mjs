/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION / COLLISION
 * owner: Collision Owner Migration Audit
 * owns: certification that environment colliders mutate through KELO_COLLISION and legacy obstacles stays a projection
 * does-not-own: gameplay collision semantics or world geometry
 * purpose: prevent direct obstacles writes from returning after the environment-prefab migration
 * public-api: CLI `node scripts/collision-owner-migration-audit.mjs`
 * reuse: Legacy Observatory CI
 */
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
let failures=0;
function fail(message){console.error('COLLISION_OWNER_AUDIT_FAIL:',message);failures++;}
function ok(message){console.log('COLLISION_OWNER_AUDIT_OK:',message);}
function read(rel){return fs.readFileSync(path.join(ROOT,rel),'utf8');}
function expect(condition,message){if(!condition)fail(message);else ok(message);}

const generic=read('src/environment/generic-prefabs.js');
const luxe=read('src/environment/luxe-kiosk-atlas.js');
const observatory=read('scripts/legacy-observatory.mjs');

expect(generic.includes("COLLISION_OWNER='environment:generic-prefabs'"),'generic prefabs declares a stable collision owner');
expect(generic.includes('collision.replaceOwner(COLLISION_OWNER,colliders)'),'generic prefabs publishes colliders through replaceOwner');
expect(generic.includes('collision.clearOwner(COLLISION_OWNER)'),'generic prefabs clears its own bucket on decoration reset');
expect(!/\bobstacles\s*\.\s*(?:push|pop|shift|unshift|splice|sort|reverse|copyWithin|fill)\s*\(/.test(generic),'generic prefabs has no direct obstacles collection mutation');
expect(!/\bset(?:Timeout|Interval)\s*\(/.test(generic),'generic prefabs has no timer-based collision repair');

expect(luxe.includes('collision.remove(item.owner,item.id)'),'Luxe removes adopted legacy placeholders through KELO_COLLISION');
expect(!/\bobstacles\s*\.\s*(?:push|pop|shift|unshift|splice|sort|reverse|copyWithin|fill)\s*\(/.test(luxe),'Luxe has no direct obstacles collection mutation');
expect(!/\bset(?:Timeout|Interval)\s*\(/.test(luxe),'Luxe has no timer-based placeholder repair');

expect(observatory.includes('=(?!=)'),'Observatory excludes equality checks from assignment detection');
expect(observatory.includes("MUTATING_COLLECTION_METHODS='push|pop|shift|unshift|splice|sort|reverse|copyWithin|fill'"),'Observatory detects direct collection mutations');
expect(observatory.includes("'obstacles','render'"),'obstacles is a critical authority key');

const collisionPath=path.join(ROOT,'src','physics','collision-utils.js');
delete require.cache[require.resolve(collisionPath)];
const collision=require(collisionPath);
const legacy=[
  {x:1150,y:1400,w:120,h:400},
  {x:1530,y:1400,w:120,h:400},
  {x:1300,y:1250,w:200,h:80},
  {x:1300,y:1870,w:200,h:80},
  {id:'keep-me',x:50,y:50,w:20,h:20}
];
collision.attachLegacyObstacleArray(legacy,{adoptExistingOwner:'core-static'});
expect(collision.ownerSnapshot('core-static').count===5,'legacy startup colliders are adopted by core-static owner');

collision.replaceOwner('environment:generic-prefabs',[
  {id:'luxe-boutique',x:1200,y:1200,w:180,h:120},
  {id:'garden-gate',x:800,y:900,w:60,h:40}
]);
expect(collision.ownerSnapshot('environment:generic-prefabs').count===2,'environment prefab bucket owns exactly its published colliders');
expect(legacy.filter(x=>x?._keloCollisionOwner==='environment:generic-prefabs').length===2,'legacy obstacles receives owner-registry projection');

const placeholder=legacy.find(x=>x?._keloCollisionOwner==='core-static'&&x.x===1150&&x.y===1400&&x.w===120&&x.h===400);
expect(!!placeholder&&!!placeholder.id,'adopted legacy placeholder exposes owner/id for safe removal');
if(placeholder)collision.remove(placeholder._keloCollisionOwner,placeholder.id);
expect(!legacy.some(x=>x?.id===placeholder?.id),'owner removal synchronizes the legacy obstacles projection');
expect(legacy.some(x=>x?.id==='keep-me'),'targeted placeholder removal preserves unrelated core-static colliders');

collision.clearOwner('environment:generic-prefabs');
expect(collision.ownerSnapshot('environment:generic-prefabs').count===0,'clearOwner retires the environment prefab bucket');
expect(!legacy.some(x=>x?._keloCollisionOwner==='environment:generic-prefabs'),'clearOwner removes projected environment colliders from obstacles');

if(failures){console.error(`Collision owner migration audit failed with ${failures} violation(s).`);process.exit(1);}
console.log('COLLISION_OWNER_MIGRATION_OK');
