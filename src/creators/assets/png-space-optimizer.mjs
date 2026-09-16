/* KELO-INDEX
 * area: CREATORS / ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG COMPRESS LOSSLESS PALETTE BIT DEPTH COLOR TYPE ALPHA DROP QUALITY GATE PIXEL EXACT
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
const ALPHA_DROP_BLOCKERS = new Set(['PLTE', 'tRNS', 'sBIT']);

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
  if (ihdr.interlace !== 0) throw new Error('PNG_SPACE_UNSUPPORTED_INTERLACE');
  const channels = COLOR_CHANNELS.get(ihdr.colorType);
  if (!channels) throw new Error(`PNG_SPACE_UNSUPPORTED_COLOR_TYPE:${ihdr.colorType}`);
  const allowedDepths = (ihdr.colorType === 0 || ihdr.colorType === 3) ? [1, 2, 4, 8] : [8];
  if (!allowedDepths.includes(ihdr.bitDepth)) throw new Error(`PNG_SPACE_UNSUPPORTED_BIT_DEPTH:${ihdr.bitDepth}`);
  if (!ihdr.width || !ihdr.height) throw new Error('PNG_SPACE_INVALID_DIMENSIONS');
  const bitsPerPixel = channels * ihdr.bitDepth;
  return {
    channels,
    rowBytes:Math.ceil((ihdr.width * bitsPerPixel) / 8),
    filterBpp:Math.max(1, Math.ceil(bitsPerPixel / 8))
  };
}

function unfilterByteRows(inflated, rowBytes, height, filterBpp) {
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
      const left = x >= filterBpp ? raw[rowStart + x - filterBpp] : 0;
      const up = y ? raw[prevStart + x] : 0;
      const upperLeft = y && x >= filterBpp ? raw[prevStart + x - filterBpp] : 0;
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

function unpackSubByteRows(packed, width, height, bitDepth, colorType) {
  const rowBytes = Math.ceil((width * bitDepth) / 8);
  const mask = (1 << bitDepth) - 1;
  const samples = Buffer.alloc(width * height);
  let write = 0;
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes;
    for (let x = 0; x < width; x += 1) {
      const bitOffset = x * bitDepth;
      const byte = packed[rowStart + (bitOffset >> 3)];
      const shift = 8 - bitDepth - (bitOffset & 7);
      const value = (byte >> shift) & mask;
      samples[write++] = colorType === 0 ? Math.round((value * 255) / mask) : value;
    }
  }
  return samples;
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
  const layout = assertSupported(ihdr);
  const compressed = Buffer.concat(chunks.filter(chunk => chunk.type === 'IDAT').map(chunk => chunk.data));
  const packedSamples = unfilterByteRows(zlib.inflateSync(compressed), layout.rowBytes, ihdr.height, layout.filterBpp);
  const samples = ihdr.bitDepth < 8
    ? unpackSubByteRows(packedSamples, ihdr.width, ihdr.height, ihdr.bitDepth, ihdr.colorType)
    : packedSamples;
  const rgba = samplesToRgba(samples, ihdr, chunks);
  return {
    chunks,
    ihdr,
    channels:layout.channels,
    rowBytes:layout.rowBytes,
    filterBpp:layout.filterBpp,
    samples,
    packedSamples,
    rgba
  };
}

function predictorForFilter(filter, left, up, upperLeft) {
  return filter === 0 ? 0
    : filter === 1 ? left
    : filter === 2 ? up
    : filter === 3 ? Math.floor((left + up) / 2)
    : paeth(left, up, upperLeft);
}

function filteredRow(samples, rowStart, rowBytes, filterBpp, y, filter) {
  const output = Buffer.allocUnsafe(rowBytes);
  const prevStart = rowStart - rowBytes;
  let cost = 0;
  for (let x = 0; x < rowBytes; x += 1) {
    const raw = samples[rowStart + x];
    const left = x >= filterBpp ? samples[rowStart + x - filterBpp] : 0;
    const up = y ? samples[prevStart + x] : 0;
    const upperLeft = y && x >= filterBpp ? samples[prevStart + x - filterBpp] : 0;
    const value = (raw - predictorForFilter(filter, left, up, upperLeft) + 256) & 255;
    output[x] = value;
    cost += Math.min(value, 256 - value);
  }
  return {output, cost};
}

function filterByteRows(samples, rowBytes, height, filterBpp, strategy = 'adaptive') {
  const result = Buffer.allocUnsafe(height * (rowBytes + 1));
  let write = 0;
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes;
    let selected;
    if (strategy === 'adaptive') {
      for (let filter = 0; filter <= 4; filter += 1) {
        const candidate = filteredRow(samples, rowStart, rowBytes, filterBpp, y, filter);
        if (!selected || candidate.cost < selected.cost) selected = {...candidate, filter};
      }
    } else {
      const filter = Number(strategy);
      selected = {...filteredRow(samples, rowStart, rowBytes, filterBpp, y, filter), filter};
    }
    result[write++] = selected.filter;
    selected.output.copy(result, write);
    write += rowBytes;
  }
  return result;
}

function filterScanlines(samples, width, height, channels, strategy = 'adaptive') {
  return filterByteRows(samples, width * channels, height, channels, strategy);
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

function chunkPartitions(decoded, excluded, blockers = null) {
  if (blockers && decoded.chunks.some(chunk => blockers.has(chunk.type))) return null;
  const firstIdat = decoded.chunks.findIndex(chunk => chunk.type === 'IDAT');
  let lastIdat = firstIdat;
  for (let index = firstIdat + 1; index < decoded.chunks.length; index += 1) {
    if (decoded.chunks[index].type === 'IDAT') lastIdat = index;
  }
  const preIdat = decoded.chunks.slice(1, firstIdat).filter(chunk => !excluded.has(chunk.type));
  const postIdat = decoded.chunks.slice(lastIdat + 1).filter(chunk => !excluded.has(chunk.type));
  return {preIdat, postIdat};
}

function paletteRepresentation(decoded) {
  if (decoded.ihdr.colorType === 3) return null;
  const partitions = chunkPartitions(decoded, new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']), PALETTE_BLOCKERS);
  if (!partitions) return null;

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
  const bitDepth = colors.length <= 2 ? 1 : colors.length <= 4 ? 2 : colors.length <= 16 ? 4 : 8;
  return {...partitions, indexes, plte, trns, colorCount:colors.length, bitDepth};
}

function packIndexedRows(indexes, width, height, bitDepth) {
  if (bitDepth === 8) return Buffer.from(indexes);
  const rowBytes = Math.ceil((width * bitDepth) / 8);
  const packed = Buffer.alloc(rowBytes * height);
  const mask = (1 << bitDepth) - 1;
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes;
    for (let x = 0; x < width; x += 1) {
      const value = indexes[y * width + x] & mask;
      const bitOffset = x * bitDepth;
      const byteOffset = rowStart + (bitOffset >> 3);
      const shift = 8 - bitDepth - (bitOffset & 7);
      packed[byteOffset] |= value << shift;
    }
  }
  return packed;
}

function palettePng(decoded, representation, filterStrategy, zlibOptions) {
  const packed = packIndexedRows(representation.indexes, decoded.ihdr.width, decoded.ihdr.height, representation.bitDepth);
  const rowBytes = Math.ceil((decoded.ihdr.width * representation.bitDepth) / 8);
  const filtered = filterByteRows(packed, rowBytes, decoded.ihdr.height, 1, filterStrategy);
  const compressed = zlib.deflateSync(filtered, zlibOptions);
  const pre = [...representation.preIdat, {type:'PLTE', data:representation.plte}];
  if (representation.trns) pre.push({type:'tRNS', data:representation.trns});
  return buildFreshPng({
    ihdr:{...decoded.ihdr, bitDepth:representation.bitDepth, colorType:3},
    preIdat:pre,
    idat:compressed,
    postIdat:representation.postIdat
  });
}

function alphaDropRepresentation(decoded) {
  if (![4, 6].includes(decoded.ihdr.colorType) || decoded.ihdr.bitDepth !== 8) return null;
  if (decoded.chunks.some(chunk => ALPHA_DROP_BLOCKERS.has(chunk.type))) return null;
  const rgba = decoded.rgba;
  for (let offset = 3; offset < rgba.length; offset += 4) if (rgba[offset] !== 255) return null;

  const targetColorType = decoded.ihdr.colorType === 6 ? 2 : 0;
  const targetChannels = targetColorType === 2 ? 3 : 1;
  const samples = Buffer.alloc(decoded.ihdr.width * decoded.ihdr.height * targetChannels);
  let write = 0;
  for (let offset = 0; offset < rgba.length; offset += 4) {
    if (targetColorType === 2) {
      samples[write++] = rgba[offset];
      samples[write++] = rgba[offset + 1];
      samples[write++] = rgba[offset + 2];
    } else {
      samples[write++] = rgba[offset];
    }
  }
  const partitions = chunkPartitions(decoded, new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND']));
  return partitions ? {...partitions, samples, targetColorType, targetChannels} : null;
}

function alphaDropPng(decoded, representation, filterStrategy, zlibOptions) {
  const filtered = filterScanlines(
    representation.samples,
    decoded.ihdr.width,
    decoded.ihdr.height,
    representation.targetChannels,
    filterStrategy
  );
  const compressed = zlib.deflateSync(filtered, zlibOptions);
  return buildFreshPng({
    ihdr:{...decoded.ihdr, bitDepth:8, colorType:representation.targetColorType},
    preIdat:representation.preIdat,
    idat:compressed,
    postIdat:representation.postIdat
  });
}

function candidateRecord(kind, label, buffer) {
  return {
    kind,
    label,
    buffer,
    bytes:buffer.length,
    tested:false,
    accepted:null,
    quality:null,
    qualityScore:null,
    error:null
  };
}

function validateCandidate(candidate, original) {
  try {
    const decoded = decodePngRgba(candidate.buffer);
    const quality = evaluatePixelFidelity(original.rgba, decoded.rgba, original.ihdr.width, original.ihdr.height);
    const verdict = judgePixelFidelity(quality, 'strict');
    return {
      ...candidate,
      tested:true,
      quality,
      verdict,
      accepted:verdict.pass,
      qualityScore:verdict.score
    };
  } catch (error) {
    return {
      ...candidate,
      tested:true,
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
        exactPixels:null,
        qualityScore:null,
        candidates:[]
      }
    };
  }

  const filterStrategies = options.filterStrategies || ['adaptive', 0, 1, 2, 3, 4];
  const candidates = [candidateRecord('original', 'original', buffer)];
  const profiles = zlibProfiles();

  for (const filterStrategy of filterStrategies) {
    const filtered = filterByteRows(decoded.packedSamples, decoded.rowBytes, decoded.ihdr.height, decoded.filterBpp, filterStrategy);
    for (const profile of profiles) {
      const compressed = zlib.deflateSync(filtered, profile.options);
      const candidate = rebuildWithIdat(decoded.chunks, compressed);
      candidates.push(candidateRecord(
        'refilter',
        `refilter:${filterStrategy}:${profile.name}`,
        candidate
      ));
    }
  }

  const alphaDrop = options.disableColorReduction === true ? null : alphaDropRepresentation(decoded);
  if (alphaDrop) {
    for (const filterStrategy of filterStrategies) {
      for (const profile of profiles) {
        const candidate = alphaDropPng(decoded, alphaDrop, filterStrategy, profile.options);
        candidates.push(candidateRecord(
          'exact-alpha-drop',
          `alpha-drop:${decoded.ihdr.colorType}->${alphaDrop.targetColorType}:${filterStrategy}:${profile.name}`,
          candidate
        ));
      }
    }
  }

  const palette = options.disablePalette === true ? null : paletteRepresentation(decoded);
  if (palette) {
    const paletteFilters = options.paletteFilterStrategies || filterStrategies;
    for (const filterStrategy of paletteFilters) {
      for (const profile of profiles) {
        const candidate = palettePng(decoded, palette, filterStrategy, profile.options);
        candidates.push(candidateRecord(
          'exact-palette',
          `palette:${palette.colorCount}:${palette.bitDepth}b:${filterStrategy}:${profile.name}`,
          candidate
        ));
      }
    }
  }

  const ordered = candidates.slice().sort((a, b) => a.bytes - b.bytes || a.label.localeCompare(b.label));
  let winner = null;
  const validatedByLabel = new Map();
  for (const candidate of ordered) {
    const validated = validateCandidate(candidate, decoded);
    validatedByLabel.set(candidate.label, validated);
    if (validated.accepted) {
      winner = validated;
      break;
    }
  }
  if (!winner) winner = validateCandidate(candidates[0], decoded);

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
      alphaDropCandidate:alphaDrop ? {fromColorType:decoded.ihdr.colorType,toColorType:alphaDrop.targetColorType} : null,
      paletteCandidate:palette ? {exactColors:palette.colorCount,bitDepth:palette.bitDepth} : null,
      candidates:candidates.map(candidate => {
        const validated = validatedByLabel.get(candidate.label);
        return {
          kind:candidate.kind,
          label:candidate.label,
          bytes:candidate.bytes,
          tested:Boolean(validated),
          accepted:validated?.accepted ?? null,
          exactPixels:validated?.quality?.exactPixels ?? null,
          changedPixels:validated?.quality?.changedPixels ?? null,
          maxRgbDelta:validated?.quality?.maxRgbDelta ?? null,
          error:validated?.error || null
        };
      })
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
