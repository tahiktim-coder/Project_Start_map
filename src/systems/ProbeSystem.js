class ProbeSystem {

    /**
     * Main logic for launching a probe.
     * Uses Data-Driven LootTables for scalable outcome generation.
     */
    static performProbe(planet, currentIntegrity) {
        // 1. Calculate Risk & Damage
        let damage = Math.floor(Math.random() * 10) + 5;
        let riskMsg = "Normal atmospheric stress.";

        // Hazard Logic
        const dangerLevel = planet.dangerLevel || 0;
        if (dangerLevel > 1) {
            damage += 10;
            riskMsg = "High turbulence encountered.";
        }
        if (planet.type === 'GAS_GIANT' || planet.type === 'VOLCANIC') {
            damage += 15;
            riskMsg = "Extreme pressure/heat detected.";
        } else if (planet.atmosphere === 'CORROSIVE') {
            damage += 10;
            riskMsg = "Hull corrosion warnings.";
        }

        // Critical Failure Check (if integrity gets too low)
        if (currentIntegrity - damage <= 0) {
            return {
                success: false,
                integrityLoss: currentIntegrity, // Destroys it
                message: "CRITICAL FAILURE: Probe telemetry lost. Hull integrity critical.",
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
                finalMessage = `Artifact retrieved: ${selected.item.name}.`;
            } else if (selected.type === 'RESOURCE') {
                // RESOURCE FOUND
                const amount = Math.floor(selected.min + Math.random() * (selected.max - selected.min));
                if (selected.val === 'METALS') {
                    reward = { type: 'RESOURCE', resource: 'metals', amount: amount };
                    finalMessage = selected.log || `Extracted ${amount} Metals.`;
                } else {
                    reward = { type: 'RESOURCE', resource: 'energy', amount: amount };
                    finalMessage = selected.log || `Siphoned ${amount} Energy units.`;
                }
            } else if (selected.type === 'LORE') {
                // LORE FOUND
                reward = { type: 'DATA', text: selected.text };
                finalMessage = `DATA LOG: ${selected.text}`;
            }
        }

        if (!reward) {
            finalMessage = "No significant resources found.";
        }

        return {
            success: true,
            integrityLoss: damage,
            message: `Probe returned (${riskMsg}). ${finalMessage}`,
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
