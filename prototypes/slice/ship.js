/* Silent Exodus · sector 1 slice · the tower: the living ship beside the journey (docs/SLICE_SPEC.md §2, §7.2, §8 steps 1, 3, 4).
   OWNER: the ship builder. Draws ONLY into canvas#ship (transparent outside the hull, so the journey shows round it and
   through its windows) and the DOM layer #ship-words (the three chips of a red deck). Never touches canvas#world.
   Reuses by loading (never copied, never edited): crew-hires/engine.js + the five person files (CrewEngine), ship-art.js
   (ShipArt: decks, nose, tail, SPOTS), ship-rooms.js, ship-reactor.js (ShipArt.reactor.set), layouts/variant-a/sim-a.js
   (ShipSimA.at('travel', t): the crew's day) and tower.js (TowerA.draw(ctx, o), TowerA.hitPerson(ax, ay), TowerA.drawn).
   People are ShipSimA's poses with overrides from Slice.state (away: not drawn; hurt: in the med-bay bed, off frame; Vance
   at the galley porthole while his sign is on; Jaxon down in engineering while his ask is open; Mira at her bench while
   the fix waits; everyone at the table for the meal), passed to TowerA.draw as o.people.

   window.Slice.mods.ship = {
     init()                      once: TowerA.warm() jobs (one a frame), the chips' layer
     resize(G)                   size canvas#ship like canvas#world; the frame is rows [floorY(2) + 12 - H, floorY(2) + 12]
     update(dt, t)               the beat, the charge in the conduit, the camera, the slide-in, meal:done
     render(t)                   TowerA.draw, then the walls (plates, pages, book, tools, the fix), red decks, the conduit
     pointer(type, e, ax, ay)    on the tower side (ax < G.hull): move | down | leave | wheel; true if it used it
     goto(moment)                reset the local picture (camera, charge, slide-in); state is re-read on 'mockup:goto'
     occupied()                  → [6 booleans]: someone on deck i now (the outside Lander's lit ports)
     beat(t)                     → 0..1: the reactor's pulse now (world.js lights the ports and the plume with it)
     personAt(id)                → { x, y } CSS px over that person's head, or null if not in view
   }
   Emits:   'ship:click' { what: 'person' | 'bench' | 'reactor' | 'deck', id, say? }   'deck:choice' { deck, choice }
            'meal:done' {} when the bowls have been on the table 6 s.
   Listens: 'price:preview'  'route:go' / 'route:cancel'  'route:fired'  'res:changed'  'deck:ask'  'jump:start'
            'meal:start'  'sector:arrive'  'opening:done'  'dive:start'  'mockup:goto'  'price:changed' (the chips' cost line)
   Registers anchors (Slice.anchors, CSS px): 'person:<id>' for the five, and 'tower:bench', 'tower:conduit',
   'tower:galley', 'tower:deck:<name>' for words about things aboard.
   Reads (never writes) Slice.state: mode, res.energy, crew[id].status / .moment / .ask, decks, flags.fixOn ('bench') /
   dated / plates, pinned, price. The chips' words come from script.js (deck:ask's chips, or script.deckChips(deck)). Everything drawn is a function of that state and the slice clock. */
(function () {
    'use strict';
    const Slice = window.Slice, A = window.ShipArt, L = A.L, R = A.R, TW = window.TowerA, SIM = window.ShipSimA, CE = window.CrewEngine;
    const { bay, hash, fbm, level, painter } = A.api;
    const INK = A.INK, F = L.DECK_FLOOR, DESK = CE.ACTIONS.console.desk;
    const IDS = ['cora', 'jaxon', 'aris', 'vance', 'mira'];
    const DECKS = ['bridge', 'lab', 'quarters', 'medbay', 'hold', 'engineering'];
    const HULL_OUT = L.CX + L.HO + 9;                                  // the tower's outside edge in its own art px (669)
    const S = () => Slice.state;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);

    // ── where things are, in the tower's own art px (deck-local rows: 0 = the deck's top, F = 190 the floor) ──
    const CONDUIT = { X: L.IR - 6, JY: A.floorY(0) - 40, JX: 601, EX: 580 };   // from the reactor's pipe, up the inner hull wall, left into the nav console
    const SPOT = Object.assign({}, A.SPOTS, { port2: { deck: 2, x: 330, facing: 1 }, mealStand: { deck: 2, x: 546, facing: -1 } });
    const MEAL = { cora: 'seatR2', mira: 'seatR1', jaxon: 'seatL2', aris: 'seatL1', vance: 'mealStand' };
    /** Four seats, five people: Vance leans in the bunk-room doorway, unless someone's seat is empty (hurt or away). Integrator. */
    function seatOf(id, st) {
        if (id !== 'vance') return [MEAL[id], 'sit'];
        const free = ['mira', 'jaxon', 'aris', 'cora'].find(c => st.crew[c] && st.crew[c].status !== 'well');
        return free ? [MEAL[free], 'sit'] : ['mealStand', 'idle'];
    }
    const LAMPS = { 0: [[540, 26, 52], [250, 26, 52]], 1: [[470, 26, 52], [270, 26, 52]], 2: [[590, 26, 52], [405, 82, 62]],
        3: [[590, 26, 52], [360, 26, 52]], 4: [[480, 26, 52], [250, 26, 52]], 5: [[610, 26, 52], [200, 26, 52]] };   // [x, y, reach]: first goes out on red, both on worse
    const HOLE = { 0: [614, 112], 1: [586, 56], 2: [515, 100], 3: [560, 60], 4: [560, 60], 5: [580, 44] };
    const RED_LAMP = i => [626, i === 0 ? 100 : 30];                    // the bridge's top is above the frame
    const BENCH = { x0: 380, x1: 560, y0: F - DESK - 34 };             // Mira's bench (deck 1)
    const SLATE = { x: 440, y: F - DESK - 6 };                          // the fix, waiting on the bench
    const TABLE_Y = F - 42;                                             // the galley table's top (deck 2)
    const BEAT = { FULL: 1100, LOW: 1500, RISE: 0.9 };                  // ms per beat at 100 and 10 energy; pulse rows per ms
    const CHARGE = { SPEED: 0.12, SETTLE: 400 };                        // 120 rows a second; settles back in 0.4 s
    const MEAL_DONE_MS = 6000, CHIP_GUARD_MS = 400, SLIDE_MS = 1200;

    // ── this module's own picture state (never Slice.state) ──
    const V = {
        cv: null, ctx: null, words: null, jobs: [],
        cam: null, manual: null, offX: 0, people: [], drawn: [],
        slide: { closedUntil: 0, start: null },
        beat: { phase: 0, n: 0, val: 0, onsets: [] },
        E: 100, Eshown: 100, charge: null, fire: null, flood: null, flicker: null,
        mealT: null, mealSent: false, chips: null, lastPointer: null, hover: null,
    };

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // People: the crew's day, bent by the story
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function stay(id, name, act, t, say) {
        const s = SPOT[name];
        const lying = act === 'sleep';
        return { id, deck: s.deck, x: s.x, y: A.floorY(s.deck) - (lying ? s.h || 0 : 0), act, facing: s.facing, ms: t, say: say || act,
            z: lying ? 1 : act === 'sit' && (name === 'seatL2' || name === 'seatR2') ? 1.5 : 2 };
    }
    const fixWaiting = st => st.flags.fixOn === 'bench' && !st.flags.dated;   // 'carried' / 'late': not on the bench yet
    const vanceSign = st => st.crew.vance.moment === 'open';
    const jaxonSign = st => st.crew.jaxon.ask === 'open';
    function override(p, st, t) {
        const c = st.crew[p.id] || {};
        if (c.status === 'away') return null;
        if (c.status === 'hurt') return stay(p.id, 'patient', 'sleep', t, 'hurt');
        if (c.status === 'shut') return stay(p.id, 'holdWall', 'wall', t, 'shut');
        if (p.id === 'vance' && vanceSign(st)) return stay('vance', 'port2', 'idle', t, 'sign');       // his bridge seat empty
        if (p.id === 'jaxon' && jaxonSign(st)) return stay('jaxon', 'gauges', 'idle', t, 'sign');      // his galley seat empty, at the meal too
        if (st.mode === 'meal') { const [seat, act] = seatOf(p.id, st); return stay(p.id, seat, act, t, 'meal'); }
        if (p.id === 'mira' && fixWaiting(st) && !['red', 'worse'].includes(st.decks.lab)) return Object.assign(stay('mira', 'bench', 'console', t, 'bench'), { screen: true });
        // integrator: nobody stays in a sealed deck (red or worse: no air); they wait in the galley instead
        if (p.deck !== 2 && ['red', 'worse'].includes(st.decks[DECKS[p.deck]]) && !['walk', 'climb', 'carry'].includes(p.act)) { const [seat, act] = seatOf(p.id, st); return stay(p.id, seat, act, t, 'sealed'); }
        return p;
    }
    /** Two people standing on one spot: the one the story moved keeps it; the routine one steps aside. */
    function unstack(list, moved) {
        return list.map(p => {
            if (moved.has(p.id) || p.act === 'walk' || p.act === 'carry' || p.act === 'climb') return p;
            const clash = list.find(q => q !== p && moved.has(q.id) && q.deck === p.deck && Math.abs(q.x - p.x) < 16);
            return clash ? Object.assign({}, p, { x: p.x + (p.x >= clash.x ? 20 : -20) }) : p;
        });
    }
    function peopleNow(t) {
        const st = S(), moved = new Set();
        const list = SIM.at('travel', t).map(p => { const o = override(p, st, t); if (o !== p) moved.add(p.id); return o; }).filter(Boolean);
        return unstack(list, moved);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The camera, the slide-in
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const camBase = () => A.floorY(2) + 12 - Slice.G.H;                 // the galley table at the bottom (SPEC §2)
    const camMeal = () => A.deckTop(2) + L.PITCH / 2 - Slice.G.H / 2;   // deck 2 framed, for the meal only
    const camClamp = y => clamp(y, 0, L.H - Slice.G.H);
    /** Playtest 1: Jaxon's ask waited in engineering, off the frame, and nobody found it. Once Vance's talk is not open (or Aris
        has said where Jaxon is), the tower eases down to frame engineering until the ask is answered; the wheel still wins. */
    const camAsk = () => A.deckTop(5) + L.PITCH / 2 - Slice.G.H / 2 - 40;
    function askOnFrame() {
        const st = S();
        return st.mode === 'travel' && st.crew.jaxon.ask === 'open' && st.crew.jaxon.status === 'well' && (st.crew.vance.moment !== 'open' || !!st.flags.said.jaxonTools);
    }
    function camTarget() {
        if (V.manual != null) return V.manual;
        return Math.round(camClamp(S().mode === 'meal' ? camMeal() : askOnFrame() ? camAsk() : camBase()));
    }
    function slideK(t) {
        if (t < V.slide.closedUntil) return 0;
        if (V.slide.start == null) return 1;
        return ease((t - V.slide.start) / SLIDE_MS);
    }
    function closeTower(t, ms) { V.slide.closedUntil = t + ms; V.slide.start = t + ms; }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The reactor's beat, the price in the conduit
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function stepBeat(dt, t) {
        const E = V.Eshown, period = BEAT.FULL + (BEAT.LOW - BEAT.FULL) * clamp((100 - E) / 90, 0, 1), b = V.beat;
        b.phase += dt / period;
        while (b.phase >= 1) {
            b.phase -= 1; b.n += 1;
            const missed = E < 25 && b.n % 4 === 3;                    // a missed beat in four below 25
            if (!missed) b.onsets = b.onsets.concat([t - b.phase * period]).slice(-3);
        }
        const last = b.onsets[b.onsets.length - 1], ms = last == null ? 1e9 : t - last;
        b.val = clamp(Math.exp(-ms / 140) + (ms > 230 ? 0.55 * Math.exp(-(ms - 230) / 150) : 0), 0, 1);
    }
    /** The core's level: engineering down dims it a step (SPEC §8.4; playtest 2 saw no change after "Shut the drive down"). */
    const core = e => A.reactor.set(Slice.broken('engineering') ? Math.round(e * 0.7) : e);
    const chargeSize = cost => (cost >= 8 ? 12 : cost >= 7 ? 9 : 6);
    function onPreview(p) {
        const t = Slice.clock.t, st = S();
        if (V.charge && (V.charge.state === 'lock' || V.charge.state === 'fire')) return;
        if (!p) { settle(t); return; }
        if (p.free) { settle(t); V.flicker = { t0: t }; core(st.res.energy); return; }
        const cost = Number(p.cost) || 0;
        if (V.charge && V.charge.state !== 'settle') { V.charge = Object.assign({}, V.charge, { id: p.id, cost, size: chargeSize(cost), big: cost >= 8 || p.id === 'light' }); }
        else V.charge = { id: p.id, cost, size: chargeSize(cost), big: cost >= 8 || p.id === 'light', state: 'climb', t0: t, s: 0, speed: CHARGE.SPEED, tS: t };
        core(Math.max(0, st.res.energy - cost));               // the core dips by what it would cost
    }
    function settle(t) {
        if (V.charge && V.charge.state !== 'settle') V.charge = Object.assign({}, V.charge, { state: 'settle', tS: t });
        core(S().res.energy);
    }
    function onGo(p) {
        const t = Slice.clock.t, cost = Number(p && p.cost) || 0;
        if (!cost) { V.charge = null; return; }
        const c = V.charge && V.charge.state !== 'settle' ? V.charge : { id: p.id, cost, size: chargeSize(cost), big: cost >= 8 || p.id === 'light', s: 0, t0: t };
        const left = conduitLen() - c.s;
        V.charge = Object.assign({}, c, { cost, size: chargeSize(cost), state: 'lock', tS: t, sAt: c.s, speed: Math.max(CHARGE.SPEED, left / 800) });
    }
    function onFired() {
        const t = Slice.clock.t;
        if (V.charge) V.fire = { t0: t, size: V.charge.size };
        V.charge = null;
        core(S().res.energy);
    }
    function onRes() {
        const E = S().res.energy, was = V.E;
        if (E > was + 4) V.flood = { kind: 'fill', t0: Slice.clock.t };   // the skim: the conduit floods upward, the other way
        V.E = E;
        if (!V.charge || V.charge.state === 'settle') core(E);
    }
    function stepCharge(t) {
        const c = V.charge;
        if (!c) return;
        const Lc = conduitLen();
        if (c.state === 'climb') V.charge = Object.assign({}, c, { s: Math.min(Lc, (t - c.t0) * c.speed) });
        else if (c.state === 'lock') V.charge = Object.assign({}, c, { s: Math.min(Lc, c.sAt + (t - c.tS) * c.speed) });
        else if (c.state === 'settle' && t - c.tS > CHARGE.SETTLE) V.charge = null;
    }

    // ── the conduit's path: s = 0 at the bottom of the frame, up the wall to the corner, then left into the console ──
    const ENG_Y = A.deckTop(5) + 162;                                  // where the reactor's own conduit (ship-reactor PATHS) reaches the wall
    const bottomW = () => Math.min(V.cam + Slice.G.H, ENG_Y);
    const vertLen = () => Math.max(0, bottomW() - CONDUIT.JY);
    const conduitLen = () => vertLen() + (CONDUIT.X - CONDUIT.JX);
    function sAtRow(wy) { return bottomW() - wy; }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // Still pieces on the walls, painted once (house recipe: ramps from the ink, Bayer dither)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const cache = new Map();
    function once(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }

    /** The plates over the galley table: one per marker, dull brass, two engraved lines, two rivets. */
    function platesCanvas(n) {
        return once('plates' + n, () => {
            const xs = [354, 374, 414, 434, 454, 334, 474], p = painter(L.W, 14, 0);
            xs.slice(0, n).forEach((x0, k) => p.region(x0, 2, x0 + 14, 10, (x, y) => {
                const e = y === 2 ? 0.66 : y === 9 ? 0.16 : x === x0 ? 0.24 : x === x0 + 13 ? 0.5 : 0.38 + (fbm(x / 3, y / 2, 70 + k) - 0.5) * 0.12;
                const line = (y === 5 || y === 7) && x > x0 + 3 && x < x0 + 11 - (y === 7 ? 3 : 0);
                const rivet = (x === x0 + 1 || x === x0 + 12) && y === 5;
                p.tone(x, y, R.PAPER, rivet ? 0.72 : line ? 0.18 : e);
            }));
            return p.canvas();
        });
    }
    /** Pages pinned above Mira's bench: the disc drawing (a circle of lines) and the crew plate's rubbing. */
    function pageCanvas(id) {
        return once('page' + id, () => {
            const w = 20, h = 24, p = painter(w + 2, h + 2, 0);
            p.region(1, 1, w + 1, h + 1, (x, y) => p.tone(x, y, R.PAPER, 0.62 - y / h * 0.1 + (fbm(x / 3, y / 3, id === 'disc' ? 81 : 82) - 0.5) * 0.12 + (x === w || y === h ? -0.2 : 0)));
            if (id === 'disc') {
                p.ellipse(10.5, 12.5, 7, 7, (x, y, q) => { if (q > 0.72) p.tone(x, y, R.PAPER, 0.24); });
                for (let k = 0; k < 9; k++) { const a = k * 0.7 + 0.3, n = 3 + (k % 3) * 2; p.line(10, 12, 10 + Math.cos(a) * n, 12 + Math.sin(a) * n, (x, y) => p.tone(x, y, R.PAPER, 0.3)); }
                p.tone(10, 12, R.AMBER, 0.6);
            } else {
                p.region(4, 6, 18, 18, (x, y) => p.tone(x, y, R.PAPER, x === 4 || y === 6 || x === 17 || y === 17 ? 0.22 : 0.4 + (hash(x, y, 83) > 0.6 ? -0.1 : 0)));
                [9, 12, 15].forEach(y => p.region(6, y, 16 - (y === 15 ? 4 : 0), y + 1, (x, yy) => p.tone(x, yy, R.PAPER, 0.2)));
            }
            p.hex(2, 2, '#c4803a'); p.hex(w - 1, 2, '#c4803a');
            return p.canvas();
        });
    }
    /** Aris's book on the table (after a marker) and Jaxon's tools (while his ask is open). The five bowls are the galley art's own. */
    function tableThings(book, tools) {
        return once('table' + book + tools, () => {
            const p = painter(140, 8, 0), y = 5;
            if (book) { p.region(64, y - 2, 73, y + 1, (x, yy) => p.tone(x, yy, R.WOOL, yy === y - 2 ? 0.56 : 0.36)); p.region(65, y - 1, 73, y, (x, yy) => p.tone(x, yy, R.PAPER, 0.78)); p.region(64, y - 2, 66, y + 1, (x, yy) => p.tone(x, yy, R.WOOL, 0.24)); }
            if (tools) {
                p.region(2, y - 1, 12, y, (x, yy) => p.tone(x, yy, R.STEEL, 0.62)); p.region(0, y - 2, 3, y + 1, (x, yy) => p.tone(x, yy, R.STEEL, x === 1 && yy === y - 1 ? 0.1 : 0.5));
                p.region(102, y - 3, 110, y + 1, (x, yy) => p.tone(x, yy, R.CRATE, yy === y - 3 ? 0.6 : 0.34)); p.region(104, y - 4, 108, y - 3, (x, yy) => p.tone(x, yy, R.STEEL, 0.5));
            }
            return p.canvas();
        });
    }
    /** A lamp gone out: the cage dark and its pool of light taken back, in dithered steps (drawn source-atop). */
    function darkCanvas(deck, lamps) {
        return once('dark' + deck + '|' + lamps.length, () => {
            const p = painter(L.W, L.PITCH, A.deckTop(deck)), d = p.data;
            for (let y = 0; y < F + 2; y++) for (let x = L.IL; x < L.IR; x++) {
                let w = 0;
                lamps.forEach(([lx, ly, reach]) => { const dy = y - ly, dd = Math.hypot((x - lx) / 1.25, dy < 0 ? dy * 2.2 : dy * 0.82); w = Math.max(w, Math.exp(-dd / (reach * 1.6))); });
                const q = Math.floor(Math.min(1, w * 1.25) * 4 + bay(x, y + p.oy)) / 4;
                if (q <= 0) continue;
                const o = (y * L.W + x) * 4; d[o] = 5; d[o + 1] = 7; d[o + 2] = 10; d[o + 3] = Math.round(255 * 0.72 * q);
            }
            lamps.forEach(([lx, ly]) => {
                for (let x = lx - 4; x <= lx + 4; x++) p.tone(x, ly - 1, R.STEEL, 0.2);
                for (let x = lx - 3; x <= lx + 3; x++) p.tone(x, ly, R.STEEL, x === lx + 1 ? 0.4 : 0.14);
                for (let x = lx - 2; x <= lx + 2; x++) p.tone(x, ly + 1, R.STEEL, 0.1);
            });
            return p.canvas();
        });
    }
    /** Frost round a hole in the back wall (breach); worse spreads it; patched is a plate taped over a smaller frost. */
    function frostCanvas(deck, look) {
        return once('frost' + deck + look, () => {
            const [hx, hy] = HOLE[deck], S2 = 48, p = painter(S2 * 2, S2 * 2, A.deckTop(deck) + hy - S2), c = S2;
            const rr = look === 'worse' ? 30 : look === 'patched' ? 9 : 17;
            p.region(0, 0, S2 * 2, S2 * 2, (x, y) => {
                const d = Math.hypot(x - c, (y - c) * 1.15), edge = rr * (0.45 + 1.0 * fbm(x / 5, y / 5, 90 + deck));
                if (d < edge && hash(x, y, 89) > 0.25 * d / edge) p.tone(x, y, R.ICE, 0.12 + 0.36 * (1 - d / edge) + (hash(x, y, 91) > 0.93 ? 0.25 : 0));
            });
            if (look !== 'patched') {
                for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.4, n = rr * (0.5 + 0.5 * hash(k, deck, 92)); p.line(c, c, c + Math.cos(a) * n, c + Math.sin(a) * n, (x, y, s) => p.tone(x, y, R.ICE, 0.7 - s * 0.4)); }
                p.region(c - 2, c - 2, c + 3, c + 3, (x, y) => { if (!((x === c - 2 || x === c + 2) && (y === c - 2 || y === c + 2))) p.hex(x, y, INK); });
            } else {
                p.region(c - 6, c - 5, c + 6, c + 5, (x, y) => p.tone(x, y, R.STEEL, y === c - 5 ? 0.62 : x === c + 5 ? 0.5 : y === c + 4 ? 0.16 : 0.36));
                p.line(c - 7, c - 6, c + 6, c + 5, (x, y) => p.tone(x, y, R.LINEN, 0.66)); p.line(c - 7, c + 5, c + 6, c - 6, (x, y) => p.tone(x, y, R.LINEN, 0.56));
            }
            return p.canvas();
        });
    }
    /** Mira's lamp, turned up over the bench while the fix waits: a warm cone down onto the desk. */
    function lampCone() {
        return once('cone', () => {
            const top = F - DESK - 3, p = painter(40, 32, 0);
            for (let y = 0; y < 28; y++) { const hw = 2 + y * 0.45; for (let x = Math.round(20 - hw); x <= Math.round(20 + hw); x++) p.tone(x, y + 2, R.AMBER, (0.42 - y * 0.008) * (1 - Math.abs(x - 20) / (hw + 1))); }   // drawn 'lighter': it adds warmth
            return { canvas: p.canvas(), x: 385, y: top - 30 };
        });
    }
    /** The ship runs on past the left edge into the dark: a dithered fade (layout A's vignette). */
    function vignette(H) {
        return once('vig' + H, () => {
            const w = 64, c = document.createElement('canvas'); c.width = w; c.height = H;
            const g = c.getContext('2d'); g.fillStyle = INK;
            for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) if (bay(x, y) < Math.pow(1 - x / w, 1.7) * 0.92) g.fillRect(x, y, 1, 1);
            return c;
        });
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // Drawing
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let ctx = null, cur = '';
    const px = (x, y, hex, w = 1, h = 1) => { if (hex !== cur) { ctx.fillStyle = hex; cur = hex; } ctx.fillRect(x, y, w, h); };
    const tone = (x, y, r, v) => { if (v <= 0) return; const k = level(r, v, x - V.offX, y + V.cam); if (k > 0) px(x, y, r.hex[k]); };
    const sx = wx => wx + V.offX, sy = wy => wy - V.cam;            // tower art px → canvas px
    const deckVisible = i => { const top = A.deckTop(i) - V.cam; return top + L.PITCH > 0 && top < Slice.G.H; };

    function drawWalls(t) {
        const st = S(), G2 = A.deckTop(2), D1 = A.deckTop(1);
        if (deckVisible(2) && st.flags.plates > 0) ctx.drawImage(platesCanvas(Math.min(7, st.flags.plates)), sx(0), sy(G2 + 64));
        const book = st.flags.plates > 0, tools = jaxonSign(st);
        if (deckVisible(2) && (book || tools)) ctx.drawImage(tableThings(book, tools), sx(350), sy(G2 + TABLE_Y - 5));
        if (deckVisible(1)) {
            const pages = (st.pinned || []).filter(id => id === 'disc' || id === 'plate');
            pages.forEach((id, k) => ctx.drawImage(pageCanvas(id), sx(k === 0 ? 486 : 430), sy(D1 + 94 + k)));
            if (fixWaiting(st)) {
                const cone = lampCone();
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(cone.canvas, sx(cone.x), sy(D1 + cone.y)); ctx.restore(); cur = '';
                const on = Math.floor(t / 650) % 2 === 0, y = sy(D1 + SLATE.y), x = sx(SLATE.x);
                for (let k = 0; k < 12; k++) { tone(x + k, y, R.STEEL, 0.5); tone(x + k, y + 1, R.SCR, (on ? 0.62 : 0.4) + (k % 3 === 0 ? 0.1 : 0)); tone(x + k, y + 2, R.STEEL, 0.2); }
                if (on) { px(x + 9, y - 1, R.SCR.hex[5]); tone(x + 9, y - 2, R.SCR, 0.4); }
            }
        }
    }

    /** A red deck on its own picture: frost round the hole and a lamp out (breach), sparks (surge); a small warning lamp. */
    function drawDamage(t) {
        const st = S(), tick = Math.floor(t / 125);
        DECKS.forEach((name, i) => {
            const look = st.decks[name];
            if (!look || look === 'ok' || !deckVisible(i)) return;
            const top = A.deckTop(i), surge = i === 5;
            const out = look === 'patched' ? [] : look === 'worse' ? LAMPS[i] : LAMPS[i].slice(0, 1);
            ctx.save(); ctx.globalCompositeOperation = 'source-atop';
            if (out.length) ctx.drawImage(darkCanvas(i, out), sx(0), sy(top));
            if (!surge) { const fc = frostCanvas(i, look === 'worse' ? 'worse' : look === 'patched' ? 'patched' : 'red'); ctx.drawImage(fc, sx(HOLE[i][0] - 48), sy(top + HOLE[i][1] - 48)); }
            ctx.restore(); cur = '';
            const [hx, hy] = HOLE[i];
            if (surge || look === 'fixing') sparks(sx(hx), sy(top + hy), tick, look === 'fixing' ? R.AMBER : R.ICE, surge && look !== 'fixing');
            if (look === 'patched') return;
            const blink = look === 'worse' ? 500 : 1100, on = (t % blink) < blink * 0.5, [lx, ly] = RED_LAMP(i), X = sx(lx), Y = sy(top + ly), ramp = look === 'fixing' ? R.AMBER : R.RED;
            if (on) { for (let dy = -4; dy <= 5; dy++) for (let dx = -4; dx <= 5; dx++) { const d = Math.hypot(dx - 0.5, dy - 0.5); if (d < 5) tone(X + dx, Y + dy, ramp, 0.34 * (1 - d / 5)); } px(X, Y, ramp.hex[ramp.hex.length - 2], 2, 2); }
            else px(X, Y, ramp.hex[1], 2, 2);
        });
    }
    function sparks(X, Y, tick, ramp, bursty) {
        if (bursty && (tick % 11) > 2) return;
        for (let k = 0; k < 6; k++) {
            if (hash(tick & 255, k, 95) < 0.35) continue;
            const a = hash(tick & 255, k, 96) * Math.PI * 2, n = 2 + Math.round(hash(tick & 255, k, 97) * 5);
            for (let s = 0; s < n; s++) tone(X + Math.round(Math.cos(a) * s), Y + Math.round(Math.sin(a) * s + s * s * 0.15), ramp, 0.95 - s * 0.12);
        }
        px(X, Y, '#fff3dc');
    }

    /** The conduit: 2 px of light up the inner hull wall into the bridge console. Its base is the energy; the beat runs up
        it; a charge climbs it when a world is pointed at, and leaves through the hull when the course fires. */
    function drawConduit(t) {
        const G = Slice.G, X = sx(CONDUIT.X), JY = sy(CONDUIT.JY), JX = sx(CONDUIT.JX), Lc = conduitLen(), vl = vertLen();
        const E = V.Eshown / 100, c = V.charge, st = S();
        const engRed = st.decks.engineering && st.decks.engineering !== 'ok' && st.decks.engineering !== 'patched';
        let base = 0.2 + 0.2 * E + 0.08 * V.beat.val * E, dimK = 0, cAlpha = 0;
        if (c) {
            cAlpha = c.state === 'settle' ? 1 - clamp((t - c.tS) / CHARGE.SETTLE, 0, 1) : 1;
            dimK = clamp(3 * c.cost / Math.max(1, st.res.energy), 0, 0.8) * cAlpha;
        }
        const pulses = V.beat.onsets.map(o => (t - o) * BEAT.RISE).filter(s => s >= 0 && s < Lc + 40);
        const fl = V.flood, flAge = fl ? t - fl.t0 : 0;
        if (fl && flAge > 1800) V.flood = null;
        const jump = fl && fl.kind === 'jump', fill = fl && fl.kind === 'fill';
        const vAt = s => {
            let v = base * (c && s < c.s ? 1 - dimK : 1);
            if (c && c.big && cAlpha > 0) v += 0.12 * cAlpha;
            pulses.forEach(p => { const d = p - s; if (d >= -1 && d < 30) v += (0.55 - Math.max(0, d) * 0.017) * (engRed ? 0.6 : 1); });
            if (c && cAlpha > 0) { const d = Math.abs(s - c.s); if (d < c.size / 2 + 4) v += (d < c.size / 2 ? 0.9 : 0.6 - (d - c.size / 2) * 0.12) * cAlpha; }
            if (jump) v += 0.4 * (1 - flAge / 1800) + (((s + flAge * 1.4) % 40) < 6 ? 0.3 : 0);
            if (fill && s < flAge * 0.4) v += 0.6 * (1 - flAge / 1800) + (flAge * 0.4 - s < 10 ? 0.4 : 0);
            if (engRed && hash(Math.floor(t / 90) & 255, Math.floor(s / 12) & 255, 98) < 0.08) v -= 0.2;   // engineering red: the light stutters
            return v;
        };
        // the link from the reactor's pipe in engineering, when it is in view
        const EY = sy(ENG_Y);
        if (EY >= -3 && EY < G.H + 3) for (let x = sx(CONDUIT.EX); x <= X + 2; x++) {
            const v = vAt(0);
            tone(x, EY - 1, R.STEEL, 0.4); tone(x, EY + 2, R.STEEL, 0.14);
            if (x <= X + 1) { tone(x, EY, R.ICE, v); tone(x, EY + 1, R.ICE, v * 0.86); }
        }
        // the vertical run, from the bottom of the frame (or engineering) to the corner
        for (let y = Math.max(JY, 0); y < Math.min(G.H, EY); y++) {
            const wy = y + V.cam, s = sAtRow(wy), local = ((wy - L.TOP0) % L.PITCH + L.PITCH) % L.PITCH, slab = local >= F && wy > L.TOP0;
            const v = vAt(s), halo = v - 0.5;
            if (halo > 0) { tone(X - 1, y, R.ICE, halo * 1.2); tone(X + 2, y, R.ICE, halo * 1.3); tone(X - 2, y, R.ICE, halo * 0.6); tone(X + 3, y, R.ICE, halo * 0.6); }
            else { tone(X - 1, y, R.STEEL, slab ? 0.42 : 0.14); tone(X + 2, y, R.STEEL, slab ? 0.5 : 0.3); }
            tone(X, y, R.ICE, v * 0.86); tone(X + 1, y, R.ICE, v);
            if (wy % 44 === 0 && halo <= 0) { px(X - 2, y, R.STEEL.hex[6]); px(X + 3, y, R.STEEL.hex[5]); }
        }
        // the run along the bridge into the nav console
        if (JY > -4 && JY < G.H + 4) {
            for (let x = JX; x <= X + 2; x++) {
                const s = vl + (X - x), v = vAt(s);
                tone(x, JY - 1, R.STEEL, 0.36); tone(x, JY + 2, R.STEEL, 0.14);
                if (x <= X) { tone(x, JY, R.ICE, v); tone(x, JY + 1, R.ICE, v * 0.86); }
            }
            const lit = c && c.s >= Lc - 2 ? cAlpha : 0, fk = V.flicker && t - V.flicker.t0 < 420 ? (Math.floor((t - V.flicker.t0) / 70) % 2 === 0) : false;
            for (let y = -3; y < 5; y++) for (let x = -5; x < 0; x++) tone(JX + x, JY + y, R.STEEL, y === -3 ? 0.56 : x === -1 ? 0.44 : 0.26);
            const glow = fk ? 1 : lit ? 0.65 + 0.3 * Math.sin(t / 90) * (c.state === 'lock' ? 1 : 0.4) : 0.2 + 0.4 * V.beat.val * E;
            tone(JX - 3, JY, R.ICE, glow); tone(JX - 3, JY + 1, R.ICE, glow * 0.8); tone(JX - 2, JY, R.ICE, glow * 0.7);
            if (lit && c.big) for (let k = -3; k < 3; k++) tone(JX - 3 + k, JY - 4, R.ICE, 0.4 * lit);
        }
        drawFire(t, X, JY);
    }
    /** route:fired: the charge leaves through the hull, a bright streak across the plating and a flash on the skin. */
    function drawFire(t, X, JY) {
        const f = V.fire;
        if (!f) return;
        const age = t - f.t0;
        if (age > 420) { V.fire = null; return; }
        const hullX = sx(HULL_OUT), head = Math.round(X + (hullX + 6 - X) * clamp(age / 260, 0, 1));
        for (let x = X; x <= head; x++) { const d = head - x; if (d < 14) { tone(x, JY, R.ICE, 1 - d * 0.05); tone(x, JY + 1, R.ICE, 0.8 - d * 0.05); } }
        if (age > 200) { const k = 1 - (age - 200) / 220; for (let dy = -f.size; dy <= f.size; dy++) for (let dx = -2; dx <= 3; dx++) tone(hullX - 3 + dx, JY + dy, R.ICE, k * (0.9 - Math.abs(dy) / (f.size + 2))); }
    }

    /** The light falls on our hull too, plate by plate down the outside edge, strongest level with the light (layout A). */
    function hullLight() {
        const G = Slice.G, ly = G.H * 0.4, SUN = window.V3Paint.RP.SUN;
        for (let y = 0; y < G.H; y++) {
            const wy = y + V.cam;
            if (wy < L.TIP + 2 || wy > L.TAIL0 + 70) continue;
            const hw = wy < L.TOP0 ? A.noseHalf(wy) : L.HO, plate = Math.floor(wy / 30), seam = ((wy % 30) + 30) % 30;
            if (seam === 0) continue;
            const v = (0.12 + 0.36 * Math.exp(-Math.abs(y - ly) / (G.H * 0.5))) * (0.45 + 0.75 * hash(plate & 255, 3, 11)) * (seam < 3 ? 1.25 : 1);
            const xo = Math.round(L.CX + hw) + 8 + V.offX;
            tone(xo, y, SUN, v); tone(xo - 1, y, SUN, v * 0.55); if (seam < 3) tone(xo - 2, y, SUN, v * 0.4);
        }
    }
    function drawChipShade() {
        if (!V.chips || !V.chips.box) return;
        const G = Slice.G, b = V.chips.box, [x0, y0] = G.toArt(b.x - 40, b.y - 24), [x1, y1] = G.toArt(b.x + b.w + 40, b.y + b.h + 24);
        const w = x1 - x0, h = y1 - y0;
        if (w <= 0 || h <= 0) return;
        const shade = once('shade' + w + 'x' + h + '@' + (x0 & 7) + (y0 & 7), () => {
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            const g = c.getContext('2d'), img = g.createImageData(w, h), d = img.data;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const r = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2)), k = clamp((1.12 - r) / 0.5, 0, 1) * 0.72;   // a soft oval, no box
                if (bay(x + x0, y + y0) < k) { const o = (y * w + x) * 4; d[o] = 5; d[o + 1] = 7; d[o + 2] = 10; d[o + 3] = 255; }
            }
            g.putImageData(img, 0, 0); return c;
        });
        ctx.drawImage(shade, x0, y0);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The module
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function init() {
        V.cv = document.getElementById('ship');
        V.ctx = V.cv.getContext('2d');
        V.words = document.getElementById('ship-words');
        V.jobs = TW.warm();
        Slice.on('price:preview', onPreview);
        Slice.on('route:go', onGo);
        Slice.on('route:cancel', () => settle(Slice.clock.t));
        Slice.on('route:fired', onFired);
        Slice.on('res:changed', onRes);
        Slice.on('deck:changed', () => { if (!V.charge || V.charge.state === 'settle') core(S().res.energy); });
        Slice.on('deck:ask', p => showChips(p && p.deck, p && p.chips));
        Slice.on('jump:start', () => { V.flood = { kind: 'jump', t0: Slice.clock.t }; V.charge = null; });
        Slice.on('meal:start', () => { V.mealT = Slice.clock.t; V.mealSent = false; V.manual = null; });
        Slice.on('sector:arrive', () => closeTower(Slice.clock.t, 3000));
        Slice.on('opening:done', () => { const t = Slice.clock.t; if (t < V.slide.closedUntil) { V.slide.closedUntil = t; V.slide.start = t; } });
        Slice.on('dive:start', () => { V.manual = null; hideChips(); });
        Slice.on('price:changed', () => { if (V.chips) showChips(V.chips.deck); });
        Slice.on('mockup:goto', p => sync(p && p.moment));
        IDS.forEach(id => Slice.anchors.set('person:' + id, () => { const a = personAt(id); return a ? [{ x: a.x, y: a.y, side: 'above', align: 'center' }, { x: a.x + 20, y: a.y + 30, side: 'right' }] : []; }));
        Slice.anchors.set('tower:bench', () => towerAnchor(1, 466, F - DESK - 46));
        Slice.anchors.set('tower:conduit', () => towerAnchor(0, CONDUIT.JX - 8, CONDUIT.JY - 26 - A.deckTop(0)));
        Slice.anchors.set('tower:galley', () => towerAnchor(2, 405, TABLE_Y - 70));
        DECKS.forEach((name, i) => Slice.anchors.set('tower:deck:' + name, () => towerAnchor(i, 460, 60)));
        core(S().res.energy);
    }
    function towerAnchor(deck, x, localY) {
        const G = Slice.G, ay = A.deckTop(deck) + localY - V.cam;
        if (!G.toCss || ay < 0 || ay > G.H || slideK(Slice.clock.t) < 1) return [];
        const [cx, cy] = G.toCss(x + V.offX, ay);
        return [{ x: cx, y: cy, side: 'above', align: 'center' }];
    }
    function resize(G) {
        if (!V.cv) return;
        V.cv.width = G.W; V.cv.height = G.H;
        V.cv.style.width = (G.W * G.k / G.dpr) + 'px'; V.cv.style.height = (G.H * G.k / G.dpr) + 'px';
        V.cam = camTarget(); V.manual = V.manual == null ? null : camClamp(V.manual);
        if (V.chips) placeChips();
    }
    /** Called by index.html before script.js writes the moment's state; sync() runs again on 'mockup:goto'. */
    function goto(moment) { reset(moment); }
    function reset(moment) {
        V.manual = null; V.charge = null; V.fire = null; V.flood = null; V.flicker = null;
        V.beat = { phase: 0, n: 0, val: 0, onsets: [] };
        V.mealT = null; V.mealSent = false;
        V.slide = { closedUntil: 0, start: null };
        if (moment === 'open') closeTower(0, 4000);                       // from black, the title; then the tower slides in
        if (moment === 's2') closeTower(0, 3000);                         // "The Dark Void" with the tower closed
        hideChips();
    }
    function sync(moment) {
        const st = S();
        V.E = st.res.energy; V.Eshown = st.res.energy;
        core(st.res.energy);
        if (st.mode === 'meal' && V.mealT == null) V.mealT = Slice.clock.t;
        V.cam = camTarget();
        if (moment === 'open' && V.slide.closedUntil === 0) closeTower(0, 4000);
    }
    function update(dt, t) {
        const job = V.jobs.shift(); if (job) job();
        const st = S(), G = Slice.G;
        if (!G.H) return;
        if (V.E !== st.res.energy) onRes();
        V.Eshown += (st.res.energy - V.Eshown) * (dt > 0 ? 1 - Math.exp(-dt / 220) : 0);
        stepBeat(dt, t);
        stepCharge(t);
        const target = camTarget();
        V.cam = V.cam == null || dt === 0 && Math.abs(target - V.cam) > 400 ? target : V.cam + (target - V.cam) * (1 - Math.exp(-dt / 260));
        if (Math.abs(target - V.cam) < 0.5) V.cam = target;
        if (V.slide.start != null && t >= V.slide.start + SLIDE_MS) V.slide.start = null;
        if (st.mode === 'meal' && V.mealT == null) V.mealT = t;
        if (st.mode !== 'meal') V.mealT = null;
        if (V.mealT != null && !V.mealSent && t - V.mealT >= MEAL_DONE_MS) { V.mealSent = true; Slice.emit('meal:done', {}); }
        V.people = peopleNow(t);
    }
    function render(t) {
        const c = V.ctx, G = Slice.G;
        if (!c || !G.W) return;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, G.W, G.H);
        const mode = S().mode, k = slideK(t);
        if (mode === 'stop' || mode === 'corridor' || k <= 0) { V.drawn = []; return; }
        ctx = c; cur = ''; c.imageSmoothingEnabled = false;
        V.offX = Math.round(G.offX - (1 - k) * (G.hull + 12));
        const cam = Math.round(V.cam);
        TW.draw(c, { t, camY: cam, offX: V.offX, W: G.W, H: G.H, people: V.people, auraTalking: auraTalking() });
        V.drawn = TW.drawn.slice();
        const keep = V.cam; V.cam = cam;
        cur = '';
        drawWalls(t);
        drawDamage(t);
        drawConduit(t);
        hullLight();
        V.cam = keep;
        c.drawImage(vignette(G.H), 0, 0);
        drawChipShade();
    }
    const auraTalking = () => !!document.querySelector('#reading .voice.tone-aura.is-in');

    // ── input ──
    function hit(ax, ay) {
        const wx = ax - V.offX, wy = ay + Math.round(V.cam), st = S();
        const who = TW.hitPerson(ax, ay);
        if (who) { const d = V.drawn.find(p => p.id === who); return { what: 'person', id: who, say: d && d.say }; }
        const deck = Math.floor((wy - L.TOP0) / L.PITCH), local = wy - A.deckTop(deck);
        if (deck < 0 || deck >= L.N || wx < L.IL - 2 || wx > L.IR + 2) return null;
        const onConduit = (Math.abs(wx - CONDUIT.X - 0.5) < 5 && wy >= CONDUIT.JY - 4 && wy <= ENG_Y + 3) || (deck === 0 && Math.abs(local - (CONDUIT.JY - A.deckTop(0))) < 5 && wx >= CONDUIT.JX - 6 && wx <= CONDUIT.X);
        if (onConduit) return { what: 'reactor', id: 'conduit' };
        if (deck === 1 && wx >= BENCH.x0 && wx < BENCH.x1 && local >= BENCH.y0 && local <= F && fixWaiting(st)) return { what: 'bench', id: 'bench' };
        const look = st.decks[DECKS[deck]];
        if (look && look !== 'ok' && local < F) return { what: 'deck', id: DECKS[deck] };
        return null;
    }
    function pointer(type, e, ax, ay) {
        const mode = S().mode;
        if (slideK(Slice.clock.t) < 1 || mode === 'stop' || mode === 'corridor') return false;
        if (type === 'wheel') {
            const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, from = V.manual != null ? V.manual : V.cam;
            V.manual = Math.round(camClamp(from + dy * 0.6));
            return true;
        }
        if (type === 'leave') { V.hover = null; return false; }
        const h = hit(ax, ay);
        V.lastPointer = { ax, ay };
        if (type === 'move') { V.hover = h; return !!h; }
        if (type === 'down') {
            if (V.chips) { hideChips(); if (!h) return true; }
            if (!h) return false;
            Slice.emit('ship:click', h);
            return true;
        }
        return false;
    }

    // ── a red deck's three chips (#ship-words), away from the pointer, deaf for 400 ms ──
    /** The words are script.js's (deckChips: [{ choice, verb, chip }], in the price mode); these are only the fallback. */
    function chipWords(deck, given) {
        const sc = Slice.mods.script, list = Array.isArray(given) && given.length ? given : sc && typeof sc.deckChips === 'function' ? sc.deckChips(deck) : null;
        if (list && list.length) return list.map(c => ({ choice: c.choice, verb: c.verb, chips: c.chip ? [[c.chip, c.choice === 'fix' && S().price === 'numbers' ? 'loss' : '']] : [] }));
        return [{ choice: 'fix', verb: 'Fix it', chips: [] }, { choice: 'patch', verb: 'Patch it', chips: [] }, { choice: 'live', verb: 'Live with it', chips: [] }];
    }
    function showChips(deck, given) {
        if (!V.words || DECKS.indexOf(deck) < 0) return;
        hideChips();
        const el = document.createElement('div'), list = document.createElement('ol');
        el.className = 'voice is-ask ship-chips'; el.style.pointerEvents = 'auto';
        list.className = 'choices';
        chipWords(deck, given).forEach(c => {
            const li = document.createElement('li'), b = document.createElement('button');
            b.type = 'button'; b.className = 'choice'; b.dataset.choice = c.choice;
            const n = document.createElement('span'); n.className = 'n'; n.setAttribute('aria-hidden', 'true');
            const verb = document.createElement('span'); verb.className = 'verb'; verb.textContent = c.verb;
            const chips = document.createElement('span'); chips.className = 'chips';
            c.chips.forEach(([text, kind]) => { const s = document.createElement('span'); s.className = 'chip' + (kind === 'loss' ? ' is-loss' : ''); s.textContent = text; chips.append(s); });
            b.append(n, verb, chips);
            b.addEventListener('pointerdown', e => e.stopPropagation());
            b.addEventListener('click', e => { e.stopPropagation(); choose(deck, c.choice); });
            li.append(b); list.append(li);
        });
        el.append(list);
        el.addEventListener('pointerdown', e => e.stopPropagation());
        V.words.append(el);
        V.chips = { el, deck, ready: performance.now() + CHIP_GUARD_MS, box: null };
        placeChips();
        void el.offsetWidth; el.classList.add('is-in');
    }
    function choose(deck, choice) {
        if (!V.chips || performance.now() < V.chips.ready) return;
        hideChips();
        Slice.emit('deck:choice', { deck, choice });
    }
    function hideChips() { if (V.chips) { V.chips.el.remove(); V.chips = null; } }
    function placeChips() {
        const G = Slice.G, el = V.chips.el, i = DECKS.indexOf(V.chips.deck), w = el.offsetWidth, h = el.offsetHeight;
        const [hullCss] = G.toCss(G.hull, 0), lp = V.lastPointer, pointerLeft = lp ? lp.ax < G.hull / 2 : false;
        const top = A.deckTop(i) - V.cam, mid = clamp(top + L.PITCH * 0.42, 40, G.H - 40);
        const [, cy] = G.toCss(0, mid);
        const x = pointerLeft ? hullCss - w - 36 : 36, y = clamp(cy - h / 2, 16, innerHeight - h - 16);
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        V.chips.box = { x, y, w, h };
    }

    // ── what others read ──
    function occupied() {
        const on = [false, false, false, false, false, false];
        V.people.forEach(p => { if (p.deck >= 0 && p.deck < 6) on[p.deck] = true; });
        return on;
    }
    function beat() { return V.beat.val; }
    function personAt(id) {
        const G = Slice.G, d = V.drawn.find(p => p.id === id);
        if (!d || !G.toCss) return null;
        const head = d.act === 'sleep' ? d.y - 26 : d.act === 'sit' ? d.y - 84 : d.y - 104;
        const ax = d.x + V.offX, ay = head - Math.round(V.cam);
        if (ax < 0 || ax > G.hull || ay < -10 || ay > G.H) return null;
        const [x, y] = G.toCss(ax, ay);
        return { x, y };
    }

    Slice.mods.ship = { init, resize, update, render, pointer, goto, occupied, beat, personAt };
})();
