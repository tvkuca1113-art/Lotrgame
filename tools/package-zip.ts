/**
 * Package the production build into a zip, using Node's own zlib so no extra
 * dependency is needed. Run after `npm run build`.
 */
import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const DIST = join(process.cwd(), 'dist');
const OUT_DIR = join(process.cwd(), 'dist-zip');

if (!existsSync(DIST)) {
  console.error('dist/ not found - run "npm run build" first.');
  process.exit(1);
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

interface Entry { name: string; data: Buffer; crc: number; compressed: Buffer; offset: number }

const files = walk(DIST).sort();
const entries: Entry[] = [];
const chunks: Buffer[] = [];
let offset = 0;

function dosTime(d: Date): { time: number; date: number } {
  return {
    time: ((d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))) & 0xffff,
    date: (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff,
  };
}
const stamp = dosTime(new Date());

for (const full of files) {
  const name = relative(DIST, full).split(sep).join('/');
  const data = readFileSync(full);
  const compressed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data) >>> 0;
  const nameBuf = Buffer.from(name, 'utf8');
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(stamp.time, 10);
  local.writeUInt16LE(stamp.date, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  local.writeUInt16LE(0, 28);
  chunks.push(local, nameBuf, compressed);
  entries.push({ name, data, crc, compressed, offset });
  offset += local.length + nameBuf.length + compressed.length;
}

const centralStart = offset;
for (const e of entries) {
  const nameBuf = Buffer.from(e.name, 'utf8');
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(stamp.time, 12);
  central.writeUInt16LE(stamp.date, 14);
  central.writeUInt32LE(e.crc, 16);
  central.writeUInt32LE(e.compressed.length, 20);
  central.writeUInt32LE(e.data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(e.offset, 42);
  chunks.push(central, nameBuf);
  offset += central.length + nameBuf.length;
}

const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(offset - centralStart, 12);
end.writeUInt32LE(centralStart, 16);
chunks.push(end);

mkdirSync(OUT_DIR, { recursive: true });
const name = `the-last-hearth-${new Date().toISOString().slice(0, 10)}.zip`;
const outPath = join(OUT_DIR, name);
const zip = Buffer.concat(chunks);
writeFileSync(outPath, zip);

const raw = entries.reduce((s, e) => s + e.data.length, 0);
console.log(`${outPath}`);
console.log(`${entries.length} files, ${(raw / 1024 / 1024).toFixed(1)} MB -> ${(zip.length / 1024 / 1024).toFixed(1)} MB`);
