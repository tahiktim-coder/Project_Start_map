## RUN SILENT — Definitive Design Review

### How this review was conducted

Five expert lenses independently reviewed the single self-contained prototype (`prototypes/run-silent.html`): a **balance/systems** designer, a **game-feel/juice** designer, a **visuals/UX/readability** designer, a **concept/immersion/replayability** director, and an **onboarding/accessibility** analyst. Rather than reacting to vibes, the review reads the actual code and the actual numbers — noise weights, the fixed 13s sine sweep, the 84/20 threshold pair, distance and O2 rates, the detection economy, and decoy values — and then *simulates optimal and lazy play* to see what the game really rewards. The findings converged hard.

**The headline verdict:** the *concept* is genuinely good and on-genre. The *execution* has a hollow decision core. Three independently-confirmed simulations prove it:

- **Decoy-spam wins in 19.4s with 0 strikes using only 2 of 3 decoys** — spam the loudest button, ignore everything else.
- **Doing literally nothing (all systems on the whole time) escapes in 26.6s with only 2 strikes** — one strike short of losing. Passivity is barely punished.
- **"Perfect" play and "sensors-off-the-entire-run" play escape at the *identical* 24.6s** — the headline sensors tradeoff is mechanically inert.

The whole encounter is over in under two 13s sweep cycles, so no resource (detection, O2, decoys) ever gets a chance to matter. Fixing this is mostly *tuning plus a few small mechanics*, not a rewrite. The presentation layer is largely ready; the underlying model needs teeth.

---

### 1. Strengths to protect (do not break these)

1. **The core loop is correct and distinctive.** "Submarine silent-running, but you're a captain at a power board" with a telegraphed sweep that *inverts* optimal play (loud between, silent during) is a real risk/reward spine. Keep it.
2. **Sensors-off = literally go blind** is the single best idea in the file. The radar blacking out to "SENSORS OFFLINE / listening blind" is the moment that feels like the genre. The mechanic is currently inert but the *concept and its presentation* must survive the fix.
3. **The suffocation feedback stack is best-in-class game feel** — progressive blur + brightness drop + heartbeat scaling with O2 deficit + pulsing banner + reddening vignette. This is the quality bar; extend it to the sweep/detection systems.
4. **Forgiving detection model (fill/decay, 3 strikes, not instant death)** is the right structure for a rare set-piece. It just needs the strikes to carry weight.
5. **Lore is wired into mechanics, not bolted on.** Decoy = throwing cargo, the "joins the others now" death line, the convoy-graveyard intro. The fiction explains the rules and the rules pay back the fiction.
6. **Restrained three-color discipline and the calm→panel cut-wipe transition** are cinematic and readable in spirit.

---

### 2. Ranked issues (deduped, most game-defining first)

#### CRITICAL
**1. Decoy-spam is a dominant, brain-off win condition.** 5s immunity covers a full near-window; a run is only ~1.9 sweep cycles. Sim: escapes in 19.4s, 0 strikes. **Fix:** immunity 5s→2.5s; distance bonus +8→0; +30 signature spike for ~0.4s on launch (mistimed throw gets you heard); only effective *during* near; optionally decay per use (2.5/1.5/0.8s — "it's learning the trick"). Keep x3.

**2. The threshold snaps 84→20 in one frame — the key number is invisible until the cliff.** It's a reflex test, the opposite of the goal. **Fix:** make threshold continuous: `threshold = 84 − 64 * clamp((prox−0.40)/0.45, 0, 1)` so the red line *glides* down over ~4s. Now the player watches the noose tighten and plans.

**3. Fully deterministic — identical every run. The #1 reason it gets tiring.** One solved line after 2–3 plays. **Fix:** roll per-encounter params at `start()`: sweep period [10,16]s, near-threshold [16,28], detection rate [22,30]/s. Surface 1–2 diegetically ("it's moving fast today").

#### HIGH
**4. SENSORS-off has zero upside — a dead mechanic** (sim: identical 24.6s with or without). **Fix:** sensors noise 16→22, far threshold ~80, sensors-ON cuts detection-fill ~30%. Now off is a gambler's economy play.
**5. Cutting LIFE SUPPORT is never worth it; O2 too forgiving** — the suffocation horror barely triggers. **Fix:** near-threshold base 14 + life noise 16 (keeping life on during a sweep = your whole quiet budget); O2 drain 13→20/s, suffocate window 4s→2.5s.
**6. The encounter is a 2-beat metronome — no arc, no climax.** Perfect escape ≈24.6s, ~2 inputs. **Fix:** lengthen to 4–6 sweeps (~60–75s); escalate near-threshold per sweep (20→17→14→11→9); shorten period as distance passes 60%; slow detection decay 32→14/s so sloppiness carries.
**7. Color overloaded** (amber and red each mean 3+ things) — the exact clutter that killed past versions. **Fix:** one job per hue — green=progress/safety, amber=caution/active-noise, red=THREAT meters only.
**8. The O2 blur blurs the very readouts you need to recover** (O2 gauge + LIFE tile). **Fix:** apply the filter only to a background layer; keep `#board` + gauges sharp; cap blur ~1px.
**9. No first-sweep scaffolding** — dense dim briefing then a sweep can bite within ~3s. **Fix:** `S.t = 13*0.25` start (first sweep ~6.5s in); non-lethal first cycle + one-line coach; split briefing into a line + a 2×2 controls grid.
**10. No reduced-motion path; ~8Hz flicker sits in the photosensitive-seizure band.** A safety gap. **Fix:** `@media (prefers-reduced-motion: reduce)` disabling shake/flick/flash + cap blur; replace 8Hz strobe with 1–2Hz dim; cap flash opacity ~0.25; comfort + mute toggles.

#### MEDIUM
11. Detection has no ramp while filling — scariest state looks safe until the lunge. **Fix:** sub-bass drone rising with det, red edge-pulse at det/100, micro-shake past det>60.
12. Post-strike detection resets to 45 not 0 — invisible double-tap. **Fix:** reset to 0 + 1.5s grace + "RE-ACQUIRING" flash.
13. "Sound retreat" is a mislabeled always-available forfeit next to the core verb. **Fix:** demote, rename "ABANDON RUN", confirm; promote Decoy to primary with x3 pips.
14. The ~10s far phase is dead air. **Fix:** hull groans, hydrophone hiss scaled to your own noise, an optional risk verb ("vent heat").
15. The radar blip's angle is meaningless decoration on the biggest element. **Fix:** make the radar the primary sweep readout, or shrink it.
16. No live strikes indicator. **Fix:** three pips by the title that go dark per detection.
17. Signature gauge ambiguous. **Fix:** color by margin to the live line + numeric headroom ("79 / 84 — 5 UNDER").

#### LOW
18. Four named voices undercut isolation. **Fix:** consolidate to A.U.R.A. only.
19. Per-tile "+45 noise" has no visible link to the line. **Fix:** when over the line, tint the tile whose toggle clears the gap.

---

### 3. What's missing
- A **variance/seed system** (per-encounter rolled params) — biggest missing piece for repeatability.
- **2–4 anomaly archetypes** (STALKER / FRENZY / LURKER) so recurring encounters differ and the "it keeps finding ships" metaplot has mechanical truth.
- An **intra-encounter escalation curve** (a climax, not a flat fill).
- A reason to **ration cargo** within a run (a brutal final sweep that needs a held decoy).
- A **relief/release beat** when you survive a sweep.
- **Far-phase ambience** so dread accumulates instead of resetting.
- A **quiet open + aftermath exhale**.
- **Live strikes HUD** + explicit headroom number.
- **Downstream persistence** — outcomes (hull damage, lost cargo, dead crew) currently vanish; nothing records the run into the metaplot or feeds the parent game.
- **Keyboard bindings + pause**.

---

### 4. Roadmap to a 9/10
1. **Make the decision real FIRST** — continuous threshold, kill decoy-spam, give sensors & life-support genuine tradeoffs. Re-run the sims: all-on passive must lose, decoy-spam must not trivially win, sensors-off vs perfect must diverge.
2. **Build the arc** — 4–6 sweeps + escalation so detection/O2 bite and there's a climax.
3. **Add variance** — rolled params + anomaly archetypes (solved puzzle → read-the-conditions).
4. **Fix readability & threat HUD** — one-job-per-hue, strikes pips, headroom number, exempt readouts from the blur, fix the radar.
5. **Land the feel** — extend the suffocation-quality feedback to detection, add the relief beat, far-phase ambience, quiet open, aftermath exhale; fix the double-tap.
6. **Onboarding, safety, polish** — non-lethal first sweep, prefers-reduced-motion + mute + safer flicker, demote ABANDON, one voice, keyboard, pause, downstream hooks.

> Do step 1 before anything else — until the decisions are real, juicing and varying a hollow loop just makes a prettier metronome.
