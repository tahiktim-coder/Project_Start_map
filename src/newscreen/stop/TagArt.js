/* ═══ Silent Exodus · new screen (?new=1) · stop/TagArt.js: the bridge's glass tags, drawn as pixels ═════════════════════
   What it is: everything of an action tag on the bridge that is a picture, at the bridge's own pixel (640 x 360 frame px,
   the same grid as the room): amber corner brackets that draw in from the corners, the ink dither behind the words (as the
   voice lines have), a 9 x 9 pixel icon per action, the thin dotted thread to what the tag acts on with a pin on the target
   (it turns solid and pulses while pointed at), the marks of a world's finds on its face (WorldFinds.js: one of our ships,
   a colony, ruins, life...: an icon each), the lit key on Cora's console for "Leave orbit", and what the glass shows
   while a tag is pointed at (Scan sweeps the world's face, the team's way down, guide lines to a dock, a reticle on a
   field, the dive into a giant's clouds, chevrons at the window's edge). The words themselves are DOM (stop/Tags.js).
   House style (docs/ART_STYLE.md): ramps from the ink, 8 x 8 Bayer dither, motion in 125 ms steps. Warm amber for what you
   can do, cool grey for settling and for what the glass only tells. No randomness.
   Loaded only when the new-screen switch is on, after art/Paint.js and before stop/Stop.js.

   window.NSTagArt (frozen)
     ICON, CHIP                       9 and 5: an action icon and a chip icon, frame px square
     ramp(tone) → [4 hex]             'warm' | 'cool' | 'ui' | '#rrggbb' (a person's colour): dim → bright
     icon(c, name, x, y, tone, lift)  an action icon at (x, y) frame px; lift -1..2 shifts it dimmer or brighter
     chipURL(name, tone) → url        a chip icon as a data URL (the DOM chips show it, pixelated)
     shade(c, x, y, w, h, k)          the ink dither behind a box (k 0..1: how far it has come in)
     brackets(c, x, y, w, h, tone, k, hot)   the corners; k 0..1 their arms drawing in from the corners
     thread(c, pts, tone, o)          a polyline: o.solid, o.frac 0..1 (how far it has reached), o.lift
     pin(c, x, y, tone, o)            the mark on the target: o.pulse (t ms, or null), o.lift
     findMark(c, x, y, o)             a find's mark on the world: o.state 'open' | 'target' | 'done', o.hot, o.pulse, o.born
                                      (ms since it was found: one ring goes out), o.t, o.still
     key(c, x, y, w, h, o)            the helm key plate: o.hot, o.next, o.t
     panel(c, x, y, w, h, t)          the stock's small display set into the wall
     hatchLight(c, cx, floorY, k)     warm light rising out of the open hatch (k 0..1)
     preview(c, kind, o)              what the glass shows while a tag is pointed at; kind: 'scan' 'route' 'dock' 'reticle'
                                      'dive' 'chevrons' 'target' 'flag' 'rings'; o: the geometry and t (ms), o.still (reduced motion)
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!window.NEW_SCREEN || !P) return;
    const { INK, threshold, smooth, clamp01, hexRgb } = P;
    const SW = 640, SH = 360, ICON = 9, CHIP = 5, STEP = 125;

    // ── colours: four steps, dim to bright ──
    const RAMPS = {
        warm: ['#8a5422', '#e8964a', '#f7c483', '#fff3dc'],
        cool: ['#3a474e', '#6b7a82', '#a9b6bc', '#dde4e7'],
        ui: ['#284650', '#3d6670', '#9fd8e6', '#e1f6fb'],
        ink: [INK, INK, INK, INK],
    };
    const hex2 = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    const mix = (a, b, k) => { const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => hex2(v + (y[i] - v) * k)).join(''); };
    const toneRamps = new Map();
    function ramp(tone) {
        if (RAMPS[tone]) return RAMPS[tone];
        if (typeof tone === 'string' && /^#[0-9a-f]{6}$/i.test(tone)) {
            if (!toneRamps.has(tone)) toneRamps.set(tone, [mix(tone, INK, 0.5), tone, mix(tone, '#ffffff', 0.35), mix(tone, '#ffffff', 0.7)]);
            return toneRamps.get(tone);
        }
        return RAMPS.warm;
    }
    const at = (r, level) => r[Math.max(0, Math.min(3, level))];

    // ── the icons: 9 x 9 for an action, 5 x 5 for a chip; '.' empty, 1..4 dim to bright ──
    const ICONS = {
        scan: ['.........', '111......', '...11....', '222..1...', '...2..1..', '33..2.1..', '..3..2.1.', '43.3.2.1.', '44.3.2.1.'],
        shuttle: ['....3....', '...343...', '...232...', '..22322..', '..23332..', '..22322..', '.2222222.', '.2.....2.', '1.......1'],
        clamp: ['.........', '222...222', '2.......2', '2..333..2', '2..343..2', '2..333..2', '2.......2', '222...222', '.........'],
        pick: ['..33333..', '.3..4..3.', '3...3...3', '...3.....', '...3.....', '..2......', '..2......', '.2.......', '.1.......'],
        drop: ['....3....', '...343...', '..33433..', '..33333..', '...333...', '.........', '22.222.22', '..2...2..', '.........'],
        ring: ['...222...', '.22...22.', '.2.....2.', '2.......2', '2...4...2', '2.......2', '.2.....2.', '.22...22.', '...222...'],
        wave: ['.........', '..4......', '.3.3.....', '3...3....', '2...3...2', '....3...2', '.....3.3.', '......3..', '.........'],
        disc: ['...222...', '.22...22.', '.2.333.2.', '2.3...3.2', '2.3.4.3.2', '2.3...3.2', '.2.333.2.', '.22...22.', '...222...'],
        flag: ['.3.......', '.3333....', '.33332...', '.3333....', '.3.......', '.2.......', '.2.......', '.2.......', '222......'],
        chevrons: ['.........', '22..22...', '.22..22..', '..33..33.', '...44..44', '..33..33.', '.22..22..', '22..22...', '.........'],
        light: ['....2....', '.2..3..2.', '..2.3.2..', '...343...', '233444332', '...343...', '..2.3.2..', '.2..3..2.', '....2....'],
        escape: ['....33333', '......443', '.....3.43', '....3..33', '...3.....', '..3......', '.3.......', '3........', '.........'],
        accept: ['.........', '..22222..', '.2.....2.', '.2.333.2.', '.2.343.2.', '.2.333.2.', '.2.....2.', '..22222..', '.........'],
        // the finds on a world (WorldFinds.js): one of our ships, a colony, a beacon, a dome, graves, ruins, life, machines, a place
        wreck: ['.........', '.....233.', '....2343.', '...2332..', '.........', '.2332....', '2343.....', '332......', '.........'],
        house: ['....3....', '...343...', '..33333..', '.3333333.', '..2...2..', '..2.4.2..', '..2.4.2..', '..22222..', '.........'],
        beacon: ['....4....', '...343...', '....3....', '....3....', '...232...', '....2....', '...2.2...', '..2...2..', '.2.....2.'],
        dome: ['.........', '...222...', '..2...2..', '.2..3..2.', '.2.343.2.', '2..333..2', '222222222', '.........', '.........'],
        stones: ['.........', '..3...3..', '.333.333.', '..3...3..', '..3...3..', '..2...2..', '.........', '222222222', '.........'],
        ruins: ['.........', '.3.......', '.3...3...', '.3...3.3.', '.3.3.3.3.', '.3.3.3.3.', '.2.2.2.2.', '222222222', '.........'],
        life: ['.........', '.33...33.', '3443.3443', '.3443443.', '...343...', '....3....', '....2....', '....2....', '...222...'],
        gear: ['...2.2...', '.2.333.2.', '..33333..', '2333.3332', '.33...33.', '2333.3332', '..33333..', '.2.333.2.', '...2.2...'],
        pin: ['...333...', '..34443..', '..34.43..', '..34443..', '...343...', '...333...', '....3....', '....2....', '...2.2...'],
    };
    const CHIPS = {
        free: ['..2..', '.2.2.', '2...2', '.2.2.', '..2..'],
        energy: ['..33.', '.33..', '33333', '..33.', '.33..'],
        salvage: ['.2.2.', '22222', '22.22', '22222', '.2.2.'],
        risk: ['..3..', '.3.3.', '.3.3.', '3...3', '33333'],
        help: ['..3..', '..3..', '33333', '..3..', '..3..'],
        where: ['..3..', '...3.', '33333', '...3.', '..3..'],
        end: ['3....', '3332.', '3333.', '3....', '3....'],
        site: ['.222.', '2.4.2', '.222.', '..2..', '..2..'],
        gives: ['33333', '3.3.3', '33333', '3...3', '33333'],
        danger: ['..3..', '.3.3.', '.3.3.', '3...3', '33333'],
        live: ['..3..', '.333.', '33333', '.3.3.', '.333.'],
        slot: ['2.2.2', '.....', '2...2', '.....', '2.2.2'],
        dot: ['.....', '.....', '..3..', '.....', '.....'],
        rations: ['.333.', '3...3', '33333', '3...3', '.333.'],
        data: ['.333.', '3...3', '.333.', '3...3', '.333.'],
        item: ['..3..', '.333.', '33333', '.333.', '..3..'],
        page: ['333..', '3.33.', '3...3', '3.3.3', '33333'],
        done: ['....3', '...3.', '3.3..', '.3...', '.....'],
    };
    const iconCache = new Map();
    function iconCanvas(map, tone, lift) {
        const key = map.join('/') + '|' + tone + '|' + lift;
        if (iconCache.has(key)) return iconCache.get(key);
        const n = map.length, w = map[0].length, c = document.createElement('canvas'); c.width = w; c.height = n;
        const g = c.getContext('2d'), r = ramp(tone);
        map.forEach((row, y) => { for (let x = 0; x < w; x++) { const v = row[x]; if (v === '.' || v === ' ') continue; g.fillStyle = at(r, Number(v) - 1 + lift); g.fillRect(x, y, 1, 1); } });
        if (iconCache.size > 400) iconCache.clear();
        iconCache.set(key, c);
        return c;
    }
    function icon(c, name, x, y, tone, lift) { const map = ICONS[name]; if (map) c.drawImage(iconCanvas(map, tone || 'warm', lift || 0), Math.round(x), Math.round(y)); }
    const urls = new Map();
    function chipURL(name, tone) {
        const key = name + '|' + tone;
        if (!urls.has(key)) { const map = CHIPS[name] || CHIPS.dot; urls.set(key, iconCanvas(map, tone || 'cool', 0).toDataURL()); }
        return urls.get(key);
    }

    // ── the shade: ink dither behind a box, soft at its edge (a rounded box, its rim roughened) ──
    const PAD = 4, shades = new Map();
    function shadeSprite(w, h, px, py, k) {
        const key = `${w}x${h}:${px}:${py}:${k}`;
        if (shades.has(key)) return shades.get(key);
        const W = w + PAD * 2, H = h + PAD * 2, c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'), img = g.createImageData(W, H), ink = hexRgb(INK), peak = k / 8, rr = 2;   // solid under the words, dithered only at the rim
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const qx = Math.abs(x + 0.5 - PAD - w / 2) - (w / 2 - rr), qy = Math.abs(y + 0.5 - PAD - h / 2) - (h / 2 - rr);
            const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr + (P.hash(x & 255, y & 255, 31) - 0.5) * 1.6;
            if (peak * (1 - smooth(-1.5, PAD, sd)) > threshold(x + px, y + py)) { const o = (y * W + x) * 4; img.data[o] = ink[0]; img.data[o + 1] = ink[1]; img.data[o + 2] = ink[2]; img.data[o + 3] = 255; }
        }
        g.putImageData(img, 0, 0);
        if (shades.size > 160) shades.clear();
        shades.set(key, c);
        return c;
    }
    function shade(c, x, y, w, h, k) {
        const step = Math.max(0, Math.min(8, Math.round((k == null ? 1 : k) * 8)));
        if (!step || w < 1 || h < 1) return;
        const sx = Math.round(x) - PAD, sy = Math.round(y) - PAD;
        c.drawImage(shadeSprite(Math.round(w), Math.round(h), ((sx % 8) + 8) % 8, ((sy % 8) + 8) % 8, step), sx, sy);
    }

    // ── the brackets: four corners, 1 px, their arms drawing in from the corner ──
    const ARM = 4;
    function brackets(c, x, y, w, h, tone, k, hot) {
        const r = ramp(tone), arm = Math.max(1, Math.round(ARM * clamp01(k == null ? 1 : k))), x1 = x + w - 1, y1 = y + h - 1;
        const line = at(r, hot ? 2 : 1), tip = at(r, hot ? 3 : 2);
        c.fillStyle = line;
        [[x, y, 1, 1], [x1, y, -1, 1], [x, y1, 1, -1], [x1, y1, -1, -1]].forEach(([cx, cy, dx, dy]) => {
            c.fillRect(dx > 0 ? cx : cx - arm + 1, cy, arm, 1);
            c.fillRect(cx, dy > 0 ? cy : cy - arm + 1, 1, arm);
        });
        c.fillStyle = tip;
        [[x, y], [x1, y], [x, y1], [x1, y1]].forEach(([cx, cy]) => c.fillRect(cx, cy, 1, 1));
    }

    // ── the thread: a polyline, dotted (one on, one off) or solid, reaching frac of its length ──
    function linePts(x0, y0, x1, y1) {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const out = [], dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (let i = 0; i < 2000; i++) {
            out.push([x0, y0]);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
        return out;
    }
    function polyPts(pts) {
        let out = [];
        for (let i = 1; i < pts.length; i++) { const seg = linePts(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]); out = out.concat(i > 1 ? seg.slice(1) : seg); }
        return out;
    }
    function thread(c, pts, tone, o) {
        const opt = o || {}, all = polyPts(pts), n = Math.round(all.length * clamp01(opt.frac == null ? 1 : opt.frac)), r = ramp(tone), lift = opt.lift || 0;
        for (let i = 0; i < n; i++) {
            if (!opt.solid && i % 2) continue;
            c.fillStyle = at(r, (opt.solid ? 1 : 0) + lift);
            c.fillRect(all[i][0], all[i][1], 1, 1);
        }
        return n ? all[n - 1] : null;
    }

    // ── the pin on the target, and its pulse while pointed at ──
    function ringPts(cx, cy, rad) {
        const out = [], n = Math.max(8, Math.round(rad * 7));
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, p = [Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad)]; if (!out.some(q => q[0] === p[0] && q[1] === p[1])) out.push(p); }
        return out;
    }
    function pin(c, x, y, tone, o) {
        const opt = o || {}, r = ramp(tone), lift = opt.lift || 0;
        x = Math.round(x); y = Math.round(y);
        c.fillStyle = at(r, 0 + lift); [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => c.fillRect(x + dx, y + dy, 1, 1));
        c.fillStyle = at(r, 2 + lift); c.fillRect(x, y, 1, 1);
        if (opt.pulse == null) return;
        const step = Math.floor(opt.pulse / STEP) % 8, rad = 3 + step, fade = 1 - step / 8;
        ringPts(x, y, rad).forEach(([px, py]) => { if (fade * 0.9 > threshold(px, py)) { c.fillStyle = at(r, step < 3 ? 2 : 1); c.fillRect(px, py, 1, 1); } });
    }

    // ── a find's mark on the world (WorldFinds.js): where a team can go ──
    /** o: { state: 'open' | 'target' | 'done', hot (pointed at), pulse (ms since pointed, or null), born (ms since it was found:
        one ring goes out), t, still }. A small diamond with a lit point; the target inside corner brackets, its diamond
        blinking; a visited one a small grey cross. An ink rim keeps it clear on a lit face. */
    function findMark(c, x, y, o) {
        const opt = o || {}, done = opt.state === 'done', target = opt.state === 'target', r = ramp(done ? 'cool' : 'warm'), lift = opt.hot ? 1 : 0;
        x = Math.round(x); y = Math.round(y);
        c.fillStyle = INK;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) c.fillRect(x + dx, y + dy, 1, 1);
        if (done) {
            c.fillStyle = at(r, 1); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => c.fillRect(x + dx, y + dy, 1, 1));
            c.fillStyle = at(r, 2); c.fillRect(x, y, 1, 1);
            return;
        }
        const blink = target && !opt.still && Math.floor((opt.t || 0) / STEP) % 8 >= 5;
        c.fillStyle = at(r, (target ? 2 : 1) + lift - (blink ? 1 : 0));
        [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([dx, dy]) => c.fillRect(x + dx, y + dy, 1, 1));
        if (target) {                                                                 // where GO DOWN takes them: brackets round it
            c.fillStyle = at(r, 2 + lift);
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { c.fillRect(x + sx * 4, y + sy * 4, 1, 1); c.fillRect(x + sx * 3, y + sy * 4, 1, 1); c.fillRect(x + sx * 4, y + sy * 3, 1, 1); });
        }
        c.fillStyle = at(r, 3); c.fillRect(x, y, 1, 1);
        const ping = opt.born != null && opt.born >= 0 && opt.born < STEP * 8 ? Math.floor(opt.born / STEP) : -1;
        if (ping < 0 && opt.pulse == null) return;
        const step = ping >= 0 ? ping : Math.floor(opt.pulse / STEP) % 8, rad = 3 + step, fade = 1 - step / 8;
        ringPts(x, y, rad).forEach(([px, py]) => { if (fade * 0.9 > threshold(px, py)) { c.fillStyle = at(r, step < 3 ? 2 : 1); c.fillRect(px, py, 1, 1); } });
    }

    // ── small pictures painted once and kept (keyed by size, state and the Bayer phase at their place) ──
    const sprites = new Map();
    function sprite(key, w, h, paint) {
        if (sprites.has(key)) return sprites.get(key);
        const cv = document.createElement('canvas'); cv.width = Math.max(1, w); cv.height = Math.max(1, h);
        paint(cv.getContext('2d'));
        if (sprites.size > 120) sprites.clear();
        sprites.set(key, cv);
        return cv;
    }
    const phase = v => ((Math.round(v) % 8) + 8) % 8;

    // ── the helm key: a lit plate set in Cora's console ──
    const SPILL = 14;
    function key(c, x, y, w, h, o) {
        const opt = o || {}, r = RAMPS.warm, on = opt.next || opt.hot, beat = opt.next && !opt.still ? [0, 1, 2, 2, 1, 0, 0, 0][Math.floor((opt.t || 0) / STEP) % 8] : 0;
        x = Math.round(x); y = Math.round(y);
        if (opt.next) {                                                    // the next step: its light spills on the desk round it (added light, dithered)
            const W = w + SPILL * 2, H = h + SPILL * 2, px = phase(x - SPILL), py = phase(y - SPILL);
            const glow = sprite(`spill:${w}x${h}:${px}:${py}:${beat}`, W, H, g => {
                for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
                    const d = Math.hypot(Math.max(0, SPILL - xx, xx - SPILL - w + 1), Math.max(0, SPILL - yy, yy - SPILL - h + 1) * 1.25) / SPILL;
                    if (d <= 0 || d >= 1) continue;
                    const v = Math.pow(1 - d, 1.4) * (0.9 + beat * 0.05);
                    if (v > threshold(xx + px, yy + py)) { g.fillStyle = v > 0.62 ? '#3a2008' : v > 0.3 ? '#24140a' : '#140b05'; g.fillRect(xx, yy, 1, 1); }
                }
            });
            c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(glow, x - SPILL, y - SPILL); c.restore();
        }
        const state = opt.hot ? 2 : on ? 1 : 0;
        c.drawImage(sprite(`key:${w}x${h}:${phase(x)}:${phase(y)}:${state}:${beat}`, w + 2, h + 2, g => {
            g.fillStyle = INK; g.fillRect(0, 0, w + 2, h + 2);                // the recess
            const face = P.ramp(INK, '#1c1209', '#3a2410', '#5c3818');
            for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
                const v = [0.42, 0.58, 0.74][state] + (beat * 0.06) - yy / h * 0.22, k = P.level(face, v, x + xx, y + yy);
                if (k) { g.fillStyle = face.hex[k]; g.fillRect(xx + 1, yy + 1, 1, 1); }
            }
            g.fillStyle = at(r, state === 2 ? 3 : state); g.fillRect(1, 1, w, 1);   // the lit top edge
            g.fillStyle = at(r, state === 2 ? 1 : 0); g.fillRect(1, h, w, 1);
            if (state === 2) { g.fillStyle = at(r, 1); g.fillRect(1, 1, 1, h); g.fillRect(w, 1, 1, h); }
            g.fillStyle = at(r, state === 2 ? 3 : 1); g.fillRect(1, 1, 1, 1); g.fillRect(w, 1, 1, 1);
        }), x - 1, y - 1);
    }

    // ── the stock display: a small screen set into the wall, a steel bevel round it, faint scan lines, one status light ──
    function panel(c, x, y, w, h, t) {
        if (w < 4 || h < 4) return;
        x = Math.round(x); y = Math.round(y);
        c.drawImage(sprite(`panel:${w}x${h}:${phase(x)}:${phase(y)}`, w + 4, h + 4, g => {
            const steel = ['#151e24', '#29373f', '#4b5d66', '#677a82'], scr = P.ramp(INK, '#0a1416', '#0f1d21');
            g.fillStyle = steel[0]; g.fillRect(0, 0, w + 4, h + 4);
            g.fillStyle = steel[2]; g.fillRect(1, h + 2, w + 2, 1); g.fillRect(w + 2, 1, 1, h + 2);   // lit from the lower right
            g.fillStyle = INK; g.fillRect(1, 1, w + 1, 1); g.fillRect(1, 1, 1, h + 1);
            for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
                const k = P.level(scr, (yy % 2 ? 0.5 : 0.75) - xx / w * 0.2, x + xx, y + yy);
                g.fillStyle = scr.hex[k]; g.fillRect(xx + 2, yy + 2, 1, 1);
            }
            g.fillStyle = steel[3]; g.fillRect(w - 1, 0, 2, 1);
        }), x - 2, y - 2);
        c.fillStyle = Math.floor((t || 0) / 1600) % 2 ? '#2fb6c0' : '#1a6a70'; c.fillRect(x - 1, y + h + 1, 1, 1);   // a status light
    }
    /** Light rising out of the open hatch (added light, dithered), painted once per strength. */
    function hatchLight(c, cx, floorY, k) {
        const W = 37, H = 37, x0 = Math.round(cx) - 18, y0 = Math.round(floorY) - 34, kk = Math.round(k * 20) / 20;
        const pic = sprite(`hatch:${phase(x0)}:${phase(y0)}:${kk}`, W, H, g => {
            for (let dy = -34; dy <= 2; dy++) for (let dx = -18; dx <= 18; dx++) {
                const d = Math.hypot(dx / 18, Math.max(0, -dy) / 34);
                if (d >= 1) continue;
                const v = kk * Math.pow(1 - d, 1.5);
                if (v > threshold(x0 + dx + 18, y0 + dy + 34)) { g.fillStyle = v > 0.6 ? '#3c2208' : v > 0.3 ? '#26160a' : '#140c06'; g.fillRect(dx + 18, dy + 34, 1, 1); }
            }
        });
        c.save(); c.globalCompositeOperation = 'lighter'; c.drawImage(pic, x0, y0); c.restore();
    }

    // ── what the glass shows while a tag is pointed at ──
    const tick = o => (o.still ? 0 : Math.floor((o.t || 0) / STEP));
    function dot(c, x, y, hex) { c.fillStyle = hex; c.fillRect(Math.round(x), Math.round(y), 1, 1); }
    /** Scan: an arc of light sweeps the world's face, left to right, with two fading arcs behind it. */
    function sweep(c, o) {
        const [cx, cy, rad] = o.disc, r = RAMPS.ui, k = tick(o), u = o.still ? 0.62 : (k % 14) / 13;
        [[0, 3], [-0.07, 1], [-0.14, 0]].forEach(([du, lv]) => {
            const th = (clamp01(u + du) * 2 - 1) * Math.PI / 2 * 0.94, ax = Math.sin(th) * rad;
            const n = Math.ceil(rad * 3.4);
            for (let i = 0; i <= n; i++) {
                const lat = (i / n - 0.5) * Math.PI * 0.98, x = cx + ax * Math.cos(lat), y = cy + rad * Math.sin(lat);
                if (lv < 3 && (i % 2)) continue;
                dot(c, x, y, r[lv]);
            }
        });
        for (let i = -2; i <= 2; i++) dot(c, cx - rad - 4, cy + i * rad * 0.4, r[1]);   // the scale along its limb
    }
    /** The team: the shuttle's way down, dashes running toward the site, and a landing mark on it. */
    function route(c, o) {
        const pts = polyPts(o.pts.map(p => [Math.round(p[0]), Math.round(p[1])])), r = RAMPS.warm, k = tick(o) % 4;
        pts.forEach((p, i) => { if ((i + 400 - k) % 4 === 0) dot(c, p[0], p[1], r[i > pts.length - 6 ? 2 : 1]); });
        const [sx, sy] = o.pts[o.pts.length - 1].map(Math.round), open = o.still ? 3 : 3 + (k % 2);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => { dot(c, sx + dx * open, sy + dy * open, r[2]); dot(c, sx + dx * (open - 1), sy + dy * open, r[1]); dot(c, sx + dx * open, sy + dy * (open - 1), r[1]); });
        dot(c, sx, sy, r[3]);
    }
    /** Dock: two guide lines closing on the dock port, and a box round the port that blinks. */
    function dockGuide(c, o) {
        const [px, py] = o.at.map(Math.round), r = RAMPS.warm, k = tick(o);
        [-1, 1].forEach(s => thread(c, [[px + s * 52, py + 44], [px + s * 3, py + 3]], 'warm', { frac: o.still ? 1 : 0.4 + 0.6 * ((k % 6) / 5) }));
        if (k % 4 !== 3) brackets(c, px - 4, py - 4, 9, 9, 'warm', 1, true);
        dot(c, px, py, r[3]);
    }
    /** Mine: a reticle on the biggest rock, its ticks turning in steps. */
    function reticle(c, o) {
        const [cx, cy, rad] = o.disc, r = RAMPS.warm, k = tick(o) % 8;
        ringPts(cx, cy, rad).forEach(([x, y], i) => { if (i % 2 === 0) dot(c, x, y, r[1]); });
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + k * Math.PI / 16;
            for (let d = 0; d < 4; d++) dot(c, cx + Math.cos(a) * (rad - 1 - d), cy + Math.sin(a) * (rad - 1 - d), r[d < 2 ? 2 : 1]);
        }
        const b = Math.round(rad + 4);
        brackets(c, Math.round(cx) - b, Math.round(cy) - b, b * 2 + 1, b * 2 + 1, 'warm', 1, false);
        dot(c, cx, cy, r[3]);
    }
    /** Refuel: a skimming pass, dotted: down out of the sky, through the cloud tops (a splash of light there), and back up. */
    function dive(c, o) {
        const [ax, ay] = o.from, [bx, by] = o.to, [qx, qy] = o.out || o.from, r = RAMPS.warm, k = tick(o) % 4, pts = [];
        for (let i = 0; i <= 30; i++) { const e = i / 30; pts.push([Math.round(ax + (bx - ax) * e), Math.round(ay + (by - ay) * (1 - (1 - e) * (1 - e)))]); }
        for (let i = 1; i <= 30; i++) { const e = i / 30; pts.push([Math.round(bx + (qx - bx) * e), Math.round(by + (qy - by) * e * e)]); }
        polyPts(pts).forEach((p, i) => { if ((i + 400 - k) % 4 === 0) dot(c, p[0], p[1], r[Math.abs(p[1] - by) < 6 ? 2 : 1]); });
        const sp = o.still ? 2 : 2 + (k % 3);
        for (let dx = -sp - 2; dx <= sp + 2; dx++) if (Math.abs(dx) >= sp) dot(c, bx + dx, by - (Math.abs(dx) === sp ? 1 : 0), r[Math.abs(dx) === sp ? 2 : 1]);
        dot(c, bx, by, r[3]);
    }
    /** Leave orbit: big chevrons at the window's edge, marching outward (toward the lane and the light). */
    function chevrons(c, o) {
        const [x, y] = o.at.map(Math.round), r = RAMPS.warm, k = tick(o) % 4;
        for (let j = 0; j < 3; j++) {
            const lv = o.still ? 1 + j : [1, 2, 3, 0][(j - k + 8) % 4], cx = x + j * 8;
            for (let d = 0; d < 6; d++) for (let s = 0; s < 2; s++) { dot(c, cx + d + s, y - 5 + d, r[lv]); dot(c, cx + d + s, y + 5 - d, r[lv]); }
        }
    }
    /** Fly closer: a ring closing in on the site. */
    function target(c, o) {
        const [x, y] = o.at, r = RAMPS.warm, k = o.still ? 2 : tick(o) % 6, rad = 10 - k;
        ringPts(x, y, rad).forEach(([px, py], i) => { if (i % 2 === 0) dot(c, px, py, r[k > 3 ? 2 : 1]); });
        dot(c, x, y, r[3]);
    }
    /** Settle: a small flag on the landing site, and a quiet ring round it. */
    function flag(c, o) {
        const [x, y] = o.at.map(Math.round), r = RAMPS.cool;
        for (let i = 0; i < 9; i++) dot(c, x, y - i, r[2]);
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - (i === 3 ? 1 : 0); j++) dot(c, x + 1 + j, y - 8 + i, r[i === 0 ? 3 : 2]);
        ringPts(x, y, 6).forEach(([px, py], i) => { if (i % 2 === 0) dot(c, px, py, r[1]); });
    }
    /** Anything else: rings going out from the point. */
    function rings(c, o) {
        const [x, y] = o.at, k = o.still ? 3 : tick(o) % 8, r = ramp(o.tone || 'warm');
        [k, (k + 4) % 8].forEach(s => ringPts(x, y, 3 + s).forEach(([px, py]) => { if ((1 - s / 8) * 0.9 > threshold(px, py)) dot(c, px, py, r[s < 3 ? 2 : 1]); }));
    }
    /** The strange site's mark: a faint cold contact in space, a small ring that swells and fades in slow steps. */
    function mark(c, o) {
        const [x, y] = o.at.map(Math.round), r = RAMPS.ui, s = o.still ? 3 : Math.floor((o.t || 0) / (STEP * 3)) % 8, swell = [0, 1, 2, 3, 3, 2, 1, 0][s];
        ringPts(x, y, 2.4).forEach(([px, py]) => dot(c, px, py, r[Math.min(3, 1 + (swell > 1 ? 1 : 0))]));
        if (swell >= 2) ringPts(x, y, 4.2).forEach(([px, py], i) => { if (i % 2 === 0) dot(c, px, py, r[0]); });
        dot(c, x, y, r[swell > 1 ? 3 : 2]);
    }
    const PREVIEWS = { scan: sweep, route, dock: dockGuide, reticle, dive, chevrons, target, flag, rings, mark };
    function preview(c, kind, o) { const fn = PREVIEWS[kind]; if (fn && o) fn(c, o); }

    window.NSTagArt = Object.freeze({ ICON, CHIP, ramp, icon, chipURL, shade, brackets, thread, pin, findMark, key, panel, hatchLight, preview, linePts });
})();
