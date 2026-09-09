/* KELO-INDEX
 * area: CREATORS / HUB UI
 * owner: Kelo Creator Hub
 * owns: creator project navigation shell only
 * does-not-own: global navigation, Studio implementation, project persistence, permissions or publish policy
 * lazy: imported only after explicit CREATORS action
 */
import { bootKeloCreators } from '../creator-entry.mjs';
let active=null;
const CATALOG=Object.freeze([
  {category:'BUILD',items:[['world','World','active','Editor manual del mundo'],['map-forge','Map Forge','active','Generador automático de ciudades y mapas'],['parcel','Parcel','soon',''],['dungeon','Dungeon','soon',''],['game-mode','Game Mode','soon','']]},
  {category:'GAMEPLAY',items:[['ability','Ability','soon',''],['npc','NPC','soon',''],['quest','Quest / Dialogue','soon',''],['item','Item','soon',''],['crafting','Crafting','soon','']]},
  {category:'VISUAL',items:[['animation','Animation','soon',''],['vfx','VFX','soon',''],['cinematic','Cinematic','soon','']]},
  {category:'CONTENT',items:[['prefab','Prefab','soon',''],['environment','Environment','soon',''],['audio','Audio','soon','']]}
]);
function css(){return `
[data-kelo-creators-ui]{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f5f3ea}
#kelo-creators-hub{position:fixed;inset:0;z-index:2147482100;background:radial-gradient(circle at 50% -10%,rgba(198,164,92,.16),transparent 34%),rgba(7,8,10,.96);backdrop-filter:blur(16px);display:grid;grid-template-rows:auto 1fr;overflow:hidden}
.kc-head{display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(10,11,14,.9)}
.kc-mark{width:34px;height:34px;border:1px solid rgba(215,183,111,.65);display:grid;place-items:center;transform:rotate(45deg);border-radius:8px}.kc-mark span{transform:rotate(-45deg);font-size:11px;font-weight:900;letter-spacing:.08em}
.kc-title{min-width:0}.kc-title strong{display:block;font-size:17px;letter-spacing:.08em}.kc-title small{display:block;color:#9d9d9d;margin-top:2px}.kc-close{margin-left:auto;border:1px solid rgba(255,255,255,.13);background:#14161b;color:#fff;border-radius:12px;padding:9px 12px;font-weight:800;cursor:pointer}
.kc-layout{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:0}.kc-nav{padding:16px 12px;border-right:1px solid rgba(255,255,255,.08);overflow:auto}.kc-nav button{display:block;width:100%;text-align:left;border:0;background:transparent;color:#a7a7aa;border-radius:10px;padding:11px 12px;margin:2px 0;font-weight:750;cursor:pointer}.kc-nav button[aria-selected="true"]{color:#fff;background:rgba(255,255,255,.07)}.kc-nav button[hidden]{display:none}
.kc-main{overflow:auto;padding:24px clamp(16px,4vw,42px) 50px}.kc-main h1{font-size:clamp(26px,4vw,44px);margin:0 0 6px}.kc-lead{color:#a8a8ab;margin:0 0 28px}.kc-section{margin:28px 0}.kc-section h2{font-size:12px;letter-spacing:.18em;color:#cbb477;margin:0 0 12px}.kc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.kc-card{min-height:118px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025));border-radius:16px;padding:16px;text-align:left;color:#fff;display:flex;flex-direction:column;justify-content:space-between;transition:transform .16s ease,border-color .16s ease}.kc-card.active{cursor:pointer;border-color:rgba(214,179,99,.42)}.kc-card.active:active{transform:scale(.985)}.kc-card strong{font-size:17px}.kc-card small{color:#8f9095}.kc-pill{align-self:flex-start;font-size:10px;letter-spacing:.12em;border-radius:999px;padding:5px 8px;background:rgba(210,179,107,.12);color:#d5b976}.kc-empty{border:1px dashed rgba(255,255,255,.12);border-radius:16px;padding:28px;color:#9fa0a4}.kc-project{display:flex;align-items:center;gap:12px;border:1px solid rgba(255,255,255,.09);border-radius:14px;padding:14px;margin:9px 0}.kc-project button{margin-left:auto;border:1px solid rgba(214,179,99,.4);background:rgba(214,179,99,.1);color:#f7e2ad;border-radius:10px;padding:8px 11px;font-weight:800;cursor:pointer}
@media(max-width:700px){#kelo-creators-hub{grid-template-rows:auto auto minmax(0,1fr)}.kc-head{padding:12px 14px}.kc-layout{display:contents}.kc-nav{display:flex;gap:5px;overflow-x:auto;border-right:0;border-bottom:1px solid rgba(255,255,255,.08);padding:8px 10px}.kc-nav button{width:auto;white-space:nowrap;padding:9px 10px}.kc-main{padding:18px 14px 34px}.kc-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.kc-card{min-height:106px;padding:13px}.kc-title small{display:none}}
@media(max-width:380px){.kc-grid{grid-template-columns:1fr}}
`;}
function make(tag,props={},children=[]){const el=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k.startsWith('aria-'))el.setAttribute(k,v);else el[k]=v;}for(const child of [].concat(children||[]))if(child)el.append(child);return el;}
export async function openCreatorHub({root=globalThis}={}){
  if(active)return active;if(!root.document)throw new Error('CREATOR_HUB_DOM_REQUIRED');
  const platform=await bootKeloCreators({root}),doc=root.document;
  const style=make('style',{'data-kelo-creators-ui':'',textContent:css()});style.setAttribute('data-kelo-creators-ui','');doc.head.append(style);
  const hub=make('section',{id:'kelo-creators-hub'});hub.setAttribute('data-kelo-creators-ui','');hub.setAttribute('role','dialog');hub.setAttribute('aria-modal','true');hub.setAttribute('aria-label','Kelo Creators');
  const mark=make('div',{class:'kc-mark'},make('span',{text:'KC'})),title=make('div',{class:'kc-title'},[make('strong',{text:'KELO CREATORS'}),make('small',{text:'One studio. Many workspaces.'})]),close=make('button',{class:'kc-close',text:'CLOSE','aria-label':'Cerrar Kelo Creators'}),head=make('header',{class:'kc-head'},[mark,title,close]);
  const nav=make('nav',{class:'kc-nav','aria-label':'Creator sections'}),main=make('main',{class:'kc-main'}),layout=make('div',{class:'kc-layout'},[nav,main]);hub.append(head,layout);doc.body.append(hub);
  const sections=[['create','CREATE'],['projects','MY PROJECTS'],['assets','MY ASSETS'],['shared','SHARED WITH ME'],['invites','TEST INVITES'],['reviews','REVIEWS'],['published','PUBLISHED']];
  const buttons=new Map();let current='create',openingWorkspace=null;
  async function openWorkspace(id){
    if(openingWorkspace)return;openingWorkspace=id;
    try{await platform.openWorkspace(id);destroy();}
    catch(error){console.error(`[Kelo Creators → ${id}]`,error);if(typeof root.showToast==='function')root.showToast(error?.message||`No se pudo abrir ${id}`);}
    finally{openingWorkspace=null;}
  }
  async function renderCreate(){main.replaceChildren(make('h1',{text:'Create'}),make('p',{class:'kc-lead',text:'Choose a workspace. Active creators open lazily and reuse existing owners.'}));for(const group of CATALOG){const sec=make('section',{class:'kc-section'},[make('h2',{text:group.category})]),grid=make('div',{class:'kc-grid'});for(const [wid,label,state,detail] of group.items){const card=make('button',{class:`kc-card ${state==='active'?'active':''}`,disabled:state!=='active','aria-label':state==='active'?`Abrir ${label}`:`${label} coming soon`},[make('span',{class:'kc-pill',text:state==='active'?'ACTIVE':'COMING SOON'}),make('strong',{text:label}),make('small',{text:state==='active'?(detail||'Creator workspace activo'):'Workspace not implemented yet'})]);if(state==='active')card.onclick=()=>void openWorkspace(wid);grid.append(card);}sec.append(grid);main.append(sec);}}
  async function renderProjects(){main.replaceChildren(make('h1',{text:'My Projects'}),make('p',{class:'kc-lead',text:'Projects available through the repository boundary.'}));const rows=await platform.projects.list({ownerId:platform.permission.actorId()});if(!rows.length)return main.append(make('div',{class:'kc-empty',text:'No projects yet.'}));for(const p of rows){const row=make('div',{class:'kc-project'},[make('div',{},[make('strong',{text:p.name}),make('div',{class:'kc-lead',text:`${p.type} · ${p.status}`})])]);if(p.type==='WORLD'){const b=make('button',{text:'OPEN'});b.onclick=()=>void openWorkspace('world');row.append(b);}main.append(row);}}
  function renderEmpty(label,detail){main.replaceChildren(make('h1',{text:label}),make('p',{class:'kc-lead',text:detail}),make('div',{class:'kc-empty',text:'Nothing here yet. This surface is ready for its future repository/service adapter.'}));}
  async function render(id){current=id;for(const [key,b] of buttons)b.setAttribute('aria-selected',String(key===id));if(id==='create')return renderCreate();if(id==='projects')return renderProjects();if(id==='assets')return renderEmpty('My Assets','Reusable assets will appear here without replacing runtime registries.');if(id==='shared')return renderEmpty('Shared With Me','Shared projects will plug into the project repository later.');if(id==='invites')return renderEmpty('Test Invites','Private test invitations will arrive through a future invite service.');if(id==='reviews')return renderEmpty('Reviews','Approval remains capability-gated and authority-owned.');if(id==='published')return renderEmpty('Published','Only immutable approved revisions will appear here.');}
  for(const [id,label] of sections){const b=make('button',{text:label,'aria-selected':'false'});if(id==='reviews'&&!platform.permission.can('review.approve'))b.hidden=true;b.onclick=()=>void render(id);buttons.set(id,b);nav.append(b);}
  function destroy(){if(active?.hub!==hub)return;active=null;hub.remove();style.remove();doc.removeEventListener('keydown',onKey,true);}
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();destroy();}};close.onclick=destroy;doc.addEventListener('keydown',onKey,true);
  active=Object.freeze({version:'kelo-creator-hub-v1.1.0-map-forge',hub,platform,get section(){return current;},show:render,close:destroy});await render('create');return active;
}
export function closeCreatorHub(){active?.close?.();}
export function getCreatorHub(){return active;}
