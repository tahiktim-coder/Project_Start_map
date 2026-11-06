/* ═══ Silent Exodus · new screen (?new=1) · end/Ending.js: the endings, played, and the one end card ═════════════════════
   What it is: every way a run ends in the new look, as a scene (the player does not steer). One full-screen picture
   (.ns-film, so the travel view stops drawing under it):
     INTO THE LIGHT  the mockup's last approach (end/LightArt.js, prototypes/play-ideas/last-approach.js): the light grows
                     until it fills the window, every alarm goes off (the alarm word on its deck's hull plate), the crew plead
                     to turn back while A.U.R.A. reads true. Near the end the ship slows and waits: the one held moment,
                     "› Keep going". Then white, then quiet, then the calm place (end/CalmArt.js) with whoever is alive, one line.
     BACK TO EDEN    chosen at the light: the turn away (the light shrinks behind us, Eden slides into the window), then Eden's
                     meadow (end/EdenArt.js) in a short Bayer dissolve, the crew settling into the grass, one line; the camera
                     rises until the meadow is one cold point of light in the dark; with the disc aboard, one quiet last line.
                     Settled on Eden itself: the meadow first.
     THE COPY        "Go down" at the copy of Earth (stop/Copy.js): our Lander drops through clouds that never tear, a perfect
                     day by a perfect sea, the crew step out, one line; then the night: stars in rows, our ship a point of light.
     THE COLONY      the ordinary settling (call C72; end/ColonyArt.js): the world braking in, our Lander's light dropping to it,
                     the ground at dawn with one habitat lit warm, one crew line. Failure: the same ground at night, the
                     habitat's windows going red in steps, A.U.R.A.'s last line.
     THE LOSS        every game over (call C73, C71; end/LossArt.js): the hold goes dark deck by deck until A.U.R.A.'s ring is
                     the last light; the dead are named on their pod plates; she says one plain line.
   Then the end card (DESIGN.md section 3): the upper third, left on the voice column (Eden low, under the cold point); the
   ending's name, three plain lines or fewer, "› New game" (a loss or a failed colony: "› Try again"), no stats, no scores,
   40 words or fewer, a dither shade under it. No hover look until the pointer moves after it shows.
   Also: the first sight of the light (arrive): the light growing full-bleed, A.U.R.A. saying what the old reel's captions
   said, the film skip; it ends by itself and gives the screen back. And the fallback (recover): when a new-look screen will
   not start, A.U.R.A.'s line and "› Try again" over the ink, never an empty sky.
   The words: StructureEncounter.js lightEndingFor(door, state) (bundle.js endJourney), stop/CopyWords.js ending(state)
   (bundle.js endOnTheCopy), end/EndWords.js colony / loss / arrival / recover (bundle.js endInColony, showGameOver,
   showStructureModal, renderOrbit); all are DRAFTS but the ones EndWords.js names.
   Esc, or the film skip in the corner after 3 s, skips ahead (to the held moment while flying in; otherwise to the end
   card; the arrival ends). No sound of its own.
   Loaded only when the new-screen switch is on, after end/LightArt.js, CalmArt.js, EdenArt.js, CopyArt.js, ColonyArt.js,
   LossArt.js and EndWords.js.

   window.NSEnding (frozen)
     play(app, ending, { from }) → Promise    resolves once the end card is up (bundle.js drops the save then; the card's key
                                              reloads); rejects if the scene cannot start (bundle.js then shows the old end
                                              screen). ending.door: 'LIGHT' | 'EDEN' | 'COPY' | 'COLONY' | 'LOSS'
     arrive(app, 'light') → Promise           the first sight of the light; resolves when it ends or is skipped
     recover(app, retry)                      A.U.R.A.'s line and "› Try again" (retry() is called, the line goes)
     isPlaying() → bool
     debug: { state(), speed(k), keepGoing(), skip() }         for the headless runs (speed k runs the clock k times as fast)
*/
(function () {
    'use strict';
    const P = window.NSPaint, LA = window.NSLightArt, CA = window.NSCalmArt, EA = window.NSEdenArt, CP = window.NSCopyArt;
    const CO = window.NSColonyArt, LO = window.NSLossArt, EW = window.NSEndWords;
    if (!window.NEW_SCREEN || !P || !LA || !CA || !EA) return;
    const { INK, clamp01, threshold } = P;
    const ss = P.smooth;

    const ART_ROWS = 360, MIN_ROWS = 280, FPS = 30, MAX_DT = 0.1, RESIZE_MS = 150, BUILD_GAP_MS = 40, STEP_S = 0.125;
    // into the light (s): the approach runs to HOLD_AT, waits, and the last push takes it in
    const APPROACH_S = 34, HOLD_AT = 0.88, KEEP_AFTER_S = 1.4, PUSH_S = 3.2, WHITE_S = 3.4, QUIET_S = 1.8, DAWN_S = 2.8;
    // back to Eden (s): LAND_S, the globe-to-meadow dissolve, in four Bayer steps
    const TURN_S = 3.8, TURN_LINE_S = 0.9, TURN_HOLD_S = 3.4, LAND_S = 0.5, MEADOW_LINE_S = 3.9, MEADOW_S = 9.2, RISE_S = 1.6, SHRINK_S = 5.4, POINT_LINE_S = 1.0;
    // the copy (s): the descent, the landing's dissolve, the ground (its two lines), the tilt up, the night (its two lines)
    const DESCENT_S = 6.4, COPY_LAND_S = 0.5, GROUND_S = 13.4, GROUND_LINE_S = 6.6, GROUND_GAP_S = 3.4, TILT_S = 3.6, NIGHT_LINE_S = 1.4, NIGHT_GAP_S = 4.4;
    // the colony (s): the brake, the drop, the landing's dissolve, the line on the ground; failure: the windows go red, then her line
    const BRAKE_S = 3.4, DROP_S = 2.4, CO_LAND_S = 0.5, CO_LINE_S = 1.4, RED_AT_S = 0.8, RED_S = 1.2, FAIL_LINE_S = 2.6;
    // the loss (s into the drain): each band, then the hold's lamps, then the pods one at a time; her line after
    const LIT_S = 1.4, DRAIN = { below: 0, above: 0.7, hold: 1.4, pods: 2.6, podGap: 0.45, band: 0.5, holdS: 1, pod: 0.5 }, LOSS_LINE_S = 0.6;
    // the first sight of the light (s): the light grows from ARRIVE_K0 to ARRIVE_K1 (LightArt's s), then steps out to the ink
    const ARRIVE_S = 8.4, ARRIVE_OUT_S = 0.5, ARRIVE_K0 = 0.2, ARRIVE_K1 = 0.62;
    // all of them
    const IN_S = 0.9, LINE_AFTER_S = 0.9, CARD_AFTER_S = 3.8, CARD_DIM = 0.75, GUARD_MS = 900, KEEP_GUARD_MS = 400, CARD_FRAME_EVERY = 4, CARD_SETTLE_S = 3, VEIL_RATE = 4, SKIP_AFTER_S = 3;
    // the ship's alarms, in shares of the approach: the deck that turns emergency red and the word on its hull plate (the mockup's)
    const ALARMS = [
        { at: 0.18, deck: 'engineering', label: 'HULL TEMPERATURE' }, { at: 0.3, deck: 'bridge' }, { at: 0.42, deck: 'lab' },
        { at: 0.5, deck: 'quarters', label: 'RADIATION' }, { at: 0.62, deck: 'cargo' }, { at: 0.74, deck: 'upgrades' },
    ];
    const ROLE = { cora: 'LEADER', jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' };
    const KIND = { LIGHT: 'light', EDEN: 'eden', COPY: 'copy', COLONY: 'colony', LOSS: 'loss', ARRIVE: 'arrive' };
    const isCalmMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    /** n steps over dur seconds, t seconds in: 0, 1/n .. 1 (the house's stepped motion). */
    const stepped = (t, dur, n) => (t <= 0 ? 0 : clamp01(Math.floor(t / (dur / n)) / n));

    // the tokens are tokens.css's (html.ns-on); only the face cell's size is this file's own
    const CSS = `
.ns-end { position: fixed; inset: 0; z-index: 5000; overflow: hidden; background: var(--ink); cursor: default; user-select: none; -webkit-user-select: none;
    --face: calc(48px + 24px * var(--t)); color: var(--text); font: 400 15px/1.4 var(--f-text); -webkit-font-smoothing: antialiased; }
.ns-end p, .ns-end h2 { margin: 0; }
.ns-end button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; }
.nse-art { position: absolute; left: 0; top: 0; display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.nse-voice { position: absolute; left: max(16px, 6vw); top: 8vh; display: grid; grid-template-columns: var(--face) minmax(0, 1fr); gap: 0 18px; align-items: start;
    width: max-content; max-width: min(calc(600px + 200px * var(--t)), calc(100vw - 32px)); text-shadow: var(--shadow); pointer-events: none; opacity: 0; transition: opacity 180ms steps(3, end); }
.nse-voice.is-in { opacity: 1; }
.nse-cell { display: grid; place-items: center; width: var(--face); height: var(--face); }
.nse-face { display: block; width: 100%; height: 100%; background: var(--ink); }
.nse-aura { display: block; width: 46%; height: 46%; border: 2px solid var(--tone-aura); border-radius: 50%; }
.nse-face[hidden], .nse-aura[hidden], .nse-ring[hidden], .nse-keep[hidden], .nse-card[hidden], .nse-skip[hidden] { display: none; }
.nse-text { display: grid; gap: var(--s2); padding-top: 2px; }
.nse-who { display: flex; align-items: center; gap: var(--s2); font: 500 var(--fs-who)/1 var(--f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: var(--tone, var(--warm)); }
.nse-ring { flex: none; width: 0.82em; height: 0.82em; border: 1px solid currentColor; border-radius: 50%; }
.nse-voice.is-narr .nse-who { display: none; }
.nse-say { font: 400 var(--fs-voice)/1.36 var(--f-text); color: var(--text); text-wrap: pretty; }
.nse-voice.is-narr .nse-say { font-style: italic; color: var(--narr); }
.nse-voice.tone-cora { --tone: var(--tone-cora); } .nse-voice.tone-jaxon { --tone: var(--tone-jaxon); } .nse-voice.tone-aris { --tone: var(--tone-aris); }
.nse-voice.tone-vance { --tone: var(--tone-vance); } .nse-voice.tone-mira { --tone: var(--tone-mira); } .nse-voice.tone-aura { --tone: var(--tone-aura); }
.nse-keep { margin-top: var(--s3); pointer-events: auto; }
.ns-end .nse-go { display: inline-flex; align-items: baseline; gap: var(--s2); padding: var(--s2) 0; font: 400 var(--fs-key)/1.25 var(--f-text); color: var(--warm); text-shadow: var(--shadow); }
.nse-go .nse-mark { font: 500 var(--fs-key)/1 var(--f-ui); }
.ns-end.is-hover .nse-go:hover, .ns-end .nse-go:focus-visible, .ns-end .nse-go:active { color: var(--warm-br); outline: none; }
.nse-card { position: absolute; left: max(16px, 6vw); top: 14vh; width: min(calc(560px + 60px * var(--t)), calc(100vw - 32px)); display: grid; gap: var(--s3);
    text-shadow: var(--shadow); opacity: 0; transition: opacity 480ms steps(4, end); outline: none; }
.nse-card.is-in { opacity: 1; }
.nse-card.is-low { top: 62vh; }                                  /* Eden: under the cold point, low in the dark */
.nse-title { font: 600 var(--fs-title)/1.05 var(--f-ui); letter-spacing: 0.02em; color: var(--text); }
.nse-lines { display: grid; gap: var(--s2); margin: var(--s1) 0 var(--s2); }
.nse-lines:empty { display: none; }
.nse-lines p { font: 400 20px/1.45 var(--f-text); color: var(--text-2); text-wrap: pretty; }
.nse-whole { white-space: nowrap; }
.nse-card .nse-go { justify-self: start; }
.ns-end .nse-skip { position: absolute; right: max(16px, 4vw); bottom: max(16px, 5vh); padding: var(--s2) 0; font: 500 var(--fs-skip)/1 var(--f-ui); letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--dim); text-shadow: var(--shadow); opacity: 0; transition: opacity 180ms steps(3, end); }
.nse-skip.is-in { opacity: 1; }
.ns-end.is-hover .nse-skip:hover, .ns-end .nse-skip:focus-visible { color: var(--text); outline: none; }
@media (prefers-reduced-motion: reduce) { .nse-voice, .nse-card, .nse-skip { transition: none; } }
`;
    function injectCss() {
        if (document.getElementById('nse-css')) return;
        const s = document.createElement('style'); s.id = 'nse-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const KEY = (act, verb) => `<button type="button" class="nse-go" data-act="${act}"><span class="nse-mark" aria-hidden="true">›</span><span class="nse-verb">${esc(verb)}</span></button>`;
    // the voice: the face cell first for every speaker (a portrait, A.U.R.A.'s ring, or empty for the narrator), so the line
    // never moves sideways when the speaker changes
    const VOICE = '<div class="nse-voice" aria-live="polite"><span class="nse-cell"><img class="nse-face" alt="" hidden><span class="nse-aura" hidden></span></span>'
        + '<div class="nse-text"><p class="nse-who"><span class="nse-ring" hidden></span><span class="nse-name"></span></p><p class="nse-say"></p>'
        + `<div class="nse-keep" hidden>${KEY('keep', '')}</div></div></div>`;

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
        root.innerHTML = '<canvas class="nse-art" aria-hidden="true"></canvas>' + VOICE
            + '<section class="nse-card" hidden tabindex="-1"><h2 class="nse-title"></h2><div class="nse-lines"></div>' + KEY('new', 'New game') + '</section>'
            + `<button type="button" class="nse-skip" data-act="skip" hidden>${esc(EW ? EW.WORDS.keys.skip : 'Skip')} ›</button>`;
        document.body.appendChild(root);
        const q = s => root.querySelector(s);
        return { root, canvas: q('.nse-art'), voice: q('.nse-voice'), face: q('.nse-face'), aura: q('.nse-aura'), ring: q('.nse-ring'), name: q('.nse-name'), say: q('.nse-say'),
            keep: q('.nse-keep'), keepVerb: q('.nse-keep .nse-verb'), card: q('.nse-card'), title: q('.nse-title'), lines: q('.nse-lines'), cardVerb: q('.nse-card .nse-verb'), skip: q('.nse-skip') };
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
        R.ui.root.style.setProperty('--face', Math.round(24 * k / dpr) + 'px');
        R.G = { k, W, H, dpr };
    }
    const member = (R, id) => ((R.app.state && R.app.state.crew) || []).find(c => (c.tags || []).includes(ROLE[id])) || null;
    function edenNode(R) { return ((R.app.state && R.app.state.sectorNodes) || []).find(n => n && (n.isEden || n.type === 'EDEN')) || null; }

    /** The pictures this run needs now (built while the screen is ink, white or quiet; the rest one per idle slot). */
    function buildFirst(R) {
        const { W, H } = R.G, E = R.ending, st = R.app.state || {};
        if (R.kind === 'copy') { R.copy = CP.build(W, H, E.living); return; }
        if (R.kind === 'light' || R.kind === 'arrive') { R.light = LA.create(W, H); return; }
        if (R.kind === 'colony') { R.colony = CO.build(W, H, { node: E.planet, sector: st.currentSector || 1, ids: E.living, night: !E.success }); return; }
        if (R.kind === 'loss') {
            const names = {};
            (E.dead || []).forEach(id => { const m = member(R, id); if (m) names[id] = m.name; });
            R.loss = LO.build(W, H, { names });
            return;
        }
        if (R.from === 'light') { R.light = LA.create(W, H); LA.eden(R.light, edenNode(R)); }
        R.eden = EA.build(W, H, E.living, edenNode(R));
        EA.bakeNext(R.eden);                                                        // the largest Eden from orbit now: the rest while they settle
    }
    function rebuild(R) {
        measure(R);
        if (R.broken) return;
        const { W, H } = R.G;
        if (R.light) { const hadEden = !!R.light.eden; R.light = LA.create(W, H); if (hadEden) LA.eden(R.light, edenNode(R)); }
        if (R.calm) R.calm = CA.build(W, H, R.ending.living);
        if (R.eden) { R.eden = EA.build(W, H, R.ending.living, edenNode(R)); EA.bakeNext(R.eden); }
        if (R.copy) R.copy = CP.build(W, H, R.ending.living);
        if (R.colony || R.loss) buildFirst(R);
        if (R.frozen) R.frozen = null;
    }

    // ════════════════════════════════════════ the words ════════════════════════════════════════
    /** One line at a time: the face cell (a portrait, A.U.R.A.'s ring), the name in their tone, the line. hold: stays up. */
    function say(R, line, hold) {
        const ui = R.ui, isNarr = !line.who, isAura = line.who === 'aura', m = isNarr || isAura ? null : member(R, line.who);
        const hasFace = !!(m && m.portraitId);
        ui.voice.className = 'nse-voice tone-' + (line.who || 'narr') + (isNarr ? ' is-narr' : '');
        ui.name.textContent = isAura ? 'A.U.R.A.' : m ? m.name : '';
        ui.say.textContent = line.say;
        ui.ring.hidden = isNarr;
        ui.aura.hidden = !isAura;
        ui.face.hidden = !hasFace;
        if (hasFace) ui.face.src = 'assets/crew/' + m.portraitId + '.png';
        void ui.voice.offsetWidth;
        ui.voice.classList.add('is-in');
        const words = String(line.say).split(/\s+/).length, reading = Math.min(6, Math.max(3.4, 1.8 + words * 0.3));
        R.voiceUntil = hold ? Infinity : R.clock + reading;
        R.talkUntil = isAura ? R.clock + reading : 0;
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
    /** Boxes (art px) the picture darkens under, so the words read even on the light: the voice, the skip, the card. */
    function wordBoxes(R) {
        const out = [], { k, dpr } = R.G, add = el => { const r = el.getBoundingClientRect(); if (r.width) out.push([Math.floor(r.left * dpr / k), Math.floor(r.top * dpr / k), Math.ceil(r.right * dpr / k), Math.ceil(r.bottom * dpr / k)]); };
        if (R.ui.voice.classList.contains('is-in')) add(R.ui.voice);
        if (!R.ui.skip.hidden) add(R.ui.skip);
        if (!R.ui.card.hidden) add(R.ui.card);
        return out;
    }

    // ════════════════════════════════════════ the clock ════════════════════════════════════════
    function go(R, phase) { R.phase = phase; R.t = 0; R.spoke = false; }
    const UPDATE = { light: updateLight, eden: updateEden, copy: updateCopy, colony: updateColony, loss: updateLoss, arrive: updateArrive };
    function update(R, dt) {
        R.t += dt; R.clock += dt;
        if (R.voiceUntil && R.clock > R.voiceUntil) hush(R);
        R.veilK += ((R.ui.voice.classList.contains('is-in') ? 1 : 0) - R.veilK) * Math.min(1, dt * VEIL_RATE);
        UPDATE[R.kind](R, dt);
        const canSkip = R.phase !== 'card' && R.phase !== 'out' && !(R.kind === 'light' && R.phase === 'hold');
        const showSkip = canSkip && R.clock >= SKIP_AFTER_S;                        // the film skip, in the corner, after 3 s
        if (showSkip === R.ui.skip.hidden) {
            R.ui.skip.hidden = !showSkip;
            if (showSkip) { void R.ui.skip.offsetWidth; R.ui.skip.classList.add('is-in'); } else R.ui.skip.classList.remove('is-in');
        }
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
                if (a.label) R.label = { text: a.label, deck: a.deck };
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
    function updateCopy(R) {
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
    /** The colony: the world brakes in, our Lander's light drops to it, the ground (dawn, or night when it failed), one line. */
    function updateColony(R) {
        const line = R.ending.scene.line;
        if (R.phase === 'brake') { CO.bakeNext(R.colony); if (R.t >= BRAKE_S) go(R, 'drop'); return; }
        if (R.phase === 'drop') { if (R.t >= DROP_S) { R.frozen = snapshot(R); go(R, 'land'); } return; }
        if (R.phase === 'land') { if (R.t >= CO_LAND_S) { R.frozen = null; go(R, 'ground'); } return; }
        if (R.phase !== 'ground') return;
        const sayAt = R.ending.success ? CO_LINE_S : FAIL_LINE_S;
        if (!R.ending.success) R.red = stepped(R.t - RED_AT_S, RED_S, 4);
        if (!R.spoke && R.t >= sayAt) { R.spoke = true; if (line) say(R, line, true); }
        if (R.t >= sayAt + CARD_AFTER_S) showCard(R);
    }
    /** The loss: the ship lit a moment, then dark band by band, the hold's lamps, each pod in turn; her line; the card. */
    function lossDrainEnd() { return DRAIN.pods + 4 * DRAIN.podGap + DRAIN.pod; }
    function updateLoss(R) {
        const D = R.dark, line = R.ending.scene.line;
        D.talking = R.talkUntil > R.clock;
        if (R.phase === 'lit') { if (R.t >= LIT_S) go(R, 'drain'); return; }
        if (R.phase !== 'drain') return;
        const t = R.t, end = lossDrainEnd();
        D.below = stepped(t - DRAIN.below, DRAIN.band, 4); D.above = stepped(t - DRAIN.above, DRAIN.band, 4); D.hold = stepped(t - DRAIN.hold, DRAIN.holdS, 8);
        D.pods = [0, 1, 2, 3, 4].map(i => stepped(t - DRAIN.pods - i * DRAIN.podGap, DRAIN.pod, 4));
        if (!R.spoke && t >= end + LOSS_LINE_S) { R.spoke = true; if (line) say(R, line, true); }
        if (t >= end + LOSS_LINE_S + CARD_AFTER_S) showCard(R);
    }
    /** The first sight of the light: it grows, A.U.R.A. says what the reel's captions said, then it steps out to the ink. */
    function updateArrive(R, dt) {
        const lines = R.ending.scene.flight;
        LA.tick(R.light, dt, 0.35 + 1.2 * R.s);
        if (R.phase === 'fly') {
            R.s = ARRIVE_K0 + (ARRIVE_K1 - ARRIVE_K0) * ss(0, 1, R.t / ARRIVE_S);
            while (R.lineAt < lines.length && R.t >= lines[R.lineAt].at) { say(R, lines[R.lineAt], R.lineAt === lines.length - 1); R.lineAt++; }
            if (R.t >= ARRIVE_S) { hush(R); go(R, 'out'); }
            return;
        }
        if (R.phase === 'out' && R.t >= ARRIVE_OUT_S) { stop(R); R.resolve(); }
    }
    function snapshot(R) {
        const c = document.createElement('canvas'); c.width = R.G.W; c.height = R.G.H;
        c.getContext('2d').drawImage(R.ui.canvas, 0, 0);
        return c;
    }

    // ── the one held moment: "› Keep going", in the voice column under A.U.R.A.'s line ──
    function showKeep(R) {
        const ui = R.ui;
        ui.keepVerb.textContent = R.ending.scene.keepGoing || 'Keep going';
        ui.root.classList.remove('is-hover');                                       // no hover look until the pointer moves
        ui.keep.hidden = false;
        if (window.ChoiceGuard) window.ChoiceGuard.hold(ui.keep, KEEP_GUARD_MS);
        R.keepAt = performance.now();
    }
    function keepGoing(R) {
        if (R.phase !== 'hold' || R.ui.keep.hidden || performance.now() - R.keepAt < KEEP_GUARD_MS) return false;
        R.ui.keep.hidden = true;
        hush(R);
        R.damaged = {}; R.label = null;                                             // nobody speaks now; the alarms stop
        go(R, 'push');
        return true;
    }
    /** Esc or the film skip: flying in, straight to the held moment (the choice is still the player's); after it, to the end
        card; the arrival ends. */
    function skip(R) {
        if (!R.ready || R.phase === 'card') return;                                 // nothing to skip before the pictures are built
        if (R.kind === 'arrive') { if (R.phase === 'fly') { hush(R); go(R, 'out'); } return; }
        if (R.kind === 'light' && R.phase === 'fly') {
            R.s = HOLD_AT; while (R.lineAt < R.ending.scene.flight.length) R.lineAt++;
            ALARMS.forEach(a => { R.damaged[a.deck] = true; if (a.label) R.label = { text: a.label, deck: a.deck }; });
            go(R, 'hold'); say(R, R.ending.scene.hold, true);
            return;
        }
        if (R.kind === 'light' && R.phase === 'hold') return;                       // only "Keep going" leaves the held moment
        if (R.kind === 'copy') { R.frozen = null; go(R, 'night'); R.lineAt = 99; showCard(R); return; }
        if (R.kind === 'light') { if (!R.calm) R.calm = CA.build(R.G.W, R.G.H, R.ending.living); go(R, 'calm'); R.t = DAWN_S + LINE_AFTER_S; R.spoke = true; say(R, R.ending.scene.closing, true); showCard(R); return; }
        if (R.kind === 'colony') {
            R.frozen = null; go(R, 'ground'); R.t = 9; R.spoke = true;
            if (!R.ending.success) R.red = 1;
            if (R.ending.scene.line) say(R, R.ending.scene.line, true);
            showCard(R);
            return;
        }
        if (R.kind === 'loss') {
            Object.assign(R.dark, { below: 1, above: 1, hold: 1, pods: [1, 1, 1, 1, 1] });
            go(R, 'drain'); R.t = 99; R.spoke = true;
            if (R.ending.scene.line) say(R, R.ending.scene.line, true);
            showCard(R);
            return;
        }
        R.frozen = null; go(R, 'point'); R.spoke = true; showCard(R);
    }

    // ── the end card: the last picture under ink in Bayer steps, the name, the lines, the key ──
    function showCard(R) {
        if (R.phase === 'card' || R.cardShown) return;
        R.cardShown = true;
        R.cardFrom = R.phase;
        go(R, 'card');
        hush(R);
        const ui = R.ui, isAgain = R.kind === 'loss' || (R.kind === 'colony' && !R.ending.success);
        ui.title.textContent = R.ending.title;
        ui.lines.innerHTML = (R.ending.card || R.ending.text || [])                  // card: the light's and Eden's new-look lines
            .map(t => `<p>${esc(t).replace(/\S+-\S+/g, w => `<span class="nse-whole">${w}</span>`)}</p>`).join('');   // a world's name never breaks at its hyphen
        ui.cardVerb.textContent = isAgain && EW ? EW.WORDS.keys.again : 'New game';
        ui.card.classList.toggle('is-low', R.kind === 'eden');
        ui.root.classList.remove('is-hover');                                       // the click that got here is not a hover
        ui.card.hidden = false;
        if (window.ChoiceGuard) window.ChoiceGuard.hold(ui.card, GUARD_MS);
        void ui.card.offsetWidth; ui.card.classList.add('is-in');
        try { ui.card.focus({ preventScroll: true }); } catch (err) { /* nothing to focus */ }
        R.resolve();
    }
    function newGame() {
        try { localStorage.removeItem(window.SAVE_KEY || 'silentExodus_save'); } catch (err) { /* storage blocked: the reload still starts fresh */ }   // (a try tab: its own key)
        location.reload();                                                          // like every end screen: nothing from this run survives
    }

    // ════════════════════════════════════════ drawing ════════════════════════════════════════
    function renderLight(R, ms, phase, t) {
        const { W, H } = R.G, ctx = R.ctx;
        const flash = isCalmMotion() || Math.floor(R.clock * 2) % 2 === 0;
        const shake = isCalmMotion() ? 0 : 1.4 * ss(0.4, 1, R.s) + 2.2 * R.jolt;
        if (phase === 'fly' || phase === 'hold' || phase === 'push' || phase === 'white' || phase === 'out') {
            const isWhite = phase === 'white', k = isWhite ? clamp01(t / WHITE_S) : 0;
            const sway = isCalmMotion() ? [0, 0] : [Math.sin(R.clock * 0.3) * 5 * (1 - R.s), Math.cos(R.clock * 0.23) * 3 * (1 - R.s)];
            LA.draw(ctx, R.light, {
                phase: isWhite ? 'white' : 'fly', s: R.s, k, off: sway, shake, clock: R.clock, damaged: R.damaged, flash,
                label: R.label, edges: phase !== 'white' && Object.keys(R.damaged).length > 0, plume: 0.4 + 0.5 * Math.min(1, R.s),
                white: isWhite ? ss(0, 1, k) ** 1.4 * 1.05 : 0, words: wordBoxes(R),
            }, ms);
            if (phase === 'out') dim(ctx, W, H, stepped(t, ARRIVE_OUT_S, 4));
        } else if (phase === 'quiet') {
            ctx.fillStyle = LA.WHITE; ctx.fillRect(0, 0, W, H);
        } else if (R.calm) {
            CA.draw(ctx, R.calm, ms);
            const dawn = R.phase === 'calm' ? 1 - ss(0, 1, t / DAWN_S) : 0;
            if (dawn > 0) LA.white(ctx, W, H, dawn * 1.05);                       // the white clears into the calm place
            else if (R.phase !== 'card') drawVeil(R);
        }
    }
    function renderCopy(R, ms, phase, t) {
        const { W, H } = R.G, ctx = R.ctx, A = R.copy;
        if (phase === 'descent') CP.drawDescent(ctx, A, clamp01(t / DESCENT_S), ms);
        else if (phase === 'land') { CP.drawGround(ctx, A, 0, ms, 0); if (R.frozen) dissolve(ctx, R.aux, R.frozen, W, H, 1 - stepped(t, COPY_LAND_S, 4)); }
        else if (phase === 'ground') CP.drawGround(ctx, A, t, ms, 0);
        else if (phase === 'tilt') {                                                // the view tilts up: the ground slides away, the night comes over it
            const k = clamp01(t / TILT_S);
            CP.drawNight(ctx, A, ms);
            CP.drawGround(R.aux2.getContext('2d'), A, GROUND_S, ms, k);
            dissolve(ctx, R.aux, R.aux2, W, H, 1 - ss(0.3, 1, k));
        } else CP.drawNight(ctx, A, ms);
        if (R.phase !== 'card') { if (phase === 'night') LA.shade(ctx, W, H, wordBoxes(R)); else drawVeil(R); }
    }
    function renderEden(R, ms, phase, t) {
        const { W, H } = R.G, ctx = R.ctx;
        if (phase === 'turn') {
            LA.draw(ctx, R.light, { phase: 'turn', s: 0.62, k: clamp01(t / TURN_S), from: { s: 0.62, off: [0, 0] }, edenK: clamp01((t - 0.7) / (TURN_S - 0.7)),
                off: [0, 0], shake: 0, clock: R.clock, damaged: {}, flash: false, plume: 0.55, white: 0, words: wordBoxes(R) }, ms);
        } else if (phase === 'land' || phase === 'meadow' || phase === 'rise') {
            const rise = phase === 'rise' ? clamp01(t / RISE_S) : 0, settled = phase === 'meadow' ? t : phase === 'land' ? 0 : 99;
            if (rise > 0.6) {                                                       // the last of the rise dissolves into Eden from orbit, in four steps
                EA.drawGlobe(ctx, R.eden, 0, ms);
                EA.drawMeadow(R.aux2.getContext('2d'), R.eden, settled, ms, rise);
                dissolve(ctx, R.aux, R.aux2, W, H, 1 - stepped(t - 0.6 * RISE_S, 0.4 * RISE_S, 4));
            } else EA.drawMeadow(ctx, R.eden, settled, ms, rise);
            if (phase === 'land' && R.frozen) dissolve(ctx, R.aux, R.frozen, W, H, 1 - stepped(t, LAND_S, 4));   // the globe to the meadow, four steps
            if (R.phase !== 'card') drawVeil(R);
        } else {
            EA.drawGlobe(ctx, R.eden, phase === 'shrink' ? clamp01(t / SHRINK_S) * EA.POINT_AT : 1, ms);
            if (R.phase !== 'card') LA.shade(ctx, W, H, wordBoxes(R));
        }
    }
    function renderColony(R, ms, phase, t) {
        const { W, H } = R.G, ctx = R.ctx, A = R.colony;
        if (phase === 'brake') CO.drawBrake(ctx, A, clamp01(t / BRAKE_S), ms);
        else if (phase === 'drop') CO.drawDrop(ctx, A, stepped(t, DROP_S, Math.round(DROP_S / STEP_S)), ms);
        else {
            CO.drawGround(ctx, A, t, ms, R.red);
            if (phase === 'land' && R.frozen) dissolve(ctx, R.aux, R.frozen, W, H, 1 - stepped(t, CO_LAND_S, 4));
        }
        if (R.phase !== 'card' && phase !== 'brake' && phase !== 'drop') { if (A.night) LA.shade(ctx, W, H, wordBoxes(R)); else drawVeil(R); }
    }
    const RENDER = { light: renderLight, arrive: renderLight, copy: renderCopy, eden: renderEden, colony: renderColony,
        loss: (R, ms) => { LO.draw(R.ctx, R.loss, R.dark, ms); if (R.phase !== 'card') LA.shade(R.ctx, R.G.W, R.G.H, wordBoxes(R)); } };
    function render(R, ms) {
        const { W, H } = R.G, ctx = R.ctx;
        RENDER[R.kind](R, ms, R.phase === 'card' ? R.cardFrom : R.phase, R.t);
        if (R.clock < IN_S) dim(ctx, W, H, 1 - R.clock / IN_S);                     // in from ink
        if (R.phase !== 'card') return;
        if (R.kind !== 'eden' && R.kind !== 'loss') LA.darken(ctx, W, H, (R.kind === 'copy' ? 0.55 : CARD_DIM) * ss(0, 0.8, R.t));   // Eden's and the loss's last pictures are already the dark
        LA.shade(ctx, W, H, wordBoxes(R));                                          // the dither shade under the card: no star crosses its lines
    }

    // ════════════════════════════════════════ playing ════════════════════════════════════════
    function frame(now) {
        const R = run;
        if (!R) return;
        R.frameId = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        const dt = Math.min(MAX_DT, (now - (R.last || now)) / 1000);
        R.last = now; R.acc += dt;
        if (R.acc < 1 / FPS - 0.002 || !R.ready || R.broken) return;
        const step = Math.min(MAX_DT, R.acc) * R.speed; R.acc = 0;
        const every = R.phase !== 'card' || R.t <= 1.2 ? 1 : R.t <= CARD_SETTLE_S ? CARD_FRAME_EVERY : FPS;   // the card: only faint motion, then about once a second
        if (every > 1 && (R.idle = (R.idle || 0) + 1) % every) { R.t += step; return; }
        try {
            update(R, step);
            if (run !== R) return;                                                  // the arrival ended in that update
            const t0 = performance.now();
            render(R, now);
            R.frameMs = R.frameMs * 0.9 + (performance.now() - t0) * 0.1;
            R.errors = 0;
        } catch (err) {
            console.error('NSEnding: a frame failed', err);
            if (!R.started) { fail(R, err); return; }
            if ((R.errors = (R.errors || 0) + 1) >= 3) breakDown(R, err);
        }
        R.started = true;
    }
    /** The picture cannot be drawn: ink, and the end card (an arrival just ends). */
    function breakDown(R, err) {
        if (R.kind === 'arrive') { fail(R, err); return; }
        R.broken = true; R.ready = true;
        R.ctx.fillStyle = INK; R.ctx.fillRect(0, 0, R.G.W, R.G.H);
        if (!R.cardShown) { try { showCard(R); } catch (err2) { fail(R, err2); } }
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

    function start(app, ending, kind, from) {
        if (run) return Promise.reject(new Error('NSEnding: an ending is already playing'));
        let ui;
        try { ui = mount(); } catch (err) { return Promise.reject(err); }
        const R = {
            app, ending, ui, kind, from,
            phase: null, t: 0, clock: 0, s: 0, lineAt: 0, alarmAt: 0, damaged: {}, label: null, jolt: 0, voiceUntil: 0, talkUntil: 0, line: '',
            spoke: false, keepAt: 0, cardShown: false, cardFrom: null, speed: 1, last: 0, acc: 0, frameMs: 0, ready: false, started: false, broken: false, veilK: 0, red: 0,
            dark: { below: 0, above: 0, hold: 0, pods: [0, 0, 0, 0, 0], talking: false },
            light: null, calm: null, eden: null, copy: null, colony: null, loss: null, frozen: null, frameId: null,
        };
        const done = new Promise((resolve, reject) => { R.resolve = resolve; R.reject = reject; });
        run = R;
        R.onKey = e => {
            if (run !== R) return;
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); skip(R); return; }
            if ((e.key === 'Enter' || e.key === ' ') && R.phase === 'hold' && !ui.keep.hidden) { e.preventDefault(); e.stopPropagation(); keepGoing(R); return; }
            if (R.phase === 'card') return;                                         // the card: Tab and Enter reach its key
            e.stopPropagation();                                                    // the game under the scene hears nothing,
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') e.preventDefault();   // and nothing under it is focused or pressed
        };
        let resizeTimer = 0;
        R.onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (run === R && R.ready) { try { rebuild(R); } catch (err) { console.error('NSEnding: resize failed', err); } } }, RESIZE_MS); };
        ui.root.addEventListener('pointermove', () => ui.root.classList.add('is-hover'));   // the hover look only once the pointer moves
        ui.root.addEventListener('click', e => {
            const b = e.target.closest('button[data-act]');
            if (!b) return;
            if (b.dataset.act === 'keep') keepGoing(R);
            if (b.dataset.act === 'new') newGame();
            if (b.dataset.act === 'skip') skip(R);
        });
        addEventListener('keydown', R.onKey, true);
        addEventListener('resize', R.onResize);
        try { measure(R); } catch (err) { stop(R); return Promise.reject(err); }
        R.ctx.fillStyle = INK; R.ctx.fillRect(0, 0, R.G.W, R.G.H);
        const FIRST = { light: 'fly', arrive: 'fly', copy: 'descent', colony: 'brake', loss: 'lit' };
        setTimeout(() => {                                                          // the ink shows first; the pictures are built under it
            if (run !== R) return;
            try {
                buildFirst(R);
                go(R, FIRST[kind] || (from === 'light' ? 'turn' : 'meadow'));
                R.ready = true;
            } catch (err) { console.error('NSEnding: the scene could not be built', err); breakDown(R, err); }
        }, BUILD_GAP_MS);
        R.frameId = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        return done;
    }
    function play(app, ending, opts = {}) {
        if (!app || !ending || !ending.scene || !Array.isArray(ending.text)) return Promise.reject(new Error('NSEnding: no ending to play'));
        const kind = KIND[ending.door] || 'eden';
        if (kind === 'copy' && !CP) return Promise.reject(new Error('NSEnding: the copy has no pictures (end/CopyArt.js)'));
        if (kind === 'colony' && !CO) return Promise.reject(new Error('NSEnding: the colony has no pictures (end/ColonyArt.js)'));
        if (kind === 'loss' && !LO) return Promise.reject(new Error('NSEnding: the loss has no picture (end/LossArt.js)'));
        return start(app, ending, kind, opts.from === 'eden' ? 'eden' : opts.from === 'copy' ? 'copy' : 'light');
    }
    /** The first sight of the light, in place of the old reel (call C83): A.U.R.A. says what its captions said. */
    function arrive(app, what) {
        if (what !== 'light' || !app) return Promise.reject(new Error('NSEnding: nothing to arrive at'));
        const flight = EW ? EW.arrival() : [];
        return start(app, { door: 'ARRIVE', title: '', text: [], living: [], scene: { flight } }, 'arrive', 'light');
    }

    /** A new-look screen would not start: A.U.R.A.'s line and "› Try again" over the ink (never an empty sky). retry() is
        asked again with the line gone; a retry that fails puts it back. */
    function recover(app, retry) {
        injectCss();
        document.querySelectorAll('.nse-recover').forEach(n => n.remove());
        const root = document.createElement('div');
        root.className = 'ns-film ns-end nse-recover';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'A.U.R.A.');
        root.tabIndex = -1;
        root.innerHTML = VOICE;
        const q = s => root.querySelector(s), voice = q('.nse-voice');
        voice.classList.add('tone-aura');
        q('.nse-aura').hidden = false; q('.nse-ring').hidden = false;
        q('.nse-name').textContent = 'A.U.R.A.';
        q('.nse-say').textContent = EW ? EW.WORDS.recover : '';
        q('.nse-keep').hidden = false;
        const key = q('.nse-keep .nse-go');
        key.dataset.act = 'again';
        q('.nse-keep .nse-verb').textContent = EW ? EW.WORDS.keys.again : '';
        root.addEventListener('pointermove', () => root.classList.add('is-hover'));
        key.addEventListener('click', () => {
            root.remove();
            try { retry(); } catch (err) { console.error('NSEnding: the retry failed', err); recover(app, retry); }
        });
        document.body.appendChild(root);
        void voice.offsetWidth; voice.classList.add('is-in');
        try { root.focus({ preventScroll: true }); } catch (err) { /* nothing to focus */ }
        return root;
    }

    window.NSEnding = Object.freeze({
        play, arrive, recover,
        isPlaying: () => !!run,
        debug: Object.freeze({
            state: () => (run ? {
                kind: run.kind, from: run.from, phase: run.phase, t: +run.t.toFixed(2), clock: +run.clock.toFixed(2), s: +run.s.toFixed(3), line: run.line,
                voice: run.ui.voice.classList.contains('is-in'), keep: !run.ui.keep.hidden, card: !run.ui.card.hidden, skip: !run.ui.skip.hidden, alarms: Object.keys(run.damaged),
                art: run.G ? [run.G.W, run.G.H, run.G.k] : null, frameMs: +run.frameMs.toFixed(1), ready: run.ready, broken: run.broken, red: run.red,
                dark: run.kind === 'loss' ? JSON.parse(JSON.stringify(run.dark)) : null,
                globe: run.eden ? run.eden.frames.length + '/' + run.eden.radii.length : null,
            } : null),
            speed: k => { if (run) run.speed = Math.max(0.1, Math.min(20, Number(k) || 1)); },
            keepGoing: () => (run ? (run.keepAt = performance.now() - KEEP_GUARD_MS - 1, keepGoing(run)) : false),
            skip: () => { if (run) skip(run); },
        }),
    });
})();
