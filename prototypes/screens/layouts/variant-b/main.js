/* ═══ Silent Exodus · layout variant B, "Nose up" · the page: camera, clocks, clicks ═════════════════════════════════
   The Lander flies nose up through the middle of the screen, cut open; the light is at the top; worlds come down past
   us on either side; the crew live inside. One picture, one art-pixel grid: the ship, the crew and space are all drawn
   into the same small canvas and scaled up whole, so nothing is "a panel beside the map".

   Two clocks. t (S.t) is the crew's clock: their routines (VoyageSim) are a pure function of it. J is the voyage clock:
   how far we have flown, in ms at cruise. While we fly, J = t. Clicking a world eases J to the moment that world is
   alongside and holds it there (orbit); the crew's clock runs on.

   DEBUG (still frames):  window.variantB.pause() / play() / step(ms) / setTime(ms) / cam(y) / say(id) / arrive(id)
                          / stats() / people()
                          URL: ?t=ms opens paused at that time · ?arrive=titan|chronos opens in orbit · ?px=N · ?clean=1
*/
(() => {
    'use strict';
    const A = window.ShipArt, SIM = window.VoyageSim, JY = window.Journey, V3 = window.V3Paint, L = A.L;
    const COLOR = { cora: '#9fd8e6', jaxon: '#f0a860', aris: '#e58ac8', vance: '#d8dde0', mira: '#e2c46a', aura: '#9fd8e6' };
    const ROWS = 540;                                                     // art rows we design for (1080 device rows at 2×)
    const q = new URLSearchParams(location.search);

    const view = document.getElementById('view'), vctx = view.getContext('2d');
    const art = document.createElement('canvas'), ctx = art.getContext('2d');
    const S = { t: 0, playing: true, last: null, state: 'voyage', camY: 0, camT: 0, cam0: 0, k: 2, dpr: 1, W: 0, H: 0, offX: 0,
        speech: null, orbit: null, hover: null, frames: [] };
    const ship = window.ShipView.create(S, ctx);
    let fr = null, f = null;

    // ── the screen: whole device pixels per art pixel; the ship in the middle ─────────────────────────────────────
    function resize() {
        S.dpr = window.devicePixelRatio || 1;
        const devW = Math.round(innerWidth * S.dpr), devH = Math.round(innerHeight * S.dpr);
        S.k = Number(q.get('px')) > 0 ? Math.round(Number(q.get('px'))) : Math.max(2, Math.floor(devH / ROWS));
        S.W = Math.ceil(devW / S.k); S.H = Math.ceil(devH / S.k);
        art.width = S.W; art.height = S.H;
        view.width = S.W * S.k; view.height = S.H * S.k;
        view.style.width = (S.W * S.k / S.dpr) + 'px'; view.style.height = (S.H * S.k / S.dpr) + 'px';
        S.offX = Math.round(S.W / 2 - L.CX);
        // the resting frame: the bottom of the nose cone, the bridge, the lab, and the top of the galley below
        // (a short window that cannot hold two decks frames the bridge alone)
        S.cam0 = clampCam(S.H >= 2 * L.PITCH + 40 ? A.deckTop(2) + 64 - S.H : A.deckTop(0) + L.PITCH / 2 - S.H / 2 + 8);
        S.camT = S.camY = S.cam0;
        fr = { W: S.W, H: S.H, offX: S.offX, hullL: S.offX + L.CX - L.HO - 10, hullR: S.offX + L.CX + L.HO + 10 };
        f = V3.framer(ctx, S.W, S.H);
        render();
    }
    const clampCam = y => Math.max(0, Math.min(L.H - S.H, y));

    // ── the voyage clock ───────────────────────────────────────────────────────────────────────────────────────────
    function journey(t) {
        const o = S.orbit;
        if (!o || t < o.tc) return { J: t, speed: 1 };
        const u = Math.min(1, (t - o.tc) / o.dur);
        return { J: o.J0 + o.dJ * (1 - (1 - u) ** 2), speed: 2 * o.dJ * (1 - u) / o.dur, settled: u >= 1, since: t - o.tc - o.dur };
    }
    const camShift = () => (S.camY - S.cam0) * 0.35;                       // worlds are nearer than the stars: a little parallax
    function placeOf(w, J) { const p = JY.place(w, J, fr); p.cy -= Math.round(camShift()); p.on = p.cy + p.r > -4 && p.cy - p.r < S.H + 4; return p; }
    function arrive(id, at) {
        const w = JY.WORLDS.find(x => x.id === id); if (!w || S.orbit) return false;
        const t = at == null ? S.t : at, J0 = journey(t).J, dt = JY.place(w, J0, fr).dt;
        if (dt > JY.PASS * 0.8) return false;                                  // already gone by
        const dJ = dt < -1500 ? -dt : 1500;
        S.orbit = { id, tc: t, J0, dJ, dur: Math.max(2600, Math.min(9000, 2 * dJ)) };
        S.speech = null;
        return true;
    }

    // ── what is said, one line at a time: a click wins; otherwise the voyage's own moments ───────────────────────
    const T = JY.WORLDS.find(w => w.id === 'titan'), C = JY.WORLDS.find(w => w.id === 'chronos');
    const MOMENTS = [
        { at: T.closest - JY.PASS + 7000, dur: 11000, who: 'aura', text: 'A dry world ahead, Commander. A ship beacon is still running down there.' },
        { at: T.closest - 3000, dur: 6500, who: 'mira', say: 'titan' },
        { at: T.closest + 9000, dur: 5000, who: 'jaxon', say: 'titan' },
        { at: C.closest - JY.PASS + 7000, dur: 6000, who: 'aura', text: 'An ice world ahead, Commander. Nothing on the scanner.' },
        { at: C.closest - 1000, dur: 6000, who: 'mira', say: 'chronos' },
    ];
    function currentLine(jy) {
        if (S.speech && S.t < S.speech.until) return S.speech;
        if (S.orbit) {
            if (jy.settled && jy.since < 8000) return { who: 'aura', text: SIM.line(S.state, 'cora', '', S.orbit.id).text };
            return null;
        }
        const Jm = ((jy.J % JY.CYCLE) + JY.CYCLE) % JY.CYCLE;
        const m = MOMENTS.find(x => Jm >= x.at && Jm < x.at + x.dur);
        if (!m) return null;
        return m.text ? { who: 'aura', text: m.text } : { who: m.who, text: SIM.line(S.state, m.who, m.say).text };
    }
    function speak(id) {
        const d = ship.drawn.find(p => p.id === id); if (!d) return false;
        const l = SIM.line(S.state, id, d.say, S.orbit && journey(S.t).settled ? S.orbit.id : null);
        if (!l.text) return false;
        S.speech = { who: id === 'cora' ? 'aura' : id, text: l.text, until: S.t + 3200 + l.text.length * 45 };
        render(); return true;
    }

    // ── one frame ───────────────────────────────────────────────────────────────────────────────────────────────
    function drawWorlds(jy, t) {
        const tick = Math.floor(t / V3.TICK);
        fr.discs = [];
        JY.WORLDS.forEach(w => {
            const p = placeOf(w, jy.J); if (!p.on) return;
            fr.discs.push([p.cx, p.cy, w.r]);
            const img = JY.paintWorld(w, fr), x0 = p.cx - w.r - img.pad, y0 = p.cy - w.r - img.pad;
            ctx.drawImage(img.canvas, x0, y0);
            const hot = S.hover === w.id || (S.orbit && S.orbit.id === w.id);
            if (hot) img.rims.forEach(([x, y, , lvl]) => { if (((x + y + tick) & 3) !== 0 || S.hover === w.id) f.tone(x0 + x, y0 + y, V3.RP.UI, Math.min(0.98, 0.5 + lvl * 0.1)); });
            if (w.beacon && (t % 2200) < 300) {                                    // the old ship's beacon: the one red light out there
                const bx = p.cx + Math.round(w.beacon[0] * w.r), by = p.cy + Math.round(w.beacon[1] * w.r);
                f.glow(bx, by, 6, V3.RP.RED, 0.42);
                f.px(bx - 1, by, '#e2574c', 3, 1); f.px(bx, by - 1, '#e2574c', 1, 3); f.px(bx, by, '#ffd2c8');
            } else if (w.beacon) { const bx = p.cx + Math.round(w.beacon[0] * w.r), by = p.cy + Math.round(w.beacon[1] * w.r); f.px(bx, by, '#8a2a22'); }
        });
    }
    function render() {
        if (!S.W) return;
        const t0 = performance.now(), t = S.t, jy = journey(t);
        f.reset();
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = A.INK; ctx.fillRect(0, 0, S.W, S.H);
        JY.drawSpace(ctx, fr, jy.J, S.camY - S.cam0);
        JY.drawLight(ctx, fr);
        JY.drawFar(ctx, fr, jy.J);
        drawWorlds(jy, t);
        JY.drawDust(f, fr, jy.J, jy.speed);
        f.reset();
        const line = currentLine(jy);
        ship.draw(t, SIM.at(S.state, t), { meal: false, auraTalking: !!line && line.who === 'aura', thrust: Math.min(1, jy.speed) });
        vctx.imageSmoothingEnabled = false;
        vctx.drawImage(art, 0, 0, S.W, S.H, 0, 0, S.W * S.k, S.H * S.k);
        placeSpeech(line);
        placeTags(jy);
        S.frames.push(performance.now() - t0); if (S.frames.length > 240) S.frames.shift();
    }

    // ── speech: over the speaker's head; A.U.R.A. speaks from her grille on the bridge ───────────────────────────
    const sayEl = document.getElementById('say');
    let shown = '';
    function placeSpeech(l) {
        if (!l) { sayEl.classList.remove('on'); shown = ''; return; }
        const k = S.k / S.dpr;
        let ax, ay;
        if (l.who === 'aura') { ax = 608; ay = A.floorY(0) - 150; }
        else { const d = ship.drawn.find(p => p.id === l.who); if (!d) { sayEl.classList.remove('on'); shown = ''; return; } ax = d.x; ay = ship.speechTop(d); }
        const key = l.who + l.text;
        if (key !== shown) {
            sayEl.querySelector('b').textContent = l.who === 'aura' ? 'A.U.R.A.' : SIM.NAMES[l.who];
            sayEl.querySelector('span').textContent = l.text;
            sayEl.style.setProperty('--who', COLOR[l.who]);
            sayEl.classList.toggle('aura', l.who === 'aura');
            sayEl.classList.remove('on'); void sayEl.offsetWidth; shown = key;
        }
        sayEl.classList.add('on');
        const bx = (ax + S.offX) * k, by = (ay - Math.round(S.camY)) * k - 8, half = Math.min(150, sayEl.offsetWidth / 2 || 150);
        sayEl.style.left = Math.max(half + 8, Math.min(innerWidth - half - 8, bx)) + 'px';
        sayEl.style.top = Math.max(sayEl.offsetHeight + 8, by) + 'px';
    }

    // ── a world's name, beside it on its dark side; the line and "click to stop" when the pointer is on it ───────
    const tags = {};
    JY.WORLDS.forEach(w => {
        const el = document.createElement('div');
        el.className = 'tag ' + (w.side < 0 ? 'left' : 'right');
        el.innerHTML = '<b></b><span class="line"></span><span class="act"></span>';
        el.querySelector('b').textContent = w.name;
        el.querySelector('.line').textContent = w.line;
        document.body.appendChild(el); tags[w.id] = el;
    });
    function placeTags(jy) {
        const k = S.k / S.dpr, settled = S.orbit && jy.settled;
        JY.WORLDS.forEach(w => {
            const el = tags[w.id], p = placeOf(w, jy.J), mine = S.orbit && S.orbit.id === w.id;
            const show = p.on && p.cy > 40 && p.cy < S.H - 30 && (!S.orbit || mine);
            el.classList.toggle('on', show);
            if (!show) return;
            el.classList.toggle('open', S.hover === w.id || !!settled);
            el.querySelector('.act').textContent = mine ? (settled ? 'In orbit' : 'Slowing down…') : 'Click to stop here';
            const y = (p.cy + w.r * 0.42) * k;
            if (w.side < 0) { el.style.left = '20px'; el.style.right = ''; }
            else { el.style.right = '20px'; el.style.left = ''; }
            el.style.top = Math.min(innerHeight - 90, y) + 'px';
            el.style.maxWidth = Math.max(160, (w.side < 0 ? fr.hullL : S.W - fr.hullR) * k - 40) + 'px';
        });
    }

    // ── input ───────────────────────────────────────────────────────────────────────────────────────────────────
    const toArt = e => [Math.floor(e.clientX * S.dpr / S.k), Math.floor(e.clientY * S.dpr / S.k)];
    function hitWorld(ax, ay) {
        if (ax > fr.hullL && ax < fr.hullR) return null;                      // the hull is in front of them
        const J = journey(S.t).J;
        for (const w of JY.WORLDS) { const p = placeOf(w, J); if (p.on && Math.hypot(ax - p.cx, ay - p.cy) < w.r + 4) return w.id; }
        return null;
    }
    view.addEventListener('click', e => {
        const [ax, ay] = toArt(e), who = ship.hitPerson(ax, ay);
        if (who) { speak(who); return; }
        const w = hitWorld(ax, ay);
        if (w) arrive(w);
    });
    view.addEventListener('mousemove', e => {
        const [ax, ay] = toArt(e), who = ship.hitPerson(ax, ay), w = who ? null : hitWorld(ax, ay);
        S.hover = w && !S.orbit ? w : null;
        view.classList.toggle('pointer', !!who || (!!w && !S.orbit));
    });
    view.addEventListener('mouseleave', () => { S.hover = null; });
    view.addEventListener('wheel', e => { e.preventDefault(); const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; S.camT = clampCam(S.camT + dy * 0.6); }, { passive: false });
    addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'PageDown') { S.camT = clampCam(S.camT + L.PITCH); e.preventDefault(); }
        else if (e.key === 'ArrowUp' || e.key === 'PageUp') { S.camT = clampCam(S.camT - L.PITCH); e.preventDefault(); }
        else if (e.key === 'Home') S.camT = S.cam0;
    });
    let touchY = null;
    view.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, { passive: true });
    view.addEventListener('touchmove', e => { if (touchY == null) return; const y = e.touches[0].clientY; S.camT = clampCam(S.camT + (touchY - y) * S.dpr / S.k); touchY = y; }, { passive: true });

    // ── the clock ───────────────────────────────────────────────────────────────────────────────────────────────
    function tick(now) {
        const dt = S.last == null ? 16 : Math.min(100, now - S.last); S.last = now;
        if (S.playing) S.t += dt;
        const kk = 1 - Math.exp(-dt / 170);
        S.camY += (S.camT - S.camY) * kk; if (Math.abs(S.camT - S.camY) < 0.3) S.camY = S.camT;
        render();
        requestAnimationFrame(tick);
    }
    window.variantB = {
        pause() { S.playing = false; render(); }, play() { S.playing = true; },
        step(ms = 125) { S.playing = false; S.t += ms; S.camY = S.camT; render(); },
        setTime(ms) { S.t = Math.max(0, ms); S.camY = S.camT; render(); },
        cam(y) { S.camT = clampCam(y); S.camY = S.camT; render(); },
        say: id => speak(id),
        arrive(id) { const ok = arrive(id); render(); return ok; },
        stats() { const fs = S.frames.slice(-120), avg = fs.reduce((a, b) => a + b, 0) / (fs.length || 1); return { avgMs: +avg.toFixed(2), maxMs: +Math.max(0, ...fs).toFixed(2), k: S.k, art: [S.W, S.H], cam: Math.round(S.camY), t: Math.round(S.t), J: Math.round(journey(S.t).J), orbit: S.orbit && S.orbit.id }; },
        people: () => SIM.at(S.state, S.t).map(p => ({ id: p.id, deck: p.deck, x: p.x, act: p.act })),
    };
    addEventListener('resize', resize);
    resize();
    if (q.has('t')) { S.t = Math.max(0, Number(q.get('t')) || 0); S.playing = false; }
    if (q.has('arrive')) { const at = Math.max(0, S.t - 12000); arrive(q.get('arrive'), at); }
    if (q.has('clean') || q.has('t')) document.body.classList.add('clean');
    if (q.has('debug')) {                                                     // for headless checks: warnings and stats into the page
        const out = document.createElement('pre'); out.id = 'debug'; out.hidden = true; document.body.appendChild(out);
        const report = extra => { out.textContent = JSON.stringify(Object.assign({ logs: window.__logs || [], stats: window.variantB.stats(), people: window.variantB.people() }, extra)); };
        if (q.get('debug') !== 'clicks') setTimeout(() => report({}), 400);
        else setTimeout(() => {                                              // real clicks through the real handlers
            const k = S.k / S.dpr, click = (ax, ay) => view.dispatchEvent(new MouseEvent('click', { clientX: (ax + 0.5) * k, clientY: (ay + 0.5) * k, bubbles: true }));
            const d = ship.drawn.find(p => p.id === 'mira'), before = sayEl.textContent;
            click(d.x + S.offX, Math.round(d.y - 60 - S.camY));
            const said = sayEl.textContent;
            const w = JY.WORLDS[0], p = placeOf(w, journey(S.t).J);
            click(Math.max(4, Math.round(fr.hullL / 2)), p.cy);
            const orbit = S.orbit && Object.assign({}, S.orbit);
            window.variantB.step(12000);
            report({ before, said, orbit, after: sayEl.textContent, tag: document.querySelector('.tag.on') && document.querySelector('.tag.on').textContent });
        }, 400);
    }
    render();
    requestAnimationFrame(tick);
    ship.warm(S.state);
})();
