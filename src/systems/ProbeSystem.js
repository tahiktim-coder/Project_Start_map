class ProbeSystem {

    /**
     * Main logic for launching a probe.
     * Uses Data-Driven LootTables for scalable outcome generation.
     */
    static performProbe(planet, currentIntegrity) {
        // 1. Calculate Risk & Damage
        // Increased base damage to prevent "infinite probing". Max life ~8 launches.
        let damage = Math.floor(Math.random() * 10) + 10;
        let riskMsg = "Normal atmospheric stress";

        // Hazard Logic
        // Gravity Scaling: heavy Planets crush probes
        const gravity = planet.gravity || 1.0;
        if (gravity > 1.2) {
            const gDamage = Math.floor((gravity - 1.0) * 8); // e.g. 5G = +32 damage
            damage += gDamage;
            if (gDamage > 10) riskMsg = `High Gravity Detected (${gravity}G)`;
        }

        const dangerLevel = planet.dangerLevel || 0;
        if (dangerLevel > 1) {
            damage += 10;
            riskMsg = "High turbulence encountered";
        }
        if (planet.type === 'GAS_GIANT' || planet.type === 'VOLCANIC') {
            damage += 15;
            riskMsg = "Extreme pressure/heat detected";
        } else if (planet.atmosphere === 'CORROSIVE') {
            damage += 10;
            riskMsg = "Hull corrosion warnings";
        }

        // UPGRADE CHECK: NANOFIBER HULL
        const hasNano = window.app && window.app.state && window.app.state.upgrades.includes('nano_hull');
        if (hasNano) {
            damage = Math.floor(damage * 0.5);
            riskMsg += " [Plating Mitigated]";
        }

        // Critical Failure Check (if integrity gets too low)
        if (currentIntegrity - damage <= 0) {
            return {
                success: false,
                integrityLoss: currentIntegrity, // Destroys it
                message: `<span style="color:var(--color-danger)">CRITICAL FAILURE: Probe crushed by environmental stress. Telemetry lost.</span>`,
                reward: null
            };
        }

        // 2. DYNAMIC LOOT GENERATION (Scalable Engine)
        const finalPool = this.buildLootPool(planet);

        // 3. Select Outcome
        const selected = this.weightedRandom(finalPool);

        let reward = null;
        let finalMessage = "";

        if (selected) {
            if (selected.item) {
                // ITEM FOUND
                reward = { type: 'ITEM', data: selected.item };
                finalMessage = `Artifact retrieved: <span style="color:var(--color-accent)">${selected.item.name}</span>.`;
            } else if (selected.type === 'RESOURCE') {
                // RESOURCE FOUND
                const amount = Math.floor(selected.min + Math.random() * (selected.max - selected.min));
                if (selected.val === 'METALS') {
                    reward = { type: 'RESOURCE', resource: 'metals', amount: amount };
                    finalMessage = selected.log || `Extracted <span style="color:var(--color-primary)">${amount} Metals</span>.`;
                } else {
                    reward = { type: 'RESOURCE', resource: 'energy', amount: amount };
                    finalMessage = selected.log || `Siphoned <span style="color:var(--color-primary)">${amount} Energy</span> units.`;
                }
            } else if (selected.type === 'LORE') {
                // LORE FOUND
                reward = { type: 'DATA', text: selected.text };
                finalMessage = `DATA LOG: <span style="font-style:italic; color:#fff">${selected.text}</span>`;
            }
        }

        if (!reward) {
            finalMessage = "No significant resources found.";
        }

        return {
            success: true,
            integrityLoss: damage,
            message: `Probe returned (${riskMsg}). ${finalMessage} <span style="color:var(--color-danger); font-size:0.8em; margin-left:10px;">[-${damage}% HULL]</span>`,
            reward: reward
        };
    }

    /**
     * Iterates through LOOT_RULES and aggregates valid loot pools based on Planet State.
     */
    static buildLootPool(planet) {
        let aggPool = [];

        LOOT_RULES.forEach(rule => {
            if (rule.criteria(planet)) {
                // Rule Matched! Add its pool content.
                const poolContent = LOOT_POOLS[rule.pool];
                if (poolContent) {
                    aggPool = aggPool.concat(poolContent);
                }
            }
        });

        return aggPool;
    }

    // Utility for weighted random choice
    static weightedRandom(pool) {
        if (!pool || pool.length === 0) return null;

        const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
        let random = Math.random() * totalWeight;
        for (const entry of pool) {
            if (random < entry.weight) return entry;
            random -= entry.weight;
        }
        return pool[0];
    }
}
