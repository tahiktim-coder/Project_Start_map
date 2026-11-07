/* ═══ Silent Exodus · new screen (?new=1) · start/LaunchFilm.js: the opening film, the launch ═════════════════════════
   What it is: the opening of a new game under the switch, instead of the old briefing film (docs/BUILD_B.md §6): a news
   broadcast from the launch yard, 42.5 s, six shots (start/LaunchArt.js), the broadcast's own small graphics (LIVE, the
   programme's name, the three lines, the last three seconds of the count) and, only when the game's sound is on, a low
   crowd murmur and the launch's thump, rumble and roar (start/FilmSound.js). A click, Esc, Enter or Space skips it (a
   short dither to black); it resolves at the end either way. The game's music pauses for the film and comes back after.
   Source: the player of prototypes/films/launch.html (clock, overlay, dither fade, fit, skip, launchScore), its ids
   prefixed ns-film-, no "Watch again", no URL reads. Its look is injected here once, every value from tokens.css.
   Look pass B11: the broadcast says "launch yard" once (C09: the bug is "Exodus Programme" alone, the first strap has no
   kicker); the clock hangs a fixed 8 --u under the bug, so they never overlap; the clock in Plex Mono 400; every word
   14 px or more; the LIVE dot stays lit under reduced motion; the skip is the film skip (the one corner hint, on the
   window's corner); a window that is not a whole number of film pixels gets the dock cut's 1 px hairline round the film.
   Loaded only when the new-screen switch is on. Needs NSPaint, NSLaunchArt; NSFilmSound if there is to be sound.

   window.NSLaunch (frozen)
     play() → Promise        mounts .ns-film (z-index 5000) over everything, plays, resolves when it ends or is skipped
                             (at once if a film is already playing, or the art failed to load)
     isPlaying() → bool
     debug: { state() → { t, playing, ended, shot, sound }, setTime(ms) (pauses there), resume(), skip() }   headless runs
*/
(function () {
    'use strict';
    const P = window.NSPaint, A = window.NSLaunchArt;
    if (!window.NEW_SCREEN || !P || !A) return;
    const { INK, clamp01, smooth, threshold } = P;
    const { AW, AH, DUR, LINES, COUNT, LIVE_ENDS, FADE, CLIMB_AT } = A;
    const FADE_IN = 900, SKIP_MS = 360, SKIP_GUARD_MS = 400, BUILD_GAP_MS = 30, MAX_DT = 100, SKIP_HINT_MS = 4000;
    const SKIP_KEYS = ['Escape', 'Enter', ' '];
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const still = () => !!(mq && mq.matches);

    const CSS = `
.ns-film { position: fixed; inset: 0; z-index: 5000; background: var(--ink); overflow: hidden; cursor: pointer; user-select: none; -webkit-user-select: none;
    --u: 3px; color: var(--text); font: 400 var(--fs-prev)/1.4 var(--f-text); -webkit-font-smoothing: antialiased; }
.ns-film p { margin: 0; }
.ns-film-frame { position: absolute; overflow: hidden; }
.ns-film-frame.is-framed { box-shadow: 0 0 0 1px #1a2026; }   /* the window is not a whole number of film pixels: the dock cut's hairline, so it is a screen on purpose */
.ns-film-art { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; image-rendering: crisp-edges; }
.ns-film .gfx { position: absolute; pointer-events: none; opacity: 0; will-change: opacity; }
#ns-film-live { left: calc(var(--u) * 14); top: calc(var(--u) * 12); display: flex; align-items: center; gap: calc(var(--u) * 2.4);
    font: 600 max(var(--fs-floor), calc(var(--u) * 5.2))/1 var(--f-ui); letter-spacing: 0.2em; color: var(--text); text-shadow: var(--shadow); }
#ns-film-live i { width: max(5px, calc(var(--u) * 2.6)); height: max(5px, calc(var(--u) * 2.6)); border-radius: 50%; background: var(--alarm); box-shadow: 0 0 calc(var(--u) * 3) color-mix(in srgb, var(--alarm) 60%, transparent); }
#ns-film-live i.off { opacity: 0.25; }
/* top right: the programme's bug, and under it, a fixed gap down, the clock (they never overlap) */
.ns-film-tr { position: absolute; right: calc(var(--u) * 14); top: calc(var(--u) * 12); display: grid; justify-items: end; gap: calc(var(--u) * 8); pointer-events: none; }
.ns-film-tr .gfx { position: static; }
#ns-film-net { text-align: right; font: 500 max(var(--fs-floor), calc(var(--u) * 4.4))/1.25 var(--f-ui); letter-spacing: 0.24em; text-transform: uppercase; color: var(--text-2); text-shadow: var(--shadow); }
#ns-film-clock { font: 400 max(18px, calc(var(--u) * 9))/1 var(--f-num); letter-spacing: 0.04em; color: var(--text); text-shadow: var(--shadow), var(--halo); white-space: nowrap; }
#ns-film-clock small { font: 500 max(var(--fs-floor), calc(var(--u) * 4.4))/1 var(--f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim); margin-right: calc(var(--u) * 2); vertical-align: middle; }
#ns-film-lt { left: calc(var(--u) * 14); bottom: calc(var(--u) * 16); max-width: max(420px, calc(var(--u) * 330)); padding: calc(var(--u) * 3.4) calc(var(--u) * 6) calc(var(--u) * 3.8);
    background: linear-gradient(90deg, color-mix(in srgb, var(--ink) 90%, transparent), color-mix(in srgb, var(--ink) 72%, transparent)); border-left: max(2px, calc(var(--u) * 1.2)) solid var(--warm); }
#ns-film-lt .kicker { margin: 0 0 calc(var(--u) * 1.4); font: 500 max(var(--fs-floor), calc(var(--u) * 4.2))/1 var(--f-ui); letter-spacing: 0.22em; text-transform: uppercase; color: var(--dim); text-shadow: var(--shadow); }
#ns-film-lt .kicker:empty { display: none; }
#ns-film-lt .line { font: 400 max(17px, calc(var(--u) * 7.4))/1.25 var(--f-text); color: var(--text); }
#ns-film-lt .names { margin: calc(var(--u) * 1.2) 0 0; font: 400 max(var(--fs-floor), calc(var(--u) * 5.6))/1.3 var(--f-text); color: var(--text-2); }
/* the film skip: the one corner hint of every film (the launch, the stall, the sea of ships, the endings), on the window's corner */
.ns-film-skip { position: absolute; right: max(16px, 4vw); bottom: max(16px, 5vh); margin: 0; padding: var(--s2) 0; font: 500 var(--fs-skip)/1 var(--f-ui); letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--dim); text-shadow: var(--shadow); opacity: 0; pointer-events: none; transition: opacity 180ms steps(3, end); }
.ns-film-skip.is-in { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .ns-film-skip { transition: none; } }
`;
    function injectCss() {
        if (document.getElementById('ns-film-css')) return;
        const s = document.createElement('style'); s.id = 'ns-film-css'; s.textContent = CSS; document.head.appendChild(s);
    }

    // ════════════════════════════════════ the sound score (only with the game's sound on) ════════════════════════════════════
    // Two things, both low: the crowd (a murmur that comes nearer on the crowd shots and swells at the podium, hushes at the
    // countdown and rises again under the launch), and the launch (a deep thump, a rumble and a roar that drop to a distant one
    // on the long lens and fade to nothing as the ship becomes a point). No voice, no beeps, no music. Then silence.
    const keys = pts => T => {
        if (T <= pts[0][0]) return pts[0][1];
        for (let i = 1; i < pts.length; i++) if (T <= pts[i][0]) { const [t0, v0] = pts[i - 1], [t1, v1] = pts[i], k = (T - t0) / (t1 - t0); return v0 + (v1 - v0) * k * k * (3 - 2 * k); }
        return pts[pts.length - 1][1];
    };
    const CROWD_LVL = keys([[0, 0], [900, 0.2], [7000, 0.22], [7300, 0.4], [12000, 0.4], [12400, 0.46], [13600, 0.7], [16500, 0.5], [20000, 0.44], [20300, 0.16], [26500, 0.16], [29400, 0.1], [30600, 0.24], [32600, 0.5], [34000, 0.46], [34300, 0.16], [37000, 0.04], [38500, 0]]);
    const CROWD_TONE = keys([[0, 900], [7000, 900], [7300, 1400], [12000, 1400], [12400, 1500], [13600, 1800], [17000, 1500], [20000, 1500], [20300, 800], [29400, 800], [32600, 1400], [34000, 1400], [34300, 700]]);   // kept dark: a murmur, never a hiss
    function launchScore(K) {
        const live = K.gain(0, K.out);                                                         // the whole score: closed when paused or over
        const crowdTone = K.filter('lowpass', 1200, 0.6, live);
        const crowd = K.gain(0, crowdTone);
        K.loop('pink', K.filter('bandpass', 320, 0.8, crowd)); K.loop('pink', K.filter('bandpass', 700, 1.1, K.gain(0.55, crowd)), 0.97);
        const vent = K.gain(0, live); K.loop('white', K.filter('highpass', 2400, 0.7, K.filter('lowpass', 6000, 0.7, vent)));
        const rumble = K.gain(0, live); K.loop('brown', K.filter('lowpass', 90, 0.9, rumble)); K.osc('sine', 33, K.gain(0.35, rumble));
        const roar = K.gain(0, live), roarLp = K.filter('lowpass', 900, 0.7, roar);
        K.loop('brown', roarLp, 1.4); K.loop('pink', K.filter('lowpass', 1300, 0.7, K.gain(0.45, roarLp)));
        const cues = [
            [COUNT.zero, at => {                                                                // ignition: a deep thump under the roar
                K.tone({ at, f: 58, f2: 26, dur: 1.8, gain: 0.55, attack: 0.02, to: live });
                K.burst({ at, dur: 1.4, kind: 'brown', type: 'lowpass', f: 600, f2: 110, gain: 0.55, attack: 0.04, to: live });
            }],
        ];
        function update(T, dt, on) {
            K.set(live.gain, on ? 1 : 0, on ? 0.03 : 0.08);
            K.set(crowd.gain, 1.3 * CROWD_LVL(T) * (1 + 0.12 * Math.sin(T / 910) + 0.07 * Math.sin(T / 370)), 0.12);
            K.set(crowdTone.frequency, CROWD_TONE(T), 0.08);
            K.set(vent.gain, T < COUNT.zero ? 0.07 * smooth(COUNT.t0 - 6500, COUNT.t0, T) * (T < 20000 ? 0 : 1) : 0, 0.25);
            const heat = clamp01((T - COUNT.zero) / 600), k = clamp01((T - CLIMB_AT) / 6200), far = T >= CLIMB_AT;
            const rum = T < COUNT.zero ? 0 : far ? 0.5 * (1 - k) ** 1.6 : heat;
            const rr = T < COUNT.zero ? 0 : far ? 0.5 * (1 - k) ** 2 : heat * (1 - 0.15 * clamp01((T - COUNT.zero - 2000) / 2500));
            K.set(rumble.gain, rum, 0.06);
            K.set(roar.gain, 1.0 * rr, 0.06);
            K.set(roarLp.frequency, far ? 140 + 520 * (1 - k) ** 1.5 : 900, 0.05);
        }
        return { cues, update };
    }

    // ════════════════════════════════════ the player ════════════════════════════════════
    let film = null;                                                                           // the one playing, or null

    function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
    function mount() {
        injectCss();
        const root = el('div', 'ns-film');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Film: the launch of Exodus-9, as a live broadcast. Click to skip.');
        root.innerHTML = '<div class="ns-film-frame"><canvas class="ns-film-art" aria-hidden="true"></canvas>'
            + '<div class="gfx" id="ns-film-live"><i></i><span>LIVE</span></div>'
            + '<div class="ns-film-tr"><div class="gfx" id="ns-film-net">Exodus Programme</div>'   // DRAFT (look pass): C09 says it once (the bug was "Exodus Programme / Launch Yard")
            + '<div class="gfx" id="ns-film-clock"></div></div>'
            + '<div class="gfx" id="ns-film-lt" aria-live="polite"><p class="kicker"></p><p class="line"></p><p class="names"></p></div></div>'
            + '<p class="ns-film-skip" id="ns-film-skip">Click to skip</p>';
        document.body.appendChild(root);
        const q = s => root.querySelector(s);
        return { root, frame: q('.ns-film-frame'), canvas: q('canvas'), live: q('#ns-film-live'), liveDot: q('#ns-film-live i'), net: q('#ns-film-net'),
            clock: q('#ns-film-clock'), lt: q('#ns-film-lt'), ltK: q('#ns-film-lt .kicker'), ltL: q('#ns-film-lt .line'), ltN: q('#ns-film-lt .names'), skip: q('#ns-film-skip') };
    }

    function play() {
        if (film) return film.done;
        let ui = null, art = null;
        try { ui = mount(); art = A.create(ui.canvas); } catch (err) {
            console.error('NSLaunch: the film could not start', err);
            if (ui) ui.root.remove();
            return Promise.resolve();
        }
        const { ctx, SHOTS } = art;
        const built = new Map(), dimPat = new Map();
        let T = 0, playing = true, ended = false, last = null, frameId = null, skipT = null, shownLine, buildTimer = 0, finish = null;
        const startedAt = performance.now();
        const done = new Promise(resolve => { finish = resolve; });
        const sound = window.NSFilmSound ? window.NSFilmSound.attach({ score: launchScore }) : null;
        const music = pauseMusic();

        const stateOf = s => { if (!built.has(s.id)) built.set(s.id, s.build()); return built.get(s.id); };
        const shotAt = t => SHOTS.find(o => t >= o.t0 && t < o.t1) || SHOTS[SHOTS.length - 1];
        /** Dither to black: amount 0..1, whole Bayer steps (the house fade, never a soft alpha). */
        function dim(a) {
            const n = Math.round(clamp01(a) * 8); if (!n) return;
            if (n >= 8) { ctx.fillStyle = INK; ctx.fillRect(0, 0, AW, AH); return; }
            if (!dimPat.has(n)) { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = INK; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (threshold(x, y) < n / 8) g.fillRect(x, y, 1, 1); dimPat.set(n, ctx.createPattern(c, 'repeat')); }
            ctx.fillStyle = dimPat.get(n); ctx.fillRect(0, 0, AW, AH);
        }
        function overlay() {
            const live = T < LIVE_ENDS && !ended && skipT == null, a = T < 600 ? 0 : 1;
            ui.live.style.opacity = ui.net.style.opacity = live ? a : 0;
            ui.liveDot.classList.toggle('off', !still() && Math.floor(T / 900) % 2 === 1);   // reduced motion: the dot stays lit
            const L = skipT == null ? LINES.find(l => T >= l.t0 && T < l.t1) : null;
            if (L !== shownLine) { shownLine = L; if (L) { ui.ltK.textContent = L.kicker; ui.ltL.textContent = L.line; ui.ltN.textContent = L.names || ''; ui.ltN.hidden = !L.names; } }
            ui.lt.style.opacity = L ? Math.min(1, (T - L.t0) / 350, (L.t1 - T) / 350) : 0;
            if (T >= COUNT.t0 && T < COUNT.zero + 2600 && !ended && skipT == null) {
                const left = Math.max(0, Math.ceil((COUNT.zero - T) / 1000));
                ui.clock.innerHTML = '<small>' + (T < COUNT.zero ? 'T minus' : 'Lift-off') + '</small>00:' + String(left).padStart(2, '0');
                ui.clock.style.opacity = 1;
            } else ui.clock.style.opacity = 0;
            ui.skip.classList.toggle('is-in', T < SKIP_HINT_MS && playing && !ended && skipT == null);
        }
        function render(now) {
            const s = shotAt(T);
            ctx.fillStyle = INK; ctx.fillRect(0, 0, AW, AH);
            if (T < DUR) { try { s.draw(T - s.t0, stateOf(s)); } catch (err) { console.error('NSLaunch: the shot "' + s.id + '" failed', err); } }
            const skipping = skipT == null ? 0 : clamp01((now - skipT) / SKIP_MS);
            dim(Math.max(T < FADE_IN ? 1 - T / FADE_IN : smooth(FADE[0], FADE[1], T), skipping));
            overlay();
            if (sound) sound.tick(T, playing && !ended && skipT == null);
        }
        function fit() {
            const dpr = window.devicePixelRatio || 1, k = Math.max(1, Math.floor(Math.min(innerWidth * dpr / AW, innerHeight * dpr / AH)));
            const w = AW * k / dpr, h = AH * k / dpr;
            Object.assign(ui.frame.style, { width: w + 'px', height: h + 'px', left: Math.round((innerWidth - w) / 2) + 'px', top: Math.round((innerHeight - h) / 2) + 'px' });
            ui.frame.classList.toggle('is-framed', innerWidth - w > 1 || innerHeight - h > 1);   // ink round it: the hairline frame
            ui.root.style.setProperty('--u', (k / dpr) + 'px');
        }
        function request() { frameId = window.FrameClock ? window.FrameClock.request(loop) : requestAnimationFrame(loop); }
        function loop(now) {
            frameId = null;
            if (!film || film.ui !== ui) return;
            const dt = last == null ? 16 : Math.min(MAX_DT, Math.max(0, now - last)); last = now;
            if (playing && !ended && skipT == null) { T += dt; if (T >= DUR) { T = DUR; ended = true; } }
            render(now);
            if (ended || (skipT != null && now - skipT >= SKIP_MS)) { close(); return; }
            request();
        }
        function skip() {
            if (ended || skipT != null || performance.now() - startedAt < SKIP_GUARD_MS) return;
            skipT = performance.now();
        }
        const onDown = e => { e.preventDefault(); e.stopPropagation(); skip(); };
        const onKey = e => { if (!SKIP_KEYS.includes(e.key)) return; e.preventDefault(); e.stopPropagation(); skip(); };
        function close() {
            if (!film || film.ui !== ui) return;
            if (frameId != null) { (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(frameId); frameId = null; }
            clearTimeout(buildTimer);
            removeEventListener('resize', fit);
            removeEventListener('keydown', onKey, true);
            if (sound) sound.close();
            music();
            ui.root.remove();
            film = null;
            finish();
        }

        film = { ui, done, debug: {
            state: () => ({ t: Math.round(T), playing, ended, shot: shotAt(T).id, sound: sound ? sound.state() : null }),
            setTime(ms) { playing = false; T = clamp01(ms / DUR) * DUR; SHOTS.forEach(stateOf); },
            resume() { playing = true; },
            skip() { skipT = performance.now() - SKIP_GUARD_MS; },
        } };
        ui.root.addEventListener('pointerdown', onDown);
        addEventListener('keydown', onKey, true);
        addEventListener('resize', fit);
        fit();
        stateOf(SHOTS[0]);                                                                     // the first shot now, the rest one per idle slot
        let next = 1;
        (function buildMore() { if (!film || film.ui !== ui || next >= SHOTS.length) return; try { stateOf(SHOTS[next++]); } catch (err) { console.error('NSLaunch: a shot failed to build', err); } buildTimer = setTimeout(buildMore, BUILD_GAP_MS); })();
        request();
        return done;
    }

    /** The game's music stops for the film and comes back after (only if it was playing and the sound is still on). */
    function pauseMusic() {
        const audio = window.AudioSystem, m = audio && audio.bgMusic;
        if (!m || m.paused) return () => {};
        try { m.pause(); } catch (err) { return () => {}; }
        return () => { if (!audio.muted && audio.bgMusic === m) m.play().catch(() => { /* the next click starts it, as the game does */ }); };
    }

    window.NSLaunch = Object.freeze({
        play,
        isPlaying: () => !!film,
        debug: Object.freeze({
            state: () => (film ? film.debug.state() : null),
            setTime: ms => { if (film) film.debug.setTime(ms); },
            resume: () => { if (film) film.debug.resume(); },
            skip: () => { if (film) film.debug.skip(); },
        }),
    });
})();
