# Architecture: Dynamic Endings

> "**The Colony is the Goal.** The game is about finding a home, and that home is defined by the planet you chose."

## 1. The 3-Act Structure (`EndingSystem.js`)
We do not have pre-written endings. We have a procedural story generator that creates a 3-paragraph history of your colony.

### Act 1: Arrival (Survival)
*   **Question**: Did the colony survive the first 50 years?
*   **Filter**: Checks `Planet Type` vs `Danger`.
*   *Logic*: If `Gravity > 2.0`, colony fails ("Roche Limit Disaster") UNLESS you have `Precursor Tech` or specific upgrades.

### Act 2: Adaptation (Culture)
*   **Question**: How did the colonists change?
*   **Filter**: Checks `Resources` and `Life`.
*   *Logic*:
    *   **Vital World**: Colonists become hunters/farmers ("New Eden").
    *   **High Gravity**: Colonists evolve stronger bones.
    *   **Toxic World**: Colonists live in domes/bunkers.

### Act 3: Legacy (Fate)
*   **Question**: What did they become after 500 years?
*   **Filter**: Checks `Tech`, `Metals`, and `Stability`.
*   *Logic*:
    *   **High Tech**: "Stellar Ascendancy" (They become the new aliens).
    *   **High Metals**: "Industrial Empire" (They conquer the sector).
    *   **Low Resources**: "The Quiet Remnant" (They barely survive).

## 2. The Logic Matrix

| Planet Feature | Act 1 Threat | Act 2 Mutation | Act 3 Outcome |
|:---|:---|:---|:---|
| **VOLCANIC** | Heat/Magma | Nocturnal Life | Geothermal Powerhouse |
| **ICE_WORLD** | Cold/Freeze | Subterranean Life | Cryo-Stasis Keepers |
| **GAS_GIANT** | Gravity Shear | Cloud Dwellers | Atmospheric Harvesters |
| **VITAL** | Bacteria/Beasts | Bio-Symbiosis | Utopia |

## Scalability Note
To add a new ending:
1.  Open `EndingSystem.js`.
2.  Add a new condition in the Act 1/2/3 blocks (e.g., `if (planet.tags.includes('FLESH')) ...`).
3.  Write the text snippet.
