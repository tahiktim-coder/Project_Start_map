/* Silent Exodus · sector 1 slice · every line and the sector 1 beats: the director (docs/SLICE_SPEC.md §4, §6, §8, §10).
   OWNER: the state-and-script builder (with state.js). The ONLY writer of story state (Slice.state.res, crew, places, route,
   team, decks, flags, pages, record). Draws ONLY canvas#shade (the dither under words, the dim, the stockpile film) and the
   DOM layer #reading (through the reused reading layer, plus the one-time hint). Never draws the world, the tower or the
   bridge: it tells them through the bus. Nothing here runs on a fixed timeline: every beat is a reaction to an event.
   Reuses by loading (never copied, never edited): game-screen/reading.js (GameReading), game-screen/pages.js (GamePages,
   through reading.js), reading.css, V3Paint (the shade grain, the film picture), V3Data (SECTORS, SCENE_STOCKPILE,
   PAGE_DISC, PAGE_PLATE), ShipSimA.line (the crew's routine lines). New lines are in LINES below, per docs/STYLE.md.

   window.Slice.mods.script = {
     init() · resize(G) · update(dt, t) · render(t) · goto(moment) · key(e) → bool · words() → n
     reading                     the GameReading instance (say, ask, playScene, showPage, openRecord), set in init()
     LINES, PLACES               the sector's words; what each place is (SPEC §3.2)
     note(id)                    → { name, tag, line } for the hover note (line: the cost line, numbers mode only, else null)
     price(id)                   → { open, cost, free, jump, rations, line }: what going there costs now
     teamLine(id, ids)           → "Vance and Mira take the shuttle": the action word's second line at the pick
     deckChips(deck)             → [{ choice: 'fix' | 'patch' | 'live', verb, chip }]: a red deck's three chips, in the price mode
     goodFor(id)                 → { who, text }: the pick's hover line for a person
     crewList()                  → the game's crew shape for the minigames (SPEC §9)
     speaker()                   → who is speaking now ('A.U.R.A.', 'Mira', …) or null (ship.js: TowerA's auraTalking)
   }
   Emits:  price:preview · route:go · route:cancel · route:fired · dive:start · dive:back · stop:phase · res:changed · crew:changed
           deck:changed · deck:ask · place:changed · fix:on-bench · plate:up · page:pinned · hold · jump:start · meal:start
           sector:arrive · beat (SPEC §5)
   Listens: world:hover · world:click · opening:done · flight:switched · flight:arrived · jump:flash · stop:shown · stop:pick
           stop:act · stop:leave · stop:hidden · ship:click · deck:choice · meal:done · price:changed
   Fallbacks, so the run never sticks on a missing event: the opening starts its lines at 8 s without opening:done; a flight
   lands 3 s after its time without flight:arrived; the jump flashes at 5 s without jump:flash; the meal ends at 14 s
   without meal:done (the bowls stay 10 s). The dive and the stop have no fallback: stop.js must answer dive:start with stop:shown. */
(function () {
    'use strict';
    const Slice = window.Slice, DATA = window.V3Data, P = window.V3Paint, E = Slice.ECON;
    const SEC1 = DATA.SECTORS[1], SEC2 = DATA.SECTORS[2], AURA = 'A.U.R.A.';
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    const IDS = { Cora: 'cora', Jaxon: 'jaxon', Aris: 'aris', Vance: 'vance', Mira: 'mira' };
    const CREW = ['jaxon', 'aris', 'vance', 'mira'];
    const ORDER = { start: 0, zeta: 1, titan: 1, kryos: 2, erebus: 2, rhea: 3 };
    const DECK_NAME = { bridge: 'bridge', lab: 'lab', quarters: 'crew quarters', medbay: 'med bay', hold: 'hold', engineering: 'engineering' };
    const theDeck = d => (d === 'engineering' ? '' : 'the ') + DECK_NAME[d], TheDeck = d => { const n = theDeck(d); return n[0].toUpperCase() + n.slice(1); };   // "engineering" takes no article
    const HER = { mira: 'her', aris: 'her', jaxon: 'him', vance: 'him' };
    const GAP = 250, TALK_GAP = 600;
    const st = () => Slice.state, now = () => Slice.clock.t, emit = Slice.emit;
    const v1 = id => SEC1.places.find(p => p.id === id) || {};
    let shade = null, MOM = null;                                                          // script/shade.js, script/moments.js (made in init)
    const wordsIn = s => (String(s).trim().match(/\S+/g) || []).length;
    const readMs = line => Math.max(3200, wordsIn(line) * 300 + 1600);                    // reading.js's own time for a line
    const both = ids => ids.map(c => NAMES[c]).join(' and ');
    const felt = () => st().price !== 'numbers';
    const chips = (f, n) => (felt() ? f : n);
    const PARTS = ['ScriptText', 'ScriptShade', 'ScriptMoments'].filter(k => !Slice[k]);
    if (PARTS.length) { console.error(`Slice: script.js needs script/lines.js, script/shade.js and script/moments.js loaded before it (missing ${PARTS.join(', ')})`); return; }
    const { LINES, REMARKS, PLACES, NAMED } = Slice.ScriptText;          // the words and the places (script/lines.js)

    const orderOf = id => (id === 'light' ? 4 : ORDER[id] || 0);
    const placeName = id => (id === 'rhea' && !st().places.rhea.named ? NAMED.contact[0] : PLACES[id] ? PLACES[id].name : id);
    function clickable(id) {
        const s = st(), pl = s.places[id];
        return !!pl && pl.status === 'ahead' && orderOf(id) > orderOf(s.route.at);
    }
    const jumpCost = () => E.jump * (Slice.broken('engineering') ? 2 : 1);
    const jumpRations = () => E.jumpRations + (Slice.broken('hold') ? E.holdRations : 0);
    function price(id) {
        const s = st();
        if (id === 'light') { const cost = jumpCost(), r = jumpRations(); return { open: !!s.flags.light && s.mode === 'travel', cost, free: false, jump: true, rations: r, line: `${cost} energy · ${r} rations` }; }
        if (!PLACES[id]) return null;
        const free = id === 'rhea' && s.flags.dated, cost = free ? 0 : Slice.broken('bridge') ? E.pullInBridge : E.pullIn;
        const line = free ? 'no energy · their last course' : id === 'kryos' ? `${cost} energy · fills the tanks` : `${cost} energy · ${Math.max(0, s.res.energy - cost)} left`;
        return { open: clickable(id), cost, free, jump: false, rations: 0, line };
    }
    function note(id) {
        const s = st();
        if (id === 'light') return { name: 'The light', tag: s.flags.light ? 'The jump is ready' : 'Far ahead', line: s.flags.light && !felt() ? price('light').line : null };
        const pl = s.places[id]; if (!pl) return null;
        const named = id !== 'rhea' || pl.named, base = named ? NAMED[id] : NAMED.contact;
        let tag = base[1];
        if (pl.status === 'visited') tag = id === 'erebus' && pl.did === 'cells' ? 'We took their cells' : pl.did === 'stripped' ? 'We stripped it for parts' : pl.did === 'marker' ? 'We left them a marker' : pl.did === 'left' ? 'We left it' : base[2];
        else if (pl.status === 'passed') tag = 'Behind us';
        const pr = price(id);
        return { name: base[0], tag, line: !felt() && pr && pr.open ? pr.line : null };
    }
    const teamLine = (id, ids) => (ids && ids.length ? `${both(ids)} ${id === 'zeta' ? (ids.length > 1 ? 'go' : 'goes') + ' aboard' : (ids.length > 1 ? 'take' : 'takes') + ' the shuttle'}` : '');
    const goodFor = id => { const l = LINES.goodFor[id]; return l ? { who: l[0], text: l[1] } : null; };
    function deckChips(deck) {
        const D = LINES.deck, live = (felt() ? D.liveFelt : D.liveNum)[deck] || '';
        return [{ choice: 'fix', verb: D.fix, chip: chips('costs salvage', `−${E.fix} salvage`) }, { choice: 'patch', verb: D.patch, chip: chips(D.patchFelt, D.patchNum) }, { choice: 'live', verb: D.live, chip: live }];
    }
    function crewList() {
        const s = st(), status = id => (s.crew[id].status === 'hurt' ? 'INJURED' : 'HEALTHY');
        return [{ name: 'Cora', tags: ['LEADER'], status: 'HEALTHY' }, { name: 'Jaxon', tags: ['ENGINEER'], status: status('jaxon') }, { name: 'Aris', tags: ['MEDIC'], status: status('aris') },
            { name: 'Vance', tags: ['SECURITY'], status: status('vance') }, { name: 'Mira', tags: ['SPECIALIST'], status: status('mira') }];
    }

    // ═══ 3. WRITING THE STATE: resources, crew, decks, places, the record. Every change is told on the bus ═══
    function currentStop() {
        const s = st();
        if (s.sector > 1) return 'Arrival';
        if (['dive-in', 'stop', 'dive-out'].includes(s.mode) && PLACES[s.route.at]) return placeName(s.route.at);
        if (['jump', 'corridor', 'meal'].includes(s.mode)) return 'The jump';
        return s.stops ? 'On the way' : 'Waking up';
    }
    function logRecord(text, o = {}) {
        const s = st(), item = { sector: s.sector, t: Math.round(now()), text, stop: o.stop || currentStop() };
        ['who', 'story', 'routine', 'page', 'chips'].forEach(k => { if (o[k]) item[k] = o[k]; });
        s.record.push(item);
    }
    const unit = (k, v) => (k === 'rations' && Math.abs(v) === 1 ? 'ration' : k);
    const chipsOf = real => Object.keys(real).filter(k => real[k]).map(k => [`${real[k] > 0 ? '+' : '−'}${Math.abs(real[k])} ${unit(k, real[k])}`, real[k] > 0 ? 'gain' : 'spend']);
    /** Changes the stores (capped), tells everyone, and writes the real numbers in the record. */
    function spend(delta, why, text, o) {
        const s = st(), real = {};
        Object.keys(delta).forEach(k => { const b = s.res[k]; s.res[k] = Math.max(0, Math.min(E.cap[k], b + delta[k])); real[k] = s.res[k] - b; });
        emit('res:changed', { res: Object.assign({}, s.res), delta: real, why });
        if (text) logRecord(text, Object.assign({ chips: chipsOf(real) }, o));
        return real;
    }
    function setCrew(id, patch) {
        const c = st().crew[id]; if (!c) return;
        Object.assign(c, patch); c.stress = Math.max(0, Math.min(3, c.stress)); emit('crew:changed', { id });
    }
    const stress = (id, d) => setCrew(id, { stress: st().crew[id].stress + d });
    function setDeck(deck, v) { st().decks[deck] = v; emit('deck:changed', { deck }); }
    function setPlace(id, patch) { Object.assign(st().places[id], patch); emit('place:changed', { id }); }
    const deckKey = d => (d === 'cargo' ? 'hold' : d);
    const aboard = () => CREW.filter(id => st().crew[id].status === 'well');            // aboard and able (not away, not hurt)
    const breakPatched = () => Slice.DECKS.forEach(d => { if (st().decks[d] === 'patched') { setDeck(d, 'worse'); logRecord(`The patch on ${theDeck(d)} broke. Only a fix will bring it back.`); } });

    // ═══ 4. VOICES: one line at a time, timed on the slice clock so a still at ?t= is the same picture as play ═══
    let reading = null, epoch = 0, speaking = null, talkHold = 0, readingHold = false, lastHoldOn = false;
    let lastBeat = 0, lastClick = 0, lastNudge = 0, lastXY = null;
    const live = fn => { const ep = epoch; return (...a) => { if (ep === epoch) fn(...a); }; };
    function beat(id) { lastBeat = now(); emit('beat', { id }); }
    const anchorFor = who => (who === AURA ? 'aura' : IDS[who] ? 'person:' + IDS[who] : 'aura');
    /** Says one line beside whoever speaks; next() runs when it has been read (its time on the clock, or Space). */
    function sayLine(who, text, o, next) {
        o = o || {};
        const tok = { who, done: false, advanced: false };
        const fin = live(() => { if (tok.done) return; tok.done = true; Slice.cancel(tok.timer); if (speaking === tok) speaking = null; if (next) next(); });
        speaking = tok;
        beat('say:' + (IDS[who] || 'aura'));
        if (reading) reading.say(who, text, { anchor: o.anchor || anchorFor(who), from: o.from }).then(ok => { if (ok && tok.advanced) fin(); });
        tok.timer = Slice.after(readMs(text) + GAP, fin);
    }
    function sayLines(list, next, alive) {
        const todo = list.filter(Boolean);
        const step = i => { if (alive && !alive()) return; if (i >= todo.length) { if (next) next(); return; } const [who, text, o] = todo[i]; sayLine(who, text, o, () => step(i + 1)); };
        step(0);
    }
    function sayOnce(key, line, o) { const s = st(); if (s.flags.said[key]) return false; s.flags.said[key] = true; sayLine(line[0], line[1], o); return true; }
    /** A question with numbered choices, away from the last click; it ignores clicks for its first 400 ms (SPEC §10.4). */
    function askLine(who, text, choices, o, cb) {
        o = o || {};
        beat('ask');
        speaking = null;
        if (!reading) { Slice.after(0, live(() => cb(0))); return; }
        reading.ask(who, text, choices, { anchor: o.anchor || anchorFor(who) }).then(live(i => cb(i)));
        const asks = document.querySelectorAll('#reading .voice.is-ask'), el = asks[asks.length - 1];
        if (el) { el.style.pointerEvents = 'none'; Slice.after(400, () => { el.style.pointerEvents = ''; }); }
    }
    const holdTalk = on => { talkHold += on ? 1 : -1; st().hold = Math.max(0, st().hold + (on ? 1 : -1)); };
    function showPage(page, cb) { beat('page:' + page.id); reading ? reading.showPage(page).then(live(cb)) : Slice.after(0, live(cb)); }
    /** The one way this module plays a real minigame: through stop.js (SPEC §9). Never rejects. */
    function minigame(id, opts) {
        const stop = Slice.mods.stop;
        beat('minigame:' + id);
        if (!stop || typeof stop.minigame !== 'function') return Promise.resolve({ failed: true });
        return stop.minigame(id, opts).then(r => r || { failed: true }, () => ({ failed: true }));
    }

    // ═══ 6. TRAVEL: pointing, going, the cancel window, forks, the hint, the light ═══
    let hover = null, previewing = null, lockTimer = 0, flightTimer = 0, jumpTimer = 0, openTimer = 0, mealTimer = 0, signsTimer = 0, hintEl = null;
    function preview() {
        const s = st(), pr = hover ? price(hover) : null;
        if (!pr || !pr.open || s.mode !== 'travel' || s.route.locked) { if (previewing) { previewing = null; emit('price:preview', null); } return; }
        previewing = hover;
        emit('price:preview', { id: hover, cost: pr.cost, free: pr.free, mode: s.price, line: pr.line, jump: pr.jump, rations: pr.rations });
        if (speaking) return;                                                            // A.U.R.A.'s price line, once per world, only when it matters
        const left = s.res.energy - pr.cost;
        if (hover === 'kryos' && s.res.energy < E.kryosLow) sayOnce('price:kryos', LINES.price.kryos);   // fun playtest: not at 95
        else if (hover === 'kryos' && aboard().includes('jaxon')) sayOnce('price:kryosMetal', LINES.price.kryosMetal);
        else if (hover === 'rhea' && !s.flags.dated && (s.flags.fixOn === 'late' || s.flags.fixOn === 'carried')) sayOnce('price:fixLate', LINES.price.fixLate);
        else if (hover === 'rhea' && !s.flags.dated) sayOnce('price:contact', LINES.price.contact);
        else if (!pr.jump && left < jumpCost() + E.pullIn) sayOnce('price:onlyJump:' + hover, LINES.price.onlyJump);
    }
    function onHover(p) {
        const id = p && p.id ? p.id : null;
        if (id && !st().flags.said.pointed) { st().flags.said.pointed = true; hideHint(); }
        if (id === hover) return;
        hover = id; preview();
    }
    function onWorldClick(p) {
        const s = st(), id = p ? p.id || null : null;
        lastClick = now();
        if (s.route.locked) { if (!id) cancelRoute(); return; }                         // a second click on the world does nothing
        if (s.mode === 'flight') { if (id && id !== s.route.target && PLACES[id] && clickable(id)) switchTo(id); return; }
        if (s.mode !== 'travel' || !id || s.hold > 0) return;
        if (!s.flags.said.pointed) { s.flags.said.pointed = true; hideHint(); }
        if (id === 'light') {
            if (s.flags.light) { lockRoute('light'); return; }
            const l = s.places.rhea.named ? LINES.lightEarlyNamed : LINES.lightEarly;
            if (!reading || !reading.isShowing(l[1])) sayLine(l[0], l[1]);
            return;
        }
        const pl = s.places[id]; if (!pl) return;
        if (pl.status === 'passed') { sayOnce('passed:' + id, LINES.passed); return; }
        if (clickable(id)) lockRoute(id);
    }
    function lockRoute(id) {
        const s = st(), pr = price(id);
        cutOpening();
        s.route.locked = true; s.route.target = id; s.mode = 'flight';
        if (s.places[id]) setPlace(id, { status: 'target' });
        previewing = null;
        emit('route:go', { id, cost: pr.cost });
        beat('route:go');
        if (id !== 'light') {
            const r = id === 'rhea' && !s.places.rhea.named ? LINES.react.contact : LINES.react[id];
            const who = r && (r[0] === AURA || st().crew[IDS[r[0]]].status !== 'away') ? r : null;
            if (who) sayLine(who[0], who[1]);
        }
        lockTimer = Slice.after(1000, () => fire(id, pr));
    }
    function cancelRoute() {
        const s = st(), id = s.route.target;
        Slice.cancel(lockTimer);
        s.route.locked = false; s.route.target = null; s.mode = 'travel';
        if (s.places[id] && s.places[id].status === 'target') setPlace(id, { status: 'ahead' });
        emit('route:cancel', { id });
        beat('route:cancel');
        preview();
    }
    function fire(id, pr) {
        const s = st();
        s.route.locked = false;
        if (id === 'light') {
            spend({ energy: -pr.cost }, 'jump', 'Jumped toward the light.', { stop: 'The jump', story: true });
            emit('route:fired', { id, cost: pr.cost });
            s.mode = 'jump';
            emit('jump:start', {});
            beat('jump:start');
            jumpTimer = Slice.after(5000, () => onJumpFlash());
            return;
        }
        if (pr.cost) spend({ energy: -pr.cost }, 'pull-in', `Set course for ${placeName(id)}.`);
        else logRecord(`Flew their last course to ${placeName(id)}. It cost no energy.`, { chips: [['no energy', 'gain']] });
        emit('route:fired', { id, cost: pr.cost });
        beat('route:fired');
        armFlight(id);
    }
    const armFlight = id => { Slice.cancel(flightTimer); flightTimer = Slice.after((id === 'rhea' ? 9000 : 7000) + 3000, () => onArrived({ id: st().route.target })); };
    function switchTo(id) {
        const s = st(), old = s.route.target;
        if (!id || id === old || !clickable(id)) return;
        if (s.places[old] && s.places[old].status === 'target') setPlace(old, { status: 'ahead' });
        s.route.target = id; setPlace(id, { status: 'target' });
        logRecord(`Turned for ${placeName(id)} instead.`, { routine: true });
        beat('route:switch');
        armFlight(id);
    }
    function onArrived(p) {
        const s = st(), id = p && p.id;
        if (s.mode !== 'flight' || !id || !PLACES[id] || id !== s.route.target) return;
        Slice.cancel(flightTimer);
        s.route.at = id; s.route.target = null;
        if (PLACES[id].fork === 1) s.route.fork1 = id;
        if (PLACES[id].fork === 2) s.route.fork2 = id;
        Object.keys(s.places).forEach(k => {
            if (k === id) setPlace(k, { status: 'here' });
            else if (['ahead', 'target'].includes(s.places[k].status) && orderOf(k) <= orderOf(id)) setPlace(k, { status: 'passed' });
        });
        s.stops += 1;
        if (s.crew.jaxon.ask === 'open') { setCrew('jaxon', { ask: 'his-way' }); s.flags.jaxonOff = true; s.flags.noSurge = true; logRecord('Jaxon took his day on the drive. Nobody answered him.', { routine: true }); }
        newStop(id);
        s.mode = 'dive-in';
        emit('dive:start', { id });
        beat('dive:start');
    }
    function showHint() {
        const s = st();
        if (s.flags.said.hint || s.flags.said.pointed || !s.places.titan || s.places.titan.status !== 'ahead') return;
        s.flags.said.hint = true;
        hintEl = document.createElement('p'); hintEl.className = 'slice-hint'; hintEl.textContent = LINES.hint;
        document.getElementById('reading').appendChild(hintEl);
        beat('hint');
        Slice.after(25000, hideHint);                                                    // playtest 1: it stayed up a minute while the crew was poked
        placeHint();
    }
    function placeHint() {
        if (!hintEl) return;
        if (st().mode !== 'travel') { hideHint(); return; }
        const f = Slice.anchors.get('place:titan'); let list = null; try { list = f ? f() : null; } catch (err) { list = null; }
        if (!list || !list.length) { hintEl.style.opacity = '0'; return; }
        const w = hintEl.offsetWidth, h = hintEl.offsetHeight, boxes = list.filter(Boolean).map(a => {      // of the sides the world offers, the emptiest sky
            let x = a.side === 'left' ? a.x - w - 12 : a.side === 'right' ? a.x + 12 : a.x - w / 2, y = a.side === 'above' ? a.y - h - 8 : a.side === 'below' ? a.y + 8 : a.y - h / 2;
            x = Math.max(16, Math.min(innerWidth - w - 16, x)); y = Math.max(16, Math.min(innerHeight - h - 16, y));
            return { x, y, v: shade.WorldAdapter.luma({ x, y, w, h }) };
        }).sort((p, q) => p.v - q.v);
        const { x, y } = boxes[0];
        hintEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; hintEl.style.opacity = '1';
        shade.shades.set('hint', { x, y, w, h, strength: 0.5 });
    }
    function hideHint() { if (hintEl) { hintEl.remove(); hintEl = null; } if (shade) shade.shades.delete('hint'); }
    let opening = null;                                                                  // the arrival lines while they run: { cut }
    function startOpening() {
        const s = st();
        if (s.flags.said.arrive) return;
        s.flags.said.arrive = true;
        Slice.cancel(openTimer);
        const L = LINES.arrive, tok = opening = { cut: false };
        sayLines([[L[0][0], L[0][1]], [L[1][0], L[1][1]], [L[2][0], L[2][1]]], () => { opening = null; s.flags.said.arriveDone = true; beat('arrive:done'); }, () => !tok.cut);
    }
    /** A course set (or a world clicked) during the arrival lines: the line now finishes, the rest are not said. */
    function cutOpening() {
        const s = st();
        Slice.cancel(openTimer);
        if (!s.flags.said.arrive) s.flags.said.arrive = true;
        if (opening) { opening.cut = true; opening = null; }
        if (!s.flags.said.arriveDone) { s.flags.said.arriveDone = true; beat('arrive:done'); }
    }

    // ═══ 7. A STOP: arrive, the pick, the crisis aboard, the site, back, leave (SPEC §3.2, §8.2) ═══
    let stopRun = null;
    const newStop = (id, acted) => { stopRun = { id, phase: null, acted: !!acted, picked: [], hadPick: false }; };
    function eligible() {
        const s = st(), fixingJaxon = s.flags.fixer === 'jaxon' && Slice.DECKS.some(d => s.decks[d] === 'fixing');
        return CREW.filter(id => s.crew[id].status === 'well' && !(id === 'jaxon' && (s.flags.jaxonOff || fixingJaxon)));
    }
    function setPhase(phase, extra) {
        if (!stopRun || st().mode !== 'stop') return;                                  // left already (Leave orbit during the last line)
        const id = stopRun.id, Pl = PLACES[id];
        stopRun.phase = phase;
        if (phase === 'pick') stopRun.hadPick = true;
        emit('stop:phase', Object.assign({ id, phase, sign: signOf(id), eligible: eligible(), verb: Pl.verb, act: Pl.act, team: Pl.team, crew: st().team.slice() }, extra));
        beat('phase:' + phase);
    }
    /** The breach comes on the second pull-in, dated or not (playtest 2: putting off the dating skipped the sector's crisis). */
    const breachDue = () => { const s = st(); return !s.flags.breachDone && s.stops >= 2; };
    /** Engineering can still surge: not yet, not on Jaxon's day, not while it is already down. */
    const surgeOpen = () => { const s = st(); return !s.flags.noSurge && !s.flags.surgeDone && !Slice.broken('engineering'); };
    /** The sign aboard before the pick. A breach due shows as the hull at any team stop (Erebus, or Rhea straight from Titan);
        the surge's sign shows at Titan, and again at Rhea while it has not come. A sign is a risk: see crisisAboard. */
    function signOf(id) {
        const Pl = PLACES[id];
        if (breachDue() && Pl.team) return 'hull';
        if (Pl.sign === 'surge') return surgeOpen() ? 'surge' : null;
        if (id === 'rhea' && surgeOpen() && st().flags.said.signSurge) return 'surgeAgain';
        if (Pl.sign === 'hull') return null;
        return Pl.sign;
    }
    function onStopShown(p) {
        const s = st(), id = p && p.id;
        if (!id || !PLACES[id] || s.mode === 'stop') return;
        if (!stopRun || stopRun.id !== id) newStop(id);
        s.mode = 'stop';
        if (id === 'rhea' && !s.places.rhea.named) setPlace('rhea', { named: true });   // integrator: in orbit the contact has its name (the bridge shows it; the record agrees)
        arrive(id);
    }
    function arrive(id) {
        const sign = signOf(id), list = [LINES.arriveAt[id]];
        if (sign && LINES.sign[sign]) list.push(LINES.sign[sign]);
        if (sign === 'surge') st().flags.said.signSurge = true;
        if (stopRun) stopRun.sign = sign;
        setPhase('arrive');
        sayLines(list.map(l => [l[0], l[1]]), () => {
            if (PLACES[id].team) { setPhase('pick'); return; }
            if (id === 'kryos' && breachDue()) breach(() => setPhase('arrive', { ready: true }));
        });
    }
    function onPick(p) { if (stopRun && p && Array.isArray(p.ids)) stopRun.picked = p.ids.filter(c => CREW.includes(c)).slice(0, 2); }
    function onAct(p) {
        const s = st();
        if (!stopRun || !p || p.id !== stopRun.id || stopRun.acted || s.mode !== 'stop') return;
        const id = stopRun.id;
        if (PLACES[id].act === 'skim') { stopRun.acted = true; skim(); return; }
        const can = eligible(), team = stopRun.picked.filter(c => can.includes(c));
        if (!team.length || team.length < Math.min(2, can.length)) { if (!speaking) sayLine(LINES.pickTwo[0], LINES.pickTwo[1]); return; }
        stopRun.acted = true;
        s.team = team.slice();
        team.forEach(c => setCrew(c, { status: 'away' }));
        logRecord(`${both(team)} ${id === 'zeta' ? 'went aboard' : 'took the shuttle down'}.`, { routine: true });
        setPhase('away');
        Slice.after(2500, () => crisisAboard(id, () => site(id)));
    }
    /** While the team is down: the breach when it is due (it always comes, once); a surge only about half the time, so the
        sign is a risk and keeping Jaxon aboard is a gamble (SHIP_GAMEPLAY §4; playtest 2). The draw is the run's (?seed=). */
    function crisisAboard(id, next) {
        const sign = stopRun && stopRun.sign !== undefined ? stopRun.sign : signOf(id);   // a MOCKUP moment that skipped arrive() reads it fresh
        if (sign === 'hull' && breachDue()) { breach(next); return; }
        if ((sign === 'surge' || sign === 'surgeAgain') && surgeOpen() && Slice.chance('surge:' + id, E.crisisOdds)) { surge(next); return; }
        next();
    }
    /** Is a deck fix taking both hands aboard this trip? Then the next crisis goes unanswered (SPEC §8.4). */
    const busyFixing = () => st().flags.fixer === 'both' && Slice.DECKS.some(d => st().decks[d] === 'fixing');
    function surge(next) {
        const s = st(), S = LINES.surge, on = aboard();
        s.flags.surgeDone = true;
        breakPatched();
        if (busyFixing()) { setDeck('engineering', 'red'); logRecord('Power surge in engineering. Nobody was free; engineering is down.'); sayLines([S.announce, S.nobody], next); return; }
        if (on.includes('jaxon')) { logRecord('Power surge in engineering. Jaxon fixed it at no cost.'); sayLines([S.announce, S.jaxon], next); return; }
        const a = on[0] || 'vance', b = on[1] || a;
        sayLines([S.announce, [NAMES[a], S.noJaxon]], () => askLine(NAMES[b], S.ask, [
            { verb: 'Shut the drive down', chips: [[chips('engineering goes dark', 'engineering red'), 'loss']] },
            { verb: 'Let it run', chips: [[chips('burns energy', `−${E.surge} energy`), 'loss']] }], {}, i => {
            if (i === 0) { setDeck('engineering', 'red'); logRecord('Power surge in engineering. We shut the drive down; engineering is red.'); sayLines([S.shut], next); }
            else { spend({ energy: -E.surge }, 'surge', 'Power surge in engineering. We let it run.'); sayLines([S.run], next); }
        }));
    }
    function breach(next) {
        const s = st();
        s.flags.breachDone = true;
        breakPatched();
        sayLine(LINES.breach.announce[0], LINES.breach.announce[1], {}, () => {
            const inDrive = s.flags.jaxonOff && s.crew.jaxon.status === 'well';            // his day on the drive: he is inside it (fun playtest: the day cost nothing)
            const crew = ['aris', 'mira', 'vance', 'jaxon'].map(id => ({ id, alive: !s.team.includes(id) && !(id === 'jaxon' && inDrive), injured: s.crew[id].status === 'hurt' }));
            minigame('breach', { crew, sector: 1 }).then(live(res => {
                const out = applyBreach(res);
                if (inDrive) { logRecord('Jaxon was inside the drive for his day. He could not help with the breach.'); out.unshift(['Jaxon', LINES.jaxon.inDrive]); }
                sayLines(out, next);
            }));
        });
    }
    function applyBreach(res) {
        const s = st(), out = [];
        if (!res || res.failed) return out;
        const deck = deckKey(res.damagedDeck), air = Math.round(res.airLostPercent || 0);
        if (deck && s.decks[deck] != null) { setDeck(deck, 'red'); logRecord(`Micrometeorite strike. The ship lost ${air}% of its air. ${TheDeck(deck)} is sealed off.`, { chips: [[`−${air}% air`, 'loss']] }); }
        else { logRecord(`Micrometeorite strike. The ship lost ${air}% of its air before the hole was patched.`); out.push(LINES.breach.sealed); }
        const hurt = (res.hurt || []).filter(id => CREW.includes(id) && !s.team.includes(id));
        if (!hurt.length) return out;
        const vanceHolds = s.crew.vance.status === 'well' && !hurt.includes('vance'), arisTreats = s.crew.aris.status === 'well' && !hurt.includes('aris');
        if (vanceHolds) { logRecord(`Vance pulled ${both(hurt)} out before the deck sealed.`); out.push(['Vance', `I pulled ${hurt.length > 1 ? 'them' : HER[hurt[0]]} out before it sealed.`]); return out; }
        if (arisTreats) { logRecord(`${both(hurt)} caught in the breach. Aris treated ${hurt.length > 1 ? 'them' : HER[hurt[0]]} at once.`); out.push(['Aris', `I've treated ${hurt.length > 1 ? 'them' : HER[hurt[0]]}. No lasting harm.`]); return out; }
        hurt.forEach(id => { setCrew(id, { status: 'hurt' }); logRecord(`${NAMES[id]} was caught in the breach and is injured.`, { chips: [['injured', 'loss']] }); });
        out.push([AURA, `${both(hurt)} ${hurt.length > 1 ? 'are' : 'is'} hurt, Commander. In the med bay now.`]);
        return out;
    }
    /** Kryos: the skim, then one choice of its own (fun playtest: a full ship had no reason to come). Skim the top, or take her
        down into the low bands for wreck metal, where a ring stone scrapes the hull about half the time and a deck seals off. */
    function skim() {
        setPhase('site');
        const s = st(), K = LINES.kryos, on = aboard(), who = on.includes('jaxon') ? 'jaxon' : on[0];
        const real = spend({ energy: E.skim }, 'skim', 'Skimmed fuel at Kryos-68 Prime.');
        setPlace('kryos', { did: 'skimmed' });
        const full = s.res.energy >= E.cap.energy, after = [full ? v1('kryos').orbit.steps[0].then : [AURA, "That's all this pass can give us, Commander."]];
        const leave = () => setPhase('leave', { gained: real.energy });
        if (!who) { sayLines(after, leave); return; }
        sayLines(after, () => askLine(NAMES[who], K.ask, [
            { verb: 'Skim the top', chips: [] },
            { verb: 'Take her down', chips: [[chips('salvage', `+${E.deepSalvage} salvage`), 'gain'], [chips('a scrape, maybe', 'a scrape, half the time'), 'loss']] }], {}, i => {
            if (i === 0) { logRecord('Stayed in the top clouds of Kryos-68 Prime.', { routine: true }); leave(); return; }
            spend({ salvage: E.deepSalvage }, 'deep', 'Took her down into the low bands of Kryos-68 Prime for wreck metal.');
            if (!Slice.chance('scrape:kryos', E.scrapeOdds)) { sayLines([[NAMES[who], K.clean]], leave); return; }
            breakPatched();
            const deck = ['hold', 'quarters', 'medbay'].find(d => s.decks[d] === 'ok');
            if (deck) { setDeck(deck, 'red'); logRecord(`A ring stone scraped the hull in the low bands. ${TheDeck(deck)} is sealed off.`, { chips: [['scrape', 'loss']] }); }
            sayLines([[AURA, K.scrape.replace('{deck}', theDeck(deck || 'hold'))]], leave);
        }));
    }
    function site(id) {
        setPhase('site');
        const done = () => back(id);
        if (id === 'titan') siteTitan(done); else if (id === 'zeta') siteZeta(done); else if (id === 'erebus') siteErebus(done); else if (id === 'rhea') siteRhea(done); else done();
    }
    const radio = { anchor: 'radio', from: 'on the radio' };
    const speakerOf = (team, prefer) => prefer.find(c => team.includes(c)) || team[0];
    function siteTitan(done) {
        const s = st(), team = s.team, cutter = speakerOf(team, ['jaxon']), spotter = team.find(c => c !== cutter) || cutter;
        minigame('torch', { mode: 'hatch', hull: 'EXODUS-4', sector: 1, cutter: NAMES[cutter], spotter: NAMES[spotter] }).then(live(res => {
            const tanks = res && !res.failed && res.tanks ? res.tanks : 1, extra = Math.max(0, tanks - 1 - (team.includes('jaxon') ? 1 : 0));
            if (extra) spend({ salvage: -extra * E.tank }, 'torch', `Cut the hatch of EXODUS-4. It took ${tanks} tanks.`);
            else logRecord('Cut the hatch of EXODUS-4.', { routine: true });
            stockpile(() => stripOrMarker('titan', () => findDisc(() => { s.flags.fixOn = team.includes('mira') ? 'carried' : 'late'; s.flags.fixAt = s.stops; done(); })));
        }));
    }
    function stockpile(next) {
        const team = st().team, S = DATA.SCENE_STOCKPILE;
        const lines = team.map(c => S.lines.find(([who]) => IDS[who] === c) || LINES.stockpile[c]).filter(Boolean);   // one line a person (playtest 1)
        shade.playFilm({ key: S.key, title: S.title, narration: S.narration, lines, choices: [] }, () => next());
    }
    function stripOrMarker(id, next) {
        const s = st(), team = s.team, who = speakerOf(team, ['jaxon', 'aris']), R = LINES.radio, gain = team.includes('jaxon') ? E.stripJaxon : E.strip, hull = PLACES[id].wreck;
        askLine(NAMES[who], R[who], [
            { verb: 'Strip it', chips: [[chips('salvage', `+${gain} salvage`), 'gain']] },
            { verb: 'Leave a marker', chips: [[chips('costs salvage', `−${E.marker} salvage`), 'loss']] }], { anchor: 'radio' }, i => {
            if (i === 0) { spend({ salvage: gain }, 'strip', `Stripped ${hull} for parts.`); stress('aris', 1); setPlace(id, { did: 'stripped' }); sayLines([[NAMES[who], R.strip, radio]], next); return; }
            spend({ salvage: -E.marker }, 'marker', `Left a marker for the crew of ${hull}. Aris wrote their names in her book.`);
            s.flags.platesPending += 1; setPlace(id, { did: 'marker' });
            sayLines([[NAMES[who], R.marker, radio]], next);
        });
    }
    function findDisc(next) {
        const s = st();
        if (s.flags.discFound) { next(); return; }
        s.flags.discFound = true; s.pages.push('disc');
        logRecord(DATA.PAGE_DISC.record, { story: true, page: 'disc' });
        const atWreck = !stopRun || stopRun.id === 'titan';                             // at Rhea (the Zeta way) no bench comes after: the page keeps them
        showPage(atWreck ? Object.assign({}, DATA.PAGE_DISC, { after: [] }) : DATA.PAGE_DISC, next);
    }
    function siteZeta(done) {
        const s = st(), team = s.team, Z = LINES.zeta, who = speakerOf(team, ['aris']), cellWho = speakerOf(team, ['jaxon']);
        sayLines([[NAMES[who], Z.lights, radio]], () => askLine(NAMES[cellWho], Z.cell, [
            { verb: 'Carry it back', chips: [[chips('energy', `+${E.zetaCell} energy`), 'gain'], [chips('a day', `−${E.day} ration`), 'loss']] },
            { verb: 'Leave it', chips: [] }], { anchor: 'radio' }, i => {
            if (i === 0) { spend({ energy: E.zetaCell, rations: -E.day }, 'cell', 'Carried a power cell back from Platform Zeta. It took a day.'); setPlace('zeta', { did: 'cell' }); }
            else { logRecord('Left the power cell on Platform Zeta.', { routine: true }); setPlace('zeta', { did: 'boarded' }); }
            logRecord(v1('zeta').orbit.steps[0].record);
            done();
        }));
    }
    /** A hazard at the site, about half the time (playtest 2). Mira aboard names it first and the team goes round it; otherwise
        Vance takes the hit for the other, Aris walks the hurt back up, and with neither someone comes back to the med bay. */
    function hazard(id, next) {
        const s = st(), team = s.team, H = LINES.hazard, Hp = H[id], key = 'hazard:' + id;
        if (!Hp || !team.length || s.flags.said[key] || !Slice.chance(key, E.hazardOdds)) { next(); return; }
        s.flags.said[key] = true;
        const hull = PLACES[id].wreck;
        if (s.crew.mira.status === 'well' && !team.includes('mira')) {
            logRecord(`Mira scanned ${hull} from the ship and warned the team. They went round it.`);
            sayLines([['Mira', Hp.scan, { anchor: 'person:mira' }]], next); return;
        }
        const r = Slice.rand(s.seed + id.length * 977), hit = team.includes('vance') ? 'vance' : team[Math.floor(r() * team.length) % team.length];
        const other = team.find(c => c !== hit) || hit, list = [[NAMES[other], Hp.fire, radio]];
        if (team.includes('aris')) {
            logRecord(`${NAMES[hit]} was hurt inside ${hull}. Aris strapped ${HER[hit]} up on the spot.`);
            if (hit === 'vance') list.push(['Vance', H.vance, radio]);
            list.push(['Aris', H.aris, radio]);
        } else {
            s.flags.hurtOnReturn = hit;
            logRecord(`${NAMES[hit]} was hurt inside ${hull} and is in the med bay.`, { chips: [['injured', 'loss']] });
            list.push(hit === 'vance' ? ['Vance', H.vance, radio] : [NAMES[other], H.hurt.replace('{Name}', NAMES[hit]).replace('{her}', HER[hit]), radio]);
        }
        sayLines(list, next);
    }
    function siteErebus(done) { hazard('erebus', () => callErebus(done)); }
    function callErebus(done) {
        const s = st(), team = s.team, C = LINES.call, list = [C.aura], spoke = ['aris', 'jaxon'].filter(c => team.includes(c));
        spoke.forEach(c => list.push(C[c]));
        const asker = team.find(c => !spoke.includes(c)) || team[0];
        sayLines(list.map(l => [l[0], l[1], l[0] === AURA ? null : radio]), () => askLine(NAMES[asker], C.ask, [
            { verb: 'Answer it, then switch it off', chips: [[chips('a day', `−${E.day} ration`), 'loss']] },
            { verb: 'Take their power cells', chips: [[chips('energy', `+${E.erebusEnergy} energy`), 'gain'], [chips('salvage', `+${E.erebusSalvage} salvage`), 'gain']] }], { anchor: 'radio' }, i => {
            if (i === 0) {
                spend({ rations: -E.day }, 'day', 'Answered the distress call of EXODUS-7, then switched it off. It took a day.', { story: true });
                stress('aris', -1); setPlace('erebus', { did: 'answered' });
                sayLines(C.answered, done);
                return;
            }
            spend({ energy: E.erebusEnergy, salvage: E.erebusSalvage }, 'cells', 'Took the power cells of EXODUS-7. Its beacon stopped mid-call.');
            stress('aris', 1); setPlace('erebus', { did: 'cells' });
            sayLines([[NAMES[asker], C.cells, radio]], done);
        }));
    }
    function siteRhea(done) {
        const s = st();
        hazard('rhea', () => findDisc(() => {
            s.pages.push('plate');
            logRecord(DATA.PAGE_PLATE.record, { story: true, page: 'plate' });
            setPlace('rhea', { did: 'searched' });
            showPage(DATA.PAGE_PLATE, done);
        }));
    }
    function back(id) {
        const s = st(), team = s.team.slice();
        setPhase('back');
        s.team = [];
        team.forEach(c => { if (s.crew[c].status === 'away') setCrew(c, { status: c === s.flags.hurtOnReturn ? 'hurt' : 'well' }); });
        s.flags.hurtOnReturn = null;
        Slice.DECKS.forEach(d => { if (s.decks[d] === 'fixing') { setDeck(d, 'ok'); logRecord(`${TheDeck(d)} is fixed.`); } });
        s.flags.fixer = null;
        const B = LINES.back, text = id === 'titan' ? (team.includes('mira') ? B.titanFix : B.titan) : B[id], who = speakerOf(team, id === 'titan' ? ['vance'] : []);
        sayLines(text && who ? [[NAMES[who], text]] : [], () => setPhase('leave'));
    }
    function onLeave(p) {
        const s = st();
        if (!stopRun || !p || p.id !== stopRun.id || s.mode !== 'stop') return;
        if (['away', 'site'].includes(stopRun.phase) && s.team.length) { if (!speaking) sayLine(LINES.stillDown[0], LINES.stillDown[1]); return; }
        if (stopRun.phase === 'site' && PLACES[stopRun.id].act === 'skim') return;    // Kryos's question is still open (skim the top or go down)
        s.mode = 'dive-out';
        emit('dive:back', { id: stopRun.id });
        beat('dive:back');
    }
    function onHidden(p) {
        const s = st(), id = p && p.id;
        if (!id || !PLACES[id] || s.mode !== 'dive-out') return;
        s.mode = 'travel';
        setPlace(id, { status: 'visited', did: s.places[id].did || 'left' });
        if (stopRun && stopRun.hadPick) s.flags.jaxonOff = false;
        stopRun = null;
        backAboard(id);
    }
    /** Back on the journey: what the stop leaves in the ship (plates, the fix, pages), and what comes next. */
    function backAboard(id) {
        const s = st();
        beat('aboard:' + id);
        if (s.flags.platesPending) { s.flags.plates += s.flags.platesPending; s.flags.platesPending = 0; emit('plate:up', {}); }
        if (s.flags.fixOn === 'carried' || (s.flags.fixOn === 'late' && s.stops > s.flags.fixAt)) {
            s.flags.fixOn = 'bench'; emit('fix:on-bench', {});
            Slice.after(3000, () => { if (st().flags.fixOn === 'bench' && st().crew.mira.status === 'well') sayOnce('benchWaiting', ['Mira', LINES.bench.disc]); });
        }
        if (id === 'rhea') {
            if (s.pages.includes('plate') && !s.pinned.includes('plate')) { s.pinned.push('plate'); emit('page:pinned', { id: 'plate' }); }
            s.flags.light = true; emit('place:changed', { id: 'light' });
            Slice.after(2500, () => sayOnce('jumpReady', LINES.jumpReady));
        }
        if (s.stops === 1 && !s.flags.signs && !s.flags.signsDue) { s.flags.signsDue = true; signsTimer = Slice.after(25000, () => { if (!dating) showSigns(); }); }
    }

    // ═══ 8. ABOARD: people, the bench, the reactor, red decks, signs, the idle nudge (SPEC §6.3, §8.3, §8.4) ═══
    let dating = false;
    const used = new Set();
    function onShipClick(p) {
        const s = st();
        lastClick = now();
        if (!p || !['travel', 'flight'].includes(s.mode) || (reading && reading.isOpen())) return;
        if (p.what === 'person') person(p.id);
        else if (p.what === 'bench') bench();
        else if (p.what === 'reactor') reactor(p.id);
        else if (p.what === 'deck') deck(p.id || p.deck);
    }
    function person(id) {
        const s = st(), c = s.crew[id];
        if (!c || c.status === 'away') return;
        const talk = s.mode === 'travel' && s.hold === 0;
        if (id === 'vance' && c.moment === 'open' && talk) { vanceTalk(); return; }
        if (id === 'jaxon' && c.ask === 'open' && talk) { jaxonAsk(); return; }
        if (id === 'mira' && s.flags.fixOn === 'bench' && talk) { bench(); return; }
        freeLine(id);
    }
    function freeLine(id) {
        const Sim = window.ShipSimA; if (!Sim) return;
        let key = 'any';
        try { const pose = Sim.at('travel', now()).find(q => q.id === id); if (pose && pose.say) key = pose.say; } catch (err) { key = 'any'; }
        const keys = [key].concat(REMARKS[id] || []), pick = keys.find(k => !used.has(id + ':' + k)) || key;
        used.add(id + ':' + pick);
        const L = Sim.line('travel', id, pick);
        if (L && L.text) sayLine(L.who, L.text, { anchor: L.who === AURA ? 'aura' : 'person:' + id });
    }
    function bench() {
        const s = st(), B = LINES.bench, mira = s.crew.mira.status;
        if (s.flags.fixOn !== 'bench') {
            if (mira !== 'well') return;
            const t = s.flags.dated ? B.done : s.flags.fixOn ? B.late : B.none;
            if (!reading || !reading.isShowing(t)) sayLine('Mira', t);
            return;
        }
        if (Slice.broken('lab')) { sayLine('Mira', B.lab); return; }
        if (mira !== 'well') { sayLine(B.hurt[0], B.hurt[1]); return; }
        if (dating || s.mode !== 'travel') return;
        dating = true;
        minigame('disc', { wreck: { hull: 4, sector: 1 }, plotted: [], crew: crewList(),
            reward: { name: 'Rhea-4 Minor', kind: 'beacon', line: { who: 'Mira', text: 'They saw a lamp on that moon and went to help. They never got there.' } },
            names: ['Kryos-68 Prime', 'Erebus-40 Minor', 'Platform Zeta'] }).then(live(res => { dating = false; if (res && res.dated) dated(res); }));
    }
    function dated(res) {
        const s = st();
        s.flags.dated = true; s.flags.fixOn = null;
        setPlace('rhea', { named: true });
        if (!s.pinned.includes('disc')) { s.pinned.push('disc'); emit('page:pinned', { id: 'disc' }); }
        logRecord(`The disc dates EXODUS-4: dead for ${res.age || 21} years.`, { story: true });
        logRecord('EXODUS-4 was flying to Rhea-4 Minor when it died. Its course is free to fly.', { story: true });
        sayLine(LINES.bench.dated[0], LINES.bench.dated[1]);
        if (s.flags.signsDue && !s.flags.signs) { Slice.cancel(signsTimer); signsTimer = Slice.after(8000, showSigns); }
        preview();
    }
    function showSigns() {
        const s = st();
        if (s.flags.signs || s.mode !== 'travel') { if (!s.flags.signs) { Slice.cancel(signsTimer); signsTimer = Slice.after(10000, showSigns); } return; }
        s.flags.signs = true; s.flags.signsDue = false;
        setCrew('vance', { stress: Math.max(1, s.crew.vance.stress), moment: 'open' });
        setCrew('jaxon', { stress: Math.max(1, s.crew.jaxon.stress), ask: 'open' });
        beat('signs');
        const who = ['mira', 'aris', 'jaxon'].find(c => s.crew[c].status === 'well');
        if (who) sayLine(NAMES[who], LINES.vance.seen[1]);
    }
    function vanceTalk() {
        const V = LINES.vance;
        holdTalk(true);
        sayLines(V.talk.map(t => ['Vance', t]), () => askLine('Vance', V.ask, [{ verb: 'Tell him you believe him', chips: [] }, { verb: 'Say they were for other headings', chips: [] }], {}, i => {
            if (i === 0) { setCrew('vance', { moment: 'believed', stress: st().crew.vance.stress - 1, backed: st().crew.vance.backed + 1 }); stress('mira', 1); logRecord('Vance told you about the shipyard. You said you believe him.', { story: true }); }
            else { setCrew('vance', { moment: 'other-headings', stress: st().crew.vance.stress + 1 }); stress('mira', -1); logRecord('Vance told you about the shipyard. You said those ships were for other headings.'); }
            sayLines([['Vance', i === 0 ? V.believed : V.other]], () => holdTalk(false));
        }));
    }
    function jaxonAsk() {
        const J = LINES.jaxon;
        askLine('Jaxon', J.ask, [{ verb: 'Take the day', chips: [['a calm drive', 'gain'], ['one hand fewer', 'loss']] }, { verb: 'I need you on the team', chips: [['he takes it badly', 'loss']] }], {}, i => {
            const s = st();
            if (i === 0) { setCrew('jaxon', { ask: 'granted', stress: s.crew.jaxon.stress - 1 }); s.flags.jaxonOff = true; s.flags.noSurge = true; logRecord('Jaxon asked for a day on the drive. You gave it to him.'); }
            else { setCrew('jaxon', { ask: 'refused', stress: s.crew.jaxon.stress + 1 }); logRecord('Jaxon asked for a day on the drive. You said no.'); }
            sayLines([['Jaxon', i === 0 ? J.yes : J.no]]);
        });
    }
    let reactorN = 0;
    function reactor(id) {
        const s = st(), on = aboard(), who = on.includes(id) ? id : on.includes('jaxon') ? 'jaxon' : on[0];
        if (!who) return;
        const e = s.res.energy, R = LINES.reactor, list = e >= 70 ? R.high : e >= 35 ? R.mid : R.low;
        sayLine(NAMES[who], list[reactorN++ % list.length], { anchor: 'person:' + who });
    }
    function deck(d) {
        const s = st(), v = s.decks[d], D = LINES.deck, fixer = aboard().includes('jaxon') ? 'Jaxon' : null;
        if (!v || v === 'ok') return;
        if (v === 'fixing') { if (fixer) sayLine(fixer, D.fixing); return; }
        if (v === 'patched') { if (fixer) sayLine(fixer, D.isPatched); return; }
        emit('deck:ask', { deck: d, chips: deckChips(d) });
        beat('deck:ask');
    }
    function onDeckChoice(p) {
        const s = st(), d = p && p.deck, D = LINES.deck;
        if (!d || !['red', 'worse'].includes(s.decks[d])) return;
        s.flags.said['deck:' + d] = true;
        if (p.choice === 'fix') {
            if (s.res.salvage < E.fix) { sayLine(D.noSalvage[0], D.noSalvage[1]); return; }
            spend({ salvage: -E.fix }, 'fix', `Ordered a fix for ${theDeck(d)}. It is done on the next trip.`);
            const jax = s.crew.jaxon.status === 'well' && !s.flags.jaxonOff;
            s.flags.fixer = jax ? 'jaxon' : 'both'; setDeck(d, 'fixing');
            sayLines([jax ? D.fixJaxon : D.fixBoth]);
        } else if (p.choice === 'patch') {
            if (s.decks[d] === 'worse') { sayLine(D.worse[0], D.worse[1]); return; }
            if (s.res.salvage < E.patch) { sayLine(D.noSalvage[0], D.noSalvage[1]); return; }
            setDeck(d, 'patched'); spend({ salvage: -E.patch }, 'patch', `Patched ${theDeck(d)}. It will hold until the jump at most.`);
            const who = aboard()[0]; if (who) sayLine(NAMES[who], D.patched);
        } else if (p.choice === 'live') { s.flags.lived[d] = true; logRecord(`Chose to live with ${d === 'engineering' ? 'broken engineering' : 'the broken ' + DECK_NAME[d]}.`); beat('deck:live'); }
    }
    /** Nothing happened for 30 s in travel: one thing happens on a seen deck, at most one every 30 s (SPEC §6.3). */
    function nudge() {
        const s = st(), on = aboard();
        lastNudge = now();
        if (s.flags.signsDue && !s.flags.signs && !dating) { Slice.cancel(signsTimer); showSigns(); return; }
        if (s.flags.fixOn === 'bench' && on.includes('mira') && sayOnce('benchWaiting', ['Mira', LINES.bench.disc])) return;
        if (s.flags.fixOn === 'bench' && !s.flags.dated && sayOnce('curiosity', LINES.bench.curiosity)) return;
        const red = Slice.DECKS.find(d => ['red', 'worse'].includes(s.decks[d]) && !s.flags.lived[d] && !s.flags.said['deck:' + d]);
        if (red) { s.flags.said['deck:' + red] = true; const who = on.includes('jaxon') ? 'Jaxon' : AURA; sayLine(who, LINES.deck.nag.replace('{Deck}', TheDeck(red))); return; }
        if (s.crew.jaxon.ask === 'open' && on.includes('aris') && sayOnce('jaxonTools', LINES.jaxon.tools)) return;
        if (s.flags.light && sayOnce('jumpNudge', LINES.jumpNudge)) return;
        if (nextStep()) return;
        const pool = []; on.forEach(id => (REMARKS[id] || []).forEach(k => { if (!used.has(id + ':' + k)) pool.push([id, k]); }));
        if (!pool.length || !window.ShipSimA) return;
        const [id, k] = pool[Math.floor(Slice.rand(Math.round(now()) + pool.length)() * pool.length)];
        used.add(id + ':' + k);
        const L = window.ShipSimA.line('travel', id, k);
        if (L && L.text) sayLine(L.who, L.text, { anchor: 'person:' + id });
    }

    /** Where to go next, out of a crew mouth: once at the first quiet nudge, then a short A.U.R.A. reminder every 90 s
        (playtest 1: a player who missed Rhea sat 4 minutes hearing only routine remarks). */
    let lastNext = -1e9;
    function nextStep() {
        const s = st(), N = LINES.next, ok = id => clickable(id), well = id => s.crew[id] && s.crew[id].status === 'well';
        let key = null, line = null, place = null;
        if (s.stops === 0 && (ok('titan') || ok('zeta'))) { key = 'fork1'; place = 'titan'; line = well('vance') ? N.fork1 : null; }
        else if (!s.route.fork2 && (ok('erebus') || ok('kryos'))) { key = 'fork2'; place = ok('erebus') ? 'erebus' : 'kryos'; line = well('aris') ? N.fork2 : null; }
        else if (ok('rhea')) { key = 'rhea'; place = 'rhea'; line = s.flags.dated ? N.rheaFree : well('mira') ? N.contact : N.contactAura; }
        if (!key) return false;
        if (!s.flags.said['next:' + key]) { s.flags.said['next:' + key] = true; lastNext = now(); const L = line || [AURA, N.again.replace('{Place}', placeName(place))]; sayLine(L[0], L[1]); return true; }
        if (now() - lastNext < 90000) return false;
        lastNext = now();
        sayLine(AURA, N.again.replace('{Place}', placeName(place)));
        return true;
    }

    // ═══ 9. THE JUMP, THE CORRIDOR, THE MEAL, SECTOR 2 ═══
    function onJumpFlash() {
        const s = st();
        Slice.cancel(jumpTimer);
        if (s.mode !== 'jump') return;
        s.mode = 'corridor';
        if (reading) reading.clear();
        const damaged = {};
        Slice.DECKS.forEach(d => { if (['red', 'worse', 'fixing'].includes(s.decks[d]) && d !== 'medbay') damaged[d === 'hold' ? 'cargo' : d] = true; });
        minigame('corridor', { fromSector: 1, toSector: 2, crew: crewList(), damaged, scrapesPerBreak: 3, avoidHulls: [4, 6, 7] }).then(live(res => { applyCorridor(res); meal(); }));
    }
    function applyCorridor(res) {
        if (!res || res.failed) { breakPatched(); logRecord('Flew the corridor to the Dark Void.', { stop: 'The jump' }); return; }
        const n = res.scrapes || 0;
        breakPatched();                                                                  // the jump shakes every patch loose, scrapes or not (playtest 2)
        (res.damagedRooms || []).map(deckKey).forEach(d => { if (st().decks[d] != null) setDeck(d, 'red'); });
        logRecord(`${res.auraFlew ? 'A.U.R.A. flew' : 'We flew'} the corridor to the Dark Void. ${n ? n + (n > 1 ? ' scrapes' : ' scrape') : 'No scrapes'}.`, { stop: 'The jump', chips: n ? [[`${n} scrapes`, 'loss']] : null });
    }
    function meal() {
        const s = st(), eat = jumpRations();
        s.mode = 'meal'; s.flags.bowls = true;
        const real = spend({ rations: -eat }, 'meal', null);
        logRecord(`The crew ate ${-real.rations} rations. ${s.res.rations} left.`, { stop: 'The jump', chips: chipsOf(real) });
        if (!Slice.broken('quarters')) { CREW.concat('cora').forEach(id => { if (s.crew[id].stress > 0) stress(id, -1); }); logRecord('Everyone rested on the jump.', { stop: 'The jump', routine: true }); }
        else logRecord('Nobody rested on the jump: the crew quarters are broken.', { stop: 'The jump' });
        emit('meal:start', {});
        beat('meal');
        Slice.after(800, () => { if (st().mode === 'meal') sayLine(LINES.meal[0], LINES.meal[1]); });
        mealTimer = Slice.after(14000, mealDone);                                        // ship.js sends meal:done after the bowls' 10 s
    }
    function mealDone() {
        const s = st();
        Slice.cancel(mealTimer);
        if (s.mode !== 'meal') return;
        if (speaking) { mealTimer = Slice.after(300, mealDone); return; }               // playtest 2: Aris's line was still up over sector 2's black
        s.flags.bowls = false; s.mode = 'arrive'; s.sector = 2;
        if (reading) reading.clear();                                                    // look playtest: a meal line stayed on sector 2's black
        emit('sector:arrive', { n: 2 });
        beat('sector:arrive');
        Slice.after(4200, () => sayLines(LINES.arriveS2.map(l => [l[0], l[1]])));
    }

    // ═══ 10. THE MOCKUP MOMENTS (SPEC §6.2): the history and the kicks are in script/moments.js ═══
    function goto(moment) {
        epoch++;
        [lockTimer, flightTimer, jumpTimer, openTimer, mealTimer, signsTimer].forEach(id => Slice.cancel(id));
        if (reading) reading.clear();
        hideHint(); shade.clear();
        stopRun = null; hover = null; previewing = null; speaking = null; dating = false; talkHold = 0; readingHold = false; lastHoldOn = false;
        lastBeat = 0; lastClick = 0; lastNudge = 0; used.clear(); reactorN = 0;
        const M = MOM.MOMENT[moment] || MOM.MOMENT.open, s = st();
        M.steps.forEach(k => MOM.HIST[k](s));
        s.mode = M.mode;
        if (s.mode === 'stop' || s.mode === 'dive-in') s.route.target = null;
        Slice.after(1, live(M.kick));
    }

    // ═══ 11. THE MODULE ═══
    function init() {
        const css = document.createElement('style');                                  // the hint, and other layers' words stepping back under a page or the film
        css.textContent = '.slice-hint { position: absolute; left: 0; top: 0; margin: 0; font: 400 var(--fs-hint)/1.3 var(--f-num); color: var(--dim); text-shadow: var(--shadow); opacity: 0; transition: opacity 600ms var(--ease); pointer-events: none; max-width: 22em; }\n'
            + '#stage #reading canvas { position: static; left: auto; top: auto; }\n'          // index.html's "#stage canvas" would pull the book, the page and the faces out of flow
            + 'body.is-reading #world-words, body.is-reading #ship-words, body.is-reading #stop-words, body.slice-film #world-words, body.slice-film #ship-words, body.slice-film #stop-words { opacity: 0 !important; }\n'
            // playtest 1: the page and film chrome pushed the screen past 40 words. The slice keeps one line at a time: the key hint
            // only on the first step, no numbers on lines already read, no "Kept in the ship's record" (the record has it), the film's
            // faint previous line gone, and the read lines step back when a voice speaks under the page. Nothing behind a minigame.
            + '#reading .page-view:has(.page-lines li + li) .read-hint, #reading .page-view:has(.page-after > *) .read-hint, #reading .page-kept, #reading .film-now .prev { display: none !important; }\n'
            + '#reading .page-lines li.is-read .num { visibility: hidden; }\n'
            // final check: the faint line before a voice pushed the screen to 41 (a world note at the click) and 46 (a red deck's
            // chips); while another layer has words up, only the line being said shows
            + 'body:has(#world-words .w-note:not([hidden])) #reading .voice .prev, body:has(#ship-words .choice) #reading .voice .prev, body:has(#stop-words .sw-good.on) #reading .voice .prev { display: none !important; }\n'
            + '#reading .page-view:has(.page-after > *) .page-lines { display: none; }\n'
            + 'body.slice-mini #world-words, body.slice-mini #ship-words, body.slice-mini #stop-words, body.slice-mini #reading { visibility: hidden; }\n'
            // look playtest: the real minigames sat as bordered boxes on near-black. In the slice the host's backdrop goes clear (the
            // live scene shows round the picture, dithered down by canvas#shade) and its outer border steps back; minigames.css is untouched
            + 'body.slice-mini .mini-host { background: transparent; }\n'
            // fun playtest: two gain chips read as one phrase ("energy salvage") over the hull's dither, and the red chips were faint.
            // The chips get one dark backing and a dot between them; the loss red is a step brighter. reading.css is untouched.
            + '#reading .choice .chips, #ship-words .choice .chips { gap: 0; padding: 3px 8px; margin-left: 10px; background: rgba(5, 7, 10, 0.88); box-shadow: 0 0 10px 4px rgba(5, 7, 10, 0.7); border-radius: 2px; }\n'
            + '#reading .choice .chips:empty, #ship-words .choice .chips:empty { display: none; }\n'
            + '#reading .choice .chip + .chip::before, #ship-words .choice .chip + .chip::before { content: "\\00b7"; margin: 0 0.55em; color: var(--dim); }\n'
            + '#reading .choice .chip.is-loss, #ship-words .choice .chip.is-loss { color: #ff6a55; }\n'
            + 'body.slice-mini .mini-frame { border-color: transparent; background: rgba(5, 7, 10, 0.84); box-shadow: 0 0 0 1px rgba(201, 209, 214, 0.05), 0 20px 60px rgba(0, 0, 0, 0.5); }';
        document.head.appendChild(css);
        shade = Slice.ScriptShade({ st, now, live, beat, reading: () => reading, lastXY: () => lastXY });
        reading = window.GameReading ? window.GameReading.create(shade.WorldAdapter) : null;
        MOM = Slice.ScriptMoments({ st, emit, PLACES, LINES, CREW, placeName, orderOf, jumpCost, jumpRations, newStop: (id, acted) => newStop(id, acted), setPhase, sayLine, sayLines, sayOnce,
            site, surge, breach, arrive, stockpile, stripOrMarker, findDisc, back, armFlight, preview, setHover: id => { hover = id; }, showSigns, bench, deck, onJumpFlash, meal, startOpening,
            later: (ms, fn, slot) => { const id = Slice.after(ms, fn); if (slot === 'open') openTimer = id; if (slot === 'signs') signsTimer = id; return id; }, stopRun: () => stopRun, dating: () => dating });
        mod.reading = reading;
        const on = Slice.on;
        on('world:hover', onHover); on('world:click', onWorldClick); on('opening:done', () => startOpening());
        on('flight:switched', p => { if (p && p.id && st().mode === 'flight') switchTo(p.id); });
        on('flight:arrived', onArrived); on('jump:flash', () => onJumpFlash());
        on('stop:shown', onStopShown); on('stop:pick', onPick); on('stop:act', onAct); on('stop:leave', onLeave); on('stop:hidden', onHidden);
        on('ship:click', onShipClick); on('deck:choice', onDeckChoice); on('meal:done', () => mealDone());
        on('price:changed', () => { previewing = null; preview(); });
        on('minigame:start', () => { document.body.classList.add('slice-mini'); shade.veil(0.55); });     // the scene stays behind it, dimmed (look playtest)
        on('minigame:end', () => { document.body.classList.remove('slice-mini'); shade.veil(0); });
        addEventListener('pointerdown', e => { lastClick = now(); lastXY = [e.clientX, e.clientY]; }, { capture: true, passive: true });
    }
    function resize() { if (shade) shade.resize(); if (reading) reading.relayout(); }
    function update(dt, t) {
        const s = st(), open = !!(reading && reading.isOpen());
        if (open !== readingHold) { readingHold = open; s.hold = Math.max(0, s.hold + (open ? 1 : -1)); }
        const holdOn = s.hold > 0;
        if (holdOn !== lastHoldOn) { lastHoldOn = holdOn; emit('hold', { on: holdOn }); }
        if (reading) reading.frame(t);
        if (open) trimPageHint();
        if (s.sector === 1 && s.mode === 'travel' && s.flags.said.arriveDone && !s.flags.said.pointed && !s.flags.said.hint && t >= 30000) showHint();
        if (hintEl) placeHint();
        if (s.mode === 'travel' && s.sector === 1 && s.flags.said.arriveDone && !holdOn && !speaking && !open && !dating && t - Math.max(lastBeat, lastClick) >= 30000 && t - lastNudge >= 30000) nudge();
    }
    /** The page's key hint, the reused layer's eleven words, is three here and only on the first line (playtest 1: 46 words). */
    function trimPageHint() {
        const v = document.querySelector('#reading .page-view'), h = v && v.querySelector('.read-hint');
        if (!h) return;
        const num = v.querySelector('.page-lines .is-now .num');
        if (num && num.textContent === '1') { if (h.textContent !== PAGE_HINT) h.textContent = PAGE_HINT; } else h.remove();
    }
    const PAGE_HINT = 'Space for more';
    function render(t) { if (shade) shade.render(t); }
    function key(e) {
        const k = e.key, s = st();
        if (reading && reading.onKey(e)) return true;
        if (k === ' ' || k === 'Enter') { if (speaking) speaking.advanced = true; return !!(reading && reading.advance()); }
        if (k === 'Escape') { if (s.route.locked) { cancelRoute(); return true; } return !!(reading && reading.close()); }
        if (k === 'l' || k === 'L') { if (reading && !['corridor'].includes(s.mode)) { reading.openRecord(); return true; } }
        return false;
    }
    /** Words on screen now (the ?words=1 counter, SPEC §12 check 3): text in #words-root that is really visible. */
    function words() {
        const root = document.getElementById('words-root');
        if (!root) return 0;
        const seen = new Map(), shown = el => {
            if (!el || el === document.body) return true;
            if (seen.has(el)) return seen.get(el);
            const cs = getComputedStyle(el);
            const ok = cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) >= 0.05 && shown(el.parentElement);
            seen.set(el, ok); return ok;
        };
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let n = 0;
        for (let node = walk.nextNode(); node; node = walk.nextNode()) {
            const el = node.parentElement;
            if (!el || el.closest('#mockup') || !el.getClientRects().length || !shown(el)) continue;
            n += (node.textContent.trim().match(/\S+/g) || []).length;
        }
        return n;
    }

    const mod = { init, resize, update, render, goto, key, words, reading: null, LINES, PLACES, note, price, teamLine, deckChips, goodFor, crewList, speaker: () => (speaking ? speaking.who : null) };
    Slice.mods.script = mod;
})();
