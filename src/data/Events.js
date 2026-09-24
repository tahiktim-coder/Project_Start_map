// The strange finds wait until sector 3: sector 1 must look exactly like the briefing said it would.
const deepEnough = () => ((window.app && window.app.state && window.app.state.currentSector) || 1) >= 3;

// Choice text is what the team does. The risk and the reward are shown beside it by the EVA card.
// A walk-away choice that costs something must keep "(energy cost)" or "(morale loss)" in its text:
// resolveEvaOutcome in bundle.js reads those words to charge -10 Energy or +1 Stress.
const EVENTS = [
    {
        id: 'DERELICT',
        trigger: (planet) => planet.tags && (planet.tags.includes('ANCIENT_RUINS') || planet.tags.includes('ALIEN_SIGNALS')),
        title: "CRASHED SHIP",
        desc: "The signal is coming from a crashed ship. Its hull is cracked and could give way at any moment.",
        choices: [
            { text: "Cut panels off the outside", riskMod: 0, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Go inside the hull", riskMod: 30, reward: { type: 'ITEM', tags: ['TECH'] } }
        ]
    },
    {
        id: 'BIO_HORROR',
        trigger: (planet) => planet.type === 'VITAL' || (planet.tags && planet.tags.includes('VITAL_FLORA')),
        title: "SOMETHING HUGE",
        desc: "The life signal is one enormous animal, and it's moving toward the team.",
        choices: [
            { text: "Keep back and take readings", riskMod: 10, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Get close and take a tissue sample", riskMod: 50, reward: { type: 'ITEM', tags: ['BIO'] } }
        ]
    },
    {
        id: 'MINERAL_VEIN',
        trigger: (planet) => ['ROCKY', 'DESERT', 'VOLCANIC'].includes(planet.type),
        title: "RICH VEIN",
        desc: "There's a dense pocket of metal ore on the edge of a crumbling canyon.",
        choices: [
            { text: "Dig at the surface", riskMod: 0, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Drill deep into the ridge", riskMod: 25, reward: { type: 'ITEM', tags: ['GEO'] } }
        ]
    },
    {
        id: 'SOLAR_FLARE',
        trigger: (planet) => planet.metrics && planet.metrics.temp > 100,
        title: "SOLAR FLARE COMING",
        desc: "The star is about to flare. Radiation on the surface is rising fast.",
        choices: [
            { text: "Collect power under the radiation shield", riskMod: 10, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Leave the collectors out in the open", riskMod: 40, reward: { type: 'ITEM', tags: ['ENERGY'] } }
        ]
    },
    {
        id: 'GHOST_SHIP',
        trigger: (planet) => deepEnough() && Math.random() < 0.3,
        title: "SILENT SHIP",
        desc: "A ship is drifting in high orbit. It isn't sending any ID code, and nobody aboard is alive.",
        choices: [
            { text: "Call it once, then leave", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Send a team aboard", riskMod: 60, reward: { type: 'ITEM', tags: ['TECH', 'LORE'] } }
        ]
    },
    {
        id: 'CRYSTAL_SPIRE',
        trigger: (planet) => ['ICE_WORLD', 'ROCKY'].includes(planet.type),
        title: "RINGING TOWER",
        desc: "A huge crystal tower sticks up out of the ice. It gives off a low ringing sound.",
        choices: [
            { text: "Scan it from a distance", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Cut out its core", riskMod: 25, reward: { type: 'ITEM', tags: ['GEO'] } }
        ]
    },
    {
        id: 'TIME_DILATION',
        trigger: (planet) => planet.metrics && planet.metrics.gravity > 1.5,
        title: "SLOW CLOCKS",
        desc: "The gravity here is so strong it slows time. One hour on the surface is a whole day up on the ship.",
        choices: [
            { text: "Call the team back now", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Stay longer and collect samples", riskMod: 35, reward: { type: 'ITEM', tags: ['GEO', 'LORE'] } }
        ]
    },
    {
        id: 'MIRAGE_VISION',
        trigger: (planet) => ['DESERT', 'OCEANIC'].includes(planet.type),
        title: "CITIES ON THE HORIZON",
        desc: "The team can see cities like Earth's on the horizon. The sensors say there's nothing there.",
        choices: [
            { text: "Trust the sensors and stay put", riskMod: 5, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Walk out toward the cities", riskMod: 45, reward: { type: 'ITEM', tags: ['LORE'] } }
        ]
    },
    {
        id: 'TECTONIC_SHIFT',
        trigger: (planet) => ['VOLCANIC', 'ROCKY'].includes(planet.type) && planet.dangerLevel > 1,
        title: "EARTHQUAKE",
        desc: "The ground under the landing site is splitting open.",
        choices: [
            { text: "Take off right now (energy cost)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Hold steady and keep mining", riskMod: 50, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }
        ]
    },
    {
        id: 'HIVE_MIND',
        trigger: (planet) => planet.metrics && planet.metrics.hasLife && planet.type === 'VITAL',
        title: "SINGING PLANTS",
        desc: "The plants are all making the same sound together, and it's drowning out our radios.",
        choices: [
            { text: "Burn them back and harvest", riskMod: 20, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Play their sound back to them", riskMod: 40, reward: { type: 'ITEM', tags: ['BIO'] } }
        ]
    },
    {
        id: 'CRYOSLEEP_POD',
        trigger: (planet) => planet.type === 'ICE_WORLD' && planet.metrics.hasTech,
        title: "OLD SLEEP POD",
        desc: "There's a working sleep pod frozen into the ice. We can't tell whether the person inside is alive.",
        choices: [
            { text: "Take the parts around the pod", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Thaw the pod and open it", riskMod: 60, reward: { type: 'ITEM', tags: ['LORE', 'TECH'] } }
        ]
    },
    {
        id: 'ROGUE_AI',
        trigger: (planet) => planet.tags && planet.tags.includes('ALIEN_SIGNALS'),
        title: "ARMED SATELLITE",
        desc: "An old defence satellite in orbit has locked on to the lander.",
        choices: [
            { text: "Dodge it and keep going", riskMod: 20, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Try to break into its controls", riskMod: 40, reward: { type: 'ITEM', tags: ['TECH'] } }
        ]
    },
    // --- NEW PLANET TYPE EVENTS ---
    {
        id: 'TERMINATOR_WALK',
        trigger: (planet) => planet.type === 'TIDALLY_LOCKED',
        title: "THE TWILIGHT STRIP",
        desc: "Only a strip about 200 km wide is safe to walk on. One side burns and the other side freezes.",
        choices: [
            { text: "Search along the twilight strip", riskMod: 15, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Cross into the frozen dark side", riskMod: 55, reward: { type: 'ITEM', tags: ['ARTIFACT', 'LORE'] } }
        ]
    },
    {
        id: 'INNER_WORLD',
        trigger: (planet) => planet.type === 'HOLLOW',
        title: "INSIDE THE PLANET",
        desc: "The team found a way in. The planet is hollow, with a small sun in the middle and ruined buildings on the inside walls.",
        choices: [
            { text: "Take photos from the entrance", riskMod: 5, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Climb down inside", riskMod: 50, reward: { type: 'ITEM', tags: ['LORE', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'SYMBIOTE_EMBRACE',
        trigger: (planet) => planet.type === 'SYMBIOTE_WORLD',
        title: "THE WELCOME",
        desc: "The plants are growing paths for the team to walk on. Fruit appears at their feet, and it smells like home.",
        choices: [
            { text: "Take the fruit, but stay careful", riskMod: 0, reward: { type: 'ITEM', tags: ['BIO'] } },
            { text: "Send one of them deeper in alone", riskMod: 35, reward: { type: 'ITEM', tags: ['BIO', 'LORE'] } }
        ]
    },
    {
        id: 'THE_REFLECTION',
        trigger: (planet) => planet.type === 'MIRROR',
        title: "THE REFLECTION",
        desc: "The team finds themselves: bodies in our suits, long dead, laid in a circle around the landing site. The sensors say nothing is there.",
        choices: [
            { text: "Leave right now (morale loss)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Go and look at the bodies", riskMod: 40, reward: { type: 'ITEM', tags: ['ARTIFACT', 'TECH'] } }
        ]
    },
    {
        id: 'SHIP_GRAVEYARD',
        trigger: (planet) => planet.type === 'GRAVEYARD',
        title: "THE SCRAP HEAP",
        desc: "Thousands of ships are crushed together into one huge heap, and the team is walking on their hulls. The salvage is incredible, but the pile could collapse.",
        choices: [
            { text: "Strip the hulls on top", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } },
            { text: "Cut down into the middle", riskMod: 60, reward: { type: 'ITEM', tags: ['TECH', 'LORE'] } }
        ]
    },
    {
        id: 'THE_FREQUENCY',
        trigger: (planet) => planet.type === 'SINGING',
        title: "THE HUM",
        desc: "The planet gives off a hum that makes people happy. The team has stopped talking and is smiling. One of them has closed their eyes.",
        choices: [
            { text: "Record the hum and leave", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Stay and listen longer", riskMod: 30, reward: { type: 'ITEM', tags: ['ARTIFACT'] } }
        ]
    },
    {
        id: 'MECHA_SALVAGE',
        trigger: (planet) => planet.type === 'MECHA',
        title: "OLD FACTORY",
        desc: "A huge automatic factory is still running on standby power. Its security system is switched on.",
        choices: [
            { text: "Search around the outside", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Break into the control room", riskMod: 60, reward: { type: 'ITEM', tags: ['TECH', 'WEAPON'] } }
        ]
    },
    {
        id: 'BIO_SAMPLES',
        trigger: (planet) => planet.type === 'BIO_MASS',
        title: "SPORE STORM",
        desc: "The air is filling with glowing spores. They drift toward anything warm.",
        choices: [
            { text: "Flush the lander's vents (energy cost)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Collect some spores", riskMod: 50, reward: { type: 'ITEM', tags: ['BIO', 'CURE'] } }
        ]
    },
    {
        id: 'VOID_WHISPERS',
        trigger: (planet) => ['SHATTERED', 'ROGUE'].includes(planet.type),
        title: "NAMES IN THE STATIC",
        desc: "It's very quiet here. The team says they can hear their own names in the radio static.",
        choices: [
            { text: "Bring them back to rest (morale loss)", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Record the static and study it", riskMod: 40, reward: { type: 'ITEM', tags: ['LORE'] } }
        ]
    },
    {
        id: 'PRISM_SONG',
        trigger: (planet) => planet.type === 'CRYSTALLINE',
        title: "SHAKING CRYSTALS",
        desc: "The crystals here vibrate hard enough to shatter glass, and maybe bone.",
        choices: [
            { text: "Pad the lander's hull (energy cost)", riskMod: 10, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Record the sound up close", riskMod: 30, reward: { type: 'ITEM', tags: ['ARTIFACT'] } }
        ]
    },
    // --- ADDITIONAL EVA EVENTS ---
    {
        id: 'FUNGAL_BLOOM',
        trigger: (planet) => planet.type === 'FUNGAL' || (planet.metrics && planet.metrics.hasLife && Math.random() < 0.3),
        title: "GLOWING MUSHROOMS",
        desc: "The ground is covered in glowing mushrooms. Their spores make people see things that aren't there.",
        choices: [
            { text: "Go back to the lander", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Harvest some to study", riskMod: 25, reward: { type: 'ITEM', tags: ['BIO', 'RATION'] } }
        ]
    },
    {
        id: 'GRAVITY_WELL',
        trigger: (planet) => planet.metrics && planet.metrics.gravity > 1.2,
        title: "HEAVY GRAVITY",
        desc: "Gravity here just tripled. Equipment is being crushed, and the team can barely stand.",
        choices: [
            { text: "Pull the team out now", riskMod: 10, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Crawl to the target anyway", riskMod: 45, reward: { type: 'ITEM', tags: ['GEO', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'DUST_STORM',
        trigger: (planet) => ['DESERT', 'ROCKY', 'TOXIC'].includes(planet.type),
        title: "DUST STORM",
        desc: "A huge dust storm is rolling in. The grit is wearing holes in the suits.",
        choices: [
            { text: "Take shelter and wait", riskMod: 5, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Push on through the storm", riskMod: 40, reward: { type: 'ITEM', tags: ['GEO'] } }
        ]
    },
    {
        id: 'MASS_BURIAL',
        trigger: (planet) => planet.type === 'TOMB_WORLD' || (deepEnough() && Math.random() < 0.15),
        title: "GRAVES BELOW THE WRECK",
        desc: "There are rows of graves here, and a wrecked ship in orbit above them. The dates on the graves are older than the wreck.",
        choices: [
            { text: "Record the names and leave", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Dig one of them up", riskMod: 35, reward: { type: 'ITEM', tags: ['LORE', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'ACID_RAIN',
        trigger: (planet) => planet.atmosphere === 'TOXIC' || planet.type === 'TOXIC',
        title: "ACID RAIN",
        desc: "It's raining acid. The outside of the lander is being eaten away as we stand here.",
        choices: [
            { text: "Call off the trip", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Grab what we can, fast", riskMod: 35, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }
        ]
    },
    {
        id: 'MAGNETIC_STORM',
        trigger: (planet) => ['GAS_GIANT', 'SHATTERED'].includes(planet.type) || (deepEnough() && Math.random() < 0.2),
        title: "MAGNETIC STORM",
        desc: "A magnetic storm is burning out our electronics. The radio and navigation are both down.",
        choices: [
            { text: "Wait for it to pass", riskMod: 10, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Keep going without navigation", riskMod: 50, reward: { type: 'ITEM', tags: ['TECH'] } }
        ]
    },
    {
        id: 'CAVE_SYSTEM',
        trigger: (planet) => ['ROCKY', 'ICE_WORLD', 'HOLLOW'].includes(planet.type),
        title: "CAVES",
        desc: "Scans show huge caves under the surface. Something is moving around down there in the dark.",
        choices: [
            { text: "Stay on the surface", riskMod: 5, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Go deep into the caves", riskMod: 40, reward: { type: 'ITEM', tags: ['GEO', 'BIO'] } }
        ]
    },
    {
        id: 'FROZEN_LAKE',
        trigger: (planet) => planet.type === 'ICE_WORLD' || planet.type === 'FROZEN_OCEAN',
        title: "UNDER THE ICE",
        desc: "Something is swimming under the frozen surface, circling the landing site.",
        choices: [
            { text: "Stay away from the edge", riskMod: 5, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Drop a camera through the ice", riskMod: 30, reward: { type: 'ITEM', tags: ['BIO', 'LORE'] } }
        ]
    },
    {
        id: 'LIVING_METAL',
        trigger: (planet) => planet.type === 'MECHA' || planet.type === 'MACHINE_WORLD',
        title: "MOVING METAL",
        desc: "The ground here is metal, and it's moving. It's building something around the lander.",
        choices: [
            { text: "Leave before we're walled in", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Let it finish building", riskMod: 45, reward: { type: 'ITEM', tags: ['TECH', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'OLD_COLONY',
        trigger: (planet) => planet.tags && planet.tags.includes('FAILED_COLONY'),
        title: "THE SETTLEMENT",
        desc: "Human buildings, abandoned decades ago. The doors are still locked from the inside.",
        choices: [
            { text: "Strip metal from the outside walls", riskMod: 5, reward: { type: 'RESOURCE', val: 'METALS' } },
            { text: "Break down a door", riskMod: 25, reward: { type: 'ITEM', tags: ['LORE', 'RATION'] } }
        ]
    },
    {
        id: 'RADIO_SILENCE',
        trigger: (planet) => deepEnough() && Math.random() < 0.2,
        title: "NO SIGNAL",
        desc: "The team has lost all radio contact with the ship. Something down here is blocking the signal.",
        choices: [
            { text: "Head back to the lander right away", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Find what's blocking the signal", riskMod: 50, reward: { type: 'ITEM', tags: ['TECH', 'ARTIFACT'] } }
        ]
    },
    {
        id: 'PERFECT_SPHERE',
        trigger: (planet) => deepEnough() && Math.random() < 0.15,
        title: "THE SPHERE",
        desc: "A perfect sphere, 10 metres across, made of something we can't identify. It's warm, and it hums.",
        choices: [
            { text: "Photograph it and stay back", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Touch it", riskMod: 45, reward: { type: 'ITEM', tags: ['ARTIFACT', 'LORE'] } }
        ]
    },
    {
        id: 'GAS_POCKET',
        trigger: (planet) => planet.type === 'VOLCANIC' || planet.type === 'SULFUR',
        title: "POISON GAS",
        desc: "The ground is leaking poisonous gas. The suit filters won't last long.",
        choices: [
            { text: "Pull back now", riskMod: 5, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Rush in and grab the ore", riskMod: 35, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }
        ]
    },
    {
        id: 'FOOTPRINTS',
        trigger: (planet) => deepEnough() && Math.random() < 0.1,
        title: "SOMEONE WAS HERE",
        desc: "There are human footprints in the dust, but no wreck and no bodies. The prints just stop.",
        choices: [
            { text: "Log them and leave", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },
            { text: "Follow the footprints", riskMod: 40, reward: { type: 'ITEM', tags: ['LORE'] } }
        ]
    },
    {
        id: 'DISTRESS_BEACON', // Fallback — MUST BE LAST
        trigger: () => true,
        title: "DISTRESS CALL",
        desc: "A weak distress call keeps repeating from a field of wreckage.",
        choices: [
            { text: "Scan it from where we are", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },
            { text: "Search through the wreckage", riskMod: 20, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }
        ]
    }
];
