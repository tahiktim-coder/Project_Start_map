const ITEMS = {
    // Biological
    RADIOTROPHIC_FUNGUS: {
        id: 'fungus', name: 'Radiotrophic Fungus', type: 'CONSUMABLE', value: 15,
        desc: 'Converts radiation to chemical energy.',
        onUse: (state) => { state.energy = Math.min(100, state.energy + 15); return "Energy restored by 15."; }
    },
    AMBER_SPECIMEN: {
        id: 'amber', name: 'Amber Specimen', type: 'ARTIFACT', value: 50,
        desc: 'Preserved biological sample from ancient era. A reminder that life persists.',
        onUse: (state) => {
            const stressed = state.crew.filter(c => c.status !== 'DEAD' && c.stress > 0);
            if (stressed.length === 0) return "The crew admires it, but no one needs comfort right now.";
            // Reduce stress for most stressed crew member
            const target = stressed.reduce((a, b) => (a.stress > b.stress) ? a : b);
            target.stress = Math.max(0, target.stress - 1);
            return `${target.name} holds the amber up to the light. Ancient life, frozen in time. Somehow comforting. Stress reduced.`;
        }
    },
    // Rocky/Barren
    GEODE_SAMPLE: {
        id: 'geode', name: 'Geode Sample', type: 'ARTIFACT', value: 40,
        desc: 'Crystalline formation hiding unexpected beauty within. Can be contemplated for stress relief.',
        onUse: (state) => {
            const stressed = state.crew.filter(c => c.status !== 'DEAD' && c.stress > 0);
            if (stressed.length === 0) return "The crystals catch the light beautifully, but no one needs the distraction.";
            const target = stressed.reduce((a, b) => (a.stress > b.stress) ? a : b);
            target.stress = Math.max(0, target.stress - 1);
            return `${target.name} turns the geode in their hands, watching light refract through crystal. Beauty in the void. Stress reduced.`;
        }
    },
    OBSIDIAN_MONOLITH: {
        id: 'monolith', name: 'Obsidian Monolith', type: 'ARTIFACT', value: 75,
        desc: 'Strange geometric stone carving. Staring into it brings unexpected peace.',
        onUse: (state) => {
            // More powerful - reduces stress for TWO crew members
            const stressed = state.crew.filter(c => c.status !== 'DEAD' && c.stress > 0);
            if (stressed.length === 0) return "The monolith's geometry is strange, but no one needs its calm right now.";
            // Sort by stress descending, take top 2
            stressed.sort((a, b) => b.stress - a.stress);
            const affected = stressed.slice(0, 2);
            affected.forEach(c => c.stress = Math.max(0, c.stress - 1));
            if (affected.length === 1) {
                return `${affected[0].name} stares into the monolith's depths. Something about its geometry... calming. Stress reduced.`;
            }
            return `${affected[0].name} and ${affected[1].name} gather around the monolith. Its impossible geometry somehow soothes them. Stress reduced for both.`;
        }
    },
    // Ruins/Tech
    SCRAP_PLATING: {
        id: 'scrap', name: 'Scrap Plating', type: 'RESOURCE', value: 10,
        desc: 'Salvageable alloy plating.',
        onUse: (state) => { state.salvage += 15; return "Salvaged +15 Salvage."; }
    },
    TECH_FRAGMENT: {
        id: 'tech_frag', name: 'Tech Fragment', type: 'LORE', value: 100,
        desc: 'Data storage device from a lost civilization. May contain useful calibration data for A.U.R.A.',
        onUse: (state) => {
            // Reset A.U.R.A. ethics toward neutral if AuraSystem exists
            if (window.AuraSystem) {
                const oldTier = window.AuraSystem.getTier();
                window.AuraSystem.ethicsScore = Math.min(window.AuraSystem.ethicsScore + 3, 2);
                const newTier = window.AuraSystem.getTier();
                if (oldTier !== newTier) {
                    return `A.U.R.A.: "Processing recovered data... recalibrating ethical parameters." A.U.R.A. disposition improved to ${newTier}.`;
                }
                return `A.U.R.A.: "Interesting data recovered. Adjusting baseline parameters." Ethics improved.`;
            }
            // Fallback if no AuraSystem - just give some salvage
            state.salvage += 20;
            return "Extracted useful schematics from the fragment. +20 Salvage.";
        }
    },

    // Condensed Resources (Found via Probe 5%)
    CONDENSED_SALVAGE: {
        id: 'condensed_salvage', name: 'Condensed Salvage', type: 'RESOURCE_PACK', value: 50,
        desc: 'Highly compressed refined ores.',
        onUse: (state) => { state.salvage += 50; return "Processed +50 Salvage."; }
    },
    IONIZED_BATTERY: {
        id: 'ion_battery', name: 'Ionized Battery', type: 'RESOURCE_PACK', value: 30,
        desc: 'Unstable high-capacity energy cell.',
        onUse: (state) => { state.energy = Math.min(100, state.energy + 30); return "Drained +30 Energy."; }
    },
    // Fungus Culture (passive ration generator — NOT the consumable fungus above)
    FUNGUS_CULTURE: {
        id: 'FUNGUS_CULTURE', name: 'Radiotrophic Fungus Culture', type: 'LIVING', value: 80,
        desc: 'A contained colony of radiotrophic fungus. Feeds on background radiation, producing edible biomass. Passive: +1 Ration every 3 major actions.',
        onUse: null // Passive effect handled by GameState.consumeRation()
    },
    // Food Pack (ration recovery)
    FOOD_PACK: {
        id: 'food_pack', name: 'Sealed Food Pack', type: 'CONSUMABLE', value: 10,
        desc: 'Vacuum-sealed rations from a previous expedition. Still edible.',
        onUse: (state) => { state.rations = Math.min(state.maxRations, state.rations + 3); return "Rations restored by 3."; }
    },
    // Luxury Item (stress reducer)
    LUXURY_CHOCOLATE: {
        id: 'chocolate', name: 'Synth-Chocolate Ration', type: 'CONSUMABLE', value: 15,
        desc: 'Pre-war luxury. The taste of something that isn\'t recycled protein.',
        onUse: (state) => {
            const stressed = state.crew.filter(c => c.status !== 'DEAD' && c.stress > 0);
            if (stressed.length > 0) {
                const target = stressed.reduce((a, b) => (a.stress > b.stress) ? a : b);
                target.stress = Math.max(0, target.stress - 1);
                return `${target.name} savors the taste. Stress reduced.`;
            }
            return "No stressed crew to benefit.";
        }
    },
    MUSIC_HOLOTAPE: {
        id: 'holotape', name: 'Music Holotape', type: 'CONSUMABLE', value: 20,
        desc: 'A recording of Earth classical music. Brahms, apparently.',
        onUse: (state) => {
            let reduced = 0;
            state.crew.forEach(c => {
                if (c.status !== 'DEAD' && c.stress > 0) {
                    c.stress = Math.max(0, c.stress - 1);
                    reduced++;
                }
            });
            return reduced > 0 ? `${reduced} crew members relax as the music plays. Stress reduced for all.` : "No stressed crew to benefit.";
        }
    },
    // Dark Artifacts
    XENO_MYCELIUM: {
        id: 'xeno_mycelium', name: 'Xeno-Mycelium Spores', type: 'REVIVAL_BIO', value: 200,
        desc: 'Pulsing fungal matter that reacts to necrotic tissue. [Use on corpse]',
        onUse: null // Special handling in App
    },
    NEURAL_LINK: {
        id: 'neural_link', name: 'Ancient Neural Link', type: 'REVIVAL_TECH', value: 250,
        desc: 'Spider-like mesh that overrides nervous system decay. [Use on corpse]',
        onUse: null // Special handling
    },

    // === SIGNAL TYPE SPECIAL ITEMS ===

    // ALIEN SIGNAL items (high risk, high reward)
    ALIEN_TRANSMITTER: {
        id: 'alien_transmitter', name: 'Alien Transmitter', type: 'ARTIFACT', value: 150,
        desc: 'A device broadcasting on frequencies that shouldn\'t exist. Grants +10 Energy but causes unease.',
        onUse: (state) => {
            state.energy = Math.min(100, state.energy + 10);
            // Random crew gets +1 stress from the unnerving frequencies
            const living = state.crew.filter(c => c.status !== 'DEAD');
            if (living.length > 0 && Math.random() > 0.5) {
                const target = living[Math.floor(Math.random() * living.length)];
                target.stress = Math.min(3, target.stress + 1);
                return `Energy harvested from alien frequencies. ${target.name} reports hearing whispers. (+10 Energy, +1 Stress)`;
            }
            return "Energy harvested from alien frequencies. The crew tries not to think about who sent them. (+10 Energy)";
        }
    },
    XENOTECH_COMPONENT: {
        id: 'xenotech', name: 'Xenotech Component', type: 'TECH', value: 200,
        desc: 'Alien technology component. Can be integrated into ship systems for +20 Salvage worth of upgrades.',
        onUse: (state) => {
            state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
            return "Xenotech integrated into ship systems. Advanced alloys extracted. (+30 Salvage)";
        }
    },
    SIGNAL_DECODER: {
        id: 'signal_decoder', name: 'Signal Decoder', type: 'ARTIFACT', value: 120,
        desc: 'Alien device that can decode nearby signals. Use to reveal hidden information about the current sector.',
        onUse: (state) => {
            // Reveal all unscanned planets in sector
            if (state.sectorNodes) {
                let revealed = 0;
                state.sectorNodes.forEach(p => {
                    if (!p.remoteScanned && !p.scanned) {
                        p.remoteScanned = true;
                        revealed++;
                    }
                });
                if (revealed > 0) {
                    return `Signal decoder activated. ${revealed} planet(s) remotely scanned for free!`;
                }
            }
            return "Signal decoder activated. All planets in this sector already scanned.";
        }
    },

    // ANCIENT RUINS items (lore + knowledge)
    STAR_CHART_FRAGMENT: {
        id: 'star_chart', name: 'Star Chart Fragment', type: 'ARTIFACT', value: 80,
        desc: 'Ancient navigational data. Reduces warp costs by 5% for this session.',
        onUse: (state) => {
            state._warpDiscount = (state._warpDiscount || 0) + 5;
            return `Ancient navigation algorithms integrated. Future warp costs reduced by 5%. (Total: -${state._warpDiscount}%)`;
        }
    },
    CULTURAL_ARTIFACT: {
        id: 'cultural_artifact', name: 'Cultural Artifact', type: 'ARTIFACT', value: 60,
        desc: 'Object from a dead civilization. Contemplating their fate provides perspective.',
        onUse: (state) => {
            // Reduce stress for the whole crew by thinking about how their problems are small
            let reduced = 0;
            state.crew.forEach(c => {
                if (c.status !== 'DEAD' && c.stress > 0) {
                    c.stress = Math.max(0, c.stress - 1);
                    reduced++;
                }
            });
            return reduced > 0
                ? `The crew reflects on the artifact's former owners. They too struggled. Somehow, that helps. (-1 Stress for ${reduced} crew)`
                : "The artifact is interesting, but no one needs perspective right now.";
        }
    },
    ANCIENT_DATABASE: {
        id: 'ancient_database', name: 'Ancient Database', type: 'LORE', value: 100,
        desc: 'Intact data storage from a previous civilization. Contains valuable technical schematics.',
        onUse: (state) => {
            // Gives significant salvage as you decode the schematics
            state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
            state.energy = Math.min(100, state.energy + 10);
            return "Database decoded. Schematics for efficient power systems recovered. (+25 Salvage, +10 Energy)";
        }
    },

    // BIOLOGICAL signal items (life = hope)
    BIO_SAMPLE_RARE: {
        id: 'bio_sample_rare', name: 'Rare Bio-Sample', type: 'CONSUMABLE', value: 90,
        desc: 'Exotic biological specimen with remarkable healing properties. Heals one injured crew member.',
        onUse: (state) => {
            const injured = state.crew.filter(c => c.status === 'INJURED');
            if (injured.length === 0) return "No injured crew to heal.";
            const target = injured[0];
            target.status = 'HEALTHY';
            return `${target.name} treated with rare bio-compounds. They are now HEALTHY.`;
        }
    },
    SYMBIOTIC_CULTURE: {
        id: 'symbiotic_culture', name: 'Symbiotic Culture', type: 'LIVING', value: 120,
        desc: 'Beneficial organism that bonds with crew. Reduces ration consumption. Passive: -1 ration consumption every 5 actions.',
        onUse: null // Passive effect like fungus culture
    },

    // TECHNOLOGICAL signal items (machines = resources)
    SALVAGE_BEACON: {
        id: 'salvage_beacon', name: 'Salvage Beacon', type: 'TECH', value: 70,
        desc: 'Automated beacon that locates nearby salvage. Use to get immediate salvage.',
        onUse: (state) => {
            const amount = Math.floor(Math.random() * 20) + 15; // 15-35 salvage
            state.salvage = Math.min(state.maxSalvage, state.salvage + amount);
            return `Salvage beacon activated. Automated drones recovered ${amount} salvage.`;
        }
    },
    POWER_COUPLER: {
        id: 'power_coupler', name: 'Power Coupler', type: 'TECH', value: 55,
        desc: 'High-efficiency power transfer system. Converts to pure energy.',
        onUse: (state) => {
            state.energy = Math.min(100, state.energy + 25);
            return "Power coupler interfaced with ship systems. +25 Energy.";
        }
    },
    REPAIR_DRONE: {
        id: 'repair_drone', name: 'Repair Drone', type: 'TECH', value: 150,
        desc: 'Autonomous repair unit. Can repair a damaged deck.',
        onUse: (state) => {
            const damaged = Object.entries(state.shipDecks).filter(([k, d]) => d.status === 'DAMAGED');
            if (damaged.length === 0) return "No damaged decks to repair.";
            const [deckKey, deck] = damaged[0];
            deck.status = 'OPERATIONAL';
            return `Repair drone deployed. ${deck.label || deckKey.toUpperCase()} deck restored to operational status.`;
        }
    }
};
