class EndingSystem {

    static generateOutcome(planet, state) {
        // 1. Initial State & Difficulty Check
        const type = planet.type;
        const gravity = planet.metrics?.gravity || 1.0;
        const temp = planet.metrics?.temp || 20;
        const hasLife = planet.hasLife;
        const hasTech = planet.hasTech;

        let success = true; // Optimistic default, failures are specific
        let title = "UNKNOWN";
        let acts = [];

        // --- ACT 1: ARRIVAL (The first 50 years) ---
        // Determines if the colony survives the initial filter
        if (type === 'TOXIC' || type === 'VOLCANIC') {
            if (hasTech) {
                acts.push("The precursor shields we found in the ruins were the only thing that saved us from the acid rain. We built our city inside the ancient domes.");
            } else {
                success = false;
                title = "ATMOSPHERIC FAILURE";
                acts.push("The atmospheric processors clogged within months. The corrosive air dissolved the seals of the hab-modules. We sent a distress signal, but we know no one is coming.");
            }
        } else if (type === 'GAS_GIANT') {
            if (gravity > 2.0) {
                success = false;
                title = "ROCHE LIMIT DISASTER";
                acts.push("The orbital platform drifted too low. The gravity shear tore the station apart before we could stabilize the thrusters.");
            } else {
                acts.push("Life in the clouds is precarious. We harvest hydrogen and live in suspended cities, forever fearful of the storms below.");
            }
        } else if (temp < -100) {
            acts.push("The surface was uninhabitable. We drilled deep into the crust, tapping geothermal vents for warmth. The sun is just a memory now.");
        } else if (temp > 150) {
            acts.push("We live by night. The day-side temperature forces us into hibernation/stasis bunkers until sunset. Our culture has become nocturnal.");
        } else {
            acts.push("The landing was rough, but the prefab modules held. We established a perimeter and began the long work of terraforming.");
        }

        // --- ACT 2: ADAPTATION (Years 50-300) ---
        // How biology and culture shift
        if (success) {
            if (hasLife) {
                if (type === 'VITAL') {
                    acts.push("The local fauna was hostile, but delicious. We became apex predators, hunting the mega-beasts for protein. Our society respects strength above all.");
                } else if (hasTech) {
                    acts.push("We integrated the native spores with the ancient machines. The result is a bio-mechanical symbiosis that keeps us alive, though we are no longer purely human.");
                } else {
                    acts.push("The microbial life infected our crops. Famine nearly broke us, until we adapted our own digestive systems using gene-editing.");
                }
            } else {
                // Sterile world adaptation
                if (gravity > 1.5) {
                    acts.push("High gravity reshaped us. We are shorter, stronger, and our bones are dense as steel. Earth-born humans would be crushed here.");
                } else if (gravity < 0.5) {
                    acts.push("In the low gravity, we grew tall and spindly. We glide between towers on winged suits. The concept of 'walking' is archaic.");
                } else {
                    acts.push("Without alien life to study, we turned inward. Philosophy and art flourished in the sterile domes.");
                }
            }
        }

        // --- ACT 3: LEGACY (Year 500+) ---
        // The ultimate fate
        if (success) {
            if (hasTech) {
                title = "STELLAR ASCENDANCY";
                acts.push("With the Precursor data, we unlocked FTL travel without the warp-gates. We have become the Guardians of this sector.");
            } else if (type === 'VITAL') {
                title = "NEW EDEN";
                acts.push("We forgot Earth. This is our home now. We live in harmony with the planet, a utopia of green and blue.");
            } else if (state.metals > 200) {
                title = "INDUSTRIAL EMPIRE";
                acts.push("The mountains were rich in ore. We built a fleet of conquerors and set out to reclaim the stars.");
            } else {
                title = "THE QUIET REMNANT";
                acts.push("We survive. We are small, isolated, but we are free. The EXODUS-1 hangs in the sky as a monument to our journey.");
            }
        }

        // Fallback for logic gaps
        if (acts.length === 0) acts.push("Data Corrupted.");

        return {
            success: success,
            title: title,
            text: acts.join("<br><br>")
        };
    }

    // Helper for main bundle to call
    static getColonyOutcome(planet) {
        // We need 'state' for some checks (like metals/resources), but planet is main driver.
        // Assuming we can access the singleton or pass it. 
        // For now, let's grab the global state if available, or mock it.
        const mockState = window.app ? window.app.state : { metals: 0 };
        return this.generateOutcome(planet, mockState);
    }
}
