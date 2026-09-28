// Generates Resonance's plain placeholder icons and splash screens.
// Zero dependencies: writes PNGs directly with node:zlib.
// Run: node script/placeholder-icons.mjs
// Icons: a ground-coloured ring on ink. Splashes: a small ink ring on ground.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(import.meta.dirname, "..", "client", "public");
const INK = [0x15, 0x19, 0x1c];
const GROUND = [0xf3, 0xf4, 0xf1];

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// Draws a ring of the given radius/thickness (fractions of min(w,h)) centred on the canvas.
function ringPng(w, h, bg, fg, radius, thickness) {
  const m = Math.min(w, h);
  const r = radius * m;
  const half = (thickness * m) / 2;
  const cx = w / 2;
  const cy = h / 2;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const d = Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r);
      const a = Math.max(0, Math.min(1, half - d + 0.5)); // 1px anti-aliased edge
      for (let i = 0; i < 3; i++) raw[o++] = Math.round(bg[i] + (fg[i] - bg[i]) * a);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const icon = (size, radius = 0.28) => ringPng(size, size, INK, GROUND, radius, 0.07);

// ICO wrapping a single 32x32 PNG.
function ico(png) {
  const header = Buffer.from([0, 0, 1, 0, 1, 0]);
  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, entry, png]);
}

const files = {};
for (const s of [72, 96, 128, 144, 152, 192, 384, 512]) files[`icon-${s}x${s}.png`] = icon(s);
files["icon-maskable-512.png"] = icon(512, 0.2); // stays inside the maskable safe zone
files["apple-touch-icon.png"] = icon(180);
files["favicon.ico"] = ico(icon(32));
for (const [w, h] of [[750, 1334], [828, 1792], [1125, 2436], [1242, 2688], [1668, 2388], [2048, 2732]]) {
  files[`splash-${w}x${h}.png`] = ringPng(w, h, GROUND, INK, 0.08, 0.015);
}

for (const [name, buf] of Object.entries(files)) {
  writeFileSync(join(OUT, name), buf);
  console.log(`${name}  ${buf.length} bytes`);
}
