/* TheThrow — the jump into sector 3 does not finish (docs/CANON.md §7).
   The third burn stalls. The ship arrives in a sector with no name and no stars; the decks go dark one at a time, the music
   stops, the crew talk into nothing. Then the screen itself goes wrong — the ship too big and too small, the same planet
   over and over, a line repeating — the fever-dream feeling. Then, for a few seconds, the corridor seen from outside time:
   every hull ever thrown hanging in the same instant, none of them moving, a light the size of a pinhead at the end.
   Then the burn finishes, and sector 3 is real.
     play(app) → Promise, resolved when the arrival card is dismissed. Skippable at any point (skip button, Esc / Enter / Space). */

(function () {
    'use strict';
    const W = 480, H = 270, TICK_MS = 80;
    const DECK_ORDER = ['bridge', 'lab', 'quarters', 'cargo', 'engineering', 'upgrades'], DECK_DARK_FROM_MS = 1400, DECK_DARK_EVERY_MS = 700;
    const MUSIC_OUT_AT_MS = 3600, MUSIC_OUT_MS = 1800;
    const WRONG_FROM_MS = 6200, BLACK_AT_MS = 12400, PICTURE_FROM_MS = 13000, PICTURE_TO_MS = 24400, FINISH_AT_MS = 25200, CARD_AT_MS = 26600;
    const HULL_COUNT = 2600, CORRIDOR_LENGTH = 1500, LIGHT_X = 1500;
    const ZOOM_FROM = 3.2, ZOOM_TO = 0.3, BREATH = 0.07, BREATH_MS = 760;                 // the picture keeps pulling back, and never quite holds still
    const INK = '#05070a', BONE = '#c4d0c4', DIM = '#2f5a48', GREEN = '#74d99a', AMBER = '#d9a24a', RED = '#a8453c', RUST = '#6a2f2a', GOLD = '#ffe6a0';
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const dith = (x, y, v) => v * 16 > BAYER[(y & 3) * 4 + (x & 3)];
    const ease = t => (t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t));
    const span = (t, from, to) => ease((t - from) / (to - from));
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

    // ── what is said, and when. A speaker of '' is the narration. ──
    const BEATS = [
        [400, '', 'The third burn did not finish.'],
        [2400, 'Eng. Jaxon', 'The reactor has gone cold.'],
        [4000, 'Spc. Vance', 'Everyone, sound off.'],
        [5400, '', 'Nobody answers.'],
        [7000, 'Tech Mira', 'A.U.R.A.? Are you there?'],
        [8400, '', 'Nobody answers.'],
        [9600, '', 'Nobody answers. Nobody answers.'],
        [10800, '', 'Nobody answers. Nobody answers. Nobody answers.'],
        [13400, '', 'Ships. Thousands of them, in one long line. None of them are moving.'],
        [16800, '', 'Every ship Earth ever built. All on the same heading.'],
        [20200, '', 'Yours is the last one in the line.'],
        [22800, '', 'At the far end, a light the size of a pinhead.'],
        [25200, '', 'The burn finishes.'],
    ];

    const SHIP = ['...####....', '.##++++##..', '#+++-+-++##', '#++++++++##', '.##------#.', '...####....'];

    /** The corridor from outside time: hulls in a cone that narrows to the light; none of them move. */
    function buildCorridor() {
        const rand = seeded(41207);
        const hulls = Array.from({ length: HULL_COUNT }, () => {
            const far = Math.pow(rand(), 0.6);
            return { x: 40 + far * CORRIDOR_LENGTH, y: (rand() - 0.5) * (1 - far * 0.92) * 300, far, w: 3 + Math.floor(rand() * 3), old: far };
        });
        return { hulls };
    }

    function drawShip(ctx, x, y, k) {
        SHIP.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] !== '.') { ctx.fillStyle = row[rx] === '#' ? '#5a574e' : row[rx] === '+' ? BONE : '#7fd0de'; ctx.fillRect(Math.round(x + rx * k), Math.round(y + ry * k), Math.ceil(k), Math.ceil(k)); } });
    }

    function drawCorridor(ctx, world, t) {
        const p = span(t, PICTURE_FROM_MS, PICTURE_TO_MS);
        const zoom = (ZOOM_FROM * Math.pow(ZOOM_TO / ZOOM_FROM, p)) * (1 + BREATH * Math.sin(t / BREATH_MS)), camX = p * 520;   // pulls back, and drifts toward the light
        const toX = wx => 70 + (wx - camX) * zoom, toY = wy => H / 2 + wy * zoom;
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
        for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (dith(x >> 1, y >> 1, 0.035 * (1 - Math.abs(y - H / 2) / H))) { ctx.fillStyle = '#0f0a1c'; ctx.fillRect(x, y, 2, 2); }   // a violet haze, no stars
        world.hulls.forEach(h => {
            const x = toX(h.x), y = toY(h.y), w = Math.max(1, h.w * zoom);
            if (x < -6 || x > W + 6 || y < -2 || y > H + 2) return;
            ctx.fillStyle = h.old > 0.75 ? RUST : h.old > 0.4 ? RED : BONE;
            ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.max(1, Math.round(zoom * 0.9)));
        });
        const lx = toX(LIGHT_X), ly = H / 2, halo = Math.max(1, 6 * zoom), lit = span(t, 20000, 23500);
        if (lx < W + 10 && lit > 0) {
            for (let y = -halo * 3; y <= halo * 3; y++) for (let x = -halo * 3; x <= halo * 3; x++) {
                const d = Math.hypot(x, y) / (halo * 3);
                if (d < 1 && dith(Math.round(lx + x), Math.round(ly + y), (1 - d) * (1 - d) * lit)) { ctx.fillStyle = d < 0.3 ? GOLD : AMBER; ctx.fillRect(Math.round(lx + x), Math.round(ly + y), 1, 1); }
            }
        }
        const k = Math.max(1, zoom * 1.4), sx = toX(0) - 10 * k, sy = H / 2 - 3 * k;
        drawShip(ctx, sx, sy, k);
        if (Math.floor(t / 400) % 2 === 0 && zoom < 1.2) { ctx.fillStyle = GREEN; ctx.fillRect(Math.round(sx + 4 * k), Math.round(sy - 4), 1, 2); }   // you, the last mark, blinking
    }

    /** The screen going wrong: the same planet, again and again, over the real interface. */
    function drawWrong(ctx, w, h, t) {
        ctx.clearRect(0, 0, w, h);
        const p = span(t, WRONG_FROM_MS, BLACK_AT_MS), copies = Math.min(48, Math.floor(1 + Math.pow(p, 1.4) * 60)), rand = seeded(6), size = 12;
        for (let i = 0; i < copies; i++) {
            const cx = Math.floor(rand() * w), cy = Math.floor(rand() * h), r = size * (0.6 + rand() * 1.2), alpha = 0.25 + 0.5 * p;
            for (let y = -r; y <= r; y += 2) for (let x = -r; x <= r; x += 2) {
                const q = (x * x + y * y) / (r * r);
                if (q < 1 && dith((cx + x) >> 1, (cy + y) >> 1, alpha * (0.5 + 0.5 * Math.sqrt(1 - q)))) { ctx.fillStyle = q < 0.55 ? AMBER : DIM; ctx.fillRect(cx + x, cy + y, 2, 2); }
            }
        }
    }

    function tone(freq, dur, vol) { try { if (window.AudioSystem && window.AudioSystem.playTone && !window.AudioSystem.muted) window.AudioSystem.playTone(freq, 'sine', dur, vol); } catch (e) { /* no audio: the picture still works */ } }

    function play(app) {
        return new Promise(resolve => {
            const state = app && app.state, container = document.querySelector('.app-container'), decks = DECK_ORDER.map(room => document.querySelector(`.ship-deck[data-room="${room}"]`)).filter(Boolean);
            const audio = window.AudioSystem, musicBefore = audio && typeof audio.musicVolume === 'number' ? audio.musicVolume : null;
            const overlay = document.createElement('div');
            overlay.className = 'throw-veil';
            overlay.innerHTML = `<canvas class="throw-wrong"></canvas>
                <div class="reel-frame throw-picture"><canvas class="reel-canvas" width="${W}" height="${H}"></canvas><p class="reel-source"><i aria-hidden="true"></i>NO SOURCE · NOBODY ABOARD IS LOOKING AT THIS</p></div>
                <p class="reel-caption throw-caption" aria-live="polite"></p>
                <button class="reel-skip" type="button">skip ›</button>`;
            document.body.appendChild(overlay);
            document.body.classList.add('is-throw');
            const wrongCanvas = overlay.querySelector('.throw-wrong'), wrongCtx = wrongCanvas.getContext('2d');
            const picture = overlay.querySelector('.throw-picture'), ctx = overlay.querySelector('.reel-canvas').getContext('2d'), captionEl = overlay.querySelector('.throw-caption');
            const world = buildCorridor(), startedAt = performance.now();
            const sizeWrong = () => { wrongCanvas.width = Math.ceil(innerWidth / 2); wrongCanvas.height = Math.ceil(innerHeight / 2); };
            sizeWrong();
            let beatIndex = -1, isDone = false, darkened = 0, musicOut = false, lastHum = 0, fade = 0;
            const isDead = speaker => !!(speaker && state && state.isSilentSpeaker && state.isSilentSpeaker(`${speaker}: `));
            if (state && state.addLog) state.addLog('SECTOR 3 Generated. — no name. no stars.');

            function restore() {
                clearInterval(fade);                                                             // a skip mid-fade must not keep turning the music down
                document.body.classList.remove('is-throw');
                if (container) { container.style.transition = ''; container.style.transform = ''; container.style.filter = ''; }
                decks.forEach(d => { d.style.transition = ''; d.style.opacity = ''; });
                if (audio && musicBefore != null && audio.setMusicVolume) audio.setMusicVolume(musicBefore);
            }
            function card() {
                if (isDone) return;
                isDone = true;
                clearInterval(timer);
                window.removeEventListener('keydown', onKey);
                window.removeEventListener('resize', sizeWrong);
                restore();
                const sector = 3, name = (typeof SECTOR_CONFIG !== 'undefined' && SECTOR_CONFIG[sector]) ? SECTOR_CONFIG[sector].name : 'SECTOR 3';
                const line = (typeof SECTOR_ARRIVAL_LINES !== 'undefined' && SECTOR_ARRIVAL_LINES[sector]) || '';
                const mira = state && state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                const voice = mira ? { name: 'Tech Mira', text: 'Commander, there are a lot more than eight ships out here.', face: mira.portraitId } : { name: 'A.U.R.A.', text: 'Burn complete, Commander. There are many more ship beacons ahead than expected.', face: null };
                overlay.className = 'warp-plot';
                overlay.innerHTML = `<div class="warp-plot-frame warp-arrival">
                    <p class="warp-plot-kicker">SECTOR ${sector} OF ${typeof FINAL_SECTOR !== 'undefined' ? FINAL_SECTOR : 6} · THE BURN FINISHED</p>
                    <h2 class="warp-arrival-title">${esc(name)}</h2>
                    <p class="warp-arrival-line">${esc(line)}</p>
                    <div class="warp-arrival-crew"><blockquote>${voice.face ? `<img src="assets/crew/${esc(voice.face)}.png" alt="">` : '<i>◈</i>'}<div><b>${esc(voice.name)}</b><span>“${esc(voice.text)}”</span></div></blockquote></div>
                    <div class="warp-plot-buttons"><button class="warp-plot-engage warp-arrival-go">CONTINUE</button></div></div>`;
                if (state && state.addLog) { state.addLog('The burn finishes. You were in the warp the whole time.'); state.addLog(`${voice.name}: "${voice.text}"`); }
                const go = overlay.querySelector('.warp-arrival-go');
                go.addEventListener('click', () => { overlay.classList.add('is-leaving'); setTimeout(() => { overlay.remove(); resolve(); }, 350); }, { once: true });
                go.focus();
            }
            function onKey(e) { if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); card(); } }

            const timer = setInterval(() => {
                const t = performance.now() - startedAt;
                if (t >= CARD_AT_MS) { card(); return; }
                // the decks go dark, one at a time; then the music
                while (darkened < decks.length && t > DECK_DARK_FROM_MS + darkened * DECK_DARK_EVERY_MS) { const d = decks[darkened++]; d.style.transition = 'opacity 900ms'; d.style.opacity = '0.12'; tone(52 - darkened * 3, 0.5, 0.06); }
                if (!musicOut && t > MUSIC_OUT_AT_MS && audio && audio.setMusicVolume && musicBefore != null) { musicOut = true; let step = 0; fade = setInterval(() => { step++; audio.setMusicVolume(musicBefore * Math.max(0, 1 - step / 12)); if (step >= 12) clearInterval(fade); }, MUSIC_OUT_MS / 12); }
                // the screen goes wrong
                if (t > WRONG_FROM_MS && t < BLACK_AT_MS && container) {
                    const p = span(t, WRONG_FROM_MS, BLACK_AT_MS), breath = 1 + Math.sin(t / 900) * 0.16 * p;
                    container.style.transition = 'transform 700ms ease-in-out, filter 700ms';
                    container.style.transform = `scale(${breath.toFixed(3)}) rotate(${(Math.sin(t / 2300) * 1.2 * p).toFixed(2)}deg)`;
                    container.style.filter = `contrast(${(1 + p * 0.5).toFixed(2)}) saturate(${(1 - p * 0.6).toFixed(2)})`;
                    wrongCanvas.style.opacity = '1';
                    drawWrong(wrongCtx, wrongCanvas.width, wrongCanvas.height, t);
                    if (t - lastHum > 1900) { lastHum = t; tone(38, 1.6, 0.05 + 0.08 * p); }
                }
                if (t >= BLACK_AT_MS && !overlay.classList.contains('is-black')) { overlay.classList.add('is-black'); wrongCanvas.style.opacity = '0'; if (container) { container.style.transform = ''; container.style.filter = ''; } }
                if (t >= PICTURE_FROM_MS && t < FINISH_AT_MS) { picture.classList.add('is-showing'); drawCorridor(ctx, world, t); }
                if (t >= FINISH_AT_MS) picture.classList.remove('is-showing');
                const next = BEATS.findIndex(([at]) => at > t), current = (next === -1 ? BEATS.length : next) - 1;
                if (current !== beatIndex && current >= 0) {
                    beatIndex = current;
                    const [, rawSpeaker, rawText] = BEATS[current];
                    const speaker = isDead(rawSpeaker) ? '' : rawSpeaker, text = isDead(rawSpeaker) ? 'Nobody answers.' : rawText;
                    captionEl.classList.remove('is-in'); void captionEl.offsetWidth;
                    captionEl.innerHTML = speaker ? `<b>${esc(speaker)}</b>${esc(text)}` : esc(text);
                    captionEl.classList.add('is-in');
                    if (speaker && state && state.addLog) state.addLog(`${speaker}: "${text}"`);
                }
            }, TICK_MS);
            overlay.querySelector('.reel-skip').addEventListener('click', card);
            window.addEventListener('keydown', onKey);
            window.addEventListener('resize', sizeWrong);
        });
    }

    window.TheThrow = { play, buildCorridor, drawCorridor }; // buildCorridor/drawCorridor: lets a test page paint any frame
})();
