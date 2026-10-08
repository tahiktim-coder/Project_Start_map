# Crew sprites, v2 (2026-10-07, revised 2026-10-08)

v1 (12 × 24, and 9 × 17 before it) was **rejected**: a 6-pixel head can't look like anyone, and big heads on chunky
bodies read as goofy and childish. v2 is taller, has real faces, and keeps adult proportions. The story is quiet and sad,
so the crew must look like grown people with weight and dignity, never chibi or cartoon.

## The bake-off

Three methods, each drawing Cora and Vance standing, walking and at a console. The pages are
`prototypes/screens/crew-hires/option-a.html`, `option-b.html` and `option-c.html`. Scores are out of 10.

| | A: every pixel by hand, 32 × 64 at 3× | B: skeleton painted live, 40 × 88 at 2× | **C: hand-drawn heads on a lit body, 48 × 104 at 2×** |
|---|---|---|---|
| Likeness to the portraits | 7 | 4 | **8** |
| Adult, not goofy | 6 | 6 | **8** |
| Animation (weight, feet stay put) | 5 | 6 | **7** |
| House style and the dark ship | 6 | 6 | **8** |
| Can be done for 5 people × 9 actions | 4 | 8 | **8** |
| **Total** | 28 | 30 | **39** |

- **A** is crisp and the faces read at 10×, but 3× doesn't match the ship cutaway, which uses 2×. The heads are still a
  bit big, Vance's face is orange, the limbs are rough drafts, and the light switches sides when a sprite is mirrored.
  It needs about 135 maps drawn by hand.
- **B** has real lamp light, which looks good. But its 6 × 6 faces turn Cora into a white ball and Vance into a dark
  blob, and its limbs are thin like a mannequin's. It works out positions between pixels, so edges shimmer as people
  move.
- **C wins.** Its heads are the biggest (14 to 22 pixels wide), placed by hand against the portrait. Its proportions are
  the longest and most adult, the planted foot doesn't slide, every frame is baked to whole pixels, and its 2× matches
  the cutaway. Its weak points: the bodies are smooth like a figurine, Cora's suit is purple instead of black, and the
  head never turns.

**v2 is C, with two things taken from the others.** From A: heads drawn by hand for each view (front, looking down,
back), plus pixel fixes per frame wherever the body maker leaves a stray pixel. From B: the side of the body that faces a
lamp gets a warm edge.

## Size and scale

- **Native cell 48 × 104 pixels**, shown at **2×**, the same scale as the ship cutaway. On a 1920 × 1080 screen the art
  is 960 × 540 pixels, each deck is about 128 rows, and a person is 180 to 200 screen pixels tall.
- Whole device pixels only: the canvas backing uses `round(2 × devicePixelRatio)` device pixels per art pixel, with
  `image-rendering: pixelated`. Never draw at screen resolution.
- Origin: the floor is **row 101**, and column **24** sits under the hips. Sprites face right; facing left is a mirror.

## Proportions (shared, so ladders, chairs and bunks fit everyone)

- Hip at row 53. Thigh 23, shin 22.5. **Legs are the same length for all five.**
- Height comes from the torso (shoulder and neck rows) and the hair: about 88 to 100 rows standing.
- A head from crown to chin is 13 to 15 rows, so a person is about **6.5 to 7 heads tall**, an adult. A head must never
  be wider than the shoulders.
- Build is set by limb thickness, chest, waist and pelvis size, shoulder width and stance. Slight people (Cora, Mira)
  and heavy ones (Vance, Jaxon) differ in width, not in leg length.

## Views

- The head is **three-quarter**: the face is turned toward the camera, as in the portraits. Jaxon is the one
  exception: his portrait is a profile, so his head is a near-profile turned about 15 degrees toward us, which keeps it
  in agreement with the three-quarter body.
- The body is **side-on**, so walking, working, kneeling and carrying read clearly.
- **Climbing is seen from behind**: the engine draws a back view, and the person supplies a `back` head.
- Sleeping is the body lying on its back, head to the left, eyes shut.

## Faces (a head is 14 to 22 pixels wide)

- **Eyes** are 2 × 1 or 2 × 2: a dark pupil with a lighter iris or a 1-pixel light catch. Never a solid black square,
  which reads as an empty socket. Eyeliner goes on the upper-outer corner only, never as a bar across the eye.
- **Brows** are 1 pixel high, one over each eye, with skin between them. Their angle carries the mood: level is calm,
  inner ends down is angry, inner ends up is sad. Nobody aboard looks angry at rest.
- **Mouths** are 1 pixel high and 2 to 4 wide, set a pixel inside the face edge. Their ends carry the mood. Never a 2 × 2
  block of lip colour, which reads as a pout.
- **A profile** (Jaxon, and every sleeping head) runs forehead, brow ridge, a nose that starts at eye height, upper lip,
  lips, chin, jaw, with the ear about mid-head and the skull round at the back. The jaw edge is a mid-shadow skin tone,
  never near-black, or it reads as a strap.
- **Skin** uses 3 or 4 tones, lit from the front. Stubble is 2 tones, on the chin and jaw below the mouth only.
- **Hair** gets tufts of uneven length and an uneven hairline; evenly spaced spikes read as a crown. Hair texture runs in
  strands, not a checkerboard, which reads as a knitted cap.
- **Asleep**, the brow is softened to a skin shade so it doesn't stack beside the 2-pixel lid line into one dark slot.
  Signature colour on the face edge (Jaxon's amber) stays on the brow and nose: turned on its side, a full edge reads as
  a fringe of flames.
- Every view (`front`, `down`, `back`, `lying`) is checked at 6× beside the portrait at the same height, and at 2×.

## Palette

- Every colour is **sampled from the portrait**, then tuned for the dark ship. Each material is one ramp of 5 to 8
  colours that **starts at the ink `#05070a`**.
- People are the warm thing in a cold ship: skin is a little warmer and more saturated than in the portraits.
- Dark clothes are lifted, so no mid tone sits below about `#262f38`, or the figure vanishes in a dark room. **Cora's suit
  is a cool blue-black slate, not purple.**
- Light clothes (Vance's EVA suit, Aris's padded suit, Mira's uniform) stay a step below white, so the face is still the
  brightest thing. The three are told apart by temperature: Vance cool grey-white, Aris warm cream with rust panels and a
  navy undersuit only at the joints, Mira pale sage with gold.
- Saturated colour goes only on the signature detail: Cora's cyan trim, Jaxon's amber, Aris's rust panels and magenta
  hair lights, Mira's teal streak and gold.
- No black outline. Edges come from the lit rim, the dark back edge and the room's light behind the figure.

## Light

1. **Key light** from above and in front of the face. It is tied to the face, so it stays right when the sprite is
   mirrored. The edges facing it get one lit pixel and the far edges get one dark pixel. Where one part overlaps
   another, a soft shadow line separates them.
2. **Lamp warmth.** Near a ceiling lamp the whole figure warms by up to 3 steps, judged by distance. Also, the side of
   the body facing the lamp gets a 1-pixel warm edge (`rim` −1 / 0 / +1) on the head, the shoulder band and the hip
   only; a full-length stripe down a dark back read as a seam. Both are baked into the frame.
3. **Console.** The front 3 pixels of the face and the near hand take a cool cyan light.

Light texture inside a material is fine. Dithering is for walls and blankets, not skin.

## Actions

Each person has 9 actions and **40 frames**. Frame counts and timing belong to the engine. A person never changes them.

| Action | Frames | Timing | What it shows |
|---|---|---|---|
| `idle` | 4 | 700 / 800 / 900 / 800 ms | Standing in their own stance, breathing (the chest rises 1 row). A blink every ~4 s swaps the eye pixels. |
| `walk` | 8 | 115 ms | Moves 6 px a frame (a 24 px stride). The planted foot stays put on the floor. Hips are lowest at contact and highest at passing, where the support leg is straight and the whole figure rises over the planted foot; only the swing knee bends. The arms swing against the legs on every frame (phase-led, so they never both hang). |
| `console` | 4 | 190 ms | Leaning in with hands on a desk 54 rows high, typing. `down` head, cool screen light. |
| `climb` | 4 | 110 ms | Seen from behind. Rises 4 rows a frame (about 6 s a deck), with rungs every 8 rows. Hand over hand: one hand at the face, the other at the shoulder, swapping every two frames; a gripping hand stays on its rung. `back` head. |
| `sit` | 2 | 1100 ms | On a seat 22 rows high, thighs flat, slow breathing. |
| `sleep` | 2 | 1400 ms | Lying on the back in a bunk, head to the left, eyes shut, breathing. The room draws the blanket. |
| `tend` | 4 | 280 ms | Down on one knee, leaning over someone lying on the floor, hands working at about row 92. `down` head. |
| `carry` | 8 | 130 ms | Walking with a crate held to the chest. Moves 3 px a frame, with a shorter stride and a heavier bob. |
| `wall` | 4 | 1300 ms | Alone, facing a bulkhead, one hand flat on it. The head bows and the shoulders sink over the 4 frames. `down` head. |

If an action looks wrong for everyone, fix it in the engine, not in a person file.

## Files and API

Everything lives in `prototypes/screens/crew-hires/`. These are plain scripts with no build step, loaded in this
order: `engine.js`, then the five person files, then the page.

```
engine.js   the shared engine: poses, the body maker, light, baking, drawing, the review page's helpers
cora.js  jaxon.js  aris.js  vance.js  mira.js   one person each; the only thing each one does is register
crew.html   the review page: every registered person, every action, beside their portrait
```

**The engine** (`window.CrewEngine`):

```js
CrewEngine.SIZE        // { w: 48, h: 104, ground: 101, hipX: 24, scale: 2 }
CrewEngine.INK         // '#05070a'
CrewEngine.ACTIONS     // { idle: { frames: 4, ms: [...] }, walk: { frames: 8, ms: 115, move: 4 }, ... } read-only
CrewEngine.register(person)                    // called once by each person file
CrewEngine.frameAt(action, ms)                 // which frame plays at time ms
CrewEngine.sprite(id, action, frame, { blink, warm, rim, screen })
    // returns { canvas, neck: { x, y }, hands: [{ x, y }, { x, y }] }, baked once and cached
CrewEngine.draw(ctx, id, action, ms, x, floorY, { facing: 1 | -1, warm: 0..3, rim: -1 | 0 | 1, seed })
CrewEngine.sheet(id)                           // one canvas holding every action and frame, for review
```

**A person file** registers one plain object and does nothing else:

```js
CrewEngine.register({
  id: 'cora', name: 'Cora', role: 'Commander', portrait: '../../../assets/crew/F_1.png',
  signature: 'Silver bob with a heavy fringe, black high-collar suit, cyan trim.',
  ramps: { suit: [INK, ...], boot: [...], skin: [...], trim: [...] },   // every ramp starts at INK
  tex:   { suit: 0.07, skin: 0.03 },                                    // texture strength per material, 0 to 0.2
  build: { idle: 'behind',            // the standing stance: 'behind' | 'hang' | 'hips' | 'crossed'
           thigh, shin, arm, fore, hand, foot, toe,   // limb thickness [top, bottom]
           pelvis, waist, chest, sh, shX, shY, neckY, chestY, waistY, stanceX,
           backW,                    // shoulder half-width for the back view
           pack: false, bust: true },
  materials: { leg: t => t > 0.6 ? 'boot' : 'suit', forearm: t => t > 0.84 ? 'trim' : 'suit', hand: 'skin' },
  heads: {                            // every map is drawn by hand, one letter per pixel; '.' is empty
    front: { anchor: [x, y], keys: { a: '#...', ... }, map: [...], blink: { E: '#...' } },
    down:  { ... },                   // console, tend, wall: eyes lowered
    back:  { ... },                   // climb
    lying: { ... },                   // optional; without it the engine turns `front` on its side with the eyes shut
  },
  decorate(api, P, out) { },         // optional: seams, belts, chest lights, flying hair. P has action, frame, joints
  fixes: { 'walk/3': [[x, y, '#hex' | null]] },   // optional: last-resort pixel patches on a baked frame
});
```

Rules for a person file: it never adds frames, changes timing, or reaches into another person. Anything that only
looks wrong for one person goes into `fixes` (at most a handful of pixels a frame). If the same fix is needed twice, the
engine is wrong.

## Checking

- Look at `crew.html` at 2× in a lamp-lit room and a dark one, facing both ways, then at 1×, then all five in a row.
- The test: someone who has never seen the game, shown the five sprites and the five portraits, matches every pair at
  a glance.
- `?t=ms` opens the page paused at that time. `window.crewPage.pause() / play() / step(ms) / setTime(ms)` work from
  the console. The browser pane may be hidden, which pauses animation, so check still frames.

## The living ship (`ship-life.html`)

The crew in the Lander, cut open: `ship-art.js` (hull, light, space), `ship-rooms.js` (furniture, the places people
go), `ship-sim.js` (routines, story states, lines), `ship-life.html` (camera, people, clicks).

- **Decks are 208 rows** (190 of room, an 18-row floor slab), so a ceiling is about 1.8 people high. Every floor sits on
  the ladder's rung grid.
- **Scale:** one art pixel is `floor(device height / 432)` device pixels, at least 2: the largest whole scale that still
  shows two decks. A maximized 1080p browser gets 2 (people about 190 px), a 1920 × 1080 window at 125 % gets 3. Below
  432 art rows one deck is framed. `?px=N` forces a scale.
- **The ladder well:** nobody climbs through anybody. Each planned climb must stay one body height (96 rows) clear of
  every other climb at every moment, including a moment on each landing; whoever finds it taken queues beside the well,
  facing it. Routines are timed so the longest wait is about 10 s (the rush to dinner).
- **The front lane:** a walker passing someone who is sitting, standing or working, or a walker coming the other way,
  steps up to 3 rows down onto the front lip of the floor and is drawn in front.
- The hurt patient lies on the exam table; Aris works standing at the bedside.
- Every sprite frame each state draws is baked during the page's idle bake loop, so frames do not hitch the first time
  they show.
- Debug (a hidden pane pauses animation): `window.shipLife.pause() / play() / step(ms) / setTime(ms) / setState(id) /
  go(deck) / stats()`, and `?t=ms&state=normal|vance|hurt|death|sleepers&deck=n` for a still.
