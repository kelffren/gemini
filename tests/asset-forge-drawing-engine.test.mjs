import assert from 'node:assert/strict';
import {
  appendInterpolatedPath,ellipseOutlinePoints,floodFillImageData,linePoints,mirrorPixelPoints,
  rectangleOutlinePoints,simplifyPixelPerfect
} from '../src/creators/assets/asset-forge-drawing-engine.mjs';

{
  const points=linePoints(0,0,5,2);
  assert.deepEqual(points[0],{x:0,y:0});
  assert.deepEqual(points.at(-1),{x:5,y:2});
  for(let i=1;i<points.length;i++){
    assert.ok(Math.abs(points[i].x-points[i-1].x)<=1);
    assert.ok(Math.abs(points[i].y-points[i-1].y)<=1);
  }
}

{
  const path=appendInterpolatedPath([{x:1,y:1}],{x:5,y:1});
  assert.deepEqual(path,[{x:1,y:1},{x:2,y:1},{x:3,y:1},{x:4,y:1},{x:5,y:1}]);
}

{
  const cleaned=simplifyPixelPerfect([{x:0,y:0},{x:1,y:0},{x:1,y:1}]);
  assert.deepEqual(cleaned,[{x:0,y:0},{x:1,y:1}]);
}

{
  const mirrored=mirrorPixelPoints([{x:1,y:2}],8,8,{horizontal:true,vertical:true});
  assert.deepEqual(new Set(mirrored.map(p=>`${p.x},${p.y}`)),new Set(['1,2','6,2','1,5','6,5']));
}

{
  const rect=rectangleOutlinePoints({x:1,y:1},{x:3,y:3});
  assert.equal(rect.length,8);
  assert.ok(rect.some(p=>p.x===1&&p.y===1));
  assert.ok(rect.some(p=>p.x===3&&p.y===3));
}

{
  const ellipse=ellipseOutlinePoints({x:0,y:0},{x:6,y:4});
  assert.ok(ellipse.length>=8);
  assert.ok(ellipse.every(p=>Number.isInteger(p.x)&&Number.isInteger(p.y)));
}

{
  const image={width:3,height:3,data:new Uint8ClampedArray(3*3*4)};
  for(let i=0;i<image.data.length;i+=4){image.data[i]=10;image.data[i+1]=20;image.data[i+2]=30;image.data[i+3]=255;}
  const changed=floodFillImageData(image,1,1,[200,0,0,255]);
  assert.equal(changed,true);
  for(let i=0;i<image.data.length;i+=4)assert.equal(image.data[i],200);
}

{
  const image={width:2,height:2,data:new Uint8ClampedArray(16)};
  const changed=floodFillImageData(image,0,0,[255,255,255,255],{alphaLock:true});
  assert.equal(changed,false);
}

console.log('asset-forge-drawing-engine: ok');
