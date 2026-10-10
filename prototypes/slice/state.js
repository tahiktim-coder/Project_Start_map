/* Silent Exodus · sector 1 slice · the shared state, the clock and the bus (docs/SLICE_SPEC.md §4, §5).
   OWNER: the state-and-script builder (with script.js). Everyone else READS Slice.state and changes it only through the
   events in SLICE_SPEC §5 (script.js is the one writer of story state; ship.js writes nothing here; world.js writes only
   Slice.state.cam; stop.js writes only Slice.state.stop). Load this first of the slice files.

     window.Slice = {
       q                       URLSearchParams of the page (?m= ?t= ?price= ?words= ?px= ?mute=1)
       G                       screen geometry, set by index.html measure(): { dpr, k, W, H, hull, bk, bW, bH, bLeft, bTop }
       state                   the one story state (fresh() below); MOMENTS: the MOCKUP list
       clock: { t, playing }   the slice's own clock, ms; only index.html advances it (advance(dt))
       on(name, fn) → off()    emit(name, payload)    once(name, fn)
       after(ms, fn) → id      cancel(id)              timers on the slice clock (pause and step move them too)
       log                     [{ t, name, payload }] every emit, for the stopwatch and the idle check
       anchors                 Map name → () => [{ x, y, side, align }] in CSS px; modules register where words may go
       mods                    { world, ship, stop, script }: each module puts its object here
       fresh()                 a new state (the start of the run); reset() replaces Slice.state with it
       chance(key, p)          → bool: one chance of the run (seeded by state.seed, ?seed=N), drawn once per key and kept
       ECON                    the economy's numbers (ROUTE_AND_LIMITS §4, ECONOMY §3); DECKS: the six deck keys
       broken(deck)            → true while that deck is red, worse, or waiting for its fix
     }
   Everything is deterministic: no Math.random in the slice; use Slice.rand(seed) where a choice must look random. */
(function () {
    'use strict';

    const q = new URLSearchParams(location.search);
    const PRICE_MODES = ['felt', 'numbers'];
    // The run's seed: every chance in the run (a crisis aboard, a hazard at a site) is drawn from it, so ?seed=N replays a run.
    // A still (?m= or ?t=) uses seed 7, so the same moment is the same picture; a fresh page gets a new seed from the time.
    const SEED = Number(q.get('seed')) > 0 ? Math.round(Number(q.get('seed'))) : (q.has('m') || q.has('t')) ? 7 : (Date.now() % 1000003) + 1;

    // The economy (docs/ROUTE_AND_LIMITS.md §4, docs/ECONOMY.md §3), the one place these numbers live. script.js spends them.
    const ECON = Object.freeze({
        start: { energy: 100, rations: 25, salvage: 50 }, cap: { energy: 100, rations: 30, salvage: 150 },
        pullIn: 5, pullInBridge: 7,            // every pull-in; 7 while the bridge is broken. Flying and switching target are free
        skim: 15,                              // Kryos: arriving skims +15 (cap 100); it pays for its own pull-in
        jump: 8, jumpRations: 5,               // the jump: 8 energy (x2 with engineering broken); the crew eats 5 rations
        holdRations: 2,                        // the hold broken: -2 rations more at the jump
        fix: 20, marker: 10, strip: 20, stripJaxon: 30, tank: 5,   // salvage: a deck fix, a marker, stripping a wreck, each torch tank past the first
        patch: 5,                              // salvage: a patch (playtest 2: a free patch was always right); it holds until the next crisis, scrape or jump
        crisisOdds: 0.5, hazardOdds: 0.5,      // a signed crisis aboard fires about half the time (SHIP_GAMEPLAY §4); a team's site hazard, the same
        surge: 10,                             // "Let it run": -10 energy
        zetaCell: 12, erebusEnergy: 10, erebusSalvage: 20, day: 1,  // finds; "a day" is one ration
    });
    const DECKS = ['bridge', 'lab', 'quarters', 'medbay', 'hold', 'engineering'];
    const BROKEN = ['red', 'worse', 'fixing'];   // a deck in one of these does not work (patched works until the next crisis or scrape)

    function fresh() {
        return {
            sector: 1,
            seed: SEED,                // the run's seed (?seed=): Slice.chance(key, p) draws every crisis and hazard from it
            mode: 'travel',            // 'travel' | 'flight' | 'dive-in' | 'stop' | 'dive-out' | 'jump' | 'corridor' | 'meal' | 'arrive'
            hold: 0,                   // > 0 while something holds the journey (a talk, a page, dating, a minigame, the record)
            price: PRICE_MODES.includes(q.get('price')) ? q.get('price') : 'felt',
            res: Object.assign({}, ECON.start),
            crew: {                    // status: 'well' | 'hurt' | 'away' | 'shut'; stress 0..3; backed: standing moments won
                cora: { status: 'well', stress: 0, backed: 0 },
                jaxon: { status: 'well', stress: 0, backed: 0, ask: null },     // ask: null | 'open' | 'granted' | 'refused' | 'his-way'
                aris: { status: 'well', stress: 0, backed: 0 },
                vance: { status: 'well', stress: 0, backed: 0, moment: null },  // moment: null | 'open' | 'believed' | 'other-headings'
                mira: { status: 'well', stress: 0, backed: 0 },
            },
            // every place of sector 1 (SLICE_SPEC §3): status 'ahead' | 'target' | 'here' | 'visited' | 'passed'
            //   'passed': out of reach for good (the fork's other world once we arrive, or anything we flew past). did: what we did there
            places: {
                zeta: { status: 'ahead', did: null }, titan: { status: 'ahead', did: null }, kryos: { status: 'ahead', did: null },
                erebus: { status: 'ahead', did: null }, rhea: { status: 'ahead', did: null, named: false },
            },
            // at: 'start' or the last place we pulled in to (while stopped: the place we are at). target: where we are flying (or the
            // light). fork1 / fork2: the world taken at each fork. locked: true during the 1 s cancel window after a click
            route: { at: 'start', target: null, fork1: null, fork2: null, locked: false },
            team: [],                  // the two who are down at the site now (crew ids); empty aboard
            stop: null,                // stop.js: { id, phase: 'arrive' | 'pick' | 'away' | 'site' | 'back' | 'leave', team: [], aboard: [] }
            cam: null,                 // world.js: { from, to, e } the camera between route points (read-only for others)
            decks: { bridge: 'ok', lab: 'ok', quarters: 'ok', medbay: 'ok', hold: 'ok', engineering: 'ok' },   // 'ok' | 'red' | 'patched' | 'worse' | 'fixing'
            flags: {
                fixOn: null,           // the wreck's star fix: null | 'carried' (Mira brought it, on the bench when we're back) | 'late' (a stop later) | 'bench'
                dated: false,          // the fix is dated: Rhea-4 Minor is named and its course is free
                breachDone: false, surgeDone: false, noSurge: false,   // noSurge: Jaxon took his day on the drive, engineering can't surge
                jaxonOff: false,       // Jaxon is not at the next pick (his ask)
                plates: 0,             // markers made: plates over the galley table (Aris's book shows after the first)
                bowls: false,          // the meal is on the table
                light: false,          // the light answers the pointer (after Rhea's stop): the jump is ready
                signs: false,          // the stress-1 signs (Vance, Jaxon) are showing
                lived: {},             // decks the commander chose to live with: { lab: true }
                discFound: false,      // the disc drawing is in hand (the first of our wrecks, or Rhea on the Zeta way)
                fixAt: 0,              // the pull-in count when the fix was found ('late' reaches the bench after the next stop)
                fixer: null,           // who does a deck fix on the next trip: 'jaxon' (alone) | 'both' (the two aboard: the next crisis goes unanswered)
                platesPending: 0,      // markers made at this stop: their plates go up when we're back aboard
                signsDue: false,       // the stress-1 signs come next (after the first stop, once dating is done or skipped)
                said: {},              // once-only lines already said
                rolls: {},             // the chances drawn this run: { 'surge:titan': true, 'hazard:erebus': false }
                hurtOnReturn: null,    // a team member hurt at the site: in the med bay when the shuttle is back
            },
            stops: 0,                  // pull-ins made this sector
            pages: [],                 // ids of pages found, in order: 'disc', 'plate'
            pinned: [],                // pages pinned above Mira's bench: 'disc' (once dated), 'plate'
            record: [],                // the ship's record (L), in order: [{ sector, t, text, stop, who?, story?, routine?, page?, chips? }]
                                       //   chips: [['-5 energy', 'spend' | 'gain' | 'loss']]: real numbers live here
        };
    }

    // ── the bus ──
    const handlers = new Map();
    const log = [];
    function on(name, fn) {
        if (!handlers.has(name)) handlers.set(name, new Set());
        handlers.get(name).add(fn);
        return () => handlers.get(name).delete(fn);
    }
    function once(name, fn) { const off = on(name, p => { off(); fn(p); }); return off; }
    function emit(name, payload) {
        if (name !== 'tick') log.push({ t: Math.round(clock.t), name, payload });
        const set = handlers.get(name);
        if (!set) return;
        [...set].forEach(fn => { try { fn(payload); } catch (err) { console.error(`Slice: a handler for "${name}" failed`, err); } });
    }

    // ── the clock: index.html calls advance(dt) once a frame while playing, and from step(ms) ──
    const clock = { t: 0, playing: true };
    let timers = [], seq = 0;
    function after(ms, fn) { const id = ++seq; timers.push({ id, at: clock.t + ms, fn }); return id; }
    function cancel(id) { timers = timers.filter(x => x.id !== id); }
    function advance(dt) {
        const end = clock.t + dt;
        for (;;) {                                                    // fire due timers in time order, each at its own time
            const due = timers.filter(x => x.at <= end).sort((a, b) => a.at - b.at)[0];
            if (!due) break;
            clock.t = Math.max(clock.t, due.at);
            timers = timers.filter(x => x !== due);
            try { due.fn(); } catch (err) { console.error('Slice: a timer failed', err); }
        }
        clock.t = end;
    }

    /** A seeded random in 0..1, for anything that must look random but replay the same. */
    function rand(seed) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
    /** One chance of the run, drawn once from the run's seed and the key, and kept: the same seed always gives the same run. */
    function chance(key, p) {
        const st = window.Slice.state, r = st.flags.rolls;
        if (!(key in r)) { let h = st.seed >>> 0; for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 2654435761) >>> 0; const g = rand(h); g(); g(); r[key] = g() < p; }
        return r[key];
    }

    // The MOCKUP list (index.html's corner menu). Each id is a moment script.js can jump to (SLICE_SPEC §6).
    const MOMENTS = [
        ['open', 'Waking: the Lander, The Graveyard'], ['fork1', 'Fork 1: pointing at Titan'], ['flight1', 'Under the rings to Titan'],
        ['dive', 'The dive into the bridge'], ['pick', 'Titan: who goes, who stays'], ['torch', 'Torch on the hatch'],
        ['surge', 'Crisis aboard: the surge'], ['stockpile', 'The stockpile, strip or marker'], ['page-disc', 'The disc drawing'],
        ['bench', 'Back aboard: the fix on the bench'], ['dating', 'Dating at Mira\'s bench'], ['signs', 'Signs: Vance, Jaxon\'s ask'],
        ['fork2', 'Fork 2: pointing at Erebus'], ['erebus', 'Erebus: the hull sign, the pick'], ['breach', 'Breach while the team is down'],
        ['call', 'The distress call'], ['reddeck', 'A red deck: fix, patch, live'], ['kryos', 'Other branch: skim Kryos'],
        ['zeta', 'Other branch: Platform Zeta'], ['rhea', 'Rhea-4 Minor: the crew plate'], ['jump', 'The jump is ready'],
        ['corridor', 'Corridor'], ['meal', 'The first meal'], ['s2', 'Sector 2 arrives'],
    ];

    window.Slice = {
        q, G: {}, clock, state: fresh(), fresh,
        /** A new run (index.html's goto): a fresh state, no timers left from the last moment, an empty log. */
        reset() { timers = []; log.length = 0; this.state = fresh(); return this.state; },
        on, once, emit, after, cancel, advance, rand, chance, log,
        anchors: new Map(), mods: {}, MOMENTS, PRICE_MODES, ECON, DECKS,
        /** Is this deck out of action now (red, worse, or waiting for its fix)? */
        broken: deck => BROKEN.includes(window.Slice.state.decks[deck]),
    };
})();
