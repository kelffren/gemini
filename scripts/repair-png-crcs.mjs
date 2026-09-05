import fs from 'node:fs';
import {crc32} from './png-validation-core.mjs';

const file = process.argv[2];
if (!file) throw new Error('usage: node scripts/repair-png-crcs.mjs <png>');
const png = fs.readFileSync(file);
const signature = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
if (!png.subarray(0, 8).equals(signature)) throw new Error(`${file}: invalid PNG signature`);
let offset = 8;
let count = 0;
let sawIEND = false;
while (offset < png.length) {
  if (offset + 12 > png.length) throw new Error(`${file}: truncated chunk header at ${offset}`);
  const length = png.readUInt32BE(offset);
  const typeStart = offset + 4;
  const dataStart = offset + 8;
  const crcOffset = dataStart + length;
  const next = crcOffset + 4;
  if (next > png.length) throw new Error(`${file}: truncated chunk payload at ${offset}`);
  const type = png.toString('ascii', typeStart, typeStart + 4);
  png.writeUInt32BE(crc32(png.subarray(typeStart, crcOffset)), crcOffset);
  count += 1;
  offset = next;
  if (type === 'IEND') {
    sawIEND = true;
    break;
  }
}
if (!sawIEND || offset !== png.length) throw new Error(`${file}: structural end invalid; CRC repair refused`);
fs.writeFileSync(file, png);
console.log(`PNG_CRC_REPAIRED file=${file} chunks=${count}`);
