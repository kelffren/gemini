/* KELO-INDEX
 * area: CREATORS / ANIMATION PREVIEW ADAPTER
 * owner: Animation workspace preview bridge
 * owns: translation from AnimationDocument to existing visual runtime preview calls
 * does-not-own: animation playback engine, asset registry, avatar renderer, camera, combat or persistence
 * reuse: KeloAnimation + KeloAssetRegistry; runtime resolves its existing local actor binding
 */
import { animationClipFromDocument } from './animation-document.mjs';
export function createAnimationPreviewAdapter(root=globalThis){
  async function warm(document){const clip=animationClipFromDocument(document);if(clip.type==='spritesheet'&&clip.assetId&&root.KeloAssetRegistry?.load)await root.KeloAssetRegistry.load(clip.assetId);return clip;}
  async function play(document,{direction='down',speed=1,loop=null}={}){
    if(typeof root.KeloAnimation?.previewLocal!=='function')throw new Error('KELO_ANIMATION_PREVIEW_NOT_READY');const clip=await warm(document);return root.KeloAnimation.previewLocal(clip,{channel:clip.channel,direction:String(direction||'down'),speed:Number(speed)||1,loop:loop==null?clip.loop:loop===true,force:true,context:{creatorPreview:true}});
  }
  function stop(document){const clip=animationClipFromDocument(document);return root.KeloAnimation?.stopLocal?.(clip.channel,'CREATOR_PREVIEW_STOP')||false;}
  return Object.freeze({version:'animation-preview-adapter-v1.0.1',warm,play,stop});
}
