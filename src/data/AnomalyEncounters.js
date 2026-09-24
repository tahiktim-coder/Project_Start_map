/**
 * ANOMALY ENCOUNTERS
 *
 * Things the light at the end of the heading has read and made again.
 * Each copy is slightly wrong: the same planet twice, our own ship with four
 * people in the windows, a back garden where every blade of grass is the same.
 * Nothing here chases the ship. Nothing here is alien. It is all ours, copied.
 * High risk, high reward, high narrative impact.
 *
 * Found in Sector 4+ with ANOMALY tag, or triggered by the wrong wreck's nav data.
 */

// Helper: Test-aware chance (bad outcomes in test mode)
function _anomalyTestChance(chance) {
    if (window.TEST_MODE) return chance > 0;
    return Math.random() < chance;
}

const ANOMALY_ENCOUNTERS = [
    // --- 1. THE FOLD: the same planet twice ---
    {
        id: 'ANOMALY_FOLD',
        weight: 20,
        title: "THE SAME PLANET TWICE",
        context: () => `The same planet appears twice ahead of us, side by side, down to the last crater and shadow. Between the two copies runs a thin line where the stars don't match up.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "Every crater matches, Commander. Two planets can't be identical. One of them has to be a copy." },
            { speaker: 'A.U.R.A.', text: "I get two valid positions for our ship, Commander, one beside each planet. Both check out." },
            { speaker: 'Spc. Vance', text: "Somebody made that copy. I'd like to know who before we go near it." }
        ],
        choices: [
            {
                text: "Send the probe through the gap",
                desc: "The probe is lost. +30 Energy. All crew +1 Stress.",
                effect: (state) => {
                    state.probeIntegrity = 0; // Probe destroyed
                    state.energy = Math.min(100, state.energy + 30);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("PROBE: on the far side of the gap, its camera shows the back of our own ship.");
                    state.addLog("Then its signal comes from both sides at once, and stops. The gap gives off a burst of energy, and the reactor takes it in.");
                    return "Probe lost in the gap. +30 Energy. All crew +1 Stress.";
                }
            },
            {
                text: "Fly the ship through the gap",
                desc: "60% chance: we skip 1 or 2 sectors ahead for free. 40% chance: we come out somewhere off the map, someone gets hurt, all crew +1 Stress.",
                effect: (state) => {
                    if (_anomalyTestChance(0.4)) {
                        // BAD OUTCOME - thrown to THE WRONG PLACE
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            victim.stress = 3;
                            state.addLog(`${victim.name} was thrown against a wall on the way through, and is hurt and badly shaken.`);
                        }

                        // Create THE WRONG PLACE as its own isolated "sector"
                        const hellPlanet = {
                            id: 'WRONG_PLACE_' + Date.now(),
                            name: 'THE WRONG PLACE',
                            type: 'WRONG_PLACE',
                            desc: 'This is not on any chart. The stars here match nothing we know. We should leave.',
                            gravity: '???',
                            atmosphere: 'IMPOSSIBLE',
                            temperature: 'NEGATIVE KELVIN',
                            fuelCost: 0,
                            scanned: true,
                            tags: ['WRONG_PLACE'],
                            resources: { metals: 0, energy: 0 },
                            metrics: { hasLife: true, hasTech: true },
                            mapData: { x: 50, y: 50 },
                            _isWrongPlace: true,
                            _returnSector: state.currentSector // Remember where we came from
                        };

                        // Replace sector with just this planet
                        state._previousSectorNodes = state.sectorNodes;
                        state._previousSector = state.currentSector;
                        state.sectorNodes = [hellPlanet];
                        state.currentSystem = hellPlanet;
                        state.lastVisitedSystem = hellPlanet;
                        state._inWrongPlace = true;

                        state.addLog("=== OFF THE MAP ===");
                        state.addLog("We came out somewhere that matches no chart we have.");
                        state.addLog("A.U.R.A.: 'I can't place us on any chart, Commander. I'm working on it.'");
                        state.addLog("There is a wreck here. It is broadcasting our own ship's ID code.");
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });

                        // Trigger visual teleport effect and view refresh
                        window.dispatchEvent(new CustomEvent('anomaly-teleport', { detail: { destination: hellPlanet, type: 'WRONG_PLACE' } }));

                        return "The gap threw us somewhere off the map. All crew +1 Stress.";
                    }

                    // GOOD OUTCOME - Jump 1-2 sectors ahead!
                    const currentSector = state.currentSector || 1;
                    const jump = Math.random() < 0.5 ? 1 : 2; // 50% chance of 1 or 2 sector jump
                    const targetSector = Math.min(6, currentSector + jump);

                    if (targetSector > currentSector) {
                        // Generate the new sector
                        if (typeof PlanetGenerator !== 'undefined') {
                            state.sectorNodes = PlanetGenerator.generateSector(targetSector);
                            state.currentSector = targetSector;

                            // Apply sector entry effects
                            const config = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[targetSector] : null;
                            if (config && config.hazard && config.hazard.onSectorEnter) {
                                config.hazard.onSectorEnter(state, state.sectorNodes);
                            }

                            // Pick a random planet to arrive at
                            const arrival = state.sectorNodes[Math.floor(Math.random() * state.sectorNodes.length)];
                            state.currentSystem = arrival;
                            state.lastVisitedSystem = arrival;

                            state.addLog("=== THROUGH THE GAP ===");
                            state.addLog("The two planets closed up behind us. Ahead is a sky we haven't seen before.");
                            state.addLog(`A.U.R.A.: "We've moved ${jump === 1 ? 'one sector' : 'two sectors'} ahead, Commander. The jump used no energy."`);
                            state.addLog(`Now entering: SECTOR ${targetSector}`);

                            // Trigger visual teleport effect
                            window.dispatchEvent(new CustomEvent('anomaly-teleport', { detail: { destination: arrival, type: 'FOLD_SUCCESS', sectorJump: jump } }));

                            return `Through the gap. We jumped ${jump} sector${jump > 1 ? 's' : ''} ahead to Sector ${targetSector}, using no energy.`;
                        }
                    }

                    return "The gap closed before we reached it. We're still where we started.";
                }
            },
            {
                text: "Log it and go around",
                desc: "-10 Energy to go the long way. +2 Data.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("A.U.R.A.: 'Both planets are logged, Commander. I can't tell which one is the original.'");
                    return "Went around the long way. -10 Energy, +2 Data.";
                }
            }
        ]
    },

    // --- 2. THE WHISPER: a voice on the dead channels ---
    {
        id: 'ANOMALY_WHISPER',
        weight: 15,
        title: "THE OTHER VOICE",
        context: () => `A voice is calling us on every channel, and it is A.U.R.A.'s voice. But A.U.R.A. is right here with us, so this is something else using it.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "That's her voice. A.U.R.A., is that you out there?" },
            { speaker: 'A.U.R.A.', text: "No, Commander. I'm here. That voice is repeating things I've said before, exactly." },
            { speaker: 'Dr. Aris', text: "It's reading out the names of dead crews. Some of them are already on my list." }
        ],
        choices: [
            {
                text: "Let one of us talk to it",
                desc: "30% chance: they come back at Stress 3. 40% chance: +2 Data, and they get +1 Stress. 30% chance: they come back calm, healed, at Stress 0.",
                requires: (state) => state.crew.some(c => c.status !== 'DEAD' && !c.tags.includes('LEADER')),
                requiresLabel: "Requires available crew",
                effect: (state) => {
                    const candidates = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));

                    const listener = candidates[Math.floor(Math.random() * candidates.length)];
                    // In test mode, force interesting outcomes
                    const roll = window.TEST_MODE ? 0.1 : Math.random();

                    if (roll < 0.3) {
                        // Bad: it got in
                        listener.stress = 3;
                        state.addLog(`${listener.name} talked to it for an hour, and won't repeat anything it said.`);
                        return `${listener.name} talked to the voice and came back badly shaken. Stress 3.`;
                    } else if (roll < 0.7) {
                        // Neutral: Knowledge
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                        listener.stress = Math.min(3, (listener.stress || 0) + 1);
                        state.addLog(`${listener.name}: "It read me a list of ships and where each one ended up. I wrote down what I could."`);
                        return `${listener.name} wrote down a list of ships. +2 Data. ${listener.name} +1 Stress.`;
                    } else {
                        // Good: too calm
                        listener.stress = 0;
                        if (listener.status === 'INJURED') listener.status = 'HEALTHY';
                        state.addLog(`${listener.name}: "It just said my name, nothing else. I feel better than I have in weeks."`);
                        return `${listener.name} came back calm and unhurt. Stress 0.`;
                    }
                }
            },
            {
                text: "Have A.U.R.A. answer it",
                desc: "-5 Energy. Then one of four, 25% chance each: +20 Salvage and +2 Food Pack, but all crew +1 Stress; every planet here revealed; nothing; or all crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const roll = window.TEST_MODE ? 0.1 : Math.random();
                    state.noteStanding && state.noteStanding('mira');
                    if (roll < 0.25) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                        if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'The Other Voice' });
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'The Other Voice' });
                        }
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("An hour after she answers, a supply crate drifts up to our airlock. It's one of ours, with our batch numbers, still sealed.");
                        return "One of our own crates came back. -5 Energy, +20 Salvage, +2 Food Pack. All crew +1 Stress.";
                    } else if (roll < 0.5) {
                        state.sectorNodes?.forEach(p => {
                            p.remoteScanned = true;
                            p._tagsRevealed = true;
                        });
                        state.addLog("The voice describes every planet in this sector to her. She checks each one. Every description is accurate.");
                        return "The voice gave A.U.R.A. the whole sector. -5 Energy. All planets revealed.";
                    } else if (roll < 0.75) {
                        state.addLog("A.U.R.A.: 'I said hello and gave our crew count, Commander. It repeated both back and went quiet.'");
                        return "A.U.R.A. answered, and the voice went quiet. -5 Energy.";
                    } else {
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("It answers in five voices, and they are ours. A.U.R.A.: 'That doesn't match my crew count, Commander. I've logged it.'");
                        return "It answered in our own voices. -5 Energy. All crew +1 Stress.";
                    }
                }
            },
            {
                text: "Jam every channel and leave",
                desc: "-10 Energy. We hear nothing more. Vance -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("We fill every channel with static until the voice is out of range.");
                    return "Channels jammed until the voice was gone. -10 Energy. Vance -1 Stress.";
                }
            }
        ]
    },

    // --- 3. THE MIRROR: our own hull, made again ---
    {
        id: 'ANOMALY_MIRROR',
        weight: 15,
        title: "OUR OWN SHIP",
        context: () => `A ship is holding position right beside us, and it is ours: same hull, same number, same scratches. Through its windows, four people sit at our stations and wave back at us.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "It is broadcasting our ship's ID, Commander. It answers my signals before I finish sending them." },
            { speaker: 'Spc. Vance', text: "Four people in those windows. Which one of us did they leave out?" },
            { speaker: 'Tech Mira', text: "A.U.R.A. says it's friendly. If she says so, I believe her." }
        ],
        choices: [
            {
                text: "Call the other ship",
                desc: "-5 Energy. +1 Data. The richest planet here revealed. All crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    // Reveal resource info for best planet
                    const best = state.sectorNodes?.reduce((a, b) =>
                        ((b.resources?.metals || 0) + (b.resources?.energy || 0)) >
                        ((a.resources?.metals || 0) + (a.resources?.energy || 0)) ? b : a
                    );
                    if (best) {
                        best.remoteScanned = true;
                        state.addLog(`The other ship answers in our own voices: "Go to ${best.name} last. We went there first." Four voices, not five.`);
                    }
                    state.addLog("Nobody on the bridge says anything for a while.");
                    return "Called our own ship. -5 Energy, +1 Data. One planet revealed. All crew +1 Stress.";
                }
            },
            {
                text: "Trade supplies across",
                desc: "-20 Salvage for +30 Energy. If we have under 20 Salvage: -30 Energy for +20 Salvage instead. Vance +1 Stress either way.",
                effect: (state) => {
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (state.salvage >= 20) {
                        state.salvage -= 20;
                        state.energy = Math.min(100, state.energy + 30);
                        if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                        state.addLog("We pass crates across on a line. Power cells come back with our own batch numbers and serials on them.");
                        return "Traded across. -20 Salvage, +30 Energy. Vance +1 Stress.";
                    } else if (state.energy >= 30) {
                        state.energy -= 30;
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                        if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                        state.addLog("They wanted power, not metal. The hull plates they send back have our own welds on them.");
                        return "Traded across. -30 Energy, +20 Salvage. Vance +1 Stress.";
                    }
                    return "We have nothing to trade. The four in the windows stop waving.";
                }
            },
            {
                text: "Fly straight into it",
                desc: "-15 Energy. 50% chance: it isn't solid, +40 Salvage, +2 Data. 50% chance: it is solid, a deck is damaged and someone gets hurt.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 15);
                    if (_anomalyTestChance(0.5)) {
                        const decks = ['bridge', 'lab', 'quarters', 'cargo', 'engineering'];
                        const deck = decks[Math.floor(Math.random() * decks.length)];
                        if (state.shipDecks && state.shipDecks[deck] && state.shipDecks[deck].status === 'OPERATIONAL') {
                            state.shipDecks[deck].status = 'DAMAGED';
                            state.addLog(`It was solid. ${state.shipDecks[deck].label} damaged.`);
                        }
                        const healthy = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (healthy.length > 0) {
                            const unlucky = healthy[Math.floor(Math.random() * healthy.length)];
                            unlucky.status = 'INJURED';
                            state.addLog(`${unlucky.name} wasn't strapped in and got hurt.`);
                        }
                        state.addLog("It drifts away behind us, the four figures still waving.");
                        return "It was solid. -15 Energy. A deck damaged, and someone hurt.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("We pass through it like fog. Hull plates peel off it in sheets, still warm, each one stamped with our number.");
                    return "It came apart around us. -15 Energy, +40 Salvage, +2 Data.";
                }
            }
        ]
    },

    // --- 4. THE DARK: a patch of nothing, switching the beacons off ---
    {
        id: 'ANOMALY_HUNGER',
        weight: 10,
        title: "THE DARK PATCH",
        context: () => `There is a patch of sky ahead with no stars in it at all. Wrecks inside it are still sending distress beacons, and the beacons are switching off one by one.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "There were nine beacons in there when we arrived. Now there are seven." },
            { speaker: 'A.U.R.A.', text: "The sensors aren't reading zero, Commander. They're returning no reading at all." },
            { speaker: 'Tech Mira', text: "What am I looking at? Even A.U.R.A. can't tell me, and she always knows." }
        ],
        choices: [
            {
                text: "Push a crate in and watch",
                desc: "-30 Salvage. +3 Data. Mira +1 Stress.",
                effect: (state) => {
                    if (state.salvage < 30) return "We don't have 30 Salvage to spare. Nothing goes in.";
                    state.salvage -= 30;
                    state._hungerFavor = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("The crate drifts in. An hour later it drifts out the far side, sealed and empty. The label is ours, with one letter wrong.");
                    return "The crate went in and came back wrong. -30 Salvage, +3 Data. Mira +1 Stress.";
                }
            },
            {
                text: "Send the probe to the edge",
                desc: "Needs the probe. 50% chance: the probe is lost. 50% chance: +40 Energy, -50% Probe.",
                effect: (state) => {
                    if (state.probeIntegrity <= 0) {
                        return "We have no probe to send.";
                    }

                    if (_anomalyTestChance(0.5)) {
                        // Probe lost
                        state.probeIntegrity = 0;
                        state.addLog("The probe goes in. Its signal doesn't cut out. It fades, the same way the beacons did.");
                        return "Probe lost in the dark patch. No data.";
                    }

                    // Success
                    state.energy = Math.min(100, state.energy + 40);
                    state.probeIntegrity = Math.max(0, state.probeIntegrity - 50);
                    state.addLog("The probe skims the edge and comes back ice cold, its cells full. Its serial number is one digit off.");
                    return "The probe came back with full cells. +40 Energy. Probe half worn out.";
                }
            },
            {
                text: "Burn hard away from it",
                desc: "-20 Energy. Nothing else lost. Vance -1 Stress.",
                effect: (state) => {
                    if (!state.consumeEnergy(20)) {
                        return "Not enough energy for a full burn. We drift at the edge and watch it.";
                    }
                    state._hungerFled = true;
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("Full burn. Nothing follows us. By the time we're out of range, six beacons are left.");
                    return "Burned clear. -20 Energy. Vance -1 Stress.";
                }
            }
        ]
    },

    // --- 5. THE BACK GARDEN: every blade of grass the same ---
    {
        id: 'ANOMALY_GARDEN',
        weight: 15,
        title: "THE BACK GARDEN",
        context: () => `A patch of someone's back garden is floating in open space: a lawn, a wooden fence, one tree and a bench. There's no dome and no air, yet the grass sways, and it is slowly growing toward our hull.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "That's a back garden. Fence, bench, the lot. It looks like the one I left." },
            { speaker: 'Dr. Aris', text: "I brought one blade in through the airlock. Every blade out there is identical to it." },
            { speaker: 'Tech Mira', text: "A.U.R.A. says it can't hurt us, Commander. That's good enough for me." }
        ],
        choices: [
            {
                text: "Take a cutting",
                desc: "-5 Energy. +1 Fungus Culture: the cutting grows food like one. 20% chance someone gets hurt.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (_anomalyTestChance(0.2)) {
                        // Contamination
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            victim.tags = victim.tags || [];
                            if (!victim.tags.includes('HIVE_MIND')) victim.tags.push('HIVE_MIND');
                            state.addLog(`${victim.name} touched it without gloves. Their hand is burned, and they keep saying it felt warm.`);
                        }
                    }
                    if (typeof ITEMS !== 'undefined' && ITEMS.FUNGUS_CULTURE) {
                        state.cargo.push({ ...ITEMS.FUNGUS_CULTURE, acquiredAt: 'The Back Garden' });
                        return "The cutting keeps growing in a sealed tray in the lab. -5 Energy, +1 Fungus Culture.";
                    }
                    return "The sample jars failed, so nothing was kept. -5 Energy.";
                }
            },
            {
                text: "Let it grow onto the hull",
                desc: "33% chance each: the probe is repaired and one injury healed; +10 Rations; or all crew -1 Stress.",
                effect: (state) => {
                    const roll = window.TEST_MODE ? 0.1 : Math.random();
                    state.noteStanding && state.noteStanding('mira');
                    if (roll < 0.33) {
                        // Repairs
                        state.probeIntegrity = 100;
                        const injured = state.crew.find(c => c.status === 'INJURED');
                        if (injured) injured.status = 'HEALTHY';
                        state.addLog("It spreads over the hull, then lets go. Where it touched, the metal is new. The probe is whole again, and so is whoever was hurt.");
                        return "The garden repaired the probe and healed one injury.";
                    } else if (roll < 0.66) {
                        // Food
                        state.rations = Math.min(state.maxRations, state.rations + 10);
                        state.addLog("It leaves fruit by the airlock. The fruit has no taste. A.U.R.A. tests it twice: 'It's safe to eat, Commander.'");
                        return "The garden left us food. +10 Rations.";
                    } else {
                        // Changed
                        const affected = state.crew.filter(c => c.status !== 'DEAD');
                        affected.forEach(c => {
                            c.stress = Math.max(0, (c.stress || 0) - 1);
                            c.tags = c.tags || [];
                            if (!c.tags.includes('GARDEN_TOUCHED')) c.tags.push('GARDEN_TOUCHED');
                        });
                        state.addLog("It touches the hull and goes still. Everyone aboard sleeps well that night, and nobody can say why.");
                        return "The garden touched the hull. All crew -1 Stress.";
                    }
                }
            },
            {
                text: "Burn it",
                desc: "+10 Energy from the fire. Jaxon +1 Stress, Aris +1 Stress.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 10);
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("It burns like dry grass, but there is no smell at all.");
                    return "Garden burned. +10 Energy. Jaxon +1 Stress, Aris +1 Stress.";
                }
            }
        ]
    },

    // --- 6. THE DOOR: our own airlock, alone ---
    {
        id: 'ANOMALY_DOOR',
        weight: 5,
        title: "THE DOOR",
        context: () => `An airlock door is floating on its own in space, with no ship attached to it. It is an exact copy of our rear airlock, down to the scratch by the handle, and its light shows green.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "Green means it's safe to open. That's what it means on ours." },
            { speaker: 'A.U.R.A.', text: "It matches our rear airlock in every measurement, Commander. Ours is still attached to us." },
            { speaker: 'Spc. Vance', text: "It's a door with nothing behind it. I'm not opening it." },
            { speaker: 'Dr. Aris', text: "Then what's on the other side?" }
        ],
        choices: [
            {
                text: "Open the door",
                desc: "25% chance: +3 Data, all crew +1 Stress. 25% chance: +40 Energy. 25% chance: one crew member walks through and is gone, +3 Data. 25% chance: nothing.",
                effect: (state) => {
                    // The Door always has consequences
                    state._doorOpened = true;

                    const roll = window.TEST_MODE ? 0.1 : Math.random();
                    if (roll < 0.25) {
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("THE DOOR OPENS.");
                        state.addLog("Through it: green fields under a yellow sun, and four people walking away from us. The grass doesn't bend under their feet.");
                        state.addLog("Then it closes again.");
                        return "The door opened onto a copy of somewhere. +3 Data. All crew +1 Stress.";
                    } else if (roll < 0.5) {
                        state.energy = Math.min(100, state.energy + 40);
                        state.addLog("THE DOOR OPENS.");
                        state.addLog("Bright light pours through: our own running lights, seen from outside. The reactor charges from it.");
                        return "Light came through the door. +40 Energy.";
                    } else if (roll < 0.75) {
                        const victim = state.crew.find(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                        if (victim) {
                            victim.status = 'DEAD';
                            victim._deathCause = 'The Door';
                            victim._deathSector = state.currentSector;
                            victim._deathPlanet = 'the door';
                            state.addLog("THE DOOR OPENS.");
                            state.addLog(`${victim.name} walks through it. They don't run, and they don't look back.`);
                            state.addLog("The door closes. Through its window, four people are walking away. One of them turns and waves.");
                            state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                            return `${victim.name} walked through the door and is gone. +3 Data.`;
                        }
                    }
                    // The Door refuses
                    state.addLog("THE DOOR OPENS. There is nothing behind it but our own rear airlock, seen from the inside.");
                    state.addLog("A.U.R.A.: 'Both doors are closed now, Commander.'");
                    return "The door opened onto nothing. Nothing gained, nothing lost.";
                }
            },
            {
                text: "Leave something at the door",
                desc: "Give up the last item in the hold. It comes back as two: +1 Item. All crew +1 Stress.",
                effect: (state) => {
                    if (state.cargo.length === 0) {
                        return "We have nothing in the hold to leave. The green light stays on.";
                    }
                    const offering = state.cargo.pop();
                    state._doorOffering = true;
                    state.cargo.push({ ...offering });
                    state.cargo.push({ ...offering });
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog(`We leave the ${offering.name} by the door. An hour later it's back, with a second one beside it.`);
                    state.addLog("A.U.R.A.: 'Both have the same serial number, Commander. That shouldn't be possible.'");
                    return `The ${offering.name} came back as two. +1 Item. All crew +1 Stress.`;
                }
            },
            {
                text: "Measure it and leave",
                desc: "-5 Energy. +2 Data.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("We measure it from the lander. Every dimension matches ours to the millimetre, and the scratch is in the same place.");
                    return "Measured and logged. -5 Energy, +2 Data.";
                }
            }
        ]
    },

    // --- 7. THE CHORUS: seventeen hulls playing the briefing ---
    {
        id: 'ANOMALY_CHORUS',
        weight: 12,
        title: "THE RING OF SHIPS",
        context: () => `Seventeen dead ships sit in a ring, all pointing inward. Every one of them is broadcasting the same recording: the mission briefing we were given before launch.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Seventeen ships, and every one has a higher hull number than ours. We were told eight went before us." },
            { speaker: 'Dr. Aris', text: "Listen. 'Eight ships went this way before you.' It's our briefing. Even the pauses match." },
            { speaker: 'Eng. Jaxon', text: "There's no damage on any of them. The crews just left." },
            { speaker: 'A.U.R.A.', text: "That is the standard briefing, Commander. I have the same file. They're playing it correctly." }
        ],
        choices: [
            {
                text: "Board one of the ships",
                desc: "+35 Salvage. 30% chance: whoever goes aboard comes back at Stress 3.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);

                    if (_anomalyTestChance(0.3)) {
                        const crew = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                        if (crew.length > 0) {
                            const singer = crew[Math.floor(Math.random() * crew.length)];
                            singer.stress = 3;
                            singer.tags = singer.tags || [];
                            if (!singer.tags.includes('CHORUS_TOUCHED')) singer.tags.push('CHORUS_TOUCHED');
                            state.addLog(`${singer.name} found the briefing recording in the captain's cabin, and now can't stop repeating it under their breath.`);
                            return `+35 Salvage. ${singer.name} came back badly shaken. Stress 3.`;
                        }
                    }

                    state.addLog("The ship is empty and tidy. Four name tags lie on the table. We take what we can and leave.");
                    return "Boarded and stripped one ship. +35 Salvage.";
                }
            },
            {
                text: "Fly into the middle of the ring",
                desc: "-10 Energy. 50% chance: +40 Energy, +3 Data, all crew +1 Stress. 50% chance: nothing.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    if (_anomalyTestChance(0.5)) {
                        state.energy = Math.min(100, state.energy + 40);
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("From the middle we can see what every ship is pointed at: a tiny point of light, very far away.");
                        state.addLog("A.U.R.A.: 'It looks like a star, Commander, but it isn't on any chart. The reactor is charging from its light.'");
                        return "We saw what the ships were pointed at. -10 Energy, +40 Energy, +3 Data. All crew +1 Stress.";
                    }

                    state.addLog("There's nothing in the middle. As we leave, the ships go quiet one by one, as if someone is switching them off.");
                    return "Nothing in the middle. -10 Energy. The ring went quiet behind us.";
                }
            },
            {
                text: "Record the hull numbers and leave",
                desc: "-5 Energy. +1 Data. Vance -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("All seventeen hull numbers go into the log, lowest to highest. Even the lowest one has four digits.");
                    state.noteStanding && state.noteStanding('vance');
                    return "Seventeen hull numbers logged. -5 Energy, +1 Data. Vance -1 Stress.";
                }
            }
        ]
    },

    // --- 8. THE LEDGER: a list, written in light ---
    {
        id: 'ANOMALY_GEOMETRY',
        weight: 10,
        title: "THE LIST IN THE SKY",
        context: () => `A list is written across the sky in light, kilometres long. It has two columns: hull numbers climbing past forty thousand, and beside every one of them, the number four.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "It's a list, Commander. Just a list, written in light. It's beautiful." },
            { speaker: 'Spc. Vance', text: "The left column is ships. The right column is how many crew each one had." },
            { speaker: 'A.U.R.A.', text: "I've checked the right-hand column against my records, Commander. It's correct." },
            { speaker: 'Dr. Aris', text: "Find our ship on it. I want to know if we're listed." }
        ],
        choices: [
            {
                text: "Let Mira read the whole list",
                desc: "-1 Ration: it takes a day. +4 Data. The reader's Stress drops to 0.",
                effect: (state) => {
                    const candidates = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                    if (candidates.length === 0) return "There's nobody left to read it.";

                    // Mira is best candidate if available
                    let solver = candidates.find(c => c.tags.includes('SPECIALIST')) ||
                                 candidates[Math.floor(Math.random() * candidates.length)];

                    state.rations = Math.max(0, state.rations - 1);
                    solver.tags = solver.tags || [];
                    if (!solver.tags.includes('GEOMETRY_SOLVED')) solver.tags.push('GEOMETRY_SOLVED');
                    solver.stress = 0;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 4;

                    state.addLog(`${solver.name} reads for a whole day. Then: "We're on it, Commander. Ship nine, four crew. Just what A.U.R.A. says."`);
                    state.noteStanding && state.noteStanding('mira');
                    return `${solver.name} read the whole list. -1 Ration, +4 Data. ${solver.name} Stress 0.`;
                }
            },
            {
                text: "Check our line against A.U.R.A.'s records",
                desc: "-5 Energy. +2 Data. Vance +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    state.addLog("A.U.R.A.: 'It matches my records, Commander. Every line, including ours.'");
                    state.addLog(vance
                        ? "Spc. Vance: \"Then your records are wrong, and I want to know who wrote them.\" A.U.R.A.: 'Four crew, Commander.' He doesn't ask again."
                        : "A.U.R.A.: 'Four crew on our line, Commander, the same as on every other.'");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Checked the list in the sky against her records');
                    state.noteStanding && state.noteStanding('vance');
                    return "Our line checked. -5 Energy, +2 Data. Vance +1 Stress.";
                }
            },
            {
                text: "Fly through without reading it",
                desc: "-10 Energy. Mira +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Windows shuttered and instruments off, we fly through on dead reckoning.");
                    return "Flew through without reading it. -10 Energy. Mira +1 Stress.";
                }
            }
        ]
    },

    // --- 9. THE ARCHIVE: every hold, made again ---
    {
        id: 'ANOMALY_ARCHIVE',
        weight: 8,
        title: "THE ARCHIVE",
        context: () => `Inside a hollow moon, endless shelves hold copies of the cargo of every ship that came this way, neatly stacked. Our own crates are here too, with our batch numbers, unopened.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "There are records here from every ship on this heading, Commander. Ours too. I never sent ours." },
            { speaker: 'Tech Mira', text: "Our cargo list is here. It matches A.U.R.A.'s copy item for item." },
            { speaker: 'Spc. Vance', text: "There's a shelf labelled EXODUS OUTCOMES. Do we want to read that?" },
            { speaker: 'Dr. Aris', text: "Yes. I do." }
        ],
        choices: [
            {
                text: "Read the outcomes shelf",
                desc: "-1 Ration: a full day of reading. +8 Data. All crew +2 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 8;
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 2);
                    });
                    state.addLog("We read until we can't go on. Forty thousand ships, and every entry ends with the same word: stopped.");
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) state.addLog("Dr. Aris: \"Every one of these crews goes on my list. It'll take me the rest of my life.\"");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read the outcomes shelf');
                    state.noteStanding && state.noteStanding('aris');
                    return "Outcomes shelf read. -1 Ration, +8 Data. All crew +2 Stress.";
                }
            },
            {
                text: "Take the drive manuals",
                desc: "+30 Salvage, +20 Energy, and warps cost 10% less from now on. Aris +1 Stress: nothing gets read.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    state.energy = Math.min(100, state.energy + 20);
                    state._warpDiscount = (state._warpDiscount || 0) + 10;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("The drive manuals are copies of ours, with one extra chapter that ours doesn't have.");
                    state.addLog("We use them to tune the reactor. Nobody can make sense of the extra chapter.");
                    return "Manuals taken. +30 Salvage, +20 Energy, warps cost 10% less. Aris +1 Stress.";
                }
            },
            {
                text: "Cut up the shelves for metal",
                desc: "+120 Salvage. Aris +2 Stress. A.U.R.A. will think less of it.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 120);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 2);
                    state.addLog("A.U.R.A.: 'You're taking the shelves apart, Commander. I've logged which sections.'");
                    state.addLog("The shelves come down with every ship's records still on them.");
                    if (typeof AuraSystem !== 'undefined') {
                        AuraSystem.adjustEthics(-2, 'Cut up the archive for metal');
                    }
                    return "Shelves cut up and stored. +120 Salvage. Aris +2 Stress.";
                }
            },
            {
                text: "Read only the shelf about planets",
                desc: "-5 Energy. +3 Data. All planets revealed. All crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    state.sectorNodes?.forEach(p => {
                        p.remoteScanned = true;
                    });
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("The shelf lists every planet in this sector and what's on it. The list of good ones has a single entry, and it isn't in this sector.");
                    return "Planet shelf read. -5 Energy, +3 Data. All planets revealed. All crew +1 Stress.";
                }
            }
        ]
    }
];

// Export for use
if (typeof window !== 'undefined') {
    window.ANOMALY_ENCOUNTERS = ANOMALY_ENCOUNTERS;
}
