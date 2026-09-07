import fs from 'node:fs';
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
