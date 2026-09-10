/* KELO-INDEX
 * area: STUDIO / ASSET PALETTE
 * owns: compact searchable floating asset browser for clean workspace
 * does-not-own: placement semantics, asset catalog, authority or world mutations
 * public-api: createStudioAssetPalette(), filterAssetPaletteRows(), assetPaletteCategories()
 * online: no; selecting delegates to existing Studio placement flow
 */

const STYLE_ID='kelo-studio-asset-palette-style';
const MAX_VISIBLE=72;
const copyRows=rows=>(Array.isArray(rows)?rows:[]).filter(Boolean);
const text=value=>String(value??'').trim();

export function assetPaletteCategories(rows=[],limit=7){
  const counts=new Map();
  for(const row of copyRows(rows)){
    const category=text(row.category||row.group||'general').toLowerCase()||'general';
    counts.set(category,(counts.get(category)||0)+1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,Math.max(1,Number(limit)||7)).map(([id,count])=>({id,count}));
}

export function filterAssetPaletteRows(rows=[],{query='',category='all',recentIds=[],limit=MAX_VISIBLE}={}){
  const q=text(query).toLowerCase();
  const cat=text(category).toLowerCase()||'all';
  const recent=new Map((Array.isArray(recentIds)?recentIds:[]).map((id,index)=>[String(id),index]));
  let out=copyRows(rows).filter(row=>{
    const id=String(row.id||'');
    const rowCategory=text(row.category||row.group||'general').toLowerCase()||'general';
    if(cat==='recent'&&!recent.has(id))return false;
    if(cat!=='all'&&cat!=='recent'&&rowCategory!==cat)return false;
    if(!q)return true;
    return `${row.label||''} ${row.name||''} ${id} ${rowCategory}`.toLowerCase().includes(q);
  });
  if(cat==='recent')out.sort((a,b)=>(recent.get(String(a.id))??999)-(recent.get(String(b.id))??999));
  return out.slice(0,Math.max(1,Number(limit)||MAX_VISIBLE));
}

function ensureStyle(document){
  if(!document?.head||document.getElementById?.(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;style.dataset.keloStudioUi='1';
  style.textContent=`
    #kelo-studio-live .ks-asset-palette-toggle{display:none!important}
    #kelo-studio-live .ks-asset-palette{
      position:fixed;left:50%;bottom:max(90px,calc(env(safe-area-inset-bottom) + 78px));transform:translateX(-50%);
      z-index:326;width:min(620px,calc(100vw - 24px));max-height:min(58vh,520px);display:none;overflow:hidden;
      border:1px solid rgba(231,197,106,.42);border-radius:18px;background:rgba(6,16,18,.975);
      box-shadow:0 20px 70px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.035);
      backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);pointer-events:auto
    }
    #kelo-studio-live .ks-asset-palette.on{display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto}
    #kelo-studio-live .ks-asset-palette-head{display:flex;align-items:center;gap:8px;padding:9px 10px 7px}
    #kelo-studio-live .ks-asset-palette-head strong{font-family:Georgia,"Times New Roman",serif;color:#f0d77d;font-size:10px;letter-spacing:.09em}
    #kelo-studio-live .ks-asset-palette-count{font-size:6px;color:#809b90;margin-left:2px}
    #kelo-studio-live .ks-asset-palette-spacer{flex:1}
    #kelo-studio-live .ks-asset-palette-close{width:34px;height:32px;border:1px solid rgba(255,255,255,.08);border-radius:9px;background:#0f1b1d;color:#dfe8e3;font-size:16px;padding:0}
    #kelo-studio-live .ks-asset-palette-search-wrap{padding:0 9px 7px}
    #kelo-studio-live .ks-asset-palette-search{width:100%;height:39px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:#0d181a;color:#f5f8f6;padding:0 12px;font-size:9px;outline:none}
    #kelo-studio-live .ks-asset-palette-search:focus{border-color:rgba(231,197,106,.55);box-shadow:0 0 0 2px rgba(231,197,106,.07)}
    #kelo-studio-live .ks-asset-palette-cats{display:flex;gap:5px;overflow-x:auto;padding:0 9px 8px;scrollbar-width:none}
    #kelo-studio-live .ks-asset-palette-cats::-webkit-scrollbar{display:none}
    #kelo-studio-live .ks-asset-palette-cat{flex:0 0 auto;height:31px;border:1px solid rgba(255,255,255,.07);border-radius:999px;background:#0e1a1c;color:#95aaa1;padding:0 10px;font-size:6px;font-weight:900;text-transform:uppercase;letter-spacing:.05em}
    #kelo-studio-live .ks-asset-palette-cat.on{border-color:rgba(231,197,106,.52);background:#1b342d;color:#f4dfa0}
    #kelo-studio-live .ks-asset-palette-grid{overflow:auto;padding:1px 9px 10px;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;align-content:start}
    #kelo-studio-live .ks-asset-palette-item{min-width:0;height:104px;border:1px solid rgba(255,255,255,.065);border-radius:12px;background:rgba(12,24,25,.9);color:#e8efeb;padding:6px;display:grid;grid-template-rows:64px auto;gap:4px;text-align:left}
    #kelo-studio-live .ks-asset-palette-item:hover,#kelo-studio-live .ks-asset-palette-item:focus-visible{border-color:rgba(231,197,106,.46);background:#152923;outline:none}
    #kelo-studio-live .ks-asset-palette-item canvas{width:64px;height:64px;max-width:100%;justify-self:center;border-radius:9px;background:linear-gradient(145deg,#111e20,#091113);image-rendering:pixelated}
    #kelo-studio-live .ks-asset-palette-copy{min-width:0;line-height:1.1}
    #kelo-studio-live .ks-asset-palette-copy strong{display:block;font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #kelo-studio-live .ks-asset-palette-copy small{display:block;margin-top:3px;color:#769087;font-size:5.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-transform:uppercase}
    #kelo-studio-live .ks-asset-palette-empty{grid-column:1/-1;padding:28px 10px;text-align:center;color:#789087;font-size:8px;line-height:1.6}
    #kelo-studio-live .ks-asset-palette-foot{padding:7px 10px;border-top:1px solid rgba(255,255,255,.055);font-size:6px;color:#708a80;display:flex;justify-content:space-between;gap:8px}
    @media(max-width:760px){
      #kelo-studio-live .ks-asset-palette{left:8px;right:8px;width:auto;transform:none;bottom:max(78px,calc(env(safe-area-inset-bottom) + 70px));max-height:min(56vh,460px);border-radius:16px}
      #kelo-studio-live .ks-asset-palette-head{padding:8px 9px 6px}
      #kelo-studio-live .ks-asset-palette-search{height:42px;font-size:10px}
      #kelo-studio-live .ks-asset-palette-cat{height:33px;font-size:6.2px}
      #kelo-studio-live .ks-asset-palette-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:1px 7px 8px}
      #kelo-studio-live .ks-asset-palette-item{height:98px;padding:5px;grid-template-rows:60px auto}
      #kelo-studio-live .ks-asset-palette-item canvas{width:60px;height:60px}
    }
    @media(max-width:370px){#kelo-studio-live .ks-asset-palette-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(style);
}

export function createStudioAssetPalette({root=globalThis,getAssets=()=>[],onSelect=()=>{},renderAssetPreview=()=>{}}={}){
  const document=root?.document;
  if(!document)return Object.freeze({attach:()=>false,open(){},close(){},toggle(){},refresh(){},destroy(){}});
  ensureStyle(document);

  let shell=null,palette=null,toggleButton=null,observer=null,destroyed=false,opened=false,query='',category='all';
  const recentIds=[];
  const allRows=()=>copyRows(getAssets?.()).filter(row=>row?.id!=null);

  function remember(id){
    id=String(id);const index=recentIds.indexOf(id);if(index>=0)recentIds.splice(index,1);recentIds.unshift(id);if(recentIds.length>10)recentIds.length=10;
  }
  function build(){
    palette=document.createElement('section');palette.className='ks-asset-palette';palette.dataset.keloStudioUi='1';palette.setAttribute('aria-label','Paleta de assets');
    palette.innerHTML=`
      <div class="ks-asset-palette-head"><strong>ASSETS</strong><span class="ks-asset-palette-count"></span><span class="ks-asset-palette-spacer"></span><button type="button" class="ks-asset-palette-close" data-asset-palette-close aria-label="Cerrar Assets">×</button></div>
      <div class="ks-asset-palette-search-wrap"><input class="ks-asset-palette-search" type="search" autocomplete="off" spellcheck="false" placeholder="Buscar árbol, pared, tienda…"></div>
      <div class="ks-asset-palette-cats"></div>
      <div class="ks-asset-palette-grid"></div>
      <div class="ks-asset-palette-foot"><span>TOCA UN ASSET → COLOCAR</span><span>ESC → CERRAR</span></div>`;
    shell.appendChild(palette);
    const search=palette.querySelector('.ks-asset-palette-search');
    search.addEventListener('input',()=>{query=search.value;render();});
    palette.addEventListener('click',event=>{
      if(event.target.closest('[data-asset-palette-close]')){event.preventDefault();close();return;}
      const cat=event.target.closest('[data-asset-palette-category]');
      if(cat){event.preventDefault();category=cat.dataset.assetPaletteCategory||'all';render();return;}
      const item=event.target.closest('[data-asset-palette-id]');
      if(item){event.preventDefault();event.stopPropagation();const id=item.dataset.assetPaletteId;remember(id);close();onSelect?.(id);}
    });
    palette.addEventListener('pointerdown',event=>event.stopPropagation());
  }
  function installToggle(){
    toggleButton=document.createElement('button');toggleButton.type='button';toggleButton.className='ks-asset-palette-toggle';toggleButton.dataset.studioAssetPaletteToggle='1';toggleButton.dataset.keloStudioUi='1';toggleButton.setAttribute('aria-hidden','true');
    toggleButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();toggle();});shell.appendChild(toggleButton);
  }
  function attach(){
    if(destroyed)return false;
    const next=document.getElementById?.('kelo-studio-live')||document.querySelector?.('#kelo-studio-live');if(!next)return false;
    if(shell===next&&palette?.isConnected&&toggleButton?.isConnected)return true;
    palette?.remove();toggleButton?.remove();shell=next;build();installToggle();render();return true;
  }
  function render(){
    if(!palette)return;
    const rows=allRows(),cats=assetPaletteCategories(rows),filtered=filterAssetPaletteRows(rows,{query,category,recentIds,limit:MAX_VISIBLE});
    if(category!=='all'&&category!=='recent'&&!cats.some(c=>c.id===category))category='all';
    const count=palette.querySelector('.ks-asset-palette-count');if(count)count.textContent=`${filtered.length}${filtered.length<rows.length?' visibles':''}`;
    const catHost=palette.querySelector('.ks-asset-palette-cats');catHost.replaceChildren();
    const choices=[{id:'all',label:'Todos',count:rows.length},...(recentIds.length?[{id:'recent',label:'Recientes',count:recentIds.length}]:[]),...cats.map(c=>({...c,label:c.id}))];
    for(const row of choices){const b=document.createElement('button');b.type='button';b.className='ks-asset-palette-cat'+(row.id===category?' on':'');b.dataset.assetPaletteCategory=row.id;b.textContent=`${row.label} ${row.count}`;catHost.appendChild(b);}
    const grid=palette.querySelector('.ks-asset-palette-grid');grid.replaceChildren();
    if(!filtered.length){const empty=document.createElement('div');empty.className='ks-asset-palette-empty';empty.textContent='No encontré assets con ese filtro.';grid.appendChild(empty);return;}
    for(const asset of filtered){
      const b=document.createElement('button');b.type='button';b.className='ks-asset-palette-item';b.dataset.assetPaletteId=String(asset.id);
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.setAttribute('aria-hidden','true');
      const copy=document.createElement('span');copy.className='ks-asset-palette-copy';const strong=document.createElement('strong');strong.textContent=asset.label||asset.name||asset.id;const small=document.createElement('small');small.textContent=asset.category||asset.group||(asset.creatorPrefab?'prefab':'general');copy.append(strong,small);b.append(canvas,copy);grid.appendChild(b);
      Promise.resolve(renderAssetPreview?.(canvas,asset)).catch(()=>{});
    }
  }
  function open(){attach();if(!palette)return false;opened=true;palette.classList.add('on');palette.setAttribute('aria-hidden','false');render();root.requestAnimationFrame?.(()=>palette?.querySelector('.ks-asset-palette-search')?.focus?.());return true;}
  function close(){opened=false;palette?.classList.remove('on');palette?.setAttribute('aria-hidden','true');return false;}
  function toggle(){return opened?close():open();}
  function onKey(event){if(opened&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation?.();close();}}
  function onPointer(event){if(!opened||event.target?.closest?.('.ks-asset-palette,[data-studio-asset-palette-toggle]'))return;close();}
  document.addEventListener('keydown',onKey,true);document.addEventListener('pointerdown',onPointer,true);
  attach();
  if(typeof root.MutationObserver==='function'&&document.body){observer=new root.MutationObserver(()=>{if(!destroyed)attach();});observer.observe(document.body,{childList:true,subtree:true});}

  return Object.freeze({
    attach,open,close,toggle,refresh:render,
    destroy(){destroyed=true;observer?.disconnect?.();document.removeEventListener('keydown',onKey,true);document.removeEventListener('pointerdown',onPointer,true);palette?.remove();toggleButton?.remove();palette=null;toggleButton=null;shell=null;},
    get openState(){return opened;},get category(){return category;},get query(){return query;},get recent(){return recentIds.slice();}
  });
}
