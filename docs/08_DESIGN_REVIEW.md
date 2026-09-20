# 08 · Design Review & Improvement Roadmap

> A critical design pass (2026-06-22) across four lenses: game mechanics, narrative,
> art direction, and mini-games. The striking result: **every lens independently pointed at
> the same few high-leverage fixes.** Those are the roadmap.

## TL;DR — the convergent verdict
1. **The whole game currently resolves as one dice roll.** Scan, probe, EVA, repair, fabricate
   = press button → `Math.random()` → read result. The *strategic* layer (which planets,
   colony-now-or-push, how you treat the dead) is good; the *moment-to-moment* layer has no
   player hands on it. This is the #1 immersion gap — and it's exactly what mini-games fix.
2. **The story's payoff is unreachable.** The entire 8-log arc builds to "transmit the archive,
   knock on the door." The ending exists in code (`EndingSystem.getSecretEnding()`) but **no
   TRANSMIT choice calls it.** One ~5-line fix turns the log hunt into the spine of the game.
3. **Don't go full Persona 5.** Its loud joy fights your dread. Take its *typographic
   confidence, 2-color discipline, diagonal "cut" motif, and rare-but-violent transitions* and
   reframe them as menace/ritual/wound. Cold, disciplined Japanese-UI (NieR / Ghost in the
   Shell), not pop maximalism.
4. **Evolve the story, don't reframe it.** Your "walk the path of those before you" idea is
   *already the premise* (the 8 ships). The "normalized Everest-of-space" tone is worth
   importing as a *minority voice* to amplify the horror — not as a replacement that defuses it.
5. **Protect what's special:** the A.U.R.A. ethics system, the procedural ending engine, the
   writing, the deck schematic, the planet-art library, and the tone. Most wins are additive.

---

## A · Mechanics critique
**Strengths worth protecting:** the strategic decisions are genuinely good — route/fuel/ration
economy, "colony here or gamble on a better world," crew triage, and especially treating the
dead (A.U.R.A.'s ethics score remembering your behavior into the ending). The 6-sector
escalation is a clean structure. The writing and procedural endings carry huge variety.

**Weaknesses + fixes:**
| # | Problem | Fix |
|---|---------|-----|
| 1 | **Actions are passive RNG.** No skill, no agency in the second-to-second. | Make the key actions interactive (see §D mini-games). Highest single ROI. |
| 2 | **Thin progression.** Only 4 upgrades; salvage mostly disappears into repairs; no "build" fantasy or growth curve. | Expand to a small run-shaping upgrade tree (8–12) with real trade-offs (sensors vs hull vs medical vs cargo). Give salvage a *choice*, not just a repair tax. |
| 3 | **Repetition mid-game.** S2–S3 can feel like "scan another rock." | Lean on the existing sector hazards & campfire beats to vary the *verb*, not just the planet. Each sector should change *how* you play, not only what spawns. |
| 4 | **Probe is a soft timer, not a decision.** | Make probing a risk/reward *dive* (how deep do you push?) — see MG-2. Turns attrition into agency. |
| 5 | **Reward legibility.** RNG loot can feel arbitrary; the player can't form a plan. | Show odds/tiers before committing (scan reveals expected loot tier); let skill nudge the roll. |
| 6 | **Death stakes underexpressed moment-to-moment.** | The strategic stakes are real but quiet; the art-direction "crew-death card" + barks make consequences *felt*. |

**Top 3 mechanical ROI (ranked):** (1) interactive actions via the mini-game framework;
(2) wire the secret ending + a logs-found counter; (3) expand the upgrade tree.

**Do NOT touch:** A.U.R.A. ethics, the ending engine, the encounter writing, the deck UI,
the planet library. Add around them.

---

## B · Narrative direction
**Strong:** a real thesis (the graveyard of the eight before you), a clean 8-log escalation,
tight cross-referencing (Vance *is* the Icarus survivor), A.U.R.A. as a gated character, prose
that punches ("pray that what answers is kind").

**Underused:** the crew barely touches the metaplot (only Vance is wired in); the
biology-rewrite idea (Log 5) is the most original beat and the least dramatized; Mira's "the AI
is lonely" is a loaded gun never fired.

**Unearned / broken:**
- The **secret ending is unreachable** (no TRANSMIT choice) — the cost is that your most
  invested player arrives at the climax and the one button the story told them to press is
  missing. **Fix first.**
- THE STRUCTURE's `ENTER` ending lets you walk through a door the logs spent 8 entries
  establishing as *sealed* — add the key (logs/transmit) as the gate.
- **Canon number bug:** premise says "nine ships / you're the last," but Logs 1/4/8 say "ten,"
  and "five sectors" vs the game's six. In a story built on *mathematical precision*, fix this.

**Reframe vs evolve → EVOLVE.** Your "normalized expedition / Everest of space" idea overlaps
the existing premise but flips the *tone* (sacred dread → routine death culture). Full reframe
would defuse the cosmic horror and force you to throw away your best material (the time loop,
the door). Instead, import the Everest texture as a **minority voice**: early predecessors
sound *confident and professional*; the horror is watching that confidence rot log by log.
- **Direction A — "The Confidence Curve"** (≈90% reuse): tone-edit the logs into an arc from
  proud → broken; add a crew-confidence thread; wire Mira's arc to the ending. Cheapest, best ROI.
- **Direction B — "The Expedition Registry"** (≈70% reuse): deep-space transit *was* normalized
  for a generation; stations become waystations of that old program; you discover the
  normalization was *engineered* (ties to "you'll stop wanting to leave"). Honest synthesis of
  both visions — gives you the Everest feeling without killing the dread.
- **Direction C — Full reframe** (≈40% reuse): not recommended; pays full price to *lose* your
  differentiators.

**Make predecessors matter:** wire TRANSMIT; turn each wreck into a deferred choice you resolve
at *your* version of that situation (the `WRONG_PLACE_SURVIVOR` tag is your proven template);
let logs change world state, not just the codex; route the secret ending's *quality* through
A.U.R.A.'s tier; build a visible "Registry of the Dead" the player completes and faces at the door.

---

## C · Art direction — "Cold Steel / 鋼"
**Keep:** the deck schematic (best-crafted element), the 30-planet CSS art library, the
feedback plumbing (`screenShake`, `flash*`, `deckDamageFlash`). **Generic:** terminal-green +
Orbitron + scanlines is the most over-used indie-sci-fi shorthand; no type hierarchy with
personality; the right panel and the (blue, off-system) narrative modal are weak/inconsistent.

**Recommendation: NOT full Persona 5** — its exuberance fights your dread. Take Persona's
typographic confidence, 2-color discipline, diagonal **"cut"** motif (reframed as *wound/
severance*, not celebration), and theatrical-but-rare transitions, fused with the *disciplined*
Japanese-UI tradition (NieR: Automata, Ghost in the Shell). **Stillness is default; motion is an
event.**

- **Palette:** bone-white-on-void with a single arterial red. `--void #0a0b0d`, `--void-2
  #121417`, `--steel #2a2f36`, `--steel-dim #565d66`, `--bone #f4f1ea`, `--blood #e0233a`,
  `--blood-deep #7a0f1d`, reserved `--aura-cyan #38d6e0`, functional `--warn-amber #f0a500`.
  Red is *never decorative* — only death, danger, irreversible choices, sector cuts, the one
  primary action per screen.
- **Type:** retire Orbitron. Display = a heavy condensed grotesque (Anton / Archivo Black) +
  **Noto Sans JP** for kanji *stamps* (探査 scan · 死 death · 区 sector · 終 end). Body mono →
  JetBrains Mono. Narrative prose → a humanist sans so story feels human and terminal feels machine.
- **Motion:** one signature easing (`cubic-bezier(0.16,1,0.3,1)`); "The Cut" diagonal `clip-path`
  wipe on sector/death; stamp-in with 1-frame overshoot; promote the existing `wrong-place-glitch`
  into a reusable `.glitch` for A.U.R.A./reality-break. Gate all on `prefers-reduced-motion`.
- **Signature moments:** sector transition "The Cut" (giant 区 II slam); crew-death card (red
  slash across a portrait + 死 watermark); scan reveal (cyan sweep "develops" the planet +
  dossier stamps in); A.U.R.A. intrusion (UI glitch-cut, she takes over the interface);
  irreversible-choice flood.
- **5 quick wins (no rewrite):** (1) swap the `:root` palette → recolors ~80% instantly; (2) swap
  fonts; (3) unify the narrative modal into the system palette; (4) add `.cut-transition` +
  `.stamp-in` utilities (~30 lines = the whole "kinetic" feel); (5) calm idle motion + move the
  inline TEST/AUDIO button styles into classes.

---

## D · Mini-games — one diegetic "Instrument Panel"
**Thesis:** don't bolt on arcade toys — put the player's hands on EXODUS-9's instruments. One
reusable contract keeps integration shallow and the math intact:

> `InstrumentPanel.run(config) → { score: 0..1, skipped }` — renders in the existing CRT/modal
> frame; `score` maps to existing rewards/risks; **skipping returns today's pure-RNG outcome**
> (so auto-resolve is free and accessibility is built-in).

| ID | Mini-game | Augments | Interaction | Scope |
|----|-----------|----------|-------------|-------|
| MG-1 | **Signal Tuning** | Deep Scan | drag FREQ/GAIN to lock a drifting waveform (decoys in S3) | **S** |
| MG-7 | **Log Decryption** | Investigate wreck | substitution-cipher / fill-the-blanks on real log text | S–M |
| MG-2 | **Probe Descent** | Launch Probe | steer the probe down a hazard corridor; choose how deep to push | **M** |
| MG-4 | **Repair Splice** | Repair Deck | pipe/wire routing under a timer | S–M |
| MG-5 | **Fab Calibration** | Fabricate | stop-the-bar precision sequence | **S** |
| MG-3 | **EVA Route** | Deploy EVA | plan a node-to-node path under an O2 budget (predatory baits) | M |
| MG-6 | **Warp Alignment** | Sector Jump | hold a drifting reticle / trace a constellation | S |
| MG-8 | **A.U.R.A. Override** | AI confrontations | Simon-says / firewall maze that *reacts to her ethics tier* | M |

**Build order:** MG-1 → MG-7 → **THE LISTENING** (signature) → MG-2 → MG-4/5 → MG-6 → MG-8.
Ship the contract + skip/auto plumbing first; everything else is a `mode`.

**Signature hook — "THE LISTENING":** once per sector (and at THE STRUCTURE) you *tune into the
sector itself* — layered carrier waves surfacing a dead colony's last broadcast, a sister-ship's
distress loop, the STRUCTURE's rising song, and at low ethics A.U.R.A. whispering on a frequency
she thinks you can't hear. It crystallizes the tone, reuses MG-1's primitive, and is the natural,
emotional delivery vehicle for the 8 logs and the secret ending — "THE ANSWER" should be
something you *tune into* at the door, not a button.

**Avoid:** MG-2 becoming a shmup; MG-6 becoming a tax (it's played every jump — keep it short);
bespoke art for 30 planet types (data-drive parameters, not assets).

---

## Prioritized roadmap (what to do, in order)
1. **Wire the secret ending** (+ a logs-found HUD counter, + reconcile the ship-count/sector
   canon bugs). Tiny effort, closes the story. *(See [07_STATUS_AND_GAPS.md](07_STATUS_AND_GAPS.md).)*
2. **Build the `InstrumentPanel` framework + MG-1 (Signal Tuning)** with skip/auto. Proves the
   pattern; immediately de-passivates the most common action.
3. **Art quick-wins #1–#3** (palette + fonts + unified modal). Biggest look delta for least work.
4. **MG-7 + THE LISTENING** — turns log-hunting into the spine and delivers the secret ending as a ritual.
5. **MG-2 Probe Descent** — the memorable action.
6. **Narrative Direction A or B** tone pass; wire Mira's arc; predecessors-as-deferred-choices.
7. **Expand the upgrade tree**; add the remaining mini-games as `modes`.

> Note: a dedicated mechanics-critic agent was attempted but the model API was overloaded at
> review time; the §A critique was synthesized by the lead from the docs and the other three
> reviews. Re-run it later for a second mechanical opinion if desired.
