/* Structure lab harness — renders a candidate with the game's exact dither pipeline and writes PNGs.
   usage:  node harness.js candidate_<name>.js
   A candidate is a CommonJS module:
     module.exports = {
       name: 'short-name',
       look: { ramp: ['#hex', ... 5 or 6 stops, dark → light], accent: [r, g, b] },   // optional; defaults to the game's Structure look
       render(s, t, H) { ... },        // the BODY: writes s.gray / s.acc / s.mask   (s = { w, h, cx, cy, R, seed, gray, acc, mask })
       renderVista(v, t, H) { ... },   // the ORBIT VISTA: same buffers, any w × h    (v = { w, h, cx, cy, seed, gray, acc, mask })
     }
   H = { vnoise, fbm, ridge, rng, bayer8 }  — verbatim ports of DitherCore helpers. t is milliseconds.
   gray 0..1 = tone along the ramp; acc 0..1 = how much accent colour; mask 1 = solid pixel, 0 = glow/transparent
   (unmasked pixels that quantize to the darkest stop stay transparent; unmasked brighter ones glow one stop up). */

const fs = require('fs'), path = require('path'), zlib = require('zlib');

// ── verbatim ports from src/systems/dither/DitherCore.js ──
const ACCENT_MIX = 0.85, BAYER_N = 8;
function bayer(n) {
    if (n === 1) return [[0]];
    const s = bayer(n / 2), h = n / 2, m = [];
    for (let y = 0; y < n; y++) m.push(new Array(n));
    for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) {
        const v = s[y][x] * 4;
        m[y][x] = v; m[y][x + h] = v + 2; m[y + h][x] = v + 3; m[y + h][x + h] = v + 1;
    }
    return m;
}
const BAYER = bayer(BAYER_N).map(row => row.map(v => (v + 0.5) / (BAYER_N * BAYER_N)));
const perm = new Uint8Array(256);
(function () { let s = 1337; for (let i = 0; i < 256; i++) perm[i] = i; for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1), t = perm[i]; perm[i] = perm[j]; perm[j] = t; } })();
const h2 = (x, y) => perm[(perm[x & 255] + (y & 255)) & 255] / 255;
function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, octaves) { let sum = 0, amp = 0.5, freq = 1; for (let i = 0; i < (octaves || 4); i++) { sum += amp * vnoise(x * freq, y * freq); freq *= 2.07; amp *= 0.5; } return sum; }
const ridge = (x, y) => 1 - Math.abs(fbm(x, y, 3) * 2 - 1);
function rng(seed) { let s = ((seed || 1) * 2654435761 + 7) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const hexToRgb = hex => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

function quantize(rgba, w, h, gray, acc, mask, look) {
    const stops = look.ramp, top = stops.length - 1, k = look.contrast || 1.1, accent = look.accent;
    for (let y = 0; y < h; y++) {
        const row = BAYER[y % BAYER_N];
        for (let x = 0; x < w; x++) {
            const i = y * w + x, o = i * 4, solid = !mask || mask[i];
            let g = (gray[i] - 0.5) * k + 0.5; g = g < 0 ? 0 : g > 1 ? 1 : g;
            const pos = g * top, base = Math.floor(pos);
            let level = Math.min(top, base + (pos - base > row[x % BAYER_N] ? 1 : 0));
            if (!solid && level === 0) { rgba[o + 3] = 0; continue; }
            if (!solid) level = Math.min(top, level + 1);
            const c = stops[level], a = (accent && acc && level > 1) ? Math.min(1, acc[i]) * ACCENT_MIX : 0;
            rgba[o] = c[0] + (accent ? (accent[0] - c[0]) * a : 0);
            rgba[o + 1] = c[1] + (accent ? (accent[1] - c[1]) * a : 0);
            rgba[o + 2] = c[2] + (accent ? (accent[2] - c[2]) * a : 0);
            rgba[o + 3] = 255;
        }
    }
}

// ── the game's sizing (DitherBodies.canvasHtml / createState) ──
const PAD_RATIO = 0.46, pixelSize = size => (size >= 200 ? 2 : 1);
const DEFAULT_LOOK = { ramp: ['#06070a', '#140a24', '#3a1f66', '#8844ff', '#e6dcff'], accent: [200, 170, 255] };
const BACKDROP = [7, 9, 12];
const H = { vnoise, fbm, ridge, rng, bayer8: BAYER };

function buffers(w, h, extra) { return Object.assign({ w, h, cx: w / 2, cy: h / 2, gray: new Float32Array(w * h), acc: new Float32Array(w * h), mask: new Uint8Array(w * h) }, extra); }
function bodyState(size, seed) { const full = Math.round(size * (1 + PAD_RATIO)), px = Math.ceil(full / pixelSize(size)); return buffers(px, px, { R: (size / 2) / pixelSize(size), seed, flip: seed % 2 ? 1 : -1 }); }

/** Quantize a state and lay it over the game's dark backdrop with a few stars, so transparent glow pixels read as they will in play. */
function toImage(state, look) {
    const { w, h } = state, rgba = new Uint8Array(w * h * 4), out = new Uint8Array(w * h * 3), star = rng(99);
    quantize(rgba, w, h, state.gray, state.acc, state.mask, look);
    const stars = new Set(); for (let k = 0; k < w * h / 260; k++) stars.add(Math.floor(star() * w * h));
    for (let i = 0; i < w * h; i++) {
        const a = rgba[i * 4 + 3] / 255, bg = stars.has(i) ? [90, 110, 100] : BACKDROP;
        for (let c = 0; c < 3; c++) out[i * 3 + c] = rgba[i * 4 + c] * a + bg[c] * (1 - a);
    }
    return { w, h, rgb: out };
}

function scale(img, k) {
    const w = img.w * k, h = img.h * k, rgb = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const s = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 3, d = (y * w + x) * 3; rgb[d] = img.rgb[s]; rgb[d + 1] = img.rgb[s + 1]; rgb[d + 2] = img.rgb[s + 2]; }
    return { w, h, rgb };
}

function sideBySide(images, gap) {
    const w = images.reduce((sum, im) => sum + im.w, 0) + gap * (images.length + 1), h = Math.max(...images.map(im => im.h)) + gap * 2;
    const rgb = new Uint8Array(w * h * 3).fill(0); let x0 = gap;
    images.forEach(im => { for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) { const s = (y * im.w + x) * 3, d = ((y + gap) * w + x0 + x) * 3; rgb[d] = im.rgb[s]; rgb[d + 1] = im.rgb[s + 1]; rgb[d + 2] = im.rgb[s + 2]; } x0 += im.w + gap; });
    return { w, h, rgb };
}

const crcTable = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = ~0; for (const v of buf) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (~c) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); }
function writePng(file, img) {
    const raw = Buffer.alloc((img.w * 3 + 1) * img.h); let o = 0;
    for (let y = 0; y < img.h; y++) { raw[o++] = 0; for (let x = 0; x < img.w * 3; x++) raw[o++] = img.rgb[y * img.w * 3 + x]; }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4); ihdr[8] = 8; ihdr[9] = 2;
    fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// ── run ──
const file = process.argv[2];
if (!file) { console.error('usage: node harness.js candidate_<name>.js'); process.exit(1); }
const candidate = require(path.resolve(file));
const look = { ramp: ((candidate.look && candidate.look.ramp) || DEFAULT_LOOK.ramp).map(hexToRgb), accent: (candidate.look && candidate.look.accent) || DEFAULT_LOOK.accent };
const outDir = path.join(path.dirname(path.resolve(file)), 'out'); fs.mkdirSync(outDir, { recursive: true });
const name = candidate.name || path.basename(file, '.js'), SEED = 7, TIMES = [0, 2600, 5200];
const timeIt = fn => { const t0 = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t0) / 1e6; };
const report = { name, files: [], ms: {} };

// 1. the sizes the game really uses: map node small / large, the side panel, all at t = 0 — true size ×1 and ×3 to inspect
const SIZES = [36, 48, 79, 140];
const small = SIZES.map(size => { const s = bodyState(size, SEED); candidate.render(s, 0, H); return toImage(s, look); });
writePng(path.join(outDir, `${name}_sizes_true.png`), sideBySide(small, 8)); report.files.push(`${name}_sizes_true.png`);
writePng(path.join(outDir, `${name}_sizes_x3.png`), sideBySide(small.map(im => scale(im, 3)), 12)); report.files.push(`${name}_sizes_x3.png`);

// 2. the orbit hero body (size 460 → a 336 px canvas shown at ×2)
TIMES.forEach((t, k) => {
    const s = bodyState(460, SEED); report.ms[`hero_t${k}`] = Math.round(timeIt(() => candidate.render(s, t, H)));
    writePng(path.join(outDir, `${name}_hero_t${k}.png`), scale(toImage(s, look), 2)); report.files.push(`${name}_hero_t${k}.png`);
});

// 3. the orbit vista, two panel shapes (the panel is whatever size the window gives it), three moments
if (typeof candidate.renderVista === 'function') {
    [[480, 270, 'wide'], [330, 300, 'tall']].forEach(([w, h, tag]) => TIMES.forEach((t, k) => {
        if (tag === 'tall' && k > 0) return;
        const v = buffers(w, h, { seed: SEED }); report.ms[`vista_${tag}_t${k}`] = Math.round(timeIt(() => candidate.renderVista(v, t, H)));
        writePng(path.join(outDir, `${name}_vista_${tag}_t${k}.png`), scale(toImage(v, look), 2)); report.files.push(`${name}_vista_${tag}_t${k}.png`);
    }));
}
console.log(JSON.stringify(report, null, 2));
console.log(`PNGs in ${outDir}`);
