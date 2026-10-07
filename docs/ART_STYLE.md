# The Silent Exodus picture style (2026-10-07)

The designer's favourite look in the game is the scene-card pictures (for example the wreck at dusk on "THE STOCKPILE —
EXODUS-8 'HALCYON'"). This page says exactly how they are made, so any session (or person) can make more that match.
The reference implementation is **`src/systems/SceneArt.js`**: read it before drawing anything new.

## What the style is, in one paragraph

Small, wide, cinematic pictures painted **entirely in code** (no image files), at a deliberately low resolution, shaded with
**ordered dithering** between a handful of hand-picked colours, then scaled up crisp. Light comes from one direction; shapes are
defined by value, not outlines; textures come from noise; one small warm or red light is the focal point. Nearly everything is
dark. A few things move at a slow, stepped eight frames a second: a blinking beacon, twinkling stars, drifting dust.

## The rules

1. **Canvas.** A small canvas (`480 × 160` for card pictures, `480 × 270` for minigames), shown scaled up with
   `image-rendering: pixelated`. Never draw at screen resolution.
2. **Colour ramps, not colours.** Each material gets a ramp of 4–6 colours from dark to light (rust, hull steel, stone, regolith,
   moon, dusk sky, grass…). Every ramp **starts at the same near-black ink** (`#05070a`), so every material can fade into the dark.
   A pixel's brightness (0..1) picks a position on its ramp.
3. **Ordered dithering.** An 8 × 8 Bayer matrix decides, pixel by pixel, whether a brightness between two ramp colours rounds up
   or down. That fixed checker grain *is* the texture of the style. No gradients, no blur, no anti-aliasing.
4. **Noise for surfaces.** Value noise and fractal noise (fbm, 3–4 octaves) roughen everything: rust patches, hull plating,
   ground, haze, clouds. Always seeded, so a picture looks the same every time.
5. **One light direction.** Upper surfaces get a bright one-pixel rim; the underside falls off to dark. Windows are dark slots.
   Metal shows plate seams every ~15 pixels.
6. **Silhouettes tell the story.** Broken, buried, tilted, torn open. A wreck is our own hull shape lying on its side, snapped in
   two, nose buried in the ground, a furrow behind it from where it came down.
7. **One focal light.** A single small light the eye goes to: a red emergency beacon blinking on a mast, a lit window, the false
   sun. It glows in a soft dithered halo.
8. **Scale cues.** A horizon low in the frame, a moon or a planet edge, stars above, a few pieces of debris. The subject is large;
   the world around it is larger.
9. **Mostly dark.** 80–95 % of the frame is near-black or deep colour. Saturation is spent only where it means something.
10. **The colour rule.** The universe is cold; only people and the lie are warm. Space, ground and machines in cool or dusty
    tones; warmth (amber, rust, a lit window) belongs to people and what they made; the false sun is the warmest thing of all.
11. **Two layers.** A static layer painted once into a pixel buffer and kept; a moving layer of a few small rectangles drawn on
    top about eight times a second. Motion is slow and sparse: blink, twinkle, drift.

## Recipes that are already in SceneArt.js

- `space(p, seed)` — dithered haze from fbm plus a seeded star field with a few bright four-point stars.
- `drawHull(p, { x, y, len, ht, angle, flip, ramp, holes, rust, from, to })` — an Exodus-class hull side on: round nose, raised
  bridge with dark windows, plate seams, engine block, fins; `from`/`to` cut it into broken pieces with scorched edges; `holes`
  tears it open so the frame shows; returns a function to place masts and lights on it.
- `dust(f, t, …)` — specks drifting across the ground layer.
- `twinkle(f, stars, t)` — only bright stars nothing was painted over get to twinkle.
- Ramps: `RUST`, `HULL`, `STONE`, `REGOLITH`, `MOON`, `DUSK`, `DUSK_WARM`, `GROUND`, `GRASS`, `CLOUD`, `NEBULA`, `PLANET`, `SUN`.

## A prompt to give another session

> You are making pixel-art pictures for a browser game called *Silent Exodus*, in its existing style. First read
> `src/systems/SceneArt.js` in the repo — it is the reference — and `docs/ART_STYLE.md`. Draw everything in plain JavaScript on
> a small canvas (480 × 160 for a card picture, 480 × 270 for a minigame), no image files, then show it scaled up with
> `image-rendering: pixelated`. Shade only with ordered (8 × 8 Bayer) dithering between colour ramps of 4–6 colours that all start
> at the near-black `#05070a`; one ramp per material (reuse the ramps in SceneArt.js where they fit). Texture every surface with
> seeded value noise / fbm. Light from one side: bright one-pixel rims on top, dark undersides, dark window slots, plate seams.
> Tell the story with the silhouette (broken, buried, tilted, torn open) and give the picture exactly one small focal light (a
> blinking red beacon, one lit window, the false sun) with a soft dithered glow. Keep 80–95 % of the frame dark. Space and
> machines are cool or dusty; warmth belongs only to people and to the false sun. Paint the still picture once into a pixel
> buffer, then draw a few small moving details on top about eight times a second (blink, twinkle, drift). Ships must use the
> game's Exodus hull shape (`drawHull` in SceneArt.js). Check the result at its real size in the game before calling it done.
