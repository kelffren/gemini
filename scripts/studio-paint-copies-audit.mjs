/* KELO-INDEX
 * area: STUDIO / PAINT COPIES AUDIT
 * keys: STUDIO PAINT COPIES SCENE PATTERN TRAIL GRID RING SCATTER UNDO REGRESSION
 * does: verifica patrones, grupos, determinismo, una acción de historial y que no vuelva el observer global del body
 * online: N/A; prueba contratos locales antes de authority mirror
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorldDocument } from '../src/studio/document/world-document.mjs';
import { createStudioKernel } from '../src/studio/core/studio-kernel.mjs';
import { registerBasicTools } from '../src/studio/tools/register-basic-tools.mjs';
import { createPlaceEntityCommand } from '../src/studio/document/document-commands.mjs';

const kernel=createStudioKernel({document:createWorldDocument({worldId:'world:paint-copies',settings:{tileSize:32,chunkSize:512}})});
const tools=registerBasicTools(kernel);
const source={id:'source-tree',prefabId:'tree',transform:{x:100,y:100,rotation:0},bounds:{w:40,h:40}};
await kernel.execute(createPlaceEntityCommand(source));
kernel.selection.set(source.id);

// Historical trail behavior: fast pointer travel must interpolate, and one gesture is one undo.
const started=tools.paintCopies.start({snap:1});
assert.equal(started.templateCount,1);
assert.equal(started.spacing,40,'auto spacing should respect the source footprint when it is larger than the grid');
tools.paintCopies.beginAt(200,100,{snap:1});
tools.paintCopies.strokeTo(400,100,{snap:1});
const preview=tools.paintCopies.getPreviews();
assert.equal(preview.length,6,'fast pointer travel must interpolate all spaced stamps, including start and end');
assert.deepEqual(preview.map(row=>row.transform.x),[180,220,260,300,340,380],'preview centers should remain 40px apart around the pointer path');
assert.equal(new Set(preview.map(row=>row.id)).size,preview.length,'every preview must have a unique entity id');
assert.equal(preview.every(row=>row.id!==source.id),true);
const historyBefore=kernel.history.undoDepth;
const committed=await tools.paintCopies.commit();
assert.equal(committed.stamps,6);
assert.equal(committed.rows.length,6);
assert.equal(kernel.document.entities.length,7);
assert.equal(kernel.history.undoDepth,historyBefore+1,'one paint stroke must become exactly one History action');
assert.equal(kernel.selection.get().length,6,'painted copies should become the active selection after commit');
await kernel.undo();
assert.equal(kernel.document.entities.length,1,'one Undo must remove the entire painted stroke');
assert.equal(kernel.document.entities[0].id,source.id);

// Grid: one selected object becomes a compact scene block and still commits as one history action.
kernel.selection.set(source.id);
tools.paintCopies.configure({pattern:'grid',columns:3,rows:2,spacing:40,snap:1});
tools.paintCopies.start({snap:1,spacing:40});
tools.paintCopies.beginAt(300,300,{snap:1});
const gridPreview=tools.paintCopies.getPreviews();
assert.equal(gridPreview.length,6,'3x2 grid must plan six copies');
assert.equal(new Set(gridPreview.map(row=>`${row.transform.x}:${row.transform.y}`)).size,6,'grid cells must not collapse onto each other');
const gridHistory=kernel.history.undoDepth;
const gridCommit=await tools.paintCopies.commit();
assert.equal(gridCommit.pattern,'grid');
assert.equal(gridCommit.rows.length,6);
assert.equal(kernel.history.undoDepth,gridHistory+1,'grid placement must be one History action');
await kernel.undo();
assert.equal(kernel.document.entities.length,1,'one Undo must remove the complete grid');

// Ring: radial scene composition around the pointer.
kernel.selection.set(source.id);
tools.paintCopies.configure({pattern:'ring',ringCount:8,radius:96,snap:1});
tools.paintCopies.start({snap:1,spacing:40});
tools.paintCopies.beginAt(500,500,{snap:1});
assert.equal(tools.paintCopies.getPreviews().length,8,'ring count must match requested copies');
tools.paintCopies.cancelStroke();

// Scatter: seeded layout is deterministic while IDs remain unique per preview build.
tools.paintCopies.configure({pattern:'scatter',scatterCount:12,scatterRadius:128,seed:99,snap:1});
tools.paintCopies.start({snap:1,spacing:40});
tools.paintCopies.beginAt(700,500,{snap:1});
const scatterA=tools.paintCopies.getPreviews().map(row=>[row.transform.x,row.transform.y]);
tools.paintCopies.cancelStroke();
tools.paintCopies.beginAt(700,500,{snap:1});
const scatterB=tools.paintCopies.getPreviews().map(row=>[row.transform.x,row.transform.y]);
assert.deepEqual(scatterB,scatterA,'same scatter seed and anchor must reproduce the same layout');
assert.equal(scatterA.length,12);
tools.paintCopies.cancelStroke();

// Multi-selection templates preserve internal offsets and still batch into one gesture.
await kernel.execute(createPlaceEntityCommand({id:'source-lamp',prefabId:'lamp',transform:{x:160,y:100,rotation:0},bounds:{w:20,h:40}}));
kernel.selection.set(['source-tree','source-lamp']);
tools.paintCopies.configure({pattern:'trail',spacing:60,snap:1});
const group=tools.paintCopies.start({snap:1,spacing:60});
assert.equal(group.templateCount,2);
tools.paintCopies.beginAt(300,300,{snap:1});
tools.paintCopies.strokeTo(420,300,{snap:1});
const groupPreview=tools.paintCopies.getPreviews();
assert.equal(groupPreview.length,6,'three stamps of a two-object template should preview six entities');
for(let i=0;i<groupPreview.length;i+=2){
  assert.equal(groupPreview[i+1].transform.x-groupPreview[i].transform.x,60,'group member offset must be preserved');
  assert.equal(groupPreview[i+1].transform.y-groupPreview[i].transform.y,0);
}
const groupHistory=kernel.history.undoDepth;
await tools.paintCopies.commit();
assert.equal(kernel.history.undoDepth,groupHistory+1,'group paint must also be one History action');

// Regression guard: BODY may be watched only for direct shell add/remove. Never restore body+subtree.
const sourceText=readFileSync(new URL('../src/studio/tools/paint-copies-tool.mjs',import.meta.url),'utf8');
assert.equal(/observe\(document\.body\s*,\s*\{[^}]*subtree\s*:\s*true/i.test(sourceText),false,'Paint Copies must never observe the full body subtree');
assert.equal(/bodyObserver\.observe\(document\.body,\{childList:true\}\)/.test(sourceText),true,'Paint Copies lifecycle observer must stay shallow');

console.log(JSON.stringify({
  ok:true,
  autoSpacing:true,
  interpolation:true,
  uniqueIds:true,
  groupTemplate:true,
  grid:true,
  ring:true,
  deterministicScatter:true,
  oneUndoPerGesture:true,
  noBodySubtreeObserver:true
},null,2));
