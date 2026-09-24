/**
 * CAMPFIRE EVENTS — The talks between sectors. They happen DURING the warp transition.
 *
 * DESIGN:
 * - Problems and questions mid-warp; every choice has a real, stated effect
 * - Short: one or two sentences of context, then the crew, one plain line each (docs/STYLE.md)
 * - Shows after the warp dialogue, before entering the new sector
 * - The beacons the ship can steer by are the dead Exodus ships on our own channel
 *   (docs/CANON.md). Nothing broadcasts to us. Nothing follows us.
 *
 * ONE TALK PER JUMP: the game plays the single highest-priority eligible talk, and none on the
 * jump from sector 2 to 3 (that jump is TheThrow, CANON.md section 7). So each playable jump
 * has exactly one priority-3 talk, the story beat for that point:
 *   1 → 2  CF_SIGNAL_INTERFERENCE  follow the beacon line or hold our own course (sets _followedSignal)
 *   3 → 4  CF_AURA_ETHICS          "if reaching the end costs crew, do I continue?"
 *   4 → 5  CF_LAST_CHANCE          no way back
 *   5 → 6  CF_SIGNAL_VISION        only if you let A.U.R.A. fly the line: it ends at the light
 *          (otherwise the priority-2 CF_STRUCTURE_APPROACH is the last-jump talk)
 * Everything else is priority 1-2 and only plays when the story talk for that jump is not eligible.
 *
 * PRIORITY:
 * - 3 = The story talk for this jump
 * - 2 = Fallback
 * - 1 = Generic fallback
 *
 * NOTE: App.showCampfireEvent runs while state.currentSector is still the sector we are leaving.
 */
const CAMPFIRE_EVENTS = [
    // ═══════════════════════════════════════════════════════════════
    // SECTOR 1 → 2: The beacons of the ships that went before us
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_POWER_SURGE',
        sectorRange: [1, 1],
        priority: 2,
        condition: () => true,
        title: "/// WARP INCIDENT: POWER SURGE ///",
        context: `Mid-warp, a power line overloads. Sparks fly across engineering.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "It's the capacitor bank, not the reactor. I can save it, or strip it for parts." },
            { speaker: 'A.U.R.A.', text: "Saving it costs ten energy now, Commander. Stripping it makes every jump in the next sector cost five more." },
            { speaker: 'Spc. Vance', text: "Five extra on every jump adds up fast. I'd pay the ten now." }
        ],
        choices: [
            {
                text: "Reroute power and save it.",
                desc: "-10 Energy. Nothing else is lost.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    return "Power rerouted. The capacitor bank is intact. -10 Energy.";
                }
            },
            {
                text: "Strip it for parts.",
                desc: "+15 Salvage. -5 Energy on every jump in the next sector.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state._damagedCapacitors = state.currentSector + 1; // the sector we are jumping into; read by GameState.getWarpCost
                    return "Capacitor bank stripped. +15 Salvage. Every jump in the next sector costs 5 more Energy.";
                }
            }
        ]
    },
    {
        id: 'CF_STOWAWAY_SIGNAL',
        sectorRange: [1, 2],
        priority: 2,
        condition: (state) => state.salvage >= 20,
        title: "/// WARP INCIDENT: A BEACON IN THE HOLD ///",
        context: `A ship beacon we salvaged has switched itself back on in the cargo hold. It's broadcasting its ship number on our channel.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "It's been dead for twenty years. It woke up because it picked up our signal." },
            { speaker: 'Eng. Jaxon', text: "Keep it or throw it out, Commander. I'm not sleeping next to that noise." },
            { speaker: 'A.U.R.A.', text: "I can read its memory, Commander. There's a thirty percent chance it shorts out and drains our power." }
        ],
        choices: [
            {
                text: "Read its memory.",
                desc: "+1 Data. 30% chance of -15 Energy.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    if (Math.random() < 0.3) {
                        state.energy = Math.max(0, state.energy - 15);
                        return "The beacon shorted out while A.U.R.A. was reading it. +1 Data. -15 Energy.";
                    }
                    return "The beacon holds a single flight plan, and it's exactly the same as ours. +1 Data.";
                }
            },
            {
                text: "Strip the casing. Dump the rest.",
                desc: "+5 Salvage. Nothing learned.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 5);
                    return "The beacon goes out the airlock, still broadcasting. Mira watches it until it's gone. +5 Salvage.";
                }
            }
        ]
    },
    {
        id: 'CF_SIGNAL_INTERFERENCE',
        sectorRange: [1, 1],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: THE BEACONS AHEAD ///",
        context: `The navigation array picks up ship beacons ahead, on our own channel. They belong to the ships that went before us, and they lie in a straight line.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Five beacons ahead, Commander, all earlier Exodus ships. They line up along our heading." },
            { speaker: 'A.U.R.A.', text: "I can fly us down that line. It's the most efficient route." },
            { speaker: 'Tech Mira', text: "It's the route the others took. A.U.R.A. can fly it better than any of us." },
            { speaker: 'Spc. Vance', text: "The others are dead. I don't want to fly the exact route that killed them." }
        ],
        choices: [
            {
                text: "Hold our own course.",
                desc: "-15 Energy: flying by hand costs more. Vance agrees with you.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 15);
                    state.noteStanding && state.noteStanding('vance');
                    return "You fly our own course. Vance: 'Good. We decide where we go.' -15 Energy.";
                }
            },
            {
                text: "Let A.U.R.A. fly the line.",
                desc: "+10 Energy: an efficient burn along the beacons. A.U.R.A. flies this route from now on. Mira agrees with you.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 10);
                    state._followedSignal = true;
                    state.noteStanding && state.noteStanding('mira');
                    return "A.U.R.A.: 'Thank you, Commander. It's a very straight line.' +10 Energy.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 2 → 3: The burn stalls (TheThrow). No talk plays on this jump.
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_CREW_NIGHTMARE',
        sectorRange: [2, 3],
        priority: 2,
        condition: (state) => state.crew.some(c => c.status !== 'DEAD' && (c.stress || 0) >= 2),
        title: "/// WARP INCIDENT: THE SAME DREAM ///",
        context: `Three of the crew wake up at the same moment from the same dream: a huge room, then a tiny one, and a bright light on the wall.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Three crew have raised heart rates, Commander. I can sedate them, or Dr. Aris can see them." },
            { speaker: 'Dr. Aris', text: "Three people with the same dream isn't a coincidence. I want to write it all down." },
            { speaker: 'Eng. Jaxon', text: "Leave mine out of it. It started as a good dream." }
        ],
        choices: [
            {
                text: "Sedate them.",
                desc: "All crew -1 Stress. -2 Rations: sedated crew need extra food and water to recover.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 2);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.max(0, (c.stress || 0) - 1);
                    });
                    return "The crew sleep until the burn ends. Nobody dreams. All crew -1 Stress. -2 Rations.";
                }
            },
            {
                text: "Let Aris write it down.",
                desc: "+2 Data. Nobody's stress goes down.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    return "Three accounts: the same room, the same light. Aris files them as evidence. +2 Data.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 3 → 4: The question
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_HULL_STRESS',
        sectorRange: [3, 3],
        priority: 2,
        condition: () => true,
        title: "/// WARP INCIDENT: HULL CRACKS ///",
        context: `Alarms. The hull is cracking along its frame from all the jumps.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Hull strength is at ninety-four percent, Commander. We can do a full repair, a quick patch, or nothing." },
            { speaker: 'Eng. Jaxon', text: "The frame takes a beating every jump. It wasn't built for this many." },
            { speaker: 'Spc. Vance', text: "Six percent lost in three jumps. We can't keep losing it that fast." }
        ],
        choices: [
            {
                text: "Full repair.",
                desc: "-25 Salvage. Repairs a damaged deck and braces the drive: +4 Energy saved on the next sector jump.",
                requires: (state) => state.salvage >= 25,
                requiresLabel: "Needs 25 Salvage",
                effect: (state) => {
                    state.salvage -= 25;
                    state._driveReinforced = true; // read by App.handleSectorJump and NavView: 20% off the next jump, once
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        damaged[1].status = 'OPERATIONAL';
                        return `Full repair. The ${damaged[1].label} is working again and the drive is braced. -25 Salvage.`;
                    }
                    return "Full repair. Nothing was broken, so the drive mounts are braced for the next jump. -25 Salvage.";
                }
            },
            {
                text: "Quick patch on the frame.",
                desc: "-10 Salvage. Braces the drive: +4 Energy saved on the next sector jump. Nothing else is fixed.",
                requires: (state) => state.salvage >= 10,
                requiresLabel: "Needs 10 Salvage",
                effect: (state) => {
                    state.salvage -= 10;
                    state._driveReinforced = true; // read by App.handleSectorJump and NavView: 20% off the next jump, once
                    return "The cracked frame is patched. Jaxon: 'It'll hold.' -10 Salvage.";
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
                            return `A section of hull gave way. The ${target[1].label} is damaged. Vance: 'I warned you.'`;
                        }
                    }
                    return "The hull holds. Jaxon lets out a long breath.";
                }
            }
        ]
    },
    {
        id: 'CF_AURA_ETHICS',
        sectorRange: [3, 3],
        priority: 3,
        condition: (state) => !state._auraEthicsAsked,
        title: "/// WARP INCIDENT: A QUESTION ///",
        context: `Mid-warp, A.U.R.A. asks a question in her ordinary voice.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "I'm required to ask this once, Commander. If reaching the end of this heading costs crew, do I continue?" },
            { speaker: 'Tech Mira', text: "Answer her honestly. She'll do whatever you say." },
            { speaker: 'Spc. Vance', text: "I want to know who put that question into her." },
            { speaker: 'Dr. Aris', text: "Nobody from this crew ends up on my list. Nobody." }
        ],
        choices: [
            {
                text: "Never. Nobody is expendable.",
                desc: "Aris -1 Stress: it's what she wanted to hear. A.U.R.A. records your answer.",
                effect: (state) => {
                    state._auraEthicsAsked = true;
                    state._auraLoyalty = (state._auraLoyalty || 0) + 1;
                    state.noteStanding && state.noteStanding('aris');
                    const aris = state.crew.find(c => c.name.includes('Aris') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    return "A.U.R.A.: 'Recorded, Commander. The crew comes first.' Aris -1 Stress.";
                }
            },
            {
                text: "You decide, A.U.R.A.",
                desc: "Mira -1 Stress: she trusts A.U.R.A. to decide. Vance +1 Stress: he wants a person making that call.",
                effect: (state) => {
                    state._auraEthicsAsked = true;
                    state._auraCold = true;
                    state.noteStanding && state.noteStanding('mira');
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    const vance = state.crew.find(c => c.name.includes('Vance') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    return "A.U.R.A.: 'Then I continue, Commander. Those are my orders. Thank you for trusting me.' Mira -1 Stress. Vance +1 Stress.";
                }
            },
            {
                text: "Ask who told her to ask.",
                desc: "+1 Data. Mira +1 Stress: she didn't want A.U.R.A. questioned.",
                effect: (state) => {
                    state._auraEthicsAsked = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.noteStanding && state.noteStanding('vance');
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("A.U.R.A.: 'It's in my launch instructions, Commander. I'm to ask once, after the third sector, and record the answer.'");
                    state.addLog("Spc. Vance: 'Record it where?' A.U.R.A.: 'I don't know, Commander. The instructions don't say.'");
                    return "The question was written into her before launch. She doesn't know who wrote it. +1 Data. Mira +1 Stress.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 4 → 5: No way back. Wherever we settle from here, we settle for good.
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_LAST_CHANCE',
        sectorRange: [4, 4],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: NO WAY BACK ///",
        context: `A.U.R.A. slows the burn so she can say this clearly.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "After this jump we won't have the energy to turn back, Commander. Wherever we settle from here is for good." },
            { speaker: 'Eng. Jaxon', text: "Then let's settle. Two jumps back there was a planet with real weather." },
            { speaker: 'Spc. Vance', text: "We don't have the energy for two jumps back. Tell him, A.U.R.A." },
            { speaker: 'A.U.R.A.', text: "That's correct, Commander. There's no going back." }
        ],
        choices: [
            {
                text: "Push on to Sector 5.",
                desc: "Vance -1 Stress and Aris -1 Stress: they want answers, and the answers are ahead. Jaxon +1 Stress: he wanted to go back.",
                effect: (state) => {
                    const vance = state.crew.find(c => c.name.includes('Vance') && c.status !== 'DEAD');
                    const aris = state.crew.find(c => c.name.includes('Aris') && c.status !== 'DEAD');
                    const jaxon = state.crew.find(c => c.name.includes('Jaxon') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    return "Vance: 'Good.' Jaxon goes to check the reactor without a word. Vance -1 Stress. Aris -1 Stress. Jaxon +1 Stress.";
                }
            },
            {
                text: "Run a full systems check first.",
                desc: "+20 Energy, +10 Salvage: the check turns up spare power and parts. -1 Ration: it takes a day.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 20);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state.rations = Math.max(0, state.rations - 1);
                    return "Every system checked, every crate opened. +20 Energy. +10 Salvage. -1 Ration.";
                }
            },
            {
                text: "Tell Jaxon to get the lander ready.",
                desc: "Jaxon -1 Stress: we can land on the next good planet we find. -5 Energy: he preps the lander tonight.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state.noteStanding && state.noteStanding('jaxon');
                    const jaxon = state.crew.find(c => c.name.includes('Jaxon') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.max(0, (jaxon.stress || 0) - 1);
                    return "Jaxon: 'It'll be ready by morning.' He spends the night in the hangar. Jaxon -1 Stress. -5 Energy.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 5 → 6: The last jump. The beacons, and the light.
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_SIGNAL_VISION',
        sectorRange: [5, 5],
        priority: 3,
        condition: (state) => state._followedSignal, // set in CF_SIGNAL_INTERFERENCE (sector 1 → 2)
        title: "/// WARP INCIDENT: THE END OF THE LINE ///",
        context: `A.U.R.A. has flown the beacon line since sector 1. Mid-warp, the forward screen goes white for a second: a bright light, dead ahead.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "The forward sensors were overloaded for 1.4 seconds, Commander. I've logged the source as a star." },
            { speaker: 'Tech Mira', text: "Every beacon we followed points straight at it. I don't know what it is." },
            { speaker: 'A.U.R.A.', text: "The line we've been flying ends there, Commander." }
        ],
        choices: [
            {
                text: "Record everything Mira saw.",
                desc: "+3 Data. Mira +1 Stress: she has to watch it again.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    return "Mira replays the footage nine times. A.U.R.A. files it under stars. +3 Data. Mira +1 Stress.";
                }
            },
            {
                text: "Delete the footage.",
                desc: "Mira -1 Stress: she doesn't want to see it again. Commander +1 Stress: you can't forget it.",
                effect: (state) => {
                    const cmdr = state.crew.find(c => c.tags && c.tags.includes('LEADER') && c.status !== 'DEAD');
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (cmdr) cmdr.stress = Math.min(3, (cmdr.stress || 0) + 1);
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    return "The footage is gone from the log, but not from your memory. Mira -1 Stress. Commander +1 Stress.";
                }
            }
        ]
    },
    {
        id: 'CF_STRUCTURE_APPROACH',
        sectorRange: [5, 5],
        priority: 2,
        condition: () => true,
        title: "/// WARP INCIDENT: THE LAST JUMP ///",
        context: `Every contact ahead is an Exodus beacon. Past them is a bright light.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Earth told us there were nine ships. Somebody back home knew about all of these." },
            { speaker: 'Dr. Aris', text: "There are too many names to read. I'll read the ones we pass." },
            { speaker: 'Tech Mira', text: "Our course runs straight into that light. I wish I knew what it was." },
            { speaker: 'A.U.R.A.', text: "Bracing for the last jump, Commander. Tell me where you want the power." }
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
                    return "The crew ride out the jump together, braced and safe. Injured crew healed. All crew -1 Stress. -10 Energy.";
                }
            },
            {
                text: "All power to the sensors.",
                desc: "+5 Data. The injured stay injured.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 5;
                    return "Every beacon is logged by ship number. +5 Data.";
                }
            },
            {
                text: "Split power between the two.",
                desc: "+2 Data. Heals one injured crew member. -5 Energy.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const injured = state.crew.find(c => c.status === 'INJURED');
                    if (injured) {
                        injured.status = 'HEALTHY';
                        return `Half to the sensors, half to the hull. ${injured.name} is back on their feet. +2 Data. -5 Energy.`;
                    }
                    return "Half to the sensors, half to the hull. Nobody needed the med bay. +2 Data. -5 Energy.";
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
        context: `A quiet stretch of the warp. There's time to fix one thing.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Power or hull, Commander. Either one costs fifteen salvage." },
            { speaker: 'Eng. Jaxon', text: "Reactor or hull. Pick one. I haven't slept enough to do both." }
        ],
        choices: [
            {
                text: "Service the reactor.",
                desc: "-15 Salvage. +25 Energy.",
                effect: (state) => {
                    state.salvage -= 15;
                    state.energy = Math.min(100, state.energy + 25);
                    return "Reactor serviced. -15 Salvage. +25 Energy.";
                }
            },
            {
                text: "Repair the hull.",
                desc: "-15 Salvage. Repairs a damaged deck. If nothing is damaged, braces the drive: +4 Energy saved on the next sector jump.",
                effect: (state) => {
                    state.salvage -= 15;
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        damaged[1].status = 'OPERATIONAL';
                        return `${damaged[1].label} repaired. -15 Salvage.`;
                    }
                    state._driveReinforced = true; // read by App.handleSectorJump and NavView: 20% off the next jump, once
                    return "Nothing was damaged, so Jaxon braces the drive instead. The next sector jump costs less. -15 Salvage.";
                }
            },
            {
                text: "Skip it.",
                desc: "Nothing spent, nothing fixed.",
                effect: (state) => {
                    return "Maintenance skipped. Jaxon gets some sleep.";
                }
            }
        ]
    }
];
