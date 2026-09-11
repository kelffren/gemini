/* KELO-INDEX
 * area: STUDIO / SELECT TOOL
 * owns: entity selection from spatial hit testing and one-shot armed grab handoff
 * does-not-own: pointer listeners, drawing or persistent document mutation
 * public-api: createSelectTool(), resolveSelectHitRadius(), screenRadiusToWorld()
 * online: local transient state only
 */

const MOBILE_MAX=760;
const MOBILE_HIT_RADIUS_PX=18;
const MIN_EFFECTIVE_ZOOM=.25;

export function screenRadiusToWorld(screenRadius,zoom=1){
  const px=Math.max(0,Number(screenRadius)||0);
  const z=Math.max(MIN_EFFECTIVE_ZOOM,Number(zoom)||1);
  return px/z;
}

export function resolveSelectHitRadius(radius,{root=globalThis}={}){
  if(radius!=null)return Math.max(0,Number(radius)||0);
  const coarse=!!root?.matchMedia?.('(pointer: coarse)')?.matches;
  const mobile=Number(root?.innerWidth||9999)<=MOBILE_MAX;
  if(!coarse||!mobile)return 0;
  const zoom=Number(root?.KeloCamera?.snapshot?.()?.effectiveZoom)||1;
  return screenRadiusToWorld(MOBILE_HIT_RADIUS_PX,zoom);
}

export function createSelectTool(kernel) {
  if (!kernel) throw new Error('STUDIO_SELECT_KERNEL_REQUIRED');

  let lastPick = null;
  let armedGrab = null;
  const REPEAT_WINDOW_MS = 1200;
  const REPEAT_RADIUS = 12;
  const ARMED_GRAB_TTL_MS = 6000;

  function armGrab(ids = kernel.selection.get(), { ttl = ARMED_GRAB_TTL_MS } = {}) {
    const rows = (Array.isArray(ids) ? ids : [ids]).map(String).filter(Boolean);
    armedGrab = rows.length ? { ids: rows, expiresAt: Date.now() + Math.max(250, Number(ttl) || ARMED_GRAB_TTL_MS) } : null;
    return armedGrab ? armedGrab.ids.slice() : [];
  }

  function cancelGrab() {
    armedGrab = null;
  }

  function consumeArmedGrab() {
    if (!armedGrab) return null;
    if (Date.now() > armedGrab.expiresAt) { armedGrab = null; return null; }
    const selected = new Set(kernel.selection.get().map(String));
    const id = armedGrab.ids.find(candidate => selected.has(String(candidate)) && kernel.spatial.get?.(candidate));
    armedGrab = null;
    if (!id) return null;
    const row = kernel.spatial.get(id);
    return row?.data || row || kernel.document.entities.find(entity => String(entity.id) === String(id)) || null;
  }

  function hitDistanceSquared(hit, x, y) {
    const rect=hit?.rect||{};
    const left=Number(rect.x)||0,top=Number(rect.y)||0,right=left+Math.max(1,Number(rect.w)||1),bottom=top+Math.max(1,Number(rect.h)||1);
    const dx=x<left?left-x:x>right?x-right:0,dy=y<top?top-y:y>bottom?y-bottom:0;
    return dx*dx+dy*dy;
  }

  function pointHits(px,py,radius){
    const r=resolveSelectHitRadius(radius);
    if(r<=0)return kernel.spatial.queryPoint(px,py,{category:'entity'}).slice().reverse();
    const hits=kernel.spatial.queryRect({x:px-r,y:py-r,w:r*2+1,h:r*2+1},{category:'entity'}).slice().reverse();
    return hits.map((hit,index)=>({hit,index,d:hitDistanceSquared(hit,px,py)}))
      .filter(row=>row.d<=r*r)
      .sort((a,b)=>a.d-b.d||a.index-b.index)
      .map(row=>row.hit);
  }

  return Object.freeze({
    id: 'select',
    selectPoint(x, y, { append = false, preserveExisting = true, cycle = true, radius = null } = {}) {
      const px = Number(x) || 0;
      const py = Number(y) || 0;

      if (!append) {
        const armed = consumeArmedGrab();
        if (armed) { lastPick = null; return armed; }
      } else {
        cancelGrab();
      }

      const ordered = pointHits(px,py,radius);

      if (!ordered.length) {
        lastPick = null;
        if (!append) kernel.selection.clear();
        return null;
      }

      if (append) {
        const hit = ordered[0];
        kernel.selection.add(hit.id);
        lastPick = null;
        return hit.data || hit;
      }

      const now = Date.now();
      const stackKey = ordered.map(hit => String(hit.id)).join('\u0001');
      const currentIndex = ordered.findIndex(hit => kernel.selection.has(hit.id));
      const repeated = !!lastPick
        && lastPick.key === stackKey
        && now - lastPick.at <= REPEAT_WINDOW_MS
        && Math.hypot(px - lastPick.x, py - lastPick.y) <= REPEAT_RADIUS;

      let hit = ordered[0];
      if (cycle && repeated && ordered.length > 1 && currentIndex >= 0) {
        hit = ordered[(currentIndex + 1) % ordered.length];
      } else if (preserveExisting && currentIndex >= 0) {
        hit = ordered[currentIndex];
      }

      kernel.selection.set(hit.id);
      lastPick = { x: px, y: py, key: stackKey, at: now };
      return hit.data || hit;
    },
    armGrab,
    cancelGrab,
    clear() {
      lastPick = null;
      cancelGrab();
      return kernel.selection.clear();
    }
  });
}
