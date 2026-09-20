/**
 * EncounterCard — one card for every "something happened, who says what, what do you do" pop-up
 * (distress signals, stations, asteroid fields, crew moments, ship alerts).
 * Same card language as DeckPanel: text is text, only choices are buttons.
 */
(function () {
    'use strict';

    const SPEAKER_COLORS = {
        'Eng. Jaxon': '#f0a030', 'Dr. Aris': '#40c8ff', 'Spc. Vance': '#ff5050',
        'Tech Mira': '#d070ff', 'A.U.R.A.': '#74d99a'
    };
    const TONES = { distress: '#d85a4e', alert: '#e08a3c', rock: '#d9a24a', station: '#74d99a', crew: '#c8c2b0' };
    const SIGNAL_W = 280, SIGNAL_H = 36, SIGNAL_TICK_MS = 125;
    // "+15 Salvage", "-10% Energy", "+0-2 Stress"
    const REWARD_PATTERN = /([+\-−]\d+(?:-\d+)?%?\s+[A-Z][a-zA-Z]*(?:\s[A-Z][a-zA-Z]*)?)/g;
    const BAD_WORDS = /stress|damage|injur/i;

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    function memberFor(app, speaker) {
        const crew = (app && app.state && app.state.crew) || [];
        const last = String(speaker).split(' ').pop().toLowerCase();
        return crew.find(m => m.name === speaker) || crew.find(m => m.name && m.name.toLowerCase().includes(last)) || null;
    }

    function faceHtml(app, speaker, color) {
        if (speaker === 'A.U.R.A.') return `<span class="enc-face enc-face-aura" style="border-color:${color}">AI</span>`;
        const member = memberFor(app, speaker);
        if (member && member.portraitId) return `<img class="enc-face" src="assets/crew/${esc(member.portraitId)}.png" alt="" style="border-color:${color}">`;
        return `<span class="enc-face" style="border-color:${color}"></span>`;
    }

    function dialogueHtml(app, lines) {
        if (!lines || !lines.length) return '';
        return `<ul class="enc-talk">${lines.map(d => {
            const color = SPEAKER_COLORS[d.speaker] || '#c8c2b0';
            return `<li>${faceHtml(app, d.speaker, color)}<p><b style="color:${color}">${esc(d.speaker)}</b>${d.text}</p></li>`;
        }).join('')}</ul>`;
    }

    /** Colours the numbers inside a choice description so gains and costs read at a glance. */
    function markRewards(desc) {
        return String(desc || '').replace(REWARD_PATTERN, (hit) => {
            const isLoss = /^[\-−]/.test(hit) ? !BAD_WORDS.test(hit) : BAD_WORDS.test(hit);
            return `<b class="${isLoss ? 'is-loss' : 'is-gain'}">${hit}</b>`;
        });
    }

    function choicesHtml(choices) {
        return `<div class="enc-choices">${choices.map((c, i) => `
            <button class="enc-choice" data-idx="${i}" ${c.disabled ? 'disabled' : ''}>
                <span>${c.text}</span>${c.desc ? `<small>${markRewards(c.desc)}</small>` : ''}
            </button>`).join('')}</div>`;
    }

    /** A broken carrier wave: steady on the left, falling apart to the right. */
    function runSignal(canvas, color) {
        const ctx = canvas.getContext('2d');
        let frame = 0;
        const paint = () => {
            if (!canvas.isConnected) { clearInterval(timer); return; }
            ctx.clearRect(0, 0, SIGNAL_W, SIGNAL_H);
            ctx.fillStyle = color;
            for (let x = 0; x < SIGNAL_W; x += 2) {
                const decay = x / SIGNAL_W;
                if (Math.random() < decay * 0.75) continue;                       // dropouts grow toward the end
                const wave = Math.sin(x * 0.11 + frame * 0.6) * 11 * (1 - decay * 0.5);
                const noise = (Math.random() - 0.5) * 22 * decay;
                ctx.fillRect(x, Math.round(SIGNAL_H / 2 + wave + noise), 2, 2);
            }
            frame++;
        };
        const timer = setInterval(paint, SIGNAL_TICK_MS);
        paint();
    }

    /**
     * @param {object} cfg { tone, kicker, title, facts:[[label, value]], context, dialogue, choices:[{text, desc, disabled}],
     *                       onPick(idx), hasSignal, zIndex }
     */
    function open(app, cfg) {
        const color = cfg.color || TONES[cfg.tone] || TONES.crew;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = String(cfg.zIndex || 2000);
        const facts = (cfg.facts || []).filter(f => f && f[1] != null && f[1] !== '');
        modal.innerHTML = `
            <section class="modal-content deck-panel enc-card" role="dialog" aria-label="${esc(cfg.title)}" style="--enc:${color}">
                <header class="enc-head">
                    <p class="enc-kicker">${esc(cfg.kicker || '')}</p>
                    <h3>${esc(cfg.title)}</h3>
                </header>
                ${cfg.hasSignal ? `<canvas class="enc-signal" width="${SIGNAL_W}" height="${SIGNAL_H}" aria-hidden="true"></canvas>` : ''}
                ${facts.length ? `<dl class="deck-panel-facts">${facts.map(f => `<dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd>`).join('')}</dl>` : ''}
                ${cfg.context ? `<p class="enc-context">${cfg.context}</p>` : ''}
                ${dialogueHtml(app, cfg.dialogue)}
                <h4>YOUR CALL</h4>
                ${choicesHtml(cfg.choices)}
            </section>`;
        document.body.appendChild(modal);
        if (cfg.hasSignal) runSignal(modal.querySelector('.enc-signal'), color);

        let isPicked = false;
        modal.querySelectorAll('.enc-choice:not([disabled])').forEach(btn => {
            btn.onclick = () => {
                if (isPicked) return;
                isPicked = true;
                modal.remove();
                cfg.onPick(parseInt(btn.dataset.idx, 10));
            };
        });
        const first = modal.querySelector('.enc-choice:not([disabled])');
        if (first) first.focus({ preventScroll: true });
        return modal;
    }

    window.EncounterCard = { open, SPEAKER_COLORS };
})();
