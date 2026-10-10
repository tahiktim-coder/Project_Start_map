# The route and its limits (2026-10-09, revision 2)

Your words: "some way to have a fork? it was weird flying over like that and waiting", and on the stop limit,
"not sure what you mean, run some good agents to help resolve this properly". Three designers wrote routes, one
simulator played them, and a checker then re-ran that simulator and found three claims that did not hold (the run was
too long once dating is counted, energy decided nothing, and the forks were mostly luck). This revision fixes those.
**The picture:** route-diagram.png (sector 1, a diagram for this page, not the game screen). **Status:** a proposal.

## 1. The answer in five sentences

1. **How a sector works:** a few worlds on two ways that end at the story world. Sector 1 has two forks; sectors 2
   to 6 have one each. You click a world, we fly there in about ten seconds and pull in. Nothing slides past.
2. **Where the forks are:** two worlds, one on each side of the sector's enormous thing (in sector 1, over or under
   Kryos's rings). Take one and the other drops out of sight behind it. You can change your mind during the flight.
3. **What limits you:** the map. One world at each fork, and you can see that. Energy only says no near the end,
   and only to a player who never skims fuel. A.U.R.A. warns before that happens.
4. **How you know before you choose:** at a fork you see just the two worlds and, far ahead, the story world's slow
   white pulse. Point at a world (tap, on a touch screen) and you get its name and one short tag.
5. **If you run dry:** a gas giant always takes us in, because the skim pays for its own pull-in. The story world is
   always reachable. A jump on the reserve arrives with 10 energy and a broken deck, never stuck.

**Your three "not sure what you mean" answers, in plain words:**
- **The stop limit (question 2).** Today the game allows 2 or 3 stops per sector, shown as three small circles.
  That is why it said "NO STOPS LEFT" when you still had energy. That limit goes. What limits you now is what you
  can see: one world at each fork.
- **The small outside Lander (question 3).** Layout A shows our ship cut open on the left and space on the right.
  On the space side you also see our Lander from outside, flying. It turns toward the world you point at. When we
  pull in, the camera moves into its hull and you are on the bridge (layout D).
- **No numbers while flying (question 5).** Every stop costs the same, so there is no price to show. The ship
  shows what is left: a long bright engine plume and lit portholes when we are full, a short plume and dark ports
  when we are low. A.U.R.A. speaks when it starts to matter. The numbers are in the record (L).

## 2. Sector 1, minute by minute (the simulated careful player: Titan every run, Erebus every run)

| time | space (right) | the ship (left), or the bridge at a stop |
|---|---|---|
| 0:00 | From black: our Lander, "The Graveyard". Kryos's rings ahead, the light beyond. | The crew climb out of their pods. |
| 0:20 | Fork 1 in view: Platform Zeta above the rings, Titan-61 IV below. The contact's pulse far ahead. | A.U.R.A.: "A station above the rings, one of ours below." |
| 0:35 | Click Titan. We dive under the rings; Zeta goes behind them. | The plume flares. |
| 0:45 | Pull in: into the hull, the bridge. Vance and Mira go down. | The surge aboard: Jaxon handles it. A marker. |
| 2:15 | Leave. The Lander cruises on; stars and dust keep streaming. | The disc drawing. Mira dates the fix at her bench (90 s). The contact becomes Rhea-4 Minor, free. |
| 3:45 | Fork 2: Kryos's near side, or round the giant to Erebus's red beacon. Click Erebus. | The breach hits the lab (the fix is already in). |
| 3:55 | Erebus: someone answers. | A call: who goes, a day of rations. |
| 5:25 | Click Rhea-4 Minor. | The first page. |
| 7:05 | "The jump is ready." Click the light. The corridor. | The first meal. |

About 8 minutes, a minute over SHIP_GAMEPLAY §10's 7: sector 1 teaches, so it is the longest. At rest, at most two
names and tags on screen. No lines, no count.

## 3. The rules on screen

- **One click goes and pulls in.** For one second you can cancel. During the ten-second flight, click the other
  world of the fork to turn to it, at no cost. The world you didn't take greys only when we arrive. Click any world
  further along and we fly straight there; the ones we pass grey as they go behind us.
- **Nobody waits in empty space.** While you choose, the Lander cruises slowly on the heading, plume burning, stars
  and dust streaming. The fork's worlds grow but never pass. Nothing arrives until you click.
- **Dividers, one per sector:** 1 Kryos's rings (fork 1) and Kryos itself (fork 2); 2 the rogue world, the black
  disc where the stars stop; 3 to 6, to paint in SectorPaintings.js: a dead star in its dust shell, a long dust lane,
  the drift of hulls the Tally is named for, the light's own glare.
- **What's left, always on screen:** the outside Lander's plume and portholes, and in the ship the core and the ladder
  well (missed beats when low). Pulling in dims them a little; a skim floods them.
- **A.U.R.A., once each, in words:** when what's left covers only the jump: "After this we can only jump, Commander."
  Before a pull-in that would put the jump on the reserve: "After this we jump on the reserve. Still go?" Before the
  story world when Mira stayed aboard and the fix is late: "The fix isn't in yet, Commander."
- **The story world:** free once a wreck in the sector is dated, 5 if not; sector 6's is always free. The light
  answers only after the story world, so no page is skipped by jumping early. Sector 1's breach waits until the fix
  is dated or no wreck is left. The disc drawing is in the first of our wrecks you board, or at Rhea-4 Minor.

## 4. The numbers

**Start (unchanged):** energy 100 (cap 100), rations 25, salvage 50. **Prices:** every pull-in 5 (bridge down: 7);
flying is free; story world free once dated, else 5. Jump 8, +1 per carried pod (engineering down: ×2). The crew
eats 5 rations a jump. **Gains:** skim +15 (it can always be pulled in: the skim pays its own way); a station's power
room +10 to 16 (half the stations); a wreck's cell +12 (one wreck in three). **New:** a jump on the reserve arrives
with 10. Sectors 1 to 5 each have a giant on one way. Food as in ECONOMY.md.

| sector | the worlds, in order (→ = then) | careful stops | energy on arrival | minutes |
|---|---|---|---|---|
| 1 Graveyard | fork: Platform Zeta (station) / Titan-61 IV (our wreck) → fork: Kryos (skim) / Erebus (call) → Rhea-4 Minor | 3.0 | 100 | 8.1 |
| 2 Dark Void | the tape wreck and its sleepers (every way) → fork: the dark giant / a call → Dione-2 | 3.0 | 80 | 7.0 |
| 3 Signal | fork: a wreck / a giant → Mimas | 2.0 | 73 | 6.1 |
| 4 Garden | fork: a wreck / a giant → Eden (every way) → Pallas | 3.0 | 55 | 7.6 |
| 5 Tally | fork: a wreck / a giant → Iapetus | 2.0 | 34 | 5.8 |
| 6 Light | fork: the last wreck / a world we could live on → Tethys (free) → the light | 2.0 | 18 | 5.1 |

The sleepers are the first stop of sector 2, so carrying them is a choice inside a stop. Hyperion-52 (the old
meeting place) and Chronos and Zephyr leave sector 1.

**Minutes model** (the checker's fix): 90 s a stop with a team, 40 s a skim, 90 s the story world, **90 s a dating**
(GAME_FLOW's figure; the old 60 s here is dropped), 10 s a flight, 60 s a jump, and the sector openings (35 s, then
20 s each). Not counted: talks and crises aboard. 2,000 runs per player, every hidden draw tied to its place.

| player | stops | minutes (60 s dating) | used the reserve | "We can't afford that one" | energy at the light | score beyond the pages |
|---|---|---|---|---|---|---|
| careful (plans ahead) | 15.0 | 39.6, p90 40.4 (36.8) | 0.1% | 0% | 13 | (the yardstick) |
| rule of thumb: skim when the ship looks low | 15.0 | 39.3 | 0% | 0% | 15 | −1% |
| coin flip at every fork | 15.0 | 36.1 | 0.3% | 0% | 22 | −8% |
| first run: pulls in everywhere, ignores A.U.R.A. | 14.9 | 38.7 | 0.1% | 6.4% of runs | 10 | about the same |
| story only | 12.0 | 36.2 (33.2) | 0% | 0% | 44 | −61% |

- Every player finds 6 of 6 pages. The careful player dates 4.9 of 6 story worlds and keeps 2.98 of 3 sleepers.
- **The map is the limit, and energy isn't:** with unlimited energy the careful player makes the same 15.0 stops.
  A first-time player who pulls in everywhere scores the same as a careful one: there is no trap.
- **Where energy bites:** late. The first-run player's "can't afford" comes at sector 6's fork (6% of runs) or
  sector 5's (2%). The pod question (turn one off for energy) comes up in 2% of careful runs and 5% of first runs.
- **Safety rules, measured:** without the skim rule, the reserve arrival and the free last story world, the
  first-run player used the reserve in 12% of runs and stayed dry to the light in 2%. With them: 0.1% and 0.2%.

**The forks, honestly.** Picking every fork at random costs about one ordinary place per run (8% of what a run
collects beyond the pages). The one-line rule above costs 1%. Four forks are choices of taste, with the same pick
every run for the careful player: sector 1 both (Titan, Erebus), sector 2 (the giant), sector 6 (the wreck). They
choose what you see and who you help, never the story. Sectors 3 to 5 are the fuel question, and the answer moves
with what's left: wreck 98% in sector 3; in sector 4 a skim 23% of the time when we arrive at the fork with 40 to
59 energy; in sector 5 a skim 17% of the time below 40. Food forks don't count while food never runs short
(12 rations at the light); that belongs to the card pass.

**Honest limits:** the careful run is at the top of 30 to 40 minutes with slow dating. If the stopwatch says more,
cut sector 4's Eden first (about 1.7 minutes), never a scene. The simulator (scratchpad route/v2: sim.js,
maps_v9.js, crit2.js; flags `--rescue --s6free --undated=5 --set=reserveArrive:10 --dry=1`) must re-run after any
map change.

## 5. Before we adopt this: two checks

1. **Forks in the real travel view.** Mock fork 1 and fork 2 of sector 1 inside game-screen-v3 with sky C, at
   1920x1080 and 1280x720 (space keeps at least 55%). Pass: no lines; at rest at most two names and tags (about
   12 words); both worlds big enough to point at and tap, clear of the light's glare (GAME_AUDIT 5.6); the world
   not taken visibly goes behind the rings. Dropped: the 3-second wide look of every way and "pointing lights up
   what you can still reach" (every pick reached the same worlds, so it said nothing).
2. **The stopwatch** (SHIP_GAMEPLAY §10): sector 1 with dating and the docking, against the 8 minutes above.

## 6. Why not the other two, and what I took from each

- **Free sector** (go anywhere): nothing caps the stops but fuel and giants refill it, so runs ran longest; no
  forks, and you asked for one. **Taken:** no stop count.
- **Forks on a moving lane** (today's GAME_FLOW plan): worlds slide past while you wait, the thing you called
  weird. **Taken:** a fork is two worlds side by side.
- **Branching lanes** (bands of 2 or 3 worlds): a band of three is a lot to read. **Taken:** the shape, nothing
  passing without a click, every way ending at the story world.

## 7. What changes in the other documents

**docs/GAME_FLOW.md**
- §1 items 7 to 9 and §3 rules 1, 3, 4: the ways replace the moving lane. One fork per sector, two in sector 1;
  you see the next fork, not the whole sector; nothing passes without a click; no stop limit.
- §2.3 to §2.5: one click goes and pulls in (1 s cancel, switch during the flight); cut "the ship slows to half
  speed" and "the first time a world passes"; the Lander cruises while you choose.
- §2.8: dating is 90 s everywhere. §2.10: the jump only after the story world. §3: the undated story world is 5,
  not "about 6"; the sector 1 table becomes section 2 above. §4: "every 16 s, stop or pass" becomes "every 20 to
  40 s, pick the next world". §5 checkpoint C's headless runs: careful 36 to 41 minutes, every player 6 of 6 pages,
  first-run reserve use under 1%. §6 questions 1 and 2: answered by this page.

**docs/ECONOMY.md**
- §3: "Warp: 4–6, by distance" becomes "pull in 5, flying free"; add the skim rule, the reserve arrival of 10, a
  giant in sectors 1 to 5, the free last story world. "Where each choice sits": "which dot" becomes "which side of
  the fork". §5: "Keep as is: stops per sector (2–3)" goes; add the first-run player to the headless checks.

**docs/SHIP_GAMEPLAY.md**
- §3 "the reactor shows the price" becomes "the ship shows what's left": no per-world charge, since every stop costs
  the same. Cut "some worlds get turned down"; the reactor's job is the fuel forks and A.U.R.A.'s three lines.
- §4: Mira aboard still makes the fix late; A.U.R.A. now says so. §10: Titan, then Erebus, then Rhea-4; Chronos and
  Zephyr go; the breach waits for the fix.

**src/data/StoryPlanets.js** header: the contact can be reached undated (5); drop "A.U.R.A. names it when one stop is
left". **src/bundle.js:** `getStopsLeft`, `MIN_STOPS_PER_SECTOR` / `MAX_STOPS_PER_SECTOR`, "OUT OF REACH, NO STOPS
LEFT" and their callers go (lines 792, 994, 1645, 1673, 2299, 2784, 5436); `getWarpCost` becomes the flat 5.
