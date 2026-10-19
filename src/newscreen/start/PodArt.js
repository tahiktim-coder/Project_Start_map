/* ═══ Silent Exodus · new screen (?new=1) · start/PodArt.js: the wake-up in the hold, as pixels ═════════════════════════
   What it is: every picture of the wake-up after the launch film (start/Pods.js): our Lander's hold close up, at the
   bridge's own pixel (a 640 x 360 frame, as stop/Stop.js), the med bay above and the engine room below left in the dark.
   Five upright sleeper pods stand along the back wall (ShipRooms look.pods 5: Cora's first, then Jaxon, Aris, Vance,
   Mira). Each pod's window is drawn every frame: the sleeper inside (their own sprite, ice-blue while cold, eyes shut until
   woken), the sleep fluid up to the neck with a few bubbles, frost on the glass that melts from the middle out, and the
   glass lifting into the pod's top when it opens. Also: the people on the floor, lit by the hold's lamps; the panel's lit
   valve plates, their icons and the three stage marks; the fluid running down to a pod; the seal letting go.
   House style (docs/ART_STYLE.md): ramps from the ink, 8 x 8 Bayer dither, motion in 125 ms steps, no randomness.
   Loaded only when the new-screen switch is on, after ship/ShipRooms.js, the crew and stop/TagArt.js; before start/Pods.js.

   window.NSPodArt (frozen)
     SW, SH, OFFX, TOP, F                    the frame (frame px); the hold's top row and its floor row in it
     PODS                                    [{ id, x, top, win: { x, y, w, h } }] frame px, left to right (Cora first)
     FLUID                                   { warm, flush, wake } → '#rrggbb', the three valves' colours
     prepare() → [() => void]                small jobs that paint the room ahead (run one a frame)
     room(lit) → canvas                      the hold, its neighbours in the dark, space beside the hull (painted once)
     fx(c, t, o)                             the room's moving bits: LEDs, the cargo screen, the intercom (o.aura: she talks)
     pod(c, i, s, t)                         one pod's window. s = { id, warm 0..1, ice 0..1 (frost left), level 0..1 (fluid
                                             left), awake, door 0..1 (glass lifted), inside, alarm, frame }
     person(c, id, x, act, ms, facing, o)    someone on the floor (o.blink, o.dy); returns { X, Y, Sp, facing } for hit tests
     valve(c, x, y, w, h, hex, state)        a fluid valve's lit plate; state 'idle' | 'hot' | 'down' | 'dim'
     icon(c, name, x, y, hex, lift)          9 x 9: 'warm' (a flame), 'flush' (a drop), 'wake' (a heart)
     pips(c, x, y, marks, next, t, still)    three stage marks: marks[i] a hex once done; the next one blinks
     pulse(c, pts, hex, k)                   the fluid running down a thread (k 0..1 along it)
     vapour(c, i, k)                         the pod's seal letting go at its foot (k 0..1)
     mask(j) → canvas                        the dissolve: Bayer step j of 8 (j + 1 eighths of the pixels)
*/
(function () {
    'use strict';
    const A = window.ShipArt, CE = window.CrewEngine, P = window.NSPaint, TA = window.NSTagArt;
    if (!window.NEW_SCREEN || !A || !CE || !P || !TA) return;
    const { L, R, INK } = A, { threshold, clamp01, hexRgb, fbm } = P;

    // ── the frame: 640 x 360 frame px as the bridge; the hold (deck 5, index 4) with its top at row TOP ──
    const SW = 640, SH = 360, OFFX = -40, HOLD = 4, TOP = 86, DF = L.DECK_FLOOR;
    const Y0 = A.deckTop(HOLD) - TOP;                                        // the world row at frame row 0
    const F = TOP + DF;                                                       // the hold's floor, frame px
    const IDS = ['cora', 'jaxon', 'aris', 'vance', 'mira'];
    const POD_X = [270, 326, 382, 438, 494];                                  // world x: ShipRooms ROOMS[4], look.pods === 5
    const PODS = Object.freeze(IDS.map((id, i) => {                         // the window: world cx-11 .. cx+12, deck rows F-98 .. F-31
        const x = POD_X[i] + OFFX;
        return Object.freeze({ id, x, top: F - 112, win: Object.freeze({ x: x - 11, y: F - 98, w: 23, h: 68 }) });
    }));
    const FLUID = Object.freeze({ warm: '#e8964a', flush: '#4aa3dc', wake: '#4cc47a' });
    const LOOK = { dark: { pods: 5, dark: true }, lit: { pods: 5 } };
    const DIM = { dark: 0.17, lit: 0.26 };                                    // the decks above and below, unlit: how much light is left
    const LAMPS = [250, 480].map(x => x + OFFX);                             // the hold's two lamps (ShipRooms), frame x
    const SINK = 8;                                                           // a sleeper stands this low in the pod: the face in the window's upper third
    const NECK = F - 74;                                                      // the sleep fluid's level: up to the neck
    const ICE = R.ICE, GEL = P.ramp(INK, '#0b2622', '#123f37', '#1d5f52', '#358a74', '#76c8ae', '#c6f2e2');
    const FROST = P.ramp(INK, '#1c3038', '#34525c', '#5c808a', '#8fb0b8', '#c4dce0', '#eef8f9');   // ice on the glass: pale, grey-blue

    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };

    // ── the room: the hold lit or dark, the med bay above and the engine room below under ink, stars beside the hull ──
    const rooms = { dark: null, lit: null };
    let fxList = [];
    /** Rows y0..y1 with their lights off (the decks nobody is on yet): each pixel keeps k of its light, a little cooler. */
    function unlit(g, y0, y1, k) {
        const h = Math.max(0, Math.min(SH, y1) - y0);
        if (!h) return;
        const img = g.getImageData(0, y0, SW, h), d = img.data;
        for (let o = 0; o < d.length; o += 4) { d[o] = d[o] * k; d[o + 1] = d[o + 1] * k * 1.05; d[o + 2] = d[o + 2] * k * 1.18; }
        g.putImageData(img, 0, y0);
    }
    function paint(kind) {
        const c = mk(SW, SH), g = c.getContext('2d');
        g.fillStyle = INK; g.fillRect(0, 0, SW, SH);
        [[0, 0], [1, 137]].forEach(([layer, ox]) => { const T = A.stars(layer); for (let x = -ox; x < SW; x += T.size) g.drawImage(T.canvas, x, -T.size / 3); });
        [HOLD - 1, HOLD, HOLD + 1].forEach(i => { const D = A.deck(i, i === HOLD ? LOOK[kind] : {}); g.drawImage(D.canvas, OFFX, A.deckTop(i) - Y0); });
        unlit(g, 0, TOP - 18, DIM[kind]);                                     // the med bay's room (its floor slab stays: the hold's ceiling)
        unlit(g, TOP + L.PITCH, SH, DIM[kind]);                               // the engine room
        if (kind === 'lit') fxList = A.deck(HOLD, LOOK.lit).fx.map(f => Object.assign({}, f, { x: f.x + OFFX, y: f.y - Y0 }));
        rooms[kind] = c;
    }
    function prepare() {
        return [() => A.deck(HOLD - 1, {}), () => A.deck(HOLD + 1, {}), () => A.deck(HOLD, LOOK.dark), () => A.deck(HOLD, LOOK.lit), () => paint('dark'), () => paint('lit')];
    }
    function room(lit) {
        const kind = lit ? 'lit' : 'dark';
        if (!rooms[kind]) paint(kind);
        return rooms[kind];
    }

    // ── the room's moving bits (as stop/Stop.js drawFx): LEDs, the cargo terminal's screen, the intercom while she talks ──
    const INTERCOM = { x: L.LX + 22 + OFFX, y: TOP + DF - 152, w: 9, h: 14 };
    function fx(c, t, o) {
        const f = P.framer(c, SW, SH), tick = Math.floor(t / 125), opt = o || {};
        fxList.forEach(e => {
            if (e.kind === 'led') { if (((t + e.x * 37) % e.period) < e.period * 0.55) f.px(e.x, e.y, e.color); }
            else if (e.kind === 'nav') { if (((t + e.phase) % 2600) < 180) { f.px(e.x - 1, e.y, e.color, 3, 1); f.px(e.x, e.y - 1, e.color, 1, 3); } else f.px(e.x, e.y, e.dim); }
            else if (e.kind === 'screen') {
                for (let r = 1; r < e.h; r += 2) { const n = Math.floor(P.hash(r & 255, (tick >> 2) & 255, 3) * (e.w - 1)); for (let k = 0; k < n; k++) if (P.hash(k & 255, (r + tick) & 255, 5) > 0.3) f.px(e.x + k, e.y + r, R.SCR.hex[(k + r) % 4 ? 2 : 3]); }
            }
        });
        if (opt.dark && Math.floor(t / 900) % 2) f.px(162, TOP + 27, '#ffd2c8', 2, 1);   // the emergency lamp's bulb, slow (the dark hold only)
        if (opt.aura) {                                                       // the intercom speaks: its grille lights, in steps
            const on = Math.floor(t / 125) % 3 !== 2, I = INTERCOM;
            for (let y = 2; y < I.h - 2; y += 2) f.px(I.x + 2, I.y + y, R.SCR.hex[on ? 5 : 4], I.w - 4, 1);
            f.px(I.x + 2, I.y + I.h - 3, R.SCR.hex[5], 2, 1);
        }
    }

    // ── a sleeper's sprite: their own, ice-blue while cold (luminance onto the ice ramp); pixels read once per frame canvas ──
    const pixels = new WeakMap();
    function dataOf(cv) {
        let d = pixels.get(cv);
        if (!d) { d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data; pixels.set(cv, d); }
        return d;
    }
    const coldOf = new WeakMap();
    /** The cold colours of a sprite: each pixel's luminance on the ice ramp, kept dim (index 1..4), quantized with the grain. */
    function cold(cv) {
        let out = coldOf.get(cv);
        if (out) return out;
        const d = dataOf(cv), n = cv.width * cv.height;
        out = new Uint8ClampedArray(n * 4);
        for (let k = 0; k < n; k++) {
            if (!d[k * 4 + 3]) continue;
            const v = lum(d[k * 4], d[k * 4 + 1], d[k * 4 + 2]), x = k % cv.width, y = (k / cv.width) | 0;
            const rgb = ICE.rgb[Math.max(1, Math.min(5, Math.floor(1 + Math.pow(v, 0.8) * 4.6 + threshold(x, y) - 0.5)))];
            out[k * 4] = rgb[0]; out[k * 4 + 1] = rgb[1]; out[k * 4 + 2] = rgb[2]; out[k * 4 + 3] = 255;
        }
        coldOf.set(cv, out);
        return out;
    }
    const lum = (r, g, b) => (0.3 * r + 0.59 * g + 0.11 * b) / 255;

    // ── a pod's window, every frame: the inside, the sleeper, the fluid, then the glass (haze, ice, running water, sheen) ──
    const winImg = PODS.map(p => new ImageData(p.win.w, p.win.h));
    /** The frost on each glass, fixed: haze (how pale the glass is) and ice (crystals, solid above 0.5); both thick at the
        edges and corners, the haze thinner across the middle so the face shows through, pale and grey. */
    const frostOf = PODS.map((p, i) => {
        const { w, h } = p.win, haze = new Float32Array(w * h), ice = new Float32Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const ex = Math.min(x, w - 1 - x), ey = Math.min(y, h - 1 - y), k = y * w + x;
            const edge = Math.max(0, 1 - ex / 5.5) * 0.6 + Math.max(0, 1 - ey / 7) * 0.3 + Math.max(0, 1 - Math.hypot(ex, ey) / 8) * 0.35;
            const n = fbm(x / 3.4, y / 3.4, 90 + i * 7, 3) - 0.5, fine = fbm(x / 1.4, y / 1.6, 40 + i, 2) - 0.5;
            haze[k] = 0.16 + edge * 0.7 + n * 0.45;
            ice[k] = edge * 0.95 + n * 0.85 + fine * 0.35 - 0.05;
        }
        return { haze, ice };
    });
    const BUBBLES = [[5, 1700, 0], [12, 2300, 900], [18, 1900, 400]];
    function put(d, o, rgb) { d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255; }
    function pod(c, i, s, t) {
        const p = PODS[i], W = p.win, img = winImg[i], d = img.data, fr = frostOf[i];
        const Sp = s.inside ? CE.sprite(s.id, 'idle', s.frame || 0, { blink: !s.awake, warm: 0, rim: 0 }) : null;
        const sd = Sp ? dataOf(Sp.canvas) : null, sc = Sp ? cold(Sp.canvas) : null, sx0 = Sp ? p.x - Sp.origin.x : 0, sy0 = Sp ? F + SINK - Sp.origin.y : 0;
        const warm = clamp01(s.warm || 0), melt = 1 - clamp01(s.ice == null ? 1 : s.ice), lift = Math.round(clamp01(s.door || 0) * W.h);
        const bottom = W.y + W.h, surf = Math.round(bottom - (bottom - NECK) * clamp01(s.level || 0)), open = !s.inside && lift >= W.h;
        const inside = s.alarm && !open ? R.RED : ICE;
        for (let ly = 0; ly < W.h; ly++) for (let lx = 0; lx < W.w; lx++) {
            const X = W.x + lx, Y = W.y + ly, o = (ly * W.w + lx) * 4, thr = threshold(X, Y);
            const v = open ? 0.1 + 0.08 * (1 - ly / W.h) : 0.07 + 0.24 * Math.pow(1 - ly / W.h, 1.8) + (lx === 0 || lx === W.w - 1 ? -0.05 : 0);   // the pod's light from above
            put(d, o, inside.rgb[P.level(inside, s.alarm && !open ? v * 1.7 : v, X, Y)]);
            if (sd) {                                                         // the sleeper, behind the glass: ice-blue until warmed
                const sx = X - sx0, sy = Y - sy0;
                if (sx >= 0 && sy >= 0 && sx < Sp.w && sy < Sp.h) {
                    const k = (sy * Sp.w + sx) * 4;
                    if (sd[k + 3]) { const src = warm >= 1 || thr < warm ? sd : sc; d[o] = src[k]; d[o + 1] = src[k + 1]; d[o + 2] = src[k + 2]; }
                }
            }
            if (s.level > 0 && Y > surf) {                                    // the sleep fluid: the body shows through it, green-teal
                const l = lum(d[o], d[o + 1], d[o + 2]);
                put(d, o, GEL.rgb[Math.max(1, Math.min(5, Math.floor(1.4 + l * 4.2 + thr - 0.5 - (Y - surf) / W.h)))]);
            } else if (s.level > 0 && Y === surf) put(d, o, GEL.rgb[(lx + (t >> 7)) % 5 ? 5 : 6]);   // its top, a line that shimmers
            const gy = ly + lift;                                             // the glass moves up as the pod opens
            if (gy >= W.h) continue;
            if (gy >= W.h - 2 && lift > 0) { put(d, o, R.STEEL.rgb[gy === W.h - 1 ? 3 : 6]); continue; }   // the glass's lower rim, lifting
            const gk = gy * W.w + lx, ice = fr.ice[gk] - melt * 1.7, haze = fr.haze[gk] - melt * 1.4;
            if (ice > 0.5 + (thr - 0.5) * 0.3) { put(d, o, FROST.rgb[ice > 1.15 ? 6 : ice > 0.85 ? 5 : 4]); continue; }   // ice crystals
            if (haze > 0) {                                                   // the haze: what is behind turns pale, its shapes still there
                const l = lum(d[o], d[o + 1], d[o + 2]), hz = Math.min(1, haze);
                put(d, o, FROST.rgb[P.level(FROST, l * (1.15 - hz * 0.45) + hz * 0.4, X, Y)]);
            }
            if (melt > 0 && melt < 1 && (lx + i * 2) % 6 === 0 && fr.ice[Math.max(0, gy - 4) * W.w + lx] - melt * 1.5 > 0.5 && thr < 0.55) put(d, o, FROST.rgb[3]);   // water running down
            else if (((gy < 9 && Math.abs(lx - (W.w - 4) + gy * 0.6) < 0.55) || (gy > 32 && gy < 56 && Math.abs(lx - (W.w - 3) + (gy - 32) * 0.45) < 0.55)) && thr < 0.6) put(d, o, FROST.rgb[5]);   // the sheen, clear of the face
        }
        if (s.level > 0 && !open) BUBBLES.forEach(([bx, per, ph]) => {      // bubbles rising through the fluid
            const k = ((t + ph + i * 311) % per) / per, by = Math.round(bottom - 2 - k * (bottom - surf - 3));
            if (by > surf && by < bottom && fr.ice[(by - W.y) * W.w + bx] - melt * 1.7 <= 0.5) put(d, ((by - W.y) * W.w + bx) * 4, GEL.rgb[6]);
        });
        c.putImageData(img, W.x, W.y);
    }

    // ── someone on the floor, lit by the nearest of the hold's lamps (as the tower and the bridge light them) ──
    function lightFor(x) {
        const near = LAMPS.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a)), dx = near - x;
        return { warm: Math.round(3 * Math.exp(-Math.abs(dx) / 55)), rim: Math.abs(dx) > 6 && Math.abs(dx) < 120 ? Math.sign(dx) : 0 };
    }
    function person(c, id, x, act, ms, facing, o) {
        const opt = o || {}, ll = lightFor(x);
        const Sp = CE.sprite(id, act, CE.frameAt(act, ms), { blink: !!opt.blink, warm: ll.warm, rim: ll.rim * facing, screen: false });
        const X = Math.round(x), Y = F + Math.round(opt.dy || 0) - Sp.origin.y;
        if (facing > 0) c.drawImage(Sp.canvas, X - Sp.origin.x, Y);
        else { c.save(); c.translate(X + 1, 0); c.scale(-1, 1); c.drawImage(Sp.canvas, -Sp.origin.x, Y); c.restore(); }
        return { X, Y, Sp, facing };
    }

    // ── the panel's pixels: lit valve plates, icons, the stage marks ──
    const sprites = new Map();
    function sprite(key, w, h, paintIt) {
        if (sprites.has(key)) return sprites.get(key);
        const cv = mk(w, h); paintIt(cv.getContext('2d'));
        if (sprites.size > 160) sprites.clear();
        sprites.set(key, cv);
        return cv;
    }
    const phase = v => ((Math.round(v) % 8) + 8) % 8;
    const mixHex = (a, b, k) => { const x = hexRgb(a), y = hexRgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
    /** A valve plate set in the panel (the helm key's recipe, in the fluid's own colour): a recess, a dithered face, a lit
        top edge; brighter when pointed at, pressed in (a row lower, darker) when opened, dim while a fluid runs. */
    function valve(c, x, y, w, h, hex, state) {
        x = Math.round(x); y = Math.round(y);
        const st = state || 'idle', r = TA.ramp(hex);
        const face = P.ramp(INK, mixHex(hex, INK, 0.9), mixHex(hex, INK, 0.8), mixHex(hex, INK, 0.66), mixHex(hex, INK, 0.5));
        const lvl = { idle: 0.5, hot: 0.74, down: 0.4, dim: 0.26 }[st] || 0.5, down = st === 'down' ? 1 : 0;
        c.drawImage(sprite(`valve:${w}x${h}:${hex}:${st}:${phase(x)}:${phase(y)}`, w + 2, h + 2, g => {
            g.fillStyle = INK; g.fillRect(0, 0, w + 2, h + 2);
            for (let yy = down; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
                const k = P.level(face, lvl - (yy - down) / h * 0.28, x + xx, y + yy);
                if (k) { g.fillStyle = face.hex[k]; g.fillRect(xx + 1, yy + 1, 1, 1); }
            }
            g.fillStyle = r[st === 'hot' ? 3 : st === 'down' ? 2 : st === 'dim' ? 0 : 2]; g.fillRect(1, 1 + down, w, 1);   // the lit top edge
            g.fillStyle = r[0]; g.fillRect(1, h, w, 1);
            if (st === 'hot') { g.fillStyle = r[1]; g.fillRect(1, 1, 1, h); g.fillRect(w, 1, 1, h); }
            g.fillStyle = r[st === 'hot' ? 3 : 1]; g.fillRect(1, 1 + down, 1, 1); g.fillRect(w, 1 + down, 1, 1);
        }), x - 1, y - 1);
    }
    const ICONS = {
        warm: ['....3....', '...33....', '...343...', '..3443...', '..34443..', '.3443443.', '.3442443.', '..34443..', '...333...'],
        flush: ['....3....', '....3....', '...343...', '...343...', '..34443..', '.3444443.', '.3444443.', '..34443..', '...333...'],
        wake: ['.........', '.33...33.', '3443.3443', '344444443', '.3444443.', '..34443..', '...343...', '....3....', '.........'],
    };
    function icon(c, name, x, y, hex, lift) {
        const map = ICONS[name];
        if (!map) return;
        const r = TA.ramp(hex), up = lift || 0;
        c.drawImage(sprite(`icon:${name}:${hex}:${up}`, 9, 9, g => map.forEach((row, yy) => { for (let xx = 0; xx < 9; xx++) { const v = row[xx]; if (v === '.') continue; g.fillStyle = r[Math.max(0, Math.min(3, Number(v) - 1 + up))]; g.fillRect(xx, yy, 1, 1); } })), Math.round(x), Math.round(y));
    }
    /** Three stage marks, 3 x 3 squares, 2 apart: done in the colour of the fluid that cleared it (red: a wrong valve first);
        the next one grey, blinking; the others dim. */
    function pips(c, x, y, marks, next, t, still) {
        x = Math.round(x); y = Math.round(y);
        for (let i = 0; i < 3; i++) {
            const px = x + i * 5, m = marks[i];
            if (m) { const r = TA.ramp(m); c.fillStyle = r[1]; c.fillRect(px, y, 3, 3); c.fillStyle = r[3]; c.fillRect(px + 1, y + 1, 1, 1); continue; }
            const on = i === next && (still || Math.floor(t / 375) % 2 === 0);
            c.fillStyle = i === next ? (on ? '#a9b6bc' : '#4b5a61') : '#263035';
            c.fillRect(px, y, 3, 3);
        }
    }
    /** The fluid running down the thread into the pod: a short bright run at k (0..1) along the line. */
    function pulse(c, pts, hex, k) {
        const all = [];
        for (let i = 1; i < pts.length; i++) {
            const seg = TA.linePts(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
            seg.forEach((q, j) => { if (i === 1 || j > 0) all.push(q); });
        }
        if (!all.length) return;
        const r = TA.ramp(hex), head = Math.round(clamp01(k) * (all.length - 1));
        for (let j = 0; j < 6; j++) { const q = all[head - j]; if (!q) break; c.fillStyle = r[j < 2 ? 3 : j < 4 ? 2 : 1]; c.fillRect(q[0], q[1], 1, 1); }
    }
    /** The seal lets go: a breath of cold vapour out of the pod's foot, both sides, thinning as it spreads. */
    function vapour(c, i, k) {
        const p = PODS[i], f = P.framer(c, SW, SH), kk = clamp01(k);
        if (kk <= 0 || kk >= 1) return;
        for (let n = 0; n < 26; n++) {
            const side = n % 2 ? 1 : -1, a = P.hash(n, 3, 17), reach = 6 + 22 * kk * (0.5 + a), x = p.x + side * (16 + reach * (0.4 + 0.6 * P.hash(n, 5, 17))), y = F - 3 - Math.round(P.hash(n, 7, 17) * 10 * kk);
            if ((1 - kk) * 0.9 > threshold(Math.round(x), y)) f.px(x, y, ICE.hex[kk < 0.4 ? 6 : 5]);
        }
    }
    let masks = null;
    function mask(j) {
        if (!masks) masks = Array.from({ length: 8 }, (_, k) => {
            const c = mk(SW, SH), g = c.getContext('2d'), img = g.createImageData(SW, SH);
            for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (threshold(x, y) < (k + 1) / 8) img.data[(y * SW + x) * 4 + 3] = 255;
            g.putImageData(img, 0, 0); return c;
        });
        return masks[Math.max(0, Math.min(7, j))];
    }

    window.NSPodArt = Object.freeze({ SW, SH, OFFX, TOP, F, PODS, FLUID, INTERCOM, prepare, room, fx, pod, person, valve, icon, pips, pulse, vapour, mask });
})();
