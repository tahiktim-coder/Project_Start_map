/* ═══ Silent Exodus · new screen (?new=1) · ship/ShipRoutine.js: the crew's day while we fly ═════════════════════
   What it is: one story state, 'travel', a lap of 200 s. Each person's routine is a list of stops in the ship
   (ShipArt.SPOTS plus navDesk, port2, mealStand), planned once into timed walks, climbs and stays; nobody climbs through
   anybody in the ladder well, and a walker steps onto the front lip to pass someone. A still at any t is the same
   picture. The lines are docs/STYLE.md's: plain, one idea, 20 words at most; Cora never speaks, A.U.R.A. answers.
   Source: prototypes/screens/layouts/variant-a/sim-a.js (itself a copy of crew-hires/ship-sim.js). Changes: ShipSimA is
   now ShipRoutine. The tower overrides these poses with the real crew (dead, hurt, confined, asleep): see BUILD_A.md §6.
   Load after ShipReactor.js.

   window.ShipRoutine (frozen)
     STATES                  [{ id: 'travel', name, cycle: 200000, pair, looks }]
     at(stateId, t) → [{ id, deck, x, y, act, facing, ms, z, say, screen?, awake? }]   everyone's pose at t (ms)
     line(stateId, id, say) → { who, text }   what someone says (who: their first name, or 'A.U.R.A.' for Cora)
     build(stateId), stateOf(stateId), NAMES { id → first name }, REACT [[id, say, from s, to s]]
*/
(function (root) {
    'use strict';
    const A = root.ShipArt, CE = root.CrewEngine, S = A.SPOTS, L = A.L, ACT = CE.ACTIONS;

    // stops: [spot, act, until (s), extra]   extra: { carry: walk there carrying a crate, snap: no walk (in and out of bed),
    //                                                   say: the line key, screen: false for a console that is not a screen }
    const ROUTINES = {
        travel: {
            cora: [['helm', 'console', 66, { say: 'work' }], ['window', 'idle', 82, { say: 'look' }], ['seatR2', 'sit', 140, { say: 'meal' }], ['helm', 'console', 200, { say: 'work' }]],
            mira: [['bench', 'console', 33, { say: 'work' }], ['window', 'idle', 62, { say: 'titan' }], ['bench', 'console', 80, { say: 'work' }], ['seatR1', 'sit', 140, { say: 'meal' }],
                ['bench', 'console', 200, { say: 'work' }]],
            vance: [['navDesk', 'console', 58, { say: 'nav' }], ['mealStand', 'idle', 140, { say: 'meal' }], ['navDesk', 'console', 200, { say: 'nav' }]],
            jaxon: [['gauges', 'idle', 60, { say: 'work' }], ['seatL2', 'sit', 140, { say: 'meal' }], ['gauges', 'idle', 200, { say: 'work' }]],
            aris: [['medCabinet', 'idle', 40, { say: 'work' }], ['medBedside', 'idle', 64, { say: 'work' }], ['seatL1', 'sit', 106, { say: 'meal' }], ['port2', 'idle', 120, { say: 'chronos' }],
                ['seatL1', 'sit', 140, { say: 'meal' }], ['counterStand', 'idle', 160, { say: 'clean' }], ['medCabinet', 'idle', 200, { say: 'work' }]],
        },
    };
    const EXTRA = {                                                             // spots only this layout needs
        navDesk: { deck: 0, x: 512, facing: 1 },                                // the chart desk on the bridge: hands on its monitor (x 526)
        port2: { deck: 2, x: 330, facing: 1 },                                  // under the galley porthole
        mealStand: { deck: 2, x: 548, facing: -1 },
    };
    const spot = name => S[name] || EXTRA[name];

    const STATES = [{ id: 'travel', name: 'Travelling', cycle: 200000, pair: 0, looks: {} }];
    const stateOf = id => STATES.find(s => s.id === id) || STATES[0];

    // ── building a routine into timed pieces ────────────────────────────────────────────────────────────────────
    const tendX = (id, patientX) => patientX + 42 - CE.sprite(id, 'tend', 0).hands[1].x;
    function place(id, stop) {
        const [name, act] = stop;
        if (name === 'tend') { const P = S.patient; return { deck: P.deck, x: tendX(id, P.x), facing: 1 }; }
        const s = spot(name);
        if (!s) throw new Error('ShipRoutine: no spot called ' + name);
        return { deck: s.deck, x: s.x, facing: s.facing, h: act === 'sleep' ? s.h : 0 };
    }
    function walkPiece(deck, x0, x1, t0, carry) {
        const a = carry ? ACT.carry : ACT.walk, n = Math.ceil(Math.abs(x1 - x0) / a.move);
        return { kind: 'walk', deck, x0, x1, t0, t1: t0 + n * a.ms, act: carry ? 'carry' : 'walk' };
    }
    // ── the ladder well: nobody climbs through anybody ──────────────────────────────────────────────────────────
    // Each climb is kept as a line in time and height (the climber also stands at the foot for LADDER_PAD before and at
    // the top for LADDER_PAD after, stepping on and off). A new climb may start only when, at every moment, it stays
    // LADDER_SEP rows clear of every climb already planned: two people can follow each other up a long shaft, but never
    // overlap. Whoever finds the well taken waits beside it, facing it. People are planned in the order the routine lists
    // them, so earlier people never wait; the loop wraps, so planned climbs are checked one cycle either side as well.
    const LADDER_PAD = 800, LADDER_SEP = 96, LADDER_STEP = 250, WAIT_X = L.LX + 30, WAIT_GAP = 18;   // a second waiter queues 18 px further along
    function ladderWell(cycle) {
        const held = [], waits = [];
        const yAt = (c, t) => (t <= c.t0 ? c.y0 : t >= c.t1 ? c.y1 : c.y0 + (c.y1 - c.y0) * (t - c.t0) / (c.t1 - c.t0));
        return {
            clear(c) {
                for (const r of held) for (const o of [-cycle, 0, cycle]) {
                    const R = { t0: r.t0 + o, t1: r.t1 + o, y0: r.y0, y1: r.y1 };
                    const a0 = Math.max(c.t0, R.t0) - LADDER_PAD, a1 = Math.min(c.t1, R.t1) + LADDER_PAD;
                    for (let t = a0; t <= a1; t += 100) if (Math.abs(yAt(c, t) - yAt(R, t)) < LADDER_SEP) return false;
                }
                return true;
            },
            take(c) { held.push(c); },
            spot(deck, t0, t1) {                                                // the nearest free place in the queue beside the well
                for (let k = 0; ; k++) {
                    const x = WAIT_X + k * WAIT_GAP;
                    if (!waits.some(w => w.deck === deck && w.x === x && [-cycle, 0, cycle].some(o => t0 < w.t1 + o + 800 && t1 + 800 > w.t0 + o))) { waits.push({ deck, x, t0, t1 }); return x; }
                }
            },
        };
    }
    function travel(from, to, t0, carry, well) {
        const out = [];
        let t = t0;
        const push = p => { if (p.t1 > p.t0) { out.push(p); t = p.t1; } };
        if (from.deck === to.deck) { push(walkPiece(from.deck, from.x, to.x, t, carry)); return out; }
        const y0 = A.floorY(from.deck), y1 = A.floorY(to.deck), n = Math.abs(y1 - y0) / ACT.climb.rise, D = n * ACT.climb.ms;
        const direct = walkPiece(from.deck, from.x, L.LX, t, false);
        let start = direct.t1;
        for (let k = 0; k < 600 && !well.clear({ t0: start, t1: start + D, y0, y1 }); k++) start += LADDER_STEP;
        if (start > direct.t1) {                                                // taken: wait beside the well, then step in
            const wx = well.spot(from.deck, direct.t1 - 2000, start);
            push(walkPiece(from.deck, from.x, wx, t, false));
            const walkIn = walkPiece(from.deck, wx, L.LX, 0, false).t1;
            if (start - walkIn > t) { out.push({ kind: 'stay', deck: from.deck, x: wx, facing: -1, act: 'idle', t0: t, t1: start - walkIn, say: 'move' }); t = start - walkIn; }
            push(walkPiece(from.deck, wx, L.LX, t, false));
            start = Math.max(start, t);
        } else push(direct);
        push({ kind: 'climb', y0, y1, n, t0: start, t1: start + D });
        well.take({ t0: start, t1: start + D, y0, y1 });
        push(walkPiece(to.deck, L.LX, to.x, t, false));
        return out;
    }
    const built = new Map();
    function build(stateId) {
        if (built.has(stateId)) return built.get(stateId);
        const st = stateOf(stateId), R = ROUTINES[st.id], out = {}, well = ladderWell(st.cycle);
        Object.keys(R).forEach(id => {
            const stops = R[id], pieces = [];
            let t = 0, cur = place(id, stops[stops.length - 1]);
            stops.forEach(stop => {
                const to = place(id, stop), ex = stop[3] || {};
                if (!ex.snap) travel(cur, to, t, !!ex.carry, well).forEach(p => { pieces.push(p); t = p.t1; });
                const until = stop[2] * 1000;
                if (until > t) pieces.push({ kind: 'stay', deck: to.deck, x: to.x, facing: to.facing, h: to.h, act: stop[1], t0: t, t1: until, say: ex.say || stop[1], screen: ex.screen, awake: ex.awake });
                else if (typeof console !== 'undefined') console.warn(`ShipRoutine: ${st.id}/${id} reaches ${stop[0]} late (${(t / 1000).toFixed(1)} s > ${stop[2]} s)`);
                t = Math.max(t, until); cur = to;
            });
            out[id] = pieces;
        });
        built.set(stateId, out);
        return out;
    }

    const deckAtY = y => Math.max(0, Math.min(L.N - 1, Math.floor((y - L.TOP0 - 1) / L.PITCH)));
    function poseOf(id, p, t) {
        const lt = t - p.t0;
        if (p.kind === 'stay') {
            const lying = p.act === 'sleep';
            return { id, deck: p.deck, x: p.x, y: A.floorY(p.deck) - (lying ? p.h : 0), act: p.act, facing: p.facing, ms: t, z: lying ? 1 : p.act === 'sit' && (p.x === S.seatL2.x || p.x === S.seatR2.x) ? 1.5 : 2,
                say: p.say, screen: p.screen, awake: p.awake };
        }
        if (p.kind === 'walk') {
            const a = ACT[p.act], dir = Math.sign(p.x1 - p.x0) || 1, step = Math.floor(lt / a.ms);
            return { id, deck: p.deck, x: p.x0 + dir * Math.min(Math.abs(p.x1 - p.x0), step * a.move), y: A.floorY(p.deck), act: p.act, facing: dir, ms: lt, z: 3, say: 'move' };
        }
        const up = p.y1 < p.y0, k = Math.min(p.n, Math.floor(lt / ACT.climb.ms)), step = up ? k : p.n - k;
        const y = up ? p.y0 - ACT.climb.rise * k : p.y1 - ACT.climb.rise * (p.n - k);
        return { id, deck: deckAtY(y - 50), x: L.LX, y, act: 'climb', facing: 1, ms: (step % ACT.climb.frames) * ACT.climb.ms + 1, z: 0.5, say: 'move' };
    }
    // Walking past someone who is sitting, standing or working, a walker steps onto the front lip of the floor (up to
    // LANE rows lower, closer to us) and is drawn in front, so they pass in front of the person instead of through them.
    const LANE = 3, LANE_NEAR = 34, LANE_EASE = 14;
    function lanes(people, gone) {
        // walkers going opposite ways pass too: the one walking left (toward us, by convention) takes the front lane
        const moving = q => q.act === 'walk' || q.act === 'carry';
        const still = people.filter(q => !moving(q) && q.act !== 'climb' && !(q.act === 'sleep' && q.y < A.floorY(q.deck) - 8) && !gone.includes(q.id));
        return people.map(p => {
            if (!moving(p)) return p;
            const others = still.concat(p.facing < 0 ? people.filter(q => q !== p && moving(q) && q.facing > 0 && !gone.includes(q.id)) : []);
            const near = others.filter(q => q.deck === p.deck).reduce((m, q) => Math.min(m, Math.abs(q.x - p.x)), Infinity);
            const k = Math.max(0, Math.min(1, (LANE_NEAR - near) / LANE_EASE));
            return k > 0 ? Object.assign({}, p, { y: p.y + Math.round(k * LANE), z: 4 }) : p;
        });
    }
    function at(stateId, t) {
        const st = stateOf(stateId), B = build(st.id), tt = ((t % st.cycle) + st.cycle) % st.cycle;
        return lanes(Object.keys(B).map(id => {
            const P = B[id], p = P.find(q => tt >= q.t0 && tt < q.t1) || P[P.length - 1];
            return poseOf(id, p, tt);
        }), st.gone || []);
    }

    // ── what people say (docs/STYLE.md: plain, one idea, 20 words at most; Cora never speaks, A.U.R.A. answers) ─────
    const LINES = {
        travel: {
            cora: { any: 'Four crew, Commander. All accounted for.' },
            jaxon: { work: "The drive's running a little hot. Nothing I can't fix.", meal: "Same stew as yesterday. I'm not complaining.", move: 'Going back down. I want to check the coolant again.' },
            aris: { work: "Everyone's due a check-up this week. You too, Commander.", meal: 'Sit down for once. The ship can fly itself for ten minutes.',
                clean: "I'll do the dishes. Go and get some sleep.", chronos: 'Nothing on the scanner. Just old ice.', any: "I'm on my way down to the med bay." },
            mira: { work: "A.U.R.A. found a star that isn't on any chart. I'm checking her numbers.", titan: "That's a ship's transponder. One of the eight, I bet.",
                meal: "Did you see the readings this morning? I couldn't sleep after that.", any: 'Back to the lab. I left a scan running.' },
            vance: { nav: "I'm checking her course against the old charts.", zeta: 'A station out here. Somebody put it on this route on purpose.',
                meal: "I'll eat standing up. My back's bad today.", any: 'Ask the computer how many crates we loaded. Then come and count them.' },
        },
    };
    // a reaction someone says on their own, once a lap, while the world passes: [id, say key, from s, to s]
    const REACT = [['vance', 'zeta', 15.5, 21.5], ['mira', 'titan', 49.4, 56], ['aris', 'chronos', 110, 116.5]];
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    function line(stateId, id, say) {
        const set = (LINES[stateOf(stateId).id] || {})[id] || {};
        const text = set[say] || set.any || set.work || Object.values(set)[0] || '';
        return { who: id === 'cora' ? 'A.U.R.A.' : NAMES[id], text };
    }

    root.ShipRoutine = Object.freeze({ STATES, at, line, build, stateOf, NAMES, REACT });
})(typeof window !== 'undefined' ? window : globalThis);
