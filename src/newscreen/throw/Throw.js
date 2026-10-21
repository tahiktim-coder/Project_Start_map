/* ═══ Silent Exodus · new screen (?new=1) · throw/Throw.js: the jump into sector 3, after the gauge ══════════════════════
   What it is: the new look's TheThrow (docs/CANON.md §7). bundle.js startSectorJump plays it under the switch once the burn
   gauge (throw/Gauge.js) has closed, and enters sector 3 when it resolves; the old look keeps src/systems/TheThrow.js.
     1. the stall, on the travel view itself (throw/Stall.js): the stars stop, the ship goes dark deck by deck, the crew in
        one room turn to look at us, "Nobody answers." again and again; then ink
     2. the sea of ships (throw/SeaFilm.js): our dark Lander among wrecks of our own class, the camera pulling back until we
        are one red dot in a sea of thousands; the drive relights, white
     3. the arrival: an EncounterCard with the sector's name, its arrival line and Mira's line (A.U.R.A.'s if Mira is
        dead), "Continue"; the travel view of sector 3 then opens from black as on any first show (the stall's veil stays
        until then, Stall.release)
   Its words and log lines are TheThrow's. Every step can be skipped (a click, Esc, Enter or Space), and nothing here ever
   leaves the game stuck: a step that fails is passed over.
   Loaded only when the new-screen switch is on, after throw/Stall.js and throw/SeaFilm.js.

   window.NSThrow (frozen)
     play(app) → Promise     resolves once the arrival card is dismissed (never rejects)
     card(app) → Promise     the arrival card alone (for the headless runs)
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const SECTOR = 3, CARD_Z = 2800, PREPARE_AFTER_MS = 3600;
    const MIRA = 'Commander, there are a lot more than eight ships out here.';
    const AURA = 'Burn complete, Commander. There are many more ship beacons ahead than expected.';

    function hush() { const v = window.NewScreen && window.NewScreen.mods && window.NewScreen.mods.voice; if (v && typeof v.hush === 'function') { try { v.hush(); } catch (err) { /* nothing to hush */ } } }

    /** The arrival (TheThrow's card, in the new look): the sector's name, its arrival line, Mira's line, Continue. */
    function card(app) {
        return new Promise(resolve => {
            const state = app && app.state, EC = window.EncounterCard;
            const title = window.NSLooks ? window.NSLooks.titleOf(SECTOR) : 'The Signal';
            const line = (typeof SECTOR_ARRIVAL_LINES !== 'undefined' && SECTOR_ARRIVAL_LINES[SECTOR]) || '';   // eslint-disable-line no-undef
            const mira = state && (state.crew || []).find(c => c.name && c.name.includes('Mira') && c.status !== 'DEAD');
            const voice = mira ? { name: 'Mira', text: MIRA } : { name: 'A.U.R.A.', text: AURA };
            if (state && state.addLog) { state.addLog('The burn finishes. You were in the warp the whole time.'); state.addLog(`${voice.name}: "${voice.text}"`); }
            hush();                                                                   // the card says Mira's line: the voice must not say it again after
            if (!EC || typeof EC.open !== 'function') { resolve(); return; }
            let done = false;
            const finish = () => { if (done) return; done = true; resolve(); };
            try {
                const modal = EC.open(app, {
                    tone: 'story', kicker: '', title, context: line, zIndex: CARD_Z,
                    dialogue: [{ speaker: voice.name, text: voice.text }],
                    choices: [{ text: 'Continue', desc: '' }],
                    onPick: finish,
                });
                if (modal) modal.classList.add('ns-arrival');
            } catch (err) { console.error('NSThrow: the arrival card failed', err); finish(); }
        });
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
                await card(app);
                if (S) S.release(false);                                              // once the card is read: the stall's picture goes; its veil stays until sector 3 shows
            } catch (err) {
                console.error('NSThrow: the throw failed; the jump finishes', err);
                if (S) S.release(true);
            } finally { playing = null; }
        })();
        return playing;
    }

    window.NSThrow = Object.freeze({ play, card, isPlaying: () => !!playing });
})();
