/* ═══ Silent Exodus · new screen (?new=1) · throw/Throw.js: the jump into sector 3, after the gauge ══════════════════════
   What it is: the new look's TheThrow (docs/CANON.md §7). bundle.js startSectorJump plays it under the switch once the burn
   gauge (throw/Gauge.js) has closed, and enters sector 3 when it resolves; the old look keeps src/systems/TheThrow.js.
     1. the stall, on the travel view itself (throw/Stall.js): the stars stop, the ship goes dark deck by deck, the crew in
        one room turn to look at us, "Nobody answers."; then ink
     2. the film (throw/SeaFilm.js): the crew try the drive three times, and its light shows the wrecks round us
        (throw/SeaEntrance.js); then the sea of ships: our dark Lander among wrecks of our own class, the camera pulling
        back until we are one red dot in a sea of thousands; the drive relights, white
     3. the arrival, with no card (look pass B03, DESIGN 1.1, C01): the travel view of sector 3 opens from black as on any
        first show (the stall's veil stays until then, Stall.release), its sky title says "The Signal" once; then a readout
        in the void's style counts the beacons heard (BEACONS HEARD, Corridor.js's own count for sector 3), Mira says her
        line (A.U.R.A. hers if Mira is dead), and the arrival line follows as narration, a sentence at a time; only then
        does anything said on entering the sector (bundle.js enterNextSector's SECTOR_3_ENTRY bark) come: afterArrival
   Its words and log lines are TheThrow's. Every step can be skipped (a click, Esc, Enter or Space), and nothing here ever
   leaves the game stuck: a step that fails is passed over.
   Loaded only when the new-screen switch is on, after throw/Stall.js and throw/SeaFilm.js.

   window.NSThrow (frozen)
     play(app) → Promise     resolves once the film is over; the arrival follows sector 3's sky title (never rejects)
     card(app) → Promise     the arrival alone, now (the headless runs); resolves when its last line has left the screen
     afterArrival(fn)        fn once the arrival a throw has set off is over (its lines said, or no arrival after all); at
                             once when no arrival is waiting
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const SECTOR = 3, PREPARE_AFTER_MS = 3600, AFTER_TITLE_MS = 400, COUNT_STEPS = 12, STEP_ART = 125, HOLD_MS = 900;
    const HEARD = 687;                                                     // Corridor.js SECTORS[3].heard: the beacons heard arriving in sector 3
    const LABEL = 'BEACONS HEARD';                                         // the void's readout (Corridor.js)
    const MIRA = 'Commander, there are a lot more than eight ships out here.';
    const AURA = 'Burn complete, Commander. There are many more ship beacons ahead than expected.';

    function hush() { const v = window.NewScreen && window.NewScreen.mods && window.NewScreen.mods.voice; if (v && typeof v.hush === 'function') { try { v.hush(); } catch (err) { /* nothing to hush */ } } }

    const NS = () => window.NewScreen || null;
    const fmt = n => n.toLocaleString('en-US');
    /** The void's readout (BEACONS HEARD over its count, Mono), low at the right, counting up in the art's steps. → remove() */
    function readout() {
        const root = document.getElementById('ns-root');
        if (!root) return () => {};
        let layer = document.getElementById('ns-card-words');
        if (!layer) { layer = document.createElement('div'); layer.id = 'ns-card-words'; layer.className = 'ns-layer'; root.appendChild(layer); }
        const el = document.createElement('div'), n = document.createElement('b');
        el.className = 'ns-heard'; el.setAttribute('role', 'status');
        el.innerHTML = `<span>${LABEL}</span>`; n.textContent = '0'; el.appendChild(n);
        layer.appendChild(el);
        requestAnimationFrame(() => el.classList.add('is-in'));
        let k = 0;
        const timer = setInterval(() => { k += 1; n.textContent = fmt(Math.round(HEARD * Math.min(1, k / COUNT_STEPS))); if (k >= COUNT_STEPS) clearInterval(timer); }, STEP_ART);
        return () => { clearInterval(timer); el.classList.remove('is-in'); el.classList.add('is-out'); setTimeout(() => el.remove(), 3 * 60); };
    }
    /** The arrival (TheThrow's words, in the new look): no card. The readout, then Mira's line (A.U.R.A.'s if Mira is dead),
        then the arrival line as narration, a sentence at a time; the readout goes with the last line. */
    function card(app) {
        const state = app && app.state, ns = NS(), v = ns && ns.mods && ns.mods.voice;
        const line = (typeof SECTOR_ARRIVAL_LINES !== 'undefined' && SECTOR_ARRIVAL_LINES[SECTOR]) || '';   // eslint-disable-line no-undef
        const mira = state && (state.crew || []).find(c => c.name && c.name.includes('Mira') && c.status !== 'DEAD');
        const voice = mira ? { id: 'mira', name: 'Mira', text: MIRA } : { id: 'aura', name: 'A.U.R.A.', text: AURA };
        const EC = window.EncounterCard, log = () => {
            if (!state || !state.addLog) return;
            state.addLog('The burn finishes. You were in the warp the whole time.');
            state.addLog(`${voice.name}: "${voice.text}"`);
            if (line) state.addLog(line);
        };
        try { if (EC && typeof EC.captureLog === 'function') EC.captureLog(log); else { log(); hush(); } } catch (err) { console.error('NSThrow: the arrival log failed', err); }   // the log keeps them; the voice says them below, once
        if (!v || typeof v.say !== 'function') return Promise.resolve();
        const off = readout(), parts = String(line).match(/[^.!?]+[.!?]+/g) || (line ? [line] : []);
        const sayAll = async () => {
            await new Promise(r => setTimeout(r, COUNT_STEPS * STEP_ART + HOLD_MS));          // the count first
            await v.say({ id: voice.id, who: voice.name, text: voice.text });
            for (const p of parts) await v.say({ narration: true, text: p.trim() });
        };
        return sayAll().catch(err => console.error('NSThrow: the arrival lines failed', err)).then(off);
    }
    // what waits for the arrival (afterArrival): null when no arrival is on its way
    let waiting = null;
    function afterArrival(fn) { if (typeof fn !== 'function') return; if (waiting) waiting.push(fn); else fn(); }
    function arrived() {
        const list = waiting || [];
        waiting = null;
        list.forEach(fn => { try { fn(); } catch (err) { console.error('NSThrow: what waited for the arrival failed', err); } });
    }
    /** After the throw: the arrival waits for sector 3's own sky title to end (its first show's 'opening:done'). */
    function arriveAfterTitle(app) {
        const ns = NS();
        if (!ns || !ns.bus) { arrived(); return; }
        ns.bus.once('opening:done', () => setTimeout(() => {
            const s = app && app.state;
            if (s && s.currentSector === SECTOR) card(app).then(arrived); else arrived();
        }, AFTER_TITLE_MS));
    }

    let playing = null;
    function play(app) {
        if (playing) return playing;
        const state = app && app.state, S = window.NSStall, F = window.NSSea;
        playing = (async () => {
            try {
                if (state && state.addLog) state.addLog('SECTOR 3 — no name. no stars.');
                if (F) F.prepare(PREPARE_AFTER_MS);                                       // the film's pictures, worked out while the ship stands still
                if (S) await S.play(app).catch(err => console.error('NSThrow: the stall failed', err));
                if (F) await F.play(app).catch(err => console.error('NSThrow: the sea of ships failed', err));
                waiting = [];                                                         // what is said on entering sector 3 waits for it
                arriveAfterTitle(app);                                                // no card: sector 3 opens, its title once, then the arrival
                if (S) S.release(false);                                              // the stall's picture goes; its veil stays until sector 3 shows
            } catch (err) {
                console.error('NSThrow: the throw failed; the jump finishes', err);
                if (S) S.release(true);
                arrived();
            } finally { playing = null; }
        })();
        return playing;
    }

    window.NSThrow = Object.freeze({ play, card, afterArrival, isPlaying: () => !!playing });
})();
