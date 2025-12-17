// Planet Types & Data Definitions
const PLANET_TYPES = ['ROCKY', 'GAS_GIANT', 'ICE_WORLD', 'OCEANIC', 'DESERT', 'VOLCANIC', 'TOXIC', 'VITAL', 'BIO_MASS', 'MECHA', 'SHATTERED', 'TERRAFORMED', 'CRYSTALLINE', 'ROGUE'];

const ATMOSPHERES = {
    BREATHABLE: { type: 'BREATHABLE', chance: 0.1 },
    THIN: { type: 'THIN', chance: 0.2 },
    TOXIC: { type: 'TOXIC', chance: 0.3 },
    CORROSIVE: { type: 'CORROSIVE', chance: 0.1 },
    HIGH_PRESSURE: { type: 'HIGH_PRESSURE', chance: 0.2 },
    NONE: { type: 'NONE', chance: 0.1 }
};

const PLANET_DATA = {
    ROCKY: { scanCost: 2, hazardChance: 0.3, desc: "Barren terrestrial world. Good source of metals." },
    GAS_GIANT: { scanCost: 3, hazardChance: 0.8, desc: "Massive ball of hydrogen/helium. High gravity risk." },
    ICE_WORLD: { scanCost: 2, hazardChance: 0.5, desc: "Frozen surface. Potential cryo-flora." },
    OCEANIC: { scanCost: 2, hazardChance: 0.4, desc: "Global liquid water ocean. Landing difficult." },
    DESERT: { scanCost: 2, hazardChance: 0.6, desc: "Scorched surface. Extreme heat alerts." },
    VOLCANIC: { scanCost: 3, hazardChance: 0.9, desc: "Active tectonic activity. Magma flows detected." },
    TOXIC: { scanCost: 3, hazardChance: 0.7, desc: "Atmosphere composed of lethal compounds." },
    VITAL: { scanCost: 2, hazardChance: 0.1, desc: "Rare biosphere. Detecting life signs." },
    BIO_MASS: { scanCost: 4, hazardChance: 0.9, desc: "The entire planet is a single living organism. High biological signal." },
    MECHA: { scanCost: 3, hazardChance: 0.7, desc: "Ancient battlefield covered in dormant war machines." },
    SHATTERED: { scanCost: 5, hazardChance: 0.95, desc: "Planetary core exposed. Extreme gravitational anomalies." },
    TERRAFORMED: { scanCost: 1, hazardChance: 0.0, desc: "Artificially perfect conditions. No natural weather patterns detected." },
    CRYSTALLINE: { scanCost: 3, hazardChance: 0.4, desc: "Surface covered in massive resonating crystal structures." },
    ROGUE: { scanCost: 4, hazardChance: 0.6, desc: "A dark world drifting without a star. Deep freeze readings." }
};

const SUFFIXES = ['Prime', 'Major', 'Minor', 'IV', 'X', 'Alpha', 'Proxima', 'Secundus'];
const NAMES = ['Helios', 'Kryos', 'Titan', 'Aea', 'Zephyr', 'Chronos', 'Nyx', 'Erebus', 'Tartarus', 'Atlas', 'Hyperion', 'Phoebe'];

class PlanetGenerator {
    static generateSector(level) {
        const count = Math.floor(Math.random() * 3) + 3; // 3 to 5 planets
        const sector = [];

        for (let i = 0; i < count; i++) {
            sector.push(this.generatePlanet(level));
        }
        return sector;
    }

    static generatePlanet(level) {
        const type = PLANET_TYPES[Math.floor(Math.random() * PLANET_TYPES.length)];
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
            default: // ROCKY
                gravityBase = 0.5 + Math.random() * 1.0;
                tempMin = -100; tempMax = 50;
        }

        const gravity = gravityBase.toFixed(2);
        const tempBase = Math.floor(tempMin + Math.random() * (tempMax - tempMin));
        const conditions = this.generateConditions(type, level);

        return {
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
                hasLife: type === 'VITAL' || (conditions.tags && conditions.tags.includes('VITAL_FLORA')),
                hasTech: conditions.tags && (conditions.tags.includes('ALIEN_SIGNALS') || conditions.tags.includes('ANCIENT_RUINS'))
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
    }

    static generateConditions(type, level) {
        let atmosphere = 'UNKNOWN';
        if (['GAS_GIANT', 'TOXIC', 'MECHA'].includes(type)) atmosphere = 'TOXIC';
        else if (type === 'ROCKY') atmosphere = Math.random() > 0.5 ? 'THIN' : 'NONE';
        else if (['VITAL', 'TERRAFORMED'].includes(type)) atmosphere = 'BREATHABLE';
        else if (type === 'BIO_MASS') atmosphere = 'HIGH_PRESSURE';
        else if (type === 'SHATTERED') atmosphere = 'NONE';
        else if (type === 'ROGUE') atmosphere = 'THIN';
        else atmosphere = Object.keys(ATMOSPHERES)[Math.floor(Math.random() * 6)];

        const tags = [];
        if (level > 2) tags.push('HIGH_RISK');
        if (Math.random() > 0.8) tags.push('ANCIENT_RUINS');
        if (Math.random() > 0.8) tags.push('ALIEN_SIGNALS');

        return { atmosphere, tags };
    }

    static generateResources(type) {
        let metalBase = Math.floor(Math.random() * 40) + 10; // 10-50 Base
        let energyBase = Math.floor(Math.random() * 40) + 10; // 10-50 Base

        // Type Modifiers (Consistency Check)
        if (['ROCKY', 'VOLCANIC', 'DESERT', 'MECHA', 'SHATTERED'].includes(type)) {
            metalBase += 40; // Auto-Rich (50-90)
        } else if (['GAS_GIANT', 'ICE_WORLD', 'OCEANIC', 'BIO_MASS'].includes(type)) {
            metalBase -= 10; // Auto-Poor (0-40)
        }

        if (['GAS_GIANT', 'VOLCANIC', 'TOXIC', 'SHATTERED', 'CRYSTALLINE'].includes(type)) {
            energyBase += 40; // Auto-Rich (50-90)
        } else if (['ROCKY', 'VITAL', 'MECHA'].includes(type)) {
            energyBase -= 10; // Auto-Poor (0-40)
        }

        // Clamp values 0-100
        return {
            metals: Math.max(0, Math.min(100, metalBase)),
            energy: Math.max(0, Math.min(100, energyBase)),
            anomalies: Math.random() > 0.7 ? 1 : 0
        };
    }
}
