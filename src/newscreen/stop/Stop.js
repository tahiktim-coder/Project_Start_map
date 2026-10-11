/* ═══ Silent Exodus · new screen (?new=1) · stop/Stop.js: a stop, on the bridge ════════════════════════════════════════
   What it is: arriving at a world, the view dives through our hull onto the bridge (layout D): the world fills the big
   window, Cora is at the helm, Mira at her console, and whoever may go down stands at the window. What we can do here
   is a few words beside what it acts on ("Scan" beside the world, "Answer the call" beside the blink in the sky, "Date
   the wreck" over Mira); "Leave orbit" under the window. A team trip: click two people at the window, then "Send the
   team"; the two walk to the hatch, the shuttle drops to the site, then the real game runs the trip (LanderGame, the
   Torch, the cards). When they are back the shuttle comes up and they climb back. "Leave orbit" plays the dive backwards.
   Every action calls the REAL game through NewScreen.flow (Orbit.js): costs, events, rewards and saves are today's.
   Source: prototypes/slice/stop.js §5-12 (people plans, compose, words, the pick, anchors, discs), without its films,
   MOCKUP moments and slice places (docs/BUILD_B.md §2). Draws ONLY into canvas#ns-dive, canvas#ns-bridge and the word
   layer #ns-stop-words. Loaded only when the new-screen switch is on, after stop/BridgeArt, stop/Dive, stop/Glass.

   NewScreen.mods.stop = { init, resize, update, render, pointer, isOpen, discs, noteUp, debug }
     pointer(type, e)       the shell routes every pointer event here while its mode is not 'travel'; CSS px from e
     isOpen() → bool        the dive or the bridge is on screen
     discs() → [[x, y, r]]  CSS px: the world in the glass and the people on the bridge (words keep off them)
     noteUp() → bool        a person's "good for" line is up (the voice steps back meanwhile)
   Listens: 'dive:start' { id }  'dive:cancel'  'stop:open' { id, dived }  'stop:refresh'  'dive:back'  'trip:down' { ids }
            'trip:back'  'flow:go' { id } (bakes ahead)  'hidden'
   Emits:   'dive:plated' { dir }  'stop:shown' { id }  'stop:hidden' { id }  'stop:pick' { ids }
   Calls:   NewScreen.flow.actions() → [{ key, words, near, team, run }], .act(key, ids), .eligible() → ids, .leave()
   Anchors (CSS px, while open): 'stop:person:<id>', 'stop:aura', 'stop:glass', 'stop:site'
*/
(function () {
    'use strict';
    const NS = window.NewScreen, P = window.NSPaint, A = window.ShipArt, BA = window.NSBridgeArt, CE = window.CrewEngine;
    const D = window.NSDive, GL = window.NSGlass;
    if (!NS || !NS.on || !P || !A || !BA || !CE || !D || !GL) return;
    const { INK, RP, threshold } = P, L = A.L, B = BA.B, R = A.R;
    const SW = GL.SW, SH = GL.SH, OFFX = GL.OFFX, WIN = GL.WIN, F = B.F, STEPS = D.STEPS, PUSH = D.PUSH, DISSOLVE = D.DISSOLVE;
    const SPOT_X = { jaxon: 214, aris: 254, vance: 290, mira: 326 };      // layout D's window spots (fixed per person)
    const HELM = 360, NAV = 488, HATCH = L.LX, WALK = CE.ACTIONS.walk, CLIMB = CE.ACTIONS.climb;
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    const TONE = { cora: '#c9d1d6', jaxon: '#f08c2e', aris: '#ffc27a', vance: '#c4622a', mira: '#e8836a' };   // as the voice lines
    const CREW = ['jaxon', 'aris', 'vance', 'mira'];
    const GOOD = {                                                        // the pick: hover a person (what they do down there, and aboard)
        jaxon: 'Down there I fly the lander. Up here, the drive is mine.',
        aris: 'Down there I bring the hurt back walking. Up here, the med bay.',
        vance: 'Down there I take the hit for the other one. Up here, I keep people safe.',
        mira: 'Down there I bring their star fix back. Up here, I scan the site.',
    };
    const SEND_MS = 2400, SHUTTLE_MS = 2200, GUARD_MS = 400, READ_MS = 250, MAX_LIT = 4, MAX_WORDS = 40, GATHER_LEAD = 2600;
    const WORTH = ['light', 'escape', 'accept', 'call', 'date', 'team', 'dock', 'mine', 'settle', 'scan', 'skim'];   // more than 4: these first
    const NEAR_WORLD = ['world', 'station', 'field', 'giant', 'site', 'light'];
    const wordsIn = s => (String(s || '').trim().match(/\S+/g) || []).length;

    // ── the stop's own state (none of it is game state) ──
    const S = {
        dive: null,          // NSDive dive while the push runs: { dir, t0, open, dissolveAt, plated, done }
        open: false, fadeAt: null, shownAt: -1e9, shownSent: false,
        id: null, node: null,
        plans: {}, drawn: [], atWindow: new Set(),
        actions: [], readAt: -1e9, lineup: [],
        picked: [], hover: null, hot: null, clickAt: 0,
        send: null,          // { ids, t0, fired } between the click and flow.act
        trip: null,          // { ids } while the team is down
        words: null, wordShown: new Map(), decks: null,
    };
    let room = null, art = null, actx = null, diveC = null, bridgeC = null, dctx = null, bctx = null, layer = null, fxList = [];
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
    function exitDown(id, t) {
        const from = cut(id, t), pl = S.plans[id];
        if (!from || from.hidden) { hidePlan(id); return; }
        const n = Math.ceil(Math.abs(from.x - HATCH) / WALK.move), tw = t + n * WALK.ms, tc = tw + (64 / CLIMB.rise) * CLIMB.ms;
        pl.push({ kind: 'walk', x0: from.x, x1: HATCH, t0: t, t1: tw }, { kind: 'climb', y0: F, y1: F + 64, t0: tw, t1: tc }, { kind: 'gone', t0: tc, t1: Infinity });
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
    /** Where everyone should be now: Cora at the helm; whoever may go at the window while a team action waits (and they stay
        there for the rest of the stop); Mira at her console otherwise; the team away; the hurt, the confined and the dead
        are not on the bridge. */
    function desired() {
        const away = S.trip ? S.trip.ids : S.send ? S.send.ids : [], out = { cora: crewOf('cora') === 'dead' ? null : { x: HELM, act: 'console', facing: 1 } };
        CREW.forEach(id => {
            if (crewOf(id) !== 'well' || away.includes(id)) { out[id] = null; return; }
            if (S.lineup.includes(id) || S.atWindow.has(id)) { out[id] = { x: SPOT_X[id], act: 'idle', facing: 1 }; return; }
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
            if (last && last.kind === 'stay' && last.x === w.x && last.act === w.act) return;
            if (settle) { stayPlan(id, w.x, w.act, w.facing); return; }
            if (seen) walkTo(id, t, w.x, w.act, w.facing); else entering.push([id, w]);
        });
        entering.sort((a, b) => b[1].x - a[1].x).forEach(([id, w], i) => enterTo(id, t + i * 700, w.x, w.act, w.facing));
    }

    // ═══ 2. one frame of the bridge ═══
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
    function floorGlow(c, x, y, peak) {                                   // a warm pool of light under someone chosen (or pointed at)
        const f = P.framer(c, SW, SH);
        for (let dy = -3; dy <= 2; dy++) for (let dx = -22; dx <= 22; dx++) { const d = Math.hypot(dx / 22, dy / 3.2); if (d < 1) f.tone(x + dx, y + dy, RP.AMBER, peak * (1 - d) ** 1.4); }
    }
    const picking = () => !S.send && !S.trip && S.lineup.length >= 2 && hasTeamAction();
    function drawPeople(c, t) {
        S.drawn = [];
        const list = ['cora'].concat(CREW).map(id => ({ id, p: poseOf(id, t) })).filter(o => o.p && !o.p.hidden);
        list.sort((a, b) => (a.p.climbing ? -1 : 0) - (b.p.climbing ? -1 : 0) || a.p.x - b.p.x).forEach(({ id, p }) => {
            const pk = picking(), picked = pk && S.picked.includes(id), hot = pk && S.hover === id;
            const still = p.act === 'idle' || p.act === 'console', ms = still ? p.ms + (CREW.indexOf(id) + 1) * 977 : p.ms;
            const blink = ((ms + (CREW.indexOf(id) + 2) * 1700) % 4300) < 140;
            const Sp = CE.sprite(id, p.act, CE.frameAt(p.act, ms), { blink, warm: picked ? 3 : hot ? Math.max(2, lightFor(p.x)) : lightFor(p.x), rim: p.facing, screen: p.act === 'console' });
            const X = Math.round(p.x) + OFFX, Y = Math.round(p.y) + (picked ? 3 : 0) - Sp.origin.y;
            if (picked || hot) floorGlow(c, X, Math.round(p.y) + (picked ? 3 : 0), picked ? 0.5 : 0.28);
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
    function composeBridge(t) {
        const c = actx;
        c.imageSmoothingEnabled = false;
        c.globalCompositeOperation = 'source-over';
        c.fillStyle = INK; c.fillRect(0, 0, SW, SH);
        drawSides(c, t);
        GL.draw(c, t, { shownAt: S.shownAt, call: S.actions.some(a => a.key === 'call') });
        c.drawImage(room.canvas, OFFX, 0);
        c.globalCompositeOperation = 'lighter'; c.drawImage(room.glass, 0, 0); c.globalCompositeOperation = 'source-over';
        c.drawImage(A.deck(1).canvas, OFFX, B.H);
        drawFx(P.framer(c, SW, SH), t);
        drawPeople(c, t);
        drawDamage(c, t);
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
    function drawDamage(c, t) {
        const d = S.decks;
        if (!d) return;
        if (!washes) washes = { bridge: wash(0, B.H), lab: wash(B.H, SH), dark: null };
        if (d.bridge === 'red' && t % 4200 > 140) c.drawImage(washes.bridge, 0, 0);   // a broken lamp's flicker
        if (d.lab === 'red') c.drawImage(washes.lab, 0, 0);
        if (d.engineering === 'red' && t % 2900 < 160) { c.fillStyle = 'rgba(5,7,10,0.45)'; c.fillRect(0, 0, SW, SH); }
    }
    const speaking = () => { const v = NS.mods.voice; try { return v && v.speaking ? v.speaking() : null; } catch (err) { return null; } };

    // ═══ 3. what we can do here: the game's own list (Orbit.js), read every 250 ms ═══
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
        const team = S.actions.some(a => a.team);
        S.lineup = team && !S.send && !S.trip ? elig.filter(id => CREW.includes(id)) : [];
        S.picked = S.picked.filter(id => S.lineup.includes(id));
        crewNow = crewMap();
        try { S.decks = NS.game.decks(); } catch (err) { S.decks = null; }
    }
    const hasTeamAction = () => S.actions.some(a => a.team);
    const isWrongPlace = () => S.actions.some(a => a.key === 'escape' || a.key === 'accept') || !!(S.node && S.node._isWrongPlace);
    const both = ids => ids.map(id => NAMES[id] || id).join(' and ');

    // ═══ 4. words in #ns-stop-words: the name in a corner, each action beside what it acts on, "Leave orbit" under ═══
    function makeWords() {
        layer = document.getElementById('ns-stop-words');
        if (!layer) {                                                     // the shell makes it (BUILD_B §1); a fallback keeps the order
            const words = document.getElementById('ns-words'), voice = document.getElementById('ns-voice');
            layer = document.createElement('div'); layer.className = 'ns-layer'; layer.id = 'ns-stop-words';
            if (words) words.insertBefore(layer, voice || null);
        }
        if (!document.getElementById('ns-stop-style')) {
            const st = document.createElement('style');
            st.id = 'ns-stop-style';
            st.textContent = `#ns-stop-words { --fs-act: calc(17px + 3px * var(--t, 1)); --fs-act-sub: calc(14px + 1px * var(--t, 1)); }
#ns-stop-words .sw { position: absolute; left: 0; top: 0; margin: 0; opacity: 0; white-space: nowrap; pointer-events: none;
    transition: opacity 420ms var(--ease), color 140ms var(--ease); text-shadow: 0 1px 0 #05070a, 0 0 6px rgba(5,7,10,.9), 0 0 2px #05070a; }
#ns-stop-words .sw.on { opacity: 1; }
#ns-stop-words .sw-name { font: 500 var(--fs-note-name)/1.15 var(--f-ui); letter-spacing: .02em; color: var(--dim); }
#ns-stop-words .sw-act { display: grid; gap: 2px; justify-items: end; text-align: right; }
#ns-stop-words .sw-act.at-left { justify-items: start; text-align: left; }
#ns-stop-words .sw-act b { font: 500 var(--fs-act)/1.15 var(--f-ui); letter-spacing: .02em; color: var(--warm); }
#ns-stop-words .sw-act span { font: 400 var(--fs-act-sub)/1.3 var(--f-text); color: var(--dim); }
#ns-stop-words .sw-act span:empty { display: none; }
#ns-stop-words .sw-act.is-faint b { color: var(--dim); }
#ns-stop-words .sw-act.is-hot b { color: var(--warm-br); }
#ns-stop-words .sw-leave { font: 400 var(--fs-act-sub)/1.2 var(--f-text); color: var(--ui); }
#ns-stop-words .sw-leave.is-hot { color: var(--warm-br); }
#ns-stop-words .sw-good { white-space: normal; max-width: calc(260px + 60px * var(--t, 1)); padding-left: 9px; border-left: 2px solid var(--who, #c9d1d6);
    font: 400 var(--fs-note-line)/1.35 var(--f-text); color: #eceae2; }
#ns-stop-words .sw-good b { display: block; margin-bottom: 2px; font: 600 var(--fs-who)/1.2 var(--f-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--who, #c9d1d6); }
@media (prefers-reduced-motion: reduce) { #ns-stop-words .sw { transition: none; } }`;
            document.head.appendChild(st);
        }
        const mk = (cls, html) => { const e = document.createElement('div'); e.className = 'sw ' + cls; e.innerHTML = html; layer.appendChild(e); return e; };
        S.words = { name: mk('sw-name', ''), acts: [0, 1, 2, 3].map(() => mk('sw-act', '<b></b><span></span>')), leave: mk('sw-leave', 'Leave orbit'), good: mk('sw-good', '<b></b><span></span>') };
        S.words.acts.forEach(el => { el.dataset.key = ''; });
    }
    const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function put(el, on, x, y) {
        if (!el) return;
        const was = el.classList.contains('on');
        el.classList.toggle('on', !!on);
        if (on) { el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; if (!was) S.wordShown.set(el, performance.now()); }
    }
    function hideWords() { if (!S.words) return; [S.words.name, S.words.leave, S.words.good].concat(S.words.acts).forEach(el => put(el, false)); }
    const titleCase = s => (s && s === s.toUpperCase() && /[A-Z]/.test(s) ? s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : s);
    function teamSub() {
        if (S.picked.length < 2) return 'Choose two at the window';
        return both(S.picked) + ' take the shuttle';
    }
    /** The action shown now (up to MAX_LIT) with where each goes. The ones beside the world stack under each other. */
    function layout(t) {
        const g = GL.geom(t, S.shownAt), k = unit(), site = GL.site(t, S.shownAt), kind = g.kind;
        const rank = a => { const i = WORTH.indexOf(a.key); return i < 0 ? WORTH.length : i; };
        const best = S.actions.slice().sort((a, b) => rank(a) - rank(b)).slice(0, MAX_LIT);
        const shown = S.actions.filter(a => best.includes(a)), out = [];             // the rest wait their turn (one goes, the next shows)
        const disc = GL.disc(t, S.shownAt) || [g.x, g.y, g.r];
        let edge = kind === 'giant' ? site[0] + 40 : disc[0] - disc[2] - 12, top = kind === 'giant' ? WIN.y0 + 70 : site[1] - 12;
        edge = Math.max(WIN.x0 + 40, edge);
        const worldStack = shown.filter(a => NEAR_WORLD.includes(a.near) || (a.near === 'under' && !isWrongPlace()));
        const [ex, ey] = css(edge, top);
        worldStack.forEach(a => out.push({ a, x: ex, y: ey, align: 'right' }));   // stacked under each other in placeWords
        const mira = S.drawn.find(d => d.id === 'mira');
        shown.filter(a => !worldStack.includes(a)).forEach(a => {
            if (a.near === 'call' || a.near === 'glass') { const [cx, cy] = GL.callAt(), [x, yy] = css(cx + 10, cy - 8); out.push({ a, x, y: yy, align: 'left' }); }
            else if (a.near === 'mira' && mira && mira.X > WIN.x0) { const [x, yy] = css(mira.X, mira.Y - 12); out.push({ a, x, y: yy, align: 'center' }); }
            else if (a.near === 'under') { const [x, yy] = css(WIN.x0 + 24, WIN.y1 - 40); out.push({ a, x, y: yy, align: 'row' }); }   // no world word: a row in the open sky, low left
            else { const [x, yy] = css(470, WIN.y1 + 12); out.push({ a, x, y: yy, align: 'center' }); }   // 'aura' and anything else: under the window
        });
        return { out, k, top: ey };
    }
    function placeWords(t) {
        const W = S.words; if (!W) return;
        const settled = GL.settled(t, S.shownAt), busy = !!S.send;
        const hovering = picking() && !!S.hover;                         // the hover line speaks: the corner name and the sub-lines step back
        const voice = NS.mods.voice && NS.mods.voice.current ? NS.mods.voice.current() : null;
        let budget = MAX_WORDS - (voice ? wordsIn(voice.who) + wordsIn(voice.line) : 0);
        // what each act word says now
        const L0 = settled && !busy ? layout(t) : { out: [] }, items = [];
        L0.out.forEach(o => {
            const a = o.a, team = !!a.team, faint = team && S.picked.length < 2;
            items.push({ o, words: a.words, sub: team ? teamSub() : '', faint });
        });
        const leaveOn = settled && !busy && !isWrongPlace();
        budget -= leaveOn ? 2 : 0;
        items.forEach(it => { budget -= wordsIn(it.words); });
        const d = hovering && S.drawn.find(q => q.id === S.hover), good = d ? GOOD[d.id] : null;
        if (good) budget -= wordsIn(good) + 1;
        items.forEach(it => { if (!hovering && it.sub && budget - wordsIn(it.sub) >= 0) budget -= wordsIn(it.sub); else it.sub = ''; });
        const nameText = S.node ? titleCase(S.node.name || '') : '';
        const nameOn = settled && !hovering && nameText && budget - wordsIn(nameText) >= 0;
        setText(W.name, nameText);
        const [nx, ny] = css(WIN.x0 + 10, WIN.y0 + 8); put(W.name, nameOn, nx, ny);
        // the act words: right-aligned stacks beside the world, the others where they belong
        let stackY = null, rowX = null;
        W.acts.forEach((el, i) => {
            const it = items[i];
            if (!it) { put(el, false); el.dataset.key = ''; return; }
            const a = it.o.a;
            setText(el.querySelector('b'), a.words); setText(el.querySelector('span'), it.sub);
            el.dataset.key = a.key;
            el.classList.toggle('is-faint', it.faint);
            el.classList.toggle('is-hot', S.hot === a.key && !it.faint);
            el.classList.toggle('at-left', it.o.align === 'left');
            const w = el.offsetWidth || 120, h = el.offsetHeight || 24;
            let x = it.o.x, y = it.o.y;
            if (it.o.align === 'right') { if (stackY == null) stackY = y; y = stackY; stackY += h + 8; x -= w; }
            else if (it.o.align === 'center') { x -= w / 2; y -= h; }
            else if (it.o.align === 'row') { if (rowX == null) rowX = x; x = rowX; rowX += w + 28; }
            x = Math.max(16, Math.min(innerWidth - w - 16, x)); y = Math.max(16, Math.min(innerHeight - h - 16, y));
            put(el, true, x, y);
        });
        W.leave.classList.toggle('is-hot', S.hot === 'leave');
        const [lx, ly] = css(553, WIN.y1 + 12); put(W.leave, leaveOn, lx - (W.leave.offsetWidth || 0) / 2, ly);
        if (good) {
            setText(W.good.querySelector('b'), NAMES[d.id]); setText(W.good.querySelector('span'), good); W.good.style.setProperty('--who', TONE[d.id]);
            const k = unit(), w = W.good.offsetWidth || 280, h = W.good.offsetHeight || 48, dc = GL.disc(t, S.shownAt);
            let [gx, gy] = css(d.X, d.Y - 8); gx -= w / 2; gy -= h;
            if (dc) {
                const [cx, cy] = css(dc[0], dc[1]), r = dc[2] * k + 10;
                const hits = x => { const qx = Math.max(x, Math.min(cx, x + w)), qy = Math.max(gy, Math.min(cy, gy + h)); return Math.hypot(qx - cx, qy - cy) < r; };
                const [minX] = css(WIN.x0 + 4, 0);
                while (hits(gx) && gx > minX) gx -= 8;
                gx = Math.max(minX, gx);
            }
            put(W.good, true, Math.max(16, gx), Math.max(16, gy));
        } else put(W.good, false);
    }

    // ═══ 5. the bus ═══
    const nodeOf = id => { try { const s = NS.game.state(); return (window.NSRoute && window.NSRoute.find(s, id)) || (s && s.currentSystem && s.currentSystem.id === id ? s.currentSystem : null); } catch (err) { return null; } };
    const currentNode = () => { try { const s = NS.game.state(); return s ? s.currentSystem : null; } catch (err) { return null; } };
    function freshStop(id, node) {
        S.id = id; S.node = node; S.plans = {}; S.drawn = []; S.atWindow = new Set(); S.actions = []; S.lineup = []; S.picked = [];
        S.hover = null; S.hot = null; S.send = null; S.trip = null; S.shownSent = false; S.readAt = -1e9;
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
        S.hover = null; S.hot = null;
        hideWords();
    }
    /** The team goes down: from our own click (we already walked them out), or from the game alone. */
    function onTripDown(p) {
        const t = t0(), ids = (p && Array.isArray(p.ids) ? p.ids : (S.send && S.send.ids) || S.picked).filter(id => CREW.includes(id));
        if (S.trip) return;
        S.trip = { ids: ids.slice() };
        if (!S.send) {                                                   // the game sent them without our click: walk them out now
            ids.forEach((id, i) => exitDown(id, t + i * 400));
            GL.shuttle('down', t + 300, SHUTTLE_MS);
        }
        S.send = null; S.picked = []; S.lineup = [];
    }
    function onTripBack() {
        const t = t0(), ids = S.trip ? S.trip.ids : [];
        S.trip = null; S.send = null;
        GL.shuttle('up', t + 300, SHUTTLE_MS + 200);
        crewNow = crewMap();
        ids.forEach((id, i) => { if (crewOf(id) === 'well') { S.atWindow.add(id); enterTo(id, t + SHUTTLE_MS + 700 + i * 700, SPOT_X[id], 'idle', 1); } });
    }
    function onFlowGo(p) { const node = p && nodeOf(p.id); if (node) GL.prepare(node); D.prepare(); }

    // ═══ 6. the clock ═══
    function emit(name, payload) { NS.bus.emit(name, payload); }
    function update(dt, t) {
        D.bake(dt > 0 ? 4 : 2);
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
                if (!d.plated && el >= DISSOLVE) { d.plated = true; S.open = false; hideWords(); registerAnchors(false); emit('dive:plated', { dir: 'out' }); }
                if (!d.done && el >= DISSOLVE + PUSH) { d.done = true; close(true); }
            }
        }
        if (S.open && !S.dive && S.fadeAt != null && t - S.fadeAt >= DISSOLVE && !S.shownSent) shown();
        if (S.send && !S.send.fired && t - S.send.t0 >= SEND_MS && !NS.blocked()) fireSend();   // a card came up meanwhile: they wait at the hatch
        if ((S.open || S.dive) && t - S.readAt >= READ_MS && S.id && !(S.dive && !S.dive.open && S.dive.dir === 'in')) { readActions(t); if (S.open && !(S.dive && S.dive.dir === 'out')) reconcile(t); }
    }
    function shown() {
        if (S.shownSent) return;
        S.shownSent = true;
        registerAnchors(true);
        emit('stop:shown', { id: S.id });
    }
    function close(tell) {
        const id = S.id;
        S.dive = null; S.open = false; S.fadeAt = null; S.id = null; S.node = null; S.picked = []; S.hover = null; S.hot = null; S.send = null; S.trip = null;
        S.shownSent = false; S.actions = []; S.lineup = [];
        GL.shuttle(null); GL.place(null);
        registerAnchors(false); hideWords(); setPointing(false);
        if (tell) emit('stop:hidden', { id });
    }
    /** "Send the team": the 2.4 s are up (they walked to the hatch, the shuttle unclamped); the real trip begins. */
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
            S.send = null; const t = t0();
            ids.forEach((id, i) => { if (crewOf(id) === 'well') enterTo(id, t + 300 + i * 600, SPOT_X[id], 'idle', 1); });
            GL.shuttle('up', t, SHUTTLE_MS);
        }
    }

    // ═══ 7. drawing: which canvases show, and what is in them ═══
    function vis(c, on) { const v = on ? 'block' : 'none'; if (c && c.style.display !== v) c.style.display = v; }
    let inked = false;
    function render(t) {
        if (!room) return;
        const d = S.dive, G = NS.G;
        if (!d && !S.open) { vis(diveC, false); vis(bridgeC, false); hideWords(); inked = false; return; }
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
        if (j <= 0) { vis(bridgeC, false); hideWords(); return; }
        composeBridge(t);
        if (j < STEPS) { actx.globalCompositeOperation = 'destination-in'; actx.drawImage(mask(j - 1), 0, 0); actx.globalCompositeOperation = 'source-over'; }
        bctx.clearRect(0, 0, geo.CW, geo.CH);
        drawMargins(t, j);
        bctx.drawImage(art, geo.ox, geo.oy);
        vis(bridgeC, true);
        if (j < STEPS || (d && d.dir === 'out')) hideWords(); else placeWords(t);
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
    function inside(el, cx, cy, pad = 8) {
        if (!el || !el.classList.contains('on')) return false;
        const r = el.getBoundingClientRect();
        return cx >= r.left - pad && cx <= r.right + pad && cy >= r.top - pad && cy <= r.bottom + pad;
    }
    function setPointing(on) { const root = document.getElementById('ns-root'); if (root) root.classList.toggle('is-pointing', !!on); }
    const fresh = el => performance.now() - (S.wordShown.get(el) || 0) < GUARD_MS;     // a newly shown word ignores clicks
    function pointer(type, e) {
        if (!S.open || S.dive || S.fadeAt != null && t0() - S.fadeAt < DISSOLVE || NS.blocked()) { if (type === 'move' || type === 'leave') { S.hover = null; S.hot = null; setPointing(false); } return false; }
        const t = t0(), cx = e.clientX, cy = e.clientY, [ax, ay] = toFrame(cx, cy), W = S.words;
        if (type === 'leave') { S.hover = null; S.hot = null; setPointing(false); return false; }
        if (S.send) { setPointing(false); return type === 'down'; }        // the shuttle is unclamping: clicks wait
        const act = W.acts.find(el => el.dataset.key && inside(el, cx, cy)), onLeave = inside(W.leave, cx, cy);
        const who = picking() ? personAtPx(ax, ay) : null, pickable = who && S.lineup.includes(who) ? who : null;
        if (type === 'move') {
            S.hot = act ? act.dataset.key : onLeave ? 'leave' : null; S.hover = pickable;
            const on = !!(act && !act.classList.contains('is-faint')) || onLeave || !!pickable;
            setPointing(on); return on;
        }
        if (type !== 'down') return false;
        if (t - S.clickAt < 300) return true;
        if (onLeave && !fresh(W.leave)) { S.clickAt = t; leave(); return true; }
        if (act && !fresh(act)) { S.clickAt = t; doAct(act.dataset.key, t); return true; }
        if (pickable) {
            S.picked = S.picked.includes(pickable) ? S.picked.filter(id => id !== pickable) : S.picked.concat(pickable).slice(-2);
            if (S.picked.length === 2) { S.words.acts.forEach(el => { if (el.dataset.key === 'team') S.wordShown.set(el, performance.now()); }); }
            emit('stop:pick', { ids: S.picked.slice() });
            return true;
        }
        return false;
    }
    function say(text) { const v = NS.mods.voice; if (v && v.say) { try { v.say({ id: 'aura', who: 'A.U.R.A.', text }); } catch (err) { console.error('NewScreen stop: voice failed', err); } } }
    function doAct(key, t) {
        const a = S.actions.find(q => q.key === key);
        if (!a) return;
        if (a.team) {
            if (S.picked.length < 2) { say('Choose two to go, Commander.'); return; }
            S.send = { ids: S.picked.slice(), t0: t, fired: false };
            S.send.ids.forEach((id, i) => exitDown(id, t + 150 + i * 350));
            GL.shuttle('down', t + 200, SHUTTLE_MS);
            S.hover = null; S.hot = null; setPointing(false);
            return;
        }
        if (key === 'skim') GL.skim(t);
        S.readAt = t + 400 - READ_MS;                                    // the list changes after this; look again soon
        try {
            if (NS.flow && typeof NS.flow.act === 'function') NS.flow.act(key);
            else if (typeof a.run === 'function') a.run();
        } catch (err) { console.error(`NewScreen stop: the action "${key}" failed`, err); }
    }
    function leave() {
        S.hover = null; S.hot = null; setPointing(false);
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
        // A.U.R.A. speaks in the open sky of the glass's left (the world fills the right); the grille is the fallback
        NS.anchors.set('stop:aura', () => [pt(WIN.x0 + 12, WIN.y0 + 26, 'below'), pt(WIN.x0 + 12, WIN.y1 - 70, 'below'), pt(574, 122, 'left')]);
        NS.anchors.set('stop:glass', () => [pt(WIN.x0 + 12, WIN.y0 + 26, 'below'), pt(WIN.x0 + 12, WIN.y1 - 70, 'below'), pt(290, WIN.y0 + 12, 'below')]);
        NS.anchors.set('stop:site', () => { const t = t0(), g = GL.geom(t, S.shownAt), [sx, sy] = GL.site(t, S.shownAt); return [pt(Math.max(WIN.x0 + 20, g.x - g.r - 12), sy, 'left'), pt(sx, Math.min(WIN.y1 - 10, g.y + g.r + 8), 'below', 'center')]; });
        ['cora'].concat(CREW).forEach(id => NS.anchors.set('stop:person:' + id, () => {
            const d = S.drawn.find(q => q.id === id); if (!d) return [];
            return [pt(d.X, d.Y + 2, 'above', 'center'), pt(d.X + 22, d.Y + 30, 'right'), pt(d.X - 22, d.Y + 30, 'left'), pt(WIN.x0 + 12, WIN.y0 + 26, 'below'), pt(574, 122, 'left')];
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
    function canvasNamed(id, before) {
        let c = document.getElementById(id);
        if (c) return c;
        const root = document.getElementById('ns-root'); if (!root) return null;
        c = document.createElement('canvas'); c.id = id; c.setAttribute('aria-hidden', 'true');
        root.insertBefore(c, document.getElementById(before) || document.getElementById('ns-words') || null);
        return c;
    }
    function init() {
        room = BA.paint();
        fxList = room.fx;
        art = document.createElement('canvas'); art.width = SW; art.height = SH; actx = art.getContext('2d');
        diveC = canvasNamed('ns-dive', 'ns-bridge'); bridgeC = canvasNamed('ns-bridge', 'ns-shade');
        if (diveC && bridgeC && diveC.nextSibling !== bridgeC) diveC.parentNode.insertBefore(diveC, bridgeC);
        dctx = diveC.getContext('2d'); bctx = bridgeC.getContext('2d');
        vis(diveC, false); vis(bridgeC, false);
        makeWords();
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
        actions: S.actions.map(a => ({ key: a.key, words: a.words, near: a.near, team: !!a.team })), lineup: S.lineup.slice(), picked: S.picked.slice(),
        send: S.send ? S.send.ids.slice() : null, trip: S.trip ? S.trip.ids.slice() : null, drawn: S.drawn.map(d => d.id), glass: GL.current(), atWindow: [...S.atWindow], t: Math.round(t0()),
        plans: Object.fromEntries(Object.entries(S.plans).map(([k, v]) => [k, v.map(q => q.kind + '@' + Math.round(q.t0) + (q.x != null ? ':' + q.x : ''))])),
        words: S.words ? [S.words.name, S.words.leave, S.words.good].concat(S.words.acts).filter(el => el.classList.contains('on')).map(el => ({ text: el.textContent, rect: (r => [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)])(el.getBoundingClientRect()) })) : [],
        people: S.drawn.map(d => { const [x, y] = css(d.X, d.Y + d.Sp.h * 0.5); return { id: d.id, x: Math.round(x), y: Math.round(y) }; }),
    });

    NS.register('stop', { init, resize, update, render, pointer, isOpen, discs, noteUp: () => !!(S.words && S.words.good.classList.contains('on')), debug });
})();
