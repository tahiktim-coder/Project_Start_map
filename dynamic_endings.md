# Project Architecture & Procedural Ending System

## 1. Project Structure Analysis: The "Bundle" Bottleneck
You asked if the recent bugs (orphaned code, syntax errors) were caused by the size of `bundle.js`.
**The Answer is Yes.**

### The Problem
We are currently maintaining a single file (`bundle.js`) with **~1,200 lines of code**.
- **Scope Bleed:** It is easy to lose track of where a Class starts and ends.
- **Merge Conflicts:** Editing different features (UI vs Logic) happens in the same file, leading to overwrite errors.
- **Maintainability:** Scrolling through 1000 lines to find `handleProbeAction` is inefficient.

### The Ideal Solution (Standard Practice)
In a professional environment, we would break this down:
```text
src/
├── core/
│   ├── GameState.js      (Data & Resources)
│   ├── App.js            (Main Logic Loop)
├── systems/
│   ├── ProbeSystem.js    (Integrity, Loot Tables)
│   ├── EvaSystem.js      (Events, Choice Logic)
│   ├── EndingSystem.js   (The new Procedural Logic)
├── data/
│   ├── items.js          (Item DB)
│   ├── events.js         (Event DB)
└── views/
    ├── OrbitView.js      (UI)
    ├── NavView.js        (UI)
```
*Why aren't we doing this?*
Because modern browsers implementing **ES Modules** (import/export) strictly block files from loading off your hard drive (`file://` protocol) due to **CORS Security Policies**. You would need to run a local web server (like `npm run dev`) to make it work. Since we operate in a simple "double-click index.html" mode, we are forced to bundle.

---

## 2. Dynamic Procedural Endings: The "Fate Matrix"

To achieve your goal of **50+ unique, emotionally resonant endings**, we cannot rely on simple "Win/Lose" flags. We must treat the Colony as a **Simulation** that runs for 500 years after the player enters stasis.

### The Data Inputs
We currently track the following variables for every planet:

| Variable | Possible Values | Narrative Impact |
| :--- | :--- | :--- |
| **PLANET TYPE** | Vital, Rocky, Desert, Oceanic, Ice, Volcanic, Gas Giant, Toxic | Sets the **Survival Difficulty** and basic **Lifestyle**. |
| **GRAVITY** | 0.1g - 4.0g | Affects **Evolution** (Tall vs Squat), Architecture, and Health. |
| **TEMP** | -200°C to +500°C | Affects **Energy Needs**, Surface Habitation vs Underground/Domes. |
| **ATMOSPHERE** | Breathable, Toxic, None, Corrosive | Determines **Freedom of Movement** (Suits vs Open Air). |
| **BIO-SIG** | None, Microbial, Mega-Fauna, Intelligent | Affects **Culture** (Peaceful, Warlike, Xeno-Biologists). |
| **TECH-SIG** | None, Ancient Ruins, Active Signals | Affects **Technological Leap** (Dark Age vs Golden Age). |
| **RESOURCES** | Metals Focus vs Energy Focus | Affects **Economy** (Industrial vs Utopian). |

### The "Era System" (Proposed Logic)
Instead of one static text, we generate a history in 3 Acts.

#### Act I: The Arrival (Years 0-50)
*Determined by Planet Hazard (Atmosphere/Temp).*
- **Success**: "The atmospheric processors stabilized the air within a decade."
- **Struggle**: "half the colonists died in the first winter."
- **Adaptation**: "We were forced to abandon the surface and tunnel into the crust."

#### Act II: The Adaptation (Years 50-300)
*Determined by Gravity & Biology.*
- **High G**: "Our children grew strong but short; bones dense as iron. We forgot the feeling of jumping."
- **Oceanic**: "We bridged the atolls. Aquaculture replaced agriculture."
- **Hostile Bio**: "The Xeno-War lasted a century. We won, but lost our humanity."

#### Act III: The Legacy (Year 500+)
*Determined by Tech & Rare Resources.*
- **Ruins Found**: "We cracked the precursor code. We are now the masters of the stars."
- **Isolation**: "We forgot Earth. We are just natives of KRYOS-4 now."
- **Extinction**: "The domes eventually failed. All that remains is the EXODUS signal, warning others away."

### Example Generated Endings

**Scenario A: The Hardened Miners**
*   **Planet**: ROCKY
*   **Grav**: 2.5g (High)
*   **Tech**: Ancient Ruins
*   **Outcome**: "The Colony survived the crushing gravity by integrating Precursor exo-skeletons. A society of warrior-engineers who eventually rebuilt the Exodus fleet to conquer the sector."

**Scenario B: The Drift**
*   **Planet**: GAS GIANT
*   **Grav**: 1.0g (Normal at altitude)
*   **Bio**: None
*   **Outcome**: "We live in the clouds. Resources are scarce, leading to a strict caste system. We are technically alive, but we are prisoners of the storm, forever looking up at stars we can no longer reach."

**Scenario C: New Eden (But Wrong)**
*   **Planet**: VITAL
*   **Bio**: Intelligent Life (Hostile)
*   **Outcome**: "The planet was perfect... for them. We were not the settlers; we were the cattle. The colony persisted as a farm for the native apex predators."

### Implementation Strategy
We will create a `generateColonyHistory(planet)` function that chains these strings together based on logic thresholds, ensuring that even two "Ice Worlds" feel different if one has Ancient Tech and the other has Hostile Fauna.
