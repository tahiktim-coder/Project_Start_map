/* ═══ Silent Exodus · new screen (?new=1) · travel/SectorLooks.js: how each sector looks from the travel view ═════════
   What it is: per sector 1-6, the title, the space strip (seed, dust, haze, stars), the light's size, the far colours
   (sectors 1 and 2 have their own; 3-6 keep sky F's), and which divider is drawn (1 the ringed giant, 2 the rogue world;
   3-6 the enormous thing baked into sky F: the shell, the pillars, the eye, the ring of lit dust).
   Source: prototypes/screens/game-screen-v3/data.js SECTORS 1-2 (light, strip) and prototypes/slice/world.js FAR_COLOURS;
   sectors 3-6 are new (BUILD_A.md §6). Words: the title is SECTOR_CONFIG's name in title case (docs/STYLE.md).
   Loaded only when the new-screen switch is on (BUILD_A.md §1). Needs NSPaint and NSSky2 (art/), nothing else.

   window.NSLooks (frozen)
     of(n)                 → { n, title, seed, dust, haze, stars, light: { core, halo, strength, spikes }, divider }
                             divider: 'giant' (1) | 'rogue' (2) | null (3-6: sky F carries it)
     farColours(n, R)      → [accent, ...] in space-side u, v (sectors 1 and 2) or null (sky F's own accents stay)
     accentRamps()         → the ramps the far colours use (sky F's ACC plus three of the slice's own)
     titleOf(n)            → 'The Graveyard' (SECTOR_CONFIG name in title case; a plain fallback if it is missing)
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!P) return;
    const { INK, RP } = P;

    // the space strip and the light, per sector. The light grows sector by sector: we are flying toward it.
    const LOOKS = {
        1: { seed: 11, dust: 0.12, haze: 1, stars: 1, light: { core: 2, halo: 14, strength: 1, spikes: 5 }, divider: 'giant' },
        2: { seed: 22, dust: 0.08, haze: 0.6, stars: 1.6, light: { core: 5, halo: 34, strength: 1, spikes: 7 }, divider: 'rogue' },
        3: { seed: 33, dust: 0.1, haze: 0.9, stars: 1.2, light: { core: 7, halo: 40, strength: 1, spikes: 8 }, divider: null },
        4: { seed: 44, dust: 0.14, haze: 1, stars: 1.3, light: { core: 9, halo: 48, strength: 1, spikes: 9 }, divider: null },
        5: { seed: 55, dust: 0.1, haze: 0.8, stars: 1.1, light: { core: 11, halo: 58, strength: 1, spikes: 10 }, divider: null },
        6: { seed: 66, dust: 0.16, haze: 1.1, stars: 1, light: { core: 15, halo: 80, strength: 1, spikes: 12 }, divider: null },
    };
    const FALLBACK_TITLES = { 1: 'The Graveyard', 2: 'The Dark Void', 3: 'The Signal', 4: 'The Garden', 5: 'The Tally', 6: 'The Light' };

    function titleOf(n) {
        const cfg = typeof SECTOR_CONFIG !== 'undefined' ? SECTOR_CONFIG[n] : null;           // eslint-disable-line no-undef
        const raw = cfg && typeof cfg.name === 'string' ? cfg.name : null;
        if (!raw) return FALLBACK_TITLES[n] || '';
        return raw.toLowerCase().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    }

    function of(n) {
        const k = LOOKS[n] ? n : Math.min(6, Math.max(1, Math.round(n) || 1));
        const L = LOOKS[k];
        return { n: k, title: titleOf(k), seed: L.seed, dust: L.dust, haze: L.haze, stars: L.stars, light: Object.assign({}, L.light), divider: L.divider };
    }

    /** The ramps of the far colours: sky F's accent ramps, plus the slice's teal shell, cold pair and cyan blink. */
    function accentRamps() {
        const ACC = (window.NSSky2 && window.NSSky2.ACC) || {};
        return {
            ROSE: ACC.ROSE || RP.DUST, CRIMSON: ACC.CRIMSON || RP.RED, VERDIGRIS: ACC.VERDIGRIS || RP.ICE, JADE: ACC.JADE || RP.ICE, SLATE: ACC.SLATE || RP.PASSED,
            TEAL: P.ramp(INK, '#07120f', '#0f2621', '#1b4239', '#2c6556', '#4a8f7c', '#86c2ad'),
            COLD: P.ramp(INK, '#0f121c', '#22283c', '#454f70', '#8590b8', '#d4daf2'),
            CYAN: P.ramp(INK, '#051416', '#0b2a2d', '#134a4e', '#227479', '#4aa6aa', '#7cc8c8'),
        };
    }

    /** The far colours of sectors 1 and 2 (slice world.js FAR_COLOURS): rare, far, dull; each a few dozen pixels of one hue.
        Sizes are in the 360-row stage's pixels; u, v on the space side. */
    const FAR = {
        1: R => [
            { kind: 'veil', u: 0.30, v: 0.08, len: 150, wide: 7, tilt: 0.16, ramp: R.SLATE, depth: 0.3, gain: 1.15, seed: 61 },
            { kind: 'planetary', u: 0.20, v: 0.30, r: 3.4, ramp: R.TEAL, depth: 0.8, live: 'pulse', period: 11000, gain: 1.45, seed: 31 },
            { kind: 'knot', u: 0.55, v: 0.06, r: 7, tilt: -0.5, ramp: R.ROSE, depth: 0.7, live: 'pulse', period: 14000, gain: 1.25, seed: 3 },
            { kind: 'dwarf', u: 0.97, v: 0.08, r: 4, ramp: R.CRIMSON, depth: 1.3, live: 'flare', period: 23000, gain: 1.3, seed: 5 },
            { kind: 'binary', u: 0.04, v: 0.40, sep: 2, ramp: R.COLD, ramp2: R.COLD, depth: 1.1, live: 'twinkle', period: 17000, seed: 11 },
            { kind: 'comet', u: 0.47, v: 0.38, ramp: R.JADE, depth: 0.6 },
            { kind: 'blink', u: 0.06, v: 0.95, ramp: R.CYAN, depth: 0.9, period: 5200 },
        ],
        2: R => [
            { kind: 'veil', u: 0.52, v: 0.30, len: 170, wide: 8, tilt: -0.22, ramp: R.JADE, depth: 0.3, gain: 1.1, seed: 71 },
            { kind: 'dwarf', u: 0.24, v: 0.16, r: 4, ramp: R.CRIMSON, depth: 1.2, live: 'flare', period: 31000, gain: 1.3, seed: 21 },
            { kind: 'planetary', u: 0.64, v: 0.10, r: 3, ramp: R.TEAL, depth: 0.8, live: 'pulse', period: 9000, gain: 1.4, seed: 23 },
            { kind: 'knot', u: 0.08, v: 0.46, r: 6, tilt: 0.6, ramp: R.ROSE, depth: 0.6, live: 'pulse', period: 12000, gain: 1.15, seed: 25 },
        ],
    };
    function farColours(n, R) { const make = FAR[n]; return make ? make(R || accentRamps()) : null; }

    window.NSLooks = Object.freeze({ of, farColours, accentRamps, titleOf });
})();
