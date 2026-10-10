# What you do in the ship (2026-10-09, revision 2)

The designer: "what game elements do we even have with the ship view? ... need main player actions that are fun and not
just filler, but for the ship." Also: "the pulsing reactor downgraded to basically a lamp." Settled rules: the ship sits
beside the journey (layout A, `prototypes/screens/layouts/variant-a.html`); a stop opens on the bridge with the big
window (layout D, `variant-d.html`); no fabricator or upgrades; no meters or numbers on screen; no scorecards; at most 40
words on screen, one line at a time; the loved minigames stay as they are; no new story.

**Revision 2** answers a review: the first draft's seven actions were mostly menu choices drawn as a room, several with
one right answer. What changed is in section 9.

## 1. The core idea

The journey spends the ship's energy; the ship spends its people. The ship is built around two main verbs:

1. **See the price in the reactor.** Point at a world and the reactor shows what it will cost before you commit.
2. **Choose who goes and who stays.** Every trip leaves the ship with two people and something about to go wrong.

Everything else is a scene that comes up when it matters, or how a standing moment is delivered. You read the crew by
watching what they do. A choice with an answer you'd always pick is cut, or given a counter-pressure.

## 2. The stage: what you can see, and how fast it answers

- **Layout A frames the bridge, the lab and the galley** (the SHOTS in `variant-a/main.js`: pair0, deck0, deck2). Every
  sign, scene and choice must show on those three decks, or reach them: light up the ladder well, a sound, someone
  saying it in passing on the bridge ("Has anyone seen Vance?"). The tower never moves by itself during travel; you can
  scroll it, but nothing requires you to. Plates go on the galley wall over the table; pages above Mira's bench.
- **No waiting on ladders.** Clicking a person answers at once: a quick dissolve, and Cora is already there. The crew
  walk and climb while the journey carries on, never while the player waits.
- **The transition the designer loves stays.** Pulling in to a stop uses the ship view's push, quarter turn and plating
  dissolve (GAME_SCREEN_V3.md, "The ship view") to go from the journey to the bridge close-up (D). Leaving orbit plays it
  backwards. E still opens the full living ship at any time.
- **Only three things are announced**, one line each from A.U.R.A.: a breakdown, a crisis aboard, a world you can't afford.

## 3. Verb one: the reactor shows the price

Why it's a lamp: energy runs 100, 82, 56, 47, 26, 10 over six light steps (`LEVELS = 6`), one change a sector; it sits
off screen in A; and the loved pulse is the game's music beat (`reactorBeat`, ShipCutaway.js:80), not the living ship's.
So the reactor moves **when you choose**:

- **Point at a world:** a charge gathers at the core and climbs a conduit up the ladder well into the bridge console.
  The bigger the warp, the bigger and longer the charge, and the core dims by the share it would lose while you point.
  A short hop is a flicker; a long one darkens the well. Look away, and it settles back.
- **Commit to the warp:** the charge fires, the plume flares on the hull, and the core drops. The drop is the real cost.
- **The jump:** the ring spins up and light floods the well. **A gas-giant skim** (+15): the core floods, the other way.
- **The beat:** carry `reactorBeat`'s tie to the music over. It shows in the well, the hull's lit ports and the plume, so
  it is on screen in layout A. Low energy keeps the existing look: missed beats, the red lamp, the ring straining.
- **A.U.R.A. speaks once, unprompted**, when you point at a world and the price matters, in decision terms: "This
  leaves enough for the story and one more place." / "We can't come back from this one, Commander." Never a number.
- **Clicking the reactor** gets a remark from whoever is nearest ("She's running hot."), not a number.
- **Why it isn't filler:** every warp is read from the core before you commit, and some worlds get turned down.

**The pods** (if you carry the sleepers, from sector 2): three blue pods in the hold, and a thin blue line from the core
that ticks once on each jump as they draw 1 energy (ECONOMY.md). When the tank runs low, A.U.R.A. asks once whether to
turn one off: +13 energy, a stranger dies, the vote ending closes. Jaxon does it; there's no "who". The pod stays dark for
the rest of the run, Aris writes the name in her book, and the dark pod shows in the last walk (section 7). The pods also
come up once when it isn't about fuel: Mira sits by them after the first jump with them aboard (one line, no choice).

**Fix first** (ship-sim.js): "Four people in stasis" → "Three people in stasis"; Vance's "Four strangers in my hold." →
"Strangers in my hold. I don't like it."

## 4. Verb two: who goes down, and who holds the ship

At every stop with a site (a wreck, a story planet, a station, a strange site), the crew who can go stand at the bridge
window (D). Click two. The hurt, the shut-in and anyone mid-repair don't come up, so you see who's missing. Cora always
stays: she commands, and she is the one who talks.

**Before you pick, the ship tells you what may go wrong aboard.** One sign, shown on the bridge: A.U.R.A. says "The hull's
been groaning since the last scrape", or the console sparks, or a pod blinks. While the team is down, that **crisis
aboard** happens about half the time, and the two who stayed decide how it goes. It is a scene with one line and two
chips, never a new minigame; if it is a breach, it is Breach.js itself.

| person | on the team | holding the ship |
|---|---|---|
| Vance | once a trip, he is hurt instead of the other person. A second hit, or a deadly site, still kills. | holds a door in a breach: nobody else is hurt |
| Aris | anyone hurt on the trip walks back up fit, with no med bay stay. She doesn't prevent deaths. | the med bay works: anyone hurt aboard is treated |
| Jaxon | stripping gives +30 salvage, not +20; the torch gets one extra tank | a surge is fixed with no cost; a repair is done during the trip (section 6) |
| Mira | reads the wreck's screens: the star fix comes back now, so you can date it at once | scans the site for the team: the hazard is named on the radio before it fires, and they can turn back |

- **Mira's trade-off:** down, she brings the fix and keeps the free course. Aboard, the team goes down scanned. Without
  her, the fix comes a stop later, and if the story planet is the very next stop, the free course is lost (4 to 6 energy).
- **No pair is always right.** Every sector has at least one stop where last time's best pair is wrong: a breach sign
  when Vance and Mira want to go, a surge sign when Jaxon is the only one who can carry the metal. This is checked in the
  headless runs (step 17): no pair may be the best pick more than about half the time.
- **A crisis aboard nobody answered well** costs something you can see: a red deck, a hurt person in the med bay, a pod
  gone dark, a contact on the journey that fades before anyone reads it.
- **You see:** the two climb down past the galley; their posts stay empty; the airlock is heard, not watched. About 14
  picks a run, about 7 crises aboard, more on worn decks (section 7).

## 5. Talks: standing moments and asks, not stress upkeep

The stress code stays (0 to 3, a trait at 2, a breakdown at 3, `applyStressTraits`, bundle.js:803), and it shows as what
people do. Stress falls by itself, by 1 for everyone on each rest jump, while the quarters work. There is no "Listen"
button and no talk budget.

| | stress 1: their routine changes (on a seen deck) | stress 2: the trait | stress 3: the breakdown |
|---|---|---|---|
| Jaxon | skips the galley meal; tools clank up the well | argues against markers on the radio | a deck goes red (sabotage, as today) |
| Aris | missing from the galley; her book on the table | no team leaves while someone is hurt | sits on her bunk, doesn't answer |
| Vance | his bridge seat empty; "Has anyone seen Vance?" | won't go to a dangerous world | shuts himself in the hold |
| Mira | her bench lamp on while the others sleep | takes the risky option on trips | works through the night |

**What a talk is.** Click someone and they say one line. A talk with a choice is one of two things:

- **A standing moment** (the 12 that exist today as cards): two sides, said plainly. Backing someone in two of their
  three opens their ending, as today. Nothing else counts as backing: not markers, not bowls. The one exception: Aris's
  first marker can count as one of her three.
- **An ask** (about 4 a run, written in step 9, from lines the cards already have): someone wants
  something with a cost either way, such as Jaxon wanting to skip the next wreck, Mira wanting one more day at a wreck
  (a day, −1 ration, for +10 salvage), or Vance wanting the sleepers left behind. **If you don't go before the next
  stop, they do it their way**: Jaxon doesn't come up at the next pick, Mira takes the day.

A sign is how an ask or a breakdown warns you. Clicking anyone else still gets a free line, as the prototype does now.

**A breakdown** lasts until you answer it or until the next jump, whichever comes first. Answering it: one talk, their
line, and they come back. Leaving it costs a scar that lasts:

Jaxon's red deck stays until fixed, and he says less at the light. Aris misses the next pick, and her line at the light
is the colder one. Vance stays shut in through the jump, and his place at the window is empty. Mira's next trip takes a
full day (−1 ration), and her lamp never goes off again.

## 6. Damage you can see: fix it, patch it, or live with it

A deck turns red after the breach in sector 1, a scrape in the corridor, a surge, or Jaxon's breakdown. Sparks, a lamp
out, frost where the hull was holed. Click it. Three chips:

- **Fix:** 20 salvage (the same salvage as a marker). It's done during the next trip by whoever stays. Jaxon fixes it
  alone. Without him, it takes both people aboard, so the crisis aboard goes unanswered.
- **Patch:** free, by anyone, at once. The deck works again until the next scrape or crisis aboard, then it breaks worse:
  two lamps out, and only a fix brings it back.
- **Live with it:** the cost below, every leg, until it's fixed.

| deck | while it's broken | when it's cheap to carry |
|---|---|---|
| quarters | no rest on the jump: stress doesn't fall | sector 6, with one jump left |
| lab | no dating; Mira paces | when no wreck is ahead in the sector |
| med bay | the hurt don't heal | when nobody is hurt |
| hold | the cold store fails: −2 rations a jump | when rations are plentiful |
| bridge | warps cost ×1.5 | when few warps are left |
| engineering | jumps cost ×2; the core dims a step | never |

A fix costs a marker's salvage and a place on the next team; a patch puts it off; living with it is often right. Jaxon's
sabotage is both a talk (it answers him) and a deck (it still needs fixing).

## 7. The end of the run: the ship remembers

- **Wear builds.** A deck you lived with gets visibly worse each sector: more lamps out, frost spreading, the routines
  bending further around it. Worn decks make a crisis aboard more likely, so sectors 5 and 6 have more of them. Sector 6
  keeps trips, crises, repairs, asks and standing moments: nothing in the ship stops early.
- **Before the light: one slow walk down the ship.** No choices, one line per deck at most. The pages on the lab wall,
  the plates over the galley table, Aris's book, empty seats, dark pods, red decks.
- **At the light, who stands at the bridge window** comes from who is alive, who is shut away, and who you backed:
  backed people stand nearest. The reactor spends what's left on the last warp, and its light is the last thing to go.
- **The finale reads the Record from the room,** not from a list.

## 8. The scenes that come up when it matters

- **Strip or marker, over the radio** (about 10 a run): whoever is on the team asks, in their own voice. Jaxon wants the
  metal; Aris wants the names; Vance and Mira ask plainly. Strip: +20 salvage (+30 with Jaxon), and Aris's stress +1.
  Marker: −10 salvage, and a plate goes up over the galley table. Aris writes the names in her book either way. Only
  seven wreck stories exist, and they repeat from sector 4 (BACKLOG); writing more waits for the story spine.
- **Our own dead:** the body comes home to a pod in the hold. One chip: "Stand with them · a day" (−1 ration). The crew
  gather at the galley table, and a plate goes up. Or keep moving, and nothing is charged: their seat is just empty,
  with no plate over it, and Aris says one line. No stress rewards either way.
- **Mira's bench, the one place to date:** after a wreck, its star fix comes up on her bench in the lab. Click the bench
  or Mira, and DiscDating plays exactly as it is. **Dating is free** (ECONOMY.md, "Why not charge for dating"). Her fear
  shows in her routine (the lamp, pages pinned at night) and in one standing moment. A broken lab means no dating.
- **The meal at the jump:** shown on the first jump so the table exists, then only when food is short. A.U.R.A.: "We
  have three rations, Commander. Not everyone eats tonight." Click the bowls you take away.
  Going without: +1 stress and no rest; while hurt or at stress 2, they collapse and miss the next trip. Vance offers
  his bowl first; taking it costs his skill on his next trip, and it isn't backing. An empty bowl stays in front of
  whoever went without. **Built only after the food plan ships** (5 a jump, start 25; today 1, `RATIONS_PER_JUMP`).

## 9. What changed in revision 2

The reactor moves when you choose. Staying aboard matters, and no pair is always right. Talks are standing moments and
asks, breakdowns leave scars, and signs show on decks you can see. Repairs can be patched or lived with. Only standing
moments count as backing; dating is free. Service, meal and pods are rare scenes. The end has wear, a walk and the window.

## 10. Sector 1, the Graveyard (a careful player; to be timed with a stopwatch)

| time | journey (right side of A) | ship (left side of A, or D at a stop) |
|---|---|---|
| 0:00 | "The Graveyard". The light ahead. | Routines. The well pulses with the music. |
| 0:40 | Platform Zeta. Point at it: a small charge. Let it go. | Vance at the window as it passes. |
| 1:10 | Titan-61 IV. Point: the charge climbs the well. Click. | Push, turn, dissolve into D. A.U.R.A.: "Engineering's been surging." Jaxon stays; pick Mira and Vance. |
| 1:40 | the shuttle drops; the stockpile film; the page | The torch if it's needed. Aboard, the surge: Jaxon handles it. Mira radios: strip or marker? A marker. |
| 2:30 | leave orbit (the transition backwards) | A plate goes up over the table. The fix is on Mira's bench: date it, and the page goes up. |
| 3:10 | the free course to Rhea-4; the warp | The core drops. The breach (Breach.js): the lab loses its air and Mira is hurt. |
| 3:30 | in reach of Rhea-4 | The lab is red. No wreck is ahead, so live with it, or patch it for free. |
| 4:00 | Rhea-4: page 1 | D: Mira is in the med bay. Pick Vance and Aris. |
| 5:20 | Chronos-37, a quick stop | Jaxon and Vance. Only ice. Mira's lamp is on: an ask is coming. |
| 6:00 | the jump; the corridor | The ring spins up. The first meal: five bowls. Stress falls. |

Before step 5, time this in the prototype with a stopwatch, minigames included. If sector 1 runs past about 7 minutes,
cut a stop, not a scene.

## 11. What gets removed from today's game

RosterPanel.js (the crew list, stress pips, STRESS_WORD, sleeper rows, the cargo panel); DeckPanel.js, `repairQuote`
and REPAIR ROOM; FabricatorPanel.js (already cut, ECONOMY.md §5); AwayTeam.pick, `selectEvaTeam`'s priority and the
random victim roll; ShipCutaway.js, once `reactorBeat` is carried over; crew-moment cards at landings (they become
talks); the REST leftovers, the trait log lines and "Crew stress is high"; the Record icon and reading pages in the log
(the log stays for routine lines, L); the random hunger death in `eatOnJump`; the +70 sleeper option; supply numbers.

## 12. Rejected

- **Meters of any kind** (pips, mood icons, thought bubbles, an energy bar, "Energy 87"), and **stress buttons in talks**
  ("Listen", "Take the day"): one right answer, a chore by the fifth time.
- **Stations, power routing, a repair or reactor minigame:** busywork, or lookalikes of the torch and the breach.
- **The tower moving itself to a sign:** it pulls the camera off the journey's best moment.
- **Cora giving up her bowl** (no cost worth the click); **charging anyone for using their skill**, Mira's dating
  included; **cooking, cleaning, sleep schedules, searching the ship** (filler, and searching needs new story).

## 13. Build hours, in order

**First, a prototype in the layout pages for the designer's verdict (about 25 hours).**

| # | step | where | hours |
|---|---|---|---|
| 1 | the reactor shows the price: charge on pointing, dip, jump flare, the well, the music beat | variant-a, ship-reactor.js | 7 |
| 2 | who goes and who stays: the lineup in D, the crisis-aboard sign, two crises (surge, breach) | variant-d, variant-a | 8 |
| 3 | signs on seen decks and one ask; test that a first-time player notices 3 of the 4 stress-1 signs | variant-a/sim-a.js | 6 |
| 4 | a red deck with fix, patch and live with it; then time sector 1 with a stopwatch | variant-a | 4 |

**Then the real game (about 95 hours),** assuming the living ship is already in as the ship view (GAME_SCREEN_V3.md §5).

| # | step | files | hours |
|---|---|---|---|
| 5 | economy first: food 5 a jump, start 25, flat repairs, markers, strip +20, pods 1 a jump, skim +15 | bundle.js, data | 6 |
| 6 | the reactor price in the game, `reactorBeat` carried over, the pods' blue line, turning one off | ship-reactor.js, journey, sleeper code | 9 |
| 7 | team pick, the four skills, crises aboard and their scars | bundle.js `handleEvaAction`; AwayTeam.js removed | 10 |
| 8 | talks: standing moments, asks, breakdowns that last to the jump | EncounterCard.js, bundle.js, data | 10 |
| 9 | writing: about 50 lines, per STYLE.md, from lines the cards already have | docs/script | 6 |
| 10 | stress as routines on the bridge, lab and galley; the med bay as a sixth deck | bundle.js, ShipSim | 7 |
| 11 | fix, patch, live with it; deck costs; wear | bundle.js; DeckPanel.js removed | 7 |
| 12 | strip or marker over the radio; plates; Aris's book; the dead; Mira's bench and the pages | bundle.js, ExodusDerelicts.js, DiscDating.js, FoundPage.js | 10 |
| 13 | the meal when short, the new hunger rule (after step 5 ships) | bundle.js `eatOnJump` | 5 |
| 14 | the end: wear, the walk before the light, who stands at the window | bundle.js, EndingSystem.js | 8 |
| 15 | the transition at stops (push, turn, dissolve, and back) | journey code | 3 |
| 16 | remove section 11's panels and buttons | RosterPanel, FabricatorPanel, ShipCutaway, index.html | 5 |
| 17 | balance: headless runs (careful, kind, cruel, sleepers); no pair best more than half the time | tools | 4 |
| 18 | check at real size, muted, all six sectors | | 5 |

**Total: about 120 hours.** Steps 1 and 2 come first because they are the two verbs: if seeing the price in the reactor
and choosing who stays aren't fun in the prototype, nothing after them is worth building.
