import {
  ROAD_BITS, analyzeRoadSemanticsFromMask, periodicityScore, selectDeterministicVariant,
  scoreAssetSeam, extrudeRgbaEdges, planMacroRoadSegments, buildSplineRoadPlan,
  connectedComponents, distanceTransform, skeletonize, recommendJoinRepair
} from '../src/creators/assets/asset-sheet-semantic-compiler.mjs';

function assert(v,m){if(!v)throw new Error(`SEMANTIC_AUDIT_FAILED:${m}`)}
function mask(w,h){return new Uint8Array(w*h)}
function rect(m,w,x,y,rw,rh){for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++)m[yy*w+xx]=1}
function rgba(w,h,fn){const d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=fn(x,y),i=(y*w+x)*4;d.set(c,i)}return d}

const w=31,h=31;
function semanticFor(draw){const m=mask(w,h);draw(m);return analyzeRoadSemanticsFromMask(m,w,h)}
const straight=semanticFor(m=>rect(m,w,0,12,w,7));
assert(straight.neighborMask===(ROAD_BITS.E|ROAD_BITS.W),`straight mask=${straight.neighborMask}`); assert(straight.topology==='straight','straight topology');
const corner=semanticFor(m=>{rect(m,w,12,0,7,19);rect(m,w,12,12,19,7)});
assert(corner.neighborMask===(ROAD_BITS.N|ROAD_BITS.E),`corner mask=${corner.neighborMask}`); assert(corner.topology==='corner','corner topology');
const tee=semanticFor(m=>{rect(m,w,0,12,w,7);rect(m,w,12,0,7,19)});
assert(tee.neighborMask===(ROAD_BITS.N|ROAD_BITS.E|ROAD_BITS.W),`t mask=${tee.neighborMask}`); assert(tee.topology==='t','t topology');
const cross=semanticFor(m=>{rect(m,w,0,12,w,7);rect(m,w,12,0,7,h)});
assert(cross.neighborMask===15,`cross mask=${cross.neighborMask}`); assert(cross.topology==='cross','cross topology');
assert(cross.mergeZones.length===4&&cross.bridgeUnderlays.length===4,'join metadata');

const compMask=mask(12,12);rect(compMask,12,1,1,3,3);rect(compMask,12,8,8,2,2);assert(connectedComponents(compMask,12,12).length===2,'components');
const dtMask=mask(w,h);rect(dtMask,w,0,12,w,7);rect(dtMask,w,12,0,7,h);const dt=distanceTransform(dtMask,w,h);assert(Math.max(...dt)>2,'distance transform');
const skMask=mask(w,h);rect(skMask,w,0,12,w,7);const sk=skeletonize(skMask,w,h);assert(sk.reduce((s,v)=>s+v,0)<w*7,'skeleton thins');

const checker=rgba(64,64,(x,y)=>((Math.floor(x/4)+Math.floor(y/4))%2?[220,220,220,255]:[30,30,30,255]));
const random=rgba(64,64,(x,y)=>{let v=(Math.imul(x+1,374761393)^Math.imul(y+11,668265263)^0x9e3779b9)>>>0;v=Math.imul(v^(v>>>13),1274126177)>>>0;v=(v^(v>>>16))>>>0;return [v&255,(v>>>8)&255,(v>>>16)&255,255]});
const p1=periodicityScore(checker,64,64),p2=periodicityScore(random,64,64);assert(p1.score>0.7,`checker periodic=${p1.score}`);assert(p2.score<p1.score,`random=${p2.score}`);

const variants=[{id:'A',weight:1},{id:'B',weight:1},{id:'C',weight:1}];const v1=selectDeterministicVariant(variants,{worldSeed:'KW',x:7,y:9}),v2=selectDeterministicVariant(variants,{worldSeed:'KW',x:7,y:9});assert(v1.id===v2.id,'deterministic variant');const v3=selectDeterministicVariant(variants,{worldSeed:'KW',x:7,y:9,neighborIds:[v1.id]});assert(v3.id!==v1.id,'anti repeat');

const edgeA=rgba(12,12,()=>[100,100,100,255]),edgeB=rgba(12,12,()=>[102,102,102,255]),edgeC=rgba(12,12,()=>[245,245,245,255]);const good=scoreAssetSeam(edgeA,12,12,'E',edgeB,12,12,'W'),bad=scoreAssetSeam(edgeA,12,12,'E',edgeC,12,12,'W');assert(good<0.05&&bad>good+0.2,`seams ${good}/${bad}`);assert(recommendJoinRepair(good).action==='accept'&&recommendJoinRepair(bad).bridge===true,'repair ladder');

const small=rgba(2,2,()=>[1,2,3,255]),ext=extrudeRgbaEdges(small,2,2,2);assert(ext.width===6&&ext.height===6&&ext.padding===2,'extrusion');assert(JSON.stringify(planMacroRoadSegments(11))==='[4,4,3]','macro planner');const spline=buildSplineRoadPlan([[0,0],[3,4],[6,4]],{width:5});assert(spline.segments.length===2&&spline.segments[0].length===5,'spline hook');

console.log(JSON.stringify({status:'ASSET_SEMANTIC_COMPILER_AUDIT_OK',straight:straight.neighborMask,corner:corner.neighborMask,t:tee.neighborMask,cross:cross.neighborMask,periodic:p1,random:p2,seam:{good,bad},macro:planMacroRoadSegments(11),splineSegments:spline.segments.length}));
