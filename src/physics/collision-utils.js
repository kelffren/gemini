(function(root,factory){
  const api=factory();
  if(root) root.KELO_COLLISION=api;
  if(typeof module==='object'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function resolveCircleAABB(cx,cy,r,box){
    const closestX=Math.max(box.x,Math.min(cx,box.x+box.w));
    const closestY=Math.max(box.y,Math.min(cy,box.y+box.h));
    const distX=cx-closestX,distY=cy-closestY,distSq=distX*distX+distY*distY;
    if(distSq<r*r&&distSq>0){
      const dist=Math.sqrt(distSq),overlap=r-dist;
      return{collided:true,pushX:(distX/dist)*overlap,pushY:(distY/dist)*overlap};
    }
    if(distSq===0){
      const left=cx-box.x,right=box.x+box.w-cx,top=cy-box.y,bottom=box.y+box.h-cy;
      const min=Math.min(left,right,top,bottom);
      if(min===left)return{collided:true,pushX:-(left+r),pushY:0};
      if(min===right)return{collided:true,pushX:right+r,pushY:0};
      if(min===top)return{collided:true,pushX:0,pushY:-(top+r)};
      return{collided:true,pushX:0,pushY:bottom+r};
    }
    return{collided:false,pushX:0,pushY:0};
  }
  function segmentAabbHitT(x0,y0,x1,y1,box,padding){
    const p=Math.max(0,Number(padding)||0);
    const minX=box.x-p,maxX=box.x+box.w+p,minY=box.y-p,maxY=box.y+box.h+p;
    const dx=x1-x0,dy=y1-y0;
    let tMin=0,tMax=1;
    function axis(origin,delta,min,max){
      if(Math.abs(delta)<1e-12)return origin>=min&&origin<=max;
      let a=(min-origin)/delta,b=(max-origin)/delta;
      if(a>b){const tmp=a;a=b;b=tmp;}
      tMin=Math.max(tMin,a);tMax=Math.min(tMax,b);
      return tMin<=tMax;
    }
    if(!axis(x0,dx,minX,maxX)||!axis(y0,dy,minY,maxY))return null;
    return tMin>=0&&tMin<=1?tMin:null;
  }
  return Object.freeze({resolveCircleAABB,segmentAabbHitT});
});
