class EndingSystem {

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

        const symbiotes = livingCrew.filter(c => c.tags && c.tags.includes('HIVE_MIND')).length;
        const cyborgs = livingCrew.filter(c => c.tags && c.tags.includes('MACHINE_LINK')).length;
        const hasUpgrades = (id) => state.upgrades && state.upgrades.includes(id);

        let success = true;
        let title = "UNKNOWN";
        let acts = [];

        // --- ACT 1: SURVIVAL (The Landing) ---
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
            acts.push("It is perfect. Too perfect. The weather runs on a schedule. The fruit has no seeds. We are comfortable, but we feel like pets in a cage.");
            title = "THE GILDED CAGE";
        } else if (type === 'CRYSTALLINE') {
            acts.push("The crystals sing. We learned to shape them with sound. Our cities are cathedrals of light and song.");
            title = "THE RESONANCE";
        } else if (type === 'ROGUE') {
            acts.push("In the eternal dark, we found warmth deep below. We built a bioluminescent society in the caverns. The surface is death, but the deep is life.");
            title = "CHILDREN OF THE DARK";
        } else {
            // Standard Landing Variance
            const variants = [
                "The landing was rough, but the prefab modules held. We established a perimeter near a river delta.",
                "We touched down in a high valley, defensible and rich in minerals. The view of the twin moons is spectacular.",
                "The ship took damage on reentry, becoming a permanent monument. We built our town around its hull."
            ];
            acts.push(variants[Math.floor(Math.random() * variants.length)]);
        }

        // --- ACT 2: SOCIETY (The People) ---
        if (success) {
            // Dark Revival Influence overrides everything
            if (symbiotes >= 2) {
                acts.push("The revival process changed us. The Mycelium Network connects our minds. We no longer speak; we *know*. We are the planet.");
                title = "CHORUS OF THE FLESH";
            } else if (cyborgs >= 2) {
                acts.push("Flesh is weak. With the Neural Links active, we replaced our failing organs with circuitry. The colony is efficient, cold, and eternal.");
                title = "SILICON IMMORTALITY";
            } else if (hasLife) {
                if (hasMedic) {
                    acts.push(`Under Cmdr. ${commander ? commander.realName.split(' ')[1] : 'Unknown'}'s guidance, our med-teams synthesized a vaccine. We walk the surface without suits now.`);
                } else {
                    acts.push("The microbial life was aggressive. We were forced to genetically modify our children to digest the local flora.");
                }
            } else {
                // Sterile/Empty World Variance based on Roles
                if (hasEng && state.metals > 100) {
                    acts.push("With ample metal and skilled engineers, we didn't just survive; we built. Massive automata tend the hydroponics while we focus on research.");
                } else if (commander) {
                    acts.push(`Commander ${commander.realName.split(' ')[1]} enforced strict discipline. Our society is martial, organized, and resilient. Chaos is the enemy.`);
                } else {
                    acts.push("Without alien life to study, we turned inward. Philosophy, art, and virtual realities flourished in the safety of the domes.");
                }
            }
        }

        // --- ACT 3: LEGACY (The Future) ---
        if (success) {
            if (symbiotes >= 2) {
                acts.push("We have abandoned the stars. Why leave, when the soil sings to us?");
            } else if (cyborgs >= 2) {
                acts.push("We calculate that the Exodus-1 is no longer needed. We have uploaded our consciousness to the planetary grid.");
            } else if (hasTech || hasUpgrades('sensor_v2')) {
                acts.push("With the advanced sensor data and precursor relics, we unlocked FTL travel. We are the Guardians of this sector.");
                if (title === "UNKNOWN") title = "STELLAR ASCENDANCY";
            } else if (state.metals > 250) {
                acts.push("The mountains were rich in ore. We built a fleet of conquerors and set out to reclaim the stars.");
                if (title === "UNKNOWN") title = "INDUSTRIAL EMPIRE";
            } else {
                // Variance for Standard "Quiet Remnant"
                const endings = [
                    { t: "THE QUIET REMNANT", m: "We survive. We are small, isolated, but we are free. The EXODUS-1 hangs in the sky as a monument to our journey." },
                    { t: "THE ARCHIVISTS", m: "We dedicated ourselves to preserving the history of Earth. We are the library of the lost." },
                    { t: "THE EXPANSION", m: "Generations passed. We filled the valley, then the continent. We are no longer colonists; we are natives." }
                ];
                const choice = endings[Math.floor(Math.random() * endings.length)];
                if (title === "UNKNOWN") title = choice.t;
                acts.push(choice.m);
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

    static getColonyOutcome(planet) {
        const mockState = window.app ? window.app.state : { metals: 0, crew: [], upgrades: [] };
        return this.generateOutcome(planet, mockState);
    }
}
