// LOOT POOLS: Groupings of items by theme
const LOOT_POOLS = {
    // 0. The Null Result (Dirt, Rocks, Nothing)
    // Weight will be the baseline against which other things compete
    // 0. The Null Result (Now gives Trace Elements)
    // Weight will be the baseline against which other things compete
    NULL_RESULT: [
        { type: 'RESOURCE', val: 'METALS', min: 1, max: 3, weight: 50, log: "Surface Scan: Minimal resources detected. (+2 Salvage)" },
        { type: 'RESOURCE', val: 'ENERGY', min: 1, max: 3, weight: 50, log: "Atmosphere: Trace ions harvested. (+2 Energy)" }
    ],

    // 1. Metals Tiers
    METALS_SCARCE: [
        { type: 'RESOURCE', val: 'METALS', min: 2, max: 5, weight: 20 }
    ],
    METALS_COMMON: [
        { type: 'RESOURCE', val: 'METALS', min: 5, max: 15, weight: 60 }
    ],
    METALS_RICH: [
        { type: 'RESOURCE', val: 'METALS', min: 15, max: 30, weight: 100 },
        { type: 'RESOURCE', val: 'METALS', min: 10, max: 20, weight: 20 } // Extra fallback
    ],

    // 2. Energy Tiers
    ENERGY_SCARCE: [
        { type: 'RESOURCE', val: 'ENERGY', min: 1, max: 5, weight: 20 }
    ],
    ENERGY_COMMON: [
        { type: 'RESOURCE', val: 'ENERGY', min: 10, max: 25, weight: 60 }
    ],
    ENERGY_RICH: [
        { type: 'RESOURCE', val: 'ENERGY', min: 40, max: 80, weight: 100 }
    ],

    // 3. Biological
    BIO_STANDARD: [
        { item: ITEMS.RADIOTROPHIC_FUNGUS, weight: 30 },
        { item: ITEMS.AMBER_SPECIMEN, weight: 10 },
        { item: ITEMS.FUNGUS_CULTURE, weight: 5 },  // Rare passive ration generator
        { item: ITEMS.XENO_MYCELIUM, weight: 2 } // ULTRA RARE
    ],

    // 4. Technology
    TECH_ANCIENT: [
        { item: ITEMS.SCRAP_PLATING, weight: 40 },
        { item: ITEMS.TECH_FRAGMENT, weight: 10 },
        { item: ITEMS.NEURAL_LINK, weight: 2 } // ULTRA RARE
    ],

    // 5. Geology
    GEO_RARE: [
        { item: ITEMS.GEODE_SAMPLE, weight: 20 },
        { item: ITEMS.CONDENSED_SALVAGE, weight: 15 },
        { item: ITEMS.OBSIDIAN_MONOLITH, weight: 3 }
    ],

    // 6. High Energy
    HIGH_ENERGY_ITEMS: [
        { item: ITEMS.IONIZED_BATTERY, weight: 25 }
    ],

    // 8. Exodus Derelict Supplies (ONLY from Exodus wreck encounters — not generic loot)
    EXODUS_SUPPLIES: [
        { item: ITEMS.FOOD_PACK, weight: 25 },
        { item: ITEMS.LUXURY_CHOCOLATE, weight: 15 },
        { item: ITEMS.MUSIC_HOLOTAPE, weight: 5 }, // Rare — affects all crew
        { item: ITEMS.IONIZED_BATTERY, weight: 15 }
    ],

    // 7a. Wreckage Salvage (scavenger-themed for WRECKAGE tag)
    WRECKAGE_SALVAGE: [
        { type: 'RESOURCE', val: 'METALS', min: 10, max: 25, weight: 40, log: "Stripped hull plating from an unidentified vessel." },
        { type: 'RESOURCE', val: 'METALS', min: 15, max: 35, weight: 25, log: "Drive components recovered from a shattered engine block." },
        { type: 'RESOURCE', val: 'ENERGY', min: 5, max: 15, weight: 20, log: "Emergency batteries recovered from wreckage debris." },
        { item: ITEMS.SCRAP_PLATING, weight: 15 },
        { item: ITEMS.CONDENSED_SALVAGE, weight: 10 },
        { item: ITEMS.IONIZED_BATTERY, weight: 5 },
        { type: 'LORE', text: "Wreckage ID: Unknown vessel. No transponder. Pre-Exodus design.", weight: 8 },
        { type: 'LORE', text: "Cargo manifest fragment: '...final shipment, colony supplies for...' — text corrupted.", weight: 5 }
    ],

    // 7b. Lore / Data
    LORE_ANCIENT: [
        { type: 'LORE', text: "Decrypted: '...the suns are darkening one by one...'", weight: 20 },
        { type: 'LORE', text: "Visual: Massive skeletal structures beneath the crust.", weight: 20 }
    ],
    LORE_SIGNAL: [
        { type: 'LORE', text: "Audio: Rhythmic tapping matching prime numbers.", weight: 20 },
        { type: 'LORE', text: "Signal Origin: Deep underground facility detected.", weight: 20 }
    ],

    // === SIGNAL TYPE BONUS POOLS ===

    // ALIEN SIGNALS — high-value alien tech (risky but rewarding)
    ALIEN_SIGNAL_LOOT: [
        { item: ITEMS.ALIEN_TRANSMITTER, weight: 20 },
        { item: ITEMS.XENOTECH_COMPONENT, weight: 10 },
        { item: ITEMS.SIGNAL_DECODER, weight: 5 },
        { type: 'RESOURCE', val: 'ENERGY', min: 15, max: 30, weight: 25, log: "Unknown energy signature harvested from alien broadcast." },
        { type: 'LORE', text: "Signal Fragment: '...we have been waiting...'", weight: 15 },
        { type: 'LORE', text: "Audio decode: Coordinates to a location that doesn't exist on any chart.", weight: 10 }
    ],

    // ANCIENT RUINS — artifacts and knowledge
    ANCIENT_RUINS_LOOT: [
        { item: ITEMS.STAR_CHART_FRAGMENT, weight: 15 },
        { item: ITEMS.CULTURAL_ARTIFACT, weight: 25 },
        { item: ITEMS.ANCIENT_DATABASE, weight: 10 },
        { item: ITEMS.TECH_FRAGMENT, weight: 15 },
        { type: 'RESOURCE', val: 'METALS', min: 10, max: 25, weight: 20, log: "Salvaged rare alloys from ruined structure." },
        { type: 'LORE', text: "Inscription: 'We built to last forever. We were wrong.'", weight: 10 },
        { type: 'LORE', text: "Archive fragment: They saw what was coming. They couldn't stop it.", weight: 8 }
    ],

    // BIOLOGICAL SIGNALS — life-based resources
    BIOLOGICAL_SIGNAL_LOOT: [
        { item: ITEMS.BIO_SAMPLE_RARE, weight: 15 },
        { item: ITEMS.SYMBIOTIC_CULTURE, weight: 5 },
        { item: ITEMS.RADIOTROPHIC_FUNGUS, weight: 30 },
        { item: ITEMS.FUNGUS_CULTURE, weight: 8 },
        { item: ITEMS.FOOD_PACK, weight: 20, log: "Edible organisms harvested from biosphere." },
        { type: 'LORE', text: "Bio-scan: Life here evolved to survive conditions we can barely imagine.", weight: 12 }
    ],

    // TECHNOLOGICAL SIGNALS — machine salvage
    TECHNOLOGICAL_SIGNAL_LOOT: [
        { item: ITEMS.SALVAGE_BEACON, weight: 20 },
        { item: ITEMS.POWER_COUPLER, weight: 25 },
        { item: ITEMS.REPAIR_DRONE, weight: 5 },
        { item: ITEMS.IONIZED_BATTERY, weight: 20 },
        { type: 'RESOURCE', val: 'METALS', min: 20, max: 40, weight: 25, log: "Advanced components stripped from automated systems." }
    ],

    // DERELICT SHIP — ship salvage focus
    DERELICT_LOOT: [
        { type: 'RESOURCE', val: 'METALS', min: 25, max: 50, weight: 35, log: "Hull plating and structural components recovered." },
        { item: ITEMS.SCRAP_PLATING, weight: 25 },
        { item: ITEMS.IONIZED_BATTERY, weight: 20 },
        { item: ITEMS.CONDENSED_SALVAGE, weight: 10 },
        { type: 'LORE', text: "Ship log fragment: Final entry. They knew the end was coming.", weight: 8 },
        { item: ITEMS.FOOD_PACK, weight: 15, log: "Emergency rations recovered from crew quarters." }
    ]
};

// LOOT RULES: Logic mapping Planet Criteria -> Pools
const LOOT_RULES = [
    // --- BASELINE ---
    // Always include the chance of failure/dirt
    {
        id: 'base_null',
        criteria: () => true,
        pool: 'NULL_RESULT',
        msg_context: 'Dirt analysis'
    },

    // --- METALS LOGIC ---
    {
        id: 'metals_scarce',
        criteria: (p) => p.resources.metals < 30,
        pool: 'METALS_SCARCE',
        msg_context: 'Trace metal scanning'
    },
    {
        id: 'metals_avg',
        criteria: (p) => p.resources.metals >= 30 && p.resources.metals < 70,
        pool: 'METALS_COMMON',
        msg_context: 'Standard mining'
    },
    {
        id: 'metals_rich',
        criteria: (p) => p.resources.metals >= 70,
        pool: 'METALS_RICH',
        msg_context: 'Deep vein digging'
    },

    // --- ENERGY LOGIC ---
    {
        id: 'energy_scarce',
        criteria: (p) => p.resources.energy < 30,
        pool: 'ENERGY_SCARCE',
        msg_context: 'Background radiation check'
    },
    {
        id: 'energy_avg',
        criteria: (p) => p.resources.energy >= 30 && p.resources.energy < 70,
        pool: 'ENERGY_COMMON',
        msg_context: 'Energy siphoning'
    },
    {
        id: 'energy_rich',
        criteria: (p) => p.resources.energy >= 70,
        pool: 'ENERGY_RICH',
        msg_context: 'High-yield harvesting'
    },

    // --- SPECIALS ---
    {
        id: 'vital_world',
        criteria: (p) => p.type === 'VITAL' || (p.metrics && p.metrics.hasLife),
        pool: 'BIO_STANDARD',
        msg_context: 'Biosphere sampling'
    },
    {
        id: 'rocky_geo',
        criteria: (p) => p.type === 'ROCKY',
        pool: 'GEO_RARE',
        msg_context: 'Geological excavation'
    },
    {
        id: 'tech_ruins',
        criteria: (p) => p.metrics && p.metrics.hasTech,
        pool: 'TECH_ANCIENT',
        msg_context: 'Artifact recovery'
    },
    {
        id: 'high_energy_items',
        criteria: (p) => ['GAS_GIANT', 'VOLCANIC'].includes(p.type),
        pool: 'HIGH_ENERGY_ITEMS',
        msg_context: 'Plasma collection'
    },

    // --- WRECKAGE ---
    {
        id: 'wreckage_salvage',
        criteria: (p) => p.tags && p.tags.includes('WRECKAGE'),
        pool: 'WRECKAGE_SALVAGE',
        msg_context: 'Debris field scavenging'
    },

    // --- LORE TAGS (legacy) ---
    {
        id: 'tag_ruins_lore',
        criteria: (p) => p.tags && p.tags.includes('ANCIENT_RUINS'),
        pool: 'LORE_ANCIENT',
        msg_context: 'Archaeological scan'
    },
    {
        id: 'tag_signals_lore',
        criteria: (p) => p.tags && p.tags.includes('ALIEN_SIGNALS'),
        pool: 'LORE_SIGNAL',
        msg_context: 'Signal triangulation'
    },

    // === SIGNAL TYPE BONUS LOOT ===
    // These provide meaningful bonuses for planets with specific signals

    {
        id: 'alien_signal_bonus',
        criteria: (p) => p.tags && p.tags.includes('ALIEN_SIGNALS'),
        pool: 'ALIEN_SIGNAL_LOOT',
        msg_context: 'Alien signal source investigation'
    },
    {
        id: 'ancient_ruins_bonus',
        criteria: (p) => p.tags && p.tags.includes('ANCIENT_RUINS'),
        pool: 'ANCIENT_RUINS_LOOT',
        msg_context: 'Ruins excavation'
    },
    {
        id: 'biological_signal_bonus',
        criteria: (p) => p.metrics && p.metrics.hasLife,
        pool: 'BIOLOGICAL_SIGNAL_LOOT',
        msg_context: 'Bio-signature sampling'
    },
    {
        id: 'technological_signal_bonus',
        criteria: (p) => p.metrics && p.metrics.hasTech,
        pool: 'TECHNOLOGICAL_SIGNAL_LOOT',
        msg_context: 'Dig where the machines are'
    },
    {
        id: 'derelict_ship_bonus',
        criteria: (p) => p.tags && p.tags.includes('DERELICT'),
        pool: 'DERELICT_LOOT',
        msg_context: 'Derelict vessel scavenging'
    }
];
