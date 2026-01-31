/**
 * EXODUS DERELICT ENCOUNTERS
 *
 * Previous Exodus ships (1-8) that crashed, landed, or were abandoned.
 * Each encounter has a type, weighted chance, narrative text, crew reactions,
 * and 2-3 moral/resource choices.
 *
 * Found on planets with EXODUS_WRECK tag (detected via deep scan).
 * Separate from normal EVA — this is a dedicated investigation.
 */

const EXODUS_SHIP_NAMES = [
    'EXODUS-1 "PIONEER"',
    'EXODUS-2 "COVENANT"',
    'EXODUS-3 "SOJOURN"',
    'EXODUS-4 "REQUIEM"',
    'EXODUS-5 "LAZARUS"',
    'EXODUS-6 "ICARUS"',
    'EXODUS-7 "MERIDIAN"',
    'EXODUS-8 "ORPHEUS"'
];

const EXODUS_ENCOUNTERS = [
    // --- 1. BURNED OUT: Total destruction, minimal salvage ---
    {
        id: 'EXODUS_BURNED',
        weight: 25,
        title: "BURNED HULL",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `The ${shipName} is barely recognizable. The hull breached on atmospheric entry — a catastrophic burn-through. The crew compartments are fused slag. Only the black box transponder survived, still pinging after all these years.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Nothing left but carbon scoring. Whatever happened, it was fast." },
            { speaker: 'Dr. Aris', text: "At least it was fast. That's... something." }
        ],
        choices: [
            {
                text: "Retrieve black box",
                desc: "+10 Salvage (transponder components). Colony knowledge gained.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const loreTexts = [
                        "EXODUS LOG: '...entry angle miscalculated by 0.3 degrees. That was all it took.'",
                        "EXODUS LOG: '...the shielding was rated for 3 entries. This was our fourth.'",
                        "EXODUS LOG: '...tell my daughter we tried. We really tried.'"
                    ];
                    state.addLog(loreTexts[Math.floor(Math.random() * loreTexts.length)]);
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Recovered flight data — honoring the lost');
                    return "Black box recovered. Transponder components salvaged. +10 Salvage. Colony knowledge improved.";
                }
            },
            {
                text: "Strip remaining alloys (-5 Energy)",
                desc: "+25 Salvage from hull fragments.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    return "Hull fragments stripped. +25 Salvage. (-5 Energy)";
                }
            }
        ]
    },

    // --- 2. CREW DEAD: Intact hull, dead crew ---
    {
        id: 'EXODUS_DEAD_CREW',
        weight: 25,
        title: "SILENT SHIP",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `The ${shipName} landed intact. The hull is sealed, life support still cycling dead air. Inside: twenty-three crew, all at their stations. No signs of trauma. No struggle. They just... stopped.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "They're at peace. Whatever took them, they didn't suffer." },
            { speaker: 'Spc. Vance', text: "That cargo hold is full. Medicine, rations, tools. Everything we need." },
            { speaker: 'Dr. Aris', text: "Kael. They deserve burial rites at minimum." }
        ],
        choices: [
            {
                text: "Full burial, take only logs",
                desc: "-1 Ration (ceremony), all crew -1 Stress. Ship logs preserved.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    const loreTexts = [
                        "EXODUS LOG: '...the planet's magnetic field interfered with our neural implants. One by one, we stopped dreaming. Then we stopped waking.'",
                        "EXODUS LOG: '...CO2 scrubber failure, gradual. Nobody noticed until it was too late. The alarms were disabled to save power.'"
                    ];
                    state.addLog(loreTexts[Math.floor(Math.random() * loreTexts.length)]);
                    return "Burial rites performed. Crew takes comfort in the ceremony. (-1 Ration)";
                }
            },
            {
                text: "Strip everything",
                desc: "+40 Salvage, +1 Food Pack, all crew +1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                    // Add food pack to cargo
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Wreck' });
                    }
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    return "Ship stripped clean. The dead stare at us as we carry their food out. +40 Salvage, +Food Pack. Crew morale shaken.";
                }
            },
            {
                text: "Take supplies, leave personal effects",
                desc: "+20 Salvage, +1 Food Pack. Balanced approach.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Wreck' });
                    }
                    return "We took what they won't need and left what mattered to them. +20 Salvage, +Food Pack.";
                }
            }
        ]
    },

    // --- 3. CRYO SURVIVORS: Living humans in cryosleep ---
    // UPDATED: No "join crew" option - we don't have cryo tech to wake them properly
    {
        id: 'EXODUS_CRYO',
        weight: 10,
        title: "THE SLEEPERS",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `The ${shipName}'s power grid is barely functional — diverted entirely to the cryo bay. Three pods. Green status lights. Living heartbeats on the monitor. They've been asleep for decades.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "They're alive. Vitals are stable, but the power cells are at 2%. Another month and they'd have died in their sleep." },
            { speaker: 'Dr. Aris', text: "We don't have the equipment to wake them safely. Cryo revival requires specialized medical bays we don't have." },
            { speaker: 'Spc. Vance', text: "So we just... leave them? Or..." },
            { speaker: 'Eng. Jaxon', text: "Those cryo batteries though... each one holds enough charge for 70% of our reserves." }
        ],
        choices: [
            {
                text: "Download their logs, leave them sleeping",
                desc: "+15 Salvage (data crystals). +Colony Knowledge. Crew respects the decision.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const loreTexts = [
                        "CRYO LOG: '...the sky turned copper three days before launch. They said it was atmospheric copper oxide. We knew it was fire.'",
                        "CRYO LOG: '...I volunteered for the long sleep because I couldn't watch Earth die. Cowardice or self-preservation? Does it matter now?'",
                        "CRYO LOG: '...my children's faces are the last thing I remember. I hope whoever finds us tells them we tried.'"
                    ];
                    state.addLog(loreTexts[Math.floor(Math.random() * loreTexts.length)]);
                    state.addLog("We copied their memories to our archives. They'll sleep on, dreaming of an Earth that no longer exists.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Preserved the sleepers and their memories');
                    return "Logs recovered. We leave the pods humming. It's the hardest kind of mercy — hope without promise. (+15 Salvage, +Colony Knowledge)";
                }
            },
            {
                text: "Take the cryo batteries",
                desc: "+70 Energy. Sleepers will not wake. All crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 70);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("Dr. Aris: \"You're killing them. You know that.\"");
                    state.addLog("Cmdr. Kael: \"They were already dead. They just didn't know it yet.\"");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-2, 'Killed sleepers for power');
                    return "Cryo batteries extracted. +70 Energy. The green lights turn red, then dark.";
                }
            },
            {
                text: "Mercy kill — end their dreaming",
                desc: "Quick, painless. +20 Salvage (pod components). Mixed crew reaction.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    // Some crew approve, some don't
                    const numStressed = Math.floor(Math.random() * 2) + 1;
                    let stressedCount = 0;
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && stressedCount < numStressed) {
                            c.stress = Math.min(3, (c.stress || 0) + 1);
                            stressedCount++;
                        }
                    });
                    state.addLog("Dr. Aris initiates the shutdown sequence. The heartbeats slow, then stop.");
                    state.addLog("Spc. Vance: \"Better than waking up alone in a dead ship. Better than slowly freezing when the power fails.\"");
                    return "The sleepers pass peacefully. Pod components salvaged. +20 Salvage. Some crew are disturbed.";
                }
            }
        ]
    },

    // --- 4. SUPPLY CACHE: Cargo hold intact ---
    {
        id: 'EXODUS_CACHE',
        weight: 15,
        title: "THE STOCKPILE",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `The ${shipName}'s crew quarters are wrecked, but the cargo hold is hermetically sealed and intact. Inside: neatly stacked supply crates, labeled and dated. Someone organized this before they died — they knew someone would come.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "They left this for us. Labeled, organized, sealed. They knew they were done." },
            { speaker: 'Tech Mira', text: "There's a note on the top crate. It says 'For whoever comes next.'" }
        ],
        choices: [
            {
                text: "Take everything",
                desc: "+30 Salvage, +2 Food Packs, +1 Luxury item.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    if (typeof ITEMS !== 'undefined') {
                        if (ITEMS.FOOD_PACK) {
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Cache' });
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Cache' });
                        }
                        if (ITEMS.LUXURY_CHOCOLATE) {
                            state.cargo.push({ ...ITEMS.LUXURY_CHOCOLATE, acquiredAt: 'Exodus Cache' });
                        }
                    }
                    return "Cache cleared out. +30 Salvage, +2 Food Packs, +Synth-Chocolate. Whoever left this — thank you.";
                }
            },
            {
                text: "Take only essentials",
                desc: "+1 Food Pack, +15 Salvage. Crew respects restraint — all crew -1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Cache' });
                    }
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Took only essentials — showed restraint');
                    return "We took what we needed and sealed the hold. Honoring what they left behind. +15 Salvage, +Food Pack. Crew morale steadied.";
                }
            }
        ]
    },

    // --- 5. INFECTED: Bio-contaminated ship ---
    {
        id: 'EXODUS_INFECTED',
        weight: 10,
        title: "THE GROWTH",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `The ${shipName}'s hull is covered in a pulsing, bioluminescent fungal growth. The airlock is partially dissolved. Inside, the walls breathe. The crew's remains are fused into the biomass. But deep in the wreckage, sensors detect high-value tech — still operational.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "This is a xenobiological infection. The crew became substrate. Don't touch anything without gloves." },
            { speaker: 'Tech Mira', text: "The lab equipment is still powered. If we can extract it, it could be worth the risk." },
            { speaker: 'Spc. Vance', text: "One spore. That's all it takes. I've seen this before." }
        ],
        choices: [
            {
                text: "Send team in (Medic required)",
                desc: "Aris leads decontamination. Rare item + Salvage. Small risk.",
                effect: (state) => {
                    const hasMedic = state.crew.some(c => c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (!hasMedic) {
                        return "No qualified medic available. Too dangerous to proceed without decontamination protocols.";
                    }
                    // 15% chance of injury even with medic
                    if (Math.random() < 0.15) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`WARNING: ${victim.name} exposed to spores during extraction. Quarantine initiated.`);
                        }
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    // Chance for revival items
                    if (typeof ITEMS !== 'undefined') {
                        const revivalItem = Math.random() > 0.5 ? ITEMS.XENO_MYCELIUM : ITEMS.FUNGUS_CULTURE;
                        state.cargo.push({ ...revivalItem, acquiredAt: 'Exodus Wreck (Infected)' });
                        state.addLog(`Recovered: ${revivalItem.name}`);
                    }
                    return "Decontamination successful. Lab equipment and biological samples extracted. +35 Salvage.";
                }
            },
            {
                text: "Burn it from orbit",
                desc: "Destroy the infection. +10 Energy (thermal harvest). Safe.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 10);
                    state.addLog("Eng. Jaxon: \"Burn it all. Some things shouldn't survive.\"");
                    return "Orbital lance deployed. The growth screams — yes, screams — as it burns. +10 Energy from thermal bloom.";
                }
            },
            {
                text: "Harvest spores carefully",
                desc: "Dangerous. Mycelium sample if successful, crew injury if not.",
                effect: (state) => {
                    if (Math.random() < 0.4) {
                        // Failure
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`CRITICAL: ${victim.name} infected during spore harvest. Emergency decontamination.`);
                        }
                        return "Containment breach. Spore sample lost during emergency evacuation.";
                    }
                    if (typeof ITEMS !== 'undefined' && ITEMS.XENO_MYCELIUM) {
                        state.cargo.push({ ...ITEMS.XENO_MYCELIUM, acquiredAt: 'Exodus Wreck (Infected)' });
                    }
                    return "Spore sample contained. Xeno-Mycelium secured for further study.";
                }
            }
        ]
    },

    // --- 6. EXODUS LOG: Black box with lore ---
    {
        id: 'EXODUS_LOG',
        weight: 10,
        title: "THE BLACK BOX",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `Only the flight recorder remains of the ${shipName}. The ship itself is atomized — scattered across a crater three kilometers wide. But the black box is military-grade. It survived.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "The data is dense. Weeks of logs compressed into a single crystal." },
            { speaker: 'A.U.R.A.', text: "Decryption will require significant processing power. Estimated cost: 10 Energy." }
        ],
        choices: [
            {
                text: "Decrypt the full log (-10 Energy)",
                desc: "+15 Salvage (encryption hardware). Colony knowledge gained. Extended lore.",
                effect: (state) => {
                    if (state.energy < 10) return "Insufficient energy for full decryption.";
                    state.energy -= 10;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const loreBlocks = [
                        [
                            "EXODUS PROGRAM BRIEFING: Ten ships. Ten chances. Earth's atmosphere was collapsing — not slowly, but in a cascade.",
                            "The selection process was brutal. Each crew of 30 chosen from millions. Genetic diversity, psychological resilience, technical expertise.",
                            "The destination coordinates were calculated by an AI called GENESIS. It identified 47 potential colony sites across 5 sectors of deep space."
                        ],
                        [
                            "CAPTAIN'S LOG: 'We launched knowing the odds. One in ten ships might find a habitable world. The rest would die in the dark.'",
                            "'Earth had six months left. Maybe less. The oceans were boiling in the equatorial zones. The poles were the last refuge, and they were melting.'",
                            "'They told us we were humanity's hope. They didn't tell us we were also humanity's apology.'"
                        ],
                        [
                            "ENGINEERING REPORT: 'The drives were prototype. Rated for 50 light-years. We needed 200. The math never worked, but nobody wanted to do the math.'",
                            "MEDICAL OFFICER'S LOG: 'Cryo failure rate: 12%. That means three of our people won't wake up. I've already decided not to tell them who.'",
                            "FINAL TRANSMISSION FROM EARTH: '...skies are copper now. The fires have joined into one. This is Mission Control, signing off. Godspeed, Exodus. All of you.'"
                        ]
                    ];
                    const block = loreBlocks[Math.floor(Math.random() * loreBlocks.length)];
                    block.forEach(line => state.addLog(line));
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Full decryption — honored their data');
                    return "Full decryption complete. Encryption hardware salvaged. +15 Salvage. Colony knowledge improved. (-10 Energy)";
                }
            },
            {
                text: "Quick scan (free)",
                desc: "+10 Salvage (box components). Partial lore fragment.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    const fragments = [
                        "EXODUS LOG FRAGMENT: '...we are ship number [CORRUPTED]. There are [CORRUPTED] others. None have reported in.'",
                        "EXODUS LOG FRAGMENT: '...the coordinates were wrong. GENESIS lied, or GENESIS was broken. Either way, we're in the wrong sector.'",
                        "EXODUS LOG FRAGMENT: '...the children born in transit don't remember Earth. They call the ship 'world.' Maybe that's better.'"
                    ];
                    state.addLog(fragments[Math.floor(Math.random() * fragments.length)]);
                    return "Partial log recovered. Stripped black box casing for parts. +10 Salvage.";
                }
            }
        ]
    },

    // --- 7. PARTIALLY OPERATIONAL: Ship can be looted room by room ---
    {
        id: 'EXODUS_PARTIAL',
        weight: 15,
        title: "THE SURVIVOR",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `The ${shipName} made it down in one piece. The landing gear deployed, the cargo secured. Then the crew tried to colonize. The half-built shelters outside tell the story — they lasted maybe a year. The ship's interior is dusty but functional. Some systems still have power.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "This ship is almost identical to ours. Same class. Same vintage. I could strip parts from this for weeks." },
            { speaker: 'Dr. Aris', text: "There are personal effects everywhere. Journals. Children's drawings. They tried to make it a home." },
            { speaker: 'Spc. Vance', text: "Focus. What can we use?" }
        ],
        choices: [
            {
                text: "Thorough salvage operation (-10 Energy)",
                desc: "+50 Salvage, +1 Food Pack, +1 Music Holotape.",
                effect: (state) => {
                    if (state.energy < 10) return "Insufficient energy for full salvage operation.";
                    state.energy -= 10;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 50);
                    if (typeof ITEMS !== 'undefined') {
                        if (ITEMS.FOOD_PACK) state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Wreck' });
                        if (ITEMS.MUSIC_HOLOTAPE) state.cargo.push({ ...ITEMS.MUSIC_HOLOTAPE, acquiredAt: 'Exodus Wreck' });
                    }
                    state.addLog("EXODUS LOG: 'If you're reading this, don't make our mistakes. Don't build shelters before you understand the soil. The ground here... changes.'");
                    return "Full salvage complete. +50 Salvage, +Food Pack, +Music Holotape. (-10 Energy)";
                }
            },
            {
                text: "Grab essentials and go",
                desc: "+25 Salvage, +1 Food Pack. Quick and efficient.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Wreck' });
                    }
                    return "Essential supplies secured. +25 Salvage, +Food Pack.";
                }
            },
            {
                text: "Search for tech upgrades (-5 Energy)",
                desc: "Chance for ship upgrade component. Riskier but high value.",
                effect: (state) => {
                    if (state.energy < 5) return "Insufficient energy for tech search.";
                    state.energy -= 5;
                    // 40% chance to find useful tech
                    if (Math.random() < 0.4) {
                        if (typeof ITEMS !== 'undefined' && ITEMS.TECH_FRAGMENT) {
                            state.cargo.push({ ...ITEMS.TECH_FRAGMENT, acquiredAt: 'Exodus Wreck' });
                        }
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                        return "Found compatible tech components in the engineering bay. +Tech Fragment, +15 Salvage. (-5 Energy)";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    return "Tech systems too degraded to salvage. Recovered minor components. +10 Salvage. (-5 Energy)";
                }
            }
        ]
    }
];
