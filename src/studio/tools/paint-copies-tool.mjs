/* KELO-INDEX
 * area: STUDIO / PAINT COPIES TOOL
 * owns: local copy-stroke preview, automatic spacing and one-history-action batch commit
 * does-not-own: pointer transport, renderer or authority transport
 * public-api: createPaintCopiesTool()
 * online: stroke preview is local; commit becomes one CompositeCommand mirrored by Studio authority
 */

import { createPlaceEntityCommand } from '../document/document-commands.mjs';
import { createCompositeCommand } from '../document/composite-command.mjs';

const MAX_PREVIEW_ENTITIES = 500;
const copy = value => value == null ? value : (typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)));
function newId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `entity:${uuid || `${Date.now().toString(36)}:${Math.random().toString(36).slice(2,10)}`}`;
}
const num = value => Number(value) || 0;

export function createPaintCopiesTool(kernel) {
  if (!kernel) throw new Error('STUDIO_PAINT_COPIES_KERNEL_REQUIRED');

  let template = null;
  let stroke = null;

  const selectedEntities = () => kernel.selection.get().map(id => kernel.document.entities.find(e => String(e.id) === String(id))).filter(Boolean);
  const entitySize = row => {
    const spatial = kernel.spatial.get(row.id)?.rect;
    const scale = Math.max(.1, Number(row.transform?.scale) || 1);
    return {
      w: Math.max(1, Number(spatial?.w) || (Number(row.bounds?.w) || 1) * scale),
      h: Math.max(1, Number(spatial?.h) || (Number(row.bounds?.h) || 1) * scale)
    };
  };

  function start({ spacing = 'auto', snap = null } = {}) {
    const rows = selectedEntities();
    if (!rows.length) throw new Error('STUDIO_PAINT_COPIES_SELECTION_REQUIRED');
    const rects = rows.map(row => {
      const size = entitySize(row);
      return { row, x: num(row.transform?.x), y: num(row.transform?.y), ...size };
    });
    const minX = Math.min(...rects.map(r => r.x));
    const minY = Math.min(...rects.map(r => r.y));
    const maxX = Math.max(...rects.map(r => r.x + r.w));
    const maxY = Math.max(...rects.map(r => r.y + r.h));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const tile = Math.max(1, Number(snap ?? kernel.document.settings?.tileSize) || 32);
    const footprint = { w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    const autoSpacing = Math.max(tile, Math.min(footprint.w, footprint.h));
    const resolvedSpacing = spacing === 'auto' ? autoSpacing : Math.max(1, Number(spacing) || autoSpacing);

    template = {
      spacing: resolvedSpacing,
      snap: tile,
      footprint,
      rows: rects.map(({ row }) => {
        const clone = copy(row);
        if (clone.source) clone.source = { ...clone.source, authorityPlacementId: undefined };
        return {
          source: clone,
          offsetX: num(row.transform?.x) - centerX,
          offsetY: num(row.transform?.y) - centerY
        };
      })
    };
    stroke = null;
    return state();
  }

  function addStamp(x, y, snap = template?.snap || 32) {
    if (!template || !stroke) return false;
    const s = Math.max(1, Number(snap) || 1);
    const cx = Math.round(num(x) / s) * s;
    const cy = Math.round(num(y) / s) * s;
    const key = `${cx}:${cy}`;
    if (stroke.keys.has(key)) return false;
    if ((stroke.stamps + 1) * template.rows.length > MAX_PREVIEW_ENTITIES) {
      stroke.capped = true;
      return false;
    }
    stroke.keys.add(key);
    stroke.stamps++;
    for (const item of template.rows) {
      const row = copy(item.source);
      row.id = newId();
      row.transform = {
        ...(row.transform || {}),
        x: cx + item.offsetX,
        y: cy + item.offsetY
      };
      if (row.source) row.source = { ...row.source, authorityPlacementId: undefined };
      stroke.previews.push(row);
    }
    return true;
  }

  function beginAt(x, y, { snap = template?.snap || 32, spacing = template?.spacing } = {}) {
    if (!template) throw new Error('STUDIO_PAINT_COPIES_NOT_READY');
    const resolvedSpacing = Math.max(1, Number(spacing) || template.spacing || 32);
    stroke = {
      active: true,
      spacing: resolvedSpacing,
      snap: Math.max(1, Number(snap) || 1),
      lastInput: { x: num(x), y: num(y) },
      distanceUntilNext: resolvedSpacing,
      previews: [],
      keys: new Set(),
      stamps: 0,
      capped: false
    };
    addStamp(x, y, stroke.snap);
    return state();
  }

  function strokeTo(x, y, { snap = stroke?.snap || template?.snap || 32 } = {}) {
    if (!stroke?.active || !template) return null;
    const end = { x: num(x), y: num(y) };
    const start = stroke.lastInput;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0.001) return state();
    const ux = dx / length;
    const uy = dy / length;
    let travel = stroke.distanceUntilNext;
    while (travel <= length + 1e-6 && !stroke.capped) {
      addStamp(start.x + ux * travel, start.y + uy * travel, snap);
      travel += stroke.spacing;
    }
    stroke.distanceUntilNext = Math.max(0.001, travel - length);
    stroke.lastInput = end;
    return state();
  }

  function cancelStroke() {
    stroke = null;
  }

  function cancel() {
    stroke = null;
    template = null;
  }

  async function commit() {
    if (!stroke?.active) throw new Error('STUDIO_PAINT_COPIES_STROKE_NOT_ACTIVE');
    const rows = stroke.previews.map(copy);
    const wasCapped = stroke.capped;
    stroke = null;
    if (!rows.length) return { rows: [], stamps: 0, capped: wasCapped };
    const commands = rows.map(row => createPlaceEntityCommand(row));
    if (commands.length === 1) await kernel.execute(commands[0]);
    else await kernel.execute(createCompositeCommand(commands, {
      type: 'entity.batch.paint-copies',
      label: `Paint ${rows.length} object${rows.length === 1 ? '' : 's'}`
    }));
    kernel.selection.set(rows.map(row => row.id));
    return { rows, stamps: Math.ceil(rows.length / Math.max(1, template?.rows.length || 1)), capped: wasCapped };
  }

  function state() {
    return {
      ready: !!template,
      active: !!stroke?.active,
      spacing: template?.spacing || null,
      snap: stroke?.snap || template?.snap || null,
      footprint: template?.footprint ? { ...template.footprint } : null,
      templateCount: template?.rows.length || 0,
      stamps: stroke?.stamps || 0,
      previewCount: stroke?.previews.length || 0,
      capped: !!stroke?.capped
    };
  }

  return Object.freeze({
    id: 'paintCopies',
    start,
    beginAt,
    strokeTo,
    commit,
    cancelStroke,
    cancel,
    state,
    getPreviews: () => stroke?.previews.map(copy) || []
  });
}
