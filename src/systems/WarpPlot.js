/* WarpPlot — the jump is something you DO, not a log line.
   Three burns in a row: a marker sweeps a gauge, you lock it inside the bright window. Each burn is
   faster and tighter than the last, and each one paints its third of the trajectory in its grade
   colour, so the course on screen is literally the one you flew.
     all three clean → PERFECT (+30% of the fuel back) · mostly clean → CLEAN (+15%)
     mixed → ROUGH (nothing) · mostly missed → BAD (−25%, the ship shudders)
   Windows narrow with sector depth, a damaged bridge and a frayed commander.
   A.U.R.A. will always plot it for you — safely, mediocrely. That offer is part of the story.
   play(opts) → Promise<{ grade: 'perfect'|'clean'|'rough'|'bad', auto: boolean }> */

(function () {
    'use strict';

    const BUFFER_W = 320, BUFFER_H = 150;
    const GAUGE = { x: 30, y: 112, w: 260, h: 10 };
    const ARC = { x0: 62, x1: 272, y: 52, rise: 26, dots: 30 };
    const STAGES = [{ win: 1, period: 1 }, { win: 0.85, period: 0.78 }, { win: 0.7, period: 0.6 }]; // multipliers per burn
    const BASE_WINDOW = 0.17, WINDOW_PER_SECTOR = 0.015, MIN_WINDOW = 0.05, ROUGH_FACTOR = 2.6;
    const BASE_PERIOD_MS = 1700, PERIOD_PER_SECTOR = 100, MIN_PERIOD_MS = 620;
    const LOCK_PAUSE_MS = 420, FLIGHT_MS = 1500, RESULT_HOLD_MS = 1900;
    const INK = '#06070a', GREEN = '#74d99a', GREEN_DIM = '#2f5a48', AMBER = '#d9a24a', RED = '#d85a4e', BONE = '#c4d0c4';
    const LOCK = { clean: { points: 2, color: GREEN, word: 'CLEAN' }, rough: { points: 1, color: AMBER, word: 'ROUGH' }, bad: { points: 0, color: RED, word: 'MISSED' } };
    const GRADES = {
        perfect: { label: 'PERFECT PLOT', effect: '30% of the fuel comes back', color: '#d6ffe4', refund: 0.3 },
        clean: { label: 'CLEAN PLOT', effect: '15% of the fuel comes back', color: GREEN, refund: 0.15 },
        rough: { label: 'ROUGH PLOT', effect: 'normal fuel cost', color: AMBER, refund: 0 },
        bad: { label: 'BAD PLOT', effect: '25% extra fuel burned — hull shudders', color: RED, refund: -0.25 },
    };
    const LINES = {
        perfect: [['ENGINEER', "Three for three. I didn't feel a thing."], ['SPECIALIST', 'That was beautiful. Do that every time.'], ['AURA', 'Optimal. I could not have plotted it better. Noted.']],
        clean: [['ENGINEER', 'Textbook. The drives barely noticed.'], ['SPECIALIST', 'Clean vector. Nice hands, Commander.'], ['AURA', 'Burn nominal. Reserve preserved.']],
        rough: [['SECURITY', "We're in one piece. I'll take it."], ['MEDIC', 'Bit of a lurch. Everyone breathe.'], ['AURA', 'Course achieved. Efficiency: adequate.']],
        bad: [['ENGINEER', "That's going to cost us. Coils are screaming."], ['MEDIC', 'Is everyone all right? That was ugly.'], ['SECURITY', 'Warn me next time you do that.']],
        auto: [['AURA', 'Plotting complete. You may rest, Commander. I have us.'], ['AURA', 'I will take it from here. I always can.']],
    };
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    function baseDifficulty(opts) {
        const depth = (opts.sector || 1) - 1;
        let win = BASE_WINDOW - WINDOW_PER_SECTOR * depth;
        if (opts.isBridgeDamaged) win *= 0.6;
        if ((opts.pilotStress || 0) >= 2) win *= 0.8;
        if (opts.mode === 'sector') win *= 0.85;
        win *= opts.windowBonus || 1; // Gyro Stabiliser Fins
        return { win, period: BASE_PERIOD_MS - PERIOD_PER_SECTOR * depth };
    }

    function stageDifficulty(base, index) {
        return {
            win: Math.max(MIN_WINDOW, base.win * STAGES[index].win),
            period: Math.max(MIN_PERIOD_MS, base.period * STAGES[index].period),
            center: 0.2 + Math.random() * 0.6,
        };
    }

    function lockGrade(pos, diff) {
        const off = Math.abs(pos - diff.center);
        if (off <= diff.win / 2) return 'clean';
        return off <= (diff.win * ROUGH_FACTOR) / 2 ? 'rough' : 'bad';
    }

    function finalGrade(locks) {
        const points = locks.reduce((sum, g) => sum + LOCK[g].points, 0);
        if (points === STAGES.length * 2) return 'perfect';
        if (points >= 4) return 'clean';
        return points >= 2 ? 'rough' : 'bad';
    }

    function pickLine(kind, crew) {
        const alive = tag => crew.find(c => c.status !== 'DEAD' && (c.tags || []).includes(tag));
        const options = LINES[kind].map(([who, text]) => (who === 'AURA' ? { name: 'A.U.R.A.', text, face: null } : (alive(who) ? { name: alive(who).name, text, face: alive(who).portraitId } : null))).filter(Boolean);
        return options[Math.floor(Math.random() * options.length)] || null;
    }

    function buildOverlay(opts) {
        const el = document.createElement('div');
        el.className = 'warp-plot';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-label', 'Plot course');
        el.innerHTML = `
            <div class="warp-plot-frame">
                <p class="warp-plot-kicker">${opts.mode === 'sector' ? 'SECTOR JUMP' : 'PLOT COURSE'}</p>
                <h2 class="warp-plot-target">${esc(opts.targetName)}</h2>
                <div class="warp-plot-stage">
                    <canvas class="warp-plot-canvas" width="${BUFFER_W}" height="${BUFFER_H}"></canvas>
                    ${opts.targetHtml ? `<div class="warp-plot-body">${opts.targetHtml}</div>` : ''}
                    <div class="warp-plot-callout" aria-hidden="true"></div>
                </div>
                <ol class="warp-plot-pips" aria-label="Burns">${STAGES.map((_, i) => `<li><span>BURN ${i + 1}</span></li>`).join('')}</ol>
                <p class="warp-plot-hint">Three burns, each faster. Lock every one inside the bright window — all three clean gives the most fuel back.</p>
                <div class="warp-plot-buttons">
                    <button class="warp-plot-engage">LOCK BURN <kbd>SPACE</kbd></button>
                    <button class="warp-plot-auto">LET A.U.R.A. PLOT IT</button>
                </div>
                <div class="warp-plot-result" aria-live="polite"></div>
            </div>`;
        return el;
    }

    // ── drawing (plain 2D on a low-res buffer, scaled up pixelated) ──
    function drawScene(ctx, s, now) {
        ctx.fillStyle = INK; ctx.fillRect(0, 0, BUFFER_W, BUFFER_H);
        const speed = s.flightStart ? Math.min(1, (now - s.flightStart) / FLIGHT_MS) : 0;
        s.stars.forEach(st => { // stars stretch into streaks once the course is flown
            st.x -= (0.05 + speed * speed * 9) * st.z;
            if (st.x < 0) { st.x += BUFFER_W; st.y = Math.random() * 96; }
            ctx.fillStyle = st.z > 0.7 ? BONE : GREEN_DIM;
            ctx.fillRect(Math.round(st.x), Math.round(st.y), Math.max(1, Math.round(speed * speed * 26 * st.z)), 1);
        });
        const shake = s.grade === 'bad' && s.flightStart ? Math.round(Math.sin(now / 22) * 2 * (1 - speed)) : 0;
        const kick = Math.max(0, 1 - (now - s.lastLockAt) / LOCK_PAUSE_MS); // engine flares on every lock
        drawShip(ctx, 40 + speed * 40, 50 + shake, Math.max(speed, kick * 0.6));
        if (!s.flightStart) drawArc(ctx, s, now);
        drawGauge(ctx, s, now);
    }

    function drawShip(ctx, x, y, thrust) {
        ctx.fillStyle = BONE;
        ctx.fillRect(x, y, 14, 5); ctx.fillRect(x + 14, y + 1, 4, 3); ctx.fillRect(x + 2, y - 2, 6, 2); ctx.fillRect(x + 2, y + 5, 6, 2);
        ctx.fillStyle = AMBER;
        ctx.fillRect(x - 3 - Math.round(thrust * 16 + Math.random() * 3), y + 1, 3 + Math.round(thrust * 16), 3);
    }

    function drawArc(ctx, s, now) { // each third of the course takes the colour of the burn that flew it
        for (let k = 0; k <= ARC.dots; k++) {
            const p = k / ARC.dots, third = Math.min(STAGES.length - 1, Math.floor(p * STAGES.length));
            const x = ARC.x0 + p * (ARC.x1 - ARC.x0), y = ARC.y - Math.sin(p * Math.PI) * ARC.rise;
            const flown = s.locks[third], isCurrent = third === s.locks.length;
            ctx.fillStyle = flown ? LOCK[flown].color : (isCurrent && Math.floor(now / 200 + k) % 3 === 0 ? BONE : GREEN_DIM);
            const size = flown ? 2 : 1;
            ctx.fillRect(Math.round(x), Math.round(y), size, size);
        }
        if (s.hasBody) return; // the real planet is overlaid as the destination
        ctx.strokeStyle = GREEN; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(284, 52, 9 + Math.sin(now / 300), 0, Math.PI * 2); ctx.stroke(); // sector jump: a bare beacon
    }

    function drawGauge(ctx, s, now) {
        const g = GAUGE, px = f => Math.round(g.x + f * g.w), d = s.diff;
        ctx.fillStyle = '#10201a'; ctx.fillRect(g.x, g.y, g.w, g.h);
        if (d) {
            const rough = d.win * ROUGH_FACTOR;
            ctx.fillStyle = '#5a4520'; ctx.fillRect(px(d.center - rough / 2), g.y, Math.round(rough * g.w), g.h);
            ctx.fillStyle = GREEN; ctx.fillRect(px(d.center - d.win / 2), g.y, Math.max(2, Math.round(d.win * g.w)), g.h);
        }
        ctx.strokeStyle = GREEN_DIM; ctx.strokeRect(g.x - 0.5, g.y - 0.5, g.w + 1, g.h + 1);
        const last = s.locks[s.locks.length - 1], sincelock = now - s.lastLockAt;
        const isFrozen = sincelock < LOCK_PAUSE_MS || s.flightStart;
        ctx.fillStyle = isFrozen && last ? LOCK[last].color : '#ffffff';
        ctx.fillRect(px(s.pos) - 1, g.y - 4, 3, g.h + 8);
        if (last && sincelock < LOCK_PAUSE_MS) { // a ring bursts from the marker in the burn's colour
            const r = 3 + (sincelock / LOCK_PAUSE_MS) * 16;
            ctx.strokeStyle = LOCK[last].color;
            ctx.strokeRect(px(s.pos) - r, g.y + g.h / 2 - r * 0.6, r * 2, r * 1.2);
        }
    }

    function play(opts) {
        return new Promise(resolve => {
            const overlay = buildOverlay(opts), ctx = overlay.querySelector('canvas').getContext('2d');
            const engage = overlay.querySelector('.warp-plot-engage'), auto = overlay.querySelector('.warp-plot-auto');
            const resultEl = overlay.querySelector('.warp-plot-result'), callout = overlay.querySelector('.warp-plot-callout');
            const pips = [...overlay.querySelectorAll('.warp-plot-pips li')];
            const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
            const base = baseDifficulty(opts);
            const s = {
                diff: stageDifficulty(base, 0), pos: 0, locks: [], grade: null, flightStart: 0, lastLockAt: -1e9,
                stageStart: performance.now(), hasBody: !!opts.targetHtml,
                stars: Array.from({ length: 70 }, () => ({ x: Math.random() * BUFFER_W, y: Math.random() * 96, z: 0.3 + Math.random() * 0.7 })),
            };
            let raf = 0, isDone = false;
            document.body.appendChild(overlay);
            pips[0].classList.add('is-current');
            if (reduceMotion) { engage.disabled = true; engage.textContent = 'MANUAL PLOT NEEDS MOTION'; }
            (reduceMotion ? auto : engage).focus();

            function showCallout(text, color) {
                callout.textContent = text;
                callout.style.color = color;
                callout.classList.remove('is-showing');
                void callout.offsetWidth; // restart the CSS animation
                callout.classList.add('is-showing');
            }

            function lockBurn() {
                const now = performance.now();
                if (s.grade || now - s.lastLockAt < LOCK_PAUSE_MS) return;
                const result = lockGrade(s.pos, s.diff), index = s.locks.length;
                s.locks.push(result);
                s.lastLockAt = now;
                pips[index].className = 'is-' + result;
                pips[index].querySelector('span').textContent = LOCK[result].word;
                showCallout(`BURN ${index + 1} · ${LOCK[result].word}`, LOCK[result].color);
                if (s.locks.length === STAGES.length) { setTimeout(() => fly(finalGrade(s.locks), false), LOCK_PAUSE_MS); return; }
                setTimeout(() => { // next burn: new window, faster sweep
                    s.diff = stageDifficulty(base, s.locks.length);
                    s.stageStart = performance.now();
                    pips[s.locks.length].classList.add('is-current');
                }, LOCK_PAUSE_MS);
            }

            function fly(grade, isAuto) {
                if (s.grade) return;
                s.grade = grade;
                s.flightStart = performance.now();
                engage.disabled = true; auto.disabled = true;
                overlay.classList.add('is-flying', 'is-' + grade);
                const info = GRADES[grade], line = pickLine(isAuto ? 'auto' : grade, opts.crew || []);
                resultEl.innerHTML = `<strong style="color:${info.color}">${isAuto ? 'A.U.R.A. PLOT' : info.label}</strong><span>${info.effect}</span>`
                    + (line ? `<blockquote>${line.face ? `<img src="assets/crew/${esc(line.face)}.png" alt="">` : '<i>◈</i>'}<b>${esc(line.name)}</b> “${esc(line.text)}”</blockquote>` : '');
                if (grade === 'bad' && window.app && window.app.screenShake) window.app.screenShake('light');
                setTimeout(() => (opts.arrival ? arrive(isAuto) : finish(isAuto)), Math.max(FLIGHT_MS, RESULT_HOLD_MS));
            }

            // Sector jumps end on a title card: where you are, how old the wrecks are, what the crew makes of it.
            function arrive(isAuto) {
                const a = opts.arrival, frame = overlay.querySelector('.warp-plot-frame');
                cancelAnimationFrame(raf);
                frame.classList.add('warp-arrival');
                frame.innerHTML = `
                    <p class="warp-plot-kicker">${esc(a.kicker)}</p>
                    <h2 class="warp-arrival-title">${esc(a.title)}</h2>
                    <p class="warp-arrival-line">${esc(a.line)}</p>
                    <div class="warp-arrival-crew">${(a.voices || []).map(v => `<blockquote>${v.face ? `<img src="assets/crew/${esc(v.face)}.png" alt="">` : '<i>◈</i>'}<div><b>${esc(v.name)}</b><span>“${esc(v.text)}”</span></div></blockquote>`).join('')}</div>
                    <div class="warp-plot-buttons"><button class="warp-plot-engage warp-arrival-go">CONTINUE</button></div>`;
                const go = frame.querySelector('.warp-arrival-go');
                go.addEventListener('click', () => finish(isAuto), { once: true });
                go.focus();
            }

            function finish(isAuto) {
                if (isDone) return;
                isDone = true;
                cancelAnimationFrame(raf);
                overlay.classList.add('is-leaving');
                setTimeout(() => { overlay.remove(); resolve({ grade: s.grade, auto: isAuto }); }, 350);
            }

            function frame(now) {
                const isSweeping = !s.grade && now - s.lastLockAt >= LOCK_PAUSE_MS && s.locks.length < STAGES.length;
                if (isSweeping) { // ping-pong sweep
                    const phase = ((now - s.stageStart) % (s.diff.period * 2)) / s.diff.period;
                    s.pos = phase <= 1 ? phase : 2 - phase;
                }
                drawScene(ctx, s, now);
                if (!isDone) raf = requestAnimationFrame(frame);
            }

            engage.addEventListener('click', lockBurn);
            auto.addEventListener('click', () => fly('rough', true));
            raf = requestAnimationFrame(frame);
        });
    }

    /** Energy consequence of a plot, as a signed delta on top of the base cost already paid. */
    function energyDelta(grade, baseCost) {
        const info = GRADES[grade];
        return info ? Math.round(baseCost * info.refund) : 0;
    }

    window.WarpPlot = { play, energyDelta };
})();
