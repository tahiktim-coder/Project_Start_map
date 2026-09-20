# Story vs. actions audit (2026-09-20)

Read-through of every encounter, choice, coded effect and ending, checking that what the player is told, what they do, and what the code does all agree. Found by reading code, not by playing.

## Fixed

| Problem | Where |
|---|---|
| Asteroid mining never opened (field was marked "mined" before the card was shown); the player lost a ration for nothing | `bundle.js` showAsteroidEncounter |
| "Walk away" EVA choices (Emergency Takeoff, Abort EVA, Hail & Ignore…) secretly paid +30–50 Energy. They now bring nothing and cost what their label says | `bundle.js` resolveEvaOutcome |
| Any failed roll above 40% risk was always a death. Death chance now climbs with risk (10% of hits, +1 point per point of risk over 40) | same |
| Loot was paid out even when someone died on the trip | same |
| One always-true story campfire per sector blocked every other campfire. Now weighted by priority, never the same talk twice | `bundle.js` showCampfireEvent |
| "END THE JOURNEY" on an unscanned Eden healed everyone, said "you are home", then refused to end the game | `_executeColony` scan waiver |
| Mutiny "Hand him the ship" changed nothing. Now: 2 jumps confined, everyone who watched +1 Stress, then you get the chair back | `showMutinyEvent` |
| "−5 Energy per warp this sector" (campfire) and "all warps cost −2" (Lighthouse charts) did nothing. One `GameState.getWarpCost` now applies both, and the map label agrees | `bundle.js`, `NavView.js`, `CampfireEvents.js` |
| After a one-person boarding, a random crew member who stayed aboard got hurt. Now it is the person who went in | `SpaceStations.js`, `BoardingParty.js` |
| Dead crew still spoke in the log; the commander (the player) was given lines, once as "Cmdr. Kael". `GameState.addLog` drops both | `bundle.js` |
| Distress signals were 1–60 years old in every sector. They now age with the sector like wrecks and stations | `getSignalAge` |
| "Final sector" barks fired in sector 5 of 6 | `BarkSystem.js`, `bundle.js` |
| "Further than any human vessel" contradicted "the first crews made it this far" | 3 files |
| Grave dates made Vance one year old and Jaxon not yet born | `LateGamePOIs.js` |
| Endings looked for crew tags that do not exist (TECH, SCOUT), read life/tech from the wrong place, and used 'ICE' for ICE_WORLD, so many ending paragraphs could never appear | `EndingSystem.js` |
| Encounters handed out `MEDKIT` and `ALIEN_ARTIFACT`, which did not exist | `Items.js` |
| Void-stress line could be spoken by the commander | `SectorConfig.js` |

## Open — needs a story decision from you

1. **The premise is never set up.** The briefing never says "we are the first", and the ship is called EXODUS-9 while wrecks are EXODUS-1…8, so the reveal ("they told us we were the first") has nothing to break. Either rename the ship / the wrecks, or have the briefing state the lie.
2. **Three different answers to "what is at the end".** A 3.7-billion-year-old alien structure, a thing built by future humans, and the story doc's human disc. None of the six endings in the story doc exist in `StructureEncounter.js`.
3. **Earth.** Some text says Earth is gone / had six months; the story doc says Earth keeps launching ships. Jaxon's daughter "wrote" from Earth (letters arrive?) while the doc says his wife flew an earlier mission. Vance served on Exodus-3, is on Exodus-2's log, and is the sole survivor of Exodus-6.
4. **Living survivors.** Design note says distress calls are only old recordings, but several encounters rescue living people (a child "brought aboard" who is never mentioned again; 11 survivors; "they join us" and nobody joins).
5. **Sector themes.** Sector 1 is described as "humanity's first attempts", but by the older-further-out rule it should hold the NEWEST wrecks. Sector 6 has no human wrecks although the oldest should be there. Sector 4's arrival line says "somebody stopped here, and lived", yet every sector-4 colony is dead.
6. **A.U.R.A.** cheers when you consider settling ("this could be home") although her secret goal is to keep the crew moving. Mira can say A.U.R.A. has been "awake for centuries" as early as sector 1.
7. **Jaxon** is meant to be the one who wants to settle, but on the first living world he says "pretty planet, pretty coffin".

## Open — smaller

- Arrival card drops A.U.R.A.'s lines but keeps crew replies to them ("Coordinates to what?").
- Pre-landing barks can come from crew who are not on the team ("I'll take point").
- Choices that promise things the code never reads: reveal-all-tags, hidden sector, "it will remember", Vance's resolve, colony bonus, garden/grave flags. Either wire them or reword.
- Dominated choices (one option strictly better): failed-colony "Assess the failure", derelict armory vs. free option, asteroid quick vs. full dig.
- Choices that need a crew member but do not check they are alive (several; they waste the encounter).
- Things the game does not have: orbital lance, shuttle, merchants, pirates, corporate warships.
- `ExodusLogs.js` text is never shown and the secret ending is never called.
- Chrono-Shard cannot be used; Sensor Array V2 (150 salvage) has no gameplay effect.
