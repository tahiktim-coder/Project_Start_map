# PROJECT STAR MAP — "The Silent Exodus" · Documentation

> **Status: near-complete, playable.** This doc set was rebuilt on 2026-06-22 directly
> from the source code (it is the source of truth). Older docs in this folder describe an
> early ~1,200-line prototype and are kept only for history — see "Document map" below.

## What the game is
A browser-based, single-player **narrative survival roguelike**. You command the colony
vessel **EXODUS-9**, the last of nine ships, across a graveyard of failed colonies toward
a final alien megastructure. You scan ruined planets with a probe, manage four resource
tracks, keep a fragile crew (and a possibly-hostile ship AI) alive, collect found-footage
lore, and earn one of dozens of procedurally-assembled endings.

**Tone:** Alien/Nostromo cosmic horror × FTL: Faster Than Light × Sunless Sea.
**Tech:** Vanilla HTML/CSS/JS. No build step — open `index.html` in a browser.
**Look:** Green/amber phosphor-CRT terminal (Orbitron + Share Tech Mono, scanlines, glow).

## How to run
Double-click `index.html`. Everything loads as plain `<script>` globals; no server needed.
A dev **TEST** button in the header toggles `window.TEST_MODE` (forces lucky rolls, free
energy, skips campfire events).

## Document map (canonical set — read these)
| File | Covers |
|------|--------|
| [01_OVERVIEW.md](01_OVERVIEW.md) | Premise, the Exodus metaplot, the 8-log lore arc, crew & A.U.R.A. |
| [02_GAMEPLAY.md](02_GAMEPLAY.md) | Core loop, resources, ship decks, crew/stress, win/lose, save, tutorial |
| [03_WORLD.md](03_WORLD.md) | Planet generation, all 30 planet types, tags, the 6 sectors, loot, items, upgrades |
| [04_CONTENT.md](04_CONTENT.md) | All ~130 encounters by category, THE STRUCTURE endgame, content inventory |
| [05_SYSTEMS.md](05_SYSTEMS.md) | Probe, the Ending "Fate Matrix" (60+ outcomes), Bark, A.U.R.A., Narrative Modal, Audio |
| [06_ARCHITECTURE.md](06_ARCHITECTURE.md) | File map, wiring, GameState shape, dead/legacy code |
| [07_STATUS_AND_GAPS.md](07_STATUS_AND_GAPS.md) | What's done, known bugs, unfinished features, cleanup list |

## Status snapshot
- **Complete & working:** core loop, 6 sectors, 30 planet types, probe/scan/EVA, crew stress
  & breakdowns, A.U.R.A. ethics + sabotage, bark chatter, ~130 encounters, the procedural
  ending engine, the endgame STRUCTURE, save/load, audio.
- **Biggest gap:** the "secret ending" (collect all 8 Exodus logs → transmit at the door)
  exists in code (`EndingSystem.getSecretEnding`) but is **not wired to a player choice** at
  THE STRUCTURE. See [07_STATUS_AND_GAPS.md](07_STATUS_AND_GAPS.md).
- **Cleanup pending:** several dead/legacy files (`state.js`, `main.js`, `*_Legacy.js`,
  unloaded `CrewGenerator.js`/`TutorialSystem.js`).

## Older / historical docs (do NOT trust for current state)
Still in this folder for reference, but partially or fully stale:
`game_design_master.md`, `game_design_v4.md` (design intent — v4 is closest to current),
`IMPLEMENTATION_STATUS.md` (good as-built ledger, lists 5 sectors not 6),
`build_order.md`, `BUSINESS_PLAN.md` (marketing, still valid), `ALL_GAME_TEXT.md`
(text dump, missing late-game/structure text), `architecture/*`, `mechanics/*`.
Provably-stale originals were moved to `docs/archive/`.

## Source control
- origin: https://github.com/tahiktim-coder/Project_Start_map.git
- claude: https://github.com/tahiktim-coder/Project_Star_Map_Claude.git
