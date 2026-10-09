/* Silent Exodus · layouts · variant A · the tower: the living ship cut open, drawn into the shared picture.
   The drawing code is crew-hires/ship-life.html's, copied (the deck paintings, the furniture and the people come from
   ship-art.js, ship-rooms.js and the crew files, loaded as they are). Changes: it draws into a canvas it is handed, at a
   horizontal offset and camera row it is handed, over a sky that is already there (no sky of its own: the travel view's
   space shows round the hull and through every window); the computer's speaker glows brighter while A.U.R.A. talks.
     window.TowerA = { draw(ctx, o), hitPerson(ax, ay), drawn, warm() }
       o = { t, camY, offX, W, H, people, auraTalking }
*/
(function () {
    'use strict';
    const CE = window.CrewEngine, A = window.ShipArt, SIM = window.ShipSimA, L = A.L, R = A.R, lv = A.api.level;
    const ORDER = ['cora', 'jaxon', 'aris', 'vance', 'mira'], SEED = id => ORDER.indexOf(id) + 1;
    const TICK = 125, STATE = 'travel';
    let ctx = null, O = null, drawn = [];

    // ── light on people: warmth by distance to the nearest lit lamp on their deck (ship-life) ──
    const deckOf = i => A.deck(i, (SIM.stateOf(STATE).looks || {})[i] || {});
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
    function blit(cv, Sp, x, y, facing) {
        const X = Math.round(x) + O.offX, Y = Math.round(y) - Math.round(O.camY) - Sp.origin.y;
        if (facing > 0) ctx.drawImage(cv, X - Sp.origin.x, Y);
        else { ctx.save(); ctx.translate(X + 1, 0); ctx.scale(-1, 1); ctx.drawImage(cv, -Sp.origin.x, Y); ctx.restore(); }
    }
    const blinking = (ms, seed) => ((ms + seed * 1700) % 4300) < 140;
    const STILL = { idle: 1, sit: 1, console: 1, wall: 1, tend: 1, sleep: 1 };
    function spriteOf(p, ll) {
        const ms = STILL[p.act] ? p.ms + SEED(p.id) * 977 : p.ms;
        return CE.sprite(p.id, p.act, CE.frameAt(p.act, ms), { blink: p.act !== 'sleep' && blinking(ms, SEED(p.id)), warm: ll.warm, rim: ll.rim * p.facing, screen: p.screen === undefined ? p.act === 'console' : p.screen });
    }
    function drawPerson(p) {
        const ll = lightFor(p), Sp = spriteOf(p, ll);
        blit(ll.dim ? dimOf(Sp.canvas) : Sp.canvas, Sp, p.x, p.y, p.facing);
        drawn.push({ id: p.id, Sp, x: p.x, y: p.y, facing: p.facing, act: p.act, say: p.say });
    }

    // ── the moving layer (ship-life's fx, unchanged but for the speaker) ──
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
        const X = f.x + O.offX, Y = f.y - Math.round(O.camY);
        if (X < -80 || X > O.W + 80) return;
        switch (f.kind) {
            case 'screen': screenFx(f, X, Y, tick, t); break;
            case 'led': if (((t + f.x * 37) % f.period) < f.period * 0.55) px(X, Y, f.color); break;
            case 'aura': {                                                                         // the computer's speaker: brighter while she talks
                if (O.auraTalking) { const on = (Math.floor(t / TICK) % 3) !== 2; px(X - 1, Y - 1, R.SCR.hex[on ? 5 : 4], 4, 3); px(X, Y, R.SCR.hex[5], 2, 1); for (let i = 0; i < 6; i++) tone(X - 3 + i * 1.6, Y - 3 + (i % 2) * 6, R.SCR, on ? 0.5 : 0.3); break; }
                const v = 0.55 + 0.4 * Math.sin(t / 1700); px(X, Y, R.SCR.hex[v > 0.75 ? 5 : v > 0.45 ? 4 : 3], 2, 1); break;
            }
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
                const len = 46 + Math.round(h01(tick, 1, 3) * 10);
                for (let y = 0; y < len; y++) { const hw = (f.w / 2) * (1 - (y / len) * 0.55); for (let x = -Math.ceil(hw); x <= Math.ceil(hw); x++) { const u = Math.abs(x) / hw, v = (1 - y / len) * (1 - u * u) * 0.95; if (v > 0.06) tone(X + x, Y + y, R.PLUME, v); } }
                break;
            }
            default: break;
        }
    }

    /** The cone's floor has see-through rows above the bridge ceiling; a world passing behind showed through them like a
        window. A dark backing under them (painted pixels of the cone still draw on top). */
    let backing = null;
    function noseBacking() {
        if (backing) return backing;
        const H = 40, p = A.api.painter(L.W, H, L.TOP0 - H);
        for (let y = 0; y < H; y++) { const wy = L.TOP0 - H + y, hw = A.noseHalf(wy) - 2; for (let x = Math.round(L.CX - hw); x < Math.round(L.CX + hw); x++) p.tone(x, y, R.WALL, 0.1 + 0.05 * (y / H)); }
        backing = p.canvas();
        return backing;
    }

    /** Draws the visible part of the tower and the people in it, over whatever is already in ctx. */
    function draw(c, o) {
        ctx = c; O = o; curFill = '';
        const t = o.t, tick = Math.floor(t / TICK), cam = Math.round(o.camY);
        const ctxS = { meal: o.people.some(p => p.act === 'sit' && p.deck === 2) };
        const visible = (y0, h) => y0 + h > cam && y0 < cam + o.H;
        const N = A.nose(), T = A.tail();
        if (visible(0, L.TOP0)) { ctx.drawImage(noseBacking(), o.offX, L.TOP0 - 40 - cam); ctx.drawImage(N.canvas, o.offX, -cam); N.fx.forEach(f => fx(f, t, tick, ctxS)); }
        for (let i = 0; i < L.N; i++) {
            const top = A.deckTop(i); if (!visible(top, L.PITCH)) continue;
            const D = deckOf(i);
            ctx.drawImage(D.canvas, o.offX, top - cam);
            D.fx.forEach(f => fx(f, t, tick, ctxS));
        }
        if (visible(L.TAIL0, L.H - L.TAIL0)) { ctx.drawImage(T.canvas, o.offX, L.TAIL0 - cam); T.fx.forEach(f => fx(f, t, tick, ctxS)); }
        drawn = [];
        o.people.slice().sort((a, b) => a.z - b.z || a.x - b.x).forEach(p => { if (visible(p.y - 110, 120) && p.x + o.offX > -30) drawPerson(p); });
    }

    // ── who is under the pointer: the sprite's own pixels, with a 3 px margin (ship-life) ──
    const alphas = new WeakMap();
    function hitPerson(ax, ay) {
        if (!O) return null;
        const wy = ay + Math.round(O.camY), wx = ax - O.offX;
        for (let i = drawn.length - 1; i >= 0; i--) {
            const d = drawn[i], Sp = d.Sp, top = Math.round(d.y) - Sp.origin.y;
            const cx = d.facing > 0 ? wx - (Math.round(d.x) - Sp.origin.x) : (Math.round(d.x) + Sp.origin.x) - wx, cy = wy - top;
            if (cx < -3 || cy < -3 || cx >= Sp.w + 3 || cy >= Sp.h + 3) continue;
            let al = alphas.get(Sp.canvas);
            if (!al) { al = Sp.canvas.getContext('2d').getImageData(0, 0, Sp.w, Sp.h).data; alphas.set(Sp.canvas, al); }
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = cx + dx, y = cy + dy; if (x >= 0 && y >= 0 && x < Sp.w && y < Sp.h && al[(y * Sp.w + x) * 4 + 3]) return d.id; }
        }
        return null;
    }

    /** Jobs that paint every deck and every sprite frame ahead of time, one small job at a time. */
    function warm() {
        const jobs = [() => A.nose(), () => A.tail()];
        for (let i = 0; i < L.N; i++) jobs.push(() => deckOf(i));
        const cyc = SIM.stateOf(STATE).cycle;
        for (let t0 = 0; t0 < cyc; t0 += 2500) jobs.push(() => { for (let t = t0; t < t0 + 2500; t += 115) SIM.at(STATE, t).forEach(p => { const ll = lightFor(p), Sp = spriteOf(p, ll); if (ll.dim) dimOf(Sp.canvas); }); });
        return jobs;
    }

    window.TowerA = { draw, hitPerson, warm, get drawn() { return drawn; } };
})();
