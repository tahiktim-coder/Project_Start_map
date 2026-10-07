# One text system (2026-10-07)

The designer: *"We have too many different forms of how we read text: a popup with faces, 'read on', something else. Most of
them feel like UI buttons, but 'read on' shouldn't."* And: *"Date the wreck is weird: I said later, then I still had the option
on the right."*

**Playable mockup:** `prototypes/screens/text-system.html`. It runs one wreck from orbit to the next sector, using real lines.
Deep links: `#1` … `#5` open a chapter. `#3/4` opens chapter 3 and moves on 4 times. `#memo` opens a printed page.

---

## 1. What the game does today (inventory)

Read from the code and from the running game at `localhost:8000` (new game → first orbit, DOM inspected at 1440×900).

| # | surface | file | where it appears | how it looks | how you move on | what is wrong |
|---|---|---|---|---|---|---|
| 1 | **Story card** ("popup with faces") | `EncounterCard.js` | wrecks, stations, asteroid fields, distress calls, crew moments, campfires, the opening, head count, ship alerts, air vent, mutiny, reserve jump, the disc-dating offer, the finale | centred green-bordered card: kicker, title, optional picture, a 2-sentence context + a **more** link, one line at a time with a round face, pips, **skip the talk**, **NEXT ›** (turns into **DECIDE ›**), then choices with chips; hovering a choice shows its full text | the NEXT button, or a click on the line area. Space/Enter work only because NEXT has focus | NEXT and DECIDE are buttons that look like choices. "more" hides a sentence behind a link. Choices with one option are fake decisions: **Take command** (opening), **DEAL WITH IT** (every malfunction). A colour per person (orange, blue, red, purple, green) fights the palette. A.U.R.A. gets a green "AI" badge. The opening A.U.R.A. line is 25 words (limit 20). |
| 2 | **Found page** ("read on") | `FoundPage.js` | the six sector pages, and again from cargo | the same card. Left: a pixel drawing of the object with fake letter-bars. Right: the real words in a numbered list. **READ ON** and **KEEP IT — it stays in your cargo** | only the READ ON button. KEEP IT or a click outside closes it | READ ON is a `.deck-action`, identical to SEND TEAM or REPAIR. KEEP IT looks like a choice, but the page is already in cargo. The words are beside the object, not on it. A stray click outside closes the page half-read. |
| 3 | **Disc drawing** | `DiscDocument.js` | first wreck in sector 1, from cargo, the finale | card with the gold disc. Four label buttons (THE DISC, THE MAP…) that light part of the drawing on hover. A fixed A.U.R.A. caption. **FOLD IT AWAY** | no reading order. One close button | You must hover to read anything. A player who doesn't never sees the map note or Vance's margin note (K.). The labels look like buttons. Three words for one act: KEEP IT, FOLD IT AWAY, GO ON (finale). |
| 4 | **Disc-dating offer** | `bundle.js offerDiscDating` + `OrbitView.js` | after any searched wreck while you have the disc | a story card "THE DISC · Date this wreck", Mira's line, choices **Date this wreck** / **Not now** ("You can still do it from the command deck"). Also a DATE THE WRECK button on the command deck | either | **Two places for one action.** The card asks "now or later", and the same option waits on the right. This is the designer's complaint. |
| 5 | **Films** | `StoryReel.js` | new game, the sector 2 tape, jumps into 2/4/5/6, sector 3 corridor, the reading | full-screen dithered film, a source line, one narration caption at a time, **skip ›** | timed. Space, Enter or Esc **skip the whole film** | Space means "next line" in a card but "skip everything" here. You can't hurry one caption. |
| 6 | **The dream** | `TheThrow.js` | the stalled jump into sector 3 | film frame plus wrong-sized panels. Captions with a bold speaker name. Ends on an arrival card: kicker, title, line, a crew quote with a face, **CONTINUE** | timed. Esc/Enter/Space skip to the card. CONTINUE button | Crew lines in caption style, then a second quote style on the card. CONTINUE is a button for no decision. |
| 7 | **Sector arrival card** | `WarpPlot.js` (`opts.arrival`) | after each sector jump | kicker, sector name, one line, crew quotes (face, name, “quote”), **CONTINUE** | the button | A third way of quoting people. A button for no decision. |
| 8 | **Mission log** | `MissionLog.js` + `addLog` in `bundle.js` | always, bottom strip | stop headers with running totals; speech lines with a small face and a coloured name; ship lines with a glyph and number chips; filters ALL/CREW/SHIP/A.U.R.A./EVENTS; EXPAND | never waits | The only home of barks and most A.U.R.A. lines, at 12 px. It repeats what was just on screen. Five filters is a lot for a 30-minute game. Some lines aren't plain speech: "Orbit established. Systems Green.", "Collectors absorbed 2 energy from minimal ambient radiation." |
| 9 | **Coach tip** | `Coach.js` | a bar floating above the log, over the map | **NEXT** + one line + hide tips | never blocks | It covers the bottom of the map (x 275–1065, y 682–736 at 1440×900). The first instruction is said three times at once: A.U.R.A. in the card, the log, the coach. Lines run to 22+ words. Button names sit in caps mid-sentence. |
| 10 | **Minigame line** | `minigames/MiniHost.js` `ui.say` | inside every minigame | name in caps (sodium for crew, steel for A.U.R.A., dim for narration) + one line, the line before faint above | timed by the game, never waits | Nearly right. **This is the model.** It just looks different from the story card for no reason. |
| 11 | **Orbit / map side panel** | `OrbitView.js`, `NavView.js` | right column | planet blurb in quote marks (*"Frozen surface. Potential cryo-plants."*), raw type names (`ICE_WORLD`), command buttons with cost lines | n/a | A quote with no speaker. Code names on screen. |
| 12 | **Away-team picker** | `AwayTeam.js` | SEND TEAM | "Who goes down?" + four crew rows with a one-line note + SEND THEM / NOT THIS TIME | a real decision | Fine. It is a decision. |
| 13 | **Team on the ground** | `bundle.js showEvaEvent` | surface sites | the find in quote marks, crew objections in coloured italics (*Vance: "…"*), choices with risk bars | a real decision | A fourth way of quoting people: no face, a colour per person, inline. |
| 14 | **Lander instructions** | `LanderGame.js` | landing | a 46-word instruction paragraph | n/a | Too long. (Another session is changing this file now. Noted only.) |
| 15 | **Item toast** | `ItemIcons.js` | any new cargo item | a card slides in: icon, FOUND, name | fades | For pages it repeats the log line, and the page opens anyway. |
| 16 | **Legacy modals** | `bundle.js` | colony warning, crew manifest, cargo hold, reanimation, deck modal, **FABRICATOR MODULE** | old phosphor style, `/// TITLE ///` headers, `[X]` close, inline styles. The colony warning has coloured italic quotes and random numbers ("Colony report for VOLCANIC: 4%") | buttons | A fifth way of quoting people. Old look. **FABRICATION · UPGRADES is still in the deck list at localhost today.** The designer believes it was cut. |
| 17 | **End screens** | `EndScreens.js`, `EndingSystem.js` | game over, endings, colony | full-screen card: kicker, title, story, faces of the crew, stats, one button | one real decision (start again) | Fine. The epilogue uses an inline yellow `/// FIFTY YEARS LATER ///`. |
| 18 | **NarrativeModal** | `NarrativeModal.js` | nowhere: loaded, never called | typewriter card with portraits; still names the commander "Cmdr. Reyes" | — | Dead code that contradicts the canon. Delete it. |
| 19 | **Choice chips** | `EncounterCard.chipsHtml`, `MissionLog` tags | choices, log | "+15 Salvage", "30% risk" | — | Good. Keep as the one way numbers are shown. |

**Count:** five ways to quote a person (card line, page after-line, arrival blockquote, EVA italics, colony-warning italics). Seven words
for "carry on" (NEXT, DECIDE, READ ON, KEEP IT, FOLD IT AWAY, GO ON, CONTINUE, plus skip the talk / skip ›). Two meanings of Space.

---

## 2. The system: three registers

| | **VOICE**: a person speaks | **PAGE**: a thing you found | **SHIP**: the ship and the world report |
|---|---|---|---|
| what | crew or A.U.R.A. say one line | an object with words on it: a plate, a memo, a log screen, the ledger, the disc | what happened, what it cost, what to do next; narration; title cards |
| looks | **the strip**: face (64 px), name, one line in a readable sans, the line before faint above | **the object itself**, large, on a dark surface. Its words are printed on it, in its own type. Lines you haven't reached are grey bars the shape of the words | instrument type (mono), no faces in boxes. A glyph, a short sentence, number chips |
| moves on | click anywhere, **Space** or **Enter**: next line. **Esc**: skip to the choice | click the page, **Space** or **→**: next line. **←**: back. After the last line, one more click puts it away. **Esc**: put it away now | never waits, never needs a click |
| buttons | only choices | none. It goes to cargo by itself | only the command deck's actions |
| lives in | scene cards, under pages, arrival cards; timed in minigames and films; kept in the log | found pages, the disc, re-reading from the log or cargo | the log, the NEXT line, the header numbers, sector title cards, scene captions |

### The rules

1. **A button is a decision.** If pressing it can't change what happens, it isn't a button. NEXT ›, DECIDE ›, READ ON, KEEP IT, FOLD IT
   AWAY, GO ON, CONTINUE, skip the talk, "more" and single-option "choices" (Take command, DEAL WITH IT) all go.
2. **One way to move on, everywhere.** Click anywhere on it, Space or Enter: next. Esc: skip ahead (to the choice, to the end of a film,
   page put away). On a page, ← goes back. The cue is a small blinking ▸ after the last word, not a button. A one-line hint
   ("Click or Space · Esc skips") sits under the first two scenes of a run, then hides.
3. **Faces when the game waits for you, names only when it doesn't.** Faces in scenes, under pages, on arrival cards. Minigames and films
   keep time, so they show names only. The log keeps a small face as a record.
4. **A.U.R.A. has no face.** Her mark is a thin steel ring and her name is steel. People are sodium (name, face frame). She is a voice when
   she is in a conversation. Her routine reports ("Scan complete, Commander.") are ship register: log only, never a box of their own.
   The one exception is an alert she causes that needs a decision (the air vent). That is a scene.
5. **Type tells you who is talking.** Sans = a person. Mono = the ship or the world (log, NEXT, narration, title cards). The object's own
   type = a page (typewriter for memos, engraved caps on plates, screen pixels on a captain's log).
6. **A choice looks like nothing else.** Full-width rows, a number key (1–3), the verb first, costs as chips on the right. They show only
   after the last line, and the faint line above clears so the choice has room. There are always two or more. A yes/no whose "no"
   isn't final is not a choice (see the disc dating, §3).
7. **Lengths.** A voice line is 20 words at most (STYLE.md). A scene's opening narration is 2 sentences and 30 words at most, with no
   "more": cut it instead. A page line is 25 words at most, 5 lines a page. A ship line is 12 words plus chips. A NEXT line is
   14 words. **40 words on screen at most**, counting the faint line. On a page only the current line is full ink; read lines fade
   to 30 %.
8. **The screen shows now; the log keeps what happened.** Nothing appears twice at once. While a scene or page is open, its lines aren't
   written to the log. When it closes they go in as a transcript (small face, name, line), then the result with chips. A choice's
   result goes to the log only (no result box). The header numbers float +/−. Barks go to the log only. Pages get a log line with a
   **read again** link. No toasts for pages.
9. **NEXT lives in the log**, as its first row, not floating over the map. It names a button in a small key cap drawn like that button.
   It hides while anything is open. It never repeats what is already on screen or in the newest log line. "hide tips" stays.
10. **Colour.** Interface is Graphite (steel and grey). People are sodium orange. A.U.R.A. is steel. Pages carry their material's colour
    from the Deep field world (paper, gold, metal, screen). There is one red, for loss and danger chips.

### Where each kind of text goes

| kind of text | register | where | example |
|---|---|---|---|
| what the place looks like when a scene opens | SHIP (narration) | first beat of the scene strip, mono, no name | "The decks are wrecked, but the hold is sealed and dry." |
| a crew line in a scene | VOICE | the strip, face + name | Jaxon: "They packed this for the next crew." |
| A.U.R.A. in a conversation | VOICE | the strip, steel ring | "Four crew, Commander. All well." |
| A.U.R.A.'s routine report | SHIP | log, steel ring | "Scan complete, Commander. The results are on your screen." |
| a bark (remark on an event) | SHIP | log only | Aris: "In orbit. The med bay's ready if anyone needs it." |
| what a choice cost or gave | SHIP | log line with chips + header float | "Half the hold taken. +15 salvage −1 ration" |
| a found page | PAGE | the object, then one voice under it | the memo; Mira: "Does ours?" |
| what to do next | SHIP | NEXT row of the log | "[DATE THE WRECK] lines its last star fix up with the disc." |
| a sector arrival | SHIP, then VOICE | title card: kicker, name, one line; then one face | THE SIGNAL; Mira |
| film captions | SHIP / VOICE, timed | centred; narration mono, voices name + sans | "Nobody answers." / MIRA "A.U.R.A.? Are you there?" |
| minigame talk | VOICE, timed | the MiniHost strip, names only | A.U.R.A.: "EXODUS-4's last star fix, Commander." |

---

## 3. Dating the wreck: one place, one way

**Decision: the command deck is the only place. No card ever asks.**

- After the team is back (and, the first time, after the disc page is put away), Mira says it once, in the strip under the page or at the
  end of the wreck scene: *"The disc has a pulsar map. Match the wreck's last star fix to it, and we'll know when they died."*
  If Mira is dead, A.U.R.A. says *"The disc's pulsar map can date this star fix, Commander."*
- **DATE THE WRECK** appears on the command deck with a **NEW** tag that pulses three times. The NEXT row says
  *"[DATE THE WRECK] lines its last star fix up with the disc."*
- It stays while you are in orbit of that wreck. Once dated, the button reads **WRECK DATED · dead 21 years** and can't be pressed.
- Delete `offerDiscDating` (`bundle.js`). `collectWreckFinds(...).then(() => this.offerDiscDating(planet))` becomes a call that logs
  Mira's line and refreshes the deck.

**Why not the other way (play it straight after the wreck)?** Dating is optional on every wreck after the sector's story planet is
found. Forcing a minigame each time costs minutes. And the command deck is where every other thing you can do at a planet already
lives (scan, probe, team, settle). One verb, one place.

---

## 4. Every surface → its register → what changes

| current surface | register | what changes |
|---|---|---|
| EncounterCard (all scenes) | VOICE | Keep the card and picture. Context becomes the strip's first beat (mono, ≤2 sentences, no "more"). Replace NEXT/DECIDE/skip/pips with click·Space·Enter + ▸ cue + Esc. One face style; A.U.R.A. gets the ring. Names without titles ("Jaxon", not "Eng. Jaxon"). Choices become numbered rows. Remove single-option choices (opening, malfunctions: the card just ends on click). Steel top rule, Graphite surface. |
| FoundPage | PAGE | The words go *on* the object (HTML on a dithered paper / plate / screen, not a canvas of fake letters). Grey word-bars for unread lines. Click/Space/→ turn, ← back, Esc away. Remove READ ON and KEEP IT; a quiet "▤ IN YOUR CARGO" tag appears at the end. The after-line uses the VOICE strip under the page. A click outside no longer closes it; it turns. |
| DiscDocument | PAGE | The four notes become four page turns, printed beside the photo of the disc with numbered callouts. Each turn lights its part. After the last, hovering a note re-lights it. A.U.R.A.'s remark and Mira's dating line become voices under the page. Remove FOLD IT AWAY / GO ON. The finale version ("inside the light") uses the same page with its own provenance line. |
| offerDiscDating | — | Deleted (§3). |
| OrbitView command deck | SHIP | Add the NEW tag and done state for DATE THE WRECK. Planet blurb loses its quote marks; type names in words ("ice world"). |
| StoryReel films | VOICE/SHIP, timed | Click/Space/Enter = next caption now; Esc = skip the film. Caption type per §2. Keep "skip ›" as a quiet hint, not a button. |
| TheThrow | VOICE/SHIP, timed | Same input as films. Voices: name + sans, no face. The arrival card uses the shared title card below. |
| WarpPlot arrival card | SHIP → VOICE | Title card: kicker, sector name, one mono line, then one VOICE strip with a face. Click anywhere. Remove CONTINUE. |
| MissionLog | SHIP | Lines from an open scene or page are held and written as a transcript when it closes. Graphite colours: names sodium, A.U.R.A. steel, no per-person colours. Filters cut to ALL / VOICES / SHIP (or none). The NEXT row moves in here. Plain-speech pass on system lines. |
| Coach | SHIP | Becomes the log's NEXT row. ≤14 words. Key caps for buttons. Never repeats an on-screen line. Hidden while anything is open (already true). |
| MiniHost `ui.say` | VOICE, timed | Keep. Restyle to the same strip type (name caps, sans line). No faces. |
| AwayTeam picker | decision | Keep. Restyle to Graphite. |
| EVA "team on the ground" | VOICE + decision | Crew objections become a VOICE strip with faces above the choices. The find is mono narration, no quote marks. |
| Item toast | SHIP | Pages: no toast (the page opens and the log keeps it). Other items: a log line with the icon. |
| Colony warning (legacy) | VOICE + decision | Rebuild as a scene: crew lines in the strip, two choices (*Keep moving* / *Settle anyway*). Drop the random percentage. |
| Crew manifest, cargo hold, deck modal, reanimation (legacy) | SHIP | Graphite panels, no `/// ///`, a close by Esc or a click outside (these are panels you opened, not text to read). |
| FABRICATOR MODULE / FABRICATION deck | — | Confirm the cut; remove from the deck list and the modal. |
| End screens | SHIP + decision | Keep. Swap the inline yellow epilogue header for the title-card style. |
| NarrativeModal.js | — | Delete (dead, says "Cmdr. Reyes"). |

---

## 5. Build checklist (rough hours)

| # | task | files | hours |
|---|---|---|---|
| 1 | **TextStrip**: one component (face/ring, name, line, faint previous line, ▸ cue, click/Space/Enter/Esc, timed mode with names only). Shared tokens and CSS. | new `src/systems/TextStrip.js`, `theme.css` | 4 |
| 2 | EncounterCard on TextStrip: narration first beat, no NEXT/DECIDE/skip/more, numbered choices, 1–3 keys, single-option choices removed | `EncounterCard.js`, `ship.css`, callers in `bundle.js` | 4 |
| 3 | FoundPage rewrite: words on the object (paper, plate, log screen, ledger), word-bars, page-turn input, auto-keep, after-line in TextStrip | `FoundPage.js`, `theme.css` | 6 |
| 4 | DiscDocument as a page: notes as turns, callouts, voices under it, finale variant | `DiscDocument.js` | 2 |
| 5 | Disc dating in one place: delete `offerDiscDating`, Mira's line at the end of the finds, NEW tag on the deck, NEXT line | `bundle.js`, `OrbitView.js`, `Coach.js` | 1 |
| 6 | Films and the dream: Space/click = next caption, Esc = skip; caption types; arrival via the shared title card | `StoryReel.js`, `TheThrow.js` | 3 |
| 7 | Shared title card for sector arrivals | `WarpPlot.js` | 1 |
| 8 | Log: transcript-on-close, no duplicates, NEXT row inside, fewer filters, Graphite colours, plain-speech pass on system lines | `MissionLog.js`, `log.css`, `bundle.js` | 3 |
| 9 | Coach into the log: ≤14 words, key caps, no repeats | `Coach.js` | 1.5 |
| 10 | Remove page toasts; item finds as log lines with icons | `ItemIcons.js`, `MissionLog.js` | 0.5 |
| 11 | Legacy: colony warning → scene, EVA crew lines → strip, delete `NarrativeModal.js`, confirm the fabricator cut | `bundle.js`, `index.html` | 3 |
| 12 | Copy pass: every on-screen line against §2 rule 7 (the opening A.U.R.A. line, coach lines, the lander text once its owner is done) | data files, `Coach.js` | 2 |
| 13 | Check at 1440×900 and phone width, both by playing a full run | — | 2 |
| | **total** | | **≈ 33** |

Order: 1 → 2 → 5 (fixes the complaint fast) → 3 → 4 → 8/9 → 6/7 → the rest.

---

## 6. Open questions for the designer

1. **Barks:** log only (my pick), or should a crew remark also show for 3 seconds as a small strip over the map, without blocking?
2. **Dating after you leave:** once you break orbit, the chance to date that wreck is gone (the late reveal still makes sure the page is
   found). Fine, or should a wreck stay datable from the map?
3. **The faint previous line:** kept, as in the minigames. Some players may find two lines busier than one. Keep it?
4. **Type:** the mockup uses IBM Plex (Sans for voices, Mono for the ship). The game uses Helvetica and the system mono. Adopt Plex, or
   keep the current fonts with the same rules?
5. **Names:** the mockup shows first names only ("Jaxon", "Vance"), dropping "Eng." / "Spc." / "Tech". OK?
6. **Hint line** ("Click or Space · Esc skips"): show it for the first two scenes only, or always?
7. **Fabricator:** it's still in the deck list at `localhost:8000` today. Is it cut? (Not part of this job. Spotted while looking.)

**Decided 2026-10-07** (the designer: "yes all", and names only): 1 barks go to the log only · 2 no dating after you leave
orbit · 3 keep the faint previous line · 4 IBM Plex · 5 first names only, never "Eng." / "Spc." / "Tech" · 6 the hint line
shows in the first two scenes only · 7 the fabricator is cut (with the economy work).

**Verdict on the mockup:** the three kinds of text are right, but the screen "looks like a dashboard". Reading must live in
the game scene, not in panels. See docs/GAME_SCREEN.md (the next pass).
