/* ═══ Silent Exodus · layout variant C ("Deck strip") · the page ══════════════════════════════════════════════════════
   One canvas, one density: one art pixel is one crew-sprite pixel (the living ship's own scale), at k device pixels each.
   The journey fills the top (flight.js); along the bottom runs one deck of the Lander, cut open (../crew-hires: ship-art.js,
   ship-rooms.js, the crew). The deck is the ship's own side, not a box: space shows round its hull and through its
   portholes and bridge windows, and the deck above dissolves into space through the dither grain.
   Which deck: the one where something is happening (the galley at mealtime, the bridge when a world is close).
   The camera rides the tower between decks; people climb in and out of the strip by the ladder.
   Everything on screen is a function of the clock t (and the arrival time, once you stop), so ?t=ms shows the same still.
   DEBUG: window.variantC = { pause, play, step(ms), setTime(ms), arrive(ms?), say(id), stats(), people() }
          URL ?t=ms opens paused at t · ?arrive=ms stops at that world at that time · ?px=N forces N device px per art px
*/
(function () {
    'use strict';
    const CE = window.CrewEngine, A = window.ShipArt, VS = window.VoyageSim, P = window.V3Paint, LN = window.VoyageLines;
    const L = A.L, R = A.R, lv = A.api.level, INK = A.INK;
    const ORDER = ['cora', 'jaxon', 'aris', 'vance', 'mira'], SEED = id => ORDER.indexOf(id) + 1;
    const TICK = 125;
    const STRIP = 204;                           // art rows of the deck strip: a whole deck, ceiling to floor slab
    const FADE = 30;                             // rows over which the deck above dissolves into space
    const PASS_AT = 66;                          // s: the world is at its closest
    const ORBIT_MS = 3200, BRAKE_MS = 2500;
    const DECK_NAMES = ['bridge', 'lab', 'galley', 'med bay', 'hold', 'engineering'];
    const q = new URLSearchParams(location.search);

    // ── the screen ──────────────────────────────────────────────────────────────────────────────────────────────
    const view = document.getElementById('view'), vctx = view.getContext('2d');
    const art = document.createElement('canvas'), ctx = art.getContext('2d');
    const ship = document.createElement('canvas'), sctx = ship.getContext('2d');
    const G = { k: 2, dpr: 1, W: 0, H: 0, stripTop: 0, offX: 0, mask: null, flight: null, orbitTo: null };
    const S = { t: 0, playing: true, last: null, ta: null, said: null, hover: null, drawn: [], frames: [], g: null, orbitL: null, g0: null };

    function resize() {
        G.dpr = window.devicePixelRatio || 1;
        const devW = Math.round(innerWidth * G.dpr), devH = Math.round(innerHeight * G.dpr);
        G.k = Number(q.get('px')) > 0 ? Math.round(Number(q.get('px'))) : Math.max(2, Math.floor(devH / 520));
        G.W = Math.ceil(devW / G.k); G.H = Math.ceil(devH / G.k);
        [art, ship].forEach(c => { c.width = G.W; c.height = G.H; });
        view.width = G.W * G.k; view.height = G.H * G.k;
        view.style.width = (G.W * G.k / G.dpr) + 'px'; view.style.height = (G.H * G.k / G.dpr) + 'px';
        G.stripTop = G.H - STRIP;
        G.offX = Math.round(G.W * 0.44 - L.CX);
        const light = [Math.round(G.W - 112), Math.round(G.stripTop * 0.32)];
        G.flight = window.V3Flight.create(G.W, G.H, { light, pass: [Math.round(G.W * 0.36), Math.round(G.stripTop * 0.5)], passAt: PASS_AT, floor: G.stripTop });
        G.orbitTo = [Math.round(G.W * 0.5), G.stripTop - 58];
        G.mask = makeMask();
        G.skin = makeSkin();
        document.documentElement.style.setProperty('--t', Math.max(0, Math.min(1.5, (innerWidth - 1280) / 640)).toFixed(3));
        S.orbitL = null;
        render();
    }
    /** Where the near side of the hull is cut away, per column of the screen: stepped along the plate seams (a plate
        lifted out whole), roughened a pixel or two. Above it the hull is still on; below it the deck is open to us. */
    const PLATE_W = 38;
    function cutY(x) {
        const lx = x - G.offX, plate = Math.floor((lx + 1000) / PLATE_W);
        const step = Math.round(A.api.hash(plate & 255, 7, 23) * 9), rough = Math.round((A.api.vnoise(lx / 3, 0.5, 29) - 0.5) * 3);
        return G.stripTop + 3 + step + rough;
    }
    /** The interior is erased above the cut (the hull's outer skin covers it, then dissolves into space). */
    function makeMask() {
        const c = document.createElement('canvas'); c.width = G.W; c.height = G.H;
        const g = c.getContext('2d'), img = g.createImageData(G.W, G.H), d = img.data;
        for (let x = 0; x < G.W; x++) { const cy = cutY(x); for (let y = 0; y < cy; y++) d[(y * G.W + x) * 4 + 3] = 255; }
        g.putImageData(img, 0, 0);
        return c;
    }
    /** The near side of the hull above the cut: a cylinder of plates seen from outside, lit from the light on the right,
        a few lit windows of the deck above, the cut edge showing the hull's thickness. It dissolves upward into space
        through the Bayer grain (the ship is far bigger than the frame). */
    const SKIN_UP = 48;
    function makeSkin() {
        const H0 = SKIN_UP + 22, top = G.stripTop - SKIN_UP, p = A.api.painter(G.W, H0, top), RO = L.HO + 9;
        for (let x = 0; x < G.W; x++) {
            const lx = x - G.offX, nx = (lx + 0.5 - L.CX) / RO;
            if (Math.abs(nx) >= 1) continue;
            const nz = Math.sqrt(1 - nx * nx), lam = Math.max(0, nx * 0.7 + nz * 0.35), ang = Math.asin(nx);
            const cy = cutY(x) - top, seamA = ((ang / 0.105) % 1 + 1) % 1;              // panel seams, closer together where the hull turns away
            // how far up this column of plates still shows before the dark takes it: the side toward the light reaches higher,
            // each plate to its own height, so the top is a staggered line of plates, never a straight edge
            const plate = Math.floor((lx + 1000) / PLATE_W), reachUp = 9 + 30 * A.api.smooth(-0.8, 0.9, nx) + (A.api.fbm(lx / 31, 4.1, 61) - 0.5) * 12;
            for (let y = 0; y < Math.min(H0, cy); y++) {
                const wy = y + top, d = cy - y, up = d / reachUp;                     // 0 at the cut, 1 where it is lost
                if (up > 1.25) continue;
                let v = 0.08 + 0.3 * lam + (A.api.fbm(lx / 11, wy / 7, 77) - 0.5) * 0.06;
                const ring = ((wy - G.stripTop + 400) % 30 + 30) % 30;
                if (ring === 0) v -= 0.07; else if (ring === 1) v += 0.05;
                if (seamA < 0.04 * (1 + Math.abs(nx))) v -= 0.06; else if (seamA < 0.08 * (1 + Math.abs(nx))) v += 0.03;
                if ((ring === 4 || ring === 26) && seamA > 0.1 && seamA < 0.16) v += 0.08;
                if (nx > 0.955) v = 0.62 - (nx > 0.985 ? 0.2 : 0);                          // the limb toward the light catches it
                else if (nx < -0.97) v = 0.14;
                v *= 1 - 0.45 * A.api.smooth(0.15, 1, up);                                // the higher, the further from the lit deck: darker
                if (nx > 0.955) v = Math.max(v, 0.3 * (1 - up * 0.6));
                if (d <= 1) v = 0.66 + (d === 0 ? 0.08 : 0) - (nx < 0 ? 0.16 : 0);       // the cut edge: bright bare metal
                else if (d <= 4) v = 0.04 + (d === 3 ? 0.06 : 0);                         // the insulation, in section
                const keep = 1 - A.api.smooth(0.62, 1.1, up);
                if (A.api.bay(x, wy) >= keep) continue;
                p.tone(x, y, R.HULL, Math.max(0.035, v));
            }
        }
        return { canvas: p.canvas(), y: top };
    }

    // ── the clock: flight distance, braking, the world settling into orbit ─────────────────────────────────────────
    const CRUISE = () => G.flight.CRUISE;
    const brake = u => u - u * u * u + u * u * u * u / 2;              // ∫ (1 - smoothstep)
    function flightAt(t) {
        if (S.ta == null || t < S.ta) return { D: CRUISE() * t / 1000, speed: CRUISE() };
        const u = Math.min(1, (t - S.ta) / BRAKE_MS);
        return { D: CRUISE() * S.ta / 1000 + CRUISE() * BRAKE_MS / 1000 * brake(u), speed: CRUISE() * (1 - u * u * (3 - 2 * u)) };
    }
    function orbitAt(t) {
        if (S.ta == null || t < S.ta) return null;
        if (!S.orbitL) { S.g0 = G.flight.geom(flightAt(S.ta).D); S.orbitL = G.flight.orbitFrame(G.orbitTo, 150).L; }
        const step = Math.floor((t - S.ta) / TICK) * TICK, s = Math.min(1, step / ORBIT_MS), e = s < 0.5 ? 2 * s * s : 1 - 2 * (1 - s) * (1 - s);
        const r = Math.round(P.lerp(S.g0.r, 150, e) / 3) * 3;
        return { x: P.lerp(S.g0.x, G.orbitTo[0], e), y: P.lerp(S.g0.y, G.orbitTo[1], e), r, d: 0, s: 0, L: S.orbitL, settled: s >= 1 };
    }

    // ── the crew: a timed voyage, and a new plan from wherever they are when we stop ───────────────────────────────
    const BASE = VS.plan({
        mira: { stops: [['seatR1', 'sit', 38, { say: 'meal' }], ['mWin', 'idle', 71, { say: 'window' }], ['mWin2', 'idle', 82, { say: 'window2' }], ['seatR1', 'sit', 134, { say: 'after' }], ['bench', 'console', 99999, { say: 'work' }]] },
        vance: { stops: [['mealStand', 'idle', 40, { say: 'meal' }], ['vWin', 'idle', 68.5, { say: 'window' }], ['vWin2', 'idle', 80, { say: 'window2' }], ['mealStand', 'idle', 138, { say: 'after' }], ['holdMid', 'idle', 99999, { say: 'work' }]] },
        aris: { stops: [['counter', 'console', 54, { say: 'cook', screen: false }], ['seatL2', 'sit', 120, { say: 'meal' }], ['counter', 'console', 158, { say: 'clean', screen: false }], ['medTerminal', 'console', 99999, { say: 'work' }]] },
        jaxon: { stops: [['seatL1', 'sit', 140, { say: 'meal' }], ['engDesk', 'console', 99999, { say: 'work' }]] },
        cora: { stops: [['helm', 'console', 99999, { say: 'any' }]] },
    });
    let ORBIT_PLAN = null;
    function replan(ta) {
        const dest = { mira: ['window', 'idle'], vance: ['vWin', 'idle'], jaxon: ['jNav', 'idle'], aris: ['arisBed', 'idle'], cora: ['helm', 'console'] };
        const routines = {};
        ['mira', 'vance', 'jaxon', 'aris', 'cora'].forEach(id => {
            const pc = VS.pieceAt(BASE, id, ta), pose = VS.poseOf(id, pc, ta), r = { stops: [[dest[id][0], dest[id][1], 99999, { say: 'any' }]] };
            if (pc.kind === 'climb') { r.before = [pc]; r.t0 = pc.t1; r.from = { deck: VS.deckAtY(pc.y1 - 50), x: L.LX, facing: 1 }; }
            else { r.t0 = ta + 600 * (ORDER.indexOf(id) % 3); r.from = { deck: pose.deck, x: pose.x, facing: pose.facing }; if (pc.kind === 'stay' || pc.kind === 'walk') r.before = [{ kind: 'stay', deck: pose.deck, x: pose.x, facing: pose.facing, act: pose.act === 'walk' ? 'idle' : pose.act, t0: ta, t1: r.t0, say: pose.say, screen: pose.screen }]; }
            routines[id] = r;
        });
        return VS.plan(routines, ta);
    }
    const planAt = t => (S.ta != null && t >= S.ta && ORBIT_PLAN ? ORBIT_PLAN : BASE);
    const peopleAt = t => VS.at(planAt(t), t);

    // ── which deck the strip shows: where something is happening ───────────────────────────────────────────────────
    function segments() {
        const base = [{ t0: 0, deck: 2 }, { t0: 52000, deck: 0 }, { t0: 92000, deck: 2 }];
        if (S.ta == null) return base;
        return base.filter(s => s.t0 < S.ta).concat([{ t0: S.ta + 400, deck: 0 }]);
    }
    function camAt(t) {
        const seg = segments();
        let i = 0; for (let j = 0; j < seg.length; j++) if (seg[j].t0 <= t) i = j;
        const cur = seg[i], prev = seg[Math.max(0, i - 1)], k = i === 0 ? 1 : A.api.smooth(0, 2200, t - cur.t0);
        return { y: P.lerp(A.deckTop(prev.deck), A.deckTop(cur.deck), k) - G.stripTop, deck: k > 0.5 ? cur.deck : prev.deck };
    }

    // ── light on people (ship-life.html): warmth by distance to the nearest lamp on their deck ─────────────────────
    function lightFor(p) {
        const lamps = A.deck(p.deck, {}).lamps;
        if (!lamps.length) return { warm: 0, rim: 0 };
        const near = lamps.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a)), d = near.x - p.x;
        return { warm: Math.round(3 * Math.exp(-Math.abs(d) / 55)), rim: Math.abs(d) > 6 && Math.abs(d) < 120 ? Math.sign(d) : 0 };
    }
    const blinking = (ms, seed) => ((ms + seed * 1700) % 4300) < 140;
    function spriteOf(p, ll) {
        const ms = p.act === 'idle' || p.act === 'sit' || p.act === 'console' || p.act === 'wall' || p.act === 'tend' || p.act === 'sleep' ? p.ms + SEED(p.id) * 977 : p.ms;
        return CE.sprite(p.id, p.act, CE.frameAt(p.act, ms), { blink: p.act !== 'sleep' && blinking(ms, SEED(p.id)), warm: ll.warm, rim: ll.rim * p.facing, screen: p.screen === undefined ? p.act === 'console' : p.screen });
    }
    let camY = 0;
    function blit(cv, Sp, x, y, facing) {
        const X = Math.round(x) + G.offX, Y = Math.round(y) - Math.round(camY) - Sp.origin.y;
        if (facing > 0) sctx.drawImage(cv, X - Sp.origin.x, Y);
        else { sctx.save(); sctx.translate(X + 1, 0); sctx.scale(-1, 1); sctx.drawImage(cv, -Sp.origin.x, Y); sctx.restore(); }
    }
    function drawPerson(p) {
        const Sp = spriteOf(p, lightFor(p));
        blit(Sp.canvas, Sp, p.x, p.y, p.facing);
        S.drawn.push({ id: p.id, Sp, x: p.x, y: p.y, facing: p.facing, act: p.act, say: p.say, deck: p.deck });
    }

    // ── the deck's small moving things (ship-life.html's fx, unchanged but for the target canvas) ───────────────────
    let curFill = '';
    const px = (x, y, hex, w = 1, h = 1) => { if (hex !== curFill) { sctx.fillStyle = hex; curFill = hex; } sctx.fillRect(x, y, w, h); };
    const tone = (x, y, r, v) => { const k = lv(r, v, x, y); if (k > 0) px(x, y, r.hex[k]); };
    const h01 = (a, b, s = 0) => A.api.hash(a & 255, b & 255, s);
    function screenFx(f, X, Y, tick, t) {
        const w = f.w, h = f.h;
        if (f.tone === 'text' || f.tone === 'helm') {
            for (let r = 1; r < h; r += 2) { const n = Math.floor(h01(r, tick >> 2, 3) * (w - 1)); for (let c = 0; c < n; c++) if (h01(c, r + tick, 5) > 0.3) px(X + c, Y + r, R.SCR.hex[(c + r) % 4 ? 2 : 3]); }
            if ((tick >> 2) & 1) px(X + 1, Y + h - 2, R.SCR.hex[5]);
            if (f.tone === 'helm') { const m = Math.round((Math.sin(t / 1300) * 0.5 + 0.5) * (w - 2)); px(X + m, Y + 1, R.AMBER.hex[3], 2, 1); }
        } else if (f.tone === 'chart') {
            for (let i = 0; i < 18; i++) px(X + Math.floor(h01(i, 1, 9) * w), Y + Math.floor(h01(i, 2, 9) * h), R.SCR.hex[h01(i, 3, 9) > 0.7 ? 5 : 3]);
            const sx = tick % (w + 6); if (sx < w) for (let y = 0; y < h; y++) px(X + sx, Y + y, R.SCR.hex[2]);
            px(X + Math.round(w * 0.62), Y + Math.round(h * 0.4), R.AMBER.hex[(tick >> 1) & 1 ? 4 : 2]);
        } else if (f.tone === 'spectrum') {
            for (let c = 0; c < w; c++) { const peak = Math.exp(-((c - w * 0.65) ** 2) / 4), v = 0.15 + 0.25 * h01(c, tick >> 1, 4) + peak * 0.7; const bh = Math.round(v * (h - 2)); for (let y = 0; y < bh; y++) px(X + c, Y + h - 1 - y, R.SCR.hex[y > bh - 2 ? 5 : 3]); }
        } else if (f.tone === 'ecg' || f.tone === 'vitals') {
            const sweep = (tick * 2) % w, mid = Math.round(h * 0.55);
            for (let c = 0; c < w; c++) {
                const ph = ((c - sweep + w * 4) % 22), spike = f.tone === 'ecg' ? (ph === 3 ? -6 : ph === 4 ? 4 : ph === 2 ? -2 : 0) : Math.round(Math.sin((c + tick) / 3) * 2);
                const age = (sweep - c + w) % w, colr = age < 2 ? R.SCR.hex[5] : age < 10 ? R.SCR.hex[4] : R.SCR.hex[2];
                px(X + c, Y + Math.max(0, Math.min(h - 1, mid + spike)), colr);
            }
            if (f.tone === 'ecg') px(X + w - 3, Y + 1, R.TEAL.hex[(tick % 8) < 2 ? 5 : 3], 2, 2);
        } else if (f.tone === 'graph') {
            for (let c = 0; c < w; c++) { const y = Math.round(h / 2 + (A.api.vnoise((c + tick) / 4, 0, 13) - 0.5) * (h - 2)); px(X + c, Y + Math.max(0, Math.min(h - 1, y)), R.SCR.hex[c === w - 1 ? 5 : 3]); }
        }
    }
    function fx(f, t, tick, cs) {
        const X = f.x + G.offX, Y = f.y - Math.round(camY);
        switch (f.kind) {
            case 'screen': screenFx(f, X, Y, tick, t); break;
            case 'led': if (((t + f.x * 37) % f.period) < f.period * 0.55) px(X, Y, f.color); break;
            case 'aura': { const v = 0.55 + 0.4 * Math.sin(t / 1700); px(X, Y, R.SCR.hex[v > 0.75 ? 5 : v > 0.45 ? 4 : 3], 2, 1); break; }
            case 'glint': px(X + Math.round(f.r * 0.4), Y - Math.round(f.r * 0.55), '#9ec4c8'); px(X + Math.round(f.r * 0.55), Y - Math.round(f.r * 0.35), '#4f6e74'); break;
            case 'steam':
                if (f.when === 'meal' && !cs.meal) break;
                for (let i = 0; i < 5; i++) { const rise = (tick + i * 5) % 16, x = X + Math.round(Math.sin((tick + i * 7) / 3) * 1.5) + (i % 2), y = Y - rise; if (h01(i, tick, 7) > rise / 18) tone(x, y, R.LINEN, 0.45 - rise * 0.02); }
                break;
            case 'core': if (A.reactor) A.reactor.draw(sctx, f, X, Y, t); break;                   // ship-reactor.js: the core, its light by energy
            case 'hob': if (cs.meal) for (let x = 1; x < f.w - 1; x++) tone(X + x, Y, R.RED, 0.38 + 0.25 * Math.sin(t / 300 + x) * (h01(x, tick, 4) > 0.5 ? 1 : 0.4)); break;
            case 'nav': if (((t + f.phase) % 2600) < 180) { px(X - 1, Y, f.color, 3, 1); px(X, Y - 1, f.color, 1, 3); px(X, Y, '#f6f1e4'); } else px(X, Y, f.dim); break;
            case 'needle': { const a = -2.2 + f.k * 0.5 + Math.sin(t / 900 + f.k * 2) * 0.12; for (let r = 1; r <= 3; r++) px(X + Math.round(Math.cos(a) * r), Y + Math.round(Math.sin(a) * r), '#a8604a'); break; }
            default: break;
        }
    }

    // ── the ship layer: the tower at the camera, cut by the mask ───────────────────────────────────────────────────
    function drawShip(t, people) {
        const tick = Math.floor(t / TICK), cam = Math.round(camY), top = cam + G.stripTop - FADE - 14;
        curFill = '';
        sctx.clearRect(0, 0, G.W, G.H);
        sctx.imageSmoothingEnabled = false;
        const visible = (y0, h) => y0 + h > top && y0 < cam + G.H;
        const cs = { meal: people.some(p => p.act === 'sit' && p.deck === 2) };
        if (visible(0, L.TOP0)) { const N = A.nose(); sctx.drawImage(N.canvas, G.offX, -cam); }
        for (let i = 0; i < L.N; i++) {
            const y0 = A.deckTop(i); if (!visible(y0, L.PITCH)) continue;
            const D = A.deck(i, {});
            sctx.drawImage(D.canvas, G.offX, y0 - cam);
            D.fx.forEach(f => fx(f, t, tick, cs));
        }
        S.drawn = [];
        people.slice().sort((a, b) => a.z - b.z || a.x - b.x).forEach(p => { if (visible(p.y - 110, 120)) drawPerson(p); });
        sctx.globalCompositeOperation = 'destination-out'; sctx.drawImage(G.mask, 0, 0); sctx.globalCompositeOperation = 'source-over';
        sctx.drawImage(G.skin.canvas, 0, G.skin.y);
    }

    // ── words: one voice at a time, the world's note, the dither grain darkening the picture under them ─────────────
    const $ = id => document.getElementById(id);
    const voice = $('voice'), note = $('note'), place = $('place');
    function activeLine(t) {
        let best = null;
        const take = (list, base, ok) => list.forEach(l => { const at = base + l.t; if (ok && t >= at && t < at + readMs(l.text) && (!best || at > best.at)) best = Object.assign({ at }, l); });
        take(LN.auto.travel, 0, true);
        take(LN.auto.passed, 0, S.ta == null || S.ta > 77000);
        if (S.ta != null) { best = best && best.at < S.ta ? null : best; take(LN.auto.orbit, S.ta, true); }
        if (S.said && t >= S.said.at && t < S.said.at + readMs(S.said.text) && (!best || S.said.at >= best.at)) best = S.said;
        return best;
    }
    const readMs = s => Math.max(3400, s.split(/\s+/).length * 320 + 1800);
    const k2css = () => G.k / G.dpr;
    function headOf(d) { return d.act === 'sit' ? d.y - 84 : d.act === 'console' ? d.y - 100 : d.act === 'climb' ? d.y - 104 : d.y - 106; }
    const shades = [];
    function placeWords(t, g) {
        shades.length = 0;
        const s = k2css();
        // the voice
        const line = activeLine(t);
        if (!line) voice.classList.remove('is-in');
        else {
            if (voice.dataset.key !== line.at + line.id) {
                voice.dataset.key = line.at + line.id;
                voice.style.setProperty('--tone', LN.TONES[line.id]);
                voice.querySelector('.name').textContent = LN.NAMES[line.id];
                voice.querySelector('.say').textContent = line.text;
            }
            const d = S.drawn.find(p => p.id === line.id), from = voice.querySelector('.from');
            const w = voice.offsetWidth, h = voice.offsetHeight;
            let x, y;
            const shown = d && headOf(d) - camY > G.stripTop - 10;
            if (shown) {                                                              // over their head, on the deck
                x = (d.x + G.offX) * s - w / 2; y = (headOf(d) - camY - 8) * s - h;
                from.textContent = '';
            } else {                                                                  // someone elsewhere in the ship, or A.U.R.A.: high on the left
                x = 34 * s; y = G.stripTop * 0.2 * s;
                from.textContent = line.id === 'aura' ? '' : (d || peopleAt(t).find(p => p.id === line.id)) ? DECK_NAMES[(d || peopleAt(t).find(p => p.id === line.id)).deck] : '';
            }
            x = Math.max(16, Math.min(innerWidth - w - 16, x)); y = Math.max(16, y);
            voice.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
            voice.classList.add('is-in');
            shades.push([x, y, w, h]);
        }
        // the world: its name and line while we can still stop there; its orbit name once we have
        const reach = inReach(t, g);
        if (reach) {
            note.classList.add('is-in');
            note.classList.toggle('is-hot', S.hover === 'world');
            note.querySelector('.hint').hidden = t > PASS_AT * 1000 - 6000 && S.hover !== 'world';
            const right = g.x < G.W * 0.55, w = note.offsetWidth, h = note.offsetHeight;
            note.classList.toggle('is-right', right);
            const x = right ? (g.x + g.r + 14) * s : (g.x - g.r - 14) * s - w, y = (g.y - 8) * s - h / 2;
            note.style.transform = `translate(${Math.round(Math.max(16, x))}px, ${Math.round(Math.max(16, y))}px)`;
            shades.push([Math.max(16, x), Math.max(16, y), w, h]);
        } else note.classList.remove('is-in');
        const orb = S.ta != null && t > S.ta + ORBIT_MS + 400;
        if (orb) {
            const w = place.offsetWidth, h = place.offsetHeight, x = (g.x + g.r * 0.72 + 18) * s, y = (g.y - g.r * 0.72) * s - h / 2;
            place.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(16, y))}px)`;
            place.classList.add('is-in');
            shades.push([x, Math.max(16, y), w, h]);
        } else place.classList.remove('is-in');
    }
    const shadeCache = new Map();
    function shadeSprite(w, h) {
        const key = w + 'x' + h; if (shadeCache.has(key)) return shadeCache.get(key);
        const m = 10, c = document.createElement('canvas'); c.width = w + 2 * m; c.height = h + 2 * m;
        const g = c.getContext('2d'); g.fillStyle = INK;
        for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
            const dx = Math.max(m - x, 0, x - (w + m - 1)), dy = Math.max(m - y, 0, y - (h + m - 1)), d = Math.hypot(dx, dy) / m;
            const a = 0.62 * (1 - A.api.smooth(0, 1, d));
            if (A.api.bay(x, y) < a) g.fillRect(x, y, 1, 1);
        }
        shadeCache.set(key, c); return c;
    }
    function drawShades() {
        const s = k2css();
        shades.forEach(([x, y, w, h]) => { const W0 = Math.ceil(w / s), H0 = Math.ceil(h / s), X = Math.floor(x / s), Y = Math.floor(y / s); ctx.drawImage(shadeSprite(W0, H0), X - 10, Y - 10); });
    }

    // ── the world: when it can be clicked ─────────────────────────────────────────────────────────────────────────
    function inReach(t, g) { return S.ta == null && g && g.r >= 7 && !g.grey; }

    // ── one frame ───────────────────────────────────────────────────────────────────────────────────────────────
    function render() {
        if (!G.W) return;
        const t0 = performance.now(), t = S.t;
        const fl = flightAt(t), orbit = orbitAt(t);
        const cam = camAt(t); camY = cam.y;
        const people = peopleAt(t);
        S.g = G.flight.draw(ctx, t, { D: fl.D, speed: fl.speed, orbit, hot: S.hover === 'world' && S.ta == null, pattern });
        drawShip(t, people);
        ctx.drawImage(ship, 0, 0);
        placeWords(t, S.g);
        drawShades();
        vctx.imageSmoothingEnabled = false;
        vctx.drawImage(art, 0, 0, G.W, G.H, 0, 0, G.W * G.k, G.H * G.k);
        S.frames.push(performance.now() - t0); if (S.frames.length > 240) S.frames.shift();
    }
    const patterns = [];
    function pattern(levelN) {
        const Lv = Math.max(0, Math.min(64, Math.round(levelN)));
        if (!patterns[Lv]) { const c = document.createElement('canvas'); c.width = 8; c.height = 8; const g = c.getContext('2d'); g.fillStyle = INK; for (let i = 0; i < 64; i++) if (P.BAYER_RAW[i] < Lv) g.fillRect(i & 7, i >> 3, 1, 1); patterns[Lv] = ctx.createPattern(c, 'repeat'); }
        return patterns[Lv];
    }

    // ── input ───────────────────────────────────────────────────────────────────────────────────────────────────
    const alphas = new WeakMap();
    function hitPerson(ax, ay) {
        if (ay < G.stripTop - 12) return null;
        const wy = ay + Math.round(camY), wx = ax - G.offX;
        for (let i = S.drawn.length - 1; i >= 0; i--) {
            const d = S.drawn[i], Sp = d.Sp, top = Math.round(d.y) - Sp.origin.y;
            const cx = d.facing > 0 ? wx - (Math.round(d.x) - Sp.origin.x) : (Math.round(d.x) + Sp.origin.x) - wx, cy = wy - top;
            if (cx < -3 || cy < -3 || cx >= Sp.w + 3 || cy >= Sp.h + 3) continue;
            let al = alphas.get(Sp.canvas);
            if (!al) { al = Sp.canvas.getContext('2d').getImageData(0, 0, Sp.w, Sp.h).data; alphas.set(Sp.canvas, al); }
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < Sp.w && y < Sp.h && al[(y * Sp.w + x) * 4 + 3]) return d.id; }
        }
        return null;
    }
    function hitWorld(ax, ay) {
        const g = S.g;
        if (!inReach(S.t, g) || Math.hypot(ax - g.x, ay - g.y) > g.r + 6) return false;
        return sctx.getImageData(ax, ay, 1, 1).data[3] === 0;                     // only where the ship does not cover it
    }
    const toArt = e => [Math.floor(e.clientX * G.dpr / G.k), Math.floor(e.clientY * G.dpr / G.k)];
    view.addEventListener('click', e => {
        const [ax, ay] = toArt(e), who = hitPerson(ax, ay);
        if (who) { say(who); return; }
        if (hitWorld(ax, ay)) arrive(S.t);
    });
    view.addEventListener('mousemove', e => {
        const [ax, ay] = toArt(e), who = hitPerson(ax, ay), w = !who && hitWorld(ax, ay);
        S.hover = w ? 'world' : who ? 'person' : null;
        view.classList.toggle('is-pointing', !!S.hover);
        if (!S.playing) render();
    });
    function say(id) {
        const d = S.drawn.find(p => p.id === id); if (!d) return false;
        const set = S.ta != null && S.t >= S.ta ? LN.click.orbit : LN.click.travel, mine = set[id] || {};
        const near = S.ta == null && S.t > 34000 && S.t < PASS_AT * 1000 + 8000;
        const text = (id === 'cora' && near && mine.near) || mine[d.say] || mine.any || mine.work;
        if (!text) return false;
        S.said = { at: S.t, id: id === 'cora' ? 'aura' : id, text };
        if (!S.playing) render();
        return true;
    }
    function arrive(t) {
        if (S.ta != null) return;
        S.ta = t; S.orbitL = null; S.hover = null; view.classList.remove('is-pointing');
        ORBIT_PLAN = replan(t);
        render();
    }

    // ── the clock and the hooks ─────────────────────────────────────────────────────────────────────────────────
    function frame(now) {
        const dt = S.last == null ? 16 : Math.min(100, now - S.last); S.last = now;
        if (S.playing) S.t += dt;
        render();
        requestAnimationFrame(frame);
    }
    window.variantC = {
        pause() { S.playing = false; render(); }, play() { S.playing = true; },
        step(ms = 125) { S.playing = false; S.t += ms; render(); },
        setTime(ms) { S.t = Math.max(0, ms); render(); },
        arrive(ms) { if (ms != null) S.t = ms; arrive(S.t); },
        say: id => say(id),
        stats() { const f = S.frames.slice(-120), avg = f.reduce((a, b) => a + b, 0) / (f.length || 1); return { avgMs: +avg.toFixed(2), maxMs: +Math.max(0, ...f).toFixed(2), k: G.k, art: [G.W, G.H], t: Math.round(S.t), ta: S.ta, g: S.g && { x: Math.round(S.g.x), y: Math.round(S.g.y), r: Math.round(S.g.r) } }; },
        people: () => peopleAt(S.t).map(p => ({ id: p.id, deck: p.deck, x: p.x, act: p.act })),
    };
    addEventListener('resize', resize);
    resize();
    if (q.has('arrive')) { S.ta = Math.max(0, Number(q.get('arrive')) || 0); ORBIT_PLAN = replan(S.ta); }
    if (q.has('t')) { S.t = Math.max(0, Number(q.get('t')) || 0); S.playing = false; }
    if (q.has('say')) { const [id, at] = q.get('say').split('@'); S.said = null; window.__sayLater = { id, at: Number(at) || S.t }; }
    render();
    if (window.__sayLater) { say(window.__sayLater.id); if (S.said) S.said.at = window.__sayLater.at; render(); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render());
    requestAnimationFrame(frame);
})();
