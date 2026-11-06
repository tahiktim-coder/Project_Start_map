/* ═══ Silent Exodus · new screen (?new=1) · end/ColonyArt.js: the ordinary settling, its pictures ═════════════════════════
   What it is: the pictures of the colony ending (call C72; DESIGN.md section 3), the ending most runs get:
     THE BRAKE    the world we chose braking into view: it grows in steps, as the bridge glass brakes a world in, the same
                  picture the glass showed (NSWorlds.paint: its type, its seed, its sector).
     THE DROP     our Lander's drive light dropping to it, a warm point with a short trail, a glint where it lands.
     THE GROUND   the ground at dawn in the world's own colours (its orbit ramp: water that holds the sky, ice, sand, rock),
                  far hills, the low sun on the right; one habitat with its windows lit warm (people); our Lander standing
                  beside it; the living crew in front, looking at it. CalmArt's recipe (end/CalmArt.js, read only): a sky
                  worked out per pixel from one light, the ground below it, fine Bayer steps.
     FAILURE      the same ground at night, nobody outside, the habitat's windows going from warm to red in steps.
   House style (docs/ART_STYLE.md): ramps from the ink, the 8 x 8 Bayer dither, seeded noise, one light, stepped motion.
   end/Ending.js drives the clock and the words. Needs NSPaint, NSWorlds, MiniShip, a crew engine (CrewEngine or
   MiniCrewEngine). Loaded only with the new-screen switch, before end/Ending.js.

   window.NSColonyArt (frozen)
     build(W, H, o) → art          o: { node (the world), sector, ids (who is alive, the crew list's order), night (failure) }
     bakeNext(art) → bool          paints the next size of the world braking in; true while sizes are left (one per frame)
     drawBrake(ctx, art, k, ms)    k 0..1 through the brake (the world's size steps up)
     drawDrop(ctx, art, k, ms)     k 0..1: the Lander's light drops to the world
     drawGround(ctx, art, t, ms, red)   t: seconds on the ground; red 0..1 the windows going red (failure)
*/
(function () {
    'use strict';
    const P = window.NSPaint, SHIP = window.MiniShip;
    if (!window.NEW_SCREEN || !P) return;
    const { INK, ramp, fbm, hash, clamp01, RP } = P;
    const CE = () => window.CrewEngine || window.MiniCrewEngine || null;

    const R = {
        DAWN: ramp(INK, '#0f1520', '#1c2532', '#2f3644', '#4c4a50', '#7a6253', '#b08060', '#dca472', '#f6cc8c', '#ffeac0'),
        NIGHT: ramp(INK, '#070b12', '#0b131f', '#121d2c', '#1b2a3c'),
        HAB: ramp(INK, '#171c21', '#2b3339', '#46525a', '#6f7d84', '#a8b4b8', '#dfe5e6'),
        WIN: ['#f7c483', '#e8964a', '#93281c', '#e2574c'],      // a lit window: warm, then in steps to the alarm's red
    };
    const HORIZON = 0.56, SUN_X = 0.86, HAB_X = 0.63, LANDER_X = 0.8, FEET = 0.9;   // shares of the width or height
    const RADII = [0.05, 0.08, 0.12, 0.17, 0.23, 0.3, 0.37];                       // the brake: the world's radius, shares of H
    const PLACES = ['mira', 'cora', 'jaxon', 'aris', 'vance'];                      // left to right in front of the habitat
    const isWater = type => /OCEAN/.test(String(type || '')) && !/FROZEN/.test(String(type || ''));

    // ════════════════════════════════════════ the brake ════════════════════════════════════════
    function space(W, H) {
        const p = P.painter(W, H, true), stars = P.scatterStars(p, 71, Math.round(W * H / 2400), () => true);
        return { canvas: p.canvas(), stars: P.keepVisible(p, stars) };
    }
    function paintWorld(art, r) {
        const Wd = window.NSWorlds, node = art.node;
        let reach = 1.6;
        if (Wd && typeof Wd.reach === 'function' && node) { try { reach = Math.max(1.05, Wd.reach(node, art.sector) || reach); } catch (err) { /* the default */ } }
        const half = Math.ceil(r * reach) + 4, p = P.painter(half * 2, half * 2, false);
        const L = P.lightVector(half, half, half + r * 3, half - r * 2, r * 2.6);
        let painted = false;
        if (Wd && typeof Wd.paint === 'function' && node) { try { Wd.paint(p, { cx: half, cy: half, r, node, sector: art.sector, L }); painted = true; } catch (err) { console.error('NSColonyArt: NSWorlds.paint failed', err); } }
        if (!painted) P.sphere(p, { cx: half, cy: half, r, ramp: RP.STONE, L, surface: P.surfaceFor('rock', 23, L) });
        return { canvas: p.canvas(), half, r };
    }
    function bakeNext(art) {
        if (art.frames.length >= art.radii.length) return false;
        art.frames.push(paintWorld(art, art.radii[art.frames.length]));
        return art.frames.length < art.radii.length;
    }
    function frameAt(art, i) {
        while (art.frames.length <= i) bakeNext(art);                              // not baked in time: now
        return art.frames[i];
    }
    function drawSpace(ctx, art, ms) {
        ctx.drawImage(art.space.canvas, 0, 0);
        P.twinkle(P.framer(ctx, art.W, art.H), art.space.stars, Math.floor(ms / 125) * 125);
    }
    function drawBrake(ctx, art, k, ms) {
        drawSpace(ctx, art, ms);
        const fr = frameAt(art, Math.min(art.radii.length - 1, Math.floor(clamp01(k) * art.radii.length)));
        ctx.drawImage(fr.canvas, art.cx - fr.half, art.cy - fr.half);
    }
    /** The Lander's light: from high on the left down to the world's lit face, a warm point with a three-pixel trail; a glint
        where it lands. k arrives in the clock's steps. */
    function drawDrop(ctx, art, k, ms) {
        drawBrake(ctx, art, 1, ms);
        const f = P.framer(ctx, art.W, art.H), D = art.drop, at = q => { const e = 1 - (1 - q) * (1 - q); return [Math.round(D.x0 + (D.x1 - D.x0) * e), Math.round(D.y0 + (D.y1 - D.y0) * q)]; };
        if (k < 1) {
            for (let i = 8; i >= 1; i--) { const [x, y] = at(Math.max(0, k - i * 0.012)); f.tone(x, y, RP.SUN, 0.75 - i * 0.07); }   // the trail, fading
            const [x, y] = at(k);
            f.glow(x, y, 6, RP.SUN, 0.8); f.px(x - 1, y, '#fff3dc', 3, 1); f.px(x, y - 1, '#fff3dc', 1, 3);
        }
        if (k > 0.92) { const [x, y] = at(1); f.glow(x, y, 8, RP.SUN, 0.9 * (1 - (k - 0.92) / 0.08 * 0.5)); f.px(x - 1, y, '#fff3dc', 3, 1); f.px(x, y - 1, '#fff3dc', 1, 3); }   // it lands: a glint
    }

    // ════════════════════════════════════════ the ground ════════════════════════════════════════
    /** The sky, then the far hills, then the ground in the world's ramp (or water holding the sky). Painted once. */
    function paintGround(W, H, o) {
        const p = P.painter(W, H, true), hy = Math.round(H * HORIZON), SX = Math.round(W * SUN_X), sky = o.night ? R.NIGHT : R.DAWN, g = o.ramp, seed = o.seed;
        const skyV = (x, y) => {
            const up = clamp01(y / hy);
            if (o.night) return 0.18 + 0.5 * up * up + (fbm(x / 140, y / 12, seed, 3) - 0.5) * 0.08;
            const glow = Math.exp(-Math.hypot((x - SX) / (W * 0.32), (y - hy) / (H * 0.17))), core = Math.exp(-Math.hypot((x - SX) / (W * 0.05), (y - hy + 2) / (H * 0.018)));
            return 0.14 + 0.4 * Math.pow(up, 1.8) + 0.42 * glow + 0.5 * core + (fbm(x / 150, y / 9, seed, 4) - 0.5) * 0.1 * up;
        };
        for (let y = 0; y < hy; y++) for (let x = 0; x < W; x++) p.solid(x, y, sky, skyV(x, y));
        const ridge = x => hy - Math.max(1, Math.round(28 * Math.pow(fbm(x / 90, 0.5, seed + 3, 3), 2.2) + 5 * fbm(x / 16, 1.5, seed + 4, 2) - 3));   // far hills, low and broken
        for (let x = 0; x < W; x++) {
            const top = ridge(x), lit = o.night ? 0 : Math.exp(-Math.abs(x - SX) / (W * 0.4)) * 0.1;
            for (let y = top; y < hy; y++) p.solid(x, y, g, 0.05 + lit + 0.06 * (y - top) / Math.max(1, hy - top) + (y === top && !o.night ? 0.06 : 0));   // a silhouette, lit only at its rim
        }
        const water = isWater(o.type);
        for (let y = hy; y < H; y++) {
            const d = (y - hy) / (H - hy);                                         // 0 at the horizon, 1 at our feet
            for (let x = 0; x < W; x++) {
                if (water) {                                                        // water holding the sky, a little darker, a faint ripple
                    const wob = Math.round(1.4 * Math.sin(y * 0.9 + 6 * fbm(x / 40, y / 3, seed + 9, 2)) * d);
                    p.solid(x, y, sky, skyV(x + wob, Math.max(0, hy - (y - hy) * 0.85)) * (0.86 - 0.24 * d) + (fbm(x / 70, y * 1.3, seed + 11, 2) - 0.5) * 0.08 * d);
                    continue;
                }
                const sun = o.night ? 0 : Math.exp(-Math.abs(x - SX) / (W * (0.12 + 0.4 * d))) * (1 - 0.5 * d);
                const tex = (fbm(x / (40 + 30 * d), y * 1.3 / (1 + 2.5 * d), seed + 5, 3) - 0.5) * 0.2 + (hash(x, y, seed) > 0.93 ? 0.05 : 0);
                p.solid(x, y, g, (o.night ? 0.1 + 0.08 * d : 0.2 + 0.12 * d + 0.28 * sun) + tex);
            }
        }
        const stars = P.scatterStars(p, seed + 17, Math.round(W * H / (o.night ? 1800 : 9000)), (x, y) => y < hy * (o.night ? 0.8 : 0.32));
        return { p, hy, stars };
    }
    /** One habitat: a low module on skids, a dome at one end, a mast; lit from the low sun on the right (or not, at night).
        Its windows are left dark here: drawGround lights them each frame. Returns the windows (art px). */
    function paintHabitat(p, cx, gy, night) {
        const w = 44, h = 14, x0 = cx - (w >> 1), top = gy - h - 3, lamp = night ? 0.14 : 0.5;
        p.region(x0 + 3, gy - 3, x0 + w - 3, gy, (x, y) => p.solid(x, y, R.HAB, y === gy - 1 ? 0.06 : 0.12));                    // the skids
        p.region(x0, top, x0 + w, gy - 3, (x, y) => {
            const nx = (x + 0.5 - x0) / w, ny = (y + 0.5 - top) / h, edge = x === x0 || x === x0 + w - 1;
            p.solid(x, y, R.HAB, 0.14 + lamp * clamp01(0.2 + 0.6 * nx - 0.25 * ny) + (y === top ? 0.12 : 0) - (edge ? 0.05 : 0) + ((x - x0) % 11 === 0 ? -0.04 : 0));
        });
        p.ellipse(x0 + 11, top + 1, 9, 7, (x, y) => {                                                                   // the dome
            if (y > top) return;
            const nx = (x + 0.5 - x0 - 11) / 9, ny = (y + 0.5 - top - 1) / 7;
            p.solid(x, y, R.HAB, 0.16 + lamp * clamp01(0.5 + 0.55 * nx - 0.4 * ny) + (night ? 0 : 0.06));
        });
        for (let y = top - 14; y < top; y++) p.solid(x0 + w - 7, y, R.HAB, 0.3 + (night ? 0 : 0.2));                      // the mast
        p.solid(x0 + w - 8, top - 14, R.HAB, 0.5);
        const wins = [0, 1, 2].map(i => ({ x: x0 + 20 + i * 7, y: top + 5, w: 4, h: 3 }));
        wins.forEach(q => p.region(q.x - 1, q.y - 1, q.x + q.w + 1, q.y + q.h + 1, (x, y) => p.solid(x, y, R.HAB, 0.08)));
        return wins;
    }
    /** Our Lander, standing on its legs beside the habitat. */
    function paintLander(g, W, H, x, y, night) {
        if (!SHIP || typeof SHIP.lander !== 'function') return;
        try { SHIP.lander(g, { x, y, len: 34, angle: Math.PI / 2, legs: 'down', anchor: 1.1, sunDir: [1, -0.25], light: night ? 0.4 : 0.8 }); } catch (err) { console.warn('NSColonyArt: no Lander', err); }
    }
    function group(W, ids) {
        const set = new Set(ids || []), live = PLACES.filter(id => set.has(id)), gap = W * 0.062, left = W * 0.27 - (live.length - 1) * gap / 2;
        return live.map((id, i) => ({ id, x: Math.round(left + i * gap), seed: i * 337 + 7 }));
    }

    function build(W, H, o) {
        const node = o.node || null, sector = o.sector || 1, Wd = window.NSWorlds;
        let pal = null;
        if (Wd && typeof Wd.palette === 'function' && node) { try { pal = Wd.palette(node.type); } catch (err) { pal = null; } }
        const id = String((node && node.id) || ''), seed = 31 + [...id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 997, sector);   // the world's own, every time
        const G = paintGround(W, H, { ramp: (pal && pal.ramp) || RP.STONE, type: node && node.type, night: !!o.night, seed });
        const gy = G.hy + Math.round((H - G.hy) * 0.24), hx = Math.round(W * HAB_X);
        const wins = paintHabitat(G.p, hx, gy, !!o.night);
        const ground = G.p.canvas();
        paintLander(ground.getContext('2d'), W, H, Math.round(W * LANDER_X), gy - 1, !!o.night);
        const cx = Math.round(W * 0.6), cy = Math.round(H * 0.52), radii = RADII.map(k => Math.max(4, Math.round(H * k)));
        const rEnd = radii[radii.length - 1];
        const art = {
            W, H, node, sector, night: !!o.night, space: space(W, H), radii, frames: [], cx, cy, ground, wins, stars: P.keepVisible(G.p, G.stars),
            crew: o.night ? [] : group(W, o.ids), feet: Math.round(H * FEET),
            drop: { x0: Math.round(W * 0.24), y0: -6, x1: Math.round(cx - rEnd * 0.38), y1: Math.round(cy - rEnd * 0.3) },
        };
        bakeNext(art);
        return art;
    }

    function drawGround(ctx, art, t, ms, red) {
        const tq = Math.floor(ms / 125) * 125, f = P.framer(ctx, art.W, art.H);
        ctx.drawImage(art.ground, 0, 0);
        P.twinkle(f, art.stars, tq);
        const step = Math.min(R.WIN.length - 1, Math.floor(clamp01(red || 0) * R.WIN.length));
        art.wins.forEach((q, i) => {
            const hex = R.WIN[red > 0 ? step : 0], on = !(red >= 1 && Math.floor(ms / 700) % 2 && i === 1);   // the middle one blinks once all are red
            if (on) f.px(q.x, q.y, hex, q.w, q.h);
            if (!red && !art.night && hash(i, Math.floor(tq / 1500), 13) > 0.8) f.px(q.x + 1, q.y + 1, R.WIN[1], 2, 1);   // someone passing inside
        });
        const E = CE();
        if (!E || !art.crew.length) return;
        art.crew.forEach(m => { try { E.draw(ctx, m.id, 'idle', ms + m.seed, m.x, art.feet, { facing: 1, warm: 1, rim: 1, seed: m.seed }); } catch (err) { /* a person who cannot be drawn is left out */ } });
    }

    window.NSColonyArt = Object.freeze({ build, bakeNext, drawBrake, drawDrop, drawGround, RADII_N: RADII.length });
})();
