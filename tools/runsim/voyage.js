/* tools/runsim/voyage.js — between the stops of a run (tools/runsim/play.js): travel, the next world on the route (NSRoute
   and the player's pick), the jump (App.handleSectorJump: the corridor, the fault roll, the new sector), the supper after
   it, the stand-ins at the start of sector 5, and the light at the end.
   travel(rc);  nextWorld(rc) → node | null;  jump(rc);  goLight(rc)
*/
'use strict';
const M = require('./models');
const P = require('./policy');
const { sec, startSector, closeSector } = require('./runlog');
const { repairs } = require('./stop');
const { serveSupper } = require('./hands');

/** Travel: a held crew moment opens once it is calm (NSOrbit's own rule), the faint contact may be named, the next world. */
async function travel(rc) {
    const { game, app, orbit } = rc;
    game.setMode('travel');
    rc.beat();
    game.advance(3000); orbit.tick(16, false); await game.drain();
    app.revealLateStoryPlanet();
}

/** The world this player flies to next, or null (go to the jump, or the light). */
function nextWorld(rc) {
    const { state, app, style, rnd, R, route, ECON } = rc;
    const p = route.plan(state);
    const ahead = p.worlds.filter(w => w.status === 'ahead' && w.band > p.at && w.slot !== 'light' && w.slot !== 'eden' && !w.node.ghost);
    const skips = n => ahead.filter(w => !w.node.storyHidden && w.band < n.nsRoute.band).length;
    const n = P.pickWorld(ahead, style, { state, app, econ: ECON, rnd });
    if (n) { sec(rc).skipped += skips(n); return n; }
    const hidden = ahead.find(w => w.node.storyHidden), rest = ahead.filter(w => !w.node.storyHidden).map(w => w.node).filter(x => state.getWarpCost(x) <= state.energy);
    if (hidden && rest.length) { R.counts.forced += 1; const f = rest.sort((a, b) => state.getWarpCost(a) - state.getWarpCost(b))[0]; sec(rc).skipped += skips(f); return f; }   // the contact is named only once nothing else is left
    if (hidden) R.counts.storyLost += 1;
    sec(rc).skipped += ahead.filter(w => !w.node.storyHidden).length;                // left behind at the jump
    return null;
}

/** The jump to the next sector, the supper after it, and the stand-ins. */
async function jump(rc) {
    const { game, app, state, R, cur } = rc;
    await repairs(rc);
    closeSector(rc);
    const from = state.currentSector;
    cur.phase = 'jump';
    rc.add(M.SECONDS.jumpBurn, 'jump flight');
    rc.beat();
    try { app.handleSectorJump(); } catch (err) { game.hooks.error(err, 'handleSectorJump'); }
    await game.drain();
    if (state.gameOver) return;
    if (state.currentSector === from) { R.counts.stuck += 1; R.errors.push('the jump did not happen'); R.ending = 'stuck'; return; }
    startSector(rc);
    cur.phase = 'supper';
    serveSupper(rc);
    await standIns(rc);
    await game.drain();
    cur.phase = 'travel';
}

/** At the start of sector 5: the dark leg (--void), when asked for. (Last Port is in the game now: the relay's dock on the
    story trip to the disc's wreck, hands.js relayDock.) */
function standIns(rc) {
    const { state, styleName, opts } = rc;
    if (state.currentSector !== 5) return Promise.resolve();
    if (opts.void) {                                                             // the dark leg (agreed 2026-10-29): wait it out, or push through
        rc.beat();
        const eaters = state.crew.filter(c => c.status !== 'DEAD').length;       // 1 ration a living person, the commander too (as GameState.supperNeed counts)
        if (['careful', 'aura', 'optimizer'].includes(styleName)) state.rations = Math.max(0, state.rations - eaters);
        else state.damageDeck('cargo', 'The dark broke the hold.');
        state.emitUpdates();
    }
    return Promise.resolve();
}

/** The light at the end of sector 6. */
async function goLight(rc) {
    const { game, app, state, R, route } = rc;
    const structure = route.find(state, 'light');
    closeSector(rc);
    if (!structure) { R.ending = 'no light'; return; }
    rc.add(M.SECONDS.pickWorld + M.SECONDS.flight + M.SECONDS.ending, 'opening and ending');
    rc.beat();
    try { app.handleWarp(structure, { flown: true }); } catch (err) { game.hooks.error(err, 'handleWarp light'); }
    await game.drain();
    R.ending = state.currentSystem === structure ? 'light' : 'no light';
}

module.exports = { travel, nextWorld, jump, goLight };
