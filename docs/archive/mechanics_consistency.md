# System Architecture & Scalability Guide

> "Everything is connected. A tag on a planet changes the loot you find, the events you face, and the ending you earn."

This document details the **Deep Connections** between the game's systems. It serves as the architecture manual for understanding how the procedural generation creates a cohesive experience.

---

## 1. The Core Nexus: Planet Data
Every system in the game reads from the **Planet Object**. This object is the "DNA" of the world.

```javascript
Planet = {
    type: "VOLCANIC",       // Driver for Physics & Events
    tags: ["ANCIENT_RUINS"],// Driver for Special Loot & Lore
    resources: {            // Driver for Probe Economy
        metals: 85,         // "RICH"
        energy: 20          // "SCARCE"
    },
    metrics: {              // Driver for Endings
        gravity: 1.5,
        temp: 400,
        hasTech: true       // Derived from Tags
    }
}
```

---

## 2. The Connection Matrix
How the inputs flow into the Game Systems.

| Input Attribute | Connected System | Output Outcome |
|:---|:---|:---|
| **Resource Value** | **LootTables.js** | Determines if you get "Trace Elements" (fail) or "Massive Deposits" (success). |
| **Planet Type** | **PlanetGenerator.js** | Sets Physics (Gravity/Temp) limits. A "Frozen" world is always cold. |
| **Planet Type** | **Events.js** | Trigger logic. `VOLCANIC` triggers "Tectonic Shift". `VITAL` triggers "Hive Mind". |
| **Tags (e.g. Ruins)**| **ProbeSystem.js** | Adds `LORE_POOL` to loot. 20% chance to decipher text instead of getting rocks. |
| **Tags (e.g. Signs)**| **Events.js** | Trigger logic. `ALIEN_SIGNALS` triggers "Rogue AI Satellite". |
| **Metrics (Physics)**| **EndingSystem.js** | Determines Colony Survival. High Gravity (>2G) kills standard colonies. |

---

## 3. Deep Logic Examples

### Example A: The "Machine World" (Rich Tech)
*   **Generation**: Probe scans a world.
    *   `Type`: ROCKY (Base).
    *   `Tags`: [ANCIENT_RUINS, ALIEN_SIGNALS].
    *   `Resources`: Metals 90 (RICH), Energy 50 (MOD).
*   **Probe System**: checks `Tags`.
    *   Adds `LORE_ANCIENT` and `LORE_SIGNAL` to loot pool.
    *   **Result**: Player finds "Decrypted Log: ...servers still running..." instead of just metals.
    *   **Resource**: Player hits `METALS_RICH` pool (40-80 unit yields).
*   **Event System**: checks `Tags`.
    *   Triggers event: `ROGUE_AI` ("Satellite locks on").
    *   Triggers event: `DERELICT` ("Crashed ship found").
*   **Ending System**: checks `hasTech`.
    *   Act 1: Survival via Precursor Shields.
    *   Act 3 Outcome: "STELLAR ASCENDANCY" (Tech victory).

### Example B: The "Hell World" (Volcanic)
*   **Generation**:
    *   `Type`: VOLCANIC.
    *   `Metrics`: Temp 450°C. Gravity 1.5G.
    *   `Tags`: [HIGH_RISK].
*   **Probe System**:
    *   Loot: `ENERGY_RICH` (Magma harvesting).
    *   Risk: `HIGH` (30% chance of probe destruction per launch).
*   **Event System**:
    *   Triggers: `TECTONIC_SHIFT`, `SOLAR_FLARE`.
*   **Ending System**:
    *   Act 1: "Atmospheric processors clogged." (Failure) unless Tech saves them.

---

## 4. Scalability Protocol: Adding New Content
To add a new concept (e.g., a "Flesh World"), follow this **4-Step Flow**.

### Step 1: Define the Tag (PlanetGenerator)
Add logic to generating the tag.
```javascript
// PlanetGenerator.js
if (random < 0.1) tags.push('FLESH_TERRAIN');
```

### Step 2: Define the Loot (LootTables)
What do you find there?
```javascript
// LootTables.js
FLESH_POOL: [{ type: 'ITEM', item: ITEMS.DNA_SAMPLE, weight: 50 }];
// Rule
{ criteria: p => p.tags.includes('FLESH_TERRAIN'), pool: 'FLESH_POOL' }
```

### Step 3: Define the Event (Events.js)
What happens there?
```javascript
// Events.js
{ 
    id: 'DIGESTION', 
    trigger: p => p.tags.includes('FLESH_TERRAIN'),
    title: "THE GROUNDUNGERS", ... 
}
```

### Step 4: Define the Ending (EndingSystem)
How does it end?
```javascript
// EndingSystem.js
if (tags.includes('FLESH_TERRAIN')) {
    acts.push("We did not build houses. We grew them. The planet feeds us, and we feed it.");
    title = "SYMBIOSIS";
}
```

---

*Verified current codebase matches this architecture as of Update 1.4.*
