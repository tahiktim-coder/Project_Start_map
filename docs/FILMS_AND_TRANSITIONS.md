# Films and transitions, from the title to the endings (2026-10-10)

Everything the player watches or passes through between playing: the title, the films, the jumps between sectors, the
arrivals, the light and the endings. For each one: what you see, what is said, how long it runs, and where it clashes with
the working story (STORY_SPINE_WORKING.md and its audit), with itself, and with the new look. Nothing was changed.

**How to read the "clash" column:** *story* = it contradicts the working story; *look* = it does not fit the new look;
*itself* = it contradicts another part of the game. Marks like §22 point to numbered parts of STORY_SPINE_WORKING.md
(or of the audit, where it says "audit"); you can skip them. Proposed fixes for the opening and the jumps are in
[OPENING_AND_JUMPS.md](OPENING_AND_JUMPS.md).

**The new look is not in the game yet.** The new screen (our ship's side view on the left, space on the right), the new
sky, our Lander, and the camera move into the bridge window exist only in the new-look sector 1 test, `prototypes/slice/`
(sector 1 up to arriving in sector 2). The game in `src/` still plays everything below in the old look. Where the new-look test
already does a moment differently, the notes say so.

## 1. In order, at a glance

| # | moment | where | length | what you see | clash |
|---|---|---|---|---|---|
| 1 | Title | bundle.js · showStartMenu | until a click | a gas giant, twinkling dots, the name in green glow | story, look |
| 2 | The briefing film | StoryReel · program | 15 s | Earth, green dashes in every direction, a dotted line with 8 ticks | **story**, look |
| 3 | Waking up, first talk | bundle.js · showOpeningBriefing | about 30 s | a card, no picture | **story** |
| 4 | The head count | bundle.js · showCountScene | about 20 s | a card, no picture | itself |
| 5 | Between worlds in a sector | WarpPlot | 5-10 s each | a gauge: stop a moving marker in a bright window | look |
| 6 | Jump 1 to 2, flown | Corridor + cards | 60-80 s | our ship from behind, debris, 2 wrecks, a beacon counter | itself, look |
| 7 | The uncut tape (sector 2) | StoryReel · uncut | 17 s | the briefing film again, the heading full of dashes | **story** |
| 8 | Jump 2 to 3: the plot | WarpPlot (3 burns) | 10-20 s | the gauge, then "The jump did not finish." | itself, look |
| 9 | Jump 2 to 3: the throw | TheThrow | 27 s + a card | the screen breaks, then thousands of still hulls in a cone | **story**, look |
| 10 | The corridor film (sector 3) | StoryReel · corridor | 21 s | lines bending into one corridor, a violet slab at the end | never plays |
| 11 | Jumps 3-4, 4-5, 5-6, flown | Corridor + cards | 60-80 s each | as 6; a ship like ours beside us (5); the light grows (6) | story, itself |
| 12 | Arriving at the light | bundle.js · handleWarp | log lines | the old orbit view | itself |
| 13 | The reading film | StoryReel · reading | 12.5 s | our ship small, a huge warm sun, a violet band sweeping | look, itself |
| 14 | The disc, inside the light | DiscDocument | until a click | the sector 1 disc page again | **story** |
| 15 | The end of the heading | StructureEncounter · approach | about 30 s | a card, then six choices | **story** |
| 16 | The six endings | StructureEncounter, EndScreens | a card each | text; the torch minigame for one | **story**, look |
| 17 | Colony endings, game over | EndingSystem, EndScreens | a card | text, no picture | none found |

All five films can be skipped (skip, Esc, Enter, Space). Their lines run on a timer; a click does not move them on yet.

## 2. Each one: pictures, words, clashes

**1. Title.** Words: "EXODUS PROGRAM // VESSEL 9", "SILENT EXODUS", "EIGHT WENT BEFORE YOU. NONE OF THEM CALLED HOME.",
CONTINUE, NEW GAME. *Story:* "None of them called home" picks an answer to the spine's top open question (§22: each mission
may send a little back). *Look:* green glow and flat dots; the new-look test has no title screen yet.

**2. The briefing film.** "EXODUS PROGRAMME · CREW BRIEFING FILM". Earth on the left; about 160 lanes of green dashes
stream out in every direction, a wedge to the right kept empty; then an amber dotted line runs straight right with eight
white ticks, and a blinking green mark behind them is us. Says: "The film they showed you before launch." / "Thousands of
ships. Every one on its own heading." / "On yours, eight went first. You are the ninth."
*Story:* when hull 9 leaves, only nine ships exist (spine §1, §3); "thousands" and "every heading" are false. The heading
points at nothing, yet the whole game flies toward the light. *Look:* a diagram, not a scene: green phosphor dashes and a
straight dotted line with ticks, both things you turned down for the game screen. Our ship is a green blip, not the Lander.

**3. Waking up.** Card "EXODUS-9 · 61 YEARS OUT FROM EARTH", "Good morning, Commander". "Cold air and bright lights. After
sixty-one years asleep, the ship has woken all five of you." A.U.R.A.: "Good morning, Commander. All four crew are awake and
well. The ship is in one piece." / "Your orders have not changed. Find a planet people can live on, and settle it." / "Earth
is sending ships in every direction. Eight went this way before us. We are the ninth." Jaxon: "Eight ships ahead of us. I hope
they left us a good planet." Vance: "Eight ships, and not one of them ever sent a message home?" A.U.R.A.: "Space is very
large, Vance. There is an old ship beacon on the scanner. Probably one of the eight. I have marked it on your map." One
button: "Take command". *Story:* "every direction" (same as film 2); "Space is very large" closes question §22 again; the
spine's planned Jaxon line ("Ten gets the new drive...", §2) is not here. *New look:* the new-look test opens from black on our
Lander burning toward the light, "The Graveyard" for 3 s, the ship opens and the crew climb out of their pods. A.U.R.A.:
"Good morning, Commander. All four crew are awake and well. The ship is in one piece." Aris: "Everyone is up. Sixty-one
years, and nobody even feels hungry." A.U.R.A.: "Worlds all around the giant, Commander. One of them has an old ship
beacon." So there are now two openings, and the new-look test has no film at all.

**4. The head count** (first return to the map). Vance: "There are five of us on this ship. She keeps saying four."
A.U.R.A.: "Four crew, Commander. All well." Vance: "Then list them." A.U.R.A.: "[the four names]. And you, Commander. Four
crew." Jaxon: "It is a glitch. She slept sixty years too. Let it go." Kept as the open hook. *Itself:* see F in part 3 below.

**5. Between worlds.** The old gauge (WarpPlot): "One burn. Lock it inside the bright window: clean gives fuel back, a miss
costs extra." The first one, A.U.R.A.: "I will fly the first one, Commander. Watch the marker and the bright window."; Jaxon:
"Next time, you try. Stop the marker inside the bright window." Grades: "PERFECT PLOT", "CLEAN PLOT", "ROUGH PLOT", "BAD
PLOT". You called it "meh", sound included. The new-look test replaces it: click a world, the Lander flies there (7-9 s), and the camera moves into the bridge window.

**6. Jump 1 to 2, flown.** If anything is left: card "SECTOR JUMP · Jump now?", A.U.R.A.: "[what is left] Jump anyway?".
Then the flight. A.U.R.A.: "Debris on the heading, Commander. I can fly us through, if you prefer." (Fly it myself / Let
A.U.R.A. fly; on screen "STEER CLEAR OF THE DEBRIS", "USE THE MOUSE OR THE ARROWS", later "HOLD TO GO FASTER"). The jump:
stars stretch for 1.4 s, one white flash from the light. Then about 50 s of flight (about 30 s with the throttle held):
debris in waves, two wrecks of hulls 1-8 grow out of the haze and pass close, "BEACONS HEARD" counts 0 to 8. Lines: A.U.R.A.
"I'll count every beacon we hear, Commander." / "Hull number [n], [on our left / on our right / below us]." Jaxon: "That's
one of the eight." A.U.R.A.: "Debris ahead, Commander." Aris: "Eight beacons. That's every ship they told us about."
A.U.R.A.'s report: "We're through, Commander. Four crew, no injuries." / "Eight beacons heard, as the briefing said." (only
if nobody said it) / "We passed hulls [a] and [b]." / "No scrapes on the hull." or "[n] scrapes on the hull. [Deck] is
damaged." Continue. Then in the log a crew line (for example Jaxon: "Jump complete. The reactor held up fine.") and A.U.R.A.:
"Jump complete, Commander. We are on course."; sometimes a ship-problem card; then one talk card (out of sector 1, for
example "THE BEACONS AHEAD": "More beacons ahead, Commander, all earlier Exodus ships. They line up along our heading." or
"POWER SURGE": "Mid-warp, a power line overloads."). Then the new map and "Sector 2 — THE DARK VOID" in the log. No picture
of arriving. *Itself:* "Jump complete" right after "We're through"; the talk card announces beacons the flight just counted,
and a mid-warp surge in a flight where nothing happened. *Look:* the flight is a framed box with a pixel-font readout; our
ship is a top-down inset, not the Lander from outside. *New look:* the new-look test does A.U.R.A. "That's the last world on this
heading, Commander. The jump is ready.", you click the light, burn 1.5 s, stretch, a white-gold flash, the same flight, then
the first meal (Aris: "Sit down, all of you. Our first real meal since we woke.", five bowls, 10 s), then sector 2 fades in
still moving, "The Dark Void" for 3 s, A.U.R.A.: "We are through the jump, Commander. The light ahead is closer now." Mira:
"Something ahead is blocking the stars. It's a planet with no sun." That is "We're through" twice inside about 20 s.

**7. The uncut tape** (a wreck's archive, sector 2; replayable from cargo: "You play the tape again."). "RECOVERED TAPE ·
EXODUS PROGRAMME MASTER · UNCUT", a rolling tracking band. Film 2 again with no empty wedge, so the heading fills with
dashes, and the lines lean toward it as it ends. Says: "A tape from a dead ship. Our programme's seal on it." / "The same
briefing film. Longer." / "Look at your heading. It is not eight ships." / "The tape ends there." Then the log: Vance: "That
is not eight ships. That is hundreds." A.U.R.A.: "Old recordings degrade, Vance. I would not read too much into it."
*Story:* no film made before our launch can show hundreds on our heading (audit, "it drops the lie"); and a ship of hulls 1-8
cannot carry a longer version of our film. It also lands the big reveal a sector early (brief §9.5).

**8. Jump 2 to 3, the plot.** The only jump not flown. The old gauge, three burns: "A long jump: three burns, each faster.
Lock every one inside the bright window — all three clean gives the most fuel back." A grade and a crew line (for example
"Three for three. I didn't feel a thing."), then a card "SECTOR 3 OF 6", title "—", "The jump did not finish."
*Itself:* a cheerful grade, then the jump fails. *Look:* the gauge is on the cut list in GAME_FLOW.md.

**9. The throw** (the strange sequence when the jump into sector 3 fails). Old ship panel: its decks go dark one by one (fabricator deck included), the music fades, the whole screen
swells and tilts and copies of one amber planet pile up over it; black. Then a picture labelled "NO SOURCE · NOBODY ABOARD
IS LOOKING AT THIS": a tiny ship, and the camera pulls back over 2,600 hulls hanging still in a cone that narrows to a gold
pinpoint (white near us, red, then rust far away). Says: "The jump did not finish." Jaxon: "The reactor has gone cold."
Vance: "Everyone, sound off." "Nobody answers." Mira: "A.U.R.A.? Are you there?" "Nobody answers." "Nobody answers. Nobody
answers." "Nobody answers. Nobody answers. Nobody answers." "Ships. Thousands of them, in one long line. None of them are
moving." "Every ship Earth ever built. All on the same heading." "Yours is the last one in the line." "At the far end, a light
the size of a pinhead." "The burn finishes." Card: "SECTOR 3 OF 6 · THE BURN FINISHED", "THE SIGNAL", "Hundreds of ship
beacons, all ours. Their numbers are higher than ours, and they are a hundred years old." Mira: "Commander, there are a lot
more than eight ships out here." (or A.U.R.A.: "Burn complete, Commander. There are many more ship beacons ahead than
expected."). Log: "SECTOR 3 — no name. no stars." / "The burn finishes. You were in the warp the whole time." Then one
entry line, for example Jaxon: "That jump stalled halfway. The reactor's back up. I don't want to do that again." or Aris:
"Everyone blacked out for a moment in there. I've checked each of you. You're all right." No talk card.
*Story:* "every ship Earth ever built" and "the last one in the line" belong to sectors 5-6 (spine §18-19); the card states
the age and the higher numbers before the player has dated anything, which is sector 3's own moment ("this wreck should not
exist yet", found by dating); the picture from nowhere is close to the explanation of the light's view the spine says never
to give in one go (§6, §28). *Itself:* the light "the size of a pinhead" is introduced here as new. *Look:* it works on the
old side panel and screen, which the new look removes; the ship is the old tiny sprite; the hulls are dashes. Your note: the
lines vanish too fast to read. Also lost here: the flight lines written for this jump never play (Mira: "That can't be right.
They told us eight." Vance: "Hull [n]. We're hull nine." A.U.R.A.: "More debris ahead, Commander." Jaxon: "That one's been
dead about a hundred years.").

**10. The corridor film, sector 3.** Built, never played. "BRIDGE DISPLAY · THE FILM, WITH EVERY TRANSPONDER WE CAN HEAR",
a counter "HULLS ON THIS HEADING" from 9 to 41,207. The dashes bend into one corridor, wrecks appear (older further out),
the camera pans to a violet-white slab with rings. Says: "Mira puts the briefing film back up." / "Then she lays the real
signals over it." / "They were not sent everywhere. They were all sent this way." / "All of them. Toward one thing." The slab
is the old idea of what is at the end; the light is now a false sun. 41,207 does not match the corridor's 39,806.

**11. Jumps 3-4, 4-5, 5-6, flown.** As 6, with more debris and more torn hulls; the light ahead grows each time.
Into 4 (687 to 5,614 beacons, hulls 1,400-6,000): Mira: "That one's been out here about two hundred years." A.U.R.A.: "Heavy
debris ahead, Commander." Aris: "I've been writing every ship down. I can't keep up." The report, first time only: "5,614
beacons heard. The briefing said eight." Into 5 (to 21,483, hulls 9,000-22,000), a ship exactly like ours flies beside us for
a while: A.U.R.A.: "That ship is exactly like ours, Commander." / "It turns when we turn, a quarter of a second late." /
"More debris ahead. Heavier than before." Vance: "[Fifteen] thousand beacons. So where are all the ships?" Into 6 (to
39,806, hulls 30,000-41,000), the light fills the view: A.U.R.A.: "The light ahead is getting bigger, Commander." / "Debris
ahead, Commander. The heaviest yet." Jaxon: "That light ahead. I'm reading no heat off it." A.U.R.A.: "Last of the debris
ahead, Commander." Report openings: "We made it through, Commander.", "Out of the debris, Commander.", "All clear,
Commander." Then the talk cards; into 6 one line, for example Jaxon: "Last sector. There's a light ahead, bright as a star."
*Story:* every wreck, even hull 39,000, is drawn as our own class; the spine wants later ships more advanced the older they
are (§21). The twin is one of the "copies of us" the spine has no place for (audit §2). *New look:* the light has been on
screen since minute one, so "There's a light ahead" lands as news it is not.

**12. Arriving at the light.** A.U.R.A.: "We do not need the drive, Commander. The light is pulling us in." Log: "Approach
complete. The light fills every window. It is not warm." Leaving: "The drive fires, Commander. We do not move." / "I have
checked it three times. There is only one way from here, and it is in." Then GO INTO THE LIGHT: "Going into the light."

**13. The reading film.** "HULL CAMERA · FORWARD". Our ship small and side-on, its engine flickering; a sun swells from the
right edge in rings of white, gold, orange and rust; later a violet band sweeps across the picture. Says: "It fills every
window." / "It looks like a sun, but it gives off no heat." / "Something moves through the ship, room by room." / "It reads
the ship's computer first." *Look:* our ship is the old flat sprite, not the Lander. *Itself:* see C in part 3 below.

**14. The disc, inside the light.** The sector 1 disc page with "INSIDE THE LIGHT · THE DISC, BEING READ", "The disc",
A.U.R.A.: "It is reading the map, Commander. Half of it is read.", "GO ON", "there is nothing else in here". *Story:* the one
disc is not at the light (spine §11, locked). Waits on decision 1.

**15. The end of the heading.** "It fills every window. It looks like a sun, but it gives off no heat. Something is moving
through the ship, room by room." A.U.R.A.: "Five crew, Commander. All accounted for." Vance: "Five. She has never said five
before." Mira: "It is in my head. It is reading everything I know." Aris: "It is reading all of us. Not you, Commander. It
cannot find you." Jaxon: "Then whatever we do here, you are the one who has to do it." *Story:* "It cannot find you" is left
from the rejected count answer (audit item 6).

**16. The six endings.** THE MAP IS GONE (cut the disc, with the torch), READ (Aris walks into it), THE SHIP THAT NEVER
ARRIVES (take the disc and keep flying), HER ORDERS (A.U.R.A. burns "the drive, the disc and herself"), THE VOTE (the
sleepers; "You go out with the cutting torch, and you cut the map."), SOMEWHERE TO STOP (settle in sight of the light). Each
ends "In the vault on Earth: ..." Full text: docs/script/07-finale.md. Then the card: the code name as the kicker (for
example "BREAK_MAP"), "THE JOURNEY ENDS", the crew, pages found, "BEGIN AGAIN a new crew, the same road".
*Story:* four endings need the disc at the light; four say it "can't see you"; the vault lines lean on the twins, now
demoted. *Look:* text only, no picture; GAME_FLOW wants the finale in the bridge window (paused with the story). A code name
on screen is design shorthand a player should never see.

**17. Colony endings and game overs.** The crew's say, then "If we land for good, the journey ends here, Commander. Settle
anyway?", then text cards. Not films; nothing here clashes with the jumps.

## 3. Clashes that run through the whole game

- **A. Our ship looks different everywhere.** A green blip (film 2), a tiny flat sprite (throw, reading), a top-down capsule
  (the flight), the Lander from outside (the new look). The wrecks in the flights are all our own class, at any hull number.
- **B. The light arrives three times.** The new look shows it from the first frame and the jump is "click the light". The
  old films introduce it late: a pinhead in the throw, a violet slab in the unplayed film, "There's a light ahead" in
  sector 6. The briefing film's heading leads to nothing.
- **C. Lines said twice** (STYLE.md rule 2): "It fills every window" three times (film 13, card 15, the arrival log); "no
  heat" four times (Jaxon in the last flight, film 13, card 15, "It is not warm"); "We're through" then "Jump complete",
  and in the new-look test "We're through" then "We are through the jump".
- **D. The ladder of reveals is out of order.** Sector 2 says "hundreds", sector 3 says "every ship Earth ever built" and
  "the last one in the line", the sector 3 card gives the age before dating, and the gentle sector 3 flight never plays.
- **E. The old look:** green phosphor, dotted straight lines, cards with "SECTOR 3 OF 6", the gauge, the old side panel
  going dark, a code name on the ending card. Each is something you turned down or the new look removes.
- **F. The count leaks.** The flight report counts the crew without you: "Four crew, no injuries.", then "Three crew, one
  injured." after a death. That quietly answers the count as "you are not on the list", the rejected answer. And "Five crew,
  Commander." at the light is said even when people have died.
- **G. The jump itself never shows time.** Every jump is the same white flash. The spine's core (§1) is that each jump
  moves a ship forward in space and back in time; only the throw hints at it.

## 4. What has to be decided before reworking them

Each film waits on one of the five story questions in [STORY_QUESTIONS.md](STORY_QUESTIONS.md). Options only; nothing is
decided. The opening and jump options are drawn out, with pictures, in [OPENING_AND_JUMPS.md](OPENING_AND_JUMPS.md).

| film | waits on | plain options |
|---|---|---|
| Briefing film (2) and waking (3) | question 2 (what Earth knew and told us) and question 5 (the 2029 message) | no film: open on our Lander from black as the new-look test does, and A.U.R.A. says "Eight ships went this way before us" (opening A); or, after the crew wake, A.U.R.A. plays a film made before launch on the bridge window: the launch yard, eight empty pads, hull ten being built (opening B) |
| Uncut tape (7) | question 2 | cut it; or turn it into the sector 2 page that shows pieces of the 2029 message |
| The throw (8, 9) | none for the picture; the words wait on the story | the jump into sector 3 stops halfway inside the flight: our Lander, engine off, among hundreds of still ships (jumps A); and, if wanted, our ship goes dark and A.U.R.A. does not answer for ten seconds (from jumps B) |
| Every jump (6, 11) | none | keep one white flash; or, after each jump, A.U.R.A. finds the ship's clock a little further behind the stars (an optional idea) |
| Reading, disc, endings (13-16) | question 1 (what happens at the light) and question 3 (why A.U.R.A. says four crew) | wait; the disc card and four endings cannot stay as they are |
