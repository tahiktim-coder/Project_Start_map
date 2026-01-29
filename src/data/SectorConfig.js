// SECTOR_CONFIG: Central definition for all 5 sectors
// Each sector has planet restrictions, hazards, and atmosphere rules

// Helper: Test-aware random check - when TEST_MODE is on, rare events always trigger
function _testChance(chance) {
    if (window.TEST_MODE) return chance > 0; // Any non-zero chance triggers
    return Math.random() < chance;
}

const SECTOR_CONFIG = {
    1: {
        name: 'THE GRAVEYARD',
        planetCount: [3, 5],
        allowedTypes: ['ROCKY', 'DESERT', 'ICE_WORLD', 'GAS_GIANT'],
        guaranteedTypes: [],
        typeBias: null,
        wreckageChance: 0.50,
        exodusWreckChance: 0.30,
        failedColonyChance: 0.0,
        derelictChance: 0.25,  // Mining rigs and early expedition ships
        anomalyChance: 0.0,    // No anomalies in S1
        colonyWarning: true,
        sectorColor: '#888888',
        ambientDesc: 'Wreckage drifts past the viewport. The graveyard of humanity\'s first attempts.',
        hazard: {
            id: 'MICROMETEORITES',
            description: 'Debris field from dead ships',
            onWarp: function(state) {
                // 20% chance to damage a random deck per warp
                if (_testChance(0.20)) {
                    const result = state.damageRandomDeck();
                    if (result) {
                        state.addLog('WARNING: Micrometeorite impact detected! ' + state.shipDecks[result].label + ' sustained damage.');
                    }
                }
            },
            onScan: null,
            onDeepScan: null,
            onSectorEnter: null,
            onPlanetGenerate: null
        }
    },

    2: {
        name: 'THE DARK VOID',
        planetCount: [2, 3],
        allowedTypes: ['ICE_WORLD', 'ROGUE', 'ROCKY', 'GAS_GIANT'],
        guaranteedTypes: [],
        typeBias: null,
        wreckageChance: 0.10,
        exodusWreckChance: 0.30,
        failedColonyChance: 0.0,
        derelictChance: 0.15,  // Fewer ships made it this far
        anomalyChance: 0.0,    // No anomalies in S2
        colonyWarning: true,
        sectorColor: '#220044',
        ambientDesc: 'Empty space. The distance between stars doubles. Total silence.',
        hazard: {
            id: 'ISOLATION',
            description: 'The void between stars',
            onWarp: function(state) {
                // +1 stress to random living crew on each warp
                const living = state.crew.filter(c => c.status !== 'DEAD');
                if (living.length > 0) {
                    const target = living[Math.floor(Math.random() * living.length)];
                    target.stress = Math.min(3, (target.stress || 0) + 1);
                    state.addLog(`${target.name}: The void is getting to me. Everything feels... far away.`);
                }
            },
            onScan: null,
            onDeepScan: null,
            onSectorEnter: null,
            onPlanetGenerate: null
        }
    },

    3: {
        name: 'THE SIGNAL',
        planetCount: [3, 5],
        allowedTypes: null, // all types allowed
        guaranteedTypes: [],
        typeBias: null,
        wreckageChance: 0.20,
        exodusWreckChance: 0.20,
        failedColonyChance: 0.20,
        derelictChance: 0.20,  // Mixed wreckage, some alien
        anomalyChance: 0.15,   // First glimpses of weirdness (increased from 0.05)
        colonyWarning: false,
        sectorColor: '#004488',
        ambientDesc: 'A rhythmic tapping on all frequencies. Something is broadcasting.',
        hazard: {
            id: 'INTERFERENCE',
            description: 'Unknown signal source disrupts instruments',
            onWarp: null,
            onScan: function(planet, state) {
                // 20% chance remote scan gives false/scrambled data
                if (_testChance(0.20)) {
                    // Swap revealed stats to wrong values
                    if (planet.revealedStats && planet.revealedStats.length > 0) {
                        const fakeAtmos = ['BREATHABLE', 'TOXIC', 'THIN', 'CORROSIVE', 'NONE'];
                        planet._realAtmosphere = planet.atmosphere;
                        planet.atmosphere = fakeAtmos[Math.floor(Math.random() * fakeAtmos.length)];
                        planet._scanCorrupted = true;
                        state.addLog('A.U.R.A.: "Signal interference detected during scan. Data integrity... uncertain."');
                    }
                }
            },
            onDeepScan: function(planet) {
                // Deep scan corrects any corrupted remote scan data
                if (planet._scanCorrupted && planet._realAtmosphere) {
                    planet.atmosphere = planet._realAtmosphere;
                    delete planet._scanCorrupted;
                    delete planet._realAtmosphere;
                }
            },
            onSectorEnter: function(state, planets) {
                // Add 1 ghost planet blip to the sector
                if (_testChance(0.60)) {
                    const ghostNames = ['Echo-' + Math.floor(Math.random() * 99), 'Phantom-' + Math.floor(Math.random() * 99), 'Mirage-' + Math.floor(Math.random() * 99)];
                    const ghost = {
                        id: 'ghost_' + Date.now(),
                        name: ghostNames[Math.floor(Math.random() * ghostNames.length)],
                        type: ['VITAL', 'TERRAFORMED', 'OCEANIC'][Math.floor(Math.random() * 3)],
                        ghost: true,
                        fuelCost: 8,
                        gravity: (Math.random() * 1.5 + 0.5).toFixed(2) + 'G',
                        temperature: Math.floor(Math.random() * 40 - 10) + '°C',
                        atmosphere: 'BREATHABLE',
                        resources: { metals: 60 + Math.floor(Math.random() * 40), energy: 50 + Math.floor(Math.random() * 40) },
                        dangerLevel: 0,
                        tags: [],
                        metrics: { hasLife: true, hasTech: false },
                        mapData: {
                            x: 15 + Math.random() * 70,
                            y: 15 + Math.random() * 70
                        }
                    };
                    planets.push(ghost);
                }
            },
            onPlanetGenerate: null
        }
    },

    4: {
        name: 'THE GARDEN',
        planetCount: [4, 6],
        allowedTypes: null, // all types, but biased
        guaranteedTypes: [],
        typeBias: {
            'VITAL': 4,
            'OCEANIC': 3,
            'BIO_MASS': 2,
            'TERRAFORMED': 2,
            'SYMBIOTE_WORLD': 1
        },
        wreckageChance: 0.10,
        exodusWreckChance: 0.10,
        failedColonyChance: 0.40,
        derelictChance: 0.15,   // Some generation ships that almost made it
        anomalyChance: 0.35,    // Reality getting weird (increased from 0.20)
        colonyWarning: false,
        sectorColor: '#006600',
        ambientDesc: 'It looks like home. That\'s what makes it dangerous.',
        hazard: {
            id: 'FALSE_PARADISE',
            description: 'Not everything green is safe',
            onWarp: function(state) {
                // Crew resists leaving VITAL worlds: +1 stress if breaking orbit from VITAL
                // (handled in break orbit logic, not warp)
            },
            onScan: null,
            onDeepScan: function(planet) {
                // Reveal hidden PREDATORY tag on deep scan
                if (planet._hiddenTags && planet._hiddenTags.length > 0) {
                    planet.tags = planet.tags || [];
                    planet._hiddenTags.forEach(t => {
                        if (!planet.tags.includes(t)) planet.tags.push(t);
                    });
                    delete planet._hiddenTags;
                }
            },
            onSectorEnter: null,
            onPlanetGenerate: function(planet) {
                // 50% of VITAL planets get hidden PREDATORY tag
                if (planet.type === 'VITAL' && _testChance(0.50)) {
                    planet._hiddenTags = planet._hiddenTags || [];
                    planet._hiddenTags.push('PREDATORY');
                }
            }
        }
    },

    5: {
        name: 'THE EVENT HORIZON',
        planetCount: [3, 4],
        allowedTypes: ['SHATTERED', 'CRYSTALLINE', 'ROGUE', 'BIO_MASS', 'SINGING', 'MIRROR'],
        guaranteedTypes: ['TERRAFORMED'],
        typeBias: null,
        wreckageChance: 0.10,
        exodusWreckChance: 0.10,
        failedColonyChance: 0.0,
        derelictChance: 0.10,   // Alien craft more common here
        anomalyChance: 0.50,    // Reality breaking down (increased from 0.35)
        colonyWarning: false,
        sectorColor: '#440044',
        ambientDesc: 'The laws of physics are suggestions here. Your instruments scream.',
        hazard: {
            id: 'REALITY_BREAKDOWN',
            description: 'Spacetime itself is unreliable',
            onWarp: function(state) {
                // 20% chance of random effect per warp
                if (_testChance(0.20)) {
                    const effects = [
                        {
                            action: 'heal',
                            execute: function(s) {
                                const injured = s.crew.filter(c => c.status === 'INJURED');
                                if (injured.length > 0) {
                                    const target = injured[Math.floor(Math.random() * injured.length)];
                                    target.status = 'HEALTHY';
                                    s.addLog(`ANOMALY: Temporal distortion — ${target.name}'s injuries have... healed? Wounds closed between one second and the next.`);
                                } else {
                                    // If nobody injured, reduce stress
                                    const stressed = s.crew.filter(c => c.status !== 'DEAD' && c.stress > 0);
                                    if (stressed.length > 0) {
                                        const target = stressed[Math.floor(Math.random() * stressed.length)];
                                        target.stress = Math.max(0, target.stress - 1);
                                        s.addLog(`ANOMALY: ${target.name} seems calmer. They report dreaming of a place they've never been.`);
                                    }
                                }
                            }
                        },
                        {
                            action: 'damage_deck',
                            execute: function(s) {
                                const result = s.damageRandomDeck();
                                if (result) {
                                    s.addLog(`ANOMALY: Reality fluctuation — ${s.shipDecks[result].label} systems scrambled. Cause: unknown.`);
                                }
                            }
                        },
                        {
                            action: 'gain_rations',
                            execute: function(s) {
                                const gain = 2 + Math.floor(Math.random() * 3);
                                s.rations = Math.min(s.maxRations, s.rations + gain);
                                s.addLog(`ANOMALY: Cargo manifest shows ${gain} ration packs that weren't there before. Packaging is from Earth. Manufacturing date: tomorrow.`);
                            }
                        },
                        {
                            action: 'lose_salvage',
                            execute: function(s) {
                                const loss = 15 + Math.floor(Math.random() * 20);
                                const actual = Math.min(loss, s.salvage);
                                s.salvage = Math.max(0, s.salvage - loss);
                                s.addLog(`ANOMALY: ${actual} units of salvage phased out of existence. Molecular bonds simply... stopped. The metal remembered it was dust.`);
                            }
                        }
                    ];
                    const effect = effects[Math.floor(Math.random() * effects.length)];
                    effect.execute(state);
                }
            },
            onScan: null,
            onDeepScan: null,
            onSectorEnter: null,
            onPlanetGenerate: null
        }
    },

    6: {
        name: 'THE THRESHOLD',
        planetCount: [2, 3],
        allowedTypes: ['GHOST_WORLD', 'EDEN', 'HOLLOW', 'MIRROR', 'SINGING'],
        guaranteedTypes: ['EDEN'], // At least one perfect world
        typeBias: null,
        wreckageChance: 0.0,
        exodusWreckChance: 0.0,  // No more Exodus ships made it this far
        failedColonyChance: 0.0,
        derelictChance: 0.05,    // Rare alien craft only
        anomalyChance: 0.50,     // Half of all planets have anomalies
        colonyWarning: false,
        sectorColor: '#ffffff',
        ambientDesc: 'You have reached the edge of everything. Beyond this, there is only the unknown. THE STRUCTURE awaits.',
        hasStructure: true,      // Special flag for THE STRUCTURE
        hazard: {
            id: 'THRESHOLD_CALL',
            description: 'The boundary between known and unknown',
            onWarp: function(state) {
                // The Threshold heals and harms in equal measure
                // In test mode, always trigger something
                const roll = window.TEST_MODE ? 0.05 : Math.random();
                if (roll < 0.15) {
                    // Blessing
                    const injured = state.crew.filter(c => c.status === 'INJURED');
                    if (injured.length > 0) {
                        injured[0].status = 'HEALTHY';
                        state.addLog(`THRESHOLD: ${injured[0].name}'s wounds seal themselves. The boundary gives.`);
                    } else {
                        state.energy = Math.min(100, state.energy + 20);
                        state.addLog('THRESHOLD: Energy floods into the ship from nowhere. The boundary provides.');
                    }
                } else if (roll < 0.30) {
                    // Curse
                    const healthy = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                    if (healthy.length > 0) {
                        const target = healthy[Math.floor(Math.random() * healthy.length)];
                        target.stress = Math.min(3, (target.stress || 0) + 1);
                        state.addLog(`THRESHOLD: ${target.name} hears something calling from beyond. They cannot unhear it.`);
                    }
                } else if (roll < 0.40) {
                    // Vision
                    state.addLog('THRESHOLD: For a moment, you see it. THE STRUCTURE. It sees you back.');
                    state._structureVision = true;
                }
            },
            onScan: null,
            onDeepScan: null,
            onSectorEnter: function(state, planets) {
                // Add THE STRUCTURE as a special POI
                const structure = {
                    id: 'THE_STRUCTURE',
                    name: 'THE STRUCTURE',
                    type: 'STRUCTURE',
                    isStructure: true,
                    ghost: false,
                    fuelCost: 30, // Significant investment
                    gravity: '???',
                    temperature: '???',
                    atmosphere: 'UNKNOWN',
                    resources: { metals: 0, energy: 0 },
                    dangerLevel: 0,
                    tags: ['STRUCTURE', 'ENDGAME'],
                    metrics: { hasLife: false, hasTech: true },
                    desc: 'It is not a planet. It is not a station. It is THE STRUCTURE. It has always been here. Waiting.',
                    mapData: {
                        x: 50,  // Center of the map
                        y: 50
                    }
                };
                planets.push(structure);

                // Add dramatic log entries
                if (state) {
                    state.addLog('===================================');
                    state.addLog('SECTOR 6: THE THRESHOLD');
                    state.addLog('===================================');
                    state.addLog('You have traveled further than any human vessel.');
                    state.addLog('');
                    state.addLog('And then you see it.');
                    state.addLog('');
                    state.addLog('THE STRUCTURE.');
                    state.addLog('');
                    state.addLog('It defies description. It defies physics. It defies sanity.');
                    state.addLog('But it is there. And it is waiting for you.');
                }
            },
            onPlanetGenerate: null
        }
    }
};
