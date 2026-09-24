/**
 * DISTRESS SIGNALS - Old recordings and automated beacons
 *
 * NOT living people. These are echoes of hulls that went this way before us:
 * - Automated distress beacons from dead Exodus hulls
 * - Corrupted message fragments
 * - Flight recorders
 * - Nav buoys dropped to mark the heading
 * - One hail that is our own
 *
 * The age passed to context() is scaled by the runtime to the sector (App.getSignalAge):
 * about twenty years in sector 1, about four hundred by sector 6. The getSignalAge
 * closures below are kept for the signature; their numbers are not used.
 */

const DISTRESS_SIGNAL_ENCOUNTERS = [
    // --- 1. AUTOMATED DISTRESS BEACON ---
    {
        id: 'DISTRESS_BEACON',
        weight: 25,
        title: "AUTOMATED DISTRESS BEACON",
        getSignalAge: () => Math.floor(Math.random() * 40) + 5,
        context: (age) => `A beacon, calling for ${age} years on backup cells. Standard Exodus emergency code. The hull behind it is dark. Nobody ever answered.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "An Exodus hull, Commander. Crew of four on the register. No answer was ever logged." },
            { speaker: 'Dr. Aris', text: "Then we answer. Names first." },
            { speaker: 'Eng. Jaxon', text: "The cells are still warm. Call it the Nightlight." }
        ],
        choices: [
            {
                text: "Take the cells",
                desc: "+20 Salvage, +10 Energy. The beacon stops. Aris +1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 10);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("Cells pulled. The beacon stops mid-code. Dr. Aris asks for the register. There isn't time.");
                    return "Beacon stripped. +20 Salvage, +10 Energy. Aris +1 Stress.";
                }
            },
            {
                text: "Copy the log",
                desc: "-5 Energy. +1 Data. 30% chance: one planet revealed.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    if (Math.random() < 0.3) {
                        const unrevealed = state.sectorNodes?.filter(p => !p.remoteScanned);
                        if (unrevealed?.length > 0) {
                            unrevealed[0].remoteScanned = true;
                            state.addLog("The beacon kept a fix on the nearest body. One planet on the map.");
                        }
                    }
                    state.addLog("BEACON LOG: 'Four aboard, per the register. Five of us, per the galley.' Then the code, on repeat.");
                    return "Log copied. -5 Energy, +1 Data.";
                }
            },
            {
                text: "Answer it, then switch it off",
                desc: "-1 Ration: a day on station. +1 Data. Aris reads the four names. Aris -1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    state.addLog("A.U.R.A. sends the acknowledgement. Dr. Aris reads the four names off the register, then adds a line for the fifth.");
                    state.addLog("Dr. Aris: \"Heard. All of you. You can stop now.\" The beacon goes quiet.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Answered a beacon nobody answered');
                    state.noteStanding && state.noteStanding('aris');
                    return "Beacon answered and silenced. -1 Ration, +1 Data. Aris -1 Stress.";
                }
            }
        ]
    },

    // --- 2. CORRUPTED MESSAGE FRAGMENT ---
    {
        id: 'DISTRESS_FRAGMENT',
        weight: 20,
        title: "CORRUPTED TRANSMISSION",
        getSignalAge: () => Math.floor(Math.random() * 20) + 2,
        context: (age) => `A broken signal. Words, static, words. Sent ${age} years ago. Most of it is gone. The part that is left keeps saying a number.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "I can rebuild some of it. Aura, help me. She's better at this than I am." },
            { speaker: 'A.U.R.A.', text: "Part rebuilt, Commander: '...register says four... there are... please...' Then nothing." },
            { speaker: 'Spc. Vance', text: "I know how that sentence ends." }
        ],
        choices: [
            {
                text: "Let Mira and A.U.R.A. rebuild it",
                desc: "-5 Energy. +1-3 Data. Mira +0-2 Stress. May reveal one planet.",
                requires: (state) => state.crew.some(c => c.tags?.includes('SPECIALIST') && c.status !== 'DEAD'),
                requiresLabel: "Requires Tech Mira",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const mira = state.crew.find(c => c.tags?.includes('SPECIALIST') && c.status !== 'DEAD');
                    const outcomes = [
                        {
                            log: "Tech Mira: 'It's a wreck report. A hull with a higher number than theirs. That's the whole message, over and over.'",
                            stress: 1,
                            knowledge: 2
                        },
                        {
                            log: "Tech Mira: 'Coordinates. They were making for a light. Aura, is that a star?' A.U.R.A.: 'It is on no chart, Commander.'",
                            stress: 0,
                            knowledge: 3,
                            reveal: true
                        },
                        {
                            log: "Tech Mira: 'It's a count. Somebody counting the crew, out loud. They keep getting five.'",
                            stress: 2,
                            knowledge: 1
                        }
                    ];
                    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
                    state.addLog(outcome.log);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + outcome.knowledge;
                    if (mira && outcome.stress > 0) {
                        mira.stress = Math.min(3, (mira.stress || 0) + outcome.stress);
                    }
                    if (outcome.reveal) {
                        const unrevealed = state.sectorNodes?.filter(p => !p.remoteScanned);
                        if (unrevealed?.length > 0) {
                            unrevealed[0].remoteScanned = true;
                            state.addLog("Coordinates plotted. One planet on the map.");
                        }
                    }
                    state.noteStanding && state.noteStanding('mira');
                    return `Signal rebuilt. -5 Energy, +${outcome.knowledge} Data.` + (outcome.stress ? ` Mira +${outcome.stress} Stress.` : '');
                }
            },
            {
                text: "Strip the transmitter code only",
                desc: "+15 Salvage. The words are lost. Mira +1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    const mira = state.crew.find(c => c.tags?.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Transmitter protocols copied for repairs. Whatever they were saying, they've stopped.");
                    return "Code stripped. +15 Salvage. Mira +1 Stress.";
                }
            },
            {
                text: "Log the source and go",
                desc: "+1 Data. Nobody listens to the rest. Vance -1 Stress.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const vance = state.crew.find(c => c.tags?.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("Source bearing logged. Spc. Vance switches the speaker off himself.");
                    return "Source logged. +1 Data. Vance -1 Stress.";
                }
            }
        ]
    },

    // --- 3. FLIGHT RECORDER ---
    {
        id: 'DISTRESS_BLACKBOX',
        weight: 15,
        title: "FLIGHT RECORDER FOUND",
        getSignalAge: () => Math.floor(Math.random() * 30) + 1,
        context: (age) => `A flight recorder, drifting. The hull that carried it is gone. It has been quiet for ${age} years. Everything it kept, it still keeps.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Recorder at seventy-three percent, Commander. The last hours are whole." },
            { speaker: 'Eng. Jaxon', text: "Somebody should know what happened. Even if it's just us." },
            { speaker: 'Dr. Aris', text: "It's people's last hours. We do it properly. Names, then the rest." }
        ],
        choices: [
            {
                text: "Play it all the way through",
                desc: "-5 Energy. +3 Data. 50% chance each crew member +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    const fates = [
                        "Scrubbers failed. Forty-seven days. They wrote the day's number on the wall each morning.",
                        "They landed. The last entry is singing. Then nothing, for a long time.",
                        "A ration count that came out wrong. Nobody won the argument.",
                        "'The ship says four. There are five of us. We stopped arguing with it.'",
                        "Came in too steep. Eight minutes. The pilot reads the checklist to the end."
                    ];
                    const fate = fates[Math.floor(Math.random() * fates.length)];
                    state.addLog(`RECORDER: ${fate}`);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && Math.random() < 0.5) {
                            c.stress = Math.min(3, (c.stress || 0) + 1);
                        }
                    });
                    state.addLog("Dr. Aris reads the names off the crew tab first. Then she lets it play.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Heard a recorder to the end');
                    state.noteStanding && state.noteStanding('aris');
                    return "Recorder played through. -5 Energy, +3 Data.";
                }
            },
            {
                text: "Pull only the nav track",
                desc: "-5 Energy. +1 Data. 50% chance: one planet revealed.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    if (Math.random() < 0.5) {
                        const unrevealed = state.sectorNodes?.filter(p => !p.remoteScanned);
                        if (unrevealed?.length > 0) {
                            unrevealed[0].remoteScanned = true;
                            state.addLog("Nav track copied. Same heading as ours, to the degree. One planet on the map.");
                            return "Nav track copied. -5 Energy, +1 Data. One planet revealed.";
                        }
                    }
                    state.addLog("Nav track copied. Same heading as ours, to the degree.");
                    return "Nav track copied. -5 Energy, +1 Data.";
                }
            },
            {
                text: "Strip the casing",
                desc: "+25 Salvage. The recording is lost. Aris +1 Stress, Jaxon +1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    state.addLog("Casing cut for the alloy. The crystal cracked on the way out. Nobody will know now.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Broke a recorder for its casing');
                    return "Casing stripped. +25 Salvage. Aris +1 Stress, Jaxon +1 Stress.";
                }
            }
        ]
    },

    // --- 4. NAV BUOY ---
    {
        id: 'DISTRESS_BUOY',
        weight: 20,
        title: "MALFUNCTIONING NAV BUOY",
        getSignalAge: () => Math.floor(Math.random() * 15) + 1,
        context: (age) => `A nav buoy, dropped by a hull to mark the way. Broken for ${age} years. It sends a heading, then garbage, then the heading again.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Standard buoy. Core's tired. I can fix it if we want to bother." },
            { speaker: 'Tech Mira', text: "And here we see the heading, Commander. Same as ours. Aura checked twice." },
            { speaker: 'Spc. Vance', text: "Every buoy out here points the same way. I've counted six." }
        ],
        choices: [
            {
                text: "Read the garbage",
                desc: "-5 Energy. 40% chance: all planets revealed. 30% chance: +2 Data, all crew +1 Stress. Else nothing.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const roll = Math.random();
                    if (roll < 0.3) {
                        state.addLog("The garbage is garbage. Tired memory, nothing more.");
                        return "Just corruption. -5 Energy.";
                    }
                    if (roll < 0.7) {
                        state.sectorNodes?.forEach(p => p.remoteScanned = true);
                        state.addLog("Under the garbage, a full sector chart. Every body plotted. All planets on the map.");
                        return "Sector chart recovered. -5 Energy. All planets revealed.";
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("The garbage is a list. Somebody re-cut the buoy to carry it.");
                    state.addLog("A.U.R.A.: 'Hull numbers, Commander. In order. It goes up past forty thousand. Ours is not on it.'");
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    return "A list of hulls, going up. -5 Energy, +2 Data. All crew +1 Stress.";
                }
            },
            {
                text: "Fix it for whoever comes next",
                desc: "-10 Salvage. +2 Data. Jaxon -1 Stress.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.salvage = Math.max(0, state.salvage - 10);
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.max(0, (jaxon.stress || 0) - 1);
                    state.addLog("Eng. Jaxon: \"New core, clean heading. Somebody'll thank us.\" He names it the Lamp Post.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Repaired a buoy for the next ship');
                    state.noteStanding && state.noteStanding('jaxon');
                    return "Buoy repaired. -10 Salvage, +2 Data. Jaxon -1 Stress.";
                }
            },
            {
                text: "Strip it",
                desc: "+18 Salvage, +8 Energy. The heading goes dark. Mira +1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 18);
                    state.energy = Math.min(100, state.energy + 8);
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Buoy stripped. Core drained. Tech Mira: 'Aura says the heading's gone from the channel. She noticed.'");
                    return "Buoy stripped. +18 Salvage, +8 Energy. Mira +1 Stress.";
                }
            }
        ]
    },

    // --- 5. LOOPING FINAL MESSAGE ---
    {
        id: 'DISTRESS_LOOP',
        weight: 12,
        title: "REPEATING TRANSMISSION",
        getSignalAge: () => Math.floor(Math.random() * 50) + 10,
        context: (age) => `One message, on a loop, for ${age} years. Somebody set their last words to repeat and left them running. The voice is calm.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "'Tell my brother I got further than eight. Tell him—' It loops there, Commander." },
            { speaker: 'Dr. Aris', text: "We can't tell anybody anything. We're as far out as they were." },
            { speaker: 'Spc. Vance', text: "Then we write it down. Exactly. Every word." }
        ],
        choices: [
            {
                text: "Record it, word for word",
                desc: "-5 Energy. +1 Data. Vance -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("Spc. Vance writes it out by hand and reads it back to the speaker. Twice. It matches.");
                    state.noteStanding && state.noteStanding('vance');
                    return "Message recorded, exactly. -5 Energy, +1 Data. Vance -1 Stress.";
                }
            },
            {
                text: "Trace it to the hull",
                desc: "-10 Energy. 60% chance: +30 Salvage. Aris +1 Stress: personal things.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (Math.random() < 0.6) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                        state.addLog("Source found. A hull, dark. Personal lockers, opened. Dr. Aris takes the name tags before we take the rest.");
                        return "Hull found and stripped. -10 Energy, +30 Salvage. Aris +1 Stress.";
                    }
                    state.addLog("Source is out of range. They died somewhere we can't reach.");
                    return "Too far. Nothing found. -10 Energy. Aris +1 Stress.";
                }
            },
            {
                text: "Switch it off",
                desc: "-1 Ration: a day to reach it. The voice stops. Aris reads the name. Aris -1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    state.addLog("Dr. Aris reads the name off the transmitter plate. \"Heard. You got further than eight. Rest now.\" Then the switch.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Let a voice rest');
                    state.noteStanding && state.noteStanding('aris');
                    return "Transmission ended. -1 Ration. Aris -1 Stress.";
                }
            }
        ]
    },

    // --- 6. OUR OWN HAIL ---
    {
        id: 'DISTRESS_ALIEN',
        weight: 8,
        title: "OUR OWN HAIL",
        getSignalAge: () => 'UNKNOWN',
        context: (age) => `It is our own hail. Our callsign, our handshake, our crew count, sent back to us. One thing is different: it arrived before we sent it.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "That is us. That is our exact hail. I recorded it this morning." },
            { speaker: 'A.U.R.A.', text: "It is our hail, Commander. Returned. I did not send it, and it is older than we are." },
            { speaker: 'Spc. Vance', text: "Then something out there has already heard us." }
        ],
        choices: [
            {
                text: "Play it back in full",
                desc: "-5 Energy. 25% chance: all crew +2 Stress. 35% chance: +5 Data, all planets revealed. Else +3 Data.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const roll = Math.random();
                    if (roll < 0.25) {
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 2);
                        });
                        state.addLog("It says our names back. Jaxon. Aris. Vance. Mira. Then it says: four crew. Then it stops.");
                        state.addLog("A.U.R.A.: 'That is my voice, Commander. I have never said that.'");
                        return "It knows our names. -5 Energy. All crew +2 Stress.";
                    }
                    if (roll < 0.6) {
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 5;
                        state.sectorNodes?.forEach(p => p.remoteScanned = true);
                        state.addLog("Behind our hail, every transponder in the sector, read out in order. All of them ours. All of them old.");
                        return "Every transponder in the sector, read to us. -5 Energy, +5 Data. All planets revealed.";
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    state.addLog("Our hail, and then one word added on the end, in A.U.R.A.'s voice: home.");
                    state.addLog("Tech Mira: 'She would never say that. Would you?' A.U.R.A.: 'No, Commander.'");
                    return "One word added to our hail. -5 Energy, +3 Data.";
                }
            },
            {
                text: "Record it, don't play it",
                desc: "+2 Data. Mira +1 Stress: she wants to hear it.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Recorded, sealed, not played. Tech Mira: 'Aura wants to hear it too. She won't say so.'");
                    return "Hail recorded, unheard. +2 Data. Mira +1 Stress.";
                }
            },
            {
                text: "Burn away",
                desc: "-10 Energy. Nothing heard. Vance -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("We burned. Spc. Vance watched the signal strength fall off and counted it down to nothing.");
                    return "Burned away from our own hail. -10 Energy. Vance -1 Stress.";
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
