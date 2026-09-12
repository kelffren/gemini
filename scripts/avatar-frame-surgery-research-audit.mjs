/* KELO-INDEX
 * area: QA / FRAME SURGERY / RESEARCH
 * owner: adversarial research-backed behavior gate
 * keys: SURGERY COLOR WAND LASSO VIEW LEGACY-CORROBORATION SOURCE-RISK PIXEL-ART
 * purpose: prove advanced finger-first behavior with data, not presence-of-button checks
 * online: N/A
 */
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{colorFloodSelectionMask,polygonSelectionMask,simplifyLassoPath}from'../src/creators/sprite-compiler/sprite-frame-surgery-selection.mjs';
import{__universalSpriteIngestionV6 as v6}from'../src/creators/avatar/kelo-universal-asset-compiler.mjs';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const editor=read('src/creators/ui/avatar-frame-surgery-editor.mjs');
const compiler=read('src/creators/avatar/kelo-universal-asset-compiler.mjs');
const failures=[],checks=[];
function check(id,fn){try{fn();checks.push({id,pass:true})}catch(error){checks.push({id,pass:false,error:error.message});failures.push(`${id}: ${error.message}`)}}
const has=(text,parts)=>{for(const part of[].concat(parts))assert.ok(text.includes(part),`missing ${part}`)};

function rgbaGrid(colors){const out=new Uint8ClampedArray(colors.length*4);colors.forEach((c,i)=>{out.set(c,i*4)});return out}

check('color-wand-respects-tolerance',()=>{
  const data=rgbaGrid([
    [200,20,20,255],[202,22,21,255],[30,30,220,255],
    [198,18,19,255],[210,35,30,255],[31,31,219,255]
  ]);
  const tight=colorFloodSelectionMask(data,3,2,0,0,{tolerance:12});
  assert.deepEqual([...tight],[1,1,0,1,0,0]);
  const loose=colorFloodSelectionMask(data,3,2,0,0,{tolerance:30});
  assert.deepEqual([...loose],[1,1,0,1,1,0]);
});

check('color-wand-does-not-cross-different-color',()=>{
  const data=rgbaGrid([[255,0,0,255],[0,255,0,255],[255,0,0,255]]);
  assert.deepEqual([...colorFloodSelectionMask(data,3,1,0,0,{tolerance:40})],[1,0,0]);
});

check('lasso-polygon-mask-is-exact',()=>{
  const mask=polygonSelectionMask(6,6,[{x:.15,y:.15},{x:.85,y:.15},{x:.85,y:.85},{x:.15,y:.85},{x:.15,y:.15}]);
  assert.equal(mask[0],0);assert.equal(mask[3*6+3],1);assert.equal(mask[5*6+5],0);
  const selected=[...mask].reduce((a,b)=>a+b,0);assert.ok(selected>=16&&selected<=25,`unexpected selected=${selected}`);
});

check('lasso-simplifies-noisy-touch-path',()=>{
  const raw=[];for(let i=0;i<=100;i++)raw.push({x:i/100,y:.5+Math.sin(i)*.0005});
  const simple=simplifyLassoPath(raw,.01);assert.ok(simple.length<10,`not simplified: ${simple.length}`);assert.ok(simple.length>=2);
});

check('view-mode-is-nondestructive-navigation',()=>{
  has(editor,["S.mode==='view'",'1 dedo desplaza, 2 dedos hacen zoom','S.view={zoom:1,x:0,y:0}','no modifica el sprite']);
  assert.ok(!editor.includes("type:'drag',...v}),{message:'view mode must not reuse sprite drag reducer'});
});

check('editor-wires-color-wand-and-lasso',()=>has(editor,['colorFloodSelectionMask','polygonSelectionMask','WAND COLOR','LASSO','tolerance.value']));

check('tight-spacing-internal-contact-can-be-safe',()=>{
  const evidence={canvasClipping:0,detectedFrames:16,frameCount:16,coverage:.997,nonEmpty:1,groupConsistency:1,heightConsistency:.99,countAgreement:.95,separators:.72};
  assert.equal(v6.strongInternalSeparators(evidence),true);
  assert.equal(v6.layoutReasons({score:.96,evidence:{...evidence,clipping:.13,emptyFrames:0,internalEmptySlots:0}},{confidence:.95}).includes('CLIPPING_RISK'),false);
  assert.equal(v6.strongInternalSeparators({...evidence,canvasClipping:.1}),false);
});

check('source-scale-outlier-survives-auto-fix',()=>{
  const foreground={background:{kind:'transparent'}};
  const normalization={suspicious:[{reasons:['SCALE_OUTLIER']}]};
  assert.deepEqual(v6.sourceRiskReasons(foreground,normalization),['SOURCE_SCALE_OUTLIER']);
  const gated=v6.preserveSourceRisks({reviewReasons:[],scores:{finalHealth:.99},status:'VALIDATED',reviewRequired:false},foreground,normalization);
  assert.equal(gated.status,'REVIEW_REQUIRED');assert.ok(gated.reviewReasons.includes('SOURCE_SCALE_OUTLIER'));
});

check('texture-risk-survives-clean-looking-output',()=>{
  const foreground={background:{kind:'color',uniform:true,borderNoise:31,dominance:.72}};
  assert.ok(v6.sourceRiskReasons(foreground,{suspicious:[]}).includes('COMPLEX_BACKGROUND_TEXTURE'));
  assert.ok(!v6.sourceRiskReasons({background:{kind:'color',uniform:true,borderNoise:2,dominance:.96}},{suspicious:[]}).includes('COMPLEX_BACKGROUND_TEXTURE'));
});

check('legacy-can-only-corroborate-existing-v6-hypothesis',()=>{
  const frameCounts=[4,4,4,4],candidate={signature:'4x4',columns:4,rows:4,score:.82,frameCounts,evidence:{detectedFrames:16,frameCount:16,coverage:.98,nonEmpty:1,groupConsistency:.96,heightConsistency:.9,separators:.7,emptyFrames:0,internalEmptySlots:0,clipping:.04,canvasClipping:0,countAgreement:.6}};
  const best={signature:'1x4',columns:1,rows:4,score:.9,frameCounts:[1,1,1,1],evidence:{detectedFrames:4,frameCount:4,coverage:.99,nonEmpty:1,groupConsistency:1,heightConsistency:1,separators:1,emptyFrames:0,internalEmptySlots:0,clipping:0,canvasClipping:0,countAgreement:1}};
  const report={best,hypotheses:[best,candidate],alternatives:[],confidence:.92,reviewReasons:[],foreground:{background:{kind:'transparent'}}};
  assert.equal(v6.legacyStructureCandidate(report,{columns:4,rows:4,confidenceScore:.8})?.signature,'4x4');
  assert.equal(v6.legacyStructureCandidate({...report,hypotheses:[best]},{columns:4,rows:4,confidenceScore:.8}),null);
});

check('pixel-art-compile-defaults-nearest-neighbor',()=>has(compiler,"imageSmoothing:config?.imageSmoothing === true"));

const ok=failures.length===0;
console.log(JSON.stringify({ok,supervisor:'Kelo Frame Surgery Research Adversary',version:'1.0.0',checks,failures},null,2));
if(!ok)throw new Error(`FRAME_SURGERY_RESEARCH_AUDIT_REJECTED :: ${failures.join(' | ')}`);