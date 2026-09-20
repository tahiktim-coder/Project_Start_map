# 06 · Architecture

## Big picture
Vanilla JS, no framework, no build step. `index.html` loads ~25 plain `<script>` files that
each attach a **global** (`EVENTS`, `LOOT_TABLES`, `SECTOR_CONFIG`, `AuraSystem`,
`EndingSystem`, `PlanetGenerator`, `NavView`, `OrbitView`, …), then loads **`src/bundle.js`**
last. `bundle.js` is the real application — a single ~5,300-line file containing
`CrewGenerator`, `GameState`, and the giant `App` controller. It boots on `DOMContentLoaded`
as `window.app`.

> Naming note: the project both *talks about* avoiding ES modules (older docs) **and** is in
> fact split into a modular `src/` tree loaded via globals. The split modules are real and
> used; `bundle.js` is not a build artifact of them — it's hand-merged app logic that depends
> on those globals.

## Communication model
Views never call the App directly. **`NavView` and `OrbitView` emit `CustomEvent`s on
`window`** (`req-warp`, `req-action-scan`, `req-action-probe`, `req-action-eva`,
`req-sector-jump`, `req-action-structure`, …); the `App` listens and drives the loop.
`AudioSystem` also listens to these events for SFX. Both views render into the shared
`#tactical-display` right panel — the main coupling point.

## File map
**Active (runtime):**
```
index.html
src/bundle.js                      App + GameState + CrewGenerator (entry)
src/data/  Items, Upgrades, Events, CampfireEvents, ExodusDerelicts, LootTables,
           SectorConfig, ExodusLogs, FailedColonyEncounters, DerelictEncounters,
           AnomalyEncounters, LateGamePOIs, StructureEncounter, ShipEvents,
           SpaceStations, AsteroidFields, DistressSignals, CrewEvents
src/systems/ ProbeSystem, AudioSystem, EndingSystem, BarkSystem, AuraSystem, NarrativeModal
src/generators/ PlanetGenerator
src/views/ OrbitView, NavView
assets/crew/*.png, Music/*.mp3, style.css
```
**Dead / legacy (NOT loaded — safe to remove):**
```
src/state.js                 old ES-module GameState (fuel/oxygen, Shepard/TARS placeholders)
src/main.js                  old ES-module app shell
src/generators/planet.js     old 8-type generator (imported only by dead main.js)
src/generators/PlanetGenerator_Legacy.js
src/views/NavView_Legacy.js
src/systems/CrewGenerator.js  canonical roster (Cmdr. Reyes) — conflicts w/ bundle's inline version
src/systems/TutorialSystem.js 13 tips, never called
```

## GameState shape (persisted fields)
Resources (`energy, salvage, rations, probeIntegrity, _colonyKnowledge`), navigation
(`currentSector 1–6, currentSystem, lastVisitedSystem, sectorNodes`), `shipDecks{5}`,
`crew[5]` (id, name, status, stress, trait, tags, personality, heal/breakdown counters,
death info), `cargo[]`, `upgrades[]`, `actionsTaken`, `gameOver`, `exodusLogsFound[]`,
`logs[]` (cap 50), and many one-shot flags (`_tutorial*`, `_inWrongPlace`, `_auraVentCount`,
`_driveReinforced`, per-crew `_*Seen`, …). Save: `localStorage['silentExodus_save']`, JSON
`version:1`, no migration.

## Crew object
`{ id, name, realName, gender, age, portraitId, status, stress(0–3), trait, tags[],
personality, healCounter, breakdownFired, catatonicCounter, _sedatedUntilWarp, wasRevived,
_deathCause/_deathSector/_deathPlanet }`.
