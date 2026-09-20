# 07 · Status, Known Gaps & Cleanup

The game is **near-complete and playable end-to-end** (Sector 1 → THE STRUCTURE). This page
is the honest punch-list, gathered from a full code read on 2026-06-22.

## What's complete & working
Core loop · 6 sectors + hazards · 30 planet types · scan/probe/EVA · crew stress, traits &
breakdowns · starvation/healing · ship decks & malfunctions · ~130 encounters · the
procedural ending engine (60+ outcomes) + 50-year epilogues · THE STRUCTURE endgame (8
endings) · A.U.R.A. ethics + sabotage + premonitions · bark chatter · narrative modal ·
save/load + auto-save · audio (SFX + music) · inline tutorial.

## Highest-value gap — the secret ending isn't wired
- The lore (Exodus Log 8) and `EndingSystem.getSecretEnding()` both implement
  **"THE ANSWER"** (collect all 8 logs → transmit at the door → time-loop reveal).
- **But there is no "TRANSMIT ARCHIVE" choice in `StructureEncounter.js`** that checks
  `state.exodusLogsFound.length >= 8` and calls it. The payoff the whole metaplot builds to
  is currently unreachable. **Fix:** add a 5th Structure choice, gated on 8 logs, that calls
  the secret ending. (Also: no UI currently shows how many of the 8 logs you've found.)

## Known bugs / fragile spots
| Where | Issue |
|-------|-------|
| `Events.js` GHOST_SHIP | title typo "UNKOWN VESSEL"; CRYOSLEEP_POD reads `planet.metrics.hasTech` without a null guard (can throw) |
| `EndingSystem.js` | branch checks `type === 'ICE'` but the generator emits `ICE_WORLD` → that deep-ocean text is unreachable |
| `BarkSystem.js` | `FIRST_CREW_DEATH` is registered as a one-time trigger but has **no lines** in `BARK_DATA` (can never fire) |
| `AnomalyEncounters.js` FOLD | calls `PlanetGenerator`/`SECTOR_CONFIG` without null guards on the success branch |
| `AuraSystem.js` | `pendingPremonition` used but never declared in constructor (works by luck) |
| Cargo cap | "X/20" and "halved to 10 when damaged" are **display-only**; nothing enforces the cap |
| `AudioSystem.js` | `sfxHorror`/`sfxTeleport` defined but not wired; stray "init remains same" leftover comment |
| `VITAL_FLORA` tag | referenced by life/event logic but **never generated** by `PlanetGenerator` (dead/legacy reference) |

## Content/design loose ends
- Structure endings ignore Colony Knowledge, log count, and POI flags (`_gardenTruth`,
  `_lighthouseBonus`, `_gravesRead`) — room for "enlightened" variants that were planned.
- `CampfireEvents.js` entries all have an empty `dialogue: []` placeholder array.
- Upgrade tree is only 4 items — thin for a 6-sector run.
- EDEN only generates in Sector 6 — confirm the EDEN colony/settle path is reachable enough.

## Recommended cleanup (low-risk)
1. **Delete dead files:** `src/state.js`, `src/main.js`, `src/generators/planet.js`,
   `src/generators/PlanetGenerator_Legacy.js`, `src/views/NavView_Legacy.js`. They're not
   loaded by `index.html`.
2. **Resolve the CrewGenerator conflict:** `src/systems/CrewGenerator.js` (Cmdr. Reyes,
   richer fields) is unloaded and conflicts with the inline version in `bundle.js`. Either
   load it and delete the inline copy, or delete the file.
3. **Decide on `TutorialSystem.js`:** wire it in (13 good tips) or delete it.
4. **Remove the legacy `metals`/`maxMetals` aliases** in `GameState` once nothing reads them
   (there's a `// TODO: Remove` already).

## Suggested next steps (if resuming polish)
1. Wire the secret ending (highest narrative ROI).
2. Add a logs-found counter to the HUD.
3. Fix the listed bugs (quick wins: ICE_WORLD branch, GHOST_SHIP guard, FIRST_CREW_DEATH lines).
4. Delete dead code so the repo matches reality.
5. Optional: expand upgrades; wire `sfxHorror` to anomaly/structure moments.
