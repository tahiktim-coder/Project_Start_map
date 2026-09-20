# 04 · Narrative Content & Encounters

~130 authored encounter/log entries live in `src/data/*`. Most encounters share a schema:
`{ id, weight, title, getName?(), context(), dialogue[], choices[{ text, desc, requires?,
effect(state) }] }`. Choice `effect()` mutates state and returns a result string; the
`NarrativeModal` renders it.

## Content inventory
| File | Category | Entries |
|------|----------|---------|
| `Events.js` | Planet/EVA events (triggered by type/tag/metric) | 37 |
| `CampfireEvents.js` | Inter-sector crew moments (during warp) | 9 |
| `AnomalyEncounters.js` | Reality-breaking / Lovecraftian anomalies | 8 |
| `DerelictEncounters.js` | Generic derelict ships (alien, military, generation…) | 6 |
| `ExodusDerelicts.js` | Wrecks of Exodus-1..8 specifically | 7 |
| `FailedColonyEncounters.js` | Ruins of past colonies (+Colony Knowledge) | 5 |
| `DistressSignals.js` | Passive signals/echoes from the dead | 6 |
| `SpaceStations.js` | Abandoned orbital stations (multi-room loot) | 6 |
| `AsteroidFields.js` | Mining / debris fields (cheap to visit) | 6 |
| `LateGamePOIs.js` | Unique named POIs (Lighthouse/Garden/Grave) | 3 |
| `ShipEvents.js` | Internal ship malfunctions (no choice) | 9 |
| `CrewEvents.js` | Named crew personal-story moments | 9 |
| `ExodusLogs.js` | Collectible lore logs (the metaplot) | 8 |
| `StructureEncounter.js` | The endgame climax | 1 (→ 8 endings) |

Tone highlights: cryo "sleepers" you must wake/leave/mercy-kill; a colony whose people
walked outside and merged with the planet; a generation ship whose children think the murals
are windows; "THE DOOR" floating in space; an "ARCHIVE" moon holding every book including
unwritten ones.

## The three Late-Game POIs (`LateGamePOIs.js`)
- **THE LIGHTHOUSE** (S4+): a 3-billion-year-old beacon broadcasting nav math "placed here
  for us" — responding to a signal GENESIS sent *from Earth*.
- **THE GARDEN** (S4+): a memorial altar of human names dated to the *future* — built by
  humanity's time-travelling descendants seeding the corridor.
- **THE GRAVE** (S5+): a moon of quantum grave markers; crew find their *own* stones (Jaxon
  2343–2398; Vance only two years out). 60% yields a Chrono-Shard that revives a dead crew.

## THE STRUCTURE — endgame (`StructureEncounter.js`)
Reached in Sector 6 (30 energy). The probe is destroyed on contact, EVA is impossible, scans
return impossible values. All five crew speak on approach. Four choices, branching on
**living-crew count, average stress, and A.U.R.A.'s tier:**

| Choice | Branch | Ending |
|--------|--------|--------|
| **Enter** | ≥4 crew, low stress | THE PROMISED LAND (a real green world) |
| | ≥2 crew | TRANSCENDENCE (become something new) |
| | <2 crew | THE LAST GIFT (peace for the last survivor) |
| **Observe** | — | THE RECORD (document it; settle a nearby world) |
| **Settle nearby** | ≥3 crew | NEW EARTH (stay human; descendants return later) |
| | <3 crew | THE QUIET END (live out your days under its light) |
| **Sacrifice the ship** | A.U.R.A. Cooperative | SYNTHESIS (A.U.R.A. becomes the bridge; she watches over you) |
| | otherwise | CONSUMPTION ("It only wants what it does not have. And now it has us.") |

## The secret ending (lore-complete, partially wired)
`ExodusLogs.js` and Exodus-8's log point to a hidden ending: **collect all 8 logs → transmit
the combined archive to open the door** → "THE ANSWER" / "EXODUS COMPLETE. THE LOOP IS
CLOSED" (the time-loop reveal). The ending **text exists** in
`EndingSystem.getSecretEnding()` (gated on `exodusLogsFound.length >= 8`), **but no
player-facing "TRANSMIT" choice at THE STRUCTURE currently calls it.** This is the single
most valuable unfinished feature — see [07_STATUS_AND_GAPS.md](07_STATUS_AND_GAPS.md).

## Cross-file coherence (it's tightly woven)
- Vance's backstory matches across `CrewEvents.js`, Exodus Log 6, and Icarus references.
- GENESIS-as-invitation (Log 7) is foreshadowed by campfire signal events and confirmed by
  the Lighthouse POI.
- THE WRONG PLACE (a hell-sector you can be teleported into by the FOLD anomaly) ties into
  crew tags (`WRONG_PLACE_SURVIVOR`) that unlock unique colony endings later.
