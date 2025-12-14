# Architecture: Event & Encounter Systems

> "**Events are Reactions.** The universe reacts to your presence based on the environment you disturbed."

## 1. The Trigger System (`Events.js`)
Events are not random. They are triggered by **Matching Criteria** against the Planet.

```javascript
{
    id: "TECTONIC_SHIFT",
    trigger: (planet) => planet.type === 'VOLCANIC', // Context-Aware
    riskMod: 1.5 // Multiplies Probe Damage / EVA Risk
}
```

## 2. Event Types

### A. EVA Events (Crew Action)
Triggered by the "DEPLOY EVA TEAM" button.
*   **Cost**: -5 Energy.
*   **Risk**: High (Crew Death possible).
*   **Logic**:
    1.  Filter `EVENTS` list for valid triggers (e.g., must be Volcanic).
    2.  Pick 1 Event.
    3.  Present Choice Modal.

### B. Probe Events (Passive Discovery)
Triggered by "LAUNCH PROBE" button.
*   **Logic**: Driven by `LootTables.js`.
*   **Outcome**: Usually Lore or Items, not interactive choices.
*   **Future**: Could trigger "Anomaly Revealed" popup.

## 3. The Tag Connection
Tags are the primary drivers for specific events.

| Tag | Unlocks Event ID | Flavor |
|:---|:---|:---|
| `ALIEN_SIGNALS` | `ROGUE_AI` | "A satellite locks onto your suit frequency." |
| `ANCIENT_RUINS` | `MIRAGE_VISION` | "The geometry of the ruins hurts your eyes." |
| `VITAL_FLORA` | `HIVE_MIND` | "The plants seem to move when you aren't looking." |
| `HIGH_RISK` | `TECTONIC_SHIFT`| "The ground beneath the lander cracks." |

## 4. Risk & Reward
Events are the primary way to gain **High Value Items** (Lore, Tech) but also the only way to lose **Crew**.
*   **Choice A**: High Risk / High Reward. "Enter the cave."
*   **Choice B**: Low Risk / Low Reward. "Scan from outside."

---

## Scalability Note
To add a new event:
1.  Add entry to `Events.js`.
2.  Define the `trigger` function (e.g., `p => p.type === 'OCEANIC'`).
3.  Define the Choices/Rewards.
