/* KELO-INDEX
 * area: CREATORS / ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG COMPRESS LOSSLESS PALETTE QUALITY GATE PIXEL EXACT
 * purpose: reduce PNG byte size before asset-sheet compilation while proving decoded pixels remain identical
 * public-api: optimizePngLossless(), decodePngRgba(), encodeRgbaPng()
 * state-owned: none; pure byte transformation + audit metadata
 * online: N/A; creator/build-time capability only
 * reuse: asset ingest, CI, local creator tooling
 * do-not: resize, resample, mutate source geometry, or accept a candidate that fails pixel equality
 */

import zlib from 'node:zlib';
import {evaluatePixelFidelity, judgePixelFidelity} from './png-quality-agent.mjs';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const COLOR_CHANNELS = new Map([[0, 1], [2, 3], [3, 1], [4, 2], [6, 4]]);
const PALETTE_BLOCKERS = new Set(['bKGD', 'hIST', 'sBIT']);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const value of buffer) c = CRC_TABLE[(c ^ value) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.allocUnsafe(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function parseChunks(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('PNG_SPACE_INVALID_SIGNATURE');
  }
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error(`PNG_SPACE_TRUNCATED_CHUNK:${type}`);
    const data = buffer.subarray(dataStart, dataEnd);
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    const actualCrc = crc32(Buffer.concat([Buffer.from(type, 'ascii'), data]));
    if (expectedCrc !== actualCrc) throw new Error(`PNG_SPACE_CRC_MISMATCH:${type}`);
    chunks.push({type, data:Buffer.from(data)});
    offset = dataEnd + 4;
    if (type === 'IEND') break;
  }
  if (!chunks.length || chunks[0].type !== 'IHDR' || !chunks.some(chunk => chunk.type === 'IDAT')) {
    throw new Error('PNG_SPACE_MISSING_REQUIRED_CHUNK');
  }
  return chunks;
}

function readIhdr(chunks) {
  const data = chunks.find(chunk => chunk.type === 'IHDR')?.data;
  if (!data || data.length !== 13) throw new Error('PNG_SPACE_INVALID_IHDR');
  return {
    width:data.readUInt32BE(0),
    height:data.readUInt32BE(4),
    bitDepth:data[8],
    colorType:data[9],
    compression:data[10],
    filter:data[11],
    interlace:data[12]
  };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
}

function assertSupported(ihdr) {
  if (ihdr.bitDepth !== 8) throw new Error(`PNG_SPACE_UNSUPPORTED_BIT_DEPTH:${ihdr.bitDepth}`);
  if (ihdr.interlace !== 0) throw new Error('PNG_SPACE_UNSUPPORTED_INTERLACE');
  const channels = COLOR_CHANNELS.get(ihdr.colorType);
  if (!channels) throw new Error(`PNG_SPACE_UNSUPPORTED_COLOR_TYPE:${ihdr.colorType}`);
  if (!ihdr.width || !ihdr.height) throw new Error('PNG_SPACE_INVALID_DIMENSIONS');
  return channels;
}

function unfilterScanlines(inflated, width, height, channels) {
  const rowBytes = width * channels;
  const expected = height * (rowBytes + 1);
  if (inflated.length !== expected) throw new Error(`PNG_SPACE_INFLATE_LENGTH:${inflated.length}:${expected}`);
  const raw = Buffer.alloc(rowBytes * height);
  let read = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[read++];
    if (filter > 4) throw new Error(`PNG_SPACE_UNSUPPORTED_FILTER:${filter}`);
    const rowStart = y * rowBytes;
    const prevStart = rowStart - rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const encoded = inflated[read++];
      const left = x >= channels ? raw[rowStart + x - channels] : 0;
      const up = y ? raw[prevStart + x] : 0;
      const upperLeft = y && x >= channels ? raw[prevStart + x - channels] : 0;
      const predictor = filter === 0 ? 0
        : filter === 1 ? left
        : filter === 2 ? up
        : filter === 3 ? Math.floor((left + up) / 2)
        : paeth(left, up, upperLeft);
      raw[rowStart + x] = (encoded + predictor) & 255;
    }
  }
  return raw;
}

function samplesToRgba(samples, ihdr, chunks) {
  const {width, height, colorType} = ihdr;
  const channels = COLOR_CHANNELS.get(colorType);
  const rgba = Buffer.alloc(width * height * 4);
  const palette = chunks.find(chunk => chunk.type === 'PLTE')?.data || null;
  const transparency = chunks.find(chunk => chunk.type === 'tRNS')?.data || null;
  if (colorType === 3 && (!palette || palette.length < 3)) throw new Error('PNG_SPACE_PALETTE_MISSING');

  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const source = pixel * channels;
    const target = pixel * 4;
    if (colorType === 6) {
      rgba[target] = samples[source];
      rgba[target + 1] = samples[source + 1];
      rgba[target + 2] = samples[source + 2];
      rgba[target + 3] = samples[source + 3];
    } else if (colorType === 2) {
      rgba[target] = samples[source];
      rgba[target + 1] = samples[source + 1];
      rgba[target + 2] = samples[source + 2];
      rgba[target + 3] = 255;
    } else if (colorType === 4) {
      const gray = samples[source];
      rgba[target] = rgba[target + 1] = rgba[target + 2] = gray;
      rgba[target + 3] = samples[source + 1];
    } else if (colorType === 0) {
      const gray = samples[source];
      rgba[target] = rgba[target + 1] = rgba[target + 2] = gray;
      rgba[target + 3] = 255;
    } else {
      const index = samples[source];
      const paletteIndex = index * 3;
      if (paletteIndex + 2 >= palette.length) throw new Error(`PNG_SPACE_PALETTE_INDEX:${index}`);
      rgba[target] = palette[paletteIndex];
      rgba[target + 1] = palette[paletteIndex + 1];
      rgba[target + 2] = palette[paletteIndex + 2];
      rgba[target + 3] = transparency?.[index] ?? 255;
    }
  }
  return rgba;
}

export function decodePngRgba(buffer) {
  const chunks = parseChunks(buffer);
  const ihdr = readIhdr(chunks);
  const channels = assertSupported(ihdr);
  const compressed = Buffer.concat(chunks.filter(chunk => chunk.type === 'IDAT').map(chunk => chunk.data));
  const samples = unfilterScanlines(zlib.inflateSync(compressed), ihdr.width, ihdr.height, channels);
  const rgba = samplesToRgba(samples, ihdr, chunks);
  return {chunks, ihdr, channels, samples, rgba};
}

function predictorForFilter(filter, left, up, upperLeft) {
  return filter === 0 ? 0
    : filter === 1 ? left
    : filter === 2 ? up
    : filter === 3 ? Math.floor((left + up) / 2)
    : paeth(left, up, upperLeft);
}

function filteredRow(samples, rowStart, rowBytes, channels, y, filter) {
  const output = Buffer.allocUnsafe(rowBytes);
  const prevStart = rowStart - rowBytes;
  let cost = 0;
  for (let x = 0; x < rowBytes; x += 1) {
    const raw = samples[rowStart + x];
    const left = x >= channels ? samples[rowStart + x - channels] : 0;
    const up = y ? samples[prevStart + x] : 0;
    const upperLeft = y && x >= channels ? samples[prevStart + x - channels] : 0;
    const value = (raw - predictorForFilter(filter, left, up, upperLeft) + 256) & 255;
    output[x] = value;
    cost += Math.min(value, 256 - value);
  }
  return {output, cost};
}

function filterScanlines(samples, width, height, channels, strategy = 'adaptive') {
  const rowBytes = width * channels;
  const result = Buffer.allocUnsafe(height * (rowBytes + 1));
  let write = 0;
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes;
    let selected;
    if (strategy === 'adaptive') {
      for (let filter = 0; filter <= 4; filter += 1) {
        const candidate = filteredRow(samples, rowStart, rowBytes, channels, y, filter);
        if (!selected || candidate.cost < selected.cost) selected = {...candidate, filter};
      }
    } else {
      const filter = Number(strategy);
      selected = {...filteredRow(samples, rowStart, rowBytes, channels, y, filter), filter};
    }
    result[write++] = selected.filter;
    selected.output.copy(result, write);
    write += rowBytes;
  }
  return result;
}

function rebuildWithIdat(chunks, compressed) {
  const output = [PNG_SIGNATURE];
  let inserted = false;
  for (const chunk of chunks) {
    if (chunk.type === 'IDAT') {
      if (!inserted) {
        output.push(makeChunk('IDAT', compressed));
        inserted = true;
      }
      continue;
    }
    output.push(makeChunk(chunk.type, chunk.data));
  }
  return Buffer.concat(output);
}

function makeIhdr({width, height, bitDepth = 8, colorType, compression = 0, filter = 0, interlace = 0}) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = bitDepth;
  data[9] = colorType;
  data[10] = compression;
  data[11] = filter;
  data[12] = interlace;
  return data;
}

function buildFreshPng({ihdr, preIdat = [], idat, postIdat = []}) {
  return Buffer.concat([
    PNG_SIGNATURE,
    makeChunk('IHDR', makeIhdr(ihdr)),
    ...preIdat.map(chunk => makeChunk(chunk.type, chunk.data)),
    makeChunk('IDAT', idat),
    ...postIdat.map(chunk => makeChunk(chunk.type, chunk.data)),
    makeChunk('IEND')
  ]);
}

function paletteRepresentation(decoded) {
  if (decoded.ihdr.colorType === 3) return null;
  if (decoded.chunks.some(chunk => PALETTE_BLOCKERS.has(chunk.type))) return null;

  const map = new Map();
  const colors = [];
  const indexes = Buffer.alloc(decoded.ihdr.width * decoded.ihdr.height);
  const rgba = decoded.rgba;

  for (let pixel = 0; pixel < indexes.length; pixel += 1) {
    const offset = pixel * 4;
    const key = ((((rgba[offset] << 24) >>> 0) | (rgba[offset + 1] << 16) | (rgba[offset + 2] << 8) | rgba[offset + 3]) >>> 0);
    let index = map.get(key);
    if (index === undefined) {
      if (colors.length >= 256) return null;
      index = colors.length;
      map.set(key, index);
      colors.push([rgba[offset], rgba[offset + 1], rgba[offset + 2], rgba[offset + 3]]);
    }
    indexes[pixel] = index;
  }

  const plte = Buffer.alloc(colors.length * 3);
  let lastTransparent = -1;
  colors.forEach((color, index) => {
    plte[index * 3] = color[0];
    plte[index * 3 + 1] = color[1];
    plte[index * 3 + 2] = color[2];
    if (color[3] !== 255) lastTransparent = index;
  });
  const trns = lastTransparent >= 0 ? Buffer.from(colors.slice(0, lastTransparent + 1).map(color => color[3])) : null;

  const firstIdat = decoded.chunks.findIndex(chunk => chunk.type === 'IDAT');
  let lastIdat = firstIdat;
  for (let index = firstIdat + 1; index < decoded.chunks.length; index += 1) {
    if (decoded.chunks[index].type === 'IDAT') lastIdat = index;
  }
  const excluded = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']);
  const preIdat = decoded.chunks.slice(1, firstIdat).filter(chunk => !excluded.has(chunk.type));
  const postIdat = decoded.chunks.slice(lastIdat + 1).filter(chunk => !excluded.has(chunk.type));
  return {indexes, plte, trns, preIdat, postIdat, colorCount:colors.length};
}

function palettePng(decoded, representation, filterStrategy, zlibOptions) {
  const filtered = filterScanlines(
    representation.indexes,
    decoded.ihdr.width,
    decoded.ihdr.height,
    1,
    filterStrategy
  );
  const compressed = zlib.deflateSync(filtered, zlibOptions);
  const pre = [...representation.preIdat, {type:'PLTE', data:representation.plte}];
  if (representation.trns) pre.push({type:'tRNS', data:representation.trns});
  return buildFreshPng({
    ihdr:{...decoded.ihdr, bitDepth:8, colorType:3},
    preIdat:pre,
    idat:compressed,
    postIdat:representation.postIdat
  });
}

function candidateRecord(kind, label, buffer, original) {
  try {
    const decoded = decodePngRgba(buffer);
    const quality = evaluatePixelFidelity(original.rgba, decoded.rgba, original.ihdr.width, original.ihdr.height);
    const verdict = judgePixelFidelity(quality, 'strict');
    return {
      kind,
      label,
      buffer,
      bytes:buffer.length,
      quality,
      verdict,
      accepted:verdict.pass,
      qualityScore:verdict.score
    };
  } catch (error) {
    return {
      kind,
      label,
      buffer,
      bytes:buffer.length,
      quality:{comparable:false, exactPixels:false, changedPixels:null, maxRgbDelta:null},
      accepted:false,
      qualityScore:0,
      error:String(error?.message || error)
    };
  }
}

function zlibProfiles() {
  return [
    {name:'default-l6', options:{level:6, strategy:zlib.constants.Z_DEFAULT_STRATEGY}},
    {name:'default-l9', options:{level:9, strategy:zlib.constants.Z_DEFAULT_STRATEGY}},
    {name:'filtered-l9', options:{level:9, strategy:zlib.constants.Z_FILTERED}},
    {name:'rle-l9', options:{level:9, strategy:zlib.constants.Z_RLE}}
  ];
}

export function optimizePngLossless(buffer, options = {}) {
  const originalBytes = buffer.length;
  let decoded;
  try {
    decoded = decodePngRgba(buffer);
  } catch (error) {
    return {
      buffer,
      report:{
        status:'skipped',
        reason:String(error?.message || error),
        originalBytes,
        optimizedBytes:originalBytes,
        savedBytes:0,
        savedPercent:0,
        exactPixels:true,
        qualityScore:1,
        candidates:[]
      }
    };
  }

  const filterStrategies = options.filterStrategies || ['adaptive', 0, 1, 2, 3, 4];
  const candidates = [candidateRecord('original', 'original', buffer, decoded)];
  const profiles = zlibProfiles();

  for (const filterStrategy of filterStrategies) {
    const filtered = filterScanlines(decoded.samples, decoded.ihdr.width, decoded.ihdr.height, decoded.channels, filterStrategy);
    for (const profile of profiles) {
      const compressed = zlib.deflateSync(filtered, profile.options);
      const candidate = rebuildWithIdat(decoded.chunks, compressed);
      candidates.push(candidateRecord(
        'refilter',
        `refilter:${filterStrategy}:${profile.name}`,
        candidate,
        decoded
      ));
    }
  }

  const palette = options.disablePalette === true ? null : paletteRepresentation(decoded);
  if (palette) {
    for (const filterStrategy of ['adaptive', 0, 1, 2, 3, 4]) {
      for (const profile of profiles) {
        const candidate = palettePng(decoded, palette, filterStrategy, profile.options);
        candidates.push(candidateRecord(
          'exact-palette',
          `palette:${palette.colorCount}:${filterStrategy}:${profile.name}`,
          candidate,
          decoded
        ));
      }
    }
  }

  const accepted = candidates.filter(candidate => candidate.accepted);
  accepted.sort((a, b) => a.bytes - b.bytes || a.label.localeCompare(b.label));
  const winner = accepted[0] || candidates[0];
  const savedBytes = Math.max(0, originalBytes - winner.bytes);
  const savedPercent = originalBytes ? (savedBytes / originalBytes) * 100 : 0;

  return {
    buffer:winner.buffer,
    report:{
      status:winner.bytes < originalBytes ? 'optimized' : 'unchanged',
      originalBytes,
      optimizedBytes:winner.bytes,
      savedBytes,
      savedPercent:Number(savedPercent.toFixed(3)),
      exactPixels:winner.quality.exactPixels,
      qualityScore:winner.qualityScore,
      winner:{kind:winner.kind, label:winner.label, bytes:winner.bytes},
      source:{width:decoded.ihdr.width, height:decoded.ihdr.height, colorType:decoded.ihdr.colorType, bitDepth:decoded.ihdr.bitDepth},
      paletteCandidate:palette ? {exactColors:palette.colorCount} : null,
      candidates:candidates.map(candidate => ({
        kind:candidate.kind,
        label:candidate.label,
        bytes:candidate.bytes,
        accepted:candidate.accepted,
        exactPixels:candidate.quality.exactPixels,
        changedPixels:candidate.quality.changedPixels,
        maxRgbDelta:candidate.quality.maxRgbDelta,
        error:candidate.error || null
      }))
    }
  };
}

export function encodeRgbaPng(rgba, width, height, {level = 6, filterStrategy = 0} = {}) {
  if (!rgba || rgba.length !== width * height * 4) throw new Error('PNG_SPACE_RGBA_LENGTH');
  const samples = Buffer.from(rgba);
  const filtered = filterScanlines(samples, width, height, 4, filterStrategy);
  const idat = zlib.deflateSync(filtered, {level});
  return buildFreshPng({
    ihdr:{width, height, bitDepth:8, colorType:6, compression:0, filter:0, interlace:0},
    idat
  });
}
