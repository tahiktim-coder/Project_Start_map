/* ═══ Silent Exodus · new screen (?new=1) · land/LandFall.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/landing.js (sha1 c227eb5a63b9, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   GAME: the new look's landing, a MiniHost minigame ('land-fall'): App.flyLanding plays it, with the game's world, find,
   team and run (no orbit to choose in, no tag, no result chips, no Again / Another find, no dummy keys, no tower). It
   starts on the globe where the bridge glass had it, waits for its bakes (never past READY_MAX_S: then LanderGame),
   falls, lands, walks out, says the result, and hands App.applyLanding { grade, raw, auto, lifted, offMark, marked, hurt,
   routine } (the contract: App.flyLanding). A routine drop (App.isFullDrop false) is the short one: you line it up and
   A.U.R.A. sets it down, at the grade carried from the last full drop on that kind of world. Its bakes are warmed while
   the bridge idles at a stop (warm) and let go when it closes and when the stop is left (forget).
   window.LandFall (frozen): canFly(planet), warm(), forget(), flies() (GO DOWN here flies the meteor: Stop.js), debug { state, stats, resetStats, landProbe, landLog, passStats }
*/
/* ═══ Silent Exodus · prototypes · landing-meteor/landing.js: THE METEOR ══════════════════════════════════════════════
   The landing dummy (../landing/, kept as it was for comparison) rebuilt as one continuous fall. The designer chose this
   direction (2026-10-29: "yes on A, the meteor"); the old dummy's entry felt slow and far away, cut to a different screen
   for the landing, and asked you to brake while every instinct said push.

   THE PLAN (written before the build):
   1. Keep what was liked, unchanged: the orbit (the tower on the left, the globe, each find by its own light, the tag with
      its risk and who goes, the shuttle on its clamp), the walk-out and the result. No arrows: the target is always the
      find's own light.
   2. One camera from the release to the touchdown, one renderer (renderScene): the world is the landing field's own
      coordinates stretched upward (the field is LanderGame's 320 x 180 grid; the fall starts about 2,300 px above it). The
      camera is { x, y, d }: d art px per world px. Nothing cuts. The release pushes in on the globe while the shuttle,
      falling ahead of us, grows to its place in the fall; the fall's air dissolves in behind it (the shuttle never jumps).
   3. Speed is the point. The camera stays close (d 4.6 to 6, the shuttle three times the old size or more) and closes in
      as the speed builds; the world tears past in layers: the planet's limb and the cloud sea far below (landing-art's
      own), wisps of cloud and the air's streaks at their own depths (some in front of the shuttle), the deck's billows
      rushing up, then its body and its torn floor. The faster and hotter, the more the camera and the hull shake, the
      brighter the cold blue-white bow of plasma round the leading face (never orange), plates rattle, sparks peel back;
      on the tower Cora grips the helm and the others brace. No meter, no number: the ship and the world show it.
   4. One verb, as instinct says: let go and you dive (speed builds, the shuttle tucks into the fall); hold (Space, W, Up,
      or the mouse) and you pull up / brake (it flares, both thrusters fire, the speed bleeds off, the camera eases out).
      Left/right steer over the find's light (it sits on the cloud sea ahead, slides under you, then shows on the ground).
      Diving saves time and fuel; diving low and fast in thick air heats the hull (scorched, then burnt); arriving at the
      floor too fast makes A.U.R.A. catch you hard (fuel, a jolt) or, without the fuel, a crash. The skill: pull up late.
      Said once: keycaps with three words on the first landing; A.U.R.A.'s "Too hot, Commander. Pull up." when it is.
   5. The floor tears open about 58 px over the find's ground: the field (LanderScene's own picture, painted at D 4.6, the
      fall's own scale) is right there under the deck with the light on it. The camera's scale eases to D 4.6 through a
      lowpass over the last of the dive and the deck (never by position: the shuttle shrinks a fifth at most, slowly), the
      shuttle stays centred, the ground eases into the foot of the frame; the fall goes on under the deck to the hand-off
      45 px over the ground, and the last stretch is today's landing physics (LanderGame's step, the old dummy's rules:
      gusts, ice, dunes, lava, lightning, the reserve, the hop) in the same shot, drawn 1:1. No zoom after it: the walk is a pan.
   6. Shorter routines: the full meteor plays on the first landing on each world type and on a risky find (risk 25 % or
      more); a routine landing starts low (a quick fall you can still touch, a thinner deck, the hand-off 36 px up) and
      runs about seven seconds from the release to the touchdown.
   Round 2 (the review, 2026-10-29): the fall never carries you more than 120 px off the light; a hold is never quicker
   than a dive high up and never a float (a full hold is about 12 s); the keycaps show from the release until the verb has
   been done once, and the key or click that went down never counts as a hold; "Too hot" only while you dive into heat.
   7. NO SOUND (no AudioSystem, nothing plays). Test hooks: window.LandingProto (state, keys, routine, timings, stats).
   Round 3 (the designer, 2026-10-31: "i think we should see a bit further because when land appears it ddoes suddenly.
   and i felt almost no purpose what i do at the veryy start you know."): BREAKS IN THE CLOUD (meteor-land.js). From the
   first frame of the fall the place you land on lies far below, small and hazy, under the cloud deck's torn top; one
   break in the deck is lit from under by the find's own light. Steer it under the nose (a held slide is quick, a dive's
   steer is weak, a hold alone stretches your reach) and keep it there: the land grows to its landing size by 1/h (never a
   pop: the same painting at six sizes, then the field's own, 1:1, from 66 px up), the haze lifts, the deck's crest rises
   to meet you and you fall through a shaft of clear air. Miss it: blind murk and jolts, and you come out over whatever
   ground is there. One shot, the same camera, the same verbs; no meter; A.U.R.A.'s one line on the first landing.

   Controls: hold Space / W / Up / the mouse: pull up (brake); Left/A, Right/D: steer; the pointer held to one side of the
   shuttle steers that way. In the landing, as today: hold = both thrusters, Left/Right = one. A.U.R.A.'s speaker on the
   tower (or H) hands her the rest (the fall and the landing). Dummy keys (notes only with ?dev): N world, F find, L landing
   1/5/10/20, R rare, T full meteor / routine / as the rules say.
   Art: landing-art.js, landing-ground.js, landing-tower.js, meteor-art.js; numbers: landing-flight.js (FALL); words:
   landing-words.js; the worlds: landing-worlds.js.
*/
(function () {
    'use strict';
    const A = window.LandingArt, LG = window.LandingGround, LF = window.LandingFlight, P = window.NSPaint, WD = window.LandingWords, LW = window.LandingWorlds, MA = window.MeteorArt;
    let root = null;                                                         // GAME: the stage mount() builds in MiniHost's overlay; every id is 'land-' + id, inside it
    const $ = id => (root ? root.querySelector('#land-' + id) : null);
    if (!A || !LG || !LF || !P || !WD || !LW || !MA || !window.LanderGame || !window.MiniHost || !window.MiniLab) return;   // GAME: no tower; without these the game keeps LanderGame (App.flyLanding)
    const I = window.LanderGame.internals, LC = window.LanderCrew, { NAME, WHO, LINES } = WD, ML = window.MeteorLand;
    if (!ML || !ML.drawCover) return;                                        // GAME: (the sketch's "could not load" lines are not in the game)
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
    const FLARE_BURN_S = 60, NOTE_S = 1.8, HELM_S = 1.6, SPUTTER_FUEL = 20, CUE_S = 1.4, CATCH_FLAME_S = 0.6;
    // GAME: the end (LanderGame's RESULT_HOLD_MS, SKIP_AFTER_MS); the wait for the bakes says so after WAIT_SAY_S and gives up
    // (LanderGame instead) after READY_MAX_S; a routine drop is set down within SET_ROOM px of a level stretch's middle;
    // Jaxon's step on A.U.R.A.'s landing (App.applyLanding's LANDING_LIFT)
    const RESULT_HOLD_S = 1.7, SKIP_AFTER_S = 0.5, WAIT_SAY_S = 0.6, READY_MAX_S = 10, SET_ROOM = 3, LIFT = { crash: 'rough', rough: 'soft' };
    // GAME (the review): ERR_FRAMES frames failing in a row end the landing (never a frozen picture); after the hand-off the
    // frame's foot follows the ground the shuttle comes down on (eased over LOCK_TAU s); a touchdown with both pads more than
    // PERCH px over the ground, or one OVERHANG px over a drop, slides off (at most SETTLE_X px, over SETTLE_S s); A.U.R.A. sets down SITE_CLEAR px
    // clear of the site's art; the place is let go FREE_AFTER_MS after the close (never in the fade back to the bridge)
    const ERR_FRAMES = 30, LOCK_TAU = 0.35, PERCH = 2.5, OVERHANG = 5, SETTLE_X = 9, SETTLE_S = 0.35, SITE_CLEAR = I.LANDER_HALF + 2, FREE_AFTER_MS = 900, EDGE_PAD = 3;
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
        A.later(() => { if (G.E && G.E.air && !G.E.veil && !G.E.veilQueued) { G.E.veilQueued = true; bakeVeil(G.E, G.tod === 'night' ? 0.62 : 1, G.tag); } }, G.tag, false, 'air veil');   // (the polish round: never built on the fall's first frames)
        [true, false].forEach(routine => A.later(() => { const o = { routine, vx: FALL.VX0 * (routine ? 0.6 : 1), atm: G.world.atm, under: underOf(G, routine) }; LF.predDrift(o); LF.fall(Object.assign({ mark: 0 }, o)); }, 'drift', true, 'fall tables'));
    }
    const isFull = () => RUN.full;                                           // GAME: App.isFullDrop decides (the energy the reactor showed has no tower here)
    const timings = () => (S.full ? (RUN.L <= 2 ? FULL_T : FULL_LATER) : ROUTINE_T);

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. The frame: 640 x 360 art px, a whole number of screen px each where that costs little room
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let stage = null, frameEl = null, art = null, ctx = null;                // GAME: built by mount() (no tower canvas)
    let K = 3, FR = { left: 0, top: 0 };
    function fit() {
        // GAME: the bridge's own fit (NewScreen.js G.bk: as large as the window shows the whole 640 x 360, centred), so the globe
        // is where the glass had it; the CSS vars are set on the stage, never on the page (NewScreen keeps its own)
        const dpr = window.devicePixelRatio || 1, k = Math.max(1, Math.min(Math.round(innerWidth * dpr) / FW, Math.round(innerHeight * dpr) / FH)) / dpr;
        K = k;
        FR = { left: Math.round((innerWidth - FW * k) / 2), top: Math.round((innerHeight - FH * k) / 2) };
        Object.assign(frameEl.style, { left: FR.left + 'px', top: FR.top + 'px', width: FW * k + 'px', height: FH * k + 'px' });
        art.style.width = FW * k + 'px'; art.style.height = FH * k + 'px';
        stage.style.setProperty('--k', k);
        stage.style.setProperty('--t', clamp01((innerWidth - 1280) / 640).toFixed(3));
        stage.style.setProperty('--px', k + 'px');
        ctx.imageSmoothingEnabled = false;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 4. Words: one line at a time, in the dark of the picture
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let say = null, keysEl = null, auraEl = null;                            // GAME: built by mount(); no tag, result chips, ways or dev note
    function place(el, ax, ay) { el.style.left = Math.round(ax * K) + 'px'; el.style.top = Math.round(ay * K) + 'px'; }
    function hideWords() { say.classList.remove('is-in'); S.voiceUntil = 0; }   // GAME: the voice is the only line
    function speak(line, stay) {
        if (!line) return;
        const who = WHO[line.who] || WHO.aura;
        say.className = 'voice tone-' + who.tone;
        $('who-name').textContent = NAME[line.who] || 'A.U.R.A.';
        $('line').textContent = line.say;
        const face = $('face');
        face.hidden = !who.face; $('who-ring').hidden = !!who.face;
        say.querySelector('.film-line').classList.toggle('is-narr', !who.face);
        if (who.face) face.src = WD.faceURL[who.face] || WD.FACE_SRC(who.face);
        place(say, TOWER + 18, 16);
        void say.offsetWidth;
        say.classList.add('is-in');
        S.voiceUntil = stay ? Infinity : S.clock + 3.2;
        S.lastLine = line.say;
        S.talking = line.who === 'aura' ? S.clock + 3.2 : 0;
    }
    /** The one verb, as keycaps with three words, on the first landing only, until a control is touched. */
    function showKeys(on) {
        keysEl.hidden = !(on && RUN.first);                                     // GAME: once a run (App.flyLanding's first)
        if (!keysEl.hidden) place(keysEl, (TOWER + FW) / 2 - keysEl.offsetWidth / K / 2, FH - 30);
    }
    /** GAME: "Let A.U.R.A. land" (LanderGame's words), a quiet keycap at the bottom left from the fall's start until she has
        the stick or the shuttle is down. */
    function showAura(on) {
        auraEl.hidden = !on;
        if (on) place(auraEl, 18, FH - 30);
    }
    function markLine(mark) { RUN.marks[mark] = (RUN.marks[mark] || 0) + 1; return RUN.L < 3 || RUN.marks[mark] <= 3; }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 5. Input: hold to pull up, left and right to steer (keys by their place on the keyboard)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const held = new Set();
    let pointer = null;                                                      // GAME: no tower to hover, no lights to pick
    function controls() {
        const k = { up: held.has('Space') || held.has('KeyW') || held.has('ArrowUp'), left: held.has('ArrowLeft') || held.has('KeyA'), right: held.has('ArrowRight') || held.has('KeyD') };
        if (pointer && pointer.down && pointer.fly) {
            const sx = S.shAX;
            if (S.phase === 'fall') { k.up = true; if (pointer.dragged && sx != null && Math.abs(pointer.ax - sx) > 30) k[pointer.ax < sx ? 'left' : 'right'] = true; }   // held: pull up; dragged well to one side: steer too
            else if (sx != null) { const dx = pointer.ax - sx; if (dx < -8) k.left = true; else if (dx > 8) k.right = true; else k.up = true; }
        }
        if (S.testKeys) Object.assign(k, S.testKeys);
        return k;
    }
    const anyInput = k => !!(k.up || k.left || k.right);

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 6. Orbit: the world as the glass showed it, the chosen find's light on it (GAME: nothing to choose: the bridge chose)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function findXY(w, f) { return [O.x + f.uv[0] * O.r, O.y + f.uv[1] * O.r]; }   // GAME: the find's own place (WorldFinds.js at)
    const warmSeen = new Map();
    function warmAt(w, fd, gl, x, y) {
        const key = w.id + ':' + fd.id + ':' + fd.kind;                         // GAME: by the find's id
        if (warmSeen.has(key)) return warmSeen.get(key);
        if (!gl.done || !gl.cpu) return false;
        let r = 0, b = 0;
        const cx = Math.round(x - O.x + gl.half), cy = Math.round(y - O.y + gl.half);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = ((cy + dy) * gl.size + cx + dx) * 4; r += gl.cpu[i] || 0; b += gl.cpu[i + 2] || 0; }
        const warm = r > b + 9 * 30 && r > 9 * 70;
        warmSeen.set(key, warm);
        return warm;
    }
    function globeLum(gl) {
        if (!gl.done || !gl.cpu) return null;
        return (x, y) => {
            const cx = Math.round(x - O.x + gl.half), cy = Math.round(y - O.y + gl.half);
            if (cx < 0 || cy < 0 || cx >= gl.size || cy >= gl.size) return 0;
            const i = (cy * gl.size + cx) * 4;
            return 0.3 * gl.cpu[i] + 0.59 * gl.cpu[i + 1] + 0.11 * gl.cpu[i + 2];
        };
    }
    function drawOrbit(now) {
        const w = world(), sky = A.orbitSky(w.sector), gl = A.globe(w, 87), f = P.framer(ctx, FW, FH);
        ctx.drawImage(sky.canvas, 0, 0);
        P.twinkle(f, sky.stars, now);
        if (sky.sky && sky.sky.live) { try { sky.sky.live(ctx, now, 0); } catch (e) { /* the still sky is enough */ } }
        drawGlobe(gl, O.x, O.y, 1, now, w);
        const fd = find(), G = S.G || S.G0, [x, y] = findXY(w, fd), mark = G ? G.mark : LG.markOf(fd, I.GROUND_OF[w.type] || 'rock', w.atmosphere);   // GAME: the chosen find's light only
        const burning = S.phase === 'release' && S.flareAt && S.clock >= S.flareAt;
        A.drawLight(f, mark, x, y, now, { night: fd.tod === 'night', scale: 1, pre: mark === 'flare' && !burning, orbit: true, chosen: S.phase === 'orbit', warm: warmAt(w, fd, gl, x, y), groundLum: globeLum(gl) });
    }
    function drawGlobe(gl, x, y, scale, now, w) {
        if (!gl.done) return;
        if (scale === 1) ctx.drawImage(gl.canvas, Math.round(x - gl.half), Math.round(y - gl.half));
        else ctx.drawImage(gl.canvas, Math.round(x - gl.half * scale), Math.round(y - gl.half * scale), Math.round(gl.size * scale), Math.round(gl.size * scale));
        if (scale === 1 && window.NSWorlds) { try { window.NSWorlds.live(P.framer(ctx, FW, FH), w.node || null, x, y, gl.r, now, { L: w.L || A.LW, sector: w.sector, type: w.type, seed: w.seed }); } catch (e) { /* still */ } }   // GAME: the node (the glass's world)
    }
    const lightKind = G => (!G ? 'none' : G.mark);

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
    /** The polish round: the shuttle's sprites the release will ask for (its size and lean as it leaves the clamp), baked ahead
        one per queue slot. */
    let warmC = null;
    function warmRelease() {
        if (!warmC) { const c = document.createElement('canvas'); c.width = 4; c.height = 4; warmC = c.getContext('2d'); }
        const look = fallLook(), seen = new Set(), Ls = S.G.S.Ls || 1;
        for (let q = 0; q <= 1.0001; q += 0.01) {
            const d = lerp(1, S.cam.d, q * q), dq = Math.abs(d - D_LAND) < 0.06 ? D_LAND : Math.max(1, Math.round(d * 4) / 4), lean = Math.round(look.lean * q / 0.05) * 0.05, key = dq + ':' + lean;
            if (seen.has(key)) continue;
            seen.add(key);
            A.later(() => A.shuttle(warmC, dq, -999, -999, Ls, { cabin: true, rim: false, fold: 0, lean }), 'release', true, 'sprite');
        }
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
    function flareStreak(F, k, fx, fy, now) {
        const at = q => [lerp(FLARE_FROM[0], fx, q), lerp(FLARE_FROM[1], fy, q) - Math.sin(q * Math.PI) * 30];   // GAME: from our ship off the frame (no clamp, no puff of smoke at it)
        if (k >= 1) { const a = 1 - Math.min(1, (k - 1) / 0.25); if (a > 0) F.glow(fx, fy, Math.round(5 + 4 * (1 - a)), RP.RED, 0.7 * a); return; }
        for (let i = 1; i <= 14; i++) {
            const q = k - i * (0.018 + 0.006 * P.hash(i, 3, 17)); if (q <= 0) break;
            if (P.hash((i * 7 + Math.floor(now / 70)) & 255, 5, 17) < 0.3) continue;
            const [x, y] = at(q), j = (P.hash(i, Math.floor(now / 90) & 255, 19) - 0.5) * 1.6;
            F.tone(x + j, y + j * 0.5, RP.RED, (0.8 - i * 0.05) * (0.7 + 0.3 * P.hash(i, 9, 17)));
        }
        const [hx, hy] = at(k), fl = 0.8 + 0.2 * P.hash(Math.floor(now / 80) & 255, 7, 17);
        F.glow(hx, hy, 3, RP.RED, 0.55 * fl); F.px(hx, hy, fl > 0.94 ? '#ffd2c8' : RP.RED.hex[4]);
    }
    /** The release: the shuttle leaves the clamp and falls away toward the world; the view pushes in on the find (the globe
        drawn from the next larger of its baked sizes, never blown up) while the shuttle, falling ahead of us, grows to its
        place in the fall; the fall's air comes in round the find's light, outward, pixel by pixel through the grain. */
    function drawRelease(now) {
        if (tOn) tLast = performance.now();
        const t = S.clock - S.releaseAt, w = S.w, f = S.f, [fx, fy] = findXY(w, f), F = P.framer(ctx, FW, FH), RS = S.releaseS, quick = RS < 2, ST = S.streakS;
        const fadeS = quick ? 0.35 : FADE_S, lead = quick ? (S.flareAt ? ST : 0.2) : 1.3, push = smooth(lead, RS - fadeS * 0.3, t), leave = quick ? Math.min(0.15, lead * 0.5) : 0.8;
        if (push <= 0) {
            drawOrbit(now);
            if (S.flareAt && t < ST + 0.25) flareStreak(F, t / ST, fx, fy, now);
        } else {                                                                 // the view pushes in on the find
            const sky = A.orbitSky(w.sector);
            ctx.drawImage(sky.canvas, 0, 0);
            const r = O.r * Math.pow(RELEASE_R[RELEASE_R.length - 1] / O.r, push), tx = lerp(fx, S.light0.x, push), ty = lerp(fy, S.light0.y, push);
            const gx = tx - (fx - O.x) * r / O.r, gy = ty - (fy - O.y) * r / O.r;
            const gl = RELEASE_R.map(rr => A.globe(w, rr)).find(g => g.done && g.r >= r - 0.5) || A.globe(w, O.r);
            drawGlobe(gl, gx, gy, Math.min(1, r / gl.r), now, w);
            A.drawLight(F, lightKind(S.G), tx, ty, now, { night: S.G.tod === 'night', orbit: true, lit: true, warm: warmAt(w, f, A.globe(w, 87), fx, fy) });
        }
        if (tOn) { tick('relSky'); }
        const from = RS - fadeS;
        if (t > from) { renderScene(now, { into: true, noShuttle: true }); tLast = performance.now(); revealFrom(off().canvas, S.light0.x, S.light0.y, smooth(from, RS, t)); tick('relReveal'); }
        // the shuttle: on the clamp, then away and down, growing as we chase it, turning bell-first into the air
        const go = smooth(leave, RS, t), d = lerp(1, S.cam.d, go * go), look = fallLook(), lean = Math.round(look.lean * go / 0.05) * 0.05;
        const bx = lerp(S.camShX + REL_DX, S.camShX, Math.pow(go, 0.8)) + Math.sin(go * 3) * 4 * (1 - go), by = lerp(REL_Y, S.camShY, Math.pow(go, 1.15));   // GAME: in from the frame's top
        drawFallShuttle(ctx, bx, by, d, Object.assign({}, look, { lean, fold: 0 }), now, { keys: {}, heat: go > 0.75 ? (go - 0.75) * 0.6 : 0, shake: 0, release: true });
        S.bellNow = [bx, by, d];                                                // GAME: no hull beside the picture
        tick('relShuttle');
    }
    let rev = null;
    /** src over the frame where it has come in: outward from (cx, cy) as k goes 0 → 1, per art pixel through the Bayer grain
        (a soft, uneven front: no blocks, no rectangle). */
    /** The polish round: the reveal's grain noise, once (it does not depend on where the light is). */
    let revN = null;
    function revNoise() { if (!revN) { revN = new Float32Array(FW * FH); for (let y = 0, i = 0; y < FH; y++) for (let x = 0; x < FW; x++, i++) revN[i] = (P.vnoise(x / 23, y / 17, 5) - 0.5) * 0.2; } return revN; }
    /** The reveal's distance map round (cx, cy), rows y0..y1 (done ahead in strips at the click: the polish round). */
    function revRows(cx, cy, y0, y1) {
        if (!rev) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; const g = c.getContext('2d'); rev = { c, g, img: g.createImageData(FW, FH), dist: new Float32Array(FW * FH), at: '', rows: 0 }; }
        const at = Math.round(cx) + ':' + Math.round(cy);
        if (rev.at !== at) { rev.at = at; rev.rows = 0; }
        const md = Math.hypot(Math.max(cx, FW - cx), Math.max(cy, FH - cy) * 1.2), N = revNoise();
        for (let y = Math.max(y0, rev.rows); y < Math.min(FH, y1); y++) for (let x = 0, i = y * FW; x < FW; x++, i++) rev.dist[i] = Math.hypot(x - cx, (y - cy) * 1.2) / md + N[i];
        rev.rows = Math.max(rev.rows, Math.min(FH, y1));
    }
    function revealFrom(src, cx, cy, k) {
        if (k <= 0) return;
        if (k >= 1) { ctx.drawImage(src, 0, 0); return; }
        revRows(cx, cy, 0, FH);
        const BAND = 0.32, T = k * (1 + BAND + 0.1) - 0.1, d = rev.img.data, dist = rev.dist;
        for (let y = 0, i = 0; y < FH; y++) for (let x = 0; x < FW; x++, i++) d[i * 4 + 3] = P.threshold(x, y) < (T - dist[i]) / BAND ? 255 : 0;
        rev.g.globalCompositeOperation = 'copy'; rev.g.putImageData(rev.img, 0, 0);
        rev.g.globalCompositeOperation = 'source-in'; rev.g.drawImage(src, 0, 0); rev.g.globalCompositeOperation = 'source-over';
        ctx.drawImage(rev.c, 0, 0);
    }
    let offC = null;
    function off() { if (!offC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; offC = c.getContext('2d'); offC.imageSmoothingEnabled = false; } return offC; }

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
    function hideLine(text) { if (say.classList.contains('is-in') && S.lastLine === text) { say.classList.remove('is-in'); S.voiceUntil = 0; } }
    function stepFall(dt) {
        const e = S.e, k = controls();
        let keys = k;
        if (k.up) S.heldOnce = true; else if (S.heldOnce) S.letGo = true;
        if (anyInput(k)) S.firstInput = true;
        if (!keysEl.hidden && S.letGo && S.clock - (S.keysAt || 0) >= KEYS_MIN_S) showKeys(false);   // the verb stays up until it has been done once
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
        return { x, y };
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
    /** The shuttle in the fall at (bx, by) (its bell on screen), d art px per world px. */
    function drawFallShuttle(pc, bx, by, d, look, now, o) {
        const dq = Math.abs(d - D_LAND) < 0.06 ? D_LAND : Math.max(1, Math.round(d * 4) / 4), F = P.framer(pc, FW, FH), e = S.e, heat = o.heat != null ? o.heat : (e.H + (S.hev || 0)) / 100, spd = smooth(V_CALM, V_FAST + 80, look.v);   // dq: at the landing's scale, the very sprite the landing draws
        const jit = o.shake || 0, jx = jit ? Math.round((Math.random() - 0.5) * 2 * jit) : 0, jy = jit ? Math.round((Math.random() - 0.5) * 2 * jit) : 0;
        bx = Math.round(bx + jx); by = Math.round(by + jy);
        const top = by - SH.BELL * dq, keys = o.keys || {}, lit = e.fuel > 0, sp = sputterOf(e.fuel), po = { lean: look.lean }, dn = [-Math.sin(look.lean), Math.cos(look.lean)];
        const catching = S.catchAt != null && S.clock - S.catchAt < CATCH_FLAME_S;
        const fire = side => { const [px, py] = A.podAt(dq, side, po); MA.flame(F, bx + px, top + py, dn[0], dn[1], dq, catching ? 1.6 : 1, sp); };
        const pl = { x: bx, y: by, dx: dn[0], dy: dn[1], ux: look.ux, uy: look.uy, d: dq, heat, spd: spd * (S.w.atm > 0 ? 1 : 0), t: now };
        MA.plasmaBack(F, pl);
        if (lit && (keys.up || keys.right || catching)) fire(-1);
        if (lit && (keys.up || keys.left || catching)) fire(1);
        A.shuttle(pc, dq, bx, top, S.G.S.Ls || 1, { cabin: true, rim: false, fold: look.fold, lean: look.lean });
        if (S.tileAt && S.clock - S.tileAt < 1.6) { const q = (S.clock - S.tileAt) / 1.6; F.tone(bx - look.ux * q * 160 + 6, by - look.uy * q * 160 - 8 + q * q * 30, RP.HULL, 0.7, 3, 2); }   // a heat tile torn off, tumbling back
        if (!o.release) MA.rattle(F, bx, by - 4 * dq, dq, clamp01(shakeK().amp / 4), now);
        MA.plasmaFront(F, pl);
        S.shAX = bx;
    }
    /** Round 3: does the find's light show from up here (life by day has none; the machines' only from 280 px over the deck). */
    const lightShows = () => lightVisible() && !(S.G.mark === 'machines' && S.e && S.e.a > 280) && !lightOut();
    /** How much the light's break is lit in the light's own colour (the machines' fades in over 0.4 s once they show). */
    function lightOnK() {
        if (!lightVisible() || lightOut()) return 0;
        if (S.G.mark === 'machines') return S.machinesAt == null ? 0 : clamp01((S.clock - S.machinesAt) / 0.4);
        return S.G.mark === 'flare' ? flareBurn() : 1;
    }
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 8. The one picture: sky, far air, the field under the deck, the deck, what tears past, the shuttle
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** The polish round, test only (off by default): the frame's work by part (LandingProto.timing), and parts left out (LandingProto.skip). */
    let tOn = false, tLast = 0;
    const tAcc = new Map(), skip = {};
    const tick = n => { if (!tOn) return; const t = performance.now(); if (!tAcc.has(n)) tAcc.set(n, []); tAcc.get(n).push(t - tLast); tLast = t; };
    function renderScene(now, o) {
        o = o || {};
        if (tOn && !o.probe) tLast = performance.now();
        const pc = o.pc || (o.into ? off() : ctx), G = S.G, E = S.E, M = S.M, w = S.w, e = S.e, F = P.framer(pc, FW, FH), falling = S.phase === 'fall' || S.phase === 'release';
        const cam = S.cam, d = cam.d, sk = shakeK(), probe = o.probe || null;
        const sh = o.into || probe ? [0, 0] : [Math.round((Math.random() - 0.5) * 2 * sk.amp), Math.round((Math.random() - 0.5) * 2 * sk.amp)];
        const toX = wx => (wx - cam.x) * d + sh[0], toY = wy => (wy - cam.y) * d + sh[1];
        const a = falling ? e.a : -9999, a01 = clamp01(a / e.a0), sw = shuttleWorld(), baseS = toY(G.cloudBase);
        if (falling && E.air && a <= ML.K.A_HAND && M && M.deep && M.deep.done) pc.drawImage(M.deep.canvas, 0, 0);   // the fix round: in the deck, the air down a shaft is dim, uneven, paler below (never a flat panel)
        else { pc.fillStyle = falling && E.air && a <= ML.K.A_HAND ? (E.cloud || RP.HAZE).hex[1] : P.INK; pc.fillRect(0, 0, FW, FH); }   // round 3: in the deck the clear air of a shaft is dim cloud-lit air, never a black void
        const V = falling ? (S.view = landView()) : null;
        if (V && !S.fieldOn && V.h <= ML.K.H1 && V.trueY <= V.Yg + 0.5) S.fieldOn = true;   // (the fix round: the field takes over once the camera's own ground row has come up to the far land's: no dip, no pop)
        const far = !!(V && !S.fieldOn);                                          // far: the land by the projection (else the field 1:1, as the landing draws it)
        const topS = a > 0 && V ? V.nearTop + sh[1] : toY(S.topY), night = G.tod === 'night' ? 0.62 : 1;
        const shX = sw ? toX(sw.x) : 0, shY = sw ? toY(sw.y + SH.BELL) : 0, v = sw ? sw.v : 0, ux = falling ? e.vx / (v || 1) : 0, uy = falling ? e.vy / (v || 1) : 1;
        let shown = false;
        // 1. while the deck's top is in the picture: the sky, the limb and the far sea (a thin band under the horizon)
        const hz = V ? V.hz : lerp(150, 236, Math.pow(a01, 0.75));
        if (topS > -40 && !skip.sky) {
            const sky = A.orbitSky(w.sector);
            if (!(w.atm > 0 && MA.skyAt(pc, M, Math.pow(1 - a01, 0.8)))) { pc.drawImage(sky.canvas, Math.round(sh[0] * 0.2), Math.round(sh[1] * 0.2)); P.twinkle(F, sky.stars, now); if (falling) hideSun(pc, sh); }   // the sky: the air thickens as we sink into it (the fix round: no false sun in the fall)
            MA.far(pc, E, { M, z: 1 - a01, hz, spread: 0.3 + 2.4 * Math.pow(a01, 1.4), scroll: S.flownX || 0, shake: sh });
            if (G.kindName === 'storm') A.stormFlash(F, now, hz);
        }
        if (!o.probe) tick('sky');
        // 2. the land: far below by the one projection (from the first frame), or under the deck the field 1:1
        if (far && !skip.land) S.landBox = ML.drawLand(pc, G, V, { shake: sh, probe, airless: !E.air, anchorY: S.anchorY, fieldOn: S.fieldOn, clipTop: e.deck > 0 && a <= 0 ? toY(S.topY) + DECK_CLIP : null });
        if (far && !skip.land && falling && E.air && e.deck > 0 && a <= 0 && S.landBox && !probe) airVeil(pc, G, V.Yg - VEIL_FOOT * V.sigL + sh[1], S.landBox.clipY);   // (the final fix round) its far hills veiled in the air
        const lift = S.landLift && S.landAt != null ? S.landLift * Math.exp(-(S.clock - S.landAt) / 0.12) : 0;   // (the fix round: if the hand-off came before the rows met, the field eases the last px)
        const fieldAt = () => { const Vg = G.V, ax = sw ? sw.x : cam.x + FW / 2 / d, ay = S.anchorY != null ? S.anchorY : S.groundY; /* pinned where the far land was, in the landing too (the fix round: no hop at the hand-off) */ return [Math.round(toX(ax) - (ax - Vg.ox) * D_LAND), Math.round(toY(ay) - (ay - Vg.oy) * D_LAND + lift)]; };
        if (baseS < FH + 4 && !far) {
            const [fx0, fy0] = fieldAt();                                         // the field 1:1, pinned at the ground under the shuttle (never resized)
            if (probe) { const mf = G.mainFar; if (mf && mf.lit) ML.keyed(pc, probe, c => c.drawImage(mf.lit, Math.round(fx0 + (mf.V.ox - G.V.ox) * D_LAND), fy0)); else { pc.fillStyle = probe; pc.fillRect(fx0, fy0, G.V.w, G.V.h); } }   // (the polish round: the land itself, by the far land's own sky-cut copy, never the field's sky)
            else { pc.save(); pc.setTransform(1, 0, 0, 1, fx0, fy0); drawField(pc, now, null, falling ? fallProxy() : null, true); pc.restore(); }
            const lp = LG.lightAt(G), lx = toX(lp.x), ly = toY(lp.y);
            shown = G.lightDrawn && lx > TOWER && lx < FW && ly > 0 && ly < FH;
            if (!E.air && baseS > -20) fadeTop(pc, fieldAt()[1]);                 // the field's own top, where it is drawn
            else if (e.deck > 0) ceilingIn(pc, M, baseS, falling && sw ? ceilK(sw) : 1);   // under the deck: its floor receding to the horizon (still dissolving in while we fall: the final fix round, no pop at the switch)
        } else if (far && e.deck > 0 && baseS < FH + 4 && sw) {                 // the deck's floor over the land far below (the fix round: never through a shaft from inside the deck; it dissolves in as we come out under it)
            ceilingIn(pc, M, baseS, ceilK(sw));
        }
        if (!o.probe) tick('land');
        // 3. the deck close: its floor, and from A_HAND over its top down its billows and body; the shafts through it
        const shafts = falling && V && E.air && e.deck > 0 ? litShafts(ML.shaftCols(V, S.breaks, cam), sh) : null;
        if (E.air && e.deck > 0 && baseS > -12 && !skip.deck) {
            MA.virga(F, baseS, cam.x * d - sh[0], now, E.cloud || A.mute(RP.DUST), E.airR || RP.ICE, 1);   // rain or snow hanging from the floor
            MA.deck(pc, E, M, { thin: falling && a <= 0 ? THIN_SHARE * e.deck * d : 0, fadeIn: falling && a > 0 && a <= ML.K.A_HAND ? 1 - a / ML.K.A_HAND : 1, top: topS, base: baseS, ox: cam.x * d - sh[0], oy: cam.y * d - sh[1], k: 1, t: now, shafts, near: !falling || a <= ML.K.A_HAND, night, glow: lightOnK() > 0.5 && lightShows() ? ML.LIGHT_RAMP[lightKind(G)] : null, glowAt: V ? [V.P.x + sh[0], V.P.y + sh[1]] : null, landTop: V && far ? V.Yg + (Math.min(S.groundY, S.lightPt.y + 2) - FADE_FULL - 10 - S.anchorY) * V.sigL + sh[1] : null });   // its pictures 1:1 (never resized); landTop: the land picture's own top (the mist inside a shaft thins out there)
        }
        if (!o.probe) tick('deck');
        // 4. above the deck: its top far below, torn (the cover), dissolving into the deck close over the last A_HAND px
        if (falling && a > 0 && E.air && !skip.cover) { const ms = ML.drawCover(pc, G.cover, V, { deckOx: (cam.x * d - sh[0]) * 0.95, deckOy: cam.y * d - sh[1], E, night, lightKind: lightKind(G), lightOn: lightOnK(), shake: sh, probe: !!probe, landTop: V.Yg + (Math.min(S.groundY, S.lightPt.y + 2) - FADE_FULL - S.anchorY) * V.sigL, landBox: far && !skip.land ? S.landBox : null }); if (!probe) S.passMs = ms; }
        if (!o.probe) tick('cover');
        // 5. the find's light, crisp: through its break, a smudge under the cover, a glow up through the deck when blind
        if (falling && far && !o.into && lightShows()) {
            const deck = e.deck > 0 && a <= 0, cl = deck ? (inShaftCol(shafts, V.P.x + sh[0], V.P.y + sh[1], topS, baseS) ? 0 : 0.85) : E.air && !ML.openAt(G.cover, V, V.P.x, V.P.y) ? 0.6 : 0;   // (the fix round: in the deck, clear when the light lies in a shaft as drawn)
            if (!probe && cl < 0.7 && !lightOut()) {                              // (the polish round) the find's light keeps a soft steady glow round it, larger with no air (there it is the only thing to aim at)
                const GL = ML.K.GLOW, air = !!E.air, faint = FAINT_LIGHT.includes(lightKind(G)), rad = 2 * Math.round((GL.R0 + GL.R1 * Math.sqrt(V.sL) + (air ? 0 : GL.AIRLESS_R) + (faint ? GL.FAINT_R : 0)) / 2), rp = ML.LIGHT_RAMP[lightKind(G)] || RP.RED, hc = MA.halo(rp, rad, (faint ? GL.FAINT_PEAK : air ? GL.PEAK : GL.AIRLESS_PEAK) * (cl > 0 ? GL.UNDER : 1));
                pc.drawImage(hc, Math.round(V.P.x + sh[0] - rad), Math.round(V.P.y + sh[1] - rad));
            }
            if (probe) S.lightOpenNow = cl === 0;
            else if (ML.drawLight(F, G, V, { now, night: G.tod === 'night', kind: lightKind(G), cloud: cl, out: lightOut(), burn: flareBurn(), shake: sh })) S.seaLight = true;
            const bq = S.phase === 'fall' && S.fallAt != null ? (S.clock - S.fallAt) / BLOOM_S : 1;   // the fix round: the find's light blooms once as the fall starts (the one warm point: look here)
            if (!probe && bq < 1 && cl < 0.5) MA.glowLit(F, Math.round(V.P.x + sh[0]), Math.round(V.P.y + sh[1]), Math.round(5 + 20 * Math.sqrt(bq)), ML.LIGHT_RAMP[lightKind(G)] || RP.RED, 0.85 * (1 - bq) * (1 - bq), 2);
        }
        if (falling && far && !o.into && !probe && E.air && a > 0 && !lightShows() && !lightOut()) {   // (the polish round) no light to aim at (life by day, the machines before they show): the gap itself glows a little in the air's own light, so the line matches what is on screen
            const GL = ML.K.GLOW, rad = 2 * Math.round((GL.R0 + 2 + 2 * GL.R1 * Math.sqrt(V.sL)) / 2);
            pc.drawImage(MA.halo(E.airR || RP.ICE, rad, GL.GAP), Math.round(V.P.x + sh[0] - rad), Math.round(V.P.y + sh[1] - rad));
        }
        if (falling && !o.into && G.kindName === 'storm' && topS < 0 && baseS >= FH - 10) A.stormFlash(F, now, 30);
        if (!falling && S.s && baseS < FH + 4) {                                 // after the hand-off: the shuttle (or the crew, or the wreck) in front of the sky
            { const [fx0, fy0] = fieldAt(); pc.save(); pc.setTransform(1, 0, 0, 1, fx0, fy0); drawFieldShuttle(pc, now, null); pc.restore(); }
        }
        if (!o.probe) tick('light');
        // 6. what drifts far behind us (above the deck), the air going by, the shuttle, what passes in front of it
        if (falling && sw && a > 0 && !skip.depth) drawDepth(pc, F, now, cam, sh, false, shX, shY, sw);
        if (!o.probe) tick('depthBack');
        if (falling && sw) {
            MA.streaks(pc, E, { sx: sw.x * d, sy: sw.y * d, ux: -ux, uy: -uy, v: v * d, n: Math.round((10 + 46 * smooth(40, V_FAST, v)) * (0.45 + 0.55 * clamp01(LF.rhoAt(Math.max(0, e.a)) * 2.2)) * (w.atm > 0 ? 1 : 0.35)), top: -999, spd: smooth(V_CALM, V_FAST, v), near: [shX, shY, clamp01((e.H + (S.hev || 0) - 40) / 60)] });
            if (!o.probe) tick('streaks');
            if (!o.noShuttle) drawFallShuttle(pc, shX, shY, d, fallLook(), now, { keys: S.keysNow || {}, shake: 0.6 + 1.6 * sk.heat + 0.8 * sk.spd });
            if (!o.probe) tick('shuttle');
            if (!o.into && !skip.depth) drawDepth(pc, F, now, cam, sh, true, shX, shY, sw);
            if (!o.probe) tick('depthFront');
        }
        S.lightDrawn = shown;                                                   // GAME: no hull beside the picture
    }
    let ceilC = null;
    /** The final fix round: the air's haze over the land's far part inside the deck, by its distance above its foot (y1, screen;
        the land's own ground less VEIL_FOOT px): heavier the higher, dithered in white noise (never a band of dots). Baked
        once a place (VEIL_H rows), drawn by its bottom rows only (the same falloff at any height). */
    function airVeil(pc, G, y1, clipY) {
        const E = G.E, Vc = E.veil;
        if (!Vc) { if (!E.veilQueued) { E.veilQueued = true; bakeVeil(E, G.tod === 'night' ? 0.62 : 1, G.tag); } return; }
        const yb = Math.round(y1), h = Math.min(VEIL_H, yb - Math.max(0, Math.floor(clipY)));
        if (h > 2) pc.drawImage(Vc, 0, VEIL_H - h, FW, h, 0, yb - h, FW, h);
    }
    /** (in VEIL_ROWS-row slices, one a queue slot: never a long job in the release or the fall; the last sets E.veil) */
    function bakeVeil(E, night, tag) {
        const c = document.createElement('canvas'); c.width = FW; c.height = VEIL_H;
        const g = c.getContext('2d'), r = E.airR || RP.ICE, top = r.rgb.length - 1;
        for (let y0 = 0; y0 < VEIL_H; y0 += VEIL_ROWS) A.later(() => {
            const img = g.createImageData(FW, VEIL_ROWS);
            for (let y = y0; y < y0 + VEIL_ROWS; y++) { const up = VEIL_H - 1 - y, al = VEIL_MAX * smooth(0, VEIL_RISE, up); for (let x = 0; x < FW; x++) { if (hash(x & 255, y & 255, 213) >= al) continue; const n = P.fbm(x / 60, y / 18, 219, 2), v = (0.2 + 0.1 * n) * night * top, lo = v | 0, k = Math.min(top, lo + (v - lo > P.threshold(x, y) ? 1 : 0)), rgb = r.rgb[k], i = ((y - y0) * FW + x) * 4; img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255; } }
            g.putImageData(img, 0, y0);
            if (y0 + VEIL_ROWS >= VEIL_H) E.veil = c;
        }, tag, true, 'air veil ' + y0);
    }
    /** The underside of the deck coming in as we come out under it (0..1): over the last CEIL_IN px of the deck and on to the
        hand-off (the final fix round: was 16 px, a pop of a third of the frame in two frames on a blind dive). */
    const ceilK = sw => clamp01((sw.y - (S.G.cloudBase - CEIL_IN)) / (CEIL_IN + Math.max(4, S.e ? S.e.under : 10)));
    function ceilingIn(pc, M, baseS, k) {
        if (k >= 1) { MA.ceiling(pc, M, baseS - 6, (S.horizonY - S.cam.y) * S.cam.d); return; }
        if (k > 0) { const t = ceilTmp(); t.clearRect(0, 0, FW, FH); MA.ceiling(t, M, baseS - 6, (S.horizonY - S.cam.y) * S.cam.d); A.dissolve(pc, t.canvas, k); }
    }
    const ceilTmp = () => { if (!ceilC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; ceilC = c.getContext('2d'); } return ceilC; };
    /** The shafts on screen (shaken), each wall lit on the side that faces the light's own shaft (the light's: both). */
    function litShafts(cols, sh) {
        const L = cols.find(q => q.kind === 'light');
        return cols.map(q => Object.assign(q, { cx: q.cx + sh[0], litSide: q.kind === 'light' || !L ? 0 : L.cx > q.cx ? 1 : -1 }));
    }
    /** Is screen point (x, y) in the clear air of one of these shafts (at its row's width)? */
    function inShaftCol(cols, x, y, top, base) {
        if (!cols) return false;
        const q = clamp01((y - top) / Math.max(60, base - top)), qq = q * q * (3 - 2 * q);
        return cols.some(s => Math.abs(x - s.cx) <= s.hwTop + (s.hwBot - s.hwTop) * qq);
    }
    /** An airless world's false sun is put out for the fall (the find's light is the one bright point). Baked once. */
    let sunC = null;
    function hideSun(pc, sh) {
        if (!A.LIGHT) return;
        if (!sunC) {
            const R = 30, c = document.createElement('canvas'); c.width = c.height = 2 * R;
            const g = c.getContext('2d'), img = g.createImageData(2 * R, 2 * R), ink = P.hexRgb(P.INK);
            for (let y = 0; y < 2 * R; y++) for (let x = 0; x < 2 * R; x++) { const k = 1 - smooth(10, R, Math.hypot(x - R, (y - R) * 1.1)); if (P.threshold(x, y) < k) { const i = (y * 2 * R + x) * 4; img.data[i] = ink[0]; img.data[i + 1] = ink[1]; img.data[i + 2] = ink[2]; img.data[i + 3] = 255; } }
            g.putImageData(img, 0, 0); sunC = c;
        }
        pc.drawImage(sunC, Math.round(A.LIGHT[0] - 30 + sh[0] * 0.2), Math.round(A.LIGHT[1] - 30 + sh[1] * 0.2));
    }
    /** What drifts at its own depth along the way down: the cloud torn past (rags on a lattice per depth: far ones slow and
        many, near ones big and quick, a front one crossing over the shuttle about once a second at speed), the deck's own
        rags inside it, the hulls and the storm's cells (front: after the shuttle). */
    const RAG_LAYERS = [
        { p: 0.2, cell: [220, 180], w: 30, prob: 0.5, max: 8 }, { p: 0.34, cell: [200, 160], w: 48, prob: 0.55, max: 8 }, { p: 0.55, cell: [270, 230], w: 90, prob: 0.5, max: 6 },
        { p: 1.6, cell: [520, 900], w: 120, prob: 0.25, max: 2, front: true }, { p: 2.4, cell: [760, 1500], w: 150, prob: 0.18, max: 2, front: true },   // in front: about one a second at speed
    ];
    function drawDepth(pc, F, now, cam, sh, front, shX, shY, sw) {
        const d = cam.d, e = S.e, v = Math.hypot(e.vx, e.vy);
        const at = (wx, wy, p) => [shX + (wx - sw.x) * d * p, shY + (wy - sw.y - SH.BELL) * d * p];
        const L = front ? ragFront : ragBack, R = { cloud: S.E.cloud || A.mute(RP.DUST), air: S.E.airR || RP.ICE, night: S.G.tod === 'night' ? 0.62 : 1 }, mx = -e.vx / (v || 1), my = -e.vy / (v || 1), litSide = (S.G.S.Ls || 1) < 0 ? -1 : 1;
        let any = false;
        L.clear();
        const inDeck = S.E.air && e.deck > 0 && sw.y > S.topY - 30 && sw.y < S.G.cloudBase + 4;
        if (inDeck) for (let j = Math.floor(sw.y / 16) - 4; j <= Math.floor(sw.y / 16) + 6; j++) {   // in the deck: its own rags, torn past
            const fr = hash(j & 255, 3, 77) < 0.4, p = fr ? 1.4 + hash(j & 255, 4, 77) : 0.4 + 0.5 * hash(j & 255, 5, 77);
            if (fr !== front) continue;
            const [x, y] = at(sw.x + (hash(j & 255, 6, 77) - 0.5) * 200 / (d * p), j * 16, p), w = fr ? 90 : 40;
            if (MA.rag(L, { x, y, len: Math.min(3 * w, w + 0.03 * v * d * p), w, ux: mx, uy: my, seed: 200 + (j & 255), front, cloud: R.cloud, air: R.air, night: R.night * 0.8, litSide })) any = true;
        }
        if (S.E.air && sw.y < S.topY + 4) RAG_LAYERS.forEach((Ly, li) => {           // above the deck: the air's own rags, more the thicker the air
            if (!!Ly.front !== front) return;
            const s = d * Ly.p, cw = Ly.cell[0] / (5 * Ly.p), ch = Ly.cell[1] / (5 * Ly.p);
            const i0 = Math.floor((sw.x + (-160 - shX) / s) / cw), i1 = Math.floor((sw.x + (FW + 160 - shX) / s) / cw);
            const j0 = Math.floor((sw.y + SH.BELL + (-240 - shY) / s) / ch), j1 = Math.floor((sw.y + SH.BELL + (FH + 240 - shY) / s) / ch);
            let n = 0;
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
                if (n >= Ly.max) return;                                     // (a safety cap: the lattice keeps them about that few)
                const seed = 31 + li * 53, h = hash(i & 255, j & 255, seed), wy = (j + 0.15 + 0.7 * hash(i & 255, j & 255, seed + 2)) * ch;
                const air = clamp01(0.3 + LF.rhoAt(Math.max(0, S.topY - wy)) * S.e.atm * 1.4);
                if (h > Ly.prob * air) continue;
                const wx = (i + 0.15 + 0.7 * hash(i & 255, j & 255, seed + 1)) * cw, [x, y] = at(wx, wy, Ly.p), w = Ly.w * (d / 5) * (0.7 + 0.6 * hash(i & 255, j & 255, seed + 3));
                if (MA.rag(L, { x, y, len: Math.min(3 * w, w + 0.03 * v * s), w, ux: mx, uy: my, seed: (i * 7 + j * 13) & 255, front, cloud: R.cloud, air: R.air, night: R.night, litSide })) { any = true; n++; S.wispsSeen++; }
            }
        });
        if (any) L.draw(pc);
        const hullAt = h => Math.max(24, Math.round(h.hl * d * h.p / 8) * 8);   // its size on screen, on a few steps (each baked once, drawn 1:1)
        if (!front) {
            S.hulls.forEach(h => { if (h.p >= 1) return; const [x, y] = at(h.wx, h.wy, h.p); if (x > -90 && x < FW + 90 && y > -90 && y < FH + 90) A.drawHull(pc, { x, y: y + Math.sin(now / 1700 + h.bob) * 3, len: hullAt(h), seed: h.seed, angle: h.angle, flip: h.flip, from: h.from, to: h.to }); });
            S.cells.forEach((c, i) => { const [x, y] = at(c.wx, c.wy, 1); if (x > -60 && x < FW + 60 && y > -60 && y < FH + 60) { F.glow(Math.round(x), Math.round(y - 10), Math.round(9 * d), A.R.LAMP, 0.16); A.stormCell(F, x, y, now + c.ph, S.cellsHit.has(i) && S.clock - (S.strikeAt || 0) < 0.4); } });
            return;
        }
        S.hulls.forEach(h => { if (h.p < 1) return; const [x, y] = at(h.wx, h.wy, 1); if (x > -120 && x < FW + 120 && y > -120 && y < FH + 120) A.drawHull(pc, { x, y, len: hullAt(h), seed: h.seed, angle: h.angle, flip: h.flip, from: h.from, to: h.to }); });
    }
    const ragBack = MA.dirtyLayer(FW, FH), ragFront = MA.dirtyLayer(FW, FH);   // (the polish round: only the rows they touch are put)
    /** An airless world: the field's own starry sky fades into the stars above it (no deck to hide the seam). Baked once. */
    let fadeC = null;
    function fadeTop(pc, y) {
        if (!fadeC) {
            const c = document.createElement('canvas'); c.width = FW; c.height = 26;
            const g = c.getContext('2d'), img = g.createImageData(FW, 26), ink = P.hexRgb(P.INK);
            for (let r = 0; r < 26; r++) { const k = 1 - r / 26; for (let x = 0; x < FW; x++) if (P.threshold(x, r) < k) { const i = (r * FW + x) * 4; img.data[i] = ink[0]; img.data[i + 1] = ink[1]; img.data[i + 2] = ink[2]; img.data[i + 3] = 255; } }
            g.putImageData(img, 0, 0); fadeC = c;
        }
        pc.drawImage(fadeC, 0, Math.round(y));
    }
    /** The fall's shuttle as the field sees it (its shadow, its dust): LanderGame's state shape. */
    function fallProxy() {
        const e = S.e, y = S.topY - e.a;
        return { x: e.x, y, vx: e.vx, vy: e.vy, grade: null, keys: { left: false, right: false }, isReleased: true, altitude: S.groundY - (y + I.LANDER_HALF + 3), fuel: e.fuel, hide: true };
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
            S.entry.caught = k > 0 && e.vy > 120; S.entry.helped = k > 0; S.entry.catchFuel = +pay.toFixed(1); S.catchAt = S.clock;
            S.jolt = 0.6 + 1.4 * smooth(FALL.CATCH_VY, 300, e.vy); if (e.vy > 120) { S.helmUntil = S.clock + HELM_S; S.talking = S.clock + 1.2; S.braceAt = S.clock; speak(LINES.brace(RUN.picked[0])); }   // a hard catch: a crew reaction, never "There's the light." 
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
    /** GAME: the level stretch nearest x with room (LanderGame's pickLevelTarget off the mark), its room held to SET_ROOM, so
        A.U.R.A. settles near its middle (never on the lip at its end). */
    function levelBy(x) {
        const all = siteFree(S.G, S.G.g.level || []), roomy = all.filter(l => l.room >= 4), pool = roomy.length ? roomy : all;
        const l = pool.reduce((b, q) => (!b || Math.abs(q.cx - x) < Math.abs(b.cx - x) ? q : b), null);
        return l ? Object.assign({}, l, { room: Math.min(l.room, SET_ROOM) }) : null;
    }
    /** GAME (the review): the level stretches cut to where the shuttle stands SITE_CLEAR px clear of the site's art (LanderSites'
        x0..x1: the dome, the ruins, the wreck), so A.U.R.A. never sets it down against them (a stretch the site stands over
        keeps its longer clear side); all of them as they were if none is clear. */
    function siteFree(G, list) {
        const st = G.siteKind && G.g.site;
        if (!st || !(st.x1 > st.x0)) return list;
        const a = st.x0 - SITE_CLEAR, b = st.x1 + SITE_CLEAR, clear = [];
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
            const hurt = RUN.hurt;                                               // GAME: one who is well (App.flyLanding), the one App.applyLanding hurts
            S.touch.hurt = hurt; S.touch.helper = hurt ? RUN.picked.find(id => id !== hurt) || null : null;   // GAME: a team of one, or nobody well: nobody says it
            S.crash = { hurt: hurt || RUN.picked[0], helper: S.touch.helper || RUN.picked[0], mild: !!(LC && LC.isMild && LC.isMild(G.planet)) };
            S.camFocus = LG.crashFocus(G, s);
            hideLine(S.lastLine); S.lines.light = true;                          // silence over the crash (the hurt line follows)
        } else S.crash = null;
        S.flown = Object.assign({}, S.flown || {}, { landAura: S.aura });
        if (grade !== 'crash' && !S.touch.slideV) { S.touch.settle = settleOf(s); if (S.touch.settle) S.jolt = Math.max(S.jolt || 0, 0.5); }   // GAME (the review): never left standing on a peak
        const mayHop = spotDistance() > LF.LAND.SPOT_PX && s.fuel >= LF.LAND.HOP_FUEL && !S.aura;
        if (grade !== 'crash' && !S.touch.slideV && !mayHop) { ensureSite(); const plan = walkPlan(performance.now()); S.camFocus = plan && plan.focus ? plan.focus : null; }
    }
    /** GAME (the review): a touchdown on a peak (the ground under both pads more than PERCH px below where it touched) or on a
        lip (one pad OVERHANG px or more over a drop) slides off it to the nearest place within SETTLE_X px, never higher, where
        both pads stand on the ground ({ x0, y0, x1, y1 }), else null. */
    function settleOf(s) {
        const h = S.G.g.heights, hot = S.G.g.hot, hAt = x => h[Math.max(0, Math.min(LG.W - 1, Math.round(x)))], pad = A.SH.PAD;
        const bad = x => { const top = groundUnder(x), l = hAt(x - pad) - top, r = hAt(x + pad) - top; return (l > PERCH && r > PERCH) || Math.max(l, r) >= OVERHANG; };
        if (!bad(s.x)) return null;
        const top0 = groundUnder(s.x);
        for (let k = 1; k <= SETTLE_X; k++) for (const x of [s.x - k, s.x + k]) {
            if (x < I.LANDER_HALF + 1 || x > LG.W - I.LANDER_HALF - 2 || bad(x) || hot[Math.round(x)] || groundUnder(x) > LG.H || groundUnder(x) < top0 - 1) continue;
            return { x0: s.x, y0: s.y, x1: x, y1: groundUnder(x) - LT_TALL };
        }
        return null;
    }
    function spotDistance() {
        const G = S.G, s = S.s, m = G.g.mark;
        if (G.mark === 'none' || !m) { const onLevel = (G.g.level || []).some(l => s.x >= l.c0 && s.x <= l.c1); if (onLevel) return 0; const l = LG.levelNear(G, s.x); return l ? Math.max(0, Math.abs(l.cx - s.x) - l.room) : 99; }
        return Math.abs(s.x - m.cx);
    }
    function afterTouch(dt) {
        const Tt = S.touch, s = S.s, since = S.clock - Tt.at;
        if (Tt.slideV && since < LF.LAND.ICE_SLIDE_S) { s.x += Tt.slideV * (1 - since / LF.LAND.ICE_SLIDE_S) * dt; return; }
        if (Tt.settle) {                                                          // GAME: off the peak (it tips and slides down onto its feet)
            const st = Tt.settle, q = clamp01(since / SETTLE_S), e = smooth(0, 1, q);
            s.x = lerp(st.x0, st.x1, e); s.y = lerp(st.y0, st.y1, e * e);
            if (q < 1) return;
            Tt.settle = null; Tt.x0 = s.x;
        }
        if (Tt.grade === 'crash') {
            if (!S.lines.hurt && since > 1.1) { S.lines.hurt = true; if (Tt.helper && Tt.hurt) speak(LINES.hurt(Tt.helper, Tt.hurt)); }   // GAME: a team of two only
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
        const line = Tt.grade === 'crash' ? (Tt.helper && Tt.hurt ? LINES.hurt(Tt.helper, Tt.hurt) : null) : LINES.result(Tt.grade, where, auraLanded, caught);
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

    // ── drawing the field (the place under the deck) ──
    function nozzlesOf(s) {
        const out = [], lit = !s.grade && s.fuel > 0;
        if (lit && s.keys.right) out.push([s.x - A.SH.PODS, s.y + A.SH.POD_Y]);
        if (lit && s.keys.left) out.push([s.x + A.SH.PODS, s.y + A.SH.POD_Y]);
        return out;
    }
    /** The place (and, after the hand-off, the shuttle on it) into c, in the picture's own art px. sFall: the fall's shuttle
        as the place sees it (its shadow only: the fall draws the shuttle itself). */
    const nozzlesNow = s => (S.catchAt != null && S.clock - S.catchAt < CATCH_FLAME_S && !s.grade ? [[s.x - A.SH.PODS, s.y + A.SH.POD_Y], [s.x + A.SH.PODS, s.y + A.SH.POD_Y]] : nozzlesOf(s));   // A.U.R.A.'s catch: both burn
    function drawField(c, now, pic, sFall) {
        const G = S.G, s = sFall || S.s, nz = sFall ? [] : nozzlesNow(s);
        LG.draw(c, G, s, now, { pic, nozzles: nz, flash: S.flash > 0, bolt: S.flash > 0 ? S.bolt : null, gust: S.gust, out: lightOut(), burn: flareBurn() });
        return G.lightDrawn;
    }
    /** The shuttle on the place after the hand-off (its flames, the crew walking out, the wreck): over the sky and the deck. */
    function drawFieldShuttle(c, now, pic) {
        const s = S.s, nz = nozzlesNow(s);
        LG.drawShuttle(c, S.G, s, now, { pic, nozzles: nz, brown: S.brown, sputter: sputterOf(s.fuel), crash: S.crash });
        if (!s.grade) S.shAX = (s.x - S.cam.x) * S.cam.d;
    }
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 11. The loop
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function update(dt) {
        S.clock += dt; S.t += dt;
        S.jolt = Math.max(0, (S.jolt || 0) - 3 * dt); S.hev = (S.hev || 0) * Math.exp(-FALL.HEAT_COOL * dt);
        if (S.voiceUntil && S.clock > S.voiceUntil) { say.classList.remove('is-in'); S.voiceUntil = 0; }
        if (S.phase === 'orbit') { goDown(); return; }                          // GAME: nothing to choose: down as soon as the bakes are ready
        if (S.phase === 'release') { stepRelease(); stepCam(dt); return; }
        if (S.phase === 'fall') { stepFall(dt); stepCam(dt); return; }
        if (S.phase === 'land') { stepLand(dt); stepCam(dt); return; }
        if (S.phase === 'walk') { stepLand(dt); stepCam(dt); return stepWalk(); }
        if (S.phase === 'result') { stepLand(dt); stepCam(dt); if (S.resultShowAt && S.clock >= S.resultShowAt) { S.resultShowAt = 0; showResult(); } if (S.doneAt && S.clock >= S.doneAt) end(S.result); }   // GAME: then the game goes on
    }
    function render(now) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
        if (S.phase === 'orbit' || S.phase === 'boot') { drawOrbit(now); warmPics(); }
        else if (S.phase === 'release') { drawRelease(now); warmPics(); }   // GAME (the review): a place the bridge warmed is ready at once (the orbit is one frame), so its pictures' first draws go in the release, never in the fall
        else renderScene(now);
        if (tOn) tLast = performance.now();
        WD.shadeUnder(ctx, [say.classList.contains('is-in') ? say : null, keysEl, auraEl], FR, K, FW, FH);   // GAME: no tower drawn after it
        tick('shade');
    }
    /** The final fix round: the tags the release may bake (this landing's field, its deck and air, the globe it leaves, the
        reveal and the fall's tables). */
    function releaseTags() {
        const G = S.G, k = G.key + ':' + S.w.id;
        if (S.relTags && S.relTags.k === k) return S.relTags.set;
        const set = new Set([G.tag, G.M && G.M.tag, G.E && G.E.tag, 'release', 'drift'].concat(RELEASE_R.map(r => 'globe:' + S.w.id + ':' + r)).filter(Boolean));
        S.relTags = { k, set };
        return set;
    }
    /** The final fix round: the next landing's land pictures, each drawn once (1 px, under the tower) while the orbit shows:
        a picture's first draw is the costly one (its upload), and it must never fall in the fall. One a frame. */
    const warmed = new WeakSet();
    function warmPics() {
        const G = RUN.urgentG;
        if (!G || !G.ladder) return;
        const pics = G.ladder.map(L => L.pic).concat([G.mainFar, G.main]);
        for (const p of pics) {
            if (!p || !p.done) continue;
            for (const c of [p.lit, p.dark]) if (c && !warmed.has(c)) { warmed.add(c); ctx.drawImage(c, 0, 0, 1, 1); ctx.fillStyle = P.INK; ctx.fillRect(0, 0, 1, 1); return; }   // GAME: no tower over that pixel: inked again
        }
    }
    const FRAME_BUDGET_MS = 10, WAIT_BUDGET_MS = 40, STARVED_FRAMES = 4;
    let last = 0, starved = 0, bootAt = 0, prev = { work: 0, what: '', phase: '' }, holdA = null;
    let live = false, raf = null, errs = 0;                                  // GAME: one landing at a time; FrameClock (it still ticks in a hidden tab)
    /** GAME (the review): the frame has failed ERR_FRAMES times in a row: the landing ends (never a frozen picture with no way on).
        Before the touchdown LanderGame takes it (App.flyLanding); after it, what this landing came to (or A.U.R.A.'s, as a skip). */
    function giveUp() {
        errs = 0;
        let r = S.result || null;
        if (!r && S.touch) { try { finish(); r = S.result || null; } catch (err) { console.error('Meteor: the result failed', err); } }
        end(S.touch ? r || autoResult(RUN.opts) : { fallback: true });
    }
    function frame(now) {
        if (!live) return;
        raf = window.FrameClock ? window.FrameClock.request(frame) : requestAnimationFrame(frame);
        const gap = last ? now - last : 0, t0 = performance.now();
        last = now;
        const dt = Math.min(0.05, (S.lastStep ? now - S.lastStep : 16) / 1000);
        S.lastStep = now;
        const held0 = holdA != null && S.phase === 'fall' && S.e && S.e.a <= holdA;   // (test only: LandingProto.hold, the fall stopped at a height)
        try { if (tOn) tLast = performance.now(); if (!held0) update(dt); if (!live) return; tick('update'); render(now); errs = 0; } catch (e) { console.error('Meteor:', e); if (++errs >= ERR_FRAMES) { giveUp(); return; } }   // GAME: the landing may have ended in update()
        const used = performance.now() - t0;
        let what = 'render ' + used.toFixed(1), n = 0;
        const budget = S.waitDown ? WAIT_BUDGET_MS : FRAME_BUDGET_MS, falling = S.phase === 'fall';   // (the polish round: the fall runs only its own bakes, in budget; the rest waits for the landing)
        if (falling) { if (S.G && used < budget - 3 && A.pending(S.G.tag) > 0) n = A.idle(budget - 2 - used, true, S.G.tag); }
        else if (S.phase === 'release' && S.G) { if (used < budget - 3) n = A.idle(budget - 2 - used, true, releaseTags()); }   // (the final fix round: the release runs only this landing's own bakes, never the last world's)
        else if (used < budget - 1) n = A.idle(budget - used, true);
        else if (++starved >= STARVED_FRAMES) n = A.idle(0);
        if (n) { starved = 0; what += ' + idle ' + n + ' ' + A.lastTag(); }
        if (now - bootAt > 1000 && gap) WD.frameStats.push(gap, prev.work, prev.phase || S.phase, prev.what);
        prev = { work: performance.now() - t0, what, phase: S.phase };
        if (S.phase === 'fall' && S.passMs) { passLog.push(S.passMs); if (passLog.length > 4000) passLog.shift(); }
        if (probeOn && (S.phase === 'fall' || S.phase === 'release' || S.phase === 'land')) { try { probeFrame(); } catch (err) { console.error('Meteor probe:', err); } }
        if (capA.length && S.phase === 'fall' && S.e && S.e.a <= capA[0]) { const want = capA.shift(); capOut.push({ a: want, at: +S.e.a.toFixed(1), url: art.toDataURL(), probe: probeOn && probeC ? probeC.canvas.toDataURL() : null }); }   // (test only: the picture at these heights, and the probe's)
        if (S.phase !== S.seenPhase) { S.seenPhase = S.phase; S.phaseChangedAt = S.clock; if (S.phase === 'release') S.phaseAt = {}; if (S.phaseAt && S.phaseAt[S.phase] == null) S.phaseAt[S.phase] = +(S.clock - (S.releaseAt || 0)).toFixed(2); }
    }
    // ── round 3, probe mode only (off by default): the land's share of the picture, frame by frame ──
    let probeOn = false, probeC = null, lastPx = null;
    const capA = [], capOut = [];
    const probeLog = [], passLog = [];
    function probeFrame() {
        if (!probeC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; probeC = c.getContext('2d', { willReadFrequently: true }); probeC.imageSmoothingEnabled = false; }
        const keep = { lightDrawn: S.lightDrawn, wispsSeen: S.wispsSeen, seaLight: S.seaLight, passMs: S.passMs, gl: S.G.lightDrawn, landBox: S.landBox };
        S.lightOpenNow = null;
        renderScene(performance.now(), { pc: probeC, probe: '#ff00ff' });
        Object.assign(S, { lightDrawn: keep.lightDrawn, wispsSeen: keep.wispsSeen, seaLight: keep.seaLight, passMs: keep.passMs, landBox: keep.landBox }); S.G.lightDrawn = keep.gl;
        const px = probeC.getImageData(TOWER, 0, FW - TOWER, FH).data;
        let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] === 255 && px[i + 1] === 0 && px[i + 2] === 255) n++;
        if (!probeC.copy) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; probeC.copy = c.getContext('2d', { willReadFrequently: true }); }
        probeC.copy.drawImage(art, 0, 0);
        const cur = probeC.copy.getImageData(TOWER, 0, FW - TOWER, FH).data;
        let changed = 0;
        if (lastPx) for (let i = 0; i < cur.length; i += 4) if (Math.max(Math.abs(cur[i] - lastPx[i]), Math.abs(cur[i + 1] - lastPx[i + 1]), Math.abs(cur[i + 2] - lastPx[i + 2])) > 48) changed++;
        lastPx = cur;
        const V = S.view, tot = (FW - TOWER) * FH;
        probeLog.push({ t: +(S.clock - (S.releaseAt || 0)).toFixed(3), ft: S.phase === 'fall' ? +(S.clock - S.fallAt).toFixed(3) : null, phase: S.phase, h: V ? +V.h.toFixed(1) : null, a: V ? +V.a.toFixed(1) : null, sL: V ? +V.sL.toFixed(4) : null, sC: V ? +V.sC.toFixed(4) : null,
            P: V ? [+V.P.x.toFixed(1), +V.P.y.toFixed(1)] : null, nearTop: V ? +V.nearTop.toFixed(1) : null, hz: V ? +V.hz.toFixed(1) : null, step: V ? V.step : null, landPx: n, landFrac: +(100 * n / tot).toFixed(2), lightOpen: S.lightOpenNow, passMs: +(S.passMs || 0).toFixed(2),
            diff: +(100 * changed / tot).toFixed(1), topTrue: S.e ? +((S.topY - S.cam.y) * S.cam.d).toFixed(1) : null, L: V && S.breaks ? (() => { const b = S.breaks[0], x = V.shX + (b.x - V.xA) * V.sigC, y = V.Yg + b.v * V.sigC; return [+x.toFixed(1), +y.toFixed(1), +(2 * b.R * V.sigC).toFixed(1)]; })() : null,
            inShaft: S.inShaft ? S.inShaft.kind : null, land: S.landBox ? S.landBox.k : null, field: !!S.fieldOn, m: V ? +V.m.toFixed(3) : null, trueY: V ? +V.trueY.toFixed(1) : null, Yg: V ? +V.Yg.toFixed(1) : null });
        if (probeLog.length > 6000) probeLog.shift();
    }
    function stateNow() {
        const e = S.e, s = S.s;
        return {
            L: RUN.L, world: S.w ? S.w.id : null, find: S.f ? S.f.kind : null, picked: RUN.picked.slice(), aura: !!S.aura, line: say && say.classList.contains('is-in') ? S.lastLine : null,   // GAME
            ready: S.G0 ? readyToGo(S.w, S.G0) : false, first: RUN.first, routine: !RUN.full, carried: RUN.carried, mark: (S.G || {}).mark, tod: (S.G || {}).tod, lightDrawn: !!S.lightDrawn, full: !!S.full,
            fall: e ? { t: +e.t.toFixed(2), a: +e.a.toFixed(0), vx: +e.vx.toFixed(1), vy: +e.vy.toFixed(1), H: +e.H.toFixed(1), fuel: +e.fuel.toFixed(1), pull: +e.pull.toFixed(2), scorch: e.scorch, burnt: e.burnt, dx: +(S.lightX - e.x).toFixed(0) } : null,
            cam: { d: +S.cam.d.toFixed(3), x: +S.cam.x.toFixed(1), y: +S.cam.y.toFixed(1) }, bell: S.bellNow ? S.bellNow.map(v => +v.toFixed(1)) : null, under: S.e ? +S.e.under.toFixed(1) : null,
            land: s ? { x: +s.x.toFixed(1), y: +s.y.toFixed(1), vx: +s.vx.toFixed(1), vy: +s.vy.toFixed(1), fuel: +s.fuel.toFixed(1), alt: +(s.altitude || 0).toFixed(1), grade: s.grade || null, wind: S.G ? S.G.g.wind : 0, t: +(S.clock - (S.landAt || S.clock)).toFixed(2) } : null,
            phaseT: +(S.clock - ({ release: S.releaseAt, fall: S.fallAt, land: S.landAt, walk: S.walkAt, result: S.resultAt }[S.phase] || S.clock)).toFixed(2),
            entryEnd: S.entry || null, result: S.result || null, rare: S.rare || null, pending: A.pending(), words: wordsOnScreen(), helm: S.clock < (S.helmUntil || 0), keysHeld: held.size, energy: RUN.energy,
            phaseAt: S.phaseAt || null, waitDown: !!S.waitDown, reserve: !!S.reserve, strikes: S.cellsHit ? S.cellsHit.size : 0, cells: S.cells ? S.cells.length : 0, hulls: S.hulls ? S.hulls.length : 0, wisps: S.wisps ? S.wisps.length : 0,
            landView: S.view && (S.phase === 'fall' || S.phase === 'release') ? { h: +S.view.h.toFixed(1), a: +S.view.a.toFixed(1), sL: +S.view.sL.toFixed(4), sC: +S.view.sC.toFixed(4), g: +S.view.g.toFixed(3), D: +S.view.D.toFixed(1), P: { x: +S.view.P.x.toFixed(1), y: +S.view.P.y.toFixed(1) }, Yg: +S.view.Yg.toFixed(1), nearTop: +S.view.nearTop.toFixed(1), hz: +S.view.hz.toFixed(1), step: S.view.step, through: S.through === undefined ? 'n/a' : S.through, inShaft: S.inShaft ? S.inShaft.kind : null, passMs: +(S.passMs || 0).toFixed(2), eps: S.eps, m: +S.view.m.toFixed(3), err: +S.view.err.toFixed(1), trueY: +S.view.trueY.toFixed(1), fieldOn: !!S.fieldOn } : null,
            wispsSeen: S.wispsSeen || 0, keysShown: !!(keysEl && !keysEl.hidden), auraShown: !!(auraEl && !auraEl.hidden), waited: S.waitAt != null ? +(S.clock - S.waitAt).toFixed(2) : null, saidWait: !!S.saidWait,   // GAME cloudBase: S.G ? S.G.cloudBase : null, groundY: S.groundY || null,
        };
    }
    function wordsOnScreen() { if (!say) return 0; return [say.classList.contains('is-in') ? $('who-name').textContent + ' ' + $('line').textContent : '', keysEl.hidden ? '' : keysEl.textContent, auraEl.hidden ? '' : auraEl.textContent].join(' ').trim().split(/\s+/).filter(w => /\w/.test(w)).length; }   // GAME: the voice, the keycaps, A.U.R.A.'s

    // ── wiring ──
    function artPoint(e) { const r = art.getBoundingClientRect(); return { ax: (e.clientX - r.left) / K, ay: (e.clientY - r.top) / K }; }
    /** A.U.R.A. takes the rest: the fall and the landing (once; never after touchdown). In the landing she brings 15 fuel. */
    function auraFlies() {
        if (S.aura || !(S.phase === 'fall' || S.phase === 'land')) return;
        if (S.phase === 'land' && (!S.s || S.s.grade)) return;
        S.aura = true; S.auraUsed = true; S.auraKeys = null;
        if (S.phase === 'land') { S.s.fuel += LF.LAND.AURA_FUEL; S.s.isAuto = true; S.s.autoTarget = null; }   // GAME: to the mark when one is marked (LanderGame's autopilot)
        showKeys(false); showAura(false);
    }
    const clearPointer = () => { if (pointer) pointer.down = false; pointer = null; };
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 12. GAME: the stage, the input, mount (MiniHost 'land-fall'), the warm-up on the bridge, the registration
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // the stage: the sketch's frame, art canvas and words (index.html), ids prefixed 'land-'; static markup only (the words go
    // in through textContent). A.U.R.A.'s keycap is a button nobody can focus: Space never presses it, and its pointerdown
    // never counts as a hold
    const STAGE_HTML = '<div id="land-frame" class="land-frame"><canvas id="land-art" class="land-art" width="640" height="360" aria-hidden="true"></canvas>'
        + '<div id="land-words" class="land-words">'
        + '<div class="voice" id="land-say" aria-live="polite"><div class="film-line"><img class="face" id="land-face" alt="" hidden><div class="text">'
        + '<p class="who" id="land-who"><span class="ring" id="land-who-ring" hidden></span><span id="land-who-name"></span></p><p class="say" id="land-line"></p></div></div></div>'
        + '<div id="land-keys" class="land-keys" hidden><span class="key-pair"><kbd>Space</kbd><span class="key-word" id="land-key-hold"></span></span>'
        + '<span class="key-pair"><kbd>&larr;</kbd><kbd>&rarr;</kbd><span class="key-word" id="land-key-steer"></span></span></div>'
        + '<button type="button" id="land-aura" class="land-aura" tabindex="-1" hidden><kbd>H</kbd><span id="land-aura-word"></span></button>'
        + '</div></div>';
    // the frame's rules (MiniHost frameClass 'is-land'): the overlay is the stage, edge to edge, ink, no blur and no MiniHost
    // frame; the sketch's tokens and its #say, #keys and kbd rules, and the parts of reading.css the voice uses, all scoped
    // to the stage. In the page from the moment this file loads, as the dock's (DockFlight.js dockStyle)
    (function landStyle() {
        if (document.getElementById('land-fall-style')) return;
        const st = document.createElement('style'); st.id = 'land-fall-style';
        st.textContent = [
            '.mini-host.is-land { padding: 0; overflow: hidden; background: #05070a; -webkit-backdrop-filter: none; backdrop-filter: none; }',
            '.mini-host.is-land .mini-frame { display: none; }',
            '.land-stage { position: absolute; inset: 0; overflow: hidden; outline: none; touch-action: none; background: #05070a; user-select: none; -webkit-user-select: none; color-scheme: dark;',
            '  --t: 1; --px: 3px; --k: 3; --ink: #05070a; --text: #e4e4e0; --dim: #8b8d90; --faint: #5a6168; --ui: #c9d1d6; --warm: #f08c2e; --warm-br: #ffc27a; --danger: #e0453a;',
            "  --f-ui: 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; --f-text: 'IBM Plex Sans', system-ui, sans-serif; --f-num: 'IBM Plex Mono', ui-monospace, Consolas, monospace;",
            '  --fs-voice: calc(18px + 4px * var(--t)); --fs-who: calc(13px + 1px * var(--t)); --measure: calc(470px + 150px * var(--t)); --fs-hint: calc(14px + 1px * var(--t));',
            '  --shadow: 0 1px 0 #05070a; --ease: cubic-bezier(0.2, 0.7, 0.2, 1);',
            '  color: var(--text); font: 400 15px/1.4 var(--f-text); -webkit-font-smoothing: antialiased; }',
            '.land-stage p { margin: 0; }',
            '.land-stage .land-frame { position: absolute; overflow: hidden; }',
            '.land-stage .land-art { position: absolute; left: 0; top: 0; display: block; image-rendering: pixelated; image-rendering: crisp-edges; }',
            '.land-stage .land-words { position: absolute; inset: 0; pointer-events: none; }',
            '.land-stage .land-words > * { position: absolute; }',
            '.land-stage .tone-cora { --tone: #f2e2c4; } .land-stage .tone-jaxon { --tone: #f08c2e; } .land-stage .tone-vance { --tone: #c4622a; }',
            '.land-stage .tone-aris { --tone: #ffc27a; } .land-stage .tone-mira { --tone: #e8836a; } .land-stage .tone-aura { --tone: var(--ui); }',
            '.land-stage .voice { left: 0; top: 0; display: grid; gap: 6px; width: max-content; max-width: var(--measure); text-shadow: var(--shadow); pointer-events: none; opacity: 0; transition: opacity 160ms var(--ease); }',
            '.land-stage .voice.is-in { opacity: 1; }',
            '.land-stage .who { display: flex; align-items: center; gap: 8px; margin: 0; font: 500 var(--fs-who)/1 var(--f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: var(--tone, var(--warm)); }',
            '.land-stage .who .ring { flex: none; width: 0.82em; height: 0.82em; border: 1px solid currentColor; border-radius: 50%; }',
            '.land-stage .say { margin: 0; font: 400 var(--fs-voice)/1.36 var(--f-text); color: var(--text); text-wrap: pretty; }',
            '.land-stage .film-line { display: grid; grid-template-columns: var(--face) minmax(0, 1fr); gap: 0 18px; align-items: start; }',
            '.land-stage .film-line.is-narr { grid-template-columns: minmax(0, 1fr); }',
            '.land-stage .film-line .text { display: grid; gap: 7px; padding-top: 2px; }',
            '.land-stage .face { position: static; display: block; width: var(--face); height: var(--face); image-rendering: auto; background: var(--ink); border-radius: 0; filter: saturate(0.9); }',
            '.land-stage .face[hidden], .land-stage .who .ring[hidden], .land-stage .land-keys[hidden], .land-stage .land-aura[hidden] { display: none; }',
            '.land-stage #land-say { --face: calc(var(--k) * 20px); max-width: min(calc(560px + 160px * var(--t)), 70%); }',
            '.land-stage .land-keys { display: flex; gap: 26px; pointer-events: none; align-items: center; }',
            '.land-stage .land-keys .key-pair { display: inline-flex; gap: 6px; align-items: center; }',
            '.land-stage .key-word { font: 400 var(--fs-hint)/1 var(--f-text); color: var(--text); text-shadow: var(--shadow); margin-left: 4px; }',
            '.land-stage kbd { min-width: 2.2em; padding: 3px 7px; border: 1px solid #33373e; border-radius: 3px; background: rgba(5, 7, 10, 0.55); font: 400 13px/1.2 var(--f-num); color: var(--ui); text-align: center; }',
            '.land-stage .land-aura { display: inline-flex; align-items: center; gap: 9px; padding: 0; margin: 0; background: none; border: 0; cursor: pointer; pointer-events: auto; font: 400 var(--fs-hint)/1 var(--f-text); color: var(--dim); text-shadow: var(--shadow); transition: color 140ms var(--ease); }',
            '.land-stage .land-aura:hover { color: var(--text); }',
            '.land-stage .land-aura:active { color: var(--warm-br); }',
            '@media (prefers-reduced-motion: reduce) { .land-stage .voice, .land-stage .land-aura { transition: none; } }',
        ].join('\n');
        document.head.appendChild(st);
    })();

    let finishFn = null, rt = 0;
    /** Hand the result to the game (MiniHost runs cleanup, fades the overlay out and resolves App.flyLanding). Once. */
    function end(result) {
        if (!finishFn) return;
        const f = finishFn;
        finishFn = null;
        f(result);
    }
    /** After the touchdown (SKIP_AFTER_S on) a click, Enter, Space or Esc goes on at once (LanderGame's skip): in the walk-out,
        on the result, or in a crash once its line is due. Never in the hop's moment (a click there hops). */
    function canGoOn() {
        if (!S.touch || S.clock - S.touch.at < SKIP_AFTER_S) return false;
        return S.phase === 'walk' || S.phase === 'result' || (S.phase === 'land' && S.touch.grade === 'crash' && S.clock - S.touch.at > 1.1);
    }
    function goOn() { if (S.phase !== 'result') finish(); end(S.result); }

    // ── the input (the sketch's, on the stage; the keys through MiniHost's trap: MiniLab.onKey, and a capture listener for
    // their release) ──
    const FLY = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW'];
    function onPointerDown(e) {
        const p = artPoint(e);
        if (S.phase === 'release') skipRelease();                                // (then held on: it pulls up)
        if (canGoOn()) { goOn(); return; }
        if (S.phase === 'land' && S.touch) S.fresh = true;
        if (['fall', 'land'].includes(S.phase)) { pointer = Object.assign(p, { down: true, fly: true, cx0: e.clientX, cy0: e.clientY, dragged: false }); try { stage.setPointerCapture(e.pointerId); } catch (err) { /* no capture: still flies */ } }
    }
    function onPointerMove(e) { if (pointer && pointer.down) { Object.assign(pointer, artPoint(e)); if (Math.hypot(e.clientX - pointer.cx0, e.clientY - pointer.cy0) > DRAG_PX) pointer.dragged = true; } }
    function onAuraDown(e) { e.stopPropagation(); e.preventDefault(); auraFlies(); }
    function onKeyDown(k, e) {
        const c = e.code;
        if (FLY.includes(c) || c === 'Enter') e.preventDefault();
        if (FLY.includes(c) && !e.repeat) held.add(c);                          // a fresh press only: a key held from before never counts
        if (e.repeat) return;
        if (S.clock - (S.phaseChangedAt == null ? -9 : S.phaseChangedAt) < PHASE_KEY_S) return;   // a press as the phase changed does not also act on the next
        if (S.phase === 'release') { skipRelease(); return; }
        if ((c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || c === 'Escape') && canGoOn()) { goOn(); return; }
        if (S.phase === 'land' && S.touch && FLY.includes(c)) S.fresh = true;
        if (c === 'KeyH') auraFlies();
    }
    const onKeyUp = e => held.delete(e.code);
    const onBlur = () => { held.clear(); clearPointer(); };
    function onResize() {
        clearTimeout(rt);
        rt = setTimeout(() => { if (!live) return; fit(); if (say.classList.contains('is-in')) place(say, TOWER + 18, 16); if (!keysEl.hidden) showKeys(true); if (!auraEl.hidden) showAura(true); WD.shadeReset(); }, 120);
    }

    // ── mount: one landing (App.flyLanding's opts: the contract is there) ──
    // GAME (the review): the frame rules hide MiniHost's own way out ("This would not start" and Continue), so mount never
    // throws: anything that fails in it hands the landing to LanderGame (App.flyLanding), and cleanup lets go of what was set
    function mount(ctx0, ui, opts) {
        finishFn = ui.finish;
        errs = 0;
        try { return start(ui, opts || {}); } catch (err) {
            console.error('LandFall: the landing could not start', err);
            live = false;
            setTimeout(() => end({ fallback: true }), 0);
            return cleanup;
        }
    }
    function start(ui, o) {
        const host = (ui.canvas && ui.canvas.closest('.mini-host')) || document.body;
        root = document.createElement('div');
        root.className = 'land-stage'; root.tabIndex = -1;
        root.innerHTML = STAGE_HTML;
        host.appendChild(root);
        stage = root; frameEl = $('frame'); art = $('art'); ctx = art.getContext('2d'); say = $('say'); keysEl = $('keys'); auraEl = $('aura');
        $('key-hold').textContent = WD.KEY_WORDS.hold; $('key-steer').textContent = WD.KEY_WORDS.steer; $('aura-word').textContent = WD.KEY_WORDS.aura;
        fit(); WD.prepFaces(); WD.shadeReset();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => WD.shadeReset());
        // the run: the game's
        const team = (Array.isArray(o.team) ? o.team : []).filter(m => m && m.id), well = team.filter(m => m.status === 'HEALTHY');
        const c = o.carried && ['soft', 'rough', 'crash'].includes(o.carried.grade) ? Object.assign({}, o.carried) : null;
        Object.assign(RUN, { L: (Number.isFinite(o.drops) ? Math.max(0, Math.floor(o.drops)) : 0) + 1, energy: Number.isFinite(o.energy) ? o.energy : 60,
            picked: team.map(m => m.id), colors: team.map(m => m.color || '#f08c2e'), aboard: Array.isArray(o.aboard) ? o.aboard.slice() : [],
            first: !!o.first, full: o.full !== false, carried: o.full !== false ? null : c, jaxon: !!o.jaxon, unmarked: o.unmarked || null,
            hurt: well.length ? well[Math.floor(Math.random() * well.length)].id : null, landings: [], opts: o });
        Object.keys(S).forEach(k => { delete S[k]; });
        Object.assign(S, { phase: 'orbit', t: 0, clock: 0, cam: { x: 0, y: 0, d: D_LAND }, lines: {}, waitAt: null });
        held.clear(); pointer = null;
        S.w = LW.worldOf(o.planet, o.sector); S.f = LW.findOf(S.w, o.find, { unmarked: RUN.unmarked, risk: o.risk });
        warmKey = null;                                                          // (the warm-up's place is this one, or let go here)
        S.G0 = fieldFor(S.w, S.f, { site: o.site, wreck: o.wreck });
        A.orbitSky(S.w.sector);
        RELEASE_R.forEach(r => A.globe(S.w, r));
        if (S.G0) urgent(S.G0);
        MiniLab.onKey(onKeyDown);
        window.addEventListener('keyup', onKeyUp, true); window.addEventListener('blur', onBlur); window.addEventListener('resize', onResize);
        stage.addEventListener('pointerdown', onPointerDown); stage.addEventListener('pointermove', onPointerMove);
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => stage.addEventListener(t, clearPointer));
        auraEl.addEventListener('pointerdown', onAuraDown);
        live = true; last = 0; starved = 0; prev = { work: 0, what: '', phase: '' }; bootAt = performance.now();
        WD.frameStats.reset();
        try { stage.focus({ preventScroll: true }); } catch (err) { stage.focus(); }
        if (!S.G0) { setTimeout(() => end({ fallback: true }), 0); return cleanup; }   // no ground could be made: LanderGame
        raf = window.FrameClock ? window.FrameClock.request(frame) : requestAnimationFrame(frame);
        return cleanup;
    }
    /** MiniHost closes the frame: stop, let go of the listeners and of this place's bakes. The stage stays in the overlay until
        MiniHost removes it after its fade (the last picture fades to the bridge, never to black). */
    function cleanup() {
        live = false;
        if (raf != null) { (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(raf); raf = null; }
        clearTimeout(rt);
        window.removeEventListener('keyup', onKeyUp, true); window.removeEventListener('blur', onBlur); window.removeEventListener('resize', onResize);
        held.clear(); pointer = null; finishFn = null;
        setTimeout(() => { if (!live && warmKey == null) freePlace(null); }, FREE_AFTER_MS);   // GAME (the review): after the fade back to the bridge (the warm-up, if it has begun, lets go itself)
        root = null; stage = frameEl = art = ctx = say = keysEl = auraEl = null;
        Object.keys(S).forEach(k => { delete S[k]; });
        Object.assign(S, { phase: 'orbit', t: 0, clock: 0, cam: { x: 0, y: 0, d: D_LAND } });
    }
    /** Let go of the places held (their land's sizes, their queued bakes) and every world's globes, entry and deck bakes but
        keepWorld's (the warm-up moving to another find on the same world keeps them). */
    const touched = new Set();
    function freePlace(keepWorld) {
        fields.forEach(G => { touched.add(G.world.id); if (LG.freeLadder) LG.freeLadder(G); if (G.tag) A.drop(G.tag); });
        fields.clear();
        touched.forEach(id => { if (id === keepWorld) return; MA.forget(id); A.forget(id); touched.delete(id); });
        A.drop('release'); A.drop('drift');
        RUN.urgentG = null;
        warmSeen.clear();
    }

    /** A skip (TEST_MODE, or MiniHost's "This would not start" and Continue): A.U.R.A.'s landing with nothing measured, as
        LanderGame's own fallback; a routine drop's carried grade. */
    function autoResult(opts) {
        const o = opts || {}, c = o.full === false && o.carried ? o.carried : null;
        return { grade: c ? c.grade : 'rough', raw: c ? c.raw || c.grade : 'rough', auto: c ? !!c.auto : true, lifted: !!(c && c.lifted), offMark: false, marked: !o.unmarked, hurt: null, routine: o.full === false, skipped: true };
    }

    // ── the warm-up: while the bridge idles at a stop, the place GO DOWN would take the team to is prepared and baked, at most
    // WARM_MS at a time in the browser's idle time (as DockFlight.warm), so the landing seldom waits. Every WARM_EVERY_MS it
    // reads where GO DOWN goes now (NSWorldFinds.target, or the blind trip's) and prepares again only when that changes
    // (the last place's land sizes let go). Left at a stop ('stop:hidden'): everything let go (forget). ──
    const WARM_MS = 8, WARM_EVERY_MS = 500;
    let warmT = null, warmKey = null, warmIdle = false;
    function warmTarget(app) {
        const s = app && app.state, node = s && s.currentSystem, F = window.NSWorldFinds;
        if (!node || !F || !LW.canFly(node)) return null;
        const f = F.known(node) ? F.target(app, node) : F.blind(app, node);
        if (!f) return null;
        const site = f.kind === 'site' && typeof app.siteOf === 'function' ? app.siteOf(node) : null;
        if (site && (site.inSpace || site.relay)) return null;                   // a crossing or the relay: nobody lands
        // GAME (the review): our wreck's story is picked here, as the trip would pick it (App.wreckEncounterFor: once, kept on the
        // planet), so the warmed place is the wreck the landing draws
        const ours = !!(site && site.tag === 'EXODUS_WRECK'), art0 = site ? site.art || null : f.art || null;
        let wreck = ours ? node.wreckEncounter || null : null;
        if (ours && !wreck && typeof app.wreckEncounterFor === 'function') { const enc = app.wreckEncounterFor(node); wreck = enc ? enc.id : null; }
        const unmarked = typeof app.unmarkedWhy === 'function' ? app.unmarkedWhy(node) : null, L = (s._nsDrops || 0) + 1;
        const risk = Number.isFinite(f.risk) ? f.risk : 15;
        return { node, sector: s.currentSector, find: f, site: art0, wreck, unmarked, L, risk, ours, key: [node.id, f.id, art0, wreck, unmarked, L >= 20, risk >= 30].join('|') };
    }
    /** GAME (the review): the whole fall or the routine drop, as the trip will decide it (App.isFullDrop, with the two the crew put
        forward: NSOrbit.propose), so the first sizes of the land it needs are painted first. */
    function warmFull(app, t) {
        const s = app.state;
        if (typeof app.isFullDrop === 'function') {
            try { const O = window.NSOrbit, p = O && typeof O.propose === 'function' ? O.propose(app) : null; return !!app.isFullDrop(t.node, t.find, p && Array.isArray(p.ids) ? p.ids : [], { wreck: t.ours }); }
            catch (err) { console.error('LandFall: the warm-up could not tell the drop', err); }
        }
        return !(s._nsTypesLanded || {})[t.node.type] || !!(t.node.isStoryPlanet || t.node.isEden || t.ours);
    }
    function warmTick() {
        warmT = null;
        const NS = window.NewScreen;
        if (!NS || typeof NS.mode !== 'function' || NS.mode() !== 'stop') return;
        warmT = setTimeout(warmTick, WARM_EVERY_MS);
        if (live || window.MiniHost.current) return;                             // a landing (or another minigame) is on screen
        let t = null;
        try { t = warmTarget(NS.app); } catch (err) { console.error('LandFall: the warm-up could not read the target', err); return; }
        const key = t ? t.key : null;
        if (key !== warmKey) {
            warmKey = key;
            freePlace(t ? t.node.id : null);
            if (!t) return;
            try {
                Object.assign(RUN, { L: t.L, full: warmFull(NS.app, t) });
                const w = LW.worldOf(t.node, t.sector), f = LW.findOf(w, t.find, { unmarked: t.unmarked, risk: t.risk });
                A.orbitSky(w.sector);
                RELEASE_R.forEach(r => A.globe(w, r));
                const G = fieldFor(w, f, { site: t.site, wreck: t.wreck });
                if (G) { touched.add(w.id); urgent(G); }
            } catch (err) { console.error('LandFall: the warm-up could not prepare the place', err); }
        }
        if (!warmIdle && A.pending() > 0) idleSlice();
    }
    function idleSlice() {
        const later = window.requestIdleCallback ? fn => window.requestIdleCallback(fn, { timeout: 1000 }) : fn => setTimeout(() => fn(null), 50);
        warmIdle = true;
        later(deadline => {
            warmIdle = false;
            if (live || warmKey == null) return;
            const ms = deadline && deadline.timeRemaining ? Math.min(WARM_MS, Math.max(2, deadline.timeRemaining() - 1)) : WARM_MS / 2;
            try { A.idle(ms, true); } catch (err) { console.error('LandFall: a warm-up step failed', err); }
            if (A.pending() > 0) idleSlice();
        });
    }
    /** Start the warm-up (a stop shown: NewScreen's 'stop:shown' calls it). */
    function warm() { if (!warmT) warmTick(); }
    /** Let it all go (the stop left: 'stop:hidden'). */
    function forget() { if (warmT) { clearTimeout(warmT); warmT = null; } warmKey = null; if (!live) freePlace(null); }
    if (window.NewScreen && window.NewScreen.on && window.NewScreen.bus) {
        window.NewScreen.bus.on('stop:shown', () => warm());
        window.NewScreen.bus.on('stop:hidden', () => forget());
    }

    /** GAME (the review): does GO DOWN at this stop fly the meteor (a world it can land on; not the relay, not a crossing)?
        Stop.js then sends the team without the glass's own shuttle drop first (the meteor's release is the shuttle leaving). */
    function flies() {
        const NS = window.NewScreen;
        try { return !!(NS && window.MiniHost.has('land-fall') && warmTarget(NS.app)); } catch (err) { console.error('LandFall: could not tell the trip', err); return false; }
    }

    window.LandFall = Object.freeze({
        canFly: LW.canFly, warm, forget, flies,
        debug: Object.freeze({
            state: () => (live ? Object.assign({ phase: S.phase }, stateNow()) : null), stats: phase => WD.frameStats.stats(phase), resetStats: () => WD.frameStats.reset(), run: () => RUN.landings.slice(),
            landProbe: on => { probeOn = !!on; lastPx = null; }, landLog: () => probeLog.splice(0, probeLog.length),
            passStats: () => { const p = passLog.splice(0, passLog.length).sort((x, y) => x - y); return { n: p.length, p50: p[Math.floor(p.length / 2)] || 0, p95: p[Math.floor(p.length * 0.95)] || 0, max: p[p.length - 1] || 0 }; },
            warmKey: () => warmKey, pending: () => A.pending(),
        }),
    });
    MiniHost.register({
        id: 'land-fall',
        title: 'Land the away team',                            // (the header is hidden; LanderGame's own name for its dialog)
        kicker: 'Landing',
        hideHeader: true,                                       // the fall is the whole screen: no header over it
        frameClass: 'is-land',                                  // the stage's own frame rules (landStyle, above)
        mount,
        autoResult,
    });
})();
