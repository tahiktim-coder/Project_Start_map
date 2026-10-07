# The economy (2026-10-07)

**Status:** a proposal. Nothing in the game has been changed. Numbers below come from the code as it is today
(`src/bundle.js`, `src/data/*`, `src/systems/*`), not from the older design docs.

**The short answer.** Today a careful player runs dry in sector 2. That does not end the game. It deletes the story: the
ship jumps "on the reserve" through sectors 3 to 5 without stopping, and reaches the light with one page of six. Without
ship upgrades, keep three things you spend and one thing you collect:

| | what it is | what you spend it on | the story question it asks |
|---|---|---|---|
| **Energy** | the ship moving | warps and jumps | how many places can we afford to see? |
| **Rations** | the crew living | each jump, and days you give to people | do we take a day for this? |
| **Salvage** | the hull holding | repairs, and markers for our dead | do we strip their ship, or honour it? |
| **The Record** | what you found | never spent | what does the light read when we arrive? |

Data, the probe, the fabricator, cargo slots and most items go. Section 5 is the checklist.

---

## 1. What exists today

### Every resource, with its sources and sinks

**Energy** (start 100, cap 100, shown as a percentage)

| spends it | amount | where |
|---|---|---|
| warp to a planet | 10–19 list price (stations 4–7, asteroid fields 3–5) | `getWarpCost`, bundle.js:446; PlanetGenerator.js:412 |
| …with the bridge damaged | ×1.5 | bundle.js:450 |
| long-range scan from the map | 2 | bundle.js:2116 |
| deep scan in orbit | 2 (+1 on a weak tune) | bundle.js:3535 |
| sending the team | 5 (10 if Mira is "obsessed") | bundle.js:3888 |
| remote probe | 30% of the target's warp price (3–5) | bundle.js:3753 |
| sector jump | 20 (40 with engineering down; −20% once after Jaxon's brace) | bundle.js:2237 |
| bad warp plot | +25% of the warp price | WarpPlot.js:27 |
| card options | about 80 places, mostly −5 or −10 | all of `src/data/` |
| ship faults | power surge −5 to −15 (8% a warp, more later) | ShipEvents.js |

| gives it | amount | where |
|---|---|---|
| arrival "collectors" | 19–60% of the warp back (type rate ±10%, ×0.75) | bundle.js:1623–1659 |
| clean / perfect plot | +15% / +30% of the warp price | WarpPlot.js:24–25 |
| probe in orbit | free to launch; at a gas giant 2–3 launches a tank, about +16 each | ProbeSystem.js, LootTables.js |
| surface search | "+30 to 49 energy" options on 12 of 37 ground events | Events.js, bundle.js:4263 |
| card options | about 40 places: +10 to +40, and +70 for letting three sleepers die | ExodusDerelicts.js:177 |
| items | battery +30, coupler +25, crystal +20, fungus +15, others | Items.js |

Decision it creates: which dot (but warps all cost about the same), and whether to take the energy option on a card. The
second is the problem: the energy options are the unkind ones.

**Rations** (start 20, cap 30)

| spends it | amount |
|---|---|
| every warp, sector jump, team trip, station boarding, asteroid dig, wreck, ruin, strange site | −1 each (`consumeRation`, bundle.js:527) |
| card options | 36 places, mostly "−1 Ration: it takes a day"; carrying sleepers −2 to −5 |
| REST button in the crew list | −1 ration for −1 stress |
| running out | at 1–2 left: +1 stress to everyone per action; at 0: a death every third action |

Gains: 10 card options (+2 to +10), food pack +3, wild harvest +2, the fungus culture (+1 every 3 actions), Eden +10,
a sector 5 oddity (+2 to 4). Most of these sit in stations and asteroid fields a player may never see.

Decision it creates: almost none. It drains on every click. The only real choice is "take a day" on a card, and that choice
is taxed.

**Salvage** (start 50, cap 300)

| gives it | spends it |
|---|---|
| about 80 card options (+10 to +120), surface digs (+40 to 119), boarding (+10 to 30), items | deck repairs: 30–80 list, −30% with Jaxon alive, +50% with engineering down |
| | rebuilding the probe: 50 |
| | the fabricator: 7 upgrades at 90–250 |
| | about 12 card options, Jaxon's brace (−10 or −25) |

Decision it creates: repair now or later. Everything else is "buy one upgrade a run". Once upgrades are gone, salvage only
goes up.

**Data** (`_colonyKnowledge`) goes up by 1 to 8 in about 80 places. It only changes the odds of a colony when you settle
(+5% a point, capped at 5 points) and two lines of the colony epilogue. The six endings at the light never read it. The
29 September playtest hit 5 in sector 1. Decision: none.

**Stress** 0–3 per person: up from sector 2's silence, dangerous worlds, deaths, hunger and card options; down by 1 on each
jump if the quarters work, the REST button, and six calming items. At 2 a trait, at 3 a breakdown. Decision: rarely any.

**Probe integrity** 100: each launch costs 10–45; at 0 it costs 50 salvage to rebuild. Launches cost no energy, so there is
no reason not to fire it. (A bug makes it cheaper still: `planet.gravity` is a string like "4.2G", so the heavy-gravity
damage in ProbeSystem.js:15 never applies.)

**Cargo** 20 slots (24 with racks, half with the hold damaged). 31 item types. About half belong to cut systems: revival
(spores, neural link), the alien plot (transmitter, machine part, strange object), A.U.R.A.'s ethics (tech fragment), and six
calming items for a stress system most players never see. Decision: rarely; the hold seldom fills.

**Sleepers**: carrying pods costs rations once, at pickup. After that they cost nothing. They unlock one ending (the vote).
Letting them die pays +70 energy. Decision: real, but the cost points the wrong way.

**Standing** (who you backed): not shown as a number, but it is the real ending currency. Two of the three moments per
person opens their ending. Several standing moments also carry energy chips ("Let A.U.R.A. fly the line, +10 Energy"), so
siding with someone reads as a purchase.

**Inside the minigames** (local resources, not carried out):
- Boarding: air, with every cost shown before you click. The best-designed economy in the game.
- Torch: fuel tanks and scars. The game ignores both (bundle.js:2576), though the spotter says "That's fuel we don't get back."
- Breach: air lost; the holed deck is damaged and whoever was in it is hurt. Feeds repairs.
- Corridor: every third scrape breaks a deck, but only when you fly. When A.U.R.A. flies there are no scrapes at all, so
  flying by hand has no upside.
- Warp plot: ±15–30% of the warp price. Small.

### A careful run, today's numbers

The careful player does what the coach suggests: scans the dot first, deep scans, sends the team to the site, lets A.U.R.A.
plot and fly, and picks the kind option on each card. Today's kind options average about −3 energy and −1 ration a stop
(for example "−1 Ration: a day for a short service", "−10 Energy: you hear the whole log").

One stop costs: long-range scan 2 + warp (14.5 list − 5 back) 9.5 + deep scan 2 + team 5 + kind option 3 = **21.5 energy**,
and warp 1 + trip 1 + option 1 = **3 rations**. Cold worlds in sector 2 give less back (4), so a stop there costs 22.5.

| | energy | rations |
|---|---|---|
| start | 100 | 20 |
| S1 stop 1, the marked wreck | 100 − 21.5 = 78.5 | 20 − 3 = 17 |
| S1 stop 2, Rhea-4 (page 1) | 78.5 − 21.5 = 57 | 14 |
| S1 stop 3, the strange site | 57 − 21.5 = 35.5 | 11 |
| jump | 35.5 − 20 = 15.5 | 10 |
| campfire: "Let A.U.R.A. fly the line, +10" | 25.5 | 10 |
| S2 stop 1, the tape wreck; carry the three sleepers | 25.5 − 22.5 = **3** | 10 − 3 − 3 = 4 |
| S2 stop 2, Dione-2 (page 2): the warp costs 10–19 | **cannot go** | |
| jump needs 20: "jump on the reserve" | 0, quarters damaged | 3 |
| S3, S4, S5: with 0 energy no warp is possible, so no stops; reserve jump each time | 0 | 2, 1, 0 (stress up each time) |
| S6: the warp to the light is free | 0 | no food a second time: everyone at stress 3 |

Result: **1 page of 6**, sectors 3–5 seen only through the corridor window, the crew at stress 3 and one action from a
starvation death. Taking two stops in sector 1 instead of three gets page 2 and collapses one sector later. The 29 September
playtest measured the same curve: 100, 55 after two sector 1 stops, 35 after the jump, 45 after the campfire, 27 after one
sector 2 stop.

Even the cheapest way through is out of reach. The story path is 12 stops (each sector: one wreck to date, then its story
planet) and 5 jumps. With no long-range scans and only free options: 12 × 16.5 + 5 × 20 = **298 energy** against a start of
100, and 12 × 2 + 5 = **29 rations** against 20. The main path needs about 200 energy and 9 rations from finds, and the big
finds are the unkind options.

---

## 2. What is wrong with it

1. **Running dry deletes the story instead of ending the game.** `checkStranded` only applies in sector 6 (bundle.js:5410).
   Before that the reserve jump is always offered, so an empty tank means skipping three sectors. For a story game this is
   the worst failure: the player loses the content, not the run, and may not notice why.
2. **Three clocks ask one question.** Stops per sector, energy and rations all mean "how much can we explore", and all three
   run out around sector 2–3. A player cannot tell which one is the real limit.
3. **The story is taxed and cruelty pays.** Reading names, a short service, carrying sleepers: each costs. Stripping a
   wreck, killing the sleepers (+70) and siding with A.U.R.A. (+10) pay. The economy tells the player the opposite of what
   the story is about.
4. **The faucets reward the least story-like play.** Firing the probe at a gas giant, searching bare surfaces for energy,
   and the hidden 19–60% refund. None of these is a decision a player makes about people.
5. **Costs you always pay are not choices.** Long-range scan 2, deep scan 2, team 5 per stop: nobody skips them, so they only
   make the tank smaller and the numbers busier.
6. **Dead resources.** Data saturates in sector 1 and only touches settling. Probe integrity, cargo slots, stress items,
   revival and alien items belong to cut systems. Each one is a number on screen that changes nothing.
7. **Salvage has nowhere to go.** About 80 places give it, about 12 take it. With the fabricator gone, only repairs are left.
   Upgrade checks also live in places that will break when it goes: EndingSystem.js:25 (a gas giant colony needs the fuel
   scoop), EndingSystem.js:29 (`stabilizer_core`, which does not exist), the colony score's `techLevel`, the end screen's
   "UPGRADES BUILT", `getPlotOptions` (gyro fins), `applyPlotResult` (shielded core), the remote scan (sensor array).
8. **Minigame results do not reach the economy, or only punish.** Torch fuel is ignored. In the corridor, letting A.U.R.A.
   fly is never worse. The minigames feel weightless because nothing they measure is ever spent.

---

## 3. The proposal: a 30–40 minute story game without upgrades

### Rules

**One rule above the others:** a cost is either the price of moving, or the story's own price. Reading and listening are
free. A day costs a ration, and the card says "a day". Power for the pods costs energy, because keeping people cold takes
power. Metal for a grave marker costs salvage. Nothing costs a resource just to press a button.

**Energy: the ship moving.** Start 100, cap 100.
- Warp: **4–6**, by distance on the map, shown as one number. No refunds.
- Once a wreck is dated, the warp to the story planet it points at is **free**: "We have their last course, Commander."
  The disc now saves fuel, so dating is worth doing every time.
- Sector jump: **8** (16 with engineering down). Fly the corridor yourself with no scrapes: 2 back.
- Gas giant: arriving skims **+15**. It uses a stop, so it is a real choice: a fuel stop or a story stop.
- Sleepers: each pod uses **1 energy per jump**. Draining the pods instead gives **+40**, and the sleepers die.
- Power finds: a station's power room (+10–16, it already exists in boarding, heavy to carry), and on about one wreck in
  three, "Take their reactor cell" (+12; Aris or Jaxon reacts).
- Free: deep scan, team trips, scans from the map (the site shows on the map label), dating.
- Kept: the reserve jump, bridge damage ×1.5, power surges.

**Rations: the crew living.** Start 25, cap 30.
- Each sector jump, everyone aboard eats one: **5 per jump** with the full crew.
- "Take a day" options: **−1**. At most one per card. These are now a budget you spend on people, not a tax.
- Finds: sealed packs in a wreck's galley (+3, in about half our wrecks), a station galley (+2–6), food on a living
  world (+2), Eden (+10). Taken without a choice: the dead do not eat. (A "leave it for the next ship" choice was
  considered and dropped: under the time throw no later ship passes this way, and it would duplicate the salvage choice.)
- Hungry jump (not enough for everyone): everyone +1 stress, nobody heals. A second hungry jump in a row: one person dies.
- A.U.R.A. warns before a day that would make the crew go hungry before the light.
- The jump card says it plainly: "The crew ate 5 rations. 20 left."

**Salvage: the hull holding.** Start 50, cap 150.
- Comes only from stripping something: a wreck (+20), wreckage in orbit (+15–35), a station's stores and core (+10–30),
  an asteroid field (+20–40), a surface dig (+10–20).
- Repairs: **20** a deck (30 with Jaxon dead). Each broken deck costs you something you can see:
  bridge (warps ×1.5), engineering (jump ×2), quarters (no healing, no stress recovery), **lab (the disc chart cannot be
  read: no dating)**, cargo (the cold store fails: −2 rations a jump).
- Markers for our dead: **−10**. The workshop cuts a plate, and Aris adds their names to her list.
- Jaxon's brace before a jump: −15, the next corridor's first break is absorbed.
- Each extra torch tank: −5. The spotter's line becomes true.
- The FABRICATION room in the ship cutaway becomes the **WORKSHOP**: the forge art stays, and it makes repairs and markers.

**The Record: what you carry.** Never spent, never on sale.
- Pages found (6), wrecks dated (the disc chart), names on Aris's list (one entry per honoured wreck), sleepers aboard.
- Readable from the hold. Aris's list is shown once before the light.
- The finale reads it: what each choice at the light says depends on what you carry (the "pages gate the finale text"
  item from the 29 September assessment).
- Settling a colony reads the other three: leftover salvage is the first shelters, rations the first winter, sleepers
  more people. The colony epilogue already checks salvage (EndingSystem.js:586, 667); move its thresholds to 50 and 100.
- Data is folded in: colony odds count the colony ruins you visited (cap 5) instead of a number on the HUD.

**Optional, only if the count story wants it.** A.U.R.A. plans food for four crew. Five eat. Her forecast says the food
lasts one jump longer than it does. It is the same single wrong number, showing up in the stores. Decide with the count.

**The HUD:** ENERGY · RATIONS (with jumps left) · SALVAGE, and a small list icon for the Record. Data, probe and cargo
count go.

### Where each choice sits

| when | the choice | what it costs |
|---|---|---|
| on the map | which dot: a story stop, an extra place, or a fuel stop | energy |
| in a sector | one more stop now, or keep a margin for sector 5 | energy |
| at a wreck | strip it, or make a marker | salvage, the Record, Aris |
| on a card | take a day for someone | a ration |
| sector 2 | carry the sleepers | energy every jump, an ending |
| before a jump | fix the deck now, or fly with it broken | salvage |
| the corridor | fly it yourself, or let A.U.R.A. | decks against 2 energy |

### The same careful run under the proposal

The careful player: lets A.U.R.A. plot and fly, dates every wreck, carries the three sleepers from sector 2, takes one
extra place in sectors 1, 3 and 4, has one power surge (−10), and carries one power cell out of a station (+12).

**Energy**

| | arithmetic | energy |
|---|---|---|
| start | | 100 |
| S1 | marked wreck −5, Rhea-4 0 (dated), strange site −5, jump −8 | 82 |
| S2 | tape wreck −5, Dione-2 0, take the sleepers, surge −10, jump −8 −3 pods | 56 |
| S3 | wreck −5, Mimas 0, station −5, power cell +12, jump −8 −3 | 47 |
| S4 | wreck −5, Pallas 0, colony ruins −5, jump −8 −3 | 26 |
| S5 | wreck −5, Iapetus 0; an extra place would leave nothing for sector 6, so skip it; jump −8 −3 | 10 |
| S6 | wreck −5, Tethys 0, the light 0 | **5** |

All six pages, three extra places, the sleepers alive, five energy left at the light. Sector 5 is where it gets tight.
Without the sleepers: 17 left. Taking two reactor cells: room for two or three more places.

**Rations** (one or two days taken per sector; sealed packs found in about half the wrecks)

| | arithmetic | rations |
|---|---|---|
| start | | 25 |
| S1 | a service −1, a meal with Jaxon −1, packs in the wreck +3, jump −5 | 21 |
| S2 | reading the names −1, the stockpile +3, jump −5 | 18 |
| S3 | two days −2, a station galley +2, jump −5 | 13 |
| S4 | a day −1, packs +3, jump −5 | 10 |
| S5 | two days −2, the last jump −5 | 3 |
| S6 | a day −1 | **2** |

**Salvage** (honours eight wrecks, strips four)

| | arithmetic | salvage |
|---|---|---|
| start | | 50 |
| S1 | marker −10, the breach floods the lab: repair −20 (or no dating), marker −10 | 10 |
| S2 | strip the tape wreck +20, marker −10 | 20 |
| S3 | marker −10, strip +20, station stores and core +25 | 55 |
| S4 | two markers −20, a power surge breaks engineering: repair −20 | 15 |
| S5 | strip +20, marker −10 | 25 |
| S6 | strip +20, marker −10, an extra torch tank −5 | **30** |

### Other players, same rules

| player | energy at the light | rations at the light | what the Record shows |
|---|---|---|---|
| careful, as above | 5 | 2 | 6 pages, 8 names, sleepers alive |
| careful, no sleepers | 17 | 2 | 6 pages, no vote at the light |
| takes everything: cells, parts, drains the pods, takes few days | about 55, sees every place | about 9 | few names, three empty pods, Aris against you |
| takes every day offered (about 14) | 5 | short by about 3: A.U.R.A. warns; ignored, the last jump goes hungry, nobody dies | many names, a tired crew at the light |
| skips extras, story only, no sleepers | about 20 | about 2 | 6 pages, little else |

A death from hunger needs two hungry jumps in a row, and A.U.R.A. warns before every day that would cause one. Nobody
starves for reading a page.

Every profile reaches the light with the whole story. The kind run is tight. The cruel run is comfortable and shows it at
the end. That trade is the game's argument, and now the numbers make it instead of fighting it.

### Why not charge for dating

Dating is the one verb that makes the disc matter. It is already paid for with attention (the minigame). Charging a day
would repeat today's mistake. It pays instead: a free course, a point on the chart, a line the light can read.

---

## 4. Replay, and "playing forever"

The honest answer: a story game should not be endless. The light is the end of the heading. "Forever" should mean playing
again, not playing longer. Here are the options.

| option | what it is | cost | what it does to the story |
|---|---|---|---|
| **Endings seen** | "Endings: 2 of 6" on the title; a list of locked ones without spoilers | 2–3 h | Nothing bad. The standard reason to play a second time (Reigns, 80 Days). |
| **New Game+ that keeps knowledge** | the next run starts knowing what this one learned | 8–12 h; +6–10 h of writing if built on the story spine | The strongest fit. See below. |
| **Seeded runs** | a code that makes the same maps | maps only: 2–3 h (PlanetGenerator has 67 of the game's 375 random calls); the whole run: 8–12 h and fragile | Little. People do not race a story. Useful for bug reports and "try my run". |
| **Sim Bay on the title** | after the first ending, play the minigames freely (`prototypes/sim-bay` already runs them) | 2–4 h | None. The honest "infinite" for anyone who loves the torch or the corridor. |
| **Endless mode** | sectors after 6, harder each time | 20–30 h | Bad. It says the heading has no end. The ~122 random cards would repeat within an hour, and the economy would need a scaling curve it does not have. |

**New Game+, and whether it fits the story.** Yes, I think it fits better than anything else. The canon already has the
device: every ship's computer has a twin in a vault on Earth, and the link carries state, not words, and does not care about
when. A second run can say plainly that the twin remembers:

- The pages you found are readable from the start, as fragments.
- Story planets you reached show as known contacts, so you do not need a wreck to find them. Dating still gives the free
  course. Knowledge saves stops, and saved stops buy the places you missed.
- The endings you saw are marked at the light.
- **Knowledge never gives resources.** The second ship starts with the same 100 / 25 / 50. Otherwise the second run is easy,
  not deeper.

If the designer's story spine is adopted (a broken warning from the future that started the programme), this goes further:
the opening's broken message is built from the words of your last ending. You send it; the next run begins with what
arrived. The "message arrives whole" ending becomes the goal across runs, possible in one perfect run, likely by the second
or third. A warning that always existed is a loop, and a game that remembers between runs is a loop the player can feel.

Two conditions. The first run must be complete on its own. And this waits for the count and spine decisions, because NG+
puts words in A.U.R.A.'s mouth about memory.

**Recommendation:** endings seen now (2–3 h). Sim Bay on the title if time allows. New Game+ as the first update after
launch, once the spine is decided. Seeded maps only as a debug tool. No endless mode.

---

## 5. Checklist

**First aid** (about 5 h). Moves the careful player's dry point from sector 2 to about sector 5:
- [ ] Deep scan, team trips and map scans cost no energy; site labels show on the map (assessment item 3) — 2–3 h
- [ ] Rations only on jumps (and "a day" options); remove the per-action drain and the REST button — 1 h
- [ ] Warps 4–6 shown as one price, no refunds; jump 8; the dated story planet free — 1.5 h

**Cut**
- [ ] Fabricator, the 7 upgrades, the ship add-ons, every upgrade check (list in section 2, item 7); the FABRICATION room
      becomes the WORKSHOP — 3 h
- [ ] Probe, remote probe, probe integrity, ProbeSystem.js and LootTables.js — 2 h
- [ ] Scan tuning link and its "+1 data" — 0.5 h
- [ ] Data on the HUD, in card chips and on end screens; colony odds count ruins visited — 2 h
- [ ] About 20 of 31 items (revival, alien, stress trinkets, decoder, star chart, tech fragment, the two cultures); food,
      batteries and scrap become instant gains; drop the cargo limit — 3–4 h

**Change**
- [ ] Card pass: no energy cost on kind options; no resource chips on standing moments; one cost per option, in the
      currency the story names; "−1 ration" only where the card says "a day" — 4–6 h (about 130 places; the biggest job)
- [ ] Sleepers: 1 energy per pod per jump; draining the pods +40 (was +70) — 1 h
- [ ] Salvage: repairs flat 20 / 30; markers −10 add names to Aris's list; strip options +20; extra torch tank −5 — 3 h
- [ ] Deck effects: lab down = no dating; cargo down = −2 rations a jump — 1 h
- [ ] Gas giant skim +15; hand-flown clean corridor +2; A.U.R.A.'s hunger warning — 1.5 h
- [ ] The Record: Aris's list card in the hold, shown once before the light — 2 h (the finale reading it: 6–8 h, after the
      count decision)
- [ ] Colony epilogue salvage thresholds to 50 / 100; remove `techLevel` and "UPGRADES BUILT" — 0.5 h
- [ ] A headless balance script (node): careful, generous, cruel, sleepers and story-only runs must all reach the light,
      ending with energy 5–55 and rations 0–15 — 3 h

**Keep as is**
- Stops per sector (2–3): the structure of each sector. Energy now decides which sectors you linger in.
- Standing as the ending key. Boarding air. The breach. The corridor. The torch. The reserve jump as the floor.

**Replay**
- [ ] Endings seen on the title — 2–3 h
- [ ] Sim Bay on the title after the first ending — 2–4 h (optional)
- [ ] New Game+, "the twin remembers" — 8–12 h, after the spine decision

About 35 hours for everything above except Sim Bay, New Game+ and the finale reading the Record. The first aid is 5 of
them; the card pass is the largest single piece.
