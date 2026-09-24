/* export_script.js — writes every piece of story text in the game to docs/script/, in the order a player meets it.
   usage:  node tools/export_script.js
   One file per stretch of the game (the opening, each sector, the finale) plus one for the random pools. Every line is tagged
   with where it lives, «File · id», so an edited script can be copied back into the game exactly. Nothing here changes the game:
   it reads the data files in a sandbox, and reads the few beats that live in code (the opening, the head count, the arrival
   cards) straight out of the source. */

const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'docs', 'script');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── load the data files the way the browser does: one shared global scope ──
const DATA = ['SectorConfig', 'Items', 'ExodusLogs', 'Events', 'ExodusDerelicts', 'DerelictEncounters', 'SpaceStations', 'FailedColonyEncounters',
    'AsteroidFields', 'DistressSignals', 'AnomalyEncounters', 'LateGamePOIs', 'ShipEvents', 'CrewEvents', 'CampfireEvents', 'StructureEncounter'];
const sandbox = { window: {}, document: { addEventListener() {}, querySelector() { return null; } }, console, Math, setTimeout() {}, CustomEvent: function () {} };
sandbox.window.dispatchEvent = () => {};
vm.createContext(sandbox);
DATA.forEach(name => { try { vm.runInContext(read(`src/data/${name}.js`), sandbox, { filename: name }); } catch (e) { console.warn(`could not load ${name}: ${e.message}`); } });
['src/systems/StoryReel.js', 'src/systems/TheThrow.js', 'src/systems/BarkSystem.js'].forEach(rel => { try { vm.runInContext(read(rel), sandbox, { filename: rel }); } catch (e) { /* drawing code needs a browser; the text tables still load */ } });
const G = name => { try { return vm.runInContext(`typeof ${name} !== 'undefined' ? ${name} : undefined`, sandbox); } catch (e) { return undefined; } };

// ── a stand-in ship, so choice effects can be run to show what they say happened ──
const CREW = () => [
    { name: 'Cmdr. Moon', realName: 'Cora Moon', tags: ['LEADER'], status: 'HEALTHY', stress: 1 },
    { name: 'Eng. Jaxon', realName: 'Jaxon Mercer', tags: ['ENGINEER'], status: 'HEALTHY', stress: 1 },
    { name: 'Dr. Aris', realName: 'Aris Novak', tags: ['MEDIC'], status: 'HEALTHY', stress: 1 },
    { name: 'Spc. Vance', realName: 'Kael Vance', tags: ['SECURITY'], status: 'HEALTHY', stress: 1 },
    { name: 'Tech Mira', realName: 'Mira Chen', tags: ['SPECIALIST'], status: 'HEALTHY', stress: 1 },
];
function mockState(sector) {
    const logs = [], deck = label => ({ status: 'OPERATIONAL', label });
    const state = {
        currentSector: sector, energy: 60, salvage: 100, maxSalvage: 300, rations: 15, maxRations: 30, probeIntegrity: 80, cargo: [], upgrades: [],
        crew: CREW(), sectorNodes: [], _colonyKnowledge: 2, actionsTaken: 20, exodusLogsFound: [],
        shipDecks: { bridge: deck('Bridge'), lab: deck('Laboratory'), quarters: deck('Crew quarters'), cargo: deck('Cargo hold'), engineering: deck('Engineering'), upgrades: deck('Fabrication') },
        addLog: m => logs.push(String(m)), emitUpdates() {}, noteStanding() {}, hasStanding() { return false; }, isDeckOperational() { return true; },
        consumeRation() {}, consumeEnergy() { return true; }, damageRandomDeck() { return 'lab'; }, hasActiveTrait() { return false; },
        getStopsLeft() { return 2; }, addColonyKnowledge() {}, isSilentSpeaker() { return false; }, repairDeck() {}, adjustStress() {},
    };
    return { state, logs };
}
function runEffect(effect, sector, crewPick) {
    if (typeof effect !== 'function') return null;
    const { state, logs } = mockState(sector), realRandom = Math.random;
    try {
        sandbox.Math.random = () => 0.5;
        const out = effect(state, crewPick ? state.crew.find(c => c.name.includes(crewPick)) : state.crew[1]);
        const said = typeof out === 'string' ? out : (out && typeof out === 'object' && out.text ? [].concat(out.text).join(' ') : '');
        return { said, logs };
    } catch (e) { return { said: '', logs, failed: true }; } finally { sandbox.Math.random = realRandom; }
}

// ── markdown helpers ──
const clean = s => String(s == null ? '' : s).replace(/\[\/?(highlight|warning|whisper)\]/g, '').replace(/<br\s*\/?>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (file, id) => ` «${file} · ${id}»`;
const lineOf = (speaker, text) => speaker ? `**${speaker}:** ${clean(text)}` : `*${clean(text)}*`;
const ctxOf = (ctx, arg) => clean(typeof ctx === 'function' ? ctx(arg) : ctx);
const SAMPLE = { ship: 'EXODUS-640 "HALCYON"', age: 120, station: 'Waystation 7' };

/** One scene: title, the situation, the talk, and each choice with what it costs and what it says happened. */
function sceneMd(enc, file, opts = {}) {
    const out = [], sector = opts.sector || 3;
    out.push(`### ${clean(enc.title || enc.name || enc.id)}${tag(file, enc.id)}`);
    if (opts.where) out.push(`_${opts.where}_`);
    const ctx = enc.context != null ? ctxOf(enc.context, opts.ctxArg) : enc.desc ? clean(enc.desc) : '';
    if (ctx) out.push('', `> ${ctx}`);
    let talk = enc.dialogue;
    try { if (typeof talk === 'function') talk = talk(opts.ctxArg); } catch (e) { talk = []; }
    if (Array.isArray(talk) && talk.length) { out.push(''); talk.forEach(d => out.push(lineOf(d.speaker, d.text) + '  ')); }
    const choices = enc.choices || [];
    if (choices.length) {
        out.push('', 'Choices:');
        choices.forEach((c, i) => {
            const result = runEffect(c.effect, sector, opts.crewPick);
            const heard = result ? [result.said, ...result.logs].filter(Boolean).map(clean) : [];
            out.push(`${i + 1}. **${clean(c.text)}** — ${clean(c.desc || (c.reward ? `risk +${c.riskMod || 0}` : ''))}`);
            if (heard.length) out.push(`   → ${heard.join(' / ')}`);
        });
    }
    return out.join('\n');
}

// ── the beats that live in code: read them from the source ──
const BUNDLE = read('src/bundle.js');
function methodSource(name) {
    const start = BUNDLE.indexOf(`    ${name}(`);
    if (start < 0) return '';
    const end = BUNDLE.indexOf('\n    }\n', start);
    return BUNDLE.slice(start, end < 0 ? undefined : end);
}
function dialogueFrom(src) {
    const re = /speaker:\s*'([^']+)',\s*text:\s*(?:'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/g, out = [];
    let m; while ((m = re.exec(src))) out.push(lineOf(m[1], (m[2] != null ? m[2] : m[3]).replace("${names.join('. ')}", 'Jaxon Mercer. Aris Novak. Kael Vance. Mira Chen').replace(/\\'/g, "'")) + '  ');
    return out;
}
function choicesFrom(src) {
    const re = /\{\s*text:\s*'((?:\\.|[^'\\])*)',\s*desc:\s*'((?:\\.|[^'\\])*)'/g, out = [];
    let m, i = 1; while ((m = re.exec(src))) out.push(`${i++}. **${m[1].replace(/\\'/g, "'")}** — ${m[2].replace(/\\'/g, "'")}`);
    return out;
}
function logsFrom(src) {
    const re = /addLog\((['"`])((?:\\.|(?!\1)[^\\])*)\1\)/g, out = [];
    let m; while ((m = re.exec(src))) out.push(`- ${clean(m[2].replace(/\\(["'])/g, '$1'))}`);
    return out;
}
function arrivalLines() {
    const obj = /const SECTOR_ARRIVAL_LINES = \{([\s\S]*?)\};/.exec(BUNDLE), lines = {};
    if (obj) { const re = /(\d):\s*'((?:\\'|[^'])*)'/g; let m; while ((m = re.exec(obj[1]))) lines[m[1]] = m[2].replace(/\\'/g, "'"); }
    return lines;
}
function arrivalCrew(sector) {
    const src = methodSource('getWarpDialogue'), block = new RegExp(`\\n\\s*${sector}: \\[([\\s\\S]*?)\\],\\n`).exec(src);
    if (!block) return [];
    const re = /say\('([^']+)',\s*'((?:\\'|[^'])*)'/g, out = [];
    let m; while ((m = re.exec(block[1]))) out.push(lineOf(m[1], m[2].replace(/\\'/g, "'")) + '  ');
    return out;
}
function coachLines() {
    const src = read('src/systems/Coach.js'), obj = /const SECTOR_LINE = \{([\s\S]*?)\};/.exec(src), lines = {};
    if (obj) { const re = /(\d):\s*'((?:\\'|[^'])*)'/g; let m; while ((m = re.exec(obj[1]))) lines[m[1]] = m[2].replace(/\\'/g, "'"); }
    return lines;
}
function throwBeats() {
    const src = read('src/systems/TheThrow.js'), block = /const BEATS = \[([\s\S]*?)\];/.exec(src), out = [];
    if (block) { const re = /\[(\d+),\s*'([^']*)',\s*'((?:\\'|[^'])*)'\]/g; let m; while ((m = re.exec(block[1]))) out.push(lineOf(m[2], m[3].replace(/\\'/g, "'")) + '  '); }
    return out;
}
const reelCaptions = name => { const reels = sandbox.window.StoryReel && sandbox.window.StoryReel.REELS; const r = reels && reels[name]; return r ? r.beats.map(b => `*${clean(b[1])}*  `) : []; };
const reelSource = name => { const reels = sandbox.window.StoryReel && sandbox.window.StoryReel.REELS; return reels && reels[name] && reels[name].source ? reels[name].source : ''; };

// ── when things happen ──
const SECTORS = G('SECTOR_CONFIG') || {};
const CREW_EVENTS = G('CREW_PERSONAL_EVENTS') || [], CAMPFIRES = G('CAMPFIRE_EVENTS') || [], PAGES = G('EXODUS_LOGS') || [];
const WHO = { jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira', commander: 'Moon' };
function crewSectors(ev) {
    const out = [];
    for (let sector = 1; sector <= 6; sector++) {
        const { state } = mockState(sector), member = state.crew.find(c => c.name.includes(WHO[ev.crewId] || 'Jaxon'));
        Object.keys(state).filter(k => /Seen$/.test(k)).forEach(k => { state[k] = false; });
        try { if (ev.trigger(state, member)) out.push(sector); } catch (e) { /* a trigger that needs more of the ship: skip */ }
    }
    return out;
}
const campfireFor = sector => CAMPFIRES.filter(c => c.sectorRange && sector >= c.sectorRange[0] && sector <= c.sectorRange[1]).sort((a, b) => (b.priority || 1) - (a.priority || 1));

// ── what each sector is for (the one place in this tool that is written by hand) ──
const INTENT = {
    1: { idea: 'Everything looks exactly like the briefing said: the wrecks of the eight ships that went before you, about twenty years dead. The player learns the controls.',
        wrong: 'The only wrong note: A.U.R.A. says there are four crew when there are five. You are not on her list.',
        learn: 'The count. The drawing of the gold disc (why is it in a colony ship\'s orders?). A crew plate with four names and a blank fifth.' },
    2: { idea: 'The last of the eight. The first real crack in the story.',
        wrong: 'An uncut copy of the briefing film shows your heading full of ships, not eight. A.U.R.A. brushes it off.',
        learn: 'A memo from Earth: every ship\'s computer has a twin on Earth, and the first one started reading out the gold disc.' },
    3: { idea: 'The jump does not finish. The player sees every ship Earth ever built in one line, then wakes among hundreds of beacons.',
        wrong: 'The ship numbers are higher than ours, and the wrecks are a hundred years old.',
        learn: 'A captain\'s log: we were not sent further than the others, we were sent less far back in time.' },
    4: { idea: 'Numbers in the thousands, two hundred years dead. Green worlds that turn out to be copies. Jaxon wants to stop here.',
        wrong: 'The briefing was not a mistake. It was written that way on purpose.',
        learn: 'Orders for commanders only: tell your crew they are the ninth; the ship\'s computer knows and will not tell them.' },
    5: { idea: 'Tens of thousands of ships, three hundred years dead. The scale of it.',
        wrong: 'Every ship was lost before it was launched. No commander was ever written down, on any ship.',
        learn: 'The launch ledger, with the wrecks you boarded yourself in it. The count clicks.' },
    6: { idea: 'The oldest wrecks, and at the end of the heading a light that looks like a sun. Nothing random happens on the way in.',
        wrong: 'It gives off no heat.',
        learn: 'A dead commander\'s last log: it read my crew, it could not find me. Then the light, and the choice.' },
};

// ── write ──
fs.mkdirSync(OUT, { recursive: true });
const files = [];
function write(name, title, body) { fs.writeFileSync(path.join(OUT, name), `# ${title}\n\n${body.join('\n')}\n`); files.push([name, title]); }
const HOW = '_Generated by `node tools/export_script.js` from the game itself. Each line is tagged «file · id» so edits can be copied back exactly. Edit freely: mark changes, cut lines, add notes in [brackets]._';

// the opening
{
    const b = [HOW, '', '## Title screen', ''];
    const tagline = /EXODUS PROGRAM \/\/ VESSEL 9[\s\S]*?SILENT EXODUS[\s\S]*?<div[^>]*>\s*([^<]+?)\s*<\/div>/.exec(BUNDLE);
    b.push(`*SILENT EXODUS — ${tagline ? tagline[1] : ''}*${tag('bundle.js', 'start menu')}`);
    b.push('', `## The briefing film${tag('StoryReel.js', 'program')}`, `_Source on screen: ${reelSource('program')}_`, '', ...reelCaptions('program'));
    const opening = methodSource('showOpeningBriefing');
    b.push('', `## Good morning, Commander${tag('bundle.js', 'showOpeningBriefing')}`, '', `> ${clean((/context:\s*'((?:\\'|[^'])*)'/.exec(opening) || [])[1] || '').replace(/\\'/g, "'")}`, '', ...dialogueFrom(opening), '', 'Choice:', ...choicesFrom(opening));
    b.push('', 'Then in the log:', ...logsFrom(opening));
    write('00-opening.md', 'The opening', b);
}

// the sectors
for (let sector = 1; sector <= 6; sector++) {
    const cfg = SECTORS[sector] || {}, intent = INTENT[sector], b = [HOW, ''];
    b.push(`**What this sector is for.** ${intent.idea}`, '', `**What is wrong.** ${intent.wrong}`, '', `**What the player learns.** ${intent.learn}`, '');
    b.push(`Map text: *${clean(cfg.ambientDesc)}*${tag('SectorConfig.js', `${sector}.ambientDesc`)}  `, `Objective line: *${clean(coachLines()[sector] || 'tutorial tips (see Coach.js)')}*${tag('Coach.js', sector === 1 ? 'tips' : `SECTOR_LINE.${sector}`)}`);
    if (sector >= 2) {
        b.push('', '## Arriving', '');
        if (sector === 3) b.push(`### The jump that does not finish${tag('TheThrow.js', 'BEATS')}`, '', ...throwBeats(), '');
        b.push(`Arrival card: *${clean(arrivalLines()[sector] || '')}*${tag('bundle.js', `SECTOR_ARRIVAL_LINES.${sector}`)}  `, '', ...arrivalCrew(sector));
        const shot = sector === 3 ? null : `jump${sector}`;
        if (shot && reelCaptions(shot).length) b.push('', `Closing shot${tag('StoryReel.js', shot)}: ${reelCaptions(shot).join(' ')}`);
    }
    b.push('', '## The story beats (always here)', '');
    if (sector === 1) {
        b.push(`### The marked beacon — the first wreck`, '_The first wreck the player visits. After it, the drawing of the gold disc (DiscDocument.js)._', '');
        const count = methodSource('showCountScene');
        b.push(`### Head count${tag('bundle.js', 'showCountScene')}`, '_On the first return to the map in sector 1._', '', `> ${clean((/context:\s*'((?:\\'|[^'])*)'/.exec(count) || [])[1] || '').replace(/\\'/g, "'")}`, '', ...dialogueFrom(count), '', 'Choices:', ...choicesFrom(count), '', 'What each choice says in the log:', ...logsFrom(count), '');
    }
    if (sector === 2) {
        const tape = methodSource('findBriefingTape');
        b.push(`### The uncut briefing tape${tag('StoryReel.js', 'uncut')}`, '_In one of the wrecks. Plays as a film, then:_', '', ...reelCaptions('uncut'), '', ...logsFrom(tape), '');
    }
    PAGES.filter(p => p.sector === sector).forEach(page => {
        b.push(`### Found page: ${page.logTitle}${tag('ExodusLogs.js', page.id)}`, `_In one wreck in this sector. ${clean(page.desc)}_`, '');
        page.lines.forEach(l => b.push(`${clean(l)}  `));
        if (page.names) b.push('', `Names on it: ${page.names.map(n => n || '(blank)').join(' · ')}`);
        if (page.after) b.push('', lineOf(page.after.speaker, page.after.text));
        b.push('');
    });
    const moments = CREW_EVENTS.filter(ev => crewSectors(ev).includes(sector));
    if (moments.length) {
        b.push('## Crew moments that can happen here', '');
        moments.forEach(ev => b.push(sceneMd(ev, 'CrewEvents.js', { sector, where: `Sectors ${crewSectors(ev).join(', ')}`, crewPick: WHO[ev.crewId] }), ''));
    }
    const talks = campfireFor(sector);
    if (talks.length) {
        b.push(`## The talk when you jump out of sector ${sector}`, sector === 2 ? '_None plays on the jump from 2 to 3: the jump that does not finish is the beat._' : '_One plays: the highest priority that applies._', '');
        talks.forEach(t => b.push(sceneMd(t, 'CampfireEvents.js', { sector, where: `Priority ${t.priority || 1}, sectors ${t.sectorRange.join('–')}` }), ''));
    }
    b.push('## What else can happen here', '', 'One strange place is guaranteed in every sector. Wrecks, stations, colony ruins, distress calls, ship problems and surface finds come from the shared pools — see [pools.md](pools.md).');
    write(`sector-${sector}.md`, `Sector ${sector} — ${clean(cfg.name)}`, b);
}

// the finale
{
    const fin = G('STRUCTURE_ENCOUNTER'), b = [HOW, ''];
    b.push(`## The reading${tag('StoryReel.js', 'reading')}`, '', ...reelCaptions('reading'), '', '## The disc, inside the light', '_The disc page again (DiscDocument.js), with A.U.R.A.: "Five crew, Commander. All accounted for."_', '');
    if (fin) {
        b.push(`## ${fin.approach.title}${tag('StructureEncounter.js', 'approach')}`, '', `> ${clean(fin.approach.context)}`, '', ...fin.approach.dialogue.map(d => lineOf(d.speaker, d.text) + '  '), '', '## The choice', '');
        fin.choices.forEach(c => {
            b.push(`### ${c.text}${tag('StructureEncounter.js', c.id)}`, `_${clean(c.desc)}_${c.requiresLabel ? `  \nLocked when: ${c.requiresLabel}` : ''}`, '');
            const r = c.effect({ _sleepers: 3 });
            b.push(`**${r.title}**`, '', ...[].concat(r.text).map(t => `${clean(t)}  `), '', `*In the vault on Earth: ${clean(r.vault)}*`, '');
        });
    }
    write('07-finale.md', 'The finale — the light', b);
}

// the pools
{
    const b = [HOW, '', 'Random encounters. Each can happen in any sector unless noted.', ''];
    const POOLS = [['Exodus wrecks (one of our ships)', 'EXODUS_ENCOUNTERS', 'ExodusDerelicts.js', { ctxArg: SAMPLE.ship }], ['Wreckage in orbit', 'DERELICT_ENCOUNTERS', 'DerelictEncounters.js', { ctxArg: 'The wreck' }],
        ['Old stations', 'SPACE_STATION_ENCOUNTERS', 'SpaceStations.js', { ctxArg: SAMPLE.station }], ['Colony ruins', 'FAILED_COLONY_ENCOUNTERS', 'FailedColonyEncounters.js', { ctxArg: 'the planet' }],
        ['Strange places', 'ANOMALY_ENCOUNTERS', 'AnomalyEncounters.js'], ['Asteroid fields', 'ASTEROID_FIELD_ENCOUNTERS', 'AsteroidFields.js', { ctxArg: 'The field' }],
        ['Distress calls', 'DISTRESS_SIGNAL_ENCOUNTERS', 'DistressSignals.js', { ctxArg: SAMPLE.age }], ['Ship problems', 'SHIP_MALFUNCTION_EVENTS', 'ShipEvents.js']];
    POOLS.forEach(([title, name, file, opts]) => {
        const pool = G(name) || [];
        b.push(`## ${title} (${pool.length})`, '');
        pool.forEach(enc => b.push(sceneMd(enc, file, opts || {}), ''));
    });
    const pois = G('LATE_GAME_POIS') || {};
    b.push(`## Late places (sector 4 on)`, '');
    Object.values(pois).forEach(poi => b.push(sceneMd(poi, 'LateGamePOIs.js', { sector: 5 }), ''));
    const events = G('EVENTS') || [];
    b.push(`## Surface finds (${events.length})`, '_What the team finds when there is no site. Two choices each: the safe one and the risky one._', '');
    events.forEach(ev => b.push(`- **${clean(ev.title)}** — ${clean(ev.desc)}${tag('Events.js', ev.id)}  \n  1. ${clean((ev.choices[0] || {}).text)} · 2. ${clean((ev.choices[1] || {}).text)}`));
    const barks = G('BARK_DATA') || {};
    b.push('', '## Crew remarks in the log', '_Short lines the crew say when things happen. Grouped by moment, then by person (PESSIMIST = Jaxon, HUMANIST = Aris, SURVIVOR = Vance, CURIOUS = Mira), then by how stressed they are (0 calm → 3 breaking)._', '');
    Object.entries(barks).forEach(([trigger, byType]) => {
        b.push(`### ${trigger}${tag('BarkSystem.js', trigger)}`);
        Object.entries(byType).forEach(([type, tiers]) => Object.entries(tiers).forEach(([tier, lines]) => lines.forEach(l => b.push(`- ${type} ${tier}: ${clean(l)}`))));
        b.push('');
    });
    write('pools.md', 'The random pools', b);
}

// the index
const index = [HOW, '', 'Read in this order:', '', ...files.map(([name, title]) => `- [${title}](${name})`), '',
    'The story these files tell is in [../CANON.md](../CANON.md). How lines should sound is in [../STYLE.md](../STYLE.md).'];
fs.writeFileSync(path.join(OUT, 'README.md'), `# The script\n\n${index.join('\n')}\n`);
console.log(`wrote ${files.length + 1} files to ${path.relative(ROOT, OUT)}`);
