# Build A: "Fly it" in the real game, behind ?new=1 (2026-10-10)

GAME_FLOW.md §5 step 2, checkpoint A. The approved slice (`prototypes/slice/`) is ported into `src/newscreen/`, cleaned up,
and reads the REAL game state. Only travel is new: the stop is still today's orbit view (checkpoint B replaces it), the
economy is still today's (checkpoint C), the words are still today's cards and log (checkpoint D). Default game: unchanged.
Four people: one **art porter** first, alone; then three **builders** in parallel (travel, tower, flow).

## 1. The switch

- `index.html`, an inline script first in `<body>`: `?new=1` sets `sessionStorage['se-new-screen'] = '1'`, `?new=0` removes
  it; `window.NEW_SCREEN = sessionStorage['se-new-screen'] === '1'` (try/catch: falls back to `?new=1` alone). Session
  only: a new tab, or a closed browser, is the default game again. Nothing in localStorage, nothing in the save.
- The new files load ONLY when the switch is on: one inline script after the minigame scripts does
  `if (window.NEW_SCREEN) document.write(...)` of the IBM Plex font link, `src/newscreen/newscreen.css?v=N` and every new
  script in the order of §3, each with its own `?v=N`. Off: not one request to `src/newscreen/` (checked, §8).
- Every seam in `src/bundle.js` is guarded by `const isNewScreen = () => !!(window.NEW_SCREEN && window.NewScreen && window.NSRoute);`
  (a partial load, a stale cache or one 404, falls back to today's map instead of a blank screen).
- Under the switch: travelling between worlds is the new full-screen view `#ns-root` (`body.ns-travel`: the header, both
  side panels, the mission log, the Coach and NavView are hidden: `.app-container` gets `visibility: hidden`, `.coach`
  `display: none`). In orbit `ns-travel` is removed and today's layout shows exactly as now (header numbers included).
  Every card, page, reel and minigame still opens on top (`#ns-root` sits at z-index 900; `.modal-overlay` is 1000+,
  StoryReel 5000, MiniHost 6000). Title screen, briefing, campfire, endings: unchanged.

## 2. What the new view does with the real game (flow, owned by the flow builder)

| moment | the real code it calls | seam |
|---|---|---|
| any `renderNav()` (new game, leave orbit, load, new sector, anomaly) | `checkStranded`, `revealLateStoryPlanet` as today, then `NewScreen.show(this)` and return before NavView | renderNav (line ~5268) |
| `renderOrbit()` | `NewScreen.hide()` first, then today's OrbitView | renderOrbit (~5345) |
| a world clicked, after the 1 s cancel window | `NSRoute.canGo` (refusal: one voice line, no flight) | none |
| the flight lands (7 s fork band, 9 s further; x1.25 with engineering DAMAGED) | `app.handleWarp(node, { flown: true })`; if `state.currentSystem === node` afterwards, `NSRoute.arrive(state, id)` | handleWarp (~1619): new 2nd param |
| inside that handleWarp | skips WarpPlot when `opts.flown`; under the switch skips the stops-left refusal AND the stop count going down (the forks are the limit, ROUTE §1.3); Breach, barks, the 1 s timer, `renderOrbit()`, autosave: all as today | |
| Leave orbit (`req-break-orbit`) | today's handler, then `renderNav` → `show`: the world we left slides to the left edge | none |
| the light clicked (sectors 1 to 5) | `app.handleSectorJump()`: today's ask, reserve offer, `jumpNow` | none |
| `startSectorJump()` | under the switch, and not the throw into sector 3: `NewScreen.playJump().then(...)` before `showWarpAnimation` (burn, stretch, white flash 2.65 s, then the real Corridor in MiniHost, the campfire, `enterNextSector`, `renderNav` → the next sector arrives in the new view) | startSectorJump (~2367) |
| sector 6, the light | it is the STRUCTURE node: a flight to it, then `handleWarp(structure, { flown: true })` | none |
| the faint contact clicked | `A.U.R.A.: "That contact is too faint to plot a course to, Commander."` as a voice line | none |
| a ghost (sector 3) clicked | `app.dissolveGhost(node)`, the one rule NavView now calls too: remove the node, the log line, Mira's line; the world dithers out | new App method |
| `whatIsLeftInSector()`, `checkStranded()` | under the switch: no stop count; a node with `NSRoute.outOfReach(node)` is not "left" | both |
| `revealLateStoryPlanet()` | under the switch the trigger is `NSRoute.onlyStoryLeft(state)` instead of `getStopsLeft() <= 1` | ~2782 |
| sector 6, which sector is last | `window.FINAL_SECTOR` (bundle.js sets it from its own `FINAL_SECTOR`) | next to `isNewScreen` |
| orbit under the switch | the leave button reads LEAVE ORBIT · FLY ON; the Coach says nothing in travel and no stop sentences (`Coach.js`, `OrbitView.js`, both guarded) | both |

Supplies carry over as today (`enterNextSector` keeps energy, rations, salvage). The route lives on the nodes
(`node.nsRoute = { sector, band, slot, status }`), so it saves and loads with `sectorNodes` and needs no save change;
the default game never reads it. bundle.js stays CRLF; `bundle.js` is at `v=76` after the review fixes (§9).

## 3. Files, owners, what each owns

Load order = this table's order. All new files LF (checked 2026-10-11: every file under `src/newscreen/` is LF; `index.html` is LF, `bundle.js`,
`NavView.js`, `OrbitView.js`, `SectorConfig.js` are CRLF in the working copy and stay so), `'use strict'`, IIFE, under 800 lines, no `Math.random` (hash the
node id), no AudioSystem, no URL reads except the switch.

| file | owner | owns | ported from |
|---|---|---|---|
| `art/Paint.js` → `window.NSPaint` | art porter | the picture recipes: dither, ramps, painter, framer, sphere, surfaceFor, lightVector, drawStation, contactBlip, lightGlow, spaceStrip, paintSpace, twinkle, hull + shapeL, paintGiant, GIANT, paintRogue, pixelLayer, pixelText, film | `game-screen-v3/paint.js` |
| `art/Sky.js` → `NSSky`, `art/Sky2.js` → `NSSky2` | art porter | sky F (mode fixed to `'f'`, the `?sky=`/`?accents=` reads removed; `build(W,H,ox,oy,n,light,'f')` unchanged) | `sky.js`, `sky2.js` |
| `crew/CrewEngine.js`, `crew/Cora.js` `Jaxon.js` `Aris.js` `Vance.js` `Mira.js` → `CrewEngine` | art porter | the crew sprites | `crew-hires/engine.js`, the five person files |
| `ship/ShipArt.js`, `ship/ShipRooms.js`, `ship/ShipReactor.js` → `ShipArt` (+ `.reactor`) | art porter | decks, rooms, SPOTS, the reactor (the `?energy=` read removed; `fromUrl` always false) | `ship-art.js`, `ship-rooms.js`, `ship-reactor.js` |
| `ship/ShipRoutine.js` → `ShipRoutine` | art porter | the crew's day (`at('travel', t)`, `stateOf`, `line`) | `layouts/variant-a/sim-a.js` |
| `ship/TowerArt.js` → `TowerArt` | art porter | `draw(ctx, o)`, `hitPerson`, `drawn`, `warm()`; reads `ShipRoutine` | `layouts/variant-a/tower.js` |
| `NewScreen.js` → `NewScreen` | flow | the shell (§4): mount, measure, loop, input, bus, show/hide, the `game` adapter, `flow`, `playJump`, `debug` | slice `index.html` boot, `state.js` bus |
| `Route.js` → `NSRoute` | flow | real nodes → bands, slots, forks, reach (§5) | slice `script.js` `clickable`, ROUTE §3 |
| `Voice.js` | flow | one voice line at a time on a dither shade, from `log-updated` speaker lines (§6) | slice `script/shade.js` (shade recipe only) |
| `newscreen.css` | flow | `#ns-root`, the hide rules of §1, the IBM Plex tokens of slice `index.html` scoped to `#ns-root` | slice `index.html` `<style>` |
| `travel/SectorLooks.js` → `NSLooks` | travel | per sector 1-6: title, sky seed/dust/haze/stars, the light's core/halo/spikes, far colours (1, 2), the enormous thing | `game-screen-v3/data.js` SECTORS 1-2; 3-6 new |
| `travel/Field.js` | travel | slot table, camera, `scene()`, flights, fork hiding, passing to the left edge | slice `world.js` §1-3 |
| `travel/Pictures.js` | travel | sprites and bake queue, worlds by real type, station, field of rocks, ghost, giant (2 layers), rogue, Lander + plume, light glow, sky backdrop, accents, corridor dark | slice `world.js` §4-5 |
| `travel/Travel.js` | travel | the module: update, render, pointing, the note, the title, the lock and cancel, the jump burn, sector arrival | slice `world.js` §5-9 |
| `tower/Tower.js` (+ `tower/TowerMarks.js` if needed) | tower | the tower module: people from real crew, frame and wheel, slide-in, beat, reactor level, red decks, brown-out, conduit (no charge), vignette, `occupied()`, `beat()`, anchors | slice `ship.js` |
| `index.html`, `src/bundle.js` | flow | §1 and §2 only | |

Not ported in A: `stop.js`, `variant-d/*`, `explain/*` (the dive and the bridge are checkpoint B), `script.js` story beats,
`ship-sim.js` (replaced by ShipRoutine), the MOCKUP menu and stills. Renames are the only API change: `V3Paint`→`NSPaint`,
`V3Sky`→`NSSky`, `V3Sky2`→`NSSky2`, `ShipSimA`→`ShipRoutine`, `TowerA`→`TowerArt`; `CrewEngine` and `ShipArt` keep their names.

## 4. The shell contract (`window.NewScreen`, flow builder; travel and tower code against it)

- `on` (the switch) · `G` · `clock.t` (ms, runs only while shown) · `app` · `bus.on(name, fn) → off`, `bus.emit(name, p)` ·
  `anchors: Map(name → () => [{ x, y, side, align }] CSS px)` · `register(name, mod)` · `mods.travel|tower|voice`.
- `G` exactly as slice `measure()`: `k = max(1, floor(devH / 540))`, `W = ceil(devW / k)`, `H = ceil(devH / k)`,
  `HULL_OUT = ShipArt.L.CX + ShipArt.L.HO + 9`, `offX = round(0.42 W) - HULL_OUT`, `hull = offX + HULL_OUT + 1`, and if
  `W - hull < 0.55 W` then `hull = floor(0.45 W)`, `offX = hull - HULL_OUT - 1`; `dpr`, `toArt(cx, cy)`, `toCss(ax, ay)`;
  `--t` and `--px` set on `#ns-root`. Re-measured on resize (150 ms debounce), then every `mod.resize(G)` and `'resize'`.
- `#ns-root` holds, back to front: `canvas#ns-world` (travel), `canvas#ns-ship` (tower), `canvas#ns-shade` (voice),
  `#ns-words` with `.ns-layer` divs `#ns-world-words` (travel), `#ns-ship-words` (tower), `#ns-voice` (voice). Each module
  sizes its own canvas in `resize(G)` (`W x H`, CSS `W*k/dpr`), `image-rendering: pixelated`.
- A module: `{ init(), resize(G), update(dt, t), render(t), pointer(type, e, ax, ay) → bool, key?(e) → bool }`. The shell
  calls them in the order travel, tower, voice, each in try/catch with `console.error`. The loop is `FrameClock.request`
  and stops while hidden. Input: pointer on `#ns-root`, `ax < G.hull` → tower, else travel; wheel → tower; keys → travel
  (Esc cancels a lock). Nothing reaches a module while `blocked()`.
- `game` (read-only, real state, cheap per frame): `energy()`, `sector()`, `crew()` → `[{ id: 'cora'|'jaxon'|'aris'|'vance'|
  'mira', status: 'well'|'hurt'|'dead'|'confined'|'asleep', stress }]` (from `status` DEAD/INJURED and tags CONFINED/
  SEDATED; id by tag: LEADER cora, ENGINEER jaxon, MEDIC aris, SECURITY vance, SPECIALIST mira; not `crewIdOf`, which
  calls Cora 'you'), `decks()` → `{ bridge, lab, quarters, medbay: 'ok', hold: <cargo>, engineering }` each `'ok'|'red'`
  (DAMAGED or `_auraLocked`), `broken(deck)`, `route()` → `NSRoute.plan(state)`.
- `flow` (travel calls these): `canGo(id) → { ok, say }`, `go(id)` (the lock closed; re-checks), `arrive(id)` (§2),
  `light()`, `contact()`, `ghost(id)`.
- `show(app)`, `hide()`, `isShown()`, `blocked()` (a `.modal-overlay`, `.story-reel` or `.mini-host` is in the page),
  `playJump() → Promise` (emits `'jump:burn'`; resolves on `'jump:flash'`, or after 5 s; resolves at once if not shown).
- Bus events: `'shown' { sector, first, from }` (`first`: the first show of this sector, deferred until nothing blocks, so
  the title is never under the briefing; `from`: the node id we just left orbit at, else null), `'hidden'`, `'hud'` (on
  `hud-updated`), `'jump:burn'`; from travel: `'opening:done'` (4.2 s after a first show; the tower slides in; tower falls
  back to opening at 5 s), `'jump:flash'`. The shell hides on `game-over`.
- `debug`: `state()` (sector, energy, the plan with statuses, mode), `placeAt(id) → { x, y, r }` CSS px (`'light'` too),
  for the headless runs.

## 5. Real nodes → the field of worlds ahead (`NSRoute`, flow; slots drawn by travel)

`plan(state)` runs once per sector (idempotent: kept while every node's `nsRoute.sector` matches; a new or regenerated
sector, the Wrong Place included, is planned afresh):
1. Pool = every node that is not `isStoryPlanet` and not `isStructure` (ghosts included).
2. Sector 1: the first `GAS_GIANT` leaves the pool as `giant` (it becomes Kryos's place: the giant IS that world). With
   none, the giant is scenery only: drawn, never pointed at, never named.
3. `first` leaves the pool: the `isFirstSignal` node (sector 1) or the `hasTape` node (sector 2). The rest sort by
   `mapData.x`, then id.
4. Sector 1: fork 1 = `first` (slot `fork1-bottom`, Titan's place) with a station if any, else the next (`fork1-top`,
   Zeta's); fork 2 = `giant` (`fork2-giant`) with the next (`fork2-limb`, Erebus's), or without a giant the next two
   (`fork2-top`, `fork2-limb`). Sectors 2-6: `first` alone (band 1), then one fork of the next two (`fork-top`,
   `fork-bottom`). A fork with one node left is a single. The rest: one band each (`single-1` … `single-4`, then a fallback
   arc), then the story world alone (`story`), then the light (in sector 6 the STRUCTURE node).
5. Status per node: `ahead` → `visited` (we pulled in), `gone` (the fork's other world, once we arrive), `passed` (any
   `ahead` node in a lower band than where we arrive). `at` = the highest band visited (0 at the start).
6. A fresh plan on a sector already played (a save from the default game continued with `?new=1`) marks where we have
   been: `lastVisitedSystem`, a wreck boarded (`exodusInvestigated`), a station searched (`stationInvestigated`); a remote
   scan is not a visit. Then `arrive` runs for each, lowest band first.
7. Sectors 2-6: a fork with one node left is named `single-N` (no mate), never half a fork.

`canGo(state, id)`: ok when `ahead`, band > `at`, not `storyHidden`, and `getWarpCost(node) <= energy` (or TEST_MODE).
Else one line: contact (today's), passed or visited ("We passed it, Commander. We can't turn back."), unaffordable
("We can't afford that one, Commander."). `arrive`, `outOfReach(node)` (status not `ahead`), `onlyStoryLeft(state)` (no
`ahead` non-story node beyond `at` that we can afford: `getWarpCost(node) <= energy`, or TEST_MODE). Flight rules (ROUTE §3): during the flight a click on the other world of the same
fork turns to it, free; a click on any world further on flies straight there; nothing is recorded until `arrive`.

**Slots (travel's `Field.js`, u/v on the space side, Z depth, r fraction of H)** start from slice `world.js FIELD`:
`fork1-top` (0.36, 0.20, Z 4, station s 0.0026 or r 0.05) · `fork1-bottom` (0.28, 0.84, Z 4, r 0.07) · `fork2-giant` =
Kryos (0.66, 0.74, Z 22, R 0.25) · `fork2-limb` (0.78, 0.50 put on the giant's upper limb as `computeRest` does, Z 27,
r 0.035) · `fork2-top` (0.50, 0.40, Z 14, r 0.045) · `fork-top`/`fork-bottom` for 2-6 = the fork1 places · singles from
(0.50, 0.30, Z 30), (0.58, 0.12, Z 33), (0.86, 0.18, Z 35), (0.44, 0.58, Z 31) · `story` (0.72, 0.26, Z 40, r 0.022).
Tune to the acceptance, not the numbers: every world clear of the light's glare (3.2 x halo) and of the giant, none
touching, nearer bands bigger. **Colours: one source per world, the orbit's.** With the dither art on, a world's ramp is
`DitherRecipes.TYPES[type].ramp` (exactly what the orbit view paints); with it off, BodyRenderer's SVG palette
(`BodyRenderer.palette(type)`, new export). The surface recipe (`desert`, `gas`, `ice`, `rock`, `dark`) follows the type's
family; the rims of `world.js RIM` stay. The giant's body takes the same ramp (`paintGiant(p, { ..., ramp })`), so Kryos is
the lavender, gold-banded giant you arrive at; its ring keeps the dust gold. Seed = hash of the node id. Our wrecks (`EXODUS_WRECK`, first signal) and the named story
world carry the red beacon blink; the hidden story world is `world.js`'s far disc with the contact's slow pulse and
resolves on screen when `storyHidden` turns false; a station is `drawStation` with its one lit window; an asteroid field a
few small rock spheres; a ghost a dark world that dithers in and out. The fork pair hides as `world.js HIDE` in sector 1
(behind the near ring arc or the giant's limb; Erebus's way passes the giant); in 2-6 it passes to the left edge in
shadow. A visited or passed world slides to the left edge in shadow (`passedMode`), as in the slice; the camera then eases
to frame what is left (generalise `STAGES`: push in on the next band, the light never moves).

**The hover note** (name and one tag, nothing else, away from the pointer, off every disc): name = `node.name`; tag, first
that fits: hidden story "A faint contact" / "No fix on it yet"; visited "We stopped here"; passed or gone "We passed it";
first signal "An old ship beacon"; `EXODUS_WRECK` "One of our ships"; story named "Their last course"; station "An empty
station"; asteroid field "Rocks and old metal"; else the type in plain words ("A desert world", "A gas giant").
The light: "The light ahead" / "The jump" (sector 6: "The light" / "Where the heading ends"). No numbers on the lane.

## 6. Sky, light, Lander, tower, voice

- **Sky** per sector: `NSSky2.build(..., n, light, 'f')` with sector 1's and 2's own far colours as `world.js`
  `FAR_COLOURS`; `sky.thing` dropped in 1 (Kryos) and 2 (the rogue world rises as `drawSector2` does); kept in 3-6 (the
  stub enormous thing: sky F's shell, pillars, eye, ring of lit dust). Light: 1 core 2 halo 14, 2 core 5 halo 34, then 3:
  7/40, 4: 9/48, 5: 11/58, 6: 15/80; grows x1.19 per world passed or visited, as in the slice. A new sector: from black,
  its title for 3 s (SECTOR_CONFIG name in title case), the tower closed until `'opening:done'`, then slides in (1.2 s).
- **Our Lander outside** (`world.js drawLander`): plume `0.25 + 0.75 x energy/100`, x1.7 in flight, flare on `go`,
  sputter with engineering red; ports lit by `mods.tower.occupied()` and breathing with `mods.tower.beat(t)`; the shuttle
  clamped by the hold. Banks toward what you point at (6 degrees), 10 in flight.
- **The jump** (`'jump:burn'`): burn 1.5 s, six stretch frames, white-gold 0.4 s in four warm steps (RP.SUN 6 → 3, solid,
  never a grey checker), washed over the tower too by a div over both canvases; `'jump:flash'`; then the corridor dark
  (`drawDark`) with our Lander until the next `'shown'`.
- **The tower** (slice `ship.js`, minus price charge, signs, asks, chips, meal, plates, pages): frame rows
  `[floorY(2) + 12 - H, floorY(2) + 12]`, or from `deckTop(0) - 8` when H is short (the top deck never cut); the wheel
  scrolls it, stopping at `TAIL0 + 24`. People: `ShipRoutine.at('travel', t)` overridden by `game.crew()`: dead not drawn;
  hurt in the med bay bed (`patient`; a second hurt in their own bunk, asleep); asleep (SEDATED) in their bunk; confined
  standing still at their bunk in the quarters; nobody stays on a red deck (they wait at the galley table). Decks red from
  `game.decks()`: the red wash, the lamp cage, a lamp out, frost; engineering red: core a step down, brown-outs every
  2.9 s. Reactor: `ShipArt.reactor.set(energy)` on `'hud'`; beat 1.1 s at 100, 1.5 s at 10, a missed beat in four below 25.
  Anchors `person:<id>` for the voice. No clicks in A except the wheel (the click-a-person lines are gone; checkpoint B
  may bring them back through the log). The wheel works only over the tower, stops 40 art px above the top deck (never
  the empty nose dome) and above the engine bell, and after 8 s untouched the frame eases back to the usual one.
- **Voice** (`Voice.js`): while shown, a `log-updated` line that starts with `A.U.R.A.:`, `Jaxon:`, `Aris:`, `Vance:` or
  `Mira:` becomes one voice line (the quote, the first name over it) beside that person's `person:<id>` anchor, or beside
  our Lander (`ship`) for A.U.R.A. and anyone out of frame; on the slice's dither shade; `max(3200, words x 300 + 1600)` ms;
  one at a time, a queue of 3 (oldest dropped); hidden while a hover note is up; nothing while `blocked()` (a waiting line
  ages only in shown, unblocked time). A line logged while the view is hidden, in the 2.5 s before `show()` (the story
  world revealed as we leave orbit, A.U.R.A.'s thanks after a card), is kept and said once the view is up. A line caused
  by a click (a refusal, the faint contact, "We are already on our way" for the light clicked mid-flight) is shown at once,
  cutting the one on screen, and logged as today. Sector 1, nothing visited yet: once, after the tower slides in,
  A.U.R.A.: "One of our ships is calling, Commander. Point at a world to fly there." (the Coach's first tip, which is
  hidden in travel). Other log lines stay in the log, readable in orbit.
- **The hover note** goes on a click and stays away until the pointer really moves (4 art px), so a refusal is seen at
  once; in a flight what is under a still pointer is worked out again every frame (no stale note riding a world).

## 7. Order of work

1. **Art porter**, alone, first (about 4 h): the 14 art files of §3, behaviour-identical, then the baseline of §8.1.
2. **In parallel**: travel, tower, flow. The flow builder lands `NewScreen.js` and `Route.js` first (the others test
   against them); until then a builder may use a temporary harness page `tools/ns-harness-<name>.html`, deleted before done.
   Each touches only its own files. Nobody edits a prototype file or an art file (a bug there: tell the art porter's owner).
3. **The flow builder** runs §8 last, once all three report done.

## 8. Acceptance

1. **Default game unchanged.** Before any edit, the art porter saves screenshots (1920x1080 and 1280x720: title, the map
   after the briefing, an orbit) of the default game; after the build the same shots match. Without `?new=1` the page makes
   no request to `src/newscreen/` (`performance.getEntriesByType('resource')`). A default run: new game → a warp (WarpPlot
   as today) → orbit → leave → JUMP SECTOR → Corridor → sector 2, no console errors.
2. **A sector 1 run under ?new=1** from the title to sector 2, real clicks at `debug.placeAt` points: new game, the reel and
   briefing, the title "The Graveyard" over the field, the tower slides in; point (one name and tag), click a fork world,
   its pair goes behind the ring, today's orbit and team, Leave orbit (the world slides left), the head count card, a
   wreck dated (the contact resolves and is free) or not (revealed when only it is left), the Breach on the second warp,
   the story world, the light: the ask if something is left, the burn, the real Corridor, the campfire, sector 2 in the
   new view with its own sky and title. Energy, rations and salvage after = before minus the jump's price and the meal.
   Played both ways at fork 1. Reload mid-sector with Continue: the same field (passed, visited, gone kept).
3. **No console errors or warnings** in either run (CDP `Runtime.exceptionThrown` and console errors).
4. **1920x1080 and 1280x720:** space at least 55% of the width; bridge, lab and the galley table whole at 720; no straight
   guide line, no number on the lane, at most 40 words; screenshots of rest, pointing, mid-flight (the pair going behind),
   after leaving orbit, the burn, sector 2, judged at full size. Frame time under 12 ms at 1920x1080 in travel.
5. **Real state shows:** from the console, set Vance DEAD, Aris INJURED, Jaxon CONFINED, the lab DAMAGED, energy 20, then
   `emitUpdates()`: Vance gone, Aris in the bed, Jaxon at his bunk, the lab red, reactor and plume low (screenshots).
6. **Session switch:** `?new=1` then a reload without it: still new; `?new=0`: default; a fresh tab: default.

## 9. Review fixes (2026-10-11)

Code review and play review of the first build, fixed:
- **Memory across sectors**: a new sector drops every travel picture (`NSPictures.clear()` in Travel's new-sector show);
  inside a sector big sprites share 2 % size buckets, a family keeps at most 24 sizes, the bake queue at most 48.
- **The world you click is the world you arrive at** (§5 colours). **Refusals seen at once**, **story reveal voiced**,
  **no stale hover note in flight**, **warm flash over the tower** (§6).
- No global `getContext` patch any more (the only per-frame readback canvas already asks for `willReadFrequently`).
- The shell reads `blocked()` once a frame; under a card or a minigame the picture is drawn every 12th frame only (the
  jump's burn always draws).
- Tower: no fallback state reading (only `NewScreen.game`), no click lines, wheel limits (§6).
- Route: saves from the default game, single forks, affordable `onlyStoryLeft` (§5).
- Default game, small and safe: `App.dissolveGhost` shared with NavView; ghost ids unique (`SectorConfig.js`);
  `AudioSystem.playHeavenMusic` does nothing while muted (no autoplay warning).
- Cache-busters: bundle 76, NavView 63, OrbitView 57, Coach 59, SectorConfig 61, AudioSystem 39, BodyRenderer 39;
  new screen: Paint, NewScreen, Route, Voice, Tower 2, Pictures 3, Travel 2.

Left for later: into sector 3 the throw still opens today's green WarpPlot over the new view (BUILD_A exception; B or C);
the phantom's name ("Phantom-70", "Mirage-90") still gives it away (default game's naming, untouched); taking the other
fork-1 world still loses the marked wreck without a word; the orbit screen is today's dashboard until checkpoint B.

Testing rules for everyone: a temporary static server from the repo root on your own port (never 8000 or 8010), headless
Chrome always with `--mute-audio` and its own profile under the run's scratchpad `builda/`, the game at `?mute=1` (and
`?new=1`), screenshots saved there; stop the server and Chrome when done. Never the browser pane. No git add, commit or push.
