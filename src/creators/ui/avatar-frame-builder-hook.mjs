/* KELO-INDEX
 * area: CREATORS / AVATAR / FRAME BUILDER HOOK
 * owner: small composition bridge from Avatar Quick Import to frame builder and tactile Frame Doctor
 */
import {openAvatarFrameBuilder} from './avatar-frame-builder.mjs';
import {installAvatarFrameDoctorBridge} from './avatar-frame-doctor-bridge.mjs';
const F=Object.freeze;
export function installAvatarFrameBuilderEntry({root=globalThis,avatarQuick,session}={}){
  const shell=session?.shell;if(!shell||!avatarQuick)return F({dispose(){}});const document=root.document,drop=shell.querySelector?.('.kaq-drop');if(!drop)return F({dispose(){}});
  const bridge=installAvatarFrameDoctorBridge({root,shell});
  const button=document.createElement('button');button.type='button';button.className='kaq-use';button.dataset.keloFrameBuilder='';button.textContent='CONSTRUIR 4×4 · FRAME A FRAME';button.style.marginTop='10px';button.style.background='#171b23';button.style.color='#e8cf82';button.style.border='1px solid #6b5a2e';button.onclick=()=>void openAvatarFrameBuilder({root,avatarQuick});drop.insertAdjacentElement('afterend',button);
  return F({button,dispose(){bridge.dispose?.();button.remove();}});
}
