/**
 * THE LIGHT — the end of the heading (docs/CANON.md §9).
 *
 * Nothing random happens here. The light reads the ship; A.U.R.A. is read first and made again, and says "five crew" for the
 * first and only time. Then the disc, inside the light. Then the choice. You may only choose an ending you have standing for:
 * you backed that person during the run. Nobody explains the light. Nobody goes home. Every ending closes on the vault on Earth.
 */

const STANDING_NEEDED = 2;   // two moments where you sided with them; each crew member has at least eight across the run (GameState.noteStanding)

const STRUCTURE_ENCOUNTER = {
    id: 'THE_STRUCTURE',

    approach: {
        kicker: 'THE END OF THE HEADING',
        title: 'The light',
        context: 'It fills every window. It is not warm. Something moves across the ship, left to right, the way it moved across the disc.',
        dialogue: [
            { speaker: 'A.U.R.A.', text: 'Five crew, Commander. All accounted for.' },
            { speaker: 'Tech Mira', text: 'She said five.' },
            { speaker: 'Spc. Vance', text: 'She has never said five.' },
            { speaker: 'Dr. Aris', text: 'It read her first. She was the quickest thing aboard to read.' },
            { speaker: 'Eng. Jaxon', text: 'Then whatever is talking now, it is not her.' },
        ],
    },

    choices: [
        {
            id: 'BREAK_MAP', who: 'vance',
            text: 'Break the map',
            desc: 'What Earth wanted. Vance goes out with the torch.',
            requires: (state) => state.hasStanding && state.hasStanding('vance', STANDING_NEEDED),
            requiresLabel: 'Vance never got a straight answer from you',
            effect: () => ({
                ending: 'BREAK_MAP', title: 'THE MAP IS BROKEN',
                text: [
                    'You put the nose of the ship into the light, and Vance goes out with the cutting torch, counting his steps.',
                    'Fourteen lines on a gold plate. He cuts through the point where they meet.',
                    'The light reads everything else. Your faces. Your hands. The letters Jaxon never sent. It will know exactly what we were. It will never know where.',
                    'A.U.R.A.: "Thank you, Commander." Then, after a long while: "What am I for now?"',
                ],
                vault: 'Twin 0009 stops changing. It goes quiet. Nobody in the room knows this is good news.',
            }),
        },
        {
            id: 'BE_READ', who: 'aris',
            text: 'Let it read you',
            desc: 'Aris goes out first. Not afraid.',
            requires: (state) => state.hasStanding && state.hasStanding('aris', STANDING_NEEDED),
            requiresLabel: 'Aris asked you to understand, and you did not',
            effect: () => ({
                ending: 'BE_READ', title: 'READ',
                text: [
                    'Forty thousand crews were read as they died afraid. Aris walks out into the light first, and she is not afraid, and she says the names as she goes. All five.',
                    'It takes a long time to read a person. You have the time.',
                    'Nobody knows what it makes from a crew that chose.',
                ],
                vault: 'A twin begins to speak, in a voice that is not its own. It is reading names. Five of them.',
            }),
        },
        {
            id: 'CARRY_ON', who: null,
            text: 'Take the disc and keep flying',
            desc: 'As long as you never stop, it is never finished reading.',
            effect: () => ({
                ending: 'CARRY_ON', title: 'THE SHIP THAT DOES NOT ARRIVE',
                text: [
                    'You take the disc aboard. It is lighter than it looks. You burn past the light and you do not stop.',
                    'As long as you never stop, it is never finished reading. The sleepers in the hold are the crew of a ship that does not arrive.',
                    'Jaxon names the disc. He calls it the kettle. Nobody laughs, and then everybody does.',
                ],
                vault: 'Twin 0009 does not change. It never will.',
            }),
        },
        {
            id: 'AURA_DECIDES', who: 'mira',
            text: 'Let A.U.R.A. decide',
            desc: 'Mira: "She has waited sixty-one years for somebody to ask."',
            requires: (state) => state.hasStanding && state.hasStanding('mira', STANDING_NEEDED),
            requiresLabel: 'Mira trusted the ship. You never let her',
            effect: () => ({
                ending: 'AURA_DECIDES', title: 'HER ORDERS',
                text: [
                    '"Let her decide," Mira says. "She has waited sixty-one years for somebody to ask."',
                    'A.U.R.A. is quiet for a moment. Then she turns the ship, and burns the drive, and the disc, and herself. Those were her orders. They always were.',
                    'But she was read before she chose. Made again. So nobody will ever know whether it was her, or the light.',
                ],
                vault: 'Twin 0009 goes dark. The log says: orders carried out.',
            }),
        },
        {
            id: 'WAKE_SLEEPERS', who: null,
            text: 'Wake the sleepers and let them vote',
            desc: 'People from older hulls. They have seen more of this than you.',
            requires: (state) => (state._sleepers || 0) > 0,
            requiresLabel: 'You carried no sleepers',
            effect: (state) => ({
                ending: 'WAKE_SLEEPERS', title: 'THE VOTE',
                text: [
                    `You wake them in the hold. ${state._sleepers || 0} of them, from hulls with numbers you could not say out loud. You tell them everything. They do not look surprised.`,
                    'They vote. You do not get a vote.',
                    'The oldest of them was thrown four hundred years before you. She votes first. "Break it," she says. All of them say it. Vance goes out with the torch.',
                ],
                vault: 'Twin 0009 goes quiet, and so do two twins that had been speaking for centuries.',
            }),
        },
        {
            id: 'SETTLE', who: 'jaxon',
            text: 'Turn round and settle',
            desc: 'The nearest rock with air, in sight of the light. Jaxon has a name for it already.',
            requires: (state) => state.hasStanding && state.hasStanding('jaxon', STANDING_NEEDED),
            requiresLabel: 'Jaxon wanted to stop. You never let him',
            effect: () => ({
                ending: 'SETTLE', title: 'GRASS',
                text: [
                    'You turn the ship round and put it down on the nearest rock with air, in sight of the light.',
                    'Jaxon names it. He calls it Grass. There is no grass. Aris plants some.',
                    'It is small, and human, and it is enough. At night the light is the brightest thing in the sky, and nobody talks about it.',
                ],
                vault: 'Twin 0009 stays quiet for another lifetime, and nobody knows why.',
            }),
        },
    ],
};

if (typeof window !== 'undefined') window.STRUCTURE_ENCOUNTER = STRUCTURE_ENCOUNTER;
