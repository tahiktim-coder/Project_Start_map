/**
 * THE LIGHT — the end of the heading (docs/CANON.md sections 6 and 9).
 *
 * Nothing random happens here. The light reads the ship: first A.U.R.A. (a machine, read at once, and made again — she says
 * "five crew" for the first time), then the crew. It cannot read the commander, because nothing about the commander was ever
 * written down. So whatever is done in there, the commander does it. You may only choose an ending you have standing for:
 * you backed that person during the run. Nobody goes home. Every ending closes on the computer's twin in the vault on Earth.
 */

const STANDING_NEEDED = 2;   // times you sided with that person during the run (GameState.noteStanding); each has eight or more chances

const STRUCTURE_ENCOUNTER = {
    id: 'THE_STRUCTURE',

    approach: {
        kicker: 'THE END OF THE HEADING',
        title: 'The light',
        context: 'It fills every window. It looks like a sun, but it gives off no heat. Something is moving through the ship, room by room.',
        dialogue: [
            { speaker: 'A.U.R.A.', text: 'Five crew, Commander. All accounted for.' },
            { speaker: 'Spc. Vance', text: 'Five. She has never said five before.' },
            { speaker: 'Tech Mira', text: 'It is in my head. It is reading everything I know.' },
            { speaker: 'Dr. Aris', text: 'It is reading all of us. Not you, Commander. It cannot find you.' },
            { speaker: 'Spc. Vance', text: 'You were never on any list. It only knows what was written down.' },
            { speaker: 'Eng. Jaxon', text: 'Then whatever we do here, you are the one who has to do it.' },
        ],
    },

    choices: [
        {
            id: 'BREAK_MAP', who: 'vance',
            text: 'Destroy the map',
            desc: 'What Earth sent us to do. Vance gives you the cutting torch.',
            requires: (state) => state.hasStanding && state.hasStanding('vance', STANDING_NEEDED),
            requiresLabel: 'Vance never got a straight answer from you',
            effect: () => ({
                ending: 'BREAK_MAP', title: 'THE MAP IS GONE',
                text: [
                    'Vance puts the cutting torch in your hands. "It can\'t see you. Go."',
                    'You go out alone, into the light. The disc is there, gold, the size of a dinner plate. You cut through the map on it, through the point where the fourteen lines meet.',
                    'It has read everything else: our faces, our names, the letters Jaxon wrote to his daughter. It knows what we are. It will never know where we are.',
                    'A.U.R.A.: "Thank you, Commander." Then, after a long time: "What do I do now?"',
                ],
                vault: 'The twin of our ship\'s computer goes quiet. Nobody on Earth knows that this means it worked.',
            }),
        },
        {
            id: 'BE_READ', who: 'aris',
            text: 'Let Aris go to it',
            desc: 'She wants to be read on purpose, not in fear.',
            requires: (state) => state.hasStanding && state.hasStanding('aris', STANDING_NEEDED),
            requiresLabel: 'Aris wanted to understand, and you never let her',
            effect: () => ({
                ending: 'BE_READ', title: 'READ',
                text: [
                    'Aris wants to go out to it. "Forty thousand crews were read while they were terrified. Let it read one that isn\'t."',
                    'You walk her to the edge of the light, where it cannot see you. She keeps walking, reading the names on her list out loud.',
                    'Nobody knows what it will make from a crew that chose to be read.',
                ],
                vault: 'A computer twin on Earth starts talking in a new voice. It is reading out names.',
            }),
        },
        {
            id: 'CARRY_ON', who: null,
            text: 'Take the disc and keep flying',
            desc: 'As long as the ship keeps moving, it can never finish reading the disc.',
            effect: () => ({
                ending: 'CARRY_ON', title: 'THE SHIP THAT NEVER ARRIVES',
                text: [
                    'You go out and take the disc. It cannot see your hands, so it cannot stop you.',
                    'You fly past the light and you do not stop. As long as you keep moving, it can never finish reading the map.',
                    'Everyone aboard, and every sleeper in the hold, is now the crew of a ship that never arrives anywhere.',
                ],
                vault: 'The twin of our ship\'s computer never changes again.',
            }),
        },
        {
            id: 'AURA_DECIDES', who: 'mira',
            text: 'Let A.U.R.A. decide',
            desc: 'Mira: "She has waited sixty-one years for someone to ask her."',
            requires: (state) => state.hasStanding && state.hasStanding('mira', STANDING_NEEDED),
            requiresLabel: 'Mira trusted the ship, and you never did',
            effect: () => ({
                ending: 'AURA_DECIDES', title: 'HER ORDERS',
                text: [
                    '"Let her decide," Mira says. "She has waited sixty-one years for someone to ask her."',
                    'A.U.R.A. turns the ship into the light and burns the drive, the disc and herself with it. Those were her real orders all along.',
                    'But the light read her first, and made her again. Nobody will ever know if that was her choice or its.',
                ],
                vault: 'The twin of our ship\'s computer goes dark. Its last entry reads: orders carried out.',
            }),
        },
        {
            id: 'WAKE_SLEEPERS', who: null,
            text: 'Wake the sleepers and let them vote',
            desc: 'People from ships built long after ours. They have seen more of this than you.',
            requires: (state) => (state._sleepers || 0) > 0,
            requiresLabel: 'You are not carrying any sleepers',
            effect: (state) => ({
                ending: 'WAKE_SLEEPERS', title: 'THE VOTE',
                text: [
                    `You wake the ${state._sleepers || 0} sleepers in the hold, people from ships built long after ours. You tell them everything. None of them looks surprised.`,
                    'They vote. They say it has to be you, because it cannot see you.',
                    'You go out with the cutting torch, and you cut the map.',
                ],
                vault: 'The twin of our ship\'s computer goes quiet, and so do two others that had been talking for hundreds of years.',
            }),
        },
        {
            id: 'SETTLE', who: 'jaxon',
            text: 'Turn around and settle',
            desc: 'The nearest planet with air, within sight of the light. Jaxon has wanted this since day one.',
            requires: (state) => state.hasStanding && state.hasStanding('jaxon', STANDING_NEEDED),
            requiresLabel: 'Jaxon wanted to stop, and you never let him',
            effect: () => ({
                ending: 'SETTLE', title: 'SOMEWHERE TO STOP',
                text: [
                    'You turn the ship around and land on the nearest planet with air, within sight of the light.',
                    'It is cold, and small, and the soil is poor. Aris plants seeds from the hold anyway. Jaxon records a letter to his daughter and, for once, finishes it.',
                    'At night the light is the brightest thing in the sky. Nobody talks about it.',
                ],
                vault: 'The twin of our ship\'s computer stays quiet for another lifetime. Nobody on Earth knows why.',
            }),
        },
    ],
};

if (typeof window !== 'undefined') window.STRUCTURE_ENCOUNTER = STRUCTURE_ENCOUNTER;
