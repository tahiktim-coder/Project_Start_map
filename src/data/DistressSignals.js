/**
 * DISTRESS SIGNALS - Old recordings and automated beacons
 *
 * NOT living people. These are echoes of hulls that went this way before us:
 * - Automated distress beacons from dead Exodus hulls
 * - Corrupted message fragments
 * - Flight recorders
 * - Nav buoys dropped to mark the heading
 * - One distress call that is our own, arriving before we ever sent it
 *
 * The age passed to context() is scaled by the runtime to the sector (App.getSignalAge):
 * about twenty years in sector 1, about four hundred by sector 6. The getSignalAge
 * closures below are kept for the signature; their numbers are not used.
 *
 * Writing rules for this file: docs/STYLE.md. Plain sentences, no nicknames, no riddles.
 */

const DISTRESS_SIGNAL_ENCOUNTERS = [
    // --- 1. AUTOMATED DISTRESS BEACON ---
    {
        id: 'DISTRESS_BEACON',
        weight: 25,
        title: "AUTOMATED DISTRESS BEACON",
        getSignalAge: () => Math.floor(Math.random() * 40) + 5,
        context: (age) => `A distress beacon, calling for ${age} years on backup power. Standard Exodus emergency code. The ship behind it is dark. Nobody ever answered.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "It's an Exodus ship, Commander. No reply to it was ever logged." },
            { speaker: 'Dr. Aris', text: "Then we'll be the ones who answer. And I want their names." },
            { speaker: 'Eng. Jaxon', text: "Those backup cells are still charged. We could use them." }
        ],
        choices: [
            {
                text: "Take the power cells",
                desc: "+20 Salvage, +10 Energy. The beacon stops. Aris +1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 10);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("Cells pulled. The beacon cuts off mid-call. Nobody has time to copy the crew's names.");
                    return "Beacon stripped. +20 Salvage, +10 Energy. Aris +1 Stress.";
                }
            },
            {
                text: "Copy the beacon's log",
                desc: "-5 Energy. +1 Data. 30% chance: one planet revealed.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    if (Math.random() < 0.3) {
                        const unrevealed = state.sectorNodes?.filter(p => !p.remoteScanned);
                        if (unrevealed?.length > 0) {
                            unrevealed[0].remoteScanned = true;
                            state.addLog("The beacon had a fix on the nearest planet. One planet added to the map.");
                        }
                    }
                    state.addLog("BEACON LOG: 'Engine failure. Drifting. The computer says help is on the way.' Then the call repeats.");
                    return "Log copied. -5 Energy, +1 Data.";
                }
            },
            {
                text: "Answer it, then switch it off",
                desc: "-1 Ration: a day beside it. +1 Data. Aris -1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    state.addLog("A.U.R.A. sends a reply. Their crew's names are read aloud over the channel.");
                    if (aris) state.addLog("Dr. Aris: \"We heard you. You can rest now.\" The beacon goes quiet.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Answered a beacon nobody answered');
                    state.noteStanding && state.noteStanding('aris');
                    return "Beacon answered and switched off. -1 Ration, +1 Data. Aris -1 Stress.";
                }
            }
        ]
    },

    // --- 2. CORRUPTED MESSAGE FRAGMENT ---
    {
        id: 'DISTRESS_FRAGMENT',
        weight: 20,
        title: "DAMAGED MESSAGE",
        getSignalAge: () => Math.floor(Math.random() * 20) + 2,
        context: (age) => `A damaged signal: words, static, then more words. Sent ${age} years ago. Most of it is lost. The part that's left keeps repeating one sentence.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "I can rebuild some of it. Aura, will you help? You're better at this than me." },
            { speaker: 'A.U.R.A.', text: "Partly rebuilt, Commander: '...this is hull... we are not the ninth... please...' Then nothing." },
            { speaker: 'Spc. Vance', text: "Not the ninth. So they were told the same thing we were." }
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
                            log: "Tech Mira: 'It's a list of wrecks they passed. Each one they found was older than the last.'",
                            stress: 1,
                            knowledge: 2
                        },
                        {
                            log: "Tech Mira: 'Coordinates. They were heading for a bright light. Aura, is that a star?' A.U.R.A.: 'It is not on any chart, Mira.'",
                            stress: 0,
                            knowledge: 3,
                            reveal: true
                        },
                        {
                            log: "Tech Mira: 'It's someone saying goodbye to their family. Just their names, over and over.'",
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
                            state.addLog("Coordinates plotted. One planet added to the map.");
                        }
                    }
                    state.noteStanding && state.noteStanding('mira');
                    return `Message rebuilt. -5 Energy, +${outcome.knowledge} Data.` + (outcome.stress ? ` Mira +${outcome.stress} Stress.` : '');
                }
            },
            {
                text: "Copy the transmitter code only",
                desc: "+15 Salvage. The message is lost. Mira +1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    const mira = state.crew.find(c => c.tags?.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Transmitter code copied for our own repairs. Whatever they were saying is gone.");
                    return "Code copied. +15 Salvage. Mira +1 Stress.";
                }
            },
            {
                text: "Log where it came from and go",
                desc: "+1 Data. Nobody hears the rest. Vance -1 Stress.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const vance = state.crew.find(c => c.tags?.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    if (vance) state.addLog("Source direction logged. Spc. Vance switches off the speaker himself.");
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
        context: (age) => `A flight recorder, drifting alone. The ship that carried it is gone. It has been silent for ${age} years, but its memory is intact.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "The recorder is seventy-three percent intact, Commander. The last hours are complete." },
            { speaker: 'Eng. Jaxon', text: "If this were us, I'd want someone to listen. So let's listen." },
            { speaker: 'Dr. Aris', text: "These are people's last hours. We'll do it properly. Names first." }
        ],
        choices: [
            {
                text: "Play it all the way through",
                desc: "-5 Energy. +3 Data. 50% chance for each crew member: +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    const fates = [
                        "The water recycler broke. They lasted forty-seven days, and marked each one on the wall.",
                        "They landed. The last recording is people singing. Then silence.",
                        "An argument about who gets the last of the food. Nobody wins it.",
                        "'The computer keeps saying we're on schedule. We stopped believing it months ago.'",
                        "An engine fire. The pilot stays calm and reads the checklist to the very end."
                    ];
                    const fate = fates[Math.floor(Math.random() * fates.length)];
                    state.addLog(`RECORDER: ${fate}`);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && Math.random() < 0.5) {
                            c.stress = Math.min(3, (c.stress || 0) + 1);
                        }
                    });
                    state.addLog("The crew's names are read first. Then the recording plays.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Heard a recorder to the end');
                    state.noteStanding && state.noteStanding('aris');
                    return "Recorder played through. -5 Energy, +3 Data.";
                }
            },
            {
                text: "Copy only the navigation track",
                desc: "-5 Energy. +1 Data. 50% chance: one planet revealed.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    if (Math.random() < 0.5) {
                        const unrevealed = state.sectorNodes?.filter(p => !p.remoteScanned);
                        if (unrevealed?.length > 0) {
                            unrevealed[0].remoteScanned = true;
                            state.addLog("Navigation track copied. Exactly the same heading as ours. One planet added to the map.");
                            return "Navigation track copied. -5 Energy, +1 Data. One planet revealed.";
                        }
                    }
                    state.addLog("Navigation track copied. Exactly the same heading as ours.");
                    return "Navigation track copied. -5 Energy, +1 Data.";
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
                    state.addLog("Casing cut off for the metal. The memory chip cracked on the way out. Nobody will ever hear it now.");
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
        title: "BROKEN NAVIGATION BUOY",
        getSignalAge: () => Math.floor(Math.random() * 15) + 1,
        context: (age) => `A navigation buoy, dropped by an earlier ship to mark the route. Broken for ${age} years. It sends a heading, then garbage, then the heading again.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Standard buoy. The core's worn out. I can fix it if we want to." },
            { speaker: 'Tech Mira', text: "Its heading is exactly the same as ours, Commander. Aura checked it twice." },
            { speaker: 'Spc. Vance', text: "Every buoy we've found points the same way. Nobody went anywhere else." }
        ],
        choices: [
            {
                text: "Decode the garbage",
                desc: "-5 Energy. 40% chance: all planets revealed. 30% chance: +2 Data, all crew +1 Stress. Otherwise nothing.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const roll = Math.random();
                    if (roll < 0.3) {
                        state.addLog("The garbage is just damaged memory. There's nothing in it.");
                        return "Nothing but damaged data. -5 Energy.";
                    }
                    if (roll < 0.7) {
                        state.sectorNodes?.forEach(p => p.remoteScanned = true);
                        state.addLog("Under the garbage is a full map of the sector. All planets added to the map.");
                        return "Sector map recovered. -5 Energy. All planets revealed.";
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("The garbage is a list. Someone reprogrammed the buoy to carry it.");
                    state.addLog("A.U.R.A.: 'They are hull numbers, Commander. Thousands of them, in order. Ours is not among them.'");
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    return "A list of thousands of ships. -5 Energy, +2 Data. All crew +1 Stress.";
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
                    if (jaxon) state.addLog("Eng. Jaxon: \"New core, clean heading. Somebody will be glad of it.\"");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Repaired a buoy for the next ship');
                    state.noteStanding && state.noteStanding('jaxon');
                    return "Buoy repaired. -10 Salvage, +2 Data. Jaxon -1 Stress.";
                }
            },
            {
                text: "Strip it",
                desc: "+18 Salvage, +8 Energy. The buoy goes dark. Mira +1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 18);
                    state.energy = Math.min(100, state.energy + 8);
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Buoy stripped, core drained.");
                    if (mira) state.addLog("Tech Mira: 'The next ship won't have a buoy to follow now.'");
                    return "Buoy stripped. +18 Salvage, +8 Energy. Mira +1 Stress.";
                }
            }
        ]
    },

    // --- 5. LOOPING FINAL MESSAGE ---
    {
        id: 'DISTRESS_LOOP',
        weight: 12,
        title: "REPEATING MESSAGE",
        getSignalAge: () => Math.floor(Math.random() * 50) + 10,
        context: (age) => `One message, playing on a loop for ${age} years. Someone recorded their last words and left them running. The voice is calm.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "'Tell my brother I got further than the eight before us. Tell him—' It repeats from there, Commander." },
            { speaker: 'Dr. Aris', text: "We can't tell anyone anything. We're as far from home as they were." },
            { speaker: 'Spc. Vance', text: "Then we write it down. Exactly as they said it." }
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
                    if (vance) state.addLog("Spc. Vance writes it out by hand, then checks it against the recording. It matches.");
                    state.noteStanding && state.noteStanding('vance');
                    return "Message recorded exactly. -5 Energy, +1 Data. Vance -1 Stress.";
                }
            },
            {
                text: "Trace it to the ship",
                desc: "-10 Energy. 60% chance: +30 Salvage. Aris +1 Stress: it means opening their lockers.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (Math.random() < 0.6) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                        state.addLog("Source found: a dark ship. We open the personal lockers, but the name tags are set aside first.");
                        return "Ship found and stripped. -10 Energy, +30 Salvage. Aris +1 Stress.";
                    }
                    state.addLog("The source is out of range. They died somewhere we can't reach.");
                    return "Too far away. Nothing found. -10 Energy. Aris +1 Stress.";
                }
            },
            {
                text: "Switch it off",
                desc: "-1 Ration: a day to reach it. The voice stops. Aris -1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    if (aris) state.addLog("Dr. Aris reads the name on the transmitter. \"Your brother would be proud of you.\" Then she switches it off.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Let a voice rest');
                    state.noteStanding && state.noteStanding('aris');
                    return "Message switched off. -1 Ration. Aris -1 Stress.";
                }
            }
        ]
    },

    // --- 6. OUR OWN DISTRESS CALL ---
    {
        id: 'DISTRESS_ALIEN',
        weight: 8,
        title: "OUR OWN DISTRESS CALL",
        getSignalAge: () => 'UNKNOWN',
        context: (age) => `It's a distress call from our own ship: our name, our call sign, our crew list. It has arrived before we ever sent it.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "That's our call sign. We never sent that." },
            { speaker: 'A.U.R.A.', text: "It matches our emergency call exactly, Commander. I have not sent one. The signal is very old." },
            { speaker: 'Spc. Vance', text: "Then someone out there already knows who we are." }
        ],
        choices: [
            {
                text: "Play the whole call",
                desc: "-5 Energy. 25% chance: all crew +2 Stress. 35% chance: +5 Data, all planets revealed. Otherwise +3 Data.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const roll = Math.random();
                    if (roll < 0.25) {
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 2);
                        });
                        state.addLog("It reads out our crew list: Jaxon, Aris, Vance, Mira. Four crew. The Commander's name isn't on it.");
                        state.addLog("A.U.R.A.: 'That is my voice, Commander. But I have never recorded this message.'");
                        return "Our own call, with our names in it. -5 Energy. All crew +2 Stress.";
                    }
                    if (roll < 0.6) {
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 5;
                        state.sectorNodes?.forEach(p => p.remoteScanned = true);
                        state.addLog("After our call come the calls of every ship in this sector, one by one. All Exodus ships. All very old.");
                        return "Every ship's call in the sector, played to us. -5 Energy, +5 Data. All planets revealed.";
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    state.addLog("At the end of our call there's one extra word, in A.U.R.A.'s voice: 'home.'");
                    state.addLog("Tech Mira: 'Aura, did you say that?' A.U.R.A.: 'No, Mira. I have never put that word in a message.'");
                    return "One extra word at the end of our call. -5 Energy, +3 Data.";
                }
            },
            {
                text: "Record it, but don't play it",
                desc: "+2 Data. Mira +1 Stress: she wants to hear it.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Recorded and sealed, never played.");
                    if (mira) state.addLog("Tech Mira: 'I just want to know what it says, Commander.'");
                    return "Call recorded, not played. +2 Data. Mira +1 Stress.";
                }
            },
            {
                text: "Fly away from it",
                desc: "-10 Energy. Nobody hears it. Vance -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    if (vance) state.addLog("We burned away. Spc. Vance watched the signal fade until it was gone.");
                    return "We flew away from our own distress call. -10 Energy. Vance -1 Stress.";
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
