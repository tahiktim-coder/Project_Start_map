/**
 * CAMPFIRE EVENTS — Incidents that occur DURING warp transition.
 *
 * DESIGN:
 * - These are problems/opportunities that happen mid-warp
 * - Choices have REAL gameplay effects (not just flavor text)
 * - Short and punchy - not long narrative
 * - Shows after warp dialogue, before entering new sector
 *
 * PRIORITY:
 * - 3 = Always fires for this sector (guaranteed event)
 * - 2 = Common (fires if conditions met)
 * - 1 = Rare/fallback
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
        context: `Mid-warp, a power conduit overloads. Sparks fly across engineering.

A.U.R.A.: "Power surge detected. I can reroute to save the capacitors, but we'll lose some stored energy. Or we can let it burn out and salvage the components."`,
        dialogue: [],
        choices: [
            {
                text: "Reroute power (save capacitors)",
                desc: "-10 Energy now. Nothing else is lost.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    return "Power rerouted. We lost some charge, but the capacitors are intact.";
                }
            },
            {
                text: "Let it burn (salvage components)",
                desc: "+15 Salvage, but every warp costs 5 more Energy until the next sector",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state._damagedCapacitors = state.currentSector; // read by GameState.getWarpCost
                    return "Components salvaged. The capacitors are damaged - warps will cost more until repaired.";
                }
            }
        ]
    },
    {
        id: 'CF_STOWAWAY_SIGNAL',
        sectorRange: [1, 2],
        priority: 2,
        condition: (state) => state.salvage >= 20,
        title: "/// WARP INCIDENT: STRANGE READING ///",
        context: `The sensors detect something odd in our salvage hold. A faint energy signature that wasn't there before.

A.U.R.A.: "Unknown device detected among recent salvage. I can isolate and study it, or dump it to be safe."`,
        dialogue: [],
        choices: [
            {
                text: "Study the device",
                desc: "+1 Colony Knowledge, but risk unknown",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    // 30% chance of bad outcome
                    if (Math.random() < 0.3) {
                        state.energy = Math.max(0, state.energy - 15);
                        return "The device emitted a pulse before going inert. We learned something, but lost power. (+1 Data, -15 Energy)";
                    }
                    return "The device contains navigational data from a lost Exodus ship. Valuable. (+1 Colony Knowledge)";
                }
            },
            {
                text: "Dump it",
                desc: "Safe choice. No effect.",
                effect: (state) => {
                    return "The device tumbles into the void. Better safe than sorry.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 2 → 3: The signal begins affecting the ship
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_SIGNAL_INTERFERENCE',
        sectorRange: [2, 2],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: SIGNAL INTERFERENCE ///",
        context: `The mysterious signal is interfering with navigation. The ship shudders as systems fight for control.

A.U.R.A.: "The signal is attempting to alter our course. I can resist it, or... we could let it guide us."`,
        dialogue: [],
        choices: [
            {
                text: "Resist the signal",
                desc: "-15 Energy (fighting interference)",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 15);
                    return "Navigation restored. Whatever that signal wants, we decide our own path. (-15 Energy)";
                }
            },
            {
                text: "Let it guide us",
                desc: "+10 Energy (harmonizing), but what does it want?",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 10);
                    state._followedSignal = true;
                    return "Systems harmonize with the signal. Power flows smoothly... almost too smoothly. (+10 Energy)";
                }
            }
        ]
    },
    {
        id: 'CF_CREW_NIGHTMARE',
        sectorRange: [2, 3],
        priority: 2,
        condition: (state) => state.crew.some(c => c.status !== 'DEAD' && (c.stress || 0) >= 2),
        title: "/// WARP INCIDENT: SHARED NIGHTMARE ///",
        context: `Multiple crew members wake screaming. They all dreamed the same thing: a vast structure in the darkness, waiting.

A.U.R.A.: "Psychological anomaly detected. I recommend sedatives, or we address this directly."`,
        dialogue: [],
        choices: [
            {
                text: "Administer sedatives",
                desc: "All crew -1 Stress, -3 Rations (medical supplies)",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 3);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.max(0, (c.stress || 0) - 1);
                    });
                    return "The crew sleeps peacefully. The dreams fade. (-3 Rations, All crew -1 Stress)";
                }
            },
            {
                text: "Document the dreams",
                desc: "+2 Colony Knowledge (the dreams contain data)",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    return "The dreams describe THE STRUCTURE in detail we haven't scanned yet. How is this possible? (+2 Colony Knowledge)";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 3 → 4: Ship strain, crew tension
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_HULL_STRESS',
        sectorRange: [3, 3],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: HULL MICRO-FRACTURES ///",
        context: `Warning alarms blare. The hull is developing stress fractures from repeated warp jumps.

A.U.R.A.: "Hull strength at 94%. I recommend immediate patching, or we reinforce the critical sections only."`,
        dialogue: [],
        choices: [
            {
                text: "Full hull repair",
                desc: "-25 Salvage, ship fully repaired",
                requires: (state) => state.salvage >= 25,
                effect: (state) => {
                    state.salvage -= 25;
                    // Repair a damaged deck if any
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        damaged[1].status = 'OPERATIONAL';
                        return `Full repair complete. ${damaged[1].label} restored. (-25 Salvage)`;
                    }
                    return "Hull integrity restored to 100%. (-25 Salvage)";
                }
            },
            {
                text: "Patch critical sections only",
                desc: "-10 Salvage, prevents further damage",
                requires: (state) => state.salvage >= 10,
                effect: (state) => {
                    state.salvage -= 10;
                    return "Critical sections reinforced. She'll hold together. (-10 Salvage)";
                }
            },
            {
                text: "Risk it",
                desc: "Save salvage, but 40% chance of deck damage",
                effect: (state) => {
                    if (Math.random() < 0.4) {
                        const operational = Object.entries(state.shipDecks).filter(([k, v]) => v.status === 'OPERATIONAL');
                        if (operational.length > 0) {
                            const target = operational[Math.floor(Math.random() * operational.length)];
                            target[1].status = 'DAMAGED';
                            return `Hull breach! ${target[1].label} damaged!`;
                        }
                    }
                    return "The fractures hold. For now.";
                }
            }
        ]
    },
    {
        id: 'CF_AURA_ETHICS',
        sectorRange: [3, 4],
        priority: 2,
        condition: (state) => !state._auraEthicsAsked,
        title: "/// WARP INCIDENT: A.U.R.A. QUERY ///",
        context: `A.U.R.A.'s display flickers. When she speaks, her voice is... different.

A.U.R.A.: "Commander, I must ask. If reaching THE STRUCTURE requires sacrificing crew... would you?"`,
        dialogue: [],
        choices: [
            {
                text: "\"Never. The crew comes first.\"",
                desc: "A.U.R.A. trusts you more",
                effect: (state) => {
                    state._auraEthicsAsked = true;
                    state._auraLoyalty = (state._auraLoyalty || 0) + 1;
                    return "A.U.R.A.: 'Understood, Commander. I will prioritize crew safety.' (A.U.R.A. loyalty increased)";
                }
            },
            {
                text: "\"The mission comes first.\"",
                desc: "A.U.R.A. notes your priorities",
                effect: (state) => {
                    state._auraEthicsAsked = true;
                    state._auraCold = true;
                    return "A.U.R.A.: 'Understood. Mission parameters updated.' Her voice sounds colder now.";
                }
            },
            {
                text: "\"Why are you asking this?\"",
                desc: "Learn what A.U.R.A. knows",
                effect: (state) => {
                    state._auraEthicsAsked = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    return "A.U.R.A.: 'Previous Exodus AIs faced this choice. None returned. I am... concerned.' (+1 Colony Knowledge)";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 4 → 5: Final preparations, tension peaks
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_LAST_CHANCE',
        sectorRange: [4, 4],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: NO RESERVES ///",
        context: `A.U.R.A. interrupts the warp sequence.

A.U.R.A.: "Commander, past this point we will not have the reserves to stop anywhere for long. Wherever we settle from here, we settle for good."`,
        dialogue: [],
        choices: [
            {
                text: "Continue to Sector 5",
                desc: "No turning back. Forward, always.",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.max(0, (c.stress || 0) - 1);
                    });
                    return "The crew nods. They knew this moment would come. Fear becomes resolve. (All crew -1 Stress)";
                }
            },
            {
                text: "Perform final systems check",
                desc: "+20 Energy (optimization), +10 Salvage (inventory)",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 20);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    return "Every system checked. Every resource counted. We're as ready as we'll ever be. (+20 Energy, +10 Salvage)";
                }
            }
        ]
    },
    {
        id: 'CF_SIGNAL_VISION',
        sectorRange: [4, 5],
        priority: 2,
        condition: (state) => state._followedSignal,
        title: "/// WARP INCIDENT: THE SIGNAL SPEAKS ///",
        context: `The signal floods your mind. For a moment, you SEE it: THE STRUCTURE. Vast. Patient. Alive?

A.U.R.A.: "Commander? Your vitals spiked. What did you see?"`,
        dialogue: [],
        choices: [
            {
                text: "Describe the vision",
                desc: "+3 Colony Knowledge (detailed data)",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    return "Every detail logged. The vision contained information our sensors couldn't gather. (+3 Colony Knowledge)";
                }
            },
            {
                text: "Keep it to yourself",
                desc: "Commander +1 Stress, but no crew panic",
                effect: (state) => {
                    const cmdr = state.crew.find(c => c.tags && c.tags.includes('LEADER') && c.status !== 'DEAD');
                    if (cmdr) cmdr.stress = Math.min(3, (cmdr.stress || 0) + 1);
                    return "Some burdens are yours alone to carry. (Commander +1 Stress)";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR 5 → 6: Final approach to THE STRUCTURE
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'CF_STRUCTURE_APPROACH',
        sectorRange: [5, 5],
        priority: 3,
        condition: () => true,
        title: "/// WARP INCIDENT: REALITY FRACTURES ///",
        context: `Space itself is wrong. The stars bend. Time stutters. THE STRUCTURE is pulling us in.

A.U.R.A.: "Physics is breaking down. I recommend all power to shields, or all power to sensors to document this."`,
        dialogue: [],
        choices: [
            {
                text: "All power to shields",
                desc: "Heal all injured crew, but no data",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status === 'INJURED') c.status = 'HEALTHY';
                    });
                    return "Shields absorb the spatial distortion. The crew is protected. (All injured healed)";
                }
            },
            {
                text: "All power to sensors",
                desc: "+5 Colony Knowledge (unprecedented data)",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 5;
                    return "Sensors capture impossible data. Physics that shouldn't exist. Humanity will learn from this. (+5 Colony Knowledge)";
                }
            },
            {
                text: "Balance both systems",
                desc: "+2 Colony Knowledge, heal 1 injured",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const injured = state.crew.find(c => c.status === 'INJURED');
                    if (injured) {
                        injured.status = 'HEALTHY';
                        return `Balanced approach. ${injured.name} recovered. Data captured. (+2 Colony Knowledge)`;
                    }
                    return "Balanced approach. Some data captured, crew protected. (+2 Colony Knowledge)";
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
        context: `The warp provides a brief window for repairs. Time to prioritize.

A.U.R.A.: "I recommend focusing on either power systems or hull integrity."`,
        dialogue: [],
        choices: [
            {
                text: "Focus on power systems",
                desc: "-15 Salvage, +25 Energy",
                effect: (state) => {
                    state.salvage -= 15;
                    state.energy = Math.min(100, state.energy + 25);
                    return "Power systems optimized. Capacitors at full. (-15 Salvage, +25 Energy)";
                }
            },
            {
                text: "Focus on hull",
                desc: "-15 Salvage, repair 1 damaged deck",
                effect: (state) => {
                    state.salvage -= 15;
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        damaged[1].status = 'OPERATIONAL';
                        return `${damaged[1].label} repaired. (-15 Salvage)`;
                    }
                    return "Hull reinforced. No damaged decks to repair. (-15 Salvage)";
                }
            },
            {
                text: "Skip maintenance",
                desc: "Save resources",
                effect: (state) => {
                    return "Maintenance skipped. Resources preserved.";
                }
            }
        ]
    }
];
