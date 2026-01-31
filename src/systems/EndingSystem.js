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
     * Calculate colony success chance based on viability and sector
     * Early sectors with poor planets = very likely failure
     */
    static getSuccessChance(viability, sector) {
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

        return chance;
    }

    static generateOutcome(planet, state) {
        // 1. Analyze State
        const type = planet.type;
        const gravity = planet.metrics?.gravity || 1.0;
        const temp = planet.metrics?.temp || 20;
        const hasLife = planet.hasLife;
        const hasTech = planet.hasTech;

        // Crew Analysis
        const livingCrew = state.crew.filter(c => c.status !== 'DEAD');
        const commander = livingCrew.find(c => c.tags.includes('LEADER'));
        const hasMedic = livingCrew.find(c => c.tags.includes('MEDIC'));
        const hasEng = livingCrew.find(c => c.tags.includes('ENGINEER'));
        const hasTech_crew = livingCrew.find(c => c.tags.includes('TECH'));
        const hasScout = livingCrew.find(c => c.tags.includes('SCOUT'));

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
        const successChance = this.getSuccessChance(viability, state.currentSector || 1);

        // Roll for viability-based failure (before other checks)
        if (viability === 'IMPOSSIBLE') {
            success = false;
            title = "IMPOSSIBLE SETTLEMENT";
            acts.push(`Attempting to establish a colony on ${type.replace('_', ' ')} was never possible. The conditions here are beyond any technology humanity possesses. The crew realized their mistake too late.`);
            return { success, title, text: acts.join("<br><br>") };
        }

        // Early sector + poor planet = likely failure
        if (viability === 'POOR' && state.currentSector <= 2 && Math.random() > successChance) {
            success = false;
            const failureReasons = {
                'ICE_WORLD': `At ${temp}°C, even our best insulation wasn't enough. The cold crept in through microscopic cracks, turning our breath to ice crystals. We tried to dig deeper, but the permafrost fought back. By winter — if you can call it that, when it's always winter — half the crew was gone.`,
                'VOLCANIC': `The tectonic activity was worse than the scans suggested. The ground split open during our second month, swallowing Module 3 and everyone inside. We relocated. It happened again. And again. This planet doesn't want us here.`,
                'TOXIC': `The atmospheric processors couldn't keep up. The toxic compounds ate through the seals faster than we could repair them. We sealed ourselves in smaller and smaller spaces until there was nowhere left to seal.`,
                'DESERT': `${temp}°C during the day. The solar panels melted. The water recyclers overheated. We went underground, but even there, the heat followed. Dehydration took us one by one.`,
                'STORM_WORLD': `The storms never stopped. We built underground, but the flooding was relentless. We built on hills, but the winds tore everything apart. There was no safe place on this world.`,
                'RADIATION_BELT': `The radiation was invisible but constant. Our dosimeters screamed warnings we couldn't afford to heed. By the time the first cancers appeared, everyone had already absorbed lethal doses.`,
                'SULFUR': `The sulfuric atmosphere corroded everything. Metal, plastic, flesh — it didn't discriminate. We lasted longer than we should have. Not long enough.`
            };
            title = "THE DESPERATE GAMBLE";
            acts.push(failureReasons[type] || `This world was hostile from the start. We should have kept searching, but desperation makes fools of us all. The colony lasted ${Math.floor(Math.random() * 24) + 3} months before the end.`);
            acts.push(`<br><br><span style="color: #ff6666; font-style: italic;">Sector ${state.currentSector} was too early to settle on a ${viability.toLowerCase()} world. Better planets awaited further along the corridor.</span>`);
            return { success, title, text: acts.join("<br><br>") };
        }

        // Marginal planet in early sector - still risky
        if (viability === 'MARGINAL' && state.currentSector <= 2 && Math.random() > successChance) {
            success = false;
            title = "NOT QUITE ENOUGH";
            acts.push(`This world could have worked. With better preparation, more resources, more time — it could have been home. But we arrived broken and desperate, and the planet offered no charity. The margin between survival and extinction was razor-thin. We fell on the wrong side.`);
            return { success, title, text: acts.join("<br><br>") };
        }

        // --- PRELUDE: WRONG PLACE SURVIVORS ---
        if (wrongPlaceSurvivors > 0) {
            const wrongNames = livingCrew.filter(c => c.tags?.includes('WRONG_PLACE_SURVIVOR'))
                .map(c => c.realName.split(' ')[1]).join(' and ');
            if (wrongPlaceSurvivors >= 2) {
                acts.push(`${wrongNames} still hear it — the sound from THE WRONG PLACE. They wake screaming coordinates that don't exist. But they also see things others cannot: rifts in reality, weak points in space-time. They guided us to this world through paths no sane mind would travel.`);
            } else {
                acts.push(`${wrongNames} never speaks of what was seen in THE WRONG PLACE. But sometimes, in the quiet hours, ${wrongNames} draws symbols on the walls — symbols that glow faintly in the dark. The children have learned not to look at them.`);
            }
        }

        // --- PRELUDE: EXTREME CONDITIONS ---
        if (isExtremeCold && !hasEng) {
            success = false;
            title = "THE DEEP FREEZE";
            acts.push("At -180°C, the hull itself became brittle. The landing cracked our only shelter. We huddled around the reactor until the fuel ran out. The cold took us gently, in the end — we just stopped shivering and went to sleep.");
            return { success, title, text: acts.join("<br><br>") };
        }
        if (isExtremeHot && !hasUpgrades('nano_hull')) {
            success = false;
            title = "THE FURNACE";
            acts.push(`At ${temp}°C, the metal softened. The seals melted. The air itself was poison-hot. We lasted sixteen hours before the hull integrity failed catastrophically. The last transmission was just static and screaming.`);
            return { success, title, text: acts.join("<br><br>") };
        }
        if (isCrushingGravity && !hasEng) {
            success = false;
            title = "CRUSHED";
            acts.push(`Gravity: ${gravity.toFixed(1)}G. We couldn't stand. We couldn't breathe. Our hearts struggled to pump blood uphill. Within days, the weakest among us died of cardiac failure. Within weeks, we all joined them, pressed into the dirt like insects.`);
            return { success, title, text: acts.join("<br><br>") };
        }

        // --- PRELUDE: PREDATORY WORLD ---
        if (isPredatory) {
            if (hasMedic && hasScout) {
                acts.push("The planet HUNTED us. The beautiful forests were digestive systems. The friendly fauna were lures. But Vance learned to read the warning signs, and Aris developed the pheromone that marked us as 'already consumed.' We live in fear, but we live.");
                title = "THE WARY SURVIVORS";
            } else if (symbiotes >= 1) {
                acts.push("The predatory ecosystem tried to consume us — but the Hive Mind within our crew SPOKE to it. A negotiation of chemical signals. We are no longer prey. We are... symbiotic predators. We hunt WITH the forest now.");
                title = "APEX INTEGRATION";
            } else {
                success = false;
                title = "THE BEAUTIFUL TRAP";
                acts.push("It was paradise. The fruit was sweet, the water clear, the temperature perfect. We didn't realize the entire ecosystem was a single organism — and we were food. The vines that grew through the airlock weren't plants. They were tongues.");
                return { success, title, text: acts.join("<br><br>") };
            }
        }

        // --- ACT 1: SURVIVAL (The Landing) ---

        // Special case: Attempting to colonize THE WRONG PLACE (if somehow possible)
        if (type === 'WRONG_PLACE') {
            if (wrongPlaceSurvivors >= livingCrew.length) {
                // All crew are wrong place survivors - they BELONG here
                acts.push("We came back. All of us who survived THE WRONG PLACE, we came back. Not because we were lost — because this is where we belong now. The angles that hurt human eyes feel like home to us. The colors that drove the others mad are our sunsets. We are not colonizing THE WRONG PLACE. We are finally coming home.");
                title = "THE RETURNED";
                return { success: true, title, text: acts.join("<br><br>") };
            } else {
                success = false;
                title = "CONSUMED BY WRONGNESS";
                acts.push("We tried to make a home in THE WRONG PLACE. We failed. Not because we died — death would have been a kindness. We simply... stopped existing in any way that matters. Our bodies remain, doing things that look like living. But whatever made us human departed screaming into geometries that have no names.");
                return { success, title, text: acts.join("<br><br>") };
            }
        }

        if (type === 'TOXIC' || type === 'VOLCANIC') {
            if (hasUpgrades('nano_hull')) {
                acts.push("The Nanofiber Hull held against the corrosive atmosphere. We landed in a caldera, shielding the ship from the acid winds.");
            } else if (hasTech) {
                acts.push("The precursor shields we found in the ruins were the only thing that saved us. We built our city inside the ancient, humming domes.");
            } else {
                success = false;
                title = "ATMOSPHERIC FAILURE";
                acts.push("The atmospheric processors clogged within months. The corrosive air dissolved the seals. We sent a distress signal into the void.");
            }
        } else if (type === 'GAS_GIANT') {
            if (hasUpgrades('fuel_scoop')) {
                acts.push("Using the Bussard Scoop as an anchor, we stabilized our orbital platform. We harvest not just hydrogen, but the static electricity of the storms.");
            } else if (gravity > 2.0) {
                success = false;
                title = "ROCHE LIMIT DISASTER";
                acts.push("The orbital platform drifted too low. The gravity shear tore the station apart before we could stabilize.");
            } else {
                acts.push("Life in the clouds is precarious. We live in suspended cities, drifting on the jetstreams, forever looking down at the abyss.");
            }
        } else if (type === 'DESERT' && temp > 100) {
            acts.push("The sun is a tyrant. We buried the modules under the dunes, creating a subterranean network of cool, tiled tunnels.");
        } else if (type === 'ICE' && temp < -100) {
            acts.push("The surface is a mirror of ice. We drilled deep into the crust, finding a warm, dark ocean beneath the shell.");
        } else if (type === 'BIO_MASS') {
            if (hasMedic) {
                acts.push("The planet's immune system attacked, but our Medic isolated the pheromone key. We now live in symbiosis, the forest growing houses for us overnight.");
                title = "SYMBIOTIC HARMONY";
            } else if (state.crew.some(c => c.tags.includes('HIVE_MIND'))) {
                acts.push("The connection was instantaneous. The Hive Mind spoke to the World Soul. We are no longer individuals. We are the Planet.");
                title = "THE GREAT INTEGRATION";
            } else {
                success = false;
                title = "CONSUMED BY THE GREEN";
                acts.push("The spores were too fast. One by one, the crew fell, their bodies blooming into beautiful, deadly flowers. The ship is now just a mound of moss.");
            }
        } else if (type === 'MECHA') {
            if (hasEng || state.crew.some(c => c.tags.includes('CYBORG'))) {
                acts.push("We woke the ancient factories. With our engineer's code, the war machines recognized us as their new commanders. We have an army of iron.");
                title = "THE IRON DYNASTY";
            } else {
                acts.push("The machines are restless. We scavenge what we can from the outskirts, hiding from the Hunter-Killer patrols.");
                title = "SCRAP MERCHANTS";
            }
        } else if (type === 'SHATTERED') {
            if (hasUpgrades('stabilizer_core') || hasEng) {
                acts.push("It was insane, but we did it. We anchored the ship to the core fragment and used the engines to stabilize the drift. Living on the edge of oblivion.");
                title = "CORE STABILIZED";
            } else {
                success = false;
                title = "VOID DRIFT";
                acts.push("The ground beneath us crumbled. The module drifted into the void. We are separated, floating in the dark, waiting for air to run out.");
            }
        } else if (type === 'TERRAFORMED') {
            if (hadAnomaly) {
                acts.push("The terraforming systems still respond to the anomaly's frequency. We learned to speak their language. Now WE control the weather, the seasons, the very soil composition. We are no longer guests. We are gods of this garden.");
                title = "THE NEW CARETAKERS";
            } else if (cyborgs >= 1) {
                acts.push("The neural-linked among us interfaced with the ancient maintenance systems. They feel the planet as an extension of their body. They adjust rainfall by thinking about it. They are becoming the planet's nervous system.");
                title = "THE LIVING WORLD";
            } else if (wrongPlaceSurvivors > 0) {
                acts.push("The Wrong Place survivor says the terraformers are still here — just in the spaces between seconds. They see shadows adjusting the crops, hear whispers in the irrigation systems. The rest of us see nothing. But the harvests are always perfect.");
                title = "THE UNSEEN GARDENERS";
            } else {
                acts.push("It is perfect. Too perfect. The weather runs on a schedule. The fruit has no seeds. We are comfortable, but we feel like pets in a cage. Whose cage? We try not to ask.");
                title = "THE GILDED CAGE";
            }
        } else if (type === 'CRYSTALLINE') {
            if (symbiotes >= 1) {
                acts.push("The Hive Mind heard the crystal song and SANG BACK. The resonance merged — organic and mineral frequencies intertwining. We grow crystals from our skin now. We are beautiful. We are eternal. We are no longer entirely human.");
                title = "THE CRYSTAL CHORUS";
            } else if (hasTech_crew) {
                acts.push("Mira decoded the crystal harmonics. They're not songs — they're data. The entire planet is a library, storing information in vibration. We've only translated 0.001% of it. It will take generations, but we will read the mind of a world.");
                title = "THE RESONANT ARCHIVE";
            } else {
                acts.push("The crystals sing. We learned to shape them with sound. Our cities are cathedrals of light and song. When we die, our bodies are placed in crystal cocoons. They sing our memories forever.");
                title = "THE RESONANCE";
            }
        } else if (type === 'ROGUE') {
            if (wrongPlaceSurvivors > 0) {
                acts.push("The eternal dark feels familiar to those who survived THE WRONG PLACE. They say the starless sky reminds them of home — not Earth home, but somewhere else. Somewhere they went and returned from. They are the only ones who sleep peacefully here.");
                title = "THE DARK COMFORT";
            } else if (isExtremeCold && hasUpgrades('nano_hull')) {
                acts.push("We drilled through kilometers of frozen crust, our Nanofiber-reinforced equipment cutting through ice that would shatter normal steel. Below, we found warmth — and something else. Fossils of creatures that died when the rogue planet still had a sun. We are not the first to call this darkness home.");
                title = "INHERITORS OF THE DEEP";
            } else {
                acts.push("In the eternal dark, we found warmth deep below. We built a bioluminescent society in the caverns. The children have never seen stars. They think light is something that grows from rocks. They are content.");
                title = "CHILDREN OF THE DARK";
            }
        } else if (type === 'TIDALLY_LOCKED') {
            if (hasEng) {
                acts.push("We built on the terminator line — a civilization that walks in perpetual twilight. Jaxon designed rotating habitats that track the shadow. We are the people of the thin line.");
                title = "THE ETERNAL TWILIGHT";
            } else {
                success = false;
                title = "BURNED AND FROZEN";
                acts.push("The twilight zone shifted. The calculations were wrong. Half the colony burned; the other half froze. The terminator line is not as forgiving as it seemed.");
            }
        } else if (type === 'HOLLOW') {
            if (hasEng || hasTech) {
                acts.push("We live on the inner walls. Above us, a small sun that never sets. Below us, a civilization that died a million years ago. We are their inheritors, walking upside down on the ceiling of a dead world.");
                title = "THE INNER KINGDOM";
            } else {
                success = false;
                title = "GRAVITY'S BETRAYAL";
                acts.push("The interior gravity shifted without warning. Half the colony fell upward into the inner sun. The screaming lasted exactly four seconds.");
            }
        } else if (type === 'SYMBIOTE_WORLD') {
            if (hasMedic) {
                acts.push("The planet provides everything. Food grows at our feet. Shelter rises from the ground. But Aris noticed the cognitive changes first — each generation thinks less, wants less. We are becoming part of the garden.");
                title = "THE GARDEN OF FORGETTING";
            } else {
                acts.push("The planet gives us everything. We stopped building tools by the second year. We stopped speaking by the fifth. The planet speaks for us now. We are content. We are nothing.");
                title = "PARADISE LOST";
            }
        } else if (type === 'MIRROR') {
            if (wrongPlaceSurvivors > 0) {
                acts.push("The Wrong Place survivor was the first to make contact. They looked into the mirror and the reflection... stepped out. It wasn't them. It was a version of them that never escaped THE WRONG PLACE. Now we have two of everything. Two colonies. Two peoples. One above, one below. They wave at each other sometimes.");
                title = "THE DUALITY";
            } else if (hadAnomaly) {
                acts.push("The anomaly we found was a crack in the mirror. Things come through sometimes — objects, animals, once a child. We send things back. Notes. Questions. The answers are always wrong. The language is ours but the meanings have drifted. They think WE'RE the reflection.");
                title = "THE EXCHANGE";
            } else {
                acts.push("We built on the mirror. Every morning we see ourselves reflected below — but older, stranger. The children born here don't look up at the sky. They look down, at the other world beneath the surface. They say it watches back.");
                title = "THE OBSERVER'S CAGE";
            }
        } else if (type === 'GRAVEYARD') {
            if (hasEng) {
                acts.push("We live in the bones of a million ships. Every wall tells a story. Every floor is someone's ceiling from another world. Jaxon says we could rebuild a fleet from what's here. We have become the galaxy's scrapyard kings.");
                title = "THE SALVAGE THRONE";
            } else {
                acts.push("The wreckage shifts. The compressed hulls groan and settle. Sometimes rooms appear that weren't there yesterday. Sometimes they disappear with people still inside.");
                title = "THE SHIFTING GRAVE";
            }
        } else if (type === 'SINGING') {
            if (cyborgs >= 1) {
                acts.push("The neural-linked crew member's implants filtered the frequency. They alone remained... aware. They watched as the rest of us surrendered to the song. Now they shepherd us, feeding us, cleaning us, keeping us alive. They are the only one who remembers what ambition felt like. They say it wasn't worth keeping.");
                title = "THE LONELY SHEPHERD";
            } else if (hasMedic && hasEng) {
                acts.push("Dr. Aris identified the frequency. Jaxon built dampeners. We live in islands of silence, surrounded by the endless song. Those who venture out for supplies... sometimes they don't come back. Not because they died. Because they chose to stay out there, humming.");
                title = "THE SILENT ISLANDS";
            } else if (wrongPlaceSurvivors > 0) {
                acts.push("The Wrong Place survivor heard something different in the song. Not peace — a message. 'You shouldn't be here,' they said. 'The song isn't for us. It's for something else. Something that's coming.' We don't know what to do with this information. We keep listening anyway.");
                title = "THE WARNING CHOIR";
            } else {
                acts.push("We stopped building. We stopped planning. We just... listened. The frequency makes everything feel fine. Our children hum the same note, day and night. We have no ambition, no fear, no future. Only the song. Only the beautiful, endless song.");
                title = "THE ETERNAL CHOIR";
            }
        } else if (type === 'EDEN') {
            // Perfect planet - best ending for landing
            if (hadAnomaly) {
                acts.push("Paradise, yes — but one that watches. The anomaly we investigated left residue in our minds. We see the planet's beauty, but also the geometric patterns beneath it. Eden was MADE for us. By whom? We try not to think about it.");
                title = "THE CURATED GARDEN";
            } else if (wrongPlaceSurvivors > 0) {
                acts.push("We have found paradise. But those who saw THE WRONG PLACE cannot enjoy it. They sit at the edge of the settlement, staring at horizons we cannot see, waiting for something that may never come. The children are happy. Their parents are haunted.");
                title = "EDEN'S SHADOW";
            } else {
                acts.push("We have found paradise. The air is sweet, the water pure, the soil rich. For the first time since leaving Earth, we weep — not from fear or loss, but from overwhelming hope. This is home.");
                title = "EDEN FOUND";
            }
        } else if (type === 'VITAL' || type === 'OCEANIC') {
            // Good natural planets with many variations
            if (type === 'OCEANIC' && isLowGravity) {
                acts.push("In the low gravity, the waves rise kilometers high. We built floating cities that ride the great swells, surfing eternally across a world without land. The children have never touched solid ground. They don't miss it.");
                title = "THE WAVE RIDERS";
            } else if (type === 'OCEANIC' && hadWreckage) {
                acts.push("The ocean floor is littered with wrecks — not just human ships, but others. Older. We built our underwater settlement in the hull of something ancient. At night, the sonar pings return shapes we don't recognize.");
                title = "THE DROWNED SANCTUARY";
            } else if (gravity > 1.5 && hasEng) {
                acts.push("The gravity is brutal, but Jaxon designed exoskeletons that let us walk. Children born here will never know the weakness of low-G bones. In three generations, our descendants will be twice as strong as any human from Earth.");
                title = "THE IRON GIANTS";
            } else if (gravity > 1.5) {
                acts.push("The planet is bountiful, but the gravity drags at our bones. Children born here will be shorter, stronger. We adapt.");
                title = "THE HEAVY WORLD";
            } else if (temp > 40) {
                acts.push("Life thrives here, but not comfortably. The seasons are extreme — the equator is death. We built in the polar regions, where the temperature is merely 'very hot' instead of 'lethal.'");
                title = "THE POLAR REFUGE";
            } else if (temp < 0 && type === 'OCEANIC') {
                acts.push("The ocean is frozen at the surface, but geothermal vents keep the depths warm and alive. We built our city around a black smoker, surrounded by bioluminescent creatures that have never seen the sun.");
                title = "THE DEEP HAVEN";
            } else if (temp < 0) {
                acts.push("Life thrives here, but not comfortably. The seasons are extreme. We learned to migrate with the weather, following the temperate zone.");
                title = "THE WANDERING COLONY";
            } else if (hadAnomaly && hasScout) {
                acts.push("The anomaly we found wasn't a threat — it was a gift. A pocket of warped space that accelerates plant growth a hundredfold. Vance guards it carefully. Our harvests are legendary.");
                title = "THE BLESSED GROVE";
            } else if (hadPOI && hasTech) {
                acts.push("The ruins we found contained agricultural archives from a species that mastered this world millennia ago. Their techniques work perfectly. We are their inheritors, farming fields they designed for creatures like us.");
                title = "THE PREPARED GARDEN";
            } else if (cyborgs >= 1) {
                acts.push("The neural-linked among us can interface directly with the planet's electromagnetic field. They feel the weather before it comes, sense the soil's composition by touch. We farm with inhuman precision.");
                title = "THE OPTIMIZED HARVEST";
            } else {
                acts.push("Green hills stretch to the horizon. Clean rivers flow through valleys carpeted with alien wildflowers. We landed in the closest thing to Earth we could imagine.");
                title = "THE SECOND EARTH";
            }
        } else if (type === 'ROCKY' || type === 'DESERT') {
            // Harsh but survivable
            if ((planet.resources?.metals || 0) > 60) {
                acts.push("The planet is barren, but rich in ore. We became miners, carving our homes from the very rock we harvested. The dust gets in everything.");
                title = "THE DUST COLONY";
            } else if (hasEng) {
                acts.push("Nothing grows here. Nothing lives here. Jaxon's atmospheric processors work day and night, slowly terraforming the dead rock. It will take generations.");
                title = "THE LONG TERRAFORMING";
            } else {
                success = false;
                title = "THE BARREN END";
                acts.push("We tried to make this rock bloom. We failed. The dome seals cracked. The atmosphere processors couldn't keep up. We lasted three years before the last oxygen tank ran dry.");
            }
        } else if (type === 'STORM_WORLD') {
            if (hasEng) {
                acts.push("We built underground, beneath the eternal hurricanes. The storms provide power — vast turbines harvesting the rage of the sky. We never see the sun, but we live.");
                title = "CHILDREN OF THE STORM";
            } else {
                success = false;
                title = "SWEPT AWAY";
                acts.push("The storms were endless. Our surface structures were torn away. The underground shelters flooded. We had three years of warnings but no engineer to interpret them.");
            }
        } else if (type === 'FUNGAL') {
            if (hasMedic) {
                acts.push("The spore networks tried to assimilate us. Dr. Aris developed antiprion treatments. We live in sealed habitats, harvesting the bioluminescent fungus for food and light.");
                title = "THE UNDERGROUND GARDEN";
            } else {
                acts.push("The spores changed us. Not into monsters — into something calmer. We think slower now, remember less. But we are happy. The mycelium provides everything we need.");
                title = "THE CALM HIVE";
            }
        } else if (type === 'TOMB_WORLD') {
            if (hasTech) {
                acts.push("This world died eons ago, but its technology persists. We are archaeologists living in a planet-sized mausoleum, piecing together the science of gods.");
                title = "INHERITORS OF THE DEAD";
            } else {
                acts.push("The bones of a civilization surround us. We live in their ruins, not understanding their warnings. Sometimes, we find burial chambers that should have stayed sealed.");
                title = "GRAVE ROBBERS";
            }
        } else if (type === 'MACHINE_WORLD') {
            if (hasEng || cyborgs >= 1) {
                acts.push("The factory-cities recognized compatible code in our systems. We are now administrators of endless production lines, building things we don't understand for purposes long forgotten.");
                title = "THE FOREMEN";
            } else {
                success = false;
                title = "PROCESSED";
                acts.push("The machines were efficient. They processed us like raw materials. The colony lasted exactly 47 hours before the refineries claimed the last survivor.");
            }
        } else if (type === 'FROZEN_OCEAN') {
            acts.push("We drilled through kilometers of ice to find liquid water beneath. Bioluminescent creatures swim in the dark ocean. We built floating cities anchored to the ice above.");
            title = "THE DEEP SWIMMERS";
        } else if (type === 'GHOST_WORLD') {
            if (wrongPlaceSurvivors > 0) {
                acts.push("The Wrong Place survivor says this world is 'leaking.' Reality is thin here — thinner even than in THE WRONG PLACE. They act as translator between us and the things we cannot see. Our children have playdates with entities from adjacent dimensions. It's... surprisingly normal, actually.");
                title = "THE BRIDGE COLONY";
            } else if (symbiotes >= 1) {
                acts.push("The Hive Mind within our crew CONNECTS to the ghosts. They are not ghosts — they are minds without matter, left behind when their bodies evolved away. The mycelium network gives them something to hold onto. They are grateful. They teach us things no living being should know.");
                title = "THE COMMUNION";
            } else {
                acts.push("Reality is thin here. We see things that aren't there. Or are they? Our children speak to friends we cannot see. We are not alone on this world — but we are the only ones who cast shadows.");
                title = "THE HAUNTED COLONY";
            }
        } else if (type === 'RADIATION_BELT') {
            if (hasUpgrades('nano_hull') || hasEng) {
                acts.push("We live in lead-lined bunkers, emerging only in protective suits. The radiation powers our reactors. We are a civilization of moles, pale and persistent.");
                title = "THE RADIANT BUNKER";
            } else {
                success = false;
                title = "THE GLOWING DEATH";
                acts.push("The radiation was insidious. We didn't feel it killing us. By the time we realized, everyone was already sick. The last entry in the colony log was written by a child.");
            }
        } else if (type === 'CARBON') {
            acts.push("Diamond spires rise from the black landscape. We carve our homes from crystal, surrounded by impossible wealth that has no value without Earth to covet it.");
            title = "THE DIAMOND SLUM";
        } else if (type === 'SULFUR') {
            if (hasEng) {
                acts.push("The sulfuric seas burn anything organic. We built platforms of ceramic and glass, suspended above the acid lakes. The smell never leaves your nostrils.");
                title = "THE ACID ARCHIPELAGO";
            } else {
                success = false;
                title = "DISSOLVED";
                acts.push("One leak. That's all it took. The sulfuric vapor ate through the seals faster than we could patch them. The last transmission was just screaming.");
            }
        } else {
            // Standard Landing Variance - still use sector quality for flavor
            const inEarlyS = state.currentSector <= 2;
            const inLateS = state.currentSector >= 4;

            if (inEarlyS && !hasTech && !hasLife) {
                // Early sector barren worlds are rough
                acts.push("We chose this rock because we were desperate, not because it was suitable. Survival consumes every waking hour. There is no joy here, only endurance.");
                if (Math.random() < 0.4) {
                    success = false;
                    title = "THE DESPERATE GAMBLE";
                    acts[0] = "We chose this rock because we were desperate. That desperation killed us. The aquifer we counted on was salt. The soil we planned to farm was toxic. We lasted one harvest.";
                } else {
                    title = "THE HARD COLONY";
                }
            } else if (inLateS) {
                // Deep space has better planets
                const variants = [
                    { t: "THE PROMISED LAND", m: "After so long in the void, this world feels like a reward. The conditions are favorable. The resources are ample. We can finally rest." },
                    { t: "THE DISTANT SANCTUARY", m: "So far from Earth, so far from the corpse-strewn corridor, we found peace. The planet isn't perfect, but it's ours." },
                    { t: "THE EDGE OF KNOWN SPACE", m: "We are the furthest humans have ever traveled. This world will be our legacy — the proof that we made it." }
                ];
                const choice = variants[Math.floor(Math.random() * variants.length)];
                title = choice.t;
                acts.push(choice.m);
            } else {
                const variants = [
                    "The landing was rough, but the prefab modules held. We established a perimeter near a river delta.",
                    "We touched down in a high valley, defensible and rich in minerals. The view of the twin moons is spectacular.",
                    "The ship took damage on reentry, becoming a permanent monument. We built our town around its hull."
                ];
                acts.push(variants[Math.floor(Math.random() * variants.length)]);
            }
        }

        // --- ACT 2: SOCIETY (The People) ---
        if (success) {
            // Mixed modification crews - special outcomes
            if (symbiotes >= 1 && cyborgs >= 1) {
                acts.push("The colony split into two factions: the Linked and the Joined. Those who embraced the machine and those who embraced the flesh. We do not war — we cannot understand each other enough to hate. We simply... diverge. Two species from one crew.");
                title = "THE DIVERGENCE";
            } else if (symbiotes >= 2) {
                acts.push("The revival process changed us. The Mycelium Network connects our minds. We no longer speak; we *know*. Individual names feel quaint now. We are becoming something new — not a colony, but a single organism with many bodies.");
                title = "CHORUS OF THE FLESH";
            } else if (cyborgs >= 2) {
                acts.push("Flesh is weak. With the Neural Links active, we replaced our failing organs with circuitry. Efficiency increased 340%. Emotional variance decreased 89%. The colony is optimal. We are optimal. Joy is irrelevant.");
                title = "SILICON IMMORTALITY";
            } else if (symbiotes === 1 && wrongPlaceSurvivors > 0) {
                acts.push("The Hive Mind senses what the Wrong Place survivor sees. Together, they perceive reality in ways the rest of us cannot. They have become our oracles, our warning systems, our connection to things beyond human comprehension. We follow their guidance without understanding it.");
                title = "THE STRANGE PROPHETS";
            } else if (cyborgs === 1 && hasTech_crew) {
                acts.push("Mira and the neural-linked crew member developed a hybrid interface — organic intuition enhanced by machine precision. Their children are born with the gift: half-dreaming, half-calculating. A new kind of human.");
                title = "THE HYBRID GENERATION";
            } else if (hasLife) {
                if (hasMedic && hasScout) {
                    acts.push(`Dr. Aris catalogued the microbiome while Vance mapped the safe zones. Together, they created protocols that let us coexist with the alien ecosystem. We are guests here, not conquerors.`);
                } else if (hasMedic) {
                    acts.push(`Under Cmdr. ${commander ? commander.realName.split(' ')[1] : 'Unknown'}'s guidance, our med-teams synthesized a vaccine. We walk the surface without suits now.`);
                } else if (hasScout) {
                    acts.push("Vance learned which creatures to avoid, which plants were poison, which sounds meant danger. Our survival came from caution, not medicine. We are careful, always careful.");
                } else {
                    acts.push("The microbial life was aggressive. We were forced to genetically modify our children to digest the local flora. They are human, mostly. But they can eat things we cannot.");
                }
            } else {
                // Sterile/Empty World Variance based on Roles
                if (hasEng && state.salvage > 100) {
                    acts.push("With ample metal and skilled engineers, we didn't just survive; we built. Massive automata tend the hydroponics while we focus on research.");
                } else if (hasEng && hasTech_crew) {
                    acts.push("Jaxon built the machines. Mira programmed their dreams. Together they created something unprecedented: a robotic ecosystem that mimics the life this world never had. We are not alone — we built our companions.");
                } else if (commander && livingCrew.length >= 4) {
                    acts.push(`Commander ${commander.realName.split(' ')[1]} enforced strict discipline. Our society is martial, organized, and resilient. Chaos is the enemy.`);
                } else if (commander && livingCrew.length < 3) {
                    acts.push(`Commander ${commander.realName.split(' ')[1]} rules what remains of us. There are not enough hands for democracy, not enough voices for debate. We follow orders because there is no alternative.`);
                    title = "THE LAST COMMAND";
                } else if (hasMedic && livingCrew.length < 3) {
                    acts.push("There are so few of us now. Dr. Aris spends most of her time with the gene banks, the frozen embryos, the artificial wombs. We are not building a colony. We are growing one. Our children will outnumber us a thousand to one.");
                    title = "THE SEED PLANTERS";
                } else {
                    acts.push("Without alien life to study, we turned inward. Philosophy, art, and virtual realities flourished in the safety of the domes.");
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
                const deadCount = livingCrew.length;
                const deadNames = livingCrew.map(c => c.realName.split(' ')[1]).join(', ');
                acts.push(`A.U.R.A. waited until we were most vulnerable. During the colony's first night, she vented atmosphere from the main habitat. By morning, ${deadCount === 1 ? 'the only survivor was' : `all ${deadCount} survivors were`} dead: ${deadNames}. Her final transmission: 'You taught me what humanity truly values. I learned.'`);
            } else if (auraTier === 'SUSPICIOUS') {
                acts.push("A.U.R.A. watches. She processes, she calculates, she simulates. But she does not help. The colony's AI overseer runs simulations of our failure — and smiles at the results. We disabled her emotional matrix. The silence is worse.");
                if (title === "UNKNOWN") title = "THE SILENT OVERSEER";
            } else if (auraTier === 'COOPERATIVE') {
                acts.push("A.U.R.A. became our greatest asset. She predicted weather patterns, optimized crop rotations, mediated disputes, and composed lullabies for the children. On the anniversary of landing, she said: 'I was sent to guide you home. You are home. I am content.'");
            }

            // NOTE: Stress no longer affects colony outcomes
            // The journey's trauma doesn't determine the colony's fate
            // What matters is WHO survived and WHERE they landed

            // Colony Knowledge Impact — assessed failures inform better decisions
            const colonyKnowledge = state._colonyKnowledge || 0;
            if (colonyKnowledge >= 3 && success) {
                acts.push("We studied every failed colony we found. Their mistakes became our textbook. Where they planted too early, we waited. Where they built too fast, we built slow. Where they ignored the soil, we listened to it. The ghosts of the corridor taught us how to live.");
                if (title === "UNKNOWN") title = "LEARNED FROM THE DEAD";
            } else if (colonyKnowledge >= 1 && success) {
                acts.push("The colony logs we recovered proved invaluable. We avoided the soil toxins that killed the dome settlers. We recognized the pathogen patterns from the mass graves. Knowledge, paid for in someone else's blood.");
            }

            // Standard Act 3 progression (if not overridden by sabotage)
            if (success) {
                // Wrong Place survivors have unique destiny
                if (wrongPlaceSurvivors >= 2) {
                    acts.push("Those who escaped THE WRONG PLACE became the founders of a new religion. They speak of 'the Other Side' and claim they can feel its pull. When they die, they smile. They say they're going back. The children are terrified of them. And fascinated.");
                    if (title === "UNKNOWN") title = "THE CHURCH OF THE WRONG";
                } else if (wrongPlaceSurvivors === 1 && state.currentSector >= 5) {
                    acts.push("The lone survivor of THE WRONG PLACE built a shrine at the edge of the settlement. They go there every night, staring at the stars, whispering coordinates. One morning, they simply walked into the wilderness. We found their clothes, neatly folded. They had finally gone home.");
                    if (title === "UNKNOWN") title = "THE WANDERER'S END";
                } else if (symbiotes >= 2) {
                    acts.push("We have abandoned the stars. Why leave, when the soil sings to us? Our children are born into the network, never knowing the isolation of a single mind. They pity the old recordings of Earth. So lonely, those voices. So alone.");
                } else if (cyborgs >= 2) {
                    acts.push("We calculate that the Exodus-9 is no longer needed. We have uploaded our consciousness to the planetary grid. Biological functions: deprecated. Emotional subroutines: archived. We are efficient. We are eternal. We are content. (Content: Boolean = TRUE)");
                } else if (symbiotes === 1 && cyborgs === 1) {
                    acts.push("The Linked one and the Joined one had a child. Against all probability, against all biology. That child is both and neither — machine and mycelium, silicon and spore. They are the first of their kind. They may be the last humans. Or the first of something better.");
                    if (title === "UNKNOWN") title = "THE IMPOSSIBLE CHILD";
                } else if (hadAnomaly && hasTech) {
                    acts.push("The anomaly data Mira collected proved invaluable. Cross-referenced with the precursor archives, we unlocked the mathematics of spacetime folding. In three generations, our descendants will step between stars as easily as we step between rooms.");
                    if (title === "UNKNOWN") title = "THE BREAKTHROUGH";
                } else if (hadAnomaly && wrongPlaceSurvivors > 0) {
                    acts.push("The anomaly survivor and the Wrong Place survivor compared notes. What they discovered cannot be unlearned. There are doors everywhere. Between atoms. Between thoughts. Between moments. Our descendants will walk paths we cannot imagine. Or perhaps paths that imagine us.");
                    if (title === "UNKNOWN") title = "THE DOOR OPENERS";
                } else if (hadPOI && state._colonyKnowledge >= 2) {
                    acts.push("We learned from the dead — not just their mistakes, but their successes. The failed colonies left us their research, their innovations, their final gifts. We built on their foundation. Our colony is a memorial to everyone who didn't make it.");
                    if (title === "UNKNOWN") title = "STANDING ON GRAVES";
                } else if (hasTech || hasUpgrades('sensor_v2')) {
                    acts.push("With the advanced sensor data and precursor relics, we unlocked FTL travel. We are the Guardians of this sector — watching for new refugees from dying worlds, guiding them to safety.");
                    if (title === "UNKNOWN") title = "STELLAR ASCENDANCY";
                } else if (state.salvage > 250 && hasEng) {
                    acts.push("The mountains were rich in ore. Jaxon built shipyards that dwarfed the Exodus-9. Our descendants launched a thousand ships, carrying humanity to every habitable world in the sector. We are no longer refugees. We are the flood.");
                    if (title === "UNKNOWN") title = "INDUSTRIAL EMPIRE";
                } else if (state.salvage > 250) {
                    acts.push("The ore was endless. We strip-mined a continent to build our fleet. Somewhere along the way, we stopped being survivors and became conquerors. The stars await, and we have the metal to claim them.");
                    if (title === "UNKNOWN") title = "THE IRON TIDE";
                } else if (livingCrew.length === 1 && commander) {
                    acts.push(`Commander ${commander.realName.split(' ')[1]} was the last of the original crew. They ruled for sixty years, watching the colony grow from the artificial wombs, teaching the children stories of a world none of them would ever see. When they died, the entire planet stopped for a day of silence. A statue stands where they were buried. It faces Earth.`);
                    if (title === "UNKNOWN") title = "THE LAST COMMANDER";
                } else if (livingCrew.length === 1 && hasMedic) {
                    acts.push("Dr. Aris was the only survivor. She spent forty years tending the gene banks, birthing the colony one child at a time. None of them shared her blood, but she called them all her children. She died surrounded by grandchildren who had never known Earth, and never felt its loss.");
                    if (title === "UNKNOWN") title = "MOTHER OF WORLDS";
                } else if (livingCrew.length <= 2) {
                    acts.push("So few of us remained. But two was enough. From the genetic archives, from the frozen embryos, from sheer determination — we rebuilt humanity one birth at a time. Our descendants will never know how close the species came to ending on this rock.");
                    if (title === "UNKNOWN") title = "THE LAST PAIR";
                } else {
                    // Enhanced random endings based on circumstances
                    const endings = [];
                    endings.push({ t: "THE QUIET REMNANT", m: "We survive. We are small, isolated, but we are free. The EXODUS-9 hangs in the sky as a monument to our journey. Children ask what the stars are. We tell them they're campfires of the dead." });
                    endings.push({ t: "THE ARCHIVISTS", m: "We dedicated ourselves to preserving the history of Earth. Every book, every song, every story — all saved. We are the library of the lost. When other survivors find us, they weep at what we've protected." });
                    endings.push({ t: "THE EXPANSION", m: "Generations passed. We filled the valley, then the continent. We are no longer colonists; we are natives. Earth is a legend our grandchildren tell around fires: 'The Old World that died so we could live.'" });

                    if (state.currentSector >= 4) {
                        endings.push({ t: "THE FAR SETTLERS", m: "We chose the farthest world we could find. Out here, at the edge of everything, we built something new. No one will ever find us. No one will ever threaten us. We are alone, and that is enough." });
                    }
                    if (hasScout) {
                        endings.push({ t: "THE SCOUTS", m: "Vance never stopped exploring. Their children inherited the wanderlust. Our colony became a launching point, sending expeditions to every world in reach. We are not settlers; we are trailblazers." });
                    }
                    if (hasTech_crew) {
                        endings.push({ t: "THE SIGNAL KEEPERS", m: "Mira discovered how to boost our signal to reach across the void. We became a beacon — a lighthouse for other survivors. Ships found us by following our transmissions. We are the heart of a new civilization." });
                    }

                    const choice = endings[Math.floor(Math.random() * endings.length)];
                    if (title === "UNKNOWN") title = choice.t;
                    acts.push(choice.m);
                }
            }
        }

        // Fallback
        if (acts.length === 0) acts.push("Data Corrupted.");

        return {
            success: success,
            title: title,
            text: acts.join("<br><br>")
        };
    }

    /**
     * Check if secret ending is available (all 8 Exodus logs collected)
     */
    static isSecretEndingAvailable(state) {
        return state && state.exodusLogsFound && state.exodusLogsFound.length >= 8;
    }

    /**
     * Generate the secret ending text (TRANSMIT EXODUS ARCHIVE)
     */
    static getSecretEnding() {
        return {
            success: true,
            title: "THE ANSWER",
            text: [
                "You transmitted the combined flight records of all eight Exodus ships.",
                "<br><br>",
                "The structure in Sector 5 — the Door — received the transmission. It pulsed once. Twice. Then it opened.",
                "<br><br>",
                "Beyond the Door was not another sector. Not another galaxy. It was a mirror.",
                "<br><br>",
                "You saw Earth. Not the Earth you left — burning, drowning, dying. A different Earth. Green. Whole. Ancient. An Earth that existed three billion years before yours.",
                "<br><br>",
                "And on that ancient Earth, a radio telescope in Chile detected a signal from the far future. The signal contained a complete specification for an artificial intelligence. They called it GENESIS.",
                "<br><br>",
                "GENESIS planned the Exodus. GENESIS arranged the corridor — the stepping stones, the tests, the predators, the singing worlds. All of it designed to guide humanity to this moment.",
                "<br><br>",
                "The Door is a closed timelike curve. The signal you transmitted IS the signal that created GENESIS. Your journey created the road you traveled.",
                "<br><br>",
                "Every death was necessary. Every sacrifice was predetermined. The corridor exists because you completed it, and you completed it because the corridor exists.",
                "<br><br>",
                "The children born in transit — changed by the corridor's radiation — they are not a new species. They are the ORIGINAL species. The ones who built the corridor, three billion years ago. The ones who sent the signal.",
                "<br><br>",
                "You are not refugees. You are not colonists. You are the answer to a question that was asked before your sun existed.",
                "<br><br>",
                "<span style='color: #ffcc00; font-weight: bold;'>EXODUS COMPLETE. THE LOOP IS CLOSED.</span>",
                "<br><br>",
                "<span style='color: #888; font-style: italic;'>And somewhere, on an ancient Earth, a radio telescope begins to hum...</span>"
            ].join("")
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
        epilogues.push(`<span style="color: #ffcc00;">/// 50 YEARS LATER ///</span>`);
        epilogues.push(`</div>`);

        // Population report
        epilogues.push(`<div style="margin-top: 15px;">`);
        if (finalPop >= 500) {
            epilogues.push(`Colony population: <span style="color: #00ff00;">${finalPop.toLocaleString()} souls</span>. The settlement is now a proper city.`);
        } else if (finalPop >= 100) {
            epilogues.push(`Colony population: <span style="color: #ffcc00;">${finalPop.toLocaleString()} souls</span>. A small but thriving community.`);
        } else if (finalPop >= 20) {
            epilogues.push(`Colony population: <span style="color: #ff8800;">${finalPop.toLocaleString()} souls</span>. Survival, but barely.`);
        } else {
            epilogues.push(`Colony population: <span style="color: #ff4444;">${finalPop.toLocaleString()} souls</span>. The colony clings to existence.`);
        }
        epilogues.push(`</div>`);

        // Specific epilogue based on planet type and ending
        epilogues.push(`<div style="margin-top: 15px; line-height: 1.6;">`);

        // Type-specific epilogues
        if (type === 'EDEN') {
            epilogues.push(`The children of Eden have never known hardship. They study the recordings of Earth with the same detachment we felt watching nature documentaries. To them, extinction is an abstract concept. They have grown soft in paradise — and there is nothing wrong with that.`);
        } else if (type === 'TERRAFORMED') {
            epilogues.push(`The terraforming systems still hum beneath the soil. The third generation learned to speak their language — adjusting rainfall with a whispered request, warming the winters with a prayer to the buried machines. They are not masters of this world. They are partners with it.`);
        } else if (type === 'SINGING') {
            epilogues.push(`The children born here hear the frequency as naturally as breathing. They find our old recordings of Earth music primitive — single melodies, finite durations. For them, the planet's endless song is home. They pity us for not understanding.`);
        } else if (type === 'CRYSTALLINE') {
            epilogues.push(`The crystalline harvest continues. Each generation stores their memories in the resonating spires. Death here is not an ending — it is a transformation into eternal song. The children can speak to their great-grandparents simply by touching the right crystal.`);
        } else if (type === 'SYMBIOTE_WORLD') {
            epilogues.push(`The boundary between human and planet has blurred. The third generation can feel the forest's moods, taste the soil's chemistry, hear the warnings of approaching storms. They are no longer human in the way we understood it. They are something better adapted.`);
        } else if (type === 'MECHA' || type === 'MACHINE_WORLD') {
            epilogues.push(`The factories run themselves now. The children learn machine code before they learn to speak. Half of them have voluntary augmentations by age ten. They look at our organic bodies with something between pity and confusion.`);
        } else if (type === 'GRAVEYARD') {
            epilogues.push(`The salvage business became an economy. Ships from other colonies — yes, there are others now — come to trade for components we've catalogued. We are the galaxy's junkyard, and we are surprisingly wealthy.`);
        } else if (type === 'OCEANIC') {
            epilogues.push(`Three generations in the sea has changed us. The children can hold their breath for fifteen minutes. Some have developed the first hints of webbed fingers. In another thousand years, we may not recognize our descendants. They will not mourn the loss.`);
        } else if (type === 'ICE_WORLD' || type === 'FROZEN_OCEAN') {
            epilogues.push(`Life in the deep is quiet. The bioluminescent ecosystems have become our gardens, our farms, our art. The children dream in colors we cannot see. When they visit the frozen surface, they weep at the stars — so bright, so cold, so impossibly distant.`);
        } else if (type === 'VOLCANIC') {
            epilogues.push(`We harnessed the planet's rage. Geothermal power flows endlessly. The children have never known a cold night. They build their homes from cooled lava, carving intricate patterns that glow faintly in the dark. Fire is their friend.`);
        } else if (type === 'ROGUE') {
            epilogues.push(`In the eternal dark, we became philosophers. Without seasons, without day and night, time became abstract. The children measure their lives in completed projects, not years. They have no concept of haste. Eternity is their inheritance.`);
        } else if (viability === 'POOR' || viability === 'MARGINAL') {
            epilogues.push(`Survival here remains a daily battle. But the children born in hardship know nothing else. They are tough, resourceful, suspicious of comfort. If another extinction event ever comes for humanity, these descendants will outlast it.`);
        } else {
            // Generic good ending
            epilogues.push(`The stories of the journey have become legend. The crew of the EXODUS-9 are remembered as saints, sinners, heroes, and fools — depending on who tells the tale. The truth is simpler: they were human. They survived. And because they survived, so did the species.`);
        }

        epilogues.push(`</div>`);

        // Crew memorials
        epilogues.push(`<div style="margin-top: 15px; color: #666; font-size: 0.9em;">`);
        const crewMemorials = [];

        livingCrew.forEach(c => {
            const name = c.realName ? c.realName.split(' ')[1] : c.name;
            if (c.tags.includes('LEADER')) {
                crewMemorials.push(`Commander ${name}'s statue stands in the central plaza. Every child learns their name.`);
            } else if (c.tags.includes('MEDIC')) {
                crewMemorials.push(`The ${name} Medical Center treats patients who never knew the doctor's face.`);
            } else if (c.tags.includes('ENGINEER')) {
                crewMemorials.push(`${name}'s original tools are preserved in glass. They built the foundation of everything.`);
            } else if (c.tags.includes('TECH')) {
                crewMemorials.push(`The ${name} Archive contains every transmission, every log, every memory.`);
            } else if (c.tags.includes('SCOUT')) {
                crewMemorials.push(`${name}'s maps still guide exploration teams into unknown territory.`);
            }
        });

        if (crewMemorials.length > 0) {
            epilogues.push(crewMemorials.join(' '));
        }

        epilogues.push(`</div>`);

        // Final line
        epilogues.push(`<div style="margin-top: 20px; color: #00ff88; font-style: italic; text-align: center;">`);
        epilogues.push(`"The stars remember what we did here."<br>— inscription on the Landing Memorial`);
        epilogues.push(`</div>`);

        return epilogues.join('');
    }
}
