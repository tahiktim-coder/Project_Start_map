/**
 * SPACE STATIONS - Abandoned orbital structures
 *
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
    // --- 1. ABANDONED MINING STATION ---
    {
        id: 'STATION_MINING',
        weight: 20,
        title: "MINING PLATFORM",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} hangs dead in orbit, its mining arms frozen mid-swing. The cargo bays are sealed. According to the manifest, this station processed rare metals for the colony ships. The lights are off, but the emergency beacon is still pinging.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Ore processing equipment. If any of it still works, we could strip it for salvage." },
            { speaker: 'Tech Mira', text: "I'm reading residual power in the storage bays. Might be worth checking." },
            { speaker: 'Spc. Vance', text: "No life signs. But those mining drones might still be active. Watch yourselves." }
        ],
        choices: [
            {
                text: "Explore the cargo bays",
                desc: "+30-50 Salvage. Low risk.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 21) + 30;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    state.addLog(`Cargo bays contained processed ore and spare parts. +${salvage} Salvage.`);
                    return `Cargo bays looted successfully. +${salvage} Salvage recovered.`;
                }
            },
            {
                text: "Access the control center",
                desc: "+Colony knowledge, chance of sector map data.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;

                    // 40% chance to reveal all planets
                    if (Math.random() < 0.4) {
                        state.sectorNodes?.forEach(p => p.remoteScanned = true);
                        state.addLog("Mining survey data recovered. All sector planets revealed!");
                    }

                    state.addLog("Control center logs detail mineral deposits across the sector.");
                    return "Survey data recovered. Colony knowledge improved.";
                }
            },
            {
                text: "Strip the reactor",
                desc: "+40 Energy. 25% chance of radiation exposure (crew injury).",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 40);

                    if (Math.random() < 0.25) {
                        const crew = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (crew.length > 0) {
                            const victim = crew[Math.floor(Math.random() * crew.length)];
                            victim.status = 'INJURED';
                            state.addLog(`${victim.name} exposed to reactor radiation. INJURED.`);
                            return `Reactor stripped. +40 Energy. ${victim.name} suffered radiation burns.`;
                        }
                    }

                    state.addLog("Reactor fuel cells extracted safely.");
                    return "Reactor stripped successfully. +40 Energy.";
                }
            }
        ]
    },

    // --- 2. RESEARCH STATION ---
    {
        id: 'STATION_RESEARCH',
        weight: 15,
        title: "RESEARCH STATION",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} was a science outpost. The exterior shows no damage, but all the escape pods are gone. Whatever happened here, the crew left in a hurry. The lab section is still sealed — quarantine protocols active.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "Quarantine seals. They were studying something dangerous. Or something dangerous got out." },
            { speaker: 'Tech Mira', text: "The research databases might still be intact. Years of study, just waiting to be downloaded." },
            { speaker: 'A.U.R.A.', text: "I advise caution. The station's last log entry is... incomplete." }
        ],
        choices: [
            {
                text: "Access the research database",
                desc: "+Tech Fragment or special item. Safe extraction.",
                effect: (state) => {
                    if (typeof ITEMS !== 'undefined') {
                        const possibleItems = [ITEMS.TECH_FRAGMENT, ITEMS.ANCIENT_DATABASE, ITEMS.SIGNAL_DECODER];
                        const item = possibleItems[Math.floor(Math.random() * possibleItems.length)];
                        if (item) {
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...item, acquiredAt: 'Research Station' });
                            state.addLog(`Downloaded research data. Acquired: ${item.name}`);
                            return `Research archives accessed. Found: ${item.name}`;
                        }
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    return "Research data downloaded. Colony knowledge greatly improved.";
                }
            },
            {
                text: "Break the quarantine seal",
                desc: "High risk. Could find valuable bio-samples... or something worse.",
                effect: (state) => {
                    const roll = Math.random();

                    if (roll < 0.3) {
                        // Bad outcome - contamination
                        const crew = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                        if (crew.length > 0) {
                            const victim = crew[Math.floor(Math.random() * crew.length)];
                            victim.status = 'INJURED';
                            victim.stress = Math.min(3, (victim.stress || 0) + 1);
                            state.addLog(`Something in the lab attacked ${victim.name}. The wounds don't look natural.`);
                            return `Quarantine breached. ${victim.name} INJURED by unknown organism.`;
                        }
                    } else if (roll < 0.7) {
                        // Good outcome - samples
                        if (typeof ITEMS !== 'undefined' && ITEMS.BIO_SAMPLE_RARE) {
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...ITEMS.BIO_SAMPLE_RARE, acquiredAt: 'Research Station' });
                            state.addLog("Bio-containment units still sealed. Valuable samples recovered.");
                            return "Quarantine safe. Found: Rare Bio-Sample.";
                        }
                        state.rations = Math.min(state.maxRations, state.rations + 5);
                        return "Lab contained preserved food samples. +5 Rations.";
                    }

                    // Neutral - empty
                    state.addLog("The lab was empty. Whatever they were studying is gone.");
                    return "Quarantine zone empty. The specimen escaped long ago.";
                }
            },
            {
                text: "Loot the crew quarters only",
                desc: "+15 Salvage, +2 Rations. Safe option.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.rations = Math.min(state.maxRations, state.rations + 2);
                    state.addLog("Personal effects and emergency supplies recovered from quarters.");
                    return "Crew quarters searched. +15 Salvage, +2 Rations.";
                }
            }
        ]
    },

    // --- 3. REFUGEE STATION ---
    {
        id: 'STATION_REFUGEE',
        weight: 12,
        title: "REFUGEE WAYSTATION",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} was a gathering point for colony ships. Thousands passed through here on their way to the stars. Now it's empty. The walls are covered in messages — names, dates, farewells. Some of the handwriting belongs to children.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "So many people. So many hopes. I wonder how many made it." },
            { speaker: 'Eng. Jaxon', text: "The supply depot might still have something. Refugees couldn't carry everything." },
            { speaker: 'Spc. Vance', text: "Keep it professional. We take what we need and move on." }
        ],
        choices: [
            {
                text: "Search the supply depot",
                desc: "+4-6 Rations, +20 Salvage. Standard loot.",
                effect: (state) => {
                    const rations = Math.floor(Math.random() * 3) + 4;
                    state.rations = Math.min(state.maxRations, state.rations + rations);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.addLog(`Found abandoned supplies. +${rations} Rations, +20 Salvage.`);
                    return `Supply depot raided. +${rations} Rations, +20 Salvage.`;
                }
            },
            {
                text: "Read the message wall",
                desc: "+Colony knowledge. Crew stress varies based on what they find.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;

                    const outcomes = [
                        {
                            log: "We found a message from the Exodus-3 crew. They made it to Sector 4. They were alive.",
                            stress: -1
                        },
                        {
                            log: "Children's drawings. A yellow sun. Green grass. 'Our new home.' Nobody knows if they found it.",
                            stress: 0
                        },
                        {
                            log: "Final messages. Goodbyes. 'If you find this, we didn't make it. Remember us.'",
                            stress: 1
                        }
                    ];

                    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
                    state.addLog(outcome.log);

                    if (outcome.stress !== 0) {
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') {
                                c.stress = Math.max(0, Math.min(3, (c.stress || 0) + outcome.stress));
                            }
                        });
                    }

                    return `Messages read. Colony knowledge improved. ${outcome.stress > 0 ? 'Crew affected by what they found.' : outcome.stress < 0 ? 'Crew found hope in the messages.' : ''}`;
                }
            },
            {
                text: "Check the communication array",
                desc: "Old distress signals. Might learn what happened to other ships.",
                effect: (state) => {
                    state.exodusLogsFound = state.exodusLogsFound || [];

                    // Find a log they haven't seen
                    for (let i = 1; i <= 8; i++) {
                        if (!state.exodusLogsFound.includes(i)) {
                            state.exodusLogsFound.push(i);
                            state.addLog(`Recovered Exodus flight recorder data. New information about the fleet.`);
                            return "Communication logs recovered. New Exodus data found.";
                        }
                    }

                    state.addLog("All channels are static now. The voices stopped years ago.");
                    return "No new transmissions found. Just echoes of the past.";
                }
            }
        ]
    },

    // --- 4. MILITARY STATION ---
    {
        id: 'STATION_MILITARY',
        weight: 10,
        title: "DEFENSE PLATFORM",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} bristles with weapon emplacements — all powered down now. This was humanity's last line of defense before the exodus. The armory seals are intact. Whatever they were guarding against, they took the fight seriously.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Military hardware. If any of it still works, it could be useful." },
            { speaker: 'Tech Mira', text: "The targeting systems used advanced computing. Might be compatible with A.U.R.A." },
            { speaker: 'A.U.R.A.', text: "I detect weapons-grade power cells in the armory. Approach with caution." }
        ],
        choices: [
            {
                text: "Access the armory",
                desc: "+40 Salvage (military components). Automated defenses may activate.",
                effect: (state) => {
                    if (Math.random() < 0.3) {
                        // Defenses activate
                        const crew = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (crew.length > 0) {
                            const victim = crew[Math.floor(Math.random() * crew.length)];
                            victim.status = 'INJURED';
                            state.addLog(`Automated turret activated! ${victim.name} hit before it could be disabled.`);
                            state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                            return `Armory breached. +40 Salvage. ${victim.name} INJURED by defense system.`;
                        }
                    }

                    state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                    state.addLog("Armory accessed. Military-grade components recovered.");
                    return "Armory looted successfully. +40 Salvage (military grade).";
                }
            },
            {
                text: "Download tactical data",
                desc: "Navigation hazard data. Reduces warp costs this sector.",
                effect: (state) => {
                    state._warpDiscount = (state._warpDiscount || 0) + 10;
                    state.addLog("Military navigation data downloaded. Safer route calculations available.");
                    return "Tactical data acquired. Warp costs reduced by 10%.";
                }
            },
            {
                text: "Drain the weapon capacitors",
                desc: "+50 Energy. Safe extraction.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 50);
                    state.addLog("Weapon capacitors drained. Energy transferred to ship reserves.");
                    return "Power extraction complete. +50 Energy from weapon systems.";
                }
            }
        ]
    },

    // --- 5. DERELICT TRADE HUB ---
    {
        id: 'STATION_TRADE',
        weight: 15,
        title: "TRADE HUB WRECKAGE",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} was once the busiest station in the sector. Merchants, miners, colonists — everyone passed through here. Now the docking bays are empty, the shops are looted, but the deeper storage levels might still hold something.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Trade stations had deep storage. The good stuff was always kept hidden." },
            { speaker: 'Dr. Aris', text: "Medical supplies were always in demand. The clinic might have leftovers." },
            { speaker: 'Tech Mira', text: "The data brokers kept servers here. Information was currency." }
        ],
        choices: [
            {
                text: "Search the deep storage vaults",
                desc: "Random valuable item. Requires security bypass.",
                effect: (state) => {
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
                            state.cargo.push({ ...item, acquiredAt: 'Trade Hub' });
                            state.addLog(`Vault cracked! Found: ${item.name}`);
                            return `Deep storage accessed. Found: ${item.name}`;
                        }
                    }

                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    return "Vault contained raw materials. +35 Salvage.";
                }
            },
            {
                text: "Raid the medical clinic",
                desc: "Heal one injured crew member. +Medical supplies.",
                effect: (state) => {
                    const injured = state.crew.filter(c => c.status === 'INJURED');
                    if (injured.length > 0) {
                        injured[0].status = 'HEALTHY';
                        state.addLog(`Found working medical equipment. ${injured[0].name} healed.`);
                        return `Medical clinic raided. ${injured[0].name} restored to HEALTHY.`;
                    }

                    if (typeof ITEMS !== 'undefined' && ITEMS.MEDKIT) {
                        state.cargo = state.cargo || [];
                        state.cargo.push({ ...ITEMS.MEDKIT, acquiredAt: 'Trade Hub' });
                        return "No injuries to treat. Found: Medkit for later use.";
                    }

                    state.rations = Math.min(state.maxRations, state.rations + 3);
                    return "Clinic picked clean. Found some nutritional supplements. +3 Rations.";
                }
            },
            {
                text: "Access the data broker servers",
                desc: "+Colony knowledge. Reveals sector information.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    state.sectorNodes?.forEach(p => {
                        if (!p.remoteScanned) {
                            p.remoteScanned = true;
                        }
                    });
                    state.addLog("Trade route data recovered. Sector mapping complete.");
                    return "Data servers accessed. All sector planets revealed. Colony knowledge improved.";
                }
            }
        ]
    },

    // --- 6. GHOST STATION ---
    {
        id: 'STATION_GHOST',
        weight: 8,
        title: "THE SILENT STATION",
        getStationName: () => STATION_NAMES[Math.floor(Math.random() * STATION_NAMES.length)],
        context: (name) => `${name} shouldn't exist. It's not on any chart. The design is... wrong. The corridors curve in ways that make no sense. The lights flicker in patterns that almost seem like messages. Something is here. Waiting.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "I cannot identify the station's origin. The architecture predates human spaceflight." },
            { speaker: 'Spc. Vance', text: "We should leave. Now. Every instinct I have is screaming." },
            { speaker: 'Tech Mira', text: "But look at the technology. This could change everything we know." }
        ],
        choices: [
            {
                text: "Explore deeper",
                desc: "DANGEROUS. Unknown rewards. Unknown risks.",
                effect: (state) => {
                    const roll = Math.random();

                    if (roll < 0.25) {
                        // Bad - something follows you back
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 2);
                        });
                        state.addLog("You found something. Or it found you. The crew won't talk about what they saw.");
                        state.addLog("A.U.R.A.: 'I am detecting an additional presence aboard the ship. I cannot locate it.'");
                        return "You explored too deep. All crew +2 Stress. Something came back with you.";
                    } else if (roll < 0.5) {
                        // Great - amazing loot
                        state.salvage = state.maxSalvage;
                        state.energy = 100;
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 5;
                        state.addLog("The station... provided. Resources appeared in your cargo hold. You don't remember taking them.");
                        return "The station gave you gifts. Salvage and Energy MAXIMIZED. Colony knowledge greatly improved.";
                    } else {
                        // Strange - crew changed
                        const crew = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                        if (crew.length > 0) {
                            const changed = crew[Math.floor(Math.random() * crew.length)];
                            changed.stress = 0;
                            changed.tags = changed.tags || [];
                            if (!changed.tags.includes('STATION_TOUCHED')) changed.tags.push('STATION_TOUCHED');
                            state.addLog(`${changed.name} wandered off alone. They came back... calm. Too calm.`);
                            state.addLog(`${changed.name}: "It showed me things. Beautiful things. I'm not afraid anymore."`);
                        }
                        return "Exploration complete. The station changed someone. They seem peaceful now.";
                    }
                }
            },
            {
                text: "Take surface readings and leave",
                desc: "+Colony knowledge. Stay safe.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("Sensor data collected from a safe distance. The readings make no sense, but they're recorded.");
                    return "Surface scan complete. Colony knowledge improved. You left before it noticed you.";
                }
            },
            {
                text: "Flee immediately",
                desc: "No reward. All crew -1 Stress from relief.",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) {
                            c.stress = Math.max(0, c.stress - 1);
                        }
                    });
                    state.addLog("You left. Fast. Nobody argues with the decision.");
                    return "Escaped the ghost station. All crew -1 Stress from relief.";
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
