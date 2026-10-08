# Ship study (2026-10-07)

The designer asked: "better walking models on the ship, and shall we rethink how the ship would look like?"
This page is the answer in words. The pictures are in `prototypes/screens/ship-study.html`
(open `http://localhost:8000/prototypes/screens/ship-study.html`). Nothing in the game was changed.

## Why the hull matters so much

Every wreck in the game is our own hull: the card at dusk, the ring of seventeen ships, the ship in three pieces, the wrecks
on landing sites, the wrecks you fly past in the corridor. Change the hull and all of those change with it.

One problem with today's hull: outside, it looks like a small plane (raised bridge on top, fins). Inside, the cutaway stacks
the decks nose up, like a tower. All three new hulls are built nose up, so the outside and the inside agree.

## The four hulls

| | name | in one line | what it says |
|---|---|---|---|
| A | Today | Round nose, raised bridge, fins. | Not much. Reads as a small plane. |
| B | Lander | Built to land once and stand on the new world as the first house. | Small, long-haul, made to settle. Wrecks stand upright where they came down, with others on the horizon. |
| C | Shield ship | A small room for five behind a big dust shield, far from the engine. | Long-haul: dust is the danger, so the shield is the biggest part. Wreck: the shield standing in the ground like a coin. |
| D | Kit ship | Five boxes from a factory line, bolted to a frame. | Built in a hurry, one of many. Panels don't match, lifting lugs left on, factory numbers in the thousands. |

## The three ways to draw the crew

All three use the same few measurements per person (height, build, lean, hair, a habit), so the five stay different in
every pose: walk, stand, work at a console, climb a ladder, sit.

| | name | size | in one line |
|---|---|---|---|
| 1 | Small | 7 × 12 | One and a half times today's height. Chunky, dark edge, easy to read. |
| 2 | Tall | 9 × 17 | About twice today's height. Six-frame walk, coats, hair, a tool in hand. |
| 3 | Lamplit | 9 × 17, in shadow | The tall figures as dark shapes, lit only on the side facing the room lamp. |

Who is who by shape: Cora tall and straight with a white bob, hands behind her back. Jaxon broad and a little stooped, tool
belt, wrench. Vance tallest and widest, grey spikes, arms crossed, heavy boots. Aris in a long coat, hair to her shoulders,
a tablet. Mira smallest, a ponytail, never still.

Colours: all five are warm (the colour rule). The game today still uses the old role colours (white, cyan, purple, red,
amber). The study uses the main-screens mockup colours, except Mira moves from ochre to coral so she can't be confused with
Aris. Changing crew colours is a palette decision for you.

The cutaway also gained what people need to move around: a ladder well with a hatch in every floor, a sliding door on every
deck, and lower ceilings with pipes above in the lab and quarters, so the rooms are the right size for the people in them.

## What adopting each would change

Hull, any of B, C, D:

- `src/systems/SceneArt.js`: `hullEdges` and `drawHull` (used by the ring, the mirror, the voice, the dark patch, the list,
  the lighthouse, the wreck at dusk, the ship in three pieces). The wreck at dusk needs a new picture.
- `src/systems/LanderSites.js`: `paintWreck` draws our hull lying on a landing site in four forms (whole, broken, burned,
  crater). Each form needs redrawing.
- `src/systems/minigames/Corridor.js`: `hullAt` is a separate 3D model of the wrecks you fly past.
- `src/systems/ShipCutaway.js`: the outline (`halfWidth`) and where upgrades bolt on (sensor dish, fuel scoops, fins).
- Copies: `src/systems/minigames/MiniShip.js`, `prototypes/sim-bay/ship.js`, `prototypes/screens/main-screens.html`.
- Not affected: `NavVista.js` (hulls there are 3 to 6 pixel dashes), the lander, stations.

Crew sprites, any option:

- `src/systems/ShipCutaway.js`: the sprite builder (best as its own small file), the ladder well and doors, and the crew's
  routines instead of pacing. Still needed in the game version: injured lying on a bunk, stress jitter, dead crew as pods,
  and the sixth room (Fabrication), which the study leaves out.
- `src/systems/DeckPanel.js` lists who is "in this room" by their station. Once people walk around, decide whether it lists
  where they work or where they are right now.
- `src/systems/minigames/MiniShip.js` (`figure`) for the minigames that show the ship.
- If the colours change: `ShipCutaway` role colours (also read by DeckPanel, AwayTeam, BoardingParty, LanderGame), the name
  colours in `src/bundle.js`, `MiniShip.CREW`, and the suit stripes in `LanderCrew.js`.

## Rough hours

| option | hours | where it goes |
|---|---|---|
| Hull A, keep | 0 | |
| Hull B, Lander | about 16 | SceneArt 5, landing-site wrecks 4, corridor 2, cutaway 2, copies 1.5, checking every scene 1.5 |
| Hull C, Shield ship | about 22 | many separate parts in every wreck; the spine changes the cutaway's room heights and the deck click targets |
| Hull D, Kit ship | about 18 | wrecks become scattered boxes everywhere |
| Crew 1, Small | about 12 | cutaway 9, minigames 3 |
| Crew 2, Tall | about 14 | cutaway 10, minigames 4 |
| Crew 3, Lamplit | about 15 | as Tall, plus lighting per room |

## My recommendation

**Hull B, the Lander, and crew option 2, Tall.** Do the crew first: it is what you asked for, it lives almost entirely in
`ShipCutaway.js`, and it works with today's hull.

- The Lander says what the ship is for in one picture, and its wreck is new and simple: a hull still standing where it came
  down, others standing on the horizon. It fits the dark moon where someone built a shelter from a hull.
- It is one long body like today's hull, so every place that draws the hull keeps working; C and D break into many parts and
  cost more everywhere.
- D's factory numbers are a nice quiet hint at how many ships Earth built. They could go on the Lander too, as stencils.
- Tall is big enough to tell all five apart across the panel and has room for the coat, the wrench and the ponytail.
  Lamplit is the moodiest, but the five blur together in dark rooms.
