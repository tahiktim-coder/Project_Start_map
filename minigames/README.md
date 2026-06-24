# Minigames — set-piece sandbox

Standalone prototypes for PROJECT STAR MAP's interactive set-pieces. These are kept
**separate from the main game on purpose**: develop and tune them here in isolation, then
have the game *call* the finished one when a triggering event fires. Nothing here is wired
into `src/` yet — editing these does NOT affect the playable game.

## What's here
- **run-silent.html** — ⭐ the active keeper. *RUN SILENT*: a top-down power-board set-piece
  where a mysterious anomaly hunts the ship **by sound**. You cut ship systems (Engines /
  Sensors / Life Support) to keep your **signature** under its detection line as it sweeps,
  manage crew **oxygen**, throw **decoy** cargo, and run engines between sweeps to build
  **distance** and break contact. Open in a browser to play.
- **index.html** — the "Instrument Lab" hub linking the prototypes.
- **the-break.html / probe-descent.html / signal-tuning.html** — earlier exploration, kept for history.
- **sim.js** — headless balance simulator. Run `node sim.js`: it plays the loop with
  different strategies (passive / decoy-spam / skilled / reckless) to prove no single
  dominant line trivializes it. Re-run after any number tweak.
- **RUN_SILENT_REVIEW.md** — the design review, ranked issues, and the roadmap to a 9/10.

## How the game will "call" it (integration contract)
Each prototype is a standalone HTML demo today. To wire one into the real game later:

1. **Extract the logic into a module** (e.g. `src/minigames/RunSilent.js`) exposing ONE entry point:
   ```js
   RunSilent.run({ sector, anomaly, ship }) // -> Promise<{ outcome, distance, strikes, cargoLost, crewLost }>
   ```
2. **The game triggers it on a dramatic event** — a derelict reactor going critical, an
   anomaly destabilizing, the endgame Structure — *instead of* a flat RNG outcome.
3. **On resolve, the game applies the result to real state**: damage decks, lose cargo,
   injure/kill crew, nudge A.U.R.A.'s ethics, and record the run into the "graveyard" metaplot.

That keeps the set-piece self-contained: you iterate in this folder, the game just `await`s
the result and reacts. (Today the demo applies effects internally for testing.)

## Develop loop
Edit the HTML → open it in a browser (double-click). After changing any balance numbers,
run `node sim.js` to confirm the loop still has real decisions (passive & decoy-spam should
LOSE, skilled play should WIN).
