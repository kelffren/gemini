/* KELO-INDEX
 * area: CREATORS / ASSET ATLAS
 * owner: Kelo Creator Asset Bridge
 * keys: SMART ATLAS ALPHA TRIM TOPOLOGY CROP MAXRECTS TOURNAMENT ORIG ANCHOR DEDUP PLAN
 * purpose: plan alpha-safe frame trimming, preserve profitable source overlap topology, compare against deterministic repacking, detect duplicate subframes, and distrust manifest visualBounds when pixels disagree
 * public-api: planSmartAtlas(), findDuplicateFrameGroups(), buildTrimMetadata()
 * state-owned: none; planning only
 * online: N/A; build/publish-time capability
 */

import crypto from 'node:crypto';
import {packRectanglesTournament} from './smart-atlas-packer-tournament.mjs';

const clamp=v=>Math.max(0,Math.round(Number(v)||0));
function sourceRect(frame){const r=frame?.sourceRect||frame?.frameRect;if(!r)return null;return{x:clamp(r.x??r.sx),y:clamp(r.y??r.sy),w:clamp(r.w),h:clamp(r.h)};}
function manifestVisualRect(frame,source){const b=frame?.visualBounds;if(!b)return{x:0,y:0,w:source.w,h:source.h};const x=Math.min(source.w,clamp(b.x)),y=Math.min(source.h,clamp(b.y)),w=Math.max(1,Math.min(source.w-x,clamp(b.w))),h=Math.max(1,Math.min(source.h-y,clamp(b.h)));return{x,y,w,h};}
function alphaRect(rgba,atlasWidth,source){if(!rgba||!atlasWidth)return null;let minX=source.w,minY=source.h,maxX=-1,maxY=-1;for(let y=0;y<source.h;y+=1)for(let x=0;x<source.w;x+=1){const a=rgba[((source.y+y)*atlasWidth+source.x+x)*4+3];if(a===0)continue;if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;}return maxX<0?{x:0,y:0,w:1,h:1,empty:true}:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,empty:false};}
function containsRect(outer,inner){return inner.x>=outer.x&&inner.y>=outer.y&&inner.x+inner.w<=outer.x+outer.w&&inner.y+inner.h<=outer.y+outer.h;}
export function buildTrimMetadata(id,frame,options={}){const orig=sourceRect(frame);if(!orig||!orig.w||!orig.h)return null;const manifestTrim=manifestVisualRect(frame,orig),pixelTrim=alphaRect(options.rgba,options.atlasWidth,orig),trim=pixelTrim||manifestTrim,boundsSource=pixelTrim?'alpha-pixels':'manifest-visualBounds',manifestContainsPixels=pixelTrim?containsRect(manifestTrim,pixelTrim):null,anchor=frame?.anchor?{x:Number(frame.anchor.x)-trim.x,y:Number(frame.anchor.y)-trim.y,kind:frame.anchor.kind||null}:null;return{id,orig:{w:orig.w,h:orig.h},sourceRect:orig,trim,manifestTrim,pixelTrim,boundsSource,manifestContainsPixels,trimmed:{w:trim.w,h:trim.h},anchor,originalAnchor:frame?.anchor?{x:Number(frame.anchor.x),y:Number(frame.anchor.y),kind:frame.anchor.kind||null}:null,areaBefore:orig.w*orig.h,areaAfter:trim.w*trim.h,trimmedPixels:orig.w*orig.h-trim.w*trim.h};}

function topologyCropPlan(frames,{originalWidth,originalHeight,padding}){
  if(!frames.length)return null;
  const rects=frames.map(frame=>({id:frame.id,x:frame.sourceRect.x+frame.trim.x,y:frame.sourceRect.y+frame.trim.y,w:frame.trim.w,h:frame.trim.h}));
  const left=Math.min(...rects.map(r=>r.x)),top=Math.min(...rects.map(r=>r.y)),right=Math.max(...rects.map(r=>r.x+r.w)),bottom=Math.max(...rects.map(r=>r.y+r.h));
  const x=Math.max(0,left-padding),y=Math.max(0,top-padding),cropRight=Math.min(originalWidth,right+padding),cropBottom=Math.min(originalHeight,bottom+padding),width=cropRight-x,height=cropBottom-y;
  const placements={};for(const rect of rects)placements[rect.id]={x:rect.x-x,y:rect.y-y,w:rect.w,h:rect.h};
  return{strategy:'topology-crop',x,y,width,height,area:width*height,padding,globalTrimBounds:{x:left,y:top,w:right-left,h:bottom-top},placements};
}
function areaSaving(originalArea,area){return originalArea?Number((((originalArea-area)/originalArea)*100).toFixed(3)):0;}

export function planSmartAtlas(framesObject,{originalWidth,originalHeight,padding=2,minAreaSavingPercent=5,rgba=null,atlasWidth=originalWidth,packerOptions={}}={}){
  const frames=Object.entries(framesObject||{}).map(([id,frame])=>buildTrimMetadata(id,frame,{rgba,atlasWidth})).filter(Boolean),originalArea=originalWidth*originalHeight,sourceArea=frames.reduce((s,f)=>s+f.areaBefore,0),trimArea=frames.reduce((s,f)=>s+f.areaAfter,0);
  const best=packRectanglesTournament(frames.map(f=>({id:f.id,w:f.trimmed.w,h:f.trimmed.h})),{originalWidth,originalHeight,padding,...packerOptions});
  const maxRects=best?{...best,strategy:'maxrects',estimatedAreaSavingPercent:areaSaving(originalArea,best.area),padding}:null;
  const topology=rgba?topologyCropPlan(frames,{originalWidth,originalHeight,padding}):null;if(topology)topology.estimatedAreaSavingPercent=areaSaving(originalArea,topology.area);
  const original={strategy:'original',width:originalWidth,height:originalHeight,area:originalArea,estimatedAreaSavingPercent:0,padding:0};
  const candidates=[original,topology,maxRects].filter(Boolean),selected=[...candidates].sort((a,b)=>a.area-b.area||String(a.strategy).localeCompare(String(b.strategy)))[0];
  const manifestUnsafe=frames.filter(f=>f.manifestContainsPixels===false).map(f=>f.id),lowerBoundSaving=best&&originalArea?((originalArea-best.lowerBoundArea)/originalArea)*100:0,selectedSaving=selected?.estimatedAreaSavingPercent??0;
  const pixelProven=Boolean(rgba),manifestSafe=manifestUnsafe.length===0,safeForPromotion=pixelProven||manifestSafe,promotionCandidate=Boolean(selected&&selected.strategy!=='original'&&selectedSaving>=minAreaSavingPercent&&safeForPromotion);
  return{version:'kelo-smart-atlas-plan-v4',frameCount:frames.length,original:{width:originalWidth,height:originalHeight,area:originalArea},trim:{sourceArea,trimArea,withinFrameSavingPercent:sourceArea?Number(((sourceArea-trimArea)/sourceArea*100).toFixed(3)):0,boundsSource:rgba?'alpha-pixels':'manifest',manifestUnsafeFrameCount:manifestUnsafe.length,manifestUnsafeFrames:manifestUnsafe},packing:{padding,theoreticalPaddedLowerBoundArea:best?.lowerBoundArea??null,theoreticalPaddedLowerBoundSavingPercent:best?Number(lowerBoundSaving.toFixed(3)):null,tournament:best?.tournament||null},topologyCrop:topology,maxRects,selection:{strategy:selected?.strategy||'original',area:selected?.area??originalArea,estimatedAreaSavingPercent:selectedSaving,candidates:candidates.map(candidate=>({strategy:candidate.strategy,width:candidate.width,height:candidate.height,area:candidate.area,estimatedAreaSavingPercent:candidate.estimatedAreaSavingPercent}))},promotionCandidate,promotionReason:selected?.strategy==='original'?'original-smallest':promotionCandidate?'measured-area-win':selectedSaving<minAreaSavingPercent?`area-saving-below-${minAreaSavingPercent}%`:safeForPromotion?'not-promotable':'unproven-bounds',frames};
}
function hashFrame(rgba,atlasWidth,rect){const hash=crypto.createHash('sha256'),row=Buffer.alloc(rect.w*4);for(let y=0;y<rect.h;y+=1){const start=((rect.y+y)*atlasWidth+rect.x)*4;rgba.copy(row,0,start,start+rect.w*4);hash.update(row);}return hash.digest('hex');}
export function findDuplicateFrameGroups(rgba,atlasWidth,framesObject){const groups=new Map();for(const[id,frame]of Object.entries(framesObject||{})){const rect=sourceRect(frame);if(!rect||!rect.w||!rect.h)continue;const key=`${rect.w}x${rect.h}:${hashFrame(rgba,atlasWidth,rect)}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(id);}return[...groups.entries()].filter(([,ids])=>ids.length>1).map(([fingerprint,ids])=>({fingerprint,ids,count:ids.length}));}
