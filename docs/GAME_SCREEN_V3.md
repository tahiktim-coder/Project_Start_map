# The game screen, v3 (2026-10-08)

v2 (`prototypes/screens/game-screen.html`, spec in docs/GAME_SCREEN.md) is replaced. This page covers what went wrong, the v3 design, the rules that keep it consistent, and the build spec for `prototypes/screens/game-screen-v3.html`. The content decisions in docs/SCREENS_RETHINK.md and the prices in docs/ECONOMY.md section 3 still stand.

**Revision 2 (2026-10-08, after a review of the first v3 build).** The first build still floated, shrank the planets in orbit, hid where to go, and broke continuity in the pull-in and the ship view. What changed is listed in section 6 at the end; the sections below describe the page as it is now.

## 1. What v2 got wrong

Your words: "continuity problems", "you downgraded planets", "we just float in space", "am I supposed to go to the one near us or the far light?"

- **Planets got worse up close.** The palette and `sphere()` were the same as v1. The light was the problem: in orbit every world was lit from behind, so Titan turned into a dark mud dome with a thin orange rim. Orbit also showed only a cap of the world (radius up to 500, centre below the frame). The gas giant lost its ring, storm and hulls the moment you arrived. In the sector, worlds were pebbles next to our ship (Titan about as wide as the hull), and their names were gone.
- **Nothing matched.** Three ships: the old hull A in space, a sideways cutaway with the old 12 x 24 figures, and the Lander you actually chose. The ship stayed the same size while the planet grew fifteen times. Arriving was a dissolve that flipped the ship into a corner. The light jumped from a mid-right spark to the top-right corner and moved behind the planet. Leaving orbit made the ship appear beside the world. The jump went from sector 1 to sector 5, reset the supplies (you left with 87 energy and arrived with 22), and arrived with history you never played. "Take the lander" contradicts a ship that is itself a lander.
- **We floated.** The sector was one still painting. The ship parked at a third of the way across and bobbed. Flying to a world was a sprite sliding over a backdrop. Only the jump's star stretch felt like movement.
- **The choice was unclear.** The goal (the light) was the smallest thing on screen, half hidden by the giant. There was no heading, the worlds floated in a loose cluster, and distance on screen meant nothing for cost. The forward-only rule was invisible until it closed the sector on you.

**Kept from v2:** full-bleed space as the control; no panels, headers or scorecards; words in the scene on a dither shade; the warm course curve; rim on hover; the red beacon; the contact that grows into a world; the giant, the river and the light's face; the voices, A.U.R.A.'s questions with cost chips, the film, the found pages, the record, dating; whole-number pixel scale and our own clock (`step()`, `?t=`). The Chronos orbit is the look every orbit should match.

## 2. The v3 design

### The travelling view

**We are always flying toward the light.** One camera, behind and beside the Lander, looking ahead: it flies nose first, left to right, toward the light, which sits low on the right horizon and never leaves the screen. Everything that moves comes out of the light: worlds, dust, streaks. The ship rests about 35% across and a little below the middle, nose on the light. The screen shows more of what is ahead than what is behind.

**You can feel the movement.** Space streams past in layers, all on rays out of the light, as a forward view would show it. A speck's distance from the light grows exponentially, so far ones crawl near the light and near ones rush past the frame edge (`flowField`):

| layer | speed at our ship (× ship) | what it is |
|---|---|---|
| far stars and haze | 0.02 (sideways) | v1's sky, barely moving |
| the light, the sector's enormous thing | 0 to 0.12 | barely moves, so it reads as far and huge |
| mid stars | 0.1 | `ShipArt.stars(1)`, the living ship's own tile |
| dust motes | about 0.7 | rust specks, brightest where the light reaches |
| streaks | about 2 | 260 specks with tails; tails stretch with speed and shrink to dots when we stop |
| near dust | about 3.5 | 34 brighter specks, some two pixels wide, passing in front of our ship |

At cruise about 1.8% of the screen's pixels change every quarter second, three times the first build.

The ship itself never stops moving. It drifts a few pixels and rolls slightly on slow sines (settling in again after orbit). Its tail plume is twice the first build's length and flickers through four frames in length and brightness, in the living ship's own blue (`R.PLUME`). The plume's cold light catches the underside of the skirt. Exhaust specks peel off and fade. A soft, curved, dithered wake trails behind. Lit portholes show where people are: the living ship's simulation (`ShipSim.at`) runs underneath, so if Vance walks down to the hold, the hold's porthole lights. The bridge always glows a little (its screens never go off), brighter when someone is on it. At lane and orbit size the hull is drawn in clean bands without dither noise, with the nose cone's seam marked, so it reads as a nose and not a capsule.

**Near and far follow one rule: a world on our lane, lit by our searchlight, is a stop. Everything else is scenery or the goal.** Every cue agrees with it:
- Stops come along the ship's lane, in the lower and middle part of the screen. Scenery sits higher, toward the horizon.
- Stops pass at the ship's speed. Scenery and the light crawl.
- Near worlds get the full `sphere` + `surfaceFor` picture. Far ones are flat dither, fewer colours, and tinted toward the haze.
- Stops pass in front of the scenery.
- Only stops in reach change the cursor.

**How a world comes up** (Sunless Sea's islands at the edge of the lamp):
1. **A glint.** A small tinted cross with a dark collar: ice blue for ice and the unknown contact, warm amber or dust for dry and rocky worlds, steel for a station. It swells and fades slowly, unlike a star's quick twinkle, and never sits on the light itself. All the worlds left in the sector already show as glints or tiny discs fanned out from the light along the lanes they will come down, closer to the light the further ahead they are. You can count them if you want. Nothing counts them for you.
2. **A disc.** It grows and swings out from the light toward our lane: a small dithered disc, haze-tinted, with its lit side toward the light.
3. **The full world**, as big as it gets, as it reaches the lane beside us. Its name and tag appear beside it, as in v1 ("Titan-61 IV · Old transponder"). Our searchlight finds it: warm dust lights up as it drifts out along the beam from the bridge, and the lit edge of the world brightens (no cone, nothing that looks like the course line). The ship slows to half speed (the streaks shorten), so you have a calm ten to fifteen seconds to decide. A.U.R.A. speaks only when there is something to say, such as a beacon, a station or a contact.

**Choosing.** Point at the world. Its rim brightens, and the Lander turns its nose a few degrees toward it while the warm course curve runs from the nose and fades before it reaches the world. A note shows the name, one plain line and the cost. **The cost is the gap you can see:** a world close to our lane costs 4 energy, one far off it costs 6. Pointing or a voice line never changes the speed: on the lane the ship never goes below its slow speed, and a world stays in reach until it slides past our tail, so it never becomes a reflex test and never turns back into floating. Take the pointer away and the nose swings back to the light. Click to pull in (next section).

**Passing.** Let a world go and it slides past our tail. It turns grey and cold, glides back along the wake to rest near the left edge at less than half its size, and stays there in sight for about 17 seconds before it slips away. Its name fades and it stops answering. The first time this happens in a sector, A.U.R.A. says so while the world is still on screen. Clicking a passed world gets "We passed it" once (not straight after her first line). Forward-only shows on screen: the worlds behind us are grey, the ones ahead are coloured glints.

**The light is the end of the sector and the jump.** After each place you pass it grows by 13%, so it has doubled by the jump (sector 1: core 2 to about 4, halo 14 to about 29). Sector 2 starts bigger still (core 5, halo 34), and so on, from a sharp warm star in sector 1 to the face that fills the right of the screen in sector 6. It is never a meter. It is a place, and you are getting closer to it. It is the same light in every sector, so no line calls it a star or says a sector has none.

**Stops left** come up in words at the moment they matter: in the cost note ("uses a stop · one more after this"), and from A.U.R.A. as you leave orbit. When no stops are left, the searchlight goes dark, the worlds ahead slide by unlit, and pointing at one says "No stops left before the jump".

**One enormous thing per sector,** on a slow layer, drifting across the frame exactly once over the whole sector. Sector 1: the ringed giant Kryos-68 Prime (`paintGiant`). It starts as a limb rising behind the light's lower right. Halfway through the sector, its cloud tops pass right under our lane with the ring sweeping round behind us, and for those seconds the searchlight finds it: it is the fuel stop. The ring is lit with the body's own dust gold, dimmer and thinner than the first build's grey-blue band; the hulls caught in it are small. (The ring passes behind our lane, not over it: drawing it in front of the ship needs a second ring layer, left for later.) Its words go in the open sky above our ship, clear of the ring and the limb. Then it falls behind. Sector 2: the rogue world (`paintRogue`), a black disc where the stars stop, with a thin ice edge on the side facing the light.

**At rest, on screen:** stars and dust streaming, the light ahead, the enormous thing somewhere on its slow pass, the Lander burning with its lit portholes and its wake, the glints of the worlds to come, and at most one world in reach with its name. No words beyond that.

### Arriving in orbit, and leaving

There is no cut. Clicking a world takes about 3 seconds:
- The course locks, someone aboard reacts, and you have 1 second to cancel.
- The burn flips, the ship brakes, and the streaks shrink to dots.
- The camera pushes in on the same planet drawing and the same ship until the world fills the frame. That is the orbit.

It is one camera move, applied to every layer (`camAt`). The world grows to v1's orbit size, its diameter about 86% of the screen height (a per-world factor: Titan about 3.4×, Rhea and Zephyr about 3.9×, Chronos about 2.7×; a station 3×). Everything else is scaled about the same point at its own depth: worlds beside us move as much as the world, glints near the light hardly at all, the giant and the small moon at half rate, carried out of frame, the giant fading out through the dither. The streaks come out of the world instead of the light and spread apart, as a zoom spreads them. The light stays exactly where it was on screen, because it is far away. Our ship flies in toward the world, so it grows less (2×) and holds station in open sky on the side it came in from, nose toward the light. The world is lit from the front side, as v1 was: you see most of its lit face, Titan's dunes and Kryos's belts and storm, never a dark dome. The orbit framing is v1's: a whole round world (cut by the frame at most a little), right of centre with the light clear beside it. Titan keeps v1's furrow beside its beacon. Kryos is pushed in on about the point of its limb under us (2×).

A voice line that is open when the push starts fades out, waits, and comes back where our ship ends up, so it never chases the ship across the screen.

Orbit itself works as in v2: the place's name in the corner away from our ship, the action written in the sky beside the beacon with a thread down to it, "Leave orbit" under our ship (it never hides; voice lines move round it), the film, the found page and dating with the star map. When the team goes down, the shuttle (see question 1 at the end) unclamps from the hull beside the hold and drops to the beacon.

**Leaving plays the same move backwards.** The camera pulls back, the burn relights, the ship rejoins the lane at its usual place with its nose back on the light, the streaks stretch out again, and the world slides behind us and goes grey. Its tag now says what we did there ("We searched the wreck", "Tanks filled here"), or "We stopped here" if we left without doing it. A.U.R.A. says how many stops are left.

### The jump

When the last world has passed, A.U.R.A. says the jump is ready and the light starts answering the pointer. Clicking it earlier makes her ask first, because worlds are still ahead. Jumping:
- The burn runs to full, and every streak stretches toward the light over six stepped frames (v2's `drawStretch`).
- A white-gold flash, then black. In the game, the corridor plays here.
- The next sector fades in with the stars already moving and the ship already in its place, still burning. No sliding in from the left edge, no stopping dead.
- Supplies carry over. The record says what the jump really cost.
- Sector 1 goes to sector 2. Every sector, in order.

### Words

As in v2 (docs/TEXT_SYSTEM.md, docs/STYLE.md): one line at a time beside whoever speaks, on a dither shade over the sky only, never over a world, 40 words at most on screen. Crew by first name. A.U.R.A. reports results in words (stops left, the jump, what a stop gave us). There are no score panels. Routine lines and crew remarks go to the record.

### The ship view: the living ship

Click our ship or press E. The camera closes on the hull, and the hull turns a quarter turn so its nose points up. The whole world turns with it about our ship (the light moves round to above the nose, so the hull stays lit from the same side), and the sector's sky dissolves into the living ship's own star tiles: forward is now up, so the stars stream downward, the same tiles as inside. The hull is the same drawing all the way (`paintLander`: same light, never mirrored, the drive still burning, the occupied decks' ports lit, the bridge windows glowing), with plating when it is seen close. The plating falls away through the dither, and you are in `crew-hires/ship-life.html`: six decks (bridge, lab, quarters, med bay, hold, engineering), the five crew in the new 48 x 104 sprites, their routines, what they say when you click them. Supplies are written beside the rooms they belong to: energy by engineering, rations and salvage by the hold. A damaged deck shows red. Esc plays it backwards, and you are flying again.

**Your question about two kinds of visuals:** there is one ship and one crew. Outside you see the hull and its lit portholes, and the same simulation decides which ones are lit. Inside you see the people. The travel view never draws crew figures, so this costs nothing in speed. Nothing is drawn twice.

## 3. Continuity rules

1. **One drawing per thing.**
   - Our ship is always the Lander (`paintLander`: `hull(..., shapeL)`), one recipe for the lane, orbit, the shuttle and the turn into the ship view, with the living ship's proportions: nose cone about 23% of the length, decks 69%, skirt 8%, width a third of the length (ship-study's `shapeB` is thinner, about 4.6 to 1, and gets re-proportioned to match).
   - Every wreck is the Lander rusted, standing where it came down (`wreckB`), including EXODUS-4 in the stockpile film.
   - Every world is `sphere` + `surfaceFor` from main-screens.html, using v1's gentler gas bands, not v2's harsher ones.
2. **No cuts between places.** Sector to orbit, orbit to sector, and outside to inside are camera moves on the same drawings. The only fade to black is the jump.
3. **One light.** It sits at the same spot on screen in every view of a sector. Each world's light direction is worked out once (`lightVector`, with the light in front of the picture, lz about +0.25, never below 0) and used both on the lane and in orbit. Inside the ship, it comes from above the nose.
4. **One camera.** Every layer moves with the camera at its own depth; nothing stays pinned while the camera pushes. Our ship flies in toward a world, so it grows less than the world (2× against about 3×). It is never bigger than a world on the lane and never smaller than about a quarter of one in orbit.
5. **What a line says, the screen shows.** A gain chip shows what you actually got (the tanks cap at 100: "+6 energy · tanks full"). The record uses the real numbers. Nobody mentions a stop, a jump or a hurt person the player did not see. "We passed it" is said only while the world is still on screen. Nobody calls the light a star. Every deep link tells the same supply story (start 100 / 25 / 50; Titan −5 energy, +30 salvage; Kryos −6 then +11 to full; the jump −8 energy −5 rations: sector 2 opens at 92 / 20 / 80).
6. **One heading.** Sectors run 1 to 6 in order, and supplies, damage and the record carry across every jump.

## 4. Build spec: `prototypes/screens/game-screen-v3.html`

One page, no build step, silent (sound only with `?sound=1`). The canvas is 640 x 360 at a whole number of device pixels per art pixel (v2's `measure()` and `G`). It runs on our own clock: `window.step(ms)`, `?t=ms`, plus `?speed=4` and a held F to fast-forward while judging. There is no mockup bar. The backtick key opens the list of moments, and each moment also has a deep link. Ink `#05070a`, world palette Deep field, words Graphite and IBM Plex, as in v2.

### The moments

| link | what it shows |
|---|---|
| `#s1` | Sector 1 from black. Space already streaming out of the light; the Lander burning at 35%; the light low on the right, with the worlds to come fanned out from it as tinted glints and tiny discs; the giant's limb low on the right. The title "The Graveyard" holds 3 s. Three voice lines. |
| `#reach` | Platform Zeta comes up: glint, disc, full station. Its name shows; the searchlight finds it; the ship slows. The one-time hint. Pointing shows the nose turn, the curve and the note. |
| `#pass` | We let Platform Zeta go: it slides past the tail, greys out and rests, shrunk, near the left edge for about 17 s. A.U.R.A.'s first-time line while it is in sight. Clicking it right after says nothing more. |
| `#orbit` | Titan-61 IV in reach, click: the course locks, Mira reacts, the burn flips, the camera pushes in to orbit. Send the team (the shuttle drops), the stockpile film, the star map page, dating; the contact ahead becomes Rhea-4 Minor. Leave orbit: the pull back, Titan slides behind. |
| `#giant` | Mid-sector: the giant's cloud tops under the lane, the gold ring sweeping round behind us, small hulls caught in it. Skim fuel: the same push-in, toward its limb. The chip shows the real gain (+11, tanks full); its tag then says "Tanks filled here". |
| `#ship` | Click our ship: push, quarter turn, plating falls away, the living ship (normal state). Esc: back to flying. |
| `#jump` | The last world passes and stays in sight, grey; A.U.R.A. says the jump is ready; the light has doubled since the sector began; click the light (energy 100 → 92); the stretch, the flash, black. (Clicking it early instead: her question with chips.) |
| `#s2` | Sector 2 fades in still moving: the light clearly bigger than at the jump, the rogue world's black disc rising where the stars stop, the first world. Supplies 92 / 20 / 80, the same as after `#jump`. |
| `#record` | L: the ship's record, written in order (sector 1, then sector 2), opening at the latest page like a logbook. |

### Positions and timings (art pixels, 640 x 360)

| | value |
|---|---|
| the Lander | rests at (224, 196), len 48, ht 15; nose on the light; drifts ±2 px and rolls ±2° on slow sines; in orbit len 96 |
| the light | (604, 158), the point everything comes out of. Sector 1 starts at core 2, halo 14; ×1.13 after each place passed (doubled by the jump); sector 2 starts at core 5, halo 34 |
| the lane | worlds reach their closest point between x 360 and 440, centre 30 to 110 px off the ship's line (that gap is the cost: 4, 5, 6 energy) |
| world size at its closest | radius 40 to 58 (a moon to an ice world; Rhea 40); in orbit the diameter is 86% of the screen height (radius 155) |
| speed | cruise 52 px/s on the stop layer; 26 px/s while a world is in reach (eased over 0.5 s); never lower on the lane; 0 in orbit; 5 px/s only while looking inside the ship |
| a world's life | glint to reach about 20 s; in reach from about 2 s before its closest point until it passes our tail, about 13 s at slow speed; passed, it rests in sight for about 17 s, then slips away in about 3 s; a new world about every 16 s |
| approach curve | k = (light.x − passX) / cruise; at d seconds ahead, size f = k / (k + d), radius = full × f^1.4; place fp = sqrt((k/2) / (k/2 + d)), x = light.x − (light.x − passX) × fp, y likewise. fp meets the closest point at the same speed as f, but keeps far worlds spread out from the light. Glint while radius < 1.5, flat disc while radius < 8, full sphere after. Passed: x = passX − τ(1 − e^(−s/τ)) with τ = passX − restX, gliding to rest near x 30–60, radius down to 45% |
| pull-in | 1.0 s to cancel, 0.6 s burn flip, 1.6 s push (eight steps: zoom Z^e for the world and every layer at its depth, 2^e for our ship), then the orbit words |
| leaving | 1.4 s pull back, 2 s to rejoin the lane |
| the ship view | 0.8 s push with the quarter turn, 0.6 s plating dissolve |
| the jump | 1.5 s burn up, six stretch frames over 0.75 s, 0.4 s white-gold, 1.2 s black, 1 s fade into sector 2 |
| moving details | blink, twinkle, plume and walk cycles at 8 fps; the scroll every frame, snapped to whole art pixels |

### Code to reuse, by name

- **main-screens.html, as it is:** `seeded`, `vnoise`, `fbm`, `threshold`, `level`, `ramp`, `RP`, `PLANET_RAMP`, `painter`, `framer`, `keepVisible`, `twinkle`, `spaceAndDust` (the dust lit by the light), `lightGlow`, `sphere`, `surfaceFor` (v1's gas bands), `lightVector`, `drawStation`, `contactBlip`, `shade`. Lift these from `orbitPlanet`: its light recipe, the beacon on the night side, the furrow. Lift these from `paintOrbitFrame`: the focal light blinks. Lift from the `SECTORS` data: the places, tags, lines and reactions.
- **main-screens.html, not used:** `hullEdges` and `drawHull` (hull A), `mapForeground`'s heading line and ticks, `buildOrbit` (orbit is now a camera move, not a separate painting), `shipLayout`, `buildShip`, `FIGURE`, `figure`, `renderHud`, `renderLog`, `renderAct`, `paintThumb`.
- **ship-study.html:** `hull`, `cyl`, `radiusB` (re-proportioned), `shapeB`, `B_DECKS`, `stencil` ("EXODUS-9" once the hull is long enough to show it), the drive and window from `inSpace`, `dust` (the motes), `wreckB` and `wreckPicture` (the stockpile film's wreck).
- **crew-hires/:**
  - `engine.js` and the five person files.
  - `ship-art.js` (`ShipArt.L`, `deck`, `nose`, `tail`, `stars`, the `R.PLUME` ramp).
  - `ship-rooms.js`.
  - `ship-sim.js` (`ShipSim.at`, `line`, `STATES`).
  - From ship-life.html: `drawSpace`, `render`, `fx`, the deck camera and the click handling. The study control goes. Its boxed speech bubble is replaced by the v2 voice line, so people speak the same way inside and out.
- **game-screen.html (v2) and game-screen/:**
  - Screen and clock: `measure`, `G`, `after`, `advance`.
  - The two enormous things: `paintGiant`, lit from the front so its face shows, and `paintRogue`.
  - Pointing at a world: `courseTo`, `arcPoints`, `drawCourse`, `drawHover`, and the contact's reveal (from `drawPlaceMotion`).
  - The record, in order for v3: `reading.js` takes `World.recordInOrder` (v2 keeps newest first).
  - Pixel lettering: `FONT`, `pixelText`.
  - Words in the scene: `shadeSprite`, `skyMask`, `drawShades`, `word`, `placeWords`, `chips`.
  - The jump: `drawStretch`.
  - Orbit actions: `playFilm`, `startDating`, `DATE_STARS`.
  - Story data: `SCENE_STOCKPILE`, `PAGE_DISC`, `PAGE_PLATE`.
  - Modules: `reading.js`, `pages.js`, `reading.css`.
  - Not used: `sectorPainting` as one still, `SHIP`, `shipSprites`, `drawShip`, `ORBIT_AT`, `orbitPainting`, `settleShipAt`, `transition`, `fresh`, `drawLander`, `shipview.js`.
- **New (as built):**
  - The stream of worlds: `geom` (approach, closest point, passing and resting), `drawGlint`, `flatDisc`.
  - The motion: `flowField` with `FLOW.motes`, `FLOW.streaks` and `FLOW.near`; `drawWake`, `drawExhaust`, `drawPlume`, `drift`, `drawSearchlight`.
  - The Lander: `paintLander` (one recipe), `landerSprite` (cached every 2 degrees), the ship view's `shipViewFrames` and `shipFramePicture`.
  - The windows: ports and bridge windows lit from `Inside.occupied` (`ShipSim`).
  - The camera: `camAt` (the pull-in, every layer at its depth), `orbitLayout`, `viewRoll` and `rolled` (the ship view's roll).
  - Words: `World.luma` samples the box every few pixels against worlds, the giant and its ring, our ship, the light and "Leave orbit"; labels step further out when every near spot is busy.
  - The rest: `shuttle`. (`engineSound` is not built.)

### The lines (• = from v1/v2, the rest new; all follow STYLE.md)

- **Sector 1 opens.** A.U.R.A.: "Good morning, Commander. All four crew are awake and well. The ship is in one piece." • · Aris: "Everyone is up. Sixty-one years, and nobody even feels hungry." • · A.U.R.A.: "I hear one old ship beacon on our route, Commander." • · the one-time hint beside the first world in reach: "Click a world to stop there. Once we pass it, it's gone."
- **Tags in reach.** Platform Zeta · Old station • · Titan-61 IV · Old transponder • · Kryos-68 Prime · Gas giant · fuel • · Chronos-37 Proxima · Ice world • · Unidentified contact · No fix yet •, which becomes Rhea-4 Minor · Grey moon · their last course · Zephyr-97 X · Dead rock •
- **Notes** (name / line / cost). The v2 lines • with the new costs: Zeta 4, Titan 5, Chronos 5, Zephyr 6 energy · uses a stop. Kryos: 6 energy · uses a stop · fills the tanks. Rhea: no energy, we have their course · uses a stop. Late in the sector: "uses a stop · one more after this" • and "our last stop before the jump" •. With none left: "No stops left before the jump". Our ship: "Energy 100 · Rations 25 · Salvage 50" / "Click to look inside" •
- **Reactions on click.** The v2 lines • (Mira on Titan, Vance on Zeta, Jaxon on Kryos, Aris on Chronos, A.U.R.A. on Zephyr). A cancel gets A.U.R.A.: "Holding course, Commander." •
- **Passing.** A.U.R.A., the first time in a sector: "We passed Platform Zeta, Commander. We can't turn back." · clicking a passed world: "We passed it, Commander. The ship only flies forward." •
- **Orbit, Titan.** As in v2 •, except the team line: "Vance and Aris take the shuttle". The film, the drawing, dating: as in v2 •.
- **Leaving orbit.** A.U.R.A.: "We can make two more stops before the jump, Commander." • / "We can make one more stop before the jump, Commander." • / "That was our last stop before the jump, Commander."
- **The jump.** At the end, A.U.R.A.: "That's the last world on this heading, Commander. The jump is ready." · the light's note: The light ahead / Jump to the next sector. / 8 energy · 5 rations • · clicked early, A.U.R.A.: "There are still worlds ahead, Commander. Jump anyway?" with "1 Jump now −8 energy −5 rations" / "2 Not yet" • · the record: "Jumped from the Graveyard. The crew ate 5 rations. 20 left." (the real numbers)
- **Sector 2.** Title "The Dark Void" · A.U.R.A.: "We are through the jump, Commander. The light ahead is closer now." · Mira: "Something ahead is blocking the stars. It's a planet with no sun." · first tag: Hyperion-9 Minor · Frozen moon ("A frozen moon. It has no sun of its own."; Aris: "Nothing should live out here. I want to be sure."; in orbit: "A frozen moon. Only the light ahead reaches it.")
- **Tags after a stop** (what we actually did): Zeta "We boarded it" · Titan, Rhea "We searched the wreck" · Kryos "Tanks filled here" · Chronos "Only ice" · Zephyr "Nothing there" · if we left without doing it: "We stopped here".
- **Ship view.** The routine lines in `ship-sim.js` (normal state) •. Room words: Bridge · Lab · Quarters · Med bay · Hold · Engineering. Beside engineering: "Energy 87". Beside the hold: "Rations 25 · Salvage 50". Real numbers throughout.

### Controls

| input | does |
|---|---|
| point at a world in reach | rim, nose turns, warm curve, note; the speed does not change |
| click it | pull in (1 s to cancel by clicking empty space or Esc) |
| click a passed world | "We passed it" once, then nothing |
| click the light | the jump (asks first if worlds are still ahead) |
| point at / click our ship, E | supplies line / the living ship |
| Space, Enter, click | next line |
| Esc | cancel, skip to the choice, close the ship, page or record; otherwise the menu (Resume · The ship's record · Sound · Save · Quit) |
| 1, 2 | choose |
| L | the ship's record |
| Tab | step through the worlds in reach |
| ` and F (mockup only) | the list of moments; hold to fast-forward |

**Checking:** screenshots at 1920 x 1080 and 1280 x 720 from a temporary local server and headless Chrome, several frames per moment through `step()`, because motion is the point. Judge them at full size, as a player would, before calling it done.

## 5. What carries into the real game later

| step | files | hours |
|---|---|---|
| one shared copy of the picture recipes (main-screens + SceneArt + ShipArt helpers) | new `src/systems/dither/PixelPaint.js` | 4 |
| the Lander everywhere: hull, wrecks, landing sites, corridor hulls | `SceneArt.js`, `LanderSites.js`, `minigames/Corridor.js`, `MiniShip.js` (SHIP_STUDY.md) | 16 |
| the travelling view: layers, stream, lane, reach, searchlight, passing | new `src/views/GameScreen.js` replaces `NavView.js` and `NavVista.js` | 18 |
| worlds as an order along the heading, cost by distance from the lane, forward-only as "passed is gone" | `PlanetGenerator`, `StoryPlanets.js`, warp code in `bundle.js` | 5 |
| six enormous things on the slow layer | new `SectorPaintings.js`; a key per sector in `SectorConfig.js` | 15 |
| orbit as a camera push on the same drawings; actions in the sky | `OrbitView.js`, `OrbitVista.js` | 10 |
| words in the scene, the film, pages, record | `SceneText.js`, `EncounterCard.js`, `FoundPage.js`, `DiscDocument.js`, `MissionLog.js` | 12 |
| the living ship as the ship view | `ShipCutaway.js` and `DeckPanel.js` replaced by the crew-hires modules | 12 |
| the jump keeps supplies and order; the arrival keeps moving | `bundle.js` jump code; `WarpPlot.js` and `Corridor.js` stay | 3 |
| engine drone and world tones, silent under `?mute=1` | `AudioSystem.js` | 4 |
| remove header, side panels, log strip, coach bar | `index.html`, `bundle.js`, `Coach.js` | 10 |
| check all six sectors at real size, in motion | | 6 |
| **total** | | **about 115** |

Order: first the mockup (about 18 hours) for your verdict, then a sector 1 slice in the real game: travel, one pull-in, the jump into sector 2 (about 35 hours).

## Questions for you

1. **The shuttle.** Our ship is the Lander and lands only once. Team trips need a small craft. I propose calling it "the shuttle": a tiny copy of our hull, clamped beside the hold, visible outside, in orbit and on the living ship's hold deck. The line becomes "Vance and Aris take the shuttle." Yes?
2. **Pressure from behind** (the dark thickening at the left edge each time you stop) is left out of v3. It would be a new mechanic, and it is too close to a doom meter. Say if you want it tried.

## 6. Revision 2: what changed after the review of the first build

| problem in the first build | what the page does now |
|---|---|
| The ship nearly stopped (5 px/s) whenever a line was open and a world was in reach, so every stop turned back into floating | Never below 26 px/s on the lane; pointing and talking never change speed; a world stays in reach until it passes our tail |
| Motion too weak (0.6% of pixels changing per 250 ms), and a split camera: worlds came out of the light while streaks slid sideways | Motes, streaks and near dust all stream out of the light on one forward camera (1.8% per 250 ms at slow speed); plume twice as long with a clear flicker; the ship drifts and rolls; near dust passes in front of it |
| Passed worlds left the screen in 3–6 s; "We passed it" was said over empty space | Passed worlds rest, grey and shrunk, near the left edge for about 17 s; the line is said while they are in sight; no second line straight after it |
| Glints looked like stars; the light grew from core 2 to 2.9 over a sector; sector 2's light looked like sector 1's | Tinted, slowly swelling glints with a dark collar, spread out from the light; the light doubles over a sector; sector 2 starts at core 5, halo 34 |
| The pull-in scaled only the world and the ship; the ship flew over the planet | One camera move for every layer at its depth; the giant and the moon are carried out and fade; the ship stays on the side it came in from |
| Orbit worlds were smaller than v1 (Titan 53% of the height, Rhea 36%) and the frame was cluttered | Every world's diameter is about 86% of the height in orbit; Rhea's radius is 40; the giant's ring and the moon leave the frame |
| The ship view swapped drawings, mirrored the hull and dropped the plume | One recipe (`paintLander`), same light turning with the camera, never mirrored, plume burning, ports and bridge lit, plating when close; the world rolls with the hull and the sky dissolves into the living ship's star tiles |
| "There is no star in this sector" over a bright star; Hyperion "far from any star" lit by it | Lines now talk about the light ahead; the light is the same in every sector |
| Grey-blue ring with rust lumps; muddy brown searchlight wedge | Ring in the body's own gold, thinner, small hulls; searchlight is lit dust drifting along the beam plus a brightened rim |
| Words on the ring and the limb; "Leave orbit" hid behind voice lines at 720p; voice lines jumped during the pull-in | Word placement samples the ring and the limb; the giant's words sit in the sky over our ship; "Leave orbit" never hides; lines fade out during the push and come back beside the ship in orbit |
| `#jump` arrived with 81 energy and `#s2` with 92; Kryos still said "Gas giant · fuel" after skimming; the record opened on sector 2 | One scripted history (92 / 20 / 80 after the jump in both); visited tags say what we did; the record reads in order and opens at the latest page |

**Not done, and why:** the giant's ring passes behind our lane rather than arching over the ship (drawing it in front needs a second, front ring layer; it can come with the real game's `SectorPaintings.js`). The far sky still slides very slightly sideways (0.02) rather than holding still; it is too slow to read as a second camera. The ship view's close frames are still the procedural hull with plating rather than the living ship's own painted exterior, which does not exist yet.
