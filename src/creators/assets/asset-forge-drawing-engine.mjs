/* KELO-INDEX
 * area: CREATORS / ASSET FORGE DRAWING ENGINE
 * owner: Kelo Asset Forge
 * owns: deterministic pixel-stroke geometry used by the mobile Asset Forge enhancer
 * does-not-own: DOM, persistence, AI generation, canvas lifecycle or gameplay rendering
 * performance: pure functions only; canvas is <=64px per edge in Asset Forge V1
 * reference: behavior informed by Pixelorama's MIT-licensed pixel-art tooling, independently implemented for Kelo's JS canvas runtime
 */

const key = ({x,y}) => `${x},${y}`;
const point = (x,y) => ({x:Math.round(Number(x)||0),y:Math.round(Number(y)||0)});

export function samePoint(a,b){return !!a&&!!b&&a.x===b.x&&a.y===b.y;}

export function linePoints(x0,y0,x1,y1){
  let x=Math.round(x0),y=Math.round(y0),tx=Math.round(x1),ty=Math.round(y1);
  const points=[];
  const dx=Math.abs(tx-x),sx=x<tx?1:-1;
  const dy=-Math.abs(ty-y),sy=y<ty?1:-1;
  let error=dx+dy;
  while(true){
    points.push({x,y});
    if(x===tx&&y===ty)break;
    const doubled=2*error;
    if(doubled>=dy){error+=dy;x+=sx;}
    if(doubled<=dx){error+=dx;y+=sy;}
  }
  return points;
}

export function appendInterpolatedPath(path,next){
  const target=point(next.x,next.y);
  if(!Array.isArray(path)||!path.length)return [target];
  const last=path[path.length-1];
  if(samePoint(last,target))return path.slice();
  const segment=linePoints(last.x,last.y,target.x,target.y).slice(1);
  return path.concat(segment);
}

export function simplifyPixelPerfect(points){
  const output=[];
  for(const raw of Array.isArray(points)?points:[]){
    const current=point(raw.x,raw.y);
    if(samePoint(output[output.length-1],current))continue;
    output.push(current);
    let changed=true;
    while(changed&&output.length>=3){
      changed=false;
      const a=output[output.length-3],b=output[output.length-2],c=output[output.length-1];
      const cornerDx=Math.abs(c.x-a.x),cornerDy=Math.abs(c.y-a.y);
      const neighbourDistance=Math.abs(c.x-b.x)+Math.abs(c.y-b.y);
      if(cornerDx===1&&cornerDy===1&&neighbourDistance===1){
        output.splice(output.length-2,1);
        changed=true;
      }
    }
  }
  return output;
}

export function mirrorPixelPoints(input,width,height,{horizontal=false,vertical=false}={}){
  const w=Math.max(1,Math.round(Number(width)||1)),h=Math.max(1,Math.round(Number(height)||1));
  const seen=new Set(),output=[];
  function add(x,y){
    if(x<0||y<0||x>=w||y>=h)return;
    const value={x,y},id=key(value);
    if(seen.has(id))return;
    seen.add(id);output.push(value);
  }
  for(const raw of Array.isArray(input)?input:[]){
    const p=point(raw.x,raw.y),mx=w-1-p.x,my=h-1-p.y;
    add(p.x,p.y);
    if(horizontal)add(mx,p.y);
    if(vertical)add(p.x,my);
    if(horizontal&&vertical)add(mx,my);
  }
  return output;
}

export function brushStampPoints(center,size=1,width=Infinity,height=Infinity){
  const n=Math.max(1,Math.min(16,Math.round(Number(size)||1)));
  const p=point(center.x,center.y),offset=Math.floor((n-1)/2),result=[];
  for(let oy=0;oy<n;oy++)for(let ox=0;ox<n;ox++){
    const x=p.x+ox-offset,y=p.y+oy-offset;
    if(x>=0&&y>=0&&x<width&&y<height)result.push({x,y});
  }
  return result;
}

export function rectangleOutlinePoints(a,b,{filled=false}={}){
  const p0=point(a.x,a.y),p1=point(b.x,b.y);
  const minX=Math.min(p0.x,p1.x),maxX=Math.max(p0.x,p1.x),minY=Math.min(p0.y,p1.y),maxY=Math.max(p0.y,p1.y);
  const output=[];
  if(filled){
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)output.push({x,y});
    return output;
  }
  for(let x=minX;x<=maxX;x++){output.push({x,y:minY});if(maxY!==minY)output.push({x,y:maxY});}
  for(let y=minY+1;y<maxY;y++){output.push({x:minX,y});if(maxX!==minX)output.push({x:maxX,y});}
  return output;
}

export function ellipseOutlinePoints(a,b){
  const p0=point(a.x,a.y),p1=point(b.x,b.y);
  const minX=Math.min(p0.x,p1.x),maxX=Math.max(p0.x,p1.x),minY=Math.min(p0.y,p1.y),maxY=Math.max(p0.y,p1.y);
  const rx=(maxX-minX)/2,ry=(maxY-minY)/2,cx=minX+rx,cy=minY+ry;
  if(rx===0||ry===0)return linePoints(minX,minY,maxX,maxY);
  const steps=Math.max(16,Math.ceil(Math.PI*2*Math.max(rx,ry)*2));
  const seen=new Set(),output=[];
  for(let i=0;i<steps;i++){
    const angle=i/steps*Math.PI*2,x=Math.round(cx+Math.cos(angle)*rx),y=Math.round(cy+Math.sin(angle)*ry),id=`${x},${y}`;
    if(!seen.has(id)){seen.add(id);output.push({x,y});}
  }
  return output;
}

export function rgbaAt(data,width,x,y){
  const i=(y*width+x)*4;
  return [data[i],data[i+1],data[i+2],data[i+3]];
}

export function setRgba(data,width,x,y,rgba){
  const i=(y*width+x)*4;
  data[i]=rgba[0];data[i+1]=rgba[1];data[i+2]=rgba[2];data[i+3]=rgba[3];
}

export function floodFillImageData(image,x,y,rgba,{alphaLock=false}={}){
  const width=image.width,height=image.height,data=image.data;
  if(x<0||y<0||x>=width||y>=height)return false;
  const target=rgbaAt(data,width,x,y);
  if(alphaLock&&target[3]===0)return false;
  if(target.every((value,index)=>value===rgba[index]))return false;
  const queue=[[x,y]],seen=new Uint8Array(width*height);let changed=false;
  const matches=(px,py)=>{
    const current=rgbaAt(data,width,px,py);
    return current.every((value,index)=>value===target[index]);
  };
  while(queue.length){
    const [cx,cy]=queue.pop(),index=cy*width+cx;
    if(seen[index])continue;seen[index]=1;
    if(!matches(cx,cy))continue;
    setRgba(data,width,cx,cy,rgba);changed=true;
    if(cx>0)queue.push([cx-1,cy]);if(cx<width-1)queue.push([cx+1,cy]);
    if(cy>0)queue.push([cx,cy-1]);if(cy<height-1)queue.push([cx,cy+1]);
  }
  return changed;
}

export function uniquePoints(points){
  const seen=new Set(),output=[];
  for(const raw of Array.isArray(points)?points:[]){const p=point(raw.x,raw.y),id=key(p);if(!seen.has(id)){seen.add(id);output.push(p);}}
  return output;
}
