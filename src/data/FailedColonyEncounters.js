// FAILED_COLONY_ENCOUNTERS: Narrative encounters on planets with FAILED_COLONY tag
// These are emotional setpieces — visiting what remains of previous colonization attempts
// Structure mirrors ExodusDerelicts.js pattern

const FAILED_COLONY_ENCOUNTERS = [
    {
        id: 'FC_ABANDONED_DOME',
        weight: 25,
        title: 'THE DOME',
        context: function(planetName) {
            return `Artificial structures on ${planetName}'s southern continent. A pressure dome, half collapsed. The gardens inside have gone wild. No movement.`;
        },
        dialogue: [
            { speaker: 'Dr. Aris', text: "Earth hydroponics. Somebody lived here. Maybe for years." },
            { speaker: 'Spc. Vance', text: "Lived. Past tense. Eyes open." },
            { speaker: 'Tech Mira', text: "And here we see a prefab dome. Newer pattern than ours. Older rust." },
            { speaker: 'Eng. Jaxon', text: "That's grass. Under the dome. Actual grass." }
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
                    state.addLog('COLONY LOG: "Day 1: We landed. The children are in real grass for the first time. Elena cried."');
                    state.addLog('COLONY LOG: "Day 342: The water table is dropping. Something in the roots is pulling minerals we need."');
                    state.addLog('COLONY LOG: "Day 891: Wheat won\'t take any more. The local plants win every time. Rationing. Again."');
                    state.addLog('COLONY LOG: "Day 1,204: Last entry. Dome seals gone. If anyone finds this: the soil here is alive. It doesn\'t want us."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read colony logs — preserved their story');
                    return `Colony records copied. Data drives salvaged. -5 Energy, +${salvage} Salvage, +1 Data.`;
                }
            },
            {
                text: "Strip the settlement",
                desc: "+25-45 Salvage, +1 Food Pack. Jaxon +1 Stress: their homes become our plating.",
                effect: function(state) {
                    const salvage = Math.floor(Math.random() * 21) + 25; // 25-45
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Colony Site' });
                    }
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    state.addLog('Eng. Jaxon: "Good panels. Sealed wiring. They built well." He does not name anything.');
                    return `Settlement stripped. +${salvage} Salvage, +1 Food Pack. Jaxon +1 Stress.`;
                }
            },
            {
                text: "Check the cryopods",
                desc: "30% chance: a sleeper, +1 Sleeper, -3 Rations. Else empty pods, Aris +1 Stress.",
                effect: function(state) {
                    if (Math.random() < 0.30) {
                        state.addLog('Dr. Aris: "There\'s someone in here. Vitals faint, but there. A child. Ten, maybe."');
                        state.addLog('A.U.R.A.: "Her pod is at four percent, Commander. We can carry it. Keeping it cold costs rations."');
                        state._sleepers = (state._sleepers || 0) + 1;
                        state.rations = Math.max(0, state.rations - 3);
                        if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(2, 'Carried a sleeping child');
                        return "A child, alive and asleep. Her pod is in our hold. She wakes when there is a world to wake on. +1 Sleeper, -3 Rations.";
                    } else {
                        state.addLog('Spc. Vance: "Empty. All of them. Either they left, or they never got to the pods."');
                        state.addLog('Dr. Aris: "Handprints on the glass. Small ones."');
                        const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                        if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                        return "Empty cryopods. Handprints on the glass. Aris is quiet. Aris +1 Stress.";
                    }
                }
            },
            {
                text: "Let the crew sit in the garden",
                desc: "-1 Ration: an hour in the grass. All crew -1 Stress.",
                effect: function(state) {
                    state.rations = Math.max(0, state.rations - 1);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    state.addLog('Eng. Jaxon lies down in it. He names it. "This one\'s Sunday." Nobody gets up for an hour.');
                    state.addLog('Dr. Aris pulls a handful. It has roots. She checks twice.');
                    state.noteStanding && state.noteStanding('jaxon');
                    return "An hour in somebody else's grass. -1 Ration. All crew -1 Stress.";
                }
            }
        ]
    },

    {
        id: 'FC_MASS_GRAVES',
        weight: 20,
        title: 'THE GRAVES',
        context: function(planetName) {
            return `A settlement grid on ${planetName}. Streets. Intact buildings. And rows of markers, hundreds, in rings around one central building.`;
        },
        dialogue: [
            { speaker: 'Dr. Aris', text: "Grave markers. Hundreds. In date order. Somebody kept up." },
            { speaker: 'Eng. Jaxon', text: "The buildings are fine. Whatever it was, it wasn't the walls." },
            { speaker: 'A.U.R.A.', text: "The air suggests a pathogen, Commander. Eight months after landing, by the marker dates." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "-5 Energy. +10 Salvage, +1 Data.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Month 3: The cough started with the engineers. Dust, the doctor says."');
                    state.addLog('COLONY LOG: "Month 5: Not dust. It\'s in the water. Boiling makes it worse."');
                    state.addLog('COLONY LOG: "Month 7: Six a day now. The doctor went first. The children seem immune."');
                    state.addLog('COLONY LOG: "Month 8: Eighteen left. All children. The oldest is fourteen. She is writing this."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read plague colony records');
                    return "Three hundred to eighteen in eight months. Drives copied. -5 Energy, +10 Salvage, +1 Data.";
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
                        state.addLog('Dr. Aris: "They were growing a culture in the lab. Still alive. Tougher than they were."');
                        return "Medical stores taken. +25 Salvage, +1 Fungus Culture. Aris +1 Stress.";
                    }
                    return "Medical stores taken. Most of it long spoiled. +25 Salvage. Aris +1 Stress.";
                }
            },
            {
                text: "Read every marker aloud",
                desc: "-1 Ration: it takes a day. +2 Data. Aris -1 Stress.",
                effect: function(state) {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    state.addLog('Dr. Aris reads the rings from the outside in. Three hundred names. The last eighteen have no markers.');
                    state.addLog('Dr. Aris: "I\'ve got you. All of you. You\'re on the list now."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read every grave');
                    state.noteStanding && state.noteStanding('aris');
                    return "Every marker read. -1 Ration, +2 Data. Aris -1 Stress.";
                }
            },
            {
                text: "Open the cryo ward",
                desc: "+15 Salvage, +10 Energy from the ward cells. Aris +1 Stress.",
                effect: function(state) {
                    state.addLog('Spc. Vance: "Central building is the clinic. Six pods in the back. Six occupied."');
                    state.addLog('A.U.R.A.: "Power to the ward failed long ago, Commander. Nobody in it is alive."');
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.energy = Math.min(100, state.energy + 10);
                    return "Six pods, six dead. They waited for a cure. Ward stripped. +15 Salvage, +10 Energy. Aris +1 Stress.";
                }
            }
        ]
    },

    {
        id: 'FC_CIVIL_WAR',
        weight: 15,
        title: 'THE SCHISM',
        context: function(planetName) {
            return `Two settlements on ${planetName}, forty kilometres apart. Both fortified. Blast marks. Barricades in the streets. This one didn't fail from outside.`;
        },
        dialogue: [
            { speaker: 'Spc. Vance', text: "Firing positions both sides. Improvised guns. They turned on each other." },
            { speaker: 'Dr. Aris', text: "They crossed the dark together. How does that happen?" },
            { speaker: 'Eng. Jaxon', text: "Not enough food and too much fence. It always happens." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "-5 Energy. +10 Salvage, +1 Data.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('LOG, NORTH: "South won\'t share the aquifer. Their director says it\'s their ground. We dug the well."');
                    state.addLog('LOG, SOUTH: "They took seed stock in the night. Twelve kilos. Without it our children starve."');
                    state.addLog('LOG, NORTH: "Shots last night. Reko is dead. He was sixteen."');
                    state.addLog('LOG, FINAL: "Two hundred of us. Now twenty-three. We\'re leaving together. Whatever happens: don\'t split."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Learned from schism colony');
                    return "Two hundred became twenty-three. Drives copied. -5 Energy, +10 Salvage, +1 Data.";
                }
            },
            {
                text: "Salvage both settlements",
                desc: "+45 Salvage. Aris +1 Stress. Nothing read.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 45);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog('Eng. Jaxon: "Twice the buildings, twice the plating. Something good out of their mess."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Salvaged war colony without learning');
                    return "Both camps stripped. +45 Salvage. Aris +1 Stress.";
                }
            },
            {
                text: "Look for the shelter they wrote about",
                desc: "-5 Energy. 20% chance: pods found. +3 Sleepers, -3 Rations, all crew +1 Stress: eight stay behind.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state.addLog('A.U.R.A.: "Scanning a hundred kilometres for cold spots, Commander."');
                    if (Math.random() < 0.20) {
                        state.addLog('A.U.R.A.: "Contact. Eight kilometres north-west. A buried shelter. Eleven pods, all still cold."');
                        state.addLog('Eng. Jaxon: "The goat lifts three. Three, Commander. I\'ve done the sum four times."');
                        state._sleepers = (state._sleepers || 0) + 3;
                        state.rations = Math.max(0, state.rations - 3);
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog('Dr. Aris chooses three. She reads all eleven names before we seal the door.');
                        if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Carried three sleepers, left eight');
                        return "Three sleepers in the hold. Eight sealed in the hills. -5 Energy, -3 Rations, +3 Sleepers. All crew +1 Stress.";
                    } else {
                        state.addLog('A.U.R.A.: "No cold spots, Commander. Nothing under the hills."');
                        return "No shelter found. Whoever was left moved on long ago. -5 Energy.";
                    }
                }
            }
        ]
    },

    {
        id: 'FC_THE_EMPTY',
        weight: 20,
        title: 'THE EMPTY',
        context: function(planetName) {
            return `A whole settlement on ${planetName}. Powered. Lit. Beds made, tools laid out. Four plates on every table. No people. Not a bone.`;
        },
        dialogue: [
            { speaker: 'Tech Mira', text: "And here we see the grid still running. Solar to batteries. Nobody's touched a switch." },
            { speaker: 'Spc. Vance', text: "Four plates a table. Four chairs. Not one of them scuffed." },
            { speaker: 'Dr. Aris', text: "The grass in the garden has no roots. I pulled some. It just lifted." },
            { speaker: 'Eng. Jaxon', text: "I don't like this. I don't like any of it." }
        ],
        choices: [
            {
                text: "Read the colony logs",
                desc: "+10 Salvage, +1 Data. All crew +1 Stress.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('COLONY LOG: "Day 1: We landed. The children are in the grass."');
                    state.addLog('COLONY LOG: "Day 1: We landed. The children are in the grass."');
                    state.addLog('COLONY LOG: "Day 1: We landed. The children are in the grass."');
                    state.addLog('COLONY LOG: "Day 1: We landed."');
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read the empty colony logs');
                    return "Every entry is the first entry. Drives copied. +10 Salvage, +1 Data. All crew +1 Stress.";
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
                    state.addLog('Full pantries, charged batteries, sealed packs. The labels are ours. The lot numbers are ours.');
                    return "Settlement emptied. +40 Salvage, +2 Food Pack, +1 Luxury Item. All crew +1 Stress.";
                }
            },
            {
                text: "Leave immediately",
                desc: "-10 Energy: straight up, no scan. Vance -1 Stress.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 10);
                    state.addLog('Spc. Vance: "Everyone back to the goat. Now. Touch nothing."');
                    state.addLog('Tech Mira: "But the data—"');
                    state.addLog('Spc. Vance: "NOW, Mira."');
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    return "We left with nothing. Vance did not argue about it afterwards. -10 Energy. Vance -1 Stress.";
                }
            },
            {
                text: "Let A.U.R.A. assess it",
                desc: "-5 Energy. +1 Data.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog('A.U.R.A.: "Population zero, Commander. No cause on record. I have logged the site as complete."');
                    state.addLog('A.U.R.A.: "Four plates per table is the standard issue, Commander. That part is correct."');
                    return "A.U.R.A. has filed it. Nothing in her file is wrong. -5 Energy, +1 Data.";
                }
            }
        ]
    },

    {
        id: 'FC_OVERGROWTH',
        weight: 20,
        title: 'THE OVERGROWTH',
        context: function(planetName) {
            return `Vegetation has taken the settlement on ${planetName}. Walls are trellises. The landing pad is a garden. The comm array is a tree. The planet took it back.`;
        },
        dialogue: [
            { speaker: 'Tech Mira', text: "And here we see vines through sealed alloy. Nobody knows how long that takes." },
            { speaker: 'Dr. Aris', text: "Not over the buildings. Through them. Through the floors." },
            { speaker: 'Spc. Vance', text: "Through the people?" },
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
                    state.addLog('COLONY LOG: "Week 8: The gardens are thriving. Growth three times projection. The soil loves us."');
                    state.addLog('COLONY LOG: "Month 5: Out of control. Vines in the foundations. The greenhouse burst overnight."');
                    state.addLog('COLONY LOG: "Month 9: Inner ring only now. It isn\'t thinking. But it solves the fences."');
                    state.addLog('COLONY LOG: "Month 11: The flowers are beautiful. I sat in the garden and it grew round the chair. I felt held."');
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read overgrowth colony logs');
                    return "Eleven months from landing to garden. Drives copied. -5 Energy, +10 Salvage, +1 Data.";
                }
            },
            {
                text: "Take biological samples",
                desc: "-5 Energy. +20 Salvage. 30% chance: +1 Spore Sample. Else +1 Fungus Specimen.",
                effect: function(state) {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    if (Math.random() < 0.30 && typeof ITEMS !== 'undefined') {
                        if (ITEMS.XENO_MYCELIUM) {
                            state.cargo.push({ ...ITEMS.XENO_MYCELIUM, acquiredAt: 'Colony Site' });
                            state.addLog('Dr. Aris: "Spores in the root system unlike anything we carry. Sealed twice."');
                            return "Samples taken. -5 Energy, +20 Salvage. Found spores in the roots.";
                        }
                    }
                    if (typeof ITEMS !== 'undefined' && ITEMS.RADIOTROPHIC_FUNGUS) {
                        state.cargo.push({ ...ITEMS.RADIOTROPHIC_FUNGUS, acquiredAt: 'Colony Site' });
                    }
                    return "Samples taken. -5 Energy, +20 Salvage, +1 Fungus Specimen.";
                }
            },
            {
                text: "Burn it back and dig for supplies",
                desc: "+30 Salvage. All crew +1 Stress.",
                effect: function(state) {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    state.addLog('Eng. Jaxon: "Torches through the vines. The instruments scream. The vines don\'t."');
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Burned living overgrowth colony');
                    return "Burned a path to the caches. +30 Salvage. The burning felt wrong. All crew +1 Stress.";
                }
            }
        ]
    }
];
