/**
 * SPACE STATIONS - Abandoned orbital structures
 *
 * Every station on this heading is a ship that stopped: a hull that anchored,
 * dug in, welded on to another, or stripped itself to feed a beacon.
 * Larger than ship wrecks, multiple rooms to explore.
 * Higher risk, higher reward. No trading - just looting.
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
        context: (name) => `${name} is a hull that anchored to a rock and cut into it to keep living. Mining arms frozen mid-swing. Bays sealed. A beacon still pings.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "They stopped and dug in. Call it the Burrow. I understand it." },
            { speaker: 'Tech Mira', text: "Aura is talking to the station's drones, Commander. They still answer her." },
            { speaker: 'Spc. Vance', text: "No life. Six drones on the roster. I count six on the hull. Watch them." }
        ],
        choices: [
            {
                text: "Cut open the ore bays",
                desc: "-5 Energy. +30-50 Salvage.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const salvage = Math.floor(Math.random() * 21) + 30;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    state.addLog(`Ore bays held processed metal and spare parts. +${salvage} Salvage.`);
                    return `Bays cut open. -5 Energy, +${salvage} Salvage.`;
                }
            },
            {
                text: "Let A.U.R.A. run the drones",
                desc: "-10 Energy. +2 Data. 40% chance: all planets revealed.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("A.U.R.A.: 'Six drones, Commander. They are surveying. Tech Mira is watching them with me.'");
                    if (Math.random() < 0.4) {
                        state.sectorNodes?.forEach(p => p.remoteScanned = true);
                        state.addLog("Drone survey complete. Every planet in the sector is on the map.");
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
                            state.addLog(`${victim.name} took a dose off the reactor. INJURED.`);
                            return `Reactor stripped. +40 Energy. ${victim.name} burned.`;
                        }
                    }
                    state.addLog("Reactor cells pulled clean.");
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
        context: (name) => `${name} was a hull that stopped to study something. No damage outside. Every escape pod is gone. The lab is sealed. Quarantine lights still on.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "Quarantine seals. Either they were studying something, or it got out." },
            { speaker: 'Tech Mira', text: "And here we see the databases. Years of somebody's work, still on the disks." },
            { speaker: 'A.U.R.A.', text: "The last log entry is incomplete, Commander. I will read it if you ask." }
        ],
        choices: [
            {
                text: "Copy the research database",
                desc: "-5 Energy. +1 Tech Item, or +3 Data if the disks are bare.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (typeof ITEMS !== 'undefined') {
                        const possibleItems = [ITEMS.TECH_FRAGMENT, ITEMS.ANCIENT_DATABASE, ITEMS.SIGNAL_DECODER].filter(i => i);
                        const item = possibleItems[Math.floor(Math.random() * possibleItems.length)];
                        if (item) {
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...item, acquiredAt: 'Research Station' });
                            state.addLog(`Research disks copied. Acquired: ${item.name}`);
                            return `Database copied. -5 Energy. Found: ${item.name}`;
                        }
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    return "Disks copied. -5 Energy, +3 Data.";
                }
            },
            {
                text: "Break the quarantine seal",
                desc: "30% chance someone gets hurt. 40% chance: +1 Bio Sample. Else nothing.",
                effect: (state) => {
                    const roll = Math.random();

                    if (roll < 0.3) {
                        const crew = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                        if (crew.length > 0) {
                            const victim = (state._boarder && state._boarder.status !== 'DEAD') ? state._boarder : crew[Math.floor(Math.random() * crew.length)]; // whoever boarded is the one in the room
                            victim.status = 'INJURED';
                            victim.stress = Math.min(3, (victim.stress || 0) + 1);
                            state.addLog(`The lab's own culture had grown over the door. ${victim.name} breathed it.`);
                            return `Quarantine broken. ${victim.name} INJURED.`;
                        }
                    } else if (roll < 0.7) {
                        if (typeof ITEMS !== 'undefined' && ITEMS.BIO_SAMPLE_RARE) {
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...ITEMS.BIO_SAMPLE_RARE, acquiredAt: 'Research Station' });
                            state.addLog("Containment units still sealed. One sample worth carrying.");
                            return "Quarantine clear. Found: Rare Bio-Sample.";
                        }
                        state.rations = Math.min(state.maxRations, state.rations + 5);
                        return "Lab held preserved food samples. +5 Rations.";
                    }

                    state.addLog("The lab was empty. Whatever they studied went with the pods.");
                    return "Quarantine zone empty. Nothing to take.";
                }
            },
            {
                text: "Search the crew quarters",
                desc: "-5 Energy. +15 Salvage, +2 Rations.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.rations = Math.min(state.maxRations, state.rations + 2);
                    state.addLog("Personal lockers and emergency stores. Five lockers, four name tags.");
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
        context: (name) => `${name} is three hulls welded into one. Three numbers on the plating, none in order. Inside, the walls are covered in names, dates, goodbyes. Some of the writing is children's.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "So many names. I'll need the whole wall." },
            { speaker: 'Eng. Jaxon', text: "They all stopped here. One after another. Somebody had to be first." },
            { speaker: 'Spc. Vance', text: "Three hulls, three plates, twelve names. I count more bunks than that." }
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
                    state.addLog(`Stores found behind the third hull's galley. +${rations} Rations, +20 Salvage.`);
                    return `Stores searched. -5 Energy, +${rations} Rations, +20 Salvage.`;
                }
            },
            {
                text: "Add our names to the wall",
                desc: "-1 Ration: a day at anchor. +1 Data. Jaxon -1 Stress, Aris -1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.max(0, (jaxon.stress || 0) - 1);
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    state.addLog("Five names in Jaxon's hand, under a child's drawing of a yellow sun and green grass.");
                    state.addLog("Dr. Aris copies the wall into her list. It takes the whole day.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Left our names with theirs');
                    state.noteStanding && state.noteStanding('jaxon');
                    return "Our names are on the wall. -1 Ration, +1 Data. Jaxon -1 Stress, Aris -1 Stress.";
                }
            },
            {
                text: "Play the comm array",
                desc: "+2 Data. All crew +1 Stress. Vance counts the calls.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("Every call on the array is an Exodus hull. None of them were answered.");
                    state.addLog("Spc. Vance: \"Forty-one calls. Forty-one numbers. Write them down. All of them.\"");
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
        context: (name) => `${name} is a hull stripped to the frame to feed one thing: a beacon, aimed back the way we came. It has been saying one word for a very long time.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Capacitors the size of the goat. They gave it everything they had." },
            { speaker: 'Tech Mira', text: "And here we see the loudest thing on the heading. Aura can hear it three sectors off." },
            { speaker: 'A.U.R.A.', text: "It is aimed at Earth, Commander. One word, repeated: back. I have logged it." }
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
                    state.addLog("The beacon stops mid-word. Tech Mira: 'She says it's quiet now, Commander. She doesn't like it.'");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Silenced the beacon');
                    return "Capacitors drained into the kettle. +40 Energy. The beacon is dark.";
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
                    state.addLog("To aim, it had to map. Every body in the sector, plotted so the beam could miss them.");
                    return "Aiming data copied. Every planet on the map. -5 Energy.";
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
                    state.addLog("Spc. Vance adds one number after the word. Nine. He says it out loud twice, to be sure.");
                    state.addLog("A.U.R.A.: 'Transmitting, Commander. I will tell you if anyone answers.'");
                    state.noteStanding && state.noteStanding('vance');
                    return "The beacon now says: back. Nine. -10 Energy, +2 Data. Vance +1 Stress.";
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
        context: (name) => `${name} was a hull whose crew collected. Every wreck they passed, sorted and shelved. Aisles of it. A ledger at the door with four columns.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Somebody's whole life, shelved. Call it the Attic." },
            { speaker: 'Dr. Aris', text: "There's a clinic aisle. Labelled by hand." },
            { speaker: 'Tech Mira', text: "And here we see the ledger. Every wreck by hull number. The numbers go up, Commander." }
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
                    return "Deep shelves held raw stock. -5 Energy, +35 Salvage.";
                }
            },
            {
                text: "Open the clinic aisle",
                desc: "-5 Energy. Heals one injured crew. Else +1 Medkit, or +3 Rations.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const injured = state.crew.filter(c => c.status === 'INJURED');
                    if (injured.length > 0) {
                        injured[0].status = 'HEALTHY';
                        state.addLog(`Working clinic gear on the shelf. ${injured[0].name} treated.`);
                        return `Clinic aisle used. ${injured[0].name} back to HEALTHY. -5 Energy.`;
                    }

                    if (typeof ITEMS !== 'undefined' && ITEMS.MEDKIT) {
                        state.cargo = state.cargo || [];
                        state.cargo.push({ ...ITEMS.MEDKIT, acquiredAt: 'Storehouse' });
                        return "Nobody to treat. Took a Medkit for later. -5 Energy.";
                    }

                    state.rations = Math.min(state.maxRations, state.rations + 3);
                    return "Clinic shelf bare. Found supplements. -5 Energy, +3 Rations.";
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
                    state.addLog("LEDGER: hull, where found, what taken, crew. The crew column says four on every line.");
                    state.addLog("Spc. Vance reads the numbers down the page. He stops. He starts again from the top.");
                    return "Ledger read. Every wreck they found, where it lies. -1 Ration, +3 Data. Vance +1 Stress.";
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
        context: (name) => `${name} is on no chart. The corridors are the right shape. The doors are a hand too small. Every bunk has four blankets, folded. Nothing has ever been used.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "It matches the standard station plan exactly, Commander. Nobody builds exactly." },
            { speaker: 'Spc. Vance', text: "Four blankets a bunk. Nobody folds four blankets. We should go." },
            { speaker: 'Tech Mira', text: "But look at it. It's new. Nothing out here is new." }
        ],
        choices: [
            {
                text: "Explore deeper",
                desc: "25% chance: +40 Salvage, +30 Energy. 25% chance: +2 Stress for whoever went in. Else someone comes back too calm.",
                effect: (state) => {
                    const roll = Math.random();
                    const crew = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                    const walker = (state._boarder && state._boarder.status !== 'DEAD') ? state._boarder : crew[Math.floor(Math.random() * crew.length)];

                    if (roll < 0.25) {
                        if (walker) {
                            walker.stress = Math.min(3, (walker.stress || 0) + 2);
                            state.addLog(`${walker.name} found a bunk with their own name on the tag. The blanket had never been slept under.`);
                        }
                        return `${walker ? walker.name : 'The boarder'} came back fast and will not say why. +2 Stress.`;
                    } else if (roll < 0.5) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                        state.energy = Math.min(100, state.energy + 30);
                        state.addLog("The stores are our stores. Same labels, same lot numbers. The seals have never been broken.");
                        return "Shelves full of our own stock, unopened. +40 Salvage, +30 Energy.";
                    } else {
                        if (walker) {
                            walker.stress = 0;
                            walker.tags = walker.tags || [];
                            if (!walker.tags.includes('STATION_TOUCHED')) walker.tags.push('STATION_TOUCHED');
                            state.addLog(`${walker.name} wandered off alone. They came back calm. Too calm.`);
                            state.addLog(`${walker.name}: "It's fine in there. It's all fine. I'm not afraid any more."`);
                        }
                        return "Exploration complete. Somebody came back at peace. Nobody asks how.";
                    }
                }
            },
            {
                text: "Measure it from outside",
                desc: "-5 Energy. +2 Data.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("Tech Mira: 'And here we see a station with no wear on it, Commander. Not a scratch. Aura says it's correct.'");
                    return "Measured and logged. Every dimension right, none of them used. -5 Energy, +2 Data.";
                }
            },
            {
                text: "Leave now",
                desc: "-10 Energy to burn away. Vance -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("We left. Fast. Nobody argued.");
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
