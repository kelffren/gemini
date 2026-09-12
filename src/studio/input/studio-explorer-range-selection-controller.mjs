/* KELO-INDEX
 * area: STUDIO / INPUT / EXPLORER RANGE SELECTION
 * owns: desktop-style Shift range selection and focused keyboard navigation inside the virtual Explorer
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
  const explorerRows=()=>Array.from(document.querySelectorAll?.(ENTITY_SELECTOR)||[]).filter(row=>String(row?.dataset?.entity||''));

  function focusRow(row,{scroll=false}={}){
    if(!row)return;
    if(row.getAttribute?.('tabindex')==null)row.setAttribute?.('tabindex','-1');
    row.focus?.({preventScroll:true});
    if(scroll)row.scrollIntoView?.({block:'nearest',inline:'nearest'});
  }

  function onclick(event){
    if(destroyed||event.defaultPrevented)return;
    const row=event.target?.closest?.(ENTITY_SELECTOR);
    if(!row)return;
    const id=String(row.dataset?.entity||'');
    if(!id)return;

    if(!event.shiftKey){
      anchorId=id;
      focusRow(row);
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
    focusRow(row);
  }

  function onkeydown(event){
    if(destroyed||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return;
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    const row=event.target?.closest?.(ENTITY_SELECTOR);
    if(!row)return;
    const rows=explorerRows();
    if(!rows.length)return;
    let index=rows.indexOf(row);
    if(index<0){
      const id=String(row.dataset?.entity||'');
      index=rows.findIndex(candidate=>String(candidate.dataset?.entity||'')===id);
    }
    if(index<0)return;
    const nextIndex=event.key==='Home'?0:event.key==='End'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(event.key==='ArrowDown'?1:-1)));
    event.preventDefault?.();
    event.stopImmediatePropagation?.();
    if(nextIndex===index)return;
    const next=rows[nextIndex],id=String(next.dataset?.entity||'');
    if(!id)return;

    if(event.shiftKey){
      const visibleIds=rows.map(candidate=>String(candidate.dataset?.entity||'')).filter(Boolean);
      const current=kernel.selection.get?.()||[];
      const currentId=String(row.dataset?.entity||'');
      if(!anchorId||!visibleIds.includes(String(anchorId)))anchorId=visibleIds.includes(currentId)?currentId:id;
      const result=resolveExplorerRange({ids:visibleIds,anchorId,targetId:id,current,append:false});
      if(!result)return;
      anchorId=result.anchor;
      kernel.selection.set(result.selection);
      focusRow(next,{scroll:true});
      return;
    }

    anchorId=id;
    kernel.selection.set([id]);
    focusRow(next,{scroll:true});
  }

  document.addEventListener('click',onclick,true);
  document.addEventListener('keydown',onkeydown,true);
  return Object.freeze({
    version:'studio-explorer-range-selection-v1.3.0-keyboard-range',
    get anchor(){return anchorId;},
    destroy(){
      if(destroyed)return;
      destroyed=true;
      document.removeEventListener?.('click',onclick,true);
      document.removeEventListener?.('keydown',onkeydown,true);
    }
  });
}
