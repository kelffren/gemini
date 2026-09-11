/* KELO-INDEX
 * area: UI / INTERFACE RUNTIME
 * owner: Kelo Interface System
 * purpose: progressive disclosure, contextual actions and accessibility upgrades for shared Kelo software surfaces
 * do-not-own: feature state, gameplay state, persistence or editor mutations
 */
(function(){
'use strict';
if(window.KELO_INTERFACE_RUNTIME)return;

const VERSION='kelo-interface-runtime-v1.1.0';
const RUNTIME_STYLE_ID='kelo-interface-runtime-style';

function ensureStyle(){
  if(document.getElementById(RUNTIME_STYLE_ID))return;
  const style=document.createElement('style');
  style.id=RUNTIME_STYLE_ID;
  style.textContent=`
    #kelo-asset-repairer [data-kui-advanced="1"][hidden]{display:none!important}
    #kelo-asset-repairer .kui-more-tools{
      width:100%!important;margin-top:8px!important;border-color:transparent!important;
      background:transparent!important;color:var(--kui-text-3,#8e8e93)!important;
      box-shadow:none!important;font-weight:600!important;
    }
    #kelo-asset-repairer .kui-more-tools:hover{background:rgba(255,255,255,.045)!important;color:var(--kui-text-2,#c7c7cc)!important}
    #kelo-asset-repairer[data-kui-has-asset="false"] .kar-tool{opacity:.42}
    @media(max-width:700px){#kelo-asset-repairer .kui-more-tools{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
}

function text(el,value){if(el&&el.textContent!==value)el.textContent=value;}
function aria(el,label){if(el&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',label);}

function enhanceLuxe(host){
  if(!host)return;
  const heading=host.querySelector('.lx-menu-head');
  if(heading&&heading.childNodes.length)heading.childNodes[0].textContent='Menu';
  aria(host.querySelector('.lx-menu-close'),'Cerrar menú');
  host.querySelectorAll('.lx-menu-item').forEach(button=>{
    const label=button.querySelector('.lx-menu-copy b')?.textContent?.trim();
    if(label)aria(button,label);
  });
}

function enhanceAccount(host){
  if(!host)return;
  host.querySelectorAll('button').forEach(button=>{
    const label=button.textContent?.trim();
    if(label)aria(button,label);
  });
}

function enhanceCreators(host){
  if(!host)return;
  aria(host.querySelector('.kc-close'),'Cerrar Kelo Creators');
  host.querySelectorAll('.kc-nav button,.kc-card').forEach(button=>{
    const label=button.querySelector('strong')?.textContent?.trim()||button.textContent?.trim();
    if(label)aria(button,label);
  });
}

function enhanceStudio(host){
  if(!host)return;
  host.querySelectorAll('button').forEach(button=>{
    const action=button.dataset?.act;
    if(action==='close')aria(button,'Cerrar Studio');
    else if(action==='save')aria(button,'Guardar cambios');
    else if(action==='undo')aria(button,'Deshacer');
    else if(action==='redo')aria(button,'Rehacer');
  });
}

function setAdvanced(host,open){
  host.dataset.kuiAdvanced=open?'true':'false';
  host.querySelectorAll('[data-kui-advanced="1"]').forEach(button=>{button.hidden=!open;});
  const toggle=host.querySelector('[data-kui-more-tools]');
  if(toggle){
    toggle.setAttribute('aria-expanded',open?'true':'false');
    toggle.textContent=open?'Hide Tools':'More Tools';
  }
}

function syncAssetRepairer(host){
  if(!host)return;
  const exportButton=host.querySelector('[data-act="export"]');
  const hasAsset=Boolean(exportButton&&!exportButton.disabled);
  host.dataset.kuiHasAsset=hasAsset?'true':'false';

  host.querySelectorAll('[data-tool]').forEach(button=>{button.disabled=!hasAsset;});
  const reset=host.querySelector('[data-act="reset"]');
  const undo=host.querySelector('[data-act="undo"]');
  if(reset)reset.disabled=!hasAsset;
  if(undo)undo.disabled=!hasAsset;
}

function enhanceAssetRepairer(host){
  if(!host)return;
  if(host.dataset.kuiEnhanced!=='true'){
    host.dataset.kuiEnhanced='true';

    text(host.querySelector('.kar-title small'),'Clean, align and export assets');
    text(host.querySelector('.kar-stage-head h2'),'Preview');
    text(host.querySelector('.kar-kicker'),'Repair');

    const steps=[...host.querySelectorAll('.kar-step span')];
    ['Import','Repair','Review','Export'].forEach((label,index)=>text(steps[index],label));

    const open=host.querySelector('[data-act="open"]');
    if(open){text(open,'Open Asset');aria(open,'Open asset');}
    const reset=host.querySelector('[data-act="reset"]');
    if(reset){text(reset,'Reset');aria(reset,'Reset current asset');}
    const undo=host.querySelector('[data-act="undo"]');
    if(undo){text(undo,'Undo');aria(undo,'Undo last repair');}
    const exportButton=host.querySelector('[data-act="export"]');
    if(exportButton){text(exportButton,'Export PNG');aria(exportButton,'Export repaired PNG');}
    aria(host.querySelector('[data-repair-close]'),'Close Asset Repairer');

    const auto=host.querySelector('[data-tool="auto"]');
    if(auto){
      text(auto.querySelector('strong'),'Auto Repair');
      text(auto.querySelector('small'),'Recommended');
      auto.dataset.kuiRole='primary';
      aria(auto,'Automatically repair the current asset');
    }

    const align=host.querySelector('[data-tool="align"]');
    if(align){
      text(align.querySelector('strong'),'Align Frames');
      text(align.querySelector('small'),'Lock animation to feet');
      aria(align,'Align animation frames to a shared feet anchor');
    }

    for(const tool of ['background','edges','pivot','scale','seams']){
      const button=host.querySelector(`[data-tool="${tool}"]`);
      if(button)button.dataset.kuiAdvanced='1';
    }

    const tools=host.querySelector('.kar-tools');
    if(tools&&!tools.querySelector('[data-kui-more-tools]')){
      const more=document.createElement('button');
      more.type='button';
      more.className='kar-btn kui-more-tools';
      more.dataset.kuiMoreTools='1';
      more.setAttribute('aria-expanded','false');
      more.setAttribute('aria-label','Show advanced repair tools');
      more.textContent='More Tools';
      more.addEventListener('click',()=>setAdvanced(host,host.dataset.kuiAdvanced!=='true'));
      tools.appendChild(more);
    }

    setAdvanced(host,false);
  }

  syncAssetRepairer(host);
}

function scan(root=document){
  ensureStyle();
  enhanceLuxe(root.querySelector?.('#kelo-luxe'));
  enhanceAccount(root.querySelector?.('#kelo-account-auth'));
  enhanceCreators(root.querySelector?.('#kelo-creators-hub'));
  enhanceStudio(root.querySelector?.('#kelo-studio-live'));
  enhanceAssetRepairer(root.querySelector?.('#kelo-asset-repairer'));
}

const observer=new MutationObserver(()=>scan(document));
observer.observe(document.documentElement,{childList:true,subtree:true});
scan(document);

window.KELO_INTERFACE_RUNTIME=Object.freeze({
  version:VERSION,
  scan:()=>scan(document),
  destroy(){observer.disconnect();document.getElementById(RUNTIME_STYLE_ID)?.remove();delete window.KELO_INTERFACE_RUNTIME;}
});
})();
