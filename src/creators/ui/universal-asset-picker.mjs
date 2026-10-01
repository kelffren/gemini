/* KELO-INDEX
 * area: CREATORS / UNIVERSAL ASSET PICKER
 * owner: Kelo Creators
 * purpose: one Library entry point for World, Ability, NPC and Sprite-family workspaces
 */
const KIND_BY_WORKSPACE=Object.freeze({world:'image',ability:'vfx',npc:'sprite','sprite-ability':'sprite',animation:'sprite',vfx:'vfx',appearance:'sprite',avatar:'sprite'});
const LABEL_BY_WORKSPACE=Object.freeze({world:'LIBRARY',ability:'ASSETS',npc:'SPRITES','sprite-ability':'LIBRARY',animation:'SPRITES',vfx:'LIBRARY',appearance:'LIBRARY',avatar:'LIBRARY'});
function notify(root,msg){if(typeof root?.showToast==='function')root.showToast(msg);else console.info('[Kelo Asset Picker]',msg);}
function pickerUrl(root,workspace){const url=new URL('asset-vault.html',root.location?.href||location.href);url.searchParams.set('picker','1');url.searchParams.set('context',workspace);url.searchParams.set('kind',KIND_BY_WORKSPACE[workspace]||'all');return url.href;}
export function installUniversalAssetPicker({root=globalThis,workspace='generic',session=null}={}){
  const doc=root?.document;if(!doc?.body)return()=>{};
  const id='kelo-universal-asset-picker-'+workspace;doc.getElementById(id)?.remove();
  const button=doc.createElement('button');button.id=id;button.type='button';button.dataset.keloStudioUi='1';button.textContent=LABEL_BY_WORKSPACE[workspace]||'LIBRARY';
  button.setAttribute('aria-label','Elegir asset de Biblioteca Universal');
  button.style.cssText='position:fixed;z-index:2147483250;right:max(10px,env(safe-area-inset-right));bottom:max(76px,calc(env(safe-area-inset-bottom) + 66px));min-height:42px;padding:0 13px;border:1px solid rgba(231,197,106,.58);border-radius:13px;background:rgba(24,22,15,.96);color:#f5dfa0;font:900 10px/1 Inter,system-ui;letter-spacing:.08em;box-shadow:0 10px 30px rgba(0,0,0,.35)';
  let child=null;
  button.onclick=()=>{try{child=root.open(pickerUrl(root,workspace),'kelo-asset-picker','popup,width=760,height=820');child?.focus?.();}catch{root.location.href=pickerUrl(root,workspace);}};
  const onMessage=async event=>{
    if(event.origin!==root.location?.origin||event.data?.type!=='kelo:asset-picker-selected'||event.data?.context!==workspace)return;
    const asset=event.data.asset;if(!asset?.id)return;
    try{
      if(workspace==='world'&&session?.studio?.kernel){
        const mod=await import('../../studio/integration/external-live-preview-bridge.mjs?v=universal-picker-1');
        await mod.startExternalAssetPreview({root,session,asset});
        return;
      }
      root.dispatchEvent(new CustomEvent('kelo:creator-asset-picked',{detail:{workspace,asset,session}}));
      notify(root,asset.name+' seleccionado de Biblioteca');
    }catch(error){notify(root,String(error?.message||error).replaceAll('_',' '));}
  };
  root.addEventListener('message',onMessage);doc.body.append(button);
  return()=>{root.removeEventListener('message',onMessage);try{child?.close?.();}catch{}button.remove();};
}
export const KELO_UNIVERSAL_ASSET_PICKER=Object.freeze({version:'universal-asset-picker-v1',installUniversalAssetPicker});
