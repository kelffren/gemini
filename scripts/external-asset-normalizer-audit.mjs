import assert from 'node:assert/strict';import {inferExternalSpriteProfile,createNormalizedAssetManifest} from '../src/creators/assets/external-asset-normalizer.mjs';
const wolf={id:'opengameart:wolf',name:'Wolf 32x32',tags:['pixel-art','32x32','animation'],downloadUrl:'wolf.png',license:'CC0'};
const dog={id:'opengameart:dog',name:'Dog',tags:['dog','sprite-sheet','animation'],spriteProfile:{frameWidth:60,frameHeight:38,columns:6,rows:6},downloadUrl:'dog.png',license:'CC0'};
const bear={id:'opengameart:bear',name:'Bear 32x32',tags:['bear','32x32','top-down'],downloadUrl:'bear.png',license:'CC0'};
assert.deepEqual({...inferExternalSpriteProfile(wolf,{width:256,height:128}),anchor:undefined},{kind:'sprite-sheet',frameWidth:32,frameHeight:32,columns:8,rows:4,frameCount:32,background:'auto-corners',transparent:true,pixelArt:true,anchor:undefined});
const dp=inferExternalSpriteProfile(dog,{width:360,height:228});assert.equal(dp.frameWidth,60);assert.equal(dp.frameHeight,38);assert.equal(dp.columns,6);assert.equal(dp.rows,6);
const bp=inferExternalSpriteProfile(bear,{width:128,height:128});assert.equal(bp.frameWidth,32);assert.equal(bp.frameHeight,32);
for(const a of [wolf,dog,bear]){const m=createNormalizedAssetManifest(a,inferExternalSpriteProfile(a,{width:a===dog?360:128,height:a===dog?228:128}));assert.equal(m.schema,'kelo-normalized-external-v1');assert.equal(m.render.transparent,true)}
console.log('external-asset-normalizer-audit: wolf dog bear profiles OK');
