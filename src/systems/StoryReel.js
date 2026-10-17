/* StoryReel — the big pictures. Short, skippable, full-screen dithered sequences that SHOW the story instead of telling it.
     'program'  (new game)   what the crew was told: Earth seeding the whole sky, eight ships ahead on your heading, you are the ninth
     'light'    (the finale) the light filling the window, our ship small in front of it
   One line of caption per beat, never more. play(name) → Promise (resolves when it ends or is skipped).
   Stepped at ~12 fps on a timer, so it still runs when the tab is hidden and matches the dither look. */

(function () {
    'use strict';
    const W = 480, H = 270, TICK_MS = 80;
    const EARTH = { x: 104, y: 135, r: 34 }, HEADING_Y = 135;
    const RAY_COUNT = 160, DASH_GAP = 22, DASH_LENGTH = 9, RAY_STEP = 2, STRUCTURE_X = 1560;
    const HEADING_WEDGE = 0.1;                                                      // radians kept clear round your heading in the briefing film
    const LIVING_REACH = 420, DYING_SPAN = 1050;
    const INK = '#05070a', BONE = '#c4d0c4', DIM = '#2f5a48', GREEN = '#74d99a', AMBER = '#d9a24a';
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
        const clouds = Array.from({ length: 9 }, () => ({ x: rand() * (STRUCTURE_X + 200), y: rand() * H, r: 50 + rand() * 90, violet: rand() < 0.5 }));
        return { stars, rays, clouds };
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
    function drawStreams(ctx, world, time, bend, reach, pan, density = 1, clearWedge = 0) {
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
            if (clearWedge && Math.abs(ray.angle) < clearWedge) return;      // this heading is drawn by hand: eight ships and you, nothing else
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

    // ── EXODUS-9 from outside, in front of the light. (The short films that closed each sector are gone: the flown jump,
    //    Corridor.js, now shows the drifting hull, the numbers in the thousands, the twin and the light itself.) ──
    const SHIP_SCALE = 2;
    const SHIP_ART = [
        '...........####...............',
        '.....#####++++++####..........',
        '..###++++++++++++++++#####....',
        '##++++-+-+-+-+-+-+++++++++###.',
        '##++++++++++++++++++++++++++##',
        '..###-----------------####....',
        '.....#####......####..........',
    ];

    function drawShip(ctx, x, y, time) {
        const ink = { '#': '#5a574e', '+': BONE, '-': '#7fd0de' };
        SHIP_ART.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] !== '.') { ctx.fillStyle = ink[row[rx]]; ctx.fillRect(x + rx * SHIP_SCALE, y + ry * SHIP_SCALE, SHIP_SCALE, SHIP_SCALE); } });
        const flame = 5 + Math.floor((time / 90) % 5);
        for (let k = 0; k < flame; k++) {
            ctx.fillStyle = k < 2 ? '#fff4d0' : k < 5 ? AMBER : '#a8321c';
            ctx.fillRect(x - (k + 1) * SHIP_SCALE, y + (3 + (k % 2)) * SHIP_SCALE, SHIP_SCALE, SHIP_SCALE);
        }
    }

    /** The light, filling the right of the frame: a sun that is not warm. */
    function drawLight(ctx, t, shown) {
        const cx = W + 40, cy = H / 2, R = 150 * shown, breath = 1 + 0.03 * Math.sin(t / 640);
        if (shown <= 0) return;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const d = Math.hypot(x - cx, y - cy) / (R * breath);
            if (d > 1.9) continue;
            const tone = d < 0.55 ? 1 : d < 1 ? 0.62 + 0.38 * (1 - (d - 0.55) / 0.45) : Math.pow(1 - (d - 1) / 0.9, 2) * 0.5;
            if (!dith(x, y, tone)) continue;
            ctx.fillStyle = d < 0.55 ? '#ffffff' : d < 0.8 ? '#ffe08a' : d < 1 ? '#f0a020' : d < 1.4 ? '#c24a10' : '#3a1206';
            ctx.fillRect(x, y, 1, 1);
        }
    }
    // ── the reels: beats are [start ms, caption]; draw(ctx, world, t) paints the frame at time t ──
    const REELS = {
        light: {
            length: 6800,
            source: 'HULL CAMERA · FORWARD',
            beats: [[400, 'It fills every window.'], [3200, 'It looks like a sun, but it gives off no heat.']],
            draw(ctx, world, t) {
                ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
                drawLight(ctx, t, span(t, 0, 2600));
                drawShip(ctx, 150 + Math.round(Math.sin(t / 900) * 2), 118 + Math.round(Math.sin(t / 1300) * 2), t);
            },
        },
        program: {
            length: 15000,
            source: 'EXODUS PROGRAMME · CREW BRIEFING FILM',
            beats: [[600, 'The film they showed you before launch.'], [3600, 'Thousands of ships. Every one on its own heading.'], [9000, 'On yours, eight went first. You are the ninth.']],
            draw(ctx, world, t) {
                drawSky(ctx, world, 0);
                drawStreams(ctx, world, t, 0, 30 + span(t, 3000, 9000) * 460, 0, 1, HEADING_WEDGE);
                drawEarth(ctx, 0);
                drawHeading(ctx, span(t, 9000, 12500), t);
            },
        },
    };

    function overlayHtml(reel) {
        return `<div class="reel-frame">
            <canvas class="reel-canvas" width="${W}" height="${H}"></canvas>
            ${reel.source ? `<p class="reel-source"><i aria-hidden="true"></i>${reel.source}</p>` : ''}
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
            const ctx = overlay.querySelector('canvas').getContext('2d'), captionEl = overlay.querySelector('.reel-caption');
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
