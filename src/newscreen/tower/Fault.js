/* ═══ Silent Exodus · new screen (?new=1) · tower/Fault.js: a ship fault, with no card ═════════════════════════════════
   What it is: look pass B03 (DESIGN.md 1.1 "No card at all", call C01). A fault aboard is not a card and asks nothing (the old
   card's one key, "Deal with it", decided nothing). Under the switch App.showShipMalfunctionModal hands it here:
     - its effect runs at once (EncounterCard.apply, a fault's whole cost) and its lines go to the log, never to the voice;
     - one voice line says it, once: A.U.R.A.'s own line in the event, else the first of the living crew's (their words);
     - one chip says what it cost (or gave): the first number in the result, else what broke ("damaged", someone "hurt",
       something "lost"), docked at the hull edge of the faulted deck (the deck that broke, else the event's own room);
     - that deck flashes a stepped Bayer wash twice (NSTower.flash: --wash for a loss, --warm-br for a find).
   On the bridge (a crisis while the team is down) the tower is not in sight: the chip sits under A.U.R.A.'s line and nothing
   flashes. Everything waits until nothing covers the view (a minigame, a card); the line goes up first and the effect runs a
   moment after (LINE_FIRST_MS), so a deck it breaks tells its own line ("Click it in the ship") after this one, not over it.
   Loaded only when the new-screen switch is on, after tower/Tower.js and tower/TowerCard.js.

   window.NSFault (frozen)
     report(app, event) → Promise   resolves once the line has left the screen (WAIT_MS at most)
     ROOMS                          the event id → the room it happens in
     debug() → { line, who, chip, deck } | null   the last report (the headless runs)
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const ROOMS = Object.freeze({ POWER_SURGE: 'engineering', LIFE_SUPPORT_HICCUP: 'quarters', MICRO_METEOR: 'hold', HULL_STRESS: 'hold', SENSOR_GLITCH: 'bridge',
        CRYO_LEAK: 'engineering', CARGO_SHIFT: 'hold', LAB_ACCIDENT: 'lab', LUCKY_FIND: 'hold' });
    const TOWER_DECK = { bridge: 'bridge', lab: 'lab', quarters: 'quarters', cargo: 'hold', engineering: 'engineering' };   // the game's deck keys → the tower's
    const SPEAKERS = ['A.U.R.A.', 'Jaxon', 'Aris', 'Vance', 'Mira'];
    const WORDS = { damaged: 'damaged', hurt: name => `${name} hurt`, lost: what => `${what} lost` };   // DRAFT (look pass): a fault's word chips
    const CLEAR_POLL_MS = 250, WAIT_MS = 12000, CHIP_GAP = 12, OUT_MS = 180, UNDER_LINE = 10, LINE_FIRST_MS = 200, CHIP_ALONE_MS = 3200;
    let last = null;

    const NS = () => window.NewScreen || null;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const voice = () => { const ns = NS(); return ns && ns.mods && ns.mods.voice && typeof ns.mods.voice.say === 'function' ? ns.mods.voice : null; };
    const mode = () => { const ns = NS(); try { return ns && typeof ns.mode === 'function' ? ns.mode() : 'travel'; } catch (err) { return 'travel'; } };
    const covered = () => { const ns = NS(); return !ns || !ns.isShown() || (typeof ns.blocked === 'function' && ns.blocked()); };

    /** The line said: A.U.R.A.'s in the event, else the first one a living member of the crew says. */
    function lineOf(state, dialogue) {
        const list = (Array.isArray(dialogue) ? dialogue : []).filter(d => d && SPEAKERS.includes(d.speaker) && d.text);
        const living = d => d.speaker === 'A.U.R.A.' || !(state && typeof state.isSilentSpeaker === 'function' && state.isSilentSpeaker(`${d.speaker}: `));
        return list.find(d => d.speaker === 'A.U.R.A.') || list.find(living) || null;
    }
    /** One chip for the result: its first number, else what broke, who got hurt, what was lost. */
    function chipOf(result, state, broke, hurt) {
        const EC = window.EncounterCard, parts = EC && typeof EC.keyParts === 'function' ? EC.keyParts(result) : { chips: [] };
        const first = parts.chips[0];
        if (first) return { text: first.text, tone: first.tone || 'ui', word: !!first.word || first.tone === 'dim' };
        if (broke) return { text: WORDS.damaged, tone: 'loss', word: true };
        if (hurt) return { text: WORDS.hurt(hurt), tone: 'loss', word: true };
        const lost = /(?:^|\.\s+)(?:The\s+)?([A-Z][\w' -]{2,40}?) (?:was )?lost\b/.exec(String(result || ''));
        return lost ? { text: WORDS.lost(lost[1]), tone: 'loss', word: true } : null;
    }

    function layer() {
        const root = document.getElementById('ns-root');
        if (!root) return null;
        let el = document.getElementById('ns-card-words');
        if (!el) { el = document.createElement('div'); el.id = 'ns-card-words'; el.className = 'ns-layer'; root.appendChild(el); }
        return el;
    }
    /** The chip by the deck (travel) or under A.U.R.A.'s line (the bridge); gone with the line, in steps. */
    function showChip(chip, deck) {
        const L = layer();
        if (!chip || !L) return () => {};
        const el = document.createElement('p');
        el.className = `ns-fault-chip is-${esc(chip.tone)}${chip.word ? ' is-word' : ''}`;
        el.textContent = chip.text;
        L.appendChild(el);
        const place = () => {
            const T = window.NSTowerCard, e = mode() === 'travel' && T ? T.edge(deck) : null, h = el.offsetHeight;
            if (e) { el.style.transform = `translate(${e.x + CHIP_GAP}px, ${Math.round(e.y - h / 2)}px)`; return; }
            const v = document.querySelector('#ns-root .ns-voice.is-in'), r = v && v.getBoundingClientRect();
            if (r && r.width) el.style.transform = `translate(${Math.round(r.left)}px, ${Math.round(r.bottom + UNDER_LINE)}px)`;
            else el.style.transform = `translate(${Math.round(innerWidth * 0.5)}px, ${Math.round(innerHeight * 0.2)}px)`;
        };
        place();
        requestAnimationFrame(() => { place(); el.classList.add('is-in'); });
        const again = setInterval(place, 400);                              // the voice line settles, a resize: it follows
        return () => { clearInterval(again); el.classList.remove('is-in'); el.classList.add('is-out'); setTimeout(() => el.remove(), OUT_MS); };
    }
    /** Waits until nothing covers the view (a minigame, a card, a film), then runs fn (WAIT_MS at most: then it runs anyway). */
    function whenClear(fn) {
        const t0 = performance.now();
        const look = () => { if (covered() && performance.now() - t0 < WAIT_MS) setTimeout(look, CLEAR_POLL_MS); else fn(); };
        look();
    }

    function report(app, event) {
        const state = app && app.state, EC = window.EncounterCard;
        if (!state || !event || !EC) return Promise.resolve();
        const dialogue = typeof event.dialogue === 'function' ? event.dialogue(state) : event.dialogue;
        const before = {}, hurtBefore = new Set((state.crew || []).filter(c => c.status === 'INJURED').map(c => c.name));
        Object.keys(state.shipDecks || {}).forEach(k => { before[k] = state.shipDecks[k].status; });
        const say = lineOf(state, dialogue);
        /** The effect, its lines to the log only; → the deck, the chip */
        function effect() {
            let result = '';
            const run = () => {
                result = EC.apply(Object.assign({}, event, { fullCost: true }), state) || '';     // a fault is no card choice: its whole cost
                if (result) state.addLog(`MALFUNCTION RESOLVED: ${result}`);
                if (say) state.addLog(`${say.speaker}: "${say.text}"`);                          // the log keeps it; the voice says it, once
            };
            try { if (typeof EC.captureLog === 'function') EC.captureLog(run); else run(); } catch (err) { console.error('NSFault: the fault failed', err); }
            state.emitUpdates();
            const broke = Object.keys(before).find(k => before[k] === 'OPERATIONAL' && state.shipDecks[k] && state.shipDecks[k].status !== 'OPERATIONAL');
            const hurt = ((state.crew || []).find(c => c.status === 'INJURED' && !hurtBefore.has(c.name)) || {}).name || null;
            const deck = TOWER_DECK[broke] || ROOMS[event.id] || 'engineering', chip = chipOf(result, state, broke, hurt);
            last = { line: say ? say.text : null, who: say ? say.speaker : null, chip: chip ? chip.text : null, deck, result };
            return { deck, chip };
        }
        return new Promise(resolve => {
            let done = false;
            const finish = () => { if (done) return; done = true; resolve(); };
            whenClear(() => {
                const v = voice(), T = window.NSTower;
                const spoken = v && say ? v.say({ id: say.speaker === 'A.U.R.A.' ? 'aura' : say.speaker.toLowerCase(), who: say.speaker, text: say.text, keep: true }) : null;   // kept: a deck's teaching line waits
                setTimeout(() => {
                    const { deck, chip } = effect();
                    if (mode() === 'travel' && T && typeof T.flash === 'function') T.flash(deck, chip && chip.tone === 'gain' ? 'gain' : 'loss');
                    const hide = showChip(chip, deck);
                    const end = () => { hide(); finish(); };
                    const cap = setTimeout(end, WAIT_MS);
                    if (!spoken) { setTimeout(() => { clearTimeout(cap); end(); }, CHIP_ALONE_MS); return; }
                    spoken.catch(err => console.error('NSFault: the voice failed', err)).then(() => { clearTimeout(cap); end(); });
                }, spoken ? LINE_FIRST_MS : 0);
            });
        });
    }

    window.NSFault = Object.freeze({ report, ROOMS, debug: () => (last ? Object.assign({}, last) : null) });
})();
