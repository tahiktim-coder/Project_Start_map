/* ═══ Silent Exodus · new screen (?new=1) · throw/Stall.js: the jump into sector 3 stalls, on the travel view itself ═══
   What it is: the first half of the throw (docs/CANON.md §7), in the new look. The gauge has just closed on the burn; the
   burn runs on in the travel view (the stars stretched toward the light, the drive at full, the ship shaking), then stalls:
   the stars shrink back to points and stop, the drive coughs and goes out, the ship jolts to a halt. Our tower goes dark
   deck by deck from the reactor up, one red lamp left on each, and the reactor stops pulsing. In the dark the whole crew is
   suddenly standing in one room, the bridge, their backs to us; Mira asks for A.U.R.A.; nobody answers, and one by one they
   turn and look at us. "Nobody answers." Then black, and the film (throw/SeaFilm.js) takes over: the crew try the drive
   three times (throw/SeaEntrance.js), and its light shows the sea of ships.
   (Until 2026-11-13 the picture went wrong here first: the same world again and again, our ship too big, then too small.
   The designer found that a weak way into the film, and "three tries" took its place.)
   The lines are TheThrow's, said one at a time by the travel view's voice (Voice.js) beside whoever says them (narration
   beside our Lander); a dead speaker's line is "Nobody answers." (TheThrow's rule); the crew's lines go to the log as before.
   It draws nothing itself: travel/Travel.js and tower/Tower.js read view() each frame and draw the stall into the travel
   view and the tower (throw/StallArt.js paints the dark decks). Skippable after a moment: a click, Esc, Enter or Space
   (straight to the film). Reduced motion: no jolt or shake, no flicker, the lamps steady.
   Look pass B11: a crew line stays inside the tower, 24 px in from its walls (its own anchor, 'stall:person:<id>', from the
   tower's 'person:<id>', and a measure no wider than the tower), on the voice's dither shade; the skip is the film skip
   (the one corner hint of every film).
   Loaded only when the new-screen switch is on, after the travel view, the tower and StallArt.js.

   window.NSStall (frozen)
     play(app) → Promise<'done' | 'skipped'>   the stall; resolves once the screen is ink (its veil up; it stays up until the
                                               next sector's first show, or release(true))
     view() → null | { e, speed, stretch, plume, cold, frozen, boost, dark[6], red[6], reactorCold, gather, turned{id},
                       lamp, burn, stop, still }   what Travel and the tower draw now
     release(lift)           the throw is over: view() is null again; lift: take the veil down now (else at the next first show)
     debug: { state(), skip(), setTime(ms) }
*/
(function () {
    'use strict';
    const NS = window.NewScreen;
    if (!window.NEW_SCREEN || !NS) return;

    // ── the timeline (ms from the moment the gauge closed) ──
    const BURN_END = 1400, STOP_AT = 2800, COUGH = [1400, 2700];
    const DARK_AT = [8700, 8100, 7500, 6900, 6300, 3400];                    // per deck (0 bridge … 5 engineering): from the reactor up
    const RED_AFTER = 520, DARK_MS = 380, LAMP_AT = 9300;                     // a dead room's red lamp comes on after it; our hull's lamp
    const BLACKOUT = [14650, 15300], GATHER_AT = 14950;                       // every red lamp out a moment; in it, the crew are together
    const TURN_AT = 20000, TURN_GAP = 300;                                     // they turn to us one by one (the last at 21200)
    const FADE = [23000, 23700], SKIP_GUARD = 1200, SKIP_FADE = 380, HINT_MS = 4200, EDGE_IN = 24;   // ink, once all of them have looked at us a while
    // what is said, and when (TheThrow's words and order). A speaker of '' is the narration.
    const LINES = [
        [3000, '', 'The jump did not finish.'],
        [6000, 'Jaxon', 'The reactor has gone cold.'],
        [9000, 'Vance', 'Everyone, sound off.'],
        [12000, '', 'Nobody answers.'],
        [16400, 'Mira', 'A.U.R.A.? Are you there?'],
        [19400, '', 'Nobody answers.'],
    ];
    // the gathered crew on the bridge (tower px), as a group, not a lineup: who stands where, and which way they turn
    const GATHER = { mira: { x: 298, facing: 1 }, aris: { x: 340, facing: 1 }, cora: { x: 384, facing: 1 }, jaxon: { x: 428, facing: -1 }, vance: { x: 472, facing: -1 } };   // under the bridge's red lamp (StallArt.LAMP_X[0])
    const TURN_ORDER = ['mira', 'vance', 'aris', 'jaxon', 'cora'];
    const ROLE = { cora: 'LEADER', jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' };
    const isCalm = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    const ease = k => { const c = clamp01(k); return c * c * (3 - 2 * c); };

    let run = null;                                                            // the stall playing (or holding its veil)
    let veil = null, veilOff = null;

    function voice() { return NS.mods && NS.mods.voice; }
    function say(o) { const v = voice(); if (!v || typeof v.say !== 'function') return; try { v.say(o); } catch (err) { console.error('NSStall: a line failed', err); } }
    function tone(freq, dur, vol) { try { const a = window.AudioSystem; if (a && a.playTone && !a.muted) a.playTone(freq, 'sine', dur, vol); } catch (err) { /* no audio: the picture still works */ } }

    // ── the veil: ink over the whole view, in steps, and the catch for a skip ──
    function css() {
        if (document.getElementById('ns-stall-css')) return;
        const st = document.createElement('style'); st.id = 'ns-stall-css';
        st.textContent = `#ns-root .ns-stall-veil { position: absolute; inset: 0; background: var(--ink); opacity: 0; pointer-events: none; }
#ns-root .ns-stall-catch { position: absolute; inset: 0; cursor: default; }
#ns-root .ns-stall-skip { position: absolute; right: max(16px, 4vw); bottom: max(16px, 5vh); margin: 0; padding: var(--s2) 0; font: 500 var(--fs-skip)/1 var(--f-ui); letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--dim); text-shadow: var(--shadow); opacity: 0; transition: opacity 180ms steps(3, end); pointer-events: none; }
#ns-root .ns-stall-skip.is-in { opacity: 1; }
#ns-root.is-stalling .ns-voice:not(.is-narr):not(.tone-aura) { max-width: min(var(--measure), var(--ns-stall-w, 100vw)); }   /* a crew line no wider than the tower */
@media (prefers-reduced-motion: reduce) { #ns-root .ns-stall-skip { transition: none; } }`;
        document.head.appendChild(st);
        Object.keys(ROLE).forEach(id => NS.anchors.set('stall:person:' + id, () => inTower(id)));
    }
    /** The tower on screen (CSS px), or null. */
    function towerBox() {
        const t = NS.mods && NS.mods.tower, f = t && typeof t.fit === 'function' ? t.fit() : null;
        return f && f.wDev ? { left: 0, right: f.wDev / (f.dpr || 1) } : null;
    }
    /** Where a crew line goes: over the speaker's head as the tower places it, its box kept EDGE_IN inside the tower's walls
        (the line on screen is the one being placed: Voice.js has just laid it out). */
    function inTower(id) {
        const base = NS.anchors.get('person:' + id);
        let list = [];
        try { list = base ? base() || [] : []; } catch (err) { list = []; }
        const a = list[0], box = towerBox();
        if (!a || !box) return list;
        const el = document.querySelector('#ns-voice .ns-voice'), w = el ? el.offsetWidth : 0;
        const x = Math.max(box.left + EDGE_IN, Math.min(box.right - EDGE_IN - w, a.x - w / 2));
        return [{ x: Math.round(x), y: a.y, side: a.side === 'above' ? 'above' : 'below' }];
    }
    /** The measure a crew line may take while the stall runs: the tower less its two margins. */
    function fitWords(root, on) {
        const box = on ? towerBox() : null;
        root.classList.toggle('is-stalling', !!on);
        if (box) root.style.setProperty('--ns-stall-w', Math.max(160, Math.floor(box.right - box.left - 2 * EDGE_IN)) + 'px');
        else root.style.removeProperty('--ns-stall-w');
    }
    function veilAt(k) {
        if (!veil) return;
        const n = Math.round(clamp01(k) * 6) / 6;                              // in steps, as the house fades
        veil.style.opacity = String(n);
    }
    function dropVeil() {
        if (veilOff) { veilOff(); veilOff = null; }
        if (veil) { veil.remove(); veil = null; }
    }

    // ── what Travel and the tower draw ──
    function viewAt(R, e) {
        const still = R.still;
        const burn = e < BURN_END ? 1 : 1 - ease((e - BURN_END) / (STOP_AT - BURN_END));
        const cough = e >= COUGH[0] && e < COUGH[1] ? (still ? 1 - (e - COUGH[0]) / (COUGH[1] - COUGH[0]) : (Math.floor(e / 90) * 7919 % 17) / 17 > 0.42 ? 1 : 0.08) : e < COUGH[0] ? 1 : 0;
        const plume = e < COUGH[0] ? 3.4 : e < COUGH[1] ? 2.2 * cough * (1 - (e - COUGH[0]) / (COUGH[1] - COUGH[0])) + 0.01 : 0;
        const dark = DARK_AT.map(at => {
            if (e < at) return 0;
            const k = (e - at) / DARK_MS;
            if (k >= 1) return 1;
            return still ? ease(k) : [1, 0.15, 1, 0.4, 1][Math.min(4, Math.floor(k * 5))];   // the lights stutter, then go
        });
        const out = e >= BLACKOUT[0] && e < BLACKOUT[1];
        const gather = e >= GATHER_AT;
        const red = DARK_AT.map((at, i) => {
            if (out || e < at + RED_AFTER) return 0;
            const k = ease((e - at - RED_AFTER) / 500);
            const breath = still ? 1 : 0.86 + 0.14 * Math.sin((e - at) / 900);
            return k * breath * (gather && i === 0 ? 1 : 0.78);                 // the bridge, where they stand, the brightest
        });
        const turned = {};
        TURN_ORDER.forEach((id, k) => { turned[id] = e >= TURN_AT + k * TURN_GAP; });
        return {
            e, still, burn, stop: e >= STOP_AT,
            speed: e < BURN_END ? 420 : e < STOP_AT ? 420 * (1 - ease((e - BURN_END) / (STOP_AT - BURN_END))) : 0,
            stretch: burn, plume, cold: e >= COUGH[1], frozen: e >= STOP_AT, boost: 1 + 0.5 * burn,
            dark, red, reactorCold: e >= DARK_AT[5], gather, turned,
            lamp: e >= LAMP_AT ? e - LAMP_AT : null,
        };
    }
    function view() {
        if (!run || run.released) return null;
        return viewAt(run, run.e);
    }

    // ── the crew as the game has them: who is alive, by id ──
    function living(app) {
        const crew = (app && app.state && app.state.crew) || [];
        return Object.keys(ROLE).filter(id => crew.some(c => (c.tags || []).includes(ROLE[id]) && c.status !== 'DEAD'));
    }

    function play(app) {
        if (run && !run.released) return run.done;
        css();
        const root = document.getElementById('ns-root');
        if (!root || !NS.isShown || !NS.isShown()) return Promise.resolve('done');   // the view is not up: nothing to stall on
        dropVeil();
        const state = app && app.state, still = isCalm();
        veil = document.createElement('div'); veil.className = 'ns-stall-veil';
        const katch = document.createElement('div'); katch.className = 'ns-stall-catch';
        const hint = document.createElement('p'); hint.className = 'ns-stall-skip'; hint.textContent = 'Click to skip';
        root.append(katch, veil, hint);
        const R = { app, still, e: 0, last: null, said: 0, released: false, fading: null, frameId: null, warm: window.NSStallArt ? window.NSStallArt.warm() : [],
            crew: living(app), dealt: new Set(), result: 'done' };
        R.done = new Promise(resolve => { R.resolve = resolve; });
        run = R;
        const v0 = voice();
        if (v0 && typeof v0.hush === 'function') { try { v0.hush(); } catch (err) { /* nothing said yet */ } }
        const isDead = speaker => !!(speaker && state && state.isSilentSpeaker && state.isSilentSpeaker(`${speaker}: `));

        function sayBeat(i) {
            const [, rawSpeaker, rawText] = LINES[i];
            const dead = isDead(rawSpeaker), speaker = dead ? '' : rawSpeaker, text = dead ? 'Nobody answers.' : rawText;
            if (speaker) {
                say({ id: speaker.toLowerCase(), who: speaker, text, anchor: 'stall:person:' + speaker.toLowerCase() });
                if (state && state.addLog) state.addLog(`${speaker}: "${text}"`);   // as TheThrow logged it (the voice skips a line it is saying)
            } else say({ narration: true, text });
        }
        function skip() {
            if (R.fading || R.released || R.e < SKIP_GUARD) return;
            R.result = 'skipped';
            R.fading = { from: R.e, ms: SKIP_FADE };
        }
        R.onKey = e => { if (!['Escape', 'Enter', ' '].includes(e.key) || R.released) return; e.preventDefault(); e.stopPropagation(); skip(); };
        R.onDown = e => { e.preventDefault(); e.stopPropagation(); skip(); };
        katch.addEventListener('pointerdown', R.onDown);
        ['pointermove', 'pointerup', 'wheel'].forEach(type => katch.addEventListener(type, e => e.stopPropagation()));   // the view under it hears nothing
        addEventListener('keydown', R.onKey, true);
        R.cleanup = () => {
            removeEventListener('keydown', R.onKey, true);
            katch.remove(); hint.remove();
            fitWords(root, false);
            if (R.frameId != null) (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(R.frameId);
            R.frameId = null;
        };

        function frame(now) {
            R.frameId = null;
            if (run !== R || R.released) return;
            const dt = R.last == null ? 16 : Math.min(100, Math.max(0, now - R.last)); R.last = now;
            if (!(NS.blocked && NS.blocked())) R.e += dt;                        // a card over the view: the stall waits for it
            fitWords(root, true);
            const e = R.e, job = R.warm.shift();
            if (job) { try { job(); } catch (err) { console.error('NSStall: a warm job failed', err); } }
            while (R.said < LINES.length && e >= LINES[R.said][0] && !R.fading) sayBeat(R.said++);
            DARK_AT.forEach((at, i) => { if (e >= at && !R.dealt.has('deck' + i)) { R.dealt.add('deck' + i); tone(52 - (6 - i) * 3, 0.5, 0.06); } });   // TheThrow's thunk as each deck dies (silent when muted)
            if (e >= STOP_AT && !R.dealt.has('stop')) { R.dealt.add('stop'); if (!still && window.NSTower) window.NSTower.jolt(0.95); }
            if (e >= DARK_AT[5] && !R.dealt.has('music')) { R.dealt.add('music'); R.music = fadeMusic(); }
            hint.classList.toggle('is-in', e >= SKIP_GUARD && e < SKIP_GUARD + HINT_MS && !R.fading);
            const end = R.fading ? clamp01((e - R.fading.from) / R.fading.ms) : clamp01((e - FADE[0]) / (FADE[1] - FADE[0]));
            veilAt(end);
            if (end >= 1) {                                                     // ink: the film takes it from here
                const v = voice();
                if (v && typeof v.hush === 'function') { try { v.hush(); } catch (err) { /* nothing to hush */ } }
                R.cleanup();
                R.resolve(R.result);
                return;
            }
            R.frameId = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        }
        R.frameId = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        return R.done;
    }

    /** The game's music goes out with the reactor (TheThrow's fade) and comes back with release(). */
    function fadeMusic() {
        const audio = window.AudioSystem, before = audio && typeof audio.musicVolume === 'number' ? audio.musicVolume : null;
        if (!audio || before == null || typeof audio.setMusicVolume !== 'function') return null;
        let step = 0;
        const id = setInterval(() => { step++; audio.setMusicVolume(before * Math.max(0, 1 - step / 12)); if (step >= 12) clearInterval(id); }, 150);
        return () => { clearInterval(id); audio.setMusicVolume(before); };
    }

    /** The throw is over: the stall's picture goes (Travel and the tower are themselves again under the veil); the veil stays
        until the next sector's first show (lift: now). */
    function release(lift) {
        const R = run;
        if (R) {
            R.released = true;
            if (R.cleanup) R.cleanup();
            if (R.music) { try { R.music(); } catch (err) { /* no audio */ } }
            run = null;
        }
        if (lift) { dropVeil(); return; }
        if (!veil) return;
        veilAt(1);
        const off = NS.bus.once('shown', () => { veilOff = null; const v = veil; veil = null; if (v) v.remove(); });
        const timer = setTimeout(() => { off(); veilOff = null; dropVeil(); }, 8000);
        veilOff = () => { off(); clearTimeout(timer); };
    }

    window.NSStall = Object.freeze({
        play, view, release,
        GATHER, LINES,
        debug: Object.freeze({
            state: () => (run ? { e: Math.round(run.e), said: run.said, result: run.result, fading: !!run.fading, released: run.released, crew: run.crew.slice() } : { veil: !!veil }),
            skip: () => { if (run) { run.e = Math.max(run.e, SKIP_GUARD); run.result = 'skipped'; run.fading = { from: run.e, ms: SKIP_FADE }; } },
            setTime: ms => { if (run) { run.e = ms; run.said = LINES.filter(l => l[0] < ms).length; } },
        }),
    });
})();
