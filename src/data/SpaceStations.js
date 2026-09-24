/**
 * SPACE STATIONS - Abandoned orbital structures
 *
 * Every station on this heading is a ship that stopped: a hull that anchored,
 * dug in, welded on to another, or stripped itself to feed a beacon.
 * Larger than ship wrecks, multiple rooms to explore.
 * Higher risk, higher reward. No trading - just looting.
 *
 * Writing rules for this file: docs/STYLE.md. Plain sentences, no nicknames, no riddles.
 */

const STATION_NAMES = [
    'Orbital-7', 'Waypoint Kappa', 'Deep Anchor', 'The Relay',
    'Station Erebus', 'Outpost Terminus', 'The Hub', 'Platform Zeta',
    'Cargo Ring Alpha', 'Research Station Omega', 'Refinery-12',
    'Mining Platform 6', 'Colony Support Station', 'The Watchtower'
];

const SPACE_STATION_ENCOUNTERS = [
    // --- 1. MINING PLATFORM: a hull that anchored to a rock and dug in ---
    {
        id: 'STATION_MINING',
        weight: 20,
        title: "MINING PLATFORM",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} is a ship that anchored itself to an asteroid and mined it to survive. The mining arms stopped mid-swing. The bays are sealed. A beacon still transmits.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "They found a rock, stopped, and made a life on it. I can see why." },
            { speaker: 'Tech Mira', text: "Aura's talking to the station's repair drones, Commander. They still answer her!" },
            { speaker: 'Spc. Vance', text: "Nobody's alive here, but those drones still move. Keep an eye on them." }
        ],
        choices: [
            {
                text: "Cut open the ore bays",
                desc: "-5 Energy. +30-50 Salvage.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const salvage = Math.floor(Math.random() * 21) + 30;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    state.addLog(`The ore bays held refined metal and spare parts. +${salvage} Salvage.`);
                    return `Bays cut open. -5 Energy, +${salvage} Salvage.`;
                }
            },
            {
                text: "Let A.U.R.A. run the drones",
                desc: "-10 Energy. +2 Data. 40% chance: all planets revealed.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("A.U.R.A.: 'Six drones are surveying the sector for us, Commander.'");
                    if (Math.random() < 0.4) {
                        state.sectorNodes?.forEach(p => p.remoteScanned = true);
                        state.addLog("The drone survey is finished. Every planet in the sector is on the map.");
                    }
                    state.noteStanding && state.noteStanding('mira');
                    return "Drones handed to A.U.R.A. -10 Energy, +2 Data.";
                }
            },
            {
                text: "Strip the reactor",
                desc: "+40 Energy. 25% chance someone gets hurt.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 40);
                    if (Math.random() < 0.25) {
                        const crew = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (crew.length > 0) {
                            const victim = (state._boarder && state._boarder.status !== 'DEAD') ? state._boarder : crew[Math.floor(Math.random() * crew.length)]; // whoever boarded is the one in the room
                            victim.status = 'INJURED';
                            state.addLog(`${victim.name} was exposed to radiation at the reactor. INJURED.`);
                            return `Reactor stripped. +40 Energy. ${victim.name} has radiation burns.`;
                        }
                    }
                    state.addLog("The reactor cells came out cleanly.");
                    return "Reactor stripped. +40 Energy.";
                }
            }
        ]
    },

    // --- 2. RESEARCH STATION: a hull that stopped to study something ---
    {
        id: 'STATION_RESEARCH',
        weight: 15,
        title: "RESEARCH STATION",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} was a ship that stopped here to study something. There's no damage outside, but every escape pod is gone. The lab is sealed, and the quarantine lights are on.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "Quarantine seals. Either they were studying something dangerous, or something got loose." },
            { speaker: 'Tech Mira', text: "All their research is still on the drives. That's years of work, Commander!" },
            { speaker: 'A.U.R.A.', text: "The last log entry stops mid-sentence, Commander. The crew left in a hurry." }
        ],
        choices: [
            {
                text: "Copy the research database",
                desc: "-5 Energy. +1 Tech Item, or +3 Data if the drives hold nothing useful.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (typeof ITEMS !== 'undefined') {
                        const possibleItems = [ITEMS.TECH_FRAGMENT, ITEMS.ANCIENT_DATABASE, ITEMS.SIGNAL_DECODER].filter(i => i);
                        const item = possibleItems[Math.floor(Math.random() * possibleItems.length)];
                        if (item) {
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...item, acquiredAt: 'Research Station' });
                            state.addLog(`Research drives copied. Found: ${item.name}`);
                            return `Database copied. -5 Energy. Found: ${item.name}`;
                        }
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    return "Drives copied. -5 Energy, +3 Data.";
                }
            },
            {
                text: "Break the quarantine seal",
                desc: "30% chance someone gets hurt (+1 Stress). 40% chance: +1 Bio Sample. Otherwise nothing.",
                effect: (state) => {
                    const roll = Math.random();

                    if (roll < 0.3) {
                        const crew = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                        if (crew.length > 0) {
                            const victim = (state._boarder && state._boarder.status !== 'DEAD') ? state._boarder : crew[Math.floor(Math.random() * crew.length)]; // whoever boarded is the one in the room
                            victim.status = 'INJURED';
                            victim.stress = Math.min(3, (victim.stress || 0) + 1);
                            state.addLog(`Something from the lab had grown over the door. ${victim.name} breathed it in.`);
                            return `Quarantine broken. ${victim.name} INJURED.`;
                        }
                    } else if (roll < 0.7) {
                        if (typeof ITEMS !== 'undefined' && ITEMS.BIO_SAMPLE_RARE) {
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...ITEMS.BIO_SAMPLE_RARE, acquiredAt: 'Research Station' });
                            state.addLog("The containment units are still sealed. One sample is worth taking.");
                            return "Quarantine clear. Found: Rare Bio-Sample.";
                        }
                        state.rations = Math.min(state.maxRations, state.rations + 5);
                        return "The lab held preserved food samples. +5 Rations.";
                    }

                    state.addLog("The lab is empty. Whatever they studied left with the escape pods.");
                    return "Nothing in the quarantine zone to take.";
                }
            },
            {
                text: "Search the crew quarters",
                desc: "-5 Energy. +15 Salvage, +2 Rations.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.rations = Math.min(state.maxRations, state.rations + 2);
                    state.addLog("Personal lockers and emergency food. A half-written letter is lying on one bunk.");
                    return "Quarters searched. -5 Energy, +15 Salvage, +2 Rations.";
                }
            }
        ]
    },

    // --- 3. THE JOINED HULLS: three ships that stopped, one after another ---
    {
        id: 'STATION_REFUGEE',
        weight: 12,
        title: "THE JOINED HULLS",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} is three ships welded together. Their hull numbers are not in order. Inside, the walls are covered in names, dates and goodbyes. Some are in children's handwriting.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "So many names. It will take me all day to copy this wall." },
            { speaker: 'Eng. Jaxon', text: "Three crews stopped here, one after another. Each one found the others and stayed." },
            { speaker: 'Spc. Vance', text: "How do three crews end up in the same spot, this far out?" }
        ],
        choices: [
            {
                text: "Search the stores",
                desc: "-5 Energy. +4-6 Rations, +20 Salvage.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const rations = Math.floor(Math.random() * 3) + 4;
                    state.rations = Math.min(state.maxRations, state.rations + rations);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.addLog(`Food stores behind the third ship's kitchen. +${rations} Rations, +20 Salvage.`);
                    return `Stores searched. -5 Energy, +${rations} Rations, +20 Salvage.`;
                }
            },
            {
                text: "Add our names to the wall",
                desc: "-1 Ration: a day spent here. +1 Data. Jaxon -1 Stress, Aris -1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.max(0, (jaxon.stress || 0) - 1);
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    state.addLog("Our five names go on the wall, under a child's drawing of a yellow sun and green grass.");
                    if (aris) state.addLog("Dr. Aris copies every name on the wall into her record of the dead.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Left our names with theirs');
                    state.noteStanding && state.noteStanding('jaxon');
                    return "Our names are on the wall. -1 Ration, +1 Data. Jaxon -1 Stress, Aris -1 Stress.";
                }
            },
            {
                text: "Play the comm array",
                desc: "+2 Data. All crew +1 Stress.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("Every recorded call on the array is from an Exodus ship. None were ever answered.");
                    if (state.crew.some(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD')) {
                        state.addLog("Spc. Vance: \"Nobody told us about any of these ships. Save every call.\"");
                    }
                    state.noteStanding && state.noteStanding('vance');
                    return "Array played through. Forty-one calls, none answered. +2 Data. All crew +1 Stress.";
                }
            }
        ]
    },

    // --- 4. THE BEACON: a hull stripped to its frame to shout back the way it came ---
    {
        id: 'STATION_MILITARY',
        weight: 10,
        title: "THE BEACON",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} is a ship stripped down to its frame to power one thing: a beacon aimed back toward Earth. It has been sending the same two words for years.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Those capacitors are as big as our lander. They put everything into this." },
            { speaker: 'Tech Mira', text: "It's the loudest signal out here. Aura can hear it from three sectors away!" },
            { speaker: 'A.U.R.A.', text: "It is aimed at Earth, Commander. The message is 'Turn back.' I have logged it." }
        ],
        choices: [
            {
                text: "Drain the capacitors",
                desc: "+40 Energy. The beacon goes dark. Aris +1 Stress, Mira +1 Stress.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 40);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("The beacon cuts off mid-word.");
                    if (mira) state.addLog("Tech Mira: 'That was the only other voice out here.'");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Silenced the beacon');
                    return "Capacitors drained into our reactor. +40 Energy. The beacon is dark.";
                }
            },
            {
                text: "Copy its aiming data",
                desc: "-5 Energy. All planets in the sector revealed.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state.sectorNodes?.forEach(p => {
                        if (!p.remoteScanned) p.remoteScanned = true;
                    });
                    state.addLog("To aim the beam, it had to map everything nearby. Every planet in the sector is plotted.");
                    return "Aiming data copied. Every planet is on the map. -5 Energy.";
                }
            },
            {
                text: "Add our hull number to its message",
                desc: "-10 Energy. +2 Data. Vance +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    if (vance) state.addLog("Spc. Vance adds our hull number to the message, so Earth knows we heard it too.");
                    state.addLog("A.U.R.A.: 'Transmitting, Commander. I will tell you if anyone answers.'");
                    state.noteStanding && state.noteStanding('vance');
                    return "The beacon now says: 'Turn back. Exodus 9.' -10 Energy, +2 Data. Vance +1 Stress.";
                }
            }
        ]
    },

    // --- 5. THE STOREHOUSE: a crew that shelved every wreck they passed ---
    {
        id: 'STATION_TRADE',
        weight: 15,
        title: "THE STOREHOUSE",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} belonged to a crew who collected things. They sorted and shelved parts from every wreck they passed. There are aisles of it, and a ledger by the door.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Someone spent years sorting all this. We might as well use it." },
            { speaker: 'Dr. Aris', text: "There's a whole aisle of medical supplies, all labelled by hand." },
            { speaker: 'Tech Mira', text: "Look, Commander. The ledger lists every wreck they found, by hull number." }
        ],
        choices: [
            {
                text: "Search the deep shelves",
                desc: "-5 Energy. +1 Valuable Item, or +35 Salvage if the good shelf is bare.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (typeof ITEMS !== 'undefined') {
                        const valuables = [
                            ITEMS.CONDENSED_SALVAGE,
                            ITEMS.IONIZED_BATTERY,
                            ITEMS.XENOTECH_COMPONENT,
                            ITEMS.POWER_COUPLER,
                            ITEMS.REPAIR_DRONE
                        ].filter(i => i);

                        if (valuables.length > 0) {
                            const item = valuables[Math.floor(Math.random() * valuables.length)];
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...item, acquiredAt: 'Storehouse' });
                            state.addLog(`Back shelf, top row, labelled in pencil: ${item.name}`);
                            return `Deep shelves searched. -5 Energy. Found: ${item.name}`;
                        }
                    }

                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    return "The deep shelves held raw metal. -5 Energy, +35 Salvage.";
                }
            },
            {
                text: "Open the medical aisle",
                desc: "-5 Energy. Heals one injured crew member. Otherwise +1 Medkit, or +3 Rations.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const injured = state.crew.filter(c => c.status === 'INJURED');
                    if (injured.length > 0) {
                        injured[0].status = 'HEALTHY';
                        state.addLog(`Working medical gear on the shelf. ${injured[0].name} is treated.`);
                        return `Medical aisle used. ${injured[0].name} is healthy again. -5 Energy.`;
                    }

                    if (typeof ITEMS !== 'undefined' && ITEMS.MEDKIT) {
                        state.cargo = state.cargo || [];
                        state.cargo.push({ ...ITEMS.MEDKIT, acquiredAt: 'Storehouse' });
                        return "Nobody to treat. Took a Medkit for later. -5 Energy.";
                    }

                    state.rations = Math.min(state.maxRations, state.rations + 3);
                    return "The medical shelf is bare, but there are food supplements. -5 Energy, +3 Rations.";
                }
            },
            {
                text: "Read the ledger",
                desc: "-1 Ration: a day reading. +3 Data. All planets revealed. Vance +1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    state.sectorNodes?.forEach(p => {
                        if (!p.remoteScanned) p.remoteScanned = true;
                    });
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    state.addLog("LEDGER: hull number, where it was found, what was taken. The deeper they went, the higher the numbers, and the older the wrecks.");
                    if (vance) state.addLog("Spc. Vance: \"Thousands of ships, and we were told eight. Someone lied to all of them.\"");
                    return "Ledger read. It shows where every wreck they found lies. -1 Ration, +3 Data. Vance +1 Stress.";
                }
            }
        ]
    },

    // --- 6. THE SILENT STATION: on no chart, and never used ---
    {
        id: 'STATION_GHOST',
        weight: 8,
        title: "THE SILENT STATION",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} appears on none of our maps. The corridors are the right shape, but the doors are slightly too small. Every bunk has four folded blankets. Nothing has ever been used.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "It matches the standard station plan to the millimetre, Commander. Real stations always differ a little." },
            { speaker: 'Spc. Vance', text: "Nobody built this by hand, and nobody has ever lived here. We should leave." },
            { speaker: 'Tech Mira', text: "But look at it. It's brand new. Nothing else out here is new." }
        ],
        choices: [
            {
                text: "Explore deeper",
                desc: "25% chance: +40 Salvage, +30 Energy. 25% chance: whoever goes in gets +2 Stress. 50% chance: they come back strangely calm, all Stress gone.",
                effect: (state) => {
                    const roll = Math.random();
                    const crew = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                    const walker = (state._boarder && state._boarder.status !== 'DEAD') ? state._boarder : crew[Math.floor(Math.random() * crew.length)];

                    if (roll < 0.25) {
                        if (walker) {
                            walker.stress = Math.min(3, (walker.stress || 0) + 2);
                            state.addLog(`${walker.name} found a bunk with their own name on it. Nobody had ever slept there.`);
                        }
                        return `${walker ? walker.name : 'The boarder'} came back quickly and won't say why. +2 Stress.`;
                    } else if (roll < 0.5) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                        state.energy = Math.min(100, state.energy + 30);
                        state.addLog("The stores hold the same supplies we loaded at launch. The seals have never been broken.");
                        return "Shelves full of supplies like ours, unopened. +40 Salvage, +30 Energy.";
                    } else {
                        if (walker) {
                            walker.stress = 0;
                            walker.tags = walker.tags || [];
                            if (!walker.tags.includes('STATION_TOUCHED')) walker.tags.push('STATION_TOUCHED');
                            state.addLog(`${walker.name} wandered off alone and came back very calm.`);
                            state.addLog(`${walker.name}: "It's fine in there. Really. I'm not scared any more."`);
                        }
                        return "Everyone is back. One of them is far too calm, and nobody asks why.";
                    }
                }
            },
            {
                text: "Measure it from outside",
                desc: "-5 Energy. +2 Data.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("Not one scratch on the whole station. A.U.R.A. confirms every measurement matches the plan exactly.");
                    return "Measured and logged. Every measurement is correct, and nothing has been used. -5 Energy, +2 Data.";
                }
            },
            {
                text: "Leave now",
                desc: "-10 Energy to burn away. Vance -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("We burned away from the station at full power.");
                    return "Burned away from the silent station. -10 Energy. Vance -1 Stress.";
                }
            }
        ]
    }
];

/**
 * Roll for a space station encounter in current sector
 * Stations appear based on sector and previous discoveries
 */
function rollStationEncounter(state) {
    // Base chance depends on sector
    let chance = 0.10 + (state.currentSector * 0.03); // 13% S1, 16% S2, etc.

    // Already found a station this sector? Lower chance
    if (state._stationFoundThisSector) {
        chance *= 0.3;
    }

    // TEST_MODE always triggers
    if (window.TEST_MODE) {
        chance = 1.0;
    }

    if (Math.random() > chance) {
        return null;
    }

    // Select by weight
    const totalWeight = SPACE_STATION_ENCOUNTERS.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const encounter of SPACE_STATION_ENCOUNTERS) {
        roll -= encounter.weight;
        if (roll <= 0) {
            state._stationFoundThisSector = true;
            return encounter;
        }
    }

    return SPACE_STATION_ENCOUNTERS[0];
}

// Export
if (typeof window !== 'undefined') {
    window.SPACE_STATION_ENCOUNTERS = SPACE_STATION_ENCOUNTERS;
    window.rollStationEncounter = rollStationEncounter;
}
