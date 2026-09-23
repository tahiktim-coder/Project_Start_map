// The strange finds wait until sector 3: sector 1 must look exactly like the briefing said it would.
const deepEnough = () => ((window.app && window.app.state && window.app.state.currentSector) || 1) >= 3;

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
            { text: "Surface Digging (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'METALS' } },
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
        trigger: (planet) => deepEnough() && Math.random() < 0.3,
        title: "UNKNOWN VESSEL",
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
    // --- NEW PLANET TYPE EVENTS ---
    {
        id: 'TERMINATOR_WALK',
        trigger: (planet) => planet.type === 'TIDALLY_LOCKED',
        title: "THE THIN LINE",
        desc: "The livable band is barely 200km wide. One wrong step — eternal fire or eternal ice.",
        choices: [
            { text: "Survey Twilight Zone (Moderate)", riskMod: 15, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Cross Into The Dark Side (Extreme)", riskMod: 55, reward: { type: 'ITEM', tags: ['ARTIFACT', 'LORE'] } }
        ]
    },
    {
        id: 'INNER_WORLD',
        trigger: (planet) => planet.type === 'HOLLOW',
        title: "THE INTERIOR",
        desc: "The team has found an entry point. Inside: inverted gravity, a miniature sun, and the ruins of a dead civilization on the inner walls.",
        choices: [
            { text: "Photograph From Entrance (Safe)", riskMod: 5, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Descend Into Interior (Extreme)", riskMod: 50, reward: { type: 'ITEM', tags: ['LORE', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'SYMBIOTE_EMBRACE',
        trigger: (planet) => planet.type === 'SYMBIOTE_WORLD',
        title: "THE WELCOME",
        desc: "The biosphere is actively growing pathways for the landing team. Fruit appears at their feet. It smells like home.",
        choices: [
            { text: "Accept Gifts, Stay Cautious (Safe)", riskMod: 0, reward: { type: 'ITEM', tags: ['BIO'] } },
            { text: "Let Mira Interface Fully (Psych Risk)", riskMod: 35, reward: { type: 'ITEM', tags: ['BIO', 'LORE'] } }
        ]
    },
    {
        id: 'THE_REFLECTION',
        trigger: (planet) => planet.type === 'MIRROR',
        title: "THE REFLECTION",
        desc: "On the surface, the team sees themselves. Dead. Decomposed. Arranged in a circle around the landing zone. Sensors insist nothing is there.",
        choices: [
            { text: "Abort EVA Immediately (Morale Loss)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Investigate The Image (Psych Risk)", riskMod: 40, reward: { type: 'ITEM', tags: ['ARTIFACT', 'TECH'] } }
        ]
    },
    {
        id: 'SHIP_GRAVEYARD',
        trigger: (planet) => planet.type === 'GRAVEYARD',
        title: "THE BONE HEAP",
        desc: "Millions of ships, crushed together. The EVA team walks on the compressed hulls of civilizations. The salvage here is extraordinary — and the structure is unstable.",
        choices: [
            { text: "Strip Surface Hulls (Safe)", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } },
            { text: "Breach Deep Core (Extreme)", riskMod: 60, reward: { type: 'ITEM', tags: ['TECH', 'LORE'] } }
        ]
    },
    {
        id: 'THE_FREQUENCY',
        trigger: (planet) => planet.type === 'SINGING',
        title: "THE FREQUENCY",
        desc: "The crew has stopped talking. They're smiling. The planet's harmonic is inducing dopamine production. Mira has closed her eyes.",
        choices: [
            { text: "Record & Depart (Safe, Crew Stress -1)", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Stay And Listen Longer (Risky)", riskMod: 30, reward: { type: 'ITEM', tags: ['ARTIFACT'] } }
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
    },
    // --- ADDITIONAL EVA EVENTS ---
    {
        id: 'FUNGAL_BLOOM',
        trigger: (planet) => planet.type === 'FUNGAL' || (planet.metrics && planet.metrics.hasLife && Math.random() < 0.3),
        title: "FUNGAL BLOOM",
        desc: "The ground is covered in glowing mushrooms. The spores are psychoactive. The crew is seeing patterns in everything.",
        choices: [
            { text: "Retreat to Ship (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Harvest for Study (Risky)", riskMod: 25, reward: { type: 'ITEM', tags: ['BIO', 'RATION'] } }
        ]
    },
    {
        id: 'GRAVITY_WELL',
        trigger: (planet) => planet.metrics && planet.metrics.gravity > 1.2,
        title: "GRAVITY SURGE",
        desc: "Local gravity just tripled. Equipment is being crushed. Crew can barely stand.",
        choices: [
            { text: "Emergency Rescue (Costly)", riskMod: 10, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Crawl to Target (Extreme)", riskMod: 45, reward: { type: 'ITEM', tags: ['GEO', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'DUST_STORM',
        trigger: (planet) => ['DESERT', 'ROCKY', 'TOXIC'].includes(planet.type),
        title: "SILICA STORM",
        desc: "A massive dust storm is rolling in. The particles are shredding suit integrity.",
        choices: [
            { text: "Shelter in Place (Safe)", riskMod: 5, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Push Through (Very Risky)", riskMod: 40, reward: { type: 'ITEM', tags: ['GEO'] } }
        ]
    },
    {
        id: 'MASS_BURIAL',
        trigger: (planet) => planet.type === 'TOMB_WORLD' || (deepEnough() && Math.random() < 0.15),
        title: "THE GRAVES",
        desc: "Rows of markers. Four names on each. The dates are older than the wreck in orbit above them.",
        choices: [
            { text: "Record and Leave (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Dig One Up (Disturbing)", riskMod: 35, reward: { type: 'ITEM', tags: ['LORE', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'ACID_RAIN',
        trigger: (planet) => planet.atmosphere === 'TOXIC' || planet.type === 'TOXIC',
        title: "CORROSIVE DOWNPOUR",
        desc: "It's raining acid. The lander's exterior is dissolving. Every second costs us.",
        choices: [
            { text: "Abort Mission (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Quick Grab (Very Risky)", riskMod: 35, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }
        ]
    },
    {
        id: 'MAGNETIC_STORM',
        trigger: (planet) => ['GAS_GIANT', 'SHATTERED'].includes(planet.type) || (deepEnough() && Math.random() < 0.2),
        title: "EM SURGE",
        desc: "Electromagnetic storm is frying electronics. Comms are down. Navigation is dead.",
        choices: [
            { text: "Wait It Out (Slow)", riskMod: 10, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Navigate Blind (Extreme)", riskMod: 50, reward: { type: 'ITEM', tags: ['TECH'] } }
        ]
    },
    {
        id: 'CAVE_SYSTEM',
        trigger: (planet) => ['ROCKY', 'ICE_WORLD', 'HOLLOW'].includes(planet.type),
        title: "UNDERGROUND NETWORK",
        desc: "Scans reveal massive cave systems. Something is moving in the darkness.",
        choices: [
            { text: "Surface Only (Safe)", riskMod: 5, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Spelunk Deep (Risky)", riskMod: 40, reward: { type: 'ITEM', tags: ['GEO', 'BIO'] } }
        ]
    },
    {
        id: 'FROZEN_LAKE',
        trigger: (planet) => planet.type === 'ICE_WORLD' || planet.type === 'FROZEN_OCEAN',
        title: "BENEATH THE ICE",
        desc: "Something is swimming under the frozen surface. It's circling the landing zone.",
        choices: [
            { text: "Stay Away From Edge (Safe)", riskMod: 5, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Drop Camera Through Ice (Risky)", riskMod: 30, reward: { type: 'ITEM', tags: ['BIO', 'LORE'] } }
        ]
    },
    {
        id: 'LIVING_METAL',
        trigger: (planet) => planet.type === 'MECHA' || planet.type === 'MACHINE_WORLD',
        title: "ADAPTIVE METAL",
        desc: "The ground is metal and it's... rearranging. Building something around the lander.",
        choices: [
            { text: "Escape Before Trapped (Safe)", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Let It Finish (Unknown)", riskMod: 45, reward: { type: 'ITEM', tags: ['TECH', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'OLD_COLONY',
        trigger: (planet) => planet.tags && planet.tags.includes('FAILED_COLONY'),
        title: "THE SETTLEMENT",
        desc: "Human buildings. Abandoned decades ago. The doors are still locked from the inside.",
        choices: [
            { text: "Salvage Exterior (Safe)", riskMod: 5, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Break In (Disturbing)", riskMod: 25, reward: { type: 'ITEM', tags: ['LORE', 'RATION'] } }
        ]
    },
    {
        id: 'RADIO_SILENCE',
        trigger: (planet) => deepEnough() && Math.random() < 0.2,
        title: "DEAD AIR",
        desc: "All radio contact with the ship has stopped. The EVA team is alone. Something is jamming signals.",
        choices: [
            { text: "Return Immediately (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Find The Source (Very Risky)", riskMod: 50, reward: { type: 'ITEM', tags: ['TECH', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'PERFECT_SPHERE',
        trigger: (planet) => deepEnough() && Math.random() < 0.15,
        title: "THE SPHERE",
        desc: "A perfect sphere of unknown material. 10 meters diameter. It's warm. It's humming. It knows we're here.",
        choices: [
            { text: "Document Only (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Touch It (Unknown)", riskMod: 45, reward: { type: 'ITEM', tags: ['ARTIFACT', 'LORE'] } }
        ]
    },
    {
        id: 'GAS_POCKET',
        trigger: (planet) => planet.type === 'VOLCANIC' || planet.type === 'SULFUR',
        title: "TOXIC VENTING",
        desc: "The ground is releasing poisonous gas. Suit filters won't last long.",
        choices: [
            { text: "Retreat Now (Safe)", riskMod: 5, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Rush The Objective (Risky)", riskMod: 35, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }
        ]
    },
    {
        id: 'FOOTPRINTS',
        trigger: (planet) => deepEnough() && Math.random() < 0.1,
        title: "WE WEREN'T FIRST",
        desc: "Human footprints in the dust. No ship wreckage. No bodies. The prints just... stop.",
        choices: [
            { text: "Log and Leave (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Follow The Trail (Psych Risk)", riskMod: 40, reward: { type: 'ITEM', tags: ['LORE'] } }
        ]
    },
    {
        id: 'DISTRESS_BEACON', // Fallback — MUST BE LAST
        trigger: () => true,
        title: "DISTRESS BEACON",
        desc: "A faint repeating signal is coming from a debris field.",
        choices: [
            { text: "Scan & Leave (Safe)", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Investigate Debris (Risky)", riskMod: 20, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }
        ]
    }
];
