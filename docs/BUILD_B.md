# Build B: "Stop" in the real game, behind ?new=1 (2026-10-11)

GAME_FLOW.md §5 checkpoint B, SHIP_GAMEPLAY.md §4 and §6, SLICE_SPEC.md §7.3 and §8. Starts from BUILD_A (read it first:
the switch, the shell, the bus, the route). The designer on A: "still starts weird ... then turns to this, this is beautiful.
Planets a bit boring ... on the rocket, why do we have to scroll? ... it is ridiculously close." So B does five things, all
behind `?new=1`: **the stop** (§2-§5), **the start** (§6), **the cards** (§7), **the tower fits** (§8), **planets with
character** (§9). The default game (no `?new=1`) stays exactly as today. Reuse the game's own logic (costs, events, rewards,
saves); never re-make a minigame; keep today's story lines and pages, only restyled (the story is still being decided).
Four builders in parallel (§10): **A** stop view, **B** start, talk and cards, **C** tower fit and planets, **D** flow.

## 1. Modes of the new screen (D, `NewScreen.js`)

`NewScreen.mode()` → `'travel' | 'dive-in' | 'stop' | 'dive-out'`. `#ns-root` stays shown the whole run under the switch
(`body.ns-travel` stays on in orbit too): OrbitView, the header, panels, log and Coach never show again (fallback: if any
new-screen file failed to load, `isNewScreen()` is false and the default game runs, as in A).
- `#ns-root` back to front: `ns-world`, `ns-ship`, **`ns-dive`**, **`ns-bridge`**, `ns-shade`, `#ns-words` with layers
  `ns-world-words`, `ns-ship-words`, **`ns-stop-words`**, `ns-voice`. `ORDER = ['travel', 'tower', 'stop', 'voice']`.
- Pointer: mode `travel` → as A (tower left of `G.hull`, else travel); any other mode → `mods.stop` only. Wheel: tower only
  (§8 makes it a no-op). Render: travel and tower render in `travel`, `dive-in` and `dive-out` only; `update` always runs.
- `G` gains `bk = max(1, min(devW / 640, devH / 360))` (device px per bridge px, not a whole number: the largest that shows
  the whole bridge; 3 at 1080, 2.4 at 864, 2.58 at 928; nearest-neighbour), `bLeft`, `bTop` (CSS px, the bridge centred),
  and the tower fit of §8 (`ts, tTop, tLeft, tY0`, a new `hull`). Stop's canvas covers the window: beside the bridge (a
  window wider than 16:9) the same drifting stars as the frame's own edges, above and below ink. Never a black box.
- **Cards wait for the picture.** A `.modal-overlay` that turns up on its own (a crew moment, a story card, the head count)
  while the dive runs, in the first 4 s of the bridge or the first 1.8 s of travel is added hidden (`.ns-held`, not in
  `BLOCKERS`) and shown once that time is over and nothing else blocks; it then ignores clicks for 400 ms (ChoiceGuard). A
  card opened within 0.7 s of the player's own click opens at once; `hide()` lets every held card show.
- `BLOCKERS` gains `.ns-film`. New shell calls: `stop(app)`, `hint()` (the first hint now, once), `mode()`.

| moment | real code | new-screen side |
|---|---|---|
| flight lands: `flow.arrive(id)` | first `bus.emit('dive:start', { id })`, mode `dive-in`; then `handleWarp(node, { flown: true })` as A | stop pushes on our hull (1.0 s) and holds plated; warp failed → `'dive:cancel'`, mode `travel` |
| `renderOrbit()` | under the switch: the storyHidden reveal as today, then `NewScreen.stop(this)`; no OrbitView, no `hide()` | in `dive-in`: `'stop:open' { id, dived: true }` (the 0.6 s dissolve to the bridge); from travel or hidden (Continue, load, anomaly teleport): mount, show, `'stop:open' { dived: false }` (fade from black); already `stop`: `'stop:refresh'` |
| the bridge is up | | stop emits `'stop:shown'`; mode `stop`; `orbitFrom = currentSystem.id` |
| "Leave orbit" | `flow.leave()` → `NSOrbit.beforeLeave(app)`: team away → refused with a line; the Structure → dispatch `req-break-orbit` at once (it refuses itself, no dive) | ok → `'dive:back'`, mode `dive-out`; at stop's `'dive:plated' { dir: 'out' }` the shell dispatches `req-break-orbit` (today's handler → `renderNav` → `show()`, which keeps mode `dive-out`); stop's `'stop:hidden'` → mode `travel`, `'shown' { first: false, from: id }` (the world slides left) |
| `renderNav()` while `travel` | as A | as A |

## 2. The stop view (A, `src/newscreen/stop/`)

Port of `prototypes/slice/stop.js` §1-3, §5-12 (not its films, MOCKUP moments or slice places), the bridge of
`prototypes/screens/layouts/variant-d/` and nothing from `explain/` (the slice's dive already supersedes it).
- `stop/BridgeArt.js` → `NSBridgeArt` (`bridge-art.js` ported unchanged but the name; `B`, `paint()`).
- `stop/Dive.js` → `NSDive`: stepGeom, platingStep, diveStep, bakeBigSteps, prepare (slice §1). From `mods.travel.landerPose()`.
- `stop/Glass.js` → `NSGlass`: backdrop, the light (grows x1.19 per world passed, from `NewScreen.game.route()`), the world
  braking in at 8 sizes (`NSWorlds.paint` of §9 for planets; `NSPaint.drawStation` for a station; five small rock spheres for
  an asteroid field; `paintGiant` pushed in on its limb for the plan's giant), red beacon on our wrecks, a slow red blink in
  the glass's sky while a call waits, the shuttle (slice §3), the skim stream at a gas giant (slice `skimFlow`).
- `stop/Stop.js` registers `'stop'`: `{ init, resize, update, render, pointer, isOpen, discs }`; people plans (slice §5:
  Cora at the helm, Mira at the nav console, the lineup at the window spots), compose (slice §6), words (slice §7), anchors
  `stop:person:<id>`, `stop:aura`, `stop:glass`, `stop:site`. Listens to the §1 events and `'trip:down'`, `'trip:back'`.
  More than 4 words: the 4 worth most show (light, escape, accept, call, date, team, dock, mine, settle, scan, skim), in the
  plan's order; the rest wait their turn. "Send the team": the pair waits at the hatch while a card is up, then goes; if the
  game still refuses, A.U.R.A. says "The team stays aboard for now, Commander." (unless someone is already saying why).
- **Words** in `#ns-stop-words`, IBM Plex, slice CSS: the world's name in the glass's corner; each action from
  `NewScreen.flow.actions()` (re-read every 250 ms and on `'stop:refresh'`) as a few words beside what it acts on (`near`,
  §3); "Leave orbit" under the window, always (not at the Wrong Place). At most 4 words lit at once, at most 40 words on
  screen, nothing under the cursor, a newly shown word ignores clicks for 400 ms.
- **The pick** (slice §8.2 UI): when an action has `team: true`, everyone in `flow.eligible()` walks to the window as the
  bridge opens. Hover: their "good for" line (slice `GOOD`, it matches §4). Click two (again to unpick); the word then reads
  "Send the team" over "Vance and Mira take the shuttle". Click it: the two walk to the hatch and climb down, the shuttle
  unclamps (2.4 s, clicks ignored), then `flow.act('team', ids)`. On `'trip:back'` the shuttle comes up and they climb back.
- **Voice on the bridge** (A also owns `Voice.js`): while mode is not `travel`, a speaker's anchor is `stop:person:<id>`,
  A.U.R.A. `stop:aura`; `say(v)` returns a Promise resolved when the line leaves the screen (for §6's talk); in mode `stop`
  a log line that reports a result (it starts `STATION:`, `MINING:`, `SIGNAL:`, `MALFUNCTION RESOLVED:`, `REPAIR COMPLETE:`
  or holds a signed number of energy, salvage, rations or data, and names none of the crew) is said by A.U.R.A. without
  its prefix: the log is hidden. A logged line still waiting 15 s later by the clock (it was news before a minigame or a
  trip) is dropped. `say({ narration: true, text })`: a line with no name, by our Lander (the bridge: A.U.R.A.'s place).

## 3. What each place offers (D, `src/newscreen/Orbit.js` → `NSOrbit`; `NewScreen.flow.actions()` returns it)

`actions(app)` → `[{ key, words, near, team, run() }]`, in this order, only those that apply to `state.currentSystem`:

| key | when | words · near | run() calls (all existing unless marked) |
|---|---|---|---|
| `light` | `isStructure`, not `structureApproached` | Go into the light · world | `handleStructureAction()` |
| `escape`, `accept` | `_isWrongPlace` (and no Leave word) | Fight to escape · Accept it · under | dispatch `req-wrong-escape` / `req-wrong-accept` |
| `dock` | `isStation`, not searched | Dock · station | `handleStationAction()` (BoardingParty picks its one boarder, as today) |
| `mine` | `isAsteroidField`, not mined | Mine it · field | `handleAsteroidAction()` |
| `skim` | `type === 'GAS_GIANT'`, not `node.nsSkimmed`, no `fuel_scoop` upgrade (it already took its fill on arrival) | Skim fuel · giant | NEW: +15 energy (cap 100), `node.nsSkimmed = true`, log "Skimmed fuel at X. +15 energy." (ECONOMY.md's skim, the only new number in B; designer to confirm) |
| `scan` | a planet, not `scanned` | Scan · world | `handleScanAction(false)` (no SignalTune) |
| `team` | a planet, not `hasEva`, `eligible().length >= 2`, Aris not refusing (BLEEDING_HEART with someone hurt: she says why once) | Send the team · site (the `siteOf` site if open, else the world) | `send(app, ids)`: §4 |
| `call` | a distress waits (`app._nsCall`) | Answer the call · the blink in the glass | `app.queueModal('distress', call)`; cleared |
| `date` | `canDate(node)` (§4) | Date the wreck · mira (else aura) | `app.dateWreck(node)` (DiscDating as it is) |
| `settle` | a planet (not station, field, gas giant, Structure, Wrong Place), `scanned` or TEST_MODE | Settle here · under the main word | `handleColonyAction()` (the settle council card, as today) |

`eligible(app)` = ids of `handleEvaAction`'s own `evaCrew` (HEALTHY, not LEADER, CONFINED or SEDATED). No eligible pair: no
team word; A.U.R.A. says once "We need two people fit to go, Commander." No probe, no remote scan, no tune: cut (GAME_FLOW §5).

## 4. Who goes, who stays, crises aboard (D: `Orbit.js` + bundle seams; numbers from SHIP_GAMEPLAY §4)

- **The sign.** When the bridge first shows for an orbit, `sign(app)` decides once and keeps it on the node
  (`node._nsCrisis = { kind, event, comes }`, saved with the nodes): `breach` when `breachDue()` (sector 1, not `_breachDone`,
  `_paidWarps >= 2`, MiniHost has breach) and the place has a team action (always comes); else, not in the last sector and
  not sector 1 before the breach, a weighted pick of `SHIP_MALFUNCTION_EVENTS` whose `condition` holds, `comes =
  testChance(0.5, 'crisis')`. A.U.R.A. says its sign once, before the pick (`kind` → line): breach / `HULL_STRESS` /
  `MICRO_METEOR` "The hull's been groaning since the last scrape."; `POWER_SURGE` "Engineering's been surging, Commander.";
  `LIFE_SUPPORT_HICCUP` "The air recyclers keep stuttering."; `CRYO_LEAK` "One of the pods keeps blinking."; others
  "Something aboard doesn't sound right, Commander." No team trip at this stop: nothing happens (a sign is a risk).
- **Send.** `send(app, ids)`: sets `app._pickedEvaTeam` to those two crew objects (handleEvaAction then skips AwayTeam.pick),
  records `trip = { ids, aboard }`, emits `'trip:down'`, calls `app.handleEvaAction()` (LanderGame, the Torch, the wreck's
  story, found pages, strip or marker, events: all today's code).
- **While they are down** (bundle seam: in `handleEvaAction` the site and event chains wait on
  `afterDescent.then(() => NSOrbit.whileDown(app, evaTeam))` under the switch): first `breakPatched(state)`; then the breach
  if `breachDue()` now (`app.playBreach(team)`: the game's own, the team not aboard) or, if `comes`, the event: `POWER_SURGE` with Jaxon aboard → no effect, log "Power surge in
  engineering. Jaxon fixed it at no cost." and his line "Got it. The drive's calm."; any other → `app.showShipMalfunctionModal(ev)`.
  Skills aboard, after it: Vance aboard and well → anyone the breach hurt is HEALTHY again ("Vance: \"I pulled them out
  before it sealed.\""); else Aris aboard and well → anyone hurt aboard is HEALTHY ("Aris: \"I've treated them. No lasting
  harm.\""). Mira aboard and well → `app._nsScanMod = -10` and "Mira: \"I've scanned the ground. Go round the soft part.\""
  (bundle: `showEventModal` adds it to the risk like the landing mod, labelled `MIRA SCANNED IT`).
- **Back.** The trip is over when the descent and `whileDown` have resolved and `NewScreen.blocked()` has been false for
  2.5 s of shown time (`NSOrbit.tick(dt, blocked)` from the shell's frame). `tripDone(app)`: Vance on the team, well, and
  the other came back INJURED → swap (log "Vance took the hit for X."); then Aris on the team, well → every team member
  INJURED on this trip is HEALTHY ("Aris strapped them up. They walked back."). Deaths stand. Emits `'trip:back'`.
  `AwayTeam.returned` is not called under the switch (the shuttle coming home replaces it).
- **Mira's star fix.** `offerDiscDating` under the switch makes no card: `fixIn(planet, miraWent)` sets
  `planet._nsFix = miraWent ? 'now' : state._paidWarps`. `canDate(node)` = `app.canDateWreck(node)` and (`'now'` or
  `_paidWarps > _nsFix`). When a late fix arrives, Mira: "The star fix is on my bench." `datable(state)` finds such a node in
  the sector: the bridge word, and the tower's bench in travel (§8), both call `dateWreck` (free, the lane waits).
- **The breach** (review fix): under the switch `handleWarp` never plays it in flight. `breachDue()` is asked as it stands
  each time (it overrides a sign kept from before): with a team action it comes while the team is down; at a place with
  no team action it comes on the bridge after 5 s of the bridge being seen (A.U.R.A.'s sign first); not yet played when
  we leave: `beforeLeave` plays it. All three call the game's own `App.playBreach(away)` (away: the team, not aboard).
- **The trip's end** (review fix): `NSOrbit.tripOver()` from the real end points (the end of `resolveEvaOutcome`, the
  paradise card, `offerDiscDating` → `fixIn` for the wreck); the shuttle comes home 0.6 s after nothing blocks and no card
  is queued. The quiet rule (3.5 s, queue empty) stays only as the safety net for the other site stories.
- **No "all clear" over a sign:** `NSOrbit.signed(app)` (decides the sign early); `reactToOrbit` then skips the crew's
  ENTER_ORBIT bark and A.U.R.A.'s ENTER_ORBIT comment.
- **A distress call** (`rollDistressSignal` after a warp) under the switch is kept as `app._nsCall` and offered as `call`,
  not popped up; leaving orbit without answering drops it (log "We left the call unanswered.").
- **Damage: fix, patch or live with it.** A red deck in the tower (travel), clicked: `deckChoices(state, key)` → three
  choices: **Fix** "costs salvage" → `state.repairDeck(key)` (its price from the one rule, `GameState.repairCostOf(key)`:
  Jaxon alive −30%, engineering down +50%; can't afford → A.U.R.A. says so); **Patch** "a little salvage" (−5, now): status OPERATIONAL, `deck._nsPatched = true`; not
  offered on a deck marked `_nsWorn`; **Live with it**: closes, today's broken-deck costs apply. `breakPatched(state)` (on a
  crisis aboard and at `startSectorJump`): every patched deck breaks again through `state.damageDeck(key, line)` (its
  event, its first-damage line) with `_nsWorn = true` (only Fix clears it), A.U.R.A.: "The patch on the X didn't hold." Tower deck → game key: hold = `cargo`; the med bay has no deck in the game.
- No warp-time malfunction roll under the switch (it is the crisis aboard now); everything else in `handleWarp` as A.

## 5. Bundle seams (D, `src/bundle.js`, CRLF kept, `v=79`; each behind `isNewScreen()` or `window.NEW_SCREEN && window.NSx`)

`showStartMenu` (§6) · `showOpeningBriefing` (§6) · `handleWarp`: no breach in flight (NSOrbit plays it at the stop), no
malfunction roll, distress → `NSOrbit.offerCall(this, d)` · `reactToOrbit`: no ENTER_ORBIT bark or A.U.R.A. comment when
`NSOrbit.signed(this)` · `renderOrbit` (§1) · `handleEvaAction` + `resolveEvaOutcome` + `showEdenEvaModal`: `whileDown`, no
`AwayTeam.returned`, `NSOrbit.tripOver()` at their ends · `showEventModal`: `_nsScanMod` · `offerDiscDating`: `fixIn` ·
`startSectorJump`: `NSOrbit.breakPatched(state)` · `autoSave`: no green SAVED pill · the sector-change card's header in
plain words ("Into the Dark Void") · the ship-alert card's choice "Deal with it". Shared by both games, same behaviour off
the switch: `OPENING_TALK` (the wake-up talk, one copy, `window.OPENING_TALK`; the card builds the very same words from
it), `GameState.repairCostOf(key)` (repairDeck's own price rule, now one function), `App.playBreach(away = [])` (the
default never passes `away`). Nothing else changes. `OrbitView.js` is not touched (it no longer renders
under the switch). `index.html`: the switch script also sets `document.documentElement.classList.add('ns-on')`; the load list
of §10 (with `cards.css`), every changed file's `?v=` bumped.

## 6. The start (B, `src/newscreen/start/`)

- **Title** (`start/Title.js` → `NSTitle`). `markup({ hasSave, saveInfo, soundLabel, audioIsOn })` returns the overlay's
  inner HTML with today's ids (`btn-continue-game`, `btn-start-game`, `erase-confirm`, `btn-erase-yes`, `btn-erase-keep`,
  `audio-status`, `btn-toggle-audio`) so bundle's logic is unchanged; `mount(overlay)` paints and runs its canvas until the
  overlay leaves the page (bundle calls it after `appendChild`; the loop never checks `isConnected` before its first frame).
  The look: the dark field (`NSPaint.spaceStrip` + `paintSpace`), the far warm light low right (`lightGlow`, sector 1's
  size), our Lander small, nose on the light, plume burning (`NSPaint.hull` + `shapeL`), "Silent Exodus" in IBM Plex Sans
  Condensed, the line "Eight went before you. None of them called home.", CONTINUE and NEW GAME as words (warm on hover),
  the save line, "Erase the saved run?" lower down, the sound line. No ringed planet, no green, no boxes. Bundle (D): under
  the switch the overlay gets `className = 'ns-title'`, `NSTitle.markup(...)`, no `addHoverEffect`; id stays `start-menu`.
- **The launch film** (`start/LaunchArt.js` → the six shots and their drawing, `start/LaunchFilm.js` → `NSLaunch.play()`
  → Promise): `prototypes/films/launch.html` take two (42.5 s), its LINES and broadcast graphics as they are (ids prefixed
  `ns-film-`), in a fixed `.ns-film` overlay (z-index 5000); a click, Esc, Enter or Space skips; resolves at the end.
  `start/Dress.js` loads right after `crew/CrewEngine.js` and wraps `register` exactly as the film's dress block does.
  **Sound** (`start/FilmSound.js` → `NSFilmSound`, `film-sound.js` ported, no button): built only when `AudioSystem` exists
  and is not muted; the game music pauses for the film and resumes after. With `?mute=1` no AudioContext is created.
  Bundle (D): in `showOpeningBriefing` under the switch the reel is `NSLaunch.play()` (TEST_MODE skips it, as today).
- **The wake-up talk** (`start/Wake.js` → `NSWake`): replaces the "Good morning, Commander" card and its "Take command"
  choice, reading the card's own words from `window.OPENING_TALK` (one copy, §5). `start(app)` waits for `'opening:done'`
  (or runs at once if the tower is already in), then says, one at a time: the card's context as narration by our Lander
  ("...the ship has woken all five of you": the four-or-five count starts here), its six lines beside each speaker, then
  the rules from its choice minus the stop count ("Six sectors ahead. Energy moves the ship. Rations feed the crew.", by
  A.U.R.A.); each also logged. The sixth line has no "I have marked it on your map" (no map). Then `NewScreen.hint()`,
  which replaces begin()'s beacon line ("Systems online..." is not said: the hint waits for orders). `pending()` is true
  until then; the shell's own first hint waits while it is. No poller is left running: a cut settles the line at once.

## 7. The cards (B, `src/newscreen/cards.css`, every rule under `html.ns-on`)

EncounterCard (and so the settle council, malfunctions, distress, stations, mining, crew moments, the head count),
FoundPage and the disc document (`.disc-doc`): the slice's tokens (`--ink #05070a`, text `#e4e4e0`, dim `#8b8d90`, warm
`#f08c2e`, IBM Plex Sans / Condensed / Mono), a dark dithered backing instead of the green dashboard border, scanlines and
glow; gain chips warm, loss chips a brighter red; at least 14 px to read, 12 px chrome; 4.5:1 contrast. CSS only: no
markup, no JS, no change to `display`/`position` of `.enc-decide`, `.enc-choices`, `.enc-flow` (ChoiceGuard places the
choices away from the cursor and holds them 400 ms: check both still work). Minigames, BoardingParty, StoryReel: untouched.
Also (review fix) every panel on `.deck-panel` that is not a card or a page: first of all the team-on-the-ground choice of
every trip (`.eva-panel`), then the deck, crew and cargo panels: ink, IBM Plex, the choices as words with the reward warm
and the risk in steel (low), warm (middling) or red (high); the inline colours of "GOING IN" are matched (safer warm, more
dangerous red). Markup and handlers are bundle's, unchanged.

## 8. The tower fits (C, `tower/Tower.js`, `tower/TowerMarks.js`; the formula lands in `NewScreen.measure()` by D)

Frame (tower px): rows `tTop = L.TOP0 − 40` to `L.TAIL0 + 48` (all six decks whole, the nose's shoulder, the bell's top:
1336 rows), columns from `tLeft = 40` (the whole hull, both walls). `ts = devH / 1336` device px per tower px (1080: 0.808,
crew about 84 px tall; 720: 0.539, about 56 px); if the tower would take over 45 % of the width, `ts` shrinks to fit and
the tower centres vertically (`tY0`). `G.hull = ceil((HULL_OUT − tLeft) × ts / k)` art px: about 26 % of the width at both
sizes, space keeps the rest. C draws `TowerArt.draw` + `NSTowerMarks.draw/vignette` into an offscreen canvas in tower px
(`camY = tTop`, `offX = −tLeft`), then onto `canvas#ns-ship`, now sized in device px, scaled by `ts` with
`imageSmoothingQuality 'high'`; the slide-in moves that image. The wheel does nothing (`pointer('wheel')` → false); the
scroll state goes. `personAt`, deck anchors and hits convert through `ts, tTop, tLeft, tY0`. Clicks in travel (new):
a person → `flow.person(id)` (their `ShipRoutine.line`, said beside them, not logged: saves keep only 20 log lines); Mira's bench or Mira while
`NSOrbit.datable()` → `flow.bench()`; a red deck → its three choices in `#ns-ship-words`, away from the pointer, 400 ms
guard → `flow.deckChoose(key, i)`. Pointing at a red deck names it ("The engine room, broken" over "Fix, patch or live
with it"); the first time a deck goes red A.U.R.A. says once, in travel: "The engine room is broken, Commander. Click it in
the ship to fix it." The red wash is stronger (0.78 / 0.58). Travel (C too) re-checks its composition with the wider space.

## 9. Planets with character (C, `src/newscreen/art/Worlds.js` → `NSWorlds`; used by Pictures and by A's Glass)

`paint(p, { cx, cy, r, node, sector, L, grey, ramp, atmo })` paints one world in the house style (ART_STYLE: ramps from the
ink, Bayer dither, one light, seeded by the node id) with **one surface character and at most one companion**, legible from
r 14 (a far world) to r 90 (the bridge glass), never noisy; `live(framer, node, x, y, r, t)` adds the few moving pixels.
Type decides the surface: ROCKY craters · DESERT dunes and one pale dust storm · ICE_WORLD / FROZEN_OCEAN polar cap and long
blue cracks · GAS_GIANT banded clouds with one storm oval · CARBON dark with glints on the lit edge · SULFUR ochre patches,
one hot spot glowing on the night side · VOLCANIC lava cracks glowing on the night side · TOXIC thick green-yellow haze rim ·
OCEANIC / VITAL / EDEN sea, land, cloud swirls · TERRAFORMED / MACHINE_WORLD / MECHA lights in a grid on the night side ·
STORM_WORLD one great spiral, lightning flickers on the night side · ROGUE unlit but a faint aurora and warm cracks ·
CRYSTALLINE facets that catch the light as it turns · SHATTERED split in pieces with a debris arc · MIRROR dark glass with
one sharp reflection of the light · HOLLOW a dark pole opening lit from inside · SINGING standing-wave bands, a slow pulsing
rim · GHOST_WORLD dithering in and out · BIO_MASS / FUNGAL / SYMBIOTE mottled, faint lights on the night side · TOMB_WORLD /
GRAVEYARD grey, rows of pale specks at the dusk line · RADIATION_BELT aurora at both poles · TIDALLY_LOCKED hot day, ice night.
The companion, first that fits: our wreck (`EXODUS_WRECK`, first signal) a hull glinting in orbit, plus the red beacon as
A; `FAILED_COLONY` / `ANCIENT_RUINS` ruins catching the light at the dusk line; `DERELICT` / `WRECKAGE` debris specks;
`ANOMALY` a thin, too-perfect ring of light; `LIGHTHOUSE` a slow blinking point; else by seed a thin ring (gas worlds), a
small moon, or nothing. **Sectors grow stranger**: 1 muted and familiar (a moon or a ring at most); 2 cold, frost and
aurora; 3 colour shifts and the anomaly shimmer; 4 the living worlds and colony lights; 5 broken and crystalline geometry;
6 worlds that reflect the light. Rings and moons stay inside the sprite and count in `F.discsOf` (no overlaps, no words on them).

## 10. Files, owners, load order (all new files LF, `'use strict'`, IIFE, under 800 lines, no `Math.random` in art)

| builder | owns (and only edits these) |
|---|---|
| **A** stop view | `stop/BridgeArt.js`, `stop/Dive.js`, `stop/Glass.js`, `stop/Stop.js` (new); `Voice.js` |
| **B** start, talk, cards | `start/Dress.js`, `start/Title.js`, `start/LaunchArt.js`, `start/LaunchFilm.js`, `start/FilmSound.js`, `start/Wake.js`, `cards.css` (new) |
| **C** tower and planets | `art/Worlds.js` (new); `tower/Tower.js`, `tower/TowerMarks.js`, `travel/Pictures.js`, `travel/Field.js`, `travel/Travel.js`, `travel/SectorLooks.js` |
| **D** flow | `Orbit.js` (new); `NewScreen.js`, `Route.js`, `newscreen.css`, `index.html`, `src/bundle.js`; runs §11 last |

Load order (index.html, under the switch): Paint, Sky, Sky2, **Worlds**, CrewEngine, **start/Dress**, the five people,
ShipArt, ShipRooms, ShipReactor, ShipRoutine, TowerArt, NewScreen, Route, **Orbit**, Voice, SectorLooks, Field, Pictures,
Travel, TowerMarks, Tower, **stop/BridgeArt, stop/Dive, stop/Glass, stop/Stop, start/FilmSound, start/LaunchArt,
start/LaunchFilm, start/Title, start/Wake**; CSS `newscreen.css`, `cards.css`. D lands first (within the first hour): the
modes, `G` fields, canvases and layers, `flow.actions/act/eligible/leave/bench/person/deckChoose/sign` (stubs are fine at
first), the bus events of §1 and §4, so A, B and C test against the real shell. Until then a builder may use
`tools/ns-harness-<name>.html`, deleted before done. Nobody edits a prototype, an art port of A (Paint, Sky, crew, ship, TowerArt)
or another builder's file; a needed change goes to its owner. Prototype files are read, never loaded by the game.

## 11. Acceptance (each builder for their part; D for all, last)

1. **Default game unchanged.** Without `?new=1`: no request to `src/newscreen/` (`performance.getEntriesByType('resource')`);
   a run new game → the old title and briefing → a warp (WarpPlot) → today's orbit → leave → JUMP SECTOR → Corridor →
   sector 2, no console errors; screenshots match A's baseline (title, map, orbit at 1920x1080 and 1280x720).
2. **Under `?mute=1&new=1`, the title to sector 2**, real clicks: the new title, NEW GAME, the launch film (skipped once,
   watched once to the end), the field, the six talk lines beside the speakers, the hint; every stop opens on the bridge by
   the dive (never `.orbit-view-container` or `.command-deck` in the page, never the header or log); Titan: the sign, the
   pick of two, the shuttle, LanderGame, the Torch, the wreck's card, the disc page, strip or marker, the shuttle home, Date
   the wreck at once (Mira went) or after the next warp (she stayed, then the tower's bench); the breach as the crisis
   aboard with the team down; a red deck: fix, patch (then a crisis or the jump breaks it), live with it; a station (Dock,
   BoardingParty), the gas giant (Skim, +15), a scan and Settle here up to the council's "Not yet"; Leave orbit dives back
   out and the world slides left; the light, the Corridor, sector 2's arrival. Continue in orbit reopens the bridge.
3. **The tower fits**: at 1920x1080 and 1280x720 all six decks' floors are on screen with no scrolling, the crew readable
   (judged at full size), space at least 55 % of the width, the wheel changes nothing.
4. **Planets**: a still of each sector's field (1-6, `debug`), and the bridge glass for six types, judged at full size: each
   world tells its type at a glance, at most two features, no noise, sector 6 the strangest.
5. **No console errors or warnings** (CDP `Runtime.exceptionThrown`, console errors) in every run; frame time under 12 ms at
   1920x1080 in travel and on the bridge; at most 40 words on screen at any moment; `?mute=1` silent, no AudioContext.

Testing (everyone): a temporary static server from the repo root on your own port (A 8931, B 8932, C 8933, D 8934; never
8000 or 8010), headless Chrome always with `--mute-audio` and its own profile under the run's scratchpad `buildb/<A|B|C|D>/`,
the game at `?mute=1&new=1` (and once without `?new=1`); screenshots there; stop the server and Chrome when done. Never the
browser pane. No git add, commit or push. Plain speech (docs/STYLE.md), first names, no dashboard look.

## 12. After the reviews (2026-10-11, port 8927)

Fixed from the code and play reviews: the wake-up talk's lost lines (§6); the away-team panel's old look (§7); the bridge's
black box in a normal browser window (§1); cards covering the world the moment the dive ends (§1); the breach never in
flight, re-asked each time, and at a stop with no trip (§4); the trip's real end points (§4); one price rule and the
game's own damageDeck and playBreach (§4, §5); the send that silently failed, Aris's refusal, more than 4 words (§2, §3);
person clicks no longer fill the saved log, crew lines no longer said by A.U.R.A., old lines dropped after a long block
(§2); skim vs the fuel scoop, no settling a gas giant (§3); the red deck's name and A.U.R.A.'s pointer (§8); the green
SAVED pill, the code-like jump header, "DEAL WITH IT" (§5); Continue in orbit then Leave orbit now glides out to travel
(not the sector's opening); no "all clear" over a sign (§4). Planets (§9): desert a dark dune belt and one big pale storm
with arms; ice a clear white cap (and a smaller one at the far pole), a darker rim, two families of cracks; frozen ocean a
crisp cap; carbon a few sharp crossed glints instead of specks; sector 1 a little less muted; sector 2 frost caps and limb
rime on every rock, a pale blue air, an aurora arc on three in four of the non-living worlds; a bigger moon on far worlds
(45 % of worlds without a story companion); a far wreck a bright sliver.
Replayed: ?mute=1&new=1 from a clean title to sector 2 (film skipped, talk, Kryos wreck trip with Torch and the disc page,
dating offered, head count after leaving, the breach while the team was down, the panel, Aris's treatment, patch, the
patch breaking on the jump, the Corridor, sector 2, a gas giant, Continue in orbit and Leave orbit), at 1920x1080,
1902x928, 1536x864 and 1280x720; the default game (?new=0) once: old title, film, the card's same words, map, a warp into
today's orbit. No console errors in any run. Not replayed: the settle council and a station dock (code untouched since
the play review).
Still open: the minigame and lander rewrite in the same working tree (12 files and `minigames/art/`, not checkpoint B,
changes the default game, no cache-busters, four files over 800 lines) must stay out of a B commit and get its own review;
`Stop.js` is 708 lines (keep it under 800); the skim number and the scoop rule are the designer's call (ECONOMY.md).

Left for later (C and D checkpoints): the reactor showing the price, signs and asks, the meal, the record (L) and Esc menu,
words for results instead of the hidden log, the throw into sector 3 still opening WarpPlot.
