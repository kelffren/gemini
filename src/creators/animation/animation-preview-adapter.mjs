/* KELO-INDEX
 * area: CREATORS / ANIMATION PREVIEW ADAPTER
 * owner: Animation workspace preview bridge
 * owns: translation from AnimationDocument to existing visual runtime preview calls
 * does-not-own: animation playback engine, asset registry, avatar renderer, camera, combat or persistence
 * reuse: KeloAnimation + KeloAssetRegistry + current local player presentation
 */
import { animationClipFromDocument } from './animation-document.mjs';
export function createAnimationPreviewAdapter(root=globalThis){
  const actor=()=>root.localPlayer||root.player||null;
  async function warm(document){const clip=animationClipFromDocument(document);if(clip.type==='spritesheet'&&clip.assetId&&root.KeloAssetRegistry?.load)await root.KeloAssetRegistry.load(clip.assetId);return clip;}
  async function play(document,{direction='down',speed=1,loop=null}={}){
    if(typeof root.KeloAnimation?.preview!=='function')throw new Error('KELO_ANIMATION_PREVIEW_NOT_READY');const target=actor();if(!target)throw new Error('ANIMATION_PREVIEW_ACTOR_UNAVAILABLE');const clip=await warm(document);target._face=String(direction||'down');return root.KeloAnimation.preview(target,clip,{channel:clip.channel,speed:Number(speed)||1,loop:loop==null?clip.loop:loop===true,force:true,context:{actor:target,creatorPreview:true}});
  }
  function stop(document){const target=actor();if(!target)return false;const clip=animationClipFromDocument(document);return root.KeloAnimation?.stop?.(target,clip.channel,'CREATOR_PREVIEW_STOP')||false;}
  return Object.freeze({version:'animation-preview-adapter-v1.0.0',actor,warm,play,stop});
}
