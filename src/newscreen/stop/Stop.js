/* ═══ Silent Exodus · new screen (?new=1) · stop/Stop.js: a stop, on the bridge ════════════════════════════════════════
   What it is: arriving at a world, the view dives through our hull onto the bridge (layout D): the world fills the big
   window, Cora is at the helm, Mira at her console, and whoever may go down comes up the ladder to the window. What we can
   do here is shown as designed tags on the window glass, each tied by a thin thread to what it acts on (stop/Words.js:
   "Scan" by the world's limb, "Dock" to the station's port, "Answer the call" to the blink in the sky...); "Leave orbit"
   is a lit key on Cora's console. A team trip: once the bridge has been seen a moment, the crew put the best two forward
   for this world (NSOrbit.propose) and those two walk from the window to the hatch and stand by it, facing the window,
   each with their name and why over them; the "GO DOWN" tag stands over the hatch. A click on someone at the hatch sends
   them back to the window (a place opens: the tag says "one more"); a click on someone at the window puts them in the open
   place, or in the place of whoever joined last. Only two fit, both well: both go, nobody changes. A trip is never locked
   (NSOrbit.pool): with fewer than two well the hurt come up to the window too; one goes (the crew put the well one
   forward) and a hurt one goes beside them only if clicked to the hatch; the one left who can go goes alone.
   "GO DOWN": the two climb down the hatch, THEN the shuttle drops to where they go (a click hurries it), then the real
   game runs the trip (LanderGame, the Torch, the cards). When they are back the shuttle comes up and they climb back; if a
   find is still open, two step forward
   at once, while it comes up (anyone still in it climbs in when it is home, straight to their place), and the next trip
   from here goes down the hatch at once (nobody walks it twice; a shuttle still coming up docks first).
   "Leave orbit" plays the dive backwards. The bridge marks the world seen when it closes (NewScreen.js holds a card that
   turns up on its own a shorter time on a world seen before).
   A world nobody has scanned is scanned as we arrive (NewScreen.flow.scanDue): once the world has braked in, the glass
   sweeps it (no click lands meanwhile; the first time in a run A.U.R.A. says what that is, NSOrbit.TELL.scan), then the
   game scans it and its finds show as tags with marks on the world (stop/Words.js, WorldFinds.js). Only the copy of Earth
   still has a Scan tag (one click, the same sweep). A click on a find (its tag or its mark) is where GO DOWN goes: the
   shuttle aims there (NSGlass.aim), never while it is flying.
   Every action calls the REAL game through NewScreen.flow (Orbit.js): costs, events, rewards and saves are today's.
   Anyone too weak from a missed supper is not put forward and stands apart, by the suit locker; pointing says why.
   A card that turns up while the bridge is up takes no click for 400 ms (ChoiceGuard).
   Source: prototypes/slice/stop.js §5-12 (people plans, compose, the pick, anchors, discs), without its films, MOCKUP
   moments and slice places (docs/BUILD_B.md §2). Draws ONLY into canvas#ns-dive, canvas#ns-bridge and (through
   stop/Words.js) the word layer #ns-stop-words. Loaded only when the new-screen switch is on, after stop/BridgeArt,
   stop/Dive, stop/Glass, stop/TagArt, stop/Tags and stop/Words.

   NewScreen.mods.stop = { init, resize, update, render, pointer, isOpen, discs, noteUp, debug }
     pointer(type, e)       the shell routes every pointer event here while its mode is not 'travel'; CSS px from e
     isOpen() → bool        the dive or the bridge is on screen
     discs() → [[x, y, r]]  CSS px: the world in the glass and the people on the bridge (words keep off them)
     noteUp() → bool        a person's note is up (the voice steps back meanwhile)
   Listens: 'dive:start' { id }  'dive:cancel'  'stop:open' { id, dived }  'stop:refresh'  'dive:back'  'trip:down' { ids }
            'trip:back'  'flow:go' { id } (bakes ahead)  'hidden'  'hull:hit' { deck } (NSOrbit: the bridge jolts and the lamps dip,
            HIT; reduced motion: one dip only)
   Emits:   'dive:plated' { dir }  'stop:shown' { id }  'stop:hidden' { id }  'stop:pick' { ids }
   Calls:   NewScreen.flow.actions(), .act(key, ids), .eligible(), .weak(), .propose(), .leave(), .finds(ids), .aim(id), .scanDue()
   Anchors (CSS px, while open): 'stop:person:<id>', 'stop:aura', 'stop:glass', 'stop:site'
*/
(function () {
    'use strict';
    const NS = window.NewScreen, P = window.NSPaint, A = window.ShipArt, BA = window.NSBridgeArt, CE = window.CrewEngine;
    const D = window.NSDive, GL = window.NSGlass, WORDS = window.NSStopWords, TA = window.NSTagArt;
    if (!NS || !NS.on || !P || !A || !BA || !CE || !D || !GL || !WORDS) return;
    const { INK, RP, threshold } = P, L = A.L, B = BA.B, R = A.R;
    const SW = GL.SW, SH = GL.SH, OFFX = GL.OFFX, WIN = GL.WIN, F = B.F, STEPS = D.STEPS, PUSH = D.PUSH, DISSOLVE = D.DISSOLVE;
    const SPOT_X = { jaxon: 228, aris: 262, vance: 296, mira: 330 };      // layout D's window spots (fixed per person), clear of the hatch's two
    const HATCH_X = [124, 172];                                           // the two put forward stand here, by the hatch, facing the window
    const ASIDE = [{ x: 600, facing: -1 }, { x: 574, facing: -1 }];       // too weak from a missed supper: apart, by the suit locker
    const HELM = 360, NAV = 488, HATCH = L.LX, WALK = CE.ACTIONS.walk, CLIMB = CE.ACTIONS.climb;
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    const TONE = { cora: '#c9d1d6', jaxon: '#f08c2e', aris: '#ffc27a', vance: '#c4622a', mira: '#e8836a' };   // as the voice lines
    const CREW = ['jaxon', 'aris', 'vance', 'mira'];
    const SHUTTLE_GAP = 250, SHUTTLE_MS = 2200, READ_MS = 250, GATHER_LEAD = 2600, PROPOSE_AFTER = 450, CLICK_GAP = 300;
    const SETTLE_HOLD_MS = 1400;                                          // settling ends the journey: the key is held, not clicked
    const SWEEP_MS = 1750;                                                // Scan: the glass sweeps the world's face once, then the finds show
    // the hull hit (review fix, 2026-10-30: the strike was only told): the bridge jolts (up to `shake` art px, easing out over
    // shakeMs) and the lamps dip twice (ms from the strike, the room under ink at `dark`), as A.U.R.A. says it
    const HIT = { shake: 4, shakeMs: 520, dips: [[0, 120], [210, 300]], dark: 0.55 };
    const CP = window.NSCopy || null;                                     // the fall through the gap and the copy of Earth (stop/Copy.js)

    // ── the stop's own state (none of it is game state) ──
    const freshPick = () => ({ slots: [null, null], order: [], why: {}, manual: false, key: '', from: Infinity });
    const S = {
        dive: null,          // NSDive dive while the push runs: { dir, t0, open, dissolveAt, plated, done }
        open: false, fadeAt: null, shownAt: -1e9, shownSent: false,
        id: null, node: null,
        plans: {}, drawn: [], atWindow: new Set(),
        actions: [], readAt: -1e9, lineup: [], aside: [],   // lineup: fit to go (at the window or the hatch); aside: too weak, apart
        apart: [],           // who has stood apart this stop: they stay there (by the suit locker) until we leave
        pick: freshPick(),   // slots: who stands at the hatch's two places; order: as they joined; why: id → why they go
        hover: null, hot: null, hotAt: 0, clickAt: 0,
        send: null,          // { ids, t0, fireAt, fired, skipped } between the click and flow.act
        drop: null,          // { at }: the shuttle leaves when the team has climbed down the hatch
        upEnd: -1e9,         // when the shuttle coming up is home: it never turns back down before then
        back: {},            // id → when they climb in from the shuttle coming up (onTripBack): never seen aboard before then
        trip: null,          // { ids } while the team is down
        decks: null,
        finds: [],           // the world's finds (NewScreen.flow.finds: WorldFinds.js), read with the actions
        sweep: null,         // { t0 } while the glass sweeps the world (on arrival, or after a click on the copy's Scan)
        autoScan: false,     // a world nobody has scanned: its sweep starts once the world has braked in
        hold: null,          // { t0 } while the settle key is held down (SETTLE_HOLD_MS, then the crew have their say)
    };
    let room = null, art = null, actx = null, diveC = null, bridgeC = null, dctx = null, bctx = null, fxList = [], W = null;
    const t0 = () => NS.clock.t;
    const crewMap = () => { const m = {}; try { NS.game.crew().forEach(c => { m[c.id] = c.status; }); } catch (err) { /* no game yet */ } return m; };
    let crewNow = {};
    const crewOf = id => crewNow[id] || (Object.keys(crewNow).length ? 'dead' : 'well');

    // ── the screen: the 640 x 360 bridge as large as the window shows it whole (G.bk, not a whole number: nearest-neighbour),
    //    centred on a canvas that covers the window: beside it, the space outside our hull, so it never sits in a black box ──
    function bg() {
        const G = NS.G, dpr = G.dpr || window.devicePixelRatio || 1;
        const bk = G.bk > 0 ? G.bk : Math.max(1, Math.min(innerWidth * dpr / SW, innerHeight * dpr / SH));
        const CW = Math.max(SW, Math.ceil(innerWidth * dpr / bk)), CH = Math.max(SH, Math.ceil(innerHeight * dpr / bk));
        const ox = Math.floor((CW - SW) / 2), oy = Math.floor((CH - SH) / 2);
        return { bk, dpr, CW, CH, ox, oy, bLeft: ox * bk / dpr, bTop: oy * bk / dpr };
    }
    let geo = null;
    const css = (x, y) => [geo.bLeft + x * geo.bk / geo.dpr, geo.bTop + y * geo.bk / geo.dpr];
    const toFrame = (cx, cy) => [Math.floor((cx - geo.bLeft) * geo.dpr / geo.bk), Math.floor((cy - geo.bTop) * geo.dpr / geo.bk)];
    const unit = () => geo.bk / geo.dpr;                                  // CSS px per frame px

    // ═══ 1. people on the bridge: plans of stays, walks and climbs on the shell's clock ═══
    const lastOf = id => { const pl = S.plans[id]; return pl && pl[pl.length - 1]; };
    function stayPlan(id, x, act, facing) { S.plans[id] = [{ kind: 'stay', x, act, facing, t0: -1e9, t1: Infinity }]; }
    function hidePlan(id) { S.plans[id] = [{ kind: 'gone', t0: -1e9, t1: Infinity }]; }
    function cut(id, t) {                                                 // end the plan at t; returns where they are
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
    function enterTo(id, t, x, act, facing) {                             // up the ladder through the hatch, then along the floor
        cut(id, t);
        const pl = S.plans[id], rows = 64, tc = t + (rows / CLIMB.rise) * CLIMB.ms, n = Math.ceil(Math.abs(x - HATCH) / WALK.move), tw = tc + n * WALK.ms;
        pl.push({ kind: 'climb', y0: F + rows, y1: F, t0: t, t1: tc }, { kind: 'walk', x0: HATCH, x1: x, t0: tc, t1: tw }, { kind: 'stay', x, act, facing, t0: tw, t1: Infinity });
    }
    function exitDown(id, t) {                                            // returns when they are gone down the hatch
        const from = cut(id, t), pl = S.plans[id];
        if (!from || from.hidden) { hidePlan(id); return t; }
        const n = Math.ceil(Math.abs(from.x - HATCH) / WALK.move), tw = t + n * WALK.ms, tc = tw + (64 / CLIMB.rise) * CLIMB.ms;
        pl.push({ kind: 'walk', x0: from.x, x1: HATCH, t0: t, t1: tw }, { kind: 'climb', y0: F, y1: F + 64, t0: tw, t1: tc }, { kind: 'gone', t0: tc, t1: Infinity });
        return tc;
    }
    /** The team leaves the bridge: both walk to the hatch and climb down, and only then does the shuttle drop toward the
        world. Returns when the shuttle starts down. */
    function sendOff(ids, t, gap) {
        const gone = ids.reduce((last, id, i) => Math.max(last, exitDown(id, t + 150 + i * gap)), t);
        S.drop = { at: Math.max(gone + SHUTTLE_GAP, S.upEnd) };              // a shuttle still coming up docks first
        return S.drop.at;
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
    /** Where everyone should be now: Cora at the helm; the two put forward at the hatch; whoever else may go at the window
        while a team action waits (and they stay there for the rest of the stop); the too weak apart; Mira at her console
        otherwise; the team away; the hurt, the confined and the dead are not on the bridge. */
    function desired() {
        const cp = CP ? CP.desired(Object.fromEntries(['cora'].concat(CREW).map(id => [id, crewOf(id)])), t0()) : null;   // the fall, the copy of Earth
        if (cp) return Object.fromEntries(['cora'].concat(CREW).map(id => [id, cp[id] || null]));
        const away = S.trip ? S.trip.ids : S.send ? S.send.ids : [], out = { cora: crewOf('cora') === 'dead' ? null : { x: HELM, act: 'console', facing: 1 } };
        CREW.forEach(id => {
            const fitToGo = crewOf(id) === 'well' || (crewOf(id) === 'hurt' && S.lineup.includes(id));   // never locked: with fewer than two well, the hurt come up too (NSOrbit.pool)
            if (!fitToGo || away.includes(id)) { out[id] = null; return; }
            const slot = S.lineup.includes(id) ? S.pick.slots.indexOf(id) : -1;
            if (slot >= 0) { out[id] = { x: HATCH_X[slot], act: 'idle', facing: 1 }; return; }
            if (S.lineup.includes(id) || S.atWindow.has(id)) { out[id] = { x: SPOT_X[id], act: 'idle', facing: 1 }; return; }
            const k = S.lineup.includes(id) ? -1 : S.apart.indexOf(id);
            if (k >= 0) { const a = ASIDE[Math.min(k, ASIDE.length - 1)]; out[id] = { x: a.x, act: 'idle', facing: a.facing }; return; }
            out[id] = id === 'mira' ? { x: NAV, act: 'console', facing: 1 } : null;
        });
        return out;
    }
    /** Move everyone toward where they should be (settle: put them there, nobody walks). The farthest spot climbs first, 0.7 s
        apart, so nobody passes anyone at the ladder. */
    function reconcile(t, settle) {
        const want = desired(), entering = [];
        S.lineup.forEach(id => { if (want[id]) S.atWindow.add(id); });
        Object.keys(want).forEach(id => {
            const w = want[id], last = lastOf(id), pose = poseOf(id, t), seen = pose && !pose.hidden;
            if (!w) {
                if (settle || !seen) { if (!last || last.kind !== 'gone') hidePlan(id); }
                else if (last && last.kind !== 'gone') exitDown(id, t);
                return;
            }
            if (last && last.kind === 'stay' && last.x === w.x && last.act === w.act && last.facing === w.facing) return;
            if (settle) { stayPlan(id, w.x, w.act, w.facing); return; }
            if (seen) walkTo(id, t, w.x, w.act, w.facing); else entering.push([id, w]);
        });
        // still in the shuttle coming up (S.back): they climb in when it is home, and go straight to where they are wanted
        entering.sort((a, b) => b[1].x - a[1].x).forEach(([id, w], i) => enterTo(id, Math.max(t + i * 700, S.back[id] || -1e9), w.x, w.act, w.facing));
    }

    // ═══ 2. the team at the hatch: who the crew put forward, and the player's changes ═══
    const team = () => S.pick.slots.filter(Boolean);
    /** How many must go down: two once two in the lineup are well; else one, and a second only if the player adds them
        (a trip is never locked, and a hurt one never has to go: NSOrbit.pool, teamSizes). */
    const need = () => (S.lineup.filter(id => crewOf(id) === 'well').length >= 2 ? 2 : 1);
    /** The player may change who goes: more in the lineup than the two places, or room beside the one who must go. */
    const choosable = () => S.lineup.length > 2 || need() < Math.min(2, S.lineup.length);
    /** Standing at their place by the hatch now (their name and why show only then: words never chase a walker). */
    function arrived(id) {
        const k = S.pick.slots.indexOf(id), last = lastOf(id);
        if (k < 0 || !last || last.kind !== 'stay' || last.x !== HATCH_X[k]) return false;
        const p = poseOf(id, t0());
        return !!p && !p.hidden && p.act === 'idle' && p.x === HATCH_X[k];
    }
    /** The crew put two forward (NSOrbit.propose) once the bridge has been seen a moment; they walk from the window to the
        hatch. Asked again when what we know changes (a scan, someone hurt), unless the player has changed who goes. */
    function proposeNow(t) {
        if (!S.lineup.length || S.send || S.trip || t < S.pick.from) return;
        let p = null;
        try { p = NS.flow && typeof NS.flow.propose === 'function' ? NS.flow.propose() : null; } catch (err) { console.error('NewScreen stop: the proposal failed', err); }
        if (p && p.why) S.pick.why = p.why;
        if (S.pick.manual && choosable()) return;                      // the player's choice stands (only two well, or one: they go, whatever was picked)
        const ids = !choosable() ? S.lineup.slice() : (p && Array.isArray(p.ids) ? p.ids : []).filter(id => S.lineup.includes(id)).slice(0, 2);
        if (ids.length < need()) return;
        const key = ids.slice().sort().join('+');
        if (key === S.pick.key && ids.every(id => S.pick.slots.includes(id))) return;   // the same two, both still at the hatch
        S.pick.key = key;
        const keep = S.pick.slots.map(id => (id && ids.includes(id) ? id : null));
        const add = ids.filter(id => !keep.includes(id)).sort((a, b) => SPOT_X[a] - SPOT_X[b]);   // the one further left takes the left place: nobody passes anyone
        S.pick.slots = keep.map(id => id || add.shift() || null);
        S.pick.order = ids.slice();
        reconcile(t);
    }
    /** A click on someone fit to go: at the hatch, they step back to the window (a place opens); at the window, they take the
        open place, or the place of whoever joined last. Only two well, or one: nobody changes. */
    function pickPerson(id, t) {
        if (!choosable() || !S.lineup.includes(id)) return false;
        const slots = S.pick.slots.slice(), at = slots.indexOf(id);
        let order = S.pick.order.filter(q => slots.includes(q));
        if (at >= 0) { slots[at] = null; order = order.filter(q => q !== id); }
        else {
            let k = slots.indexOf(null);
            if (k < 0) { const last = order[order.length - 1] || slots[1]; k = slots.indexOf(last); order = order.filter(q => q !== last); }
            slots[k] = id; order = order.concat(id);
        }
        S.pick.slots = slots; S.pick.order = order; S.pick.manual = true;
        reconcile(t);
        emit('stop:pick', { ids: slots.filter(Boolean) });
        return true;
    }
    /** Who joined the hatch last (a click at the window takes their place when no place is open). */
    const joinedLast = () => { const o = S.pick.order.filter(id => S.pick.slots.includes(id)); return o[o.length - 1] || null; };

    // ═══ 3. one frame of the bridge ═══
    function drawSides(c, t) {
        [[0, 0.002, 0], [1, 0.006, 137]].forEach(([layer0, drift, ox]) => {
            const T = A.stars(layer0), n = T.size, oy = ((Math.round(t * drift) % n) + n) % n;
            for (let y = oy - n; y < SH; y += n) for (let x = -(ox % n); x < SW; x += n) c.drawImage(T.canvas, x, y);
        });
    }
    function drawFx(f, t) {                                               // the room's small moving things: lights, the grille, the screens
        const tick = Math.floor(t / 125);
        fxList.forEach(o => {
            const X = o.x + OFFX, Y = o.y - B.Y0;
            if (Y < 0 || Y > SH) return;
            if (o.kind === 'led') { if (((t + o.x * 37) % o.period) < o.period * 0.55) f.px(X, Y, o.color); }
            else if (o.kind === 'aura') { const sp = speaking() === 'aura', v = sp ? 0.8 + 0.2 * Math.sin(t / 90) : 0.55 + 0.4 * Math.sin(t / 1700); f.px(X, Y, R.SCR.hex[v > 0.75 ? 5 : v > 0.45 ? 4 : 3], 3, 1); }
            else if (o.kind === 'screen') {
                for (let r = 1; r < o.h; r += 2) { const n = Math.floor(P.hash(r & 255, (tick >> 2) & 255, 3) * (o.w - 1)); for (let k = 0; k < n; k++) if (P.hash(k & 255, (r + tick) & 255, 5) > 0.3) f.px(X + k, Y + r, R.SCR.hex[(k + r) % 4 ? 2 : 3]); }
            }
        });
    }
    function lightFor(x) {
        const near = room.lamps.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
        return Math.round(3 * Math.exp(-Math.abs(near.x - x) / 55));
    }
    function floorGlow(c, x, y, peak) {                                   // a warm pool of light under someone at the hatch (or pointed at)
        const f = P.framer(c, SW, SH);
        for (let dy = -3; dy <= 2; dy++) for (let dx = -22; dx <= 22; dx++) { const d = Math.hypot(dx / 22, dy / 3.2); if (d < 1) f.tone(x + dx, y + dy, RP.AMBER, peak * (1 - d) ** 1.4); }
    }
    const picking = () => !S.send && !S.trip && S.lineup.length >= 1 && hasTeamAction();
    /** The hatch stands open for the team: a warm light from the lab below rises out of it (stronger once both are there). */
    const hatchGlow = (c, k) => { if (TA) TA.hatchLight(c, HATCH + OFFX, F, k); };
    function drawPeople(c, t) {
        S.drawn = [];
        const pk = picking(), list = ['cora'].concat(CREW).map(id => ({ id, p: poseOf(id, t) })).filter(o => o.p && !o.p.hidden);
        list.sort((a, b) => (a.p.climbing ? -1 : 0) - (b.p.climbing ? -1 : 0) || a.p.x - b.p.x).forEach(({ id, p }) => {
            const ready = pk && arrived(id), hot = pk && S.hover === id && (S.lineup.includes(id) || S.aside.includes(id));
            const still = p.act === 'idle' || p.act === 'console', ms = still ? p.ms + (CREW.indexOf(id) + 1) * 977 : p.ms;
            const blink = ((ms + (CREW.indexOf(id) + 2) * 1700) % 4300) < 140;
            const lit = hot && S.lineup.includes(id) ? 3 : ready ? Math.max(2, lightFor(p.x)) : lightFor(p.x);
            const Sp = CE.sprite(id, p.act, CE.frameAt(p.act, ms), { blink, warm: lit, rim: p.facing, screen: p.act === 'console' });
            const X = Math.round(p.x) + OFFX, Y = Math.round(p.y) - Sp.origin.y;
            if (ready || (hot && S.lineup.includes(id))) floorGlow(c, X, Math.round(p.y), hot ? 0.5 : 0.34);
            if (p.facing > 0) c.drawImage(Sp.canvas, X - Sp.origin.x, Y); else { c.save(); c.translate(X + 1, 0); c.scale(-1, 1); c.drawImage(Sp.canvas, -Sp.origin.x, Y); c.restore(); }
            S.drawn.push({ id, Sp, X, Y, facing: p.facing });
        });
    }
    let masks = null;
    function mask(j) {                                                    // 8 Bayer masks: step j shows (j + 1) / 8 of the pixels
        if (!masks) masks = Array.from({ length: STEPS }, (_, k) => {
            const c = document.createElement('canvas'); c.width = SW; c.height = SH;
            const g = c.getContext('2d'), img = g.createImageData(SW, SH);
            for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (threshold(x, y) < (k + 1) / STEPS) img.data[(y * SW + x) * 4 + 3] = 255;
            g.putImageData(img, 0, 0); return c;
        });
        return masks[Math.max(0, Math.min(STEPS - 1, j))];
    }
    /** The bridge, back to front: the sky in the glass (and what a pointed-at tag shows on it), the room, the threads to
        what each tag acts on, the people, damage, then the tags' own pixels (shade, brackets, icons, the helm key). */
    function composeBridge(t, words, cv) {
        const c = actx;
        c.imageSmoothingEnabled = false;
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = INK; c.fillRect(0, 0, SW, SH);
        drawSides(c, t);
        if (cv && cv.fall) CP.drawFallGlass(c, t);                         // the fall: the world split along a seam
        else GL.draw(c, t, { shownAt: S.shownAt, call: S.actions.some(a => a.key === 'call') });
        if (words) W.glass(c, t, words);
        c.drawImage(room.canvas, OFFX, 0);
        c.globalCompositeOperation = 'lighter'; c.drawImage(room.glass, 0, 0); c.globalCompositeOperation = 'source-over';
        c.drawImage(A.deck(1).canvas, OFFX, B.H);
        drawFx(P.framer(c, SW, SH), t);
        if (picking() && team().length) hatchGlow(c, team().length === need() && team().every(arrived) ? 1 : 0.55);
        if (words) W.threads(c, t, words);
        drawPeople(c, t);
        drawDamage(c, t);
        if (cv) CP.drawRoom(c, t, cv);                                    // the lamps out, Earth's blue light
        if (words) W.tags(c, t, words);
    }
    /** A broken deck shows here too: the bridge (or the lab under it) under a dithered red wash; engineering down, the lights
        brown out for a moment every 2.9 s. The choice (fix, patch, live with it) is the tower's, in travel. */
    let washes = null;
    function wash(y0, y1) {
        const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
        const g = cv.getContext('2d'), img = g.createImageData(SW, SH), [r, gg, b] = P.hexRgb(RP.RED.hex[1]);
        for (let y = Math.max(0, y0); y < Math.min(SH, y1); y++) for (let x = 0; x < SW; x++) {
            const inGlass = x >= WIN.x0 && x < WIN.x1 && y >= WIN.y0 && y < WIN.y1;
            if (!inGlass && threshold(x, y) < 0.1) { const o = (y * SW + x) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255; }
        }
        g.putImageData(img, 0, 0); return cv;
    }
    let hitAt = -1e9;                                                     // when the hull hit came ('hull:hit'), shell ms
    const isReduced = () => { const J = window.Juice; try { return !!(J && typeof J.reduced === 'function' && J.reduced()); } catch (err) { return false; } };
    /** The strike: the lamps dip (here, under the people) and the bridge jolts (hitShake, where the bridge is drawn). */
    function hitDip(c, t) {
        const age = t - hitAt;
        if (HIT.dips.some(([a, b], i) => age >= a && age < b && (i === 0 || !isReduced()))) { c.fillStyle = `rgba(5,7,10,${HIT.dark})`; c.fillRect(0, 0, SW, SH); }
    }
    function hitShake(t) {
        const age = t - hitAt;
        if (age < 0 || age >= HIT.shakeMs || isReduced()) return [0, 0];
        const k = HIT.shake * (1 - age / HIT.shakeMs) ** 2, tick = Math.floor(age / 40);
        return [Math.round((P.hash(tick & 255, 7, 21) - 0.5) * 2 * k), Math.round((P.hash(tick & 255, 9, 21) - 0.5) * 1.2 * k)];
    }
    function drawDamage(c, t) {
        hitDip(c, t);
        const d = S.decks;
        if (!d) return;
        if (!washes) washes = { bridge: wash(0, B.H), lab: wash(B.H, SH), dark: null };
        if (d.bridge === 'red' && t % 4200 > 140) c.drawImage(washes.bridge, 0, 0);   // a broken lamp's flicker
        if (d.lab === 'red') c.drawImage(washes.lab, 0, 0);
        if (d.engineering === 'red' && t % 2900 < 160) { c.fillStyle = 'rgba(5,7,10,0.45)'; c.fillRect(0, 0, SW, SH); }
    }
    const speaking = () => { const v = NS.mods.voice; try { return v && v.speaking ? v.speaking() : null; } catch (err) { return null; } };

    // ═══ 4. what we can do here: the game's own list (Orbit.js), read every 250 ms ═══
    /** flow.actions() once the bridge is up; while it dissolves in (the shell still says 'dive-in') the same list straight
        from NSOrbit, read only, so the lineup can form during the dive. */
    function readList() {
        const m = typeof NS.mode === 'function' ? NS.mode() : 'stop', o = window.NSOrbit;
        if (m === 'stop') return NS.flow && typeof NS.flow.actions === 'function' ? NS.flow.actions() : [];
        if (m === 'dive-in' && S.dive && S.dive.open && o && typeof o.actions === 'function') return o.actions(NS.app);
        return [];
    }
    function readActions(t) {
        S.readAt = t;
        let list = [], elig = [];
        try { list = readList() || []; } catch (err) { console.error('NewScreen stop: the actions failed', err); list = []; }
        try { elig = (NS.flow && typeof NS.flow.eligible === 'function' ? NS.flow.eligible() : []) || []; } catch (err) { elig = []; }
        S.actions = list.filter(a => a && a.key && a.words);
        const team0 = S.actions.some(a => a.team);
        S.lineup = team0 && !S.send && !S.trip ? elig.filter(id => CREW.includes(id)) : [];
        let weak = [];
        try { weak = (NS.flow && typeof NS.flow.weak === 'function' ? NS.flow.weak() : []) || []; } catch (err) { weak = []; }
        S.aside = S.lineup.length ? weak.filter(id => CREW.includes(id) && !S.lineup.includes(id)) : [];
        S.aside.forEach(id => { if (!S.apart.includes(id)) S.apart = S.apart.concat(id); });
        S.pick.slots = S.pick.slots.map(id => (id && S.lineup.includes(id) ? id : null));   // someone no longer fit leaves their place
        S.pick.order = S.pick.order.filter(id => S.pick.slots.includes(id));
        crewNow = crewMap();
        try { S.decks = NS.game.decks(); } catch (err) { S.decks = null; }
        readFinds(t);
        if (S.open && !S.dive) proposeNow(t);
    }
    /** The world's finds (their risk with the two at the hatch); the shuttle aims at the one chosen, but never mid-flight. */
    function readFinds(t) {
        try { S.finds = (NS.flow && typeof NS.flow.finds === 'function' ? NS.flow.finds(team()) : []) || []; } catch (err) { console.error('NewScreen stop: the finds failed', err); S.finds = []; }
        const sh = GL.shuttleState(), flying = !!(sh && t < sh.t0 + sh.dur);
        if (S.send || S.trip || flying) return;
        const aimed = S.finds.find(f => f.target);
        GL.aim(aimed ? aimed.at : null);
    }
    const hasTeamAction = () => S.actions.some(a => a.team);
    const isWrongPlace = () => S.actions.some(a => a.key === 'escape' || a.key === 'accept') || !!(S.node && S.node._isWrongPlace);

    // ═══ 5. the bus ═══
    const nodeOf = id => { try { const s = NS.game.state(); return (window.NSRoute && window.NSRoute.find(s, id)) || (s && s.currentSystem && s.currentSystem.id === id ? s.currentSystem : null); } catch (err) { return null; } };
    const currentNode = () => { try { const s = NS.game.state(); return s ? s.currentSystem : null; } catch (err) { return null; } };
    function freshStop(id, node) {
        S.id = id; S.node = node; S.plans = {}; S.drawn = []; S.atWindow = new Set(); S.actions = []; S.lineup = []; S.aside = []; S.apart = []; S.pick = freshPick();
        S.hover = null; S.hot = null; S.send = null; S.drop = null; S.trip = null; S.shownSent = false; S.readAt = -1e9; S.finds = []; S.sweep = null; S.autoScan = false; S.hold = null; S.upEnd = -1e9; S.back = {};
        GL.shuttle(null);
        GL.place(node);
        crewNow = crewMap();
    }
    function onDiveStart(p) {
        const id = p && p.id, node = nodeOf(id);
        if (!id) return;
        const tw = NS.mods.travel, t = t0();
        let pose = null;
        try { pose = tw && tw.landerPose ? tw.landerPose() : null; } catch (err) { pose = null; }
        freshStop(id, node);
        stayPlan('cora', HELM, 'console', 1);
        CREW.forEach(hidePlan);
        S.open = false; S.fadeAt = null;
        S.dive = Object.assign(D.start('in', pose, t), { id });
    }
    function onDiveCancel() { if (S.dive && S.dive.dir === 'in') close(false); }
    /** The real game has put us in orbit: from the dive, the bridge dissolves in; from anywhere else, it fades from black. */
    function onStopOpen(p) {
        const t = t0(), node = currentNode() || nodeOf(p && p.id), id = (node && node.id) || (p && p.id);
        if (!id) return;
        if (S.dive && S.dive.dir === 'in' && p && p.dived !== false) {
            if (S.id !== id) { S.id = id; S.node = node; GL.place(node); }
            S.node = node || S.node;
            S.dive.open = true;
            readActions(t);
            const lineup = S.lineup;                                     // first everyone at their post (Mira at her console) ...
            S.lineup = []; reconcile(t, true); S.lineup = lineup;
            reconcile(t - GATHER_LEAD);                                  // ... then up the ladder during the dive: the lineup forms as the bridge shows
            return;
        }
        if (S.open && S.id === id && !S.dive) { onRefresh(); return; }
        S.dive = null;
        freshStop(id, node);
        readActions(t);
        reconcile(t, true);
        S.open = true; S.fadeAt = t; S.shownAt = -1e9;
        const sa = CP ? CP.shownAtFor(id, t) : null;                     // the copy of Earth after the fall: it brakes in as the light returns
        if (sa != null) S.shownAt = sa;
    }
    function onRefresh() {
        const t = t0(), node = currentNode();
        if (!S.open && !S.dive) return;
        if (node && node.id !== S.id && S.open && !S.dive) { freshStop(node.id, node); S.open = true; S.fadeAt = t; S.shownAt = -1e9; readActions(t); reconcile(t, true); return; }
        if (node) S.node = node;
        readActions(t); reconcile(t);
    }
    function onDiveBack() {
        if (!S.open || (S.dive && S.dive.dir === 'out')) return;
        const tw = NS.mods.travel;
        let pose = null;
        try { pose = tw && tw.landerPose ? tw.landerPose() : null; } catch (err) { pose = null; }
        S.dive = Object.assign(D.start('out', pose, t0()), { id: S.id });
        S.hover = null; S.hot = null; S.sweep = null; S.autoScan = false;
        W.hide();
    }
    /** The team goes down: from our own click (we already walked them out), or from the game alone. */
    function onTripDown(p) {
        const t = t0(), ids = (p && Array.isArray(p.ids) ? p.ids : (S.send && S.send.ids) || team()).filter(id => CREW.includes(id));
        if (S.trip) return;
        S.trip = { ids: ids.slice() };
        if (!S.send) sendOff(ids, t, 400);                              // the game sent them without our click: walk them out now
        S.send = null; S.pick = freshPick(); S.lineup = []; S.aside = [];
    }
    function onTripBack(p) {
        const t = t0(), ids = S.trip ? S.trip.ids : [], home = t + SHUTTLE_MS + 700;
        S.trip = null; S.send = null;
        if (p && p.failed) S.pick = Object.assign(freshPick(), { from: t + PROPOSE_AFTER * 4 });   // the game would not take them: they come back up, and two step forward again
        else S.pick = Object.assign(freshPick(), { from: t + PROPOSE_AFTER });   // another find still open: two step forward while the shuttle comes up
        GL.shuttle('up', t + 300, SHUTTLE_MS + 200);
        S.upEnd = t + 300 + SHUTTLE_MS + 200; S.back = {};
        crewNow = crewMap();
        ids.forEach((id, i) => {                                         // all who came back climb in once it is home; the hurt too, if they are wanted on the bridge
            if (crewOf(id) === 'dead') return;
            S.back[id] = home + i * 700;
            if (crewOf(id) === 'well') { S.atWindow.add(id); enterTo(id, S.back[id], SPOT_X[id], 'idle', 1); }
        });
    }
    function onFlowGo(p) { const node = p && nodeOf(p.id); if (node) GL.prepare(node); D.prepare(); }

    // ═══ 6. the clock ═══
    function emit(name, payload) { NS.bus.emit(name, payload); }
    function update(dt, t) {
        D.bake(dt > 0 ? 4 : 2);
        if (CP) CP.update(dt, t);
        const d = S.dive;
        if (d) {
            const el = t - d.t0;
            if (d.dir === 'in') {
                if (!d.plated && el >= PUSH) { d.plated = true; emit('dive:plated', { dir: 'in' }); }
                if (d.plated && d.open && d.dissolveAt == null) { d.dissolveAt = t; S.open = true; S.shownAt = t + DISSOLVE; }
                if (d.dissolveAt != null && t - d.dissolveAt >= DISSOLVE) { S.dive = null; shown(); }
                const m = typeof NS.mode === 'function' ? NS.mode() : null;
                if (m === 'travel' && el > PUSH + 200) close(false);          // the shell went back to travel without telling us
            } else {
                if (!d.plated && el >= DISSOLVE) { d.plated = true; S.open = false; W.hide(); registerAnchors(false); emit('dive:plated', { dir: 'out' }); }
                if (!d.done && el >= DISSOLVE + PUSH) { d.done = true; close(true); }
            }
        }
        if (S.open && !S.dive && S.fadeAt != null && t - S.fadeAt >= DISSOLVE && !S.shownSent) shown();
        if (S.drop && t >= S.drop.at) { GL.shuttle('down', S.drop.at, SHUTTLE_MS); S.drop = null; }   // the team is down the hatch: the shuttle goes
        if (S.send && !S.send.fired && t >= S.send.fireAt && !NS.blocked()) fireSend();   // a card came up meanwhile: they wait below
        if (S.autoScan && !S.sweep && !S.send && !S.trip && GL.settled(t, S.shownAt) && !NS.blocked()) { S.autoScan = false; S.sweep = { t0: t }; tellScan(); }   // the world has braked in: it is scanned
        if (S.sweep && t - S.sweep.t0 >= SWEEP_MS && !NS.blocked()) { S.sweep = null; runAct('scan', t); }   // the glass has swept the world: the scan reads it
        if (S.hold && t - S.hold.t0 >= SETTLE_HOLD_MS) { const k = S.hold.key || 'settle'; S.hold = null; setHot(null); runAct(k, t); }   // held long enough: the crew have their say
        if ((S.open || S.dive) && t - S.readAt >= READ_MS && S.id && !(S.dive && !S.dive.open && S.dive.dir === 'in')) { readActions(t); if (S.open && !(S.dive && S.dive.dir === 'out')) reconcile(t); }
    }
    function shown() {
        if (S.shownSent) return;
        S.shownSent = true;
        S.pick.from = t0() + PROPOSE_AFTER;                              // the crew step forward once the bridge has been seen a moment
        S.autoScan = scanDue();                                          // nobody has scanned this world: update() sweeps it once it has braked in
        registerAnchors(true);
        emit('stop:shown', { id: S.id });
    }
    /** We are at a world nobody has scanned from the bridge (NSOrbit.scanDue). */
    function scanDue() {
        try { return !!(NS.flow && typeof NS.flow.scanDue === 'function' && NS.flow.scanDue()); } catch (err) { console.error('NewScreen stop: scanDue failed', err); return false; }
    }
    /** The first sweep of a run: A.U.R.A. says once what it is (there is no Scan tag to explain). */
    function tellScan() {
        const v = NS.mods.voice, line = window.NSOrbit && window.NSOrbit.TELL && window.NSOrbit.TELL.scan;
        if (!line || !v || typeof v.once !== 'function') return;
        Promise.resolve(v.once('act:scan', line, () => S.open && !S.dive)).catch(err => console.error('NewScreen stop: the voice failed', err));
    }
    function close(tell) {
        const id = S.id;
        if (S.node && S.shownSent) S.node._nsSeen = true;                // a world seen: NewScreen.js holds a card a shorter time when we come back
        S.dive = null; S.open = false; S.fadeAt = null; S.id = null; S.node = null; S.pick = freshPick(); S.hover = null; S.hot = null; S.send = null; S.drop = null; S.trip = null;
        S.shownSent = false; S.actions = []; S.lineup = []; S.aside = []; S.apart = []; S.finds = []; S.sweep = null; S.autoScan = false; S.hold = null; S.upEnd = -1e9; S.back = {};
        GL.shuttle(null); GL.place(null);
        registerAnchors(false); W.hide(); setPointing(false);
        if (tell) emit('stop:hidden', { id });
    }
    /** "GO DOWN": they climbed down the hatch and the shuttle reached the world; the real trip begins. */
    function fireSend() {
        const s = S.send; s.fired = true;
        const ids = s.ids.slice();
        let went = false;
        try {
            if (NS.flow && typeof NS.flow.act === 'function') went = NS.flow.act('team', ids);
            else { const a = S.actions.find(q => q.key === 'team'); if (a && a.run) went = a.run(ids) !== false; }
        } catch (err) { console.error('NewScreen stop: sending the team failed', err); }
        if (!S.trip && S.send === s) {                                   // the game did not take them (refused): they come back up, and we hear why
            const v = NS.mods.voice, talking = v && v.current ? v.current() : null;
            if (!went && !talking) say('The team stays aboard for now, Commander.');
            S.send = null; S.drop = null; S.pick = Object.assign(freshPick(), { from: t0() + PROPOSE_AFTER * 4 }); const t = t0();
            ids.forEach((id, i) => { if (crewOf(id) === 'well') enterTo(id, t + 300 + i * 600, SPOT_X[id], 'idle', 1); });
            GL.shuttle('up', t, SHUTTLE_MS); S.upEnd = t + SHUTTLE_MS;
        }
    }

    // ═══ 7. drawing: which canvases show, and what is in them ═══
    function vis(c, on) { const v = on ? 'block' : 'none'; if (c && c.style.display !== v) c.style.display = v; }
    let inked = false;
    function render(t) {
        if (!room) return;
        const d = S.dive, G = NS.G;
        if (!d && !S.open) { vis(diveC, false); vis(bridgeC, false); W.hide(); inked = false; return; }
        const cv = CP && !d ? CP.view(t) : null;                          // the fall, the copy of Earth: black, dark, shaken
        if (cv && cv.black) { bctx.fillStyle = INK; bctx.fillRect(0, 0, geo.CW, geo.CH); vis(bridgeC, true); W.hide(); return; }
        let j = STEPS;                                                    // how much of the bridge shows (Bayer steps)
        if (d) {
            const el = t - d.t0;
            if (d.dir === 'in') j = d.dissolveAt == null ? 0 : Math.min(STEPS, 1 + Math.floor((t - d.dissolveAt) / (DISSOLVE / STEPS)));
            else j = el < DISSOLVE ? STEPS - Math.floor(el / (DISSOLVE / STEPS)) : 0;
            vis(diveC, true); D.draw(dctx, d, t); inked = false;
        } else {
            vis(diveC, true);
            if (!inked) { dctx.globalCompositeOperation = 'source-over'; dctx.fillStyle = INK; dctx.fillRect(0, 0, G.W, G.H); inked = true; }
            if (S.fadeAt != null) j = Math.min(STEPS, 1 + Math.floor((t - S.fadeAt) / (DISSOLVE / STEPS)));
        }
        if (cv && cv.fadeJ != null) j = Math.min(j, cv.fadeJ);           // the light coming back after the fall, slowly
        if (j <= 0) { vis(bridgeC, false); W.hide(); return; }
        const words = j >= STEPS && !(d && d.dir === 'out') && !(cv && cv.noWords) ? W.layout(t) : null;   // the tags only once the bridge is whole
        composeBridge(t, words, cv);
        if (j < STEPS) { actx.globalCompositeOperation = 'destination-in'; actx.drawImage(mask(j - 1), 0, 0); actx.globalCompositeOperation = 'source-over'; }
        bctx.clearRect(0, 0, geo.CW, geo.CH);
        drawMargins(t, j);
        const hs = hitShake(t);                                           // the hull hit's jolt (0, 0 most frames)
        bctx.drawImage(art, geo.ox + (cv ? cv.shake[0] : 0) + hs[0], geo.oy + (cv ? cv.shake[1] : 0) + hs[1]);
        vis(bridgeC, true);
        if (words) W.apply(t, words); else W.hide();
        repoint();
    }

    /** Beside the bridge (a window wider than 16:9): the same drifting stars as the frame's own edges, dissolving in with it.
        Above and below (a taller window): ink, the hull goes on there. */
    function drawMargins(t, j) {
        const { CW, CH, ox, oy } = geo;
        if (ox <= 0 && oy <= 0) return;
        bctx.save();
        bctx.globalAlpha = Math.min(1, j / STEPS);
        bctx.fillStyle = INK; bctx.fillRect(0, 0, CW, CH);
        if (ox > 0) {
            bctx.beginPath(); bctx.rect(0, oy, ox, SH); bctx.rect(ox + SW, oy, CW - ox - SW, SH); bctx.clip();
            [[0, 0.002, 0], [1, 0.006, 137]].forEach(([layer0, drift, sx]) => {
                const T = A.stars(layer0), n = T.size, dy = ((Math.round(t * drift) % n) + n) % n;
                for (let y = oy + dy - n; y < oy + SH; y += n) for (let x = ox - (sx % n) - n * Math.ceil(ox / n); x < CW; x += n) bctx.drawImage(T.canvas, x, y);
            });
        }
        bctx.restore();
    }

    // ═══ 8. the pointer (CSS px from the event; the shell routes it here while the mode is not 'travel') ═══
    const alphas = new WeakMap();
    function personAtPx(x, y) {
        for (let i = S.drawn.length - 1; i >= 0; i--) {
            const d = S.drawn[i], Sp = d.Sp, cx = d.facing > 0 ? x - (d.X - Sp.origin.x) : (d.X + Sp.origin.x) - x, cy = y - d.Y;
            if (cx < -3 || cy < -3 || cx >= Sp.w + 3 || cy >= Sp.h + 3) continue;
            let al = alphas.get(Sp.canvas);
            if (!al) { al = Sp.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, Sp.w, Sp.h).data; alphas.set(Sp.canvas, al); }
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = cx + dx, yy = cy + dy; if (xx >= 0 && yy >= 0 && xx < Sp.w && yy < Sp.h && al[(yy * Sp.w + xx) * 4 + 3]) return d.id; }
        }
        return null;
    }
    function setPointing(on) { const root = document.getElementById('ns-root'); if (root) root.classList.toggle('is-pointing', !!on); }
    function setHot(key) { if (key !== S.hot) { S.hot = key; S.hotAt = t0(); } }
    let ptr = null;                                                       // where the pointer last was (CSS px): people walk under a still pointer
    /** What is under the pointer: a tag, the helm key, a name over someone at the hatch, or a person. */
    function under(cx, cy) {
        const [ax, ay] = toFrame(cx, cy), hit = W.hit(cx, cy);
        const who = picking() ? (hit && hit.kind === 'who' ? hit.id : personAtPx(ax, ay)) : null;
        const fit = who && S.lineup.includes(who) ? who : null, weak = who && S.aside.includes(who) ? who : null;   // too weak to go: pointing says why, a click does nothing
        const actKey = hit && hit.kind === 'act' ? hit.key : null, onLeave = !!(hit && hit.kind === 'leave'), onSettle = !!(hit && hit.kind === 'settle');
        const onFight = !!(hit && hit.kind === 'fight'), settleKey = onSettle ? hit.key || 'settle' : null;   // the copy of Earth: Fight to escape, Go down
        const find = hit && hit.kind === 'find' ? hit : null;            // a find's tag or its mark on the world
        return { fit, weak, actKey, onLeave, onSettle, onFight, settleKey, find, on: !!actKey || onLeave || onSettle || onFight || !!find || (!!fit && choosable()) };
    }
    function pointAt(u) {
        setHot(u.actKey || (u.find ? u.find.key : null) || (u.onLeave ? 'leave' : null) || u.settleKey || (u.onFight ? 'escape' : null));
        if (S.hold && !u.onSettle) S.hold = null;                        // slid off the settle key: nothing is decided
        if (CP && !u.onFight) CP.holdFight(false);                       // slid off the fight key: it drifts back
        S.hover = u.actKey || u.find || u.onLeave || u.onSettle || u.onFight ? null : u.fit || u.weak; setPointing(u.on); return u.on;
    }
    /** A held key lets go on any release: the button up, the pointer lost, the window left (alt-tab) or the tab hidden, so a
        key held while the player is away never fills on its own. */
    function onRelease(fn) {
        const end = () => {
            removeEventListener('pointerup', end, true); removeEventListener('pointercancel', end, true); removeEventListener('blur', end);
            document.removeEventListener('visibilitychange', end);
            fn();
        };
        addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true); addEventListener('blur', end);
        document.addEventListener('visibilitychange', end);
    }
    /** The settle key (or Go down) held down: let go (or slide off) before it fills and nothing happens; held, the crew have their say. */
    function holdSettle(t, key) { S.hold = { t0: t, key: key || 'settle' }; onRelease(() => { S.hold = null; }); }
    /** Fight to escape held down: the engines strain while it is (stop/Copy.js); let go and it drifts back. */
    function holdFight() { CP.holdFight(true); onRelease(() => CP.holdFight(false)); }
    /** Each frame: what is under a still pointer now (someone walked off, or onto it). */
    function repoint() { if (ptr && S.open && !S.dive && !S.send && !S.sweep && !NS.blocked()) pointAt(under(ptr.x, ptr.y)); }
    function pointer(type, e) {
        ptr = type === 'leave' ? null : { x: e.clientX, y: e.clientY };
        if (CP && CP.falling()) { if (type === 'down' && !NS.blocked()) CP.hurry(); return type === 'down'; }   // the fall: a click hurries it
        if (!S.open || S.dive || S.fadeAt != null && t0() - S.fadeAt < DISSOLVE || NS.blocked()) { if (type === 'move' || type === 'leave') { S.hover = null; setHot(null); setPointing(false); } return false; }
        const t = t0(), cx = e.clientX, cy = e.clientY;
        if (type === 'leave') { S.hover = null; setHot(null); setPointing(false); return false; }
        if (S.send) { setPointing(false); if (type === 'down') skipSend(t); return type === 'down'; }   // the team is leaving: a click hurries it
        if (S.sweep) { S.hover = null; setHot(null); setPointing(false); return type === 'down'; }    // the glass is sweeping the world: a moment
        const u = under(cx, cy), { fit, actKey, onLeave, onSettle, find } = u;
        if (type === 'move') return pointAt(u);
        if (type !== 'down') return false;
        if (t - S.clickAt < CLICK_GAP) return true;
        if (onLeave && !W.fresh('leave')) { S.clickAt = t; leave(); return true; }
        if (onSettle && !W.fresh(u.settleKey)) { S.clickAt = t; holdSettle(t, u.settleKey); return true; }
        if (u.onFight && !W.fresh('escape')) { S.clickAt = t; if (CP) holdFight(); else doAct('escape', t); return true; }   // without stop/Copy.js: the old escape card
        if (actKey && !W.fresh(actKey)) { S.clickAt = t; doAct(actKey, t); return true; }
        if (find && !W.fresh(find.key)) { S.clickAt = t; aimAt(find.id, t); return true; }
        if (fit) { S.clickAt = t; return pickPerson(fit, t); }
        return false;
    }
    /** A click on a find: GO DOWN goes there now (its mark in brackets, the shuttle's path ends there). */
    function aimAt(id, t) {
        let ok = false;
        try { ok = !!(NS.flow && typeof NS.flow.aim === 'function' && NS.flow.aim(id)); } catch (err) { console.error('NewScreen stop: choosing the find failed', err); }
        if (ok) { S.readAt = t - READ_MS; readFinds(t); }               // read again now: the marks and GO DOWN's risk follow at once
    }
    function say(text) { const v = NS.mods.voice; if (v && v.say) { try { v.say({ id: 'aura', who: 'A.U.R.A.', text }); } catch (err) { console.error('NewScreen stop: voice failed', err); } } }
    function doAct(key, t) {
        const a = S.actions.find(q => q.key === key);
        if (!a) return;
        if (a.team && S.autoScan) { S.autoScan = false; S.sweep = { t0: t }; tellScan(); S.hover = null; setHot(null); setPointing(false); return; }   // not read yet: the scan first
        if (a.team) {
            const ids = team();
            if (ids.length < need()) { say(ids.length ? 'We need one more at the hatch, Commander.' : need() === 1 ? 'We need someone at the hatch, Commander.' : 'We need two at the hatch, Commander.'); return; }   // DRAFT: "someone" (one left who can go)
            S.send = { ids, t0: t, fired: false, skipped: false, fireAt: sendOff(ids, t, 350) + SHUTTLE_MS };   // the trip begins once the shuttle is down
            if (S.node && S.node.nsTrips > 0) skipSend(t);              // a trip from here before: nobody walks it again, the shuttle goes at once
            S.hover = null; setHot(null); setPointing(false);
            return;
        }
        if (key === 'scan') { if (!S.sweep) S.sweep = { t0: t }; S.hover = null; setHot(null); setPointing(false); return; }   // the glass sweeps first (update reads it after)
        if (key === 'skim') GL.skim(t);
        runAct(key, t);
    }
    /** The game's own action now (NewScreen.flow.act); the list changes after it, so it is read again soon. */
    function runAct(key, t) {
        const a = S.actions.find(q => q.key === key);
        if (!a && key !== 'scan') return;                                // a world's scan has no tag (it runs by itself): the game still takes it
        S.readAt = t + 400 - READ_MS;
        try {
            if (NS.flow && typeof NS.flow.act === 'function') NS.flow.act(key);
            else if (a && typeof a.run === 'function') a.run();
        } catch (err) { console.error(`NewScreen stop: the action "${key}" failed`, err); }
    }
    /** A click while the team is still walking out: they are down the hatch at once and the shuttle leaves now. */
    function skipSend(t) {
        const s = S.send;
        if (!s || s.fired || s.skipped || !S.drop) return;               // the shuttle is already on its way down
        s.skipped = true;
        s.ids.forEach(hidePlan);
        S.drop = { at: Math.max(t, S.upEnd) };                            // still coming up: it docks, then goes straight down
        s.fireAt = S.drop.at + SHUTTLE_MS;
    }
    function leave() {
        S.hover = null; setHot(null); setPointing(false);
        try {
            if (NS.flow && typeof NS.flow.leave === 'function') NS.flow.leave();
            else emit('dive:back', { id: S.id });
        } catch (err) { console.error('NewScreen stop: leaving orbit failed', err); }
    }

    // ═══ 9. anchors and discs (CSS px) ═══
    function registerAnchors(on) {
        const names = ['stop:aura', 'stop:glass', 'stop:site'].concat(['cora'].concat(CREW).map(id => 'stop:person:' + id));
        if (!on) { names.forEach(n => NS.anchors.delete(n)); return; }
        const pt = (x, y, side, align) => { const [X, Y] = css(x, y); return { x: X, y: Y, side, align }; };
        const skyY = () => W.skyY();                                      // under the glass's title (and its scan chips, when they show)
        // A.U.R.A. speaks in the open sky of the glass's left (the world fills the right); the grille is the fallback
        NS.anchors.set('stop:aura', () => [pt(WIN.x0 + 10, skyY(), 'below'), pt(WIN.x0 + 10, WIN.y1 - 70, 'below'), pt(574, 122, 'left')]);
        NS.anchors.set('stop:glass', () => [pt(WIN.x0 + 10, skyY(), 'below'), pt(WIN.x0 + 10, WIN.y1 - 70, 'below'), pt(290, WIN.y0 + 12, 'below')]);
        NS.anchors.set('stop:site', () => { const t = t0(), g = GL.geom(t, S.shownAt), [sx, sy] = GL.site(t, S.shownAt); return [pt(Math.max(WIN.x0 + 20, g.x - g.r - 12), sy, 'left'), pt(sx, Math.min(WIN.y1 - 10, g.y + g.r + 8), 'below', 'center')]; });
        ['cora'].concat(CREW).forEach(id => NS.anchors.set('stop:person:' + id, () => {
            const d = S.drawn.find(q => q.id === id); if (!d) return [];
            const mt = W.markTop ? W.markTop(id) : null, top = mt != null ? Math.min(d.Y + 2, mt - 3) : d.Y + 2;   // the copy: over their state mark, not on it
            return [pt(d.X, top, 'above', 'center'), pt(d.X + 22, d.Y + 30, 'right'), pt(d.X - 22, d.Y + 30, 'left'), pt(WIN.x0 + 10, skyY(), 'below'), pt(574, 122, 'left')];
        }));
    }
    function discs() {
        if (!S.open || S.dive || !S.id || !geo) return [];
        const t = t0(), k = unit(), dc = GL.disc(t, S.shownAt), out = [];
        if (dc) { const [x, y] = css(dc[0], dc[1]); out.push([x, y, dc[2] * k]); }
        S.drawn.forEach(d => { const h = d.Sp.canvas.height; [0.42, 0.72].forEach(f => { const [X, Y] = css(d.X, d.Y + h * f); out.push([X, Y, h * 0.2 * k]); }); });
        return out;
    }

    // ═══ setup ═══
    /** A card that turns up while the bridge is up (asked or not) takes no click for 400 ms: a click meant for the bridge
        never lands on it. A card the shell holds back gets the same again when it is let go. */
    function guardCards(list) {
        if (!(S.open || S.dive) || !window.ChoiceGuard) return;
        list.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('modal-overlay')) window.ChoiceGuard.hold(n); }));
    }
    function canvasNamed(id, before) {
        let c = document.getElementById(id);
        if (c) return c;
        const root = document.getElementById('ns-root'); if (!root) return null;
        c = document.createElement('canvas'); c.id = id; c.setAttribute('aria-hidden', 'true');
        root.insertBefore(c, document.getElementById(before) || document.getElementById('ns-words') || null);
        return c;
    }
    function wordsLayer() {
        let layer = document.getElementById('ns-stop-words');
        if (!layer) {                                                     // the shell makes it (BUILD_B §1); a fallback keeps the order
            const words = document.getElementById('ns-words'), voice = document.getElementById('ns-voice');
            layer = document.createElement('div'); layer.className = 'ns-layer'; layer.id = 'ns-stop-words';
            if (words) words.insertBefore(layer, voice || null);
        }
        return layer;
    }
    function init() {
        room = BA.paint();
        fxList = room.fx;
        art = document.createElement('canvas'); art.width = SW; art.height = SH; actx = art.getContext('2d');
        diveC = canvasNamed('ns-dive', 'ns-bridge'); bridgeC = canvasNamed('ns-bridge', 'ns-shade');
        if (diveC && bridgeC && diveC.nextSibling !== bridgeC) diveC.parentNode.insertBefore(diveC, bridgeC);
        dctx = diveC.getContext('2d'); bctx = bridgeC.getContext('2d');
        vis(diveC, false); vis(bridgeC, false);
        W = WORDS.create({
            S, css: (x, y) => css(x, y), unit: () => unit(), t0, poseOf, picking, team, need, arrived, joinedLast, isWrongPlace,
            sweep: () => (S.sweep ? Math.max(0, t0() - S.sweep.t0) : null),
            hold: () => (S.hold ? Math.min(1, Math.max(0, (t0() - S.hold.t0) / SETTLE_HOLD_MS)) : 0),   // how far the settle key has filled
            holdKey: () => (S.hold ? S.hold.key : null), fight: () => (CP ? CP.fightK() : 0),   // which held key; how far Fight to escape has filled
            proposed: () => !!(S.pick.key || S.pick.manual || t0() > S.pick.from + 1500),   // the crew have stepped forward (or should have)
            sprite: (id, act) => CE.sprite(id, act || 'idle', 0, {}), NAMES, TONE, CREW, OFFX, F, HATCH: HATCH + OFFX, NAV: NAV + OFFX, HELM: HELM + OFFX,
        });
        W.init(wordsLayer());
        if (CP) CP.attach({ S, poseOf, glassAt: (c, t) => GL.draw(c, t, { shownAt: S.shownAt, call: false }), sweep: () => (S.sweep ? Math.max(0, t0() - S.sweep.t0) : null) });
        NS.bus.on('dive:start', onDiveStart);
        NS.bus.on('dive:cancel', onDiveCancel);
        NS.bus.on('stop:open', onStopOpen);
        NS.bus.on('stop:refresh', onRefresh);
        NS.bus.on('dive:back', onDiveBack);
        NS.bus.on('trip:down', onTripDown);
        NS.bus.on('trip:back', onTripBack);
        NS.bus.on('flow:go', onFlowGo);
        NS.bus.on('hidden', () => { if (S.open || S.dive) close(false); });
        NS.bus.on('stop:close', () => { if (S.open || S.dive) close(false); });
        NS.bus.on('stop:skim', () => GL.skim(t0()));
        NS.bus.on('hull:hit', () => { hitAt = t0(); });
        new MutationObserver(guardCards).observe(document.body, { childList: true });
        D.later(D.pic(1, 1, [() => mask(0), () => { A.deck(1); }]));
    }
    function resize(G) {
        geo = bg();
        NS.sizeCanvas(diveC);
        bridgeC.width = geo.CW; bridgeC.height = geo.CH;
        Object.assign(bridgeC.style, { width: (geo.CW * geo.bk / geo.dpr) + 'px', height: (geo.CH * geo.bk / geo.dpr) + 'px', left: '0px', top: '0px' });
        dctx.imageSmoothingEnabled = false; bctx.imageSmoothingEnabled = false; inked = false;
        D.resize(G);
    }
    const isOpen = () => !!(S.dive || S.open);
    const debug = () => ({
        open: S.open, dive: S.dive ? { dir: S.dive.dir, open: !!S.dive.open, plated: !!S.dive.plated } : null, id: S.id, shown: S.shownSent,
        actions: S.actions.map(a => ({ key: a.key, words: a.words, near: a.near, team: !!a.team })), lineup: S.lineup.slice(), aside: S.aside.slice(),
        hatch: S.pick.slots.slice(), picked: team(), arrived: team().filter(arrived), why: Object.assign({}, S.pick.why), manual: S.pick.manual, joinedLast: joinedLast(), hover: S.hover, hot: S.hot,
        send: S.send ? S.send.ids.slice() : null, trip: S.trip ? S.trip.ids.slice() : null, drawn: S.drawn.map(d => d.id), glass: GL.current(), atWindow: [...S.atWindow], t: Math.round(t0()),
        sweep: !!S.sweep, autoScan: S.autoScan, skipped: S.send ? !!S.send.skipped : null, aimed: GL.aimed(),
        finds: S.finds.map(f => { const p = S.id && geo ? GL.spot(t0(), S.shownAt, f.at) : null, c = p ? css(p[0], p[1]) : null; return { id: f.id, label: f.label, done: !!f.done, target: !!f.target, risk: f.risk, hint: f.hint, event: f.event || f.site || f.kind, mark: c ? c.map(Math.round) : null }; }),
        plans: Object.fromEntries(Object.entries(S.plans).map(([k, v]) => [k, v.map(q => q.kind + '@' + Math.round(q.t0) + (q.x != null ? ':' + q.x : ''))])),
        words: W ? W.debug() : [],
        people: S.drawn.map(d => { const [x, y] = css(d.X, d.Y + d.Sp.h * 0.5); return { id: d.id, x: Math.round(x), y: Math.round(y) }; }),
    });

    NS.register('stop', { init, resize, update, render, pointer, isOpen, discs, noteUp: () => !!(W && W.noteUp()), debug });
})();
