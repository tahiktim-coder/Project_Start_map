/* ═══ Silent Exodus · new screen (?new=1) · land/LandFall.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/landing.js (sha1 c227eb5a63b9, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   GAME: the new look's landing, a MiniHost minigame ('land-fall'): App.flyLanding plays it, with the game's world, find,
   team and run (no orbit to choose in, no tag, no result chips, no Again / Another find, no dummy keys, no tower). It
   starts on the globe where the bridge glass had it, waits for its bakes (never past READY_MAX_S: then LanderGame),
   falls, lands, walks out, says the result, and hands App.applyLanding { grade, raw, auto, lifted, offMark, marked, hurt,
   routine } (the contract: App.flyLanding). A routine drop (App.isFullDrop false) is the short one: you line it up and
   A.U.R.A. sets it down, at the grade carried from the last full drop on that kind of world. Its bakes are warmed while
   the bridge idles at a stop (warm) and let go when it closes and when the stop is left (forget).
   window.LandFall (frozen): canFly(planet), warm(), forget(), flies() (GO DOWN here flies the meteor: Stop.js), debug { state, stats, resetStats, landProbe, landLog, passStats }
   The split (2026-11-03, the house's 800-line limit): the code is in three files, moved as it was. LandFallFlight.js (the
   run and the places, going down, the fall, the camera, the landing, the walk-out and the result) and LandFallScene.js (the
   pictures) load before this one, which is the minigame: the frame, the words, the input, the loop, mount, the warm-up
   and the registration. Their shared names are window.LandFallParts (frozen here). §1-2, 6-11 are in the other two.
*/
/* ═══ Silent Exodus · prototypes · landing-meteor/landing.js: THE METEOR ══════════════════════════════════════════════
   The landing dummy (../landing/, kept as it was for comparison) rebuilt as one continuous fall. The designer chose this
   direction (2026-10-29: "yes on A, the meteor"); the old dummy's entry felt slow and far away, cut to a different screen
   for the landing, and asked you to brake while every instinct said push.

   THE PLAN (written before the build):
   1. Keep what was liked, unchanged: the orbit (the tower on the left, the globe, each find by its own light, the tag with
      its risk and who goes, the shuttle on its clamp), the walk-out and the result. No arrows: the target is always the
      find's own light.
   2. One camera from the release to the touchdown, one renderer (renderScene): the world is the landing field's own
      coordinates stretched upward (the field is LanderGame's 320 x 180 grid; the fall starts about 2,300 px above it). The
      camera is { x, y, d }: d art px per world px. Nothing cuts. The release pushes in on the globe while the shuttle,
      falling ahead of us, grows to its place in the fall; the fall's air dissolves in behind it (the shuttle never jumps).
   3. Speed is the point. The camera stays close (d 4.6 to 6, the shuttle three times the old size or more) and closes in
      as the speed builds; the world tears past in layers: the planet's limb and the cloud sea far below (landing-art's
      own), wisps of cloud and the air's streaks at their own depths (some in front of the shuttle), the deck's billows
      rushing up, then its body and its torn floor. The faster and hotter, the more the camera and the hull shake, the
      brighter the cold blue-white bow of plasma round the leading face (never orange), plates rattle, sparks peel back;
      on the tower Cora grips the helm and the others brace. No meter, no number: the ship and the world show it.
   4. One verb, as instinct says: let go and you dive (speed builds, the shuttle tucks into the fall); hold (Space, W, Up,
      or the mouse) and you pull up / brake (it flares, both thrusters fire, the speed bleeds off, the camera eases out).
      Left/right steer over the find's light (it sits on the cloud sea ahead, slides under you, then shows on the ground).
      Diving saves time and fuel; diving low and fast in thick air heats the hull (scorched, then burnt); arriving at the
      floor too fast makes A.U.R.A. catch you hard (fuel, a jolt) or, without the fuel, a crash. The skill: pull up late.
      Said once: keycaps with three words on the first landing; A.U.R.A.'s "Too hot, Commander. Pull up." when it is.
   5. The floor tears open about 58 px over the find's ground: the field (LanderScene's own picture, painted at D 4.6, the
      fall's own scale) is right there under the deck with the light on it. The camera's scale eases to D 4.6 through a
      lowpass over the last of the dive and the deck (never by position: the shuttle shrinks a fifth at most, slowly), the
      shuttle stays centred, the ground eases into the foot of the frame; the fall goes on under the deck to the hand-off
      45 px over the ground, and the last stretch is today's landing physics (LanderGame's step, the old dummy's rules:
      gusts, ice, dunes, lava, lightning, the reserve, the hop) in the same shot, drawn 1:1. No zoom after it: the walk is a pan.
   6. Shorter routines: the full meteor plays on the first landing on each world type and on a risky find (risk 25 % or
      more); a routine landing starts low (a quick fall you can still touch, a thinner deck, the hand-off 36 px up) and
      runs about seven seconds from the release to the touchdown.
   Round 2 (the review, 2026-10-29): the fall never carries you more than 120 px off the light; a hold is never quicker
   than a dive high up and never a float (a full hold is about 12 s); the keycaps show from the release until the verb has
   been done once, and the key or click that went down never counts as a hold; "Too hot" only while you dive into heat.
   7. NO SOUND (no AudioSystem, nothing plays). Test hooks: window.LandingProto (state, keys, routine, timings, stats).
   Round 3 (the designer, 2026-10-31: "i think we should see a bit further because when land appears it ddoes suddenly.
   and i felt almost no purpose what i do at the veryy start you know."): BREAKS IN THE CLOUD (meteor-land.js). From the
   first frame of the fall the place you land on lies far below, small and hazy, under the cloud deck's torn top; one
   break in the deck is lit from under by the find's own light. Steer it under the nose (a held slide is quick, a dive's
   steer is weak, a hold alone stretches your reach) and keep it there: the land grows to its landing size by 1/h (never a
   pop: the same painting at six sizes, then the field's own, 1:1, from 66 px up), the haze lifts, the deck's crest rises
   to meet you and you fall through a shaft of clear air. Miss it: blind murk and jolts, and you come out over whatever
   ground is there. One shot, the same camera, the same verbs; no meter; A.U.R.A.'s one line on the first landing.

   Controls: hold Space / W / Up / the mouse: pull up (brake); Left/A, Right/D: steer; the pointer held to one side of the
   shuttle steers that way. In the landing, as today: hold = both thrusters, Left/Right = one. A.U.R.A.'s speaker on the
   tower (or H) hands her the rest (the fall and the landing). Dummy keys (notes only with ?dev): N world, F find, L landing
   1/5/10/20, R rare, T full meteor / routine / as the rules say.
   Art: landing-art.js, landing-ground.js, landing-tower.js, meteor-art.js; numbers: landing-flight.js (FALL); words:
   landing-words.js; the worlds: landing-worlds.js.
*/
(function () {
    'use strict';
    let root = null;                                                         // GAME: the stage mount() builds in MiniHost's overlay; every id is 'land-' + id, inside it
    const $ = id => (root ? root.querySelector('#land-' + id) : null);
    const Z = window.LandFallParts;
    if (!Z || !Z.renderScene) return;                                        // (a part did not start: the game keeps LanderGame, App.flyLanding)
    const { FW, FH, clamp01, S, WHO, NAME, WD, TOWER, RUN, held, RELEASE_R, ERR_FRAMES, A, P, world, find, readyToGo, LF, SKIP_AFTER_S, DRAG_PX,
        PHASE_KEY_S, D_LAND, LW, FREE_AFTER_MS, fields, LG, MA, O, finish, update, landView, skipRelease, fieldFor, urgent, drawOrbit, warmPics,
        drawRelease, renderScene, tick, warmSeen, tickFrom } = Z;

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. The frame: 640 x 360 art px, a whole number of screen px each where that costs little room
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let stage = null, frameEl = null, art = null, ctx = null;                // GAME: built by mount() (no tower canvas)
    let K = 3, FR = { left: 0, top: 0 };
    function fit() {
        // GAME: the bridge's own fit (NewScreen.js G.bk: as large as the window shows the whole 640 x 360, centred), so the globe
        // is where the glass had it; the CSS vars are set on the stage, never on the page (NewScreen keeps its own)
        const dpr = window.devicePixelRatio || 1, k = Math.max(1, Math.min(Math.round(innerWidth * dpr) / FW, Math.round(innerHeight * dpr) / FH)) / dpr;
        K = k;
        FR = { left: Math.round((innerWidth - FW * k) / 2), top: Math.round((innerHeight - FH * k) / 2) };
        Object.assign(frameEl.style, { left: FR.left + 'px', top: FR.top + 'px', width: FW * k + 'px', height: FH * k + 'px' });
        art.style.width = FW * k + 'px'; art.style.height = FH * k + 'px';
        stage.style.setProperty('--k', k);
        stage.style.setProperty('--t', clamp01((innerWidth - 1280) / 640).toFixed(3));
        stage.style.setProperty('--px', k + 'px');
        ctx.imageSmoothingEnabled = false;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 4. Words: one line at a time, in the dark of the picture
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let say = null, keysEl = null, auraEl = null;                            // GAME: built by mount(); no tag, result chips, ways or dev note
    function place(el, ax, ay) { el.style.left = Math.round(ax * K) + 'px'; el.style.top = Math.round(ay * K) + 'px'; }
    function hideWords() { say.classList.remove('is-in'); S.voiceUntil = 0; }   // GAME: the voice is the only line
    function speak(line, stay) {
        if (!line) return;
        const who = WHO[line.who] || WHO.aura;
        say.className = 'voice tone-' + who.tone;
        $('who-name').textContent = NAME[line.who] || 'A.U.R.A.';
        $('line').textContent = line.say;
        const face = $('face');
        face.hidden = !who.face; $('who-ring').hidden = !!who.face;
        say.querySelector('.film-line').classList.toggle('is-narr', !who.face);
        if (who.face) face.src = WD.faceURL[who.face] || WD.FACE_SRC(who.face);
        place(say, TOWER + 18, 16);
        void say.offsetWidth;
        say.classList.add('is-in');
        S.voiceUntil = stay ? Infinity : S.clock + 3.2;
        S.lastLine = line.say;
        S.talking = line.who === 'aura' ? S.clock + 3.2 : 0;
    }
    /** The one verb, as keycaps with three words, on the first landing only, until a control is touched. */
    function showKeys(on) {
        keysEl.hidden = !(on && RUN.first);                                     // GAME: once a run (App.flyLanding's first)
        if (!keysEl.hidden) place(keysEl, (TOWER + FW) / 2 - keysEl.offsetWidth / K / 2, FH - 30);
    }
    /** GAME: "Let A.U.R.A. land" (LanderGame's words), a quiet keycap at the bottom left from the fall's start until she has
        the stick or the shuttle is down. */
    function showAura(on) {
        auraEl.hidden = !on;
        if (on) place(auraEl, 18, FH - 30);
    }
    /** (the split) Are the keycaps up (LandFallFlight.js's stepFall)? */
    function keysShown() { return !keysEl.hidden; }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 5. Input: hold to pull up, left and right to steer (keys by their place on the keyboard)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let pointer = null;                                                      // GAME: no tower to hover, no lights to pick
    function controls() {
        const k = { up: held.has('Space') || held.has('KeyW') || held.has('ArrowUp'), left: held.has('ArrowLeft') || held.has('KeyA'), right: held.has('ArrowRight') || held.has('KeyD') };
        if (pointer && pointer.down && pointer.fly) {
            const sx = S.shAX;
            if (S.phase === 'fall') { k.up = true; if (pointer.dragged && sx != null && Math.abs(pointer.ax - sx) > 30) k[pointer.ax < sx ? 'left' : 'right'] = true; }   // held: pull up; dragged well to one side: steer too
            else if (sx != null) { const dx = pointer.ax - sx; if (dx < -8) k.left = true; else if (dx > 8) k.right = true; else k.up = true; }
        }
        if (S.testKeys) Object.assign(k, S.testKeys);
        return k;
    }
    function hideLine(text) { if (say.classList.contains('is-in') && S.lastLine === text) { say.classList.remove('is-in'); S.voiceUntil = 0; } }
    function render(now) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
        if (S.phase === 'orbit' || S.phase === 'boot') { drawOrbit(now); warmPics(); }
        else if (S.phase === 'release') { drawRelease(now); warmPics(); }   // GAME (the review): a place the bridge warmed is ready at once (the orbit is one frame), so its pictures' first draws go in the release, never in the fall
        else renderScene(now);
        tickFrom();
        WD.shadeUnder(ctx, [say.classList.contains('is-in') ? say : null, keysEl, auraEl], FR, K, FW, FH);   // GAME: no tower drawn after it
        tick('shade');
    }
    /** The final fix round: the tags the release may bake (this landing's field, its deck and air, the globe it leaves, the
        reveal and the fall's tables). */
    function releaseTags() {
        const G = S.G, k = G.key + ':' + S.w.id;
        if (S.relTags && S.relTags.k === k) return S.relTags.set;
        const set = new Set([G.tag, G.M && G.M.tag, G.E && G.E.tag, 'release', 'drift'].concat(RELEASE_R.map(r => 'globe:' + S.w.id + ':' + r)).filter(Boolean));
        S.relTags = { k, set };
        return set;
    }
    const FRAME_BUDGET_MS = 10, WAIT_BUDGET_MS = 40, STARVED_FRAMES = 4;
    let last = 0, starved = 0, bootAt = 0, prev = { work: 0, what: '', phase: '' }, holdA = null;
    let live = false, raf = null, errs = 0;                                  // GAME: one landing at a time; FrameClock (it still ticks in a hidden tab)
    /** GAME (the review): the frame has failed ERR_FRAMES times in a row: the landing ends (never a frozen picture with no way on).
        Before the touchdown LanderGame takes it (App.flyLanding); after it, what this landing came to (or A.U.R.A.'s, as a skip). */
    function giveUp() {
        errs = 0;
        let r = S.result || null;
        if (!r && S.touch) { try { finish(); r = S.result || null; } catch (err) { console.error('Meteor: the result failed', err); } }
        end(S.touch ? r || autoResult(RUN.opts) : { fallback: true });
    }
    function frame(now) {
        if (!live) return;
        raf = window.FrameClock ? window.FrameClock.request(frame) : requestAnimationFrame(frame);
        const gap = last ? now - last : 0, t0 = performance.now();
        last = now;
        const dt = Math.min(0.05, (S.lastStep ? now - S.lastStep : 16) / 1000);
        S.lastStep = now;
        const held0 = holdA != null && S.phase === 'fall' && S.e && S.e.a <= holdA;   // (test only: LandingProto.hold, the fall stopped at a height)
        try { tickFrom(); if (!held0) update(dt); if (!live) return; tick('update'); render(now); errs = 0; } catch (e) { console.error('Meteor:', e); if (++errs >= ERR_FRAMES) { giveUp(); return; } }   // GAME: the landing may have ended in update()
        const used = performance.now() - t0;
        let what = 'render ' + used.toFixed(1), n = 0;
        const budget = S.waitDown ? WAIT_BUDGET_MS : FRAME_BUDGET_MS, falling = S.phase === 'fall';   // (the polish round: the fall runs only its own bakes, in budget; the rest waits for the landing)
        if (falling) { if (S.G && used < budget - 3 && A.pending(S.G.tag) > 0) n = A.idle(budget - 2 - used, true, S.G.tag); }
        else if (S.phase === 'release' && S.G) { if (used < budget - 3) n = A.idle(budget - 2 - used, true, releaseTags()); }   // (the final fix round: the release runs only this landing's own bakes, never the last world's)
        else if (used < budget - 1) n = A.idle(budget - used, true);
        else if (++starved >= STARVED_FRAMES) n = A.idle(0);
        if (n) { starved = 0; what += ' + idle ' + n + ' ' + A.lastTag(); }
        if (now - bootAt > 1000 && gap) WD.frameStats.push(gap, prev.work, prev.phase || S.phase, prev.what);
        prev = { work: performance.now() - t0, what, phase: S.phase };
        if (S.phase === 'fall' && S.passMs) { passLog.push(S.passMs); if (passLog.length > 4000) passLog.shift(); }
        if (probeOn && (S.phase === 'fall' || S.phase === 'release' || S.phase === 'land')) { try { probeFrame(); } catch (err) { console.error('Meteor probe:', err); } }
        if (capA.length && S.phase === 'fall' && S.e && S.e.a <= capA[0]) { const want = capA.shift(); capOut.push({ a: want, at: +S.e.a.toFixed(1), url: art.toDataURL(), probe: probeOn && probeC ? probeC.canvas.toDataURL() : null }); }   // (test only: the picture at these heights, and the probe's)
        if (S.phase === 'result' && S.result && S.result.site === undefined) S.result.site = siteShot();   // look pass B08: the trip card's picture
        if (S.phase !== S.seenPhase) { S.seenPhase = S.phase; S.phaseChangedAt = S.clock; if (S.phase === 'release') S.phaseAt = {}; if (S.phaseAt && S.phaseAt[S.phase] == null) S.phaseAt[S.phase] = +(S.clock - (S.releaseAt || 0)).toFixed(2); }
    }
    /** The landing site as the team stood on it (look pass B08: the trip card's picture, cards/FramePictures.js 'site'): the
        art as it was drawn, 480 x 160 from the foot of the frame, round the shuttle. null when it cannot be read. */
    const SITE_W = 480, SITE_H = 160;
    function siteShot() {
        try {
            const c = document.createElement('canvas'), x = Math.round(clamp01(((S.shAX != null ? S.shAX : FW / 2) - SITE_W / 2) / (FW - SITE_W)) * (FW - SITE_W));
            c.width = SITE_W; c.height = SITE_H;
            const cx = c.getContext('2d');
            cx.imageSmoothingEnabled = false;
            cx.drawImage(art, x, FH - SITE_H, SITE_W, SITE_H, 0, 0, SITE_W, SITE_H);
            return c;
        } catch (err) { console.error('Meteor: the landing site could not be kept', err); return null; }
    }
    // ── round 3, probe mode only (off by default): the land's share of the picture, frame by frame ──
    let probeOn = false, probeC = null, lastPx = null;
    const capA = [], capOut = [];
    const probeLog = [], passLog = [];
    function probeFrame() {
        if (!probeC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; probeC = c.getContext('2d', { willReadFrequently: true }); probeC.imageSmoothingEnabled = false; }
        const keep = { lightDrawn: S.lightDrawn, wispsSeen: S.wispsSeen, seaLight: S.seaLight, passMs: S.passMs, gl: S.G.lightDrawn, landBox: S.landBox };
        S.lightOpenNow = null;
        renderScene(performance.now(), { pc: probeC, probe: '#ff00ff' });
        Object.assign(S, { lightDrawn: keep.lightDrawn, wispsSeen: keep.wispsSeen, seaLight: keep.seaLight, passMs: keep.passMs, landBox: keep.landBox }); S.G.lightDrawn = keep.gl;
        const px = probeC.getImageData(TOWER, 0, FW - TOWER, FH).data;
        let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] === 255 && px[i + 1] === 0 && px[i + 2] === 255) n++;
        if (!probeC.copy) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; probeC.copy = c.getContext('2d', { willReadFrequently: true }); }
        probeC.copy.drawImage(art, 0, 0);
        const cur = probeC.copy.getImageData(TOWER, 0, FW - TOWER, FH).data;
        let changed = 0;
        if (lastPx) for (let i = 0; i < cur.length; i += 4) if (Math.max(Math.abs(cur[i] - lastPx[i]), Math.abs(cur[i + 1] - lastPx[i + 1]), Math.abs(cur[i + 2] - lastPx[i + 2])) > 48) changed++;
        lastPx = cur;
        const V = S.view, tot = (FW - TOWER) * FH;
        probeLog.push({ t: +(S.clock - (S.releaseAt || 0)).toFixed(3), ft: S.phase === 'fall' ? +(S.clock - S.fallAt).toFixed(3) : null, phase: S.phase, h: V ? +V.h.toFixed(1) : null, a: V ? +V.a.toFixed(1) : null, sL: V ? +V.sL.toFixed(4) : null, sC: V ? +V.sC.toFixed(4) : null,
            P: V ? [+V.P.x.toFixed(1), +V.P.y.toFixed(1)] : null, nearTop: V ? +V.nearTop.toFixed(1) : null, hz: V ? +V.hz.toFixed(1) : null, step: V ? V.step : null, landPx: n, landFrac: +(100 * n / tot).toFixed(2), lightOpen: S.lightOpenNow, passMs: +(S.passMs || 0).toFixed(2),
            diff: +(100 * changed / tot).toFixed(1), topTrue: S.e ? +((S.topY - S.cam.y) * S.cam.d).toFixed(1) : null, L: V && S.breaks ? (() => { const b = S.breaks[0], x = V.shX + (b.x - V.xA) * V.sigC, y = V.Yg + b.v * V.sigC; return [+x.toFixed(1), +y.toFixed(1), +(2 * b.R * V.sigC).toFixed(1)]; })() : null,
            inShaft: S.inShaft ? S.inShaft.kind : null, land: S.landBox ? S.landBox.k : null, field: !!S.fieldOn, m: V ? +V.m.toFixed(3) : null, trueY: V ? +V.trueY.toFixed(1) : null, Yg: V ? +V.Yg.toFixed(1) : null });
        if (probeLog.length > 6000) probeLog.shift();
    }
    function stateNow() {
        const e = S.e, s = S.s;
        return {
            L: RUN.L, world: S.w ? S.w.id : null, find: S.f ? S.f.kind : null, picked: RUN.picked.slice(), aura: !!S.aura, line: say && say.classList.contains('is-in') ? S.lastLine : null,   // GAME
            ready: S.G0 ? readyToGo(S.w, S.G0) : false, first: RUN.first, routine: !RUN.full, carried: RUN.carried, mark: (S.G || {}).mark, tod: (S.G || {}).tod, lightDrawn: !!S.lightDrawn, full: !!S.full,
            fall: e ? { t: +e.t.toFixed(2), a: +e.a.toFixed(0), vx: +e.vx.toFixed(1), vy: +e.vy.toFixed(1), H: +e.H.toFixed(1), fuel: +e.fuel.toFixed(1), pull: +e.pull.toFixed(2), scorch: e.scorch, burnt: e.burnt, dx: +(S.lightX - e.x).toFixed(0) } : null,
            cam: { d: +S.cam.d.toFixed(3), x: +S.cam.x.toFixed(1), y: +S.cam.y.toFixed(1) }, bell: S.bellNow ? S.bellNow.map(v => +v.toFixed(1)) : null, under: S.e ? +S.e.under.toFixed(1) : null,
            land: s ? { x: +s.x.toFixed(1), y: +s.y.toFixed(1), vx: +s.vx.toFixed(1), vy: +s.vy.toFixed(1), fuel: +s.fuel.toFixed(1), alt: +(s.altitude || 0).toFixed(1), grade: s.grade || null, wind: S.G ? S.G.g.wind : 0, t: +(S.clock - (S.landAt || S.clock)).toFixed(2) } : null,
            phaseT: +(S.clock - ({ release: S.releaseAt, fall: S.fallAt, land: S.landAt, walk: S.walkAt, result: S.resultAt }[S.phase] || S.clock)).toFixed(2),
            entryEnd: S.entry || null, result: S.result || null, rare: S.rare || null, pending: A.pending(), words: wordsOnScreen(), helm: S.clock < (S.helmUntil || 0), keysHeld: held.size, energy: RUN.energy,
            phaseAt: S.phaseAt || null, waitDown: !!S.waitDown, reserve: !!S.reserve, strikes: S.cellsHit ? S.cellsHit.size : 0, cells: S.cells ? S.cells.length : 0, hulls: S.hulls ? S.hulls.length : 0, wisps: S.wisps ? S.wisps.length : 0,
            landView: S.view && (S.phase === 'fall' || S.phase === 'release') ? { h: +S.view.h.toFixed(1), a: +S.view.a.toFixed(1), sL: +S.view.sL.toFixed(4), sC: +S.view.sC.toFixed(4), g: +S.view.g.toFixed(3), D: +S.view.D.toFixed(1), P: { x: +S.view.P.x.toFixed(1), y: +S.view.P.y.toFixed(1) }, Yg: +S.view.Yg.toFixed(1), nearTop: +S.view.nearTop.toFixed(1), hz: +S.view.hz.toFixed(1), step: S.view.step, through: S.through === undefined ? 'n/a' : S.through, inShaft: S.inShaft ? S.inShaft.kind : null, passMs: +(S.passMs || 0).toFixed(2), eps: S.eps, m: +S.view.m.toFixed(3), err: +S.view.err.toFixed(1), trueY: +S.view.trueY.toFixed(1), fieldOn: !!S.fieldOn } : null,
            wispsSeen: S.wispsSeen || 0, keysShown: !!(keysEl && !keysEl.hidden), auraShown: !!(auraEl && !auraEl.hidden), waited: S.waitAt != null ? +(S.clock - S.waitAt).toFixed(2) : null, saidWait: !!S.saidWait,   // GAME cloudBase: S.G ? S.G.cloudBase : null, groundY: S.groundY || null,
        };
    }
    function wordsOnScreen() { if (!say) return 0; return [say.classList.contains('is-in') ? $('who-name').textContent + ' ' + $('line').textContent : '', keysEl.hidden ? '' : keysEl.textContent, auraEl.hidden ? '' : auraEl.textContent].join(' ').trim().split(/\s+/).filter(w => /\w/.test(w)).length; }   // GAME: the voice, the keycaps, A.U.R.A.'s

    // ── wiring ──
    function artPoint(e) { const r = art.getBoundingClientRect(); return { ax: (e.clientX - r.left) / K, ay: (e.clientY - r.top) / K }; }
    /** A.U.R.A. takes the rest: the fall and the landing (once; never after touchdown). In the landing she brings 15 fuel. */
    function auraFlies() {
        if (S.aura || !(S.phase === 'fall' || S.phase === 'land')) return;
        if (S.phase === 'land' && (!S.s || S.s.grade)) return;
        S.aura = true; S.auraUsed = true; S.auraKeys = null;
        if (S.phase === 'land') { S.s.fuel += LF.LAND.AURA_FUEL; S.s.isAuto = true; S.s.autoTarget = null; }   // GAME: to the mark when one is marked (LanderGame's autopilot)
        showKeys(false); showAura(false);
    }
    const clearPointer = () => { if (pointer) pointer.down = false; pointer = null; };
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 12. GAME: the stage, the input, mount (MiniHost 'land-fall'), the warm-up on the bridge, the registration
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // the stage: the sketch's frame, art canvas and words (index.html), ids prefixed 'land-'; static markup only (the words go
    // in through textContent). A.U.R.A.'s keycap is a button nobody can focus: Space never presses it, and its pointerdown
    // never counts as a hold
    const STAGE_HTML = '<div id="land-frame" class="land-frame"><canvas id="land-art" class="land-art" width="640" height="360" aria-hidden="true"></canvas>'
        + '<div id="land-words" class="land-words">'
        + '<div class="voice" id="land-say" aria-live="polite"><div class="film-line"><img class="face" id="land-face" alt="" hidden><div class="text">'
        + '<p class="who" id="land-who"><span class="ring" id="land-who-ring" hidden></span><span id="land-who-name"></span></p><p class="say" id="land-line"></p></div></div></div>'
        + '<div id="land-keys" class="land-keys" hidden><span class="key-pair"><kbd>Space</kbd><span class="key-word" id="land-key-hold"></span></span>'
        + '<span class="key-pair"><kbd>&larr;</kbd><kbd>&rarr;</kbd><span class="key-word" id="land-key-steer"></span></span></div>'
        + '<button type="button" id="land-aura" class="land-aura mini-btn" tabindex="-1" hidden><span id="land-aura-word"></span></button>'
        + '</div></div>';
    // the frame's rules (MiniHost frameClass 'is-land'): the overlay is the stage, edge to edge, ink, no blur and no MiniHost
    // frame; the sketch's tokens and its #say, #keys and kbd rules, and the parts of reading.css the voice uses, all scoped
    // to the stage. In the page from the moment this file loads, as the dock's (DockFlight.js dockStyle)
    (function landStyle() {
        if (document.getElementById('land-fall-style')) return;
        const st = document.createElement('style'); st.id = 'land-fall-style';
        st.textContent = [
            '.mini-host.is-land { padding: 0; overflow: hidden; background: var(--ink); -webkit-backdrop-filter: none; backdrop-filter: none; }',
            '.mini-host.is-land .mini-frame { display: none; }',
            // look pass B08: every colour, face and size is the token sheet's (tokens.css, on html.ns-on): no copies here
            '.land-stage { position: absolute; inset: 0; overflow: hidden; outline: none; touch-action: none; background: var(--ink); user-select: none; -webkit-user-select: none; color-scheme: dark;',
            '  --px: 3px; --k: 3;',
            '  color: var(--text); font: 400 var(--fs-conseq)/1.4 var(--f-text); -webkit-font-smoothing: antialiased; }',
            '.land-stage p { margin: 0; }',
            '.land-stage .land-frame { position: absolute; overflow: hidden; }',
            '.land-stage .land-art { position: absolute; left: 0; top: 0; display: block; image-rendering: pixelated; image-rendering: crisp-edges; }',
            '.land-stage .land-words { position: absolute; inset: 0; pointer-events: none; }',
            '.land-stage .land-words > * { position: absolute; }',
            '.land-stage .tone-cora { --tone: var(--tone-cora); } .land-stage .tone-jaxon { --tone: var(--tone-jaxon); } .land-stage .tone-vance { --tone: var(--tone-vance); }',
            '.land-stage .tone-aris { --tone: var(--tone-aris); } .land-stage .tone-mira { --tone: var(--tone-mira); } .land-stage .tone-aura { --tone: var(--ui); }',
            '.land-stage .voice { left: 0; top: 0; display: grid; gap: 6px; width: max-content; max-width: var(--measure); text-shadow: var(--shadow); pointer-events: none; opacity: 0; transition: opacity calc(2 * var(--step-ui)) steps(2, end); }',
            '.land-stage .voice.is-in { opacity: 1; }',
            '.land-stage .who { display: flex; align-items: center; gap: 8px; margin: 0; font: 500 var(--fs-who)/1 var(--f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: var(--tone, var(--warm)); }',
            '.land-stage .who .ring { flex: none; width: 0.82em; height: 0.82em; border: 1px solid currentColor; border-radius: 50%; }',
            '.land-stage .say { margin: 0; font: 400 var(--fs-voice)/1.36 var(--f-text); color: var(--text); text-wrap: pretty; }',
            '.land-stage .film-line { display: grid; grid-template-columns: var(--face) minmax(0, 1fr); gap: 0 18px; align-items: start; }',
            '.land-stage .film-line.is-narr { grid-template-columns: minmax(0, 1fr); }',
            '.land-stage .film-line .text { display: grid; gap: 7px; padding-top: 2px; }',
            '.land-stage .face { position: static; display: block; width: var(--face); height: var(--face); image-rendering: auto; background: var(--ink); border-radius: 0; filter: saturate(0.9); }',
            '.land-stage .face[hidden], .land-stage .who .ring[hidden], .land-stage .land-keys[hidden], .land-stage .land-aura[hidden] { display: none; }',
            '.land-stage #land-say { --face: calc(var(--k) * 20px); max-width: min(calc(560px + 160px * var(--t)), 70%); }',
            '.land-stage .land-keys { display: flex; gap: 26px; pointer-events: none; align-items: center; }',
            '.land-stage .land-keys .key-pair { display: inline-flex; gap: 6px; align-items: center; }',
            '.land-stage .key-word { font: 400 var(--fs-chip)/1 var(--f-text); color: var(--text); text-shadow: var(--shadow); margin-left: 4px; }',
            // a keycap that does not act is a word in Mono on the shade under the keys (LandWords shadeUnder), never a box (look pass B08)
            '.land-stage kbd { padding: 0; border: 0; border-radius: 0; background: none; font: 400 var(--fs-chip)/1.2 var(--f-num); color: var(--ui); text-shadow: var(--shadow); }',
            // A.U.R.A.'s hand-off: the frame's quiet key in --warm, as the void's "Let A.U.R.A. fly" (minigames.css .mini-btn)
            '.land-stage .land-aura.mini-btn { padding: 6px 0; margin: 0; pointer-events: auto; font: 400 var(--fs-key)/1.25 var(--f-text); color: var(--warm); text-shadow: var(--shadow); transition: none; }',
            '.land-stage .land-aura.mini-btn::before { color: var(--warm); transition: none; }',
            '.land-stage .land-aura.mini-btn:hover, .land-stage .land-aura.mini-btn:hover::before { color: var(--warm-br); transform: none; }',
            '.land-stage .land-aura.mini-btn:active, .land-stage .land-aura.mini-btn:active::before { color: var(--warm-br); }',
            '@media (prefers-reduced-motion: reduce) { .land-stage .voice, .land-stage .land-aura { transition: none; } }',
        ].join('\n');
        document.head.appendChild(st);
    })();

    let finishFn = null, rt = 0;
    /** Hand the result to the game (MiniHost runs cleanup, fades the overlay out and resolves App.flyLanding). Once. */
    function end(result) {
        if (!finishFn) return;
        const f = finishFn;
        finishFn = null;
        f(result);
    }
    /** After the touchdown (SKIP_AFTER_S on) a click, Enter, Space or Esc goes on at once (LanderGame's skip): in the walk-out,
        on the result, or in a crash once its line is due. Never in the hop's moment (a click there hops). */
    function canGoOn() {
        if (!S.touch || S.clock - S.touch.at < SKIP_AFTER_S) return false;
        return S.phase === 'walk' || S.phase === 'result' || (S.phase === 'land' && S.touch.grade === 'crash' && S.clock - S.touch.at > 1.1);
    }
    function goOn() { if (S.phase !== 'result') finish(); end(S.result); }

    // ── the input (the sketch's, on the stage; the keys through MiniHost's trap: MiniLab.onKey, and a capture listener for
    // their release) ──
    const FLY = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW'];
    function onPointerDown(e) {
        const p = artPoint(e);
        if (S.phase === 'release') skipRelease();                                // (then held on: it pulls up)
        if (canGoOn()) { goOn(); return; }
        if (S.phase === 'land' && S.touch) S.fresh = true;
        if (['fall', 'land'].includes(S.phase)) { pointer = Object.assign(p, { down: true, fly: true, cx0: e.clientX, cy0: e.clientY, dragged: false }); try { stage.setPointerCapture(e.pointerId); } catch (err) { /* no capture: still flies */ } }
    }
    function onPointerMove(e) { if (pointer && pointer.down) { Object.assign(pointer, artPoint(e)); if (Math.hypot(e.clientX - pointer.cx0, e.clientY - pointer.cy0) > DRAG_PX) pointer.dragged = true; } }
    function onAuraDown(e) { e.stopPropagation(); e.preventDefault(); auraFlies(); }
    function onKeyDown(k, e) {
        const c = e.code;
        if (FLY.includes(c) || c === 'Enter') e.preventDefault();
        if (FLY.includes(c) && !e.repeat) held.add(c);                          // a fresh press only: a key held from before never counts
        if (e.repeat) return;
        if (S.clock - (S.phaseChangedAt == null ? -9 : S.phaseChangedAt) < PHASE_KEY_S) return;   // a press as the phase changed does not also act on the next
        if (S.phase === 'release') { skipRelease(); return; }
        if ((c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || c === 'Escape') && canGoOn()) { goOn(); return; }
        if (S.phase === 'land' && S.touch && FLY.includes(c)) S.fresh = true;
        if (c === 'KeyH') auraFlies();
    }
    const onKeyUp = e => held.delete(e.code);
    const onBlur = () => { held.clear(); clearPointer(); };
    function onResize() {
        clearTimeout(rt);
        rt = setTimeout(() => { if (!live) return; fit(); if (say.classList.contains('is-in')) place(say, TOWER + 18, 16); if (!keysEl.hidden) showKeys(true); if (!auraEl.hidden) showAura(true); WD.shadeReset(); }, 120);
    }

    // ── mount: one landing (App.flyLanding's opts: the contract is there) ──
    // GAME (the review): the frame rules hide MiniHost's own way out ("This would not start" and Continue), so mount never
    // throws: anything that fails in it hands the landing to LanderGame (App.flyLanding), and cleanup lets go of what was set
    function mount(ctx0, ui, opts) {
        finishFn = ui.finish;
        errs = 0;
        try { return start(ui, opts || {}); } catch (err) {
            console.error('LandFall: the landing could not start', err);
            live = false;
            setTimeout(() => end({ fallback: true }), 0);
            return cleanup;
        }
    }
    function start(ui, o) {
        const host = (ui.canvas && ui.canvas.closest('.mini-host')) || document.body;
        root = document.createElement('div');
        root.className = 'land-stage'; root.tabIndex = -1;
        root.innerHTML = STAGE_HTML;
        host.appendChild(root);
        stage = root; frameEl = $('frame'); art = $('art'); ctx = art.getContext('2d'); Z.setCtx(ctx); say = $('say'); keysEl = $('keys'); auraEl = $('aura');
        $('key-hold').textContent = WD.KEY_WORDS.hold; $('key-steer').textContent = WD.KEY_WORDS.steer; $('aura-word').textContent = WD.KEY_WORDS.aura;
        fit(); WD.prepFaces(); WD.shadeReset();
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => WD.shadeReset());
        // the run: the game's
        const team = (Array.isArray(o.team) ? o.team : []).filter(m => m && m.id), well = team.filter(m => m.status === 'HEALTHY');
        const c = o.carried && ['soft', 'rough', 'crash'].includes(o.carried.grade) ? Object.assign({}, o.carried) : null;
        Object.assign(RUN, { L: (Number.isFinite(o.drops) ? Math.max(0, Math.floor(o.drops)) : 0) + 1, energy: Number.isFinite(o.energy) ? o.energy : 60,
            picked: team.map(m => m.id), colors: team.map(m => m.color || '#f08c2e'), aboard: Array.isArray(o.aboard) ? o.aboard.slice() : [],
            first: !!o.first, full: o.full !== false, carried: o.full !== false ? null : c, jaxon: !!o.jaxon, unmarked: o.unmarked || null,
            hurt: well.length ? well[Math.floor(Math.random() * well.length)].id : null, landings: [], opts: o });
        Object.keys(S).forEach(k => { delete S[k]; });
        Object.assign(S, { phase: 'orbit', t: 0, clock: 0, cam: { x: 0, y: 0, d: D_LAND }, lines: {}, waitAt: null });
        held.clear(); pointer = null;
        S.w = LW.worldOf(o.planet, o.sector); S.f = LW.findOf(S.w, o.find, { unmarked: RUN.unmarked, risk: o.risk });
        warmKey = null;                                                          // (the warm-up's place is this one, or let go here)
        S.G0 = fieldFor(S.w, S.f, { site: o.site, wreck: o.wreck });
        A.orbitSky(S.w.sector);
        RELEASE_R.forEach(r => A.globe(S.w, r));
        if (S.G0) urgent(S.G0);
        MiniLab.onKey(onKeyDown);
        window.addEventListener('keyup', onKeyUp, true); window.addEventListener('blur', onBlur); window.addEventListener('resize', onResize);
        stage.addEventListener('pointerdown', onPointerDown); stage.addEventListener('pointermove', onPointerMove);
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => stage.addEventListener(t, clearPointer));
        auraEl.addEventListener('pointerdown', onAuraDown);
        live = true; last = 0; starved = 0; prev = { work: 0, what: '', phase: '' }; bootAt = performance.now();
        WD.frameStats.reset();
        try { stage.focus({ preventScroll: true }); } catch (err) { stage.focus(); }
        if (!S.G0) { setTimeout(() => end({ fallback: true }), 0); return cleanup; }   // no ground could be made: LanderGame
        raf = window.FrameClock ? window.FrameClock.request(frame) : requestAnimationFrame(frame);
        return cleanup;
    }
    /** MiniHost closes the frame: stop, let go of the listeners and of this place's bakes. The stage stays in the overlay until
        MiniHost removes it after its fade (the last picture fades to the bridge, never to black). */
    function cleanup() {
        live = false;
        if (raf != null) { (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(raf); raf = null; }
        clearTimeout(rt);
        window.removeEventListener('keyup', onKeyUp, true); window.removeEventListener('blur', onBlur); window.removeEventListener('resize', onResize);
        held.clear(); pointer = null; finishFn = null;
        setTimeout(() => { if (!live && warmKey == null) freePlace(null); }, FREE_AFTER_MS);   // GAME (the review): after the fade back to the bridge (the warm-up, if it has begun, lets go itself)
        root = null; stage = frameEl = art = ctx = say = keysEl = auraEl = null; Z.setCtx(null);
        Object.keys(S).forEach(k => { delete S[k]; });
        Object.assign(S, { phase: 'orbit', t: 0, clock: 0, cam: { x: 0, y: 0, d: D_LAND } });
    }
    /** Let go of the places held (their land's sizes, their queued bakes) and every world's globes, entry and deck bakes but
        keepWorld's (the warm-up moving to another find on the same world keeps them). */
    const touched = new Set();
    function freePlace(keepWorld) {
        fields.forEach(G => { touched.add(G.world.id); if (LG.freeLadder) LG.freeLadder(G); if (G.tag) A.drop(G.tag); });
        fields.clear();
        touched.forEach(id => { if (id === keepWorld) return; MA.forget(id); A.forget(id); touched.delete(id); });
        A.drop('release'); A.drop('drift');
        RUN.urgentG = null;
        warmSeen.clear();
    }

    /** A skip (TEST_MODE, or MiniHost's "This would not start" and Continue): A.U.R.A.'s landing with nothing measured, as
        LanderGame's own fallback; a routine drop's carried grade. */
    function autoResult(opts) {
        const o = opts || {}, c = o.full === false && o.carried ? o.carried : null;
        return { grade: c ? c.grade : 'rough', raw: c ? c.raw || c.grade : 'rough', auto: c ? !!c.auto : true, lifted: !!(c && c.lifted), offMark: false, marked: !o.unmarked, hurt: null, routine: o.full === false, skipped: true };
    }

    // ── the warm-up: while the bridge idles at a stop, the place GO DOWN would take the team to is prepared and baked, at most
    // WARM_MS at a time in the browser's idle time (as DockFlight.warm), so the landing seldom waits. Every WARM_EVERY_MS it
    // reads where GO DOWN goes now (NSWorldFinds.target, or the blind trip's) and prepares again only when that changes
    // (the last place's land sizes let go). Left at a stop ('stop:hidden'): everything let go (forget). ──
    const WARM_MS = 8, WARM_EVERY_MS = 500;
    let warmT = null, warmKey = null, warmIdle = false;
    function warmTarget(app) {
        const s = app && app.state, node = s && s.currentSystem, F = window.NSWorldFinds;
        if (!node || !F || !LW.canFly(node)) return null;
        const f = F.known(node) ? F.target(app, node) : F.blind(app, node);
        if (!f) return null;
        const site = f.kind === 'site' && typeof app.siteOf === 'function' ? app.siteOf(node) : null;
        if (site && (site.inSpace || site.relay)) return null;                   // a crossing or the relay: nobody lands
        // GAME (the review): our wreck's story is picked here, as the trip would pick it (App.wreckEncounterFor: once, kept on the
        // planet), so the warmed place is the wreck the landing draws
        const ours = !!(site && site.tag === 'EXODUS_WRECK'), art0 = site ? site.art || null : f.art || null;
        let wreck = ours ? node.wreckEncounter || null : null;
        if (ours && !wreck && typeof app.wreckEncounterFor === 'function') { const enc = app.wreckEncounterFor(node); wreck = enc ? enc.id : null; }
        const unmarked = typeof app.unmarkedWhy === 'function' ? app.unmarkedWhy(node) : null, L = (s._nsDrops || 0) + 1;
        const risk = Number.isFinite(f.risk) ? f.risk : 15;
        return { node, sector: s.currentSector, find: f, site: art0, wreck, unmarked, L, risk, ours, key: [node.id, f.id, art0, wreck, unmarked, L >= 20, risk >= 30].join('|') };
    }
    /** GAME (the review): the whole fall or the routine drop, as the trip will decide it (App.isFullDrop, with the two the crew put
        forward: NSOrbit.propose), so the first sizes of the land it needs are painted first. */
    function warmFull(app, t) {
        const s = app.state;
        if (typeof app.isFullDrop === 'function') {
            try { const O = window.NSOrbit, p = O && typeof O.propose === 'function' ? O.propose(app) : null; return !!app.isFullDrop(t.node, t.find, p && Array.isArray(p.ids) ? p.ids : [], { wreck: t.ours }); }
            catch (err) { console.error('LandFall: the warm-up could not tell the drop', err); }
        }
        return !(s._nsTypesLanded || {})[t.node.type] || !!(t.node.isStoryPlanet || t.node.isEden || t.ours);
    }
    function warmTick() {
        warmT = null;
        const NS = window.NewScreen;
        if (!NS || typeof NS.mode !== 'function' || NS.mode() !== 'stop') return;
        warmT = setTimeout(warmTick, WARM_EVERY_MS);
        if (live || window.MiniHost.current) return;                             // a landing (or another minigame) is on screen
        let t = null;
        try { t = warmTarget(NS.app); } catch (err) { console.error('LandFall: the warm-up could not read the target', err); return; }
        const key = t ? t.key : null;
        if (key !== warmKey) {
            warmKey = key;
            freePlace(t ? t.node.id : null);
            if (!t) return;
            try {
                Object.assign(RUN, { L: t.L, full: warmFull(NS.app, t) });
                const w = LW.worldOf(t.node, t.sector), f = LW.findOf(w, t.find, { unmarked: t.unmarked, risk: t.risk });
                A.orbitSky(w.sector);
                RELEASE_R.forEach(r => A.globe(w, r));
                const G = fieldFor(w, f, { site: t.site, wreck: t.wreck });
                if (G) { touched.add(w.id); urgent(G); }
            } catch (err) { console.error('LandFall: the warm-up could not prepare the place', err); }
        }
        if (!warmIdle && A.pending() > 0) idleSlice();
    }
    function idleSlice() {
        const later = window.requestIdleCallback ? fn => window.requestIdleCallback(fn, { timeout: 1000 }) : fn => setTimeout(() => fn(null), 50);
        warmIdle = true;
        later(deadline => {
            warmIdle = false;
            if (live || warmKey == null) return;
            const ms = deadline && deadline.timeRemaining ? Math.min(WARM_MS, Math.max(2, deadline.timeRemaining() - 1)) : WARM_MS / 2;
            try { A.idle(ms, true); } catch (err) { console.error('LandFall: a warm-up step failed', err); }
            if (A.pending() > 0) idleSlice();
        });
    }
    /** Start the warm-up (a stop shown: NewScreen's 'stop:shown' calls it). */
    function warm() { if (!warmT) warmTick(); }
    /** Let it all go (the stop left: 'stop:hidden'). */
    function forget() { if (warmT) { clearTimeout(warmT); warmT = null; } warmKey = null; if (!live) freePlace(null); }
    if (window.NewScreen && window.NewScreen.on && window.NewScreen.bus) {
        window.NewScreen.bus.on('stop:shown', () => warm());
        window.NewScreen.bus.on('stop:hidden', () => forget());
    }

    /** GAME (the review): does GO DOWN at this stop fly the meteor (a world it can land on; not the relay, not a crossing)?
        Stop.js then sends the team without the glass's own shuttle drop first (the meteor's release is the shuttle leaving). */
    function flies() {
        const NS = window.NewScreen;
        try { return !!(NS && window.MiniHost.has('land-fall') && warmTarget(NS.app)); } catch (err) { console.error('LandFall: could not tell the trip', err); return false; }
    }

    // (the split) for LandFallFlight.js; then the parts are complete
    Object.assign(Z, { speak, end, hideWords, showKeys, showAura, controls, hideLine, keysShown });
    Object.freeze(Z);
    window.LandFall = Object.freeze({
        canFly: LW.canFly, warm, forget, flies,
        debug: Object.freeze({
            state: () => (live ? Object.assign({ phase: S.phase }, stateNow()) : null), stats: phase => WD.frameStats.stats(phase), resetStats: () => WD.frameStats.reset(), run: () => RUN.landings.slice(),
            landProbe: on => { probeOn = !!on; lastPx = null; }, landLog: () => probeLog.splice(0, probeLog.length),
            passStats: () => { const p = passLog.splice(0, passLog.length).sort((x, y) => x - y); return { n: p.length, p50: p[Math.floor(p.length / 2)] || 0, p95: p[Math.floor(p.length * 0.95)] || 0, max: p[p.length - 1] || 0 }; },
            warmKey: () => warmKey, pending: () => A.pending(),
        }),
    });
    MiniHost.register({
        id: 'land-fall',
        title: 'Land the away team',                            // (the header is hidden; LanderGame's own name for its dialog)
        kicker: 'Landing',
        hideHeader: true,                                       // the fall is the whole screen: no header over it
        frameClass: 'is-land',                                  // the stage's own frame rules (landStyle, above)
        mount,
        autoResult,
    });
})();
