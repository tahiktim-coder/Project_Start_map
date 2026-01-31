/**
 * DISTRESS SIGNALS - Old recordings and automated beacons
 *
 * NOT living people. These are echoes of the past:
 * - Automated distress beacons from destroyed ships
 * - Corrupted message fragments
 * - Black box recordings
 * - Warning broadcasts
 * - Malfunctioning navigation buoys
 */

const DISTRESS_SIGNAL_ENCOUNTERS = [
    // --- 1. AUTOMATED DISTRESS BEACON ---
    {
        id: 'DISTRESS_BEACON',
        weight: 25,
        title: "AUTOMATED DISTRESS BEACON",
        getSignalAge: () => Math.floor(Math.random() * 40) + 5, // 5-45 years old
        context: (age) => `The signal has been broadcasting for ${age} years. Standard emergency beacon — ship lost power but auto-beacon kept running on backup cells. The ship itself is long dead. The crew... probably the same.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Signal origin: civilian transport. Beacon ID matches the manifest of colony ship 'Hope's Journey.' No rescue recorded." },
            { speaker: 'Dr. Aris', text: "Forty years. They called for help for forty years and nobody came." },
            { speaker: 'Eng. Jaxon', text: "We can't help them. But we can use the beacon's power cells." }
        ],
        choices: [
            {
                text: "Salvage the beacon hardware",
                desc: "+20 Salvage, +10 Energy from power cells.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 10);
                    state.addLog("Beacon hardware recovered. Power cells still holding charge.");
                    return "Beacon salvaged. +20 Salvage, +10 Energy.";
                }
            },
            {
                text: "Download the beacon's log",
                desc: "+1 Colony Knowledge. 30% chance: reveals a planet location.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;

                    if (Math.random() < 0.3) {
                        // Reveal a planet
                        const unrevealed = state.sectorNodes?.filter(p => !p.remoteScanned);
                        if (unrevealed?.length > 0) {
                            unrevealed[0].remoteScanned = true;
                            state.addLog(`Beacon contained navigation data. Planet location revealed.`);
                        }
                    }

                    state.addLog("Downloaded final transmissions. Crew logs... sad reading.");
                    return "Beacon log recovered. Colony knowledge improved.";
                }
            },
            {
                text: "Deactivate and move on",
                desc: "Silence the beacon. No reward, but -1 Stress for crew.",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) {
                            c.stress = Math.max(0, c.stress - 1);
                        }
                    });
                    state.addLog("Beacon silenced. Rest now, whoever you were.");
                    return "Beacon deactivated. All crew -1 Stress from closure.";
                }
            }
        ]
    },

    // --- 2. CORRUPTED MESSAGE FRAGMENT ---
    {
        id: 'DISTRESS_FRAGMENT',
        weight: 20,
        title: "CORRUPTED TRANSMISSION",
        getSignalAge: () => Math.floor(Math.random() * 20) + 2, // 2-22 years old
        context: (age) => `The signal is broken. Fragments of words, static bursts, data corruption. Something happened ${age} years ago, and we're only hearing the echoes. Most of the message is lost forever.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "I can recover some of the data... give me a minute." },
            { speaker: 'A.U.R.A.', text: "Partial reconstruction: '...they're inside the... please... nobody can...' Signal terminates." },
            { speaker: 'Spc. Vance', text: "I've heard enough. We know how this story ends." }
        ],
        choices: [
            {
                text: "Attempt full signal reconstruction",
                desc: "Tech Mira analyzes the data. +1-3 Colony Knowledge, Mira +0-2 Stress.",
                requires: (state) => state.crew.some(c => c.tags?.includes('SPECIALIST') && c.status !== 'DEAD'),
                requiresLabel: "Requires Tech Mira",
                effect: (state) => {
                    const mira = state.crew.find(c => c.tags?.includes('SPECIALIST') && c.status !== 'DEAD');

                    const outcomes = [
                        {
                            log: "Mira: 'I pieced it together. They found something on a moon. Something that found them back.'",
                            stress: 1,
                            knowledge: 2
                        },
                        {
                            log: "Mira: 'Navigation coordinates! They were headed somewhere specific before... before.'",
                            stress: 0,
                            knowledge: 3,
                            reveal: true
                        },
                        {
                            log: "Mira: 'It's just screaming. Hours of screaming. I had to stop listening.'",
                            stress: 2,
                            knowledge: 1
                        }
                    ];

                    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
                    state.addLog(outcome.log);

                    state._colonyKnowledge = (state._colonyKnowledge || 0) + outcome.knowledge;

                    if (mira && outcome.stress > 0) {
                        mira.stress = Math.min(3, (mira.stress || 0) + outcome.stress);
                        if (outcome.stress > 1) {
                            state.addLog(`Tech Mira disturbed by what she heard. +${outcome.stress} Stress.`);
                        }
                    }

                    if (outcome.reveal) {
                        const unrevealed = state.sectorNodes?.filter(p => !p.remoteScanned);
                        if (unrevealed?.length > 0) {
                            unrevealed[0].remoteScanned = true;
                            state.addLog("Coordinates decoded. Planet location revealed.");
                        }
                    }

                    return "Signal reconstructed. " + (outcome.reveal ? "Navigation data recovered." : "No useful data found.");
                }
            },
            {
                text: "Extract technical data only",
                desc: "+15 Salvage from data compression tech. Safe option.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("Extracted transmission hardware protocols. Useful for repairs.");
                    return "Technical data salvaged. +15 Salvage.";
                }
            },
            {
                text: "Ignore and continue",
                desc: "Some messages are better left unheard. No reward.",
                effect: (state) => {
                    state.addLog("Signal ignored. Some mysteries are better left unsolved.");
                    return "Signal bypassed. No action taken.";
                }
            }
        ]
    },

    // --- 3. BLACK BOX RECORDING ---
    {
        id: 'DISTRESS_BLACKBOX',
        weight: 15,
        title: "FLIGHT RECORDER FOUND",
        getSignalAge: () => Math.floor(Math.random() * 30) + 1, // 1-31 years old
        context: (age) => `A ship's black box, drifting in the void. The vessel is gone, but this recorder survived. ${age} years of silence, waiting for someone to find it. Waiting to tell its story.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Flight recorder integrity: 73%. Final hours of vessel operations preserved." },
            { speaker: 'Eng. Jaxon', text: "Someone should know what happened. Even if it's just us." },
            { speaker: 'Dr. Aris', text: "These are the last moments of people's lives. Handle it with respect." }
        ],
        choices: [
            {
                text: "Review the full recording",
                desc: "+3 Colony knowledge. Crew will be affected by what they see.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;

                    // Various endings for the ship
                    const fates = [
                        "Engine failure. They drifted until life support gave out. Took 47 days.",
                        "Something boarded through the cargo hold. The recording ends in darkness.",
                        "Mutiny. Not enough food. Not enough hope. Not enough mercy.",
                        "They made it to a planet. The last transmission is them celebrating. Then silence.",
                        "Navigation error sent them into a gravity well. The screaming lasted 8 minutes."
                    ];

                    const fate = fates[Math.floor(Math.random() * fates.length)];
                    state.addLog(`Black box reviewed: ${fate}`);

                    // Stress increase
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && Math.random() < 0.5) {
                            c.stress = Math.min(3, (c.stress || 0) + 1);
                        }
                    });

                    return "Recording reviewed. Colony knowledge +3. Some crew affected by content.";
                }
            },
            {
                text: "Scan for useful coordinates",
                desc: "+Colony knowledge. May reveal planet data without disturbing content.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;

                    if (Math.random() < 0.5) {
                        const unrevealed = state.sectorNodes?.filter(p => !p.remoteScanned);
                        if (unrevealed?.length > 0) {
                            unrevealed[0].remoteScanned = true;
                            state.addLog("Navigation data extracted from black box. Planet location revealed.");
                            return "Coordinates found. Planet revealed.";
                        }
                    }

                    state.addLog("Technical data extracted. Navigation patterns analyzed.");
                    return "Limited data extracted. Colony knowledge improved.";
                }
            },
            {
                text: "Salvage the hardware",
                desc: "+25 Salvage. The story dies with the recorder.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    state.addLog("Black box hardware salvaged. We'll never know what happened to them.");
                    return "Hardware recovered. +25 Salvage. Recording lost.";
                }
            }
        ]
    },

    // --- 4. MALFUNCTIONING NAVIGATION BUOY ---
    {
        id: 'DISTRESS_BUOY',
        weight: 20,
        title: "MALFUNCTIONING NAV BUOY",
        getSignalAge: () => Math.floor(Math.random() * 15) + 1, // 1-16 years old
        context: (age) => `An old navigation buoy, broadcasting corrupted signals. It's been malfunctioning for ${age} years, sending jumbled coordinates and false emergency codes. Probably just a power fault... probably.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Standard nav buoy. Power core's degraded. Easy fix if we want to bother." },
            { speaker: 'Tech Mira', text: "Wait... these coordinates. They're not random. It's a pattern." },
            { speaker: 'A.U.R.A.', text: "The pattern does not match any known navigation protocol. Curious." }
        ],
        choices: [
            {
                text: "Investigate the pattern",
                desc: "Mira decodes the signal. Could be valuable or dangerous.",
                effect: (state) => {
                    const roll = Math.random();

                    if (roll < 0.3) {
                        // Nothing useful
                        state.addLog("The pattern was just data corruption. Degraded memory banks.");
                        return "Signal analyzed. Just corruption. No useful data.";
                    } else if (roll < 0.7) {
                        // Useful coordinates
                        state.sectorNodes?.forEach(p => p.remoteScanned = true);
                        state.addLog("The buoy contained a complete sector map! All planets revealed.");
                        return "Hidden data cache! All sector planets revealed.";
                    } else {
                        // Something strange
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                        state.addLog("The pattern... it's not machine-generated. Someone reprogrammed this buoy to send a message.");
                        state.addLog("A.U.R.A.: 'The message translates to: DON'T TRUST THE SIGNAL.'");
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        return "Strange message decoded. All crew +1 Stress from ominous warning.";
                    }
                }
            },
            {
                text: "Repair and reactivate",
                desc: "Fix the buoy. +Colony knowledge for future travelers.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.salvage = Math.max(0, state.salvage - 10);
                    state.addLog("Buoy repaired and reactivated. If anyone else comes this way, they'll have guidance.");
                    return "Buoy repaired (-10 Salvage). Future navigation improved.";
                }
            },
            {
                text: "Strip for parts",
                desc: "+18 Salvage, +8 Energy from power core.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 18);
                    state.energy = Math.min(100, state.energy + 8);
                    state.addLog("Nav buoy stripped for components. Power core drained.");
                    return "Buoy salvaged. +18 Salvage, +8 Energy.";
                }
            }
        ]
    },

    // --- 5. LOOPING FINAL MESSAGE ---
    {
        id: 'DISTRESS_LOOP',
        weight: 12,
        title: "REPEATING TRANSMISSION",
        getSignalAge: () => Math.floor(Math.random() * 50) + 10, // 10-60 years old
        context: (age) => `The same message, repeating. Over and over. For ${age} years. Someone recorded their last words and set them to broadcast forever. A voice, crying out into the void, long after the speaker is gone.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Message content: 'If anyone can hear this... tell my daughter I love her. Tell her I tried to come home. Tell her—' Message loops." },
            { speaker: 'Dr. Aris', text: "We can't tell anyone anything. We're as lost as they were." },
            { speaker: 'Spc. Vance', text: "Then we remember. That's all we can do." }
        ],
        choices: [
            {
                text: "Record the message for archives",
                desc: "+1 Colony knowledge. Honor their memory.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;

                    // Crew stress varies
                    const roll = Math.random();
                    if (roll < 0.3) {
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.max(0, (c.stress || 0) - 1);
                        });
                        state.addLog("The message gave us purpose. We're not just surviving. We're carrying their stories.");
                        return "Message archived. Crew found meaning. All crew -1 Stress.";
                    } else if (roll < 0.7) {
                        state.addLog("Message archived. We'll carry their words if we make it somewhere.");
                        return "Message recorded. Colony knowledge improved.";
                    } else {
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("The message made us think about everyone we left behind. Everyone waiting for news that won't come.");
                        return "Message archived. All crew +1 Stress from painful memories.";
                    }
                }
            },
            {
                text: "Trace the signal origin",
                desc: "Find where the transmission came from. May find salvage.",
                effect: (state) => {
                    if (Math.random() < 0.6) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                        state.addLog("Signal origin located. Ship wreckage found. Personal effects salvaged.");
                        return "Wreckage found. +30 Salvage from ship remains.";
                    }

                    state.addLog("Signal origin beyond scanning range. They died somewhere we can't reach.");
                    return "Origin too distant. No salvage possible.";
                }
            },
            {
                text: "End the transmission",
                desc: "Let them rest. Silence the voice. -1 Stress to all crew.",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) {
                            c.stress = Math.max(0, c.stress - 1);
                        }
                    });
                    state.addLog("Transmission silenced. Rest now. You've been calling long enough.");
                    return "Signal ended. All crew -1 Stress. May they find peace.";
                }
            }
        ]
    },

    // --- 6. ALIEN SIGNAL ---
    {
        id: 'DISTRESS_ALIEN',
        weight: 8,
        title: "NON-HUMAN SIGNAL",
        getSignalAge: () => 'UNKNOWN', // Unknowable age
        context: (age) => `The signal doesn't match any human transmission protocol. The pattern is too regular to be natural. Too complex to be simple. Something else made this. Something that was here before us. Or... something that followed us.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "This is... this is impossible. This isn't human technology. This isn't human anything." },
            { speaker: 'A.U.R.A.', text: "I cannot translate the signal. But I can feel it trying to translate me." },
            { speaker: 'Spc. Vance', text: "We should leave. Right now. Whatever sent this... we don't want to meet it." }
        ],
        choices: [
            {
                text: "Attempt to decode",
                desc: "HIGH RISK. Mira works on the alien signal. Unknown consequences.",
                effect: (state) => {
                    const roll = Math.random();

                    if (roll < 0.25) {
                        // Bad
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 2);
                        });
                        state.addLog("The signal... opened. Something looked back at us through the data. We all felt it.");
                        state.addLog("A.U.R.A.: 'I have been... noticed. I do not recommend further contact.'");
                        return "Signal decoded. Something saw us. All crew +2 Stress.";
                    } else if (roll < 0.6) {
                        // Strange but beneficial
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 5;
                        state.sectorNodes?.forEach(p => p.remoteScanned = true);
                        state.addLog("The signal contained star charts. Not from our space. Not from our time. But beautiful.");
                        return "Alien data decoded. Colony knowledge +5. All planets revealed.";
                    } else {
                        // Gift
                        state.energy = 100;
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 50);
                        state.addLog("The signal was a beacon. When we decoded it, something... arrived. Left us resources. Then vanished.");
                        return "Something responded. Energy full. +50 Salvage. We don't know why.";
                    }
                }
            },
            {
                text: "Record without decoding",
                desc: "+2 Colony knowledge. Don't engage, just observe.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("Signal recorded but not decoded. We're not ready for this conversation.");
                    return "Signal archived. Colony knowledge +2. No contact made.";
                }
            },
            {
                text: "Flee immediately",
                desc: "No reward. Some signals shouldn't be answered.",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) {
                            c.stress = Math.max(0, c.stress - 1);
                        }
                    });
                    state.addLog("We ran. Vance was right. Some things are better left alone.");
                    return "Signal ignored. All crew -1 Stress from relief.";
                }
            }
        ]
    }
];

/**
 * Roll for distress signal encounter during scan or warp
 * @param {GameState} state - Current game state
 * @param {string} trigger - 'scan' or 'warp' or 'sector_enter'
 * @returns {Object|null} - Encounter or null
 */
function rollDistressSignal(state, trigger = 'scan') {
    // Base chance varies by trigger - reduced to prevent event fatigue
    let chance = 0;
    switch (trigger) {
        case 'scan':
            chance = 0.04; // 4% on deep scan (was 8%)
            break;
        case 'warp':
            chance = 0.02; // 2% on warp (was 5%)
            break;
        case 'sector_enter':
            chance = 0.08; // 8% on entering new sector (was 15%)
            break;
        default:
            chance = 0.02;
    }

    // Higher chance in later sectors (more ships died out here)
    chance += (state.currentSector - 1) * 0.01; // Reduced from 0.02

    // TEST_MODE always triggers
    if (window.TEST_MODE) {
        chance = 1.0;
    }

    // Only one distress signal per planet visit
    if (state.currentSystem?._distressChecked) {
        return null;
    }

    if (Math.random() > chance) {
        return null;
    }

    // Mark as checked
    if (state.currentSystem) {
        state.currentSystem._distressChecked = true;
    }

    // Select by weight
    const encounters = DISTRESS_SIGNAL_ENCOUNTERS;
    const totalWeight = encounters.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const enc of encounters) {
        roll -= enc.weight;
        if (roll <= 0) {
            return enc;
        }
    }

    return encounters[0];
}

// Export
if (typeof window !== 'undefined') {
    window.DISTRESS_SIGNAL_ENCOUNTERS = DISTRESS_SIGNAL_ENCOUNTERS;
    window.rollDistressSignal = rollDistressSignal;
}
