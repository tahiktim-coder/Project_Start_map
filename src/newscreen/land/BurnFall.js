/* ═══ Silent Exodus · new screen (?new=1) · land/BurnFall.js: THE BURN, the minigame ══════════════════════════════════
   The new look's landing (MiniHost 'land-burn'; App.flyLanding plays it before the meteor, which stays as it was): a
   rocket's soft landing. The plan and the rules: BurnFlight.js; the pictures: BurnScene.js. This file is the stage (the
   meteor's own frame rules and word styles, LandFall.js landStyle), the words, the gauges, the hands, A.U.R.A.'s marks,
   the sound, the loop, the walk out, the result and the registration. Sketch 9 (approved 2026-11-13: "Yes, build it").
   The contract is App.flyLanding's, as the meteor's: opts { planet, sector, find, team, full, carried, first, drops,
   unmarked, risk, ... }; it resolves { grade: 'soft' | 'rough' | 'crash', raw, auto, lifted, offMark, marked, hurt, routine }
   and never rejects; { fallback: true } hands the landing to LanderGame.
   A full drop (App.isFullDrop) is the long fall, flown by hand. First the entry: she comes in too fast, left and right
   hold her straight (straight she slows, tipped she stays fast and her hull cooks; the heat never hurts her). Then, when
   A.U.R.A. calls it (a blue gate stands where she will), HOLD the burn to the ground (the engine barely wins: it gives
   what she needs, up to all it has; it is never tapped). Shift (or X, or the right mouse button) is the overdrive: a
   cough, then more than all she has, for about two seconds in all. H or "Let A.U.R.A. land" hands her the rest.
   Three small gauges, no numbers: SPEED (the burn shortens it; its mark is the fastest soft touchdown), FUEL, OVERDRIVE.
   After the touchdown nothing is said for K.QUIET seconds; then the team steps out and the result is spoken.
   A routine drop is the short one: A.U.R.A. sets it down at the grade carried from the last full drop on that kind of
   world, as before; a fresh press of a flying key takes the stick, and then the landing is what was flown.
   Every line in SAY and KEY_WORDS is a stand-in (DRAFT): the designer writes the lines. The result's lines are the
   meteor's own (LandWords.js LINES).
   SOUND: burnScore, made in code on the films' kit (start/FilmSound.js: no files; it plays only when the game's sound is
   on, and never with ?mute=1). It reads the flight and changes nothing. Nobody had heard it when it was built: it was
   checked by its numbers only.

   window.LandBurn (frozen): canFly(planet), flies(), debug { state(), hands(inp | null), aura() }
*/
(function () {
    'use strict';
    const P = window.NSPaint, A = window.LandingArt, BF = window.BurnFlight, BS = window.BurnScene, WD = window.LandingWords, LW = window.LandingWorlds;
    const MiniHost = window.MiniHost, MiniLab = window.MiniLab, LG = window.LanderGame;
    if (!P || !A || !BF || !BS || !WD || !LW || !MiniHost || !MiniLab || !LG) return;
    const K = BF.K, FW = BS.FW, FH = BS.FH, WHO = WD.WHO, NAME = WD.NAME;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), clamp01 = v => clamp(v, 0, 1);
    const FLY = ['Space', 'KeyW', 'ArrowUp'], LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'], BOOST = ['ShiftLeft', 'ShiftRight', 'KeyX'];
    const BOOT_SAY_S = 1.1, BOOT_MAX_S = 9, SKIP_AFTER_S = 1.2, LINE_AT_S = K.QUIET, CRASH_LINE_AT_S = K.QUIET, HOLD_S = 2.7, FRAME_BUDGET_MS = 10, ERR_FRAMES = 5, LINE_S = 3.2;
    const WALK = { from: K.QUIET - 0.3, gap: 0.45, speed: 18, stand: 10, apart: 9 };   // the team steps out as the quiet ends: seconds, px/s, px from the light
    const V_BAR = 400;                                                              // the speed gauge is full at this fall (px/s); its small mark stands at the fastest soft touchdown
    const AIM_FAR_S = 0.4, AIM_NEAR_S = 0.12, AIM_NEAR_PX = 500;                    // how often A.U.R.A. looks ahead for her gates: seldom while the call is far, often close to it and in the burn

    // ── DRAFT lines (one idea, plain, 20 words at most; A.U.R.A. without contractions) and the keys' words ──
    const SAY = {
        entry: { who: 'aura', say: 'We are coming in too fast. Hold her straight.' },        // DRAFT: the long fall begins
        hot: who => ({ who, say: "She's cooking. Straighten her." }),                       // DRAFT: the entry, held badly
        burn: { who: 'aura', say: 'Burn now, Commander.' },                                  // DRAFT: the moment to hold
        late: { who: 'aura', say: 'We are too fast, Commander. Burn.' },                     // DRAFT: a second after it, still not burning
        over: { who: 'aura', say: 'Overdrive, Commander.' },                                 // DRAFT: burning, and all she has is no longer enough
        tip: who => ({ who, say: "She's tipping. Straighten her." }),                       // DRAFT: tipped far over in the burn
        early: { who: 'aura', say: 'Too early, Commander. Save the burn.' },                 // DRAFT: lit so early the tanks will not last
        all: who => ({ who, say: "That's all she has. Hold it." }),                         // DRAFT: the engine is at its limit
        h500: { who: 'aura', say: 'Five hundred metres.' },                                  // DRAFT: the last heights, called in the burn
        h200: { who: 'aura', say: 'Two hundred.' },                                          // DRAFT
        h50: { who: 'aura', say: 'Fifty.' },                                                 // DRAFT
        low: { who: 'aura', say: 'The tanks are nearly dry.' },                              // DRAFT: a fifth of the fuel left
        dry: { who: 'aura', say: 'The tanks are dry, Commander.' },                          // DRAFT
        aura: { who: 'aura', say: 'I have her, Commander.' },                                // DRAFT: she takes the stick
        routine: { who: 'aura', say: 'A short drop, Commander. I have her.' },               // DRAFT: a routine drop begins
        yours: { who: 'aura', say: 'She is yours, Commander.' },                             // DRAFT: we take the stick on a routine drop
    };
    const KEY_WORDS = { hold: 'or the mouse: hold to burn', over: 'overdrive', steer: 'keep her straight', fly: 'Fly her yourself', speed: 'Speed', fuel: 'Fuel', od: 'Overdrive' };   // DRAFT (all but the aura key: LandWords.js KEY_WORDS.aura)

    const GAUGE = (id, thin) => '<div id="burn-row-' + id + '"' + (thin ? ' class="is-thin"' : '') + '><dt id="burn-dt-' + id + '"></dt><dd><b class="bar"><em id="burn-' + id + '"></em>' + (id === 'v' ? '<u id="burn-v-safe"></u>' : '') + '</b></dd></div>';
    const STAGE_HTML = '<div class="land-frame" id="burn-frame"><canvas class="land-art" id="burn-art" width="640" height="360" aria-hidden="true"></canvas>'
        + '<div class="land-words">'
        + '<div class="voice" id="burn-say" aria-live="polite"><div class="film-line"><img class="face" id="burn-face" alt="" hidden><div class="text">'
        + '<p class="who"><span class="ring" id="burn-ring" hidden></span><span id="burn-who"></span></p><p class="say" id="burn-line"></p></div></div></div>'
        + '<dl class="burn-read" id="burn-read" hidden>' + GAUGE('v') + GAUGE('f') + GAUGE('o', true) + '</dl>'
        + '<div class="land-keys" id="burn-keys" hidden><span class="key-pair"><kbd>Space</kbd><span class="key-word" id="burn-key-hold"></span></span>'
        + '<span class="key-pair is-od"><kbd>Shift</kbd><span class="key-word" id="burn-key-over"></span></span>'
        + '<span class="key-pair"><kbd>&larr;</kbd><kbd>&rarr;</kbd><span class="key-word" id="burn-key-steer"></span></span></div>'
        + '<button type="button" class="land-aura mini-btn" id="burn-aura" tabindex="-1" hidden><span id="burn-aura-word"></span></button>'
        + '</div></div>';
    // the gauges are the ship's own (three small bars in the bridge's style: the token sheet's faces and colours); the rest is the meteor's landStyle
    (function burnStyle() {
        if (document.getElementById('land-burn-style')) return;
        const st = document.createElement('style'); st.id = 'land-burn-style';
        st.textContent = [
            '.land-stage #burn-say { --face: calc(var(--k) * 20px); max-width: min(calc(560px + 160px * var(--t)), 60%); }',
            '.land-stage .burn-read { margin: 0; display: grid; gap: calc(var(--px) * 2); text-shadow: var(--shadow); pointer-events: none; }',
            '.land-stage .burn-read[hidden] { display: none; }',
            '.land-stage .burn-read div { display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 1.1em; }',
            '.land-stage .burn-read dt { font: 500 var(--fs-who)/1 var(--f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim); }',
            '.land-stage .burn-read dd { margin: 0; display: flex; justify-content: flex-end; align-items: center; }',
            '.land-stage .burn-read .bar { position: relative; display: block; width: calc(var(--px) * 70); height: calc(var(--px) * 4); border: 1px solid var(--faint); background: rgba(5, 7, 10, 0.72); }',
            '.land-stage .burn-read .is-thin .bar { width: calc(var(--px) * 42); height: calc(var(--px) * 3); }',
            '.land-stage .burn-read .bar em { display: block; height: 100%; width: 100%; background: var(--ui); transition: width 90ms linear; }',
            '.land-stage .burn-read .is-thin .bar em { background: var(--dim); }',
            '.land-stage .burn-read div[data-tone="warn"] .bar em { background: var(--warm-br); }',
            '.land-stage .burn-read div[data-tone="bad"] .bar em { background: var(--loss); }',
            '.land-stage .burn-read div[data-tone="on"] .bar em { background: var(--text); }',
            '.land-stage .burn-read div[data-tone="on"] dt { color: var(--text); }',
            // the speed gauge: plain while she is fast, the good colour once she is slow enough to land softly; the small mark is that speed
            '.land-stage .burn-read #burn-row-v .bar em { background: var(--text); }',
            '.land-stage .burn-read #burn-row-v[data-tone="good"] .bar em { background: var(--ui); }',
            '.land-stage .burn-read #burn-row-v[data-tone="warn"] .bar em { background: var(--warm-br); }',
            '.land-stage .burn-read #burn-row-v[data-tone="bad"] .bar em { background: var(--loss); }',
            '.land-stage .burn-read .bar u { position: absolute; top: calc(var(--px) * -1); bottom: calc(var(--px) * -1); width: 2px; margin-left: -1px; background: var(--text); text-decoration: none; }',
            '.land-stage .land-keys.is-cue .key-pair:first-child kbd, .land-stage .land-keys.is-cue #burn-key-hold { color: var(--warm-br); }',
            // "Overdrive, Commander.": its key alone, in its own place in the row, for as long as the line
            '.land-stage .land-keys.is-over .key-pair:not(.is-od) { visibility: hidden; }',
            '.land-stage .land-keys.is-over .is-od kbd, .land-stage .land-keys.is-over #burn-key-over { color: var(--warm-br); }',
            '@media (prefers-reduced-motion: reduce) { .land-stage .burn-read .bar em { transition: none; } }',
        ].join('\n');
        document.head.appendChild(st);
    })();

    // ── one landing at a time ──
    let root = null, frameEl = null, art = null, ctx = null, say = null, keysEl = null, auraEl = null, readEl = null, gauge = null;
    let finishFn = null, live = false, raf = null, rt = 0, errs = 0, last = 0, acc = 0, clock = 0, voiceUntil = 0, voicePri = 0;
    let Kpx = 3, FR = { left: 0, top: 0 }, RUN = null, S = null, B = null, V = null, phase = 'idle', said = {}, pointer = null, boostPtr = false, hands = null;
    let downAt = 0, walkers = [], result = null, lineShown = false, auraLanded = false, hudAt = 0, lastLine = '', aimT = 0, sound = null, overHintUntil = 0;
    const held = new Set();
    const calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const $ = id => root.querySelector('#burn-' + id);
    const FC = () => window.FrameClock;

    function fit() {                                                             // the bridge's own fit, as the meteor's: as large as the window shows the whole 640 x 360, centred
        const dpr = window.devicePixelRatio || 1, k = Math.max(1, Math.min(Math.round(innerWidth * dpr) / FW, Math.round(innerHeight * dpr) / FH)) / dpr;
        Kpx = k;
        FR = { left: Math.round((innerWidth - FW * k) / 2), top: Math.round((innerHeight - FH * k) / 2) };
        Object.assign(frameEl.style, { left: FR.left + 'px', top: FR.top + 'px', width: FW * k + 'px', height: FH * k + 'px' });
        art.style.width = FW * k + 'px'; art.style.height = FH * k + 'px';
        root.style.setProperty('--k', k); root.style.setProperty('--t', clamp01((innerWidth - 1280) / 640).toFixed(3)); root.style.setProperty('--px', k + 'px');
        ctx.imageSmoothingEnabled = false;
        place(say, 18, 16); place(keysEl, FW / 2 - 150, FH - 30); place(auraEl, 18, FH - 30);
        Object.assign(readEl.style, { right: Math.round(18 * k) + 'px', top: Math.round(16 * k) + 'px' });
    }
    function place(el, ax, ay) { el.style.left = Math.round(ax * Kpx) + 'px'; el.style.top = Math.round(ay * Kpx) + 'px'; }

    // ── words: one line at a time, in the dark of the picture. A line of less weight waits its turn (pri), and is then let go ──
    function hideWords() { say.classList.remove('is-in'); voiceUntil = 0; voicePri = 0; }
    function speak(line, stay, pri, hold) {
        if (!line || !say) return;
        const p = pri == null ? 5 : pri;
        if (p < voicePri && voiceUntil && clock < voiceUntil) return;
        const who = WHO[line.who] || WHO.aura, face = $('face');
        say.className = 'voice tone-' + who.tone;
        $('who').textContent = NAME[line.who] || 'A.U.R.A.';
        $('line').textContent = line.say;
        face.hidden = !who.face; $('ring').hidden = !!who.face;
        say.querySelector('.film-line').classList.toggle('is-narr', !who.face);
        if (who.face) face.src = WD.faceURL[who.face] || WD.FACE_SRC(who.face);
        void say.offsetWidth;
        say.classList.add('is-in');
        voicePri = p; voiceUntil = stay ? Infinity : clock + (hold || LINE_S);
        lastLine = line.say;
    }
    /** The three gauges. No numbers: metres a second would read absurd at this scale, and seconds of burn were "a strange way to measure energy". */
    function hud(force) {
        const now = performance.now();
        if (!force && now - hudAt < 66) return;
        hudAt = now;
        const left = clamp01(S.fuel / S.W.fuel), od = clamp01(S.od / K.OD_MAX), vDown = S.landed ? 0 : Math.max(0, -S.vy);
        gauge.v.style.width = (clamp01(vDown / V_BAR) * 100).toFixed(1) + '%';
        gauge.rowV.dataset.tone = S.landed ? '' : V.warn === 2 ? 'bad' : V.warn === 1 ? 'warn' : vDown <= K.SOFT ? 'good' : '';   // amber and red with the gates; its own colour once she is slow enough to land softly
        gauge.f.style.width = (left * 100).toFixed(1) + '%';
        gauge.rowF.dataset.tone = left <= 0 ? 'bad' : left <= 0.2 ? 'warn' : '';
        gauge.o.style.width = (od * 100).toFixed(1) + '%';
        gauge.rowO.dataset.tone = S.odOn ? 'on' : od <= 0 ? 'bad' : '';
    }
    /** The key hints: the whole row through the first long fall of a run, until the ground comes into the picture; and the
        overdrive's key alone whenever A.U.R.A. asks for it (a run that learned its keys long ago, or before there was an overdrive). */
    function showKeys() {
        const over = overHintUntil > 0;
        keysEl.classList.toggle('is-over', over);
        keysEl.hidden = !(phase === 'fall' && S && !S.aura && (over || (RUN.first && RUN.full && !BS.groundSeen(V))));
    }
    function showAura() {                                                        // her key: "Let A.U.R.A. land" on a full drop; "Fly her yourself" while she flies a routine one
        const flying = !!(S && S.aura), on = phase === 'fall' && (RUN.full ? !flying : flying);
        auraEl.hidden = !on;
        $('aura-word').textContent = RUN.full ? WD.KEY_WORDS.aura : KEY_WORDS.fly;
    }

    // ── the hands ──
    function controls() {
        if (hands) return hands;                                                 // (the headless checks)
        if (S.aura) return BF.auraInput(S, B.ground.at, RUN.full ? 0 : K.SINK_OF[(RUN.carried && RUN.carried.grade) || 'soft']);
        const l = LEFT.some(c => held.has(c)), r = RIGHT.some(c => held.has(c));
        let lean = l !== r ? (l ? -1 : 1) : 0;
        if (!lean && pointer) { const u = (pointer.ax - V.shipX) / 80; lean = Math.abs(u) < 0.22 ? 0 : clamp(u, -1, 1); }
        return { burn: FLY.some(c => held.has(c)) || !!pointer, lean, boost: boostPtr || BOOST.some(c => held.has(c)) };
    }
    function auraFlies() {
        if (phase !== 'fall' || !S || S.landed || S.aura) return;
        S.aura = true; S.ab = false;
        speak(SAY.aura, false, 6); overHintUntil = 0; showKeys(); showAura();
    }
    function takeStick() {                                                       // a routine drop: a fresh press takes it from her
        if (phase !== 'fall' || !S || S.landed || !S.aura || RUN.full) return;
        S.aura = false; S.sink = K.SINK; RUN.took = true;                        // what we fly is ours: her carried set-down speed is let go
        speak(SAY.yours, false, 6); showAura();
    }
    function canGoOn() { return phase === 'down' && clock - downAt >= SKIP_AFTER_S; }
    function onKeyDown(k, e) {
        const c = e.code, flies = FLY.includes(c) || LEFT.includes(c) || RIGHT.includes(c);
        if (flies || c === 'Enter') e.preventDefault();
        if (e.repeat) return;                                                    // a fresh press only: a key held from the bridge never counts
        if ((c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || c === 'Escape') && canGoOn()) { end(result); return; }
        if (flies && phase === 'fall') { held.add(c); takeStick(); }               // (a press while the place is still being painted is nothing)
        else if (BOOST.includes(c) && phase === 'fall') held.add(c);               // the overdrive alone never takes the stick
        if (c === 'KeyH') { if (RUN && !RUN.full && S && S.aura) takeStick(); else auraFlies(); }
    }
    const onKeyUp = e => held.delete(e.code);
    const onBlur = () => { held.clear(); pointer = null; boostPtr = false; };
    const onHide = () => { if (document.hidden) { onBlur(); if (sound && S) sound.tick(S.t * 1000, false); } };   // a hidden page draws nothing: the engine must not be left roaring
    const artX = e => (e.clientX - FR.left) / Kpx;
    const canPoint = () => phase === 'fall' && !!S && !S.aura && S.t >= 0.4;       // while she flies, the stick is taken by a key or her own key, never by a stray click; a click as the fall opens is not a burn
    /** A mouse's buttons, read off every event: a second button pressed while one is down arrives as a move, never as a down. */
    function mouseButtons(e) {
        if (e.pointerType !== 'mouse') return;
        boostPtr = !!(e.buttons & 2) && phase === 'fall';
        if (!(e.buttons & 1)) pointer = null;
        else if (!pointer && canPoint()) pointer = { ax: artX(e) };
    }
    function onPointerDown(e) {
        if (e.button === 2) {                                                    // the right button: overdrive
            e.preventDefault();
            boostPtr = phase === 'fall';
            try { root.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
            return;
        }
        if (e.button > 0) return;
        e.preventDefault();
        try { window.focus(); root.focus({ preventScroll: true }); } catch (err) { /* the keys follow the click where the browser lets them */ }
        if (canGoOn()) { end(result); return; }
        if (!canPoint()) return;
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
        pointer = { ax: artX(e) };
    }
    function onPointerMove(e) { mouseButtons(e); if (pointer) pointer.ax = artX(e); }
    const clearPointer = () => { pointer = null; boostPtr = false; };
    const noMenu = e => e.preventDefault();
    function onAuraDown(e) {
        if (e.button !== 0) return;                                              // only a plain click is hers: the right button over her key is still the overdrive (it goes on to the stage)
        e.stopPropagation(); e.preventDefault();
        if (RUN && !RUN.full && S && S.aura) takeStick(); else auraFlies();
    }
    function onResize() { clearTimeout(rt); rt = setTimeout(() => { if (live) { fit(); WD.shadeReset(); } }, 120); }

    // ── the landing's steps ──
    function begin() {
        S = BF.newFlight(B.W, RUN.full ? 'full' : 'short');
        S.aura = !RUN.full;                                                      // a routine drop: she sets it down unless we take the stick
        S.markTo = B.ground.light.x;                                             // on the mark: from the level stretch to the light beside it
        phase = 'fall'; acc = 0; said = {}; held.clear(); pointer = null; boostPtr = false; aimT = 0; overHintUntil = 0;
        V.cam.x = S.x * 0.85;
        hideWords();
        readEl.hidden = false; showKeys(); showAura(); hud(true);
        if (!RUN.full) { if (RUN.drops < 4) speak(SAY.routine, false, 3); }
        else speak(SAY.entry, false, 2);
        try { const FS = window.NSFilmSound; sound = FS && typeof FS.attach === 'function' ? FS.attach({ score: burnScore }) : null; } catch (err) { sound = null; console.error('LandBurn: the sound could not start', err); }
    }
    /** What A.U.R.A. draws with the gates, worked out a few times a second: the blue gate where her call will come, and whether
        all the engine has would still land her softly from here (if not, the gates ahead turn amber, then red, and so does the speed gauge). */
    function aim() {
        if (S.landed || S.t < aimT) return;
        const at = B.ground.at, close = V.cueY != null && S.y - V.cueY < AIM_NEAR_PX;
        aimT = S.t + (S.lit || close ? AIM_NEAR_S : AIM_FAR_S);
        if (S.y < K.ALT0 + 300) { const v = BF.arrive(S, at, 0, false).v; V.warn = v > K.ROUGH ? 2 : v > K.SOFT ? 1 : 0; } else V.warn = 0;
        if (S.mode !== 'full' || S.everLit || V.cueDone) return;
        const y = BF.callAhead(S, at, close ? 1 : 4);                             // close to it the look-ahead is short, so it can be exact
        if (y == null) return;
        if (y >= S.y - 2) { V.cueDone = true; if (V.cueY == null) V.cueY = S.y; }   // she is at it: it stays where it stood
        else V.cueY = V.cueY == null ? y : V.cueY + (y - V.cueY) * 0.6;
    }
    function talk() {
        const f = said, at = B.ground.at, who = RUN.picked[0] || 'aura', other = RUN.picked[1] || who;
        if (!S.aura && !S.lit && S.y < K.ALT0 + 300) {                           // the call, by a look ahead with the very engine she has (BurnFlight.arrive)
            if (!f.burn && BF.cueNow(S, at)) { f.burn = S.t; if (S.mode === 'full') { if (V.cueY == null || S.everLit) V.cueY = S.y; V.cueDone = true; } speak(SAY.burn, false, 6); }   // the blue gate stays where it was drawn (lit early and let go, it was no longer kept: it stands at her feet); a short drop has none
            else if (f.burn && S.t > f.burn + 0.9 && BF.lateNow(S, at) && (!f.late || S.t > f.late + 3.5)) { f.late = S.t; speak(SAY.late, false, 7); }
        }
        keysEl.classList.toggle('is-cue', !!f.burn && !S.lit && !S.aura);
        if (S.aura) return;
        if (!f.hot && S.fast > 0.3 && S.hot > 1.15) { f.hot = 1; speak(SAY.hot(who), false, 4); }
        if (S.lit && !f.burn && S.burnT > 0.5 && S.burnT < 4 && (!f.early || S.t > f.early + 4)) { const a = BF.arrive(S, at, 0); if (a.dry && a.v > K.SOFT) { f.early = S.t; speak(SAY.early, false, 6); } }
        if (S.lit && !f.over && S.burnT > 0.8 && V.warn > 0 && S.od > 0.5 && !S.odOn) { f.over = 1; speak(SAY.over, false, 7); overHintUntil = clock + LINE_S; showKeys(); }   // all she has is not enough (the gates ahead have turned amber): the overdrive is for this, and its key is shown with the line
        if (!f.all && S.fullT > 1.2) { f.all = 1; speak(SAY.all(other), false, 4); }
        if (S.lit && Math.abs(S.th) > 0.45 && (!f.tip || S.t > f.tip + 4)) { f.tip = S.t; speak(SAY.tip(who), false, 5); }
        if (S.lit) { const hm = (S.y - at(S.x)) * K.M_PER_PX; [['h500', 500], ['h200', 200], ['h50', 50]].forEach(q => { if (!f[q[0]] && hm < q[1]) { f[q[0]] = 1; if (hm > q[1] * 0.6) speak(SAY[q[0]], false, 2, 1.3); } }); }   // the last heights, called
        if (!f.low && S.fuel <= 0.2 * S.W.fuel && S.fuel > 0 && S.burnT > 0) { f.low = 1; speak(SAY.low, false, 6); }
        if (!f.dry && S.fuel <= 0) { f.dry = 1; speak(SAY.dry, false, 8); }
    }
    function touchdown() {
        const L = S.landed, flown = RUN.full || RUN.took;
        auraLanded = !!S.aura;
        if (!flown && RUN.carried) L.grade = RUN.carried.grade;                  // a routine drop she set down: the grade it carried, shown and handed on
        const marked = !RUN.unmarked, where = L.grade === 'crash' ? 'spot' : L.where, offMark = marked && L.grade !== 'crash' && where === 'long';   // a long walk from a marked spot counts rough (LanderGame's "off the mark")
        const c = RUN.carried || {};
        result = { grade: offMark ? 'rough' : L.grade, raw: offMark ? 'rough' : flown ? L.grade : c.raw || L.grade, auto: flown ? auraLanded : !!c.auto,
            lifted: !offMark && !flown && !!c.lifted, offMark, marked, hurt: L.grade === 'crash' ? RUN.hurt : null, routine: !RUN.full, seconds: +S.t.toFixed(1), where };
        BS.burst(V, S);
        phase = 'down'; downAt = clock; lineShown = false; held.clear(); pointer = null; boostPtr = false; V.warn = 0; overHintUntil = 0;
        showKeys(); auraEl.hidden = true; readEl.hidden = true; hideWords();
        walkers = [];
        if (L.grade !== 'crash') {                                               // the team steps out toward the light, one at a time
            const lightX = B.ground.light.x, dir = lightX >= S.x ? 1 : -1;
            RUN.picked.forEach((id, i) => walkers.push({ id, x: S.x + dir * 8, goal: lightX - dir * (WALK.stand + i * WALK.apart), dir, from: WALK.from + i * WALK.gap, t: 0, walking: false, out: false }));
        }
        const ids = RUN.picked, hurt = result.hurt, well = ids.find(id => id !== hurt);
        result.lineObj = L.grade === 'crash' ? (hurt ? (well ? WD.LINES.hurt(well, hurt) : WD.LINES.hurtAlone(hurt)) : WD.LINES.result('rough', 'spot', auraLanded, false)) : WD.LINES.result(result.grade, where, auraLanded, false);
        result.line = result.lineObj ? result.lineObj.say : null;
    }
    function stepDown(dt) {
        const since = clock - downAt, crash = S.landed.grade === 'crash';
        walkers.forEach(w => {
            if (since < w.from) return;
            w.out = true;
            const left = (w.goal - w.x) * w.dir;
            w.walking = left > 1;
            if (w.walking) { w.x += w.dir * Math.min(left, WALK.speed * dt); w.t += dt * 1000; }
        });
        if (!lineShown && since >= (crash ? CRASH_LINE_AT_S : LINE_AT_S)) { lineShown = true; speak(result.lineObj, true, 9); }
        if (since >= (crash ? CRASH_LINE_AT_S : LINE_AT_S) + HOLD_S) end(result);
    }
    function update(dt) {
        clock += dt;
        if (voiceUntil && clock > voiceUntil) hideWords();
        if (phase === 'boot') {
            A.idle(FRAME_BUDGET_MS, true, B.tag);
            if (BS.ready(B)) begin();
            else if (clock > BOOT_MAX_S) { end({ fallback: true }); return; }
            else if (clock > BOOT_SAY_S && !said.wait) { said.wait = 1; speak(WD.LINES.waitDown, true); }
            return;
        }
        acc += dt;
        while (acc >= K.STEP && live) {
            acc -= K.STEP;
            const was = !!S.landed;
            BF.step(S, B.ground.at, S.landed ? { burn: false, lean: 0 } : controls(), K.STEP);
            if (!was && S.landed) touchdown();
        }
        if (!live) return;
        if (!S.landed) { talk(); aim(); if (overHintUntil && clock > overHintUntil) { overHintUntil = 0; showKeys(); } } else stepDown(dt);
        if (!live) return;                                                       // the landing ended in this step
        BS.camera(V, S, dt);
    }
    function render(now, dt) {
        if (phase === 'boot') { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = P.INK; ctx.fillRect(0, 0, FW, FH); }
        else {
            BS.draw(ctx, S, B, V, now, dt, { shake: calm ? 0.3 : 1, team: walkers.filter(w => w.out) });   // reduced motion: a third of the shake
            if (!S.landed) { hud(false); if (!keysEl.hidden && !overHintUntil && BS.groundSeen(V)) showKeys(); }   // the ground is in the picture: the key hints step aside
            if (sound) sound.tick(S.t * 1000, !document.hidden);                   // the frame clock still ticks in a hidden tab (so the landing goes on): it must go on in silence
        }
        WD.shadeUnder(ctx, [say.classList.contains('is-in') ? say : null, keysEl, auraEl], FR, Kpx, FW, FH);   // the gauges change every frame: they keep their own shadow
    }
    function frame(now) {
        if (!live) return;
        raf = FC() ? FC().request(frame) : requestAnimationFrame(frame);
        const dt = Math.min(0.05, (last ? now - last : 16) / 1000);
        last = now;
        try { update(dt); if (!live) return; render(now, dt); errs = 0; }
        catch (e) { console.error('Burn:', e); if (++errs >= ERR_FRAMES) end(result || (S && S.landed ? autoResult(RUN.opts) : { fallback: true })); }   // never a frozen picture with no way on
    }
    /** Hand the result to the game (MiniHost runs cleanup, fades the overlay out and resolves App.flyLanding). Once. */
    function end(r) {
        if (!finishFn) return;
        const f = finishFn, out = r ? Object.assign({}, r) : { fallback: true };
        finishFn = null;
        delete out.lineObj;
        f(out);
    }

    // ── the sound: made in code, no files; it plays only when the game's own sound is on (start/FilmSound.js) ──
    /** The landing's score: beds that follow the flight (the air, the entry's roar, the engine), and the single sounds of its
        moments (the catch, the overdrive, the legs, A.U.R.A.'s call, the touchdown, then quiet). It reads the flight; it
        changes nothing. Tuned by the numbers for small speakers (most of a first try sat under 150 Hz, where a laptop gives
        nothing): nobody had heard it when it was built. */
    function burnScore(kit) {
        const bed = (kind, type, hz, q, rate) => { const g = kit.gain(0, kit.out), fl = kit.filter(type, hz, q, g); kit.loop(kind, fl, rate || 1); return { g: g.gain, f: fl.frequency }; };
        const wind = bed('pink', 'bandpass', 600, 0.6), roar = bed('brown', 'lowpass', 260, 0.7), fizz = bed('white', 'highpass', 2600, 0.7);
        const eng = bed('brown', 'lowpass', 200, 0.8), tear = bed('pink', 'bandpass', 900, 0.8, 0.8), jet = bed('white', 'highpass', 3200, 0.7, 1.3);
        const subG = kit.gain(0, kit.out), sub = kit.osc('triangle', 70, subG);
        const rnd = kit.rng(5), was = { lit: false, od: false, down: false, fold: 0, cue: false, sput: 0, T: null };
        const mark = F => { was.lit = F.lit; was.od = F.odOn; was.down = !!F.landed; was.fold = F.fold; was.cue = !!said.burn; };
        function update(T, dt, on) {
            const F = S;
            if (!on || !F) { [wind.g, roar.g, fizz.g, eng.g, tear.g, jet.g, subG.gain].forEach(p => kit.set(p, 0, 0.08)); if (F) mark(F); was.T = null; return; }
            if (was.T == null || T - was.T > 300) mark(F);                           // the sound was off or away: join the flight as it is now, with no moment replayed late
            was.T = T;
            const L = F.landed, at = kit.now(), thr = L ? 0 : Math.min(1.5, F.thr), fast = L ? 0 : F.fast, hot = Math.min(1.5, F.hot), sp = Math.hypot(F.vx, F.vy);
            const air = clamp01(BF.airAt(F.W, F.y) * 2.4 + 0.12) * clamp01(sp / 420);
            // the beds: the air going past (higher the faster she goes), the entry's roar and its fizz, the engine (a low body, a tearing top, a deep note under it), the side jets
            kit.set(wind.g, L ? 0.05 : 0.5 * air * (1 - 0.25 * Math.min(1, thr)) + 0.25 * fast, 0.12); kit.set(wind.f, 380 + 900 * clamp01(sp / 450), 0.2);
            kit.set(roar.g, fast * (0.6 + 0.4 * Math.min(1, hot)), 0.15); kit.set(roar.f, 260 + 300 * fast, 0.2);
            kit.set(fizz.g, 0.08 * fast * Math.min(1.5, 0.4 + hot), 0.1);
            kit.set(eng.g, thr > 0.02 ? 0.35 + 0.6 * thr : 0, thr > 0.02 ? 0.05 : 0.09); kit.set(eng.f, 220 + 620 * thr, 0.08);
            kit.set(tear.g, 0.5 * thr, 0.06); kit.set(tear.f, 800 + 1100 * Math.max(0, thr - 1), 0.08);
            kit.set(subG.gain, 0.2 * thr, 0.06); kit.set(sub.frequency, 62 + 20 * thr, 0.1);
            kit.set(jet.g, !L && Math.abs(F.lean) > 0.1 ? 0.09 : 0, 0.03);
            // the moments
            if (F.lit && !was.lit) { kit.tone({ at, f: 180, f2: 60, dur: 0.55, gain: 0.8 }); kit.burst({ at, kind: 'brown', f: 1200, f2: 150, dur: 0.6, gain: 1.1 }); kit.burst({ at, kind: 'pink', type: 'bandpass', f: 1000, f2: 300, Q: 0.8, dur: 0.5, gain: 0.8 }); }   // the catch
            if (!F.lit && was.lit && !L) kit.burst({ at, kind: 'pink', f: 700, f2: 90, dur: 0.35, gain: 0.4 });                                                        // the flame goes out
            if (F.odOn && !was.od) { kit.burst({ at, kind: 'white', type: 'bandpass', f: 1700, f2: 420, Q: 0.9, dur: 0.4, gain: 0.9 }); kit.tone({ at, f: 75, f2: 44, dur: 0.45, gain: 0.7 }); }   // the overdrive bites (its cough is the engine's own dip)
            if (!F.lit && F.ign > 0 && !L) { was.sput -= dt; if (was.sput <= 0) { was.sput = 140 + 260 * rnd(); kit.burst({ at, kind: 'white', type: 'bandpass', f: 520, Q: 1.2, dur: 0.035, gain: 0.35 }); } } else was.sput = 0;   // held, and not yet caught
            if (F.fold > 0 && was.fold === 0 && !L) [0, 0.16].forEach(d => kit.tone({ at: at + d, f: 250 - d * 180, f2: 120, dur: 0.07, gain: 0.2, type: 'triangle' }));   // the legs
            if (said.burn && !was.cue && !F.aura) [0, 0.13].forEach(d => kit.tone({ at: at + d, f: 740, dur: 0.09, gain: 0.2 }));                                        // A.U.R.A.'s call
            if (L && !was.down) {                                                     // the touchdown, then quiet
                const hard = L.grade === 'crash' ? 1 : L.grade === 'rough' ? 0.7 : 0.4;
                kit.tone({ at, f: 180, f2: 60, dur: 0.5, gain: 0.5 + 0.6 * hard }); kit.burst({ at, kind: 'brown', f: 500, f2: 60, dur: 0.9, gain: 0.6 + 0.6 * hard });
                kit.burst({ at, kind: 'pink', type: 'bandpass', f: 800, f2: 200, Q: 0.8, dur: 0.5, gain: 0.5 });   // heard on small speakers too: without it a soft landing was only the quiet
                if (hard > 0.6) kit.burst({ at, kind: 'white', type: 'bandpass', f: 1300, f2: 500, Q: 2, dur: 0.28, gain: 0.5 * hard });
            }
            mark(F);
        }
        return { cues: [], update };
    }

    // ── mount: one landing (App.flyLanding's opts) ──
    function mount(ctx0, ui, opts) {
        finishFn = ui.finish; errs = 0;
        try { return start(ui, opts || {}); } catch (err) {
            console.error('LandBurn: the landing could not start', err);
            live = false;
            setTimeout(() => end({ fallback: true }), 0);
            return cleanup;
        }
    }
    function start(ui, o) {
        const host = (ui.canvas && ui.canvas.closest('.mini-host')) || document.body;
        root = document.createElement('div');
        root.className = 'land-stage'; root.tabIndex = -1; root.innerHTML = STAGE_HTML;
        host.appendChild(root);
        frameEl = $('frame'); art = $('art'); ctx = art.getContext('2d'); say = $('say'); keysEl = $('keys'); auraEl = $('aura'); readEl = $('read');
        gauge = { v: $('v'), rowV: $('row-v'), f: $('f'), rowF: $('row-f'), o: $('o'), rowO: $('row-o') };
        $('key-hold').textContent = KEY_WORDS.hold; $('key-over').textContent = KEY_WORDS.over; $('key-steer').textContent = KEY_WORDS.steer;
        $('dt-v').textContent = KEY_WORDS.speed; $('dt-f').textContent = KEY_WORDS.fuel; $('dt-o').textContent = KEY_WORDS.od;
        $('v-safe').style.left = (K.SOFT / V_BAR * 100).toFixed(1) + '%';
        const team = (Array.isArray(o.team) ? o.team : []).filter(m => m && m.id), well = team.filter(m => m.status === 'HEALTHY');
        const carried = o.full === false && o.carried && ['soft', 'rough', 'crash'].includes(o.carried.grade) ? Object.assign({}, o.carried) : null;
        RUN = { picked: team.map(m => m.id), first: !!o.first, full: o.full !== false, carried, unmarked: o.unmarked || null, drops: Number.isFinite(o.drops) ? o.drops : 0, took: false, opts: o,
            hurt: well.length ? well[Math.floor(Math.random() * well.length)].id : (team[0] && team[0].id) || null };
        const world = LW.worldOf(o.planet, o.sector), find = LW.findOf(world, o.find, { unmarked: RUN.unmarked, risk: o.risk });
        const W = BF.rulesFor({ gravity: world.gravity, atm: world.atm, storm: world.type === 'STORM_WORLD', ground: LG.internals.GROUND_OF[world.type], seed: world.seed, risk: find.risk });
        BS.keep([world.id]);
        B = BS.prepare(world, find, W, BS.lookOf(world, find)); V = BS.view(RUN.full ? 'full' : 'short');
        S = null; phase = 'boot'; clock = 0; acc = 0; last = 0; voiceUntil = 0; voicePri = 0; said = {}; result = null; walkers = []; hands = null; held.clear(); pointer = null; boostPtr = false; sound = null;
        fit(); WD.prepFaces(); WD.shadeReset();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (live) WD.shadeReset(); });
        MiniLab.onKey(onKeyDown);
        window.addEventListener('keyup', onKeyUp, true); window.addEventListener('blur', onBlur); window.addEventListener('resize', onResize);
        document.addEventListener('visibilitychange', onHide);
        root.addEventListener('pointerdown', onPointerDown); root.addEventListener('pointermove', onPointerMove); root.addEventListener('contextmenu', noMenu);
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => root.addEventListener(t, clearPointer));
        auraEl.addEventListener('pointerdown', onAuraDown);
        live = true;
        try { root.focus({ preventScroll: true }); } catch (err) { root.focus(); }
        raf = FC() ? FC().request(frame) : requestAnimationFrame(frame);
        return cleanup;
    }
    /** MiniHost closes the frame: stop and let go of the listeners. The stage stays in the overlay until MiniHost removes it
        after its fade (the last picture fades to the bridge, never to black). */
    function cleanup() {
        live = false;
        if (raf != null) { (FC() ? FC().cancel : cancelAnimationFrame)(raf); raf = null; }
        clearTimeout(rt);
        if (sound) { try { sound.close(); } catch (err) { console.error('LandBurn: the sound could not close', err); } sound = null; }
        window.removeEventListener('keyup', onKeyUp, true); window.removeEventListener('blur', onBlur); window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onHide);
        held.clear(); pointer = null; boostPtr = false; finishFn = null; hands = null;
        root = frameEl = art = ctx = say = keysEl = auraEl = readEl = gauge = null;
        S = null; B = null; V = null; RUN = null; phase = 'idle'; walkers = []; result = null;
    }
    /** A skip (TEST_MODE, or MiniHost's "This would not start"): A.U.R.A.'s landing with nothing measured, as the meteor's
        and LanderGame's own fallback; a routine drop's carried grade. */
    function autoResult(opts) {
        const o = opts || {}, c = o.full === false && o.carried ? o.carried : null;
        return { grade: c ? c.grade : 'rough', raw: c ? c.raw || c.grade : 'rough', auto: c ? !!c.auto : true, lifted: !!(c && c.lifted), offMark: false, marked: !o.unmarked, hurt: null, routine: o.full === false, skipped: true };
    }

    // ── the warm-up: while the bridge idles at a stop, this world's sky, cloud and far land are painted a few ms at a time,
    // so the landing seldom waits (the place itself is painted when the landing opens). Left at a stop: let go. ──
    const WARM_MS = 5, WARM_EVERY_MS = 150;
    let warmT = null, warmTag = null;
    function warmTick() {
        warmT = null;
        const NS = window.NewScreen;
        if (!NS || typeof NS.mode !== 'function' || NS.mode() !== 'stop') return;
        warmT = setTimeout(warmTick, WARM_EVERY_MS);
        if (live || MiniHost.current) return;
        try {
            const app = NS.app, s = app && app.state, node = s && s.currentSystem;
            if (!node || !LW.canFly(node)) return;
            if (!warmTag || warmTag.id !== node.id) {
                const world = LW.worldOf(node, s.currentSector), find = LW.findOf(world, null, {});
                const W = BF.rulesFor({ gravity: world.gravity, atm: world.atm, storm: world.type === 'STORM_WORLD', ground: LG.internals.GROUND_OF[world.type], seed: world.seed, risk: 0, quick: true });
                BS.keep([world.id]);
                warmTag = { id: node.id, tag: BS.warm(world, W, BS.lookOf(world, find)) };
            }
            if (A.pending(warmTag.tag) > 0) A.idle(WARM_MS, true, warmTag.tag);
        } catch (err) { console.error('LandBurn: the warm-up failed', err); }
    }
    if (window.NewScreen && window.NewScreen.bus && typeof window.NewScreen.bus.on === 'function') {
        window.NewScreen.bus.on('stop:shown', () => { if (!warmT) warmTick(); });
        window.NewScreen.bus.on('stop:hidden', () => { if (warmT) { clearTimeout(warmT); warmT = null; } warmTag = null; if (!live) BS.keep([]); });
    }

    const state = () => (live ? { phase, clock: +clock.toFixed(2), full: RUN.full, took: RUN.took, line: say && say.classList.contains('is-in') ? lastLine : null, keys: keysEl ? !keysEl.hidden : false, aura: !!(S && S.aura),
        t: S ? +S.t.toFixed(2) : 0, h: S ? Math.round(S.y - B.ground.at(S.x)) : null, vy: S ? Math.round(S.vy) : null, th: S ? +S.th.toFixed(2) : null, fuel: S ? +S.fuel.toFixed(1) : null, lit: !!(S && S.lit), thr: S ? +S.thr.toFixed(2) : null, cue: !!said.burn, wfuel: S ? S.W.fuel : null, deck: S ? S.W.deck : null,
        od: S ? +S.od.toFixed(2) : null, odOn: !!(S && S.odOn), hot: S ? +S.hot.toFixed(2) : null, fast: S ? +S.fast.toFixed(2) : null, warn: V ? V.warn : 0, cueY: V && V.cueY != null ? Math.round(V.cueY) : null, seen: !!(V && BS.groundSeen(V)), said: Object.keys(said).join(' '),
        gauges: gauge && S ? [gauge.v.style.width + ' ' + (gauge.rowV.dataset.tone || '-'), gauge.f.style.width + ' ' + (gauge.rowF.dataset.tone || '-'), gauge.o.style.width + ' ' + (gauge.rowO.dataset.tone || '-')].join(' | ') : null,
        sound: sound ? sound.state() : null,
        landed: S && S.landed ? { grade: S.landed.grade, where: S.landed.where, vImp: Math.round(S.landed.vImp), off: Math.round(S.landed.off) } : null, result: result ? Object.assign({}, result, { lineObj: undefined }) : null, walkers: walkers.filter(w => w.out).length } : null);
    window.LandBurn = Object.freeze({
        canFly: LW.canFly,
        flies: () => MiniHost.has('land-burn'),
        debug: Object.freeze({ state, hands: inp => { hands = inp || null; }, aura: () => auraFlies() }),
    });
    MiniHost.register({
        id: 'land-burn',
        title: 'Land the away team',                            // (the header is hidden; LanderGame's own name for its dialog)
        kicker: 'Landing',
        hideHeader: true,                                       // the fall is the whole screen: no header over it
        frameClass: 'is-land',                                  // the meteor's own frame rules (LandFall.js landStyle)
        mount,
        autoResult,
    });
})();
