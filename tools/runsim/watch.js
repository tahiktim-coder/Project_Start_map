/* tools/runsim/watch.js — watching one run of the game (tools/runsim/play.js): deaths, hurts, stress and breakdowns, broken
   decks, where energy, food and salvage went, the reserve, and which card is up. It wraps the game's own functions and
   reads what they did; it changes no rule.
   catchErrors(game, R);  watch(rc) installs the watchers;  noteDeath(rc, crew);  checkDeaths(rc)
*/
'use strict';
const P = require('./policy');
const { sec, worldWords } = require('./runlog');
const { watchOpeners } = require('./cards');

function watch(rc) {
    const { game, state, app, R, cur } = rc;
    game.hooks.event = ev => {
        const d = (ev && ev.detail) || {};
        if (ev.type === 'crew-death' && d.crew) noteDeath(rc, d.crew);
        else if (ev.type === 'crew-injury' && d.crew) { if (cur.trip && cur.trip.ids.includes(P.idOf(d.crew))) cur.trip.hurt.push(d.crew.name); }
        else if (ev.type === 'game-over') R.gameOver = R.gameOver || d.type || 'GAME_OVER';
        else if (ev.type === 'deck-damaged') R.decks.broken += 1;
    };
    const realBreakdown = state.triggerBreakdown;
    state.triggerBreakdown = function (c) {                                         // ev: the event it came from (rc.beat: a card, an action, a trip's result, a warp ...)
        R.stress.breakdowns.push({ who: c.name, sector: state.currentSector, t: game.clock.now, ev: cur.beat, phase: cur.trip ? 'trip' : cur.phase });
        return realBreakdown.call(this, c);
    };
    watchStock(rc);
    watchOpeners(app, cur);
    const realReserve = app.flyOnReserve;
    app.flyOnReserve = function () { R.counts.reserveWarps += 1; sec(rc).reserve += 1; return realReserve.call(this); };
    const realCampfire = app.showCampfireEvent;
    app.showCampfireEvent = function (done) {                                       // its card is told apart from the others while it is up
        cur.campfire = true;
        return realCampfire.call(this, (...a) => { cur.campfire = false; return done(...a); });
    };
}

/** Anything that throws inside the game goes into this run's log (set first, before the run's state is made). */
function catchErrors(game, R) {
    game.hooks.error = (err, where) => {
        if (R.errors.length >= 30) return;
        const at = err && err.stack ? String(err.stack).split('\n').slice(1, 3).map(l => l.trim()).join(' < ') : '';
        R.errors.push(`${where}: ${err && err.message}${at ? ' @ ' + at : ''}`);
    };
}

/** GameState.emitUpdates, wrapped: where energy, food and salvage came from and went, and each person's stress. */
function watchStock(rc) {
    const { state, R, cur, lastStock, lastStress } = rc;
    const realEmit = state.emitUpdates;
    state.emitUpdates = function () {
        realEmit.call(this);
        const src = cur.src || (cur.trip ? 'trip' : cur.phase);
        ['energy', 'rations', 'salvage'].forEach(k => {
            const v = Math.round(Number(this[k]) || 0), d = v - lastStock[k];
            if (d) R.flow[k][src] = (R.flow[k][src] || 0) + d;
            lastStock[k] = v;
        });
        this.crew.forEach(c => {
            if (c.status === 'DEAD' || P.tagsOf(c).includes('LEADER')) return;
            const v = c.stress || 0, d = v - (lastStress[c.name] || 0);
            if (d) { const book = d > 0 ? R.stress.up : R.stress.down; book[src] = (book[src] || 0) + Math.abs(d); }
            lastStress[c.name] = v;
            R.stress.peak[c.name] = Math.max(R.stress.peak[c.name] || 0, v);
        });
    };
}

function noteDeath(rc, c) {
    const { state, R, cur } = rc;
    if (R.deaths.some(x => x.who === c.name)) return;
    const t = cur.trip;
    R.deaths.push({
        who: c.name, sector: state.currentSector, cause: c._deathCause || 'unknown', world: cur.node ? cur.node.name : null, kind: cur.node ? worldWords(cur.node) : null,
        phase: t ? (t.phase === 'card' ? 'trip' : t.phase === 'site' ? 'site' : 'down') : cur.phase,
        trip: t ? { find: t.find, team: t.team, way: t.wayText, wayKind: t.wayKind, shown: t.shown, death: t.death, oneIn: t.oneIn, deadly: !!t.deadly, goDeath: t.goDeath || 0, goOneIn: t.goOneIn || null, safeOpen: !!t.safeOpen, mark: t.mark, landing: t.landing, struck: t.struck || [], alone: !!t.alone, hurtGoes: !!t.hurtGoes } : null,
        card: cur.lastCard,
    });
    if (t) t.died.push(c.name);
}
function checkDeaths(rc) { rc.state.crew.forEach(c => { if (c.status === 'DEAD' && !P.tagsOf(c).includes('LEADER')) noteDeath(rc, c); }); }

module.exports = { watch, catchErrors, noteDeath, checkDeaths };
