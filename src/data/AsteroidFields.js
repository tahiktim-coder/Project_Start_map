/**
 * ASTEROID FIELDS - Dense rock clusters for mining and exploration
 *
 * High salvage potential but risky navigation.
 * Can contain rare minerals, wreckage, or hidden dangers.
 */

const ASTEROID_FIELD_NAMES = [
    'Debris Cloud Alpha', 'The Shattered Belt', 'Gravel Drift',
    'Iron Wake', 'Stone Garden', 'The Rubble Patch',
    'Fractured Zone', 'Mineral Cluster 7', 'The Rock Field',
    'Slag Drift', 'Crystal Scatter', 'Dead Moon Remains'
];

const ASTEROID_FIELD_ENCOUNTERS = [
    // --- 1. RICH MINERAL DEPOSIT ---
    {
        id: 'ASTEROID_RICH',
        weight: 20,
        title: "RICH MINERAL DEPOSIT",
        context: (name) => `${name} contains dense pockets of refined metals. High concentrations of processed alloys. Probably debris from a destroyed refinery. Stable enough for careful extraction.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Good density here. We can extract a lot if we're patient." },
            { speaker: 'Tech Mira', text: "Spectral analysis shows rare earth elements. This is a good find." },
            { speaker: 'A.U.R.A.', text: "Recommend extended mining operation. Risk assessment: low." }
        ],
        choices: [
            {
                text: "Full extraction (slow, safe)",
                desc: "+40-60 Salvage. Low risk, thorough extraction.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 21) + 40;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    state.addLog(`Extended mining operation complete. +${salvage} Salvage.`);
                    return `Mining complete. +${salvage} Salvage extracted safely.`;
                }
            },
            {
                text: "Quick extraction (fast, some risk)",
                desc: "+20-30 Salvage. 15% chance of minor collision.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 11) + 20;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);

                    if (Math.random() < 0.15) {
                        state.energy = Math.max(0, state.energy - 10);
                        state.addLog(`Minor collision during extraction. -10 Energy for repairs.`);
                        return `Quick mining done. +${salvage} Salvage. Minor hull damage: -10 Energy.`;
                    }

                    state.addLog(`Quick extraction complete. +${salvage} Salvage.`);
                    return `Quick mining done. +${salvage} Salvage.`;
                }
            },
            {
                text: "Scan for valuable deposits only",
                desc: "+25 Salvage guaranteed. May find rare materials.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);

                    if (Math.random() < 0.3 && typeof ITEMS !== 'undefined') {
                        const rareItems = [ITEMS.CONDENSED_SALVAGE, ITEMS.XENOTECH_COMPONENT].filter(i => i);
                        if (rareItems.length > 0) {
                            const item = rareItems[Math.floor(Math.random() * rareItems.length)];
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...item, acquiredAt: 'Asteroid Field' });
                            state.addLog(`Targeted extraction found rare deposits. +25 Salvage and ${item.name}.`);
                            return `Precision mining successful. +25 Salvage. Found: ${item.name}`;
                        }
                    }

                    state.addLog("Targeted extraction complete. +25 Salvage.");
                    return "Precision mining complete. +25 Salvage.";
                }
            }
        ]
    },

    // --- 2. UNSTABLE FIELD ---
    {
        id: 'ASTEROID_UNSTABLE',
        weight: 15,
        title: "UNSTABLE DEBRIS FIELD",
        context: (name) => `${name} is moving. The rocks are shifting, colliding, breaking apart. Something disturbed this field recently. Mining is possible but dangerous — one wrong move and we're caught in a cascade.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "This field is alive. Those rocks are moving fast." },
            { speaker: 'Eng. Jaxon', text: "I can get us through, but it won't be pretty." },
            { speaker: 'A.U.R.A.', text: "Collision probability: significant. Proceed with caution." }
        ],
        choices: [
            {
                text: "Navigate carefully and mine",
                desc: "+30 Salvage. 30% chance of collision damage.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);

                    if (Math.random() < 0.30) {
                        const damage = Math.floor(Math.random() * 15) + 10;
                        state.energy = Math.max(0, state.energy - damage);

                        // 20% chance of deck damage
                        if (Math.random() < 0.20) {
                            const decks = ['bridge', 'lab', 'quarters', 'cargo', 'engineering'];
                            const deck = decks[Math.floor(Math.random() * decks.length)];
                            if (state.shipDecks[deck]?.status === 'OPERATIONAL') {
                                state.shipDecks[deck].status = 'DAMAGED';
                                state.addLog(`COLLISION! ${state.shipDecks[deck].label} damaged by asteroid impact.`);
                                return `Mining done. +30 Salvage. ${state.shipDecks[deck].label} DAMAGED. -${damage} Energy.`;
                            }
                        }

                        state.addLog(`Asteroid strike! Hull integrity compromised. -${damage} Energy for repairs.`);
                        return `Mining complete. +30 Salvage. Collision damage: -${damage} Energy.`;
                    }

                    state.addLog("Mining complete. We got lucky with the timing.");
                    return "Mining done. +30 Salvage. No collisions.";
                }
            },
            {
                text: "Wait for field to stabilize",
                desc: "+15 Salvage, no risk. Conservative approach.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("Waited for debris field to settle. Safe extraction complete.");
                    return "Patience paid off. +15 Salvage, no damage.";
                }
            },
            {
                text: "Use probe to scout safe path",
                desc: "Requires probe. +25 Salvage safely. Probe takes 20% damage.",
                effect: (state) => {
                    if (state.probeIntegrity <= 0) {
                        state.addLog("No probe available. Cannot scout the field.");
                        return "Probe unavailable. Mining aborted.";
                    }

                    state.probeIntegrity = Math.max(0, state.probeIntegrity - 20);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    state.addLog(`Probe mapped safe extraction route. +25 Salvage. Probe integrity: ${state.probeIntegrity.toFixed(0)}%`);
                    return `Probe-guided mining complete. +25 Salvage. Probe took minor damage.`;
                }
            }
        ]
    },

    // --- 3. WRECKAGE FIELD ---
    {
        id: 'ASTEROID_WRECKAGE',
        weight: 15,
        title: "SHIP GRAVEYARD",
        context: (name) => `${name} isn't natural. These aren't asteroids — they're ship pieces. Hulls, engines, cargo containers, all crushed together. A battle happened here. Or an accident. Either way, there's salvage mixed with the stones.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "So many ships. What happened here?" },
            { speaker: 'Eng. Jaxon', text: "Don't think about it. Just grab what we can use." },
            { speaker: 'Tech Mira', text: "Some of these fragments have intact data cores. Black boxes." }
        ],
        choices: [
            {
                text: "Salvage ship components",
                desc: "+35-50 Salvage from wreckage.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 16) + 35;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    state.addLog(`Extracted usable components from wreckage. +${salvage} Salvage.`);
                    return `Ship salvage complete. +${salvage} Salvage.`;
                }
            },
            {
                text: "Recover black box data",
                desc: "+Colony knowledge. Learn what happened.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;

                    const stories = [
                        "The ships were running from something. The last transmissions are screams.",
                        "A nav system failure caused a chain collision. 200 people died in seconds.",
                        "They were fighting each other. Resources ran out. This was the result.",
                        "One ship's log reads: 'We found something. It's following us.' Then static."
                    ];

                    const story = stories[Math.floor(Math.random() * stories.length)];
                    state.addLog(`Black box recovered. ${story}`);

                    // Stress increase from disturbing content
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && Math.random() < 0.3) {
                            c.stress = Math.min(3, (c.stress || 0) + 1);
                        }
                    });

                    return `Data recovered. Colony knowledge improved. Some crew disturbed by findings.`;
                }
            },
            {
                text: "Search for survivors (cryo pods)",
                desc: "Long shot. Might find preserved supplies or equipment.",
                effect: (state) => {
                    const roll = Math.random();

                    if (roll < 0.6) {
                        // Nothing
                        state.addLog("All pods destroyed or long dead. Nothing to recover.");
                        return "No survivors. No intact cryopods. Just wreckage.";
                    } else if (roll < 0.9) {
                        // Supplies
                        state.rations = Math.min(state.maxRations, state.rations + 4);
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                        state.addLog("Found intact storage containers. +4 Rations, +15 Salvage.");
                        return "Cryo pods empty but cargo intact. +4 Rations, +15 Salvage.";
                    } else {
                        // Something weird
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                        state.addLog("We found a survivor. They were awake. They've been awake for 40 years. They won't stop screaming.");
                        return "Found something. +20 Salvage. All crew +1 Stress from what they saw.";
                    }
                }
            }
        ]
    },

    // --- 4. CRYSTAL CLUSTER ---
    {
        id: 'ASTEROID_CRYSTAL',
        weight: 12,
        title: "CRYSTAL FORMATION",
        context: (name) => `${name} sparkles with crystalline structures. Not ice — something harder, more complex. The crystals emit faint energy signatures. They might be valuable, or they might be dangerous. Hard to tell until we get closer.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "The energy readings are off the charts. These crystals are... alive? No, not alive. Resonating." },
            { speaker: 'Dr. Aris', text: "Careful with extraction. Crystal structures can be unstable." },
            { speaker: 'A.U.R.A.', text: "Analysis suggests piezoelectric properties. High value, high volatility." }
        ],
        choices: [
            {
                text: "Careful extraction",
                desc: "+20 Salvage, +15 Energy from crystal resonance.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 15);
                    state.addLog("Crystal extraction complete. Energy absorption successful.");
                    return "Crystals harvested safely. +20 Salvage, +15 Energy.";
                }
            },
            {
                text: "Aggressive harvesting",
                desc: "+40 Salvage, +30 Energy. 25% chance of crystal detonation.",
                effect: (state) => {
                    if (Math.random() < 0.25) {
                        // Detonation
                        const damage = 20;
                        state.energy = Math.max(0, state.energy - damage);
                        state.addLog("Crystal matrix destabilized! Energy feedback surge. -20 Energy.");

                        const crew = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (crew.length > 0 && Math.random() < 0.5) {
                            const victim = crew[Math.floor(Math.random() * crew.length)];
                            victim.status = 'INJURED';
                            state.addLog(`${victim.name} caught in the blast. INJURED.`);
                            return `Crystal detonation! ${victim.name} INJURED. -20 Energy.`;
                        }

                        return `Crystal detonation! -20 Energy from feedback surge.`;
                    }

                    state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                    state.energy = Math.min(100, state.energy + 30);
                    state.addLog("Aggressive crystal harvesting successful. Major yield.");
                    return "Full crystal harvest! +40 Salvage, +30 Energy.";
                }
            },
            {
                text: "Study the resonance patterns",
                desc: "+Colony knowledge. Mira gains insights.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;

                    // Mira special interaction
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) {
                        mira.stress = Math.max(0, (mira.stress || 0) - 1);
                        state.addLog(`Mira: "These frequencies... it's like music. I think I understand something now."`);
                        state.addLog("Tech Mira found peace in the crystal harmonics. -1 Stress.");
                    }

                    state.energy = Math.min(100, state.energy + 10);
                    return "Crystal study complete. +Colony knowledge. +10 Energy from resonance tap.";
                }
            }
        ]
    },

    // --- 5. HOLLOW ASTEROID ---
    {
        id: 'ASTEROID_HOLLOW',
        weight: 10,
        title: "HOLLOW ASTEROID",
        context: (name) => `${name} has an empty core. Not eroded — carved. Someone hollowed out this rock and built inside it. The entrance is barely visible. Whatever's inside has been here a long time.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Hidden base. Could be pirates. Could be worse." },
            { speaker: 'Tech Mira', text: "Power signatures inside. Something's still running." },
            { speaker: 'A.U.R.A.', text: "I cannot identify the interior systems. They are not of human design." }
        ],
        choices: [
            {
                text: "Enter and explore",
                desc: "Unknown rewards. Unknown risks. This is not human-made.",
                effect: (state) => {
                    const roll = Math.random();

                    if (roll < 0.3) {
                        // Bad
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("Inside was... wrong. Geometry that hurt to look at. We left quickly.");
                        return "Exploration disturbing. All crew +1 Stress. Nothing salvageable.";
                    } else if (roll < 0.7) {
                        // Good
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 50);
                        state.energy = Math.min(100, state.energy + 25);
                        state.addLog("Found ancient cache of unknown origin. Materials compatible with our systems.");
                        return "Ancient storage found. +50 Salvage, +25 Energy.";
                    } else {
                        // Great but strange
                        if (typeof ITEMS !== 'undefined' && ITEMS.ALIEN_ARTIFACT) {
                            state.cargo = state.cargo || [];
                            state.cargo.push({ ...ITEMS.ALIEN_ARTIFACT, acquiredAt: 'Hollow Asteroid' });
                            state.addLog("Something was left for us. Deliberately. It wanted to be found.");
                            return "Found: Alien Artifact. Someone wanted us to have this.";
                        }
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 5;
                        return "The hollow contained knowledge. We remember it now. +5 Colony knowledge.";
                    }
                }
            },
            {
                text: "Scan from outside only",
                desc: "+15 Salvage from surface. Safe option.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("Surface minerals extracted. We left the interior alone.");
                    return "Safe extraction. +15 Salvage. Interior remains unexplored.";
                }
            },
            {
                text: "Send probe inside",
                desc: "Probe explores. You stay safe. Probe takes 30% damage.",
                effect: (state) => {
                    if (state.probeIntegrity <= 0) {
                        state.addLog("No probe available for interior scan.");
                        return "Probe unavailable. Exploration aborted.";
                    }

                    state.probeIntegrity = Math.max(0, state.probeIntegrity - 30);

                    if (Math.random() < 0.5) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                        state.addLog(`Probe mapped interior. Found salvageable materials. Probe integrity: ${state.probeIntegrity.toFixed(0)}%`);
                        return `Probe exploration complete. +30 Salvage. Probe damaged.`;
                    }

                    state.addLog(`Probe feed... strange. Footage doesn't make sense. Probe integrity: ${state.probeIntegrity.toFixed(0)}%`);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    return "Probe returned with confusing data. +Colony knowledge from analysis.";
                }
            }
        ]
    },

    // --- 6. ICE FIELD ---
    {
        id: 'ASTEROID_ICE',
        weight: 15,
        title: "ICE ASTEROID FIELD",
        context: (name) => `${name} is frozen water and gases. Comets that never found a sun. We can crack ice for fuel conversion, but the field is dense and visibility is poor. Dangerous but necessary work.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Ice means water means fuel. Let's get what we need." },
            { speaker: 'Dr. Aris', text: "Be careful. Frozen gases can be volatile." },
            { speaker: 'A.U.R.A.', text: "Recommend thermal extraction. Minimize impact force." }
        ],
        choices: [
            {
                text: "Thermal extraction (safe)",
                desc: "+25 Energy from ice-to-fuel conversion.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 25);
                    state.addLog("Ice harvested and converted. Ship reserves replenished.");
                    return "Thermal extraction complete. +25 Energy.";
                }
            },
            {
                text: "Mass harvesting",
                desc: "+40 Energy, +15 Salvage (mineral cores). 20% outgassing risk.",
                effect: (state) => {
                    if (Math.random() < 0.20) {
                        state.energy = Math.max(0, state.energy - 15);
                        state.addLog("Gas pocket breach! Emergency venting required. -15 Energy.");
                        return "Outgassing incident! Mass harvest aborted. -15 Energy from damage.";
                    }

                    state.energy = Math.min(100, state.energy + 40);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("Mass ice harvest successful. Fuel and minerals recovered.");
                    return "Full harvest complete. +40 Energy, +15 Salvage.";
                }
            },
            {
                text: "Check for frozen cargo",
                desc: "Previous expeditions may have cached supplies here.",
                effect: (state) => {
                    if (Math.random() < 0.4) {
                        state.rations = Math.min(state.maxRations, state.rations + 5);
                        state.addLog("Found frozen supply cache! Preserved rations recovered. +5 Rations.");
                        return "Supply cache found! +5 Rations preserved in ice.";
                    }

                    state.energy = Math.min(100, state.energy + 15);
                    state.addLog("No caches found. Basic ice conversion complete. +15 Energy.");
                    return "No caches. Basic fuel conversion only. +15 Energy.";
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
        desc: 'Dense debris field. Mining potential confirmed. Navigation hazards present.',
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
