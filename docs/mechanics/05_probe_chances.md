# Mechanic: Probe Probability & Logic

> "The Probe is not a magic wand. It is a fragile tool that trades Durability for Resources."

## 1. Durability & Damage
Values are calculated *per launch*.

### Base Decay
Every launch deals **10 - 20% Damage**.
*   *Max Lifespan*: 10 Launches (Perfect rolls).
*   *Avg Lifespan*: ~7 Launches.

### Hazard Modifiers (Additive)
Planets with hostile conditions strip additional integrity.

| Hazard Type | Damage Mod | Example Condition |
|:---|:---|:---|
| **High Gravity** (Gas Giant) | +15% | Pressure crush |
| **Volcanic** | +15% | Heat stress |
| **Corrosive** (Toxic) | +10% | Acid burn |
| **High Risk** (Tag) | +10% | Turbulence |

*Example Scenario*:
A **Volcanic High-Risk** planet.
Base (15) + Heat (15) + Risk (10) = **40% Damage per launch**.
The probe will survive **2 launches**.

---

## 2. Loot Generation (The "Bucket")
We use a **Weighted Lottery** system.

### Step 1: The Base Pool (Null Result)
The bucket always contains "Trace Elements" tickets.
*   **Trace Metals**: Weight 50. (Yield: 1-3)
*   **Trace Energy**: Weight 50. (Yield: 1-3)
*   *Base Total Weight*: 100.

### Step 2: The Planet Injection
The Planet Type & Resources inject beneficial tickets.

| Planet State | Pool Injected | Weight Added | Chance to Hit (Approx) | Yield (Avg) |
|:---|:---|:---|:---|:---|
| **Scarce** | `METALS_SCARCE` | +20 | 16% | 3-5 |
| **Moderate** | `METALS_COMMON` | +60 | 37% | 5-15 |
| **Rich** | `METALS_RICH` | +100 | 50% | 15-30 |

### Step 3: Tag Injection (Special)
Tags add high-value pools.

| Tag | Pool | Weight | Content |
|:---|:---|:---|:---|
| `ANCIENT_RUINS` | `LORE_ANCIENT` | +40 | Data Logs / Story |
| `VITAL` | `BIO_STANDARD` | +40 | Fungi / Amber |

---

## 3. The Algorithm
1.  Create empty Bucket.
2.  Add `NULL_RESULT` (100 tickets).
3.  Check Planet Resources -> Add `METALS_X` tickets.
4.  Check Planet Tags -> Add `SPECIAL_X` tickets.
5.  Pick 1 Ticket randomly.

This ensures:
*   You CAN find nothing on a Rich world (bad luck).
*   You CAN find Gold on a Scarce world (rare).
*   But statistically, Rich worlds pay out way more.
