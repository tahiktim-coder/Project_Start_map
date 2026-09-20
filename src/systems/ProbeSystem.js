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
                message: `<span style="color:var(--color-danger)">CRITICAL FAILURE: Probe crushed by environmental stress. Data lost.</span>`,
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
                // Try planet-type-aware thematic message
                const thematic = this.getThematicMessage(planet, selected);
                if (selected.val === 'METALS') {
                    reward = { type: 'RESOURCE', resource: 'metals', amount: amount };
                    finalMessage = thematic
                        ? `${thematic} <span style="color:var(--color-primary)">(+${amount} Salvage)</span>`
                        : (selected.log || `Extracted <span style="color:var(--color-primary)">${amount} Salvage</span>.`);
                } else {
                    reward = { type: 'RESOURCE', resource: 'energy', amount: amount };
                    finalMessage = thematic
                        ? `${thematic} <span style="color:var(--color-primary)">(+${amount} Energy)</span>`
                        : (selected.log || `Siphoned <span style="color:var(--color-primary)">${amount} Energy</span> units.`);
                }
            } else if (selected.type === 'LORE') {
                // LORE FOUND — always give a small resource bonus alongside the data
                const loreBonus = Math.floor(Math.random() * 6) + 5; // 5-10
                const bonusType = Math.random() > 0.5 ? 'metals' : 'energy';
                reward = { type: 'RESOURCE', resource: bonusType, amount: loreBonus, loreText: selected.text };
                const bonusLabel = bonusType === 'metals' ? 'Salvage' : 'Energy';
                finalMessage = `DATA LOG: <span style="font-style:italic; color:#fff">${selected.text}</span> <span style="color:var(--color-primary)">(+${loreBonus} ${bonusLabel} from signal decryption)</span>`;
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

    /**
     * Planet-type-aware loot description text
     * Returns a thematic message based on planet type + resource type
     */
    static getThematicMessage(planet, entry) {
        if (!planet || !entry) return null;
        const type = planet.type;
        const isMetals = entry.val === 'METALS';

        const THEMATIC = {
            ROCKY: {
                metals: ["Raw iron deposits pried from fractured bedrock.", "Mineral veins exposed by ancient tectonic shifts."],
                energy: ["Trace radioactive isotopes harvested from surface dust.", "Piezoelectric crystals yielded a modest charge."]
            },
            GAS_GIANT: {
                metals: ["Metallic hydrogen recovered from the upper atmosphere.", "Dense alloy particles filtered from cloud layers."],
                energy: ["Electromagnetic storm energy siphoned successfully.", "Atmospheric turbines captured enormous current."]
            },
            ICE_WORLD: {
                metals: ["Frozen ore cracked free from glacier formations.", "Sub-surface mineral deposits revealed beneath the permafrost."],
                energy: ["Thermal gradient between ice layers converted to power.", "Cryogenic fusion trace detected and harvested."]
            },
            OCEANIC: {
                metals: ["Seafloor nodules extracted from hydrothermal vents.", "Dissolved mineral concentrations filtered from ocean currents."],
                energy: ["Tidal energy conversion yielded surplus power.", "Bio-luminescent organisms provided chemical energy."]
            },
            DESERT: {
                metals: ["Sun-baked metal deposits scraped from dune formations.", "Ancient riverbeds revealed concentrated mineral sands."],
                energy: ["Solar radiation collection exceeded projections.", "Heat differentials between day/night cycles converted efficiently."]
            },
            VOLCANIC: {
                metals: ["Molten alloy samples collected from active flows.", "Volcanic glass fragments contained rare-earth elements."],
                energy: ["Geothermal energy tapped from magma chamber proximity.", "Superheated vents provided enormous power reserves."]
            },
            TOXIC: {
                metals: ["Corrosion-resistant alloys precipitated from acid rain.", "Metallic compounds isolated from toxic atmospheric soup."],
                energy: ["Chemical energy harvested from exothermic atmospheric reactions.", "Volatile gas pockets ignited for controlled energy release."]
            },
            VITAL: {
                metals: ["Bio-mineralized deposits found in fossilized reef structures.", "Natural alloy formations discovered beneath grasslands."],
                energy: ["Bio-electric organisms yielded sustainable power.", "Photosynthetic efficiency captured as usable energy."]
            },
            BIO_MASS: {
                metals: ["Calcified organic structures contained metallic compounds.", "The organism's circulatory system carries liquid metal."],
                energy: ["Bio-electrical discharge from the planetary organism.", "Metabolic byproducts converted to enormous energy reserves."]
            },
            MECHA: {
                metals: ["Salvaged armor plating from dormant war machines.", "Decommissioned weapons systems yielded refined alloys."],
                energy: ["Power cells extracted from ancient combat chassis.", "Dormant reactor cores still held residual charge."]
            },
            SHATTERED: {
                metals: ["Exposed planetary core fragments — pure dense metals.", "Gravitational compression created ultra-dense alloy deposits."],
                energy: ["Core radiation leakage captured through shielded collectors.", "Gravitational anomaly converted to usable power."]
            },
            TERRAFORMED: {
                metals: ["Precision-manufactured infrastructure components recovered.", "Perfectly preserved construction materials from terraforming arrays."],
                energy: ["Self-sustaining power grid still operational after millennia.", "Terraforming reactors yielded clean, stable energy."]
            },
            CRYSTALLINE: {
                metals: ["Crystal lattice structures contained embedded metals.", "Resonance mining shattered formations to reveal ore cores."],
                energy: ["Harmonic crystals resonated into energy. Remarkable.", "Piezoelectric output from crystal formations exceeded all models."]
            },
            ROGUE: {
                metals: ["Dense core materials accessible through the frozen surface.", "Ancient meteor impacts left rich metal deposits."],
                energy: ["Residual thermal energy from the planet's dying core.", "Radioactive decay provided faint but usable power."]
            },
            TIDALLY_LOCKED: {
                metals: ["Mineral deposits concentrated along the twilight boundary.", "Extreme temperature cycling crystallized rare metals at the terminator."],
                energy: ["Permanent temperature differential yielded infinite thermal energy.", "Solar collection on the bright side exceeded all parameters."]
            },
            HOLLOW: {
                metals: ["Shell material impossibly dense — unknown alloy composition.", "Interior scaffolding contained metals not on the periodic table."],
                energy: ["The interior star radiates harvestable energy continuously.", "Unknown energy source pulses from the hollow core."]
            },
            SYMBIOTE_WORLD: {
                metals: ["The biosphere offered mineral deposits willingly. Unsettling.", "Bio-manufactured alloys grew from the soil as we watched."],
                energy: ["The planet converted our waste heat into gift energy. It wants us to stay.", "Bio-electric tendrils connected to our collectors unprompted."]
            },
            MIRROR: {
                metals: ["The reflective surface is a perfect metallic alloy — samples taken.", "Sub-surface excavation revealed recursive mirror-metal layers."],
                energy: ["Our own energy signature reflected back, amplified. Impossible physics.", "Solar energy bounced infinitely between surface layers."]
            },
            GRAVEYARD: {
                metals: ["Stripped hull plating from a crushed freighter.", "Compressed wreckage yielded dense salvageable alloys.", "Ship graveyard: millions of tons of recyclable metal."],
                energy: ["Dead reactor cores still held trace power.", "Emergency batteries from a thousand ships — most still charged.", "Power conduits from an ancient vessel still flickered with current."]
            },
            SINGING: {
                metals: ["Resonance-hardened minerals formed by millennia of harmonic vibration.", "The singing crystallized nearby metals into pure formations."],
                energy: ["Harmonic frequencies converted directly to electrical charge.", "The planet's song IS energy — we captured a chorus.", "Sound-to-energy conversion yielded unprecedented output."]
            }
        };

        const typeMessages = THEMATIC[type];
        if (!typeMessages) return null;

        const messages = isMetals ? typeMessages.metals : typeMessages.energy;
        if (!messages || messages.length === 0) return null;

        return messages[Math.floor(Math.random() * messages.length)];
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
