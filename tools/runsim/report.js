/* tools/runsim/report.js — the runs' logs (tools/runsim/play.js) as numbers per player and short stories of how runs were
   lost, in plain text. measure(runs) → numbers; text(results, meta) → the report; stories(runs, n) → sentences.
*/
'use strict';
const { STYLES, VALUE } = require('./models');

const pct = (runs, f) => (runs.length ? Math.round(1000 * runs.filter(f).length / runs.length) / 10 : 0);
const mean = (runs, f) => (runs.length ? Math.round(100 * runs.reduce((a, r) => a + (Number(f(r)) || 0), 0) / runs.length) / 100 : 0);
function quantile(values, q) {
    const a = values.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return null;
    return a[Math.min(a.length - 1, Math.max(0, Math.floor(q * (a.length - 1) + 0.5)))];
}
/** Wilson's 90 % interval for k of n, in % (one decimal). */
function wilson90(k, n) {
    if (!n) return null;
    const z = 1.645, p = k / n, d = 1 + z * z / n, mid = (p + z * z / (2 * n)) / d, half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
    return [Math.round(1000 * Math.max(0, mid - half)) / 10, Math.round(1000 * Math.min(1, mid + half)) / 10];
}
/** A book of counts per run ({ source: n }) as a mean per run, biggest first. */
function perRun(runs, f) {
    const sum = {};
    runs.forEach(r => Object.entries(f(r) || {}).forEach(([k, v]) => { sum[k] = (sum[k] || 0) + v; }));
    return Object.entries(sum).map(([k, v]) => [k, Math.round(100 * v / Math.max(1, runs.length)) / 100]).sort((a, b) => b[1] - a[1]);
}
const tally = (list, key) => list.reduce((o, x) => { o[key(x)] = (o[key(x)] || 0) + 1; return o; }, {});
const deadBy = (r, s) => r.deaths.some(d => d.sector <= s);
const topPairShare = r => { const n = Object.values(r.pairs); const t = n.reduce((a, b) => a + b, 0); return t ? Math.max(...n) / t : 0; };
/** Supplies left at the end as one number (energy points: models.js VALUE), for the "no dominant strategy" guard. */
const supplyOf = r => r.end.energy * VALUE.energy + r.end.salvage * VALUE.salvage + r.end.rations * VALUE.rations;
const share = (k, n) => (n ? Math.round(1000 * k / n) / 10 : 0);

/** The numbers for one player's runs (the depth plan's D4 rows, and the energy and food per sector of cardsim's tables). */
function measure(runs) {
    return Object.assign({ n: runs.length }, measureEnds(runs), measureCrew(runs), measureShip(runs), measureTrips(runs), {
        curve: curveOf(runs),
        flowE: perRun(runs, r => r.flow.energy), flowR: perRun(runs, r => r.flow.rations), flowS: perRun(runs, r => r.flow.salvage),
        timeBy: perRun(runs, r => r.time).map(([k, v]) => [k, Math.round(v / 6) / 10]),
        minutes: { p10: quantile(runs.map(r => r.minutes), 0.1), p50: quantile(runs.map(r => r.minutes), 0.5), p90: quantile(runs.map(r => r.minutes), 0.9) },
        errorRuns: pct(runs, r => r.errors.length > 0), errors: runs.flatMap(r => r.errors).slice(0, 6),
    });
}
/** How runs ended: the light, all four, game over, locked, stuck, and what was left at the light. */
function measureEnds(runs) {
    const light = runs.filter(r => r.ending === 'light'), early = runs.filter(r => deadBy(r, 3)), earlyLight = early.filter(r => r.ending === 'light').length;
    return {
        allFour: pct(runs, r => r.allFour), light: pct(runs, r => r.ending === 'light'), gameOver: pct(runs, r => !!r.gameOver),
        overs: tally(runs.filter(r => r.gameOver), r => r.gameOver), stuckRuns: pct(runs, r => r.ending === 'stuck'),
        lockedRuns: pct(runs, r => r.ending === 'locked'), lockedAny: pct(runs, r => (r.counts.locked || 0) > 0), lockedMean: mean(runs, r => r.counts.locked || 0),
        energyLight: quantile(light.map(r => r.end.energy), 0.5), salvageLight: quantile(light.map(r => r.end.salvage), 0.5), rationsLight: quantile(light.map(r => r.end.rations), 0.5),
        supplyLight: quantile(light.map(supplyOf), 0.5),
        earlyDeaths: early.length, earlyDeathLight: early.length ? Math.round(100 * earlyLight / early.length) : null, earlyDeathBand: wilson90(earlyLight, early.length),
        reserveAny: pct(runs, r => r.counts.reserveWarps + r.counts.reserveJumps > 0), reserveMean: mean(runs, r => r.counts.reserveWarps + r.counts.reserveJumps),
        reserveJumps: mean(runs, r => r.counts.reserveJumps), reserveWarps: mean(runs, r => r.counts.reserveWarps),
    };
}
/** The crew: suppers, deaths, stress, breakdowns, injuries. */
function measureCrew(runs) {
    const injuries = runs.flatMap(r => r.injuries);
    return {
        shortAny: pct(runs, r => r.suppers.some(s => s.short)), shortMean: mean(runs, r => r.suppers.filter(s => s.short).length),
        firstShort: pct(runs, r => !!(r.suppers[0] && r.suppers[0].short)), twice: pct(runs, r => r.suppers.some(s => Object.values(s.counts).some(v => v >= 2))),
        hungerDeaths: pct(runs, r => r.deaths.some(d => /hunger|starv/i.test(d.cause))),
        lostAny: pct(runs, r => r.deaths.length > 0), lost2: pct(runs, r => r.deaths.length >= 2), lostMean: mean(runs, r => r.deaths.length),
        phases: tally(runs.flatMap(r => r.deaths), d => d.phase),
        stress2: pct(runs, r => r.stress.reached2 > 0), stress2Mean: mean(runs, r => r.stress.reached2),
        stressUp: perRun(runs, r => r.stress.up), stressDown: perRun(runs, r => r.stress.down),
        breakdownAny: pct(runs, r => r.stress.breakdowns.length > 0), breakdownMean: mean(runs, r => r.stress.breakdowns.length),
        twoBreakdownsOneEvent: runs.reduce((a, r) => a + (r.stress.sameEvent || 0), 0),
        injuryStops: injuries.length ? Math.round(10 * injuries.reduce((a, i) => a + i.stops, 0) / injuries.length) / 10 : 0, injuriesPerRun: mean(runs, r => r.injuries.length),
    };
}
/** The ship and the route: decks, docking, stops, stations, cards. */
function measureShip(runs) {
    return {
        wantedFix: pct(runs, r => r.decks.wanted > 0), decksBroken: mean(runs, r => r.decks.broken), decksDownAtEnd: mean(runs, r => r.end.decksDown), dockCrashes: mean(runs, r => r.decks.dockCrash || 0),
        stops: mean(runs, r => r.sectors.reduce((a, s) => a + s.extras, 0)), skipped: mean(runs, r => r.sectors.reduce((a, s) => a + (s.skipped || 0), 0)),
        crises: mean(runs, r => r.counts.crises), calls: mean(runs, r => r.counts.calls), moments: mean(runs, r => r.cards.moment || 0), campfires: mean(runs, r => r.cards.campfire || 0),
        storyMissed: mean(runs, r => r.counts.storyMissed), storyMissedFew: mean(runs, r => r.counts.storyMissedFew),
        stations: mean(runs, r => r.counts.stations), strange: mean(runs, r => r.counts.strange), pages: mean(runs, r => r.end.pages),
    };
}
/** Team trips: how many, who, the traits, the stuck stops, the trip deaths and what the card showed. */
function measureTrips(runs) {
    const tripDeaths = runs.flatMap(r => r.deaths.filter(d => d.phase === 'trip' && d.trip)), trips = runs.flatMap(r => r.trips);
    const traitOn = runs.reduce((a, r) => a + r.counts.tripsWithTrait, 0), fitted = trips.filter(x => x.fit);
    return {
        trips: mean(runs, r => r.trips.length), topPair: Math.round(100 * mean(runs, topPairShare)),
        traitTrips: share(traitOn, trips.length), struckTrips: share(runs.reduce((a, r) => a + r.counts.struck, 0), traitOn),
        fitMean: fitted.length ? Math.round(100 * fitted.reduce((a, x) => a + x.fit.total, 0) / fitted.length) / 100 : null,
        stuck: mean(runs, r => r.counts.stuck), stuckFew: mean(runs, r => r.counts.stuckFew), stuckAris: mean(runs, r => r.counts.stuckAris),
        tripDeaths: tripDeaths.length, tripDeathsShown30: tripDeaths.length ? Math.round(100 * tripDeaths.filter(d => (d.trip.shown || 0) >= 30).length / tripDeaths.length) : null,
        tripDeathShownMedian: quantile(tripDeaths.map(d => d.trip.shown), 0.5),
        tripDeathsDeadly: tripDeaths.length ? Math.round(100 * tripDeaths.filter(d => d.trip.deadly).length / tripDeaths.length) : null,
        // readable: the card showed its death chance, and either GO DOWN said the trip could kill or the card left a way
        // that could not (the player chose the deadly one with its odds in front of them)
        tripDeathsCard: tripDeaths.filter(d => d.trip.deadly).length,
        tripDeathsGo: tripDeaths.filter(d => (d.trip.goDeath || 0) > 0).length,
        tripDeathsReadable: tripDeaths.filter(d => d.trip.deadly && ((d.trip.goDeath || 0) > 0 || d.trip.safeOpen)).length,
        deadlyTrips: share(trips.filter(x => x.deadly).length, trips.length), aloneTrips: mean(runs, r => r.trips.filter(x => x.alone).length), hurtGoesTrips: mean(runs, r => r.trips.filter(x => x.hurtGoes).length),
    };
}
/** Energy, food and salvage per sector (means over the runs that reached it). */
function curveOf(runs) {
    return [1, 2, 3, 4, 5, 6].map(s => {
        const rows = runs.map(r => r.sectors.find(x => x.s === s)).filter(Boolean);
        const m = f => (rows.length ? Math.round(10 * rows.reduce((a, x) => a + (Number(f(x)) || 0), 0) / rows.length) / 10 : null);
        return { s, n: rows.length, eIn: m(x => x.eIn), eOut: m(x => x.eOut), rIn: m(x => x.rIn), rOut: m(x => x.rOut), salv: m(x => x.salvOut), extras: m(x => x.extras), reserve: m(x => x.reserve), flight: m(x => x.flight), scrapes: m(x => x.scrapes) };
    });
}

// ── loss stories ──
function deathLine(d) {
    const at = `Sector ${d.sector}${d.world ? `, ${d.world} (${d.kind})` : ''}`;
    if (d.phase === 'trip' && d.trip) {
        const way = d.trip.wayKind === 'only' ? `"${d.trip.way}"` : `the ${d.trip.wayKind} way, "${d.trip.way}"`;
        const struck = (d.trip.struck || []).length ? ` (${d.trip.struck.map(t => (t === 'RECKLESS' ? "Mira's stress" : "Vance's stress")).join(' and ')} struck a way off the card.)` : '';
        const death = d.trip.deadly ? ` and 1 in ${d.trip.oneIn} that someone dies` : ' and no death chance';
        return `${at}: ${d.trip.team} went down to ${d.trip.find} and took ${way}. The card showed ${d.trip.shown}% that someone gets hurt${d.trip.oneIn != null || d.trip.deadly === false ? death : ''}.${struck} ${d.who} did not come back (${d.cause}).`;
    }
    if (d.phase === 'site' && d.trip) return `${at}: ${d.trip.team} went to ${d.trip.find}.${d.card ? ` On its card we chose "${d.card.choice}".` : ''} ${d.who} died (${d.cause}).`;
    if (d.phase === 'down' && d.trip) return `${at}: ${d.trip.team} went down to ${d.trip.find}; the landing was ${d.trip.landing || 'rough'}. ${d.who} died before the card (${d.cause}).`;
    if (d.card) return `${at}: on "${d.card.title}" we chose "${d.card.choice}". ${d.who} died (${d.cause}).`;
    return `${at}: ${d.who} died (${d.cause}).`;
}
function lockLine(L) {
    const who = (L.struck || []).map(t => (t === 'RECKLESS' ? "Mira's stress struck the careful way" : "Vance's stress struck every bold way")).join(' and ');
    return `Sector ${L.sector}${L.world ? `, ${L.world}` : ''}: ${L.team || 'the team'} found "${L.title}". ${who || 'Every way was struck'}, so no button could be pressed.${L.unlocked ? ' (--unlock: the careful way was kept open.)' : ' The run could not go on.'}`;
}
function overLine(r) {
    const s = r.end.sector;
    if (r.gameOver === 'HULL_BREACH') return `Sector ${s}: ${r.end.decksDown} decks were broken and ${r.end.salvage} salvage could not fix even the cheapest. The hull gave way.`;
    if (r.gameOver === 'CREW_LOSS') return `Sector ${s}: nobody was left alive.`;
    return `Sector ${s}: the run ended (${r.gameOver}).`;
}
/** n runs that lost someone, ended early or locked, spread over all such runs (the same picks for the same runs). */
function stories(runs, n = 5) {
    const lost = runs.filter(r => r.deaths.length || r.gameOver || r.ending === 'locked');
    if (!lost.length) return [];
    const step = lost.length / Math.min(n, lost.length), out = [];
    for (let k = 0; k < Math.min(n, lost.length); k++) {
        const r = lost[Math.floor(k * step)], deaths = r.deaths.slice().sort((a, b) => a.sector - b.sector);
        const parts = deaths.length ? [deathLine(deaths[0])] : [];
        if (deaths.length > 1) parts.push(`Later: ${deaths.slice(1).map(d => `${d.who} in sector ${d.sector} (${d.cause})`).join('; ')}.`);
        if (r.gameOver) parts.push(overLine(r));
        else if (r.ending === 'locked' && r.locked) parts.push(lockLine(r.locked));
        else parts.push(r.ending === 'light' ? `The ship reached the light with ${r.end.alive} of four.` : `The run ended: ${r.ending}.`);
        out.push(`(seed ${r.seed}) ${parts.join(' ')}`);
    }
    return out;
}

// ── the report ──
const ALL4 = (lo, hi) => [[lo, hi], [lo, hi], [lo, hi], [lo, hi]];
const TARGETS = [   // the depth plan's D4 (careful, greedy, reckless, A.U.R.A.-heavy), for the builder's check; null: free
    ['At least one short supper', 'shortAny', [55, 80], [30, 55], [50, 85], [55, 80]],
    ['Someone goes without twice', 'twice', [10, 30], [5, 20], [40, 70], [15, 35]],
    ['Hunger death', 'hungerDeaths', [0, 5], [0, 5], [10, 25], [0, 8]],
    ['At least one crew lost', 'lostAny', [10, 20], [25, 45], [65, 90], [15, 30]],
    ['Two or more lost', 'lost2', [0, 5], [0, 12], [30, 50], [0, 8]],
    ['Reach the light with all four', 'allFour', [75, 88], [50, 70], [5, 25], [65, 82]],
    ['Someone reaches stress 2', 'stress2', [65, 85], [70, 90], [90, 100], [70, 90]],
    ['A breakdown', 'breakdownAny', [15, 35], [25, 45], [50, 75], [20, 40]],
    ['Reserve used', 'reserveAny', [20, 45], [10, 30], null, [30, 55]],
    ['Energy at the light (median)', 'energyLight', [0, 25], [10, 40], null, [0, 20]],
    ['Salvage at the light (median)', 'salvageLight', [30, 120], [60, 150], null, null],
    ['Wanted a fix, too little salvage', 'wantedFix', [35, 60], [20, 45], null, null],
    ['Game over', 'gameOver', [0, 3], [0, 5], [10, 25], [0, 5]],
    ['Stuck: a locked trip card (runs)', 'lockedRuns', ...ALL4(0, 0)],
    ['Stuck: stops nobody could go (per run)', 'stuck', ...ALL4(0, 0)],
    ['Modeled minutes (median)', 'minutesP50', [25, 32], null, null, null],
];
const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
const verdict = ok => (ok ? 'PASS' : 'FAIL');

function text(results, meta) {
    const L = [], order = Object.keys(results);
    L.push(`Silent Exodus: the node run model (tools/runsim.js), ${meta.label}`);
    L.push(`${meta.when}  ·  ${meta.runs} runs per player  ·  seeds ${meta.seed}..${meta.seed + meta.runs - 1}  ·  ${meta.secs}  ·  stand-ins: ${meta.standIns}`);
    if (meta.off && meta.off.length) L.push(`Rules turned off for the check against cardsim.js: ${meta.off.join('; ')}`);
    L.push('Rules runs with scripted choices, not playthroughs: the game\'s own rule code in node, with no window and no sound.');
    L.push('');
    L.push('THREE NUMBERS PER PLAYER (for the designer)');
    order.forEach(k => { const m = results[k]; L.push(`  ${pad(STYLES[k].label, 16)} lost someone ${lpad(m.lostAny + '%', 6)}   went hungry ${lpad(m.shortAny + '%', 6)}   all four at the light ${lpad(m.allFour + '%', 6)}`); });
    L.push('');
    perPlayer(L, results, order);
    breakdowns(L, results, order);
    targets(L, results);
    guards(L, results, order);
    L.push('');
    L.push('HOW RUNS WERE LOST: FIVE STORIES PER PLAYER');
    order.forEach(k => {
        L.push(`  ${STYLES[k].label}`);
        const st = meta.stories[k] || [];
        if (!st.length) L.push('    No run lost anyone.');
        st.forEach(s => L.push(`    - ${s}`));
    });
    if (meta.notes && meta.notes.length) { L.push(''); L.push('WHAT THE MODEL ASSUMES OR LEAVES OUT'); meta.notes.forEach(n => L.push(`  - ${n}`)); }
    const errs = order.flatMap(k => results[k].errors);
    if (errs.length) { L.push(''); L.push('RULE ERRORS SEEN (first few)'); errs.slice(0, 8).forEach(e => L.push(`  ${e}`)); }
    return L.join('\n') + '\n';
}

/** The table of every number, one column per player. */
function perPlayer(L, results, order) {
    L.push('PER PLAYER');
    const row = (label, f) => L.push(`  ${pad(label, 40)}${order.map(k => ' ' + lpad(f(results[k]), 19)).join('')}`);
    const or = (v, s = '') => (v == null ? '-' : v + s);
    L.push(`  ${pad('', 40)}${order.map(k => ' ' + lpad(STYLES[k].label, 19)).join('')}`);
    row('runs', m => m.n);
    row('short supper (any) / per run', m => `${m.shortAny}% / ${m.shortMean}`);
    row('first supper short', m => `${m.firstShort}%`);
    row('someone went without twice', m => `${m.twice}%`);
    row('hunger death', m => `${m.hungerDeaths}%`);
    row('crew lost per run', m => m.lostMean);
    row('lost someone / two or more', m => `${m.lostAny}% / ${m.lost2}%`);
    row('reached the light / with all four', m => `${m.light}% / ${m.allFour}%`);
    row('game over', m => `${m.gameOver}%`);
    row('every way struck (careful kept open): runs / per run', m => `${m.lockedAny}% / ${m.lockedMean}`);
    row('reserve used (runs) / times per run', m => `${m.reserveAny}% / ${m.reserveMean}`);
    row('  reserve jumps / reserve warps', m => `${m.reserveJumps} / ${m.reserveWarps}`);
    row('someone at stress 2 / people per run', m => `${m.stress2}% / ${m.stress2Mean}`);
    row('a breakdown / per run', m => `${m.breakdownAny}% / ${m.breakdownMean}`);
    row('two breakdowns from one event (count)', m => m.twoBreakdownsOneEvent);
    row('run minutes p10 / p50 / p90', m => `${m.minutes.p10}/${m.minutes.p50}/${m.minutes.p90}`);
    row('energy / salvage / rations at the light', m => `${m.energyLight}/${m.salvageLight}/${m.rationsLight}`);
    row('wanted a fix, too little salvage', m => `${m.wantedFix}%`);
    row('decks broken per run / down at the end', m => `${m.decksBroken} / ${m.decksDownAtEnd}`);
    row('docking crashes per run', m => m.dockCrashes);
    row('worlds: stopped at (not story) / passed', m => `${m.stops} / ${m.skipped}`);
    row('team trips per run / mean pair fit', m => `${m.trips} / ${or(m.fitMean)}`);
    row('most common pair, share of its trips', m => `${m.topPair}%`);
    row('trips with a trait on / way struck (of those)', m => `${m.traitTrips}% / ${m.struckTrips}%`);
    row('crises / calls / crew moments / campfires', m => `${m.crises}/${m.calls}/${m.moments}/${m.campfires}`);
    row('stations / strange sites / pages', m => `${m.stations}/${m.strange}/${m.pages}`);
    row('injuries per run / stops each lasted', m => `${m.injuriesPerRun} / ${m.injuryStops}`);
    row('trip deaths / shown risk 30%+ / median', m => `${m.tripDeaths} / ${or(m.tripDeathsShown30, '%')} / ${or(m.tripDeathShownMedian)}`);
    row('trip deaths with a death chance shown', m => or(m.tripDeathsDeadly, '%'));
    row('trip deaths: card showed it / GO DOWN did / readable', m => `${m.tripDeathsCard} / ${m.tripDeathsGo} / ${m.tripDeathsReadable}`);
    row('trips that could kill (of all trips)', m => `${m.deadlyTrips}%`);
    row('trips per run: one went alone / someone hurt went', m => `${m.aloneTrips} / ${m.hurtGoesTrips}`);
    row('death by S3: runs / still reached light', m => `${m.earlyDeaths} / ${or(m.earlyDeathLight, '%')}`);
    row('stuck stops per run: fewer than two / Aris', m => `${m.stuckFew} / ${m.stuckAris}`);
    row('our wrecks left unboarded / fewer than two', m => `${m.storyMissed} / ${m.storyMissedFew}`);
    row('runs that never finished (stuck)', m => `${m.stuckRuns}%`);
    row('runs with a rule error', m => `${m.errorRuns}%`);
    L.push('');
}

/** Where deaths happened, the flows, the minutes, stress, and energy and food per sector. */
function breakdowns(L, results, order) {
    const each = f => order.forEach(k => f(results[k], pad(STYLES[k].label, 16), pad('', 16)));
    const list = (xs, n) => xs.slice(0, n).map(([w, v]) => `${w} ${v}`).join(', ');
    const flowLine = xs => xs.slice().sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 9).map(([w, v]) => `${w} ${v > 0 ? '+' : ''}${v}`).join(', ');
    const cells = (c, key, w) => c.map(x => lpad(x[key] == null ? '-' : x[key], w)).join('');
    L.push('WHERE DEATHS HAPPENED (count) AND HOW RUNS ENDED EARLY');
    each((m, name) => L.push(`  ${name} ${Object.entries(m.phases).map(([p, c]) => `${p} ${c}`).join(', ') || 'none'}   |   game over: ${Object.entries(m.overs).map(([t, c]) => `${t} ${c}`).join(', ') || 'none'}   |   locked: ${m.lockedRuns}%`));
    L.push('');
    L.push('WHERE ENERGY, FOOD AND SALVAGE CAME FROM AND WENT, PER RUN (net, by phase or card kind)');
    each((m, name, blank) => { L.push(`  ${name} energy  ${flowLine(m.flowE)}`); L.push(`  ${blank} rations ${flowLine(m.flowR)}`); L.push(`  ${blank} salvage ${flowLine(m.flowS)}`); });
    L.push('');
    L.push('MINUTES PER RUN BY ROUTINE (median run minutes above; the seconds per routine are assumptions, models.js SECONDS)');
    each((m, name) => L.push(`  ${name} ${list(m.timeBy, 12)}`));
    L.push('');
    L.push('STRESS ADDED (+) AND TAKEN OFF (-) PER RUN, BY WHERE IT CAME FROM (all four crew together)');
    each((m, name, blank) => { L.push(`  ${name} + ${list(m.stressUp, 7)}`); L.push(`  ${blank} - ${list(m.stressDown, 5)}`); });
    L.push('');
    L.push('ENERGY AND FOOD PER SECTOR (mean; "out" = before the jump, as cardsim\'s "E before jump" and "R")');
    each((m, name, blank) => {
        const c = m.curve;
        L.push(`  ${name} E in  ${cells(c, 'eIn', 6)}   E out ${cells(c, 'eOut', 6)}`);
        L.push(`  ${blank} R in  ${cells(c, 'rIn', 6)}   R out ${cells(c, 'rOut', 6)}`);
        L.push(`  ${blank} salv  ${cells(c, 'salv', 6)}   stops ${cells(c, 'extras', 6)}   flight ${cells(c, 'flight', 5)}`);
    });
    L.push('');
}

/** The plan's D4 table, PASS/FAIL per player. */
function targets(L, results) {
    L.push('THE PLAN\'S TARGETS (D4) AGAINST TODAY (for the builder; today is not tuned, so most FAIL by design)');
    const cols = ['careful', 'greedy', 'reckless', 'aura'];
    TARGETS.forEach(([label, key, ...ranges]) => {
        const cells = cols.map((k, i) => {
            const m = results[k], range = ranges[i];
            if (!m) return lpad('-', 18);
            const v = key === 'minutesP50' ? m.minutes.p50 : m[key];
            if (!range) return lpad(`${v} free`, 18);
            return lpad(`${v} ${verdict(v != null && v >= range[0] && v <= range[1])} [${range[0]}-${range[1]}]`, 18);
        });
        L.push(`  ${pad(label, 38)}${cells.join(' ')}`);
    });
}

/** The plan's guards (all styles), where the runs measured allow them. */
function guards(L, results, order) {
    const opt = results.optimizer, car = results.careful, gre = results.greedy, prag = results.carefulPragmatic;
    const g = (label, line) => L.push(`  ${pad(label, 38)}${line}`);
    if (opt && car && gre) {
        const beatsAll = opt.allFour > car.allFour - 10, beatsSupply = (opt.supplyLight || 0) > (gre.supplyLight || 0);
        g('No dominant strategy (optimizer)', `${verdict(!(beatsAll && beatsSupply))}: all four ${opt.allFour}% (careful ${car.allFour}%); supplies at the light ${opt.supplyLight} (greedy ${gre.supplyLight}; energy + salvage x${VALUE.salvage} + rations x${VALUE.rations})`);
    }
    order.forEach(k => { const m = results[k]; g(`No dominant team: ${STYLES[k].label}`, `${verdict(m.topPair <= 50)} ${m.topPair}% [50 or less]`); });
    if (car && prag) {
        const dE = Math.abs((car.energyLight || 0) - (prag.energyLight || 0)), dR = Math.abs((car.rationsLight || 0) - (prag.rationsLight || 0));
        g('Card gap (kind vs pragmatic)', `${verdict(dE <= 25 && dR <= 6)}: energy ${car.energyLight} vs ${prag.energyLight} (gap ${dE}, 25 or less), rations ${car.rationsLight} vs ${prag.rationsLight} (gap ${dR}, 6 or less)`);
    }
    if (car) g('Gentle start (first supper short)', `${verdict(car.firstShort <= 5)} ${car.firstShort}% [0-5]`);
    if (car && car.earlyDeathLight != null) {
        const band = car.earlyDeathBand;
        g('No death spiral (careful)', `${verdict(car.earlyDeathLight >= 85)} ${car.earlyDeathLight}% of ${car.earlyDeaths} runs [85+]; 90% interval ${band[0]}-${band[1]}%${band[0] < 85 ? ' (too few runs to be sure)' : ''}`);
    }
    const sum = key => order.reduce((a, k) => a + (results[k][key] || 0), 0), tripDeaths = sum('tripDeaths'), readable = sum('tripDeathsReadable');
    g('Readable deaths (all runs)', `${verdict(readable === tripDeaths)} ${readable} of ${tripDeaths} trip deaths were readable: the card showed the death chance, and GO DOWN said it could kill (${sum('tripDeathsGo')}) or the card left a way that could not [all]`);
    const twice = order.reduce((a, k) => a + results[k].twoBreakdownsOneEvent, 0);
    g('One breakdown per event (all runs)', `${verdict(twice === 0)} ${twice} second breakdowns from one event`);
    order.forEach(k => { const m = results[k]; if (m.traitTrips) g(`Traits matter: ${STYLES[k].label}`, `${verdict(m.struckTrips >= 30 && m.struckTrips <= 60)} way struck on ${m.struckTrips}% of trips with a trait on [30-60]`); });
}

module.exports = { measure, stories, text };
