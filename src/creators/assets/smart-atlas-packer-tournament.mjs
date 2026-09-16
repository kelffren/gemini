/* KELO-INDEX
 * area: CREATORS / ASSET ATLAS
 * owner: Kelo Creator Asset Bridge
 * keys: SMART ATLAS MAXRECTS TOURNAMENT BSSF BLSF AREA BOTTOM LEFT CONTACT SORT PADDING
 * purpose: measure multiple deterministic non-rotating MaxRects heuristics and sort orders, then return the smallest proven packing
 * public-api: packRectanglesTournament()
 * state-owned: none; pure build-time geometry planning
 * online: N/A
 * do-not: rotate frames, mutate source pixels, or treat a packing estimate as runtime promotion approval
 */

function intersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function contains(a,b){return b.x>=a.x&&b.y>=a.y&&b.x+b.w<=a.x+a.w&&b.y+b.h<=a.y+a.h;}
function prune(rects){return rects.filter((r,i)=>!rects.some((o,j)=>i!==j&&contains(o,r)));}
function splitFree(free,used){
  if(!intersects(free,used))return[free];
  const out=[];
  if(used.x>free.x)out.push({x:free.x,y:free.y,w:used.x-free.x,h:free.h});
  if(used.x+used.w<free.x+free.w)out.push({x:used.x+used.w,y:free.y,w:free.x+free.w-(used.x+used.w),h:free.h});
  if(used.y>free.y)out.push({x:free.x,y:free.y,w:free.w,h:used.y-free.y});
  if(used.y+used.h<free.y+free.h)out.push({x:free.x,y:used.y+used.h,w:free.w,h:free.y+free.h-(used.y+used.h)});
  return out.filter(r=>r.w>0&&r.h>0);
}
function overlapLength(a0,a1,b0,b1){return Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));}
function contactScore(candidate,used,binWidth){
  let score=0;
  if(candidate.x===0||candidate.x+candidate.w===binWidth)score+=candidate.h;
  if(candidate.y===0)score+=candidate.w;
  for(const other of used){
    if(other.x===candidate.x+candidate.w||other.x+other.w===candidate.x)score+=overlapLength(candidate.y,candidate.y+candidate.h,other.y,other.y+other.h);
    if(other.y===candidate.y+candidate.h||other.y+other.h===candidate.y)score+=overlapLength(candidate.x,candidate.x+candidate.w,other.x,other.x+other.w);
  }
  return score;
}
function tupleCompare(a,b){for(let i=0;i<Math.max(a.length,b.length);i+=1){const av=a[i]??0,bv=b[i]??0;if(av!==bv)return av-bv;}return 0;}
function scorePlacement(heuristic,free,rw,rh,used,binWidth){
  const dw=free.w-rw,dh=free.h-rh,short=Math.min(dw,dh),long=Math.max(dw,dh),area=free.w*free.h-rw*rh;
  if(heuristic==='best-long-side-fit')return[long,short,area,free.y,free.x];
  if(heuristic==='best-area-fit')return[area,short,long,free.y,free.x];
  if(heuristic==='bottom-left')return[free.y+rh,free.x,short,long];
  if(heuristic==='contact-point')return[-contactScore({x:free.x,y:free.y,w:rw,h:rh},used,binWidth),area,short,long,free.y,free.x];
  return[short,long,area,free.y,free.x];
}
function sortRects(rects,sort){
  const stable=(a,b)=>String(a.id).localeCompare(String(b.id));
  return[...rects].sort((a,b)=>{
    if(sort==='area')return b.w*b.h-a.w*a.h||Math.max(b.w,b.h)-Math.max(a.w,a.h)||stable(a,b);
    if(sort==='perimeter')return (b.w+b.h)-(a.w+a.h)||b.w*b.h-a.w*a.h||stable(a,b);
    if(sort==='height')return b.h-a.h||b.w-a.w||stable(a,b);
    if(sort==='width')return b.w-a.w||b.h-a.h||stable(a,b);
    return Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.w*b.h-a.w*a.h||stable(a,b);
  });
}
function packMaxRects(rects,width,padding,heuristic,sort,maxHeight){
  const ordered=sortRects(rects,sort),padded=ordered.map(r=>({...r,pw:r.w+padding*2,ph:r.h+padding*2}));
  const provisionalHeight=Math.min(maxHeight,padded.reduce((sum,r)=>sum+r.ph,0)+padding*2);
  let free=[{x:0,y:0,w:width,h:provisionalHeight}],used=[];
  for(const rect of padded){
    let best=null;
    for(const f of free){
      if(rect.pw>f.w||rect.ph>f.h)continue;
      const score=scorePlacement(heuristic,f,rect.pw,rect.ph,used,width);
      if(!best||tupleCompare(score,best.score)<0)best={f,score};
    }
    if(!best)return null;
    const occupied={x:best.f.x,y:best.f.y,w:rect.pw,h:rect.ph,id:rect.id};
    used.push({...occupied,content:{x:occupied.x+padding,y:occupied.y+padding,w:rect.w,h:rect.h}});
    const next=[];for(const f of free)next.push(...splitFree(f,occupied));free=prune(next);
  }
  const usedWidth=Math.max(...used.map(r=>r.x+r.w)),usedHeight=Math.max(...used.map(r=>r.y+r.h));
  if(usedHeight>maxHeight)return null;
  return{width:usedWidth,height:usedHeight,area:usedWidth*usedHeight,placements:Object.fromEntries(used.map(r=>[r.id,r.content]))};
}
function candidateWidths(rects,originalWidth,padding,step=64,maxWidth=Math.max(originalWidth,4096)){
  const min=Math.max(...rects.map(f=>f.w+padding*2));
  const paddedArea=rects.reduce((sum,r)=>sum+(r.w+padding*2)*(r.h+padding*2),0),root=Math.sqrt(paddedArea);
  const set=new Set([min,originalWidth,Math.ceil(root/step)*step,Math.floor(root/step)*step,256,384,512,640,768,896,1024,1152,1280,1440,1536,1792,2048,2560,3072,3584,4096].filter(w=>Number.isFinite(w)&&w>=min&&w<=maxWidth));
  for(let w=Math.ceil(min/step)*step;w<=Math.min(maxWidth,Math.max(originalWidth,Math.ceil(root*1.75)));w+=step)set.add(w);
  return[...set].sort((a,b)=>a-b);
}

export const SMART_ATLAS_HEURISTICS=['best-short-side-fit','best-long-side-fit','best-area-fit','bottom-left','contact-point'];
export const SMART_ATLAS_SORTS=['max-side','area','perimeter','height','width'];

export function packRectanglesTournament(rects,{originalWidth,originalHeight,padding=2,widthStep=64,maxWidth=Math.max(originalWidth,4096),maxHeight=Math.max(originalHeight,4096),heuristics=SMART_ATLAS_HEURISTICS,sorts=SMART_ATLAS_SORTS}={}){
  if(!Array.isArray(rects)||!rects.length)return null;
  const lowerBoundArea=rects.reduce((sum,r)=>sum+(r.w+padding*2)*(r.h+padding*2),0),widths=candidateWidths(rects,originalWidth,padding,widthStep,maxWidth),candidates=[];
  for(const width of widths)for(const heuristic of heuristics)for(const sort of sorts){
    const packed=packMaxRects(rects,width,padding,heuristic,sort,maxHeight);if(!packed)continue;
    candidates.push({...packed,candidateWidth:width,heuristic,sort,padding,lowerBoundArea,occupancy:packed.area?Number((lowerBoundArea/packed.area).toFixed(6)):0,wasteArea:Math.max(0,packed.area-lowerBoundArea)});
  }
  candidates.sort((a,b)=>a.area-b.area||b.occupancy-a.occupancy||a.height-b.height||a.width-b.width||a.heuristic.localeCompare(b.heuristic)||a.sort.localeCompare(b.sort));
  const best=candidates[0]||null;
  return best?{...best,tournament:{tested:candidates.length,widths:widths.length,heuristics:[...heuristics],sorts:[...sorts],top:candidates.slice(0,12).map(c=>({width:c.width,height:c.height,area:c.area,candidateWidth:c.candidateWidth,heuristic:c.heuristic,sort:c.sort,occupancy:c.occupancy,wasteArea:c.wasteArea}))}}:null;
}
