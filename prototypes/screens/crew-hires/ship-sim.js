/* ═══ Silent Exodus · the living ship (study) · routines, story states and what people say ═════════════════════════
   A routine is a loop of stops ("be at the helm until 40 s, in the chair until 60 s…"). Between stops a person walks
   the floor at the engine's pace (6 px a frame, the planted foot never slides) and climbs the ladder well a deck at a
   time (4 rows a frame, rungs every 8 rows), so everything they do is a pure function of the clock: ShipSim.at(state, t)
   Nobody climbs through anybody (the ladder well, below), and a walker passing someone steps onto the front lane.
   gives the same picture for the same t, which is what lets a still be checked with ?t=ms.
   The last stop of a routine is the first, so the loop has no seam.

   window.ShipSim
     STATES                     [{ id, name, cycle (ms), pair: deck shown first, looks: per-deck looks }]
     at(stateId, t)             [{ id, deck, x, y, act, facing, ms, z, say, screen, dim? }] where everyone is at t
     line(stateId, id, say)     { who, text }: what that person says when clicked (Cora never speaks: A.U.R.A. answers)
*/
(function (root) {
    'use strict';
    const A = root.ShipArt, CE = root.CrewEngine, S = A.SPOTS, L = A.L, ACT = CE.ACTIONS;

    // stops: [spot, act, until (s), extra]   extra: { carry: walk there carrying a crate, snap: no walk (in and out of bed),
    //                                                   say: the line key, screen: false for a console that is not a screen }
    const ROUTINES = {
        normal: {
            cora: [['helm', 'console', 40, { say: 'work' }], ['chair', 'sit', 60], ['window', 'idle', 85], ['seatR2', 'sit', 150, { say: 'meal' }], ['helm', 'console', 200, { say: 'work' }]],
            mira: [['bedMira', 'sleep', 20, { say: 'sleep' }], ['miraBunkEdge', 'sit', 24, { snap: true }], ['bench', 'console', 70, { say: 'work' }], ['map', 'idle', 85, { say: 'map' }],
                ['seatR1', 'sit', 150, { say: 'meal' }], ['miraBunkEdge', 'sit', 156], ['bedMira', 'sleep', 200, { snap: true, say: 'sleep' }]],
            jaxon: [['engDesk', 'console', 40, { say: 'work' }], ['gauges', 'idle', 65, { say: 'work' }], ['engDesk', 'console', 85, { say: 'work' }], ['seatL1', 'sit', 150, { say: 'meal' }], ['engDesk', 'console', 200, { say: 'work' }]],
            aris: [['bedAris', 'sleep', 50, { say: 'sleep' }], ['arisBunkEdge', 'sit', 55, { snap: true }], ['medTerminal', 'console', 95, { say: 'work' }], ['seatL2', 'sit', 150, { say: 'meal' }],
                ['counter', 'console', 176, { say: 'clean', screen: false }], ['arisBunkEdge', 'sit', 181], ['bedAris', 'sleep', 200, { snap: true, say: 'sleep' }]],
            vance: [['holdMid', 'idle', 20, { say: 'work' }], ['holdDrop', 'idle', 45, { carry: true, say: 'work' }], ['holdMidBack', 'idle', 60, { say: 'work' }], ['holdPanel', 'console', 80, { say: 'work' }],
                ['mealStand', 'idle', 150, { say: 'meal' }], ['holdMid', 'idle', 200, { say: 'work' }]],
        },
        vance: {
            vance: [['holdSeat', 'sit', 70, { say: 'sit' }], ['holdWall', 'wall', 110, { say: 'wall' }], ['holdSeat', 'sit', 160, { say: 'sit' }]],
            jaxon: [['hatchWait', 'sit', 55, { say: 'wait' }], ['hatchKneel', 'tend', 75, { say: 'kneel' }], ['hatchWait', 'sit', 160, { say: 'wait' }]],
            aris: [['medTerminal', 'console', 50, { say: 'work' }], ['medDoor', 'idle', 90, { say: 'door' }], ['medTerminal', 'console', 160, { say: 'work' }]],
            mira: [['seatL1', 'sit', 60, { say: 'sit' }], ['bench', 'console', 125, { say: 'work' }], ['seatL1', 'sit', 160, { say: 'sit' }]],
            cora: [['helm', 'console', 70], ['coraHatch', 'idle', 110], ['helm', 'console', 160]],
        },
        hurt: {
            jaxon: [['patient', 'sleep', 160, { say: 'hurt', awake: true }]],
            aris: [['arisBedside', 'console', 60, { say: 'tend', screen: false }], ['medTerminal', 'console', 85, { say: 'work' }], ['arisBedside', 'console', 160, { say: 'tend', screen: false }]],
            mira: [['medWatch', 'idle', 60, { say: 'watch' }], ['seatL1', 'sit', 125, { say: 'meal' }], ['medWatch', 'idle', 160, { say: 'watch' }]],
            vance: [['engDesk', 'console', 60, { say: 'work' }], ['vanceAsk', 'idle', 125, { say: 'ask' }], ['engDesk', 'console', 160, { say: 'work' }]],
            cora: [['helm', 'console', 30], ['coraBedside', 'idle', 100], ['helm', 'console', 160]],
        },
        death: {
            aris: [['miraBunkEdge', 'sit', 90, { say: 'edge' }], ['medTerminal', 'console', 150, { say: 'work' }], ['miraBunkEdge', 'sit', 180, { say: 'edge' }]],
            jaxon: [['seatL1', 'sit', 70, { say: 'meal' }], ['engDesk', 'console', 130, { say: 'work' }], ['seatL1', 'sit', 180, { say: 'meal' }]],
            vance: [['holdWall', 'wall', 50, { say: 'wall' }], ['vanceBench', 'idle', 100, { say: 'bench' }], ['holdWall', 'wall', 180, { say: 'wall' }]],
            cora: [['window', 'idle', 100], ['chair', 'sit', 170], ['window', 'idle', 180]],
        },
        sleepers: {
            aris: [['podPanel', 'console', 60, { say: 'pod', screen: false }], ['podsBack', 'idle', 100, { say: 'pod' }], ['medTerminal', 'console', 140, { say: 'work' }], ['podPanel', 'console', 180, { say: 'pod', screen: false }]],
            vance: [['crateFrom', 'idle', 20, { say: 'idle' }], ['crateTo', 'idle', 50, { carry: true, say: 'carry' }], ['crateFrom', 'idle', 80, { say: 'idle' }], ['crateTo', 'idle', 110, { carry: true, say: 'carry' }], ['crateFrom', 'idle', 180, { say: 'idle' }]],
            mira: [['podsLook', 'idle', 70, { say: 'look' }], ['bench', 'console', 150, { say: 'work' }], ['podsLook', 'idle', 180, { say: 'look' }]],
            jaxon: [['engDesk', 'console', 90, { say: 'work' }], ['jaxonPods', 'idle', 150, { say: 'look' }], ['engDesk', 'console', 180, { say: 'work' }]],
            cora: [['helm', 'console', 30], ['coraPods', 'idle', 120], ['helm', 'console', 180]],
        },
    };
    const EXTRA = {                                                             // spots only one state needs
        arisBunkEdge: { deck: 2, x: 216, facing: 1 }, mealStand: { deck: 2, x: 548, facing: -1 }, coraHatch: { deck: 3, x: 176, facing: -1 },
        vanceAsk: { deck: 3, x: 300, facing: 1 }, coraBedside: { deck: 3, x: 612, facing: -1 }, vanceBench: { deck: 1, x: 338, facing: 1 },
        jaxonPods: { deck: 4, x: 420, facing: 1 }, coraPods: { deck: 4, x: 384, facing: 1 },
    };
    const spot = name => S[name] || EXTRA[name];

    const STATES = [
        { id: 'normal', name: 'Normal', cycle: 200000, pair: 1, looks: {} },
        { id: 'vance', name: 'Vance shut in the hold', cycle: 160000, pair: 3, looks: { 3: { hatchClosed: true, waiting: true }, 4: { hatchClosed: true, dark: true } } },
        { id: 'hurt', name: 'Aris tending Jaxon', cycle: 160000, pair: 2, looks: { 3: { stretcher: true } } },
        { id: 'death', name: 'After a death', cycle: 180000, pair: 1, looks: { 1: { mira: 'gone' }, 2: { mira: 'gone' } }, gone: ['mira'] },
        { id: 'sleepers', name: 'Sleepers aboard', cycle: 180000, pair: 3, looks: { 4: { pods: true } } },
    ];
    const stateOf = id => STATES.find(s => s.id === id) || STATES[0];

    // ── building a routine into timed pieces ────────────────────────────────────────────────────────────────────
    const tendX = (id, patientX) => patientX + 42 - CE.sprite(id, 'tend', 0).hands[1].x;
    function place(id, stop) {
        const [name, act] = stop;
        if (name === 'tend') { const P = S.patient; return { deck: P.deck, x: tendX(id, P.x), facing: 1 }; }
        const s = spot(name);
        if (!s) throw new Error('ShipSim: no spot called ' + name);
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
                else if (typeof console !== 'undefined') console.warn(`ShipSim: ${st.id}/${id} reaches ${stop[0]} late (${(t / 1000).toFixed(1)} s > ${stop[2]} s)`);
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
        normal: {
            cora: { any: 'Four crew, Commander. All accounted for.' },
            jaxon: { work: "The drive's running a little hot. Nothing I can't fix.", meal: "Same stew as yesterday. I'm not complaining.", move: 'Going back down. I want to check the coolant again.' },
            aris: { sleep: "Only wake me if someone's hurt.", work: "Everyone's due a check-up this week. You too, Commander.", meal: 'Sit down for once. The ship can fly itself for ten minutes.',
                clean: "I'll do the dishes. Go and get some sleep.", any: "I'm on my way down to the med bay." },
            mira: { work: "A.U.R.A. found a star that isn't on any chart. I'm checking her numbers.", map: "I've copied the star map. I still can't read all of it.",
                meal: "Did you see the readings this morning? I couldn't sleep after that.", sleep: "Tell A.U.R.A. I'll be up soon.", any: 'Back to the lab. I left a scan running.' },
            vance: { work: 'I check the hold twice a day. Somebody should.', meal: "I'll eat standing up. My back's bad today.", any: 'Ask the computer how many crates we loaded. Then come and count them.' },
        },
        vance: {
            cora: { any: 'Vance has locked both hold hatches, Commander. He is unharmed.' },
            vance: { sit: "Leave me alone. I'll come up when I'm ready.", wall: 'I worked at the shipyard. I know what I saw.', any: "Leave me alone. I'll come up when I'm ready." },
            jaxon: { wait: "He's been down there six hours. I'm not leaving.", kneel: "Vance, it's Jaxon. Open the hatch and talk to me.", any: "He's been down there six hours. I'm not leaving." },
            aris: { work: "I left food by the hatch. He hasn't touched it.", door: "Give him time. Pushing him won't help.", any: 'Give him time. Pushing him won\'t help.' },
            mira: { sit: "Why won't he come up? Did someone say something to him?", work: "I can't focus. I keep listening for the hatch.", any: "Why won't he come up? Did someone say something to him?" },
        },
        hurt: {
            cora: { any: "Jaxon's burns are treated, Commander. He should rest for two days." },
            jaxon: { any: "It's just my hand. I need to get back to the drive." },
            aris: { tend: "Keep still, Jaxon. It's a bad burn, but you'll keep the hand.", work: "His pulse is steady. That's good.", any: "His pulse is steady. That's good." },
            mira: { watch: 'There was so much steam. I thought he was gone.', meal: "I can't eat. I keep hearing the alarm.", any: 'There was so much steam. I thought he was gone.' },
            vance: { ask: "Is he going to be all right? Don't soften it.", work: "I'm covering the drive. Jaxon left notes on everything.", any: "Is he going to be all right? Don't soften it." },
        },
        death: {
            cora: { any: "Commander, Mira's experiment is still running in the lab. Should I stop it?" },
            aris: { edge: "I wrote her name in the book. I never thought I'd write one of ours.", work: "I keep reading her chart. There's nothing left to check.", any: "I wrote her name in the book. I never thought I'd write one of ours." },
            jaxon: { meal: 'I keep setting out five bowls.', work: "Work helps. Don't ask me to stop.", any: 'I keep setting out five bowls.' },
            vance: { wall: 'We should have turned back. I said so.', bench: "She left her scan running. I can't make myself turn it off.", any: 'We should have turned back. I said so.' },
        },
        sleepers: {
            cora: { any: 'Four people in stasis, Commander. Their pods are stable.' },
            aris: { pod: "Their hearts are slow but steady. Whoever they are, they're alive.", work: "I'm checking their pods every hour until we know more.", any: "Their hearts are slow but steady. Whoever they are, they're alive." },
            vance: { carry: "We don't know who these people are. Nobody wakes them yet.", idle: "Four strangers in my hold. I don't like it.", any: "We don't know who these people are. Nobody wakes them yet." },
            mira: { look: 'There are people in there! A.U.R.A., can you tell who they are?', work: "I'm searching the old ship lists for their names.", any: 'There are people in there! A.U.R.A., can you tell who they are?' },
            jaxon: { look: "Each pod draws power. I'll find it somewhere.", work: "I've moved power to the hold. The pods come first now.", any: "Each pod draws power. I'll find it somewhere." },
        },
    };
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    function line(stateId, id, say) {
        const set = (LINES[stateOf(stateId).id] || {})[id] || {};
        const text = set[say] || set.any || set.work || Object.values(set)[0] || '';
        return { who: id === 'cora' ? 'A.U.R.A.' : NAMES[id], text };
    }

    root.ShipSim = Object.freeze({ STATES, at, line, build, stateOf, NAMES });
})(typeof window !== 'undefined' ? window : globalThis);
