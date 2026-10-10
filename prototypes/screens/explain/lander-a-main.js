/* Silent Exodus · layouts · variant A ("Side by side") · one picture: the living ship on the left, the journey on the right.
   One canvas, one pixel size, one sky. The tower is drawn over the travel view's space, so the hull's outside edge is the
   only divider; the light on the right lights the hull's edge as it lights the worlds.
   Everything on screen is a function of the clock (and of a stop, if the player made one), so a still is the same picture
   every time:  ?t=ms opens paused at that time · ?arrive=titan&at=ms stops at a world at that time · ?leave=ms leaves it.
   window.variantA = { pause, play, step(ms), setTime(ms), arrive(id), leave(), state(), stats() }
*/
(function () {
    'use strict';
    const P = window.V3Paint, A = window.ShipArt, L = A.L, SIM = window.ShipSimA, TW = window.TowerA, TA = window.TravelA;
    const { INK, RP, threshold, level } = P;
    const q = new URLSearchParams(location.search);
    const $ = id => document.getElementById(id);
    const view = $('view'), vctx = view.getContext('2d');
    const art = document.createElement('canvas'), ctx = art.getContext('2d');
    const C = TA.CRUISE, LAP = TA.LAP, HULL_OUT = L.CX + L.HO + 9, F = L.DECK_FLOOR;
    const BRAKE = 1.1, PICKUP = 1.6;                     // seconds: how fast we slow into a stop, and pick up speed leaving it

    // ── the screen ──
    const G = { k: 2, dpr: 1, W: 0, H: 0, offX: 0, hull: 0, hullIn: 0, light: [0, 0] };
    const clampCam = y => Math.max(0, Math.min(L.H - G.H, y));
    const FRAMES = {
        pair0: () => A.deckTop(0) + L.PITCH - G.H / 2 + 6,          // the bridge and the lab
        deck0: () => A.deckTop(0) + L.PITCH / 2 - G.H / 2,          // the bridge, with the nose above it
        deck2: () => A.deckTop(2) + L.PITCH / 2 - G.H / 2,          // the galley, half the lab above and half the med bay below
        deck5: () => A.deckTop(5) + L.PITCH / 2 - G.H / 2 + 20,     // EXPLAIN: engineering, the reactor
        deck45: () => A.deckTop(4) + L.PITCH - G.H / 2 + 40,        // EXPLAIN: the hold and engineering
    };
    const camOf = name => Math.round(clampCam(FRAMES[name]()));
    G.windowY = name => (name === 'port2' ? A.deckTop(2) + F - 152 - camOf('deck2') : A.deckTop(0) + F - 121 - camOf(name === 'win0pair' ? 'pair0' : 'deck0'));
    let TR = null, vignette = null;
    function measure() {
        G.dpr = window.devicePixelRatio || 1;
        const devW = Math.round(innerWidth * G.dpr), devH = Math.round(innerHeight * G.dpr);
        G.k = Number(q.get('px')) > 0 ? Math.round(Number(q.get('px'))) : Math.max(2, Math.floor(devH / 432));
        G.W = Math.ceil(devW / G.k); G.H = Math.ceil(devH / G.k);
        G.offX = Math.round(G.W * (Number(q.get('split')) || 0.4)) - HULL_OUT;   // EXPLAIN: ?split= the tower's share
        G.hull = G.offX + HULL_OUT + 1; G.hullIn = G.offX + L.CX + L.HO;
        G.light = [G.W - 64, Math.round(G.H * 0.4)];
        art.width = G.W; art.height = G.H;
        view.width = G.W * G.k; view.height = G.H * G.k;
        view.style.width = (G.W * G.k / G.dpr) + 'px'; view.style.height = (G.H * G.k / G.dpr) + 'px';
        TR = TA.make(G);
        vignette = makeVignette();
    }
    /** The ship runs on past the left edge into the dark: a dithered fade, the same grain as everything else. */
    function makeVignette() {
        const w = Number(q.get('vig')) || 64, c = document.createElement('canvas');   // EXPLAIN: ?vig= fade width c.width = w; c.height = G.H;
        const g = c.getContext('2d'); g.fillStyle = INK;
        for (let y = 0; y < G.H; y++) for (let x = 0; x < w; x++) if (threshold(x, y) < Math.pow(1 - x / w, 1.7) * 0.92) g.fillRect(x, y, 1, 1);
        return c;
    }

    // ── the clock and the flight. D: px flown. A stop brakes us to a halt; leaving picks the speed back up. ──
    const S = { t: 0, playing: true, last: null, seg: { t: 0, D: 0, mode: 'cruise' }, arr: null, manual: null, said: null, hover: q.get('hover') || null, bake: [], frames: [] };
    function travelD(t) {
        const s = S.seg, u = Math.max(0, (t - s.t) / 1000);
        if (s.mode === 'brake') return s.D + C * BRAKE * (1 - Math.exp(-u / BRAKE));
        if (s.mode === 'resume') return s.D + C * (u - PICKUP * (1 - Math.exp(-u / PICKUP)));
        return s.D + C * u;
    }
    function speedAt(t) {
        const s = S.seg, u = Math.max(0, (t - s.t) / 1000);
        return s.mode === 'brake' ? C * Math.exp(-u / BRAKE) : s.mode === 'resume' ? C * (1 - Math.exp(-u / PICKUP)) : C;
    }
    const lapSec = t => ((t / 1000) % LAP + LAP) % LAP;
    const st = () => ({ t: S.t, D: travelD(S.t), speed: speedAt(S.t), arr: S.arr });

    // ── the camera follows what is happening: a short script over the lap, eased; the wheel takes over for a while ──
    const SHOTS = [[0, 'pair0'], [33, 'deck0'], [66, 'pair0'], [86, 'deck2'], [142, 'pair0']];
    function directed(t) {
        const s = lapSec(t), n = SHOTS.length;
        let i = n - 1; while (i > 0 && SHOTS[i][0] > s) i--;
        const cur = camOf(SHOTS[i][1]), prev = camOf(SHOTS[(i - 1 + n) % n][1]), since = (s - SHOTS[i][0]) * 1000;
        return prev + (cur - prev) * (1 - Math.exp(-since / 650));
    }
    function camY() {
        if (q.has('shot')) return camOf(q.get('shot'));                          // EXPLAIN: a fixed frame
        if (S.manual && performance.now() < S.manual.until) return S.manual.y;
        S.manual = null;
        return Math.round(directed(S.t));
    }

    // ── words: A.U.R.A. on the travel side, a person's line over their head, a world's name beside it ──
    const VOICE = [[6, 12.5, 'A station ahead, Commander. Its docking port still answers.'], [27.5, 34, 'The beacon is coming from that dry world ahead, Commander.'],
        [160, 166.5, 'A dead rock, Commander. There is no signal from it.']];
    function voiceNow() {
        if (q.has('voice')) return q.get('voice') || null;                       // EXPLAIN: a fixed line (empty: none)
        const a = S.arr;
        if (a) {
            const pl = place(a.id), s = (S.t - a.t0) / 1000;
            if (a.t1 == null && s > 1.2 && s < 9) return pl.orbit.arrive[1];
            if (a.t1 != null && (S.t - a.t1) / 1000 < 4.5) return 'Back on our heading, Commander.';
            if (a.t1 == null) return null;
        }
        const s = lapSec(S.t), v = VOICE.find(([a0, a1]) => s >= a0 && s < a1);
        return v ? v[2] : null;
    }
    const place = id => TR.PLACES.find(p => p.id === id);
    const voiceEl = $('voice'), noteEl = $('note'), hintEl = $('hint'), sayEl = $('say'), headEl = $('orbit-head'), backEl = $('back');
    function setText(el, sel, text) { const e = sel ? el.querySelector(sel) : el; if (e.textContent !== text) e.textContent = text; }
    const css = v => v * G.k / G.dpr;
    function updateWords(cam) {
        const voice = voiceNow();
        voiceEl.classList.toggle('on', !!voice);
        if (voice) setText(voiceEl, 'span', voice);
        voiceEl.style.left = css(G.hull + 30) + 'px'; voiceEl.style.top = (css(G.H) - 52 - voiceEl.offsetHeight) + 'px';
        // the world we can stop at: its name and one line, beside it
        const s0 = st(), target = S.arr && S.arr.t1 == null ? null : stoppable(s0);
        noteEl.classList.toggle('on', !!target);
        if (target) {
            const { pl, g } = target;
            setText(noteEl, '.name', pl.name); setText(noteEl, '.line', q.has('line') ? q.get('line') : pl.line);
            setText(noteEl, '.cost', q.get('note') === 'numbers' ? '5 energy · uses a stop' : '');   // EXPLAIN: today's note, with numbers
            noteEl.querySelector('.cost').style.display = q.get('note') === 'numbers' ? '' : 'none';
            noteEl.classList.toggle('hot', S.hover === pl.id);
            const w = noteEl.offsetWidth, h = noteEl.offsetHeight;
            let x = css(g.x) - w / 2, y = css(g.y + g.r + 10);
            if (y + h > css(G.H) - 120) y = css(g.y - g.r - 12) - h;
            x = Math.max(css(G.hull) + 20, Math.min(css(G.W) - w - 20, x));
            noteEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
            const ls = lapSec(S.t), showHint = !q.has('nohint') && S.t < LAP * 1000 && ls > 9 && ls < 19;
            hintEl.classList.toggle('on', showHint);
            if (showHint) hintEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y + h + 6)}px)`;
        } else hintEl.classList.remove('on');
        // stopped at a world: its name and what it is; one way on
        const a = S.arr, inOrbit = a && a.t1 == null && (S.t - a.t0) > 4300;
        headEl.classList.toggle('on', !!inOrbit); backEl.classList.toggle('on', !!inOrbit);
        if (inOrbit) {
            const pl = place(a.id);
            setText(headEl, '.name', pl.name); setText(headEl, '.line', pl.orbit.line);
            headEl.style.left = css(G.hull + 30) + 'px'; headEl.style.top = css(28) + 'px';
            backEl.style.left = (css(G.W) - 40 - backEl.offsetWidth) + 'px'; backEl.style.top = (css(G.H) - 48 - backEl.offsetHeight) + 'px';
        }
        placeSpeech(cam);
    }
    /** The world in reach: near enough to see clearly, not yet behind our hull, and not one we stopped at. */
    function stoppable(s0) {
        let best = null;
        TR.PLACES.forEach(pl => {
            const g = TR.geom(pl, s0);
            if (g.orbit != null || g.r < 9 || g.x - g.r * 0.2 < G.hull || g.x > G.W + g.r) return;
            if (!best || g.r > best.g.r) best = { pl, g };
        });
        return best;
    }

    // speech: one line at a time, over the speaker's head: a line you clicked for, or someone reacting to what passes
    function speechNow() {
        if (S.said && S.t < S.said.until) return S.said;
        const s = lapSec(S.t), r = SIM.REACT.find(([, , a0, a1]) => s >= a0 && s < a1);
        if (!r) return null;
        const l = SIM.line('travel', r[0], r[1]);
        return { id: r[0], who: l.who, text: l.text };
    }
    const COLOR = { cora: '#9fd8e6', jaxon: '#f0a860', aris: '#e58ac8', vance: '#d8dde0', mira: '#e2c46a' };
    function placeSpeech(cam) {
        const sp = speechNow(), d = sp && TW.drawn.find(p => p.id === sp.id);
        if (!d) { sayEl.classList.remove('on'); sayEl.dataset.id = ''; return; }
        const key = sp.id + '|' + sp.text;
        if (sayEl.dataset.id !== key) {
            setText(sayEl, 'b', sp.who); setText(sayEl, 'span', sp.text);
            sayEl.style.setProperty('--who', COLOR[sp.id]);
            sayEl.classList.remove('on'); void sayEl.offsetWidth; sayEl.dataset.id = key;
        }
        sayEl.classList.add('on');
        // the bubble opens away from the hull, so the windows by the hull (where passing worlds show) stay clear
        const top = d.act === 'sleep' ? d.y - 26 : d.act === 'sit' ? d.y - 84 : d.y - 104;
        const bx = css(d.x + G.offX), by = css(top - cam) - 8, w = sayEl.offsetWidth || 300, edge = css(G.hull) - 8;
        const toLeft = bx + 34 - w >= 12 && bx > css(G.hull) * 0.3;
        sayEl.classList.toggle('left', toLeft);
        sayEl.style.left = (toLeft ? Math.min(edge - 34, bx) : Math.max(w / 2 + 12, Math.min(edge - w / 2, bx))) + 'px';
        sayEl.style.top = Math.max(sayEl.offsetHeight + 8, by) + 'px';
    }

    // ── the light falls on our hull too: plate by plate down its outside edge, strongest level with the light ──
    function hullLight(cam) {
        const f = P.framer(ctx, G.W, G.H), ly = G.light[1];
        for (let y = 0; y < G.H; y++) {
            const wy = y + cam;
            let hw;
            if (wy < L.TIP + 2) continue;
            if (wy < L.TOP0) hw = A.noseHalf(wy); else if (wy < L.TAIL0 + 70) hw = L.HO; else continue;
            const plate = Math.floor(wy / 30), seam = ((wy % 30) + 30) % 30;
            if (seam === 0) continue;
            const v = (0.12 + 0.36 * Math.exp(-Math.abs(y - ly) / (G.H * 0.5))) * (0.45 + 0.75 * P.hash(plate & 255, 3, 11)) * (seam < 3 ? 1.25 : 1);
            const xo = Math.round(L.CX + hw) + 8 + G.offX;
            f.tone(xo, y, RP.SUN, v); f.tone(xo - 1, y, RP.SUN, v * 0.55); if (seam < 3) f.tone(xo - 2, y, RP.SUN, v * 0.4);
        }
    }
    /** Things bolted to the outside of the hull break its edge: a thruster block at every floor (it puffs now and then
        as the ship holds its heading), the nav lights the decks already carry, an aerial on the bridge. */
    function hullDetails(cam, t) {
        const f = P.framer(ctx, G.W, G.H), xo = G.offX + L.CX + L.HO + 9;
        for (let i = 0; i < L.N; i++) {
            const yb = A.deckTop(i) + F + 6 - cam;
            if (yb < -30 || yb > G.H + 30) continue;
            for (let y = -6; y <= 6; y++) for (let x = 0; x < 7; x++) {
                const v = y === -6 ? 0.66 : x === 6 ? 0.52 : y === 6 ? 0.14 : 0.28 + 0.1 * (x / 6) + (y === 0 ? -0.08 : 0);
                f.tone(xo + x, yb + y, RP.HULL, v);
            }
            [[-4, -1], [4, 1]].forEach(([dy, s]) => { f.px(xo + 7, yb + dy - 1, RP.HULL.hex[2], 2, 3); f.px(xo + 9, yb + dy, RP.HULL.hex[1]); });
            const ph = (t + i * 3700) % 11000;
            if (ph < 500) for (let k = 0; k < 14; k++) {                                      // a puff of cold gas, out and gone
                const a = (1 - k / 14) * (1 - ph / 500), spread = 1 + k * 0.35;
                for (let s = -Math.ceil(spread); s <= Math.ceil(spread); s++) f.tone(xo + 10 + k + ph / 120, yb - 4 + s, RP.PLUME, a * 0.75 * (1 - Math.abs(s) / (spread + 1)));
            }
        }
        const ay = A.deckTop(0) + 40 - cam;                                                     // the bridge aerial: a boom and a small dish, lit from the light's side
        if (ay > -40 && ay < G.H + 40) {
            for (let x = 0; x < 24; x++) { f.tone(xo + x, ay, RP.HULL, x < 3 ? 0.5 : 0.64); f.tone(xo + x, ay + 1, RP.HULL, 0.24); }
            for (let y = -7; y <= 7; y++) { const w = Math.round(3 * Math.sqrt(1 - (y / 8) ** 2)); for (let x = 0; x < w; x++) f.tone(xo + 24 + x, ay + y, RP.HULL, x === w - 1 ? 0.7 - Math.abs(y) * 0.02 : 0.3); }
            if ((t % 3000) < 160) { f.px(xo + 28, ay - 1, '#f6f1e4', 2, 2); f.glow(xo + 29, ay, 4, RP.STAR, 0.7); } else f.px(xo + 28, ay, RP.HULL.hex[3], 1, 1);
        }
    }


    // ── EXPLAIN: our Lander drawn small, from outside, flying on the space side (game-screen-v3's paintLander recipe) ──
    const shipMode = q.get('ship');
    const landerCache = new Map();
    function landerSprite(len, angle) {
        const key = len + ':' + angle.toFixed(3);
        if (landerCache.has(key)) return landerCache.get(key);
        const ht = Math.round(len / 3.15 * 10) / 10, half = Math.ceil(len / 2 + ht + 8), p = P.painter(half * 2, half * 2, false);
        const [lx, ly] = G.light, sa = Math.atan2(ly - G.H * 0.6, lx - G.W * 0.5);
        const o = { x: half, y: half, len, ht, angle, flip: true, seed: 9, anchor: 0.5, sun: len < 80 ? 0.24 : 0.32, sunDir: [Math.cos(sa), Math.sin(sa)], fade: 0.22, mirror: false, flat: len < 130 };
        const at = P.hull(p, o, P.shapeL);
        if (len >= 150 && len < 400) P.hullName(p, at, o, 'EXODUS-9', 0.52, 0.16);
        const rel = v => [v[0] - half, v[1] - half];
        const out = { canvas: p.canvas(), half, len, ht,
            ports: [0, 1, 2, 3, 4, 5].map(i => rel(at(P.DECK_U(i) + 0.054, -0.32))), bridge: rel(at(P.LANDER.NOSE - 0.02, -0.12)),
            bell: rel(at(1.0, 0)), windows: [-0.3, -0.05, 0.2].map(v => rel(at(P.LANDER.NOSE - 0.014, v))), winSize: Math.max(1.3, ht * 0.04) };
        landerCache.set(key, out);
        return out;
    }
    function shipPose() {
        const W0 = G.hull, Wt = G.W - G.hull;
        if (shipMode === 'cruise') { const x = W0 + 0.2 * Wt, y = G.H * 0.68; return { x, y, len: 46, angle: Math.atan2(G.light[1] - y, G.light[0] - x) }; }
        if (shipMode === 'dock') { const O = TR.orbitPose(), x = O.x - O.r * 1.02, y = O.y + O.r * 0.78; return { x, y, len: 84, angle: Math.atan2(O.y - y, O.x - x) - 0.5 }; }
        if (shipMode === 'close') { const x = G.W * 0.40, y = G.H * 0.64; return { x, y, len: Number(q.get('len')) || 520, angle: -0.42 }; }
        return null;
    }
    function drawLander(t) {
        const pose = shipPose(); if (!pose) return;
        const sp = landerSprite(pose.len, pose.angle), f = P.framer(ctx, G.W, G.H), ca = Math.cos(pose.angle), sa = Math.sin(pose.angle), scale = pose.len / 46;
        const cx = Math.round(pose.x), cy = Math.round(pose.y), bx = cx + sp.bell[0], by = cy + sp.bell[1];
        const len = (14 + 12) * scale, w0 = Math.max(1, 1.8 * scale);                       // the drive's plume, the same blue inside and out
        for (let d = 0; d < len; d++) { const hw = w0 * (1 - (d / len) * 0.6); for (let s = -Math.ceil(hw); s <= Math.ceil(hw); s++) { const u = Math.abs(s) / (hw + 0.01), v = (1 - d / len) ** 0.8 * (1 - u * u); if (v > 0.06) f.tone(bx - ca * d - sa * s, by - sa * d + ca * s, RP.PLUME, v); } }
        ctx.drawImage(sp.canvas, cx - sp.half, cy - sp.half);
        const w = scale < 1.6 ? 1 : Math.max(2, Math.round(scale * 0.3));
        sp.ports.forEach(([px, py], i) => { if (i !== 3) f.px(cx + px - (w >> 1), cy + py - (w >> 1), i === 0 ? RP.AMBER.hex[4] : RP.AMBER.hex[3], w, w); });
        f.px(cx + sp.bridge[0], cy + sp.bridge[1], RP.AMBER.hex[4], w, w);
        if (pose.len >= 60) { const ws = Math.max(1, Math.round(sp.winSize * (pose.len > 200 ? 0.7 : 1.6))); sp.windows.forEach(([px, py]) => f.px(cx + px - (ws >> 1), cy + py - (ws >> 1), RP.AMBER.hex[4], ws, ws)); }
    }
    const towerOn = q.get('tower') !== '0';
    if (q.get('words') === '0') { const st = document.createElement('style'); st.textContent = '.w, #back, .say { display: none !important; }'; document.head.appendChild(st); }

    // ── one frame ──
    function render() {
        if (!TR) return;
        const t0 = performance.now(), s0 = st(), cam = camY();
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = INK; ctx.fillRect(0, 0, G.W, G.H);
        const bgOn = q.get('bg') !== '0';                                          // EXPLAIN: ?bg=0 the ship alone, on ink
        if (bgOn) { TR.drawBack(ctx, s0); TR.drawWorlds(ctx, s0); TR.drawFront(ctx, s0); }
        drawLander(S.t);
        const people = SIM.at('travel', S.t);
        if (towerOn) {
            TW.draw(ctx, { t: S.t, camY: cam, offX: G.offX, W: G.W, H: G.H, people, auraTalking: !!voiceNow() });
            hullLight(cam);
            hullDetails(cam, S.t);
        }
        if (bgOn) TR.drawNear(ctx, s0);
        if (towerOn) ctx.drawImage(vignette, 0, 0);
        vctx.imageSmoothingEnabled = false;
        vctx.drawImage(art, 0, 0, G.W, G.H, 0, 0, G.W * G.k, G.H * G.k);
        updateWords(cam);
        S.frames.push(performance.now() - t0); if (S.frames.length > 240) S.frames.shift();
    }

    // ── stopping at a world, and leaving it ──
    function arrive(id) {
        const pl = place(id), s0 = st(), g = TR.geom(pl, s0);
        if (!pl || !pl.orbit) return false;
        S.seg = { t: S.t, D: travelD(S.t), mode: 'brake' };
        S.arr = { id, lap: g.lap, t0: S.t, g0: { x: g.x, y: g.y, r: Math.max(8, Math.round(g.r)) }, t1: null };
        for (let k = 0; k <= 10; k++) { const r = TR.radiusStep(S.arr, k / 10); S.bake.push(() => TR.sprite(pl, r, false)); }
        S.hover = null;
        return true;
    }
    function leave() {
        if (!S.arr || S.arr.t1 != null) return;
        S.seg = { t: S.t, D: travelD(S.t), mode: 'resume' };
        S.arr.t1 = S.t;
    }
    backEl.addEventListener('click', e => { e.stopPropagation(); leave(); });

    // ── input: a person on the left, a world on the right ──
    const toArt = e => [Math.floor(e.clientX * G.dpr / G.k), Math.floor(e.clientY * G.dpr / G.k)];
    function worldAt(ax, ay) {
        if (ax < G.hull || (S.arr && S.arr.t1 == null)) return null;
        const tg = stoppable(st());
        return tg && Math.hypot(ax - tg.g.x, ay - tg.g.y) < tg.g.r + 6 ? tg.pl.id : null;
    }
    function speak(id) {
        const l = SIM.line('travel', id, (TW.drawn.find(p => p.id === id) || {}).say);
        if (!l.text) return;
        S.said = { id, who: l.who, text: l.text, until: S.t + 3200 + l.text.length * 45 };
        render();
    }
    view.addEventListener('click', e => {
        const [ax, ay] = toArt(e);
        if (ax < G.hull) { const who = TW.hitPerson(ax, ay); if (who) speak(who); return; }
        const w = worldAt(ax, ay); if (w) arrive(w);
    });
    view.addEventListener('mousemove', e => {
        const [ax, ay] = toArt(e), who = ax < G.hull ? TW.hitPerson(ax, ay) : null, w = who ? null : worldAt(ax, ay);
        S.hover = w; view.classList.toggle('pointing', !!(who || w));
    });
    view.addEventListener('wheel', e => {
        const [ax] = toArt(e); if (ax >= G.hull) return;
        e.preventDefault();
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, from = S.manual ? S.manual.y : camY();
        S.manual = { y: Math.round(clampCam(from + dy * 0.6)), until: performance.now() + 12000 };
    }, { passive: false });

    // ── the loop, and the hooks for still frames ──
    function tick(now) {
        const dt = S.last == null ? 16 : Math.min(100, now - S.last); S.last = now;
        if (S.playing) S.t += dt;
        const job = S.bake.shift(); if (job) job();
        render();
        requestAnimationFrame(tick);
    }
    function settle() { while (S.bake.length) S.bake.shift()(); }
    window.variantA = {
        pause() { S.playing = false; render(); }, play() { S.playing = true; },
        step(ms = 125) { S.playing = false; S.t += ms; settle(); render(); },
        setTime(ms) { S.t = Math.max(0, ms); if (!S.arr) S.seg = { t: 0, D: 0, mode: 'cruise' }; settle(); render(); },
        arrive(id) { const ok = arrive(id); settle(); render(); return ok; }, leave() { leave(); render(); },
        say: id => speak(id),
        state() { const s0 = st(); return { t: Math.round(S.t), lap: +lapSec(S.t).toFixed(1), D: Math.round(s0.D), speed: +s0.speed.toFixed(1), cam: camY(), arr: S.arr && S.arr.id, k: G.k, art: [G.W, G.H], hull: G.hull,
            places: TR.PLACES.map(pl => { const g = TR.geom(pl, s0); return { id: pl.id, x: Math.round(g.x), y: Math.round(g.y), r: Math.round(g.r), d: +g.d.toFixed(1) }; }),
            people: SIM.at('travel', S.t).map(p => ({ id: p.id, deck: p.deck, x: p.x, act: p.act })) }; },
        stats() { const f = S.frames.slice(-120), avg = f.reduce((a, b) => a + b, 0) / (f.length || 1); return { avgMs: +avg.toFixed(2), maxMs: +Math.max(0, ...f).toFixed(2), frames: f.length }; },
    };

    let resizeTimer = 0;
    addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { measure(); render(); }, 200); });
    measure();
    if (q.has('arrive')) {                                                       // a still of a stop: fly to `at`, stop, then on to `t`
        S.t = Number(q.get('at')) || 41000; arrive(q.get('arrive'));
        if (q.has('leave')) { S.t = Number(q.get('leave')); leave(); }
        settle();
    }
    if (q.has('t')) { S.t = Math.max(0, Number(q.get('t')) || 0); S.playing = false; }
    render();
    requestAnimationFrame(tick);
    const jobs = TW.warm();
    (function next() { const job = jobs.shift(); if (!job) return; job(); setTimeout(next, 16); })();
})();
