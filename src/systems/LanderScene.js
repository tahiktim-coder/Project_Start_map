/* LanderScene — everything in the landing minigame that is not physics: the place you are landing on, in the travel
   view's look (2026-10-11; before that it was the old green-phosphor ground). The house style is docs/ART_STYLE.md:
   colour ramps that start at the ink, the 8 x 8 Bayer dither, seeded noise, one light, mostly dark.
   The physics stays on its 320 x 180 grid (LanderGame.js); the picture is painted in ART pixels, 2.25 per physics pixel
   (720 x 405, two screen pixels each in a 1080p window, like the travel view). Every painter here works per art pixel in
   WORLD coordinates through a view V = { d, ox, oy, w, h } (art pixels per world pixel, the world point at art 0,0), so the
   same place can be painted again sharper: after touchdown the camera closes in and the close-up is painted at 4.5.
   The world's colours are the travel view's for the same type (its palette: the orbit's own ramp, laid on the ink), so
   the ground you land on is the globe you saw from orbit. The sky is the travel view's space seen through this world's
   air: teal haze, cloud in the world's own accent (rust-gold over desert, teal over ice, violet over a gas giant), the far
   sun, a moon lit by it, stars where the air is thin. The ground's sun side is lit from the travel palette's bright steps;
   lava and water lie in basins with a crusted shore and the glow bleeding onto the rocks round them (drawing only).
   Nobody built anything on these worlds: the level ground you land on is just ground. A gas giant has no ground at all:
   there a floating rig with beacons and lift pods is the only place to set down. Strange worlds (crystal, mirror,
   singing, ghost, tomb, graveyard, hollow, living, machine, shattered, fungal, symbiote, rogue, radiation) get their
   own look; the flat strips you land on stay clear. The recipes come from window.MiniPaint (the travel view's Paint.js,
   copied for the minigames by art/MiniPaint.js), read when a landing starts, so this file needs nothing from src/newscreen/.
   build(g, planet, site, detail) → scene (or null without MiniPaint: LanderGame then draws its plain fallback)
   backdrop(scene, g, V) → { canvas, jobs }   a painting of the still place for view V, done one job at a time
   drawLive(ctx, scene, g, s, now, nozzles, V)   the still place plus what moves: pools, wind, fog, smoke, dust, the
                                                 lander's shadow, the strange worlds' motion, the site's lights, our ship above
   LanderSites.js paints the site (a wreck, ruins, graves, a dome, a beacon) through the same views. */

(function () {
    'use strict';
    const W = 320, H = 180, PAD_WIDTH = 42, D = 2.25, AW = 720, AH = 405, HORIZON = 150;
    const TICK = 125, MAX_PARTICLES = 120, SMOKE_LIFE = 1.3, DUST_LIFE = 0.8, DUST_HEIGHT = 30, BAND = 48;
    const LAVA_LEVEL = 146, SEA_LEVEL = 138, SHIP_BELLY = 5;                              // SHIP_BELLY: world y of our ship's underside at the top
    const clampX = x => Math.max(0, Math.min(W - 1, x));
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

    function seeded(id) {
        let s = 23;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }
    function hashId(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

    // ── views: art pixels per world pixel, and where the world sits ──
    function view(d, ox, oy, w, h) { return { d, ox: ox || 0, oy: oy || 0, w: w || Math.round(W * d), h: h || Math.round(H * d) }; }
    const MAIN = view(D, 0, 0, AW, AH);
    const toAX = (V, wx) => (wx - V.ox) * V.d, toAY = (V, wy) => (wy - V.oy) * V.d;
    /** Every art pixel of p inside the world box, with its world point: fn(wx, wy, ax, ay). */
    function region(p, V, x0, y0, x1, y1, fn) {
        const ax0 = Math.max(0, Math.floor(toAX(V, x0))), ax1 = Math.min(p.W, Math.ceil(toAX(V, x1)));
        const ay0 = Math.max(0, Math.floor(toAY(V, y0))), ay1 = Math.min(p.H, Math.ceil(toAY(V, y1)));
        for (let ay = ay0; ay < ay1; ay++) { const wy = V.oy + (ay + 0.5) / V.d; for (let ax = ax0; ax < ax1; ax++) fn(V.ox + (ax + 0.5) / V.d, wy, ax, ay); }
    }
    /** The ground's height at a world x between the physics columns (each column's height sits at its centre). */
    function hAt(g, wx) { const h = g.vis || g.heights, t = wx - 0.5, i = Math.floor(t), f = t - i, a = h[clampX(i)], b = h[clampX(i + 1)]; return a > H || b > H ? Math.min(a, b) : a + (b - a) * f; }
    /** Lava or water shows here: a flooded column, or drawn ground that sits at the flood line between two of them. */
    const isPool = (g, wx, level) => { const c = clampX(Math.floor(wx)); return !!g.hot[c] || (g.heights[c] >= level - 3 && (g.hot[clampX(c - 1)] || g.hot[clampX(c - 2)]) && (g.hot[clampX(c + 1)] || g.hot[clampX(c + 2)])); };
    /** The ground as it is drawn: the physics heights, with the roughest worlds' per-column jitter softened into rubble
        (level stretches are flat already, so they stay exactly where the lander's feet meet them). */
    function visualHeights(g) {
        if (!g.kind || g.kind.platform || g.kind.jag < 2.5) return g.heights;
        const v = new Float32Array(W);
        for (let x = 0; x < W; x++) v[x] = g.hot[x] ? g.heights[x] : 0.25 * g.heights[clampX(x - 1)] + 0.5 * g.heights[x] + 0.25 * g.heights[clampX(x + 1)];
        return v;
    }

    // ── the kit: the travel view's recipes (MiniPaint) and the few ramps of our own ──
    let KIT = null;
    function kit() {
        if (KIT) return KIT;
        const N = window.MiniPaint;
        if (!N) return null;
        const mk = (...hex) => N.ramp(N.INK, ...hex);
        KIT = {
            N, RP: N.RP, mk,
            LAVA: mk('#2a0c06', '#6a1e0c', '#c4461c', '#ff8a3c', '#ffd08a', '#fff0d0'),       // Worlds.js GLOW.lava
            AURORA: mk('#062018', '#0e4434', '#1f7a5c', '#5fd0a8', '#c8ffe8'),
            BIO: mk('#1c0a1a', '#401838', '#7e3a70', '#c870b0', '#f0b8e0'),
            TEAL_RIM: mk('#0a1a1a', '#14363a', '#22585c', '#3f8a88', '#7cc2b8'),
            TEAL_ATMO: mk('#081616', '#0f2a2c', '#1a4446', '#2c6966'),
            ACID_ATMO: mk('#141a06', '#2a3a0c', '#4e6a18', '#8aa83a', '#c8e070'),
            SMOKE: mk('#14181b', '#262c30', '#3c4448', '#5c666a'),
            GLASS: mk('#0a1820', '#16323e', '#2c5a68', '#6aa6b4', '#d6f2f8'),
            GREEN: mk('#0a1a10', '#163a22', '#2a6a3a', '#58a060', '#a8e098'),
            PANEL: mk('#0a1424', '#14263a', '#24466a', '#4a7aa8', '#9cc8e8'),
            DEAD: mk('#0c0e0e', '#1a1d1c', '#2c302e', '#464a46'),
            GOOD: '#7fd3a0', CAUTION: '#f0a24a', DANGER: '#e2574c', ICE: '#9fd8e6', ICE_DIM: '#3d6670', WARM: '#f7c483', WARM_DIM: '#8a5422',
        };
        return KIT;
    }

    // ── colours: the orbit's own, as the travel view's Worlds.js gives them (copied: src/newscreen is not always loaded) ──
    const SURFACE = { GAS: 'gas', ICE: 'ice', OCEAN: 'ice', VERDANT: 'desert', DESERT: 'desert', ROCK: 'rock', LAVA: 'rock', TOXIC: 'gas' };
    const LOOK = { DESERT: 'desert', SULFUR: 'desert', VOLCANIC: 'desert', TIDALLY_LOCKED: 'desert', RADIATION_BELT: 'desert', GAS_GIANT: 'gas', STORM_WORLD: 'gas',
        ICE_WORLD: 'ice', FROZEN_OCEAN: 'ice', OCEANIC: 'ice', CRYSTALLINE: 'ice', MIRROR: 'ice', EDEN: 'ice', VITAL: 'ice', TERRAFORMED: 'ice', SYMBIOTE_WORLD: 'ice', SINGING: 'ice',
        ROGUE: 'dark', GHOST_WORLD: 'dark', CARBON: 'dark', TOXIC: 'dark', BIO_MASS: 'dark', FUNGAL: 'dark' };
    const LIVING = { VITAL: 1, EDEN: 1, TERRAFORMED: 1, SYMBIOTE_WORLD: 1, OCEANIC: 1, FUNGAL: 1, BIO_MASS: 1 };
    const DUSTY = { DESERT: 1, SULFUR: 1, VOLCANIC: 1, RADIATION_BELT: 1 };
    const mixRgb = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const hexOf = rgb => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    function paletteOf(type) {
        const K = kit(), N = K.N, look = LOOK[type] || 'rock', mixHex = (a, b, k) => hexOf(mixRgb(N.hexRgb(a), N.hexRgb(b), k));
        const BR = window.BodyRendererClassic || window.BodyRenderer, pc = BR && typeof BR.palette === 'function' && type ? BR.palette(type) : null;
        const DC = window.DitherCore, DR = window.DitherRecipes, dr = DC && DC.isOn && DR && DR.TYPES && type ? DR.TYPES[type] : null;
        let out = { ramp: N.PLANET_RAMP[look] || K.RP.STONE, atmo: null, look };
        if (dr && Array.isArray(dr.ramp) && dr.ramp.length >= 4) {
            const stops = dr.ramp.slice(1).map(hexOf);
            out = { ramp: K.mk(...stops), atmo: K.mk(...stops.slice(0, 3)), look };
        } else if (pc && pc.cfg && pc.cfg.c0) {
            const c = pc.cfg, top = pc.fam === 'GAS' && c.band ? c.band : mixHex(c.c0, c.br || c.c0, 0.45);
            out = { ramp: K.mk(c.c2, mixHex(c.c2, c.c1, 0.5), c.c1, mixHex(c.c1, c.c0, 0.5), c.c0, top), atmo: K.mk(c.c2, c.c1, c.c0, c.col || c.c0), look };
        }
        out.air = type === 'TOXIC' ? K.ACID_ATMO : LIVING[type] ? K.TEAL_ATMO : DUSTY[type] ? K.RP.DUST : out.atmo || (look === 'desert' ? K.RP.DUST : K.RP.ICE);
        return out;
    }
    /** The ground's own ramp: one hue (the world's land colour) from the ink up, like the travel view's STONE or DESERT.
        The dark steps (shade mixed toward the land) are for the shadow side, the depths and the far ridges; the top steps
        are the travel palette's own bright middle and upper stops, so the sun side of a desert reads amber, as it does
        from orbit. Living worlds keep ocean blues in their low stops, so their land is the first stop that is not water. */
    function groundRamp(pal, kindName) {
        const K = kit(), stops = pal.ramp.rgb.slice(1), n = stops.length;
        const isBlue = c => c[2] > c[1] + 14 && c[2] > c[0] + 14;
        let landAt = Math.min(n - 1, Math.round((n - 1) * 0.66));
        if (kindName === 'green' || kindName === 'sea') { const k = stops.findIndex((c, i) => i >= Math.floor(n * 0.4) && i < n - 1 && !isBlue(c)); landAt = k >= 0 ? k : Math.floor(n * 0.55); }
        const land = stops[landAt], upper = stops[Math.min(n - 1, Math.max(landAt + 1, Math.round((n - 1) * 0.86)))];
        const shade = [11, 17, 21];                                                   // the teal-black of space in the shadows
        const ks = [0.1, 0.22, 0.4, 0.66];
        return K.mk(...ks.map(k => hexOf(mixRgb(shade, land, k))), hexOf(land), hexOf(mixRgb(land, upper, 0.6)), hexOf(mixRgb(upper, [255, 248, 236], 0.18)));
    }
    function waterRamp(pal) {
        const K = kit(), blues = pal.ramp.rgb.slice(1).filter(c => c[2] > c[0] + 10);
        if (blues.length < 2) return K.mk('#0a1830', '#143058', '#24548a', '#4a86c0', '#a8d0f0', '#eaf6ff');
        const b0 = blues[0], b1 = blues[Math.min(blues.length - 1, 1)], b2 = blues[blues.length - 1];
        return K.mk(hexOf(mixRgb([5, 7, 10], b0, 0.5)), hexOf(b0), hexOf(b1), hexOf(b2), hexOf(mixRgb(b2, [234, 246, 255], 0.55)), '#eaf6ff');
    }

    // ── the look of this landing: colours, air, the sun, a moon ──
    const AIR = { rock: 0.16, ice: 0.22, dunes: 0.34, lava: 0.22, green: 0.44, sea: 0.42, haze: 0.56, sky: 0.24 };
    function lookOf(g, planet) {
        const K = kit(), N = K.N, type = planet.type, kindName = g.kindName || 'rock', rand = seeded(planet.id + ':look');
        const pal = paletteOf(type), seed = hashId(planet.id) % 9973;
        const isRogue = type === 'ROGUE', sunLeft = rand() < 0.5;
        const sun = isRogue ? null : { x: sunLeft ? 30 + rand() * 90 : 200 + rand() * 90, y: type === 'TIDALLY_LOCKED' ? 92 + rand() * 8 : 18 + rand() * 44 };
        const Ls = sun ? (sun.x > W / 2 ? 1 : -1) : 1;
        const moonX = sun ? (sunLeft ? 170 + rand() * 120 : 30 + rand() * 120) : 60 + rand() * 200;
        const S = {
            N, K, type, kindName, kind: g.kind, seed, pal, sun, Ls, L3: N.norm3(Ls * 0.75, -0.55, 0.42),
            GRD: groundRamp(pal, kindName), air: isRogue ? 0 : AIR[kindName] || 0.2, airRamp: pal.air, airTop: g.kind.platform ? 45 : 55,
            haze: isRogue ? 0.5 : 1, dust: sun ? 0.8 : 0.2, rimRamp: LIVING[type] ? K.TEAL_RIM : K.RP.SUN,
            WATER: waterRamp(pal), stars: [],
            moon: isRogue || rand() < 0.15 ? null : { x: moonX, y: 22 + rand() * 40, r: 7 + rand() * 13, ramp: rand() < 0.5 ? K.RP.MOON : K.RP.PASSED, seed: seed + 5 },
        };
        S.sunK = S.sun ? wx => 0.72 + 0.28 * Math.max(0, 1 - Math.abs(wx - S.sun.x) / W) : () => 0.55;   // the ground is lit a little more toward the sun
        S.cloud = cloudRamp(K, type, pal.look);
        planPools(S, g);
        const starRand = seeded(planet.id + ':stars'), count = isRogue ? 220 : Math.round(520 * (1 - S.air));
        for (let i = 0; i < count; i++) S.stars.push({ x: starRand() * W, y: starRand() * 118, mag: starRand() });
        S.hotGlow = new Float32Array(W);                                                // how much lava glow each column of sky gets
        if (g.kind.pools) for (let x = 0; x < W; x++) { let k = 0; for (let d = -12; d <= 12; d++) if (g.hot[clampX(x + d)]) k += 1 - Math.abs(d) / 13; S.hotGlow[x] = Math.min(1, k / 9); }
        return S;
    }

    /** The colour of the cloud patches high in this world's sky (the travel view's rare accent, per world): rust-gold dust
        over desert and rock, teal over ice and living worlds, violet over a gas giant, cold grey over a dark world, acid over
        a toxic one. Dim ramps, so they stay an accent. */
    function cloudRamp(K, type, look) {
        if (type === 'TOXIC') return K.mk('#10140a', '#1e2a0e', '#334818', '#4e6a22');
        if (LIVING[type] || look === 'ice') return K.mk('#0a171a', '#12282e', '#1c3c44', '#2a5660', '#3f7480');
        if (look === 'gas') return K.mk('#120c1a', '#21162f', '#352348', '#4e3468', '#6a4a8a');
        if (look === 'dark') return K.mk('#0e1114', '#191e23', '#262d33', '#363f46');
        return K.RP.DUST;
    }

    /** Lava or water lies in basins: each flooded run of columns gets a floor that dips under the middle and rises to a thin
        sheet at the shore, so the pool sits in the ground instead of being cut straight down to the bottom of the picture.
        Drawing only: the physics (g.heights, g.hot) is untouched. S.floorAt(wx) is the world y of the basin floor (or -1),
        S.poolNear[x] how many columns column x is from the nearest pool. */
    const FLOOR_RES = 4;
    function planPools(S, g) {
        S.floorAt = () => -1; S.poolNear = null;
        if (!g.kind.pools && !g.kind.sea) return;
        const level = g.kind.sea ? SEA_LEVEL : LAVA_LEVEL, floor = new Float32Array(W * FLOOR_RES).fill(-1), near = new Float32Array(W).fill(99), N = S.N;
        let start = -1;
        for (let c = 0; c <= W; c++) {
            const on = c < W && isPool(g, c + 0.5, level);
            if (on && start < 0) start = c;
            if (on || start < 0) continue;
            const x0 = start, x1 = c, width = x1 - x0, deep = g.kind.sea ? H - level + 3 : Math.min(H - level + 3, 4 + width * 0.3);
            for (let i = x0 * FLOOR_RES; i < x1 * FLOOR_RES; i++) {                // banks that slope down from the shore to an uneven bed
                const wx = (i + 0.5) / FLOOR_RES, e = Math.min(wx - x0, x1 - wx), rough = (N.fbm(wx / 4, 3, S.seed + 31, 2) - 0.5) * 4;
                floor[i] = level + Math.max(1.4, Math.min(deep + rough, 1.4 + e * (0.75 + 0.5 * N.vnoise(wx / 9, 7, S.seed + 33)) + rough * 0.5));
            }
            for (let x = 0; x < W; x++) near[x] = Math.min(near[x], x < x0 ? x0 - x : x >= x1 ? x - x1 + 1 : 0);
            start = -1;
        }
        S.floorAt = wx => floor[Math.max(0, Math.min(floor.length - 1, Math.floor(wx * FLOOR_RES)))];
        S.poolNear = near;
        S.poolLevel = level;
    }

    // ── 1. the sky: the travel view's space through this world's air ──
    function paintSky(p, V, S, ay0, ay1) {
        const { N, RP } = S.K;
        for (let ay = ay0; ay < ay1; ay++) {
            const wy = V.oy + (ay + 0.5) / V.d, airRow = S.air * Math.pow(N.smooth(S.airTop, HORIZON, wy), 1.6);
            for (let ax = 0; ax < p.W; ax++) {
                const wx = V.ox + (ax + 0.5) / V.d;
                const reach = S.sun ? Math.exp(-Math.hypot(wx - S.sun.x, (wy - S.sun.y) * 1.3) / 80) : 0;
                const haze = Math.max(0, N.fbm(wx / 30, wy / 17, S.seed, 3) - 0.5) * 0.9 * S.haze;
                const dust = Math.max(0, N.fbm(wx / 21, wy / 11, S.seed + 7, 3) - 0.52) * 3.2 * S.dust * (0.05 + 0.9 * reach);
                const air = airRow * (0.8 + 0.4 * N.fbm(wx / 44, wy / 9, S.seed + 3, 2)) + reach * 0.16 * S.air + S.hotGlow[clampX(Math.floor(wx))] * 0.3 * N.smooth(90, HORIZON, wy);
                if (S.hotGlow[clampX(Math.floor(wx))] > 0.05 && air > 0.08 && N.threshold(ax, ay) < S.hotGlow[clampX(Math.floor(wx))] * 0.3 * N.smooth(118, HORIZON, wy)) p.solid(ax, ay, S.K.LAVA, 0.16);
                else if (air > 0.02 && air >= dust * 0.6 && N.threshold(ax, ay) < N.smooth(0.02, 0.1, air)) p.solid(ax, ay, S.airRamp, air);
                else if (dust > 0.12 && dust * 0.75 > haze) p.solid(ax, ay, S.cloud, dust);
                else if (haze > 0.03) p.solid(ax, ay, RP.HAZE, haze);
            }
        }
    }
    /** Stars where the air is thin, a moon lit by the far sun, and the sun itself (the warmest thing in the picture). */
    function paintHeavens(p, V, S) {
        const { N, RP } = S.K;
        S.bright = [];
        S.stars.forEach(st => {
            const ax = Math.floor(toAX(V, st.x)), ay = Math.floor(toAY(V, st.y)), airHere = S.air * Math.pow(N.smooth(S.airTop, HORIZON, st.y), 1.6);
            if (ax < 1 || ay < 1 || ax >= p.W - 1 || ay >= p.H - 1 || airHere > 0.22 * st.mag + 0.04) return;
            if (st.mag > 0.985) { p.set(ax, ay, RP.STAR.rgb[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => p.set(ax + dx, ay + dy, RP.STAR.rgb[2])); }
            else if (st.mag > 0.88) p.set(ax, ay, RP.STAR.rgb[3]);
            else p.set(ax, ay, RP.STAR.rgb[st.mag > 0.55 ? 2 : 1]);
            if (st.mag > 0.9) S.bright.push(st);
        });
        if (S.moon) {
            const m = S.moon, dx = S.sun ? S.sun.x - m.x : 1, dy = S.sun ? S.sun.y - m.y : -0.3, L = N.norm3(dx, dy, Math.hypot(dx, dy) * 0.32);
            N.sphere(p, { cx: toAX(V, m.x), cy: toAY(V, m.y), r: m.r * V.d, ramp: m.ramp, L, surface: N.surfaceFor('rock', m.seed, L), rim: 0.1, ambient: 0.01, gain: 0.8, dim: 1 - S.air * 0.6 });
        }
        if (S.sun) N.lightGlow(p, toAX(V, S.sun.x), toAY(V, S.sun.y), { core: 1.3 * V.d, halo: 6 * V.d, strength: 0.75, spikes: 4 * V.d });
    }

    // ── 2. the land: far ridges in the air, the ground itself (lit from the sun's side), cloud decks on a gas giant ──
    const ridgeFar = (S, wx) => 116 + 10 * Math.sin(wx * 0.017 + S.seed) + 6 * Math.sin(wx * 0.043 + S.seed * 0.7) - 8 * Math.pow(Math.abs(Math.sin(wx * 0.009 + S.seed)), 3) + (S.K.N.fbm(wx / 9, 3, S.seed, 3) - 0.5) * 6;
    const ridgeNear = (S, wx) => 128 + 7 * Math.sin(wx * 0.023 + S.seed * 1.3) + 4 * Math.sin(wx * 0.061 + S.seed) + (S.K.N.fbm(wx / 6, 7, S.seed + 2, 3) - 0.5) * 5;
    function paintLand(p, V, S, g, ay0, ay1) {
        const N = S.K.N, kn = S.kindName, ax0 = 0, ax1 = p.W, pool = g.kind.sea ? SEA_LEVEL : g.kind.pools ? LAVA_LEVEL : 0;
        const tops = [], slopes = [], far = [], near = [];
        for (let ax = ax0; ax < ax1; ax++) {
            const wx = V.ox + (ax + 0.5) / V.d;
            tops.push(g.kind.platform ? Infinity : hAt(g, wx)); slopes.push((hAt(g, wx + 2.2) - hAt(g, wx - 2.2)) * 0.3);   // the light follows the ground's shape, not each pebble (no lit streaks)
            far.push(ridgeFar(S, wx)); near.push(ridgeNear(S, wx));
        }
        for (let ay = ay0; ay < ay1; ay++) {
            const wy = V.oy + (ay + 0.5) / V.d;
            for (let ax = ax0; ax < ax1; ax++) {
                const wx = V.ox + (ax + 0.5) / V.d, k = ax - ax0, top = tops[k], col = clampX(Math.floor(wx));
                if (g.kind.platform) { paintCloud(p, S, wx, wy, ax, ay); continue; }
                if (wy >= top) {
                    if (!pool || !isPool(g, wx, pool)) paintGround(p, V, S, wx, wy, ax, ay, wy - top, slopes[k], kn);
                    else if (wy > S.floorAt(wx)) paintBasin(p, V, S, wx, wy, ax, ay, wy - S.floorAt(wx), !!g.kind.sea);
                    continue;
                }
                if (wy >= near[k]) { const edge = (wy - near[k]) * V.d < 1; p.solid(ax, ay, S.GRD, edge ? 0.27 : 0.15 + 0.06 * N.fbm(wx / 5, wy / 3, S.seed + 9, 2)); continue; }
                if (wy >= far[k]) {
                    const depth = wy - far[k], airK = S.air * 0.6 * (1 - Math.min(1, depth / 9));
                    if (airK > 0.05 && N.threshold(ax, ay) < airK) p.solid(ax, ay, S.airRamp, 0.18 + S.air * 0.3);
                    else p.solid(ax, ay, S.GRD, (depth * V.d < 1 ? 0.13 : 0.06) + 0.03 * N.fbm(wx / 8, wy / 4, S.seed + 4, 2));
                }
            }
        }
    }
    /** One pixel of ground, depth (world px) under the surface; slope: dy/dx there (light comes from the sun's side). */
    function paintGround(p, V, S, wx, wy, ax, ay, depth, slope, kn) {
        const N = S.N, lit = clamp01(0.5 + slope * S.Ls * 0.55), sunK = S.sunK(wx);
        if (S.poolNear && kn === 'lava' && poolGlow(p, V, S, wx, wy, ax, ay)) return;
        if (depth * V.d < 1.05) {                                                           // the surface line: lit where it faces the sun
            if (lit > 0.72 && S.sun) { p.solid(ax, ay, S.rimRamp, 0.34 + 0.36 * (lit - 0.72) / 0.28); return; }
            p.solid(ax, ay, S.GRD, (0.5 + 0.34 * lit) * (0.82 + 0.18 * sunK) + (kn === 'ice' ? 0.06 : 0)); return;
        }
        const tex = N.fbm(wx / 7, wy / 3.5, S.seed + 11, 3) - 0.5, strata = 0.06 * Math.sin(wy * 0.55 + wx * 0.03 + tex * 4);
        let v = 0.08 + Math.exp(-depth / 9) * (0.28 + 0.4 * lit * sunK) + lit * 0.06 * Math.exp(-depth / 3) + tex * 0.13 + strata * 0.7 + (S.N.hash(Math.floor(wx * 1.5), Math.floor(wy * 1.5), 9) > 0.93 ? 0.06 : 0);
        if (kn === 'ice') { v += 0.06 * Math.exp(-depth / 16); if (Math.abs(N.vnoise(wx / 5, wy / 3, S.seed + 5) - 0.5) < 0.025 * D / V.d) v -= 0.14; }
        else if (kn === 'dunes') v += 0.06 * Math.sin(wx * 0.9 + wy * 1.7 + tex * 3) * Math.exp(-depth / 8);
        else if (kn === 'lava') { v *= 0.78; if (depth < 18 && Math.abs(N.fbm(wx / 12, wy / 7, S.seed + 8, 3) - 0.5) < (0.004 + 0.006 * Math.exp(-depth / 3)) * D / V.d) { p.solid(ax, ay, S.K.LAVA, 0.5 - depth / 50); return; } }
        else if (kn === 'green' && depth < 3) v += 0.06;
        p.solid(ax, ay, S.GRD, v);
    }
    /** The lava's glow bleeding onto the rocks round a pool: strongest at the shore, at the flood line. True when it painted. */
    function poolGlow(p, V, S, wx, wy, ax, ay) {
        const dx = S.poolNear[clampX(Math.floor(wx))]; if (dx > 9) return false;
        const k = Math.exp(-dx / 3.2) * Math.exp(-Math.abs(wy - S.poolLevel) / 4.5);
        if (k < 0.06 || S.N.threshold(ax, ay) >= k * 0.7) return false;
        p.solid(ax, ay, S.K.LAVA, 0.2 + 0.26 * k);
        return true;
    }
    /** The basin under a pool: the same rock as the ground round it (so no wall shows at the shore), hot where the lava
        touches it, a little darker under water. */
    function paintBasin(p, V, S, wx, wy, ax, ay, under, isSea) {
        const N = S.N;
        if (!isSea && under < 2.6 && N.threshold(ax, ay) < 0.85 - under * 0.28) { p.solid(ax, ay, S.K.LAVA, 0.34 - under * 0.06); return; }
        paintGround(p, V, S, wx, wy, ax, ay, wy - S.poolLevel + (isSea ? 6 : 3), 0, S.kindName);
    }
    /** A gas giant's three cloud decks under the rig, the nearest brightest, banded in the world's own colours. */
    const DECKS = [[112, 0.011, 0.22], [134, 0.019, 0.32], [156, 0.031, 0.44]];
    function paintCloud(p, S, wx, wy, ax, ay) {
        const N = S.N;
        for (let i = DECKS.length - 1; i >= 0; i--) {
            const [base, freq, bright] = DECKS[i], top = base + 6 * Math.sin(wx * freq * 3 + S.seed + i) + 3 * Math.sin(wx * freq * 7 + S.seed * 2) - 7 * Math.pow(N.fbm(wx / 7, i * 5, S.seed + i, 4), 2) + 2;
            if (wy < top) continue;
            const d = wy - top, slope = Math.cos(wx * freq * 3 + S.seed + i) * S.Ls, band = N.fbm(wx / 22, wy / 5, S.seed + i, 3);
            p.solid(ax, ay, S.pal.ramp, bright * (0.5 + 0.7 * band) * Math.exp(-d / 18) + (d * 2.25 < 1.2 ? 0.1 + 0.08 * slope : 0) + 0.06 * Math.max(0, slope) * Math.exp(-d / 4));
            return;
        }
    }

    // ── 3. dressing: what grows, juts or lies on the surface, kept off the level ground and the site ──
    const DRESSING_GAP = 3;
    const isOnLevel = (g, x) => (g.level || []).some(l => x >= l.x0 - DRESSING_GAP && x <= l.x1 + DRESSING_GAP);
    const isOnSite = (g, x) => !!g.site && x >= g.site.x0 - DRESSING_GAP * 2 && x <= g.site.x1 + DRESSING_GAP * 2;
    const isFreeGround = (g, x) => x > 2 && x < W - 3 && !g.hot[x] && g.heights[x] < H && !isOnLevel(g, x) && !isOnSite(g, x);
    const groundAt = (g, x) => g.heights[clampX(Math.round(x))];
    function freeSpots(g, rand, count, gap) {
        const spots = [];
        for (let tries = 0; spots.length < count && tries < count * 20; tries++) {
            const x = 6 + Math.floor(rand() * (W - 12));
            if (isFreeGround(g, x) && spots.every(o => Math.abs(o - x) >= gap)) spots.push(x);
        }
        return spots;
    }
    /** A body lit from the sun's side: an ellipse (world units) shaded as a lump, cut at the ground. */
    function lump(p, V, S, g, cx, cy, rx, ry, ramp, gain, cut) {
        const L = S.L3;
        region(p, V, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (wx, wy, ax, ay) => {
            const nx = (wx - cx) / rx, ny = (wy - cy) / ry, q = nx * nx + ny * ny;
            if (q >= 1 || (cut !== false && wy > hAt(g, wx) + 0.6)) return;
            const nz = Math.sqrt(1 - q), lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
            p.solid(ax, ay, ramp, (0.08 + 0.55 * lam) * (gain || 1) + (q > 0.8 && lam > 0.6 ? 0.1 : 0));
        });
    }
    /** A spire from the ground up: lit on the sun's side, a glint at the tip. */
    function spire(p, V, S, x, base, tall, half, lean, ramp, gain) {
        region(p, V, x - half - Math.abs(lean) * tall - 1, base - tall - 1, x + half + Math.abs(lean) * tall + 1, base + 1, (wx, wy, ax, ay) => {
            const t = (base - wy) / tall; if (t < 0 || t > 1) return;
            const cx = x + lean * tall * t, hw = half * (1 - t) + 0.25, side = (wx - cx) / hw;
            if (Math.abs(side) > 1) return;
            p.solid(ax, ay, ramp, ((side * S.Ls > 0.35 ? 0.62 : side * S.Ls > -0.3 ? 0.4 : 0.22) + (t > 0.9 ? 0.15 : 0)) * (gain || 1));
        });
    }
    /** A stroke between two world points, w world px wide. */
    function stroke(p, V, x0, y0, x1, y1, w, fn) {
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * V.d * 1.5));
        for (let k = 0; k <= n; k++) {
            const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, r = Math.max(0.5, w * V.d / 2);
            for (let dy = -r + 0.5; dy < r; dy++) for (let dx = -r + 0.5; dx < r; dx++) fn(Math.floor(toAX(V, x) + dx), Math.floor(toAY(V, y) + dy), t);
        }
    }

    function paintDressing(p, V, S, g, rand) {
        const kn = S.kindName, K = S.K;
        for (let k = 0; k < 26; k++) {
            const x = Math.floor(rand() * W), top = groundAt(g, x), r1 = rand(), r2 = rand();
            if (!isFreeGround(g, x)) continue;
            if (kn === 'ice') spire(p, V, S, x + 0.5, top + 1, 4 + r1 * 9, 1 + r2 * 1.2, (r2 - 0.5) * 0.3, S.GRD, 1.15);
            else if (kn === 'green' && k % 3 === 0) { stroke(p, V, x + 0.5, top + 1, x + 0.5, top - 5, 0.9, (ax, ay) => p.solid(ax, ay, S.GRD, 0.14)); lump(p, V, S, g, x + 0.5, top - 7, 3 + r1 * 2, 2.4 + r2, S.GRD, 0.85, false); }
            else if (kn === 'green') lump(p, V, S, g, x + 0.5, top, 1.6 + r1, 1.4, S.GRD, 0.9);
            else if (kn === 'haze') { const tall = 4 + r1 * 6; stroke(p, V, x + 0.5, top + 1, x + 0.5 + (r2 - 0.5) * 2, top - tall, 0.7, (ax, ay) => p.solid(ax, ay, S.GRD, 0.12)); }
            else if (kn === 'lava') { let cx = x; for (let d = 1; d < 9; d++) { cx += rand() < 0.5 ? -0.6 : 0.6; region(p, V, cx, top + d, cx + 0.45, top + d + 1, (wx, wy, ax, ay) => p.solid(ax, ay, K.LAVA, d < 4 ? 0.55 : 0.36)); } }
            else if (kn === 'dunes') { /* the ripples are in the ground itself */ }
            else lump(p, V, S, g, x + 0.5, top - 0.3, 1.4 + r1 * 2.2, 1 + r1 * 1.5, S.GRD, 1.1);
        }
    }

    // ── 4. the gas-giant rig: a floating deck, girders hanging under it, two lift pods, beacon masts ──
    function paintPlatform(p, V, S, g) {
        const HULL = S.K.RP.HULL, x = g.padX, y = g.padY;
        region(p, V, x, y, x + PAD_WIDTH, y + 2, (wx, wy, ax, ay) => p.solid(ax, ay, HULL, wy - y < 2 / V.d ? 0.78 : 0.4));                                // the deck plate, its lit edge
        region(p, V, x, y + 2, x + PAD_WIDTH, y + 3, (wx, wy, ax, ay) => p.solid(ax, ay, Math.floor((wx - x) / 4) % 2 ? S.K.mk('#2a1c0c', '#5a3a14', '#8a5422') : HULL, 0.5));   // the hazard band
        region(p, V, x + 2, y + 3, x + PAD_WIDTH - 2, y + 16, (wx, wy, ax, ay) => {                                                                        // the truss, tapering
            const d = wy - y - 3, inset = d * 0.9; if (wx < x + 2 + inset || wx > x + PAD_WIDTH - 2 - inset) return;
            const u = wx - x, isBar = Math.abs(((u + d) % 6 + 6) % 6 - 3) < 0.45 || Math.abs(((u - d) % 6 + 6) % 6 - 3) < 0.45 || d < 0.6;
            if (isBar) p.solid(ax, ay, HULL, 0.32 - d * 0.012);
        });
        [x - 5, x + PAD_WIDTH].forEach(px => region(p, V, px, y - 1, px + 5, y + 5, (wx, wy, ax, ay) => p.solid(ax, ay, HULL, 0.3 + (wy < y ? 0.3 : 0))));        // the pod housings
        [x - 1, x + PAD_WIDTH].forEach(px => region(p, V, px, y - 4, px + 1, y, (wx, wy, ax, ay) => p.solid(ax, ay, HULL, 0.45)));                             // beacon masts
    }

    // ── 5. strange worlds: the places that should not look like anywhere else ──
    function paintCrystals(p, V, S, g, rand) {
        S.glints = freeSpots(g, rand, 11, 14).map(x => {
            const top = groundAt(g, x), tall = 12 + rand() * 18, half = 2 + rand() * 1.5, lean = (rand() < 0.5 ? -1 : 1) * 0.18;
            spire(p, V, S, x + 0.5, top + 1, tall, half, lean, S.K.GLASS, 1.2);
            return { x: x + 0.5 + lean * tall, y: top - tall + 1 };
        });
    }
    /** The ground is a mirror: the sky shines back up out of it (done on the painted pixels, at any density). */
    function paintMirror(p, V, S, g) {
        const STRETCH = 2.4, src = new Uint8ClampedArray(p.data);
        for (let ax = 0; ax < p.W; ax++) {
            const wx = V.ox + (ax + 0.5) / V.d, top = hAt(g, wx), col = clampX(Math.floor(wx));
            if (top > H || g.hot[col]) continue;
            for (let ay = Math.ceil(toAY(V, top)); ay < p.H; ay++) {
                const d = (ay - toAY(V, top)), sy = Math.round(toAY(V, top) - d * STRETCH); if (sy < 0) break;
                const si = (sy * p.W + ax) * 4, di = (ay * p.W + ax) * 4, fade = 0.95 - d / (90 * V.d), glint = Math.floor(wx * 0.6 + d / V.d * 1.3) % 23 === 0 ? 22 : 0;
                p.data[di] = Math.min(255, src[si] * fade * 0.95 + 10 + glint); p.data[di + 1] = Math.min(255, src[si + 1] * fade * 0.95 + 14 + glint); p.data[di + 2] = Math.min(255, src[si + 2] * fade * 0.95 + 22 + glint);
            }
            const e = (Math.max(0, Math.floor(toAY(V, top))) * p.W + ax) * 4; if (toAY(V, top) >= 0 && toAY(V, top) < p.H) { p.data[e] = 214; p.data[e + 1] = 230; p.data[e + 2] = 236; }
        }
    }
    function paintPillars(p, V, S, g, rand) {                                  // hollow stone columns full of holes; the wind sings through them
        S.pillars = freeSpots(g, rand, 9, 22).map(x => {
            const top = groundAt(g, x), tall = 34 + rand() * 34, half = 3;
            region(p, V, x - half, top - tall, x + half + 1, top + 1, (wx, wy, ax, ay) => {
                const side = (wx - x - 0.5) / half, d = top - wy, isHole = Math.abs(side) < 0.4 && d % 8 > 3 && d % 8 < 5.2 && d > 4;
                p.solid(ax, ay, S.GRD, isHole ? 0 : 0.18 + 0.32 * clamp01(0.5 + side * S.Ls * 0.7) + (S.N.fbm(wx / 2, wy / 4, S.seed, 2) - 0.5) * 0.12);
            });
            return { x: x + 0.5, y: top - tall, phase: rand() * 1600 };
        });
    }
    function paintGhostRidge(p, V, S, g) {                                     // a see-through copy of the ground hangs above the real one
        region(p, V, 0, 20, W, H, (wx, wy, ax, ay) => {
            const y0 = hAt(g, wx - 14) - 34; if (y0 < 30 || wy < y0 || wy > y0 + 26 || wy > hAt(g, wx) - 2) return;
            if ((wy - y0) * V.d < 1) p.solid(ax, ay, S.pal.ramp, 0.38); else if (S.N.threshold(ax, ay) < 0.24 - (wy - y0) * 0.01) p.solid(ax, ay, S.pal.ramp, 0.22);
        });
    }
    function paintMarkers(p, V, S, g) {                                        // rows of grave markers, as far as you can see
        [[0, 0], [3, -3]].forEach(([shift, lift]) => {
            for (let x = 4 + shift; x < W - 4; x += 7) {
                if (!isFreeGround(g, x)) continue;
                const top = groundAt(g, x) + lift;
                region(p, V, x, top - 5, x + 3, top, (wx, wy, ax, ay) => p.solid(ax, ay, S.K.RP.STONE, (lift ? 0.22 : 0.4) + ((wy - top + 5) * V.d < 1 ? 0.25 : 0) + ((wx - x) * S.Ls > 1.5 ? 0.08 : 0)));
            }
        });
    }
    /** Dead ships of our own hull class, broken and half in the ground, as far as you can see. */
    function paintHullDebris(p, V, S, g, rand) {
        freeSpots(g, rand, 5, 46).forEach((x, i) => {
            const len = 26 + rand() * 22, dir = rand() < 0.5 ? 1 : -1, cut = i % 2 ? { from: 0.3 + rand() * 0.2 } : { to: 0.55 + rand() * 0.3 };
            const y = groundAt(g, x + dir * len / 2) - len * 0.31 * 0.2;
            buriedHull(p, V, S, g, { x: x + dir * len / 2, y, len, angle: (rand() - 0.5) * 0.3, flip: dir < 0, ramp: S.K.RP.RUST, rust: 1, holes: 0.62, seed: 40 + i, light: 0.95, ...cut });
        });
    }
    /** Our Lander's hull (MiniPaint.hull) painted at this view's density, kept only above the ground: half buried. */
    function buriedHull(p, V, S, g, o) {
        const N = S.N, len = o.len * V.d, ht = len * 0.31, box = Math.ceil(len * 1.05) + 8, q = N.painter(box * 2, box * 2, false);
        const at = N.hull(q, { x: box, y: box, len, ht, angle: o.angle || 0, flip: !!o.flip, anchor: o.anchor == null ? 0.5 : o.anchor, ramp: o.ramp, light: o.light, rust: o.rust, holes: o.holes, from: o.from, to: o.to, seed: o.seed }, N.shapeL);
        const ox = Math.round(toAX(V, o.x)) - box, oy = Math.round(toAY(V, o.y)) - box, bury = o.bury || 0;
        for (let y = 0; y < q.H; y++) for (let x = 0; x < q.W; x++) {
            const i = (y * q.W + x) * 4; if (!q.data[i + 3]) continue;
            const ax = ox + x, ay = oy + y; if (ax < 0 || ay < 0 || ax >= p.W || ay >= p.H) continue;
            const wx = V.ox + (ax + 0.5) / V.d, wy = V.oy + (ay + 0.5) / V.d, ground = Math.min(hAt(g, wx), o.dirt ? o.dirt(wx) : Infinity);
            if (wy > ground + bury) continue;
            p.set(ax, ay, [q.data[i], q.data[i + 1], q.data[i + 2]]);
        }
        return (u, v) => { const [x, y] = at(u, v); return [V.ox + (ox + x) / V.d, V.oy + (oy + y) / V.d]; };
    }
    function paintHoles(p, V, S, g, rand) {                                    // round holes into the dark, with a light far down in some
        S.holes = freeSpots(g, rand, 6, 26).map(x => {
            const top = groundAt(g, x) + 3, r = 4 + rand() * 4;
            region(p, V, x - r * 2 - 1, top - r - 1, x + r * 2 + 1, top + r + 1, (wx, wy, ax, ay) => {
                const q = ((wx - x) / (r * 2)) ** 2 + ((wy - top) / r) ** 2, surface = hAt(g, wx);
                if (q < 1 && wy >= surface - 0.2) p.solid(ax, ay, S.GRD, q > 0.8 && (wx - x) * S.Ls < 0 ? 0.3 : 0);
            });
            return { x, y: top + 1, lit: rand() < 0.6 };
        });
    }
    function paintVeins(p, V, S, g, rand) {                                    // the ground is alive: veins running under the skin
        S.veins = [];
        for (let v = 0; v < 9; v++) {
            let x = rand() * W, depth = 3 + rand() * 10;
            for (let k = 0; k < 60; k++) {
                x += (rand() - 0.5) * 1.6; depth = Math.max(2, depth + (rand() - 0.5) * 0.8);
                const col = clampX(Math.floor(x)), y = hAt(g, x) + depth;
                if (y < H && !g.hot[col]) { region(p, V, x, y, x + 0.7, y + 0.7, (wx, wy, ax, ay) => p.solid(ax, ay, S.K.BIO, 0.35)); S.veins.push([x, y, k + v * 7]); }
            }
        }
    }
    function paintPlating(p, V, S, g, rand) {                                  // machine ground: plates, seams, small lights
        region(p, V, 0, 60, W, H, (wx, wy, ax, ay) => {
            const top = hAt(g, wx); if (top > H || wy < top + 1 || g.hot[clampX(Math.floor(wx))]) return;
            if (Math.abs((wx % 12) - 6) > 5.6 || Math.abs(((wy - top) % 9) - 4.5) > 4.2) p.solid(ax, ay, S.GRD, 0.04);
        });
        S.lamps = freeSpots(g, rand, 10, 16).map(x => ({ x, y: groundAt(g, x) + 4, phase: Math.floor(rand() * 5) }));
    }
    function planFloatingRocks(p, V, S, g, rand) { S.rocks = Array.from({ length: 7 }, () => ({ x: 20 + rand() * (W - 40), y: 36 + rand() * 60, r: 3 + rand() * 6, phase: rand() * 6.28 })); }
    function paintSporeTowers(p, V, S, g, rand) {                              // mushroom towers taller than the lander
        S.caps = freeSpots(g, rand, 7, 26).map(x => {
            const top = groundAt(g, x), tall = 16 + rand() * 22, capR = 4 + rand() * 4;
            region(p, V, x, top - tall, x + 2, top + 1, (wx, wy, ax, ay) => p.solid(ax, ay, S.GRD, 0.18 + ((wx - x - 1) * S.Ls > 0 ? 0.12 : 0)));
            lump(p, V, S, g, x + 1, top - tall, capR * 2, capR, S.K.BIO, 1.1, false);
            return { x: x + 1, y: top - tall - capR };
        });
    }
    function paintTendrils(p, V, S, g, rand) {                                 // soft glowing stalks, leaning toward whoever lands
        S.tips = freeSpots(g, rand, 12, 16).map(x => {
            const top = groundAt(g, x), tall = 8 + rand() * 14, bend = (rand() - 0.5) * 0.6, at = d => [x + 0.5 + Math.sin(d * 0.2) * 2 + d * bend, top - d];
            for (let d = 0; d < tall; d += 0.5) { const [px, py] = at(d); region(p, V, px - 0.4, py, px + 0.4, py + 0.6, (wx, wy, ax, ay) => p.solid(ax, ay, S.pal.ramp, 0.4)); }
            const [tx, ty] = at(tall); return { x: tx, y: ty };
        });
    }

    // type → [still painter, live painter]
    const STRANGE = {
        CRYSTALLINE: [paintCrystals, drawGlints], MIRROR: [paintMirror], SINGING: [paintPillars, drawSoundRings], GHOST_WORLD: [paintGhostRidge, drawGhostFlicker],
        TOMB_WORLD: [paintMarkers], GRAVEYARD: [paintHullDebris], HOLLOW: [paintHoles, drawHoleLights], BIO_MASS: [paintVeins, drawPulse],
        MECHA: [paintPlating, drawPlateLights], MACHINE_WORLD: [paintPlating, drawPlateLights], SHATTERED: [planFloatingRocks, drawFloatingRocks],
        FUNGAL: [paintSporeTowers, drawSpores], SYMBIOTE_WORLD: [paintTendrils, drawTips], RADIATION_BELT: [null, drawAurora],
    };

    /** The still place for view V, as a list of jobs (each a few tens of ms at most), so a close-up can be painted while the camera moves. */
    function backdrop(scene, g, V) {
        const S = scene.S, N = S.N, p = N.painter(V.w, V.h, true), jobs = [], strange = STRANGE[S.type] || [];
        for (let y = 0; y < V.h; y += BAND) jobs.push(() => paintSky(p, V, S, y, Math.min(V.h, y + BAND)));
        jobs.push(() => paintHeavens(p, V, S));
        for (let y = 0; y < V.h; y += BAND) jobs.push(() => paintLand(p, V, S, g, y, Math.min(V.h, y + BAND)));
        jobs.push(() => {
            if (!strange.length && !g.kind.platform) paintDressing(p, V, S, g, seeded(scene.planetId + ':dress'));
            if (strange[0]) strange[0](p, V, S, g, seeded(scene.planetId + ':strange'));
            if (g.kind.platform) paintPlatform(p, V, S, g);
        });
        if (g.site && window.LanderSites) jobs.push(() => window.LanderSites.paint(p, V, S, g, seeded(scene.planetId + ':site')));
        const out = { canvas: document.createElement('canvas'), jobs, V, done: false };
        out.canvas.width = V.w; out.canvas.height = V.h;
        jobs.push(() => { out.canvas.getContext('2d').putImageData(new ImageData(p.data, p.W, p.H), 0, 0); out.done = true; });
        return out;
    }
    /** Run jobs until budget ms are spent (all of them when budget is Infinity). */
    function bake(bd, budget) {
        const t0 = performance.now();
        while (bd.jobs.length && performance.now() - t0 < budget) { const job = bd.jobs.shift(); try { job(); } catch (err) { console.error('LanderScene: a painting step failed', err); } }
        return bd.done;
    }

    /** site: what the team is going to ('wreck', 'ruins', 'stones', 'dome', 'beacon'), or null; detail: which wreck story. Sets g.site to where it stands. */
    function build(g, planet, site, detail) {
        if (!kit()) return null;
        const Sites = window.LanderSites;
        g.site = site && Sites ? Sites.place(g, site, detail) : null;                    // placed first, so the dressing keeps off it
        g.vis = visualHeights(g);
        const S = lookOf(g, planet), strange = STRANGE[planet.type] || [];
        const scene = { S, planetId: planet.id, kindName: S.kindName, type: planet.type, isMirror: planet.type === 'MIRROR', live: strange[1] || null, particles: [], lastNow: 0, layers: new Map() };
        scene.main = backdrop(scene, g, MAIN);
        bake(scene.main, Infinity);
        return scene;
    }

    // ── what moves ──
    /** A layer per view, repainted once a tick (lava, water, murk, aurora): fn(layer, tick) writes pixels into it; drawn every frame. */
    function tickLayer(scene, V, name, now, fn) {
        const key = name + V.d + ':' + V.ox + ':' + V.oy, tick = Math.floor(now / TICK);
        let L = scene.layers.get(key);
        if (!L) {
            const canvas = document.createElement('canvas'); canvas.width = V.w; canvas.height = V.h;
            L = { px: scene.S.N.pixelLayer(V.w, V.h), tick: -1, canvas, g: canvas.getContext('2d') };
            scene.layers.set(key, L); if (scene.layers.size > 12) scene.layers.delete(scene.layers.keys().next().value);
        }
        if (L.tick !== tick) { L.tick = tick; L.px.clear(); fn(L.px, tick); L.g.clearRect(0, 0, V.w, V.h); L.px.draw(L.g); }
        return { draw: ctx => ctx.drawImage(L.canvas, 0, 0) };
    }
    /** How far (world px) wx is from the nearer edge of the pool it lies in: 0 at the shore. */
    function shoreOf(g, wx, level) {
        let l = 0, r = 0;
        while (l < 12 && isPool(g, wx - l - 1, level)) l++;
        while (r < 12 && isPool(g, wx + r + 1, level)) r++;
        const f = wx - Math.floor(wx);
        return Math.min(l + f, r + 1 - f);
    }
    function drawPools(ctx, scene, g, V, now) {
        if (!g.kind.pools && !g.kind.sea) return;
        const S = scene.S, N = S.N, isSea = !!g.kind.sea, level = isSea ? SEA_LEVEL : LAVA_LEVEL, R = isSea ? S.WATER : S.K.LAVA;
        tickLayer(scene, V, 'pools', now, (L, tick) => {
            const t = tick * TICK / 1000, ay0 = Math.max(0, Math.floor(toAY(V, level)));
            for (let ax = 0; ax < V.w; ax++) {
                const wx = V.ox + (ax + 0.5) / V.d; if (!isPool(g, wx, level)) continue;
                const floor = S.floorAt(wx), shore = shoreOf(g, wx, level), lip = 1 + 2.2 * N.vnoise(wx / 2.5, 5, S.seed + 23);
                for (let ay = ay0; ay < V.h; ay++) {
                    const wy = V.oy + (ay + 0.5) / V.d, d = wy - level;
                    if (floor > 0 && wy > floor) break;                                     // the basin's floor: painted in the backdrop
                    const toFloor = floor > 0 ? floor - wy : 99;
                    if (isSea) {
                        const wave = N.vnoise(wx / 6 - t * 0.8, d / 2, S.seed) - 0.5, glint = d * V.d < 1.2 && N.vnoise(wx / 3 + t * 1.5, 1, S.seed + 4) > 0.72;
                        L.tone(ax, ay, R, glint ? 0.85 : d * V.d < 1.2 ? (shore < lip * 0.6 ? 0.7 : 0.5) : 0.24 * Math.exp(-d / 14) + 0.07 + wave * 0.14 - (toFloor < 2 ? 0.05 : 0));
                    } else if (shore < lip && d < lip + 1.5) {                              // the crusted shore: cooled rock, a hot crack in it now and then
                        const isCrack = N.threshold(ax, ay) < 0.12;
                        L.tone(ax, ay, isCrack ? R : S.GRD, isCrack ? 0.55 : 0.2 + 0.08 * (lip - shore));
                    } else {
                        const flow = N.fbm(wx / 8 - t * 0.3, wy / 3 + t * 0.2, S.seed + 6, 3), crust = flow < 0.47;
                        L.tone(ax, ay, R, (d * V.d < 1.5 ? 0.8 + (flow - 0.5) * 0.4 : crust ? 0.16 : 0.5 + (flow - 0.5) * 1.4 - d / 80) - (toFloor < 1.5 ? 0.12 : 0));
                    }
                }
            }
        }).draw(ctx);
    }
    function drawWeather(ctx, scene, g, V, now) {
        if (!g.wind) return;
        const S = scene.S, f = S.N.framer(ctx, V.w, V.h);
        for (let k = 0; k < 11; k++) {                                                                       // dust carried on the wind
            const y = 16 + k * 12.5, x = (((now / 1000) * g.wind * (7 + k % 3 * 3) + k * 83) % (W + 20) + W + 20) % (W + 20) - 10, len = (5 + (k % 3) * 3) * V.d;
            for (let i = 0; i < len; i += 1) f.tone(toAX(V, x) + i * Math.sign(g.wind || 1), toAY(V, y), S.airRamp, 0.42 * (1 - i / len));
        }
        if (S.kindName !== 'haze' && S.kindName !== 'sky') return;
        tickLayer(scene, V, 'murk', now, (L, tick) => {                                                     // murk drifting low over the ground
            const shift = tick * 0.7 * Math.sign(g.wind);
            for (let ay = Math.floor(toAY(V, 96)); ay < Math.min(V.h, toAY(V, 148)); ay++) {
                const wy = V.oy + (ay + 0.5) / V.d;
                for (let ax = 0; ax < V.w; ax++) { const wx = V.ox + (ax + 0.5) / V.d, m = S.N.fbm((wx + shift) / 26, wy / 7, S.seed + 13, 3) - 0.48; if (m > 0 && S.N.threshold(ax, ay) < m * 1.4) L.tone(ax, ay, S.airRamp, 0.32 + m); }
            }
        }).draw(ctx);
    }
    function drawPlatformLights(ctx, scene, g, V, now) {
        const S = scene.S, f = S.N.framer(ctx, V.w, V.h), K = S.K, isOn = Math.floor(now / 350) % 2 === 0, cx = g.padX + PAD_WIDTH / 2, slide = Math.floor(now / 110) % 12, u = V.d;
        const lamp = (x, y, hex, w, h) => f.px(toAX(V, x), toAY(V, y), hex, Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)));
        lamp(g.padX - 1.5, g.padY - 6, isOn ? K.WARM : K.WARM_DIM, 2, 1.5); lamp(g.padX + PAD_WIDTH - 0.5, g.padY - 6, isOn ? K.WARM : K.WARM_DIM, 2, 1.5);
        if (isOn) { f.glow(toAX(V, g.padX - 0.5), toAY(V, g.padY - 5.5), Math.round(4 * u), K.RP.AMBER, 0.4); f.glow(toAX(V, g.padX + PAD_WIDTH + 0.5), toAY(V, g.padY - 5.5), Math.round(4 * u), K.RP.AMBER, 0.4); }
        for (let y = g.padY - 40 + slide; y < g.padY - 8; y += 12) {                                         // chevrons sliding down toward the deck: land here
            const fade = (y - (g.padY - 40)) / 32;
            for (let k = 0; k < 4; k += 0.5) { lamp(cx - 4 + k, y + k, fade > 0.5 ? K.ICE : K.ICE_DIM, 0.5, 0.5); lamp(cx + 3.5 - k, y + k, fade > 0.5 ? K.ICE : K.ICE_DIM, 0.5, 0.5); }
        }
        lamp(g.padX - 4, g.padY + 5, isOn ? K.ICE : K.ICE_DIM, 3, 1.5); lamp(g.padX + PAD_WIDTH + 1, g.padY + 5, isOn ? K.ICE : K.ICE_DIM, 3, 1.5);   // lift pods
    }

    // the strange worlds' motion
    function drawGlints(ctx, g, scene, now, s, V) { const f = scene.S.N.framer(ctx, V.w, V.h); (scene.S.glints || []).forEach((t, i) => { if (Math.floor(now / 160 + i * 5) % 17 < 2) { f.px(toAX(V, t.x), toAY(V, t.y), '#ffffff'); f.px(toAX(V, t.x) - 1, toAY(V, t.y), '#bfe8ee', 3, 1); } }); }
    function drawSoundRings(ctx, g, scene, now, s, V) {
        const S = scene.S, f = S.N.framer(ctx, V.w, V.h);
        (S.pillars || []).forEach(pl => { for (let ring = 0; ring < 2; ring++) { const t = ((now + pl.phase + ring * 800) % 1600) / 1600, r = 4 + t * 34; for (let a = 0; a < 6.28; a += 0.5 / (r * V.d * 0.4)) f.tone(toAX(V, pl.x + Math.cos(a) * r), toAY(V, pl.y + 6 + Math.sin(a) * r * 0.4), S.pal.ramp, 0.75 * (1 - t)); } });
    }
    function drawGhostFlicker(ctx, g, scene, now, s, V) {
        if (Math.floor(now / 230) % 9 !== 0) return;
        const f = scene.S.N.framer(ctx, V.w, V.h);
        for (let ax = 0; ax < V.w; ax++) { const wx = V.ox + (ax + 0.5) / V.d, y = hAt(g, wx - 14) - 34; if (y > 30 && y < H) f.px(ax, toAY(V, y), scene.S.pal.ramp.hex[scene.S.pal.ramp.hex.length - 1], 1, 2); }
    }
    function drawHoleLights(ctx, g, scene, now, s, V) { const f = scene.S.N.framer(ctx, V.w, V.h); (scene.S.holes || []).forEach((h, i) => { if (h.lit && Math.floor(now / 700 + i) % 4) f.glow(toAX(V, h.x), toAY(V, h.y), Math.round(1.5 * V.d), scene.S.K.RP.AMBER, 0.7); }); }
    function drawPulse(ctx, g, scene, now, s, V) { const f = scene.S.N.framer(ctx, V.w, V.h), wave = (now / 60) % 60; (scene.S.veins || []).forEach(([x, y, k]) => { if (Math.abs((k % 60) - wave) < 3) f.tone(toAX(V, x), toAY(V, y), scene.S.K.BIO, 0.85, Math.ceil(V.d * 0.7), Math.ceil(V.d * 0.7)); }); }
    function drawPlateLights(ctx, g, scene, now, s, V) { const f = scene.S.N.framer(ctx, V.w, V.h), K = scene.S.K; (scene.S.lamps || []).forEach(l => f.px(toAX(V, l.x), toAY(V, l.y), (Math.floor(now / 400) + l.phase) % 5 === 0 ? K.ICE : K.ICE_DIM, Math.round(2 * V.d), Math.max(1, Math.round(V.d * 0.6)))); }
    function drawFloatingRocks(ctx, g, scene, now, s, V) {
        const S = scene.S, key = 'rocks' + V.d;
        if (!scene[key]) scene[key] = (S.rocks || []).map(rk => { const r = rk.r * V.d, half = Math.ceil(r * 1.4) + 2, q = S.N.painter(half * 2, half * 2, false); S.N.sphere(q, { cx: half, cy: half, r, ramp: S.GRD, L: S.L3, surface: S.N.surfaceFor('rock', S.seed + rk.r, S.L3), rim: 0.12, rimRamp: S.rimRamp, gain: 0.75 }); return { c: q.canvas(), half }; });
        (S.rocks || []).forEach((rk, i) => { const sp = scene[key][i]; ctx.drawImage(sp.c, Math.round(toAX(V, rk.x)) - sp.half, Math.round(toAY(V, rk.y + Math.sin(now / 1400 + rk.phase) * 2)) - sp.half); });
    }
    function drawSpores(ctx, g, scene, now, s, V) { const f = scene.S.N.framer(ctx, V.w, V.h); (scene.S.caps || []).forEach((c, i) => { for (let k = 0; k < 3; k++) { const t = ((now / 2600) + k / 3 + i * 0.13) % 1; f.tone(toAX(V, c.x + Math.sin(t * 9 + i) * 4), toAY(V, c.y - t * 40), scene.S.K.BIO, 0.9 - t * 0.5, Math.ceil(V.d / 2), Math.ceil(V.d / 2)); } }); }
    function drawTips(ctx, g, scene, now, s, V) { const f = scene.S.N.framer(ctx, V.w, V.h); (scene.S.tips || []).forEach((t, i) => f.glow(toAX(V, t.x), toAY(V, t.y), Math.round(1.6 * V.d), scene.S.pal.ramp, Math.floor(now / 500 + i) % 3 ? 0.95 : 0.55)); }
    function drawAurora(ctx, g, scene, now, s, V) {
        const S = scene.S;
        tickLayer(scene, V, 'aurora', now, (L, tick) => {
            for (let band = 0; band < 2; band++) {                                                       // curtains: bright at the hem, fading up, rippling
                const base = 34 + band * 18, drift = tick * TICK / (2400 + band * 700);
                for (let ax = 0; ax < V.w; ax++) {
                    const wx = V.ox + (ax + 0.5) / V.d, y = base + 6 * Math.sin(wx * 0.03 + drift + band), k = S.N.fbm(wx / 14 + drift * 0.6, band * 3, S.seed + band, 3);
                    const ray = 0.55 + 0.45 * S.N.vnoise(wx * 1.3, band * 7 + drift, S.seed + 9);               // fine vertical rays
                    if (k < 0.45) continue;
                    const tall = 22 * V.d * (k - 0.35) * ray;
                    for (let d = 0; d < tall; d++) { const ay = Math.round(toAY(V, y)) - d, v = (k - 0.45) * 1.3 * ray * Math.pow(1 - d / tall, 1.5); if (ay >= 0 && ay < V.h && S.N.threshold(ax, ay) < v * 0.75) L.tone(ax, ay, S.K.AURORA, 0.24 + 0.26 * (1 - d / tall)); }
                }
            }
        }).draw(ctx);
    }

    function spawn(scene, particle) { if (scene.particles.length >= MAX_PARTICLES) scene.particles.shift(); scene.particles.push(particle); }
    /** Exhaust from each lit nozzle, and dust thrown sideways when the flame reaches the ground. */
    function emit(scene, g, s, nozzles) {
        nozzles.forEach(([nx, ny]) => {
            spawn(scene, { x: nx + Math.random() * 1.5 - 0.75, y: ny + 7, vx: (Math.random() - 0.5) * 8 - s.vx * 0.1, vy: 22 + Math.random() * 14, life: SMOKE_LIFE, max: SMOKE_LIFE, kind: 'smoke' });
            const col = clampX(Math.round(nx)), ground = g.heights[col];
            if (ground > H || g.hot[col] || ground - ny > DUST_HEIGHT) return;
            const side = Math.random() < 0.5 ? -1 : 1;
            for (let k = 0; k < 2; k++) spawn(scene, { x: nx, y: ground - 1, vx: side * (18 + Math.random() * 34), vy: -(6 + Math.random() * 14), life: DUST_LIFE, max: DUST_LIFE, kind: 'dust' });
        });
    }
    function drawParticles(ctx, scene, g, V, dt) {
        const S = scene.S, f = S.N.framer(ctx, V.w, V.h), big = Math.max(1, Math.round(V.d / 2.25));
        scene.particles = scene.particles.filter(p => p.life > 0);
        scene.particles.forEach(p => {
            p.life -= dt; p.x += (p.vx + g.wind * 4) * dt; p.y += p.vy * dt;
            if (p.kind === 'smoke') p.vy *= 0.94; else p.vy += 40 * dt;
            const age = 1 - p.life / p.max, ax = toAX(V, p.x), ay = toAY(V, p.y);
            if (p.kind === 'dust') f.tone(ax, ay, S.GRD, 0.62 * (1 - age), big, big);
            else if (age < 0.18) f.tone(ax, ay, S.K.RP.PLUME, 0.75, big, big);
            else f.tone(ax, ay, S.K.SMOKE, 0.95 - age, big * (age > 0.5 ? 2 : 1), big);
        });
    }
    /** The lander's shadow on the ground, darker and tighter as it comes down. */
    function drawShadow(ctx, scene, g, s, V) {
        if (s.altitude > 70) return;
        const N = scene.S.N, half = Math.max(2, 7 - s.altitude / 12), dense = 0.85 - s.altitude / 90;
        ctx.fillStyle = N.INK;
        for (let ax = Math.floor(toAX(V, s.x - half)); ax < toAX(V, s.x + half); ax++) {
            const wx = V.ox + (ax + 0.5) / V.d, col = clampX(Math.floor(wx)), top = hAt(g, wx);
            if (top > H || g.hot[col]) continue;
            const k = 1 - Math.abs(wx - s.x) / half;
            for (let r = 0; r < Math.ceil(V.d * 1.2); r++) { const ay = Math.floor(toAY(V, top)) + r; if (N.threshold(ax, ay) < dense * k) ctx.fillRect(ax, ay, 1, 1); }
        }
    }
    /** Our ship's belly across the top of the frame: the hold open, warm, and the clamp the lander hangs from until it is let go. */
    function drawShip(ctx, scene, x, now, isDocked, V) {
        const S = scene.S, N = S.N, key = 'ship' + V.d;
        if (!scene[key]) {
            const len = 150 * V.d, ht = len * 0.31, q = N.painter(Math.ceil(len * 1.1), Math.ceil(SHIP_BELLY * V.d) + 2, false);
            N.hull(q, { x: q.W / 2, y: -ht * 0.5 + SHIP_BELLY * V.d, len, ht, angle: 0, anchor: 0.5, light: 1.25, seed: 9 }, N.shapeL);
            scene[key] = q.canvas();
        }
        const c = scene[key], left = Math.round(toAX(V, x) - c.width / 2), top = Math.round(toAY(V, 0));
        ctx.drawImage(c, left, top);
        const f = N.framer(ctx, V.w, V.h), u = V.d, open = isDocked ? 0 : 3;
        f.px(toAX(V, x - 5), toAY(V, SHIP_BELLY - 1), S.K.WARM_DIM, Math.round(10 * u), Math.round(1 * u));         // the hold, open and lit from inside
        f.px(toAX(V, x - 4), toAY(V, SHIP_BELLY - 0.6), S.K.WARM, Math.round(8 * u), Math.max(1, Math.round(0.4 * u)));
        [-1, 1].forEach(side => {                                                                                    // the clamp arms swing apart after release
            const ax = toAX(V, x + side * (2.2 + open)), ay = toAY(V, SHIP_BELLY);
            f.px(ax - u / 2, ay, S.K.RP.HULL.hex[3], Math.max(1, Math.round(u * 0.8)), Math.round(2.2 * u));
            f.px(ax - u / 2, ay + 2.2 * u, Math.floor(now / 500) % 2 ? S.K.WARM : S.K.WARM_DIM, Math.max(1, Math.round(u * 0.8)), Math.max(1, Math.round(u * 0.7)));
        });
    }

    /** Call once per frame, before the lander itself is drawn. nozzles = [[x, y], …] (world) of the thrusters firing right now. */
    function drawLive(ctx, scene, g, s, now, nozzles, V) {
        V = V || MAIN;
        const dt = Math.min(0.05, scene.lastNow ? (now - scene.lastNow) / 1000 : 0); scene.lastNow = now;
        const bd = V === MAIN ? scene.main : scene.close && scene.close.V === V ? scene.close : null;
        if (bd && bd.done) ctx.drawImage(bd.canvas, 0, 0); else { ctx.fillStyle = scene.S.N.INK; ctx.fillRect(0, 0, V.w, V.h); }
        drawPools(ctx, scene, g, V, now);
        drawWeather(ctx, scene, g, V, now);
        if (scene.live) scene.live(ctx, g, scene, now, s, V);
        if (scene.S.bright) scene.S.N.twinkle(scene.S.N.framer(ctx, V.w, V.h), scene.S.bright.slice(0, 40).map(b => ({ x: Math.round(toAX(V, b.x)), y: Math.round(toAY(V, b.y)) })), now);
        if (g.site && window.LanderSites) window.LanderSites.drawLive(ctx, g, now, V, scene.S);
        if (g.kind.platform) drawPlatformLights(ctx, scene, g, V, now);
        drawShadow(ctx, scene, g, s, V);
        if (nozzles.length && !s.grade) emit(scene, g, s, nozzles);
        drawParticles(ctx, scene, g, V, dt);
        if (scene.dockX == null) scene.dockX = Math.round(s.x);
        drawShip(ctx, scene, scene.dockX, now, !s.isReleased, V);
    }

    /** The close-up after touchdown: a view of the camera's last window, painted sharper in the frames while the camera moves. */
    function closeUp(scene, g, cam) {
        const V = view(AW / cam.w, cam.left, cam.top, AW, AH);
        scene.close = backdrop(scene, g, V);
        return V;
    }

    window.LanderScene = {
        build, backdrop, bake, closeUp, drawLive, MAIN,
        util: { W, H, D, AW, AH, PAD_WIDTH, view, region, hAt, toAX, toAY, clampX, clamp01, seeded, hashId, kit, lump, spire, stroke, buriedHull, groundAt, mixRgb, hexOf },
    };
})();
