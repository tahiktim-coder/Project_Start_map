/* ═══ Silent Exodus · new screen (?new=1) · start/Pods.js: the wake-up, at the sleeper pods in the hold ═══════════════════
   What it is: the minute after the launch film, before the first course (the designer's fluid idea, kept short). Black,
   "Sixty-one years later" quietly, then our Lander's hold close up (start/PodArt.js), the ship still dark: five upright
   pods, faces behind frost. A.U.R.A. wakes Cora first, at her pod's panel, so the player sees how it is done (the reading,
   the right valve, the frost melting off, the fluid draining, the eyes opening): "Good morning, Commander. Sixty-one
   years." The hold's lights come on, the pod opens, Cora steps out. Then the player wakes Jaxon, Aris, Vance and Mira, in
   any order: a click on a pod and Cora walks over; its panel (start/PodWords.js) shows ONE reading at a time and three
   valves, WARM, FLUSH and WAKE. Three stages each, in an order that differs per person, so it is read, not memorised. The
   right valve clears the stage in the art. A wrong one: a short alarm (no sound), the stage still clears (A.U.R.A. follows
   with the right fluid), and that person wakes groggy: +1 stress, once, and their first line says so. Never a fail.
   Each one steps out, says one first line (DRAFT, below) and walks over to the others. Between pods A.U.R.A. says the
   setup in OPENING_TALK's own words, unchanged (bundle.js): the orders, the eight ships and Jaxon's answer, Vance's doubt
   and her answer (the old beacon); an exchange starts only while pods are still asleep, so the room never waits on talk.
   Once all four stand together: "All four crew are awake and well. The ship is in one piece." The hold fades to black
   and the travel view opens as on any sector's first show; what the hold did not say, and the rules, A.U.R.A. and the
   crew say there (start/Wake.js). Never locked: "Let A.U.R.A. do it" is always there (she wakes the rest at once, no stress
   from her); on later new games "Skip the wake-up" (and Esc) too. Nothing is saved meanwhile: a reload lands on the
   title, as today. Reduced motion: no flicker, no flash, no vapour, gentle fades. No sound.
   Loaded only when the new-screen switch is on, after start/PodArt.js and start/PodWords.js, before start/Wake.js.

   window.NSPods (frozen)
     play(app) → Promise<{ done: 'played' | 'aura' | 'skipped' | 'none', fresh, rest: [[who, text, key]] }>
                           the scene, once; 'none' at once when it cannot run. fresh: nothing was said in the hold (the
                           old talk is said whole); rest: OPENING_TALK lines the hold did not say, in order (key: 'orders',
                           'eight', 'jaxon8', 'vance8', 'beacon')
     playing() → bool
     debug                 { state(), need() }   headless runs: what is where (CSS rects), and the valve the reading asks for
   NewScreen.mods.wake = { init, resize, update, render, pointer, key, discs }   (the shell's 'wake' mode)
   Anchors while it runs (CSS px): 'stop:aura' (over the dark med bay, by the intercom), 'stop:person:<id>' (over a head).
*/
(function () {
    'use strict';
    const NS = window.NewScreen, PA = window.NSPodArt, PW = window.NSPodWords, CE = window.CrewEngine;
    if (!window.NEW_SCREEN || !NS || !NS.on || !PA || !PW || !CE) return;
    const { SW, SH, PODS, FLUID, INTERCOM } = PA;
    const INK = '#05070a', ALARM = '#e2574c', SEEN_KEY = 'se-wake-seen';

    // ── DRAFT lines (the designer rewrites them; docs/STYLE.md: one idea, 20 words at most; A.U.R.A. without contractions):
    //    A.U.R.A.'s few new words, and each person's first line as they step out (the second: a wrong valve made them groggy)
    const DRAFT = {
        years: 'Sixty-one years.',                                                       // after OPENING_TALK's "Good morning, Commander."
        teach: 'The others are still asleep, Commander.',                                // she has just shown how, on Cora's pod
        aura: 'I will wake the others, Commander.',
        first: {
            jaxon: ["All that sleep and I'm still tired. Is there coffee?", "My head's pounding. I've had hangovers that were kinder."],
            aris: ['Slowly, everyone. Sit down if you feel dizzy.', "I'm dizzy. That was the wrong fluid. Go gently with the others."],
            vance: ['Sixty-one years, she says. I want to see the logs.', 'Wrong fluid. I felt it go in. Who set up these pods?'],
            mira: ['We made it! A.U.R.A., what did we miss?', "Everything's spinning. A.U.R.A., is that normal?"],
        },
    };
    const CARD_TEXT = 'Sixty-one years later';
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    const TONE = { cora: '#c9d1d6', jaxon: '#f08c2e', aris: '#ffc27a', vance: '#c4622a', mira: '#e8836a' };   // as the voice lines
    const TAG = { cora: 'LEADER', jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' };
    const KEYS = ['warm', 'flush', 'wake'];
    const ORDERS = [['warm', 'flush', 'wake'], ['flush', 'warm', 'wake'], ['wake', 'warm', 'flush'], ['warm', 'wake', 'flush'], ['flush', 'wake', 'warm'], ['wake', 'flush', 'warm']];
    const CORA_AT = i => PODS[i].x - 28;                                    // Cora works a pod from its left, in the gap
    const GATHER = { jaxon: 506, aris: 534, vance: 562, mira: 590 };          // the woken stand together by the cargo, facing the pods
    // ── the clock (ms): the card, the dissolves, A.U.R.A.'s pace, a valve, a pod opening ──
    const CARD = { in0: 300, in1: 1100, out0: 2900, out1: 3600 }, DISSOLVE = 900, END_PAUSE = 1100;
    const READ_DELAY = 260, AUTO_READ = 650, PULSE = 420, ALARM_MS = 900, ANIM = 900, FAST = { pulse: 300, anim: 650, gap: 280 };
    const OPEN = { delay: 350, door0: 250, door1: 800, out: 900, vapour: 650 }, FLICKER = [90, 200, 330, 480];
    const GAP_MS = 350, STAND_MS = 220, WALK = CE.ACTIONS.walk;
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const still = () => !!(mq && mq.matches);
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    const easeOut = k => 1 - Math.pow(1 - clamp01(k), 3), easeIn = k => clamp01(k) * clamp01(k);
    const wordsIn = s => (String(s).trim().match(/\S+/g) || []).length;
    const readMs = text => Math.max(3200, wordsIn(text) * 300 + 1600);       // Voice.js's own reading time

    // ── the scene's own state (never game state, but for the groggy stress and the log) ──
    let S = null, words = null, art = null, actx = null, cv = null, cx = null, layer = null, geo = null, inited = false;
    const now = () => NS.clock.t;
    const app = () => (S && S.app) || NS.app || window.app || null;
    const state = () => { const a = app(); return (a && a.state) || null; };
    const member = id => { const s = state(); return ((s && s.crew) || []).find(c => (c.tags || []).includes(TAG[id])) || null; };
    const voice = () => (NS.mods && NS.mods.voice) || null;

    // ── the words A.U.R.A. and the crew say here, from OPENING_TALK (bundle.js), unchanged ──
    function setupLines() {
        const T = window.OPENING_TALK, D = T && Array.isArray(T.dialogue) ? T.dialogue : [];
        const at = i => (D[i] && D[i].text ? D[i] : null), first = at(0) ? String(at(0).text).split(/(?<=[.!?])\s+/) : [];
        const line = (key, i, who) => (at(i) ? { key, who: at(i).speaker || who, text: at(i).text } : null);
        return {
            greeting: first[0] || 'Good morning, Commander.',
            count: first.slice(1).join(' '),
            setup: [line('orders', 1, 'A.U.R.A.'), line('eight', 2, 'A.U.R.A.'), line('jaxon8', 3, 'Jaxon'), line('vance8', 4, 'Vance'), line('beacon', 5, 'A.U.R.A.')].filter(Boolean),
        };
    }

    // ═══ 1. a pod: its stages, its valve under way, its opening ═══
    function freshPods() {
        const deck = ORDERS.slice();                                             // five different orders, one each (shuffled)
        for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
        return PODS.map((p, i) => ({
            id: p.id, i, order: deck[i].slice(), stage: 0, marks: [null, null, null], groggy: false, by: i === 0 ? 'aura' : null,
            temp: 29 + Math.floor(Math.random() * 5), pulse: 34 + Math.floor(Math.random() * 9),
            ice: 1, warm: 0, level: 1, awake: false, door: 0, inside: true, out: false,
            op: null, act: null, readAt: 0, shownAt: 0, nextAt: 0, openAt: null, vapour: 0,
        }));
    }
    const need = p => p.order[Math.min(2, p.stage)];
    function reading(p) {
        const k = need(p);
        if (k === 'warm') return { text: `Body ${p.temp}°C`, verdict: 'too cold' };
        if (k === 'flush') return { text: 'Fluid in the lungs', verdict: '' };
        return { text: `Heart ${p.pulse}`, verdict: 'too slow' };
    }
    const asleep = p => p.stage < 3 && p.openAt == null;
    /** A valve opened on pod i (by the player, or by A.U.R.A.): the fluid runs down; a wrong one sounds the alarm and the
        right fluid follows; then the stage clears in the picture. */
    function press(i, key, t, by) {
        const p = S.pods[i];
        if (!p || p.act || !asleep(p)) return false;
        const k = need(p), right = key === k, fast = by === 'aura' && i !== S.sel;
        p.act = { key, need: k, right, t0: t, pulse: fast ? FAST.pulse : PULSE, alarm: right ? 0 : ALARM_MS, anim: fast ? FAST.anim : ANIM };
        if (by === 'player') { p.by = 'player'; S.touched = true; }
        if (!right) p.groggy = true;
        return true;
    }
    function actTimes(a) { const fix = a.pulse + a.alarm, anim = a.right ? a.pulse : fix + a.pulse; return { fix, anim, done: anim + a.anim }; }
    function stageArt(p, kind, k) {
        if (kind === 'warm') { p.ice = 1 - easeOut(k); p.warm = clamp01((k - 0.3) / 0.6); }
        else if (kind === 'flush') p.level = 1 - easeIn(k);
        else if (k >= 0.3) p.awake = true;
    }
    function stepPod(p, i, t) {
        if (p.act) {
            const a = p.act, el = t - a.t0, T = actTimes(a);
            if (el >= T.anim) stageArt(p, a.need, (el - T.anim) / a.anim);
            if (el >= T.done) {
                stageArt(p, a.need, 1);
                p.marks[p.stage] = a.right ? FLUID[a.need] : ALARM;
                p.stage += 1; p.act = null; p.readAt = t; p.nextAt = t + (p.op === 'aura' && i !== S.sel ? FAST.gap : 150);
                if (p.stage >= 3) p.openAt = t + OPEN.delay;
            }
        } else if (p.op === 'aura' && asleep(p) && t >= p.nextAt && (i === 0 || S.pods[0].out)) {   // the crew after Cora: never out in the dark
            if (i !== S.sel) press(i, need(p), t, 'aura');
            else if (words.typedAll() && t - p.readAt >= AUTO_READ) press(i, need(p), t, 'aura');
        }
        if (p.openAt == null || t < p.openAt) return;
        const el = t - p.openAt;
        if (S.sel === i) S.sel = null;                                       // the panel closes as the pod opens
        if (i === 0 && S.litAt == null) S.litAt = p.openAt;                  // Cora's pod: the hold's lights come on
        p.vapour = still() ? 0 : el / OPEN.vapour;
        p.door = clamp01((el - OPEN.door0) / (OPEN.door1 - OPEN.door0));
        if (el >= OPEN.out && p.inside) stepOut(p, i, t);
    }
    /** Out of the pod: they stand in front of it a moment, then go: Cora to the next pod's side, the others over to the group. */
    function stepOut(p, i, t) {
        p.inside = false; p.out = true;
        stayAt(p.id, PODS[i].x, 1, t);
        if (i === 0) { walkTo('cora', CORA_AT(1), 1, t + STAND_MS); return; }
        walkTo(p.id, GATHER[p.id], -1, t + STAND_MS);
        if (p.groggy) groggy(p.id);
        if (p.by === 'player' || p.groggy) S.talk.firsts.push({ key: 'first:' + p.id, who: NAMES[p.id], text: DRAFT.first[p.id][p.groggy ? 1 : 0] });
    }
    /** +1 stress, once (the real crew; at 1 nothing more happens: GameState.applyStressTraits works from 2). */
    function groggy(id) {
        const s = state(), m = member(id);
        if (!s || !m || m.status === 'DEAD') return;
        m.stress = Math.min(3, (m.stress || 0) + 1);
        try { if (typeof s.applyStressTraits === 'function') s.applyStressTraits(); if (typeof s.emitUpdates === 'function') s.emitUpdates(); } catch (err) { console.error('NSPods: the stress update failed', err); }
    }

    // ═══ 2. people on the floor: stays and walks on the shell's clock (as stop/Stop.js) ═══
    function stayAt(id, x, facing, t) { S.plans[id] = [{ kind: 'stay', x, facing, t0: t, t1: Infinity }]; }
    function poseOf(id, t) {
        const pl = S.plans[id];
        if (!pl) return null;
        const s = pl.find(q => t >= q.t0 && t < q.t1) || pl[pl.length - 1], lt = t - s.t0;
        if (s.kind === 'stay') return { x: s.x, act: 'idle', facing: s.facing, ms: t };
        const dir = Math.sign(s.x1 - s.x0) || 1;
        return { x: s.x0 + dir * Math.min(Math.abs(s.x1 - s.x0), Math.floor(lt / WALK.ms) * WALK.move), act: 'walk', facing: dir, ms: lt, walking: true };
    }
    function walkTo(id, x, facing, t) {
        const from = poseOf(id, t);
        if (!from) { stayAt(id, x, facing, t); return; }
        const pl = S.plans[id].filter(s => s.t0 < t).map(s => (s.t1 > t ? Object.assign({}, s, { t1: t }) : s));
        const n = Math.ceil(Math.abs(x - from.x) / WALK.move), t1 = t + n * WALK.ms;
        if (n > 0) pl.push({ kind: 'walk', x0: from.x, x1: x, t0: t, t1 });
        pl.push({ kind: 'stay', x, facing, t0: t1, t1: Infinity });
        S.plans[id] = pl;
    }

    // ═══ 3. the talk: one line at a time, beside whoever says it ═══
    // The setup is said between pods, in three exchanges: the orders; the eight ships (and Jaxon's answer); Vance's doubt
    // (and A.U.R.A.'s answer, the old beacon). An exchange starts only while a pod is still asleep (Vance's: while two are,
    // so the room never waits on talk); one that cannot start before the last pod opens is said in the travel view instead
    // (start/Wake.js), Vance's then just before the first hint. An answer always follows its question; first lines come next.
    const ANSWERS = ['beacon', 'jaxon8'];
    function beats() {
        const P = S.pods, T = S.talk, crewOut = P.slice(1).filter(p => p.out).length, sleeping = P.slice(1).filter(asleep).length;
        const said = k => T.said.has(k) || T.carried.has(k) || T.busy === k;
        const heard = id => P.find(p => p.id === id).out && !T.firsts.some(f => f.key === 'first:' + id && !said(f.key));   // out, and their own first line said
        const L = S.lines, list = [];
        list.push({ key: 'hello', who: 'A.U.R.A.', text: L.greeting + ' ' + DRAFT.years, ready: () => S.sel === 0 || P[0].openAt != null });
        if (S.aura.used) list.push({ key: 'aura', who: 'A.U.R.A.', text: DRAFT.aura, ready: () => true });
        list.push({ key: 'teach', who: 'A.U.R.A.', text: DRAFT.teach, ready: () => P[0].out && !S.aura.used && !S.touched });
        const setup = { orders: () => P[0].out && sleeping >= 1 && (said('teach') || T.skipped.has('teach') || S.touched), eight: () => said('orders') && crewOut >= 1 && sleeping >= 1,
            jaxon8: () => said('eight') && heard('jaxon'), vance8: () => said('eight') && heard('vance') && sleeping >= 2, beacon: () => said('vance8') };
        L.setup.forEach(b => list.push(Object.assign({}, b, { ready: () => setup[b.key] && setup[b.key]() })));
        const owed = () => (said('eight') && !said('jaxon8')) || (said('vance8') && !said('beacon'));   // an answer still to come
        if (L.count) list.push({ key: 'count', who: 'A.U.R.A.', text: L.count, ready: () => crewOut === 4 && !T.firsts.some(f => !said(f.key)) && !owed() });
        return list;
    }
    function nextBeat() {
        const T = S.talk, open = b => !T.said.has(b.key) && !T.carried.has(b.key) && !T.skipped.has(b.key);
        if (S.touched && !T.said.has('teach') && T.busy !== 'teach') T.skipped.add('teach');   // the player found it out alone: no lesson
        const list = beats().filter(b => open(b) && alive(b.who));
        const answer = list.find(b => ANSWERS.includes(b.key) && b.ready());
        if (answer) return answer;
        const first = T.firsts.find(open);
        if (first) return first;
        return list.find(b => b.ready()) || null;
    }
    function alive(who) { if (who === 'A.U.R.A.') return true; const id = Object.keys(NAMES).find(k => NAMES[k] === who), m = id ? member(id) : null; return !m || m.status !== 'DEAD'; }
    function stepTalk(t) {
        const T = S.talk;
        if (T.busy || t < T.nextAt || S.phase === 'out' || S.phase === 'card' || S.phase === 'in') return;
        const b = nextBeat();
        if (!b) return;
        T.busy = b.key;
        say(b).then(() => { if (!S || S.talk !== T) return; T.said.add(b.key); T.busy = null; T.nextAt = now() + GAP_MS; if (b.key === 'count') go('end', now()); });
    }
    /** One line, said beside the speaker, then logged as the old talk logs it (Voice skips a logged line it is saying). */
    function say(b) {
        const v = voice(), s = state(), id = b.who === 'A.U.R.A.' ? 'aura' : b.who.toLowerCase();
        let p = null;
        try { p = v && typeof v.say === 'function' ? v.say({ id, who: b.who, text: b.text, keep: true }) : null; } catch (err) { console.error('NSPods: the voice failed', err); }
        if (s && typeof s.addLog === 'function') s.addLog(`${b.who}: "${b.text}"`);
        if (p && typeof p.then === 'function') return p.then(() => true, () => true);
        return new Promise(r => setTimeout(r, readMs(b.text)));
    }

    // ═══ 4. the scene: card, dissolve in, Cora, the work, the end, dissolve out ═══
    function go(phase, t) { if (!S || S.phase === phase) return; S.phase = phase; S.phaseAt = t; if (phase === 'cora') select(0, 'aura', t); }
    function select(i, op, t) {
        const p = S.pods[i];
        if (!p || !asleep(p)) return;
        if (S.sel != null && S.sel !== i && S.pods[S.sel].act) return;     // a valve under way: that pod first
        if (S.sel === i) return;
        S.sel = i; p.op = op || p.op || 'player'; p.shownAt = t; p.readAt = t + READ_DELAY;
        if (i > 0) S.opened = true;                                          // the player has found the pods: no more breathing brackets
        if (i > 0 && S.pods[0].out) walkTo('cora', CORA_AT(i), 1, t);
    }
    function step(dt, t) {
        if (S.t0 == null) S.t0 = t;
        const el = t - S.t0;
        if (S.phase === 'card' && el >= CARD.out1) go('in', t);
        else if (S.phase === 'in' && t - S.phaseAt >= DISSOLVE) go('cora', t);
        else if (S.phase === 'cora' && S.pods[0].out) go('work', t);
        else if (S.phase === 'end' && t - S.phaseAt >= END_PAUSE) go('out', t);
        else if (S.phase === 'out' && t - S.phaseAt >= DISSOLVE) { finish(S.aura.used ? 'aura' : 'played'); return; }
        if (S.phase === 'card' && S.jobs.length) { const job = S.jobs.shift(); try { job(); } catch (err) { console.error('NSPods: painting ahead failed', err); } }
        if (S.phase !== 'card' && S.phase !== 'in') S.pods.forEach((p, i) => stepPod(p, i, t));
        stepTalk(t);
        if (S.phase === 'work' && S.pods.every(p => p.out) && !S.talk.busy && t >= S.talk.nextAt && !nextBeat()) go('end', t);   // nothing left to say (no count line)
    }

    // ═══ 5. the player's hands: a pod, a valve, A.U.R.A., the skip ═══
    const working = () => S && (S.phase === 'work' || S.phase === 'cora');
    function onPod(i) {
        if (!working() || S.phase !== 'work' || S.aura.used || i === 0) return;
        select(i, 'player', now());
    }
    function onValve(key) {
        if (!working() || S.sel == null || S.sel === 0 || !words.typedAll()) return;
        const p = S.pods[S.sel];
        if (p.op !== 'player' || p.act) return;
        press(S.sel, key, now(), 'player');
    }
    function onAura() {
        if (!working() || S.aura.used) return;
        const t = now();
        S.aura.used = true;
        const T = S.talk, started = k => T.said.has(k) || T.busy === k, unit = { jaxon8: 'eight', beacon: 'vance8' };
        S.lines.setup.forEach(b => { if (!started(b.key) && !(unit[b.key] && started(unit[b.key]))) T.carried.add(b.key); });   // said in travel instead (an answer stays with its question)
        if (S.sel != null && S.sel > 0 && !S.pods[S.sel].act) S.sel = null;
        let n = 0;
        S.pods.forEach((p, i) => { if (i > 0 && asleep(p)) { p.op = 'aura'; p.nextAt = t + 400 + n * FAST.gap; n += 1; } });
    }
    function onSkip() { if (S && S.later && S.phase !== 'out') finish('skipped'); }

    // ═══ 6. the shell module ═══
    function style() {
        if (document.getElementById('ns-pods-style')) return;
        const st = document.createElement('style');
        st.id = 'ns-pods-style';
        st.textContent = `#ns-root[data-mode="wake"] #ns-world, #ns-root[data-mode="wake"] #ns-ship, #ns-root[data-mode="wake"] #ns-dive, #ns-root[data-mode="wake"] #ns-bridge,
#ns-root[data-mode="wake"] #ns-world-words, #ns-root[data-mode="wake"] #ns-ship-words, #ns-root[data-mode="wake"] #ns-stop-words { visibility: hidden; }
#ns-root:not([data-mode="wake"]) #ns-wake, #ns-root:not([data-mode="wake"]) #ns-wake-words { visibility: hidden; }`;
        document.head.appendChild(st);
    }
    function init() {
        if (inited) return;
        inited = true;
        style();
        const root = document.getElementById('ns-root');
        cv = document.createElement('canvas'); cv.id = 'ns-wake'; cv.setAttribute('aria-hidden', 'true'); cv.style.display = 'none';
        if (root) root.insertBefore(cv, document.getElementById('ns-shade') || document.getElementById('ns-words') || null);
        cx = cv.getContext('2d');
        art = document.createElement('canvas'); art.width = SW; art.height = SH; actx = art.getContext('2d');
        layer = document.createElement('div'); layer.className = 'ns-layer'; layer.id = 'ns-wake-words';
        const wordsRoot = document.getElementById('ns-words');
        if (wordsRoot) wordsRoot.insertBefore(layer, document.getElementById('ns-voice') || null);
        words = PW.create({ css: (x, y) => css(x, y), unit: () => unit(), onValve, onPod, onAura, onSkip, onHover: i => { if (S) S.hover = i; } });
        words.init(layer);
        NS.bus.on('hidden', () => { if (S) abort(); });
        NS.bus.on('mode', p => { if (S && p && p.mode !== 'wake' && !S.leaving) abort(); });
    }
    function geoNow() {
        const G = NS.G, dpr = G.dpr || window.devicePixelRatio || 1, bk = G.bk > 0 ? G.bk : Math.max(1, Math.min(innerWidth * dpr / SW, innerHeight * dpr / SH));
        const CW = Math.max(SW, Math.ceil(innerWidth * dpr / bk)), CH = Math.max(SH, Math.ceil(innerHeight * dpr / bk));
        const ox = Math.floor((CW - SW) / 2), oy = Math.floor((CH - SH) / 2);
        return { bk, dpr, CW, CH, ox, oy, left: ox * bk / dpr, top: oy * bk / dpr };
    }
    const css = (x, y) => [geo.left + x * geo.bk / geo.dpr, geo.top + y * geo.bk / geo.dpr];
    const unit = () => geo.bk / geo.dpr;
    function resize() {
        if (!cv) return;
        geo = geoNow();
        cv.width = geo.CW; cv.height = geo.CH;
        Object.assign(cv.style, { width: (geo.CW * geo.bk / geo.dpr) + 'px', height: (geo.CH * geo.bk / geo.dpr) + 'px', left: '0px', top: '0px' });
        cx.imageSmoothingEnabled = false;
    }
    function update(dt, t) {
        if (!S || !S.on || !geo) return;
        step(dt, t);
        if (S && S.on) words.update(viewModel(t), t);
    }
    /** What the words show now. */
    function viewModel(t) {
        const P = S.pods, el = t - S.t0;
        const cardA = S.phase !== 'card' ? 0 : el < CARD.in0 ? 0 : el < CARD.in1 ? (el - CARD.in0) / (CARD.in1 - CARD.in0) : el < CARD.out0 ? 1 : 1 - (el - CARD.out0) / (CARD.out1 - CARD.out0);
        const vm = { card: { text: CARD_TEXT, a: Math.floor(clamp01(cardA) * 8) / 8 }, skip: S.later && S.phase !== 'out' && S.phase !== 'end',   // a gentle stepped fade, reduced motion too
            aura: { on: working() && !S.aura.used && P.slice(1).some(asleep) }, hover: S.hover, tones: TONE, invite: S.phase === 'work' && S.sel == null && !S.opened,
            pods: P.map((p, i) => i > 0 && S.phase === 'work' && !S.aura.used && asleep(p)), panel: null };
        if (S.sel != null) {
            const p = P[S.sel], a = p.act, T = a ? actTimes(a) : null, ael = a ? t - a.t0 : 0;
            const ph = !a ? null : ael < a.pulse ? 'pulse' : !a.right && ael < T.fix ? 'alarm' : !a.right && ael < T.anim ? 'fix' : 'anim';
            vm.panel = { i: S.sel, id: p.id, name: NAMES[p.id], tone: TONE[p.id], reading: reading(p), readAt: p.readAt, marks: p.marks, next: p.stage,
                groggy: p.groggy, lock: !!a, auto: p.op === 'aura', down: ph === 'pulse' || ph === 'alarm' ? a.key : ph === 'fix' ? a.need : null,
                alarm: ph === 'alarm' ? ael - a.pulse : null, shownAt: p.shownAt,
                pulse: ph === 'pulse' ? { hex: FLUID[a.key], k: ael / a.pulse } : ph === 'fix' ? { hex: FLUID[a.need], k: (ael - T.fix) / a.pulse } : null };
        }
        return vm;
    }
    function render(t) {
        if (!cv) return;
        if (!S || !S.on || !geo) { if (cv.style.display !== 'none') cv.style.display = 'none'; return; }
        if (cv.style.display !== 'block') cv.style.display = 'block';
        const c = actx;
        c.imageSmoothingEnabled = false;
        c.fillStyle = INK; c.fillRect(0, 0, SW, SH);
        S.drawn = [];
        if (S.phase !== 'card') {
            drawRoom(c, t);
            PA.fx(c, t, { dark: S.litAt == null, aura: speaking() === 'aura' });
            S.pods.forEach((p, i) => {
                const a = p.act, ph = a ? t - a.t0 : 0, alarm = !still() && a && !a.right && ph >= a.pulse && ph < a.pulse + a.alarm && Math.floor((ph - a.pulse) / 125) % 2 === 0;
                PA.pod(c, i, { id: p.id, warm: p.warm, ice: p.ice, level: p.level, awake: p.awake, door: p.door, inside: p.inside, alarm, frame: p.awake ? CE.frameAt('idle', t + i * 977) : 0 }, t);
                if (p.vapour > 0 && p.vapour < 1) PA.vapour(c, i, p.vapour);
            });
            words.under(c, t);
            drawPeople(c, t);
            words.over(c, t);
        }
        let j = 8;                                                          // how much shows (Bayer steps, a gentle fade): in, out
        if (S.phase === 'in') j = 1 + Math.floor((t - S.phaseAt) / (DISSOLVE / 8));
        if (S.phase === 'out') j = 8 - Math.floor((t - S.phaseAt) / (DISSOLVE / 8));
        if (j < 8) { c.globalCompositeOperation = 'destination-in'; c.drawImage(PA.mask(Math.max(0, j - 1)), 0, 0); c.globalCompositeOperation = 'source-over'; if (j <= 0) { c.fillStyle = INK; c.fillRect(0, 0, SW, SH); } }
        cx.fillStyle = INK; cx.fillRect(0, 0, geo.CW, geo.CH);
        cx.drawImage(art, geo.ox, geo.oy);
    }
    /** The hold, dark until Cora's pod opens; then the lamps come on: a stutter (reduced motion: a slow dissolve). */
    function drawRoom(c, t) {
        const dark = PA.room(false);
        if (S.litAt == null || t < S.litAt) { c.drawImage(dark, 0, 0); return; }
        const el = t - S.litAt, lit = PA.room(true);
        if (still()) {
            const j = Math.floor(el / 90);
            c.drawImage(dark, 0, 0);
            if (j >= 8) c.drawImage(lit, 0, 0);
            else { const tmp = scratch(); tmp.g.clearRect(0, 0, SW, SH); tmp.g.drawImage(lit, 0, 0); tmp.g.globalCompositeOperation = 'destination-in'; tmp.g.drawImage(PA.mask(j), 0, 0); tmp.g.globalCompositeOperation = 'source-over'; c.drawImage(tmp.c, 0, 0); }
            return;
        }
        const on = el >= FLICKER[3] || (el < FLICKER[0]) || (el >= FLICKER[1] && el < FLICKER[2]);
        c.drawImage(on ? lit : dark, 0, 0);
    }
    let tmpCanvas = null;
    function scratch() { if (!tmpCanvas) { const c = document.createElement('canvas'); c.width = SW; c.height = SH; tmpCanvas = { c, g: c.getContext('2d') }; } return tmpCanvas; }
    const speaking = () => { const v = voice(); try { return v && typeof v.speaking === 'function' ? v.speaking() : null; } catch (err) { return null; } };
    /** Everyone out of their pods, by x; whoever walks is drawn in front, on the floor's front lip. */
    function drawPeople(c, t) {
        const list = Object.keys(S.plans).map(id => ({ id, p: poseOf(id, t) })).filter(o => o.p);
        list.sort((a, b) => (a.p.walking ? 1 : 0) - (b.p.walking ? 1 : 0) || a.p.x - b.p.x).forEach(({ id, p }) => {
            const seed = Object.keys(NAMES).indexOf(id) + 1, ms = p.walking ? p.ms : p.ms + seed * 977;
            const d = PA.person(c, id, p.x, p.act, ms, p.facing, { blink: !p.walking && ((ms + seed * 1700) % 4300) < 140, dy: p.walking ? 2 : 0 });
            S.drawn.push(Object.assign({ id }, d));
        });
    }
    function pointer() { return false; }                                     // the words are real buttons (start/PodWords.js)
    function key(e) {
        if (!S || !S.on) return false;
        if (e.key === 'Escape' && S.later) { onSkip(); return true; }
        const k = ['1', '2', '3'].indexOf(e.key);
        if (k >= 0 && S.sel != null) { onValve(KEYS[k]); return true; }
        return false;
    }
    /** Round things the voice keeps its lines off (CSS px): the people on the floor, the faces behind the glass. */
    function discs() {
        if (!S || !S.on || !geo) return [];
        const k = unit(), out = [];
        S.drawn.forEach(d => { const h = d.Sp.canvas.height; [0.42, 0.72].forEach(f => { const [X, Y] = css(d.X, d.Y + h * f); out.push([X, Y, h * 0.2 * k]); }); });
        S.pods.forEach(p => { if (!p.inside) return; const w = PODS[p.i].win, [X, Y] = css(w.x + w.w / 2, w.y + 14); out.push([X, Y, 13 * k]); });
        return out;
    }
    function anchors(on) {
        const names = ['stop:aura'].concat(Object.keys(NAMES).map(id => 'stop:person:' + id));
        if (!on) { names.forEach(n => NS.anchors.delete(n)); return; }
        const pt = (x, y, side, align) => { const [X, Y] = css(x, y); return { x: X, y: Y, side, align }; };
        NS.anchors.set('stop:aura', () => (geo ? [pt(16, 10, 'below'), pt(SW / 2, 10, 'below', 'center'), pt(INTERCOM.x + INTERCOM.w + 6, INTERCOM.y + 2, 'right')] : []));
        Object.keys(NAMES).forEach(id => NS.anchors.set('stop:person:' + id, () => {
            const d = S && S.drawn.find(q => q.id === id);
            if (!d || !geo) return [];
            return [pt(d.X, d.Y + 2, 'above', 'center'), pt(d.X + 22, d.Y + 30, 'right'), pt(d.X - 22, d.Y + 30, 'left'), pt(d.X, 10, 'below', 'center')];
        }));
    }

    // ═══ 7. play, finish, abort ═══
    function later() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (err) { return false; } }
    /** Everything it needs: the game, the shell's 'wake' mode (this module), and the voice. Else the old talk, as before. */
    function canPlay(a) {
        const v = voice();
        return !!(a && a.state && NS.mods.wake && v && typeof v.say === 'function' && typeof NS.wake === 'function');
    }
    function play(a) {
        if (S) return Promise.resolve({ done: 'none', fresh: true, rest: [] });
        if (!canPlay(a) || !NS.wake(true)) return Promise.resolve({ done: 'none', fresh: true, rest: [] });
        return new Promise(resolve => {
            S = { on: true, app: a, resolve, phase: 'card', phaseAt: 0, t0: null, later: later(), pods: freshPods(), sel: null, hover: null, touched: false, opened: false,
                litAt: null, plans: {}, drawn: [], aura: { used: false }, lines: setupLines(), jobs: PA.prepare(), leaving: false,
                talk: { said: new Set(), carried: new Set(), skipped: new Set(), firsts: [], busy: null, nextAt: 0 } };
            if (!geo) resize();
            anchors(true);
        });
    }
    function rest() { return S ? S.lines.setup.filter(b => !S.talk.said.has(b.key)).map(b => [b.who, b.text, b.key]) : []; }
    function close() {
        anchors(false);
        if (words) words.hide();
        const v = voice();
        if (v && typeof v.hush === 'function') { try { v.hush(); } catch (err) { console.error('NSPods: the voice failed to hush', err); } }
        if (cv) cv.style.display = 'none';
    }
    function finish(done) {
        if (!S || !S.on) return;
        const r = S.resolve, out = { done, fresh: S.talk.said.size === 0 && !S.talk.busy, rest: rest() };
        S.on = false; S.leaving = true;
        close();
        try { localStorage.setItem(SEEN_KEY, '1'); } catch (err) { /* storage blocked: the skip is offered next time too */ }
        NS.wake(false);
        S = null;
        r(out);
    }
    function abort() {
        if (!S || !S.on) return;
        const r = S.resolve, out = { done: 'none', fresh: S.talk.said.size === 0 && !S.talk.busy, rest: rest() };
        S.on = false; S.leaving = true;
        close();
        if (typeof NS.mode === 'function' && NS.mode() === 'wake') NS.wake(false);
        S = null;
        r(out);
    }

    // ── debug, for the headless runs ──
    const debug = Object.freeze({
        state() {
            if (!S) return { on: false };
            const t = now();
            return { on: S.on, phase: S.phase, t: Math.round(t - (S.t0 || t)), lit: S.litAt != null, sel: S.sel, hover: S.hover, later: S.later, aura: S.aura.used,
                pods: S.pods.map(p => ({ id: p.id, stage: p.stage, need: asleep(p) ? need(p) : null, order: p.order.join(','), marks: p.marks.slice(), groggy: p.groggy, inside: p.inside, out: p.out, door: Math.round(p.door * 100) / 100, act: p.act ? p.act.key : null, by: p.by })),
                people: Object.fromEntries(Object.keys(S.plans).map(id => { const q = poseOf(id, t); return [id, q ? { x: q.x, act: q.act, facing: q.facing } : null]; })),
                talk: { said: [...S.talk.said], busy: S.talk.busy, carried: [...S.talk.carried] },
                rects: words ? words.rects() : null,
                podRects: PODS.map(p => { const [x, y] = css(p.x - 18, p.top), k = unit(); return { x: Math.round(x), y: Math.round(y), w: Math.round(36 * k), h: Math.round((PA.F - p.top) * k) }; }),
                people_css: S.drawn.map(d => { const [x, y] = css(d.X, d.Y + d.Sp.h * 0.5); return { id: d.id, x: Math.round(x), y: Math.round(y) }; }) };
        },
        need() { return S && S.sel != null ? need(S.pods[S.sel]) : null; },
    });

    NS.register('wake', { init, resize, update, render, pointer, key, discs });
    window.NSPods = Object.freeze({ play, playing: () => !!(S && S.on), debug });
})();
