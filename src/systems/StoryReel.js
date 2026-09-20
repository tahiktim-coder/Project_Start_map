/* StoryReel — the big pictures. Short, skippable, full-screen dithered sequences that SHOW the story instead of telling it.
     'program'  (new game)   what the crew was told: Earth seeding the whole sky, eight ships ahead on your heading, you are the ninth
     'corridor' (sector 3)   what is true: every one of those lines bends into this single corridor; the hull count climbs
                             from 9 into the tens of thousands; at the far end, something dark is waiting
   One line of caption per beat, never more. play(name) → Promise (resolves when it ends or is skipped).
   Stepped at ~12 fps on a timer, so it still runs when the tab is hidden and matches the dither look. */

(function () {
    'use strict';
    const W = 480, H = 270, TICK_MS = 80;
    const EARTH = { x: 104, y: 135, r: 34 }, HEADING_Y = 135;
    const RAY_COUNT = 160, DASH_GAP = 22, DASH_LENGTH = 9, RAY_STEP = 2, CORRIDOR_LENGTH = 1500, STRUCTURE_X = 1560, WRECK_COUNT = 760;
    const HULLS_TOLD = 9, HULLS_TRUE = 41207, LIVING_REACH = 420, DYING_SPAN = 1050;
    const INK = '#05070a', BONE = '#c4d0c4', DIM = '#2f5a48', GREEN = '#74d99a', AMBER = '#d9a24a', RED = '#d85a4e';
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const dith = (x, y, v) => v * 16 > BAYER[(y & 3) * 4 + (x & 3)];
    const ease = t => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
    const span = (t, from, to) => ease((t - from) / (to - from));

    function seeded(seed) {
        let s = seed >>> 0;
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    /** Fixed sky + the fan of headings Earth launches along. Angle 0 is "this way". */
    function buildWorld() {
        const rand = seeded(9);
        const stars = Array.from({ length: 260 }, () => ({ x: rand() * (STRUCTURE_X + 300), y: rand() * H, bright: rand() < 0.18 }));
        const rays = Array.from({ length: RAY_COUNT }, (_, i) => ({
            angle: (i / RAY_COUNT) * Math.PI * 2 - Math.PI + (rand() - 0.5) * 0.04,
            speed: 0.6 + rand() * 0.8, offset: rand() * DASH_GAP, lane: (rand() - 0.5) * rand() * 96, // most lanes near the middle: a bright core, a soft edge
        }));
        const wrecks = Array.from({ length: WRECK_COUNT }, () => { const far = Math.pow(rand(), 0.55); return { x: 150 + far * (CORRIDOR_LENGTH - 150), y: HEADING_Y + (rand() - 0.5) * rand() * (30 + far * 120), old: far, tilt: rand() < 0.5 }; });
        const clouds = Array.from({ length: 9 }, () => ({ x: rand() * (STRUCTURE_X + 200), y: rand() * H, r: 50 + rand() * 90, violet: rand() < 0.5 }));
        return { stars, rays, wrecks, clouds };
    }

    function drawSky(ctx, world, pan) {
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
        world.clouds.forEach(cloud => {                                        // faint dithered nebulae, sliding slowest of all
            const cx = cloud.x - pan * 0.2;
            if (cx < -cloud.r || cx > W + cloud.r) return;
            ctx.fillStyle = cloud.violet ? '#1c1236' : '#0c2426';
            for (let y = Math.max(0, Math.floor(cloud.y - cloud.r)); y < Math.min(H, cloud.y + cloud.r); y += 1)
                for (let x = Math.max(0, Math.floor(cx - cloud.r)); x < Math.min(W, cx + cloud.r); x += 1) {
                    const d = Math.hypot(x - cx, (y - cloud.y) * 1.5) / cloud.r;
                    if (d < 1 && dith(x, y, (1 - d) * 0.7)) ctx.fillRect(x, y, 1, 1);
                }
        });
        world.stars.forEach(star => {
            const x = Math.round(star.x - pan * 0.35);                    // far stars slide slower: depth
            if (x < 0 || x >= W) return;
            ctx.fillStyle = star.bright ? BONE : DIM; ctx.fillRect(x, Math.round(star.y), star.bright ? 2 : 1, 1);
        });
    }

    function drawEarth(ctx, pan) {
        const cx = EARTH.x - pan, r = EARTH.r;
        if (cx < -r - 4) return;
        for (let y = -r - 2; y <= r + 2; y++) for (let x = -r - 2; x <= r + 2; x++) {
            const q = (x * x + y * y) / (r * r), px = Math.round(cx + x), py = EARTH.y + y;
            if (q >= 1) { if (q < 1.14 && x > -r * 0.2 && dith(px, py, 0.55)) { ctx.fillStyle = '#9fd0f0'; ctx.fillRect(px, py, 1, 1); } continue; } // thin blue air on the lit side
            const light = (x / r) * 0.75 + (y / r) * -0.3 + Math.sqrt(1 - q) * 0.5;
            const isLand = Math.sin(x * 0.3 + y * 0.14) + Math.sin(y * 0.34 - x * 0.1) > 0.7;
            const isCloud = Math.sin(x * 0.2 - y * 0.5) * Math.sin(y * 0.16 + x * 0.06) > 0.55;
            ctx.fillStyle = dith(x + 64, y + 64, light) ? (isCloud ? '#e8f4ff' : isLand ? '#5fae7a' : '#4f8fd0') : '#0c1d36';
            ctx.fillRect(px, py, 1, 1);
        }
    }

    /**
     * Ships streaming out of Earth as bright moving dashes. `bend` 0 = every heading (the story they were told);
     * 1 = every line swung round into this one corridor (the truth). `reach` = how far the front has travelled.
     */
    function drawStreams(ctx, world, time, bend, reach, pan, density = 1) {
        if (bend > 0) {                                                        // the corridor itself starts to glow as the lines pile into it
            ctx.fillStyle = '#123026';
            const glowEnd = Math.min(W, Math.round(STRUCTURE_X - pan));
            for (let x = Math.max(0, Math.round(EARTH.x + EARTH.r - pan)); x < glowEnd; x++) for (let y = HEADING_Y - 40; y < HEADING_Y + 40; y++) {
                const falloff = 1 - Math.abs(y - HEADING_Y) / 40;
                if (dith(x, y, falloff * falloff * 0.55 * bend * Math.min(1, density * 1.6))) ctx.fillRect(x, y, 1, 1);
            }
        }
        world.rays.forEach((ray, index) => {
            if ((index * 37) % RAY_COUNT >= density * RAY_COUNT) return;      // a thinner stream: only some of the lanes
            const angle = ray.angle * (1 - bend), lane = ray.lane * bend, cos = Math.cos(angle), sin = Math.sin(angle) * 0.92;
            const flow = time * 0.03 * ray.speed + ray.offset;
            for (let along = 0; along < reach; along += RAY_STEP) {
                const inDash = (((along - flow) % DASH_GAP) + DASH_GAP) % DASH_GAP;
                if (inDash > DASH_LENGTH) continue;
                const dashId = Math.floor((along - flow) / DASH_GAP);
                if (along > LIVING_REACH && ((index * 7 + dashId * 3) % 10 + 10) % 10 < (along - LIVING_REACH) / DYING_SPAN * 10) continue; // most of them never get this far
                const x = Math.round(EARTH.x + cos * (EARTH.r + along) - pan);
                if (x < 0 || x >= W || x + pan >= STRUCTURE_X) continue;
                const y = Math.round(EARTH.y + sin * (EARTH.r + along) + lane * Math.min(1, along / 200));
                if (y < 0 || y >= H) continue;
                const isHead = inDash > DASH_LENGTH - RAY_STEP - 1;
                ctx.fillStyle = isHead ? '#d6ffe4' : inDash > DASH_LENGTH / 2 ? GREEN : DIM;
                ctx.fillRect(x, y, isHead ? 2 : 1, 1);
            }
        });
    }

    /** The heading you were given: eight marks ahead of you, and you. */
    function drawHeading(ctx, shown, time) {
        ctx.fillStyle = AMBER;
        for (let x = EARTH.x + EARTH.r + 6; x < W - 10; x += 4) if (x < EARTH.x + EARTH.r + 6 + shown * (W - 140)) ctx.fillRect(x, HEADING_Y, 2, 1);
        for (let k = 1; k <= 8; k++) {
            if (k / 8 > shown) break;
            const x = 150 + k * 36;
            ctx.fillStyle = BONE; ctx.fillRect(x, HEADING_Y - 2, 3, 5); ctx.fillStyle = DIM; ctx.fillRect(x + 1, HEADING_Y - 8, 1, 5);
        }
        if (shown < 1) return;
        ctx.fillStyle = Math.floor(time / 300) % 2 ? GREEN : '#d6ffe4';
        ctx.fillRect(142, HEADING_Y - 3, 5, 7); ctx.fillRect(140, HEADING_Y - 1, 9, 3);
    }

    /** The corridor as it really is: hulls, thicker and older the further you look. */
    function drawWrecks(ctx, world, shown, pan, time) {
        world.wrecks.forEach((wreck, i) => {
            if (wreck.old > shown) return;
            const x = Math.round(wreck.x - pan), y = Math.round(wreck.y);
            if (x < -4 || x >= W) return;
            ctx.fillStyle = wreck.old > 0.7 ? '#6a2f2a' : wreck.old > 0.35 ? RED : BONE;
            ctx.fillRect(x, y, 4, 1); ctx.fillRect(x + (wreck.tilt ? 0 : 2), y - 1, 2, 1);          // a hull and what is left of its bridge
            if (i % 9 === 0) ctx.fillRect(x + 5, y + (wreck.tilt ? 1 : -1), 1, 1);                   // a piece drifting off
            if (i % 17 === 0 && Math.floor(time / 500 + i) % 3 === 0) { ctx.fillStyle = AMBER; ctx.fillRect(x + 1, y - 2, 1, 1); } // a beacon still blinking
        });
    }

    /** What is at the end. A slab with one lit edge, taller than the screen: nothing natural is that straight. */
    function drawStructure(ctx, pan, shown) {
        const x = Math.round(STRUCTURE_X - pan), wide = 78, halo = 90;
        if (x - halo > W || shown <= 0) return;
        for (let py = 0; py < H; py++) for (let px = Math.max(0, x - halo); px < Math.min(W, x + wide + 30); px++) {
            if (px >= x && px < x + wide) {
                const isEdge = px < x + 3;
                ctx.fillStyle = isEdge ? (dith(px, py, shown) ? '#f2ecff' : '#6a44c8') : (dith(px, py, 0.12 * shown) ? '#1a0f30' : '#020204');
                ctx.fillRect(px, py, 1, 1);
            } else if (px < x) {                                               // violet light spilling off the lit edge
                const glow = Math.pow(1 - (x - px) / halo, 2) * 0.8 * shown;
                if (dith(px, py, glow)) { ctx.fillStyle = (x - px) < 24 ? '#8844ff' : '#3a1f66'; ctx.fillRect(px, py, 1, 1); }
            }
        }
        for (let r = 100; r < 230; r += 42) for (let a = 0; a < 6.28; a += 0.012) {                     // rings turning round it, far too large
            const px = Math.round(x + wide / 2 + Math.cos(a) * r), py = Math.round(H / 2 + Math.sin(a) * r * 0.3);
            if (px >= 0 && px < W && py >= 0 && py < H && (px < x || px >= x + wide) && dith(px, py, 0.6 * shown)) { ctx.fillStyle = '#b79bff'; ctx.fillRect(px, py, 1, 1); }
        }
    }

    // ── the view from alongside EXODUS-9 as it jumps: used by the short shot that closes each sector ──
    const SLAB_WIDE = 78;                                                          // matches drawStructure
    const SHIP_SCALE = 2, SHIP_Y = 58, TWIN_Y = 176, HULL_Y = 206, HULL_SCALE = 2;
    const SHIP_ART = [
        '...........####...............',
        '.....#####++++++####..........',
        '..###++++++++++++++++#####....',
        '##++++-+-+-+-+-+-+++++++++###.',
        '##++++++++++++++++++++++++++##',
        '..###-----------------####....',
        '.....#####......####..........',
    ];

    function drawShip(ctx, x, y, time, isTwin) {
        const ink = isTwin ? { '#': '#3a1f66', '+': '#6a44c8', '-': '#b79bff' } : { '#': '#5a574e', '+': BONE, '-': '#7fd0de' };
        SHIP_ART.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] !== '.') { ctx.fillStyle = ink[row[rx]]; ctx.fillRect(x + rx * SHIP_SCALE, y + ry * SHIP_SCALE, SHIP_SCALE, SHIP_SCALE); } });
        const flame = 5 + Math.floor((time / 90) % 5);
        for (let k = 0; k < flame; k++) {
            ctx.fillStyle = isTwin ? '#8844ff' : k < 2 ? '#fff4d0' : k < 5 ? AMBER : '#a8321c';
            ctx.fillRect(x - (k + 1) * SHIP_SCALE, y + (3 + (k % 2)) * SHIP_SCALE, SHIP_SCALE, SHIP_SCALE);
        }
    }

    /** A dead hull sliding past the window, close enough to read the number painted on it. */
    function drawPassingHull(ctx, x, y, label) {
        const k = HULL_SCALE;
        ctx.fillStyle = '#2a201d'; ctx.fillRect(x, y, 130 * k, 30 * k);
        for (let py = y; py < y + 30 * k; py++) for (let px = Math.max(0, x); px < Math.min(W, x + 130 * k); px++) if (dith(px, py, 0.3 - (py - y) / (90 * k))) { ctx.fillStyle = '#4a3530'; ctx.fillRect(px, py, 1, 1); } // what light there is, on its upper plates
        ctx.fillStyle = '#6a2f2a'; ctx.fillRect(x, y, 130 * k, 1); ctx.fillRect(x + 10 * k, y - 7 * k, 40 * k, 7 * k);
        ctx.fillStyle = INK; ctx.fillRect(x + 78 * k, y + 5 * k, 30 * k, 14 * k); ctx.fillRect(x + 30 * k, y + 16 * k, 12 * k, 14 * k); // holes torn in it
        ctx.fillStyle = BONE; ctx.font = 'bold 14px monospace'; ctx.textBaseline = 'top'; ctx.fillText(label, x + 6 * k, y + 5 * k);
    }

    /** From sector 4 on the stars stop being scattered and start standing in rows. */
    function drawStarGrid(ctx, strength, time) {
        if (strength <= 0) return;
        ctx.fillStyle = strength > 0.6 ? BONE : DIM;
        for (let gy = 12; gy < H; gy += 24) for (let gx = 12; gx < W; gx += 24) if (dith(gx / 24 | 0, gy / 24 | 0, strength) && Math.floor(time / 700 + gx + gy) % 5) ctx.fillRect(gx, gy, 1, 1);
    }

    /** One closing shot. wrong = { density, grid, hull: [label, from ms], twin: from ms, slab: 0..1, noStars } */
    function jumpShot(caption, wrong) {
        return {
            length: 5600,
            beats: [[300, caption]],
            draw(ctx, world, t) {
                const pan = 300 + t * 0.09;
                if (wrong.noStars) { ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H); } else drawSky(ctx, world, pan);
                drawStarGrid(ctx, wrong.grid || 0, t);
                drawStreams(ctx, world, t, 1, 2400, pan, wrong.density);
                if (wrong.wrecks) drawWrecks(ctx, world, wrong.wrecks, pan, t);
                if (wrong.slab) {                                                  // it slides in from the right edge, and nothing gets past it
                    const slabPan = STRUCTURE_X - (W - 90) + span(t, 0, 5600) * 70;
                    drawStructure(ctx, slabPan, wrong.slab);
                    ctx.fillStyle = INK; ctx.fillRect(Math.round(STRUCTURE_X - slabPan) + SLAB_WIDE, 0, W, H);
                }
                if (wrong.hull && t > wrong.hull[1]) drawPassingHull(ctx, Math.round(W - (t - wrong.hull[1]) * 0.2), HULL_Y, wrong.hull[0]);
                drawShip(ctx, 110 + Math.round(Math.sin(t / 900) * 3), SHIP_Y + Math.round(Math.sin(t / 1300) * 2), t, false);
                if (wrong.twin && t > wrong.twin && Math.floor(t / 110) % 9 !== 0) drawShip(ctx, 110 + Math.round(Math.sin((t - 260) / 900) * 3), TWIN_Y + Math.round(Math.sin((t - 260) / 1300) * 2), t - 260, true); // same ship, a quarter of a second late
            },
        };
    }

    // ── the reels: beats are [start ms, caption]; draw(ctx, world, t) paints the frame at time t ──
    const REELS = {
        program: {
            length: 15000,
            beats: [[600, 'Earth. Sixty-one years ago.'], [3600, 'They are seeding the whole sky. Ships in every direction.'], [9000, 'Eight went this way before you. You are the ninth.']],
            draw(ctx, world, t) {
                drawSky(ctx, world, 0);
                drawStreams(ctx, world, t, 0, 30 + span(t, 3000, 9000) * 460, 0);
                drawEarth(ctx, 0);
                drawHeading(ctx, span(t, 9000, 12500), t);
            },
        },
        jump2: jumpShot('Sector 2. One of the eight, drifting.', { density: 0.06, hull: ['EXODUS-6', 1200] }),
        jump4: jumpShot('Sector 4. Nobody told you about thousands.', { density: 0.5, wrecks: 0.5, grid: 0.35, hull: ['EXODUS-2207', 900] }),
        jump5: jumpShot('Sector 5. It has your number on it.', { density: 0.75, wrecks: 0.8, grid: 0.7, twin: 1500 }),
        jump6: jumpShot('Sector 6. The end of the heading.', { density: 1, wrecks: 1, grid: 1, slab: 1, noStars: true, twin: 600 }),
        corridor: {
            length: 21000,
            beats: [[600, 'This is what you were told.'], [4200, 'This is what is true.'], [9500, 'Every ship Earth ever built was sent this way.'], [15500, 'All of them. Toward one thing.']],
            counter: t => Math.round(HULLS_TOLD + (HULLS_TRUE - HULLS_TOLD) * Math.pow(span(t, 4200, 12500), 2.2)),
            draw(ctx, world, t) {
                const bend = span(t, 4200, 9000), pan = span(t, 10500, 19000) * (STRUCTURE_X - W + 110);
                drawSky(ctx, world, pan);
                drawStreams(ctx, world, t, bend, 460 + bend * 1100, pan);
                drawWrecks(ctx, world, span(t, 7000, 15000), pan, t);
                drawEarth(ctx, pan);
                drawStructure(ctx, pan, span(t, 15000, 19500));
            },
        },
    };

    function overlayHtml(reel) {
        return `<div class="reel-frame">
            <canvas class="reel-canvas" width="${W}" height="${H}"></canvas>
            ${reel.counter ? '<p class="reel-counter"><span>HULLS ON THIS HEADING</span><b>9</b></p>' : ''}
            <p class="reel-caption" aria-live="polite"></p>
            <button class="reel-skip" type="button">skip ›</button>
        </div>`;
    }

    function play(name) {
        const reel = REELS[name];
        if (!reel) return Promise.resolve();
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'story-reel';
            overlay.innerHTML = overlayHtml(reel);
            document.body.appendChild(overlay);
            const ctx = overlay.querySelector('canvas').getContext('2d'), captionEl = overlay.querySelector('.reel-caption'), counterEl = overlay.querySelector('.reel-counter b');
            const world = buildWorld(), startedAt = performance.now();
            let beatIndex = -1, isDone = false;

            function finish() {
                if (isDone) return;
                isDone = true;
                clearInterval(timer);
                window.removeEventListener('keydown', onKey);
                overlay.classList.add('is-leaving');
                setTimeout(() => { overlay.remove(); resolve(); }, 500);
            }
            function onKey(e) { if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); finish(); } }

            const timer = setInterval(() => {
                const t = performance.now() - startedAt;
                if (t >= reel.length) { finish(); return; }
                reel.draw(ctx, world, t);
                if (counterEl) counterEl.textContent = reel.counter(t).toLocaleString('en-US');
                const next = reel.beats.findIndex(([at]) => at > t), current = (next === -1 ? reel.beats.length : next) - 1;
                if (current !== beatIndex && current >= 0) {
                    beatIndex = current;
                    captionEl.classList.remove('is-in'); void captionEl.offsetWidth;
                    captionEl.textContent = reel.beats[current][1];
                    captionEl.classList.add('is-in');
                }
            }, TICK_MS);
            overlay.querySelector('.reel-skip').addEventListener('click', finish);
            window.addEventListener('keydown', onKey);
        });
    }

    window.StoryReel = { play, REELS, buildWorld }; // buildWorld: lets a test page paint any frame of a reel
})();
