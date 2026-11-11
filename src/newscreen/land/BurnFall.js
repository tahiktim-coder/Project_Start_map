/* ═══ Silent Exodus · new screen (?new=1) · land/BurnFall.js: THE BURN, the minigame ══════════════════════════════════
   The new look's landing (MiniHost 'land-burn'; App.flyLanding plays it before the meteor, which stays as it was): a
   rocket's soft landing. The plan and the rules: BurnFlight.js; the pictures: BurnScene.js. This file is the stage (the
   meteor's own frame rules and word styles, LandFall.js landStyle), the words, the readouts, the hands, the loop, the walk
   out, the result and the registration.
   The contract is App.flyLanding's, as the meteor's: opts { planet, sector, find, team, full, carried, first, drops,
   unmarked, risk, ... }; it resolves { grade: 'soft' | 'rough' | 'crash', raw, auto, lifted, offMark, marked, hurt, routine }
   and never rejects; { fallback: true } hands the landing to LanderGame.
   A full drop (App.isFullDrop) is the long fall, flown by hand: hold to burn, left and right keep her straight; H or
   "Let A.U.R.A. land" hands her the rest. A routine drop is the short one: A.U.R.A. sets it down at the grade carried from
   the last full drop on that kind of world, as before; a fresh press of a flying key takes the stick, and then the
   landing is what was flown.
   Every line in SAY and KEY_WORDS is a stand-in (DRAFT): the designer writes the lines. The result's lines are the
   meteor's own (LandWords.js LINES). NO SOUND: nothing here makes any (the meteor has none either).

   window.LandBurn (frozen): canFly(planet), flies(), debug { state(), hands(inp | null), aura() }
*/
(function () {
    'use strict';
    const P = window.NSPaint, A = window.LandingArt, BF = window.BurnFlight, BS = window.BurnScene, WD = window.LandingWords, LW = window.LandingWorlds;
    const MiniHost = window.MiniHost, MiniLab = window.MiniLab, LG = window.LanderGame;
    if (!P || !A || !BF || !BS || !WD || !LW || !MiniHost || !MiniLab || !LG) return;
    const K = BF.K, FW = BS.FW, FH = BS.FH, WHO = WD.WHO, NAME = WD.NAME;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), clamp01 = v => clamp(v, 0, 1);
    const FLY = ['Space', 'KeyW', 'ArrowUp'], LEFT = ['ArrowLeft', 'KeyA'], RIGHT = ['ArrowRight', 'KeyD'];
    const BOOT_SAY_S = 1.1, BOOT_MAX_S = 9, SKIP_AFTER_S = 0.6, LINE_AT_S = 0.9, CRASH_LINE_AT_S = 1.1, HOLD_S = 2.7, FRAME_BUDGET_MS = 10, ERR_FRAMES = 5, LINE_S = 3.2;
    const WALK = { from: 0.5, gap: 0.45, speed: 24, stand: 14, apart: 13 };   // the team steps out: seconds, px/s, px from the light

    // ── DRAFT lines (one idea, plain, 20 words at most; A.U.R.A. without contractions) and the keys' words ──
    const SAY = {
        fall: { who: 'aura', say: 'We are falling. The site is under the cloud.' },          // DRAFT: the first landing of a run, a world with cloud
        fallClear: { who: 'aura', say: 'We are falling. The light is below us.' },           // DRAFT: the same, no cloud
        burn: { who: 'aura', say: 'Burn now, Commander.' },                                  // DRAFT: the moment to hold
        late: { who: 'aura', say: 'We are too fast, Commander. Burn.' },                     // DRAFT: a second after it, still not burning
        tip: who => ({ who, say: "She's tipping. Straighten her." }),                       // DRAFT: tipped far over in the burn
        climb: who => ({ who, say: "We're climbing. Ease off." }),                          // DRAFT: the burn is lifting us
        low: { who: 'aura', say: 'Three seconds of burn left.' },                            // DRAFT
        dry: { who: 'aura', say: 'The tanks are dry, Commander.' },                          // DRAFT
        aura: { who: 'aura', say: 'I have her, Commander.' },                                // DRAFT: she takes the stick
        routine: { who: 'aura', say: 'A short drop, Commander. I have her.' },               // DRAFT: a routine drop begins
        yours: { who: 'aura', say: 'She is yours, Commander.' },                             // DRAFT: we take the stick on a routine drop
    };
    const KEY_WORDS = { hold: 'or the mouse: hold to burn', steer: 'keep her straight', fly: 'Fly her yourself', height: 'Height', fall: 'Fall', burn: 'Burn' };   // DRAFT (all but the aura key: LandWords.js KEY_WORDS.aura)

    const STAGE_HTML = '<div class="land-frame" id="burn-frame"><canvas class="land-art" id="burn-art" width="640" height="360" aria-hidden="true"></canvas>'
        + '<div class="land-words">'
        + '<div class="voice" id="burn-say" aria-live="polite"><div class="film-line"><img class="face" id="burn-face" alt="" hidden><div class="text">'
        + '<p class="who"><span class="ring" id="burn-ring" hidden></span><span id="burn-who"></span></p><p class="say" id="burn-line"></p></div></div></div>'
        + '<dl class="burn-read" id="burn-read" hidden><div id="burn-row-h"><dt id="burn-dt-h"></dt><dd><b id="burn-h"></b><i>m</i></dd></div>'
        + '<div id="burn-row-v"><dt id="burn-dt-v"></dt><dd><b id="burn-v"></b><i>m/s</i></dd></div><div id="burn-row-f" class="is-big"><dt id="burn-dt-f"></dt><dd><b id="burn-f"></b><i>s</i></dd></div></dl>'
        + '<div class="land-keys" id="burn-keys" hidden><span class="key-pair"><kbd>Space</kbd><span class="key-word" id="burn-key-hold"></span></span>'
        + '<span class="key-pair"><kbd>&larr;</kbd><kbd>&rarr;</kbd><span class="key-word" id="burn-key-steer"></span></span></div>'
        + '<button type="button" class="land-aura mini-btn" id="burn-aura" tabindex="-1" hidden><span id="burn-aura-word"></span></button>'
        + '</div></div>';
    // the readouts are the ship's own (three numbers, the bridge's style: the token sheet's faces and colours); the rest is the meteor's landStyle
    (function burnStyle() {
        if (document.getElementById('land-burn-style')) return;
        const st = document.createElement('style'); st.id = 'land-burn-style';
        st.textContent = [
            '.land-stage #burn-say { --face: calc(var(--k) * 20px); max-width: min(calc(560px + 160px * var(--t)), 60%); }',
            '.land-stage .burn-read { margin: 0; display: grid; gap: calc(var(--px) * 1.6); text-shadow: var(--shadow); pointer-events: none; }',
            '.land-stage .burn-read[hidden] { display: none; }',
            '.land-stage .burn-read div { display: grid; grid-template-columns: auto 1fr; align-items: baseline; column-gap: 1.1em; }',
            '.land-stage .burn-read dt { font: 500 var(--fs-who)/1 var(--f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: var(--dim); }',
            '.land-stage .burn-read dd { margin: 0; text-align: right; white-space: nowrap; font: 400 var(--fs-key)/1.1 var(--f-num); color: var(--text); font-variant-numeric: tabular-nums; }',
            '.land-stage .burn-read dd b { font-weight: 400; }',                 // Mono's one loaded weight: no faux bold
            '.land-stage .burn-read dd i { display: inline-block; width: 2.5em; margin-left: 0.35em; text-align: left; font: 400 var(--fs-chip)/1 var(--f-num); font-style: normal; color: var(--dim); }',
            '.land-stage .burn-read .is-big dd b { font-size: 1.5em; color: var(--ui); }',
            '.land-stage .burn-read div[data-tone="warn"] dd b { color: var(--warm-br); }',
            '.land-stage .burn-read div[data-tone="bad"] dd b { color: var(--loss); }',
            '.land-stage .land-keys.is-cue kbd, .land-stage .land-keys.is-cue #burn-key-hold { color: var(--warm-br); }',
        ].join('\n');
        document.head.appendChild(st);
    })();

    // ── one landing at a time ──
    let root = null, frameEl = null, art = null, ctx = null, say = null, keysEl = null, auraEl = null, readEl = null;
    let finishFn = null, live = false, raf = null, rt = 0, errs = 0, last = 0, acc = 0, clock = 0, voiceUntil = 0;
    let Kpx = 3, FR = { left: 0, top: 0 }, RUN = null, S = null, B = null, V = null, phase = 'idle', said = {}, pointer = null, hands = null;
    let downAt = 0, walkers = [], result = null, lineShown = false, auraLanded = false, hudAt = 0, lastLine = '';
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
        place(say, 18, 16); place(keysEl, FW / 2 - 110, FH - 30); place(auraEl, 18, FH - 30);
        Object.assign(readEl.style, { right: Math.round(18 * k) + 'px', top: Math.round(16 * k) + 'px' });
    }
    function place(el, ax, ay) { el.style.left = Math.round(ax * Kpx) + 'px'; el.style.top = Math.round(ay * Kpx) + 'px'; }

    // ── words: one line at a time, in the dark of the picture ──
    function hideWords() { say.classList.remove('is-in'); voiceUntil = 0; }
    function speak(line, stay) {
        if (!line || !say) return;
        const who = WHO[line.who] || WHO.aura, face = $('face');
        say.className = 'voice tone-' + who.tone;
        $('who').textContent = NAME[line.who] || 'A.U.R.A.';
        $('line').textContent = line.say;
        face.hidden = !who.face; $('ring').hidden = !!who.face;
        say.querySelector('.film-line').classList.toggle('is-narr', !who.face);
        if (who.face) face.src = WD.faceURL[who.face] || WD.FACE_SRC(who.face);
        void say.offsetWidth;
        say.classList.add('is-in');
        voiceUntil = stay ? Infinity : clock + LINE_S;
        lastLine = line.say;
    }
    function hud(force) {
        const now = performance.now();
        if (!force && now - hudAt < 66) return;
        hudAt = now;
        const h = Math.max(0, S.y - B.ground.at(S.x)), fall = Math.max(0, -S.vy);
        $('h').textContent = Math.round(h * K.M_PER_PX).toLocaleString('en-US');
        $('v').textContent = Math.round(fall * K.M_PER_PX).toLocaleString('en-US');
        $('f').textContent = S.fuel.toFixed(1);
        const safe = Math.sqrt(2 * Math.max(4, K.AT - S.W.g) * 0.75 * h) + 46;
        $('row-v').dataset.tone = fall > safe * 1.3 ? 'bad' : fall > safe ? 'warn' : '';
        $('row-f').dataset.tone = S.fuel <= 0 ? 'bad' : S.fuel <= 3 ? 'warn' : '';
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
        if (!lean && pointer) { const u = (pointer.ax - V.shipX) / 110; lean = Math.abs(u) < 0.22 ? 0 : clamp(u, -1, 1); }
        return { burn: FLY.some(c => held.has(c)) || !!pointer, lean };
    }
    function auraFlies() {
        if (phase !== 'fall' || !S || S.landed || S.aura) return;
        S.aura = true; S.ab = false;
        speak(SAY.aura); keysEl.hidden = true; showAura();
    }
    function takeStick() {                                                       // a routine drop: a fresh press takes it from her
        if (phase !== 'fall' || !S || S.landed || !S.aura || RUN.full) return;
        S.aura = false; RUN.took = true;
        speak(SAY.yours); showAura();
    }
    function canGoOn() { return phase === 'down' && clock - downAt >= SKIP_AFTER_S; }
    function onKeyDown(k, e) {
        const c = e.code, flies = FLY.includes(c) || LEFT.includes(c) || RIGHT.includes(c);
        if (flies || c === 'Enter') e.preventDefault();
        if (e.repeat) return;                                                    // a fresh press only: a key held from the bridge never counts
        if ((c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || c === 'Escape') && canGoOn()) { end(result); return; }
        if (flies && phase === 'fall') { held.add(c); takeStick(); }               // (a press while the place is still being painted is nothing)
        if (c === 'KeyH') { if (RUN && !RUN.full && S && S.aura) takeStick(); else auraFlies(); }
    }
    const onKeyUp = e => held.delete(e.code);
    const onBlur = () => { held.clear(); pointer = null; };
    const artX = e => (e.clientX - FR.left) / Kpx;
    function onPointerDown(e) {
        if (e.button > 0) return;
        e.preventDefault();
        if (canGoOn()) { end(result); return; }
        if (phase !== 'fall' || !S || S.aura || S.t < 0.4) return;                // while she flies, the stick is taken by a key or her own key, never by a stray click
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
        pointer = { ax: artX(e) };
    }
    function onPointerMove(e) { if (pointer) pointer.ax = artX(e); }
    const clearPointer = () => { pointer = null; };
    function onAuraDown(e) { e.stopPropagation(); e.preventDefault(); if (RUN && !RUN.full && S && S.aura) takeStick(); else auraFlies(); }
    function onResize() { clearTimeout(rt); rt = setTimeout(() => { if (live) { fit(); WD.shadeReset(); } }, 120); }

    // ── the landing's steps ──
    function begin() {
        S = BF.newFlight(B.W, RUN.full ? 'full' : 'short');
        S.aura = !RUN.full;                                                      // a routine drop: she sets it down unless we take the stick
        S.markTo = B.ground.light.x;                                             // on the mark: from the level stretch to the light beside it
        phase = 'fall'; acc = 0; said = {}; held.clear(); pointer = null;
        V.cam.x = S.x * 0.85;
        hideWords();
        readEl.hidden = false; keysEl.hidden = !(RUN.first && RUN.full); showAura(); hud(true);
        if (!RUN.full) { if (RUN.drops < 4) speak(SAY.routine); }
        else if (RUN.first) speak(B.W.deck ? SAY.fall : SAY.fallClear);
    }
    function talk() {
        const h = S.y - B.ground.at(S.x), f = said, who = RUN.picked[0] || 'aura', other = RUN.picked[1] || who;
        if (!f.seen && S.mode === 'full' && S.W.deck && S.y < S.W.deck[1] - 40) { f.seen = 1; if (RUN.drops < 3) speak(WD.LINES.light(who)); }
        if (!S.burnT && !S.aura) {
            if (!f.burn && BF.cueNow(S, h)) { f.burn = S.t; speak(SAY.burn); keysEl.classList.add('is-cue'); }
            else if (f.burn && !f.late && S.t > f.burn + 1 && BF.lateNow(S, h)) { f.late = 1; speak(SAY.late); }
        } else keysEl.classList.remove('is-cue');
        if (S.aura) return;
        if (S.burning && Math.abs(S.th) > 0.45 && !f.tip) { f.tip = 1; speak(SAY.tip(who)); }
        if (S.rise > 0.7 && !f.climb) { f.climb = 1; speak(SAY.climb(other)); }
        if (!f.low && S.fuel <= 3 && S.fuel > 0 && S.burnT > 0) { f.low = 1; speak(SAY.low); }
        if (!f.dry && S.fuel <= 0) { f.dry = 1; speak(SAY.dry); }
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
        phase = 'down'; downAt = clock; lineShown = false; held.clear(); pointer = null;
        keysEl.hidden = true; auraEl.hidden = true; readEl.hidden = true; hideWords();
        walkers = [];
        if (L.grade !== 'crash') {                                               // the team steps out toward the light, one at a time
            const lightX = B.ground.light.x, dir = lightX >= S.x ? 1 : -1;
            RUN.picked.forEach((id, i) => walkers.push({ id, x: S.x + dir * 12, goal: lightX - dir * (WALK.stand + i * WALK.apart), dir, from: WALK.from + i * WALK.gap, t: 0, walking: false, out: false }));
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
        if (!lineShown && since >= (crash ? CRASH_LINE_AT_S : LINE_AT_S)) { lineShown = true; speak(result.lineObj, true); }
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
        if (!S.landed) talk(); else stepDown(dt);
        if (!live) return;                                                       // the landing ended in this step
        BS.camera(V, S, dt);
    }
    function render(now, dt) {
        if (phase === 'boot') { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = P.INK; ctx.fillRect(0, 0, FW, FH); }
        else {
            BS.draw(ctx, S, B, V, now, dt, { shake: calm ? 0.3 : 1, team: walkers.filter(w => w.out) });   // reduced motion: a third of the shake
            if (!S.landed) hud(false);
        }
        WD.shadeUnder(ctx, [say.classList.contains('is-in') ? say : null, keysEl, auraEl], FR, Kpx, FW, FH);   // the readouts change every frame: they keep their own shadow
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
        $('key-hold').textContent = KEY_WORDS.hold; $('key-steer').textContent = KEY_WORDS.steer;
        $('dt-h').textContent = KEY_WORDS.height; $('dt-v').textContent = KEY_WORDS.fall; $('dt-f').textContent = KEY_WORDS.burn;
        const team = (Array.isArray(o.team) ? o.team : []).filter(m => m && m.id), well = team.filter(m => m.status === 'HEALTHY');
        const carried = o.full === false && o.carried && ['soft', 'rough', 'crash'].includes(o.carried.grade) ? Object.assign({}, o.carried) : null;
        RUN = { picked: team.map(m => m.id), first: !!o.first, full: o.full !== false, carried, unmarked: o.unmarked || null, drops: Number.isFinite(o.drops) ? o.drops : 0, took: false, opts: o,
            hurt: well.length ? well[Math.floor(Math.random() * well.length)].id : (team[0] && team[0].id) || null };
        const world = LW.worldOf(o.planet, o.sector), find = LW.findOf(world, o.find, { unmarked: RUN.unmarked, risk: o.risk });
        const W = BF.rulesFor({ gravity: world.gravity, atm: world.atm, storm: world.type === 'STORM_WORLD', ground: LG.internals.GROUND_OF[world.type], seed: world.seed, risk: find.risk });
        BS.keep([world.id]);
        B = BS.prepare(world, find, W, BS.lookOf(world, find)); V = BS.view();
        S = null; phase = 'boot'; clock = 0; acc = 0; last = 0; voiceUntil = 0; said = {}; result = null; walkers = []; hands = null; held.clear(); pointer = null;
        fit(); WD.prepFaces(); WD.shadeReset();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (live) WD.shadeReset(); });
        MiniLab.onKey(onKeyDown);
        window.addEventListener('keyup', onKeyUp, true); window.addEventListener('blur', onBlur); window.addEventListener('resize', onResize);
        root.addEventListener('pointerdown', onPointerDown); root.addEventListener('pointermove', onPointerMove);
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
        window.removeEventListener('keyup', onKeyUp, true); window.removeEventListener('blur', onBlur); window.removeEventListener('resize', onResize);
        held.clear(); pointer = null; finishFn = null; hands = null;
        root = frameEl = art = ctx = say = keysEl = auraEl = readEl = null;
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
                const W = BF.rulesFor({ gravity: world.gravity, atm: world.atm, storm: world.type === 'STORM_WORLD', ground: LG.internals.GROUND_OF[world.type], seed: world.seed, risk: 0 });
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
        t: S ? +S.t.toFixed(2) : 0, h: S ? Math.round(S.y - B.ground.at(S.x)) : null, vy: S ? Math.round(S.vy) : null, th: S ? +S.th.toFixed(2) : null, fuel: S ? +S.fuel.toFixed(1) : null, lit: !!(S && S.lit),
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
