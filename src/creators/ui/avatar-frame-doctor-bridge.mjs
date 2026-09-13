/* KELO-INDEX
 * area: CREATORS / AVATAR / FRAME DOCTOR TACTILE BRIDGE
 * owner: adapt existing uploaded-sheet Frame Doctor repair into tactile editor without replacing compiler ownership
 * keys: FRAME DOCTOR TACTILE SOURCE RECT PATCH APPLY
 */
import {createFrameProject,replaceFrameSlot,updateFramePatch,normalizeFrameRuntimeContract} from '../avatar/avatar-frame-project.mjs';
import {openAvatarFrameEditor} from './avatar-frame-editor.mjs';
const F=Object.freeze;

function rectOf(frame){const r=frame?.sourceRect||frame?.bounds;if(!r)return null;return {x:Number(r.x)||0,y:Number(r.y)||0,w:Math.max(1,Number(r.w??r.width)||1),h:Math.max(1,Number(r.h??r.height)||1)};}
function selectedFrames(analysis){const groups=analysis?._rigReport?.best?.groups;return Array.isArray(groups)?groups.flat():[];}
function memoryStore(file,width,height){let saved=null;return F({async getSource(key){return key==='uploaded-sheet'?{key,blob:file,metadata:{name:file.name,type:file.type,width,height}}:null;},async saveProject(project){saved=project;return project;},current(){return saved;}});}

export function installAvatarFrameDoctorBridge({root=globalThis,shell}={}){
  if(!shell)return F({dispose(){}});
  const onEdit=async event=>{
    const detail=event.detail||{},index=Number(detail.index);if(!detail.file||!Number.isInteger(index)||index<0)return;
    const compiled=detail.compiled,analysis=detail.analysis;if(!compiled||compiled.columns!==4||compiled.rows!==4||compiled.directions!==4){detail.fallback?.();return;}
    const frames=selectedFrames(analysis);if(index>=16||!frames[index]){detail.fallback?.();return;}
    const runtimeContract=normalizeFrameRuntimeContract({rigProfileId:compiled.rigProfileId,directionKeys:compiled.directionKeys,rowMap:compiled.rowMap,frameCounts:compiled.frameCounts}),project=createFrameProject({id:'uploaded-sheet-tactile-session',name:String(detail.file.name||'Uploaded Sprite'),runtimeContract});
    let working=project;const width=Number(analysis.width)||0,height=Number(analysis.height)||0;
    for(let i=0;i<Math.min(16,frames.length);i++){const sourceRect=rectOf(frames[i]);if(!sourceRect)continue;working=replaceFrameSlot(working,i,{sourceKey:'uploaded-sheet',sourceName:detail.file.name,sourceType:detail.file.type,sourceWidth:width,sourceHeight:height,state:i===index?'NEEDS_REVIEW':'IMPORTED',patch:{...(detail.framePatches?.[i]||{}),sourceRect}});}
    if(!working.slots[index]?.sourceKey){detail.fallback?.();return;}const store=memoryStore(detail.file,width,height);
    await openAvatarFrameEditor({root,project:working,index,store,onCommit:async next=>{const nextPatch=next.slots[index]?.patch||{};detail.apply?.(nextPatch);}});
  };
  shell.addEventListener('kelo:avatar:tactile-frame',onEdit);
  return F({dispose(){shell.removeEventListener('kelo:avatar:tactile-frame',onEdit);}});
}
