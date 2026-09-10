/* KELO-INDEX
 * area: CREATORS / MAP FORGE UI
 * owner: Kelo Map Forge Creator UI
 * purpose: keep reversible exterior-preview chrome above unrelated full-screen account overlays
 * public-api: ensureMapForgeExteriorLayerOrder()
 * state-owned: one style element only
 * do-not: no generator, world, input, auth or gameplay ownership
 */
export function ensureMapForgeExteriorLayerOrder(root=globalThis){
  const doc=root?.document;if(!doc||doc.getElementById('kelo-map-forge-layer-order'))return;
  const style=doc.createElement('style');style.id='kelo-map-forge-layer-order';style.textContent='.kmf-return,.kmf-exterior-status{z-index:2147482600!important}';doc.head.append(style);
}
