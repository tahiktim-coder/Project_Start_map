// SETTLE_COUNCIL: before the crew land on a world for good (which ends the run), everyone who can speak says one line,
// then A.U.R.A. asks the question. Replaces the sector 1-2 colony warning (bundle.js showColonyWarningModal) and the
// one-line question (bundle.js askBeforeSettling). docs/SETTLING.md explains it for the designer.
//
// buildSettleCouncil(state, planet, { viability, isRepeat }) picks the lines from four things:
//   scan      EndingSystem.getPlanetViability: EXCELLENT or GOOD = 'good', MARGINAL = 'marginal', POOR or IMPOSSIBLE = 'bad'
//   band      sector 1-2 'early' (we only just left), 3-4 'middle', 5-6 'late' (we are this close to the light)
//   knows     'told'  they still believe the briefing
//             'doubt' they have seen it is not eight ships: the uncut tape (sector 2), or any sector from 3 on
//                     (hundreds of our ships, numbers higher than ours, a hundred years dead)
//             'truth' a page explains it: PAGE_THROW (sent less far back in time) or PAGE_LEDGER (lost before launched)
//   who       dead, sedated or shut-down (CATATONIC) crew say nothing; crew shut in the hold (CONFINED) refuse to come
//   unscanned no deep scan of the world (the team walked onto a paradise world first): Mira has no scan to read, and says so
//
// lines[person][scan] holds one line per band. A key like 'late.truth' wins over 'late' once the crew knows that much.
// Vance's lines do not depend on the scan (scan key 'any'): he wants the truth whatever the world is like.
// Order: Mira reads the scan, Jaxon the ship and supplies, Aris the living, Vance the truth, then A.U.R.A.'s question.
// At most MAX_LINES are spoken: A.U.R.A. opens only when fewer than four crew can speak. Every line follows docs/STYLE.md.

const SETTLE_COUNCIL = {
    MAX_LINES: 5,
    TRUTH_PAGES: ['PAGE_THROW', 'PAGE_LEDGER'],
    TAPE_ID: 'briefing_tape',
    SCAN_TIER: { EXCELLENT: 'good', GOOD: 'good', MARGINAL: 'marginal', POOR: 'bad', IMPOSSIBLE: 'bad' },
    SPEAK_ORDER: ['mira', 'jaxon', 'aris', 'vance'],
    ROLE_TAG: { jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' },

    kicker: 'SETTLE',
    title: 'Settle on {planet}?',
    opening: 'Before you decide, Commander, the crew would like a word.',
    closing: 'If we land for good, the journey ends here, Commander. Settle anyway?',
    choices: [
        { text: 'Not yet', desc: 'Stay in orbit. The journey goes on.' },
        { text: 'Settle here', desc: 'The journey ends on this world.' },
    ],

    // No deep scan of this world (the team walked onto a paradise world first). Every other line of Mira's reads a scan.
    unscanned: {
        mira: 'We never ran a deep scan here, Commander. All we know is what the team saw down there.',
    },

    // Shut in the hold: they will not come up, and say so.
    refusal: {
        jaxon: "Leave me out of it. I'm staying down here.",
        aris: "I can't face the bridge right now. Decide without me.",
        vance: "I'm not coming up. You already know what I'd say.",
        mira: "I'm staying down here. Ask A.U.R.A. I'll go with whatever she says.",
    },

    lines: {
        // Mira reads the scan. Excited early, wary in the middle, scared of the light late. She trusts A.U.R.A.
        mira: {
            good: {
                early: 'Everything on the scan says we could live here. A.U.R.A. went through every number with me.',
                middle: "It's a good scan, Commander. After all those dead ships, I didn't think we'd see one.",
                late: "Good scan. Honestly, Commander, I'd rather live here than find out what that light is.",
            },
            marginal: {
                early: "People could live here, but it would be hard. A.U.R.A. thinks we'll find better.",
                middle: "It's a hard world. Nothing down there would kill us outright, but nothing would help us either.",
                late: 'A.U.R.A. says we could survive here, just. I trust her numbers, Commander.',
            },
            bad: {
                early: 'The scan is bad, Commander. A.U.R.A. gives a colony here almost no chance.',
                middle: 'This world would kill us. A.U.R.A. and I read the scan the same way.',
                late: "I know everyone's tired. But nobody lives long down there. A.U.R.A. is sure of it.",
            },
        },
        // Jaxon wants to stop, more with every sector, and thinks in parts, food and hull.
        jaxon: {
            good: {
                early: "Early suits me. Better to land while the ship still holds together.",
                middle: "We have the parts to build a camp and the food to reach a first harvest. Let's do it.",
                late: "We won't see many more worlds like this before the light. Let's land, Commander.",
                'late.truth': "The drive's been throwing us back in time. I'd like to switch it off for good.",
            },
            marginal: {
                early: "We've got food for a long way yet. No sense taking a hard world this early.",
                middle: "It's not good. But every jump costs us, and the food won't last forever.",
                late: "It's poor ground, but it's ground. I'd rather farm rock than fly another sector.",
            },
            bad: {
                early: "We'd spend everything in the hold on a world that won't keep us. Not this one.",
                middle: "Nothing I could build down there would stand for long. We're safer on the ship.",
                late: "Even I won't land on this one, Commander. And you know how much I want to stop.",
            },
        },
        // Aris is tired, and thinks of the living.
        aris: {
            good: {
                early: "I'd like everyone on this ship to grow old. This world would let them.",
                middle: "I'd like to deliver a baby somewhere before I write down another dead crew.",
                late: "I'm tired, Commander. I'd like to stop reading names and start growing something.",
                'late.truth': 'I came out here to understand the dead. I understand enough now. Let\'s look after the living.',
            },
            marginal: {
                early: "A hard world takes the old and the sick first. We don't need that risk yet.",
                middle: "We'd lose people on a world like this. Not all at once, but we would.",
                late: "It would be hard on all of us. I think we're ready for hard, Commander.",
            },
            bad: {
                early: "I'm the only doctor, and we have very little medicine. That won't be enough down there.",
                middle: "I'd spend every day down there treating people I couldn't save. Please, not here.",
                late: "We didn't come all this way to die in the first year.",
            },
        },
        // Vance wants the truth, whatever the world is like.
        vance: {
            any: {
                early: 'We only just left, Commander. Land now and we never find out what happened to the others.',
                'early.doubt': 'That tape showed hundreds of ships, not eight. I want to know where they went before we stop.',
                middle: "Ship numbers higher than ours, and older than us. I'm not stopping until someone explains that.",
                'middle.truth': 'Now we know why the numbers are wrong. I still want to know what they were all flying toward.',
                late: 'Thousands of our ships out here, and still no reason why. I want to see that light first.',
                'late.truth': "We're this close to the light, Commander. It's the last answer left. I'm not stopping short of it.",
            },
        },
    },
};

/** 'early' (sectors 1-2), 'middle' (3-4) or 'late' (5-6). */
function settleCouncilBand(sector) {
    const s = sector || 1;
    if (s <= 2) return 'early';
    return s <= 4 ? 'middle' : 'late';
}

/** What the crew knows by now: 'told', 'doubt' or 'truth' (see the top of this file). */
function settleCouncilKnowledge(state) {
    const pages = state.exodusLogsFound || [];
    if (SETTLE_COUNCIL.TRUTH_PAGES.some(id => pages.includes(id))) return 'truth';
    const hasTape = (state.cargo || []).some(item => item && item.id === SETTLE_COUNCIL.TAPE_ID);
    return (state.currentSector || 1) >= 3 || hasTape ? 'doubt' : 'told';
}

/** 'speaks', 'refuses' (shut in the hold) or 'silent' (dead, sedated, shut down, or not aboard). */
function settleCouncilVoice(member) {
    if (!member || member.status === 'DEAD') return 'silent';
    const tags = member.tags || [];
    if (tags.includes('SEDATED') || member.trait === 'CATATONIC') return 'silent';
    return tags.includes('CONFINED') ? 'refuses' : 'speaks';
}

/** The line for one person: the most specific key that exists ('late.truth', then 'late'). */
function settleCouncilLine(person, scan, band, knows) {
    const table = SETTLE_COUNCIL.lines[person][scan] || SETTLE_COUNCIL.lines[person].any;
    return table[`${band}.${knows}`] || (knows === 'truth' && table[`${band}.doubt`]) || table[band];
}

/**
 * The whole council, ready for EncounterCard.open: { kicker, title, dialogue, choices, situation }.
 *   viability  EndingSystem.getPlanetViability(planet, state); required
 *   isRepeat   true when this world has had its council already: only A.U.R.A.'s question is asked again
 * Reads state.currentSector, state.crew, state.exodusLogsFound, state.cargo and planet.scanned. Changes nothing.
 */
function buildSettleCouncil(state, planet, { viability, isRepeat = false } = {}) {
    const scan = SETTLE_COUNCIL.SCAN_TIER[viability];
    if (!scan) throw new Error(`buildSettleCouncil: unknown viability "${viability}"`);
    const band = settleCouncilBand(state.currentSector);
    const knows = settleCouncilKnowledge(state);
    const crew = state.crew || [];

    const crewLines = isRepeat ? [] : SETTLE_COUNCIL.SPEAK_ORDER.map(person => {
        const member = crew.find(c => (c.tags || []).includes(SETTLE_COUNCIL.ROLE_TAG[person]));
        const voice = settleCouncilVoice(member);
        if (voice === 'silent') return null;
        const text = voice === 'refuses' ? SETTLE_COUNCIL.refusal[person]
            : (!planet.scanned && SETTLE_COUNCIL.unscanned[person]) || settleCouncilLine(person, scan, band, knows);
        return { speaker: member.name, text };
    }).filter(Boolean);

    const hasRoomToOpen = crewLines.length > 0 && crewLines.length + 2 <= SETTLE_COUNCIL.MAX_LINES;
    const opening = hasRoomToOpen ? [{ speaker: 'A.U.R.A.', text: SETTLE_COUNCIL.opening }] : [];
    return {
        kicker: SETTLE_COUNCIL.kicker,
        title: SETTLE_COUNCIL.title.replace('{planet}', planet.name),
        dialogue: [...opening, ...crewLines, { speaker: 'A.U.R.A.', text: SETTLE_COUNCIL.closing }],
        choices: SETTLE_COUNCIL.choices.map(choice => ({ ...choice })),
        situation: { scan, band, knows },
    };
}

if (typeof window !== 'undefined') {
    window.SETTLE_COUNCIL = SETTLE_COUNCIL;
    window.buildSettleCouncil = buildSettleCouncil;
}
