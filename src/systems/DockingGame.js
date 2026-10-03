/* DockingGame — you bring the ship into a turning station yourself (same phosphor frame as the lander).
   The big picture is the docking camera: the station face, its ring turning slowly, and one port on the ring.
   The strip underneath shows the ship closing in from the left.
     ← / A  roll left     → / D  roll right     ↑ / W  thrust in     ↓ / S  brake
   Roll until the ring stops turning on screen, nudge until the port sits under the marker at the top, and touch it slowly.
     port under the marker, spin matched, slow   → SOFT: docked clean
     a little off, or a little fast              → ROUGH: we scrape the ring (the boarder starts with 2 less air)
     worse                                       → CRASH: hull damage (app.state.damageRandomDeck()), the boarder starts with 3 less air
   "LET A.U.R.A. DOCK" flies it for you, cleanly. Nothing closes in until you touch a control.
   play(app, station) → Promise<{ grade: 'soft'|'rough'|'crash', auto: boolean }> */

(function () {
    'use strict';
    const W = 320, H = 180, VIEW_H = 140, CX = 160, CY = 70;                 // buffer; the camera view is the top VIEW_H rows
    const START_DIST = 80, START_SPEED = 3, MAX_SPEED = 8, MAX_DIST = 120;    // metres, metres per second
    const THRUST = 1.2, ROLL_ACCEL = 20, SPIN_MIN = 16, SPIN_MAX = 32;         // m/s², degrees/s², the ring's spin in degrees/s
    const SOFT = { speed: 1.2, roll: 4, port: 12 }, ROUGH = { speed: 2.5, roll: 12, port: 30 }; // contact limits: m/s, degrees/s of spin left, degrees off the marker
    const R_MIN = 22, R_MAX = 60, GROWTH = 1.6;                               // station radius on screen, far to near
    const PORT_HALF = 14, RESULT_HOLD_MS = 2000, MAX_STEP = 0.033, TICK_MS = 125, ATTACH_GRACE_MS = 5000;
    const THRUST_SOUND_MS = 140;
    // A.U.R.A.'s hand: steer the port under the marker (spin + gain × angle), and close at a speed that shrinks with distance; hold off if not lined up
    const AUTO = { phaseGain: 0.8, phaseRateMax: 20, rollBand: 0.5, speedGain: 0.1, speedMin: 0.8, speedMax: 4, speedBand: 0.1, holdDist: 12 };
    const INK = '#06070a', BONE = '#c4d0c4', AMBER = '#d9a24a', RED = '#d85a4e', GREEN = '#74d99a', DIM = '#2f5a48';
    const STATION_RAMP = ['#06070a', '#141a18', '#252d2a', '#3d4541', '#6b746c', '#a9b3a8', '#c4d0c4'];
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const GRADES = {
        soft: { label: 'DOCKED CLEAN', effect: 'The clamps take hold. Full air for whoever goes in.', color: GREEN },
        rough: { label: 'ROUGH DOCKING', effect: 'We scraped the ring. Whoever goes in starts with 2 less air.', color: AMBER },
        crash: { label: 'HARD DOCKING', effect: 'The hull is damaged. Whoever goes in starts with 3 less air.', color: RED },
    };
    const HOLD_TEXT = 'Holding position. Touch a control to start.', AUTO_TEXT = 'A.U.R.A. has the controls. She is lining up the port.';
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const sfx = (name, ...args) => { const audio = window.AudioSystem; if (audio && typeof audio[name] === 'function') audio[name](...args); }; // silent when muted
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const wrap = deg => { const d = ((deg % 360) + 540) % 360 - 180; return d === -180 ? 180 : d; };
    const FRAME_MS = 16;                                                        // physics on a plain timer: rAF can stall (hidden pane, background tab) while the page still reports itself visible
    const nextFrame = cb => setTimeout(() => cb(performance.now()), FRAME_MS);

    function seeded(id) {
        let s = 19;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    // ── the rules ──
    /** rand picks this station's spin (fixed per station when seeded by its id) and where the port starts. */
    function newState(rand) {
        const spin = (SPIN_MIN + rand() * (SPIN_MAX - SPIN_MIN)) * (rand() < 0.5 ? -1 : 1);
        return { dist: START_DIST, speed: START_SPEED, spin, ringAngle: rand() * 360, roll: 0, rollRate: 0, keys: { left: false, right: false, in: false, brake: false }, grade: null, endedAt: 0 };
    }
    /** Where the port sits, in degrees clockwise from the marker (−180..180). */
    const portAngle = s => wrap(s.ringAngle - s.roll);
    /** How fast the ring still turns on screen: positive means roll right to match it. */
    const relSpin = s => s.spin - s.rollRate;

    function gradeContact(s) {
        const phi = Math.abs(portAngle(s)), rel = Math.abs(relSpin(s));
        if (s.speed <= SOFT.speed && rel <= SOFT.roll && phi <= SOFT.port) return 'soft';
        if (s.speed <= ROUGH.speed && rel <= ROUGH.roll && phi <= ROUGH.port) return 'rough';
        return 'crash';
    }

    /** Advance dt seconds. Returns a grade on contact, otherwise null. */
    function step(s, dt) {
        if (s.keys.left) s.rollRate -= ROLL_ACCEL * dt;
        if (s.keys.right) s.rollRate += ROLL_ACCEL * dt;
        if (s.keys.in) s.speed += THRUST * dt;
        if (s.keys.brake) s.speed -= THRUST * dt;
        s.speed = clamp(s.speed, -MAX_SPEED, MAX_SPEED);
        s.ringAngle += s.spin * dt; s.roll += s.rollRate * dt;
        s.dist -= s.speed * dt;
        if (s.dist > MAX_DIST) { s.dist = MAX_DIST; s.speed = Math.max(0, s.speed); }
        return s.dist <= 0 ? gradeContact(s) : null;
    }

    function autopilot(s) {
        const phi = portAngle(s), wantRate = s.spin + clamp(AUTO.phaseGain * phi, -AUTO.phaseRateMax, AUTO.phaseRateMax);
        s.keys.left = s.rollRate > wantRate + AUTO.rollBand;
        s.keys.right = s.rollRate < wantRate - AUTO.rollBand;
        const isLined = Math.abs(phi) <= SOFT.port / 2 && Math.abs(relSpin(s)) <= SOFT.roll / 2;
        const wantSpeed = !isLined && s.dist < AUTO.holdDist ? 0 : clamp(AUTO.speedGain * s.dist + AUTO.speedMin, AUTO.speedMin, AUTO.speedMax);
        s.keys.in = s.speed < wantSpeed - AUTO.speedBand;
        s.keys.brake = s.speed > wantSpeed + AUTO.speedBand;
    }

    // ── drawing: dithered onto a grey-green ramp, redrawn at 8 fps ──
    const STARS = (() => { const r = seeded('dock-stars'); return Array.from({ length: 70 }, () => ({ a: r() * 360, d: 20 + r() * 170, bright: r() < 0.3 })); })();
    const radiusAt = dist => clamp(R_MIN + (R_MAX - R_MIN) * Math.pow(clamp(1 - dist / START_DIST, 0, 1), GROWTH), 12, R_MAX);

    function drawStars(ctx, s) {
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
        STARS.forEach(st => {
            const a = (st.a - s.roll) * Math.PI / 180, x = Math.round(CX + st.d * Math.sin(a)), y = Math.round(CY - st.d * Math.cos(a));
            if (y < 0 || y > VIEW_H - 2) return;
            ctx.fillStyle = st.bright ? BONE : DIM; ctx.fillRect(x, y, 2, 2);
        });
    }

    /** The station face: hub, spokes, the bright docking ring and the port, all turning with the ring. */
    function drawStation(ctx, s, isLined, tick) {
        const R = radiusAt(s.dist), phi = portAngle(s), top = STATION_RAMP.length - 1;
        for (let y = Math.max(0, Math.floor(CY - R)); y <= Math.min(VIEW_H - 1, Math.ceil(CY + R)); y++) {
            for (let x = Math.floor(CX - R); x <= Math.ceil(CX + R); x++) {
                const dx = x - CX, dy = y - CY, r = Math.hypot(dx, dy) / R;
                if (r > 1) continue;
                const local = wrap(Math.atan2(dx, -dy) * 180 / Math.PI - phi);
                let tone;
                if (r < 0.22) tone = r > 0.12 && r < 0.18 && Math.abs(wrap(local * 4)) < 20 ? 0.95 : 0.3;          // hub, four lit windows
                else if (r < 0.7) tone = Math.abs(wrap(local * 6)) < 36 ? 0.62 : 0.24;                          // six spokes over dark panels
                else if (r < 0.95) tone = Math.abs(wrap(local * 12)) < 16 ? 0.55 : 0.8;                         // the docking ring, in segments
                else tone = 0.45;                                                                                  // rim
                tone += 0.16 * (-dx - dy) / (2 * R);                                                             // light from the upper left
                const t = clamp(tone, 0, 1) * top, lo = Math.floor(t);
                ctx.fillStyle = STATION_RAMP[(t - lo) * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? Math.min(top, lo + 1) : lo];
                ctx.fillRect(x, y, 1, 1);
                if (Math.abs(local) <= PORT_HALF && r > 0.68) {                                                   // the port: a lit bay with a dark door
                    const isDoor = Math.abs(local) < PORT_HALF * 0.45 && r > 0.76 && r < 0.93;
                    ctx.fillStyle = isDoor ? '#0a0f0d' : isLined ? GREEN : tick % 4 < 2 ? AMBER : '#b07a30';
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        const my = Math.max(3, Math.round(CY - R - 6)), color = Math.abs(phi) <= SOFT.port ? GREEN : AMBER;   // the marker your hatch lines up with: fixed at the top
        ctx.fillStyle = color;
        ctx.fillRect(CX - 9, my - 3, 3, 7); ctx.fillRect(CX + 7, my - 3, 3, 7); ctx.fillRect(CX - 9, my - 3, 19, 2);
        for (let y = 2; y < my - 4; y += 4) ctx.fillRect(CX, y, 1, 2);
    }

    function drawShip(ctx, x, y, keys, isOver) {
        ctx.fillStyle = BONE;
        ctx.fillRect(x, y, 16, 5); ctx.fillRect(x + 16, y + 1, 4, 3); ctx.fillRect(x + 2, y - 2, 7, 2); ctx.fillRect(x + 2, y + 5, 7, 2);
        ctx.fillStyle = '#1d5563'; ctx.fillRect(x + 12, y + 1, 3, 2);
        if (isOver) return;
        ctx.fillStyle = AMBER;
        if (keys.in) ctx.fillRect(x - 4 - Math.round(Math.random() * 3), y + 1, 4, 3);
        if (keys.brake) { ctx.fillRect(x + 20, y - 1, 2 + Math.round(Math.random() * 2), 1); ctx.fillRect(x + 20, y + 5, 2 + Math.round(Math.random() * 2), 1); }
    }

    /** The strip under the camera: the ship closing in from the left, the station's ring on the right. */
    function drawStrip(ctx, s, tick) {
        ctx.fillStyle = '#0a0f0d'; ctx.fillRect(0, VIEW_H, W, H - VIEW_H);
        ctx.fillStyle = DIM; ctx.fillRect(0, VIEW_H, W, 1);
        for (let m = 0; m <= START_DIST; m += 10) { const x = Math.round(284 - 22 - (m / START_DIST) * 250); ctx.fillRect(x, H - 5, 2, 2); }
        ctx.fillStyle = '#3d4541'; ctx.fillRect(288, VIEW_H + 6, 32, H - VIEW_H - 10);
        ctx.fillStyle = '#6b746c'; ctx.fillRect(284, VIEW_H + 4, 4, H - VIEW_H - 6);
        ctx.fillStyle = tick % 4 < 2 ? GREEN : DIM; ctx.fillRect(283, VIEW_H + 18, 2, 4);
        const x = Math.round(284 - 22 - (clamp(s.dist, 0, START_DIST) / START_DIST) * 250);
        drawShip(ctx, x, VIEW_H + 18, s.keys, !!s.grade);
    }

    function drawEnd(ctx, s, now) {
        const age = now - s.endedAt;
        if (s.grade === 'soft') { ctx.fillStyle = GREEN; [[-40, -30], [32, -30], [-40, 24], [32, 24]].forEach(([dx, dy]) => ctx.fillRect(CX + dx, CY + dy, 8, 6)); return; } // clamps
        if (s.grade === 'crash' && age < 220) { ctx.fillStyle = '#fff4d0'; ctx.fillRect(0, 0, W, VIEW_H); return; }
        const n = s.grade === 'crash' ? 22 : 8, t = age / 1000;
        for (let k = 0; k < n; k++) {
            const a = k * 2.4, v = 20 + (k * 11) % 40;
            ctx.fillStyle = k % 3 ? AMBER : BONE;
            ctx.fillRect(Math.round(CX + Math.cos(a) * v * t), Math.round(CY - 60 + Math.sin(a) * v * t), 2, 2);
        }
    }

    function draw(ctx, s, now, tick) {
        drawStars(ctx, s);
        const isLined = Math.abs(portAngle(s)) <= SOFT.port && Math.abs(relSpin(s)) <= SOFT.roll;
        drawStation(ctx, s, isLined, tick);
        drawStrip(ctx, s, tick);
        if (s.grade) drawEnd(ctx, s, now);
    }

    // ── the screen ──
    function overlayHtml(station) {
        return `<div class="warp-plot-frame">
            <p class="warp-plot-kicker">DOCKING — ${esc(station.name || 'UNKNOWN STATION')}</p>
            <h2 class="warp-plot-target">Match the ring</h2>
            <canvas class="warp-plot-canvas docking-canvas" width="${W}" height="${H}"></canvas>
            <dl class="lander-readout docking-readout">
                <div><dt>DISTANCE</dt><dd class="dock-dist">0</dd></div>
                <div><dt>CLOSING</dt><dd class="dock-speed">0</dd></div>
                <div><dt>ROLL</dt><dd class="dock-roll">—</dd></div>
                <div><dt>PORT</dt><dd class="dock-port">—</dd></div>
            </dl>
            <p class="warp-plot-hint">Hold <kbd>←</kbd> / <kbd>→</kbd> to roll until the ring <b>stops turning</b>, and keep the lit port under the <b>marker at the top</b>. <kbd>↑</kbd> closes in, <kbd>↓</kbd> brakes. Touch it slowly.</p>
            <div class="warp-plot-buttons lander-buttons">
                <button class="warp-plot-engage lander-hold" data-key="left">◀ ROLL LEFT</button>
                <button class="warp-plot-engage lander-hold" data-key="right">ROLL RIGHT ▶</button>
                <button class="warp-plot-engage lander-hold" data-key="in">▲ THRUST IN</button>
                <button class="warp-plot-engage lander-hold" data-key="brake">▼ BRAKE</button>
                <button class="warp-plot-auto docking-auto">LET A.U.R.A. DOCK</button>
            </div>
            <div class="warp-plot-result" aria-live="polite"></div>
        </div>`;
    }

    function readouts(els, s) {
        const set = (el, text, color) => { el.textContent = text; el.style.color = color; };
        const rel = relSpin(s), phi = portAngle(s);
        set(els.dist, `${Math.max(0, Math.round(s.dist))} m`, BONE);
        set(els.speed, `${s.speed.toFixed(1)} m/s`, s.speed < 0 ? BONE : s.speed <= SOFT.speed ? GREEN : s.speed <= ROUGH.speed ? AMBER : RED);
        set(els.roll, Math.abs(rel) <= SOFT.roll ? 'MATCHED' : `${rel > 0 ? '▶' : '◀'} ${Math.round(Math.abs(rel))}°/s`, Math.abs(rel) <= SOFT.roll ? GREEN : Math.abs(rel) <= ROUGH.roll ? AMBER : RED);
        set(els.port, Math.abs(phi) <= SOFT.port ? 'FACING' : `${phi > 0 ? '▶' : '◀'} ${Math.round(Math.abs(phi))}°`, Math.abs(phi) <= SOFT.port ? GREEN : Math.abs(phi) <= ROUGH.port ? AMBER : RED);
    }

    function play(app, station) {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'warp-plot docking';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-label', 'Dock with the station');
            overlay.innerHTML = overlayHtml(station || {});
            document.body.appendChild(overlay);
            const el = q => overlay.querySelector(q), canvas = el('canvas'), ctx = canvas.getContext('2d'), resultEl = el('.warp-plot-result');
            const els = { dist: el('.dock-dist'), speed: el('.dock-speed'), roll: el('.dock-roll'), port: el('.dock-port') };
            const s = newState(seeded(station && station.id));
            window.DockingGame.current = s;                                   // read-only handle for automated play-tests
            const startedAt = performance.now();
            let last = startedAt, lastDraw = 0, tick = 0, isClosed = false, wasAttached = false, lastPuff = 0, wasMatched = false, wasFacing = false;

            const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'in', w: 'in', W: 'in', ArrowDown: 'brake', s: 'brake', S: 'brake' };
            function onKey(e) {
                if (!KEYMAP[e.key] || s.isAuto || s.grade) return;
                s.keys[KEYMAP[e.key]] = e.type === 'keydown'; e.preventDefault();
            }
            const unlisten = () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            overlay.querySelectorAll('.lander-hold').forEach(btn => {
                const set = isOn => () => { if (!s.isAuto && !s.grade) s.keys[btn.dataset.key] = isOn; };
                btn.addEventListener('pointerdown', set(true)); btn.addEventListener('pointerup', set(false)); btn.addEventListener('pointerleave', set(false));
            });
            el('.docking-auto').addEventListener('click', () => {
                if (s.grade || s.isAuto) return;
                s.isAuto = true; unlisten();
                overlay.querySelectorAll('.lander-hold, .docking-auto').forEach(b => { b.disabled = true; });
            });

            function close(result) {
                if (isClosed) return;
                isClosed = true; unlisten();
                overlay.classList.add('is-leaving');
                setTimeout(() => { overlay.remove(); resolve(result); }, 350);
            }

            function end(grade) {
                s.grade = grade; s.endedAt = performance.now(); s.keys = { left: false, right: false, in: false, brake: false };
                overlay.querySelectorAll('button').forEach(b => { b.disabled = true; });
                const info = GRADES[grade];
                resultEl.innerHTML = `<strong style="color:${info.color}">${info.label}</strong><span>${info.effect}</span>`;
                sfx('sfxTouchdown', grade);
                if (grade === 'crash') {
                    if (app && app.state && typeof app.state.damageRandomDeck === 'function') app.state.damageRandomDeck();
                    if (app && app.screenShake) app.screenShake('heavy');
                }
                setTimeout(() => close({ grade, auto: !!s.isAuto }), RESULT_HOLD_MS);
            }

            function sounds(now) {
                const isThrusting = s.keys.in || s.keys.brake;
                if (isThrusting && now - lastPuff > THRUST_SOUND_MS) { lastPuff = now; sfx('sfxThruster', false); }
                const isMatched = Math.abs(relSpin(s)) <= SOFT.roll, isFacing = Math.abs(portAngle(s)) <= SOFT.port;
                if (isMatched && !wasMatched) sfx('playTone', 660, 'sine', 0.09, 0.05);
                if (isFacing && isMatched && !wasFacing) sfx('playTone', 990, 'sine', 0.12, 0.05);
                wasMatched = isMatched; wasFacing = isFacing && isMatched;
            }

            /** Physics every ~16 ms, picture at 8 fps. Stops once the canvas has been attached and removed, or was never attached after a grace period. */
            (function frame(now) {
                if (canvas.isConnected) wasAttached = true;
                else if (wasAttached || now - startedAt > ATTACH_GRACE_MS) { unlisten(); return; }
                if (isClosed) return;
                const dt = Math.min(MAX_STEP, (now - last) / 1000); last = now;
                const isTouched = s.keys.left || s.keys.right || s.keys.in || s.keys.brake;
                const isHolding = !s.isReleased && !s.isAuto && !isTouched;                            // wait for the player: reading the screen never costs a crash
                if (!isHolding && !s.isReleased) { s.isReleased = true; sfx('sfxUndock'); }
                if (!s.grade) {
                    const status = isHolding ? HOLD_TEXT : s.isAuto ? AUTO_TEXT : '';
                    if (status !== s.status) { s.status = status; resultEl.textContent = status; }
                    if (isHolding) { s.ringAngle += s.spin * dt; }                                      // the ring keeps turning while you read it; the ship holds still
                    else {
                        if (s.isAuto) autopilot(s);
                        const grade = step(s, dt);
                        sounds(now);
                        if (grade) end(grade);
                    }
                    readouts(els, s);
                }
                if (now - lastDraw >= TICK_MS) { lastDraw = now; tick += 1; draw(ctx, s, now, tick); }
                nextFrame(frame);
            })(last);
            el('.lander-hold').focus();
        });
    }

    window.DockingGame = {
        play, GRADES,
        internals: { newState, step, autopilot, gradeContact, portAngle, relSpin, SOFT, ROUGH, START_DIST, THRUST, ROLL_ACCEL, MAX_STEP, draw }, // internals: for headless play-tests
    };
})();
