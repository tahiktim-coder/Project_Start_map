/* tools/runsim/models.js — what the model assumes where the game has a player's hands or a clock: the five player styles,
   the minigames' results (measured where a measurement exists, else an assumption, named as one), and the seconds each
   routine takes on screen (assumptions, to be checked against the browser runs). Pure data and small functions.
*/
'use strict';
const { auraLanding } = require('./lander');
const { auraDocking } = require('./docking');

// ── the five players (the depth plan, D2) ──
// cards: how a card's choice is picked (play.js pickCard). way: the trip card's choice. team: who goes down. supper: who goes
// without. decks: what a broken deck gets. worlds: which worlds of the route are taken. trips: which finds get a trip.
// strange: "Fly closer" at a strange site. pilot: who flies the landings, the jumps and the breach.
const STYLES = Object.freeze({
    careful: { label: 'Careful', cards: 'kind', way: 'careful', team: 'proposal', supper: 'rotate', decks: 'fix', worlds: 'reserve', trips: 'safe', strange: false, pilot: 'good' },
    greedy: { label: 'Greedy', cards: 'resources', way: 'boldForSupply', team: 'proposal', supper: 'accept', decks: 'cheap', worlds: 'all', trips: 'all', strange: true, pilot: 'good' },
    reckless: { label: 'Reckless', cards: 'random', way: 'bold', team: 'random', supper: 'same', decks: 'never', worlds: 'random', trips: 'all', strange: true, pilot: 'poor' },
    aura: { label: 'A.U.R.A.-heavy', cards: 'first', way: 'careful', team: 'proposal', supper: 'accept', decks: 'fix', worlds: 'reserve', trips: 'safe', strange: false, pilot: 'aura' },
    optimizer: { label: 'Optimizer', cards: 'net', way: 'expected', team: 'lowestRisk', supper: 'best', decks: 'cheapest', worlds: 'payoff', trips: 'payoff', strange: false, pilot: 'good' },
    // two more, only to check the model against cardsim.js's tables (tension/out/model-final2.txt): its careful/pragmatic (cardsim's
    // own worth(), policy.js cardsimWorth) and lean/kind; carefulPragmatic is also the plan's "pragmatic" in the card-gap guard
    carefulPragmatic: { label: 'Careful, pragm.', cards: 'cardsim', way: 'careful', team: 'proposal', supper: 'rotate', decks: 'fix', worlds: 'reserve', trips: 'safe', strange: false, pilot: 'good' },
    lean: { label: 'Lean', cards: 'kind', way: 'careful', team: 'proposal', supper: 'rotate', decks: 'fix', worlds: 'story', trips: 'safe', strange: false, pilot: 'good' },
});
const STYLE_ORDER = ['careful', 'greedy', 'reckless', 'aura', 'optimizer'];

// what one supply is worth to the optimizer and to the expected-payoff choices (energy points); a life is 60 (the plan's D2)
const VALUE = Object.freeze({ energy: 1, salvage: 0.2, rations: 3, data: 2, item: 4, hurt: 10, life: 60 });
const SAFE_TRIP_RISK = 25;      // the careful player sends a team only where the shown risk is at most this

// ── the minigames ──
/** The jump's flight (Corridor), per flight: measured 2026-10-2x (scratchpad ideas/dark-leg-test/tune-out.txt, lampRed 0.25):
    careful 0.11 scrapes, 0.01 decks, +4.7 energy; careless 3.2 scrapes, 1.35 decks, +0.5 energy; A.U.R.A. flies it: -4 energy, no scrape. */
function corridorResult(pilot, rnd) {
    if (pilot === 'aura') return { scrapes: 0, energyDelta: -4, auraFlew: true, damagedRooms: [], hulls: [] };
    if (pilot === 'poor') {
        const scrapes = poisson(3.3, rnd), r = rnd();
        return { scrapes, energyDelta: r < 0.7 ? 0 : r < 0.9 ? 1 : 2, auraFlew: false, damagedRooms: [], hulls: [] };
    }
    const r = rnd(), scrapes = r < 0.9 ? 0 : r < 0.99 ? 1 : 2;
    const saved = Math.max(0, Math.min(7, Math.round(4.7 + gauss(rnd) * 1.2) - scrapes));
    return { scrapes, energyDelta: saved, auraFlew: false, damagedRooms: [], hulls: [] };
}
/** After the flight (the new look's jump into sector 5, Corridor.js THE DARK): how many hours the black lasts, by who flies,
    measured 2026-10-31 through the real game in muted Chrome (pilot bots; scratchpad lpv/final.log): careful 26-27 s of black
    (6 hours), flat out 17 s (4 hours), slow or A.U.R.A. 46 s (11 hours). Its bill is the flight's own rule (VOID.cost): a
    ration a living person a day of it, at least one; all crew +1 stress from 9 hours. The result's void, as the flight gives it. */
const DARK = Object.freeze({ hours: { good: 6, poor: 4, aura: 11 }, day: 24, stress: 9 });
function darkResult(pilot, living) {
    const hours = DARK.hours[pilot] || DARK.hours.good;
    return { hours, rations: -Math.max(1, Math.ceil(living * hours / DARK.day)), stress: hours >= DARK.stress ? 1 : 0, blackSecs: 0, darkHits: 0 };
}
/** The landing (LanderGame). Player grades are assumptions (the plan's D1): good 60/35/5 soft/rough/crash, poor 15/45/40.
    A.U.R.A.'s: her own autopilot run headless on that world's own ground (tools/runsim/lander.js); 'rough' if that fails. */
function landingResult(pilot, rnd, unmarked, planet) {
    if (pilot === 'aura') {
        const r = planet ? auraLanding(planet, unmarked) : null;
        return { grade: r ? r.grade : 'rough', auto: true, offMark: !!(r && r.offMark), marked: !unmarked };
    }
    const [soft, rough] = pilot === 'poor' ? [0.15, 0.45] : [0.6, 0.35];
    const r = rnd(), grade = r < soft ? 'soft' : r < soft + rough ? 'rough' : 'crash';
    return { grade, auto: false, offMark: false, marked: !unmarked };
}
/** Sector 1's breach (Breach): an assumption. Sealed in time keeps the deck; a lost deck catches whoever is in it. */
function breachResult(pilot, rnd, opts) {
    const lose = { good: 0.45, poor: 0.85, aura: 0.65 }[pilot] || 0.6, hurtP = { good: 0.25, poor: 0.6, aura: 0.4 }[pilot] || 0.4;
    if (rnd() >= lose) return { damagedDeck: null, hurt: [], airLostPercent: 5 };
    const decks = ['bridge', 'lab', 'quarters', 'cargo', 'engineering'], deck = decks[Math.floor(rnd() * decks.length)];
    const here = ((opts && opts.crew) || []).filter(c => c.alive && c.id !== 'you');
    const hurt = here.length && rnd() < hurtP ? [here[Math.floor(rnd() * here.length)].id] : [];
    return { damagedDeck: deck, hurt, airLostPercent: 20 };
}
/** The burn into sector 3 (the gauge, WarpPlot's grades): an assumption. */
function burnResult(pilot, rnd) {
    if (pilot === 'aura') return { grade: 'rough', auto: true, isFirstPlot: false };
    const r = rnd();
    const grade = pilot === 'poor' ? (r < 0.15 ? 'clean' : r < 0.55 ? 'rough' : 'bad') : (r < 0.2 ? 'perfect' : r < 0.7 ? 'clean' : r < 0.95 ? 'rough' : 'bad');
    return { grade, auto: false, isFirstPlot: false };
}
/** How the ship docks before a station walk (DockingGame): the boarder loses air on a rough or hard docking, and a hard one
    breaks a deck (hands.js board). A player's grades are an assumption; A.U.R.A.'s are her own autopilot run headless on
    that station (tools/runsim/docking.js: soft on every station tried), 'soft' if that fails ("LET A.U.R.A. DOCK ... cleanly"). */
function dockingGrade(pilot, rnd, station) {
    if (pilot === 'aura') return auraDocking(station) || 'soft';
    const r = rnd();
    return pilot === 'poor' ? (r < 0.3 ? 'soft' : r < 0.7 ? 'rough' : 'crash') : (r < 0.7 ? 'soft' : r < 0.95 ? 'rough' : 'crash');
}

function poisson(mean, rnd) { const L = Math.exp(-mean); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; }
function gauss(rnd) { const u = Math.max(1e-9, rnd()), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// ── the clock: seconds on screen per routine (assumptions; the plan's time budget names the cuts) ──
// The routines the plan cuts are kept apart, so a cut that goes live is one number here (CUTS).
const SECONDS = Object.freeze({
    opening: 150, ending: 120,                       // the wake-up and the launch film; the light and its ending
    pickWorld: 3, flight: 10, arriveHold: 4,         // travel: choosing a world, the flight in, the bridge hold on arrival
    bridgeAgain: 4, bridgeAgainCut: 2,               // after a trip, until two step forward again (Stop.js: 4.75 s; C5: at once, while
                                                     //   the shuttle comes up, about 2 s with their walk to the hatch)
    scan: 3,                                         // Scan: the click and the sweep (C1: it runs by itself as the bridge shows; ~1 min a run)
    teamPick: 5, landingFull: 22, landingAura: 16,   // the hatch; the drop flown by the player, or watched
    walkOut: 5.6,                                    // the walk-out after touchdown (C4: the game's NEW_LOOK_ECONOMY.WALK_OUT_MS)
    tripCard: 16, resultCard: 9, tripBack: 4,        // the trip's card; a repeat's result card (step 6); the shuttle home
    secondTrip: 6, secondTripCut: 2,                 // the hatch again for another find at the same stop (C5: nobody walks to it)
    wreck: 35, torch: 20, page: 20, dating: 25,      // our wrecks: the story card, the door, a found page, dating the disc
    site: 30, strange: 30, station: 45, stationCard: 20, mine: 20, skim: 4, call: 25, moment: 25, deckChoice: 5,   // station: the picker and the walk
    dock: { full: 59, quick: 21 },                   // the new look's flown dock (Bring Her In), Dock click to Continue: the first of a run
                                                     //   (or a story station's) the whole approach, the rest routine; measured 2026-10-30
                                                     //   (careful 59 / 59, A.U.R.A. 20, careful 21-22, careless 15)
                                                     //   (station was 75 with DockingGame's dock in it)
    leave: 3, jumpBurn: 6, corridor: { good: 49, poor: 30, aura: 45 }, jumpFault: 14, campfire: 40,   // corridor: measured flight times
    dark: { good: 28, poor: 20, aura: 65 },          // After the flight: the dark jump's seconds over an ordinary flight (measured 2026-10-31)
    supper: 8, supperShort: 14, supperTable: 8, supperMore: 5,   // supper; short; the table moment (Aris, two chips); a second pick
    throwSequence: 95, burnGauge: 25, breach: 50, reserveCard: 8, askJump: 4,
});
// which of the plan's routine cuts are live: step 3's four are (C1 autoScan, C4 walkOut, C5 repeatTrip, C6 bridgeHold);
// C4 and C6 take their seconds from the game's table (NEW_LOOK_ECONOMY.WALK_OUT_MS, HOLD_SEEN_MS: rc.ECON), never a copy;
// step 6 turns on resultCard. The scan itself always runs as the game runs it (stop.js visit): only its seconds follow C1
const CUTS = { autoScan: true, walkOut: true, repeatTrip: true, bridgeHold: true, resultCard: false };

// A.U.R.A.'s whole dock in the new look (Bring Her In, src/newscreen/dock/DockFlight.js DOCK.energy): her share of the flying
const DOCK_AURA_ENERGY = 4;

module.exports = { STYLES, STYLE_ORDER, VALUE, SAFE_TRIP_RISK, corridorResult, darkResult, landingResult, breachResult, burnResult, dockingGrade, SECONDS, CUTS, DOCK_AURA_ENERGY };
