/**
 * EncounterCard — one scene style for every "something happened, who says what, what do you do" moment
 * (distress signals, stations, asteroid fields, wrecks, colony ruins, anomalies, campfires, crew moments, ship alerts).
 *
 * Built to be READ, not scanned: never more than ~40 words on screen.
 *   - the scene text is cut to two sentences (the rest sits behind "more")
 *   - the crew speak one line at a time; click / Space / Enter for the next
 *   - choices show a title and reward chips; the full explanation appears for the choice you point at
 *   - one accent colour per card; speakers are told apart by face and name, not by coloured paragraphs
 */
(function () {
    'use strict';

    const SPEAKER_COLORS = {
        'Eng. Jaxon': '#f0a030', 'Dr. Aris': '#40c8ff', 'Spc. Vance': '#ff5050',
        'Tech Mira': '#d070ff', 'A.U.R.A.': '#74d99a'
    };
    const TONES = { distress: '#d85a4e', alert: '#e08a3c', rock: '#d9a24a', station: '#74d99a', crew: '#c8c2b0', story: '#c8c2b0' };
    const SIGNAL_W = 280, SIGNAL_H = 36, SIGNAL_TICK_MS = 125;
    const CONTEXT_SENTENCES = 2, SHORT_HINT_WORDS = 8;
    // "+15 Salvage", "-10% Energy", "+0-2 Stress"
    const REWARD_PATTERN = /([+\-−]\d+(?:-\d+)?%?\s+[A-Z][a-zA-Z]*(?:\s[A-Z][a-zA-Z]*)?)/g;
    const CHANCE_PATTERN = /(\d+%\s+(?:chance|risk))/gi;
    const BAD_WORDS = /stress|damage|injur|risk/i;
    const MARKUP = /\[\/?[a-z]+\]/gi; // NarrativeModal-style [highlight] / [whisper] tags in older event text

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const isLoss = (hit) => (/^[\-−]/.test(hit) ? !BAD_WORDS.test(hit) : BAD_WORDS.test(hit));

    function memberFor(app, speaker) {
        const crew = (app && app.state && app.state.crew) || [];
        const last = String(speaker).split(' ').pop().toLowerCase();
        return crew.find(m => m.name === speaker) || crew.find(m => m.name && m.name.toLowerCase().includes(last)) || null;
    }

    /** The dead do not talk. */
    function livingLines(app, lines) {
        return (lines || []).filter(d => {
            const member = memberFor(app, d.speaker);
            return !member || member.status !== 'DEAD';
        });
    }

    function faceHtml(app, speaker) {
        if (speaker === 'A.U.R.A.') return '<span class="enc-face enc-face-aura">AI</span>';
        const member = memberFor(app, speaker);
        return member && member.portraitId ? `<img class="enc-face" src="assets/crew/${esc(member.portraitId)}.png" alt="">` : '<span class="enc-face"></span>';
    }

    function lineHtml(app, d) {
        const color = SPEAKER_COLORS[d.speaker] || 'var(--bone)';
        return `${faceHtml(app, d.speaker)}<p><b style="color:${color}">${esc(d.speaker)}</b>${d.text}</p>`;
    }

    /** First two sentences up front; anything after that waits behind "more". */
    function splitContext(text) {
        const clean = String(text || '').replace(MARKUP, '').replace(/\s*\n+\s*/g, ' ').trim();
        const sentences = clean.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) || [clean];
        return { lead: sentences.slice(0, CONTEXT_SENTENCES).join('').trim(), rest: sentences.slice(CONTEXT_SENTENCES).join('').trim() };
    }

    /** Colours the numbers inside a description so gains and costs read at a glance. */
    function markRewards(desc) {
        return String(desc || '').replace(REWARD_PATTERN, (hit) => `<b class="${isLoss(hit) ? 'is-loss' : 'is-gain'}">${hit}</b>`);
    }

    /** "+20 Salvage", "30% chance" pulled out of a description as chips; a very short description is kept as a plain hint. */
    function chipsHtml(desc) {
        const text = String(desc || ''), hits = [];
        text.replace(REWARD_PATTERN, (hit) => { hits.push(hit.trim()); return hit; });
        text.replace(CHANCE_PATTERN, (hit) => { hits.push(hit.trim()); return hit; });
        if (hits.length) return `<span class="enc-chips">${hits.map(h => `<i class="${isLoss(h) ? 'is-loss' : 'is-gain'}">${esc(h)}</i>`).join('')}</span>`;
        const first = (text.match(/^[^.!?]+[.!?]?/) || [''])[0].trim();
        return first && first.split(/\s+/).length <= SHORT_HINT_WORDS ? `<span class="enc-chips"><i>${esc(first)}</i></span>` : '';
    }

    /** A choice with a `requires(state)` rule that fails is shown locked, with its `requiresLabel` as the reason. */
    function choicesHtml(app, choices) {
        return choices.map((c, i) => {
            const isLocked = !!c.disabled || (typeof c.requires === 'function' && !c.requires(app.state));
            const chips = isLocked && c.requiresLabel ? `<span class="enc-chips"><i class="is-loss">${esc(c.requiresLabel)}</i></span>` : chipsHtml(c.desc);
            return `<button class="enc-choice" data-idx="${i}" ${isLocked ? 'disabled' : ''}><span>${c.text}</span>${chips}</button>`;
        }).join('');
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

    function cardHtml(cfg, color, context, facts, lineCount) {
        return `
            <section class="modal-content deck-panel enc-card" role="dialog" aria-label="${esc(cfg.title)}" style="--enc:${color}">
                <header class="enc-head">
                    <p class="enc-kicker">${esc(cfg.kicker || '')}${facts.map(f => `<span>${esc(f[0])} ${esc(f[1])}</span>`).join('')}</p>
                    <h3>${esc(String(cfg.title || '').replace(MARKUP, ''))}</h3>
                </header>
                ${cfg.hasSignal ? `<canvas class="enc-signal" width="${SIGNAL_W}" height="${SIGNAL_H}" aria-hidden="true"></canvas>` : ''}
                <div class="enc-stage">
                    ${context.lead ? `<p class="enc-context">${context.lead}${context.rest ? ` <button class="enc-more" type="button">more</button><span class="enc-rest" hidden> ${context.rest}</span>` : ''}</p>` : ''}
                    <div class="enc-line" aria-live="polite"></div>
                </div>
                <footer class="enc-flow">
                    <span class="enc-pips" aria-hidden="true">${'<i></i>'.repeat(lineCount)}</span>
                    <button class="enc-skip" type="button">skip the talk</button>
                    <button class="enc-next" type="button">NEXT ›</button>
                </footer>
                <div class="enc-decide" hidden>
                    <div class="enc-choices"></div>
                    <p class="enc-detail" aria-live="polite"></p>
                </div>
            </section>`;
    }

    /**
     * @param {object} cfg { tone | color, kicker, title, facts:[[label, value]], context, dialogue:[{speaker, text}],
     *                       choices:[{text, desc, disabled, requires, requiresLabel}], onPick(idx), hasSignal, zIndex }
     */
    function open(app, cfg) {
        const color = cfg.color || TONES[cfg.tone] || TONES.crew;
        const lines = livingLines(app, cfg.dialogue), context = splitContext(cfg.context);
        const facts = (cfg.facts || []).filter(f => f && f[1] != null && f[1] !== '');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = String(cfg.zIndex || 2000);
        modal.innerHTML = cardHtml(cfg, color, context, facts, lines.length);
        document.body.appendChild(modal);
        if (cfg.hasSignal) runSignal(modal.querySelector('.enc-signal'), color);

        const el = (sel) => modal.querySelector(sel);
        const lineEl = el('.enc-line'), nextEl = el('.enc-next'), flowEl = el('.enc-flow'), decideEl = el('.enc-decide'), detailEl = el('.enc-detail');
        const pips = [...modal.querySelectorAll('.enc-pips i')];
        let index = -1, isPicked = false;

        function showChoices() {
            flowEl.hidden = true;
            decideEl.hidden = false;
            el('.enc-choices').innerHTML = choicesHtml(app, cfg.choices);
            modal.querySelectorAll('.enc-choice').forEach(btn => {
                const choice = cfg.choices[parseInt(btn.dataset.idx, 10)];
                const explain = () => { detailEl.innerHTML = markRewards(choice.desc); };
                btn.addEventListener('mouseenter', explain);
                btn.addEventListener('focus', explain);
                if (btn.disabled) return;
                btn.addEventListener('click', () => {
                    if (isPicked) return;
                    isPicked = true;
                    modal.remove();
                    cfg.onPick(parseInt(btn.dataset.idx, 10));
                });
            });
            const first = el('.enc-choice:not([disabled])');
            if (first) first.focus({ preventScroll: true });
        }

        function advance() {
            if (index >= lines.length - 1) { showChoices(); return; }
            index += 1;
            lineEl.innerHTML = lineHtml(app, lines[index]);
            lineEl.classList.remove('is-in'); void lineEl.offsetWidth; lineEl.classList.add('is-in'); // restart the entry animation
            pips.forEach((pip, k) => pip.classList.toggle('is-on', k <= index));
            if (index === lines.length - 1) nextEl.textContent = 'DECIDE ›';
        }

        nextEl.addEventListener('click', advance);
        el('.enc-skip').addEventListener('click', () => { index = lines.length - 1; if (lines.length) lineEl.innerHTML = lineHtml(app, lines[index]); showChoices(); });
        el('.enc-stage').addEventListener('click', (e) => { if (!e.target.closest('.enc-more') && decideEl.hidden) advance(); });
        const moreEl = el('.enc-more');
        if (moreEl) moreEl.addEventListener('click', () => { el('.enc-rest').hidden = false; moreEl.remove(); });

        if (lines.length <= 1) { if (lines.length) { index = 0; lineEl.innerHTML = lineHtml(app, lines[0]); } showChoices(); }
        else { advance(); nextEl.focus({ preventScroll: true }); }
        return modal;
    }

    window.EncounterCard = { open, SPEAKER_COLORS };
})();
