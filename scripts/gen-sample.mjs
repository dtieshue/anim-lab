// Generates the 6 PNG frames for sample/hero_heavy_slash/.
// No dependencies — hand-built PNGs (RGBA, deflate via zlib).
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'sample', 'hero_heavy_slash');
mkdirSync(OUT, { recursive: true });

const W = 200, H = 240;

// helpers ------------------------------------------------------------
function buf(w, h) { return new Uint8Array(w * h * 4); }
function px(b, x, y, r, g, bl, a) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  b[i] = r; b[i + 1] = g; b[i + 2] = bl; b[i + 3] = a;
}
function fillRect(b, x, y, w, h, r, g, bl, a = 255) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(b, xx, yy, r, g, bl, a);
}
function fillCircle(b, cx, cy, rad, r, g, bl, a = 255) {
  for (let yy = cy - rad; yy <= cy + rad; yy++)
    for (let xx = cx - rad; xx <= cx + rad; xx++) {
      const dx = xx - cx, dy = yy - cy;
      if (dx * dx + dy * dy <= rad * rad) px(b, xx, yy, r, g, bl, a);
    }
}
// Bresenham-like thick line
function fillLine(b, x0, y0, x1, y1, thickness, r, g, bl) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t);
    fillCircle(b, x, y, thickness, r, g, bl);
  }
}

// PNG encoder --------------------------------------------------------
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(rgba, w, h) {
  // filter type 0 per scanline
  const stride = w * 4;
  const filtered = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    filtered[y * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(filtered, y * (stride + 1) + 1);
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(filtered);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// character drawing --------------------------------------------------
const SKIN = [230, 200, 170];
const TUNIC = [80, 60, 140];
const PANTS = [40, 40, 60];
const BLADE = [220, 230, 240];
const HILT = [120, 80, 30];
const OUTLINE = [10, 10, 14];

// Pose params: lean (x offset of head from feet), armAngleDeg (0 = arm down),
// crouch (px lowered), bladeAngleDeg, swooshIntensity (0..1)
function drawPose({ lean, armAngleDeg, crouch, bladeAngleDeg, swoosh }) {
  const b = buf(W, H);

  const feetX = W / 2;
  const feetY = H - 4;             // anchor (0.5, 1.0) → bottom-center
  const hipY = feetY - 60 + crouch;
  const torsoTopY = hipY - 50;
  const headY = torsoTopY - 22;
  const headX = feetX + lean;

  // legs
  fillLine(b, feetX - 14, feetY, feetX - 6, hipY, 7, ...PANTS);
  fillLine(b, feetX + 14, feetY, feetX + 6, hipY, 7, ...PANTS);
  // torso
  fillLine(b, feetX, hipY, headX, torsoTopY, 12, ...TUNIC);
  // head
  fillCircle(b, headX, headY, 14, ...SKIN);
  // arm + sword
  const shoulderX = headX + 4;
  const shoulderY = torsoTopY + 6;
  const armLen = 34;
  const ar = (armAngleDeg * Math.PI) / 180;
  const handX = Math.round(shoulderX + Math.cos(ar) * armLen);
  const handY = Math.round(shoulderY - Math.sin(ar) * armLen);
  fillLine(b, shoulderX, shoulderY, handX, handY, 6, ...SKIN);

  // sword: hilt at hand, blade extending bladeAngle from hand
  const br = (bladeAngleDeg * Math.PI) / 180;
  const bladeLen = 52;
  const tipX = Math.round(handX + Math.cos(br) * bladeLen);
  const tipY = Math.round(handY - Math.sin(br) * bladeLen);
  // crossguard
  const cgr = br + Math.PI / 2;
  fillLine(b,
    Math.round(handX - Math.cos(cgr) * 8), Math.round(handY + Math.sin(cgr) * 8),
    Math.round(handX + Math.cos(cgr) * 8), Math.round(handY - Math.sin(cgr) * 8),
    2, ...HILT);
  // blade
  fillLine(b, handX, handY, tipX, tipY, 3, ...BLADE);
  // hilt grip
  fillCircle(b, handX, handY, 3, ...HILT);

  // motion swoosh (semi-transparent arc trailing the blade)
  if (swoosh > 0) {
    const arcSteps = 16;
    const arcSpan = 1.4 * swoosh; // radians of trail
    for (let i = 0; i < arcSteps; i++) {
      const t = i / arcSteps;
      const ang = br + arcSpan * t; // trail behind tip
      const r2 = bladeLen * (1 - t * 0.15);
      const tx = Math.round(handX + Math.cos(ang) * r2);
      const ty = Math.round(handY - Math.sin(ang) * r2);
      fillCircle(b, tx, ty, 4, 255, 255, 220, Math.round(140 * (1 - t) * swoosh));
    }
  }

  return b;
}

// 6 frames matching anim.json --------------------------------------
const frames = [
  // anticipation: wind back, slight crouch, sword raised behind
  { name: 'f00.png', pose: { lean: -6, armAngleDeg: 130, crouch: 4, bladeAngleDeg: 110, swoosh: 0 } },
  { name: 'f01.png', pose: { lean: -10, armAngleDeg: 145, crouch: 8, bladeAngleDeg: 130, swoosh: 0 } },
  // startup: explosive forward shift, blade still high
  { name: 'f02.png', pose: { lean: 4, armAngleDeg: 90, crouch: 2, bladeAngleDeg: 80, swoosh: 0.3 } },
  // active: blade slashing horizontally — strongest swoosh
  { name: 'f03.png', pose: { lean: 14, armAngleDeg: 30, crouch: 0, bladeAngleDeg: 0, swoosh: 1 } },
  // impact: blade past, slight overshoot
  { name: 'f04.png', pose: { lean: 16, armAngleDeg: 5, crouch: 2, bladeAngleDeg: -25, swoosh: 0.6 } },
  // recovery: settled, blade low
  { name: 'f05.png', pose: { lean: 8, armAngleDeg: -15, crouch: 6, bladeAngleDeg: -45, swoosh: 0 } },
];

for (const f of frames) {
  const rgba = drawPose(f.pose);
  writeFileSync(resolve(OUT, f.name), encodePNG(rgba, W, H));
  console.log('wrote', f.name);
}
console.log('done →', OUT);
