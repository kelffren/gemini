/* KELO-INDEX
 * area: UI / INTERFACE RUNTIME
 * owner: Kelo Interface System
 * purpose: small progressive-disclosure and accessibility upgrades for shared Kelo software surfaces
 * do-not-own: feature state, gameplay state, persistence or editor mutations
 */
(function(){
'use strict';
if(window.KELO_INTERFACE_RUNTIME)return;

const VERSION='kelo-interface-runtime-v1.0.0';
const seen=new WeakSet();

function text(el,value){if(el&&el.textContent!==value)el.textContent=value;}
function aria(el,label){if(el&&!el.getAttribute('aria-label'))el.setAttribute('aria-label',label);}

function enhanceLuxe(host){
  if(!host||seen.has(host))return;
  seen.add(host);
  const heading=host.querySelector('.lx-menu-head');
  if(heading&&heading.childNodes.length)heading.childNodes[0].textContent='Menu';
  aria(host.querySelector('.lx-menu-close'),'Cerrar menú');
  host.querySelectorAll('.lx-menu-item').forEach(button=>{
    const label=button.querySelector('.lx-menu-copy b')?.textContent?.trim();
    if(label)aria(button,label);
  });
}

function enhanceAccount(host){
  if(!host||seen.has(host))return;
  seen.add(host);
  host.querySelectorAll('button').forEach(button=>{
    const label=button.textContent?.trim();
    if(label)aria(button,label);
  });
}

function enhanceCreators(host){
  if(!host||seen.has(host))return;
  seen.add(host);
  const close=host.querySelector('.kc-close');
  aria(close,'Cerrar Kelo Creators');
  host.querySelectorAll('.kc-nav button,.kc-card').forEach(button=>{
    const label=button.querySelector('strong')?.textContent?.trim()||button.textContent?.trim();
    if(label)aria(button,label);
  });
}

function enhanceStudio(host){
  if(!host||seen.has(host))return;
  seen.add(host);
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

function enhanceAssetRepairer(host){
  if(!host||host.dataset.kuiEnhanced==='true')return;
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
    more.textContent='More Tools';
    more.addEventListener('click',()=>setAdvanced(host,host.dataset.kuiAdvanced!=='true'));
    tools.appendChild(more);
  }

  setAdvanced(host,false);
}

function scan(root=document){
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
  destroy(){observer.disconnect();delete window.KELO_INTERFACE_RUNTIME;}
});
})();
