/* ═══ Silent Exodus · new screen (?new=1) · land/LandGround.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/landing-ground.js (sha1 4745166b6ce3, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   GAME: prepare() takes the game's world (LandWorlds.js) and the site and wreck the game draws (App.handleEvaAction: the
   same as LanderGame gets): o.site, o.wreck. The sketch's own wreck (broken in two) is drawn only where LanderSites would
   draw it broken too (EXODUS_CACHE, or a story not known yet); a whole, burned or crater wreck is LanderSites' own.
*/
/* ═══ Silent Exodus · prototypes · landing-meteor/landing-ground.js: the ground under the deck ═════════════════════════
   THE METEOR (2026-10-29): copied from ../landing/; the field is now painted at D 4.6 art px per world px (round 2: was 3.2) for the meteor's
   one camera, per find, from just above the deck's floor (G.cloudBase, about 58 px over the find's ground) down
   (G.V); the old cloud base and far ground are not painted (meteor-art.js draws the deck; the deck hides the ground until
   it is in true scale), and the sky under the deck is dimmer and uneven. The rest is as the old dummy's, below.
   Round 3 (2026-10-31, "see further"): the land is seen from the first frame of the fall, small and far (meteor-land.js),
   so the same place is also painted at six smaller sizes (LADDER x D, smallest first, each after the one before, the
   field's own first), each a fifth smaller than the next at most (the release globe's rule), so the land grows to its
   landing size with no swap; outside the field (x < OX, x > W) each is carried on by the far hills' textures (farBake),
   with a 12 px seam in the grain. Under the deck the sky keeps a faint haze (UNDER_HAZE of the scene's own), not black.
   (The old header:)
   What it is: the landing dummy's field. Today's landing place (LanderGame's ground, LanderScene's picture, LanderSites'
   sites, LanderCrew's walk-out), loaded as it is and never changed, with a sky screen above it: a 320 x 360 field (world
   y -180 .. 180; today's frame is y 0 .. 180) seen at 2 art px per world px, and 56 px more on the left, under the tower
   (the picture runs on under it: one place, no seam).
   The ground is LanderGame.internals.buildGround({ id: planet.id + ':' + find.id, type }), so F (another find) changes it
   and the same find gives the same ground. The level stretch by the find is cut to 26 px (risk 30 %+) or 36 px, at least
   64 px in from the field's left edge so it never sits under the tower.
   The look of the place is LanderScene's, with this dummy's own choices laid over it (scene.S, before anything is painted):
   - a warm or strong air (rust, dust, poison) is muted (LandingArt.mute), and its sky stays mostly dark (its fill capped),
     so the find's red or amber light still reads; the ground of a warm world is cooled the same way;
   - rims are cold or neutral, one solid colour (no dotted orange sun edge), a moon's limb too;
   - lava is dim red seams and cracks in a dark crust, not bright filled pools; pools and lakes lie in round, uneven basins,
     the water's edge a broken highlight with slow glints (LanderScene's own pools are not drawn: this file draws them);
   - a machine world's rock is natural rock: the built plates are only round the machines, staggered and broken;
   - our wreck is the Exodus hull as SceneArt's wreck at dusk draws it: tilted, snapped in two, the nose ploughed into a
     mound, a mast carrying its red beacon (LanderSites' own wreck painter is set aside for this dummy's scenes only).
   Under a cloud deck there are no stars and no moon (a thin deck: a few stars). A picture of the place (a "view": the
   whole field, or the walk-out's close-up, painted sharper as today's landing does) is painted by LanderScene.backdrop in
   columns, one small job at a time through LandingArt's idle queue; at night a dark copy is made and the shuttle's lamp
   shows the lit one in a pool under it, a faint cone of its light joining them. The marks (each kind of find's light)
   are drawn here every frame, the same as from orbit. While the camera is still high, the ground far below shows as
   layered hills at the frame's foot, textured and hazed in the air's colour, with the find's light and its lamps on them.
   Uses only the public parts: LanderScene.{ build, backdrop, drawLive, util, MAIN }, LanderSites.{ place, paint, drawLive },
   LanderGame.internals. build() paints its own main picture: it is called with LanderScene.MAIN shrunk to almost nothing
   for that one call (the dummy never shows the main picture) and put back at once.

   window.LandingGround (frozen)
     V                       the field's view { d: 2, ox: -56, oy: -180, w: 752, h: 720 }
     prepare(world, find, o) → G   the ground, the scene, the sun, the marks; the field's picture queued (G.done when painted)
     urgent(G)               paint this place first (the find you are about to land on)
     closeUp(G, V2) → pic    the same place painted for view V2 (queued first); pic.done when painted
     draw(ctx, G, s, now, o)  the place into ctx in o.pic's art px (default the field's; ctx already moved by the camera)
     drawShuttle(ctx, G, s, now, o)   the shuttle, its plumes, the crew walking out, or the wreck after a crash
     farGround(ctx, G, cam, now, o) → drawn   the ground far below while the camera is high (cam: { ox, oy } world px)
     groundTopY(G, cam) → art y, crashFocus(G, s) → { x, y }, spot(G), levelNear(G, x), lightAt(G), markOf(...), toA(wx, wy)
*/
(function () {
    'use strict';
    const LS = window.LanderScene, LG = window.LanderGame, SITES = window.LanderSites, A = window.LandingArt, P = window.NSPaint;
    if (!LS || !LG || !A) { console.error('Landing: LanderScene, LanderGame and landing-art.js must load first'); return; }
    const U = LS.util, I = LG.internals, { RP, INK, threshold, hash, norm3, ramp, clamp01, smooth } = P;
    const W = 320, H = 180, HALF = I.LANDER_HALF, D = 4.6, OX = -36, OY = -180, FW = A.FW, FH = A.FH, TOWER = A.TOWER_W;   // the meteor: the landing seen at 4.6 art px per world px (the fall's own scale, about: the shuttle keeps its size)
    const GAP = 58, GAP_LOW = 50, HILL_CLEAR = 16;                          // the deck's floor: this far over the find's ground, and clear of every hilltop
    const V = U.view(D, OX, OY, (W - OX) * D, (H - OY) * D);              // 752 x 720 art px
    const OWN_WRECK = ['EXODUS_DEAD_CREW', 'EXODUS_INFECTED', 'EXODUS_CRYO', 'EXODUS_PARTIAL', 'EXODUS_BURNED', 'EXODUS_LOG'];   // GAME: LanderSites.js WRECK_LOOKS that are not broken in two
    const SITE_OF = { wreck: 'wreck', colony: 'dome', ruins: 'ruins', graves: 'stones', signal: 'beacon' };
    const MARK = { wreck: 'wreck', colony: 'colony', ruins: 'flare', graves: 'flare', signal: 'signal', life: 'life', machines: 'machines' };
    const SIGN = { ice: 'geyser', haze: 'vent', dunes: 'devil', green: 'smoke', sea: 'smoke' };
    const BOLT = ramp(INK, '#16222e', '#3c5a78', '#9cc4e8', '#f2fbff');   // Worlds.js GLOW.bolt
    const FAR_TOP = 46, STRETCH_MIN_X = 64, POOL_ALT = 150;
    const LADDER = [0.26, 0.33, 0.41, 0.51, 0.64, 0.8], UNDER_HAZE = 0.25, SEAM = 12;   // DRAFT (round 3; meteor-land.js K.LADDER is the same list)
    const SKY_JIT = 4;                                                       // GAME (the review): the margins' sky: each pixel from the edge's rows up to this many px off its own
    const clampX = x => Math.max(0, Math.min(W - 1, x));
    const rgbMix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const hexOf = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

    // ── the ground: today's, with the stretch by the find cut to its width ──
    function levelStretches(g) {
        const runs = [];
        let start = -1;
        const close = end => { runs.push({ c0: start, c1: end, cx: (start + end) / 2, room: (end - start) / 2, x0: start - HALF, x1: end + HALF, y: g.heights[start] }); start = -1; };
        for (let x = HALF + 1; x <= W - HALF - 2; x++) {
            const ok = g.heights[x] <= H && !g.hot[x] && I.tiltAt(g, x) <= I.LEVEL_TILT;
            if (ok && start < 0) start = x; else if (!ok && start >= 0) close(x - 1);
        }
        if (start >= 0) close(W - HALF - 2);
        return runs;
    }
    /** The stretch by the find made exactly `width` px of level ground: wider is flattened, narrower gets a lip each side.
        It stays STRETCH_MIN_X in from the left edge, so the find never lies under the tower. */
    function cutStretch(g, width) {
        let m = g.mark; if (!m) return;
        if (m.cx < STRETCH_MIN_X) {                                           // too near the left edge (under the tower): the nearest level shelf further in
            const alt = (g.level || []).filter(l => l.cx >= STRETCH_MIN_X && l.c1 - l.c0 >= 6).sort((a, b) => Math.abs(a.cx - m.cx) - Math.abs(b.cx - m.cx))[0];
            if (alt) { m = alt; g.mark = alt; }
        }
        const cx = Math.round((m.x0 + m.x1) / 2), x0 = Math.round(cx - width / 2), x1 = x0 + width - 1, y = m.y;
        for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) if (!g.hot[x]) g.heights[x] = y;
        const LIP = [2, 4, 4, 3];                                             // a lip of rock: the level ground ends here (still a walkable step)
        for (let k = 1; k <= 4; k++) [x0 - k, x1 + k].forEach(x => { if (x >= 0 && x < W && !g.hot[x]) g.heights[x] = Math.min(g.heights[x], y - LIP[k - 1]); });
        g.level = levelStretches(g);
        g.mark = g.level.reduce((b, l) => (!b || Math.abs(l.cx - cx) < Math.abs(b.cx - cx) ? l : b), null);
    }
    /** The light a find shows: its kind's own; a flare only where A.U.R.A. scanned; else the world's own sign (a poison air
        breathes through vents whatever the ground), or nothing. */
    function markOf(find, kindName, atmosphere) {
        if ((find.kind === 'ruins' || find.kind === 'graves') && !find.scanned) return 'none';
        if (MARK[find.kind]) return MARK[find.kind];
        if (find.scanned) return 'flare';
        if (atmosphere === 'TOXIC') return 'vent';
        return SIGN[kindName] || 'none';
    }
    // ── the sun of this place, from the globe (n·L at the find) ──
    // by day the sun is high: above the cloud we fell out of (y -168, inside the cloud, so its disc never shows under the
    // cloud base; only its glow lights the cloud's edge); at dusk it is low over the hills, under the cloud
    function sunOf(tod, Ls) {
        if (tod === 'night') return null;
        return { x: Ls > 0 ? (tod === 'day' ? 236 : 288) : (tod === 'day' ? 84 : 32), y: tod === 'day' ? DAY_SUN_Y : 96 };
    }
    const DAY_SUN_Y = -168;
    /** A dim air ramp lifted for daylight: the same hue, its top step brought up toward a pale sky. */
    function daylit(rp) {
        const top = rp.rgb[rp.rgb.length - 1], luma = top[0] * 0.3 + top[1] * 0.59 + top[2] * 0.11;
        if (luma > 130) return rp;
        const mix = (a, b, k) => U.hexOf(U.mixRgb(a, b, k)), ink = [5, 7, 10], pale = [214, 232, 236];
        return ramp(INK, mix(ink, top, 0.35), mix(ink, top, 0.65), U.hexOf(top), mix(top, pale, 0.3), mix(top, pale, 0.55));
    }
    const SKY_AIR = { day: 0.7, dusk: 0.28 };                               // how much of the air's colour fills the sky under the deck
    const SKY_AIR_WARM_CAP = 0.24;                                          // a warm or strong air: the sky stays mostly dark (80-95 % dark)
    /** One flat colour as a ramp (every step the same after the ink): whatever value asks for it, a solid pixel. */
    const flat = rgb => ramp(INK, ...[1, 2, 3, 4, 5].map(() => hexOf(rgb)));
    /** Lava as dim red seams: the same hue as Worlds.js GLOW.lava, kept low, its top never near white. */
    const LAVA_DIM = ramp(INK, '#140705', '#2a0b06', '#46120a', '#6c1c0e', '#923012', '#b8481c');

    /** This dummy's choices laid over LanderScene's look before anything is painted (see the header). */
    function retune(S, world, find, tod, g) {
        const atm = world.atm || 0;
        if (world.atmosphere === 'TOXIC') { S.airRamp = S.K.ACID_ATMO; S.cloud = S.K.mk('#10140a', '#1e2a0e', '#334818', '#4e6a22'); }   // a poison air looks it, whatever the ground
        const warmAir = A.isWarm(S.airRamp) || world.atmosphere === 'TOXIC';
        if (warmAir) { S.airRamp = A.mute(S.airRamp); S.cloud = A.mute(S.cloud); }
        if (A.isWarm(S.GRD)) S.GRD = A.mute(S.GRD, 0.55);                        // a warm ground cooled like its air
        if (tod === 'day' && atm > 0 && !warmAir) S.airRamp = daylit(S.airRamp);   // a day sky: the air's own colour, lit (a strong one is not lifted)
        const top = S.GRD.rgb[S.GRD.rgb.length - 1];
        S.rimRamp = flat(rgbMix(top, [196, 210, 214], 0.3).map(v => v * 0.86));   // a solid, neutral edge where the ground faces the light
        const N0 = S.K.N, N = Object.assign({}, N0, { sphere: (p, o) => N0.sphere(p, Object.assign({ rimRamp: flat([150, 168, 176]) }, o)) });   // a moon's limb: cold
        S.K = Object.assign({}, S.K, { N, LAVA: LAVA_DIM });
        S.N = N;
        if (S.hotGlow) for (let i = 0; i < S.hotGlow.length; i++) S.hotGlow[i] *= 0.3;   // the lava lights the sky only faintly
        if (S.type === 'MACHINE_WORLD') { S.type = 'MACHINE_WORLD:natural'; S.lamps = null; }   // its rock is rock: no tiled plating, no plate lamps (the plates are drawn round the machines)
        if (atm > 0) {                                                         // under a deck: no moon, no stars (a thin deck is torn: a few)
            S.moon = null;
            S.stars = atm < 0.6 ? S.stars.filter((st, i) => i % 14 === 0 && st.y < 70) : [];
            if (SKY_AIR[tod]) { S.air = warmAir ? Math.min(S.air, SKY_AIR_WARM_CAP * Math.min(1, atm)) : Math.max(S.air, SKY_AIR[tod] * Math.min(1, atm)); S.airTop = -150 - (tod === 'day' ? 90 : 0); }
            else if (warmAir) S.air = Math.min(S.air, SKY_AIR_WARM_CAP);
            S.air = 0; S.haze = UNDER_HAZE * (S.haze || 0); S.dust = Math.min(S.dust, 0.1);   // the meteor: under the deck the sky is the deck itself, receding (meteor-art.js ceiling); round 3: a faint horizon haze, never black
        }
        roundPools(S, g);
        return warmAir;
    }
    /** Pools and lakes lie in round basins: deepest in the middle, the banks curving in, uneven (not a V cut in the ground). */
    function roundPools(S, g) {
        if (!S.poolNear || S.poolLevel == null) return;
        const level = S.poolLevel, sea = !!g.kind.sea, N = S.N, FR = 4, floor = new Float32Array(W * FR).fill(-1);
        let x0 = -1;
        for (let c = 0; c <= W; c++) {
            const on = c < W && S.poolNear[c] === 0;
            if (on && x0 < 0) x0 = c;
            if (on || x0 < 0) continue;
            const x1 = c, w = x1 - x0, deep = sea ? Math.min(H - level + 3, 10 + w * 0.35) : Math.min(H - level + 3, 4 + w * 0.26);
            const mid = x0 + w * (0.32 + 0.36 * hash(x0 & 255, 7, 31));                 // the deepest point off the middle: one bank steeper than the other
            for (let i = x0 * FR; i < x1 * FR; i++) {
                const wx = (i + 0.5) / FR, k = Math.min(1, wx < mid ? (wx - x0) / Math.max(1, mid - x0) : (x1 - wx) / Math.max(1, x1 - mid));
                const bowl = Math.pow(Math.sin(k * Math.PI / 2), 0.7), rough = ((N.fbm(wx / 4, 3, S.seed + 31, 2) - 0.5) * 6 + (N.fbm(wx / 13, 9, S.seed + 37, 2) - 0.5) * 8) * (0.25 + k);
                floor[i] = level + Math.max(1.2, deep * bowl + rough);
            }
            x0 = -1;
        }
        S.floorAt = wx => floor[Math.max(0, Math.min(floor.length - 1, Math.floor(wx * FR)))];
    }

    /** Everything for one landing at this find. o: { risk, night, low (cloud base low), weak (the flare off its mark) }. */
    function prepare(world, find, o) {
        o = o || {};
        const planet = { id: world.id + ':' + find.id, type: world.type, name: world.name, atmosphere: world.atmosphere, metrics: { gravity: world.gravity, temp: world.temp }, temperature: world.node ? world.node.temperature : undefined };   // GAME: + temperature (LanderCrew.isMild)
        const g = I.buildGround(planet);
        cutStretch(g, o.risk >= 30 ? 26 : 36);
        const kindName = g.kindName, mark = markOf(find, kindName, world.atmosphere), siteKind = o.site !== undefined ? o.site || null : SITE_OF[find.kind] || null;   // GAME: the site the game draws (its siteArt)
        const MAIN = LS.MAIN, keep = [MAIN.d, MAIN.w, MAIN.h];                // build() bakes its own main picture: make it nothing
        MAIN.d = 0.02; MAIN.w = 1; MAIN.h = 1;
        let scene;
        const detail = siteKind === 'wreck' ? (o.wreck !== undefined ? o.wreck || null : 'EXODUS_CACHE') : null;   // GAME: the wreck's story id (LanderGame's opts.wreck)
        try { scene = LS.build(g, planet, siteKind, detail); } finally { MAIN.d = keep[0]; MAIN.w = keep[1]; MAIN.h = keep[2]; }
        if (!scene) return null;
        scene.dockX = -999;                                                    // no belly of our ship across the top: the ship is the tower
        const S = scene.S, tod = o.night ? 'night' : find.tod, atm = world.atm || 0;
        // the meteor: the deck's floor hangs just above the last stretch of the landing (about 58 px over the find's
        // ground, lower from landing 20), and clear of every hilltop; the field is painted from just above it, at D
        let minH = H; for (let x = 0; x < W; x++) if (g.heights[x] <= H) minH = Math.min(minH, g.heights[x]);
        const cloudBase = Math.round(Math.min((g.mark ? g.mark.y : 150) - (o.low ? GAP_LOW : GAP), minH - HILL_CLEAR));
        const oy = cloudBase - 14, Vg = U.view(D, OX, oy, Math.round((W - OX) * D), Math.round((H + 3 - oy) * D));
        S.Ls = find.Ls || 1;
        S.sun = sunOf(tod, S.Ls);
        S.L3 = norm3(S.Ls * 0.75, tod === 'dusk' ? -0.25 : -0.55, 0.42);
        S.sunK = S.sun ? (wx => 0.72 + 0.28 * Math.max(0, 1 - Math.abs(wx - S.sun.x) / W)) : () => 0.42;
        S.dust = S.sun ? (tod === 'dusk' ? 0.9 : 0.8) : 0.15;
        S.dummyWreck = siteKind === 'wreck' && !OWN_WRECK.includes(detail);      // GAME: only where LanderSites would draw it broken in two too
        const warmAir = retune(S, world, find, tod, g);
        if (atm <= 0) {                                                        // airless: the sky screen's own stars over today's
            const sr = U.seeded(planet.id + ':high');
            for (let i = 0; i < 260; i++) S.stars.push({ x: OX + sr() * (W - OX), y: OY + sr() * 182, mag: sr() });
        }
        const G = { world, find, planet, g, scene, S, tod, mark, siteKind, risk: o.risk || 0, cloudBase, kindName, flare: null, bright: [], o, warmAir, V: Vg };
        G.tag = 'field:' + planet.id;
        G.directSun = atm > 0 ? tod === 'dusk' : tod !== 'night';               // the sun itself lights the ground here (not through a deck)
        G.gDraw = Object.create(g);                                            // the ground as LanderScene draws it live: its pools and its wind are ours
        G.gDraw.kind = Object.assign({}, g.kind, { pools: false, sea: false });
        G.gDraw.wind = 0;                                                      // (its wind is drawn as straight dust lines: this file draws wisps instead)
        if (mark === 'flare') {                                                // where the flare came down: by the stretch, off it with a weak scan
            const m = g.mark, side = g.site ? g.site.dir : (m.cx < W / 2 ? 1 : -1), off = o.weak ? (25 + 35 * hash(planet.id.length, 3, 7)) * (hash(5, planet.id.length, 9) < 0.5 ? -1 : 1) : 0;
            const fx = Math.max(8, Math.min(W - 8, (side > 0 ? m.x1 + 8 : m.x0 - 8) + off));   // between the stretch and the find, clear of the shuttle's feet
            G.flare = { x: fx, y: g.heights[Math.round(fx)] - 1 };
        }
        A.drop(G.tag);
        G.groundY = g.mark ? g.mark.y : 150;
        G.ladder = LADDER.map(k => ({ k, pic: null, done: false }));          // round 3: the land far below (painted once the field is: smallest first)
        G.ladderFrom = 0;                                                      // (the polish round: landing.js sets the first size this drop needs)
        G.main = paintView(G, Vg, G.tag, false, true, () => { if (G.isUrgent) paintLadder(G, G.ladderFrom); else G.ladderWait = true; });   // (the fix round: the land's six sizes only for the find we may go down on: about 18-36 MB a find)
        G.cloud = null;                                                        // the meteor draws the deck itself (meteor-art.js)
        G.far = farBake(G, G.tag);                                             // round 3: the far hills' textures carry each size of the land on past the field
        Object.defineProperty(G, 'done', { get: () => !!(G.main.done && (!G.cloud || G.cloud.done) && G.far.done && G.ladder.every(L => L.done) && !!G.mainFar), enumerable: true });   // painted and ready to land on
        return G;
    }
    /** This place is the next landing: its paintings go first in the queue. */
    function urgent(G) {
        if (!G || G.isUrgent) return;
        G.isUrgent = true; G.main.urgent = true;
        if (G.ladderNow) G.ladderNow.urgent = true;
        A.promote(G.tag);
        if (G.ladderWait) { G.ladderWait = false; paintLadder(G, G.ladderFrom || 0); }
    }
    /** The fix round: another find is the next landing: this one's land sizes are let go (painted again if it is picked
        again). Never the place we are landing on. */
    function freeLadder(G) {
        if (!G || !G.ladder || !G.main || !G.main.done) return;
        if (G.ladderNow && !G.ladder.every(L => L.done)) return;                  // (mid-way through its sizes: let it finish)
        G.ladder.forEach(L => { L.pic = null; L.done = false; });
        G.mainFar = null; G.mainFarBusy = false; G.ladderNow = null; G.isUrgent = false; G.ladderWait = true;
    }
    /** Round 3: the land's ladder, one size after the other (each paints the field [OX, W] at D·k, down far enough to reach
        the frame's foot where it is first drawn, then its margins). */
    function paintLadder(G, i) {
        if (i >= LADDER.length) {                                              // the field's own size, its sky dissolved, for the land far below
            const lowerToo = () => { const lower = G.ladder.findIndex(L => !L.pic); if (lower >= 0) paintLadder(G, lower); };   // (the polish round: then the sizes below the first one, if any are still to paint)
            if (!G.mainFar && !G.mainFarBusy) { G.mainFarBusy = true; margins(G, LADDER.length, Object.assign({}, G.main, { urgent: !!G.isUrgent }), 1, pic => { G.mainFar = pic; G.mainFarBusy = false; lowerToo(); }); }   // (the polish round: with its own margins too, so the land's sides never vanish at the last size)
            else lowerToo();
            return;
        }
        if (G.ladder[i].pic) return;
        const k = LADDER[i], dk = D * k, oy = G.V.oy, bottom = Math.max(H + 3, G.groundY + (FH - 250) / dk + 4);
        const Vk = U.view(dk, OX, oy, Math.round((W - OX) * dk), Math.round((bottom - oy) * dk));
        G.ladderNow = paintView(G, Vk, G.tag, !!G.isUrgent, false, core => margins(G, i, core));   // (the polish round: the next landing's sizes go first, from their first job)
        if (G.isUrgent) G.ladderNow.urgent = true;
    }
    /** The core of one size laid in a wider picture whose margins (MK world px each side, at most 600) are the far hills:
        their outline eases from the field's own edge into a rolling range, the near ground's texture under it, the far
        range above, the field's own sky carried on (its edge 8 px tiled, the grain kept), a 12 px Bayer seam at the join. */
    function margins(G, i, core, kOwn, onDone) {
        const L = G.ladder[i], go = () => {
            if (!G.far.done) { G.far.then.push(() => A.later(go, G.tag, !!G.isUrgent, 'ladder margins ' + i)); return; }
            const k = kOwn || LADDER[i], dk = D * k, Vc = core.V, MK = Math.min(600, Math.ceil(FW / dk)), MP = Math.round(MK * dk), w = Vc.w + 2 * MP, h = Vc.h;
            const V2 = { d: dk, ox: Vc.ox - MP / dk, oy: Vc.oy, w, h };
            // (the polish round: each margin painted in slices of SLICE columns, one per queue slot: no job holds a frame up)
            const srcs = core.dark ? [core.lit, core.dark] : [core.lit], out = srcs.map(() => null), SLICE = 96, jobs = [];
            srcs.forEach((src, si) => {
                jobs.push(() => { const c = document.createElement('canvas'); c.width = w; c.height = h; const cg = c.getContext('2d'); cg.drawImage(src, MP, 0); out[si] = { c, cg, edge: readPx(src, 0, 0, 8, h), edgeR: readPx(src, Vc.w - 8, 0, 8, h) }; });
                for (let s0 = 0; s0 < MP; s0 += SLICE) [true, false].forEach(left => jobs.push(() => {
                    const o = out[si], n = Math.min(SLICE, MP - s0), img = o.cg.createImageData(n, h), base = left ? 0 : MP + Vc.w;
                    fill(G, img.data, left ? o.edge : o.edgeR, base, MP, V2, h, dk, left, src === core.dark, s0, s0 + n);
                    o.cg.putImageData(img, base + s0, 0);
                }));
            });
            srcs.forEach((src, si) => jobs.push(() => fadeSky(G, out[si].c, V2, true)));   // (the final fix round: each picture's sky cut in its own queue slot: never one long job in the release)
            jobs.push(() => { const pic = { V: V2, lit: out[0].c, dark: out[1] ? out[1].c : null, done: true, k }; if (onDone) onDone(pic); else { L.pic = pic; L.done = true; paintLadder(G, i + 1); } });
            const step = j => A.later(() => { jobs[j](); if (j + 1 < jobs.length) step(j + 1); }, G.tag, !!G.isUrgent, 'ladder margins ' + i + '.' + j);
            step(0);
        };
        A.later(go, G.tag, !!core.urgent, 'ladder margins ' + i);
    }
    /** The land far below shows no sky of its own: its rows FADE_TOP..FADE_FULL world px over the find's ground dissolve
        (GAME: in white noise, picture-locked), everything over them is cut; the field 1:1 (the landing) keeps its sky. inPlace:
        cut the canvas itself, else a copy. */
    const FADE_TOP = 62, FADE_FULL = 42;
    function fadeSky(G, src, Vx, inPlace) {
        let c = src;
        if (!inPlace) { c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); }
        const ref = Math.min(G.groundY, lightAt(G).y + 2), g = c.getContext('2d'), y0 = Math.max(0, Math.round((ref - FADE_TOP - Vx.oy) * Vx.d)), y1 = Math.max(y0, Math.round((ref - FADE_FULL - Vx.oy) * Vx.d));   // (from the find's ground or its light, whichever is higher)
        if (y0 > 0) g.clearRect(0, 0, c.width, y0);
        if (y1 > y0) {
            const m = document.createElement('canvas'); m.width = c.width; m.height = y1 - y0;
            const mg = m.getContext('2d'), img = mg.createImageData(m.width, m.height);
            for (let y = 0; y < m.height; y++) { const keep = (y + 0.5) / m.height; for (let x = 0; x < m.width; x++) if (hash(x & 255, (y + y0) & 255, 229) >= keep) img.data[(y * m.width + x) * 4 + 3] = 255; }   // GAME (the review): white noise, not the Bayer lattice: these pictures are drawn shrunk, nearest neighbour, and the lattice beat into scanline bars
            mg.putImageData(img, 0, 0);
            g.globalCompositeOperation = 'destination-out'; g.drawImage(m, 0, y0); g.globalCompositeOperation = 'source-over';
        }
        return c;
    }
    /** A region of a picture's pixels, through one scratch canvas kept for reading (no read back of the picture itself). */
    let rb = null;
    function readPx(src, sx, sy, w, h) {
        if (!rb) { const c = document.createElement('canvas'); rb = c.getContext('2d', { willReadFrequently: true }); }
        if (rb.canvas.width < w) rb.canvas.width = w;
        if (rb.canvas.height < h) rb.canvas.height = h;
        rb.clearRect(0, 0, w, h); rb.drawImage(src, sx, sy, w, h, 0, 0, w, h);
        return rb.getImageData(0, 0, w, h).data;
    }
    /** One margin's pixels (art columns ax0 .. ax0 + mw of the wide picture), from the core's edge block (8 px, its grain);
        the polish round: only its columns xa .. xb when given, into a buffer that wide. */
    function fill(G, out, edge, ax0, mw, V2, h, dk, left, dark, xa, xb) {
        const xs = xa || 0, xe = xb == null ? mw : xb, ow = xe - xs;
        const S = G.S, g = G.g, T = G.far, near = T.nearPx || (T.nearPx = readPx(T.near, 0, 0, FW, FAR_H)), hills = T.hillsPx || (T.hillsPx = readPx(T.hills, 0, 0, FW, HILL_H));
        const wxE = left ? OX + 0.5 / dk : W - 0.5, edgeTop = U.hAt(g, wxE), skyMax = Math.max(0, Math.floor((edgeTop - V2.oy) * dk) - 2), gy = G.groundY;
        for (let x = xs; x < xe; x++) {
            const ax = ax0 + x, wx = V2.ox + (ax + 0.5) / dk, dist = Math.abs(wx - wxE), dpx = left ? mw - 1 - x : x;
            const blend = smooth(0, 60, dist), top = edgeTop + (gy - 8 + 0.9 * hillY(S, wx) - edgeTop) * blend, topAy = (top - V2.oy) * dk;
            const farAy = (top - 14 - 4 * blend + 0.7 * hillY(S, wx * 1.6 + 50) * blend - V2.oy) * dk, tx = ((ax % FW) + FW) % FW, ex = left ? (((x - mw) % 8) + 8) % 8 : x % 8;
            for (let y = 0; y < h; y++) {
                const o = (y * ow + x - xs) * 4;
                let r, gg, b;
                if (dpx < SEAM && threshold(ax, y) < (SEAM - dpx) / SEAM) { const s = (y * 8 + ex) * 4; r = edge[s]; gg = edge[s + 1]; b = edge[s + 2]; }   // the seam: the field's own edge, dithered in
                else if (y >= topAy) { const s = (Math.min(FAR_H - 1, Math.floor(y - topAy)) * FW + tx) * 4; r = near[s]; gg = near[s + 1]; b = near[s + 2]; if (dark) { r *= 0.42; gg *= 0.42; b *= 0.45; } }
                else if (y >= farAy) { const s = (Math.min(HILL_H - 1, Math.floor(y - farAy)) * FW + tx) * 4; r = hills[s]; gg = hills[s + 1]; b = hills[s + 2]; if (dark) { r *= 0.5; gg *= 0.5; b *= 0.52; } }
                else { const jy = Math.max(0, Math.min(skyMax, Math.min(y, skyMax - SKY_JIT) + Math.round((hash(ax & 255, y & 255, 223) - 0.5) * 2 * SKY_JIT))), s = (jy * 8 + Math.floor(hash(ax & 255, y & 255, 227) * 8)) * 4; r = edge[s]; gg = edge[s + 1]; b = edge[s + 2]; }   // GAME (the review): its pixels drawn from the edge's rows near it at random, never the edge's 8 px tiled row by row (that read as scanline streaks)
                out[o] = r; out[o + 1] = gg; out[o + 2] = b; out[o + 3] = 255;
            }
        }
    }

    // ── a picture of the place for one view: columns of LanderScene.backdrop, one job at a time; the marks; the night copy ──
    // Columns COL_ART art px wide: each job paints at most COL_ART x 48 px (LanderScene's band), so none holds a frame up,
    // and a whole number of 8 x 8 Bayer cells, so the grain runs on across the seams.
    const COL_ART = 48;
    function paintView(G, Vx, tag, soon, isMainView, after) {
        const { scene, g } = G, site = g.site, pic = { V: Vx, lit: null, dark: null, done: false, urgent: false };
        const canvas = document.createElement('canvas'); canvas.width = Vx.w; canvas.height = Vx.h;
        const fg = canvas.getContext('2d'), isMain = !!isMainView, steps = [];
        let at = 0;
        // the steps run one per queue slot, in order: nothing is set up on the key press that asked for the place
        const run = () => {
            const step = steps[at++];
            if (step) step();
            if (at < steps.length) A.later(run, tag, pic.urgent || soon, steps[at].label);
        };
        for (let a0 = 0, c = 0; a0 < Vx.w; a0 += COL_ART, c++) {
            const aw = Math.min(COL_ART, Vx.w - a0), colW = aw / Vx.d, x0 = Vx.ox + a0 / Vx.d;
            const near = site && site.x1 + 14 >= x0 && site.x0 - 14 <= x0 + colW;   // the site is painted only where it shows
            const setup = () => {                                             // the column's backdrop, its jobs put next in line
                if (!near) g.site = null;
                let bd;
                try { bd = LS.backdrop(scene, g, U.view(Vx.d, x0, Vx.oy, aw, Vx.h)); } finally { g.site = site; }
                const jobs = bd.jobs.map((job, k) => Object.assign(() => {
                    if (!near) g.site = null;
                    try { job(); } finally { g.site = site; }
                    if (isMain && scene.S.bright && scene.S.bright !== G.lastBright) { G.lastBright = scene.S.bright; scene.S.bright.forEach(b => { if (b.x >= x0 && b.x < x0 + colW) G.bright.push(b); }); }
                    if (bd.done && !bd.placed) { bd.placed = true; fg.drawImage(bd.canvas, a0, 0); }
                }, { label: 'col ' + c + ' job ' + k + '/' + bd.jobs.length }));
                steps.splice(at, 0, ...jobs);
            };
            steps.push(Object.assign(setup, { label: 'col ' + c + ' setup' }));
        }
        steps.push(Object.assign(() => { steps.splice(at, 0, ...poolSteps(G, fg, Vx)); }, { label: 'pools setup' }));
        steps.push(Object.assign(() => { paintMarks(G, fg, Vx); pic.lit = canvas; if (isMain) scene.S.bright = G.bright.slice(0, 60); if (G.tod !== 'night') pic.done = true; }, { label: 'marks' }));
        if (G.tod === 'night') {                                              // the dark copy: the ground lit only by the stars
            steps.push(Object.assign(() => {                                  // multiplied down on the canvas itself (no read back): the ground and what
                const dark = document.createElement('canvas'); dark.width = Vx.w; dark.height = Vx.h;   // stands on it, fading out 36-56 px above it; the sky keeps its stars
                const dg = dark.getContext('2d');
                dg.drawImage(canvas, 0, 0);
                dg.globalCompositeOperation = 'multiply';
                const STEPS = [[56, '#c2c4cb'], [51, '#c2c4cb'], [46, '#c2c4cb'], [41, '#c2c4cb'], [36, '#c2c4cb'], [20, '#c8c9ce']];   // stacked: about a quarter of the light at the ground
                STEPS.forEach(([up, ink]) => {
                    dg.beginPath(); dg.moveTo(0, Vx.h);
                    for (let x = 0; x <= Vx.w; x += 2) { const wx = Vx.ox + x / Vx.d; dg.lineTo(x, Math.max(0, (U.hAt(g, wx) - up - Vx.oy) * Vx.d)); }
                    dg.lineTo(Vx.w, Vx.h); dg.closePath(); dg.fillStyle = ink; dg.fill();
                });
                dg.globalCompositeOperation = 'source-over';
                pic.dark = dark; pic.done = true;
            }, { label: 'night copy' }));
        }
        if (after) steps.push(Object.assign(() => after(pic), { label: 'after' }));   // round 3: the next size of the land starts once this one is painted
        A.later(run, tag, soon, steps[0].label);
        return pic;
    }
    /** The walk-out's (or the crash's) close-up: the same place painted again for view V2, ahead of everything else. */
    function closeUp(G, V2) {
        if (G.close && G.close.V.d === V2.d && G.close.V.ox === V2.ox && G.close.V.oy === V2.oy) return G.close;
        if (G.close) A.drop(G.tag + ':close');
        G.close = paintView(G, V2, G.tag + ':close', true);
        return G.close;
    }

    // ── the pools, still (the moving glints and cracks are drawn live from G.poolFx) ──
    /** Lava: a dark crust with dim red cracks and a dim seam at the shore. Water: dark, deeper toward the middle, the edge a
        broken one-pixel highlight. Painted between the surface and the round basin's floor, on whole Bayer cells. */
    /** The pools' painting as steps of a few rows each (none holds a frame up); the last lays it into the picture. */
    function poolSteps(G, fg, Vx) {
        const S = G.S, g = G.g;
        if (!S.poolNear || S.poolLevel == null) return [];
        const level = S.poolLevel, d = Vx.d;
        let c0 = W, c1 = -1, deepest = level;
        for (let c = 0; c < W; c++) if (S.poolNear[c] === 0) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); deepest = Math.max(deepest, S.floorAt(c + 0.5)); }
        if (c1 < 0) return [];
        const ax0 = Math.max(0, Math.floor(((c0 - 1 - Vx.ox) * d) / 8) * 8), ax1 = Math.min(Vx.w, Math.ceil((c1 + 2 - Vx.ox) * d));
        const ay0 = Math.max(0, Math.floor(((level - 1 - Vx.oy) * d) / 8) * 8), ay1 = Math.min(Vx.h, Math.ceil((deepest + 1 - Vx.oy) * d));
        if (ax1 <= ax0 || ay1 <= ay0) return [];
        const job = { p: P.painter(ax1 - ax0, ay1 - ay0, false), fx: [], ax0, ax1, ay0, ay1, c0, c1 }, steps = [], ROWS = Math.max(8, Math.floor(9000 / (ax1 - ax0) / 8) * 8);
        for (let y = ay0; y < ay1; y += ROWS) steps.push(Object.assign(() => paintPools(G, Vx, job, y, Math.min(ay1, y + ROWS)), { label: 'pools ' + y }));
        steps.push(Object.assign(() => {
            fg.drawImage(job.p.canvas(), ax0, ay0);
            if (Vx === G.V) {                                                  // what moves on them: glints on water, cracks breathing in the crust
                const sea = !!g.kind.sea;
                if (sea) { G.poolFx = []; for (let c = c0; c <= c1; c += 3) if (S.poolNear[c] === 0 && hash(c & 255, 5, 13) > 0.5) G.poolFx.push([c + hash(c & 255, 6, 13), level + 0.3 + hash(c & 255, 7, 13) * 1.5]); }
                else G.poolFx = job.fx.slice(0, 40);
                G.poolSea = sea;
            }
        }, { label: 'pools placed' }));
        return steps;
    }
    function paintPools(G, Vx, job, ry0, ry1) {
        const S = G.S, g = G.g, level = S.poolLevel, sea = !!g.kind.sea, d = Vx.d, N = S.N, R = sea ? S.WATER : LAVA_DIM, { p, fx, ax0, ax1, ay0 } = job;
        for (let ay = ry0; ay < ry1; ay++) {
            const wy = Vx.oy + (ay + 0.5) / d, dd = wy - level;
            if (dd < 0) continue;
            for (let ax = ax0; ax < ax1; ax++) {
                const wx = Vx.ox + (ax + 0.5) / d, col = clampX(Math.floor(wx));
                if (S.poolNear[col] !== 0) continue;
                const floor = S.floorAt(wx); if (floor > 0 && wy > floor) continue;
                const x = ax - ax0, y = ay - ay0, toFloor = floor > 0 ? floor - wy : 99;
                if (sea) {
                    if (dd * d < 1) { const top = R.hex.length - 1; const n = N.vnoise(wx / 2.6, 1, S.seed + 4); if (n < 0.3) { p.solid(x, y, R, 1 / top); continue; } p.solid(x, y, R, (n > 0.64 ? 3 : 2) / top); continue; }   // the edge: a dim line, broken, brighter here and there
                    const wave = N.vnoise(wx / 6, dd / 2, S.seed) - 0.5;
                    p.solid(x, y, R, 0.24 * Math.exp(-dd / 12) + 0.06 + wave * 0.1 - (toFloor < 2 ? 0.04 : 0));
                    continue;
                }
                const crack = Math.abs(N.vnoise(wx / 3.4, wy / 1.8, S.seed + 6) - 0.5);
                if (dd * d < 1.2 && hash(Math.floor(wx * 2) & 255, 3, 11) > 0.35) { p.solid(x, y, R, 0.42); continue; }   // the seam at the shore, broken
                if (crack < 0.035) { p.solid(x, y, R, 0.5 - Math.min(0.25, dd / 30)); if (hash(ax & 255, ay & 255, 7) > 0.985) fx.push([wx, wy]); continue; }
                p.solid(x, y, S.GRD, 0.08 + 0.06 * N.vnoise(wx / 5, wy / 2.5, S.seed + 9) - (toFloor < 1.5 ? 0.03 : 0));   // the crust
            }
        }
    }
    function drawPoolFx(ctx, G, now) {
        if (!G.poolFx || !G.poolFx.length) return;
        const f = P.framer(ctx, CV.w, CV.h), u = Math.max(1, Math.round(CV.d / 2));
        G.poolFx.forEach(([wx, wy], i) => {
            const [ax, ay] = toA(wx, wy);
            if (G.poolSea) { const k = Math.sin(now / 1100 + i * 2.3); if (k > 0.82) f.px(ax, ay, k > 0.95 ? '#d8eef6' : G.S.WATER.hex[4], u * (k > 0.92 ? 2 : 1), 1); }
            else { const k = 0.5 + 0.5 * Math.sin(now / 900 + i * 1.7); if (k > 0.55) f.tone(ax, ay, LAVA_DIM, 0.45 + 0.4 * k, u, u); }
        });
    }

    /** Still parts of the marks painted into a picture: the wreck's furrow, the colony's pad and lamp posts, the machines'
        posts and the built plates round them. */
    function paintMarks(G, fg, Vx) {
        const { g } = G, m = g.mark, d = Vx.d;
        const dot = (wx, wy, hex, ww, wh) => { fg.fillStyle = hex; fg.fillRect(Math.round((wx - Vx.ox) * d), Math.round((wy - Vx.oy) * d), Math.max(1, Math.round((ww || 0.5) * d)), Math.max(1, Math.round((wh || 0.5) * d))); };
        if (!m) return;
        if (G.mark === 'wreck' && g.site) {                                   // the furrow it ploughed: it skidded in across the stretch to where it lies
            const s = g.site, from = s.dir > 0 ? m.x0 - 46 : m.x1 + 46, to = s.dir > 0 ? m.x0 : m.x1, step = from < to ? 0.5 : -0.5, GRD = G.S.GRD;
            for (let x = from; step > 0 ? x <= to : x >= to; x += step) {
                const top = U.hAt(g, x), k = Math.abs(x - to) / Math.max(1, Math.abs(to - from));
                dot(x, top + 0.5, GRD.hex[1]); if (k > 0.3) dot(x, top + 1, GRD.hex[1]);
                if (hash(Math.round(x * 2) & 255, 7, 3) > 0.7) dot(x, top - 0.5, GRD.hex[4]);   // spoil thrown up along its lip
            }
        }
        if (G.mark === 'colony') {                                             // their own pad: a plate on the level ground, six lamp posts
            for (let x = m.x0 + 1; x < m.x1; x += 0.5) { dot(x, m.y - 0.5, RP.HULL.hex[3]); dot(x, m.y, RP.HULL.hex[2]); }
            G.lamps = [0, 1, 2, 3, 4, 5].map(i => { const x = m.x0 + 1 + i * (m.x1 - m.x0 - 2) / 5; dot(x, m.y - 2, RP.HULL.hex[2], 0.5, 1.5); return { x, y: m.y - 2.6, on: i === 1 || i === 4 }; });
        }
        if (G.mark === 'machines') {                                           // three squat posts beyond the stretch, a head on each
            const side = m.cx < W / 2 ? 1 : -1;
            G.posts = [0, 1, 2].map(i => { const x = (side > 0 ? m.x1 + 6 : m.x0 - 6) + side * i * 7, y = g.heights[Math.round(x)]; return { x, y: y - 4.6, base: y }; });
            plates(G, fg, Vx, Math.min(...G.posts.map(q => q.x)) - 10, Math.max(...G.posts.map(q => q.x)) + 12);
            G.posts.forEach(q => { dot(q.x - 0.5, q.base - 3.5, RP.HULL.hex[1], 1, 3.5); dot(q.x - 0.75, q.base - 4, RP.HULL.hex[3], 1.5, 0.5); });
        }
    }
    /** Built plates round the machines: set into the ground's top few px, staggered row to row, each its own width, the seams
        broken here and there; they thin out at the edges of the built ground. */
    function plates(G, fg, Vx, x0, x1) {
        const g = G.g, d = Vx.d, GRD = G.S.GRD, st = 1 / d;
        const seamAt = (wx, row) => { let x = x0 - 4 + row * 5.3, k = 0; while (x < wx) { x += 7 + hash((k + row * 17) & 255, 31, 5) * 7; k++; } return x - wx < st * 1.01; };
        for (let wx = x0; wx <= x1; wx += st) {
            const top = U.hAt(g, wx), col = clampX(Math.floor(wx)); if (top > H || g.hot[col]) continue;
            const edge = Math.min(wx - x0, x1 - wx) / 6;
            for (let r = 0.5; r < 5; r += st) {
                const row = Math.floor(r / 1.7), ay = Math.round((top + r - Vx.oy) * d), ax = Math.round((wx - Vx.ox) * d);
                if (edge < 1 && threshold(ax, ay) > edge) continue;
                const seamH = Math.abs((r % 1.7)) < st * 0.9, seamV = seamAt(wx, row) && hash(Math.round(wx) & 255, row, 9) > 0.25;
                if (seamH && hash(Math.round(wx * 2) & 255, row + 3, 7) > 0.3) { fg.fillStyle = GRD.hex[1]; fg.fillRect(ax, ay, 1, 1); }
                else if (seamV) { fg.fillStyle = GRD.hex[1]; fg.fillRect(ax, ay, 1, 1); }
                else if (r < st * 1.5) { fg.fillStyle = GRD.hex[4]; fg.fillRect(ax, ay, 1, 1); }
            }
        }
    }

    // ── our wreck, as SceneArt's wreck at dusk: the Exodus hull (round nose, raised bridge, engine block, fins), tilted,
    //    snapped in two, the nose ploughed into a mound of this world's soil, a mast on the bridge carrying its red beacon ──
    function hullEdges(u) {                                                // SceneArt.js hullEdges, copied
        if (u < 0 || u > 1) return null;
        const nose = u < 0.12 ? Math.sqrt(u / 0.12) : 1;
        let top = -0.5 * (0.35 + 0.65 * nose), bottom = 0.5 * (0.35 + 0.65 * nose);
        if (u > 0.14 && u < 0.36) top -= 0.2 * Math.min(1, (u - 0.14) / 0.04, (0.36 - u) / 0.05);
        if (u > 0.74 && u < 0.8) { top += 0.08; bottom -= 0.08; }
        if (u >= 0.8) { top -= 0.06; bottom += 0.06; }
        if (u > 0.86) { const fin = (u - 0.86) / 0.14; top -= 0.3 * fin; bottom += 0.3 * fin; }
        return [top, bottom];
    }
    /** SceneArt.js drawHull, copied onto an NSPaint painter: o { x, y, len, ht, angle, flip, ramp, light, holes, rust, seed, from, to, anchor }. */
    function exodusHull(p, o) {
        const { len, ht } = o, c = Math.cos(o.angle || 0), s = Math.sin(o.angle || 0), dir = o.flip ? -1 : 1, seed = o.seed || 1;
        const from = o.from || 0, to = o.to == null ? 1 : o.to, anchor = o.anchor == null ? (from + to) / 2 : o.anchor, dim = o.light == null ? 1 : o.light;
        const at = (u, v) => { const along = (u - anchor) * len * dir, across = v * ht; return [o.x + along * c - across * s, o.y + along * s + across * c]; };
        const reach = len * Math.max(anchor - from, to - anchor) + ht, cx0 = o.clip ? o.clip[0] : -Infinity, cx1 = o.clip ? o.clip[1] : Infinity;
        const band = ht * 0.95 + Math.abs(s) * reach;                          // the rows it can reach at this angle (it lies nearly flat)
        p.region(Math.max(cx0, o.x - reach), o.y - band, Math.min(cx1, o.x + reach), o.y + band, (x, y) => {
            const dx = x + 0.5 - o.x, dy = y + 0.5 - o.y, u = anchor + (dx * c + dy * s) * dir / len, v = (-dx * s + dy * c) / ht;
            const jag = (P.vnoise(v * 6, u * 4, seed) - 0.5) * 0.07;
            if ((from > 0 && u < from + jag) || (to < 1 && u > to + jag)) return;
            const e = hullEdges(u); if (!e || v < e[0] || v > e[1]) return;
            const mid = (e[0] + e[1]) / 2, half = (e[1] - e[0]) / 2, n = (v - mid) / half, px = u * len;
            let light = 0.7 - 0.42 * n;
            if ((v - e[0]) * ht < 1.4) light += 0.22;                                           // a bright rim along the top
            if (u > 0.8) light -= 0.14;                                                         // the engine block is darker metal
            if (px % (len / 17) < 1 || Math.abs((v - mid) * ht - half * ht * 0.35) < 0.5) light -= 0.2;   // hull plates
            if (u > 0.17 && u < 0.33 && (v - e[0]) * ht > ht * 0.05 && (v - e[0]) * ht < ht * 0.11 && px % (len / 50) > len / 140) light = 0.12;   // bridge windows, dark
            if (u > 0.985) light = 0.18;
            if (o.rust) light -= (P.fbm(px / (len / 28), v * ht / (ht / 7), seed, 3) - 0.45) * 0.5;
            if (o.holes && P.fbm(px / (len / 16), v * ht / (ht / 4), seed + 3, 3) > o.holes) light = px % (len / 40) < len / 200 ? 0.3 : 0.05;   // torn open: the frame shows through
            if ((from > 0 && u < from + jag + 0.02) || (to < 1 && u > to + jag - 0.02)) light *= 0.45;   // scorched break
            p.tone(x, y, o.ramp || RP.HULL, light * dim);
        });
        return at;
    }
    const WRECK_RAMP = ramp(INK, '#141a1d', '#2c3538', '#4f5a5c', '#7b8584', '#a9b1ab');   // our hull, weathered (SceneArt's HULL, a step duller)
    function paintWreck(p, V2, S, g, rand, site) {
        const { dir, near, length } = site, L = Math.max(56, length - 4), ht = L * 0.2, d = V2.d, flip = dir > 0;
        const mean = x => { let sum = 0; for (let k = -3; k <= 3; k++) sum += Math.min(g.heights[clampX(Math.round(x + k))], H - 2); return sum / 7; };
        const xBreak = near + dir * L * 0.46, xTail = near + dir * 3, xNose = near + dir * (L - 3);
        const yB = mean(xBreak) - ht * 0.22, yT = mean(xTail) - ht * 0.3, yN = mean(xNose) - ht * 0.05;
        const slope = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
        const L2 = [Math.min(xTail, xBreak), 0], R2 = [Math.max(xTail, xBreak), 0];
        L2[1] = L2[0] === xTail ? yT : yB; R2[1] = R2[0] === xTail ? yT : yB;
        const tilt = a => Math.max(-0.1, Math.min(0.1, a));                    // it lies along the ground, never stood up on a hill: a hill buries it instead
        const angAft = tilt(slope(L2, R2)), lf = [Math.min(xBreak, xNose), 0], rf = [Math.max(xBreak, xNose), 0];
        lf[1] = lf[0] === xBreak ? yB : yN; rf[1] = rf[0] === xBreak ? yB : yN;
        const angFore = tilt(slope(lf, rf)) + 0.07 * dir;                     // the fore piece dips its nose into the ground
        const box = Math.ceil((L + ht) * d) + 16, q = P.painter(box * 2, box * 2, false), ox = Math.round((xBreak - V2.ox) * d) - box, oy = Math.round((yB - V2.oy) * d) - box;
        const clip = [Math.max(0, -ox - 2), Math.min(q.W, p.W - ox + 2)];        // only the part this column of the picture shows
        const base = { len: L * d, ht: ht * d, flip, ramp: WRECK_RAMP, rust: true, holes: 0.74, seed: 30 + Math.floor(rand() * 40), light: 1, clip };
        exodusHull(q, Object.assign({}, base, { x: box - dir * 1.2 * d, y: box + 0.6 * d, angle: angAft, from: 0.55, anchor: 0.54 }));
        const fore = exodusHull(q, Object.assign({}, base, { x: box + dir * 1.4 * d, y: box, angle: angFore, to: 0.52, anchor: 0.53 }));
        const bury = wx => (Math.abs(wx - xNose) < 9 ? 1.6 : 0.5);
        const yb = Math.ceil(ht * d * 1.1 + 0.2 * L * d);
        for (let y = Math.max(0, box - yb); y < Math.min(q.H, box + yb); y++) for (let x = clip[0]; x < clip[1]; x++) {   // half buried: only what is above the ground
            const i = (y * q.W + x) * 4; if (!q.data[i + 3]) continue;
            const ax = ox + x, ay = oy + y; if (ax < 0 || ay < 0 || ax >= p.W || ay >= p.H) continue;
            const wx = V2.ox + (ax + 0.5) / d, wy = V2.oy + (ay + 0.5) / d;
            if (wy > U.hAt(g, wx) + bury(wx)) continue;
            p.set(ax, ay, [q.data[i], q.data[i + 1], q.data[i + 2]]);
        }
        const world = (axy) => [V2.ox + (ox + axy[0]) / d, V2.oy + (oy + axy[1]) / d];
        // the mound it ploughed up over its nose, the soil the team would walk on
        const hm = ht * 0.42;
        U.region(p, V2, xNose - 12, 0, xNose + 12, H, (wx, wy, ax, ay) => {
            const k = Math.max(0, 1 - Math.abs(wx - (xNose + dir * 2)) / 11), top = U.hAt(g, wx) - hm * Math.pow(k, 1.4) * (0.85 + 0.3 * P.vnoise(wx / 2, 3, 7));
            if (k <= 0 || wy < top || wy > U.hAt(g, wx) + 0.5) return;
            const dd = wy - top, lit = clamp01(0.5 + (wx - xNose) * S.Ls * 0.05);
            p.solid(ax, ay, S.GRD, dd * d < 1.05 ? 0.42 + 0.2 * lit : 0.1 + Math.exp(-dd / 4) * 0.24 + (P.fbm(wx / 3, wy / 2, 21, 2) - 0.5) * 0.16);
            const col = clampX(Math.floor(wx)); site.stand[col] = Math.min(site.stand[col], top);
        });
        for (let k = 0; k < 6; k++) {                                          // plates torn off at the break, lying in the dirt
            const x = xBreak + dir * (rand() * 10 - 5), w = 1 + rand() * 2.5, top = U.hAt(g, x);
            U.region(p, V2, x, top - 1, x + w, top + 0.2, (wx, wy, ax, ay) => p.solid(ax, ay, WRECK_RAMP, (wy - (top - 1)) * d < 1 ? 0.62 : 0.32));
        }
        const [mbx, mby] = world(fore(0.27, -0.66)), mast = 6.5;              // the mast on the bridge, its beacon at the top
        U.stroke(p, V2, mbx, mby, mbx + dir * 0.6, mby - mast, 0.5, (ax, ay) => { if (ax >= 0 && ay >= 0 && ax < p.W && ay < p.H) p.solid(ax, ay, WRECK_RAMP, 0.55); });
        site.live.transponder = { x: mbx + dir * 0.6, y: mby - mast - 0.6 };
        site.goalX = Math.round(xBreak - dir * 2);                            // to the break: the way in
    }
    if (SITES && SITES.paint && !SITES.dummyWreck) {                           // this dummy's own wreck, for its scenes only (S.dummyWreck)
        const basePaint = SITES.paint;
        SITES.paint = function (p, V2, S, g, rand) {
            const site = g.site;
            if (site && site.kind === 'wreck' && S && S.dummyWreck) { site.live = {}; site.stand = new Float32Array(W).fill(Infinity); paintWreck(p, V2, S, g, rand, site); site.standY = site.stand; return; }
            return basePaint.apply(this, arguments);
        };
        SITES.dummyWreck = true;
    }

    /** Where the find is, in world x (the walk's goal and the "on the spot" test). */
    function spot(G) {
        const g = G.g;
        if (g.site && g.site.goalX != null && G.siteKind) return g.site.goalX;
        if (G.flare) return G.flare.x;
        return lightAt(G).x;
    }
    function levelNear(G, x) { return (G.g.level || []).reduce((b, l) => (!b || Math.abs(l.cx - x) < Math.abs(b.cx - x) ? l : b), null); }
    /** The world point of the find's light (where its light sits on this ground). */
    function lightAt(G) {
        const g = G.g, m = g.mark, live = g.site && g.site.live;
        tame(G);
        if (G.mark === 'wreck' && G.beacon) return G.beacon;
        if (G.mark === 'signal' && G.sig) return G.sig;
        if (G.mark === 'colony' && live && live.dome) return { x: live.dome.cx, y: live.dome.baseY - 3 };
        if (G.mark === 'flare' && G.flare) return G.flare;
        if (!m) return { x: W / 2, y: 150 };
        if (!G.patch) { const side = m.cx < W / 2 ? 1 : -1, x = side > 0 ? m.x1 + 9 : m.x0 - 9; G.patch = { x, y: g.heights[Math.round(Math.max(0, Math.min(W - 1, x)))] - 0.5 }; }
        if (G.mark === 'machines' && G.posts) return { x: G.posts[1].x, y: G.posts[1].y };
        return G.patch;
    }
    /** The site's own lights that would compete with the find's: the wreck's transponder becomes our red beacon and its hull
        lamp goes out; the signal's beacon is drawn here (short rings close to the mast). The site's live state is made again
        each time a picture of it is painted, so this runs every frame, before LanderScene draws it. */
    function tame(G) {
        const g = G.g, live = g.site && g.site.live;
        if (live) {
            if (G.mark === 'wreck' && live.transponder) { G.beacon = { x: live.transponder.x, y: live.transponder.y }; live.transponder = null; }
            if (G.mark === 'wreck' && live.lamp) live.lamp = null;
            if (G.mark === 'signal' && live.beacon) { G.sig = { x: live.beacon.x, y: live.beacon.y }; live.beacon = null; }
        }
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // Drawing, every frame, in the art px of the picture being shown (CV: its view)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let CV = V;
    const TA = [0, 0];                                                     // toA's answer, reused (read it at once: the next call overwrites it)
    function toA(wx, wy) { TA[0] = (wx - CV.ox) * CV.d; TA[1] = (wy - CV.oy) * CV.d; return TA; }
    let pool = null;
    /** The lamp's pool under the shuttle at night: the lit picture shown through a whole dithered ellipse, brightest under
        the lamp and thinning to nothing at its edge, climbing whatever it touches; a faint dithered cone of the lamp's light
        joins the belly to it. Its spread and strength follow the height (masks on coarse steps, reused as it falls). */
    function lampPool(ctx, pic, G, s) {
        const g = G.g, x = Math.round(s.x), ground = g.heights[clampX(x)], d = CV.d;
        if (ground > H) return;
        const alt = Math.max(0, ground - (s.y + LG.LANDER_TALL));
        if (alt > POOL_ALT) return;
        const k = Math.round((1 - alt / POOL_ALT) * 6) / 6, rx = Math.round((9 + alt * 0.3) * d / 4) * 4, ry = Math.max(8, Math.round((6 + alt * 0.08) * d / 4) * 4);
        const cx = (s.x - CV.ox) * d, cy = (ground - 1 - CV.oy) * d, bx = Math.round(cx - rx), by = Math.round(cy - ry);
        if (!pool) { const c = document.createElement('canvas'); c.width = 260; c.height = 200; pool = { c, g: c.getContext('2d'), masks: new Map() }; }
        const key = rx + ':' + ry + ':' + k;
        let mask = pool.masks.get(key);
        if (!mask) {
            mask = document.createElement('canvas'); mask.width = rx * 2; mask.height = ry * 2;
            const mg = mask.getContext('2d'), img = mg.createImageData(rx * 2, ry * 2);
            for (let y = 0; y < ry * 2; y++) for (let xx = 0; xx < rx * 2; xx++) {
                const q = ((xx + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2;
                if (q < 1 && Math.pow(1 - q, 1.15) * (0.3 + 0.85 * k) > threshold(xx, y)) img.data[(y * rx * 2 + xx) * 4 + 3] = 255;
            }
            mg.putImageData(img, 0, 0);
            if (pool.masks.size > 40) pool.masks.clear();
            pool.masks.set(key, mask);
        }
        const pg = pool.g, w = Math.min(260, rx * 2), h = Math.min(200, ry * 2);
        pg.globalCompositeOperation = 'copy'; pg.drawImage(pic.lit, bx, by, w, h, 0, 0, w, h);
        pg.globalCompositeOperation = 'destination-in'; pg.drawImage(mask, 0, 0);
        pg.globalCompositeOperation = 'source-over';
        ctx.drawImage(pool.c, 0, 0, w, h, bx, by, w, h);
        const f = P.framer(ctx, CV.w, CV.h), [lx, ly] = toA(s.x, s.y + LG.LANDER_TALL - 0.5), ay1 = cy - ry * 0.3, span = ay1 - ly;   // the cone
        if (span < 4) return;
        for (let ay = Math.ceil(ly + 2); ay < ay1; ay++) {
            const t = (ay - ly) / span, hw = 1.2 * d + t * rx * 0.85, dens = (0.05 + 0.12 * k) * (1 - 0.45 * t);
            for (let ax = Math.floor(lx - hw); ax <= lx + hw; ax++) { const e = 1 - Math.abs(ax - lx) / hw; if (threshold(ax, ay) < dens * e) f.px(ax, ay, A.R.LAMP.hex[2]); }
        }
    }

    /** The place and what moves on it. o: { pic, nozzles, flash (lightning), bolt, gust: { k, warn, dir }, out, burn } */
    function draw(ctx, G, s, now, o) {
        o = o || {};
        const pic = o.pic || G.main, { g, scene } = G, night = G.tod === 'night' && pic.dark;
        CV = pic.V;
        tame(G);
        const back = o.flash || !night ? pic.lit : pic.dark;
        scene.close = { V: pic.V, done: !!back, canvas: back || pic.lit };     // drawLive draws the backdrop it finds here
        LS.drawLive(ctx, scene, G.gDraw, s, now, o.nozzles || [], pic.V);
        drawPoolFx(ctx, G, now);
        if (night && !o.flash && s && !s.hide && s.grade !== 'crash') { lampPool(ctx, pic, G, s); if (g.site && SITES) SITES.drawLive(ctx, g, now, pic.V, scene.S); }
        if (o.flash && o.bolt) bolt(ctx, G, o.bolt);
        G.lightDrawn = drawMark(ctx, G, now, o);
        if (o.gust && (o.gust.warn > 0 || o.gust.k > 0)) gustWisps(ctx, G, s, now, o.gust);
        else if (G.world.atm > 0 && g.wind) windSpecks(ctx, G, now);
    }
    /** The steady wind: a few specks of dust carried along it, each on its own slight wave (never a line). */
    function windSpecks(ctx, G, now) {
        const f = P.framer(ctx, CV.w, CV.h), g = G.g, air = G.S.airRamp || RP.ICE, sp = g.wind * 9, n = 16;
        for (let i = 0; i < n; i++) {
            const span = W - OX + 20, x = OX - 10 + ((((now / 1000) * sp * (0.7 + hash(i, 3, 29) * 0.6) + hash(i, 4, 29) * span) % span) + span) % span;
            const y = 20 + hash(i, 5, 29) * 125 + Math.sin(now / 700 + i * 1.9) * 1.5, [ax, ay] = toA(x, y);
            f.tone(ax, ay, air, 0.35 + 0.25 * hash(i, 6, 29), CV.d >= 3 && hash(i, 7, 29) > 0.5 ? 2 : 1, 1);
        }
    }

    /** The find's own light on the ground (the same as from orbit), and its little world: smoke, the pad's lamps, the posts. */
    function drawMark(ctx, G, now, o) {
        const f = P.framer(ctx, CV.w, CV.h), g = G.g, wind = Math.sign(g.wind || 0), night = G.tod === 'night', sc = 1.5 * CV.d;
        if (G.mark === 'colony' && G.lamps) G.lamps.forEach(l => { const [lx, ly] = toA(l.x, l.y); if (l.on) { f.glow(lx, ly, Math.round(2 * CV.d), RP.AMBER, 0.45); f.px(lx - 1, ly, RP.AMBER.hex[4], Math.round(CV.d), Math.round(CV.d)); } else f.px(lx - 1, ly, RP.HULL.hex[1], Math.round(CV.d), Math.max(1, Math.round(CV.d / 2))); });
        if (G.mark === 'machines' && G.posts) { let shown = false; G.posts.forEach(q => { const [lx, ly] = toA(q.x, q.y); shown = A.drawLight(f, 'machines', lx, ly, now, { post: true, scale: sc }) || shown; }); return shown; }
        if (G.mark === 'none') return false;
        if (G.mark === 'signal') return signalRings(f, G, now, o);
        if (G.mark === 'life') return lifePatch(f, G, now, night);
        const p = lightAt(G), [ax, ay] = toA(p.x, p.y);
        if (G.mark === 'flare' && !o.out && (o.burn == null || o.burn > 0)) flarePool(f, G, p, now, o.burn == null ? 1 : o.burn);
        return A.drawLight(f, G.mark, ax, ay, now, { night, scale: sc, wind, out: o.out, burn: o.burn, lit: true });   // on the ground its glow only brightens
    }
    /** The flare's red light on the ground round it (and on the walls and slopes it touches), flickering with it. */
    function flarePool(f, G, p, now, burn) {
        const g = G.g, d = CV.d, st = 1 / d, R0 = 15, fl = 0.8 + 0.2 * hash(Math.floor(now / 90) & 255, 3, 41);
        for (let wx = p.x - R0; wx <= p.x + R0; wx += st) {
            const top = U.hAt(g, wx); if (top > H) continue;
            for (let r = -0.5; r < 3; r += st) {
                const dist = Math.hypot(wx - p.x, (top + r - p.y) * 1.6) / R0; if (dist >= 1) continue;
                const a = Math.pow(1 - dist, 1.6) * 0.62 * burn * fl * (1 - r / 3.5), [ax, ay] = toA(wx, top + r);
                if (threshold(Math.round(ax), Math.round(ay)) < a) f.tone(ax, ay, RP.RED, 0.32 + 0.3 * a);
            }
        }
    }
    /** The old signal on the ground: its amber lamp on the mast and, with each flash, two or three short arcs close to it,
        each a step dimmer than the one inside it, 1-2 art px thick. */
    function signalRings(f, G, now, o) {
        const b = G.sig; if (!b || o.out) return false;
        const [ax, ay] = toA(b.x, b.y), d = CV.d, q = (now % 1800) / 1800, flash = q < 0.09, u = Math.max(1, Math.round(d / 2)), th = d >= 3 ? 2 : 1;
        f.glow(ax, ay, Math.round((flash ? 4 : 2) * d), RP.AMBER, flash ? 0.95 : q < 0.5 ? 0.5 : 0.28);
        f.px(ax - (u >> 1), ay - (u >> 1), flash ? '#fff3dc' : RP.AMBER.hex[3], u, u);
        for (let i = 0; i < 3; i++) {
            const age = q - (0.02 + i * 0.06);
            if (age < 0 || age > 0.33) continue;
            const hex = RP.AMBER.hex[Math.max(1, 4 - i - Math.floor(age / 0.11))], rad = (2.6 + i * 2.2) * d;
            [-1, 1].forEach(side => { for (let a = -0.55; a <= 0.55; a += 0.9 / rad) f.px(ax + side * Math.cos(a) * rad - (th >> 1), ay + Math.sin(a) * rad * 0.9, hex, th, th); });
        }
        return true;
    }
    /** Life: no flare. At night a teal patch on the ground breathing; by day a dark patch that moves. */
    function lifePatch(f, G, now, night) {
        const g = G.g, c = lightAt(G), w = 14, st = 1 / CV.d;
        for (let dx = -w; dx <= w; dx += st) {
            const wx = c.x + dx + (night ? 0 : Math.sin(now / 2600) * 6), col = Math.max(0, Math.min(W - 1, Math.round(wx))), top = U.hAt(g, wx);
            if (top > H || (g.hot[col] && !g.kind.sea)) continue;                    // over the sea it moves in the water
            const edge = 1 - Math.abs(dx) / w, ax = (wx - CV.ox) * CV.d, tx = Math.round(ax);
            for (let r = 0; r < 1.5; r += st) {
                const ay = (top - 0.5 + r - CV.oy) * CV.d, ty = Math.round(ay);
                if (night) { const b = 0.5 + 0.5 * Math.sin(now / 1300 + dx * 0.05); if (threshold(tx, ty) < edge * (0.5 + 0.4 * b)) f.tone(ax, ay, A.R.TEAL, 0.3 + 0.35 * b * edge); }
                else if (threshold(tx, ty) < edge * 0.85) f.px(ax, ay, r > 0.5 ? '#0a1317' : INK);
            }
        }
        return true;
    }
    /** Lightning: a jagged bolt from the cloud to the far ground, stepped per art px (2 px wide close up), and the sky
        under the deck flashing round where it leaves the cloud. */
    function bolt(ctx, G, b) {
        const f = P.framer(ctx, CV.w, CV.h), w = CV.d >= 3 ? 2 : 1;
        const [sx, sy] = toA(b.x, G.cloudBase + 4);
        f.glow(Math.round(sx), Math.round(sy + 10 * CV.d), Math.round(34 * CV.d / 2), BOLT, 0.42);
        let x = b.x, y = G.cloudBase + 4;
        while (y < b.y) {
            const ny = y + 3 + hash(Math.round(y) & 255, b.seed & 255, 3) * 5, nx = x + (hash(b.seed & 255, Math.round(y) & 255, 5) - 0.5) * 8;
            const ax0 = (x - CV.ox) * CV.d, ay0 = (y - CV.oy) * CV.d, ax1 = (nx - CV.ox) * CV.d, ay1 = (ny - CV.oy) * CV.d, n = Math.max(1, Math.ceil(Math.max(Math.abs(ax1 - ax0), Math.abs(ay1 - ay0))));
            for (let k = 0; k <= n; k++) f.px(Math.round(ax0 + (ax1 - ax0) * k / n), Math.round(ay0 + (ay1 - ay0) * k / n), k % 4 ? '#9cc4e8' : '#f2fbff', w, w);
            x = nx; y = ny;
        }
    }
    /** A gust: wisps of the air going by (uneven specks on a slight wave, with gaps, never a line), 0.8 s ahead of it and
        while it blows; and dust torn off the ground, lifting and carried downwind. */
    function gustWisps(ctx, G, s, now, gust) {
        const f = P.framer(ctx, CV.w, CV.h), air = G.S.airRamp || RP.ICE, dir = gust.dir || 1, k = Math.max(gust.warn, gust.k);
        const n = Math.round(4 + 9 * k);
        for (let i = 0; i < n; i++) {
            const y0 = (s ? s.y : 0) - 30 + hash(i, 4, 11) * 70, len = 9 + hash(i, 5, 11) * 14, sp = 120 + 80 * hash(i, 6, 11), ph = hash(i, 8, 11) * 6.28;
            const x0 = dir > 0 ? OX - 20 + ((now / 1000 * sp + hash(i, 7, 11) * 600) % (W - OX + 40)) : W + 20 - ((now / 1000 * sp + hash(i, 7, 11) * 600) % (W - OX + 40));
            for (let j = 0; j < len; j += 0.8 + hash((i * 5 + Math.round(j * 2)) & 255, 9, 11) * 1.3) {
                if (hash((i * 11 + Math.round(j * 3)) & 255, 12, 11) < 0.3) continue;
                const q = j / len, [ax, ay] = toA(x0 - dir * j, y0 + Math.sin(ph + j * 0.45 + now / 260) * 0.7);
                f.tone(ax, ay, air, (0.42 + 0.4 * k) * (1 - q * 0.8));
            }
        }
        if (gust.k <= 0.05) return;
        const g = G.g, dust = G.S.GRD;
        for (let i = 0; i < 34; i++) {
            const wx0 = hash(i, 21, 11) * W, top = U.hAt(g, wx0); if (top > H) continue;
            const age = ((now / 850) + hash(i, 22, 11)) % 1, [ax, ay] = toA(wx0 + dir * age * 28, top - 0.5 - age * 8 - Math.sin(age * 9 + i) * 0.8);
            f.tone(ax, ay, dust, (0.62 - 0.5 * age) * gust.k, CV.d >= 3 ? 2 : 1, 1);
        }
    }
    /** The cloud we fell out of: a ragged base across the top of the sky screen (baked in strips), drifting with the wind.
        Seen from under it: dark, lighter at its torn edge, in the world's own (muted) cloud colour. Airless worlds have none. */
    function cloudBake(G, tag) {
        if (!(G.world.atm > 0)) return null;
        const h = Math.ceil((G.cloudBase - OY + 14) * D), cloud = G.S.cloud || A.mute(RP.DUST), seed = (G.world.seed || 3) + 31, night = G.tod === 'night';
        return A.stripBake(V.w + 160, h, (p, y0) => {                         // 8-row strips: about 7000 px of noise a job
            for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
                const ay = y + y0, n = P.fbm(x / 70, ay / 26, seed, 3), edge = h - 1 - ay - (n - 0.4) * 34;
                if (edge < 0 || (edge < 8 && threshold(x, ay) > edge / 8)) continue;
                p.solid(x, y, cloud, (0.14 + 0.24 * n + (edge < 4 ? 0.14 : 0)) * (night ? 0.6 : 1));
            }
        }, tag, false, 8);
    }
    function cloudBase(ctx, G, now) {
        if (!G.cloud || !G.cloud.done) return;
        const drift = ((Math.round((now / 1000) * (G.g.wind0 || G.g.wind || 0.6) * 2) % 160) + 160) % 160;
        ctx.drawImage(G.cloud.canvas, -drift, 0);
    }

    // ── the ground far below, while the camera is still high ──
    /** Where the highest ground in the frame is, in art y, for the camera at cam (world px, top left). */
    function groundTopY(G, cam) {
        const g = G.g, x0 = Math.max(0, Math.floor(cam.ox + TOWER / D)), x1 = Math.min(W - 1, Math.ceil(cam.ox + FW / D));
        let top = H + 40;
        for (let x = x0; x <= x1; x++) if (g.heights[x] < top) top = g.heights[x];
        return (top - cam.oy) * D;
    }
    /** The far ground's textures (baked once a place): the near ground's face in value bands, lightest at the ridge and
        hazed in the air's colour; and a far range of hills, hazier still. Columns of these are laid under its outline. */
    const FAR_H = 72, HILL_H = 48;
    function farBake(G, tag) {
        const out = { near: null, hills: null, done: false, then: [] }, S = G.S, air = S.airRamp || RP.HAZE, grd = S.GRD || RP.STONE, night = G.tod === 'night' ? 0.55 : 1;
        const p = P.painter(FW, FAR_H, true), q = P.painter(FW, HILL_H, true), haze = G.world.atm > 0 ? 0.3 : 0.08, ROWS = 12;
        for (let y0 = 0; y0 < FAR_H; y0 += ROWS) A.later(() => {               // a few rows a job
            for (let y = y0; y < Math.min(FAR_H, y0 + ROWS); y++) for (let x = 0; x < FW; x++) {
                const n = P.vnoise(x / 9, y / 3, S.seed + 41) - 0.5, v = (0.14 + 0.36 * Math.exp(-y / 4) + 0.1 * Math.exp(-y / 16) + n * 0.12) * night;
                if (y === 0) p.solid(x, y, threshold(x, y) < haze + 0.25 ? air : grd, 0.5 * night);
                else if (threshold(x, y + 3) < haze * Math.exp(-y / 30)) p.solid(x, y, air, v * 0.8);
                else p.solid(x, y, grd, v * Math.max(0.25, 1 - y / FAR_H));
            }
        }, tag, false, 'far ground ' + y0);
        for (let y0 = 0; y0 < HILL_H; y0 += ROWS) A.later(() => {
            for (let y = y0; y < Math.min(HILL_H, y0 + ROWS); y++) for (let x = 0; x < FW; x++) {
                const n = P.vnoise(x / 14, y / 4, S.seed + 43) - 0.5, v = (0.12 + 0.18 * Math.exp(-y / 6) + n * 0.08) * night;
                q.solid(x, y, threshold(x, y + 1) < 0.55 + haze ? air : grd, v);
            }
        }, tag, false, 'far hills ' + y0);
        A.later(() => { out.near = p.canvas(); out.hills = q.canvas(); out.done = true; out.then.splice(0).forEach(fn => fn()); }, tag, false, 'far ground done');   // (the fix round: what waits on it is chained, never re-queued)
        return out;
    }
    const hillY = (S, wx) => 9 * Math.sin(wx * 0.019 + S.seed) + 5 * Math.sin(wx * 0.047 + S.seed * 0.7) + (P.vnoise(wx / 8, 3, S.seed + 5) - 0.5) * 5;
    /** The ground far below as layered hills at the frame's foot (its top pinned FAR_TOP px up), squeezed upright the farther
        it is: a far range, hazy, then the near ground's face in bands, its light on it and its lamps (a colony's windows, the
        machines' blink) seen through the air. Once the real ground reaches that line it takes over. */
    function farGround(ctx, G, cam, now, o) {
        const gy = groundTopY(G, cam), pin = FH - FAR_TOP;
        if (gy <= pin) return false;
        const g = G.g, S = G.S, c = Math.max(0.3, pin / gy), hmin = gy / D + cam.oy, night = G.tod === 'night', fade = Math.min(1, (gy - pin) / 24), T = G.far;
        ctx.save(); ctx.globalAlpha = fade;
        for (let ax = 0; ax < FW; ax++) {
            const wx = cam.ox + (ax + 0.5) / D, h = U.hAt(g, wx), y = h > H ? FH : Math.round(pin + (h - hmin) * D * c);
            const hy = Math.round(pin - 10 - 4 * c + hillY(S, wx * 1.6) * c);                   // the far range, above and behind
            if (T && T.done) {
                if (hy < y && hy < FH) ctx.drawImage(T.hills, ax, 0, 1, Math.min(HILL_H, Math.min(y, FH) - hy), ax, hy, 1, Math.min(HILL_H, Math.min(y, FH) - hy));
                if (y < FH) ctx.drawImage(T.near, ax, 0, 1, Math.min(FAR_H, FH - y), ax, y, 1, Math.min(FAR_H, FH - y));
            } else if (y < FH) { ctx.fillStyle = (S.GRD || RP.STONE).hex[1]; ctx.fillRect(ax, y, 1, FH - y); }
        }
        ctx.restore();
        const lp = lightAt(G), lx = (lp.x - cam.ox) * D, ly = Math.round(pin + (lp.y - hmin) * D * c) - 1;
        if (lx < TOWER || lx > FW || ly >= FH) return false;
        const f = P.framer(ctx, FW, FH);
        if (G.mark === 'colony' || G.mark === 'machines') [-14, -7, 9, 17].forEach((dx, i) => {          // their other lamps, small on the far ground
            const x = Math.round(lx + dx * c * 1.4), wx = cam.ox + (x + 0.5) / D, h = U.hAt(g, wx), y = Math.round(pin + (h - hmin) * D * c) - 1;
            if (h > H || y >= FH || x < TOWER) return;
            if (G.mark === 'colony') { if (i !== 2) f.px(x, y, RP.AMBER.hex[i % 2 ? 3 : 4]); }
            else if ((now % 1000) < 140) f.px(x, y, '#e1f6fb'); else f.px(x, y, A.R.LAMP.hex[2]);
        });
        return A.drawLight(f, G.mark, lx, ly, now, { night, cloud: 0.4, out: o && o.out, burn: o && o.burn });
    }

    /** The shuttle, its flames, and the crew stepping out; after a crash, the wreck. o: { pic, nozzles, brown, sputter, crash } */
    function drawShuttle(ctx, G, s, now, o) {
        o = o || {};
        const pic = o.pic || G.main;
        CV = pic.V;
        const f = P.framer(ctx, CV.w, CV.h), Ls = G.S.Ls || 1, rim = !!s.grade && G.directSun;   // the sun's edge only once it stands in direct sun
        if (s.grade === 'crash') { wreckArt(ctx, G, s, now, o.crash || {}); return; }
        if (s.crew && window.LanderCrew) window.LanderCrew.drawBehind(ctx, s.crew, G.g, now, CV, G.S);
        (o.nozzles || []).forEach(([nx, ny]) => { const [ax, ay] = toA(nx, ny); A.plume(f, ax, ay, CV.d, 1, o.sputter); });
        const [ax, ay] = toA(s.x, s.y);
        A.shuttle(ctx, CV.d, ax, ay, Ls, { cabin: true, rim, fold: o.fold == null ? 1 : o.fold });
        if (o.brown > 0) brownout(f, G, s, now, o.brown);
        if (s.crew && window.LanderCrew) window.LanderCrew.drawFront(ctx, s.crew, G.g, now, CV, G.S);
    }
    /** Dunes: below 16 px the thrusters raise a wall of dust round the shuttle. */
    function brownout(f, G, s, now, k) {
        const g = G.g, ground = g.heights[Math.max(0, Math.min(W - 1, Math.round(s.x)))], rp = G.S.GRD || RP.DUST, st = 1 / CV.d, d = CV.d, ox = CV.ox, oy = CV.oy;
        for (let dy = -12; dy <= 2; dy += st) for (let dx = -22; dx <= 22; dx += st) {
            const q = (dx / 22) ** 2 + ((dy + 2) / 12) ** 2;
            if (q > 1) continue;
            const n = hash((Math.round(dx * 2 + now / 60)) & 255, (Math.round(dy * 2 - now / 90)) & 255, 7);
            const ax = (s.x + dx - ox) * d, ay = (ground + dy - oy) * d;
            if (n * (1 - q) * 1.7 * k > threshold(Math.round(ax), Math.round(ay))) f.tone(ax, ay, rp, 0.3 + 0.35 * n);
        }
    }
    /** A crash: the flash, the pieces coming to rest, then our shuttle broken on its side (a leg snapped, a scorch under it,
        slow smoke, an ember), and the two climbing out: one lies hurt, the other kneels by them, then helps them away, the
        hurt one limping. c: { hurt, helper, mild } (ids; mild: no suits). */
    function wreckArt(ctx, G, s, now, c) {
        const f = P.framer(ctx, CV.w, CV.h), age = now - s.endedAt, t = age / 1000, d = CV.d, g = G.g;
        const ground = U.hAt(g, s.x), side = crashSide(s);
        const [fx, fy] = toA(s.x, s.y + 7), fx0 = fx, fy0 = fy;
        if (age < 120) {                                                          // the impact: a short lift of the light round it and a small hot core (never a lamp)
            const k = 1 - age / 120;
            f.glow(fx0, fy0, Math.round(3.5 * d), A.R.STEAM, 1.2 * k);
            for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI - Math.PI + (hash(i, 3, 61) - 0.5) * 0.5, r = (4 + 14 * hash(i, 4, 61)) * d * (0.4 + age / 200); f.px(fx0 + Math.cos(a) * r * 1.6, fy0 + Math.sin(a) * r * 0.45, i % 3 ? A.R.STEAM.hex[3] : A.R.STEAM.hex[4], Math.max(1, Math.round(d / 3)), 1); }   // sparks and grit thrown sideways
        }
        if (age < 420) A.puffs(f, Math.round(fx0), Math.round(fy0 + 2 * d), now, { n: 8, h: 6 * d, rate: 0.9, ramp: G.S.GRD || RP.STONE, wind: (s.vx >= 0 ? 1 : -1) * 2.4, big: d / 1.6, a: 0.7 * (1 - age / 420) });   // dust kicked sideways
        if (age > 160) {
            for (let dx = -12; dx <= 12; dx += 1 / d) {                            // the scorch it left
                const q = (dx / 12) ** 2, top = U.hAt(g, s.x + dx), ax = Math.round((s.x + dx - CV.ox) * d), ay = Math.round((top - CV.oy) * d);
                for (let r = 0; r < Math.max(1, d * 0.75); r++) if (threshold(ax, ay + r) < (1 - q) * 0.95) f.px(ax, ay + r, INK);
            }
            const [bx, by] = toA(s.x - side * 2, ground - SH_BELL - 2.4);
            A.shuttle(ctx, d, bx, by, side, { lean: side * 1.35, broken: true });
            const [ex, ey] = toA(s.x + side * 1.5, ground - 2);                   // what still burns
            f.glow(Math.round(ex), Math.round(ey), Math.round((1.6 + Math.sin(age / 90) * 0.3) * d), RP.AMBER, 0.4 + 0.12 * Math.sin(age / 70));
            A.puffs(f, Math.round(ex), Math.round(ey) - d, now, { n: 7, h: 22 * d, rate: 0.16, ramp: RP.STONE, wind: Math.sign(g.wind || 0) * 1.4, big: d / 2.2, a: 0.55 });
        }
        for (let i = 0; i < 14; i++) {                                           // the pieces: thrown out, then lying where they fell
            const angle = i * 2.4, speed = 14 + (i * 7) % 18, tt = Math.min(t, 0.75), px = s.x + Math.cos(angle) * speed * tt;
            const flyY = s.y + 4 - Math.abs(Math.sin(angle)) * speed * tt + 30 * tt * tt, py = Math.min(flyY, U.hAt(g, px) - 0.5), [ax, ay] = toA(px, py);
            if (i % 3 === 0) f.px(ax, ay, RP.HULL.hex[2], Math.max(1, Math.round(d * 0.75)), Math.max(1, Math.round(d * 0.5)));
            else if (t < 0.9) f.tone(ax, ay, A.R.STEAM, Math.max(0.2, 0.95 - t), 1, 1);
        }
        if (t > 0.9 && window.MiniCrew && c.hurt) crashCrew(ctx, G, s, t, c, side);
    }
    const SH_BELL = A.SH.BELL;
    const crashSide = s => (s.crashSide != null ? s.crashSide : (s.crashSide = s.vx >= 0 ? 1 : -1));
    /** Which way from x the ground is easier to walk (less climbing over the next 16 px); pref wins a tie. */
    function flatter(g, x, pref) {
        const climb = dir => { let worst = 0; const h0 = U.hAt(g, x); for (let k = 2; k <= 16; k += 2) { const h = U.hAt(g, x + dir * k); if (h > H || x + dir * k < 2 || x + dir * k > W - 3) return 99; worst = Math.max(worst, h0 - h); } return worst; };
        const a = climb(pref), b = climb(-pref);
        return b + 1.5 < a ? -pref : pref;
    }
    /** Where to look after a crash: between the broken shuttle and the two climbing out of it. */
    function crashFocus(G, s) { const away = flatter(G.g, s.x, -crashSide(s)), x = s.x + away * 8; return { x, y: U.hAt(G.g, x) - 6 }; }
    function crashCrew(ctx, G, s, t, c, side) {
        const MC = window.MiniCrew, g = G.g, d = CV.d, away = flatter(g, s.x, -side), h = 6.4 * d, light = (G.S.Ls || 1) < 0 ? -1 : 1, suit = !c.mild;
        const walk = Math.max(0, t - 2.0), x0 = s.x + away * 9, hurtX = x0 + away * (3 + walk * 4.2), helpX = hurtX + away * 3.2;
        const at = x => { const [ax, ay] = toA(x, U.hAt(g, x)); return [ax, ay]; };
        if (walk <= 0) {
            const [hx, hy] = at(x0 + away * 2), [kx, ky] = at(x0 + away * 5.5);
            MC.small(ctx, c.hurt, hx, hy, { h, pose: 'lie', facing: away, suit, light });
            MC.small(ctx, c.helper, kx, ky, { h, pose: 'kneel', facing: -away, suit, light });
            return;
        }
        const [hx, hy] = at(hurtX), [px, py] = at(helpX), limp = Math.abs(Math.sin(walk * 5)) * d * 0.6;
        MC.small(ctx, c.helper, px, py, { h, pose: 'walk', t: walk * 1000, facing: away, suit, light });
        MC.small(ctx, c.hurt, hx, hy + limp, { h, pose: 'walk', t: walk * 450, facing: away, suit, light });
    }

    window.LandingGround = Object.freeze({ V, D, OX, OY, W, H, LADDER, prepare, urgent, freeLadder, closeUp, draw, drawShuttle, farGround, groundTopY, crashFocus, spot, levelNear, lightAt, toA, levelStretches, markOf, SIGN, MARK });
})();
