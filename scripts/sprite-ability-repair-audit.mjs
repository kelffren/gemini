import fs from 'node:fs';
import assert from 'node:assert/strict';
import { alphaBoundsFromImageData,reorderItems } from '../src/creators/sprite-ability/sprite-ability-repair-studio.mjs';

const rgba=new Uint8ClampedArray(6*5*4);
for(let y=1;y<=3;y++)for(let x=2;x<=4;x++)rgba[(y*6+x)*4+3]=255;
assert.deepEqual(alphaBoundsFromImageData(rgba,6,5),{x:2,y:1,width:3,height:3,empty:false});
assert.deepEqual(alphaBoundsFromImageData(new Uint8ClampedArray(3*2*4),3,2),{x:0,y:0,width:3,height:2,empty:true});
assert.deepEqual(reorderItems(['a','b','c','d'],0,2),['b','c','a','d']);
assert.deepEqual(reorderItems(['a','b','c'],2,0),['c','a','b']);

const source=fs.readFileSync(new URL('../src/creators/sprite-ability/sprite-ability-repair-studio.mjs',import.meta.url),'utf8');
for(const token of ['REPARAR SPRITE','DUPLICAR','ELIMINAR','REEMPLAZAR','CENTRAR','RECORTAR α','TRIM TODOS','USAR COMO REF','ALINEAR TODOS','ONION SKIN','✥ MOVER','⌖ PIVOT','✂ CROP','⌫ BORRAR','▶ PLAY','APLICAR REPARACIÓN','draggable=true'])assert.ok(source.includes(token),`missing ${token}`);
assert.ok(source.includes("globalCompositeOperation='destination-out'"),'eraser must remove pixels');
assert.ok(source.includes('state.frames=reorderItems'),'drag reorder must mutate frame order');
assert.ok(source.includes("setField(workspace,'.ksw-right','Impact Frame'"),'repair must restore impact frame');
assert.ok(source.includes("setField(workspace,'.ksw-right','Hitbox W'"),'repair must restore hitbox');

console.log('SPRITE REPAIR STUDIO CONTRACT: PASS');
