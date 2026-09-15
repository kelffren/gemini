/* KELO-INDEX
 * area: CREATORS / LIBRARY UI
 * owner: Kelo Creator Library
 * keys: CREATOR LIBRARY CHARACTER SKIN WEAPON ARMOR PROP TOOLS IMAGE LAB ROUTING MOBILE LAZY
 * purpose: present one mobile-first creation library and route each content type to the existing specialized Creator owner
 * public-api: openCreatorLibraryWorkspace, getCreatorLibraryWorkspace, closeCreatorLibraryWorkspace
 * consumes: Creator workspace registry/openWorkspace, creator-content-types, project repository, KeloInputLocks
 * state-owned: ephemeral library UI state only; projects/assets remain owned by their existing systems
 * extension-points: creator-content-types.mjs + workspace manifests
 * reuse: direct Luxe Creator entry, future marketplace/discover entry points
 * online: library is an authoring router; review/publish/economy stay behind their online authority contracts
 * do-not: no second runtime catalog, no gameplay writes, no duplicated image/pixel/character/weapon editors, no eager boot
 */
import {CREATOR_CONTENT_TYPES,creatorTypeForProjectType,listCreatorContentTypes} from '../library/creator-content-types.mjs';

let active=null;
const GROUP_ORDER=['CHARACTERS','ITEMS','WORLD','VISUAL','GAMEPLAY','MEDIA','PACKS'];
const TOOL_ROWS=Object.freeze([
  Object.freeze({id:'image-lab',icon:'◩',label:'Image Lab',detail:'Preparar original · trim alpha · resize · rotate · flip · revisiones'}),
  Object.freeze({id:'asset-forge',icon:'✎',label:'Pixel Forge',detail:'Dibujar píxel · importar · QA · auto-repair · exportar'}),
  Object.freeze({id:'asset-sheet',icon:'▦',label:'Asset Sheet Studio',detail:'Detectar sprites · clasificar · atlas · abrir en World'}),
  Object.freeze({id:'content-studio',icon:'⇪',label:'Content Studio',detail:'Lotes/metadata · pipeline online existente'})
]);

function el(doc,tag,props={},children=[]){
  const node=doc.createElement(tag);
  for(const [key,value] of Object.entries(props)){
    if(key==='class')node.className=value;
    else if(key==='text')node.textContent=value;
    else if(key==='style')Object.assign(node.style,value);
    else if(key.startsWith('aria-'))node.setAttribute(key,String(value));
    else node[key]=value;
  }
  for(const child of [].concat(children||[]))if(child)node.append(child);
  return node;
}
function css(){return `
#kelo-creator-library{position:fixed;inset:0;z-index:2147482260;background:radial-gradient(circle at 50% -15%,rgba(202,169,91,.18),transparent 32%),#080a0d;color:#f6f2e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden}
#kelo-creator-library *{box-sizing:border-box}.kcl-head{display:flex;align-items:center;gap:11px;padding:calc(11px + env(safe-area-inset-top)) 14px 11px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(10,12,16,.96)}.kcl-mark{width:38px;height:38px;border:1px solid rgba(220,187,107,.62);border-radius:11px;display:grid;place-items:center;color:#f0d28a;font-weight:950}.kcl-title{min-width:0}.kcl-title strong{display:block;font-size:15px;letter-spacing:.09em}.kcl-title small{display:block;color:#89918f;font-size:9px;margin-top:2px}.kcl-close{margin-left:auto;border:1px solid rgba(255,255,255,.13);background:#15191e;color:#fff;border-radius:10px;padding:9px 11px;font-weight:850}.kcl-tabs{display:flex;gap:6px;overflow-x:auto;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.07);background:#0d1014}.kcl-tab{white-space:nowrap;border:1px solid rgba(255,255,255,.08);background:#14181d;color:#909a98;border-radius:10px;padding:8px 11px;font-size:9px;font-weight:900;letter-spacing:.08em}.kcl-tab[aria-selected="true"]{color:#fff0c1;border-color:rgba(216,181,96,.48);background:#292318}.kcl-main{min-height:0;overflow:auto;padding:12px clamp(10px,3vw,30px) calc(34px + env(safe-area-inset-bottom))}.kcl-shell{max-width:1080px;margin:0 auto}.kcl-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end;margin:4px 0 14px}.kcl-hero h1{font-size:clamp(24px,5vw,42px);margin:0}.kcl-hero p{margin:5px 0 0;color:#99a29f;font-size:11px;line-height:1.5;max-width:680px}.kcl-search{width:min(360px,100%);min-height:42px;border:1px solid rgba(255,255,255,.11);border-radius:12px;background:#11161b;color:#fff;padding:0 12px;font-weight:750}.kcl-section{margin:20px 0}.kcl-section h2{margin:0 0 9px;color:#d3b66f;font-size:10px;letter-spacing:.16em}.kcl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px}.kcl-card{min-height:132px;border:1px solid rgba(255,255,255,.085);border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018));padding:13px;color:#fff;text-align:left;display:flex;flex-direction:column;gap:8px;cursor:pointer}.kcl-card:active{transform:scale(.988)}.kcl-card:disabled{opacity:.42;cursor:not-allowed}.kcl-card-icon{font-size:22px;color:#e7c979}.kcl-card strong{font-size:14px}.kcl-card small{color:#8e9996;font-size:9px;line-height:1.4}.kcl-card footer{margin-top:auto;display:flex;gap:6px;flex-wrap:wrap}.kcl-chip{border:1px solid rgba(212,181,105,.2);border-radius:999px;padding:4px 6px;color:#cdb777;font-size:7px;letter-spacing:.06em}.kcl-empty{border:1px dashed rgba(255,255,255,.12);border-radius:15px;padding:26px;color:#85908d;text-align:center;font-size:10px}.kcl-project{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:11px;margin:7px 0;background:#0f1418}.kcl-project strong{display:block;font-size:12px}.kcl-project small{display:block;color:#7f8b88;font-size:8px;margin-top:3px}.kcl-btn{border:1px solid rgba(215,182,99,.35);border-radius:9px;background:#1a1b16;color:#f4dda1;padding:8px 10px;font-weight:850;font-size:9px}.kcl-pipeline{display:grid;grid-template-columns:repeat(5,minmax(130px,1fr));gap:8px}.kcl-step{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:13px;background:#0f1418}.kcl-step b{display:block;color:#e2c675;font-size:10px}.kcl-step span{display:block;color:#84908c;font-size:9px;line-height:1.45;margin-top:5px}.kcl-note{margin-top:12px;border:1px solid rgba(212,181,105,.2);border-radius:13px;padding:12px;color:#a9b2ae;font-size:9px;line-height:1.55;background:rgba(198,163,78,.04)}
@media(max-width:760px){.kcl-main{padding-left:8px;padding-right:8px}.kcl-title small{display:none}.kcl-hero{grid-template-columns:1fr}.kcl-search{width:100%}.kcl-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.kcl-card{min-height:124px;padding:11px}.kcl-pipeline{display:flex;overflow-x:auto}.kcl-step{min-width:160px}.kcl-btn{min-height:40px}}
@media(max-width:390px){.kcl-grid{grid-template-columns:1fr}}
`;}

export async function openCreatorLibraryWorkspace({root=globalThis,projects=null,permission=null,workspaces=null,openWorkspace=null}={}){
  if(active)return active;
  if(!root.document?.body)throw new Error('CREATOR_LIBRARY_DOM_REQUIRED');
  if(typeof openWorkspace!=='function')throw new Error('CREATOR_LIBRARY_OPEN_WORKSPACE_REQUIRED');
  const doc=root.document,style=el(doc,'style',{textContent:css()}),lock=root.KeloInputLocks?.acquire?.('creator-library',{surface:'creator'})||null;
  style.dataset.keloCreatorLibrary='1';doc.head.append(style);
  const shell=el(doc,'section',{id:'kelo-creator-library'});shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Kelo Creator Library');
  const close=el(doc,'button',{class:'kcl-close',text:'CLOSE'}),head=el(doc,'header',{class:'kcl-head'},[
    el(doc,'div',{class:'kcl-mark',text:'CL'}),el(doc,'div',{class:'kcl-title'},[el(doc,'strong',{text:'KELO CREATOR LIBRARY'}),el(doc,'small',{text:'Characters · skins · weapons · world · VFX · everything'})]),close
  ]),tabs=el(doc,'nav',{class:'kcl-tabs'}),main=el(doc,'main',{class:'kcl-main'});shell.append(head,tabs,main);doc.body.append(shell);
  const tabRows=[['create','CREATE'],['library','MY LIBRARY'],['tools','TOOLS'],['pipeline','PIPELINE']],buttons=new Map();let current='create',busy=false;
  for(const [id,label] of tabRows){const b=el(doc,'button',{class:'kcl-tab',text:label,'aria-selected':'false'});b.onclick=()=>void render(id);buttons.set(id,b);tabs.append(b);}
  function actor(){return String(permission?.actorId?.()||root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||'local_pioneer');}
  function toast(message){if(typeof root.showToast==='function')root.showToast(message);else console.info('[Creator Library]',message);}
  function workspaceAllowed(id){const row=workspaces?.resolve?.(id);if(!workspaces)return true;if(!row||row.availability!=='active')return false;if(!row.capability)return true;return !!permission?.can?.(row.capability,actor());}
  function projectWorkspace(type){const routed=creatorTypeForProjectType(type);return routed?.workspaceId||String(type||'').toLowerCase().replaceAll('_','-');}
  async function launch(workspaceId,context={}){
    if(busy)return null;busy=true;shell.setAttribute('aria-busy','true');shell.style.pointerEvents='none';
    try{if(!workspaceAllowed(workspaceId))throw new Error(`CREATOR_WORKSPACE_NOT_AVAILABLE:${workspaceId}`);const result=await openWorkspace(workspaceId,context);destroy();return result;}
    catch(error){shell.style.pointerEvents='';shell.removeAttribute('aria-busy');toast(`No se pudo abrir ${workspaceId}`);console.error('[Creator Library launch]',error);return null;}
    finally{busy=false;}
  }
  function hero(title,copy){return el(doc,'div',{class:'kcl-hero'},el(doc,'div',{},[el(doc,'h1',{text:title}),el(doc,'p',{text:copy})]));}
  function typeCard(row){
    const enabled=workspaceAllowed(row.workspaceId),card=el(doc,'button',{class:'kcl-card',disabled:!enabled,'aria-label':enabled?`Crear ${row.label}`:`${row.label} no disponible`});
    card.append(el(doc,'span',{class:'kcl-card-icon',text:row.icon}),el(doc,'strong',{text:row.label}),el(doc,'small',{text:row.description}));
    const foot=el(doc,'footer');foot.append(el(doc,'span',{class:'kcl-chip',text:row.kind.toUpperCase()}),el(doc,'span',{class:'kcl-chip',text:row.workspaceId.toUpperCase()}));for(const tool of row.tools.slice(0,2))foot.append(el(doc,'span',{class:'kcl-chip',text:tool.toUpperCase()}));card.append(foot);
    if(enabled)card.onclick=()=>void launch(row.workspaceId,{creatorIntent:{typeId:row.id,label:row.label,kind:row.kind,defaults:row.defaults}});return card;
  }
  function renderCreate(){
    const wrap=el(doc,'div',{class:'kcl-shell'}),groups=el(doc,'div'),search=el(doc,'input',{class:'kcl-search',type:'search',placeholder:'Buscar character, weapon, tree, VFX…','aria-label':'Buscar tipos de contenido'}),top=hero('Create anything','Una sola biblioteca; cada tipo abre el editor especializado que ya posee esa responsabilidad.');top.append(search);wrap.append(top,groups);
    function paintGroups(query=''){groups.replaceChildren();const rows=listCreatorContentTypes({query});if(!rows.length){groups.append(el(doc,'div',{class:'kcl-empty',text:'No encontré ese tipo. Añadir un tipo nuevo significa enrutarlo a un owner existente, no crear un engine paralelo.'}));return;}for(const group of GROUP_ORDER){const groupRows=rows.filter(row=>row.group===group);if(!groupRows.length)continue;const section=el(doc,'section',{class:'kcl-section'},[el(doc,'h2',{text:group})]),grid=el(doc,'div',{class:'kcl-grid'});for(const row of groupRows)grid.append(typeCard(row));section.append(grid);groups.append(section);}}
    search.oninput=()=>paintGroups(search.value);paintGroups();main.replaceChildren(wrap);
  }
  async function renderLibrary(){
    const wrap=el(doc,'div',{class:'kcl-shell'});wrap.append(hero('My Library','Proyectos de Creator guardados por los repositorios existentes. La Library no duplica su persistencia.'));
    if(!projects?.list){wrap.append(el(doc,'div',{class:'kcl-empty',text:'Project repository unavailable in this session.'}));main.replaceChildren(wrap);return;}
    const rows=(await projects.list({ownerId:actor()})).slice(0,120);if(!rows.length){wrap.append(el(doc,'div',{class:'kcl-empty',text:'Todavía no hay proyectos. Empieza en CREATE.'}));main.replaceChildren(wrap);return;}
    for(const project of rows){const workspaceId=projectWorkspace(project.type),open=el(doc,'button',{class:'kcl-btn',text:'OPEN'});open.disabled=!workspaceAllowed(workspaceId);open.onclick=()=>void launch(workspaceId,{projectId:project.projectId});wrap.append(el(doc,'article',{class:'kcl-project'},[el(doc,'div',{},[el(doc,'strong',{text:project.name||project.projectId}),el(doc,'small',{text:`${project.type} · ${project.status||'draft'} · ${String(project.projectId).slice(-10)}`})]),open]));}main.replaceChildren(wrap);
  }
  function renderTools(){
    const wrap=el(doc,'div',{class:'kcl-shell'});wrap.append(hero('Creator Tools','El “Photoshop” de Kelo es modular: prepara la imagen en Image Lab, dibuja pixel art en Pixel Forge y usa los editores especializados para el contenido final.'));
    const grid=el(doc,'div',{class:'kcl-grid'});for(const row of TOOL_ROWS){const enabled=workspaceAllowed(row.id),card=el(doc,'button',{class:'kcl-card',disabled:!enabled});card.append(el(doc,'span',{class:'kcl-card-icon',text:row.icon}),el(doc,'strong',{text:row.label}),el(doc,'small',{text:row.detail}),el(doc,'footer',{},el(doc,'span',{class:'kcl-chip',text:'LAZY TOOL'})));if(enabled)card.onclick=()=>void launch(row.id);grid.append(card);}wrap.append(grid);main.replaceChildren(wrap);
  }
  function renderPipeline(){
    const wrap=el(doc,'div',{class:'kcl-shell'});wrap.append(hero('Creator pipeline','La misma ruta sirve para un personaje, una skin, un arma o un árbol; cambia el editor especializado, no la arquitectura.'));
    const steps=[['1 · IDEA','Elige el tipo de contenido y conserva la intención del creador.'],['2 · PREP','Image Lab / Pixel Forge preparan fuentes y arte sin mutar el runtime.'],['3 · BUILD','El workspace especializado crea definition/asset/animation usando su owner.'],['4 · TEST','Preview o test draft valida antes de tocar contenido compartido.'],['5 · REVIEW / PUBLISH','La autoridad online futura aprueba, versiona y publica; el cliente no decide economía real.']],row=el(doc,'div',{class:'kcl-pipeline'});for(const [title,copy] of steps)row.append(el(doc,'div',{class:'kcl-step'},[el(doc,'b',{text:title}),el(doc,'span',{text:copy})]));wrap.append(row,el(doc,'div',{class:'kcl-note',text:`Registrados ${CREATOR_CONTENT_TYPES.length} tipos de entrada. Regla: CONTENT EXISTS ≠ CONTENT IS ACTIVE. Catálogos grandes deben permanecer metadata/preview-first y cargar contenido completo solo bajo demanda.`}));main.replaceChildren(wrap);
  }
  async function render(id){current=id;for(const [key,b] of buttons)b.setAttribute('aria-selected',String(key===id));if(id==='create')renderCreate();else if(id==='library')await renderLibrary();else if(id==='tools')renderTools();else renderPipeline();}
  function keys(event){if(event.key==='Escape'){event.preventDefault();destroy();}}
  function destroy(){if(active?.shell!==shell)return;active=null;doc.removeEventListener('keydown',keys,true);try{if(lock)root.KeloInputLocks?.release?.(lock);}catch{}shell.remove();style.remove();}
  close.onclick=destroy;doc.addEventListener('keydown',keys,true);
  active=Object.freeze({version:'kelo-creator-library-v1.1',shell,openType:typeId=>{const row=CREATOR_CONTENT_TYPES.find(x=>x.id===typeId);return row?launch(row.workspaceId,{creatorIntent:{typeId:row.id,defaults:row.defaults}}):null;},show:render,close:destroy,get tab(){return current;}});
  await render('create');return active;
}
export function getCreatorLibraryWorkspace(){return active;}
export function closeCreatorLibraryWorkspace(){active?.close?.();}
