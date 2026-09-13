/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / WORLD ASSET AUDIT
 * keys: WORLD ASSET PIVOT FOOTPRINT COLLISION PORTAL VARIANT SCALE ALPHA PLACEMENT STYLE AUDIT
 * purpose: deterministic regression coverage for single-asset production metadata
 * online: N/A; authoring-only audit
 */
import assert from 'node:assert/strict';
import {buildWorldAssetProfile,snapAlphaPixels,findOpaqueBounds,inferPortalOpening} from '../src/creators/sprite-compiler/sprite-world-asset-profile.mjs';

const W=80,H=80,data=new Uint8ClampedArray(W*H*4);
const fill=(x0,y0,x1,y1,{r=235,g=195,b=55,a=255}={})=>{for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=(y*W+x)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=a;}};

// Synthetic imperial gate: two solid towers + crown + base, with a transparent central arch.
fill(8,8,28,70);fill(52,8,72,70);fill(28,8,52,22);fill(8,70,72,75);
for(let y=23;y<70;y++)for(let x=29;x<52;x++)data[(y*W+x)*4+3]=0;
// Simulate common AI export fringe: nearly opaque subject + barely visible garbage pixel.
data[(10*W+10)*4+3]=252;data[(2*W+2)*4+3]=5;

const clean=snapAlphaPixels(data,W,H);assert.equal(clean.data[(10*W+10)*4+3],255);assert.equal(clean.data[(2*W+2)*4+3],0);assert.ok(clean.opaqueSnaps>=1);assert.ok(clean.transparentSnaps>=1);
const bounds=findOpaqueBounds(clean.data,W,H);assert.deepEqual({x:bounds.x,y:bounds.y,right:bounds.right,bottom:bounds.bottom},{x:8,y:8,right:72,bottom:75});
const portal=inferPortalOpening(clean.data,W,H,{bounds});assert.equal(portal.enabled,true);assert.equal(portal.walkThrough,true);assert.ok(portal.confidence>.8);assert.ok(portal.rect.width>=20&&portal.rect.height>=35);

const profile=buildWorldAssetProfile(data,W,H,{assetId:'imperial_gate_A',category:'landmark_gate',nominalWidthTiles:3,variants:[{id:'A',spawnWeight:1},{id:'B',spawnWeight:.7,widthScale:.86}],placementRules:{minSpacing:10}});
assert.equal(profile.schema,'kelo-world-asset-profile-v1');assert.equal(profile.status,'USABLE');assert.ok(profile.pivot.x>.45&&profile.pivot.x<.55);assert.ok(profile.pivot.y>.9);assert.ok(profile.footprint.rect.width>45);assert.equal(profile.collision.mode,'footprint');assert.equal(profile.portal.walkThrough,true);assert.equal(profile.scale.nominalWidthTiles,3);assert.equal(profile.scale.sizeClass,'large');assert.equal(profile.scale.widthClass,'wide');assert.equal(profile.variant.variantGroup,'imperial_gate');assert.equal(profile.variant.variants.length,2);assert.equal(profile.variant.variants[1].widthScale,.86);assert.equal(profile.placementRules.nearPath,true);assert.equal(profile.placementRules.minSpacing,10);assert.equal(profile.styleValidation.perspective,'not-inferred');

const manual=buildWorldAssetProfile(data,W,H,{assetId:'imperial_gate_C',category:'landmark_gate',portal:false,pivot:{x:.47,y:.99},footprint:{shape:'rect',rect:{x:14,y:71,width:52,height:5},confidence:1}});assert.equal(manual.portal.enabled,false);assert.equal(manual.pivot.x,.47);assert.equal(manual.pivot.reason,'manual-override');assert.equal(manual.footprint.source,'manual-override');assert.equal(manual.status,'NEEDS_REVIEW');assert.ok(manual.styleValidation.warnings.includes('PORTAL_REVIEW_REQUIRED'));

console.log(JSON.stringify({ok:true,schema:profile.schema,status:profile.status,pivot:profile.pivot,footprint:profile.footprint.rect,portal:{enabled:profile.portal.enabled,confidence:profile.portal.confidence,rect:profile.portal.rect},scale:profile.scale,variantGroup:profile.variant.variantGroup,variants:profile.variant.variants.length,placementRules:profile.placementRules}));
