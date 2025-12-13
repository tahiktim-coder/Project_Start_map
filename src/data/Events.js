const EVENTS = [
    {
        id: 'DERELICT',
        trigger: (planet) => planet.tags && (planet.tags.includes('ANCIENT_RUINS') || planet.tags.includes('ALIEN_SIGNALS')),
        title: "DERELICT SIGNAL",
        desc: "The EVA team has located the source of the signal: A crashed vessel of unknown origin. Hull breach imminent.",
        choices: [
            { text: "Salvage Exterior (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Breach Hull (Risky)", riskMod: 30, reward: { type: 'ITEM', tags: ['TECH'] } }
        ]
    },
    {
        id: 'BIO_HORROR',
        trigger: (planet) => planet.type === 'VITAL' || (planet.tags && planet.tags.includes('VITAL_FLORA')),
        title: "BIOLOGICAL ANOMALY",
        desc: "The detected lifeform is immense... and it's moving towards the landing team.",
        choices: [
            { text: "Defensive Sample (Safe)", riskMod: 10, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Capture Specimen (Very Risky)", riskMod: 50, reward: { type: 'ITEM', tags: ['BIO'] } }
        ]
    },
    {
        id: 'MINERAL_VEIN',
        trigger: (planet) => ['ROCKY', 'DESERT', 'VOLCANIC'].includes(planet.type),
        title: "RICH VEIN DETECTED",
        desc: "Sensors indicate a high-density mineral pocket in a precarious canyon ridge.",
        choices: [
            { text: "Surface Extraction (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Deep Core Drill (Risky)", riskMod: 25, reward: { type: 'ITEM', tags: ['GEO'] } }
        ]
    },
    {
        id: 'SOLAR_FLARE',
        trigger: (planet) => planet.metrics && planet.metrics.temp > 100,
        title: "SOLAR FLARE IMMINENT",
        desc: "The star is unstable. Radiation levels are spiking dangerously high.",
        choices: [
            { text: "Shielded Harvest (Safe)", riskMod: 10, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Expose Collections (Very Risky)", riskMod: 40, reward: { type: 'ITEM', tags: ['ENERGY'] } }
        ]
    },
    {
        id: 'GHOST_SHIP',
        trigger: (planet) => Math.random() < 0.3, // 30% chance anywhere
        title: "UNKOWN VESSEL",
        desc: "A ship with no transponder code is drifting in high orbit. No life signs.",
        choices: [
            { text: "Hail & Ignore (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Boarding Party (Extreme)", riskMod: 60, reward: { type: 'ITEM', tags: ['TECH', 'LORE'] } }
        ]
    },
    {
        id: 'CRYSTAL_SPIRE',
        trigger: (planet) => ['ICE_WORLD', 'ROCKY'].includes(planet.type),
        title: "CRYSTALLINE SPIRE",
        desc: "A massive singing crystal formation protrudes from the ice.",
        choices: [
            { text: "Acoustic Scan (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Extract Core (Risky)", riskMod: 25, reward: { type: 'ITEM', tags: ['GEO'] } }
        ]
    },
    {
        id: 'DISTRESS_BEACON', // Fallback NEEDS TO BE LAST
        trigger: () => true,
        title: "DISTRESS BEACON",
        desc: "A faint repeating signal is coming from a debris field.",
        choices: [
            { text: "Scan & Leave (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Investigate Debris (Risky)", riskMod: 20, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }
        ]
    }
];
