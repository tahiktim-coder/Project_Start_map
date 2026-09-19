# PROJECT STAR MAP — Master Design Document

> The single source of truth. Start here. Detailed breakdowns live in the numbered docs
> (01–09); this ties them together and captures the design decisions from development.
> Last consolidated: 2026-06-24.

---

## 1. What the game is (premise — current, blended)

A browser, **top-down, FTL-style space MANAGEMENT game** with a cosmic-horror undercurrent.
You command a ship and a small crew on a **semi-routine frontier salvage run** — but the
frontier is a graveyard, and something out there takes the ships that linger.

**The blend (this is the locked framing):**
- **Surface — normalized frontier.** Earth has fed ships into this corridor for **20–50 years**.
  You're **one crew among many**, not a lone last hope. The corridor is lined with **ancient
  stations** — staging/supply posts, now abandoned but still stocked — plus the wrecks and
  ruined colonies of crews who didn't make it. The job is blue-collar: salvage, restock the
  chain, push on. Death is a *known* occupational risk.
- **Undercurrent — the dread.** Ships **disappear**. Everyone's heard the rumor of **the
  Pursuer** — a hunter nobody understands. The deeper you go, the wronger it gets, building to
  the endgame truth (the **Structure** / why this corridor exists / what's really been taking
  everyone). 
- **The arc:** starts routine → curdles into horror. The normalized surface makes the horror
  land harder when the routine breaks.

**Reconciliation note:** the old built lore ("EXODUS-9, the *last* of nine ships fleeing a
dead Earth") is superseded by "one more crew in a long program." "The nine" can become a
specific famous early wave whose logs you find. The graveyard, the dead colonies, the
Pursuer, and the Structure all still fit.

## 2. Tone & pillars
- **Isolation, dread, the weight of the dead who came before.**
- **You're a link in a chain** — others came before, others come after.
- **Decisions over reflexes; managed tension over twitch.**
- **Normalized-then-horror:** competence and gallows humor, then the floor drops out.
- **Short game** — content must land *fast*; no long-burn character arcs.

## 3. Core loop (detail → [02_GAMEPLAY](02_GAMEPLAY.md))
Star map → warp to a system → explore/salvage (stations, planets, wrecks) → narrative events
→ manage crew + resources (energy / salvage / rations) → sector jump → repeat across the
sectors toward the endgame. Win by surviving + reaching the goal (see Open Decisions for the
exact mission). Lose by crew death, hull breach, commander breakdown, stranding, or the Pursuer.

## 4. World & content (detail → [03_WORLD](03_WORLD.md), [04_CONTENT](04_CONTENT.md))
- **30 procedurally-generated planet types**, 6 sectors of escalating dread, ~130 authored
  encounters, a 60+-outcome procedural ending engine.
- **Frontier framing additions** (new direction, not yet built):
  - **Stations as a core activity** — each abandoned station is a fast-read story (who manned
    it, why it emptied, what still hums) + loot + the risk of being heard.
  - **Restock vs. strip** — leave supplies for the next crew, or take it to survive now. The
    "link in the chain" moral/economy axis.
  - **Visitor logs** — sign in; read who passed before (some never signed out). The fast,
    frontier-flavored version of "you become the warning."

## 5. Systems (detail → [05_SYSTEMS](05_SYSTEMS.md))
Probe/scan, crew (stress, traits, breakdowns), the 5-deck ship, **A.U.R.A.** (a morally-
reactive AI with a hidden ethics score → cooperative…adversarial), bark chatter, the
procedural "Fate Matrix" ending engine. Architecture → [06_ARCHITECTURE](06_ARCHITECTURE.md).
Known bugs & gaps → [07_STATUS_AND_GAPS](07_STATUS_AND_GAPS.md) (notably: the secret ending
is written but not wired to a player choice — highest-ROI fix).

## 6. The Pursuer & set-pieces

**The Pursuer** is the recurring antagonist — the known-but-unexplained hazard that has
emptied this frontier. It surfaces as interactive **set-pieces** (the management board coming
alive under pressure). It can recur, "learn" how you run, and tie into the endgame truth.

**RUN SILENT** (built prototype — `minigames/run-silent.html`): the flagship set-piece. The
Pursuer hunts by **sound**; you work a power board (Engines / Sensors / Life Support) to keep
your **signature** under its detection line as it sweeps, manage crew **oxygen**, throw
**decoy** cargo, and run engines between sweeps to build **distance** and break contact.
Verified by `sim.js` to have real decisions (passive & decoy-spam lose; skill wins). Full
review + roadmap-to-9/10 → `minigames/RUN_SILENT_REVIEW.md`.

**Integration contract (how the game "calls" a set-piece):**
1. Extract logic to a module, e.g. `src/minigames/RunSilent.js`, exposing one entry point:
   `RunSilent.run({sector, anomaly, ship}) -> Promise<{outcome, distance, strikes, cargoLost, crewLost}>`
2. The game triggers it on a dramatic event (derelict reactor critical, anomaly, the
   Structure) **instead of** a flat RNG outcome.
3. On resolve, apply the result to real state (damage decks, lose cargo, injure/kill crew,
   nudge A.U.R.A. ethics) and record it into the metaplot.

Other ranked set-piece concepts (from the deep-dive): **THE CULL** (seal decks during a
disaster), **THE LISTENING** (tune the dead galaxy — the secret-ending vehicle). Full
ranking/specs → [09_MINIGAME_DEEP_DIVE](09_MINIGAME_DEEP_DIVE.md).

## 7. Design principles we locked (apply to everything)
- **Gamify the drama, not the routine.** Make rare high-stakes moments interactive; never tax
  a 40×/run action. Punctuation, not chore.
- **Decisions beat reflexes.** A "decision" needs ≥2 viable options with no obvious best.
  Every option must pass *"why would I never pick this?"* (kills dead mechanics like the old
  Lights system).
- **No dominant strategy.** Simulate the math to prove no brain-off line wins (see `sim.js`).
- **Readability first.** One job per colour; show the player the state they need fast.
- **Diegetic > abstract.** Convey danger through the fiction (A.U.R.A.'s voice, the ship
  reddening) over raw bars where possible.
- **Variety engine or it gets tiring.** Randomize per encounter / give threats different
  "personalities" so it isn't solved after 3 plays.
- **Don't silently remove things the user liked.** Flag tradeoffs; don't delete on a whim.
- **Audio:** synth is placeholder; real recorded SFX beat it — a download-and-wire job.

## 8. Design journey (what we tried & concluded — so we don't relitigate)
- Explored mini-games to add immersion. Early attempts failed because they **gamified routine
  actions** or were **twitch/luck** (asteroid-dodge, brute-force cipher, generic probe-dive) —
  all rejected.
- A multi-agent deep-dive ranked concepts; **the escape set-piece ("THE BREAK") won**, but
  iterations on it taught the real lessons: hide-the-gauge, captain-not-spreadsheet, real
  tradeoffs.
- Landed on **RUN SILENT** (silent-running / hide-from-a-sound-hunter) as the feel that
  clicked: a captain working the ship's board, diegetic dread, genuine decisions.
- Reframed the premise from "last desperate ship" → **normalized frontier + horror
  undercurrent** (Section 1).

## 9. Content backlog (ideas for "a small group at the edge", fitting the blend)
- Stations as the heart; restock-vs-strip; visitor logs (Section 4).
- The Pursuer as a *known* hazard with crew procedures/gallows humor; a slow-revealed deeper
  truth at the endgame.
- **Fast** character beats (veteran vs rookie; someone recognizing a dead friend's station) —
  one-scene payoffs, since the game is short.
- A lone, *changed* survivor of a dead ship you can take aboard.
- "Transmit home" — you become the black box the next crew finds.
- Wire the **secret ending** (highest-ROI existing fix).

## 10. Repo map (where things live)
```
Project_Start_map/
├─ index.html, style.css, src/        ← the actual game (vanilla JS; open index.html)
├─ docs/                              ← all design docs (00 master + 01–09 + this)
│   └─ archive/                       ← superseded early notes
├─ minigames/                        ← set-piece sandbox (separate from the game)
│   ├─ run-silent.html               ← flagship prototype
│   ├─ sim.js                        ← balance checker (node sim.js)
│   ├─ RUN_SILENT_REVIEW.md          ← review + roadmap
│   └─ README.md                     ← integration contract
└─ GAME_BRIEF.md                     ← short re-entry note (this doc supersedes it)
```
GitHub: origin = `tahiktim-coder/Project_Start_map` (the `minigames/` folder is pushed; the
docs and any local game-code edits are currently **uncommitted/local**).

## 11. Open decisions (unresolved — decide before deep work)
- **The mission / win condition** for the frontier framing: salvage run? restock/supply run?
  reach the far edge? investigate the disappearances? (Currently undecided.)
- How hard to retrofit the **frontier framing** into the existing built lore (logs, the
  Structure ending). Section 1 says "blend"; the exact rewrite scope is TBD.
- Whether/when to **wire RUN SILENT** into the live game vs. keep iterating standalone.

## 12. How to work (across chats)
- **New chat:** "Read `docs/00_MASTER_DESIGN.md`, then continue." (This doc is the handoff.)
- **Game work:** edit `src/` files; open `index.html` to test.
- **Minigame work:** edit in `minigames/`; open in browser; `node sim.js` to balance-check.
- **Integrate a set-piece:** follow the contract in Section 6 / `minigames/README.md`.
- Keep the docs updated as decisions land — they are the project's memory.
