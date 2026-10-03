/**
 * SHIP EVENTS - Random malfunctions and incidents aboard Exodus-9
 *
 * Triggers: On warp, sector jump, or randomly during actions
 * Creates drama and resource pressure
 */

const SHIP_MALFUNCTION_EVENTS = [
    // --- POWER FAILURES ---
    {
        id: 'POWER_SURGE',
        weight: 15,
        title: "Power Surge",
        condition: (state) => state.energy > 20, // Need some power to surge
        context: "A power line overloads, and sparks fly across the engine room.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "A power line just blew. I'm rerouting around it now." },
            { speaker: 'A.U.R.A.', text: "Power is dropping on several systems, Commander. Rerouting is under way." }
        ],
        effect: (state) => {
            const energyLoss = Math.floor(Math.random() * 10) + 5; // 5-15 energy
            state.energy = Math.max(0, state.energy - energyLoss);
            state.addLog(`Power surge. -${energyLoss} Energy lost through the damaged line.`);

            // 30% chance to damage engineering
            if (Math.random() < 0.3 && state.isDeckOperational('engineering')) {
                state.shipDecks.engineering.status = 'DAMAGED';
                state.addLog("The engineering deck was damaged in the surge.");
                return `Power surge. -${energyLoss} Energy. Engineering deck damaged.`;
            }
            return `Power surge under control. -${energyLoss} Energy.`;
        }
    },

    {
        id: 'LIFE_SUPPORT_HICCUP',
        weight: 10,
        title: "Air System Warning",
        condition: (state) => true,
        context: "The air recyclers stop for a moment. Then they start again.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "Carbon dioxide is climbing. Everyone breathe slowly and stay calm." },
            { speaker: 'Tech Mira', text: "The backup filters just switched on. We're fine now." }
        ],
        effect: (state) => {
            // All crew gain +1 stress from the scare
            let affected = 0;
            state.crew.forEach(c => {
                if (c.status !== 'DEAD' && c.stress < 3) {
                    c.stress = Math.min(3, c.stress + 1);
                    affected++;
                }
            });
            state.addLog("The air system is working again, but everyone is on edge.");
            return `The air system failed for a moment. ${affected} crew +1 Stress.`;
        }
    },

    // --- HULL INCIDENTS ---
    {
        id: 'MICRO_METEOR',
        weight: 12,
        title: "Small Impact",
        condition: (state) => true,
        context: "Something small hit the hull at high speed. The crack echoed through the whole ship.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "We've been hit. I'm checking for holes." },
            { speaker: 'Eng. Jaxon', text: "The hull's holding. That one was close." }
        ],
        effect: (state) => {
            // Pick a random operational deck to damage
            const operational = Object.entries(state.shipDecks)
                .filter(([k, v]) => v.status === 'OPERATIONAL');

            if (operational.length > 0 && Math.random() < 0.4) {
                const [deckKey, deck] = operational[Math.floor(Math.random() * operational.length)];
                state.shipDecks[deckKey].status = 'DAMAGED';
                state.addLog(`A small rock punched into ${deck.label}. Deck damaged.`);
                return `Impact. ${deck.label} damaged and needs repair.`;
            }

            // Near miss - just some salvage lost
            const salvageLoss = Math.floor(Math.random() * 10) + 5;
            state.salvage = Math.max(0, state.salvage - salvageLoss);
            state.addLog(`The impact knocked cargo off the outside racks. -${salvageLoss} Salvage.`);
            return `Glancing hit. -${salvageLoss} Salvage.`;
        }
    },

    {
        id: 'HULL_STRESS',
        weight: 8,
        title: "Hull Cracks",
        condition: (state) => state.currentSector >= 2, // Only in later sectors
        context: "The ship creaks. The hull is starting to crack from the strain of so many jumps.",
        dialogue: (state) => {
            const damagedCount = Object.values(state.shipDecks || {}).filter(d => d.status !== 'OPERATIONAL').length;
            const warningLevel = damagedCount >= 2 ? "Several decks already need repair." : "I recommend patching them now.";
            return [
                { speaker: 'Eng. Jaxon', text: "Small cracks are forming in the hull. She's been through a lot." },
                { speaker: 'A.U.R.A.', text: `Hull cracks detected, Commander. ${warningLevel}` }
            ];
        },
        effect: (state) => {
            // Costs salvage to patch
            const repairCost = Math.floor(Math.random() * 15) + 10;
            if (state.salvage >= repairCost) {
                state.salvage -= repairCost;
                state.addLog(`Hull patched. -${repairCost} Salvage.`);
                return `Hull cracks patched. -${repairCost} Salvage.`;
            } else {
                // Not enough salvage - cargo gets damaged
                if (state.isDeckOperational('cargo')) {
                    state.shipDecks.cargo.status = 'DAMAGED';
                    state.addLog("We couldn't patch the crack in time. The cargo hold is open to space.");
                    return "Hull breach. Cargo hold damaged. We had no metal to patch it.";
                }
                state.addLog("The hull is creaking, but it's holding for now.");
                return "Hull cracks noted. We have no metal to repair them.";
            }
        }
    },

    // --- SYSTEM FAILURES ---
    {
        id: 'SENSOR_GLITCH',
        weight: 10,
        title: "Sensor Failure",
        condition: (state) => state.isDeckOperational('bridge'),
        context: "The navigation screens flicker and go dark. For a moment, we can't see anything outside.",
        dialogue: [
            { speaker: 'Tech Mira', text: "Sensors are down. I'm running a check now." },
            { speaker: 'Spc. Vance', text: "I don't like flying blind out here. Get them back up." }
        ],
        effect: (state) => {
            // 50% chance bridge gets damaged
            if (Math.random() < 0.5) {
                state.shipDecks.bridge.status = 'DAMAGED';
                state.addLog("The sensor array burned out. The bridge is down.");
                return "Sensors failed. Bridge damaged.";
            }

            // Otherwise just energy cost to reboot
            const energyCost = Math.floor(Math.random() * 8) + 3;
            state.energy = Math.max(0, state.energy - energyCost);
            state.addLog(`Sensors restarted. -${energyCost} Energy.`);
            return `Sensors back online. -${energyCost} Energy.`;
        }
    },

    {
        id: 'CRYO_LEAK',
        weight: 6,
        title: "Coolant Leak",
        condition: (state) => true,
        context: "A pipe bursts and sprays freezing coolant down the corridor.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "Coolant leak! Everyone get clear of the corridor!" },
            { speaker: 'Eng. Jaxon', text: "I'm shutting off that section. We'll lose some cooling." }
        ],
        effect: (state) => {
            // Random crew injury
            const healthy = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
            if (healthy.length > 0 && Math.random() < 0.4) {
                const victim = healthy[Math.floor(Math.random() * healthy.length)];
                victim.status = 'INJURED';
                state.addLog(`${victim.name} was caught in the spray and has frostbite.`);
                return `Coolant leak. ${victim.name} injured.`;
            }

            // Energy loss from cooling failure
            const energyLoss = Math.floor(Math.random() * 8) + 5;
            state.energy = Math.max(0, state.energy - energyLoss);
            state.addLog(`Leak sealed. Systems are running hot. -${energyLoss} Energy.`);
            return `Coolant leak sealed. -${energyLoss} Energy.`;
        }
    },

    // --- CARGO INCIDENTS ---
    {
        id: 'CARGO_SHIFT',
        weight: 8,
        title: "Cargo Came Loose",
        condition: (state) => state.salvage > 20,
        context: "Something in the cargo hold broke loose during the last burn.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "I heard a crash from the hold. We'd better check the supplies." },
            { speaker: 'A.U.R.A.', text: "There's damage in the cargo hold, Commander. Someone should take a look." }
        ],
        effect: (state) => {
            // Lose some salvage or rations - guaranteed loss
            if (Math.random() < 0.5 && state.salvage > 0) {
                const salvageLoss = Math.min(state.salvage, Math.floor(Math.random() * 15) + 5);
                state.salvage = Math.max(0, state.salvage - salvageLoss);
                state.addLog(`Salvage crates split open. -${salvageLoss} Salvage.`);
                return `Cargo damaged. -${salvageLoss} Salvage.`;
            } else if (state.rations > 0) {
                const rationLoss = Math.min(state.rations, Math.floor(Math.random() * 2) + 1);
                state.rations = Math.max(0, state.rations - rationLoss);
                state.addLog(`Ration crates split open. -${rationLoss} Rations spoiled.`);
                return `Cargo damaged. -${rationLoss} Rations.`;
            } else {
                state.addLog("The cargo shifted, but the hold was empty, so nothing was lost.");
                return "Cargo shifted. Nothing was damaged.";
            }
        }
    },

    {
        id: 'LAB_ACCIDENT',
        weight: 5,
        title: "Lab Accident",
        condition: (state) => state.isDeckOperational('lab'),
        context: "Something in the lab just shattered, and there's a strange smell in the air.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "Everybody out. Seal the lab until we know what broke." },
            { speaker: 'Tech Mira', text: "Was that the sample storage? Oh no." }
        ],
        effect: (state) => {
            // Lab gets damaged
            state.shipDecks.lab.status = 'DAMAGED';

            // Check if any cargo items should be destroyed
            const loseIdx = (state.cargo || []).map((item, i) => item.isKept ? -1 : i).filter(i => i >= 0).pop();   // papers and tapes survive; a crate does not
            if (loseIdx !== undefined) {
                const destroyed = state.cargo.splice(loseIdx, 1)[0];
                state.addLog(`The ${destroyed.name} was destroyed in the accident.`);
                state.addLog("The lab is sealed until it has been cleaned.");
                return `Lab accident. ${destroyed.name} lost. Lab damaged.`;
            }

            state.addLog("Lab sealed. We don't know yet what was released.");
            return "Lab accident. Lab damaged and sealed.";
        }
    },

    // --- POSITIVE EVENTS (rare) ---
    {
        id: 'LUCKY_FIND',
        weight: 3,
        title: "Forgotten Supplies",
        condition: (state) => true,
        context: "During a routine check, someone found a sealed locker nobody remembered.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "There's a full repair kit in here. And food!" },
            { speaker: 'Dr. Aris', text: "We'll take any good news we can get." }
        ],
        effect: (state) => {
            const bonus = Math.random();
            if (bonus < 0.4) {
                state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                state.addLog("Forgotten repair supplies. +20 Salvage.");
                return "Forgotten supplies found. +20 Salvage.";
            } else if (bonus < 0.7) {
                state.rations = Math.min(state.maxRations, state.rations + 3);
                state.addLog("Forgotten food packs. +3 Rations.");
                return "Forgotten supplies found. +3 Rations.";
            } else {
                state.energy = Math.min(100, state.energy + 15);
                state.addLog("Forgotten spare power cells. +15 Energy.");
                return "Forgotten supplies found. +15 Energy.";
            }
        }
    }
];

/**
 * Roll for a ship malfunction
 * @param {object} state - Game state
 * @param {string} trigger - What triggered the check ('warp', 'sector_jump', 'action')
 * @returns {object|null} - Selected event or null if none
 */
function rollShipMalfunction(state, trigger = 'action') {
    // Base chance depends on trigger
    let chance = 0;
    switch(trigger) {
        case 'warp':
            chance = 0.08; // 8% per warp
            break;
        case 'sector_jump':
            chance = 0.15; // 15% per sector jump
            break;
        case 'action':
            chance = 0.02; // 2% per action (rare)
            break;
    }

    // Increase chance if engineering is damaged
    if (!state.isDeckOperational('engineering')) {
        chance *= 2;
    }

    // Increase chance in later sectors (ship wearing down)
    chance += (state.currentSector - 1) * 0.02;

    // TEST_MODE: Always trigger
    if (window.TEST_MODE) {
        chance = 1.0;
    }

    if (Math.random() > chance) {
        return null; // No malfunction
    }

    // Filter eligible events
    const eligible = SHIP_MALFUNCTION_EVENTS.filter(e => e.condition(state));
    if (eligible.length === 0) return null;

    // Select by weight
    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const event of eligible) {
        roll -= event.weight;
        if (roll <= 0) return event;
    }

    return eligible[0];
}

// Export
if (typeof window !== 'undefined') {
    window.SHIP_MALFUNCTION_EVENTS = SHIP_MALFUNCTION_EVENTS;
    window.rollShipMalfunction = rollShipMalfunction;
}
