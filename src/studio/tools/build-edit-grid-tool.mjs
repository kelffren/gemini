/* KELO-INDEX
 * area: STUDIO / BUILD EDIT GRID
 * owns: 3x3 semantic edit masks for selected Quick Build walls and resolution to real architectural variants
 * does-not-own: world rendering, prefab authoring, selection hit testing, CommandBus internals or room surgery
 * public-api: createBuildEditGridTool(), resolveBuildEditVariants(), classifyBuildEditMask(), BUILD_EDIT_PATTERNS
 * online: apply/reset commit one reversible entity.patch through Kernel CommandBus -> authority
 * mobile: touch-first 3x3 editor; bounded body observer; no permanent render loop
 */

import {createPatchEntityCommand} from '../document/document-commands.mjs';

const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const norm=value=>String(value||'').trim().toLowerCase();
const FULL_MASK='111111111';

export const BUILD_EDIT_PATTERNS=Object.freeze([
  Object.freeze({id:'full',label:'FULL',glyph:'■',mask:FULL_MASK,keywords:[]}),
  Object.freeze({id:'door',label:'DOOR',glyph:'▯',mask:'111101101',keywords:['door','doorway','entry','entrance','puerta']}),
  Object.freeze({id:'window',label:'WINDOW',glyph:'▤',mask:'111101111',keywords:['window','ventana']}),
  Object.freeze({id:'half',label:'HALF',glyph:'▬',mask:'000111111',keywords:['half wall','halfwall','half-wall','low wall','half height','muro medio']}),
  Object.freeze({id:'corner',label:'CORNER',glyph:'◱',mask:'100100111',keywords:['corner wall','wall corner','corner','esquina']})
]);

function scorePrefab(prefab,pattern){
  const id=norm(prefab?.id),label=norm(prefab?.label),category=norm(prefab?.category),text=`${id} ${label} ${category}`;
  let score=0;
  for(const word of pattern.keywords||[]){
    const key=norm(word);if(!key)continue;
    if(id===key)score+=16;if(label===key)score+=14;if(text.includes(key))score+=5;
  }
  if(score>0&&(text.includes('building')||text.includes('structure')||text.includes('wall')))score+=2;
  return score;
}

export function resolveBuildEditVariants({prefabs=[],overrides={}}={}){
  const out=[];
  for(const pattern of BUILD_EDIT_PATTERNS){
    if(pattern.id==='full')continue;
    const forced=overrides?.[pattern.id];
    if(forced){out.push({...pattern,prefabId:String(forced),source:'override'});continue;}
    let best=null,bestScore=0;
    for(const prefab of prefabs||[]){const score=scorePrefab(prefab,pattern);if(score>bestScore){best=prefab;bestScore=score;}}
    if(best)out.push({...pattern,prefabId:String(best.id),source:'catalog'});
  }
  return out;
}

export function classifyBuildEditMask(mask){
  const value=String(mask||'').replace(/[^01]/g,'').slice(0,9).padEnd(9,'1');
  return BUILD_EDIT_PATTERNS.find(pattern=>pattern.mask===value)||null;
}

export function createBuildEditGridTool(kernel,{quickBuild=null,root=globalThis}={}){
  if(!kernel)throw new Error('STUDIO_BUILD_EDIT_GRID_KERNEL_REQUIRED');
  quickBuild=quickBuild||kernel.tools?.get?.('quickBuild');
  if(!quickBuild?.pieces)throw new Error('STUDIO_BUILD_EDIT_GRID_QUICK_BUILD_REQUIRED');

  const document=root?.document;
  const editOverrides=root?.KELO_QUICK_BUILD_EDIT_CATALOG||{};
  const variants=resolveBuildEditVariants({prefabs:kernel.prefabs.list?.()||[],overrides:editOverrides});
  let active=false,selectedId=null,mask=FULL_MASK,busy=false,destroyed=false,panel=null,style=null,observer=null,selectionOff=null,commandsOff=null;

  const find=id=>kernel.document.entities.find(row=>String(row.id)===String(id))||kernel.spatial.get?.(id)?.data||null;
  const variantFor=id=>variants.find(row=>row.id===String(id))||null;

  function selectedWall(){
    const ids=kernel.selection.get();if(ids.length!==1)return null;
    const row=find(ids[0]),piece=row?.components?.buildingPiece;
    if(!row||piece?.type!=='wall'||piece?.system!=='quick-build')return null;
    if(piece.roomGenerated===true||piece.openingGenerated===true)return null;
    return row;
  }

  function currentPattern(){return classifyBuildEditMask(mask);}
  function currentAvailability(){const pattern=currentPattern();if(!pattern)return{pattern:null,available:false,reason:'custom'};if(pattern.id==='full')return{pattern,available:true,reason:null};const variant=variantFor(pattern.id);return{pattern,variant,available:!!variant,reason:variant?null:'variant-missing'};}
  function basePrefabId(row){const edit=row?.components?.buildingPiece?.editGrid;return String(edit?.basePrefabId||row?.components?.buildingPiece?.prefabId||row?.prefabId||'');}

  function activate(){
    const row=selectedWall();if(!row)return false;
    selectedId=String(row.id);mask=String(row.components?.buildingPiece?.editGrid?.mask||FULL_MASK);active=true;ensureUi();syncUi();return true;
  }
  function deactivate(){active=false;selectedId=null;mask=FULL_MASK;syncUi();return true;}
  function setMask(next){if(!active)return false;const value=String(next||'').replace(/[^01]/g,'').slice(0,9);if(value.length!==9)return false;mask=value;syncUi();return true;}
  function toggleCell(index){if(!active)return false;const i=Math.max(0,Math.min(8,Number(index)||0)),chars=mask.split('');chars[i]=chars[i]==='1'?'0':'1';mask=chars.join('');syncUi();return true;}
  function usePattern(id){const pattern=BUILD_EDIT_PATTERNS.find(row=>row.id===String(id));return pattern?setMask(pattern.mask):false;}

  async function apply(){
    if(!active||busy)return null;
    const row=selectedWall();if(!row||String(row.id)!==selectedId)return null;
    const state=currentAvailability();if(!state.available||!state.pattern)return null;
    const sourcePiece=copy(row.components?.buildingPiece||{}),baseId=basePrefabId(row);if(!baseId)return null;
    busy=true;
    try{
      let prefabId=baseId,nextPiece={...sourcePiece};
      if(state.pattern.id==='full'){
        delete nextPiece.editGrid;delete nextPiece.variant;delete nextPiece.variantPrefabId;
      }else{
        prefabId=String(state.variant.prefabId);
        nextPiece={...nextPiece,version:Math.max(6,Number(nextPiece.version)||0),variant:state.pattern.id,variantPrefabId:prefabId,editGrid:{schema:1,size:3,mask,pattern:state.pattern.id,basePrefabId:baseId}};
      }
      const patch={prefabId,bounds:copy(row.bounds),components:{...(copy(row.components)||{}),buildingPiece:nextPiece}};
      const command=createPatchEntityCommand(row.id,patch);command.label=state.pattern.id==='full'?'Reset wall edit':`Edit wall · ${state.pattern.label}`;
      const result=await kernel.execute(command);kernel.selection.set(row.id);syncUi();return result;
    }finally{busy=false;syncUi();}
  }

  async function reset(){if(!active)return null;usePattern('full');return apply();}

  function getPreview(){
    if(!active)return null;
    const row=find(selectedId);if(!row)return null;
    const state=currentAvailability();
    return{entityId:String(row.id),transform:copy(row.transform||{}),bounds:copy(row.bounds||{}),mask,pattern:state.pattern?.id||'custom',label:state.pattern?.label||'CUSTOM',available:state.available,reason:state.reason,variantPrefabId:state.variant?.prefabId||null};
  }

  function ensureUi(){
    if(destroyed||!document)return null;
    const shell=document.getElementById?.('kelo-studio-live');if(!shell)return null;
    if(!style){
      style=document.createElement('style');style.dataset.keloBuildEditGrid='1';style.textContent=`
        #kelo-studio-live .ks-beg{position:absolute;left:50%;bottom:132px;transform:translateX(-50%);z-index:15;display:grid;grid-template-columns:auto 1fr;gap:8px;min-width:min(420px,calc(100vw - 16px));max-width:calc(100vw - 16px);padding:8px;border:1px solid rgba(146,197,255,.5);border-radius:16px;background:#07101bf5;box-shadow:0 16px 36px rgba(0,0,0,.38)}
        #kelo-studio-live .ks-beg[hidden]{display:none}#kelo-studio-live .ks-beg-grid{display:grid;grid-template-columns:repeat(3,42px);grid-template-rows:repeat(3,42px);gap:3px}
        #kelo-studio-live .ks-beg-cell{border:1px solid #40597d;border-radius:7px;background:#193553;color:#dcecff;font-weight:950;touch-action:manipulation}.ks-beg-cell.cut{background:#32191c;border-color:#7a3f49;color:#ffb4bd}
        #kelo-studio-live .ks-beg-side{display:flex;flex-direction:column;gap:6px;min-width:0}.ks-beg-title{font-size:9px;font-weight:950;color:#a9c9ff;letter-spacing:.08em}.ks-beg-state{font-size:8px;color:#cbd9ed;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #kelo-studio-live .ks-beg-presets{display:flex;gap:4px;overflow-x:auto}.ks-beg-btn{min-height:36px;flex:0 0 auto;border:1px solid #344d72;border-radius:9px;background:#102139;color:#e7f0ff;font-size:8px;font-weight:900;padding:0 8px;touch-action:manipulation}.ks-beg-btn.on{border-color:#91b9ff;background:#1b3152}.ks-beg-btn.primary{border-color:#568a70;background:#123026;color:#cdf9dc}.ks-beg-btn.danger{border-color:#71424b;background:#2c171b}.ks-beg-btn:disabled{opacity:.38}
        @media(max-width:760px){#kelo-studio-live .ks-beg{left:8px;right:8px;bottom:calc(128px + env(safe-area-inset-bottom));transform:none;grid-template-columns:auto minmax(0,1fr)}#kelo-studio-live .ks-beg-grid{grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,46px)}}
      `;document.head?.appendChild(style);
    }
    if(!panel?.isConnected){
      panel=document.createElement('div');panel.className='ks-beg';panel.dataset.keloStudioUi='1';panel.hidden=true;
      panel.innerHTML=`<div class="ks-beg-grid">${Array.from({length:9},(_,i)=>`<button type="button" class="ks-beg-cell" data-beg-cell="${i}" aria-label="Edit cell ${i+1}">${i+1}</button>`).join('')}</div><div class="ks-beg-side"><div class="ks-beg-title">EDIT GRID 3×3</div><div class="ks-beg-state">FULL</div><div class="ks-beg-presets">${BUILD_EDIT_PATTERNS.map(pattern=>`<button type="button" class="ks-beg-btn" data-beg-pattern="${pattern.id}">${pattern.glyph} ${pattern.label}</button>`).join('')}</div><div class="ks-beg-presets"><button type="button" class="ks-beg-btn primary" data-beg-apply="1">✓ APPLY</button><button type="button" class="ks-beg-btn" data-beg-reset="1">↶ RESET</button><button type="button" class="ks-beg-btn danger" data-beg-cancel="1">✕ CLOSE</button></div></div>`;
      panel.addEventListener('click',event=>{const target=event.target?.closest?.('button');if(!target)return;event.preventDefault?.();event.stopPropagation?.();if(target.dataset.begCell!=null)toggleCell(Number(target.dataset.begCell));else if(target.dataset.begPattern)usePattern(target.dataset.begPattern);else if(target.dataset.begApply)void apply().catch(error=>console.warn('[Kelo Studio] Build Edit Grid apply failed',error));else if(target.dataset.begReset)void reset().catch(error=>console.warn('[Kelo Studio] Build Edit Grid reset failed',error));else if(target.dataset.begCancel)deactivate();});
      shell.appendChild(panel);
    }
    syncUi();return panel;
  }

  function syncUi(){
    if(!panel)return;panel.hidden=!active;
    if(!active)return;
    const state=currentAvailability(),pattern=state.pattern;
    panel.querySelectorAll?.('[data-beg-cell]')?.forEach(button=>{const i=Number(button.dataset.begCell),filled=mask[i]==='1';button.classList.toggle('cut',!filled);button.textContent=filled?'■':'×';button.setAttribute('aria-pressed',filled?'false':'true');});
    panel.querySelectorAll?.('[data-beg-pattern]')?.forEach(button=>button.classList.toggle('on',button.dataset.begPattern===pattern?.id));
    const status=panel.querySelector?.('.ks-beg-state');if(status)status.textContent=pattern?(state.available?`${pattern.label} · READY`:`${pattern.label} · ASSET NEEDED`):'CUSTOM · MATCH A SUPPORTED PATTERN';
    const applyButton=panel.querySelector?.('[data-beg-apply]');if(applyButton)applyButton.disabled=busy||!state.available||!pattern;
  }

  function destroy(){if(destroyed)return;destroyed=true;selectionOff?.();commandsOff?.();observer?.disconnect?.();panel?.remove();style?.remove();panel=null;style=null;active=false;selectedId=null;}

  selectionOff=kernel.selection.onChange(()=>{if(active){const row=selectedWall();if(!row||String(row.id)!==selectedId)deactivate();}syncUi();});
  commandsOff=kernel.commands.on(()=>syncUi());
  if(document?.body&&root?.MutationObserver){observer=new root.MutationObserver(()=>ensureUi());observer.observe(document.body,{childList:true});}
  ensureUi();

  return Object.freeze({id:'buildEditGrid',version:'studio-build-edit-grid-v1.0.0-semantic-3x3',patterns:BUILD_EDIT_PATTERNS.map(copy),variants:variants.map(copy),activate,deactivate,setMask,toggleCell,usePattern,apply,reset,getPreview,get active(){return active;},canEdit:()=>!!selectedWall(),destroy});
}
