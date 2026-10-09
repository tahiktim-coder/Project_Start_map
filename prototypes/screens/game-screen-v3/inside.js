/* Silent Exodus game screen v3: the ship view is the living ship (prototypes/screens/crew-hires/ship-life.html).
   The crew, the decks, the routines and the lines are the crew-hires files, loaded as they are (engine.js, the five person
   files, ship-art.js, ship-rooms.js, ship-sim.js). This file is ship-life.html's page code (drawSpace, render, fx, the deck
   camera, the click handling) moved into a module, with three changes from the study page:
     - the study control is gone;
     - a person's line is the game's voice line (Reading.say beside them), not ship-life's boxed bubble;
     - the room words and the supplies are written beside the decks they belong to (energy by engineering, rations and
       salvage by the hold), and the clock is the game's clock, so the portholes outside and the people inside agree.
     V3Inside.create(World) → { resize, update, render, show, isShown, open, focus, hover, click, wheel, stepDeck, anchor,
                                pose, prepare, words }
   One art pixel here is one sprite pixel (crew sprites are 48 x 104), at k device pixels each: the biggest whole k that
   still shows two decks (ship-life's rule). */
(function () {
    'use strict';
    const STATE = 'normal', SIM_START = 96000;                       // ship-life's own start for the normal day

    function create(World) {
        const CE = window.CrewEngine, A = window.ShipArt, SIM = window.ShipSim;
        if (!CE || !A || !SIM) { console.warn('The living ship did not load.'); return null; }
        const L = A.L, R = A.R, lv = A.api.level;
        const ORDER = ['cora', 'jaxon', 'aris', 'vance', 'mira'], SEED = id => ORDER.indexOf(id) + 1;
        const TICK = 125, PAIR_ROWS = 2 * L.PITCH + 16;
        const ROOM_NAMES = ['Bridge', 'Lab', 'Quarters', 'Med bay', 'Hold', 'Engineering'];

        const view = document.getElementById('inside'), vctx = view.getContext('2d');
        const art = document.createElement('canvas'), ctx = art.getContext('2d');
        const wordsLayer = document.getElementById('inside-words');
        const S = { t: 0, simT: SIM_START, camY: 0, camT: 0, k: 2, dpr: 1, W: 0, H: 0, offX: 0, drawn: [], shown: false, reveal: 1, roomEls: [] };

        function resize() {
            S.dpr = window.devicePixelRatio || 1;
            const devW = Math.round(innerWidth * S.dpr), devH = Math.round(innerHeight * S.dpr);
            S.k = Math.max(2, Math.floor(devH / PAIR_ROWS));
            S.W = Math.ceil(devW / S.k); S.H = Math.ceil(devH / S.k);
            art.width = S.W; art.height = S.H;
            view.width = S.W * S.k; view.height = S.H * S.k;
            view.style.width = (S.W * S.k / S.dpr) + 'px'; view.style.height = (S.H * S.k / S.dpr) + 'px';
            S.offX = Math.round(S.W / 2 - L.CX);
            S.camT = clampCam(S.camT); S.camY = S.camT;
        }
        const clampCam = y => (S.H >= L.H ? (L.H - S.H) / 2 : Math.max(0, Math.min(L.H - S.H, y)));
        const pairMode = () => S.H >= PAIR_ROWS;
        function camFor(d) {
            d = Math.max(0, Math.min(L.N - 1, d));
            if (pairMode()) { d = Math.min(d, L.N - 2); return clampCam(A.deckTop(d) + L.PITCH - S.H / 2 + 6); }
            return clampCam(A.deckTop(d) + L.PITCH / 2 - S.H / 2 + 8);
        }
        function focus(d, now) { S.camT = camFor(d); if (now) S.camY = S.camT; }
        const deckAt = wy => Math.floor((wy - L.TOP0) / L.PITCH);
        function clickDeck(wy) {
            const d = deckAt(wy);
            if (d < 0) return focus(0);
            if (d >= L.N) return focus(L.N - 2);
            if (!pairMode()) return focus(d);
            const top = A.deckTop(d), seen = top >= S.camT - 2 && top + L.PITCH <= S.camT + S.H + 2;
            if (seen) return;
            focus(wy < S.camT + S.H / 2 ? d : d - 1);
        }
        function stepDeck(dir) {
            const c = S.camT + S.H / 2;
            if (pairMode()) focus(Math.round((c - L.TOP0) / L.PITCH) - 1 + dir);
            else focus(deckAt(c) + dir);
        }

        // ── light on people (ship-life) ──
        const looks = () => SIM.stateOf(STATE).looks;
        const deckOf = i => A.deck(i, looks()[i] || {});
        function lightFor(p) {
            const lamps = deckOf(p.deck).lamps;
            if (!lamps.length) return { warm: 0, rim: 0, dim: true };
            const near = lamps.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a)), d = near.x - p.x;
            return { warm: Math.round(3 * Math.exp(-Math.abs(d) / 55)), rim: Math.abs(d) > 6 && Math.abs(d) < 120 ? Math.sign(d) : 0, dim: false };
        }
        const dimmed = new WeakMap();
        function dimOf(cv) {
            if (dimmed.has(cv)) return dimmed.get(cv);
            const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
            const x = c.getContext('2d'); x.drawImage(cv, 0, 0);
            const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
            for (let i = 0; i < d.length; i += 4) { d[i] = d[i] * 0.5 + 8; d[i + 1] *= 0.42; d[i + 2] *= 0.44; }
            x.putImageData(im, 0, 0); dimmed.set(cv, c); return c;
        }
        const blankets = new Map();
        function blanketOf(Sp, sheet) {
            const key = Sp.canvas, cache = blankets.get(key) || {};
            if (cache[sheet]) return cache[sheet];
            const d = Sp.canvas.getContext('2d').getImageData(0, 0, Sp.w, Sp.h).data, tops = new Int16Array(Sp.w).fill(-1);
            for (let x = 0; x < Sp.w; x++) for (let y = 0; y < Sp.h; y++) if (d[(y * Sp.w + x) * 4 + 3]) { tops[x] = y; break; }
            const c = document.createElement('canvas'); c.width = Sp.w; c.height = Sp.h;
            const x2 = c.getContext('2d'), Rm = sheet ? R.LINEN : R.WOOL, x0 = Sp.origin.x - 16;
            for (let col = x0; col < Sp.w; col++) {
                const top = tops[col], y0 = top < 0 ? Sp.origin.y - 3 : Math.max(0, top - 1);
                for (let y = y0; y < Sp.origin.y; y++) {
                    const v = (y === y0 ? 0.72 : 0.42 - (y - y0) * 0.03) + (col === x0 ? -0.15 : 0) + ((col + y) % 5 === 0 ? -0.06 : 0) - (sheet ? 0.1 : 0);
                    x2.fillStyle = Rm.hex[lv(Rm, v, col, y)]; x2.fillRect(col, y, 1, 1);
                }
            }
            cache[sheet] = c; blankets.set(key, cache); return c;
        }
        function blit(cv, Sp, x, y, facing) {
            const X = Math.round(x) + S.offX, Y = Math.round(y) - Math.round(S.camY) - Sp.origin.y;
            if (facing > 0) ctx.drawImage(cv, X - Sp.origin.x, Y);
            else { ctx.save(); ctx.translate(X + 1, 0); ctx.scale(-1, 1); ctx.drawImage(cv, -Sp.origin.x, Y); ctx.restore(); }
        }
        const blinking = (ms, seed) => ((ms + seed * 1700) % 4300) < 140;
        function spriteOf(p, ll) {
            const ms = p.act === 'idle' || p.act === 'sit' || p.act === 'console' || p.act === 'wall' || p.act === 'tend' || p.act === 'sleep' ? p.ms + SEED(p.id) * 977 : p.ms;
            return CE.sprite(p.id, p.act, CE.frameAt(p.act, ms), { blink: p.act !== 'sleep' && blinking(ms, SEED(p.id)), warm: ll.warm, rim: ll.rim * p.facing, screen: p.screen === undefined ? p.act === 'console' : p.screen });
        }
        function drawPerson(p) {
            const ll = lightFor(p), Sp = spriteOf(p, ll);
            blit(ll.dim ? dimOf(Sp.canvas) : Sp.canvas, Sp, p.x, p.y, p.facing);
            if (p.act === 'sleep') blit(blanketOf(Sp, !!p.awake), Sp, p.x, p.y, p.facing);
            S.drawn.push({ id: p.id, Sp, x: p.x, y: p.y, facing: p.facing, act: p.act, say: p.say });
        }

        // ── the moving layer (ship-life's fx, unchanged) ──
        let curFill = '';
        const px = (x, y, hex, w = 1, h = 1) => { if (hex !== curFill) { ctx.fillStyle = hex; curFill = hex; } ctx.fillRect(x, y, w, h); };
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
        function fx(f, t, tick, ctxS) {
            const X = f.x + S.offX, Y = f.y - Math.round(S.camY);
            switch (f.kind) {
                case 'screen': screenFx(f, X, Y, tick, t); break;
                case 'led': if (((t + f.x * 37) % f.period) < f.period * 0.55) px(X, Y, f.color); break;
                case 'aura': { const v = 0.55 + 0.4 * Math.sin(t / 1700); px(X, Y, R.SCR.hex[v > 0.75 ? 5 : v > 0.45 ? 4 : 3], 2, 1); break; }
                case 'glint': px(X + Math.round(f.r * 0.4), Y - Math.round(f.r * 0.55), '#9ec4c8'); px(X + Math.round(f.r * 0.55), Y - Math.round(f.r * 0.35), '#4f6e74'); break;
                case 'steam':
                    if (f.when === 'meal' && !ctxS.meal) break;
                    for (let i = 0; i < 5; i++) { const rise = (tick + i * 5) % 16, x = X + Math.round(Math.sin((tick + i * 7) / 3) * 1.5) + (i % 2), y = Y - rise; if (h01(i, tick, 7) > rise / 18) tone(x, y, R.LINEN, 0.45 - rise * 0.02); }
                    break;
                case 'core': if (A.reactor) A.reactor.draw(ctx, f, X, Y, t); break;                   // ship-reactor.js: the core, its light by energy
                case 'hob': if (ctxS.meal) for (let x = 1; x < f.w - 1; x++) tone(X + x, Y, R.RED, 0.38 + 0.25 * Math.sin(t / 300 + x) * (h01(x, tick, 4) > 0.5 ? 1 : 0.4)); break;
                case 'nav': if (((t + f.phase) % 2600) < 180) { px(X - 1, Y, f.color, 3, 1); px(X, Y - 1, f.color, 1, 3); px(X, Y, '#f6f1e4'); } else px(X, Y, f.dim); break;
                case 'needle': { const a = -2.2 + f.k * 0.5 + Math.sin(t / 900 + f.k * 2) * 0.12; for (let r = 1; r <= 3; r++) px(X + Math.round(Math.cos(a) * r), Y + Math.round(Math.sin(a) * r), '#a8604a'); break; }
                case 'pod': for (let i = 0; i < 4; i++) { const yy = Y + 20 - ((tick + i * 9 + f.k * 5) % 34), xx = X - 6 + Math.floor(h01(i, f.k, 3) * 12); tone(xx, yy, R.ICE, 0.86); } break;
                case 'emergency': {
                    const on = (t % 1800) < 900;
                    if (on) { for (let y = -26; y <= 26; y++) for (let x = -34; x <= 34; x++) { const d = Math.hypot(x / 1.3, y) / 26; if (d < 1 && A.api.bay(X + x, Y + y) < (1 - d) * 0.22) px(X + x, Y + y, R.RED.hex[d < 0.4 ? 2 : 1]); } px(X - 2, Y - 1, '#ffd2c8', 5, 2); }
                    break;
                }
                case 'beacon': if ((t % 2200) < 260) { px(X - 1, Y, '#e2574c', 3, 1); px(X, Y - 1, '#e2574c', 1, 3); px(X, Y, '#ffd2c8'); for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) { const d = Math.hypot(x, y) / 5; if (d < 1 && d > 0.3 && A.api.bay(X + x, Y + y) < (1 - d) * 0.35) px(X + x, Y + y, R.RED.hex[1]); } } break;
                case 'plume': {
                    const len = 46 + Math.round(h01(tick, 1, 3) * 10);
                    for (let y = 0; y < len; y++) { const hw = (f.w / 2) * (1 - (y / len) * 0.55); for (let x = -Math.ceil(hw); x <= Math.ceil(hw); x++) { const u = Math.abs(x) / hw, v = (1 - y / len) * (1 - u * u) * 0.95; if (v > 0.06) tone(X + x, Y + y, R.PLUME, v); } }
                    break;
                }
                default: break;
            }
        }

        // ── one frame (ship-life's render, drawing into this view's art canvas) ──
        function drawSpace(t) {
            const cam = Math.round(S.camY);
            [[0, 0.12, 0.004, 0], [1, 0.3, 0.012, 137]].forEach(([layer, par, drift, ox]) => {
                const T = A.stars(layer), n = T.size, oy = ((Math.round(-cam * par + t * drift) % n) + n) % n;
                for (let y = oy - n; y < S.H; y += n) for (let x = -(ox % n); x < S.W; x += n) ctx.drawImage(T.canvas, x, y);
            });
        }
        const patterns = [];
        function bayerPattern(levelN) {
            const Lv = Math.max(0, Math.min(64, Math.round(levelN)));
            if (!patterns[Lv]) { const c = document.createElement('canvas'); c.width = 8; c.height = 8; const g = c.getContext('2d'); g.fillStyle = '#000'; for (let i = 0; i < 64; i++) if (window.V3Paint.BAYER_RAW[i] < Lv) g.fillRect(i & 7, i >> 3, 1, 1); patterns[Lv] = ctx.createPattern(c, 'repeat'); }
            return patterns[Lv];
        }
        function render(t, drawShades) {
            if (!S.W || !S.shown) return;
            const tick = Math.floor(t / TICK), cam = Math.round(S.camY), simT = SIM_START + t;
            curFill = '';
            ctx.globalCompositeOperation = 'source-over';
            ctx.imageSmoothingEnabled = false;
            ctx.fillStyle = A.INK; ctx.fillRect(0, 0, S.W, S.H);
            drawSpace(t);
            const people = SIM.at(STATE, simT), gone = SIM.stateOf(STATE).gone || [];
            const ctxS = { meal: people.some(p => p.act === 'sit' && p.deck === 2) };
            const visible = (y0, h) => y0 + h > cam && y0 < cam + S.H;
            const N = A.nose(), T = A.tail();
            if (A.reactor && !A.reactor.fromUrl) { const res = World.state().res; if (res) A.reactor.set(res.energy); }   // the reactor shows the ship's energy (?energy= overrides)
            if (visible(0, L.TOP0)) { ctx.drawImage(N.canvas, S.offX, -cam); N.fx.forEach(f => fx(f, simT, tick, ctxS)); }
            for (let i = 0; i < L.N; i++) {
                const top = A.deckTop(i); if (!visible(top, L.PITCH)) continue;
                const D = deckOf(i);
                ctx.drawImage(D.canvas, S.offX, top - cam);
                D.fx.forEach(f => fx(f, simT, tick, ctxS));
            }
            if (visible(L.TAIL0, L.H - L.TAIL0)) { ctx.drawImage(T.canvas, S.offX, L.TAIL0 - cam); T.fx.forEach(f => fx(f, simT, tick, ctxS)); }
            S.drawn = [];
            people.filter(p => !gone.includes(p.id)).sort((a, b) => a.z - b.z || a.x - b.x).forEach(p => { if (visible(p.y - 110, 120)) drawPerson(p); });
            if (drawShades) drawShades(ctx, (sx, sy) => [sx * S.dpr / S.k, sy * S.dpr / S.k]);
            if (S.reveal < 1) {                                                                    // the plating falls away through the dither
                ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = bayerPattern(S.reveal * 64); ctx.fillRect(0, 0, S.W, S.H); ctx.globalCompositeOperation = 'source-over';
            }
            vctx.imageSmoothingEnabled = false;
            vctx.clearRect(0, 0, view.width, view.height);
            vctx.drawImage(art, 0, 0, S.W, S.H, 0, 0, S.W * S.k, S.H * S.k);
            placeRoomWords();
        }

        // ── the words beside the decks: the room's name, and the supplies that belong there ──
        function roomEls() {
            if (S.roomEls.length) return S.roomEls;
            for (let i = 0; i < L.N; i++) {
                const el = document.createElement('div'); el.className = 'room-words w';
                const n = document.createElement('p'); n.className = 'rname'; n.textContent = ROOM_NAMES[i];
                const s = document.createElement('p'); s.className = 'rline';
                el.append(n, s); wordsLayer.appendChild(el); S.roomEls.push({ el, sub: s });
            }
            return S.roomEls;
        }
        function placeRoomWords() {
            const st = World.state(), els = roomEls(), k = S.k / S.dpr, x = Math.min((S.offX + L.CX + L.HO + 24) * k, innerWidth - 190);   // beside the hull, or on its plating when the hull is wider than the screen
            els.forEach((r, i) => {
                const mid = A.deckTop(i) + L.PITCH * 0.42, y = (mid - S.camY) * k;
                const sub = i === 5 ? `Energy ${st.res.energy}` : i === 4 ? `Rations ${st.res.rations} · Salvage ${st.res.salvage}` : '';
                if (r.sub.textContent !== sub) r.sub.textContent = sub;
                r.sub.style.display = sub ? '' : 'none';
                const on = S.shown && S.reveal >= 1 && y > 20 && y < innerHeight - 40;
                r.el.style.opacity = on ? '1' : '0';
                r.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
                r.el.classList.add('is-left-aligned');
            });
        }

        // ── input ──
        const alphas = new WeakMap();
        function hitPerson(ax, ay) {
            const wy = ay + Math.round(S.camY), wx = ax - S.offX;
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
        const toArt = (clientX, clientY) => [Math.floor(clientX * S.dpr / S.k), Math.floor(clientY * S.dpr / S.k)];
        function hover(clientX, clientY) { const [ax, ay] = toArt(clientX, clientY); return !!hitPerson(ax, ay); }
        /** 'person' (they speak), 'deck' (the camera moves), or 'outside' (a click in space: back to flying). */
        function click(clientX, clientY) {
            const [ax, ay] = toArt(clientX, clientY), who = hitPerson(ax, ay);
            if (who) { speak(who); return 'person'; }
            const hx = ax - S.offX;
            if (hx < L.CX - L.HO - 30 || hx > L.CX + L.HO + 30) return 'outside';
            clickDeck(ay + Math.round(S.camY));
            return 'deck';
        }
        function speak(id) {
            const d = S.drawn.find(p => p.id === id); if (!d) return;
            const l = SIM.line(STATE, id, d.say); if (!l.text) return;
            World.say(l.who, l.text, { anchor: 'person:' + id });
        }
        /** Where words go over a person's head, in screen pixels. */
        function anchor(id) {
            const d = S.drawn.find(p => p.id === id); if (!d) return null;
            const top = d.act === 'sleep' ? d.y - 26 : d.act === 'sit' ? d.y - 84 : d.act === 'tend' ? d.y - 70 : d.y - 104, k = S.k / S.dpr;
            return { x: (d.x + S.offX) * k, y: (top - Math.round(S.camY)) * k - 10 };
        }
        function wheel(dy) { S.camT = clampCam(S.camT + dy * 0.6); }
        function update(dt) { const k = 1 - Math.exp(-dt / 170); S.camY += (S.camT - S.camY) * k; if (Math.abs(S.camT - S.camY) < 0.3) S.camY = S.camT; }

        /** Where the hull stands on screen when the view opens on decks d and d+1, in device pixels: the outside drawing of
            the ship ends its turn exactly here, so the plating can fall away onto the decks behind it. */
        function pose(d) {
            const cam = camFor(d);
            return { k: S.k, cx: (S.offX + L.CX) * S.k, tipY: (L.TIP - cam) * S.k, rows: 1938, width: 2 * L.HO };
        }
        function show(on) {
            S.shown = !!on; view.style.display = on ? 'block' : 'none';
            if (!on) S.roomEls.forEach(r => { r.el.style.opacity = '0'; });
        }
        function open(d) { focus(d == null ? 1 : d, true); }

        // paint every deck ahead of time, one every 20 ms of real time, so opening the ship never stalls a frame
        function prepare() {
            const bake = [() => A.nose(), () => A.tail()];
            for (let i = 0; i < L.N; i++) bake.push(() => deckOf(i));
            const cyc = SIM.stateOf(STATE).cycle, WARM = 2500;
            for (let t0 = 0; t0 < cyc; t0 += WARM) bake.push(() => { for (let t = t0; t < t0 + WARM; t += 115) SIM.at(STATE, t).forEach(p => { const ll = lightFor(p), Sp = spriteOf(p, ll); if (ll.dim) dimOf(Sp.canvas); }); });
            (function next() { const job = bake.shift(); if (!job) return; try { job(); } catch (err) { console.warn('Ship view bake skipped:', err.message); } setTimeout(next, 20); })();
        }
        /** Which decks people are on at a moment of the game's clock: the portholes outside light from this. */
        function occupied(t) {
            const on = [false, false, false, false, false, false];
            SIM.at(STATE, SIM_START + t).forEach(p => { if (p.deck >= 0 && p.deck < 6) on[p.deck] = true; });
            return on;
        }

        resize();
        return {
            resize, update, render, show, open, focus, hover, click, wheel, stepDeck, anchor, pose, prepare, occupied,
            isShown: () => S.shown, setReveal: v => { S.reveal = Math.max(0, Math.min(1, v)); }, get k() { return S.k; },
            people: () => S.drawn.map(d => ({ id: d.id, x: (d.x + S.offX) * S.k / S.dpr, y: (d.y - 50 - Math.round(S.camY)) * S.k / S.dpr })),
        };
    }
    window.V3Inside = { create };
})();
