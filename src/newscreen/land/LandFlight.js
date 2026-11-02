/* ═══ Silent Exodus · new screen (?new=1) · land/LandFlight.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/landing-flight.js (sha1 4e60214a4d6c, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   The flight's numbers, unchanged (window name kept: LandingFlight).
*/
/* ═══ Silent Exodus · prototypes · landing-meteor/landing-flight.js: the numbers of the long way down ═════════════════
   THE METEOR: the fall (FALL, fall, fallStep, auraFall, fallRoll, fallDrift) at the end of this file replaces the entry;
   the landing's numbers are unchanged. Round 3 (2026-10-31): steering weak while diving, strong while holding; a hold
   stretches the reach; predEnd / predDrift (dive, then hold from PULL_A) place what you see. (The old header:)
   What it is: the landing dummy's physics, no drawing. The entry (the brief's numbers, all in ENTRY below), A.U.R.A.'s hand
   on it (she tries a few plans ahead each tenth of a second and keeps the one that ends best), and the landing: today's
   LanderGame step and grades, unchanged, plus only the start state, the gusts and the four ground rules (ice slides, dunes
   brown out, lava pushes up, lightning). Above y 2 (the sky screen) it integrates the same forces itself, because
   LanderGame's step holds y at 2.
   window.LandingFlight (frozen)
     ENTRY, ATM, LAND                         the numbers to tune
     entry(world, o) → e                      a fresh entry state (o: { tank, offset, minS, arriveD, dK })
     entryStep(e, world, keys, dt)            one step; keys: { up, left, right, pitch? }; sets e.skipped on a skip
     auraEntry(e, world) → keys               A.U.R.A.'s hand
     coast(e, world) → e'                     where hands-off ends (the double-speed test, A.U.R.A.'s plans)
     inBand(e) → bool
     land(G, e, o) → s                        the landing's start state (LanderGame's own state object)
     landStep(s, G, env, dt) → grade | null   one step (env: { gravity, wind }); LanderGame.internals.step below y 2
*/
(function () {
    'use strict';
    const LG = window.LanderGame, I = LG && LG.internals;
    if (!I) { console.error('Landing: LanderGame must load first'); return; }

    // ── the entry (brief §3) ──
    const ENTRY = Object.freeze({
        V0: 100, V0_AIRLESS: 70, BRAKE: 9, DRAG: 0.4, SINK: 0.025, UP_BOTH: 0.05, UP_ONE: 0.025,
        HEAT_DECAY: 0.25, HEAT_GOOD: [35, 80], HEAT_SHAKE: 80, HEAT_SCORCH: 100, CORRODE: 6,
        SKIP_V: 75, SKIP_FUEL: 10, SKIP_S: 4, D_PER_V: 6.4, D_SPREAD: 80, MAX_S: 14, MIN_S: 8, ARRIVE_D: 24, MIN_S_FAST: 5, ARRIVE_D_FAST: 60, UP_ONE_THIN: 0.042,
        BAND_V: 25, BAND_D: 60, CATCH_V: 40, CATCH_FUEL: 20, FUEL_PER_THRUSTER: 6.5, PITCH_LAG: 0.6,
    });
    const ATM = Object.freeze({ NONE: 0, THIN: 0.4, BREATHABLE: 1, CORROSIVE: 1.2, TOXIC: 1.6, HIGH_PRESSURE: 1.6 });
    // ── the landing (brief §3): today's physics (LanderGame.js 28-38) plus these ──
    const LAND = Object.freeze({
        START_Y: -160, START_Y_LOW: -80, FALL0: 10, FALL_PER_V: 0.4, DRIFT_PER_V: 0.5, D_TO_X: 0.3, MAX_OFF: 140,
        THRUST_UP_ONE: 17, THRUST_SIDE: 16, THRUST_UP_BOTH: 34, FUEL_PER_THRUSTER: 6.5, TOP: -176,
        GUST_EVERY: [3, 6], GUST_S: 1.2, GUST_WARN: 0.8, GUST_X: 2, GUST_X_LATE: 2.5,
        ICE_SLIDE_S: 0.5, ICE_SOFT_SIDE: 6, BROWN_PX: 16, LAVA_UP: 6, BOLT_EVERY: [4, 7], BOLT_MS: 150,
        SPOT_PX: 30, WALK_PX: 90, HOP_FUEL: 30, HOP_S: 3, AURA_FUEL: 15, RESERVE: 12,
    });

    function entry(world, o) {
        o = o || {};
        const atm = ATM[world.atmosphere] || 0, v0 = atm > 0 ? ENTRY.V0 : ENTRY.V0_AIRLESS;
        const off = o.offset != null ? o.offset : (Math.random() * 2 - 1) * ENTRY.D_SPREAD;
        const D0 = ENTRY.D_PER_V * v0 * (o.dK || 1) + off;                    // dK: a world that asks for a long glide puts the light farther off
        return { atm, v: v0, v0, z: 0, w: 0, H: 0, D: D0, D0, t: 0, inAir: 0, fuel: o.tank || 120, minS: o.minS || ENTRY.MIN_S, arriveD: o.arriveD || ENTRY.ARRIVE_D,
            used: 0, skips: 0, fast: 0, peakH: 0, over: 0, scorch: 0, flown: 0, pitch: 0, pitchWant: 0, ended: false };
    }
    const G0 = world => Math.sqrt(Math.max(0.3, world.gravity || 1));

    function entryStep(e, world, keys, dt) {
        keys = keys || {};
        const hasFuel = e.fuel > 0, both = hasFuel && (keys.up || (keys.left && keys.right)), one = hasFuel && !both && (keys.left || keys.right);
        const n = both ? 2 : one ? 1 : 0;
        e.fuel = Math.max(0, e.fuel - ENTRY.FUEL_PER_THRUSTER * n * dt); e.used += ENTRY.FUEL_PER_THRUSTER * n * dt;
        const upOne = e.atm > 0 && e.atm < 0.6 ? ENTRY.UP_ONE_THIN : ENTRY.UP_ONE;   // thin air: a braking burn lifts you, and near the top that can skip you out
        let a = ENTRY.SINK * G0(world) - (both ? ENTRY.UP_BOTH : one ? upOne : 0);
        if (keys.pitch != null) {                                           // V: the nose-pitch model to compare (Up/Down, 0.6 s lag)
            e.pitchWant = keys.pitch;
            e.pitch += (e.pitchWant - e.pitch) * Math.min(1, dt / ENTRY.PITCH_LAG);
            a -= 0.05 * e.pitch;
        }
        e.w += a * dt; e.z += e.w * dt;
        const rho = e.atm * Math.exp(3 * (e.z - 1));
        let dv = -ENTRY.DRAG * rho * e.v;
        if (one && keys.left) dv -= ENTRY.BRAKE;
        if (one && keys.right) dv += ENTRY.BRAKE;
        e.v = Math.max(0, e.v + dv * dt);
        e.H += (rho * e.v * e.v / 100 - ENTRY.HEAT_DECAY * e.H) * dt * (e.heatK || 1);
        if (e.atm > 0) e.inAir += dt;
        if (world.atmosphere === 'CORROSIVE') e.H = Math.max(e.H, ENTRY.CORRODE * e.inAir);
        e.peakH = Math.max(e.peakH, e.H);
        if (e.H > ENTRY.HEAT_SCORCH) { e.over += dt; if (e.over >= e.scorch + 1) e.scorch++; }
        const k = e.fast > 0 ? 2 : 1;
        e.D -= e.v * dt * k; e.flown += e.v * dt * k;
        if (e.fast > 0) e.fast -= dt;
        e.skipped = false;
        if (e.z < 0) {
            if (e.v > ENTRY.SKIP_V && e.atm > 0) { e.skips++; e.fuel = Math.max(0, e.fuel - ENTRY.SKIP_FUEL); e.fast = ENTRY.SKIP_S; e.skipped = true; e.w = 0.04; }
            else e.w = Math.max(0, e.w);
            e.z = 0;
        }
        e.t += dt;
        e.rho = rho;
        return e;
    }
    // it ends at the cloud top, at the cap, or on arrival: over the light (within e.arriveD) and slow enough, after e.minS.
    // (Tuning beyond the brief, for the designer to approve: the arrival rule; from landing 3 it ends as soon as the entry is
    // in the band, after 5 s, because the trip happens about 25 times a run.)
    const isOver = e => e.z >= 1 || e.t >= ENTRY.MAX_S || (e.t >= (e.minS || ENTRY.MIN_S) && Math.abs(e.D) <= (e.arriveD || ENTRY.ARRIVE_D) && e.v <= ENTRY.BAND_V);
    const inBand = e => e.v <= ENTRY.BAND_V && Math.abs(e.D) <= ENTRY.BAND_D;

    // ── A.U.R.A. on the entry: plans "wait c s, then push b s (brake, push on, or climb)", the best ending kept ──
    const PDT = 0.1;
    function rollout(e0, world, c, b, how) {
        const e = Object.assign({}, e0);
        let tt = 0;
        while (!isOver(e)) { const on = tt >= c && tt < c + b; entryStep(e, world, on ? how : null, PDT); tt += PDT; }
        return e;
    }
    const BRAKE = { left: true }, PUSH = { right: true }, CLIMB = { up: true };
    function cost(e) {
        return Math.max(0, e.v - 21) * 6 + Math.max(0, Math.abs(e.D) - 35) + Math.max(0, e.peakH - 80) * 3 + e.over * 40 + e.used * 0.15 + e.skips * 200;
    }
    function auraEntry(e, world) {
        let best = { k: cost(rollout(e, world, 0, 0, BRAKE)), how: null, c: 0 };
        const tryPlan = (c, b, how) => { const k = cost(rollout(e, world, c, b, how)); if (k < best.k) best = { k, how, c }; };
        for (let c = 0; c <= 8; c += 0.5) for (let b = 0.5; b <= 9; b += 0.5) tryPlan(c, b, BRAKE);
        for (let c = 0; c <= 8; c += 1) for (let b = 0.5; b <= 3; b += 0.5) tryPlan(c, b, PUSH);
        if (!(e.v > 70 && e.z < 0.2)) for (let c = 0; c <= 6; c += 1) for (let b = 0.5; b <= 4; b += 0.5) tryPlan(c, b, CLIMB);
        const keys = best.c === 0 && best.how ? Object.assign({}, best.how) : {};
        if (e.H > 85 && e.z > 0.1) keys.up = true;
        return keys;
    }
    const coast = (e, world) => rollout(e, world, 0, 0, null);

    // ── the landing ──
    /** The start: high under the cloud base, falling and drifting by how fast the entry ended, short of or past the find. */
    function land(G, e, o) {
        o = o || {};
        const g = G.g, s = I.startState(g), m = g.mark || { cx: 160 }, v = e ? e.v : 20, D = e ? e.D : 0;
        const off = Math.max(-LAND.MAX_OFF, Math.min(LAND.MAX_OFF, LAND.D_TO_X * D));
        s.x = Math.max(12, Math.min(308, m.cx - off));
        s.y = o.low ? LAND.START_Y_LOW : LAND.START_Y;
        s.vy = LAND.FALL0 + LAND.FALL_PER_V * v;
        s.vx = LAND.DRIFT_PER_V * v;
        s.fuel = e ? e.fuel : 120;
        s.isReleased = true;
        s.altitude = 200;
        return s;
    }
    /** Above y 2 LanderGame's step holds the shuttle at 2: the same forces, integrated here. */
    function stepHigh(s, g, gravity, dt) {
        const isLeft = s.keys.left && s.fuel > 0, isRight = s.keys.right && s.fuel > 0;
        let ax = g.wind, ay = gravity;
        if (isLeft && isRight) ay -= LAND.THRUST_UP_BOTH;
        else if (isLeft) { ax -= LAND.THRUST_SIDE; ay -= LAND.THRUST_UP_ONE; }
        else if (isRight) { ax += LAND.THRUST_SIDE; ay -= LAND.THRUST_UP_ONE; }
        s.fuel = Math.max(0, s.fuel - LAND.FUEL_PER_THRUSTER * ((isLeft ? 1 : 0) + (isRight ? 1 : 0)) * dt);
        s.vx += ax * dt; s.vy += ay * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x < I.LANDER_HALF + 1) { s.x = I.LANDER_HALF + 1; s.vx = 0; }
        if (s.x > 320 - I.LANDER_HALF - 2) { s.x = 320 - I.LANDER_HALF - 2; s.vx = 0; }
        if (s.y < LAND.TOP) { s.y = LAND.TOP; s.vy = Math.max(0, s.vy); }
        let ground = 280;
        for (let x = Math.round(s.x - I.LANDER_HALF); x <= Math.round(s.x + I.LANDER_HALF); x++) ground = Math.min(ground, g.heights[Math.max(0, Math.min(319, x))]);
        s.altitude = ground - (s.y + LG.LANDER_TALL);
        return null;
    }
    /** One step of the landing: the lava's updraft, then today's step (or the sky screen's). */
    function landStep(s, G, env, dt) {
        const g = G.g;
        if (G.kindName === 'lava') {                                           // the lava's heat pushes up over a pool
            const c = Math.max(0, Math.min(319, Math.round(s.x)));
            let hot = 0;
            for (let d = -6; d <= 6; d++) if (g.hot[Math.max(0, Math.min(319, c + d))]) hot++;
            if (hot) { s.vy -= LAND.LAVA_UP * Math.min(1, hot / 6) * dt; s.updraft = true; } else s.updraft = false;
        }
        if (s.y < 2 && !(s.vy > 0 && s.y + s.vy * dt >= 2)) return stepHigh(s, g, env.gravity, dt);
        return I.step(s, g, env.gravity, dt);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // THE METEOR (landing-meteor): one fall from the edge of the air to the hand-off just under the cloud deck.
    // Heights: a, world px above the deck's top (the deck runs from a 0 down to a -deck; its floor is the field's cloud
    // base, and the hand-off is UNDER px below it, where LanderGame's own step takes over in the same coordinates).
    // Let go: the shuttle dives (gravity, little drag: speed builds). Hold: it pulls up (the thrusters and the air brake it,
    // down to the floor speed of this air, never slower). Left/right push it sideways. Heat comes from speed in thick air,
    // so the skill is diving high and pulling up late. All tuned with scratchpad/meteor/sim.js (DRAFT numbers).
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const FALL = Object.freeze({
        TOP: 2200, TOP_ROUTINE: 440, DECK: 84, DECK_ROUTINE: 44, UNDER: 14, SCALE_H: 900,
        V0: 220, V0_ROUTINE: 200, VX0: 200,
        G: 80, CD: 0.00069, THRUST: 220, AIRBRAKE: 300, FLOOR: 46, FLOOR_UNDER: 26, FLOOR_THIN: 480, PITCH_S: 0.15,
        SIDE: 64, X_DRAG: 0.5, FUEL_HOLD: 5.5, FUEL_SIDE: 2.5, GUIDE: 120, GUIDE_EDGE: [20, 300], GUIDE_PUSH: 1.5,
        HEAT_K: 6.5, HEAT_COOL: 0.55, HEAT_SHAKE: 72, HEAT_SCORCH: 100, HEAT_BURN: 125,
        CATCH_VY: 40, CATCH_TO: 28, CATCH_FUEL: 3, CATCH_PER: 0.14, CATCH_FUEL_MAX: 36, SAFE_VY: 34, AURA_HOT: 86,
        // round 3 (DRAFT): steering is weak while you dive and strong while you hold (a flare-and-slide is the decisive
        // move, and it costs fuel); a hold stretches the reach (less sideways drag); the predictor that places what you
        // see dives and then holds from PULL_A (PULL_A_ROUTINE on a routine drop), about as A.U.R.A. flies it
        SIDE_DIVE: 0.5, SIDE_HELD: 1.5, X_DRAG_HELD: 0.7, PULL_A: 240, PULL_A_ROUTINE: 70, PULL_A_NONE: 720, PULL_A_NONE_ROUTINE: 210,   // (tuned: predEnd within 15 px of her end; airless she pulls up much higher)
        EDGE_A: 1000,                                                                // (the fix round, DRAFT: from this height on the field's edges are also judged by where a hands-off fall would end; above it the plans differ too much to tell)
        FAIR_IN: 4, FAIR_LOOK: 0.6, FAIR_PUSH: 1.0,                                  // (the fix round, DRAFT: on the first landings a blind miss is eased inside the nearest level stretch, its sideways speed taken off)
        X_DRAG_NONE: 0.7,                                                            // (the polish round, DRAFT: no air: the shuttle's own jets trim the sideways drift, so where you come down hardly depends on when you pull up; a hold still stretches your reach a little)
        DECK_DRAG: 1.4, DECK_SIDE: 0.4, STEER_HI: 0.5, STEER_A: [500, 1300],   // (the final fix round, DRAFT: STEER_HI, the steering high up in air (over STEER_A[1]), easing to whole by STEER_A[0]: a tap up there moves where you come down less; with no air the jets' own trim already keeps a tap short)                                              // (the final fix round, DRAFT: from the deck's top down the sideways drift is damped and the steering weaker: the last stretch is fine work, and a tap there never throws you off the pad)
    });
    const rhoAt = a => Math.exp(-Math.max(0, a) / FALL.SCALE_H);
    /** The sideways drag now (per s): the air's (less while held: a hold stretches your reach), or no air's own trim. */
    const xDrag = (e, rho) => (1 - (1 - FALL.X_DRAG_HELD) * e.pull) * (e.atm > 0 || e.atm == null ? FALL.X_DRAG * (0.25 + rho) : FALL.X_DRAG_NONE);
    // the floor speed a hold settles to: fast in the thin air high up (it cannot hold you: a hold there is as quick as a
    // dive, never quicker), FLOOR by the deck, FLOOR_UNDER under it (the last stretch before the touchdown)
    const floorAt = (rho, under) => (under ? FALL.FLOOR_UNDER : FALL.FLOOR + (FALL.FLOOR_THIN - FALL.FLOOR) * (1 - rho));
    /** A fresh fall. o: { routine, tank, x (the start x), vx, atm (the air: 0 none .. 1.6 thick), deck (false: no deck),
        under (the hand-off, world px under the deck's floor), mark (the find's light x: the fall never carries you more than
        GUIDE px off it, or off the field) }. */
    function fall(o) {
        o = o || {};
        const routine = !!o.routine;
        const atm = o.atm == null ? 1 : o.atm > 0 ? 0.55 + 0.45 * Math.min(1.5, o.atm) : 0;   // thin air: a little less of everything, never a different game
        const gb = o.mark != null ? guideBias(o, false) : null, gbH = o.mark != null ? guideBias(o, true) : null;
        return { gb, gbH, a: routine ? FALL.TOP_ROUTINE : FALL.TOP, a0: routine ? FALL.TOP_ROUTINE : FALL.TOP, deck: atm <= 0 || o.deck === false ? 0 : routine ? FALL.DECK_ROUTINE : FALL.DECK, routine, atm,
            under: o.under != null ? o.under : FALL.UNDER, mark: o.mark != null ? o.mark : null, level: o.level || null, fairAlways: !!o.fairAlways,
            x: o.x || 0, vx: o.vx != null ? o.vx : FALL.VX0, vy: routine ? FALL.V0_ROUTINE : FALL.V0, fuel: o.tank || 120, H: 0, t: 0, pull: 0, up: false, steer: 0,
            used: 0, peakH: 0, over: 0, scorch: 0, burnt: false, peakV: 0, rho: rhoAt(routine ? FALL.TOP_ROUTINE : FALL.TOP) };
    }
    const fallOver = e => e.a <= -(e.deck + e.under);
    /** Round 3: the guide's predictor (driftEnd) runs short high up (about 165 px at the top of a full drop, 0 by the end),
        so the guide used to push every start toward the light and erase the start's error and your early steering. It is
        now corrected by how short driftEnd runs along the plain fall (dive, then hold from PULL_A), tabled by the height
        (20 px steps, worked out once per kind of fall): the guide acts only when the fall would really end more than GUIDE
        px off the light. (Its rule and numbers are unchanged.) */
    const biasAt = (e, tab) => (tab ? tab[Math.max(0, Math.min(tab.length - 1, Math.round((e.a + e.deck + e.under) / 20)))] : 0);
    const guideEnd = e => driftEnd(e) - biasAt(e, e.gb);
    /** The fix round: where a hands-off fall would end (driftEnd corrected along a fall with no input at all). It runs
        shorter than the careful one, so the field's edges are judged by both. */
    const handsEnd = e => driftEnd(e) - biasAt(e, e.gbH);
    const biases = new Map();
    function guideBias(o, hands) {
        const key = (hands ? 'h' : '') + (o.routine ? 'r' : 'f') + ':' + (o.atm == null ? 1 : o.atm) + ':' + Math.round(o.vx == null ? FALL.VX0 : o.vx) + ':' + Math.round(o.under == null ? FALL.UNDER : o.under) + ':' + (o.deck === false ? 0 : 1);
        if (biases.has(key)) return biases.get(key);
        const e = fall(Object.assign({}, o, { mark: null, x: 0, level: null })), span = e.a0 + e.deck + e.under, tab = new Float32Array(Math.ceil(span / 20) + 2).fill(NaN), rows = [];
        let n = 0;
        while (!fallOver(e) && n++ < 4000) { rows.push([e.a, driftEnd(e)]); fallStep(e, hands ? NONE : predPlan(e), 1 / 30); }
        rows.forEach(([a, de]) => { const i = Math.max(0, Math.min(tab.length - 1, Math.round((a + e.deck + e.under) / 20))); if (isNaN(tab[i])) tab[i] = de - e.x; });
        let last = 0;
        for (let i = 0; i < tab.length; i++) { if (isNaN(tab[i])) tab[i] = last; else last = tab[i]; }
        biases.set(key, tab);
        return tab;
    }
    /** Where the sideways drift ends from here (the drag's own reach): A.U.R.A.'s and the guide's predictor. */
    function driftEnd(e) {
        const k = e.atm === 0 ? FALL.X_DRAG_NONE : FALL.X_DRAG * (0.25 + ((e.rho || 0) + 0.8 * (e.atm == null ? 1 : e.atm)) / 2), T = Math.max(0, e.a + e.deck + (e.under || 0)) / Math.max(60, e.vy) * 0.85;   // the time left, about
        return e.x + e.vx * (1 - Math.exp(-k * T)) / k;
    }
    /** One step. keys: { up, left, right }. */
    function fallStep(e, keys, dt) {
        keys = keys || {};
        const rhoA = rhoAt(e.a), rho = rhoA * (e.atm == null ? 1 : e.atm), has = e.fuel > 0, up = !!keys.up;
        let steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), push = 0;
        if (e.mark != null) {                                                        // the guide: never carried far off the light (or off the field)
            // (the fix round: the light's band is judged by the corrected predictor, the field's edges by both: the
            // correction is measured along a careful fall, and a hands-off or held-sideways fall runs shorter than it)
            const gE = guideEnd(e), dE = e.a < FALL.EDGE_A && e.pull < 0.5 ? handsEnd(e) : gE, lo = Math.max(FALL.GUIDE_EDGE[0], e.mark - FALL.GUIDE), hi = Math.min(FALL.GUIDE_EDGE[1], e.mark + FALL.GUIDE);
            const overHi = Math.max(gE - hi, Math.max(gE, dE) - FALL.GUIDE_EDGE[1]), overLo = Math.max(lo - gE, FALL.GUIDE_EDGE[0] - Math.min(gE, dE));
            if (overHi > 0) { if (steer > 0) steer = 0; push = -FALL.SIDE * FALL.GUIDE_PUSH * Math.min(1, overHi / 40); }
            else if (overLo > 0) { if (steer < 0) steer = 0; push = FALL.SIDE * FALL.GUIDE_PUSH * Math.min(1, overLo / 40); }
        }
        if (e.level && e.fairOn && !push && (!steer || e.fairAlways)) {   // (the final fix round: fairAlways, a routine drop: eased even while you steer)                   // the first landings (e.level set, e.fairOn from the deck down): not steering, the end is eased onto the nearest level ground (a miss costs a walk, never a crash); a steer always wins
            const end = driftEnd(e) + e.vx * FALL.FAIR_LOOK;
            let best = Infinity, bestW = 0;
            for (let i = 0; i < e.level.length; i++) {
                const l = e.level[i], inset = Math.max(FALL.FAIR_IN, (l[1] - l[0]) * 0.3), lo = l[0] + inset, hi = l[1] - inset;
                const c = (lo > hi ? (l[0] + l[1]) / 2 : Math.max(lo, Math.min(hi, end))) - end;
                if (Math.abs(c) + (l[2] || 0) < Math.abs(best) + bestW) { best = c; bestW = l[2] || 0; }   // (l[2]: how much farther a stretch away from the find counts)
            }
            if (isFinite(best)) push = FALL.SIDE * FALL.FAIR_PUSH * (Math.max(-1, Math.min(1, best / 30)) - (Math.abs(best) < 2 ? 0.5 * Math.max(-1, Math.min(1, e.vx / 20)) : 0));
        }
        e.pull += ((up ? 1 : 0) - e.pull) * Math.min(1, dt / FALL.PITCH_S);          // the pull-up takes a moment to bite
        const dive = FALL.G - FALL.CD * rho * e.vy * Math.abs(e.vy), floor = floorAt(rhoA, e.a < -e.deck);
        const brake = (has ? FALL.THRUST : 0) + FALL.AIRBRAKE * rho * Math.max(0, e.vy) / 300 + (has ? 0 : 20);
        const held = e.vy > floor ? -brake : Math.min(dive, (floor - e.vy) * 1.2);  // held at the floor speed (never quicker than a dive)
        e.vy += (dive * (1 - e.pull) + held * e.pull) * dt;
        const low = e.a < 0;                                                         // (the final fix round: under the deck's top)
        e.vx += (-(xDrag(e, rho) + (low ? FALL.DECK_DRAG : 0)) * e.vx + (has ? steer * FALL.SIDE * (FALL.SIDE_DIVE + (FALL.SIDE_HELD - FALL.SIDE_DIVE) * e.pull) * (low ? FALL.DECK_SIDE : e.a > FALL.STEER_A[0] && e.atm > 0 ? 1 + (FALL.STEER_HI - 1) * Math.min(1, (e.a - FALL.STEER_A[0]) / (FALL.STEER_A[1] - FALL.STEER_A[0])) : 1) : 0) + push) * dt;
        const burn = (up && has ? FALL.FUEL_HOLD : 0) + (steer && has ? FALL.FUEL_SIDE : 0);
        e.fuel = Math.max(0, e.fuel - burn * dt); e.used += burn * dt;
        const v = Math.hypot(e.vx, e.vy);
        e.H += (FALL.HEAT_K * rho * (v / 100) * (v / 100) - FALL.HEAT_COOL * e.H) * dt;
        if (e.H > FALL.HEAT_SCORCH) { e.over += dt * (e.H > FALL.HEAT_BURN ? 2 : 1); if (e.over >= e.scorch + 1) e.scorch++; }
        if (e.H > FALL.HEAT_BURN) e.burnt = true;
        e.peakH = Math.max(e.peakH, e.H); e.peakV = Math.max(e.peakV, v);
        e.a -= e.vy * dt; e.x += e.vx * dt; e.t += dt; e.rho = rho; e.up = up; e.steer = steer;
        return e;
    }
    /** Where the fall would end with this plan (fn(e) → keys each step): the end state. */
    function fallRoll(e0, plan, h) {
        const e = Object.assign({}, e0);
        h = h || 1 / 60;
        let n = 0;
        const lead = Math.ceil(e.t / h - 1e-6) * h - e.t;                            // (the fix round: the steps keep to one grid in time, so the plan's switch falls on the same step from one call to the next: the end no longer jumps between frames)
        if (lead > 1e-6 && !fallOver(e)) fallStep(e, plan(e), lead);
        while (!fallOver(e) && n++ < 4000) fallStep(e, plan(e), h);
        return e;
    }
    const HOLD = { up: true }, NONE = {};
    /** A.U.R.A.'s hand on the fall: she dives, and pulls up at the last moment she can still come out of the deck slow
        (with a margin: she is careful), or sooner when the heat climbs; she steers to be over the light at the end. */
    function auraFall(e, markX, h) {
        const keys = {};
        const t0 = e.t;   // she looks a tenth of a second ahead (she plans ten times a second): dive that long, then hold
        if (e.H > FALL.AURA_HOT || fallRoll(e, s => (s.t - t0 < 0.12 ? NONE : HOLD), h).vy > FALL.SAFE_VY - 4) keys.up = true;
        const off = isFinite(markX) ? markX - predEnd(e) : Infinity;             // (round 3: where the plain fall would end from here, so she flies the goal from the first second)
        if (Math.abs(off) > 6) keys[off > 0 ? 'right' : 'left'] = true;
        return keys;
    }
    /** How far the fall carries the shuttle sideways when A.U.R.A. flies it without steering (the start is set from this).
        It depends only on (routine, air, vx), so it is worked out once for each. */
    const drifts = new Map();
    function fallDrift(o) {
        const key = (o.routine ? 'r' : 'f') + ':' + (o.atm == null ? 1 : o.atm) + ':' + Math.round(o.vx || 0);
        if (drifts.has(key)) return drifts.get(key);
        const e = fall(Object.assign({}, o, { mark: null, level: null })), x0 = e.x;
        let at = -1, keys = {};
        const d = fallRoll(e, s => { if (s.t - at >= 0.15) { at = s.t; keys = { up: auraFall(s, Infinity, 1 / 30).up }; } return keys; }, 1 / 30).x - x0;
        drifts.set(key, d);
        return d;
    }

    /** Round 3: where the fall ends if from now on you dive and hold from PULL_A (the lead of what you see is set from it). */
    const predPlan = s => (s.a <= (s.atm > 0 ? (s.routine ? FALL.PULL_A_ROUTINE : FALL.PULL_A) : (s.routine ? FALL.PULL_A_NONE_ROUTINE : FALL.PULL_A_NONE)) ? HOLD : NONE);
    function predEnd(e, h) { return fallRoll(e, predPlan, h || 1 / 30).x; }
    /** That plan's drift from a fresh fall with no input (the start is set from it); cached per (routine, air, vx, the
        hand-off depth: the fix round, a routine drop hands off about 22 px under the deck, not 14). */
    const preds = new Map();
    function predDrift(o) {
        const key = (o.routine ? 'r' : 'f') + ':' + (o.atm == null ? 1 : o.atm) + ':' + Math.round(o.vx || 0) + ':' + Math.round(o.under == null ? FALL.UNDER : o.under);
        if (preds.has(key)) return preds.get(key);
        const e = fall(Object.assign({}, o, { mark: null, level: null })), d = fallRoll(e, predPlan, 1 / 30).x - e.x;
        preds.set(key, d);
        return d;
    }

    window.LandingFlight = Object.freeze({ ENTRY, ATM, LAND, entry, entryStep, auraEntry, coast, inBand, isOver, land, landStep, stepHigh,
        FALL, fall, fallStep, fallOver, fallRoll, auraFall, fallDrift, driftEnd, guideEnd, rhoAt, floorAt, predEnd, predDrift });
})();
