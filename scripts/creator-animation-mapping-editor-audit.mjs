import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const editorPath=path.join(root,'src/creators/appearance/creator-animation-mapping-editor.mjs');
const editor=await import(pathToFileURL(editorPath).href);
const {parseAnimationFrames,inspectAnimationMapping,buildAnimationMappingPatch,CREATOR_ANIMATION_MAPPING_STATES}=editor;

assert.deepEqual([...CREATOR_ANIMATION_MAPPING_STATES],['default','idle','walk','run','attack','hit','death']);
const normalizeFrame=(value,columns)=>Math.abs(Math.floor(Number(value)))%Math.max(1,Math.floor(Number(columns)||1));
assert.deepEqual([...parseAnimationFrames('0,1,5,-2',{columns:4,normalizeFrame})],[0,1,1,2]);
assert.equal(parseAnimationFrames(Array.from({length:80},(_,i)=>i),{columns:4,normalizeFrame}).length,64,'authoring sequence must be bounded');

const legacy={attack:'slash_combo',default:{frames:[0,1],frameMs:150,loop:true},metadata:{untouched:true}};
const inherited=inspectAnimationMapping({mapping:legacy,state:'walk',columns:4,normalizeFrame});
assert.equal(inherited.source,'default');
assert.equal(inherited.inherited,true);
assert.deepEqual([...inherited.frames],[0,1]);
const legacyAttack=inspectAnimationMapping({mapping:legacy,state:'attack',columns:4,normalizeFrame});
assert.equal(legacyAttack.legacy,true);
assert.equal(legacyAttack.explicit,true);

const patched=buildAnimationMappingPatch({mapping:legacy,state:'attack',frames:'0 2 5',frameMs:45,loop:false,columns:4,normalizeFrame});
assert.deepEqual(patched.attack,{frames:[0,2,1],frameMs:70,loop:false});
assert.deepEqual(patched.default,legacy.default,'unrelated/default mapping must survive state edit');
assert.deepEqual(patched.metadata,legacy.metadata,'unknown legacy keys must survive state edit');
const slow=buildAnimationMappingPatch({mapping:patched,state:'death',frames:[3],frameMs:9000,loop:false,columns:4,normalizeFrame});
assert.equal(slow.death.frameMs,2000);
const cleared=buildAnimationMappingPatch({mapping:slow,state:'attack',remove:true,columns:4,normalizeFrame});
assert.equal(Object.prototype.hasOwnProperty.call(cleared,'attack'),false);
assert.deepEqual(cleared.default,legacy.default);
assert.throws(()=>buildAnimationMappingPatch({mapping:{},state:'hit',frames:'slash',columns:4,normalizeFrame}),/ANIMATION_MAPPING_FRAMES_REQUIRED/);

const files={
 appearance:fs.readFileSync(path.join(root,'src/appearance/appearance-system.js'),'utf8'),
 ui:fs.readFileSync(path.join(root,'src/creators/ui/appearance-creator.mjs'),'utf8'),
 chamber:fs.readFileSync(path.join(root,'src/creators/appearance/creator-character-test-chamber.mjs'),'utf8'),
 editor:fs.readFileSync(editorPath,'utf8')
};
assert.match(files.appearance,/animationMapping:Object\.freeze\(copy\(raw\.animationMapping\|\|\{\}\)\)/,'Appearance core must preserve animationMapping objects');
assert.match(files.appearance,/animation:item\.animationMapping\?\.\[motion\]\|\|item\.animationMapping\?\.default\|\|null/,'runtime resolver must keep using the same mapping contract');
assert.match(files.ui,/mountCreatorAnimationMappingEditor/);
assert.match(files.ui,/animationMapping:nextMapping/);
assert.match(files.ui,/session\.upsert/);
assert.match(files.ui,/chamber\?\.play\?\.\(state\)/,'editor state selection must be able to preview through existing Test Chamber');
assert.match(files.chamber,/animationMapping/,'Test Chamber must consume the same animationMapping contract');
assert.match(files.editor,/normalizeFrame/,'editor must accept shared Character frame normalization');
assert.match(files.editor,/maxFrames=64/,'frame sequence must stay bounded');
assert.doesNotMatch(files.editor,/requestAnimationFrame|setInterval\s*\(/,'editor must not own an animation loop');
assert.doesNotMatch(files.editor,/localStorage|indexedDB/,'editor must not persist outside definition session');
assert.doesNotMatch(files.editor,/localPlayer|simulatedPlayers|KeloPvPWorld|KeloEquipment/,'editor must not touch live actor/gameplay authority');

console.log('PASS creator animation mapping editor audit',{
 states:[...CREATOR_ANIMATION_MAPPING_STATES],
 moduloFrames:[...parseAnimationFrames('0,1,5,-2',{columns:4,normalizeFrame})],
 maxFrames:64,
 minFrameMs:patched.attack.frameMs,
 maxFrameMs:slow.death.frameMs,
 legacyPreserved:true,
 sharedAppearanceContract:true,
 testChamberPreview:true,
 animationLoopOwner:false,
 gameplayAuthority:false
});
