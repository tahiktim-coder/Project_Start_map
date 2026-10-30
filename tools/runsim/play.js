/* tools/runsim/play.js — one whole run of the new look, played by one of the five players, through the game's own handlers:
   App.handleWarp (flown), NSOrbit's bridge actions and team trips (handleEvaAction, applyLanding, whileDown, resolveEvaOutcome,
   tripDone), the site stories, App.handleSectorJump (the corridor, the fault roll, the campfire, the new sector), the supper
   (GameState.serveSupper) and the deck choices (NSOrbit.deckChoose). These are rules runs with scripted choices, not
   playthroughs. The parts: watch.js (what happened), hands.js (the player's hands), stop.js (a stop), voyage.js (between
   stops), runlog.js (the log); the player's choices are policy.js, the minigames and the clock models.js.
   playRun(game, styleName, seed, opts) → the run's log (one JSON line in tools/runsim.js's --log)
*/
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const M = require('./models');
const P = require('./policy');
const { mulberry32, ROOT } = require('./game');
const { newLog, startSector } = require('./runlog');
const { watch, catchErrors, noteDeath } = require('./watch');
const { hands, tripCard } = require('./hands');
const { visit, noteInjuries, DECKS } = require('./stop');
const { travel, nextWorld, jump, goLight } = require('./voyage');
const { offRun } = require('./switches');

// the new look's own files keep a little state between calls (a trip, a call, held crew moments): loaded fresh for every run.
// Orbit.js keeps its fitsOf to itself: one line hands it out (window.__runsimFitsOf) for the trip log's fit; the file is unchanged.
const FITS_ANCHOR = 'window.NSOrbit = Object.freeze({';
const PER_RUN = ['src/newscreen/Route.js', 'src/newscreen/Scan.js', 'src/newscreen/WorldFinds.js', 'src/newscreen/Orbit.js'].map(rel => {
    let src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (rel.endsWith('Orbit.js') && src.includes(FITS_ANCHOR)) src = src.replace(FITS_ANCHOR, "window.__runsimFitsOf = typeof fitsOf === 'function' ? fitsOf : null; " + FITS_ANCHOR);
    return new vm.Script(src, { filename: rel });
});
const MAX_STEPS = 400;

/** A fresh game state and an App without its page (its handlers run for real), for one run. */
function freshGame(game, seed) {
    const { ctx, G } = game;
    game.resetBus();
    game.reseed(seed); game.clearTimers(); game.clock.now = 0; game.setMode('travel');
    PER_RUN.forEach(s => s.runInContext(ctx));
    const GameState = G('GameState'), App = G('App');
    GameState.instance = null;
    const state = GameState.getInstance();
    state.init(); state.logs = [];
    const app = Object.create(App.prototype);
    Object.assign(app, {
        state, _modalQueue: [], _modalActive: false, _isInTransit: false,
        orbitView: { updateCommandDeck() {} }, navView: { handlePlanetSelect() {} },
        renderNav() { this.revealLateStoryPlanet(); }, renderOrbit() {}, autoSave() {}, updateCrewStatusDisplay() {}, screenShake() {}, showCountScene() {},
    });
    ctx.app = app; ctx.NewScreen.app = app;
    return { state, app };
}

/** Everything one run's parts share: the game, the player, the log, where the run is now, and small helpers. */
function runContext(game, styleName, seed, opts, R) {
    const { ctx, G } = game, style = M.STYLES[styleName];
    const rnd = mulberry32((seed * 2654435761) ^ 0x5bd1e995);                       // the player's own dice (the game keeps its own)
    const { state, app } = freshGame(game, seed);
    const rc = {
        game, ctx, G, style, styleName, seed, opts, R, rnd, state, app,
        orbit: ctx.NSOrbit, finds: ctx.NSWorldFinds, route: ctx.NSRoute, EC: ctx.EncounterCard, ECON: G('NEW_LOOK_ECONOMY'), Gen: G('PlanetGenerator'),
        evaRange: { energy: app.evaEnergyRange(), salvage: app.evaSalvageRange(false), salvageHigh: app.evaSalvageRange(true) },   // policy.js rewardValue
        cur: { sector: 1, node: null, trip: null, phase: 'start', src: null, lastCard: null, campfire: false, strange: false, stop: 0, beat: 0, opening: null },
        lastStress: {}, seenEvents: new Set(), lastStock: { energy: 100, rations: 24, salvage: 50 }, injuredAt: {}, run: { supperVictim: null },
    };
    rc.beat = () => { rc.cur.beat += 1; return rc.cur.beat; };                     // a new event: a card picked, an action, a trip, a warp, a jump ...
    rc.add = (secs, what) => { R.secs += secs; const k = what || rc.cur.timeKind || 'other'; R.time[k] = (R.time[k] || 0) + secs; };
    rc.living = () => state.crew.filter(c => c.status !== 'DEAD' && !P.tagsOf(c).includes('LEADER'));
    rc.nameList = ids => ids.map(id => (state.crew.find(c => P.idOf(c) === id) || {}).name || id).join(' and ');
    { const four = rc.living(); rc.run.supperVictim = four[Math.floor(rnd() * four.length)].name; }
    app.showEventModal = (event, planet) => tripCard(rc, event, planet);
    return rc;
}

async function playRun(game, styleName, seed, opts = {}) {
    const R = newLog(styleName, seed);
    catchErrors(game, R);
    const rc = runContext(game, styleName, seed, opts, R);
    const { state, app, cur, orbit } = rc;
    watch(rc);
    hands(rc);
    offRun(rc);
    rc.add(M.SECONDS.opening, 'opening and ending');
    state.sectorNodes = rc.Gen.generateSector(1);
    app.markFirstSignal(); app.plantSectorPage();
    startSector(rc);
    orbit.tick(0, true);                                                              // NSOrbit wraps App.queueModal: crew moments wait for travel
    for (let step = 0; step < MAX_STEPS && !state.gameOver && !R.ending; step++) {
        if (state._inWrongPlace || (state.currentSystem && state.currentSystem._isWrongPlace)) {
            rc.beat(); app.escapeWrongPlace(state); await game.drain(); startSector(rc); continue;   // the copy of Earth: every player fights out
        }
        if (state.currentSector !== cur.sector) startSector(rc);                     // a strange site threw us ahead
        await travel(rc);
        if (state.gameOver) break;
        const node = nextWorld(rc);
        if (node) { await visit(rc, node); continue; }
        if (state.currentSector >= 6) { await goLight(rc); break; }
        await jump(rc);
    }
    finish(rc);
    return R;
}

/** The run's end: how it ended, who died, stress, minutes, and what was left. */
function finish(rc) {
    const { state, R } = rc;
    state.emitUpdates();
    if (!R.ending && !state.gameOver) R.ending = 'stuck';
    if (state.gameOver) R.ending = 'game over';
    state.crew.forEach(c => { if (c.status === 'DEAD' && !R.deaths.some(d => d.who === c.name)) noteDeath(rc, c); });
    noteInjuries(rc);
    R.stress.reached2 = Object.values(R.stress.peak).filter(v => v >= 2).length;
    const evs = R.stress.breakdowns.map(b => b.ev);                                  // a second breakdown from the same event
    R.stress.sameEvent = evs.filter((e, i) => evs.indexOf(e) !== i).length;
    R.minutes = Math.round(R.secs / 6) / 10;
    R.end = { energy: Math.round(state.energy), rations: state.rations, salvage: state.salvage, alive: rc.living().length, pages: (state.exodusLogsFound || []).length,
        decksDown: DECKS.filter(k => state.shipDecks[k].status === 'DAMAGED').length, sector: state.currentSector };
    R.allFour = R.ending === 'light' && R.end.alive === 4;
}

module.exports = { playRun };
