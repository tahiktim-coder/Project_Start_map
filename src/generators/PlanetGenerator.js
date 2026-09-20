// Planet Types & Data Definitions
const PLANET_TYPES = [
    // Standard types
    'ROCKY', 'GAS_GIANT', 'ICE_WORLD', 'OCEANIC', 'DESERT', 'VOLCANIC', 'TOXIC', 'VITAL',
    // Exotic types
    'BIO_MASS', 'MECHA', 'SHATTERED', 'TERRAFORMED', 'CRYSTALLINE', 'ROGUE', 'TIDALLY_LOCKED',
    'HOLLOW', 'SYMBIOTE_WORLD', 'MIRROR', 'GRAVEYARD', 'SINGING',
    // New types
    'STORM_WORLD', 'FUNGAL', 'TOMB_WORLD', 'EDEN', 'MACHINE_WORLD', 'FROZEN_OCEAN',
    'SULFUR', 'CARBON', 'RADIATION_BELT', 'GHOST_WORLD'
];

const ATMOSPHERES = {
    BREATHABLE: { type: 'BREATHABLE', chance: 0.1 },
    THIN: { type: 'THIN', chance: 0.2 },
    TOXIC: { type: 'TOXIC', chance: 0.3 },
    CORROSIVE: { type: 'CORROSIVE', chance: 0.1 },
    HIGH_PRESSURE: { type: 'HIGH_PRESSURE', chance: 0.2 },
    NONE: { type: 'NONE', chance: 0.1 }
};

const PLANET_DATA = {
    // Standard types
    ROCKY: { scanCost: 2, hazardChance: 0.3, desc: "Barren terrestrial world. Good source of metals." },
    GAS_GIANT: { scanCost: 3, hazardChance: 0.8, desc: "Massive ball of hydrogen/helium. High gravity risk." },
    ICE_WORLD: { scanCost: 2, hazardChance: 0.5, desc: "Frozen surface. Potential cryo-flora." },
    OCEANIC: { scanCost: 2, hazardChance: 0.4, desc: "Global liquid water ocean. Landing difficult." },
    DESERT: { scanCost: 2, hazardChance: 0.6, desc: "Scorched surface. Extreme heat alerts." },
    VOLCANIC: { scanCost: 3, hazardChance: 0.9, desc: "Active tectonic activity. Magma flows detected." },
    TOXIC: { scanCost: 3, hazardChance: 0.7, desc: "Atmosphere composed of lethal compounds." },
    VITAL: { scanCost: 2, hazardChance: 0.1, desc: "Rare biosphere. Detecting life signs." },
    // Exotic types
    BIO_MASS: { scanCost: 4, hazardChance: 0.9, desc: "The entire planet is a single living organism. High biological signal." },
    MECHA: { scanCost: 3, hazardChance: 0.7, desc: "Ancient battlefield covered in dormant war machines." },
    SHATTERED: { scanCost: 5, hazardChance: 0.95, desc: "Planetary core exposed. Extreme gravitational anomalies." },
    TERRAFORMED: { scanCost: 1, hazardChance: 0.0, desc: "Artificially perfect conditions. No natural weather patterns detected." },
    CRYSTALLINE: { scanCost: 3, hazardChance: 0.4, desc: "Surface covered in massive resonating crystal structures." },
    ROGUE: { scanCost: 4, hazardChance: 0.6, desc: "A dark world drifting without a star. Deep freeze readings." },
    TIDALLY_LOCKED: { scanCost: 3, hazardChance: 0.7, desc: "One hemisphere in eternal flame, the other in permanent darkness. Habitable twilight band detected." },
    HOLLOW: { scanCost: 5, hazardChance: 0.8, desc: "Mass readings inconsistent. Interior cavity detected. Something is inside." },
    SYMBIOTE_WORLD: { scanCost: 2, hazardChance: 0.1, desc: "The biosphere is responding to our presence. It seems... welcoming." },
    MIRROR: { scanCost: 4, hazardChance: 0.5, desc: "Surface is perfectly reflective. Scans returning our own vessel's signature." },
    GRAVEYARD: { scanCost: 3, hazardChance: 0.85, desc: "Artificial planetoid. Compressed wreckage of millions of vessels. Massive salvage potential." },
    SINGING: { scanCost: 3, hazardChance: 0.2, desc: "Emitting a harmonic frequency across all bands. Crew reports involuntary calm." },
    // New exotic types
    STORM_WORLD: { scanCost: 4, hazardChance: 0.85, desc: "Perpetual hypercane covers the entire surface. Wind speeds exceed 800 km/h. Lightning discharges constantly." },
    FUNGAL: { scanCost: 3, hazardChance: 0.5, desc: "Covered in continent-spanning fungal networks. Spore density extreme. The mycelium appears to communicate." },
    TOMB_WORLD: { scanCost: 3, hazardChance: 0.4, desc: "Once thriving, now dead. Ruins of a civilization stretch horizon to horizon. Whatever killed them left no trace." },
    EDEN: { scanCost: 2, hazardChance: 0.05, desc: "Paradise conditions. Too perfect. The ecosystem seems designed for human habitation." },
    MACHINE_WORLD: { scanCost: 4, hazardChance: 0.7, desc: "The entire surface is artificial. Massive data centers hum beneath metal continents. Someone built this." },
    FROZEN_OCEAN: { scanCost: 3, hazardChance: 0.5, desc: "A world-ocean frozen solid to the core. Ancient waves preserved in ice. Something swims beneath." },
    SULFUR: { scanCost: 3, hazardChance: 0.75, desc: "Yellow hell. Sulfuric lakes, sulfur volcanoes, sulfuric atmosphere. Corrosive to everything." },
    CARBON: { scanCost: 3, hazardChance: 0.4, desc: "Graphite plains and diamond mountains. The pressure creates gems the size of houses. Highly valuable." },
    RADIATION_BELT: { scanCost: 4, hazardChance: 0.9, desc: "Bathed in lethal radiation from its dying star. Extreme energy readings but deadly exposure risks." },
    GHOST_WORLD: { scanCost: 5, hazardChance: 0.3, desc: "Sensors glitch constantly. The planet phases in and out of our reality. Navigation data contradicts itself." }
};

const SUFFIXES = ['Prime', 'Major', 'Minor', 'IV', 'X', 'Alpha', 'Proxima', 'Secundus'];
const NAMES = ['Helios', 'Kryos', 'Titan', 'Aea', 'Zephyr', 'Chronos', 'Nyx', 'Erebus', 'Tartarus', 'Atlas', 'Hyperion', 'Phoebe'];

class PlanetGenerator {
    static generateSector(level) {
        const config = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[level] : null;

        // Planet count from config or default 3-5
        let min = 3, max = 5;
        if (config && config.planetCount) {
            min = config.planetCount[0];
            max = config.planetCount[1];
        }
        const count = Math.floor(Math.random() * (max - min + 1)) + min;
        const sector = [];

        // Generate normal planets
        // Re-roll duplicates: heavy type bias (e.g. S1) used to produce three identical DESERT worlds
        const MAX_TYPE_REROLLS = 8;
        for (let i = 0; i < count; i++) {
            let planet = this.generatePlanet(level, config);
            for (let tries = 0; tries < MAX_TYPE_REROLLS && sector.some(p => p.type === planet.type); tries++) {
                planet = this.generatePlanet(level, config);
            }
            sector.push(planet);
        }

        // Guaranteed types: ensure at least one of each exists
        if (config && config.guaranteedTypes) {
            config.guaranteedTypes.forEach(gType => {
                const hasType = sector.some(p => p.type === gType);
                if (!hasType && sector.length > 0) {
                    // Replace the last non-guaranteed planet
                    const replaceIdx = sector.length - 1;
                    sector[replaceIdx] = this.generatePlanet(level, config, gType);
                }
            });
        }

        // Sector enter hazard (e.g., S3 ghost planets)
        if (config && config.hazard && config.hazard.onSectorEnter) {
            config.hazard.onSectorEnter(null, sector); // state passed from bundle.js
        }

        // Space Stations - chance to add 1 station per sector
        // Higher chance in later sectors (more infrastructure before collapse)
        const stationChance = 0.15 + (level * 0.05); // 20% S1, 25% S2, 30% S3, etc.
        if (Math.random() < stationChance) {
            sector.push(this.generateStation(level));
        }

        // Asteroid Fields - max 1 per sector, only sometimes
        const asteroidChance = 0.25 - (level * 0.03); // 22% S1, 19% S2, etc.
        if (Math.random() < asteroidChance && typeof generateAsteroidField !== 'undefined') {
            sector.push(generateAsteroidField(level));
        }

        // Assign non-overlapping positions to all bodies
        this.assignNonOverlappingPositions(sector);

        return sector;
    }

    /**
     * Assign non-overlapping positions to all sector bodies
     * Uses a simple grid-based approach with some randomization
     * Skips special bodies like THE STRUCTURE that have fixed positions
     */
    static assignNonOverlappingPositions(sector) {
        const minDistance = 15; // Minimum distance between planets (percentage)
        const positions = [];

        // First, collect positions of fixed bodies (like THE STRUCTURE)
        sector.forEach(body => {
            if (body.isStructure || body._isWrongPlace) {
                // Keep fixed position, add to collision list
                if (body.mapData) {
                    positions.push({ x: body.mapData.x, y: body.mapData.y });
                }
            }
        });

        // Then assign positions to non-fixed bodies
        sector.forEach((body, index) => {
            // Skip bodies with fixed positions
            if (body.isStructure || body._isWrongPlace) {
                return;
            }

            let x, y;
            let attempts = 0;
            const maxAttempts = 50;

            do {
                // Generate random position
                x = Math.floor(Math.random() * 70) + 15; // 15% - 85%
                y = Math.floor(Math.random() * 70) + 15;
                attempts++;

                // Check distance from all existing positions
                const tooClose = positions.some(pos => {
                    const dx = pos.x - x;
                    const dy = pos.y - y;
                    return Math.sqrt(dx * dx + dy * dy) < minDistance;
                });

                if (!tooClose || attempts >= maxAttempts) {
                    break;
                }
            } while (true);

            // Assign position
            if (body.mapData) {
                body.mapData.x = x;
                body.mapData.y = y;
            } else {
                body.mapData = { x, y };
            }
            positions.push({ x, y });
        });
    }

    /**
     * Generate a space station node for the sector map
     */
    static generateStation(level) {
        const stationNames = [
            'Orbital-7', 'Waypoint Kappa', 'Deep Anchor', 'The Relay',
            'Station Erebus', 'Outpost Terminus', 'The Hub', 'Platform Zeta',
            'Cargo Ring Alpha', 'Research Station Omega', 'Refinery-12',
            'Mining Platform 6', 'Colony Support Station', 'The Watchtower'
        ];

        const name = stationNames[Math.floor(Math.random() * stationNames.length)];

        return {
            id: 'station_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: name,
            type: 'STATION',
            isStation: true,
            desc: 'Abandoned orbital station. Power readings intermittent. Worth investigating.',
            fuelCost: 4 + Math.floor(Math.random() * 4), // 4-7 energy
            scanned: false,
            remoteScanned: false,
            tags: ['STATION'],
            dangerLevel: 1 + Math.floor(level / 2), // Scales with sector
            resources: {
                metals: 30 + Math.floor(Math.random() * 40), // 30-70
                energy: 20 + Math.floor(Math.random() * 30)  // 20-50
            },
            metrics: {
                hasLife: false,
                hasTech: true,
                gravity: 0,
                temp: 0
            },
            atmosphere: 'NONE',
            mapData: {
                x: 15 + Math.random() * 70,
                y: 15 + Math.random() * 70
            }
        };
    }

    static generatePlanet(level, config, forceType) {
        // Type selection: forced > biased > restricted > fully random
        let type;
        if (forceType) {
            type = forceType;
        } else if (config && config.typeBias) {
            type = this._selectBiasedType(config);
        } else if (config && config.allowedTypes) {
            type = config.allowedTypes[Math.floor(Math.random() * config.allowedTypes.length)];
        } else {
            type = PLANET_TYPES[Math.floor(Math.random() * PLANET_TYPES.length)];
        }
        const nameBase = NAMES[Math.floor(Math.random() * NAMES.length)];
        const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
        const digit = Math.floor(Math.random() * 99);

        // Physics Generation (Context-Aware)
        let gravityBase = 1.0;
        let tempMin = -50, tempMax = 50;

        switch (type) {
            case 'GAS_GIANT':
                gravityBase = 2.0 + Math.random() * 6.0; // 2G - 8G
                tempMin = -150; tempMax = -50; // Cold gas giants (usually far out)
                break;
            case 'ICE_WORLD':
                gravityBase = 0.5 + Math.random() * 1.0;
                tempMin = -200; tempMax = -20;
                break;
            case 'DESERT':
                gravityBase = 0.8 + Math.random() * 0.8;
                tempMin = 40; tempMax = 120;
                break;
            case 'VOLCANIC':
                gravityBase = 0.8 + Math.random() * 1.2;
                tempMin = 100; tempMax = 500; // Extreme heat
                break;
            case 'OCEANIC':
                gravityBase = 0.9 + Math.random() * 0.5;
                tempMin = 10; tempMax = 40;
                break;
            case 'TOXIC':
                gravityBase = 0.8 + Math.random() * 1.2;
                tempMin = -50; tempMax = 150; // Variable
                break;
            case 'VITAL':
                gravityBase = 0.9 + Math.random() * 0.3; // Earth-like
                tempMin = 15; tempMax = 35; // Perfect habitable zone
                break;
            case 'BIO_MASS':
                gravityBase = 1.0 + Math.random() * 0.5;
                tempMin = 30; tempMax = 60; // Hot/Humid
                break;
            case 'MECHA':
                gravityBase = 1.2 + Math.random() * 0.5; // Heavy with metal
                tempMin = -20; tempMax = 20; // Cold steel
                break;
            case 'SHATTERED':
                gravityBase = 0.5 + Math.random() * 2.0; // Chaotic gravity
                tempMin = -100; tempMax = 500; // Extreme variance (exposed core)
                break;
            case 'TERRAFORMED':
                gravityBase = 1.0; // Perfect
                tempMin = 22; tempMax = 24; // Artificial thermostat
                break;
            case 'CRYSTALLINE':
                gravityBase = 0.8;
                tempMin = -50; tempMax = 10;
                break;
            case 'ROGUE':
                gravityBase = 1.5; // Dense core
                tempMin = -250; tempMax = -200; // Absolute zero proximity
                break;
            case 'TIDALLY_LOCKED':
                gravityBase = 0.9 + Math.random() * 0.4;
                tempMin = -180; tempMax = 400; // Extreme contrast
                break;
            case 'HOLLOW':
                gravityBase = 0.3 + Math.random() * 0.3; // Anomalously low
                tempMin = 20; tempMax = 40; // Strangely stable
                break;
            case 'SYMBIOTE_WORLD':
                gravityBase = 0.9 + Math.random() * 0.2; // Comfortable
                tempMin = 18; tempMax = 28; // Perfect
                break;
            case 'MIRROR':
                gravityBase = 1.0 + Math.random() * 0.5;
                tempMin = -10; tempMax = 10; // Eerily neutral
                break;
            case 'GRAVEYARD':
                gravityBase = 1.5 + Math.random() * 1.0; // Heavy compressed metal
                tempMin = -80; tempMax = -20; // Cold dead metal
                break;
            case 'SINGING':
                gravityBase = 0.7 + Math.random() * 0.3;
                tempMin = 10; tempMax = 30; // Pleasant
                break;
            // New planet types
            case 'STORM_WORLD':
                gravityBase = 1.2 + Math.random() * 0.8;
                tempMin = -40; tempMax = 60; // Variable from storm activity
                break;
            case 'FUNGAL':
                gravityBase = 0.8 + Math.random() * 0.4;
                tempMin = 15; tempMax = 35; // Warm and humid
                break;
            case 'TOMB_WORLD':
                gravityBase = 0.9 + Math.random() * 0.3;
                tempMin = -20; tempMax = 30; // Varies by latitude
                break;
            case 'EDEN':
                gravityBase = 0.95 + Math.random() * 0.1; // Near-perfect
                tempMin = 20; tempMax = 26; // Paradise
                break;
            case 'MACHINE_WORLD':
                gravityBase = 1.0 + Math.random() * 0.5;
                tempMin = 5; tempMax = 25; // Climate controlled
                break;
            case 'FROZEN_OCEAN':
                gravityBase = 0.9 + Math.random() * 0.3;
                tempMin = -180; tempMax = -50; // Extremely cold
                break;
            case 'SULFUR':
                gravityBase = 0.7 + Math.random() * 0.4;
                tempMin = 80; tempMax = 300; // Hot and corrosive
                break;
            case 'CARBON':
                gravityBase = 1.5 + Math.random() * 1.0; // Dense
                tempMin = -30; tempMax = 150; // Variable
                break;
            case 'RADIATION_BELT':
                gravityBase = 0.8 + Math.random() * 0.5;
                tempMin = -100; tempMax = 200; // Extreme radiation
                break;
            case 'GHOST_WORLD':
                gravityBase = 0.5 + Math.random() * 1.5; // Fluctuates
                tempMin = -50; tempMax = 50; // Normal but unstable
                break;
            default: // ROCKY
                gravityBase = 0.5 + Math.random() * 1.0;
                tempMin = -100; tempMax = 50;
        }

        const gravity = gravityBase.toFixed(2);
        const tempBase = Math.floor(tempMin + Math.random() * (tempMax - tempMin));
        const conditions = this.generateConditions(type, level, config);

        const planet = {
            id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `${nameBase}-${digit} ${suffix}`,
            type: type,
            // Stats
            gravity: `${gravity}G`,
            temperature: `${tempBase}°C`,
            atmosphere: conditions.atmosphere,
            tags: conditions.tags,
            // Logic metrics for game scenarios (Ending calculations/Events)
            metrics: {
                gravity: parseFloat(gravity),
                temp: tempBase,
                hasLife: ['VITAL', 'BIO_MASS', 'SYMBIOTE_WORLD', 'SINGING', 'FUNGAL', 'EDEN', 'FROZEN_OCEAN'].includes(type) || (conditions.tags && conditions.tags.includes('VITAL_FLORA')),
                hasTech: ['MECHA', 'MIRROR', 'GRAVEYARD', 'TOMB_WORLD', 'MACHINE_WORLD'].includes(type) || (conditions.tags && (conditions.tags.includes('ALIEN_SIGNALS') || conditions.tags.includes('ANCIENT_RUINS')))
            },
            // Map Data
            mapData: {
                x: Math.floor(Math.random() * 80) + 10, // 10% - 90%
                y: Math.floor(Math.random() * 80) + 10
            },
            // Gameplay
            fuelCost: 10 + Math.floor(Math.random() * 10),
            dangerLevel: Math.floor(Math.random() * level) + (PLANET_DATA[type].hazardChance > 0.6 ? 1 : 0),
            desc: PLANET_DATA[type].desc,
            // Rewards
            resources: this.generateResources(type),
            // State
            scanned: false,
            remoteScanned: false,
            revealedStats: [],
            visited: false
        };

        // Apply sector hazard onPlanetGenerate hook (e.g., S4 hidden PREDATORY)
        if (config && config.hazard && config.hazard.onPlanetGenerate) {
            config.hazard.onPlanetGenerate(planet);
        }

        return planet;
    }

    static generateConditions(type, level, config) {
        let atmosphere = 'UNKNOWN';
        if (['GAS_GIANT', 'TOXIC', 'MECHA'].includes(type)) atmosphere = 'TOXIC';
        else if (type === 'ROCKY') atmosphere = Math.random() > 0.5 ? 'THIN' : 'NONE';
        else if (['VITAL', 'TERRAFORMED', 'SYMBIOTE_WORLD', 'SINGING', 'EDEN'].includes(type)) atmosphere = 'BREATHABLE';
        else if (['BIO_MASS', 'FUNGAL'].includes(type)) atmosphere = 'HIGH_PRESSURE';
        else if (['SHATTERED', 'GRAVEYARD', 'TOMB_WORLD', 'RADIATION_BELT'].includes(type)) atmosphere = 'NONE';
        else if (['ROGUE', 'MIRROR', 'FROZEN_OCEAN', 'GHOST_WORLD'].includes(type)) atmosphere = 'THIN';
        else if (['TIDALLY_LOCKED', 'SULFUR'].includes(type)) atmosphere = 'CORROSIVE';
        else if (['HOLLOW', 'STORM_WORLD'].includes(type)) atmosphere = 'HIGH_PRESSURE';
        else if (['MACHINE_WORLD', 'CARBON'].includes(type)) atmosphere = 'TOXIC';
        else atmosphere = Object.keys(ATMOSPHERES)[Math.floor(Math.random() * 6)];

        const tags = [];
        if (level > 2) tags.push('HIGH_RISK');
        if (Math.random() > 0.8) tags.push('ANCIENT_RUINS');
        if (Math.random() > 0.8) tags.push('ALIEN_SIGNALS');

        // Exodus wreckage: use config chance or fallback to legacy logic
        if (type !== 'GAS_GIANT') {
            const exodusChance = config ? (config.exodusWreckChance || 0) :
                (level <= 2 ? 0.30 : (level === 3 ? 0.20 : 0.10));
            if (Math.random() < exodusChance) tags.push('EXODUS_WRECK');
        }

        // Wreckage debris field (new tag — salvage from non-Exodus ships)
        if (type !== 'GAS_GIANT' && config) {
            if (Math.random() < (config.wreckageChance || 0)) {
                tags.push('WRECKAGE');
            }
        }

        // Failed colony ruins (new tag — for colony encounter system)
        if (type !== 'GAS_GIANT' && config) {
            if (Math.random() < (config.failedColonyChance || 0)) {
                tags.push('FAILED_COLONY');
            }
        }

        // Derelict ships (non-Exodus wrecks) - more common in later sectors
        if (type !== 'GAS_GIANT') {
            const derelictChance = config ? (config.derelictChance || 0) :
                (level >= 3 ? 0.20 : (level === 2 ? 0.10 : 0.05));
            if (Math.random() < derelictChance) {
                tags.push('DERELICT');
            }
        }

        // Anomalies (reality distortions) - only in sector 4+ or special cases
        if (level >= 4 || (config && config.anomalyChance)) {
            const anomalyChance = config ? (config.anomalyChance || 0) :
                (level >= 5 ? 0.25 : (level === 4 ? 0.15 : 0));
            if (Math.random() < anomalyChance) {
                tags.push('ANOMALY');
            }
        }

        // Late-game POIs (Sector 4+): Lighthouse, Garden, Grave
        if (level >= 4 && type !== 'GAS_GIANT') {
            // THE LIGHTHOUSE - rare navigation beacon (10% in S4+)
            if (Math.random() < 0.10 && !tags.includes('LIGHTHOUSE')) {
                tags.push('LIGHTHOUSE');
            }
            // THE GARDEN - terraformed biodome (10% in S4+)
            if (Math.random() < 0.10 && !tags.includes('GARDEN') && !tags.includes('LIGHTHOUSE')) {
                tags.push('GARDEN');
            }
        }
        // THE GRAVE - only in Sector 5 (15% chance)
        if (level >= 5 && type !== 'GAS_GIANT') {
            if (Math.random() < 0.15 && !tags.includes('GRAVE') && !tags.includes('LIGHTHOUSE') && !tags.includes('GARDEN')) {
                tags.push('GRAVE');
            }
        }

        return { atmosphere, tags };
    }

    /**
     * Select a planet type using sector bias weights
     * Types in the bias object get multiplied weight; all others get weight 1
     */
    static _selectBiasedType(config) {
        // Build weighted pool: all allowed types (or all types) with bias multipliers
        const pool = config.allowedTypes || PLANET_TYPES;
        const bias = config.typeBias || {};

        const weighted = [];
        pool.forEach(t => {
            const weight = bias[t] || 1;
            for (let i = 0; i < weight; i++) {
                weighted.push(t);
            }
        });

        return weighted[Math.floor(Math.random() * weighted.length)];
    }

    static generateResources(type) {
        let metalBase = Math.floor(Math.random() * 40) + 10; // 10-50 Base
        let energyBase = Math.floor(Math.random() * 40) + 10; // 10-50 Base

        // Type Modifiers (Consistency Check)
        // Metal-rich types
        if (['ROCKY', 'VOLCANIC', 'DESERT', 'MECHA', 'SHATTERED', 'GRAVEYARD', 'CARBON', 'TOMB_WORLD', 'MACHINE_WORLD'].includes(type)) {
            metalBase += 40; // Auto-Rich (50-90)
        } else if (['GAS_GIANT', 'ICE_WORLD', 'OCEANIC', 'BIO_MASS', 'SYMBIOTE_WORLD', 'SINGING', 'FUNGAL', 'EDEN', 'GHOST_WORLD'].includes(type)) {
            metalBase -= 10; // Auto-Poor (0-40)
        } else if (type === 'TIDALLY_LOCKED') {
            metalBase += 20; // Moderate — minerals in the twilight zone
        } else if (type === 'MIRROR') {
            metalBase += 30; // Reflective alloys
        } else if (type === 'SULFUR') {
            metalBase += 25; // Sulfur deposits
        } else if (type === 'FROZEN_OCEAN') {
            metalBase += 15; // Seabed minerals
        }

        // Energy-rich types
        if (['GAS_GIANT', 'VOLCANIC', 'TOXIC', 'SHATTERED', 'CRYSTALLINE', 'SINGING', 'STORM_WORLD', 'RADIATION_BELT'].includes(type)) {
            energyBase += 40; // Auto-Rich (50-90)
        } else if (['ROCKY', 'VITAL', 'MECHA', 'GRAVEYARD', 'TOMB_WORLD', 'FROZEN_OCEAN'].includes(type)) {
            energyBase -= 10; // Auto-Poor (0-40)
        } else if (type === 'HOLLOW') {
            energyBase += 20; // Internal star radiates
        } else if (['SYMBIOTE_WORLD', 'FUNGAL'].includes(type)) {
            energyBase += 30; // Bio-energy
        } else if (type === 'MACHINE_WORLD') {
            energyBase += 35; // Power grid
        } else if (type === 'SULFUR') {
            energyBase += 30; // Geothermal
        } else if (type === 'GHOST_WORLD') {
            energyBase += Math.random() > 0.5 ? 40 : -20; // Unstable
        }

        // Clamp values 0-100
        return {
            metals: Math.max(0, Math.min(100, metalBase)),
            energy: Math.max(0, Math.min(100, energyBase)),
            anomalies: Math.random() > 0.7 ? 1 : 0
        };
    }
}
