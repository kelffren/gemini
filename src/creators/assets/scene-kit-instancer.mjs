/* KELO-INDEX
 * area: CREATORS / SCENE KIT
 * owner: Scene Kit instancer
 * owns: draft local + session overlay props for preview
 * does-not-own: KELO_PROPERTY_CATALOG, generic-props renderer, world publish
 * public-api: instantiateSceneKit(), clearSceneKitPreview(), getSceneKitRuntime()
 */
import { getSceneKit, SCENE_KIT_VERSION } from './scene-kit-catalog.mjs';

const DRAFT_KEY = 'kelo.sceneKit.draft.v1';
const LAYER_GROUP = 'plazaForestCompiled';

function actorPoint(root) {
  const p = root.localPlayer || root.player || null;
  const x = Number(p?.x);
  const y = Number(p?.y);
  if (Number.isFinite(x) && Number.isFinite(y)) return { x: Math.round(x - 200), y: Math.round(y - 80) };
  return { x: 1480, y: 1480 };
}

function frameOf(templateId) {
  const raw = String(templateId || '').replace(/^forest-plaza:/, '');
  return raw || null;
}

function toProp(kitId, slot, origin) {
  const frame = frameOf(slot.templateId);
  const x = origin.x + Number(slot.dx || 0);
  const y = origin.y + Number(slot.dy || 0);
  const w = Math.max(24, Number(slot.w) || 64);
  const h = Math.max(24, Number(slot.h) || 64);
  return Object.freeze({
    id: `scene-kit:${kitId}:${slot.slot}`,
    family: 'scene_kit_preview',
    asset: 'forestPlazaV2',
    frame,
    layerGroup: LAYER_GROUP,
    layerRole: slot.role === 'front' ? 'front' : 'back',
    position: Object.freeze({ x, y }),
    size: Object.freeze({ w, h }),
    anchor: Object.freeze({ x: 0.5, y: 1 }),
    visualBounds: Object.freeze({ x, y, w, h }),
    footprint: Object.freeze({ x: x + Math.round(w * 0.3), y: y + h - 12, w: Math.max(12, Math.round(w * 0.4)), h: 12 }),
    collider: Object.freeze({ mode: 'none' }),
    layers: Object.freeze({ back: 'props_back', front: 'props_front' }),
    priority: 16,
    district: 'central',
    occlusion: Object.freeze({ mode: 'none' }),
    visualOnly: true,
    templateId: slot.templateId,
    slot: slot.slot
  });
}

function installRuntime(root, props) {
  const list = Array.isArray(props) ? props.slice() : [];
  const api = Object.freeze({
    version: SCENE_KIT_VERSION,
    layerGroup: LAYER_GROUP,
    instances() { return list.slice(); }
  });
  try { root.KELO_SCENE_KIT_RUNTIME = api; } catch {}
  try { root.dispatchEvent?.(new CustomEvent('kelo:scene-kit-preview', { detail: { count: list.length } })); } catch {}
  try { root.KELO_GENERIC_PROPS?.syncResidency?.(); } catch {}
  return api;
}

export function getSceneKitRuntime(root = globalThis) {
  return root.KELO_SCENE_KIT_RUNTIME || null;
}

export function clearSceneKitPreview(root = globalThis) {
  installRuntime(root, []);
  try { root.localStorage?.removeItem?.(DRAFT_KEY); } catch {}
  return true;
}

export function instantiateSceneKit(kitId, { root = globalThis, origin = null } = {}) {
  const kit = getSceneKit(kitId);
  if (!kit) throw new Error(`SCENE_KIT_NOT_FOUND:${kitId}`);
  const catalog = root.KELO_PROPERTY_CATALOG;
  const named = root.KELO_FOREST_PLAZA_CATALOG_AUDIT?.namedAssets;
  const at = origin || actorPoint(root);
  const missing = [];
  const placed = [];
  for (const slot of kit.slots) {
    const template = catalog?.getTemplate?.(slot.templateId) || null;
    const known = !named || named.some(row => row.legacyId === slot.templateId || row.assetId === frameOf(slot.templateId));
    if (!template && catalog && !known) {
      missing.push(slot.slot);
      continue;
    }
    placed.push(toProp(kit.id, slot, at));
  }
  if (!placed.length) throw new Error('SCENE_KIT_NO_PLACEABLE_SLOTS');
  const draft = Object.freeze({
    version: SCENE_KIT_VERSION,
    kitId: kit.id,
    label: kit.label,
    pack: kit.pack,
    origin: at,
    placedAt: Date.now(),
    published: false,
    missing,
    placements: placed.map(p => Object.freeze({
      slot: p.slot,
      templateId: p.templateId,
      x: p.position.x,
      y: p.position.y,
      w: p.size.w,
      h: p.size.h,
      role: p.layerRole
    }))
  });
  try { root.localStorage?.setItem?.(DRAFT_KEY, JSON.stringify(draft)); } catch {}
  installRuntime(root, placed);
  try { root.KeloCamera?.focus?.({ x: at.x + kit.size.w / 2, y: at.y + kit.size.h / 2 }, { snap: false, source: 'scene-kit' }); } catch {}
  return draft;
}

export function readSceneKitDraft(root = globalThis) {
  try {
    const raw = root.localStorage?.getItem?.(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
