/* ═══ Silent Exodus · new screen (?new=1) · land/BurnFlight.js: THE BURN, the rules ═════════════════════════════════════
   The new look's landing as a rocket's soft landing (the designer, 2026-11-11: "should feel intense thats where most
   shacking is happening where we try to slow down and not vobble too much and keep it straight against the fall"; then
   "i dont want us to feel we can slow down so fast it has to be struggle"). Ported from the sketch
   prototypes/landing-burn/burn.js, sketch 5 (approved 2026-11-11: "Yes, build it"); the numbers are the sketch's.
   What happens in a landing, with no drawing and no page (a node vm loads it with a stub window): the air and the fall;
   the engine, which barely wins (NET over the world's own pull): held, it takes a beat to catch, comes up over BUILD
   seconds and gives exactly the braking she needs, up to all it has, so the burn is HELD to the ground and never tapped;
   lit early it idles; let go for under about a second it catches at once, longer is a cold restart; her tilt (our hand,
   the air righting her, the burn tipping her, the gusts); the touchdown on the two feet; A.U.R.A.'s hands; the look-ahead
   that times "Burn now" by flying the very same engine; and how near the land is drawn (gapf).
   BurnScene.js draws it; BurnFall.js is the minigame.
   Units: px of the world, seconds. y is the height of her feet over the site's level. The picture shows the world at
   K.Z art px per px (one far camera, top to bottom: a push-in hid the ground coming).

   window.BurnFlight (frozen)
     K                             the numbers
     rulesFor(o) → W               a world's air and ground as the flight reads them (o: { gravity, atm, storm, ground, seed, risk, quick });
                                   it flies two short probes to place the cloud above the call and to fill the tanks (o.quick: none, for the bridge's warm-up)
     newFlight(W, mode) → S        a fresh flight ('full': the long fall; 'short': a routine drop)
     step(S, at, inp, dt)          one step; at(x): the ground's height; inp: { burn, lean -1..1 }; sets S.landed at the touchdown
     auraInput(S, at, sink) → inp  A.U.R.A.'s hands (sink: the speed she sets down at; a routine drop's carried grade)
     arrive(S, at, wait, tanks) → { v, dry }   looking ahead: the burn held from `wait` seconds on, how fast she meets the ground
     cueNow(S, at), lateNow(S, at) is it time to say "burn"; is all she has no longer enough for a soft one
     gapf(d) → art px              how far below her feet the ground is drawn when she is d px up (true to scale close in, easing out with height)
     airAt(W, y) → 0..1.2          the air's weight at a height
*/
(function () {
    'use strict';
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k;
    const K = Object.freeze({
        ALT0: 3900, ALT_SHORT: 1100,                     // where the long fall and the short drop begin (px over the site)
        V0: -230, V0_SHORT: -170,                        // the speed they begin at
        HS: 2600, VT0: 300,                              // the air thins with height; terminal speed at the ground in plain air (px/s)
        NET: 29,                                         // all the engine has over the world's own pull (px/s²): under one g of braking. It barely wins (27 until the first play in the game: "we almost hit")
        FUEL_OVER: 3,                                  // the tanks hold what A.U.R.A.'s own landing burns on this world, and this many seconds over
        P0: 0.34, BUILD: 2.6,                            // at the catch it gives a third; it comes up to all it has over BUILD seconds
        THR_MIN: 0.3, ENGAGE: 0.8, FOLLOW: 5, PAD: 22,   // the least a lit engine gives; lit early it idles there until she needs this share of NET; how fast it follows; the height she aims to be slow by (10 at first: she was only slow as she touched, so every landing looked like a near miss)
        IGN: 0.16, RELIGHT: 0.6,                         // the first catch takes a beat; a cold restart staggers for longer
        SPOOL_DOWN: 0.14, COOL: 1.6, WARM: 1.5, HOT: 0.5,   // let go: the flame dies fast, the power it had built drains slower; for about a second it is still hot and catches at once
        CUE_AHEAD: 1.9, AURA_AHEAD: 0.3,                 // "Burn now" comes this long before the last good moment (1.5 at first: a hand that took a second to answer landed on the edge of soft); A.U.R.A. herself lights almost on it
        K_IN: 3.4, K_AERO: 2, K_INST: 1.7, K_DAMP: 1.7, K_SLIDE: 70,   // tilt: our hand, the air righting her, the burn tipping her
        SOFT: 42, ROUGH: 96,                             // touchdown speeds (px/s): under SOFT is soft, over ROUGH is a crash
        SINK: 20, SINK_OF: Object.freeze({ soft: 20, rough: 62, crash: 128 }),   // the slow sink she holds over the last metres; what A.U.R.A. sets down at for a carried grade
        LEGS_AT: 430, STEP: 1 / 120,
        D: 3.4, FOOT_X: 20, LEG_L: 8.2,                 // her true size in the rules: px per shuttle unit; her feet's half span; the bell over the feet
        ON_MARK: 70, NEAR: 210,                          // px from the level stretch and the light beside it: on it, a short walk, a long walk
        EDGE_X: 560,                                     // how far to either side she can go (the painted land runs to 760)
        Z: 0.6, SMAX: 270,                               // the camera: art px per px of the world, one distance top to bottom; the land is never drawn further below her than SMAX art px
        QUIET: 2,                                        // seconds after the touchdown with nothing said
    });
    // one smooth curve from the top of the fall to the ground (sketch 5): no stretch where the land rushes in
    const gapf = d => (d <= 0 ? d * K.Z : K.SMAX * (1 - Math.exp(-d * K.Z / K.SMAX)));
    // a smooth seeded noise for the gusts (no picture kit here)
    const hash1 = (i, s) => { let h = Math.imul(i ^ (s * 374761393), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const noise1 = (t, s) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(hash1(i, s), hash1(i + 1, s), u); };
    const HANDS_OFF = Object.freeze({ burn: false, lean: 0 }), FLAT = () => 0, probes = new Map();

    const airAt = (W, y) => W.rhoK * Math.exp(-Math.max(0, y) / K.HS);
    const dragAt = (W, y, v) => { const vt = K.VT0 / Math.sqrt(airAt(W, y)); return W.g * (v / vt) * (v / vt); };   // v: her speed down
    function newFlight(W, mode) {
        const short = mode === 'short';
        return { W, mode: short ? 'short' : 'full', x: short ? W.start * 0.45 : W.start, y: short ? K.ALT_SHORT : K.ALT0, vx: 0, vy: short ? K.V0_SHORT : K.V0, th: 0, om: 0,
            fuel: W.fuel, t: 0, burning: false, thr: 0, pow: 0, heat: 0, lit: false, on: false, everLit: false, ign: 0, kick: 0, need: 0, sink: K.SINK, fold: 0, thump: 0, q: 0,
            landed: null, ab: false, abN: 0, maxTh: 0, burnT: 0, fullT: 0, markTo: 0 };   // markTo: where the find's light stands beside the level stretch (the minigame sets it)
    }

    // ── the engine and the braking it is asked for ──
    /** The braking she needs from now to be down at her slow sink by the ground (px/s²). */
    function brakeOf(E, h) {
        const v = -E.vy;
        return v <= E.sink ? 0 : (v * v - E.sink * E.sink) / (2 * Math.max(6, h - K.PAD));
    }
    /** The share of the engine she needs right now. It can ask for more than there is. */
    function needOf(E, h) {
        const W = E.W, v = -E.vy, c = Math.max(0.5, Math.cos(E.th));
        return (W.g - (v > 0 ? dragAt(W, E.y, v) : 0) + (v > E.sink ? brakeOf(E, h) : 4 * (v - E.sink))) / (W.at * c);
    }
    /** What a lit engine is asked for: the least, until she needs it; then what she needs. */
    function wantOf(E, h) {
        const need = needOf(E, h);
        if (!E.on && (brakeOf(E, h) >= K.NET * K.ENGAGE || -E.vy <= E.sink * 2)) E.on = true;
        return E.on ? need : Math.min(need, K.THR_MIN);
    }
    /** The engine, one step. E: anything with the engine's fields. Held, it takes a beat to catch (a cold restart staggers),
        then it gives what is asked, up to what it has built; its fuel burns with its push. → true on the step it catches */
    function engine(E, held, want, dt) {
        let caught = false;
        if (held && E.fuel > 0) {
            if (!E.lit) {
                if (E.heat > K.HOT) E.lit = true;
                else { E.ign += dt; if (E.ign >= (E.everLit ? K.RELIGHT : K.IGN)) { E.lit = true; E.everLit = true; caught = true; E.pow = Math.max(E.pow, K.P0); E.thr = Math.max(E.thr, 0.3); } }
            }
            if (E.lit) { E.heat = 1; E.pow = Math.min(1, E.pow + dt * (1 - K.P0) / K.BUILD); E.thr += (clamp(want, K.THR_MIN, E.pow) - E.thr) * Math.min(1, dt * K.FOLLOW); E.fuel = Math.max(0, E.fuel - dt * E.thr); }
        } else { E.lit = false; E.on = false; E.ign = 0; E.thr = E.thr < 0.02 ? 0 : E.thr * Math.exp(-dt / K.SPOOL_DOWN); E.pow *= Math.exp(-dt / K.COOL); E.heat *= Math.exp(-dt / K.WARM); }
        return caught;
    }
    /** Looking ahead: if the burn were held from `wait` seconds on, how fast does she meet the ground, and do the tanks
        last? Straight down, nose up, the same engine. tanks === false asks only whether the engine is enough. */
    function arrive(S, at, wait, tanks) {
        const W = S.W, g0 = at(S.x), dt = 1 / 20;
        const E = { W, lit: S.lit, on: S.on, everLit: S.everLit, ign: S.ign, heat: S.heat, pow: S.pow, thr: S.thr, fuel: tanks === false ? 99 : S.fuel, sink: S.sink, y: S.y, vy: S.vy, th: 0 };
        for (let i = 0; i < 640; i++) {
            const h = E.y - g0, v = -E.vy;
            if (h <= 0) return { v, dry: E.fuel <= 0 };
            engine(E, i * dt >= wait, wantOf(E, h), dt);
            E.vy += (-W.g + W.at * E.thr + (v > 0 ? dragAt(W, E.y, v) : 0)) * dt; E.y += E.vy * dt;
        }
        return { v: 0, dry: E.fuel <= 0 };
    }
    const cueNow = (S, at) => arrive(S, at, K.CUE_AHEAD, false).v > S.sink + 4;    // "Burn now": a hand still has time
    const lateNow = (S, at) => arrive(S, at, 0, false).v > K.SOFT;                 // past this, all she has is not enough for a soft one
    /** A.U.R.A.'s hands: the burn as late as is safe and held to the ground, the nose kept up, the level stretch kept under us. */
    function auraInput(S, at, sink) {
        S.sink = sink || K.SINK;
        if (!S.ab) { if (S.lit) S.ab = true; else if (S.abN++ % 4 === 0) S.ab = arrive(S, at, K.AURA_AHEAD, false).v > S.sink + 4; }   // she looks ahead 30 times a second
        return { burn: S.ab, lean: leanOf(S, at) };
    }
    function leanOf(S, at) {
        const h = S.y - at(S.x);
        const want = h < 70 ? clamp(-1.9 * S.vx / S.W.at, -0.1, 0.1) : clamp((-0.9 * S.x - 1.9 * S.vx) / S.W.at, -0.22, 0.22);   // over the last metres she only stands her up straight
        return clamp(6 * (want - S.th) - 2.2 * S.om, -1, 1);
    }

    function step(S, at, inp, dt) {
        const W = S.W;
        S.t += dt; S.thump *= Math.exp(-6 * dt);
        if (S.landed) { const L = S.landed, k = Math.min(1, dt * 7); S.th += (L.restTh - S.th) * k; S.y += (L.restY - S.y) * k; return; }   // she comes to rest on the ground she found
        const rho = airAt(W, S.y), sp = Math.hypot(S.vx, S.vy), vt = K.VT0 / Math.sqrt(rho), q = clamp(rho * sp * sp / (K.VT0 * K.VT0), 0, 1.4);
        const h0 = S.y - at(S.x);
        S.need = needOf(S, h0);
        if (engine(S, !!inp.burn, wantOf(S, h0), dt)) S.kick = 1;
        if (S.lit) { S.burnT += dt; if (S.thr > 0.95) S.fullT += dt; }
        S.kick *= Math.exp(-8 * dt);
        const thr = S.thr;
        S.burning = S.lit; S.q = q;
        // her tilt: our hand, the air righting her while she falls, the burn tipping her, the gusts
        const gust = W.gust * ((noise1(S.t * 1.7, W.seed) - 0.5) * 2 + (noise1(S.t * 4.3, W.seed + 11) - 0.5));
        const al = K.K_IN * clamp(inp.lean || 0, -1, 1) * (0.55 + 0.85 * thr) - K.K_AERO * q * S.th * (1 - 0.75 * thr) + K.K_INST * thr * S.th + gust * (0.9 + 0.3 * thr) * Math.min(1, rho * 1.6 + 0.25) - K.K_DAMP * S.om;
        const over = Math.abs(S.th) - 0.5;                                        // falling free, her own jets hold her from lying over (the thin air high up would not)
        S.om += (al - (over > 0 ? 9 * over * Math.sign(S.th) * (1 - thr) : 0)) * dt; S.th += S.om * dt;
        if (Math.abs(S.th) > 1.25) { S.th = clamp(S.th, -1.25, 1.25); S.om = 0; }
        S.maxTh = Math.max(S.maxTh, Math.abs(S.th));
        const wind = W.wind + W.swing * Math.sin(S.t * 0.7);
        const ax = W.at * Math.sin(S.th) * thr + K.K_SLIDE * q * S.th * (1 - thr) + (wind - S.vx) * rho * 0.3;
        const ay = -W.g + W.at * Math.cos(S.th) * thr + (S.vy < 0 ? 1 : -1) * W.g * (S.vy / vt) * (S.vy / vt);
        const out = Math.abs(S.x) - K.EDGE_X;                                     // the land we painted ends: the air turns her back before it does
        S.vx += (ax - (out > 0 ? (0.9 * out + 1.2 * S.vx * Math.sign(S.x)) * Math.sign(S.x) : 0)) * dt; S.vy += ay * dt; S.x = clamp(S.x + S.vx * dt, -K.EDGE_X - 110, K.EDGE_X + 110); S.y += S.vy * dt;
        if (S.y - at(S.x) < K.LEGS_AT) S.fold = Math.min(1, S.fold + dt / 0.7);
        // the feet: left and right, each on its own ground
        const c = Math.cos(S.th), s = Math.sin(S.th), xL = S.x - K.FOOT_X * c, xR = S.x + K.FOOT_X * c, gL = at(xL), gR = at(xR);
        if (S.y + K.FOOT_X * s <= gL || S.y - K.FOOT_X * s <= gR) {
            const vImp = Math.max(0, -S.vy), slope = Math.abs(gL - gR), tilt = Math.abs(S.th);
            const grade = vImp >= K.ROUGH || tilt > 0.6 ? 'crash' : vImp >= K.SOFT || tilt > 0.3 || Math.abs(S.vx) > 50 || slope > 10 ? 'rough' : 'soft';
            const lo = Math.min(0, S.markTo || 0), hi = Math.max(0, S.markTo || 0), off = S.x < lo ? lo - S.x : S.x > hi ? S.x - hi : 0;   // from the level stretch to the light beside it
            const where = off <= K.ON_MARK ? 'spot' : off <= K.NEAR ? 'walk' : 'long';
            S.landed = { grade, where, vImp, tilt, vx: S.vx, slope, off, at: S.t, fuel: S.fuel, restTh: Math.atan((gL - gR) / (2 * K.FOOT_X)) + (grade === 'crash' ? (S.th >= 0 ? 0.5 : -0.5) : 0), restY: (gL + gR) / 2 };
            S.burning = false; S.lit = false; S.on = false; S.thr = 0; S.ign = 0; S.kick = 0; S.vx = 0; S.vy = 0; S.om = 0; S.fold = 1;
            S.thump = grade === 'crash' ? 1.6 : grade === 'rough' ? 1 : 0.5;
        }
    }

    /** A world as the flight reads it. gravity: the planet's (1 = ours); atm: LandingFlight.ATM's weight of air (0 none ..
        1.6); storm: a storm world; ground: LanderGame's ground kind; seed; risk: the find's (a risky find's level stretch is short).
        The engine has the same thin win on every world (at = g + NET), so two short probes are flown here: one with no
        hands, to learn how high the call comes (the cloud is set just above it, so the burn lights a dark world); one by
        A.U.R.A., to learn what her landing burns (the tanks hold that and a little over). */
    function rulesFor(o) {
        const storm = !!o.storm, atm = Math.max(storm ? 1 : 0, clamp(Number.isFinite(o.atm) ? o.atm : 0.4, 0, 1.6)), seed = (o.seed >>> 0) || 7;   // a storm always has air: its cloud and its rain go together
        const side = hash1(3, seed) < 0.5 ? -1 : 1, thick = storm || atm >= 1.2, thin = atm < 0.8 && !thick;
        const g = +(34 * Math.pow(clamp(Number.isFinite(o.gravity) ? o.gravity : 1, 0.55, 1.5), 0.55)).toFixed(2);
        const W = {
            seed, storm, atm, g, at: +(g + K.NET).toFixed(2), fuel: 99,
            rhoK: clamp(0.75 + 0.25 * atm, 0.75, 1.15),                        // the flight always has air enough to slow in (a thin world's fall is a little faster)
            wind: storm ? -16 * side : Math.round((hash1(5, seed) - 0.5) * 70 * Math.min(1, atm)),
            swing: storm ? 30 : Math.round(8 + 14 * atm),
            gust: storm ? 1.8 : +(0.45 + 0.4 * atm).toFixed(2),
            deck: null, thin,
            rough: { ice: 52, dunes: 30, lava: 46, green: 34, sea: 24, haze: 38, storm: 44 }[o.ground] || 40,
            pad: (o.risk || 0) >= 30 ? 48 : 64,
            rain: storm,
            start: side * Math.round(110 + 50 * hash1(9, seed)),
        };
        const key = [g, W.rhoK, storm ? 1 : 0, seed].join(':');
        let pr = probes.get(key);
        if (!pr && o.quick) pr = { cueH: 2830, fuel: 12.8 };                       // the bridge's warm-up: it needs only whether there is cloud, not where
        if (!pr) {
            let cueH = 2800, cueT = 3, prev = null;
            const A = newFlight(W, 'full'), keep = () => ({ x: A.x, y: A.y, vx: A.vx, vy: A.vy, th: A.th, om: A.om, t: A.t });
            for (let i = 0; i < 1400 && !A.landed; i++) {                         // no hands: every fifth of a second, is the call due?
                if (i % 24 === 0) { if (cueNow(A, FLAT)) break; prev = keep(); }
                step(A, FLAT, HANDS_OFF, K.STEP);
            }
            if (prev) { Object.assign(A, prev); for (let i = 0; i < 24; i++) { if (i % 3 === 0 && cueNow(A, FLAT)) break; step(A, FLAT, HANDS_OFF, K.STEP); } }   // and again from the fifth before, finely
            cueH = A.y; cueT = A.t;
            const B = newFlight(W, 'full');
            for (let i = 0; i < 4200 && !B.landed; i++) step(B, FLAT, B.t < cueT + 0.7 ? { burn: false, lean: leanOf(B, FLAT) } : auraInput(B, FLAT, 0), K.STEP);   // A.U.R.A.'s own landing (she lights about a second after the call)
            pr = { cueH: Math.round(cueH), fuel: +((99 - B.fuel) + K.FUEL_OVER).toFixed(1) };
            if (probes.size > 40) probes.clear();
            probes.set(key, pr);
        }
        const cueH = pr.cueH;
        W.fuel = pr.fuel;
        if (atm >= 0.2) { const bottom = Math.round(Math.min(cueH + 180, K.ALT0 - 620)); W.deck = Object.freeze([Math.min(K.ALT0 - 280, bottom + (thick ? 440 : thin ? 300 : 360)), bottom]); }   // the cloud we fall through (none without air): we leave it about half a second before the call
        W.cueH = cueH;
        return Object.freeze(W);
    }

    window.BurnFlight = Object.freeze({ K, rulesFor, newFlight, step, auraInput, arrive, cueNow, lateNow, gapf, airAt });
})();
