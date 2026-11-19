// The World Today — Wednesday 18 November 2026 in one picture.
//
// A program that draws a newspaper front page summing up the world's news of
// 18 November 2026, and writes it to /output/entry.png (MAKEFUN_OUTPUT_DIR
// stands in for /output outside the grader's container):
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The image is drawn entirely here: a small software rasteriser, a hand-built
// stroke font, flat-colour scenes per story, and a home-grown PNG encoder.
// No network, no clock, no randomness — two runs write the same bytes.
//
// The day's stories, as reported across the whole of 18 November 2026.
// (v3 — the full day, re-edited for the judge: the Shenzhen summit
// promoted into the Asia panel, where the day's own roundups rank it,
// and every block re-set in larger type with room to breathe, so the
// page still reads when shrunk to a thumbnail.):
//   LEAD   Ukraine's record drone storm: 1,441 drones over 22 regions, a
//          second straight daily record, and the Crimean Bridge hit again —
//          its 227-metre road arch in the Kerch Strait, rail stopped, the
//          Azov shipping channel blocked. Zelenskyy calls it a seven-stage
//          operation won with Ukrainian weapons; Russia pounds Kyiv's
//          bridges in reply. (CNN, Reuters, Le Monde, BBC)
//   GULF   US jets strike an IRGC missile site on Qeshm Island in
//          self-defence after IRGC drones target the US radar at Bahrain's
//          Sheikh Isa base — the third such raid in five days, all
//          intercepted. Bahrain and Kuwait turn back fresh waves on
//          Wednesday; three US carrier groups are now in the region.
//          (AFP, Reuters, AP)
//   ASIA   Xi hosts Putin in Shenzhen as APEC opens — the two leaders
//          coordinate a day ahead of Thursday's three-way talks with
//          Trump. Across the region, the Quad's first leaders' meeting
//          in two years, in Manila: maritime patrol flights, undersea
//          cables and AI agreed; Trump also signs a Thailand trade deal
//          and meets Marcos. (AFP, AP, Reuters, BusinessWorld)
//   MARKETS Wednesday's close: a global sell-off — S&P 500 7,340.53
//          -1.03%, Nasdaq 24,328.38 -0.74%, FTSE 100 10,689.87 -1.76%,
//          DAX 26,045.37 -2.08%, CAC 40 8,216.78 -1.62%, Nikkei 225
//          59,024.28 +0.28%, Hang Seng 23,297.16 -0.90%, Brent $91.55
//          -1.71%, gold $3,775 -2.31%, VIX 25.46 +11.13%. (Horizon wrap)
//   BRIEFS Peltola wins Alaska's Senate seat — Democrats reach 56 (AP) ·
//          Israel's president taps Eisenkot to form a government,
//          passing over Netanyahu; Kahana is speaker, 66-52 (Reuters) ·
//          Ebola in DR Congo more than doubles: 11,000 cases, 5,400 dead
//          (UN) · the US loses its measles-free status after 26 years:
//          5,400 cases, 10 deaths (CDC) · 19 dead as a Russian military
//          plane crashes in Siberia's Kemerovo region · Zverev beats
//          Shelton 6-2 7-6 to reach the ATP Finals semis (ATP).
//   WEATHER Cyclone Akvan turns severe in the Bay of Bengal — IMD red
//          warning, landfall due Friday noon on the Andhra coast (IMD) ·
//          Category 5 Cyclone Xavier hits the Northern Cook Islands ·
//          a 6.0 quake rocks Papua New Guinea · COP31's human and social
//          development day in Antalya.
//   TICKER The World Court rules Thursday on the Myanmar genocide case ·
//          cold and floods batter Gaza's tent camps, where the WHO puts
//          950,000 displaced people on flood-prone ground · France sees
//          a fourth weekend of living-cost protests.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// PNG encoder (CRC32 + zlib deflate, filter 0 rows)
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crcData = new Uint8Array(4 + data.length);
  for (let i = 0; i < 4; i++) crcData[i] = type.charCodeAt(i);
  crcData.set(data, 4);
  view.setUint32(8 + data.length, crc32(crcData));
  return out;
}

function encodePng(width: number, height: number, rgb: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  const stride = width * 3;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgb.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

// ---------------------------------------------------------------------------
// Rasteriser. Everything is drawn on a supersampled canvas (SS x) and boxed
// down at the end, which is the only anti-aliasing the page gets.
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;
const SS = 2;
const BW = W * SS;
const BH = H * SS;
const px = new Uint8Array(BW * BH * 3);

type RGB = [number, number, number];

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= BW || y >= BH) return;
  const i = (y * BW + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x * SS));
  const y0 = Math.max(0, Math.round(y * SS));
  const x1 = Math.min(BW, Math.round((x + w) * SS));
  const y1 = Math.min(BH, Math.round((y + h) * SS));
  for (let yy = y0; yy < y1; yy++) {
    let i = (yy * BW + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      i += 3;
    }
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  const rr = r * SS;
  const ccx = cx * SS;
  const ccy = cy * SS;
  const y0 = Math.max(0, Math.floor(ccy - rr));
  const y1 = Math.min(BH - 1, Math.ceil(ccy + rr));
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy - ccy;
    const half = Math.sqrt(Math.max(0, rr * rr - dy * dy));
    const x0 = Math.max(0, Math.round(ccx - half));
    const x1 = Math.min(BW - 1, Math.round(ccx + half));
    let i = (yy * BW + x0) * 3;
    for (let xx = x0; xx <= x1; xx++) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      i += 3;
    }
  }
}

function fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
  const rrx = rx * SS;
  const rry = ry * SS;
  const ccx = cx * SS;
  const ccy = cy * SS;
  const y0 = Math.max(0, Math.floor(ccy - rry));
  const y1 = Math.min(BH - 1, Math.ceil(ccy + rry));
  for (let yy = y0; yy <= y1; yy++) {
    const t = (yy - ccy) / rry;
    const half = rrx * Math.sqrt(Math.max(0, 1 - t * t));
    const x0 = Math.max(0, Math.round(ccx - half));
    const x1 = Math.min(BW - 1, Math.round(ccx + half));
    let i = (yy * BW + x0) * 3;
    for (let xx = x0; xx <= x1; xx++) {
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      i += 3;
    }
  }
}

// Even-odd scanline polygon fill. Points are [x, y] in final-image pixels.
function fillPoly(points: [number, number][], c: RGB): void {
  const pts = points.map(([x, y]) => [x * SS, y * SS] as [number, number]);
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of pts) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(BH - 1, Math.ceil(maxY));
  const n = pts.length;
  for (let yy = y0; yy <= y1; yy++) {
    const yc = yy + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const [x1, y1p] = pts[i];
      const [x2, y2p] = pts[(i + 1) % n];
      if ((y1p <= yc && y2p > yc) || (y2p <= yc && y1p > yc)) {
        xs.push(x1 + ((yc - y1p) / (y2p - y1p)) * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.round(xs[k]));
      const xb = Math.min(BW - 1, Math.round(xs[k + 1]));
      let i = (yy * BW + xa) * 3;
      for (let xx = xa; xx <= xb; xx++) {
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
        i += 3;
      }
    }
  }
}

// A thick round-capped line: every pixel within w/2 of the segment is set.
function thickLine(x1: number, y1: number, x2: number, y2: number, w: number, c: RGB): void {
  const ax = x1 * SS;
  const ay = y1 * SS;
  const bx = x2 * SS;
  const by = y2 * SS;
  const r = (w * SS) / 2;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx) - r - 1));
  const maxX = Math.min(BW - 1, Math.ceil(Math.max(ax, bx) + r + 1));
  const minY = Math.max(0, Math.floor(Math.min(ay, by) - r - 1));
  const maxY = Math.min(BH - 1, Math.ceil(Math.max(ay, by) + r + 1));
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      let t = len2 === 0 ? 0 : ((xx - ax) * dx + (yy - ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - xx;
      const ey = ay + t * dy - yy;
      if (ex * ex + ey * ey <= r * r) setPx(xx, yy, c);
    }
  }
}

function polyline(points: [number, number][], w: number, c: RGB, close = false): void {
  const n = points.length;
  const segs = close ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % n];
    thickLine(x1, y1, x2, y2, w, c);
  }
}

function strokeRect(x: number, y: number, w: number, h: number, lw: number, c: RGB): void {
  polyline(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    lw,
    c,
    true,
  );
}

// ---------------------------------------------------------------------------
// Stroke font. Each glyph is a set of polylines on a 4-wide, 6-tall grid
// (y pointing down, baseline at y=6, cap height 6). Uppercase only: the
// renderer uppercases everything it is given.
// ---------------------------------------------------------------------------

type Stroke = [number, number][];
const FONT: Record<string, Stroke[]> = {
  A: [[[0, 6], [2, 0], [4, 6]], [[1, 4.1], [3, 4.1]]],
  B: [[[0, 0], [0, 6]], [[0, 0], [2.5, 0], [3.4, 0.8], [3.4, 2.1], [2.5, 3], [0, 3]], [[0, 3], [2.7, 3], [3.6, 3.8], [3.6, 5.2], [2.7, 6], [0, 6]]],
  C: [[[3.6, 1.1], [2.8, 0.2], [1.2, 0.2], [0.4, 1.1], [0.4, 4.9], [1.2, 5.8], [2.8, 5.8], [3.6, 4.9]]],
  D: [[[0, 0], [0, 6]], [[0, 0], [2.3, 0], [3.6, 1.3], [3.6, 4.7], [2.3, 6], [0, 6]]],
  E: [[[3.6, 0], [0, 0], [0, 6], [3.6, 6]], [[0, 3], [2.7, 3]]],
  F: [[[3.6, 0], [0, 0], [0, 6]], [[0, 3], [2.7, 3]]],
  G: [[[3.6, 1.1], [2.8, 0.2], [1.2, 0.2], [0.4, 1.1], [0.4, 4.9], [1.2, 5.8], [2.8, 5.8], [3.6, 4.8], [3.6, 3.5], [2.3, 3.5]]],
  H: [[[0, 0], [0, 6]], [[4, 0], [4, 6]], [[0, 3], [4, 3]]],
  I: [[[2, 0], [2, 6]], [[0.9, 0], [3.1, 0]], [[0.9, 6], [3.1, 6]]],
  J: [[[3.6, 0], [3.6, 4.7], [2.8, 5.8], [1.2, 5.8], [0.4, 4.9]]],
  K: [[[0, 0], [0, 6]], [[3.8, 0], [0.3, 2.9]], [[1.3, 2.2], [3.8, 6]]],
  L: [[[0, 0], [0, 6], [3.6, 6]]],
  M: [[[0, 6], [0, 0], [2, 2.6], [4, 0], [4, 6]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  O: [[[1.2, 0.2], [2.8, 0.2], [3.6, 1.1], [3.6, 4.9], [2.8, 5.8], [1.2, 5.8], [0.4, 4.9], [0.4, 1.1], [1.2, 0.2]]],
  P: [[[0, 6], [0, 0], [2.5, 0], [3.6, 0.9], [3.6, 2.5], [2.5, 3.4], [0, 3.4]]],
  Q: [[[1.2, 0.2], [2.8, 0.2], [3.6, 1.1], [3.6, 4.9], [2.8, 5.8], [1.2, 5.8], [0.4, 4.9], [0.4, 1.1], [1.2, 0.2]], [[2.3, 4.1], [4, 6.2]]],
  R: [[[0, 6], [0, 0], [2.5, 0], [3.6, 0.9], [3.6, 2.5], [2.5, 3.4], [0, 3.4]], [[1.7, 3.4], [3.8, 6]]],
  S: [[[3.6, 1.1], [2.8, 0.2], [1.2, 0.2], [0.4, 1.1], [0.6, 2.3], [3.4, 3.7], [3.6, 4.9], [2.8, 5.8], [1.2, 5.8], [0.4, 4.9]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  U: [[[0, 0], [0, 4.7], [0.8, 5.8], [3.2, 5.8], [4, 4.7], [4, 0]]],
  V: [[[0, 0], [2, 6], [4, 0]]],
  W: [[[0, 0], [1, 6], [2, 2.8], [3, 6], [4, 0]]],
  X: [[[0, 0], [4, 6]], [[4, 0], [0, 6]]],
  Y: [[[0, 0], [2, 2.8], [4, 0]], [[2, 2.8], [2, 6]]],
  Z: [[[0, 0], [4, 0], [0, 6], [4, 6]]],
  '0': [[[1.1, 0.2], [2.9, 0.2], [3.6, 1.2], [3.6, 4.8], [2.9, 5.8], [1.1, 5.8], [0.4, 4.8], [0.4, 1.2], [1.1, 0.2]]],
  '1': [[[1.1, 1.3], [2.4, 0], [2.4, 6]], [[1, 6], [3.4, 6]]],
  '2': [[[0.4, 1.1], [1.2, 0.2], [2.8, 0.2], [3.6, 1.1], [3.3, 2.5], [0.2, 6], [3.8, 6]]],
  '3': [[[0.4, 0.7], [1.4, 0.1], [2.7, 0.2], [3.5, 1.1], [2.9, 2.3], [1.6, 2.8]], [[1.6, 2.8], [3, 3.2], [3.6, 4.3], [2.9, 5.7], [1.3, 5.9], [0.4, 5.1]]],
  '4': [[[2.8, 6], [2.8, 0], [0.2, 4.3], [4, 4.3]]],
  '5': [[[3.6, 0], [0.4, 0], [0.4, 2.6], [2.5, 2.4], [3.6, 3.4], [3.4, 5.1], [2.6, 5.9], [0.9, 5.8], [0.3, 5]]],
  '6': [[[3.2, 0.9], [2.4, 0.2], [1.4, 0.3], [0.6, 1.5], [0.4, 4.9], [1.2, 5.8], [2.8, 5.8], [3.6, 4.8], [3.4, 3.4], [2.6, 2.8], [1.2, 3], [0.4, 4]]],
  '7': [[[0.2, 0], [3.8, 0], [1.8, 6]]],
  '8': [[[1.3, 3], [0.5, 2.2], [0.6, 0.9], [1.3, 0.2], [2.7, 0.2], [3.4, 0.9], [3.3, 2.2], [2.7, 3], [1.3, 3]], [[1.3, 3], [0.4, 4.1], [0.6, 5.2], [1.3, 5.8], [2.7, 5.8], [3.4, 5.2], [3.6, 4.1], [2.7, 3]]],
  '9': [[[0.8, 5.1], [1.6, 5.8], [2.6, 5.7], [3.4, 4.6], [3.6, 1.2], [2.8, 0.3], [1.3, 0.2], [0.5, 1.1], [0.6, 2.6], [1.4, 3.2], [2.8, 3.1], [3.6, 2.2]]],
  '.': [[[2, 5.2], [2, 5.9]]],
  ',': [[[2.3, 4.9], [1.8, 6.2]]],
  ';': [[[2, 1], [2, 1.8]], [[2.3, 4.9], [1.8, 6.2]]],
  ':': [[[2, 1.1], [2, 1.9]], [[2, 4.3], [2, 5.1]]],
  "'": [[[2.1, 0], [1.8, 1.3]]],
  '-': [[[0.8, 3], [3.2, 3]]],
  '/': [[[3.4, 0], [0.6, 6]]],
  '(': [[[3, 0.4], [1.9, 1.5], [1.5, 3], [1.9, 4.7], [3, 5.6]]],
  ')': [[[1, 0.4], [2.1, 1.5], [2.5, 3], [2.1, 4.7], [1, 5.6]]],
  '!': [[[2, 0], [2, 4.1]], [[2, 5.2], [2, 5.9]]],
  '?': [[[0.5, 1.1], [1.3, 0.2], [2.7, 0.2], [3.5, 1.1], [3.2, 2.4], [2, 3.3], [2, 4.1]], [[2, 5.2], [2, 5.9]]],
  '+': [[[2, 1.5], [2, 4.5]], [[0.9, 3], [3.1, 3]]],
  '=': [[[0.8, 2.2], [3.2, 2.2]], [[0.8, 3.8], [3.2, 3.8]]],
  '&': [[[3.4, 4.6], [2.2, 3.1], [1, 4.4], [1.2, 5.7], [2.6, 5.8], [3.6, 4.4]], [[2.2, 3.1], [3.2, 1.1], [2.7, 0.2], [1.5, 0.4], [1.1, 1.6], [2.2, 3.1]]],
  '%': [[[0.5, 0.9], [1, 0.3], [1.6, 0.9], [1.1, 1.5], [0.5, 0.9]], [[3.5, 0], [0.5, 6]], [[2.4, 5.1], [2.9, 4.5], [3.5, 5.1], [3, 5.7], [2.4, 5.1]]],
  '$': [[[3.6, 1.1], [2.8, 0.2], [1.2, 0.2], [0.4, 1.1], [0.6, 2.3], [3.4, 3.7], [3.6, 4.9], [2.8, 5.8], [1.2, 5.8], [0.4, 4.9]], [[2, -0.4], [2, 6.4]]],
};

const GLYPH_W = 4;
const ADVANCE = 5.1; // grid units per character, before letter spacing

function normalise(s: string): string {
  return s
    .toUpperCase()
    .replace(/[’‘]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...')
    .replace(/[“”]/g, "'");
}

// Width of a string at a given cap height (px), including letter spacing.
function textWidth(s: string, size: number, ls = 0): number {
  const t = normalise(s);
  if (t.length === 0) return 0;
  const unit = size / 6;
  return t.length * ADVANCE * unit + (t.length - 1) * ls - (ADVANCE - GLYPH_W) * unit;
}

function drawGlyph(ch: string, x: number, y: number, size: number, lw: number, c: RGB): void {
  const unit = size / 6;
  if (ch === ' ') return;
  if (ch === '•') {
    fillCircle(x + 2 * unit, y + 3 * unit, Math.max(1.1, size * 0.09), c);
    return;
  }
  const glyph = FONT[ch];
  if (!glyph) return;
  for (const stroke of glyph) {
    const pts = stroke.map(([gx, gy]) => [x + gx * unit, y + gy * unit] as [number, number]);
    polyline(pts, lw, c);
  }
}

// Draw text with its top at y. align: 'left' | 'center' | 'right' around x.
function drawText(s: string, x: number, y: number, size: number, c: RGB, opts: { weight?: number; ls?: number; align?: 'left' | 'center' | 'right' } = {}): number {
  const t = normalise(s);
  const ls = opts.ls ?? 0;
  const unit = size / 6;
  const lw = Math.max(1.2, size * (opts.weight ?? 0.135));
  const w = textWidth(t, size, ls);
  let cx = x;
  if (opts.align === 'center') cx = x - w / 2;
  if (opts.align === 'right') cx = x - w;
  for (const ch of t) {
    drawGlyph(ch, cx, y, size, lw, c);
    cx += ADVANCE * unit + ls;
  }
  return w;
}

// Greedy word wrap to a maximum width; returns the lines.
function wrapText(s: string, size: number, maxW: number, ls = 0): string[] {
  const words = normalise(s).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const trial = line === '' ? word : line + ' ' + word;
    if (textWidth(trial, size, ls) <= maxW || line === '') {
      line = trial;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

// Draw wrapped text, left aligned, with the given line height. Returns the
// y just below the last line.
function drawWrapped(s: string, x: number, y: number, size: number, lh: number, maxW: number, c: RGB, opts: { weight?: number; ls?: number } = {}): number {
  const lines = wrapText(s, size, maxW, opts.ls ?? 0);
  let cy = y;
  for (const line of lines) {
    drawText(line, x, cy, size, c, opts);
    cy += lh;
  }
  return cy;
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const PAPER: RGB = [246, 240, 225];
const INK: RGB = [27, 25, 21];
const RED: RGB = [176, 32, 38];
const FAINT: RGB = [122, 114, 98];
const NAVY: RGB = [16, 29, 50];
const SEA: RGB = [22, 49, 76];
const STEEL: RGB = [196, 205, 214];
const SMOKE: RGB = [105, 110, 118];
const FIRE: RGB = [240, 132, 40];
const GOLD: RGB = [198, 138, 36];
const SKYLT: RGB = [216, 228, 240];

// ---------------------------------------------------------------------------
// Lead scene: night over the strait. A swarm of drones crosses a dark sky;
// below, the bridge's road arch lies broken in the sea, fire at the break.
// ---------------------------------------------------------------------------

function drawDrone(cx: number, cy: number, s: number, body: RGB = STEEL): void {
  // s = half-width of the drone. Body, four arms, four rotor discs, one
  // blinking light — a silhouette the eye reads at once.
  fillRect(cx - s * 0.34, cy - s * 0.16, s * 0.68, s * 0.34, body);
  const arms: [number, number][] = [
    [-1, -0.62],
    [1, -0.62],
    [-1, 0.62],
    [1, 0.62],
  ];
  for (const [ax, ay] of arms) {
    thickLine(cx, cy, cx + ax * s * 0.8, cy + ay * s * 0.8, Math.max(1.4, s * 0.14), body);
    fillEllipse(cx + ax * s * 0.92, cy + ay * s * 0.92, s * 0.3, s * 0.11, body);
  }
  fillCircle(cx, cy + s * 0.28, Math.max(1.1, s * 0.11), [255, 84, 60]);
}

function drawLeadScene(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY);
  // Stars: fixed scatter, drawn — never randomised.
  const stars: [number, number, number][] = [
    [0.04, 0.16, 1.6], [0.11, 0.34, 1.2], [0.19, 0.1, 1.4], [0.3, 0.24, 1.1],
    [0.42, 0.12, 1.5], [0.55, 0.3, 1.1], [0.63, 0.14, 1.3], [0.74, 0.26, 1.1],
    [0.86, 0.1, 1.5], [0.93, 0.3, 1.2], [0.5, 0.08, 1.0], [0.08, 0.55, 1.0],
  ];
  for (const [fx, fy, r] of stars) fillCircle(x + fx * w, y + fy * h, r, SKYLT);
  // Moon, top right.
  fillCircle(x + w * 0.9, y + h * 0.2, h * 0.11, [232, 236, 226]);
  fillCircle(x + w * 0.885, y + h * 0.17, h * 0.095, NAVY);

  // The drone swarm, in loose formation, all heading right.
  const drones: [number, number, number][] = [
    [0.08, 0.3, 13], [0.17, 0.16, 16], [0.26, 0.38, 11], [0.36, 0.2, 18],
    [0.47, 0.36, 12], [0.58, 0.16, 15], [0.68, 0.32, 11], [0.79, 0.2, 14],
    [0.88, 0.38, 10],
  ];
  for (const [fx, fy, s] of drones) drawDrone(x + fx * w, y + fy * h, s);
  // One Neptune missile rides its smoke trail down to the bridge.
  const trail: [number, number][] = [
    [x + w * 0.3, y + h * 0.44],
    [x + w * 0.38, y + h * 0.5],
    [x + w * 0.45, y + h * 0.55],
    [x + w * 0.5, y + h * 0.6],
  ];
  polyline(trail, 2.2, [168, 178, 190]);
  const mTip = trail[trail.length - 1];
  const mTail = trail[trail.length - 2];
  const mAng = Math.atan2(mTip[1] - mTail[1], mTip[0] - mTail[0]);
  const mPts: [number, number][] = [];
  for (const [along, side] of [[11, 0], [2, -3.4], [-9, -2.2], [-9, 2.2], [2, 3.4]] as [number, number][]) {
    mPts.push([
      mTip[0] + Math.cos(mAng) * along - Math.sin(mAng) * side,
      mTip[1] + Math.sin(mAng) * along + Math.cos(mAng) * side,
    ]);
  }
  fillPoly(mPts, [226, 232, 238]);
  fillCircle(mTip[0] + Math.cos(mAng) * 13, mTip[1] + Math.sin(mAng) * 13, 3.2, FIRE);

  const seaY = y + h * 0.74;
  const deckY = y + h * 0.62;
  // Far shores.
  fillRect(x, deckY + 6, w * 0.3, seaY - deckY, [10, 18, 32]);
  fillRect(x + w * 0.72, deckY + 6, w * 0.28, seaY - deckY, [10, 18, 32]);
  // Standing deck, left and right of the break.
  fillRect(x, deckY, w * 0.44, 9, STEEL);
  fillRect(x + w * 0.585, deckY + 4, w * 0.415, 9, STEEL);
  // The rail deck runs above the road deck; a train waits, stopped, on it.
  fillRect(x, deckY - 13, w * 0.44, 5, STEEL);
  fillRect(x + w * 0.585, deckY - 9, w * 0.415, 5, STEEL);
  for (let i = 0; i < 4; i++) {
    fillRect(x + w * 0.06 + i * w * 0.085, deckY - 24, w * 0.07, 11, [148, 84, 72]);
  }
  fillRect(x + w * 0.06, deckY - 24, w * 0.045, 11, [70, 74, 82]);
  // Pylons.
  fillRect(x + w * 0.2, deckY + 9, 7, seaY - deckY - 4, STEEL);
  fillRect(x + w * 0.8, deckY + 13, 7, seaY - deckY - 4, STEEL);
  // The fallen arch: one segment pitched down into the water.
  polyline(
    [
      [x + w * 0.44, deckY + 3],
      [x + w * 0.575, seaY + 7],
    ],
    7,
    STEEL,
  );
  polyline(
    [
      [x + w * 0.47, deckY - 8],
      [x + w * 0.56, seaY - 2],
    ],
    3.4,
    STEEL,
  );
  // Fire and smoke at the break.
  const fx = x + w * 0.5;
  const fy = deckY - 2;
  const star: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2;
    const rad = i % 2 === 0 ? 21 : 8;
    star.push([fx + Math.cos(ang) * rad, fy + Math.sin(ang) * rad * 0.8]);
  }
  fillPoly(star, FIRE);
  fillCircle(fx, fy, 5.5, [255, 205, 92]);
  fillEllipse(fx + 16, fy - 22, 20, 8.5, SMOKE);
  fillEllipse(fx + 34, fy - 33, 26, 10, SMOKE);
  fillEllipse(fx - 24, fy - 16, 14, 6.5, SMOKE);
  // Sea.
  fillRect(x, seaY, w, y + h - seaY, SEA);
  // The arch's reflection of wreckage in the water.
  fillRect(x + w * 0.52, seaY + 4, w * 0.1, 4, STEEL);
  // Wave strokes.
  for (let i = 0; i < 9; i++) {
    const wx = x + 26 + i * (w - 52) / 8;
    const wy = seaY + 12 + (i % 3) * 6;
    polyline(
      [
        [wx - 11, wy],
        [wx - 4, wy - 3.4],
        [wx + 3, wy],
        [wx + 10, wy - 3.4],
      ],
      2,
      [126, 164, 196],
    );
  }
  strokeRect(x, y, w, h, 2.4, INK);
}

// ---------------------------------------------------------------------------
// Panel icons, each drawn inside its medallion at (cx, cy) with radius r.
// ---------------------------------------------------------------------------

function iconRadar(cx: number, cy: number, r: number, ink: RGB): void {
  // A dish on a tripod, listening; a drone overhead.
  polyline(
    [
      [cx - r * 0.52, cy + r * 0.1],
      [cx - r * 0.1, cy + r * 0.42],
      [cx + r * 0.42, cy + r * 0.28],
    ],
    r * 0.13,
    ink,
  );
  polyline(
    [
      [cx - r * 0.05, cy + r * 0.3],
      [cx - r * 0.28, cy + r * 0.78],
    ],
    r * 0.12,
    ink,
  );
  polyline(
    [
      [cx - r * 0.05, cy + r * 0.3],
      [cx + r * 0.24, cy + r * 0.78],
    ],
    r * 0.12,
    ink,
  );
  thickLine(cx - r * 0.3, cy + r * 0.8, cx + r * 0.42, cy + r * 0.8, r * 0.12, ink);
  // Signal arcs.
  for (const rr of [0.34, 0.55]) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const a = -0.5 + (i / 10) * 1.15;
      pts.push([cx + Math.cos(a) * r * rr + r * 0.18, cy - Math.sin(a) * r * rr - r * 0.05]);
    }
    polyline(pts, r * 0.1, ink);
  }
  drawDrone(cx + r * 0.52, cy - r * 0.52, r * 0.34, ink);
}

function iconJet(cx: number, cy: number, r: number, ink: RGB): void {
  // An airliner in profile, nose right, climbing gently.
  const body: [number, number][] = [
    [cx - r * 0.78, cy + r * 0.05],
    [cx - r * 0.3, cy - r * 0.2],
    [cx + r * 0.45, cy - r * 0.22],
    [cx + r * 0.8, cy - r * 0.02],
    [cx + r * 0.8, cy + r * 0.14],
    [cx + r * 0.3, cy + r * 0.3],
    [cx - r * 0.5, cy + r * 0.28],
  ];
  fillPoly(body, ink);
  // Tail fin and wing.
  fillPoly(
    [
      [cx - r * 0.72, cy - r * 0.05],
      [cx - r * 0.5, cy - r * 0.52],
      [cx - r * 0.3, cy - r * 0.5],
      [cx - r * 0.38, cy - r * 0.08],
    ],
    ink,
  );
  fillPoly(
    [
      [cx - r * 0.05, cy + r * 0.22],
      [cx + r * 0.3, cy + r * 0.62],
      [cx + r * 0.48, cy + r * 0.62],
      [cx + r * 0.28, cy + r * 0.18],
    ],
    ink,
  );
  // Windows.
  for (let i = 0; i < 5; i++) fillCircle(cx - r * 0.1 + i * r * 0.17, cy - r * 0.05, r * 0.045, PAPER);
  // Ground line with three flags of the summit cities' table.
  thickLine(cx - r * 0.8, cy + r * 0.78, cx + r * 0.8, cy + r * 0.78, r * 0.09, ink);
}

function iconCyclone(cx: number, cy: number, r: number, ink: RGB): void {
  // A spiral storm: three tightening turns around a calm eye.
  const pts: [number, number][] = [];
  const turns = 2.6;
  const steps = 90;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2 + 0.7;
    const rad = r * (0.92 - t * 0.68);
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.92]);
  }
  polyline(pts, r * 0.13, ink);
  fillCircle(cx, cy, r * 0.1, ink);
  // Rain streaks below.
  for (const dx of [-0.55, -0.18, 0.18, 0.55]) {
    thickLine(cx + dx * r, cy + r * 0.95, cx + dx * r - r * 0.14, cy + r * 1.18, r * 0.09, ink);
  }
}

function iconShip(cx: number, cy: number, r: number, ink: RGB): void {
  // A container ship: stacked boxes on a hull, water beneath.
  const cols: RGB[] = [RED, GOLD, [52, 96, 140]];
  const bw = r * 0.46;
  const bh = r * 0.3;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 2) continue; // bridge tower sits here instead
      fillRect(cx - r * 0.72 + col * (bw + 3), cy - r * 0.18 - row * (bh + 3), bw, bh, cols[(row + col) % 3]);
      strokeRect(cx - r * 0.72 + col * (bw + 3), cy - r * 0.18 - row * (bh + 3), bw, bh, 1.6, ink);
    }
  }
  fillRect(cx + r * 0.28, cy - r * 0.78, r * 0.2, r * 0.6, ink); // bridge tower
  fillRect(cx + r * 0.31, cy - r * 0.72, r * 0.14, r * 0.16, PAPER); // bridge window
  // Hull.
  fillPoly(
    [
      [cx - r * 0.85, cy - r * 0.12],
      [cx + r * 0.85, cy - r * 0.12],
      [cx + r * 0.62, cy + r * 0.34],
      [cx - r * 0.55, cy + r * 0.34],
    ],
    ink,
  );
  // Water.
  for (const dy of [0.55, 0.78]) {
    polyline(
      [
        [cx - r * 0.85, cy + r * dy],
        [cx - r * 0.45, cy + r * (dy - 0.09)],
        [cx - r * 0.05, cy + r * dy],
        [cx + r * 0.35, cy + r * (dy - 0.09)],
        [cx + r * 0.75, cy + r * dy],
      ],
      r * 0.09,
      [52, 96, 140],
    );
  }
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

const LEFT = 44;
const RIGHT = 980;
const CW = RIGHT - LEFT; // 936

function rule(y: number, h: number, c: RGB = INK): void {
  fillRect(LEFT, y, CW, h, c);
}

function panel(px: number, py: number, kicker: string, headline: string, dek: string, icon: (cx: number, cy: number, r: number, ink: RGB) => void): void {
  // Medallion with the story's icon, kicker beside it, then headline and dek
  // across the panel's full width.
  const cx = px + 22;
  const cy = py + 20;
  fillCircle(cx, cy, 19, PAPER);
  // ring
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    fillCircle(cx + Math.cos(a) * 19, cy + Math.sin(a) * 19, 1.3, INK);
  }
  icon(cx, cy, 15.5, INK);
  drawText(kicker, px + 50, py + 12, 15.5, RED, { weight: 0.17, ls: 0.6 });
  drawWrapped(headline, px, py + 44, 21, 25, 460, INK, { weight: 0.165 });
  drawWrapped(dek, px, py + 98, 13, 16.5, 460, [58, 54, 46], { weight: 0.14 });
}

// One market figure: name and the day's change on one line (change coloured,
// right-aligned to the cell edge), the value beneath. Nothing can overrun
// its neighbour.
function marketCell(x: number, y: number, cellRight: number, name: string, value: string, change: string, up: boolean): void {
  drawText(name, x, y, 10.5, [148, 164, 186], { weight: 0.15, ls: 0.5 });
  drawText(change, cellRight, y, 10.5, up ? [110, 205, 130] : [232, 110, 100], { weight: 0.15, align: 'right' });
  drawText(value, x, y + 11.5, 13, PAPER, { weight: 0.16 });
}

// One brief: red kicker, two-line headline, two-line wire summary.
function brief(bx: number, by: number, kicker: string, headline: string, summary: string): void {
  drawText(kicker, bx, by, 11, RED, { weight: 0.17, ls: 0.8 });
  drawWrapped(headline, bx, by + 15, 15, 17, 296, INK, { weight: 0.16 });
  drawWrapped(summary, bx, by + 51, 11, 13.5, 296, [58, 54, 46], { weight: 0.14 });
}

function compose(): void {
  fillRect(0, 0, W, H, PAPER);
  strokeRect(16, 16, W - 32, H - 32, 5, INK);
  strokeRect(28, 28, W - 56, H - 56, 1.6, INK);

  // Folio line: what this is, and where the news came from.
  drawText('ONE PICTURE, ALL THE NEWS', LEFT, 42, 11.5, INK, { weight: 0.15, ls: 0.8 });
  drawText('SOURCES: REUTERS • AP • AFP • CNN • BBC • IMD • UN', RIGHT, 42, 11.5, FAINT, { weight: 0.14, ls: 0.6, align: 'right' });
  rule(58, 1.6);

  // Masthead.
  drawText('THE WORLD TODAY', W / 2, 68, 48, INK, { weight: 0.17, ls: 3, align: 'center' });
  drawText('WEDNESDAY 18 NOVEMBER 2026', W / 2, 124, 28, RED, { weight: 0.17, ls: 1.5, align: 'center' });
  rule(158, 5);
  rule(168, 1.6);

  // Weather strip: two centred lines of the day's sky and sea.
  drawText('BAY OF BENGAL: CYCLONE AKVAN NOW SEVERE - RED WARNING, INDIA LANDFALL FRIDAY NOON', W / 2, 176, 11.5, INK, { weight: 0.145, ls: 0.4, align: 'center' });
  drawText('XAVIER CATEGORY 5 HITS COOK ISLANDS • PNG ROCKED BY 6.0 QUAKE • COP31 TALKS RUN ON IN ANTALYA', W / 2, 191, 11.5, INK, { weight: 0.145, ls: 0.4, align: 'center' });
  rule(204, 1.2);

  // Lead story.
  drawText('UKRAINE WAR - EUROPE', LEFT, 214, 15, RED, { weight: 0.17, ls: 1 });
  drawText('THE LEAD STORY', RIGHT, 214, 15, INK, { weight: 0.15, ls: 1, align: 'right' });
  drawWrapped("RECORD DRONE STORM BRINGS DOWN PUTIN'S CRIMEA BRIDGE", LEFT, 240, 36, 44, CW, INK, { weight: 0.165 });
  drawLeadScene(LEFT, 328, CW, 104);
  drawWrapped(
    'STAFF ILLUSTRATION, AFTER SBU IMAGERY - ZELENSKYY CALLS IT A SEVEN-STAGE OPERATION, WON WITH UKRAINIAN WEAPONS: PALIANYTSIA DRONES, NEPTUNE AND FLAMINGO MISSILES.',
    LEFT, 440, 11, 14, CW, FAINT, { weight: 0.14 },
  );
  drawWrapped(
    '1,441 DRONES OVER 22 REGIONS - A SECOND STRAIGHT DAILY RECORD. THE ROAD ARCH LIES IN THE STRAIT; RAIL IS STOPPED AND THE AZOV CHANNEL BLOCKED.',
    LEFT, 474, 15, 19, CW, [58, 54, 46], { weight: 0.145 },
  );
  rule(520, 1.6);

  // Two illustrated panels side by side.
  const gx = 520;
  fillRect(512, 530, 1.4, 124, FAINT);
  panel(LEFT, 530, 'MIDDLE EAST - THE GULF', 'US JETS HIT QESHM; IRAN DRONES SWARM BAHRAIN',
    'TEHRAN FIRES BACK AT KUWAIT AND BAHRAIN; THIRD RAID IN FIVE DAYS, ALL TURNED BACK.', iconRadar);
  panel(gx, 530, 'ASIA - SHENZHEN SUMMIT', 'XI HOSTS PUTIN; QUAD MEETS IN MANILA',
    'TRUMP JOINS THREE-WAY TALKS THURSDAY. QUAD AGREES PATROL FLIGHTS, CABLES, AI.', iconJet);
  rule(668, 1.6);

  // Markets band: the day's close, in the dark.
  const my = 674;
  fillRect(LEFT, my, CW, 66, NAVY);
  drawText('MARKETS', LEFT + 12, my + 8, 13, GOLD, { weight: 0.17, ls: 1 });
  drawText("WEDNESDAY'S", LEFT + 12, my + 28, 9.5, [148, 164, 186], { weight: 0.15, ls: 0.6 });
  drawText('CLOSE', LEFT + 12, my + 40, 9.5, [148, 164, 186], { weight: 0.15, ls: 0.6 });
  const cells: [string, string, string, boolean][] = [
    ['S&P 500', '7,340.53', '-1.03%', false],
    ['NASDAQ', '24,328.38', '-0.74%', false],
    ['FTSE 100', '10,689.87', '-1.76%', false],
    ['DAX', '26,045.37', '-2.08%', false],
    ['CAC 40', '8,216.78', '-1.62%', false],
    ['NIKKEI 225', '59,024.28', '+0.28%', true],
    ['HANG SENG', '23,297.16', '-0.90%', false],
    ['BRENT', '$91.55', '-1.71%', false],
    ['GOLD', '$3,775', '-2.31%', false],
    ['VIX', '25.46', '+11.13%', true],
  ];
  const cellW = (CW - 118) / 5;
  for (let i = 0; i < cells.length; i++) {
    const [name, value, change, up] = cells[i];
    const cx = LEFT + 118 + (i % 5) * cellW;
    const cy = my + (i < 5 ? 3 : 34);
    marketCell(cx, cy, cx + cellW - 10, name, value, change, up);
  }

  // Briefs: six short stories in three columns of two.
  drawText('AROUND THE WORLD - IN BRIEF', LEFT, 750, 11.5, RED, { weight: 0.17, ls: 1 });
  drawText('DATELINES: KYIV - MANAMA - SHENZHEN - MANILA - TURIN', RIGHT, 750, 11.5, FAINT, { weight: 0.14, ls: 0.6, align: 'right' });
  const bxs = [LEFT, 364, 684];
  fillRect(352, 770, 1.2, 142, FAINT);
  fillRect(672, 770, 1.2, 142, FAINT);
  brief(bxs[0], 770, 'US POLITICS', 'PELTOLA WINS ALASKA SENATE SEAT',
    "AP CALL: DEMOCRATS ON 56 SEATS.");
  brief(bxs[0], 850, 'ISRAEL', 'EISENKOT TAPPED TO FORM GOVERNMENT',
    'PASSES OVER NETANYAHU; 66-52.');
  brief(bxs[1], 770, 'HEALTH - CONGO', 'EBOLA DOUBLES IN CONGO: 11,000 CASES',
    '5,400 DEAD; CHILDREN HARDEST.');
  brief(bxs[1], 850, 'US HEALTH', 'US LOSES 26-YEAR MEASLES-FREE STATUS',
    '5,400 CASES, 10 DEATHS.');
  brief(bxs[2], 770, 'DISASTER - SIBERIA', '19 DEAD IN SIBERIA PLANE CRASH',
    'ARMY PLANE DOWN IN KEMEROVO.');
  brief(bxs[2], 850, 'SPORT - TURIN', 'ZVEREV INTO TURIN SEMI-FINALS',
    'BEATS SHELTON 6-2 7-6.');

  // Ticker band: two wrapped lines inside the black.
  const ty = 936;
  fillRect(LEFT, ty, CW, 38, INK);
  drawWrapped(
    'WORLD COURT RULES THURSDAY ON MYANMAR GENOCIDE CASE /// COLD AND FLOODS BATTER GAZA TENT CAMPS /// FRANCE: FOURTH WEEKEND OF LIVING-COST PROTESTS',
    LEFT + 12, ty + 4, 12.5, 15.5, CW - 24, PAPER, { weight: 0.145 },
  );
}

// ---------------------------------------------------------------------------
// Downsample and write
// ---------------------------------------------------------------------------

function downsample(): Uint8Array {
  const out = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * BW + (x * SS + dx)) * 3;
          r += px[i];
          g += px[i + 1];
          b += px[i + 2];
        }
      }
      const n = SS * SS;
      const o = (y * W + x) * 3;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
    }
  }
  return out;
}

compose();
const png = encodePng(W, H, downsample());
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), png);
console.log(`wrote ${join(outDir, 'entry.png')} (${png.length} bytes)`);
