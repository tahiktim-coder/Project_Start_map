/* ═══ Silent Exodus · new screen (?new=1) · art/Worlds.js: one world with character, by its type, story and sector ═════
   What it is: the picture of one world (docs/BUILD_B.md §9), used by the travel view (travel/Pictures.js) and by the bridge
   window (stop/Glass.js). One surface character from the world's type and at most one companion from its story (or its
   seed), legible from r 14 (a far world) to r 90 (the bridge glass), never noisy. Later sectors grow stranger: 1 muted and
   familiar; 2 cold, frost and aurora; 3 an odd shimmer on the night edge; 4 colony lights on the living worlds; 5 broken,
   faceted geometry; 6 worlds that reflect the light.
   House style (docs/ART_STYLE.md): ramps that start at the ink, the 8 x 8 Bayer dither, seeded noise, one light. The
   colours are the orbit's own (palette(type): the dither art's ramp when it is on, else BodyRenderer's), so the world you
   click is the world you arrive at; glows (lava, city lights, aurora) use small ramps of their own. No Math.random: every
   choice is seeded by the node id. Loaded only when the new-screen switch is on; load after Sky2.js (needs NSPaint).

   window.NSWorlds (frozen)
     paint(p, o) → { rims, reach }   p: an NSPaint painter; o: { cx, cy, r, node, type?, seed?, sector, L, grey?, dim?,
                                    ramp?, atmo? } (dim: 0..1, darker as the bridge glass brakes in; grey wins). node gives type, tags and the seed (its id); type/seed stand in without one.
                                    L: the light vector (NSPaint.lightVector). grey: the world in shadow (passed). ramp/atmo:
                                    override the colours. rims: edge pixels [x, y, ramp, level] (the pointing highlight).
     reach(node, sector, type?) → n  how far the picture reaches, in world radii (rings and moons stay inside the sprite)
     live(f, node, x, y, r, t, o)    the few moving pixels (lightning, glints, a blink, a pulse); f: NSPaint.framer;
                                    o: { L, sector, type?, seed? }. Cheap: a handful of rectangles.
     palette(type) → { ramp, atmo, surface }   the orbit's colours for that type
     describe(node, sector, type?) → { surface, companion, touch }   what was chosen (debug and the headless checks)
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!P) { console.error('NSWorlds: NSPaint must load first'); return; }
    const { INK, RP, clamp01, smooth, hash, vnoise, fbm, seeded, ramp, level, threshold } = P;
    const TAU = Math.PI * 2;

    // ── glows: their own small ramps from the ink (warmth only where people or fire are) ──
    const GLOW = {
        lava: ramp(INK, '#2a0c06', '#6a1e0c', '#c4461c', '#ff8a3c', '#ffd08a'),
        city: ramp(INK, '#2a1a08', '#6a4214', '#c8842e', '#f7c483', '#fff3dc'),
        aurora: ramp(INK, '#062018', '#0e4434', '#1f7a5c', '#5fd0a8', '#c8ffe8'),
        bio: ramp(INK, '#1c0a1a', '#401838', '#7e3a70', '#c870b0'),
        sulfur: ramp(INK, '#261a04', '#5a3a08', '#b07a14', '#f0c040', '#fff0a0'),
        ice: ramp(INK, '#0a1620', '#14303e', '#26566a', '#4f8aa0'),
        speck: ramp(INK, '#1b272c', '#4c5f66', '#b3c2c0', '#f6f1e4'),
        odd: ramp(INK, '#140a24', '#2e1a52', '#5a3a9a', '#a088e0'),
        bolt: ramp(INK, '#16222e', '#3c5a78', '#9cc4e8', '#f2fbff'),
        halo: ramp(INK, '#0e1a1e', '#24464e', '#5a9aa6', '#bfe8ee', '#f2fdff'),
    };
    const MOON = RP.MOON, RING = RP.RING, DEBRIS = RP.HULL;

    // ── colours: one source per world, the orbit's (moved here from Pictures so the bridge glass shares it) ──
    const SURFACE = { GAS: 'gas', ICE: 'ice', OCEAN: 'ice', VERDANT: 'desert', DESERT: 'desert', ROCK: 'rock', LAVA: 'rock', TOXIC: 'gas' };
    const LOOK = { DESERT: 'desert', SULFUR: 'desert', VOLCANIC: 'desert', TIDALLY_LOCKED: 'desert', RADIATION_BELT: 'desert', GAS_GIANT: 'gas', STORM_WORLD: 'gas',
        ICE_WORLD: 'ice', FROZEN_OCEAN: 'ice', OCEANIC: 'ice', CRYSTALLINE: 'ice', MIRROR: 'ice', EDEN: 'ice', VITAL: 'ice', TERRAFORMED: 'ice', SYMBIOTE_WORLD: 'ice', SINGING: 'ice',
        ROGUE: 'dark', GHOST_WORLD: 'dark', CARBON: 'dark', TOXIC: 'dark', BIO_MASS: 'dark', FUNGAL: 'dark' };
    const mixHex = (a, b, k) => { const x = P.hexRgb(a), y = P.hexRgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
    const palettes = new Map();
    function palette(type) {
        if (palettes.has(type)) return palettes.get(type);
        const look = LOOK[type] || 'rock';
        const BR = window.BodyRendererClassic || window.BodyRenderer, pc = BR && typeof BR.palette === 'function' && type ? BR.palette(type) : null;
        const DC = window.DitherCore, DR = window.DitherRecipes, dr = DC && DC.isOn && DR && DR.TYPES && type ? DR.TYPES[type] : null;
        const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
        let out = { ramp: P.PLANET_RAMP[look] || RP.STONE, atmo: null, surface: look };
        if (dr && Array.isArray(dr.ramp) && dr.ramp.length >= 4) {                        // the orbit's dither ramp: night, shadow .. highlight
            const stops = dr.ramp.slice(1).map(hex);
            out = { ramp: ramp(INK, ...stops), atmo: ramp(INK, ...stops.slice(0, 3)), surface: (pc && SURFACE[pc.fam]) || look };
        } else if (pc && pc.cfg && pc.cfg.c0) {
            const c = pc.cfg, top = pc.fam === 'GAS' && c.band ? c.band : mixHex(c.c0, c.br || c.c0, 0.45);
            out = { ramp: ramp(INK, c.c2, mixHex(c.c2, c.c1, 0.5), c.c1, mixHex(c.c1, c.c0, 0.5), c.c0, top), atmo: ramp(INK, c.c2, c.c1, c.c0, c.col || c.c0), surface: SURFACE[pc.fam] || look };
        }
        palettes.set(type, out);
        return out;
    }
    const TEAL_RIM = ramp(INK, '#0a1a1a', '#14363a', '#22585c', '#3f8a88', '#7cc2b8');
    const TEAL_ATMO = ramp(INK, '#081616', '#0f2a2c', '#1a4446', '#2c6966');
    const ACID_ATMO = ramp(INK, '#141a06', '#2a3a0c', '#4e6a18', '#8aa83a', '#c8e070');
    const LIVING = { VITAL: 1, EDEN: 1, TERRAFORMED: 1, SYMBIOTE_WORLD: 1, OCEANIC: 1, FUNGAL: 1, BIO_MASS: 1 };
    const DUSTY = { DESERT: 1, SULFUR: 1, VOLCANIC: 1, RADIATION_BELT: 1 };
    const GASSY = { GAS_GIANT: 1, STORM_WORLD: 1, SINGING: 1 };

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 1. What a world gets: one surface character (its type), one companion (its story or seed), the sector's touch
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function hashId(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
    const tagsOf = node => (node && node.tags) || [];
    function companionOf(node, type, sector, rnd) {
        const tags = tagsOf(node);
        if (node && (node.isFirstSignal || (tags.includes('EXODUS_WRECK') && !node.isStoryPlanet))) return 'wreck';   // the story world keeps its own beacon
        if (tags.includes('FAILED_COLONY') || tags.includes('ANCIENT_RUINS')) return 'ruins';
        if (tags.includes('DERELICT') || tags.includes('WRECKAGE')) return 'debris';
        if (tags.includes('ANOMALY') && sector > 1) return 'halo';                // sector 1 stays familiar
        if (tags.includes('LIGHTHOUSE')) return 'lighthouse';
        if (sector <= 1 && (tags.includes('DERELICT') || tags.includes('WRECKAGE'))) return 'debris';
        if (type === 'SHATTERED') return 'debris';
        const k = rnd();
        if (GASSY[type]) return k < 0.6 ? 'ring' : k < 0.8 ? 'moon' : null;
        if (sector === 2 && !LIVING[type] && type !== 'RADIATION_BELT' && k < 0.75) return 'aurora';   // the cold sector: most worlds glow at a pole
        if (sector === 5 && k < 0.35) return 'debris';
        return k < 0.45 ? 'moon' : null;
    }
    /** The sector's touch: a way of painting, not another feature (BUILD_B §9: at most two features a world). */
    function touchOf(sector, type) {
        return { muted: sector <= 1, frost: sector === 2 && !GASSY[type] && !LIVING[type], odd: sector === 3,
            colony: sector === 4 && !!LIVING[type] && type !== 'TERRAFORMED', facets: (sector === 5 && !GASSY[type]) || type === 'CRYSTALLINE',
            spec: sector >= 6 || type === 'MIRROR' };
    }
    const params = new Map();
    function paramsOf(node, sector, typeIn, seedIn) {
        const type = (node && node.type) || typeIn || 'ROCKY', id = node ? node.id : 'seed' + (seedIn || 1), key = id + '|' + sector + '|' + type;
        if (params.has(key)) return params.get(key);
        const seed = node ? 1 + (hashId(node.id) % 9973) : (seedIn || 1), rnd = seeded(seed * 7 + sector * 131 + 3);
        const side = rnd() < 0.5 ? 0 : Math.PI;                                          // things in orbit sit beside the world, never across it
        const pr = { type, seed, salt: seed & 255, tilt: (rnd() - 0.5) * 0.6, phase: rnd() * TAU,
            spot: [(rnd() - 0.5) * 1.1, (rnd() - 0.5) * 0.9], spot2: [(rnd() - 0.5) * 1.4, (rnd() - 0.5) * 1.0], jit: [rnd() - 0.5, rnd() - 0.5],
            craters: Array.from({ length: 14 }, (_, i) => [(rnd() - 0.5) * 2.6, (rnd() - 0.5) * 2.2, i === 0 ? 0.34 : 0.07 + rnd() * rnd() * 0.26]),
            cells: Array.from({ length: 14 }, () => { const a = rnd() * TAU, z = rnd() * 2 - 1, s = Math.sqrt(1 - z * z); return [Math.cos(a) * s, z, Math.sin(a) * s]; }),
            ringTilt: -0.42 + rnd() * 0.3, ringOpen: 0.2 + rnd() * 0.1, moonA: side + (rnd() - 0.5) * 1.1, moonBehind: rnd() < 0.4, cut: rnd() * TAU,
            companion: null, touch: touchOf(sector, type) };
        if (type === 'MIRROR') pr.touch.facets = false;
        pr.companion = companionOf(node, type, sector, rnd);
        if (params.size > 400) params.clear();
        params.set(key, pr);
        return pr;
    }
    const REACH = { ring: 1.72, moon: 1.78, wreck: 1.62, debris: 1.52, halo: 1.42, lighthouse: 1.1, ruins: 1.05, aurora: 1.14 };
    function reach(node, sector, type) {
        const pr = paramsOf(node, sector || 1, type);
        return Math.max(pr.type === 'SHATTERED' ? 1.16 : 1.05, REACH[pr.companion] || 1);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 2. The surfaces. Each returns an albedo (about 0.2 .. 1.1: on the orbit's ramps the value picks the hue, so on a living
    //    world dark sea lands in the blues, land in the greens, cloud tops in white), and may set g.e (a glow, 0..1) in
    //    g.er (its ramp) that shows on the night side.
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const g = { nx: 0, ny: 0, nz: 0, rx: 0, ry: 0, lon: 0, lat: 0, lam: 0, e: 0, er: null, over: null, ov: 0, cut: false, x: 0, y: 0, r: 1 };
    let PR = null;
    const ridge = (x, y, s) => 1 - Math.abs(2 * vnoise(x, y, s) - 1);
    function craters(k) {
        PR.craters.forEach(([cu, cv, cr]) => {
            const du = g.lon - PR.phase - cu, dv = g.lat - cv, d = Math.hypot(du * Math.cos(g.lat), dv) / cr;
            if (d < 0.8) k *= 0.62 + 0.2 * d;
            else if (d < 1.05) k *= 1.18;
        });
        return k;
    }
    /** Distance on the surface (radians, roughly) from a lon/lat spot. */
    const spotD = (s) => Math.hypot((g.lon - PR.phase - s[0]) * Math.cos(g.lat), g.lat - s[1]);
    const night = (span = 0.3) => 1 - smooth(0.0, span, g.lam);
    function glow(ramp0, v) { if (v > g.e) { g.e = v; g.er = ramp0; } }
    const terra = (landT, caps) => {
        const n = fbm(g.lon * 1.6 + PR.salt, g.lat * 1.9, PR.salt, 3), land = n > landT;
        const cloud = Math.max(0, fbm(g.lon * 3 + 40 + 1.4 * Math.sin(g.lat * 5), g.lat * 4.5, PR.salt + 9, 3) - 0.56) * 2.6;
        const cap = caps && Math.abs(g.ry) > 0.86 - 0.08 * fbm(g.lon * 3, 2, PR.salt, 2);
        return { a: Math.min(1.12, (cap ? 1.0 : land ? 0.66 + 0.7 * (n - landT) : 0.4) + cloud * 0.6), land: land && !cap };
    };
    const SURF = {
        ROCKY() { return craters(0.94 + 0.22 * (fbm(g.lon * 2.2 + PR.salt, g.lat * 2.2, PR.salt, 3) - 0.5) - 0.26 * smooth(0.5, 0.6, fbm(g.lon * 1.3 + 4, g.lat * 1.3, PR.salt + 2, 2))); },
        DESERT() {
            const warp = fbm(g.lon * 1.6 + PR.salt, g.lat * 1.6, PR.salt, 2);
            const beltD = Math.abs(g.lat - PR.spot2[1] * 0.45 + 0.16 * Math.sin(g.lon * 2 + warp * 3));
            const sea = 1 - smooth(0.12, 0.3, beltD);                               // a dark dune sea, a wavy belt round the world
            const dune = 0.5 + 0.5 * Math.sin((g.lat * 1.6 + g.lon * 0.5) * 24 + warp * 6);
            const sd = spotD(PR.spot), sw = Math.atan2(g.lat - PR.spot[1], (g.lon - PR.phase - PR.spot[0]) * Math.cos(g.lat));
            const storm = sd < 0.5 ? smooth(0, 0.55, 1 - sd / 0.5) * (0.62 + 0.38 * Math.sin(sw * 2 - sd * 18)) : 0;   // one pale dust storm: a swirl with two arms
            const ground = 0.92 + 0.14 * (warp - 0.5) - sea * (0.3 - 0.16 * dune);
            return ground * (1 - storm) + 1.32 * storm;
        },
        ICE_WORLD() {
            const edgeN = 0.56 + 0.07 * (fbm(g.lon * 3, 5, PR.salt, 2) - 0.5), up = -g.ry;
            const cap = smooth(edgeN, edgeN + 0.04, up) + smooth(0.8, 0.84, g.ry);
            const lip = up > edgeN - 0.07 && up < edgeN ? 0.12 : 0;                   // a darker rim of old ice round the cap
            const crack = Math.min(Math.abs(Math.sin(g.lon * 2.2 + g.lat * 1.3 + 3.2 * fbm(g.lon * 1.2, g.lat * 1.2, PR.salt + 4, 2))),
                Math.abs(Math.sin(g.lon * 1.3 - g.lat * 2.7 + 2.4 * fbm(g.lon * 0.9, g.lat * 1.4, PR.salt + 6, 2))) * 1.3);
            const k = crack < 0.06 ? 0.42 : 0.74 + 0.14 * fbm(g.lon * 4, g.lat * 4, PR.salt, 2) - lip;
            return k * (1 - Math.min(1, cap)) + 1.42 * Math.min(1, cap);
        },
        FROZEN_OCEAN() {
            const cap = smooth(0.64, 0.69, Math.abs(g.ry) + 0.05 * (fbm(g.lon * 3, 7, PR.salt, 2) - 0.5));
            const plate = ridge(g.lon * 2.4 + PR.salt, g.lat * 2.4, PR.salt) > 0.9 || Math.abs(Math.sin(g.lon * 1.7 - g.lat * 2.1 + 2.5 * fbm(g.lon, g.lat, PR.salt + 3, 2))) < 0.05;
            return (plate ? 0.44 : 0.8 + 0.14 * fbm(g.lon * 5, g.lat * 5, PR.salt, 2)) * (1 - cap) + 1.36 * cap;
        },
        GAS_GIANT() {
            const w = fbm(g.lon * 1.3 + PR.salt, g.lat * 5, PR.salt, 3), band = 0.5 + 0.5 * Math.sin(g.lat * 13 + w * 4.2), fine = 0.5 + 0.5 * Math.sin(g.lat * 41 + w * 7);
            const sd = Math.hypot((g.lon - PR.phase - PR.spot[0]) * Math.cos(g.lat) / 0.3, (g.lat - PR.spot[1] * 0.6) / 0.11);
            const oval = sd < 1 ? 0.34 * (1 - sd) - 0.1 : sd < 1.35 ? -0.14 * (1 - (sd - 1) / 0.35) : 0;   // one storm oval, a dark ring round it
            return 0.58 + 0.3 * band + 0.14 * fine + oval;
        },
        STORM_WORLD() {
            const du = (g.lon - PR.phase - PR.spot[0] * 0.6) * Math.cos(g.lat), dv = g.lat - PR.spot[1] * 0.5, rho = Math.hypot(du, dv), th = Math.atan2(dv, du);
            const arm = 0.5 + 0.5 * Math.sin(2 * th - 7 * Math.log(rho + 0.06)), swirl = Math.exp(-rho / 0.55);
            const bands = 0.5 + 0.5 * Math.sin(g.lat * 9 + 3 * fbm(g.lon, g.lat * 3, PR.salt, 2));
            return rho < 0.05 ? 0.42 : 0.56 + 0.44 * arm * swirl + 0.14 * bands * (1 - swirl);
        },
        CARBON() {
            const k = 0.44 + 0.26 * fbm(g.lon * 2.5 + PR.salt, g.lat * 2.5, PR.salt, 3);
            const arm = 0.8 + g.r / 34;
            for (const [gx, gy] of PR.glints || []) {                             // a few sharp glints, each a small cross of light
                const dx = Math.abs(g.nx - gx) * g.r, dy = Math.abs(g.ny - gy) * g.r;
                if ((dx < 0.75 && dy < arm) || (dy < 0.75 && dx < arm)) { g.over = GLOW.speck; g.ov = dx < 0.75 && dy < 0.75 ? 1 : 0.62; break; }
            }
            return k;
        },
        SULFUR() {
            const patch = smooth(0.46, 0.6, fbm(g.lon * 1.8 + PR.salt, g.lat * 1.8, PR.salt, 3));
            const hd = Math.hypot(g.nx - PR.hot[0], g.ny - PR.hot[1]);
            if (hd < 0.2) glow(GLOW.sulfur, (1 - hd / 0.2) ** 1.4 * 0.95 * night(0.35));   // one hot spot, glowing on the night side
            return 0.7 + 0.34 * patch;
        },
        VOLCANIC() {
            const cr = ridge(g.lon * 2.6 + PR.salt, g.lat * 2.6, PR.salt + 1), fine = ridge(g.lon * 7 + 3, g.lat * 7, PR.salt + 2);
            const hot = Math.max(0, cr - 0.84) * 6 + Math.max(0, fine - 0.93) * 3;
            if (hot > 0) glow(GLOW.lava, Math.min(1, hot) * (0.3 + 0.7 * night(0.45)));
            return 0.62 + 0.18 * fbm(g.lon * 3, g.lat * 3, PR.salt, 2);
        },
        TIDALLY_LOCKED() {
            if (g.lam < 0.05) { g.over = GLOW.ice; g.ov = 0.42 + 0.3 * fbm(g.lon * 3, g.lat * 3, PR.salt, 2) - (Math.abs(Math.sin(g.lon * 3 + g.lat * 2 + 2 * fbm(g.lon, g.lat, PR.salt + 5, 2))) < 0.07 ? 0.25 : 0); }
            return 0.86 + 0.24 * smooth(0.6, 1, g.lam) + 0.1 * (fbm(g.lon * 3, g.lat * 3, PR.salt, 2) - 0.5);
        },
        TOXIC() {
            const swirl = fbm(g.lon * 1.4 + PR.salt + fbm(g.lon, g.lat * 2, PR.salt, 2) * 1.8, g.lat * 2.6, PR.salt + 1, 3);
            return 0.55 + 0.5 * swirl + 0.5 * Math.pow(1 - g.nz, 2);              // thick haze brightening the limb
        },
        OCEANIC() { return terra(0.64, true).a; },
        VITAL() { return terra(0.5, false).a; },
        EDEN() { return terra(0.46, true).a; },
        TERRAFORMED() {
            const t = terra(0.52, false);
            if (t.land) cityGrid(0.8);
            return t.a;
        },
        MACHINE_WORLD() {
            const gx = Math.abs(Math.sin((g.lon - PR.phase) * 9)), gy = Math.abs(Math.sin(g.lat * 8));
            cityGrid(0.9);
            return (gx > 0.96 || gy > 0.96 ? 0.66 : 0.88) + 0.1 * fbm(g.lon * 4, g.lat * 4, PR.salt, 2);
        },
        MECHA() { return SURF.MACHINE_WORLD(); },
        ROGUE() {
            auroraArc(0.42);
            const cr = ridge(g.lon * 2.2 + PR.salt, g.lat * 2.2, PR.salt + 6);
            if (cr > 0.9) glow(GLOW.lava, (cr - 0.9) * 5.5);                         // unlit, but warm cracks
            return 0.55 + 0.2 * fbm(g.lon * 2, g.lat * 2, PR.salt, 2);
        },
        CRYSTALLINE() { if (g.facetHi && g.lam > 0.62) { g.over = GLOW.halo; g.ov = 0.4 + 0.5 * g.lam; } return 0.86 + 0.5 * g.facetK; },
        SHATTERED() { return craters(0.8 + 0.2 * (fbm(g.lon * 2 + PR.salt, g.lat * 2, PR.salt, 2) - 0.5)); },
        MIRROR() {
            if (hash(Math.floor((g.lon + 9) * 40) & 255, Math.floor((g.lat + 9) * 40) & 255, PR.salt + 7) > 0.975) { g.over = GLOW.speck; g.ov = 0.35; }   // the stars, reflected
            return 0.22 + 0.08 * fbm(g.lon * 2, g.lat * 2, PR.salt, 2);
        },
        HOLLOW() {
            const d = Math.hypot(g.nx - PR.pit[0], g.ny - PR.pit[1]) / 0.3;
            if (d < 1) { g.cut = d < 0.72; glow(GLOW.city, d < 0.72 ? 0.18 + 0.45 * (d / 0.72) ** 3 : 0.9 - (d - 0.72) * 1.8); return 0.2; }   // a pole opening, lit from inside
            return 0.8 + 0.2 * fbm(g.lon * 2.5 + PR.salt, g.lat * 2.5, PR.salt, 3);
        },
        SINGING() { return 0.5 + 0.55 * Math.pow(Math.abs(Math.sin(g.lat * 7.5)), 3); },
        GHOST_WORLD() { if (threshold(g.x, g.y) > 0.5 + 0.45 * fbm(g.lon * 2 + PR.salt, g.lat * 2, PR.salt, 2)) g.cut = true; return 0.75 + 0.3 * fbm(g.lon * 2, g.lat * 2, PR.salt + 1, 2); },
        BIO_MASS() { return mottled(); },
        FUNGAL() { return mottled(); },
        SYMBIOTE_WORLD() { return mottled(); },
        TOMB_WORLD() { duskRows(9, 24); return 0.8 + 0.1 * (fbm(g.lon * 2.5, g.lat * 2.5, PR.salt, 2) - 0.5); },
        GRAVEYARD() { duskRows(8, 18); return craters(0.8); },
        RADIATION_BELT() {
            auroraArc(0.75);                                                       // aurora at both poles
            return 0.7 + 0.3 * fbm(g.lon * 2 + PR.salt, g.lat * 3, PR.salt, 2);
        },
    };
    /** An aurora oval round each pole: an arc, not a stripe (the pole sits just past the limb, so the oval bends). */
    function auroraArc(peak) {
        for (const sgn of [-1, 1]) {
            const d = Math.hypot(g.rx * 0.9, g.ry - sgn * 1.12);
            const band = Math.exp(-((d - 0.42) ** 2) / 0.0035);
            if (band > 0.1) glow(GLOW.aurora, band * peak * (0.55 + 0.45 * fbm(g.rx * 6 + sgn * 9, 2, PR.salt, 2)) * (0.45 + 0.55 * night(0.4)));
        }
    }
    function cityGrid(peak) {
        const cx = (g.lon - PR.phase) * 9 / Math.PI, cy = g.lat * 8 / Math.PI, fx = cx - Math.round(cx), fy = cy - Math.round(cy);
        if (Math.abs(fx) < 0.12 && Math.abs(fy) < 0.12 && hash(Math.round(cx) & 255, Math.round(cy) & 255, PR.salt + 3) > 0.35) glow(GLOW.city, peak * night(0.25));
    }
    function mottled() {
        const m = fbm(g.lon * 3 + PR.salt, g.lat * 3, PR.salt, 3), cell = ridge(g.lon * 4 + 2, g.lat * 4, PR.salt + 4);
        if (cell > 0.88 && hash(Math.floor((g.lon + 9) * 30) & 255, Math.floor((g.lat + 9) * 30) & 255, PR.salt) > 0.5) glow(GLOW.bio, 0.55 * night(0.25));   // faint lights on the night side
        return (cell > 0.86 ? 0.5 : 0.72 + 0.4 * (m - 0.5));
    }
    /** Rows of pale specks along the dusk line (dead cities, rows of ships). */
    function duskRows(rows, cols) {
        if (g.lam < 0.015 || g.lam > 0.32) return;
        const fy = g.lat * rows - Math.floor(g.lat * rows), fx = (g.lon - PR.phase) * cols - Math.floor((g.lon - PR.phase) * cols);
        if (fy < 0.18 && fx < 0.36 && hash(Math.floor((g.lon - PR.phase) * cols) & 255, Math.floor(g.lat * rows) & 255, PR.salt + 2) > 0.5) { g.over = GLOW.speck; g.ov = 0.85 * (1 - g.lam / 0.4); }
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. Painting: the far half of a ring, the body (with its glows), the near half and the companion
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** A thin ring: back half first (behind the body), front half last. */
    function ring(p, o, front) {
        const { cx, cy, r, L } = o, ct = Math.cos(PR.ringTilt), sn = Math.sin(PR.ringTilt), op = PR.ringOpen, r0 = 1.36, r1 = 1.66, reachR = r * r1 + 2;
        p.region(cx - reachR, cy - reachR, cx + reachR, cy + reachR, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ct + dy * sn, w = -dx * sn + dy * ct, rho = Math.hypot(u, w / op) / r;
            if (rho < r0 || rho > r1 || (w > 0) !== front) return;
            if (!front && dx * dx + dy * dy < r * r) return;
            const k = (rho - r0) / (r1 - r0);
            let v = 0.36 + 0.3 * smooth(0, 0.25, k) * (1 - smooth(0.75, 1, k));
            if (k > 0.55 && k < 0.64) v *= 0.2;                                      // the gap
            const lit = 0.6 + 0.5 * clamp01((dx * L[0] + dy * L[1]) / (r * 1.6) * 0.5 + 0.5);
            p.cover(x, y, RING, v * lit * o.dim * (0.85 + 0.3 * vnoise(rho * 30, 2, PR.salt)), 0.75);
        });
    }
    /** A perfect circle of light (an ANOMALY): far too even to be dust. */
    function halo(p, o) {
        const { cx, cy, r } = o, R = r * 1.34;
        p.region(cx - R - 2, cy - R - 2, cx + R + 2, cy + R + 2, (x, y) => {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
            if (Math.abs(d - R) < 0.6 && (d > r + 1)) p.solid(x, y, GLOW.halo, 0.46 * o.dim);
            else if (Math.abs(d - R) < 1.4 && d > r + 1) p.cover(x, y, GLOW.halo, 0.2 * o.dim, 0.4);
        });
    }
    function smallSphere(p, X, Y, rr, L, rmp, dim, salt) {
        p.ellipse(X, Y, rr, rr, (x, y, q) => {
            const nx = (x + 0.5 - X) / rr, ny = (y + 0.5 - Y) / rr, nz = Math.sqrt(Math.max(0, 1 - q)), lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
            p.solid(x, y, rmp, (0.03 + Math.pow(lam, 1.1) * 0.9 * (0.82 + 0.3 * vnoise(nx * 3 + salt, ny * 3, salt))) * dim);
        });
    }
    function moon(p, o) {
        const { cx, cy, r } = o, d = r * 1.52, rr = Math.max(3, Math.round(r * (r < 30 ? 0.22 : 0.17)));
        smallSphere(p, cx + Math.cos(PR.moonA) * d, cy + Math.sin(PR.moonA) * d * 0.6, rr, o.L, MOON, o.dim, PR.salt);
    }
    /** One of ours in orbit: a broken hull glinting (the beacon stays on the ground, as in checkpoint A). */
    function wreck(p, o) {
        const { cx, cy, r } = o, a = PR.moonA, d = r * 1.36, X = cx + Math.cos(a) * d, Y = cy + Math.sin(a) * d * 0.55, len = Math.max(5, r * 0.22);
        if (len < 9) { p.solid(X - 1, Y + 1, RP.RUST, 0.62 * o.dim); p.solid(X, Y, DEBRIS, 0.62 * o.dim); p.solid(X + 1, Y, DEBRIS, 0.9 * o.dim); p.solid(X + 2, Y - 1, DEBRIS, 0.7 * o.dim); return; }
        P.hull(p, { x: X, y: Y, len, ht: len / 3, angle: a + 1.3, flip: a > Math.PI, light: 0.6 * o.dim, rust: true, ramp: RP.RUST, seed: PR.salt, from: 0, to: 0.72 }, P.shapeL);
    }
    function debris(p, o) {
        const { cx, cy, r } = o, rnd = seeded(PR.seed + 11), n = 10 + Math.round(Math.min(10, r / 6)), a0 = PR.moonA;
        for (let i = 0; i < n; i++) {
            const a = a0 + (rnd() - 0.5) * 2.2, d = r * (1.2 + 0.3 * rnd()), X = cx + Math.cos(a) * d, Y = cy + Math.sin(a) * d * 0.9;
            const lit = 0.5 + 0.5 * clamp01(Math.cos(a) * o.L[0] + Math.sin(a) * o.L[1]);
            p.solid(X, Y, PR.type === 'SHATTERED' ? o.ramp : DEBRIS, (0.25 + 0.45 * lit * rnd()) * o.dim);
            if (r > 40 && rnd() < 0.3) p.solid(X + 1, Y, PR.type === 'SHATTERED' ? o.ramp : DEBRIS, 0.3 * o.dim);
        }
    }
    /** Ruins at the dusk line: a short row of pale specks catching the last light. */
    function ruins(p, o) {
        const { cx, cy, r, L } = o, rnd = seeded(PR.seed + 21);
        let best = null;
        for (let i = 0; i < 40 && !best; i++) {
            const nx = (rnd() - 0.5) * 1.6, ny = (rnd() - 0.5) * 1.6, q = nx * nx + ny * ny; if (q > 0.7) continue;
            const nz = Math.sqrt(1 - q), lam = nx * L[0] + ny * L[1] + nz * L[2];
            if (lam > 0.03 && lam < 0.2 && nz > 0.4) best = [nx, ny];
        }
        if (!best) return;
        const n = r < 24 ? 3 : 5, tx = -L[1], ty = L[0], tn = Math.hypot(tx, ty) || 1, step = Math.max(1.5, r / 22);
        for (let i = 0; i < n; i++) { const X = cx + best[0] * r + (tx / tn) * (i - n / 2) * step * 1.6, Y = cy + best[1] * r + (ty / tn) * (i - n / 2) * step * 1.6 + (i % 2); p.solid(X, Y, GLOW.speck, (0.72 + 0.2 * (i % 2)) * o.dim); if (r > 50) p.solid(X, Y - 1, GLOW.speck, 0.5 * o.dim); }
    }
    /** Shattered: the body split in pieces drifting apart (dark gaps where the stars show). */
    function pieceOf(x, y, o) {
        const dx = x - o.cx - Math.cos(PR.cut) * o.r * 0.18, dy = y - o.cy - Math.sin(PR.cut) * o.r * 0.18;
        return Math.floor((((Math.atan2(dy, dx) - PR.cut) % TAU) + TAU) % TAU / (TAU / 3));
    }
    function body(p, o) {
        const { cx, cy, r, L, ramp: rmp } = o, ct = Math.cos(PR.tilt), st = Math.sin(PR.tilt), edge = Math.max(0, 1 - 1.5 / r) ** 2, T = PR.touch;
        const surf = SURF[PR.type] || SURF.ROCKY, shatter = PR.type === 'SHATTERED', R = shatter ? r * 1.14 : r;
        const H = P.norm3(L[0], L[1], L[2] + 1), rims = o.rims, atmo = o.atmo;
        const drift = shatter ? [0, 1, 2].map(k => { const a = PR.cut + (k + 0.5) * TAU / 3; return [Math.cos(a) * r * 0.09, Math.sin(a) * r * 0.09]; }) : null;
        if (atmo) p.ellipse(cx, cy, r + atmo.w, r + atmo.w, (x, y) => {                      // the air, on the lit side only
            const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r, d = Math.hypot(nx, ny);
            if (d < 1) return;
            const facing = (nx * L[0] + ny * L[1]) / d;
            if (facing > 0.1) p.cover(x, y, atmo.ramp, 0.55 * facing * o.dim, (1 - (d - 1) * r / atmo.w) * facing);
        });
        p.region(cx - R - 1, cy - R - 1, cx + R + 1, cy + R + 1, (x, y) => {
            let sx = x + 0.5, sy = y + 0.5;
            if (shatter) {                                                            // which piece is here, sampled from where it was
                let hitK = -1;
                for (let k = 0; k < 3 && hitK < 0; k++) { const qx = sx - drift[k][0], qy = sy - drift[k][1]; if ((qx - cx) ** 2 + (qy - cy) ** 2 < r * r && pieceOf(qx, qy, o) === k) { hitK = k; sx = qx; sy = qy; } }
                if (hitK < 0) return;
            }
            const nx = (sx - cx) / r, ny = (sy - cy) / r, q = nx * nx + ny * ny;
            if (q >= 1) return;
            let nz = Math.sqrt(1 - q), mx = nx, my = ny, mz = nz;
            g.facetK = 0; g.facetHi = false;
            if (T.facets) {                                                           // flat faces: the nearest of a few seeded normals
                const rx0 = nx * ct + ny * st, ry0 = -nx * st + ny * ct;
                let b = -2, b2 = -2, bi = 0;
                PR.cells.forEach((c, i) => { const d = c[0] * rx0 + c[1] * ry0 + c[2] * nz; if (d > b) { b2 = b; b = d; bi = i; } else if (d > b2) b2 = d; });
                const c = PR.cells[bi], cxn = c[0] * ct - c[1] * st, cyn = c[0] * st + c[1] * ct;
                const fn = P.norm3(cxn * 0.62 + nx * 0.38, cyn * 0.62 + ny * 0.38, c[2] * 0.62 + nz * 0.38);
                mx = fn[0]; my = fn[1]; mz = fn[2]; g.facetK = hash(bi, 3, PR.salt) - 0.5; g.facetHi = b - b2 > 0.06 && hash(bi, 5, PR.salt) > 0.55;
                if (b - b2 < 0.02 && r > 18) g.facetK = -0.6;                        // the edge between two faces
            }
            g.nx = nx; g.ny = ny; g.nz = nz; g.x = x; g.y = y; g.r = r;
            g.rx = nx * ct + ny * st; g.ry = -nx * st + ny * ct;
            g.lat = Math.asin(Math.max(-1, Math.min(1, g.ry))); g.lon = Math.atan2(g.rx, nz) + PR.phase;
            g.lam = Math.max(0, (mx * L[0] + my * L[1] + mz * L[2] + 0.06) / 1.06);
            g.e = 0; g.er = null; g.over = null; g.ov = 0; g.cut = false;
            let a = surf();
            if (g.cut && !g.e) return;
            if (T.muted) a = 1 + (a - 1) * 0.92;
            let v = o.ambient + Math.pow(g.lam, 1.1) * 0.9 * a;
            let frost = 0;
            if (T.frost && g.lam > 0.04) {                                            // sector 2: a frost cap at each pole (whole, a dithered edge) and rime on the lit limb
                const edgeF = 0.68 + 0.1 * (fbm(g.lon * 2.5, g.lat * 2.5, PR.salt + 12, 2) - 0.5);
                frost = smooth(edgeF - 0.03, edgeF + 0.03, Math.abs(g.ry)) + (q > 0.93 && g.lam > 0.25 ? 0.7 : 0);
            }
            if (T.colony) { const cxg = (g.lon - PR.phase) * 7, cyg = g.lat * 6; if (Math.abs(cxg - Math.round(cxg)) < 0.1 && Math.abs(cyg - Math.round(cyg)) < 0.12 && hash(Math.round(cxg) & 255, Math.round(cyg) & 255, PR.salt + 8) > 0.55) glow(GLOW.city, 0.75 * night(0.25)); }
            v *= o.dim;
            const isEdge = q > edge;
            if (g.cut) { if (g.e > 0.05) p.solid(x, y, g.er, g.e * o.glowDim); return; }
            if (T.spec && g.lam > 0) {                                                // the light, reflected: one hard spot
                const sp = Math.pow(Math.max(0, mx * H[0] + my * H[1] + mz * H[2]), PR.type === 'MIRROR' ? 140 : 90);
                if (sp > (PR.type === 'MIRROR' ? 0.22 : 0.35)) { p.solid(x, y, RP.SUN, Math.min(1, 0.55 + sp * 0.5) * o.dim); return; }
            }
            if (g.e > 0.06 && level(g.er, g.e * o.glowDim, x, y) > 0 && g.e * o.glowDim > v * 0.9) { p.solid(x, y, g.er, g.e * o.glowDim); return; }
            if (g.over && g.ov > 0) { p.solid(x, y, g.over, g.ov * o.dim); return; }
            if (o.rim && isEdge && g.lam > 0.12 && !shatter) {
                const rv = Math.min(0.95, 0.25 + o.rim * g.lam) * o.dim, rr = o.rimRamp || RP.SUN;
                p.solid(x, y, rr, rv); if (rims) rims.push([x, y, rr, level(rr, rv, x, y)]); return;
            }
            if (frost > threshold(x, y)) { p.solid(x, y, RP.ICE, Math.min(1, v * 1.12 + 0.06)); if (rims && isEdge) rims.push([x, y, RP.ICE, level(RP.ICE, v, x, y)]); return; }   // sector 2: rime at the poles and the lit limb
            if (T.odd && isEdge && g.lam < 0.01 && -(nx * L[0] + ny * L[1]) / Math.hypot(L[0], L[1]) > 0.55 && hash(x & 255, y & 255, PR.salt) > 0.35) { p.solid(x, y, GLOW.odd, 0.4 * o.dim); return; }   // sector 3: an odd colour on the far night edge
            p.solid(x, y, rmp, v);
            if (rims && isEdge && g.lam > 0.06) rims.push([x, y, rmp, level(rmp, v, x, y)]);
        });
    }

    /** One world, painted. Returns its rim pixels (the pointing highlight) and how far it reaches (in radii). */
    function paint(p, o) {
        const node = o.node || null, sector = o.sector || 1;
        PR = paramsOf(node, sector, o.type, o.seed);
        const L = o.L || P.norm3(-0.6, -0.35, 0.7), type = PR.type, pal = palette(type), grey = !!o.grey;
        PR.hot = (() => { const l = Math.hypot(L[0], L[1]) || 1, a = Math.atan2(-L[1] / l, -L[0] / l) + PR.jit[0] * 0.9; return [Math.cos(a) * 0.62, Math.sin(a) * 0.62]; })();   // opposite the light
        PR.pit = [0.22 * Math.sign(PR.jit[0] || 1), -0.62];
        const ct = Math.cos(PR.tilt), st = Math.sin(PR.tilt);
        PR.glints = PR.cells.map(([rx, ry, rz]) => [rx * ct - ry * st, rx * st + ry * ct, rz])     // carbon's glints: lit, facing us, apart
            .filter(([nx, ny, nz]) => nz > 0.3 && nx * L[0] + ny * L[1] + nz * L[2] > 0.4).slice(0, 4);
        const cold = sector === 2 && !LIVING[type] && type !== 'TOXIC' && !GASSY[type];      // the cold sector: a pale blue air
        const atmoRamp = type === 'TOXIC' ? ACID_ATMO : LIVING[type] ? TEAL_ATMO : cold ? RP.ICE : DUSTY[type] ? RP.DUST : o.atmo || pal.atmo || (LOOK[type] === 'desert' ? RP.DUST : RP.ICE);
        const w = Math.max(2, Math.round(o.r / 22 * (type === 'TOXIC' ? 3.2 : LIVING[type] ? 1.7 : DUSTY[type] ? 1.9 : 1)));
        const O = { cx: o.cx, cy: o.cy, r: o.r, L, ramp: o.ramp || pal.ramp, dim: grey ? 0.62 : o.dim > 0 ? Math.min(1, o.dim) : 1, glowDim: grey ? 0.5 : 1, ambient: grey ? 0.006 : 0.012,
            rim: type === 'ROGUE' ? 0 : grey ? 0.2 : 0.12, rimRamp: LIVING[type] ? TEAL_RIM : null,
            atmo: type === 'ROGUE' || type === 'MIRROR' || type === 'SHATTERED' ? null : { ramp: atmoRamp, w }, rims: [] };
        if (type === 'ROGUE') O.ambient = 0.03;
        if (type === 'ROGUE') O.L = P.norm3(L[0], L[1], L[2] - 0.9);                 // no sun of its own: barely lit, from behind
        const comp = PR.companion;
        if (comp === 'ring') ring(p, O, false);
        if (comp === 'halo') halo(p, O);
        if (comp === 'moon' && PR.moonBehind) moon(p, O);
        body(p, O);
        if (comp === 'ring') ring(p, O, true);
        else if (comp === 'moon' && !PR.moonBehind) moon(p, O);
        else if (comp === 'wreck') wreck(p, O);
        else if (comp === 'debris') debris(p, O);
        else if (comp === 'ruins') ruins(p, O);
        else if (comp === 'aurora' && o.r >= 10) auroraCap(p, O);
        else if (comp === 'lighthouse') { const X = O.cx + Math.cos(PR.moonA) * O.r * 1.04, Y = O.cy + Math.sin(PR.moonA) * O.r * 1.04; p.solid(X, Y, DEBRIS, 0.5 * O.dim); }
        PR = null;
        return { rims: O.rims, reach: reach(node, sector, o.type) };
    }
    /** Sector 2: an aurora oval round the pole away from the light: an arc that bends over the limb, brightest on the night side. */
    function auroraCap(p, o) {
        const { cx, cy, r, L } = o, pole = L[1] > 0 ? -1 : 1;                   // the pole away from the light
        p.region(cx - r * 1.15, cy - r * 1.2, cx + r * 1.15, cy + r * 1.2, (x, y) => {
            const nx = (x + 0.5 - cx) / r, ny = (y + 0.5 - cy) / r, d = Math.hypot(nx, ny);
            const ring = Math.hypot(nx * 0.95, ny - pole * 1.02);                // the oval round a pole just past the limb
            const band = Math.exp(-((ring - 0.5) ** 2) / 0.004) * (0.55 + 0.45 * vnoise(nx * 8, ny * 3, 9));
            const nightK = 1 - smooth(-0.2, 0.5, nx * L[0] + ny * L[1]);
            const v = band * nightK * (d < 1 ? 0.95 : 0.6);                         // off the limb, fainter: it is thin air there
            if (d < 1.12 && v > 0.1) p.cover(x, y, GLOW.aurora, Math.min(1, v) * o.glowDim, 0.85);
        });
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 4. The few moving pixels (eight steps a second, sparse)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function nightPoint(i, L, salt) {
        for (let k = 0; k < 12; k++) {
            const nx = (hash(i, k, salt) - 0.5) * 1.7, ny = (hash(k, i, salt + 1) - 0.5) * 1.7, q = nx * nx + ny * ny;
            if (q > 0.72) continue;
            if (nx * L[0] + ny * L[1] + Math.sqrt(1 - q) * L[2] < -0.12) return [nx, ny];
        }
        return null;
    }
    function live(f, node, x, y, r, t, o) {
        if (r < 9) return;
        const opt = o || {}, sector = opt.sector || 1, pr = paramsOf(node, sector, opt.type, opt.seed), L = opt.L || P.norm3(-0.6, -0.35, 0.7);
        const tick = Math.floor(t / P.TICK), X = Math.round(x), Y = Math.round(y);
        if (pr.type === 'STORM_WORLD') {                                              // lightning flickers on the night side
            const n = Math.floor(t / 900), ph = t % 900;
            if (ph < 250 && hash(n & 255, 3, pr.salt) > 0.35) { const q = nightPoint(n & 255, L, pr.salt); if (q) { const bx = X + Math.round(q[0] * r), by = Y + Math.round(q[1] * r), on = ph < 125; f.px(bx, by, GLOW.bolt.hex[on ? 4 : 3]); if (on && r > 30) { f.px(bx + 1, by, GLOW.bolt.hex[2]); f.px(bx, by + 1, GLOW.bolt.hex[3]); } } }
        }
        if (pr.type === 'CARBON' || pr.type === 'CRYSTALLINE' || pr.touch.spec) {     // a glint catches the light as it turns
            const n = Math.floor(t / 1700), ph = t % 1700;
            if (ph < 250) { const a = Math.atan2(L[1], L[0]) + (hash(n & 255, 1, pr.salt) - 0.5) * 1.6, d = r * (0.72 + 0.2 * hash(n & 255, 2, pr.salt)); f.px(X + Math.round(Math.cos(a) * d), Y + Math.round(Math.sin(a) * d), GLOW.speck.hex[ph < 125 ? 4 : 3]); }
        }
        if (pr.type === 'SINGING') {                                                  // a slow pulsing rim
            const v = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t / 900)), rr = r + 1.5, n = Math.max(24, Math.round(rr * 3));
            for (let i = 0; i < n; i += 2) { const a = i / n * TAU; f.tone(X + Math.cos(a) * rr, Y + Math.sin(a) * rr, GLOW.halo, v); }
        }
        if (pr.companion === 'lighthouse' && (t % 3200) < 375) {                      // a slow blinking point
            const bx = X + Math.round(Math.cos(pr.moonA) * r * 1.04), by = Y + Math.round(Math.sin(pr.moonA) * r * 1.04);
            f.px(bx, by, RP.AMBER.hex[4]); if (r > 20) { f.px(bx - 1, by, RP.AMBER.hex[2]); f.px(bx + 1, by, RP.AMBER.hex[2]); f.px(bx, by - 1, RP.AMBER.hex[2]); }
        }
        if (pr.companion === 'halo') { const a = (t / 5200) * TAU + pr.moonA, R = r * 1.34; f.px(X + Math.round(Math.cos(a) * R), Y + Math.round(Math.sin(a) * R), GLOW.halo.hex[5]); }
        if (pr.companion === 'wreck' && (t % 2600) < 250 && r >= 14) {
            const a = pr.moonA, d = r * 1.36; f.px(X + Math.round(Math.cos(a) * d), Y + Math.round(Math.sin(a) * d * 0.55), GLOW.speck.hex[4]);
        }
        if (pr.touch.odd && (tick % 7) < 2) {                                          // sector 3: the odd edge shimmers
            const a = Math.atan2(-L[1], -L[0]) + (hash(tick & 255, 4, pr.salt) - 0.5) * 1.4;
            f.px(X + Math.round(Math.cos(a) * (r - 0.5)), Y + Math.round(Math.sin(a) * (r - 0.5)), GLOW.odd.hex[4]);
        }
    }

    function describe(node, sector, type) { const pr = paramsOf(node, sector || 1, type); return { type: pr.type, surface: SURF[pr.type] ? pr.type : 'ROCKY', companion: pr.companion, touch: Object.assign({}, pr.touch) }; }

    window.NSWorlds = Object.freeze({ paint, reach, live, palette, describe, GLOW });
})();
