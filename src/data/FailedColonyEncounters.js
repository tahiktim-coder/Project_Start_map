// FAILED_COLONY_ENCOUNTERS: Narrative encounters on planets with FAILED_COLONY tag
// These are emotional setpieces — visiting what remains of previous colonization attempts
// Structure mirrors ExodusDerelicts.js pattern
// Writing rules for this file: docs/STYLE.md. Plain sentences, no nicknames, no riddles.

const FAILED_COLONY_ENCOUNTERS = [
    {
        id: 'FC_ABANDONED_DOME',
        weight: 25,
        title: 'THE DOME',
        context: function(planetName) {
            return `Buildings on ${planetName}'s southern continent. A pressure dome, half collapsed. The garden inside has grown wild. Nothing moves.`;
        },
        dialogue: [
            { speaker: 'Dr. Aris', text: "Those are Earth plants. Somebody lived here, maybe for years." },
            { speaker: 'Spc. Vance', text: "Whoever lived here is gone now. Keep your eyes open." },
            { speaker: 'Tech Mira', text: "That dome is a newer design than ours, but it's far more rusted. How?" },
            { speaker: 'Eng. Jaxon', text: "That's grass under the dome. Real grass." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "-5 Energy. +8-15 Salvage, +1 Data.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    const salvage = Math.floor(Math.random() * 8) + 8; // 8-15
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Day 1: We landed. The children are on real grass for the first time. Elena cried."');
                    state.addLog('COLONY LOG: "Day 342: The water level is dropping. The local roots are taking minerals we need."');
                    state.addLog('COLONY LOG: "Day 891: The wheat won\'t grow any more. The local plants always win. Rationing again."');
                    state.addLog('COLONY LOG: "Day 1,204: Last entry. The dome seals have failed. If anyone finds this: Earth crops can\'t survive in this soil."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read colony logs — preserved their story');
                    return `Colony records and data drives copied. -5 Energy, +${salvage} Salvage, +1 Data.`;
                }
            },
            {
                text: "Strip the settlement",
                desc: "+25-45 Salvage, +1 Food Pack. Jaxon +1 Stress: their homes become our hull plates.",
                effect: function(state) {
                    const salvage = Math.floor(Math.random() * 21) + 25; // 25-45
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Colony Site' });
                    }
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    if (jaxon) state.addLog('Eng. Jaxon: "Good panels, sealed wiring. They built this to last." He goes quiet after that.');
                    return `Settlement stripped. +${salvage} Salvage, +1 Food Pack. Jaxon +1 Stress.`;
                }
            },
            {
                text: "Check the cryo pods",
                desc: "30% chance: a sleeper, +1 Sleeper, -3 Rations. Otherwise the pods are empty, Aris +1 Stress.",
                effect: function(state) {
                    if (Math.random() < 0.30) {
                        state.addLog('There is someone in one of the pods. Faint signs of life, but alive. A child, about ten years old.');
                        state.addLog('A.U.R.A.: "Her pod is at four percent power, Commander. We can carry it, but keeping it cold costs rations."');
                        state._sleepers = (state._sleepers || 0) + 1;
                        state.rations = Math.max(0, state.rations - 3);
                        if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(2, 'Carried a sleeping child');
                        return "A child, alive and asleep. Her pod is in our hold now. +1 Sleeper, -3 Rations.";
                    } else {
                        state.addLog('Every pod is empty. Either they left, or they never reached the pods.');
                        state.addLog('There are handprints on the glass. Small ones.');
                        const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                        if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                        return "Empty pods, with small handprints on the glass. Aris +1 Stress.";
                    }
                }
            },
            {
                text: "Let the crew sit in the garden",
                desc: "-1 Ration: an hour on the grass. All crew -1 Stress.",
                effect: function(state) {
                    state.rations = Math.max(0, state.rations - 1);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    if (state.crew.some(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD')) {
                        state.addLog('Eng. Jaxon lies down on the grass. "This is all I want, Commander. A place like this."');
                    }
                    state.addLog('The grass has real roots. Nobody gets up for an hour.');
                    state.noteStanding && state.noteStanding('jaxon');
                    return "An hour on someone else's grass. -1 Ration. All crew -1 Stress.";
                }
            }
        ]
    },

    {
        id: 'FC_MASS_GRAVES',
        weight: 20,
        title: 'THE GRAVES',
        context: function(planetName) {
            return `A settlement on ${planetName}. Streets, and buildings still standing. Around one central building, rings of grave markers. Hundreds of them.`;
        },
        dialogue: [
            { speaker: 'Dr. Aris', text: "Hundreds of graves, in date order. Someone kept burying them right to the end." },
            { speaker: 'Eng. Jaxon', text: "The buildings are fine. Whatever killed them, it wasn't the weather." },
            { speaker: 'A.U.R.A.', text: "Air samples show traces of a disease, Commander. The burials took place over eight months." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "-5 Energy. +10 Salvage, +1 Data.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Month 3: The engineers have a cough. The doctor says it\'s dust."');
                    state.addLog('COLONY LOG: "Month 5: It isn\'t dust. It\'s in the water. Boiling it makes it worse."');
                    state.addLog('COLONY LOG: "Month 7: Six deaths a day now. The doctor died first. The children don\'t seem to catch it."');
                    state.addLog('COLONY LOG: "Month 8: Eighteen of us left, all children. The oldest is fourteen. She is writing this."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read plague colony records');
                    return "Three hundred people down to eighteen in eight months. Records copied. -5 Energy, +10 Salvage, +1 Data.";
                }
            },
            {
                text: "Salvage the medical stores",
                desc: "+25 Salvage. 40% chance: +1 Fungus Culture. Aris +1 Stress.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (Math.random() < 0.40 && typeof ITEMS !== 'undefined' && ITEMS.FUNGUS_CULTURE) {
                        state.cargo.push({ ...ITEMS.FUNGUS_CULTURE, acquiredAt: 'Colony Site' });
                        if (aris) state.addLog('Dr. Aris: "They were growing a culture in the lab. It\'s still alive. It outlived all of them."');
                        return "Medical stores taken. +25 Salvage, +1 Fungus Culture. Aris +1 Stress.";
                    }
                    return "Medical stores taken. Most of it spoiled long ago. +25 Salvage. Aris +1 Stress.";
                }
            },
            {
                text: "Read every grave marker aloud",
                desc: "-1 Ration: it takes a day. +2 Data. Aris -1 Stress.",
                effect: function(state) {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    state.addLog('Three hundred names, read from the outer ring inward. The last eighteen have no markers at all.');
                    if (aris) state.addLog('Dr. Aris: "I have all your names now. You won\'t be forgotten."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read every grave');
                    state.noteStanding && state.noteStanding('aris');
                    return "Every marker read. -1 Ration, +2 Data. Aris -1 Stress.";
                }
            },
            {
                text: "Open the cryo ward",
                desc: "+15 Salvage, +10 Energy from the ward's power cells. Aris +1 Stress.",
                effect: function(state) {
                    state.addLog('The central building is a clinic. Six pods in the back room, all occupied.');
                    state.addLog('A.U.R.A.: "The ward lost power long ago, Commander. Nobody in it is alive."');
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.energy = Math.min(100, state.energy + 10);
                    return "Six pods, six dead. They were waiting for a cure. Ward stripped. +15 Salvage, +10 Energy. Aris +1 Stress.";
                }
            }
        ]
    },

    {
        id: 'FC_CIVIL_WAR',
        weight: 15,
        title: 'THE SPLIT',
        context: function(planetName) {
            return `Two settlements on ${planetName}, forty kilometres apart. Both have walls. Blast marks and barricades in the streets. The colonists did this to each other.`;
        },
        dialogue: [
            { speaker: 'Spc. Vance', text: "Firing positions on both sides. Homemade guns. They fought each other." },
            { speaker: 'Dr. Aris', text: "They came all this way together. How does it end like this?" },
            { speaker: 'Eng. Jaxon', text: "Not enough food, and a fence down the middle. It happens every time." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "-5 Energy. +10 Salvage, +1 Data.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('LOG, NORTH: "The south won\'t share the water. Their leader says it\'s their land. We dug that well."');
                    state.addLog('LOG, SOUTH: "They stole twelve kilos of seed in the night. Without it, our children starve."');
                    state.addLog('LOG, NORTH: "Shots fired last night. Reko is dead. He was sixteen."');
                    state.addLog('LOG, FINAL: "There were two hundred of us. Now there are twenty-three. We\'re leaving together. Whatever happens, don\'t split up."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Learned from schism colony');
                    return "Two hundred people down to twenty-three. Records copied. -5 Energy, +10 Salvage, +1 Data.";
                }
            },
            {
                text: "Salvage both settlements",
                desc: "+45 Salvage. Aris +1 Stress. Nothing gets read.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 45);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog('Wall panels from both towns, loaded onto the lander together.');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Salvaged war colony without learning');
                    return "Both towns stripped. +45 Salvage. Aris +1 Stress.";
                }
            },
            {
                text: "Look for the shelter in their logs",
                desc: "-5 Energy. 20% chance: pods found, +3 Sleepers, -3 Rations, all crew +1 Stress: eight are left behind.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state.addLog('A.U.R.A.: "Scanning a hundred kilometres for cold spots, Commander."');
                    if (Math.random() < 0.20) {
                        state.addLog('A.U.R.A.: "Found one, Commander. A buried shelter eight kilometres north-west. Eleven pods, all still cold."');
                        state.addLog('The lander can only lift three pods. There is no way to take more.');
                        state._sleepers = (state._sleepers || 0) + 3;
                        state.rations = Math.max(0, state.rations - 3);
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog('Three pods are chosen. All eleven names are read before the shelter door is sealed.');
                        if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Carried three sleepers, left eight');
                        return "Three sleepers in the hold. Eight left sealed in the hills. -5 Energy, -3 Rations, +3 Sleepers. All crew +1 Stress.";
                    } else {
                        state.addLog('A.U.R.A.: "No cold spots, Commander. There is nothing under the hills."');
                        return "No shelter found. The last survivors left long ago. -5 Energy.";
                    }
                }
            }
        ]
    },

    {
        id: 'FC_THE_EMPTY',
        weight: 20,
        title: 'THE EMPTY TOWN',
        context: function(planetName) {
            return `A whole settlement on ${planetName}, powered and lit. Beds made, tools laid out, four plates on every table. No people. Not even bones.`;
        },
        dialogue: [
            { speaker: 'Tech Mira', text: "The power grid is still running. Solar panels to batteries. Nobody's touched a switch." },
            { speaker: 'Spc. Vance', text: "Not one scuff on a chair or a plate. Nobody ever sat here." },
            { speaker: 'Dr. Aris', text: "The grass in the garden has no roots. I pulled some, and it just lifted out." },
            { speaker: 'Eng. Jaxon', text: "I don't like this. Any of it." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "+10 Salvage, +1 Data. All crew +1 Stress.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Day 1: We landed. The children are playing in the grass."');
                    state.addLog('COLONY LOG: "Day 1: We landed. The children are playing in the grass."');
                    state.addLog('COLONY LOG: "Day 1: We landed. The children are playing in the grass."');
                    state.addLog('COLONY LOG: "Day 1: We landed."');
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read the empty colony logs');
                    return "Every entry is the first day, over and over. Records copied. +10 Salvage, +1 Data. All crew +1 Stress.";
                }
            },
            {
                text: "Take everything you can carry",
                desc: "+40 Salvage, +2 Food Pack, +1 Luxury Item. All crew +1 Stress.",
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
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog('Full pantries and charged batteries. Everything is sealed, as if it was delivered this morning.');
                    return "Settlement emptied. +40 Salvage, +2 Food Pack, +1 Luxury Item. All crew +1 Stress.";
                }
            },
            {
                text: "Leave immediately",
                desc: "-10 Energy: straight back up, no scan. Vance -1 Stress.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 10);
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) {
                        state.addLog('Spc. Vance: "Everyone back to the lander. Now. Don\'t touch anything."');
                        state.addLog('Nobody argues with him.');
                    }
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    return "We left with nothing. -10 Energy. Vance -1 Stress.";
                }
            },
            {
                text: "Let A.U.R.A. assess it",
                desc: "-5 Energy. +1 Data.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('A.U.R.A.: "Population zero, Commander. I can find no cause. I have logged the site as complete."');
                    state.addLog('A.U.R.A.: "Four plates per table is standard issue, Commander. That part is correct."');
                    return "A.U.R.A. has filed her report. Nothing in it is wrong. -5 Energy, +1 Data.";
                }
            }
        ]
    },

    {
        id: 'FC_OVERGROWTH',
        weight: 20,
        title: 'THE OVERGROWTH',
        context: function(planetName) {
            return `Plants have taken over the settlement on ${planetName}. Vines cover every wall. The landing pad is a garden. A tree has grown through the radio mast.`;
        },
        dialogue: [
            { speaker: 'Tech Mira', text: "Those vines grew straight through sealed metal. I didn't know plants could do that." },
            { speaker: 'Dr. Aris', text: "Not over the buildings. Through them. Through the floors." },
            { speaker: 'Spc. Vance', text: "And through the people?" },
            { speaker: 'Dr. Aris', text: "I'd rather not say." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "-5 Energy. +10 Salvage, +1 Data.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Week 8: The gardens are thriving. Growth is three times what we expected."');
                    state.addLog('COLONY LOG: "Month 5: It\'s out of control. Vines in the foundations. The greenhouse burst overnight."');
                    state.addLog('COLONY LOG: "Month 9: We only use the inner ring now. The plants aren\'t smart, but they get past every fence."');
                    state.addLog('COLONY LOG: "Month 11: The flowers are beautiful. I sat in the garden and it grew around my chair. I felt safe."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read overgrowth colony logs');
                    return "Eleven months from landing to garden. Records copied. -5 Energy, +10 Salvage, +1 Data.";
                }
            },
            {
                text: "Take plant samples",
                desc: "-5 Energy. +20 Salvage. 30% chance: +1 Spore Sample. Otherwise +1 Fungus Specimen.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    if (Math.random() < 0.30 && typeof ITEMS !== 'undefined') {
                        if (ITEMS.XENO_MYCELIUM) {
                            state.cargo.push({ ...ITEMS.XENO_MYCELIUM, acquiredAt: 'Colony Site' });
                            state.addLog('Spores in the roots, unlike anything we carry. Sealed in two containers to be safe.');
                            return "Samples taken. -5 Energy, +20 Salvage, +1 Spore Sample.";
                        }
                    }
                    if (typeof ITEMS !== 'undefined' && ITEMS.RADIOTROPHIC_FUNGUS) {
                        state.cargo.push({ ...ITEMS.RADIOTROPHIC_FUNGUS, acquiredAt: 'Colony Site' });
                    }
                    return "Samples taken. -5 Energy, +20 Salvage, +1 Fungus Specimen.";
                }
            },
            {
                text: "Burn a path and dig for supplies",
                desc: "+30 Salvage. All crew +1 Stress.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    state.addLog('We burned a path through the vines with cutting torches. It took hours.');
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Burned living overgrowth colony');
                    return "A path burned to the supply stores. +30 Salvage. It felt wrong to do. All crew +1 Stress.";
                }
            }
        ]
    }
];
