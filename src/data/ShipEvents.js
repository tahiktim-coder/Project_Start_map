/**
 * SHIP EVENTS - Random malfunctions and incidents aboard the Exodus-9
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
        context: "A power conduit overloads. Sparks fly across the engineering bay.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Conduit 7-C just blew! Rerouting power now!" },
            { speaker: 'A.U.R.A.', text: "Power fluctuation detected. Multiple systems affected." }
        ],
        effect: (state) => {
            const energyLoss = Math.floor(Math.random() * 10) + 5; // 5-15 energy
            state.energy = Math.max(0, state.energy - energyLoss);
            state.addLog(`Power surge! -${energyLoss} Energy lost to damaged conduits.`);

            // 30% chance to damage engineering
            if (Math.random() < 0.3 && state.isDeckOperational('engineering')) {
                state.shipDecks.engineering.status = 'DAMAGED';
                state.addLog("CRITICAL: Engineering deck damaged in the surge!");
                return `Power surge caused ${energyLoss} energy loss. Engineering deck DAMAGED.`;
            }
            return `Power surge contained. Lost ${energyLoss} energy to the overload.`;
        }
    },

    {
        id: 'LIFE_SUPPORT_HICCUP',
        weight: 10,
        title: "Life Support Warning",
        condition: (state) => true,
        context: "The air recyclers stutter. For one long moment, the ship holds its breath.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "CO2 levels spiking. Everyone stay calm." },
            { speaker: 'Tech Mira', text: "Backup filters are kicking in. We're okay. For now." }
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
            state.addLog("Life support recovered. The scare left everyone on edge.");
            return `Life support briefly failed. ${affected} crew members stressed by the incident.`;
        }
    },

    // --- HULL INCIDENTS ---
    {
        id: 'MICRO_METEOR',
        weight: 12,
        title: "Micrometeorite Impact",
        condition: (state) => true,
        context: "A sharp crack echoes through the hull. Something small and fast just hit us.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "Impact! Checking for breaches!" },
            { speaker: 'Eng. Jaxon', text: "Hull integrity... holding. Barely. That was close." }
        ],
        effect: (state) => {
            // Pick a random operational deck to damage
            const operational = Object.entries(state.shipDecks)
                .filter(([k, v]) => v.status === 'OPERATIONAL');

            if (operational.length > 0 && Math.random() < 0.4) {
                const [deckKey, deck] = operational[Math.floor(Math.random() * operational.length)];
                state.shipDecks[deckKey].status = 'DAMAGED';
                state.addLog(`Micrometeorite breached ${deck.label}! Deck DAMAGED.`);
                return `Micrometeorite strike! ${deck.label} damaged. Repairs needed.`;
            }

            // Near miss - just some salvage lost
            const salvageLoss = Math.floor(Math.random() * 10) + 5;
            state.salvage = Math.max(0, state.salvage - salvageLoss);
            state.addLog(`Impact shook loose external cargo. -${salvageLoss} Salvage.`);
            return `Glancing hit. Lost ${salvageLoss} salvage to the impact.`;
        }
    },

    {
        id: 'HULL_STRESS',
        weight: 8,
        title: "Hull Stress Fractures",
        condition: (state) => state.currentSector >= 2, // Only in later sectors
        context: "The ship groans. Metal fatigue is catching up to us.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Stress fractures in Section 4. This ship wasn't built for what we're doing." },
            { speaker: 'A.U.R.A.', text: "Structural integrity at 73%. I recommend reducing warp frequency." }
        ],
        effect: (state) => {
            // Costs salvage to patch
            const repairCost = Math.floor(Math.random() * 15) + 10;
            if (state.salvage >= repairCost) {
                state.salvage -= repairCost;
                state.addLog(`Emergency hull patches applied. -${repairCost} Salvage.`);
                return `Hull cracks patched. Cost ${repairCost} salvage in materials.`;
            } else {
                // Not enough salvage - cargo gets damaged
                if (state.isDeckOperational('cargo')) {
                    state.shipDecks.cargo.status = 'DAMAGED';
                    state.addLog("Couldn't patch the breach in time. Cargo hold compromised!");
                    return "Hull breach! Cargo hold DAMAGED due to lack of repair materials.";
                }
                state.addLog("Hull groaning but holding. For now.");
                return "Structural stress noted. No materials to repair. Ship integrity declining.";
            }
        }
    },

    // --- SYSTEM FAILURES ---
    {
        id: 'SENSOR_GLITCH',
        weight: 10,
        title: "Sensor Malfunction",
        condition: (state) => state.isDeckOperational('bridge'),
        context: "The navigation displays flicker and die. For a moment, we're blind.",
        dialogue: [
            { speaker: 'Tech Mira', text: "Sensors are down! Running diagnostics..." },
            { speaker: 'Spc. Vance', text: "I don't like being blind out here. Fix it. Now." }
        ],
        effect: (state) => {
            // 50% chance bridge gets damaged
            if (Math.random() < 0.5) {
                state.shipDecks.bridge.status = 'DAMAGED';
                state.addLog("Sensor array burned out. Bridge systems offline!");
                return "Sensor failure! Bridge DAMAGED. Navigation compromised.";
            }

            // Otherwise just energy cost to reboot
            const energyCost = Math.floor(Math.random() * 8) + 3;
            state.energy = Math.max(0, state.energy - energyCost);
            state.addLog(`Sensors rebooted. Emergency power drain: -${energyCost} Energy.`);
            return `Sensor glitch resolved. Cost ${energyCost} energy to restore systems.`;
        }
    },

    {
        id: 'CRYO_LEAK',
        weight: 6,
        title: "Coolant Leak",
        condition: (state) => true,
        context: "A pipe bursts. Freezing coolant sprays across the corridor.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "Coolant exposure! Get everyone clear!" },
            { speaker: 'Eng. Jaxon', text: "Shutting off that section. We're losing cooling capacity." }
        ],
        effect: (state) => {
            // Random crew injury
            const healthy = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
            if (healthy.length > 0 && Math.random() < 0.4) {
                const victim = healthy[Math.floor(Math.random() * healthy.length)];
                victim.status = 'INJURED';
                state.addLog(`${victim.name} caught in the coolant spray! Frostbite sustained.`);
                return `Coolant leak! ${victim.name} INJURED by freezing spray.`;
            }

            // Energy loss from cooling failure
            const energyLoss = Math.floor(Math.random() * 8) + 5;
            state.energy = Math.max(0, state.energy - energyLoss);
            state.addLog(`Coolant contained. Systems running hot. -${energyLoss} Energy.`);
            return `Coolant leak sealed. Lost ${energyLoss} energy to overheating systems.`;
        }
    },

    // --- CARGO INCIDENTS ---
    {
        id: 'CARGO_SHIFT',
        weight: 8,
        title: "Cargo Shift",
        condition: (state) => state.salvage > 20,
        context: "During the last maneuver, something in the cargo hold came loose.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Heard a crash from cargo. Better check on our supplies." },
            { speaker: 'A.U.R.A.', text: "Cargo integrity compromised. Recommend immediate inspection." }
        ],
        effect: (state) => {
            // Lose some salvage or rations
            if (Math.random() < 0.5) {
                const salvageLoss = Math.floor(Math.random() * 15) + 5;
                state.salvage = Math.max(0, state.salvage - salvageLoss);
                state.addLog(`Salvage containers ruptured. -${salvageLoss} Salvage lost.`);
                return `Cargo shift damaged supplies. Lost ${salvageLoss} salvage.`;
            } else {
                const rationLoss = Math.floor(Math.random() * 2) + 1;
                state.rations = Math.max(0, state.rations - rationLoss);
                state.addLog(`Ration containers breached. -${rationLoss} Rations spoiled.`);
                return `Cargo shift! ${rationLoss} rations destroyed in the accident.`;
            }
        }
    },

    {
        id: 'LAB_ACCIDENT',
        weight: 5,
        title: "Laboratory Accident",
        condition: (state) => state.isDeckOperational('lab'),
        context: "Something in the laboratory just shattered. A strange smell fills the air.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "Everyone out! Seal the lab until we know what broke!" },
            { speaker: 'Tech Mira', text: "Was that the sample containment? Oh no..." }
        ],
        effect: (state) => {
            // Lab gets damaged
            state.shipDecks.lab.status = 'DAMAGED';

            // Check if any cargo items should be destroyed
            if (state.cargo && state.cargo.length > 0) {
                const destroyed = state.cargo.pop();
                state.addLog(`${destroyed.name} destroyed in the lab accident!`);
                state.addLog("Laboratory sealed until decontamination complete.");
                return `Lab accident! ${destroyed.name} lost. Laboratory DAMAGED.`;
            }

            state.addLog("Laboratory sealed. Unknown contamination risk.");
            return "Lab accident! Laboratory DAMAGED. Decontamination required.";
        }
    },

    // --- POSITIVE EVENTS (rare) ---
    {
        id: 'LUCKY_FIND',
        weight: 3,
        title: "Forgotten Supplies",
        condition: (state) => true,
        context: "While running routine checks, someone found a sealed compartment we'd forgotten about.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Hey, there's a whole maintenance kit in here! And some rations!" },
            { speaker: 'Dr. Aris', text: "Small victories. We'll take them." }
        ],
        effect: (state) => {
            const bonus = Math.random();
            if (bonus < 0.4) {
                state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                state.addLog("Found forgotten maintenance supplies! +20 Salvage.");
                return "Lucky find! +20 Salvage from forgotten storage.";
            } else if (bonus < 0.7) {
                state.rations = Math.min(state.maxRations, state.rations + 3);
                state.addLog("Emergency rations discovered! +3 Rations.");
                return "Lucky find! +3 Rations from sealed container.";
            } else {
                state.energy = Math.min(100, state.energy + 15);
                state.addLog("Backup power cells found! +15 Energy.");
                return "Lucky find! +15 Energy from reserve cells.";
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
