# Sector 1 slice: the build spec (2026-10-10)

A playable prototype of sector 1, from waking to sector 2's arrival, at `prototypes/slice/`. Four builders work in parallel,
each in their own files; one integrator wires them. The design is GAME_FLOW.md, SHIP_GAMEPLAY.md rev 2 (steps 1 to 4),
ROUTE_AND_LIMITS.md, ECONOMY.md §3, GAME_SCREEN_V3.md, STYLE.md, ART_STYLE.md, CREW_SPRITES.md, script/sector-1.md.
**What changed from those:** the designer's 2026-10-09 notes. Sector 1 is a **place**, not a path: a field of worlds ahead
around the ringed giant, all in sight from the start, drawn as the game's dithered worlds with their own vibe. No lines,
no labels at rest, no diagram look. You click a world and the ship takes you there. The fork rules stay underneath.

## 1. Files and owners

| file | owner | draws into | reuses, by loading (never copied, never edited) |
|---|---|---|---|
| `index.html` | integrator | the page, the loop, input routing, stills, MOCKUP menu | every file below, in the order already in the page |
| `state.js` | state-and-script builder | nothing (state, clock, bus) | |
| `script.js` | state-and-script builder | `canvas#shade`, `#reading` | `game-screen/reading.js`, `pages.js`, `reading.css`; lines in `V3Data` |
| `world.js` | world builder | `canvas#world`, `#world-words` | `game-screen-v3/paint.js`, `sky.js`, `sky2.js`, `data.js` |
| `ship.js` | ship builder | `canvas#ship`, `#ship-words` | `crew-hires/*` (engine, five people, ship-art, ship-rooms, ship-reactor), `layouts/variant-a/sim-a.js`, `tower.js` |
| `stop.js` | stop builder | `canvas#dive`, `canvas#bridge`, `#stop-words` | `layouts/variant-d/bridge-art.js`, `crew-sim.js` (SPOTS only), `CrewEngine`, `V3Paint`, the real minigames |

Hard rules for everyone: draw only into your own layers; never edit a reused file (other pages use them); never re-make a
minigame; never copy a big block of code (a 10-line helper is fine; a recipe is loaded and called); no `Math.random` (use
`Slice.rand(seed)`); no AudioSystem, no sound; no git add, commit or push. Check pages only with a temporary static server
on your own port and headless Chrome with its own profile (never port 8000, never the browser pane), and stop it after.

## 2. The screen

**Layout A (travelling), one art pixel size:** `k = max(1, floor(deviceHeight / 540))`, so at least 540 art rows show.
1920x1080: k 2, art 960x540. 1280x720: k 1, art 1280x720. The tower's outside edge is `G.hull`; `G.offX = round(0.42 W) -
669` (669 = `L.CX + L.HO + 9`), and space keeps at least 55% of the width (both sizes: 57.9%). Space is everything right of
`G.hull`; positions on it are `u` (0 at the hull edge, 1 at the right edge) and `v` (0 top, 1 bottom); sizes are fractions of H.

**The tower frame:** rows `[floorY(2) + 12 - H, floorY(2) + 12]`: the galley table at the bottom, the whole lab, the bridge
from its roof down. With fewer art rows than that needs (1920 x 1080 at 2 px: 540 rows) the frame starts at `deckTop(0) - 8`
instead, so the top deck is never cut (look playtest 2026-10-10); the galley's top half shows. The wheel stops at
`TAIL0 + 24` (the engine bell never meets the outside Lander). The left-edge fade never covers a person. It never moves by itself; the wheel scrolls it; it frames deck 2 only for the meal.
Because the galley is half cut at 1080, every sign and stress routine stands on the bridge or in the lab (§8.3), which
every size shows (fun playtest 2026-10-10: Jaxon's ask was never seen, and Vance at the galley porthole was a head).

**Layout D (a stop):** 640x360 at `G.bk = floor(min(W/640, H/360))`, centred (3 at 1080, 2 at 720).

**Layers, back to front:** `canvas#world` (full screen) · `canvas#ship` (transparent outside the hull) · `canvas#dive` ·
`canvas#bridge` · `canvas#shade` · `#words-root` (`#world-words`, `#ship-words`, `#stop-words`, `#reading`) · the MiniHost
overlay · `#mockup`. All canvases `image-rendering: pixelated`, art size times k device pixels.

## 3. Sector 1: a field of worlds

### 3.1 Where things are (world.js `FIELD`)

| id | at rest (u, v) | size | depth Z | look (its vibe; all from paint.js) |
|---|---|---|---|---|
| light | (0.93, 0.40) | V3Data light x H/360 | far | `lightGlow`; grows x1.19 for each place done or lost (doubled by the jump) |
| lander | (0.12, 0.58) | len 0.085 H | camera | our Lander from outside: `hull` + `shapeL` with `sun`, `sunDir`, `fade` as explain/lander-a-main.js `landerSprite` does; plume `RP.PLUME`, lit ports |
| zeta | (0.36, 0.20) | `drawStation` s = 0.0026 H | 4 | above the rings; its one window lit, steady |
| titan | (0.28, 0.84) | r 0.07 H | 4 | desert sphere, seed 73; red beacon blink on the night side, the furrow |
| kryos | centre (0.66, 0.74) | body R 0.25 H, ring to 1.7 R | 6 | `paintGiant` (rust-gold belts, storm, gold ring, small hulls caught in it) |
| erebus | (0.78, 0.50) | r 0.035 H | 8 | `dark` sphere drawn behind the giant, its top half showing over the upper limb; red distress blink |
| rhea | (0.72, 0.26) | r 0.022 H | 12 | `contactBlip` slow white pulse; once named, a grey rock (seed 52) with a lamp |

All seven are visible from the first frame. At rest no words show at all. Nothing counts them. Every body is lit by
`lightVector` from the light; a world's rim brightens one step when pointed at. Names: `V3Data.SECTORS[1]` (Erebus is new:
"Erebus-40 Minor · Distress call"). Worlds keep clear of the light's glare (3.2 x halo).

**The colours far away** (the designer: "mainly one colour, very tiny elements in interesting colours, like noir"). Build
sky F with `V3Sky2.build(W, H, ox, oy, 1, light, 'f')` (the 640x360 recipe stage centred on the space side), then drop its
`thing` in sector 1 (Kryos is the one enormous thing). Add an **accents** layer on the far-sky slide (0.005): seven
far colours the rest of the frame never uses, each a few dozen pixels at its own depth (look playtest 2026-10-10: the first
set, at most 7 px, was never seen): a long faint violet veil deep in the far sky, a teal ring nebula with a lit shell, a
rose-violet wisp of gas (about 40-80 px), a deep red carbon star in its own dust, a cold blue-white binary pair, a pale green
comet with a tail, a slow cyan blink that is always a dim point. Ramps start at the ink, dithered, dull; never within 60 px
of the light, a world or the Lander; well under 1% of the space side's pixels. Sector 2 gets its own four (a green veil, a
crimson star, a teal ring, a rose knot). They are found, not shown. One world carries a hue of its own: Erebus a cold teal
rim and haze; Titan a thicker dust haze. Rhea before it is named is a far disc a few pixels wide with the contact's pulse.

### 3.2 What each place is (script.js `PLACES`)

| id | fork | price to go | at the stop (one action word in the glass) | sign aboard first | crisis while the team is down |
|---|---|---|---|---|---|
| zeta | 1 (or titan) | 5 | **Dock**: pick two; "Nobody aboard. They left the lights on." Carry their power cell (+12 energy, a day: -1 ration) or leave it | the bridge console sparks once | none |
| titan | 1 (or zeta) | 5 | **Send the team**: pick two; torch on EXODUS-4's hatch; the stockpile; strip or marker on the radio; the disc drawing | A.U.R.A.: engineering has been surging | the surge, **half the time** (seeded) |
| kryos | 2 (or erebus) | 5, then the skim +15 (cap 100) | **Skim fuel**, no team; the core floods. Then Jaxon (or whoever is aboard): "The low bands are full of old wreck metal. Take her down?" **Skim the top**, or **Take her down** (+20 salvage; a ring stone scrapes the hull half the time: patches break and the hold, else the quarters or the med bay, seals off) | none | Breach on the pull-in (always: it is the second pull-in) |
| erebus | 2 (or kryos) | 5 | **Answer the call**: pick two; a dark Exodus ship, beacon on backup power twenty years. A **hazard** half the time (§8.2). Answer it and switch it off (a day: -1 ration) or take their power cells (+10 energy, +20 salvage; Aris stress +1) | A.U.R.A.: the hull has been groaning since the rings | Breach (always) |
| rhea | story | free once dated, else 5 | **Send the team**: pick two; EXODUS-6; a **hazard** half the time; the crew plate. If the disc was never found (the Zeta way), the drawing is here first | the hull, if it is the second pull-in (straight from Titan); else "engineering is still surging" if the surge has not come; else A.U.R.A.: "Their ship is lying on a slope, Commander. It could shift." (the hazard below is the risk; fun playtest: the pick did nothing) | Breach if due; else the surge, half the time; else none aboard |
| light | jump | 8 energy (x2 with engineering red), 5 rations | the jump: Corridor, the meal, sector 2 | | |

Prices (ROUTE §4): every pull-in 5 (bridge red: 7); flying is free; switching target in flight is free; nothing is spent
until the 1-second cancel window closes. Start 100 energy, 25 rations, 50 salvage (unchanged after playtest 2 asked for
tighter stores: ROUTE_AND_LIMITS §4 has energy biting in sectors 5 and 6 on purpose; that call is the economy owner's).

**Chances (playtest fix 2026-10-10).** Every chance in a run is drawn once from the run's seed (`state.seed`, `?seed=N`
replays a run; a still with `?m=` or `?t=` uses seed 7; a fresh page takes one from the clock) by `Slice.chance(key, p)`:
the surge at Titan (and again at Rhea while it has not come) 0.5 (`ECON.crisisOdds`), the hazard at Erebus and at Rhea
0.5 each (`ECON.hazardOdds`).

### 3.3 Going there, forks, and the pair going out of sight (world.js)

- **Point** at a world: rim one step brighter, our nose turns up to 6 degrees toward it, the note shows beside it (§8.1).
- **Click:** the course locks, someone reacts (V3Data `react`), 1 s to cancel (Esc or a click on empty space); then the charge
  fires (§8.1) and we fly: 7 s to a fork world, 9 s to Rhea or the light. During the flight a click on the fork's other world
  turns to it, free. A click on anything further on flies straight there; everything passed slides to the left edge, in shadow.
- **The camera** follows our Lander, which stays near its rest spot, banking toward the target, plume long. Recommended model:
  one pinhole camera; a layer at depth Z shows at `light + (rest - light) * m - X * (m - 1)` with `m = Z / (Z - C)`; the
  light never moves (m = 1); C and X ease so the target ends at (u 0.55, v 0.50) at radius 0.30 H. Then the dive (§7.3).
- **The pair goes behind the giant or the rings, and you see it go.** Taking Titan dives under the rings: the ring's near
  arc (split from the `paintGiant` canvas with `V3Paint.GIANT`: ring pixels with w > 0) sweeps up across the frame and Zeta is
  behind it for at least 0.5 s, then gone. Taking Zeta climbs over: the arc sweeps down over Titan. Taking Kryos: the body
  grows and its limb covers Erebus. Taking Erebus: we swing round the limb; Kryos slides past to the bottom-left corner, in shadow. If the
  physical model can't show it, a tuned path per pair is allowed; the acceptance is the picture, not the maths. Bake at most
  8 scale steps per flight (v3's push does the same).
- **After a stop:** leaving plays the dive backwards, then the camera eases (4 s) to the next rest point: the visited world
  slides past us to the left edge, shrunk, and stays there in shadow: darker and cooler, its own hue kept, lit only on the
  far rim (never a flat grey, which reads as a disabled button). The giant settles low in the bottom-left corner with its
  ring across it; the small ones line up above it. So the sector stays a place we are leaving (look playtest 2026-10-10). The field ahead re-frames so the
  remaining worlds spread over the space side. Its hover tag now says what we did (V3Data `doneTag`; Erebus "We answered it").
- **The light** answers the pointer only after Rhea's stop (before that a click gets one A.U.R.A. line). It doubles over
  the sector. The jump: burn up 1.5 s, six stretch frames over 0.75 s, white-gold 0.4 s, then `jump:flash` (Corridor runs).
- **Sector 2 arrives** still moving: the rogue world (`paintRogue`) rising where the stars stop, the light at core 5, halo
  34, two far glints (Hyperion, Nysa), title "The Dark Void" for 3 s with the tower closed, then the tower slides in. Nothing
  there answers the pointer. The slice ends here.

## 4. State and the bus (state.js)

`Slice.state` is the one story state (its shape is in state.js and is the contract). **script.js is its only writer**,
except `state.cam` (world.js) and `state.stop` (stop.js). Everyone else reads it every frame and listens for events.
The clock is the slice's own (`Slice.clock.t`, ms); timers use `Slice.after`. Everything on screen is a function of the
state and the clock, so a moment plus `?t=` is the same picture every time (minigames excepted: they run their own loops).

## 5. Every event on the bus

| event | payload | from | to |
|---|---|---|---|
| `tick` | { t, dt } | index | all |
| `resize` | G | index | all |
| `mockup:goto` | { moment } | index | all (after each module's `goto`) |
| `price:changed` | { mode } | index | world, ship, script |
| `world:hover` | { id or 'light' or null } | world | script |
| `price:preview` | { id, cost, free, mode } or null | script | world (note), ship (charge) |
| `world:click` | { id or 'light' } | world | script |
| `route:go` · `route:cancel` | { id, cost } · { id } | script | world (fly, or turn back to rest), ship (the charge locks, or settles) |
| `route:fired` | { id, cost } | script (1 s after go) | ship (charge fires, core drops), world (plume flare) |
| `opening:done` · `flight:switched` · `flight:arrived` | {} · { id } · { id } | world | script |
| `dive:start` · `dive:back` | { id } | script | stop (in: push, turn, plating; back: the reverse), world |
| `dive:plated` | { dir } | stop | world (may stop drawing), script |
| `stop:shown` | { id } | stop | script |
| `stop:phase` | { id, phase, sign, eligible } | script | stop. phase: arrive, pick, away, site, back, leave |
| `stop:pick` · `stop:act` · `stop:leave` | { ids } · { id, verb } · { id } ("Leave orbit") | stop | script |
| `stop:hidden` | { id } | stop | world (camera to the next rest point), script |
| `minigame:start` / `minigame:end` | { id } / { id, result } | stop | script, world, ship |
| `ship:click` | { what: person, bench, reactor, deck; id } | ship | script |
| `deck:ask` | { deck } | script | ship (show the three chips) |
| `deck:choice` | { deck, choice: fix, patch, live } | ship | script |
| `res:changed` | { res, delta, why } | script | ship (core level), world (plume, ports) |
| `crew:changed` · `deck:changed` · `place:changed` | { id } · { deck } · { id } | script | ship and stop · ship · world |
| `fix:on-bench` · `plate:up` · `page:pinned` { id } | | script | ship |
| `hold` | { on } | script | world (streaks to the slow speed) |
| `jump:start` · `jump:flash` | | script · world | world, ship · script |
| `meal:start` · `meal:done` | | script · ship | ship · script |
| `sector:arrive` | { n } | script | world, ship |
| `beat` | { id } | script | (the log only: the stopwatch and the idle check) |

## 6. The sequence

### 6.1 The careful run, target times (the stopwatch decides; report it, don't cut on your own)

| time | space (A) or the bridge (D) | the ship |
|---|---|---|
| 0:00 | From black (1 s): the field, our Lander burning. "The Graveyard" 3 s. The tower slides in (1.2 s). | Routines. The conduit pulses. |
| 0:08 | A.U.R.A. x2, Aris x1 (V3Data `arrive`, the third line rewritten to read the field). | |
| 0:30 | If nothing pointed at yet, the one-time hint beside Titan. Point at Titan: the charge climbs. Click. | The charge fires; the core drops. |
| 0:40 | Under the rings (7 s); Zeta goes behind the ring. The dive (2 s): D, Titan in the glass. | |
| 0:50 | Sign: the surge. The lineup at the window; pick Vance and Mira (Jaxon stays). Send the team. | |
| 1:05 | The shuttle drops. Torch on the hatch (about 60 s). | The surge: Jaxon has it, free. |
| 2:10 | The stockpile as film (team voices only). Mira on the radio: strip or marker. Marker. The disc drawing. | |
| 2:50 | Leave orbit: the dive backwards; Titan slides off left, grey. | A plate goes up over the galley table. The fix on Mira's bench. |
| 3:00 | | Click the bench: DiscDating (about 90 s). The drawing is pinned above the bench. |
| 4:35 | The contact becomes Rhea-4 Minor, "their last course", free. | |
| 4:45 | | Signs: Vance's bridge seat empty ("Has anyone seen Vance?"), Jaxon's galley seat empty. Talk to Vance (a standing moment); Jaxon's ask. |
| 5:20 | Point at Erebus. Click. Round the limb (7 s); Kryos slides past. D. Sign: the hull. Pick Vance and Aris. | |
| 5:40 | Breach (about 60 s), while the team is down. | A deck goes red. |
| 6:45 | The call: answer it. Leave. | The red deck: fix, patch or live with it. |
| 7:05 | Click Rhea (free, 9 s). D. Sign: their ship lies on a slope (the hazard below). Mira is in the med bay if hurt. Pick two. The crew plate. Leave. | |
| 8:00 | "The jump is ready." Point at the light: the big charge. Click. | The ring spins up; the well floods. |
| 8:10 | Corridor (about 60 s). | |
| 9:10 | | The first meal: five bowls at the galley table (no count said), 10 s (fun playtest: 6 s did not register). |
| 9:20 | Sector 2 fades in, still moving. End. | |

Target: the first frame to the jump click at most 8:00; the whole run with Corridor and the arrival about 9:30. If the
stopwatch says more, the designer cuts (a world, never a scene). The other branches (Zeta, Kryos) are played and timed too.

**Measured after the playtest fixes (2026-10-10), human pace (a reader at about 230 words a minute, never skipping):**

| run | size, prices | jump click | sector 2 arrives | its lines end |
|---|---|---|---|---|
| careful (Titan, Erebus, Rhea; reads every world note, hovers all four at each pick, torch by hand, dates, both talks) | 1920x1080, felt | 8:49 | 10:06 | 10:22 |
| careful, the same path | 1280x720, numbers | 8:59 | 10:16 | 10:32 |
| fast (Zeta, Kryos, the undated contact; Space through everything) | 1280x720, numbers | 3:22 | 4:34 | |
| fast, the same path | 1920x1080, felt | 3:20 | 4:32 | |

**After the choice fixes (fun playtest, 2026-10-10), same scripts, 1920x1080, felt:** careful 8:39 to the jump click,
sector 2 at 10:00, its lines end 10:16 (just before them: 8:45 / 10:02 / 10:18; Jaxon's ask is on the bridge, so no
scrolling for him, and Jaxon on his day is not in the Breach; the slope line at Rhea and the 10 s meal add about 9 s).
Fast 3:26 / 4:43 (before: 3:20 / 4:32; Kryos's question, the slope line and the meal).

**Final check (2026-10-10), real clicks, no console errors or exceptions in any run:** careful (1920x1080, felt, seed 11)
8:36 / 9:56 / 10:13; fast (1280x720, numbers, seed 5) 3:28 / 4:44; a third path (1366x768, felt, seed 3: Titan with
Jaxon and Aris, the surge let run, strip, Kryos with the Breach on the pull-in, take her down, patch the red deck, date
late, Rhea, A.U.R.A. flies) 7:29 / 8:48 / 9:04. Repeat runs under machine load ran up to 20 s longer. Three small fixes:
the faint line before a voice hides while a world note, a red deck's chips or a pick line is up (41 and 46 words seen);
a crew line at a stop keeps off the bodies on the bridge (asks sat on Cora and the lineup) and can use A.U.R.A.'s two
places in the glass; a tower line clears the highest head on its floor (the meal line cut a standing head).

Before the fixes the careful run was 9:08 / 10:25. The Titan stop is now 2:49 (was 3:09; the disc page is 4 steps,
not 6). Still about 50 s over the jump target and 35 s over the whole-run target. Where the rest goes, for the
designer's cut: reading all six world notes before the first click (about 25 s), the torch by hand (about 45 s), the
Breach (30 to 100 s, its own pace), the Corridor (60 s, A.U.R.A. or by hand), the two talks aboard (about 45 s).

### 6.2 The MOCKUP moments

`state.js MOMENTS` lists 24 moments. `script.goto(id)` writes the careful run's state at that moment (the table above;
Breach's result for jumps past it: the lab red, Mira hurt, 22% air), then every module's `goto` shows it, and the clock
runs from 0. `kryos` and `zeta` are the other branches. A moment that opens a minigame opens it for real.

### 6.3 Never idle

In travel, if the player does nothing for 30 s, one thing happens on a seen deck (a remark in passing, the next sign),
at most one per 30 s. In the `beat` log no gap in travel is longer than 45 s. **Before any routine remark, the next
step** (playtest 1: a player who missed Rhea sat 4 minutes hearing chatter): once, out of a crew mouth, under 15 words
(`LINES.next`: Vance at fork 1, Aris on the distress call at fork 2, A.U.R.A. "Their last course is still open" for Rhea
dated, Mira on the contact undated); then A.U.R.A. "<Place> is still ahead, Commander." at most every 90 s. The
one-time hint steps back by itself after 25 s. A course set during the arrival lines cuts the ones not yet said.

## 7. The modules

### 7.1 world.js
Sky F + accents (§3.1), v1's haze and dust lit by the light, streaks and motes out of the light (v3's flow field: cruise,
slow while `state.hold`, stretched in flight), the light, Kryos (two layers), the worlds, our Lander with the plume (length
by energy, flicker 4 frames at 8 fps, a flare on `route:fired`) and lit ports (`ship.occupied()`, brightness by `ship.beat()`).
The note on hover (`#world-words`): name and tag, plus the cost line in numbers mode (§8.1), placed away from the
pointer and off every disc. Registers anchors `ship`, `sky`, `light`, `place:<id>` (CSS px). Implements `landerPose()`,
`placeAt()`, `discs()`. Perf: under 8 ms a frame at 1920x1080; paint stills once, bake scale steps in idle frames.

### 7.2 ship.js
`TowerA.draw(ctx, { t, camY, offX: G.offX, W, H, people, auraTalking })` over a cleared canvas. `people` = `ShipSimA.at('travel',
t)` with overrides from the state: away (not drawn), hurt (not drawn: the med bay is off frame), Vance under the lab porthole
(`SPOT.labPort`) while his sign is on, Jaxon at the bridge conduit (`SPOT.conduit`, a hand on it) while his ask is open, Mira
at the bench while the fix waits, the stress routines of §8.3. Then the overlays:
the **conduit** (2 px up the inner face of the outer hull wall, x = `L.IR - 6`, every deck in view, ending in the bridge
console), the beat, the charge (§8.1), red decks (§8.4), plates over the galley table (one per marker), the pages pinned
above the bench, Aris's book on the table after a marker, five bowls at the meal. `ShipArt.reactor.set(energy)` on every
`res:changed`. Click a person, the bench, the conduit or a red deck: emit `ship:click`. The red deck's three chips go in
`#ship-words`, away from the pointer, ignoring clicks for 400 ms. Registers `person:<id>` anchors. Beat: one pulse every
1.1 s at 100 energy, 1.5 s at 10, a missed beat in four below 25; never a steady lamp.

### 7.3 stop.js
**The dive in** (on `dive:start`): from `world.landerPose()`, push on our hull (1.0 s, eight steps: `V3Paint.hull` with
`shapeL` at growing len, plating past len 300), a quarter turn nose-up in the middle of the space side, then three steps of our own hull filling the whole screen, tower
and all: dark plating lit from the light's side, staggered seams, rivets, a doubler plate round the airlock and its lit
port, the corners dark; each step pushes in on the port and the last is inside its ring (the outside Lander hides while
stop.js draws it): `dive:plated`; then a
0.6 s Bayer dissolve to the bridge: `stop:shown`. **Out**: the same backwards, then `stop:hidden`. **The bridge**:
`BridgeArt.paint()` (a 720 x 336 room; frame it as variant-d/main.js does: 640 x 360, x offset -40, camera row `B.Y0`), people with `CrewEngine.draw` at `BridgeCrew.SPOTS` (Cora at the helm; the lineup at w1, w2, w3, wA),
the world braking into the glass (lit from the front, diameter about 86% of the window's height; Kryos pushed in on its
limb), its name in a corner, one action word in the glass's sky beside the site (no thread), "Leave orbit" under the window,
always. The pick (§8.2), the shuttle dropping toward the site (tiny `hull`, you watch), film and pages through
`Slice.mods.script.reading`. All four minigames through `minigame(id, opts)` (§9). Registers `stop:person:<id>`, `stop:aura`
(the speaker grille), `stop:glass` anchors and `discs()` for the world in the glass.

### 7.4 script.js (with state.js)
The director: every beat of §6.1 and every branch, as bus reactions (never as a fixed timeline). All the words (§10, §11),
all costs and their record lines, the 1 s cancel, the hold count, `goto` for every moment, idle nudges, `words()`, and the
shade layer. Writes `state.mode`: travel, flight, dive-in, stop, dive-out, jump, corridor, meal, arrive.

## 8. The ship actions (SHIP_GAMEPLAY rev 2, steps 1 to 4)

### 8.1 The reactor shows the price, both ways
On `price:preview`: a charge gathers at the bottom of the conduit and climbs to the bridge console (120 rows a second),
sized by the price (5: 6 px; 7: 9 px; 8, the jump: 12 px, and the whole conduit brightens), and the conduit
below it dims by `cost / energy`. Free (Rhea dated): no charge; the console gives one cool flicker. Look away: settles back
in 0.4 s. `route:fired`: the charge leaves through the hull (the plume flares outside) and the conduit's base level drops.
Kryos's skim: the conduit floods upward, the other way. Clicking the conduit: the nearest person's remark, never a number.
- **felt** (default): no number anywhere on screen outside the minigames and the record. A.U.R.A. says it once per world, only
  when it matters: Kryos when energy is below 70 (fun playtest: not at 95; above that Jaxon says once "There's old wreck
  metal down in Kryos's low bands. We could haul some up.", the full ship's reason to come), Rhea undated ("A contact with no fix, Commander. I can't tell what it
  is."), and if a price would leave only the jump ("After this we can only jump, Commander.").
- **numbers**: the same, plus one line in the hover note in mono: "5 energy · 95 left", "no energy · their last course",
  "5 energy · fills the tanks", "8 energy · 5 rations". The switch is `?price=` and the MOCKUP menu.

### 8.2 Who goes, who stays (two crises)
At `stop:phase pick`: everyone who can go walks to the window (not the hurt, not someone who refused through an ask, not
someone fixing a deck; Cora stays at the helm). Hover a person: one line on what they are good for, down and aboard (§11).
Click two (click again to unpick); the action word then reads "Send the team" with "Vance and Mira take the shuttle".
Skills: on the team, Jaxon cuts the torch and strips for +30; Mira brings the fix back at once (without her it reaches the
bench one stop later, and A.U.R.A. says "The fix isn't in yet, Commander." before Rhea); Aris walks the hurt back fit;
Vance takes a hurt for the other. Aboard, Jaxon fixes the surge free; Aris treats anyone hurt (they stay well); Vance in a
breach: after Breach, whoever was hurt is not ("I pulled her out before it sealed."); Mira names what is down there on the
radio. **The surge** without Jaxon aboard: two chips, said by the two who stayed: "Shut the drive down" (engineering red)
or "Let it run" (-10 energy). **Breach** is due once: on the **second pull-in, dated or not** (playtest 2: putting off the dating
skipped the sector's crisis); at Erebus, or at Rhea straight from Titan, it is the crisis while the team is down (the
sign is the hull); at Kryos it comes on the pull-in. **The surge** is a risk, not a promise: its sign shows at Titan, it
comes half the time, and while it has not come Rhea shows "Engineering is still surging" with the same odds.
**The hover lines are vague aboard** ("Up here, the drive is mine"), so the pick is a gamble, not a lookup.
**A hazard at the site** (Erebus, Rhea; half the time each): Mira aboard scans and names it first ("Go round by the
wall") and nobody is hurt; otherwise Vance on the team takes the hit for the other, Aris on the team straps the hurt up
and they walk back; with neither, one of the two comes back hurt (the med bay: out of the next pick; Mira hurt can't
date). Two radio lines at most.

### 8.3 Signs and one ask
Four stress-1 signs, all in the default tower frame at every size (the bridge and the lab), none announced: Vance's bridge
seat empty and him standing in the lab under its porthole (a talk: VANCE'S STORY, two sides: "Tell him you believe him" /
"Say they were for other headings"; backing counts toward his ending); Jaxon on the bridge with a hand on the conduit, his
toolbag on the floor beside him, his galley seat empty at the meal and tools on the galley table (the ask: "Leave me off
the next team. I want a day on the drive." Chips "a calm drive · one hand fewer" / "he takes it badly". Yes: he is not at
the next pick, engineering can't surge this sector, and if a Breach comes before his next pick he is inside the drive: not
in the Breach, one hand fewer, and he says so; No: he goes if picked, stress +1; not answered before the next stop: his
way, the same as yes); Mira's bench lamp on while the fix waits; Aris's book on the galley table after a marker. The 30 s
nudge for the ask is Aris: "Jaxon wants a word, Commander. He didn't eat." A sign is a picture; clicking anyone else gets
a free line (`ShipSimA.line`). Talks hold the journey.
**Stress shows in what people do** (fun playtest: every moral cost was hidden). Anyone at stress 1 or more who has no sign,
no bench and no meal to be at leaves their routine and stands alone on a seen deck until the jump's rest takes it back:
Aris under the bridge's first window (after a strip or the cells), Mira under the lab porthole (after you believed Vance),
Jaxon at the conduit with his hands down (refused), Vance under the lab porthole (other headings). Never a meter.

### 8.4 A red deck: fix, patch, or live with it
A red deck: frost and a lamp out (breach), sparks (surge), on the deck's own picture, and it reads red: a slow red emergency
wash over the room, beating with a warning lamp that is a real fitting (a steel cage round a red lens), no meter, no outline. Click it: three chips. **Fix** (-20
salvage; done during the next trip by whoever stays; Jaxon alone, otherwise both aboard and the next crisis goes
unanswered; the deck shows "fixing" until then). **Patch** (5 salvage, now; it holds until the next crisis, scrape **or the
jump**, which shakes every patch loose, then it breaks worse: two lamps out, and only a fix brings it back. Playtest 2:
a free patch was always right). **Engineering down** (the surge shut, or a red engineering deck; fun playtest: "Shut the
drive down" changed nothing you could see): the core dims a step and the conduit stutters; every seen deck runs a step
darker and browns out in short dips every 2.9 s (ship.js); outside, the plume runs at half and coughs out on the same beat
(world.js); and every flight to a world takes a quarter longer. **Live with it**: lab: no dating; hold: -2 rations at the jump; engineering:
the jump costs double and the core dims a step; quarters: no rest at the jump; bridge: pull-ins cost 7.

## 9. The minigames (the real files; stop.js calls them; each holds the journey)

They sit in the scene: while one is open the live picture (the bridge, the tower, the corridor) stays behind it, dithered
down to about 45% (`canvas#shade`), and in the slice the host's own backdrop goes clear and its outer border steps back
(slice CSS in script.js; `minigames.css` is not touched).

| when | call | then |
|---|---|---|
| Titan, after Send the team | `minigame('torch', { mode: 'hatch', hull: 'EXODUS-4', sector: 1, cutter: Jaxon if on the team else the first, spotter: the other })` | each tank past the first: -5 salvage; record line |
| the bench, fix waiting, lab not red | `minigame('disc', { wreck: { hull: 4, sector: 1 }, plotted: [], crew: crewList(), reward: { name: 'Rhea-4 Minor', kind: 'beacon', line: { who: 'Mira', text: 'They saw a lamp on that moon and went to help. They never got there.' } }, names: ['Kryos-68 Prime', 'Erebus-40 Minor', 'Platform Zeta'] })` | `dated`: Rhea named and free, the drawing pinned; not dated: stays on the bench |
| Breach due (§8.2) | `minigame('breach', { crew: [{ id, alive, injured }] for aris, mira, vance, jaxon (alive false for the team away), sector: 1 })` | `damagedDeck` red (cargo is the hold); `hurt` per §8.2; record the air lost |
| the jump | `minigame('corridor', { fromSector: 1, toSector: 2, crew: crewList(), damaged: { red or worse decks; hold as cargo }, scrapesPerBreak: 3, avoidHulls: [4, 6, 7] })` | `damagedRooms` red; scrapes to the record |

`crewList()` is the game's shape: `[{ name: 'Cora', tags: ['LEADER'], status }, { name: 'Jaxon', tags: ['ENGINEER'] }, { name:
'Aris', tags: ['MEDIC'] }, { name: 'Vance', tags: ['SECURITY'] }, { name: 'Mira', tags: ['SPECIALIST'] }]`, status `HEALTHY` or
`INJURED`. Never use `TEST_MODE`. If a minigame fails it resolves `{ failed: true }`: say nothing about it, carry on.

## 10. Words

**10.1 Limits.** At most 40 words on screen (the `#mockup` menu and the minigame frame excepted), one voice line at a time,
beside whoever speaks, 20 words a line at most (STYLE.md), first names, Cora never speaks, A.U.R.A. says "four crew". At
rest in travel: no words. Pointing: one name and tag (and one cost line in numbers mode). Results in words, never a
scorecard; no "SECTOR 1 OF 6", no headers, panels, strips, meters, guide lines or stop counts.
**10.2 The reading layer.** `GameReading.create(adapter)`; script.js writes the adapter: `now, after, cancel` (the slice
clock), `anchor(s)` (from `Slice.anchors`, the `stop:` ones while stopped), `luma(rect)` (busy where any `discs()`, the
Lander, the light or the tower is), `shade`, `dim`, `state` (the record grouped by stop), `pages` ({ disc: PAGE_DISC, plate:
PAGE_PLATE }), `art` (V3Paint's helpers as game-screen-v3.html passes them), `geom`, `view`, `recordInOrder: true`.
Expose it as `Slice.mods.script.reading`. **The page and film chrome counts** (playtest 1: 46 to 64 words): in the slice the page's key hint reads "Space for more"
and shows on the first line only; read lines lose their numbers; "Kept in the ship's record" is not shown (the record has
it); a voice under a page replaces the read lines; the film's faint previous line is gone; nothing in the slice's
word layers shows behind a minigame. All done from script.js (CSS and one DOM touch), reading.js unedited.
**10.3 Shades.** `canvas#shade` (A's scale; D's while stopped) draws one dither
shade per shade rect (game-screen-v3.html's `shadeSprite` recipe, about 20 lines). **10.4 Choices** appear away from the
last click and ignore clicks for 400 ms. Their chips sit on one dark backing with a dot between two (fun playtest: "energy
salvage" read as one phrase over the hull), and a loss chip is a brighter red (slice CSS; reading.css unedited). Keys: Space or Enter next line, 1 and 2 choose, Esc cancels, L the record.

## 11. The lines

**Moved (playtest 1, the Titan stop read 75 s back to back):** at Titan the disc page shows without its two after-lines;
Mira says hers ("The disc's map uses real stars…") when the fix lands on her bench, and A.U.R.A.'s "An old curiosity,
Commander" is the next quiet nudge while the fix waits. The stockpile film keeps one line per person on the team.
Reuse as written: V3Data sector 1 (`arrive`, `hint`, tags, `line`, `react`, `orbit.arrive`, `doneTag`), SCENE_STOCKPILE
(lines only for the team; its two choices become strip / marker), PAGE_DISC, PAGE_PLATE, ShipSimA's routine lines,
script/sector-1.md (VANCE'S STORY, the distress beacon from pools.md made sector 1: twenty years, not 120). New lines, in
`script.js LINES`, each checked against STYLE.md: the route read for the field; the hint; the four stress signs' lines; the
four "good for" lines (one per person, about 12 words: down and aboard); the surge (two chips); Jaxon's ask (two chips);
the strip-or-marker radio ask per speaker; the Erebus call; A.U.R.A.'s price lines (§8.1); "We passed it" for a lost
fork world clicked; the light before Rhea; the jump; the red-deck chips; sector 2's two arrival lines (V3Data).

## 12. Acceptance checks (integrator, with each builder for their part)

1. No console errors or warnings from the slice at 1920x1080 and 1280x720 (`?mute=1`), at every MOCKUP moment.
2. Space is at least 55% of the width at both sizes; the three tower decks of §2 are whole at 720.
3. `slice.words()` is at most 40 at every moment and step; 0 at rest in travel; one name and tag when pointing.
4. Both price modes: in felt no digit on screen outside the minigames and the record (scan visible text); in numbers the
   note carries the cost line; the conduit's charge differs for free, 5, 7 and 8.
5. Every fork, both ways: the pair is seen going behind the ring or the giant (screenshots mid-flight) and can't be clicked.
6. The careful run and both other branches played start to sector 2 with a stopwatch; times reported against §6.1.
7. No gap over 45 s between `beat` events in travel (from `slice.log()`).
8. All four minigames open from the real files, resolve, and the slice carries on; no AudioContext is ever created.
9. Stills: `?m=<moment>&t=<ms>` gives the same picture twice. Screenshots of every moment at both sizes, judged at full
   size: no straight guide line, no readout beyond one per minigame, the reactor pulsing, the crew the crew-hires sprites.
10. Frame time under 12 ms at 1920x1080 in travel (`performance.now()` around a render).

## 13. Not in this slice

The title, the opening film, saving, the Esc menu, E for the whole ship, sound, the sleepers, settling, the docking game at
Zeta, the walk and the end, anything past sector 2's arrival.
