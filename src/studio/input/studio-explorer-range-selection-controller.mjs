/* KELO-INDEX
 * area: STUDIO / INPUT / EXPLORER RANGE SELECTION
 * owns: desktop-style Shift range selection inside the virtual Explorer
 * does-not-own: document mutation, CommandBus, authority, Explorer rendering or camera
 * public-api: createStudioExplorerRangeSelectionController()
 * online: selection-only state; never writes persistent world data
 */

const ENTITY_SELECTOR='#kelo-studio-live [data-entity]';

export function resolveExplorerRange({ids=[],anchorId=null,targetId=null,current=[],append=false}={}){
  const order=ids.map(String),target=String(targetId??'');
  if(!target||!order.includes(target))return null;
  const selected=current.map(String);
  let anchor=anchorId==null?'':String(anchorId);
  if(!order.includes(anchor))anchor=[...selected].reverse().find(id=>order.includes(id))||target;
  const a=order.indexOf(anchor),b=order.indexOf(target),from=Math.min(a,b),to=Math.max(a,b),range=order.slice(from,to+1);
  if(!append)return {anchor,target,selection:range};
  const merged=[],seen=new Set();
  for(const id of [...selected,...range])if(!seen.has(id)){seen.add(id);merged.push(id);}
  return {anchor,target,selection:merged};
}

export function createStudioExplorerRangeSelectionController({root=globalThis,kernel}={}){
  const document=root?.document;
  if(!document?.addEventListener||!kernel?.selection)return Object.freeze({destroy(){}});
  let destroyed=false,anchorId=null;
  const entityIds=()=>kernel.document?.entities?.map?.(row=>String(row.id))||[];

  function onclick(event){
    if(destroyed||event.defaultPrevented)return;
    const row=event.target?.closest?.(ENTITY_SELECTOR);
    if(!row)return;
    const id=String(row.dataset?.entity||'');
    if(!id)return;

    if(!event.shiftKey){
      anchorId=id;
      return;
    }

    const result=resolveExplorerRange({
      ids:entityIds(),
      anchorId,
      targetId:id,
      current:kernel.selection.get?.()||[],
      append:!!(event.ctrlKey||event.metaKey)
    });
    if(!result)return;
    anchorId=result.anchor;
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    kernel.selection.set(result.selection);
  }

  document.addEventListener('click',onclick,true);
  return Object.freeze({
    version:'studio-explorer-range-selection-v1.0.0',
    get anchor(){return anchorId;},
    destroy(){
      if(destroyed)return;
      destroyed=true;
      document.removeEventListener?.('click',onclick,true);
    }
  });
}
