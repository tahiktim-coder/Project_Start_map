# Architecture: Loot & Probe Mechanics

> "**Loot is Logic.** We do not use pure random number generation. We use a Weighted Pool System driven by Planet Scarcity."

## 1. The Core Variable: Abundance
The Probe System reads the `planet.resources` values to build the "Loot Pool".

| Resource Value | Visual HUD | Tier ID | Effect |
|:---|:---|:---|:---|
| **0 - 29** | SCARCE / LOW | `METALS_SCARCE` | High failure rate. 1-3 yield. |
| **30 - 69** | MODERATE | `METALS_COMMON` | Standard gameplay. 10-25 yield. |
| **70 - 100** | RICH / ABUNDANT | `METALS_RICH` | Jackpot. 40-80 yield. |

## 2. The "Empty Bucket" Theory
To simulate scarcity, we use a weighted competition model.
1.  **The Bucket** starts with 100 "Trace Element" tickets (Low Value).
2.  **The Planet** adds tickets based on its stats.
    *   *Scarce World*: Adds 20 Metal Tickets. (You have ~16% chance to find metals).
    *   *Rich World*: Adds 100 Metal Tickets. (You have ~50% chance to find metals).

This ensures players *feel* the difference between a barren rock and a mining paradise.

## 3. Tag Injection (The Special Loot)
Tags inject entirely new pools into the bucket.

*   `ANCIENT_RUINS` -> Adds `LORE_ANCIENT` Pool (Weight 40).
    *   *Effect*: You might find a text log instead of metal.
*   `VITAL` (Type) -> Adds `BIO_STANDARD` Pool (Weight 40).
    *   *Effect*: You might find Fungi/Amber.

## 4. Item Logic (`Items.js`)
Loot isn't just numbers. We have defined Items with specific uses.
*   **Resources**: Metals/Energy (Currency).
*   **Salvage**: `Scrap Plating` (Convertible to Metals).
*   **Lore**: `Tech Fragment` (Data/Story).

## 5. The Probe Cycle (`ProbeSystem.js`)
1.  **Launch**: Deduct 1 Probe. (Future: Deduct Energy?).
2.  **Damage**: Calculate Hull Loss based on Planet Hazards (Heat/Gravity).
3.  **Loot**: Roll on the Weighted Pool.
4.  **Reward**: Return result (Message + Inventory Update).

---

## Scalability Note
To add new items:
1.  Define Item in `Items.js`.
2.  Create a Pool in `LootTables.js` (e.g., `CRYSTAL_POOL`).
3.  Creating a Rule in `LootTables.js` (e.g., `if (tag == 'CRYSTAL') use 'CRYSTAL_POOL'`).
