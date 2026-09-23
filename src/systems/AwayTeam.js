/* AwayTeam — sending people down has to feel like sending PEOPLE down.
   Three moments wrapped around the existing EVA rules (bundle.js still decides risk and reward):
     pick(app, eligible)      you choose the two who go — so whatever happens, you sent them
     descent(app, planet, t)  a short watch-from-orbit sequence: lander down, two figures out, radio, heartbeats
     returned(app, t, report) the airlock opens again: each face, and whether it came back
   All three resolve promises so the EVA flow can wait on them. */

(function () {
    'use strict';
    const TEAM_SIZE = 2;
    const BUFFER_W = 320, BUFFER_H = 120, GROUND_Y = 92;
    const DESCENT_MS = 5200, LOSS_HOLD_MS = 2600;
    const INK = '#06070a', BONE = '#c4d0c4', AMBER = '#d9a24a', GREEN = '#74d99a', GREEN_DIM = '#2f5a48';
    const ABOUT = {
        ENGINEER: 'Jaxon names every rock he lands on. He would rather be up here naming the pumps.',
        MEDIC: 'Aris keeps the other one alive, and keeps a list of the ones she could not.',
        SECURITY: 'Vance counts the steps down and the steps back. He has never been wrong.',
        SPECIALIST: 'Mira narrates everything she sees, out loud. That is the problem.',
    };
    const RADIO = [
        ['Lander away. Descent is clean.', 'Boots down. Gravity feels wrong, but we are standing.', 'Moving out. Keep the channel open.'],
        ['Dropping now. Hold on to something.', 'We are down. It is quieter than I expected.', 'Heading for the signal. Stay with us.'],
        ['Separation confirmed. See you soon, Commander.', 'Contact. Dust everywhere.', 'Two hundred metres to go. Eyes up.'],
    ];
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const sfx = (name, ...args) => { const audio = window.AudioSystem; if (audio && typeof audio[name] === 'function') audio[name](...args); }; // silent when muted
    const colorOf = member => (window.ShipCutaway ? `rgb(${window.ShipCutaway.colorOf(member).join(',')})` : BONE);
    const roleOf = member => Object.keys(ABOUT).find(tag => (member.tags || []).includes(tag));

    function overlay(className, inner) {
        const el = document.createElement('div');
        el.className = 'warp-plot away ' + className;
        el.setAttribute('role', 'dialog');
        el.innerHTML = `<div class="warp-plot-frame">${inner}</div>`;
        document.body.appendChild(el);
        return el;
    }
    const closeThen = (el, done) => { el.classList.add('is-leaving'); setTimeout(() => { el.remove(); done(); }, 350); };

    // ── 1. who goes ──
    function pick(app, eligible, planet) {
        return new Promise(resolve => {
            const chosen = new Set();
            const cards = eligible.map(m => `
                <button class="boarding-pick away-pick" data-id="${esc(m.id)}" aria-pressed="false" style="border-left-color:${colorOf(m)}">
                    <img src="assets/crew/${esc(m.portraitId)}.png" alt=""><b>${esc(m.realName || m.name)}</b>
                    <span>${esc(ABOUT[roleOf(m)] || '')}${m.stress >= 2 ? ' Already on edge.' : ''}</span>
                </button>`).join('');
            const el = overlay('away-picker', `
                <p class="warp-plot-kicker">AWAY TEAM — ${esc(planet && planet.name ? planet.name : 'THE SURFACE')}</p>
                <h2 class="warp-plot-target">Who goes down?</h2>
                <p class="warp-plot-hint">Choose two. The commander stays with the ship. If something goes wrong down there, it goes wrong for one of them.</p>
                <div class="boarding-picker">${cards}</div>
                <div class="warp-plot-buttons">
                    <button class="warp-plot-engage away-go" disabled>SEND THEM</button>
                    <button class="warp-plot-auto away-cancel">NOT THIS TIME</button>
                </div>`);
            const go = el.querySelector('.away-go');
            el.querySelectorAll('.away-pick').forEach(btn => btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                if (chosen.has(id)) chosen.delete(id);
                else if (chosen.size < TEAM_SIZE) chosen.add(id);
                el.querySelectorAll('.away-pick').forEach(b => b.setAttribute('aria-pressed', String(chosen.has(b.dataset.id))));
                go.disabled = chosen.size !== TEAM_SIZE;
            }));
            go.addEventListener('click', () => closeThen(el, () => resolve(eligible.filter(m => chosen.has(String(m.id))))));
            el.querySelector('.away-cancel').addEventListener('click', () => closeThen(el, () => resolve(null)));
        });
    }

    // ── 2. the descent, watched from orbit ──
    function drawDescent(ctx, progress, team, colors, now) {
        ctx.fillStyle = INK; ctx.fillRect(0, 0, BUFFER_W, BUFFER_H);
        ctx.fillStyle = GREEN_DIM;
        for (let k = 0; k < 40; k++) ctx.fillRect((k * 53) % BUFFER_W, (k * 29) % (GROUND_Y - 10), 1, 1); // fixed stars
        for (let x = 0; x < BUFFER_W; x++) {                                                                // horizon
            const ridge = Math.round(Math.sin(x * 0.05) * 3 + Math.sin(x * 0.013) * 5);
            ctx.fillStyle = '#10201a'; ctx.fillRect(x, GROUND_Y + ridge, 1, BUFFER_H);
            ctx.fillStyle = GREEN_DIM; ctx.fillRect(x, GROUND_Y + ridge, 1, 1);
        }
        const drop = Math.min(1, progress / 0.55), landerY = 8 + (GROUND_Y - 22) * (1 - Math.pow(1 - drop, 2));
        if (window.LanderGame && window.LanderGame.drawLander) window.LanderGame.drawLander(ctx, 160, Math.round(landerY) + 4, drop < 1);
        else { ctx.fillStyle = BONE; ctx.fillRect(152, landerY, 16, 9); ctx.fillRect(150, landerY + 9, 3, 4); ctx.fillRect(167, landerY + 9, 3, 4); }
        const walk = Math.max(0, (progress - 0.6) / 0.4);                                                   // two figures walk out
        team.forEach((m, i) => {
            if (walk <= 0) return;
            const x = Math.round(160 + (i ? 1 : -1) * (10 + walk * 46)), y = GROUND_Y + Math.round(Math.sin(x * 0.05) * 3 + Math.sin(x * 0.013) * 5) - 9;
            ctx.fillStyle = BONE; ctx.fillRect(x, y, 3, 3);
            ctx.fillStyle = colors[i]; ctx.fillRect(x - 1, y + 3, 5, 4); ctx.fillRect(x, y + 7, 1, 2); ctx.fillRect(x + 2, y + 7 + (Math.floor(now / 200) % 2), 1, 2);
        });
    }

    function drawPulse(ctx, color, now, rate) { // a heartbeat trace scrolling left
        const w = ctx.canvas.width, h = ctx.canvas.height;
        ctx.fillStyle = INK; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = color;
        for (let x = 0; x < w; x++) {
            const phase = ((x + now / 12) % rate) / rate;
            const y = phase < 0.08 ? h / 2 - phase * 90 : phase < 0.16 ? h / 2 - 7 + (phase - 0.08) * 170 : phase < 0.22 ? h / 2 + 6 - (phase - 0.16) * 100 : h / 2;
            ctx.fillRect(x, Math.round(y), 1, 1);
        }
    }

    function descent(app, planet, team) {
        return new Promise(resolve => {
            const lines = RADIO[Math.floor(Math.random() * RADIO.length)], colors = team.map(colorOf);
            const el = overlay('away-descent', `
                <p class="warp-plot-kicker">AWAY TEAM — ${esc(planet && planet.name ? planet.name : '')}</p>
                <canvas class="warp-plot-canvas" width="${BUFFER_W}" height="${BUFFER_H}"></canvas>
                <div class="away-vitals">${team.map((m, i) => `
                    <div><img src="assets/crew/${esc(m.portraitId)}.png" alt="" style="border-color:${colors[i]}">
                    <b style="color:${colors[i]}">${esc(m.name)}</b><canvas width="120" height="22" data-i="${i}"></canvas></div>`).join('')}</div>
                <p class="away-radio" aria-live="polite"></p>
                <div class="warp-plot-buttons"><button class="warp-plot-auto away-skip">SKIP</button></div>`);
            const ctx = el.querySelector('.warp-plot-canvas').getContext('2d'), radio = el.querySelector('.away-radio');
            const pulses = [...el.querySelectorAll('.away-vitals canvas')].map(c => c.getContext('2d'));
            const startedAt = performance.now();
            let raf = 0, isDone = false, shown = -1;
            const finish = () => { if (isDone) return; isDone = true; cancelAnimationFrame(raf); clearTimeout(timer); closeThen(el, resolve); };
            const timer = setTimeout(finish, DESCENT_MS + 400); // rAF sleeps in a background tab; the timer guarantees we move on
            (function frame(now) {
                const progress = Math.min(1, (now - startedAt) / DESCENT_MS), beat = Math.min(lines.length - 1, Math.floor(progress * lines.length));
                if (beat !== shown) { shown = beat; radio.innerHTML = `<b style="color:${colors[beat % team.length]}">${esc(team[beat % team.length].name)}:</b> “${esc(lines[beat])}”`; sfx('sfxTick'); }
                drawDescent(ctx, progress, team, colors, now);
                pulses.forEach((p, i) => drawPulse(p, colors[i], now, 70 - (team[i].stress || 0) * 10));
                if (!isDone) raf = requestAnimationFrame(frame);
            })(startedAt);
            el.querySelector('.away-skip').addEventListener('click', finish);
        });
    }

    // ── 3. the airlock opens again ──
    function returned(app, team, report) {
        return new Promise(resolve => {
            const lost = team.filter(m => m.status === 'DEAD'), hurt = team.filter(m => m.status === 'INJURED');
            const rows = team.map(m => {
                const isLost = m.status === 'DEAD', isHurt = m.status === 'INJURED';
                const line = isLost ? `did not come back — ${m._deathCause || 'lost on the surface'}` : isHurt ? 'carried in, hurt' : 'back aboard';
                return `<li class="${isLost ? 'is-lost' : isHurt ? 'is-hurt' : ''}">
                    <img src="assets/crew/${esc(m.portraitId)}.png" alt="" style="border-color:${colorOf(m)}">
                    <div><b>${esc(m.realName || m.name)}</b><span>${esc(line)}</span></div></li>`;
            }).join('');
            const title = lost.length ? `${lost.map(m => m.realName || m.name).join(' and ')} did not come back` : hurt.length ? 'They made it back. Barely.' : 'Both back aboard';
            const el = overlay('away-return ' + (lost.length ? 'is-loss' : hurt.length ? 'is-hurt' : ''), `
                <p class="warp-plot-kicker">THE AIRLOCK CYCLES</p>
                <h2 class="warp-plot-target">${esc(title)}</h2>
                <ul class="away-roll">${rows}</ul>
                <p class="away-report">${esc(report || '')}</p>
                ${lost.length ? '<p class="away-after">A stasis pod is being prepared in the cargo hold. Everyone aboard felt it: stress +1.</p>' : hurt.length ? '<p class="away-after">The crew saw them carried in: stress +1 for everyone.</p>' : ''}
                <div class="warp-plot-buttons"><button class="warp-plot-engage away-done" ${lost.length ? 'disabled' : ''}>${lost.length ? '…' : 'CONTINUE'}</button></div>`);
            const done = el.querySelector('.away-done');
            if (lost.length) { sfx('sfxCrewDeath'); setTimeout(() => { done.disabled = false; done.textContent = 'CARRY ON'; done.focus(); }, LOSS_HOLD_MS); } // nobody clicks past a death by reflex
            else done.focus();
            done.addEventListener('click', () => closeThen(el, resolve));
        });
    }

    window.AwayTeam = { pick, descent, returned, TEAM_SIZE };
})();
