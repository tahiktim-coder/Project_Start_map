# Story direction (proposal, 2026-09-20)

Built from your own ideas: the disc, the wait calculation, "sent in time too", only A.U.R.A. knows, wrecks get older the further out you go. Nothing here is generic chosen-one material. Say no to any part and I will change it.

## The lie, and the one strange rule

**What the crew is told:** Earth is seeding the whole sky. Thousands of ships, every direction. Eight went this way before you; you are EXODUS-9, the ninth on this heading. Finding EXODUS-3 or EXODUS-7 dead in sector 1 is sad, but expected.

**What is true:** every ship Earth ever built was sent down this one heading. Nothing was sent anywhere else.

**How the player finds out: the deeper you go, the HIGHER the hull number on the wreck, and the OLDER the wreck.**

- Sectors 1–2: EXODUS-1 … EXODUS-8. The eight you were told about. Dead about 20 years.
- Sector 3: EXODUS-212 … 980. Nobody told you about hundreds. Dead a hundred years.
- Sector 4: EXODUS-1,400 … 6,000. Sector 5: up to 22,000. Sector 6: EXODUS-41,000. Dead four hundred years.

How can hull 41,000 have died before hull 9 was built? Because the drive does two things and the manual only describes one: it throws a ship forward in space and **back in time**. Earth is not gone. Earth is still launching. Every new hull is thrown further back, trying to arrive earlier than the last. You are not the ninth. You are not the last. Everyone who will ever come after you is already dead ahead of you.

The player never gets this as a lecture. They get it as hull numbers, dates, one captain's log (*"You were not thrown further away than they were, Captain. You were thrown less far back."*), and two picture sequences:

- **New game — "what you were told":** Earth throwing ships in every direction, then your heading with eight marks on it and you, the ninth.
- **Entering sector 3 — "what is true":** the same picture, and every one of those lines swings round into this one corridor. A counter runs from 9 to 41,207. The view slides down a corridor of dead hulls to a black slab with one lit edge.

(`src/systems/StoryReel.js`. Add a reel = add an entry to `REELS`.)

## What is at the end

The **disc**: the first thing humanity ever threw out of the solar system with a map to Earth drawn on it. The oldest human object. It has drifted into the Structure, which is older than life on Earth and which **reads** whatever reaches it. It has been reading us for a long time. Every Exodus that arrives is more of us for it to read.

A.U.R.A.'s real orders: get to the disc before it is understood. She cannot say so, because every crew that was told stopped flying. So she lies gently, and nudges you onward whenever you think about settling.

This folds the three answers now in the game into one: the ancient alien structure (the reader), the human disc (what it reads), and the "future humans" line becomes a wrong guess by the crew.

## Endings (one per thing the player can choose to be)

Planet endings (you stop chasing):
- **Settle a good world.** Jaxon's ending. Human, small, and the disc stays out there.
- **Eden.** The kindest world. A.U.R.A. goes quiet for the first time.
- **Settle a bad world.** The colony report tells you how long it lasted.

Structure endings (sector 6):
- **Take the disc home.** Nobody on Earth is alive who remembers sending you.
- **Destroy it.** A.U.R.A.'s orders carried out. She thanks you, and asks what she is for now.
- **Leave it, and add your own.** Aris's ending: let it know us properly.
- **Let A.U.R.A. decide.** Mira's ending. Only reachable if you let her fly most of the trip.
- **Wake the sleepers first.** If you carried cryo pods from the wrecks, the people you saved vote.

## Smaller decisions made

- **Living people are always sleepers** in cryo pods. You carry them in the hold, still asleep (`state._sleepers`). No one "joins" and then vanishes.
- **Earth** is never confirmed gone or alive. The only news from Earth is the newer ships lying dead ahead of you.
- **Vance** worked the launch yard. He counted more than nine keels. He told himself they were for other headings. That is why he is the one who does not trust A.U.R.A.
- **Jaxon** left a daughter. He records letters he cannot send. No letters arrive.
- **Sector 1 = "first attempts"** is kept. It is true, and it is also the trap: low numbers, recent wrecks, everything looks like the briefing said.

## How other games set up "you were told X, the world shows Y"

The shared trick: **state the lie plainly in the first minute, in a friendly voice, then let objects contradict it. Never have a character explain.**

- **Outer Wilds** — nobody tells you the sun is dying. You watch it happen, then notice the museum plaques were wrong.
- **SOMA** — you are told you are a man getting a brain scan. The chair, the dates on the monitors and one photograph do the rest.
- **Returnal** — "this is your first landing" is contradicted by your own corpse, with your voice on its recorder. (This is our EXODUS wreck with a higher number.)
- **BioShock** — "would you kindly" is said forty times before you are allowed to notice it. A.U.R.A.'s "I am sure it is nothing" is ours.
- **Signalis / Citizen Sleeper** — short, flat, second person. "You wake up. The ship is cold." Plain words make strange things stranger.
- **Moon (film)** — the computer is kind, helpful, and lying for your own good. That is A.U.R.A.

## What is in the game now

- New opening: the picture sequence, then the orders, the lie ("you are the ninth on this heading"), Vance's doubt, and a transponder marked on the map as your first thing to do.
- The sector-3 picture sequence that shows the truth.
- Wreck hull numbers follow the rule above.
- Distress signal ages, station ages and wreck ages all grow with the sector.
- A.U.R.A. no longer cheers for settling; she nudges you onward.
- Wreck logs rewritten to hint at the rule instead of "Earth had six months".

## Not yet in the game

The disc inside the Structure, the five Structure endings, Vance's and Jaxon's threads, the sector 3 moment where you find a number higher than your own, and a use for the sleepers.
