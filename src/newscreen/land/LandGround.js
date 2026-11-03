/* ═══ Silent Exodus · new screen (?new=1) · land/LandGround.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/landing-ground.js (sha1 4745166b6ce3, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   GAME: prepare() takes the game's world (LandWorlds.js) and the site and wreck the game draws (App.handleEvaAction: the
   same as LanderGame gets): o.site, o.wreck. The sketch's own wreck (broken in two) is drawn only where LanderSites would
   draw it broken too (EXODUS_CACHE, or a story not known yet); a whole, burned or crater wreck is LanderSites' own.
   The split (2026-11-03, the house's 800-line limit): this file is the ground and its pictures (the stretch, the scene's
   look, the place's pictures at every size and their margins, the pools, the marks, where the find's light is, the far
   textures); LandSite.js paints our wreck (the sketch's own); LandGroundDraw.js draws every frame and makes
   window.LandingGround. The code moved as it was; their shared names are window.LandingGroundParts (made here).
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
   with a 12 px seam in the grain (GAME, the final check: by the field's own picture mirrored, no seam: margins). Under the
   deck the sky keeps a faint haze (UNDER_HAZE of the scene's own), not black.
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
    const LADDER = [0.26, 0.33, 0.41, 0.51, 0.64, 0.8], UNDER_HAZE = 0.25;   // DRAFT (round 3; meteor-land.js K.LADDER is the same list)
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
    /** The core of one size laid in a wider picture whose margins (MK world px each side, at most 600) carry the field's own
        picture on, mirrored at its edge and back again (GAME, the final check: the far hills' textures read as a pasted-on
        strip, a hard seam where they began, a dark hole at the foot): its ground line, its grain and its sky run on with no
        seam. What must not be seen twice is left out of the mirrored copies (the site's art, the colony's pad, the machines'
        posts: excluded), the ground line kept level across each cut (marginPath). Drawn by the canvas, a few copies each. */
    function margins(G, i, core, kOwn, onDone) {
        const L = G.ladder[i], go = () => {
            const k = kOwn || LADDER[i], dk = D * k, Vc = core.V, MK = Math.min(600, Math.ceil(FW / dk)), MP = Math.round(MK * dk), w = Vc.w + 2 * MP, h = Vc.h;
            const V2 = { d: dk, ox: Vc.ox - MP / dk, oy: Vc.oy, w, h };
            const srcs = core.dark ? [core.lit, core.dark] : [core.lit], out = srcs.map(() => null), jobs = [], path = { left: null, right: null };
            jobs.push(() => { const keep = keptColumns(G, Vc, dk); path.left = marginPath(G, Vc, dk, keep, MP, true); path.right = marginPath(G, Vc, dk, keep, MP, false); });
            srcs.forEach((src, si) => jobs.push(() => {
                const c = document.createElement('canvas'); c.width = w; c.height = h;
                const cg = c.getContext('2d'); cg.imageSmoothingEnabled = false;
                cg.drawImage(src, MP, 0);
                [path.left, path.right].forEach(pieces => pieces.forEach(q => mirrorPiece(cg, src, q, h)));
                out[si] = { c };
            }));
            srcs.forEach((src, si) => jobs.push(() => smoothFar(G, out[si].c, Vc, dk, MP, path)));   // GAME (the final check): no ruled rows or blocks where it is drawn shrunk
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
    /** GAME (the final check): the core's columns (art px) the margins may copy: all but the site's art (LandSite.js siteSpan),
        the colony's pad and the machines' posts and plates, MIRROR_SKIP world px kept off each. → [[from, to), ...] */
    const MIRROR_SKIP = 2, MIRROR_SHIFT = 30;                                 // world px; MIRROR_SHIFT: the most the ground line is moved to stay level
    function keptColumns(G, Vc, dk) {
        const cw = Vc.w, m = G.g.mark, parts = window.LandingGroundParts, skip = [], out = [];
        const span = parts && parts.siteSpan ? parts.siteSpan(G) : null;
        if (span) skip.push(span);
        if (G.mark === 'colony' && m) skip.push([m.x0, m.x1]);
        if (G.mark === 'machines' && G.posts) skip.push([Math.min(...G.posts.map(q => q.x)) - 10, Math.max(...G.posts.map(q => q.x)) + 12]);
        const cols = skip.map(([a, b]) => [Math.max(0, Math.floor((a - MIRROR_SKIP - Vc.ox) * dk)), Math.min(cw, Math.ceil((b + MIRROR_SKIP - Vc.ox) * dk))]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
        let at = 0;
        cols.forEach(([a, b]) => { if (a > at) out.push([at, a]); at = Math.max(at, b); });
        if (at < cw) out.push([at, cw]);
        return out.length ? out : [[0, cw]];
    }
    /** One margin as pieces of the core: walking in from the edge through the kept columns and back again (a mirror at each
        end), each piece { sx, n (its columns), dx (where it goes in the wide picture), flip, dy }; where the walk skips what is
        left out, the next piece moves up or down (dy, art px) so the ground line runs on level. MP: the margin's width. */
    function marginPath(G, Vc, dk, keep, MP, left) {
        const g = G.g, cw = Vc.w, rowOf = c => (U.hAt(g, Vc.ox + (c + 0.5) / dk) - Vc.oy) * dk, lim = MIRROR_SHIFT * dk, out = [];
        const up = keep.map(([s, e]) => ({ s, e, dir: 1 })), down = keep.slice().reverse().map(([s, e]) => ({ s, e, dir: -1 })), cycle = left ? up.concat(down) : down.concat(up);
        let dx = left ? MP : MP + cw, need = MP, last = left ? 0 : cw - 1, off = 0;
        for (let i = 0; need > 0 && i < 4000; i++) {
            const q = cycle[i % cycle.length], n = Math.min(q.e - q.s, need), first = q.dir > 0 ? q.s : q.e - 1;
            if (Math.abs(first - last) > 1) off = Math.max(-lim, Math.min(lim, off + rowOf(last) - rowOf(first)));
            const sx = q.dir > 0 ? q.s : q.e - n;
            out.push({ sx, n, dx: left ? dx - n : dx, flip: left ? q.dir > 0 : q.dir < 0, dy: Math.round(off) });
            dx = left ? dx - n : dx + n; need -= n;
            last = q.dir > 0 ? q.s + n - 1 : q.e - n;
        }
        return out;
    }
    /** One piece of a margin drawn (mirrored when flip); moved by dy, the rows it uncovers keep the piece unmoved under it. */
    function mirrorPiece(cg, src, q, h) {
        const draw = dy => {
            if (!q.flip) { cg.drawImage(src, q.sx, 0, q.n, h, q.dx, dy, q.n, h); return; }
            cg.save(); cg.translate(q.dx + q.n, 0); cg.scale(-1, 1); cg.drawImage(src, q.sx, 0, q.n, h, 0, dy, q.n, h); cg.restore();
        };
        if (q.dy) draw(0);
        draw(q.dy);
    }
    /** GAME (the final check): a far picture's grain averaged over 2 x 2 px deeper than DEEP world px under the drawn ground
        line and higher than ABOVE over it (the sky band it keeps). Both are dithered row by row; drawn shrunk, nearest
        neighbour, rows and columns drop out in a beat and read as ruled rows, a row of dark blocks under the planet's edge, a
        bright dashed row at the frame's foot. The ground's line and its lit edge keep their grain (what stands over it, a
        site's art too, is softened a little, as far off). c: the wide picture (its core at MP, its margins as path). */
    const DEEP = 3, ABOVE = 1.5;
    let farC = null;
    function smoothFar(G, c, Vc, dk, MP, path) {
        const w = c.width, h = c.height, g = G.g, rowOf = col => (U.hAt(g, Vc.ox + (col + 0.5) / dk) - Vc.oy) * dk;
        const line = new Float32Array(w);
        for (let x = 0; x < Vc.w; x++) line[MP + x] = rowOf(x);
        [path.left, path.right].forEach(pieces => pieces.forEach(q => { for (let j = 0; j < q.n; j++) line[q.dx + j] = rowOf(q.flip ? q.sx + q.n - 1 - j : q.sx + j) + q.dy; }));
        if (!farC) farC = [document.createElement('canvas'), document.createElement('canvas')].map(cv => cv.getContext('2d'));
        const [a, b] = farC;
        [a, b].forEach(t => { if (t.canvas.width !== w || t.canvas.height !== h) { t.canvas.width = w; t.canvas.height = h; } t.globalAlpha = 1; t.clearRect(0, 0, w, h); });
        a.drawImage(c, 0, 0); a.globalAlpha = 0.5; a.drawImage(c, 1, 0); a.globalAlpha = 1;   // each px with the one to its left
        b.drawImage(a.canvas, 0, 0); b.globalAlpha = 0.5; b.drawImage(a.canvas, 0, 1); b.globalAlpha = 1;   // and with the row above
        const cg = c.getContext('2d'), deep = DEEP * dk, above = ABOVE * dk, at = x => Math.min(w - 1, x);
        cg.save(); cg.beginPath();
        cg.moveTo(0, h); for (let x = 0; x <= w; x += 2) cg.lineTo(x, Math.min(h, line[at(x)] + deep)); cg.lineTo(w, h); cg.closePath();   // the deep ground
        cg.moveTo(0, 0); for (let x = 0; x <= w; x += 2) cg.lineTo(x, Math.max(0, line[at(x)] - above)); cg.lineTo(w, 0); cg.closePath();   // the sky band
        cg.clip();
        cg.drawImage(b.canvas, 0, 0);
        cg.restore();
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
    // (the split) for LandSite.js and LandGroundDraw.js (LandSite.js adds where the shuttle may stand; LandGroundDraw.js freezes it)
    window.LandingGroundParts = {
        P, RP, ramp, INK, clampX, H, U, clamp01, SITES, W, LAVA_DIM, V, LG, POOL_ALT, threshold, A, LS, OX, hash, BOLT, OY, D, TOWER, FW, FH, FAR_TOP, hillY,
        HILL_H, FAR_H, LADDER, SIGN, MARK, tame, lightAt, prepare, urgent, freeLadder, closeUp, spot, levelNear, levelStretches, markOf,
    };
})();
