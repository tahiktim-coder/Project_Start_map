/* ═══ Silent Exodus · new screen (?new=1) · land/BurnFlight.js: THE BURN, the rules ═════════════════════════════════════
   The new look's landing as a rocket's soft landing (the designer, 2026-11-11: "should feel intense thats where most
   shacking is happening where we try to slow down and not vobble too much and keep it straight against the fall"; sketch 2
   approved the same day: "Yes, both"). Ported from the sketch prototypes/landing-burn/burn.js; the numbers are the sketch's.
   What happens in a landing, with no drawing and no page (a node vm loads it with a stub window): the air and the fall,
   the engine (held, a beat before it catches, a kick, the push coming up; let go and it dies away; still hot it catches
   at once), her tilt (our hand, the air righting her, the burn tipping her, the gusts), the touchdown on the two feet,
   A.U.R.A.'s hands, and how near the land is drawn (gapf). BurnScene.js draws it; BurnFall.js is the minigame.
   Units: art px of the 640 x 360 frame (1.5 m shown per px), seconds. y is the height of her feet over the site's level.

   window.BurnFlight (frozen)
     K                             the numbers
     rulesFor(o) → W               a world's air and ground as the flight reads them (o: { gravity, atm, storm, ground, seed, risk })
     newFlight(W, mode) → S        a fresh flight ('full': the long fall; 'short': a routine drop)
     step(S, at, inp, dt)          one step; at(x): the ground's height; inp: { burn, lean -1..1 }; sets S.landed at the touchdown
     auraInput(S, at, sink) → inp  A.U.R.A.'s hands (sink: the speed she sets down at; a routine drop's carried grade)
     stopDist(S) → px              how far she still falls if the engine burned from now
     cueNow(S, h), lateNow(S, h)   is it time to say "burn"; is it nearly too late
     gapf(d) → px                  how far below us something d px down is drawn (nearer than true, the more the higher)
     airAt(W, y) → 0..1.2          the air's weight at a height
*/
(function () {
    'use strict';
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), clamp01 = v => clamp(v, 0, 1), lerp = (a, b, k) => a + (b - a) * k;
    const K = Object.freeze({
        M_PER_PX: 1.5,                                   // metres shown per art px
        ALT0: 3900, ALT_SHORT: 1550,                     // where the long fall and the short drop begin (px over the site)
        V0: -230, V0_SHORT: -320,                        // the speed they begin at
        HS: 2600, VT0: 300,                              // the air thins with height; terminal speed at the ground in plain air (px/s)
        AT: 74, FUEL: 11,                                // the engine's push (px/s²) and the seconds of burn aboard
        IGN: 0.16, SPOOL_UP: 0.22, SPOOL_DOWN: 0.14, HOT: 0.25,   // a beat before it catches, then it comes up; let go and it dies away; still hot it catches at once
        K_IN: 3.4, K_AERO: 2, K_INST: 1.9, K_DAMP: 1.7, K_SLIDE: 70,   // tilt: our hand, the air righting her, the burn tipping her
        SOFT: 42, ROUGH: 96,                             // touchdown speeds (px/s): under SOFT is soft, over ROUGH is a crash
        SINK: 20, SINK_OF: Object.freeze({ soft: 20, rough: 62, crash: 128 }),   // the sink A.U.R.A. holds over the last metres; what she sets down at for a carried grade
        LEGS_AT: 430, STEP: 1 / 120,
        D: 3.4, FOOT_X: 20, LEG_L: 8.2,                 // art px per shuttle unit; her feet's half span; the bell over the feet
        ON_MARK: 70, NEAR: 210,                          // px from the level stretch and the light beside it: on it, a short walk, a long walk
        EDGE_X: 560,                                     // how far to either side she can go (the painted land runs to 760)
        HA: 90,                                          // the land is drawn nearer than it is, the higher we are (gapf)
        LAG: 0.24,                                       // seconds of fall the engine's catch costs (the cue and A.U.R.A. lead by it)
    });
    const gapf = d => (d <= 0 ? d : K.HA * Math.log(1 + d / K.HA));           // round 3 ("ground appears too fast"): no true-scale stretch at the end, so the land comes up at a steady pace, never a rush
    // a smooth seeded noise for the gusts (no picture kit here)
    const hash1 = (i, s) => { let h = Math.imul(i ^ (s * 374761393), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const noise1 = (t, s) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(hash1(i, s), hash1(i + 1, s), u); };

    /** A world as the flight reads it. gravity: the planet's (1 = ours); atm: LandingFlight.ATM's weight of air (0 none ..
        1.6); storm: a storm world; ground: LanderGame's ground kind; seed; risk: the find's (a risky find's level stretch is short). */
    function rulesFor(o) {
        const storm = !!o.storm, atm = Math.max(storm ? 1 : 0, clamp(Number.isFinite(o.atm) ? o.atm : 0.4, 0, 1.6)), seed = (o.seed >>> 0) || 7;   // a storm always has air: its cloud and its rain go together
        const side = hash1(3, seed) < 0.5 ? -1 : 1, thick = storm || atm >= 1.2;
        const g = +(34 * Math.pow(clamp(Number.isFinite(o.gravity) ? o.gravity : 1, 0.55, 1.5), 0.55)).toFixed(2);
        return Object.freeze({
            seed, storm, atm, g,
            fuel: +(K.FUEL * clamp(g / 34, 0.9, 1.35)).toFixed(1),              // a heavy world's burn is longer: the tanks are filled for it
            rhoK: clamp(0.75 + 0.25 * atm, 0.75, 1.15),                        // the flight always has air enough to stop in (a thin world's fall is a little faster)
            wind: storm ? -16 * side : Math.round((hash1(5, seed) - 0.5) * 70 * Math.min(1, atm)),
            swing: storm ? 30 : Math.round(8 + 14 * atm),
            gust: storm ? 1.8 : +(0.45 + 0.4 * atm).toFixed(2),
            deck: atm < 0.2 ? null : thick ? [3100, 2300] : atm < 0.8 ? [2950, 2650] : [3000, 2500],   // the cloud we fall through (none without air)
            thin: atm < 0.8 && !thick,
            rough: { ice: 52, dunes: 30, lava: 46, green: 34, sea: 24, haze: 38, storm: 44 }[o.ground] || 40,
            pad: (o.risk || 0) >= 30 ? 48 : 64,
            rain: storm,
            start: side * Math.round(110 + 50 * hash1(9, seed)),
        });
    }
    const airAt = (W, y) => W.rhoK * Math.exp(-Math.max(0, y) / K.HS);
    function newFlight(W, mode) {
        const short = mode === 'short';
        return { W, mode: short ? 'short' : 'full', x: short ? W.start * 0.45 : W.start, y: short ? K.ALT_SHORT : K.ALT0, vx: 0, vy: short ? K.V0_SHORT : K.V0, th: 0, om: 0,
            fuel: W.fuel, t: 0, burning: false, thr: 0, lit: false, ign: 0, kick: 0, fold: 0, thump: 0, q: 0, landed: null, ab: false, rise: 0, maxTh: 0, burnT: 0, markTo: 0 };   // markTo: where the find's light stands beside the level stretch (the minigame sets it)
    }
    /** How far she still falls if the engine burned from now until the sink is slow (the air's drag and her tilt counted). */
    function stopDist(S) {
        const W = S.W, g = W.g, c = Math.max(0.7, Math.cos(S.th));               // tipped far over, she is stood up to burn: the engine can always stop her (never Infinity)
        let y = S.y, v = S.vy, d = 0;
        for (let i = 0; i < 600 && v < -K.SINK; i++) {
            const vt = K.VT0 / Math.sqrt(airAt(W, y)), a = -g + K.AT * c + g * (v / vt) * (v / vt);
            v += a / 30; y += v / 30; d -= v / 30;
        }
        return d;
    }
    const cueNow = (S, h) => h - 60 + S.vy * K.LAG <= stopDist(S) * 1.18;
    const lateNow = (S, h) => h - 12 + S.vy * K.LAG <= stopDist(S) * 1.02;
    /** A.U.R.A.'s hands: the burn as late as is safe, the nose kept up, the light kept under us. */
    function auraInput(S, at, sink) {
        const h = S.y - at(S.x), slow = sink || K.SINK;
        let burn;
        if (h < 46) burn = S.vy < -slow;
        else { const ds = stopDist(S), lag = S.lit ? 0 : -S.vy * K.LAG; S.ab = S.ab ? h - 12 <= ds * 1.14 : h - 12 - lag <= ds * 1.03; burn = S.ab && S.vy < -slow; }
        const want = h < 70 ? clamp(-1.9 * S.vx / K.AT, -0.1, 0.1) : clamp((-0.9 * S.x - 1.9 * S.vx) / K.AT, -0.28, 0.28);   // over the last metres she only stands her up straight
        return { burn, lean: clamp(6 * (want - S.th) - 2.2 * S.om, -1, 1) };
    }
    function step(S, at, inp, dt) {
        const W = S.W;
        S.t += dt; S.thump *= Math.exp(-6 * dt);
        if (S.landed) { const L = S.landed, k = Math.min(1, dt * 7); S.th += (L.restTh - S.th) * k; S.y += (L.restY - S.y) * k; return; }   // she comes to rest on the ground she found
        const rho = airAt(W, S.y), sp = Math.hypot(S.vx, S.vy), vt = K.VT0 / Math.sqrt(rho), q = clamp(rho * sp * sp / (K.VT0 * K.VT0), 0, 1.4);
        // the engine: held, it takes a beat to catch (a cold start kicks), then comes up; let go, it dies away
        if (inp.burn && S.fuel > 0) {
            if (!S.lit) { if (S.thr > K.HOT) S.lit = true; else { S.ign += dt; if (S.ign >= K.IGN) { S.lit = true; S.kick = 1; S.thr = Math.max(S.thr, 0.5); } } }
            if (S.lit) { S.thr = Math.min(1, S.thr + dt * 0.5 / K.SPOOL_UP); S.fuel = Math.max(0, S.fuel - dt); S.burnT += dt; }
        } else { S.lit = false; S.ign = 0; S.thr = S.thr < 0.02 ? 0 : S.thr * Math.exp(-dt / K.SPOOL_DOWN); }
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
        const ax = K.AT * Math.sin(S.th) * thr + K.K_SLIDE * q * S.th * (1 - thr) + (wind - S.vx) * rho * 0.3;
        const ay = -W.g + K.AT * Math.cos(S.th) * thr + (S.vy < 0 ? 1 : -1) * W.g * (S.vy / vt) * (S.vy / vt);
        const out = Math.abs(S.x) - K.EDGE_X;                                     // the land we painted ends: the air turns her back before it does
        S.vx += (ax - (out > 0 ? (0.9 * out + 1.2 * S.vx * Math.sign(S.x)) * Math.sign(S.x) : 0)) * dt; S.vy += ay * dt; S.x = clamp(S.x + S.vx * dt, -K.EDGE_X - 110, K.EDGE_X + 110); S.y += S.vy * dt;
        S.rise = S.lit && S.vy > 25 ? S.rise + dt : 0;
        if (S.y - at(S.x) < K.LEGS_AT) S.fold = Math.min(1, S.fold + dt / 0.7);
        // the feet: left and right, each on its own ground
        const c = Math.cos(S.th), s = Math.sin(S.th), xL = S.x - K.FOOT_X * c, xR = S.x + K.FOOT_X * c, gL = at(xL), gR = at(xR);
        if (S.y + K.FOOT_X * s <= gL || S.y - K.FOOT_X * s <= gR) {
            const vImp = Math.max(0, -S.vy), slope = Math.abs(gL - gR), tilt = Math.abs(S.th);
            const grade = vImp >= K.ROUGH || tilt > 0.6 ? 'crash' : vImp >= K.SOFT || tilt > 0.3 || Math.abs(S.vx) > 50 || slope > 10 ? 'rough' : 'soft';
            const lo = Math.min(0, S.markTo || 0), hi = Math.max(0, S.markTo || 0), off = S.x < lo ? lo - S.x : S.x > hi ? S.x - hi : 0;   // from the level stretch to the light beside it
            const where = off <= K.ON_MARK ? 'spot' : off <= K.NEAR ? 'walk' : 'long';
            S.landed = { grade, where, vImp, tilt, vx: S.vx, slope, off, at: S.t, fuel: S.fuel, restTh: Math.atan((gL - gR) / (2 * K.FOOT_X)) + (grade === 'crash' ? (S.th >= 0 ? 0.5 : -0.5) : 0), restY: (gL + gR) / 2 };
            S.burning = false; S.lit = false; S.thr = 0; S.ign = 0; S.kick = 0; S.vx = 0; S.vy = 0; S.om = 0; S.fold = 1;
            S.thump = grade === 'crash' ? 1.6 : grade === 'rough' ? 1 : 0.5;
        }
    }
    window.BurnFlight = Object.freeze({ K, rulesFor, newFlight, step, auraInput, stopDist, cueNow, lateNow, gapf, airAt });
})();
