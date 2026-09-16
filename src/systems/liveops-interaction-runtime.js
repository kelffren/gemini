/* KELO-INDEX
 * area: LIVEOPS / INTERACTION RUNTIME
 * owner: KeloLiveOpsInteraction
 * keys: NPC DIALOGUE MISSION PINNED PROGRESS INPUT LOCK MOBILE HOT CONTENT
 * purpose: mobile dialogue surface + version-pinned in-memory mission progress over KeloLiveOpsWorldContent
 * public-api: KeloLiveOpsInteraction.openNpc/closeNpc/acceptMission/completeObjective/abandonMission/getMission/listMissions/getState
 * state-owned: current dialogue presentation + in-memory mission progress only
 * consumes: KeloLiveOpsWorldContent, KeloInputLocks, KeloEvents
 * performance: event-driven only; NO timer, interval, RAF, game loop, polling or persistence writes
 * do-not: NO rewards/economy/XP, NO NPC spawning, NO localStorage/sessionStorage, NO world position authority, NO executable content
 */
(function(root){
'use strict';
if(root.KeloLiveOpsInteraction)return;
const VERSION='kelo-liveops-interaction-v1';
const LOCK_OWNER='liveops-dialogue';
const missions=new Map();
let currentNpcId=null,lockToken=null,opens=0,accepts=0,objectiveChanges=0,completions=0,abandons=0,hotRefreshes=0,lastError=null;
let ui=null;
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function deepFreeze(value){if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.keys(value).forEach(k=>deepFreeze(value[k]));return Object.freeze(value);}
function snapshot(value){return value==null?null:deepFreeze(clone(value));}
function content(){return root.KeloLiveOpsWorldContent||null;}
function emit(name,payload){try{root.KeloEvents?.emit?.(name,Object.freeze(Object.assign({runtimeVersion:VERSION,at:Date.now()},payload||{})));}catch(_){} }
function missionView(record){if(!record)return null;return snapshot({id:record.id,definitionRevision:record.definitionRevision,acceptedAt:record.acceptedAt,status:record.status,definition:record.definition,objectives:record.objectives});}
function getMission(id){return missionView(missions.get(String(id||'')));}
function listMissions(){return Object.freeze(Array.from(missions.values()).map(missionView));}
function lockInput(){if(lockToken||!root.KeloInputLocks?.acquire)return;lockToken=root.KeloInputLocks.acquire(LOCK_OWNER,{surface:'npc-dialogue',source:VERSION});}
function unlockInput(){if(!lockToken)return;try{root.KeloInputLocks?.release?.(lockToken);}catch(_){}lockToken=null;}
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=String(text);return node;}
function ensureUi(){
  if(ui&&ui.overlay?.isConnected)return ui;
  const style=el('style');style.dataset.keloLiveopsInteraction='1';style.textContent='\n#kelo-liveops-dialogue{position:fixed;inset:0;z-index:2147482500;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.28);padding:0 max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;touch-action:manipulation}#kelo-liveops-dialogue[hidden]{display:none!important}.kelo-liveops-sheet{width:min(100%,620px);max-height:min(76dvh,680px);overflow:auto;-webkit-overflow-scrolling:touch;background:linear-gradient(180deg,rgba(18,22,29,.98),rgba(7,10,14,.99));color:#f6f2e8;border:1px solid rgba(231,194,100,.35);border-radius:22px 22px 16px 16px;box-shadow:0 -18px 50px rgba(0,0,0,.55);padding:16px}.kelo-liveops-head{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start}.kelo-liveops-name{font-size:20px;font-weight:800;line-height:1.1}.kelo-liveops-role{margin-top:4px;color:#d4b861;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.kelo-liveops-close{width:40px;height:40px;border:0;border-radius:13px;background:rgba(255,255,255,.08);color:#fff;font-size:24px}.kelo-liveops-summary{margin:12px 0;color:#c8cbd1;font-size:13px;line-height:1.45}.kelo-liveops-dialogue-lines{display:grid;gap:8px}.kelo-liveops-line{padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.055);font-size:14px;line-height:1.45}.kelo-liveops-missions{display:grid;gap:9px;margin-top:14px}.kelo-liveops-section{font-size:11px;color:#d4b861;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.kelo-liveops-mission{display:grid;gap:6px;padding:12px;border-radius:15px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035)}.kelo-liveops-mission-title{font-size:14px;font-weight:800}.kelo-liveops-mission-summary{color:#bfc3cb;font-size:12px;line-height:1.4}.kelo-liveops-action{min-height:44px;border:0;border-radius:13px;padding:10px 14px;background:#d5b55d;color:#15120b;font-weight:850;font-size:14px}.kelo-liveops-action[disabled]{background:rgba(255,255,255,.08);color:#9da1aa}.kelo-liveops-objectives{display:grid;gap:6px;margin-top:4px}.kelo-liveops-objective{font-size:12px;color:#d5d7dc}.kelo-liveops-objective[data-done="1"]{text-decoration:line-through;color:#8f949d}@media(min-width:700px){#kelo-liveops-dialogue{align-items:center}.kelo-liveops-sheet{border-radius:22px}}\n';document.head.appendChild(style);
  const overlay=el('div');overlay.id='kelo-liveops-dialogue';overlay.hidden=true;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Diálogo');
  const sheet=el('section','kelo-liveops-sheet');const head=el('div','kelo-liveops-head');const identity=el('div');const name=el('div','kelo-liveops-name');const role=el('div','kelo-liveops-role');identity.append(name,role);const close=el('button','kelo-liveops-close','×');close.type='button';close.setAttribute('aria-label','Cerrar diálogo');head.append(identity,close);const summary=el('div','kelo-liveops-summary');const lines=el('div','kelo-liveops-dialogue-lines');const missionSection=el('div','kelo-liveops-missions');sheet.append(head,summary,lines,missionSection);overlay.appendChild(sheet);document.body.appendChild(overlay);
  close.addEventListener('click',closeNpc,{passive:true});overlay.addEventListener('click',event=>{if(event.target===overlay)closeNpc();},{passive:true});
  ui={overlay,sheet,name,role,summary,lines,missionSection};return ui;
}
function missionsForNpc(npcId){const api=content();if(!api?.listMissions)return [];return api.listMissions().filter(row=>row.giverNpcId===npcId);}
function renderMissionCard(def){
  const record=missions.get(def.id),card=el('article','kelo-liveops-mission'),title=el('div','kelo-liveops-mission-title',def.title),summaryNode=el('div','kelo-liveops-mission-summary',def.summary||'');card.append(title);if(def.summary)card.append(summaryNode);
  const objectives=el('div','kelo-liveops-objectives');const source=record?record.objectives:def.objectives.map(o=>({id:o.id,label:o.label,done:false}));source.forEach(o=>{const row=el('div','kelo-liveops-objective',(o.done?'✓ ':'• ')+o.label);row.dataset.done=o.done?'1':'0';objectives.appendChild(row);});card.appendChild(objectives);
  const button=el('button','kelo-liveops-action');button.type='button';if(!record){button.textContent='Aceptar misión';button.addEventListener('click',()=>{acceptMission(def.id);renderCurrent();});}else{button.disabled=true;button.textContent=record.status==='complete'?'Completada':'En curso · rev '+record.definitionRevision;}card.appendChild(button);return card;
}
function renderCurrent(){
  if(!currentNpcId||!ui)return false;const api=content(),npc=api?.getNpc?.(currentNpcId);if(!npc||npc.enabled===false){closeNpc();return false;}
  ui.name.textContent=npc.name;ui.role.textContent=npc.role;ui.summary.textContent=npc.summary||'';ui.summary.hidden=!npc.summary;ui.lines.replaceChildren();(npc.dialogue||[]).forEach(line=>ui.lines.appendChild(el('div','kelo-liveops-line',line.text)));ui.missionSection.replaceChildren();const offers=missionsForNpc(npc.id);if(offers.length){ui.missionSection.appendChild(el('div','kelo-liveops-section','Misiones'));offers.forEach(def=>ui.missionSection.appendChild(renderMissionCard(def)));}return true;
}
function openNpc(npcId){
  try{const api=content(),npc=api?.getNpc?.(String(npcId||''));if(!npc||npc.enabled===false)return false;ensureUi();currentNpcId=npc.id;lockInput();ui.overlay.hidden=false;renderCurrent();opens++;lastError=null;emit('liveops:npc-opened',{npcId:npc.id,revision:npc.revision});return true;}catch(error){lastError=String(error&&error.message||error);emit('liveops:error',{operation:'openNpc',error:lastError});return false;}
}
function closeNpc(){const id=currentNpcId;if(ui)ui.overlay.hidden=true;currentNpcId=null;unlockInput();if(id)emit('liveops:npc-closed',{npcId:id});return !!id;}
function acceptMission(missionId){
  const key=String(missionId||'');if(!key)return null;if(missions.has(key))return getMission(key);const def=content()?.pinMission?.(key);if(!def)return null;const record={id:def.id,definitionRevision:String(def.revision),acceptedAt:Date.now(),status:'active',definition:def,objectives:def.objectives.map(row=>({id:row.id,label:row.label,done:false}))};missions.set(record.id,record);accepts++;emit('liveops:mission-accepted',{missionId:record.id,revision:record.definitionRevision});return missionView(record);
}
function completeObjective(missionId,objectiveId){
  const record=missions.get(String(missionId||''));if(!record||record.status!=='active')return false;const objective=record.objectives.find(row=>row.id===String(objectiveId||''));if(!objective||objective.done)return false;objective.done=true;objectiveChanges++;emit('liveops:mission-objective-completed',{missionId:record.id,objectiveId:objective.id,revision:record.definitionRevision});if(record.objectives.every(row=>row.done)){record.status='complete';completions++;emit('liveops:mission-completed',{missionId:record.id,revision:record.definitionRevision});}if(currentNpcId)renderCurrent();return true;
}
function abandonMission(missionId){const key=String(missionId||''),record=missions.get(key);if(!record)return false;missions.delete(key);abandons++;emit('liveops:mission-abandoned',{missionId:key,revision:record.definitionRevision});if(currentNpcId)renderCurrent();return true;}
function getState(){return Object.freeze({version:VERSION,currentNpcId,dialogueOpen:!!currentNpcId,inputLockHeld:!!lockToken,missionCount:missions.size,activeMissions:Array.from(missions.values()).filter(x=>x.status==='active').length,completedMissions:Array.from(missions.values()).filter(x=>x.status==='complete').length,opens,accepts,objectiveChanges,completions,abandons,hotRefreshes,lastError,persistenceWrites:0,rewardMutations:0,economyMutations:0,xpMutations:0,spawnMutations:0,timers:0,intervals:0,raf:0,gameLoop:false});}
function onHotContentChanged(){hotRefreshes++;if(currentNpcId)renderCurrent();emit('liveops:content-refreshed',{catalogRevision:content()?.getState?.().revision||null});}
root.addEventListener('kelo:liveops-world-content:changed',onHotContentChanged,{passive:true});
root.KeloEvents?.on?.('liveops:open-npc',payload=>openNpc(payload&&payload.npcId));
root.KeloEvents?.on?.('liveops:close-npc',()=>closeNpc());
root.KeloLiveOpsInteraction=Object.freeze({version:VERSION,openNpc,closeNpc,acceptMission,completeObjective,abandonMission,getMission,listMissions,getState});
root.KELO_LIVEOPS_INTERACTION_AUDIT=Object.freeze({version:VERSION,eventDriven:true,hotDialogue:true,pinnedMissionDefinitions:true,inMemoryProgress:true,persistenceWrites:0,rewardMutations:0,economyMutations:0,xpMutations:0,spawnMutations:0,positionAuthority:false,executableContent:false,timers:0,intervals:0,raf:0,gameLoop:false});
})(typeof globalThis!=='undefined'?globalThis:window);
