# Architecture: The Planet Core

> "**The Planet is the Seed.** Every mechanic in the game—Loot, Events, Hazards, and Endings—is a direct function of the Planet Object."

## 1. The Data Structure
The `Planet` object is generated once by `PlanetGenerator.js` and persists for the duration of the visit. It is the Source of Truth.

## 1. The Data Structure
The `Planet` object is generated once by `PlanetGenerator.js`.

### Example Instance (What a generated planet looks like)
```javascript
const Planet = {
    // IDENTITY
    id: "p-17028492-xyz",
    name: "Helios-4 Prime",
    type: "VOLCANIC",       // <--- THE DRIVER
    desc: "Active tectonic activity. Magma flows detected.",

    // PHYSICS (Context-Aware)
    // Used for textual display in UI
    gravity: "1.60G",
    temperature: "450°C",
    atmosphere: "TOXIC",

    // METRICS (Logic Layer)
    // Used for Math/Calculations (EndingSystem, etc)
    metrics: {
        gravity: 1.6,       // Number
        temp: 450,          // Number
        hasLife: false,     // Boolean (Derived from Type/Tags)
        hasTech: true       // Boolean (Derived from Tags)
    },

    // RESOURCES (The Economy)
    resources: {
        metals: 85,         // "RICH" range (>70)
        energy: 15,         // "SCARCE" range (<30)
        anomalies: 1        // 1 = Present, 0 = Absent
    },

    // NARRATIVE TRIGGERS
    // Used to unlock specific events and loot pools
    tags: ["ANCIENT_RUINS", "HIGH_RISK"]
};
```

---

## 2. The Driver: Planet Type
The `Type` is the master variable. It sets strict boundaries for Physics (Immersion).

| Type | Gravity Range | Temp Range | Atmosphere |
|:---|:---|:---|:---|
| **ROCKY** | 0.5 - 1.5G | -100 to +50°C | Thin/None |
| **GAS_GIANT**| 2.0 - 10.0G| -150 to -50°C | Toxic |
| **ICE_WORLD**| 0.5 - 1.5G | -200 to -20°C | Thin |
| **VOLCANIC** | 0.8 - 2.0G | +100 to +500°C| Toxic |
| **DESERT** | 0.8 - 1.6G | +40 to +120°C | Breathable |
| **VITAL** | 0.9 - 1.2G | +15 to +35°C | Breathable |
| **TOXIC** | 0.8 - 1.6G | -50 to +150°C | Corrosive |

*Rule: Detailed Physics generation logic resides in `PlanetGenerator.generatePlanet()` switch statements.*

---

## 3. The Economy: Resources
Resources are generated relative to the Type (e.g., Volcanic = High Energy).
*   **SCARCE** (<30): The planet has almost nothing. Loot Tables will return Trace Elements.
*   **MODERATE** (30-70): Standard yields.
*   **RICH** (>70): Massive yields. High profitability.

---

## 4. The Narrative: Tags
Tags are boolean flags that enable specific content in downstream systems.

*   `ANCIENT_RUINS`: Enables `LORE_ANCIENT` in LootTables and `DERELICT` in Events.
*   `ALIEN_SIGNALS`: Enables `LORE_SIGNAL` in LootTables and `ROGUE_AI` in Events.
*   `HIGH_RISK`: Increases Probe Damage and enables dangerous Events.
*   `VITAL_FLORA`: Enables `BIO_STANDARD` loot.

---

## Conclusion
To add a new feature to the game, **start by defining it on the Planet**.
*   Want a "Crystal World"? Add `CRYSTAL` Type.
*   Want "Ghost Encounters"? Add `HAUNTED` Tag.
