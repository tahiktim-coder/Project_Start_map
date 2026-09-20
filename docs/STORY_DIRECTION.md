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

## What is at the end, and why any of this is happening (holes closed, 2026-09-20)

**The disc.** In 1977 we bolted a gold disc to a probe and threw it out of the solar system. On it: what we look like, and a map — fourteen ticking stars, and where their lines meet is home. It was a greeting. It is also the only object in existence that says WHERE we are.

**The Reader.** The disc drifted into the Structure. The Structure is not a weapon and it does not chase anyone (so: **no Pursuer**; the pressure in the game is the closing jump window, and it stays that). It does one thing: it **reads** whatever reaches it, completely, and what it has read completely it can make again. The deep sectors are already full of its copies — the ghost planets, the wrong places, the voices on dead channels, wrecks that are slightly wrong.

**How Earth found out (your quantum-link idea, made the spine).** Every ship's A.U.R.A. is one half of a linked pair; the other half sits in a vault on Earth. The link cannot carry words. It does not care about distance, and it does not care about *when*. The first Exodus was an honest colony ship. Years after it left, its twin on Earth began to speak in a voice that was not its own, reciting the disc: the greeting, the two figures, the fourteen lines. Something out there had the disc, had the ship's mind, and was reading *up the link, toward Earth*.

**So the programme.** Reach the disc and destroy the map before it is fully read. The drive throws a hull forward and back in time, so each new hull can arrive a little earlier than the last. The moment a hull is thrown, its twin on Earth shows how it ended. Earth has watched forty-one thousand twins go wrong, and laid the next keel each time.

**Why the crews are lied to.** This is the part that makes the lie necessary rather than cruel: **whatever a crew knows, the Reader learns.** Machines are read in an instant — that is why the hundreds of unmanned hulls did nothing. People are slow to read. A person can get close. But a crew that knows the purpose carries the purpose in with them. So the crews are told a small, harmless story (ninth on this heading, find a home), and only A.U.R.A. knows — and A.U.R.A. is the one thing aboard that must never be read, which is why her last order is about herself.

**Why you.** EXODUS-9 had the weakest drive. It was thrown the *least* far back. So it arrives **last**, after everything else Earth ever sent has already failed and been read. You are not the ninth. You are the last ship in the corridor. And yours is the only twin in the vault that has not changed. Earth does not know how you end. That is why the ending is yours.

**Nobody goes home.** The drive only throws one way: outward, and backward. There is no ending where you return to Earth, and the Structure cannot send you anywhere. (This was the hole in "take the disc home": if going home were possible, none of the rest would make sense.)

## Endings

Planet endings — you stop:
- **Settle a good world** (Jaxon's). Small and human. In a vault on Earth, a twin stays quiet for another lifetime, and nobody knows why.
- **Eden.** The kindest world. A.U.R.A. says nothing at all for the first time.
- **Settle a bad world.** The colony report tells you how long it lasted.

Structure endings — sector 6:
- **Break the map.** What Earth wanted. It knows what we are; now it will never know where. A.U.R.A. thanks you, and then asks what she is for.
- **Let it read you** (Aris's). Forty thousand crews were read as they died afraid. Let it read one that chose to be. Nobody knows what that does.
- **Carry it on.** Take the disc aboard and keep flying, past the Structure, forever. As long as you never stop, it is never read. The sleepers in your hold are the crew of a ship that does not arrive.
- **Let A.U.R.A. decide** (Mira's; needs you to have let her fly most of the trip). She burns the ship, the disc, and herself. She was never going to be read.
- **Wake the sleepers first.** If you carried pods from the wrecks: people from hull 905, hull 12,330. They have seen more of this than you. They vote.

## Does the disc idea have holes? The ones I found, and the fix

| Hole | Fix |
|---|---|
| Crew already knows ships went before them | The lie is "ninth on this heading, thousands elsewhere" (yours) |
| How can they go home in a Structure ending? | They cannot. No ending returns to Earth |
| If the thing can read everything, what is there to hide? | It knows WHAT we are from the crews. Only the disc says WHERE. That is the one secret left |
| How did Earth learn any of this? | The linked twin on Earth started reciting the disc (your quantum-link idea) |
| Why lie to crews at all? | What a crew knows, it learns. Ignorance is the armour |
| Why send people, not bombs? | Machines are read instantly. People are slow to read, so a person can get close |
| Why is hull 9 the one that matters? | Weakest throw, arrives last, and its twin is the only one still unchanged |
| Do we need a Pursuer? | No. Nothing chases you. The thing at the end is patient, which is worse |

## Found documents (the way the player learns this, a page at a time)

1. **Drawing of the Disc** — *built.* In the logbook of the marked wreck in sector 1. A.U.R.A.: "An old curiosity. I would not spend time on it."
2. **The vault memo** — sector 2–3. One paragraph about "twin 0001 began speaking at 03:14".
3. **A captain's last entry** — sector 4. "We told the crew. They stopped flying within the week. Do not tell yours."
4. **Launch ledger** — sector 5. Columns of hull numbers, each with a time of failure *earlier than its launch*. The last row is hull 9. The failure column is empty.

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
- The Drawing of the Disc: a kept document with an animated dithered disc (`src/systems/DiscDocument.js`).
- The planet screen has a star, air, dust and your ship in orbit (`src/systems/OrbitVista.js`).

## Not yet in the game

The disc inside the Structure, the five Structure endings, documents 2–4, Vance's and Jaxon's threads, a use for the sleepers, and picture sequences for the endings.
