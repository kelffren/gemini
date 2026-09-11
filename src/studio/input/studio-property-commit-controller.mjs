/* KELO-INDEX
 * area: STUDIO / INPUT / PROPERTY COMMIT
 * owns: keyboard commit/cancel ergonomics for canonical Studio property inputs
 * does-not-own: property mutation, CommandBus, authority or transform math
 * public-api: createStudioPropertyCommitController()
 * online: delegates persistence to the existing [data-prop] change handler
 */

const PROPERTY_SELECTOR='#kelo-studio-live [data-prop]';

export function shouldHandleStudioPropertyCommitKey(event){
  if(!event||event.defaultPrevented||event.repeat||event.ctrlKey||event.metaKey||event.altKey)return false;
  if(!event.target?.matches?.(PROPERTY_SELECTOR))return false;
  const key=String(event.key||'');
  return key==='Enter'||key==='Escape';
}

export function createStudioPropertyCommitController({root=globalThis}={}){
  const document=root?.document;
  if(!document?.addEventListener)return Object.freeze({destroy(){}});
  let destroyed=false;
  const initialValues=new WeakMap();

  function focusin(event){
    const input=event.target;
    if(!input?.matches?.(PROPERTY_SELECTOR))return;
    initialValues.set(input,String(input.value??''));
  }

  function keydown(event){
    if(!shouldHandleStudioPropertyCommitKey(event))return;
    const input=event.target;
    event.preventDefault?.();
    event.stopPropagation?.();

    if(event.key==='Escape'){
      const initial=initialValues.get(input);
      if(initial!==undefined)input.value=initial;
      input.blur?.();
      return;
    }

    // Blur is intentionally canonical: the shell's existing `change` listener
    // owns conversion/clamping and forwards through its established CommandBus path.
    input.blur?.();
  }

  document.addEventListener('focusin',focusin,true);
  document.addEventListener('keydown',keydown,true);
  return Object.freeze({
    destroy(){
      if(destroyed)return;
      destroyed=true;
      document.removeEventListener?.('focusin',focusin,true);
      document.removeEventListener?.('keydown',keydown,true);
    }
  });
}
