/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / ISOLATION
 * purpose: run DOM-shaped canvas compiler code inside a Worker without granting a real document
 * public-api: createWorkerCanvasRoot()
 */
const F=Object.freeze;
function shimToBlob(canvas){
 if(typeof canvas?.toBlob==='function')return canvas;if(typeof canvas?.convertToBlob!=='function')throw new Error('ASSET_WORKER_CANVAS_BLOB_UNAVAILABLE');
 Object.defineProperty(canvas,'toBlob',{configurable:false,enumerable:false,writable:false,value(callback,type='image/png',quality){const options={type:String(type||'image/png')};if(Number.isFinite(Number(quality)))options.quality=Number(quality);canvas.convertToBlob(options).then(blob=>callback(blob),()=>callback(null));}});return canvas;
}
export function createWorkerCanvasRoot(scope=globalThis){
 if(typeof scope?.OffscreenCanvas!=='function')throw new Error('ASSET_WORKER_OFFSCREEN_CANVAS_UNAVAILABLE');if(typeof scope?.createImageBitmap!=='function')throw new Error('ASSET_WORKER_IMAGE_BITMAP_UNAVAILABLE');
 const document=F({createElement(tag){if(String(tag).toLowerCase()!=='canvas')throw new Error(`ASSET_WORKER_DOM_FORBIDDEN:${String(tag)}`);return shimToBlob(new scope.OffscreenCanvas(1,1));}});
 return F({document,OffscreenCanvas:scope.OffscreenCanvas,createImageBitmap:scope.createImageBitmap.bind(scope),URL:scope.URL||null,Image:null});
}
export const __assetWorkerCanvasRoot=F({shimToBlob});
