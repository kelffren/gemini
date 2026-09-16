#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8'),checks=[];
function check(name,ok){checks.push({name,ok:!!ok});if(!ok)process.exitCode=1;}
const bridge=read('src/characters/creator-character-state-bridge.js');
const gate=read('src/core/creators-lazy-gate.js');
const features=read('src/core/feature-registry.js');
const visualStack=read('src/characters/character-visual-stack.js');
const customization=read('src/characters/character-customization.js');
const use=read('src/creators/content/creator-use-authority.mjs');
check('bridge is ephemeral and creates no ownership persistence',!/localStorage|indexedDB|sessionStorage/.test(bridge)&&/const overlay=new Map\(\)/.test(bridge)&&/persistentStore:false/.test(bridge));
check('bridge creates no renderer or loop',!/KeloAvatar\.use|renderAvatar|requestAnimationFrame|setInterval/.test(bridge)&&/secondRenderer:false/.test(bridge));
check('bridge projects through existing character owner stateForActor',/__creatorCharacterBase/.test(bridge)&&/stateForActor\(actor\)\{return resolveState\(actor\);\}/.test(bridge)&&/root\.KeloCharacterCustomization=facade/.test(bridge));
check('base character state stays authoritative for local fallback and persistence',/baseCustomization\?\.stateForActor/.test(bridge)&&!/applySnapshot\(|\.select\(|networkSnapshot\s*=/.test(bridge));
check('server-bound Creator items are hidden and locked',/locked:true,hidden:true/.test(bridge)&&/server-bound/.test(bridge));
check('exact revisions are activated through Delivery before visual registration',/KeloCreatorDelivery\?\.useRevision/.test(bridge)&&/runtimeRecord\(revisionId\)/.test(bridge)&&/query\(\{usable:true\}\)/.test(bridge));
check('slot target and content type are revalidated client-side',/CREATOR_CHARACTER_SLOT_MISMATCH/.test(bridge)&&/CREATOR_CHARACTER_TARGET_INVALID/.test(bridge)&&/CREATOR_CHARACTER_TYPE_INVALID/.test(bridge));
check('logout and identity changes clear overlay',/kelo:online-auth-state/.test(bridge)&&/kelo:online-auth-session-ended/.test(bridge)&&/clear\('auth-ended'\)/.test(bridge));
check('visual stack dynamically consumes CharacterCustomization owner',/return root\.KeloCharacterCustomization/.test(visualStack)&&/A\.stateForActor/.test(visualStack));
check('existing CharacterCustomization remains renderer owner with shared stack',/KeloCharacterVisualStack/.test(customization)&&/KeloAvatar\.use/.test(customization));
check('normal boot probes metadata before loading Appearance',/probeCharacterAppearance/.test(gate)&&/hydrateRuntime:false/.test(gate)&&/if\(!bindings\.length\)/.test(gate)&&/ensure\('appearance'\)/.test(gate));
check('metadata probe does not boot full Creator platform',/async function probeCharacterAppearance[\s\S]*?loadUseAuthority\(\)/.test(gate)&&!/async function probeCharacterAppearance[\s\S]*?loadPlatform\(\)/.test(gate));
check('appearance package declares bridge dependencies before bridge script',/character-slot-schema\.js/.test(features)&&/character-visual-presets\.js/.test(features)&&/character-customization\.js/.test(features)&&/character-visual-stack\.js/.test(features)&&/character-appearance-adapter\.js/.test(features)&&/creator-character-state-bridge\.js/.test(features)&&features.indexOf('character-customization.js')<features.indexOf('creator-character-state-bridge.js'));
check('Use Authority state remains server-derived',/get_my_creator_use_state/.test(use)&&/hydrateRuntime=false/.test(use));
check('weapon fallback supports both visual weapon slots',/slot==='weaponMain'\|\|slot==='weaponSecondary'/.test(bridge)&&/V\.weapon/.test(bridge));
for(const c of checks)console.log(`${c.ok?'PASS':'FAIL'}  ${c.name}`);
if(process.exitCode)console.error(`\nCreator character state bridge audit failed: ${checks.filter(x=>!x.ok).length}/${checks.length}`);else console.log(`\nCreator character state bridge audit passed: ${checks.length}/${checks.length}`);
