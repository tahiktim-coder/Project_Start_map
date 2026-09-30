# Where we are (2026-09-27)

Start here. One page: what is built, what is decided, what is waiting on you, and where everything lives.

## The build

- **Branch:** `rehaul-dither-slice`. Everything since 20 September is in [pull request #5](https://github.com/tahiktim-coder/Project_Start_map/pull/5), still open. Merge it and the public link updates in about a minute.
- **Public link:** https://tahiktim-coder.github.io/Project_Start_map/ (still the 20 September game until #5 is merged).
- **Play locally:** `http://localhost:8000/?art=dither` (add `&mute=1` for silence).
- **Built and working:** the dither look, one site per planet with a marked landing spot, strange worlds that look strange, the docking minigame, station boarding with air and choices, pictures on strange-place cards, the throw dream between sectors 2 and 3, six found pages, six standing-gated endings with a screen that explains locked choices, plain colony endings, save migration.
- **Not done:** the story (below). A.U.R.A.'s orbit and scan remarks, the colony warnings and the game-over screens are still in the old purple style.

## The text

- **Read and edit it here:** `docs/script/` ([index](script/README.md)). One file per sector, plus the opening, the finale, colony endings, random pools, ship and crew, away team, cargo. Every line is tagged with where it lives in the code, so edits can be copied back.
- **Regenerate after any code change:** `node tools/export_script.js`.
- **How lines should sound:** [STYLE.md](STYLE.md). Plain speech, one idea per line, no gimmicks, dead crew never speak.

## The story documents, in order of use

| file | what it is | status |
|---|---|---|
| [CANON.md](CANON.md) | the one story: what the crew was told, what is true, the light, the disc, the twins, the crew, the endings | current, except §6 (the count), which is marked rejected |
| [STORY_COUNT_OPTIONS.md](STORY_COUNT_OPTIONS.md) | the count mystery: what went wrong, a first-time player's read of the early game, four ways to resolve it, an editor's scoring | **waiting on your pick** |
| [STORY_FIX_PLAN.md](STORY_FIX_PLAN.md) | the 23 September diagnosis: four rival plots, dead flags, broken promises | mostly done; kept for the reasoning |
| [STORY_FIFTH_CREW.md](STORY_FIFTH_CREW.md) | the sealed-list answer | **rejected 25 September**, kept as history |
| STORY_DIRECTION.md, STORY_AUDIT.md, STORY_ONE_PAGER.md, the numbered 00–09 files, ALL_GAME_TEXT.md, IMPLEMENTATION_STATUS.md | earlier eras | stale; do not plan from them |

## The story lines: what each does, how it moves, how it closes, how well it works

| line | what it does | sector 1 → 6 | how it closes | verdict |
|---|---|---|---|---|
| **The count** (four vs five) | the hook: A.U.R.A. names five, says four, does not notice | opens in S1 and is explained in the same scene; never returns until the light | the light "cannot find you" | **broken.** The answer was paperwork and it closed in five minutes. Redesign waiting on your pick. |
| **Eight ships / 41,000** (the lie) | the big version of the same error: a friendly voice says eight in a corridor of forty thousand | S1 wrecks 1–8 · S2 the uncut tape ("hundreds") · S3 the throw and hull 980 · S4 "do not tell your crew" · S5 the ledger · S6 the oldest wrecks | the light was what they all flew toward | **works.** The strongest line. Its clues are all objects. Needs the accidental wrong numbers fixed so the real ones stand out. |
| **The time throw** (higher hull, older wreck) | explains why the numbers rise | S3 captain's log says it outright; S5 the ledger ("lost before launched") | never closes | **weak.** It explains a number and moves nobody. Either cut it or give it a job (option 4 does: the last ship is the only one that can see the whole graveyard). |
| **The disc** (the map home) | the thing the light is reading; the reason for the mission | S1 a drawing you fold away · S2 a memo says a computer recited it · S6 it is inside the light | destroy it, carry it, or leave it | **does not register.** You said so. Needs to be a tool (a clock that dates the wrecks), a bait (why every commander walked out), and a stake (being read must cost something). |
| **The light** | the false sun at the end; it reads what reaches it | S3 interference and ghost planets · S5 wrong dates · S6 the sun that gives no heat | the reading, then the choice | **half works.** Good image, no teeth. The game never shows what being read takes from anyone. |
| **A.U.R.A. and the twins** | how Earth knows; why crews are lied to | S2 the memo · S4 "your computer knows the truth" · every ending's vault line | a vault coda on every ending | **over-explained, under-felt.** Cut the vault codas from the endings; keep the twins as one memo. |
| **The crew's wants** (endings) | Jaxon: stop. Vance: the truth. Aris: understand. Mira: be told. Each has three moments; back them twice to unlock their ending | crew moments in pairs of sectors; the talk on each jump | the six endings, gated by standing | **works as a system.** The moments read well. The six endings are six paragraphs; better as answers to one question (who goes out). |

## The 29 September assessment

[ASSESSMENT_2026-09-29.md](ASSESSMENT_2026-09-29.md): the story against the best-written indie games (grade C+ script on an A premise), a played read of the loop (no new systems; cut and fold; ~13 hours of fixes), and an itch.io readiness check (not this week; music licence and AI disclosure first; free with a suggested $3 tip and a downloadable zip).

## Minigame ideas

[MINIGAME_IDEAS.md](MINIGAME_IDEAS.md): five minigames that are story verbs (roll call, fly the corridor, date it with the disc, dead channels, the walk out), each replacing something that exists. Nothing built.

## Decisions waiting on you

1. **The count.** Four options in [STORY_COUNT_OPTIONS.md](STORY_COUNT_OPTIONS.md): One More (the editor's pick), The Walk, The Blind Spot, and The Script (added 25 September, my pick). Nothing is built until you choose.
2. **The time throw:** keep with a job, or cut.
3. **The colony ending where A.U.R.A. shuts off the air:** cut, soften, or keep.
4. **The music licence.** Both tracks are Suno (January and February 2026). Free-plan tracks are non-commercial; a tip button is a grey area. Check which plan the account was on, or the tracks get replaced.
5. **Who fixes the text:** you edit `docs/script/` and I copy it back, or I do a pass on the numbers, the offscreen knowledge and the old-style lines first.

## Per sector, or per story line?

Both, in this order. Plan each **story line** across all six sectors first: where it opens, what sharpens it in each sector, how it closes. That is a one-page ladder per line, and the table above is the start of it. Only then write **per sector**, using the script files, so every scene knows which line it serves. Polishing sector dialogue before the count is decided means writing it twice.
