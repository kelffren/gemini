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
  const enqueue=typeof root?.queueMicrotask==='function'?root.queueMicrotask.bind(root):
    typeof globalThis.queueMicrotask==='function'?globalThis.queueMicrotask.bind(globalThis):fn=>Promise.resolve().then(fn);

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

    const before=Array.from(document.querySelectorAll?.(PROPERTY_SELECTOR)||[]);
    const sourceIndex=before.indexOf(input);
    const direction=event.shiftKey?-1:1;
    const sourceProp=String(input.dataset?.prop??input.getAttribute?.('data-prop')??'');

    // Blur is intentionally canonical: the shell's existing `change` listener
    // owns conversion/clamping and forwards through its established CommandBus path.
    input.blur?.();

    // Property panels can rerender synchronously after commit. Resolve the fresh
    // input list in a microtask, then continue spreadsheet-style editing.
    enqueue(()=>{
      if(destroyed)return;
      const fields=Array.from(document.querySelectorAll?.(PROPERTY_SELECTOR)||[])
        .filter(field=>!field?.disabled&&field?.getAttribute?.('aria-disabled')!=='true');
      if(!fields.length)return;
      let index=fields.indexOf(input);
      if(index<0&&sourceProp){
        index=fields.findIndex(field=>String(field.dataset?.prop??field.getAttribute?.('data-prop')??'')===sourceProp);
      }
      if(index<0&&sourceIndex>=0)index=Math.min(sourceIndex,fields.length-1);
      const next=fields[index+direction];
      if(!next)return;
      next.focus?.();
      next.select?.();
    });
  }

  document.addEventListener('focusin',focusin,true);
  document.addEventListener('keydown',keydown,true);
  return Object.freeze({
    version:'studio-property-commit-v1.1.0-enter-navigation',
    destroy(){
      if(destroyed)return;
      destroyed=true;
      document.removeEventListener?.('focusin',focusin,true);
      document.removeEventListener?.('keydown',keydown,true);
    }
  });
}
