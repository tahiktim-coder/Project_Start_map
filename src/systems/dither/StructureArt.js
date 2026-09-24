/* StructureArt — THE STRUCTURE: the false sun at the end of the heading (docs/CANON.md §3).
   It looks like a home star, the kind the crew was sent to find: a white core, a gold face, a corona that breathes slowly, faint
   rays that turn very slowly, a soft limb and a halo ring. One violet thing only: the reading, a band of light that sweeps the face
   left to right and repeats, patient and mechanical, the same sweep the player saw crossing the disc on the disc page. Inside the
   light, the graveyard: a few small dark hulls drift across the face like planets in transit. Never a stream, never many at once.

     render(s, t, H)       the BODY (map node, side panel, orbit hero): writes s.gray / s.acc / s.mask
     renderVista(v, t, H)  the ORBIT VISTA, any size: the sun large and to the right, its light filling the frame, dead transponders
                           in the dark, the player's ship a silhouette against the light
     look                  a warm ramp (near-black → umber → orange → gold → pale gold → white) and the violet accent of the reading

   Everything still is painted once per size and cached (base tone, a breathing layer, a ray layer with a per-pixel angle bin);
   per frame it is one pass of adds, then the sweep, the hulls, the pips and the ship. Tuned offline against real renders:
   tools/structure_lab/harness.js with tools/structure_lab/candidate_sun.js (this file's twin). */

(function () {
    'use strict';

    const TAU = Math.PI * 2;
    const LOOK = { ramp: ['#06070a', '#3a1206', '#c24a10', '#f0a020', '#ffe08a', '#ffffff'], accent: [136, 68, 255] };
    const TOP_STOP = LOOK.ramp.length - 1, CONTRAST = 1.1;   // the game's contrast; lets us ask for an exact ramp stop
    const STOP = 1 / (TOP_STOP * CONTRAST);                   // one ramp stop, in tone units
    const tone = stop => 0.5 - 0.5 / CONTRAST + stop * STOP;  // tone that quantizes to ramp stop `stop` (fractions dither)
    const BLACK = tone(0) + 1e-4, GOLD = tone(3) + 1e-4, WHITE = tone(5) + 1e-4;
    const CACHE_LIMIT = 8;

    // ── the star ──
    const FACE = 0.72;                                                      // the face fills this much of R; the corona, rays and ring take the rest
    const CORE_U = 0.28, MID_U = 0.62, LIMB_U = 0.9;                       // radii (fractions of the face) where it changes colour
    const CORE_STOP = 5, MID_STOP = 4.25, OUTER_STOP = 3.4, LIMB_STOP = 3.2; // white → pale gold → gold → orange-gold at the limb
    const GRAIN = 0.35, GRAIN_FREQ = 0.05;                                  // granulation on the face, in stops
    const GLOW_A = 2.2, GLOW_A_FALL = 0.2, GLOW_B = 1.0, GLOW_B_FALL = 0.8, GLOW_B_FALL_VISTA = 1.6; // corona, in shown stops: a hot skin and a long tail
    const BREATH_MS = 4000, BREATH_AMP = 0.9, BREATH_FALL = 0.4, BREATH_ON_LIMB = 0.25;
    const RAY_TURN_MS = 90000, RAY_AMP = 0.9, RAY_FALL = 0.75, RAY_RISE = 0.18, RAY_ON_FACE = 0.12, RAY_FINE = 14, RAY_BROAD = 5, RAY_BINS = 1024;
    const RAY_FROM = 26, RAY_FULL = 60;                                      // rays fade in with size; the map node is a point with a halo
    const RING_U = 1.3, RING_W = 0.03, RING_AMP = 0.7, RING_PULSE = 0.6, RING_FROM = 34;
    const VISTA_FLOOR = 0.3;                                                // the darkest the vista's sky gets, in stops

    // ── the reading ──
    const SWEEP_MS = 7000, SWEEP_SPAN = 2.7, SWEEP_HALF = 0.16, SWEEP_REACH = 1.5, SWEEP_TAIL = 0.35, SWEEP_LIFT = 0.5, SWEEP_ACC = 0.6;
    const SWEEP_FROM = 14, SWEEP_FULL = 40;

    // ── the graveyard ──
    const HULL_FROM = 20, HULL_MIN = 3, HULL_MAX = 6, HULL_LEN = 0.085, HULL_LEN_MAX = 9, HULL_CHORD = 0.8;   // sizes are fractions of the face
    const HULL_SLOW_MS = 70000, HULL_SLOW_VARY = 60000;                     // one crossing of the face takes 70–130 s

    // ── the vista ──
    const VISTA_R = 0.46, VISTA_CX = 1.1, VISTA_CY = 0.55;                  // R as a fraction of the short side; centre pulled to the right and low
    const SHIP_X = -0.58, SHIP_Y = 0.3, SHIP_LEN = 0.1;
    const PIP_PER_PX = 1 / 3600, PIP_DARK = 1.1, PIP_ON = 2.9, PIP_OFF = 1.5, PIP_DUTY = 0.22, PIP_MS = 1800, PIP_MS_VARY = 3600;
    const STAR_PER_PX = 1 / 650, STAR_DARK = 1.3;

    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };
    const lerp = (a, b, k) => a + (b - a) * k;

    /** The face of the star, in ramp stops, by distance from the centre (fraction of the face radius F = R × FACE). */
    function faceStop(u) {
        if (u < CORE_U) return CORE_STOP;
        if (u < MID_U) return lerp(CORE_STOP, MID_STOP, smooth(CORE_U, MID_U, u));
        if (u < LIMB_U) return lerp(MID_STOP, OUTER_STOP, (u - MID_U) / (LIMB_U - MID_U));
        return lerp(OUTER_STOP, LIMB_STOP, (u - LIMB_U) / (1 - LIMB_U));
    }

    /** Rays: narrow bright spokes laid over a few broad ones. 0..1.1 by angle. */
    function rayShape(a) {
        const fine = Math.pow(0.5 + 0.5 * Math.cos(a * RAY_FINE), 4), broad = Math.pow(0.5 + 0.5 * Math.cos(a * RAY_BROAD + 1.3), 3);
        return 0.55 * fine + 0.55 * broad;
    }

    function fillRect(b, x, y, rw, rh, t, accent) {
        const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(b.w, x + rw), y1 = Math.min(b.h, y + rh);
        for (let py = y0; py < y1; py++) {
            let i = py * b.w + x0;
            for (let px = x0; px < x1; px++, i++) { b.gray[i] = t; b.acc[i] = accent; b.mask[i] = 1; }
        }
    }

    function remember(cache, key, build) {
        if (cache.has(key)) return cache.get(key);
        if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
        const made = build(); cache.set(key, made); return made;
    }

    // ═════════════════════════════ THE STILL LAYERS (built once per size) ═════════════════════════════
    /** base = what never moves; breathe × breath and ray × rays[bin] are added per frame. Body pixels outside the face are unmasked
        (they glow one stop up over the backdrop and fade to nothing before the buffer edge); the vista is a full picture, all masked. */
    function buildScene(w, h, cx, cy, R, seed, H, vista) {
        const n = w * h, rand = H.rng(seed * 13 + 1);
        const base = new Float32Array(n), breathe = new Float32Array(n), ray = new Float32Array(n), bin = new Uint16Array(n), mask = new Uint8Array(n);
        const F = R * FACE, edgeR = Math.min(w, h) / 2 - 0.5, rayGain = smooth(RAY_FROM, RAY_FULL, R), hasRing = R >= RING_FROM;
        const tailFall = vista ? GLOW_B_FALL_VISTA : GLOW_B_FALL, window = new Float32Array(n);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const i = y * w + x, dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy), u = r / F;
            window[i] = vista ? 1 : 1 - smooth(edgeR * 0.78, edgeR, r);           // body: fade to nothing before the square edge of the buffer
            bin[i] = Math.floor((Math.atan2(dy, dx) / TAU + 1) * RAY_BINS) & (RAY_BINS - 1);
            if (u < 1) {
                let stop = faceStop(u);
                if (u > CORE_U) stop += GRAIN * (H.fbm(x * GRAIN_FREQ + seed, y * GRAIN_FREQ, 3) - 0.5) * smooth(CORE_U, MID_U, u);
                base[i] = tone(stop); mask[i] = 1;
                ray[i] = RAY_ON_FACE * rayGain * smooth(MID_U, 1, u) * STOP;
                breathe[i] = BREATH_ON_LIMB * smooth(LIMB_U, 1, u) * STOP;
                continue;
            }
            const d = u - 1;
            let glow = GLOW_A * Math.exp(-d / GLOW_A_FALL) + GLOW_B * Math.exp(-d / tailFall);
            let br = BREATH_AMP * Math.exp(-d / BREATH_FALL), ry = RAY_AMP * rayGain * Math.exp(-d / RAY_FALL) * smooth(0, RAY_RISE, d);   // rays start a little off the limb
            if (hasRing) { const k = Math.exp(-Math.pow((u - RING_U) / RING_W, 2)); glow += RING_AMP * k; br += RING_PULSE * k; }
            if (vista) { base[i] = tone(glow + VISTA_FLOOR); mask[i] = 1; }
            else { const win = window[i]; base[i] = tone(Math.max(0, glow - 1) * win); br *= win; ry *= win; }   // unmasked pixels are shown one stop up
            breathe[i] = br * STOP; ray[i] = ry * STOP;
        }
        const scene = { w, h, cx, cy, R, F, base, breathe, ray, bin, mask, window, hulls: buildHulls(R, F, rand), pips: [], vista };
        if (vista) { paintStars(scene, rand); scene.pips = buildPips(scene, rand); }
        return scene;
    }

    /** The graveyard: a handful of hulls, each on its own chord, each with its own slow crossing. */
    function buildHulls(R, F, rand) {
        if (R < HULL_FROM) return [];
        const count = HULL_MIN + Math.floor(rand() * (HULL_MAX - HULL_MIN + 1)), hulls = [];
        for (let k = 0; k < count; k++) {
            const len = Math.max(1, Math.min(HULL_LEN_MAX, Math.round(F * HULL_LEN * (0.7 + rand() * 0.6))));
            hulls.push({ chord: (rand() * 2 - 1) * HULL_CHORD, period: HULL_SLOW_MS + rand() * HULL_SLOW_VARY, phase: rand(), len, thick: Math.max(1, Math.round(len * 0.38)) });
        }
        return hulls;
    }

    function paintStars(S, rand) {
        const count = Math.round(S.w * S.h * STAR_PER_PX), dark = tone(STAR_DARK);
        for (let k = 0; k < count; k++) {
            const i = Math.floor(rand() * S.w) + S.w * Math.floor(rand() * S.h);
            if (S.base[i] < dark) S.base[i] = tone(1.3 + rand() * 1.2);
        }
    }

    /** Dead transponders: dim warm points in the dark part of the sky, some of them still blinking. */
    function buildPips(S, rand) {
        const count = Math.round(S.w * S.h * PIP_PER_PX), dark = tone(PIP_DARK), pips = [];
        for (let tries = 0; tries < count * 6 && pips.length < count; tries++) {
            const x = Math.floor(rand() * S.w), y = Math.floor(rand() * S.h);
            if (S.base[y * S.w + x] > dark) continue;
            pips.push({ x, y, wide: rand() < 0.25 ? 2 : 1, period: PIP_MS + rand() * PIP_MS_VARY, phase: rand(), blinks: rand() < 0.6 });
        }
        return pips;
    }

    // ═════════════════════════════ PER FRAME ═════════════════════════════
    const rays = new Float32Array(RAY_BINS);
    function composeStill(b, S, t) {
        const breath = 0.5 + 0.5 * Math.sin(t / BREATH_MS * TAU), turn = (t / RAY_TURN_MS) * TAU;
        for (let k = 0; k < RAY_BINS; k++) rays[k] = rayShape(k * TAU / RAY_BINS + turn);
        const { base, breathe, ray, bin } = S, gray = b.gray, n = S.w * S.h;
        for (let i = 0; i < n; i++) gray[i] = base[i] + breath * breathe[i] + ray[i] * rays[bin[i]];
        b.mask.set(S.mask); b.acc.fill(0);
    }

    function sweepX(S, t) { return S.cx - SWEEP_SPAN * S.F / 2 + ((t % SWEEP_MS) / SWEEP_MS) * SWEEP_SPAN * S.F; }

    /** The reading: a soft vertical band, violet where it crosses light, left to right, over and over. */
    function paintSweep(b, S, t) {
        const strength = smooth(SWEEP_FROM, SWEEP_FULL, S.R);
        if (strength <= 0) return;
        const xs = sweepX(S, t), hw = Math.max(2, SWEEP_HALF * S.F), reach = SWEEP_REACH * S.F;
        const x0 = Math.max(0, Math.floor(xs - hw)), x1 = Math.min(S.w - 1, Math.ceil(xs + hw));
        const y0 = Math.max(0, Math.floor(S.cy - reach)), y1 = Math.min(S.h - 1, Math.ceil(S.cy + reach));
        for (let x = x0; x <= x1; x++) {
            const p = 1 - Math.abs(x + 0.5 - xs) / hw;
            if (p <= 0) continue;
            const dx = x + 0.5 - S.cx, k = p * p * (3 - 2 * p) * strength;
            for (let y = y0; y <= y1; y++) {
                const u = Math.hypot(dx, y + 0.5 - S.cy) / S.F, i = y * S.w + x, gain = k * S.window[i] * (u < 1 ? 1 : Math.exp(-(u - 1) / SWEEP_TAIL));
                b.gray[i] += SWEEP_LIFT * STOP * gain;
                if (b.acc[i] < SWEEP_ACC * gain) b.acc[i] = SWEEP_ACC * gain;
            }
        }
    }

    /** One hull: a dark silhouette on the face (a bridge once it is big enough), lit violet for the moment the reading passes over it. */
    function paintHull(b, x, y, len, thick, lit) {
        const t = lit ? GOLD : BLACK, a = lit ? 1 : 0;
        fillRect(b, x, y, len, thick, t, a);
        if (len >= 5) fillRect(b, x + Math.round(len * 0.55), y - 1, Math.max(1, Math.round(len * 0.25)), 1, t, a);
    }

    function paintHulls(b, S, t) {
        const xs = sweepX(S, t), hw = Math.max(2, SWEEP_HALF * S.F), reach = S.F * 1.05;
        S.hulls.forEach(hull => {
            const frac = ((t / hull.period) + hull.phase) % 1, cy = S.cy + hull.chord * S.F, half = Math.sqrt(S.F * S.F - (cy - S.cy) * (cy - S.cy));
            const cx = S.cx - reach + frac * 2 * reach;
            if (Math.abs(cx - S.cx) > half + hull.len) return;                                    // still beyond the limb
            paintHull(b, Math.round(cx - hull.len / 2), Math.round(cy - hull.thick / 2), hull.len, hull.thick, Math.abs(cx - xs) < hw);
        });
    }

    /** The player's ship, in front of the light: a silhouette, nose to the sun, an engine that flickers and a running light that blinks. */
    function paintShip(b, S, t) {
        const len = Math.max(6, Math.round(S.F * SHIP_LEN)), thick = Math.max(2, Math.round(len * 0.3));
        const x = Math.round(S.cx + SHIP_X * S.F - len / 2), y = Math.round(S.cy + SHIP_Y * S.F - thick / 2);
        const flicker = Math.floor(t / 250) % 2, blink = Math.floor(t / 750) % 2, bridgeW = Math.max(2, Math.round(len * 0.3)), bridgeH = Math.max(1, Math.round(thick * 0.6));
        fillRect(b, x, y, len, thick, BLACK, 0);
        fillRect(b, x + len, y + Math.floor(thick / 2), Math.max(1, Math.round(thick * 0.5)), 1, BLACK, 0);        // nose
        fillRect(b, x + Math.round(len * 0.35), y - bridgeH, bridgeW, bridgeH, BLACK, 0);                          // bridge
        fillRect(b, x - 1, y - 1, 1, thick + 2, BLACK, 0);                                                        // tail plate
        fillRect(b, x - 2 - flicker, y + Math.floor((thick - 1) / 2), 1 + flicker, Math.max(1, thick - 1), WHITE, 0); // engine
        if (blink) fillRect(b, x + Math.round(len * 0.35) + bridgeW - 1, y - bridgeH - 1, 1, 1, WHITE, 0);
    }

    function paintPips(b, S, t) {
        S.pips.forEach(pip => {
            const on = !pip.blinks || ((t / pip.period + pip.phase) % 1) < PIP_DUTY;
            fillRect(b, pip.x, pip.y, pip.wide, 1, tone(on ? PIP_ON : PIP_OFF), 0);
        });
    }

    // ═════════════════════════════ ENTRY POINTS ═════════════════════════════
    const bodyCache = new Map(), vistaCache = new Map();

    function render(s, t, H) {
        const S = remember(bodyCache, `${s.w}x${s.h}:${s.R}:${s.seed}`, () => buildScene(s.w, s.h, s.cx, s.cy, s.R, s.seed, H, false));
        composeStill(s, S, t);
        paintSweep(s, S, t);
        paintHulls(s, S, t);
    }

    function renderVista(v, t, H) {
        const R = VISTA_R * Math.min(v.w, v.h), cx = v.w - VISTA_CX * R, cy = v.h * VISTA_CY;
        const S = remember(vistaCache, `${v.w}x${v.h}:${v.seed}`, () => buildScene(v.w, v.h, cx, cy, R, v.seed, H, true));
        composeStill(v, S, t);
        paintSweep(v, S, t);
        paintPips(v, S, t);
        paintHulls(v, S, t);
        paintShip(v, S, t);
    }

    window.StructureArt = { look: LOOK, render, renderVista };
})();
