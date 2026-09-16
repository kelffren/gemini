/* KELO-INDEX
 * area: BUILD / CREATOR ASSET BUDGET
 * owner: Kelo Creator Asset Bridge
 * keys: ATLAS SPACE OCCUPANCY TRIM REPACK SOURCE RECT VISUAL BOUNDS
 * purpose: measure atlas geometry waste and conservative repack opportunity without changing sourceRects or runtime manifests
 * public-api: CLI report
 * state-owned: report files only
 * online: N/A; build-time observability
 * do-not: rewrite atlas bytes, sourceRects, anchors or runtime manifests
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argument = (name, fallback = null) => {
  const token = args.find(value => value.startsWith(`--${name}=`));
  return token ? token.slice(name.length + 3) : fallback;
};

const manifestPath = path.resolve(argument('manifest', 'src/environment/generated/forest-plaza-tileset-v2-manifest.js'));
const reportDir = path.resolve(argument('report', 'dist/asset-atlas-space-audit'));
const padding = Math.max(0, Math.round(Number(argument('padding', '2')) || 0));

if (!fs.existsSync(manifestPath)) {
  console.error(`ASSET_ATLAS_SPACE_MANIFEST_NOT_FOUND — ${manifestPath}`);
  process.exit(2);
}

function parseManifest(file) {
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (raw.startsWith('{')) return JSON.parse(raw);
  const equals = raw.indexOf('=');
  if (equals < 0) throw new Error('ASSET_ATLAS_SPACE_MANIFEST_ASSIGNMENT_NOT_FOUND');
  let json = raw.slice(equals + 1).trim();
  if (json.endsWith(';')) json = json.slice(0, -1);
  return JSON.parse(json);
}

function clampInt(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function rectFromFrame(frame) {
  const rect = frame?.sourceRect || frame?.frameRect;
  if (!rect) return null;
  return {
    x:clampInt(rect.x ?? rect.sx),
    y:clampInt(rect.y ?? rect.sy),
    w:clampInt(rect.w),
    h:clampInt(rect.h)
  };
}

function visualRect(frame, source) {
  const bounds = frame?.visualBounds;
  if (!bounds) return {...source};
  const x = clampInt(bounds.x), y = clampInt(bounds.y);
  const w = Math.max(1, Math.min(source.w - x, clampInt(bounds.w)));
  const h = Math.max(1, Math.min(source.h - y, clampInt(bounds.h)));
  return {x, y, w, h};
}

function unionPixels(rects, width, height) {
  const area = width * height;
  if (area > 20_000_000) return null;
  const bitmap = new Uint8Array(area);
  let count = 0;
  for (const rect of rects) {
    const right = Math.min(width, rect.x + rect.w);
    const bottom = Math.min(height, rect.y + rect.h);
    for (let y = Math.max(0, rect.y); y < bottom; y += 1) {
      const row = y * width;
      for (let x = Math.max(0, rect.x); x < right; x += 1) {
        const index = row + x;
        if (!bitmap[index]) { bitmap[index] = 1; count += 1; }
      }
    }
  }
  return count;
}

function shelfPack(rects, targetWidth, gap) {
  const ordered = rects.slice().sort((a, b) => b.h - a.h || b.w - a.w);
  let x = gap, y = gap, rowHeight = 0, usedWidth = 0;
  for (const rect of ordered) {
    const w = rect.w + gap, h = rect.h + gap;
    if (w + gap > targetWidth) return null;
    if (x + w > targetWidth) {
      y += rowHeight;
      x = gap;
      rowHeight = 0;
    }
    x += w;
    rowHeight = Math.max(rowHeight, h);
    usedWidth = Math.max(usedWidth, x + gap);
  }
  const usedHeight = y + rowHeight + gap;
  return {width:Math.min(targetWidth, usedWidth), height:usedHeight, area:Math.min(targetWidth, usedWidth) * usedHeight};
}

function bestShelfPack(rects, originalWidth, gap) {
  const maxWidth = Math.max(...rects.map(rect => rect.w + gap * 2));
  const candidates = new Set([maxWidth, originalWidth]);
  for (let width = Math.ceil(maxWidth / 32) * 32; width <= originalWidth; width += 32) candidates.add(width);
  for (const width of [256, 384, 512, 640, 768, 896, 1024, 1280, 1536, 2048, 4096]) {
    if (width >= maxWidth && width <= Math.max(originalWidth, 4096)) candidates.add(width);
  }
  return [...candidates]
    .map(width => shelfPack(rects, width, gap))
    .filter(Boolean)
    .sort((a, b) => a.area - b.area || a.height - b.height)[0] || null;
}

const manifest = parseManifest(manifestPath);
const atlas = manifest.atlas || {};
const width = clampInt(atlas.width || manifest.source?.width);
const height = clampInt(atlas.height || manifest.source?.height);
if (!width || !height) throw new Error('ASSET_ATLAS_SPACE_DIMENSIONS_INVALID');

const framesObject = atlas.frames || {};
const frames = Object.entries(framesObject).map(([id, frame]) => {
  const sourceRect = rectFromFrame(frame);
  if (!sourceRect || !sourceRect.w || !sourceRect.h) return null;
  const visual = visualRect(frame, sourceRect);
  return {id, sourceRect, visualBounds:visual, sourceArea:sourceRect.w * sourceRect.h, visualArea:visual.w * visual.h};
}).filter(Boolean);

if (!frames.length) throw new Error('ASSET_ATLAS_SPACE_NO_FRAMES');

const atlasArea = width * height;
const sourceAreaSum = frames.reduce((sum, frame) => sum + frame.sourceArea, 0);
const visualAreaSum = frames.reduce((sum, frame) => sum + frame.visualArea, 0);
const unionArea = unionPixels(frames.map(frame => frame.sourceRect), width, height);
const pack = bestShelfPack(frames.map(frame => ({w:frame.visualBounds.w, h:frame.visualBounds.h})), width, padding);
const transparentFraction = Number(manifest.source?.background?.transparentFraction);

const report = {
  version:'kelo-asset-atlas-space-audit-v1',
  generatedAt:new Date().toISOString(),
  manifest:path.relative(process.cwd(), manifestPath).replaceAll('\\','/'),
  atlas:{id:atlas.id || null,width,height,area:atlasArea,frameCount:frames.length,transparentFraction:Number.isFinite(transparentFraction) ? transparentFraction : null},
  geometry:{
    sourceRectAreaSum:sourceAreaSum,
    sourceRectAreaRatio:Number((sourceAreaSum / atlasArea).toFixed(6)),
    sourceRectUnionArea:unionArea,
    sourceRectUnionRatio:unionArea == null ? null : Number((unionArea / atlasArea).toFixed(6)),
    visualBoundsAreaSum:visualAreaSum,
    visualBoundsAreaRatio:Number((visualAreaSum / atlasArea).toFixed(6)),
    withinFrameTrimOpportunityPercent:sourceAreaSum ? Number((((sourceAreaSum - visualAreaSum) / sourceAreaSum) * 100).toFixed(3)) : 0
  },
  conservativeShelfPack:pack ? {
    padding,
    width:pack.width,
    height:pack.height,
    area:pack.area,
    areaRatioVsCurrent:Number((pack.area / atlasArea).toFixed(6)),
    estimatedAreaSavingPercent:Number((((atlasArea - pack.area) / atlasArea) * 100).toFixed(3)),
    currentRgbaBaselineBytes:atlasArea * 4,
    packedRgbaBaselineBytes:pack.area * 4
  } : null,
  caveats:[
    'Shelf pack is a conservative planning heuristic, not a publishable atlas.',
    'A real repack must remap sourceRects and preserve orig/trim/anchor/animation metadata.',
    'Transparent-pixel fraction is evidence, not automatically recoverable area.',
    'No runtime or source manifest is modified by this audit.'
  ],
  frames:frames.map(frame => ({id:frame.id,sourceRect:frame.sourceRect,visualBounds:frame.visualBounds,sourceArea:frame.sourceArea,visualArea:frame.visualArea,trimOpportunityPercent:Number((((frame.sourceArea-frame.visualArea)/frame.sourceArea)*100).toFixed(3))}))
};

fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
const packText = report.conservativeShelfPack ? `${report.conservativeShelfPack.width}×${report.conservativeShelfPack.height} (${report.conservativeShelfPack.estimatedAreaSavingPercent.toFixed(2)}% less area)` : 'n/a';
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kelo Atlas Space Audit</title><style>body{font:14px system-ui;background:#101216;color:#f5f7fb;padding:24px;max-width:960px;margin:auto}strong{color:#76e3a3}code{color:#a9c7ff}</style><h1>Atlas Space Audit</h1><p><code>${report.manifest}</code></p><p>Atlas ${width}×${height}, ${frames.length} frames. SourceRect union: <strong>${unionArea == null ? 'n/a' : (report.geometry.sourceRectUnionRatio*100).toFixed(2)+'%'}</strong>. Visual bounds: <strong>${(report.geometry.visualBoundsAreaRatio*100).toFixed(2)}%</strong> of atlas area.</p><p>Within-frame trim opportunity: <strong>${report.geometry.withinFrameTrimOpportunityPercent.toFixed(2)}%</strong>. Conservative shelf-pack planning result: <strong>${packText}</strong>.</p><p>This is diagnostic only. No atlas, sourceRect or runtime manifest was changed.</p>`;
fs.writeFileSync(path.join(reportDir,'index.html'),html);
console.log(`ASSET_ATLAS_SPACE_AUDIT_OK frames=${frames.length} atlas=${width}x${height} union=${unionArea == null ? 'n/a' : (report.geometry.sourceRectUnionRatio*100).toFixed(2)+'%'} visual=${(report.geometry.visualBoundsAreaRatio*100).toFixed(2)}% pack=${packText}`);
