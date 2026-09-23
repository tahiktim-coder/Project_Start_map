// EXODUS_LOGS: six found pages, one per sector, in order. Together they are the spine of the story (docs/CANON.md).
// Each page is short: a few lines, shown one at a time. Nobody explains anything; the pages contradict the briefing on their own.
//   sector     the sector whose planted wreck holds it (App.plantSectorPage)
//   kind       how FoundPage draws it: 'plate' (a cast metal plate), 'paper' (a printed page), 'ledger' (rows of hulls), 'log' (a captain's log)
//   lines      what is written; a ledger builds its rows at run time from the wrecks the player actually boarded
//   after      one spoken line when the page is closed, from the person who would say it

const EXODUS_LOGS = [
    {
        id: 'PAGE_PLATE', sector: 1, kind: 'plate', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Crew Plate',
        desc: 'A cast plate from beside the airlock of a dead ship. Four names. A fifth panel, blank.',
        logTitle: 'THE PLATE',
        lines: [
            'A plate from beside the airlock. Four names, raised in the metal.',
            'A fifth panel, the same size, blank. Not cut out. Cast blank.',
            'Somebody made a mould with five spaces, and filled in four.',
        ],
        names: ['R. OSEI · ENG', 'T. YUEN · MED', 'K. ADEYEMI · SEC', 'L. PARK · SPC', ''],
        after: { speaker: 'Spc. Vance', text: 'Four. Same as ours.' },
    },
    {
        id: 'PAGE_VAULT', sector: 2, kind: 'paper', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Vault Memo',
        desc: 'A printed page from Earth, folded into a dead captain\'s pocket. Programme letterhead.',
        logTitle: 'VAULT · INTERNAL',
        lines: [
            'Twin 0001 began speaking at 03:14. Not in its own voice.',
            'It is reciting the greeting. Then the two figures. Then the fourteen lines.',
            'Nothing was sent to it. Nothing can be. It is repeating what its other half is hearing.',
            'Lay the next keel.',
        ],
        after: { speaker: 'Tech Mira', text: 'Twin of what?' },
    },
    {
        id: 'PAGE_THROW', sector: 3, kind: 'log', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Captain\'s Log (thrown less far back)',
        desc: 'The last entry in a captain\'s log. The hull number is higher than ours. The rust is older.',
        logTitle: 'LAST ENTRY',
        lines: [
            'Found a wreck today with our patch on it. Higher number than ours. Older rust.',
            'I asked the ship how a hull built after us could have died before we were born.',
            'It said: you were not thrown further away than they were, Captain. You were thrown less far back.',
        ],
        after: { speaker: 'Eng. Jaxon', text: 'Less far back. Back where?' },
    },
    {
        id: 'PAGE_MEMO', sector: 4, kind: 'paper', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Programme Memo',
        desc: 'A page from a briefing folder, marked for commanders only. Someone underlined one line.',
        logTitle: 'FOR THE COMMANDER ONLY',
        lines: [
            'We told the crew of hull 212 the truth. They stopped flying within the week.',
            'Hull 340 turned round. Hull 388 settled the first rock it found. Hull 415 drifted with everyone awake and nobody at the helm.',
            'Tell yours the small story. Eight went before you. You are the ninth on this heading.',
            'Your ship already knows. It will not tell them. It cannot.',
        ],
        after: { speaker: 'Dr. Aris', text: 'Eight went before you. Word for word.' },
    },
    {
        id: 'PAGE_LEDGER', sector: 5, kind: 'ledger', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Launch Ledger',
        desc: 'Columns of hull numbers. Every row has a launch date and a failure date. The failure comes first.',
        logTitle: 'LAUNCH LEDGER',
        lines: [
            'Every hull ever laid, in order. Launched. Failed. Four names and a dash for the commander, every row.',
            'The failure date is earlier than the launch date. On every row.',
            'The last row is ours. The failure column is empty.',
        ],
        after: { speaker: 'Spc. Vance', text: 'I counted the keels. Nobody believed me.' },
    },
    {
        id: 'PAGE_LIGHT', sector: 6, kind: 'log', type: 'EXODUS_LOG', value: 0, isKept: true,
        name: 'Captain\'s Log (the light)',
        desc: 'A log from a hull four centuries dead, a day\'s flight from the light.',
        logTitle: 'LAST ENTRY',
        lines: [
            'It looks like a sun. It is not warm.',
            'The crew are going out to it one at a time. I have counted four leaving. I am still here.',
            'It has not read me yet. I think it cannot find me.',
            'If you are reading this, you are the ninth, and you are the last. Fly to it. Then decide.',
        ],
        after: { speaker: 'A.U.R.A.', text: 'Four crew, Commander. All accounted for.' },
    },
];

if (typeof window !== 'undefined') window.EXODUS_LOGS = EXODUS_LOGS;
