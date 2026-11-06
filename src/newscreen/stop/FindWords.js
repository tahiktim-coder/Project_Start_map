/* ═══ Silent Exodus · new screen (?new=1) · stop/FindWords.js: what a find and a person say on the bridge's glass ═════════
   What it is: the words tables of the glass, out of stop/Words.js (look pass B07, which keeps that file under 800 lines):
   what each find shows under its label (its ways as rows, or its best prize and a clue), the risk words of a way, and what
   pointing at someone says (whether they make the trip safer, what they really do for a trip, too weak to go).
   A chip is { icon, text, tone }; a number inside its text is set in Mono by stop/Tags.js (one chip family).
   Loaded only when the new-screen switch is on, after stop/Tags.js and before stop/Words.js.

   window.NSFindWords (frozen)
     findChips(find, hover?) → { chips, clue? } | { rows, lean, names }   a row: { chips, cls, idx?, struck? }
     GOOD { id: line }, FIT_LINE { yes, no }, WEAK_LINE   the note over someone pointed at
     zero(chip) → bool       a chip that says nothing ("risk 0%"): the glass never shows it
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const GOOD = {                                          // pointing at someone at the hatch: what they really do for a trip (2026-11-02, the depth plan's step 6)
        jaxon: 'When A.U.R.A. lands us, I make it softer.',                 // DRAFT: App.applyLanding (her landing one step softer)
        aris: "If someone's hurt down there, they're up by the next stop.", // DRAFT: NSOrbit.tripDone (_nsMendAt)
        vance: "If one of us gets hit, it's me.",                         // DRAFT: App.tripHit (he takes his partner's hit)
        mira: 'Down there I date the wreck. Up here I watch the ground.',   // DRAFT: NSOrbit.fixIn; whileDown (MIRA_ABOARD)
    };
    const FIT_LINE = { yes: 'Safer with me.', no: 'No help down there.' };   // DRAFT: pointing at someone: do they make the trip safer (NSOrbit.helps)
    const WEAK_LINE = "I went without supper. I'm too weak to go this time.";   // too weak for this trip (GameState.serveSupper)
    // a way's row on a find (WorldFinds.js rows): [its short name][its prize][a risk word], or, struck by a stress trait, why
    const RISK_WORDS = ['low risk', 'risky', 'could die'];                  // DRAFT: under RISKY_FROM / from it / where it can kill (with no odds to say)
    const STRUCK_LINE = { PARANOID: "Vance won't risk it.", RECKLESS: "Mira won't play it safe." };   // DRAFT (App.wayStrikes)
    let riskyWarned = false;
    /** NEW_LOOK_ECONOMY.RISKY_FROM (bundle.js, the one place it is set), read when used; missing, it is logged and 15 used. */
    function riskyFrom() {
        const v = window.NEW_LOOK_ECONOMY && window.NEW_LOOK_ECONOMY.RISKY_FROM;
        if (typeof v === 'number') return v;
        if (!riskyWarned) { riskyWarned = true; console.error('NSFindWords: NEW_LOOK_ECONOMY.RISKY_FROM is missing; using 15'); }
        return 15;
    }
    /** A chip that says nothing: a 0 % risk (look pass B07: the words budget is 40, and "risk 0%" spends two of them). */
    const zero = c => !!c && /^risk 0%$/.test(String(c.text || '').trim());
    /** A way's risk word: where it can kill, GO DOWN's own red "death 1 in N" (2026-11-02: a death chance always shows as one,
        however small; "could die" only with no number to say), "low risk" under RISKY_FROM, else "risky". The hurt chance
        is GO DOWN's. */
    function riskChip(r) {
        if (r.deadly) return { icon: 'danger', text: r.oneIn ? `death 1 in ${r.oneIn}` : RISK_WORDS[2], tone: 'high' };   // GO DOWN's chip (teamChips)
        return typeof r.hurt === 'number' && r.hurt >= riskyFrom() ? { icon: 'risk', text: RISK_WORDS[1], tone: 'risk' } : { text: RISK_WORDS[0], tone: 'cool' };
    }
    /** One way's row: its short name, its prize, its risk word; struck, its name and why. lean: the name and the risk word
        only (the words budget is short). idx: the card's index (a click on the row chooses it). */
    function wayRow(r, chosen, hover) {
        const cls = ['is-way', r.idx === chosen ? 'is-pick' : '', r.idx === hover ? 'is-hover' : '', r.struck ? 'is-struck' : ''].filter(Boolean).join(' ');
        const name = { text: r.short, tone: 'way' };
        if (r.struck) { const why = { text: STRUCK_LINE[r.struck] || '', tone: 'high' }; return { chips: [name, why], lean: [name, why], cls, idx: r.idx, struck: true }; }
        const risk = riskChip(r), prize = (r.gives || []).filter(c => !zero(c)).map(c => ({ icon: c.icon, text: c.text, tone: 'gain' }));
        return { chips: [name].concat(prize, [risk]), lean: [name, risk], cls, idx: r.idx, struck: false };
    }
    /** What a find shows under its label. The find GO DOWN goes to (target), an event: a row per way (wayRow, the one taken
        marked; a clue on a row of its own first), the same rows lean, and each way's name alone (names, no clue row). Another
        find: its best prize (the bold way's) and a clue; a site or Eden: what it gives; a visited one: "done". hover: the
        card's index of a row pointed at. */
    function findChips(f, hover) {
        if (f.done) return { chips: [{ icon: 'done', text: 'done', tone: 'done' }] };
        const clue = f.hint ? { icon: 'where', text: 'a clue', tone: 'gain' } : null;
        const ways = f.kind === 'event' && Array.isArray(f.ways) ? f.ways : [];
        if (f.target && ways.length) {
            const rows = ways.map(r => wayRow(r, f.way, hover));
            const head = clue ? [{ chips: [clue], cls: '' }] : [];
            return { rows: head.concat(rows.map(r => ({ chips: r.chips, cls: r.cls, idx: r.idx, struck: r.struck }))), lean: head.concat(rows.map(r => ({ chips: r.lean, cls: r.cls, idx: r.idx, struck: r.struck }))),
                names: rows.map(r => ({ chips: r.chips.slice(0, 1), cls: r.cls, idx: r.idx, struck: r.struck })) };   // names: each way's name alone (A.U.R.A. teaching the ways: decide)
        }
        const best = ways.filter(r => r.prize).slice(-1)[0];                  // careful first: the last row with a prize is the boldest
        const out = (best ? best.gives : f.gives || []).filter(c => !zero(c)).map(c => ({ icon: c.icon, text: c.text }));
        if (clue) out.push(clue);
        return { chips: out, clue };                                          // clue: the chip that may show alone (decide)
    }

    window.NSFindWords = Object.freeze({ findChips, GOOD, FIT_LINE, WEAK_LINE, zero });
})();
