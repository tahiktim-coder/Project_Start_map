/**
 * CAMPFIRE EVENTS — The talks between sectors. They happen DURING the warp transition.
 *
 * DESIGN:
 * - Problems and questions mid-warp; every choice has a real, stated effect
 * - Short: one or two sentences of context, then the crew in their habits, one line at a time
 * - Shows after the warp dialogue, before entering the new sector
 * - The "signal" the ship steers by is the field of dead Exodus transponders on our own channel
 *   (docs/CANON.md). Nothing broadcasts to us. Nothing follows us.
 *
 * PRIORITY:
 * - 3 = Always fires for this sector (guaranteed event)
 * - 2 = Common (fires if conditions met)
 * - 1 = Rare/fallback
 *
 * NOTE: App.showCampfireEvent runs while state.currentSector is still the sector we are leaving.
 */
const CAMPFIRE_EVENTS = [
    // ═══════════════════════════════════════════════════════════════
    // SECTOR 1 → 2: Early game - resource management lessons
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_POWER_SURGE',
        sectorRange: [1, 1],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: POWER SURGE ///",
        context: `Mid-warp, a conduit overloads. Sparks across engineering.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Kettle's boiling over. Capacitor bank, not the core. I can save her or strip her." },
            { speaker: 'A.U.R.A.', text: "Reroute costs ten units of charge, Commander. Burn it out and we keep the parts." },
            { speaker: 'Spc. Vance', text: "Ten now, or five a warp. Three warps a sector. Do the sum." }
        ],
        choices: [
            {
                text: "Reroute. Save the kettle.",
                desc: "-10 Energy. Nothing else is lost.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    return "Power rerouted. Ten units gone, the capacitors whole. Jaxon pats the kettle.";
                }
            },
            {
                text: "Let it burn. Keep the parts.",
                desc: "+15 Salvage. -5 Energy on every warp until the next sector.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state._damagedCapacitors = state.currentSector + 1; // the sector we are jumping into; read by GameState.getWarpCost
                    return "Parts salvaged. Jaxon: 'Parts are parts. She'll drink for it till we're through the next sector.'";
                }
            }
        ]
    },
    {
        id: 'CF_STOWAWAY_SIGNAL',
        sectorRange: [1, 2],
        priority: 2,
        condition: (state) => state.salvage >= 20,
        title: "/// WARP INCIDENT: SOMETHING IN THE HOLD ///",
        context: `A transponder in the salvage hold has woken up. It is squawking a hull number on our channel.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "And here we see a transponder, twenty years dead, waking up because it can hear us." },
            { speaker: 'Eng. Jaxon', text: "Things that squawk get a name. Cricket. Cricket stays or Cricket goes, Commander." },
            { speaker: 'A.U.R.A.', text: "I can read its memory, Commander. Thirty percent chance it discharges into the hold when I do." }
        ],
        choices: [
            {
                text: "Read it.",
                desc: "+1 Data. 30% chance of -15 Energy.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    if (Math.random() < 0.3) {
                        state.energy = Math.max(0, state.energy - 15);
                        return "Cricket discharged into the hold. We have its memory, and fifteen units less charge. (+1 Data, -15 Energy)";
                    }
                    return "Cricket's memory holds one course. Ours, to the decimal. (+1 Data)";
                }
            },
            {
                text: "Strip the casing. Drop the rest.",
                desc: "+5 Salvage. Nothing learned.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 5);
                    return "Cricket goes out the lock, still squawking. Mira watches it until it is gone. (+5 Salvage)";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 2 → 3: The burn stalls (TheThrow), then the transponders
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_SIGNAL_INTERFERENCE',
        sectorRange: [2, 2],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: OUR CHANNEL ///",
        context: `The burn is finishing. The navigation array has locked onto contacts ahead. Hundreds, all on our channel.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Three hundred transponders ahead, Commander, all on our channel. They line up. I can steer by them." },
            { speaker: 'Tech Mira', text: "Like runway lights. She's not wrong, Commander. She's never wrong about a line." },
            { speaker: 'Spc. Vance', text: "Runway lights answer when you call. Three hundred, and none of them answer. I'll get the exact number." }
        ],
        choices: [
            {
                text: "Hold our own course.",
                desc: "-15 Energy: fighting the autopilot the whole way in.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 15);
                    state.noteStanding && state.noteStanding('vance');
                    return "Course held. Vance: 'Noted.' He starts counting. (-15 Energy)";
                }
            },
            {
                text: "Let them carry us in.",
                desc: "+10 Energy: a clean burn down the line. A.U.R.A. flies the corridor from here.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 10);
                    state._followedSignal = true;
                    state.noteStanding && state.noteStanding('mira');
                    return "A.U.R.A.: 'Thank you, Commander. It is a very straight line.' (+10 Energy)";
                }
            }
        ]
    },
    {
        id: 'CF_CREW_NIGHTMARE',
        sectorRange: [2, 3],
        priority: 2,
        condition: (state) => state.crew.some(c => c.status !== 'DEAD' && (c.stress || 0) >= 2),
        title: "/// WARP INCIDENT: THE SAME DREAM ///",
        context: `Three of the crew wake in the same second. Same dream: a room too big, then too small. A sun on the wall with no heat in it.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Three vitals spiked together, Commander. I can sedate, or Dr. Aris can take it down." },
            { speaker: 'Dr. Aris', text: "If three people dream it, it's a fact, not a dream. I'll write it down. All of it." },
            { speaker: 'Eng. Jaxon', text: "Don't write mine down. Mine had grass in it. Then it didn't." }
        ],
        choices: [
            {
                text: "Sedate them.",
                desc: "All crew -1 Stress. -2 Rations: the sedatives are in the medical kits.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 2);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.max(0, (c.stress || 0) - 1);
                    });
                    return "The crew sleeps through to the burn. Nobody dreams. (-2 Rations, all crew -1 Stress)";
                }
            },
            {
                text: "Let Aris write it down.",
                desc: "+2 Data. Nobody sleeps: the stress stays.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    return "Three accounts, one room, one sun. Aris files it under facts. (+2 Data)";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 3 → 4: Ship strain, and the question
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_HULL_STRESS',
        sectorRange: [3, 3],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: HULL FRACTURES ///",
        context: `Alarms. The hull is cracking along the ribs from the repeated jumps.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Hull strength ninety-four percent, Commander. Full patch, ribs only, or fly as we are." },
            { speaker: 'Eng. Jaxon', text: "Ribs three through nine. I've named them all and they're all complaining." },
            { speaker: 'Spc. Vance', text: "Six percent in three jumps. Two more like that and I'd rather walk." }
        ],
        choices: [
            {
                text: "Full patch.",
                desc: "-25 Salvage. Repairs a damaged deck. Drive braced: +4 Energy back on the next jump.",
                requires: (state) => state.salvage >= 25,
                requiresLabel: "Needs 25 Salvage",
                effect: (state) => {
                    state.salvage -= 25;
                    state._driveReinforced = true; // read by App.handleSectorJump and NavView: 20% off the next jump, once
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        damaged[1].status = 'OPERATIONAL';
                        return `Full patch. ${damaged[1].label} back, drive mounts braced. Jaxon names the new plates. (-25 Salvage)`;
                    }
                    return "Full patch. Nothing was broken; the drive mounts are braced for the next jump. (-25 Salvage)";
                }
            },
            {
                text: "Ribs only.",
                desc: "-10 Salvage. Drive braced: +4 Energy back on the next jump. Nothing else fixed.",
                requires: (state) => state.salvage >= 10,
                requiresLabel: "Needs 10 Salvage",
                effect: (state) => {
                    state.salvage -= 10;
                    state._driveReinforced = true; // read by App.handleSectorJump and NavView: 20% off the next jump, once
                    return "Ribs three through nine plated. Jaxon: 'She'll hold. She'll complain, but she'll hold.' (-10 Salvage)";
                }
            },
            {
                text: "Fly as we are.",
                desc: "Nothing spent. 40% chance a deck gets damaged.",
                effect: (state) => {
                    if (Math.random() < 0.4) {
                        const operational = Object.entries(state.shipDecks).filter(([k, v]) => v.status === 'OPERATIONAL');
                        if (operational.length > 0) {
                            const target = operational[Math.floor(Math.random() * operational.length)];
                            target[1].status = 'DAMAGED';
                            return `A rib let go. ${target[1].label} damaged. Vance: 'I said two more.'`;
                        }
                    }
                    return "The ribs hold. Jaxon does not say thank you to them, but he thinks it.";
                }
            }
        ]
    },
    {
        id: 'CF_AURA_ETHICS',
        sectorRange: [3, 4],
        priority: 2,
        condition: (state) => !state._auraEthicsAsked,
        title: "/// WARP INCIDENT: A QUESTION ///",
        context: `Mid-warp, A.U.R.A. asks it plainly, in her ordinary voice.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "A question from my commissioning, Commander. If reaching the end of this heading costs crew, do I go on?" },
            { speaker: 'Tech Mira', text: "Answer her honestly. She'll do what you say. She always does." },
            { speaker: 'Spc. Vance', text: "Ask her how many she has to spend. Go on. Ask her." },
            { speaker: 'Dr. Aris', text: "Nobody gets spent. Nobody on my list is going to be one of ours." }
        ],
        choices: [
            {
                text: "Never. Nobody gets spent.",
                desc: "Aris -1 Stress. A.U.R.A. writes it down.",
                effect: (state) => {
                    state._auraEthicsAsked = true;
                    state._auraLoyalty = (state._auraLoyalty || 0) + 1;
                    state.noteStanding && state.noteStanding('aris');
                    const aris = state.crew.find(c => c.name.includes('Aris') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    return "A.U.R.A.: 'Recorded, Commander. Crew first. I will hold to it.' Aris goes back to her list. (Aris -1 Stress)";
                }
            },
            {
                text: "You decide, A.U.R.A. That is what you are for.",
                desc: "Mira -1 Stress. Vance +1 Stress: he wants a human answer on record.",
                effect: (state) => {
                    state._auraEthicsAsked = true;
                    state._auraCold = true;
                    state.noteStanding && state.noteStanding('mira');
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    const vance = state.crew.find(c => c.name.includes('Vance') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    return "A.U.R.A.: 'Then I go on, Commander. Those are my orders. Thank you for trusting me with them.' (Mira -1 Stress, Vance +1 Stress)";
                }
            },
            {
                text: "Who told you to ask that?",
                desc: "+1 Data. Mira +1 Stress: she did not want it asked.",
                effect: (state) => {
                    state._auraEthicsAsked = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.noteStanding && state.noteStanding('vance');
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("A.U.R.A.: 'My commissioning, Commander. I am to ask once, after the third sector, and record the answer.'");
                    state.addLog("Spc. Vance: 'Record it where?' A.U.R.A.: 'I do not have that field, Commander.'");
                    return "She was told to ask. She does not know by whom. (+1 Data, Mira +1 Stress)";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 4 → 5: No reserves. Wherever we settle from here, we settle for good.
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_LAST_CHANCE',
        sectorRange: [4, 4],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: NO RESERVES ///",
        context: `A.U.R.A. slows the burn to say it.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Past this point we cannot stop anywhere for long, Commander. Wherever we settle from here, we settle for good." },
            { speaker: 'Eng. Jaxon', text: "Then let's settle. Two jumps back there's a rock I named. It had weather." },
            { speaker: 'Spc. Vance', text: "Two jumps back is a number we don't have. Say it, A.U.R.A." },
            { speaker: 'A.U.R.A.', text: "Correct, Commander. There is no back." }
        ],
        choices: [
            {
                text: "On to Sector 5.",
                desc: "Vance -1 Stress, Aris -1 Stress. Jaxon +1 Stress: he heard 'no back'.",
                effect: (state) => {
                    const vance = state.crew.find(c => c.name.includes('Vance') && c.status !== 'DEAD');
                    const aris = state.crew.find(c => c.name.includes('Aris') && c.status !== 'DEAD');
                    const jaxon = state.crew.find(c => c.name.includes('Jaxon') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    return "Vance: 'Forward. Good.' Jaxon says nothing and goes to check the kettle. (Vance -1 Stress, Aris -1 Stress, Jaxon +1 Stress)";
                }
            },
            {
                text: "Full systems check first.",
                desc: "+20 Energy, +10 Salvage. -1 Ration: a day spent counting.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 20);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state.rations = Math.max(0, state.rations - 1);
                    return "Every system checked, every crate counted. Vance reads the totals out twice. (+20 Energy, +10 Salvage, -1 Ration)";
                }
            },
            {
                text: "Tell Jaxon: the next good rock, we look at it properly.",
                desc: "Jaxon -1 Stress. -5 Energy: he preps the goat tonight, ready to land.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state.noteStanding && state.noteStanding('jaxon');
                    const jaxon = state.crew.find(c => c.name.includes('Jaxon') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.max(0, (jaxon.stress || 0) - 1);
                    return "Jaxon: 'Properly. You said properly.' He is in the hangar with the goat until morning. (Jaxon -1 Stress, -5 Energy)";
                }
            }
        ]
    },
    {
        id: 'CF_SIGNAL_VISION',
        sectorRange: [4, 5],
        priority: 2,
        condition: (state) => state._followedSignal,
        title: "/// WARP INCIDENT: A SUN ///",
        context: `The forward screen whites out for a second. A sun, dead ahead, filling it. No warmth on the glass.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Forward sensors saturated for one point four seconds, Commander. No thermal reading. I have logged it as a star." },
            { speaker: 'Tech Mira', text: "And here we see... no. I don't know what we see." },
            { speaker: 'A.U.R.A.', text: "The line we followed ends there, Commander. Every transponder points at it." }
        ],
        choices: [
            {
                text: "Log everything Mira saw.",
                desc: "+3 Data. Mira +1 Stress: she has to look at it again.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    return "Mira replays the frame nine times and narrates it once. A.U.R.A. files it under stars. (+3 Data, Mira +1 Stress)";
                }
            },
            {
                text: "Wipe the frame. Nobody needs that.",
                desc: "Mira -1 Stress. Commander +1 Stress: you keep it.",
                effect: (state) => {
                    const cmdr = state.crew.find(c => c.tags && c.tags.includes('LEADER') && c.status !== 'DEAD');
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (cmdr) cmdr.stress = Math.min(3, (cmdr.stress || 0) + 1);
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    return "The frame is gone from the log. Not from you. (Mira -1 Stress, Commander +1 Stress)";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 5 → 6: The last jump. Transponders, and the light.
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_STRUCTURE_APPROACH',
        sectorRange: [5, 5],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: THE LAST JUMP ///",
        context: `The channel is full. Every contact ahead is a transponder, and past them, a light.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Thirty thousand. I stopped at thirty thousand. The clicker only goes to five digits." },
            { speaker: 'Dr. Aris', text: "I can't read that many. I'll read the ones we pass. Every one we pass." },
            { speaker: 'A.U.R.A.', text: "A star ahead by its light, Commander. No warmth on the hull. I will keep the crew braced." },
            { speaker: 'Tech Mira', text: "She's steering for it. I didn't ask her to. She's steering for it." },
            { speaker: 'Eng. Jaxon', text: "That's a sun. Suns have rocks. Wake me at the rocks." }
        ],
        choices: [
            {
                text: "All power to the hull.",
                desc: "All crew -1 Stress. Heals the injured. -10 Energy.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    state.crew.forEach(c => {
                        if (c.status === 'INJURED') c.status = 'HEALTHY';
                        if (c.status !== 'DEAD') c.stress = Math.max(0, (c.stress || 0) - 1);
                    });
                    return "The hull takes the field. The crew ride it out in the dark, braced, together. (All crew -1 Stress, injured healed, -10 Energy)";
                }
            },
            {
                text: "All power to the sensors.",
                desc: "+5 Data. The injured stay injured.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 5;
                    return "Every transponder logged by hull number. Vance reads the top of the list twice, to be sure. (+5 Data)";
                }
            },
            {
                text: "Split it.",
                desc: "+2 Data. Heals one injured. -5 Energy.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const injured = state.crew.find(c => c.status === 'INJURED');
                    if (injured) {
                        injured.status = 'HEALTHY';
                        return `Half the array, half the hull. ${injured.name} is on their feet for the arrival. (+2 Data, -5 Energy)`;
                    }
                    return "Half the array, half the hull. Nobody needed the med bay. (+2 Data, -5 Energy)";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // GENERIC (low priority, fills gaps)
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_ROUTINE_MAINTENANCE',
        sectorRange: [1, 6],
        priority: 1,
        condition: (state) => state.salvage >= 15,
        title: "/// WARP INCIDENT: MAINTENANCE WINDOW ///",
        context: `A quiet stretch of warp. Time to fix one thing.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Power or hull, Commander. Fifteen salvage either way." },
            { speaker: 'Eng. Jaxon', text: "Kettle or ribs. Pick. I'm not doing both on this much sleep." }
        ],
        choices: [
            {
                text: "The kettle.",
                desc: "-15 Salvage. +25 Energy.",
                effect: (state) => {
                    state.salvage -= 15;
                    state.energy = Math.min(100, state.energy + 25);
                    return "Kettle serviced. Capacitors full. (-15 Salvage, +25 Energy)";
                }
            },
            {
                text: "The ribs.",
                desc: "-15 Salvage. Repairs a damaged deck; if none, braces the drive: +4 Energy back next jump.",
                effect: (state) => {
                    state.salvage -= 15;
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        damaged[1].status = 'OPERATIONAL';
                        return `${damaged[1].label} repaired. (-15 Salvage)`;
                    }
                    state._driveReinforced = true; // read by App.handleSectorJump and NavView: 20% off the next jump, once
                    return "Nothing broken, so Jaxon braces the drive mounts instead. Next jump comes cheaper. (-15 Salvage)";
                }
            },
            {
                text: "Skip it.",
                desc: "Nothing spent, nothing fixed.",
                effect: (state) => {
                    return "Maintenance skipped. Jaxon sleeps. The ribs complain quietly.";
                }
            }
        ]
    }
];
