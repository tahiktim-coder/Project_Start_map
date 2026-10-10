# The game, start to end (2026-10-09, revision 2)

Your words: "rethink the whole UI flow to be sure that all the changes we are adding also make sense from a game sense."
This page puts every piece in one order: v3's travelling view and sky, the living ship beside the journey (layout A), the
stop as a bridge close-up (layout D), the ship's two verbs (docs/SHIP_GAMEPLAY.md revision 2, the source for everything
on the ship side), the words (docs/TEXT_SYSTEM.md, docs/STYLE.md) and the economy (docs/ECONOMY.md). Nothing here adds
story; the paradox decisions stay paused. **Revision 2** answers a second review; what changed is in section 7.

---

## 1. In ten lines

1. The checker's full list is in docs/GAME_AUDIT.md (38 findings, screenshots in `docs/audit/2026-10-09/`).
2. Worst three, fixed first in today's game: the TEST cheat button, choices appearing under NEXT, a jump with no question.
3. The root cause: today the game happens in boxes on top of space. The new flow happens in space and in the ship.
4. The line from the nose is gone, and so is the searchlight's dust run, which was the same line in another form.
5. Space gets its size back: faint galaxies and nebula far behind, one enormous thing per sector in front.
6. The ship and crew stay on screen beside the journey; our Lander keeps flying outside, small, on the space side.
7. Forward-only stays, made fair: you see the whole line-up, the story world can't be missed, the lane waits for you.
8. The stop limit goes. Energy is the only limit, and the reactor shows the price before you commit.
9. Every sector has one fork (this world or that one), starting in sector 1.
10. Yes, one by one: one thing at a time on screen, one sector at a time to build, and you play each before the next.

---

## 2. The flow, as the player lives it

Each screen lists **purpose / you decide / you can click / replaces.**

### 2.0 Rules on every screen
- **Nothing under the cursor.** Any choice or confirmation (a scene choice, the early jump, erasing a save, settling)
  appears away from where the player just clicked, and ignores clicks for 400 ms after it appears.
- **Words:** at most 40 on screen, one voice line at a time, beside whoever speaks, on v3's dither shade over the sky
  (never a boxed strip). At least 14px for anything the player must read, 12px for chrome, 4.5:1 contrast. IBM Plex
  Sans and Mono; the pixel font only for words in the world (the torch, the corridor, dating). First names only.
- **Results in words.** The speaker says what happened ("Clean cut. Nobody hurt."). One instrument readout per
  minigame at most. No stress chips on quiet moments. Risk in words ("someone could get hurt"), never "40%".
- **Nothing lies.** A control changes only when its state is true. Hidden is better than disabled; if disabled, say why.
- **No straight guide lines,** no meters, no numbers on the lane. Real numbers live in the record (L).

### 2.1 Title
- **Click:** CONTINUE, NEW GAME. With a save, NEW GAME asks lower down, "Erase the saved run?" (Erase / Keep), never
  a second click on the same spot. The sound label reads the real mute state.

### 2.2 The opening film (StoryReel 'program')
- **Purpose:** the briefing: eight ships ahead, we are the ninth. **Click:** next caption; Esc skips.
- **Fix first** (STORY_SPINE_AUDIT §1 item 3): "Thousands of ships. Every one on its own heading" goes.

### 2.3 Waking up, then travelling (layout A, the main screen)
- **Waking:** from black, the Lander burning toward the light, seen from outside. "The Graveyard" holds 3 seconds. The
  camera eases left and the tower opens beside it: the crew climb out of their pods and go to their posts. Three
  voice lines. **Replaces:** the "Good morning" card and its one fake choice, the coach bar, the log's first lines.
- **Left, about 40%: the living ship.** The tower frames the bridge, the lab and the galley, at whole-pixel scale. You
  can scroll it; it never moves by itself. The crew live their routines; signs show on these three decks or reach
  them (the ladder well lights, a sound, "Has anyone seen Vance?"). E opens the full six-deck ship at any time.
- **Right: the journey,** v3's travelling view **with our Lander in it,** small, nose on the light, plume burning,
  ports lit by the same simulation as the tower. It is how you see your own ship (audit 1.12), it turns its nose
  when you point, and it carries the transition you love.
- **The sky (`?sky=c`):** the faint band of the galaxy and thin nebula far behind, lit only near the light. In front,
  **one enormous thing per sector**, on its one slow pass (sector 1: the ringed giant). Sky C's vast faint shape is
  used only where the sector's enormous thing is far away (sector 2: the spiral behind the rogue world), so there
  is never a second one. All far shapes sit inside the space side, never under the tower.
- **The worlds ahead** are tinted glints fanned out from the light, in the order they will come. Each grows into a
  disc, then a full world as it reaches the lane. Passed worlds go grey near the left edge of space and fade.
- **At 1280x720:** space keeps at least 55% of the width. The tower scales by height so its three decks stay whole.
- **Decide:** stop at a world or let it go; go to someone whose routine changed; deal with a red deck.
- **Click:** a world in reach; a person (one line, or a talk if they show a sign); a red deck; Mira's bench; the
  reactor (a remark from whoever is nearest, never a number); the light (the jump). L: the record. Esc: the menu.
- **At rest:** no words, except one world's name and tag while it is in reach.
- **Replaces:** the header, both side panels, the log footer, the sector map, the planet card, both scans, the probe,
  the stop dots, the jump button, the roster, the deck card, the cargo panel, the fabricator, the TEST and ART buttons.

### 2.4 A world in reach
- **On screen:** the world beside the lane with its name and tag ("Titan-61 IV · Old transponder"). The ship slows to
  half speed: 10 to 15 calm seconds. No searchlight dust, no line: the world's rim brightens, and that's all.
- **Point at it:** the rim brightens a step, our nose turns a few degrees, and **the reactor shows the price**: a charge
  gathers at the core and climbs the well to the bridge, and the core dims by the share it would lose. A note shows
  one plain line. A.U.R.A. speaks once, only when the price matters, in decision terms: "This leaves enough for the
  story and one more place." Look away and it all settles back.
- **Can't afford it:** no charge gathers, the rim stays dull, and A.U.R.A. says once: "We can't afford that one,
  Commander." That replaces "no stops left" and the dark searchlight.
- **The first time a world passes** in a sector, A.U.R.A. says so while it is in sight: "We passed Platform Zeta,
  Commander. We can't turn back."
- **Replaces:** the stat card, the scan buttons, "OUT OF REACH, NO STOPS LEFT" in a tooltip.

### 2.5 Pulling in
- **Click:** the course locks, someone reacts, the charge fires and the core drops (the real cost). For 1 second,
  Esc or a click on empty space cancels; a second click on the world does nothing.
- **Then the transition you love:** the camera pushes on the hull, the quarter turn, the plating dissolves, and we are
  on the bridge with the big window: layout D. The world grows to fill the glass as we brake. Leaving plays it back.
- **Replaces:** WarpPlot (cut, your "meh"), the cut to the orbit screen, malfunction cards with "DEAL WITH IT".

### 2.6 The stop: the bridge close-up (layout D)
- **On screen:** the world in the window, lit from the front, its name in a corner. One action word in the window's
  sky beside the site, no thread. "Leave orbit" under the window, always.
- **The one action:** wreck, strange site, story world: **Send the team** · station: **Dock**, then boarding (the docking
  game, one readout at most, our Lander's art) · gas giant: **Skim fuel** (+15, no team) · asteroid field: **Mine it** ·
  a world that could hold people: **Settle here** as a second word, and A.U.R.A. asks first, because it ends the run ·
  an empty world: A.U.R.A. says what it is ("Only ice"), and you leave.
- **Replaces:** the orbit screen, CONDITIONS, the COMMAND DECK column, deep scan and its tuning game, DATE THE WRECK.

### 2.7 Who goes down, and who holds the ship (SHIP_GAMEPLAY §4)
- **Before you pick, the ship shows what may go wrong aboard:** one sign on the bridge ("The hull's been groaning
  since the last scrape", the console sparks, a pod blinks).
- **The pick:** everyone who can go stands at the window. Click two. The hurt, the shut-in and anyone mid-repair don't
  come up. Cora stays. Each person is good down there and good aboard, so no pair is always right.
- **While they're down:** about half the time the crisis aboard happens, and the two who stayed decide it: one line,
  two choices, or Breach.js itself. The shuttle drops to the site; you watch, you don't fly it.
- **At the site, at most one minigame:** the torch if the hatch is sealed. Then the scene in voice lines; the speakers
  are the two who went. At our own wrecks, whoever went asks on the radio: strip it or make a marker.
- **Then:** the film if the place has one; the found page as the object itself.
- **Replaces:** the away-team picker, the random team and victim, the landing game on routine stops (kept only where
  the ground is the story), the six-popup chain, the stacked event cards.

### 2.8 Leaving, and Mira's bench
- **On screen:** the transition backwards; the world slides behind us and goes grey, its tag now says what we did
  ("We searched the wreck", "Tanks filled here"). In the tower the team comes up the well; a plate goes up over the
  galley table if we made a marker. A wreck's star fix comes up on Mira's bench: at once if Mira went down, a stop
  later if not.
- **Dating:** click the bench or Mira; DiscDating plays as it is; it is free, and the lane waits (section 3, rule 5).
  It reveals what the contact ahead is, puts its line in the record, and gives the free course to it.
- **Replaces:** the dating offer card, reading pages through the log (pages are pinned above the bench).

### 2.9 Between stops: signs, talks, damage (SHIP_GAMEPLAY §5, §6)
- **Signs, not popups.** A routine changes on a deck you can see: Mira's bench lamp on while the others sleep, Vance's
  bridge seat empty. You go to them. Nothing opens by itself.
- **A talk with a choice** is a standing moment (backing someone counts toward their ending) or an ask (someone wants
  something with a cost either way; if you don't go before the next stop, they do it their way). No "Listen" button.
- **A red deck** (after the breach, a scrape, a surge): click it for three choices: Fix (20 salvage, done during the
  next trip by whoever stays), Patch (free, breaks worse later), Live with it (that deck's cost every leg).
- **Only three things are announced,** one A.U.R.A. line each: a breakdown, a crisis aboard, a world you can't afford.
- **A distress call** is a world on the lane with a red beacon; you pull in or pass it like any other.
- **Replaces:** the modal queue of distress and crew-moment cards, REST, DeckPanel and its repair quote.

### 2.10 The jump
- **On screen:** after the last world, A.U.R.A.: "That's the last world on this heading, Commander. The jump is
  ready." The light has doubled over the sector and now answers the pointer ("Click the light", said once). If
  nothing ahead is affordable, she offers it early and the lane speeds up.
- **Clicked early,** she asks below the light, never under the cursor: "There are still worlds ahead, Commander. Jump
  anyway?" with Jump now / Not yet. Not yet is nearer the cursor.
- **Then:** the ring spins up, the streaks stretch toward the light, white, and **the corridor** (as built). The
  between-sector film plays inside it where one exists.
- **The meal:** shown on the first jump so the table exists, then only when food is short: "We have three rations,
  Commander. Not everyone eats tonight." You click the bowls you take away. Bowls are never counted aloud.
- **Then:** the next sector fades in, already moving, the Lander outside for 3 seconds, then layout A again.
- **Replaces:** JUMP SECTOR, the jump card with counters, the arrival card, the campfire cards, the random hunger death.

### 2.11 The record (L) and the menu (Esc)
- **The record:** what happened, in order, with the real numbers. Near-black ink on a calm page, at least 14px; a new
  sector starts mid-page. **Esc:** Resume · Record · Sound · Save · Quit, and where it last saved (saving is silent).
- **Replaces:** the mission log footer, its filters, EXPAND, the item toasts, the "SAVED" toast.

### 2.12 Sector 6 and the end
- **The same flow,** two or three worlds, the light filling the right side; nothing in the ship stops early (§7 there).
- **Before the light:** one slow walk down the ship, no choices. Then the pull-in goes to the light, the finale plays
  in the bridge window, and who stands at the window comes from who is alive and backed.
- **Endings:** as built (six by standing, the colonies, stranded, everyone lost). What happens at the light is paused.

---

## 3. Forward-only: keep it, and make it fair

**Keep it.** The ship flies forward and you never go back: "We can't turn back" is the whole game in one rule, and a
lane that keeps moving is the stars flying by that you like. It makes yes and no both cost something.

**The fair alternative, so you can judge:** a moving lane where two or three worlds are in reach at once and you pick
any or none. It is closer to "click where you want to go", but worlds would crowd the screen, each would get less
time, and "passed is gone" would feel softer. Forks (rule 4) give most of its choice without losing the lane.

**Your worry is right:** if the best thing comes last and you spent everything, it is a trap. Five rules prevent it:

1. **You see the whole line-up from the start.** Every world left is a glint fanned out from the light, in order,
   tinted by kind: amber for dry worlds, ice blue for ice, steel for a station, red for a distress call. The story
   contact has its own look: a slow white pulse no world has. Pointing at a far glint names what is known.
   Nothing counts them.
2. **A.U.R.A. reads the route once per sector,** without numbers: "A beacon early on, Commander, and a contact with no
   fix near the end." Then she reads a world as it comes in, only when there is something to say.
3. **The story world can never be missed.** It is always the last or second-to-last world, so "the most interesting
   thing is last" is by design and safe. It can always be reached, even on the reserve. **Dating pays:** a dated
   contact is named, its line goes in the record, and the course to it is free. Undated, it costs about 6 energy,
   and A.U.R.A. can only say "A contact with no fix, Commander. I can't tell what it is." If you let it reach your
   tail, she asks once: "That's where their course ends. Pass it?" (undated: "We don't know what that is. Pass it?").
4. **One fork per sector, from sector 1.** Two worlds come into reach together, one on each side of the lane. Take
   one, or neither. Sector 1: the giant (fuel) or Chronos (ice we can melt: rations; an ECONOMY tweak).
5. **The lane waits for you.** Dating, a talk with a choice, a found page, a repair choice, a crisis aboard, the record
   and the Esc menu hold the lane: stars drift at the slow "looking inside" speed and no world crosses into or out
   of reach until you're done. A one-line remark does not hold it.

**What limits stops: energy, and nothing else.** The per-sector stop cap goes (you said it "feels like a bug", and
ECONOMY §2.2 calls three limits for one question a fault). You see energy in the reactor and hear it from A.U.R.A.
In sector 1 the felt reasons to pass a world you want are the fork and the sign of trouble aboard; energy starts to
bind in sector 2. The headless runs check that a player who stops everywhere arrives at sector 3 short.
**The floor:** story worlds are always reachable and the reserve jump always stays, so an empty tank never deletes a
sector's story (ECONOMY §2, item 1).

### Sector 1, minute by minute (a careful player; to be checked with a stopwatch)

| time | the journey (right) | the ship (left), or the bridge at a stop |
|---|---|---|
| 0:00 | From black: the Lander, "The Graveyard", the tower opens. Glints out of the light; the contact pulses. | Crew climb out of the pods. A.U.R.A.: "Good morning, Commander." |
| 0:20 | A.U.R.A. reads the route: a beacon early on, a contact near the end. | Aris: "Everyone is up." |
| 0:35 | Platform Zeta in reach. One-time hint: "Click a world to stop there. Once we pass it, it's gone." Let it go. | A small charge in the well, then it settles. "We passed Platform Zeta. We can't turn back." |
| 1:05 | Titan-61 IV, "Old transponder". Point: the charge climbs the well. Click. | Push, turn, dissolve into D. A.U.R.A.: "Engineering's been surging." Jaxon stays; Vance and Mira go. |
| 1:20 | The shuttle drops. | The torch on the sealed hatch. Aboard, the surge: Jaxon handles it. |
| 2:10 | The stockpile scene; the star map page. | Mira on the radio: strip or marker? A marker. |
| 2:40 | Leave (the transition backwards). The lane holds while we date. | A plate goes up. Mira brought the fix: date it at her bench (about 90 s). |
| 4:15 | The contact becomes Rhea-4 Minor, "their last course", free. | The page is pinned above the bench. |
| 4:30 | The fork: the giant under the lane, Chronos on the other side. Take the giant. | The breach on the pull-in: the lab loses its air, Mira is hurt. Then the skim: the core floods. |
| 5:10 | Leave. Chronos passes. | The lab is red. No wreck ahead to date: live with it. |
| 5:25 | Zephyr-97 X, a dead rock. Let it go. | Vance's bridge seat is empty: "Has anyone seen Vance?" Go to him: a standing moment (lane holds). |
| 6:00 | Rhea-4 Minor, free. Click. | D: Mira in the med bay. A pod blinks. Vance and Aris go. The sector's first page. |
| 7:00 | The last world passed. "The jump is ready." Click the light. | The ring spins up. |
| 7:10 | The corridor. | |
| 8:00 | Sector 2 fades in, still moving. | The first meal, at the galley table. |

About 8 minutes, the opening and the teaching included. Target: sector 1 at most 8 minutes, later sectors about 5,
the run about 35. If the stopwatch says more, cut a world, not a scene.

---

## 4. Something to do every minute, without clutter

The lane brings a decision about every 16 seconds. The ship fills the gaps. The rule: **things happen as pictures;
you notice them and act; only three things are announced.**

| every... | you do | it costs or gives | on screen |
|---|---|---|---|
| 16 s | stop or pass a world | energy, a world lost forever | the rim, the charge in the well, the grey world behind |
| a sector | the fork: this world or that | what the other one had | two worlds in reach at once |
| stop with a site | pick two to go; two hold the ship | who is missing down there, and aboard | the line-up at the window, the sign aboard |
| about half the trips | the crisis aboard | a red deck, someone hurt | one line, two choices |
| our wreck | strip it or make a marker | salvage, or Aris's peace | plates over the galley table |
| wreck searched | date it at Mira's bench | the contact named, a free course | the lit bench, a page on the wall |
| leg | answer a sign: a standing moment or an ask | standing; their way if you don't | someone doing something different |
| a few times a run | a red deck: fix, patch, or live with it | salvage, a place on the next team, or a cost each leg | sparks, frost, a lamp out |
| jump | the corridor; the meal when food is short | scrapes; whose bowl | the corridor; the galley table |

Not added, on purpose: meters, mood icons, "Listen", station assignments, power routing, cooking, searching the ship,
a repair minigame, the tower moving by itself (SHIP_GAMEPLAY §12).

---

## 5. The build order: one by one

One sector at a time, and you play each checkpoint before the next. The public build stays on today's game, with
Step 0, until the new flow reaches an ending; the new flow ends at sector 2's arrival until sector 2 is rebuilt.

**Step 0, in today's game (about 5 hours).** Hide TEST (`?test=1` only); every choice and confirmation away from the
cursor with the 400 ms pause; JUMP SECTOR asks while worlds or a story wreck remain; erasing a save on its own line;
first names in every string; the sound label reads the mute state.

**Step 1, prototype first (about 31 hours), for your verdict.** SHIP_GAMEPLAY steps 1 to 4: the reactor shows the
price, who goes and who stays with two crises, signs and one ask, fix/patch/live (25 h). Layout A with the outside
Lander and sky C at 1920x1080 and 1280x720 (6 h). Then time sector 1 in it with a stopwatch, minigames included.
If the two verbs aren't fun here, nothing after them is worth building.

**Step 2, sector 1 in the real game (about 210 hours), in four checkpoints:**

| checkpoint | what you can play | hours |
|---|---|---|
| A. Fly it | shared picture recipes (4); the Lander everywhere: hull, wrecks, sites, corridor (16); the travelling view (18); worlds in order, forward-only, the fork, the lane waiting (7); sky C and the giant, a stub for each later sector (10); the tower as the left side, the 720p rule (12); the jump keeps supplies (3) | 70 |
| B. Stop | pull-in and leaving with the transition, orbit as a camera push (13); one action per place (4); who goes and who stays, two crises aboard (10); shuttle, torch, scene, strip or marker, page (10); Mira's bench and the contact reveal (4); Platform Zeta: docking and boarding in Lander art, one readout (8); the sector 1 story fixes from STORY_SPINE_AUDIT §1, items 3, 12, 15, 16 (3); speakers from the team, barks by place type (3) | 55 |
| C. The ship | economy first: food 5 a jump, skim +15, no stop cap, the floor (6); the card pass, all ~130 places (6); the reactor price in the game (9); routines on the seen decks, one standing moment, one ask (12); fix, patch, live with it (7); the red deck after the breach (3); the first meal (3); headless balance runs (4) | 50 |
| D. Words and cleanup | TextStrip changed to v3's voice lines, then EncounterCard and FoundPage on it (15); the record and Esc menu (6); removing the old panels and unused fonts (8); the word counter (2); the checks below (4) | 35 |

**Sector 1 is done when every check passes:**
- a word counter (`?words=1`) over every visible text, DOM and canvas, never shows more than 40; at rest on the lane,
  only one name and tag
- a script finds none of these in the page: header, side panels, log footer, coach, TEST, ART, fabricator, roster,
  deck card, cargo panel
- saves happen on the lane, on the bridge before the action, and after a jump; loading returns exactly there
- a stopwatch run: sector 1 in at most 8 minutes, and no stretch over 45 seconds without a choice, an event or a
  world in reach
- one first-time player, before the first stop, can point at the story contact and say "we can't turn back"
- headless runs: no team pair best more than about half the time; an empty tank never skips a story world
- screenshots of every moment at 1920x1080 and 1280x720, judged at full size, show no straight guide line and no
  readout beyond one per minigame; `?mute=1` is silent

**Then, in order:**

| step | what is new | hours |
|---|---|---|
| Sector 2 | the rogue world, its fork, more stations, the sleepers, the pods' blue line | 25 |
| Sector 3 | the throw film reworked; **needs the paused story decisions** | 15 + writing |
| Sector 4 | the settled worlds, Settle here | 15 |
| Sector 5 | the hungry meal as a real choice, the ledger | 15 |
| Sector 6 | the walk, who stands at the window, the finale in the window; **needs the story** | 25 + writing |
| Release | music licence, AI note, itch page, final check | 8 |
| **All in** | sector 1 about 245 (Step 0, prototype, checkpoints), then 103 | **about 350 + writing** |

**Cut:** WarpPlot, SignalTune, both scans, the probe and ProbeSystem, data, the fabricator and every upgrade, cargo
slots and most items, RosterPanel, DeckPanel, ShipCutaway (once its music beat moves to the reactor), Coach, the
MissionLog strip, the header, NarrativeModal, crew-moment and distress popups, malfunction cards, the landing game on
routine stops, the searchlight dust, the orbit thread, the stops-per-sector cap, supply numbers beside rooms.
Never re-made: the torch, dating, the corridor, the breach.

---

## 6. Open questions (my answer first)

1. **Forward-only, with the five fairness rules and one fork per sector from sector 1?** Yes. The fair alternative
   (two or three worlds in reach at once) is in section 3; if the fork doesn't feel like enough choice in the
   prototype, try it there before building.
2. **Drop the per-sector stop limit and let energy alone decide?** Yes. It removes the limit you called a bug, makes
   the reactor the one thing to read, and the floor keeps every story world reachable.
3. **Keep a small outside Lander flying on the space side of layout A, with the push, turn and dissolve at every
   stop?** Yes. It is how you see your own ship, it makes the nose turn possible, and it keeps the transition you love.
4. **Sky C, with one enormous thing per sector (the giant in sector 1), and at 1280x720 space keeps at least 55%
   while the tower scales down?** Yes. Space is the hero; the tower can lose size but never its whole decks.
5. **No numbers on the lane: the reactor shows the price, A.U.R.A. says what it means, the record has the numbers?**
   Yes, as SHIP_GAMEPLAY decided. If the first-time player can't judge go or no-go, the note adds "5 energy of 95".
6. **Confirm layouts A and D, build the ship prototype first, then sector 1 in four checkpoints (about 245 hours)?**
   Yes. You haven't given a verdict on A and D yet, and everything after rests on them.

---

## 7. What changed in revision 2

The ship side follows SHIP_GAMEPLAY rev 2. The outside Lander and its transition stay. The lane waits. No stop cap;
a floor. Forks from sector 1. Dating pays. Confirmations avoid the cursor. Voice lines, not a strip. Sector 1 story
fixes in B. Estimate redone; checks measurable. Each change is traced to its finding in docs/GAME_AUDIT.md (lens 2).
