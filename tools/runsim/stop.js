/* tools/runsim/stop.js — one stop of a run (tools/runsim/play.js): the warp in (App.handleWarp, flown), NSOrbit's bridge
   actions in the player's order, the team trips (NSOrbit's 'team' action through the trip card), the broken decks
   (NSOrbit.deckChoose), then leaving.
   visit(rc, node);  repairs(rc);  noteInjuries(rc)
*/
'use strict';
const M = require('./models');
const P = require('./policy');
const { sec, worldWords } = require('./runlog');
const { checkDeaths } = require('./watch');

const DECKS = ['bridge', 'lab', 'quarters', 'cargo', 'engineering'];
const TICK_MS = 250, TRIP_TICKS = 400, MAX_ACTS = 24;
const BRIDGE_ORDER = ['skim', 'dock', 'mine', 'scan', 'date', 'call'];

/** A stop: the warp, the bridge's actions in the player's order, the trips, then the decks, then leave. */
async function visit(rc, node) {
    const { game, app, state, R, cur, orbit, route } = rc;
    cur.node = node; cur.phase = 'warp'; cur.stop += 1;
    rc.add(M.SECONDS.pickWorld + M.SECONDS.flight, 'travel');
    const wasStory = app.isStoryStop(node);
    rc.beat();
    try { app.handleWarp(node, { flown: true }); } catch (err) { game.hooks.error(err, 'handleWarp'); }
    state.emitUpdates(); checkDeaths(rc);                                          // the warp's own hazards, counted as the warp's
    if (state.currentSystem !== node) { node.nsRoute.status = 'gone'; R.counts.refused += 1; return; }
    route.arrive(state, node.id);
    if (!wasStory) sec(rc).extras += 1;
    await game.drain();
    game.setMode('stop'); cur.phase = 'stop';
    try { orbit.opened(app); } catch (err) { game.hooks.error(err, 'opened'); }
    rc.add(M.SECONDS.arriveHold, 'bridge');
    noteInjuries(rc);
    await atStop(rc, node);
    if (state.gameOver || state._inWrongPlace || R.ending) return;                 // R.ending: a locked trip card
    const site = app.siteOf(node);
    if (wasStory && site && site.tag === 'EXODUS_WRECK' && !node[site.done]) { R.counts.storyMissed += 1; R.counts[orbit.eligible(app).length < 2 ? 'storyMissedFew' : 'storyMissedOther'] += 1; }
    await repairs(rc);
    try { await orbit.beforeLeave(app); } catch (err) { game.hooks.error(err, 'beforeLeave'); }
    await game.drain();
    if (state.currentSystem && !(state.currentSystem.isStructure || state.currentSystem.type === 'STRUCTURE')) state.currentSystem = null;   // req-break-orbit
    game.setMode('travel'); cur.phase = 'travel';
    rc.add(M.SECONDS.leave, 'bridge');
}

/** In orbit: every bridge action the player takes, then a trip to each find it wants, then the strange site if it flies closer. */
async function atStop(rc, node) {
    const { app, state, style, R, cur, orbit, finds, G } = rc;
    const declined = new Set();
    let stuckHere = false;
    for (let k = 0; k < MAX_ACTS && !state.gameOver && !R.ending && state.currentSystem === node; k++) {
        const acts = orbit.actions(app), has = key => acts.find(a => a.key === key);
        const did = BRIDGE_ORDER.find(has);
        if (did) { await act(rc, did); continue; }
        const open = finds.known(node) ? finds.list(app, node, (orbit.propose(app) || {}).ids).filter(f => !f.done && !declined.has(f.id)) : [];
        const eventTrips = (node.nsDone || []).filter(id => id !== 'site').length;
        const want = open.find(f => P.wantsFind(f, style, { eventOf: id => (G('EVENTS') || []).find(e => e.id === id), evaRange: rc.evaRange, eventTrips, tripsHere: node.nsTrips || 0 }));
        if (want && has('team')) { if (!(await trip(rc, node, want))) declined.add(want.id); continue; }
        if (want) {                                                              // a find wanted, but fewer than two can go (or Aris will not)
            if (!stuckHere) { stuckHere = true; R.counts.stuck += 1; R.counts[orbit.eligible(app).length < 2 ? 'stuckFew' : 'stuckAris'] += 1; }
            declined.add(want.id); continue;
        }
        open.forEach(f => declined.add(f.id));
        if (has('strange') && style.strange) { cur.strange = true; R.counts.strange += 1; await act(rc, 'strange'); cur.strange = false; continue; }
        break;
    }
}

async function act(rc, key) {
    const { game, app, state, R, cur, orbit } = rc;
    rc.add({ skim: M.SECONDS.skim, scan: M.CUTS.autoScan ? 0 : M.SECONDS.scan, date: 0, call: 0, dock: 0, mine: 0, strange: 0 }[key] || 0, 'bridge');
    if (key === 'call') R.counts.calls += 1;
    cur.src = 'act:' + key;
    rc.beat();
    try { orbit.act(app, key); } catch (err) { game.hooks.error(err, 'act:' + key); }
    state.emitUpdates();
    cur.src = null;
    await game.drain();
}

/** One team trip to a find: the pair, the hatch, the drop and the card (its ticks run until NSOrbit says the trip is over). */
async function trip(rc, node, find) {
    const { game, app, state, style, rnd, R, cur, orbit, finds } = rc;
    finds.aim(app, node, find.id);
    const ids = P.pickTeam(find, style, { orbit, app, rnd, finds, node });
    if (!ids) { R.counts.stuck += 1; return false; }
    const mark = (finds.list(app, node, ids).find(f => f.id === find.id) || {}).risk;
    const again = (node.nsTrips || 0) > 0;
    rc.add(M.SECONDS.teamPick + (again ? (M.CUTS.repeatTrip ? M.SECONDS.secondTripCut : M.SECONDS.secondTrip) + (M.CUTS.bridgeHold ? M.SECONDS.bridgeAgainCut : M.SECONDS.bridgeAgain) : 0), 'hatch');
    const traitOn = ['PARANOID', 'RECKLESS', 'BLEEDING_HEART', 'OBSESSED'].some(t => state.hasActiveTrait(t));
    cur.trip = { sector: state.currentSector, world: node.name, kind: worldWords(node), find: find.label, findKind: find.kind, site: find.site || null,
        ids: ids.slice(), team: rc.nameList(ids), fit: fitOf(rc, node, ids), mark: typeof mark === 'number' ? mark : null, landing: null, phase: 'hatch',
        shown: null, wayText: null, wayKind: null, prize: null, hurt: [], died: [], traitOn };
    if (traitOn) R.counts.tripsWithTrait += 1;
    const pair = ids.slice().sort().join('+');
    R.pairs[pair] = (R.pairs[pair] || 0) + 1;
    let ok = false;
    rc.beat();
    try { ok = orbit.act(app, 'team', ids); } catch (err) { game.hooks.error(err, 'team'); }
    if (!ok) { R.counts.refused += 1; cur.trip = null; return false; }
    if (find.kind === 'site') cur.trip.phase = 'site';
    await game.drain();
    for (let k = 0; k < TRIP_TICKS && orbit.trip() && !R.ending; k++) { game.advance(TICK_MS); orbit.tick(TICK_MS, false); await game.drain(); }
    if (node._nsCrisis && node._nsCrisis.done && !node._nsCrisisCounted) { node._nsCrisisCounted = true; R.counts.crises += 1; }   // its card counts its seconds
    rc.add(M.SECONDS.tripBack, 'hatch');
    checkDeaths(rc);
    R.trips.push(cur.trip);
    cur.trip = null;
    return true;
}

/** The pair's fit for this find (NSOrbit's fitsOf, the scores its proposal adds up): { total, by: { id: score } }, or null. */
function fitOf(rc, node, ids) {
    const fits = typeof rc.ctx.__runsimFitsOf === 'function' ? rc.ctx.__runsimFitsOf(rc.app, node) : null;
    if (!fits) return null;
    const by = Object.fromEntries(ids.map(id => [id, (fits[id] && fits[id].score) || 0]));
    return { total: Object.values(by).reduce((a, b) => a + b, 0), by };
}

/** Each broken deck: fix, patch or live with it (NSOrbit.deckChoose), as the player's style says. */
async function repairs(rc) {
    const { game, app, state, style, R, cur, orbit } = rc;
    for (const key of DECKS) {
        const d = state.shipDecks[key];
        if (!d || d.status !== 'DAMAGED' || state.gameOver) continue;
        const choices = orbit.deckChoices(state, key);
        if (!choices.length) continue;
        const plan = P.deckPlan(choices, state, state.repairCostOf(key), style);
        if (plan.wanted && !d._rsWanted) { d._rsWanted = true; R.decks.wanted += 1; }
        if (!(plan.key === 'live' && d._rsLived)) rc.add(M.SECONDS.deckChoice, 'decks');   // living with it is decided once a break
        d._rsLived = plan.key === 'live';
        cur.src = 'repairs';
        rc.beat();
        const done = orbit.deckChoose(app, key, plan.key);
        state.emitUpdates();
        cur.src = null;
        R.decks[plan.key === 'fix' ? 'fixed' : plan.key === 'patch' ? 'patched' : 'lived'] += done ? 1 : 0;
        if (plan.key === 'fix' && done) delete d._rsWanted;
        await game.drain();
    }
}

/** Hurt crew, counted in stops: an injury's length is the stops it lasted. */
function noteInjuries(rc) {
    const { state, R, cur, injuredAt } = rc;
    state.crew.forEach(c => {
        if (c.status === 'INJURED') injuredAt[c.name] = injuredAt[c.name] == null ? cur.stop : injuredAt[c.name];
        else if (injuredAt[c.name] != null) { R.injuries.push({ who: c.name, stops: cur.stop - injuredAt[c.name] }); delete injuredAt[c.name]; }
    });
}

module.exports = { visit, repairs, noteInjuries, DECKS };
