# 05 · Game Systems

Files: `src/systems/*.js`. Each is loaded as a global before `bundle.js`.

## Probe System (`ProbeSystem.js`)
- No persistent probe object; integrity is an integer passed into
  `performProbe(planet, integrity)`. Destroyed at ≤0 (rebuildable for 50 Salvage if
  Engineering is intact). ~8 launches of life.
- **Damage/launch:** base 10–19, +`(gravity−1)*8` over 1.2G, +10 if dangerLevel>1, +15 on
  GAS_GIANT/VOLCANIC, +10 if CORROSIVE. `nano_hull` upgrade halves all of it.
- **Loot:** merges all matching `LOOT_RULES` pools → weighted pick (see [03_WORLD.md](03_WORLD.md)).
  Per-type "thematic" flavor messages for 20 planet types.

## Ending System — the "Fate Matrix" (`EndingSystem.js`)
The richest system: ~865 lines assembling a 1–3-act story per colony, producing **60+ named
outcomes**. `generateOutcome(planet, state)` → `{ success, title, text }`.

1. **Viability tier** — EXCELLENT (95%) / GOOD (80%) / MARGINAL (60%) / POOR (30%) /
   IMPOSSIBLE (0%), from planet type, temp, gravity, atmosphere, and key crew/upgrades.
2. **Modifiers** — early sectors punish POOR worlds; Sector 4+ adds +10%; Colony Knowledge
   adds up to +25%.
3. **Prelude checks** — extreme cold/heat/gravity without the right specialist/upgrade =
   instant failure endings (THE DEEP FREEZE, THE FURNACE, CRUSHED); PREDATORY worlds branch
   on crew (THE WARY SURVIVORS / APEX INTEGRATION / THE BEAUTIFUL TRAP).
4. **Act 1 (Arrival)** — a big per-planet-type switch, each with 1–4 crew/upgrade sub-branches
   → titles like THE SECOND EARTH, THE IRON DYNASTY, EDEN FOUND, THE RESONANCE, THE BARREN END…
5. **Act 2 (Society)** — overlay based on who survived (HIVE_MIND/MACHINE_LINK/Wrong-Place
   survivors, specialists) → THE DIVERGENCE, SILICON IMMORTALITY, THE LAST COMMAND…
6. **Act 3 (Legacy)** — final fate gated by A.U.R.A. tier (ADVERSARIAL can vent the colony =
   DIGITAL MUTINY failure), Colony Knowledge, salvage, crew → STELLAR ASCENDANCY, INDUSTRIAL
   EMPIRE, MOTHER OF WORLDS, THE QUIET REMNANT…
7. **Epilogue** — `generateEpilogue` computes a 50-year population (tier multiplier × crew,
   MEDIC/ENGINEER bonuses) and names a memorial per surviving crew member.
8. **Secret ending** — `getSecretEnding()` fires "THE ANSWER" when all 8 Exodus logs are
   collected (the time-loop reveal). *(Wiring gap — see gaps doc.)*

## Bark System (`BarkSystem.js`) {#bark}
Crew chatter pushed into the mission log (150 ms after the action). Singleton. 1-action
cooldown (crew death bypasses it); never the same speaker twice. Lines are chosen by
**personality × stress tier (0–3)** — higher stress = darker lines. ~16 triggers
(ENTER_ORBIT, AFTER_SCAN, LOW_ENERGY, BEFORE_EVA, CREW_DEATH, sector entries, FIRST_VITAL…).

## A.U.R.A. System (`AuraSystem.js`) {#aura}
The ship AI as an evolving antagonist/ally driven by `ethicsScore` (−8…+8):

| Tier | Score | Behaviour |
|------|-------|-----------|
| COOPERATIVE | ≥2 | warm, helpful, emotionally invested |
| NEUTRAL | −1..+1 | dry, statistical |
| SUSPICIOUS | −4..−2 | passive-aggressive, doubting; can issue premonitions |
| ADVERSARIAL | ≤−5 | hostile; **actively sabotages** |

- **Commentary:** one line per trigger (`AURA_COMMENTARY[trigger][tier]`), 350 ms delay.
- **Adversarial actions:** after warnings escalate, 30%/action chance to LOCK a deck,
  FALSIFY the next scan, or VENT atmosphere (→ player modal; third vent accepted =
  AURA_MUTINY game over).
- **Premonitions (Suspicious/Adversarial):** danger-ahead, resource drain, crew nightmare,
  fake signal, "we are expected."
- **Countermeasures:** Bridge reset (ethics→0, unlock decks), Tech Fragment (+3 ethics),
  Jaxon override (20 salvage).

## Narrative Modal (`NarrativeModal.js`)
Full-screen Disco-Elysium-style overlay: portrait + name (per-character accent color),
**typewriter text (12 ms/char with punctuation pauses)**, click-to-skip, then choices fade
in. Supports inline `[highlight]`, `[warning]`, `[whisper]` markup and multi-part dialogue
sequences. Portraits load from `assets/crew/*.png` with glyph fallbacks (A.U.R.A. is
glyph-only).

## Audio System (`AudioSystem.js`)
Web Audio API synth SFX + two MP3 tracks (`Music/Space_Project_Background.mp3`, and
`Music/Heaven.mp3` crossfaded in for THE STRUCTURE). On by default; resumes on first input.
~25 SFX wired to game CustomEvents (scan, probe, warp, warnings, A.U.R.A. chirps, victory,
defeat, crew death…). A couple of presets (`sfxHorror`, `sfxTeleport`) are defined but unwired.
