# Story brief: eight suggestions (2026-10-14)

Read against docs/STORY_ONE_PAGE.md and the running code. Options, not decisions; nothing here is in the game yet.

**1. The count contradicts the brief's own premise. Settle it before writing sector 6.**
- The brief says the light "barely notices us" (line 8) and only "finally sees us" once we want the disc (line 23). But A.U.R.A. says "five crew" when we arrive at the light (line 21), before any choice. If "five" means "it sees us now", that line belongs after the choice.
- Option A, the count is who the light can see. The commander, who never says what she wants, is the one missing. The twin's empty seat is her chair. A.U.R.A.'s last count then becomes the ending's verdict: cut the disc and it stays "Four crew"; take it home and it becomes "Five crew". This uses only what is in the brief, plus your note that the computers drift near the light (`STORY_CRAFT.md:151`). Risk: it leans on the silent player, which `STORY_DISC.md:60` called weak.
- Option B, your copy idea (Mira). "Four" was right all along. "Five" at the light is the light's count overwriting hers, sure of itself and wrong. This fits the spore minute ("Mira comes back a little changed"). Risk: it is close to *Solaris*, and "notices" has to mean "wants".
- Either way, cut the random "our own ship" strange site. It has no sector limit and can show four people waving in sector 1, with Vance asking "Which one of us did they leave out?" (`AnomalyEncounters.js:254-260`). That uses up both the twin and the count early.

**2. "The light barely notices us" is the premise, and no scene shows it. That could be the spore minute's job.**
- Option a: the spore sees the wrecks as the light does, each one lit by what its crew wanted (a photo, the disc drawing). Our ship is almost dark, and the commander's seat is darkest.
- Option b: the drift passes the dark moon with the station, so sector 5 is set up early.
- Option c: if it becomes a film, it is one shot inside the sector 3 pull-back over the wrecks.
- The cause needs to be fixed, not random. Today the pollen is a dice roll: 30% in the Eden dome (`LateGamePOIs.js:134`) and 20% on the garden cutting (`AnomalyEncounters.js:422`). The garden itself is a random strange site, so Mira has to always be the one who touches it.

**3. The station and Eden are out of order (lines 18-19 list the sector 5 station before sector 4 Eden).**
- Option a: Eden, then the station, then the twin. The disc comes aboard late, so the twin appearing next follows from taking it.
- Option b: the station first, so the disc is in the hold at Eden. Staying would then keep the disc out here. It is a sharper temptation, and Jaxon staying gets a second meaning.
- What did SENT send? Options: (i) nothing, the station was wrong; (ii) a call home. Thrown into the past along with the station, that call becomes the 2029 warning. This uses the time rule already in the brief (line 28) and gives the player a place to "find it" (line 27). (iii) Keep 2029 fully hidden and drop "the player may find it".

**4. Two early clues break the time rule.**
- Ring of ships (line 14): sector 2 wrecks are hulls 1-8 (`bundle.js:1007`). They launched before us, so they cannot carry our launch broadcast. The same flaw killed the uncut tape (`FILMS_AND_TRANSITIONS.md:103`).
  - Option a: each ship plays its own launch broadcast. Same reporter, same words, other faces. This reuses the launch film's lines (`LaunchArt.js` LINES) and shows "every crew was told the same story" exactly.
  - Option b: move the ring deeper. That spends the time reveal early.
  - Option c: make it the light's copy. Then it has read us by sector 2, against line 8.
- First wreck (line 13): the launch flag already shows the disc's star map (`LaunchArt.js:138`), and the margin note asks "Why is this in a colony ship's orders?" (`DiscDocument.js:18`). Players will then ask whether our own orders have it too. Decide the answer: yes, a wordless page in the commander's orders; no; or nobody asks.

**5. "Cutting the disc turns Eden dark" (line 22) currently arrives as a new rule at the end.**
- Option a: show it once earlier. The garden piece we cut away goes grey and still, unlike real grass: a copy dies when cut off from what it reaches for.
- Option b: Eden goes dark only if Jaxon stayed, so the cost lands on a person you chose.
- Option c: drop the link. The cut then costs only Earth's hello, and the Eden choice loses its later cost.

**6. Give each crew member one fixed landing inside the existing moments.** Today their scenes are random (`CrewEvents.js:17`, a 75% roll per warp, sectors 1-4 only). In the brief only Jaxon and Mira get a beat.
- Jaxon: the garden is his ("It looks like the one I left", `AnomalyEncounters.js:412`), and Eden pays that off.
- Vance: the sea of wrecks proves his shipyard story (`CrewEvents.js:259`), and someone tells him he was right. At the station, he is the one who opens the rack under SENT.
- Aris: at the ring she reads the names of crews told the same story. The station's dead go on her last page. At the choice she speaks for their wish.
- Mira: the spore. At the twin she sees which seat is empty. At the end, for the first time, she decides without asking A.U.R.A.
- At the choice: a crew moment with "Not yet" first. Backing someone should change who speaks, not which ending is allowed. Today's finale locks endings by standing (`StructureEncounter.js:33`), which breaks the never-lock-out rule.

**7. The myth lens: keep it for writers only, and give it one job.** Every dead ship we can read gave in to a pull we are also offered:
- hull 6 went to help a lamp (`StoryPlanets.js:19`);
- hull 2,210 landed and stayed (`StoryPlanets.js:34`);
- the ring answered a broadcast;
- Eden's crew stayed.

That answers "why us" with the player's own refusals, not luck (`STORY_CRAFT.md:170`), and giving in costs something without ending the game. Drop the September seven-sins idea so there is only one lens.

**8. The running game still tells the old story.** Once the brief settles, decide each sector's page. Option: three pages (the drawing in sector 1, the station log in sector 5, "It must go home" in sector 6), or rewrite all six. Pieces that contradict the brief:
- the vault memo, "Something out there has the disc" (`ExodusLogs.js:27-31`);
- the commanders' orders (`ExodusLogs.js:53-56`), the empty commander column (`:68`) and the blank fifth panel (`:16-19`);
- "It has not read me" (`ExodusLogs.js:80`);
- the disc inside the light, and "It cannot find you" (`StructureEncounter.js:23,39`);
- "not one commander" (`LateGamePOIs.js:191`) and "Four names on every stone" (`BarkSystem.js:240`);
- Vance's jump line "Five crew, all accounted for" (`BarkSystem.js:191`), which uses up A.U.R.A.'s final line;
- "every direction" in the wake-up (`bundle.js:1020`);
- the garden as a random strange site with no sector limit (`AnomalyEncounters.js:407`), so it may never show up in sector 2.
