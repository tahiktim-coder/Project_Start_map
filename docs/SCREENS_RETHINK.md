# The main screens, rethought (2026-10-07)

**Status:** a proposal with a working mockup. No game file was changed.
**Mockup:** `prototypes/screens/main-screens.html`. With the game's server running, open
`http://localhost:8000/prototypes/screens/main-screens.html`. The tabs at the top switch between sectors 1, 5 and 6. Click a
planet, press Go there, then follow the one button. In sector 1, try the beacon: send the team, date the wreck, leave orbit.
The contact becomes Rhea-4 Minor, and its course is free.

## The short answer

**Rethink the frame and the sector map. Rebuild the orbit screen around one picture. Repaint the ship. Quiet the header and
the log.**

A repaint is not enough. The current map was built for a different game: a box of planets you pick with a stats card.
In new colours it would still be a strategy map in a story game. A full rewrite is not needed either. The ship cutaway, the
SceneArt picture style, the minigame frame, stops per sector, the hidden contact and dating all stay. Most of the logic
underneath stays too. What changes is what the player sees, and where.

About **45–60 hours** for everything below (section 8). The orbit screen is the biggest visible win for the time.

---

## 1. What the game is now, and what the screens are for

The game today is a lonely flight down one heading toward a false sun, past the wrecks of every ship ever sent. A sector
has a planned route of planets, 2–3 stops, one story planet hidden as an unidentified contact, a wreck to date with the
disc, and a jump. Five people are aboard. The dread comes from numbers that climb (beacons heard) and a light that gets
bigger.

What I saw in the live game (muted, 1440×900, sectors 1, 5 and 6):

- **Sector map:** planets scattered in a box. No heading is visible in sector 1. In sector 6 the light sits in the middle of
  the box, not at the end of anything. Planet names are coloured by type, which makes a rainbow. The right panel speaks in
  game terms: `TYPE DESERT`, `SALVAGE UNKNOWN`, `SIGNALS: SCAN REQUIRED`, `-5% EVA risk, Tech loot`, `LONG RANGE SCAN (-2 NRG)`,
  `INITIATE WARP (19 NRG) · USES 1 STOP`.
- **Orbit screen:** a block of `GRAVITY / AIR / HEAT: not known yet`, a planet, and a "command deck" with six to eight buttons
  (deep scan, tune by hand, probe, send team, date the wreck, break orbit, settle).
- **Ship panel:** green phosphor, six rooms including FABRICATION (which the designer thought was gone), crew in role
  colours (white, cyan, purple, red, orange).
- **Header:** vessel, sector, a date (`2342.05.12`), four resources including DATA, and TEST, ART and AUDIO buttons.
- **Log:** always open, small mono text, with crew lines, system lines and number chips mixed together.

None of this is wrong code. It answers a different question: "what can I extract here?" The game now asks "where are we on
the heading, and who is with us?"

| screen | what it is for now |
|---|---|
| Sector map | choose the 2–3 stops in this sector, and feel how far down the heading you are |
| Orbit | arrive somewhere, see it, do the one thing there is to do |
| Ship panel | who is aboard, where they are, what is broken |
| Header | where on the heading, and what we have left |
| Log | what happened, if you want to read back. Not a place to read the story for the first time |

---

## 2. The frame (every screen)

**Two columns instead of three.** Header across the top. The ship on the left. The view (map or orbit) in the middle,
wide. Under the view, one bar: **the talk line on the left, the one thing to do on the right.** The right-hand "TACTICAL DATA"
panel is removed. It is where the numbers lived. With one action per screen there is nothing left to fill it with, and the map
gets the width it needs to be a heading.

**The bar is the same shape as the minigame frame:** one line of talk (who, the line, the line before it faint above) and a
row of buttons. The main screens and the minigames would speak the same way. This also answers the designer's question about
too many ways of reading text (section 7).

**Colour.** The interface uses *Graphite & sodium*: steel and grey. Sodium orange is only for people: speaker names, the
course you plot, a hurt crew member. Red is only for the ship being hurt. The pictures use *Deep field*: teal-black space,
rust-gold dust, ice for machines, amber for people, and the false sun as the warmest thing on screen.

**One light, everywhere.** In every picture the false sun is ahead, to the right. Planets on the map and in orbit are lit
from the right. The ship cutaway's right edge catches it, a little warmer each sector. The light grows by sector:

| sector | the light on the map |
|---|---|
| 1 | a warm star at the right edge. The only warm point on the map |
| 5 | a glow from the right edge that lights the dust and puts a gold rim on every planet |
| 6 | on the map: a white-gold face, the slow sweep crossing it, dead hulls crowding round it |

The header's route ends in a small warm dot that also glows brighter each sector.

**Type.** IBM Plex Sans Condensed for labels, Plex Sans for lines people say, Plex Mono for numbers. Orbitron reads as
"generic sci-fi". Plex reads as instruments made by people, closer to *Moon* and *2001*. (Open question 3: the minigame frame
still uses Orbitron.)

---

## 3. The sector map: the heading

**Shows:**
- **The heading** as a faint dotted line, left to right, into the light. "Our heading →" is written once, at the start.
- **Our ship:** a small Exodus hull on the line, nose toward the light, one warm window.
- **Planets along the route**, each with its name and one plain tag: *Old transponder*, *Gas giant · fuel*, *Ice world*,
  *Dead rock*, *Station · no power*, *A wreck · hull 14,086*.
- **The story contact** as a pulsing blip labelled *Unidentified contact · No fix yet*. No name, no course.
- **Beacons heard** as faint ticks along the heading, with the number at the top: 1 in sector 1, 21,483 in sector 5,
  39,806 in sector 6 (the corridor's own numbers). In sector 1 the line is empty. In sector 5 it is a band of ticks with nine
  small hulls. Near the light, ticks and hulls turn into dark shapes against the glow. A few ticks blink, slowly.
- **Stops left** as three marks, and the jump as a plain button (it becomes the main button when no stops are left).
- **Dated wrecks keep their date** under their name: *Hull 4 · 21 years dead*. The map slowly becomes the disc's chart.
- **The course you choose** is drawn as a warm dashed line from the ship to the planet. It is warm because it is ours.

**Selecting a planet** puts it in the bar: a small picture, the name, one plain line ("A dry world. A ship beacon is still
running down there."), the price ("5 energy · uses a stop"), and **Go there**. One crew member reacts in the talk line.

**Stops showing:** salvage and energy levels, `UNKNOWN`, `TYPE`, `SIGNALS DETECTED` with percentages, `TAGS`, the long-range
scan, the remote probe, `INITIATE WARP (19 NRG)`, planet-type colours, the hover pop, the old scanner bar.

**Proposed (needs a yes): the ship only flies forward.** Planets behind the ship are dimmed. Selecting one says "We passed
it. The ship only flies forward." The heading is one way in the story (the drive throws one way, nobody goes home), and this
turns "which stops" into "which stops, in what order" without adding a system. The story planets already sit on the far side
of each map (62–76% across), so the contact reveal still works. It costs one check in the warp code.

---

## 4. The orbit screen: one picture, two lines, one action

**Shows:**
- The planet's name and **one line** under it ("A dry world. Hot by day, frozen at night.").
- **One big picture**, 480 × 270 (the minigame size), at whole-pixel scale. The planet is lit from the light and our ship is
  small in the corner. There is one focal light: a red beacon blinking on the night side for a wreck, a warm hand-set lamp for
  the sector 5 shelter, a lit window or a red navigation light for a station. For the light itself, its face fills the
  frame, the sweep crosses it, and hulls drift across it.
- **The talk line** (the second plain line): whoever speaks on arrival says what is there. "Orbit, Commander. The beacon
  belongs to EXODUS-4. It is still running."
- **One main action**, with **Leave orbit** always one quiet button away. Under it, one short line saying what it costs or
  who goes ("Vance and Aris take the lander.").
- A **Dated** chip once the wreck is dated.

**The main action moves on by itself:** *Send the team to the wreck* → *Date the wreck* → *Leave orbit*. There is no "now or
later" prompt. When the team is back, dating is simply the next button. This fixes what the designer hit: they said "later",
then still saw DATE THE WRECK in the side panel. Leaving the orbit after dating selects the newly found story planet on the
map, with its free course already drawn.

**Stops showing:** the conditions block (gravity, air, heat), salvage, energy, life and machines, `DANGER: LOW…EXTREME`, and the
command deck. The deep scan becomes part of arriving: its result is the arrival line. ECONOMY.md already proposes free scans.
The probe goes (also ECONOMY.md). Tuning the scan by hand goes.

**Settling** moves off the button list. It appears only on worlds where people could live, as a quiet second button: "Stay
here · ends the journey". (Open question 4.)

Stations, asteroid fields and the light use the same layout with their own picture and action.

---

## 5. The ship panel

Same vertical cross-section, same idea, at the picture standard:
- **Five rooms:** Bridge, Lab, Quarters, Hold, Engineering. **Fabrication is gone**, as the designer expected. If ECONOMY.md's
  workshop is kept, it becomes a corner of engineering, not a sixth room.
- **Machines are cool, people are warm.** The hull is steel. The reactor beats in ice blue. The lab wall carries the disc's
  star map: fourteen lines from a centre, in ice. The lamps in the bridge, lab and quarters are warm, and so are the crew
  figures. So is the small light inside each sleeper pod in the hold.
- **Damage** is the one red: the room goes red and its lights fail, with sparks. A hurt crew member lies in a bunk.
- Stars stream past the bridge window, because the ship is flying.
- Pixels are 3× here (2× elsewhere), so the people are big enough to see.
- Under the ship, **five names** with where each one is, or "Hurt". The panel head says **"Five aboard"**. The narration says
  five, A.U.R.A. says four, and the screen quietly sides with the narration.

**Crew colours (open question 2):** today's role colours are a rainbow and break the colour rule. The mockup uses five warm
tones and lets the names carry who is who. The cost: you can tell people apart less at a glance.

---

## 6. The header

`EXODUS-9` · the route (1 2 3 4 5 6, then the warm dot of the light) · `Sector 5 · The Tally` · ENERGY · RATIONS ("food for
2 jumps") · SALVAGE · LOG · a menu (sound, save, test tools).

**Cut:** DATA (ECONOMY.md folds it away), the date `2342.05.12` (the story says the ship's calendar is wrong, so dates belong
to the disc), the TEST, ART and AUDIO buttons (into the menu), and the `/// SECTOR 1:` prefix. A resource only turns sodium
when it is low.

---

## 7. The log, and one place to read

`docs/TEXT_SYSTEM.md`, written the same day by another session, covers this in depth and also takes the minigame line as the
model. Where the two differ, that page decides how text works and this page decides where it sits on the main screens.

The designer asked whether there are too many ways of reading text. There are. A line can arrive today as:
1. a card with faces (EncounterCard),
2. a found page or the disc page ("read on"),
3. a radio row with a face in the log,
4. the coach bar ("NEXT …"),
5. the minigame talk line,
6. floating numbers and toasts.

**Proposal for the main screens:**
- **Speech goes in the talk line, always.** One line at a time, the previous one faint above. It is the same component the
  minigames already use, so a crew member sounds the same everywhere.
- **The card is only for real choices.** The game stops and asks.
- **Documents are pages.** The found page stays as it is: it is meant to feel like an object, not a button.
- **The log is a journal you open.** It holds past-tense facts, grouped by sector, newest first. No speech, no chips: "Dated
  hull 4: twenty-one years dead." A small dot on LOG means something new.
- **The coach bar** becomes the note in the action slot: "Choose a stop on the heading. 3 stops left before the jump."

The cards and pages themselves need their own pass to look like they belong together. That is outside this job (open
question 6).

---

## 8. What it means for the code

The mockup's drawing code (painter, framer, sphere, light, hull, station, ship) is written so it can be lifted into the game
as is: same Bayer matrix, same noise, same `drawHull` as `SceneArt.js`.

| where | change | hours |
|---|---|---|
| `index.html`, `theme.css`, `style.css` | new grid (no right panel, add the bar), interface tokens, fonts; remove the CRT overlay from the main screens | 4–6 |
| `src/views/NavView.js` | becomes the heading view: markers and labels from planet data, selection goes to the bar; the stats card and the special purple panel for the light go | 5–7 |
| `src/systems/NavVista.js` | replaced by a SceneArt-style painter: cached backdrop, the light per sector, beacon ticks, hulls, planets lit from the light, our ship, the course | 6–8 |
| `PlanetGenerator` | positions along the heading, warp price by distance (ECONOMY's 4–6) | 2–3 |
| `src/views/OrbitView.js` | caption, picture, one action from a `nextStep(planet)` built on `siteOf`, `canDateWreck` and `exodusInvestigated`; `updateCommandDeck` goes | 5–7 |
| `OrbitVista.js` | replaced by an orbit painter (planet, focal light, our ship, the light) | 6–8 |
| `src/bundle.js` | the existing `req-action-*` events stay; the deep scan runs on arrival; the "date it later?" prompt goes; scan, probe and tune paths go with ECONOMY | 3–4 |
| `src/systems/ShipCutaway.js` | new ramps, five rooms, warm figures and lamps, pod lights, the light's rim; DeckPanel's click targets stay | 4–6 |
| `MissionLog.js`, new `TalkLine.js` | the log becomes a drawer of journal lines; speech goes to the talk line (it can reuse MissionLog's speech pattern) | 5–6 |
| header | markup and the HUD update | 1–2 |
| `Coach.js` | its lines move into the bar's note | 1 |
| testing | 1440×900, 1280×720, 980 wide, a phone; with sound muted | 3–4 |
| **total** | | **45–62** |

Forward-only travel adds 2–3 hours if adopted. The dither look becomes the only look for these screens, so the ART toggle
could go (open question 5).

**Order I would do it in:**
1. The frame, the header and the talk line. It touches everything, and it removes the right panel.
2. The orbit screen. It is where the player lands every stop, and it gives the biggest visible change for the time.
3. The map.
4. The ship repaint.
5. The log drawer.

Do it with ECONOMY.md's first aid, not before it. The new map and orbit screens assume scans are free and the probe is gone.

**What not to do:** repaint the current map in the new palette. It would still be a box of planets with a stats card.

---

## 9. Open questions for the designer

1. **Forward only?** Planets behind the ship can't be reached. I recommend yes.
2. **Crew colours:** five warm tones (the colour rule), or keep the role colours (easier to tell apart)?
3. **Fonts:** move the game and the minigame frame from Orbitron and Share Tech Mono to IBM Plex?
4. **Settling:** a quiet button only on worlds people could live on, or somewhere else?
5. **The ART toggle:** drop the classic art mode for the main screens?
6. **Cards, pages and the talk line:** do the matching pass on the cards and pages next?
7. **Beacons in sector 1:** the map says 1 (the marked transponder) and the corridor starts its count at 0. Pick one.
8. **The title screen** shows a purple ringed planet, which is off-palette. It could open on the heading instead: a dark
   field, one warm star at the far edge.
