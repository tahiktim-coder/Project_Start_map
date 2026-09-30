# Minigames that serve the story (2026-09-30)

Rule: every minigame is a verb the story already has (count, date, fly, listen, walk). Each one **replaces** something
that exists today, so the game gets deeper, not bigger. Nothing here is in the game. Playable sketches of all five: `prototypes/sim-bay/` (open `http://localhost:8000/prototypes/sim-bay/` with the local server) or https://claude.ai/artifact/FD1WZcRpiDurdeiYrB512o.

| # | minigame | what you do | story line it serves | replaces | size |
|---|---|---|---|---|---|
| 1 | **Roll call** | before every jump, A.U.R.A. calls "sound off"; you click each figure in the ship cutaway as they answer. Five figures answer. She logs four. In sector 6 the roll call comes back slightly wrong. | the count | the count scene explaining itself | small: the cutaway already walks five figures |
| 2 | **Fly the corridor** | the jump becomes a short flight down the heading, weaving past dead hulls. Sector 1 has a few wrecks. Sector 5 is a wall of them. The throw is this game freezing mid-flight. | eight vs 41,000 | the WarpPlot timing bar | medium: new game, same frame as the lander |
| 3 | **Date it with the disc** | on a wreck, lay the disc's fourteen pulsar lines over the wreck's star fix and turn them until they meet. How far you had to turn is how old the wreck is. The player finds the time throw with their own hands. | the disc, the time throw | the SignalTune deep-scan dials | medium: reuses the tuning code |
| 4 | **Dead channels** | a radio dial between stops. Static, then old distress calls, then in the deep sectors a ship's computer four hundred years dead saying "Four crew, Commander. All accounted for." in A.U.R.A.'s voice. | the light (it remakes what it reads) | the long-range scan | small to medium |
| 5 | **The walk out** | the finale, played. One suit, one tether, drifting across the light to the disc. The crew's voices drop off the radio one by one as it reads them. You hold the torch and decide at the disc. | the ending as an act | the six ending paragraphs | medium: reuses the lander's drift physics |

## The designer's verdict after playing the sketches (2026-10-01)

"Great game, impressed." Keep three, rework one, park one:

| minigame | verdict | what the rework must answer |
|---|---|---|
| **Fly the corridor** | keep | too many wrecks passed to be believable; make it realistic |
| **Date it with the disc** | keep, "beautiful" | the player must feel they did something, and it must change the game |
| **The walk out** | keep | needs a lot of rework on how it fits into the finale |
| **Roll call** | liked the idea, rework | needs a clear purpose, and must use the ship from the main screen, not a new drawing |
| Dead channels | not mentioned | parked |

## Rework directions (proposed, not built)

- **Fly the corridor, realistically.** Separate what you *hear* from what you *see*. A counter in the corner ticks up transponders
  as you pass them (sector 1: eight; sector 5: tens of thousands), but only a few hulls are ever close enough to see: sector 1
  one or two, sector 5 maybe a dozen, each drifting past slowly with its number. You dodge the debris around them, not a wall
  of ships. The dread comes from the counter against the empty dark. Replaces the jump timing bar; hits use the existing deck
  damage; letting A.U.R.A. fly feeds her existing "you let me fly" line.
- **Date it with the disc, with a consequence.** Every wreck you date is written into Aris's list with its age, and those rows
  come back in gold on the sector 5 ledger. The crew react to *your* number, which replaces the captain's log that explains
  the time throw. Dating is how Vance's "the truth" standing is earned. At the finale, cutting the map means destroying the
  one instrument that told you the truth all game: now the choice costs something the player used.
- **The walk out, integrated.** It replaces the ending card. The approach film stays; then the airlock: who goes out (you,
  Vance with you, A.U.R.A. flies the lander, or nobody and you turn around). Standing decides who is on the radio and who can
  go instead of you. At the disc: cut it, take it, or leave it. Every ending closes on her count. This is the shape of the
  count options "The Walk" and "The Script", so it waits on that decision.
- **Roll call, with a purpose.** It becomes the pre-jump crew check on the main screen's own ship cutaway, not a new ship.
  Each deck lights as its person answers, and the answer carries their state ("Here. Arm's still bad.", "Here." from someone
  who has gone quiet), so it replaces reading the roster panel before a jump. The count rides on it for free: five answers,
  "Four crew, Commander."

## Recommended order

1. **Roll call** first: cheapest, and it turns the count from a scene you read into a thing you notice yourself.
2. **The walk out** second: the biggest single gain, because the ending stops being text.
3. **Date it with the disc** third: only if the time throw stays.
4. Fly the corridor and dead channels: nice, not needed for v1.

## Deliberately left out

Combat, crafting, trading, a power-routing grid for the sleeper pods, a repair puzzle. None is a verb this story has,
and each would add a system the game then has to teach.
