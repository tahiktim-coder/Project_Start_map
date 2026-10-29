/* tools/runsim/switches.js — rules cardsim.js (scratchpad tension/cardsim.js, model-final2.txt) left out, each one turned off
   on its own (--off flight,faults,...) to explain where this model's energy and rations part from cardsim's tables (the
   depth plan's D1 step 0). Only for that check: no switch is ever on in a measurement of the game.
   SWITCHES: { name: what it turns off };  offGame(game, off) once per process;  offRun(rc) once per run;  flightOff(rc)
*/
'use strict';

const SWITCHES = Object.freeze({
    flight: 'the flown jump: no energy saved or lost, no scrape (cardsim had no flight)',
    faults: 'no fault rolled after a jump (rollShipMalfunction)',
    obsessed: "Mira's OBSESSED: no ration a trip and no bonus (hasActiveTrait says no)",
    hazards: "no sector hazard on a warp (SECTOR_CONFIG's hazard.onWarp)",
    decks: 'no deck ever breaks (GameState.damageDeck does nothing): no deck prices, no patch breaking again',
});

/** Checks the names; returns a Set. */
function parseOff(list) {
    const names = String(list || '').split(',').map(s => s.trim()).filter(Boolean);
    const bad = names.filter(n => !SWITCHES[n]);
    if (bad.length) throw new Error(`unknown --off: ${bad.join(', ')} (known: ${Object.keys(SWITCHES).join(', ')})`);
    return new Set(names);
}

/** The switches that change the game's shared files (one process plays one set of switches). */
function offGame(game, off) {
    if (off.has('faults')) game.ctx.rollShipMalfunction = () => null;
    if (off.has('hazards')) {
        const config = game.G('SECTOR_CONFIG') || {};
        Object.values(config).forEach(s => { if (s && s.hazard && s.hazard.onWarp) s.hazard.onWarp = () => {}; });
    }
}

/** The switches on one run's own state. */
function offRun(rc) {
    const off = rc.opts.off, state = rc.state;
    if (!off || !off.size) return;
    if (off.has('obsessed')) { const real = state.hasActiveTrait; state.hasActiveTrait = function (t) { return t === 'OBSESSED' ? false : real.call(this, t); }; }
    if (off.has('decks')) {                                                      // the data files also break decks directly (deck.status = 'DAMAGED')
        state.damageDeck = () => null;
        const realEmit = state.emitUpdates;
        state.emitUpdates = function () {
            Object.values(this.shipDecks).forEach(d => { if (d.status === 'DAMAGED') d.status = 'OPERATIONAL'; });
            return realEmit.call(this);
        };
    }
}

const flightOff = rc => !!(rc.opts.off && rc.opts.off.has('flight'));

module.exports = { SWITCHES, parseOff, offGame, offRun, flightOff };
