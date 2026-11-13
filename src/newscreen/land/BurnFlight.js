/* ═══ Silent Exodus · new screen (?new=1) · land/BurnFlight.js: THE BURN, the rules ═════════════════════════════════════
   The new look's landing as a rocket's soft landing (the designer, 2026-11-11: "should feel intense thats where most
   shacking is happening where we try to slow down and not vobble too much and keep it straight against the fall"; then
   "i dont want us to feel we can slow down so fast it has to be struggle"). Ported from the sketch
   prototypes/landing-burn/burn.js, sketch 9 (approved 2026-11-13: "Yes, build it"); the numbers are the sketch's.
   What happens in a landing, with no drawing and no page (a node vm loads it with a stub window):
   the entry (a long fall begins high and too fast: held straight she brakes hard on the thin air, tipped she knifes
   through it, stays fast and her hull cooks; the heat is for the eye and one line, it never hurts her: the designer,
   2026-11-13, "heat cant hurt i think is fine"); the air and the fall; the engine, which barely wins (NET over the world's
   own pull): held, it takes a beat to catch, comes up over BUILD seconds and gives exactly the braking she needs, up to
   all it has, so the burn is HELD to the ground and never tapped; lit early it idles; let go for under about a second it
   catches at once, longer is a cold restart; the overdrive (ours to call: a cough, then more than all she has, for a
   little while); her tilt (our hand, the air righting her, the burn tipping her, the gusts); the touchdown on the two
   feet; A.U.R.A.'s hands; the look-ahead that times "Burn now" by flying the very same engine; and how far below her the
   land is drawn (gapf: TRUE TO SCALE, always).
   BurnScene.js draws it; BurnFall.js is the minigame.
   Units: px of the world, seconds. y is the height of her feet over the site's level. The picture shows the world at
   K.Z art px per px (one far camera, top to bottom: a push-in hid the ground coming), and K.M_PER_PX metres per px.

   window.BurnFlight (frozen)
     K                             the numbers
     rulesFor(o) → W               a world's air and ground as the flight reads it (o: { gravity, atm, storm, ground, seed, risk, quick });
                                   it flies two short probes to place the cloud above the call and to fill the tanks (o.quick: none, for the bridge's warm-up)
     newFlight(W, mode) → S        a fresh flight ('full': the long fall, from the entry; 'short': a routine drop)
     step(S, at, inp, dt)          one step; at(x): the ground's height; inp: { burn, lean -1..1, boost }; sets S.landed at the touchdown
     auraInput(S, at, sink) → inp  A.U.R.A.'s hands (sink: the speed she sets down at; a routine drop's carried grade). She never calls overdrive
     arrive(S, at, wait, tanks) → { v, dry }   looking ahead: the burn held from `wait` seconds on (no overdrive), how fast she meets the ground
     cueNow(S, at), lateNow(S, at) is it time to say "burn"; is all she has no longer enough for a soft one
     callAhead(S, at, every) → y | null   where "Burn now" will come if she falls on as she is (a copy flown ahead: no burn, steady hands)
     entryAt(y) → 0..1             how much of the entry she is in at a height (1 high above the cloud, 0 in the thick air)
     gapf(d) → art px              how far below her feet the ground is drawn when she is d px up
     airAt(W, y) → 0..1.2          the air's weight at a height
*/
(function () {
    'use strict';
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, k) => a + (b - a) * k;
    const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    const K = Object.freeze({
        ALT0: 3900, ALT_SHORT: 1100, V0_SHORT: -170,    // where the thick air begins (the fall proper); where a short drop begins and how fast
        ALT_ENTRY: 6300, V_ENTRY: -430,                  // the long fall begins higher and too fast: the entry
        HS: 2600, VT0: 300,                              // the air thins with height; terminal speed at the ground in plain air (px/s)
        V_EQ: 200, TAU_E: 2.5,                           // the entry's braking pulls her toward V_EQ over TAU_E seconds (her weight holds her near 275)
        CD_TIP: 0.5, TIP_AT: 0.6,                        // tipped TIP_AT rad over, she has only this share of that braking
        K_FLIP: 0.9, K_BUFFET: 0.9,                      // up there the air tips her instead of righting her, and shakes her
        NET: 29,                                         // all the engine has over the world's own pull (px/s²): under one g of braking. It barely wins (27 until the first play in the game: "we almost hit")
        FUEL_OVER: 3,                                    // the tanks hold what A.U.R.A.'s own landing burns on this world, and this many seconds over
        P0: 0.34, BUILD: 2.6,                            // at the catch it gives a third; it comes up to all it has over BUILD seconds
        THR_MIN: 0.3, ENGAGE: 0.8, FOLLOW: 5, PAD: 22,   // the least a lit engine gives; lit early it idles there until she needs this share of NET; how fast it follows; the height she aims to be slow by (10 at first: she was only slow as she touched, so every landing looked like a near miss)
        IGN: 0.16, RELIGHT: 0.6,                         // the first catch takes a beat; a cold restart staggers for longer
        SPOOL_DOWN: 0.14, COOL: 1.6, WARM: 1.5, HOT: 0.5,   // let go: the flame dies fast, the power it had built drains slower; for about a second it is still hot and catches at once
        CUE_AHEAD: 1.9, AURA_AHEAD: 0.3,                 // "Burn now" comes this long before the last good moment (1.5 at first: a hand that took a second to answer landed on the edge of soft); A.U.R.A. herself lights almost on it
        OD_MAX: 2.2, OD_GAIN: 0.45, OD_COUGH: 0.14, OD_FUEL: 1.6,   // overdrive: seconds of it aboard; how far over full; the cough before it bites; how much faster it drinks
        K_IN: 2.9, K_AERO: 2, K_INST: 1.7, K_DAMP: 1.35, K_SLIDE: 70,   // tilt: our hand, the air righting her, the burn tipping her. Heavy: slow to turn, and she keeps turning (3.4 and 1.7 until sketch 6: "like if cars in gta had no weight feeling")
        SOFT: 42, ROUGH: 96,                             // touchdown speeds (px/s): under SOFT is soft, over ROUGH is a crash
        SINK: 20, SINK_OF: Object.freeze({ soft: 20, rough: 62, crash: 128 }),   // the slow sink she holds over the last metres; what A.U.R.A. sets down at for a carried grade
        LEGS_AT: 430, STEP: 1 / 120,
        D: 3.4, FOOT_X: 20, LEG_L: 8.2,                 // her true size in the rules: px per shuttle unit; her feet's half span; the bell over the feet
        ON_MARK: 70, NEAR: 210,                          // px from the level stretch and the light beside it: on it, a short walk, a long walk
        EDGE_X: 560,                                     // how far to either side she can go (the painted land runs to 760)
        Z: 0.6, M_PER_PX: 1.5,                           // the camera: art px per px of the world, one distance top to bottom; metres shown per px of the world (the height gates)
        QUIET: 2,                                        // seconds after the touchdown with nothing said
    });
    // her height → art px between her feet and the ground: TRUE TO SCALE, ALWAYS. (Sketch 5 squeezed it while she was high, to
    // keep the ground in view: the ground then crept while the air rushed, and the designer saw the lie.)
    const gapf = d => d * K.Z;
    const entryAt = y => smooth(K.ALT0 - 200, K.ALT0 + 500, y);                    // 1 high above the cloud → 0 as the thick air takes over
    // a smooth seeded noise for the gusts (no picture kit here)
    const hash1 = (i, s) => { let h = Math.imul(i ^ (s * 374761393), 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    const noise1 = (t, s) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return lerp(hash1(i, s), hash1(i + 1, s), u); };
    const FLAT = () => 0, probes = new Map();

    const airAt = (W, y) => W.rhoK * Math.exp(-Math.max(0, y) / K.HS);
    const dragAt = (W, y, v) => { const vt = K.VT0 / Math.sqrt(airAt(W, y)); return W.g * (v / vt) * (v / vt); };   // v: her speed down
    function newFlight(W, mode) {
        const short = mode === 'short';
        return { W, mode: short ? 'short' : 'full', x: short ? W.start * 0.45 : W.start, y: short ? K.ALT_SHORT : K.ALT_ENTRY, vx: 0, vy: short ? K.V0_SHORT : K.V_ENTRY, th: 0, om: 0,
            fuel: W.fuel, t: 0, burning: false, thr: 0, pow: 0, heat: 0, lit: false, on: false, everLit: false, ign: 0, kick: 0, need: 0, sink: K.SINK, fold: 0, thump: 0, q: 0,
            od: K.OD_MAX, odT: 0, odOn: false, hot: 0, maxHot: 0, fast: 0, lean: 0,   // the overdrive's own short store; the hull's heat and how hard the entry is hitting her (for the eye); our hand, as the picture shows it
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
        then it gives what is asked, up to what it has built; its fuel burns with its push. boost: overdrive is called: a
        cough, then more than all it has while its own short store lasts (it lifts a cold engine to four fifths only).
        → true on the step it catches, and on the step the overdrive bites */
    function engine(E, held, need, dt, boost) {
        let bang = false;
        if (held && E.fuel > 0) {
            if (!E.lit) {
                if (E.heat > K.HOT) E.lit = true;
                else { E.ign += dt; if (E.ign >= (E.everLit ? K.RELIGHT : K.IGN)) { E.lit = true; E.everLit = true; bang = true; E.pow = Math.max(E.pow, K.P0); E.thr = Math.max(E.thr, 0.3); } }
            }
            if (E.lit) {
                E.heat = 1; E.pow = Math.min(1, E.pow + dt * (1 - K.P0) / K.BUILD);
                let want = clamp(need, K.THR_MIN, E.pow), rate = K.FOLLOW, drink = 1;
                if (boost && E.od > 0) {
                    E.odT += dt;
                    if (E.odT < K.OD_COUGH) { want = E.thr * 0.5; rate = 30; }                // the cough
                    else { if (!E.odOn) { E.odOn = true; bang = true; } rate = 9; drink = K.OD_FUEL; E.od = Math.max(0, E.od - dt); E.pow = Math.max(E.pow, 0.8); want = (1 + K.OD_GAIN) * E.pow; }
                } else { E.odT = 0; E.odOn = false; }
                E.thr += (want - E.thr) * Math.min(1, dt * rate);
                E.fuel = Math.max(0, E.fuel - dt * E.thr * drink);
            }
        } else { E.lit = false; E.on = false; E.ign = 0; E.odT = 0; E.odOn = false; E.thr = E.thr < 0.02 ? 0 : E.thr * Math.exp(-dt / K.SPOOL_DOWN); E.pow *= Math.exp(-dt / K.COOL); E.heat *= Math.exp(-dt / K.WARM); }
        return bang;
    }
    /** Looking ahead: if the burn were held from `wait` seconds on (no overdrive), how fast does she meet the ground, and do
        the tanks last? Straight down, nose up, the same engine, the thick air only (the entry's own braking is left out:
        it can only make her slower than this says). tanks === false asks only whether the engine is enough. */
    function arrive(S, at, wait, tanks) {
        const W = S.W, g0 = at(S.x), dt = 1 / 20;
        const E = { W, lit: S.lit, on: S.on, everLit: S.everLit, ign: S.ign, heat: S.heat, pow: S.pow, thr: Math.min(1, S.thr), fuel: tanks === false ? 99 : S.fuel, od: 0, odT: 0, odOn: false, sink: S.sink, y: S.y, vy: S.vy, th: 0 };
        for (let i = 0; i < 640; i++) {
            const h = E.y - g0, v = -E.vy;
            if (h <= 0) return { v, dry: E.fuel <= 0 };
            engine(E, i * dt >= wait, wantOf(E, h), dt, false);
            E.vy += (-W.g + W.at * E.thr + (v > 0 ? dragAt(W, E.y, v) : 0)) * dt; E.y += E.vy * dt;
        }
        return { v: 0, dry: E.fuel <= 0 };
    }
    const cueNow = (S, at) => arrive(S, at, K.CUE_AHEAD, false).v > S.sink + 4;    // "Burn now": a hand still has time
    const lateNow = (S, at) => arrive(S, at, 0, false).v > K.SOFT;                 // past this, all she has is not enough for a soft one (the overdrive is for this)
    /** A.U.R.A.'s hands: the burn as late as is safe and held to the ground, the nose kept up, the level stretch kept under us. */
    function auraInput(S, at, sink) {
        S.sink = sink || K.SINK;
        if (!S.ab) { if (S.lit) S.ab = true; else if (S.abN++ % 4 === 0) S.ab = arrive(S, at, K.AURA_AHEAD, false).v > S.sink + 4; }   // she looks ahead 30 times a second
        return { burn: S.ab, lean: leanOf(S, at), boost: false };
    }
    /** Steady hands: in the entry she is only held straight; lower down the level stretch is kept under us; over the last metres she is stood up straight. */
    function leanOf(S, at) {
        const h = S.y - at(S.x), inEntry = S.mode === 'full' && entryAt(S.y) > 0.15;
        const want = inEntry ? 0 : h < 70 ? clamp(-1.9 * S.vx / S.W.at, -0.1, 0.1) : clamp((-0.9 * S.x - 1.9 * S.vx) / S.W.at, -0.22, 0.22);
        return clamp(6 * (want - S.th) - 2.6 * S.om, -1, 1);
    }
    /** Where "Burn now" will come if she falls on as she is: a copy of the flight flown ahead with no burn and steady hands.
        every: how many sixtieths between looks (1 close to it, so the answer can be exact). → the height of her feet, or null */
    function callAhead(S, at, every) {
        const C = Object.assign({}, S), n = Math.max(1, every | 0);
        for (let i = 0; i < 1200 && !C.landed; i++) {
            if (i % n === 0 && C.y < K.ALT0 + 300 && cueNow(C, at)) return C.y;
            step(C, at, { burn: false, lean: leanOf(C, at) }, 1 / 60);
        }
        return null;
    }

    function step(S, at, inp, dt) {
        const W = S.W;
        S.t += dt; S.thump *= Math.exp(-6 * dt);
        if (S.landed) { const L = S.landed, k = Math.min(1, dt * 7); S.th += (L.restTh - S.th) * k; S.y += (L.restY - S.y) * k; return; }   // she comes to rest on the ground she found
        const rho = airAt(W, S.y), sp = Math.hypot(S.vx, S.vy), vt = K.VT0 / Math.sqrt(rho), q = clamp(rho * sp * sp / (K.VT0 * K.VT0), 0, 1.4);
        const h0 = S.y - at(S.x), lean = clamp(inp.lean || 0, -1, 1);
        S.need = needOf(S, h0);
        if (engine(S, !!inp.burn, wantOf(S, h0), dt, !!inp.boost)) S.kick = 1;
        if (S.lit) { S.burnT += dt; if (S.thr > 0.95) S.fullT += dt; }
        S.kick *= Math.exp(-8 * dt);
        const thr = S.thr, thr1 = Math.min(1, thr);                                // (in overdrive she gives more than all she has)
        S.burning = S.lit; S.q = q; S.lean = lean;
        // the entry: how hard the thin air is hitting her (her speed), and how much of its braking she takes (her tilt)
        const ent = S.mode === 'full' ? entryAt(S.y) : 0, vd = -S.vy, tip = Math.min(1, Math.abs(S.th) / K.TIP_AT), fast = ent * clamp((vd - 180) / 250, 0, 1);
        const aEntry = ent > 0 && vd > K.V_EQ ? ent * (1 - (1 - K.CD_TIP) * tip) * (vd - K.V_EQ) / K.TAU_E : 0;
        S.fast = fast;
        S.hot += (fast * fast * (1 + 2 * tip) - S.hot) * Math.min(1, dt * 2.5);     // the hull's heat: her speed, and far more when she is side-on to it. For the eye only
        S.maxHot = Math.max(S.maxHot, S.hot);
        // her tilt: our hand, the air righting her while she falls (in the entry it tips and shakes her instead), the burn tipping her, the gusts
        const gust = W.gust * ((noise1(S.t * 1.7, W.seed) - 0.5) * 2 + (noise1(S.t * 4.3, W.seed + 11) - 0.5));
        const buffet = (noise1(S.t * 2.3, W.seed + 23) - 0.5) * 2 + (noise1(S.t * 6.1, W.seed + 37) - 0.5);
        const al = K.K_IN * lean * (0.55 + 0.85 * thr1 + 0.45 * fast) - K.K_AERO * q * S.th * (1 - 0.75 * thr1) + K.K_INST * thr * S.th
            + fast * (K.K_FLIP * S.th + K.K_BUFFET * buffet) + gust * (0.9 + 0.3 * thr) * Math.min(1, rho * 1.6 + 0.25) - K.K_DAMP * S.om;
        const over = Math.abs(S.th) - 0.5;                                        // falling free, her own jets hold her from lying over (the thin air high up would not)
        S.om += (al - (over > 0 ? 9 * over * Math.sign(S.th) * (1 - thr1) : 0)) * dt; S.th += S.om * dt;
        if (Math.abs(S.th) > 1.25) { S.th = clamp(S.th, -1.25, 1.25); S.om = 0; }
        S.maxTh = Math.max(S.maxTh, Math.abs(S.th));
        const wind = W.wind + W.swing * Math.sin(S.t * 0.7);
        const ax = W.at * Math.sin(S.th) * thr + K.K_SLIDE * q * S.th * (1 - thr1) + (wind - S.vx) * rho * 0.3;
        const ay = -W.g + W.at * Math.cos(S.th) * thr + (S.vy < 0 ? 1 : -1) * W.g * (S.vy / vt) * (S.vy / vt) + aEntry;
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
            S.burning = false; S.lit = false; S.on = false; S.odOn = false; S.thr = 0; S.ign = 0; S.kick = 0; S.vx = 0; S.vy = 0; S.om = 0; S.fold = 1; S.lean = 0; S.hot = 0; S.fast = 0;
            S.thump = grade === 'crash' ? 1.6 : grade === 'rough' ? 1 : 0.5;
        }
    }

    /** A world as the flight reads it. gravity: the planet's (1 = ours); atm: LandingFlight.ATM's weight of air (0 none ..
        1.6); storm: a storm world; ground: LanderGame's ground kind; seed; risk: the find's (a risky find's level stretch is short).
        The engine has the same thin win on every world (at = g + NET), so two probes are flown here from the top of the
        entry: one with steady hands and no burn, to learn how high the call comes (the cloud is set just above it, so the
        burn lights a dark world); one by A.U.R.A., to learn what her landing burns (the tanks hold that and a little over). */
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
        if (!pr && o.quick) pr = { cueH: 3100, fuel: 13 };                        // the bridge's warm-up: it needs only whether there is cloud, not where
        if (!pr) {
            let cueH = 3000, cueT = 10, prev = null;
            const A = newFlight(W, 'full'), keep = () => ({ x: A.x, y: A.y, vx: A.vx, vy: A.vy, th: A.th, om: A.om, t: A.t, hot: A.hot });
            for (let i = 0; i < 4800 && !A.landed; i++) {                         // steady hands, no burn: every fifth of a second, is the call due?
                if (i % 24 === 0 && A.y < K.ALT0 + 300) { if (cueNow(A, FLAT)) break; prev = keep(); }
                step(A, FLAT, { burn: false, lean: leanOf(A, FLAT) }, K.STEP);
            }
            if (prev) { Object.assign(A, prev); for (let i = 0; i < 24; i++) { if (i % 3 === 0 && cueNow(A, FLAT)) break; step(A, FLAT, { burn: false, lean: leanOf(A, FLAT) }, K.STEP); } }   // and again from the fifth before, finely
            cueH = A.y; cueT = A.t;
            const B = newFlight(W, 'full');
            for (let i = 0; i < 7200 && !B.landed; i++) step(B, FLAT, B.t < cueT + 0.7 ? { burn: false, lean: leanOf(B, FLAT) } : auraInput(B, FLAT, 0), K.STEP);   // A.U.R.A.'s own landing (she lights about a second and a half after the call)
            pr = { cueH: Math.round(cueH), fuel: +((99 - B.fuel) + K.FUEL_OVER).toFixed(1) };
            if (probes.size > 40) probes.clear();
            probes.set(key, pr);
        }
        const cueH = pr.cueH;
        W.fuel = pr.fuel;
        // the cloud we fall through (none without air): we leave it about two thirds of a second before the call. A heavy world
        // with thin air is called higher, and an entry flown with no hands is called up to 180 px higher still: the cloud goes up with the call
        if (atm >= 0.2) { const bottom = Math.round(cueH + 240); W.deck = Object.freeze([bottom + (thick ? 440 : thin ? 300 : 360), bottom]); }
        W.cueH = cueH;
        return Object.freeze(W);
    }

    window.BurnFlight = Object.freeze({ K, rulesFor, newFlight, step, auraInput, arrive, cueNow, lateNow, callAhead, entryAt, gapf, airAt });
})();
