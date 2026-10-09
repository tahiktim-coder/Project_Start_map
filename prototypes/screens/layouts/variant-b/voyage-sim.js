/* ═══ Silent Exodus · layout variant B, "Nose up" · the crew's day on the voyage ════════════════════════════════════
   A copy of crew-hires/ship-sim.js (the routine builder, the ladder well and the lanes are its code, unchanged); only
   the data is new: one state, 'voyage', timed to the worlds that slide past in variant-b.html, so people go to the
   windows when a world goes by. The original file is not touched.

   window.VoyageSim
     STATES                     [{ id: 'voyage', cycle (ms), looks }]
     at(stateId, t)             [{ id, deck, x, y, act, facing, ms, z, say, screen }] where everyone is at t
     line(stateId, id, say)     { who, text }: what that person says when clicked (Cora is the player: A.U.R.A. answers)

   The voyage clock (180 s, then it loops):  Titan-61 IV comes down the left side, closest at 42 s;
                                              Chronos-37 Proxima comes down the right side, closest at 132 s.
*/
(function (root) {
    'use strict';
    const A = root.ShipArt, CE = root.CrewEngine, S = A.SPOTS, L = A.L, ACT = CE.ACTIONS;

    // stops: [spot, act, until (s), extra]  (ship-sim.js's format)
    const ROUTINES = {
        voyage: {
            // listed first, so she never waits at the ladder
            // listed first, so she never waits at the ladder. When a world goes by, people stop and face it.
            cora: [['helm', 'console', 30, { say: 'work' }], ['winT1', 'idle', 64, { say: 'titan' }], ['helm', 'console', 120, { say: 'work' }],
                ['winC1', 'idle', 152, { say: 'chronos' }], ['helm', 'console', 180, { say: 'work' }]],
            mira: [['bench', 'console', 30, { say: 'work' }], ['labPortL', 'idle', 60, { say: 'titan' }], ['map', 'idle', 84, { say: 'map' }],
                ['bench', 'console', 122, { say: 'work' }], ['labPortR', 'idle', 152, { say: 'chronos' }], ['bench', 'console', 180, { say: 'work' }]],
            jaxon: [['seatL1', 'sit', 9, { say: 'meal' }], ['winT3', 'idle', 70, { say: 'titan' }], ['engDesk', 'console', 152, { say: 'work' }], ['seatL1', 'sit', 180, { say: 'meal' }]],
            aris: [['navDesk', 'console', 27, { say: 'chair' }], ['winT2', 'idle', 62, { say: 'titan' }], ['chair', 'sit', 96, { say: 'chair' }],
                ['medTerminal', 'console', 150, { say: 'work' }], ['navDesk', 'console', 180, { say: 'chair' }]],
            vance: [['holdMid', 'idle', 20, { say: 'work' }], ['holdDrop', 'idle', 45, { carry: true, say: 'work' }], ['holdMidBack', 'idle', 60, { say: 'work' }],
                ['holdPanel', 'console', 120, { say: 'panel' }], ['holdMid', 'idle', 180, { say: 'work' }]],
        },
    };
    const EXTRA = {                                                             // spots only the voyage needs
        navDesk: { deck: 0, x: 540, facing: 1 },                                // at the chart desk on the bridge
        // facing Titan, which goes by on the left: three on the bridge, Mira under the lab porthole
        winT1: { deck: 0, x: 340, facing: -1 }, winT2: { deck: 0, x: 292, facing: -1 }, winT3: { deck: 0, x: 404, facing: -1 },
        labPortL: { deck: 1, x: 292, facing: -1 },
        // facing Chronos, on the right
        winC1: { deck: 0, x: 600, facing: 1 }, labPortR: { deck: 1, x: 292, facing: 1 },
    };
    const STATES = [{ id: 'voyage', name: 'Voyage', cycle: 180000, pair: 0, looks: {} }];
    const stateOf = id => STATES.find(s => s.id === id) || STATES[0];
    const spot = name => S[name] || EXTRA[name];


    // ── building a routine into timed pieces ────────────────────────────────────────────────────────────────────
    const tendX = (id, patientX) => patientX + 42 - CE.sprite(id, 'tend', 0).hands[1].x;
    function place(id, stop) {
        const [name, act] = stop;
        if (name === 'tend') { const P = S.patient; return { deck: P.deck, x: tendX(id, P.x), facing: 1 }; }
        const s = spot(name);
        if (!s) throw new Error('VoyageSim: no spot called ' + name);
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
                else if (typeof console !== 'undefined') console.warn(`VoyageSim: ${st.id}/${id} reaches ${stop[0]} late (${(t / 1000).toFixed(1)} s > ${stop[2]} s)`);
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

    // ── what people say (docs/STYLE.md: plain, one idea, 20 words at most; Cora is the player, A.U.R.A. answers) ────
    const LINES = {
        voyage: {
            cora: { work: 'Course is steady, Commander. The light ahead is a little brighter today.', titan: 'The beacon is coming from that dry world, Commander. We can stop there.',
                chronos: 'An ice world, Commander. There is no signal from it.', any: 'Four crew, Commander. All accounted for.',
                orbit_titan: 'Orbit, Commander. The beacon belongs to EXODUS-4. It is still running.', orbit_chronos: 'No signal, Commander. The ice is old and clean.' },
            mira: { work: "A.U.R.A. found a star that isn't on any chart. I'm checking her numbers.", titan: "That's a ship's transponder. One of the eight, I bet.",
                map: "I've copied the star map. I still can't read all of it.", chronos: 'Look at the cracks in that ice. I want a sample.', move: 'Back to the lab. I left a scan running.',
                orbit_titan: "If that's hull 4, I can work out when they died from their last star reading.", orbit_chronos: 'Can we take some of the ice? I want to test it.' },
            aris: { chair: "Everyone's due a check-up this week. You too, Commander.", titan: "If anyone's down there, they've waited a long time.",
                work: "I'm restocking the med bay. We used more than I thought.", move: "I'm on my way down to the med bay.",
                orbit_titan: "I'll go down with the team. Someone should read their names." },
            jaxon: { work: "The drive's running a little hot. Nothing I can't fix.", meal: "Same stew as yesterday. I'm not complaining.", titan: 'I climbed six decks to see that. It was worth it.',
                move: 'Going back down. I want to check the coolant again.', orbit_titan: "Shuttle's fuelled. Say the word.", orbit_chronos: 'We could fill the water tanks here.' },
            vance: { work: 'I check the hold twice a day. Somebody should.', panel: 'The hold weighs more than the manifest says. I want to know why.',
                move: 'Ask the computer how many crates we loaded. Then come and count them.', orbit_titan: "One of the eight ships. Nobody told us they'd failed." },
        },
    };
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    /** at: the world we are in orbit around, if any: its lines come first. */
    function line(stateId, id, say, at) {
        const set = (LINES[stateOf(stateId).id] || {})[id] || {};
        const text = (at && set['orbit_' + at]) || set[say] || set.any || set.work || Object.values(set)[0] || '';
        return { who: id === 'cora' ? 'A.U.R.A.' : NAMES[id], text };
    }

    root.VoyageSim = Object.freeze({ STATES, at, line, build, stateOf, NAMES });
})(typeof window !== 'undefined' ? window : globalThis);
