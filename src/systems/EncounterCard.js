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
    const DEFERRED = /^\s+(?:saved\b|on every\b|on each\b|every\b|per\b)/;   // "+4 Energy saved on the next jump", "-5 Energy on every jump": paid later

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    /** The sign of the number decides: a cost is a loss, more stress or damage is a loss, less of it is a gain. */
    function isLoss(hit) {
        const sign = (String(hit).match(/[+\-−](?=\d)/) || [''])[0];
        return sign === '-' || sign === '−' ? !BAD_WORDS.test(hit) : BAD_WORDS.test(hit);
    }

    // ── what a choice really gives: energy tops out at 100, rations at the store's size (state.maxRations), and in the new
    //    look salvage at the hold's (state.maxSalvage). cap: the new look's most one choice may give (NEW_LOOK_ECONOMY).
    //    Costs: the new look's most one choice may cost of energy or rations (NEW_LOOK_ECONOMY.CARD_COST_CAP), and its chips
    //    and result line say what it really costs; salvage costs are trades (a station's parts, a repair) and stay as they
    //    are, and so does a choice marked fullCost (a cost paid later by another rule, "-5 Energy on every jump"; a ship
    //    fault, which is no card choice: App.showShipMalfunctionModal). The default game never cuts a cost ──
    const STOCKS = [
        { key: 'energy', re: /(^|[^\d.])([+\-−])(\d+)(\s+Energy)\b/g, ranged: /(^|[^\d.])([+\-−])(\d+)(?:-(\d+))?(\s+Energy)\b/g,
            top: () => 100, full: 'Energy already full', cap: 'CARD_ENERGY_MAX' },
        { key: 'rations', re: /(^|[^\d.])([+\-−])(\d+)(\s+Rations?)\b/g, ranged: /(^|[^\d.])([+\-−])(\d+)(?:-(\d+))?(\s+Rations?)\b/g,
            top: s => Number(s.maxRations), full: 'Rations already full', cap: 'CARD_RATIONS_MAX' },
        { key: 'salvage', re: /(^|[^\d.])([+\-−])(\d+)(\s+Salvage)\b/g, ranged: /(^|[^\d.])([+\-−])(\d+)(?:-(\d+))?(\s+Salvage)\b/g,
            top: s => Number(s.maxSalvage), full: 'Salvage already full', cap: 'CARD_SALVAGE_MAX', newOnly: true },   // DRAFT: "Salvage already full" (the new look)
    ];
    const stockOf = (state, key) => Math.round(Number(state[key]) || 0);
    // The new look (?new=1): no single choice gives more energy, rations or salvage than NEW_LOOK_ECONOMY's CARD_ENERGY_MAX,
    // CARD_RATIONS_MAX and CARD_SALVAGE_MAX (bundle.js), and sealed rations are opened at once (FOOD_PACK_RATIONS each, and
    // counted toward the rations cap); the chips and the result line say so. The default game: none of it.
    const newLook = () => (window.NEW_SCREEN && window.NewScreen && window.NSRoute && window.NEW_LOOK_ECONOMY) || null;   // bundle.js isNewScreen()'s own test
    const stocksNow = () => (newLook() ? STOCKS : STOCKS.filter(st => !st.newOnly));
    const PACKS = /\+(\d+) Sealed Rations\b/g;
    /** Sealed rations as the new look opens them (FOOD_PACK_RATIONS each): "+2 Sealed Rations" reads "+2 Rations" (one: "+1 Ration"). */
    const opened = (look, text) => String(text).replace(PACKS, (m, n) => { const k = Number(n) * look.FOOD_PACK_RATIONS; return `+${k} ${k === 1 ? 'Ration' : 'Rations'}`; });
    /** The most one choice may cost of a stock: the new look's NEW_LOOK_ECONOMY.CARD_COST_CAP for it (energy, rations), else
        no limit (the default game; salvage; a choice marked fullCost). */
    function costCapOf(st, choice) {
        if (choice && choice.fullCost) return Infinity;
        const look = newLook(), caps = look && look.CARD_COST_CAP, v = caps ? Number(caps[st.key]) : NaN;
        return Number.isFinite(v) && v >= 0 ? v : Infinity;
    }
    /** How high a choice's gain may take a stock that stands at `start`: its own top, and in the new look no more than its
        cap above where it started. */
    function topOf(st, state, start) {
        const top = st.top(state), look = newLook(), cap = look ? Number(look[st.cap]) : NaN;
        return cap > 0 ? Math.min(Number.isFinite(top) ? top : Infinity, start + cap) : top;   // no store size known: the cap alone
    }
    /**
     * A text's own energy, rations or salvage numbers replayed in order from `start`: a cost first leaves room for a gain
     * after it, and a gain is cut to what fits under the top ("+25 Energy" with room for 5 reads "+5 Energy"; with no room,
     * the stock's "already full"). Returns { text, end, cut }. Ranges ("+25-45") and percentages are left alone (the new
     * look cuts a range too, by its highest number). costCap (the new look, costCapOf): each cost says no more than it, as
     * apply() holds it (with an energy cap of 4, "-15 Energy" reads "-4 Energy" and "-3-10 Energy" reads "-3-4 Energy").
     */
    function fitStock(text, stock, start, top, costCap = Infinity) {
        let v = start, cut = false;
        const ranged = !!newLook();
        const out = String(text).replace(ranged ? stock.ranged : stock.re, (m, pre, sign, n, ...rest) => {
            const unit = ranged ? rest[1] : rest[0], k = parseInt((ranged && rest[0]) || n, 10);
            if (ranged && sign === '+' && DEFERRED.test(rest[rest.length - 1].slice(rest[rest.length - 2] + m.length))) return m;   // the new look: "+4 Energy saved on the next jump" is no gain now
            if (sign !== '+') {
                const lose = Math.min(k, costCap), lo = Math.min(parseInt(n, 10), lose);
                v = Math.max(0, v - lose);
                if (lose === k) return m;
                cut = true;
                return `${pre}-${lo < lose ? `${lo}-` : ''}${lose}${lose === 1 ? unit.replace(/Rations$/, 'Ration') : unit}`;
            }
            const got = Math.max(0, Math.min(k, top - v));
            v += got;
            if (got === k) return m;
            cut = true;
            return pre + (got > 0 ? `+${got}${got === 1 ? unit.replace(/Rations$/, 'Ration') : unit}` : stock.full);
        });
        return { text: out, end: v, cut };
    }
    /** A choice's words as they stand now: a gain of energy or rations (the new look: salvage too) says what fits (a card
        never promises more), and a cost what it really costs (choice: its fullCost, costCapOf). */
    function capGains(desc, state, choice) {
        if (!state || !desc) return desc;
        const look = newLook(), text = look ? opened(look, desc) : String(desc);
        return stocksNow().reduce((out, st) => {
            const start = stockOf(state, st.key), top = topOf(st, state, start);
            return Number.isFinite(top) ? fitStock(out, st, start, top, costCapOf(st, choice)).text : out;
        }, text);
    }
    /**
     * Runs a choice's effect (choice.effect(state, ...args)) and returns its result line as it really went: a gain of
     * energy or rations (the new look: salvage too) that hit the top is said as what fitted. The new look holds each stock
     * to its cap above where it stood (never below that), sealed rations opened first, and no more than its cost cap
     * below it (CARD_COST_CAP: energy and rations; not a fullCost choice; the default game never cuts a cost). The words
     * change only when replaying the line's own numbers from the ship's numbers before lands where the ship is now;
     * otherwise the line is left as the effect wrote it.
     */
    function apply(choice, state, ...args) {
        const stocks = stocksNow(), before = stocks.map(st => stockOf(state, st.key)), tops = stocks.map((st, i) => topOf(st, state, before[i]));
        const look = newLook();
        let text = choice.effect(state, ...args);
        if (look) {
            if (typeof state.openFoodPacks === 'function') state.openFoodPacks(true);           // opened now: they count toward the cap, and the line below says what fitted
            stocks.forEach((st, i) => {
                const most = Math.max(tops[i], before[i]), least = before[i] - costCapOf(st, choice);
                if (Number(state[st.key]) > most) state[st.key] = most;
                else if (Number(state[st.key]) < least) state[st.key] = least;                  // a cost held to its cap
            });
            if (typeof text === 'string') text = opened(look, text);
        }
        if (typeof text !== 'string' || !text) return text;
        return stocks.reduce((out, st, i) => {
            const top = tops[i];
            if (!Number.isFinite(top)) return out;
            const r = fitStock(out, st, before[i], top, costCapOf(st, choice));
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
        return capGains(text, state, choice);
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

    /** The speaker as the crew list names them: an old titled label ("Tech Mira") still shows the first name. The new look:
        the name is <b class="enc-who">, so its style never reaches the gains and costs marked in the line (cards.css). */
    function lineHtml(app, d) {
        const member = d.speaker === 'A.U.R.A.' ? null : memberFor(app, d.speaker);
        const name = (member && member.name) || d.speaker;
        const color = SPEAKER_COLORS[name] || 'var(--bone)';
        return `${faceHtml(app, d.speaker)}<p><b${newLook() ? ' class="enc-who"' : ''} style="color:${color}">${esc(name)}</b>${d.text}</p>`;
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
    let capturing = 0, quiet = false;
    /** Called while a choice runs (its effect, or what it sets off): the card closes with no outcome step, because the
        outcome is shown another way (the fall through the gap, src/newscreen/stop/Copy.js). Outside a choice: nothing. */
    function noOutcome() { if (capturing) quiet = true; }
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
    // (a jump's "Starting Sector Jump..." is the flight's, and the gap's tally says again what A.U.R.A. just said: both stay in the log)
    const OUT_SKIP = /^(?:={2,}|\/{2,}|⚠|☠|ERROR\b|WARNING\b|STORAGE WARNING\b|Now entering\b|SOMETHING STRANGE\b|Deploying\b|Starting Sector Jump\b|Through the gap\. We jumped\b|\[[^\]]*\]$)/i;
    const OUT_PREFIX = /^(?:CREW|MINING|STATION|SIGNAL|SCAN|PROBE|MALFUNCTION RESOLVED|REPAIR COMPLETE|FABRICATION COMPLETE):\s*/;
    const OUT_SPEAKER = /^(A\.U\.R\.A\.|Jaxon|Aris|Vance|Mira|Cora)\s*:\s*(.+)$/;
    const OUT_MAX = 4;
    const unquote = s => { const t = s.trim(), m = /^["“'‘](.*)["”'’]$/.exec(t); return m && !/["“”]/.test(m[1]) ? m[1] : t; };
    const tokensOf = text => (String(text).match(new RegExp(REWARD_PATTERN.source, 'g')) || []).map(t => t.trim().toLowerCase());
    /** The lines worth showing from what a choice logged: speech and what happened, no system banners, each once, at most four
        (the first few and the last, which is usually the tally). A line whose numbers all repeat an earlier line's is the same
        news twice ("Power surge. -8 Energy lost" / "Power surge under control. -8 Energy."): it goes. */
    function outcomeLines(said) {
        const out = [], seen = new Set(), counted = new Set();
        said.forEach(raw => {
            const m = String(raw || '').replace(MARKUP, '').replace(/\s+/g, ' ').trim().replace(OUT_PREFIX, '');
            if (!m || OUT_SKIP.test(m)) return;
            const sp = OUT_SPEAKER.exec(m), item = sp ? { speaker: sp[1], text: unquote(sp[2]) } : { text: m };
            const key = item.text.toLowerCase(), toks = tokensOf(m);
            if (seen.has(key) || (!sp && toks.length && toks.every(t => counted.has(t)))) return;
            toks.forEach(t => counted.add(t));
            seen.add(key); out.push(item);
        });
        return out.length > OUT_MAX ? out.slice(0, OUT_MAX - 1).concat(out[out.length - 1]) : out;
    }

    const ALARM = /^(?:⚠\s*)?(?:WARNING|INCIDENT|CRITICAL|CATASTROPHE|FATAL|KIA|PREDATOR ALERT|ALERT):\s*/i;   // the team card's result lines: the alarm word goes, the news stays
    /**
     * The new look, for a panel that is not an EncounterCard (the team-on-the-ground card, bundle.js showEventModal): runs the
     * choice (run), then shows what it did in place of the panel's choices, in showOutcome's look, then CONTINUE (done: close
     * the panel). Nothing else opens meanwhile. With nothing to show, or the panel gone, it closes at once.
     * opts.result (the new look's short result card, bundle.js showTripResult): called once the choice has run, it gives what
     * the card says instead of the logged lines: { say: { speaker, text }, also: [logged line], lean, chips: [{ text, loss }] },
     * one line, any line of the log it keeps (a breakdown's: cleaned as the logged lines are) and the chips; lean: the panel's
     * found line (.eva-found) gives way too, to keep the card short.
     */
    function outcomeIn(app, panel, picked, run, done, opts) {
        gate.held += 1;
        let said = [], short = null;
        try { said = captureLog(run); } catch (err) { console.error('EncounterCard: the choice failed', err); }
        if (opts && typeof opts.result === 'function') { try { short = opts.result(); } catch (err) { console.error('EncounterCard: the short result failed', err); } }
        const clean = list => outcomeLines(list.map(m => String(m || '').replace(ALARM, '').replace(/^\w/, c => c.toUpperCase())));
        const lines = short && short.say ? [short.say].concat(clean(short.also || [])) : clean(said);
        const chips = short && short.say ? short.chips || [] : [];
        const keep = short && short.say && short.lean ? 'header, .eva-team' : 'header, .eva-team, .eva-found';
        let isDone = false;
        const finish = () => { if (isDone) return; isDone = true; try { done(); } catch (err) { console.error('EncounterCard: closing the panel failed', err); } releaseGate(); };
        if (!lines.length || !panel || !panel.isConnected) { finish(); return; }
        const pick = String(picked || '').replace(/<[^>]*>/g, '').replace(MARKUP, '');
        [...panel.children].forEach(el => { if (!el.matches(keep)) el.style.display = 'none'; });   // the choices give way to what happened
        const box = document.createElement('div');
        box.className = 'enc-decide eva-outcome';
        box.innerHTML = `
            <div class="enc-outcome" aria-live="polite">
                <p class="enc-outcome-pick">${esc(pick)}</p>
                ${lines.map(l => (l.speaker ? `<div class="enc-line enc-outcome-say is-in">${lineHtml(app, { speaker: l.speaker, text: markRewards(esc(l.text)) })}</div>` : `<p class="enc-outcome-line">${markRewards(esc(l.text))}</p>`)).join('')}
                ${chips.length ? `<p class="enc-outcome-line enc-outcome-chips"><span class="enc-chips">${chips.map(c => `<i class="${c.loss ? 'is-loss' : 'is-gain'}">${esc(c.text)}</i>`).join('')}</span></p>` : ''}
            </div>
            <footer class="enc-flow enc-outcome-flow"><button class="enc-next enc-outcome-go" type="button">CONTINUE ›</button></footer>`;
        panel.appendChild(box);
        const go = box.querySelector('.enc-outcome-go'), guard = window.ChoiceGuard;
        if (guard && typeof guard.keepOffClick === 'function') guard.keepOffClick(panel, [go]);   // the click that chose never lands on CONTINUE
        go.addEventListener('click', finish);
        box.tabIndex = -1;
        box.focus({ preventScroll: true });
    }

    // ── the new look: every card is a frame (src/newscreen/cards/Frame.js, DESIGN.md 1.1). This half turns a card's cfg into the
    //    frame's model (who says what; each key with its chips and consequence) and runs a pick; the frame draws and plays it ──
    const FEEL = /^(?:(All crew|Jaxon|Aris|Vance|Mira) )?([+\-−])\d+(?:-\d+)?\s+Stress$/;
    const FULL = /\b(Energy|Rations?|Salvage) already full\b/g;
    const LOSS_WORDS = /\b(?:die|dies|died|death|killed|gone for good|lost for good)\b/i;   // a consequence that kills or loses for good
    const CREW_TONE = { LEADER: 'cora', ENGINEER: 'jaxon', MEDIC: 'aris', SECURITY: 'vance', SPECIALIST: 'mira' };
    const DEATH = /^☠\s*DEATH:\s*([A-Z][a-z]+)/;
    const NARR_MAX_WORDS = 20, PAGE_ITEMS = 2, PAGE_WORDS = 30, TALLY_WORDS = 5, CONSEQ_MIN_WORDS = 2;
    const OTHERWISE = /^(?:otherwise|or)\b/i;                                    // "Otherwise plain ice: +10 Energy.": a branch, never certain
    const NOTHING = /^(?:otherwise\s+|or\s+)?nothing\b[^,;:]*[.!?]?$/i;          // a branch where nothing happens
    const HARM = /hurt|injured|damag|\blost\b|is gone|walks through|changed by|Stress 3|strike|gas pocket|discharge/i;   // a roll that harms (RISKY without the stress a good roll may bring)
    const CHANCE_WORDS =/\b\d+%\s+(?:chance|risk)(?:\s+each)?(?:\s+(?:of|for each crew member))?\s*:?\s*/gi;
    const wordCount = s => String(s).split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
    const cleanText = s => String(s == null ? '' : s).replace(/<[^>]*>/g, '').replace(MARKUP, '').replace(/\s+/g, ' ').trim();
    /** Sentences, with A.U.R.A.'s dots kept whole. */
    function sentencesIn(text) {
        const HOLD = '\u0001', clean = cleanText(text).replace(/A\.U\.R\.A\./g, HOLD);
        return (clean.match(/[^.!?…]+[.!?…]+["'”’)\]]*\s*|[^.!?…]+$/g) || []).map(s => s.split(HOLD).join('A.U.R.A.').trim()).filter(Boolean);
    }
    /** The scene, said as narration: its sentences, two short ones to a line (the renderer never cuts a written line). */
    function narrationOf(context) {
        const out = [];
        sentencesIn(context).forEach(s => {
            const last = out[out.length - 1], n = wordCount(s);
            if (last && last.k < 2 && last.n + n <= NARR_MAX_WORDS) Object.assign(last, { text: `${last.text} ${s}`, n: last.n + n, k: last.k + 1 });
            else out.push({ text: s, n, k: 1 });
        });
        return out.map(o => ({ narr: true, text: o.text }));
    }
    /** One line of talk for the frame: the first name, the tone (tokens.css --tone-*), the portrait (C02: A.U.R.A. has none). */
    function frameLine(app, d) {
        const isAura = d.speaker === 'A.U.R.A.', member = isAura ? null : memberFor(app, d.speaker);
        const tag = member && (member.tags || []).find(t => CREW_TONE[t]);
        const name = (member && member.name) || d.speaker;
        const tone = isAura ? 'aura' : tag ? CREW_TONE[tag] : String(name || '').toLowerCase();
        return { speaker: name, text: cleanText(d.text), tone, face: member && member.portraitId ? `assets/crew/${member.portraitId}.png` : null };
    }
    /** A number becomes a chip; a stress number becomes a feeling (C04: the crew report it, not a scorecard). */
    function chipOf(token, named) {
        const f = FEEL.exec(token);
        if (!f) return { text: token, tone: isLoss(token) ? 'loss' : 'gain' };
        const who = named || (!f[1] || f[1] === 'All crew' ? 'Crew' : f[1]), up = f[2] !== '-' && f[2] !== '−';
        return { text: `${who} ${up ? 'tense' : 'calmer'}`, tone: up ? 'loss' : 'gain', word: true };   // DRAFT (look pass): C04's feeling words
    }
    const FULL_WORDS = { Energy: 'Energy full', Rations: 'Rations full', Salvage: 'Salvage full' };   // DRAFT (look pass): a capped gain's dim chip
    const fullChip = unit => ({ text: FULL_WORDS[/^Ration/.test(unit) ? 'Rations' : unit] || `${unit} full`, tone: 'dim' });
    /** A sentence with its numbers taken out (they are chips): the words left, or '' when only numbers or a stray word were
        there. "20% chance of a gas pocket: -4 Energy, and someone may get hurt." reads "A gas pocket: someone may get hurt." */
    function wordsOf(sentence) {
        const M = '\u0002', JOIN = '(?:,|and|or|but|&)';
        const r = String(sentence).replace(CHANCE_WORDS, ' ')
            .replace(/\b(?:and\s+)?(?:all crew|commander|they get|he gets|she gets|whoever goes (?:in|aboard) gets)\s+(?=[+\-−]\d)/gi, ' ')   // "and they get +1 Stress"
            .replace(new RegExp(`(?:${REWARD_PATTERN.source})(?![^.,;:!?]*?${DEFERRED.source.slice(1)})[^.,;:!?()]*`, 'g'), M)   // a number and the words that go with it ("-2 Rations to keep them"), not a gain paid later
            .replace(FULL, M).replace(new RegExp(`\\(\\s*${M}\\s*\\)`, 'g'), M)
            .replace(new RegExp(`${M}(?:\\s*${JOIN}?\\s*${M})+`, 'gi'), M)                                    // "M, M" "M and M"
            .replace(new RegExp(`^\\s*${M}\\s*[,:;]?\\s*(?:(?:and|or|but)\\b\\s*)?`, 'i'), '')                  // at the head
            .replace(new RegExp(`\\s*[,:;]?\\s*(?:(?:and|or|but)\\s+)?${M}\\s*(?=[.!?;]|$)`, 'gi'), '')            // at a clause's end
            .replace(new RegExp(`([,:;])\\s*${M}\\s*,?\\s*(?:(?:and|or|but)\\b\\s*)?`, 'gi'), '$1 ')            // "a gas pocket: M, and someone…"
            .replace(new RegExp(`\\s*${M}\\s*`, 'g'), ' ')
            .replace(/\s+/g, ' ').replace(/\s+([,.:;!?])/g, '$1').replace(/([,:;])[,:;]+/g, '$1').replace(/[,:;]+(?=[.!?]|$)/g, '')
            .replace(/;(?=\s*(?:[.!?]|$))/g, '').replace(/^[\s,:;.!?]+/, '').replace(/^(?:and|or|but)\b[\s,:;]*/i, '').trim();
        return wordCount(r.replace(/[.!?]+$/, '')) >= CONSEQ_MIN_WORDS ? r.charAt(0).toUpperCase() + r.slice(1) : '';
    }
    /**
     * A key's chips and consequence (DESIGN 1.1). Chips are numbers only: what is certain (a cost inside a chance or an
     * "Otherwise" branch is not one, nor a gain paid later, "+4 Energy saved on the next jump"); a chance of harm as "20% risk";
     * a good chance with gains as "40% +5 Rations", or, when it is the only other side of the card's risk (80% against a 20%
     * risk), its gains as plain chips beside the risk ("+40 Energy +15 Salvage 20% risk", cards-2.md); a good chance of words
     * alone as "40% chance"; a capped gain as a dim "Energy full". The consequence is words only: the designer's sentences
     * with the numbers taken out (they are the chips), a sentence of numbers alone left out. An "Otherwise" branch takes the
     * odds the chances leave. Returns { chips, text, html }.
     */
    function keyParts(desc) {
        const text = cleanText(desc), chips = [], had = new Set(), sents = [];
        const add = c => { const k = c.text.toLowerCase(); if (!had.has(k)) { had.add(k); chips.push(c); } };
        let from = 0;
        sentencesIn(text).forEach(x => { const a = text.indexOf(x, from); sents.push({ x, a, b: a + x.length }); from = a + x.length; });
        const branches = [...text.matchAll(CHANCE_PATTERN)].map(m => {
            const end = text.slice(m.index).search(/[.!?](\s|$)/);
            return { pct: parseInt(m[0], 10), word: m[0], a: m.index, b: end < 0 ? text.length : m.index + end + 1 };
        });
        const left = 100 - branches.reduce((n, c) => n + (/each/i.test(text.slice(c.a, c.b)) ? 0 : c.pct), 0);
        sents.filter(x => OTHERWISE.test(x.x)).forEach(x => branches.push({ pct: branches.length && left > 0 && left < 100 ? left : null, a: x.a, b: x.b }));   // a branch with no odds: no chip
        const inBranch = i => branches.some(c => i >= c.a && i < c.b);
        for (const m of text.matchAll(new RegExp(REWARD_PATTERN.source, 'g'))) {
            if (inBranch(m.index) || DEFERRED.test(text.slice(m.index + m[0].length))) continue;
            add(chipOf(m[0].trim(), /\bCommander\s*$/.test(text.slice(0, m.index)) ? 'Commander' : null));   // "Commander +1 Stress": not the crew's
        }
        branches.forEach(c => {
            const clause = text.slice(c.a, c.b), tokens = (clause.match(new RegExp(REWARD_PATTERN.source, 'g')) || []).map(t => t.trim());
            c.gains = tokens.filter(t => !isLoss(t) && !FEEL.test(t));                // what a good roll gives (its costs and stress are not chips)
            c.isRisk = /risk/i.test(c.word || '') || HARM.test(clause) || (!c.gains.length && tokens.some(isLoss));
            c.words = wordsOf(clause);
        });
        const riskPct = branches.reduce((n, c) => n + (c.isRisk && c.pct ? c.pct : 0), 0);
        const good = branches.filter(c => c.pct != null && !c.isRisk && c.gains.length);
        const isOtherSide = c => good.length === 1 && good[0] === c && riskPct > 0 && c.pct + riskPct === 100 && c.pct >= riskPct;   // never a 30% gain beside a 70% risk
        branches.filter(c => !c.isRisk).concat(branches.filter(c => c.isRisk)).forEach(c => {   // the gains first, the risk last
            if (c.pct == null) return;
            if (c.isRisk) add({ text: `${c.pct}% risk`, tone: 'loss' });
            else if (isOtherSide(c)) c.gains.forEach(t => add(chipOf(t)));     // the gains unless the risk comes up
            else if (c.gains.length) add({ text: `${c.pct}% ${c.gains.join(' ')}`, tone: 'gain' });
            else if (c.words && !NOTHING.test(c.words)) add({ text: `${c.pct}% chance`, tone: 'ui' });   // "Otherwise nothing." gets no chip
        });
        for (const m of text.matchAll(FULL)) add(fullChip(m[1]));
        const said = sents.map(x => wordsOf(x.x)).filter(Boolean).join(' ');
        return { chips, text: said, html: esc(said) };
    }
    /** A key: its label (sentence case, no full stop), its chips, its consequence and its role (final: held, C06; primary: the
        framed warm keycap, the safe or only way on). A locked key keeps its reason. */
    function frameKey(app, c, desc, isFinal, count) {
        const label = cleanText(c.text).replace(/\.$/, '');
        const primary = c.primary != null ? !!c.primary : count === 1 || /^not (?:yet|now)$/i.test(label);
        const locked = !!c.disabled || (typeof c.requires === 'function' && !c.requires(app.state));
        if (locked) return { label, chips: [], conseqHtml: esc(c.requiresLabel || ''), conseqTone: 'lock', locked: true, final: false, primary: false };
        const p = keyParts(desc);
        return { label, chips: Array.isArray(c.chips) ? c.chips : p.chips, conseqHtml: p.html, conseqTone: c.tone || (LOSS_WORDS.test(p.text) ? 'loss' : ''), final: !!isFinal, primary };
    }
    /**
     * What a pick did, for the frame's slots (DESIGN 1.1 "outcome"): what was said and what happened as lines, every number as
     * one chip row (rewards inside a spoken line come out of it: "Vance: 'Good.' Jaxon goes to check…" is Vance's line, then the
     * narration, then the chips), in pages of two lines. A death and nothing else said: "Aris did not make it." A card never
     * closes with nothing said; with nothing at all to show, null. → { pages: [[item]], chips } | null
     */
    function outcomeOf(app, said) {
        const items = [], chips = [], seen = new Set(), counted = new Set(), dead = [];
        const addItem = it => { const k = it.text.toLowerCase(); if (it.text && !seen.has(k)) { seen.add(k); items.push(it); } };
        said.forEach(raw => {
            const isTally = OUT_PREFIX.test(cleanText(raw)), m = cleanText(raw).replace(OUT_PREFIX, '');
            const death = DEATH.exec(m);
            if (death) { dead.push(death[1]); return; }
            if (!m || OUT_SKIP.test(m)) return;
            const sp = OUT_SPEAKER.exec(m), toks = tokensOf(m);
            if (!sp && toks.length && toks.every(t => counted.has(t))) return;                      // the same news twice
            (m.match(new RegExp(REWARD_PATTERN.source, 'g')) || []).forEach(t => { const k = t.trim().toLowerCase(); if (!counted.has(k)) { counted.add(k); chips.push(chipOf(t.trim())); } });
            for (const f of m.matchAll(FULL)) { const c = fullChip(f[1]); if (!chips.some(x => x.text === c.text)) chips.push(c); }
            const q = sp ? /^(["“'‘])(.+?)(["”'’])(?:\s+(.*))?$/.exec(sp[2].trim()) : null;
            if (sp) addItem(Object.assign(frameLine(app, { speaker: sp[1] }), { text: q ? q[2] : unquote(sp[2]) }));
            const rest = keyParts(sp ? (q ? q[4] || '' : '') : m).text;
            if (rest) addItem({ narr: true, text: rest, tally: isTally && wordCount(rest) <= TALLY_WORDS });
        });
        if (items.some(it => !it.tally)) items.splice(0, items.length, ...items.filter(it => !it.tally));   // "Melted ice for fuel." after the line that said so
        if (!items.length && dead.length) {
            const name = dead[0], who = frameLine(app, { speaker: name });
            items.push({ narr: true, text: `${name} did not make it.`, face: who.face, dead: true });   // DRAFT (look pass): a death-only outcome (DESIGN 1.1)
        }
        if (!items.length && !chips.length) return null;
        const pages = [];
        items.slice(0, OUT_MAX).forEach(it => {
            const page = pages[pages.length - 1], n = wordCount(it.text);
            if (page && page.length < PAGE_ITEMS && page.n + n <= PAGE_WORDS) { page.push(it); page.n += n; } else { const p = [it]; p.n = n; pages.push(p); }
        });
        return { pages: pages.length ? pages : [[]], chips };
    }
    /** The picture a card asks for (DESIGN 1.2): its own, a SceneArt scene, or the view ahead; a call carries its wave. */
    function pictureOf(cfg) {
        const base = cfg.picture ? Object.assign({}, cfg.picture) : hasArt(cfg) ? { kind: 'scene', art: cfg.art } : { kind: 'view' };
        if (base.kind === 'scene' && !base.art) base.art = cfg.art;
        if (cfg.hasSignal) base.signal = true;
        return base;
    }
    /** The new look's card: the frame. Repeats are known by cfg.seenKey (state._seenCards, saved). */
    function openFrame(app, cfg) {
        const state = app && app.state, choices = cfg.choices || [];
        const narr = cfg.noContext ? [] : narrationOf(cfg.context), living = livingLines(app, cfg.dialogue);
        const talk = narr.concat(living.map(d => frameLine(app, d)));
        const own = cfg.repeatLine != null && cfg.dialogue ? living.indexOf(cfg.dialogue[cfg.repeatLine]) : -1;
        const final = new Set(cfg.final || []);
        const keys = choices.map((c, i) => frameKey(app, c, descOf(c, state), final.has(i), choices.length));
        const seen = state ? (state._seenCards = Array.isArray(state._seenCards) ? state._seenCards : []) : [];
        const isRepeat = !!cfg.seenKey && seen.includes(cfg.seenKey);
        if (cfg.seenKey && !isRepeat) seen.push(cfg.seenKey);
        const aria = [cfg.kicker, cfg.title].map(cleanText).filter(Boolean).join(' · ');
        let picked = false;
        return window.NSFrame.open(app, {
            aria, zIndex: cfg.zIndex || 2000, shape: cfg.shape || (choices.length === 1 ? 'report' : 'decide'), alarm: !!cfg.alarm || cfg.tone === 'distress',
            picture: pictureOf(cfg), readout: cleanText(cfg.readout), deck: cfg.deck || null, lines: talk, keys, isRepeat,
            repeatIndex: own >= 0 ? narr.length + own : null,
        }, {
            pick(idx) {
                picked = true;
                gate.held += 1;                                                       // nothing else opens until the outcome is read
                let said = [];
                quiet = false;
                try { said = captureLog(() => cfg.onPick(idx)); } catch (err) { console.error('EncounterCard: the choice failed', err); }
                const isQuiet = quiet;
                quiet = false;
                if (isQuiet) return null;
                const drop = [].concat(cfg.outcomeDrop || []);
                const res = outcomeOf(app, said.filter(m => !drop.some(re => re.test(cleanText(m)))));
                if (res && typeof cfg.readoutNow === 'function') { try { res.readout = cleanText(cfg.readoutNow(state)); } catch (err) { console.error('EncounterCard: readoutNow failed', err); } }
                return res;
            },
            done() { if (picked) releaseGate(); },
        });
    }

    /**
     * @param {object} cfg { tone | color, kicker, title, facts:[[label, value]], context, dialogue:[{speaker, text}],
     *                       choices:[{text, desc, descNow(state), disabled, requires, requiresLabel}], onPick(idx), hasSignal, art, zIndex }
     *        The new look's frame also reads: shape 'decide' | 'ask' | 'report', final [index] (held, C06), readout (three words
     *        over the picture), picture { kind: 'scene' | 'view' | 'world' | 'deck', ... }, seenKey ('kind:id'), deck, alarm,
     *        noContext (the scene is not said), repeatLine (the dialogue line a repeat shows; default the last), readoutNow(state)
     *        (the readout once a pick has run), outcomeDrop [RegExp] (logged lines the outcome leaves to the log), and per
     *        choice: tone 'loss' | 'end', chips [{ text, tone, word }], primary.
     */
    function open(app, cfg) {
        if (newLook() && mustWait()) {                                                   // the last choice's outcome is still up
            gate.waiting.push(() => open(app, cfg));
            if (window.NSFramePics) window.NSFramePics.prewarm(pictureOf(cfg));          // its picture is painted while it waits
            return null;
        }
        if (newLook() && window.NSFrame) return openFrame(app, cfg);
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
                    quiet = false;
                    try { said = captureLog(() => cfg.onPick(pick)); } catch (err) { console.error('EncounterCard: the choice failed', err); }
                    const lines = outcomeLines(said), isQuiet = quiet;
                    quiet = false;
                    if (isQuiet || !lines.length || !modal.isConnected) { modal.remove(); releaseGate(); return; }
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

    window.EncounterCard = { open, outcomeIn, SPEAKER_COLORS, descOf, chipsOf, detailOf, capGains, apply, whenFree, noOutcome, capturing: () => capturing > 0,
        keyParts, outcomeOf, narrationOf };   // the last three: the new look's frame model (node checks read them)
})();
