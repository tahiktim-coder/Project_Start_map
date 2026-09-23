# Why the story feels chaotic, and what to do about it (2026-09-23)

Read from the code, not the docs. Playtesters said "this feels like a game" but did not feel
involved. Both halves of that have the same cause.

---

## The one problem

**The game is telling four different stories at the same time, as fact, and the real one appears
once in 122 encounters — where it can be missed.**

| story being told | where it is told | status |
|---|---|---|
| **A.** Every ship was sent down one corridor; hulls rise while wrecks get older; the Structure reads what reaches it; the secret is the 1977 disc's map | the opening card, two picture films, the wreck-name generator, **one** encounter branch | our canon |
| **B.** Ten ships left Earth. The Structure is a door that needs a key: eight black boxes, gathered and transmitted. "EXODUS-9, you are the last ship. Knock on the door." | all 8 collectibles in `ExodusLogs.js` | a complete rival plot |
| **C.** GENESIS. Which is either the thing that invited us out here (`ExodusLogs.js:134`) or the thing that built the corridor and its tests (`EndingSystem.js:727`) — the two lines are direct negations of each other | logs + late POIs + the unreachable secret ending | two rival plots that contradict each other |
| **D.** Humanity's descendants came back through time to seed the corridor with life (`LateGamePOIs.js:155–158`) | a sector-5 point of interest, stated by A.U.R.A. as fact | a benevolent time loop |

Plus a friendly alien gateway at the end (see below) that belongs to none of them.

That is what "chaotic" means here. It is not tone, pacing or text volume. Four authors are talking
over each other and the player is trying to work out which one to listen to.

**Story A appears exactly once in `src/data/`:** `ExodusDerelicts.js:334–347`, and it is the best
writing in the project —

> *"CREW BRIEFING, RECORDED: 'Eight went this way before you. You are the ninth on this heading.'
> Word for word, our briefing. The hull number on the recording is not nine."*
> *"'I asked the ship how a hull built after us could have died before we were born. It said: you
> were not thrown further away than they were, Captain. You were thrown less far back.'"*

It is one of three random `loreBlocks`, inside one of two choices, on a weight-10-of-110 encounter,
behind a 10-Energy gate. **Expected exposures per playthrough: well under one.** The central reveal
of the game is statistically optional.

---

## The shape of the run

Six sectors, 2–3 stops each (`MIN/MAX_STOPS_PER_SECTOR`, `bundle.js:889`): **12–18 stops for the
whole game.** So the player sees 12–18 of ~122 vignettes. That is good news — an authored spine is
completely affordable at this size. It also means every wasted slot is ~7% of the story.

**And the player can stop at any moment from sector 1 onward.** SETTLE HERE on any deep-scanned
planet ends the run (`bundle.js:4684`). So "progress towards the ending" is only *how deep you chose
to go before stopping* — and nothing in the game gives you a rising reason to keep going. That is the
involvement problem stated as a structure: the off-ramp is always open, free, and one click.

## The pressure is in the wrong place

This is the answer to "where is the suspense".

- **Energy looks like the constraint and isn't.** A warp costs 10–19, then hands most of it straight
  back: `floor(cost × returnPercent × 0.75)` with `returnPercent` 0.35–0.75 by planet type, plus up
  to +30% for a good plot (`bundle.js:1440–1474`, `WarpPlot.js:23–28`). **Net cost of a typical
  14-energy warp is about 5–9.** The number the player watches is theatre.
- **Rations are the real clock, and nothing says so.** `consumeRation` fires on every warp, jump,
  EVA, boarding, mining and site investigation. You start with 20. At ≤2 every action stresses the
  whole crew; at 0 you get two actions of grace and then somebody dies. Twenty rations is roughly the
  entire six-sector run.
- **There is no hull.** Damage is five binary decks. So the ship cannot visibly deteriorate, which is
  the other obvious source of dread in a game like this.

The suspense you asked for twice does not need a new meter. It needs the existing clock moved to the
front: make rations legible and genuinely tight, stop refunding energy so generously, and let the
ship get worse in a way the player can see.

---

## Evidence

### The ending is a different game

`src/data/StructureEncounter.js` is untouched old-draft text. The card header says
`THE END OF THE CORRIDOR` (`bundle.js:2886`); the body says the Structure *"has been waiting for
you. Specifically for you. Since before you were born"* — the exact chosen-one material we agreed to
avoid. The four buttons yield eight endings: *gateway to a green world*, *become something new*,
*it remembers your dead*, *it provides schematics and star charts*, *hungry eternal alien*. No disc,
no Reader, no corridor, no lie. **Which one you get is decided by living crew count and average
stress** (`:41–45, 69, 155`) — by attrition, not by anything you chose.

And the player barely reads it: `showStructureModal` runs the approach paragraph through
`EncounterCard.splitContext`, which shows **the first two sentences** and folds the rest behind a
small `more` link, then slices the crew to 3 lines (`bundle.js:2879, 2889`). After an hour of play
the finale is: *"THE STRUCTURE fills your viewport. It is… impossible to describe."*, three lines,
four buttons, one click, save deleted, text wall, BEGIN AGAIN.

### The twist is spoiled on the title screen

`bundle.js:962` — `EVERY SHIP WAS TOLD IT WAS THE NINTH`. For the audience we are aiming at, that
sentence turns sector 3 from a reveal into a confirmation before NEW GAME is pressed.

### No escalation: 80% of encounters can fire anywhere

Only **24 of 122** encounters are gated to a sector. EVA event selection is a flat random pick over
everything that matches (`bundle.js:3786–3792`), and six `Events.js` triggers are bare dice rolls
with no sector or type condition (`:44, 256, 276, 326, 336, 356`). So `MASS_BURIAL` — *"Thousands of
burial markers. Not human… The dates are from the future."* (`Events.js:258`) — can be the player's
**first landing in sector 1**, before anything strange has been established. The game spends its
biggest imagery at zero narrative cost, in the tutorial.

### The designed act breaks are not guaranteed

`CampfireEvents.js:11` documents `priority: 3` as *"Always fires for this sector (guaranteed
event)."* The implementation is `weight = priority²` (`bundle.js:2392`) — 9 vs 4 vs 1. So
`CF_LAST_CHANCE` ("the point of no return") and `CF_STRUCTURE_APPROACH` — the two intended act
breaks — can be silently replaced by `CF_ROUTINE_MAINTENANCE` ("Focus on power systems / Focus on
hull / Skip maintenance").

### Nothing remembers anything

There is **exactly one** cross-encounter callback in all 122: `_followedSignal`
(`CampfireEvents.js:110` → `:284`). **And it is not in the save payload**, so reloading erases the
only memory the game has. The same reload silently refunds `_damagedCapacitors`, deletes the
`_lighthouseBonus` discount, and lets already-seen campfires and wreck encounters repeat
(`_seenCampfires`, `_encounteredExodus`, `_encounteredShipNames` are all unsaved).

Everything else is write-only:

`_sleepers`, `_vanceResolve`, `_hungerFavor`, `_hungerFled`, `_doorOpened`, `_doorOffering`,
`_alienNavData`, `_gardenTruth`, `_gravesRead`, `_gardenSamples`, `_auraLoyalty`, `_auraCold`,
`_structureVision` — **written by encounters, read by nothing.**

The worst case: `CF_AURA_ETHICS` (`CampfireEvents.js:206`) asks the game's central moral question —
*"If reaching THE STRUCTURE requires sacrificing crew… would you?"* — and files the answer in
`_auraLoyalty` / `_auraCold`, which nothing reads. Meanwhile A.U.R.A.'s ending branches on
`AuraSystem.getTier()`, fed by ~14 scattered loot choices. **Her ending is decided by your salvage
etiquette, not by what you told her.**

Crew tags are orphaned the same way: `GARDEN_TOUCHED`, `CHORUS_TOUCHED`, `STATION_TOUCHED`,
`GEOMETRY_SOLVED` are each set on a named person and read by nothing. `AnomalyEncounters.js:659`
promises *"I see it now. How everything connects… I can never unsee it."* and that character behaves
identically for the rest of the run.

And every named person the player meets — Sister Okoye, Dr. Yuen, Marcus the pilot, Elena, the child
in the pod, the eleven sleepers, Jaxon's daughter — is never mentioned again by anything.

### Choices don't bite

- **37 of 122 encounters have no real choice.** All of `Events.js` is the same two buttons with the
  answer printed on them: *"Salvage Exterior (Safe)"* vs *"Breach Hull (Risky)"*. `riskMod` is the
  only variable. No crew effect, no stress, no flag, no memory.
- **Strictly dominated options are everywhere.** `ASTEROID_RICH` offers "Dig it all out (slow,
  safe)" = +40–60 vs "Quick dig (fast, some risk)" = +20–30 — and there is no time cost anywhere in
  the game, so "slow" costs nothing. `STATION_MILITARY` has a "+50 Energy, safe, no cost" button.
  `EXODUS_DEAD_CREW` makes the respectful option cost a ration and the callous one free.
  `DISTRESS_FRAGMENT`'s "Ignore and continue" returns literally nothing.
- **Kindness is never expensive.** Almost every reverent option pays `−1 Stress to all crew`, which
  is a straight heal (six instances). Doing the decent thing is also the optimal thing, so there is
  no dilemma anywhere.
- **Risk labels lie.** `DISTRESS_ALIEN` is labelled *"HIGH RISK… Unknown consequences"*; its worst
  outcome is a stress tick and its best is full energy plus 50 salvage. This teaches players to
  ignore every risk label in the game.
- **It can be done right, and the game already does it once.** `EXODUS_CRYO`
  (`ExodusDerelicts.js:124`): leave the sleepers, or take their cryo batteries for **+70 Energy**
  with *"Dr. Aris: 'You're killing them. You know that.'"* / *"You do not answer her. They were
  already dead. They just did not know it yet."* That is the template for every choice in the game.

### The crew are four role-slots, not four people

Across 11 files, the four hit the same four marks with no variation by sector and no development.
Mira says look at this (`"Look at this. LOOK at this!"`, `"It's beautiful."`); Vance says we should
leave (four near-identical lines); Aris says it's sad then it's beautiful; Jaxon prices the wreck.
**Sector 1 and sector 6 are indistinguishable.** The nine good interiority scenes in `CrewEvents.js`
are one-shot, permanently flagged off, with no successor beat — and they fire on
`state.actionsTaken >= 10 / 15 / 20`, so they land in random order with no relation to what the
player has learned. **Cora Moon, the character the player is, has zero lines in all 15 files.**

Vance has **five irreconcilable backstories**: sole survivor of Exodus-3 (`CrewEvents.js:224`),
security officer on Exodus-6's black box (`ExodusLogs.js:107`), a third Vance serving on Exodus-2
(`:36`), the Kepler-7 massacre (`AnomalyEncounters.js:156`), and the launch-yard keel counter in our
own canon. Two of them are structurally impossible — nothing comes back down the corridor, so he
cannot have served on an earlier Exodus and then boarded hull 9. **His signature scene breaks the
premise.**

There are also two conflicting crew rosters: `bundle.js:44–115` (Cora Moon, Jaxon Mercer, Aris
Novak) wins at runtime, while `systems/CrewGenerator.js` is stale (Elena Reyes, Marcus Jaxon, Yuki
Aris) — but the stale file holds the only written voice notes, and gives Vance a `SURVIVOR` **tag**
that the live roster demotes to a string, so any `tags.includes('SURVIVOR')` check silently fails.

### Repetition the player will notice

Five files independently reach for dead children or a message to a daughter; `ExodusDerelicts.js:45`
and `DistressSignals.js:297` are the *same beat with the same relative*. "I read my own death date"
appears twice as a first-time revelation (`AnomalyEncounters.js:709`, `LateGamePOIs.js:194`). "The
Garden" is three unrelated things; "a door" is three unrelated things. "Read a dead person's
recording" is the core of six encounter types. **"Reveals all planets in sector" is the reward of
seven different encounters.**

### Canon contradictions still live in the text

- **Awake survivors in a corridor of centuries-old wrecks.** *"We found a survivor. They were awake.
  They've been awake for 40 years."* (`AsteroidFields.js:219`); a colony 5 years old
  (`FailedColonyEncounters.js:301`); cryo failed *14 months ago* (`:131`); *"Tables set for dinner…
  food on the plates. Half eaten."* (`:225`); a "Search for survivors" choice (`:189`).
- **"Same vintage as us"** said over a hull that may be EXODUS-38,000 dead 400 years
  (`ExodusDerelicts.js:381`).
- **A two-way economy in a one-way corridor:** *"the busiest station in the sector. Merchants,
  miners, colonists"* (`SpaceStations.js:297`), *"a supply run"* (`DerelictEncounters.js:99`),
  *"humanity's last line of defense before the exodus"* (`SpaceStations.js:242`).
- **Turning back offered as real:** *"This is the last chance to turn back."* (`CampfireEvents.js:256`)
  against canon's one-way drive.
- **A.U.R.A. off-canon:** *"Imagine being awake for centuries, watching ships die one by one."*
  (`CrewEvents.js:363`).
- Dead code that left its prose behind: `getWreckName` (`bundle.js:2431`) and the sector-scaled
  `getSignalAge` (`:1741`) override the data files, so the eight hardcoded ship names and all the
  "5–45 years" numbers are dead — but the prose around them was never rewritten, which is why
  `DistressSignals.js:19` still calls a 400-year-old wreck *"long dead. The crew… probably the same."*

### Promises the game makes and cannot keep

These matter more than any line of prose. Each one teaches a careful player that their effort was
not being counted, which is precisely what "not involved" describes.

- **DATA does nothing after sector 2.** `getSuccessChance` computes the knowledge bonus
  (`EndingSystem.js:60–88`) but `generateOutcome` only rolls against it when `currentSector <= 2`
  (`:140, :158`). From sector 3 on, success is decided by fixed gates. The HUD still promises *"Data
  from failed colonies. Improves your colony's survival chance."* (`index.html:39`). We agreed to
  keep this bonus; it is dead in four of six sectors.
- **A finished ending nobody can reach.** `getSecretEnding` / `isSecretEndingAvailable`
  (`EndingSystem.js:705–742`) are never called from anywhere. And `ExodusLogs.js:156` tells the
  player to go get it: *"Gather every black box. Compile every log. Then transmit. Knock on the
  door."* Worse, the 8-log hunt — the game's only long arc — can be **completed in one click** by a
  weight-8 random anomaly (`AnomalyEncounters.js:713`).
- **No ending reads your cargo.** The Drawing of the Disc and the Uncut Briefing Tape — the two
  things the player hunts — change nothing.
- **Reliance on A.U.R.A.** is tracked and saved (`bundle.js:1957`) and read by nothing but one
  flavour line.
- **`addColonyKnowledge`'s three milestone lines are unreachable:** both call sites pass
  `silent = true`, and ~50 data-file sites assign `_colonyKnowledge` directly. The one stat that
  accumulates all game never once acknowledges itself.
- **13 dead flags**, and `_vanceResolve` prints the promise *"Improves future EVAs"* on the choice
  (`bundle.js:1877`) while nothing implements it.
- **Three rewards that do nothing.** `_warpDiscount` is paid out by an item and two encounters — one
  of them tells the player outright *"Future warp costs reduced by 5%"* (`Items.js:225`) — and
  `getWarpCost` never looks at it.
- **A 150-salvage upgrade that does nothing.** `sensor_v2` is sold as *"Long-range scan shows
  everything about a planet"* (`Upgrades.js:6`); `handleRemoteScan` never checks it. `stabilizer_core`
  is required by the ending system for SHATTERED worlds and **cannot be bought at all**. A damaged
  `lab` deck has zero mechanical effect although the panel text claims otherwise.
- **Dead hazard and dead loss condition.** Sector 3's INTERFERENCE hazard is gated on
  `planet.revealedStats.length > 0`, and `revealedStats` is never populated — so the sector whose
  whole identity is instrument failure has no instrument failure. And STRANDED is unreachable after
  the first warp of a run, because BREAK ORBIT never clears `currentSystem`.
- **Settling ends the run with no confirmation from sector 3 on** (`colonyWarning` is only true for
  sectors 1–2).
- **A second "you are home" ending:** the Wrong Place "ACCEPT YOUR FATE" button
  (`bundle.js:2774–2805`) is a full unconditional ending closing on *"You are home."*
- **Mira and Vance can never be mourned:** `generateEpilogue` tests tags `TECH` and `SCOUT`
  (`EndingSystem.js:848, 850`); the real tags are `SPECIALIST` and `SECURITY`.

### No objective after sector 1

`Coach.js:9` — `LAST_SECTOR_WITH_TIPS = 1`, and there is no objective UI anywhere else in the game.
From sector 2 to the end the player is never told what they are trying to do.

### Six sectors, six unrelated stories

`SectorConfig.js` `ambientDesc`: graveyard (1), empty silence (2), *"a rhythmic tapping on all
frequencies, something is broadcasting"* (3), a false Eden (4), broken physics (5), the edge (6).
Only 1 and 6 belong to story A. Sector 3's is a fifth mystery box, deepened by
`DistressSignals.js:364` — *"something that was here before us. Or something that followed us"*, with
star charts *"not from our space. Not from our time."* We decided there is no pursuer and no aliens.

---

## The fix

### 1. Pick one story and delete the other three
Non-negotiable and it costs almost nothing, because three of them live in two files.
- **Rewrite `ExodusLogs.js`** (164 lines, 8 items, **already sector-paced via `sectorBias`**). Drop
  the ten-ship fleet and the black-box key. Put the hull ladder and the Reader in their place. This
  single file turns our worst canon coverage (1 encounter in 122) into a guaranteed 8-beat spine,
  and it is the smallest file in the set. Then **show it** — the logs are collected and counted
  today but their text is never read out.
- **Cut GENESIS entirely**, or demote it to the programme's name for itself. Right now two files
  say opposite things about it.
- **Cut the time-travelling descendants** in `LateGamePOIs.js:155–158`.
- **Repoint sector 3's broadcast** at transponders, and cut the "something followed us" lines.

### 2. The ending must be this story's ending
Rewrite `StructureEncounter.js` around the disc and the five endings in `STORY_DIRECTION.md`
(break the map / let it read you / carry it on / let A.U.R.A. decide / wake the sleepers). Stop
selecting by crew attrition. Show the full approach text instead of folding the climax behind
`more`. No "welcome home", no transcendence, nobody goes home.

### 3. One question, asked in minute one, visible the whole way
**"Why has nobody ahead of us ever called home?"** Vance already asks it (`bundle.js:1307`).
- One authored, **actually guaranteed** beat per sector — fix the `priority: 3` weighting so the act
  breaks cannot be skipped — with the random vignettes as texture around it, not instead of it.
- The Coach bar becomes a permanent one-line objective for all six sectors, written as ship's
  business rather than a tutorial tip.
- Gate the six sector-blind dice triggers behind `currentSector >= 3` so sector 1 stops spending the
  reveal-tier imagery before the lie exists.

### 4. Your own log is the evidence
The game already records every wreck the player personally boarded
(`_encounteredShipNames`, `bundle.js:2494`) — it just isn't saved. Save it, and in sector 5 the
**Launch Ledger** lists *those exact ships, by the names the player salvaged*, with build dates after
EXODUS-9 left and failure dates before it. The proof of the twist becomes the player's own hour of
play instead of a paragraph. One document screen.

### 5. The crew's wants ARE the endings

| | wants | ending it unlocks |
|---|---|---|
| Vance | to be believed | Break the map |
| Dr. Aris | to understand | Let it read you |
| Jaxon | to stop | Carry it on / settle |
| Mira | to be told what to do | Let A.U.R.A. decide |
| the sleepers | nothing; they are cargo | Wake them to vote |

One want each, stated once, tested twice, paid off at the Structure — and you may only choose an
ending you have standing for. "Who did I back" becomes the shape of the run. Then give Vance **one**
backstory (the launch yard, the only one that does not break the premise), move the nine `CrewEvents`
scenes off `actionsTaken` onto story position, and let Mira and Jaxon sound different in sector 6
than in sector 1.

The bookkeeping mostly exists already: `reliance` is saved, `_auraLoyalty` is written, the tags are
set. The endings simply never look at any of it.

### 6. Make choices bite
Use `EXODUS_CRYO` as the template: two things the player wants, and they cannot have both. Remove the
dominated options, stop paying `−1 Stress` for every decent act, and make the risk labels true.

### 7. Move the pressure to the clock that actually exists
Rations, not energy. Make the ration count legible and genuinely tight, cut the warp refund so energy
means something, and let the ship visibly deteriorate instead of flipping five booleans. Then give
the player a *rising* reason not to take the off-ramp — every sector should make stopping here cost
something it did not cost last sector.

### 8. Keep the promises
Make DATA count in every sector. Let the ending read cargo. Reach the secret ending or delete it and
the log that advertises it. Confirm before ending the run in every sector. Delete or wire the 13 dead
flags, the false "Improves future EVAs" hint, `_warpDiscount`'s three payouts, and `sensor_v2`'s
advertised effect. Save the flags that are currently lost on reload — including `_followedSignal`, the
game's only callback. Fix the `TECH`/`SCOUT` memorial tags. Retire the stale `CrewGenerator.js` roster
after moving its voice notes somewhere real.

---

## What this is not

Not more text — playtesters already said there is too much. Not a HUD meter. Not a new system.
Items 1–5 are: two files rewritten, six authored beats, one saved array, one document screen, and a
tally of who you sided with.
