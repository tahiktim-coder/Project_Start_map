# 02 · Gameplay & Core Loop

All logic below lives in `src/bundle.js` (the runtime app) unless noted.

## The core loop
```
START MENU (New Game / Continue)
   ↓ opening briefing (A.U.R.A. intro)
STAR MAP  (NavView) — 2–6 planet nodes for the current sector
   ↓ pick a planet → WARP (costs energy; re-visiting last system is free)
IN ORBIT  (OrbitView) — choose actions:
   • DEEP SCAN (2 energy)         reveal resources, tags, signals
   • LAUNCH PROBE                 take loot; probe loses integrity
   • DEPLOY EVA (5 energy,1 ration) risk injury/death for bigger rewards
   • INVESTIGATE <signal>         exodus wreck / colony / derelict / anomaly /
                                  station / asteroid / late-game POI / THE STRUCTURE
   • ESTABLISH COLONY             → procedural ending (win)
   • BREAK ORBIT                  back to star map
   ↓ when ready
SECTOR JUMP (20 energy) → warp cinematic → campfire crew event → next sector
   ↓ repeat across Sectors 1→6 ; Sector 6 contains THE STRUCTURE (endgame)
```
Every major action consumes a **ration** and advances the in-game date (date = `2342.MM.DD`,
month every 10 actions).

## Resources
| Resource | Start | Cap | Role |
|----------|-------|-----|------|
| **Energy** | 100 | 100 | Universal action/warp currency (shown as %) |
| **Salvage** | 50 | 300 | Crafting, repairs, upgrades (internally was "metals") |
| **Rations** | 20 | 30 | Time pressure; every major action eats 1 |
| **Probe Integrity** | 100 | 100 | Single reusable probe's health (~8 launches) |
| **Colony Knowledge / "Data"** | 0 | — | Meta-resource from failed-colony sites; +5% colony success per point (cap +25%), feeds endings |

## Ship decks
Five decks; each is `OPERATIONAL` or `DAMAGED`. Repair with Salvage (Jaxon alive → −30%).
| Deck | Repair | If damaged |
|------|--------|-----------|
| Bridge | 60 | Warp cost +50%, remote scan disabled |
| Laboratory | 40 | Partial scan data only |
| Crew Quarters | 50 | No passive healing / stress recovery |
| Cargo Hold | 30 | Cargo capacity halved (display only — see gaps) |
| Engineering | 80 | No probe fabrication, sector-jump cost ×2, other repairs +50% |

Damage sources: Sector-1 micrometeorites (20%/warp), Jaxon's breakdown, events, A.U.R.A.
sabotage, ship malfunctions (`src/data/ShipEvents.js`).

## Crew & stress
- **Stress** is an integer **0–3** per crew member (Commander capped at 2).
- **At stress 2** a personality-based **negative trait** is assigned:
  | Personality | Trait | Effect |
  |---|---|---|
  | Pessimist (Jaxon) | HOARDER | Fabricator costs +25% |
  | Survivor (Vance) | PARANOID | High-risk EVA choices disabled |
  | Humanist (Aris) | BLEEDING_HEART | Can't EVA while any crew injured |
  | Curious (Mira) | RECKLESS | Safe EVA option may vanish; EVA costs more |
- **At stress 3** a one-time **breakdown** fires: Jaxon sabotages a deck; Aris goes catatonic;
  Vance attempts mutiny (choice modal); Mira becomes obsessed (risky but +reward);
  **Commander → instant game over (COMMANDER_BREAKDOWN).**
- **Status:** HEALTHY → INJURED (no EVA; heals in ~3 actions if Quarters intact) → DEAD
  (death cause/sector/planet recorded). Tags: SEDATED, CONFINED, CATATONIC, plus revival
  tags HIVE_MIND / MACHINE_LINK.
- **Starvation** (rations 0): warning → all stress maxed → a maxed-stress crew member dies.

## Win conditions
1. **Establish a colony** on a viable planet → procedural ending + S/A/B/C/F rating.
2. **Reach THE STRUCTURE** (Sector 6) and choose one of its endings.
3. **EDEN world** → "Settle Here".
4. **The Wrong Place** → "Accept your fate" (a narrative ending).

## Lose conditions (`checkLoseConditions`)
- All crew dead (`CREW_LOSS`).
- 3+ decks damaged AND can't afford cheapest repair (`HULL_BREACH`).
- Commander stress ≥ 3 (`COMMANDER_BREAKDOWN`).
- Stranded: can't afford any warp, no usable items, no probe (`STRANDED`).
- A.U.R.A.'s third vent incident accepted (`AURA_MUTINY`).

## Save / load
- `localStorage` key `silentExodus_save`, plain JSON (`version: 1`, no migration).
- **Auto-saves** after warp arrival, sector jump, and EVA. Start menu shows Continue with
  sector + crew count. New Game over an existing save asks to confirm, then deletes it.

## Tutorial
The live tutorial is **inline** in `bundle.js` (A.U.R.A. lines gated by `_tutorial*` flags
on first warp/EVA/deck-damage/stress) plus the opening briefing. The standalone
`src/systems/TutorialSystem.js` (13 richer tips) is **not loaded** — dead code.
