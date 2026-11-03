/* ═══ Silent Exodus · new screen (?new=1) · land/MeteorLand.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/meteor-land.js (sha1 d121a9754ce5, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   It reads LandingArt.TOWER_W, 0 in the game (LandArt.js), so the cover and the land fill the frame. GAME (the review): the
   far edge of the cover over an opening is torn heaps (CREST_TEAR, CREST_HUMP), never a ruled band.
*/
/* ═══ Silent Exodus · prototypes · landing-meteor/meteor-land.js: the land far below, seen from the first frame ═══════════
   Round 3 (2026-10-31), the designer's verdict word for word: "i think we should see a bit further because when land
   appears it ddoes suddenly. and i felt almost no purpose what i do at the veryy start you know." The answer ("breaks in
   the cloud"): from the first frame of the fall the place you will land on lies far below, small and hazy (LanderScene's
   own painted field at a quarter of its landing size), under the cloud deck's top; the deck is torn, and one break in it
   is lit from under by the find's own light. Put that break under the nose and keep it there: the land grows steadily to
   life size (1/h, never a pop), the haze lifts, the deck's crest rises to meet you and you fall through a shaft of clear
   air. Miss it and you punch into blind murk. One continuous shot; no meter; one new line.
   One projection rule for every far layer (the land, the cover, its breaks, the find's light): a far point at world x is
   drawn at X = shX + (x − xA) · σ, where σ is its size now and xA the aim point (where you will come down, led less and
   less as you near the ground); its row hangs from the find's ground row Yg. The deck's own texture, the rags, the wisps,
   the streaks, the hulls and the cells stay in true world place.
   The maths part (K, sOf, gOf, view, breaksFor, inShaft, ladderStep) needs no canvas: a node vm loads it with a stub window.
   window.MeteorLand (frozen)
     K                              the numbers (DRAFT)
     sOf(dist), gOf(h)              the size of something dist world px below, 0..1; the lead's share at height h
     view(st) → V                   the projection now (a pure function of st, see view())
     breaksFor(g, o) → [break]      the deck's breaks for this find, seeded by its id: { kind, x, v, R }
     inShaft(breaks, x) → break | null   (light, flat and bad ground only; a break counts out to 1.25 R)
     ladderStep(sL) → index         the land's picture to draw (the smallest baked size at or above sL)
     prepare(G) → map               the cover's noise for this place (queued under G.tag): map.done
     carve(map, breaks)             the breaks cut into it (on the "go down" click: a few thousand cells)
     drawLand(ctx, G, V, o), drawCover(ctx, map, V, o) → ms, drawLight(f, G, V, o), shaftCols(V, breaks, cam) → [{x0, x1}]
     openAt(map, V, x, y) → bool    is the cover open at screen (x, y)
   NO SOUND.
*/
(function () {
    'use strict';
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 1. The maths (no canvas)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const K = Object.freeze({
        C: 679, H1: 66, S_SOFT: 80, K_AIM: 60, A_Q: 360, NEAR_GAP: 14, PERSP: 0.8, A_HAND: 100,   // (A_HAND 100, not 60: the cover dissolves into the deck more slowly)      // DRAFT
        D_LAND: 4.6, FW: 640, FH: 360, GROUND_UP: 10, Y_PATH: 34,                       // the camera's own (landing.js), for the projection
        LADDER: Object.freeze([0.26, 0.33, 0.41, 0.51, 0.64, 0.8]),                     // the land's picture baked at these sizes (× D_LAND), then the field's own (1)
        HAZE_FAR: Object.freeze({ THIN: 0.45, BREATHABLE: 0.62, CORROSIVE: 0.62, TOXIC: 0.72, HIGH_PRESSURE: 0.72, NONE: 0.05 }),
        OPEN: Object.freeze({ THIN: 0.18, BREATHABLE: 0.05, CORROSIVE: 0.05, TOXIC: 0.03, HIGH_PRESSURE: 0.01 }),   // the share of open sky outside the breaks
        R_L: Object.freeze({ early: 40, later: 32, risky: 26, late: 24 }), R_F: 28, R_B: 24, SHAFT: 1.25, BREAK_H: 0.38,
        MAP_X: 900, MAP_V0: -200, MAP_V1: 120, CELL: 2,                                 // the cover's map round the light: x ± MAP_X, v from MAP_V0 to MAP_V1 (world px), CELL px a cell
        ERR_GAIN: 0.8, ERR_AIRLESS: 0.35, ERR_T: 1.3, ERR_A0: 1100, ERR_A1: 300, ERR_MAX: 175,             // the fix round (DRAFT): the miss shown up to 1.8 times as far off over the first 1.3 s, back to the truth from a 1100 to a 300
        SHAFT_IN: 0.5, SHAFT_CAP: 0.17, SHAFT_TOP_CAP: 0.23,                                                 // the fix round (DRAFT): a shaft narrows through the deck to SHAFT_IN of its break, never wider than SHAFT_CAP of the frame each side of its centre
        // the polish round (DRAFT): where you will come down is worked out every PRED_S and eased over LEAD_TAU (no lag: a
        // lined-up player sees the light settle, never swing); with no input for QUIET_S it may drift at most SLEW_QUIET world
        // px a second (a hands-off fall's light slides, never jumps), with input at most SLEW_ACTIVE; the miss magnifier only
        // magnifies a miss you leave alone (it follows over MAG_FOLLOW, fades over MAG_DROP while you steer, never past the miss)
        // the polish round (DRAFT): the cover's shading (shadeCells): BASE + H · height + the slope toward us (SLOPE, clamped to
        // LO..HI); the brightest tops (over LIT) in the air's light; the far rows (FAR_ROWS from the crest) hazed toward FAR_V
        SH: Object.freeze({ BAND: 7, RISE: 1.3, HUMP: 6, WAVE: 3, CREST: 1.6, CREST_V: 0.85, V0: 0.12, V1: 0.6, FALL: 1.6, GRAIN: 0.12, THIN: 0.12, LIT: 0.6, LIT_AIR: 0.42, RIM: 0.56, EDGE: 0.16, FAR_ROWS: 120, FAR: 0.6, FAR_V: 0.3, FAR_AIR: 0.1 }),
        PAD_SHIFT: 0.4, GAP_LIP: 0.5, OUT_HAZE: 0.3, GLOW: Object.freeze({ R0: 7, R1: 10, PEAK: 0.56, AIRLESS_R: 8, AIRLESS_PEAK: 0.62, UNDER: 0.6, GAP: 0.62, FAINT_R: 6, FAINT_PEAK: 0.64 }), RIM_L: 0.07, RIM_GAP: 0.35,   // (the final fix round: a light hard to see on its ground (a geyser's steam on ice, smoke) glows wider; the light's break rimmed in light, more with no light)   // (the polish round, DRAFT: the aim on every world)
        // the final fix round (DRAFT): the cover as volume (drawCover marches its height field): heaps H0 + H1 · clump + H2 · lobes world px
        // high (HMAX at most), thinning over THICK of eff into an opening; HK of a world px stands up on screen per px across;
        // the far edge's CREST rows solid; the light from height (VH), flatness (FLAT), the faces turned to us (FACE) and the sun's side
        CV: Object.freeze({ HK: 1.0, CREST: 6, CREST_E: 0.06, SOFT: 0.14, AO: 0.2, AO_PX: 16, RIM: 0.12, RISE_PX: 48, LIP: 0, LAND_EDGE: 10, WALL_V: 0.1, DAY_V: 0.3, DAY_H: 26, FADE_DARK: 0.35, NIGHT: 0.8, H0: 2, H1: 6, H2: 7, HMAX: 15, THICK: 0.25, V0: 0.24, VH: 0.4, FLAT: 0.16, FACE: 0.26, SUN: 0.1, GRAIN: 0.05, V_MIN: 0.06, V_MAX: 0.88 }),
        MAG_DEAD: Object.freeze([4, 14]), PRED_S: 1 / 30, LEAD_TAU: 0.05, QUIET_S: 0.35, SLEW_QUIET: 45, SLEW_ACTIVE: 900, MAG_FOLLOW: 0.12, MAG_DROP: 0.35,
    });
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    const lerp = (a, b, k) => a + (b - a) * k;
    const smoother = k => { k = clamp01(k); return k * k * k * (k * (k * 6 - 15) + 10); };
    // GAME (the review): where the cover's far edge lies over an opening it was forced solid with no height (a ruled band
    // across the gap, cutting a beacon's mast): there it reaches CREST_TEAR rows further down, torn by column, and stands up
    // to CREST_HUMP world px in heaps (tearOf: 0..1 along the map's columns)
    const CREST_TEAR = 5, CREST_HUMP = 5, tearOf = c => 0.5 + 0.3 * Math.sin(c * 0.57 + 0.4) + 0.2 * Math.sin(c * 0.19 + 2.1);
    /** The size (0..1, 1 = the landing's own) of something dist world px below the shuttle: 1/h, landing size from H1. */
    const sOf = dist => Math.min(1, (K.C + K.H1) / (K.C + (dist <= K.H1 ? K.H1 : dist < K.H1 + K.S_SOFT ? K.H1 + (dist - K.H1) * (dist - K.H1) / (2 * K.S_SOFT) : dist - K.S_SOFT / 2)));   // (the polish round: eased into the landing size over the last S_SOFT px, never more than about 1 % a frame)
    /** The horizon's row in the fall: low at the top of a full drop (y 236), up to 150 by the deck; a routine drop's from 200,
        evenly (the polish round: under 1 px a frame). */
    const hzOf = e => { const a01 = clamp01(e.a / e.a0); return e.routine ? lerp(150, 200, a01) : lerp(150, 236, Math.pow(a01, 0.75)); };
    /** The lead's share at height h: almost all of it high up (you see where you will come down), none from H1 (the
        land is then drawn true, in the field's own place, and the aim point is the shuttle itself). */
    const gOf = h => { const q = Math.max(0, h - K.H1); return q / (q + K.K_AIM); };
    const ladderStep = sL => { for (let i = 0; i < K.LADDER.length; i++) if (K.LADDER[i] >= sL - 1e-9) return i; return K.LADDER.length; };   // LADDER.length: the field's own picture
    /** The projection now. st: { e (the fall), D (the lead: predicted end x − e.x, smoothed), shX (the shuttle's screen x,
        unshaken), rowShuttle (its screen y), hz (the horizon row), groundY (the find's ground, world y), light ({x, y}),
        trueY (the find's ground row in the camera's own view, unshaken), deckTopH (h at the deck's top), atmosphere }.
        Returns { h, a, sL, sC, σL (sigL), σC (sigC), g, xA, P, Yg, nearTop, hz, hazeK, step, fade }. Pure. */
    function view(st) {
        const e = st.e, a = e.a, h = e.a + (e.deck || 0) + st.gap, a01 = clamp01(a / e.a0);
        const sL = sOf(h), sC = sOf(Math.max(0, a)), sigL = K.D_LAND * sL, sigC = K.D_LAND * sC, g = gOf(h);
        // the fix round: the miss shows itself from the first second (the miss magnifier, lead() below: an off-line light left
        // alone slides away from the nose, an on-line one stays; back to the truth by the deck). What lies under the nose when
        // on line is still where you come down.
        const err = st.light.x - (e.x + st.D), mag = st.mag || 0, m = Math.abs(err) > 1e-6 ? 1 + mag / err : 1;
        const xA = e.x + st.D * g - mag;
        // the find's ground row: low under the horizon high up, down to the camera's ground lock by the deck's top, held
        // there (never moving down again: the fix round), and from there on the camera's own row once that comes up to it
        // (the field then takes over 1:1: landing.js latches the switch when trueY reaches Yg)
        // (the final fix round: st.yLock, the row the camera's own ground lock brings the field to)
        const yLock = st.yLock != null ? st.yLock : K.FH - K.GROUND_UP * K.D_LAND, pathY = st.hz + K.Y_PATH + (yLock - st.hz - K.Y_PATH) * Math.pow(1 - a01, 1.25);
        const Yg = Math.min(pathY, st.trueY), w = Yg === st.trueY ? 1 : 0;
        const P = { x: st.shX + (st.light.x - xA) * sigL, y: Yg + (st.light.y - st.groundY) * sigL };
        // the deck's crest: just under the horizon from the first frame, rising to meet the shuttle's own row at a = 0
        const q = a > 0 ? (a / (a + K.A_Q)) * ((e.a0 + K.A_Q) / e.a0) : 0, nearTop = lerp(st.rowShuttle, st.hz + K.NEAR_GAP, Math.min(1, q));
        const hazeK = (K.HAZE_FAR[st.atmosphere] != null ? K.HAZE_FAR[st.atmosphere] : 0.6) * Math.pow(1 - sL, 1.2);
        const fade = a > 0 && a <= K.A_HAND ? 1 - a / K.A_HAND : a <= 0 ? 1 : 0;
        return { h, a, sL, sC, sigL, sigC, g, xA, P, Yg, nearTop, hz: st.hz, hazeK, step: ladderStep(sL), fade, D: st.D, shX: st.shX, w, trueY: st.trueY, m, err };
    }
    /** The polish round: the lead, one step (landing.js and the node probe share it). L: { endS, mag, quiet } (made by the
        first call); o: { e, dt, endRaw (the latest predEnd), input (any key or the pointer this step), light (x: the target, the
        level pad by the light), off (the light's x less the target's), sig (σL now), atmosphere }. Eases the predicted end (slewed: slowly when you leave it alone), and the miss magnifier's extra offset
        mag (world px): over the first ERR_T s up to ERR_GAIN of the miss more, but only while you leave the miss alone (it
        fades while you steer, and never shows a correction overshoot magnified: it is never past the miss itself). */
    function lead(L, o) {
        const e = o.e, dt = o.dt, a = e.a;
        if (!L || L.endS == null) L = { endS: o.endRaw, mag: 0, quiet: 1 };
        L.quiet = o.input ? 0 : Math.min(1, L.quiet + dt / K.QUIET_S);
        const want = (o.endRaw - L.endS) * (1 - Math.exp(-dt / K.LEAD_TAU)), lim = lerp(K.SLEW_ACTIVE, K.SLEW_QUIET, L.quiet) * dt;
        L.endS += want < -lim ? -lim : want > lim ? lim : want;
        const err = o.light - L.endS, ramp = smoother((e.t || 0) / K.ERR_T) * smoother((a - K.ERR_A1) / (K.ERR_A0 - K.ERR_A1));
        let gain = K.ERR_GAIN * (o.atmosphere === 'NONE' ? K.ERR_AIRLESS : 1) * ramp * smoother((Math.abs(err) - K.MAG_DEAD[0]) / (K.MAG_DEAD[1] - K.MAG_DEAD[0]));   // (the final fix round: a near miss is never magnified: lined up, the light holds still)   // (airless: shown less magnified)
        if (gain > 0 && o.sig > 0) gain = Math.min(gain, Math.max(0, K.ERR_MAX / (Math.abs(err) * o.sig + 1e-6) - 1));   // never past ERR_MAX art px off the nose
        const target = gain * err;
        if (o.input) L.mag *= Math.exp(-dt / K.MAG_DROP); else L.mag += (target - L.mag) * (1 - Math.exp(-dt / K.MAG_FOLLOW));
        if (L.mag * target <= 0) L.mag = 0; else if (Math.abs(L.mag) > Math.abs(target)) L.mag = target;
        L.D = L.endS + (o.off || 0) - e.x;                                        // (the final fix round: o.off, the light's x less the level pad's: lined up with the light high up is coming down on the pad)
        return L;
    }
    /** One seeded generator per find. */
    function seeded(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); let s = h >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
    /** The breaks in the deck for this find. g: the ground (heights, hot, level, mark); o: { L (landing), risk, light: {x, y},
        aimX (the level stretch A.U.R.A. comes down on), groundY, seed, tiltAt (optional: the ground's tilt at x) }. */
    function breaksFor(g, o) {
        const rand = seeded(o.seed || 'x'), out = [], lx = o.light.x, gy = o.groundY, W = (g.heights || []).length || 320;
        const hAt = x => { const hs = g.heights || []; const v = hs[Math.max(0, Math.min(W - 1, Math.round(x)))]; return v == null || v > 179 ? gy : v; };
        const RL = o.L >= 20 ? K.R_L.late : o.risk >= 30 ? K.R_L.risky : o.L <= 2 ? K.R_L.early : K.R_L.later;
        const toPad = o.aimX != null ? Math.max(-K.PAD_SHIFT * RL, Math.min(K.PAD_SHIFT * RL, (o.aimX - lx) * 0.5)) : 0;   // (the final fix round: the light's break leans toward the level pad beside it, where a lined-up fall comes down)
        out.push({ kind: 'light', x: lx + toPad, v: (o.light.y - gy) - 2, R: RL });
        // the flat break: over the level stretch when the light is off it (a weak scan), else the widest other shelf 50-120 px off
        let flat = null;
        if (o.aimX != null && Math.abs(o.aimX - lx) >= 30) flat = { x: o.aimX, y: hAt(o.aimX) };
        else (g.level || []).filter(l => l.c1 - l.c0 >= 14 && Math.abs(l.cx - lx) >= 50 && Math.abs(l.cx - lx) <= 120).sort((p, q) => (q.c1 - q.c0) - (p.c1 - p.c0)).slice(0, 1).forEach(l => { flat = { x: l.cx, y: l.y }; });
        if (flat) out.push({ kind: 'flat', x: flat.x, v: (flat.y - gy) - 2, R: K.R_F });
        if ((o.risk || 0) >= 25 && g.heights) {                                             // bad ground: the worst 30 px within 120 px of the light
            let best = null;
            for (let x0 = Math.max(0, lx - 120); x0 <= Math.min(W - 30, lx + 90); x0 += 3) {
                if (Math.abs(x0 + 15 - lx) < 40 || (flat && Math.abs(x0 + 15 - flat.x) < 40)) continue;
                let s = 0;
                for (let x = x0; x < x0 + 30; x++) { const hh = g.heights[x]; s += (g.hot && g.hot[x] ? 2 : 0) + (o.tiltAt ? o.tiltAt(x) : Math.abs((g.heights[Math.min(W - 1, x + 1)] || hh) - hh)) * 0.6 + (hh > 179 ? 2 : 0); }
                if (!best || s > best.s) best = { x: x0 + 15, s };
            }
            if (best) out.push({ kind: 'bad', x: best.x, v: (hAt(best.x) - gy) - 2, R: K.R_B });
        }
        const tears = 2 + (rand() < 0.5 ? 1 : 0), more = 1 + (rand() < 0.5 ? 1 : 0);   // texture only: upstream (the way in), and a few elsewhere
        for (let i = 0; i < tears; i++) out.push({ kind: 'tear', x: lx - 70 - i * (60 + 70 * rand()) - 40 * rand(), v: -30 + 70 * rand(), R: 7 + 5 * rand() });
        for (let i = 0; i < more; i++) out.push({ kind: 'tear', x: lx + (rand() < 0.5 ? -1 : 1) * (90 + 160 * rand()), v: -40 + 80 * rand(), R: 7 + 5 * rand() });
        out.forEach((b, i) => { b.id = i + 1; b.seed = Math.floor(rand() * 200) + 3; });
        return out;
    }
    function inShaft(breaks, x) {
        let best = null, bd = Infinity;
        (breaks || []).forEach(b => { if (b.kind === 'tear') return; const d = Math.abs(x - b.x); if (d <= K.SHAFT * b.R && d < bd) { bd = d; best = b; } });
        return best;
    }

    /** One shaft's place and width on the screen (art px; play: the playfield's width). */
    function shaftGeom(V, b, d, play) {
        const cx = V.shX + (b.x - V.xA) * d, hwTop = Math.min(K.SHAFT_TOP_CAP * play, 0.85 * b.R * d), hwBot = Math.min(K.SHAFT_CAP * play, hwTop, K.SHAFT_IN * b.R * d);
        return { cx, hwTop, hwBot };
    }
    const MATHS = { K, sOf, hzOf, gOf, view, lead, breaksFor, inShaft, ladderStep, seeded, shaftGeom };
    const P = window.NSPaint, A = window.LandingArt, MA = window.MeteorArt;
    if (!P || !A || !MA || typeof document === 'undefined') { window.MeteorLand = Object.freeze(MATHS); return; }   // node: the maths only

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 2. The cover's map (the deck's top seen from above): noise baked per place, the breaks cut on the click
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const { RP, fbm, vnoise, hash, smooth } = P, FW = A.FW, FH = A.FH, TOWER = A.TOWER_W;
    const BAYER = new Float32Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) BAYER[y * 8 + x] = P.threshold(x, y);
    const MW = Math.round(2 * K.MAP_X / K.CELL) + 2, MH = Math.round((K.MAP_V1 - K.MAP_V0) / K.CELL) + 2, rowE = new Float32Array(MW + 2), rowSh = new Float32Array(MW + 2), rowH = new Float32Array(MW + 2), YBUF = new Int16Array(640), AO_TAB = new Float32Array(64), RIM_T = Float32Array.of(1, 0.6, 0.25), WNT = new Float32Array(64 * 64);
    for (let i = 0; i < WNT.length; i++) WNT[i] = hash(i & 63, i >> 6, 97);       // (a white-noise threshold: soft gradients, never a lattice)
    for (let k = 0; k < 64; k++) AO_TAB[k] = K.CV.AO * Math.pow(Math.min(1, k / K.CV.AO_PX), 1.3);   // a face's shade by how far below its silhouette (px)
    const DIS = new Float32Array(64 * 64);                                       // a smooth tiling noise, 0..1 (the polish round: the haze's veils, the lips' arcs, the edges' softness)
    { let lo = 1, hi = 0; for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const u = x / 64, v = y / 64, f = (a, b) => fbm(a / 7, b / 5, 77, 3), n = (f(x, y) * (1 - u) + f(x - 64, y) * u) * (1 - v) + (f(x, y - 64) * (1 - u) + f(x - 64, y - 64) * u) * v; DIS[y * 64 + x] = n; lo = Math.min(lo, n); hi = Math.max(hi, n); } for (let i = 0; i < DIS.length; i++) DIS[i] = (DIS[i] - lo) / (hi - lo || 1); }
    /** The cover's map for this place (the deck's top seen from above), baked a few rows a job under G.tag. The final fix
        round: the cloud as volume. n is its body (where it is cloud and how thick); clump (big rounded heaps) and puff (the
        small rounded lobes on them, |2 fbm − 1|: soft domes with creases between) make its top a height field (hgt, world
        px), and each cell's light is worked out from it (shadeCells): high, flat tops lit by the sky, the faces turned
        toward us and the troughs in shade, the side away from the sun darker. drawCover marches it column by column, near
        to far, so nearer heaps hide the ones behind them (round silhouettes, never slabs). Once the bias that leaves `open`
        of the sky clear is known, eff = n + bias − 0.5 (cloud over 0). */
    function prepare(G, lightX) {
        const key = G.key + ':' + Math.round(lightX);
        if (G.cover && G.cover.key === key) return G.cover;
        const w = G.world, air = w.atmosphere, open = K.OPEN[air], seed = (w.seed || 3) + 211;
        const map = { key, done: false, none: !(w.atm > 0), x0: lightX - K.MAP_X, n: new Float32Array(MW * MH), puff: new Float32Array(MW * MH), clump: new Float32Array(MW * MH), eff: null, hgt: null, shade: null, lip: null, hgt0: null, shade0: null, lip0: null, rid: null, rr: null, bias: 0, open: open == null ? 0 : open, carved: null, ls: (G.S && G.S.Ls) || 1 };
        G.cover = map;
        if (map.none) { A.later(() => { map.done = true; }, G.tag, false, 'cover none'); return map; }
        const ROWS = 8;                                                           // (small jobs: never a long slice in the release or the fall)
        for (let r0 = 0; r0 < MH; r0 += ROWS) A.later(() => {
            for (let r = r0; r < Math.min(MH, r0 + ROWS); r++) {
                const v = K.MAP_V0 + r * K.CELL;
                for (let c = 0; c < MW; c++) {
                    const x = map.x0 + c * K.CELL, i = r * MW + c;
                    map.n[i] = fbm(x / 50, v / 26, seed, 3);
                    map.puff[i] = smooth(0.25, 0.8, fbm(x / 17, v / 7.5, seed + 7, 3));             // rounded heaps, with dips between
                    map.clump[i] = smooth(0.28, 0.78, fbm(x / 78, v / 24, seed + 13, 2));            // the big heaps they sit on
                }
            }
        }, G.tag, false, 'cover ' + r0);
        A.later(() => {
            const s = Array.from(map.n.filter((_, i) => i % 7 === 0)).sort((p, q) => p - q);   // the bias that leaves `open` of the sky clear
            map.bias = 0.5 - s[Math.max(0, Math.min(s.length - 1, Math.floor(map.open * s.length)))];
        }, G.tag, false, 'cover bias');
        A.later(() => {                                                           // (its own job: the final fix round)
            map.eff = new Float32Array(map.n.length);
            for (let i = 0; i < map.eff.length; i++) map.eff[i] = map.n[i] + map.bias - 0.5;
            map.hgt = new Float32Array(MW * MH); map.shade = new Float32Array(MW * MH); map.lip = new Uint8Array(MW * MH);
        }, G.tag, false, 'cover eff');
        for (let r0 = 0; r0 < MH; r0 += 27) A.later(() => shadeCells(map, r0, Math.min(MH - 1, r0 + 26), 0, MW - 1), G.tag, false, 'cover shade ' + r0);
        A.later(() => { map.hgt0 = map.hgt.slice(); map.shade0 = map.shade.slice(); map.lip0 = map.lip.slice(); map.done = true; }, G.tag, false, 'cover done');
        return map;
    }
    /** The height of the cloud's top at cell i (world px; under 0: open sky): heaps and lobes, low where the cloud thins
        toward an opening (its walls slope down into it). */
    const hgtOf = (map, i) => { const e = map.eff[i]; if (e <= 0) return -1; const C = K.CV; return (C.H0 + C.H1 * map.clump[i] + C.H2 * map.puff[i] * (0.45 + 0.55 * map.clump[i])) * smooth(0, C.THICK, e); };
    /** The height and the light for map rows r0..r1, columns c0..c1 (DRAFT numbers: K.CV): the value (0..1 in the cloud's
        ramp, before the night; over SH.LIT the air's own light) from how high and how flat the top is there, the faces
        turned toward us (the top falling toward the near side) in shade, the side away from the sun darker; and the lips
        (1..3: cloud here, an opening that many cells nearer us). */
    function shadeCells(map, r0, r1, c0, c1) {
        const hg = map.hgt, sh = map.shade, lip = map.lip, eff = map.eff, C = K.CV, ls = map.ls < 0 ? -1 : 1;
        const R0 = Math.max(0, r0 - 1), R1 = Math.min(MH - 1, r1 + 1), C0 = Math.max(0, c0 - 1), C1 = Math.min(MW - 1, c1 + 1);
        for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) { const i = r * MW + c; hg[i] = hgtOf(map, i); }
        for (let r = r0; r <= r1; r++) {
            const row = r * MW, up = Math.max(0, r - 1) * MW, dn = Math.min(MH - 1, r + 1) * MW;
            for (let c = c0; c <= c1; c++) {
                const i = row + c, h = hg[i];
                let l = 0;
                if (eff[i] > 0) for (let k = 1; k <= 3 && r + k < MH; k++) if (eff[(r + k) * MW + c] < 0) { l = k; break; }
                lip[i] = l;
                if (h < 0) { sh[i] = 0; continue; }
                const hl = Math.max(0, hg[row + Math.max(0, c - 1)]), hr = Math.max(0, hg[row + Math.min(MW - 1, c + 1)]), hf = Math.max(0, hg[up + c]), hn = Math.max(0, hg[dn + c]);
                const toUs = (hf - hn) / (2 * K.CELL), side = (hl - hr) / (2 * K.CELL) * ls, steep = Math.hypot(toUs, side);   // toUs > 0: the top falls toward us here (a face turned to us); side > 0: it faces the sun
                const hn01 = h / C.HMAX;
                sh[i] = Math.max(C.V_MIN, Math.min(C.V_MAX, C.V0 + C.VH * Math.pow(hn01, 0.8) + C.FLAT * Math.max(0, 1 - steep * 1.6) - C.FACE * Math.max(0, toUs) + C.SUN * Math.max(-1, Math.min(1, side)) + C.GRAIN * (map.puff[i] - 0.5)));
            }
        }
    }
    /** The breaks cut into the map (on the click, or ahead in the idle queue: only the cells round each break), and their
        heights and light worked out again there. eff = n + bias - 0.5 - 1.2 · open. */
    function carve(map, breaks) {
        if (!map || !map.done || map.none) return;
        const sig = breaks.map(b => b.kind + b.x.toFixed(1) + ':' + b.v.toFixed(1) + ':' + b.R.toFixed(1)).join('|');
        if (map.carved === sig) { map.breaks = breaks; return; }                  // (the polish round: already cut, ahead)
        if (map.dirty) map.dirty.forEach(([r0, r1, c0, c1]) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const i = r * MW + c; map.eff[i] = map.n[i] + map.bias - 0.5; map.hgt[i] = map.hgt0[i]; map.shade[i] = map.shade0[i]; map.lip[i] = map.lip0[i]; } });
        if (!map.rid) { map.rid = new Uint8Array(MW * MH); map.rr = new Float32Array(MW * MH).fill(9); }
        else if (map.dirty) map.dirty.forEach(([r0, r1, c0, c1]) => { for (let r = r0; r <= r1; r++) { map.rid.fill(0, r * MW + c0, r * MW + c1 + 1); map.rr.fill(9, r * MW + c0, r * MW + c1 + 1); } });
        map.dirty = [];
        breaks.forEach(b => {
            const ragged = new Float32Array(65);                                  // the ragged radius by the angle: ± 35 %: weather, never a ring or a window
            for (let k = 0; k <= 64; k++) ragged[k] = 1 + 0.7 * (fbm(Math.cos(k / 64 * 6.283) * 2.2 + b.seed, Math.sin(k / 64 * 6.283) * 2.2, b.seed, 3) - 0.5) * 2;
            ragged[64] = ragged[0];
            const RH = b.R * K.BREAK_H, c0 = Math.max(0, Math.floor((b.x - b.R * 1.6 - map.x0) / K.CELL)), c1 = Math.min(MW - 1, Math.ceil((b.x + b.R * 1.6 - map.x0) / K.CELL));
            const r0 = Math.max(0, Math.floor((b.v - RH * 1.6 - K.MAP_V0) / K.CELL)), r1 = Math.min(MH - 1, Math.ceil((b.v + RH * 1.6 - K.MAP_V0) / K.CELL));
            for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
                const dx = (map.x0 + c * K.CELL - b.x) / b.R, dv = (K.MAP_V0 + r * K.CELL - b.v) / RH, ang = Math.atan2(dv, dx), kk = ((ang / 6.283 + 1) % 1) * 64, k0 = Math.floor(kk);
                const rr = Math.hypot(dx, dv) / (ragged[k0] + (ragged[k0 + 1] - ragged[k0]) * (kk - k0)), i = r * MW + c;
                const open = rr < 0.6 ? 1 : rr > 1 ? 0 : 1 - (rr - 0.6) / 0.4;
                map.eff[i] -= 1.2 * open * open * (3 - 2 * open);
                if (rr < map.rr[i]) { map.rr[i] = rr; map.rid[i] = b.id; }
            }
            map.dirty.push([Math.max(0, r0 - 4), Math.min(MH - 1, r1 + 4), Math.max(0, c0 - 1), Math.min(MW - 1, c1 + 1)]);
        });
        map.dirty.forEach(([r0, r1, c0, c1]) => shadeCells(map, r0, r1, c0, c1));
        map.breaks = breaks; map.carved = sig;
    }
    /** The map's value at world (x, v) (nearest cell; outside it: solid cloud). */
    function effAt(map, x, v) {
        const c = Math.round((x - map.x0) / K.CELL), r = Math.round((v - K.MAP_V0) / K.CELL);
        if (c < 0 || r < 0 || c >= MW || r >= MH || !map.eff) return 1;
        return map.eff[r * MW + c];
    }
    const rowSig = (V, y) => V.sigC * Math.max(0.5, 1 + K.PERSP * (y - V.Yg) / FH);
    function openAt(map, V, x, y) {
        if (!map || map.none) return true;
        const s = rowSig(V, y), wx = V.xA + (x - V.shX) / s, v = (y - V.Yg) / s;
        return effAt(map, wx, v) < 0;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. Drawing
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const u32 = rgb => ((255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
    const LIGHT_RAMP = { wreck: RP.RED, flare: RP.RED, colony: RP.AMBER, signal: RP.AMBER, life: A.R.TEAL, machines: A.R.LAMP, geyser: RP.AMBER, vent: A.R.ACID, smoke: A.R.SMOKE, devil: RP.DUST };
    let cov = null;
    function covBuf() {
        if (!cov) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; const g = c.getContext('2d'); const img = g.createImageData(FW, FH); cov = { c, g, img, d32: new Uint32Array(img.data.buffer) }; }
        return cov;
    }
    const palCache = new Map();
    function palette(r, night) {
        const key = r.hex.join() + ':' + night;
        if (!palCache.has(key)) palCache.set(key, r.rgb.map(u32));
        return palCache.get(key);
    }
    /** The cover (the final fix round: the cloud as volume). The deck's top is marched column by column from the foot of the
        frame up to its far edge (near to far, as an old voxel landscape is): each screen row is a row of the map by the one
        projection (each row its own scale: a sea receding to its crest), each cell's top stands hgt world px over it, and a
        heap is drawn from its top down to whatever nearer heap already hides the rest, so nearer heaps hide farther ones
        (round silhouettes, soft lit tops, shaded faces; never slabs, never rows). Its light comes from the map (shadeCells),
        the brightest tops in the air's own light, the far rows hazed toward the horizon. Where it is open the land far
        below shows under the haze, in uneven veils (the light's own break the one clear window); the edge of an opening is
        torn soft over a few px; the light's break is rimmed in light (more so with no light to aim at), and where the land
        is not (over its own top, beside or under its picture) an opening shows the day under the deck or the hole's dark
        wall, never the picture's edge. Its far edge is solid cloud: its heaps against the sky, never a ruled band. Close by it dissolves into the deck close (the deck's own mist, pixel for pixel). o: { E, night, lightKind,
        lightOn (0..1), shake: [dx, dy], probe (no haze), landTop, landBox (the land picture's place on screen), deckOx, deckOy }. Returns the time it took (ms). */
    function drawCover(ctx, map, V, o) {
        if (!map || map.none || !map.done || !map.eff || !map.hgt) return 0;
        const t0 = performance.now(), B = covBuf(), d = B.d32, sx = o.shake ? o.shake[0] : 0, sy = o.shake ? o.shake[1] : 0, C = K.CV, S = K.SH;
        const night = (o.night || 1) < 1 ? K.CV.NIGHT : 1, E = o.E, cloud = E.cloud || A.mute(RP.DUST), airR = E.airR || RP.ICE;   // (by night its tops still read: the night darkens it less than the land)
        const cp = palette(cloud), ap = palette(airR), ctop = cp.length - 1, atop = ap.length - 1;
        const lightOn = o.lightOn == null ? 1 : o.lightOn;                     // (no light yet: the gap's rim brighter)
        const Yg = V.Yg + sy, shX = V.shX + sx, nT = V.nearTop + sy;   // (the shake goes into the projection: the pass covers the whole frame, no empty strip at an edge)
        const yBase = Math.max(0, Math.floor(nT)), y0 = Math.max(0, yBase - C.RISE_PX), crestY = nT + C.CREST, hazeK = o.probe ? 0 : V.hazeK, fade = V.fade;
        const rid = map.rid, eff = map.eff, hgt = map.hgt, shd = map.shade, cMax = MW - 1;
        const landTop = o.probe || o.landTop == null ? -1 : o.landTop + sy, bs = map.breaks || [], lightId = bs[0] ? bs[0].id : -1;
        for (let y = y0; y < FH; y++) d.fill(0, y * FW + TOWER, (y + 1) * FW);   // (only the rows the pass may write, right of the tower)
        YBUF.fill(FH);
        const gapRim = o.probe ? 0 : lightOn > 0 ? K.RIM_L : K.RIM_GAP;   // (the light's break: its edge lit, so the window reads from the first frame)
        // (the final fix round: no lip glow on the light's break: drawn in dots it read as stitches; the break's lit rim and the light's own halo carry it)
        const OUT_H = o.probe ? 0 : K.OUT_HAZE, MT = MA.mist(), mox = Math.round(o.deckOx || 0) - sx, moy = Math.round(o.deckOy || 0) + sy;
        const hazeV = 0.24 * night * atop, LB = o.landBox && !o.probe ? o.landBox : null, bx0 = LB ? LB.x : 0, bx1 = LB ? LB.x + LB.w : 0, by1 = LB ? LB.y + LB.h : 0, EDGE = C.LAND_EDGE;   // (the land shows through an opening only inside its own picture, under its top: elsewhere the opening is deep haze, its edge soft and uneven)
        const nc = night * ctop, na = night * atop, litV = S.LIT, rimC = C.RIM, AOT = AO_TAB;
        for (let yA = FH - 1, y = 0; yA >= yBase; yA = y - 1) {                  // (two to four screen rows a sample, more where a map cell is many rows tall)
            const sA = V.sigC * Math.max(0.5, 1 + K.PERSP * (yA - Yg) / FH), step = sA > 2.5 ? Math.min(4, Math.round(sA * 0.8)) : 2;
            y = Math.max(yBase, yA - step + 1);
            const yc = 0.5 * (y + yA);
            const s = V.sigC * Math.max(0.5, 1 + K.PERSP * (yc + 0.5 - Yg) / FH), v = (yc + 0.5 - Yg) / s, rf0 = (v - K.MAP_V0) / K.CELL, rf = rf0 < 0 ? 0 : rf0 > MH - 1.001 ? MH - 1.001 : rf0, r = rf | 0, fy = rf - r, row = r * MW, rowB = row + MW, rowN = Math.round(rf) * MW;
            const dc = 1 / (s * K.CELL), cB = (V.xA - shX / s - map.x0) / K.CELL, hs = s * C.HK;
            let cA = Math.floor(cB + (TOWER + 0.5) * dc) - 1, cZ = Math.floor(cB + (FW + 0.5) * dc) + 2;
            if (cA < 0) cA = 0; if (cZ > cMax) cZ = cMax;
            let hMax = 0;
            for (let c = cA; c <= cZ; c++) { rowE[c] = eff[row + c] + (eff[rowB + c] - eff[row + c]) * fy; const hh = hgt[row + c] + (hgt[rowB + c] - hgt[row + c]) * fy; rowH[c] = hh; if (hh > hMax) hMax = hh; rowSh[c] = shd[row + c] + (shd[rowB + c] - shd[row + c]) * fy; }
            const far = 1 - clamp01((yc - nT) / S.FAR_ROWS), farK = S.FAR * far * far, farV = S.FAR_V * farK, hzRow = o.probe ? 0 : farK * S.FAR_AIR, rimK = rimC * (1 - farK);
            const crest = yc < crestY, crestRow = yc < crestY + CREST_TEAR, hzRowT = ((((rf * 1.3) | 0) + 17) & 63) * 64, reach = Math.floor(yc + 0.5 - (crestRow ? Math.max(hMax, CREST_HUMP) : hMax) * hs) - 1, ty = (y & 7) << 3;   // GAME: crestRow
            let cf = cB + (TOWER + 1) * dc;                                      // (the map read once per two columns, each pixel its own dither: the cover's budget is 3 ms)
            for (let x = TOWER; x < FW; x += 2, cf += 2 * dc) {
                const yb = YBUF[x];
                if (yb <= reach) continue;                                       // covered above anything this row can reach
                let c = cf < 0 ? 0 : cf | 0;
                if (c >= cMax) c = cMax - 1;
                const fx = cf - c, th = BAYER[ty | (x & 7)], x1 = x + 1, tbA = x & 7, tbB = x1 & 7;
                let ev = rowE[c] + (rowE[c + 1] - rowE[c]) * fx;
                let cn = (cf + 0.5) | 0; if (cn > cMax) cn = cMax;
                const i = rowN + cn, inL = rid && rid[i] === lightId;
                let humped = false;                                               // GAME: a far edge forced over an opening (its heaps, torn)
                if (crest || (crestRow && yc < crestY + CREST_TEAR * tearOf(cf))) { if (ev < C.CREST_E) { ev = C.CREST_E; humped = true; } }   // the far edge: solid cloud against the sky
                else if (ev + (th - 0.5) * C.SOFT < 0) {                          // open (its edge torn soft): the land far below, under the haze in veils
                    if (y < yb) {
                        YBUF[x] = YBUF[x1] = y;
                        const veil = 0.55 + 0.9 * DIS[hzRowT + (((cf * 1.1) | 0) & 63)];
                        let lid = 0;
                        if (LB) { const wob = 7 * (DIS[(((yc * 0.3) | 0) & 63) * 64 + (((x * 0.35) | 0) & 63)] - 0.5); lid = clamp01(Math.max((landTop + EDGE + wob - yc) / EDGE, (yc - (by1 - EDGE) + wob) / EDGE, (bx0 + EDGE - x + wob) / EDGE, (x - (bx1 - EDGE) + wob) / EDGE)); }
                        const h = ((y < landTop ? Math.max(hazeK, 0.62) : hazeK) + (inL ? 0 : OUT_H)) * veil * (inL ? 0.3 : 1) + hzRow, vv = hazeV * (0.85 + 0.4 * veil), lo = vv | 0, fr = vv - lo;
                        const wv = (C.WALL_V + 0.08 * veil) * nc, wl = wv | 0, wf = wv - wl;   // where the land is not (beside or under its picture): the hole's own deep wall, dark cloud
                        const upK = LB && yc < landTop + EDGE ? clamp01((landTop + EDGE - yc) / C.DAY_H) : -1;   // over the land's own top: the day under the deck, pale by the land's edge, darker up toward the far wall
                        for (let yy = y; yy < yb; yy++) for (let xx = x; xx <= x1; xx++) {
                            const t = BAYER[((yy & 7) << 3) | (xx & 7)];
                            if (fade > 0 && MT[((yy + moy) & 127) * 128 + ((xx - mox) & 127)] + (t - 0.5) * 0.1 < fade) continue;
                            if (lid > 0 && BAYER[(((yy + 2) & 7) << 3) | ((xx + 6) & 7)] < lid * 1.05) {
                                if (upK >= 0 && WNT[((yy & 63) << 6) | (xx & 63)] > upK * 0.85 + 0.08) { const dv = (C.DAY_V - 0.12 * upK + 0.05 * veil) * na, dl = dv | 0, k = dl + (dv - dl > t ? 1 : 0); d[yy * FW + xx] = ap[k > atop ? atop : k]; continue; }
                                const k = wl + (wf > t ? 1 : 0); d[yy * FW + xx] = cp[k > ctop ? ctop : k]; continue;
                            }
                            if (h > 0 && BAYER[(((yy + 5) & 7) << 3) | ((xx + 3) & 7)] < h) { const k = lo + (fr > t ? 1 : 0); d[yy * FW + xx] = ap[k > atop ? atop : k]; }
                        }
                    }
                    continue;
                }
                let hh = rowH[c] + (rowH[c + 1] - rowH[c]) * fx;
                if (humped) hh = Math.max(hh, CREST_HUMP * tearOf(cf * 0.7 + 11));   // GAME
                const tf = yc + 0.5 - (hh > 0 ? hh : 0) * hs;
                let top = tf >= 0 ? tf | 0 : Math.floor(tf);
                if (top > y) top = y;
                if (top >= yb) continue;
                if (top < y0) top = y0;
                // this cell's light: its own, hazed with distance, darker as it dissolves into the deck close, the light's break rimmed
                const gr = inL ? map.rr[i] : 9;
                let sv = ((rowSh[c] + (rowSh[c + 1] - rowSh[c]) * fx) * (1 - farK) + farV) * (1 - C.FADE_DARK * fade) + (gr < 1.5 ? gapRim * clamp01(1 - Math.abs(gr - 1.1) / 0.35) : 0);
                if (sv < 0) sv = 0;
                const rm = yb - top >= 3 ? rimK : 0, lit0 = sv + rm > litV;      // a heap's top lit by the sky along its silhouette (rm, over its first 3 px); its face darker the farther down it goes (by px: the shading follows the silhouette)
                for (let yy = top, k = 0, o2 = top * FW + x; yy < yb; yy++, k++, o2 += FW) {
                    const tr = (yy & 7) << 3, t0 = BAYER[tr | tbA], t1 = BAYER[tr | tbB];
                    const val = sv - AOT[k > 63 ? 63 : k] + (k < 3 ? rm * RIM_T[k] : 0);
                    if (fade > 0) {                                               // the dissolve into the deck close (its own mist)
                        const mr = ((yy + moy) & 127) * 128;
                        const inA = MT[mr + ((x - mox) & 127)] + (t0 - 0.5) * 0.1 >= fade, inB = MT[mr + ((x1 - mox) & 127)] + (t1 - 0.5) * 0.1 >= fade;
                        if (!inA && !inB) continue;
                        if (lit0 && val > litV) { const av = (S.LIT_AIR + (val - litV) * 0.6) * na, lo = av | 0, fr = av - lo; if (inA) d[o2] = ap[lo + (fr > t0 ? 1 : 0)]; if (inB) d[o2 + 1] = ap[lo + (fr > t1 ? 1 : 0)]; continue; }
                        const cv = val > 0 ? val * nc : 0, lo = cv | 0, fr = cv - lo;
                        if (inA) d[o2] = cp[lo + (fr > t0 ? 1 : 0)]; if (inB) d[o2 + 1] = cp[lo + (fr > t1 ? 1 : 0)];
                        continue;
                    }
                    if (lit0 && val > litV) { const av = (S.LIT_AIR + (val - litV) * 0.6) * na, lo = av | 0, fr = av - lo; d[o2] = ap[lo + (fr > t0 ? 1 : 0)]; d[o2 + 1] = ap[lo + (fr > t1 ? 1 : 0)]; continue; }   // the brightest tops: the sky's own light on them
                    const cv = val > 0 ? val * nc : 0, lo = cv | 0, fr = cv - lo;
                    d[o2] = cp[lo + (fr > t0 ? 1 : 0)]; d[o2 + 1] = cp[lo + (fr > t1 ? 1 : 0)];
                }
                YBUF[x] = YBUF[x1] = top;
            }
        }
        B.g.putImageData(B.img, 0, 0, TOWER, y0, FW - TOWER, FH - y0);
        ctx.drawImage(B.c, TOWER, y0, FW - TOWER, FH - y0, TOWER, y0, FW - TOWER, FH - y0);
        return performance.now() - t0;
    }
    /** The land far below: one picture of the place (the smallest baked size at or above sL, shrunk a fifth at most), laid
        by the projection, clipped to the crest. At h ≤ H1 it draws nothing (landing.js draws the field itself, 1:1).
        o: { shake, probe ('#ff00ff': a key rectangle of the same bounds and clip instead), airless }. Returns its bounds. */
    function drawLand(ctx, G, V, o) {
        if (o.fieldOn) return null;
        const ladder = G.ladder || [];
        let pic = null, k = 1;
        for (let i = V.step; i < ladder.length; i++) { const L = ladder[i]; if (L && L.pic && L.pic.done) { pic = L.pic; k = L.k; break; } }
        if (!pic) { pic = G.mainFar || G.main; k = 1; }
        if (!pic || !pic.done) return null;
        const night = G.tod === 'night' && pic.dark, src = night ? pic.dark : pic.lit, Vp = pic.V, r = V.sigL / Vp.d;
        const sk = 0.3 + 0.7 * V.sL * V.sL, sx = o.shake ? Math.round(o.shake[0] * sk) : 0, sy = o.shake ? Math.round(o.shake[1] * sk) : 0;
        const x = V.shX + (Vp.ox - V.xA) * V.sigL + sx, y = V.Yg + (Vp.oy - (o.anchorY == null ? G.groundY : o.anchorY)) * V.sigL + sy, w = Vp.w * r, h = Vp.h * r;
        const clipY = V.a > 0 ? Math.max(0, Math.floor(V.nearTop + K.CV.CREST - 1 + (o.shake ? o.shake[1] : 0))) : o.clipTop != null ? Math.max(0, Math.floor(o.clipTop)) : 0;   // (the fix round: inside the deck the deck itself covers the land; the polish round: never above the deck's own top: no flood of land at a = 0; the final fix round: above the deck, never above its solid far edge: no ruled band of land between its heaps)
        const X0 = Math.round(x), Y0 = Math.round(y), W0 = Math.round(x + w) - X0, H0 = Math.round(y + h) - Y0;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, clipY, FW, FH - clipY); ctx.clip();
        if (o.probe) keyed(ctx, o.probe, c => drawPic(c, src, X0, Y0, W0, H0, clipY));
        else {                                                                   // (the polish round: only the part of the picture on screen, by the same transform: much less to scale)
            ctx.imageSmoothingEnabled = false;
            drawPic(ctx, src, X0, Y0, W0, H0, clipY);
        }
        ctx.restore();
        if (o.airless && !o.probe) A.dissolve && fadeBand(ctx, clipY);
        return { x: X0, y: Y0, w: W0, h: H0, clipY, k };
    }
    /** The polish round (probe only): what draw(ctx) puts down, in the key colour (its alpha kept). */
    let keyC = null;
    function keyed(ctx, key, draw) {
        if (!keyC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; keyC = c.getContext('2d'); }
        keyC.globalCompositeOperation = 'source-over'; keyC.clearRect(0, 0, FW, FH); keyC.imageSmoothingEnabled = false;
        draw(keyC);
        keyC.globalCompositeOperation = 'source-in'; keyC.fillStyle = key; keyC.fillRect(0, 0, FW, FH); keyC.globalCompositeOperation = 'source-over';
        ctx.drawImage(keyC.canvas, 0, 0);
    }
    function drawPic(ctx, src, X0, Y0, W0, H0, clipY) {
        const kx = src.width / W0, ky = src.height / H0, vx0 = Math.max(X0, 0), vx1 = Math.min(X0 + W0, FW), vy0 = Math.max(Y0, clipY), vy1 = Math.min(Y0 + H0, FH);
        if (vx1 <= vx0 || vy1 <= vy0) return;
        const sx0 = Math.max(0, Math.floor((vx0 - X0) * kx)), sx1 = Math.min(src.width, Math.ceil((vx1 - X0) * kx)), sy0 = Math.max(0, Math.floor((vy0 - Y0) * ky)), sy1 = Math.min(src.height, Math.ceil((vy1 - Y0) * ky));
        if (sx1 > sx0 && sy1 > sy0) ctx.drawImage(src, sx0, sy0, sx1 - sx0, sy1 - sy0, X0 + sx0 / kx, Y0 + sy0 / ky, (sx1 - sx0) / kx, (sy1 - sy0) / ky);
    }
    let fadeC = null;
    function fadeBand(ctx, y) {                                                      // airless: the land's top dissolves into the limb (fadeTop's recipe)
        if (!fadeC) {
            const c = document.createElement('canvas'); c.width = FW; c.height = 16;
            const g = c.getContext('2d'), img = g.createImageData(FW, 16), ink = P.hexRgb(P.INK);
            for (let r = 0; r < 16; r++) { const kk = 1 - r / 16; for (let x = 0; x < FW; x++) if (P.threshold(x, r) < kk) { const i = (r * FW + x) * 4; img.data[i] = ink[0]; img.data[i + 1] = ink[1]; img.data[i + 2] = ink[2]; img.data[i + 3] = 255; } }
            g.putImageData(img, 0, 0); fadeC = c;
        }
        ctx.drawImage(fadeC, 0, Math.round(y));
    }
    /** The find's light at P, crisp (never hazed, never smaller than before): through its break, under the cover (a
        smudge), or up through the deck when blind. o: { now, night, kind, cloud, out, burn, shake, sigL }. */
    function drawLight(f, G, V, o) {
        const px = V.P.x + (o.shake ? o.shake[0] : 0), py = V.P.y + (o.shake ? o.shake[1] : 0);
        if (px < TOWER - 10 || px > FW + 10 || py < V.nearTop - 2 || py > FH + 6) return false;
        const shown = A.drawLight(f, o.kind, px, py, o.now, { night: o.night, cloud: o.cloud, lit: true, out: o.out, burn: o.burn });
        if (shown && o.cloud < 0.3 && (o.kind === 'colony' || o.kind === 'machines')) {   // their other lamps at their own scaled offsets (a colony's windows, the machines' blink)
            const sc = V.sigL / K.D_LAND;
            [-14, -7, 9, 17].forEach((dx, i) => {
                const x = Math.round(px + dx * 1.4 * sc * 2.2), y = Math.round(py + (i % 2) * sc * 2);
                if (x < TOWER) return;
                if (o.kind === 'colony') { if (i !== 2) f.px(x, y, RP.AMBER.hex[i % 2 ? 3 : 4]); }
                else if ((o.now % 1000) < 140) f.px(x, y, '#e1f6fb'); else f.px(x, y, A.R.LAMP.hex[2]);
            });
        }
        return shown;
    }
    /** The breaks' shafts through the deck on the screen (the fix round): each a funnel centred on its break by the same
        lead, as wide as the break's opening at the deck's top and narrowing through it (SHAFT_IN of R at its floor), never
        wider than SHAFT_TOP_CAP / SHAFT_CAP of the playfield each side. → [{ cx, hwTop, hwBot, kind }] */
    function shaftCols(V, breaks, cam) {
        const out = [], play = FW - TOWER;
        (breaks || []).forEach(b => { if (b.kind === 'tear') return; const g = shaftGeom(V, b, cam.d, play); if (g.cx + g.hwTop > TOWER && g.cx - g.hwTop < FW) out.push(Object.assign(g, { kind: b.kind })); });
        return out;
    }
    /** Thin air's open sky (the fix round): the clear run of the deck's top round world x (none: null), as a break. */
    function openRun(map, x) {
        if (!map || map.none || !map.eff || effAt(map, x, 0) >= 0) return null;
        let l = x, r = x;
        while (r - x < 80 && effAt(map, r + 2, 0) < 0) r += 2;
        while (x - l < 80 && effAt(map, l - 2, 0) < 0) l -= 2;
        return { kind: 'open', x: (l + r) / 2, v: 0, R: Math.max(6, (r - l) / 2) / K.SHAFT_IN, id: 0 };
    }
    window.MeteorLand = Object.freeze(Object.assign({}, MATHS, { keyed, warm: () => { covBuf(); }, prepare, carve, drawCover, drawLand, drawLight, shaftCols, openRun, openAt, effAt, LIGHT_RAMP }));
})();
