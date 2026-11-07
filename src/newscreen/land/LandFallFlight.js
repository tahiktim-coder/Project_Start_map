/* ═══ Silent Exodus · new screen (?new=1) · land/LandFallFlight.js: THE METEOR in the game (PR #32) ═══
   Part of LandFall.js (the copy of prototypes/landing-meteor/landing.js: its header has the plan and the GAME: marks),
   split off it: what happens in a landing, with no drawing and no page. The run and the places (§1-2), going down and the
   fall (§7), the camera, the landing (§9), the walk-out and the result (§10), the step of the loop (update, §11).
   The split (2026-11-03, the house's 800-line limit; the code moved as it was, nothing in it changed but the names that
   cross between the three files): LandFallFlight.js loads first and makes window.LandFallParts (the three parts' shared names; LandFall.js
   freezes it once all three have loaded); LandFallScene.js draws; LandFall.js is the minigame (stage, words, input, loop).
   Functions of the later two are called through LandFallParts (lazy, below); every GAME: mark is the original's.
*/
(function () {
    'use strict';
    const A = window.LandingArt, LG = window.LandingGround, LF = window.LandingFlight, P = window.NSPaint, WD = window.LandingWords, LW = window.LandingWorlds, MA = window.MeteorArt;
    if (!A || !LG || !LF || !P || !WD || !LW || !MA || !window.LanderGame || !window.MiniHost || !window.MiniLab) return;   // GAME: no tower; without these the game keeps LanderGame (App.flyLanding)
    const I = window.LanderGame.internals, LC = window.LanderCrew, { NAME, WHO, LINES } = WD, ML = window.MeteorLand;
    if (!ML || !ML.drawCover) return;                                        // GAME: (the sketch's "could not load" lines are not in the game)
    const Z = window.LandFallParts = {};                                     // (the split) the three parts' shared names
    const lazy = name => (...a) => Z[name](...a);                            // (the split) a function of a part that loads later
    const revNoise = lazy('revNoise'), bakeVeil = lazy('bakeVeil'), off = lazy('off'), revRows = lazy('revRows'), warmRelease = lazy('warmRelease');   // LandFallScene.js
    const speak = lazy('speak'), end = lazy('end'), hideWords = lazy('hideWords'), showKeys = lazy('showKeys'), showAura = lazy('showAura');   // LandFall.js
    const controls = lazy('controls'), hideLine = lazy('hideLine'), keysShown = lazy('keysShown');                                       // LandFall.js
    const { clamp01, smooth, lerp, hash, RP } = P;
    const FW = A.FW, FH = A.FH, TOWER = A.TOWER_W, O = A.ORBIT, FALL = LF.FALL, SH = A.SH;
    // GAME: no clamp and no tower: the flare comes from our ship off the frame's top left, and the shuttle drops in from the
    // frame's top (REL_DX art px right of its place in the fall, REL_Y over the frame) as the view pushes in
    const FLARE_FROM = [-10, -14], REL_DX = 30, REL_Y = -16;
    // the fall's camera: art px per world px at rest (the landing) and at full speed; where the shuttle sits on screen
    const D_LAND = LG.D, D_FAST = 6.0, V_CALM = 70, V_FAST = 430, SX_FALL = 320 /* GAME: the frame's middle (no tower) */, SY_DIVE = 126, SY_DEEP = 56, GROUND_UP = 10;
    // round 2: the camera's scale moves through a lowpass (CAM_TAU s), never by position; the hand-off is HAND px over the
    // find's ground (a routine one lower), or GUARD_PX over whatever ground is under the shuttle if that comes first
    const CAM_TAU = 0.9, HAND = 45, HAND_ROUTINE = 36, GUARD_PX = 28, KEYS_MIN_S = 3, PHASE_KEY_S = 0.35, DRAG_PX = 80;
    // round 3 (DRAFT): the far sea's sideways stream (a fifth of the old: the far world drifts, it never rushes); the lead's
    // refresh and lowpass; a jolt every JOLT_S in blind cloud; the start's error (short on the first two landings)
    const FAR_STREAM = 0.2, JOLT_S = 0.3;                                    // (the polish round: the lead's numbers are in meteor-land.js K: PRED_S, LEAD_TAU, ...)
    // the fix round (DRAFT): the ground's soft stop arrives (LOCK_M world px of ease, reaching the lock), the light blooms once
    // as the fall starts, the first landings ease a miss onto level ground (landing-flight.js), the orbit never waits on
    // the far sizes of the land for longer than READY_WAIT_S, the 0.1 s jobs are spread over the tenth
    const VEIL_FOOT = 10, VEIL_ROWS = 40, VEIL_H = 320, VEIL_RISE = 170, VEIL_MAX = 0.8;   // (the final fix round, DRAFT: the haze over the land's far hills inside the deck)
    const LOCK_M = 10, BLOOM_S = 0.9, FAIR_L = 2, READY_WAIT_S = 4, FADE_FULL = 42, DECK_CLIP = 10, THIN_SHARE = 1, CEIL_IN = 40;   // (THIN_SHARE: the polish round, the share of the deck over its floor that thins into holes)   // (DECK_CLIP: the polish round, inside the deck the land is never drawn above its top + this)
    // the polish round (DRAFT): the first landing of a run never ends in a crash: A.U.R.A. catches it whole at the hand-off,
    // catches it again at the last moment (SAVE_ALT px over the ground, if it would touch down too hard) and the worst it
    // can be is rough; full consequences from landing 2
    const FAINT_LIGHT = ['geyser', 'smoke', 'devil', 'vent'];                  // (the final fix round: lights that are hard to see on their own ground: a wider glow in the fall)
    const FIRST_L = 1, SAVE_ALT = 14, SAVE_VY = 18, SAVE_VX = 10;
    // the final fix round (DRAFT): lined up with the light high up is coming down on the level pad beside it (at most AIM_OFF px
    // from the light): the light is the beacon, the pad is where you land (a light on a cliff or a mast never lures you onto it)
    const AIM_OFF = 40, FAIR_NONE_A = 70;
    const firstLanding = () => RUN.L <= FIRST_L;
    const RELEASE_R = [87, 109, 136, 170, 212];                              // the globe baked at these radii: the release draws the next larger, scaled down by a fifth at most
    // the timings: the full meteor takes its time on the first two landings; a routine landing is quick
    const FULL_T = { release: 2.6, streak: 1.2, walk: 3.4, result: 0.8 }, FULL_LATER = { release: 1.8, streak: 0.8, walk: 2.6, result: 0.6 }, ROUTINE_T = { release: 1.0, streak: 0.45, walk: 2.2, result: 0.4 };
    const RISKY = 25, FADE_S = 0.45;
    const FLARE_BURN_S = 60, NOTE_S = 1.8, HELM_S = 1.6, SPUTTER_FUEL = 20, CUE_S = 1.4, CATCH_FLAME_S = 0.6, CALM_JOLT = 0.3;   // CALM_JOLT: a routine drop's catch (GAME, the check)
    // GAME: the end (LanderGame's RESULT_HOLD_MS, SKIP_AFTER_MS); the wait for the bakes says so after WAIT_SAY_S and gives up
    // (LanderGame instead) after READY_MAX_S; a routine drop is set down within SET_ROOM px of a level stretch's middle;
    // Jaxon's step on A.U.R.A.'s landing (App.applyLanding's LANDING_LIFT)
    const RESULT_HOLD_S = 1.7, SKIP_AFTER_S = 0.5, WAIT_SAY_S = 0.6, READY_MAX_S = 10, SET_ROOM = 3, LIFT = { crash: 'rough', rough: 'soft' };
    const SET_VX = 40, SET_VY = 10, SET_T = 0.3, SET_TAU = 0.12;               // GAME (the check): setDownGuide (px/s, px/s, s, s)
    // GAME (the review): ERR_FRAMES frames failing in a row end the landing (never a frozen picture); after the hand-off the
    // frame's foot follows the ground the shuttle comes down on (eased over LOCK_TAU s); A.U.R.A. sets down SITE_CLEAR px
    // clear of the site's art; the place is let go FREE_AFTER_MS after the close (never in the fade back to the bridge).
    // GAME (the final check): a touchdown comes to rest on both pads, clear of the site's art (LandSite.js restAt): it slides
    // there (at most SETTLE_X px, over SETTLE_S s), or off the site it hops (HOP_ARC px up, HOP_PX_S px a second, at most
    // HOP_MAX_S s); where nothing near will do, a pad of soil is laid under its feet
    const ERR_FRAMES = 30, LOCK_TAU = 0.35, SETTLE_X = 9, SETTLE_S = 0.35, HOP_ARC = 5, HOP_PX_S = 60, HOP_MAX_S = 1.1, SITE_CLEAR = I.LANDER_HALF + 2, FREE_AFTER_MS = 900, EDGE_PAD = 3;
    const CELL = { HIT_X: 20, HIT_Y: 26, HEAT: 30 };                          // the storm's lightning cells in the fall: steer round them

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 1. The seven worlds (N), their finds (F)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const RARES = ['beacon', 'flare', 'tile', 'wind'];                     // GAME: the worlds and finds are the game's own (LandWorlds.js)

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 2. The run
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // GAME: the run is the game's, set by mount() from what App.flyLanding passes: L (landings flown + 1), the tank's energy,
    // the team (picked: ids; colors), who is aboard, the teaching once a run (first), the full drop or the routine one and its
    // carried grade, Jaxon on the team, why nothing is marked, who a crash hurts. The rares and the lines' counts are the page's.
    const RUN = { L: 1, energy: 60, rareUsed: new Set(), marks: {}, picked: [], colors: [], aboard: [], landings: [], first: false, full: true, carried: null, jaxon: false, unmarked: null, hurt: null };
    const S = { phase: 'orbit', t: 0, clock: 0, cam: { x: 0, y: 0, d: D_LAND } };   // GAME: 'orbit' while nothing flies (warm() carves ahead then)
    const fields = new Map();
    const world = () => S.w;                                                 // GAME: the game's world and find (mount)
    const find = () => S.f;
    /** GAME: one place per world, find, time of day, deck height, site, wreck and stretch width (the sketch's: per world, find
        and time of day); at most three held (the land's sizes are 18-36 MB a find). */
    function fieldFor(w, f, o) {
        o = o || {};
        const low = RUN.L >= 20, key = [w.id, f.id, f.tod, low ? 'low' : '', o.site || '', o.wreck || '', (f.risk || 0) >= 30 ? 'tight' : ''].join(':');
        if (fields.has(key)) return fields.get(key);
        fields.forEach((og, k) => { if (!og.done && og !== S.G) { A.drop(og.tag); fields.delete(k); } });
        const G = LG.prepare(w, f, { risk: f.risk, night: f.tod === 'night', low, weak: f.weak, site: o.site, wreck: o.wreck });
        if (!G) return null;
        G.key = key; G.info = f;
        G.E = A.entry(Object.assign({}, w, { night: G.tod === 'night' }), G.S);   // the far air, the cloud sea, the deck's body
        G.M = MA.prepare(G.E, G);                                                // the deck close, its floor, the wisps (under their own tag)
        ML.prepare(G, G.g.mark ? G.g.mark.cx : 160);                             // round 3: the deck's top seen from far above (its noise; the breaks are cut on the click)
        if (fields.size > 2) { const old = fields.keys().next().value; const og = fields.get(old); if (og && og !== S.G) { if (LG.freeLadder) LG.freeLadder(og); if (og.tag) A.drop(og.tag); } fields.delete(old); }
        fields.set(key, G);
        return G;
    }
    /** This place is the next landing: its field and the meteor's bakes go first in the queue. */
    function urgent(G) {
        if (!G) return;
        A.later(() => carveAhead(G), G.tag, false, 'breaks ahead');
        if (RUN.urgentG && RUN.urgentG !== G && S.phase === 'orbit' && LG.freeLadder) LG.freeLadder(RUN.urgentG);   // (the fix round: one find's six land sizes held at a time)
        const was = RUN.urgentG;
        if (was && was !== G) { [was.tag, was.M && was.M.tag, was.E && was.E.tag].forEach(t => t && A.demote(t)); if (was.world !== G.world) RELEASE_R.forEach(r => A.demote('globe:' + was.world.id + ':' + r)); }   // (the polish round: the one before goes back behind this one)
        RELEASE_R.forEach(r => A.promote('globe:' + G.world.id + ':' + r)); if (G.E && G.E.tag) A.promote(G.E.tag);
        RUN.urgentG = G; G.ladderFrom = firstStep(world(), G); LG.urgent(G); if (G.M && G.M.tag) A.promote(G.M.tag);
        prework(G);
    }
    /** The hand-off depth for this place (world px under the deck's floor) and the fall's tables for it, worked out ahead
        in the idle queue (K4: never on the click): the start's drift and the guide's corrections (the fix round). */
    /** The deck's breaks for this find now (seeded by the find: the same every time for the same find and landing). */
    function breaksOf(G) {
        const lp = LG.lightAt(G), aimX = G.g.mark ? G.g.mark.cx : lp.x;
        return ML.breaksFor(G.g, { L: RUN.L, risk: G.info.risk, light: { x: lp.x, y: lp.y }, aimX, groundY: lp.y + 2, seed: G.key, tiltAt: x => I.tiltAt(G.g, x) });
    }
    /** The polish round: the breaks cut into the cover in the idle queue while you read the tag (the click stays light). */
    function carveAhead(G) { if (G.cover && G.cover.done && S.phase === 'orbit') ML.carve(G.cover, breaksOf(G)); else if (G.cover && !G.cover.done) A.later(() => carveAhead(G), G.tag, false, 'breaks ahead'); }
    const underOf = (G, routine) => Math.max(8, (G.g.mark ? G.g.mark.y : 150) - (routine ? HAND_ROUTINE : HAND) - G.cloudBase);
    function prework(G) {
        if (G.preworked) return;
        G.preworked = true;
        A.later(() => { MA.warm(ML.LIGHT_RAMP[G.mark]); ML.warm(); revNoise(); }, G.tag, false, 'warm');
        A.later(() => LG.siteSpan(G), G.tag, false, 'site span');               // GAME (the final check): measured ahead, never on the click (goDown's siteFree)
        A.later(() => { if (G.E && G.E.air && !G.E.veil && !G.E.veilQueued) { G.E.veilQueued = true; bakeVeil(G.E, G.tod === 'night' ? 0.62 : 1, G.tag); } }, G.tag, false, 'air veil');   // (the polish round: never built on the fall's first frames)
        [true, false].forEach(routine => A.later(() => { const o = { routine, vx: FALL.VX0 * (routine ? 0.6 : 1), atm: G.world.atm, under: underOf(G, routine) }; LF.predDrift(o); LF.fall(Object.assign({ mark: 0 }, o)); }, 'drift', true, 'fall tables'));
    }
    const isFull = () => RUN.full;                                           // GAME: App.isFullDrop decides (the energy the reactor showed has no tower here)
    const timings = () => (S.full ? (RUN.L <= 2 ? FULL_T : FULL_LATER) : ROUTINE_T);
    function markLine(mark) { RUN.marks[mark] = (RUN.marks[mark] || 0) + 1; return RUN.L < 3 || RUN.marks[mark] <= 3; }
    const held = new Set();
    const anyInput = k => !!(k.up || k.left || k.right);

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 7. Go down: the release, then the fall (one camera from here to the touchdown)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // (the polish round: ready once the land's first READY_STEPS sizes are painted; the rest are painted while the release
    // plays and in the fall's spare time, in budget: the fall uses the next larger size until its own is done)
    const READY_STEPS = 3;
    const landReady = G => !!(G.main && G.main.done && G.far && G.far.done && G.ladder && G.ladder.slice(G.ladderFrom || 0, (G.ladderFrom || 0) + READY_STEPS).every(L => L.done));
    /** The first size of the land this drop shows (a routine drop starts low: its land already about 0.6 of the landing size). */
    const firstStep = (w, G) => (isFull(w, G) ? 0 : ML.ladderStep(ML.sOf(FALL.TOP_ROUTINE + FALL.DECK_ROUTINE + Math.max(0, (G.g.mark ? G.g.mark.y : 150) - G.cloudBase))));
    const readyToGo = (w, G) => !!(G && landReady(G) && G.E && G.E.done && G.M && G.M.done && G.cover && G.cover.done && RELEASE_R.every(r => A.globe(w, r).done));
    /** Round 3: the start's error ε (the predicted end − the light's x; below 0 the light is ahead): you start off line,
        so there is something to do from the first second. Short on the first two landings (one verb fixes it). DRAFT. */
    function startEps(full, airless) {
        const U = (a, b) => a + (b - a) * Math.random();
        if (!full) return (Math.random() < 0.5 ? -1 : 1) * U(20, 40);
        if (RUN.L <= 2) return airless ? -U(55, 80) : -U(45, 75);   // (the polish round: no air, where you come down hardly moves, so it starts a little farther off: doing nothing never lands on it)
        return Math.random() < 0.6 ? -U(45, 85) : U(90, 111);   // (the final fix round: 111, not 115: the damped deck carries a long start a little farther)
    }
    function goDown() {
        if (S.phase !== 'orbit') return;
        const w = world(), f = find(), G = S.G0;                                 // GAME: the place mount() prepared (warm() may have it ready)
        if (!G) return;
        if (!readyToGo(w, G)) {
            if (S.waitAt == null) { S.waitAt = S.clock; S.waitReal = performance.now(); }   // GAME: urgent once, at mount
            S.waitDown = true;
            const waited = Math.max(S.clock - S.waitAt, (performance.now() - S.waitReal) / 1000);   // GAME: by the real clock too (a long bake in a frame never stretches the wait)
            if (!S.saidWait && waited >= WAIT_SAY_S) { S.saidWait = true; speak(LINES.waitDown, true); }   // GAME: said only when the wait is a real one
            if (waited >= READY_MAX_S) { end({ fallback: true }); return; }   // GAME: never stuck: LanderGame instead (App.flyLanding)
            const core = G.main && G.main.done && G.E && G.E.done && G.M && G.M.done && RELEASE_R.every(r => A.globe(w, r).done);   // (the fix round: never stuck in orbit: after READY_WAIT_S the land far below falls back to the field's own picture)
            if (!(core && waited >= READY_WAIT_S)) return;
        }
        S.waitDown = false;
        held.clear();                                                            // the key that went down never counts as a hold
        S.G = G; S.w = w; S.f = f; S.info = G.info; S.E = G.E; S.M = G.M;
        S.full = isFull(w, G);
        const T0 = timings();
        S.phase = 'release'; S.t = 0; S.aura = false; S.auraUsed = false; S.lines = {}; S.scrapes = 0; S.hullsHit = new Set(); S.cellsHit = new Set();
        Object.assign(S, { saved: false, lightShown: null, lightDrawn: false, tileGone: false, tileAt: null, windTurned: false, turnAt: null, entry: null, result: null, touch: null, flatAt: null, landAt: null, s: null, zoom: null, jolt: 0, auraKeys: null, helmUntil: 0, fresh: false, reserve: false, crash: null, catchAt: null, firstInput: false, flownX: 0, wispsSeen: 0, hev: 0, keysAt: null, heldOnce: false, letGo: false, hotAt: 0, camFocus: null, braceAt: null, bellNow: null });
        S.releaseAt = S.clock; S.releaseS = T0.release; S.streakS = T0.streak;
        S.flareAt = G.mark === 'flare' ? S.clock + S.streakS : null;
        S.climb = { t0: performance.now() };
        const tank = (RUN.energy < 20 ? 100 : 120) + (RUN.picked.includes('jaxon') ? 10 : 0);
        // the start: high up and back along the way we come in, so that A.U.R.A.'s fall would carry us over the light, give
        // or take a little (the steering is the player's)
        const lp = LG.lightAt(G), vx0 = FALL.VX0 * (S.full ? 1 : 0.6), err = S.eps = startEps(S.full, !(w.atm > 0));   // round 3: the start from the plain fall's own end, off by ε
        S.lightX = lp.x; S.lightPt = { x: lp.x, y: lp.y }; S.anchorY = lp.y + 2; /* round 3: the projection hangs from the light's own ground (a light up a mast or a hill still sits in its break) */ S.aimX = G.g.mark ? G.g.mark.cx : lp.x; S.aimOff = Math.max(-AIM_OFF, Math.min(AIM_OFF, lp.x - S.aimX)); S.groundY = G.g.mark ? G.g.mark.y : lp.y; S.horizonY = Math.min(126, S.groundY - 20);   // aimX: the level ground by the light (A.U.R.A. comes down over it)
        const under = Math.max(8, S.groundY - (S.full ? HAND : HAND_ROUTINE) - G.cloudBase), drift = LF.predDrift({ routine: !S.full, vx: vx0, atm: w.atm, under });   // the hand-off: HAND px over the find's ground (the fix round: the drift for this very depth)
        const level = (S.full && RUN.L <= FAIR_L) || !S.full ? siteFree(G, (G.g.level || []).filter(l => l.c1 - l.c0 >= 4)).map(l => [l.c0, l.c1, 0.5 * Math.abs(l.cx - S.aimX)]) : null;   // GAME: clear of the site's art   // the fix round: the first landings ease a miss onto level ground (the find's own stretch preferred)
        S.e = LF.fall({ routine: !S.full, tank, x: lp.x - S.aimOff - drift + err, vx: vx0, atm: w.atm, under, mark: lp.x, level, fairAlways: !S.full });   // (the final fix round: a routine drop is eased onto level ground in the deck even while you steer)
        S.x0 = S.e.x;
        S.topY = G.cloudBase - S.e.deck;                                        // the deck's top in the field's world y
        S.rare = pickRare(G);
        S.path = fallPath(S.e);
        S.wisps = makeWisps(w, S.e);
        const hullsHere = w.atm > 0 && (w.hulls || (RUN.L >= 10 && w.hard.length < 2));
        S.hulls = hullsHere ? makeHulls(w, S.e, w.hulls ? 0 : 1) : [];
        S.cells = w.twist === 'cells' && w.atm > 0 ? makeCells(w, S.e) : [];
        S.breaks = breaksOf(G);
        ML.carve(G.cover, S.breaks);                                            // the breaks cut into the deck's top (the polish round: usually already cut, ahead in orbit)
        S.endRaw = S.endS = LF.predEnd(S.e); S.lead = ML.lead(null, { e: S.e, dt: 0, endRaw: S.endRaw, input: false, light: S.lightPt.x - S.aimOff, off: S.aimOff, sig: 0, atmosphere: w.atmosphere }); S.D = S.Draw = S.endS - S.e.x; S.predAt = 0; S.through = undefined; S.inShaft = null; S.joltAt = 0; S.passMs = 0; S.machinesAt = null; S.fieldOn = false; S.landLift = 0;
        S.cam = { x: 0, y: 0, d: dWant(Math.hypot(S.e.vx, S.e.vy)) }; S.cam.free = S.cam.d;
        stepCam(0);
        S.view = landView();
        S.light0 = { x: Math.max(TOWER + 12, Math.min(FW - 12, S.view.P.x)), y: Math.max(S.view.hz + 4, Math.min(FH - 10, S.view.P.y)) };   // the find's light flies straight into its break
        for (let y = 0; y < FH; y += 60) A.later(() => revRows(S.light0.x, S.light0.y, y, y + 60), 'release', true, 'reveal map');   // (the polish round: ahead, in the release's cheap frames)
        warmRelease();
        hideWords(); showKeys(RUN.first); S.keysAt = RUN.first ? S.clock : null;   // the one verb, from the release on (GAME: once a run)
        RUN.lastLanding = { world: w.id, find: f.kind, full: S.full, eps: +S.eps.toFixed(0), through: null };
    }
    /** Where A.U.R.A.'s fall would go (a sample every 0.1 s): the wisps, hulls and cells are put along it. */
    function fallPath(e0) {
        const e = Object.assign({}, e0), out = [];
        let n = 0;
        let k = {};
        while (!LF.fallOver(e) && n++ < 3000) { if (n % 15 === 1) k = LF.auraFall(e, S.aimX, 1 / 30); LF.fallStep(e, k, 1 / 30); if (n % 3 === 0) out.push([e.x, S.topY - e.a, e.a]); }   // (the fix round: her hand every half second here: it only places the wisps, hulls and cells, and the click stays light)
        return out;
    }
    const pathAt = a => { const p = S.path.find(q => q[2] <= a); return p || S.path[S.path.length - 1] || [S.e.x, S.topY - a, a]; };
    /** The cloud wisps the fall goes through: each at its own depth (p < 1 behind the shuttle, p > 1 in front of it). */
    function makeWisps(w, e) {
        if (!(w.atm > 0)) return [];
        const n = Math.round((e.routine ? 11 : 30) * (w.atm < 0.6 ? 0.75 : w.type === 'STORM_WORLD' ? 1.3 : 1)), out = [];
        const lo = 40, hi = e.a0 - 90, DEPTHS = [0.32, 0.5, 0.72, 1.55, 2.3];
        for (let i = 0; i < n; i++) {
            const a = hi - (hi - lo) * (i + 0.3 + 0.4 * Math.random()) / n, [px, py] = pathAt(a), p = DEPTHS[i % DEPTHS.length], front = p > 1;
            out.push({ wx: px + (Math.random() - 0.5) * 2 * (front ? 34 : 70) / p, wy: py + (Math.random() - 0.5) * 30, p, shape: i % 5, size: front ? 0.9 + Math.random() * 0.7 : 0.8 + Math.random() * 0.8, front });
        }
        return out;
    }
    /** Dead hulls of our class in the air (the half-lit world; from landing 10 other airs too): far ones drifting behind,
        one at the shuttle's own depth in the way (a scrape if you fly into it). */
    function makeHulls(w, e, fewer) {
        const n = 3 + Math.floor(Math.random() * (fewer ? 2 : 3)), out = [];
        for (let i = 0; i < n; i++) {
            const a = (0.25 + 0.6 * (i + Math.random() * 0.6) / n) * e.a0, [px, py] = pathAt(a), inWay = i === 1, whole = i === 0, cut = whole ? null : Math.random() < 0.5 ? 'tail' : 'nose';
            out.push({ wx: px + (inWay ? (Math.random() - 0.5) * 8 : (Math.random() - 0.5) * 120), wy: py, p: inWay ? 1 : 0.4 + Math.random() * 0.35, hl: inWay ? 22 : 17 + Math.random() * 6, seed: 70 + i * 7, angle: (Math.random() - 0.5) * 0.9, flip: Math.random() < 0.5,
                from: cut === 'tail' ? 0.25 + Math.random() * 0.2 : 0, to: whole ? 0.96 : cut === 'nose' ? 0.62 + Math.random() * 0.2 : 1, bob: Math.random() * 6 });
        }
        return out;
    }
    /** The storm's lightning cells: towers of cloud lit from inside, across the way down; fly into one and it strikes. */
    function makeCells(w, e) {
        const n = 2 + Math.floor(Math.random() * 2), out = [];
        for (let i = 0; i < n; i++) { const a = (0.2 + 0.55 * (i + 0.3 + Math.random() * 0.4) / n) * e.a0, [px, py] = pathAt(a); out.push({ wx: px + (Math.random() - 0.5) * 16, wy: py, seed: 11 + i * 13, ph: Math.random() * 3000 }); }
        return out;
    }
    function pickRare(G) {
        const fits = r => (r === 'beacon' ? G.mark === 'wreck' : r === 'flare' ? G.mark === 'flare' : r === 'tile' ? world().atm > 0 : r === 'wind' ? Math.abs(G.g.wind) > 0 : false);
        if (RUN.rareArmed) { const r = RARES.concat(RARES).slice(RARES.indexOf(RUN.rareArmed)).find(fits); RUN.rareArmed = null; if (r) return r; }
        if (RUN.noRare || Math.random() > 0.2) return null;
        const r = RARES.filter(x => !RUN.rareUsed.has(x) && fits(x));
        if (!r.length) return null;
        const pick = r[Math.floor(Math.random() * r.length)];
        RUN.rareUsed.add(pick);
        return pick;
    }

    function stepRelease() {
        const t = S.clock - S.releaseAt;
        if (S.flareAt && S.clock >= S.flareAt && !S.lines.flare) { S.lines.flare = true; if (!aimFlare() && markLine('flare')) speak(LINES.flare()); }
        if (t >= S.releaseS) startFall();
    }
    function skipRelease() {
        if (S.phase !== 'release') return;
        held.clear();
        if (S.flareAt && !S.lines.flare) { S.lines.flare = true; S.flareAt = S.clock; if (!aimFlare() && markLine('flare')) speak(LINES.flare()); }
        startFall();
    }
    /** The flare dropping from our ship onto the find (as the old dummy). k 0..1. */

    /** The first landing on a flare: the aim line says it ("Get the flare under us"), never two lines about the light 1.4 s apart. */
    const aimFlare = () => RUN.first && S.full && !S.aura && S.G && S.G.mark === 'flare' && !RUN.marks.aim;
    function startFall() {
        S.phase = 'fall'; S.t = 0; S.fallAt = S.clock;
        S.predAt = S.clock - ML.K.PRED_S + 0.017; S.hotAt = S.clock - 0.1 + 0.05;   // (the fix round: the tenth-of-a-second jobs spread over the tenth)
        if (RUN.first) showKeys(true);
        showAura(!S.aura);                                                       // GAME: A.U.R.A.'s keycap, from the fall's start
        if (RUN.first && S.full && !S.aura) { const fl = aimFlare(); if (markLine('aim')) speak(fl ? LINES.aimFlare() : lightVisible() && S.G.mark !== 'machines' ? LINES.aim() : LINES.aimGap()); }   // round 3: the goal, once (DRAFT)
    }
    /** The projection now (meteor-land.js view), from the fall, the lead and the camera (unshaken). */
    function landView() {
        const e = S.e, G = S.G, sw = shuttleWorld(), c = S.cam, d = c.d, a01 = clamp01(e.a / e.a0), gY = S.anchorY, gap = gY - G.cloudBase;
        const yLock = FH - (Math.min(S.groundY + GROUND_UP, G.V.oy + G.V.h / D_LAND) - gY) * D_LAND;   // (the final fix round: where camTarget's soft lock puts the field's ground: the far land settles there, so the switch never climbs)
        return ML.view({ yLock, e, D: S.D || 0, mag: S.lead ? S.lead.mag : 0, shX: S.camShX, rowShuttle: (sw.y - c.y) * d, hz: ML.hzOf(e), groundY: gY, gap, light: S.lightPt, trueY: (gY - c.y) * d, deckTopH: e.deck + gap, atmosphere: S.w.atmosphere });
    }
    /** The heat a second of diving from here would reach (the "Too hot" line speaks only when it would scorch). */
    function heatAhead(e0) { const e = Object.assign({}, e0); let top = e.H; for (let i = 0; i < 30 && !LF.fallOver(e); i++) { LF.fallStep(e, null, 1 / 30); top = Math.max(top, e.H); } return top; }
    /** The highest ground under the shuttle's feet at x. */
    function groundUnder(x) { const h = S.G.g.heights; let g = 999; for (let q = Math.round(x - I.LANDER_HALF); q <= Math.round(x + I.LANDER_HALF); q++) g = Math.min(g, h[Math.max(0, Math.min(LG.W - 1, q))]); return g; }
    function stepFall(dt) {
        const e = S.e, k = controls();
        let keys = k;
        if (k.up) S.heldOnce = true; else if (S.heldOnce) S.letGo = true;
        if (anyInput(k)) S.firstInput = true;
        if (keysShown() && S.letGo && S.clock - (S.keysAt || 0) >= KEYS_MIN_S) showKeys(false);   // the verb stays up until it has been done once
        if (S.aura) { if (!S.auraKeys || S.clock - (S.auraAt || 0) >= 0.1) { S.auraKeys = LF.auraFall(e, S.aimX); S.auraAt = S.clock; } keys = S.auraKeys; }
        if (S.rare === 'tile' && !S.tileGone && e.t > 2.2 && e.a > 260) { S.tileGone = true; S.hev += 16; e.scorch += 1; S.tileAt = S.clock; S.jolt = 1; }   // one damage, its heat only seen
        const x0 = e.x, y0 = S.topY - e.a;
        let left = dt;
        while (left > 1e-6) { const h = Math.min(1 / 60, left); LF.fallStep(e, keys, h); left -= h; if (LF.fallOver(e)) break; }
        S.flownX += ((e.x - x0) + dt * Math.hypot(e.vx, e.vy) * 1.1) * FAR_STREAM;   // the far sea's drift: our way across it, and the speed we came in with (round 3: a fifth: the far world drifts)
        const PS = ML.K.PRED_S;
        if (S.clock - S.predAt >= PS) { S.predAt += PS * Math.max(1, Math.floor((S.clock - S.predAt) / PS)); S.endRaw = LF.predEnd(e); }   // round 3: where you will come down (what you see leads to it)
        S.lead = ML.lead(S.lead, { e, dt, endRaw: S.endRaw, input: !S.aura && anyInput(keys), light: S.lightPt.x - S.aimOff, off: S.aimOff, sig: S.view ? S.view.sigL : 0, atmosphere: S.w.atmosphere });   // (the polish round: no lag, slewed when left alone, the miss magnified only while you leave it)
        S.endS = S.lead.endS; S.D = S.lead.D; S.Draw = S.endRaw - e.x;
        if (e.level && e.a <= (e.deck > 0 ? 0 : FAIR_NONE_A)) e.fairOn = true;   // (the final fix round: with no deck, from FAIR_NONE_A px over its floor)                                 // the first landings: from the deck down, a miss is eased onto level ground
        const hNow = S.groundY - (S.topY - e.a);
        if (e.deck > 0 && e.a <= 0 && e.a > -e.deck) {                            // in the deck: through a shaft, or blind
            const xAim = e.x + S.D * ML.gOf(hNow);
            if (S.through === undefined) {
                let b = ML.inShaft(S.breaks, xAim);
                if (!b && S.G.cover) { const op = ML.openRun(S.G.cover, xAim); if (op) { S.breaks.push(op); b = op; } }   // (the fix round: thin air's open sky is a shaft too: what was open from above is clear inside)
                S.through = b ? b.kind : null; RUN.lastLanding.through = S.through;
            }
            S.inShaft = shaftAt(xAim, e);                                         // (the fix round: in clear air as drawn, at the shuttle's own depth)
            if (!S.inShaft && S.clock - S.joltAt >= JOLT_S) { S.joltAt = S.clock; S.jolt = Math.max(S.jolt || 0, 0.5); }
        } else if (e.a <= -e.deck) S.inShaft = null;
        if (S.G.mark === 'machines' && e.a <= 280 && S.machinesAt == null) S.machinesAt = S.clock;
        S.keysNow = keys;
        const Y = S.topY - e.a;
        if (!S.aura) {
            if (S.lines.hotUp && (keys.up || e.a < 0)) { S.lines.hotUp = false; hideLine(LINES.hot().say); }   // the warning goes the moment you pull up, and never into the deck
            if (!S.lines.hot && !keys.up && e.a > 0 && S.clock - (S.hotAt || 0) >= 0.1) { S.hotAt = S.clock; if (heatAhead(e) > FALL.HEAT_SCORCH) { S.lines.hot = S.lines.hotUp = true; speak(LINES.hot()); } }
        }
        if (!S.aura) S.hulls.forEach((h, i) => { if (h.p !== 1 || S.hullsHit.has(i)) return; if (Math.abs(h.wx - e.x) < h.hl / 2.3 && h.wy > y0 - 6 && h.wy < Y + 6) { S.hullsHit.add(i); S.scrapes++; S.jolt = 1.2; S.hev += 8; } });   // swept: never passed through
        if (!S.aura) S.cells.forEach((c, i) => { if (S.cellsHit.has(i) || Math.abs(c.wx - e.x) > CELL.HIT_X || c.wy < y0 - CELL.HIT_Y || c.wy > Y + CELL.HIT_Y) return; S.cellsHit.add(i); S.hev += CELL.HEAT; S.jolt = 1.5; S.strikeAt = S.clock; });
        if (LF.fallOver(e) || Y + LT_TALL + GUARD_PX >= groundUnder(e.x)) startLand();   // the hand-off (or the ground came up first)
    }
    /** The shaft the shuttle is in now as the deck draws it (its funnel's width at this depth), or null. */
    function shaftAt(xAim, e) {
        const d = S.cam.d, q = clamp01(-e.a / Math.max(1, e.deck)), qq = q * q * (3 - 2 * q), V = S.view;
        if (!V) return null;
        for (const b of S.breaks) { if (b.kind === 'tear') continue; const gq = ML.shaftGeom(V, b, d, FW - TOWER), hw = gq.hwTop + (gq.hwBot - gq.hwTop) * qq; if (Math.abs(b.x - xAim) * d <= hw + 4) return b; }
        return null;
    }
    function flareBurn() { if (S.G.mark !== 'flare') return 1; if (S.rare === 'flare' && S.phase !== 'release' && S.phase !== 'fall') return 0; return 1 - clamp01((S.clock - S.releaseAt - (FLARE_BURN_S - 8)) / 8); }
    function lightOut() { return S.rare === 'beacon' && S.landAt && S.clock - S.landAt > 5; }
    const lightVisible = () => S.G.mark !== 'none' && !(S.G.mark === 'life' && S.G.tod !== 'night');
    const LT_TALL = window.LanderGame.LANDER_TALL;
    const sputterOf = fuel => (fuel > 0 && fuel < SPUTTER_FUEL ? 1 - fuel / SPUTTER_FUEL : 0);

    // ── the camera: locked on the shuttle all the way down; its scale (art px per world px) eases through a lowpass, from
    // the dive's (up to D_FAST) to the landing's (D_LAND, the field's own: drawn 1:1) over the deck and well above it; the
    // ground eases into the foot of the frame and holds there; after the touchdown it pans (never zooms) to the walk ──
    const dWant = v => D_LAND + (D_FAST - D_LAND) * smooth(V_CALM, V_FAST, v);
    function shuttleWorld() {
        if ((S.phase === 'fall' || S.phase === 'release') && S.e) return { x: S.e.x, y: S.topY - S.e.a, v: Math.hypot(S.e.vx, S.e.vy) };
        if (S.s) return { x: S.s.x, y: S.s.y, v: Math.hypot(S.s.vx, S.s.vy) };
        return null;
    }
    function camTarget(sw, d) {
        const G = S.G, V = G.V, deep = smooth(S.topY - 700, G.cloudBase + 4, sw.y), sy = lerp(SY_DIVE, SY_DEEP, deep);
        // the field's edges hold the frame only once the field can show (GAME, the review: where the field is drawn: 1:1, pinned
        // at the shuttle (renderScene's fieldAt), so while the camera's scale is still easing to D_LAND its edges are not at d)
        const k = D_LAND / d, right = V.ox + V.w / D_LAND, bottom = V.oy + V.h / D_LAND;
        const field = smooth(S.topY - 200, G.cloudBase, sw.y), lo = sw.x - (sw.x - V.ox) * k + EDGE_PAD / d, hi = Math.max(lo, sw.x + (right - sw.x) * k - (FW + EDGE_PAD) / d);   // (EDGE_PAD: a jolt's shake never shows the edge)
        const free = (S.camFocus ? S.camFocus.x : sw.x) - SX_FALL / d, x = lerp(free, Math.max(lo, Math.min(hi, free)), field);
        const ay = S.anchorY != null ? S.anchorY : S.groundY, foot = S.phase === 'fall' || S.phase === 'release' ? bottom : ay + (bottom - ay) * k;
        const lock = Math.min((S.lockG != null ? S.lockG : S.groundY) + GROUND_UP, foot) - FH / d;   // GAME: the ground under the shuttle after the hand-off (stepLock)
        let y = sw.y - sy / d;
        const ex = y - (lock - LOCK_M);
        y = ex <= 0 ? y : ex >= 2 * LOCK_M ? lock : lock - LOCK_M + ex - ex * ex / (4 * LOCK_M);   // the ground settles in the frame (a soft stop; the fix round: one that arrives, so the far land's row and the field's meet)
        return { x, y, lo, hi, field };
    }
    /** GAME (the review): the ground the frame's foot holds to: the find's own in the fall; after the hand-off the ground the
        shuttle comes down on when it lies lower (eased: never a jump), so its feet and the ground under them stay in frame. */
    function stepLock(dt) {
        if (S.phase === 'fall' || S.phase === 'release' || !S.s) { S.lockG = S.groundY; return; }
        const want = Math.min(S.G.V.oy + S.G.V.h / D_LAND, Math.max(S.groundY, groundUnder(S.s.x)));
        S.lockG = S.lockG == null ? S.groundY : S.lockG + (want - S.lockG) * (1 - Math.exp(-dt / LOCK_TAU));
    }
    function stepCam(dt) {
        const sw = shuttleWorld(); if (!sw || !S.G) return;
        stepLock(dt);
        const falling = S.phase === 'fall' || S.phase === 'release', c = S.cam;
        const want = falling ? lerp(dWant(sw.v), D_LAND, smooth(S.topY - 200, S.G.cloudBase - 20, sw.y)) : D_LAND;
        if (dt > 0) c.d += (want - c.d) * (1 - Math.exp(-dt / CAM_TAU));
        if (!falling && Math.abs(c.d - D_LAND) < 0.01) c.d = D_LAND;
        const t = camTarget(sw, c.d);
        if (falling || (S.phase === 'land' && !S.touch) || dt === 0) { c.x = t.x; c.y = t.y; }
        else { const k = 1 - Math.exp(-dt * 2.2); c.x += (t.x - c.x) * k; c.y += (t.y - c.y) * k; }   // the walk: a slow pan
        // GAME (the check): the pan never shows past the field's edges. After a touchdown the scale still eases to D_LAND, so the
        // edges' limits move faster than the slow pan follows: near the field's right side the sky and the limb showed in a strip
        if (t.field >= 1) c.x = Math.max(t.lo, Math.min(t.hi, c.x));
        S.camShX = (sw.x - c.x) * c.d; S.camShY = (sw.y + SH.BELL - c.y) * c.d;   // the bell on screen (no shake)
        if (S.phase !== 'release') S.bellNow = [S.camShX, S.camShY, c.d];
    }
    /** How hard everything shakes now (art px): the speed, the heat, a jolt. */
    function shakeK() {
        const e = S.e, falling = S.phase === 'fall';
        const spd = falling ? smooth(V_CALM + 60, V_FAST + 60, Math.hypot(e.vx, e.vy)) : 0, heat = falling ? clamp01((e.H + (S.hev || 0) - 50) / 70) : 0;
        return { spd, heat, amp: 3.4 * spd * spd + 2.6 * heat + 2.2 * (S.jolt || 0) };
    }
    /** The shuttle's attitude in the fall: bell-first along the way it falls, tucked into a dive or flared to pull up,
        upright by the deck's floor; the legs come down in the deck. */
    function fallLook() {
        const e = S.e, v = Math.hypot(e.vx, e.vy) || 1, ux = e.vx / v, uy = e.vy / v, deep = smooth(S.topY - 160, S.G.cloudBase + 2, S.topY - e.a);
        let lean = Math.atan2(-ux, uy) + lerp(0.24, -0.32, e.pull);
        lean *= 1 - smooth(0.5, 0.95, deep);
        return { ux, uy, v, deep, lean: Math.round(lean / 0.05) * 0.05, fold: deep > 0.8 ? 1 : deep > 0.6 ? 0.5 : 0 };
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 9. The landing: the last stretch, today's physics, in the same shot
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function startLand() {
        const G = S.G, e = S.e, w = S.w;
        S.phase = 'land'; S.landAt = S.clock; S.t = 0;
        if (!S.fieldOn && S.view) S.landLift = Math.min(0, S.view.Yg - S.view.trueY);   // (the fix round: the far land's row had not yet met the camera's: the field eases down the last px)
        S.fieldOn = true;
        showKeys(false);                                                          // the keycaps sit where the feet come down
        G.g.unmarked = RUN.unmarked || null;                                      // GAME: as LanderGame (opts.unmarked): nothing marked, no masts
        if (!S.full && !S.aura) { S.aura = true; S.setDown = true; }             // GAME: a routine drop: A.U.R.A. sets it down from the hand-off (App.flyLanding)
        showAura(false);
        G.g.wind = G.g.wind0 != null ? G.g.wind0 : G.g.wind; G.g.wind0 = G.g.wind;
        S.entry = { t: +e.t.toFixed(1), vy: +e.vy.toFixed(0), peakV: +e.peakV.toFixed(0), peakH: +e.peakH.toFixed(0), used: +e.used.toFixed(0), scorch: e.scorch, burnt: e.burnt, aura: S.aura, caught: false, dx: +(S.lightX - e.x).toFixed(0) };
        let vy = e.vy;
        if (vy > FALL.CATCH_VY) {                                              // too fast out of the deck: A.U.R.A. catches it (the faster, the harder and dearer)
            const want = FALL.CATCH_FUEL + (vy - FALL.CATCH_VY) * FALL.CATCH_PER, pay = Math.min(e.fuel, firstLanding() ? want : FALL.CATCH_FUEL_MAX, want), k = firstLanding() ? 1 : want > 0 ? pay / want : 0;   // too fast for what she can pay: only slowed (a crash); the first landing of a run: always whole
            e.fuel -= pay; vy = lerp(vy, FALL.CATCH_TO, k);
            // GAME (the check): a routine drop is A.U.R.A.'s own set-down at the grade it carries: her catch is quiet (no "Brace!",
            // never reported as "Came in fast"), unless that grade is a crash
            const calm = !S.full && !(RUN.carried && RUN.carried.grade === 'crash');
            S.entry.caught = !calm && k > 0 && e.vy > 120; S.entry.helped = k > 0; S.entry.catchFuel = +pay.toFixed(1); S.catchAt = S.clock;
            S.jolt = calm ? CALM_JOLT : 0.6 + 1.4 * smooth(FALL.CATCH_VY, 300, e.vy); if (!calm && e.vy > 120) { S.helmUntil = S.clock + HELM_S; S.talking = S.clock + 1.2; S.braceAt = S.clock; speak(LINES.brace(RUN.picked[0])); }   // a hard catch: a crew reaction, never "There's the light." 
        }
        const s = I.startState(G.g);
        Object.assign(s, { x: Math.max(I.LANDER_HALF + 1, Math.min(LG.W - I.LANDER_HALF - 2, e.x)), y: S.topY - e.a, vx: e.vx, vy, fuel: e.fuel, isReleased: true, altitude: 100, keys: { left: false, right: false } });
        S.s = s;
        S.env = { gravity: I.BASE_GRAVITY * Math.pow(Math.max(0.4, Math.min(2.2, w.gravity || 1)), I.GRAVITY_CURVE) };
        S.gusty = G.risk >= 30 || RUN.L >= 20; S.gustX = RUN.L >= 20 ? LF.LAND.GUST_X_LATE : LF.LAND.GUST_X;
        S.nextGust = S.gusty ? 2 + Math.random() * 2 : 1e9; S.gust = { k: 0, warn: 0, dir: Math.sign(G.g.wind0) || 1 };
        S.nextBolt = G.kindName === 'storm' ? 1.2 + Math.random() * 2 : 1e9; S.flash = 0;
        S.hops = 0; S.touch = null; S.brown = 0; S.firstLandInput = S.firstInput;
        if (S.aura) { s.fuel += LF.LAND.AURA_FUEL; s.isAuto = true; s.autoTarget = S.setDown ? levelBy(s.x) : null; }   // GAME: to the mark when one is marked (LanderGame's autopilot); a routine drop: the level ground where you came down
        if (s.fuel <= 0) openReserve(s);
        if (G.mark === 'none' && !S.aura && RUN.aboard.includes('mira')) S.flatAt = S.clock + 0.6;   // GAME: Mira aboard and alive reads the ground
    }
    /** GAME (the check): a routine set-down (A.U.R.A.'s) flies straight to the level ground she chose (s.autoTarget) and is over
        it before the touchdown, its descent slowed when that is far (with the fall's sideways speed carried on and LanderGame's
        autopilot alone, it came down on water by the shore and hopped off it). */
    function setDownGuide(s, dt) {
        const dx = s.autoTarget.cx - s.x, alt = Math.max(0.5, s.altitude), tg = alt / Math.max(SET_VY, s.vy);
        const want = Math.max(-SET_VX, Math.min(SET_VX, dx / Math.max(SET_T, tg * 0.7)));
        s.vx += (want - s.vx) * Math.min(1, dt / SET_TAU);
        if (Math.abs(dx) > 1.5 && Math.abs(dx) / SET_VX > tg * 0.7) s.vy = Math.min(s.vy, Math.max(SET_VY, alt / (Math.abs(dx) / SET_VX + SET_T)));
    }
    /** GAME: the level stretch nearest x with room (LanderGame's pickLevelTarget off the mark), its room held to SET_ROOM, so
        A.U.R.A. settles near its middle (never on the lip at its end). */
    function levelBy(x) {
        const all = siteFree(S.G, S.G.g.level || []), roomy = all.filter(l => l.room >= 4), pool = roomy.length ? roomy : all;
        const l = pool.reduce((b, q) => (!b || Math.abs(q.cx - x) < Math.abs(b.cx - x) ? q : b), null);
        return l ? Object.assign({}, l, { room: Math.min(l.room, SET_ROOM) }) : null;
    }
    /** GAME (the review): the level stretches cut to where the shuttle stands SITE_CLEAR px clear of the site's art (the final
        check: the columns its art covers, LandSite.js siteSpan: a hut and its mast's wires, a dome, a wreck, graves, ruins;
        LanderSites' own x0..x1 is narrower than what it paints), so A.U.R.A. never sets it down on or against them (a stretch
        the site stands over keeps its longer clear side); all of them as they were if none is clear (restAt moves it off). */
    function siteFree(G, list) {
        const st = G.siteKind && G.g.site;
        if (!st || !(st.x1 > st.x0)) return list;
        const span = LG.siteSpan(G) || [st.x0, st.x1], a = span[0] - SITE_CLEAR, b = span[1] + SITE_CLEAR, clear = [];
        list.forEach(l => {
            if (l.c1 < a || l.c0 > b) { clear.push(l); return; }
            const lo = [l.c0, Math.min(l.c1, a)], hi = [Math.max(l.c0, b), l.c1], [c0, c1] = lo[1] - lo[0] >= hi[1] - hi[0] ? lo : hi;
            if (c1 - c0 >= 2) clear.push(Object.assign({}, l, { c0, c1, cx: (c0 + c1) / 2, room: (c1 - c0) / 2, x0: c0 - I.LANDER_HALF, x1: c1 + I.LANDER_HALF }));
        });
        return clear.length ? clear : list;
    }
    function openReserve(s) { if (S.reserve) return; S.reserve = true; s.fuel = LF.LAND.RESERVE; }
    function stepLand(dt) {
        const G = S.G, g = G.g, s = S.s, t = S.clock - S.landAt;
        if (S.flatAt && S.clock >= S.flatAt) { S.flatAt = null; const l = LG.levelNear(G, s.x); if (l && markLine('none')) speak(LINES.flat(l.cx < s.x ? 'left' : 'right')); }
        if (S.rare === 'wind' && !S.windTurned && t > 2.5) { S.windTurned = true; g.wind0 = -g.wind0; S.gust.dir = Math.sign(g.wind0) || 1; S.gust.warn = 1; S.turnAt = t; }
        let wind = g.wind0;
        if (S.gusty && !s.grade) {
            const into = S.nextGust - t;
            S.gust.warn = into > 0 && into < LF.LAND.GUST_WARN ? 1 - into / LF.LAND.GUST_WARN : 0;
            if (t >= S.nextGust && t < S.nextGust + LF.LAND.GUST_S) { wind = S.gust.dir * Math.max(2, Math.abs(g.wind0)) * S.gustX; S.gust.k = 1; }
            else { S.gust.k = Math.max(0, S.gust.k - dt * 3); if (t >= S.nextGust + LF.LAND.GUST_S) S.nextGust = t + LF.LAND.GUST_EVERY[0] + Math.random() * (LF.LAND.GUST_EVERY[1] - LF.LAND.GUST_EVERY[0]); }
        }
        if (S.turnAt != null && t - S.turnAt < 1.2) S.gust.warn = 1 - (t - S.turnAt) / 1.2;
        g.wind = wind;
        if (t >= S.nextBolt) { S.flash = LF.LAND.BOLT_MS / 1000; S.bolt = { x: 20 + Math.random() * 280, y: 120 + Math.random() * 30, seed: Math.floor(Math.random() * 255) }; S.nextBolt = t + LF.LAND.BOLT_EVERY[0] + Math.random() * 3; }
        S.flash = Math.max(0, S.flash - dt);
        const k = controls();
        if (anyInput(k) && !S.firstLandInput) { S.firstLandInput = true; showKeys(false); }
        if (!s.grade) {
            if (S.aura) I.autopilot(s, g);
            else { s.keys.left = k.left || k.up; s.keys.right = k.right || k.up; }
            let left = dt, landed = null;
            if (t < 0.8 && Math.abs(s.vx) > 20) s.vx -= (s.vx - Math.sign(s.vx) * 20) * Math.min(1, dt * 4);   // the fall's sideways speed, carried in, bleeds off
            if (S.setDown && s.autoTarget) setDownGuide(s, dt);
            while (left > 1e-6 && !landed) { const h = Math.min(1 / 60, left); landed = LF.landStep(s, G, S.env, h); left -= h; if (s.fuel <= 0 && !S.reserve) openReserve(s); }
            if (!landed && s.y < G.cloudBase + 4) { s.y = G.cloudBase + 4; s.vy = Math.max(0, s.vy); }   // the deck's floor is the ceiling now
            const thrust = s.fuel > 0 && (s.keys.left || s.keys.right);
            S.brown = G.kindName === 'dunes' && thrust && s.altitude < LF.LAND.BROWN_PX ? Math.min(1, S.brown + dt * 4) : Math.max(0, S.brown - dt * 2);
            if (landed) touchdown(landed);
        } else {
            S.brown = Math.max(0, S.brown - dt * 2);
            if (S.touch && S.phase === 'land') afterTouch(dt);
        }
        if (!s.grade && S.phase === 'land' && firstLanding() && !S.aura && !S.saved) lastCatch(s, g);
        if (S.phase === 'land' && !s.grade && !S.lines.light && S.lightDrawn && lightVisible() && S.clock - (S.braceAt == null ? -9 : S.braceAt) > 1.6) { S.lines.light = true; speak(LINES.light(RUN.picked[0])); }   // only once it is lit and on screen
    }
    /** The first landing of a run (the polish round): about to touch down too hard, A.U.R.A. catches it at the last moment
        (both thrusters, a jolt, her one line); it still comes in rough. The final fix round: only when it can no longer be
        helped (even both thrusters from here would touch down faster than rough, down or sideways): a careful hover over bad
        ground is never caught (a slow touchdown there is made rough at the touchdown instead). */
    function lastCatch(s, g) {
        if (s.altitude > SAVE_ALT || s.altitude < 0 || s.vy <= 0) return;
        const brake = s.fuel > 0 ? LF.LAND.THRUST_UP_BOTH - S.env.gravity : -S.env.gravity, vMin2 = s.vy * s.vy - 2 * brake * Math.max(0, s.altitude), tHit = Math.max(0, s.altitude) / Math.max(4, s.vy);
        const sideLeft = Math.abs(s.vx) - (s.fuel > 0 ? LF.LAND.THRUST_SIDE * tHit : 0);
        if (vMin2 <= I.ROUGH.down * I.ROUGH.down * 0.9 && sideLeft <= I.ROUGH.side) return;
        save();
        s.vy = Math.min(s.vy, SAVE_VY); s.vx = Math.max(-SAVE_VX, Math.min(SAVE_VX, s.vx));
        S.catchAt = S.clock; S.jolt = Math.max(S.jolt || 0, 0.8);
    }
    function save() {
        if (S.saved) return;
        S.saved = true; if (S.entry) S.entry.saved = true;                       // (the final fix round: her line says it; the result never reports the same catch again)
        if (!S.aura) { hideLine(S.lastLine); speak(LINES.save()); }
    }
    function touchdown(grade) {
        const G = S.G, s = S.s;
        showKeys(false);
        if (firstLanding() && (grade === 'crash' || (S.saved && grade === 'soft'))) { if (grade === 'crash') save(); grade = 'rough'; }   // the polish round: the first landing of a run is at worst rough (and a caught one never soft)
        if (G.kindName === 'ice' && grade === 'soft' && Math.abs(s.vx) > LF.LAND.ICE_SOFT_SIDE) grade = 'rough';
        if (S.reserve && grade === 'soft') grade = 'rough';
        // GAME: a routine drop shows the grade carried from the last full drop on this kind of world (App.flyLanding); A.U.R.A.'s
        // landing with Jaxon on the team comes down a step softer (App.applyLanding's rule, in the picture)
        S.raw = grade; S.lifted = false;
        if (!S.full && RUN.carried) { grade = RUN.carried.grade; S.raw = RUN.carried.raw || grade; S.lifted = !!RUN.carried.lifted; }
        else if (S.aura && RUN.jaxon && LIFT[grade]) { grade = LIFT[grade]; S.lifted = true; }
        showAura(false);
        s.grade = grade; s.endedAt = performance.now(); s.keys.left = s.keys.right = false;
        S.touch = { at: S.clock, grade, slideV: G.kindName === 'ice' && grade !== 'crash' ? s.vx : 0, fuel: s.fuel, x0: s.x, reserve: !!S.reserve };
        if (S.phaseAt && S.phaseAt.touch == null) S.phaseAt.touch = +(S.clock - S.releaseAt).toFixed(2);
        S.fresh = false;
        if (grade === 'crash') {
            const hurt = RUN.hurt, down = hurt || RUN.picked[0] || null;          // GAME: one who is well (App.flyLanding), the one App.applyLanding hurts (nobody well: the first, hurt already)
            S.touch.hurt = hurt; S.touch.helper = down ? RUN.picked.find(id => id !== down) || null : null;   // GAME (the final check): a team of one climbs out alone, and says so
            S.crash = { hurt: down, helper: S.touch.helper, mild: !!(LC && LC.isMild && LC.isMild(G.planet)) };
            S.camFocus = LG.crashFocus(G, s);
            hideLine(S.lastLine); S.lines.light = true;                          // silence over the crash (the hurt line follows)
        } else S.crash = null;
        S.flown = Object.assign({}, S.flown || {}, { landAura: S.aura });
        if (grade !== 'crash' && !S.touch.slideV) { S.touch.settle = settleOf(s); if (S.touch.settle) S.jolt = Math.max(S.jolt || 0, 0.5); }   // GAME (the review): never left standing on a peak
        const mayHop = spotDistance() > LF.LAND.SPOT_PX && s.fuel >= LF.LAND.HOP_FUEL && !S.aura;
        if (grade !== 'crash' && !S.touch.slideV && !mayHop) { ensureSite(); const plan = walkPlan(performance.now()); S.camFocus = plan && plan.focus ? plan.focus : null; }
    }
    /** GAME (the final check): where the touchdown comes to rest (LandSite.js restAt): on both pads on the ground as it is
        drawn, clear of the site's art; within SETTLE_X px it slides there (never up onto higher ground), off the site it hops
        to the nearest clear place, and where nothing near will do a pad of soil is laid under its feet (padUnder, at once).
        → { x0, y0, x1, y1, t0, dur, hop } to move there, or null where it stands. */
    function settleOf(s) {
        const r = LG.restAt(S.G, s.x, groundUnder(s.x), SETTLE_X);
        if (!r) return null;
        if (r.pad) LG.padUnder(S.G, r.pad);
        const dx = Math.abs(r.x - s.x), hop = dx > SETTLE_X;
        if (dx < 0.01 && Math.abs(r.y - s.y) < 1) { s.y = r.y; return null; }   // on its feet where it touched: set on the drawn ground at once (under a px)
        return { x0: s.x, y0: s.y, x1: r.x, y1: r.y, t0: S.clock, dur: hop ? Math.min(HOP_MAX_S, SETTLE_S + dx / HOP_PX_S) : SETTLE_S, hop };
    }
    /** GAME (the final check): the crash's line: the other one's for the one who went down (a team of two), or their own. */
    function crashLine() {
        const c = S.crash;
        if (!c || !c.hurt) return null;
        return c.helper ? LINES.hurt(c.helper, c.hurt) : LINES.hurtAlone(c.hurt);
    }
    function spotDistance() {
        const G = S.G, s = S.s, m = G.g.mark;
        if (G.mark === 'none' || !m) { const onLevel = (G.g.level || []).some(l => s.x >= l.c0 && s.x <= l.c1); if (onLevel) return 0; const l = LG.levelNear(G, s.x); return l ? Math.max(0, Math.abs(l.cx - s.x) - l.room) : 99; }
        return Math.abs(s.x - m.cx);
    }
    function afterTouch(dt) {
        const Tt = S.touch, s = S.s, since = S.clock - Tt.at;
        if (Tt.slideV && since < LF.LAND.ICE_SLIDE_S) { s.x += Tt.slideV * (1 - since / LF.LAND.ICE_SLIDE_S) * dt; return; }
        if (Tt.slideV && !Tt.slid) { Tt.slid = true; Tt.settle = settleOf(s); }   // GAME (the final check): where the ice slide stops, it rests on its pads too
        if (Tt.settle) {                                                          // GAME: off the peak (it tips and slides down onto its feet), or off the site's art (a hop)
            const st = Tt.settle, q = clamp01((S.clock - st.t0) / st.dur), e = smooth(0, 1, q);
            s.x = lerp(st.x0, st.x1, e); s.y = lerp(st.y0, st.y1, e * e) - (st.hop ? HOP_ARC * Math.sin(Math.PI * e) : 0);
            if (q < 1) return;
            Tt.settle = null; Tt.x0 = s.x;
        }
        if (Tt.grade === 'crash') {
            if (!S.lines.hurt && since > 1.1) { S.lines.hurt = true; const line = crashLine(); if (line) speak(line); }   // GAME (the final check): a team of one too
            if (since > (S.full ? 4.2 : 3.4)) finish();
            return;
        }
        const far = spotDistance(), canHop = far > LF.LAND.SPOT_PX && s.fuel >= LF.LAND.HOP_FUEL && since < LF.LAND.HOP_S && !S.aura;
        if (canHop && S.fresh) { s.grade = null; S.touch = null; S.fresh = false; s.y -= 1.2; s.vy = -14; S.hops++; S.camFocus = null; return; }
        if (!canHop || since >= LF.LAND.HOP_S) startWalk();
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 10. The walk-out, the result (as the old dummy)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function ensureSite() {
        const G = S.G, g = G.g, s = S.s;
        if (!g.site || !G.siteKind) { const x = LG.spot(G); g.site = { kind: 'none', goalX: Math.round(x), x0: x - 6, x1: x + 6, dir: x >= s.x ? 1 : -1, live: {}, standY: null }; }
    }
    const walkPlan = now => (LC ? LC.plan(S.G.g, S.s, RUN.colors.slice(), S.G.planet, now, RUN.picked.slice()) : null);   // GAME: the team's own colours
    function startWalk() {
        const s = S.s;
        S.phase = 'walk'; S.walkAt = S.clock; showKeys(false);
        ensureSite();
        s.crew = walkPlan(performance.now());
        S.walkS = s.crew ? Math.min(timings().walk, s.crew.duration / 1000) : 1;
        if (s.crew && s.crew.focus) S.camFocus = s.crew.focus;
    }
    function stepWalk() { if (S.clock - S.walkAt >= S.walkS) finish(); }
    function finish() {
        if (S.phase === 'result') return;
        const s = S.s, Tt = S.touch || { grade: s.grade, fuel: s.fuel };
        const far = Tt.grade === 'crash' ? 0 : spotDistance(), where = far <= LF.LAND.SPOT_PX ? 'spot' : far <= LF.LAND.WALK_PX ? 'walk' : 'long';
        const auraLanded = !!(S.flown && S.flown.landAura), caught = !!(S.entry && S.entry.caught && !S.entry.saved);   // GAME: her save() line said it already: the result never reports the same catch again
        const line = Tt.grade === 'crash' ? crashLine() : LINES.result(Tt.grade, where, auraLanded, caught);
        // GAME: no chips and no costs here: the game's own rules apply what this landing means (App.applyLanding). A long walk
        // from a marked spot counts rough, as LanderGame's "off the mark" (the screen already said "Long walk from here"); as
        // there, Jaxon's step comes after it (lifted false: App.applyLanding gives it, from rough)
        const marked = !RUN.unmarked, offMark = marked && Tt.grade !== 'crash' && where === 'long';
        S.result = { grade: offMark ? 'rough' : Tt.grade, raw: offMark ? 'rough' : S.raw || Tt.grade, auto: S.full ? auraLanded : !!(RUN.carried && RUN.carried.auto), lifted: !offMark && !!S.lifted, offMark, marked,
            hurt: Tt.grade === 'crash' ? Tt.hurt || null : null, routine: !S.full, through: S.through === undefined ? null : S.through, seconds: +(S.clock - S.releaseAt).toFixed(1), where, line: line ? line.say : null };
        RUN.landings.push(Object.assign({ world: S.w.id, kind: S.f.kind, L: RUN.L }, S.result));
        S.phase = 'result'; S.resultAt = S.clock; showKeys(false); showAura(false);
        S.resultShowAt = S.clock + timings().result; S.resultLine = line;
        RUN.L += 1;
    }
    function showResult() {
        if (S.resultLine) speak(S.resultLine, true);                            // GAME: the line only (no chips, no ways): it holds, then the game goes on
        S.doneAt = S.clock + RESULT_HOLD_S;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 11. The loop
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function update(dt) {
        S.clock += dt; S.t += dt;
        S.jolt = Math.max(0, (S.jolt || 0) - 3 * dt); S.hev = (S.hev || 0) * Math.exp(-FALL.HEAT_COOL * dt);
        if (S.voiceUntil && S.clock > S.voiceUntil) hideWords();   // (the split: the same two steps, LandFall.js's)
        if (S.phase === 'orbit') { goDown(); return; }                          // GAME: nothing to choose: down as soon as the bakes are ready
        if (S.phase === 'release') { stepRelease(); stepCam(dt); return; }
        if (S.phase === 'fall') { stepFall(dt); stepCam(dt); return; }
        if (S.phase === 'land') { stepLand(dt); stepCam(dt); return; }
        if (S.phase === 'walk') { stepLand(dt); stepCam(dt); return stepWalk(); }
        if (S.phase === 'result') { stepLand(dt); stepCam(dt); if (S.resultShowAt && S.clock >= S.resultShowAt) { S.resultShowAt = 0; showResult(); } if (S.doneAt && S.clock >= S.doneAt) end(S.result); }   // GAME: then the game goes on
    }
    // (the split) for LandFallScene.js and LandFall.js
    Object.assign(Z, {
        O, world, A, P, FW, FH, find, S, LG, I, lerp, D_LAND, FLARE_FROM, RP, FADE_S, smooth, RELEASE_R, REL_DX, REL_Y, V_CALM, V_FAST, SH, sputterOf,
        CATCH_FLAME_S, MA, clamp01, lightVisible, ML, DECK_CLIP, VEIL_FOOT, TOWER, THIN_SHARE, FADE_FULL, FAINT_LIGHT, BLOOM_S, LF, VEIL_H, VEIL_ROWS,
        VEIL_MAX, VEIL_RISE, hash, CEIL_IN, RUN, fallLook, shakeK, lightOut, flareBurn, shuttleWorld, landView, WHO, NAME, WD, held, ERR_FRAMES, readyToGo,
        SKIP_AFTER_S, DRAG_PX, PHASE_KEY_S, LW, FREE_AFTER_MS, fields, finish, update, skipRelease, fieldFor, urgent
    });
})();
