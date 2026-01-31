/**
 * DERELICT ENCOUNTERS
 *
 * Non-Exodus derelict ships found drifting in space or crashed on planets.
 * These are alien vessels, ancient human probes, corporate mining ships, etc.
 * Different from Exodus wrecks - less narrative weight, more varied loot.
 *
 * Found on planets with DERELICT tag or as floating POIs.
 */

const DERELICT_TYPES = [
    'MINING_VESSEL',
    'CORPORATE_HAULER',
    'MILITARY_FRIGATE',
    'SCIENCE_PROBE',
    'ALIEN_CRAFT',
    'GENERATION_SHIP',
    'PIRATE_RAIDER'
];

const DERELICT_ENCOUNTERS = [
    // --- 1. MINING VESSEL: Resource-rich but dangerous ---
    {
        id: 'DERELICT_MINING',
        weight: 25,
        type: 'MINING_VESSEL',
        title: "ABANDONED MINING RIG",
        getName: () => {
            const prefixes = ['DEEPCORE', 'ASTEROID', 'TITAN', 'FERRUM', 'ORE'];
            const suffixes = ['HARVESTER', 'EXTRACTOR', 'DRILLER', 'MINER'];
            const num = Math.floor(Math.random() * 900) + 100;
            return `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${suffixes[Math.floor(Math.random() * suffixes.length)]}-${num}`;
        },
        context: (name) => `The ${name} is a hulking industrial vessel, drill arrays frozen mid-extraction. Cargo bays partially full. They were mid-haul when something stopped them. Emergency lights still pulse in the ore processing deck.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Industrial grade. These rigs carry serious tonnage. If the cargo's intact..." },
            { speaker: 'Tech Mira', text: "I'm reading residual radiation from the processing core. They were refining something hot." }
        ],
        choices: [
            {
                text: "Salvage the cargo bays",
                desc: "+30-50 Salvage. Safe approach.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 21) + 30; // 30-50
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    return `Cargo bay ransacked. Unrefined ore and spare parts recovered. +${salvage} Salvage.`;
                }
            },
            {
                text: "Extract from the reactor (-10 Energy)",
                desc: "Risk: 20% crew injury. Reward: +50-70 Energy.",
                requires: (state) => state.energy >= 10,
                requiresLabel: "Need 10 Energy",
                effect: (state) => {
                    state.energy -= 10;
                    if (Math.random() < 0.2) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`RADIATION EXPOSURE: ${victim.name} received dangerous dose during extraction.`);
                        }
                    }
                    const energyGain = Math.floor(Math.random() * 21) + 50; // 50-70
                    state.energy = Math.min(100, state.energy + energyGain);
                    return `Reactor cores drained. Dangerous but worth it. +${energyGain} Energy (net +${energyGain - 10}).`;
                }
            },
            {
                text: "Check crew quarters for supplies",
                desc: "+10-20 Salvage, chance for Food Pack or luxury item.",
                effect: (state) => {
                    const salvage = Math.floor(Math.random() * 11) + 10; // 10-20
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    if (Math.random() < 0.4 && typeof ITEMS !== 'undefined') {
                        const item = Math.random() > 0.5 ? ITEMS.FOOD_PACK : ITEMS.LUXURY_CHOCOLATE;
                        if (item) {
                            state.cargo.push({ ...item, acquiredAt: 'Mining Derelict' });
                            return `Found personal supplies in the bunks. +${salvage} Salvage, +${item.name}.`;
                        }
                    }
                    return `Quarters stripped bare. Previous scavengers got here first. +${salvage} Salvage.`;
                }
            }
        ]
    },

    // --- 2. CORPORATE HAULER: Trade goods and secrets ---
    {
        id: 'DERELICT_HAULER',
        weight: 20,
        type: 'CORPORATE_HAULER',
        title: "CORPORATE FREIGHTER",
        getName: () => {
            const corps = ['WEYLAND', 'AXIOM', 'NEXUS', 'STERLING', 'PROMETHEUS'];
            const types = ['TRANSIT', 'CARGO', 'SUPPLY', 'FREIGHT'];
            return `${corps[Math.floor(Math.random() * corps.length)]}-${types[Math.floor(Math.random() * types.length)]}-${Math.floor(Math.random() * 99) + 1}`;
        },
        context: (name) => `The ${name} bears faded corporate livery. Manifest terminal still flickers. A supply run to a colony that no longer exists. Biometric locks on the hold, but security is long dead.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Corporate vessel. These things carried everything — medicine, weapons, colonist supplies." },
            { speaker: 'Dr. Aris', text: "The medical bay might still have viable pharmaceuticals. These corps spared no expense." }
        ],
        choices: [
            {
                text: "Crack the main cargo hold",
                desc: "+30 Salvage, +2 Food Packs.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Corporate Hauler' });
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Corporate Hauler' });
                    }
                    return "Cargo hold breached. Colony supplies still sealed. +30 Salvage, +2 Food Packs.";
                }
            },
            {
                text: "Raid the medical bay",
                desc: "Heal one injured crew member OR +1 revival item if no injuries.",
                effect: (state) => {
                    const injured = state.crew.find(c => c.status === 'INJURED');
                    if (injured) {
                        injured.status = 'HEALTHY';
                        return `Medical supplies used to treat ${injured.name}. Fully recovered.`;
                    }
                    // No injuries — find revival item
                    if (typeof ITEMS !== 'undefined') {
                        const revival = Math.random() > 0.5 ? ITEMS.XENO_MYCELIUM : ITEMS.NEURAL_LINK;
                        if (revival) {
                            state.cargo.push({ ...revival, acquiredAt: 'Corporate Hauler' });
                            return `No injuries to treat. Found experimental medical tech: ${revival.name}.`;
                        }
                    }
                    return "Medical bay ransacked. Nothing of value remains.";
                }
            },
            {
                text: "Download corporate database",
                desc: "+Colony knowledge. Learn from their failures.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("CORPORATE LOG: 'Colony XR-7 failed due to soil toxicity. Recommended: deep soil analysis before agricultural deployment.'");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Preserved corporate knowledge');
                    return "Database downloaded. Colony failure reports archived. Knowledge gained.";
                }
            }
        ]
    },

    // --- 3. MILITARY FRIGATE: Weapons and danger ---
    {
        id: 'DERELICT_MILITARY',
        weight: 10,
        type: 'MILITARY_FRIGATE',
        title: "DECOMMISSIONED WARSHIP",
        getName: () => {
            const names = ['IRON RESOLVE', 'SILENT FURY', 'DARK HORIZON', 'LAST STAND', 'VOID HUNTER'];
            return `UES ${names[Math.floor(Math.random() * names.length)]}`;
        },
        context: (name) => `The ${name} is a pre-Exodus military vessel, its hull scarred by ancient combat. The weapons systems are cold, but the armory might still hold ordnance. Warning beacons declare this a restricted salvage zone — but who's left to enforce that?`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Military grade. I know these ships. The armory will be locked down tight, but the engineering bay..." },
            { speaker: 'A.U.R.A.', text: "Caution advised. Military vessels often contain active countermeasures." }
        ],
        choices: [
            {
                text: "Breach the armory (Vance required)",
                desc: "+25 Salvage, +Tech Fragment. Requires security specialist.",
                requires: (state) => state.crew.some(c => c.tags.includes('SECURITY') && c.status !== 'DEAD'),
                requiresLabel: "Requires Vance",
                effect: (state) => {
                    const vance = state.crew.find(c => c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    if (typeof ITEMS !== 'undefined' && ITEMS.TECH_FRAGMENT) {
                        state.cargo.push({ ...ITEMS.TECH_FRAGMENT, acquiredAt: 'Military Frigate' });
                    }
                    return `${vance.name} cracks the armory seals. Weapons systems recovered. +25 Salvage, +Tech Fragment.`;
                }
            },
            {
                text: "Strip the engine components",
                desc: "+35 Salvage, +20 Energy.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    state.energy = Math.min(100, state.energy + 20);
                    return "Military-grade reactor components extracted. Superior engineering. +35 Salvage, +20 Energy.";
                }
            },
            {
                text: "Access the tactical database",
                desc: "Reveals all planet tags in current sector.",
                effect: (state) => {
                    // Mark all planets as having tags revealed
                    if (state.sectorNodes) {
                        state.sectorNodes.forEach(p => {
                            p._tagsRevealed = true;
                        });
                    }
                    state.addLog("TACTICAL DATABASE: Sector scan data uploaded. All anomalies now visible on nav map.");
                    return "Military sensors revealed hidden signatures across the sector. All planet tags now visible.";
                }
            }
        ]
    },

    // --- 4. SCIENCE PROBE: Data and weird stuff ---
    {
        id: 'DERELICT_PROBE',
        weight: 15,
        type: 'SCIENCE_PROBE',
        title: "ANCIENT RESEARCH PROBE",
        getName: () => {
            const missions = ['VOYAGER', 'PIONEER', 'HORIZON', 'DEEP FIELD', 'KEPLER'];
            return `${missions[Math.floor(Math.random() * missions.length)]}-${Math.floor(Math.random() * 50) + 1}`;
        },
        context: (name) => `The ${name} is a pre-Exodus deep space probe, its antenna array still pointed toward a star that died millennia ago. The data banks are corrupted but partially readable. Someone built this to last.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "This is incredible! Pre-collapse science hardware. The data compression alone..." },
            { speaker: 'Dr. Aris', text: "Be careful. Some of these old probes carried biological samples." }
        ],
        choices: [
            {
                text: "Download the star charts",
                desc: "Reveals one unexplored planet's resources.",
                effect: (state) => {
                    const unscanned = state.sectorNodes?.filter(p => !p.remoteScanned && !p.scanned);
                    if (unscanned && unscanned.length > 0) {
                        const target = unscanned[Math.floor(Math.random() * unscanned.length)];
                        target.remoteScanned = true;
                        return `Star chart data recovered. ${target.name} now visible on sensors.`;
                    }
                    return "All planets in sector already scanned. Charts provided no new data.";
                }
            },
            {
                text: "Extract the sample containers",
                desc: "Random artifact or biological item.",
                effect: (state) => {
                    if (typeof ITEMS !== 'undefined') {
                        const samples = [ITEMS.AMBER_SPECIMEN, ITEMS.RADIOTROPHIC_FUNGUS, ITEMS.GEODE_SAMPLE];
                        const item = samples[Math.floor(Math.random() * samples.length)];
                        if (item) {
                            state.cargo.push({ ...item, acquiredAt: 'Science Probe' });
                            return `Sample container intact. Retrieved: ${item.name}.`;
                        }
                    }
                    return "Sample containers breached. Contents lost to vacuum.";
                }
            },
            {
                text: "Salvage the probe hardware",
                desc: "+20 Salvage, +15 Energy from solar arrays.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 15);
                    return "Probe dismantled. Solar arrays and sensor equipment recovered. +20 Salvage, +15 Energy.";
                }
            }
        ]
    },

    // --- 5. ALIEN CRAFT: Weird and valuable ---
    {
        id: 'DERELICT_ALIEN',
        weight: 5,
        type: 'ALIEN_CRAFT',
        title: "UNKNOWN VESSEL",
        getName: () => {
            // Alien ships get designations, not names
            return `UNKNOWN-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(Math.random() * 999)}`;
        },
        context: (name) => `The vessel designated ${name} defies classification. Its hull geometry follows no human design principles. The interior atmosphere is breathable but wrong — the pressure fluctuates in patterns that feel almost like breathing. Something lived here. Something that wasn't us.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "The alloy composition... it's not on any periodic table I know. This is genuine xenotech." },
            { speaker: 'Dr. Aris', text: "I'm getting readings I can't explain. Biological signatures, but not DNA-based. Something else entirely." },
            { speaker: 'Spc. Vance', text: "I don't like this. We don't know what killed them — or if they're actually dead." }
        ],
        choices: [
            {
                text: "Carefully extract xenotech samples",
                desc: "+50 Salvage (alien alloys), all crew +1 Stress (unease).",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 50);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("The metal feels warm. It shouldn't feel warm in vacuum.");
                    return "Alien alloys extracted. The crew is unsettled. +50 Salvage. All crew +1 Stress.";
                }
            },
            {
                text: "Interface with the navigation system",
                desc: "Risky. May reveal hidden sector, or trigger defense.",
                effect: (state) => {
                    if (Math.random() < 0.3) {
                        // Defense triggered
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            victim.stress = Math.min(3, (victim.stress || 0) + 1);
                            return `DEFENSE SYSTEM ACTIVATED: ${victim.name} struck by energy discharge. Injured and traumatized.`;
                        }
                    }
                    // Success - reveal something special
                    state.addLog("ALIEN NAV DATA: Coordinates to an anomaly point decoded. Something waits at the edge of the sector.");
                    state._alienNavData = true;
                    return "Navigation data extracted. The aliens knew paths we don't. Something important is nearby.";
                }
            },
            {
                text: "Seal the vessel and leave",
                desc: "No gain, but no risk. All crew -1 Stress (relief).",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    state.addLog("We sealed the airlock and backed away. Some doors are better left closed.");
                    return "Vessel sealed. The crew breathes easier. All crew -1 Stress.";
                }
            }
        ]
    },

    // --- 6. GENERATION SHIP: Massive, tragic ---
    {
        id: 'DERELICT_GENERATION',
        weight: 5,
        type: 'GENERATION_SHIP',
        title: "GENERATION SHIP FRAGMENT",
        getName: () => {
            const names = ['ETERNAL JOURNEY', 'THOUSAND YEARS', 'HOPE\'S DREAM', 'NEW BEGINNING', 'DISTANT SHORE'];
            return names[Math.floor(Math.random() * names.length)];
        },
        context: (name) => `The ${name} was built to carry ten thousand souls across centuries. Now it drifts in pieces, its habitation rings shattered. Entire generations lived and died inside these walls, never knowing the sky. The forward section is intact — a city frozen in time.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "These people were born, lived, and died in transit. Hundreds of years of culture, frozen in place." },
            { speaker: 'Eng. Jaxon', text: "The engineering section is massive. We could salvage for months." },
            { speaker: 'A.U.R.A.', text: "I am detecting preserved cryogenic units in the forward section. Probability of viable sleepers: 3.2%." }
        ],
        choices: [
            {
                text: "Explore the habitation rings",
                desc: "+35 Salvage, +3 Food Packs, +Music Holotape.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    if (typeof ITEMS !== 'undefined') {
                        if (ITEMS.FOOD_PACK) {
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Generation Ship' });
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Generation Ship' });
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Generation Ship' });
                        }
                        if (ITEMS.MUSIC_HOLOTAPE) {
                            state.cargo.push({ ...ITEMS.MUSIC_HOLOTAPE, acquiredAt: 'Generation Ship' });
                        }
                    }
                    state.addLog("SHIP LOG: 'Generation 7 Report: Children born this cycle have never seen stars. They think the murals are windows.'");
                    return "Habitation rings explored. Centuries of accumulated supplies. +35 Salvage, +3 Food Packs, +Music Holotape.";
                }
            },
            {
                text: "Check the cryogenic units",
                desc: "3% chance: Wake survivors (-5 Rations, all crew -1 Stress). Otherwise: salvage.",
                effect: (state) => {
                    if (Math.random() < 0.03) {
                        // Survivors!
                        state.rations = Math.max(0, state.rations - 5);
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                        });
                        state.addLog("Against all odds, two survivors wake. They speak a dialect we barely understand — their ship launched before ours. They weep when told Earth is gone.");
                        return "Survivors revived. They join us, bringing hope. -5 Rations. All crew -1 Stress.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 25);
                    return "No viable sleepers. Cryogenic systems salvaged for parts. +20 Salvage, +25 Energy.";
                }
            },
            {
                text: "Access the cultural archive",
                desc: "+Colony knowledge. Learn from their social failures.",
                effect: (state) => {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("CULTURAL ARCHIVE: 'Generation 12 Rebellion suppressed. Root cause: resource inequality between decks. Recommendation: transparent rationing.'");
                    state.addLog("CULTURAL ARCHIVE: 'Generation 15 Plague contained. Root cause: closed-loop air system. Recommendation: redundant filtration.'");
                    return "Centuries of social experiments documented. This will help when we settle.";
                }
            }
        ]
    }
];

// Export for use
if (typeof window !== 'undefined') {
    window.DERELICT_ENCOUNTERS = DERELICT_ENCOUNTERS;
    window.DERELICT_TYPES = DERELICT_TYPES;
}
