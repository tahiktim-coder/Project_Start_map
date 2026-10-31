/* ═══ Silent Exodus · new screen (?new=1) · dock/DockFace.js: the station's face, for the flown docking ═══════════════
   Bring Her In (prototypes/ideas/bring-her-in, approved 2026-10-23): the station's face from the game's docking camera, for
   the docking flown from the bridge glass (dock/DockFlight.js). Everything between the two COPIED markers is
   src/systems/DockingGame.js, copied unchanged (its constants, then lines 92-270: the ramps kit, stationPixel, drawStation,
   radiusAt), so the ring, its spokes, panels, running lights and the one lit port are the game's own pixels. Below the copy,
   Bring Her In's own: paint() lays the same face into the flight's 720 x 405 pixel buffer (DockFlight.js) at any centre and
   size, without the old marker, and lamp() is the port's light while the station is still a point; facePixel() is
   stationPixel without the per-pixel arrays, checked pixel for pixel against it (check()). The old look keeps DockingGame.js.
   Loaded only when the new-screen switch is on (index.html).
     DockFace.paint(buf, depth, AW, AH, hx, hy, rd, phi, tick, isLined, z)   the face: hub at (hx, hy), radius rd (art px),
                                            the port at phi degrees clockwise from up, depth z for what is behind it
     DockFace.lamp(buf, AW, AH, x, y, rad, tick)   the port's amber light far off: a point and its halo, blinking as the port
     DockFace.lights(buf, AW, AH, hx, hy, rd, phi, b)   the sketch's own: the port's lights along the ring, three pairs (b:
                                            each pair's brightness), on while the port is lined up (the port stays amber)
     DockFace.check(n)                     how many of n random points differ from the copied stationPixel (0)
     DockFace.SOFT, DockFace.PORT_HALF     the game's soft-contact limits and the port's half-width in degrees */
(function () {
    'use strict';
    // ── COPIED from src/systems/DockingGame.js (unchanged) ──
    const W = 320, H = 180, VIEW_H = 140, CX = 160, CY = 70;                 // buffer; the camera view is the top VIEW_H rows
    const START_DIST = 80, START_SPEED = 3, MAX_SPEED = 8, MAX_DIST = 120;    // metres, metres per second
    const THRUST = 1.2, ROLL_ACCEL = 20, SPIN_MIN = 16, SPIN_MAX = 32;         // m/s², degrees/s², the ring's spin in degrees/s
    const SOFT = { speed: 1.2, roll: 4, port: 12 }, ROUGH = { speed: 2.5, roll: 12, port: 30 }; // contact limits: m/s, degrees/s of spin left, degrees off the marker
    const R_MIN = 22, R_MAX = 60, GROWTH = 1.6;                               // station radius on screen, far to near
    const PORT_HALF = 14, RESULT_HOLD_MS = 2000, MAX_STEP = 0.033, TICK_MS = 125, ATTACH_GRACE_MS = 5000;
    const BONE = '#c4d0c4', AMBER = '#d9a24a', RED = '#d85a4e', GREEN = '#74d99a';   // the grade colours (GRADES, kept for callers)
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const wrap = deg => { const d = ((deg % 360) + 540) % 360 - 180; return d === -180 ? 180 : d; };
    function seeded(id) {
        let s = 19;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    // ── drawing: the travel view's recipe (ramps from the ink, 8 × 8 Bayer dither, seeded noise, one light), redrawn at 8 fps ──
    const D = 2.25, AW = Math.round(W * D), AH = Math.round(H * D);            // the picture in art pixels: 720 × 405
    const DEG = 180 / Math.PI, RAD = Math.PI / 180;
    const LEVEL_INK = '#7fd3a0', CAUTION_INK = '#f0a24a', DANGER_INK = '#e2574c', QUIET_INK = '#c9d1d6', ICE_INK = '#9fd8e6', ICE_DIM = '#3d6670';
    const inkOf = c => (c === GREEN ? LEVEL_INK : c === AMBER ? CAUTION_INK : c === RED ? DANGER_INK : QUIET_INK);   // the old phosphor colours → the travel view's
    const LIGHT = (() => { const x = -0.45, y = -0.6, z = 0.66, n = Math.hypot(x, y, z); return [x / n, y / n, z / n]; })();   // from the upper left, as before
    const SHIP_LEN = 24, SHIP_Y = VIEW_H + 20.5, NOSE_AT = 283, TRAVEL = 250, FACE_X = 285;   // the strip: our Lander, where its nose meets the station
    const FIELD_R = Math.ceil(Math.hypot(CX, CY)) + 4;                         // the far field (haze and dust) turns with the roll: sampled out to here

    /** Without art/MiniPaint.js: the same ramps and dither, no noise (plain space). Never expected, but the game stays playable. */
    function plainPaint() {
        const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
            3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map(v => (v + 0.5) / 64);
        const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
        const ramp = (...hex) => ({ hex, rgb: hex.map(hexRgb) }), I = '#05070a';
        const level = (r, v, x, y) => { const top = r.hex.length - 1, pos = clamp(v, 0, 1) * top, lo = Math.floor(pos); return Math.min(top, lo + (pos - lo > B8[((y & 7) << 3) | (x & 7)] ? 1 : 0)); };
        return {
            INK: I, ramp, level, vnoise: () => 0.5, fbm: () => 0,
            RP: {
                STAR: ramp(I, '#1b272c', '#4c5f66', '#b3c2c0', '#f6f1e4'), HAZE: ramp(I, '#0a1317', '#0f222a', '#152f38', '#1f3a43'),
                DUST: ramp(I, '#160f0b', '#2c1a10', '#4e2f1a', '#7c4a26', '#b0733c'), SUN: ramp(I, '#1f140b', '#4a2e12', '#9a5a26', '#e9a25e', '#f7c483', '#fff3dc'),
                HULL: ramp(I, '#121c22', '#22333b', '#3d5560', '#8aa2aa', '#e6eef0'), UI: ramp(I, '#13232a', '#284650', '#3d6670', '#9fd8e6', '#e1f6fb'),
                AMBER: ramp(I, '#3a2410', '#8a5422', '#e8964a', '#f7c483', '#fff3dc'), PLUME: ramp(I, '#0e1a26', '#183048', '#2a5878', '#5a9cc4', '#b4e2f4', '#f2fbff'),
            },
        };
    }

    /** The kit, worked out once: the recipes, the ramps, the far field and the stars. */
    let kit = null;
    function art() {
        if (kit) return kit;
        const P = window.MiniPaint || plainPaint(), RP = P.RP, I = P.INK;
        const R = {
            STAR: RP.STAR, HAZE: RP.HAZE, DUST: RP.DUST, SUN: RP.SUN, HULL: RP.HULL, PANEL: RP.UI, AMBER: RP.AMBER, PLUME: RP.PLUME,
            GREEN: P.ramp(I, '#0f2a1e', '#1f5a3e', '#3f9a6c', '#7fd3a0', '#d6f6e2'),            // the port when it is lined up (LEVEL_INK's ramp)
        };
        const n = FIELD_R * 2 + 1, dust = new Float32Array(n * n), haze = new Float32Array(n * n);   // one sample per physics px
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            dust[y * n + x] = Math.max(0, P.fbm(x / 23, y / 13, 41, 4) - 0.5) * 3.4 * 0.24;
            haze[y * n + x] = Math.max(0, P.fbm(x / 35, y / 19, 34, 4) - 0.5) * 1.15 * 0.72;
        }
        const rand = seeded('dock-stars');
        const stars = Array.from({ length: 360 }, () => ({ a: rand() * 360, d: 6 + Math.sqrt(rand()) * (FIELD_R - 6), mag: rand() }));
        const stripStars = Array.from({ length: 60 }, () => ({ x: rand() * W, y: VIEW_H + 2 + rand() * (H - VIEW_H - 4), mag: rand() }));
        kit = { P, R, n, dust, haze, stars, stripStars, ink: P.ramp(I).rgb[0] };
        return kit;
    }

    /** The picture's pixel buffer for this canvas (kept between frames). */
    const buffers = new WeakMap();
    function bufferFor(canvas) {
        let B = buffers.get(canvas);
        if (B && B.w === canvas.width && B.h === canvas.height) return B;
        const img = new ImageData(canvas.width, canvas.height);
        B = { w: canvas.width, h: canvas.height, img, data: img.data, d32: new Uint32Array(img.data.buffer) };
        buffers.set(canvas, B);
        return B;
    }
    const put = (B, x, y, rgb) => { const o = (y * B.w + x) * 4; B.data[o] = rgb[0]; B.data[o + 1] = rgb[1]; B.data[o + 2] = rgb[2]; B.data[o + 3] = 255; };
    /** A ramp tone at art pixel (x, y); solid paints the ink too, otherwise the darkest step is left as it is. */
    function tone(B, P, x, y, ramp, v, isSolid) {
        if (x < 0 || y < 0 || x >= B.w || y >= B.h) return;
        const k = P.level(ramp, v, x, y);
        if (k > 0 || isSolid) put(B, x, y, ramp.rgb[k]);
    }
    /** Light spilling from a lamp: only ever brightens what is there. */
    function glow(B, P, cx, cy, rad, ramp, peak, yMax) {
        for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(yMax - 1, Math.ceil(cy + rad)); y++) {
            for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(B.w - 1, Math.ceil(cx + rad)); x++) {
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / rad;
                if (d >= 1) continue;
                const k = P.level(ramp, peak * (1 - d) ** 1.6, x, y);
                if (k === 0) continue;
                const c = ramp.rgb[k], o = (y * B.w + x) * 4;
                if (c[0] + c[1] + c[2] > B.data[o] + B.data[o + 1] + B.data[o + 2]) put(B, x, y, c);
            }
        }
    }
    const rect = (B, x, y, w, h, rgb) => { for (let j = Math.max(0, Math.round(y)); j < Math.min(B.h, Math.round(y + h)); j++) for (let i = Math.max(0, Math.round(x)); i < Math.min(B.w, Math.round(x + w)); i++) put(B, i, j, rgb); };
    const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

    const radiusAt = dist => clamp(R_MIN + (R_MAX - R_MIN) * Math.pow(clamp(1 - dist / START_DIST, 0, 1), GROWTH), 12, R_MAX);

    /** Deep space through the camera: teal haze, a little rust dust and the stars, all turning as the ship rolls. */
    function drawSky(B, K, s, d, tick) {
        const { P, R, n, dust, haze } = K, vh = Math.round(VIEW_H * d), c = Math.cos(s.roll * RAD), sn = Math.sin(s.roll * RAD);
        for (let y = 0; y < vh; y++) {
            const uy = (y + 0.5) / d - CY;
            for (let x = 0; x < B.w; x++) {
                const ux = (x + 0.5) / d - CX, fx = Math.round(ux * c - uy * sn) + FIELD_R, fy = Math.round(uy * c + ux * sn) + FIELD_R;
                if (fx < 0 || fy < 0 || fx >= n || fy >= n) continue;
                const i = fy * n + fx, vd = dust[i], vz = haze[i];
                if (vd > 0.2 && vd * 0.75 > vz) tone(B, P, x, y, R.DUST, (vd - 0.08) * 0.8);
                else if (vz > 0.03) tone(B, P, x, y, R.HAZE, vz);
            }
        }
        const twinkleStep = Math.floor(tick / 3);
        K.stars.forEach((st, i) => {
            const a = (st.a - s.roll) * RAD, x = Math.round((CX + st.d * Math.sin(a)) * d), y = Math.round((CY - st.d * Math.cos(a)) * d);
            if (x < 1 || x >= B.w - 1 || y < 1 || y >= vh - 2) return;
            const isTwinkling = st.mag > 0.87 && ((i * 7 + twinkleStep * 13) % 23) === 0;
            if (st.mag > 0.975 || isTwinkling) { put(B, x, y, R.STAR.rgb[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => put(B, x + dx, y + dy, R.STAR.rgb[2])); }
            else put(B, x, y, R.STAR.rgb[st.mag > 0.87 ? 3 : st.mag > 0.5 ? 2 : 1]);
        });
    }

    /** One art pixel of the station face: [ramp, tone], or null for none. rr 0..1 from the hub, local degrees from the port. */
    function stationPixel(K, rr, ux, uy, local, edge, tick, isLined) {
        const { P, R } = K, L = LIGHT;
        if (Math.abs(local) <= PORT_HALF && rr > 0.68) {                                                   // the port: a lit bay, a dark door
            const isDoor = Math.abs(local) < PORT_HALF * 0.45 && rr > 0.76 && rr < 0.93;
            if (isDoor) return [R.HULL, Math.abs(local) > PORT_HALF * 0.36 || rr < 0.78 || rr > 0.91 ? 0.36 : 0.04];   // its frame catches the bay's light
            if (Math.abs(local) > PORT_HALF - 1.6 || rr > 0.985) return [R.HULL, 0.62];
            const lit = isLined ? 0.84 : tick % 4 < 2 ? 0.86 : 0.55;
            return [isLined ? R.GREEN : R.AMBER, lit * (0.72 + 0.28 * (1 - Math.abs(local) / PORT_HALF))];
        }
        if (rr < 0.22) {                                                                                     // the hub: a steel dome
            const q = rr / 0.22, nz = Math.sqrt(Math.max(0, 1 - 0.7 * q * q)), lam = Math.max(0, (ux * q * 0.84 * L[0] + uy * q * 0.84 * L[1] + nz * L[2]));
            if (rr > 0.12 && rr < 0.18 && Math.abs(wrap(local * 4)) < 20) return [R.PANEL, 0.5];             // four windows, cold-lit
            let v = 0.08 + 0.68 * lam;
            if (q > 0.86 && q < 0.94) v *= 0.55;
            if (q < 0.2) v *= 0.6;                                                                            // the axle's mouth
            return [R.HULL, v];
        }
        if (rr < 0.66) {
            if (rr < 0.26) { const t = (rr - 0.24) / 0.02; return [R.HULL, 0.1 + 0.55 * Math.max(0, ux * t * L[0] + uy * t * L[1] + Math.sqrt(Math.max(0, 1 - t * t)) * L[2])]; }   // the collar
            const a6 = wrap(local * 6);
            if (Math.abs(a6) < 36) {                                                                          // six spokes, round, lit from one side
                const t = a6 / 36, tx = -uy * t * 0.9, ty = ux * t * 0.9, nz = Math.sqrt(Math.max(0, 1 - 0.81 * t * t));
                let v = 0.1 + 0.62 * Math.max(0, tx * L[0] + ty * L[1] + nz * L[2]);
                if ((rr * 12.5) % 1 < 0.1) v *= 0.7;
                return [R.HULL, v];
            }
            if (Math.abs(a6) < 41) return [R.HULL, 0.05];                                                     // the spoke's shadow
            const row = (rr - 0.26) / 0.08, col = wrap(local * 30);                                           // the panels between, in a grid
            if (row % 1 < 0.1 || Math.abs(col) < 30) return [R.PANEL, 0.1];
            const cell = Math.floor(row) * 7 + Math.floor((local + 360) / 12);
            return [R.PANEL, 0.22 + 0.07 * ((cell * 37) % 5) / 4 + 0.1 * (-(ux + uy) * rr * 0.5) + 0.05 * (1 - rr)];
        }
        if (rr < 0.7) return Math.abs(wrap(local * 6)) < 20 ? [R.HULL, 0.28] : [R.HULL, 0.03];              // the gap under the ring, the struts across it
        if (rr < 0.95) {                                                                                     // the docking ring: a torus, in twelve segments
            const t = (rr - 0.825) / 0.125, nz = Math.sqrt(Math.max(0, 1 - t * t));
            const lam = Math.max(0, ux * t * L[0] + uy * t * L[1] + nz * L[2]);
            let v = 0.07 + 0.8 * Math.pow(lam, 1.3);
            if (Math.abs(wrap(local * 12)) < 16) v *= 0.5;
            v *= 0.86 + 0.26 * P.vnoise((local + 360) * 0.22, rr * 26, 3);
            if (Math.abs(rr - 0.9) < 0.022 && [90, -90, 180].some(k => Math.abs(wrap(local - k)) < 1.5)) return [R.PANEL, tick % 8 < 4 ? 0.95 : 0.5];   // three running lights
            return [R.HULL, v];
        }
        const facing = ux * L[0] + uy * L[1];                                                                 // the rim: a bright edge where the light hits
        if (edge < 1.3 && facing > 0.2) return [R.HULL, 0.92];
        return [R.HULL, 0.1 + 0.5 * Math.max(0, ux * 0.8 * L[0] + uy * 0.8 * L[1] + 0.6 * L[2])];
    }

    /** The station face, turning with the ring; the port's light spills over it; the marker your hatch lines up with, fixed at the top. */
    function drawStation(B, K, s, d, isLined, tick) {
        const { P, R } = K, Rad = radiusAt(s.dist), phi = portAngle(s), rd = Rad * d, cx = CX * d, cy = CY * d, vh = Math.round(VIEW_H * d);
        for (let y = Math.max(0, Math.floor(cy - rd)); y <= Math.min(vh - 1, Math.ceil(cy + rd)); y++) {
            for (let x = Math.max(0, Math.floor(cx - rd)); x <= Math.min(B.w - 1, Math.ceil(cx + rd)); x++) {
                const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dist = Math.hypot(dx, dy);
                if (dist > rd) continue;
                const rr = dist / rd, ux = dist ? dx / dist : 0, uy = dist ? dy / dist : 0;
                const local = wrap(Math.atan2(dx, -dy) * DEG - phi);
                const px = stationPixel(K, rr, ux, uy, local, rd - dist, tick, isLined);
                if (px) tone(B, P, x, y, px[0], px[1], true);
            }
        }
        const glowOn = isLined || tick % 4 < 2, pr = rd * 0.84;                                              // the port's light, the one warm thing
        glow(B, P, cx + pr * Math.sin(phi * RAD), cy - pr * Math.cos(phi * RAD), Math.max(6, rd * 0.42), isLined ? R.GREEN : R.AMBER, glowOn ? 0.62 : 0.32, vh);
        const isFacing = Math.abs(phi) <= SOFT.port, ink = rgbOf(isFacing ? LEVEL_INK : ICE_INK), dim = rgbOf(isFacing ? '#3f9a6c' : ICE_DIM);
        const my = Math.max(3, Math.round(CY - Rad - 6)), k = Math.max(1, Math.round(d * 0.9));
        rect(B, (CX - 9) * d, (my - 3) * d, k, 6 * d, ink); rect(B, (CX + 9) * d - k, (my - 3) * d, k, 6 * d, ink);   // the marker: a bracket over the ring
        rect(B, (CX - 9) * d, (my - 3) * d, 18 * d, k, ink);
        for (let y = 2; y < my - 5; y += 4) rect(B, CX * d - k / 2, y * d, k, k, dim);                       // and a dotted line up from it
    }

    /** The strip under the camera: space, the distance in tens of metres, and the station side on at the right: the docking
        ring's edge (a cylinder lit from the left, in segments), the panels behind it, the collar reaching out at the ship's
        height with the port's light round it (amber, green when lined up, as in the camera). */
    // ── end of COPIED ──

    // ══ the sketch's own: the face in the flight's pixel buffer (Uint32, little-endian ABGR) ══
    // stationPixel above, written again without making a new array per pixel (a full window of face is 290,000 pixels a
    // frame): the same branches and numbers in the same order, so the pixels are the same (checked against stationPixel
    // on a million random points: DockFace.check()). It returns which ramp and leaves the tone in `fv`.
    const fwrap = deg => { const d = deg - 360 * Math.floor((deg + 180) / 360); return d === -180 ? 180 : d; };   // wrap() with one floor for two %
    const HULL = 0, PANEL = 1, AMBER_R = 2, GREEN_R = 3;
    let fv = 0;
    /** The sketch's own port (level-up, 2026-10-23), in place of the game's flat amber sector: the docking collar as the
        camera outside draws it (dock-exterior.js), seen face on. A square collar on the ring (its outer lip lit where it
        faces the light), the clamps folded flat in its corners and its four lamp points (lit while we are lined up); in
        it the recessed bay (its walls, one in shade, one lit), dark steel warmed by a thin lit frame round the dark door
        (two leaves), the warm light falling off into the recess, dithered. Square in the ring's own frame: a, along the
        ring, b, out from the hub, in face radii, from the port's middle. Returns the ramp (fv its tone), or -1 outside. */
    const BAYF = { at: 0.84, half: 0.16, lip: 0.016, bay: 0.09, wall: 0.012, door: 0.048, frame: 0.011, fall: 0.02, clamp: 0.052, cw: 0.0075, lamp: 0.0065, drop: 0.022 };
    function bayPixel(rr, ux, uy, local, tick, isLined) {
        const F = BAYF, a = local * RAD * rr, b = rr - F.at, A = Math.abs(a), Bb = Math.abs(b), m = Math.max(A, Bb);
        if (m >= F.half) return -1;
        const sa = Math.sign(a) || 1, sb = Math.sign(b) || 1;
        const fa = (-uy * LIGHT[0] + ux * LIGHT[1]) * sa, fb = (ux * LIGHT[0] + uy * LIGHT[1]) * sb, facing = A >= Bb ? fa : fb;   // how far the outward faces look at the light
        if (m > F.half - F.lip) { fv = facing > 0.1 ? 0.95 : facing < -0.1 ? 0.2 : 0.6; return HULL; }       // the collar's outer lip
        if (m > F.bay + F.wall) {                                                                               // the collar's top
            const band = (F.bay + F.wall + F.half - F.lip) / 2, along = a * b > 0;                               // the clamps lie round it like a pinwheel
            if (Math.hypot(A - band, Bb - band) < F.cw * 1.3) { fv = Math.hypot(A - band, Bb - band) < F.cw * 0.5 ? 0.6 : 0.16; return HULL; }   // a clamp's hinge in its corner
            if (along ? Math.abs(A - band) < F.cw && Bb > band - F.clamp && Bb < band : Math.abs(Bb - band) < F.cw && A > band - F.clamp && A < band) {
                const k = (along ? A - band : Bb - band) / F.cw, f = along ? fa : fb;                           // a clamp, folded flat along the edge
                fv = Math.abs(k) > 0.55 ? (k * f > 0 ? 0.86 : 0.12) : 0.44; return HULL;
            }
            if (Math.hypot(Math.min(A, Bb), m - band) < F.lamp) { fv = isLined ? 0.98 : 0.3; return PANEL; }    // a lamp point, mid-edge
            fv = 0.56 + 0.06 * ((Math.floor((a + 1) * 90) * 7 + Math.floor((b + 1) * 90) * 3) % 5) / 4;       // steel plate
            return HULL;
        }
        if (m > F.bay) { fv = facing < 0 ? 0.6 : 0.2; return facing < 0 ? HULL : AMBER_R; }                    // the recess walls: the far one lit, the near one in shade, warm
        if (m > F.door + F.frame) { fv = 0.08 + 0.4 * Math.exp(-(m - F.door - F.frame) / F.fall); return AMBER_R; }   // the floor, warm near the frame
        if (m > F.door) { fv = isLined ? 0.86 : tick % 4 < 2 ? 0.88 : 0.6; return AMBER_R; }                    // the thin lit frame (blinking until we are lined up)
        fv = m > F.door - 0.006 ? 0.34 : A < 0.003 ? 0.14 : 0.04;                                              // the dark door, its edge and its two leaves
        return HULL;
    }
    /** The port (bayPixel), and the collar's shadow on the ring round it (it stands off the face: the light from the upper
        left puts its shadow to the lower right); elsewhere the game's face. */
    function facePixel(rr, ux, uy, local, edge, tick, isLined, vnoise) {
        if (rr > 0.66 && local > -24 && local < 24) {
            const id = bayPixel(rr, ux, uy, local, tick, isLined);
            if (id >= 0) return id;
            const a = local * RAD * rr + (LIGHT[1] * ux - LIGHT[0] * uy) * BAYF.drop, b = rr - BAYF.at + (LIGHT[0] * ux + LIGHT[1] * uy) * BAYF.drop;
            if (Math.max(Math.abs(a), Math.abs(b)) < BAYF.half) { const k = gameFace(rr, ux, uy, local, edge, tick, isLined, vnoise); fv *= 0.42; return k; }
        }
        return gameFace(rr, ux, uy, local, edge, tick, isLined, vnoise);
    }
    function gameFace(rr, ux, uy, local, edge, tick, isLined, vnoise) {
        const L = LIGHT;
        if (rr < 0.22) {                                                                       // the hub: a steel dome
            const q = rr / 0.22, nz = Math.sqrt(Math.max(0, 1 - 0.7 * q * q)), lam = Math.max(0, (ux * q * 0.84 * L[0] + uy * q * 0.84 * L[1] + nz * L[2]));
            if (rr > 0.12 && rr < 0.18 && Math.abs(fwrap(local * 4)) < 20) { fv = 0.5; return PANEL; }
            let v = 0.08 + 0.68 * lam;
            if (q > 0.86 && q < 0.94) v *= 0.55;
            if (q < 0.2) v *= 0.6;
            fv = v; return HULL;
        }
        if (rr < 0.66) {
            if (rr < 0.26) { const t = (rr - 0.24) / 0.02; fv = 0.1 + 0.55 * Math.max(0, ux * t * L[0] + uy * t * L[1] + Math.sqrt(Math.max(0, 1 - t * t)) * L[2]); return HULL; }
            const a6 = fwrap(local * 6);
            if (Math.abs(a6) < 36) {                                                           // six spokes
                const t = a6 / 36, tx = -uy * t * 0.9, ty = ux * t * 0.9, nz = Math.sqrt(Math.max(0, 1 - 0.81 * t * t));
                let v = 0.1 + 0.62 * Math.max(0, tx * L[0] + ty * L[1] + nz * L[2]);
                if ((rr * 12.5) % 1 < 0.1) v *= 0.7;
                fv = v; return HULL;
            }
            if (Math.abs(a6) < 41) { fv = 0.05; return HULL; }
            const row = (rr - 0.26) / 0.08, col = fwrap(local * 30);
            if (row % 1 < 0.1 || Math.abs(col) < 30) { fv = 0.1; return PANEL; }
            const cell = Math.floor(row) * 7 + Math.floor((local + 360) / 12);
            fv = 0.22 + 0.07 * ((cell * 37) % 5) / 4 + 0.1 * (-(ux + uy) * rr * 0.5) + 0.05 * (1 - rr); return PANEL;
        }
        if (rr < 0.7) { fv = Math.abs(fwrap(local * 6)) < 20 ? 0.28 : 0.03; return HULL; }
        if (rr < 0.95) {                                                                       // the docking ring
            const t = (rr - 0.825) / 0.125, nz = Math.sqrt(Math.max(0, 1 - t * t));
            const lam = Math.max(0, ux * t * L[0] + uy * t * L[1] + nz * L[2]);
            let v = 0.07 + 0.8 * Math.pow(lam, 1.3);
            if (Math.abs(fwrap(local * 12)) < 16) v *= 0.5;
            v *= 0.86 + 0.26 * vnoise((local + 360) * 0.22, rr * 26, 3);
            if (Math.abs(rr - 0.9) < 0.022 && (Math.abs(fwrap(local - 90)) < 1.5 || Math.abs(fwrap(local + 90)) < 1.5 || Math.abs(fwrap(local - 180)) < 1.5)) { fv = tick % 8 < 4 ? 0.95 : 0.5; return PANEL; }
            fv = v; return HULL;
        }
        const facing = ux * L[0] + uy * L[1];                                                 // the rim
        if (edge < 1.3 && facing > 0.2) { fv = 0.92; return HULL; }
        fv = 0.1 + 0.5 * Math.max(0, ux * 0.8 * L[0] + uy * 0.8 * L[1] + 0.6 * L[2]); return HULL;
    }

    const packs = new WeakMap();
    /** A ramp's colours as the flight's 32-bit pixels. */
    function pack(ramp) {
        let c = packs.get(ramp);
        if (!c) { c = Uint32Array.from(ramp.rgb.map(([r, g, b]) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0)); packs.set(ramp, c); }
        return c;
    }
    let tables = null;
    /** The four ramps the face uses, packed, with their top steps; and the dither's 8 x 8 thresholds. */
    function faceTables() {
        if (tables) return tables;
        const K = art(), list = [K.R.HULL, K.R.PANEL, K.R.AMBER, K.R.GREEN];
        const B8 = Float32Array.from({ length: 64 }, (_, i) => (K.P.threshold ? K.P.threshold(i & 7, i >> 3) : ((i * 37) % 64 + 0.5) / 64));
        tables = { K, list, c32: list.map(pack), top: list.map(r => r.hex.length - 1), B8 };
        return tables;
    }
    const FALL = Float32Array.from({ length: 2049 }, (_, i) => (1 - Math.sqrt(i / 2048)) ** 1.6);   // (1 - d)^1.6 by d²
    const sum32 = p => (p & 255) + ((p >> 8) & 255) + ((p >> 16) & 255);
    /** Light spilling from a lamp into the buffer (glow() above, for 32-bit pixels): only ever brightens what is there. */
    function glow32(buf, AW, AH, cx, cy, rad, ramp, peak) {
        const { B8 } = faceTables(), c32 = pack(ramp), top = ramp.hex.length - 1, rgbSum = ramp.rgb.map(c => c[0] + c[1] + c[2]), inv2 = 1 / (rad * rad);
        for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(AH - 1, Math.ceil(cy + rad)); y++) {
            const ey = y + 0.5 - cy, row = y * AW, by = (y & 7) << 3;
            for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(AW - 1, Math.ceil(cx + rad)); x++) {
                const ex = x + 0.5 - cx, q = (ex * ex + ey * ey) * inv2;
                if (q >= 1) continue;
                const v = peak * FALL[(q * 2048) | 0], pos = (v < 0 ? 0 : v > 1 ? 1 : v) * top, lo = Math.floor(pos), k = Math.min(top, lo + (pos - lo > B8[by | (x & 7)] ? 1 : 0));
                if (k === 0) continue;
                const i = row + x;
                if (rgbSum[k] > sum32(buf[i])) buf[i] = c32[k];
            }
        }
    }
    /** The station face into the flight's buffer: drawStation's face and its port light, at hub (hx, hy) art px and radius
        rd, without the old marker over it. Solid: it hides the sky behind it, and marks its depth z. Up to BLOCK_FROM px
        every pixel is worked out; past it (the ring filling the glass, its every feature many pixels wide) the face is
        worked out once per 2 x 2 pixels and each pixel still gets its own dither step, so the grain stays one art pixel. */
    const BLOCK_FROM = 230;
    function paint(buf, depth, AW, AH, hx, hy, rd, phi, tick, isLined, z) {
        const T = faceTables(), vn = T.K.P.vnoise, rd2 = rd * rd, inv = 1 / rd, B8 = T.B8, step = rd > BLOCK_FROM ? 2 : 1, c = step / 2;
        let y0 = Math.max(0, Math.floor(hy - rd)), y1 = Math.min(AH - 1, Math.ceil(hy + rd));
        if (step === 2) y0 &= ~1;
        for (let y = y0; y <= y1; y += step) {
            const cy = y + c, dy = cy - hy, ny = Math.min(step, AH - y), dyN = Math.min(Math.abs(y + 0.5 - hy), Math.abs(y + ny - 0.5 - hy));
            if (dyN * dyN > rd2) continue;
            const half = Math.sqrt(rd2 - dyN * dyN);
            let xa = Math.max(0, Math.floor(hx - half)), xb = Math.min(AW - 1, Math.ceil(hx + half));
            if (step === 2) xa &= ~1;
            for (let x = xa; x <= xb; x += step) {
                const dx = x + c - hx, d2 = dx * dx + dy * dy, dist = Math.sqrt(d2), rr = Math.min(dist * inv, 0.99999), ux = dist ? dx / dist : 0, uy = dist ? dy / dist : 0;
                const id = facePixel(rr, ux, uy, fwrap(Math.atan2(dx, -dy) * DEG - phi), rd - dist, tick, isLined, vn), top = T.top[id], col = T.c32[id];
                const pos = (fv < 0 ? 0 : fv > 1 ? 1 : fv) * top, lo = Math.floor(pos), f = pos - lo;
                for (let j = 0; j < ny; j++) {
                    const py = y + j, ey = py + 0.5 - hy, row = py * AW, by = (py & 7) << 3;
                    for (let i = 0; i < step && x + i < AW; i++) {
                        const px = x + i, ex = px + 0.5 - hx;
                        if (ex * ex + ey * ey > rd2) continue;                // the rim is cut per pixel
                        const k = row + px;
                        buf[k] = col[Math.min(top, lo + (f > B8[by | (px & 7)] ? 1 : 0))];
                        depth[k] = z;
                    }
                }
            }
        }
        // the port's light, the one warm thing: a lamp's wide glow while the face is small, drawing in to the bay's own
        // light as it comes (the bay itself carries it then; the warm stays a small share of the glass)
        const glowOn = isLined || tick % 4 < 2, pr = rd * BAYF.at, near = Math.min(1, Math.max(0, (rd - 80) / 220));
        glow32(buf, AW, AH, hx + pr * Math.sin(phi * RAD), hy - pr * Math.cos(phi * RAD), Math.max(6, rd * (0.42 - 0.24 * near)), T.K.R.AMBER, (glowOn ? 0.62 : 0.32) * (1 - 0.85 * near));
    }
    /** The port's light while the station is still far: a bright point and a small halo, blinking as the port does. */
    function lamp(buf, AW, AH, x, y, rad, tick) {
        const K = art(), on = tick % 4 < 2;
        glow32(buf, AW, AH, x, y, rad * 3, K.R.AMBER, on ? 0.3 : 0.2);                         // a wide warm wash where the light would be
        glow32(buf, AW, AH, x, y, rad, K.R.AMBER, on ? 0.92 : 0.6);
        const c = pack(K.R.AMBER), xi = Math.round(x - 1), yi = Math.round(y - 1), put = (px, py, k) => { if (px >= 0 && px < AW && py >= 0 && py < AH) buf[py * AW + px] = c[k]; };
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b]) => put(xi + a, yi + b, on ? c.length - 1 : c.length - 2));   // a 2 x 2 core
        if (!on) return;                                                                            // a small cross while it is lit: arms, then dimmer tips
        [[-1, 0], [2, 0], [-1, 1], [2, 1], [0, -1], [1, -1], [0, 2], [1, 2]].forEach(([a, b]) => put(xi + a, yi + b, c.length - 2));
        [[-2, 0], [3, 0], [-2, 1], [3, 1], [0, -2], [1, -2], [0, 3], [1, 3]].forEach(([a, b]) => put(xi + a, yi + b, c.length - 3));
    }
    /** The sketch's own (review fixes, 2026-10-22): the port's own lights, three each side of it along the ring (where
        the face's running lights sit, rr 0.9), in the station's cold panel light, as its running lights are. They are how
        the picture says "lined up" (the port itself stays amber). b: each pair's brightness, the pair nearest the port
        first (0 off). */
    const LIGHT_AT = [PORT_HALF + 4, PORT_HALF + 9, PORT_HALF + 14];
    function lights(buf, AW, AH, hx, hy, rd, phi, b) {
        const K = art(), ramp = K.R.PANEL, c = pack(ramp), top = c.length - 1, hull = pack(K.R.HULL), { B8 } = faceTables();
        for (let j = 0; j < b.length; j++) {
            if (!(b[j] > 0.01)) continue;
            for (const side of [-1, 1]) {
                const a = (phi + side * LIGHT_AT[j]) * RAD, x = hx + 0.9 * rd * Math.sin(a), y = hy - 0.9 * rd * Math.cos(a);
                glow32(buf, AW, AH, x, y, Math.max(3, rd * 0.06), ramp, 0.75 * b[j]);
                const cr = rd * 0.008, k = b[j] > 0.8 ? top : top - 1;
                if (cr < 1.2) {                                                                      // small: a 2 x 2 core
                    const xi = Math.round(x - 1), yi = Math.round(y - 1);
                    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([p, q]) => { const X = xi + p, Y = yi + q; if (X >= 0 && X < AW && Y >= 0 && Y < AH) buf[Y * AW + X] = c[k]; });
                    continue;
                }
                const R2 = (cr * 1.7) ** 2;                                                          // close: a dark housing, the lens lit brightest in its middle
                for (let yy = Math.max(0, Math.floor(y - cr * 1.7)); yy <= Math.min(AH - 1, Math.ceil(y + cr * 1.7)); yy++) for (let xx = Math.max(0, Math.floor(x - cr * 1.7)); xx <= Math.min(AW - 1, Math.ceil(x + cr * 1.7)); xx++) {
                    const d2 = (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2;
                    if (d2 > R2) continue;
                    const q = Math.sqrt(d2) / cr;
                    buf[yy * AW + xx] = q > 1 ? hull[q > 1.45 ? 2 : 1] : c[Math.max(1, k - (q > 0.55 + 0.3 * B8[((yy & 7) << 3) | (xx & 7)] ? 1 : 0))];
                }
            }
        }
    }
    /** The fast face against the copied stationPixel on n random points: how many differ (0 expected). The port's
        neighbourhood is the sketch's own (bayPixel), so it is left out. */
    function check(n = 1000000) {
        const T = faceTables(), K = T.K;
        let bad = 0, r = 7;
        const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
        for (let k = 0; k < n; k++) {
            const rr = rnd() * 1.0, a = rnd() * Math.PI * 2, ux = Math.sin(a), uy = -Math.cos(a), local = wrap(rnd() * 720 - 360), edge = rnd() * 3, tick = Math.floor(rnd() * 16), isLined = rnd() < 0.3;
            if (rr > 0.66 && Math.abs(local) < 24) continue;
            const want = stationPixel(K, rr, ux, uy, local, edge, tick, isLined), id = facePixel(rr, ux, uy, local, edge, tick, isLined, K.P.vnoise);
            if (!want || T.list[id] !== want[0] || Math.abs(fv - want[1]) > 1e-12) bad++;
        }
        return bad;
    }

    window.DockFace = Object.freeze({ paint, lamp, lights, check, SOFT, PORT_HALF });
})();
