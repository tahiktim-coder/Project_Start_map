# Story idea bank (2026-10-10)

Every story idea we have had since September, in one place, with an honest verdict. Sources: the story docs in `docs/`, the
script in `docs/script/`, the pages in `src/data/ExodusLogs.js`, and the designer's recorded reactions. Nothing in the game
was changed.

**How to read an entry:** name, what it is, *from* (where and when it came up), *you said* (the designer's words, when
recorded), *built* (yes / partly / no / cut), and the **verdict**: promising, weak, or contradicts (with what it breaks).
"The spine" means `STORY_SPINE_WORKING.md`; "the audit" means `STORY_SPINE_AUDIT.md`; "Q1"–"Q5" are `STORY_QUESTIONS.md`.

---

## 1. What the light is

- **The Pursuer.** A hunter nobody understands empties the corridor; you hide from it by sound (RUN SILENT). *From:* `00_MASTER_DESIGN.md`, early September. *You said:* "do we need pursuer?" (answer: no, 2026-09-20). *Built:* cut. **Contradicts** the spine's "no monster hunting ships" and the patient light.
- **GENESIS, the alien invitation, the door that needs eight black boxes.** An alien signal built the programme; the last ship "knocks on the door". *From:* `01_OVERVIEW.md` and the old `ExodusLogs.js`. *Built:* cut 2026-09-24. **Contradicts** the canon; it was one of the four rival plots.
- **Our descendants seeded the corridor from the future.** *From:* `LateGamePOIs.js`, `04_CONTENT.md`. *Built:* cut. **Contradicts** the canon, and is a second time loop on top of the 2029 message.
- **The purple slab.** A black structure with one lit edge. *You said:* you hated it and preferred the old sunny art. *Built:* cut. **Contradicts** the look.
- **The false sun that reads ("the Reader").** It looks like the home star you were sent to find, gives no heat, reads whatever reaches it, and can make again what it has fully read: ghost planets, the Wrong Place, the rootless garden, the archive, the door. *From:* `STORY_DIRECTION.md` 09-20, CANON §3. *You said:* "I love strange mystery things." *Built:* yes. **Promising.** The best image in the game. What it lacks is a want and a cost.
- **It reads machines at once and people slowly.** *From:* CANON §5. *Built:* partly ("It reads the ship's computer first."). **Promising.** It gives the reading an order: computer first, then the crew. It is also the base of your new A.U.R.A. idea (section 5).
- **It has seen humanity arrive backwards.** Big hull numbers first, then smaller, then 1 to 8, then us, then nobody. *From:* spine §6. *Built:* only through the dating chart. **Promising** as something the player works out, never as a speech.
- **The deceiver: it only wants to know where Earth is.** *From:* you, 2026-10-10. *You said:* "the light is the deceiver, meaning he just wants to know where earth is." *Built:* no. **Promising.** It is the first time the light has a want, and it explains why being read matters: it is looking for home in what it reads. One hole to close: every ship's computer takes star fixes, and a star fix is an address (audit, hole 7), so it would have found Earth centuries ago. That needs one rule: no ship was ever given Earth's position (section 2).
- **Keep it unknown: a structure that wants knowledge.** *You said:* "maybe keep it unknown kind of? it is the structure that wants knowledge." **Promising as a limit.** Say its want once, plainly, and never explain what it is. That already matches the canon rule "no ending explains the light".
- **It did something so no ship ever reached it.** *You said:* this, then "or no, don't overcomplicate." *Built:* no. **Contradicts** spine §10 (fates differ; some reached it) and the sector 6 page from a captain a day short of it.

## 2. Why Earth sent the ships this way, and what Earth hid

- **The retrieval lie.** Earth learns something alien lies in the disc's direction and secretly sends ships to catch the disc; the official story is "find a new world". *From:* you, 2026-09-19. *Built:* replaced. **Contradicts** physics (Voyager is still near the Sun) and spine §28 (no retrieving Voyager). Its core, a cover story over a real reason, lives on in Q2-B.
- **Destroy the map before it is read.** Earth's real aim is to reach the disc inside the light and cut its map. *From:* CANON §4. *Built:* yes, the whole finale. **Contradicts** the one-disc rule: the disc cannot be at the light.
- **The twins: Earth hears through A.U.R.A.'s twin in a vault.** Earth watched 41,000 twins go wrong and kept building (Q2-C is the darkest form). *From:* your quantum-link idea, 09-20; CANON §5. *Built:* the sector 2 memo and a vault line on every ending. **Weak.** It is a second time machine, Earth could just ask, and the playtest read it as over-explained.
- **"Earth is sending ships in every direction. You are the ninth on this heading."** *From:* your correction, 09-20 ("the crew came from Earth and knows ships went before"). *Built:* yes. **Weak now.** Under the time rule only nine ships existed when we left, so "every direction" is a lie with no reason behind it. Keep "Eight went before us. We are the ninth.", which is now simply true.
- **"We told the first crews the truth. They stopped flying."** Orders for commanders only. *From:* `STORY_DIRECTION.md`; page PAGE_MEMO. *Built:* yes (sector 4). **Contradicts** the time rule: Earth knew nothing when hull 9 left, and the page sits in hull 2,210.
- **Q2-A: Earth knew nothing.** The briefing was honest; we find out together. *Built:* no. **Weak.** Clean, but there is nothing for Vance to dig at.
- **Q2-B: Earth had one secret, the broken message, and told a calmer story.** *You said:* "should tie in to the main quest?" *Built:* no. **Promising**, with one change to tie it in: the secret should be the part of the message Earth obeyed without understanding. For example: no ship carries Earth's position, and no ship may call home. That is why "none of them called home", and it is exactly what a light looking for Earth could not find.
- **Earth's "strange willingness" is the light's doing.** *From:* you, 2026-10-10. **Promising** if the light's pull is its look (a warm home star at the end of the heading), not a message it wrote (see section 3).
- **A precalculated route of planets.** Every ship follows the same planned stops, which is why we keep finding them. *From:* you, 2026-10-03. *Built:* partly (the lighthouse's route, "a single flight plan"). **Promising.** The route can come from the star fixes in the 2029 message.
- **The normalised frontier.** Earth has fed ships into the corridor for decades; stations line it. *From:* `00_MASTER_DESIGN.md`. *Built:* cut, though stations remain. **Contradicts** "eight went before us".

## 3. The 2029 message, and who sent it

- **"Send zero Exodus here", misread as "send Exodus here".** A broken warning from the future starts the programme it warns against. *From:* you, 2026-10-02. *You said (10-10):* "or bs... i don't know anymore which ideas were good." *Built:* no. **Promising core.** The plain "do not send" read as "send" is the cheap version (spine §14); the strong version is that Earth reads *where* right and *why* wrong.
- **We are the ones who send it.** *From:* Claude, 10-02. *You said:* "if it works with the narrative then yes." **Promising**, but only if sending it costs something. A loop that just closes is a fact, not a choice.
- **It is written in the disc's star-map language.** That is how Earth knows it is real, and why every Exodus navigates by pulsars. *From:* spine §13 and §17. **Promising.** One idea links the disc, the message, the dating minigame and the reveal.
- **It travels down the twin link.** *From:* Claude, 10-02. **Weak.** A second time machine (audit, hole 3).
- **It travels at the speed of light, so "now" is about 1830 for our crew.** Every earlier ship's call also reached Earth, but before radio existed; ours is the only one anyone hears. *From:* audit, Fix A. **Promising, but heavy.** It answers "why us" without a chosen one. It costs the ledger years, and Jaxon's daughter is not born yet (a strong late line if used).
- **Only what A.U.R.A. repeated got through.** Her star fix, the sky date and "41,000 hulls" survive; the crew's words are lost. Earth reads a count of the dead as a target. *From:* audit, Fix B. **Promising.** One rule explains the damage, and whatever the player says is exactly what gets lost.
- **A second message from the future, sent to fetch the disc.** *From:* you, 2026-10-10 ("or bs"). **Contradicts** spine §28 (no retrieving Voyager), and doubles the device.
- **The light wrote it, as bait.** *From:* implied by your deceiver idea. **Contradicts** the deceiver's own want: to aim a message at Earth, it must already know where Earth is.
- **Q5-B: keep the message, never say who sent it.** *Built:* no. **Promising** fallback; it can grow into "we sent it" later.
- **Q5-C: no message.** **Weak.** It loses your favourite idea and the reason the star map matters.
- **Seeds already in the game.** The beacon you can make say "Turn back. Exodus 9."; our own distress call that "arrived before we ever sent it"; A.U.R.A.'s "I'm to ask once... and record the answer" and Vance's "Record it where?". *Built:* yes, in random pools. **Promising** as plants, once the answer is chosen.

## 4. The disc

- **The disc is inside the light.** *From:* CANON §4. *Built:* the finale card and four endings. **Contradicts** physics and the one-disc rule.
- **Every ship carries a gold copy.** *From:* Claude, 10-03. *You said:* "no, this is bad." *Built:* no. Rejected.
- **The disc is your first ship's orders.** *From:* count option One More. **Weak**; it only works with One More.
- **The disc is a clock (Date it with the disc).** Lay a wreck's last star reading over the map: how far the pulsars slowed says *when*, how far the angles moved says *where*. *You said:* "beautiful"; it must make the player feel they did something. *Built:* yes. **Promising.** Still needs a consequence in the story.
- **The star map is the only address aboard.** The drawing in the first wreck is the one thing on the ship that says where Earth is ("Anyone who can count can find us."). *From:* the built disc page; renamed "the star map" on 10-07. *You said (09-25):* the disc "doesn't register". **Promising**, and the strongest way to make the disc matter if the light wants Earth: the object you use all game is the one thing it is looking for.
- **The disc as the antenna that sends the message home.** *From:* Claude, 10-02. **Contradicts** the disc not being there.
- **The torch cuts the map at the end.** *Built:* yes (one ending and the torch's disc mode). **Weak** without a disc at the light. Keep the torch for hatches.
- **"Our own sky is older than the disc."** One late line from Mira. *From:* audit, hole 8. **Promising** as a single beat.

## 5. The four-crew count, and A.U.R.A.

- **Most of the crew are robots who think they are human.** *From:* you, 09-23 (version A), parked. **Contradicts** "machines are read at once", and is the most-used twist in the genre.
- **The sealed crew list (the count is paperwork).** *From:* 09-23/24, built then. *You said:* "garbage... bs suspense without substance." **Rejected.** Its leftovers are still in the game: the blank fifth panel, the empty commander column, "not one commander", "It cannot find you".
- **One More: you are the first wreck's commander.** *From:* count options, 09-25 (critic: 7/10). No reaction recorded. **Weak.** Players guess it in sector 1, and the rule it needs ("she can't wake a crew without a commander") is invented at the reveal.
- **The Walk: she counts the ship after the commander walks out.** (critic: 6/10). **Weak alone**; it is folded into The Script.
- **The Blind Spot: she hid you from the light and forgot doing it.** (critic: 4/10). **Weak.** It is GERTY from *Moon*, one of the game's own references.
- **The Script (Q3-C): every ship lost one person at the light.** Thousands of ship computers ended on "Four crew, Commander. All accounted for.", and ours is drifting into agreement with them. *From:* 09-25 and Q3. **Promising.** The count becomes the question the ending asks.
- **Your new idea: A.U.R.A. changed after the jump, and every computer near the light starts acting strangely.** *You said:* "maybe the AI got corrupted after the jump and is semi-responsible for the light's will?" **Promising.** It is The Script in simpler words. It only **contradicts** the rule "never glitchy, never sinister" if it is shown as glitches. Keep her calm and exact; let only things the light already knows come through her: the count, flying the beacon line, "The light is pulling us in."
- **The count is the future ("EXODUS-9 · FOUR CREW" in the message header; Q3-B).** *From:* Claude, 10-02. **Weak.** It needs the whole time loop on screen and makes her a prophet.
- **Roll call / jump seats.** *You said:* jump seats were "boring af"; roll call was liked but needs a purpose. **Weak** as a minigame; keep "four" said plainly at each jump.
- **Dead channels: a 400-year-dead computer says our words in her voice.** *You said:* "some potential as part of story". **Promising** as the sector 3 or 4 clue for the count.
- **A.U.R.A.'s secret orders (burn the ship; "I'm required to ask this once").** *Built:* yes. **Weak.** Nothing in the spine gives her hidden orders, and it pushes her toward sinister. Keep only the question and "Record it where?".

## 6. The wrecks and the hull numbers

- **Higher hull number, older wreck.** *From:* 09-20. *Built:* yes. **Promising.** The backbone of the game.
- **Hulls 1–9 have the old drive; from hull 10 the new drive throws ships far back.** *From:* spine §1 (locked), CANON's open issue. *Built:* partly. **Promising.** It removes the contradiction in CANON §2.
- **Jaxon: "Ten gets the new drive. We missed it by one ship."** *From:* spine §2. *Built:* no. **Promising** plant. It clashes with Vance's "nine ships" line; change his to "They said ten would be the last. I counted thirty-one keels."
- **The first eight left a trail, each a little further.** *From:* spine §7; you, 10-03 ("earlier crews saw it too"). *Built:* partly. **Promising.**
- **"They had better machines. We have history."** Why the weakest ship is the one that understands. *From:* spine §26. **Promising.** It answers "why us" with no chosen one.
- **Every ship met a different end; the more advanced the ship, the older its corpse.** *From:* spine §10 and §21. *Built:* no (every hull is drawn as our class; the archive says every entry ends "stopped"). **Promising.**
- **The first wrong wreck is EXODUS-31, the number Vance saw painted.** *From:* audit, hole 12. *Built:* no. **Promising**, cheap, and personal.
- **Thousands of beacons heard, one or two ships seen.** *You said:* "a bit unrealistic how many wrecks passed." *Built:* yes. **Promising.**
- **The ledger is built from the wrecks the player dated.** *From:* fix plan item 4; audit, hole 5. *Built:* partly. **Promising.** The player's own evidence proves we arrive last.
- **Sleepers from later ships, alive in pods.** *Built:* yes. **Weak** as written: the ending says they "have seen more of this than you", which turns spine §26 upside down.
- **Ten ships, black boxes as a key.** *Built:* cut. **Contradicts** the canon.

## 7. The twin ship

- **OUR OWN SHIP: a copy of us, four people waving in its windows.** *Built:* yes (random, sector 3 on). **Contradicts** arrival order: nothing can copy us before the light has read us (audit, part 2).
- **The ship beside us in sector 5 that turns a quarter of a second late.** *Built:* yes (the sector 5 flight). *Settled:* it stays in sector 5. **Promising** with one rule from section 5: the light reads computers from far off. The copy is being made from what A.U.R.A. sends out, live, which is why it lags, and why it has four people in its windows: she counts four.
- **The twin is a copy of an earlier ship the light read (Q1-A).** **Weak.** No ship like ours arrived before us.
- **Future ships that look exactly like ours.** *Built:* yes, in several lines. **Contradicts** spine §21.

## 8. Lost time

- **The wait calculation: a later, better ship overtakes an earlier one.** *From:* you, 09-19. It became the new drive. **Promising** as the theme ("start now or wait for better tools"), with the twist that better ships were thrown further back.
- **Crews are told they can call Earth, but they can't.** *From:* you, 09-19. **Promising.** It sits under "none of them called home".
- **After each jump the ship's clock is a little further behind the stars.** *From:* `OPENING_AND_JUMPS.md`; a wreck's engineering report already says it. **Promising.** It shows time passing with no speech.
- **The faster the jump, the earlier it lands you.** "Faster and safer" becomes bitter. *From:* audit, hole 14. **Promising** as the one drive rule.
- **Jaxon's daughter.** He left her at eight; "forty-three now" does not fit 61 years asleep. **Promising** once the sum is fixed; under Fix A she is not born yet.
- **The Overtaken ending: a newer ship passes you.** *From:* the first one-pager. **Contradicts** "nothing arrives after us".
- **Nobody goes home.** *From:* you spotted that "take the disc home" broke the logic, 09-20. *Built:* yes. **Promising.** Keep it as a hard rule.

## 9. The ending

- **Six endings gated by standing** (destroy the map, let Aris go, keep flying, let A.U.R.A. decide, wake the sleepers, settle). *Built:* yes. **Weak now.** Four need the disc, and they are six paragraphs, not six answers to one question.
- **Q1-A: someone goes out on a tether, and you choose who (the walk out).** *You said:* the walk out is a keep, but "needs a lot of rework". **Promising** as an act. Its old destination (the disc) is gone; it needs a new reason to go out.
- **Q1-B: one last call home, while the light reads the crew and they lose memories.** Mira forgets her mother's name; Jaxon, his daughter's face. **Promising.** The clearest answer yet to "what does being read cost".
- **Q1-C: erase A.U.R.A., because every chart she made points home.** **Promising** if the light wants Earth: the cost falls on the one crew member everyone suspected.
- **One question, every ending closed by A.U.R.A.'s last count; "Five crew" only if the pattern breaks.** *From:* The Script. **Promising.**
- **A vault coda on every ending.** *Built:* yes. **Weak.** Over-explained. Cut.
- **The seven deadly sins, one dominant sin per run.** *You said:* you want it "semi-somewhat interesting". *Built:* no. **Weak** for 30–40 minutes; standing already does this job with no new system.
- **Each crew member's want is an ending.** *Built:* yes. **Promising.** Keep.
- **Every irreversible choice gets a crew moment first.** *Settled* 10-10. Keep.
- **"Transmit home: you become the black box the next crew finds."** *From:* `00_MASTER_DESIGN.md`. **Contradicts** "no ship comes after us".
- **Settle within sight of the light (Jaxon).** *Built:* yes. **Promising.** The one ending that is simply stopping.

## 10. How the story is told

- **"But" and "therefore", never "and then".** *From:* you, 10-10 (Trey Parker and Matt Stone). **Promising.** Each sector should end on a "but" that forces the next sector's "therefore" (example below).
- **One clue per sector, never a speech (Q4-A).** **Promising.**
- **State the lie plainly, let objects contradict it.** *Built:* the house rule. Keep.
- **The opening as a grand launch: crowds, the crew on a podium, a news report from the pad.** *From:* you, 10-10. **Promising.** It shows the cover story at full volume, so the later quiet hurts. The reporter can plant the new drive ("the tenth ship gets the new drive") and the one public fact about the message.
- **The jump into sector 3: dark, broken ships around us, then zoom out to a sea of thousands.** *You said:* "i love the idea that it goes dark... zoom out and out... a sea of those exodus ships." **Promising.** Sector 3 should show "far more than eight", not "every ship ever built" or "you are last".
- **The uncut briefing tape showing hundreds of ships.** *You said:* keep it, "it shows reality". **Contradicts** the time rule: no film made before our launch can show later ships.

---

## The 8 most promising

1. **The time rule:** old drive 1–9, new drive from 10, higher number means older wreck. It already works in play and fixes CANON's contradiction.
2. **"They had better machines. We have history."** The only answer to "why us" that needs no chosen one.
3. **The light wants to know where Earth is.** Your deceiver idea gives the light a want and the reading a cost, while its nature stays unknown.
4. **Earth's one secret is the broken message, and the part it obeyed:** no ship carries Earth's position, and none may call home. It ties Earth to the main quest and explains the title line.
5. **The star map is the one address aboard, and our dating tool.** The disc finally matters: the thing you use all game is the thing the light wants.
6. **A.U.R.A. drifting near the light (your idea, The Script's core).** The count is the first sign; the sector 5 twin with four people in its windows is the proof.
7. **The 2029 message in the disc's language, damaged by one rule** (only what repeated got through). Earth reads where right and why wrong; who sent it can stay open or be us.
8. **The ending as one question with a real cost** (what you give the light: A.U.R.A., your memories, the call home), closed on A.U.R.A.'s last count.

## The 5 to drop

1. **The disc at the light, and anything that fetches, cuts or carries it** (including the second message to retrieve it). Voyager cannot be there, and four endings rest on it.
2. **The twins in the vault as Earth's window, and the vault coda on every ending.** A second time machine that over-explains.
3. **The light stopping ships, the Pursuer, any single killer.** The graveyard should be many different failures.
4. **The seven sins as a tracked system.** Too much for 30–40 minutes; standing already sorts the endings.
5. **Leftovers of the sealed list** (blank fifth panel, empty commander column, "not one commander", "It cannot find you"). They answer the count with the answer you rejected.

## One way the top eight lock together (a proposal, not a decision)

*The truth:* a broken message in the disc's star-map language reached Earth in 2029. Earth followed its route, kept its
secret, and obeyed one fragment: no ship carries Earth's position and none calls home. At the end of the route is a light
dressed as a home star. It reads every ship that reaches it, looking for the one thing none of them carried: where we live.

| sector | but | therefore |
|---|---|---|
| 1 | Eight went before us, **but** the first wreck holds the star map, and A.U.R.A. says four crew. | We start dating wrecks with it. |
| 2 | The eighth wreck should be the last, **but** its orders say never call home, and nobody aboard knows why. | Vance wants Earth's orders. |
| 3 | The jump goes dark and wakes in a sea of ships, **but** the one we date is numbered above us and a century dead. | Later ships got here first. |
| 4 | Those ships had better drives, **but** their charts have no way home either. | Earth was afraid of being found. |
| 5 | A ship like ours flies beside us, **but** it has four people in its windows. | The light is already reading A.U.R.A. |
| 6 | We reach the light, **but** A.U.R.A. now knows where home is: we dated every wreck with the map. | We choose what to give it. |

*Risks:* the sector 6 turn must be offered as a choice, not as a punishment for playing the dating game. Whether our final
call home is the 2029 message stays your call (Q5); this shape works either way.

## Borrowed from writers, for the clues

- **Trey Parker and Matt Stone:** every beat is joined by "but" or "therefore" (your note). The table above is built on it.
- **Billy Wilder:** give the audience two and two and let them add it up. Hull 31 plus Vance's painted 31 is a sum; nobody says the answer.
- **Chekhov's gun:** what sector 1 puts in your hand, sector 6 must use. Today that is the star map, so it has to matter at the light.
- **Alfred Hitchcock's bomb under the table:** once players guess "one of us will be missing", stop hiding it and let them worry.
- **The fair-play rule of detective fiction:** every clue the answer needs is shown before the answer, in an object, never only in a speech.

## Still open after this

1. Who sent the 2029 message: us (with a cost), or nobody says.
2. What exactly the light takes when it reads a person (memories of home is the strongest candidate).
3. Why every ship lost one person at the light, if the count follows The Script.
