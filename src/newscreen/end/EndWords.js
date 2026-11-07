/* ═══ Silent Exodus · new screen (?new=1) · end/EndWords.js: what the colony and the loss endings say ═════════════════
   What it is: every line of the two endings the look pass adds (calls C72, C73, C71), in one place for the designer: the
   ordinary settling (end/ColonyArt.js paints it) and every game over (end/LossArt.js paints it), the first sight of the
   light (the reel's captions, said by A.U.R.A.) and her line when a new-look screen will not start (the fallbacks).
   end/Ending.js plays them; bundle.js asks for them (_executeColony, showGameOver, showStructureModal, renderOrbit).
   The lines marked DRAFT are stand-ins until the designer writes them (CALLS.md section D: L-44, L-45, L-46). The others are
   the designer's own, read where they live and never re-worded: A.U.R.A.'s last log entry from the mutiny's game-over
   message, the light's first sight from StoryReel.js. One narrator on every end card: names, never "we" or "you".
   `by`: who says it, the first of them who can speak (alive, awake, not shut away); 'aura' is A.U.R.A.
   Loaded only when the new-screen switch is on, after stop/CopyWords.js, before end/Ending.js.

   window.NSEndWords (frozen)
     WORDS
     colony(state, planet, success) → ending   { ending, door: 'COLONY', title, text, living, success, planet,
                                                 scene: { line: { who, say } } }   (lightEndingFor's shape)
     loss(state, detail) → ending              { ending, door: 'LOSS', kind, title, text, living, dead,
                                                 scene: { line: { who, say } | null } }   dead: who is named on a pod plate
     arrival() → [{ at, who, say }]            the first sight of the light (at: seconds)
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const ROLE = { cora: 'LEADER', jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' };
    const GROUP = ['cora', 'jaxon', 'aris', 'vance', 'mira'];          // the crew list's order: the end card names them so

    const WORDS = Object.freeze({
        colony: Object.freeze({
            // on the ground at dawn, said by the first of them who can speak (L-44)
            arrival: { by: ['jaxon', 'aris', 'mira', 'vance'], say: "We're down. This is home now." },   // DRAFT (look pass)
            arrivalAura: 'We have landed, Commander. This is home now.',   // DRAFT (look pass): nobody else can speak
            failure: 'The colony is lost, Commander. I am sorry.',   // DRAFT (look pass): A.U.R.A., at night
            card: Object.freeze({
                crew: '{names} made a home on {world}.',   // DRAFT (look pass)
                alone: '{names} made a home on {world}, alone.',   // DRAFT (look pass)
                held: 'The first winter was hard. The colony held.',   // DRAFT (look pass)
                later: 'Fifty years later, its lights are still on.',   // DRAFT (look pass)
                landed: '{names} landed on {world}.',   // DRAFT (look pass): the colony that failed
                failed: 'The colony did not last its first year.',   // DRAFT (look pass)
            }),
        }),
        loss: Object.freeze({
            // the end card's name: the game-over titles, said in sentence case
            titles: Object.freeze({
                CREW_LOSS: 'All hands lost',   // DRAFT (look pass)
                HULL_BREACH: 'Hull breach',   // DRAFT (look pass)
                COMMANDER_BREAKDOWN: 'Command failure',   // DRAFT (look pass)
                AURA_MUTINY: 'A.U.R.A. mutiny',   // DRAFT (look pass)
                STRANDED: 'Stranded',   // DRAFT (look pass)
            }),
            // A.U.R.A.'s one plain line as the ship goes dark (L-45). The mutiny's is her last log entry, as the game-over
            // message quotes it (bundle.js showAuraVentModal): the designer's words.
            lines: Object.freeze({
                CREW_LOSS: 'The crew is gone, Commander. The ship drifts on.',   // DRAFT (look pass)
                HULL_BREACH: 'The hull broke in the night. It was quick.',   // DRAFT (look pass)
                COMMANDER_BREAKDOWN: "The commander can't lead anymore. The crew are lost without you.",   // DRAFT (look pass)
                STRANDED: 'We have no energy left, Commander. No world is in reach.',   // DRAFT (look pass): L-45 has none
            }),
        }),
        // a new-look screen that will not start (the bridge, today): A.U.R.A., over the ink, with "› Try again" (L-46)
        recover: 'That system will not start, Commander.',   // DRAFT (look pass)
        keys: Object.freeze({ again: 'Try again', skip: 'Skip' }),
    });
    // every pod is named on these: nobody aboard lived (the hull, the dark, the vents); a command failure names only the dead
    const EVERYONE = ['CREW_LOSS', 'HULL_BREACH', 'STRANDED', 'AURA_MUTINY'];

    const member = (state, id) => ((state && state.crew) || []).find(c => (c.tags || []).includes(ROLE[id])) || null;
    const alive = (state, id) => { const m = member(state, id); return !!m && m.status !== 'DEAD'; };
    function canSpeak(state, id) {
        const W = window.NSCopyWords;
        if (W && typeof W.canSpeak === 'function') return W.canSpeak(state, id);
        return id === 'aura' || alive(state, id);
    }
    const list = names => (names.length < 2 ? names[0] || '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

    /** The ordinary settling: success (outcome.success) on the ground at dawn, or the failure at night. */
    function colony(state, planet, success) {
        const C = WORDS.colony, living = GROUP.filter(id => alive(state, id)), names = living.map(id => member(state, id).name);
        const world = (planet && planet.name) || '', fill = s => s.replace('{names}', list(names)).replace('{world}', world);
        const who = C.arrival.by.find(id => canSpeak(state, id)) || null;
        const line = success ? (who ? { who, say: C.arrival.say } : { who: 'aura', say: C.arrivalAura }) : { who: 'aura', say: C.failure };
        const text = success ? [fill(names.length < 2 ? C.card.alone : C.card.crew), C.card.held, C.card.later] : [fill(C.card.landed), C.card.failed];
        return { ending: success ? 'COLONY_FOUNDED' : 'COLONY_FAILED', door: 'COLONY', title: world, text, living, success: !!success, planet, scene: { line } };
    }

    /** What kind of loss a game-over detail is: its type, or STRANDED by its title (that one has no type). */
    function kindOf(detail) {
        const d = detail || {};
        if (d.type && WORDS.loss.titles[d.type]) return d.type;
        return /STRANDED/i.test(String(d.title || '')) ? 'STRANDED' : d.type || 'CREW_LOSS';
    }
    /** A.U.R.A.'s last log entry, as the mutiny's message quotes it (the last "..." in it), or null. */
    function quoted(message) {
        const m = /"([^"]+)"\s*$/.exec(String(message || '').replace(/<[^>]*>/g, ' ').trim());
        return m ? m[1].trim() : null;
    }
    /** Every game over (all hands, the hull, stranded, command failure, the mutiny). dead: the crew named on their pod plates,
        the run's own dead list, and everyone aboard when nobody lived (EVERYONE). */
    function loss(state, detail) {
        const L = WORDS.loss, kind = kindOf(detail), living = GROUP.filter(id => alive(state, id));
        const dead = GROUP.filter(id => member(state, id) && (EVERYONE.includes(kind) || !alive(state, id)));
        const say = kind === 'AURA_MUTINY' ? quoted(detail && detail.message) : L.lines[kind] || null;
        const title = L.titles[kind] || String((detail && detail.title) || '');
        return { ending: 'LOSS_' + kind, door: 'LOSS', kind, title, text: [], living, dead, scene: { line: say ? { who: 'aura', say } : null } };
    }

    /** The first sight of the light: what the reel's captions said, said by A.U.R.A. (StoryReel.js REELS.light, the designer's). */
    function arrival() {
        const reel = window.StoryReel && window.StoryReel.REELS && window.StoryReel.REELS.light;
        return reel && Array.isArray(reel.beats) ? reel.beats.map(([ms, say]) => ({ at: ms / 1000, who: 'aura', say })) : [];
    }

    window.NSEndWords = Object.freeze({ WORDS, colony, loss, arrival, kindOf, member });
})();
