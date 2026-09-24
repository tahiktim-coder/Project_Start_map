/**
 * ASTEROID FIELDS - Dense rock clusters for mining and exploration
 *
 * High salvage potential but risky navigation.
 * Some fields are rock. Some are what is left of a hull that came this way
 * before us, ground fine. Every plate we pull has a number higher than ours.
 */

const ASTEROID_FIELD_NAMES = [
    'Debris Cloud Alpha', 'The Shattered Belt', 'Gravel Drift',
    'Iron Wake', 'Stone Garden', 'The Rubble Patch',
    'Fractured Zone', 'Mineral Cluster 7', 'The Rock Field',
    'Slag Drift', 'Crystal Scatter', 'Dead Moon Remains'
];

const ASTEROID_FIELD_ENCOUNTERS = [
    // --- 1. RICH MINERAL DEPOSIT: worked metal, ground fine ---
    {
        id: 'ASTEROID_RICH',
        weight: 20,
        title: "RICH MINERAL DEPOSIT",
        context: (name) => `${name} is thick with worked metal. Not ore: plating, struts, frames, milled by rock over a long time. A hull came apart here. The field is stable enough to dig.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Good density. Nobody's chasing us. Call it the Quarry and let the kettle cool." },
            { speaker: 'Tech Mira', text: "And here we see refined alloy, Commander. Somebody's hull. Aura can't read the number." },
            { speaker: 'Spc. Vance', text: "Three plates so far. Three numbers. All higher than nine." }
        ],
        choices: [
            {
                text: "Dig it all out, slowly",
                desc: "-1 Ration: two days in the rock. +40-60 Salvage. Nobody gets hurt.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    const salvage = Math.floor(Math.random() * 21) + 40;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    state.addLog("Eng. Jaxon: \"Two days. Wake me when there's grass.\" He sleeps in the goat, between shifts.");
                    state.noteStanding && state.noteStanding('jaxon');
                    return `Two days in the Quarry. -1 Ration, +${salvage} Salvage.`;
                }
            },
            {
                text: "Quick dig and go",
                desc: "+20-30 Salvage. 20% chance someone gets hurt on the way out.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 11) + 20;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    if (Math.random() < 0.20) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`A strut swung on the way out. ${victim.name} INJURED.`);
                            return `Quick dig. +${salvage} Salvage. ${victim.name} hurt.`;
                        }
                    }
                    return `Quick dig, clean exit. +${salvage} Salvage.`;
                }
            },
            {
                text: "Scan for the good pockets only",
                desc: "-10 Energy on the scan. +25 Salvage. 30% chance: +1 Rare Item.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    if (Math.random() < 0.3 && typeof ITEMS !== 'undefined') {
                        const rareItems = [ITEMS.CONDENSED_SALVAGE, ITEMS.XENOTECH_COMPONENT].filter(i => i);
                        if (rareItems.length > 0) {
                            const item = rareItems[Math.floor(Math.random() * rareItems.length)];
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...item, acquiredAt: 'Asteroid Field' });
                            state.addLog(`Tech Mira: "And here we see the good pocket, Commander." ${item.name}, wrapped in somebody's hull.`);
                            return `Scan paid off. -10 Energy, +25 Salvage. Found: ${item.name}`;
                        }
                    }
                    return "Good pockets cut out. -10 Energy, +25 Salvage.";
                }
            }
        ]
    },

    // --- 2. UNSTABLE FIELD: a hull's wake ---
    {
        id: 'ASTEROID_UNSTABLE',
        weight: 15,
        title: "UNSTABLE DEBRIS FIELD",
        context: (name) => `${name} is still moving. Rocks grinding, breaking, drifting apart. A hull went through here at speed and never slowed. This is its wake. One wrong move and we join it.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Forty rocks big enough to kill us. I've counted. They're all still moving." },
            { speaker: 'Eng. Jaxon', text: "I can take the goat through. It won't be pretty." },
            { speaker: 'A.U.R.A.', text: "Collision risk is high, Commander. I can fly the probe ahead if you let me." }
        ],
        choices: [
            {
                text: "Go in and mine",
                desc: "+30 Salvage. 30% chance of a strike: -10-25 Energy, maybe a deck damaged.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    if (Math.random() < 0.30) {
                        const damage = Math.floor(Math.random() * 15) + 10;
                        state.energy = Math.max(0, state.energy - damage);
                        if (Math.random() < 0.20) {
                            const decks = ['bridge', 'lab', 'quarters', 'cargo', 'engineering'];
                            const deck = decks[Math.floor(Math.random() * decks.length)];
                            if (state.shipDecks[deck]?.status === 'OPERATIONAL') {
                                state.shipDecks[deck].status = 'DAMAGED';
                                state.addLog(`STRIKE. ${state.shipDecks[deck].label} damaged. -${damage} Energy.`);
                                return `Mined it. +30 Salvage. ${state.shipDecks[deck].label} DAMAGED, -${damage} Energy.`;
                            }
                        }
                        state.addLog(`Rock strike on the way out. -${damage} Energy for repairs.`);
                        return `Mined it. +30 Salvage. Struck on the way out: -${damage} Energy.`;
                    }
                    state.addLog("Eng. Jaxon: \"Told you. Not pretty.\" No strikes.");
                    return "Mined it. +30 Salvage. No strikes.";
                }
            },
            {
                text: "Wait for it to settle",
                desc: "-1 Ration: a day drifting at the edge. +20 Salvage. Nobody gets hurt.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.addLog("Spc. Vance counts the rocks down as they slow. Forty. Thirty-one. Twelve.");
                    return "Waited it out. -1 Ration, +20 Salvage.";
                }
            },
            {
                text: "Let A.U.R.A. fly the probe ahead",
                desc: "Requires probe. -20% Probe. +25 Salvage. Nobody gets hurt.",
                requires: (state) => state.probeIntegrity > 0,
                requiresLabel: "Requires Probe",
                effect: (state) => {
                    if (state.probeIntegrity <= 0) {
                        state.addLog("No probe. Nobody to send ahead.");
                        return "Probe unavailable. Mining aborted.";
                    }
                    state.probeIntegrity = Math.max(0, state.probeIntegrity - 20);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    state.addLog(`Tech Mira: "And here we see Aura threading a needle, Commander." Probe at ${state.probeIntegrity.toFixed(0)}%.`);
                    state.noteStanding && state.noteStanding('mira');
                    return "A.U.R.A. flew the probe through. Path held. +25 Salvage. Probe scuffed.";
                }
            }
        ]
    },

    // --- 3. WRECKAGE FIELD: a hull, in pieces ---
    {
        id: 'ASTEROID_WRECKAGE',
        weight: 15,
        title: "SHIP GRAVEYARD",
        context: (name) => `${name} is not rock. Hull plates, drive bells, crates, ground together. Every plate has a number. None of them is lower than ours. Three cryo bays are still cold.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "Names first. Vance, read me the plates." },
            { speaker: 'Spc. Vance', text: "Fourteen plates. Fourteen numbers. Every one of them higher than nine." },
            { speaker: 'Tech Mira', text: "And here we see three cryo bays, Commander. Still cold. Aura is sure." }
        ],
        choices: [
            {
                text: "Cut plating out",
                desc: "+35-50 Salvage. Aris +1 Stress: nothing gets read.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 16) + 35;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("Plates cut, numbers and all. Dr. Aris copies the numbers off the pile before they go in the bin.");
                    return `Plating stowed. +${salvage} Salvage. Aris +1 Stress.`;
                }
            },
            {
                text: "Read the plates and the recorders",
                desc: "-5 Energy. +2 Data. All crew +1 Stress. Vance writes the fourteen down.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const stories = [
                        "RECORDER: 'Eight went this way before us. We are the ninth.' Every recorder in the field says it.",
                        "RECORDER: 'The ship still says four of us. There are five. We stopped correcting it.'",
                        "RECORDER: 'We found a wreck with a higher number and older rust. We have stopped asking how.'",
                        "RECORDER: a heading, repeated. Ours. It ends at a light."
                    ];
                    state.addLog(stories[Math.floor(Math.random() * stories.length)]);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("Spc. Vance: \"Fourteen. Write them down. All of them.\"");
                    state.noteStanding && state.noteStanding('vance');
                    return "Fourteen numbers on the list. -5 Energy, +2 Data. All crew +1 Stress.";
                }
            },
            {
                text: "Check the cold pods",
                desc: "-5 Energy. 40% chance: pods hold, -2 Rations, +2 Sleepers. Else empty pods, +15 Salvage.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (Math.random() < 0.4) {
                        state.rations = Math.max(0, state.rations - 2);
                        state._sleepers = (state._sleepers || 0) + 2;
                        state.addLog("Two pods still cold. The name tags use a hull number five digits long. Dr. Aris writes both names on the lids.");
                        return "Two sleepers moved to our hold, still asleep. -5 Energy, -2 Rations, +2 Sleepers.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("The bays are cold because they are empty. Somebody carried these pods out before us.");
                    return "Pods empty. Bay stripped. -5 Energy, +15 Salvage.";
                }
            }
        ]
    },

    // --- 4. CRYSTAL CLUSTER ---
    {
        id: 'ASTEROID_CRYSTAL',
        weight: 12,
        title: "CRYSTAL FORMATION",
        context: (name) => `${name} glitters. Not ice: something harder, grown in long straight rods. The rods hold a charge. They ring when the hull gets close. Jaxon has already named it the Chandelier.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "And here we see the rods singing to each other. Aura says they're just resonating. Just." },
            { speaker: 'Dr. Aris', text: "Careful cutting. It rings when we touch it. It might do more than ring." },
            { speaker: 'A.U.R.A.', text: "Piezoelectric, Commander. High value. High volatility. I can tune it if you let me." }
        ],
        choices: [
            {
                text: "Cut it carefully",
                desc: "-1 Ration: a slow day. +20 Salvage, +15 Energy. Nobody gets hurt.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 15);
                    state.addLog("One rod at a time, a day of it. The kettle drinks the charge.");
                    return "Chandelier cut, slowly. -1 Ration, +20 Salvage, +15 Energy.";
                }
            },
            {
                text: "Blast it loose",
                desc: "+40 Salvage, +30 Energy. 25% chance it blows: -20 Energy, someone may get hurt.",
                effect: (state) => {
                    if (Math.random() < 0.25) {
                        state.energy = Math.max(0, state.energy - 20);
                        state.addLog("The rods let go all at once. Feedback through the kettle. -20 Energy.");
                        const crew = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (crew.length > 0 && Math.random() < 0.5) {
                            const victim = crew[Math.floor(Math.random() * crew.length)];
                            victim.status = 'INJURED';
                            state.addLog(`${victim.name} was on the outside when it went. INJURED.`);
                            return `It blew. ${victim.name} INJURED. -20 Energy.`;
                        }
                        return "It blew. -20 Energy. Nobody hurt.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                    state.energy = Math.min(100, state.energy + 30);
                    state.addLog("Blasted loose in one go. Eng. Jaxon: \"Chandelier's down.\"");
                    return "Full haul. +40 Salvage, +30 Energy.";
                }
            },
            {
                text: "Let A.U.R.A. tune it",
                desc: "-5 Energy. +2 Data, +10 Energy back. Mira -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    state.energy = Math.min(100, state.energy + 10);
                    state.addLog("A.U.R.A. tunes the rods until they hum in one note. Tech Mira: \"She likes this. Listen to her.\"");
                    state.noteStanding && state.noteStanding('mira');
                    return "Rods tuned and tapped. -5 Energy, +2 Data, +10 Energy. Mira -1 Stress.";
                }
            }
        ]
    },

    // --- 5. HOLLOW ASTEROID: a hull that dug in ---
    {
        id: 'ASTEROID_HOLLOW',
        weight: 10,
        title: "HOLLOW ASTEROID",
        context: (name) => `${name} is hollow. Cut, not eroded. A hull bored into the rock and lived inside it. The cut is neat. One airlock, welded from an Exodus hatch. Somebody meant to stay.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "They dug in and stopped. Call it the Den. I'd have done the same." },
            { speaker: 'Spc. Vance', text: "One airlock. I count one. Whatever's in there came in through that." },
            { speaker: 'A.U.R.A.', text: "There is power inside, Commander. Very little. A cryo circuit, I think." }
        ],
        choices: [
            {
                text: "Go in",
                desc: "-1 Ration: a day inside. 50% chance: +40 Salvage, +20 Energy. 30% chance: +1 Sleeper, -2 Rations. 20% chance: all crew +1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    const roll = Math.random();
                    if (roll < 0.5) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                        state.energy = Math.min(100, state.energy + 20);
                        state.addLog("Stores stacked to the ceiling. A kitchen. A bunk with a blanket. They stayed a long time.");
                        return "The Den, emptied. -1 Ration, +40 Salvage, +20 Energy.";
                    }
                    if (roll < 0.8) {
                        state.rations = Math.max(0, state.rations - 2);
                        state._sleepers = (state._sleepers || 0) + 1;
                        state.addLog("One pod at the back, still cold. The name on the lid is spelled a way we don't spell it any more.");
                        return "One sleeper carried to the hold, still asleep. -3 Rations in all, +1 Sleeper.";
                    }
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("Four bunks inside. Our bunks. Same lot numbers, same blankets. Never slept in.");
                    return "Nothing taken. Nobody wanted to touch it. -1 Ration. All crew +1 Stress.";
                }
            },
            {
                text: "Cut the outside only",
                desc: "+15 Salvage. The airlock stays shut.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("Surface metal only. Spc. Vance watches the airlock the whole time. It stays shut.");
                    return "Outside cut. +15 Salvage. Nobody went in.";
                }
            },
            {
                text: "Send the probe in",
                desc: "Requires probe. -30% Probe. 50% chance: +30 Salvage. Else +2 Data.",
                requires: (state) => state.probeIntegrity > 0,
                requiresLabel: "Requires Probe",
                effect: (state) => {
                    if (state.probeIntegrity <= 0) {
                        state.addLog("No probe. Nobody goes in blind.");
                        return "Probe unavailable. Exploration aborted.";
                    }
                    state.probeIntegrity = Math.max(0, state.probeIntegrity - 30);
                    if (Math.random() < 0.5) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                        state.addLog(`Probe found the stores and towed what it could. Probe at ${state.probeIntegrity.toFixed(0)}%.`);
                        return "Probe run complete. +30 Salvage. Probe scuffed.";
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog(`Probe feed: a ledger on the wall. Hull numbers, dates, and 'four' beside each. Probe at ${state.probeIntegrity.toFixed(0)}%.`);
                    return "Probe read the ledger on the wall. +2 Data. Probe scuffed.";
                }
            }
        ]
    },

    // --- 6. ICE FIELD ---
    {
        id: 'ASTEROID_ICE',
        weight: 15,
        title: "ICE ASTEROID FIELD",
        context: (name) => `${name} is frozen water and gas. Comets that never found a sun. Ice is water is fuel. The field is dense and the visibility is bad. Cut marks on the big ones: a hull was here first.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Ice is water is the kettle. Call this one the Teapot." },
            { speaker: 'Dr. Aris', text: "Careful. Frozen gas doesn't stay frozen when you cut it." },
            { speaker: 'Spc. Vance', text: "Somebody cut here before us. Twelve marks. Old ones." }
        ],
        choices: [
            {
                text: "Thermal cut, slowly",
                desc: "-1 Ration: a slow day. +25 Energy. Nobody gets hurt.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.energy = Math.min(100, state.energy + 25);
                    state.addLog("Ice melted and cracked into the kettle. Slow and warm.");
                    return "Thermal cut done. -1 Ration, +25 Energy.";
                }
            },
            {
                text: "Mass harvest",
                desc: "+40 Energy, +15 Salvage. 20% chance of a gas pocket: -15 Energy, someone gets hurt.",
                effect: (state) => {
                    if (Math.random() < 0.20) {
                        state.energy = Math.max(0, state.energy - 15);
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`Gas pocket. ${victim.name} was on the cutter. INJURED. -15 Energy venting it.`);
                            return `Gas pocket. ${victim.name} hurt. Harvest aborted. -15 Energy.`;
                        }
                        state.addLog("Gas pocket. Emergency venting. -15 Energy.");
                        return "Gas pocket. Harvest aborted. -15 Energy.";
                    }
                    state.energy = Math.min(100, state.energy + 40);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("Whole Teapot cut and stowed. Mineral cores in the ice.");
                    return "Full harvest. +40 Energy, +15 Salvage.";
                }
            },
            {
                text: "Dig for frozen cargo",
                desc: "-5 Energy. 40% chance: +5 Rations from a cache. Else +10 Energy from the ice.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (Math.random() < 0.4) {
                        state.rations = Math.min(state.maxRations, state.rations + 5);
                        state.addLog("A cache in the ice, sealed. Ration packs with a hull number on them. Not ours. Higher.");
                        return "Cache found. -5 Energy, +5 Rations.";
                    }
                    state.energy = Math.min(100, state.energy + 10);
                    state.addLog("No cache. Whoever cut here took theirs with them. Plain ice.");
                    return "No cache. Plain ice. -5 Energy, +10 Energy.";
                }
            }
        ]
    }
];

/**
 * Generate an asteroid field node for the sector map
 */
function generateAsteroidField(level) {
    const name = ASTEROID_FIELD_NAMES[Math.floor(Math.random() * ASTEROID_FIELD_NAMES.length)];

    return {
        id: 'asteroid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name: name,
        type: 'ASTEROID_FIELD',
        isAsteroidField: true,
        desc: 'Dense debris field. Mining potential confirmed. Navigation hazards present.',
        fuelCost: 3 + Math.floor(Math.random() * 3), // 3-5 energy (cheaper than planets)
        scanned: false,
        remoteScanned: false,
        tags: ['ASTEROID_FIELD'],
        dangerLevel: 1 + Math.floor(level / 2),
        resources: {
            metals: 40 + Math.floor(Math.random() * 40), // 40-80 (higher than average)
            energy: 10 + Math.floor(Math.random() * 20)  // 10-30
        },
        metrics: {
            hasLife: false,
            hasTech: Math.random() < 0.2, // 20% chance of tech signatures
            gravity: 0,
            temp: 0
        },
        atmosphere: 'NONE',
        mapData: {
            x: 15 + Math.random() * 70,
            y: 15 + Math.random() * 70
        }
    };
}

// Export
if (typeof window !== 'undefined') {
    window.ASTEROID_FIELD_ENCOUNTERS = ASTEROID_FIELD_ENCOUNTERS;
    window.ASTEROID_FIELD_NAMES = ASTEROID_FIELD_NAMES;
    window.generateAsteroidField = generateAsteroidField;
}
