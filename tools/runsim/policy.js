/* tools/runsim/policy.js — how each of the five players chooses (tools/runsim/models.js STYLES): a card's choice, the trip
   card's way, the worlds of the route, the finds that get a trip, who goes down, who goes without supper, what a broken deck
   gets, and who walks a station. Reads the game's state and its own rule functions (passed in as `g`); changes nothing.
*/
'use strict';
const { VALUE, SAFE_TRIP_RISK } = require('./models');

const SETTLE = /settle|end the journey|ends the game|stay here for good|go down for good/i;
const ROLE_ORDER = ['SECURITY', 'ENGINEER', 'MEDIC', 'SPECIALIST'];              // Supper.js OFFER_ORDER: Vance, Jaxon, Aris, Mira
const CREW_ID = { ENGINEER: 'jaxon', MEDIC: 'aris', SECURITY: 'vance', SPECIALIST: 'mira' };
const tagsOf = c => (c && c.tags) || [];
const idOf = c => CREW_ID[ROLE_ORDER.find(t => tagsOf(c).includes(t))] || null;
const rankOf = c => ROLE_ORDER.findIndex(t => tagsOf(c).includes(t));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── cards ──
/** What a choice's words say it gives, in energy points ("+15 Energy", "-2 Rations", "+30 Salvage"), as cardsim.js read them. */
function worth(text) {
    let v = 0, m;
    const re = /([+\-−])(\d+)(?:-(\d+))?\s+(Energy|Rations?|Sealed Rations|Salvage|Data)\b/g;
    while ((m = re.exec(text))) {
        const n = (Number(m[2]) + Number(m[3] || m[2])) / 2 * (m[1] === '+' ? 1 : -1);
        v += m[4] === 'Energy' ? n * VALUE.energy : m[4] === 'Salvage' ? n * VALUE.salvage : m[4] === 'Data' ? n * VALUE.data
            : m[4] === 'Sealed Rations' ? n * 2 * VALUE.rations : n * VALUE.rations;
    }
    return v;
}
/** cardsim.js's own worth(), word for word (scratchpad tension/cardsim.js): its desc then its text, salvage at a tenth, a sealed
    ration at 9, a ration at 3, no data. Only the check against cardsim's tables uses it (models.js carefulPragmatic). */
function cardsimWorth(c) {
    const text = String(c.desc || '') + ' ' + String(c.text || '');
    let v = 0, m;
    const re = /([+\-−])(\d+)(?:-(\d+))?\s+(Energy|Rations?|Sealed Rations|Salvage)\b/g;
    while ((m = re.exec(text))) { const n = (Number(m[2]) + Number(m[3] || m[2])) / 2 * (m[1] === '+' ? 1 : -1); v += m[4] === 'Energy' ? n : m[4] === 'Salvage' ? n / 10 : m[4] === 'Sealed Rations' ? n * 9 : n * 3; }
    return v;
}
/** The same, less what it costs the crew (stress, someone hurt, a life). */
function net(text) {
    let v = worth(text);
    const stress = text.match(/([+])(\d+)\s+Stress/g);
    if (stress) v -= stress.length * 3;
    if (/hurt|injur/i.test(text)) v -= VALUE.hurt * 0.5;
    if (/\bdies\b|killed|\bdead\b|lose (?:one|a) (?:of the )?crew/i.test(text)) v -= VALUE.life * 0.5;
    return v;
}
/** The index a player clicks on a card with choices, or -1 when none can be clicked. */
function pickCard(cfg, state, style, rnd, descOf) {
    const choices = cfg.choices || [];
    const words = c => { try { return `${c.text || ''} ${descOf ? descOf(c, state) : c.desc || ''}`; } catch (err) { return String(c.text || ''); } };
    const ok = choices.map((c, i) => ({ c, i })).filter(({ c }) => !c.disabled && !SETTLE.test(String(c.text || ''))
        && !(typeof c.requires === 'function' && !safe(() => c.requires(state), false)));
    if (!ok.length) return choices.length ? 0 : -1;
    if (style.cards === 'random') return ok[Math.floor(rnd() * ok.length)].i;
    if (style.cards === 'resources') return ok.slice().sort((a, b) => worth(words(b.c)) - worth(words(a.c)) || a.i - b.i)[0].i;
    if (style.cards === 'cardsim') return ok.slice().sort((a, b) => cardsimWorth(b.c) - cardsimWorth(a.c) || a.i - b.i)[0].i;
    if (style.cards === 'net') return ok.slice().sort((a, b) => net(words(b.c)) - net(words(a.c)) || a.i - b.i)[0].i;
    return ok[0].i;                                                                  // kind / first: the first choice (cardsim's "kind")
}
function safe(f, d) { try { return f(); } catch (err) { return d; } }

// ── the trip card's way ──
function rewardValue(choice, evaRange) {
    const r = choice.reward || {};
    if (r.type === 'RESOURCE' && r.val === 'NOTHING') return /Lose Fuel|Energy Cost/i.test(choice.text) ? -10 : /Morale Loss/i.test(choice.text) ? -3 : 0;
    if (r.type === 'RESOURCE') return String(r.val).includes('METALS_HIGH') ? 89.5 * VALUE.salvage : String(r.val).includes('METALS') ? 59.5 * VALUE.salvage : (evaRange[0] + evaRange[1]) / 2 * VALUE.energy;
    if (r.type === 'DATA') return (Number(r.val) || 1) * VALUE.data;
    if (r.type === 'ITEM') return VALUE.item;
    return 0;
}
/** resolveEvaOutcome's own odds: a hit at total risk t kills 10 % of the time, one more point past 40 % risk. */
function expected(choice, riskBase, evaRange) {
    const t = clamp(riskBase + (Number(choice.riskMod) || 0), 0, 100), deathShare = (10 + Math.max(0, t - 40)) / 100;
    return rewardValue(choice, evaRange) - t / 100 * (VALUE.hurt + deathShare * VALUE.life);
}
const isSupply = c => { const r = c.reward || {}; return r.type === 'RESOURCE' && r.val !== 'NOTHING'; };
/** The choice's index among `open` ({ c, i } not struck by a trait). */
function pickWay(open, style, riskBase, evaRange, rnd) {
    const byRisk = open.slice().sort((a, b) => (a.c.riskMod || 0) - (b.c.riskMod || 0) || a.i - b.i);
    const careful = byRisk[0], bold = byRisk[byRisk.length - 1];
    if (style.way === 'bold') return bold.i;
    if (style.way === 'boldForSupply') { const s = byRisk.filter(o => isSupply(o.c)); return (s.length ? s[s.length - 1] : careful).i; }
    if (style.way === 'expected') return open.slice().sort((a, b) => expected(b.c, riskBase, evaRange) - expected(a.c, riskBase, evaRange) || a.i - b.i)[0].i;
    return careful.i;
}

// ── the route ──
const RANK = (n, app) => {
    const tg = n.tags || [];
    if (tg.includes('EXODUS_WRECK') && !n.exodusInvestigated) return 0;
    if (n.isStation) return 1;
    if (n.type === 'GAS_GIANT') return 2;
    if (n.isAsteroidField) return 3;
    if (app.siteOf(n)) return 4;
    return 5;
};
/** What a world is worth to the optimizer before it is scanned (energy points): the skim, a station's walk, a field's card, a world's finds. */
function worldValue(n, app, state, skim) {
    if (n.type === 'GAS_GIANT') return Math.min(skim, 100 - state.energy);
    if (n.isStation) return 16;
    if (n.isAsteroidField) return 8;
    const site = app.siteOf(n);
    return 10 + (site ? 6 : 0);
}
/** The energy the rest of the run needs from here (cardsim.js's reserve): our wreck still ahead, this sector's jump, and a
    far warp and a jump for every sector after it. */
function reserveNeed(state, app, econ, wreckLeft) {
    const s = state.currentSector, jump = app.sectorJumpCost(), far = econ.WARP_FAR;
    let need = (wreckLeft ? far : 0) + (s < 6 ? jump : 0);
    for (let k = s + 1; k <= 6; k++) need += far + (k < 6 ? econ.JUMP : 0);
    return need;
}
/** The world this player flies to next, or null (go to the jump, or the light). ahead: NSRoute's worlds still ahead. */
function pickWorld(ahead, style, ctx) {
    const { state, app, econ, rnd } = ctx;
    const cost = n => state.getWarpCost(n), isStory = n => app.isStoryStop(n);
    const bands = [...new Set(ahead.map(w => w.band))].sort((a, b) => a - b);
    const isWreck = n => (n.tags || []).includes('EXODUS_WRECK') && !n.isStoryPlanet && !n.exodusInvestigated;
    for (const band of bands) {
        const here = ahead.filter(w => w.band === band && !w.node.storyHidden).map(w => w.node).sort((a, b) => RANK(a, app) - RANK(b, app) || cost(a) - cost(b));
        if (!here.length) continue;
        const story = here.find(isStory);
        if (story) return story;                                                     // our wreck or the story world: every player goes
        if (style.worlds === 'story') continue;                                      // the lean check player: nothing else
        const wreckLeft = ahead.some(w => w.band > band && isWreck(w.node));
        const need = reserveNeed(state, app, econ, wreckLeft);
        const netCost = n => cost(n) - (n.type === 'GAS_GIANT' && !n.nsSkimmed ? Math.min(econ.SKIM, 100 - state.energy + cost(n)) : 0);
        const canPay = n => cost(n) <= state.energy;
        if (style.worlds === 'reserve') { const n = here.find(x => canPay(x) && state.energy - netCost(x) >= need); if (n) return n; continue; }
        if (style.worlds === 'all') { const n = here.find(canPay); if (n) return n; continue; }
        if (style.worlds === 'random') { const ok = here.filter(canPay); if (ok.length) return ok[Math.floor(rnd() * ok.length)]; continue; }
        if (style.worlds === 'payoff') {
            const ok = here.filter(x => canPay(x) && state.energy - netCost(x) >= need && worldValue(x, app, state, econ.SKIM) - netCost(x) > 0)
                .sort((a, b) => (worldValue(b, app, state, econ.SKIM) - netCost(b)) - (worldValue(a, app, state, econ.SKIM) - netCost(a)));
            if (ok.length) return ok[0];
        }
    }
    return null;
}

// ── the finds and the team ──
/** Does this player send a team to this find? risk: the find's shown risk with the proposed pair (null: a site's own story).
    ctx.tripsHere: trips already made from this orbit; ctx.eventTrips: event finds visited here. The careful players make one
    trip a world (its site first), and a second only for a clue; the optimizer up to two event finds; the others every find. */
function wantsFind(find, style, ctx) {
    if (find.done) return false;
    if (style.trips === 'safe' && (ctx.tripsHere || 0) > 0 && !find.hint) return false;
    if (find.kind === 'site' || find.kind === 'eden') return find.kind === 'site';
    if (style.trips === 'all') return true;
    const risk = typeof find.risk === 'number' ? find.risk : 0;
    if (style.trips === 'safe') return risk <= SAFE_TRIP_RISK || !!find.hint;                    // a clue is worth a risky trip
    if ((ctx.eventTrips || 0) >= 2) return false;
    if (style.trips === 'payoff') {
        const ev = ctx.eventOf(find.event);
        if (!ev) return false;
        const base = risk - Math.min(...ev.choices.map(c => Number(c.riskMod) || 0));
        return Math.max(...ev.choices.map(c => expected(c, base, ctx.evaRange))) > 0;
    }
    return true;
}
/** The two who go down: [id, id], or null when fewer than two can go. */
function pickTeam(find, style, ctx) {
    const { orbit, app, rnd, finds, node } = ctx;
    const pool = orbit.eligible(app);
    if (pool.length < 2) return null;
    if (style.team === 'random') {
        const a = pool[Math.floor(rnd() * pool.length)], rest = pool.filter(x => x !== a);
        return [a, rest[Math.floor(rnd() * rest.length)]];
    }
    const proposed = orbit.propose(app);
    if (style.team === 'lowestRisk' && find && find.kind === 'event') {
        let best = null;
        for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
            const ids = [pool[i], pool[j]], f = finds.list(app, node, ids).find(x => x.id === find.id), r = f && typeof f.risk === 'number' ? f.risk : 0;
            const isProposed = proposed && proposed.ids.includes(ids[0]) && proposed.ids.includes(ids[1]);
            if (!best || r < best.r || (r === best.r && isProposed)) best = { ids, r };
        }
        if (best) return best.ids;
    }
    return proposed ? proposed.ids.slice() : pool.slice(0, 2);
}

// ── supper ──
/** Who goes without when the food is short: Supper.js's offer (Accept), or the player's own pick. */
function pickWithout(state, style, run) {
    const can = (state.crew || []).filter(c => c.status !== 'DEAD' && !tagsOf(c).includes('LEADER'));
    if (!can.length) return null;
    const offerer = can.filter(c => !tagsOf(c).includes('CONFINED') && !tagsOf(c).includes('SEDATED')).sort((a, b) => rankOf(a) - rankOf(b))[0] || null;
    const went = c => c._wentWithout || 0, hurt = c => (c.status === 'INJURED' ? 1 : 0), stress = c => c.stress || 0;
    if (style.supper === 'rotate') return can.slice().sort((a, b) => went(a) - went(b) || hurt(a) - hurt(b) || stress(a) - stress(b) || rankOf(a) - rankOf(b))[0];
    if (style.supper === 'same') return can.find(c => c.name === run.supperVictim) || offerer;
    if (style.supper === 'best') return can.slice().sort((a, b) => hurt(a) - hurt(b) || stress(a) - stress(b) || went(a) - went(b) || rankOf(a) - rankOf(b))[0];
    return offerer;                                                                  // Accept: Vance, else the next who can
}

// ── broken decks ──
/** What this player does about one broken deck: 'fix' | 'patch' | 'live', and whether a fix was wanted but unaffordable. */
function deckPlan(choices, state, cost, style) {
    const canPatch = choices.some(c => c.key === 'patch') && state.salvage >= 5, canFix = state.salvage >= cost;
    if (style.decks === 'never') return { key: 'live', wanted: false };
    if (style.decks === 'cheap') return canFix && cost <= 35 ? { key: 'fix', wanted: false } : { key: 'live', wanted: false };
    if (style.decks === 'cheapest') return canPatch ? { key: 'patch', wanted: false } : canFix ? { key: 'fix', wanted: false } : { key: 'live', wanted: true };
    if (canFix) return { key: 'fix', wanted: false };
    return { key: canPatch ? 'patch' : 'live', wanted: true };
}

// ── the station walk ──
function pickBoarder(state, style, rnd) {
    const well = (state.crew || []).filter(c => c.status === 'HEALTHY' && !tagsOf(c).includes('LEADER') && !tagsOf(c).includes('CONFINED') && !tagsOf(c).includes('SEDATED'));
    if (!well.length) return (state.crew || []).find(c => tagsOf(c).includes('LEADER') && c.status !== 'DEAD') || null;
    if (style.team === 'random') return well[Math.floor(rnd() * well.length)];
    const pref = style.cards === 'resources' ? ['SPECIALIST', 'SECURITY', 'ENGINEER', 'MEDIC'] : ['SECURITY', 'SPECIALIST', 'ENGINEER', 'MEDIC'];
    return well.slice().sort((a, b) => pref.findIndex(t => tagsOf(a).includes(t)) - pref.findIndex(t => tagsOf(b).includes(t)))[0];
}

module.exports = { pickCard, pickWay, pickWorld, wantsFind, pickTeam, pickWithout, deckPlan, pickBoarder, idOf, tagsOf, SETTLE, expected };
