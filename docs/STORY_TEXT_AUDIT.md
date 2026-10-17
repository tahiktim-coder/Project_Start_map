# Story text vs the new story (working list, 2026-10-17)

Every story-bearing line in the game judged against docs/STORY_MAP.md: KEEP, REWRITE or CUT. A worklist for the text rewrite,
not for reading. Line numbers as of 2026-10-17 (bundle.js shifts as code changes). Export docs/script again after the rewrite.

**Legend:** **G** every run sees it. **nag** a story stop (the crew warn before you jump past it, but you can skip it). **opt**
optional or random. **HOLD** a "four crew / five crew" line: keep only if the count gets a meaning, otherwise cut.

## 1. Inventory

**Step 1: the disc (a second, better golden record)**

| file:line | what | met | verdict |
|---|---|---|---|
| DiscDocument.js:16 | disc note "Thrown out of our solar system in 1977, bolted to a probe" | S1 first wreck (nag), cargo | REWRITE: the second record; its year is undecided |
| DiscDating.js:319-320 | "1977" cut into the gold | every dating | REWRITE: same |
| DiscDocument.js:17-19, 70; Items.js:108-112 | the map ("Where they meet is home"), the two figures, the margin note ("Why is this in a colony ship's orders? — K."), A.U.R.A. "An old curiosity", the item text | S1 first wreck | KEEP |

**Step 2: Earth regrets it and sends Exodus ships, told they are colonists**

| file:line | what | met | verdict |
|---|---|---|---|
| bundle.js:1192; Title.js:78 | "Eight went before you. None of them called home." | title, G | KEEP |
| StoryReel.js:222 | "Thousands of ships. Every one on its own heading." / "You are the ninth." | new game, G (default look) | REWRITE the first (cover story = colonists); KEEP "ninth" |
| LaunchArt.js:27-29 | news straps: ninth ship, sixty-one years, five names | launch film, G (new look) | KEEP |
| bundle.js:1103-1104 | "Find a planet people can live on"; "Earth is sending ships in every direction" | wake-up, G | REWRITE: our orders follow the eight's course to "the new world" |
| bundle.js:1105-1107, 1565-1566 | "Eight ships ahead of us", "not one… sent a message home?", "Probably one of the eight" | wake-up, G | KEEP |
| ExodusLogs.js:22-34 | PAGE_VAULT: the computer twin reads the 1977 disc, "Something out there has the disc", "Keep building ships"; Mira "Does ours?" | S2 page (nag) | REWRITE as the 2029 warning / Earth's regret; drop the vault twin and "something has it" |
| ExodusLogs.js:48-59 | PAGE_MEMO: "Tell them… they are the ninth"; Aris "exactly what A.U.R.A. told us" | S4 page (nag) | REWRITE: the hidden truth is the disc, not the ship count |
| ExodusDerelicts.js:370-371, 399 | flight recorder: "our briefing, word for word", "Every crew was told… you are the ninth", "eight went before us" | random wreck card | REWRITE the count lie (line 372 KEEP) |
| ExodusDerelicts.js:382 | "next ship… already ahead of you" | same | KEEP (fits the newer drive) |
| DerelictEncounters.js:242-244 | "How many ships have you really sent?" | random derelict | REWRITE: ask what they were really sent for |
| DistressSignals.js:90-91, 312 | "we are not the ninth"; "further than the eight before us" | random call, S1+ | REWRITE |
| BoardingParty.js:64 | station diary "They told us we were the ninth on this heading" | station boarding | REWRITE the first diary line |
| SpaceStations.js:352 | Vance "we were told eight. Someone lied to all of them." | Storehouse station, S4+ | REWRITE |
| AnomalyEncounters.js:583-586 | Ring of Ships: every ship plays our briefing | S4+ strange site | REWRITE: later ships did not get our briefing |
| CampfireEvents.js:391 | Vance "Earth told us there were nine ships" | 5→6 jump talk (G, one of two) | REWRITE |
| CrewEvents.js:258-260, 277-285 | Vance "They said nine ships would fly this heading"; "for other headings" | S1-2 crew moment (opt) | REWRITE lightly: keep later hulls exist, drop "nine in total" and "other headings" |
| BarkSystem.js:218 | "They told us there were eight." | wreck bark, S3+ | REWRITE lightly |
| SpaceStations.js:225-229, 270 | a beacon aimed at Earth saying "Turn back" | random station | KEEP (echoes the regret) |
| CampfireEvents.js:241, 282-283 | A.U.R.A.'s required question; "It's in my launch instructions" | 3→4 jump talk, G | KEEP |
| Corridor.js:97-100, 160-161; Coach.js:29 | "That's one of the eight", "Eight beacons…", "The briefing said eight" | jump into S2 (G), flight reports | KEEP |

**Step 3: later ships with the newer drive, thrown into the past**

| file:line | what | met | verdict |
|---|---|---|---|
| ExodusLogs.js:36-46 | PAGE_THROW: "sent less far back in time"; Jaxon reply | S3 page (nag) | KEEP (a later ship's log) |
| ExodusDerelicts.js:375-377 | "The drive sends every ship into the past" | flight recorder, S4+ | REWRITE: "the new drive's ships" |
| ExodusDerelicts.js:380 | "our clock and the star positions disagree" | flight recorder | KEEP |
| TheThrow.js:26-40, 104, 116, 135, 143; bundle.js:1047, 2676 | the stalled jump, arrival card, Mira "a lot more than eight" | jump into S3, G | KEEP (add the spore shot to the pull-back) |
| Corridor.js:105-107 | "about two hundred years", Aris "I can't keep up" | jump into S4, G | KEEP |
| Corridor.js:101-104 | lines for the jump into S3 | never play | CUT (dead) |
| DiscDating.js:85-101, 104-111 | dating reactions | every dating | KEEP |
| CrewEvents.js:145-245, 301-358 | THE LIST, THE SHIP NUMBERS, NIGHT WATCH | S1-4 crew moments (opt) | KEEP |
| SettleCouncil.js:94 | Jaxon "The drive's been throwing us back in time" | settle council, S5-6 | REWRITE: our old drive never threw us back |
| SettleCouncil.js:131-134 | Vance's middle and late lines | settle council | KEEP |
| BoardingParty.js:65-66 | diaries "Nobody set this course", "We stopped chasing it" | old stations | KEEP |
| Torch.js:117, 126-133; SectorConfig.js:221-256 | hatch lines; sector 5 glitch log | boardings; S5 warps | KEEP |

**Step 4: Eden (the trap), copies, the Wrong Place**

| file:line | what | met | verdict |
|---|---|---|---|
| SectorConfig.js:274-275 (also 81, 147) | EDEN: guaranteed in S6 but random name and spot; can also appear in S3-4 | map | REWRITE (data): one world named Eden, beside the light |
| PlanetGenerator.js:49; Travel.js:274 | "Too perfect… designed for human habitation"; "A green world" | map | KEEP |
| bundle.js:4499-4570 | "Paradise found": "the universe feels kind. Nothing here will hurt you", "This is home now" | landing on Eden (opt) | REWRITE: keep the lure, cut the narrator's promise, a little too perfect |
| EndingSystem.js:391-402, 777-778 | EDEN FOUND / CURATED GARDEN / EDEN'S SHADOW; "easy life" | settling on Eden | REWRITE: the trap must cost something |
| SectorConfig.js:145 | sector 4 named THE GARDEN ("false paradise") | S4 titles | REWRITE: a second "Eden" two sectors early |
| LateGamePOIs.js:94-106, 116-147 | domed copy of an Earth garden, rootless grass, pollen | S4+ site | KEEP |
| LateGamePOIs.js:155-157 | memorial stone: four names and a blank fifth line | same | REWRITE (dropped commander idea) |
| AnomalyEncounters.js:28-33, 129-131, 410-414, 451-466, 493-517 | the same planet twice; the floating back garden; the Door's fields | strange sites | KEEP |
| AnomalyEncounters.js:63-93 | the Wrong Place, plus "a wreck… broadcasting our own ship's ID code" | S3+ fold | KEEP the place; REWRITE the wreck line (spends the twin) |
| bundle.js:3185-3256, 4015; OrbitView.js:362-370 | "TEAR THROUGH REALITY", "The ground is a copy", "ACCEPT YOUR FATE" | the Wrong Place | KEEP |
| FailedColonyEncounters.js:236-259 | THE EMPTY TOWN | S3-4 colony site | KEEP (line 304 HOLD) |
| SpaceStations.js:365-399 | THE SILENT STATION: "a bunk with their own name on it", someone comes back "very calm" | random station, S1+ | REWRITE: a copy of us early, and a crew-copy hint |
| AnomalyEncounters.js:720-737 | the Archive: every entry ends "stopped" | S6 site | KEEP (line 786 REWRITE) |
| BarkSystem.js:284-305, 350-351 | strange-site barks | barks | KEEP (line 297 HOLD) |
| EndingSystem.js:298-308; Events.js:82 | THE GILDED CAGE; the mirage | opt | KEEP |

**Step 5: us (Exodus 9, old drive), the head count, our orders**

| file:line | what | met | verdict |
|---|---|---|---|
| bundle.js:1100, 1102 | "woken all five of you" vs "All four crew are awake" | wake-up, G | HOLD |
| bundle.js:1591-1621 | the Head count card | S1, practically G | HOLD (exists for the count) |
| Corridor.js:147-150; Breach.js:1027, 1047; bundle.js:631; ShipRoutine.js:169; EndingSystem.js:623; AnomalyEncounters.js:233 | "Four crew, no injuries" and similar | flights (G), breach, barks | HOLD |
| BarkSystem.js:191 | Vance "Five crew, all accounted for" | jump bark | REWRITE (spends the "five") |
| BarkSystem.js:101, 272, 325; CrewEvents.js:494, 528-533 | the "fifth tray"; NIGHT ON THE BRIDGE | barks; S5 moment | HOLD |
| CampfireEvents.js:100-133 | THE BEACONS AHEAD: "Hold our own course" or "Let A.U.R.A. fly the line" | 1→2 jump talk, G | REWRITE: following the eight's line IS our order |
| CrewEvents.js:30-140, 363-480 | Jaxon's daughter; Mira trusts A.U.R.A. | crew moments (opt) | KEEP (nothing says Mira is a copy) |

**Step 6: dating the dead ships with the disc's map (S1-4)**

| file:line | what | met | verdict |
|---|---|---|---|
| bundle.js:2792-2801, 2929-2935, 2957-2961, 2989-2990, 3005; Coach.js:37, 64 | the drawing in the first wreck, dating offers, "We have their last course" | S1 wreck (nag), every wreck | KEEP |
| StoryPlanets.js:17-34 | story worlds S1-4 | after dating (nag) | KEEP |
| ExodusLogs.js:10-20; FoundPage.js:98 | PAGE_PLATE: four names, a blank fifth panel "made blank" | S1 page (nag) | REWRITE (dropped commander idea) |
| bundle.js:1696-1722; StoryReel.js:230-241; Items.js:103-107; SettleCouncil.js:26, 130, 151 | the uncut briefing tape and its lines | S2 wreck (opt) | CUT (the tape film is cut) |
| StoryReel.js:242-255 | the corridor film | never played | CUT (dead) |

**Step 7: the disc in the last ship that carried it (S5 station)**

| file:line | what | met | verdict |
|---|---|---|---|
| StoryPlanets.js:37-39 | S5 world "a shelter built from the hull of one of our ships" | S5 (nag) | REWRITE: the station where the last disc ship died |
| ExodusLogs.js:61-71; FoundPage.js:18, 69-83 | PAGE_LEDGER: "lost before it was launched", empty commander column | S5 page (nag) | CUT/REPLACE with finding the disc |
| — | no text exists for picking up the real disc (it appears only "inside the light") | — | NEW TEXT NEEDED |
| SectorConfig.js:194 | sector 5 named THE TALLY | S5 titles | REWRITE |
| LateGamePOIs.js:184, 191, 193 | graves: four names per stone; "not one commander"; "Four crew per ship" | S5+ site | 191 REWRITE; 184, 193 HOLD |
| ShipRoutine.js:175 | Vance "A station… on this route on purpose" | new-look travel | KEEP |

**Step 8: the twin**

| file:line | what | met | verdict |
|---|---|---|---|
| Corridor.js:108-109 | "exactly like ours", "a quarter of a second late" | jump into S5, G | REWRITE: move to the 5→6 flight, once the disc is aboard (line 111 KEEP) |
| AnomalyEncounters.js:254-338 | OUR OWN SHIP: four people wave; "Which one of us did they leave out?" | strange site, any sector | REWRITE: rare and late, cut the line |
| DerelictEncounters.js:289-293 | THE WRONG WRECK: "This is a copy." | random, any sector | REWRITE: the only copy of us is the twin |
| AnomalyEncounters.js:531-532; BoardingParty.js:63 | "One of them turns and waves"; "a ship just like ours" | S3+ site; station diary | REWRITE |
| DistressSignals.js:386 / 397-398 | "The Commander's name isn't on it" / the extra word "home" | random call, S3+ | REWRITE / KEEP |

**Step 9: the light**

| file:line | what | met | verdict |
|---|---|---|---|
| CampfireEvents.js:353-357, 389-393 | "logged the source as a star", "I don't know what it is" | 5→6 jump talk, G | REWRITE: the crew have thought it home's sun since minute one |
| AnomalyEncounters.js:622-623; DistressSignals.js:109; ShipRoutine.js:173 | "isn't on any chart"; "is that a star?"; "One of the eight, I bet" | opt | REWRITE |
| BarkSystem.js:313, 328-329 / 314 | "There's a light ahead" / "a planet near it. Then we stop." | entering S6 (never shows: bark cooldown) | REWRITE / KEEP |
| Corridor.js:112-115; StoryPlanets.js:42-44; Coach.js:30 | "getting bigger", "no heat", "One last log" | jump into S6, G | KEEP |
| ExodusLogs.js:78-83 | PAGE_LIGHT: "It read everything they knew", "It has not read me… can't find me", A.U.R.A. "Four crew" | S6 page (nag) | REWRITE (the light as reader + commander idea; line 78 KEEP) |
| NavView.js:491-512; OrbitView.js:119-130, 348-349 | "It looks like a sun / It is not warm / Older than every wreck / Nothing answers. Something reads." | S6, G | KEEP except the two "reads" lines (REWRITE) |
| bundle.js:1777, 1916, 2427, 3664-3666, 4009 | "pulling us in", "fills every window. It is not warm" | G | KEEP |
| bundle.js:1417, 1767-1768 | "only one way from here, and it is in" | trying to leave | REWRITE if "back to Eden" becomes the choice |
| bundle.js:3813 | probe "It was not destroyed. It was read." | opt | REWRITE |
| StoryReel.js:211 | finale film beats (fills the window, no heat / moves through the ship / reads the computer) | finale, G | first two KEEP, last two REWRITE |
| bundle.js:3354 | "INSIDE THE LIGHT · THE DISC, BEING READ" | finale, G | CUT (the disc comes from our hold) |
| StructureEncounter.js:18-24 | approach card: "Five crew"; "reading everything I know"; "It cannot find you" | finale, G | REWRITE (context line's first two sentences KEEP) |
| SectorConfig.js:290-315 | sector 6 hazard lines | never fire | CUT (dead) |

**Ending**

| file:line | what | verdict |
|---|---|---|
| StructureEncounter.js:28-124 (lock at line 10) | six endings locked by how often you backed each person; "read", "made her again", "it cannot see you" | REWRITE all to the new choice (into the light = peace, back to Eden = trap, the disc's fate) |
| StructureEncounter.js:43, 59, 73, 89, 105, 121; bundle.js:3411, 3269 | "IN THE VAULT ON EARTH", "Twin 0009" | CUT (the PAGE_VAULT idea) |
| Torch.js:134, 137-138 / 135 | "The light reads whatever it touches" / "Where the lines meet is home" | REWRITE / KEEP |
| bundle.js:3262-3268 | Wrong Place ending: "There are always four" | REWRITE (Eden's work, no crew-copy hint) |
| EndingSystem.js:98-101, 541, 618, 643-647, 803, 835; EndScreens.js:15, 41, 70-78; bundle.js:3501 | other endings and screens | KEEP |

**Other**

| file:line | what | verdict |
|---|---|---|
| SectorConfig.js:12, 46, 79, 272; bundle.js:2726 | sector names GRAVEYARD, DARK VOID, SIGNAL, LIGHT | KEEP (GARDEN and TALLY above) |
| bundle.js:2450-2457, 2474-2479 | the jump questions | KEEP |
| BarkSystem.js:240 / 245 | "Four names on every stone" / "More beds than graves" | REWRITE / KEEP |
| AnomalyEncounters.js:649-712 | THE LIST IN THE SKY (every ship "4") | CUT (count idea) |
| OrbitView.js:167 | every station: "Earth. A mission before ours." | REWRITE (later ships' stations come after ours) |
| CampfireEvents.js:138-232 | THE SAME DREAM, HULL CRACKS (never play) | CUT or ignore |
| AuraSystem.js; SettleCouncil.js (rest); other wreck/derelict/colony/station/call cards | tone and incidents (wreck crews of five are right now) | KEEP |
| PlanetGenerator.js:34, 48, 50; Travel.js:271, 274 | "Someone built this", "dead cities" | low priority |
| LaunchArt.js:138-140 (picture) | the programme flag shows the disc's star map | decide: would Earth fly the map it regrets? |

## 2. Guaranteed vs optional, by sector

- **S1.** G: the tagline; the launch film (new look); the wake-up talk; the head count; the breach's "All four crew are safe" after
  two warps. Nag: the marked first wreck with the disc drawing and dating, then Rhea-4 Minor and PAGE_PLATE. Opt: crew moments,
  OUR OWN SHIP, THE WRONG WRECK, THE SILENT STATION, the "not the ninth" calls.
- **S2.** G on arrival: the flight lines, A.U.R.A.'s report ("Four crew… Eight beacons"), a jump bark, THE BEACONS AHEAD. Opt: the
  tape (to cut); Dione-2 Prime and PAGE_VAULT.
- **S3.** G: the stalled jump, the throw, the arrival card, the S3 entry bark. Opt: PAGE_THROW, the phantom world, strange sites, an
  Eden-type world.
- **S4.** G: the flight lines ("about two hundred years"), A.U.R.A.'s required question. Opt: PAGE_MEMO, the Garden, the Lighthouse,
  the Ring of Ships, the Storehouse, an Eden-type world.
- **S5.** G: the twin flight, NO WAY BACK. Opt: PAGE_LEDGER, the Grave, NIGHT ON THE BRIDGE, glitch lines.
- **S6.** G: the flight lines; the jump talk; the light; "pulling us in"; the reading film; the disc inside the light; the approach
  card; the choice; the ending. Opt: PAGE_LIGHT, the Eden world (if you land), the Archive, the List in the Sky.

## 3. The five worst contradictions (in the order a player meets them)

1. **The opening sells the old lie and the wrong orders** (all G): "ships in every direction", "find a planet people can live on",
   "every one on its own heading", and the first jump talk makes following the eight's line optional and deadly.
2. **The disc is the 1977 Voyager record, and "something out there has it"** (S1-2).
3. **The dropped commander / empty-seat idea is still the spine**: the S1 plate with a blank fifth panel, the head count, the empty
   commander column, "not one commander", and at the end "It cannot find you" and A.U.R.A.'s "Five crew".
4. **The twin and the disc are out of order**: the twin flies on the jump into S5, but the disc is never picked up; copies of our own
   ship can show up from S1.
5. **The light and Eden have swapped roles**: the light is the reader with the disc inside it (the finale and all six endings); Eden
   is pure kindness with a happy ending, randomly named and placed; the crew meet the light as a late surprise.
