/* KELO-INDEX
 * area: CREATORS / AVATAR AUTHORING
 * owner: composition shell joining Frame Surgery and persistent 4x4 Frame Builder
 * purpose: one Avatar workspace with two complementary inputs: arbitrary AI image/sheet repair and frame-by-frame construction
 * does-not-own: compiler, renderer, persistence authority or avatar activation
 */
import {openAvatarQuickImport as openFrameSurgery} from './avatar-frame-surgery-workspace.mjs';
import {openAvatarFrameBuilder} from './avatar-frame-builder.mjs';
import {installAvatarFrameDoctorBridge} from './avatar-frame-doctor-bridge.mjs';
const F=Object.freeze;
const installed=new WeakMap();

function installFrameBuilderEntry({root,avatarQuick,session}){
  const shell=session?.shell;
  if(!shell||!avatarQuick)return null;
  const existing=installed.get(shell);
  if(existing?.button?.isConnected)return existing;
  const drop=shell.querySelector?.('.drop');
  if(!drop)return null;
  const button=root.document.createElement('button');
  button.type='button';
  button.dataset.keloFrameBuilder='';
  button.textContent='CONSTRUIR 4×4 · FRAME A FRAME';
  button.style.cssText='width:100%;margin:10px 0 0;padding:13px;min-height:50px;border:1px solid #6b5a2e;border-radius:13px;background:#171b23;color:#e8cf82;font-weight:900;touch-action:manipulation';
  button.addEventListener('click',()=>void openAvatarFrameBuilder({root,avatarQuick}));
  drop.insertAdjacentElement('afterend',button);
  const bridge=installAvatarFrameDoctorBridge({root,shell});
  const record={button,bridge};installed.set(shell,record);return record;
}

export async function openAvatarQuickImport({root=globalThis,avatarQuick,...rest}={}){
  const session=await openFrameSurgery({root,avatarQuick,...rest});
  const integration=installFrameBuilderEntry({root,avatarQuick,session});
  if(!integration)return session;
  return F({...session,version:`${session.version||'frame-surgery'}+frame-builder-v1`,frameBuilderButton:integration.button});
}
