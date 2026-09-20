# Silent Exodus - Build Order

**Reference:** `docs/game_design_master.md`
**Principle:** Each phase produces a playable game better than the last. No phase depends on a future phase.

---

## Phase 1: Fix the Foundation

**Goal:** Make the game have real stakes. Every action should cost something meaningful. The player should be able to lose.

### 1.1 Resource Model Overhaul
**Files:** `bundle.js` (GameState), `index.html` (header), all systems that reference resources

- [ ] Replace `fuel`, `oxygen`, `energy`, `metals` with three resources: `energy` (100), `salvage` (50, cap 300), `rations` (20, cap 30)
- [ ] Update `index.html` header: Remove FUEL and O2 bars. Show ENERGY, SALVAGE, RATIONS, CREW. Remove PROBE from header (move to command deck only).
- [ ] Update `updateHud()` in App class to display new resources
- [ ] Update all `consumeEnergy()` calls — they stay the same mechanically
- [ ] Rename all "metals" references to "salvage" in display text (variable names can stay for now)
- [ ] Add `consumeRation()` method to GameState: called on warp, EVA, sector jump. -1 ration per call.
- [ ] Add ration depletion consequences: at 5 rations, A.U.R.A. warning log. At 2, +1 stress all crew. At 0, 1 crew dies per action.
- [ ] Add `fungusActionCounter` to GameState (tracks actions since last fungus ration). If cargo contains Fungus Culture, every 3rd major action adds +1 ration (up to cap). Reset counter on ration grant.
- [ ] Update Fabricator/Upgrades: costs display as "SALVAGE" instead of "METALS"
- [ ] Update ProbeSystem output text: "Extracted 15 Salvage" instead of "Extracted 15 Metals"

### 1.2 Crew System Rework
**Files:** `bundle.js` (CrewGenerator, GameState, App)

- [ ] Replace random crew generation with fixed named characters:
  - Commander: random name from existing name pools, tag LEADER
  - Jaxon: Engineer, tag ENGINEER
  - Dr. Aris: Medic, tag MEDIC
  - Vance: Security, tag SECURITY
  - Mira: Specialist, tag SPECIALIST
- [ ] Add `stress` property to each crew member (starts at 0, max 3)
- [ ] Keep existing physical status track (HEALTHY/INJURED/DEAD/SYMBIOTE/CYBORG_HUSK)
- [ ] Add stress gain triggers:
  - Dangerous planet visit (dangerLevel 2+): +1 random crew
  - Crew death: +1 all surviving
  - Low rations (<=5): +1 all
  - Failed EVA with injury: +1 to EVA crew
- [ ] Add stress display to Crew Manifest modal (show stress pips next to status)
- [ ] Stress 2 negative traits: implement as flags that affect gameplay
  - Jaxon HOARDER: -10 salvage per sector (hidden drain)
  - Vance PARANOID: 20% chance warp is delayed 1 action
  - Aris BLEEDING_HEART: blocks stripping occupied cryopods
  - Mira RECKLESS: random +1 stress events

### 1.3 Ship Schematic Activation
**Files:** `index.html` (left panel), `bundle.js` (App), `style.css`

- [ ] Add `shipDecks` object to GameState:
  ```
  shipDecks: {
    bridge: { status: 'OPERATIONAL', repairCost: 60 },
    lab: { status: 'OPERATIONAL', repairCost: 40 },
    quarters: { status: 'OPERATIONAL', repairCost: 50 },
    cargo: { status: 'OPERATIONAL', repairCost: 30 },
    engineering: { status: 'OPERATIONAL', repairCost: 80 }
  }
  ```
- [ ] Make each deck div clickable — opens detail panel showing status and repair button
- [ ] Add CSS states: `.deck-damaged` (red border, flicker animation, warning icon)
- [ ] Implement damage effects:
  - Bridge DAMAGED: warp cost multiplier 1.5, remote scan disabled
  - Lab DAMAGED: deep scan shows partial results, items unidentified
  - Quarters DAMAGED: no passive stress recovery, no passive injury healing. Subtitle shows "REST / MORGUE".
  - Cargo DAMAGED: cargo cap halved to 10. Fungus Culture stops producing if present.
  - Engineering DAMAGED: probe fab disabled, sector jump cost x2, repair costs +50%
- [ ] Add repair action: click damaged deck -> "REPAIR (X SALVAGE)" button -> deck restored
- [ ] Jaxon alive: repair costs -30%

### 1.4 Lose Conditions
**Files:** `bundle.js` (App)

- [ ] Starvation: Check rations after each consumption. At 0, kill 1 random crew per action. If all dead, game over screen.
- [ ] Total crew loss: If all 5 crew DEAD, game over screen.
- [ ] Commander breakdown: If commander stress reaches 3, special ending (A.U.R.A. takes command).
- [ ] Hull breach: If 3+ decks damaged AND salvage < cheapest repair cost, game over.
- [ ] Create game over overlay (similar to colony ending overlay but red-themed, "MISSION FAILED" header).

### 1.5 Passive Crew Recovery
**Files:** `bundle.js` (App - handleWarp, handleSectorJump)

- [ ] INJURED crew recover to HEALTHY after 3 actions IF quarters OPERATIONAL (add action counter to crew object)
- [ ] Stress decreases by 1 for all crew on sector jump IF quarters OPERATIONAL
- [ ] These are the ONLY passive recovery methods. Everything else requires items or events.

**Phase 1 Deliverable:** A game where the player can starve, lose crew to stress breakdowns, see their ship fall apart, and face real consequences for every action. The journey has stakes.

---

## Phase 2: The Journey

**Goal:** Make each sector feel different. Give the player a reason to push forward and a story to discover.

### 2.1 Sector Configuration System
**Files:** New file `src/data/SectorConfig.js`, `bundle.js` (GameState, App, PlanetGenerator calls)

- [ ] Create `SECTOR_CONFIG` data object with per-sector rules:
  - Allowed planet types
  - Planet count range
  - Derelict ship chance
  - Energy/stress/ration modifiers
  - Special rules (MICROMETEORITE, ISOLATION, INTERFERENCE, FALSE_PARADISE, REALITY_BREAKDOWN)
  - Flavor text
- [ ] Modify `PlanetGenerator.generateSector(level)` to accept sector config and filter planet types
- [ ] Modify `handleSectorJump()` to apply sector modifiers
- [ ] Add sector name/title display to header or nav view ("/// SECTOR 2: THE DARK VOID")
- [ ] Implement sector special rules:
  - S1 MICROMETEORITE: 20% chance per warp to damage 1 random deck
  - S2 ISOLATION: +1 to all stress gains
  - S3 INTERFERENCE: 20% chance remote scan gives false data
  - S4 FALSE_PARADISE: 50% of VITAL planets get hidden PREDATORY tag
  - S5 REALITY_BREAKDOWN: 20% chance per warp of random effect (positive or negative)

### 2.2 Campfire Events (Sector Transitions)
**Files:** New file `src/data/CampfireEvents.js`, `bundle.js` (App - handleSectorJump)

- [ ] Create campfire event pool (15-20 events)
- [ ] Each event: context text, 2-3 choices, each with mechanical effects (stress, resources, crew relationships)
- [ ] Trigger: after sector jump, before new sector generates, show campfire modal
- [ ] Player must choose before proceeding
- [ ] Some events are sector-gated (only appear in specific sectors)
- [ ] Some events are state-gated (only appear if certain conditions met — low rations, injured crew, etc.)

### 2.3 Derelict Ship Encounters
**Files:** `NavView.js`, new component `DerelictView.js` or extend OrbitView, `PlanetGenerator.js`

- [ ] Add derelict node generation to sector generation (using SECTOR_CONFIG derelict chance)
- [ ] Derelict data object: { id, name (e.g. "EXODUS-3 WRECKAGE"), damageLevel, salvageValue, hasLogs, hasCryoPods }
- [ ] Render derelict nodes on NavView with distinct icon (amber, angular shape, not round like planets)
- [ ] Click derelict -> tactical panel shows wreck info
- [ ] Warp to derelict (lower cost: 5-10 energy, 1 ration)
- [ ] Derelict interaction view with actions: HULL SCAN, SALVAGE EXTERIOR, BREACH INTERIOR, DOWNLOAD LOGS, DEPART
- [ ] Each action has risk/reward similar to EVA events

### 2.4 Failed Colony Encounters
**Files:** `PlanetGenerator.js`, `OrbitView.js`, `bundle.js` (App)

- [ ] Add FAILED_COLONY tag to planet generation (sector-gated: 0% S1-2, 20% S3, 40% S4)
- [ ] When orbiting a FAILED_COLONY planet after deep scan: show extra button "INVESTIGATE COLONY SITE"
- [ ] Colony investigation: narrative encounter with choices (read logs, salvage settlement, check cryopods, assess failure)
- [ ] Each choice yields lore, salvage, moral weight, and/or gameplay-relevant intel

### 2.5 Exodus Backstory Fragments
**Files:** New data in `Items.js` or new `ExodusLore.js`

- [ ] 8 Exodus log items (one per previous Exodus ship)
- [ ] Each log is a cargo item (1 unit) that can be read from inventory
- [ ] Logs are distributed across sectors: S1 has Exodus 1-3, S2 has 4, S3 has 5, S4 has 6-7, S5 has 8
- [ ] Found via derelict encounters, failed colony investigations, and rare loot
- [ ] Finding all 8 unlocks the secret ending option: "TRANSMIT EXODUS ARCHIVE"

### 2.6 Colonization Warnings (Sector 1)
**Files:** `bundle.js` (handleColonyAction), `OrbitView.js`

- [ ] In Sector 1: add crew barks when entering orbit:
  - Jaxon: "You're not seriously thinking of landing here permanently?"
  - Aris: "There's nothing here for us. We need to keep looking."
  - A.U.R.A.: "Colony viability assessment: 3%."
- [ ] Add confirmation dialog on ESTABLISH COLONY in S1-2: "A.U.R.A. ADVISORY: Colony survival probability critically low. Proceed?"
- [ ] Ensure EndingSystem produces failure outcomes for S1 planet types

**Phase 2 Deliverable:** A game with a 5-sector journey where each sector feels different, the player discovers the Exodus backstory, and the world pushes back with escalating strangeness.

---

## Phase 3: The Characters

**Goal:** Make the player care about the people on their ship. Every crew member should feel like a person with opinions.

### 3.1 Crew Barks System
**Files:** New file `src/systems/BarkSystem.js`, `bundle.js` (App — hook into existing event handlers)

- [ ] Create a BarkSystem that listens for game events and injects character dialogue into the mission log
- [ ] Barks are per-character, per-situation, stress-aware
- [ ] Trigger points:
  - Entering orbit (comment on planet type)
  - After scan (react to findings)
  - Low resources (stress-dependent reactions)
  - Before EVA (express concern or eagerness)
  - Crew injury/death (emotional reactions)
  - Sector jump (anticipation or dread)
- [ ] Each character has 3-5 barks per trigger, randomly selected
- [ ] Stress modifies bark tone: Stress 0 = professional, Stress 2 = desperate/angry/withdrawn
- [ ] Barks appear in mission log with character name prefix in their role color

### 3.2 A.U.R.A. Commentary System
**Files:** New file `src/systems/AuraSystem.js` or integrate into BarkSystem

- [ ] A.U.R.A. comments on actions in mission log
- [ ] Ethics score tracking (starts 0)
- [ ] Ethics shift events (see game_design_master.md Section 4)
- [ ] Commentary tier changes:
  - Cooperative: helpful, accurate
  - Neutral: clinical, slightly dark humor
  - Suspicious: passive-aggressive, logs incidents
  - Adversarial: misleading, threatening
- [ ] A.U.R.A. adversarial actions (lock deck, refuse command) with player intervention options

### 3.3 Stress Breakdown Events
**Files:** `bundle.js` (App), new event data

- [ ] When any crew member hits Stress 3, fire their specific breakdown event:
  - Jaxon: Sabotage modal — he disables a random deck. Player must repair.
  - Aris: Catatonic notification — passive healing stops. She stares at the wall in Crew Quarters.
  - Vance: Mutiny modal — he confronts Commander directly. Crew picks sides. If Vance wins, he takes 1 unilateral action (jettison cargo, override navigation, or lock a deck).
  - Mira: Obsession — her next EVA costs double rations and double energy (she demands extended surface time). She brings back extra loot but at serious resource cost.
  - Commander: Game over / A.U.R.A. takeover ending.
- [ ] After breakdown, crew member stress resets to 2 (they don't stay at 3 forever, but the damage is done)

### 3.4 Scavenger Text Flavor
**Files:** `ProbeSystem.js`, `LootTables.js`, `Events.js`

- [ ] Add WRECKAGE tag to PlanetGenerator (sector-biased)
- [ ] Create SALVAGE_WRECKAGE loot pool with scavenger-flavored text:
  - "Stripped hull plating from Exodus-4 wreckage. +20 Salvage."
  - "Found intact fuel cell in debris. +15 Energy."
  - "Recovered sealed ration container. +3 Rations."
- [ ] Add WRECKAGE-triggered events to Events.js:
  - "THE SLEEPERS": Cryopod with living occupants. Strip or rescue.
  - "THE BLACK BOX": Ship recorder. Download (lore) or strip for parts (salvage).
- [ ] Modify existing probe result text for WRECKAGE planets to use salvage language instead of mining language

**Phase 3 Deliverable:** A game where the crew feels alive. Jaxon complains. Aris worries. Vance calculates. Mira wonders. A.U.R.A. watches. The player's choices shape these relationships.

---

## Phase 4: The Horror

**Goal:** Make the player afraid. The game should get under their skin in Sectors 3-5.

### 4.1 Paranoia System (Stress-Gated UI Disturbances)
**Files:** New file `src/systems/ParanoiaSystem.js`, hooks into rendering pipeline

- [ ] Calculate average crew stress after each state change
- [ ] Tier 0 (avg < 1): No effects
- [ ] Tier 1 (avg 1-1.5): Phantom log entries ("Incoming transmission..." then nothing). Scanner blip on nav map (2s, then vanishes).
- [ ] Tier 2 (avg 1.5-2.5): Crew portrait flickers to skull (1 frame). Stat readout spikes ("ENERGY: 3%... 67%"). Phantom contact on sector map.
- [ ] Tier 3 (avg 2.5+, Sector 4-5 only): Button label flickers (WARP->FLEE, SCAN->SCREAM). Never during critical actions. A.U.R.A. text glitches.
- [ ] All effects are CSS/JS overlays on existing UI — not structural changes to the components

### 4.2 A.U.R.A. Corruption Arc
**Files:** `AuraSystem.js`, `bundle.js` (App)

- [ ] Visual changes to A.U.R.A.-related UI as ethics drops:
  - Tier 3 (Suspicious): Mission log entries from A.U.R.A. get a slight red tint
  - Tier 4 (Adversarial): A.U.R.A. text glitches with static characters, bridge deck flickers
- [ ] Implement adversarial actions:
  - Lock random deck (player gets 2-action warning, can repair Bridge to prevent)
  - Provide false scan data (planet stats wrong — revealed when you arrive)
  - Final escalation: atmosphere vent (1 crew dies) — only if player ignores ALL warnings
- [ ] Player countermeasures:
  - Repair Bridge: resets A.U.R.A. to Neutral (ethics -> 0)
  - Use Tech Fragment: permanent +3 ethics (reprogram)
  - Jaxon override: Engineer can force-reset A.U.R.A. once (costs 20 salvage)

### 4.3 Sector-Specific Horror
**Files:** Various — sector config, NavView, OrbitView, AudioSystem

- [ ] Sector 3: The Signal. Background audio adds rhythmic tapping. Grows louder.
- [ ] Sector 3: Ghost planets. Nav map shows planet blip that's empty when you arrive. Scanner lies.
- [ ] Sector 4: False paradise. VITAL planets that look perfect but have PREDATORY hidden tag.
- [ ] Sector 4: Crew resists leaving paradise planets. +1 stress if you break orbit from VITAL.
- [ ] Sector 5: Reality breakdown. Time displays glitch. Action results may be reversed. Warp has random side effects.
- [ ] Sector 5: Audio reversed, pitch-shifted. Hull groans intensify.

### 4.4 Audio Atmosphere Expansion
**Files:** `AudioSystem.js`

- [ ] Add ambient layer: hull groans (random interval), airflow hiss (quiet continuous), computer whirs
- [ ] Add stress-reactive audio: heartbeat throb at high stress, static bursts during UI disturbances
- [ ] Add sector-specific audio signatures (see game_design_master.md Section 14)
- [ ] A.U.R.A. voice cues: ascending tone (good), descending (warning), discordant (adversarial)

**Phase 4 Deliverable:** A game that makes the player uncomfortable. The ship feels alive and hostile. The UI can't be trusted. A.U.R.A. might be lying. The deeper you go, the stranger it gets.

---

## Phase 5: Polish & Completion

**Goal:** Tie everything together. Balance the systems. Expand endings. Make it whole.

### 5.1 Ending System Expansion
**Files:** `EndingSystem.js`

- [ ] Add stress-influenced colony outcomes (high stress crew = paranoid society, unstable governance)
- [ ] Add A.U.R.A. ethics-influenced outcomes (cooperative = utopia, adversarial = AI tyranny)
- [ ] Add ration-state outcomes (arrived with plenty = prosperous, arrived starving = desperate)
- [ ] Add discovered-lore outcomes (more Exodus logs = better-informed colony)
- [ ] Implement secret ending: all 8 Exodus logs -> "TRANSMIT EXODUS ARCHIVE" option
- [ ] Implement A.U.R.A. takeover ending (Commander Stress 3)
- [ ] Expand failure endings for each planet type + sector combination
- [ ] Target: 30+ meaningfully distinct ending variations

### 5.2 Balance Pass
- [ ] Playtest full 5-sector run. Target: 35-50 total actions per game.
- [ ] Tune ration economy: player should feel pressure by Sector 3, crisis by Sector 5
- [ ] Tune energy economy: player should never have "nothing to spend energy on"
- [ ] Tune stress accumulation: Sector 1 = ~0 stress, Sector 3 = ~1 avg, Sector 5 = ~2 avg for moderate play
- [ ] Tune salvage economy: enough to buy 2-3 upgrades per run if efficient, or 1 if careless
- [ ] Tune probe durability: ~4-6 launches per probe (currently ~5-8, may need tightening)
- [ ] Ensure each sector has at least one critical decision the player must make

### 5.3 Cargo Unit System
**Files:** `bundle.js` (App - cargo management), `Items.js`

- [ ] Assign unit sizes to all items (1 unit standard, 2 units for revival items)
- [ ] Add ration items to loot pools (Food Pack, 1 unit, converts to +1 ration on use)
- [ ] Add luxury items to loot pools (Chocolate, Music Holotape — stress reduction items)
- [ ] Add Fungus Culture item (2 units, found on VITAL/BIO_MASS planets or derelicts). Passive: +1 ration every 3 major actions while in cargo. Track action counter in GameState. Stops producing if Cargo Hold is DAMAGED.
- [ ] Enforce 20-unit cap. Show jettison UI when over cap.
- [ ] Display cargo units in Cargo Hold modal: "CAPACITY: 12/20 UNITS"

### 5.4 Visual Polish
- [ ] Ship schematic damage states (CSS animations for damaged decks)
- [ ] Sector transition animation (warp visual between sectors)
- [ ] Derelict ship icons on nav map (distinct from planet spheres)
- [ ] Failed colony visual indicator on planet nodes
- [ ] A.U.R.A. ethics visual indicator somewhere subtle (maybe bridge deck color shifts)

### 5.5 Final Audio Pass
- [ ] Ensure all new systems have audio feedback
- [ ] Colony ending has appropriate music (success = major chord, failure = minor, A.U.R.A. takeover = discordant)
- [ ] Sector transition audio (warp rumble + sector-specific intro tone)
- [ ] Campfire events: quieter, more intimate audio (crackling? low hum?)

**Phase 5 Deliverable:** A complete, balanced, atmospheric game with 30+ endings, meaningful choices, and an experience that stays with the player.

---

## Technical Notes

### File Structure Evolution
The current `bundle.js` monolith will grow. Consider splitting when it exceeds ~1500 lines. Options:
1. **Stay bundled:** Keep everything in bundle.js + separate data/system files (current approach). Works for `file://` protocol.
2. **Local dev server:** Use `npx serve` or `python -m http.server` to enable ES modules. Better architecture but requires terminal.
3. **Simple build script:** A Node.js script that concatenates files into bundle.js. Best of both worlds.

Recommendation: Stay bundled through Phase 2. If the file becomes unmanageable, add a simple build script in Phase 3.

### New Files to Create (Across All Phases)
- `src/data/SectorConfig.js` — Sector rule definitions
- `src/data/CampfireEvents.js` — Inter-sector narrative events
- `src/data/ExodusLore.js` — 8 Exodus ship log entries
- `src/systems/BarkSystem.js` — Character dialogue injection
- `src/systems/AuraSystem.js` — A.U.R.A. ethics + commentary
- `src/systems/ParanoiaSystem.js` — UI disturbance layer
- `src/systems/StressSystem.js` — Stress accumulation/recovery logic (or integrate into GameState)

### Data-Driven Architecture Preserved
All new content follows the "Planet is the Seed" philosophy:
- New tags -> new loot pools -> new events -> new endings
- Sector config drives planet generation
- Crew state drives barks, breakdowns, and endings
- A.U.R.A. ethics drives commentary, actions, and endings

The 4-step scalability protocol from `mechanics_consistency.md` remains valid for all new content.
