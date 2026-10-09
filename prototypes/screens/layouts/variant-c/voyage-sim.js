/* ═══ Silent Exodus · layout variant C ("Deck strip") · the crew on a voyage ═══════════════════════════════════════════
   A copy of the machinery in ../crew-hires/ship-sim.js (walk, ladder well, lanes, poses: unchanged), driven by a timed
   plan instead of a looping day, so the crew can react to the world we are flying past. Nothing in crew-hires is edited.

   window.VoyageSim
     plan(routines, t0)    routines: { id: { from?: { deck, x, facing }, stops: [[spot, act, until (s), extra]] } }
                           → a plan: per person, timed pieces. Times are absolute ms; t0 is when the plan starts.
     at(plan, t)           [{ id, deck, x, y, act, facing, ms, z, say, screen }] where everyone is at t
     pieceAt(plan, id, t)  the piece someone is on at t (used to re-plan from where they are)
     spot(name)            ShipArt.SPOTS plus the few spots this layout adds
     deckAtY(y)
*/
(function (root) {
    'use strict';
    const A = root.ShipArt, CE = root.CrewEngine, S = A.SPOTS, L = A.L, ACT = CE.ACTIONS;

    // spots this layout adds: the bridge windows, and where people stand to watch a world go by
    const EXTRA = {
        vWin: { deck: 0, x: 296, facing: 1 }, vWin2: { deck: 0, x: 284, facing: -1 },
        mWin: { deck: 0, x: 470, facing: -1 }, mWin2: { deck: 0, x: 430, facing: -1 }, jNav: { deck: 0, x: 556, facing: -1 },
        mealStand: { deck: 2, x: 548, facing: -1 }, arisBed: { deck: 3, x: 474, facing: 1 },
    };
    const spot = name => S[name] || EXTRA[name];

    function place(id, stop) {
        const [name, act] = stop;
        const s = spot(name);
        if (!s) throw new Error('VoyageSim: no spot called ' + name);
        return { deck: s.deck, x: s.x, facing: s.facing, h: act === 'sleep' ? s.h : 0 };
    }
    function walkPiece(deck, x0, x1, t0, carry) {
        const a = carry ? ACT.carry : ACT.walk, n = Math.ceil(Math.abs(x1 - x0) / a.move);
        return { kind: 'walk', deck, x0, x1, t0, t1: t0 + n * a.ms, act: carry ? 'carry' : 'walk' };
    }
    // ── the ladder well (ship-sim.js): nobody climbs through anybody; a plan never wraps, so no cycle ────────────────
    const LADDER_PAD = 800, LADDER_SEP = 96, LADDER_STEP = 250, WAIT_X = L.LX + 30, WAIT_GAP = 18;
    function ladderWell() {
        const held = [], waits = [];
        const yAt = (c, t) => (t <= c.t0 ? c.y0 : t >= c.t1 ? c.y1 : c.y0 + (c.y1 - c.y0) * (t - c.t0) / (c.t1 - c.t0));
        return {
            clear(c) {
                for (const R of held) {
                    const a0 = Math.max(c.t0, R.t0) - LADDER_PAD, a1 = Math.min(c.t1, R.t1) + LADDER_PAD;
                    for (let t = a0; t <= a1; t += 100) if (Math.abs(yAt(c, t) - yAt(R, t)) < LADDER_SEP) return false;
                }
                return true;
            },
            take(c) { held.push(c); },
            spot(deck, t0, t1) {
                for (let k = 0; ; k++) {
                    const x = WAIT_X + k * WAIT_GAP;
                    if (!waits.some(w => w.deck === deck && w.x === x && t0 < w.t1 + 800 && t1 + 800 > w.t0)) { waits.push({ deck, x, t0, t1 }); return x; }
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
        if (start > direct.t1) {
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

    /** Builds a plan. People are planned in the order given, so the first never waits at the ladder. */
    function plan(routines, t0 = 0) {
        const well = ladderWell(), out = {};
        Object.keys(routines).forEach(id => {
            const r = routines[id], stops = r.stops, pieces = [];
            let t = r.t0 != null ? r.t0 : t0, cur = r.from || place(id, stops[0]);
            if (r.before) pieces.push(...r.before);                                  // a piece someone finishes first (a climb under way)
            stops.forEach(stop => {
                const to = place(id, stop), ex = stop[3] || {};
                if (!ex.snap) travel(cur, to, t, !!ex.carry, well).forEach(p => { pieces.push(p); t = p.t1; });
                const until = stop[2] * 1000;
                if (until > t) pieces.push({ kind: 'stay', deck: to.deck, x: to.x, facing: to.facing, h: to.h, act: stop[1], t0: t, t1: until, say: ex.say || stop[1], screen: ex.screen });
                t = Math.max(t, until); cur = to;
            });
            out[id] = pieces;
        });
        return out;
    }

    const deckAtY = y => Math.max(0, Math.min(L.N - 1, Math.floor((y - L.TOP0 - 1) / L.PITCH)));
    function poseOf(id, p, t) {
        const lt = t - p.t0;
        if (p.kind === 'stay') {
            const lying = p.act === 'sleep';
            return { id, deck: p.deck, x: p.x, y: A.floorY(p.deck) - (lying ? p.h : 0), act: p.act, facing: p.facing, ms: t, z: lying ? 1 : p.act === 'sit' && (p.x === S.seatL2.x || p.x === S.seatR2.x) ? 1.5 : 2,
                say: p.say, screen: p.screen };
        }
        if (p.kind === 'walk') {
            const a = ACT[p.act], dir = Math.sign(p.x1 - p.x0) || 1, step = Math.floor(Math.max(0, lt) / a.ms);
            return { id, deck: p.deck, x: p.x0 + dir * Math.min(Math.abs(p.x1 - p.x0), step * a.move), y: A.floorY(p.deck), act: p.act, facing: dir, ms: Math.max(0, lt), z: 3, say: 'move' };
        }
        const up = p.y1 < p.y0, k = Math.max(0, Math.min(p.n, Math.floor(lt / ACT.climb.ms))), step = up ? k : p.n - k;
        const y = up ? p.y0 - ACT.climb.rise * k : p.y1 - ACT.climb.rise * (p.n - k);
        return { id, deck: deckAtY(y - 50), x: L.LX, y, act: 'climb', facing: 1, ms: (step % ACT.climb.frames) * ACT.climb.ms + 1, z: 0.5, say: 'move' };
    }
    const LANE = 3, LANE_NEAR = 34, LANE_EASE = 14;
    function lanes(people) {
        const moving = q => q.act === 'walk' || q.act === 'carry';
        const still = people.filter(q => !moving(q) && q.act !== 'climb');
        return people.map(p => {
            if (!moving(p)) return p;
            const others = still.concat(p.facing < 0 ? people.filter(q => q !== p && moving(q) && q.facing > 0) : []);
            const near = others.filter(q => q.deck === p.deck).reduce((m, q) => Math.min(m, Math.abs(q.x - p.x)), Infinity);
            const k = Math.max(0, Math.min(1, (LANE_NEAR - near) / LANE_EASE));
            return k > 0 ? Object.assign({}, p, { y: p.y + Math.round(k * LANE), z: 4 }) : p;
        });
    }
    function pieceAt(P, id, t) {
        const list = P[id];
        return list.find(q => t >= q.t0 && t < q.t1) || (t < list[0].t0 ? list[0] : list[list.length - 1]);
    }
    function at(P, t) { return lanes(Object.keys(P).map(id => poseOf(id, pieceAt(P, id, t), t))); }

    root.VoyageSim = Object.freeze({ plan, at, pieceAt, spot, deckAtY, poseOf });
})(typeof window !== 'undefined' ? window : globalThis);
