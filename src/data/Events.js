// The strange finds wait until sector 3: sector 1 must look exactly like the briefing said it would.
const deepEnough = () => ((window.app && window.app.state && window.app.state.currentSector) || 1) >= 3;

// Choice text is what the team does. The risk and the reward are shown beside it by the EVA card.
// A walk-away choice that costs something must keep "(energy cost)" or "(morale loss)" in its text:
// resolveEvaOutcome in bundle.js reads those words to charge -10 Energy or +1 Stress.
// short: the way's name on the new look's glass (src/newscreen/WorldFinds.js rows), at most four words. DRAFT, every one.
const EVENTS = [
    {
        id: 'DERELICT',
        trigger: (planet) => planet.tags && (planet.tags.includes('ANCIENT_RUINS') || planet.tags.includes('ALIEN_SIGNALS')),
        title: "CRASHED SHIP",
        desc: "The signal is coming from a crashed ship. Its hull is cracked and could give way at any moment.",
        choices: [
            { text: "Cut panels off the outside", short: "Cut panels off", riskMod: 0, reward: { type: 'RESOURCE', val: 'METALS' } },   // DRAFT: short
            { text: "Go inside the hull", short: "Go inside the hull", riskMod: 30, reward: { type: 'ITEM', tags: ['TECH'] } }   // DRAFT: short
        ]
    },
    {
        id: 'BIO_HORROR',
        trigger: (planet) => planet.type === 'VITAL' || (planet.tags && planet.tags.includes('VITAL_FLORA')),
        title: "SOMETHING HUGE",
        desc: "The life signal is one enormous animal, and it's moving toward the team.",
        choices: [
            { text: "Keep back and take readings", short: "Take readings from afar", riskMod: 10, reward: { type: 'RESOURCE', val: 'ENERGY' } },   // DRAFT: short
            { text: "Get close and take a tissue sample", short: "Take a tissue sample", riskMod: 50, reward: { type: 'ITEM', tags: ['BIO'] } }   // DRAFT: short
        ]
    },
    {
        id: 'MINERAL_VEIN',
        trigger: (planet) => ['ROCKY', 'DESERT', 'VOLCANIC'].includes(planet.type),
        title: "RICH VEIN",
        desc: "There's a dense pocket of metal ore on the edge of a crumbling canyon.",
        choices: [
            { text: "Dig at the surface", short: "Dig at the surface", riskMod: 0, reward: { type: 'RESOURCE', val: 'METALS' } },   // DRAFT: short
            { text: "Drill deep into the ridge", short: "Drill into the ridge", riskMod: 25, reward: { type: 'ITEM', tags: ['GEO'] } }   // DRAFT: short
        ]
    },
    {
        id: 'SOLAR_FLARE',
        trigger: (planet) => planet.metrics && planet.metrics.temp > 100,
        title: "SOLAR FLARE COMING",
        desc: "The star is about to flare. Radiation on the surface is rising fast.",
        choices: [
            { text: "Collect power under the radiation shield", short: "Collect under the shield", riskMod: 10, reward: { type: 'RESOURCE', val: 'ENERGY' } },   // DRAFT: short
            { text: "Leave the collectors out in the open", short: "Leave the collectors out", riskMod: 40, reward: { type: 'ITEM', tags: ['ENERGY'] } }   // DRAFT: short
        ]
    },
    {
        id: 'GHOST_SHIP',
        trigger: (planet) => deepEnough() && Math.random() < 0.3,
        title: "SILENT SHIP",
        desc: "A ship lies on the ground here, nose first. It isn't sending any ID code, and nobody aboard is alive.",   // the team is on the ground: no ship in orbit
        choices: [
            { text: "Call it once, then leave", short: "Call it, then leave", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Go aboard", short: "Go aboard", riskMod: 60, reward: { type: 'ITEM', tags: ['TECH', 'LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'CRYSTAL_SPIRE',
        trigger: (planet) => ['ICE_WORLD', 'ROCKY'].includes(planet.type),
        title: "RINGING TOWER",
        desc: "A huge crystal tower sticks up out of the ice. It gives off a low ringing sound.",
        choices: [
            { text: "Scan it from a distance", short: "Scan it from afar", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },   // DRAFT: short
            { text: "Cut out its core", short: "Cut out its core", riskMod: 25, reward: { type: 'ITEM', tags: ['GEO'] } }   // DRAFT: short
        ]
    },
    {
        id: 'TIME_DILATION',
        trigger: (planet) => planet.metrics && planet.metrics.gravity > 1.5,
        title: "SLOW CLOCKS",
        desc: "The gravity here is so strong it slows time. One hour on the surface is a whole day up on the ship.",
        choices: [
            { text: "Call the team back now", short: "Call the team back", riskMod: 0, reward: { type: 'DATA', val: 1 } },   // DRAFT: short
            { text: "Stay longer and collect samples", short: "Stay and collect samples", riskMod: 35, reward: { type: 'ITEM', tags: ['GEO', 'LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'MIRAGE_VISION',
        trigger: (planet) => ['DESERT', 'OCEANIC'].includes(planet.type),
        title: "CITIES ON THE HORIZON",
        desc: "The team can see cities like Earth's on the horizon. The sensors say there's nothing there.",
        choices: [
            { text: "Trust the sensors and stay put", short: "Stay put", riskMod: 5, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Walk out toward the cities", short: "Walk to the cities", riskMod: 45, reward: { type: 'ITEM', tags: ['LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'TECTONIC_SHIFT',
        trigger: (planet) => ['VOLCANIC', 'ROCKY'].includes(planet.type) && planet.dangerLevel > 1,
        title: "EARTHQUAKE",
        desc: "The ground under the landing site is splitting open.",
        choices: [
            { text: "Take off right now (energy cost)", short: "Take off now", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Hold steady and keep mining", short: "Keep mining", riskMod: 50, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }   // DRAFT: short
        ]
    },
    {
        id: 'HIVE_MIND',
        trigger: (planet) => planet.metrics && planet.metrics.hasLife && planet.type === 'VITAL',
        title: "SINGING PLANTS",
        desc: "The plants are all making the same sound together, and it's drowning out our radios.",
        choices: [
            { text: "Burn them back and harvest", short: "Burn them and harvest", riskMod: 20, reward: { type: 'RESOURCE', val: 'ENERGY' } },   // DRAFT: short
            { text: "Play their sound back to them", short: "Play their sound back", riskMod: 40, reward: { type: 'ITEM', tags: ['BIO'] } }   // DRAFT: short
        ]
    },
    {
        id: 'CRYOSLEEP_POD',
        trigger: (planet) => planet.type === 'ICE_WORLD' && planet.metrics.hasTech,
        title: "OLD SLEEP POD",
        desc: "There's a working sleep pod frozen into the ice. We can't tell whether the person inside is alive.",
        choices: [
            { text: "Take the parts around the pod", short: "Take the parts", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS' } },   // DRAFT: short
            { text: "Thaw the pod and open it", short: "Open the pod", riskMod: 60, reward: { type: 'ITEM', tags: ['LORE', 'TECH'] } }   // DRAFT: short
        ]
    },
    {
        id: 'ROGUE_AI',
        trigger: (planet) => planet.tags && planet.tags.includes('ALIEN_SIGNALS'),
        title: "ARMED TURRET",
        desc: "An old defence turret on the ridge has locked on to the team.",                                             // a landing event: on the ground, not in orbit
        choices: [
            { text: "Dodge it and keep going", short: "Dodge it", riskMod: 20, reward: { type: 'RESOURCE', val: 'ENERGY' } },   // DRAFT: short
            { text: "Try to break into its controls", short: "Break into its controls", riskMod: 40, reward: { type: 'ITEM', tags: ['TECH'] } }   // DRAFT: short
        ]
    },
    // --- NEW PLANET TYPE EVENTS ---
    {
        id: 'TERMINATOR_WALK',
        trigger: (planet) => planet.type === 'TIDALLY_LOCKED',
        title: "THE TWILIGHT STRIP",
        desc: "Only a strip about 200 km wide is safe to walk on. One side burns and the other side freezes.",
        choices: [
            { text: "Search along the twilight strip", short: "Search the twilight strip", riskMod: 15, reward: { type: 'RESOURCE', val: 'METALS' } },   // DRAFT: short
            { text: "Cross into the frozen dark side", short: "Cross into the dark", riskMod: 55, reward: { type: 'ITEM', tags: ['ARTIFACT', 'LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'INNER_WORLD',
        trigger: (planet) => planet.type === 'HOLLOW',
        title: "INSIDE THE PLANET",
        desc: "The team found a way in. The planet is hollow, with a small sun in the middle and ruined buildings on the inside walls.",
        choices: [
            { text: "Take photos from the entrance", short: "Photograph the entrance", riskMod: 5, reward: { type: 'DATA', val: 1 } },   // DRAFT: short
            { text: "Climb down inside", short: "Climb down inside", riskMod: 50, reward: { type: 'ITEM', tags: ['LORE', 'ARTIFACT'] } }   // DRAFT: short
        ]
    },
    {
        id: 'SYMBIOTE_EMBRACE',
        trigger: (planet) => planet.type === 'SYMBIOTE_WORLD',
        title: "THE WELCOME",
        desc: "The plants are growing paths for the team to walk on. Fruit appears at their feet, and it smells like home.",
        choices: [
            { text: "Take the fruit, but stay careful", short: "Take the fruit", riskMod: 0, reward: { type: 'ITEM', tags: ['BIO'] } },   // DRAFT: short
            { text: "Send one of them deeper in alone", short: "Send one deeper in", riskMod: 35, reward: { type: 'ITEM', tags: ['BIO', 'LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'THE_REFLECTION',
        trigger: (planet) => planet.type === 'MIRROR',
        title: "THE REFLECTION",
        desc: "The team finds themselves: bodies in our suits, long dead, laid in a circle around the landing site. The sensors say nothing is there.",
        choices: [
            { text: "Leave right now (morale loss)", short: "Leave right now", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Go and look at the bodies", short: "Look at the bodies", riskMod: 40, reward: { type: 'ITEM', tags: ['ARTIFACT', 'TECH'] } }   // DRAFT: short
        ]
    },
    {
        id: 'SHIP_GRAVEYARD',
        trigger: (planet) => planet.type === 'GRAVEYARD',
        title: "THE SCRAP HEAP",
        desc: "Hundreds of ships are crushed together into one huge heap, and the team is walking on their hulls. The salvage is incredible, but the pile could collapse.",
        choices: [
            { text: "Strip the hulls on top", short: "Strip the top hulls", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } },   // DRAFT: short
            { text: "Cut down into the middle", short: "Cut into the middle", riskMod: 60, reward: { type: 'ITEM', tags: ['TECH', 'LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'THE_FREQUENCY',
        trigger: (planet) => planet.type === 'SINGING',
        title: "THE HUM",
        desc: "The planet gives off a hum that makes people happy. The team has stopped talking and is smiling. One of them has closed their eyes.",
        choices: [
            { text: "Record the hum and leave", short: "Record it and leave", riskMod: 0, reward: { type: 'RESOURCE', val: 'ENERGY' } },   // DRAFT: short
            { text: "Stay and listen longer", short: "Stay and listen", riskMod: 30, reward: { type: 'ITEM', tags: ['ARTIFACT'] } }   // DRAFT: short
        ]
    },
    {
        id: 'MECHA_SALVAGE',
        trigger: (planet) => planet.type === 'MECHA',
        title: "OLD FACTORY",
        desc: "A huge automatic factory is still running on standby power. Its security system is switched on.",
        choices: [
            { text: "Search around the outside", short: "Search the outside", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS' } },   // DRAFT: short
            { text: "Break into the control room", short: "Raid the control room", riskMod: 60, reward: { type: 'ITEM', tags: ['TECH', 'WEAPON'] } }   // DRAFT: short
        ]
    },
    {
        id: 'BIO_SAMPLES',
        trigger: (planet) => planet.type === 'BIO_MASS',
        title: "SPORE STORM",
        desc: "The air is filling with glowing spores. They drift toward anything warm.",
        choices: [
            { text: "Flush the lander's vents (energy cost)", short: "Flush the vents", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Collect some spores", short: "Collect some spores", riskMod: 50, reward: { type: 'ITEM', tags: ['BIO', 'CURE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'VOID_WHISPERS',
        trigger: (planet) => ['SHATTERED', 'ROGUE'].includes(planet.type),
        title: "NAMES IN THE STATIC",
        desc: "It's very quiet here. The team says they can hear their own names in the radio static.",
        choices: [
            { text: "Bring them back to rest (morale loss)", short: "Bring them back", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Record the static and study it", short: "Record the static", riskMod: 40, reward: { type: 'ITEM', tags: ['LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'PRISM_SONG',
        trigger: (planet) => planet.type === 'CRYSTALLINE',
        title: "SHAKING CRYSTALS",
        desc: "The crystals here vibrate hard enough to shatter glass, and maybe bone.",
        choices: [
            { text: "Pad the lander's hull (energy cost)", short: "Pad the hull", riskMod: 10, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Record the sound up close", short: "Record it up close", riskMod: 30, reward: { type: 'ITEM', tags: ['ARTIFACT'] } }   // DRAFT: short
        ]
    },
    // --- ADDITIONAL EVA EVENTS ---
    {
        id: 'FUNGAL_BLOOM',
        trigger: (planet) => planet.type === 'FUNGAL' || (planet.metrics && planet.metrics.hasLife && Math.random() < 0.3),
        title: "GLOWING MUSHROOMS",
        desc: "The ground is covered in glowing mushrooms. Their spores make people see things that aren't there.",
        choices: [
            { text: "Go back to the lander", short: "Back to the lander", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Harvest some to study", short: "Harvest some to study", riskMod: 25, reward: { type: 'ITEM', tags: ['BIO', 'RATION'] } }   // DRAFT: short
        ]
    },
    {
        id: 'GRAVITY_WELL',
        trigger: (planet) => planet.metrics && planet.metrics.gravity > 1.2,
        title: "HEAVY GRAVITY",
        desc: "Gravity here just tripled. Equipment is being crushed, and the team can barely stand.",
        choices: [
            { text: "Pull the team out now", short: "Pull the team out", riskMod: 10, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Crawl to the target anyway", short: "Crawl to the target", riskMod: 45, reward: { type: 'ITEM', tags: ['GEO', 'ARTIFACT'] } }   // DRAFT: short
        ]
    },
    {
        id: 'DUST_STORM',
        trigger: (planet) => ['DESERT', 'ROCKY', 'TOXIC'].includes(planet.type),
        title: "DUST STORM",
        desc: "A huge dust storm is rolling in. The grit is wearing holes in the suits.",
        choices: [
            { text: "Take shelter and wait", short: "Shelter and wait", riskMod: 5, reward: { type: 'RESOURCE', val: 'METALS' } },   // DRAFT: short
            { text: "Push on through the storm", short: "Push through the storm", riskMod: 40, reward: { type: 'ITEM', tags: ['GEO'] } }   // DRAFT: short
        ]
    },
    {
        id: 'MASS_BURIAL',
        trigger: (planet) => planet.type === 'TOMB_WORLD' || (deepEnough() && Math.random() < 0.15),
        title: "GRAVES BELOW THE WRECK",
        desc: "There are rows of graves here, and a wrecked ship in orbit above them. The dates on the graves are older than the wreck.",
        choices: [
            { text: "Record the names and leave", short: "Record the names", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Dig one of them up", short: "Dig one up", riskMod: 35, reward: { type: 'ITEM', tags: ['LORE', 'ARTIFACT'] } }   // DRAFT: short
        ]
    },
    {
        id: 'ACID_RAIN',
        trigger: (planet) => planet.atmosphere === 'TOXIC' || planet.type === 'TOXIC',
        title: "ACID RAIN",
        desc: "It's raining acid. The outside of the lander is being eaten away as we stand here.",
        choices: [
            { text: "Call off the trip", short: "Call off the trip", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Grab what we can, fast", short: "Grab what we can", riskMod: 35, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }   // DRAFT: short
        ]
    },
    {
        id: 'MAGNETIC_STORM',
        trigger: (planet) => ['GAS_GIANT', 'SHATTERED'].includes(planet.type) || (deepEnough() && Math.random() < 0.2),
        title: "MAGNETIC STORM",
        desc: "A magnetic storm is burning out our electronics. The radio and navigation are both down.",
        choices: [
            { text: "Wait for it to pass", short: "Wait it out", riskMod: 10, reward: { type: 'RESOURCE', val: 'ENERGY' } },   // DRAFT: short
            { text: "Keep going without navigation", short: "Go on without navigation", riskMod: 50, reward: { type: 'ITEM', tags: ['TECH'] } }   // DRAFT: short
        ]
    },
    {
        id: 'CAVE_SYSTEM',
        trigger: (planet) => ['ROCKY', 'ICE_WORLD', 'HOLLOW'].includes(planet.type),
        title: "CAVES",
        desc: "Scans show huge caves under the surface. Something is moving around down there in the dark.",
        choices: [
            { text: "Stay on the surface", short: "Stay on the surface", riskMod: 5, reward: { type: 'RESOURCE', val: 'METALS' } },   // DRAFT: short
            { text: "Go deep into the caves", short: "Go into the caves", riskMod: 40, reward: { type: 'ITEM', tags: ['GEO', 'BIO'] } }   // DRAFT: short
        ]
    },
    {
        id: 'FROZEN_LAKE',
        trigger: (planet) => planet.type === 'ICE_WORLD' || planet.type === 'FROZEN_OCEAN',
        title: "UNDER THE ICE",
        desc: "Something is swimming under the frozen surface, circling the landing site.",
        choices: [
            { text: "Stay away from the edge", short: "Keep from the edge", riskMod: 5, reward: { type: 'RESOURCE', val: 'ENERGY' } },   // DRAFT: short
            { text: "Drop a camera through the ice", short: "Drop a camera in", riskMod: 30, reward: { type: 'ITEM', tags: ['BIO', 'LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'LIVING_METAL',
        trigger: (planet) => planet.type === 'MECHA' || planet.type === 'MACHINE_WORLD',
        title: "MOVING METAL",
        desc: "The ground here is metal, and it's moving. It's building something around the lander.",
        choices: [
            { text: "Leave before we're walled in", short: "Leave while we can", riskMod: 10, reward: { type: 'RESOURCE', val: 'METALS' } },   // DRAFT: short
            { text: "Let it finish building", short: "Let it finish", riskMod: 45, reward: { type: 'ITEM', tags: ['TECH', 'ARTIFACT'] } }   // DRAFT: short
        ]
    },
    {
        id: 'OLD_COLONY',
        trigger: (planet) => planet.tags && planet.tags.includes('FAILED_COLONY'),
        title: "THE SETTLEMENT",
        desc: "Human buildings, abandoned decades ago. The doors are still locked from the inside.",
        choices: [
            { text: "Strip metal from the outside walls", short: "Strip the outside walls", riskMod: 5, reward: { type: 'RESOURCE', val: 'METALS' } },   // DRAFT: short
            { text: "Break down a door", short: "Break down a door", riskMod: 25, reward: { type: 'ITEM', tags: ['LORE', 'RATION'] } }   // DRAFT: short
        ]
    },
    {
        id: 'RADIO_SILENCE',
        trigger: (planet) => deepEnough() && Math.random() < 0.2,
        title: "NO SIGNAL",
        desc: "The team has lost all radio contact with the ship. Something down here is blocking the signal.",
        choices: [
            { text: "Head back to the lander right away", short: "Head back now", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Find what's blocking the signal", short: "Find what's blocking it", riskMod: 50, reward: { type: 'ITEM', tags: ['TECH', 'ARTIFACT'] } }   // DRAFT: short
        ]
    },
    {
        id: 'PERFECT_SPHERE',
        trigger: (planet) => deepEnough() && Math.random() < 0.15,
        title: "THE SPHERE",
        desc: "A perfect sphere, 10 metres across, made of something we can't identify. It's warm, and it hums.",
        choices: [
            { text: "Photograph it and stay back", short: "Photograph it", riskMod: 0, reward: { type: 'DATA', val: 1 } },   // DRAFT: short
            { text: "Touch it", short: "Touch it", riskMod: 45, reward: { type: 'ITEM', tags: ['ARTIFACT', 'LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'GAS_POCKET',
        trigger: (planet) => planet.type === 'VOLCANIC' || planet.type === 'SULFUR',
        title: "POISON GAS",
        desc: "The ground is leaking poisonous gas. The suit filters won't last long.",
        choices: [
            { text: "Pull back now", short: "Pull back now", riskMod: 5, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Rush in and grab the ore", short: "Rush in for ore", riskMod: 35, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }   // DRAFT: short
        ]
    },
    {
        id: 'FOOTPRINTS',
        trigger: (planet) => deepEnough() && Math.random() < 0.1,
        title: "SOMEONE WAS HERE",
        desc: "There are human footprints in the dust, but no wreck and no bodies. The prints just stop.",
        choices: [
            { text: "Log them and leave", short: "Log them and leave", riskMod: 0, reward: { type: 'RESOURCE', val: 'NOTHING' } },   // DRAFT: short
            { text: "Follow the footprints", short: "Follow the footprints", riskMod: 40, reward: { type: 'ITEM', tags: ['LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'OLD_RUINS',
        trigger: () => false,   // never a plain landing's pick: the new look's "Old ruins" find (src/newscreen/WorldFinds.js) plays it
        title: "OLD RUINS",
        desc: "Walls and roofs, half buried in the dust. Nobody has lived here for a very long time.",
        choices: [
            { text: "Map the walls and leave", short: "Map the walls", riskMod: 5, reward: { type: 'DATA', val: 1 } },   // DRAFT: short
            { text: "Dig under the walls", short: "Dig under the walls", riskMod: 30, reward: { type: 'ITEM', tags: ['ARTIFACT', 'LORE'] } }   // DRAFT: short
        ]
    },
    {
        id: 'DISTRESS_BEACON', // Fallback — MUST BE LAST
        trigger: () => true,
        title: "DISTRESS CALL",
        desc: "A weak distress call keeps repeating from a field of wreckage.",
        choices: [
            { text: "Scan it from where we are", short: "Scan from here", riskMod: 0, reward: { type: 'DATA', val: 1 } },   // DRAFT: short
            { text: "Search through the wreckage", short: "Search the wreckage", riskMod: 20, reward: { type: 'RESOURCE', val: 'METALS_HIGH' } }   // DRAFT: short
        ]
    }
];

// The new look (?new=1) only. A world's own landing events, by its type: what a plain landing finds there first (App.landingEventOf
// picks one of these when its trigger holds, else today's pick). Types with none land on today's pick.
const KIND_EVENTS = {
    ROCKY: ['MINERAL_VEIN', 'CAVE_SYSTEM'], ICE_WORLD: ['FROZEN_LAKE', 'CRYSTAL_SPIRE'], DESERT: ['MIRAGE_VISION', 'MINERAL_VEIN'],
    SULFUR: ['GAS_POCKET'], ROGUE: ['VOID_WHISPERS'], BIO_MASS: ['BIO_SAMPLES'], SHATTERED: ['VOID_WHISPERS', 'MAGNETIC_STORM'],
    CRYSTALLINE: ['PRISM_SONG'], SINGING: ['THE_FREQUENCY'], MIRROR: ['THE_REFLECTION'], HOLLOW: ['INNER_WORLD'],
    OCEANIC: ['MIRAGE_VISION'], VOLCANIC: ['TECTONIC_SHIFT', 'GAS_POCKET', 'MINERAL_VEIN'], TOXIC: ['ACID_RAIN'],
    VITAL: ['BIO_HORROR', 'HIVE_MIND'], SYMBIOTE_WORLD: ['SYMBIOTE_EMBRACE'], FUNGAL: ['FUNGAL_BLOOM'], FROZEN_OCEAN: ['FROZEN_LAKE'],
    MECHA: ['MECHA_SALVAGE', 'LIVING_METAL'], MACHINE_WORLD: ['LIVING_METAL'], GRAVEYARD: ['SHIP_GRAVEYARD'], TOMB_WORLD: ['MASS_BURIAL'],
    TIDALLY_LOCKED: ['TERMINATOR_WALK'],
};
// The new look only. A world's one feature, as a second place to go: old ruins, an old signal (one of our beacons), life, machines.
// The first event of the list that is not already the world's own landing event is played there.
const FEATURE_EVENTS = {
    ruins: ['OLD_RUINS'],
    signal: ['DERELICT', 'ROGUE_AI'],
    life: ['BIO_HORROR', 'FUNGAL_BLOOM'],
    machines: ['MECHA_SALVAGE', 'LIVING_METAL'],
};
if (typeof window !== 'undefined') Object.assign(window, { KIND_EVENTS, FEATURE_EVENTS });
