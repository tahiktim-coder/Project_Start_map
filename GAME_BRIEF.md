# PROJECT STAR MAP — Game & Redesign Brief

> Saved 2026-06-21 so any future Claude Code session has full context even if the
> chat history is gone. Read this first when picking the project back up.

## The game: "The Silent Exodus"
You command vessel **EXODUS-9** across a graveyard of failed colonies — scan ruined
planets with probes, manage **Energy / Salvage / Rations / Data**, keep a failing ship
and crew alive, collect found-footage logs, and earn one of 50+ procedural colony
endings. Tone: **Alien/Nostromo cosmic horror meets FTL.**

**Crew:** Commander (you), Jaxon (engineer / pessimist), Dr. Aris (medic / humanist),
Vance (specialist / cold survivor), A.U.R.A. (glitched-optimist AI).
**Climax:** "The Structure" / Heaven planet — the orb. Probe destroyed on contact, no
EVA, no escape.

## Current look (what's in the code today)
Green/amber phosphor CRT terminal.
- Colors: primary `#00ff41`, primary-dim `#008f11`, accent `#ffb000`, danger `#ff3333`,
  text `#e0ffee`, text-dim `#4a7a5f`, bg `#050a07`.
- Fonts: Orbitron (display), Share Tech Mono (body).
- Effects: scanlines, vignette, CRT flicker, text glow, sharp edges.
- Layout: top status bar / left ship schematic (6 decks) / center viewport (star map or
  planet scan) / right tactical panel / bottom mission log.
- 33 planet types rendered in pure CSS (see `style.css`), incl. THE STRUCTURE, WRONG_PLACE.

## Redesign plan (main UI elements to improve later)
Design system first (colors/type/CRT, buttons, panels, resource chips, gauges, log
entries, modal), then screens: title, status bar, ship schematic, tactical panel,
mission log, star map, planet scan, scanner/probe, comms, event modal, ending screen.

## Reference look
FTL (mechanics) × Alien/Nostromo (aesthetic) × Sunless Sea (dread & lore-logs).

## Assets already in this repo
- `design-system/dist/` — 8 standalone preview cards of the current UI (double-click to
  open in a browser; start with `screens/full-dashboard.html`).
- `design-system/build.ps1` — regenerates those cards from `style.css`.

## GitHub
- origin: https://github.com/tahiktim-coder/Project_Start_map.git
- claude: https://github.com/tahiktim-coder/Project_Star_Map_Claude.git
