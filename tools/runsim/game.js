/* tools/runsim/game.js — the game's own rule files in a node vm: a stub page, a fake clock, seeded dice. No window, no sound.
   Part of tools/runsim.js (the node run model, docs: the depth plan's PART 2 "D. Bot test protocol").
   What runs for real: GameState (bundle.js), App's handlers on an App object made without its constructor (no page), the sector
   generator, NavView's map geometry, TripOdds (a trip's odds), NSRoute (Route.js), NSScan (Scan.js), NSWorldFinds (WorldFinds.js), NSOrbit (Orbit.js),
   EncounterCard.apply, WarpPlot.energyDelta, BoardingParty's headless rules and every data file's choices and effects.
   What is stood in for (hooks.*, set by tools/runsim/play.js): every card's choice (EncounterCard.open), the minigames
   (MiniHost.play, LanderGame.play), the supper scene (NSSupper), the trip card's buttons (App.showEventModal).
   makeGame(hooks) → { ctx, G(name), hooks, clock, setMode(mode), reseed(n), drain(limit), resetBus(), loadErrors }
*/
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

// index.html's order, only the files with rules or data (no drawing, no sound)
const BEFORE_BUNDLE = [
    'src/data/Items.js', 'src/data/Upgrades.js', 'src/data/Events.js', 'src/data/TripOdds.js', 'src/data/CampfireEvents.js', 'src/data/ExodusDerelicts.js', 'src/data/LootTables.js',
    'src/data/SectorConfig.js', 'src/data/SettleCouncil.js', 'src/data/ExodusLogs.js', 'src/data/StoryPlanets.js', 'src/data/FailedColonyEncounters.js',
    'src/data/DerelictEncounters.js', 'src/data/AnomalyEncounters.js', 'src/data/LateGamePOIs.js', 'src/data/StructureEncounter.js', 'src/data/ShipEvents.js',
    'src/data/SpaceStations.js', 'src/data/AsteroidFields.js', 'src/data/DistressSignals.js', 'src/data/CrewEvents.js',
    'src/systems/BoardingParty.js', 'src/systems/LanderGame.js', 'src/systems/EncounterCard.js', 'src/systems/WarpPlot.js',
    'src/generators/PlanetGenerator.js', 'src/views/NavView.js',
];
const BUNDLE = 'src/bundle.js';
const AFTER_BUNDLE = ['src/systems/minigames/TorchDoors.js', 'src/newscreen/Route.js', 'src/newscreen/Scan.js', 'src/newscreen/WorldFinds.js', 'src/newscreen/Orbit.js'];
const noop = () => {};

/** Small, fast, seedable dice (mulberry32). */
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** An element that takes anything and shows nothing. */
function stubElement() {
    return {
        style: { setProperty: noop, removeProperty: noop }, dataset: {}, children: [], hidden: false, innerHTML: '', textContent: '', value: '',
        offsetWidth: 0, offsetHeight: 0, clientWidth: 0, clientHeight: 0, isConnected: false, width: 0, height: 0,
        classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
        appendChild: c => c, append: noop, prepend: noop, insertBefore: c => c, removeChild: noop, remove: noop, replaceChildren: noop,
        querySelector: () => null, querySelectorAll: () => [], getElementsByClassName: () => [], closest: () => null, contains: () => false,
        addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null, removeAttribute: noop, hasAttribute: () => false,
        getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }), getClientRects: () => [],
        getContext: () => null, focus: noop, blur: noop, click: noop, cloneNode: () => stubElement(), animate: () => ({ finished: Promise.resolve(), cancel: noop }),
    };
}

/** The new look's event bus. The files loaded fresh for every run (play.js PER_RUN) hook it again each time (NSOrbit's calm
    clock): reset() drops the last run's hooks, or every old run stays in memory and each emit calls them all. */
function makeBus(hooks) {
    const handlers = {};
    let atLoad = {};
    const bus = {
        on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
        off(name, fn) { handlers[name] = (handlers[name] || []).filter(f => f !== fn); },
        emit(name, payload) { (handlers[name] || []).slice().forEach(fn => { try { fn(payload); } catch (err) { hooks.error(err, 'bus:' + name); } }); },
    };
    const snapshot = () => { atLoad = Object.fromEntries(Object.entries(handlers).map(([k, v]) => [k, v.slice()])); };
    const reset = () => {
        Object.keys(handlers).forEach(k => { delete handlers[k]; });
        Object.entries(atLoad).forEach(([k, v]) => { handlers[k] = v.slice(); });
    };
    return { bus, snapshot, reset };
}

/** The fake clock's timers: setTimeout keeps them; drain() runs them in time order, the clock jumping to each. */
function makeTimers(clock, hooks) {
    const list = [];
    let lastId = 0;
    const flush = () => new Promise(resolve => setImmediate(resolve));                  // a full turn: every promise waiting runs first
    /** Runs every timer due (the clock jumps to each) and every promise they start, until nothing is waiting. */
    async function drain(limit = 4000) {
        for (let i = 0; i < limit; i++) {
            await flush();
            if (!list.length) { await flush(); if (!list.length) return true; }
            list.sort((a, b) => a.at - b.at || a.id - b.id);
            const t = list.shift();
            if (t.at > clock.now) clock.now = t.at;
            try { t.fn(); } catch (err) { hooks.error(err, 'timer'); }
        }
        hooks.error(new Error(`drain: still busy after ${limit} timers`), 'drain');
        list.length = 0;
        return false;
    }
    return {
        drain, pending: () => list.length, clear: () => { list.length = 0; },
        setTimeout: (fn, ms) => { const id = ++lastId; list.push({ id, at: clock.now + (Number(ms) || 0), fn }); return id; },
        clearTimeout: id => { const i = list.findIndex(t => t.id === id); if (i >= 0) list.splice(i, 1); },
        setInterval: () => ++lastId,
    };
}

/** The page the rule files see: the fake clock and dice, timers, a document of stubs. */
function pageStubs(hooks, clock, timers, dice) {
    const M = Object.create(Math);
    M.random = () => dice.next();
    // node ids carry Date.now() (PlanetGenerator) and WorldFinds/kindEventOf hash them: the clock must be the fake one, so a seed replays
    const BASE_TIME = Date.UTC(2026, 9, 29);
    class FakeDate extends Date {
        constructor(...a) { if (a.length) super(...a); else super(BASE_TIME + Math.floor(clock.now)); }
        static now() { return BASE_TIME + Math.floor(clock.now); }
    }
    return {
        console: { log: noop, info: noop, debug: noop, warn: noop, error: (...a) => hooks.error(a.find(x => x instanceof Error) || new Error(a.map(String).join(' ')), 'console.error') },
        Math: M, Date: FakeDate, JSON, Object, Array, Number, String, Boolean, Promise, Set, Map, WeakMap, WeakSet, RegExp, Error, TypeError, Symbol, Reflect, Proxy,
        parseInt, parseFloat, isFinite, isNaN, Infinity, NaN, URLSearchParams, structuredClone,
        setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, setInterval: timers.setInterval, clearInterval: noop,
        requestAnimationFrame: () => 0, cancelAnimationFrame: noop, queueMicrotask: fn => Promise.resolve().then(fn),
        performance: { now: () => clock.now },
        location: { search: '?new=1&mute=1', href: 'http://runsim.local/?new=1&mute=1', reload: noop },
        navigator: { userAgent: 'runsim (node)' }, innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1,
        localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
        document: {
            addEventListener: noop, removeEventListener: noop, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: stubElement, createElementNS: stubElement, createDocumentFragment: stubElement, body: stubElement(), head: stubElement(),
            documentElement: stubElement(), hidden: false, visibilityState: 'visible', fonts: { ready: Promise.resolve() }, activeElement: null,
        },
        CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts && opts.detail; } },
        Event: class { constructor(type) { this.type = type; } },
        Image: class { constructor() { this.onload = null; } }, CSS: { escape: s => String(s) },
        getComputedStyle: () => ({ getPropertyValue: () => '' }), matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
        ResizeObserver: class { observe() {} unobserve() {} disconnect() {} }, MutationObserver: class { observe() {} disconnect() {} },
        IntersectionObserver: class { observe() {} disconnect() {} },
    };
}

/** window's own events: every dispatch goes to hooks.event first, then to the files' listeners. */
function windowEvents(ctx, hooks) {
    const listeners = {};
    ctx.window = ctx;
    ctx.globalThis = ctx;
    ctx.addEventListener = (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); };
    ctx.removeEventListener = (type, fn) => { listeners[type] = (listeners[type] || []).filter(f => f !== fn); };
    ctx.dispatchEvent = ev => {
        try { hooks.event(ev); } catch (err) { hooks.error(err, 'event'); }
        (listeners[ev && ev.type] || []).slice().forEach(fn => { try { fn(ev); } catch (err) { hooks.error(err, 'listener:' + ev.type); } });
        return true;
    };
}

/** The new look's switch, and the pieces of its page the rules ask for. */
function newLookStubs(ctx, hooks, bus, modeBox) {
    ctx.NEW_SCREEN = true;
    ctx.NewScreen = {
        app: null, bus, on: bus.on, mods: { voice: { say: () => Promise.resolve(true), current: () => null, hush: noop }, stop: null },
        isShown: () => true, mode: () => modeBox.mode, show: noop, hide: noop, playJump: () => Promise.resolve(),
        anchors: { get: () => null }, debug: {},
    };
    ctx.NSSupper = { settle: () => hooks.supper(ctx.app), pending: () => !!(ctx.app && ctx.app.state && ctx.app.state._nsSupper), busy: () => false, tick: noop, choosing: () => false, pick: () => false, tagFor: () => null, debug: () => ({}) };
    ctx.MiniHost = {
        has: name => ['breach', 'torch', 'disc', 'corridor', 'burn'].includes(name),
        play: (name, opts) => Promise.resolve(hooks.mini(name, opts)),
    };
    ctx.TheThrow = { play: () => Promise.resolve() };
    ctx.NSThrow = { play: () => Promise.resolve(), card: () => Promise.resolve() };
    ctx.NarrativeModal = {};
}

/** The rule files, in index.html's order. Returns what failed to load. */
function loadRules(ctx) {
    const loadErrors = [];
    const load = rel => {
        try { vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel }); }
        catch (err) { loadErrors.push(`${rel}: ${err.message}`); }
    };
    BEFORE_BUNDLE.forEach(load);
    load(BUNDLE);
    AFTER_BUNDLE.forEach(load);
    return loadErrors;
}

/** The stand-ins that wrap a real module (its rules stay: LanderGame.GRADES, BoardingParty.internals, EncounterCard.apply). */
function wrapStandIns(ctx, hooks) {
    const realLander = ctx.LanderGame || {};
    ctx.LanderGame = Object.assign({}, realLander, { play: (app, planet, team, opts) => Promise.resolve(hooks.land(app, planet, team, opts || {})) });
    const realBoarding = ctx.BoardingParty || {};
    ctx.BoardingParty = Object.assign({}, realBoarding, { start: (app, station) => Promise.resolve(hooks.board(app, station)) });
    if (ctx.EncounterCard) {
        ctx.EncounterCard.open = (app, cfg) => { hooks.card(app, cfg); return null; };
        ctx.EncounterCard.outcomeIn = (app, panel, picked, run, done) => { run(); if (done) done(); };
        ctx.EncounterCard.whenFree = fn => { if (typeof fn === 'function') fn(); return Promise.resolve(); };
    }
}

/**
 * hooks (read on every call, so the driver can swap them per run):
 *   card(app, cfg)                 EncounterCard.open: the driver picks a choice and calls cfg.onPick(idx) (or never, to leave it open)
 *   mini(name, opts) → result      MiniHost.play's result for a minigame
 *   land(app, planet, team, opts) → { grade, auto, offMark, marked }   LanderGame.play's result
 *   board(app, station) → { reachedCommand, member }   BoardingParty.start (the walk through a station)
 *   supper(app)                    NSSupper.settle: serve the supper due
 *   event(ev)                      window.dispatchEvent (crew-death, crew-injury, game-over, deck-damaged ...)
 *   error(err, where)              anything that threw inside a timer or a file
 */
function makeGame(given) {
    const hooks = Object.assign({ card: noop, mini: () => null, land: () => ({ grade: 'rough' }), board: () => ({ reachedCommand: false }), supper: noop, event: noop, error: noop }, given || {});
    const clock = { now: 0 }, dice = { next: mulberry32(1) }, modeBox = { mode: 'travel' };
    const timers = makeTimers(clock, hooks), { bus, snapshot, reset } = makeBus(hooks);
    const ctx = pageStubs(hooks, clock, timers, dice);
    windowEvents(ctx, hooks);
    newLookStubs(ctx, hooks, bus, modeBox);
    vm.createContext(ctx);
    const loadErrors = loadRules(ctx);
    wrapStandIns(ctx, hooks);
    snapshot();
    const G = name => { try { return vm.runInContext(`typeof ${name} !== 'undefined' ? ${name} : undefined`, ctx); } catch (err) { return undefined; } };
    return {
        ctx, G, clock, drain: timers.drain, loadErrors, bus, hooks, resetBus: reset,
        setMode: mode => { if (modeBox.mode !== mode) { modeBox.mode = mode; bus.emit('mode', { mode }); } },
        reseed: n => { dice.next = mulberry32(n); },
        advance: ms => { clock.now += ms; },
        pendingTimers: timers.pending,
        clearTimers: timers.clear,
    };
}

module.exports = { makeGame, mulberry32, ROOT };
