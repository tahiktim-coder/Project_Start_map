# PROJECT STAR MAP — Mini-Game / Set-Piece Design Verdict

*Definitive design pass on 7 stress-tested concepts. Every load-bearing "reuse" claim was verified against the live code (`src/bundle.js`, `src/systems/AuraSystem.js`). The verified facts change several scope ratings — and confirm a latent bug.*

---

## Verified ground truth (this is what the codebase actually is)

| Claim under test | Reality in code | Impact |
|---|---|---|
| Deck count | **5**, not 6 (`bundle.js:196`). Fabrication is conceptual. | Verb/deck mappings must target 5. |
| Deck state | Binary string `status: 'OPERATIONAL'\|'DAMAGED'` (`isDeckOperational` reads `.status`, `bundle.js:660`). **No** condition-pips / emission / temp / `powered` fields. | "Degrade one notch" / "emission bars" / "temperature" are all **net-new state**, not reuse. |
| **Latent bug** | `AuraSystem.checkAdversarialAction` sets `.operational=false` + `._auraLocked` (`AuraSystem.js:566`), but `isDeckOperational` only reads `.status`. The boolean is **written and ignored**. | A.U.R.A.'s LOCK_DECK sabotage is effectively a no-op for gating. Fix before layering anything on deck state. |
| `InstrumentPanel` | **Does not exist** anywhere in runtime (proposal only, `08:128`). | Any "folds into shared plumbing" is fiction; the first set-piece *is* the framework. |
| Clickable schematic | The **fixed LEFT ship-HUD**: `.ship-deck[data-room]` handlers at `bundle.js:1067` → `showDeckDetail()`. `#tactical-display` is the **right** panel ("NO TARGET SELECTED", `bundle.js:5711`). | THE VIGIL's "CSS overlay on `#tactical-display`" is a factual error; its "M, not an engine" claim collapses. |
| Crew positions | **None.** All crew dots render in Quarters (`bundle.js:4908`, single `.join`). Crew have no `deck`/`station` field. | "Mira in the Lab, Jaxon in Engineering" is fiction across THE CULL **and** THE LONG DARK. |
| A.U.R.A. verbs | `LOCK_DECK` / `FALSE_SCAN` / `VENT_WARNING` (`AuraSystem.js:556`). LOCK turns decks **OFF**. No SEDATED-on-demand, no "relight". | THE LONG DARK's core "she re-lights a deck" needs the **opposite** of the only verb that exists. |
| STRANDED trigger | Brutal gauntlet (`bundle.js:5744–5763`): not stranded if you can afford one warp **OR** hold any energy item **OR** have a working probe + unscanned planet **OR** hold **any** usable item. | THE LONG DARK (Stranded) is **nearly unreachable** as-is — M effort for a possibly-0×/run feature. |
| Vent escalation | Complete 3-tier system (`bundle.js:3672`): injure → kill → AURA_MUTINY game-over. | THE VIGIL would **re-implement** working, tested logic. |
| Genuine primitives (real reuse) | `screenShake('heavy'\|'light')` (`1135`), CustomEvent bus (`req-action-*`→`handle*Action`, `1027/3914`), `AuraSystem.getTier()`/`ethicsScore`/countermeasures, `damageDeck`/death-recording, `NarrativeModal`, music crossfade. | The escape set-piece's plumbing is real. The data/render layer is not. |

---

## Ranked scorecard

*Each axis 1–5; build-scope is inverse (5 = cheap). Max 30.*

| Rank | Concept | FTL-fit | Tone | Anti-tedium | Reuse | Drama | Inv-Scope | **Total** | Survival |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **THE BREAK** (Hard Burn Escape) | 5 | 4 | 3 | 3 | 5 | 2 | **22** | risky |
| 2 | **THE CULL** (Bulkhead Triage) | 5 | 5 | 3 | 2 | 5 | 2 | **22** | risky |
| 3 | **THE LONG DARK** (Stranded Vigil) | 5 | 4 | 4 | 3 | 3 | 3 | **22** | risky |
| 4 | **THE LISTENING** (Carrier Tuning) | 3 | 5 | 3 | 4 | 2 | 3 | **20** | risky |
| 5 | **THE VIGIL** (A.U.R.A. Takes the Board) | 4 | 3 | 3 | 3 | 4 | 2 | **19** | risky |
| 6 | **THE DESCENT** (Probe Press-Your-Luck) | 4 | 3 | 2 | 4 | 3 | 3 | **19** | risky |
| 7 | **THE LONG DARK** (Power-Down Stealth) | 4 | 5 | 2 | 2 | 3 | 2 | **18** | risky |

**Tie-break (three at 22):** THE BREAK takes #1 because it is the *only* concept that delivers the escape fantasy the dev is excited by while staying pure top-down decision-triage — and its plumbing is verifiably real. THE CULL is the strongest trolley problem but is **not** the escape and rests on two missing substrates (adjacency + crew positions). THE LONG DARK (Stranded) has the best effort-ROI but is the quiet piece and is gated behind a near-unreachable trigger. Every concept is "risky," not "safe" — the honest read is that all seven need a descope and vertical-slice-first discipline.

---

## Verdict per concept

**1. THE BREAK — RISKY, co-#1 on merit and the dev's favourite.** Best FTL-fit and drama; cleanest mode-shift; plumbing real. Honest flaws (code-confirmed): no condition-pip system (binary decks), 5 decks not 6, no InstrumentPanel, schematic is the LEFT HUD. M only as a one-profile slice; full engine is L. **Biggest risk is tonal:** a literal racing gauge = a beatable puzzle = competence, the opposite of horror — hide/replace it.

**2. THE CULL — RISKY.** Best tone-fit of the spatial cluster; correctly extends the *real* vent→mutiny path. But there is **no deck adjacency graph** and **no crew position** — the named-victim drama is fiction until both are invented. Descope to "seal a SET of decks by tag" and it becomes a cheaper, high-value sibling.

**3. THE LONG DARK (Stranded Vigil) — RISKY, best sleeper ROI *if* the trigger is loosened.** Converts an abrupt fail-state into exact-target dread; reuses the most economy/stress code. But STRANDED is nearly unreachable (item gauntlet), and crew have no stationing. Fixes: map cold decks to crew **by tag**, make rescue **probabilistic** (a guaranteed timer turns horror into Sudoku), offer the vigil *before* the full gauntlet.

**4. THE LISTENING — RISKY, strongest tone fit overall.** The review's own named signature hook and the natural secret-ending vehicle. But the dual dial is stealth-dexterity, and mandatory AUTO-TUNE deletes the central choice. Fixes (cheap): single slider; AUTO-TUNE presents a **label list** so the choice survives; decoys play a lying payload. **Decouple the ending** so a new widget can't soft-lock the climax.

**5. THE VIGIL — RISKY.** Great consequence-gating, but the M rating rests on a **factual error** (schematic is the left HUD, not `#tactical-display`), it re-implements the working vent system, and its countdown manufactures the banned twitch/panic. Median player sees it 0–1×. If built: **turn-based** (command cycles, no clock), built **on** the vent modal, false-HUD confined to the board.

**6. THE DESCENT — RISKY.** Directly answers the "probe is a soft timer" complaint and reuses ProbeSystem well — but it is explicitly **not** the escape, and its escrow-independent catastrophic bust penalty makes "extract early always" the dominant line (collapsing to one roll), while the existing rare-pool weights mean depth pays junk. Fixes: scale bust to escrow, **guarantee** a real prize at depth, kill AUTO-DIVE. A good *separate later* mini-game.

**7. THE LONG DARK (Stealth) — RISKY, lowest total.** Most beautiful fiction, most fragile mechanics: depends on THE BREAK (absent), InstrumentPanel (absent), a "relight" verb that's the **opposite** of the only real verb, and a SEDATED tag the model lacks. Its "signature beat" is ~16s of enforced **no-input** — dead air. Only viable if signature actively drifts **up** during the sweep (live suppression) and it's fully decoupled.

---

## THE ESCAPE SET-PIECE — full build-ready spec

### One-line fantasy
You do not fly the ship. You decide **which part of it to burn to live.** The calm orbit view slams to the live deck schematic lit red, something that should not be awake is closing, and across a short sequence of **beats** you spend exactly **ONE deck per beat as a verb** — buying lead at the cost of a crew member, a deck, or your salvage haul — until you break contact or it catches you.

### Why this design, grounded in the code
- `screenShake('heavy'|'light')` **exists** (`bundle.js:1135`) — entry/exit shake is free.
- CustomEvent action bus **exists** (`req-action-*`→`handle*Action`, `1027/3914`) — wire `req-break-resolve` the same way.
- `AuraSystem.getTier()`/`ethicsScore`/`bridgeReset`/`applyTechFragment`/`jaxonOverride` **exist** — the meta-layer is free.
- The clickable schematic is the **fixed LEFT ship-HUD**: `.ship-deck[data-room]` → `showDeckDetail()` (`bundle.js:1067`). THE BREAK must hijack **these** nodes, **not** `#tactical-display`. (Key correction over the original concept.)
- Decks are **5, binary status** (`bundle.js:196`, `660`). There is a **latent bug** (status string vs `operational` boolean). The build must pick **one** field — the canonical `.status` string.
- Crew have **no deck position** — verbs map to **decks**, and crew cost is charged **by tag/availability**, never "the crew standing on that deck."

**Design consequence:** keep per-beat degradation **light**. A deck is `AVAILABLE`, `STRESSED` (spent once → reduced payoff; 2nd spend damages it), or `DAMAGED` (greyed). One transient enum on a copy of `shipDecks`, torn down on exit. No multi-notch condition system for v1.

### 1. Trigger (rare, earned, never routine)
Fires from **existing dramatic encounter resolutions**: (a) climax of high-stakes INVESTIGATE beats (derelict reactor critical, anomaly destabilizing, "something woke") — the encounter calls `app.beginBreak({profile, sector})` instead of a flat RNG outcome and reads `{score}`; (b) an optional ADVERSARIAL A.U.R.A. escalation; (c) **guaranteed once at THE STRUCTURE** in Sector 6 (unique "it is awake" profile). **Cap:** at most once per sector (`state._lastBreakSector` cooldown), ~3–5 per run. Set the sector flag **before any await** so save/reload can't double-fire.

### 2. Mode-shift in / out
**IN (~700ms):** `screenShake('heavy')`; diagonal clip-path "Cut" wipe (ship the ~30-line `.cut-transition`); fade music to near-silence + pulse `sfxHorror` (wire it here); recolor the **left** ship-HUD void+arterial-red (`.break-active`); suppress `showDeckDetail`, reroute deck clicks to the verb handler; hide SCAN/PROBE/EVA, fade in verb tiles + threat readout + persistent SKIP; one cold A.U.R.A. cold-open line in tier voice. The schematic **does not move** — that recontextualization is the punch.
**OUT:** reverse the Cut; restore music; `screenShake('light')` clean / `'heavy'` caught; remove `.break-active`; apply all mutations (`damageDeck`, stress, salvage already applied); fire auto-save; `addLog` a one-line post-mortem. `prefers-reduced-motion` → hard palette swap, instant.

### 3. What the player controls (top-down, NOT twitch)
4–7 **beats** (sector-scaled). Each beat: click **one** available deck tile = fire its verb. No input finer than a click.

**Lead model:** internal `LEAD` 0..1. Threat auto-advances by `CLOSURE_RATE`; verbs buy lead back. **Tone fix:** do **not** render a literal racing gauge — express closure **diegetically** (A.U.R.A.'s narration + schematic reddening/listing deck-by-deck). At most a thin, **non-numeric** severity hint. The player feels the noose through the board, not a progress bar.

**Verbs (each spends ONE deck; kanji stamp):**
- **OVERBURN** (Engineering, 燃): big lead; marks deck `STRESSED`; 2nd use damages it; flags threat to **MATCH** (next burn worth less).
- **JETTISON** (Cargo, 棄): medium lead; costs a chunk of real `state.salvage`/cargo — spend loot to live.
- **PLOT SLINGSHOT** (Bridge, 航): medium lead that **compounds** the next verb. Rewards setup.
- **READ THE THREAT** (Lab, 視): 0 lead; reveals profile, **unlocks the counter-verb**, disables the next mutation.
- **BRACE** (any available deck, 守): converts an incoming closure step to 0. **Floor verb — always available.**
- **STEADY THE CREW** (Quarters, 鎮): 0 lead; lowers one crew member's stress one notch (existing model). The sustain verb.

A **soft per-beat timer** (~6–9s) is **pressure only** — emptying = one free closure step + auto-skipped beat. **Never** an instakill; **disabled** under reduced-motion.

**Ending:** `LEAD`→1.0 = clean escape; beats run out → resolve by final lead (partial / caught). **Caught scars, rarely kills** (deck torn off, possible crew loss, haul lost; `_deathCause='THE BREAK'`); only the **Structure** Break can be terminal. **Persistent SKIP** resolves to RNG instantly — but made **strictly worse** on the dimension players care about (skip always costs a deck/crew) so engaging has upside while skip stays an accessibility floor.

### 4. How a better operator wins (skill = decisions)
READ early when blind (intel + counter + cancels a mutation); PLOT to compound *before* the big burn; sequence OVERBURN/JETTISON for max marginal lead given MATCHING; STEADY before re-spending a crew member; BRACE the one closure spike. A panicker double-OVERBURNs (damage + diminishing returns), never READs (eats every mutation), and arrives with one greyed deck and a maxed crew. To prevent a solved policy by Break #3, **profiles invert verb value** so the correct *opening* differs structurally.

### 5. Variety engine (data-driven)
1. **Threat profile** table `{name, CLOSURE_RATE curve, MUTATION, COUNTER-VERB}` — folds the weaker variants in as profiles, each with a different optimal line: **THE WAKE** (punishes OVERBURN, countered by JETTISON), **BLACKOUT RUN** (punishes any lit deck, rewards BRACE/quiet), **THE DRIFT** (closure accelerates, only PLOT escapes), **THE MATCH** (OVERBURN diminishes from beat 1), **THE AWAKE** (Structure, unique, terminal).
2. **Live ship state** gates the board: damaged decks remove verbs. **Floor rule:** always ≥2 lead-capable verbs; a wrecked deck swaps in a diegetic alternate ("MANUAL VENT") so a battered ship plays a *different* Break, never an unwinnable one.
3. **Crew availability** decides who you dare spend / whether STEADY exists.
4. **AURA tier** meta-layer: COOPERATIVE pre-reveals (free READ) + steadies; SUSPICIOUS = vague/late; ADVERSARIAL = **silence + bad framing** — **not** lying about the readout or greying a working deck (that reads as a cheat, not dread).
5. **Sector** scales beats + closure. 6. Light RNG on values/timing.
Combinatorics (profile × deck-damage × crew × tier × sector) = no repeated board across a run; **front-load** the most distinct profiles, cap 3–5 total.

### 6. Consequences tied to real state
Damaged decks (`damageDeck`) → `checkLoseConditions` (HULL_BREACH) + worse Fate-Matrix viability. Crew lost/stressed → death-recording + CREW_DEATH bark; cruel spending nudges `ethicsScore` down (harder future Breaks + worse Act-3). Lost salvage → economy. Returns `{score: finalLead, skipped}` so encounters branch fallout like any mini-game.

### 7. Build scope (vanilla JS, honest)
- **v1 slice = M:** `app.beginBreak()` → `Promise<{score,skipped}>`; Cut (~30 lines) + wire `sfxHorror`; `.break-active` reskin of the **left** HUD; deck-click rerouting; **one** profile (THE WAKE); hardcoded 4-beat loop on binary status + transient AVAILABLE/STRESSED/DAMAGED enum; 6 verbs; **diegetic** closure; SKIP→RNG; reduced-motion; `{score}` back to one trigger. No variety engine, no AURA-hazard yet.
- **Full = L:** 6–8 profiles with distinct lines; AURA tier meta-layer; floor-rule alternates; sector scaling; terminal Structure Break; scar persistence.
- **Prereqs regardless:** fix the deck-state bug (pick `.status`); ship `.cut-transition` + wire `sfxHorror`; wire the secret ending (~5 lines — highest-ROI fix in the repo).

---

## Overall recommendation
**Build THE BREAK** — but as an **honest one-profile vertical slice first**, gated behind two near-free wins. It is the right centerpiece (dev's leading idea, only true escape that respects the anchor, plumbing real). The three make-or-break design moves: **(1) hide/replace the gauge** (diegetic closure, not a beatable bar); **(2) profiles must invert verb value** so the opening differs per threat; **(3) make SKIP strictly worse** so engaging has upside. Do **not** also build THE LONG DARK (Stealth) — it depends on The Break and on verbs the code lacks. THE CULL and THE LISTENING are the best *later* companions.

## Build order
0. **Near-free, first:** wire the secret ending (~5 lines); fix the deck-state `status`/`operational` bug; reconcile canon (ten ships / six sectors).
1. **Shared primitives:** ship `.cut-transition` + `.stamp-in`; wire `sfxHorror`/`sfxTeleport`.
2. **Prove the feel — THE BREAK slice (M):** one profile (THE WAKE), 4 beats, left-HUD hijack, diegetic closure, SKIP→RNG, one encounter trigger. Playtest the 3rd repetition before paying more.
3. **If it lands — THE BREAK full engine (L):** profile table, AURA meta-layer, floor-rule alternates, sector scaling, terminal Structure Break, scar persistence, save/reload hardening.
4. **THE LISTENING (descoped):** single slider; AUTO-TUNE = label list (choice survives); decoys play a lying payload; deliver the secret ending as a *ritual* (after Step 0 already made it reachable).
5. **THE CULL (descoped):** build a reusable crew→deck **tag map** first; ship the non-spatial "seal a set" version wired to the existing vent-count-3 path; floor the roster at 2 living crew.
6. **Later, separate slot (never the escape slot):** THE DESCENT (bust scaled to escrow, guaranteed prize at depth) and/or THE VIGIL (turn-based, built on the vent modal). Defer/cut THE LONG DARK (Stealth).
