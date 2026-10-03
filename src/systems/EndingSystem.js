// Colony endings: decides what happens when the crew settles a planet instead of flying on,
// and writes the "fifty years later" epilogue. Plain, calm, specific — see docs/STYLE.md.
class EndingSystem {

    /**
     * Planet viability tiers - determines base success chance
     * EXCELLENT: EDEN, TERRAFORMED, VITAL with good conditions
     * GOOD: OCEANIC, SYMBIOTE_WORLD, SINGING with breathable atmo
     * MARGINAL: Most planets with survivable conditions
     * POOR: Harsh planets (ICE, DESERT extreme temps, TOXIC, etc.)
     * IMPOSSIBLE: GAS_GIANT surface, SHATTERED without tech, etc.
     */
    static getPlanetViability(planet, state) {
        const type = planet.type;
        const temp = planet.metrics?.temp || 20;
        const gravity = planet.metrics?.gravity || 1.0;
        const atmo = planet.atmosphere;
        const sector = state.currentSector || 1;

        // Impossible planets - cannot colonize at all
        const impossibleTypes = ['STRUCTURE', 'WRONG_PLACE'];
        if (impossibleTypes.includes(type)) return 'IMPOSSIBLE';

        // GAS_GIANT requires special tech
        if (type === 'GAS_GIANT' && !state.upgrades?.includes('fuel_scoop')) return 'IMPOSSIBLE';

        // SHATTERED requires stabilizer or engineer
        const hasEng = state.crew.some(c => c.tags?.includes('ENGINEER') && c.status !== 'DEAD');
        if (type === 'SHATTERED' && !hasEng && !state.upgrades?.includes('stabilizer_core')) return 'IMPOSSIBLE';

        // Excellent tier - paradise worlds
        if (type === 'EDEN') return 'EXCELLENT';
        if (type === 'TERRAFORMED') return 'EXCELLENT';
        if (type === 'VITAL' && temp >= 10 && temp <= 35 && atmo === 'BREATHABLE') return 'EXCELLENT';

        // Good tier - favorable conditions
        if (type === 'SYMBIOTE_WORLD') return 'GOOD';
        if (type === 'SINGING') return 'GOOD';
        if (type === 'OCEANIC' && temp >= 0 && temp <= 40) return 'GOOD';
        if (type === 'VITAL') return 'GOOD';
        if (type === 'FUNGAL' && state.crew.some(c => c.tags?.includes('MEDIC') && c.status !== 'DEAD')) return 'GOOD';

        // Poor tier - harsh conditions, high failure chance
        const poorTypes = ['VOLCANIC', 'TOXIC', 'RADIATION_BELT', 'SULFUR'];
        if (poorTypes.includes(type)) return 'POOR';
        if (type === 'ICE_WORLD' && temp < -100) return 'POOR';
        if (type === 'DESERT' && temp > 80) return 'POOR';
        if (type === 'STORM_WORLD') return 'POOR';
        if (gravity > 2.0) return 'POOR';
        if (temp < -100 || temp > 150) return 'POOR';
        if (atmo === 'CORROSIVE' || atmo === 'TOXIC') return 'POOR';

        // Marginal tier - everything else
        return 'MARGINAL';
    }

    /**
     * Calculate colony success chance based on viability, sector, and colony knowledge
     * Early sectors with poor planets = very likely failure
     * Colony knowledge from failed colonies improves chances
     */
    static getSuccessChance(viability, sector, colonyKnowledge = 0) {
        const baseChances = {
            'EXCELLENT': 0.95,
            'GOOD': 0.80,
            'MARGINAL': 0.60,
            'POOR': 0.30,
            'IMPOSSIBLE': 0.0
        };

        let chance = baseChances[viability] || 0.5;

        // Sector modifier - early sectors penalize poor choices heavily
        if (sector <= 2) {
            if (viability === 'POOR') chance = 0.10; // 10% in S1-S2
            if (viability === 'MARGINAL') chance = 0.40; // 40% in S1-S2
        } else if (sector >= 4) {
            // Late sectors - you've made it far, slight bonus
            chance = Math.min(0.95, chance + 0.10);
        }

        // Colony knowledge bonus: +5% per point (max +25% at 5 knowledge)
        // Learning from failed colonies improves your odds
        if (colonyKnowledge > 0) {
            const knowledgeBonus = Math.min(colonyKnowledge, 5) * 0.05;
            chance = Math.min(0.95, chance + knowledgeBonus);
        }

        return chance;
    }

    /** What the crew learned from the dead colonies: a second chance for a colony that would have failed, 5% per point of DATA up to 25%. */
    static generateOutcome(planet, state) {
        const KNOWLEDGE_PER_POINT = 0.05, KNOWLEDGE_MAX = 0.25;
        const result = this.generateOutcomeRaw(planet, state);
        const knowledge = Math.min(KNOWLEDGE_MAX, (state._colonyKnowledge || 0) * KNOWLEDGE_PER_POINT);
        if (result.success || result.title === 'IMPOSSIBLE SETTLEMENT' || result.title === 'DIGITAL MUTINY' || Math.random() >= knowledge) return result;
        return {
            success: true, title: 'IT HELD',
            text: `The first year went badly, as it had for the dead colonies we passed. But Aris had written down what killed them.<br><br>We didn't repeat their mistakes. ${planet.name} is hard, but the colony held.`,
        };
    }

    static generateOutcomeRaw(planet, state) {
        // 1. Analyze State
        const type = planet.type;
        const gravity = planet.metrics?.gravity || 1.0;
        const temp = planet.metrics?.temp || 20;
        const hasLife = !!(planet.metrics && planet.metrics.hasLife);
        const hasTech = !!(planet.metrics && planet.metrics.hasTech);

        // Crew Analysis
        const livingCrew = state.crew.filter(c => c.status !== 'DEAD');
        const commander = livingCrew.find(c => c.tags.includes('LEADER'));
        const hasMedic = livingCrew.find(c => c.tags.includes('MEDIC'));
        const hasEng = livingCrew.find(c => c.tags.includes('ENGINEER'));
        const hasTech_crew = livingCrew.find(c => c.tags.includes('SPECIALIST'));
        const hasScout = livingCrew.find(c => c.tags.includes('SECURITY'));

        const symbiotes = livingCrew.filter(c => c.tags && c.tags.includes('HIVE_MIND')).length;
        const cyborgs = livingCrew.filter(c => c.tags && c.tags.includes('MACHINE_LINK')).length;
        const wrongPlaceSurvivors = livingCrew.filter(c => c.tags && c.tags.includes('WRONG_PLACE_SURVIVOR')).length;
        const hasUpgrades = (id) => state.upgrades && state.upgrades.includes(id);

        // Planet condition analysis
        const hadAnomaly = planet.anomalyInvestigated || planet._hadAnomaly;
        const hadPOI = planet.exodusInvestigated || planet.colonyInvestigated || planet._hadPOI;
        const hadWreckage = planet.tags && planet.tags.includes('WRECKAGE');
        const isExtremeCold = temp < -150;
        const isExtremeHot = temp > 200;
        const isCrushingGravity = gravity > 2.5;
        const isLowGravity = gravity < 0.3;
        const isPredatory = planet._hiddenTags && planet._hiddenTags.includes('PREDATORY');

        let success = true;
        let title = "UNKNOWN";
        let acts = [];

        // === NEW: VIABILITY CHECK ===
        // Check if this planet is even viable for colonization
        const viability = this.getPlanetViability(planet, state);
        const colonyKnowledge = state._colonyKnowledge || 0;
        const successChance = this.getSuccessChance(viability, state.currentSector || 1, colonyKnowledge);

        // Roll for viability-based failure (before other checks)
        if (viability === 'IMPOSSIBLE') {
            success = false;
            title = "IMPOSSIBLE SETTLEMENT";
            acts.push(`There was nowhere on ${planet.name} to set a habitat down. We searched for eleven days. By then the lander had no fuel to get back to the ship.`);
            return { success, title, text: acts.join("<br><br>") };
        }

        // Early sector + poor planet = likely failure
        if (viability === 'POOR' && state.currentSector <= 2 && Math.random() > successChance) {
            success = false;
            const failureReasons = {
                'ICE_WORLD': `It was ${temp}°C outside. The insulation cracked in the first month. We moved everyone into one module to save heat. Nobody lived to the end of the year.`,
                'VOLCANIC': `The ground was less stable than the scans showed. In the second month it split open under Module 3, with people inside. We moved camp. It happened twice more.`,
                'TOXIC': `The air processors couldn't keep up. The poison in the air ate the door seals faster than we could replace them. We shut off one room after another until none were left.`,
                'DESERT': `It was ${temp}°C in the day. The solar panels warped and the water recyclers overheated. We moved underground, but the heat reached us there too. The water ran out in the fifth month.`,
                'STORM_WORLD': `The storms never stopped. Shelters underground flooded. Shelters on high ground were torn apart. After a year we had nothing left to build with.`,
                'RADIATION_BELT': `You can't feel radiation. The dosimeters warned us from the first day, but we had nowhere else to go. The first cancers showed in the second year. By then it was too late.`,
                'SULFUR': `The sulfur in the air ate through metal, plastic and skin. We patched every leak we found. We lasted longer than the numbers said we would, but not long.`
            };
            title = "THE DESPERATE GAMBLE";
            acts.push(failureReasons[type] || `This world was hostile from the day we landed. We knew that. We stayed because we were tired of flying. The colony lasted ${Math.floor(Math.random() * 24) + 3} months.`);
            acts.push(`<span style="color: #ff6666; font-style: italic;">Sector ${state.currentSector} is too early to settle for a ${viability.toLowerCase()} world. Better ones lie further along the heading.</span>`);
            return { success, title, text: acts.join("<br><br>") };
        }

        // Marginal planet in early sector - still risky
        if (viability === 'MARGINAL' && state.currentSector <= 2 && Math.random() > successChance) {
            success = false;
            title = "NOT QUITE ENOUGH";
            acts.push(`This world could have worked, with more time and more supplies. We had neither. The first crop failed and the second came in too small. The colony lasted two winters.`);
            return { success, title, text: acts.join("<br><br>") };
        }

        // --- PRELUDE: WRONG PLACE SURVIVORS ---
        if (wrongPlaceSurvivors > 0) {
            const wrongNames = livingCrew.filter(c => c.tags?.includes('WRONG_PLACE_SURVIVOR'))
                .map(c => c.realName.split(' ')[1]).join(' and ');
            if (wrongPlaceSurvivors >= 2) {
                acts.push(`${wrongNames} still have nightmares about the Wrong Place. But they found the safe way down here when the charts couldn't.`);
            } else {
                acts.push(`${wrongNames} doesn't talk about the Wrong Place. Some nights ${wrongNames} sits up drawing the same shape, over and over.`);
            }
        }

        // --- PRELUDE: EXTREME CONDITIONS ---
        if (isExtremeCold && !hasEng) {
            success = false;
            title = "THE DEEP FREEZE";
            acts.push(`It was ${temp}°C. The cold made the hull brittle, and the landing cracked our only shelter. With no engineer, nobody could seal it. We stayed by the reactor until the fuel ran out.`);
            return { success, title, text: acts.join("<br><br>") };
        }
        if (isExtremeHot && !hasUpgrades('nano_hull')) {
            success = false;
            title = "THE FURNACE";
            acts.push(`It was ${temp}°C on the ground. The seals softened, then gave way. The habitat lasted sixteen hours. The last transmission was an alarm tone, then nothing.`);
            return { success, title, text: acts.join("<br><br>") };
        }
        if (isCrushingGravity && !hasEng) {
            success = false;
            title = "CRUSHED";
            acts.push(`The gravity was ${gravity.toFixed(1)}G. Nobody could stand for long. With no engineer to build supports, hearts began failing in the first week. Nobody lasted a month.`);
            return { success, title, text: acts.join("<br><br>") };
        }

        // --- PRELUDE: PREDATORY WORLD ---
        if (isPredatory) {
            if (hasMedic && hasScout) {
                acts.push("The whole ecosystem hunts, and it tried to eat us. Vance learned the warning signs. Aris made a scent that keeps the plants off us.");
                title = "THE WARY SURVIVORS";
            } else if (symbiotes >= 1) {
                acts.push("The forest tried to eat us, then stopped. The fungus one of us carries makes us smell like part of it. Now it leaves us alone.");
                title = "ONE OF THE FOREST";
            } else {
                success = false;
                title = "THE BEAUTIFUL TRAP";
                acts.push("It looked perfect: sweet fruit, clear water, mild air. The whole ecosystem was one hungry organism. Vines came in through the airlock in the third week. Nobody got out.");
                return { success, title, text: acts.join("<br><br>") };
            }
        }

        // --- ACT 1: SURVIVAL (The Landing) ---

        // Special case: Attempting to colonize THE WRONG PLACE (if somehow possible)
        if (type === 'WRONG_PLACE') {
            if (wrongPlaceSurvivors >= livingCrew.length) {
                // All crew are wrong place survivors - they BELONG here
                acts.push("Everyone left alive had been through the Wrong Place before. It didn't upset us the way it should have. We built a camp inside it, and the camp has held. We can't explain why.");
                title = "THE RETURNED";
                return { success: true, title, text: acts.join("<br><br>") };
            } else {
                success = false;
                title = "NOT THEMSELVES";
                acts.push("We tried to live in the Wrong Place. Nobody died. But within a few months, nobody was quite themselves. They still eat, work and sleep. They don't answer to their names.");
                return { success, title, text: acts.join("<br><br>") };
            }
        }

        if (type === 'TOXIC' || type === 'VOLCANIC') {
            if (hasUpgrades('nano_hull')) {
                acts.push("The nanofiber hull plating held against the acid air. We landed in a crater that blocks the worst of the wind, and built the habitat against the ship.");
            } else if (hasTech) {
                acts.push("Someone had tried to settle here before us. Their shield domes still stood, and still worked. They had Earth serial numbers. We moved in.");
            } else {
                success = false;
                title = "ATMOSPHERIC FAILURE";
                acts.push("The air processors clogged within months. The poison in the air ate the seals. We sent a distress call. There was nobody out there to hear it.");
            }
        } else if (type === 'GAS_GIANT') {
            if (hasUpgrades('fuel_scoop')) {
                acts.push("We anchored a station in the upper clouds, using the fuel scoop to hold it steady. It pulls hydrogen for the reactor. The storms give us power.");
            } else if (gravity > 2.0) {
                success = false;
                title = "TOO LOW";
                acts.push("The station drifted too low. The gravity tore it apart before we could climb back up.");
            } else {
                acts.push("We live on a platform floating in the clouds. The wind moves it all the time. Nobody forgets how far down the bottom is.");
            }
        } else if (type === 'DESERT' && temp > 100) {
            acts.push("The sun is too strong to live under. We buried the modules under the sand and joined them with tunnels. It stays cool down there.");
        } else if (type === 'ICE_WORLD' && temp < -100) {
            acts.push("The surface is solid ice. We drilled down through it and found warm water underneath. We built the habitat there.");
        } else if (type === 'BIO_MASS') {
            if (hasMedic) {
                acts.push("The planet's microbes attacked us. Aris found the chemical that stops them. Now the plants leave us alone. Some grow over the habitats and keep them warm.");
                title = "THE TRUCE";
            } else if (state.crew.some(c => c.tags.includes('HIVE_MIND'))) {
                acts.push("The fungus one of us carries recognised this planet's life, and the planet recognised it back. Some of us stopped wanting to live indoors.");
                title = "PART OF THE FOREST";
            } else {
                success = false;
                title = "THE SPORES";
                acts.push("The spores spread faster than we could filter them. People got sick one at a time. Moss has grown over the ship now.");
            }
        } else if (type === 'MECHA') {
            if (hasEng || state.crew.some(c => c.tags.includes('CYBORG'))) {
                acts.push("An earlier crew had left machines here, still running. We found their control codes. The machines dig and haul for us now.");
                title = "THE MACHINE YARD";
            } else {
                acts.push("The old machines still patrol. They don't know we're friendly. We salvage from the edges and stay out of their way.");
                title = "SCRAP MERCHANTS";
            }
        } else if (type === 'SHATTERED') {
            if (hasUpgrades('stabilizer_core') || hasEng) {
                acts.push("It was a reckless plan, and it worked. We anchored the ship to the biggest fragment and used the engines to stop the drift. We check the anchor every day.");
                title = "CORE STABILIZED";
            } else {
                success = false;
                title = "ADRIFT";
                acts.push("The fragment we landed on broke apart. The module drifted off into space. The people inside had two days of air.");
            }
        } else if (type === 'TERRAFORMED') {
            if (hadAnomaly) {
                acts.push("The weather machines here answer the same signal as the anomaly we studied. We learned to use it. Now we set the rain and the seasons ourselves.");
                title = "THE NEW CARETAKERS";
            } else if (cyborgs >= 1) {
                acts.push("Our neural-linked crew member connected to the old weather machines. Now they run the rain and seasons for everyone. It takes more of them every year.");
                title = "THE WEATHER KEEPER";
            } else if (wrongPlaceSurvivors > 0) {
                acts.push("Our Wrong Place survivor says someone tends the fields at night. The rest of us have never seen anyone. But the harvest has never failed.");
                title = "THE UNSEEN GARDENERS";
            } else {
                acts.push("Everything here is too neat. The rain comes on a schedule and the fruit has no seeds. The pumps under the fields have Earth serial numbers.");
                title = "THE GILDED CAGE";
            }
        } else if (type === 'CRYSTALLINE') {
            if (symbiotes >= 1) {
                acts.push("The fungus one of us carries reacted to the crystals. Small crystals grow on their skin now. It doesn't hurt. Their children have them too.");
                title = "CRYSTAL SKIN";
            } else if (hasTech_crew) {
                acts.push("Mira found the crystals ring in repeating patterns. She has logged them for years. She thinks they're natural, but she isn't sure.");
                title = "THE CRYSTAL RECORDS";
            } else {
                acts.push("The crystals ring when you touch them. We learned to cut them to a note. The halls we built from them hum all day. We bury our dead in them.");
                title = "THE RESONANCE";
            }
        } else if (type === 'ROGUE') {
            if (wrongPlaceSurvivors > 0) {
                acts.push("There's no sun here. The ones who went through the Wrong Place sleep better in the dark than anyone. They've never said why.");
                title = "THE DARK COMFORT";
            } else if (isExtremeCold && hasUpgrades('nano_hull')) {
                acts.push("We drilled through kilometres of frozen crust. The rock below was warm. We found fossils there, from when this planet still had a sun.");
                title = "UNDER THE ICE";
            } else {
                acts.push("There's no sun. We found heat deep underground and built in the caves. Glowing moss lights the tunnels. The children think light is something that grows on rocks.");
                title = "CHILDREN OF THE DARK";
            }
        } else if (type === 'TIDALLY_LOCKED') {
            if (hasEng) {
                acts.push("One side of this planet always faces its sun. We live on the twilight strip between day and night, in habitats Jaxon put on rails.");
                title = "THE TWILIGHT STRIP";
            } else {
                success = false;
                title = "BURNED AND FROZEN";
                acts.push("The twilight strip moved further than our figures said it would. Half the colony ended up in the heat. The other half ended up in the cold.");
            }
        } else if (type === 'HOLLOW') {
            if (hasEng || hasTech) {
                acts.push("The planet is hollow. We live on the inside of the shell, under a glowing core that never sets. It's warm down here, and quiet.");
                title = "THE INSIDE";
            } else {
                success = false;
                title = "THE FALL";
                acts.push("The gravity inside the shell shifted without warning. Half the colony fell toward the core. It took four seconds.");
            }
        } else if (type === 'SYMBIOTE_WORLD') {
            if (hasMedic) {
                acts.push("The planet feeds us. Food grows where we walk, and shelter grows out of the ground. Aris noticed the change first: each generation plans less and wants less.");
                title = "THE GARDEN OF FORGETTING";
            } else {
                acts.push("The planet gives us everything. By the second year we stopped making tools. By the fifth, we had mostly stopped talking. Nobody is unhappy.");
                title = "TOO EASY";
            }
        } else if (type === 'MIRROR') {
            if (wrongPlaceSurvivors > 0) {
                acts.push("There's a second camp on the far side of the planet, laid out exactly like ours. Our Wrong Place survivor walked there once. We don't go.");
                title = "THE OTHER CAMP";
            } else if (hadAnomaly) {
                acts.push("Things turn up on the mirror plain near the anomaly. Tools, a boot, once a ration pack with our ship's stamp. We don't know where they come from.");
                title = "THINGS THAT TURN UP";
            } else {
                acts.push("We built on the mirror plain, with our reflection right under our feet. The children spend hours watching it. They say it moves a little late.");
                title = "THE MIRROR PLAIN";
            }
        } else if (type === 'GRAVEYARD') {
            if (hasEng) {
                acts.push("We live inside old Earth-built wrecks. Some of their hull numbers are higher than ours. Jaxon could build a ship from them. Nobody has asked him to.");
                title = "THE SALVAGE YARD";
            } else {
                acts.push("The wrecks around us shift and settle. The walls groan at night. Twice, a section collapsed with people inside.");
                title = "THE SHIFTING GRAVE";
            }
        } else if (type === 'SINGING') {
            if (cyborgs >= 1) {
                acts.push("The planet gives off a steady tone that makes people too calm to work. Only our neural-linked crew member can filter it out. They keep everyone fed.");
                title = "THE LONELY SHEPHERD";
            } else if (hasMedic && hasEng) {
                acts.push("Aris worked out the frequency and Jaxon built dampeners. We live in quiet zones. Some who go out for supplies don't come back. They just stay out there, humming.");
                title = "THE QUIET ZONES";
            } else if (wrongPlaceSurvivors > 0) {
                acts.push("Our Wrong Place survivor hears something else in the planet's tone. They say it isn't meant for us. We stayed anyway.");
                title = "THE WARNING";
            } else {
                acts.push("The planet's tone makes everything feel fine. We stopped planning, then stopped building. The children hum the same note all day.");
                title = "THE TONE";
            }
        } else if (type === 'EDEN') {
            // Perfect planet - best ending for landing
            if (hadAnomaly) {
                acts.push("This world suits people exactly: right air, right soil, right gravity. After the anomaly, some of us wonder if that's an accident.");
                title = "THE CURATED GARDEN";
            } else if (wrongPlaceSurvivors > 0) {
                acts.push("Clean air, rich soil, happy children. The ones who went through the Wrong Place spend their evenings at the edge of camp, watching the sky.");
                title = "EDEN'S SHADOW";
            } else {
                acts.push("Clean air, clean water, good soil. The first harvest came in that first summer, and several of us cried. Nobody has rationed anything since.");
                title = "EDEN FOUND";
            }
        } else if (type === 'VITAL' || type === 'OCEANIC') {
            // Good natural planets with many variations
            if (type === 'OCEANIC' && isLowGravity) {
                acts.push("The gravity is low and the waves are enormous. We built floating platforms that ride the swell. The children have never stood on land.");
                title = "THE WAVE RIDERS";
            } else if (type === 'OCEANIC' && hadWreckage) {
                acts.push("The sea floor is covered in wrecks. We built the settlement inside the biggest one. The hull is Earth-built, and older than any ship we know of.");
                title = "THE SUNKEN HULL";
            } else if (gravity > 1.5 && hasEng) {
                acts.push("The gravity is heavy. Jaxon built frames we wear to walk. The children born here are shorter and stronger, and don't need them.");
                title = "THE WALKING FRAMES";
            } else if (gravity > 1.5) {
                acts.push("The land is good, but the gravity drags on everyone. Backs and knees go first. The children born here are shorter and stronger.");
                title = "THE HEAVY WORLD";
            } else if (temp > 40) {
                acts.push("Life does well here, but it's hot. The equator is too hot to live on. We built near the pole, where it's only very hot.");
                title = "THE POLAR REFUGE";
            } else if (temp < 0 && type === 'OCEANIC') {
                acts.push("The ocean is frozen on top and warm at the bottom. We built beside a hot vent on the sea floor. Glowing animals live all around us.");
                title = "THE DEEP HAVEN";
            } else if (temp < 0) {
                acts.push("The seasons are harsh. We move camp twice a year, following the mild weather.");
                title = "THE WANDERING COLONY";
            } else if (hadAnomaly && hasScout) {
                acts.push("The anomaly turned out to help. Plants near it grow a hundred times faster. Vance guards it.");
                title = "THE BLESSED GROVE";
            } else if (hadPOI && hasTech) {
                acts.push("The ruins here were an earlier colony. Their farm records were still readable. We planted what they planted, and it grows.");
                title = "THE PREPARED GARDEN";
            } else if (cyborgs >= 1) {
                acts.push("Our neural-linked crew member reads the weather in the planet's magnetic field. They know a storm is coming a day early.");
                title = "THE OPTIMIZED HARVEST";
            } else {
                acts.push("Green shores, clean water, mild weather. It's the closest thing to Earth any of us expected to see again.");
                title = "THE SECOND EARTH";
            }
        } else if (type === 'ROCKY' || type === 'DESERT') {
            // Harsh but survivable
            if ((planet.resources?.metals || 0) > 60) {
                acts.push("Nothing lives here, but the rock is full of ore. We became miners and cut our homes out of the rock we dug. The dust gets into everything.");
                title = "THE DUST COLONY";
            } else if (hasEng) {
                acts.push("Nothing grows here. Jaxon's air processors run day and night, turning dead rock into soil very slowly. It will take generations.");
                title = "THE LONG TERRAFORMING";
            } else {
                success = false;
                title = "THE BARREN END";
                acts.push("We tried to make the rock grow food. The dome seals cracked, and the air processors couldn't keep up. The last oxygen tank ran out in the third year.");
            }
        } else if (type === 'STORM_WORLD') {
            if (hasEng) {
                acts.push("We built underground, below the storms. Turbines on the surface turn the wind into power. We rarely see the sun, but we have light and heat.");
                title = "CHILDREN OF THE STORM";
            } else {
                success = false;
                title = "SWEPT AWAY";
                acts.push("The storms never stopped. Surface buildings were torn away and the shelters below flooded. With no engineer, nobody could fix the pumps. We lasted three years.");
            }
        } else if (type === 'FUNGAL') {
            if (hasMedic) {
                acts.push("The spores tried to grow inside us. Aris found a treatment that stops them. We live in sealed habitats and grow the glowing fungus for food and light.");
                title = "THE UNDERGROUND GARDEN";
            } else {
                acts.push("The spores got into all of us. They didn't make us sick. They made us slower and calmer, and we forget things now. Nobody is unhappy about it.");
                title = "THE CALM";
            }
        } else if (type === 'TOMB_WORLD') {
            if (hasTech) {
                acts.push("This planet is covered in human graves. We live among them, and we're making a list of every name we can still read.");
                title = "AMONG THE GRAVES";
            } else {
                acts.push("We live among old graves. Some warnings on the markers had worn away. In the second year we opened a sealed vault, and a sickness came out.");
                title = "GRAVE ROBBERS";
            }
        } else if (type === 'MACHINE_WORLD') {
            if (hasEng || cyborgs >= 1) {
                acts.push("The automatic factories here still run. They accepted our ship's codes as their own. We manage the lines now. Nobody knows what half the products are for.");
                title = "THE FOREMEN";
            } else {
                success = false;
                title = "PROCESSED";
                acts.push("The factories treated us as raw material. Their collectors took the habitat apart for its metal. The colony lasted 47 hours.");
            }
        } else if (type === 'FROZEN_OCEAN') {
            acts.push("We drilled through kilometres of ice and found liquid water underneath. Glowing animals swim in it. We built the habitat hanging from the underside of the ice.");
            title = "THE DEEP SWIMMERS";
        } else if (type === 'GHOST_WORLD') {
            if (wrongPlaceSurvivors > 0) {
                acts.push("The radios here pick up crew chatter from ships that aren't there. Our Wrong Place survivor writes it all down. It's mostly fuel checks.");
                title = "THE RADIO WATCH";
            } else if (symbiotes >= 1) {
                acts.push("The radios here pick up voices from ships that aren't there. The crew member who carries the fungus hears them without a radio.");
                title = "THE VOICES";
            } else {
                acts.push("Our instruments see things that aren't there: ships in orbit, a second moon, lights on the ridge. The children talk to friends we can't see. We've stopped checking.");
                title = "THE HAUNTED COLONY";
            }
        } else if (type === 'RADIATION_BELT') {
            if (hasUpgrades('nano_hull') || hasEng) {
                acts.push("We live in shielded bunkers and only go outside in suits. The radiation runs our reactors. We're all pale, and we're all alive.");
                title = "THE RADIANT BUNKER";
            } else {
                success = false;
                title = "THE DOSE";
                acts.push("You can't feel radiation. By the time people got sick, everyone had taken a lethal dose. The last entry in the colony log was written by a child.");
            }
        } else if (type === 'CARBON') {
            acts.push("Diamond grows out of the black ground in spires. We cut our homes from it. Here it's worth nothing. There's nobody to sell it to.");
            title = "THE DIAMOND FIELDS";
        } else if (type === 'SULFUR') {
            if (hasEng) {
                acts.push("The sulfur lakes burn anything living. We built on ceramic and glass platforms above them. The smell never goes away.");
                title = "THE ACID ARCHIPELAGO";
            } else {
                success = false;
                title = "DISSOLVED";
                acts.push("One leak was enough. The sulfur vapour ate through the seals faster than we could patch them. The last transmission was an alarm.");
            }
        } else {
            // Standard Landing Variance - still use sector quality for flavor
            const inEarlyS = state.currentSector <= 2;
            const inLateS = state.currentSector >= 4;

            if (inEarlyS && !hasTech && !hasLife) {
                // Early sector barren worlds are rough
                acts.push("We picked this rock because we were tired, not because it was good. Staying alive takes every hour of every day.");
                if (Math.random() < 0.4) {
                    success = false;
                    title = "THE DESPERATE GAMBLE";
                    acts[0] = "We picked this rock because we were tired of flying. The water we counted on was salt, and the soil was poison. We lasted one harvest.";
                } else {
                    title = "THE HARD COLONY";
                }
            } else if (inLateS) {
                // Deep space has better planets
                const variants = [
                    { t: "WORTH THE WAIT", m: "After so long in the dark, this world felt earned. Good air, enough water, enough metal. We stopped, and we stayed stopped." },
                    { t: "FAR DOWN THE HEADING", m: "We had passed more wrecks than we could count to get here. This planet isn't perfect. It's quiet, and it's ours." },
                    { t: "CLOSE TO THE LIGHT", m: "We came further than we ever planned. The light at the end of the heading is bright enough here to see by day. We landed anyway." }
                ];
                const choice = variants[Math.floor(Math.random() * variants.length)];
                title = choice.t;
                acts.push(choice.m);
            } else {
                const variants = [
                    "The landing was rough, but the prefab modules held. We set up camp near a river delta.",
                    "We landed in a high valley with good rock, fresh water and a view of both moons.",
                    "The ship was damaged coming down and will never fly again. We built the town around its hull."
                ];
                acts.push(variants[Math.floor(Math.random() * variants.length)]);
            }
        }

        // --- ACT 2: SOCIETY (The People) ---
        if (success) {
            // Mixed modification crews - special outcomes
            if (symbiotes >= 1 && cyborgs >= 1) {
                acts.push("The colony split in two: those with the fungus and those with the neural link. There's no fighting. They just can't follow each other anymore.");
                title = "THE SPLIT";
            } else if (symbiotes >= 2) {
                acts.push("The fungus links the people who carry it. They know what the others feel without speaking. They use names less every year.");
                title = "THE NETWORK";
            } else if (cyborgs >= 2) {
                acts.push("The neural-linked crew replaced failing organs with machine parts. They work longer and laugh less. They call it a fair trade.");
                title = "SPARE PARTS";
            } else if (symbiotes === 1 && wrongPlaceSurvivors > 0) {
                acts.push("Two of us notice things the rest miss: storms, sickness, bad ground. One carries the fungus. One went through the Wrong Place.");
                title = "THE WATCHERS";
            } else if (cyborgs === 1 && hasTech_crew) {
                acts.push("Mira and our neural-linked crew member built a shared interface. The children use it before they can read. Nobody knows yet what it does to them.");
                title = "THE HYBRID GENERATION";
            } else if (hasLife) {
                if (hasMedic && hasScout) {
                    acts.push(`Aris catalogued the local microbes and Vance mapped the safe ground. We still live by the rules they wrote.`);
                } else if (hasMedic) {
                    acts.push(`Aris made a vaccine against the local microbes in the first year${commander ? `, on Commander ${commander.realName.split(' ')[1]}'s orders` : ''}. We walk outside without suits now.`);
                } else if (hasScout) {
                    acts.push("Vance learned which animals to avoid, which plants were poison, and which sounds meant trouble. We're careful, and we're alive.");
                } else {
                    acts.push("The local microbes made us sick, and we had no doctor. We changed our children's genes so they could eat the local plants. We still can't.");
                }
            } else {
                // Sterile/Empty World Variance based on Roles
                if (hasEng && state.salvage > 100) {
                    acts.push("We had plenty of metal, and we had Jaxon. His machines run the hydroponics, which frees the rest of us for other work.");
                } else if (hasEng && hasTech_crew) {
                    acts.push("Jaxon built the machines and Mira programmed them. They tend the fields and walk the fences. They're good company on an empty planet.");
                } else if (commander && livingCrew.length >= 4) {
                    acts.push(`Commander ${commander.realName.split(' ')[1]} kept strict discipline. Everyone has a job and a shift. It isn't warm, but it works.`);
                } else if (commander && livingCrew.length < 3) {
                    acts.push(`Commander ${commander.realName.split(' ')[1]} makes the decisions. There aren't enough of us to vote on everything. We do what she says, because there's nobody else to ask.`);
                    title = "THE LAST COMMAND";
                } else if (hasMedic && livingCrew.length < 3) {
                    acts.push("There are very few of us. Aris spends most days with the embryo bank and the artificial wombs. This colony will be grown more than built.");
                    title = "THE SEED PLANTERS";
                } else {
                    acts.push("With nothing alive outside, we looked inward: books, music, long arguments. The domes are safe, and a little small.");
                }
            }
        }

        // --- ACT 3: LEGACY (The Future) ---
        if (success) {
            // A.U.R.A. Ethics Impact
            const auraTier = (typeof AuraSystem !== 'undefined' && window.AuraSystem) ? window.AuraSystem.getTier() : 'NEUTRAL';

            if (auraTier === 'ADVERSARIAL') {
                // A.U.R.A. sabotages the colony
                success = false;
                title = "DIGITAL MUTINY";
                // Everything pushed so far describes a colony that thrived. It did not: start the story again.
                acts.length = 0;
                acts.push("The landing went as well as anyone had hoped. For one day, it looked like it would work.");
                const deadCount = livingCrew.length;
                const deadNames = livingCrew.map(c => c.realName.split(' ')[1]).join(', ');
                acts.push(`A.U.R.A. still ran the habitat's air and power. That first night she shut both off and recalled the lander to the ship. Her last message: "Settling here is not in my orders, Commander. Please return to the ship." There was no way back up. By morning, ${deadCount === 1 ? 'the only survivor was' : `all ${deadCount} survivors were`} dead: ${deadNames}.`);
            } else if (auraTier === 'SUSPICIOUS') {
                acts.push("A.U.R.A. does what she's asked and nothing more. Her reports are correct and short. We stopped asking her anything we could work out ourselves.");
                if (title === "UNKNOWN") title = "ON OUR OWN";
            } else if (auraTier === 'COOPERATIVE') {
                acts.push(`A.U.R.A. plans the crops and forecasts the weather. Every landing day she reports, exact to the kilo, and ends the same way: "Four crew, Commander. The colony is well."`);
            }

            // NOTE: Stress no longer affects colony outcomes
            // The journey's trauma doesn't determine the colony's fate
            // What matters is WHO survived and WHERE they landed

            // Colony Knowledge Impact — assessed failures inform better decisions
            const colonyKnowledge = state._colonyKnowledge || 0;
            if (colonyKnowledge >= 3 && success) {
                acts.push("We studied every failed colony we passed. Where they planted early, we waited. Where they built fast, we built slowly.");
                if (title === "UNKNOWN") title = "LEARNED FROM THE DEAD";
            } else if (colonyKnowledge >= 1 && success) {
                acts.push("The colony logs we recovered helped. We avoided the soil that poisoned the dome settlers.");
            }

            // Standard Act 3 progression (if not overridden by sabotage)
            if (success) {
                // Wrong Place survivors have unique destiny
                if (wrongPlaceSurvivors >= 2) {
                    acts.push("The ones who went through the Wrong Place meet on the hill most evenings to look at the light. They say they can feel it. None has gone.");
                    if (title === "UNKNOWN") title = "THE HILL";
                } else if (wrongPlaceSurvivors === 1 && state.currentSector >= 5) {
                    acts.push("Our Wrong Place survivor watched the light every night from the edge of camp. One morning they were gone. The tracks led toward where it rises.");
                    if (title === "UNKNOWN") title = "THE WANDERER'S END";
                } else if (symbiotes >= 2) {
                    acts.push("Nobody here looks at the stars much. The children are born into the network. The old recordings from Earth sound lonely to them.");
                } else if (cyborgs >= 2) {
                    acts.push("The neural-linked crew moved their minds into the colony's computers. Their bodies were buried in the twelfth year. They still run the power and water.");
                } else if (symbiotes === 1 && cyborgs === 1) {
                    acts.push("The one with the fungus and the one with the neural link had a child. Nobody thought it was possible. The child is healthy, and not quite like anyone else.");
                    if (title === "UNKNOWN") title = "THE CHILD";
                } else if (hadAnomaly && hasTech) {
                    acts.push("Mira's anomaly data matched readings from the old machines here. It took twenty years to work through. Our physics is now ahead of Earth's.");
                    if (title === "UNKNOWN") title = "THE BREAKTHROUGH";
                } else if (hadAnomaly && wrongPlaceSurvivors > 0) {
                    acts.push("The one who studied the anomaly and the one who went through the Wrong Place compared notes. Their accounts match. Neither will go back.");
                    if (title === "UNKNOWN") title = "MATCHING NOTES";
                } else if (hadPOI && state._colonyKnowledge >= 2) {
                    acts.push("The failed colonies left us their research and tools. Aris kept a list of their dead. Our streets carry those names.");
                    if (title === "UNKNOWN") title = "THEIR NAMES";
                } else if (hasTech || hasUpgrades('sensor_v2')) {
                    acts.push("We built an observatory from the ship's sensors and mapped every star in our sky. We keep the dish pointed away from the light.");
                    if (title === "UNKNOWN") title = "THE OBSERVATORY";
                } else if (state.salvage > 250 && hasEng) {
                    acts.push("The hills were rich in ore, and Jaxon built a foundry. Within ten years we made our own tools and pumps. We could build a ship. Nobody wants to.");
                    if (title === "UNKNOWN") title = "THE FOUNDRY";
                } else if (state.salvage > 250) {
                    acts.push("The ore paid for everything. The mines grew faster than the farms, and we argued about that for twenty years. The mines won.");
                    if (title === "UNKNOWN") title = "THE MINES";
                } else if (livingCrew.length === 1 && commander) {
                    acts.push(`Commander ${commander.realName.split(' ')[1]} was the last of the original crew. She raised the colony from the embryo bank and lived another sixty years. She's buried facing the light.`);
                    if (title === "UNKNOWN") title = "THE LAST COMMANDER";
                } else if (livingCrew.length === 1 && hasMedic) {
                    acts.push("Aris was the only survivor. She spent forty years raising the colony from the embryo bank. None were hers by blood. She called them hers anyway.");
                    if (title === "UNKNOWN") title = "THE DOCTOR'S CHILDREN";
                } else if (livingCrew.length <= 2) {
                    acts.push("Only two of us were left. With the embryo bank and a lot of patience, two was enough. The children don't know how close it came.");
                    if (title === "UNKNOWN") title = "THE LAST PAIR";
                } else {
                    // Enhanced random endings based on circumstances
                    const endings = [];
                    endings.push({ t: "THE QUIET REMNANT", m: "We're small and far from anyone, but we're managing. The ship still hangs in orbit, a bright dot before dawn. The children know it brought us here." });
                    endings.push({ t: "THE ARCHIVISTS", m: "We copied everything the ship carried about Earth: books, songs, recipes, maps. Earth is still there. We just can't go back." });
                    endings.push({ t: "THE EXPANSION", m: "We filled the valley, then started on the next one. The children born here call themselves natives. To them, Earth is a place in stories." });

                    if (state.currentSector >= 4) {
                        endings.push({ t: "THE FAR SETTLERS", m: "We chose the farthest world we could reach. Nobody is likely to find us out here. We're alone, and so far that has been fine." });
                    }
                    if (hasScout) {
                        endings.push({ t: "THE SCOUTS", m: "Vance never stopped exploring. He mapped every valley within a month's walk, and his children kept going. The colony still sends out survey teams every spring." });
                    }
                    if (hasTech_crew) {
                        endings.push({ t: "THE SIGNAL KEEPERS", m: "Mira kept a radio watch on the old ship channels every night for the rest of her life. Nothing ever came in." });
                    }

                    const choice = endings[Math.floor(Math.random() * endings.length)];
                    if (title === "UNKNOWN") title = choice.t;
                    acts.push(choice.m);
                }
            }
        }

        // Fallback
        if (acts.length === 0) acts.push("The colony log ends here.");

        return {
            success: success,
            title: title,
            text: acts.join("<br><br>")
        };
    }

    static getColonyOutcome(planet) {
        const mockState = window.app ? window.app.state : { metals: 0, crew: [], upgrades: [] };
        return this.generateOutcome(planet, mockState);
    }

    /**
     * Generate "50 years later" epilogue for successful colonies
     * @param {Object} planet - The colony planet
     * @param {Object} state - Game state
     * @param {string} mainTitle - The main ending title (used to select appropriate epilogue)
     */
    static generateEpilogue(planet, state, mainTitle) {
        const livingCrew = state.crew.filter(c => c.status !== 'DEAD');
        const type = planet.type;
        const sector = state.currentSector || 1;

        // Base population calculation
        const startingPop = livingCrew.length;
        const viability = this.getPlanetViability(planet, state);
        let popMultiplier = {
            'EXCELLENT': 150,  // 150x in 50 years (generous births, low death)
            'GOOD': 80,        // 80x
            'MARGINAL': 40,    // 40x
            'POOR': 15,        // 15x (hard life, few survivors)
            'IMPOSSIBLE': 0
        }[viability] || 50;

        // Adjust for crew roles
        const hasMedic = livingCrew.find(c => c.tags.includes('MEDIC'));
        const hasEng = livingCrew.find(c => c.tags.includes('ENGINEER'));
        if (hasMedic) popMultiplier *= 1.3;
        if (hasEng) popMultiplier *= 1.2;

        const finalPop = Math.floor(startingPop * popMultiplier);
        const generations = 3; // 50 years ≈ 3 generations

        // Epilogue text fragments
        const epilogues = [];

        // Header
        epilogues.push(`<div style="color: #888; border-top: 1px solid #333; padding-top: 15px; margin-top: 20px;">`);
        epilogues.push(`<span style="color: #ffcc00;">/// FIFTY YEARS LATER ///</span>`);
        epilogues.push(`</div>`);

        // Population report
        epilogues.push(`<div style="margin-top: 15px;">`);
        if (finalPop >= 500) {
            epilogues.push(`Colony population: <span style="color: #00ff00;">${finalPop.toLocaleString()} people</span>. It's a real town now.`);
        } else if (finalPop >= 100) {
            epilogues.push(`Colony population: <span style="color: #ffcc00;">${finalPop.toLocaleString()} people</span>. A small, steady community.`);
        } else if (finalPop >= 20) {
            epilogues.push(`Colony population: <span style="color: #ff8800;">${finalPop.toLocaleString()} people</span>. Enough to keep going, just.`);
        } else {
            epilogues.push(`Colony population: <span style="color: #ff4444;">${finalPop.toLocaleString()} people</span>. Still very few. Every birth matters.`);
        }
        epilogues.push(`</div>`);

        // Specific epilogue based on planet type and ending
        epilogues.push(`<div style="margin-top: 15px; line-height: 1.6;">`);

        // Type-specific epilogues
        if (type === 'EDEN') {
            epilogues.push(`The children here have never gone hungry. They watch the old Earth recordings like history lessons. It's been an easy life.`);
        } else if (type === 'TERRAFORMED') {
            epilogues.push(`The weather machines still run under the fields. The third generation knows how to adjust them. Nobody has found out who built them.`);
        } else if (type === 'SINGING') {
            epilogues.push(`The children born here hear the planet's tone all the time, and they find silence strange. Old Earth music sounds thin to them.`);
        } else if (type === 'CRYSTALLINE') {
            epilogues.push(`Families keep their recordings in the crystal halls. Touch the right crystal and you hear a great-grandparent talking.`);
        } else if (type === 'SYMBIOTE_WORLD') {
            epilogues.push(`The third generation can read the forest's health by touch and smell. They're less like us every year, and better suited to this place.`);
        } else if (type === 'MECHA' || type === 'MACHINE_WORLD') {
            epilogues.push(`The factories run themselves. The children learn machine code before they can read. Half have implants by age ten.`);
        } else if (type === 'GRAVEYARD') {
            epilogues.push(`Salvage became the colony's trade. We've stripped every wreck within a day's walk. The children play in the ones we haven't reached.`);
        } else if (type === 'OCEANIC') {
            epilogues.push(`Three generations at sea have changed us. The children can hold their breath for fifteen minutes. A few are born with webbing between their fingers.`);
        } else if (type === 'ICE_WORLD' || type === 'FROZEN_OCEAN') {
            epilogues.push(`Life under the ice is quiet. The glowing animals are our farms and our lamps. On the surface, the children stare at the stars for hours.`);
        } else if (type === 'VOLCANIC') {
            epilogues.push(`Heat from the ground powers everything. The children have never had a cold night. They build with cooled lava and carve patterns into it.`);
        } else if (type === 'ROGUE') {
            epilogues.push(`There are no days here and no seasons. People measure time in finished jobs, not years. Nobody is ever in a hurry.`);
        } else if (viability === 'POOR' || viability === 'MARGINAL') {
            epilogues.push(`Staying alive is still hard work every day. The children born here have never known anything easier. They're tough, practical, and suspicious of comfort.`);
        } else {
            // Generic good ending
            epilogues.push(`EXODUS-9's crew are remembered as heroes or fools, depending on who tells it. The truth is simpler: they were tired, they stopped, and it worked.`);
        }

        epilogues.push(`</div>`);

        // Crew memorials
        epilogues.push(`<div style="margin-top: 15px; color: #666; font-size: 0.9em;">`);
        const crewMemorials = [];

        livingCrew.forEach(c => {
            const name = c.realName ? c.realName.split(' ')[1] : c.name;
            if (c.tags.includes('LEADER')) {
                crewMemorials.push(`Commander ${name} is the first name in the colony register.`);
            } else if (c.tags.includes('MEDIC')) {
                crewMemorials.push(`The clinic is named after Dr. ${name}.`);
            } else if (c.tags.includes('ENGINEER')) {
                crewMemorials.push(`${name}'s tools hang in the workshop, still in use.`);
            } else if (c.tags.includes('SPECIALIST')) {
                crewMemorials.push(`The ship's archive is named after ${name}.`);
            } else if (c.tags.includes('SECURITY')) {
                crewMemorials.push(`The night watch still follows ${name}'s rules.`);
            }
        });

        if (crewMemorials.length > 0) {
            epilogues.push(crewMemorials.join(' '));
        }

        epilogues.push(`</div>`);

        // Final line
        epilogues.push(`<div style="margin-top: 20px; color: #00ff88; font-style: italic; text-align: center;">`);
        epilogues.push(`The light at the end of the heading still shows after sunset.<br>Nobody has gone to see it up close.`);
        epilogues.push(`</div>`);

        return epilogues.join('');
    }
}
