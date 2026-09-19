# 03 · World: Planets, Sectors, Loot, Items

Sources: `src/generators/PlanetGenerator.js`, `src/data/SectorConfig.js`,
`src/data/LootTables.js`, `src/data/Items.js`, `src/data/Upgrades.js`.

## Planet object (schema)
```
{ id, name, type, gravity:"1.23G", temperature:"-42°C",
  atmosphere: BREATHABLE|THIN|TOXIC|CORROSIVE|HIGH_PRESSURE|NONE|UNKNOWN,
  tags:[...], metrics:{ gravity, temp, hasLife, hasTech },
  mapData:{x,y}, fuelCost:10-19, dangerLevel,
  resources:{ metals:0-100, energy:0-100, anomalies:0|1 },
  scanned, remoteScanned, visited, revealedStats }
```
Generation: type chosen by sector bias/allow-list → per-type physics (gravity, temp ranges)
→ conditions (atmosphere, tags) → resources → sector hazard hook. Nodes are positioned to
avoid overlap on the star map.

## The 30 generated planet types
(`PLANET_TYPES` in PlanetGenerator.js; CSS also defines 4 non-planet visuals: STRUCTURE,
WRONG_PLACE, STATION, ASTEROID_FIELD.) Hazard% = chance of elevated danger on probe.

| Type | Gravity | Temp °C | Atmosphere | Hazard | Profile |
|------|---------|---------|-----------|--------|---------|
| ROCKY | 0.5–1.5 | -100–50 | THIN/NONE | .30 | metal-rich, geo loot |
| GAS_GIANT | 2–8 | -150–-50 | TOXIC | .80 | energy-rich; Fuel Scoop works here |
| ICE_WORLD | 0.5–1.5 | -200–-20 | varies | .50 | metal-poor |
| OCEANIC | 0.9–1.4 | 10–40 | varies | .40 | metal-poor |
| DESERT | 0.8–1.6 | 40–120 | varies | .60 | metal-rich |
| VOLCANIC | 0.8–2 | 100–500 | varies | .90 | metal+energy rich |
| TOXIC | 0.8–2 | -50–150 | TOXIC | .70 | energy-rich |
| VITAL | 0.9–1.2 | 15–35 | BREATHABLE | .10 | life; PREDATORY risk in S4 |
| BIO_MASS | 1–1.5 | 30–60 | HIGH_PRESSURE | .90 | life; bio-energy |
| MECHA | 1.2–1.7 | -20–20 | TOXIC | .70 | tech; metal-rich |
| SHATTERED | 0.5–2.5 | -100–500 | NONE | .95 | chaotic, rich |
| TERRAFORMED | 1.0 | 22–24 | BREATHABLE | .00 | guaranteed in S5; perfectly safe |
| CRYSTALLINE | 0.8 | -50–10 | varies | .40 | energy-rich |
| ROGUE | 1.5 | -250–-200 | THIN | .60 | near absolute zero |
| TIDALLY_LOCKED | 0.9–1.3 | -180–400 | CORROSIVE | .70 | half fire / half ice |
| HOLLOW | 0.3–0.6 | 20–40 | HIGH_PRESSURE | .80 | low-gravity shell |
| SYMBIOTE_WORLD | 0.9–1.1 | 18–28 | BREATHABLE | .10 | life; bio-energy |
| MIRROR | 1–1.5 | -10–10 | THIN | .50 | tech; reflective |
| GRAVEYARD | 1.5–2.5 | -80–-20 | NONE | .85 | tech; ship-metal world |
| SINGING | 0.7–1 | 10–30 | BREATHABLE | .20 | life; energy-rich |
| STORM_WORLD | 1.2–2 | -40–60 | HIGH_PRESSURE | .85 | energy-rich |
| FUNGAL | 0.8–1.2 | 15–35 | HIGH_PRESSURE | .50 | life; bio-energy |
| TOMB_WORLD | 0.9–1.2 | -20–30 | NONE | .40 | tech; metal-rich |
| EDEN | 0.95–1.05 | 20–26 | BREATHABLE | .05 | life; only in S6; settle ending |
| MACHINE_WORLD | 1–1.5 | 5–25 | TOXIC | .70 | tech; very energy-rich |
| FROZEN_OCEAN | 0.9–1.2 | -180–-50 | THIN | .50 | life; seabed minerals |
| SULFUR | 0.7–1.1 | 80–300 | CORROSIVE | .75 | geothermal |
| CARBON | 1.5–2.5 | -30–150 | TOXIC | .40 | dense, metal-rich |
| RADIATION_BELT | 0.8–1.3 | -100–200 | NONE | .90 | energy-rich, deadly |
| GHOST_WORLD | 0.5–2 | -50–50 | THIN | .30 | unstable energy |

`hasLife`: VITAL, BIO_MASS, SYMBIOTE_WORLD, SINGING, FUNGAL, EDEN, FROZEN_OCEAN.
`hasTech`: MECHA, MIRROR, GRAVEYARD, TOMB_WORLD, MACHINE_WORLD.

## Planet tags
| Tag | Drives |
|-----|--------|
| ANCIENT_RUINS / ALIEN_SIGNALS | bonus lore + tech loot pools; sets hasTech |
| EXODUS_WRECK | Exodus derelict encounter + supplies loot |
| WRECKAGE | wreckage salvage loot |
| DERELICT | derelict encounter + loot |
| FAILED_COLONY | failed-colony encounter (+Colony Knowledge) |
| ANOMALY | anomaly encounter |
| LIGHTHOUSE / GARDEN / GRAVE | unique late-game POIs (mutually exclusive) |
| PREDATORY | hidden on S4 VITAL worlds; "paradise with teeth" |
| HIGH_RISK | narrative danger flag |

## The 6 sectors
| # | Name | Planets | Theme / hazard |
|---|------|---------|----------------|
| 1 | THE GRAVEYARD | 3–5 | Tutorial; barren worlds; 20%/warp micrometeorite deck damage |
| 2 | THE DARK VOID | 2–3 | Scarcity; each warp adds +1 stress to a random crew |
| 3 | THE SIGNAL | 3–5 | First contact; corrupted scans; "ghost planet" blips |
| 4 | THE GARDEN | 4–6 | False hope; 50% of VITAL worlds hide PREDATORY |
| 5 | THE EVENT HORIZON | 3–4 | Reality breakdown; TERRAFORMED guaranteed; random warp effects |
| 6 | THE THRESHOLD | 2–3 | Endgame; EDEN + **THE STRUCTURE** always present |

Stations spawn at 20–45% per sector; asteroid fields ~22% declining. THE STRUCTURE costs a
fixed 30 energy to approach.

## Loot (probe / scan rewards)
Weighted "bucket" model: all `LOOT_RULES` whose `criteria(planet)` match are merged into one
pool, then weighted-random drawn. Pools scale by abundance — `METALS_SCARCE/COMMON/RICH`,
`ENERGY_SCARCE/COMMON/RICH`, plus thematic pools (`BIO_STANDARD`, `GEO_RARE`, `TECH_ANCIENT`,
`ALIEN_SIGNAL_LOOT`, `ANCIENT_RUINS_LOOT`, `DERELICT_LOOT`, `WRECKAGE_SALVAGE`, etc.). Rarest
items: Neural Link, Xeno-Mycelium (weight 2).

## Items (25 — `Items.js`)
Consumables (energy/rations/stress relief): Radiotrophic Fungus, Food Pack, Synth-Chocolate,
Music Holotape, Ionized Battery, Power Coupler, Salvage Beacon, Condensed Salvage, Scrap
Plating, Xenotech, Ancient Database. Stress relief artifacts: Amber, Geode, Obsidian
Monolith, Cultural Artifact. Utility: Signal Decoder (scan sector), Star Chart (warp
discount), Repair Drone (fix a deck), Rare Bio-Sample (heal). Passive "living" items: Fungus
Culture (+1 ration / 3 actions), Symbiotic Culture (−1 ration cost / 5 actions). Revival:
Xeno-Mycelium (→HIVE_MIND), Neural Link (→MACHINE_LINK). Tech Fragment: +3 A.U.R.A. ethics.

## Upgrades (4 — `Upgrades.js`, fabricated with Salvage)
| Upgrade | Cost | Effect |
|---------|------|--------|
| Sensor Array V2 | 150 | Remote scan reveals ALL planet data |
| Nanofiber Hull Plating | 200 | −50% probe damage from gravity/heat |
| Autodoc Medbay | 250 | Heals 1 injured crew per warp |
| Bussard Fuel Scoop | 100 | Extra energy orbiting Gas Giants |

> The upgrade tree is intentionally thin — a candidate area for expansion.
