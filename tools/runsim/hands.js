/* tools/runsim/hands.js — the player's hands in one run (tools/runsim/play.js): every card's choice, the minigames' results,
   the landing, the trip card (App.showEventModal's rules without its page), the station walk (BoardingParty's own headless
   rules) and the supper. The choices come from tools/runsim/policy.js, the results and seconds from tools/runsim/models.js.
   hands(rc) installs the game's hooks;  tripCard(rc, event, planet);  board(rc, station);  serveSupper(rc)
*/
'use strict';
const M = require('./models');
const P = require('./policy');
const { sec } = require('./runlog');
const { checkDeaths } = require('./watch');
const { cardKind } = require('./cards');
const { flightOff } = require('./switches');

const CARD_SECONDS = { askJump: 'askJump', reserve: 'reserveCard', alert: 'jumpFault', moment: 'moment', call: 'call', station: 'stationCard', mine: 'mine', wreck: 'wreck', page: 'page', campfire: 'campfire', site: 'site', strange: 'strange' };

function hands(rc) {
    const { game } = rc;
    game.hooks.card = (a, cfg) => pickOnCard(rc, cfg);
    game.hooks.mini = (name, o) => minigame(rc, name, o);
    game.hooks.land = (a, planet, team, o) => land(rc, planet, o);
    game.hooks.board = (a, station) => board(rc, station);
    game.hooks.supper = () => serveSupper(rc);
}

/** EncounterCard.open: the player reads the card and clicks one choice (a moment later, as on screen). */
function pickOnCard(rc, cfg) {
    const { ctx, game, state, style, rnd, R, cur, EC } = rc;
    const kind = cardKind(cfg, cur, game.hooks.error);
    R.cards[kind] = (R.cards[kind] || 0) + 1;
    let idx;
    if (kind === 'askJump') idx = Math.min(1, (cfg.choices || []).length - 1);          // "Go anyway" (askBeforeJump jumps on idx 1): the player clicked the jump on purpose
    else if (kind === 'reserve') { idx = 0; R.counts.reserveJumps += 1; sec(rc).reserve += 1; }
    else if (kind === 'alert' || kind === 'escape' || kind === 'page') idx = 0;
    else idx = P.pickCard(cfg, state, style, rnd, EC.descOf);
    rc.add(M.SECONDS[CARD_SECONDS[kind] || 'site'] || 20, 'card:' + kind);
    if (idx < 0) return;
    const choice = (cfg.choices || [])[idx];
    cur.lastCard = { kind, title: String(cfg.title || ''), choice: choice ? String(choice.text || '').replace(/<[^>]*>/g, '') : '' };
    ctx.setTimeout(() => {
        rc.beat();
        cur.src = 'card:' + kind;
        const was = cur.phase;
        cur.phase = cur.trip ? cur.phase : 'card';
        try { cfg.onPick(idx); } catch (err) { game.hooks.error(err, 'card:' + kind); }
        state.emitUpdates(); checkDeaths(rc);
        cur.phase = was; cur.src = null;
    }, 0);
}

/** MiniHost.play: a minigame's result for this player's pilot (models.js), and its seconds. */
function minigame(rc, name, o) {
    const { style, rnd, cur } = rc;
    if (name === 'corridor') {
        rc.add(M.SECONDS.corridor[style.pilot] || 45, 'jump flight');
        const r = flightOff(rc) ? { scrapes: 0, energyDelta: 0, auraFlew: style.pilot === 'aura', damagedRooms: [], hulls: [] } : M.corridorResult(style.pilot, rnd);
        sec(rc).scrapes += r.scrapes; sec(rc).flight += r.energyDelta;
        return r;
    }
    if (name === 'burn') { rc.add(M.SECONDS.burnGauge + M.SECONDS.throwSequence, 'the throw'); return M.burnResult(style.pilot, rnd); }
    if (name === 'breach') { rc.add(M.SECONDS.breach, 'breach'); cur.phase = 'breach'; return M.breachResult(style.pilot, rnd, o); }
    if (name === 'torch') { rc.add(M.SECONDS.torch, 'wreck door'); return { opened: true, door: (o && o.door) || 'cut', bySelf: false }; }
    if (name === 'disc') { rc.add(M.SECONDS.dating, 'dating'); return { dated: true, hull: o && o.wreck ? o.wreck.hull : 1, age: 100, ly: 12 }; }
    return null;
}

/** LanderGame.play: the drop, flown by the player or by A.U.R.A. */
function land(rc, planet, o) {
    const { style, rnd, cur } = rc;
    rc.add(style.pilot === 'aura' ? M.SECONDS.landingAura : M.SECONDS.landingFull, 'landing');
    rc.add(M.CUTS.walkOut ? rc.ECON.WALK_OUT_MS / 1000 : M.SECONDS.walkOut, 'walk-out');   // C4: the game's own number
    const r = M.landingResult(style.pilot, rnd, o.unmarked, planet);
    if (cur.trip) { cur.trip.landing = r.grade; cur.trip.phase = 'down'; }
    return r;
}

/** App.showEventModal's rules without its page: the risk going in (App.tripRisk), the traits that strike a way, the pick.
    Vance's PARANOID strikes every way at 30+ and Mira's RECKLESS (half the time) the 0 way; on a card with only such ways
    both strike every button, and the game gives no other way off the card (bundle.js showEventModal: only enabled buttons
    get a click): the run is locked there. --unlock (opts.unlock) keeps the careful way open instead, a stand-in for the
    depth plan's step 4 ("never lock"), so later rules can be measured past it; the lock is counted either way. */
function tripCard(rc, event, planet) {
    const { ctx, app, state, style, rnd, R, cur } = rc;
    const goingIn = app.tripRisk(planet, { landing: app._landingRiskMod, mira: app._nsScanMod });
    app._landingRiskMod = 0; app._nsScanMod = 0;
    const riskBase = goingIn.risk;
    const isParanoid = state.hasActiveTrait('PARANOID'), isReckless = state.hasActiveTrait('RECKLESS');
    const recklessBlocksSafe = isReckless && ctx.Math.random() > 0.5;
    const all = event.choices.map((c, i) => ({ c, i, struck: (isParanoid && c.riskMod >= 30) || (recklessBlocksSafe && c.riskMod === 0) }));
    let open = all.filter(o => !o.struck);
    const struck = all.some(o => o.struck) ? [isParanoid ? 'PARANOID' : null, recklessBlocksSafe ? 'RECKLESS' : null].filter(Boolean) : [];
    if (struck.length) R.counts.struck += 1;
    rc.add(M.CUTS.resultCard && rc.seenEvents.has(event.id) ? M.SECONDS.resultCard : M.SECONDS.tripCard, 'trip card');
    rc.seenEvents.add(event.id);
    if (!open.length) {
        R.counts.locked += 1;
        if (!R.locked) R.locked = { sector: state.currentSector, world: cur.node ? cur.node.name : null, event: event.id, title: String(event.title || ''), team: cur.trip ? cur.trip.team : null, struck, unlocked: !!rc.opts.unlock };
        if (!rc.opts.unlock) {
            if (cur.trip) Object.assign(cur.trip, { phase: 'card', event: event.id, struck, locked: true, riskBase });
            R.ending = 'locked';
            return;
        }
        open = [all.slice().sort((a, b) => (a.c.riskMod || 0) - (b.c.riskMod || 0) || a.i - b.i)[0]];
    }
    const idx = P.pickWay(open, style, riskBase, rc.evaRange, rnd), choice = event.choices[idx];
    const byRisk = event.choices.map(c => c.riskMod || 0), lo = Math.min(...byRisk), hi = Math.max(...byRisk);
    if (cur.trip) Object.assign(cur.trip, { phase: 'card', event: event.id, struck, wayText: String(choice.text || ''), wayKind: hi === lo ? 'only' : choice.riskMod === lo ? 'careful' : choice.riskMod === hi ? 'bold' : 'middle',
        shown: Math.max(0, Math.min(100, Math.round(riskBase + choice.riskMod))), riskBase });
    resolveWay(rc, choice, riskBase);
}
/** resolveEvaOutcome, and what it paid (the prize as the game gave it, after the caps). */
function resolveWay(rc, choice, riskBase) {
    const { game, app, state, cur } = rc;
    const before = stock(state);
    rc.beat();
    try { app.resolveEvaOutcome(choice, riskBase); } catch (err) { game.hooks.error(err, 'resolveEvaOutcome'); }
    const after = stock(state);
    if (cur.trip) cur.trip.prize = Object.fromEntries(Object.keys(after).map(k => [k, after[k] - before[k]]).filter(([, v]) => v));
}
const stock = s => ({ energy: Math.round(Number(s.energy) || 0), salvage: s.salvage || 0, rations: s.rations || 0, data: s._colonyKnowledge || 0, items: (s.cargo || []).length });

/** BoardingParty's own rules, headless (its internals): the dock, one boarder, A.U.R.A.'s guide or the best plan, the haul. */
function board(rc, station) {
    const { ctx, state, style, rnd, R, cur } = rc;
    R.counts.stations += 1;
    rc.add(M.SECONDS.station, 'station walk');
    rc.beat();
    const I = ctx.BoardingParty.internals, member = P.pickBoarder(state, style, rnd);
    if (!I || !member) return { reachedCommand: false, member: null };
    const grade = M.dockingGrade(style.pilot, rnd, station);
    if (grade === 'crash') {                                                     // DockingGame end(): a hard docking breaks a deck
        R.decks.dockCrash += 1;
        const was = cur.src;
        cur.src = 'docking';
        state.damageRandomDeck();
        state.emitUpdates();
        cur.src = was;
        if (state.gameOver) return { reachedCommand: false, member: null };
    }
    const role = ['LEADER', 'ENGINEER', 'MEDIC', 'SECURITY', 'SPECIALIST'].find(t => P.tagsOf(member).includes(t)) || null;
    const L = I.buildStation({ seed: station.id, sector: state.currentSector || 1, age: ctx.BoardingParty.ageOf(station, state.currentSector) });
    const air = I.TANK + (role === 'MEDIC' ? 2 : 0) - (I.DOCK_AIR_LOSS[grade] || 0);                // BoardingParty: MEDIC_EXTRA_AIR 2
    let b = I.newRun(L, { role, air });
    const best = style.worlds === 'payoff' ? I.bestPlan(L, b) : null;            // the optimizer plans the whole walk; everyone else follows A.U.R.A.'s guide
    const plan = best ? (LL, bb) => best(bb) : (LL, bb) => I.auraAction(LL, bb);
    for (let k = 0; k < 200; k++) {
        const act = plan(L, b);
        if (!act || act.kind === 'leave') break;
        b = I.apply(L, b, act, rnd).next;
    }
    boardingHaul(rc, station, member, b);
    return { reachedCommand: !!b.reachedCommand, member };
}
/** BoardingParty.applyResult, as written there (it is not exported), for a walk that got home. */
function boardingHaul(rc, station, member, b) {
    const { ctx, G, state } = rc;
    const sum = kind => b.haul.filter(f => f.kind === kind).reduce((n, f) => n + (f.amount || 0), 0);
    state.salvage = Math.min(state.maxSalvage, state.salvage + sum('salvage'));
    state.energy = Math.min(100, state.energy + sum('energy'));
    const items = G('ITEMS') || {};
    b.haul.forEach(f => {
        if (f.kind === 'medkit' && items.MEDKIT) state.cargo.push(Object.assign({}, items.MEDKIT, { acquiredAt: station.name }));
        if (f.kind === 'tech' && items.TECH_FRAGMENT) state.cargo.push(Object.assign({}, items.TECH_FRAGMENT, { acquiredAt: station.name }));
    });
    const data = sum('data'), pods = b.haul.filter(f => f.kind === 'pod').length, notes = b.haul.filter(f => f.kind === 'diary').length;
    if (data) state.addColonyKnowledge(data);
    if (pods) state._sleepers = (state._sleepers || 0) + pods;
    if (b.isRecorded) { const aris = state.crew.find(c => P.tagsOf(c).includes('MEDIC') && c.status !== 'DEAD'); if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1); }
    if (P.tagsOf(member).includes('LEADER')) state.crew.forEach(m => { if (m.status !== 'DEAD' && m.stress > 0) m.stress -= 1; });
    if (b.isHurt) { member.status = 'INJURED'; ctx.dispatchEvent(new ctx.CustomEvent('crew-injury', { detail: { crew: member } })); }
    member.stress = Math.max(0, Math.min(3, (member.stress || 0) + (b.isHurt ? 1 : 0) - notes));
    state.emitUpdates();
}

/** NSSupper.settle: the supper due after a jump; when short, the player picks who goes without. */
function serveSupper(rc) {
    const { state, style, R, run } = rc;
    if (!state._nsSupper || state.gameOver) return;
    const need = state.supperNeed(), food = state.rations, short = food < need;
    const without = short ? P.pickWithout(state, style, run) : null;
    rc.add(short ? M.SECONDS.supperShort : M.SECONDS.supper, 'supper');
    rc.beat();
    state.serveSupper(without);
    R.suppers.push({ sector: state.currentSector, need, food, short, without: without ? without.name : null,
        weak: without ? !!without._nsWeak : false, counts: Object.fromEntries(rc.living().map(c => [c.name, c._wentWithout || 0])) });
}

module.exports = { hands, tripCard, board, serveSupper };
