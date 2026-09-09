/* KELO-INDEX
 * area: CREATORS / ABILITY PREVIEW
 * owner: Ability Creator preview bridge
 * owns: presentation-only telegraph preview + linked VFX preview orchestration
 * does-not-own: gameplay simulation, damage, cooldown/resource mutation, movement authority, FX rendering, persistence or networking
 * reuse: KeloAbilities supported-delivery contract + KeloFX transient preview + CreatorProjectRepository
 */
import { abilityDefinitionFromDocument,validateAbilityDocument } from './ability-document.mjs';
const px=value=>`${Math.max(1,Number(value)||1)}px`;
export function createAbilityPreviewAdapter({root=globalThis,projects,host}={}){
  if(!projects?.loadDraft)throw new Error('ABILITY_PREVIEW_PROJECT_REPOSITORY_REQUIRED');
  let node=null,fxIds=[],timers=[];
  const supported=()=>root.KeloAbilities?.engine?.getSupportedDeliveryTypes?.()||[];
  function clearTimers(){for(const timer of timers)try{root.clearTimeout?.(timer);}catch{}timers=[];}
  function stop(){clearTimers();for(const id of fxIds.splice(0))try{root.KeloFX?.stop?.(id);}catch{}if(node){node.remove();node=null;}return true;}
  function centerContext(def){const actorId=String(root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||root.localPlayer?.id||''),actor=root.KeloVisualContext?.resolveActor?.(actorId)||root.localPlayer||null,center=root.KeloCamera?.screenToWorld?.((root.innerWidth||390)/2,(root.innerHeight||844)/2)||{x:Number(actor?.x)||0,y:Number(actor?.y)||0};return{actor,actorId,origin:{x:Number(actor?.x??center.x)||0,y:Number(actor?.y??center.y)||0},target:{x:center.x+Math.max(80,Number(def.targeting?.range)||120)*.45,y:center.y},visual:{scale:1,seed:31}};}
  async function loadVfx(projectId){if(!projectId)return null;const draft=await projects.loadDraft(projectId);return draft?.documentType==='VFX'&&draft.definition?draft.definition:null;}
  function playFx(definition,context){if(!definition||typeof root.KeloFX?.preview!=='function')return null;const id=root.KeloFX.preview(definition,context,{scale:1,space:definition.space||'WORLD',seed:31});if(id)fxIds.push(id);return id;}
  function telegraph(def){
    if(!host?.ownerDocument)return null;const doc=host.ownerDocument,wrap=doc.createElement('div');wrap.className='kelo-ability-preview';Object.assign(wrap.style,{position:'absolute',inset:'0',pointerEvents:'none',overflow:'hidden',display:'grid',placeItems:'center'});
    const actor=doc.createElement('div');Object.assign(actor.style,{width:'32px',height:'32px',borderRadius:'50%',background:'rgba(231,197,106,.2)',border:'2px solid rgba(231,197,106,.9)',boxShadow:'0 0 24px rgba(231,197,106,.35)'});wrap.append(actor);
    const shape=doc.createElement('div'),color=def.visuals?.color||'#7fd7ff',t=def.telegraph||{},target=def.targeting||{},kind=t.shape||'none';shape.dataset.shape=kind;Object.assign(shape.style,{position:'absolute',left:'50%',top:'50%',border:`2px solid ${color}`,background:`color-mix(in srgb, ${color} 14%, transparent)`,boxShadow:`0 0 20px color-mix(in srgb, ${color} 28%, transparent)`});
    if(kind==='circle'){const size=Math.min(240,Math.max(36,(Number(t.radius)||80)*.8));Object.assign(shape.style,{width:px(size),height:px(size),borderRadius:'50%',transform:'translate(-50%,-50%)'});}else if(kind==='wall'){const width=Math.min(280,Math.max(50,(Number(t.width)||150)));Object.assign(shape.style,{width:px(width),height:'18px',transform:'translate(-50%,-50%)'});}else if(kind==='line'||kind==='dash'||kind==='blink'){const length=Math.min(300,Math.max(70,(Number(t.range)||Number(target.range)||180)*.55)),width=Math.max(8,Math.min(42,Number(t.width)||18));Object.assign(shape.style,{width:px(length),height:px(width),transformOrigin:'0 50%',transform:'translate(0,-50%)',borderRadius:kind==='line'?'999px':'8px'});}else shape.style.display='none';wrap.append(shape);
    const label=doc.createElement('div');label.textContent=`${def.name} · ${def.delivery?.type||'instant'} · ${def.cooldown}s CD`;Object.assign(label.style,{position:'absolute',left:'50%',top:'calc(50% + 70px)',transform:'translateX(-50%)',padding:'6px 9px',borderRadius:'999px',background:'rgba(8,13,15,.88)',border:'1px solid rgba(255,255,255,.12)',font:'800 9px system-ui',color:'#eef2ed',whiteSpace:'nowrap'});wrap.append(label);host.append(wrap);return wrap;
  }
  async function play(document){stop();const support=supported(),report=validateAbilityDocument(document,{supportedDeliveryTypes:support});if(!report.ok)throw new Error(`ABILITY_PREVIEW_INVALID:${report.errors.join(',')}`);const def=abilityDefinitionFromDocument(document),links=document.links||{},context=centerContext(def);node=telegraph(def);const cast=await loadVfx(links.castVfxProjectId),impact=await loadVfx(links.impactVfxProjectId);playFx(cast,context);if(impact){const delay=Math.max(0,(Number(def.action?.windup)||0)+(Number(def.action?.active)||0))*1000;timers.push(root.setTimeout(()=>playFx(impact,{...context,origin:context.target,target:context.target}),delay));}return Object.freeze({supportedDeliveryTypes:Object.freeze([...support]),deliveryType:def.delivery.type,animationProjectId:links.animationProjectId||null,castVfxProjectId:links.castVfxProjectId||null,impactVfxProjectId:links.impactVfxProjectId||null});}
  return Object.freeze({version:'ability-preview-adapter-v1.0.0',play,stop,get supportedDeliveryTypes(){return Object.freeze([...supported()]);},get active(){return !!node||fxIds.length>0;}});
}
