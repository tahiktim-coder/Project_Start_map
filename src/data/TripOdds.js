/* ═══ Silent Exodus · data/TripOdds.js: the odds of a team trip, one copy for the game and the run model ═══════════════════
   What it is: the new look's (?new=1) rule for how likely a team trip hurts someone and how likely it kills, and who suits
   which world (the fit tables). Pure code: no page, no DOM, no dice. The game (App.wayOdds and App.tripChoices in bundle.js,
   NSOrbit's fit and proposal, NSWorldFinds' marks) and the node run model (tools/runsim) call this one file. Every number is
   in NEW_LOOK_ECONOMY (bundle.js), read when used: this file loads before bundle.js (index.html, after Events.js).
   The default game never calls it: its trips keep their own rule (resolveEvaOutcome).

   window.TripOdds (frozen)
     odds({ base, wayMod, fit, hunted, vance, hurtGoes }) → { hurt, death, deadly, oneIn, share, vance }
         base: App.tripRisk's risk going in; wayMod: the way's riskMod (Events.js); fit: the team's fit points for this find
         (NSOrbit.fitOf); hunted: something hunts there (a plain landing on a world tagged PREDATORY); vance: Vance is down,
         well, with a partner (he takes a hit meant for them, so only a hit on him can kill: half the deaths); hurtGoes:
         someone hurt went down (fewer than two were well)
         hurt  = base + wayMod - min(FIT_MAX, FIT_PER_POINT x fit) (+ HURT_GOES_RISK), held to 0..HURT_MAX (%)
         share = 0 under DEATH_FLOOR, else DEATH_SHARE (DEATH_SHARE_HUNTED where something hunts) + 1 a point of hurt past
                 DEATH_PAST (%)
         death = hurt x share / 100 (x VANCE_DEATH_SHARE with Vance) (%);  deadly: death > 0;  oneIn: 100 / death, rounded (null: no death)
     afterLanding(shown, landed) → { hurt, death, deadly, oneIn, kill }
         shown: odds() as GO DOWN showed them (before the landing); landed: odds() after it (how it was flown, who scanned).
         The hurt chance is the landed one; the death chance the lower of the two: a landing can lower it, never raise it.
         kill: the share of hits that kill, on whoever Vance does not cover (resolveEvaOutcome rolls it)
     FIT: { SITE, TYPE, TAG, DANGER, FEATURE, ROLE_WHY }   [crew id, points, why] by site, world type, tag, ground and feature
*/
(function () {
    'use strict';
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    /** A number from NEW_LOOK_ECONOMY, read when used. Missing (a renamed key), it is logged and counts as 0: never a second
        copy of the table's number here. */
    function num(key) {
        const E = typeof window !== 'undefined' ? window.NEW_LOOK_ECONOMY : null, v = E && E[key];
        if (typeof v === 'number') return v;
        console.error(`TripOdds: NEW_LOOK_ECONOMY.${key} is missing`);
        return 0;
    }

    /** The share of hits that kill at this hurt chance (%): none under the floor; more where something hunts and past 40. */
    function shareAt(hurt, hunted) {
        if (hurt < num('DEATH_FLOOR')) return 0;
        return (hunted ? num('DEATH_SHARE_HUNTED') : num('DEATH_SHARE')) + Math.max(0, hurt - num('DEATH_PAST'));
    }
    const oneInOf = death => (death > 0 ? Math.max(1, Math.round(100 / death)) : null);

    function odds(o) {
        const p = o || {};
        const fitCut = Math.min(num('FIT_MAX'), num('FIT_PER_POINT') * Math.max(0, Number(p.fit) || 0));
        const hurt = Math.round(clamp((Number(p.base) || 0) + (Number(p.wayMod) || 0) - fitCut + (p.hurtGoes ? num('HURT_GOES_RISK') : 0), 0, num('HURT_MAX')));
        const share = Math.min(100, shareAt(hurt, !!p.hunted));
        const death = hurt * share / 100 * (p.vance ? num('VANCE_DEATH_SHARE') : 1);
        return { hurt, death, deadly: death > 0, oneIn: oneInOf(death), share, vance: !!p.vance };
    }

    function afterLanding(shown, landed) {
        const s = shown || landed, l = landed || shown;
        if (!l) return { hurt: 0, death: 0, deadly: false, oneIn: null, kill: 0 };
        const death = Math.min(s.death, l.death);
        const hitsThatCanKill = l.hurt * (l.vance ? num('VANCE_DEATH_SHARE') : 1);
        const kill = hitsThatCanKill > 0 ? clamp(death / hitsThatCanKill, 0, 1) : 0;
        return { hurt: l.hurt, death, deadly: death > 0, oneIn: oneInOf(death), kill };
    }

    // ── who suits which world (moved here from NSOrbit, 2026-10-30, so the run model reads the same tables) ──
    // Each fit: [crew id, points, why] (why: a few plain words the bridge shows over them). NSOrbit.fitsOf takes each person's
    // best fit for the find the team goes to; NSOrbit.fitOf adds the two who go down (TripOdds.odds' fit).
    const ROLE_WHY = { jaxon: 'flies the lander', vance: 'keeps them safe', aris: 'treats the hurt', mira: 'reads the ground' };
    const SITE = {
        EXODUS_WRECK: [['jaxon', 3, 'wreck work']], DERELICT: [['jaxon', 3, 'wreck work']],
        LIGHTHOUSE: [['mira', 2, 'an old beacon down there'], ['jaxon', 1, 'salvage down there']],
        GARDEN: [['mira', 2, 'a garden under glass']], GRAVE: [['aris', 3, 'graves down there']],
        FAILED_COLONY: [['jaxon', 2, 'old machines down there'], ['aris', 1, 'an empty colony']],
    };
    const TYPE = {
        TOXIC: [['aris', 2, 'sick air down there']], SULFUR: [['aris', 2, 'sick air down there']], CARBON: [['aris', 1, 'sick air down there']],
        FUNGAL: [['aris', 2, 'spores down there']], BIO_MASS: [['aris', 2, 'sickness down there'], ['vance', 1, 'living things down there']],
        VITAL: [['aris', 1, 'sickness down there']], SYMBIOTE_WORLD: [['aris', 1, 'sickness down there']],
        MECHA: [['jaxon', 2, 'old machines down there']], MACHINE_WORLD: [['jaxon', 2, 'old machines down there']],
        GRAVEYARD: [['jaxon', 2, 'dead ships down there']], TOMB_WORLD: [['mira', 2, 'old ruins down there']],
        SINGING: [['mira', 2, 'the signal down there']], CRYSTALLINE: [['mira', 1, 'reads the ground']], MIRROR: [['mira', 1, 'reads the ground']],
        HOLLOW: [['mira', 1, 'reads the ground']], GHOST_WORLD: [['mira', 1, 'reads the ground']],
    };
    const TAG = {
        PREDATORY: [['vance', 4, 'something hunts down there'], ['aris', 1, 'someone may get hurt']],
        ALIEN_SIGNALS: [['mira', 2, 'an old signal down there']], ANCIENT_RUINS: [['mira', 2, 'old ruins down there']],
    };
    const DANGER = { 'dangerous ground': [['vance', 2, 'dangerous ground'], ['aris', 1, 'someone may get hurt']], 'rough ground': [['vance', 1, 'rough ground']] };
    const FEATURE = { ruins: TAG.ANCIENT_RUINS, signal: TAG.ALIEN_SIGNALS, life: [['aris', 1, 'sickness down there'], ['vance', 1, 'living things down there']],
        machines: [['jaxon', 2, 'old machines down there']] };
    const FIT = Object.freeze({ SITE, TYPE, TAG, DANGER, FEATURE, ROLE_WHY });

    window.TripOdds = Object.freeze({ odds, afterLanding, FIT });
})();
