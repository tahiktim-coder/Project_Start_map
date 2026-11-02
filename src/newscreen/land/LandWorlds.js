/* ═══ Silent Exodus · new screen (?new=1) · land/LandWorlds.js: THE METEOR in the game (PR #32) ═══
   New for the game: it replaces the sketch's prototypes/landing-meteor/landing-worlds.js (its seven dummy worlds and their
   finds) and keeps that file's window name, so the sketch's other files read the game's own worlds in the shapes they knew.
   Read only: nothing here writes game state.
   window.LandingWorlds (frozen)
     worldOf(planet, sector) → world    the world as the sketch's files read it: { id, node, name, type, atmosphere, gravity,
                                        temp, sector, seed, L, atm, twist, dK, hard, hulls }. The air is the planet's own (the
                                        real one under a scrambled scan) when the flight knows it (LandingFlight.ATM), else THIN
     findOf(world, find, o) → find      the game's find (WorldFinds.js) as the sketch's: { id, slot, kind, base, uv, risk,
                                        scanned, weak, nl, tod, Ls }. o: { unmarked ('unscanned' | 'weak' | null), risk }
     kindOf(find) → kind                its light's kind: wreck colony ruins graves signal life machines plain
     canFly(planet) → bool              the meteor can land there: ground under it (no platform world, not the Wrong Place)
*/
(function () {
    'use strict';
    const P = window.NSPaint, A = window.LandingArt, LF = window.LandingFlight, LG = window.LanderGame;
    if (!P || !A || !LF || !LG) return;
    const I = LG.internals;
    function hashId(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
    // a site's light (WorldFinds.js SITES): our wreck's beacon, a dome's windows, a beacon's pulse, the graves' flare
    const SITE_KIND = { EXODUS_WRECK: 'wreck', FAILED_COLONY: 'colony', GARDEN: 'colony', LIGHTHOUSE: 'signal', GRAVE: 'graves' };
    const FEATURE_KIND = { ruins: 'ruins', signal: 'signal', life: 'life', machines: 'machines' };
    // the one thing a world's entry asks you to read (the sketch's TWIST): the storm's cells, the thin air, the ocean's glide;
    // the ground's own rule (LanderGame's ground) is the second hard factor (only how many there are is read)
    const GROUND_HARD = { ice: 'ice slide', dunes: 'brownout', lava: 'lava updraft' };

    function worldOf(planet, sector) {
        const real = planet._realAtmosphere || planet.atmosphere, atmosphere = Object.prototype.hasOwnProperty.call(LF.ATM, real) ? real : 'THIN';
        const m = planet.metrics || {}, type = planet.type, ground = I.GROUND_OF[type] || 'rock';
        const twist = type === 'STORM_WORLD' ? 'cells' : atmosphere === 'THIN' ? 'thin' : type === 'OCEANIC' ? 'glide' : null;
        return {
            id: planet.id, node: planet, name: planet.name, type, atmosphere, gravity: Number.isFinite(m.gravity) ? m.gravity : 1, temp: m.temp,
            sector: sector || 1, seed: 1 + (hashId(planet.id) % 9973), L: A.LW, atm: LF.ATM[atmosphere] || 0, twist, dK: twist === 'glide' ? 1.35 : 1,
            hard: [twist, GROUND_HARD[ground]].filter(Boolean), hulls: type === 'TIDALLY_LOCKED',
        };
    }
    function kindOf(f) {
        if (!f) return 'plain';
        if (f.kind === 'site') return SITE_KIND[f.site] || 'plain';
        if (f.kind === 'eden') return 'life';
        return (f.feature && FEATURE_KIND[f.feature]) || 'plain';
    }
    /** Where the find is on its world, its time of day (n·L there) and which side the sun is on (the sketch's placeFind). */
    function place(w, uv) {
        const L = w.L || A.LW, nz = Math.sqrt(Math.max(0, 1 - uv[0] * uv[0] - uv[1] * uv[1])), nl = uv[0] * L[0] + uv[1] * L[1] + nz * L[2];
        const tx = L[0] - uv[0] * nl;
        return { uv, nl, tod: nl > 0.4 ? 'day' : nl >= 0.15 ? 'dusk' : 'night', Ls: tx >= 0 ? 1 : -1 };
    }
    function findOf(w, f, o) {
        o = o || {};
        const kind = kindOf(f), uv = f && Array.isArray(f.at) && f.at.length === 2 ? f.at.slice() : [-0.4, 0.1];
        const risk = Number.isFinite(o.risk) ? o.risk : f && Number.isFinite(f.risk) ? f.risk : 15;
        return Object.assign({ id: (f && f.id) || 'kind', slot: 0, kind, base: kind, risk, scanned: o.unmarked !== 'unscanned', weak: o.unmarked === 'weak' }, place(w, uv));
    }
    function canFly(planet) {
        if (!planet || !planet.type || planet._isWrongPlace || planet.type === 'WRONG_PLACE' || planet.isStructure || planet.type === 'STRUCTURE') return false;
        if (!window.LanderScene || !window.LanderSites || !window.LanderCrew) return false;
        return I.GROUND_OF[planet.type] !== 'sky';
    }

    window.LandingWorlds = Object.freeze({ worldOf, findOf, kindOf, canFly });
})();
