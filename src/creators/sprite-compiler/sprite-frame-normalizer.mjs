/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / FRAME NORMALIZATION
 * owner: lossless frame canvas, scale, center and foot-anchor normalization
 * keys: SPRITE NORMALIZE CANVAS SCALE CENTER FOOT ANCHOR VARIABLE FRAME COUNT
 * purpose: repack detected frames into a runtime atlas while changing geometry only
 * public-api: planSpriteFrameNormalization, normalizeSpriteFrameGroups
 * consumes: sprite foreground pixels + resolved sprite rig groups
 * state-owned: none; deterministic pixels/layout -> runtime canvas and metrics
 * extension-points: safe scale policy and target atlas sizing
 * online: N/A
 * do-not: detect layouts, assign semantics, generate art or repair missing anatomy
 */

const F = Object.freeze;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = (sorted.length - 1) / 2;
  return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
};
const cv = values => {
  if (values.length < 2) return 0;
  const average = mean(values);
  return average ? Math.sqrt(mean(values.map(value => (value - average) ** 2))) / average : 1;
};

function frameBounds(frame) {
  const bounds = frame?.bounds;
  if (!bounds) return null;
  const w = Math.max(1, Number(bounds.w ?? bounds.width) || 1);
  const h = Math.max(1, Number(bounds.h ?? bounds.height) || 1);
  return {x: Number(bounds.x) || 0, y: Number(bounds.y) || 0, w, h};
}

function sourceRect(frame, bounds, width, height) {
  const source = frame?.sourceRect || bounds;
  const x = clamp(Math.floor(source.x), 0, width - 1);
  const y = clamp(Math.floor(source.y), 0, height - 1);
  const right = clamp(Math.ceil(source.x + (source.w ?? source.width)), x + 1, width);
  const bottom = clamp(Math.ceil(source.y + (source.h ?? source.height)), y + 1, height);
  return {x, y, w: right - x, h: bottom - y};
}

function percentile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.round(clamp(q) * (sorted.length - 1))];
}

function spread(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

function sourceMetrics(groups) {
  const frames = groups.flat().filter(frame => frameBounds(frame));
  const heights = frames.map(frame => frameBounds(frame).h);
  const widths = frames.map(frame => frameBounds(frame).w);
  const areas = frames.map(frame => Number(frame.area) || frameBounds(frame).w * frameBounds(frame).h);
  const feetOffsets = groups.flatMap(group => {
    const feet = group.map(frame => {
      const bounds = frameBounds(frame);
      return bounds ? bounds.y + bounds.h : null;
    }).filter(Number.isFinite);
    const center = median(feet);
    return feet.map(value => Math.abs(value - center));
  });
  const centerOffsets = frames.map(frame => {
    const bounds = frameBounds(frame);
    const cell = frame.cell;
    if (!cell) return 0;
    const cellWidth = Number(cell.w ?? cell.width) || 1;
    return Math.abs((bounds.x + bounds.w / 2) - (Number(cell.x) + cellWidth / 2)) / cellWidth;
  });
  return {
    heightVariation: cv(heights),
    widthVariation: cv(widths),
    visualScaleVariation: cv(areas.map(Math.sqrt)),
    footAnchorDispersionPx: feetOffsets.length ? Math.max(...feetOffsets) : 0,
    footAnchorDispersion: median(heights) ? mean(feetOffsets) / median(heights) : 0,
    centerDrift: mean(centerOffsets),
    clippingFrames: frames.filter(frame => frame.touchesCanvasEdge || frame.boundaryRatio > .012).length,
    frames: frames.length
  };
}

export function planSpriteFrameNormalization(rig, {
  sourceWidth,
  sourceHeight,
  maxRuntimeDimension = 1024,
  maxCellDimension = 256,
  minCellDimension = 48,
  safeScaleMin = .84,
  safeScaleMax = 1.18,
  scaleDeadZone = .035,
  footAnchor = .92,
  horizontalAnchor = .5,
  framePatches = null
} = {}) {
  if (!rig?.groups?.length) throw new Error('SPRITE_NORMALIZER_RIG_REQUIRED');
  const rows = rig.groups.length;
  const columns = Math.max(1, ...rig.groups.map(group => group.length));
  const usable = rig.groups.flat().filter(frame => frameBounds(frame));
  if (!usable.length) throw new Error('SPRITE_NORMALIZER_FRAMES_REQUIRED');
  const heights = usable.map(frame => frameBounds(frame).h);
  const medianHeight = median(heights);
  const framePlans = [];
  const allFrames = rig.groups.flat();
  for (let row = 0; row < rig.groups.length; row++) for (let column = 0; column < rig.groups[row].length; column++) {
    const frame = rig.groups[row][column];
    const patch = framePatches?.[row * columns + column] || {};
    const sourceFrame = Number.isInteger(Number(patch.copyFrom)) ? (allFrames[Number(patch.copyFrom)] || frame) : frame;
    const bounds = frameBounds(sourceFrame);
    if (!bounds) continue;
    const rawCorrection = medianHeight / Math.max(1, bounds.h);
    const withinDeadZone = Math.abs(rawCorrection - 1) <= scaleDeadZone;
    const correction = withinDeadZone ? 1 : clamp(rawCorrection, safeScaleMin, safeScaleMax);
    const scaleOutlier = rawCorrection < safeScaleMin || rawCorrection > safeScaleMax;
    framePlans.push({
      row,
      column,
      direction: rig.directionKeys?.[row] || `row${row + 1}`,
      frame,
      sourceFrame,
      patch,
      bounds,
      correction,
      rawCorrection,
      scaleOutlier,
      correctedWidth: bounds.w * correction,
      correctedHeight: bounds.h * correction
    });
  }
  const desiredWidth = Math.max(minCellDimension, Math.ceil(percentile(framePlans.map(plan => plan.correctedWidth), .96) / .82));
  const desiredHeight = Math.max(minCellDimension, Math.ceil(percentile(framePlans.map(plan => plan.correctedHeight), .96) / .84));
  const atlasScale = Math.min(
    1,
    maxCellDimension / Math.max(desiredWidth, desiredHeight),
    maxRuntimeDimension / Math.max(1, desiredWidth * columns),
    maxRuntimeDimension / Math.max(1, desiredHeight * rows)
  );
  const frameWidth = Math.max(minCellDimension, Math.round(desiredWidth * atlasScale));
  const frameHeight = Math.max(minCellDimension, Math.round(desiredHeight * atlasScale));
  const baseline = frameHeight * clamp(footAnchor, .72, .98);
  const centerX = frameWidth * clamp(horizontalAnchor, .2, .8);
  const plans = framePlans.map(plan => {
    const patch = plan.patch || {};
    const patchScale = clamp(Number(patch.scale) || 1, .5, 1.5);
    const scale = plan.correction * atlasScale * patchScale;
    const boundsCenterInSource = plan.bounds.x + plan.bounds.w / 2;
    const boundsBottomInSource = plan.bounds.y + plan.bounds.h;
    const source = sourceRect(plan.sourceFrame || plan.frame, plan.bounds, sourceWidth, sourceHeight);
    const dx = plan.column * frameWidth + centerX - (boundsCenterInSource - source.x) * scale;
    const dy = plan.row * frameHeight + baseline - (boundsBottomInSource - source.y) * scale;
    const offsetX = Number(patch.x) || 0;
    const offsetY = Number(patch.y) || 0;
    return F({...plan, source: F(source), patch: F({scale: patchScale, x: offsetX, y: offsetY, copyFrom: Number.isInteger(Number(patch.copyFrom)) ? Number(patch.copyFrom) : null}), scale, destination: F({x: dx + offsetX, y: dy + offsetY, w: source.w * scale, h: source.h * scale})});
  });
  const outputHeights = plans.map(plan => plan.bounds.h * plan.scale);
  const outputWidths = plans.map(plan => plan.bounds.w * plan.scale);
  const source = sourceMetrics(rig.groups);
  const artDefects = plans.filter(plan => plan.frame.touchesCanvasEdge).map(plan => F({
    row: plan.row,
    column: plan.column,
    direction: plan.direction,
    code: 'ART_DEFECT_REGENERATION_REQUIRED',
    reason: 'source pixels touch the outer canvas; missing artwork cannot be reconstructed deterministically'
  }));
  const suspicious = plans.filter(plan => plan.scaleOutlier || plan.frame.boundaryRatio > .012).map(plan => F({
    row: plan.row,
    column: plan.column,
    direction: plan.direction,
    scaleDelta: plan.rawCorrection - 1,
    feetOffsetPx: (() => {
      const peers = rig.groups[plan.row].map(frame => {
        const bounds = frameBounds(frame);
        return bounds ? bounds.y + bounds.h : null;
      }).filter(Number.isFinite);
      return (plan.bounds.y + plan.bounds.h) - median(peers);
    })(),
    reasons: F([
      ...(plan.scaleOutlier ? ['SCALE_OUTLIER'] : []),
      ...(plan.frame.boundaryRatio > .012 ? ['REGION_BOUNDARY_CONTACT'] : [])
    ])
  }));
  return F({
    version: 'sprite-frame-normalizer-v1.0.0',
    rows,
    columns,
    frameCounts: F(rig.groups.map(group => group.length)),
    directionKeys: F([...(rig.directionKeys || [])]),
    rowMap: rig.rowMap,
    frameWidth,
    frameHeight,
    width: frameWidth * columns,
    height: frameHeight * rows,
    baseline,
    centerX,
    atlasScale,
    plans: F(plans),
    sourceMetrics: F(source),
    outputMetrics: F({
      heightVariation: cv(outputHeights),
      widthVariation: cv(outputWidths),
      visualScaleVariation: cv(outputHeights),
      footAnchorDispersionPx: 0,
      footAnchorDispersion: 0,
      centerDrift: 0,
      clippingFrames: artDefects.length,
      frames: plans.length,
      minOccupancy: Math.min(...plans.map(plan => (plan.bounds.w * plan.scale) * (plan.bounds.h * plan.scale) / Math.max(1, frameWidth * frameHeight))),
      maxOccupancy: Math.max(...plans.map(plan => (plan.bounds.w * plan.scale) * (plan.bounds.h * plan.scale) / Math.max(1, frameWidth * frameHeight)))
    }),
    suspicious: F(suspicious),
    artDefects: F(artDefects),
    safeScalePolicy: F({min: safeScaleMin, max: safeScaleMax, deadZone: scaleDeadZone}),
    footAnchor,
    horizontalAnchor
  });
}

function makeCanvas(root, width, height) {
  const canvas = root.document?.createElement?.('canvas');
  if (!canvas) throw new Error('SPRITE_NORMALIZER_CANVAS_REQUIRED');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function putPixels(root, canvas, data, width, height) {
  const context = canvas.getContext('2d', {willReadFrequently: true});
  const image = context.createImageData(width, height);
  image.data.set(data);
  context.putImageData(image, 0, 0);
}

export function normalizeSpriteFrameGroups(root, foreground, rig, options = {}) {
  if (!foreground?.cleanedData) throw new Error('SPRITE_NORMALIZER_FOREGROUND_REQUIRED');
  const plan = planSpriteFrameNormalization(rig, {
    ...options,
    sourceWidth: foreground.width,
    sourceHeight: foreground.height
  });
  const source = makeCanvas(root, foreground.width, foreground.height);
  putPixels(root, source, foreground.cleanedData, foreground.width, foreground.height);
  const output = makeCanvas(root, plan.width, plan.height);
  const context = output.getContext('2d', {willReadFrequently: true});
  context.clearRect(0, 0, output.width, output.height);
  context.imageSmoothingEnabled = options.imageSmoothing !== false;
  context.imageSmoothingQuality = 'high';
  for (const frame of plan.plans) {
    const sourceRect = frame.source;
    const destination = frame.destination;
    context.drawImage(
      source,
      sourceRect.x,
      sourceRect.y,
      sourceRect.w,
      sourceRect.h,
      destination.x,
      destination.y,
      destination.w,
      destination.h
    );
  }
  return F({canvas: output, sourceCanvas: source, plan, ...plan});
}

export const __spriteFrameNormalizerInternals = F({cv, frameBounds, percentile, sourceMetrics, spread});
