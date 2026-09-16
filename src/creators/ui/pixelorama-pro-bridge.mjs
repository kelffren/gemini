/* KELO-INDEX
 * area: CREATORS / ASSET FORGE
 * owner: Kelo Asset Forge / Pixelorama bridge
 * keys: PIXELORAMA PRO BRIDGE EXTERNAL EDITOR HANDOFF SAFE URL OPTIONAL
 * purpose: optional lazy handoff from Asset Forge to an external Pixelorama web editor without making remote tooling a runtime dependency
 * public-api: mountPixeloramaProBridge(), normalizePixeloramaUrl(), buildPixeloramaHandoff()
 * state-owned: one optional UI button only
 * online: optional creator-time capability
 * do-not: send secrets, replace Kelo QA/compile authority, or make local drawing depend on the external editor
 */

const ALLOWED_PROTOCOLS=new Set(['http:','https:']);

export function normalizePixeloramaUrl(value){
  const raw=String(value||'').trim();
  if(!raw)return null;
  try{
    const url=new URL(raw,globalThis.location?.href||'https://kelo.invalid/');
    if(!ALLOWED_PROTOCOLS.has(url.protocol))return null;
    url.username='';url.password='';
    return url.toString();
  }catch{return null;}
}

export function buildPixeloramaHandoff(baseUrl,input={}){
  const normalized=normalizePixeloramaUrl(baseUrl);
  if(!normalized)return null;
  const url=new URL(normalized);
  const safeText=value=>String(value||'').slice(0,160);
  if(input.assetName)url.searchParams.set('keloAsset',safeText(input.assetName));
  if(input.templateId)url.searchParams.set('keloTemplate',safeText(input.templateId));
  if(input.returnUrl){
    const returnUrl=normalizePixeloramaUrl(input.returnUrl);
    if(returnUrl)url.searchParams.set('keloReturn',returnUrl);
  }
  return url.toString();
}

function getConfiguredUrl(options={}){
  return normalizePixeloramaUrl(
    options.url ||
    globalThis.KELO_PIXELORAMA_URL ||
    globalThis.__KELO_CONFIG__?.pixeloramaUrl ||
    ''
  );
}

function findHost(root){
  return root?.querySelector?.('[data-asset-forge-actions], .kelo-asset-forge-actions, .kelo-creator-toolbar, .kelo-asset-forge-toolbar') || root;
}

export function mountPixeloramaProBridge(root,options={}){
  if(!root?.querySelector)return()=>{};
  const configured=getConfiguredUrl(options);
  if(!configured)return()=>{};
  if(root.querySelector('[data-kelo-pixelorama-pro]'))return()=>{};
  const host=findHost(root);
  if(!host?.appendChild)return()=>{};
  const doc=root.ownerDocument||globalThis.document;
  if(!doc?.createElement)return()=>{};
  const button=doc.createElement('button');
  button.type='button';
  button.dataset.keloPixeloramaPro='1';
  button.textContent='OPEN PRO EDITOR';
  button.title='Abrir Pixelorama en otra pestaña. Asset Forge local sigue funcionando.';
  button.style.cssText='min-height:44px;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:#15171d;color:#fff;font-weight:800;letter-spacing:.04em;';
  const click=()=>{
    const handoff=buildPixeloramaHandoff(configured,{
      assetName:options.getAssetName?.() || root.querySelector?.('[data-asset-name]')?.value || '',
      templateId:options.getTemplateId?.() || root.querySelector?.('[data-asset-template]')?.value || '',
      returnUrl:options.returnUrl || globalThis.location?.href || ''
    });
    if(!handoff)return;
    try{
      const popup=globalThis.open?.(handoff,'_blank','noopener,noreferrer');
      if(popup)try{popup.opener=null;}catch{}
      root.dispatchEvent?.(new CustomEvent('kelo:asset-forge:pixelorama-open',{detail:{url:handoff}}));
    }catch(error){console.warn('[Kelo Asset Forge] Pixelorama bridge open failed',error);}
  };
  button.addEventListener('click',click);
  host.appendChild(button);
  return()=>{button.removeEventListener('click',click);button.remove();};
}
