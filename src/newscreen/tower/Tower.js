/* ═══ Silent Exodus · new screen (?new=1) · tower/Tower.js: the living ship beside the journey ═══════════════════════
   What it is: the tower module of the travel screen (docs/BUILD_A.md §3, §6; docs/BUILD_B.md §8). The WHOLE tower fits the
   screen height: all six decks, the nose's shoulder and the top of the engine bell (tower rows L.TOP0 - 40 .. L.TAIL0 + 48,
   1336 rows), both hull walls. It is drawn in its own pixels into an offscreen canvas, then onto canvas#ns-ship (sized in
   device px) scaled by ts = screen height / 1336 with smooth, high-quality scaling (0.81 at 1080p): the crew are about 84
   px tall at 1080p. Below 0.7 (1366 x 768, 1280 x 720) the tower is re-cut (look pass B04, ship/TowerArt.js cut()): shown
   at the whole scale 1/2, never smoothed, and the deck stencils stamped again at their own 3 x 5 size. No scrolling: the wheel does nothing. Space keeps the rest of the width
   (the tower takes about 26 %; never more than 45 %, then ts shrinks and the tower centres vertically).
   It reads the REAL game through NewScreen.game and never writes game state; clicks go to NewScreen.flow.
   - People: ShipRoutine.at('travel', t), bent by the real crew: dead not drawn; hurt in the med bay bed (a second hurt in
     their own bunk, asleep); asleep (sedated) in the med bay bed when no one hurt has it, else in their bunk; confined
     standing still at their bunk in the quarters; nobody stays on a red deck (they wait at the galley table, or in the
     med bay when the quarters are red); Aris tends whoever is in the med bay bed while she is in there; Mira works at her
     bench while a star fix waits there (NSOrbit.datable); too weak from a missed supper, they stay seated at the galley
     table (Vance on his bunk) until the next team trip has gone. Stress shows through the person, never as a meter (depth
     step 8): anyone well at stress 1 or more lives ShipRoutine's restless day: Jaxon and Aris lie awake in their bunk
     after the meal (the night beat; CrewEngine's 'awake' pose), Vance and Mira pace by their station (it starts and ends
     out of sight, or where both days meet, so nobody jumps); and the first time each reaches 1 they say so once
     (GameState.stressOneBarks, BarkSystem's STRESS_ONE).
   - Supper after a jump (tower/Supper.js, which this module drives): while it is due the crew's day is held at its meal,
     everyone at the galley table (set while the tower is out of sight); short of food, pointing at someone shows them in the
     supper plate (NSSupper.point) and a click picks them; while the table moment waits, a click on them shows it again.
   - The reactor follows the real energy (ShipArt.reactor.set; a step lower with engineering red); the beat runs 1.1 s at
     100, 1.5 s at 10, a missed beat in four below 25; the conduit carries it up to the bridge (TowerMarks).
   - Red decks from NewScreen.game.decks(); engineering red browns the ship out every 2.9 s.
   - Clicks in travel (BUILD_B §8): a person → flow.person(id, say, state) (pointed at: their name over their head in the
     who style and a 1-art-px light rim on the sprite); Mira or her bench while a fix waits → flow.bench(); a red deck → the
     repair plate at its hull edge (tower/ShipKey.js: Fix it, Patch it, Live with it, each with its cost chip). Pointing at a
     red deck shows its name and its one rule chip ("jumps ×2") where the plate opens: the rule words are on screen only then
     (look pass B04, C84). The first time a deck goes red, A.U.R.A. says so once, in travel (L-15).
   - A new sector: closed until 'opening:done' (5 s at most), then it slides in (1.2 s).
   - The jump into sector 3 stalls (throw/Stall.js, read through window.NSStall.view() each frame): the decks go dark one by
     one, one red lamp left on each (throw/StallArt.js paints them), their screens and lamps dead; the reactor goes cold and
     stops beating, the conduit dark, the drive's plume out; the stock numbers go out; nothing can be pointed at or clicked.
     Then the whole crew stands on the bridge, their backs to us, lit only by its red lamp, and they turn to us one by one.
   - The ship's stock (NSStock, below): energy by the reactor, rations over the galley table, salvage over the hold's
     crates, data in the lab, as lit numbers in #ns-ship-words (label Sans 14-15, number Mono 17-19 on the halo). A change
     flashes (warm up, red down, the difference beside it for 1.6 s). Low (energy 20, rations 4 or under) is --loss, its
     glow blinking in two slow steps, and the art says it too: the reactor dims with the energy, the galley cupboard stands
     open and bare (C26). The first time rations are low, A.U.R.A. says how many jumps they last (L-14). Stop.js shows the
     same four on the bridge wall.
   Source: prototypes/slice/ship.js (minus the price charge, signs, asks, meal, plates and pages).
   Load after the art files and TowerMarks.js, and after NewScreen.js (it registers itself as 'tower').

   NewScreen.mods.tower = {
     init()                      once: TowerArt.warm() jobs (one a frame), the anchors, the bus
     resize(G)                   the fit (G.ts, G.tTop, G.tLeft, G.tY0 if the shell set them, else the same formula here)
                                 and canvas#ns-ship in device px
     update(dt, t), render(t)    the shell's loop
     pointer(type, e, ax, ay)    'move' → true over something clickable; 'down' → a click; 'wheel' → false (no scroll)
     occupied() → [6 booleans]   someone on deck i now (the outside Lander's lit ports)
     beat(t) → 0..1              the reactor's pulse now (the ports and the plume breathe with it)
     personAt(id) → { x, y } | null   CSS px over that person's head
     fit() → { ts, tTop, tLeft, tY0, rows, devW, devH, wDev }   the tower's frame (ts device px per tower px; tY0, wDev
                                 device px); wDev is the tower's width on screen
     debug() → { fit, k, dark, E, decks, crew, people: [{ id, deck, x, act, say }], chips, restless: ids living the restless day }
   }
   Listens: 'shown' 'hidden' 'hud' 'opening:done' 'jump:burn' (a rumble building to the flash) 'jump:flash'.
   Uses, if present: window.Juice (the tremor; without it nothing shakes).

   window.NSStock (frozen): the ship's stock, read from the real game (never written)
     KEYS                        ['energy', 'rations', 'salvage', 'data']   (data: GameState._colonyKnowledge, "+1 Data")
     tick()                      reads the numbers; a change starts its flash (and the first time, A.U.R.A.'s line). The
                                 tower's update calls it every frame; a hidden view's return reads afresh (no flash). A
                                 change made out of sight (a card or minigame up, the dive) is held until the numbers
                                 are in view again, so its flash is seen; the numbers hide under a card or a minigame
     board(layer) → { put(key, x, y, align), hide() }   the readouts in a word layer; put places one at CSS px (x, y
                                 its top-left, or top-right with align 'right') and shows it
   window.NSTower (frozen): the ship feels the flight (picture only; ignored while the tower is closed, sliding or dark)
     jolt(s)                     s 0..1: the tremor's trauma += s; at 0.3 or more the standing crew's knees give
     speed(k)                    k 0..1: how hard we fly now, called every frame (eased, tau 400 ms; no calls: back to 0
                                 within a second); the reactor beats up to 30 % faster
     hit(deck)                   a deck name (DECKS): trauma += 0.5 and that deck's red light stutters for 360 ms. The
                                 tower calls it itself for a deck newly red, on the first frame it is in view
   Anchors: 'person:<id>' for the five, 'tower:deck:<name>' for the six decks (CSS px, [] when not in view).
   Uses, if present: NewScreen.mode() (only 'travel' takes clicks), NewScreen.mods.voice.speaking() → 'aura' | id | null
   (the computer's speaker glows while A.U.R.A. talks), NewScreen.flow.{ person(id), bench(), datable(), deckChoices(key),
   deckChoose(key, i) } (key: the game's deck key, the hold is 'cargo'); NSOrbit.{ datable, deckChoices } as a fallback.
*/
(function () {
    'use strict';
    const A = window.ShipArt, TW = window.TowerArt, SIM = window.ShipRoutine, CE = window.CrewEngine, MK = window.NSTowerMarks;
    if (!A || !TW || !SIM || !CE || !MK) { console.error('Tower: the art files and TowerMarks.js must load first'); return; }
    const L = A.L, S = A.SPOTS, F = L.DECK_FLOOR, DESK = CE.ACTIONS.console.desk;
    const IDS = ['cora', 'jaxon', 'aris', 'vance', 'mira'];
    const DECKS = MK.DECKS;
    const GAME_KEY = { bridge: 'bridge', lab: 'lab', quarters: 'quarters', medbay: null, hold: 'cargo', engineering: 'engineering' };
    const KEY = () => window.NSShipKey || null;                            // the glass keys on the decks (tower/ShipKey.js)
    const CUT_TS = 0.5, CUT_STEP_MS = 125;                                 // the re-cut's whole scale (NewScreen.measure snaps G.ts to it); made at the art's 8 fps

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
    const SLIDE_MS = 1200, OPEN_FALLBACK_MS = 5000, READ_MS = 500;
    const LOW_ENERGY = 25, CORE_ENG_DOWN = 0.7, SCALE_PROBE = 40, SCALE_SLOW_MS = 3;
    const MOVING = { walk: 1, climb: 1, carry: 1 };

    // ── the frame: every deck whole, the nose's shoulder, the top of the bell; both hull walls (BUILD_B §8) ──
    const FRAME = Object.freeze({ TOP: L.TOP0 - 40, BOT: L.TAIL0 + 48, LEFT: 40 });
    const ROWS = FRAME.BOT - FRAME.TOP, HULL_OUT = L.CX + L.HO + 9, OFF_W = HULL_OUT - FRAME.LEFT + 2, MAX_SHARE = 0.45;
    const BENCH = { deck: 1, x0: 350, x1: 582, y0: F - DESK - 34 };              // Mira's bench (the lab)
    const SLATE = { x: 440, y: A.deckTop(1) + F - DESK - 6 };                     // the star fix, waiting on the bench

    // ── where people go when the real state moves them (tower art px; deck 2 is the galley and the bunks) ──
    const BUNK = { cora: 'bedCora', jaxon: 'bedJaxon', aris: 'bedAris', vance: 'bedVance', mira: 'bedMira' };
    const CONFINE = { cora: { deck: 2, x: 204, facing: 1 }, aris: { deck: 2, x: 226, facing: 1 },   // standing still at their bunk
        jaxon: { deck: 2, x: 516, facing: -1 }, vance: { deck: 2, x: 536, facing: -1 }, mira: { deck: 2, x: 556, facing: -1 } };
    const SEAT = { cora: ['seatR2', 'sit'], mira: ['seatR1', 'sit'], jaxon: ['seatL2', 'sit'], aris: ['seatL1', 'sit'], vance: ['mealStand', 'idle'] };
    const MED_WAIT = { cora: { deck: 3, x: 436, facing: 1 }, jaxon: { deck: 3, x: 372, facing: 1 }, aris: { deck: 3, x: 402, facing: 1 },
        vance: { deck: 3, x: 470, facing: -1 }, mira: { deck: 3, x: 346, facing: 1 } };   // the quarters red too: they wait in the med bay
    const MEAL_STAND = { deck: 2, x: 548, facing: -1 };
    const spot = name => (name === 'mealStand' ? MEAL_STAND : S[name]);
    // Supper after a jump (tower/Supper.js): the crew's day is held at its meal, everyone at the galley table, while it is due.
    const SUPPER_AT = 128000;                                              // ms into ShipRoutine's lap: all five at the table (they get up at 140 s)
    const SAME_SPOT_PX = 4;                                                // the restless day may start or end in view only where it and the plain day are this close
    // too weak from a missed supper (GameState.serveSupper): they stay seated at the table; Vance, who eats standing, lies on his bunk
    const WEAK = { jaxon: ['seatL2', 'sit'], aris: ['seatL1', 'sit'], mira: ['seatR1', 'sit'], vance: ['bedVance', 'sleep'] };

    // ── the module's own picture state (never game state) ──
    const V = {
        cv: null, ctx: null, off: null, offCtx: null, jobs: [], inited: false, fit: null,
        people: [], drawn: [], slideX: 0,
        slide: { closedUntil: 0, start: null }, dark: false,
        beat: { phase: 0, n: 0, val: 0, onsets: [] },
        E: null, Eshown: 100, coreSet: null, flood: null,
        real: { crew: {}, decks: {}, engDown: false, datable: false }, readAt: -1e9, dirty: true,
        tendX: null, hover: null, words: null, quality: 'high', scaleN: 0, scaleMs: 0, cutCv: null, offCut: null,
        name: null, hotId: null, toldRed: new Set(), tellRed: null, stock: null,      // name: the name tag over whoever is pointed at (hotId)
        shake: null, tremor: null, spd: 0, spdIn: 0, spdAt: -1e9, braceT: null, flick: {}, burnT0: null, newRed: new Set(), readOnce: false,
        routine: { off: 0, held: null, restless: null },   // the crew's day runs at t + off; held: kept at that moment (supper); restless: who lives the restless day (stepRestless)
        stall: null,                       // the jump that stalls: NSStall.view() this frame (throw/Stall.js), or null
    };
    function stallView() { const S = window.NSStall; try { return S && typeof S.view === 'function' ? S.view() : null; } catch (err) { console.error('Tower: the stall view failed', err); return null; } }
    let NS = null;
    const G = () => (NS && NS.G) || {};
    const now = () => (NS && NS.clock ? NS.clock.t : 0);
    const modeNow = () => { try { return NS && typeof NS.mode === 'function' ? NS.mode() : 'travel'; } catch (err) { return 'travel'; } };

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The real game, read (NewScreen.game only: the crew and deck mapping lives in one place, the shell)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function call(name, empty) {
        const g = NS && NS.game;
        try { if (g && typeof g[name] === 'function') return g[name](); } catch (err) { console.error('Tower: game.' + name + '() failed', err); }
        return empty;
    }
    function energy() {
        const e = Number(call('energy', 100));
        return Number.isFinite(e) ? clamp(e, 0, 100) : 100;
    }
    /** A star fix waiting on Mira's bench (NSOrbit, checkpoint B); false while that part is not there. */
    function datable() {
        const fl = NS && NS.flow;
        if (fl && typeof fl.datable === 'function') { try { return !!fl.datable(); } catch (err) { console.error('Tower: flow.datable failed', err); return false; } }
        const O = window.NSOrbit, s = call('state', null);
        if (!O || typeof O.datable !== 'function' || !s) return false;
        try { return !!O.datable(s); } catch (err) { console.error('Tower: NSOrbit.datable failed', err); return false; }
    }
    function readReal(t) {
        const list = call('crew', []) || [], crew = {};
        list.forEach(c => { if (c && IDS.includes(c.id)) crew[c.id] = { status: c.status || 'well', stress: c.stress || 0, weak: !!c.weak }; });
        const raw = call('decks', {}) || {}, decks = {};
        DECKS.forEach(k => { decks[k] = raw[k] === 'red' ? 'red' : 'ok'; });
        const was = (V.real && V.real.decks) || {};
        DECKS.forEach(k => { if (decks[k] === 'red' && was[k] !== 'red' && GAME_KEY[k] && !V.toldRed.has(k)) { V.toldRed.add(k); V.tellRed = k; } });
        if (V.readOnce) DECKS.forEach(k => { if (decks[k] === 'red' && was[k] !== 'red') V.newRed.add(k); else if (decks[k] !== 'red') V.newRed.delete(k); });   // felt when first seen
        if (call('state', null)) V.readOnce = true;                           // a deck red from before the first real read is no news
        V.real = { crew, decks, engDown: decks.engineering === 'red', datable: datable() };
        V.readAt = t; V.dirty = false;
    }
    /** A deck just went red: A.U.R.A. says so once, in travel (the voice, not the log): one plain, plural-aware line (L-15). */
    function tellRed() {
        const k = V.tellRed, v = NS.mods && NS.mods.voice, K = KEY();
        if (!k || modeNow() !== 'travel' || (NS.blocked && NS.blocked()) || slideK(now()) < 1 || !v || typeof v.say !== 'function') return;
        V.tellRed = null;
        if (V.real.decks[k] !== 'red') return;
        try { v.say({ id: 'aura', who: 'A.U.R.A.', text: RED_LINE(K ? K.deckWord(k) : 'A deck', K && K.isPlural(k)) }); } catch (err) { console.error('Tower: the voice failed', err); }
    }
    const RED_LINE = (deck, plural) => `${deck} ${plural ? 'are' : 'is'} broken, Commander.`;   // DRAFT (look pass): L-15

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // People: the crew's day, bent by the real state
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function stay(id, s, act, t, say) {
        const lying = act === 'sleep' || act === 'awake';
        return { id, deck: s.deck, x: s.x, y: A.floorY(s.deck) - (lying ? s.h || 0 : 0), act, facing: s.facing, ms: t, say,
            z: lying ? 1 : act === 'sit' && (s === S.seatL2 || s === S.seatR2) ? 1.5 : 2 };
    }
    function tendSpot() {
        if (V.tendX == null) V.tendX = S.patient.x + 42 - CE.sprite('aris', 'tend', 0).hands[1].x;
        return { deck: S.patient.deck, x: V.tendX, facing: 1 };
    }
    const isRed = i => V.real.decks[DECKS[i]] === 'red';
    /** Where someone waits while their deck is sealed: the galley table, or the med bay when the quarters are red too. */
    function waitPose(id, t, fromDeck) {
        const say = 'sealed:' + DECKS[fromDeck];
        if (!isRed(2)) { const [name, act] = SEAT[id]; return stay(id, spot(name), act, t, say); }
        return stay(id, MED_WAIT[id], 'idle', t, say);
    }
    function override(p, t, bed) {
        const c = V.real.crew[p.id];
        if (!c) return p;                                                  // not in the game's crew list: the routine as it is
        if (c.status === 'dead') return null;
        if (c.status === 'hurt') return p.id === bed ? stay(p.id, S.patient, 'sleep', t, 'hurt:bed') : stay(p.id, S[BUNK[p.id]], 'sleep', t, 'hurt:bunk');
        if (c.status === 'asleep') return p.id === bed ? stay(p.id, S.patient, 'sleep', t, 'asleep:bed') : stay(p.id, S[BUNK[p.id]], 'sleep', t, 'asleep');
        if (c.status === 'confined') return stay(p.id, CONFINE[p.id], 'idle', t, 'confined');
        if (c.weak && V.routine.held == null && WEAK[p.id] && !isRed(2)) { const [name, act] = WEAK[p.id]; return stay(p.id, spot(name), act, t, 'weak'); }
        if (p.id === 'mira' && V.real.datable && !isRed(1)) return Object.assign(stay('mira', S.bench, 'console', t, 'bench'), { screen: true });
        if (MOVING[p.act]) return p;                                       // passing through is fine, even a red deck
        if (p.id === 'aris' && bed && bed !== 'aris' && p.deck === 3 && !isRed(3)) return stay('aris', tendSpot(), 'tend', t, 'tend');
        if (isRed(p.deck)) return waitPose(p.id, t, p.deck);
        return p;
    }
    /** Two people on one spot: the one the real state moved keeps it; the routine one steps aside. */
    function unstack(list, moved) {
        return list.map(p => {
            if (moved.has(p.id) || MOVING[p.act]) return p;
            const clash = list.find(q => q !== p && moved.has(q.id) && q.deck === p.deck && Math.abs(q.x - p.x) < 16);
            return clash ? Object.assign({}, p, { x: p.x + (p.x >= clash.x ? 20 : -20) }) : p;
        });
    }
    /** Who has the med bay bed: the first hurt, else the first sedated. */
    function bedOf() {
        const has = s => IDS.find(id => V.real.crew[id] && V.real.crew[id].status === s);
        return has('hurt') || has('asleep') || null;
    }
    /** The stall: everyone alive on the bridge, their backs to us until they turn (NSStall.GATHER: where each stands). */
    function gathered(t) {
        const G0 = (window.NSStall && window.NSStall.GATHER) || {}, sv = V.stall, y = A.floorY(0);
        return IDS.filter(id => G0[id] && (!V.real.crew[id] || V.real.crew[id].status !== 'dead')).map(id => ({
            id, deck: 0, x: G0[id].x, y, act: sv.turned[id] ? 'idle' : 'stand', facing: G0[id].facing, ms: t, z: 2, say: 'stall', lit: true,
        }));
    }
    /** Who should live the restless day (ShipRoutine's RESTLESS: stress shows through the person): well, at stress 1 or more,
        not too weak from a missed supper (they sit it out at the table). */
    function restless() {
        return (SIM.RESTLESS_IDS || []).filter(id => { const c = V.real.crew[id]; return !!c && c.status === 'well' && c.stress >= 1 && !c.weak; });
    }
    /** Who lives it now (V.routine.restless), latched: someone starts or stops it only while the tower is out of sight, or at a
        moment both days put them on the same spot (the meal, a shared stop, the lap's end), so nobody jumps decks when their
        stress crosses 1 in view (a travel card, a crew moment). */
    function stepRestless(t, seen) {
        const want = restless(), had = V.routine.restless;
        if (!had || !seen) { V.routine.restless = want; return; }
        if (want.length === had.length && want.every(id => had.includes(id))) return;
        const lap = V.routine.held != null ? V.routine.held : t + V.routine.off;
        const same = (id, a, b) => {
            const p = SIM.at('travel', lap, a).find(q => q.id === id), q = SIM.at('travel', lap, b).find(r => r.id === id);
            return !!p && !!q && p.deck === q.deck && Math.abs(p.x - q.x) <= SAME_SPOT_PX;
        };
        let next = had.slice();
        had.filter(id => !want.includes(id)).forEach(id => { const less = next.filter(x => x !== id); if (same(id, next, less)) next = less; });
        want.filter(id => !had.includes(id)).forEach(id => { const more = next.concat(id); if (same(id, next, more)) next = more; });
        V.routine.restless = next;
    }
    function peopleNow(t) {
        if (V.stall && V.stall.gather) return gathered(t);
        const bed = bedOf(), moved = new Set(), held = V.stall ? null : V.routine.held;   // the stall: their day as it is, not the supper still due
        const day = SIM.at('travel', held != null ? held : t + V.routine.off, V.routine.restless || restless())
            .map(p => (held != null && !MOVING[p.act] && p.act !== 'climb' ? Object.assign({}, p, { ms: t }) : p));   // held: still alive, not a statue
        const list = day.map(p => { const o = override(p, t, bed); if (o !== p) moved.add(p.id); return o; }).filter(Boolean);
        return unstack(list, moved);
    }
    /** Supper after a jump (tower/Supper.js): while it is due, the crew's day is held at its meal, everyone at the galley
        table; it is set there only while the tower is out of sight (the jump's dark, a new sector's opening), so nobody jumps.
        Once served, the day runs on from the meal: they finish eating and get up. The scene starts once they are seated. */
    function stepSupper(dt, t, inView) {
        const SUP = window.NSSupper;
        if (!SUP) return;
        const due = SUP.pending();
        if (due && V.routine.held == null && !inView) V.routine.held = SUPPER_AT;
        else if (!due && V.routine.held != null) { V.routine.off = V.routine.held - t; V.routine.held = null; }
        try { SUP.tick(dt, inView && V.routine.held != null, inView); } catch (err) { console.error('Tower: the supper failed', err); }
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The fit: tower px → device px (ts), the slide-in, the beat
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** BUILD_B §8. The shell's own numbers when it has them (G.ts, G.tTop, G.tLeft, G.tY0), else the same formula. */
    function computeFit(g) {
        const dpr = g.dpr || window.devicePixelRatio || 1, devW = Math.round(innerWidth * dpr), devH = Math.round(innerHeight * dpr);
        let ts, tTop = FRAME.TOP, tLeft = FRAME.LEFT, tY0;
        if (typeof g.ts === 'number' && g.ts > 0) {
            ts = g.ts; tTop = typeof g.tTop === 'number' ? g.tTop : tTop; tLeft = typeof g.tLeft === 'number' ? g.tLeft : tLeft;
            tY0 = typeof g.tY0 === 'number' ? g.tY0 : Math.round((devH - ROWS * ts) / 2);
        } else {
            ts = devH / ROWS;
            if ((HULL_OUT - tLeft) * ts > MAX_SHARE * devW) ts = MAX_SHARE * devW / (HULL_OUT - tLeft);
            tY0 = Math.round((devH - ROWS * ts) / 2);
        }
        const cut = ts === CUT_TS, extra = cut ? Math.max(0, Math.ceil(tY0 / ts)) : 0;   // the re-cut fills the height: more nose above, more bell below
        return { ts, tTop: tTop - extra, tLeft, tY0: tY0 - Math.round(extra * ts), rows: ROWS + 2 * extra, dpr, devW, devH, wDev: Math.ceil((HULL_OUT - tLeft) * ts), cut };
    }
    /** Tower px → CSS px, through the fit and the slide. */
    function toCss(wx, wy) {
        const f = V.fit;
        return [((wx - f.tLeft) * f.ts + V.slideX) / f.dpr, ((wy - f.tTop) * f.ts + f.tY0) / f.dpr];
    }
    /** A pointer (CSS px) → tower px. */
    function fromCss(cx, cy) {
        const f = V.fit;
        return [(cx * f.dpr - V.slideX) / f.ts + f.tLeft, (cy * f.dpr - f.tY0) / f.ts + f.tTop];
    }
    function slideK(t) {
        if (t < V.slide.closedUntil) return 0;
        if (V.slide.start == null) return 1;
        return ease((t - V.slide.start) / SLIDE_MS);
    }
    function closeTower(t, ms) { V.slide = { closedUntil: t + ms, start: t + ms }; }
    function openTower(t) { if (t < V.slide.closedUntil) V.slide = { closedUntil: t, start: t }; }

    function stepBeat(dt, t) {
        const E = V.Eshown, b = V.beat;
        if (V.stall && V.stall.reactorCold) { b.onsets = []; b.val = 0; return; }    // the reactor has gone cold: no beat at all
        const period = (MK.BEAT.FULL + (MK.BEAT.LOW - MK.BEAT.FULL) * clamp((100 - E) / 90, 0, 1)) * (1 - FEEL.beatAtSpeed * V.spd);   // faster in flight
        b.phase += dt / period;
        while (b.phase >= 1) {
            b.phase -= 1; b.n += 1;
            const missed = E < LOW_ENERGY && b.n % 4 === 3;                 // a missed beat in four below 25
            if (!missed) b.onsets = b.onsets.concat([t - b.phase * period]).slice(-3);
        }
        const last = b.onsets[b.onsets.length - 1], ms = last == null ? 1e9 : t - last;
        b.val = clamp(Math.exp(-ms / 140) + (ms > 230 ? 0.55 * Math.exp(-(ms - 230) / 150) : 0), 0, 1);
    }
    /** The core's level: the real energy, a step lower while engineering is red. */
    function setCore(E) {
        const lvl = V.stall && V.stall.reactorCold ? 0 : Math.round(V.real.engDown ? E * CORE_ENG_DOWN : E);
        if (lvl !== V.coreSet && A.reactor) { A.reactor.set(lvl); V.coreSet = lvl; }
    }
    function stepEnergy(dt, t) {
        const E = energy();
        if (V.E == null) { V.E = E; V.Eshown = E; }
        if (E > V.E + 4) V.flood = { kind: 'fill', t0: t };               // energy came back: the conduit fills upward
        V.E = E;
        V.Eshown += (E - V.Eshown) * (dt > 0 ? 1 - Math.exp(-dt / 220) : 0);
        setCore(E);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The ship feels the flight (window.NSTower): a tremor on the go, the landing and the jump's burn; the reactor beating
    // faster at speed; a red deck's lights stuttering when it is first seen broken; the crew's knees giving on a jolt.
    // Picture only. Calls are ignored while the tower is closed, sliding or dark (nothing is queued).
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const FEEL = Object.freeze({ beatAtSpeed: 0.3, speedTau: 400, speedStale: 150, burnFloor: 0.6, burnMs: 2250,
        hitKick: 0.5, braceMin: 0.3, braceDip: 3, braceIn: 80, braceOut: 250, flickMs: 360 });
    const STANDING = { idle: 1, console: 1, walk: 1, carry: 1, wall: 1, wave: 1, tend: 1 };
    const reduced = () => { const J = window.Juice; try { return !!(J && typeof J.reduced === 'function' && J.reduced()); } catch (err) { return false; } };
    function shaker() {
        const J = window.Juice;
        if (!V.shake && J && typeof J.shaker === 'function') V.shake = J.shaker({ max: [12, 6], roll: 0, decay: 1.8, hz: 10 });
        return V.shake;
    }
    /** The tower in view: open, slid in, not in the jump's dark. */
    const feels = () => !!V.fit && !V.dark && slideK(now()) >= 1;
    function jolt(s) {
        const a = clamp(Number(s) || 0, 0, 1), sh = shaker();
        if (!a || !feels()) return;
        if (sh) sh.add(a);
        if (a >= FEEL.braceMin) V.braceT = now();
    }
    function speed(k) {
        if (!feels()) return;
        V.spdIn = clamp(Number(k) || 0, 0, 1); V.spdAt = now();
    }
    function hitDeck(deck) {
        if (!DECKS.includes(deck) || !feels()) return;
        const sh = shaker(), t = now();
        if (sh) sh.add(FEEL.hitKick);
        V.braceT = t;
        V.flick = Object.assign({}, V.flick, { [deck]: t });
    }
    /** Once a frame: the speed eased (no calls: back to 0 within a second), the burn's rumble, the tremor stepped, a deck
        newly red felt on the first frame the tower is in view. */
    function stepFeel(dt, t) {
        const want = t - V.spdAt < FEEL.speedStale && feels() ? V.spdIn : 0;
        V.spd += (want - V.spd) * (dt > 0 ? 1 - Math.exp(-dt / FEEL.speedTau) : 0);
        const sh = shaker(), sv = V.stall;
        if (sh && V.burnT0 != null && !V.dark) sh.floor(FEEL.burnFloor * Math.pow(clamp((t - V.burnT0) / FEEL.burnMs, 0, 1), 2));
        if (sh && sv && sv.burn > 0 && !sv.stop && !sv.still) sh.floor(FEEL.burnFloor * sv.burn);   // the stall's burn, dying
        V.tremor = sh ? sh.tick(dt / 1000) : null;
        if (V.newRed.size && feels() && modeNow() === 'travel' && !(NS.blocked && NS.blocked())) {
            const list = [...V.newRed]; V.newRed = new Set();
            list.forEach(k => { if (V.real.decks[k] === 'red') hitDeck(k); });
        }
        if (Object.values(V.flick).some(t0 => t - t0 > FEEL.flickMs || t < t0)) V.flick = Object.fromEntries(Object.entries(V.flick).filter(([, t0]) => t - t0 <= FEEL.flickMs && t >= t0));
    }
    /** The knees give: standing people dip a few tower px, 0 → 1 in 80 ms, back over 250 ms; copies, never the routine's own. */
    function braced(list, t) {
        const age = V.braceT == null ? 1e9 : t - V.braceT;
        if (age < 0 || age >= FEEL.braceIn + FEEL.braceOut) return list;
        const k = age < FEEL.braceIn ? ease(age / FEEL.braceIn) : 1 - ease((age - FEEL.braceIn) / FEEL.braceOut);
        const dip = FEEL.braceDip * k * (reduced() ? 0.5 : 1);
        return list.map(p => (STANDING[p.act] ? Object.assign({}, p, { y: p.y + dip }) : p));
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The module
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function canvas() {
        if (!V.cv || !V.cv.isConnected) { V.cv = document.getElementById('ns-ship'); V.ctx = V.cv ? V.cv.getContext('2d') : null; }
        const cut = !!(V.fit && V.fit.cut), rows = V.fit ? V.fit.rows : ROWS;   // the re-cut reads the drawn tower back every frame: kept in memory
        if (!V.off || V.offCut !== cut || V.off.height !== rows) {
            V.off = document.createElement('canvas'); V.off.width = OFF_W; V.off.height = rows; V.offCtx = V.off.getContext('2d', { willReadFrequently: cut }); V.offCut = cut; V.cutAt = null;
            V.cutCv = cut ? Object.assign(document.createElement('canvas'), { width: OFF_W >> 1, height: rows >> 1 }) : null;
        }
        return V.cv;
    }
    function init() {
        if (V.inited) return;
        V.inited = true;
        canvas();
        nameStyle();
        V.jobs = TW.warm();
        const bus = NS.bus;
        bus.on('shown', p => onShown(p || {}));
        bus.on('hidden', () => { closeKeys(); ST.state = null; });          // the view back later: the stock is read afresh, no flash
        bus.on('hud', () => { V.dirty = true; });
        bus.on('opening:done', () => openTower(now()));
        bus.on('jump:burn', () => { V.flood = { kind: 'jump', t0: now() }; V.burnT0 = now(); closeKeys(); });
        bus.on('jump:flash', () => { V.dark = true; V.burnT0 = null; });
        IDS.forEach(id => NS.anchors.set('person:' + id, () => {
            const a = personAt(id);
            if (!a) return [];
            const y = rowTop(id, a.y), f = V.fit;
            return [{ x: a.x, y, side: 'above', align: 'center' }, { x: a.x + 20, y: a.y + 30, side: 'right' }, { x: Math.max(20, (f.wDev + V.slideX) / f.dpr + 12), y: a.y, side: 'right' }];
        }));
        DECKS.forEach((name, i) => NS.anchors.set('tower:deck:' + name, () => deckAnchor(i)));
        document.addEventListener('pointerdown', e => { const K = KEY(); if (K && K.repair.isOpen() && !(e.target.closest && e.target.closest('.nsk-repair'))) K.repair.close(); }, true);
        readReal(now());
    }
    function onShown(p) {
        const t = now();
        V.dirty = true;
        V.dark = false;
        V.burnT0 = null;
        if (p.first) closeTower(t, OPEN_FALLBACK_MS);                       // a new sector: from black, the title; then the tower
    }
    function deckAnchor(i) {
        if (!V.fit || slideK(now()) < 1 || V.dark) return [];
        const [cx, cy] = toCss(460, A.deckTop(i) + 60);
        return [{ x: cx, y: cy, side: 'above', align: 'center' }];
    }
    function resize(g) {
        const cv = canvas();
        if (!g || !g.W) return;
        V.fit = computeFit(g);
        closeKeys();
        canvas();                                                           // the re-cut on or off: a new offscreen
        if (!cv) return;
        const f = V.fit, w = f.wDev + 2;
        if (cv.width !== w) cv.width = w;
        if (cv.height !== f.devH) cv.height = f.devH;
        cv.style.width = (w / f.dpr) + 'px'; cv.style.height = (f.devH / f.dpr) + 'px';
        cv.style.imageRendering = f.cut ? 'pixelated' : 'auto';
    }
    function update(dt, t) {
        const job = V.jobs.shift();
        if (job) { try { job(); } catch (err) { console.error('Tower: a warm job failed', err); } }
        const g = G();
        if (!g.H || !V.fit) return;
        V.stall = stallView();
        if (V.dirty || t - V.readAt > READ_MS || t < V.readAt) readReal(t);
        stepEnergy(dt, t);
        stepFeel(dt, t);
        stepBeat(dt, t);
        if (V.flood && MK.floodDone({ t, flood: V.flood })) V.flood = null;
        if (V.slide.start != null && t >= V.slide.start + SLIDE_MS) V.slide = { closedUntil: 0, start: null };
        if (!V.stall) stepSupper(dt, t, slideK(t) >= 1 && !V.dark && modeNow() === 'travel' && !(NS.blocked && NS.blocked()));
        stepRestless(t, slideK(t) > 0 && !V.dark && modeNow() === 'travel' && !(NS.blocked && NS.blocked()));
        V.people = peopleNow(t);
        const ok = !V.stall && !V.dark && slideK(t) >= 1 && modeNow() === 'travel' && !(NS.blocked && NS.blocked()), K = KEY();
        if (K) K.repair.tick(ok && V.real.decks[K.repair.deck()] === 'red');   // the repair plate stays docked, or goes
        placeName(ok);
        if (!V.stall) tellRed();
        if (V.stall || modeNow() !== 'travel' || V.dark || slideK(t) < 1 || (NS.blocked && NS.blocked())) placeStock(false);   // never over a card or a minigame; out with the power
        stockTick();
    }
    function render(t) {
        const c = V.ctx, o = V.offCtx, f = V.fit;
        if (!c || !o || !f) return;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, V.cv.width, V.cv.height);
        const k = slideK(t);
        if (V.dark || k <= 0) { V.drawn = []; V.cutAt = null; return; }
        V.slideX = Math.round(-(1 - k) * (f.wDev + 12));
        const live = k >= 1 && !V.stall && modeNow() === 'travel' && !(NS.blocked && NS.blocked());
        if (f.cut && V.cutCv && V.cutAt != null && t >= V.cutAt && t - V.cutAt < CUT_STEP_MS && V.cutKey === cutKey()) { blitCut(c, f); placeStock(live); return; }   // between the art's steps: the last cut
        o.setTransform(1, 0, 0, 1, 0, 0);
        o.clearRect(0, 0, OFF_W, f.rows);
        o.imageSmoothingEnabled = false;
        const sv = V.stall, lit = sv ? V.people.filter(p => p.lit) : [], others = (sv ? V.people.filter(p => !p.lit) : V.people).map(p => (p.id === V.hotId ? Object.assign({}, p, { hot: true }) : p));
        const fxOff = sv ? sv.dark.map(d => d >= 0.5) : null;
        TW.draw(o, { t, camY: f.tTop, offX: -f.tLeft, W: OFF_W, H: f.rows, people: braced(others, t), auraTalking: auraTalking() && !sv, fxOff, driveOff: !!(sv && sv.cold) });
        if (!sv) lowArt(o, f);                                             // the bare galley cupboard (low rations), the galley's light at a death
        V.drawn = TW.drawn.slice();
        const sunY = (0.4 * f.devH - f.tY0) / f.ts;                       // level with the light (Field's light sits at 40 % of the height)
        const view = { t, G: { W: OFF_W, H: f.rows }, offX: -f.tLeft, cam: f.tTop, decks: V.real.decks, engDown: V.real.engDown, E: V.Eshown, beat: V.beat,
            flood: V.flood, sunY, fix: V.real.datable && !sv ? SLATE : null, flick: V.flick, reduced: reduced(), cold: !!(sv && sv.reactorCold) };
        MK.draw(o, view); if (!sv && window.NSTowerCard) window.NSTowerCard.draw(o, view, V.people);   // a card up: its room lit; a fault's flash (B03, tower/TowerCard.js)
        if (sv && window.NSStallArt) {                                     // the stall: the dead decks, their red lamps, the crew in that light
            window.NSStallArt.draw(o, { camY: f.tTop, offX: -f.tLeft, W: OFF_W, H: f.rows, t, dark: sv.dark, red: sv.red, still: sv.still });
            if (lit.length) { TW.drawPeople(o, { t, camY: f.tTop, offX: -f.tLeft, W: OFF_W, H: f.rows }, lit, window.NSStallArt.lit); V.drawn = TW.drawn.slice(); }
        }
        const s0 = performance.now(), sh = V.tremor;                          // the tremor: smooth-scaled, so not rounded (the re-cut: whole px)
        if (f.cut && V.cutCv) {                                             // 1366 x 768, 1280 x 720: the re-cut at 1/2, never smoothed
            try { TW.cut(o, V.cutCv, { offX: -f.tLeft, camY: f.tTop }); } catch (err) { console.error('Tower: the re-cut failed', err); }
            V.cutMs = V.cutMs == null ? performance.now() - s0 : V.cutMs * 0.9 + (performance.now() - s0) * 0.1;   // what one cut costs (debug)
            V.cutAt = t; V.cutKey = cutKey();
            blitCut(c, f);
        } else {
            c.imageSmoothingEnabled = true;
            c.imageSmoothingQuality = V.quality;
            c.drawImage(V.off, 0, 0, OFF_W, f.rows, V.slideX + (sh ? sh.dx * f.ts : 0), f.tY0 + (sh ? sh.dy * f.ts : 0), OFF_W * f.ts, f.rows * f.ts);
            watchScale(performance.now() - s0);
        }
        placeStock(live);
    }
    /** The re-cut is made at the art's 8 fps (CUT_STEP_MS); at once when who is pointed at, the real state (read every 500 ms
        or on news) or the galley's light changes. */
    function cutKey() { const S = window.NSSupper; return V.hotId + '|' + V.readAt + '|' + (S && typeof S.dim === 'function' ? S.dim() : 0); }
    function blitCut(c, f) {
        const sh = V.tremor;
        c.imageSmoothingEnabled = false;
        c.drawImage(V.cutCv, Math.round(V.slideX + (sh ? sh.dx * f.ts : 0)), Math.round(f.tY0 + (sh ? sh.dy * f.ts : 0)));
    }
    /** 'high' scaling where it is cheap (a GPU canvas); a machine where it costs over 3 ms a frame on average gets 'low'
        (bilinear: at these scales the two look nearly the same, checked at 1080p and 720p). */
    function watchScale(ms) {
        if (V.quality !== 'high' || V.scaleN >= SCALE_PROBE) return;
        V.scaleN += 1; V.scaleMs += ms;
        if (V.scaleN === SCALE_PROBE && V.scaleMs / SCALE_PROBE > SCALE_SLOW_MS) V.quality = 'low';
    }
    function auraTalking() {
        const voice = NS && NS.mods && NS.mods.voice;
        if (voice && typeof voice.speaking === 'function') { try { return voice.speaking() === 'aura'; } catch (err) { return false; } }
        return false;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // Input: a person, Mira's bench while a fix waits, a red deck. The wheel does nothing (the whole tower is in view).
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function hit(e) {
        if (!V.fit) return null;
        const [fx, fy] = fromCss(e.clientX, e.clientY), wx = Math.round(fx), wy = Math.round(fy);   // whole tower px (TowerArt reads sprite pixels by index)
        const who = TW.hitPerson(wx - V.fit.tLeft, wy - V.fit.tTop);
        if (who) return who === 'mira' && V.real.datable ? { what: 'bench', id: 'mira' } : { what: 'person', id: who };
        const deck = Math.floor((wy - L.TOP0) / L.PITCH), local = wy - A.deckTop(deck);
        if (deck < 0 || deck >= L.N || wx < L.IL - 2 || wx > L.IR + 2 || local >= F) return null;
        if (deck === BENCH.deck && V.real.datable && wx >= BENCH.x0 && wx < BENCH.x1 && local >= BENCH.y0) return { what: 'bench', id: 'bench' };
        const name = DECKS[deck];
        if (V.real.decks[name] === 'red' && GAME_KEY[name]) return { what: 'deck', id: name };
        return null;
    }
    function flowCall(name, ...args) {
        const fl = NS && NS.flow;
        if (!fl || typeof fl[name] !== 'function') return undefined;
        try { return fl[name](...args); } catch (err) { console.error('Tower: flow.' + name + ' failed', err); return undefined; }
    }
    function pointer(type, e) {
        const t = now();
        if (type === 'wheel') return false;                                // the whole tower is in view: nothing to scroll
        if (type === 'leave' || V.dark || V.stall || slideK(t) < 1 || modeNow() !== 'travel') { V.hover = null; V.hotId = null; pointRepair(null); pointSupper(null); return false; }
        const h = hit(e), SUP = window.NSSupper, K = KEY();
        const who = h && (h.what === 'person' || h.what === 'bench') && IDS.includes(h.id) ? h.id : null;
        if (who && SUP && SUP.choosing()) {                                // supper, short of food: pointing shows them in the plate, a click picks them
            V.hotId = type === 'move' ? who : null; V.tagOff = true; pointRepair(null);   // the rim shows who; the plate names them (no tag)
            if (type === 'move') { V.hover = h; return pointSupper(who); }
            if (type === 'down') { pointSupper(null); return SUP.pick(who); }
            return false;
        }
        if (type === 'move') pointSupper(null);
        if (who && SUP && typeof SUP.atTable === 'function' && SUP.atTable()) {   // the table moment waits: a click on the crew shows it again
            if (type === 'move') { V.hover = h; V.hotId = null; return true; }
            if (type === 'down' && typeof SUP.reshow === 'function') SUP.reshow();
            return type === 'down';
        }
        if (type === 'move') {
            V.hover = h; V.tagOff = false; V.hotId = h && (h.what === 'person' || h.id === 'mira') ? (who || h.id) : null;
            pointRepair(h && h.what === 'deck' ? h.id : null, e);
            return !!h;
        }
        if (type !== 'down' || !h) return false;
        if (h.what === 'person') {
            const p = V.people.find(q => q.id === h.id), c = V.real.crew[h.id] || {};
            flowCall('person', h.id, p ? p.say : null, { status: c.status || 'well', weak: !!c.weak });   // the line by their state (ShipRoutine.line)
        } else if (h.what === 'bench') flowCall('bench');
        else if (h.what === 'deck' && K) { K.repair.open(h.id, { x: e.clientX, y: e.clientY }); V.hotId = null; }
        return true;
    }
    /** Pointing at a red deck (not while its plate is open): its name and its one rule chip where the plate will open. */
    function pointRepair(deck, e) {
        const K = KEY();
        if (!K || K.repair.isOpen()) return;
        K.repair.point(deck, e ? { x: e.clientX, y: e.clientY } : null);
    }
    function pointSupper(id) {
        const SUP = window.NSSupper;
        if (!SUP || typeof SUP.point !== 'function') return false;
        return SUP.point(id);
    }
    function closeKeys() { const K = KEY(); if (K) K.repair.close(); V.hotId = null; placeName(false); }

    // ── the name tag over whoever is pointed at: the who style (a ring, the name in caps, their tone) ──
    function wordsLayer() {
        if (!V.words || !V.words.isConnected) V.words = document.getElementById('ns-ship-words');
        return V.words;
    }
    function placeName(ok) {
        const v = NS.mods && NS.mods.voice, says = v && typeof v.speaking === 'function' ? v.speaking() : null;
        const id = ok && !V.tagOff && V.hotId !== says ? V.hotId : null, a = id ? personAt(id) : null, layer = wordsLayer();   // their voice line names them: no second name
        if (!a || !layer) { if (V.name) V.name.el.classList.remove('is-in'); return; }
        if (!V.name || !V.name.el.isConnected) {
            nameStyle();
            const el = document.createElement('p'); el.className = 'nst-name'; el.setAttribute('aria-hidden', 'true');
            layer.append(el); V.name = { el, id: null, pos: '' };
        }
        const N = V.name;
        if (N.id !== id) { N.id = id; N.el.className = 'nst-name tone-' + id; N.el.innerHTML = '<i></i>' + (SIM.NAMES[id] || id); N.w = N.el.offsetWidth; N.h = N.el.offsetHeight; }
        const pos = `translate(${Math.round(a.x - N.w / 2)}px, ${Math.round(a.y - N.h - 10)}px)`;
        if (N.pos !== pos) { N.pos = pos; N.el.style.transform = pos; }
        N.el.classList.add('is-in');
    }
    function nameStyle() {
        if (document.getElementById('ns-tower-style')) return;
        const st = document.createElement('style'); st.id = 'ns-tower-style';
        st.textContent = `#ns-ship-words .nst-name { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: var(--s2); margin: 0; pointer-events: none; white-space: nowrap;
    font: 500 var(--fs-who)/1 var(--f-ui); letter-spacing: .18em; text-transform: uppercase; color: var(--tone, var(--ui)); text-shadow: var(--shadow), var(--halo), var(--halo);
    opacity: 0; transition: opacity calc(var(--step-ui) * 2) steps(2, end); }
#ns-ship-words .nst-name.is-in { opacity: 1; }
#ns-ship-words .nst-name i { flex: none; width: .82em; height: .82em; box-sizing: border-box; border: 1px solid currentColor; border-radius: 50%; }
@media (prefers-reduced-motion: reduce) { #ns-ship-words .nst-name { transition: none; } }`;
        document.head.appendChild(st);
    }
    /** The art carries the low stock (C26): the galley cupboard open and bare while rations are low; and the galley's light two
        steps down while a death at the table is told (tower/Supper.js dim()). Tower art px into the offscreen. */
    const CUPBOARD = { x0: 238, x1: 300, y0: F - 150, y1: F - 114, mid: 268 }, BEAT_DIM = 0.24;
    function lowArt(o, f) {
        const R = A.R, x = v => v - f.tLeft, y = v => A.deckTop(2) + v - f.tTop;
        if (ST.val.rations != null && ST.val.rations <= STOCK_LOW.rations && !isRed(2)) {
            const c = CUPBOARD;
            o.fillStyle = R.WALL.hex[0]; o.fillRect(x(c.x0), y(c.y0), c.x1 - c.x0, c.y1 - c.y0);
            o.fillStyle = R.STEEL.hex[2]; [12, 24].forEach(dy => o.fillRect(x(c.x0), y(c.y0 + dy), c.x1 - c.x0, 1));
            o.fillRect(x(c.mid), y(c.y0), 2, c.y1 - c.y0);
        }
        const SUP = window.NSSupper, steps = SUP && typeof SUP.dim === 'function' ? SUP.dim() : 0;
        if (steps > 0) {
            o.save(); o.globalAlpha = Math.min(1, BEAT_DIM * steps); o.fillStyle = A.INK || '#05070a';
            o.fillRect(x(L.IL), A.deckTop(2) - f.tTop, L.IR - L.IL, F); o.restore();
        }
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The ship's stock: small lit numbers beside the rooms they belong to (here) and on the bridge wall (Stop.js)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const STOCK_KEYS = Object.freeze(['energy', 'rations', 'salvage', 'data']);
    const STOCK_LOW = { energy: 20, rations: 4, salvage: -1, data: -1 };     // at or under: low (--loss, its glow blinking; the art: lowArt)
    /** Rations low, said once a run: how many jumps they last (L-14, C30: the four lines that taught the stock are gone). */
    function rationsLine(r) {
        const s = call('state', null), need = s && typeof s.supperNeed === 'function' ? s.supperNeed() : 0;
        return RATIONS_LINE(r, need > 0 ? Math.floor(r / need) : 0);
    }
    const RATIONS_LINE = (r, j) => (j >= 1 ? `We have ${r} rations. That's ${j === 1 ? 'one jump' : j + ' jumps'}, Commander.` : `We have ${r} rations. That's less than one jump, Commander.`);   // DRAFT (look pass): L-14
    const STOCK_FLASH_MS = 1600, STOCK_SETTLE_MS = 1300;
    // where each sits in the tower (tower art px, top-left; align 'right': top-right): by the reactor's top, over the galley
    // table, over the crates, in the lab over its cabinet (right-aligned to the lab's wall, so a longer number grows inward)
    const STOCK_AT = { energy: { deck: 5, x: 498, y: 50 }, rations: { deck: 2, x: 424, y: 38 }, salvage: { deck: 4, x: 500, y: 44 }, data: { deck: 1, x: 638, y: 38, align: 'right' } };
    const ST = { state: null, val: {}, flash: {}, seenAt: null };                     // seenAt: since when the numbers have been in view
    function stockTick() {
        const s = call('state', null);
        if (!s) return;
        const now = { energy: Math.round(energy()), rations: Math.round(Number(s.rations) || 0), salvage: Math.round(Number(s.salvage) || 0),
            data: Math.round(Number(s._colonyKnowledge) || 0) };                          // data: what the crew has learned (GameState._colonyKnowledge)
        if (s !== ST.state) { ST.state = s; ST.val = now; ST.flash = {}; return; }        // a new run, or the view back: read afresh
        if (!stockSeen()) { ST.seenAt = null; return; }                                   // out of sight (a card, a minigame, the dive): the change waits to be seen
        if (ST.seenAt == null) ST.seenAt = performance.now();
        if (performance.now() - ST.seenAt < STOCK_SETTLE_MS) return;                      // in view a moment first: a follow-up card often opens just after one closes
        STOCK_KEYS.forEach(k => {
            const d = now[k] - ST.val[k];
            if (!d) return;
            ST.val = Object.assign({}, ST.val, { [k]: now[k] });
            ST.flash = Object.assign({}, ST.flash, { [k]: { at: performance.now(), d } });
            const v = NS.mods && NS.mods.voice;
            if (k === 'rations' && d < 0 && now.rations <= STOCK_LOW.rations && v && typeof v.once === 'function') v.once('stock:rations-low', rationsLine(now.rations)).catch(err => console.error('NSStock: the voice failed', err));
        });
    }
    /** Are the numbers in view now (the tower's or the bridge wall's, nothing over them)? */
    function stockSeen() {
        if (NS.blocked && NS.blocked()) return false;
        return !!document.querySelector('#ns-root .nss.on');
    }
    function stockStyle() {
        if (document.getElementById('ns-stock-style')) return;
        const st = document.createElement('style'); st.id = 'ns-stock-style';
        st.textContent = `#ns-root .nss { position: absolute; left: 0; top: 0; display: flex; align-items: baseline; gap: 0.4em; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity calc(var(--step-ui) * 4) steps(4, end); }
#ns-root .nss.on { opacity: 1; }
#ns-root .nss b { font: 400 calc(17px + 2px * var(--t))/1 var(--f-num); color: var(--ui); text-shadow: var(--shadow), var(--halo); }
#ns-root .nss span { font: 400 var(--fs-chip)/1 var(--f-text); color: var(--dim); text-shadow: var(--shadow), var(--halo); }
#ns-root .nss i { position: absolute; left: 100%; margin-left: 0.4em; font: 400 var(--fs-floor)/1 var(--f-num); font-style: normal; opacity: 0; text-shadow: var(--shadow), var(--halo); transition: opacity calc(var(--step-ui) * 2) steps(2, end); }
#ns-root .nss.is-low b, #ns-root .nss.is-low span { color: var(--loss); }
#ns-root .nss.is-low b { animation: nss-low 1600ms steps(1, end) infinite; }
@keyframes nss-low { 50% { text-shadow: var(--shadow), var(--halo), 0 0 8px var(--loss); } }
#ns-root .nss.is-up b, #ns-root .nss.is-up i { color: var(--warm-br); }
#ns-root .nss.is-down b, #ns-root .nss.is-down i { color: var(--loss); }
#ns-root .nss.is-up i, #ns-root .nss.is-down i { opacity: 1; }
@media (prefers-reduced-motion: reduce) { #ns-root .nss, #ns-root .nss i { transition: none; } #ns-root .nss.is-low b { animation: none; } }`;
        document.head.appendChild(st);
    }
    /** The readouts (one per STOCK_KEYS) in a word layer. Each frame put() writes only what changed (text, class, place). */
    function stockBoard(layer) {
        stockStyle();
        const items = {};
        STOCK_KEYS.forEach(k => {
            const el = document.createElement('div'), b = document.createElement('b'), w = document.createElement('span'), i = document.createElement('i');
            el.className = 'nss'; el.dataset.stock = k; w.textContent = k;
            el.append(b, w, i); layer.append(el);
            items[k] = { el, b, i, text: '', cls: '', pos: '', w: 0 };
        });
        function paint(it, k) {
            const v = ST.val[k], f = ST.flash[k], fresh = f && performance.now() - f.at < STOCK_FLASH_MS;
            const text = v == null ? '' : String(v), delta = fresh ? (f.d > 0 ? '+' : '−') + Math.abs(f.d) : '';
            const cls = (fresh ? (f.d > 0 ? ' is-up' : ' is-down') : '') + (v != null && v <= STOCK_LOW[k] ? ' is-low' : '');
            if (it.text !== text) { it.b.textContent = text; it.text = text; it.w = 0; }
            if (delta && it.i.textContent !== delta) it.i.textContent = delta;     // kept after the flash, faded out
            if (it.cls !== cls) { ['is-up', 'is-down', 'is-low'].forEach(c => it.el.classList.toggle(c, cls.includes(c))); it.cls = cls; }
        }
        return {
            put(k, x, y, align) {
                const it = items[k];
                if (!it) return;
                paint(it, k);
                if (!it.w) it.w = it.el.offsetWidth;
                const pos = `translate(${Math.round(align === 'right' ? x - it.w : x)}px, ${Math.round(y)}px)`;
                if (it.pos !== pos) { it.el.style.transform = pos; it.pos = pos; }
                it.el.classList.add('on');
            },
            hide() { STOCK_KEYS.forEach(k => items[k].el.classList.remove('on')); },
        };
    }
    /** The tower's own readouts, beside their rooms (only in travel, the tower in, not in the dark of a jump). */
    function placeStock(show) {
        if (!V.stock) { const layer = wordsLayer(); if (!layer) return; V.stock = stockBoard(layer); }
        if (!show) { V.stock.hide(); return; }
        STOCK_KEYS.forEach(k => { const a = STOCK_AT[k], [x, y] = toCss(a.x, A.deckTop(a.deck) + a.y); V.stock.put(k, x, y, a.align); });
    }
    window.NSStock = Object.freeze({ KEYS: STOCK_KEYS, tick: stockTick, board: stockBoard });

    // ── what others read ──
    function occupied() {
        const on = [false, false, false, false, false, false];
        V.people.forEach(p => { if (p.deck >= 0 && p.deck < 6) on[p.deck] = true; });
        return on;
    }
    function beat() { return V.beat.val; }
    /** The highest head (CSS y) among the people on the same floor as this one. */
    function rowTop(id, y) {
        const me = V.drawn.find(p => p.id === id);
        if (!me) return y;
        return V.drawn.filter(p => Math.abs(p.y - me.y) < 8).reduce((m, p) => { const q = personAt(p.id); return q ? Math.min(m, q.y) : m; }, y);
    }
    function personAt(id) {
        const d = V.drawn.find(p => p.id === id);
        if (!d || !V.fit) return null;
        const head = d.act === 'sleep' || d.act === 'awake' ? d.y - 26 : d.act === 'sit' ? d.y - 84 : d.y - 104;
        const [x, y] = toCss(d.x, head);
        if (x < 0 || y < -10 || y > V.fit.devH / V.fit.dpr) return null;
        return { x, y };
    }
    function fit() { return V.fit ? Object.assign({}, V.fit) : null; }
    function debug() {
        return { fit: fit(), quality: V.quality, k: slideK(now()), dark: V.dark, E: V.E, decks: Object.assign({}, V.real.decks), datable: V.real.datable,
            crew: JSON.parse(JSON.stringify(V.real.crew)), people: V.people.map(p => ({ id: p.id, deck: p.deck, x: p.x, act: p.act, say: p.say })),
            chips: KEY() ? KEY().repair.deck() : null, plate: KEY() ? KEY().repair.state() : null, hot: V.hotId, cut: !!(V.fit && V.fit.cut), cutMs: V.cutMs == null ? null : Math.round(V.cutMs * 10) / 10, stock: Object.assign({}, ST.val), restless: (V.routine.restless || []).slice(),
            feel: { trauma: V.shake ? V.shake.level() : null, speed: V.spd, flick: Object.keys(V.flick), off: V.tremor ? { dx: V.tremor.dx, dy: V.tremor.dy } : null } };
    }
    window.NSTower = Object.freeze({ jolt, speed, hit: hitDeck });

    const mod = Object.freeze({ init, resize, update, render, pointer, occupied, beat, personAt, fit, debug });
    function attach() {
        NS = window.NewScreen;
        if (!NS) { console.error('Tower: NewScreen is missing; the tower is not registered'); return; }
        if (typeof NS.register === 'function') NS.register('tower', mod);
        else if (NS.mods) NS.mods.tower = mod;
    }
    if (window.NewScreen) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
})();
