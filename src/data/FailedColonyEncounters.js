// FAILED_COLONY_ENCOUNTERS: Narrative encounters on planets with FAILED_COLONY tag
// These are emotional setpieces — visiting what remains of previous colonization attempts
// Structure mirrors ExodusDerelicts.js pattern

const FAILED_COLONY_ENCOUNTERS = [
    {
        id: 'FC_ABANDONED_DOME',
        weight: 25,
        title: 'THE DOME',
        context: function(planetName) {
            return `Satellite imagery confirms artificial structures on ${planetName}'s southern continent. A pressurized dome complex, partially collapsed. Gardens overgrown with local vegetation. No movement detected.`;
        },
        dialogue: [
            { speaker: 'Dr. Aris', text: "Those are Earth-standard hydroponics rigs. Someone lived here. Maybe for years." },
            { speaker: 'Spc. Vance', text: "Lived. Past tense. Keep your guard up." },
            { speaker: 'Tech Mira', text: "The architecture is modular — same prefab kits we carry. They planned to stay." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "+8-15 Salvage (data drives). Colony knowledge gained.",
                effect: function(state) {
                    const salvage = Math.floor(Math.random() * 8) + 8; // 8-15
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Day 1: We landed! The children are playing in real grass for the first time. Elena cried."');
                    state.addLog('COLONY LOG: "Day 342: The water table is dropping. Joran says the soil chemistry is changing. Something in the root system is pulling minerals we need."');
                    state.addLog('COLONY LOG: "Day 891: We can\'t grow wheat anymore. The local flora is outcompeting everything. We\'re rationing. Again."');
                    state.addLog('COLONY LOG: "Day 1,204: Last entry. Moving to higher ground. The dome seals failed. If anyone finds this — the soil here is alive. It doesn\'t want us."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read colony logs — preserved their story');
                    return `Colony records recovered. Data drives salvaged. +${salvage} Salvage. Colony knowledge improved.`;
                }
            },
            {
                text: "Salvage the settlement",
                desc: "+25-45 Salvage, +1 Food Pack. Strip what they left.",
                effect: function(state) {
                    const salvage = Math.floor(Math.random() * 21) + 25; // 25-45
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Colony Site' });
                    }
                    state.addLog('Eng. Jaxon: "Good materials here. Prefab panels, sealed wiring, intact solar cells. They built well."');
                    return `Settlement stripped. +${salvage} Salvage, +Food Pack. Their homes are now our hull plating.`;
                }
            },
            {
                text: "Check the cryopods",
                desc: "30% chance: find survivor (-3 Rations, crew -1 Stress). Otherwise: empty pods, Aris +1 Stress.",
                effect: function(state) {
                    if (Math.random() < 0.30) {
                        // Found something alive
                        state.addLog('Dr. Aris: "There\'s someone in here! Vitals are... faint, but present. A child. Maybe ten years old."');
                        state.addLog('A.U.R.A.: "Cryostasis integrity at 4%. Revival is possible but will consume 3 rations for recovery nutrition."');
                        state.rations = Math.max(0, state.rations - 3);
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.max(0, (c.stress || 0) - 1);
                        });
                        if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(2, 'Rescued colony survivor');
                        return "A child. Alive. We brought her aboard. The crew hasn't smiled like this in weeks. -3 Rations, all crew stress reduced.";
                    } else {
                        // Empty or dead
                        state.addLog('Spc. Vance: "Empty. All of them. Either they left, or they never made it to the pods."');
                        state.addLog('Dr. Aris: "There are handprints on the glass. Small ones."');
                        const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                        if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                        return "Empty cryopods. Handprints on the glass. Aris is quiet. +1 Stress (Aris).";
                    }
                }
            },
            {
                text: "Assess the failure",
                desc: "A.U.R.A. analyzes what killed them. Improves colony knowledge.",
                effect: function(state) {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('A.U.R.A.: "Analysis complete. Colony failure cause: soil chemistry incompatibility. Local microbiome metabolized Earth-origin nutrients within 18 months."');
                    state.addLog('A.U.R.A.: "Recommendation: avoid planets with aggressive root systems unless terraforming equipment is available. Data logged for future colony site assessment."');
                    return "Failure analysis complete. Colony knowledge improved — this data will help us choose better.";
                }
            }
        ]
    },

    {
        id: 'FC_MASS_GRAVES',
        weight: 20,
        title: 'THE GRAVES',
        context: function(planetName) {
            return `Ground-penetrating radar reveals a settlement grid on ${planetName}. Intact structures. Organized streets. And rows of markers — hundreds of them — arranged in concentric circles around a central building.`;
        },
        dialogue: [
            { speaker: 'Dr. Aris', text: "Those are grave markers. Hundreds of them. Organized by... date, I think." },
            { speaker: 'Eng. Jaxon', text: "The buildings look intact. Whatever killed them wasn't structural." },
            { speaker: 'A.U.R.A.', text: "Atmospheric analysis suggests a pathogenic event. Biological contamination timeline: 6 to 8 months after landing." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "+10 Salvage (data drives). Colony knowledge gained.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Month 3: The cough started with the engineers. Dr. Farah says it\'s just dust irritation from the construction."');
                    state.addLog('COLONY LOG: "Month 5: It\'s not dust. Forty-seven people are bedridden. The pathogen is in the water supply. We can\'t boil it out — it thrives in heat."');
                    state.addLog('COLONY LOG: "Month 7: We bury six a day now. Dr. Farah was the first. The children seem immune. We don\'t understand why."');
                    state.addLog('COLONY LOG: "Month 8: Eighteen of us left. All children. The oldest is fourteen. She\'s writing this because I taught her how. My name is Marcus. I was a pilot. I wish I had been a doctor."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read plague colony records');
                    return "A colony of 300 reduced to 18 children in eight months. Data drives salvaged. +10 Salvage. Colony knowledge improved.";
                }
            },
            {
                text: "Salvage medical supplies",
                desc: "+25 Salvage, possible medical item.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    if (Math.random() < 0.40 && typeof ITEMS !== 'undefined' && ITEMS.FUNGUS_CULTURE) {
                        state.cargo.push({ ...ITEMS.FUNGUS_CULTURE, acquiredAt: 'Colony Site' });
                        state.addLog('Dr. Aris: "They were growing a radiotrophic culture in the lab. Still alive. Remarkably resilient."');
                        return "Medical stores salvaged. +25 Salvage. Found a living Fungus Culture in the laboratory.";
                    }
                    return "Medical stores salvaged. +25 Salvage. Most pharmaceuticals degraded beyond use.";
                }
            },
            {
                text: "Check the cryopods",
                desc: "Emergency stasis units — power readings are dead. +15 Salvage, Aris +1 Stress.",
                effect: function(state) {
                    state.addLog('Spc. Vance: "The central building is a medical facility. Emergency cryo ward. Six pods."');
                    state.addLog('Dr. Aris: "They\'re all occupied. Adults. They put themselves under hoping someone would find a cure."');
                    state.addLog('A.U.R.A.: "Cryostasis power depleted 14 months ago. All occupants are deceased."');
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    return "Six cryo pods. Six bodies. They waited for help that never came. +15 Salvage from equipment. Aris +1 Stress.";
                }
            },
            {
                text: "Assess the failure",
                desc: "A.U.R.A. studies the pathogen. Colony knowledge gained.",
                effect: function(state) {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('A.U.R.A.: "Pathogen identified: protein-folding contaminant native to local water table. Undetectable by standard scan protocols."');
                    state.addLog('A.U.R.A.: "Recommendation: deep molecular scan of water sources before establishing permanent settlement. Data logged."');
                    return "Pathogen catalogued. Colony knowledge improved. We won't make the same mistake.";
                }
            }
        ]
    },

    {
        id: 'FC_CIVIL_WAR',
        weight: 15,
        title: 'THE SCHISM',
        context: function(planetName) {
            return `Two distinct settlement clusters on ${planetName}, separated by 40 kilometers. Both fortified. Blast marks on the walls. The remains of barricades in the streets. This colony didn't fail from the outside.`;
        },
        dialogue: [
            { speaker: 'Spc. Vance', text: "Defensive positions on both sides. Improvised weapons. They turned on each other." },
            { speaker: 'Dr. Aris', text: "How? They survived the journey together. How does that happen?" },
            { speaker: 'Eng. Jaxon', text: "Give people enough pressure and too little food. It always happens." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "+10 Salvage (data drives). Colony knowledge gained.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG — NORTH: "The southern group refuses to share the aquifer. Director Chen says it\'s in their territory. We dug the well."');
                    state.addLog('COLONY LOG — SOUTH: "They stole seed stock in the night. Twelve kilos of modified grain. Without that, our children starve."');
                    state.addLog('COLONY LOG — NORTH: "Shots fired last night. Reko is dead. He was sixteen."');
                    state.addLog('COLONY LOG — FINAL: "We were 200 people. We are now 23. Both councils dissolved. We\'re leaving. Together this time, what\'s left of us. If someone finds this: don\'t split. Whatever happens, don\'t split."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Learned from schism colony');
                    return "200 became 23. Data drives salvaged. +10 Salvage. Colony knowledge improved. Their lesson: unity above all.";
                }
            },
            {
                text: "Salvage both settlements",
                desc: "+45 Salvage. Plenty of materials in two camps.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 45);
                    state.addLog('Eng. Jaxon: "Twice the buildings, twice the salvage. At least something good came of their mess."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Salvaged war colony without learning');
                    return "Both settlements stripped. +45 Salvage. We took from both sides equally. Small comfort.";
                }
            },
            {
                text: "Search for survivors",
                desc: "23 people left. They might still be nearby.",
                effect: function(state) {
                    state.addLog('A.U.R.A.: "Scanning for biosignatures in a 100km radius."');
                    if (Math.random() < 0.20) {
                        state.addLog('A.U.R.A.: "Contact. 8 kilometers northwest. A group of 11. They\'re waving."');
                        state.rations = Math.max(0, state.rations - 2);
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.max(0, (c.stress || 0) - 1);
                        });
                        if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(2, 'Found and helped schism survivors');
                        return "Found 11 survivors camped in the hills. We shared rations and medical supplies. -2 Rations. All crew stress reduced.";
                    } else {
                        state.addLog('A.U.R.A.: "No biosignatures detected. They\'re gone."');
                        return "No survivors found. Whatever was left of them moved on long ago.";
                    }
                }
            },
            {
                text: "Assess the failure",
                desc: "Understand the social collapse. Colony knowledge gained.",
                effect: function(state) {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('A.U.R.A.: "Root cause: insufficient governance framework combined with resource scarcity. Leadership vacuum after original director died in month 4."');
                    state.addLog('A.U.R.A.: "Recommendation: establish clear resource-sharing protocols before crisis. A single authority must control distribution. Data logged."');
                    return "Social collapse analysis complete. Colony knowledge improved. We'll need strong leadership from day one.";
                }
            }
        ]
    },

    {
        id: 'FC_THE_EMPTY',
        weight: 20,
        title: 'THE EMPTY',
        context: function(planetName) {
            return `A complete settlement on ${planetName}. Pressurized. Powered. Lights still on. Tables set for dinner. Beds made. Tools laid out for morning work. Everything in perfect order. No people. Not a single body. Not a single bone.`;
        },
        dialogue: [
            { speaker: 'Tech Mira', text: "The power grid is still running. Solar panels feeding batteries. Automated systems kept everything... alive." },
            { speaker: 'Spc. Vance', text: "Where are they? No bodies, no graves, no evacuation signs. They didn't die here. They didn't leave." },
            { speaker: 'Dr. Aris', text: "There's food on the plates. Half eaten. Whatever happened, it happened mid-meal." },
            { speaker: 'Eng. Jaxon', text: "I don't like this. I don't like any of this." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "+10 Salvage (data drives). Colony knowledge gained. Warning: disturbing content.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Year 2, Month 4: Something wonderful is happening. The night sky here — it sings. Not sound. Feeling. Like the planet is dreaming and we\'re part of it."');
                    state.addLog('COLONY LOG: "Year 2, Month 5: More people are sleeping outside. They say they can hear it better without walls. Dr. Patel says the brainwave patterns are changing. Theta waves increasing."');
                    state.addLog('COLONY LOG: "Year 2, Month 6: I understand now. The planet isn\'t singing to us. It\'s singing us. We were always part of it. I\'m going outside. I won\'t need this recorder anymore."');
                    state.addLog('COLONY LOG: "—END OF RECORDS—"');
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read disappearance colony logs');
                    return "They became part of the planet. Data drives salvaged. +10 Salvage. Colony knowledge improved. All crew +1 Stress.";
                }
            },
            {
                text: "Take everything you can carry",
                desc: "+40 Salvage, +2 Food Packs, +1 Luxury item. They won't miss it.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                    if (typeof ITEMS !== 'undefined') {
                        if (ITEMS.FOOD_PACK) {
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Colony Site' });
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Colony Site' });
                        }
                        if (ITEMS.LUXURY_CHOCOLATE) {
                            state.cargo.push({ ...ITEMS.LUXURY_CHOCOLATE, acquiredAt: 'Colony Site' });
                        }
                    }
                    return "The settlement was untouched. Full pantries, stocked workshops, charged batteries. +40 Salvage, +2 Food Packs, +Synth-Chocolate.";
                }
            },
            {
                text: "Leave immediately",
                desc: "Something is wrong here. Get out.",
                effect: function(state) {
                    state.addLog('Spc. Vance: "Everyone back to the shuttle. Now. Don\'t touch anything."');
                    state.addLog('Tech Mira: "But the data—"');
                    state.addLog('Spc. Vance: "NOW, Mira."');
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    return "We left without taking anything. Vance was right — some places aren't worth the risk. Vance -1 Stress.";
                }
            },
            {
                text: "Assess the failure",
                desc: "A.U.R.A. attempts analysis. Colony knowledge gained.",
                effect: function(state) {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('A.U.R.A.: "Analysis inconclusive. No evidence of violence, disease, evacuation, or environmental catastrophe. Colony population: 0. Status: UNKNOWN."');
                    state.addLog('A.U.R.A.: "Recommendation: avoid planets with anomalous electromagnetic signatures in the theta frequency range. This is not a failure I can explain. Data... logged."');
                    return "A.U.R.A. has no explanation. That might be the most unsettling thing of all. Colony knowledge gained.";
                }
            }
        ]
    },

    {
        id: 'FC_OVERGROWTH',
        weight: 20,
        title: 'THE OVERGROWTH',
        context: function(planetName) {
            return `Dense vegetation has consumed the settlement on ${planetName}. What were once prefab walls are now trellises for vines. The landing pad is a garden. Something that might have been a communications array is now a tree. The planet took it all back.`;
        },
        dialogue: [
            { speaker: 'Tech Mira', text: "The growth rate is extraordinary. These vines have penetrated sealed alloy in less than five years." },
            { speaker: 'Dr. Aris', text: "The plants aren't just growing over the settlement. They're growing through it. Through the walls, the floors..." },
            { speaker: 'Spc. Vance', text: "Through the people?" },
            { speaker: 'Dr. Aris', text: "...I'd rather not speculate." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "+10 Salvage (data drives). Colony knowledge gained.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Week 8: The gardens are thriving! Growth rates 300% above projected. Dr. Pham says the soil bacteria are in perfect symbiosis with our crops."');
                    state.addLog('COLONY LOG: "Month 5: The growth is out of control. Vines are cracking foundations. The containment greenhouse burst overnight — seeds everywhere."');
                    state.addLog('COLONY LOG: "Month 9: We\'ve retreated to the inner ring. The vegetation is intelligent. Not sentient — but adaptive. It\'s solving our defenses like a puzzle."');
                    state.addLog('COLONY LOG: "Month 11: It\'s beautiful, actually. The flowers are beautiful. I stopped fighting it yesterday. I sat in the garden and the vines grew around my chair and I felt... held. Like the planet was holding me."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read overgrowth colony logs');
                    return "The planet consumed the colony in 11 months. Data drives salvaged. +10 Salvage. Colony knowledge improved.";
                }
            },
            {
                text: "Harvest biological samples",
                desc: "+20 Salvage. Possible rare bio specimen.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    if (Math.random() < 0.30 && typeof ITEMS !== 'undefined') {
                        if (ITEMS.XENO_MYCELIUM) {
                            state.cargo.push({ ...ITEMS.XENO_MYCELIUM, acquiredAt: 'Colony Site' });
                            state.addLog('Dr. Aris: "The root system contains xenobiological spores unlike anything in our database. Handling with extreme caution."');
                            return "Biological samples collected. +20 Salvage. Found Xeno-Mycelium Spores in the root network.";
                        }
                    }
                    if (typeof ITEMS !== 'undefined' && ITEMS.RADIOTROPHIC_FUNGUS) {
                        state.cargo.push({ ...ITEMS.RADIOTROPHIC_FUNGUS, acquiredAt: 'Colony Site' });
                    }
                    return "Biological samples collected. +20 Salvage, +Radiotrophic Fungus specimen.";
                }
            },
            {
                text: "Burn it back and dig for supplies",
                desc: "+30 Salvage. Aggressive approach.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    state.addLog('Eng. Jaxon: "Plasma torches cut through the vines. They scream. Not audibly — the instruments scream."');
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Burned living overgrowth colony');
                    return "Cleared enough vegetation to reach supply caches. +30 Salvage. The burning felt wrong. All crew +1 Stress.";
                }
            },
            {
                text: "Assess the failure",
                desc: "Study the aggressive flora. Colony knowledge gained.",
                effect: function(state) {
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('A.U.R.A.: "Flora exhibits directed growth patterns suggesting rudimentary collective intelligence. Not predatory — assimilative. The vegetation does not kill. It incorporates."');
                    state.addLog('A.U.R.A.: "Recommendation: bio-containment protocols mandatory for any world with accelerated growth signatures. Scan for subsurface root networks before landing. Data logged."');
                    return "Aggressive flora catalogued. Colony knowledge improved. We'll know what to look for.";
                }
            }
        ]
    }
];
