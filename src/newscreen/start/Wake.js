/* ═══ Silent Exodus · new screen (?new=1) · start/Wake.js: the wake-up, then the rest of the talk in the scene ════════════
   What it is: after the launch film, the first minutes aboard (docs/BUILD_B.md §6). First the wake-up at the sleeper pods
   in the hold (start/Pods.js): the player wakes the crew, and A.U.R.A. says most of the setup there, in the card's own
   words. Then, in the travel view, once the tower has slid in, what the hold did not say (all of it if "Let A.U.R.A. do
   it" came early), and the rules from the old card's choice (minus the stop count: the new screen has none), by A.U.R.A.,
   before Vance's doubt if that is still to come (his question and her answer, the old beacon, lead into the first hint).
   If the wake-up cannot run, or was skipped before a word was said (later new games), the old talk is said whole, as
   before: instead of today's boxed "Good morning, Commander" card and its "Take command" choice, the card's words one at
   a time in the travel view: its context line first as plain narration by our Lander ("...the ship has woken all five of
   you": the four-or-five count starts here), then its six lines, each beside whoever says it (A.U.R.A. by our Lander,
   Jaxon and Vance by themselves in the tower), then the rules. Each line is logged as today's card lines would be. The
   sixth line has no "I have marked it on your map" (no map any more). The talk waits until the tower has slid in; a line
   waits while a card or a minigame is up; if the player sets a course while the talk runs, the line on screen finishes
   and the rest are not said; a jump (or any arrival in another sector) ends it too. Then the shell's first hint
   (NewScreen.hint), once.
   Source: bundle.js's OPENING_TALK (window.OPENING_TALK, the one copy the card also builds from; unchanged words,
   docs/STYLE.md), the one-at-a-time talk of prototypes/slice/script.js (sayLines, startOpening, cutOpening).
   Loaded only when the new-screen switch is on, after start/Pods.js. Needs NewScreen (its bus, voice and state).

   window.NSWake (frozen)
     start(app)        bundle's begin() calls it under the switch (instead of the card); runs once per new game
     pending() → bool  true from start() until the talk is over, the wake-up included (the first hint waits while it is)
*/
(function () {
    'use strict';
    const NS = window.NewScreen;
    if (!window.NEW_SCREEN || !NS || !NS.on) return;

    const NARRATION = '';                                                                   // a line with no speaker: the card's context
    const rulesOf = T => (Array.isArray(T.rules) ? [T.rules[0], T.rules[2]].filter(Boolean).join(' ') : '');
    /** The talk, from the card's own words (bundle.js OPENING_TALK): [who, text]; who '' is narration. */
    function linesOf() {
        const T = window.OPENING_TALK;
        if (!T || !Array.isArray(T.dialogue)) { console.error('NSWake: OPENING_TALK is missing'); return []; }
        const rules = rulesOf(T);
        return [[NARRATION, T.context]].concat(T.dialogue.map(l => [l.speaker, l.text]), rules ? [['A.U.R.A.', rules]] : []).filter(([, text]) => !!text);
    }
    /** After the wake-up: what the hold did not say, with the rules before Vance's doubt (his question and her answer, the
        old beacon, lead straight into the first hint), else at the end. */
    function restOf(rest) {
        const T = window.OPENING_TALK, rules = T ? rulesOf(T) : '', list = (Array.isArray(rest) ? rest : []).map(([who, text, key]) => ({ who, text, key }));
        const at = list.findIndex(l => l.key === 'vance8');
        if (rules) list.splice(at < 0 ? list.length : at, 0, { who: 'A.U.R.A.', text: rules });
        return list.map(l => [l.who, l.text]).filter(([, text]) => !!text);
    }
    /** The wake-up at the pods (start/Pods.js), or nothing (it is not there, or it failed): resolves either way. */
    function pods(app) {
        const P = window.NSPods;
        if (!P || typeof P.play !== 'function') return Promise.resolve(null);
        try { return Promise.resolve(P.play(app)).catch(err => { console.error('NSWake: the wake-up failed', err); return null; }); } catch (err) { console.error('NSWake: the wake-up failed', err); return Promise.resolve(null); }
    }
    const IDS = { 'A.U.R.A.': 'aura', Jaxon: 'jaxon', Vance: 'vance', Aris: 'aris', Mira: 'mira' };
    const POLL_MS = 100, GAP_MS = 450, OPENING_FALLBACK_MS = 12000, FIRST_MIN_MS = 400, READ_PAD_MS = 600;
    const readMs = text => Math.max(3200, (String(text).match(/\S+/g) || []).length * 300 + 1600);   // Voice.js's own reading time

    let run = null;                     // the talk while it runs: { app, lines, i, cut, cutP, onCut }
    let openingSince = null, openingDone = false;

    // The tower slides in after a first show of a sector ('opening:done'); a Continue or a show without the opening counts too.
    NS.bus.on('shown', p => { if (p && p.first) { openingDone = false; openingSince = performance.now(); } });
    NS.bus.on('opening:done', () => { openingDone = true; });
    function cut() { if (run && !run.cut) { run.cut = true; run.onCut(); } }
    NS.bus.on('flow:go', cut);                                                                // a course set: the line now finishes, the rest are not said
    NS.bus.on('hidden', cut);
    NS.bus.on('jump:burn', cut);                                                              // a jump straight away: the talk is about a sector we are leaving
    /** The sector we woke in is behind us (a jump before the talk was over, by any path): the rest is stale, never said. */
    const moved = r => { const s = r.app && r.app.state; return !!s && s.currentSector !== r.sector; };

    const after = ms => new Promise(r => setTimeout(r, ms));
    /** Resolves once fn() is true, checked every POLL_MS; or false if the talk was cut first. */
    function until(fn) {
        return new Promise(resolve => {
            const tick = () => {
                if (!run || run.cut) { resolve(false); return; }
                let ok = false;
                try { ok = !!fn(); } catch (err) { ok = false; }
                if (ok) resolve(true); else setTimeout(tick, POLL_MS);
            };
            tick();
        });
    }
    const free = () => NS.isShown() && !NS.blocked();
    /** The tower is in: 'opening:done' since the last first show, or the view has been up a while without one. */
    function towerIn() {
        if (!free()) return false;
        if (openingDone) return true;
        if (openingSince == null) openingSince = performance.now();
        return performance.now() - openingSince > OPENING_FALLBACK_MS;
    }
    /** The dead do not talk (docs/STYLE.md rule 8). */
    function alive(app, who) {
        if (who === 'A.U.R.A.') return true;
        const crew = (app && app.state && app.state.crew) || [];
        const m = crew.find(c => c.name && c.name.includes(who));
        return !m || m.status !== 'DEAD';
    }

    const logged = (who, text) => (who ? `${who}: "${text}"` : text);                        // narration is logged as the card's context was
    /** One line: said beside the speaker, then logged (Voice skips a logged line it is already saying). Resolves when it has gone. */
    async function sayOne(app, who, text) {
        const v = NS.mods.voice;
        if (!v || typeof v.say !== 'function') { app.state.addLog(logged(who, text)); return; }
        let spoken = null;
        try { spoken = v.say(who ? { id: IDS[who] || 'aura', who, text } : { id: 'narr', narration: true, text }); } catch (err) { console.error('NSWake: the voice failed', err); }
        app.state.addLog(logged(who, text));
        if (spoken && typeof spoken.then === 'function') { await Promise.race([spoken, run ? run.cutP : Promise.resolve()]); return; }   // no poller: the cut settles it
        // the voice gives no promise: the line is done once it is no longer the one on screen (it ages only while shown and free)
        const start = performance.now();
        await until(() => {
            const cur = typeof v.current === 'function' ? v.current() : null;
            const gone = !cur || cur.line !== text;
            return (gone && performance.now() - start > FIRST_MIN_MS) || performance.now() - start > readMs(text) * 3 + READ_PAD_MS;
        });
    }

    async function talk(r) {
        if (!(await until(towerIn))) return;
        for (; r.i < r.lines.length; r.i++) {
            const [who, text] = r.lines[r.i];
            if (who && !alive(r.app, who)) continue;
            if (!(await until(free))) return;
            if (moved(r)) { cut(); return; }
            await sayOne(r.app, who, text);
            if (r.cut) return;
            await after(GAP_MS);
        }
    }

    function start(app) {
        if (run || !app || !app.state) return;
        const r = run = { app, lines: [], i: 0, cut: false, cutP: null, onCut: null, sector: app.state.currentSector || 1 };
        r.cutP = new Promise(resolve => { r.onCut = resolve; });
        pods(app).then(res => {                                                              // the wake-up first; then the rest, or the old talk whole
            r.lines = res && !res.fresh ? restOf(res.rest) : linesOf();                    // fresh: the hold said nothing (skipped, or never ran)
            return talk(r);
        }).catch(err => console.error('NSWake: the talk failed', err)).then(() => {
            const wasCut = r.cut;
            if (run === r) run = null;
            if (!wasCut && typeof NS.hint === 'function') { try { NS.hint(); } catch (err) { console.error('NSWake: the hint failed', err); } }
        });
    }

    window.NSWake = Object.freeze({ start, pending: () => !!run });
})();
