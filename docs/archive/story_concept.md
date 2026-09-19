# Story & Narrative Concept: "The Silent Exodus"

## 1. Core Theme: "The Graveyard of Hope"
Instead of exploring a fresh new galaxy, you are traversing the path of failed attempts. The "Terrible First Planets" aren't just naturally bad—they are *ruined*.
*   **Atmosphere:** Industrial decay, cosmic horror, isolation.
*   **The Twist:** You aren't the first ship. You're the cleanup crew (or the last desperate shot).

## 2. The Crew (Archetypes)
The current placeholders (`Shepard`, `Isaac`) break immersion. We need original characters that represent different reactions to the "End of the World."

| Role | Name (Sug.) | Archetype | Gameplay Function |
| :--- | :--- | :--- | :--- |
| **Commander** | **YOU** | The Burdened Leader | Makes the choices. manages the resources. |
| **Engineer** | **Jaxon** | The Pessimist | Complaints about ship status. Warns about structural failure. "This bucket won't hold." |
| **Medic** | **Dr. Aris** | The Humanist | Cares about the crew's health. Begs you not to take risks. "They need rest, Commander." |
| **Specialist** | **Vance** | The Survivor | Cold, pragmatic. Willing to sacrifice others. "Oxygen is for the living." |
| **AI** | **A.U.R.A.** | The Glitched Optimist | Tries to be helpful but provides disturbing statistics. "Survival probability: 4%... Have a nice day!" |

## 3. Narrative Delivery Systems
How to make the story "playable" without long cutscenes.

### A. The "Bark" System (Dynamic Chatter)
Crew members comment on your actions in real-time (floating text or log entries).
*   **Scanning a Toxic World:**
    *   *Jaxon:* "Sensors picking up acid rain. My hull plating can't take much more of this."
    *   *Aris:* "There's nothing alive down there. Let's move on."
*   **Low Food/Energy:**
    *   *Vance:* "We should cut rations. Starting with the sick ones."

### B. "Found Footage" Logs
When you scan a planet, you don't just find "Metals." You find traces of previous ships (`Exodus-1`... `Exodus-4`...).
*   **Common Find:** "Crashed Escape Pod. Empty."
*   **Rare Find:** "Audio Log: 'It's in the walls! Don't open the—'"

### C. Sector Events (The "Campfire")
Between sectors (during the jump), a text event occurs.
*   *Example:* "The crew is arguing about the dwindling food supplies. Jaxon wants to open the emergency reserves. Aris says we need to save them."
    *   **Option A:** Open Reserves (+Morale, -Food)
    *   **Option B:** Stay the course (-Morale)

## 4. Gameplay Integration ("Story as Mechanics")

### Sanity & Morale System
*   **Metric:** A hidden (or visible) `Sanity` meter for each crew member.
*   **Triggers:** Visiting "Terrible" planets, Starvation, High Radiation.
*   **Consequences:**
    *   *Low Sanity Engineer:* Might refuse to repair the ship. "What's the point?"
    *   *Low Sanity Medic:* Might accidentally waste supplies.
    *   *Breakdowns:* A crew member might hallucinate a "Paradise Planet" that is actually a gas giant.

### The "Terrible Start" Curve
*   **Sector 1 (The Graveyard):** High debris, low resources, ominous logs. High stress.
*   **Sector 2 (The Void):** Empty space, distance between stars increases. Fuel becomes critical.
*   **Sector 3 (The Signal):** You finally detect something... but is it friendly?

## 5. Implementation Plan
1.  **Rename/Redefine Crew:** Update `state.js` with new names and "traits."
2.  **Add Bark System:** Create a `NarrativeManager` that listens for events (`SCAN_COMPLETE`, `WARP_START`) and triggers lines.
3.  **Enhance Planet Generation:** Add "Ruins" and "Wreckage" tags to `PlanetGenerator`.
4.  **UI Update:** Add a "Comms" or "Chatter" window to the main view.
