# Audit of the working story spine (2026-10-04)

Three independent readers checked docs/STORY_SPINE_WORKING.md: one against everything already built in the game, one against
its own logic, one against the designer's decisions and rejections since the start. Nothing was changed in the game.

## 1. Continuity with the built game

**Continuity audit: the working spine against the built game (read-only, no files changed)**

The built game still tells the old story in four places every player sees: the disc sits inside the light, the opening says "thousands of ships" and "every direction", the throw gives away the ending in sector 3, and five of the six found pages explain the old canon. Most of the middle of the game already fits the spine: the corridor counts, the dating minigame, the wrecks and the light.

## 1. Where the built game contradicts the spine (most noticeable first)

### A. Every player sees these

1. **The disc inside the light.** `bundle.js · showStructureModal` (line 3033): "INSIDE THE LIGHT · THE DISC, BEING READ" and "It is reading the map, Commander. Half of it is read." Also `Torch.js` line 112: "The disc is drifting into the light. The light reads whatever it touches."
   - Spine §11 (LOCKED): there is one real disc, it does not need to be at the light, and nobody goes to fetch it.
   - Fix: cut the disc card, so the finale goes straight from the "reading" film to the approach card. Hold the torch's disc mode until the map has a job at the light.

2. **Four endings use the physical disc.** All in `StructureEncounter.js`.
   - CARRY_ON is always open, so fix it first. "You go out and take the disc. It cannot see your hands…" Rewrite: "You fly past the light and you do not stop." Keep its third paragraph.
   - BREAK_MAP: "What Earth sent us to do." and "The disc is there… You cut through the map on it." This clashes with §11, and with §14: Earth sends ships because it misread the message, not to destroy the map. Its vault line "…this means it worked" assumes the same goal. Fix: hold this ending until the spine gives the map a job at the light.
   - AURA_DECIDES: "burns the drive, the disc and herself". Cut "the disc".
   - WAKE_SLEEPERS: "You go out with the cutting torch, and you cut the map." Cut that sentence.

3. **The opening film.** `StoryReel.js · program` line 270: "Thousands of ships. Every one on its own heading."
   - Spine §1 and §3: when hull 9 leaves, only nine ships exist. The new drive and the thousands come after it.
   - Fix: "Thousands more will follow." Whether to keep "each on its own heading" depends on what the official story is (the designer's call, see section 2).

4. **The opening card.** `bundle.js · showOpeningBriefing` line 1386: "Earth is sending ships in every direction."
   - Same clash as item 3. A.U.R.A. would be stating something false.
   - Fix: keep only "Eight went this way before us. We are the ninth." That part is now literally true.

5. **The throw shows the end of the ladder in sector 3.** `TheThrow.js · BEATS` lines 35–37: "Every ship Earth ever built. All on the same heading." and "Yours is the last one in the line."
   - Spine §18 and §19: sector 3 only gets "this wreck should not exist yet". "Earth never stopped" belongs to sector 5 and "we are the last" to sectors 5–6.
   - Fix: cut beats 36–37 and change 35 to "Ships. Far more than eight, in one long line." Or move the whole throw to the jump into sector 6, where every line becomes true.

6. **"It cannot find you."** This is left over from the rejected "the commander was never written down" answer.
   - Finale approach: Aris, "Not you, Commander. It cannot find you." and Jaxon, "Then whatever we do here, you are the one who has to do it."
   - In the endings: "It can't see you. Go." (BREAK_MAP), "where it cannot see you" (BE_READ), "It cannot see your hands" (CARRY_ON), "because it cannot see you" (WAKE_SLEEPERS).
   - Spine §24: the light reads whatever reaches it. §25: the count stays unexplained for now.
   - Fix: cut Aris's line, Jaxon's line and the four clauses.
   - Keep A.U.R.A.'s "Five crew, Commander." and Vance's reaction as the open hook.

### B. The found pages (one per sector, every run)

7. **PAGE_VAULT, sector 2** (`ExodusLogs.js` lines 29–30): "It was reading out the gold disc…" and "Something out there has the disc, and it is reading it through our ship."
   - Clashes with §11. Also with §7: hull 1 died first and closest to home, so it never reached the light.
   - Fix: rewrite the two lines as "The first ship's twin sent us a few weeks of star fixes. Then it went quiet."
   - Keep "Keep building ships." It answers §22.

8. **PAGE_MEMO, sector 4** (lines 53–56, plus Aris's after-line): "Tell them… eight ships went this way before them, and they are the ninth." and "Your ship's computer knows the truth. It will not tell them."
   - It is found on hull 2,210, whose crew knows its own number. "Eight before" is true only for us (§4).
   - A.U.R.A. launched before anything after hull 9 existed, so she cannot know (§1, §25).
   - Fix: replace the whole page with a new-drive document, which is what spine §19 wants in sector 4. For example: "Drive generation two. Fitted from hull ten on. Faster and safer than the first nine."
   - The after-line could be Jaxon repeating his opening line about ship ten (see section 3).

9. **PAGE_LEDGER, sector 5** (lines 68–69).
   - "Our ship is the last line." The ledger is in launch order, so ours is line nine. Spine §5 says we are the last arrival, not the last launch.
   - "The commander's column is empty on every line" is left over from the rejected count answer.
   - In `FoundPage.js · ledgerRows`, ours is tacked on at the end. The CMDR column and filler rows up to 41,000 also sit in a book carried by hull 17,207, which could not list ships launched after it (§3).
   - Fix: "Ours is line nine. Every line after ours was lost before we arrived." Change "On every line" to "On every line after ours". Cut the commander sentence and the CMDR column. Stop the rows at 17,207.

10. **PAGE_LIGHT, sector 6** (lines 80–81): "It has not read me. I don't think it can find me." and "you are the last ship."
    - The first is the rejected answer again (§24, §25).
    - A captain dead 400 years cannot know who comes last (§6, §28).
    - Fix: cut the first line. Change the second to "If you are reading this, you came after us. Go to it. Then decide."

11. **PAGE_THROW, sector 3** (line 43): "We were not sent further than the others. We were sent less far back in time." Jaxon adds: "Back in time? That would explain the numbers."
    - The page explains the twist in sector 3 (§18, step 7 comes later), and a character says it out loud (§28).
    - Fix: cut line 3 and Jaxon's line. Lines 1–2 already do sector 3's job.

12. **PAGE_PLATE, sector 1** (lines 16–17): "It is blank. It was made blank." This is listed in the brief (§9.9) as left over from a rejected answer.
    - Fix: put a commander's name on the fifth panel and cut lines 2–3.

### C. Most runs see these

13. **The sector 3 age is given before dating.** Spine step 5 says dating is what proves the wreck is old.
    - `bundle.js` SECTOR_ARRIVAL_LINES.3: "…and they are a hundred years old." Cut that clause.
    - `Corridor.js` LINES.3, Jaxon: "That one's been dead about a hundred years." Cut it, or say "That hull's in worse shape than any of the eight."
    - `Torch.js` line 104: "[hull]. Dead about [age]." Drop the age from sector 3 on.

14. **The sector 2 tape.**
    - It is planted in a sector 2 wreck, which is always hull 1–8 (`WRECK_HULL_RANGE[2]` is [1,8]). Those ships launched before anything came after us.
    - The tape's caption, "Look at your heading. It is not eight ships.", plus Vance's "That is hundreds." (line 1526), is more than the hint spine §19 allows for sector 2.
    - A.U.R.A.'s "Old recordings degrade…" (line 1527) makes her dodge the question.
    - Fix: caption "The film keeps running after the ninth ship." Cut both log lines.

15. **The age and order of hulls 1–8** (§1, §4, §5, §7).
    - `DiscDating.js` AGE_BY_HULL `[1, 18], [8, 24]` dates hull 8 as dead longer than hull 1. Make it `[1, 30], [8, 10]`. The dating chart will then turn at the frontier.
    - `WRECK_HULL_RANGE` uses [1,8] in both sector 1 and sector 2, and `Corridor.js` sector 2 also uses [1,8]. Use low numbers in sector 1 and high in sector 2.
    - `StoryPlanets` sector 1 is hull 6, with Mira's line "They saw a lamp on that moon and went to help." Hulls 6, 7 and 8 are reserved, so every wreck you can date in sector 1 is 1–5. Under the spine those arrived before hull 6 and could not have seen its lamp.
    - Fix: make the sector 1 story wreck hull 1. That gives exactly §7's "2 found something left by 1".

16. **The disc page.** `DiscDocument.js`.
    - Line 69, A.U.R.A.: "An old curiosity, Commander." Under §17 this map is the basis of all Exodus navigation, so she would not brush it off.
    - Line 18, the margin note: "Why is this in a colony ship's orders? Why is it the only page marked with our heading?"
    - Also, §16 says our ship already has the map aboard; in the game the crew only gets it from a wreck.
    - Fix: A.U.R.A. says "The Voyager map, Commander. Every fix I take is checked against it." The margin becomes "Our fixes stopped matching this after the third jump. — K."

17. **Vance's shipyard story.** `CrewEvents.js` line 257: "They said nine ships would fly this heading."
    - If Jaxon casually says "Ten gets the new drive" (§2), Vance's secret is no secret.
    - Fix: "They said ten would be the last. I counted thirty-one keels in one year."

### D. Random pools (some runs)

18. **"Every crew was told 'you are the ninth'."** In the spine, "eight went before" is true only for us, and no other ship was told it.
    - `ExodusDerelicts.js` 361–362 (the crew briefing lines) and 390 ("The ship says eight went before us"): cut.
    - `DistressSignals.js` 90–91, "we are not the ninth" and "So they were told the same thing": use "…we got further than…" and Vance "Further than who?"
    - Line 312, "further than the eight before us": change to "the ones before us", which is §7 exactly.
    - `AnomalyEncounters.js` ANOMALY_CHORUS (lines 580–583: "It's our briefing" and "That is the standard briefing"): have the ships broadcast "Faster and safer than the first nine."
    - `BoardingParty.js` line 59, "They told us we were the ninth on this heading": "They told us the new drive was safe."
    - `SpaceStations.js` line 351, "we were told eight. Someone lied to all of them": "All of them launched after us."
    - `CampfireEvents.js` line 391, "Earth told us there were nine ships": "Earth kept building after we left."
    - `BarkSystem.js` line 272 ("Both numbers are wrong") and line 324 ("Earth knew… and sent us anyway"): rewrite to match.

19. **"Each new ship goes further back."** `ExodusDerelicts.js` line 368 (sector 4 on). In the spine, hulls 1–9 are thrown back about the same amount; only the new drive throws much further. It is also the ship's computer explaining the twist. Fix: cut the two lines that explain.

20. **The Earth message arrives too early in the game.** "LAST MESSAGE FROM EARTH: …it's already ahead of you." (line 373) can fire on hulls 1–8, whose next ship arrives after them. Fix: only allow it from sector 3; it then supports §22.

21. **Future ships look exactly like ours** (§21: the more advanced the ship, the older the wreck).
    - `bundle.js` line 2511: "They were all built to one drawing."
    - jump5 film: "A ship that looks exactly like yours." Change to "A ship far newer than yours, dead far longer."
    - `DerelictEncounters.js` line 165, Vance: "I watched them fit it at the shipyard".
    - `AnomalyEncounters.js` line 751: "copies of ours".
    - Every hull in the corridor is drawn as our class.

22. **Every crew met the same end** (§10 says fates differ).
    - Line 734: "every entry ends with the same word: stopped." Make the entries mixed: settled, turned back, reached the light, lost in a jump.
    - BE_READ: "Forty thousand crews were read." Change to "Thousands of crews reached it afraid."
    - `LateGamePOIs.js` lines 75 and 80: "none came back".

23. **The sleepers.** WAKE_SLEEPERS says "They have seen more of this than you." Spine §9 and §26: later ships had better machines and less history. Fix: "Better machines than ours. They have seen less of this than you."

24. **The commander missing from the dead.**
    - `LateGamePOIs.js` line 191: "not one commander." and line 193: "match the crew lists".
    - Line 155: "a fifth line, left blank".
    - `DistressSignals.js` line 386: "The Commander's name isn't on it."
    - These point at the rejected answer. Cut them, and keep the plain "four" lines.

25. **A count mismatch (not a spine issue).** `CrewEvents.js` line 307, Vance: "Three hundred and eleven ship beacons so far". The corridor already showed 687 on arrival in sector 3.

## 2. Built pieces with no place in the spine (the designer must decide)

- **Copies of our own ship, crew and calls before the light could have read us** (§24, and §5: we arrive last). Examples: ANOMALY_MIRROR "same hull, same number, same scratches" (line 257), "Our own distress call… arrived before we ever sent it" (sector 3 on), the door copied "down to the scratch", Jaxon's "the one I left", "I never sent ours", and the violet twin in the jump5 and jump6 films. Either adopt a rule (the twin link lets it read us early) or make them copies of sister ships.
- **The twin vault.** It ends all six endings and the Wrong Place ending ("Twin 0009…"). It is still an open variable in the spine.
- **A.U.R.A.'s "real orders"** (AURA_DECIDES, and "I'm required to ask this once"). The spine has no hidden-orders thread.
- **The torch's disc mode, and "Destroy the map" as Earth's aim.**
- **The "official story" behind "every direction" and "Say they were for other headings."** The spine's sector 2 says one exists but never states it.
- **The title line "NONE OF THEM CALLED HOME"** (`bundle.js` line 1043) and A.U.R.A.'s "Space is very large". They commit early to the spine's top open question (§22, where the lead idea is that each mission sends back a little). Drop the second sentence until §22 is decided. Two smaller ones belong here too: "No ship before us reported back." (NavView) and "A mission before ours." (OrbitView).

## 3. Spine beats with no built piece yet

- Jaxon's "Ten gets the new drive." (§2).
- The 2029 message and its pulsar language (§13, §17). Nothing mentions it.
- New-drive evidence in sector 4 (the replacement for PAGE_MEMO).
- Wrecks of later ships that look more advanced (§21).

## 4. Built pieces that already support the spine (keep)

- "EIGHT WENT BEFORE YOU.", "On yours, eight went first. You are the ninth.", and A.U.R.A.'s "Eight went this way before us." are all now true. Keep Jaxon's "I hope they left us a good planet."
- The head-count scene, as it is.
- Sector 1 "The graveyard of humanity's first attempts." and sector 2 "The last of the eight ships should be out here."
- Breadcrumbs: "They line up along our heading.", "a single flight plan… the same as ours", "For whoever comes next.", "Don't build until you've tested the soil.", and "I got further than…" once fixed.
- Corridor counts 8 / 687 / 5,614 / 21,483 / 39,806 with two hulls seen, and Vance's "Hull 212. We're hull nine."
- The whole disc-dating minigame: "Only eight ships launched before us.", "A higher number should be newer.", "…there was no Exodus programme.", "The reading is correct.", the chart, and the reward that follows a crew's last course.
- Aris: "A higher number should be newer than us, not older." A.U.R.A.: "I have no explanation."
- PAGE_THROW lines 1–2, and "Keep building ships."
- The settled worlds in sectors 4 and 5. The settling endings' "hull numbers are higher than ours" and "older than any ship we know of". The colony line "built long before we launched".
- "our clock and the star positions disagree", the archive's "one extra chapter", and the lighthouse's "safest route onward… for any ship that comes after it".
- Everything about the light: "no heat", "It was not destroyed. It was read.", "Nothing answers. Something reads.", "It reads the ship's computer first."
- The copied places (ghost planets, the Wrong Place).
- The SETTLE ending, and "People from ships built long after ours."
- "How many ships have you really sent?" and the "Turn back. Exodus 9." beacon, which is a natural seed for the warning sent back in time.

## 5. How much needs to change

| What | Amount |
|---|---|
| Found pages | 6 of 6 touched: 16 lines (PAGE_MEMO replaced whole) and 2 code tweaks to the ledger |
| Scenes | 13: opening film, opening card, the throw, the sector 2 tape, the sector 3 arrival card, the finale disc card, the finale approach, 5 endings, the torch disc mode. About 25 lines |
| Minigame lines | 4 (corridor, torch hatch, disc page ×2), plus the dating age table and the corridor hull art |
| Crew moments | 2 lines |
| Random pools and remarks | About 28 lines |
| Data and code | About 6 tweaks: hull ranges ×2, sector 1 story hull, gating the Earth message, ledger column and row cap |
| **Firm total** | **About 75 player-facing lines and about 8 data/code/art tweaks** |
| Waiting on open decisions | About 19 more lines (tagline, copies of us, vault lines, two A.U.R.A. lines) |
| New lines to write | Jaxon's "ten" line, the sector 4 drive page, the 2029 message thread |

Main files: `src\data\ExodusLogs.js`, `src\data\StructureEncounter.js`, `src\bundle.js`, `src\systems\TheThrow.js`, `src\systems\StoryReel.js`, `src\systems\minigames\DiscDating.js`, `Corridor.js`, `Torch.js`, `src\systems\DiscDocument.js`, `src\systems\FoundPage.js`, `src\data\StoryPlanets.js`, and the pool files in `src\data\` (ExodusDerelicts, DistressSignals, AnomalyEncounters, SpaceStations, LateGamePOIs, CampfireEvents, CrewEvents) plus `src\systems\BarkSystem.js` and `BoardingParty.js`.

## 2. Logic

# Logic review of STORY_SPINE_WORKING.md

**Verdict.** The spine never says what year it is for EXODUS-9 when it wakes. Most of the holes below come from that.

- **What the built game implies:** "now" is about 2340. The ledger has hull 9 launching in 2281 (`FoundPage.js` line 14, `LEDGER_YEAR0 = 2281`), and the crew then slept 61 years.
- **What a radio warning needs:** a message that reaches Earth in 2029 by ordinary radio has to leave the light in the year 2029 minus the light's distance. `DiscDating.js` (`lyOf`) puts the sector 6 wreck about 177–184 light-years down the heading. So "now" would be about 1850 or earlier.
- **What that means:** "now" would be before pulsars were discovered (1967) and before the disc was made (1977).

You have to pick one of these. I recommend the second (Fix A at the end).

## Ranked holes (most noticed first)

### 1. The disc can't be at the light, but four of six endings need it there. Severity 5
- "The disc is there, gold, the size of a dinner plate." (`StructureEncounter.js` · BREAK_MAP, line 39)
- "You go out and take the disc." (CARRY_ON, line 69)
- "burns the drive, the disc and herself" (AURA_DECIDES, line 86)
- "you cut the map" (WAKE_SLEEPERS, line 103)
- "It is reading the map, Commander. Half of it is read." (`bundle.js` line 3033)

**Why a player notices:** It is the climax. Spine §11 already moves the disc away from the light, and if "now" is before 1977 the disc does not exist yet.

**Fix:** The object at the end is the ship's own transmitter, not the disc. The ending question becomes "what do we send home?", not "what do we do to the disc?".

### 2. One timeline, but the endings don't all send the warning. Severity 5
If the 2029 warning always existed (§15, §28), every run that reaches the light must send it, and it must break into the same fragments every time. None of the six built endings sends anything; "Settle" and "Let Aris go" plainly don't. Early colony endings and game-overs raise the same question: if we settle in sector 3, who sent the 2029 message?

**Why a player notices:** A time-travel reader asks this after their second ending.

**Fix:**
- Sending happens in every finale, before the choice. This pays off an existing setup: "I'm to ask once… and record the answer." / "Record it where?" (`CampfireEvents.js` CF_AURA_ETHICS).
- The choice is then about what the crew adds and what they do afterwards. Fix B makes this safe: whatever they say, the same numbers arrive.
- Treat colony endings and game-overs as runs that failed to get there.

### 3. "Now" is undefined, and either answer breaks something. Severity 5
- **If "now" is after 2029** (the built numbers): the warning needs a second time machine, the twin link that "does not care about when". Earth then has a live line to every ship in every century and could simply ask. Earth's misreading (§14) and Earth's ignorance (§22) both fall apart.
- **If the warning travels at light speed:** "now" is the year 2029 minus the light's distance, so roughly 1850 or earlier. Hulls 1–8 then died in the 1800s and the oldest wrecks in the 1400s.
- **CANON line that dies either way:** "EXODUS-9 had the weakest drive. It was thrown the least far back." For the light-speed answer, hull 9 must be thrown back more than the light's distance plus 61 years.

**Fix:** Fix A.

### 4. Why Earth keeps building, and why it stops. Severity 5
With light-speed travel, a signal sent X years before we arrive, from Y light-years short of the light, reaches Earth in 2029 − X − Y. With the chart's distances, every Exodus signal except ours reaches Earth before about 1850.

What Earth knows at each stage:
- **Before 2029:** nothing it could have heard.
- **In 2029:** the message.
- **After launching a ship:** nothing from it, ever.

So the §22 ideas ("each mission transmits a little before silence", "data… in strange temporal order") are impossible.

**Fix:**
- **Make the silence expected.** The sky-date in the 2029 message shows the sender was in Earth's past. So Earth knows from the start that no ship will ever call home. That is "the truth" in "We told the first crews the truth. They stopped flying within a week." (PAGE_MEMO)
- **Put the motive in the message itself:** a count Earth reads as a target (Fix B).

### 5. The launch ledger has no possible author. Severity 4
The page says: "Every Exodus ship ever built, in order… Our ship is the last line." (`ExodusLogs.js` PAGE_LEDGER)

- **The author problem:** It is found in hull 17,207, dead 300 years. That ship left Earth before hulls 17,208–41,000 launched. It also died before every lower hull arrived, so it can hold none of their loss dates.
- **The order problem:** In launch order, hull 9 is line 9, not the last line.
- **What the code shows:** `FoundPage.js` line 74 appends EXODUS-9 after the 40,000s, with the earliest launch year (2281).
- **Two numbers that disagree:** The gold rows for boarded hulls 1–8 read "failed 2241". The disc dated those same ships 18–24 years dead, which gives about 2320. That is roughly 80 years apart on the same screen.

**Fix:**
- Make it Earth's printed launch schedule, with a drive column: Mk I for hulls 1–9, Mk II from 10. Drop the "lost" column.
- The loss dates come from the player's own dated wrecks.
- "We arrive last" then becomes the player's own deduction: every Mk II lands before us.

### 6. The twin is a second time machine and a second origin story. Severity 4
"At 03:14 the twin of the first ship started talking in a voice that was not its own." (PAGE_VAULT)

This contradicts the spine's own origin (the 2029 message). Every ending's "In the vault on Earth" line also leans on it.

**Fix:** Every twin goes silent at its ship's first jump. Rewrite PAGE_VAULT around the 2029 signal. Cut the vault lines at the end of each ending.

### 7. Why sending ships is bad (§23). Severity 4
The navigation-record answer explains how the light could know where Earth is:
- Every Exodus navigation system logs pulsar fixes against the disc (§16–17).
- A pulsar fix is an exact address.
- The light reads computers first: "It reads the ship's computer first." (`StoryReel.js` · reading)

But it opens a new hole. The first ship to arrive, about 400 years before us, already handed over Earth's address. "Half of it is read" and "It will never know where we are" then become false. And since the light never comes to Earth, the address costs nothing anyone can see.

**Fix:** Make the stake the people. That is 41,000 crews thrown back to centuries before they were born, to die or be read. Leave the address as quiet dread, and don't build an ending on protecting it.

### 8. Dating against a 1977 disc. Severity 4
Pulsars only slow down. A sky older than 1977 ticks faster than the disc says, so every mark stops short of its notch and "years" would have to go below zero.

The minigame slides marks "toward the disc's notch" to get "years dead" (`DiscDating.js` header). That quietly treats the 1977 disc as our own present sky. Crews already notice the mismatch: "our clock and the star positions disagree" (`ExodusDerelicts.js` line 371).

**Fix:**
- The disc is the ruler, not the zero. A.U.R.A. gives wreck ages only, measured against our own sky.
- In one late scene, someone dates our own sky. Mira: "Commander, our own sky is older than the disc."

### 9. "If you are reading this, you are the last ship." Severity 3
(PAGE_LIGHT, hull 40,963.) About 40,000 later arrivals could read this page, and the writer can't know which one is last. "I don't think it can find me" is also left over from the rejected count answer.

**Fix:**
- New line: "Every wreck I find has a higher number than ours. Whoever reads this has a lower one."
- Add a floor rule, because §27 calls the pattern only a "broad trend". Every Mk II is thrown further back than any Mk I. A failed jump lands where its drive would have taken it.

### 10. Why the advanced ships didn't warn Earth or turn back. Severity 3
- "The message is 'Turn back.'" (`SpaceStations.js` STATION_MILITARY, line 229)
- "One ship turned back." (PAGE_MEMO)
- The Settle ending, "You turn the ship around" (line 117), against "We do not move" at the light (`bundle.js` line 1225).

**Fix** (falls out of Fix A):
- **They did warn Earth.** Their calls landed between about 1400 and 1850, before anyone had a radio. Ours is the only one heard. That answers "why us" without a chosen one.
- **Turning back:** A ship that turns for home arrives before home has built it. One timeline means none arrived, so show one wreck pointing home.
- **The optional beacon choice:** "Turn back. Exodus 9." (line 270) sent from sector 5 or 6 would reach Earth around 1980–2025, but only in some runs. Make it one-way or cut it.

### 11. The breadcrumb trail is invisible, and the code runs it backwards. Severity 3
**How the trail should work:** Hulls 1–8 share one drive and one route. So each passes the previous ship's death site exactly one launch-gap later, and does find it in time. The wreck ages we see equal the launch gaps, so hull 1 is the oldest of the eight and lies nearest.

**What the code does:**
- `DiscDating.js` lines 23–24 have `[1, 18], [8, 24]`, which makes hull 8 older than hull 1.
- `bundle.js` line 965 gives sectors 1 and 2 the same pool of hulls 1–8, so they turn up out of order.
- "None of them died of anything I can diagnose." (`CrewEvents.js` line 152) leaves no mistakes to learn from.

**Fix:**
- Set hull 1 to about 30 years dead and hull 8 to about 10, and place them in order.
- Give each one mistake you can name. Sector 1 already has one: "They saw a lamp on that moon and went to help."
- The dating chart then forms a V whose turn falls exactly between hull 8 and hull 10.

### 12. Hulls 10–211 exist nowhere. Severity 3, rising to 4 once Jaxon's "Ten gets the new drive" line is in
Every range starts at 212 (`bundle.js` line 965, `Corridor.js`, `FoundPage.js`). Vance already set up a number: "He saw ship number 31 being built." (`CrewEvents.js` line 294)

**Fix:** Make the first wrong wreck in sector 3 EXODUS-31, about 50 years dead. Vance: "Thirty-one. I watched them paint that number."

### 13. Was the 2029 message public? Severity 3
If it was public, the crew would make the connection at once.

**Fix:** It was secret. The public story is "Earth is sending ships in every direction." Only the commander's orders mention 2029. At the end, A.U.R.A.: "If we send it now, Commander, it reaches Earth in 2029."

### 14. Earth could have tested the drive, and one line says Earth already knows. Severity 3
"If you can hear this, it's already ahead of you." (`ExodusDerelicts.js` line 373) No message from Earth can reach a ship in Earth's past, under any version of the time model.

**Fix:**
- One drive rule: the faster the jump, the earlier it lands you, and the effect grows with distance. Short test hops barely show it. This makes "faster and safer" bitterly ironic.
- Cut line 373.

### 15. Scale. Severity 2
The code launches all 41,000 in 58 years (`FoundPage.js` line 72, about 700 a year). The 400-year spread on the route comes from the time throw, not from Earth's calendar.

**Fix:** The programme takes decades, not centuries. The old drive was hand-built, about three years per ship, which also spaces out the trail. The new drive came off a line.

### 16. "Farther in space" against "one route". Severity 2
"It said we were not sent further than the others." (PAGE_THROW) contradicts §4.

**Fix:** One road, different on-ramps: a faster drive's first jump drops the ship deeper along the same heading. That is also why sectors 1–2 hold only hulls 1–8.

### 17. Beacon range. Severity 2
The oldest, deepest beacons have had centuries to reach sector 1, so the beacon counter (8, then 687, up to 39,806) would start high.

**Fix:** Beacons carry only a few light-years. The same rule explains why Earth never heard them.

### 18. 400 years and 41,000 ships, but no living descendants. Severity 2
**Fix:** The settled worlds were the light's unfinished copies. The game already says "The ground is a copy, and it is not finished." Show one colony that came apart.

### 19. Small lines. Severity 1–2
- **Jaxon's daughter:** "She'd be older than I am now." — under Fix A she isn't born yet. That becomes a payoff once the twist lands.
- **The deep-wreck dating line:** "[age] years ago there was no Exodus programme." — under Fix A this is true of every wreck, not just the deep ones.
- **The end-screen button:** "BEGIN AGAIN — a new crew, the same road" contradicts "nothing comes after us".
- **Spine §13's "impossible values":** under light speed the pulsar values are perfectly consistent. What is impossible is the author: someone used a 1977 map language in the 1800s.
- **If "9" survives in the message:** Earth would know which hull arrives and treat it as chosen. Keep the sender's number out of what survives.

## The three fixes that close the most holes

**Fix A — the warning travels at the speed of light.**
- EXODUS-9 wakes the light's distance before 2029, so about 1830 on the current chart.
- One drive rule: the faster the jump, the earlier it lands you.
- **Closes:** 1, 3, 4, 6, 8, 10 ("why us": only the last arrival's call lands after radio exists), 12, 14, 16, 17, and the floor rule in 9.
- **Costs:** the ledger years need retuning, the twin link goes, and line 373 is cut.

**Fix B — one rule for the damage: only what A.U.R.A. repeated got through.**
- After about 200 light-years the signal is barely above the noise. Earth has to add up the repeats to hear it, the same way pulsars are found.
- A.U.R.A.'s data block repeats: the star fix, the sky-date, and "41,000 hulls". The crew's voices went out once and are lost.
- **Closes:**
  - why the message is broken
  - why Earth reads the astronomy right and the intent wrong
  - 2: every ending can send, because whatever the crew says is exactly what gets lost
  - 4 and 15: Earth reads a tally of the dead as a target, builds 41,000, and stops
  - 5: Earth can print the schedule in advance
  - 16: the star fixes become the "precalculated route"
  - the uncut tape's "hundreds", which was the plan

**Fix C — the player proves the inversion with their own hands.**
- Reverse the ages of hulls 1–8, so the chart forms a V.
- Make EXODUS-31 the first wrong wreck.
- Turn the ledger into a launch schedule with a drive column, with loss dates from the player's own dating.
- Change the sector 6 log to "Whoever reads this has a lower one."
- Add one scene where the crew dates its own sky.
- **Closes:** 5, 8, 9, 11, 12, and step 8 of §18 ("we are the last arrival") as the player's deduction rather than a document's claim.

Files read are under `C:\Users\farha\Claude\Project_Star_Map\Project_Start_map\`:
- `docs\STORY_SPINE_WORKING.md`, `docs\STORY_BRIEF.md`, `docs\CANON.md`, `docs\STORY_SPINE.md`, `docs\script\*.md`
- `src\data\ExodusLogs.js`, `src\data\StoryPlanets.js`, `src\data\StructureEncounter.js`, `src\data\SpaceStations.js`, `src\data\ExodusDerelicts.js`, `src\data\CrewEvents.js`
- `src\systems\FoundPage.js`, `src\systems\StoryReel.js`, `src\systems\minigames\DiscDating.js`, `src\systems\minigames\Corridor.js`
- `src\bundle.js`

## 3. Coverage: covered, partly covered, open

**Coverage audit: STORY_SPINE_WORKING.md compared with STORY_BRIEF.md, the designer's history and the built game**

**Verdict:** the spine solves the physics: the time rule, why ship 9, and how the one disc fits. It leaves the three things a player feels most unanswered: the count, what being read costs, and the ending. It also drops two pillars without saying so: the lie told to the crew, and the disc being at the light, which the whole finale is built on.

### Table 1: Covered (ranked by how much a player would notice)

| Problem | How the spine answers it | Good? (1–5) |
|---|---|---|
| The time rule contradicts itself (brief §9.3, ask 5) | Ships 1–9 use the first drive and arrive in launch order. Ships 10 and later get a new drive and are thrown far back (spine §1, §4). "Eight went before us" becomes true in both orders, so A.U.R.A. never has to lie. | **4.** Simple and fits the sector table exactly. Built text still states the old rule (see the drops section, item 10). |
| "Why us?" — why we can understand it (brief §9.2, ask 1, first half) | We reach the route when it holds the most evidence it ever will: eight failures behind us, future wrecks ahead. "The advanced ships have technology. EXODUS-9 has history." (§26) | **4.** Gap: hull 900 also saw higher-numbered, older wrecks. Our real edge, stated in §7–8 but not as the answer, is that we are the only old-drive ship to get past where ship 8 died, and the last ship to arrive. |
| The disc cannot physically be at the end of the heading (brief §9.4) | "The physical disc does not currently need to be at the Light." Only the map on its cover matters (§11–12). | **4** on logic. It costs the finale (drops section, item 2). |
| The disc does not register in play (brief §9.4) | One idea links everything: the 1977 pulsar map, then the 2029 message written in the same map language, then Exodus navigation, then the dating minigame, then the reveal (§17). | **4** |
| One disc only (designer; disc copies rejected) | Locked in §11: "No copies." | **5**, with one borderline point (drops section, item 9) |
| We are ship 9; earlier crews saw the graveyard but died sooner (designer) | §7: each of the first eight gets a little farther, and together they leave an "accidental trail". | **4** |
| Corridor realism (designer: "a bit unrealistic how many wrecks passed") | §20: thousands of beacons heard, only one or two ships seen up close. | **5** |
| Characters explaining; the player should understand (brief §10, designer) | §18 teaches it in nine steps. §28 rules out explanation speeches and lets the player sometimes be ahead of the crew. §31 asks for a simple realisation. | **4** |

### Table 2: Partly covered (what is missing)

| Problem | What is missing |
|---|---|
| **Why WE send the warning** (the designer's top question) | §15 says only that ship 9 "may be revealed" as the sender, and §29 item K leaves the reason open. Missing: why we send it, how a message reaches 2029 (the twin link? the drive?), and the player's hand on it. The game already has a seed it ignores: "It has arrived before we ever sent it." «DistressSignals.js · DISTRESS_ALIEN» |
| **The broken message** (ask 3) | The idea is good: Earth reads the astronomy right and the intent wrong (§14). The wording is only a placeholder, and the rule for how it got broken is still open (§29 item H). It also rules out the designer's own line: "Avoid the cheap DO NOT SEND → SEND version." |
| **How the player learns the paradox** | The six-sector plan in §19 never mentions 2029, the message or the loop. As written, a player would never meet it. |
| **The sector plan** (ask 6) | It gives a question for each sector. It gives no object or event for sectors 1, 2, 4 and 6, and no list of pages to rewrite. The count, the twins and A.U.R.A. are not in it at all. |
| **The big reveal lands twice** (brief §9.5) | §19 sector 2 says "corridor may hear more beacons; hints of other hulls". That moves the break earlier, against the built sector 2 flight: "Eight beacons. That's every ship they told us about." «Corridor.js · LINES.2». No decision on the uncut tape or Vance's "hundreds". |
| **The disc minigame must reward the player** (designer) | The in-world reason is strong. The payoff the build already has is not locked: dating shows "WHERE EXODUS-[num] WAS GOING" and reveals the sector's story planet «DiscDating.js line 620». |
| **Same precalculated route of planets** (designer) | Only implied: Earth "correctly discovers where the message came from" (§14). Missing: who worked out the route, and why ships centuries apart stop at the same planets. |
| **Twins over-explained** (brief §9.7) | Demoted to "may give limited data" (§22, §29 item I). The spine does not say whether to cut the vault line from every ending, or what replaces the sector 2 twin memo. |
| **The light sees humanity arrive backwards** (§6) | The concept is locked, but nothing in the game carries it to the player. The dating chart already does the job: every dated wreck stays plotted, and the further down the heading, the older the wreck. The spine never names it. |
| **30–40 minutes, and "too many mysteries"** | The spine adds a 2029 layer and the loop on top of the count, the light, the disc and the twins. It says nothing about what to cut. |

### Table 3: Open (with priority)

| # | Still unanswered | Priority |
|---|---|---|
| 1 | **The ending as one question** (ask 7, brief §9.8). The spine never mentions it, and four of the six built endings need the disc that is now gone. | Critical |
| 2 | **What being read costs** (brief §9.6). §24: the consequence "remains adjustable". Without a cost, the warning has nothing to warn about. | Critical |
| 3 | **The count** (brief §9.1, ask 4). §25: "Leave unresolved for now." The player meets it about 5 minutes in. | High |
| 4 | **What the crew was lied to about, and why** (CANON §1 and §5). | High |
| 5 | **Why Earth keeps sending ships** (§22; the spine itself calls this its top open question). Shows up in sector 4's orders and sector 5's ledger. | High |
| 6 | **How the warning goes back in time, and why it breaks** (§29 items H and K). | Medium–high |
| 7 | **Leftovers of the rejected count answer** (brief §9.9): "It cannot find you" «StructureEncounter.js · approach», "Thousands of stones, and not one commander." «LateGamePOIs.js · THE_GRAVE» | Medium; waits on #3 |
| 8 | **Why the light does not come to Earth** (§23). | Medium if any ending is about hiding where Earth is; low otherwise |
| 9 | **What the jump dream between sectors 2 and 3 means now** «TheThrow.js · BEATS». | Low–medium |
| 10 | **Sleepers from far-future ships, alive in pods for centuries** (WAKE_SLEEPERS ending). | Low |

### What the spine quietly drops or brings back

1. **It drops the lie.** Under the spine, Earth knew nothing when ship 9 launched, so the briefing is simply true. These lines then become false and unexplained, or orphaned:
   - "Earth is sending ships in every direction. Eight went this way before us. We are the ninth." «bundle.js · showOpeningBriefing»
   - "Thousands of ships. Every one on its own heading." «StoryReel.js · program»
   - The uncut tape, "Look at your heading. It is not eight ships." «StoryReel.js · uncut». No film made before our launch can show hundreds of ships.
   - "Tell them what they already believe: eight ships went this way before them, and they are the ninth." «ExodusLogs.js · PAGE_MEMO». It is found in hull 2,210, whose crew can read their own hull number.
   - The ring of ships playing our briefing «AnomalyEncounters.js · ANOMALY_CHORUS».
   - It also loses the brief's colour rule: "only people and the lie are warm".
2. **It drops the disc at the light.** That orphans the finale and four endings:
   - "It is reading the map, Commander. Half of it is read." «bundle.js · showStructureModal»
   - "You cut through the map on it" «BREAK_MAP», "You go out and take the disc." «CARRY_ON»
   - "burns the drive, the disc and herself" «AURA_DECIDES», "you cut the map" «WAKE_SLEEPERS»
   - The torch minigame's disc mode «Torch.js line 112».
   - The sector 2 memo: "Something out there has the disc" «PAGE_VAULT».
   - The planned walk-out minigame loses its destination.
3. **It drops the ending choice and the crew.** No mention of the six endings, standing, or any crew member's want. The only crew line in the spine is Jaxon's.
4. **It parks the count again.** That is the brief's problem #1, now deferred for the second time.
5. **It softens "we send the warning"** to "may be revealed" (LIKELY, not locked). It also rules out the designer's "send zero Exodus" wording (§14, §28).
6. **It demotes the twins.** Sector 2's memo, the scene a first-time player found clearest, loses its truth. Mira's "Does ours?" «PAGE_VAULT» goes nowhere.
7. **The title fights the spine.** The title says "NONE OF THEM CALLED HOME." «bundle.js · start menu», but §22 suggests "each mission transmits a little before silence".
8. **The new Jaxon line collides with Vance.** Jaxon's "Ten gets the new drive. We missed it by one ship." (§2) clashes with "They said nine ships would fly this heading." «CrewEvents.js · VANCE_SCAR». In its favour, it sets up a natural wrong first guess: faster ships overtook us.
9. **A near-copy of the disc comes back.** "The ship holds an archival image/data of the Voyager cover" (§16) sits close to the rejected copies. It also breaks the sector 1 find:
   - "Why is this in a colony ship's orders?" «DiscDocument.js · NOTES.margin»
   - A.U.R.A. calling her own navigation reference "An old curiosity, Commander." «DiscDocument.js line 69»
10. **The old time rule is still written in the game.** "The drive sends every ship into the past, and each new ship goes further back." «ExodusDerelicts.js · EXODUS_LOG», and CANON §2, are now wrong for ships 1–9. The ledger's "Our ship is the last line" «PAGE_LEDGER» is wrong too: by launch order we are line 9 of about 41,000.
11. **Small slips:**
    - §4 puts hull 20,000 about 300 years back, while §6 says 350.
    - The disc's "One of them is waving" «DiscDocument.js · NOTES.figures» describes Pioneer's plaque, not Voyager's record, and the spine locks Voyager.
12. **Rejected items brought back outright:** none. No sealed list, robots, aliens, "you are home", READ meter or explaining character.

### The three decisions the designer must make next

1. At the light, now that the 1977 disc is not there, what does the player actually do, and what does being read cost? That act is the one question all the endings should answer.
2. Who is the fifth person, and why does A.U.R.A. count four?
3. What did Earth know when it launched us, and what did it tell us that is not true? The answer decides the opening, the sector 2 tape, the sector 4 orders, the ledger, and why Earth kept building ships.