/* ═══ Silent Exodus · new screen (?new=1) · stop/Plans.js: where the people on the bridge are, on the shell's clock ════════
   What it is (look pass B07, out of stop/Stop.js, which keeps it under 800 lines): each person's plan is a list of steps,
   a stay, a walk along the floor, a climb up or down the hatch's ladder, or gone, each from t0 to t1 (shell ms); poseOf reads
   where they are now. Stop.js decides who goes where (desired, reconcile); this only moves them.
   Loaded only when the new-screen switch is on, before stop/Stop.js.

   window.NSStopPlans (frozen)
     create(S, { F, HATCH, WALK, CLIMB }) → { lastOf, stayPlan, hidePlan, cut, walkTo, enterTo, exitDown, poseOf }
       S.plans: id → steps;  F: the floor row;  HATCH: the ladder's x;  WALK, CLIMB: CrewEngine.ACTIONS' walk and climb
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const ROWS = 64;                                                      // the ladder's rows, from the lab to the bridge's floor
    function create(S, o) {
        const { F, HATCH, WALK, CLIMB } = o;
        const lastOf = id => { const pl = S.plans[id]; return pl && pl[pl.length - 1]; };
        function stayPlan(id, x, act, facing) { S.plans[id] = [{ kind: 'stay', x, act, facing, t0: -1e9, t1: Infinity }]; }
        function hidePlan(id) { S.plans[id] = [{ kind: 'gone', t0: -1e9, t1: Infinity }]; }
        function cut(id, t) {                                             // end the plan at t; returns where they are
            const pl = S.plans[id] || [], pose = poseOf(id, t);
            S.plans[id] = pl.filter(s => s.t0 < t).map(s => (s.t1 > t ? Object.assign({}, s, { t1: t }) : s));
            return pose;
        }
        function walkTo(id, t, x, act, facing) {
            const from = cut(id, t), pl = S.plans[id];
            if (!from || from.hidden) { enterTo(id, t, x, act, facing); return; }
            const n = Math.ceil(Math.abs(x - from.x) / WALK.move), t1 = t + n * WALK.ms;
            if (n > 0) pl.push({ kind: 'walk', x0: from.x, x1: x, t0: t, t1 });
            pl.push({ kind: 'stay', x, act, facing, t0: t1, t1: Infinity });
        }
        function enterTo(id, t, x, act, facing) {                         // up the ladder through the hatch, then along the floor
            cut(id, t);
            const pl = S.plans[id], tc = t + (ROWS / CLIMB.rise) * CLIMB.ms, n = Math.ceil(Math.abs(x - HATCH) / WALK.move), tw = tc + n * WALK.ms;
            pl.push({ kind: 'climb', y0: F + ROWS, y1: F, t0: t, t1: tc }, { kind: 'walk', x0: HATCH, x1: x, t0: tc, t1: tw }, { kind: 'stay', x, act, facing, t0: tw, t1: Infinity });
        }
        function exitDown(id, t) {                                        // returns when they are gone down the hatch
            const from = cut(id, t), pl = S.plans[id];
            if (!from || from.hidden) { hidePlan(id); return t; }
            const n = Math.ceil(Math.abs(from.x - HATCH) / WALK.move), tw = t + n * WALK.ms, tc = tw + (ROWS / CLIMB.rise) * CLIMB.ms;
            pl.push({ kind: 'walk', x0: from.x, x1: HATCH, t0: t, t1: tw }, { kind: 'climb', y0: F, y1: F + ROWS, t0: tw, t1: tc }, { kind: 'gone', t0: tc, t1: Infinity });
            return tc;
        }
        function poseOf(id, t) {
            const pl = S.plans[id]; if (!pl || !pl.length) return null;
            const s = pl.find(q => t >= q.t0 && t < q.t1) || pl[pl.length - 1], lt = t - s.t0;
            if (s.kind === 'gone') return { hidden: true };
            if (s.kind === 'stay') return { x: s.x, y: F, act: s.act, facing: s.facing, ms: t };
            if (s.kind === 'walk') { const dir = Math.sign(s.x1 - s.x0) || 1; return { x: s.x0 + dir * Math.min(Math.abs(s.x1 - s.x0), Math.floor(lt / WALK.ms) * WALK.move), y: F, act: 'walk', facing: dir, ms: lt }; }
            const k = Math.floor(lt / CLIMB.ms), dy = Math.min(Math.abs(s.y1 - s.y0), k * CLIMB.rise);
            return { x: HATCH, y: s.y0 + Math.sign(s.y1 - s.y0) * dy, act: 'climb', facing: 1, ms: (k % CLIMB.frames) * CLIMB.ms + 1, climbing: true };
        }
        return { lastOf, stayPlan, hidePlan, cut, walkTo, enterTo, exitDown, poseOf };
    }
    window.NSStopPlans = Object.freeze({ create });
})();
