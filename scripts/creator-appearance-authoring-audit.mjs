import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const require=createRequire(import.meta.url);
const contract=require(path.join(root,'src/characters/creator-character-visual-contract.js'));
const chamberModule=await import(pathToFileURL(path.join(root,'src/creators/appearance/creator-character-test-chamber.mjs')).href);
const {CHARACTER_TEST_STATES,resolveCharacterTestTrack}=chamberModule;

assert.equal(contract.version,'creator-character-visual-contract-v2.0.0');
assert.deepEqual(CHARACTER_TEST_STATES.map(row=>row.id),['idle','walk','run','attack','hit','death']);

const canonicalRow={
  id:'appearance.character.test_sheet',displayName:'Test Sheet',targetType:'character',slotId:'torso',rarity:'rare',
  transforms:{default:{x:1,y:-2,scaleX:1,scaleY:1,rotation:3},left:{x:-7,y:4,scaleX:1.2,scaleY:1.2,rotation:-9}},
  animationMapping:{attack:{frames:[0,2,3],frameMs:90,loop:false}},
  metadata:{characterVisual:{mode:'auto',layer:'front',columns:4,rows:4,heightScale:1,anchor:{x:.5,y:1}}}
};
const canonical=contract.compileRow({row:canonicalRow,source:'asset.png',asset:{pixelWidth:512,pixelHeight:768}});
assert.equal(canonical.validation.ok,true);
assert.equal(canonical.validation.mode,'sheet');
assert.equal(canonical.descriptor.mode,'sheet');
assert.equal(canonical.descriptor.columns,4);
assert.equal(canonical.descriptor.rows,4);
assert.equal(canonical.descriptor.offsets.left.x,-7);
assert.equal(canonical.descriptor.offsets.left.y,4);
assert.equal(canonical.descriptor.offsets.left.rotation,-9);
assert.ok(Math.abs(canonical.descriptor.offsets.left.scale-1.2)<1e-9);

const weaponRow={
  id:'appearance.character.test_weapon',displayName:'Test Weapon',targetType:'character',slotId:'weaponMain',rarity:'epic',
  transforms:{default:{x:2,y:7,scaleX:1,scaleY:1,rotation:180}},
  metadata:{characterVisual:{mode:'auto',layer:'front',socket:'weapon',width:58,height:58,anchor:{x:.5,y:.88}}}
};
const weapon=contract.compileRow({row:weaponRow,source:'weapon.png',asset:{pixelWidth:64,pixelHeight:64}});
assert.equal(weapon.validation.ok,true);
assert.equal(weapon.validation.mode,'socket');
assert.equal(weapon.descriptor.mode,'socket');
assert.equal(weapon.descriptor.socket,'weapon');
assert.equal(weapon.descriptor.width,58);
assert.equal(weapon.descriptor.height,58);

const badSheet={...canonicalRow,metadata:{characterVisual:{mode:'sheet',columns:4,rows:4}}};
const invalid=contract.compileRow({row:badSheet,source:'bad.png',asset:{pixelWidth:510,pixelHeight:768}});
assert.equal(invalid.validation.ok,false);
assert.ok(invalid.validation.errors.includes('SHEET_NOT_DIVISIBLE'));

const payload=contract.rowToPayload(canonicalRow);
assert.equal(payload.slotId,'torso');
assert.equal(Object.prototype.hasOwnProperty.call(payload.characterVisual,'mode'),false,'auto is authoring intent and must be inferred from real asset dimensions at runtime');
assert.equal(payload.transforms.left.x,-7);
assert.equal(payload.transforms.left.rotation,-9);
const a=contract.presentationFingerprint(canonical),b=contract.presentationFingerprint(contract.compileRow({row:JSON.parse(JSON.stringify(canonicalRow)),source:'asset.png',asset:{pixelWidth:512,pixelHeight:768}}));
assert.equal(a,b,'same authoring descriptor must keep stable presentation fingerprint');
assert.notEqual(a,contract.presentationFingerprint(weapon),'different visual descriptors must not share fingerprint');

const walkTrack=resolveCharacterTestTrack({row:{animationMapping:{}},state:'walk',columns:4});
assert.deepEqual([...walkTrack.frames],[0,1,2,3]);
assert.equal(walkTrack.loop,true);
assert.equal(walkTrack.authored,false);
assert.equal(walkTrack.source,'runtime-generic-stride');
const attackTrack=resolveCharacterTestTrack({row:canonicalRow,state:'attack',columns:4});
assert.deepEqual([...attackTrack.frames],[0,2,3]);
assert.equal(attackTrack.frameMs,90);
assert.equal(attackTrack.loop,false);
assert.equal(attackTrack.authored,true);
assert.equal(attackTrack.source,'animationMapping.attack');
const deathFallback=resolveCharacterTestTrack({row:{animationMapping:{}},state:'death',columns:4});
assert.deepEqual([...deathFallback.frames],[0]);
assert.equal(deathFallback.loop,false);
assert.equal(deathFallback.fallback,true);
const textualMappingFallback=resolveCharacterTestTrack({row:{animationMapping:{attack:'slash_combo'}},state:'attack',columns:4});
assert.deepEqual([...textualMappingFallback.frames],[0]);
assert.equal(textualMappingFallback.authored,false,'non-numeric animation IDs are not frame tracks');
assert.equal(textualMappingFallback.source,'attack-static-fallback');

const files={
  feature:fs.readFileSync(path.join(root,'src/core/feature-registry.js'),'utf8'),
  bridge:fs.readFileSync(path.join(root,'src/characters/creator-character-state-bridge.js'),'utf8'),
  runtime:fs.readFileSync(path.join(root,'src/characters/character-appearance.js'),'utf8'),
  creator:fs.readFileSync(path.join(root,'src/creators/ui/appearance-creator.mjs'),'utf8'),
  preview:fs.readFileSync(path.join(root,'src/creators/appearance/creator-appearance-preview.mjs'),'utf8'),
  chamber:fs.readFileSync(path.join(root,'src/creators/appearance/creator-character-test-chamber.mjs'),'utf8')
};
const contractIndex=files.feature.indexOf('creator-character-visual-contract.js');
const bridgeIndex=files.feature.indexOf('creator-character-state-bridge.js');
assert.ok(contractIndex>=0&&bridgeIndex>contractIndex,'feature loader must install shared visual contract before bridge');
assert.match(files.bridge,/KeloCreatorCharacterVisualContract/);
assert.match(files.bridge,/C\.buildDescriptor/);
assert.doesNotMatch(files.bridge,/function\s+rawSheet\s*\(/);
assert.doesNotMatch(files.bridge,/function\s+rawSocket\s*\(/);
assert.doesNotMatch(files.bridge,/function\s+inferredSheet\s*\(/);
assert.match(files.runtime,/motion\.frame != null/,'live Character renderer must honor explicit visual motion frame');
assert.match(files.creator,/IMPORT PREVIEW IMAGE/);
assert.match(files.creator,/COPY RUNTIME PAYLOAD/);
assert.match(files.creator,/FACES=.*down.*left.*right.*up/);
assert.match(files.creator,/CHARACTER TEST CHAMBER/);
assert.match(files.creator,/createCreatorCharacterTestChamber/);
assert.match(files.creator,/metadata\.characterVisual/);
assert.doesNotMatch(files.creator,/setInterval\s*\(/);
assert.doesNotMatch(files.creator,/requestAnimationFrame\s*\(/);
assert.match(files.preview,/KeloCreatorCharacterVisualContract/);
assert.match(files.preview,/actor\?\._visualMotion\?\.frame/);
assert.match(files.preview,/imageSmoothingEnabled=false/);
assert.doesNotMatch(files.preview,/setInterval\s*\(/);
assert.doesNotMatch(files.preview,/requestAnimationFrame\s*\(/);
assert.doesNotMatch(files.preview,/localStorage|indexedDB/);
assert.match(files.chamber,/id:'idle'[\s\S]*id:'walk'[\s\S]*id:'run'[\s\S]*id:'attack'[\s\S]*id:'hit'[\s\S]*id:'death'/);
assert.match(files.chamber,/requestAnimationFrame/);
assert.match(files.chamber,/cancelAnimationFrame/);
assert.doesNotMatch(files.chamber,/setInterval\s*\(/);
assert.doesNotMatch(files.chamber,/localStorage|indexedDB/);
assert.doesNotMatch(files.chamber,/localPlayer|simulatedPlayers|KeloPvPWorld|KeloEquipment/);

console.log('PASS creator appearance authoring audit',{
  contract:contract.version,
  canonicalMode:canonical.validation.mode,
  weaponMode:weapon.validation.mode,
  fingerprint:a,
  testStates:CHARACTER_TEST_STATES.map(row=>row.id),
  mappedAttack:[...attackTrack.frames],
  walkFallback:[...walkTrack.frames],
  textualMappingFallback:[...textualMappingFallback.frames],
  sameContractEditorRuntime:true,
  singlePreviewMotionLoopOwner:'CreatorCharacterTestChamber',
  gameplayAuthority:false
});
