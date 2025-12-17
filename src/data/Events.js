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
        id: 'TIME_DILATION',
        trigger: (planet) => planet.metrics && planet.metrics.gravity > 1.5,
        title: "TEMPORAL ANOMALY",
        desc: "The landing team reports chronometer desync. 1 hour on surface equals 1 day in orbit.",
        choices: [
            { text: "Abort Mission (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Collect 'Aged' Samples (Risky)", riskMod: 35, reward: { type: 'ITEM', tags: ['GEO', 'LORE'] } }
        ]
    },
    {
        id: 'MIRAGE_VISION',
        trigger: (planet) => ['DESERT', 'OCEANIC'].includes(planet.type),
        title: "THE MIRAGE",
        desc: "Crew reports seeing massive Earth-like cities on the horizon. Sensors show nothing.",
        choices: [
            { text: "Trust Sensors (Safe)", riskMod: 5, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Send Walk Team (Psych Risk)", riskMod: 45, reward: { type: 'ITEM', tags: ['LORE'] } }
        ]
    },
    {
        id: 'TECTONIC_SHIFT',
        trigger: (planet) => ['VOLCANIC', 'ROCKY'].includes(planet.type) && planet.dangerLevel > 1,
        title: "PLANETARY QUAKE",
        desc: "The ground beneath the landing zone is splitting apart!",
        choices: [
            { text: "Emergency Takeoff (Lose Fuel)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Stabilize & Mine (Very Risky)", riskMod: 50, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }
        ]
    },
    {
        id: 'HIVE_MIND',
        trigger: (planet) => planet.metrics && planet.metrics.hasLife && planet.type === 'VITAL',
        title: "CHORUS OF SONGS",
        desc: "The plants are... singing in unison. It is overwhelming the comms channels.",
        choices: [
            { text: "Burn & Harvest (Hostile)", riskMod: 20, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Attempt Communication (Diplomatic)", riskMod: 40, reward: { type: 'ITEM', tags: ['BIO'] } }
        ]
    },
    {
        id: 'CRYOSLEEP_POD',
        trigger: (planet) => planet.type === 'ICE_WORLD' && planet.metrics.hasTech,
        title: "ANCIENT POD",
        desc: "A functioning cryosleep pod found in the ice. Occupant status: UNKNOWN.",
        choices: [
            { text: "Salvage Parts (Safe)", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Thaw Occupant (Extreme Risk)", riskMod: 60, reward: { type: 'ITEM', tags: ['LORE', 'TECH'] } }
        ]
    },
    {
        id: 'ROGUE_AI',
        trigger: (planet) => planet.tags && planet.tags.includes('ALIEN_SIGNALS'),
        title: "ROGUE SATELLITE",
        desc: "An orbiting defense platform has locked onto the shuttle.",
        choices: [
            { text: "Evasive Maneuvers (Mod Risk)", riskMod: 20, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Hack Signal (Tech Risk)", riskMod: 40, reward: { type: 'ITEM', tags: ['TECH'] } }
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
    },
    {
        id: 'MECHA_SALVAGE',
        trigger: (planet) => planet.type === 'MECHA',
        title: "ANCIENT FACTORY",
        desc: "A massive automated factory is still running on standby power. The security grid is active.",
        choices: [
            { text: "Scavenge Perimeter (Safe)", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Hack Core (Tech Risk)", riskMod: 60, reward: { type: 'ITEM', tags: ['TECH', 'WEAPON'] } }
        ]
    },
    {
        id: 'BIO_SAMPLES',
        trigger: (planet) => planet.type === 'BIO_MASS',
        title: "SPORE STORM",
        desc: "The air is filling with glowing, semi-sentient spores. They seem attracted to heat.",
        choices: [
            { text: "Purge Vents (Energy Cost)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Harvest Spores (Bio Risk)", riskMod: 50, reward: { type: 'ITEM', tags: ['BIO', 'CURE'] } }
        ]
    },
    {
        id: 'VOID_WHISPERS',
        trigger: (planet) => ['SHATTERED', 'ROGUE'].includes(planet.type),
        title: "VOID WHISPERS",
        desc: "The silence here is unnatural. Crew members report hearing their own names spoken in the static.",
        choices: [
            { text: "Enforce Rest (Morale Loss)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Analyze Static (Psych Risk)", riskMod: 40, reward: { type: 'ITEM', tags: ['LORE'] } }
        ]
    },
    {
        id: 'PRISM_SONG',
        trigger: (planet) => planet.type === 'CRYSTALLINE',
        title: "CRYSTAL RESONANCE",
        desc: "The crystals are vibrating at a frequency that can shatter glass... and bone.",
        choices: [
            { text: "Dampen Hull (Energy Cost)", riskMod: 10, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Record Song (Risky)", riskMod: 30, reward: { type: 'ITEM', tags: ['ARTIFACT'] } }
        ]
    }
];
