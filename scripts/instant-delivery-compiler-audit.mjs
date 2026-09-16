/* KELO-INDEX
 * area: BUILD / ASSET DELIVERY QA
 * owner: Kelo Creator Asset Bridge
 * keys: INSTANT DELIVERY AUDIT SPARSE ATLAS EXACT PIXELS DIMENSIONS
 * purpose: deterministic self-test for sparse logical-coordinate delivery atlases
 * public-api: CLI self-test
 * state-owned: none
 * online: N/A
 */
import {encodeRgbaPng,decodePngRgba} from '../src/creators/assets/png-space-optimizer.mjs';
import {buildSparsePngAtlas} from '../src/creators/assets/instant-delivery-compiler.mjs';

const width=128,height=128,rgba=Buffer.alloc(width*height*4);
let seed=0x12345678;
for(let p=0;p<width*height;p+=1){seed=(seed*1664525+1013904223)>>>0;const o=p*4;rgba[o]=seed&255;rgba[o+1]=(seed>>>8)&255;rgba[o+2]=(seed>>>16)&255;rgba[o+3]=255;}
const source=encodeRgbaPng(rgba,width,height,{level:6,filterStrategy:'adaptive'}),rect={id:'keep',x:8,y:8,w:24,h:24};
const built=buildSparsePngAtlas(source,[rect]),decoded=decodePngRgba(built.buffer);
if(decoded.ihdr.width!==width||decoded.ihdr.height!==height)throw new Error('INSTANT_DELIVERY_AUDIT_DIMENSIONS');
if(!built.report.requiredPixelsExact||!built.report.outsideCoverageTransparent)throw new Error('INSTANT_DELIVERY_AUDIT_PROOF');
if(!(built.buffer.length<source.length))throw new Error(`INSTANT_DELIVERY_AUDIT_EXPECTED_SAVING:${source.length}:${built.buffer.length}`);
for(let y=rect.y;y<rect.y+rect.h;y+=1)for(let x=rect.x;x<rect.x+rect.w;x+=1){const o=(y*width+x)*4;for(let c=0;c<4;c+=1)if(decoded.rgba[o+c]!==rgba[o+c])throw new Error('INSTANT_DELIVERY_AUDIT_PIXEL_CHANGED');}
let rejected=false;try{buildSparsePngAtlas(source,[{x:127,y:127,w:8,h:8}]);}catch(error){rejected=String(error?.message||error).startsWith('INSTANT_DELIVERY_RECT_OOB');}
if(!rejected)throw new Error('INSTANT_DELIVERY_AUDIT_OOB_NOT_REJECTED');
console.log(`INSTANT_DELIVERY_AUDIT_PASS source=${source.length} sparse=${built.buffer.length} saved=${built.report.savedBytes}`);
