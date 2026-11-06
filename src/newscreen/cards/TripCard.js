/* ═══ Silent Exodus · new screen (?new=1) · cards/TripCard.js: a team trip's card on the frame (look pass B08) ═══════════════
   What it is: the card the player sees after every landing, in the one card language (cards/Frame.js, DESIGN.md 1.1 and the
   last row of 1.2), in place of the old deck panel (bundle.js showEventModal and showTripResult build the game's half: the
   odds, the ways, the prize; this file only says it).
     decide   the first time a find's event shows this run: the picture is the landing site (the meteor's own landed frame,
              App._nsTrip.site; the world when there is none), the readout is the find's name, the event's sentences are
              narration, a stress trait's refusal is that person's line. The ways are frame keys with the Events.js short names:
              the safest open way is the framed warm keycap, the way chosen on the glass has a warm tick (never the focus, so a
              key held from the landing picks nothing), and under each key its prize and its odds in GO DOWN's own wording
              ("risk 57%", "death 1 in 10"). What the trip goes in to (the GOING IN list) is at most three word chips under the
              line. Forty words or fewer: the going-in chips step back first. The outcome is a report in a voice
              (App.tripResultWords): the one who says it, one line, word chips first ("Jaxon hurt"), then the numbers, Continue.
     report   an event seen before (App.tripCardPlan): no choice; the frame opens on that report.
   Loaded only when the new-screen switch is on, after cards/Frame.js (it reads window.EncounterCard and window.NSFrame).

   window.NSTripCard (frozen)
     ready() → bool                       the frame and EncounterCard are there
     decide(app, trip)                    trip { event, planet, ways (App.tripChoices'), way (the glass's index), mods (the
                                          going-in parts: { type, mod }), plain ({ type: words }), prize(choice) → [chip],
                                          vanceSays, miraSays, lines ({ vance, mira, struck: { PARANOID, RECKLESS } }), run(idx),
                                          result() → words }
     report(app, trip)                    trip { event, planet, run(), result() → words }
     pagesOf(app, words, picture) → { pages, chips }   App.tripResultWords' { say, also, chips } in the frame's slots
     wordsIn(s) → n                       the words a reader counts (the 40-word floor)
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const MAX_WORDS = 40, NOTES_MAX = 3, PAGE_ITEMS = 2, PAGE_WORDS = 30;
    const wordsIn = s => String(s == null ? '' : s).split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
    const chipWords = list => (list || []).reduce((n, c) => n + wordsIn(c && c.text), 0);
    const EC = () => window.EncounterCard || null;
    const ready = () => !!(window.NSFrame && EC() && typeof EC().open === 'function' && typeof EC().frameLine === 'function');
    const isWalk = choice => !!(choice && choice.reward && choice.reward.type === 'RESOURCE' && choice.reward.val === 'NOTHING');

    /** The landing site as the team stood on it (LandFall's result), else the world from orbit. */
    function pictureOf(app, planet) {
        const t = (app && app._nsTrip) || {};
        return t.site ? { kind: 'site', canvas: t.site, node: planet } : { kind: 'world', node: planet };
    }
    const readoutOf = (app, event) => String(((app && app._nsTrip) || {}).label || event.title || '');
    /** A way's odds in GO DOWN's own chips (stop/Words.js teamChips): its hurt chance, and a death chance where it can kill. */
    function oddsChips(odds) {
        if (!odds) return [];
        const out = [];
        if (odds.hurt > 0) out.push({ text: `risk ${odds.hurt}%`, tone: 'loss' });
        if (odds.deadly && odds.oneIn) out.push({ text: `death 1 in ${odds.oneIn}`, tone: 'loss' });
        return out;
    }
    /** What the trip goes in to, as word chips: the biggest parts first, at most three; a danger red, a help warm. */
    function notesOf(mods, plain) {
        return (mods || []).filter(m => m && m.mod).slice().sort((a, b) => Math.abs(b.mod) - Math.abs(a.mod)).slice(0, NOTES_MAX)
            .map(m => ({ text: (plain && plain[m.type]) || String(m.type || '').toLowerCase(), tone: m.mod > 0 ? 'loss' : 'gain', word: true }));
    }
    /** The safest way left open: a walk-away first, else the lowest risk; the card's index. */
    function safestOf(ways) {
        const open = (ways || []).filter(w => !w.struck);
        const rank = w => (isWalk(w.choice) ? -1000 : 0) + (Number(w.choice.riskMod) || 0);
        return open.length ? open.slice().sort((a, b) => rank(a) - rank(b) || a.idx - b.idx)[0].idx : -1;
    }

    /** App.tripResultWords' words in the frame's slots: the voice (no portrait when that person stands in the landing site),
        a breakdown's line after it, two lines to a page; the chips as they are. */
    function pagesOf(app, words, picture) {
        const E = EC(), w = words || {}, items = [], team = ((app && app.currentEvaTeam) || []).map(m => m.name);
        const inSite = picture && picture.kind === 'site';
        if (w.say && w.say.text) {
            const l = E.frameLine(app, w.say);
            items.push(inSite && team.includes(l.speaker) ? Object.assign({}, l, { face: null }) : l);
        }
        (w.also || []).forEach(line => {
            const o = E.outcomeOf(app, [line]);
            if (o) o.pages.forEach(p => p.forEach(it => { if (it.text && !items.some(x => x.text === it.text)) items.push(it); }));
        });
        const pages = [];
        items.slice(0, E.OUT_MAX || 4).forEach(it => {
            const page = pages[pages.length - 1], n = wordsIn(it.text);
            if (page && page.length < PAGE_ITEMS && page.n + n <= PAGE_WORDS) { page.push(it); page.n += n; } else { const p = [it]; p.n = n; pages.push(p); }
        });
        return { pages: pages.length ? pages : [[]], chips: (w.chips || []).slice() };
    }

    function decide(app, trip) {
        const { event, planet, ways } = trip, picture = pictureOf(app, planet), safe = safestOf(ways);
        const dialogue = [trip.vanceSays && { speaker: 'Vance', text: trip.lines.vance }, trip.miraSays && { speaker: 'Mira', text: trip.lines.mira }].filter(Boolean);
        const choices = event.choices.map((choice, idx) => {
            const w = ways[idx] || {};
            return {
                text: choice.short || choice.text, primary: idx === safe, lit: idx === trip.way && !w.struck, disabled: !!w.struck,
                requiresLabel: (w.struck && trip.lines.struck && trip.lines.struck[w.struck]) || '',
                chips: w.struck ? [] : (trip.prize(choice) || []).concat(oddsChips(w.odds)),
            };
        });
        // forty words at the decision: the readout, the line nearest it, the keys and their chips; the going-in chips step back
        const E = EC(), narr = E.narrationOf ? E.narrationOf(event.desc) : [{ text: event.desc }];
        const last = dialogue.length ? `${dialogue[dialogue.length - 1].speaker} ${dialogue[dialogue.length - 1].text}` : (narr[narr.length - 1] || {}).text;
        const fixed = wordsIn(readoutOf(app, event)) + wordsIn(last) + choices.reduce((n, c) => n + wordsIn(c.text) + chipWords(c.chips) + wordsIn(c.requiresLabel), 0);
        const notes = notesOf(trip.mods, trip.plain);
        while (notes.length && fixed + chipWords(notes) > MAX_WORDS) notes.pop();
        return E.open(app, {
            kicker: 'Team on the ground', title: event.title, readout: readoutOf(app, event), picture, shape: 'decide', zIndex: 2000,
            context: event.desc, dialogue, choices, notes: notes.length ? notes : null,
            onPick(idx) { trip.run(idx); },
            outcomeNow() { return pagesOf(app, trip.result(), picture); },
        });
    }

    function report(app, trip) {
        const picture = pictureOf(app, trip.planet);
        return EC().open(app, {
            kicker: 'Team on the ground', title: trip.event.title, readout: readoutOf(app, trip.event), picture, shape: 'report', zIndex: 2000,
            noContext: true, choices: [],
            report() { trip.run(); return pagesOf(app, trip.result(), picture); },
        });
    }

    window.NSTripCard = Object.freeze({ ready, decide, report, pagesOf, wordsIn });
})();
