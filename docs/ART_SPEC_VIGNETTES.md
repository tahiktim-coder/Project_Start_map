# Vignette Art Spec — the "human view" loops

> Generation spec for the lofi pixel-art crew vignettes. The game's UI is the *instrument
> view* (phosphor wireframes, seeded SVG globes); these loops are the *human view* — what
> the crew actually sees and feels. The contrast is the game's thesis: normalized frontier
> over cosmic wrongness. From Sector 3 the two views may **disagree** (sensors say the sky
> is empty; the porthole shows something) — never call attention to it.

## The three slots

| Slot | Master size | Ratio | Count |
|---|---|---|---|
| **Sector-jump interstitial** (campfire scene backdrop) | 1440×900 (2× = 2880×1800 welcome) | 16:10 | 6 + variants |
| **Comms portrait** (speaks when a crew member talks) | 600×752 | ~4:5 | 5 (+1 optional A.U.R.A. core) |
| **Death variant** (same interstitial, empty seat) | 1440×900 | 16:10 | 2+ |

## Loop rules

- **6–30 s, seamless.** First and last frame identical; no visible loop pop.
- **Calm ambient motion ONLY:** cigarette/steam curl, cloud or debris parallax outside the
  window, star twinkle, a slow Ken-Burns breathe (≤4% zoom), chest rise, a blinking panel
  LED. At most **one** small "event" per loop (a distant flash, a head turn).
- **Nothing moves fast.** If it reads as action, it's wrong. The doctrine from the design
  handoff: *"nothing happens, but it breathes."*
- Frame rate: 8–12 fps for pixel feel (24 max). Logical pixel grid ~480×270 or 320×200,
  upscaled **nearest-neighbor** — chunky pixels, dither welcome.

## Palette per act (color drift IS the story)

| Act | Sectors | Palette anchor hexes | Feel |
|---|---|---|---|
| **I — The Job** | S1 Graveyard, S2 Dark Void | `#74d99a` `#9dbd8c` `#c4d0c4` `#0a0d0b` | warm greens/bone; cozy competence |
| **II — The Wrongness** | S3 Signal, S4 Garden | `#d9c69a` `#d9a24a` `#d78a6a` + pastels leaking in | "beautiful and wrong" |
| **III — The Threshold** | S5 Event Horizon, S6 | `#c96a7e` `#8a4a5e` `#d85a4e` → near-white `#f0ede3` | void pink/red draining to white |

- **Do NOT bake scanlines, CRT, vignette, or grain into the art** — the game lays its own
  wear stack over every vignette; baked effects would double up.
- Avoid pure black (`#000`) and pure white; darkest ≈ `#080a09`, brightest ≈ `#f0ede3`.

## Composition rules

- One crew member, silhouette-forward, at a **porthole/window** — the window is the light
  source and the star of the frame.
- Keep the **lower third calm** — campfire dialogue text renders over interstitials there.
- The porthole content is where the act shows: S1–2 drifting wrecks + green clouds; S3–4
  something *almost* beautiful; S5–6 the void looking back.

## Shot list

**Interstitials** (`assets/vignettes/int_s{n}.webm`):
- `int_s1` — after Jump 1. Jaxon (engineer, ex-schoolteacher) with coffee, tools spread out, green clouds outside. Warmest frame in the game.
- `int_s2` — Vance (security, Icarus survivor) awake while others sleep; the void very dark; a cigarette.
- `int_s3` — Mira (specialist) at the window with a headset, listening; outside, a pastel shimmer that shouldn't be there.
- `int_s4` — Dr. Aris with a plant cutting from the Garden; the paradise outside slightly too saturated.
- `int_s5` — the Commander alone; pink void; instruments OFF. *(Variant: empty seat.)*
- `int_s6` — mirror of `int_s1`, same composition/angle, but the sky is white and no one is drinking the coffee.

**Portraits** (`assets/vignettes/por_{name}.webm`): `commander`, `jaxon`, `aris`, `vance`, `mira` — bust framing, idle loop (breathing, occasional blink), same act-neutral bone/green grade. Optional: `aura` — no face, a core/lens.

**Death variants**: at minimum `int_s3_empty` and `int_s5_empty` (same scene, seat empty, everything else identical — the loop still plays).

## Delivery

- **Format:** WEBM (VP9, no audio) or animated WebP. Fallback: PNG sprite-sheet + frame count in filename (`int_s1_sheet_x12.png`).
- **Folder:** `assets/vignettes/` in the repo.
- Any one finished loop is enough for me to build the playback + frame system around.
