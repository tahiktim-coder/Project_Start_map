/**
 * EncounterCard — one scene style for every "something happened, who says what, what do you do" moment
 * (distress signals, stations, asteroid fields, wrecks, colony ruins, anomalies, campfires, crew moments, ship alerts).
 *
 * Built to be READ, not scanned: never more than ~40 words on screen.
 *   - the scene text is cut to two sentences (the rest sits behind "more")
 *   - the crew speak one line at a time; click / Space / Enter for the next
 *   - choices show a title and reward chips (the branch that applies now, each chip once); pointing at one adds only what the chips do not say
 *   - a gain of energy or rations shows what fits now (energy tops out at 100), and apply() makes the result line say it too
 *   - one accent colour per card; speakers are told apart by face and name, not by coloured paragraphs
 */
(function () {
    'use strict';

    const SPEAKER_COLORS = {
        'Jaxon': '#f0a030', 'Aris': '#40c8ff', 'Vance': '#ff5050',
        'Mira': '#d070ff', 'A.U.R.A.': '#74d99a'
    };
    const TONES = { distress: '#d85a4e', alert: '#e08a3c', rock: '#d9a24a', station: '#74d99a', crew: '#c8c2b0', story: '#c8c2b0' };
    const SIGNAL_W = 280, SIGNAL_H = 36, SIGNAL_TICK_MS = 125;
    const CONTEXT_SENTENCES = 2, SHORT_HINT_WORDS = 8, CARD_FLOOR_PX = 16;
    const CHOICE_ROOM_SLACK_PX = 24;  // room planned under NEXT for the guard's gap, so the choices open below the cursor
    const TALK_HOLD_MS = 1000;        // NEXT under the last click and no room to move the card: it ignores clicks this long
    // "+15 Salvage", "-10% Energy", "+0-2 Stress", "Vance +1 Stress", "All crew -1 Stress"
    const REWARD_PATTERN = /((?:\b(?:All crew|Jaxon|Aris|Vance|Mira) )?[+\-−]\d+(?:-\d+)?%?\s+[A-Z][a-zA-Z]*(?:\s[A-Z][a-zA-Z]*)?)/g;
    const CHANCE_PATTERN = /(\d+%\s+(?:chance|risk))/gi;
    const BAD_WORDS = /stress|damage|injur|risk/i;
    const RISKY = /hurt|injured|damag|\blost\b|is gone|walks through|changed by|Stress 3|\+\d+ Stress|strike|gas pocket|discharge/i; // what a bad chance leads to
    const MARKUP = /\[\/?[a-z]+\]/gi; // NarrativeModal-style [highlight] / [whisper] tags in older event text
    const DRAIN_MS = 300;             // the new look: what waited behind an outcome card comes one at a time, this often
    const DETAIL_MIN_WORDS = 3;       // a sentence that is only its chips ("-5 Energy.", "All crew +1 Stress.") is not repeated under the list

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    /** The sign of the number decides: a cost is a loss, more stress or damage is a loss, less of it is a gain. */
    function isLoss(hit) {
        const sign = (String(hit).match(/[+\-−](?=\d)/) || [''])[0];
        return sign === '-' || sign === '−' ? !BAD_WORDS.test(hit) : BAD_WORDS.test(hit);
    }

    // ── what a choice really gives: energy tops out at 100, rations at the store's size (state.maxRations) ──
    const STOCKS = [
        { key: 'energy', re: /(^|[^\d.])([+\-−])(\d+)(\s+Energy)\b/g, top: () => 100, full: 'Energy already full' },
        { key: 'rations', re: /(^|[^\d.])([+\-−])(\d+)(\s+Rations?)\b/g, top: s => Number(s.maxRations), full: 'Rations already full' },
    ];
    const stockOf = (state, key) => Math.round(Number(state[key]) || 0);
    // The new look (?new=1): no single choice gives more energy than NEW_LOOK_ECONOMY.CARD_ENERGY_MAX (bundle.js), and sealed
    // rations are opened at once (FOOD_PACK_RATIONS each); the chips and the result line say so. The default game: neither.
    const newLook = () => (window.NEW_SCREEN && window.NewScreen && window.NSRoute && window.NEW_LOOK_ECONOMY) || null;   // bundle.js isNewScreen()'s own test
    const ENERGY_RANGED = /(^|[^\d.])([+\-−])(\d+)(?:-(\d+))?(\s+Energy)\b/g;   // the new look also cuts a range ("+50-70 Energy")
    const PACKS = /\+(\d+) Sealed Rations\b/g;
    /** How high a choice's gain may take a stock that stands at `start`: its own top, and in the new look no more than
        CARD_ENERGY_MAX of energy above where it started. */
    function topOf(st, state, start) {
        const top = st.top(state), look = newLook();
        return st.key === 'energy' && look ? Math.min(top, start + look.CARD_ENERGY_MAX) : top;
    }
    /**
     * A text's own energy (or rations) numbers replayed in order from `start`: a cost first leaves room for a gain after
     * it, and a gain is cut to what fits under the top ("+25 Energy" with room for 5 reads "+5 Energy"; with no room, the
     * stock's "already full"). Returns { text, end, cut }. Ranges ("+25-45") and percentages are left alone (the new look
     * cuts an energy range too, by its highest number).
     */
    function fitStock(text, stock, start, top) {
        let v = start, cut = false;
        const ranged = stock.key === 'energy' && !!newLook();
        const out = String(text).replace(ranged ? ENERGY_RANGED : stock.re, (m, pre, sign, n, ...rest) => {
            const unit = ranged ? rest[1] : rest[0], k = parseInt((ranged && rest[0]) || n, 10);
            if (sign !== '+') { v = Math.max(0, v - k); return m; }
            const got = Math.max(0, Math.min(k, top - v));
            v += got;
            if (got === k) return m;
            cut = true;
            return pre + (got > 0 ? `+${got}${got === 1 ? unit.replace(/Rations$/, 'Ration') : unit}` : stock.full);
        });
        return { text: out, end: v, cut };
    }
    /** A choice's words as they stand now: a gain of energy or rations says what fits (a card never promises more). */
    function capGains(desc, state) {
        if (!state || !desc) return desc;
        const look = newLook(), text = look ? String(desc).replace(PACKS, (m, n) => `+${Number(n) * look.FOOD_PACK_RATIONS} Rations`) : String(desc);
        return STOCKS.reduce((out, st) => {
            const start = stockOf(state, st.key), top = topOf(st, state, start);
            return Number.isFinite(top) ? fitStock(out, st, start, top).text : out;
        }, text);
    }
    /**
     * Runs a choice's effect (choice.effect(state, ...args)) and returns its result line as it really went: a gain of
     * energy or rations that hit the top is said as what fitted. The words change only when replaying the line's own numbers
     * from the ship's numbers before lands where the ship is now; otherwise the line is left as the effect wrote it.
     */
    function apply(choice, state, ...args) {
        const before = STOCKS.map(st => stockOf(state, st.key)), tops = STOCKS.map((st, i) => topOf(st, state, before[i]));
        const look = newLook();
        let text = choice.effect(state, ...args);
        if (look) {
            STOCKS.forEach((st, i) => { if (st.key === 'energy' && Number(state.energy) > tops[i]) state.energy = tops[i]; });
            if (typeof state.openFoodPacks === 'function') state.openFoodPacks(true);           // opened now, so the line below says what fitted
            if (typeof text === 'string') text = text.replace(PACKS, (m, n) => `+${Number(n) * look.FOOD_PACK_RATIONS} Rations`);
        }
        if (typeof text !== 'string' || !text) return text;
        return STOCKS.reduce((out, st, i) => {
            const top = tops[i];
            if (!Number.isFinite(top)) return out;
            const r = fitStock(out, st, before[i], top);
            return r.cut && r.end === stockOf(state, st.key) ? r.text : out;
        }, text);
    }

    /** What a choice will do now: a choice whose result depends on the ship's state words itself with descNow(state).
        Either way its gains say what fits now (capGains). */
    function descOf(choice, state) {
        let text = String((choice && choice.desc) || '');
        if (choice && typeof choice.descNow === 'function') {
            try { text = String(choice.descNow(state) || ''); } catch (e) { console.error('EncounterCard: descNow failed', e); }
        }
        return capGains(text, state);
    }

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

    /** The speaker as the crew list names them: an old titled label ("Tech Mira") still shows the first name. */
    function lineHtml(app, d) {
        const member = d.speaker === 'A.U.R.A.' ? null : memberFor(app, d.speaker);
        const name = (member && member.name) || d.speaker;
        const color = SPEAKER_COLORS[name] || 'var(--bone)';
        return `${faceHtml(app, d.speaker)}<p><b style="color:${color}">${esc(name)}</b>${d.text}</p>`;
    }

    /** First two sentences up front; anything after that waits behind "more". */
    function splitContext(text) {
        const AI_NAME = /A\.U\.R\.A\./g, HOLD = '\u0001';                          // her name has dots in it: keep it whole while splitting sentences
        const clean = String(text || '').replace(MARKUP, '').replace(/\s*\n+\s*/g, ' ').trim().replace(AI_NAME, HOLD);
        const sentences = (clean.match(/[^.!?…]+[.!?…]+["')\]]*\s*|[^.!?…]+$/g) || [clean]).map(part => part.split(HOLD).join('A.U.R.A.'));
        return { lead: sentences.slice(0, CONTEXT_SENTENCES).join('').trim(), rest: sentences.slice(CONTEXT_SENTENCES).join('').trim() };
    }

    /** Colours the numbers inside a description so gains and costs read at a glance. */
    function markRewards(desc) {
        return String(desc || '').replace(REWARD_PATTERN, (hit) => `<b class="${isLoss(hit) ? 'is-loss' : 'is-gain'}">${hit}</b>`);
    }

    const sentencesOf = desc => String(desc || '').replace(MARKUP, '').split(/(?<=[.!?])(?<!A\.U\.R\.A\.)\s+/).map(x => x.trim()).filter(Boolean);
    const hasNumbers = sentence => new RegExp(REWARD_PATTERN.source).test(sentence) || new RegExp(CHANCE_PATTERN.source, 'i').test(sentence);
    const wordsOutsideChips = sentence => sentence.replace(REWARD_PATTERN, ' ').replace(CHANCE_PATTERN, ' ').replace(/[^A-Za-z' ]+/g, ' ').split(/\s+/).filter(Boolean);

    /**
     * Chips for a description, each one once: "+20 Salvage", "30% risk" (only a chance of something going wrong is a chip;
     * a good chance, "40% chance: all planets revealed", is left to the line under the list). A short sentence is a plain chip when it is all there is ("No cost.") or when
     * the numbers are only costs, so a choice never shows a price without what it buys ("Heals one injured crew member.").
     * Returns [{text, plain}].
     */
    function chipsOf(desc) {
        const text = String(desc || ''), hits = [];
        text.replace(REWARD_PATTERN, (hit) => { hits.push(hit.trim()); return hit; });
        const chances = [...text.matchAll(CHANCE_PATTERN)];                  // a chance is a risk only when what it leads to is bad
        chances.forEach((m, k) => {
            const rest = text.slice(m.index, k + 1 < chances.length ? chances[k + 1].index : undefined);
            const clause = rest.slice(0, (rest.search(/[.!?](\s|$)/) + 1) || undefined);   // up to the end of its sentence
            const isOnlyLoss = /[\-−]\d/.test(clause) && !/\+\d/.test(clause);              // "30% chance of -15 Energy"
            if (/risk$/i.test(m[0]) || RISKY.test(clause) || isOnlyLoss) hits.push(m[0].trim().replace(/chance$/i, 'risk'));
        });
        const once = hits.filter((h, k) => hits.findIndex(o => o.toLowerCase() === h.toLowerCase()) === k).map(h => ({ text: h, plain: false }));
        const isShort = x => x.split(/\s+/).length <= SHORT_HINT_WORDS;
        if (!once.length) {
            const first = sentencesOf(text)[0] || '';
            return first && isShort(first) ? [{ text: first, plain: true }] : [];
        }
        if (once.every(c => isLoss(c.text))) {
            const says = sentencesOf(text).find(x => !hasNumbers(x) && isShort(x));
            if (says) once.push({ text: says, plain: true });
        }
        return once;
    }

    function chipsHtml(desc) {
        const chips = chipsOf(desc);
        if (!chips.length) return '';
        return `<span class="enc-chips">${chips.map(c => `<i${c.plain ? '' : ` class="${isLoss(c.text) ? 'is-loss' : 'is-gain'}"`}>${esc(c.text)}</i>`).join('')}</span>`;
    }

    /**
     * The part of a description the chips do not already say, for the choice the player points at.
     * Sentences that are only numbers ("-5 Energy.", "All crew +1 Stress.") or already a chip are left out.
     */
    function detailOf(desc) {
        const chips = chipsOf(desc), plain = chips.filter(c => c.plain).map(c => c.text);
        const isUnsaidChance = x => (x.match(CHANCE_PATTERN) || []).some(h => !chips.some(c => c.text.toLowerCase() === h.replace(/chance$/i, 'risk').toLowerCase()));  // "60% chance: +30 Salvage."
        return sentencesOf(desc).filter(x => !plain.includes(x) && (wordsOutsideChips(x).length >= DETAIL_MIN_WORDS || isUnsaidChance(x))).join(' ');
    }

    /** A choice with a `requires(state)` rule that fails is shown locked, with its `requiresLabel` as the reason. */
    function choicesHtml(app, choices, descs) {
        return choices.map((c, i) => {
            const isLocked = !!c.disabled || (typeof c.requires === 'function' && !c.requires(app.state));
            const chips = isLocked && c.requiresLabel ? `<span class="enc-chips"><i class="is-loss">${esc(c.requiresLabel)}</i></span>` : chipsHtml(descs[i]);
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

    /** A picture for this scene (SceneArt.js), when there is one: the strange places, the graves, the dome. */
    const hasArt = cfg => !!(cfg.art && window.SceneArt && window.SceneArt.has(cfg.art));

    function cardHtml(cfg, color, context, facts, lineCount) {
        return `
            <section class="modal-content deck-panel enc-card" role="dialog" aria-label="${esc(cfg.title)}" style="--enc:${color}">
                <header class="enc-head">
                    <p class="enc-kicker">${esc(cfg.kicker || '')}${facts.map(f => `<span>${esc(f[0])} ${esc(f[1])}</span>`).join('')}</p>
                    <h3>${esc(String(cfg.title || '').replace(MARKUP, ''))}</h3>
                </header>
                ${cfg.hasSignal ? `<canvas class="enc-signal" width="${SIGNAL_W}" height="${SIGNAL_H}" aria-hidden="true"></canvas>` : ''}
                ${hasArt(cfg) ? `<canvas class="enc-art" width="${window.SceneArt.W}" height="${window.SceneArt.H}" aria-hidden="true"></canvas>` : ''}
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

    // ── the new look: what a choice did is shown on its own card before anything else can open ──
    // The game writes a choice's result to the log, which the new look does not show, so a player saw nothing happen, or the
    // next card (a crew moment) straight away. Now the card stays: the choice's own log lines take the choices' place, with
    // CONTINUE. Until then a new card, a found page or a mini-game waits its turn (whenFree).
    const gate = { held: 0, waiting: [], passing: false };
    let capturing = 0;
    const mustWait = () => !gate.passing && (gate.held > 0 || gate.waiting.length > 0);   // in order: behind anything already waiting
    function whenFree(fn) { if (mustWait()) gate.waiting.push(fn); else fn(); }
    function releaseGate() { gate.held = Math.max(0, gate.held - 1); drain(); }
    /** What waited comes one at a time: the next only once nothing is on screen. */
    function drain() {
        if (gate.held || !gate.waiting.length) return;
        if (document.querySelector('.modal-overlay')) { setTimeout(drain, DRAIN_MS); return; }
        const fn = gate.waiting.shift();
        gate.passing = true;
        try { fn(); } catch (err) { console.error('EncounterCard: a card that waited could not open', err); } finally { gate.passing = false; }
        if (gate.waiting.length) setTimeout(drain, DRAIN_MS);
    }
    /** Runs a choice and returns every line it wrote to the log on the way (the voice stays quiet meanwhile: the card says it). */
    function captureLog(run) {
        const said = [], hear = e => { const m = e && e.detail && e.detail.message; if (m) said.push(String(m)); };
        addEventListener('log-updated', hear);
        capturing += 1;
        try { run(); } finally { capturing -= 1; removeEventListener('log-updated', hear); }
        return said;
    }
    const OUT_SKIP = /^(?:={2,}|\/{2,}|⚠|☠|ERROR\b|WARNING\b|STORAGE WARNING\b|Now entering\b|SOMETHING STRANGE\b|Deploying\b|\[[^\]]*\]$)/i;
    const OUT_PREFIX = /^(?:CREW|MINING|STATION|SIGNAL|SCAN|PROBE|MALFUNCTION RESOLVED|REPAIR COMPLETE|FABRICATION COMPLETE):\s*/;
    const OUT_SPEAKER = /^(A\.U\.R\.A\.|Jaxon|Aris|Vance|Mira|Cora)\s*:\s*(.+)$/;
    const OUT_MAX = 4;
    const unquote = s => { const t = s.trim(), m = /^["“'‘](.*)["”'’]$/.exec(t); return m && !/["“”]/.test(m[1]) ? m[1] : t; };
    /** The lines worth showing from what a choice logged: speech and what happened, no system banners, each once, at most four
        (the first few and the last, which is usually the tally). */
    function outcomeLines(said) {
        const out = [], seen = new Set();
        said.forEach(raw => {
            const m = String(raw || '').replace(MARKUP, '').replace(/\s+/g, ' ').trim().replace(OUT_PREFIX, '');
            if (!m || OUT_SKIP.test(m)) return;
            const sp = OUT_SPEAKER.exec(m), item = sp ? { speaker: sp[1], text: unquote(sp[2]) } : { text: m };
            const key = item.text.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key); out.push(item);
        });
        return out.length > OUT_MAX ? out.slice(0, OUT_MAX - 1).concat(out[out.length - 1]) : out;
    }

    const ALARM = /^(?:⚠\s*)?(?:WARNING|INCIDENT|CRITICAL|CATASTROPHE|FATAL|KIA|PREDATOR ALERT):\s*/i;   // the team card's result lines: the alarm word goes, the news stays
    /**
     * The new look, for a panel that is not an EncounterCard (the team-on-the-ground card, bundle.js showEventModal): runs the
     * choice (run), then shows what it did in place of the panel's choices, in showOutcome's look, then CONTINUE (done: close
     * the panel). Nothing else opens meanwhile. With nothing to show, or the panel gone, it closes at once.
     */
    function outcomeIn(app, panel, picked, run, done) {
        gate.held += 1;
        let said = [];
        try { said = captureLog(run); } catch (err) { console.error('EncounterCard: the choice failed', err); }
        const lines = outcomeLines(said.map(m => String(m || '').replace(ALARM, '').replace(/^\w/, c => c.toUpperCase())));
        let isDone = false;
        const finish = () => { if (isDone) return; isDone = true; try { done(); } catch (err) { console.error('EncounterCard: closing the panel failed', err); } releaseGate(); };
        if (!lines.length || !panel || !panel.isConnected) { finish(); return; }
        const pick = String(picked || '').replace(/<[^>]*>/g, '').replace(MARKUP, '');
        [...panel.children].forEach(el => { if (!el.matches('header, .eva-team, .eva-found')) el.style.display = 'none'; });   // the choices give way to what happened
        const box = document.createElement('div');
        box.className = 'enc-decide eva-outcome';
        box.innerHTML = `
            <div class="enc-outcome" aria-live="polite">
                <p class="enc-outcome-pick">${esc(pick)}</p>
                ${lines.map(l => (l.speaker ? `<div class="enc-line enc-outcome-say is-in">${lineHtml(app, { speaker: l.speaker, text: markRewards(esc(l.text)) })}</div>` : `<p class="enc-outcome-line">${markRewards(esc(l.text))}</p>`)).join('')}
            </div>
            <footer class="enc-flow enc-outcome-flow"><button class="enc-next enc-outcome-go" type="button">CONTINUE ›</button></footer>`;
        panel.appendChild(box);
        const go = box.querySelector('.enc-outcome-go'), guard = window.ChoiceGuard;
        if (guard && typeof guard.keepOffClick === 'function') guard.keepOffClick(panel, [go]);   // the click that chose never lands on CONTINUE
        go.addEventListener('click', finish);
        box.tabIndex = -1;
        box.focus({ preventScroll: true });
    }

    /**
     * @param {object} cfg { tone | color, kicker, title, facts:[[label, value]], context, dialogue:[{speaker, text}],
     *                       choices:[{text, desc, descNow(state), disabled, requires, requiresLabel}], onPick(idx), hasSignal, art, zIndex }
     */
    function open(app, cfg) {
        if (newLook() && mustWait()) { gate.waiting.push(() => open(app, cfg)); return null; }   // the last choice's outcome is still up
        const color = cfg.color || TONES[cfg.tone] || TONES.crew;
        const lines = livingLines(app, cfg.dialogue), context = splitContext(cfg.context);
        const facts = (cfg.facts || []).filter(f => f && f[1] != null && f[1] !== '');
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = String(cfg.zIndex || 2000);
        modal.innerHTML = cardHtml(cfg, color, context, facts, lines.length);
        document.body.appendChild(modal);
        if (cfg.hasSignal) runSignal(modal.querySelector('.enc-signal'), color);
        if (hasArt(cfg)) window.SceneArt.mount(modal.querySelector('.enc-art'), cfg.art);

        const el = (sel) => modal.querySelector(sel);
        const lineEl = el('.enc-line'), nextEl = el('.enc-next'), flowEl = el('.enc-flow'), decideEl = el('.enc-decide'), detailEl = el('.enc-detail');
        const pips = [...modal.querySelectorAll('.enc-pips i')];
        let index = -1, isPicked = false;
        const descs = cfg.choices.map(c => descOf(c, app && app.state));          // the branch that applies now, read when the card opens
        const details = descs.map(detailOf);
        // the note under the list names the choice it belongs to, so it never reads as one more choice
        const detailHtml = i => details[i] ? `<b class="enc-detail-of">${esc(String(cfg.choices[i].text || '').replace(/<[^>]*>/g, '').replace(MARKUP, ''))}</b> ${markRewards(details[i])}` : '';

        function showChoices(isOpening = false) {
            const guard = window.ChoiceGuard;
            const wasTalking = !isOpening && !flowEl.hidden && flowEl.getClientRects().length > 0;   // a card opened straight on its choices never showed NEXT
            // Never under the cursor: remember where NEXT, skip and the last press were before the choices appear.
            const avoid = guard ? [wasTalking ? guard.boxOf(nextEl, 6) : null, wasTalking ? guard.boxOf(el('.enc-skip'), 6) : null, guard.lastClickBox()] : [];
            const top0 = wasTalking ? el('.enc-card').getBoundingClientRect().top : null;   // null: nothing was on screen yet, centre the whole card
            flowEl.hidden = true;                                                   // the choices open in the flow, below the last line
            el('.enc-card').classList.add('is-deciding');
            decideEl.hidden = false;
            const choiceEls = [...modal.querySelectorAll('.enc-choice')];
            if (guard) {
                placeCard(guard, top0, choiceEls, avoid);
                guard.hold(decideEl);
            }
            choiceEls.forEach(btn => {
                const idx = parseInt(btn.dataset.idx, 10);
                if (details.some(Boolean)) {
                    const explain = () => { detailEl.innerHTML = detailHtml(idx); };
                    btn.addEventListener('mouseenter', explain);
                    btn.addEventListener('focus', explain);
                }
                if (btn.disabled) return;
                btn.addEventListener('click', () => {
                    if (isPicked) return;
                    isPicked = true;
                    const pick = parseInt(btn.dataset.idx, 10);
                    if (!newLook()) { modal.remove(); cfg.onPick(pick); return; }
                    gate.held += 1;                                                  // nothing else opens until the outcome is read
                    let said = [];
                    try { said = captureLog(() => cfg.onPick(pick)); } catch (err) { console.error('EncounterCard: the choice failed', err); }
                    const lines = outcomeLines(said);
                    if (!lines.length || !modal.isConnected) { modal.remove(); releaseGate(); return; }
                    showOutcome(cfg.choices[pick], lines);
                });
            });
            // Focus the choice list, not a choice: Enter pressed again after NEXT must not pick one unread. Tab reaches them.
            decideEl.tabIndex = -1;
            decideEl.focus({ preventScroll: true });
        }

        /** The choices are built once, when the card opens, so the card can make room for them before the talk starts. */
        function renderChoices() {
            el('.enc-choices').innerHTML = choicesHtml(app, cfg.choices, descs);
            reserveDetail(details.map((d, i) => detailHtml(i)));
        }

        /** The new look: the choice's outcome takes the choices' place (what was chosen, what happened, CONTINUE). Then the card
            goes, and whatever waited (a card, a page, a mini-game, a crew moment) can come. */
        function showOutcome(choice, outcome) {
            const card = el('.enc-card'), stage = el('.enc-stage');
            if (stage) stage.hidden = true;                                   // the talk is over: the outcome is what is read now
            card.classList.add('is-outcome');
            const picked = String((choice && choice.text) || '').replace(/<[^>]*>/g, '').replace(MARKUP, '');
            const said = l => markRewards(esc(l.text));
            decideEl.innerHTML = `
                <div class="enc-outcome" aria-live="polite">
                    <p class="enc-outcome-pick">${esc(picked)}</p>
                    ${outcome.map(l => (l.speaker ? `<div class="enc-line enc-outcome-say is-in">${lineHtml(app, { speaker: l.speaker, text: said(l) })}</div>` : `<p class="enc-outcome-line">${said(l)}</p>`)).join('')}
                </div>
                <footer class="enc-flow enc-outcome-flow"><button class="enc-next enc-outcome-go" type="button">CONTINUE ›</button></footer>`;
            decideEl.hidden = false;
            decideEl.style.marginTop = '';
            card.style.maxHeight = 'none';
            card.style.marginTop = `${Math.max(CARD_FLOOR_PX, Math.round((window.innerHeight - card.offsetHeight) / 2))}px`;
            const go = decideEl.querySelector('.enc-outcome-go'), guard = window.ChoiceGuard;
            if (guard && typeof guard.keepOffClick === 'function') guard.keepOffClick(card, [go]);   // the click that chose never lands on CONTINUE
            let isDone = false;
            go.addEventListener('click', () => { if (isDone) return; isDone = true; modal.remove(); releaseGate(); });
            decideEl.tabIndex = -1;
            decideEl.focus({ preventScroll: true });
        }

        /**
         * While the crew talk, the card sits where the whole card, choices included, will fit: when the choices open below
         * NEXT, the talk does not move and nothing needs to scroll. (Measured with the list shown for one layout, never painted.)
         */
        function planTalkTop() {
            const card = el('.enc-card'), viewH = window.innerHeight;
            decideEl.hidden = false;
            const decideH = decideEl.offsetHeight + (parseFloat(getComputedStyle(decideEl).marginTop) || 0);
            decideEl.hidden = true;
            const plannedH = card.offsetHeight + decideH + CHOICE_ROOM_SLACK_PX;
            modal.style.alignItems = 'flex-start';
            card.style.marginTop = `${Math.max(CARD_FLOOR_PX, Math.round((viewH - plannedH) / 2))}px`;
        }

        /**
         * The line under the list says only what the chips do not. When no choice has more to say it is gone;
         * otherwise it keeps the height of the longest one, so pointing at a choice never changes the card's size.
         */
        function reserveDetail(htmls) {
            detailEl.hidden = !htmls.some(Boolean);
            detailEl.style.minHeight = '';
            if (detailEl.hidden) return;
            const tallest = Math.max(...htmls.map(html => { detailEl.innerHTML = html; return detailEl.offsetHeight; }));
            detailEl.innerHTML = '';
            detailEl.style.minHeight = `${tallest}px`;
        }

        /**
         * Puts the card where its choices sit in the normal flow below the talk, clear of NEXT, skip and the last click,
         * with no scrolling (ChoiceGuard.place). The talk stays where it was when it can; when the choices would open under
         * the cursor, space opens between the talk and the choices, or the whole card moves. Nothing is ever drawn over the talk.
         */
        function placeCard(guard, top0, choiceEls, avoid) {
            const card = el('.enc-card'), viewH = window.innerHeight;
            modal.style.alignItems = 'flex-start';
            card.style.maxHeight = 'none';
            card.style.marginTop = '0px';
            decideEl.style.marginTop = '';
            const transform = getComputedStyle(decideEl).transform;
            const slide = transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0;   // the list's entry animation starts a few px low
            const cardTop = card.getBoundingClientRect().top + slide;
            const items = choiceEls.filter(b => b.getClientRects().length).map(b => {
                const r = b.getBoundingClientRect();
                return { top: r.top - cardTop, bottom: r.bottom - cardTop, left: r.left, right: r.right };
            });
            const height = card.offsetHeight;
            const spot = guard.place({ top0: top0 == null ? (viewH - height) / 2 : top0, height, items, boxes: avoid, floor: CARD_FLOOR_PX, viewH });
            card.style.marginTop = `${spot.top}px`;
            card.style.maxHeight = `${Math.max(0, viewH - spot.top - CARD_FLOOR_PX)}px`;
            if (spot.gap) decideEl.style.marginTop = `${(parseFloat(getComputedStyle(decideEl).marginTop) || 0) + spot.gap}px`;
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

        /** The card often opens just after a click (a choice, a page put away): NEXT and skip never sit under it, so the second
            click of a double click cannot skip a line (the choices keep clear of it in showChoices). */
        function keepTalkOffClick() {
            const guard = window.ChoiceGuard, card = el('.enc-card');
            if (!guard || typeof guard.offClick !== 'function') return;
            const d = guard.offClick(card, [nextEl, el('.enc-skip')]);
            if (d) card.style.marginTop = `${(parseFloat(card.style.marginTop) || 0) + d}px`;
            else if (d === null) guard.hold(modal, TALK_HOLD_MS);
        }

        decideEl.hidden = false;
        renderChoices();
        decideEl.hidden = true;
        if (lines.length <= 1) { if (lines.length) { index = 0; lineEl.innerHTML = lineHtml(app, lines[0]); } showChoices(true); }
        else { advance(); planTalkTop(); keepTalkOffClick(); nextEl.focus({ preventScroll: true }); }
        return modal;
    }

    window.EncounterCard = { open, outcomeIn, SPEAKER_COLORS, descOf, chipsOf, detailOf, capGains, apply, whenFree, capturing: () => capturing > 0 };
})();
