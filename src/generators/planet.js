
const PLANET_TYPES = ['ROCKY', 'GAS_GIANT', 'ICE_WORLD', 'OCEANIC', 'DESERT', 'VOLCANIC', 'TOXIC', 'VITAL'];

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
    VITAL: { scanCost: 2, hazardChance: 0.1, desc: "Rare biosphere. Detecting life signs." }
};

const SUFFIXES = ['Prime', 'Major', 'Minor', 'IV', 'X', 'Alpha', 'Proxima', 'Secundus'];
const NAMES = ['Helios', 'Kryos', 'Titan', 'Aea', 'Zephyr', 'Chronos', 'Nyx', 'Erebus', 'Tartarus', 'Atlas', 'Hyperion', 'Phoebe'];

export class PlanetGenerator {
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

        // Physics Generation
        const gravity = (0.5 + Math.random() * 2.0).toFixed(2); // 0.50G to 2.50G
        const tempBase = Math.floor(Math.random() * 500) - 200; // -200 to 300
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
            // Gameplay
            fuelCost: 10 + Math.floor(Math.random() * 10),
            dangerLevel: Math.floor(Math.random() * level) + (PLANET_DATA[type].hazardChance > 0.6 ? 1 : 0),
            desc: PLANET_DATA[type].desc,
            // Rewards
            resources: {
                metals: Math.floor(Math.random() * 80) + 10,
                energy: Math.floor(Math.random() * 50) + 10,
                anomalies: Math.random() > 0.7 ? 1 : 0
            },
            // State
            scanned: false,
            visited: false
        };
    }

    static generateConditions(type, level) {
        // Simple weighted atmosphere based on type
        let atmosphere = 'UNKNOWN';
        if (['GAS_GIANT', 'TOXIC'].includes(type)) atmosphere = 'TOXIC';
        else if (type === 'ROCKY') atmosphere = Math.random() > 0.5 ? 'THIN' : 'NONE';
        else if (type === 'VITAL') atmosphere = 'BREATHABLE';
        else atmosphere = Object.keys(ATMOSPHERES)[Math.floor(Math.random() * 6)];

        // Tags
        const tags = [];
        if (level > 2) tags.push('HIGH_RISK');
        if (Math.random() > 0.8) tags.push('ANCIENT_RUINS');
        if (Math.random() > 0.8) tags.push('ALIEN_SIGNALS');

        return { atmosphere, tags };
    }
}
