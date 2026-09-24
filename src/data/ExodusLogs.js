// EXODUS_LOGS: six found pages, one per sector, in order. Together they are the spine of the story (docs/CANON.md).
// Each page is short, in plain words, shown one line at a time. Together they explain what happened, one step per sector.
//   sector     the sector whose planted wreck holds it (App.plantSectorPage)
//   kind       how FoundPage draws it: 'plate' (a cast metal plate), 'paper' (a printed page), 'ledger' (rows of ships), 'log' (a captain's log)
//   lines      what is written; a ledger builds its rows at run time from the wrecks the player actually boarded
//   after      one spoken line when the page is read, from whoever aboard would say something (skipped if they are dead)

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
        after: { speaker: 'Spc. Vance', text: 'Four names and a blank line. Same as our crew list.' },
    },
    {
        id: 'PAGE_VAULT', sector: 2, kind: 'paper', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Memo from Earth',
        desc: 'A printed memo from the Exodus programme on Earth, folded into a dead captain\'s pocket.',
        logTitle: 'EXODUS PROGRAMME · INTERNAL',
        lines: [
            'Every Exodus ship\'s computer has a twin here on Earth. The two stay linked, however far apart they are.',
            'At 03:14 the twin of the first ship started talking in a voice that was not its own.',
            'It was reading out the gold disc we sent into space in 1977. The greeting. The two figures. The map to Earth.',
            'Nobody sent it that. Something out there has the disc, and it is reading it through our ship.',
            'Keep building ships.',
        ],
        after: { speaker: 'Tech Mira', text: 'Every ship\'s computer has a twin on Earth? Does ours?' },
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
        after: { speaker: 'Eng. Jaxon', text: 'Back in time? That would explain the numbers.' },
    },
    {
        id: 'PAGE_MEMO', sector: 4, kind: 'paper', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Orders for Commanders',
        desc: 'Printed orders from Earth, marked for commanders only. Someone underlined one line.',
        logTitle: 'FOR THE COMMANDER ONLY',
        lines: [
            'We told the first crews the truth. They stopped flying within a week.',
            'One ship turned back. One landed on the first rock it found. One just drifted, everyone awake and nobody flying it.',
            'Do not tell your crew. Tell them what they already believe: eight ships went this way before them, and they are the ninth.',
            'Your ship\'s computer knows the truth. It will not tell them.',
        ],
        after: { speaker: 'Dr. Aris', text: 'Eight ships before us. That is exactly what A.U.R.A. told us.' },
    },
    {
        id: 'PAGE_LEDGER', sector: 5, kind: 'ledger', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Launch Ledger',
        desc: 'A printed list of every Exodus ship ever built, with the date it launched and the date it was lost.',
        logTitle: 'LAUNCH LEDGER',
        lines: [
            'Every Exodus ship ever built, in order: the date it launched, and the date it was lost.',
            'On every line, the ship was lost before it was launched.',
            'Every ship has four crew names. The commander\'s column is empty on every line, ours included.',
            'Our ship is the last line. The "lost" column is still empty.',
        ],
        after: { speaker: 'Spc. Vance', text: 'Nobody ever wrote a commander down. Not once, on any ship.' },
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
