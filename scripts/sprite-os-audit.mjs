/* KELO-INDEX
 * area: QA / CREATORS / SPRITE OS
 * owner: Main Stability Gate
 * keys: SPRITE OS EXTERNAL SEARCH COMPILER LICENSE PASSPORT RUNTIME NO INTERNAL LIBRARY WYSIWYG
 * purpose: Prove the external-first Sprite OS contract and prevent the removed internal library from re-entering discovery.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readinessFor,classifySlot,detectSpriteGrid,compileSpriteAsset,makeLookEntry,buildSimilarQuery} from '../src/creators/assets/sprite-os-engine.mjs';

const cfg=JSON.parse(fs.readFileSync(new URL('../data/external-asset-providers.json',import.meta.url),'utf8'));
const page=fs.readFileSync(new URL('../sprite-os.html',import.meta.url),'utf8');
const engine=fs.readFileSync(new URL('../src/creators/assets/sprite-os-engine.mjs',import.meta.url),'utf8');

assert.equal(cfg.version>=13,true,'provider config must be Sprite OS generation');
assert.equal(cfg.providers.some(p=>p.id==='kelo-content'),false,'internal Kelo content provider must not participate');
assert.equal(cfg.policy.allowedLicenses.includes('KELO-NATIVE'),false,'internal native license must not be a discovery dependency');
assert.equal(engine.includes('kelo-content-live-provider'),false,'Sprite OS engine must be external-provider agnostic');
assert.match(page,/searchExternalAssets/,'Sprite OS must use federated external search');
assert.match(page,/Usar en juego/,'Sprite OS must expose one-tap game use');
assert.match(page,/Parecidos/,'Sprite OS must expose similar-asset discovery');

const readyAsset={id:'ext:archer',name:'Dark Archer Character',provider:'external-test',contentKind:'sprite',category:'character',tags:['pixel-art','archer'],previewUrl:'https://example.test/archer.png',downloadUrl:'https://example.test/archer.png',sourceUrl:'https://example.test/source',license:'CC0-1.0',verified:true,integrationReady:true};
const ready=readinessFor(readyAsset);
assert.equal(ready.tier,'ready');
assert.equal(ready.canUse,true);
assert.equal(classifySlot(readyAsset),'body');

const unsafe=readinessFor({...readyAsset,license:'UNKNOWN'});
assert.equal(unsafe.canUse,false,'unknown licenses must not silently enter the game');

const grid=detectSpriteGrid(128,256,readyAsset);
assert.equal(grid.columns,4,'128x256 8-direction sheet should detect four 32px columns');
assert.equal(grid.rows,8,'128x256 8-direction sheet should detect eight rows');
assert.equal(grid.frameWidth,32);
assert.equal(grid.frameHeight,32);
assert.equal(grid.directions,8);

const compiled=compileSpriteAsset(readyAsset,{width:128,height:256});
assert.equal(compiled.schema,'sprite-os-passport/v1');
assert.equal(compiled.profile.slot,'body');
assert.equal(compiled.columns,4);
assert.equal(compiled.rows,8);
assert.equal(compiled.readiness.canUse,true);
const look=makeLookEntry(compiled);
assert.equal(look.profile.slot,'body');
assert.equal(look.spritePassport.license,'CC0-1.0');
assert.equal(look.spritePassport.directions,8);
assert.match(buildSimilarQuery(readyAsset),/archer/);

const fakeRoot={getElementById(id){return id==='preview-modal'?{__keloTryonProfile:{assetId:'ext:archer',profile:{slot:'body',label:'Cuerpo',x:.63,y:.41,scale:1.07,rotation:15,alpha:.82,layer:'back',order:111}}}:null;}};
const adjusted=makeLookEntry(compiled,fakeRoot);
assert.equal(adjusted.profile.x,.63,'Usar en juego must preserve dragged X');
assert.equal(adjusted.profile.y,.41,'Usar en juego must preserve dragged Y');
assert.equal(adjusted.profile.scale,1.07,'Usar en juego must preserve scale');
assert.equal(adjusted.profile.rotation,15,'Usar en juego must preserve rotation');
assert.equal(adjusted.profile.alpha,.82,'Usar en juego must preserve alpha');
assert.equal(adjusted.profile.layer,'back','Usar en juego must preserve front/back layer');

console.log('PASS sprite-os-audit');
console.log(JSON.stringify({providers:cfg.providers.length,tier:ready.tier,score:ready.score,grid:`${grid.columns}x${grid.rows}`,slot:compiled.profile.slot,wysiwyg:true,internalLibrary:false}));
