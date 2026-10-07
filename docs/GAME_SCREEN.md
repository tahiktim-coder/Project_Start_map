# The game screen (2026-10-07)

*Updated 2026-10-08 after the review of the first build: even pixels on scaled Windows displays, words that pick the darkest place and never shade a planet, warm dithered faces, a curved ring, a river that flows, a smaller light, a framing per orbit, a logbook with one stop to a page, found pages without grey bars, and rooms with things in them.*

Your verdict on the last mockups: too much dashboard, the ship shoved left, "SECTOR 1 OF 6" on a ship that would never show it, reading in panels. What you wanted: space always on show, one enormous thing per sector, and a feeling of ruling the ship. You click where you want to go and it takes you there. Three concepts were drawn up against that. This page judges them, picks one, and says exactly what the next mockup (`prototypes/screens/game-screen.html`) will show.

---

## 1. The verdict

| | **The Living Painting** | **The Forward Glass** | **The Long Shot** |
|---|---|---|---|
| in one line | the whole screen is a painting of the sector; you click a world and watch the ship fly there | you stand at the bridge window; you touch the glass and the view swings round | a film shot from outside; the ship crosses enormous things from left to right |
| (a) no dashboard anywhere | **9** | 6: numbers on the console, a stop tally drawn on the glass, a window frame round everything | **9** |
| (b) space is the hero | **9** | 8: the window frame and the crew shapes eat the edges | **9** |
| (c) you command the ship, the view is the control | **9** | 7: you never see your ship and never look down on the sector | 8: side-on, so the ship can only go up or down, not really turn |
| (d) you always know what you can do, what it costs, what is left | **8** | 7 | **8** |
| (e) reading fits the scene and the text rules | **9** | 8 | 8: the record as "the road behind you" is too clever |
| (f) buildable in the real game | **7** | 4: a turning first-person camera, about 110 hours | 6: needs three or four ship sizes and a camera moving every frame |
| (g) fits ART_STYLE and the palettes | **9** | 7 | 8 |
| **total (of 70)** | **60** | **47** | **56** |

**The base is The Living Painting.** It is the only one that gives the "god" view you asked for: the whole sector on one screen, your ship in it, and a click that sends the ship there while you watch. The Forward Glass is beautiful, but a person at a window does not rule a sector, and it hides the ship you liked seeing move. The Long Shot is close behind and gives us four good ideas.

**Taken from The Long Shot:**
- The canvas is **640 x 360**, shown at a whole number of *screen* pixels per art pixel: 3 on a 1920 x 1080 display, 2 on 1280 x 720. The scale is counted in device pixels, so a Windows display at 125% still gets even pixels (it was 2.5 per art pixel before the 2026-10-08 fix). Same picture at every size, no uneven pixels.
- **The light is the way on.** It sits at the right edge every sector and never moves. You click it to jump. It grows each sector, so you see how far you have come without any "1 of 6".
- **Point at your own ship to see your supplies** in one quiet line. A supply that runs low stays there by itself.
- **Dates are written onto the picture.** A dated wreck keeps its small note ("Hull 4 · 21 years dead"), so the sector slowly turns into the disc's chart.

**Taken from The Forward Glass:**
- **A cost is said once, at the moment you choose,** and never sits on screen.
- **Dating is the star map held up against real space,** lined up with the actual stars outside.
- Crew who are not on the bridge speak "from engineering" or "from the hold", in small words under the name.

**Left out, and why:**
- The bridge window, the numbers on the console and the stop tally on the glass. A dashboard by another name.
- The camera that pans across a 1.25-screen picture (from The Living Painting itself). You lose the overview. One screen, whole sector.
- The same hull number twice in sector 5 (The Forward Glass). It is not in the canon and gives away the time throw too early.
- The record as a road you pan back along (The Long Shot). A logbook is plainer.
- Our ship's nose dipping at whatever you point at (The Long Shot). It is nice, but it can wait until after the mockup.

**Claims checked against the files.** The figures today really are 5 x 9 stamps with a two-frame step (`ShipCutaway.js`, `FIGURE`). The dead-beacon blinks really are 5 to 12 seconds (`NavVista.js`). The hidden story planet really sits 62 to 76% across (`StoryPlanets.js`). Warps of 4 to 6, a jump of 8 and free dating are in `ECONOMY.md` section 3. They are still a proposal, though, and the game charges 10 to 19 and 20 today. `SceneArt.paint(ctx, key, t)` exists, so the mockup can show the real card pictures. Four things are still to fix. `EncounterCard.js` still names people "Eng. Jaxon" and "Spc. Vance" and gives each a colour. `ShipCutaway.js` still has six rooms (Fabrication is there). `OrbitVista.js` uses a 4 x 4 dither, not the 8 x 8. And the old mockup's ink was `#06090c`, not the `#05070a` the style asks for.

---

## 2. The design in plain words

**One picture, nothing round it.** The whole window is a painting of the sector you are in, in the SceneArt style, mostly dark. There is no header, no side column, no bottom bar, no log strip, no sector number. Each sector has one enormous thing in it, too big to fit in the frame: a ringed giant, a black world, a road of dead beacons, a green planet that looks like home, a river of thousands of dead hulls, and at the end the light itself. The light always sits at the right edge, ahead of you.

**Your ship is in it.** EXODUS-9 is a small steel hull with warm windows, nose toward the light. When you arrive in a sector it drifts in from the left and stops about a third of the way across, never at the edge. Every stop moves it further right. Worlds it has flown past fade and stop answering. Forward-only is something you see.

**You point, it goes.** Point at a world and three things happen. Its rim brightens, a short warm arc leaves your ship's nose toward it and thins out through the dither before it gets there, and a short note appears beside it: its name, one plain line, and what it costs. Click, and someone aboard reacts while the course locks in. A second later the engine lights, the energy is spent, and the ship flies the curve while you watch. A click on empty space or Esc in that second cancels it for free. When the ship arrives, the screen dissolves through the dither grain into orbit.

**Orbit is the planet, huge.** Each world is framed its own way, cut by the edge of the frame, mostly in night with its lit crescent toward the light, and your small ship holds station above it. There are no buttons. The thing you can do is written in the dark sky just off the limb, with a faint thread down to the thing it acts on: "Send the team" over the blinking beacon (it stands on the wreck), "Leave orbit" under your ship, "Stay here" on a world people could live on. Only the next step shows. When the team goes down you see the lander drop. The scene that follows plays like a film: the card picture across the full width, black bands above and below, the words in the bands. Then "Date it with the star map" appears beside the beacon, only while you are in this orbit.

**Words sit beside whoever is speaking.** A crew line appears in the dark sky next to the ship, a line from the ground appears next to the beacon, and a price appears next to the world. Each of these has a few places it may go (under the ship, over it, beside it); the darkest one wins, and a place that covers a world counts as bright. There are never boxes. The sky darkens softly under the words with the same dither grain, with a ragged edge, and never over a planet, a station, the giant or our ship. That gives one line at a time, the faint line before it above, 40 words at most. A.U.R.A. speaks only in conversation. Her routine reports go to the record, and so do crew remarks.

**What is left, without a meter.** The price note says when it matters: "uses a stop · one more after this", "our last stop before the jump". A.U.R.A. says it once as you leave orbit. When no stops are left, the worlds ahead sink back into the picture and only the light still answers. Energy shows in the picture too: a weaker engine glow when it is low. Point at your ship for the exact numbers.

**The ship opens up.** Click your ship (or press E). The plating dissolves through the dither grain and the same hull is seen cut open, side-on, five rooms in a row: bridge, lab, quarters, hold, engineering. Your five people walk, sit, work and sleep in it. Supplies are written plainly beside the rooms they belong to. Someone hurt lies in a bunk. Someone shut in is behind a door with a red lamp. In the main picture you can already see that red lamp in a window.

**Better walking models.** The new figures are 12 x 24 pixels instead of 5 x 9 (built: `prototypes/screens/crew/`, docs/CREW_SPRITES.md). Each has a head with hair, shoulders, arms and legs. Each is shaded in three steps with a bright edge on the side facing the light. They walk with four frames, breathe when idle, and have work poses. You tell them apart by shape, because all five colours are warm. Jaxon is broad, with a cap and a tool belt. Vance is the tallest, with his collar up. Aris has a long coat and tied hair, and carries her list. Mira is the smallest, with loose hair and quick steps. Cora is mostly in her chair on the bridge. Every half minute or so someone walks somewhere for a reason. Aris goes to a hurt bunk, Jaxon to a broken room, Mira to the bridge after a find. The rooms are lit places, not boxes: each lamp throws a cone down the wall and a pool on the deck, and each room has the things its people use. The bridge has a chart on the wall and a mug on the console. The lab has shelves of samples and Aris's list of the dead pinned to the wall. The quarters have a photo over the bunk, a table with a mug, and a jacket on a hook. The hold has netting over the crates and a rack of bins. Engineering has a tool board and three gauges whose needles sag when power is low. On this screen the crew's signature colours follow the house rule (people are warm): Aris's hair lights and goggles, Mira's streak and Cora's trim are warm tones here, not magenta, mint or cyan; crew-study.html still shows the portrait colours.

---

## 3. Build spec: `prototypes/screens/game-screen.html`

One file, no build step, loads IBM Plex (Sans 300/400/500, Sans Condensed 400/500, Mono 400) and `../../src/systems/SceneArt.js` for the card picture. Ink is `#05070a`. World palette **Deep field** (the `RP` ramps of main-screens.html). Words in **Graphite** (`--text #e4e4e0`, `--dim #8b8d90`, `--ui #c9d1d6` steel, `--warm #f08c2e` sodium, `--danger #e0453a`). Static layers are painted once and cached. Blinks, twinkles and walk cycles step at 8 fps. The ship's flight moves every frame, snapped to whole canvas pixels. **No mockup bar on screen:** nothing shows until the backtick key opens a small list of the moments below, and deep links open them directly (`#s1`, `#orbit`, `#scene`, `#date`, `#plate`, `#ship`, `#record`, `#jump`, `#s5`, `#s6`). `?t=12000` paints a still frame at that time, `window.step(ms)` moves time on by hand, for checking with a hidden pane, and `window.__dev` (mockup only) retunes the giant and the orbit framings live and zooms into a corner with `__dev.lens(x, y, scale)`. The game is silent.

### The moments it shows

1. **Sector 1 arrives** `#s1`. Black, then the painting fades in. The ship drifts in from the left and settles. "The Graveyard" appears once in the sky and fades. Three voice lines follow. The names of the reachable worlds show for 4 seconds from the last line. Once the voices are done, a one-time hint sits beside Titan-61 IV (never two hints at once). **The enormous thing:** Kryos-68 Prime, a gas giant whose curve rises from the lower right and fills about a third of the frame. The side facing the light is a wide lit crescent with rust and gold belts, thin streaks inside them and one big storm with a pale edge, under a gold rim; the far side falls into night. Its ring is a cold grey band of ringlets with a dark gap, and it visibly curves: it rises out of the lower left, hooks round and goes behind the giant. A few small broken hulls are caught in it. Our ship flies above the ring. The giant is also a place you can go (the fuel stop). The light is a warm pinprick at the right edge, the only warm point in the sky. Titan-61 IV carries the sector's one red blink, the one beacon heard. The worlds you can click are about 1.5 times the old size (Titan-61 IV is 120 screen px across at 1920). A faint contact is a soft cold smudge that swells and fades in steps, not a ring.
2. **Point and go.** Pointing at Titan-61 IV shows its note (its own name tag hides while the note shows) and a short warm arc from our nose that fades out on the way. A click locks the course, and Mira reacts beside the ship. After 1.2 seconds the engine flares and "−5 energy" floats up from the ship. The ship flies the curve in about 4 seconds, with a short warm wake. Clicking or pressing Space hurries the flight. A click on empty space during the 1.2 seconds cancels it. Clicking Platform Zeta after the ship has passed it gives A.U.R.A.'s "We passed it" line.
3. **Orbit** `#orbit`. A one-second Bayer dissolve into orbit over Titan-61 IV. The planet rises from the lower left, cut by the frame, mostly night with a lit crescent toward the light; our ship (len 58) holds station at upper right. The world's name and plain line show in the top corner away from our ship, then A.U.R.A. speaks beside the ship. The beacon is a stepped red blink (flash, glow, ember, dark) on a small dark wreck near the limb. "Send the team" sits in the sky just off the limb above it, with a faint thread down to it that warms when you point; "Leave orbit" sits under our ship. An action waits while a voice line sits on it. Clicking "Send the team" drops a 2 x 2 warm lander from the ship to the beacon in stepped frames. Every world has its own framing (`ORBIT_AT`): Rhea-4 Minor from the lower right with our ship upper left, the giant as a curved horizon, Zephyr from the left edge, and so on.
4. **The scene, as film** `#scene`. The orbit dissolves into `SceneArt.paint(ctx, 'EXODUS_WRECK', t)`, shown full width with black bands. The narration comes first, then three voice lines from the two who went down (Aris, Vance, Aris), then two numbered choices with chips. Each voice has a face: the painted portrait cropped to the face, shrunk to 24 x 24 and redrawn with the 8 x 8 Bayer dither through one ramp from the ink to that person's warm tone, shown at the world's own pixel size. No smooth-scaled portraits, no magenta. Back in orbit, Vance's line appears beside the beacon and "+30 salvage" (or "+15 salvage" and "−1 ration") rises from the ship.
5. **Dating** `#date`. "Date it with the star map" appears over the beacon and pulses three times. Clicking it darkens the orbit (a multiply, so the planet keeps its grain instead of turning into a checkerboard). The star map is laid over the stars as a faint ice etching, the same drawing as in their logbook: fourteen lines from one point with their ticks, no rings. Click or Space slides it until its marks sit on three real stars, then Mira speaks. The note "Hull 4 · 21 years dead" stays beside the beacon. Leaving orbit, the faint contact in the sector grows into Rhea-4 Minor, with its free course already drawn warm. A.U.R.A. says how many stops are left.
6. **A found page** `#plate`. At Rhea-4 Minor the team brings back the crew plate. The painting darkens, and the plate lies in the middle at about half the screen height. The names are cast into the metal in a 3 x 5 pixel font, raised and lit from the top left, part of the plate's own picture. Only what you have read shows: the line now, with the lines before it faint while they all fit in about 40 words; nothing unread is hinted at. The words sit on solid ink with a ragged dithered edge. On the drawing (`#disc`) each part you read about gets a pencilled number in a rough pencil ring, red for the one you are on, grey for the ones before. Click, Space or → moves on, ← goes back, Esc puts it away. Aris's line sits under it. Then the painting comes back up.
7. **The ship and the crew** `#ship`, shown in the sector 5 state. Clicking the ship (or pressing E) dissolves the plating, and the horizontal cutaway opens over the darkened sky with the stars streaming left. The cutaway is painted ahead of time while the screen is black on arrival, so opening it costs a few milliseconds, not a stalled frame. Five rooms, each with its lamp's cone of light and pool on the deck and the props listed in section 2. Vance is hurt and lies in a bunk in the quarters. The quarters are damaged: red, failing lights, sparks. Three sleeper pods glow in the hold. Jaxon kneels at the reactor, Aris walks to Vance's bunk, Mira stands at the star map, Cora sits on the bridge. Pointing at a person shows their first name and state. Esc or a click outside closes it.
8. **The ship's record** `#record`. Press L, or click the logbook on the bridge in the ship view. Any voice line on screen ends first. A logbook lies open over the darkened painting: one stop to a page, both pages used, newest first, with the sector's name over its first stop. The ship's routine lines are smaller and fainter, not folded away. "Read the plate again" and "Look at the drawing again" are plain words in ink, not links. Crew names use darker inks of their tones so they read on the paper. ← → turns the page, Esc closes it.
9. **The jump** `#jump`. Pointing at the light shows its note. With stops left, clicking it brings A.U.R.A.'s question and two choices, in the dark sky over our ship (not on the giant). "Jump now" shows −8 energy and −5 rations. The ship speeds off toward the light, the stars stretch toward it for six stepped frames (only over sky: never across the giant or a world), then black. The next sector is painted while the screen is black. (In the game the corridor minigame plays here.) The mockup goes on to sector 5.
10. **Sector 5** `#s5`. "The Tally" appears in the sky. A.U.R.A. gives the beacon count and Vance answers it. The energy is low (22): the engine glow is short and dim, and Jaxon says so once from engineering. Iapetus-60 Minor shows as a contact with a small warm lamp. The quarters window shows a red lamp. **The enormous thing:** a river of dead hulls. About a thousand drawHull shapes and nine thousand specks run in one current from the near left out into the light's glow, all nose to the light, so it reads as a flow and not as debris. The nearest, whole in frame at the lower left, is big enough to show plate seams and its painted number, 14,086 (the same hull Kryos-0 Alpha's wreck sends). They thin to specks, then to short ticks along the current against the gold. The near ones are dark silhouettes. A few beacons blink out of step. The current moves one pixel every eight seconds. The light is a gold glow at the right edge that puts a gold rim on every planet.
11. **Sector 6** `#s6`. "The Light" appears in the sky. The light's face is cut by the right edge of the frame (radius 190, about a fifth of the frame), so the frame stays mostly dark: dark gold at the limb, cream toward its hidden middle, a boiling grain, a dithered corona, the slow sweep across its face, and a stream of hulls heading in. The far ones are small and lost in the glare; only a few near ones are black. All words sit on the dark left half. Pointing at the light shows its note. Clicking it plays Aris's line and then the orbit in front of the light. A.U.R.A. speaks, and the one action "Go into the light" sits beside the light's face. The mockup ends there.

The other three sectors are described here and not drawn in the mockup.
- **2, The Dark Void:** a rogue world with no sun, drawn as a disc of pure black where the stars stop, with a thin ice edge on the side facing the light.
- **3, The Signal:** a long band of hundreds of dead transponders crossing the sky, with a few resolving into hulls near the ship.
- **4, The Garden:** a blue-green world filling the bottom 40% of the frame, with the warm lamps of a dead colony on its night side.

### Layout at 1920 x 1080 (canvas 640 x 360 at 3 screen pixels per art pixel)

- **The ship** rests at 30% across and 54% down, drawHull len 56, ht 13 (168 x 39 on screen), nose right, with five warm window slots. Reachable places sit between 38% and 92% across. **The light** is pinned at the right edge, at 47% down.
- **Voice lines** have three places by the ship: under it (the left edge 8 canvas px left of the tail, the top 10 px under the hull), over it, or (when the ship is past the middle) left of it; 620 px wide at most. The world scores each place by how busy the picture is under it (`World.luma`: mean brightness, plus bright pixels, plus any world it would cover) and the darkest wins; the choice holds while the ship flies unless the sky under it turns bright. In orbit the places are beside our ship, over it and under it, and for lines from the ground, the sky just off the limb over the beacon. The name is Plex Sans Condensed 15px caps, letter-spaced: sodium for people, steel for A.U.R.A. (with a small steel ring before it). The line is Plex Sans 24px, bone, with balanced line breaks (no lone last word). The line before is at 45%. A small blinking ▸ follows the last word. "Click or Space" shows in Plex Mono 15px under the line, in the first two scenes only.
- **The shade under words** is the dither grain, darkest in the middle, fading out over 14 art px with an edge roughened by noise, so it reads as a patch of shadow and never as a box. It falls on the sky only: planets, stations, the giant and our ship are masked out, so words never cut a notch out of a world. Letters carry one hard 1 px ink edge, no blurred halo. A found page's words are the one exception: they sit on solid ink.
- **A place's note** sits 6 canvas px right of the place, or left of it when the place is past 80% across; if that side is busy (the giant, the light, another world) it goes over or under the place instead, whichever is darkest. While a note shows, that world's own name tag hides, and any other name tag under the note gives way. The name is Plex Sans Condensed 500 20px bone, the plain line Plex Sans 17px dim, the cost Plex Mono 15px steel. 16 words at most.
- **Chips** use Plex Mono 16px. They rise 20 canvas px from the ship and fade over 1.5 seconds. Gains are bone, costs steel, red only for loss and danger; sodium stays for people and the false sun. A supply that runs low ("Energy 22") waits behind our ship's tail in bone, clear of the voice lines over and under it.
- **The sector title** is Plex Sans 300 46px, letter-spacing 0.2em, at 50% across and 22% down. It fades in over 1 s, holds 3 s and fades out over 1 s.
- **Orbit** frames each world its own way (`ORBIT_AT` in the mockup): the planet 214 to 500 canvas px in radius, its centre below or beside the frame so the edge cuts it, lit from behind so most of it is night and a crescent faces the light. Our ship (len 54 to 58, about a tenth of the planet's width) holds station in the open sky. The name and plain line go in the top corner away from our ship. The action word (Plex Sans 20px bone) sits in the sky 26 canvas px off the limb over the beacon, on the darkest side, with its sub-line under it (Plex Mono 15px dim) and a faint grey thread down to the beacon; pointing at it turns it sodium and the thread warm and stepping. "Leave orbit" sits under our ship.
- **A scene** shows the 480 x 160 picture at 4x (1920 x 640), with bands of 220 px. The top band holds the title in Plex Sans Condensed 15px caps steel. The bottom band holds the narration (Plex Mono 16px), the voice lines (a 24 x 24 dithered face at the world's pixel size, 72 px at 1920, as TEXT_SYSTEM rule 3 asks when the game waits for you) and the numbered choices, verb first, with chips on the right.
- **The ship view** shows the hull at len 560, ht 64, centred at 52% down (1680 x 192 on screen). The rooms run from the nose: bridge, lab, quarters, hold, engineering. Each room's words sit just under the hull below it, in Plex Mono 15px steel. The crew are the 12 x 24 figures (36 x 72 on screen).

### Layout at 1280 x 720 (the same canvas at 2 screen pixels per art pixel), and every size between

Every position is the same, because the canvas is the same. Text sizes follow the CSS width of the window, not the pixel scale: they run smoothly from 1280 to 1920 wide, so 1440 x 900 is as readable as either end, and nothing you must read is under 14px. At 1280: voice line 19px with a 470px measure, names 14px, note 17/15/14px, chips 14px, title 34px, hints 14px. A scene shows the picture at 2x (960 x 320), centred, with bands of 200 px. On other sizes the scale is the largest whole number of device pixels that fits (at least 2), so a 1920 x 1080 display at Windows 125% (1536 x 864 CSS) still gets exactly 3 screen pixels per art pixel. The extra width or height is filled with more sky, never stretched.

### Interactions

| input | what it does |
|---|---|
| point at a place | rim brightens one step, a short warm arc from our nose, note |
| click a place | lock the course, 1.2 s to cancel, then fly |
| click a place behind the ship | A.U.R.A. says it once; nothing else |
| click the light | jump (sector 1, 5) or go to the light (sector 6); asks first if stops are left |
| point at the ship / click it / E | supplies line / open the ship / open the ship |
| Space, Enter, click anywhere | next line; hurry the flight |
| Esc | cancel a course, skip to the choice, put a page away, close the ship or record; otherwise the menu |
| 1, 2 | choose |
| L | the ship's record |
| Tab / Alt | step through the places ahead / show all their names |

The Esc menu has five quiet words in the middle of a dimmed screen: Resume, The ship's record, Sound, Save, Quit.

### Drawing code to reuse from main-screens.html (by name)

- Kept as they are: `seeded`, `vnoise`, `fbm`, `threshold`, `level`, `ramp`, `painter`, `framer`, `scatterStars`, `keepVisible`, `twinkle`, `spaceAndDust`, `lightGlow`, `sphere`, `surfaceFor`, `lightVector`, `hullEdges`, `drawHull`, `drawStation`, `contactBlip`, `lightSweep`, `shade`, the `RP` ramps and `PLANET_RAMP`.
- Kept, adapted to 640 x 360: `buildOrbit`, `orbitPlanet`, `orbitStation`, `orbitTheLight`, `paintOrbitFrame`, `mapBackdrop` (it loses the dotted heading and the tick field), and `roomProp` (the same props, turned on their side for a horizontal hull).
- Kept as data: the `SECTORS` places, notes and lines, with positions moved ahead of the ship.
- Not used: `mapForeground`'s heading line and ticks, `shipLayout`, `buildShip`, `FIGURE`, `renderHud`, `renderLog`, `renderAct`, `paintThumb`.
- New: `paintGiant` (sector 1), `paintHullRiver` (sector 5), `paintLightFace` (sector 6), `courseArc` (a warm dithered arc that fades out), `ditherShade` (the soft darkening under words, sky only), `bayerWipe` (the one-second dissolve), `paintCutaway` (with lamp cones, deck pools and room props), `crewSheet` (the 12 x 24 figures of `prototypes/screens/crew/`, 6-frame walk, idle breath, sit, kneel, tend, console, carry, lie), a 3 x 5 pixel font for words painted into pictures (hull numbers, the plate, pencil marks), and the dithered faces.

### Every line of text in the mockup

Lines marked • are from the game or the old mockup. The rest are new. All are in plain speech, 20 words at most.

**Sector 1 arrival:** title "The Graveyard" · ARIS: "Everyone is up. Sixty-one years, and nobody even feels hungry." • · A.U.R.A.: "I hear one old ship beacon on our route, Commander." · hint beside Titan-61 IV: "Click a world to go there."

**Notes on places (name / line / cost):**
- Platform Zeta / An old station. Its docking port still answers. • / 4 energy · uses a stop
- Titan-61 IV / A dry world. A ship beacon is still running down there. • / 5 energy · uses a stop
- Kryos-68 Prime / A gas giant. We can skim fuel from its clouds. • / 6 energy · uses a stop · +15 energy
- Chronos-37 Proxima / An ice world. Nothing on the scanner. • / 5 energy · uses a stop
- Zephyr-97 X / A dead rock. No signal. • / 6 energy · uses a stop
- the contact / A faint contact. No course to it yet.
- Rhea-4 Minor / A small grey moon. Its emergency lamp still flashes. • / no energy, we have their course · uses a stop (the course is free; the stop is not)
- the light, sectors 1 and 5 / The light ahead / Jump to the next sector. / 8 energy · 5 rations
- the cost line late in a sector: "uses a stop · one more after this" and "our last stop before the jump"
- our ship: "Energy 100 · Rations 25 · Salvage 50" / "Click to look inside"

**Choosing:** MIRA: "That's a ship's transponder. One of the eight, I bet." • · VANCE: "A station out here. Somebody put it on this route on purpose." • · JAXON: "We can skim fuel there. It will cost us a stop." • · ARIS: "Nothing on the scanner. Just old ice." • · A.U.R.A.: "A dead rock, Commander. There is no signal from it." • · on a cancel, A.U.R.A.: "Holding course, Commander." · behind the ship, A.U.R.A.: "We passed it, Commander. The ship only flies forward."

**Orbit, Titan-61 IV:** "Titan-61 IV" / "A dry world. Hot by day, frozen at night." • · A.U.R.A.: "Orbit, Commander. The beacon belongs to EXODUS-4. It is still running." • · "Send the team" / "Vance and Aris take the lander" • · "Leave orbit"

**The scene** (only Vance and Aris went down, so only they speak from the hold): title "EXODUS-4 · The stockpile" · narration: "The decks are wrecked, but the hold is sealed and dry. A note on top says: For whoever comes next." • · ARIS: "They packed this for the next crew. That's a decent thing to do." • · VANCE: "The manifest matches what's in the hold. That's the first honest list I've seen out here." • · ARIS: "The labels are all handwritten. Someone took real care over this." • · choices: "1 Take everything  +30 salvage" • and "2 Take half, leave a note of our own  +15 salvage −1 ration" • · back in orbit, VANCE: "We're back. Nobody alive down there. We brought their last star reading." •

**Dating:** "Date it with the star map" / "Mira lines it up with the stars" · MIRA: "Hull 4 died twenty-one years ago. They were flying to that grey moon." • · note on the picture: "Hull 4 · 21 years dead" • · leaving orbit, A.U.R.A.: "We can make two more stops before the jump, Commander." · later: "We can make one more stop before the jump, Commander."

**The crew plate** (printed on the plate) •: "A metal plate from beside the airlock. Four crew names are cast into it." / "Below them is a fifth panel, the same size. It is blank. It was made blank." / "Someone made a plate for five people, and only ever had four names to put on it." / cast names: R. OSEI · ENGINEER, T. YUEN · DOCTOR, K. ADEYEMI · SECURITY, L. PARK · SCIENTIST, and the blank panel · then ARIS: "I'm adding their names to my list." •

**The ship view (sector 5 state):** room words: Bridge · Lab · Quarters · Hold · Engineering; under engineering "Energy 22" and "Two more stops before the jump"; under the hold "Rations 10 · food for 2 jumps" and "Salvage 25"; under the quarters "Damaged". Pointing at people: "Cora · on the bridge", "Jaxon · in engineering", "Vance · hurt", "Aris · with Vance", "Mira · in the lab".

**The record** (on the logbook): heading "The ship's record". Sector 1 · The Graveyard: "Dated hull 4: twenty-one years dead." • · "The team searched EXODUS-4. Nobody alive." • · "Found the crew plate on Rhea-4 Minor." · Sector 5 · The Tally: "Flew the corridor. 21,483 beacons heard." • · "A rock hit the quarters. Vance was hurt." • · "The crew ate 5 rations. 10 left." · a crew remark: JAXON: "Reactor or hull. Pick one. I haven't slept enough to do both." • · under pages: "Read the plate again", "Look at the drawing again".

**The jump:** A.U.R.A.: "We still have a stop left here, Commander. Jump anyway?" · "1 Jump now  −8 energy −5 rations" · "2 Not yet"

**Sector 5:** title "The Tally" · A.U.R.A.: "We are through the jump, Commander. I count 21,483 beacons on this heading." • · VANCE: "Twenty-one thousand beacons. So where are all the ships?" • · JAXON (from engineering): "We're low on power. Pick our stops carefully." · notes: Kryos-0 Alpha / An ice world. A wreck on it sends hull number 14,086. • / 5 energy · uses a stop · one more after this · Kryos-72 Proxima / A station built by a later ship. No power. • / 5 energy · uses a stop · one more after this · Chronos-61 IV / A dead rock. Three dead ships circle it. • / 6 energy · uses a stop · one more after this · Aea-64 Alpha (behind): nothing.

**Sector 6:** title "The Light" · JAXON: "That light ahead. I'm reading no heat off it." • · A.U.R.A.: "Nothing is charted past this sector, Commander. The heading ends at the light." • · the light's note: The light / It looks like a sun. It gives no heat. • / the end of the heading · on click, ARIS: "It looks warm. Nothing out here is warm." • · in front of it, A.U.R.A.: "We are holding position, Commander. I cannot tell you what happens if we go closer." • · "Go into the light" / "What you choose there is final" •

**The Esc menu:** Resume · The ship's record · Sound · Save · Quit

---

## 4. How it maps onto the real game later

The rules underneath stay as they are: stops, forward only, the contact reveal, dating, the team trips, the `req-action` events and the DeckPanel targets. What changes is where things are drawn. The prices only read right once ECONOMY.md section 3 is in (warps 4 to 6, jump 8); that work is not counted here.

| step | files | hours |
|---|---|---|
| one shared copy of the picture recipes (the mockup's section 1 merged with SceneArt's helpers) | new `src/systems/dither/PixelPaint.js`; `SceneArt.js` uses it | 4 |
| the sector painting: places, notes, warm curve, click to fly, the flight, forward-only fading | new `src/views/GameScreen.js` replaces `NavView.js` and `NavVista.js` | 14 |
| six enormous things (three come from the mockup) | new `src/systems/dither/SectorPaintings.js`; a key per sector in `SectorConfig.js` | 15 |
| orbit full screen, the action beside the beacon, the lander, the dissolve | `OrbitView.js` (layout and buttons go), `OrbitVista.js` (8 x 8 dither, 640 x 360) | 10 |
| words in the scene: anchored voice lines, the soft darkening, chips, sector title; scenes as film with first names, no colours | new `SceneText.js`; `EncounterCard.js`; `AuraSystem.js` (routine reports to the record) | 10 |
| the page and the star map over the dimmed world; the record as a logbook | `FoundPage.js`, `DiscDocument.js`, `minigames/DiscDating.js` (the star map against real stars), `MissionLog.js` | 6 |
| the horizontal cutaway, five rooms, supplies by the rooms | `ShipCutaway.js` (Fabrication goes), `DeckPanel.js`, `RosterPanel.js` | 10 |
| the new walking figures, poses and little routines | new `src/systems/CrewFigures.js`; also used by `LanderCrew.js` | 10 |
| the jump from the light, the stretch, the arrival title | `bundle.js` jump code; `WarpPlot.js` and `minigames/Corridor.js` stay | 3 |
| remove the header, side panels, log strip and coach bar; the Esc menu; reroute the bundle.js events | `index.html`, `bundle.js`, `Coach.js` (one hint beside a thing) | 12 |
| check at 1920 x 1080 and 1280 x 720, all six sectors, as a player | | 5 |
| **total** | | **about 100** |

**Suggested order:** the mockup first, about 16 hours, for your verdict. Then a sector 1 slice in the real game (the first two rows, the giant, orbit and words in the scene), about 30 hours. Judge it in play before the rest.

**The walking models** do not have to wait. They can go into today's ship panel first, about 8 hours, and move into the new cutaway later. If "focus later" is the call, they are the smallest piece worth doing now.

**Risks to watch:**
- Without labels a new player may not know worlds can be clicked. The names showing on arrival and the one hint should cover it. Check with someone who has never played.
- Words over a bright picture, mostly in sectors 5 and 6. Handled by choosing the darkest place and shading the sky only (2026-10-08); still check them at real size, live, with animation running.
- A misclick spends energy. The 1.2-second cancel has to work every time.
