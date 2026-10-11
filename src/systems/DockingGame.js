/* DockingGame — you bring the ship into a turning station yourself. In the travel view's look (2026-10-11; before that,
   the ship's green phosphor frame), the same family as the landing and the minigames. The rules below did not change.
   The big picture is the docking camera: the station face (steel hub, spokes over ice-blue panels, the docking ring in
   segments), its ring turning slowly, and one port on the ring, lit amber: the one warm light. The strip underneath shows
   our Lander (MiniShip.lander, side on) closing in from the left on the station's edge.
     ← / A  roll left     → / D  roll right     ↑ / W  thrust in     ↓ / S  brake
   Roll until the ring stops turning on screen, nudge until the port sits under the marker at the top, and touch it slowly.
     port under the marker, spin matched, slow   → SOFT: docked clean
     a little off, or a little fast              → ROUGH: we scrape the ring (the boarder starts with 2 less air)
     worse                                       → CRASH: hull damage (app.state.damageRandomDeck()), the boarder starts with 3 less air
   "LET A.U.R.A. DOCK" flies it for you, cleanly. Nothing closes in until you touch a control.
   The frame is the minigames' (minigames.css, MiniHost's classes): one quiet header line, the picture, the four readouts as
   one small mono line under it, the status (a quiet note) or the result (A.U.R.A. saying it, no grade banner) as the voice
   line, the hint (it fades after the first control input), the controls as plain words (○ hold, ● held, › press).
   The physics runs on a 320 × 180 grid; the picture is 720 × 405 art pixels (2.25 per physics px), painted with the travel
   view's recipes (art/MiniPaint.js, loaded by MiniLab.js in both modes; a plain fallback keeps it playable without them).
   play(app, station) → Promise<{ grade: 'soft'|'rough'|'crash', auto: boolean }> */

(function () {
    'use strict';
    const W = 320, H = 180, VIEW_H = 140, CX = 160, CY = 70;                 // buffer; the camera view is the top VIEW_H rows
    const START_DIST = 80, START_SPEED = 3, MAX_SPEED = 8, MAX_DIST = 120;    // metres, metres per second
    const THRUST = 1.2, ROLL_ACCEL = 20, SPIN_MIN = 16, SPIN_MAX = 32;         // m/s², degrees/s², the ring's spin in degrees/s
    const SOFT = { speed: 1.2, roll: 4, port: 12 }, ROUGH = { speed: 2.5, roll: 12, port: 30 }; // contact limits: m/s, degrees/s of spin left, degrees off the marker
    const R_MIN = 22, R_MAX = 60, GROWTH = 1.6;                               // station radius on screen, far to near
    const PORT_HALF = 14, RESULT_HOLD_MS = 2000, MAX_STEP = 0.033, TICK_MS = 125, ATTACH_GRACE_MS = 5000;
    const THRUST_SOUND_MS = 140;
    // A.U.R.A.'s hand: steer the port under the marker (spin + gain × angle), and close at a speed that shrinks with distance; hold off if not lined up
    const AUTO = { phaseGain: 0.8, phaseRateMax: 20, rollBand: 0.5, speedGain: 0.1, speedMin: 0.8, speedMax: 4, speedBand: 0.1, holdDist: 12 };
    const BONE = '#c4d0c4', AMBER = '#d9a24a', RED = '#d85a4e', GREEN = '#74d99a';   // the grade colours (GRADES, kept for callers)
    const GRADES = {
        soft: { label: 'DOCKED CLEAN', effect: 'The clamps take hold. Full air for whoever goes in.', color: GREEN },
        rough: { label: 'ROUGH DOCKING', effect: 'We scraped the ring. Whoever goes in starts with 2 less air.', color: AMBER },
        crash: { label: 'HARD DOCKING', effect: 'The hull is damaged. Whoever goes in starts with 3 less air.', color: RED },
    };
    const HOLD_TEXT = 'Holding position. Touch a control to start.', AUTO_TEXT = 'A.U.R.A. has the controls. She is lining up the port.';
    const AURA = 'A.U.R.A.';                                                    // who says the result
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const sfx = (name, ...args) => { const audio = window.AudioSystem; if (audio && typeof audio[name] === 'function') audio[name](...args); }; // silent when muted
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const wrap = deg => { const d = ((deg % 360) + 540) % 360 - 180; return d === -180 ? 180 : d; };
    const FRAME_MS = 16;                                                        // physics on a plain timer: rAF can stall (hidden pane, background tab) while the page still reports itself visible
    const nextFrame = cb => setTimeout(() => cb(performance.now()), FRAME_MS);

    function seeded(id) {
        let s = 19;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    // ── the rules ──
    /** rand picks this station's spin (fixed per station when seeded by its id) and where the port starts. */
    function newState(rand) {
        const spin = (SPIN_MIN + rand() * (SPIN_MAX - SPIN_MIN)) * (rand() < 0.5 ? -1 : 1);
        return { dist: START_DIST, speed: START_SPEED, spin, ringAngle: rand() * 360, roll: 0, rollRate: 0, keys: { left: false, right: false, in: false, brake: false }, grade: null, endedAt: 0 };
    }
    /** Where the port sits, in degrees clockwise from the marker (−180..180). */
    const portAngle = s => wrap(s.ringAngle - s.roll);
    /** How fast the ring still turns on screen: positive means roll right to match it. */
    const relSpin = s => s.spin - s.rollRate;

    function gradeContact(s) {
        const phi = Math.abs(portAngle(s)), rel = Math.abs(relSpin(s));
        if (s.speed <= SOFT.speed && rel <= SOFT.roll && phi <= SOFT.port) return 'soft';
        if (s.speed <= ROUGH.speed && rel <= ROUGH.roll && phi <= ROUGH.port) return 'rough';
        return 'crash';
    }

    /** Advance dt seconds. Returns a grade on contact, otherwise null. */
    function step(s, dt) {
        if (s.keys.left) s.rollRate -= ROLL_ACCEL * dt;
        if (s.keys.right) s.rollRate += ROLL_ACCEL * dt;
        if (s.keys.in) s.speed += THRUST * dt;
        if (s.keys.brake) s.speed -= THRUST * dt;
        s.speed = clamp(s.speed, -MAX_SPEED, MAX_SPEED);
        s.ringAngle += s.spin * dt; s.roll += s.rollRate * dt;
        s.dist -= s.speed * dt;
        if (s.dist > MAX_DIST) { s.dist = MAX_DIST; s.speed = Math.max(0, s.speed); }
        return s.dist <= 0 ? gradeContact(s) : null;
    }

    function autopilot(s) {
        const phi = portAngle(s), wantRate = s.spin + clamp(AUTO.phaseGain * phi, -AUTO.phaseRateMax, AUTO.phaseRateMax);
        s.keys.left = s.rollRate > wantRate + AUTO.rollBand;
        s.keys.right = s.rollRate < wantRate - AUTO.rollBand;
        const isLined = Math.abs(phi) <= SOFT.port / 2 && Math.abs(relSpin(s)) <= SOFT.roll / 2;
        const wantSpeed = !isLined && s.dist < AUTO.holdDist ? 0 : clamp(AUTO.speedGain * s.dist + AUTO.speedMin, AUTO.speedMin, AUTO.speedMax);
        s.keys.in = s.speed < wantSpeed - AUTO.speedBand;
        s.keys.brake = s.speed > wantSpeed + AUTO.speedBand;
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
    function drawStripBack(B, K, s, d, tick, isLined) {
        const { P, R } = K, top = Math.round(VIEW_H * d), L = LIGHT;
        rect(B, 0, top, B.w, 1, rgbOf('#142329'));
        K.stripStars.forEach(st => put(B, Math.round(st.x * d), Math.round(st.y * d), R.STAR.rgb[st.mag > 0.9 ? 2 : 1]));
        const tick10 = rgbOf('#1f3a43');
        for (let m = 0; m <= START_DIST; m += 10) rect(B, (NOSE_AT - (m / START_DIST) * TRAVEL) * d - 1, (H - 4) * d, 2, 2, tick10);
        const x0 = Math.round(FACE_X * d), y0 = top + 1, RING_W = 8;
        for (let y = y0; y < B.h; y++) {
            const uy = y / d;
            for (let x = x0; x < B.w; x++) {
                const u = (x + 0.5) / d - FACE_X;
                if (u < RING_W) {                                                                             // the ring's edge
                    const t = (u - RING_W / 2) / (RING_W / 2), nz = Math.sqrt(Math.max(0, 1 - t * t));
                    let v = 0.08 + 0.78 * Math.max(0, t * L[0] * 1.2 + nz * L[2] - 0.12 * ((uy - VIEW_H) / (H - VIEW_H)));
                    if ((uy - VIEW_H + 3) % 9 < 0.5) v *= 0.5;                                                // its segments
                    v *= 0.88 + 0.24 * P.vnoise(u * 0.9, uy * 0.5, 5);
                    tone(B, P, x, y, R.HULL, v, true);
                } else if (u < RING_W + 1) tone(B, P, x, y, R.HULL, 0.03, true);                                // its shadow
                else {                                                                                         // the panels behind, in shade
                    const isGrid = (u - RING_W) % 5 < 0.5 || (uy - VIEW_H) % 6 < 0.5;
                    tone(B, P, x, y, R.PANEL, isGrid ? 0.06 : 0.16 + 0.05 * (1 - (u - RING_W) / 27), true);
                }
            }
        }
        const isOn = isLined || s.grade === 'soft' || tick % 4 < 2, bay = isLined || s.grade === 'soft' ? R.GREEN : R.AMBER;
        for (let y = Math.round((SHIP_Y - 5) * d); y < Math.round((SHIP_Y + 5) * d); y++) {              // the port's lit bay on the ring's face
            for (let x = x0; x < x0 + Math.round(1.4 * d); x++) tone(B, P, x, y, bay, (isOn ? 0.86 : 0.55) * (0.7 + 0.3 * (1 - Math.abs(y / d - SHIP_Y) / 5)), true);
        }
        for (let y = Math.round((SHIP_Y - 3.4) * d); y < Math.round((SHIP_Y + 3.4) * d); y++) for (let x = Math.round((FACE_X - 2) * d); x < x0 + 2; x++) {   // the collar, reaching out
            const dy = y / d - SHIP_Y;
            tone(B, P, x, y, R.HULL, Math.abs(dy) > 2.6 ? (dy < 0 ? 0.74 : 0.34) : 0.12, true);
        }
        if (isOn) glow(B, P, x0, SHIP_Y * d, 7 * d, bay, 0.55, B.h);
    }

    /** Our Lander, side on, nose to the station: the drive lit while you thrust in, the nose jets while you brake. */
    function drawShip(ctx, K, s, now, d) {
        const nose = NOSE_AT - (clamp(s.dist, 0, START_DIST) / START_DIST) * TRAVEL, cx = nose - SHIP_LEN / 2, isOver = !!s.grade;
        const f = K.P.framer ? K.P.framer(ctx, ctx.canvas.width, ctx.canvas.height) : null;
        let at = null;
        if (window.MiniShip && window.MiniPaint) {
            ctx.setTransform(d, 0, 0, d, 0, 0);
            try { at = window.MiniShip.lander(ctx, { x: cx, y: SHIP_Y, len: SHIP_LEN, angle: 0, flip: true, anchor: 0.5, sunDir: [-0.2, -1], plume: s.keys.in && !isOver ? 1 : 0, t: now }).at; }
            finally { ctx.setTransform(1, 0, 0, 1, 0, 0); }
        } else {                                                                                               // no picture kit: a plain hull
            ctx.fillStyle = '#8aa2aa'; ctx.fillRect(Math.round((cx - SHIP_LEN / 2) * d), Math.round((SHIP_Y - 3.5) * d), Math.round(SHIP_LEN * d), Math.round(7 * d));
        }
        if (isOver || !s.keys.brake || !f) return;
        [-0.36, 0.36].forEach(v => {                                                                          // the nose jets: short puffs forward
            const [ux, uy] = at ? at(0.06, v) : [nose - 1, SHIP_Y + v * 7];
            const len = Math.round((2 + Math.random() * 2) * d);
            for (let k = 0; k < len; k++) f.tone(ux * d + 2 + k, uy * d + (v < 0 ? -1 : 0), K.R.PLUME, 0.95 - k / len * 0.7);
        });
    }

    /** How it ended: the clamps lock (soft), sparks off the ring (rough), a flash and pieces (crash). */
    function drawEnd(ctx, K, s, now, d) {
        const age = now - s.endedAt, f = K.P.framer ? K.P.framer(ctx, ctx.canvas.width, ctx.canvas.height) : null;
        if (!f) return;
        const vh = Math.round(VIEW_H * d), k = Math.max(2, Math.round(d)), Rad = radiusAt(s.dist), hx = CX * d, hy = (CY - Rad * 0.84) * d;
        const inView = (x, y) => y < vh - 1;
        if (s.grade === 'soft') {                                                                             // the clamps: four corners lock round the port
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
                const x = (CX + sx * 40) * d, y = (CY + sy * 28) * d, len = 8 * d;
                f.px(sx < 0 ? x : x - len, sy < 0 ? y : y - k, LEVEL_INK, len, k);
                f.px(sx < 0 ? x : x - k, sy < 0 ? y : y - len, LEVEL_INK, k, len);
            });
            return;
        }
        const isCrash = s.grade === 'crash', t = age / 1000;
        if (isCrash && age < 260) f.glow(hx, hy, Math.round(46 * d * (1 - age / 320)), K.R.SUN, 1.5 - age / 260);   // the flash
        else if (age < (isCrash ? 2000 : 220)) f.glow(hx, hy, Math.round((isCrash ? 5 : 3) * d), isCrash ? K.R.AMBER : K.R.SUN, isCrash ? 0.5 + 0.12 * Math.sin(age / 70) : 0.7);
        const count = isCrash ? 22 : 8;
        for (let i = 0; i < count; i++) {
            const a = i * 2.4, v = 20 + (i * 11) % 40, x = hx + Math.cos(a) * v * t * d, y = hy + Math.sin(a) * v * t * d;
            if (!inView(x, y)) continue;
            if (isCrash && i % 3 === 0) { f.px(x, y, K.R.HULL.hex[3], (i % 4 === 0 ? 2 : 1.5) * k, k); f.px(x, y, K.R.HULL.hex[4], k, 1); continue; }   // pieces of the ring, lit on top
            const heat = Math.max(0.3, 0.98 - t * 0.55);                                                    // sparks, with a short tail
            f.tone(x, y, K.R.SUN, heat, k, k);
            f.tone(x - Math.cos(a) * 3 * d, y - Math.sin(a) * 3 * d, K.R.SUN, heat * 0.6, Math.ceil(k / 2), Math.ceil(k / 2));
        }
    }

    /** One picture: the camera (sky, station, marker), the strip and our Lander, and how it ended. ctx is any canvas of 320 × 180 × d. */
    function draw(ctx, s, now, tick) {
        const K = art(), B = bufferFor(ctx.canvas), d = ctx.canvas.width / W;
        B.d32.fill(((255 << 24) | (K.ink[2] << 16) | (K.ink[1] << 8) | K.ink[0]) >>> 0);
        const isLined = Math.abs(portAngle(s)) <= SOFT.port && Math.abs(relSpin(s)) <= SOFT.roll;
        drawSky(B, K, s, d, tick);
        drawStation(B, K, s, d, isLined, tick);
        drawStripBack(B, K, s, d, tick, isLined);
        ctx.putImageData(B.img, 0, 0);
        drawShip(ctx, K, s, now, d);
        if (s.grade) drawEnd(ctx, K, s, now, d);
    }

    // ── the frame: the minigames' (minigames.css, MiniHost's classes), plus the readout line and the hint ──
    const FIT_MARGIN = 16, CRISP_MIN_FILL = 0.8;
    const STYLE = `
.dx .mini-canvas { cursor: default; }
.dx .dx-readout { contain: inline-size; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 26px; margin: 0; padding: 0 2px; font: 400 13px/1.2 var(--mg-f-num); color: var(--mg-quiet); }
.dx .dx-readout div { display: flex; align-items: baseline; gap: 8px; }
.dx .dx-readout dt { letter-spacing: 0.02em; color: var(--mg-faint); }
.dx .dx-readout dd { margin: 0; min-width: 3ch; color: var(--mg-steel); transition: color 120ms; }
.dx .dx-talk { min-height: 58px; }
.dx .dx-hint { contain: inline-size; margin: 0; padding: 0 2px; max-width: 110ch; font: 400 14px/1.5 var(--mg-f-text); color: var(--mg-quiet); transition: opacity 900ms ease-out; }
.dx .dx-hint.is-gone { opacity: 0; }
.dx .dx-hint b { font-weight: 500; color: var(--mg-steel); }
.dx .dx-hint kbd { padding: 0 4px; border: 1px solid #33373e; border-radius: 2px; font: 12px var(--mg-f-num); color: var(--mg-steel); }
@media (prefers-reduced-motion: reduce) { .dx .dx-hint { transition: none; } }`;
    function addStyle() {
        if (document.getElementById('docking-dx-style')) return;
        const el = document.createElement('style'); el.id = 'docking-dx-style'; el.textContent = STYLE;
        document.head.appendChild(el);
    }

    /** Scale the picture to fit the window: whole device pixels per art pixel when that costs little room, so every dither dot is the same size. */
    function fitCanvas(overlay, canvas) {
        const frame = overlay.querySelector('.mini-frame'), dpr = window.devicePixelRatio || 1;
        canvas.style.width = canvas.style.height = '';
        const chromeH = frame.offsetHeight - canvas.offsetHeight;
        const room = Math.max(0.25, Math.min((window.innerWidth - 2 * FIT_MARGIN) / canvas.width, (window.innerHeight - 2 * FIT_MARGIN - chromeH) / canvas.height));
        const crisp = Math.floor(room * dpr + 0.01) / dpr, scale = crisp >= room * CRISP_MIN_FILL ? crisp : room;
        canvas.style.width = `${canvas.width * scale}px`; canvas.style.height = `${canvas.height * scale}px`;
    }

    function overlayHtml(station) {
        return `<div class="mini-frame">
            <header class="mini-head"><p class="mini-kicker">DOCKING — ${esc(station.name || 'UNKNOWN STATION')}</p><h2 class="mini-title">Match the ring</h2></header>
            <div class="mini-screen"><canvas class="mini-canvas docking-canvas" width="${AW}" height="${AH}" aria-label="The docking camera"></canvas></div>
            <dl class="dx-readout docking-readout">
                <div><dt>DISTANCE</dt><dd class="dock-dist">0</dd></div>
                <div><dt>CLOSING</dt><dd class="dock-speed">0</dd></div>
                <div><dt>ROLL</dt><dd class="dock-roll">—</dd></div>
                <div><dt>PORT</dt><dd class="dock-port">—</dd></div>
            </dl>
            <div class="mini-talk dx-talk" aria-live="polite"><p class="mini-who is-empty"><span class="mini-ring" aria-hidden="true"></span><span class="mini-name"></span></p><p class="mini-line is-note"></p></div>
            <p class="dx-hint">Hold <kbd>←</kbd> / <kbd>→</kbd> to roll until the ring <b>stops turning</b>, and keep the lit port under the <b>marker at the top</b>. <kbd>↑</kbd> closes in, <kbd>↓</kbd> brakes. Touch it slowly.</p>
            <div class="mini-buttons">
                <button type="button" class="mini-btn is-hold dock-hold" data-key="left">Roll left</button>
                <button type="button" class="mini-btn is-hold dock-hold" data-key="right">Roll right</button>
                <button type="button" class="mini-btn is-hold dock-hold" data-key="in">Thrust in</button>
                <button type="button" class="mini-btn is-hold dock-hold" data-key="brake">Brake</button>
                <button type="button" class="mini-btn docking-auto">Let A.U.R.A. dock</button>
            </div>
        </div>`;
    }

    function readouts(els, s) {
        const set = (el, text, color) => { if (el.textContent !== text) el.textContent = text; el.style.color = inkOf(color); };
        const rel = relSpin(s), phi = portAngle(s);
        set(els.dist, `${Math.max(0, Math.round(s.dist))} m`, BONE);
        set(els.speed, `${s.speed.toFixed(1)} m/s`, s.speed < 0 ? BONE : s.speed <= SOFT.speed ? GREEN : s.speed <= ROUGH.speed ? AMBER : RED);
        set(els.roll, Math.abs(rel) <= SOFT.roll ? 'MATCHED' : `${rel > 0 ? '▶' : '◀'} ${Math.round(Math.abs(rel))}°/s`, Math.abs(rel) <= SOFT.roll ? GREEN : Math.abs(rel) <= ROUGH.roll ? AMBER : RED);
        set(els.port, Math.abs(phi) <= SOFT.port ? 'FACING' : `${phi > 0 ? '▶' : '◀'} ${Math.round(Math.abs(phi))}°`, Math.abs(phi) <= SOFT.port ? GREEN : Math.abs(phi) <= ROUGH.port ? AMBER : RED);
    }

    function play(app, station) {
        return new Promise(resolve => {
            addStyle();
            const overlay = document.createElement('div');
            overlay.className = 'warp-plot docking mini-host dx';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-label', 'Dock with the station');
            overlay.style.setProperty('--mg-void', '#05070a');
            overlay.innerHTML = overlayHtml(station || {});
            document.body.appendChild(overlay);
            const el = q => overlay.querySelector(q), canvas = el('canvas'), ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            fitCanvas(overlay, canvas);
            const fitter = new ResizeObserver(() => fitCanvas(overlay, canvas)); fitter.observe(overlay);
            const els = { dist: el('.dock-dist'), speed: el('.dock-speed'), roll: el('.dock-roll'), port: el('.dock-port') };
            const whoEl = el('.mini-who'), nameEl = el('.mini-name'), lineEl = el('.mini-line'), hintEl = el('.dx-hint');
            const holdBtns = Array.from(overlay.querySelectorAll('.dock-hold'));
            /** The voice line under the picture (MiniHost's): a status as a quiet note, the result as A.U.R.A. saying it. */
            function say(name, words) {
                nameEl.textContent = name || '';
                whoEl.className = 'mini-who ' + (name ? 'is-aura tone-aura' : 'is-empty');
                lineEl.textContent = words || '';
                lineEl.className = 'mini-line' + (name ? '' : ' is-note');
            }
            const s = newState(seeded(station && station.id));
            window.DockingGame.current = s;                                   // read-only handle for automated play-tests
            const startedAt = performance.now();
            let last = startedAt, lastDraw = 0, tick = 0, isClosed = false, wasAttached = false, lastPuff = 0, wasMatched = false, wasFacing = false;

            const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'in', w: 'in', W: 'in', ArrowDown: 'brake', s: 'brake', S: 'brake' };
            function onKey(e) {
                if (!KEYMAP[e.key] || s.isAuto || s.grade) return;
                s.keys[KEYMAP[e.key]] = e.type === 'keydown'; e.preventDefault();
            }
            const unlisten = () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            holdBtns.forEach(btn => {
                const set = isOn => () => { if (!s.isAuto && !s.grade) s.keys[btn.dataset.key] = isOn; };
                btn.addEventListener('pointerdown', set(true)); btn.addEventListener('pointerup', set(false)); btn.addEventListener('pointerleave', set(false));
            });
            const letGo = () => overlay.querySelectorAll('button').forEach(b => b.classList.remove('is-held'));
            el('.docking-auto').addEventListener('click', () => {
                if (s.grade || s.isAuto) return;
                s.isAuto = true; unlisten();
                overlay.querySelectorAll('.dock-hold, .docking-auto').forEach(b => { b.disabled = true; });
                letGo();
            });

            function close(result) {
                if (isClosed) return;
                isClosed = true; unlisten(); fitter.disconnect();
                overlay.classList.add('is-leaving');
                setTimeout(() => { overlay.remove(); resolve(result); }, 350);
            }

            function end(grade) {
                s.grade = grade; s.endedAt = performance.now(); s.keys = { left: false, right: false, in: false, brake: false };
                overlay.querySelectorAll('button').forEach(b => { b.disabled = true; });
                letGo();
                say(AURA, GRADES[grade].effect);
                sfx('sfxTouchdown', grade);
                if (grade === 'crash') {
                    if (app && app.state && typeof app.state.damageRandomDeck === 'function') app.state.damageRandomDeck();
                    if (app && app.screenShake) app.screenShake('heavy');
                }
                setTimeout(() => close({ grade, auto: !!s.isAuto }), RESULT_HOLD_MS);
            }

            function sounds(now) {
                const isThrusting = s.keys.in || s.keys.brake;
                if (isThrusting && now - lastPuff > THRUST_SOUND_MS) { lastPuff = now; sfx('sfxThruster', false); }
                const isMatched = Math.abs(relSpin(s)) <= SOFT.roll, isFacing = Math.abs(portAngle(s)) <= SOFT.port;
                if (isMatched && !wasMatched) sfx('playTone', 660, 'sine', 0.09, 0.05);
                if (isFacing && isMatched && !wasFacing) sfx('playTone', 990, 'sine', 0.12, 0.05);
                wasMatched = isMatched; wasFacing = isFacing && isMatched;
            }

            /** Physics every ~16 ms, picture at 8 fps. Stops once the canvas has been attached and removed, or was never attached after a grace period. */
            (function frame(now) {
                if (canvas.isConnected) wasAttached = true;
                else if (wasAttached || now - startedAt > ATTACH_GRACE_MS) { unlisten(); fitter.disconnect(); return; }
                if (isClosed) return;
                const dt = Math.min(MAX_STEP, (now - last) / 1000); last = now;
                const isTouched = s.keys.left || s.keys.right || s.keys.in || s.keys.brake;
                const isHolding = !s.isReleased && !s.isAuto && !isTouched;                            // wait for the player: reading the screen never costs a crash
                if (!isHolding && !s.isReleased) { s.isReleased = true; sfx('sfxUndock'); }
                if (!s.grade) {
                    const status = isHolding ? HOLD_TEXT : s.isAuto ? AUTO_TEXT : '';
                    if (status !== s.status) { s.status = status; say('', status); }
                    if (!isHolding && !hintEl.classList.contains('is-gone')) hintEl.classList.add('is-gone');   // read once: it fades after the first control input
                    if (isHolding) { s.ringAngle += s.spin * dt; }                                      // the ring keeps turning while you read it; the ship holds still
                    else {
                        if (s.isAuto) autopilot(s);
                        const grade = step(s, dt);
                        sounds(now);
                        if (grade) end(grade);
                    }
                    readouts(els, s);
                    if (!s.isAuto && !s.grade) holdBtns.forEach(b => b.classList.toggle('is-held', !!s.keys[b.dataset.key]));   // a held key shows on its button
                }
                if (now - lastDraw >= TICK_MS) { lastDraw = now; tick += 1; draw(ctx, s, now, tick); }
                nextFrame(frame);
            })(last);
            try { el('.dock-hold').focus({ preventScroll: true }); } catch (e) { el('.dock-hold').focus(); }
        });
    }

    window.DockingGame = {
        play, GRADES,
        internals: { newState, step, autopilot, gradeContact, portAngle, relSpin, SOFT, ROUGH, START_DIST, THRUST, ROLL_ACCEL, MAX_STEP, draw }, // internals: for headless play-tests
    };
})();
