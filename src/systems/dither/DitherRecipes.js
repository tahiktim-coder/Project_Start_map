/* DitherRecipes — how each of the game's 30 planet types looks in dither mode.
   Every recipe = a surface painter + a colour ramp + a light direction + silhouette extras
   (rings, moons, debris, halo), so types stay distinct even at the 36px map-node size.
   surf(u, v, t, p) → { g: albedo 0..1, a: accent 0..1, hot: self-emission, land, cloud } */

(function () {
    'use strict';
    const { vnoise, fbm, ridge, ramp } = window.DitherCore;

    const ACCENT = {
        green: [143, 230, 171], teal: [127, 224, 208], blue: [127, 188, 245], ice: [130, 196, 226],
        amber: [232, 170, 84], ember: [226, 108, 54], violet: [164, 140, 214], acid: [214, 240, 138],
        pink: [232, 138, 208], sulfur: [230, 220, 90], bone: [176, 150, 116],
    };
    const LIGHT = {
        front: [-0.55, -0.35, 0.75], side: [-0.95, -0.2, 0.25], crescent: [0.88, -0.25, 0.05],
        back: [0.7, -0.35, -0.6], top: [-0.2, -0.85, 0.45], locked: [0.97, 0, 0.2],
    };

    function wrapDist(u, centre) {
        const d = (((u - centre) % 1) + 1) % 1;
        return Math.min(d, 1 - d);
    }

    // ── surface painters ──
    const gas = o => (u, v, t, p) => {
        const w = fbm(u * 3 + p.so, v * 4, 3) * 0.8;
        const band = 0.5 + 0.5 * Math.sin(v * (o.bands || 11) + w * 4 - (o.pulse ? t * 0.0016 : 0));
        const sharp = band * band * band;
        let eye = 0;
        for (let k = 0; k < (o.eyes == null ? 1 : o.eyes); k++) {
            const du = wrapDist(u, 0.3 + k * 0.37), dv = (v - (0.64 - k * 0.2)) * 2.2;
            const e = Math.sqrt(du * du * 4 + dv * dv) / 0.11;
            if (e < 1) eye = Math.max(eye, 0.8 * (1 - e) + (e > 0.6 ? 0.4 : 0));
        }
        // lightning: cells of cloud flash for one clock step at a time
        const flash = (o.lightning && vnoise(u * 9 + Math.floor(t / 250) * 7.3, v * 9) > 0.9) ? 1 : 0;
        return { g: 0.28 + 0.55 * sharp + 0.1 * w + eye, a: eye > 0 ? 1 : 0, hot: flash }; // bands get hue from the ramp; accent = the storm
    };

    const ice = o => (u, v, t, p) => {
        const f = o.plates || 6;
        const crack = ridge(u * f + p.so, v * f) > 0.86;
        const frost = fbm(u * 30, v * 30, 2);
        const aur = (o.aurora && v < 0.22) ? Math.max(0, Math.sin(u * 40 + t * 0.002) * 0.5) * (0.22 - v) * 8 : 0;
        return { g: (crack ? 0 : 0.78) + 0.14 * frost + aur * 0.6, a: (crack ? 1 : 0) + aur };
    };

    const ember = o => (u, v, t, p) => {
        const vein = ridge(u * 7 + p.so, v * 7), fine = ridge(u * 22 + p.so, v * 22);
        // thin bright cracks over visible dark rock — wide veins turn the whole disc into an orange blob
        const hot = Math.max(0, vein - (o.wide ? 0.74 : 0.82)) * 4.5 + Math.max(0, fine - 0.9) * 2;
        const beat = o.pulse ? 0.55 + 0.45 * Math.sin(t * 0.002 + u * 12 + v * 5) : 1;
        return { g: o.albedo || 0.35, a: 0, hot: hot * 1.1 * beat };
    };

    // a pit punched through the crust: black floor, burning rim
    const hollow = () => (u, v, t, p) => {
        const du = Math.min(wrapDist(u, 0.3), wrapDist(u, 0.8)) * 2, dv = v - 0.5;
        const d = Math.sqrt(du * du + dv * dv) / 0.26;
        if (d < 0.8) return { g: 0, a: 0 };
        if (d < 1) return { g: 0.2, a: 0, hot: 1 };
        return { g: 0.45 + 0.2 * (fbm(u * 18 + p.so, v * 18, 2) - 0.5), a: 0 };
    };

    const rock = o => (u, v, t, p) => {
        let g = (o.albedo || 0.5) + 0.2 * (fbm(u * 20 + p.so, v * 20, 2) - 0.5);
        for (const c of p.craters) {
            const du = wrapDist(u, c.u), d = Math.sqrt(du * du + (v - c.v) * (v - c.v)) / c.r;
            if (d < 1.15) g += d < 0.75 ? -0.28 : (d < 1 ? 0.35 : 0);
        }
        let land = false;
        if (o.grid) {
            const line = Math.abs(Math.sin(u * Math.PI * 36)) > 0.97 || Math.abs(Math.sin(v * Math.PI * 18)) > 0.97;
            if (line) g += 0.3 * o.grid;
            land = vnoise(u * 12 + p.so, v * 12) > 0.4;
        }
        let hot = 0;
        if (o.trench && Math.abs(v - 0.5) < 0.014) { g = 0.05; hot = Math.sin(u * 140) > 0.2 ? 0.9 : 0; }
        if (o.glint && vnoise(u * 70 + p.so, v * 70) > 0.86) hot = 1;
        return { g, a: 0, hot, land, cloud: 0 };
    };

    const terra = o => (u, v, t, p) => {
        const land = fbm(u * 5 + p.so, v * 5), isLand = land > (o.land || 0.5);
        const cloud = Math.max(0, fbm((u + t * 0.000012) * 9 + 40, v * 7, 3) - 0.52) * 2.4;
        const cap = o.caps && (v < 0.1 || v > 0.9);
        const base = cap ? 0.9 : (isLand ? 0.62 + 0.9 * (land - 0.5) : 0.22);
        return { g: base + cloud * 0.7, a: 0, land: isLand && !cap, cloud }; // accent is reserved for night lights
    };

    const desert = o => (u, v, t, p) => {
        const warp = fbm(u * 4 + p.so, v * 4, 3);
        // fine diagonal ripples — wide horizontal bands would read as a gas giant
        const dune = 0.5 + 0.5 * Math.sin((v + u * 0.6) * (o.freq || 70) + warp * 9);
        return { g: 0.4 + 0.4 * dune, a: dune > 0.8 ? 0.8 : 0 };
    };

    const toxic = o => (u, v, t, p) => {
        const swirl = fbm(u * 3 + p.so + fbm(u * 2 + t * 0.00002, v * 2, 2) * 2.2, v * 5, 4);
        return { g: (o.albedo || 0.55) * (0.4 + 1.2 * swirl), a: swirl > 0.55 ? 1 : 0 };
    };

    const cells = () => (u, v, t, p) => {
        const wall = ridge(u * 9 + p.so, v * 9), pulse = 0.5 + 0.5 * Math.sin(t * 0.0012 + u * 20);
        return { g: wall > 0.78 ? 0.15 : 0.5 + 0.3 * fbm(u * 25, v * 25, 2), a: wall > 0.78 ? 0 : pulse * 0.9 };
    };

    // a chrome ball: near-black body that reflects the starfield, plus a hard specular (recipe.spec)
    const mirror = () => (u, v) => ({ g: vnoise(u * 55, v * 55) > 0.83 ? 0.95 : 0.1, a: 0 });

    // flat-shaded facets with sparkle on the brightest faces
    const facets = () => (u, v, t, p) => {
        const face = Math.floor(vnoise(u * 9 + p.so, v * 9) * 5) / 5, edge = ridge(u * 9 + p.so, v * 9) > 0.9;
        const sparkle = (face > 0.55 && vnoise(u * 80, v * 80 + Math.floor(t / 500)) > 0.88) ? 1 : 0;
        return { g: edge ? 0.15 : 0.35 + face * 0.7, a: 0, hot: sparkle };
    };

    // giant pale caps ringed in shadow, drifting spores for the accent
    const spots = () => (u, v, t, p) => {
        let g = 0.3 + 0.15 * fbm(u * 14 + p.so, v * 14, 2), a = 0;
        for (const c of p.craters) {
            const d = Math.sqrt(Math.pow(wrapDist(u, c.u), 2) + (v - c.v) * (v - c.v)) / (c.r * 1.7);
            if (d < 1) { g = d < 0.7 ? 0.85 - d * 0.3 : 0.08; a = d < 0.7 ? 0.6 : 0; }
        }
        return { g, a };
    };

    // ── game type → recipe. spin is seconds per revolution. ──
    const R = (surf, accent, light, extra) => Object.assign({ surf, accent, light, spin: 60 }, extra || {});
    const TYPES = {
        VITAL:          R(terra({ land: 0.5, tint: 'land' }), ACCENT.green, LIGHT.front, { spin: 50, moons: 1 }),
        EDEN:           R(terra({ land: 0.46, tint: 'land', caps: true }), ACCENT.green, LIGHT.front, { spin: 55, moons: 2 }),
        SYMBIOTE_WORLD: R(ember({ albedo: 0.3, pulse: true }), ACCENT.teal, LIGHT.front, { spin: 70, lit: 0.7 }),
        FUNGAL:         R(spots(), ACCENT.acid, LIGHT.front, { spin: 80, glow: 0.35 }),
        TERRAFORMED:    R(terra({ land: 0.52 }), ACCENT.amber, LIGHT.front, { spin: 50, nightLights: true, debris: 14 }),

        OCEANIC:        R(terra({ land: 0.64, tint: 'water', caps: true }), ACCENT.blue, LIGHT.front, { spin: 55, moons: 1 }),
        SINGING:        R(gas({ bands: 26, eyes: 0, pulse: true }), ACCENT.blue, LIGHT.crescent, { spin: 90, glow: 0.4 }),

        ICE_WORLD:      R(ice({ aurora: true }), ACCENT.ice, LIGHT.crescent, { spin: 80, glow: 0.45 }),
        FROZEN_OCEAN:   R(ice({ plates: 4 }), ACCENT.ice, LIGHT.side, { spin: 85 }),
        CRYSTALLINE:    R(facets(), ACCENT.ice, LIGHT.front, { spin: 75, spec: 0.9 }),
        MIRROR:         R(mirror(), null, LIGHT.front, { spin: 60, spec: 1.6, glow: 0.3 }),

        ROCKY:          R(rock({}), null, LIGHT.side, { spin: 70, moons: 1 }),
        CARBON:         R(rock({ albedo: 0.45, glint: true }), ACCENT.ice, LIGHT.front, { spin: 75 }),
        TOMB_WORLD:     R(rock({ grid: 0.7 }), ACCENT.bone, LIGHT.top, { spin: 90, debris: 22 }),
        GRAVEYARD:      R(rock({}), null, LIGHT.side, { spin: 70, debris: 110, wrecks: 5 }),
        MECHA:          R(rock({ grid: 1, trench: true }), ACCENT.amber, LIGHT.front, { spin: 60, nightLights: true }),
        MACHINE_WORLD:  R(rock({ grid: 1, albedo: 0.4, trench: true }), ACCENT.ice, LIGHT.crescent, { spin: 60, nightLights: true }),
        ROGUE:          R(rock({ albedo: 0.4 }), ACCENT.violet, LIGHT.back, { spin: 120, glow: 0.05 }),

        DESERT:         R(desert({}), ACCENT.amber, LIGHT.front, { spin: 65 }),
        SULFUR:         R(desert({ freq: 44 }), ACCENT.sulfur, LIGHT.top, { spin: 65, glow: 0.3 }),

        VOLCANIC:       R(ember({}), ACCENT.ember, LIGHT.front, { spin: 40, lit: 0.4 }),
        SHATTERED:      R(ember({ wide: true }), ACCENT.ember, LIGHT.side, { spin: 45, lit: 0.6, debris: 90 }),
        TIDALLY_LOCKED: R(ember({ albedo: 0.6 }), ACCENT.ember, LIGHT.locked, { spin: 100000 }),
        HOLLOW:         R(hollow(), ACCENT.amber, LIGHT.front, { spin: 70 }),

        GAS_GIANT:      R(gas({}), ACCENT.ember, LIGHT.front, { spin: 60, ring: true, moons: 1 }),
        STORM_WORLD:    R(gas({ bands: 7, eyes: 3, lightning: true }), ACCENT.ice, LIGHT.side, { spin: 35, moons: 1 }),

        TOXIC:          R(toxic({}), ACCENT.acid, LIGHT.front, { spin: 50, glow: 0.5 }),
        BIO_MASS:       R(cells(), ACCENT.pink, LIGHT.top, { spin: 55, glow: 0.35 }),
        RADIATION_BELT: R(toxic({}), ACCENT.green, LIGHT.side, { spin: 50, glow: 0.4, debris: 120 }),
        GHOST_WORLD:    R(toxic({ albedo: 0.22 }), ACCENT.violet, LIGHT.back, { spin: 90, glow: 0.9 }),
    };

    // ── colour ramps: night → shadow → mid → lit → highlight. Tone picks the hue, so on a terra
    //    world dark water lands in the blues, bright land in the greens and cloud tops in white. ──
    const NIGHT = '#06070a';
    const RAMPS = {
        VITAL:          ['#0f2a4a', '#1f5c8a', '#3f8a4a', '#8fd67a', '#f2fff0'],
        EDEN:           ['#0d3350', '#2a7a9a', '#4fae5a', '#a8f0a0', '#ffffff'],
        SYMBIOTE_WORLD: ['#082a20', '#1f6a58', '#5fd0a8', '#defff0'],
        FUNGAL:         ['#1a1430', '#4a3a78', '#8c6ac4', '#c8e89a'],
        TERRAFORMED:    ['#0b2c38', '#2f6d80', '#5aa890', '#b8e8c8', '#ffffff'],
        OCEANIC:        ['#0b1d3a', '#1f4f9a', '#3f86d8', '#c2a25f', '#f4fbff'],
        SINGING:        ['#101838', '#4152a0', '#7a8fe0', '#e0e6ff'],
        ICE_WORLD:      ['#123845', '#3f7f98', '#8fd0e0', '#eafdff'],
        FROZEN_OCEAN:   ['#0e2a42', '#2f5f90', '#8cbce8', '#eaf6ff'],
        CRYSTALLINE:    ['#1c3a52', '#5a90b8', '#b8e4f5', '#ffffff'],
        MIRROR:         ['#1e2024', '#55595f', '#a8adb5', '#ffffff'],
        ROCKY:          ['#241f17', '#5a5240', '#9a8f72', '#e0d8c0'],
        CARBON:         ['#0c0c0e', '#2a2a2e', '#55555c', '#a0a0a8'],
        TOMB_WORLD:     ['#161008', '#4e3f2e', '#8a7458', '#e0d0b8'],
        GRAVEYARD:      ['#141416', '#404046', '#78787e', '#d8d8d8'],
        MECHA:          ['#141c20', '#44545c', '#8397a0', '#eef6f8'],
        MACHINE_WORLD:  ['#0e1a22', '#2c4656', '#6288a0', '#d8ecf5'],
        ROGUE:          ['#080614', '#241c40', '#4a3f70', '#c8b8f0'],
        DESERT:         ['#311c0b', '#8a5420', '#d89848', '#ffe6ad'],
        SULFUR:         ['#28230a', '#7a6e1a', '#c8bc3e', '#fff8ac'],
        VOLCANIC:       ['#180605', '#3d130c', '#8a2a14', '#ff7038', '#ffe0b0'],
        SHATTERED:      ['#140504', '#33100a', '#7a2214', '#ff5030', '#ffd0b0'],
        TIDALLY_LOCKED: ['#180a05', '#5a2810', '#b8602a', '#ffb060', '#fff0d0'],
        HOLLOW:         ['#180f05', '#4a3412', '#8a6a2a', '#ffc040', '#ffeebb'],
        GAS_GIANT:      ['#2c1a44', '#6a4a9a', '#b088d8', '#e8c08a', '#fff0dc'],
        STORM_WORLD:    ['#101c28', '#34506a', '#6a8cac', '#b8cce0', '#f4faff'],
        TOXIC:          ['#222f10', '#5a7a26', '#a8cc50', '#f3ffb6'],
        BIO_MASS:       ['#280f22', '#7a3a6a', '#c46aae', '#ffd0f0'],
        RADIATION_BELT: ['#0c260c', '#2f7a2f', '#66d066', '#d0ffd0'],
        GHOST_WORLD:    ['#16162a', '#48486e', '#9a9ac4', '#e6e6ff'],
    };
    Object.keys(TYPES).forEach(type => { TYPES[type].ramp = ramp(NIGHT, ...RAMPS[type]); });

    const STATION_RAMP = ramp(NIGHT, '#2a302c', '#7f8a82', '#cfd8cf', '#f0f5f0');
    const ASTEROID_RAMP = ramp(NIGHT, '#241f17', '#6f6650', '#b3a886', '#efe8d6');

    window.DitherRecipes = { TYPES, FALLBACK: TYPES.ROCKY, ACCENT, LIGHT, STATION_RAMP, ASTEROID_RAMP };
})();
