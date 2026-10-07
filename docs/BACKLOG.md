# Backlog — everything open, in one place (updated 2026-10-07)

Every note from the designer's play sessions lands here until it is done. Status: **running** (an agent is on it now),
**next** (agreed, not started), **waiting** (needs the designer's decision), **later**.

## Story

| item | status | notes |
|---|---|---|
| Three story decisions from the spine audit: what the player does at the light without the disc (and what being read costs); what Earth knew and told us; who the fifth person is | waiting | docs/STORY_SPINE_AUDIT.md |
| The dream between sectors 2 and 3 ("Yours is the last one in the line.") gives away the end of the ladder in sector 3; rethink it to fit the story | next, after the story decisions | designer: "we need to rethink it a tiny bit to fit the narrative" |
| ~25 built pages, scenes and lines that contradict the working spine (opening film "every direction", sector 4 orders, ledger, sector 6 log, disc at the light) | waiting on the story decisions | list in docs/STORY_SPINE_AUDIT.md §1 |
| Rename the disc drawing to "the star map" ("Date it with the star map") | next | agreed 2026-10-07 |

## Text and reading

| item | status | notes |
|---|---|---|
| One text system: people talking / things you read / the ship reporting; buttons only for decisions; no fake READ ON buttons | waiting (design done, ~33 h to build) | docs/TEXT_SYSTEM.md + prototypes/screens/text-system.html; 6 questions in §6 |
| The mission log is unreadable: expand hidden until hover, same colour for everything, too much text | waiting (part of the text system) | memory: log-unreadable-feedback |
| Text disappears too fast in the dream sequence (and maybe other films) | next (text system) | rule: a line stays until it can be read, and a click advances |
| Dating a wreck is offered in two places (a popup, then a side-panel button) | waiting (text system: command deck only) | |

## Look

| item | status | notes |
|---|---|---|
| Main screens (sector map, orbit, ship panel, header, log) rethought around the story, Deep field world + Graphite interface | waiting (design done, ~45-62 h to build) | docs/SCREENS_RETHINK.md + prototypes/screens/main-screens.html; 8 questions in §9 |
| Picture style written down for reuse | done | docs/ART_STYLE.md |
| Minigames switch to the Deep field palette (one line: GAME_PALETTE in MiniLab.js) | next | |

## Play

| item | status | notes |
|---|---|---|
| Torch: system crosshair hides the drawn torch; seam needs visible feedback while cutting | done 2026-10-07 | heat colours, one label by the tip; the designer should cut once by hand to judge the feel |
| Landing: the wreck reads as a "structure"; the crew step out in their clothes | done 2026-10-07 | wreck matches its story; EVA suits, hatch and walk |
| The story card after a wreck always shows the same intact rusty ship, even for the crater or burned stories | next | found by the landing work |
| Fallback descent (AwayTeam.js, used when no level ground) still draws the crew in their clothes | later | rare path |
| Economy without ship upgrades; what salvage is for; replay ("play forever") | waiting (proposal done, ~35 h; first-aid fixes ~5 h) | docs/ECONOMY.md |
| Economy bugs: probe gravity check never fires (ProbeSystem.js:15), ending checks a missing upgrade (EndingSystem.js:29), torch result ignored, fuel scoop text says 5-10 but gives 8-15 | next | found by the economy review |
| Remove the fabricator and ship upgrades | next, after the economy doc is approved | designer remembers agreeing to cut it |
| Energy runs out by the end of sector 2 for a careful player | next (economy) | playtest finding |
| Warping between planets inside a sector: the sound "kinda sucks" and the visuals are "meh" | next | today it is the old timing-bar plot (WarpPlot.js); candidates: a short corridor-style flight, or a quiet A.U.R.A.-flown transition with better sound |
| Wreck stories repeat from sector 4 (only seven of them) | later | |
| Cards pile on top of each other: on landing, one notice is covered by a crew moment ("rest or keep working", stress with no clear benefit), then back to the quest text | next | needs one rule: one interruption at a time, no crew moments during a site visit, every crew moment states what each choice gets you |
| Idea from the designer: the interface frays a little as the crew's stress rises (everything slightly more irritating) | idea | does not exist today (only the crew portraits fade); keep it subtle |
| Vance pulls a gun on you (twice) | done 2026-10-07 | now he shuts himself in the cargo hold until the next jump and sits out away missions; the mutiny card is gone |
| Music too loud during minigames | done 2026-10-07 | music drops to 30% while a minigame is open |
| A.U.R.A. letting the air out / "A.U.R.A. mutiny" game over contradicts her calm, never-sinister character | next | same family as Vance's gun scene |

## Release

| item | status | notes |
|---|---|---|
| "BUILT WITH AI ASSISTANCE // 2024" on the title screen | done 2026-10-07 | removed; the AI disclosure belongs on the itch page |
| Hide the TEST button in the public build | next | friends can switch it on by accident (the designer did) |
| New pull request for everything since #6 was merged | done 2026-10-07 | #7, waiting for the designer to merge; public link: https://tahiktim-coder.github.io/Project_Start_map/ |
| Music licence (both tracks are Suno), AI disclosure, phone layout | later, before itch.io | docs/ASSESSMENT_2026-09-29.md §3 |
