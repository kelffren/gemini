import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {inspectAssetContainer} from '../src/creators/sprite-compiler/asset-safe-decode.mjs';
import {validateAssetMetadata} from '../src/creators/sprite-compiler/asset-metadata-schema.mjs';
import {createAssetTransaction} from '../src/creators/sprite-compiler/asset-transaction.mjs';
import {scoreVisualRegression} from '../src/creators/sprite-compiler/asset-visual-regression.mjs';
import {canonicalizeAlphaMode,inferSemanticAnchors} from '../src/creators/sprite-compiler/asset-canonicalization.mjs';
import {packAtlasDeterministically,generateMipChain,estimateRuntimeTextureBudget} from '../src/creators/sprite-compiler/asset-runtime-optimization.mjs';
import {auditTemporalConsistency,detectAiAssetDefects} from '../src/creators/sprite-compiler/asset-quality-v7.mjs';
import {evaluateAssetAuthority,sanitizeAiAssetSuggestions} from '../src/creators/sprite-compiler/asset-authority-policy.mjs';
import {createAssetVerificationLedger} from '../src/creators/sprite-compiler/asset-verification-ledger.mjs';
import {verifyAssetRelease,verifyReproducibleAssetOutputs} from '../src/creators/sprite-compiler/asset-release-verifier.mjs';

const png=new Uint8Array(33);png.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],0);png.set([0,0,0,13],8);png.set([0x49,0x48,0x44,0x52],12);png.set([0,0,0,32,0,0,0,16],16);png[24]=8;png[25]=6;const header=inspectAssetContainer(png);assert.equal(header.valid,true);assert.equal(header.width,32);assert.equal(header.height,16);
const jpeg=Uint8Array.from([0xff,0xd8,0xff,0xc0,0,17,8,0,16,0,32,3,1,0x11,0,2,0x11,0,3,0x11,0]);const jpg=inspectAssetContainer(jpeg);assert.equal(jpg.valid,true);assert.equal(jpg.width,32);assert.equal(jpg.height,16);
const webp=new Uint8Array(30);webp.set([...Buffer.from('RIFF'),22,0,0,0,...Buffer.from('WEBPVP8X'),10,0,0,0],0);webp[20]=0x02;webp[24]=31;webp[27]=15;const wp=inspectAssetContainer(webp);assert.equal(wp.valid,true);assert.equal(wp.width,32);assert.equal(wp.height,16);assert.equal(wp.animated,true);

const rgba=new Uint8ClampedArray(16*16*4);for(let y=3;y<15;y++)for(let x=5;x<11;x++){const i=(y*16+x)*4;rgba[i]=120;rgba[i+1]=80;rgba[i+2]=40;rgba[i+3]=255;}rgba[0]=255;const alpha=canonicalizeAlphaMode(rgba,16,16);assert.equal(alpha.hiddenRgbCleared,1);const anchors=inferSemanticAnchors(alpha.data,16,16);assert.ok(anchors.anchors.feet.y>.8);
const defects=detectAiAssetDefects(alpha.data,16,16);assert.ok(!defects.reasons.includes('EMPTY_ASSET'));assert.ok(Array.isArray(defects.defects));
const atlas=packAtlasDeterministically([{id:'b',width:20,height:10},{id:'a',width:10,height:20}],{maxWidth:64,padding:2});assert.equal(atlas.items[0].id,'a');
const mips=generateMipChain(alpha.data,16,16);assert.ok(mips.levels.length>=4);assert.equal(mips.levels.at(-1).width,1);assert.equal(mips.levels.at(-1).height,1);
const budget=estimateRuntimeTextureBudget({width:1024,height:1024,mipmaps:true});assert.ok(budget.rawMiB>5&&budget.rawMiB<6);
const same=scoreVisualRegression(alpha.data,alpha.data);assert.equal(same.pass,true);assert.equal(same.changedPixels,0);
const tx=createAssetTransaction({id:'audit'});tx.stage('blob',{ok:true});tx.gate('health',true);const committed=tx.commit();assert.equal(committed.state,'COMMITTED');
assert.equal(validateAssetMetadata({schema:'kelo-asset-v2',assetId:'x',build:{fingerprint:'abc'},runtime:{width:1,height:1}}).valid,true);
const temporal=auditTemporalConsistency([{bounds:{x:1,y:1,w:6,h:10},pixels:60},{bounds:{x:1.2,y:1,w:6,h:10},pixels:60},{bounds:{x:.9,y:1,w:6,h:10},pixels:60}]);assert.equal(temporal.status,'VALIDATED');assert.equal(temporal.pass,true);

const aiAdvice=sanitizeAiAssetSuggestions({categorySuggestion:'tree',collision:{x:1},confidence:.9});assert.equal(aiAdvice.authority,'ADVISORY_ONLY');assert.ok(aiAdvice.discardedKeys.includes('collision'));
const authority=evaluateAssetAuthority({requiredDomains:['security','runtime'],evidence:[{domain:'security',source:'deterministic',pass:true,authoritative:true},{domain:'runtime',source:'deterministic',pass:true,authoritative:true},{domain:'collision',source:'ai',pass:true,authoritative:true}]});assert.equal(authority.decision,'REJECTED');assert.ok(authority.rejected.some(x=>x.startsWith('AI_AUTHORITY_VIOLATION')));
const release=verifyAssetRelease({input:{valid:true,width:32,height:16},compiled:{blob:{},width:32,height:16,reviewRequired:false,status:'VALIDATED'},aiSuggestions:{categorySuggestion:'tree',confidence:.9}});assert.equal(release.approved,true);
const repro=verifyReproducibleAssetOutputs({width:32,height:16,type:'image/png',frameCounts:[4]},{width:32,height:16,type:'image/png',frameCounts:[4]});assert.equal(repro.pass,true);
const ledger=createAssetVerificationLedger({assetId:'audit',root:{crypto:webcrypto},clock:(()=>{let n=1000;return()=>++n;})()});await ledger.append('safe-input',{ok:true});await ledger.append('compile',{ok:true});const ledgerCheck=await ledger.verify();assert.equal(ledgerCheck.valid,true);assert.equal(ledgerCheck.entries,2);

console.log(JSON.stringify({ok:true,containers:{png:[header.width,header.height],jpeg:[jpg.width,jpg.height],webp:[wp.width,wp.height,wp.animated]},atlas:{width:atlas.width,height:atlas.height},mips:mips.levels.length,budgetMiB:Number(budget.rawMiB.toFixed(2)),temporal:temporal.status,authority:authority.decision,release:release.decision,ledger:ledgerCheck.valid}));
