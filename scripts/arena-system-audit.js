'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
function read(p){return fs.readFileSync(path.join(root,p),'utf8');}
function must(cond,msg){if(!cond)throw new Error('ARENA AUDIT: '+msg);}
const system=read('src/systems/arena-system.js'),ui=read('src/ui/arena-ui.js'),pvp=read('src/systems/pvp-world.js'),index=read('index.html'),catalog=read('docs/system-catalog.json'),guide=read('guide.html');
new Function(system);new Function(ui);new Function(pvp);
must(system.includes('owner: KeloArena'),'KeloArena owner header missing');
must(system.includes("teamSize:3")&&system.includes("mode:'control'"),'3v3 Control rules missing');
must(system.includes('transparentBots:true'),'transparent bot invariant missing');
must(system.includes('botsUseCombatEngine:true'),'bots must reuse CombatEngine');
must(system.includes('minimumRankedQuality'),'match quality weighting missing');
must(system.includes('normalizedHp')&&system.includes('applyNormalized'),'competitive normalization missing');
must(!system.includes('setInterval('),'Arena must not create a second timer loop');
must(pvp.includes('KeloArena')&&pvp.includes('getHostileActors'),'PvP actor provider is not Arena-aware');
must(pvp.includes('drawWorld(ctx)'),'PvP renderer does not delegate Arena presentation');
must(index.includes('src/systems/arena-system.js')&&index.includes('src/ui/arena-ui.js'),'Arena runtime scripts not loaded');
must(catalog.includes('"id": "arena-ranked"'),'system catalog missing Arena');
must(guide.includes('id="arena-ranked"'),'player guide missing Arena section');
console.log('Arena System Audit OK: 3v3 Control, bots, rating quality, normalization, PvP integration, docs.');
