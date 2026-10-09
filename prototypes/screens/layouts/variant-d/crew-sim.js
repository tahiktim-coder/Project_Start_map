/* ═══ Silent Exodus · layout variant D, "The bridge" · the crew's day, and what they say ═════════════════════════════
   The living ship's way of moving people (crew-hires/ship-sim.js), cut down to the bridge and the deck under it: a
   routine is a loop of stops; between stops a person walks the floor at the engine's pace and climbs the ladder well a
   deck at a time, so where everyone is is a pure function of the clock. The routines are written around the run's two
   passing places (Journey.PLACES): someone goes to the window as each one slides by.
   A stop (the player clicked a world) splices in one more piece per person: everyone turns to the window, Jaxon takes
   the helm, and stays there.
   Decks here: 0 the bridge (floor 644), 1 the lab (852), 2 everything further down (out of sight).

   window.BridgeCrew = { CYCLE, SPOTS, at(t, stop), line(id, say, ctx) }
*/
(function (root) {
    'use strict';
    const A = root.ShipArt, CE = root.CrewEngine, L = A.L, ACT = CE.ACTIONS;
    const FLOOR = [A.floorY(0), A.floorY(1), A.floorY(2)];
    const CYCLE = 300000;
    const SPOTS = {
        chair: { deck: 0, x: 230, facing: 1 }, helm: { deck: 0, x: 360, facing: 1 }, nav: { deck: 0, x: 488, facing: 1 },
        byCora: { deck: 0, x: 270, facing: -1 },
        wA: { deck: 0, x: 214, facing: 1 }, w3o: { deck: 0, x: 328, facing: -1 }, w1: { deck: 0, x: 254, facing: 1 }, w2: { deck: 0, x: 290, facing: 1 }, w3: { deck: 0, x: 326, facing: 1 },
        labMap: { deck: 1, x: 262, facing: -1 }, labBench: { deck: 1, x: 338, facing: 1 },
        below: { deck: 2, x: 170, facing: 1 },
    };
    // [spot, act, until (s), { say }]. The last stop of each is where the loop starts.
    const ROUTINES = {
        cora: [['chair', 'sit', 128, { say: 'chair' }], ['w2', 'idle', 150, { say: 'window' }], ['chair', 'sit', 300, { say: 'chair' }]],
        jaxon: [['helm', 'console', 50, { say: 'helm' }], ['below', 'idle', 112, { say: 'below' }], ['helm', 'console', 300, { say: 'helm' }]],
        aris: [['below', 'idle', 18, { say: 'below' }], ['byCora', 'idle', 50, { say: 'check' }], ['w1', 'idle', 76, { say: 'look' }], ['below', 'idle', 300, { say: 'below' }]],
        mira: [['nav', 'console', 50, { say: 'work' }], ['w3', 'idle', 76, { say: 'look' }], ['nav', 'console', 190, { say: 'work' }], ['w3', 'idle', 216, { say: 'look' }], ['nav', 'console', 300, { say: 'work' }]],
        vance: [['labMap', 'idle', 60, { say: 'map' }], ['labBench', 'console', 150, { say: 'lab' }], ['w1', 'idle', 222, { say: 'look' }], ['labMap', 'idle', 300, { say: 'map' }]],
    };
    const ORDER = ['cora', 'jaxon', 'aris', 'mira', 'vance'];

    // ── building a routine into timed pieces (ship-sim.js, without the ladder queue: these routines never share it) ──
    function walkPiece(deck, x0, x1, t0) {
        const a = ACT.walk, n = Math.ceil(Math.abs(x1 - x0) / a.move);
        return { kind: 'walk', deck, x0, x1, t0, t1: t0 + n * a.ms, act: 'walk' };
    }
    function travel(from, to, t0) {
        const out = [];
        let t = t0;
        const push = p => { if (p.t1 > p.t0) { out.push(p); t = p.t1; } };
        if (from.deck === to.deck) { push(walkPiece(from.deck, from.x, to.x, t)); return out; }
        const y0 = FLOOR[from.deck], y1 = FLOOR[to.deck], n = Math.abs(y1 - y0) / ACT.climb.rise;
        push(walkPiece(from.deck, from.x, L.LX, t));
        push({ kind: 'climb', y0, y1, n, t0: t, t1: t + n * ACT.climb.ms, toDeck: to.deck });
        push(walkPiece(to.deck, L.LX, to.x, t));
        return out;
    }
    const stay = (to, act, t0, t1, ex) => ({ kind: 'stay', deck: to.deck, x: to.x, facing: to.facing, act, t0, t1, say: (ex && ex.say) || act });
    function buildBase(id) {
        const stops = ROUTINES[id], pieces = [];
        let t = 0, cur = SPOTS[stops[stops.length - 1][0]];
        stops.forEach(([name, act, until, ex]) => {
            const to = SPOTS[name];
            travel(cur, to, t).forEach(p => { pieces.push(p); t = p.t1; });
            if (until * 1000 > t) pieces.push(stay(to, act, t, until * 1000, ex));
            t = Math.max(t, until * 1000); cur = to;
        });
        return pieces;
    }
    const BASE = {};
    ORDER.forEach(id => { BASE[id] = buildBase(id); });

    // ── a stop: everyone answers it ──
    const ARRIVE = {                                                              // where each goes, and how long they take to react
        cora: { delay: 400, to: () => 'w2', act: 'idle', say: 'orbit' },
        jaxon: { delay: 0, to: () => 'helm', act: 'console', say: 'orbit' },
        mira: { delay: 1500, to: () => 'w3o', act: 'idle', say: 'orbit' },
        aris: { delay: 2300, to: () => 'w1', act: 'idle', say: 'orbit' },
        vance: { delay: 2800, to: deck => (deck === 0 ? 'wA' : 'labMap'), act: 'idle', say: 'orbit' },
    };
    const builtStops = new Map();
    function withStop(id, ts) {
        const key = id + ':' + ts;
        if (builtStops.has(key)) return builtStops.get(key);
        const base = BASE[id], out = [];
        let t = ts, from = null;
        for (const p of base) {
            if (p.t1 <= ts) { out.push(p); continue; }
            if (p.t0 >= ts) break;
            if (p.kind === 'stay') { out.push(Object.assign({}, p, { t1: ts })); from = { deck: p.deck, x: p.x }; t = ts; }
            else if (p.kind === 'walk') { out.push(p); from = { deck: p.deck, x: p.x1 }; t = p.t1; }
            else { out.push(p); from = { deck: p.toDeck, x: L.LX }; t = p.t1; }
            break;
        }
        if (!from) { const last = out[out.length - 1]; from = { deck: last.deck != null ? last.deck : last.toDeck, x: last.x != null ? last.x : L.LX }; t = Math.max(ts, last.t1); }
        const a = ARRIVE[id], to = SPOTS[a.to(from.deck)];
        const wait = ts + a.delay;
        if (wait > t) { out.push({ kind: 'stay', deck: from.deck, x: from.x, facing: lastFacing(out), act: lastAct(out), t0: t, t1: wait, say: 'orbit' }); t = wait; }
        travel(from, to, t).forEach(p => { out.push(p); t = p.t1; });
        out.push(stay(to, a.act, t, Infinity, { say: a.say }));
        builtStops.set(key, out);
        return out;
    }
    const lastFacing = out => { for (let i = out.length - 1; i >= 0; i--) { const p = out[i]; if (p.facing) return p.facing; if (p.kind === 'walk') return Math.sign(p.x1 - p.x0) || 1; } return 1; };
    const lastAct = out => { const p = out[out.length - 1]; return p && p.kind === 'stay' ? p.act : 'idle'; };

    // ── where someone is at t ──
    const deckAtY = y => (y <= FLOOR[0] + 18 ? 0 : y <= FLOOR[1] + 18 ? 1 : 2);
    function poseOf(id, p, t) {
        const lt = t - p.t0;
        if (p.kind === 'stay') return { id, deck: p.deck, x: p.x, y: FLOOR[p.deck], act: p.act, facing: p.facing, ms: t, z: p.act === 'sit' ? 1.5 : 2, say: p.say };
        if (p.kind === 'walk') {
            const a = ACT.walk, dir = Math.sign(p.x1 - p.x0) || 1, step = Math.floor(lt / a.ms);
            return { id, deck: p.deck, x: p.x0 + dir * Math.min(Math.abs(p.x1 - p.x0), step * a.move), y: FLOOR[p.deck], act: 'walk', facing: dir, ms: lt, z: 3, say: 'move' };
        }
        const up = p.y1 < p.y0, k = Math.min(p.n, Math.floor(lt / ACT.climb.ms)), step = up ? k : p.n - k;
        const y = up ? p.y0 - ACT.climb.rise * k : p.y1 - ACT.climb.rise * (p.n - k);
        return { id, deck: deckAtY(y - 50), x: L.LX, y, act: 'climb', facing: 1, ms: (step % ACT.climb.frames) * ACT.climb.ms + 1, z: 0.5, say: 'move' };
    }
    // a walker passing someone steps onto the front lip of the floor (ship-sim.js lanes, copied)
    const LANE = 3, LANE_NEAR = 34, LANE_EASE = 14;
    function lanes(people) {
        const moving = q => q.act === 'walk';
        const still = people.filter(q => !moving(q) && q.act !== 'climb');
        return people.map(p => {
            if (!moving(p)) return p;
            const others = still.concat(p.facing < 0 ? people.filter(q => q !== p && moving(q) && q.facing > 0) : []);
            const near = others.filter(q => q.deck === p.deck).reduce((m, q) => Math.min(m, Math.abs(q.x - p.x)), Infinity);
            const k = Math.max(0, Math.min(1, (LANE_NEAR - near) / LANE_EASE));
            return k > 0 ? Object.assign({}, p, { y: p.y + Math.round(k * LANE), z: 4 }) : p;
        });
    }
    function at(t, stop) {
        return lanes(ORDER.map(id => {
            const P = stop ? withStop(id, stop.t0) : BASE[id], tt = stop ? t : ((t % CYCLE) + CYCLE) % CYCLE;
            const p = P.find(q => tt >= q.t0 && tt < q.t1) || P[P.length - 1];
            return poseOf(id, p, tt);
        }));
    }

    // ── what people say (docs/STYLE.md: plain, one idea, 20 words at most; Cora never speaks, A.U.R.A. answers) ──
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    const LINES = {
        cora: { any: 'Four crew, Commander. All accounted for.' },
        jaxon: { helm: "Holding her steady. The drive's running a little hot.", below: 'Going down to the drive. Back in an hour.', move: "Mind the ladder. I'm coming through.",
            orbit: "Shuttle's fuelled and checked. Bring it back in one piece." },
        aris: { check: "Everyone's due a check-up this week. You too, Commander.", below: "I'm on my way down to the med bay.", move: "I'm on my way down to the med bay.",
            look: "If anyone's down there, they've waited a long time.", orbit: "In orbit. The med bay's ready if anyone needs it." },
        mira: { work: "A.U.R.A. found a star that isn't on any chart. I'm checking her numbers.", move: 'Wait. Look at this.' },
        vance: { map: "Mira says this map matters. It looks like scribbles to me.", lab: 'Ask the computer how many crates we loaded. Then come and count them.',
            move: 'I want to see this one for myself.', orbit: "I'll get the hold ready, in case we bring anything back." },
    };
    /** ctx: { place (the world in view or stopped at), stopped, reach } */
    function line(id, say, ctx = {}) {
        const pl = ctx.place;
        if (id === 'cora') {
            if (ctx.stopped && pl) return { who: 'A.U.R.A.', text: pl.orbit.arrive[1] };
            if (pl && pl.reachLine) return { who: 'A.U.R.A.', text: pl.reachLine[1] };
            if (pl) return { who: 'A.U.R.A.', text: pl.line };
            return { who: 'A.U.R.A.', text: LINES.cora.any };
        }
        if ((say === 'look' || (id === 'mira' && ctx.stopped)) && pl) {                     // at the window: the world's own remark
            if (pl.react && pl.react[0] === NAMES[id]) return { who: NAMES[id], text: pl.react[1] };
            if (id === 'mira') return { who: 'Mira', text: pl.id === 'zeta' ? 'Its docking port still answers. After all this time.' : pl.react[1] };
        }
        const set = LINES[id], text = set[say] || set.look || set.work || set.helm || Object.values(set)[0];
        return { who: NAMES[id], text };
    }

    root.BridgeCrew = { CYCLE, SPOTS, FLOOR, at, line, NAMES };
})(typeof window !== 'undefined' ? window : globalThis);
