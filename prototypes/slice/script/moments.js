/* Silent Exodus · sector 1 slice · the MOCKUP moments (docs/SLICE_SPEC.md §6.2): the careful run's history, written
   straight into a fresh state, and the live part each moment starts with (a minigame opens for real).
   OWNER: the state-and-script builder. Load before script.js; script.js calls the factory once:
     const M = window.Slice.ScriptMoments(api) → { HIST, CAREFUL, MOMENT }   MOMENT[id] = { steps, mode, kick() }
   The careful run (§6.1): Titan (Vance and Mira, a marker), dating, Vance believed, Jaxon's day granted, Erebus (Vance and
   Aris; Breach: the lab red, Mira hurt, 22% air; the call answered), living with the lab, Rhea (Jaxon and Aris), the jump.
   Other branches: kryos (the skim after a Breach on the pull-in, Vance pulled Mira out), zeta (docking). */
(function () {
    'use strict';
    const Slice = window.Slice, DATA = window.V3Data, E = Slice.ECON;
    Slice.ScriptMoments = function (api) {
        const { PLACES, LINES, CREW, emit, placeName, orderOf, jumpCost, jumpRations, st, newStop, setPhase, sayLine, sayLines, sayOnce, site, surge, breach, arrive,
            stockpile, stripOrMarker, findDisc, back, armFlight, preview, setHover, showSigns, bench, deck, onJumpFlash, meal, startOpening, later } = api;
        const rec = (s, text, o) => s.record.push(Object.assign({ sector: s.sector, t: 0, text, stop: o && o.stop || 'On the way' }, o || {}));
        const away = (s, ids) => { s.team = ids.slice(); ids.forEach(c => { s.crew[c].status = 'away'; }); };
        const home = s => { s.team.forEach(c => { if (s.crew[c].status === 'away') s.crew[c].status = 'well'; }); s.team = []; };
        const goTo = (s, id, cost) => { s.res.energy -= cost; s.route.target = id; s.places[id].status = 'target'; rec(s, cost ? `Set course for ${placeName(id)}.` : `Flew their last course to ${placeName(id)}. It cost no energy.`, { chips: [[cost ? `−${cost} energy` : 'no energy', 'spend']] }); };
        function at(s, id) {
            s.route.at = id; s.route.target = null; s.stops += 1;
            if (PLACES[id].fork === 1) s.route.fork1 = id; if (PLACES[id].fork === 2) s.route.fork2 = id;
            Object.keys(s.places).forEach(k => { if (k === id) s.places[k].status = 'here'; else if (['ahead', 'target'].includes(s.places[k].status) && orderOf(k) <= orderOf(id)) s.places[k].status = 'passed'; });
        }
        const left = (s, id, did) => { s.places[id].status = 'visited'; s.places[id].did = did; };
        const HIST = {
            woke: s => { s.flags.said.arrive = s.flags.said.arriveDone = s.flags.said.pointed = true; },
            goTitan: s => goTo(s, 'titan', E.pullIn), atTitan: s => at(s, 'titan'), teamTitan: s => { away(s, ['vance', 'mira']); rec(s, 'Vance and Mira took the shuttle down.', { routine: true, stop: 'Titan-61 IV' }); },
            surge: s => { s.flags.surgeDone = true; rec(s, 'Power surge in engineering. Jaxon fixed it at no cost.', { stop: 'Titan-61 IV' }); },
            torch: s => rec(s, 'Cut the hatch of EXODUS-4.', { routine: true, stop: 'Titan-61 IV' }),
            marker: s => { s.res.salvage -= E.marker; s.flags.platesPending = 1; s.places.titan.did = 'marker'; rec(s, 'Left a marker for the crew of EXODUS-4. Aris wrote their names in her book.', { stop: 'Titan-61 IV', chips: [[`−${E.marker} salvage`, 'spend']] }); },
            pageDisc: s => { s.flags.discFound = true; s.pages.push('disc'); s.flags.fixOn = 'carried'; s.flags.fixAt = s.stops; rec(s, DATA.PAGE_DISC.record, { story: true, page: 'disc', stop: 'Titan-61 IV' }); },
            backTitan: s => { home(s); left(s, 'titan', 'marker'); s.flags.plates = 1; s.flags.platesPending = 0; s.flags.fixOn = 'bench'; s.flags.signsDue = true; },
            dated: s => { s.flags.dated = true; s.flags.fixOn = null; s.places.rhea.named = true; s.pinned.push('disc'); rec(s, 'The disc dates EXODUS-4: dead for 21 years.', { story: true }); rec(s, 'EXODUS-4 was flying to Rhea-4 Minor when it died. Its course is free to fly.', { story: true }); },
            signs: s => { s.flags.signs = true; s.flags.signsDue = false; s.crew.vance.stress = 1; s.crew.vance.moment = 'open'; s.crew.jaxon.stress = 1; s.crew.jaxon.ask = 'open'; },
            talked: s => { Object.assign(s.crew.vance, { moment: 'believed', stress: 0, backed: 1 }); s.crew.mira.stress = 1; Object.assign(s.crew.jaxon, { ask: 'granted', stress: 0 }); s.flags.jaxonOff = s.flags.noSurge = true;
                rec(s, 'Vance told you about the shipyard. You said you believe him.', { story: true }); rec(s, 'Jaxon asked for a day on the drive. You gave it to him.'); },
            goErebus: s => goTo(s, 'erebus', E.pullIn), atErebus: s => at(s, 'erebus'),
            teamErebus: s => { away(s, ['vance', 'aris']); s.flags.jaxonOff = false; s.flags.said['hazard:erebus'] = true; rec(s, 'Vance and Aris took the shuttle down.', { routine: true, stop: 'Erebus-40 Minor' }); },
            breachErebus: s => { s.flags.breachDone = true; s.decks.lab = 'red'; s.crew.mira.status = 'hurt'; rec(s, 'Micrometeorite strike. The ship lost 22% of its air. The lab is sealed off.', { stop: 'Erebus-40 Minor', chips: [['−22% air', 'loss']] }); rec(s, 'Mira was caught in the breach and is injured.', { stop: 'Erebus-40 Minor' }); },
            call: s => { s.res.rations -= E.day; s.crew.aris.stress = Math.max(0, s.crew.aris.stress - 1); s.places.erebus.did = 'answered'; rec(s, 'Answered the distress call of EXODUS-7, then switched it off. It took a day.', { story: true, stop: 'Erebus-40 Minor', chips: [['−1 ration', 'spend']] }); },
            backErebus: s => { home(s); left(s, 'erebus', 'answered'); },
            livedLab: s => { s.flags.lived.lab = true; rec(s, 'Chose to live with the broken lab.'); },
            goRhea: s => goTo(s, 'rhea', 0), atRhea: s => at(s, 'rhea'), teamRhea: s => { away(s, ['jaxon', 'aris']); rec(s, 'Jaxon and Aris took the shuttle down.', { routine: true, stop: 'Rhea-4 Minor' }); },
            plate: s => { s.pages.push('plate'); s.places.rhea.did = 'searched'; rec(s, DATA.PAGE_PLATE.record, { story: true, page: 'plate', stop: 'Rhea-4 Minor' }); },
            backRhea: s => { home(s); left(s, 'rhea', 'searched'); s.pinned.push('plate'); s.flags.light = true; s.flags.said.jumpReady = true; },
            jumped: s => { s.res.energy -= jumpCost(); rec(s, 'Jumped toward the light.', { story: true, stop: 'The jump', chips: [[`−${jumpCost()} energy`, 'spend']] }); },
            flown: s => rec(s, 'We flew the corridor to the Dark Void. No scrapes.', { stop: 'The jump' }),
            ate: s => { const eat = jumpRations(); s.res.rations -= eat; rec(s, `The crew ate ${eat} rations. ${s.res.rations} left.`, { stop: 'The jump', chips: [[`−${eat} rations`, 'spend']] }); CREW.forEach(id => { s.crew[id].stress = Math.max(0, s.crew[id].stress - 1); }); },
            arrived: s => { s.sector = 2; },
            goKryos: s => goTo(s, 'kryos', E.pullIn), atKryos: s => at(s, 'kryos'),
            breachKryos: s => { s.flags.breachDone = true; s.decks.lab = 'red'; rec(s, 'Micrometeorite strike. The ship lost 22% of its air. The lab is sealed off.', { stop: 'Kryos-68 Prime', chips: [['−22% air', 'loss']] }); rec(s, 'Vance pulled Mira out before the deck sealed.', { stop: 'Kryos-68 Prime' }); },
            goZeta: s => goTo(s, 'zeta', E.pullIn), atZeta: s => at(s, 'zeta'),
        };
        const CAREFUL = ['woke', 'goTitan', 'atTitan', 'teamTitan', 'surge', 'torch', 'marker', 'pageDisc', 'backTitan', 'dated', 'signs', 'talked', 'goErebus', 'atErebus', 'teamErebus',
            'breachErebus', 'call', 'backErebus', 'livedLab', 'goRhea', 'atRhea', 'teamRhea', 'plate', 'backRhea', 'jumped', 'flown', 'ate', 'arrived'];
        const upTo = last => CAREFUL.slice(0, CAREFUL.indexOf(last) + 1);
        const MOMENT = {
            open: { steps: [], mode: 'travel', kick: () => { later(8000, startOpening, 'open'); } },
            fork1: { steps: upTo('woke'), mode: 'travel', kick: () => { setHover('titan'); preview(); } },
            flight1: { steps: upTo('goTitan'), mode: 'flight', kick: () => { emit('route:go', { id: 'titan', cost: E.pullIn }); emit('route:fired', { id: 'titan', cost: E.pullIn }); armFlight('titan'); } },
            dive: { steps: upTo('atTitan'), mode: 'dive-in', kick: () => { newStop('titan'); emit('dive:start', { id: 'titan' }); } },
            pick: { steps: upTo('atTitan'), mode: 'stop', kick: () => { newStop('titan'); setPhase('pick'); sayLine(LINES.sign.surge[0], LINES.sign.surge[1]); } },
            torch: { steps: upTo('surge'), mode: 'stop', kick: () => { newStop('titan', true); site('titan'); } },
            surge: { steps: upTo('teamTitan'), mode: 'stop', kick: () => { newStop('titan', true); setPhase('away'); surge(() => site('titan')); } },
            stockpile: { steps: upTo('torch'), mode: 'stop', kick: () => { newStop('titan', true); setPhase('site'); const s = st(); stockpile(() => stripOrMarker('titan', () => findDisc(() => { s.flags.fixOn = 'carried'; s.flags.fixAt = s.stops; back('titan'); }))); } },
            'page-disc': { steps: upTo('marker'), mode: 'stop', kick: () => { newStop('titan', true); setPhase('site'); const s = st(); findDisc(() => { s.flags.fixOn = 'carried'; s.flags.fixAt = s.stops; back('titan'); }); } },
            bench: { steps: upTo('backTitan'), mode: 'travel', kick: () => { emit('plate:up', {}); emit('fix:on-bench', {}); later(25000, () => { if (!api.dating()) showSigns(); }, 'signs'); later(3000, () => sayOnce('benchWaiting', ['Mira', LINES.bench.disc])); } },
            dating: { steps: upTo('backTitan'), mode: 'travel', kick: () => { st().flags.said.benchWaiting = true; bench(); } },
            signs: { steps: upTo('dated'), mode: 'travel', kick: () => { st().flags.signsDue = true; showSigns(); } },
            fork2: { steps: upTo('talked'), mode: 'travel', kick: () => { setHover('erebus'); preview(); } },
            erebus: { steps: upTo('atErebus'), mode: 'stop', kick: () => { newStop('erebus'); arrive('erebus'); } },
            breach: { steps: upTo('teamErebus'), mode: 'stop', kick: () => { newStop('erebus', true); setPhase('away'); breach(() => site('erebus')); } },
            call: { steps: upTo('breachErebus'), mode: 'stop', kick: () => { newStop('erebus', true); site('erebus'); } },
            reddeck: { steps: upTo('backErebus'), mode: 'travel', kick: () => deck('lab') },
            kryos: { steps: upTo('talked').concat('goKryos', 'atKryos', 'breachKryos'), mode: 'stop', kick: () => { newStop('kryos'); setPhase('arrive', { ready: true }); sayLines([LINES.arriveAt.kryos]); } },
            zeta: { steps: ['woke', 'goZeta', 'atZeta'], mode: 'stop', kick: () => { newStop('zeta'); arrive('zeta'); } },
            rhea: { steps: upTo('atRhea'), mode: 'stop', kick: () => { newStop('rhea'); arrive('rhea'); } },
            jump: { steps: upTo('backRhea'), mode: 'travel', kick: () => { sayLine(LINES.jumpReady[0], LINES.jumpReady[1]); setHover('light'); preview(); } },
            corridor: { steps: upTo('jumped'), mode: 'jump', kick: () => onJumpFlash() },
            meal: { steps: upTo('flown'), mode: 'corridor', kick: () => meal() },
            s2: { steps: upTo('arrived'), mode: 'arrive', kick: () => { emit('sector:arrive', { n: 2 }); later(4200, () => sayLines(LINES.arriveS2.map(l => [l[0], l[1]]))); } },
        };
        return { HIST, CAREFUL, MOMENT };
    };
})();
