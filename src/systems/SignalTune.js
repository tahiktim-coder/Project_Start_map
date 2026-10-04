/* SignalTune — a deep scan is something you tune, not a button you press.
   The planet sends back a wave. You have two dials (pitch, strength) and a few seconds: make your
   wave sit on top of theirs and lock it. The target drifts, more in deeper sectors, so you cannot
   wait for a perfect moment forever.
     sharp lock (85%+) → the scan picks up extra detail (+1 data)
     fair lock         → a normal scan
     weak lock (<45%)  → the scan has to run twice (1 extra energy)
   A.U.R.A. will tune it for you: always fair, never sharp.
   play(opts) → Promise<{ match: 0..1, grade: 'sharp'|'fair'|'weak', auto: boolean }> */

(function () {
    'use strict';

    const BUFFER_W = 320, BUFFER_H = 110, MID_Y = 55, WAVE_HEIGHT = 40;
    const TIME_LIMIT_MS = 14000, RESULT_HOLD_MS = 1500;
    const PITCH = { min: 1.5, max: 6 }, STRENGTH = { min: 0.25, max: 1 };
    const SHARP_AT = 0.85, WEAK_BELOW = 0.45, AUTO_MATCH = 0.7;
    const BASE_DRIFT = 0.25, DRIFT_PER_SECTOR = 0.09;
    const INK = '#06070a', GREEN = '#74d99a', GREEN_DIM = '#2f5a48', BONE = '#c4d0c4', BRIGHT = '#d6ffe4', AMBER = '#d9a24a', RED = '#d85a4e';
    const GRADES = {
        sharp: { label: 'SHARP LOCK', effect: 'extra detail recovered — +1 data', color: BRIGHT },
        fair: { label: 'FAIR LOCK', effect: 'a normal scan', color: GREEN },
        weak: { label: 'WEAK LOCK', effect: 'the scan has to run twice — 1 extra energy', color: AMBER },
    };
    const sfx = (name, ...args) => { const audio = window.AudioSystem; if (audio && typeof audio[name] === 'function') audio[name](...args); }; // silent when muted
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    const gradeOf = match => (match >= SHARP_AT ? 'sharp' : match < WEAK_BELOW ? 'weak' : 'fair');

    function matchOf(s) {
        const pitchMiss = Math.abs(s.pitch - s.targetPitch) / (PITCH.max - PITCH.min);
        const strengthMiss = Math.abs(s.strength - s.targetStrength) / (STRENGTH.max - STRENGTH.min);
        return Math.max(0, 1 - (pitchMiss * 2.4 + strengthMiss * 1.2)); // pitch matters twice as much as strength
    }

    function overlayHtml(opts) {
        return `<div class="warp-plot-frame">
            <p class="warp-plot-kicker">DEEP SCAN</p>
            <h2 class="warp-plot-target">${esc(opts.targetName)}</h2>
            <canvas class="warp-plot-canvas" width="${BUFFER_W}" height="${BUFFER_H}"></canvas>
            <div class="tune-readout"><span>MATCH</span><b class="tune-match">0%</b><div class="tune-timer"><i></i></div></div>
            <p class="warp-plot-hint">The dim wave is the planet. The bright wave is yours. Move the two dials until they sit on top of each other, then lock — before the signal fades.</p>
            <div class="tune-dials">
                <label>PITCH<input type="range" class="tune-pitch" min="${PITCH.min}" max="${PITCH.max}" step="0.02"></label>
                <label>STRENGTH<input type="range" class="tune-strength" min="${STRENGTH.min}" max="${STRENGTH.max}" step="0.01"></label>
            </div>
            <div class="warp-plot-buttons">
                <button class="warp-plot-engage">LOCK SIGNAL</button>
                <button class="warp-plot-auto">LET A.U.R.A. TUNE IT</button>
            </div>
            <div class="warp-plot-result" aria-live="polite"></div>
        </div>`;
    }

    function drawWave(ctx, pitch, strength, phase, color, jitter) {
        ctx.fillStyle = color;
        for (let x = 0; x < BUFFER_W; x++) {
            const noise = jitter ? (Math.sin(x * 12.9898 + phase * 78.233) * 43758.5453 % 1) * jitter : 0;
            const y = MID_Y + Math.sin((x / BUFFER_W) * Math.PI * 2 * pitch + phase) * WAVE_HEIGHT * strength + noise;
            ctx.fillRect(x, Math.round(y), 1, 2);
        }
    }

    function draw(ctx, s, now) {
        ctx.fillStyle = INK; ctx.fillRect(0, 0, BUFFER_W, BUFFER_H);
        ctx.fillStyle = '#0d1a15';
        for (let x = 0; x < BUFFER_W; x += 16) ctx.fillRect(x, 0, 1, BUFFER_H);
        ctx.fillRect(0, MID_Y, BUFFER_W, 1);
        const phase = now / 600, isClose = s.match >= SHARP_AT;
        drawWave(ctx, s.targetPitch, s.targetStrength, phase, GREEN_DIM, s.jitter);
        drawWave(ctx, s.pitch, s.strength, phase, isClose ? BRIGHT : BONE, 0);
    }

    function play(opts) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'warp-plot signal-tune';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-label', 'Tune the scan');
            overlay.innerHTML = overlayHtml(opts);
            document.body.appendChild(overlay);

            const ctx = overlay.querySelector('canvas').getContext('2d');
            const pitchEl = overlay.querySelector('.tune-pitch'), strengthEl = overlay.querySelector('.tune-strength');
            const matchEl = overlay.querySelector('.tune-match'), timerEl = overlay.querySelector('.tune-timer i');
            const lockBtn = overlay.querySelector('.warp-plot-engage'), autoBtn = overlay.querySelector('.warp-plot-auto');
            const resultEl = overlay.querySelector('.warp-plot-result');
            const depth = (opts.sector || 1) - 1, startedAt = performance.now();
            const basePitch = PITCH.min + 0.6 + Math.random() * (PITCH.max - PITCH.min - 1.2);
            const s = {
                pitch: PITCH.min, strength: STRENGTH.min, match: 0, isDone: false,
                targetPitch: basePitch, targetStrength: STRENGTH.min + 0.15 + Math.random() * (STRENGTH.max - STRENGTH.min - 0.15),
                drift: BASE_DRIFT + DRIFT_PER_SECTOR * depth, jitter: depth * 1.2,
            };
            pitchEl.value = s.pitch; strengthEl.value = s.strength;
            let raf = 0;

            function finish(match, isAuto) {
                if (s.isDone) return;
                s.isDone = true;
                (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(raf);
                const grade = isAuto ? 'fair' : gradeOf(match), info = GRADES[grade];
                sfx(grade === 'sharp' ? 'sfxDiscovery' : grade === 'weak' ? 'sfxError' : 'sfxScan');
                [pitchEl, strengthEl, lockBtn, autoBtn].forEach(el => { el.disabled = true; });
                resultEl.innerHTML = `<strong style="color:${info.color}">${isAuto ? 'A.U.R.A. TUNED IT' : info.label}</strong><span>${info.effect}</span>`;
                setTimeout(() => {
                    overlay.classList.add('is-leaving');
                    setTimeout(() => { overlay.remove(); resolve({ match, grade, auto: isAuto }); }, 350);
                }, RESULT_HOLD_MS);
            }

            function frame(now) {
                const elapsed = now - startedAt, left = Math.max(0, 1 - elapsed / TIME_LIMIT_MS);
                s.targetPitch = basePitch + Math.sin(elapsed / 2300) * s.drift; // the signal wanders
                s.pitch = +pitchEl.value; s.strength = +strengthEl.value;
                s.match = matchOf(s);
                matchEl.textContent = Math.round(s.match * 100) + '%';
                matchEl.style.color = s.match >= SHARP_AT ? BRIGHT : s.match < WEAK_BELOW ? RED : GREEN;
                timerEl.style.transform = `scaleX(${left})`;
                draw(ctx, s, now);
                if (left === 0) { finish(s.match, false); return; } // signal faded: you get whatever you had
                raf = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
            }

            lockBtn.addEventListener('click', () => finish(s.match, false));
            autoBtn.addEventListener('click', () => finish(AUTO_MATCH, true));
            pitchEl.focus();
            raf = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        });
    }

    window.SignalTune = { play };
})();
