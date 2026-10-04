/**
 * ASTEROID FIELDS - Dense rock clusters for mining and exploration
 *
 * High salvage potential but risky navigation.
 * Some fields are plain rock. Some are what is left of a ship that came this way
 * before us. Fields appear from sector 1, so nothing here gives away hull numbers.
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
        context: (name) => `${name} is full of worked metal, not ore: hull plates and frame beams, ground down by the rocks around them. A ship broke up here a long time ago. The field is calm enough to dig in.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Good density, and nobody's rushing us. We can take our time here for once." },
            { speaker: 'Tech Mira', text: "That's refined alloy, Commander. It came off a ship's hull." },
            { speaker: 'Spc. Vance', text: "Whose ship? I want a hull number before we cut into it." }
        ],
        choices: [
            {
                text: "Dig it all out, slowly",
                desc: "-1 Ration: two days of digging. +40-60 Salvage. Nobody gets hurt.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    const salvage = Math.floor(Math.random() * 21) + 40;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    state.addLog(jaxon
                        ? "Two quiet days of digging. Eng. Jaxon: \"No alarms, no rush. I could get used to this.\""
                        : "Two quiet days of digging, with no alarms and no rush.");
                    state.noteStanding && state.noteStanding('jaxon');
                    return `Two days of digging. -1 Ration, +${salvage} Salvage.`;
                }
            },
            {
                text: "Dig quickly, then leave",
                desc: "+20-30 Salvage. 20% chance someone gets hurt on the way out.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 11) + 20;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    if (Math.random() < 0.20) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`A loose beam swung into ${victim.name} on the way out. Injured.`);
                            return `Quick dig. +${salvage} Salvage. ${victim.name} hurt.`;
                        }
                    }
                    return `Quick dig, and out without trouble. +${salvage} Salvage.`;
                }
            },
            {
                text: "Scan for the best spots only",
                desc: "-10 Energy for the scan. +25 Salvage. 30% chance: +1 Rare Item.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    if (Math.random() < 0.3 && typeof ITEMS !== 'undefined') {
                        const rareItems = [ITEMS.CONDENSED_SALVAGE, ITEMS.XENOTECH_COMPONENT].filter(i => i);
                        if (rareItems.length > 0) {
                            const item = rareItems[Math.floor(Math.random() * rareItems.length)];
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...item, acquiredAt: 'Asteroid Field' });
                            state.addLog(`The scan finds a ${item.name} wedged inside a piece of old hull.`);
                            return `The scan paid off. -10 Energy, +25 Salvage. Found: ${item.name}`;
                        }
                    }
                    return "Cut out the best spots. -10 Energy, +25 Salvage.";
                }
            }
        ]
    },

    // --- 2. UNSTABLE FIELD: a ship's wake ---
    {
        id: 'ASTEROID_UNSTABLE',
        weight: 15,
        title: "UNSTABLE DEBRIS FIELD",
        context: (name) => `The rocks in ${name} are still moving, grinding into each other and breaking apart. Something large smashed through here at speed, and the field hasn't settled since. One mistake and we get hit.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "There are about forty rocks in there big enough to punch through our hull." },
            { speaker: 'Eng. Jaxon', text: "I can fly the lander through. It won't be a smooth ride." },
            { speaker: 'A.U.R.A.', text: "The risk of collision is high, Commander. I can fly the probe ahead and map a safe path." }
        ],
        choices: [
            {
                text: "Go in and mine",
                desc: "+30 Salvage. 30% chance of a rock strike: -10-24 Energy, and maybe a deck damaged.",
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
                                state.addLog(`A rock hit us. ${state.shipDecks[deck].label} damaged. -${damage} Energy.`);
                                return `Mined it. +30 Salvage. ${state.shipDecks[deck].label} damaged, -${damage} Energy.`;
                            }
                        }
                        state.addLog(`A rock hit us on the way out. -${damage} Energy for repairs.`);
                        return `Mined it. +30 Salvage. Hit on the way out: -${damage} Energy.`;
                    }
                    state.addLog("We got in and out without a single hit.");
                    return "Mined it. +30 Salvage. No hits.";
                }
            },
            {
                text: "Wait for the rocks to settle",
                desc: "-1 Ration: a day waiting at the edge. +20 Salvage. Nobody gets hurt.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.addLog("We wait a day at the edge while the rocks slow down, then mine the part that has gone still.");
                    return "Waited it out. -1 Ration, +20 Salvage.";
                }
            },
            {
                text: "Let A.U.R.A. fly the probe ahead",
                desc: "Needs the probe. -20% Probe. +25 Salvage. Nobody gets hurt.",
                requires: (state) => state.probeIntegrity > 0,
                requiresLabel: "Requires Probe",
                effect: (state) => {
                    if (state.probeIntegrity <= 0) {
                        state.addLog("We have no probe to send ahead.");
                        return "No probe, so we didn't go in.";
                    }
                    state.probeIntegrity = Math.max(0, state.probeIntegrity - 20);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    state.addLog(`A.U.R.A. flies the probe through the gaps, and we follow its path. Probe at ${state.probeIntegrity.toFixed(0)}%.`);
                    state.noteStanding && state.noteStanding('mira');
                    return "A.U.R.A. flew the probe ahead and we followed it safely. +25 Salvage. Probe scraped.";
                }
            }
        ]
    },

    // --- 3. WRECKAGE FIELD: ships, in pieces ---
    {
        id: 'ASTEROID_WRECKAGE',
        weight: 15,
        title: "WRECKED SHIPS",
        context: (name) => `${name} isn't rock. It's wrecked ships: hull plates, engines and cargo crates, all crushed together. Somewhere in the pile, three sleep pods still have power.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "Before anyone cuts anything, I want the names of whoever was aboard." },
            { speaker: 'Spc. Vance', text: "Some of these plates still have hull numbers. I want every one of them recorded." },
            { speaker: 'Tech Mira', text: "Three pods still have power, Commander. A.U.R.A. is sure of it." }
        ],
        choices: [
            {
                text: "Cut out the hull plates",
                desc: "+35-50 Salvage. Aris +1 Stress: nothing gets recorded first.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 16) + 35;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("We cut the plates, numbers and all. Nobody writes down what was on them.");
                    return `Plates cut and stored. +${salvage} Salvage. Aris +1 Stress.`;
                }
            },
            {
                text: "Read the plates and flight recorders",
                desc: "-5 Energy. +2 Data. All crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const stories = [
                        "RECORDER: 'The drive failed on the last jump. We can't move. Whoever finds this, take what you need.'",
                        "RECORDER: 'Fuel's gone. We're going into the pods. Please come and get us.'",
                        "RECORDER: a crew member reads out the ship's heading, once a day, for months. It is the same heading as ours.",
                        "RECORDER: 'We hit something in the dark. Half the hull is open. We're heading for the nearest rock.'"
                    ];
                    state.addLog(stories[Math.floor(Math.random() * stories.length)]);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("Every hull number we can read goes into our log.");
                    state.noteStanding && state.noteStanding('vance');
                    return "Hull numbers and recorders logged. -5 Energy, +2 Data. All crew +1 Stress.";
                }
            },
            {
                text: "Check the powered pods",
                desc: "-5 Energy. 40% chance: two sleepers still alive, +2 Sleepers, -2 Rations to keep them. Otherwise the pods are empty: +15 Salvage.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (Math.random() < 0.4) {
                        state.rations = Math.max(0, state.rations - 2);
                        state._sleepers = (state._sleepers || 0) + 2;
                        state.addLog("Two pods are still running, with people asleep inside. We carry them to our hold and write their names on the lids.");
                        return "Two sleepers moved to our hold, still asleep. -5 Energy, -2 Rations, +2 Sleepers.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("The pods have power, but they're empty. Someone took the sleepers out before us.");
                    return "The pods were empty, so we stripped them. -5 Energy, +15 Salvage.";
                }
            }
        ]
    },

    // --- 4. CRYSTAL CLUSTER ---
    {
        id: 'ASTEROID_CRYSTAL',
        weight: 12,
        title: "CRYSTAL FORMATION",
        context: (name) => `${name} glitters with crystal, grown in long straight rods. The rods hold an electric charge, and they ring like bells when our hull gets close.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "The rods are ringing at each other. A.U.R.A. says it's just vibration from our engines." },
            { speaker: 'Dr. Aris', text: "Cut carefully. If they ring when we get close, they might do worse when we touch them." },
            { speaker: 'A.U.R.A.', text: "They build up charge when they vibrate, Commander. Valuable, but unstable. I can tune them safely." }
        ],
        choices: [
            {
                text: "Cut the rods carefully",
                desc: "-1 Ration: a slow day. +20 Salvage, +15 Energy. Nobody gets hurt.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 15);
                    state.addLog("We cut one rod at a time, for a whole day. The reactor takes their charge.");
                    return "Crystal cut slowly. -1 Ration, +20 Salvage, +15 Energy.";
                }
            },
            {
                text: "Blast them loose",
                desc: "75% chance: +40 Salvage, +30 Energy. 25% chance they discharge at once: -20 Energy, and someone may get hurt.",
                effect: (state) => {
                    if (Math.random() < 0.25) {
                        state.energy = Math.max(0, state.energy - 20);
                        state.addLog("The rods discharge all at once, and the surge runs back into the reactor. -20 Energy.");
                        const crew = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (crew.length > 0 && Math.random() < 0.5) {
                            const victim = crew[Math.floor(Math.random() * crew.length)];
                            victim.status = 'INJURED';
                            state.addLog(`${victim.name} was outside when it went off. Injured.`);
                            return `The rods discharged. ${victim.name} injured. -20 Energy.`;
                        }
                        return "The rods discharged. -20 Energy. Nobody hurt.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                    state.energy = Math.min(100, state.energy + 30);
                    state.addLog("The whole cluster came loose in one blast.");
                    return "Full haul. +40 Salvage, +30 Energy.";
                }
            },
            {
                text: "Let A.U.R.A. tune them",
                desc: "-5 Energy, then +10 Energy back. +2 Data. Mira -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    state.energy = Math.min(100, state.energy + 10);
                    state.addLog("A.U.R.A. tunes the rods until they all hum on one note, then draws the charge off safely.");
                    if (mira) state.addLog("Tech Mira: \"Listen to that. I told you she'd know how.\"");
                    state.noteStanding && state.noteStanding('mira');
                    return "Rods tuned and drained. -5 Energy, +2 Data, +10 Energy. Mira -1 Stress.";
                }
            }
        ]
    },

    // --- 5. HOLLOW ASTEROID: a crew that dug in ---
    {
        id: 'ASTEROID_HOLLOW',
        weight: 10,
        title: "HOLLOW ASTEROID",
        context: (name) => `${name} is hollow. Someone cut a home inside the rock and sealed it with an airlock taken from an Exodus ship. Whoever did this meant to stay.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "They found a rock and stopped. Honestly, I'd have done the same." },
            { speaker: 'Spc. Vance', text: "One airlock, one way in. Whatever's inside went through that door." },
            { speaker: 'A.U.R.A.', text: "There is a little power inside, Commander. It's most likely a sleep pod." }
        ],
        choices: [
            {
                text: "Go inside",
                desc: "-1 Ration: a day inside. 50% chance: +40 Salvage, +20 Energy. 30% chance: a sleeper, +1 Sleeper, -2 Rations more. 20% chance: nothing we want, all crew +1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    const roll = Math.random();
                    if (roll < 0.5) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                        state.energy = Math.min(100, state.energy + 20);
                        state.addLog("Supplies stacked to the ceiling, a kitchen, a bunk with a blanket on it. They lived here a long time.");
                        return "Emptied the home in the rock. -1 Ration, +40 Salvage, +20 Energy.";
                    }
                    if (roll < 0.8) {
                        state.rations = Math.max(0, state.rations - 2);
                        state._sleepers = (state._sleepers || 0) + 1;
                        state.addLog("One pod at the back is still running. The name on the lid uses an old-fashioned spelling.");
                        return "One sleeper carried to our hold, still asleep. -3 Rations in all, +1 Sleeper.";
                    }
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("Inside are four bunks exactly like ours, with the same blankets. Nobody ever slept in them.");
                    return "Nobody wanted to touch anything. -1 Ration. All crew +1 Stress.";
                }
            },
            {
                text: "Strip the outside only",
                desc: "+15 Salvage. Nobody opens the airlock.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("We strip the outer metal only. The airlock stays shut the whole time.");
                    return "Stripped the outside. +15 Salvage. Nobody went in.";
                }
            },
            {
                text: "Send the probe inside",
                desc: "Needs the probe. -30% Probe. 50% chance: +30 Salvage. 50% chance: +2 Data.",
                requires: (state) => state.probeIntegrity > 0,
                requiresLabel: "Requires Probe",
                effect: (state) => {
                    if (state.probeIntegrity <= 0) {
                        state.addLog("We have no probe, and nobody goes in blind.");
                        return "No probe, so nobody went in.";
                    }
                    state.probeIntegrity = Math.max(0, state.probeIntegrity - 30);
                    if (Math.random() < 0.5) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                        state.addLog(`The probe found their supplies and towed out what it could. Probe at ${state.probeIntegrity.toFixed(0)}%.`);
                        return "The probe towed out supplies. +30 Salvage. Probe scraped.";
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog(`The probe's camera finds a list scratched on the wall: hull numbers and dates, with a 4 beside each. Probe at ${state.probeIntegrity.toFixed(0)}%.`);
                    return "The probe read a list on the wall. +2 Data. Probe scraped.";
                }
            }
        ]
    },

    // --- 6. ICE FIELD ---
    {
        id: 'ASTEROID_ICE',
        weight: 15,
        title: "ICE ASTEROID FIELD",
        context: (name) => `${name} is made of ice: frozen water and gas. Melted down, the ice becomes fuel for our reactor. The field is dense and hard to see through, and some big chunks already have cut marks on them.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Water ice. That's reactor fuel, as much as we can carry." },
            { speaker: 'Dr. Aris', text: "Be careful. Frozen gas doesn't stay frozen once you start cutting into it." },
            { speaker: 'Spc. Vance', text: "Someone cut here before us. These marks are old." }
        ],
        choices: [
            {
                text: "Melt it out slowly",
                desc: "-1 Ration: a slow day. +25 Energy. Nobody gets hurt.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.energy = Math.min(100, state.energy + 25);
                    state.addLog("We melt the ice slowly and feed it into the reactor.");
                    return "Melted ice for fuel. -1 Ration, +25 Energy.";
                }
            },
            {
                text: "Cut as much as we can",
                desc: "80% chance: +40 Energy, +15 Salvage. 20% chance of a gas pocket: -15 Energy, and someone may get hurt.",
                effect: (state) => {
                    if (Math.random() < 0.20) {
                        state.energy = Math.max(0, state.energy - 15);
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`A gas pocket burst. ${victim.name} was on the cutter and got hurt. -15 Energy to vent it.`);
                            return `Gas pocket. ${victim.name} hurt. We stopped cutting. -15 Energy.`;
                        }
                        state.addLog("A gas pocket burst, and we had to vent it fast. -15 Energy.");
                        return "Gas pocket. We stopped cutting. -15 Energy.";
                    }
                    state.energy = Math.min(100, state.energy + 40);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("We cut the whole chunk and stored it. There was metal frozen inside the ice, too.");
                    return "Full harvest. +40 Energy, +15 Salvage.";
                }
            },
            {
                text: "Dig for a frozen supply cache",
                desc: "-5 Energy. 40% chance: a cache, +5 Rations. Otherwise plain ice: +10 Energy.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (Math.random() < 0.4) {
                        state.rations = Math.min(state.maxRations, state.rations + 5);
                        state.addLog("A sealed cache in the ice, full of ration packs from another Exodus ship.");
                        return "Found a cache. -5 Energy, +5 Rations.";
                    }
                    state.energy = Math.min(100, state.energy + 10);
                    state.addLog("No cache. Whoever cut here took their supplies with them. Just ice.");
                    return "No cache, just ice. -5 Energy, +10 Energy.";
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
        desc: 'A dense field of rock and debris. Good for mining, dangerous to fly through.',
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
