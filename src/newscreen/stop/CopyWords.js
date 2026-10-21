/* ═══ Silent Exodus · new screen (?new=1) · stop/CopyWords.js: what is said at the copy of Earth ═══════════════════════
   What it is: every line of the Wrong Place in the new look, in one place for the designer: the crew at the window after
   the fall, A.U.R.A. after the scan, Jaxon while we fight, A.U.R.A.'s report once we are out, the crew's say before going
   down (as data/SettleCouncil.js), and the trap's ending (end/Ending.js plays it, end/CopyArt.js paints it).
   Lore (data/AnomalyEncounters.js): something out here copies what is ours and gets it slightly wrong. Never named.
   EVERY LINE IN THIS FILE IS A DRAFT (docs/STYLE.md: plain, one idea, at most 20 words); the designer rewrites them.
   `by`: who says it, the first of them who can speak (alive, awake, not shut away); 'aura' is A.U.R.A.
   Loaded only when the new-screen switch is on, before stop/Copy.js and end/Ending.js.

   window.NSCopyWords (frozen)
     ARRIVAL, SCAN, FIGHT, escaped(lost), COUNCIL, council(state, isRepeat), ending(state), arrival(state, victim),
     canSpeak(state, id), onBridge(state, id) (alive, not shut away: where the bridge shows them)
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const ROLE = { cora: 'LEADER', jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' };
    const GROUP = ['cora', 'jaxon', 'aris', 'vance', 'mira'];
    const HE = { jaxon: 'He', aris: 'She', vance: 'He', mira: 'She' };
    const member = (state, id) => ((state && state.crew) || []).find(c => (c.tags || []).includes(ROLE[id])) || null;
    /** Alive, awake, not shut away in the hold, not shut down: they can say a line. */
    function canSpeak(state, id) {
        if (id === 'aura') return true;
        const m = member(state, id);
        if (!m || m.status === 'DEAD') return false;
        const tags = m.tags || [];
        return !tags.includes('SEDATED') && !tags.includes('CONFINED') && m.trait !== 'CATATONIC';
    }
    const first = (state, by, not) => (by || []).find(id => id !== not && canSpeak(state, id)) || null;
    /** On the bridge: alive, not shut in the hold, not kept asleep (a breakdown can take the one the fall hurt away). */
    function onBridge(state, id) {
        const m = member(state, id);
        return !!m && m.status !== 'DEAD' && !(m.tags || []).some(t => t === 'CONFINED' || t === 'SEDATED');
    }

    // ── at the window, after the fall: one line at a time, each beside the one who says it (DRAFT) ──
    const ARRIVAL = Object.freeze({
        // first, about whoever the fall threw against the wall ({name}, {He}); Aris if she can (she says they will live)
        hurt: { by: ['aris', 'vance', 'mira', 'jaxon'], doctor: '{name} hit the wall. {He}\'s hurt. {He}\'ll live.', other: '{name} hit the wall. {He}\'s hurt.' },
        talk: [
            { key: 'home', by: ['jaxon', 'aris', 'mira'], text: "That's Earth. That's home!" },
            { key: 'stopped', by: ['mira', 'vance', 'aris', 'jaxon'], text: 'It stopped turning.', afterStop: true },
            { key: 'moon', by: ['vance', 'mira', 'aris', 'jaxon'], text: "Where's the Moon?" },
            { key: 'notEarth', by: ['aura'], text: 'That is not Earth, Commander.' },
            { key: 'goDown', by: ['jaxon'], text: "I don't care what it is. Let's go down." },
        ],
    });
    // A.U.R.A., once the scan has swept it (DRAFT)
    const SCAN = 'There is nothing under the ground, Commander. It is only the outside.';
    // while the engines strain (DRAFT)
    const FIGHT = { by: ['jaxon'], text: "No! That's home!" };
    /** A.U.R.A.'s report once the seam has thrown us back (DRAFT): what it cost, plainly. lost: { energy, salvage }. */
    function escaped(lost) {
        const parts = [];
        if (lost && lost.energy > 0) parts.push(`${lost.energy} energy`);
        if (lost && lost.salvage > 0) parts.push(`${lost.salvage} salvage`);
        return parts.length ? `We are back in normal space, Commander. It cost us ${parts.join(' and ')}.` : 'We are back in normal space, Commander.';
    }

    // ── before going down: the crew have their say (as data/SettleCouncil.js), "Not yet" first (DRAFT) ──
    const COUNCIL = Object.freeze({
        kicker: 'GO DOWN', title: 'Land on it?',
        speakOrder: ['jaxon', 'vance', 'aris', 'mira'], maxCrew: 3,
        lines: {
            jaxon: 'It looks like home, Commander. That is enough for me.',
            vance: "Nothing down there moves. If we land on it, I don't think we ever leave.",
            aris: "We're all worn out. But I don't trust a world where nothing moves.",
            mira: "A.U.R.A. says it isn't Earth. I looked for myself. She's right.",
        },
        closing: 'If we land, the journey ends there, Commander. Go down anyway?',
        again: 'The journey ends there if we land, Commander. Go down anyway?',
        choices: [{ text: 'Not yet', desc: 'Stay at the window. Nothing is decided.' }, { text: 'Go down', desc: 'The journey ends on it.' }],
    });
    /** The council, ready for EncounterCard.open: { kicker, title, dialogue, choices }. isRepeat: only A.U.R.A. asks again. */
    function council(state, isRepeat) {
        const C = COUNCIL, names = id => (member(state, id) || {}).name || id;
        const crew = isRepeat ? [] : C.speakOrder.filter(id => canSpeak(state, id)).slice(0, C.maxCrew).map(id => ({ speaker: names(id), text: C.lines[id] }));
        return { kicker: C.kicker, title: C.title, dialogue: crew.concat({ speaker: 'A.U.R.A.', text: isRepeat ? C.again : C.closing }), choices: C.choices.map(c => ({ ...c })) };
    }

    // ── the trap's ending: the descent, the ground, the night, the end card (DRAFT) ──
    const ENDING = Object.freeze({
        id: 'WRONG_PLACE_ACCEPTED', title: 'A copy of somewhere',
        ground: { by: ['jaxon', 'aris', 'mira', 'vance'], lines: ['Smell that?', 'It smells of nothing.'] },
        night: ['Four figures walk the decks of the ship in orbit.', 'You count them from the ground every night. There are always four.'],   // kept from the old end screen
        card: {
            crew: '{names} stayed on a copy of Earth.',
            alone: 'You stayed on a copy of Earth, alone.',
            made: 'Something copied home, and got the grass wrong.',
            jaxon: 'Jaxon names the place every morning. It never sticks.',
            air: 'The air is clean, and it tastes of nothing.',
        },
    });
    const list = names => (names.length < 2 ? names[0] || '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
    /** Everything the ending says for this run, in lightEndingFor's shape: { ending, door: 'COPY', title, text, living, scene }.
        scene: { ground: [{ who, say }], night: [{ who: null, say }] }. Reads the state; changes nothing. */
    function ending(state) {
        const E = ENDING, living = GROUP.filter(id => { const m = member(state, id); return m && m.status !== 'DEAD'; });
        const names = living.map(id => member(state, id).name), alone = names.length < 2;
        const who = first(state, E.ground.by);
        return {
            ending: E.id, door: 'COPY', title: E.title, living,
            text: [alone ? E.card.alone : E.card.crew.replace('{names}', list(names)), E.card.made, living.includes('jaxon') ? E.card.jaxon : E.card.air],
            scene: { ground: who ? E.ground.lines.map(say => ({ who, say })) : [], night: E.night.map(say => ({ who: null, say })) },
        };
    }
    /** The line about whoever the fall hurt: { who, text } or null (only while they lie here, on the bridge). victim: their crew id. */
    function hurtLine(state, victim) {
        const m = victim && member(state, victim);
        if (!m || m.status !== 'INJURED' || !onBridge(state, victim)) return null;
        const H = ARRIVAL.hurt, who = first(state, H.by, victim);
        if (!who) return null;
        const he = HE[victim] || 'They', text = (who === 'aris' ? H.doctor : H.other).replace('{name}', m.name).split('{He}').join(he);
        return { who, text };
    }
    /** The talk at the window: [{ key, who, text, afterStop }] by those who can speak (the hurt line first). Whoever lies hurt
        says nothing at the window unless the line is theirs alone; nobody says two lines in a row while someone else can. */
    function arrival(state, victim) {
        const out = [], h = hurtLine(state, victim);
        if (h) out.push({ key: 'hurt', who: h.who, text: h.text });
        ARRIVAL.talk.forEach(l => {
            const last = out.length ? out[out.length - 1].who : null, up = l.by.filter(id => id !== victim);
            const who = first(state, up, last) || first(state, up) || (l.by.length === 1 ? first(state, l.by) : null);
            if (who) out.push({ key: l.key, who, text: l.text, afterStop: !!l.afterStop });
        });
        return out;
    }

    window.NSCopyWords = Object.freeze({ ARRIVAL, SCAN, FIGHT, COUNCIL, ENDING, escaped, council, ending, arrival, canSpeak, onBridge, member, first });
})();
