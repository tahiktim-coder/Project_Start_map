/* ═══ Silent Exodus · layout variant D, "The bridge" · the page: one picture, the clock, clicks ═════════════════════
   One canvas, 640 x 360 art pixels shown at the largest whole scale that fits (3 at 1920 x 1080). Drawn back to front:
   the stars beside the hull, the journey through the window (journey.js), the room (bridge-art.js), the lab deck under
   it (ShipArt.deck(1), unchanged), the small moving things, the people. Words are DOM text over the picture: a person's
   line over their head, A.U.R.A. by its grille, a world's name beside it.
   DEBUG / stills (a hidden or headless browser can pause requestAnimationFrame):
     window.bridge.pause() / play() / step(ms) / setTime(ms) / stop(atMs) / say(id) / go('bridge'|'lab') / hover(id) / stats()
     URL: ?t=ms opens paused at that time · ?stop=ms the player clicks the world in reach at that time · ?say=id
          that person's line shows · ?deck=lab frames the lab · ?hover=id points at a world
*/
(function () {
    'use strict';
    const CE = window.CrewEngine, A = window.ShipArt, BA = window.BridgeArt, J = window.Journey, CREW = window.BridgeCrew;
    const R = A.R, L = A.L, B = BA.B;
    const SW = 640, SH = 360, OFFX = -40, TICK = 125;
    const CAM = { bridge: B.Y0, lab: 530 };
    const COLOR = { cora: '#9fd8e6', jaxon: '#f0a860', aris: '#e58ac8', vance: '#d8dde0', mira: '#e2c46a' };
    const SEED = { cora: 1, jaxon: 2, aris: 3, vance: 4, mira: 5 };

    const view = document.getElementById('view'), vctx = view.getContext('2d');
    const art = document.createElement('canvas'); art.width = SW; art.height = SH;
    const ctx = art.getContext('2d');
    const jc = document.createElement('canvas'); jc.width = SW; jc.height = SH;
    const jctx = jc.getContext('2d');
    const q = new URLSearchParams(location.search);
    const S = { t: 0, playing: true, last: null, stop: null, camY: CAM.bridge, camT: CAM.bridge, k: 3, dpr: 1, left: 0, top: 0,
        hover: null, speech: null, drawn: [], frames: [] };

    const room = BA.paint();
    const lowerDecks = () => [1, 2].map(i => ({ i, top: A.deckTop(i), D: A.deck(i) }));

    // ── fitting the picture: whole device pixels per art pixel, centred, ink round it ──
    function resize() {
        S.dpr = window.devicePixelRatio || 1;
        const devW = Math.round(innerWidth * S.dpr), devH = Math.round(innerHeight * S.dpr);
        S.k = Math.max(1, Math.floor(Math.min(devW / SW, devH / SH)));
        view.width = SW * S.k; view.height = SH * S.k;
        const cssW = SW * S.k / S.dpr, cssH = SH * S.k / S.dpr;
        S.left = Math.round((innerWidth - cssW) / 2); S.top = Math.round((innerHeight - cssH) / 2);
        Object.assign(view.style, { width: cssW + 'px', height: cssH + 'px', left: S.left + 'px', top: S.top + 'px' });
        document.documentElement.style.setProperty('--k', String(S.k / S.dpr));
        render();
    }
    const toScreen = (ax, ay) => [S.left + ax * S.k / S.dpr, S.top + ay * S.k / S.dpr];
    const toArt = e => [Math.floor((e.clientX - S.left) * S.dpr / S.k), Math.floor((e.clientY - S.top) * S.dpr / S.k)];

    // ── the moving layer of the room (ship-life.html fx, copied) ──
    let curFill = '';
    const px = (x, y, hex, w = 1, h = 1) => { if (hex !== curFill) { ctx.fillStyle = hex; curFill = hex; } ctx.fillRect(x, y, w, h); };
    const tone = (x, y, r, v) => { const k = A.api.level(r, v, x, y); if (k > 0) px(x, y, r.hex[k]); };
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
                const age = (sweep - c + w) % w;
                px(X + c, Y + Math.max(0, Math.min(h - 1, mid + spike)), age < 2 ? R.SCR.hex[5] : age < 10 ? R.SCR.hex[4] : R.SCR.hex[2]);
            }
        } else if (f.tone === 'graph') {
            for (let c = 0; c < w; c++) { const y = Math.round(h / 2 + (A.api.vnoise((c + tick) / 4, 0, 13) - 0.5) * (h - 2)); px(X + c, Y + Math.max(0, Math.min(h - 1, y)), R.SCR.hex[c === w - 1 ? 5 : 3]); }
        }
    }
    function fx(f, t, tick) {
        const X = f.x + OFFX, Y = f.y - Math.round(S.camY);
        if (Y < -40 || Y > SH + 40) return;
        switch (f.kind) {
            case 'screen': screenFx(f, X, Y, tick, t); break;
            case 'led': if (((t + f.x * 37) % f.period) < f.period * 0.55) px(X, Y, f.color); break;
            case 'aura': { const v = 0.55 + 0.4 * Math.sin(t / 1700), speaking = S.speech && S.speech.id === 'aura' && S.t < S.speech.t0 + S.speech.dur; px(X, Y, R.SCR.hex[speaking ? ((tick >> 1) & 1 ? 5 : 4) : v > 0.75 ? 5 : v > 0.45 ? 4 : 3], 3, 1); break; }
            case 'glint': px(X + Math.round(f.r * 0.4), Y - Math.round(f.r * 0.55), '#9ec4c8'); px(X + Math.round(f.r * 0.55), Y - Math.round(f.r * 0.35), '#4f6e74'); break;
            case 'nav': if (((t + f.phase) % 2600) < 180) { px(X - 1, Y, f.color, 3, 1); px(X, Y - 1, f.color, 1, 3); px(X, Y, '#f6f1e4'); } else px(X, Y, f.dim); break;
            case 'steam': case 'hob': case 'core': case 'needle': case 'pod': case 'emergency': case 'beacon': case 'plume': break;
            default: break;
        }
    }

    // ── people (ship-life.html, copied: warmth from the nearest lamp, a rim from the light ahead on the bridge) ──
    const lampsOf = deck => (deck === 0 ? room.lamps : A.deck(deck).lamps);
    function lightFor(p) {
        const lamps = lampsOf(p.deck);
        if (!lamps.length) return { warm: 0, rim: 0 };
        const near = lamps.reduce((a, b) => (Math.abs(b.x - p.x) < Math.abs(a.x - p.x) ? b : a)), d = near.x - p.x;
        const rim = p.deck === 0 ? 1 : Math.abs(d) > 6 && Math.abs(d) < 120 ? Math.sign(d) : 0;
        return { warm: Math.round(3 * Math.exp(-Math.abs(d) / 55)), rim };
    }
    const blinking = (ms, seed) => ((ms + seed * 1700) % 4300) < 140;
    function spriteOf(p, ll) {
        const still = p.act === 'idle' || p.act === 'sit' || p.act === 'console';
        const ms = still ? p.ms + SEED[p.id] * 977 : p.ms;
        return CE.sprite(p.id, p.act, CE.frameAt(p.act, ms), { blink: blinking(ms, SEED[p.id]), warm: ll.warm, rim: ll.rim * p.facing, screen: p.act === 'console' });
    }
    function blit(cv, Sp, x, y, facing) {
        const X = Math.round(x) + OFFX, Y = Math.round(y) - Math.round(S.camY) - Sp.origin.y;
        if (facing > 0) ctx.drawImage(cv, X - Sp.origin.x, Y);
        else { ctx.save(); ctx.translate(X + 1, 0); ctx.scale(-1, 1); ctx.drawImage(cv, -Sp.origin.x, Y); ctx.restore(); }
    }
    function drawPerson(p) {
        const ll = lightFor(p), Sp = spriteOf(p, ll);
        blit(Sp.canvas, Sp, p.x, p.y, p.facing);
        S.drawn.push({ id: p.id, Sp, x: p.x, y: p.y, facing: p.facing, act: p.act, say: p.say, deck: p.deck });
    }

    // ── what is in view ──
    function placeInView() {
        if (S.stop) return J.PLACES.find(p => p.id === S.stop.id);
        let best = null, br = 0;
        J.PLACES.forEach(pl => { const g = J.geomAt(pl, S.t, null); if (g.r > br && g.x + g.r > J.WIN.x0 && g.x - g.r < J.WIN.x1 && g.r > 4) { best = pl; br = g.r; } });
        return best;
    }

    // ── one frame ──
    function drawSides(t) {
        [[0, 0.12, 0.002, 0], [1, 0.3, 0.006, 137]].forEach(([layer, par, drift, ox]) => {
            const T = A.stars(layer), n = T.size, oy = ((Math.round(-S.camY * par + t * drift) % n) + n) % n;
            for (let y = oy - n; y < SH; y += n) for (let x = -(ox % n); x < SW; x += n) ctx.drawImage(T.canvas, x, y);
        });
    }
    function render() {
        const t0 = performance.now(), t = S.t, tick = Math.floor(t / TICK), cam = Math.round(S.camY), dy = B.Y0 - cam;
        curFill = '';
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = A.INK; ctx.fillRect(0, 0, SW, SH);
        drawSides(t);
        // the journey, through the glass
        const W0 = J.WIN;
        if (W0.y1 + dy > 0) {
            J.draw(jctx, t, S.stop, S.hover);
            jctx.globalCompositeOperation = 'lighter'; jctx.drawImage(room.glass, 0, 0); jctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(jc, W0.x0, W0.y0, W0.x1 - W0.x0, W0.y1 - W0.y0, W0.x0, W0.y0 + dy, W0.x1 - W0.x0, W0.y1 - W0.y0);
        }
        ctx.drawImage(room.canvas, OFFX, dy);
        room.fx.forEach(f => fx(f, t, tick));
        lowerDecks().forEach(({ top, D }) => {
            if (top - cam > SH || top + L.PITCH - cam < 0) return;
            ctx.drawImage(D.canvas, OFFX, top - cam);
            D.fx.forEach(f => fx(f, t, tick));
        });
        S.drawn = [];
        CREW.at(t, S.stop).sort((a, b) => a.z - b.z || a.x - b.x).forEach(p => { if (p.y - 110 - cam < SH && p.y - cam > -4) drawPerson(p); });
        vctx.imageSmoothingEnabled = false;
        vctx.drawImage(art, 0, 0, SW, SH, 0, 0, SW * S.k, SH * S.k);
        placeWords();
        S.frames.push(performance.now() - t0); if (S.frames.length > 240) S.frames.shift();
    }

    // ── words: one line at a time. Clicked lines, A.U.R.A.'s timed lines; the newest wins ──
    const sayEl = document.getElementById('say'), noteEl = document.getElementById('note');
    const LINE_MS = text => 3200 + text.length * 45;
    const REACH_T = J.PLACES.map(pl => {                                                    // when each world first comes close enough to name
        for (let t = 0; t < pl.passT * 1000; t += 100) if (J.geomAt(pl, t, null).r >= 12) return { pl, t };
        return { pl, t: pl.passT * 1000 - 8000 };
    });
    function autoLine() {
        if (S.stop) {
            const pl = J.PLACES.find(p => p.id === S.stop.id), t0 = S.stop.t0 + J.ARRIVE_MS - 600, text = pl.orbit.arrive[1];
            return S.t >= t0 && S.t < t0 + LINE_MS(text) + 1500 ? { id: 'aura', who: 'A.U.R.A.', text, t0, dur: LINE_MS(text) + 1500 } : null;
        }
        const tt = S.t;
        for (const { pl, t } of REACH_T) { const text = pl.reachLine[1]; if (tt >= t && tt < t + LINE_MS(text) + 1500) return { id: 'aura', who: 'A.U.R.A.', text, t0: t, dur: LINE_MS(text) + 1500 }; }
        return null;
    }
    function speak(id) {
        const d = S.drawn.find(p => p.id === id);
        if (!d) return false;
        const l = CREW.line(id, d.say, { place: placeInView(), stopped: !!S.stop && J.arrival(S.t, S.stop) > 0.5 });
        if (!l.text) return false;
        S.speech = { id: id === 'cora' ? 'aura' : id, person: id, who: l.who, text: l.text, t0: S.t, dur: LINE_MS(l.text), wall: performance.now() };
        render();
        return true;
    }
    function currentLine() {
        const clicked = S.speech && S.t >= S.speech.t0 && S.t < S.speech.t0 + S.speech.dur ? S.speech : null, auto = autoLine();
        if (clicked && auto) return clicked.t0 >= auto.t0 ? clicked : auto;
        return clicked || auto;
    }
    let shownKey = '';
    function placeWords() {
        const sp = currentLine();
        if (!sp) { sayEl.classList.remove('on'); shownKey = ''; }
        else {
            let ax, ay;
            if (sp.id === 'aura') { ax = 612 + OFFX; ay = B.Y0 + 112 - Math.round(S.camY); }
            else {
                const d = S.drawn.find(p => p.id === sp.id);
                if (!d) { sayEl.classList.remove('on'); shownKey = ''; return placeNote(); }
                const top = d.act === 'sit' ? d.y - 86 : d.act === 'climb' ? d.y - 112 : d.y - 106;
                ax = d.x + OFFX; ay = top - Math.round(S.camY);
            }
            const key = sp.who + sp.text + sp.t0;
            if (key !== shownKey) {
                sayEl.querySelector('b').textContent = sp.who; sayEl.querySelector('span').textContent = sp.text;
                sayEl.style.setProperty('--who', sp.id === 'aura' ? '#9fd8e6' : COLOR[sp.id]);
                sayEl.classList.toggle('is-aura', sp.id === 'aura');
                sayEl.classList.remove('on'); void sayEl.offsetWidth; shownKey = key;
            }
            const [bx, by] = toScreen(ax, ay), wHalf = Math.min(160, sayEl.offsetWidth / 2 || 150);
            const right = sp.id === 'aura';
            sayEl.style.left = (right ? bx : Math.max(wHalf + 8, Math.min(innerWidth - wHalf - 8, bx))) + 'px';
            sayEl.style.top = (right ? by : Math.max(sayEl.offsetHeight + 8, by - 6)) + 'px';
            sayEl.classList.add('on');
        }
        placeNote();
    }
    function placeNote() {
        let pl = null, mode = '';
        if (S.stop && J.arrival(S.t, S.stop) >= 1) { pl = J.PLACES.find(p => p.id === S.stop.id); mode = 'orbit'; }
        else if (S.hover && !S.stop) { pl = J.PLACES.find(p => p.id === S.hover); mode = 'reach'; }
        if (!pl) { noteEl.classList.remove('on'); return; }
        const g = J.geomAt(pl, S.t, S.stop), dy = B.Y0 - Math.round(S.camY);
        noteEl.querySelector('.n').textContent = pl.name;
        noteEl.querySelector('.g').textContent = mode === 'orbit' ? pl.orbit.line : pl.line;
        noteEl.querySelector('.c').textContent = mode === 'orbit' ? 'In orbit' : 'Click to stop here';
        const leftSide = g.x > 360;
        const ax = leftSide ? g.x - g.r - 8 : g.x + g.r + 8, ay = g.y - 10 + dy;
        const [sx, sy] = toScreen(ax, ay);
        noteEl.classList.toggle('is-left', leftSide);
        noteEl.style.left = sx + 'px'; noteEl.style.top = sy + 'px';
        noteEl.classList.add('on');
    }

    // ── input ──
    const alphas = new WeakMap();
    function hitPerson(ax, ay) {
        const wy = ay + Math.round(S.camY), wx = ax - OFFX;
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
    function hitWorld(ax, ay) { return J.hit(ax, ay - (B.Y0 - Math.round(S.camY)), S.t, S.stop); }
    function hitLadder(ax, ay) {
        const wx = ax - OFFX, wy = ay + Math.round(S.camY);
        return Math.abs(wx - L.LX) < 20 && wy > B.Y0 + B.F - 52 && wy < A.deckTop(2);
    }
    function stopAt(pl, t) {
        if (S.stop) return;
        S.stop = { id: pl.id, t0: t };
        S.hover = null; S.speech = null;
        go('bridge');
        render();
    }
    function go(where) { S.camT = CAM[where] != null ? CAM[where] : CAM.bridge; }
    view.addEventListener('click', e => {
        const [ax, ay] = toArt(e);
        const who = hitPerson(ax, ay);
        if (who) { speak(who); return; }
        const pl = hitWorld(ax, ay);
        if (pl) { if (!S.stop) stopAt(pl, S.t); else speak('cora'); return; }
        if (hitLadder(ax, ay)) { go(S.camT === CAM.lab ? 'bridge' : 'lab'); return; }
        if (S.camT === CAM.lab && ay < 60) go('bridge');
    });
    view.addEventListener('mousemove', e => {
        const [ax, ay] = toArt(e), who = hitPerson(ax, ay), pl = who ? null : hitWorld(ax, ay);
        S.hover = pl && !S.stop ? pl.id : null;
        view.classList.toggle('is-pointing', !!(who || pl || hitLadder(ax, ay)));
        view.title = hitLadder(ax, ay) && !who ? (S.camT === CAM.lab ? 'Up to the bridge' : 'Down the ladder') : '';
    });
    view.addEventListener('mouseleave', () => { S.hover = null; });
    view.addEventListener('wheel', e => { e.preventDefault(); go(e.deltaY > 0 ? 'lab' : 'bridge'); }, { passive: false });
    addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { go('lab'); e.preventDefault(); }
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') { go('bridge'); e.preventDefault(); }
    });

    // ── the clock ──
    function wrap() { if (!S.stop && S.t >= CREW.CYCLE) S.t -= CREW.CYCLE; }
    function frame(now) {
        const dt = S.last == null ? 16 : Math.min(100, now - S.last); S.last = now;
        if (S.playing) { S.t += dt; wrap(); }
        const k = 1 - Math.exp(-dt / 220);
        S.camY += (S.camT - S.camY) * k; if (Math.abs(S.camT - S.camY) < 0.3) S.camY = S.camT;
        render();
        requestAnimationFrame(frame);
    }
    window.bridge = {
        pause() { S.playing = false; render(); }, play() { S.playing = true; },
        step(ms = TICK) { S.playing = false; S.t += ms; wrap(); S.camY = S.camT; render(); },
        setTime(ms) { S.t = Math.max(0, ms); wrap(); S.camY = S.camT; render(); },
        stop(atMs) { const t = atMs == null ? S.t : atMs, pl = J.PLACES.find(p => J.inReach(p, t, null)); if (pl) { S.stop = { id: pl.id, t0: t }; render(); return pl.id; } return null; },
        resume() { S.stop = null; render(); },
        say: id => speak(id),
        go(where) { go(where); S.camY = S.camT; render(); },
        hover(id) { S.hover = id; render(); },
        people: () => CREW.at(S.t, S.stop).map(p => ({ id: p.id, deck: p.deck, x: p.x, y: p.y, act: p.act })),
        stats() { const f = S.frames.slice(-120), avg = f.reduce((a, b) => a + b, 0) / (f.length || 1); return { avgMs: +avg.toFixed(2), maxMs: +Math.max(0, ...f).toFixed(2), k: S.k, t: Math.round(S.t), stop: S.stop, cam: Math.round(S.camY) }; },
    };
    addEventListener('resize', resize);
    resize();
    if (q.has('deck')) { go(q.get('deck')); S.camY = S.camT; }
    if (q.has('t')) { S.t = Math.max(0, Number(q.get('t')) || 0); S.playing = false; }
    if (q.has('stop')) { const ts = Number(q.get('stop')) || 0, pl = J.PLACES.find(p => J.inReach(p, ts, null)); if (pl) S.stop = { id: pl.id, t0: ts }; }
    if (q.has('hover')) S.hover = q.get('hover');
    render();
    if (q.has('say')) { speak(q.get('say')); if (S.speech) S.speech.t0 = S.t - 400; render(); }
    if (q.has('probe')) {                                                        // a timing pass over a whole cycle, for checking: results in the title
        const out = [], errs = [];
        try { for (let t = 0; t < CREW.CYCLE; t += 250) { S.t = t; const a = performance.now(); render(); out.push(performance.now() - a); } }
        catch (err) { errs.push(String(err && err.stack || err)); }
        out.sort((a, b) => a - b);
        document.title = JSON.stringify({ n: out.length, median: +out[out.length >> 1].toFixed(2), p95: +out[Math.floor(out.length * 0.95)].toFixed(2), max: +out[out.length - 1].toFixed(2), errs });
        S.t = 0;
    }
    requestAnimationFrame(frame);
    // paint ahead: the lower decks, every size the worlds will show at, the crew's frames
    const bake = [() => A.deck(1), () => A.deck(2)].concat(J.bakeJobs());
    for (let t0 = 0; t0 < CREW.CYCLE; t0 += 2500) bake.push(() => { for (let t = t0; t < t0 + 2500; t += 115) CREW.at(t, null).forEach(p => spriteOf(p, lightFor(p))); });
    (function next() { const job = bake.shift(); if (!job) return; job(); setTimeout(next, 16); })();
})();
