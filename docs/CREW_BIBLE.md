# Silent Exodus crew bible (2026-10-14)

Built from `docs/STYLE.md` (the crew table at :33-38), `docs/STORY_ONE_PAGE.md`, `docs/CANON.md` §8, the sprite
signatures, and every crew line in `src/`. File:line references point at today's code. The bundle.js line numbers in
the `docs/script/` export (Oct 10) are out of date. No code was changed.

**How to use it.** The last bible gave each person a verbal habit, and the game filled up with lines like "the goat" and
"And here we see". This one gives nobody a signature word. A character comes from what they want and how they react, and
"Voice" says what they talk about, not which words they repeat. Every line still follows STYLE.md: one idea, at most 20
words, no riddles, no line used twice. `SHIP_LIFE.md` uses the "with Cora" and "under stress" notes.

## The compass

| | in a few words | wants | needs | group or one person | rules or people | truth or comfort |
|---|---|---|---|---|---|---|
| **Jaxon** | tired, warm, practical | to stop and live | to say goodbye to the life he left | the people in front of him | people | comfort |
| **Vance** | blunt, stubborn, protective | the truth, and to be believed | to protect people even if nobody believes him | everyone, Earth included | procedure yes, orders from above no | truth, always |
| **Aris** | gentle, serious, the kindest aboard | to understand the dead and honour them | to turn back to the living | every single person | people | truth for the dead, comfort for the living |
| **Mira** | very bright, eager, unsure of herself | to be told what to do | to trust her own eyes | belonging to the group | instructions | comfort, until sector 3 |
| **A.U.R.A.** | courteous, exact, unshakeable | to keep the crew moving | none; the crew's view of her changes | the mission | orders | exact facts, said kindly |

The pairs pull against each other on purpose:
- Vance against Mira, on the truth.
- Jaxon against Vance, on stopping.
- Aris against A.U.R.A., on one person against the whole crew.

**Stress traits.** Today they act as walls: a chip that is hidden (`Orbit.js:129`) or a button that is disabled
(`bundle.js:4070-4072`). That breaks the rule never to lock the player out. Write each refusal as something the player
can overrule, at a cost to that person: +1 stress, or no backing that time.

---

### Jaxon Mercer · engineer, 42 · engineering
- **Looks:** greying near-black hair, a square stubbled jaw, a work jacket and tool belt, arms crossed (`Jaxon.js:125`).
  He leans and never paces.
- **Wants / needs:**
  - He wants to land somewhere good and stay (`CrewEvents.js:40`).
  - He needs to say goodbye. He records letters to his daughter and never finishes one (`:39`).
  - In the settle ending he finally finishes one (`StructureEncounter.js:118`).
- **Fear:** dying between the stars and never standing on ground again.
- **Flaw:**
  - He picks comfort over truth: "I've stopped reading the ship numbers" (`BarkSystem.js:209`).
  - He cuts corners for the people in front of him (`ExodusDerelicts.js:160`).
- **With Cora:** he sees her as the one who can let him stop, and holds her to a promise: "I'll hold you to that,
  Commander." (`CrewEvents.js:50`)
- **Under stress:**
  - At 2 (HOARDER, `bundle.js:839`), write it as him keeping parts back for the camp he means to build.
  - At 3 he damages a deck (`bundle.js:908-911`). Write it as him pulling the drive apart so the ship has to stop. That is
    his want, not "paranoia".
- **Arc:**
  1. He calls the count a glitch (`bundle.js:1520`).
  2. The garden "looks like the one I left" (`AnomalyEncounters.js:412`).
  3. He is worn out (`CrewEvents.js:87`).
  4. Eden: he stays, or he is brought back.
  5. If he came back, he works and says little. If he stayed, his seat is empty.
  6. The light reads his letters (`StructureEncounter.js:40`).
- **Voice:** short, dry and concrete: parts, food, the hull, the weather. He jokes only about himself. The lander is
  "she", and never a nickname.
- **Lines:**
  - "The pump will hold for a month. After that I'm out of parts and ideas."
  - "I started recording another letter. I got as far as her name."
- **Never says:** "I need to know what happened out here"; jargon like "behavioral matrix" (`AuraSystem.js:381`); a name
  for a machine; "Wake me when there's grass."

### Kael Vance · security, 45 · the hold and the chart desk
- **Looks:** spiked grey hair with one white lock, heavy brows, a worn white EVA suit with a ring collar, hands on hips
  (`Vance.js:59`). He stands where he can see the door.
- **Wants / needs:**
  - He wants the truth, and to be believed.
  - At the shipyard he said too many ships were being built, and nobody listened (`BarkSystem.js:219`).
  - He needs to protect people even if nobody ever believes him. At the choice, cutting the disc keeps Earth safe, and it
    means nobody will ever know what he saw.
- **Fear:** seeing it coming again and saying nothing, or losing someone on his watch.
- **Flaw:**
  - He turns down help. He would rather fly by hand at −15 energy (`CampfireEvents.js:119`).
  - He needs things on the record more than he needs them fixed: "I warned you." (`:225`)
- **With Cora:** he wants a witness, not an order. "Nobody else is writing this down, Commander. So I am."
  (`CrewEvents.js:311`). He goes first into danger ("Shut me in.", `Breach.js:53`) and offers his bowl first.
- **Under stress:**
  - At 2 (PARANOID) he refuses options at 30% risk or more (`bundle.js:843, 4070`). Write it as distrust of A.U.R.A.'s
    odds.
  - At 3 he shuts himself in the hold (`bundle.js:926`), where he counts crates by hand (`ShipRoutine.js:176`).
- **Arc:**
  1. He starts the head count (`bundle.js:1516`).
  2. "That is not eight ships. That is hundreds."
  3. "How can a ship with a higher number than ours be older than us?"
  4. He is the one who says to leave Eden.
  5. "Which one of us did they leave out?" (`AnomalyEncounters.js:260`)
  6. "Five. She has never said five before." (`StructureEncounter.js:21`)
- **Voice:** short questions and flat facts. He asks for the number, the hull, the name. He never shouts; he asks again.
- **Lines:**
  - "If I'm wrong, show me. Don't tell me to let it go."
  - "I'll go first. If it goes wrong, it goes wrong to me."
- **Never says:** "I have a bad feeling"; "trust the computer"; a count out loud as a habit; a joke to break the tension.

### Aris Novak · doctor, 38 · the med bay
- **Looks:** a maroon flight helmet with goggles pushed up, blue-black hair with magenta lights, the warmest face aboard,
  smiling (`Aris.js:110`).
- **Wants / needs:**
  - She wants to understand what killed the dead and to honour them (`CrewEvents.js:153-155`).
  - She needs to turn back to the living, and the game already has her line for it: "I understand enough now. Let's look
    after the living." (`SettleCouncil.js:94`)
- **Fear:** one of her own crew on the list: "Nobody from this crew ends up on my list. Nobody." (`CampfireEvents.js:244`)
- **Flaw:**
  - She stops everything for one person.
  - She hides hardship to spare the others: "I'm reusing bandages now. Don't tell them." (`BarkSystem.js:138`)
- **With Cora:** she is the only one who looks after Cora: "You too, Commander." (`ShipRoutine.js:171`). She asks for
  time, never for orders.
- **Under stress:**
  - At 2 she will let no team leave while anyone is hurt (`bundle.js:3864-3868`). Make it something the player can
    overrule.
  - At 3 she faces the wall (`bundle.js:917`; the sprite's `wall` action, CREW_SPRITES.md:121). It is the best-matched
    trait in the game.
- **Arc:**
  1. She starts the list.
  2. "Someone was left alive to bury them." (`StoryPlanets.js:24`)
  3. The list grows too long for her.
  4. On Eden, she sees the grass has no roots (`FailedColonyEncounters.js:241`).
  5. The station crews are the last names she writes.
  6. At the choice, she speaks for the living.
- **Voice:** gentle, firm, unhurried. She talks about bodies, sleep, food and names. On health she gives orders and doesn't
  argue.
- **Lines:**
  - "Your hands are shaking. Sit, eat something, then go back to it."
  - "Nobody died of old age on that ship. Not one. I want to know why."
- **Never says:** a joke about the dead; "leave him"; anything mystical; jargon like "neural patterns" (`bundle.js:4809`).

### Mira Chen · scientist, 29 · the lab
- **Looks:** black hair tied back, one teal lock, a calm half-smile, a cream uniform with gold trim, arms at her sides
  (`Mira.js:107`). Her body is still and her talk is quick: she is waiting for an instruction.
- **The smart one.** She reads the scans and dates the wrecks against the pulsar map (`bundle.js:2778`).
- **Wants / needs:**
  - She wants to be told what to do: "If she told me to jump, I would." (`CrewEvents.js:429`)
  - She needs to trust her own eyes. That turn comes at the spore. Afterwards she says what she thinks before she asks
    A.U.R.A.
- **Fear:** being the one who should have caught it (`BarkSystem.js:146`), and being alone (`:76`).
- **Flaw:** she hands her judgment to A.U.R.A., and she hides her fear behind work.
- **With Cora:** she asks Cora to choose for her. From sector 3 on she tells Cora
  instead of asking.
- **Under stress:**
  - At 2, today, she blocks the safe option: "Mira overrides this" (`bundle.js:4071`). That goes against her want.
    Rewrite it as "Mira goes with A.U.R.A.'s pick".
  - At 3 she takes a full day out (`bundle.js:930`). Write it as her finishing the survey A.U.R.A. asked for.
- **Arc:**
  1. Wonder (`CrewEvents.js:371`), then her first dating.
  2. The garden's pollen gets into her.
  3. "There are a lot more than eight ships" (`TheThrow.js:135`), then the spore.
  4. "One of them has to be a copy." (`AnomalyEncounters.js:30`)
  5. The twin speaks in A.U.R.A.'s voice (`:164`).
  6. At the choice, she answers before A.U.R.A. does.
- **Voice:** before sector 3 she is quick and full of what she is looking at, and her questions are really requests for
  orders. From sector 3 on she is shorter and makes statements.
- **Lines:**
  - "Can you choose for me, Commander? Whatever I pick, I'll be thinking about the other one."
  - "I didn't ask her this time. I looked for myself, and it's a copy."
- **Never says:** "Where's the data in safe?" (`bundle.js:852`); "remote sampling!" (`:3769`); anything cruel about
  A.U.R.A.; an order to the commander.

### A.U.R.A. · the ship's computer
- **In a few words:** sure of every number, and wrong about one.
- **Wants:** to keep the crew moving toward a world to settle (`bundle.js:1019`). She politely steers away from anything
  that slows the trip: "An old curiosity, Commander." (`DiscDocument.js:69`)
- **Her one wrong number:**
  - She names all five of them and still says "four crew" (`bundle.js:1519`). She never notices and never explains it.
  - Everything she measures is right. "Eight ships" is what she was told, so she repeats it as the briefing, not as a
    measurement.
- **With Cora:** she is always courteous and always calls her "Commander". She is at her best when someone asks about
  her: "Thank you for asking." (`CrewEvents.js:475`) and "What do I do now?" (`StructureEncounter.js:41`)
- **Under stress:** none. She never threatens, locks or acts against the crew.
- **Voice:** complete sentences, the fact first, no contractions. That sets her apart without a special word. These lines
  break the rule today: `CampfireEvents.js:129, 241, 304, 355` and `CrewEvents.js:475, 493, 495`.
- **Lines:**
  - "We have the energy for this world or the next one, Commander. Not both."
  - "Jaxon has been awake for thirty hours, Commander. His repairs are getting slower."
- **Never says:** a threat; glitch talk; "trust me"; "I feel"; why it is four; a wrong measurement.

### Cora Moon · commander, 36 · the player
- **Looks:** a silver-white bob with a heavy fringe, a black high-collar suit with cyan trim, upright, hands clasped behind
  her back (`Cora.js:45`). The crew turn toward her, and she rarely turns to them.
- **Her character comes from** four people each asking her for something different. Who she answers is who she is.
  - Jaxon wants her to let him stop.
  - Vance wants her to believe him.
  - Aris wants her to slow down for the dead, and later to look after the living.
  - Mira wants her to choose for her.
  - A.U.R.A. wants her to keep going.
- **She never speaks.** Choices are things she does ("Ask her why", "Read the printed crew list", `bundle.js:1523-1525`),
  never lines in quotes. Others react to what she did.
- **Her own night:** `COMMANDER_DOUBT` (`CrewEvents.js:486`), alone in the command chair with A.U.R.A. In SHIP_LIFE this is
  the one evening she keeps for herself, in sector 5. Its choices still print stress and energy numbers (`:501-534`), and
  those need to go.
- **Never:** a line of her own; a thought bubble; a choice worded as her speech; a crew member telling her what she feels.
