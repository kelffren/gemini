/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / FRAME NORMALIZATION
 * owner: lossless frame canvas, scale, center, foot-anchor and Frame Surgery composition
 * keys: SPRITE NORMALIZE CANVAS SCALE CENTER FOOT ANCHOR SURGERY ROTATE MASK OVERLAY CROP CLONE FILL
 * purpose: repack detected frames into runtime atlas and apply reversible per-frame surgery patches
 * public-api: planSpriteFrameNormalization, normalizeSpriteFrameGroups
 * consumes: sprite foreground pixels + resolved sprite rig groups + optional non-destructive frame patches
 * state-owned: none; deterministic pixels/layout -> runtime canvas and metrics
 * online: N/A
 * do-not: detect layouts, assign semantics, persist content or mutate source pixels
 */
import {normalizeSurgeryPatch} from './sprite-frame-surgery-model.mjs';

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

function cropSourceRect(source, crop, width, height) {
  const left = source.w * Number(crop?.left || 0);
  const right = source.w * Number(crop?.right || 0);
  const top = source.h * Number(crop?.top || 0);
  const bottom = source.h * Number(crop?.bottom || 0);
  const x0 = clamp(Math.floor(source.x + left), 0, width - 1);
  const y0 = clamp(Math.floor(source.y + top), 0, height - 1);
  const x1 = clamp(Math.ceil(source.x + source.w - right), x0 + 1, width);
  const y1 = clamp(Math.ceil(source.y + source.h - bottom), y0 + 1, height);
  return {x:x0, y:y0, w:x1-x0, h:y1-y0};
}

function percentile(values, q) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.round(clamp(q) * (sorted.length - 1))];
}
function spread(values) { return values.length ? Math.max(...values) - Math.min(...values) : 0; }

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
    heightVariation: cv(heights), widthVariation: cv(widths), visualScaleVariation: cv(areas.map(Math.sqrt)),
    footAnchorDispersionPx: feetOffsets.length ? Math.max(...feetOffsets) : 0,
    footAnchorDispersion: median(heights) ? mean(feetOffsets) / median(heights) : 0,
    centerDrift: mean(centerOffsets),
    clippingFrames: frames.filter(frame => frame.touchesCanvasEdge || frame.boundaryRatio > .012).length,
    frames: frames.length
  };
}

export function planSpriteFrameNormalization(rig, {
  sourceWidth, sourceHeight, maxRuntimeDimension = 1024, maxCellDimension = 256, minCellDimension = 48,
  safeScaleMin = .84, safeScaleMax = 1.18, scaleDeadZone = .035,
  footAnchor = .92, horizontalAnchor = .5, framePatches = null
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
    const rawPatch = framePatches?.[row * columns + column] || {};
    const patch = normalizeSurgeryPatch(rawPatch);
    const sourceFrame = Number.isInteger(Number(patch.copyFrom)) ? (allFrames[Number(patch.copyFrom)] || frame) : frame;
    const bounds = frameBounds(sourceFrame);
    if (!bounds) continue;
    const rawCorrection = medianHeight / Math.max(1, bounds.h);
    const withinDeadZone = Math.abs(rawCorrection - 1) <= scaleDeadZone;
    const correction = withinDeadZone ? 1 : clamp(rawCorrection, safeScaleMin, safeScaleMax);
    const scaleOutlier = rawCorrection < safeScaleMin || rawCorrection > safeScaleMax;
    framePlans.push({row, column, direction: rig.directionKeys?.[row] || `row${row + 1}`, frame, sourceFrame, patch, bounds,
      correction, rawCorrection, scaleOutlier, correctedWidth: bounds.w * correction, correctedHeight: bounds.h * correction});
  }
  const desiredWidth = Math.max(minCellDimension, Math.ceil(percentile(framePlans.map(plan => plan.correctedWidth), .96) / .82));
  const desiredHeight = Math.max(minCellDimension, Math.ceil(percentile(framePlans.map(plan => plan.correctedHeight), .96) / .84));
  const atlasScale = Math.min(1, maxCellDimension / Math.max(desiredWidth, desiredHeight),
    maxRuntimeDimension / Math.max(1, desiredWidth * columns), maxRuntimeDimension / Math.max(1, desiredHeight * rows));
  const frameWidth = Math.max(minCellDimension, Math.round(desiredWidth * atlasScale));
  const frameHeight = Math.max(minCellDimension, Math.round(desiredHeight * atlasScale));
  const baseline = frameHeight * clamp(footAnchor, .72, .98);
  const centerX = frameWidth * clamp(horizontalAnchor, .2, .8);
  const plans = framePlans.map(plan => {
    const patch = plan.patch;
    const scale = plan.correction * atlasScale * patch.scale;
    const boundsCenterInSource = plan.bounds.x + plan.bounds.w / 2;
    const boundsBottomInSource = plan.bounds.y + plan.bounds.h;
    const uncropped = sourceRect(plan.sourceFrame || plan.frame, plan.bounds, sourceWidth, sourceHeight);
    const source = cropSourceRect(uncropped, patch.crop, sourceWidth, sourceHeight);
    const dx = plan.column * frameWidth + centerX - (boundsCenterInSource - source.x) * scale + patch.x;
    const dy = plan.row * frameHeight + baseline - (boundsBottomInSource - source.y) * scale + patch.y;
    return F({...plan, source: F(source), scale,
      destination: F({x: dx, y: dy, w: source.w * scale, h: source.h * scale}),
      surgery: F({rotation: patch.rotation, erase: patch.erase, restore: patch.restore, clone: patch.clone, fill: patch.fill,
        overlays: patch.overlays, crop: patch.crop, layerVisibility: patch.layerVisibility})});
  });
  const outputHeights = plans.map(plan => plan.bounds.h * plan.scale);
  const outputWidths = plans.map(plan => plan.bounds.w * plan.scale);
  const source = sourceMetrics(rig.groups);
  const artDefects = plans.filter(plan => plan.frame.touchesCanvasEdge && !(plan.patch.overlays?.length)).map(plan => F({
    row: plan.row, column: plan.column, direction: plan.direction, code: 'ART_DEFECT_REGENERATION_REQUIRED',
    reason: 'source pixels touch the outer canvas; add a real replacement/piece or regenerate the missing artwork'
  }));
  const repairedEdgeFrames = plans.filter(plan => plan.frame.touchesCanvasEdge && plan.patch.overlays?.length).map(plan => plan.row * columns + plan.column);
  const suspicious = plans.filter(plan => plan.scaleOutlier || plan.frame.boundaryRatio > .012).map(plan => F({
    row: plan.row, column: plan.column, direction: plan.direction, scaleDelta: plan.rawCorrection - 1,
    feetOffsetPx: (() => {
      const peers = rig.groups[plan.row].map(frame => { const bounds = frameBounds(frame); return bounds ? bounds.y + bounds.h : null; }).filter(Number.isFinite);
      return (plan.bounds.y + plan.bounds.h) - median(peers);
    })(),
    reasons: F([...(plan.scaleOutlier ? ['SCALE_OUTLIER'] : []), ...(plan.frame.boundaryRatio > .012 ? ['REGION_BOUNDARY_CONTACT'] : [])])
  }));
  return F({version: 'sprite-frame-normalizer-v2.0.0-surgery', rows, columns,
    frameCounts: F(rig.groups.map(group => group.length)), directionKeys: F([...(rig.directionKeys || [])]), rowMap: rig.rowMap,
    frameWidth, frameHeight, width: frameWidth * columns, height: frameHeight * rows, baseline, centerX, atlasScale,
    plans: F(plans), sourceMetrics: F(source), outputMetrics: F({heightVariation: cv(outputHeights), widthVariation: cv(outputWidths),
      visualScaleVariation: cv(outputHeights), footAnchorDispersionPx: 0, footAnchorDispersion: 0, centerDrift: 0,
      clippingFrames: artDefects.length, frames: plans.length,
      minOccupancy: Math.min(...plans.map(plan => (plan.bounds.w * plan.scale) * (plan.bounds.h * plan.scale) / Math.max(1, frameWidth * frameHeight))),
      maxOccupancy: Math.max(...plans.map(plan => (plan.bounds.w * plan.scale) * (plan.bounds.h * plan.scale) / Math.max(1, frameWidth * frameHeight))) }),
    suspicious: F(suspicious), artDefects: F(artDefects), repairedEdgeFrames: F(repairedEdgeFrames),
    safeScalePolicy: F({min: safeScaleMin, max: safeScaleMax, deadZone: scaleDeadZone}), footAnchor, horizontalAnchor});
}

function makeCanvas(root, width, height) {
  const canvas = root.document?.createElement?.('canvas');
  if (!canvas) throw new Error('SPRITE_NORMALIZER_CANVAS_REQUIRED');
  canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height)); return canvas;
}
function putPixels(root, canvas, data, width, height) {
  const context = canvas.getContext('2d', {willReadFrequently: true});
  const image = context.createImageData(width, height); image.data.set(data); context.putImageData(image, 0, 0);
}
function drawCirclePath(context, point, radius, width, height) {
  context.beginPath(); context.arc(point.x * width, point.y * height, Math.max(1, radius * Math.min(width, height)), 0, Math.PI * 2); context.closePath();
}
function paintStroke(context, stroke, width, height, operation = 'destination-out') {
  if (!stroke?.points?.length) return;
  context.save(); context.globalCompositeOperation = operation;
  for (const point of stroke.points) { drawCirclePath(context, point, stroke.radius, width, height); context.fill(); }
  context.restore();
}
function restoreStroke(context, base, stroke, width, height) {
  if (!stroke?.points?.length) return;
  context.save();
  for (const point of stroke.points) {
    context.save(); drawCirclePath(context, point, stroke.radius, width, height); context.clip(); context.drawImage(base, 0, 0); context.restore();
  }
  context.restore();
}
function cloneStroke(context, base, stroke, width, height) {
  if (!stroke?.points?.length || !stroke.source) return;
  const radius = Math.max(1, stroke.radius * Math.min(width, height));
  const sx = stroke.source.x * width, sy = stroke.source.y * height;
  for (const point of stroke.points) {
    const tx = point.x * width, ty = point.y * height;
    context.save(); context.beginPath(); context.arc(tx, ty, radius, 0, Math.PI * 2); context.clip();
    context.drawImage(base, tx - sx, ty - sy); context.restore();
  }
}
function smartFillSmallGap(context, stroke, width, height) {
  if (!stroke?.points?.length) return;
  const image = context.getImageData(0, 0, width, height), data = image.data;
  const radius = Math.max(1, Math.round(stroke.radius * Math.min(width, height)));
  for (const point of stroke.points) {
    const cx = Math.round(point.x * width), cy = Math.round(point.y * height);
    for (let y = Math.max(1, cy-radius); y < Math.min(height-1, cy+radius); y++) for (let x = Math.max(1, cx-radius); x < Math.min(width-1, cx+radius); x++) {
      if (Math.hypot(x-cx,y-cy) > radius) continue;
      const i=(y*width+x)*4; if (data[i+3] > 18) continue;
      let best=null, bestD=Infinity;
      for (let oy=-2;oy<=2;oy++) for (let ox=-2;ox<=2;ox++) {
        if (!ox&&!oy) continue; const ni=((y+oy)*width+(x+ox))*4;
        if (data[ni+3] <= 64) continue; const d=ox*ox+oy*oy;
        if (d<bestD){bestD=d;best=[data[ni],data[ni+1],data[ni+2],data[ni+3]];}
      }
      if (best){data[i]=best[0];data[i+1]=best[1];data[i+2]=best[2];data[i+3]=best[3];}
    }
  }
  context.putImageData(image,0,0);
}

function frameSourceForIndex(plan, rig, index, sourceWidth, sourceHeight) {
  const flat = rig.groups.flat(); const frame = flat[index]; const bounds = frameBounds(frame);
  if (!frame || !bounds) return null;
  return sourceRect(frame, bounds, sourceWidth, sourceHeight);
}

function drawOverlay(root, context, overlay, {sourceCanvas, rig, plan, sourceWidth, sourceHeight, frameWidth, frameHeight, imageSmoothing}) {
  let image = overlay.canvas || overlay.image || null;
  let source = null;
  if (!image && Number.isInteger(overlay.sourceFrame)) {
    image = sourceCanvas;
    source = frameSourceForIndex(plan, rig, overlay.sourceFrame, sourceWidth, sourceHeight);
  }
  if (!image) return;
  const imageWidth=image.naturalWidth||image.width||frameWidth, imageHeight=image.naturalHeight||image.height||frameHeight;
  let sx=0, sy=0, sw=imageWidth, sh=imageHeight;
  if (source) { sx=source.x; sy=source.y; sw=source.w; sh=source.h; }
  if (overlay.sourceRect) {
    sx += sw * overlay.sourceRect.x; sy += sh * overlay.sourceRect.y;
    sw *= overlay.sourceRect.w; sh *= overlay.sourceRect.h;
  }
  const targetW = overlay.frameRect ? overlay.frameRect.w * frameWidth * overlay.scale : sw * (frameWidth / Math.max(1, plan.source.w)) * overlay.scale;
  const targetH = overlay.frameRect ? overlay.frameRect.h * frameHeight * overlay.scale : sh * (frameHeight / Math.max(1, plan.source.h)) * overlay.scale;
  const baseX = overlay.frameRect ? (overlay.frameRect.x + overlay.frameRect.w/2) * frameWidth : frameWidth/2;
  const baseY = overlay.frameRect ? (overlay.frameRect.y + overlay.frameRect.h/2) * frameHeight : frameHeight*.92 - targetH/2;
  const cx = baseX + overlay.x, cy = baseY + overlay.y;
  context.save(); context.globalAlpha=overlay.opacity; context.imageSmoothingEnabled=imageSmoothing;
  context.translate(cx,cy); context.rotate(overlay.rotation); context.drawImage(image,sx,sy,sw,sh,-targetW/2,-targetH/2,targetW,targetH); context.restore();
}

function composeFrame(root, sourceCanvas, plan, rig, options) {
  const {frameWidth, frameHeight, sourceWidth, sourceHeight} = options;
  const cell = makeCanvas(root, frameWidth, frameHeight), context=cell.getContext('2d',{willReadFrequently:true});
  context.clearRect(0,0,frameWidth,frameHeight); context.imageSmoothingEnabled=options.imageSmoothing;
  context.imageSmoothingQuality='high';
  const destination = plan.destination;
  const localX = destination.x - plan.column*frameWidth, localY = destination.y - plan.row*frameHeight;
  const cx = localX + destination.w/2, cy = localY + destination.h/2;
  if (plan.patch.layerVisibility?.character !== false) {
    context.save(); context.translate(cx,cy); context.rotate(plan.patch.rotation || 0);
    context.drawImage(sourceCanvas, plan.source.x, plan.source.y, plan.source.w, plan.source.h,
      -destination.w/2, -destination.h/2, destination.w, destination.h); context.restore();
  }
  if (plan.patch.layerVisibility?.pieces !== false) {
    for (const overlay of plan.patch.overlays || []) if (overlay.cutoutOriginal && (overlay.canvas || overlay.image) && overlay.frameRect) {
      const image=overlay.canvas||overlay.image, x=overlay.frameRect.x*frameWidth, y=overlay.frameRect.y*frameHeight, w=overlay.frameRect.w*frameWidth, h=overlay.frameRect.h*frameHeight, iw=image.naturalWidth||image.width||w, ih=image.naturalHeight||image.height||h;
      context.save(); context.globalCompositeOperation='destination-out'; context.drawImage(image,0,0,iw,ih,x,y,w,h); context.restore();
    }
    for (const overlay of plan.patch.overlays || []) drawOverlay(root,context,overlay,{sourceCanvas,rig,plan,sourceWidth,sourceHeight,frameWidth,frameHeight,imageSmoothing:options.imageSmoothing});
  }
  const base = makeCanvas(root,frameWidth,frameHeight); base.getContext('2d').drawImage(cell,0,0);
  if (plan.patch.layerVisibility?.mask !== false) {
    for (const stroke of plan.patch.erase || []) paintStroke(context,stroke,frameWidth,frameHeight,'destination-out');
    for (const stroke of plan.patch.restore || []) restoreStroke(context,base,stroke,frameWidth,frameHeight);
  }
  if (plan.patch.layerVisibility?.patches !== false) {
    for (const stroke of plan.patch.clone || []) cloneStroke(context,base,stroke,frameWidth,frameHeight);
    for (const stroke of plan.patch.fill || []) smartFillSmallGap(context,stroke,frameWidth,frameHeight);
  }
  return cell;
}

export function normalizeSpriteFrameGroups(root, foreground, rig, options = {}) {
  if (!foreground?.cleanedData) throw new Error('SPRITE_NORMALIZER_FOREGROUND_REQUIRED');
  const plan = planSpriteFrameNormalization(rig, {...options, sourceWidth: foreground.width, sourceHeight: foreground.height});
  const source = makeCanvas(root, foreground.width, foreground.height);
  putPixels(root, source, foreground.cleanedData, foreground.width, foreground.height);
  const output = makeCanvas(root, plan.width, plan.height), context=output.getContext('2d',{willReadFrequently:true});
  context.clearRect(0,0,output.width,output.height); context.imageSmoothingEnabled=options.imageSmoothing !== false; context.imageSmoothingQuality='high';
  for (const frame of plan.plans) {
    const cell=composeFrame(root,source,frame,rig,{frameWidth:plan.frameWidth,frameHeight:plan.frameHeight,
      sourceWidth:foreground.width,sourceHeight:foreground.height,imageSmoothing:options.imageSmoothing !== false});
    context.drawImage(cell,frame.column*plan.frameWidth,frame.row*plan.frameHeight);
  }
  return F({canvas: output, sourceCanvas: source, plan, ...plan});
}

export const __spriteFrameNormalizerInternals = F({cv, frameBounds, percentile, sourceMetrics, spread, cropSourceRect,
  paintStroke, restoreStroke, cloneStroke, smartFillSmallGap, composeFrame});
