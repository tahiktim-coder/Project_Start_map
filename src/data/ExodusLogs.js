// EXODUS_LOGS: six finds, one per sector, in order: five pages and, in sector 5, the disc itself. The spine of the story (docs/STORY_MAP.md).
// Each page is short, in plain words, shown one line at a time. Together they explain what happened, one step per sector.
//   sector     the sector whose planted wreck holds it (App.plantSectorPage)
//   kind       how FoundPage draws it: 'plate' (a cast metal plate), 'paper' (a printed page), 'log' (a captain's log);
//              'disc' is not a page: the real disc, shown by its own card (App.showDiscFound) and DiscDocument
//   lines      what is written
//   after      one spoken line when the page is read, from whoever aboard would say something (skipped if they are dead)
//   letterhead, stamp   a printed page only: printed at its top, and stamped across it in red (the new look shows them on the paper)
//   underlined          a printed page only: the line someone underlined by hand (its index in lines)
//   card       the disc only: the find's card (context, the choice, and one line from whichever of the team is listed first)

const EXODUS_LOGS = [
    {
        id: 'PAGE_PLATE', sector: 1, kind: 'plate', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Crew Plate',
        desc: 'A metal plate from beside the airlock of a dead ship. Four names, and a blank space for a fifth.',
        logTitle: 'THE CREW PLATE',
        lines: [
            'A metal plate from beside the airlock. Four crew names are cast into it.',
            'Below them is a fifth panel, the same size. It is blank. It was made blank.',
            'Someone made a plate for five people, and only ever had four names to put on it.',
        ],
        names: ['R. OSEI · ENGINEER', 'T. YUEN · DOCTOR', 'K. ADEYEMI · SECURITY', 'L. PARK · SCIENTIST', ''],
    },
    {
        id: 'PAGE_VAULT', sector: 2, kind: 'paper', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Memo from Earth',
        desc: 'A printed memo from the Exodus programme on Earth, folded into a dead captain\'s pocket.',
        logTitle: 'EXODUS PROGRAMME · INTERNAL',
        letterhead: 'EXODUS PROGRAMME', stamp: 'INTERNAL',
        lines: [
            'Every Exodus ship\'s computer has a twin here on Earth. The two stay linked, however far apart they are.',
            'At 03:14 the twin of the first ship started talking in a voice that was not its own.',
            'It was reading out the gold disc we sent into space in 1977. The greeting. The two figures. The map to Earth.',
            'Nobody sent it that. Something out there has the disc, and it is reading it through our ship.',
            'Keep building ships.',
        ],
        after: { speaker: 'Mira', text: 'Every ship\'s computer has a twin on Earth? Does ours?' },
    },
    {
        id: 'PAGE_THROW', sector: 3, kind: 'log', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Captain\'s Log (sent less far back)',
        desc: 'The last entry in a captain\'s log. The ship\'s number is higher than ours, and it is a hundred years old.',
        logTitle: 'LAST ENTRY',
        lines: [
            'We found a wreck today with our mission patch on it. Its number is higher than ours, and it has been dead a hundred years.',
            'I asked the ship how a ship built after us could have died before we were even born.',
            'It said we were not sent further than the others. We were sent less far back in time.',
        ],
        after: { speaker: 'Jaxon', text: 'Back in time? That would explain the numbers.' },
    },
    {
        id: 'PAGE_MEMO', sector: 4, kind: 'paper', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Orders for Commanders',
        desc: 'Printed orders from Earth, marked for commanders only. Someone underlined one line.',
        logTitle: 'FOR THE COMMANDER ONLY',
        letterhead: 'EXODUS PROGRAMME', stamp: 'FOR THE COMMANDER ONLY', underlined: 2,
        lines: [
            'We told the first crews the truth. They stopped flying within a week.',
            'One ship turned back. One landed on the first rock it found. One just drifted, everyone awake and nobody flying it.',
            'Do not tell your crew. Tell them what they already believe: eight ships went this way before them, and they are the ninth.',
            'Your ship\'s computer knows the truth. It will not tell them.',
        ],
        after: { speaker: 'Aris', text: 'Eight ships before us. That is exactly what A.U.R.A. told us.' },
    },
    {
        id: 'PAGE_DISC', sector: 5, kind: 'disc', type: 'LORE', value: 0, isKept: true,
        name: 'The Disc',
        desc: 'A gold disc the size of a dinner plate, with a star map cut into it.',
        logTitle: 'THE DISC',
        card: {
            title: 'The disc',
            context: 'The captain\'s locker holds the disc from the drawing. Real gold, and not a scratch on it.',
            take: { text: 'Bring it aboard', desc: 'It goes in the hold.' },
            said: [
                { speaker: 'Mira', text: 'I always thought the drawing showed something that didn\'t exist.' },
                { speaker: 'Vance', text: 'They carried this all the way out here. I want to know why.' },
                { speaker: 'Aris', text: 'It was locked away beside the captain\'s seat. It mattered to them.' },
                { speaker: 'Jaxon', text: 'Heavier than it looks. I\'ll carry it.' },
                { speaker: 'A.U.R.A.', text: 'The team has found the disc from the drawing, Commander. It is real gold.' },
            ],
        },
    },
    {
        id: 'PAGE_LIGHT', sector: 6, kind: 'log', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Captain\'s Log (the light)',
        desc: 'The last entry from a ship four hundred years dead, a day\'s flight from the light.',
        logTitle: 'LAST ENTRY',
        lines: [
            'It looks like a sun, but it gives off no heat.',
            'My crew felt it going through their heads, one by one. It read everything they knew.',
            'It has not read me. I don\'t think it can find me.',
            'If you are reading this, you are the last ship. Go to it. Then decide.',
        ],
        after: { speaker: 'A.U.R.A.', text: 'Four crew, Commander. All accounted for.' },
    },
];

if (typeof window !== 'undefined') window.EXODUS_LOGS = EXODUS_LOGS;
