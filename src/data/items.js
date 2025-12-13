const ITEMS = {
    // Biological
    RADIOTROPHIC_FUNGUS: {
        id: 'fungus', name: 'Radiotrophic Fungus', type: 'CONSUMABLE', value: 15,
        desc: 'Converts radiation to chemical energy.',
        onUse: (state) => { state.energy = Math.min(100, state.energy + 15); return "Energy restored by 15."; }
    },
    AMBER_SPECIMEN: { id: 'amber', name: 'Amber Specimen', type: 'ARTIFACT', value: 50, desc: 'Preserved biological sample from ancient era.' },
    // Rocky/Barren
    GEODE_SAMPLE: { id: 'geode', name: 'Geode Sample', type: 'RESOURCE', value: 40, desc: 'Crystalline formation rich in rare earth metals.' },
    OBSIDIAN_MONOLITH: { id: 'monolith', name: 'Obsidian Monolith', type: 'ARTIFACT', value: 75, desc: 'Strange geometric stone carving.' },
    // Ruins/Tech
    SCRAP_PLATING: {
        id: 'scrap', name: 'Scrap Plating', type: 'RESOURCE', value: 10,
        desc: 'Salvageable alloy plating.',
        onUse: (state) => { state.probeIntegrity = Math.min(100, state.probeIntegrity + 20); return "Probe repaired (+20%)."; }
    },
    TECH_FRAGMENT: { id: 'tech_frag', name: 'Tech Fragment', type: 'LORE', value: 100, desc: 'Data storage device from a lost civilization.' },

    // Condensed Resources (Found via Probe 5%)
    CONDENSED_METALS: {
        id: 'condensed_metals', name: 'Condensed Metals', type: 'RESOURCE_PACK', value: 50,
        desc: 'Highly compressed refined ores.',
        onUse: (state) => { state.metals += 50; return "Processed +50 Metals."; }
    },
    IONIZED_BATTERY: {
        id: 'ion_battery', name: 'Ionized Battery', type: 'RESOURCE_PACK', value: 30,
        desc: 'Unstable high-capacity energy cell.',
        onUse: (state) => { state.energy = Math.min(100, state.energy + 30); return "Drained +30 Energy."; }
    }
};
