# The opening and the jumps between sectors: four storyboards (2026-10-10)

You said the opening and the jumps between sectors need reworking to fit the story. Below are two ways to do the opening
(from the title screen to your first click in sector 1) and two ways to do the jumps (from clicking the light to arriving
in the next sector, including the jump into sector 3 that stops halfway and the ship like ours in sector 5). Nothing in the
game or the prototypes was changed. The pictures are mockups: each one is the new-look sector 1 you can already play
(`prototypes/slice/`), paused at a moment, with the new parts painted on top using its own drawing code.

**The story they assume** is my suggested answers in [STORY_QUESTIONS.md](STORY_QUESTIONS.md). None of them is decided:
- at the light, someone goes out on a tether, and you choose who (question 1);
- Earth kept one secret, a broken message it received in 2029, and told crews a calmer story (question 2);
- every ship lost its commander at the light, and every ship's computer ended its log on "Four crew" (question 3);
- each sector adds one clue to that (question 4);
- the 2029 message stays in the game, and nobody says who sent it (question 5).

**Which answers matter here.** The opening depends on questions 2 and 5 (what Earth knew and told us). The jumps barely
depend on the story: only the ship like ours (question 1) and A.U.R.A.'s crew count (question 3). Each storyboard ends
with what would change if you answer differently.

**What all four fix** from [FILMS_AND_TRANSITIONS.md](FILMS_AND_TRANSITIONS.md):
- the film with green dashes going out from Earth, saying "thousands of ships, every heading", is gone;
- the light is never announced as news, because it is on screen from the first frame;
- our ship is always the Lander;
- no line is said twice;
- the strange sequence into sector 3 (the screen breaking, the picture "nobody aboard is looking at") no longer gives away sectors 5 and 6;
- the jump into sector 3 no longer uses the old timing gauge (stop the marker in the bright window).

Pictures (1920x1080, plus one sheet of three frames per option) are in the session scratchpad `opening/` folder:
`opening-A.png`, `opening-B.png`, `jump-A.png`, `jump-B.png`, and the single frames `opening-A-1.png` to `jump-B-3.png`.

---

## Opening A · Wake up on the way (no film) · about 35 seconds

The new-look sector 1 already opens this way; this finishes it. No film at all: A.U.R.A. says the one thing the film was for.

| # | on screen | said (one line at a time) | length |
|---|---|---|---|
| 1 | **Title.** Sector 1's sky: the ringed giant, the light far right, our Lander small and burning toward it. "SILENT EXODUS", "Eight went before you.", New game · Continue. | nothing | until you click |
| 2 | The words fade. The same picture; "The Graveyard" shows for 3 seconds. | nothing | 3 s |
| 3 | The side view of our ship opens on the left of the screen. Five people get up and go to their posts. | A.U.R.A.: "Good morning, Commander. All four crew are awake and well." | 8 s |
| 4 | Jaxon at the galley. | Jaxon: "Hull ten gets a faster, safer drive. We were one ship too early for it." | 5 s |
| 5 | Far ahead, among the worlds, a few small red beacon lights blink. Nothing else is drawn: no lines, no labels. | A.U.R.A.: "Eight ships went this way before us, Commander. We are the ninth." | 6 s |
| 6 | The worlds come up. | A.U.R.A.: "Worlds all around the giant, Commander. One of them has an old ship beacon." | until you click |

Frames: 1 the title, 2 the crew waking (as the new-look sector 1 already does it), 3 the eight ships. About 55 words in
the whole opening.

**If you answer differently:**
- Earth knew nothing (question 2, answer A), or there is no 2029 message (question 5, answer C): no change.
- Earth watched ships die and kept building (question 2, answer C): add back Vance's old question, "And not one of them called home?", with a calm wrong answer from A.U.R.A.
- We sent the message ourselves, said out loud (question 5, answer A): this opening shows nothing of the message, so the player cannot recognise it at the end. Use opening B, or a page in sector 1.
- You came from the first wreck (question 3, answer A): your sleep pod looks different (older, frosted).

## Opening B · The film on the bridge window · about 60 seconds

The briefing film stays, but as something inside the ship: after waking, A.U.R.A. plays it on the bridge window while the
crew watch. Everything in it is something Earth could have filmed before we left.

| # | on screen | said | length |
|---|---|---|---|
| 1 | **Title**, as in A. | nothing | until you click |
| 2 | From black, inside the ship. The sleep pods open; five people climb out. | A.U.R.A.: "Good morning, Commander. All four crew are awake and well." | 7 s |
| 3 | They climb to the bridge. The big window shows the light ahead. The lamps dim. | nothing | 4 s |
| 4 | **The film on the glass:** the launch yard at dusk. Eight empty launch pads, scorched. Our ship stands on the ninth. A tenth, longer ship is still inside its scaffolding. On the blast wall, the programme's emblem: the star map from the gold disc. | Film: "Eight ships have gone ahead. You are the ninth." | 8 s |
| 5 | **The film's last shot:** night over the yard, and one warm star low on the horizon. | Film: "At the end of your heading is a star with worlds of its own." | 7 s |
| 6 | The film fades. The real light is exactly where the film's star was. | Jaxon: "That was hull ten, still being built. It gets a faster, safer drive. We just missed it." | 6 s |
| 7 | The camera pulls back out of the bridge to the big view of space (the reverse of the move that takes you into the bridge). "The Graveyard" shows for 3 seconds. | A.U.R.A.: "Worlds all around the giant, Commander. One of them has an old ship beacon." | until you click |

Frames: 1 the yard at dusk, 2 the night shot with the star, 3 the real light and Jaxon. About 60 words.

**What the film quietly shows, without anyone pointing at it:**
- hull ten in its scaffolding, so Jaxon's line is about something the player saw, and hull numbers higher than ours mean something when they turn up later;
- the star-map emblem on the wall, which is the piece of the 2029 message that question 5 (answers A and B) needs shown early;
- the eight empty pads: the eight ships the player will find.

**If you answer differently:**
- Earth knew nothing (question 2, answer A): the emblem is just decoration.
- Earth watched ships die (question 2, answer C): the film adds one lie Vance can catch later: "All eight have reported in."
- We sent the message ourselves, said out loud (question 5, answer A): this opening suits it best. The night shot adds the 2029 message as Earth received it (a burst of noise on a dish screen), so the player can recognise it at the light.
- No 2029 message (question 5, answer C): drop the emblem; the warm star is the whole reason we were sent.
- You came from the first wreck (question 3, answer A): the film shows the crew at launch with only four people. A strong first clue.

---

## Jumps A · Seen from outside, as now · 60 to 90 seconds each

The flown jump through the debris (the corridor) stays exactly as it is built: the flight you love, in its own frame.
Only the moments before and after it change.

| # | on screen | said | length |
|---|---|---|---|
| 1 | After the last world, the light glows when you point at it. | A.U.R.A.: "That's the last world on this heading, Commander. The jump is ready." | until you click |
| 2 | **Click the light.** In the ship, people drop into their seats and the reactor pulses hard. Outside, the engine burns at full, every star stretches toward the light, then the screen goes white. | nothing | 2.5 s |
| 3 | **The flown jump**, as built. Its lines are tidied (see below). It ends with one line from A.U.R.A.: "We're through, Commander. No scrapes." No score panel, and no second "Jump complete". | the flight's own lines | 50 to 80 s |
| 4 | Out of the white: the Lander from outside, coasting into the new sector. The light is a little bigger. The sector's name shows for 3 seconds. | A.U.R.A. (optional idea, see below): "I've checked our clock against the stars, Commander. Ours is four days behind." | 5 s |
| 5 | The meal at the galley, only on the first jump or when food is short. | Aris: "Sit down, all of you." | 10 s |
| 6 | The big view of space again. The first world comes up. | one line about what we see | |

**Into sector 3, the jump stops halfway.** This replaces the timing gauge, the strange sequence and its card. The flight
plays with the quieter sector 3 lines, which are written but never play today. Halfway through, the stars stop moving and
the flight's frame gives way to a view from outside: our Lander, engine off, one bridge light on, hanging among hundreds
of still ships that thin out toward the light. Most are ships like ours. One long, rusted ship of a newer kind drifts
close by, and more of that kind lie further toward the light. About 12 seconds. Jaxon: "The reactor's gone cold." Mira:
"Those are ships. All of them are ships." The engine coughs back to life, white; A.U.R.A.: "Burn complete, Commander."
Nobody says how many ships, how old they are, or that we are the last.

**Into sector 5, the ship like ours** stays in the flight. A.U.R.A.: "That ship is exactly like ours, Commander." / "It
turns when we turn, a quarter of a second late." Its windows are dark. If the answer to question 1 is A (the light reads
people and makes copies), this is the first copy of us, the first sign the reading has started. Nobody says so.

**Into sector 6:** the light has been on screen all game, so nobody says "There's a light ahead". Jaxon's "I'm reading no
heat off it" is said here and nowhere else.

**A.U.R.A.'s crew count after each jump.** Today, after a death, she says "Three crew, one injured": she counts the crew
without you, which quietly gives away the answer you already rejected ("you are not on the list"). If the answer to
question 3 is C, she always says "Four crew", whoever has died.

**The clock idea (new, not decided).** After each jump, the ship's clock and the stars disagree a little more: four days,
then weeks, then "The stars and our clock don't agree any more, Commander." It shows the heart of the story (each jump
sends the ship back in time) without anyone saying why. Leave it out if it gives away too much.

Frames: 1 click the light and the stars stretch (as already built), 2 the stopped jump from outside, 3 arriving, with the
clock line.

**If you answer differently:** questions 2 and 5 change nothing here. If the light makes no copies (question 1, answer B
or C), the ship like ours means nothing: cut it, or keep it as one strange moment nobody explains. Question 3 changes
only A.U.R.A.'s crew count.

## Jumps B · Fly it from inside · 70 to 100 seconds each

The flight happens on the big view of space, with our ship's side view beside it. You arrive at the bridge window.

| # | on screen | said | length |
|---|---|---|---|
| 1 | Same "jump is ready" line; click the light. | as in A | |
| 2 | Everyone goes to a seat in the ship; the reactor pulses hard. Outside: the stars stretch, white. | nothing | 3 s |
| 3 | **The flight on the big view of space.** Our ship's side view stays on the left. On the right, our Lander from outside, among debris and passing wrecks. Steering and the hold-to-go-faster work as built. A.U.R.A. says the beacon count out loud; it is never printed. When we scrape debris, a deck in the ship flickers red. | the flight's lines | 50 to 80 s |
| 4 | **Arriving at the window:** the white clears in the bridge window, on the new sector's first sight. The crew stand at the glass. | one person's first look, e.g. Mira: "Something ahead is blocking the stars. It's a planet with no sun." | 6 s |
| 5 | The camera pulls back out of the bridge to the big view of space. | nothing | 2 s |
| 6 | The meal when food is short, as in A. | | |

**Into sector 3, the jump stops halfway.** The stars stop. Our ship goes dark deck by deck, one red lamp left on each, and
the reactor stops pulsing; outside, still ships all around us. Vance: "Everyone, sound off." Each person answers. Mira:
"A.U.R.A.? Are you there?" Ten seconds of silence; she has always answered before. The reactor pulses back: "I'm here,
Commander. The burn is finishing."

**Into sector 5, the ship like ours** flies beside us on the big view. In our ship, Vance goes to his porthole. Same lines
as A.

**Into sector 6:** you arrive at the window and the light fills it. Jaxon: "I'm reading no heat off it." Said once.

Frames: 1 the flight on the big view with the ship like ours, 2 our ship gone dark when the jump stops, 3 arriving at the
window.

**If you answer differently:** the same as A.

---

## My recommendation

**Opening B, and Jumps A, with B's dark ship added to the jump that stops halfway.**

Opening B takes 25 seconds more than A. In return the film becomes something in the world, not a diagram; Jaxon's line
about hull ten is about something the player saw; and it is the only place to show a piece of the 2029 message before the
end, which question 5 needs if you keep the message.

For the jumps, A keeps the flight you love exactly as it is and fixes every clash for a fraction of the work. The dark
ship (from B) is the strongest single moment in all four storyboards, and it is cheap because the ship is already drawn:
it only needs dimming and red lamps. Flying the jump on the big view (B) is the bigger prize, because it would give the
flight the size and better pictures you asked for. It is also a rebuild of a minigame you love, so try it only after the
new look is in the game, and only as a playable test first.

## What it costs (my estimates)

| | in the new-look test (`prototypes/slice/`) | then in the game (`src/`) |
|---|---|---|
| Opening A | ~4 h: title screen, two lines, the beacon lights | ~5 h: delete the briefing film and the wake-up card; the rest comes when the new look moves into the game |
| Opening B | ~12 h: title, two film pictures, the bridge with dimmed lamps, the camera pulling back, lines | ~8 h, after the new look moves into the game |
| Jumps A | ~13 h: seats on click, the jump that stops halfway (flight stops, still ships, cold Lander), the clock line, line fixes | ~9 h: replace the gauge and the strange sequence; remove the unused sector 3 film; fix lines |
| B's dark ship (added to A) | ~4 h | ~3 h |
| Jumps B | ~34 h: a new flight picture for the big view, the ship reacting to scrapes, arriving at the window | ~15 h |

Recommended set: about 29 hours in the test, then about 20 in the game.

## To decide (plain questions)

1. The story questions first: questions 2 and 5 in STORY_QUESTIONS.md change the opening; questions 1 and 3 change two small parts of the jumps. The storyboards work with my suggested answers; the notes above say what moves if you pick others.
2. Opening: no film (A), or the film on the bridge window (B)?
3. Jumps: keep the flight in its own frame (A), or fly it on the big view beside our ship (B)?
4. After each jump, should A.U.R.A. find the ship's clock a little further behind the stars? Yes, or does it give away too much?
5. The title line: "Eight went before you." instead of today's "Eight went before you. None of them called home." The second sentence answers a question the story has not decided (whether any ship ever sends news home).
6. The tape found in sector 2 (a longer version of the briefing film, showing hundreds of ships) cannot exist with either opening, because no film made before our launch could show them. Cut it, or turn it into the sector 2 page that shows pieces of the 2029 message?
