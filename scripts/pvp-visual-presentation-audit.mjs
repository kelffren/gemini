#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8'),checks=[];
function check(name,ok){checks.push({name,ok:!!ok});if(!ok)process.exitCode=1;}
const wire=read('server/pvp-presentation-wire.js');
const bootstrap=read('server/sprite-ai-bootstrap.js');
const net=read('engine-net.js');
const pvp=read('server/pvp-authority.js');
const pvpWorld=read('src/systems/pvp-world.js');
const packageJson=JSON.parse(read('server/package.json'));
check('server installs PvP presentation wire before canonical index boot',/installPvpPresentationWire\(\)/.test(bootstrap)&&bootstrap.indexOf('installPvpPresentationWire()')<bootstrap.indexOf("require('./index')"));
check('presentation stays on the existing WebSocket send path',/const nativeSend=WS\.prototype\.send/.test(wire)&&/nativeSend\.call\(socket,JSON\.stringify\(\{t:'pvp:presentation'/.test(wire)&&!/new WebSocket|WebSocketServer|listen\(/.test(wire));
check('presentation key is deterministic compact SHA identity',/createHash\('sha256'\)/.test(wire)&&/slice\(0,20\)/.test(wire)&&/creatorAppearance&&m\.creatorAppearance\.revisionKey/.test(wire));
check('competitive snapshots carry presentationKey instead of full manifests',/observePvpSnapshot/.test(wire)&&/presentationKey:key/.test(wire)&&!/observePvpSnapshot[\s\S]*avatarManifest:manifest/.test(wire));
check('unchanged presentation is not resent every snapshot',/previous===key/.test(wire)&&/presentationsSkipped\+\+/.test(wire)&&/fullManifestEverySnapshot:false/.test(wire));
check('empty first presentation produces no useless clear packet',/previous===MISSING&&key===null/.test(wire));
check('redundant social state strips heavy manifests while viewer is in PvP',/delete copy\.avatarManifest/.test(wire)&&/manifestsStripped\+\+/.test(wire));
check('wire owns no timer or gameplay mutation',!/setInterval|setTimeout|requestAnimationFrame|hp\s*=|mana\s*=|damage|cooldown/.test(wire));
check('PvP authority remains presentation-agnostic gameplay owner',/function actorPublic/.test(pvp)&&!/avatarManifest|creatorAppearance|presentationKey/.test(pvp));
check('client preserves cached presentation when snapshot omits avatarManifest',/hasOwnProperty\.call\(p,'avatarManifest'\)/.test(net)&&!/peer\.avatarManifest=p\.avatarManifest\|\|null/.test(net));
check('client consumes server-only pvp presentation before snapshot path',/function ingestPvpPresentation/.test(net)&&/msg\.t==='pvp:presentation'\)ingestPvpPresentation\(msg\);if\(msg\.t==='pvp:snapshot'/.test(net));
check('client clears remote overlay only on explicit server presentation clear',/clearRemote\?\.\(peer,'pvp-presentation-cleared'\)/.test(net));
check('client creates no second transport or render loop for presentation',!/function ingestPvpPresentation[\s\S]*new WebSocket|function ingestPvpPresentation[\s\S]*requestAnimationFrame|function ingestPvpPresentation[\s\S]*setInterval/.test(net));
check('PvP world keeps rendering peers through existing renderAvatar owner',/p\.zone==='pvp'\)renderAvatar\(p,false\)/.test(pvpWorld));
check('server exposes pure smoke test command',packageJson.scripts?.['test:pvp-presentation']==='node pvp-presentation-wire-smoke-test.js');
for(const c of checks)console.log(`${c.ok?'PASS':'FAIL'}  ${c.name}`);
if(process.exitCode)console.error(`\nPvP visual presentation audit failed: ${checks.filter(x=>!x.ok).length}/${checks.length}`);else console.log(`\nPvP visual presentation audit passed: ${checks.length}/${checks.length}`);
