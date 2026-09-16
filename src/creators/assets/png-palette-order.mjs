/* KELO-INDEX
 * area: CREATORS / ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG PALETTE ORDER INDEX FREQUENCY LUMINANCE ADJACENCY TRNS EXACT
 * purpose: generate deterministic exact palette-index permutations that can improve PNG filter/DEFLATE compression without changing RGBA pixels
 * public-api: buildPaletteOrderings(), PALETTE_ORDER_FAST, PALETTE_ORDER_BALANCED, PALETTE_ORDER_DEEP
 * state-owned: none; pure palette/index transformation
 * online: N/A; creator/build-time capability only
 * do-not: quantize colors, alter alpha, invent unmeasured compression wins, or mutate SOURCE
 */

export const PALETTE_ORDER_FAST=Object.freeze(['first-seen']);
export const PALETTE_ORDER_BALANCED=Object.freeze(['first-seen','alpha-frequency','frequency','luminance']);
export const PALETTE_ORDER_DEEP=Object.freeze(['first-seen','alpha-frequency','frequency','luminance','adjacency']);

function identity(n){return Array.from({length:n},(_,i)=>i);}
function luminance(color){return color[0]*299+color[1]*587+color[2]*114;}
function compareCount(counts,a,b){return counts[b]-counts[a]||a-b;}
function frequencyOrder(colors,counts){return identity(colors.length).sort((a,b)=>compareCount(counts,a,b));}
function alphaFrequencyOrder(colors,counts){return identity(colors.length).sort((a,b)=>((colors[a][3]===255)-(colors[b][3]===255))||compareCount(counts,a,b));}
function luminanceOrder(colors){return identity(colors.length).sort((a,b)=>((colors[a][3]===255)-(colors[b][3]===255))||luminance(colors[a])-luminance(colors[b])||colors[a][3]-colors[b][3]||a-b);}

function buildAdjacency(indexes,width,height,colorCount){
  const matrix=new Uint32Array(colorCount*colorCount);
  const add=(a,b,weight)=>{if(a===b)return;matrix[a*colorCount+b]+=weight;matrix[b*colorCount+a]+=weight;};
  for(let y=0;y<height;y+=1){for(let x=0;x<width;x+=1){const p=y*width+x,a=indexes[p];if(x>0)add(a,indexes[p-1],2);if(y>0){add(a,indexes[p-width],1);if(x>0)add(a,indexes[p-width-1],1);if(x+1<width)add(a,indexes[p-width+1],1);}}}
  return matrix;
}
function adjacencyOrder(colors,indexes,width,height,counts){
  const n=colors.length,matrix=buildAdjacency(indexes,width,height,n),unused=new Set(identity(n)),order=[];
  let current=frequencyOrder(colors,counts)[0];order.push(current);unused.delete(current);
  while(unused.size){let best=null,bestScore=-1,bestCount=-1;for(const candidate of unused){let score=0;const recent=order.slice(-8);for(let r=0;r<recent.length;r+=1){const prior=recent[recent.length-1-r],recency=8-r;score+=matrix[candidate*n+prior]*recency;}const count=counts[candidate];if(score>bestScore||(score===bestScore&&(count>bestCount||(count===bestCount&&(best===null||candidate<best))))){best=candidate;bestScore=score;bestCount=count;}}order.push(best);unused.delete(best);current=best;}
  return order;
}
function normalizeStrategies(strategies){
  if(strategies==='all')return [...PALETTE_ORDER_DEEP];
  const input=Array.isArray(strategies)&&strategies.length?strategies:PALETTE_ORDER_FAST;
  const allowed=new Set(PALETTE_ORDER_DEEP),out=[];for(const name of input){if(!allowed.has(name))throw new Error(`PNG_PALETTE_ORDER_UNKNOWN:${name}`);if(!out.includes(name))out.push(name);}return out;
}
function remap(colors,indexes,order,name){
  const newByOld=new Uint16Array(colors.length);order.forEach((oldIndex,newIndex)=>{newByOld[oldIndex]=newIndex;});
  const remapped=Buffer.alloc(indexes.length);for(let i=0;i<indexes.length;i+=1)remapped[i]=newByOld[indexes[i]];
  return{name,colors:order.map(oldIndex=>colors[oldIndex].slice()),indexes:remapped};
}

export function buildPaletteOrderings({colors,indexes,width,height,strategies=PALETTE_ORDER_FAST}={}){
  if(!Array.isArray(colors)||colors.length<1||colors.length>256)throw new Error('PNG_PALETTE_ORDER_COLOR_COUNT');
  if(!Buffer.isBuffer(indexes)||indexes.length!==width*height)throw new Error('PNG_PALETTE_ORDER_INDEX_DIMENSIONS');
  const counts=new Uint32Array(colors.length);for(const index of indexes){if(index>=colors.length)throw new Error(`PNG_PALETTE_ORDER_INDEX_RANGE:${index}`);counts[index]+=1;}
  const requested=normalizeStrategies(strategies),seen=new Set(),variants=[];
  for(const name of requested){let order;if(name==='first-seen')order=identity(colors.length);else if(name==='frequency')order=frequencyOrder(colors,counts);else if(name==='alpha-frequency')order=alphaFrequencyOrder(colors,counts);else if(name==='luminance')order=luminanceOrder(colors);else order=adjacencyOrder(colors,indexes,width,height,counts);const key=order.join(',');if(seen.has(key))continue;seen.add(key);variants.push(remap(colors,indexes,order,name));}
  return variants;
}
