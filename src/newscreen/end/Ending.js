/* ═══ Silent Exodus · new screen (?new=1) · end/Ending.js: the two endings, played, and the end card ═════════════════
   What it is: what happens after the commander chooses at the light (or settles on Eden), in the new look. A scene, not a
   minigame: the player does not steer. One full-screen picture (.ns-film, so the travel view stops drawing under it):
     INTO THE LIGHT  the mockup's last approach (end/LightArt.js, prototypes/play-ideas/last-approach.js): the light grows
                     until it fills the window, every alarm goes off, the crew plead to turn back while A.U.R.A. reads true.
                     Near the end the ship slows and waits: the one held moment, "Keep going". Then white, then quiet, then
                     the calm place (end/CalmArt.js) with whoever is alive, and one line.
     BACK TO EDEN    chosen at the light: the turn away (the light shrinks behind us, Eden slides into the window), then Eden's
                     meadow (end/EdenArt.js), the crew settling into the grass, one line; the camera rises until the meadow is
                     one cold point of light in the dark; with the disc aboard, one quiet last line. Settled on Eden itself:
                     the meadow first.
     THE COPY        "Go down" at the copy of Earth (stop/Copy.js): our Lander drops into the blue through clouds that do not move,
                     a perfect day by a perfect sea where the grass is one blade copied, the crew step out, one line; then the
                     view tilts up to the night: stars in rows, our ship a point of light; the last lines (end/CopyArt.js).
   Then the end card over the last picture: the ending's name, three short lines, "New game". No stats, no scores.
   The words come from StructureEncounter.js lightEndingFor(door, state) (bundle.js endJourney passes them), or for the copy from
   stop/CopyWords.js ending(state) (bundle.js endOnTheCopy); all are DRAFTS.
   Esc skips ahead (to the held moment while flying in; otherwise to the end card). No sound of its own.
   Loaded only when the new-screen switch is on, after end/LightArt.js, end/CalmArt.js, end/EdenArt.js and end/CopyArt.js.

   window.NSEnding (frozen)
     play(app, ending, { from: 'light' | 'eden' | 'copy' }) → Promise   resolves once the end card is up (bundle.js drops the save then;
                                                               "New game" reloads); rejects if the scene cannot start (bundle.js
                                                               then shows the old end screen)
     isPlaying() → bool
     debug: { state(), speed(k), keepGoing(), skip() }         for the headless runs (speed k runs the clock k times as fast)
*/
(function () {
    'use strict';
    const P = window.NSPaint, LA = window.NSLightArt, CA = window.NSCalmArt, EA = window.NSEdenArt, CP = window.NSCopyArt;
    if (!window.NEW_SCREEN || !P || !LA || !CA || !EA) return;
    const { INK, clamp01, threshold } = P;
    const ss = P.smooth;

    const ART_ROWS = 360, MIN_ROWS = 280, FPS = 30, MAX_DT = 0.1, RESIZE_MS = 150, BUILD_GAP_MS = 40;
    // into the light (s): the approach runs to HOLD_AT, waits, and the last push takes it in
    const APPROACH_S = 34, HOLD_AT = 0.88, KEEP_AFTER_S = 1.4, PUSH_S = 3.2, WHITE_S = 3.4, QUIET_S = 1.8, DAWN_S = 2.8;
    // back to Eden (s)
    const TURN_S = 3.8, TURN_LINE_S = 0.9, TURN_HOLD_S = 3.4, LAND_S = 1.1, MEADOW_LINE_S = 3.9, MEADOW_S = 9.2, RISE_S = 1.6, SHRINK_S = 5.4, POINT_LINE_S = 1.0;
    // the copy (s): the descent, the landing's dissolve, the ground (its two lines), the tilt up, the night (its two lines)
    const DESCENT_S = 6.4, COPY_LAND_S = 1.0, GROUND_S = 13.4, GROUND_LINE_S = 6.6, GROUND_GAP_S = 3.4, TILT_S = 3.6, NIGHT_LINE_S = 1.4, NIGHT_GAP_S = 4.4;
    // both (s)
    const IN_S = 0.9, LINE_AFTER_S = 0.9, CARD_AFTER_S = 3.8, CARD_DIM = 0.75, GUARD_MS = 900, KEEP_GUARD_MS = 400, CARD_FRAME_EVERY = 4, CARD_SETTLE_S = 3, VEIL_RATE = 4;
    // the ship's alarms, in shares of the approach: the deck that turns emergency red and the word the ship flashes (the mockup's)
    const ALARMS = [
        { at: 0.18, deck: 'engineering', label: 'HULL TEMPERATURE' }, { at: 0.3, deck: 'bridge' }, { at: 0.42, deck: 'lab' },
        { at: 0.5, deck: 'quarters', label: 'RADIATION' }, { at: 0.62, deck: 'cargo' }, { at: 0.74, deck: 'upgrades' },
    ];
    const ROLE = { cora: 'LEADER', jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' };
    const isCalmMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const CSS = `
.ns-end { position: fixed; inset: 0; z-index: 5000; overflow: hidden; background: #05070a; cursor: default; user-select: none; -webkit-user-select: none;
    --ink: #05070a; --text: #e4e4e0; --dim: #8b8d90; --ui: #c9d1d6; --warm: #f08c2e; --warm-br: #ffc27a; --t: 1; --face: 72px;
    --f-ui: 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; --f-text: 'IBM Plex Sans', system-ui, sans-serif; --f-num: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
    --shadow: 0 1px 0 #05070a; --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
    color: var(--text); font: 400 15px/1.4 var(--f-text); -webkit-font-smoothing: antialiased; }
.ns-end p, .ns-end h2 { margin: 0; }
.ns-end button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
.nse-art { position: absolute; left: 0; top: 0; display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.nse-voice { position: absolute; left: max(16px, 6vw); top: 8vh; display: grid; grid-template-columns: var(--face) minmax(0, 1fr); gap: 0 18px; align-items: start;
    width: max-content; max-width: min(calc(600px + 200px * var(--t)), calc(100vw - 32px)); text-shadow: var(--shadow); pointer-events: none; opacity: 0; transition: opacity 180ms var(--ease); }
.nse-voice.is-in { opacity: 1; }
.nse-voice.is-narr, .nse-voice.is-solo { grid-template-columns: minmax(0, 1fr); }
.nse-face { display: block; width: var(--face); height: var(--face); background: var(--ink); }
.nse-face[hidden], .nse-ring[hidden] { display: none; }
.nse-text { display: grid; gap: 7px; padding-top: 2px; }
.nse-who { display: flex; align-items: center; gap: 8px; font: 500 calc(14px + 1px * var(--t))/1 var(--f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: var(--tone, var(--warm)); }
.nse-ring { flex: none; width: 0.82em; height: 0.82em; border: 1px solid currentColor; border-radius: 50%; }
.nse-voice.is-narr .nse-who { display: none; }
.nse-say { font: 400 calc(19px + 5px * var(--t))/1.36 var(--f-text); color: var(--text); text-wrap: pretty; }
.nse-voice.is-narr .nse-say { font-style: italic; color: #d6d8d5; }
.nse-voice.tone-cora { --tone: #f2e2c4; } .nse-voice.tone-jaxon { --tone: #f08c2e; } .nse-voice.tone-aris { --tone: #ffc27a; }
.nse-voice.tone-vance { --tone: #c4622a; } .nse-voice.tone-mira { --tone: #e8836a; } .nse-voice.tone-aura { --tone: var(--ui); }
.nse-keep { position: absolute; right: max(16px, 6vw); bottom: 9vh; text-shadow: var(--shadow); opacity: 0; transition: opacity 300ms var(--ease); }
.nse-keep.is-in { opacity: 1; }
.nse-keep[hidden], .nse-card[hidden] { display: none; }
.nse-go { display: inline-flex; align-items: baseline; gap: 14px; padding: 8px 0; text-shadow: var(--shadow); }
.nse-go .nse-verb { font: 400 calc(19px + 4px * var(--t))/1.25 var(--f-text); color: var(--text); transition: color 140ms var(--ease), transform 140ms var(--ease); }
.nse-go .nse-key { font: 400 calc(14px + 1px * var(--t))/1 var(--f-num); color: var(--dim); transition: color 140ms var(--ease); }
.nse-go:hover .nse-verb, .nse-go:focus-visible .nse-verb { color: var(--warm); transform: translateX(3px); }
.nse-go:hover .nse-key, .nse-go:focus-visible .nse-key { color: var(--warm); }
.nse-go:active .nse-verb { color: var(--warm-br); }
.nse-go:focus-visible { outline: none; }
.nse-card { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(600px, calc(100vw - 32px)); display: grid; gap: 12px;
    text-shadow: var(--shadow); opacity: 0; transition: opacity 900ms var(--ease); outline: none; }
.nse-card.is-in { opacity: 1; }
.nse-card.is-low { top: 64%; }                                     /* Eden: clear of the cold point, high in the dark */
.nse-kicker { font: 500 13px/1 var(--f-ui); letter-spacing: 0.24em; text-transform: uppercase; color: var(--dim); }
.nse-title { font: 600 calc(34px + 12px * var(--t))/1.05 var(--f-ui); letter-spacing: 0.02em; color: var(--text); }
.nse-lines { display: grid; gap: 10px; margin: 8px 0 10px; }
.nse-lines p { font: 400 calc(17px + 3px * var(--t))/1.5 var(--f-text); color: #d8dad8; text-wrap: pretty; }
.nse-card .nse-go { justify-self: start; }
@media (prefers-reduced-motion: reduce) { .nse-voice, .nse-keep, .nse-card, .nse-go .nse-verb, .nse-go .nse-key { transition: none; } }
`;
    function injectCss() {
        if (document.getElementById('nse-css')) return;
        const s = document.createElement('style'); s.id = 'nse-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    // ── the Bayer steps: ink over the picture (the house fade, never a soft alpha) and a mask to dissolve one picture into another ──
    const steps = new Map();
    function stepCanvas(n, isInk) {
        const key = (isInk ? 'i' : 'm') + n;
        if (steps.has(key)) return steps.get(key);
        const c = document.createElement('canvas'); c.width = c.height = 8;
        const g = c.getContext('2d'); g.fillStyle = INK;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (threshold(x, y) < n / 8) g.fillRect(x, y, 1, 1);
        steps.set(key, c);
        return c;
    }
    function dim(ctx, W, H, a) {
        const n = Math.round(clamp01(a) * 8);
        if (!n) return;
        if (n >= 8) { ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H); return; }
        ctx.fillStyle = ctx.createPattern(stepCanvas(n, true), 'repeat'); ctx.fillRect(0, 0, W, H);
    }
    /** `from` (a canvas the size of the frame) shows over what is drawn where the 8 x 8 threshold is under a (0..1). */
    function dissolve(ctx, aux, from, W, H, a) {
        const n = Math.round(clamp01(a) * 8);
        if (!n) return;
        if (n >= 8) { ctx.drawImage(from, 0, 0); return; }
        const g = aux.getContext('2d');
        g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.drawImage(from, 0, 0);
        g.globalCompositeOperation = 'destination-in'; g.fillStyle = g.createPattern(stepCanvas(n, false), 'repeat'); g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = 'source-over';
        ctx.drawImage(aux, 0, 0);
    }

    // ════════════════════════════════════════ the page ════════════════════════════════════════
    function mount() {
        injectCss();
        const root = document.createElement('div');
        root.className = 'ns-film ns-end';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'The end of the journey');
        root.innerHTML = '<canvas class="nse-art" aria-hidden="true"></canvas>'
            + '<div class="nse-voice" aria-live="polite"><img class="nse-face" alt="" hidden><div class="nse-text"><p class="nse-who"><span class="nse-ring" hidden></span><span class="nse-name"></span></p><p class="nse-say"></p></div></div>'
            + '<div class="nse-keep" hidden><button type="button" class="nse-go" data-act="keep"><span class="nse-verb"></span><span class="nse-key" aria-hidden="true">↵</span></button></div>'
            + '<section class="nse-card" hidden tabindex="-1"><p class="nse-kicker">The end</p><h2 class="nse-title"></h2><div class="nse-lines"></div>'
            + '<button type="button" class="nse-go" data-act="new"><span class="nse-verb">New game</span></button></section>';
        document.body.appendChild(root);
        const q = s => root.querySelector(s);
        return { root, canvas: q('.nse-art'), voice: q('.nse-voice'), face: q('.nse-face'), ring: q('.nse-ring'), name: q('.nse-name'), say: q('.nse-say'),
            keep: q('.nse-keep'), keepVerb: q('.nse-keep .nse-verb'), card: q('.nse-card'), title: q('.nse-title'), lines: q('.nse-lines') };
    }

    let run = null;                                                                 // the one playing

    function measure(R) {
        const dpr = window.devicePixelRatio || 1, devW = Math.round(innerWidth * dpr), devH = Math.round(innerHeight * dpr);
        const k1 = Math.max(1, Math.round(devH / ART_ROWS)), k = k1 > 1 && devH / k1 < MIN_ROWS ? k1 - 1 : k1;   // whole device px per art px, about 360 rows (the mockup's)
        const W = Math.ceil(devW / k), H = Math.ceil(devH / k);
        const c = R.ui.canvas;
        c.width = W; c.height = H; c.style.width = (W * k / dpr) + 'px'; c.style.height = (H * k / dpr) + 'px';
        R.ctx = c.getContext('2d', { willReadFrequently: true });
        R.ctx.imageSmoothingEnabled = false;
        R.aux = document.createElement('canvas'); R.aux.width = W; R.aux.height = H;
        R.aux2 = document.createElement('canvas'); R.aux2.width = W; R.aux2.height = H;
        R.aux2.getContext('2d').imageSmoothingEnabled = false;
        R.ui.root.style.setProperty('--t', clamp01((innerWidth - 1280) / 640).toFixed(3));
        R.ui.root.style.setProperty('--face', Math.round(24 * k / dpr) + 'px');
        R.G = { k, W, H, dpr };
    }
    const member = (R, id) => ((R.app.state && R.app.state.crew) || []).find(c => (c.tags || []).includes(ROLE[id])) || null;
    function edenNode(R) { return ((R.app.state && R.app.state.sectorNodes) || []).find(n => n && (n.isEden || n.type === 'EDEN')) || null; }

    /** The pictures this run needs now (built while the screen is ink, white or quiet; the rest one per idle slot). */
    function buildFirst(R) {
        const { W, H } = R.G;
        if (R.kind === 'copy') { R.copy = CP.build(W, H, R.ending.living); return; }
        if (R.kind === 'light') { R.light = LA.create(W, H); return; }
        if (R.from === 'light') { R.light = LA.create(W, H); LA.eden(R.light, edenNode(R)); }
        R.eden = EA.build(W, H, R.ending.living, edenNode(R));
        EA.bakeNext(R.eden);                                                        // the largest Eden from orbit now: the rest while they settle
    }
    function rebuild(R) {
        measure(R);
        const { W, H } = R.G;
        if (R.light) { const hadEden = !!R.light.eden; R.light = LA.create(W, H); if (hadEden) LA.eden(R.light, edenNode(R)); }
        if (R.calm) R.calm = CA.build(W, H, R.ending.living);
        if (R.eden) { R.eden = EA.build(W, H, R.ending.living, edenNode(R)); EA.bakeNext(R.eden); }
        if (R.copy) R.copy = CP.build(W, H, R.ending.living);
        if (R.frozen) R.frozen = null;
    }

    // ════════════════════════════════════════ the words ════════════════════════════════════════
    /** One line at a time: the speaker's portrait (A.U.R.A.'s ring), the name in their tone, the line. hold: stays up. */
    function say(R, line, hold) {
        const ui = R.ui, isNarr = !line.who, isAura = line.who === 'aura', m = isNarr || isAura ? null : member(R, line.who);
        const hasFace = !!(m && m.portraitId);
        ui.voice.className = 'nse-voice tone-' + (line.who || 'narr') + (isNarr ? ' is-narr' : '') + (hasFace ? '' : ' is-solo');
        ui.name.textContent = isAura ? 'A.U.R.A.' : m ? m.name : '';
        ui.say.textContent = line.say;
        ui.ring.hidden = !isAura;
        ui.face.hidden = !hasFace;
        if (m && m.portraitId) ui.face.src = 'assets/crew/' + m.portraitId + '.png';
        void ui.voice.offsetWidth;
        ui.voice.classList.add('is-in');
        const words = String(line.say).split(/\s+/).length;
        R.voiceUntil = hold ? Infinity : R.clock + Math.min(6, Math.max(3.4, 1.8 + words * 0.3));
        R.line = line.say;
    }
    function hush(R) { R.ui.voice.classList.remove('is-in'); R.voiceUntil = 0; }
    /** Over a day sky or the pale calm place: the corner darkens with the words, like dusk (no box), and lightens after. */
    function drawVeil(R) {
        if (R.veilK < 0.02) return;
        const ctx = R.ctx;
        ctx.globalAlpha = Math.min(1, R.veilK);
        ctx.drawImage(LA.veil(R.G.W, R.G.H), 0, 0);
        ctx.globalAlpha = 1;
    }
    /** Boxes (art px) the picture darkens under, so the words read even on the light. */
    function wordBoxes(R) {
        const out = [], { k, dpr } = R.G, add = el => { const r = el.getBoundingClientRect(); if (r.width) out.push([Math.floor(r.left * dpr / k), Math.floor(r.top * dpr / k), Math.ceil(r.right * dpr / k), Math.ceil(r.bottom * dpr / k)]); };
        if (R.ui.voice.classList.contains('is-in')) add(R.ui.voice);
        if (!R.ui.keep.hidden) add(R.ui.keep);
        return out;
    }

    // ════════════════════════════════════════ the clock ════════════════════════════════════════
    function go(R, phase) { R.phase = phase; R.t = 0; R.spoke = false; }
    function update(R, dt) {
        R.t += dt; R.clock += dt;
        if (R.voiceUntil && R.clock > R.voiceUntil) hush(R);
        R.veilK += ((R.ui.voice.classList.contains('is-in') ? 1 : 0) - R.veilK) * Math.min(1, dt * VEIL_RATE);
        if (R.kind === 'light') updateLight(R, dt); else if (R.kind === 'copy') updateCopy(R, dt); else updateEden(R, dt);
    }
    function updateLight(R, dt) {
        const sc = R.ending.scene, L = R.light;
        R.jolt *= Math.exp(-dt * 3);
        if (R.phase === 'fly') {
            R.s = Math.min(HOLD_AT, R.s + dt / APPROACH_S * HOLD_AT);
            while (R.lineAt < sc.flight.length && R.s >= sc.flight[R.lineAt].at) say(R, sc.flight[R.lineAt++]);
            while (R.alarmAt < ALARMS.length && R.s >= ALARMS[R.alarmAt].at) {     // an alarm: a deck goes red, the ship jolts
                const a = ALARMS[R.alarmAt++];
                R.damaged = Object.assign({}, R.damaged, { [a.deck]: true });
                if (a.label) R.label = a.label;
                R.jolt = 1;
            }
            LA.tick(L, dt, 0.35 + 1.7 * R.s);
            if (R.s >= HOLD_AT) { go(R, 'hold'); say(R, sc.hold, true); }
            return;
        }
        if (R.phase === 'hold') {                                                   // the ship slows and waits: the one held moment
            LA.tick(L, dt, (0.35 + 1.7 * R.s) * (1 - 0.88 * ss(0, 1.6, R.t)));
            if (R.ui.keep.hidden && R.t >= KEEP_AFTER_S) showKeep(R);
            return;
        }
        if (R.phase === 'push') {
            const k = clamp01(R.t / PUSH_S);
            R.s = HOLD_AT + (1 - HOLD_AT) * k * k;
            LA.tick(L, dt, 0.5 + 2.6 * k);
            if (k >= 1) { go(R, 'white'); hush(R); }
            return;
        }
        if (R.phase === 'white') { LA.tick(L, dt, 2.2); if (R.t >= WHITE_S) go(R, 'quiet'); return; }
        if (R.phase === 'quiet') {
            if (!R.calm) R.calm = CA.build(R.G.W, R.G.H, R.ending.living);          // painted while the screen is white
            if (R.t >= QUIET_S) go(R, 'calm');
            return;
        }
        if (R.phase === 'calm') {
            if (!R.spoke && R.t >= DAWN_S + LINE_AFTER_S) { R.spoke = true; say(R, sc.closing, true); }
            if (R.t >= DAWN_S + LINE_AFTER_S + CARD_AFTER_S) showCard(R);
        }
    }
    function updateEden(R, dt) {
        const sc = R.ending.scene;
        if (R.phase === 'turn') {
            LA.tick(R.light, dt, 0.4 * (1 - Math.min(1, R.t / TURN_S)));
            if (!R.spoke && R.t >= TURN_S + TURN_LINE_S) { R.spoke = true; say(R, sc.turn); }
            if (R.t >= TURN_S + TURN_HOLD_S) { R.frozen = snapshot(R); go(R, 'land'); }
            return;
        }
        if (R.phase === 'land') { if (R.t >= LAND_S) { R.frozen = null; go(R, 'meadow'); } return; }
        if (R.phase === 'meadow') {
            if (R.t > 0.5) EA.bakeNext(R.eden);                                     // Eden from orbit, one size per frame, while they settle
            if (!R.spoke && R.t >= MEADOW_LINE_S) { R.spoke = true; say(R, sc.closing); }
            if (R.t >= MEADOW_S) { hush(R); go(R, 'rise'); }
            return;
        }
        if (R.phase === 'rise') { if (R.t >= RISE_S) go(R, 'shrink'); return; }
        if (R.phase === 'shrink') { if (R.t >= SHRINK_S) go(R, 'point'); return; }
        if (R.phase === 'point') {
            const last = sc.discLine;
            if (last && !R.spoke && R.t >= POINT_LINE_S) { R.spoke = true; say(R, { who: null, say: last }, true); }
            if (R.t >= POINT_LINE_S + (last ? CARD_AFTER_S : 1.6)) showCard(R);
        }
    }
    /** The copy: down through the clouds, the ground and the crew's line, the tilt up, the night and its last lines, the card. */
    function updateCopy(R, dt) {
        const sc = R.ending.scene;
        if (R.phase === 'descent') { if (R.t >= DESCENT_S) { R.frozen = snapshot(R); go(R, 'land'); } return; }
        if (R.phase === 'land') { if (R.t >= COPY_LAND_S) { R.frozen = null; R.lineAt = 0; go(R, 'ground'); } return; }
        if (R.phase === 'ground') {
            const lines = sc.ground || [];
            while (R.lineAt < lines.length && R.t >= GROUND_LINE_S + R.lineAt * GROUND_GAP_S) say(R, lines[R.lineAt++]);
            if (R.t >= GROUND_S) { hush(R); R.lineAt = 0; go(R, 'tilt'); }
            return;
        }
        if (R.phase === 'tilt') { if (R.t >= TILT_S) { R.lineAt = 0; go(R, 'night'); } return; }
        if (R.phase === 'night') {
            const lines = sc.night || [];
            while (R.lineAt < lines.length && R.t >= NIGHT_LINE_S + R.lineAt * NIGHT_GAP_S) { say(R, lines[R.lineAt], R.lineAt === lines.length - 1); R.lineAt++; }
            if (R.t >= NIGHT_LINE_S + Math.max(0, lines.length - 1) * NIGHT_GAP_S + CARD_AFTER_S) showCard(R);
        }
    }
    function snapshot(R) {
        const c = document.createElement('canvas'); c.width = R.G.W; c.height = R.G.H;
        c.getContext('2d').drawImage(R.ui.canvas, 0, 0);
        return c;
    }

    // ── the one held moment: "Keep going" ──
    function showKeep(R) {
        const ui = R.ui;
        ui.keepVerb.textContent = R.ending.scene.keepGoing || 'Keep going';
        ui.keep.hidden = false;
        if (window.ChoiceGuard) window.ChoiceGuard.hold(ui.keep, KEEP_GUARD_MS);
        R.keepAt = performance.now();
        void ui.keep.offsetWidth; ui.keep.classList.add('is-in');
    }
    function keepGoing(R) {
        if (R.phase !== 'hold' || R.ui.keep.hidden || performance.now() - R.keepAt < KEEP_GUARD_MS) return false;
        R.ui.keep.classList.remove('is-in'); R.ui.keep.hidden = true;
        hush(R);
        R.damaged = {}; R.label = null;                                             // nobody speaks now; the alarms stop
        go(R, 'push');
        return true;
    }
    /** Esc: flying in, straight to the held moment (the choice is still the player's); after it, to the end card. */
    function skip(R) {
        if (!R.ready || R.phase === 'card') return;                                 // nothing to skip before the pictures are built
        if (R.kind === 'light' && R.phase === 'fly') {
            R.s = HOLD_AT; while (R.lineAt < R.ending.scene.flight.length) R.lineAt++;
            ALARMS.forEach(a => { R.damaged[a.deck] = true; if (a.label) R.label = a.label; });
            go(R, 'hold'); say(R, R.ending.scene.hold, true);
            return;
        }
        if (R.kind === 'light' && R.phase === 'hold') return;                       // only "Keep going" leaves the held moment
        if (R.kind === 'copy') { R.frozen = null; go(R, 'night'); R.lineAt = 99; showCard(R); return; }
        if (R.kind === 'light') { if (!R.calm) R.calm = CA.build(R.G.W, R.G.H, R.ending.living); go(R, 'calm'); R.t = DAWN_S + LINE_AFTER_S; R.spoke = true; say(R, R.ending.scene.closing, true); showCard(R); return; }
        R.frozen = null; go(R, 'point'); R.spoke = true; showCard(R);
    }

    // ── the end card: the last picture under ink in Bayer steps, the name, three lines, "New game" ──
    function showCard(R) {
        if (R.phase === 'card' || R.cardShown) return;
        R.cardShown = true;
        R.cardFrom = R.phase;
        go(R, 'card');
        hush(R);
        const ui = R.ui;
        ui.title.textContent = R.ending.title;
        ui.lines.innerHTML = (R.ending.text || []).map(t => `<p>${esc(t)}</p>`).join('');
        ui.card.classList.toggle('is-low', R.kind === 'eden');
        ui.card.hidden = false;
        if (window.ChoiceGuard) window.ChoiceGuard.hold(ui.card, GUARD_MS);
        void ui.card.offsetWidth; ui.card.classList.add('is-in');
        try { ui.card.focus({ preventScroll: true }); } catch (err) { /* nothing to focus */ }
        R.resolve();
    }
    function newGame() {
        try { localStorage.removeItem('silentExodus_save'); } catch (err) { /* storage blocked: the reload still starts fresh */ }
        location.reload();                                                          // like every end screen: nothing from this run survives
    }

    // ════════════════════════════════════════ drawing ════════════════════════════════════════
    function render(R, ms) {
        const { W, H } = R.G, ctx = R.ctx, sc = R.ending.scene;
        const phase = R.phase === 'card' ? R.cardFrom : R.phase, t = R.t;
        const flash = isCalmMotion() || Math.floor(R.clock * 2) % 2 === 0;
        const shakeOf = s => (isCalmMotion() ? 0 : 1.4 * ss(0.4, 1, s) + 2.2 * R.jolt);
        if (R.kind === 'light') {
            if (phase === 'fly' || phase === 'hold' || phase === 'push' || phase === 'white') {
                const isWhite = phase === 'white', k = isWhite ? clamp01(t / WHITE_S) : 0;
                const sway = isCalmMotion() ? [0, 0] : [Math.sin(R.clock * 0.3) * 5 * (1 - R.s), Math.cos(R.clock * 0.23) * 3 * (1 - R.s)];
                LA.draw(ctx, R.light, {
                    phase: isWhite ? 'white' : 'fly', s: R.s, k, off: sway, shake: shakeOf(R.s), clock: R.clock, damaged: R.damaged, flash,
                    label: R.label, edges: phase !== 'white' && Object.keys(R.damaged).length > 0, plume: 0.4 + 0.5 * Math.min(1, R.s),
                    white: isWhite ? ss(0, 1, k) ** 1.4 * 1.05 : 0, words: wordBoxes(R),
                }, ms);
            } else if (phase === 'quiet') {
                ctx.fillStyle = LA.WHITE; ctx.fillRect(0, 0, W, H);
            } else if (R.calm) {
                CA.draw(ctx, R.calm, ms);
                const dawn = R.phase === 'calm' ? 1 - ss(0, 1, t / DAWN_S) : 0;
                if (dawn > 0) LA.white(ctx, W, H, dawn * 1.05);                   // the white clears into the calm place
                else if (R.phase !== 'card') drawVeil(R);
            }
        } else if (R.kind === 'copy') {
            const A = R.copy;
            if (phase === 'descent') CP.drawDescent(ctx, A, clamp01(t / DESCENT_S), ms);
            else if (phase === 'land') { CP.drawGround(ctx, A, 0, ms, 0); if (R.frozen) dissolve(ctx, R.aux, R.frozen, W, H, 1 - clamp01(t / COPY_LAND_S)); }
            else if (phase === 'ground') CP.drawGround(ctx, A, t, ms, 0);
            else if (phase === 'tilt') {                                                // the view tilts up: the ground slides away, the night comes over it
                const k = clamp01(t / TILT_S);
                CP.drawNight(ctx, A, ms);
                CP.drawGround(R.aux2.getContext('2d'), A, GROUND_S, ms, k);
                dissolve(ctx, R.aux, R.aux2, W, H, 1 - ss(0.3, 1, k));
            } else CP.drawNight(ctx, A, ms);
            if (R.phase !== 'card') { if (phase === 'night') LA.shade(ctx, W, H, wordBoxes(R)); else drawVeil(R); }
        } else if (phase === 'turn') {
            LA.draw(ctx, R.light, { phase: 'turn', s: 0.62, k: clamp01(t / TURN_S), from: { s: 0.62, off: [0, 0] }, edenK: clamp01((t - 0.7) / (TURN_S - 0.7)),
                off: [0, 0], shake: 0, clock: R.clock, damaged: {}, flash: false, plume: 0.55, white: 0, words: wordBoxes(R) }, ms);
        } else if (phase === 'land' || phase === 'meadow' || phase === 'rise') {
            const rise = phase === 'rise' ? clamp01(t / RISE_S) : 0, settled = phase === 'meadow' ? t : phase === 'land' ? 0 : 99;
            if (rise > 0.6) {                                                       // the last of the rise dissolves into Eden from orbit
                EA.drawGlobe(ctx, R.eden, 0, ms);
                EA.drawMeadow(R.aux2.getContext('2d'), R.eden, settled, ms, rise);
                dissolve(ctx, R.aux, R.aux2, W, H, 1 - ss(0.6, 1, rise));
            } else EA.drawMeadow(ctx, R.eden, settled, ms, rise);
            if (phase === 'land' && R.frozen) dissolve(ctx, R.aux, R.frozen, W, H, 1 - clamp01(t / LAND_S));
            if (R.phase !== 'card') drawVeil(R);
        } else {
            EA.drawGlobe(ctx, R.eden, phase === 'shrink' ? clamp01(t / SHRINK_S) * EA.POINT_AT : 1, ms);
            if (R.phase !== 'card') LA.shade(ctx, W, H, wordBoxes(R));
        }
        if (R.clock < IN_S) dim(ctx, W, H, 1 - R.clock / IN_S);                     // in from ink
        if (R.phase === 'card' && R.kind !== 'eden') LA.darken(ctx, W, H, (R.kind === 'copy' ? 0.55 : CARD_DIM) * ss(0, 0.8, R.t));   // Eden's last picture is already the dark
    }

    // ════════════════════════════════════════ playing ════════════════════════════════════════
    function frame(now) {
        const R = run;
        if (!R) return;
        R.frameId = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        const dt = Math.min(MAX_DT, (now - (R.last || now)) / 1000);
        R.last = now; R.acc += dt;
        if (R.acc < 1 / FPS - 0.002 || !R.ready) return;
        const step = Math.min(MAX_DT, R.acc) * R.speed; R.acc = 0;
        const every = R.phase !== 'card' || R.t <= 1.2 ? 1 : R.t <= CARD_SETTLE_S ? CARD_FRAME_EVERY : FPS;   // the card: only faint motion, then about once a second
        if (every > 1 && (R.idle = (R.idle || 0) + 1) % every) { R.t += step; return; }
        try {
            update(R, step);
            const t0 = performance.now();
            if (!R.broken) render(R, now);
            R.frameMs = R.frameMs * 0.9 + (performance.now() - t0) * 0.1;
            R.errors = 0;
        } catch (err) {
            console.error('NSEnding: a frame failed', err);
            if (!R.started) { fail(R, err); return; }
            if ((R.errors = (R.errors || 0) + 1) >= 3) {                            // the picture keeps failing: ink, and the card
                R.broken = true;
                R.ctx.fillStyle = INK; R.ctx.fillRect(0, 0, R.G.W, R.G.H);
                if (!R.cardShown) { try { showCard(R); } catch (err2) { fail(R, err2); } }
            }
        }
        R.started = true;
    }
    function fail(R, err) {
        stop(R);
        R.reject(err);
    }
    function stop(R) {
        if (R.frameId != null) (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(R.frameId);
        R.frameId = null;
        removeEventListener('keydown', R.onKey, true);
        removeEventListener('resize', R.onResize);
        R.ui.root.remove();
        if (run === R) run = null;
    }

    function play(app, ending, opts = {}) {
        if (run) return Promise.reject(new Error('NSEnding: an ending is already playing'));
        if (!app || !ending || !ending.scene || !Array.isArray(ending.text)) return Promise.reject(new Error('NSEnding: no ending to play'));
        if (ending.door === 'COPY' && !CP) return Promise.reject(new Error('NSEnding: the copy has no pictures (end/CopyArt.js)'));
        let ui;
        try { ui = mount(); } catch (err) { return Promise.reject(err); }
        const R = {
            app, ending, ui, kind: ending.door === 'LIGHT' ? 'light' : ending.door === 'COPY' ? 'copy' : 'eden', from: opts.from === 'eden' ? 'eden' : opts.from === 'copy' ? 'copy' : 'light',
            phase: null, t: 0, clock: 0, s: 0, lineAt: 0, alarmAt: 0, damaged: {}, label: null, jolt: 0, voiceUntil: 0, line: '',
            spoke: false, keepAt: 0, cardShown: false, cardFrom: null, speed: 1, last: 0, acc: 0, frameMs: 0, ready: false, started: false, veilK: 0,
            light: null, calm: null, eden: null, copy: null, frozen: null, frameId: null,
        };
        const done = new Promise((resolve, reject) => { R.resolve = resolve; R.reject = reject; });
        run = R;
        R.onKey = e => {
            if (run !== R) return;
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); skip(R); return; }
            if ((e.key === 'Enter' || e.key === ' ') && R.phase === 'hold' && !ui.keep.hidden) { e.preventDefault(); e.stopPropagation(); keepGoing(R); return; }
            if (R.phase === 'card') return;                                         // the card: Tab and Enter reach "New game"
            e.stopPropagation();                                                    // the game under the scene hears nothing,
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') e.preventDefault();   // and nothing under it is focused or pressed
        };
        let resizeTimer = 0;
        R.onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (run === R && R.ready) { try { rebuild(R); } catch (err) { console.error('NSEnding: resize failed', err); } } }, RESIZE_MS); };
        ui.root.addEventListener('click', e => {
            const b = e.target.closest('button[data-act]');
            if (!b) return;
            if (b.dataset.act === 'keep') keepGoing(R);
            if (b.dataset.act === 'new') newGame();
        });
        addEventListener('keydown', R.onKey, true);
        addEventListener('resize', R.onResize);
        try { measure(R); } catch (err) { stop(R); return Promise.reject(err); }
        R.ctx.fillStyle = INK; R.ctx.fillRect(0, 0, R.G.W, R.G.H);
        setTimeout(() => {                                                          // the ink shows first; the pictures are built under it
            if (run !== R) return;
            try {
                buildFirst(R);
                go(R, R.kind === 'light' ? 'fly' : R.kind === 'copy' ? 'descent' : R.from === 'light' ? 'turn' : 'meadow');
                R.ready = true;
            } catch (err) { console.error('NSEnding: the scene could not be built', err); fail(R, err); }
        }, BUILD_GAP_MS);
        R.frameId = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        return done;
    }

    window.NSEnding = Object.freeze({
        play,
        isPlaying: () => !!run,
        debug: Object.freeze({
            state: () => (run ? {
                kind: run.kind, from: run.from, phase: run.phase, t: +run.t.toFixed(2), clock: +run.clock.toFixed(2), s: +run.s.toFixed(3), line: run.line,
                voice: run.ui.voice.classList.contains('is-in'), keep: !run.ui.keep.hidden, card: !run.ui.card.hidden, alarms: Object.keys(run.damaged),
                art: run.G ? [run.G.W, run.G.H, run.G.k] : null, frameMs: +run.frameMs.toFixed(1), ready: run.ready,
                globe: run.eden ? run.eden.frames.length + '/' + run.eden.radii.length : null,
            } : null),
            speed: k => { if (run) run.speed = Math.max(0.1, Math.min(20, Number(k) || 1)); },
            keepGoing: () => (run ? (run.keepAt = performance.now() - KEEP_GUARD_MS - 1, keepGoing(run)) : false),
            skip: () => { if (run) skip(run); },
        }),
    });
})();
