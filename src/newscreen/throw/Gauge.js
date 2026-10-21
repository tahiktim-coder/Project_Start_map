/* ═══ Silent Exodus · new screen (?new=1) · throw/Gauge.js: the burn gauge of the jump into sector 3, in the new look ════
   What it is: WarpPlot's game, played by MiniHost as 'burn' in the travel view's look. Three burns: a marker sweeps the
   gauge, you lock it inside the bright window, each burn faster and tighter; the grades and what they do to the energy;
   A.U.R.A. can plot it. The rules are WarpPlot's own (window.WarpPlot.rules: the windows, the sweeps, the grades, who
   reacts): this file only draws them, so both looks play the same game. Its words are WarpPlot's.
   The picture (720 x 405 art px, density 1.5): the sky of sector 2, the light at the end of the heading, our Lander from
   outside with its nose on the light and its decks lit; every lock lights the drive (blue when clean, amber rough, red
   when missed) and the ship lurches; once the plot is set the drive burns full and every star stretches toward the light,
   and the frame closes into the travel view, where the jump goes on (throw/Stall.js). The gauge is an instrument low in
   the picture: a recessed track, the bright window in the drive's own blue, the rough margin in dull amber, a white needle.
   Every control is a glass tag (stop/TagArt.js: amber brackets, the ink shade, the helm's lit key plate; the words in the
   bridge's type): LOCK BURN (Space) as the lit key, LET A.U.R.A. PLOT IT beside it, the three burns over the gauge.
   Reduced motion: manual plotting needs the sweep, so as in WarpPlot only A.U.R.A. plots; no shake, no draw-in.
   Loaded only when the new-screen switch is on (index.html), after stop/TagArt.js; needs MiniHost, MiniLab, WarpPlot.

   const result = await MiniHost.play('burn', opts)
     opts      WarpPlot's (App.getPlotOptions(name, 'sector') and cost), plus relianceVoice { name, text } (optional):
               A.U.R.A.'s line on who flies, said after the crew's (it was on WarpPlot's arrival card)
     result    { grade: 'perfect' | 'clean' | 'rough' | 'bad', auto, isFirstPlot: false }   as WarpPlot.play's
   (The game's first plot, A.U.R.A. flying while you watch, is the old look's: the new look flies every hop.)
*/
(function () {
    'use strict';
    const MiniLab = window.MiniLab, MiniHost = window.MiniHost, WP = window.WarpPlot, P = window.NSPaint, TA = window.NSTagArt;
    if (!window.NEW_SCREEN || !MiniLab || !MiniHost || !WP || !WP.rules || !P || !TA) return;
    const R = WP.rules;
    const { INK, RP, clamp01, smooth, hash, threshold } = P;

    const DENSITY = 1.5, AW = 720, AH = 405, SC = AH / 360, TICK = 125;
    const LIGHT = { x: 612, y: 124, look: { core: 5 * SC, halo: 34 * SC, strength: 1, spikes: 7 * SC } };   // sector 2's light (travel/SectorLooks.js)
    const SHIP = { x: 216, y: 188, len: 176 };
    const GAUGE = { x0: 140, x1: 580, y: 334, h: 10 };
    const PIP_Y = 298, KEY_Y = 360;
    const ARM_MS = 170, STAGGER = 80, TYPE_MS = 26, TYPE_DELAY = 70, RING_STEPS = 4;
    const RESULT_AFTER_MS = 380, LINE_AFTER_MS = 260, READ_MS = 3200, AURA_READ_MS = 2900, DISSOLVE_MS = 320;
    const LUNGE = 4, SURGE = 46;                                                       // art px the ship lurches on a lock, surges on the flight
    // the lock's colour by grade: the drive's own blue when clean, amber rough, red when missed (DOM, then the canvas ramp)
    const TONE = { clean: { css: '#9fd8e6', ramp: 'ui', drive: RP.PLUME }, rough: { css: '#f0a050', ramp: 'warm', drive: RP.AMBER }, bad: { css: '#ff7a6a', ramp: '#e2574c', drive: RP.RED } };
    const NAMES = { perfect: 'clean', clean: 'clean', rough: 'rough', bad: 'bad' };
    const HINT = 'A long jump: three burns, each faster. Lock every one inside the bright window — all three clean gives the most fuel back.';   // WarpPlot's
    const isCalm = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // ════════════════════════════════════ the still pictures, painted once and kept ════════════════════════════════════
    let BACK = null;
    /** Sector 2's sky (its strip, its light) slice, darker along the bottom where the gauge sits. */
    function backdrop() {
        if (BACK) return BACK;
        const p = P.painter(AW, AH, true), strip = P.spaceStrip(AW, AH, 22, 0.1, 0.62, 1.5), L = LIGHT.look, lit = new Float32Array(AW * AH);
        for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) lit[y * AW + x] = Math.exp(-Math.hypot(x - LIGHT.x, (y - LIGHT.y) * 1.15) / (L.halo * 0.85 + 6));
        const keep = L.halo * 0.9 + L.core + 8;
        const bright = P.paintSpace(p, strip, 0, lit, (x, y) => Math.hypot(x - LIGHT.x, y - LIGHT.y) < keep);
        P.lightGlow(p, LIGHT.x, LIGHT.y, L);
        const ink = P.hexRgb(INK);
        p.region(0, 262, AW, AH, (x, y) => { if (threshold(x, y) < 0.9 * smooth(262, 330, y)) p.set(x, y, ink); });   // the instrument's ground
        BACK = { canvas: p.canvas(), bright: bright.filter(s => s.y < 258) };
        return BACK;
    }
    const ships = new Map();
    /** Our Lander from outside, as the travel view paints it (Pictures.landerSprite): NSPaint.hull with shapeL. */
    function shipSprite(len, angle) {
        const key = len + ':' + angle.toFixed(3);
        if (ships.has(key)) return ships.get(key);
        const ht = Math.round(len / 3.15 * 10) / 10, half = Math.ceil(len / 2 + ht + 8), p = P.painter(half * 2, half * 2, false);
        const sa = Math.atan2(LIGHT.y - SHIP.y, LIGHT.x - SHIP.x);
        const at = P.hull(p, { x: half, y: half, len, ht, angle, flip: true, seed: 9, anchor: 0.5, sun: len < 80 ? 0.24 : 0.32, sunDir: [Math.cos(sa), Math.sin(sa)], fade: 0.22, mirror: false, flat: len < 130 }, P.shapeL);
        const rel = q => [q[0] - half, q[1] - half];
        const out = { canvas: p.canvas(), half, ports: [0, 1, 2, 3, 4, 5].map(i => rel(at(P.DECK_U(i) + 0.054, -0.32))), bridge: rel(at(P.LANDER.NOSE - 0.02, -0.12)),
            bell: rel(at(1.0, 0)), clamp: rel(at(P.DECK_U(4) + 0.05, 0.56 + 1.2 / ht)), skirt: [0.87, 0.89, 0.91, 0.93].map(u => rel(at(u, 0.6))) };
        ships.set(key, out);
        return out;
    }

    // ════════════════════════════════════ the DOM half of a glass tag ════════════════════════════════════
    // The bridge's tags (stop/Tags.js) in the gauge's own layer: the words in the bridge's type, their box a whole number of
    // art px so the brackets drawn in the picture sit exactly round them. The two controls are real buttons.
    const PAD = Object.freeze({ key: [15, 4, 7, 4], act: [16, 3, 7, 3], pip: [6, 3, 6, 3], title: [6, 4, 8, 4] });
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    function style() {
        if (document.getElementById('gg-style')) return;
        const st = document.createElement('style');
        st.id = 'gg-style';
        st.textContent = `.mini-host .gg-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none;
    --gg-fs: calc(13px + 2px * var(--t, 1)); --gg-chip: calc(12px + 1px * var(--t, 1)); --gg-f-ui: 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; --gg-f-num: 'IBM Plex Mono', ui-monospace, Consolas, monospace; }
.mini-host .gg-tag { position: absolute; left: 0; top: 0; box-sizing: border-box; margin: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left;
    white-space: nowrap; opacity: 0; pointer-events: none; text-shadow: 0 1px 0 #05070a; transition: opacity 180ms steps(3, end); }
.mini-host .gg-tag.on { opacity: 1; }
.mini-host button.gg-tag.on:not([disabled]) { pointer-events: auto; cursor: pointer; }
.mini-host button.gg-tag:focus { outline: none; }
.mini-host .gg-in { display: inline-grid; gap: 3px; justify-items: start; }
.mini-host .gg-l { font: 600 var(--gg-fs)/1 var(--gg-f-ui); letter-spacing: .16em; text-transform: uppercase; color: #f0a050; transition: color 120ms steps(2, end); }
.mini-host .gg-l .gg-r { visibility: hidden; }
.mini-host .gg-l .gg-k { display: inline-block; width: .5em; height: .9em; margin-right: -.5em; vertical-align: -.08em; background: currentColor; }
.mini-host .gg-tag.is-hot .gg-l { color: #ffd8a0; }
.mini-host .gg-tag.is-cool .gg-l { color: #a9b6bc; }
.mini-host .gg-tag.is-cool.is-hot .gg-l { color: #e6ecee; }
.mini-host .gg-tag.is-faint .gg-l { color: #5a6168; }
.mini-host .gg-tag[disabled] .gg-l { color: #6b7a82; letter-spacing: .12em; }
.mini-host .gg-tag.is-key .gg-in { grid-auto-flow: column; align-items: baseline; gap: 10px; }
.mini-host .gg-cs { display: flex; gap: 2px 10px; font: 500 var(--gg-chip)/1.15 var(--gg-f-ui); letter-spacing: .03em; color: #8b8d90; }
.mini-host .gg-c { display: inline-flex; align-items: center; gap: 5px; }
.mini-host .gg-c i { flex: none; width: 10px; height: 10px; background: center / 100% 100% no-repeat; image-rendering: pixelated; }
.mini-host .gg-c kbd { font: 400 calc(var(--gg-chip) - 1px)/1 var(--gg-f-num); letter-spacing: .06em; color: #c9a37a; }
.mini-host .gg-c.is-gain { color: #ffc27a; } .mini-host .gg-c.is-loss { color: #ff7a6a; } .mini-host .gg-c.is-cool { color: #a9b6bc; }
.mini-host .gg-tag.is-typing .gg-cs { opacity: 0; }
@media (prefers-reduced-motion: reduce) { .mini-host .gg-tag, .mini-host .gg-l { transition: none; } }`;
        document.head.appendChild(st);
    }
    function makeTag(layer, kind, isButton) {
        const el = document.createElement(isButton ? 'button' : 'div'), inner = document.createElement('div');
        if (isButton) el.type = 'button';
        el.className = 'gg-tag is-' + kind; inner.className = 'gg-in'; el.appendChild(inner); layer.appendChild(el);
        const pad = PAD[kind];
        const tag = { el, kind, w: 0, h: 0, x: 0, y: 0, key: '', text: '', sized: '', on: false, shownAt: -1e9, typed: -1, hot: false };
        let label = null;
        tag.set = o => {
            const chips = (o.chips || []).map(c => `<span class="gg-c${c.tone ? ' is-' + c.tone : ''}">${c.icon ? `<i style="background-image:url(${TA.chipURL(c.icon, c.tone === 'gain' ? 'warm' : 'cool')})"></i>` : ''}${c.kbd ? `<kbd>${esc(c.kbd)}</kbd>` : esc(c.text)}</span>`).join('');
            const key = (o.label || '') + '|' + chips;
            if (key === tag.key) return false;
            tag.key = key; tag.sized = '';
            inner.innerHTML = `<b class="gg-l"></b>${chips ? `<span class="gg-cs">${chips}</span>` : ''}`;
            label = inner.querySelector('.gg-l');
            tag.text = String(o.label || '').toUpperCase();
            label.textContent = tag.text; tag.typed = tag.text.length;
            if (o.aria) el.setAttribute('aria-label', o.aria);
            return true;
        };
        /** The box in art px at `unit` CSS px per art px (measured once per text and size). */
        tag.size = unit => {
            const k = unit.toFixed(4) + ':' + tag.key;
            if (tag.sized === k) return [tag.w, tag.h];
            el.style.width = ''; el.style.height = ''; el.style.padding = '0';
            const w = inner.offsetWidth, h = inner.offsetHeight;
            tag.w = pad[0] + Math.ceil(w / unit - 0.02) + pad[2];
            tag.h = pad[1] + Math.ceil(h / unit - 0.02) + pad[3];
            el.style.padding = `${pad[1] * unit}px ${pad[2] * unit}px 0 ${pad[0] * unit}px`;
            el.style.width = (tag.w * unit) + 'px'; el.style.height = (tag.h * unit) + 'px';
            tag.sized = k;
            return [tag.w, tag.h];
        };
        tag.place = (x, y, unit) => { tag.x = x; tag.y = y; el.style.transform = `translate(${Math.round(x * unit)}px, ${Math.round(y * unit)}px)`; };
        tag.show = (on, at) => {
            if (!!on === tag.on) return;
            tag.on = !!on;
            if (on) { tag.shownAt = at == null ? performance.now() : at; tag.typed = -1; el.classList.add('is-typing'); }
            else { el.classList.remove('on'); tag.hot = false; el.classList.remove('is-hot'); }
        };
        /** Each frame: seen once its turn has come; the label types on (its room kept, a block cursor at the end). */
        tag.type = (now, still) => {
            if (!tag.on) return;
            if (!el.classList.contains('on') && (still || now >= tag.shownAt)) el.classList.add('on');
            if (!label) return;
            const n = still ? tag.text.length : Math.max(0, Math.min(tag.text.length, Math.floor((now - tag.shownAt - TYPE_DELAY) / TYPE_MS)));
            if (n === tag.typed) return;
            tag.typed = n;
            if (n >= tag.text.length) { label.textContent = tag.text; el.classList.remove('is-typing'); return; }
            label.innerHTML = `${esc(tag.text.slice(0, n))}<span class="gg-k"></span><span class="gg-r">${esc(tag.text.slice(n))}</span>`;
        };
        tag.flag = (cls, on) => el.classList.toggle(cls, !!on);
        return tag;
    }

    // ════════════════════════════════════ the game ════════════════════════════════════
    function mount(ctx, ui, opts0) {
        const opts = Object.assign({ mode: 'sector' }, opts0 || {});
        style();
        const cv = ui.canvas, screen = cv.parentElement, still = isCalm(), burns = R.burnsOf(opts), base = R.baseDifficulty(opts);
        const layer = document.createElement('div'); layer.className = 'gg-layer'; screen.appendChild(layer);
        layer.style.setProperty('--t', String(clamp01((innerWidth - 1280) / 640)));
        const sky = backdrop(), angle = Math.atan2(LIGHT.y - SHIP.y, LIGHT.x - SHIP.x), ship = shipSprite(SHIP.len, angle);
        const shuttle = shipSprite(Math.max(6, Math.round(SHIP.len * 0.18)), angle);
        const streaks = P.pixelLayer(AW, AH), scratch = document.createElement('canvas'); scratch.width = AW; scratch.height = 80;
        const startedAt = performance.now();
        const s = {
            diff: R.stageDifficulty(base, 0), pos: 0, locks: [], lockAt: [], grade: null, auto: false, flightStart: 0, lastLockAt: -1e9,
            stageStart: startedAt, resultAt: 0, done: false,
        };
        let frameId = null, unit = 0, timers = [], gaugeBox = null;
        const later = (ms, fn) => { timers.push(setTimeout(() => { if (!s.done) fn(); }, ms)); };

        // ── the tags ──
        const pips = Array.from({ length: burns }, () => makeTag(layer, 'pip', false));
        const lockTag = makeTag(layer, 'key', true), auraTag = makeTag(layer, 'act', true), resultTag = makeTag(layer, 'title', false);
        pips.forEach((tg, i) => tg.set({ label: 'BURN ' + (i + 1) }));
        if (still) { lockTag.set({ label: 'MANUAL PLOT NEEDS MOTION' }); lockTag.el.disabled = true; }
        else lockTag.set({ label: 'LOCK BURN', chips: [{ kbd: 'SPACE' }], aria: 'Lock burn (Space)' });
        auraTag.set({ label: 'LET A.U.R.A. PLOT IT' });
        auraTag.flag('is-cool', true);
        [lockTag, auraTag].forEach(tg => {
            const on = v => () => { tg.hot = v && !tg.el.disabled; tg.flag('is-hot', tg.hot); };
            tg.el.addEventListener('pointerenter', on(true)); tg.el.addEventListener('pointerleave', on(false));
            tg.el.addEventListener('focus', on(true)); tg.el.addEventListener('blur', on(false));
            tg.el.addEventListener('pointerdown', e => e.preventDefault());                  // a click keeps the focus on the picture: Space still locks
        });
        lockTag.el.addEventListener('click', () => lockBurn());
        auraTag.el.addEventListener('click', () => fly('rough', true));
        const t0 = performance.now();
        pips.forEach((tg, i) => tg.show(true, t0 + (still ? 0 : i * STAGGER)));
        lockTag.show(true, t0 + (still ? 0 : (burns + 1) * STAGGER));
        auraTag.show(true, t0 + (still ? 0 : (burns + 2) * STAGGER));
        ui.say('', HINT);
        /** The burns over the gauge: the one to lock now bright, the ones to come faint, a locked one in its lock's colour. */
        function pipFlags(now) {
            const current = s.grade ? -1 : now - s.lastLockAt < R.LOCK_PAUSE_MS ? s.locks.length - 1 : s.locks.length;
            pips.forEach((tg, i) => { const done = i < s.locks.length; tg.flag('is-hot', !done && i === current); tg.flag('is-faint', !done && i !== current); });
        }

        function layout() {
            const u = cv.clientWidth / AW;
            if (!(u > 0)) return;
            unit = u;
            const third = (GAUGE.x1 - GAUGE.x0) / burns;
            pips.forEach((tg, i) => { const [w] = tg.size(u); tg.place(Math.round(GAUGE.x0 + third * (i + 0.5) - w / 2), PIP_Y, u); });
            const [kw, kh] = lockTag.size(u), [aw, ah] = auraTag.size(u);
            lockTag.place(Math.round(AW / 2 - kw / 2), KEY_Y, u);
            auraTag.place(GAUGE.x1 - aw, KEY_Y + Math.round((kh - ah) / 2), u);
            const [rw, rh] = resultTag.size(u);
            resultTag.place(Math.round(AW / 2 - rw / 2), Math.round(GAUGE.y + GAUGE.h / 2 - rh / 2) + 4, u);   // where the gauge was
            gaugeBox = [GAUGE.x0 - 8, GAUGE.y - 12, GAUGE.x1 - GAUGE.x0 + 17, GAUGE.h + 22];
        }

        // ── the rules (WarpPlot's) ──
        function lockBurn() {
            const now = performance.now();
            if (still || s.grade || now - s.lastLockAt < R.LOCK_PAUSE_MS || s.locks.length >= burns) return;
            const result = R.lockGrade(s.pos, s.diff), index = s.locks.length;
            s.locks.push(result); s.lockAt.push(now);
            s.lastLockAt = now;
            pips[index].set({ label: R.LOCK[result].word });
            pips[index].el.querySelector('.gg-l').style.color = TONE[result].css;
            const sfx = window.AudioSystem;                                                  // WarpPlot's lock tone (silent when muted)
            if (sfx && typeof sfx.playTone === 'function') { const tone = { clean: [880, 'sine', 0.14], rough: [440, 'triangle', 0.14], bad: [150, 'sawtooth', 0.22] }[result]; try { sfx.playTone(...tone); } catch (err) { /* no audio */ } }
            if (s.locks.length === burns) { later(R.LOCK_PAUSE_MS, () => fly(R.finalGrade(s.locks), false)); return; }
            later(R.LOCK_PAUSE_MS, () => {                                                    // the next burn: a new window, a faster sweep
                s.diff = R.stageDifficulty(base, s.locks.length);
                s.stageStart = performance.now();
            });
        }
        function fly(grade, isAuto) {
            if (s.grade) return;
            s.grade = grade; s.auto = isAuto;
            s.flightStart = performance.now();
            lockTag.show(false); auraTag.show(false);
            lockTag.el.disabled = true; auraTag.el.disabled = true;
            try { cv.focus({ preventScroll: true }); } catch (err) { /* nothing to focus */ }
            const sfx = window.AudioSystem, cue = grade === 'perfect' ? 'sfxDiscovery' : grade === 'bad' ? 'sfxWarn' : 'sfxWarp';
            if (sfx && typeof sfx[cue] === 'function') { try { sfx[cue](); } catch (err) { /* no audio */ } }
            const info = R.GRADES[grade], label = isAuto ? 'A.U.R.A. PLOT' : info.label, effect = R.effectText(grade, opts.cost);
            const delta = WP.energyDelta(grade, opts.cost || 0);
            later(RESULT_AFTER_MS, () => {
                resultTag.set({ label, chips: [{ icon: 'energy', text: effect, tone: delta > 0 ? 'gain' : delta < 0 ? 'loss' : 'cool' }] });
                resultTag.flag('is-cool', isAuto || grade === 'rough');
                resultTag.el.querySelector('.gg-l').style.color = isAuto ? '' : TONE[NAMES[grade]].css;
                layout();
                resultTag.show(true);
                s.resultAt = performance.now();
            });
            const line = R.pickLine(isAuto ? 'auto' : grade, opts.crew || []), aura = opts.relianceVoice;
            if (line) later(RESULT_AFTER_MS + LINE_AFTER_MS, () => ui.say(line.name, line.text));
            const readLine = RESULT_AFTER_MS + LINE_AFTER_MS + READ_MS;
            if (aura && aura.text) {
                later(readLine, () => ui.say(aura.name || 'A.U.R.A.', aura.text));
                later(readLine + AURA_READ_MS, finish);
            } else later(readLine, finish);
        }
        function finish() {
            if (s.done) return;
            s.done = true;
            ui.finish({ grade: s.grade, auto: s.auto, isFirstPlot: false });
        }

        // ── drawing (art px) ──
        function frame(now) {
            frameId = null;
            if (s.done && !cv.isConnected) return;
            const sweeping = !s.grade && now - s.lastLockAt >= R.LOCK_PAUSE_MS && s.locks.length < burns && !still;
            if (sweeping) {                                                                   // ping-pong, as WarpPlot
                const phase = ((now - s.stageStart) % (s.diff.period * 2)) / s.diff.period;
                s.pos = phase <= 1 ? phase : 2 - phase;
            }
            if (cv.clientWidth / AW !== unit) layout();
            try { MiniLab.inArt(ctx, g => draw(g, now)); } catch (err) { console.error('NSGauge: a frame failed', err); }
            pipFlags(now);
            [...pips, lockTag, auraTag, resultTag].forEach(tg => tg.type(now, still));
            frameId = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        }
        function draw(g, now) {
            const t = now - startedAt, f = P.framer(g, AW, AH), fl = s.flightStart ? clamp01((now - s.flightStart) / R.FLIGHT_MS) : 0;
            const shake = s.grade === 'bad' && s.flightStart && !still ? Math.round(Math.sin(now / 22) * 2 * (1 - fl)) : 0;
            g.imageSmoothingEnabled = false;
            g.setTransform(1, 0, 0, 1, 0, shake);
            g.drawImage(sky.canvas, 0, 0);
            if (fl < 0.2) P.twinkle(f, sky.bright, t); f.reset();
            if (fl > 0) stretch(g, fl);
            drawShip(g, f, now, t, fl);
            g.setTransform(1, 0, 0, 1, 0, 0);
            const off = s.flightStart ? 1 - smooth(0, DISSOLVE_MS, now - s.flightStart) : 1;
            if (off > 0) gauge(g, now, off);
            drawTags(g, now);
        }
        /** Once the plot is set, every bright star stretches toward the light (the travel view's jump), the sky darkening a little. */
        function stretch(g, fl) {
            const k = 6 * smooth(0.05, 1, fl), Ld = Math.min(6, Math.floor(k));
            if (Ld > 0) { g.fillStyle = INK; g.globalAlpha = Ld / 40; g.fillRect(0, 0, AW, 262); g.globalAlpha = 1; }
            streaks.clear();
            sky.bright.forEach(st => {
                const dx = LIGHT.x - st.x, dy = LIGHT.y - st.y, d = Math.hypot(dx, dy) || 1, len = Math.min(d - 6, k * k * 2.6 * SC * (0.5 + st.mag));
                for (let i = 0; i < len; i++) streaks.tone(st.x + dx / d * i, st.y + dy / d * i, RP.STAR, (0.45 + 0.5 * st.mag) * (1 - i / len));
            });
            streaks.draw(g);
        }
        /** Our Lander: lurching on each lock, surging once the plot is set; its drive flares in the lock's colour. */
        function drawShip(g, f, now, t, fl) {
            const frame4 = Math.floor(t / TICK) % 4, bob = still ? 0 : Math.round(1.2 * Math.sin(Math.floor(t / TICK) * TICK / 900));
            const ca = Math.cos(angle), sa = Math.sin(angle), lastAt = s.lockAt[s.lockAt.length - 1], since = lastAt ? now - lastAt : 1e9;
            const lurch = s.lockAt.length * LUNGE * (still ? 0 : 1) - (since < 420 && !still ? LUNGE * (1 - smooth(0, 420, since)) : 0);
            const surge = still ? 0 : SURGE * fl * fl, along = lurch + surge;
            const cx = Math.round(SHIP.x + ca * along), cy = Math.round(SHIP.y + sa * along + bob);
            // the drive: idle low; a flare in the lock's colour; full once the plot is set
            const lastGrade = s.locks[s.locks.length - 1], flare = since < 520 ? 1 - since / 520 : 0;
            const lvl = s.flightStart ? 1.2 + 2.2 * smooth(0, 0.5, fl) : 0.55 + 1.8 * flare;
            const tone = s.flightStart ? RP.PLUME : flare > 0.15 && lastGrade ? TONE[lastGrade].drive : RP.PLUME;
            const sp = ship, sz = SHIP.len / 48, bx = cx + sp.bell[0], by = cy + sp.bell[1];
            for (let i = 0; i < 9; i++) { const age = ((t / 1000) * 0.8 + hash(i, 1, 57)) % 1, dist = (14 + age * 40) * sz, side = (hash(i, 2, 57) - 0.5) * age * 9 * sz; f.tone(bx - ca * dist - sa * side, by - sa * dist + ca * side, RP.PLUME, 0.62 * (1 - age) * Math.min(1, lvl)); }
            g.drawImage(shuttle.canvas, cx + sp.clamp[0] - shuttle.half, cy + sp.clamp[1] - shuttle.half);
            g.drawImage(sp.canvas, cx - sp.half, cy - sp.half);
            f.reset();
            const flick = still ? 1 : [1, 0.72, 1.16, 0.88][frame4], heat = still ? 1 : [1, 0.86, 1, 0.92][frame4], len = (6 + 19 * lvl) * sz * flick, w0 = Math.max(1, 1.8 * sz * (0.8 + 0.2 * Math.min(lvl, 2)));
            for (let d = 0; d < len; d++) {
                const hw = w0 * (1 - (d / len) * 0.6);
                for (let k = -Math.ceil(hw); k <= Math.ceil(hw); k++) { const u = Math.abs(k) / (hw + 0.01), v = (1 - d / len) ** 0.8 * (1 - u * u) * heat; if (v > 0.06) f.tone(bx - ca * d - sa * k, by - sa * d + ca * k, tone, v); }
            }
            sp.skirt.forEach(([x, y], i) => { if ((i + frame4) % 2 === 0 || lvl > 1) f.tone(cx + x, cy + y, RP.PLUME, 0.4 + 0.15 * Math.min(lvl, 2)); });
            sp.ports.forEach(([px, py], i) => {                                               // the decks lit: everyone is aboard
                if (i === 0) return;                                                          // the bridge has its ring of windows instead
                const x = Math.round(cx + px - 0.5), y = Math.round(cy + py - 0.5);
                f.px(x, y, RP.AMBER.hex[4], 2, 2); f.px(x, y, RP.AMBER.hex[5]);
            });
            f.px(cx + sp.bridge[0], cy + sp.bridge[1], RP.AMBER.hex[4], 2, 1);
            f.reset();
        }
        /** The gauge: a recessed track with ticks; the rough margin dull amber, the window the drive's blue with a soft halo; a
            white needle (frozen in the lock's colour a moment after each lock, a ring going out from it); dissolved by `k`. */
        function gauge(g0, now, k) {
            const sg = scratch.getContext('2d'), Y0 = GAUGE.y - 30;                         // drawn into a strip, then dithered onto the picture
            sg.clearRect(0, 0, AW, scratch.height);
            const f = P.framer(sg, AW, scratch.height), y = GAUGE.y - Y0, h = GAUGE.h, X0 = GAUGE.x0, X1 = GAUGE.x1, px = v => Math.round(X0 + v * (X1 - X0)), d = s.diff;
            for (let x = X0 - 2; x <= X1 + 2; x++) { f.tone(x, y - 2, RP.UI, 0.32); f.tone(x, y + h + 1, RP.UI, 0.18); }   // the bezel: lit along its top
            f.tone(X0 - 2, y - 1, RP.UI, 0.3, 1, h + 2); f.tone(X1 + 2, y - 1, RP.UI, 0.2, 1, h + 2);
            sg.fillStyle = INK; sg.fillRect(X0 - 1, y - 1, X1 - X0 + 3, h + 2);
            for (let x = X0; x <= X1; x++) for (let yy = 0; yy < h; yy++) f.tone(x, y + yy, RP.UI, 0.07 + (yy === 0 ? 0.06 : 0));
            for (let i = 0; i <= 20; i++) { const x = px(i / 20), major = i % 5 === 0; f.tone(x, y - 4 - (major ? 3 : 1), RP.UI, major ? 0.5 : 0.3, 1, major ? 3 : 1); }
            if (gaugeBox) TA.brackets(sg, gaugeBox[0], gaugeBox[1] - Y0, gaugeBox[2], gaugeBox[3], s.grade ? 'cool' : 'warm', 1, false);   // the instrument the key acts on
            if (d && !s.grade) {
                const rough = d.win * R.ROUGH_FACTOR, ra = px(d.center - rough / 2), rb = px(d.center + rough / 2), wa = px(d.center - d.win / 2), wb = Math.max(wa + 2, px(d.center + d.win / 2));
                for (let x = ra; x < rb; x++) for (let yy = 0; yy < h; yy++) f.tone(x, y + yy, RP.AMBER, 0.24 + (yy === 0 ? 0.08 : 0));
                for (let x = wa; x < wb; x++) {
                    for (let yy = 0; yy < h; yy++) f.tone(x, y + yy, RP.PLUME, 0.7 + (yy < 2 ? 0.24 : 0) - (yy > h - 3 ? 0.12 : 0));
                    for (let j = 1; j <= 4; j++) { f.tone(x, y - 1 - j, RP.PLUME, 0.42 - j * 0.09); f.tone(x, y + h + j - 1, RP.PLUME, 0.34 - j * 0.08); }
                }
            }
            // the needle
            const last = s.locks[s.locks.length - 1], since = now - s.lastLockAt, frozen = since < R.LOCK_PAUSE_MS || !!s.grade, mx = px(s.pos);
            const col = frozen && last ? TA.ramp(TONE[last].ramp) : ['#9aa8ae', '#dde6e8', '#f2fbff', '#ffffff'];
            sg.fillStyle = INK; sg.fillRect(mx - 2, y - 9, 6, h + 15);
            sg.fillStyle = col[2]; sg.fillRect(mx, y - 7, 2, h + 11);
            sg.fillStyle = col[3]; sg.fillRect(mx - 1, y - 9, 4, 2); sg.fillRect(mx, y - 7, 2, 1);
            if (last && since < R.LOCK_PAUSE_MS && !still) {                                  // a ring goes out from the needle, in steps
                const step = Math.floor(since / (R.LOCK_PAUSE_MS / RING_STEPS)), r = 4 + step * 5, ramp = TA.ramp(TONE[last].ramp);
                for (let a = 0; a < 64; a++) { const th = a / 64 * Math.PI * 2, x = Math.round(mx + 0.5 + Math.cos(th) * r * 1.6), yy = Math.round(y + h / 2 + Math.sin(th) * r * 0.7); if ((1 - step / RING_STEPS) > threshold(x, yy)) { sg.fillStyle = ramp[step < 2 ? 2 : 1]; sg.fillRect(x, yy, 1, 1); } }
            }
            if (k >= 1) { g0.drawImage(scratch, 0, Y0); return; }
            const n = Math.round(clamp01(k) * 16);                                            // dissolved in Bayer steps (the house fade)
            if (n <= 0) return;
            sg.globalCompositeOperation = 'destination-in'; sg.fillStyle = sg.createPattern(maskTile(n), 'repeat'); sg.fillRect(0, 0, AW, scratch.height); sg.globalCompositeOperation = 'source-over';
            g0.drawImage(scratch, 0, Y0);
        }
        /** The tags' picture half: the ink shade, the brackets drawing in from the corners, the lit key plate, the icons. */
        function drawTags(g, now) {
            const arm = tg => (still ? 1 : clamp01((now - tg.shownAt) / ARM_MS));
            pips.forEach((tg, i) => {
                if (!tg.on || now < tg.shownAt) return;
                const res = s.locks[i], cur = !res && i === s.locks.length && !s.grade, k = arm(tg);
                TA.shade(g, tg.x, tg.y, tg.w, tg.h, Math.min(1, k * 1.6));
                const pulse = cur && !still && Math.floor(now / (TICK * 4)) % 2 === 0;
                TA.brackets(g, tg.x, tg.y, tg.w, tg.h, res ? TONE[res].ramp : cur ? 'warm' : 'cool', k, cur && pulse);
            });
            if (lockTag.on && now >= lockTag.shownAt) TA.key(g, lockTag.x, lockTag.y, lockTag.w, lockTag.h, { hot: lockTag.hot, next: !still, t: now, still });
            if (lockTag.on && now >= lockTag.shownAt) TA.icon(g, 'light', lockTag.x + 4, lockTag.y + Math.floor((lockTag.h - 9) / 2), still ? 'cool' : 'warm', lockTag.hot ? 1 : 0);
            if (auraTag.on && now >= auraTag.shownAt) {
                const k = arm(auraTag);
                TA.shade(g, auraTag.x, auraTag.y, auraTag.w, auraTag.h, Math.min(1, k * 1.6));
                TA.brackets(g, auraTag.x, auraTag.y, auraTag.w, auraTag.h, 'cool', k, auraTag.hot);
                if (k > 0.4) TA.icon(g, 'ring', auraTag.x + 4, auraTag.y + Math.floor((auraTag.h - 9) / 2), 'cool', auraTag.hot ? 1 : 0);
            }
            if (resultTag.on) {
                const k = arm(resultTag), tone = s.auto ? 'cool' : TONE[NAMES[s.grade]].ramp;
                TA.shade(g, resultTag.x, resultTag.y, resultTag.w, resultTag.h, Math.min(1, k * 1.6));
                TA.brackets(g, resultTag.x, resultTag.y, resultTag.w, resultTag.h, tone, k, true);
            }
        }

        MiniLab.onKey((key, e) => {
            if (key !== ' ') return;
            if (e && e.target instanceof HTMLButtonElement && layer.contains(e.target)) return;   // a focused tag takes its own Space
            lockBurn();
        });
        layout();
        frameId = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        cv.style.cursor = 'default';
        return () => {
            s.done = true;
            timers.forEach(clearTimeout); timers = [];
            if (frameId != null) (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(frameId);
            frameId = null;
            layer.remove();
            cv.style.cursor = '';
        };
    }

    const masks = new Map();
    /** An 8 x 8 tile that keeps the pixels whose Bayer threshold is under n / 16. */
    function maskTile(n) {
        if (masks.has(n)) return masks.get(n);
        const c = document.createElement('canvas'); c.width = c.height = 8;
        const g = c.getContext('2d'); g.fillStyle = '#000';
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (threshold(x, y) < n / 16) g.fillRect(x, y, 1, 1);
        masks.set(n, c);
        return c;
    }

    MiniHost.register({
        id: 'burn',
        title: 'Plot course',                                                                // WarpPlot's own name for it (its aria-label): never on screen (the header is hidden), it names the dialog for screen readers
        kicker: 'Sector jump',
        hideHeader: true,                                                                    // a pilot sees the burn, not a game title over it
        density: DENSITY,
        mount,
        autoResult: () => ({ grade: 'rough', auto: true, isFirstPlot: false }),
    });
})();
