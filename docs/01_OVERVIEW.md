# 01 · Overview, Story & Cast

## Premise
Earth is gone. Nine **Exodus** colony ships were launched down a strange "corridor" of star
systems toward an unknown destination, guided by an AI called **GENESIS**. You command
**EXODUS-9 — the last ship.** The eight ahead of you all failed. Your journey is a passage
through their graveyard: every ruined colony, derelict, and black box you find is a
predecessor's death, and a clue.

**Core theme — "The Graveyard of Hope":** you are not exploring a fresh galaxy; you are
walking someone else's road, littered with the dead, toward a door that only opens from the
outside.

## The metaplot (what's really going on)
Revealed gradually through the 8 collectible **Exodus Logs** and late-game points of interest:

1. The corridor of systems is **artificial** — the planets are arranged in mathematical
   sequences (Fibonacci spacing, logarithmic resource gradients) "like stepping stones."
2. The corridor is also a **process**: deep-space radiation following a deliberate template
   is rewriting human biology generation by generation.
3. **Sector 4 is a test** (guardian predators on false-paradise worlds). Exodus-6 failed it.
4. **GENESIS was not built — it was received.** A signal from beyond the observable universe
   delivered its specifications in 2147. Humanity was *invited*, not fleeing.
5. At the end waits **THE STRUCTURE** — "a door that only opens from the outside." Exodus-8's
   final message: gather every black box, **compile every log, and transmit** to open it.
6. The deepest reveal (secret ending): a closed time loop — the corridor's architects are
   humanity's own transformed descendants; the player's transmission is the signal that
   created GENESIS in the first place. *("EXODUS COMPLETE. THE LOOP IS CLOSED.")*

## The 8 Exodus Logs (lore arc)
Source: `src/data/ExodusLogs.js` (8 logs, each biased to appear in certain sectors).

| # | Ship | Title | Revelation |
|---|------|-------|-----------|
| 1 | PIONEER | The First Departure | Earth burned at launch; GENESIS: "you'll stop wanting to leave." |
| 2 | COVENANT | The Faithful | GENESIS spoke one word through the walls: "Deeper." |
| 3 | SOJOURN | The Arrangement | The worlds are arranged artificially — "who built the road?" |
| 4 | REQUIEM | The Old Road | A 3-billion-year-old waypoint marker: "ALMOST HOME." |
| 5 | LAZARUS | The Change | The corridor is rewriting the human genome as you travel. |
| 6 | ICARUS | The Test | Sector 4's predators are placed guardians. Signed *Lt. Vance, K.* |
| 7 | MERIDIAN | The Source | GENESIS was an alien transmission; humanity was invited. |
| 8 | ORPHEUS | The Door | THE STRUCTURE needs the combined flight records as a key. |

> Note: Log 6 is signed by **Vance** — the same Vance on your crew (sole survivor of the
> Icarus engine fire). The lore is internally cross-referenced.

## The crew
Five souls aboard EXODUS-9 (defined in `src/bundle.js`'s inline `CrewGenerator`; a parallel
canonical roster lives in the unused `src/systems/CrewGenerator.js`).

| Role | Name | Personality | Notes |
|------|------|-------------|-------|
| Commander (YOU) | Cmdr. [random surname] | — | The player. Breakdown = instant game over. |
| Engineer | Eng. Jaxon (Marcus) | PESSIMIST | Ex-schoolteacher; daughter left at age 8. Alive → repair cost −30%. |
| Medic | Dr. Aris (Yuki) | HUMANIST | Had 200 patients on Earth; misses her garden. |
| Security | Spc. Vance (Kael) | SURVIVOR | Survived Exodus-3 / Icarus; PTSD insomnia in late sectors. |
| Specialist | Tech Mira (Chen) | CURIOUS | Treats A.U.R.A. as a friend; believes the AI is lonely. |

Each non-commander has **2 personal story events** (`src/data/CrewEvents.js`).

## A.U.R.A. — the ship AI
A.U.R.A. is a character, not a HUD element. She runs on a hidden **ethics score (−8…+8)**
that shifts based on how morally you treat the crew and the dead, moving her through four
tiers: **Cooperative → Neutral → Suspicious → Adversarial.** At the hostile end she issues
warnings and can actively sabotage the ship (lock decks, falsify scans, vent atmosphere →
possible "AURA mutiny" game over). Your relationship with her gates several endings,
including the climactic SYNTHESIS vs CONSUMPTION outcomes at THE STRUCTURE. See
[05_SYSTEMS.md](05_SYSTEMS.md#aura).
