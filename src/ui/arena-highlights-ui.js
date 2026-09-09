/* KELO-INDEX
 * area: UI / PVP ARENA HIGHLIGHTS
 * owner: KeloArenaHighlightsUI
 * purpose: presentation-only banner + post-match chips for KeloArenaHighlights
 */
(function(root){
'use strict';
if(root.KeloArenaHighlightsUI||!root.KeloArenaHighlights)return;
const VERSION='kelo-arena-highlights-ui-v1.0.0';
let queue=[],active=null,hideAt=0;
const style=document.createElement('style');
style.textContent='#ka-highlight-banner{position:fixed;z-index:181;top:88px;left:50%;transform:translate(-50%,-10px);padding:10px 18px;border-radius:14px;border:1px solid rgba(231,197,106,.55);background:rgba(6,14,16,.96);color:#f5df9e;font:900 15px sans-serif;letter-spacing:.08em;opacity:0;pointer-events:none;transition:.18s}#ka-highlight-banner.on{opacity:1;transform:translate(-50%,0)}#ka-highlight-banner.enemy{color:#ffb3bb;border-color:rgba(239,109,122,.58)}.ka-highlight-summary{margin-top:12px;padding:12px;border-radius:14px;background:rgba(231,197,106,.055);border:1px solid rgba(231,197,106,.18);text-align:left}.ka-highlight-list{display:flex;flex-wrap:wrap;gap:6px}.ka-highlight-chip{padding:6px 9px;border-radius:999px;background:#091619;border:1px solid rgba(231,197,106,.22);color:#eadba9;font-size:9px;font-weight:850}';
document.head.appendChild(style);
const banner=document.createElement('div');banner.id='ka-highlight-banner';banner.setAttribute('aria-live','polite');document.body.appendChild(banner);
function text(m){if(!m)return'';if(m.type==='shutdown'&&m.endedStreak)return m.label+' · '+m.endedStreak;if(m.type==='comeback'&&m.deficit)return m.label+' · -'+Math.round(m.deficit);return m.label||String(m.type||'HIGHLIGHT').toUpperCase();}
function show(m){if(!m)return;queue.push(m);if(!active)pump();}
function pump(){if(active||!queue.length)return;active=queue.shift();banner.textContent=text(active);banner.classList.toggle('enemy',active.local===false);banner.classList.add('on');hideAt=Date.now()+1900;}
function tick(){if(active&&Date.now()>=hideAt){banner.classList.remove('on');active=null;setTimeout(pump,180);}requestAnimationFrame(tick);}
function inject(){const list=root.KeloArenaHighlights.last&&root.KeloArenaHighlights.last();if(!list||!list.length)return;const result=document.querySelector('#ka-body .ka-result');if(!result||result.querySelector('.ka-highlight-summary'))return;const box=document.createElement('div');box.className='ka-highlight-summary';box.innerHTML='<strong>MOMENTOS DE LA PARTIDA</strong><div class="ka-highlight-list">'+list.map(m=>'<span class="ka-highlight-chip">'+text(m)+' · '+Math.floor(Number(m.at)||0)+'s</span>').join('')+'</div>';const anchor=result.querySelector('.ka-bests,.ka-coach,.ka-result-actions');if(anchor)result.insertBefore(box,anchor);else result.appendChild(box);}
root.addEventListener('kelo:arena-highlight',e=>show(e.detail));
root.addEventListener('kelo:arena-match-finished',()=>setTimeout(inject,40));
root.addEventListener('kelo:arena-progression-updated',()=>setTimeout(inject,0));
requestAnimationFrame(tick);
root.KeloArenaHighlightsUI=Object.freeze({version:VERSION,snapshot:()=>Object.freeze({queued:queue.length,active})});
root.KELO_ARENA_HIGHLIGHTS_UI_AUDIT=Object.freeze({version:VERSION,reusesArenaPanel:true,liveBanner:true,postMatchSummary:true,gameplayAuthority:false,secondMenu:false});
})(typeof globalThis!=='undefined'?globalThis:window);
