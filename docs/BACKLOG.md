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
| One text system: people talking / things you read / the ship reporting; buttons only for decisions; no fake READ ON buttons | running (design) | docs/TEXT_SYSTEM.md + mockup when it lands |
| The mission log is unreadable: expand hidden until hover, same colour for everything, too much text | running (part of the text system) | memory: log-unreadable-feedback |
| Text disappears too fast in the dream sequence (and maybe other films) | next (text system) | rule: a line stays until it can be read, and a click advances |
| Dating a wreck is offered in two places (a popup, then a side-panel button) | running (text system decides the one place) | |

## Look

| item | status | notes |
|---|---|---|
| Main screens (sector map, orbit, ship panel, header, log) rethought around the story, Deep field world + Graphite interface | running (design mockups) | docs/SCREENS_RETHINK.md + mockup when it lands |
| Picture style written down for reuse | done | docs/ART_STYLE.md |
| Minigames switch to the Deep field palette (one line: GAME_PALETTE in MiniLab.js) | next | |

## Play

| item | status | notes |
|---|---|---|
| Torch: system crosshair hides the drawn torch; seam needs visible feedback while cutting | running | |
| Landing: the wreck reads as a "structure"; the crew step out in their clothes | running | |
| Economy without ship upgrades; what salvage is for; replay ("play forever") | running (design doc) | docs/ECONOMY.md when it lands |
| Remove the fabricator and ship upgrades | next, after the economy doc is approved | designer remembers agreeing to cut it |
| Energy runs out by the end of sector 2 for a careful player | next (economy) | playtest finding |
| Warping between planets inside a sector: the sound "kinda sucks" and the visuals are "meh" | next | today it is the old timing-bar plot (WarpPlot.js); candidates: a short corridor-style flight, or a quiet A.U.R.A.-flown transition with better sound |
| Wreck stories repeat from sector 4 (only seven of them) | later | |

## Release

| item | status | notes |
|---|---|---|
| Hide the TEST button in the public build | next | friends can switch it on by accident (the designer did) |
| New pull request for everything since #5 was merged | next | public link: https://tahiktim-coder.github.io/Project_Start_map/ |
| Music licence (both tracks are Suno), AI disclosure, phone layout | later, before itch.io | docs/ASSESSMENT_2026-09-29.md §3 |
