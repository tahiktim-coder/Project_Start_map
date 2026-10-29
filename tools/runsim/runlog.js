/* tools/runsim/runlog.js — one run's log (the depth plan's D3: one JSON line per run) and its small helpers: a sector's book,
   the plain words for a world. Part of tools/runsim.js; play.js makes the log, the other parts write into it.
   newLog(style, seed) → the empty log;  sec(rc) → this sector's row;  startSector(rc) → a new row;  worldWords(node) → words
   Fields kept per run: the ending ('light', 'game over', 'locked': a trip card with every way struck, which today's game cannot
   leave; 'stuck'), the sectors, suppers, trips (team, fit, landing, way, shown risk, prize, hurt, died), deaths, injuries,
   stress (peaks, breakdowns with the event they came from), decks, counts, the pairs that went down, minutes by routine.
*/
'use strict';

function newLog(style, seed) {
    return {
        style, seed, ending: null, gameOver: null, secs: 0, minutes: 0, errors: [],
        sectors: [], suppers: [], trips: [], deaths: [], injuries: [], cards: {}, locked: null,
        stress: { peak: {}, reached2: 0, breakdowns: [], sameEvent: 0, up: {}, down: {} },
        decks: { broken: 0, fixed: 0, patched: 0, lived: 0, wanted: 0, dockCrash: 0 },
        counts: { crises: 0, calls: 0, reserveWarps: 0, reserveJumps: 0, stuck: 0, stuckFew: 0, stuckAris: 0, locked: 0, storyMissed: 0, storyMissedFew: 0, storyMissedOther: 0, forced: 0, strange: 0, stations: 0, refused: 0, storyLost: 0, struck: 0, tripsWithTrait: 0 },
        pairs: {}, time: {}, flow: { energy: {}, rations: {}, salvage: {} }, end: null,
    };
}

/** This sector's row of the log (a new one if none yet). */
function sec(rc) { return rc.R.sectors[rc.R.sectors.length - 1] || startSector(rc); }
function startSector(rc) {
    const { state, R, cur } = rc;
    const row = { s: state.currentSector, eIn: Math.round(state.energy), rIn: state.rations, salvIn: state.salvage, extras: 0, skipped: 0, reserve: 0, scrapes: 0, flight: 0, eOut: null, rOut: null, salvOut: null };
    R.sectors.push(row);
    cur.sector = state.currentSector;
    return row;
}
/** Energy, rations and salvage before the jump (or the light), as cardsim's "E before jump" and "R". */
function closeSector(rc) {
    const row = sec(rc), { state } = rc;
    row.eOut = Math.round(state.energy); row.rOut = state.rations; row.salvOut = state.salvage;
}

const KIND_WORDS = { TOXIC: 'a poison world', VITAL: 'a living world', BIO_MASS: 'a world that is alive', VOLCANIC: 'a world of volcanoes', ICE_WORLD: 'an ice world',
    ROCKY: 'a rocky world', DESERT: 'a desert world', OCEANIC: 'an ocean world', MECHA: 'a world of war machines', GRAVEYARD: 'a world of dead ships',
    CRYSTALLINE: 'a crystal world', SHATTERED: 'a broken world', ROGUE: 'a world with no sun', GAS_GIANT: 'a gas giant', FUNGAL: 'a fungus world',
    TERRAFORMED: 'a world someone made', SINGING: 'a singing world', MIRROR: 'a mirror world', HOLLOW: 'a hollow world', GHOST_WORLD: 'a ghost world' };
function worldWords(n) {
    if (!n) return '';
    if (n.isStation) return 'a station';
    if (n.isAsteroidField) return 'a field of rocks';
    if (n.isStoryPlanet) return 'the story world';
    return KIND_WORDS[n.type] || String(n.type || 'a world').toLowerCase().replace(/_/g, ' ');
}

module.exports = { newLog, sec, startSector, closeSector, worldWords };
