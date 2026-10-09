/* ═══ Silent Exodus · layout variant B, "Nose up" · drawing the living ship ═══════════════════════════════════════════
   Copied from crew-hires/ship-life.html (its moving layer, its light on people, its blankets and its hit test), so the
   ship here is the same picture the designer approved. The only change: it draws into a frame it is given (the page owns
   the camera and the space around the ship) and the crew come from VoyageSim. The original page is not touched.

   window.ShipView.create(S, ctx)   S: { offX, camY, H, state }  (read every frame)
     → { draw(t, people), drawn, hitPerson(ax, ay), speechTop(d), lightFor(p) }
*/
(function (root) {
    'use strict';
    const TICK = 125;

    function create(S, ctx) {
        const CE = root.CrewEngine, A = root.ShipArt, SIM = root.VoyageSim, L = A.L, R = A.R, lv = A.api.level;
        const ORDER = ['cora', 'jaxon', 'aris', 'vance', 'mira'], SEED = id => ORDER.indexOf(id) + 1;
        const out = { drawn: [] };

        // ── light on people: warmth by distance to the nearest lit lamp on their deck (ship-life.html) ───────────
        const looks = st => SIM.stateOf(st).looks;
        const deckOf = (i, st) => A.deck(i, looks(st)[i] || {});
        function lightFor(p, stateId) {
            const lamps = deckOf(p.deck, stateId || S.state).lamps;
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
        function blit(cv, Sp, x, y, facing) {
            const X = Math.round(x) + S.offX, Y = Math.round(y) - Math.round(S.camY) - Sp.origin.y;
            if (facing > 0) ctx.drawImage(cv, X - Sp.origin.x, Y);
            else { ctx.save(); ctx.translate(X + 1, 0); ctx.scale(-1, 1); ctx.drawImage(cv, -Sp.origin.x, Y); ctx.restore(); }
        }
        const blinking = (ms, seed) => ((ms + seed * 1700) % 4300) < 140;
        function spriteOf(p, ll) {
            const still = p.act === 'idle' || p.act === 'sit' || p.act === 'console' || p.act === 'wall' || p.act === 'tend' || p.act === 'sleep';
            const ms = still ? p.ms + SEED(p.id) * 977 : p.ms;
            return CE.sprite(p.id, p.act, CE.frameAt(p.act, ms), { blink: p.act !== 'sleep' && blinking(ms, SEED(p.id)), warm: ll.warm, rim: ll.rim * p.facing, screen: p.screen === undefined ? p.act === 'console' : p.screen });
        }
        function drawPerson(p) {
            const ll = lightFor(p), Sp = spriteOf(p, ll);
            blit(ll.dim ? dimOf(Sp.canvas) : Sp.canvas, Sp, p.x, p.y, p.facing);
            out.drawn.push({ id: p.id, Sp, x: p.x, y: p.y, facing: p.facing, act: p.act, say: p.say });
        }

        // ── the moving layer: a few pixels a tick, eight a second (ship-life.html, unchanged) ────────────────────
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
                case 'aura': { const v = 0.55 + 0.4 * Math.sin(t / 1700) + (ctxS.auraTalking ? 0.3 * Math.sin(t / 120) : 0); px(X, Y, R.SCR.hex[v > 0.75 ? 5 : v > 0.45 ? 4 : 3], 2, 1); break; }
                case 'glint': px(X + Math.round(f.r * 0.4), Y - Math.round(f.r * 0.55), '#9ec4c8'); px(X + Math.round(f.r * 0.55), Y - Math.round(f.r * 0.35), '#4f6e74'); break;
                case 'steam':
                    if (f.when === 'meal' && !ctxS.meal) break;
                    for (let i = 0; i < 5; i++) { const rise = (tick + i * 5) % 16, x = X + Math.round(Math.sin((tick + i * 7) / 3) * 1.5) + (i % 2), y = Y - rise; if (h01(i, tick, 7) > rise / 18) tone(x, y, R.LINEN, 0.45 - rise * 0.02); }
                    break;
                case 'core': {
                    const pulse = 0.5 + 0.5 * Math.sin(t / 620), band = (tick * 3) % (f.h + 20);
                    for (let y = 0; y < f.h; y++) {
                        const inBand = Math.abs((f.h - y) - band) < 3;
                        for (let x = 0; x < f.w; x++) { const c = 1 - Math.abs(x - f.w / 2) / (f.w / 2); const v = inBand ? 0.7 + 0.3 * c : 0.42 + 0.38 * c * pulse; if (inBand || h01(x + y * 3, tick, 2) < 0.18) tone(X + x, Y + y, R.ICE, v); }
                    }
                    break;
                }
                case 'hob': if (ctxS.meal) for (let x = 1; x < f.w - 1; x++) tone(X + x, Y, R.RED, 0.38 + 0.25 * Math.sin(t / 300 + x) * (h01(x, tick, 4) > 0.5 ? 1 : 0.4)); break;
                case 'nav': if (((t + f.phase) % 2600) < 180) { px(X - 1, Y, f.color, 3, 1); px(X, Y - 1, f.color, 1, 3); px(X, Y, '#f6f1e4'); } else px(X, Y, f.dim); break;
                case 'needle': { const a = -2.2 + f.k * 0.5 + Math.sin(t / 900 + f.k * 2) * 0.12; for (let r = 1; r <= 3; r++) px(X + Math.round(Math.cos(a) * r), Y + Math.round(Math.sin(a) * r), '#a8604a'); break; }
                case 'beacon': if ((t % 2200) < 260) { px(X - 1, Y, '#e2574c', 3, 1); px(X, Y - 1, '#e2574c', 1, 3); px(X, Y, '#ffd2c8'); } break;
                case 'plume': {
                    const len = 46 + Math.round(h01(tick, 1, 3) * 10) + Math.round(ctxS.thrust * 30);
                    for (let y = 0; y < len; y++) { const hw = (f.w / 2) * (1 - (y / len) * 0.55); for (let x = -Math.ceil(hw); x <= Math.ceil(hw); x++) { const u = Math.abs(x) / hw, v = (1 - y / len) * (1 - u * u) * 0.95; if (v > 0.06) tone(X + x, Y + y, R.PLUME, v); } }
                    break;
                }
                default: break;
            }
        }

        // ── one frame of the ship: nose, decks, tail, then the people, all over whatever the page drew behind ──────
        function draw(t, people, ctxS) {
            const tick = Math.floor(t / TICK), cam = Math.round(S.camY);
            curFill = '';
            const visible = (y0, h) => y0 + h > cam && y0 < cam + S.H;
            const N = A.nose(), T = A.tail();
            if (visible(0, L.TOP0)) {
                // the cone is cut open but not see-through: back it with ink so a world sliding behind never shows in a seam
                ctx.fillStyle = A.INK; curFill = A.INK;
                for (let y = Math.max(L.TIP, cam); y < Math.min(L.TOP0, cam + S.H); y++) { const hw = Math.floor(A.noseHalf(y)) - 3; if (hw > 0) ctx.fillRect(S.offX + L.CX - hw, y - cam, hw * 2, 1); }
                ctx.drawImage(N.canvas, S.offX, -cam); N.fx.forEach(f => fx(f, t, tick, ctxS));
            }
            for (let i = 0; i < L.N; i++) {
                const top = A.deckTop(i); if (!visible(top, L.PITCH)) continue;
                const D = deckOf(i, S.state);
                ctx.drawImage(D.canvas, S.offX, top - cam);
                D.fx.forEach(f => fx(f, t, tick, ctxS));
            }
            if (visible(L.TAIL0, L.H - L.TAIL0)) { ctx.drawImage(T.canvas, S.offX, L.TAIL0 - cam); T.fx.forEach(f => fx(f, t, tick, ctxS)); }
            out.drawn = [];
            people.slice().sort((a, b) => a.z - b.z || a.x - b.x).forEach(p => { if (visible(p.y - 110, 120)) drawPerson(p); });
        }

        // ── the hit test (ship-life.html): the sprite's own pixels, three pixels of slack ────────────────────────────
        const alphas = new WeakMap();
        function hitPerson(ax, ay) {
            const wy = ay + Math.round(S.camY), wx = ax - S.offX;
            for (let i = out.drawn.length - 1; i >= 0; i--) {
                const d = out.drawn[i], Sp = d.Sp, top = Math.round(d.y) - Sp.origin.y;
                const cx = d.facing > 0 ? wx - (Math.round(d.x) - Sp.origin.x) : (Math.round(d.x) + Sp.origin.x) - wx, cy = wy - top;
                if (cx < -3 || cy < -3 || cx >= Sp.w + 3 || cy >= Sp.h + 3) continue;
                let al = alphas.get(Sp.canvas);
                if (!al) { al = Sp.canvas.getContext('2d').getImageData(0, 0, Sp.w, Sp.h).data; alphas.set(Sp.canvas, al); }
                for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < Sp.w && y < Sp.h && al[(y * Sp.w + x) * 4 + 3]) return d.id; }
            }
            return null;
        }
        const speechTop = d => (d.act === 'sleep' ? d.y - 26 : d.act === 'sit' ? d.y - 84 : d.act === 'tend' ? d.y - 70 : d.y - 104);

        // paint every deck and every sprite frame ahead of time, a little per tick, so no frame stalls (ship-life.html)
        function warm(stateId) {
            const jobs = [() => A.nose(), () => A.tail()];
            for (let i = 0; i < L.N; i++) jobs.push(() => deckOf(i, stateId));
            const cyc = SIM.stateOf(stateId).cycle;
            for (let t0 = 0; t0 < cyc; t0 += 2500) jobs.push(() => {
                for (let t = t0; t < t0 + 2500; t += 115) SIM.at(stateId, t).forEach(p => { const ll = lightFor(p, stateId), Sp = spriteOf(p, ll); if (ll.dim) dimOf(Sp.canvas); });
            });
            (function next() { const job = jobs.shift(); if (!job) return; job(); setTimeout(next, 20); })();
        }

        return Object.assign(out, { draw, hitPerson, speechTop, lightFor, warm });
    }

    root.ShipView = Object.freeze({ create });
})(typeof window !== 'undefined' ? window : globalThis);
