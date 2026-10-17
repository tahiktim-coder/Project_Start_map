/**
 * THE LIGHT — the end of the heading (docs/STORY_MAP.md step 9; the two doors decided 2026-10-17).
 *
 * Nothing random happens here and nothing is locked. The light fills the window (StoryReel 'light'); if we found the disc in
 * sector 5, ours comes out of the hold (disc.view); then the crew have their say at the window (buildLightCouncil) and the
 * commander picks "Not yet" (nothing spent) or one of two doors:
 *   INTO THE LIGHT  it looks frightening and is peace. If the disc is aboard it goes in with us: the trap never gets the map.
 *   BACK TO EDEN    it looks like home and is the trap. If the disc is aboard it stays on Eden: the trap has the map to Earth.
 * Settling on Eden earlier (through the settle council) is the same Eden ending (bundle.js _executeColony).
 * lightEndingFor(door, state) is everything an ending says: the end card's name and lines (the default game's old end screen shows
 * the same lines) and the lines the new look's scenes speak (src/newscreen/end/Ending.js).
 * EVERY LINE IN THIS FILE IS A DRAFT (docs/STYLE.md: plain, one idea, at most 20 words); the designer rewrites them.
 * The two count lines of the approach ("Five crew" and Vance's answer) are the designer's to decide: left as they were.
 */

const STRUCTURE_ENCOUNTER = {
    id: 'THE_STRUCTURE',

    approach: {
        kicker: 'THE END OF THE HEADING',
        title: 'The light',
        context: 'It fills every window. It looks like a sun, but it gives off no heat.',
        dialogue: [
            { speaker: 'A.U.R.A.', text: 'Five crew, Commander. All accounted for.' },
            { speaker: 'Vance', text: 'Five. She has never said five before.' },
        ],
    },

    // our own disc, out of the hold before the crew have their say (only if we found it, and only the first time)
    disc: {
        view: { kicker: 'AT THE LIGHT · THE DISC FROM OUR HOLD', aura: 'We carried it all the way to the light, Commander.', close: 'GO ON', closeNote: 'the crew are waiting' },
    },

    // ── the crew have their say at the window (docs/CREW_BIBLE.md): one line each, the first whose `when` holds in this run.
    //    `when` only leans on what happened (never a lock): hasDisc, edenVisited (a team walked on Eden), walkedEden (this
    //    person did), wentWithout (went without supper at least once), sentMost (sent down three times or more, more than
    //    anyone), lostSomeone (a crewmate died; {lost} is their name). The dead say nothing; shut in the hold, the settle
    //    council's refusal (SettleCouncil.js); asleep or shut down, nothing. "Not yet" first, nearest the talk.
    council: {
        speakOrder: ['jaxon', 'vance', 'aris', 'mira'],          // Mira last: for once she answers before A.U.R.A. does
        lines: {
            // Jaxon wants to stop and live: Eden pulls him
            jaxon: [
                { when: 'walkedEden', text: 'I walked on Eden, Commander. It felt like home. I want to go back.' },
                { when: 'wentWithout', text: 'I went without supper so the others could eat. On Eden, nobody would have to.' },
                { text: "Eden is right behind us, Commander. Clean air, fresh water. I'd turn around and stay." },
            ],
            // Vance distrusts what looks too good
            vance: [
                { when: 'hasDisc', text: "We have the disc aboard. I don't want it anywhere near a place that perfect." },
                { when: 'edenVisited', text: 'Every tree on Eden was ripe at the same time. Nothing grows like that.' },
                { text: "Eden looks perfect, Commander. Nothing out here has been perfect. I don't trust it." },
            ],
            // Aris speaks for the dead, and their wish for rest
            aris: [
                { when: 'lostSomeone', text: 'I put {lost} on my list too. I want all of them to rest now.' },
                { text: 'Every crew on my list was flying to this light. I think they just wanted to rest.' },
            ],
            // Mira decides for herself, for the first time, instead of asking A.U.R.A.
            mira: [
                { when: 'sentMost', text: "I've been sent down more than anyone. I don't need A.U.R.A. to tell me this light is safe." },
                { text: "I'm not asking A.U.R.A. this time. I looked myself. The light isn't hurting anyone." },
            ],
        },
        again: { speaker: 'A.U.R.A.', text: 'The crew are ready when you are, Commander.' },   // asked again after "Not yet"
        choices: [
            { door: null, text: 'Not yet', desc: 'Stay here a while. Nothing is decided.' },
            { door: 'LIGHT', text: 'Into the light', desc: 'The journey ends inside it.' },
            { door: 'EDEN', text: 'Back to Eden', desc: 'The journey ends on Eden.' },
        ],
    },

    // ── the two endings: the end card ({names}: the living, {them}: "them" or "you" when only the commander is left) and
    //    what the new look's scenes say (the dead, the asleep and the shut down say nothing; a closing line goes to the first
    //    of them who can speak, A.U.R.A. last) ──
    endings: {
        LIGHT: {
            id: 'INTO_THE_LIGHT', title: 'Into the light',
            card: {
                crew: '{names} went into the light together. It was quiet there, and nobody was afraid.',
                alone: 'You went into the light alone. It was quiet there, and you were not afraid.',
                lost: 'The crews from the wrecks we found were there too.',
                disc: 'The disc went with {them}. Eden never got the map to Earth.',
                noDisc: 'The disc was never found. It is still out there somewhere.',
            },
            // the approach (from prototypes/play-ideas/last-approach.js, which the designer loved): `at` is how far in
            flight: [
                { at: 0.03, who: 'aura', say: 'Course set for the light, Commander.' },
                { at: 0.11, who: 'mira', say: "It's so bright. I can barely look at it." },
                { at: 0.19, who: 'jaxon', say: "Commander, the hull's heating up. Turn us around." },
                { at: 0.27, who: 'aura', say: 'That alarm is wrong, Commander. The hull is cold.' },
                { at: 0.35, who: 'vance', say: "Don't trust A.U.R.A. on this. Turn us back." },
                { at: 0.43, who: 'aris', say: 'Eden is right behind us. We could stop there.' },
                { at: 0.51, who: 'aura', say: 'Every alarm is on, Commander. The sensors read nothing wrong.' },
                { at: 0.59, who: 'jaxon', say: 'I just want to stop somewhere and live. Please turn us around.' },
                { at: 0.67, who: 'mira', say: "I can't see anything. Commander, I can't see." },
                { at: 0.75, who: 'vance', say: "If you're wrong, we all die. Turn back." },
                { at: 0.83, who: 'aris', say: "Whatever happens, I'm glad we're together." },
            ],
            hold: { who: 'aura', say: 'Still on course, Commander.' },   // the ship slows; the commander keeps going, or waits
            keepGoing: 'Keep going',
            closing: [                                                   // after the white, somewhere calm
                { who: 'jaxon', say: "It's quiet here. I think we can stop now." },
                { who: 'aris', say: "It's so quiet. Nobody here is afraid." },
                { who: 'mira', say: "It's so quiet. I'm not scared anymore." },
                { who: 'vance', say: 'Quiet. For once, nothing feels wrong.' },
                { who: 'aura', say: 'We have stopped, Commander. Everything is quiet.' },
            ],
        },
        EDEN: {
            id: 'BACK_TO_EDEN', title: 'Eden',
            card: {
                crew: '{names} settled on Eden. Nobody went hungry again.',
                alone: 'You settled on Eden alone. You never went hungry again.',
                letter: 'Jaxon recorded a letter to his daughter and, for once, finished it.',   // kept from the old settle ending
                sky: 'At night the light was the brightest thing in the sky. Nobody talked about it.',   // kept too
                disc: 'The disc stayed on Eden, and the map to Earth with it.',
                noDisc: 'The disc was never found. It is still out there somewhere.',
            },
            turn: { who: 'aura', say: 'Eden is still there, Commander.' },   // turning back from the light (the mockup's line)
            closing: [                                                   // in the meadow, as they settle into the grass
                { who: 'jaxon', say: "This is it, Commander. We're home." },
                { who: 'mira', say: "We made it, Commander. We're home." },
                { who: 'aris', say: "Everyone can rest now. We're home." },
                { who: 'vance', say: "We're staying, then. All right." },
                { who: 'aura', say: 'We have landed, Commander. Mission complete.' },
            ],
            discLine: 'Now they have the map to Earth.',                 // the last words, only with the disc aboard: never says who
        },
    },
};

const LIGHT_ROLE = { cora: 'LEADER', jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' };
const LIGHT_GROUP = ['cora', 'jaxon', 'aris', 'vance', 'mira'];            // the crew list's order: the end card names them so

const lightMember = (state, id) => ((state && state.crew) || []).find(c => (c.tags || []).includes(LIGHT_ROLE[id])) || null;
const isLightLiving = member => !!member && member.status !== 'DEAD';

/** "Jaxon", "Jaxon and Aris", "Cora, Jaxon and Aris". */
function lightNames(names) {
    return names.length < 2 ? (names[0] || '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** What one person's line may lean on in this run (see `council` above). Reads the state; changes nothing. */
function lightFacts(state, id) {
    const crew = (state && state.crew) || [], me = lightMember(state, id);
    const eden = ((state && state.sectorNodes) || []).find(n => n && (n.isEden || n.type === 'EDEN'));
    const trips = m => (m && m._tripsDown) || 0;
    const lost = crew.find(c => c.status === 'DEAD' && c !== me);
    return {
        hasDisc: !!(state && state.hasDisc),
        edenVisited: !!(eden && eden.hasEva),
        walkedEden: !!(me && me._walkedEden),
        wentWithout: !!(me && me._wentWithout),
        sentMost: !!me && trips(me) >= 3 && crew.every(c => c === me || c.status === 'DEAD' || trips(c) <= trips(me)),
        lostSomeone: !!lost,
        lost: lost ? lost.name : '',
    };
}

/**
 * The crew have their say at the light, ready for EncounterCard.open: { kicker, title, context, dialogue, choices, doors }.
 * doors[i] is what choice i does: null ("Not yet") | 'LIGHT' | 'EDEN'. isRepeat: asked again after "Not yet", when only
 * A.U.R.A. speaks. Reads state.crew, state.hasDisc, state.sectorNodes. Changes nothing.
 */
function buildLightCouncil(state, { isRepeat = false } = {}) {
    const E = STRUCTURE_ENCOUNTER, C = E.council, a = E.approach;
    const voiceOf = m => (typeof settleCouncilVoice === 'function' ? settleCouncilVoice(m) : (isLightLiving(m) ? 'speaks' : 'silent'));
    const refusals = typeof SETTLE_COUNCIL !== 'undefined' ? SETTLE_COUNCIL.refusal : {};
    const crewLines = isRepeat ? [] : C.speakOrder.map(id => {
        const member = lightMember(state, id), voice = voiceOf(member);
        if (voice === 'silent') return null;
        const facts = lightFacts(state, id), line = C.lines[id].find(l => !l.when || facts[l.when]);
        const text = (voice === 'refuses' && refusals[id]) || line.text.replace('{lost}', facts.lost);
        return { speaker: member.name, text };
    }).filter(Boolean);
    return {
        kicker: a.kicker, title: a.title, context: isRepeat ? '' : a.context,
        dialogue: isRepeat ? [{ ...C.again }] : [...a.dialogue.map(d => ({ ...d })), ...crewLines],
        choices: C.choices.map(({ text, desc }) => ({ text, desc })),
        doors: C.choices.map(c => c.door),
    };
}

/**
 * Everything one ending says, for this run: { ending, door, title, text, hasDisc, living, scene }.
 *   text     the end card's lines (also the paragraphs of the default game's old end screen)
 *   living   who is alive, in the crew list's order ('cora', 'jaxon' ...): the scenes draw them all
 *   scene    what the new look's scene says, only by those who can speak (alive, not asleep or shut down):
 *            LIGHT { flight: [{ at, who, say }], hold, keepGoing, closing }   EDEN { turn, closing, discLine | null }
 * door: 'LIGHT' | 'EDEN'. Reads the state; changes nothing.
 */
function lightEndingFor(door, state) {
    const E = STRUCTURE_ENCOUNTER.endings[door];
    if (!E) throw new Error(`lightEndingFor: unknown door "${door}"`);
    const living = LIGHT_GROUP.filter(id => isLightLiving(lightMember(state, id)));
    const names = living.map(id => lightMember(state, id).name), isAlone = names.length < 2;
    const hasDisc = !!(state && state.hasDisc), card = E.card;
    const canSpeak = id => (typeof settleCouncilVoice === 'function' ? settleCouncilVoice(lightMember(state, id)) !== 'silent' : true);   // not asleep or shut down
    const speaks = line => !!line && (line.who === 'aura' || (living.includes(line.who) && canSpeak(line.who)));
    const closing = { ...E.closing.find(speaks) };
    const crewLine = isAlone ? card.alone : card.crew.replace('{names}', lightNames(names));
    const discLine = hasDisc ? card.disc.replace('{them}', isAlone ? 'you' : 'them') : card.noDisc;
    const middle = door === 'LIGHT' ? card.lost : living.includes('jaxon') ? card.letter : card.sky;
    const scene = door === 'LIGHT'
        ? { flight: E.flight.filter(speaks).map(l => ({ ...l })), hold: { ...E.hold }, keepGoing: E.keepGoing, closing }
        : { turn: { ...E.turn }, closing, discLine: hasDisc ? E.discLine : null };
    return { ending: E.id, door, title: E.title, text: [crewLine, middle, discLine], hasDisc, living, scene };
}

if (typeof window !== 'undefined') {
    window.STRUCTURE_ENCOUNTER = STRUCTURE_ENCOUNTER;
    window.buildLightCouncil = buildLightCouncil;
    window.lightEndingFor = lightEndingFor;
}
