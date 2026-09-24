/* export_script.js — writes every piece of story text in the game to docs/script/, in the order a player meets it.
   usage:  node tools/export_script.js
   One file per stretch of the game (the opening, each sector, the finale, settling) plus the random pools and three files for
   the text that can turn up anywhere (the ship and crew, orbit and away teams, cargo and map names). Every line is tagged with
   where it lives, «File · id» or «File · line N», so an edited script can be copied back into the game exactly. Nothing here
   changes the game: it reads the data files in a sandbox and runs choice effects on a stand-in ship, and it reads the text
   that lives in code (methods, views, mini-games) with a small JS reader that keeps only what a player can see.
   Choice effects are run once with every dice roll at 0.5; the other lines their code can print are listed after "↳ or:". */

const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'docs', 'script');
const SOURCES = {};
const read = rel => SOURCES[rel] || (SOURCES[rel] = fs.readFileSync(path.join(ROOT, rel), 'utf8'));

// ── load the data files the way the browser does: one shared global scope ──
const DATA = ['SectorConfig', 'Items', 'ExodusLogs', 'Events', 'ExodusDerelicts', 'DerelictEncounters', 'SpaceStations', 'FailedColonyEncounters',
    'AsteroidFields', 'DistressSignals', 'AnomalyEncounters', 'LateGamePOIs', 'ShipEvents', 'CrewEvents', 'CampfireEvents', 'StructureEncounter'];
const sandbox = { window: {}, document: { addEventListener() {}, querySelector() { return null; } }, console, Math, setTimeout() {}, CustomEvent: function () {} };
sandbox.window.dispatchEvent = () => {};
vm.createContext(sandbox);
DATA.forEach(name => { try { vm.runInContext(read(`src/data/${name}.js`), sandbox, { filename: name }); } catch (e) { console.warn(`could not load ${name}: ${e.message}`); } });
['src/systems/StoryReel.js', 'src/systems/TheThrow.js', 'src/systems/BarkSystem.js', 'src/systems/DiscDocument.js'].forEach(rel => { try { vm.runInContext(read(rel), sandbox, { filename: rel }); } catch (e) { /* drawing code needs a browser; the text tables still load */ } });
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
const SAMPLE = { ship: '[ship name]', age: 120, station: '[station name]' };

// ── reading text out of code ──
// A small JS reader: it walks the source, keeps every string a player could see, notes the object key it sits under,
// fills ${…} with [placeholders] (or [a | b] when the choice is between two pieces of text), and splits HTML into its visible pieces.
const ESC = { n: ' ', t: ' ', r: '', b: '', '\n': '' }, PH = ['\ue000', '\ue001'];   // placeholders use two private characters while reading, [ ] when printed
const unescapeAt = (src, i) => src[i + 1] === 'u' ? [String.fromCharCode(parseInt(src.substr(i + 2, 4), 16)), 6] : [src[i + 1] in ESC ? ESC[src[i + 1]] : src[i + 1], 2];
function readQuoted(src, i) {
    const q = src[i]; let s = ''; i++;
    while (i < src.length && src[i] !== q) { if (src[i] === '\\') { const [c, n] = unescapeAt(src, i); s += c; i += n; } else s += src[i++]; }
    return [s, i + 1];
}
function readTemplate(src, i) {                                                     // → [parts: { s, at } and { expr, at }, end]
    const parts = []; let s = '', from = i + 1; i++;
    while (i < src.length && src[i] !== '`') {
        if (src[i] === '\\') { const [c, n] = unescapeAt(src, i); s += c; i += n; continue; }
        if (src[i] === '$' && src[i + 1] === '{') { parts.push({ s, at: from }); s = ''; const end = skipExpr(src, i + 2); parts.push({ expr: src.slice(i + 2, end), at: i + 2 }); i = end + 1; from = i; continue; }
        s += src[i++];
    }
    parts.push({ s, at: from });
    return [parts, i + 1];
}
function skipExpr(src, i) {
    for (let depth = 0; i < src.length; i++) {
        const ch = src[i];
        if (ch === "'" || ch === '"') i = readQuoted(src, i)[1] - 1;
        else if (ch === '`') i = readTemplate(src, i)[1] - 1;
        else if (ch === '{') depth++;
        else if (ch === '}' && depth-- === 0) return i;
    }
    return i;
}
const PLACEHOLDERS = [[/wrongNames|deadNames|names\.join/, 'their names'], [/commander\./, "commander's surname"], [/\bsite\./, 'site'], [/shipDecks|deck|\.label\b/i, 'deck'], [/\.type\b/, 'type'],
    [/ship/i, 'ship name'], [/planet|system/i, 'planet name'], [/sectorName/, 'sector name'], [/sector/i, 'sector'], [/\bname\b|Name\b/, 'name'], [/^\s*temp\s*$|temperature/, 'temperature'],
    [/viability/, 'how good the world is'], [/Math\.|amount|cost|[cC]ount|dmg|damage|loss|gain|\d|length|[pP]op\b|Until|jumps/, 'n']];
const IDLE_WORDS = new Set('map join filter find some includes toUpperCase toLowerCase toFixed toLocaleString toString floor round max min trim replace slice length this state window Math String esc c n i e x o t s d r p k v el'.split(' '));
function placeholderFor(expr) {
    const e = expr.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, ''), hit = PLACEHOLDERS.find(([re]) => re.test(e));
    if (hit) return hit[1];
    const words = (e.match(/[A-Za-z_$][\w$]*/g) || []).filter(w => !IDLE_WORDS.has(w));
    return words.length ? words[words.length - 1].replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase() : 'n';
}
const CODEY = /=>|\bfunction\b|var\(--|rgba?\(|#[0-9a-fA-F]{3,8}\b|\d(px|em|rem|vh|vw|ms|deg)\b|[{};]\s*$|^[\w-]+\s*:\s*\S+;|\b(document|window|this)\.[a-z]|\w\s*===?\s*\w|!==|&&|\|\||^[.#][\w-]|@keyframes|\.png\b|^use strict$|^\S*\.{3}\S*[a-z]\S*$|^\([a-z-]+:|\b(scale[XY]?|rotate|translate[XYZ]?|contrast|saturate|blur|brightness)\(|^[a-z-]+ [\d.]+m?s\b/;
const NAMES = new Set(['Cmdr. Moon', 'Eng. Jaxon', 'Dr. Aris', 'Spc. Vance', 'Tech Mira', 'A.U.R.A.']);
function isText(s, loose) {
    const plain = s.replace(/\ue000[^\ue001]*\ue001/g, '').trim();
    if (!/[A-Za-z]{2}/.test(plain) || CODEY.test(s)) return false;
    const tokens = s.split(' ');
    if (tokens.length <= 4 && tokens.every(w => /^[a-z0-9_.#:/-]+$/.test(w)) && tokens.some(w => /[a-z0-9][-_][a-z0-9]|^[.#]|[/:]/.test(w)) && !/[.!?]$/.test(s)) return false; // class lists, ids, paths, event names
    return loose || plain.split(/\s+/).length >= 2 || /[a-z][.!?…"”]$/.test(plain) || /^\[[^\]]+\]$/.test(plain)   // a lone [default word] counts
        || (plain !== s.trim() && /(^|\s)[A-Za-z][A-Za-z'-]{2,}(:|\s|$)/.test(plain) && !/[\w-]|\w/.test(s));   // and so does "STATION: [result]"
}
const ENT = { '&nbsp;': ' ', '&middot;': '·', '&mdash;': '—', '&ndash;': '–', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&times;': '×', '&rarr;': '→', '&hellip;': '…' };
const tidy = s => s.replace(/&[#\w]+;/g, m => ENT[m] || ' ').replace(/\[\/?(highlight|warning|whisper)\]/g, ' ').replace(/\s+/g, ' ').trim();
const printed = s => s.replace(/\ue000/g, '[').replace(/\ue001/g, ']');
/** A literal's visible runs of text, split at HTML tags; markup inside ${…} is read on its own and goes to `sink`. */
function literalRuns(parts, sink) {
    const runs = []; let cur = null, inTag = false, hadTag = false;
    const add = (text, at) => { if (!cur) cur = { text: '', at }; cur.text += text; }, brk = () => { if (cur) runs.push(cur); cur = null; };
    parts.forEach(p => {
        if (p.expr != null) { if (inTag) return; const r = exprText(p.expr, p.at, sink); if (r == null) brk(); else add(r, p.at); return; }
        for (let k = 0; k < p.s.length; k++) {
            const ch = p.s[k];
            if (inTag) { if (ch === '>') inTag = false; continue; }
            if (ch === '<' && /[a-zA-Z/!]/.test(p.s[k + 1] || '')) {
                const [, close, name] = /^<(\/?)([a-zA-Z]*)/.exec(p.s.slice(k)), isInline = /^(br|b|i|em|strong|span|u|small|kbd|code|abbr|a|mark|sup|sub|s)$/i.test(name);
                inTag = hadTag = true;
                if (!isInline) brk(); else if (!close) add(' ', p.at + k);                // inline tags stay inside the sentence
                continue;
            }
            add(ch, p.at + k);
        }
    });
    brk();
    return runs.map(r => ({ ...r, text: tidy(r.text), markup: hadTag }));
}
function exprText(expr, at, sink) {
    const inner = scanRaw(expr, at);
    const words = inner.filter(t => isText(t.text, true) && !/^(undefined|function|object|string|number|boolean)$/.test(t.text)).map(t => t.text);
    if (inner.some(t => t.markup) || words.length > 3) { sink.push(...inner); return null; }   // markup or a whole table: its words stand on their own
    if (words.length) return `[${words.join(' | ')}]`;                             // real words: they count as text
    const lits = inner.map(t => t.text);
    if (lits.length && lits.every(l => l.length <= 1) && lits.some(l => /[a-z]/.test(l))) return '';   // a plural "s"
    return PH[0] + placeholderFor(expr) + PH[1];
}
function concatTail(src, e) {                                                       // 'text ' + x + ' more' reads as one line
    let text = '';
    for (;;) {
        const plus = /^\s*\+\s*/.exec(src.slice(e, e + 20)); if (!plus) break;
        const j = e + plus[0].length;
        if (src[j] === "'" || src[j] === '"') { const [s, end] = readQuoted(src, j); text += s; e = end; continue; }
        const op = /^[\w$.]+(?:\[[^\]'"`]*\]|\((?:[^()'"`]|\([^()'"`]*\))*\)|\.[\w$]+)*/.exec(src.slice(j, j + 200));
        if (!op || !op[0] || /^\d/.test(op[0])) break;
        text += PH[0] + placeholderFor(op[0]) + PH[1]; e = j + op[0].length;
    }
    return [text, e];
}
const SILENT_CALLS = /^(setAttribute|querySelector|querySelectorAll|getElementById|closest|matches|addEventListener|removeEventListener|dispatchEvent|CustomEvent|Event|createElement|getItem|setItem|removeItem|toggle|contains|includes|startsWith|endsWith|indexOf|split|join|replace|test|tryBark|tryComment|toLocaleString|toLocaleDateString|adjustEthics|noteStanding|hasStanding)$/;   // their strings are never shown
/** Every run of text in a stretch of source: { text, at, path (the keys it sits under), key, frame, markup }. */
function scanRaw(src, base = 0) {
    const out = [], frames = [{ open: '', other: 0 }];
    let i = 0, prevSig = '', prevWord = '';
    const top = () => frames[frames.length - 1], isKeyAt = e => /^\s*:(?!:)/.test(src.slice(e, e + 3)) && (prevSig === '{' || prevSig === ',' || prevSig === '');
    const keyPath = () => frames.filter(f => f.fromKey).map(f => f.name);
    while (i < src.length) {
        const ch = src[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
        if (ch === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
        if (ch === '/' && (/[(,=:[!&|?{};+\-*%<>~^]/.test(prevSig) || prevSig === '' || /^(return|typeof|case)$/.test(prevWord))) {   // a regex
            let inClass = false; i++;
            while (i < src.length && src[i] !== '\n' && (src[i] !== '/' || inClass)) { if (src[i] === '\\') i++; else if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false; i++; }
            i++; while (/[a-z]/.test(src[i] || '')) i++;
            prevSig = 'r'; prevWord = ''; continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            let parts, end;
            if (ch === '`') [parts, end] = readTemplate(src, i);
            else { const [s, e] = readQuoted(src, i), [tail, e2] = concatTail(src, e); parts = [{ s: s + tail, at: i + 1 }]; end = e2; }
            const isKey = ch !== '`' && isKeyAt(end);
            if (isKey) top().key = parts[0].s;
            else if (!(top().open === '(' && SILENT_CALLS.test(top().name || '')) && !/\.(className|cssText|id)\s*\+?=\s*$/.test(src.slice(Math.max(0, i - 40), i))) {
                const sink = [], meta = { path: keyPath(), key: top().key, frame: top() };
                literalRuns(parts, sink).forEach(r => out.push({ ...r, ...meta, at: base + r.at }));
                out.push(...sink.map(t => ({ ...t, at: t.at + base })));
            }
            i = end; prevSig = isKey ? 'k' : 's'; prevWord = ''; continue;
        }
        if (/[A-Za-z_$0-9]/.test(ch)) {                                            // a word or a number; either can be a key
            const w = /^[\w$.]+/.exec(src.slice(i, i + 80))[0], isKey = isKeyAt(i + w.length);
            if (isKey) top().key = w; else top().other++;
            i += w.length; prevSig = isKey ? 'k' : 'w'; prevWord = w; continue;
        }
        if ('{[('.includes(ch)) {
            const before = src.slice(Math.max(0, i - 80), i), fromKey = /:\s*$/.test(before);
            const named = fromKey ? top().key : ((/([A-Za-z_$][\w$]*)\s*=\s*$/.exec(before) || /([A-Za-z_$][\w$]*)\s*$/.exec(before) || [])[1] || null);
            frames.push({ name: named, fromKey: fromKey && named != null, open: ch, other: 0, key: null });
            i++; prevSig = ch; prevWord = ''; continue;
        }
        if ('}])'.includes(ch)) { if (frames.length > 1) frames.pop(); top().other++; i++; prevSig = ch; prevWord = ''; continue; }
        if (ch === ',') top().key = null; else if (ch !== ';') top().other++;
        prevSig = ch; prevWord = ''; i++;
    }
    return out.sort((a, b) => a.at - b.at);
}
const scanText = src => scanRaw(src).filter(t => !/^(id|art|tone|color|icon|portraitId|reason)$/.test(t.key || '')).map(t => t.text).filter(t => isText(t) && !NAMES.has(t)).map(printed);

// ── pieces of source: a method, a declaration, or the lines between two markers ──
function lineAt(text, index) { let n = 1; for (let k = text.indexOf('\n'); k >= 0 && k < index; k = text.indexOf('\n', k + 1)) n++; return n; }
const methodRe = name => new RegExp(`^[ \\t]*(?:static |async )?(?:function )?${name}\\s*(?:=\\s*(?:function\\s*)?)?\\([^)]*\\)\\s*(?:=>\\s*)?\\{`, 'm');
/** The declaration or block that starts on the line matching `re`, up to the bracket closing it at the same indent. */
function block(rel, re, id) {
    const text = read(rel), m = re.exec(text);
    if (!m) { console.warn(`not found in ${rel}: ${re}`); return { rel, src: '', line: 1, id: id || String(re) }; }
    const start = text.lastIndexOf('\n', m.index) + 1, indent = /^[ \t]*/.exec(text.slice(start))[0], firstEnd = text.indexOf('\n', start);
    const first = text.slice(start, firstEnd).replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, '').replace(/\/\/.*$/, '');
    const opens = (first.match(/[{[(]/g) || []).length - (first.match(/[}\])]/g) || []).length;
    const closer = new RegExp(`\\n${indent}[}\\]]`, 'g'); closer.lastIndex = firstEnd;
    const endAt = opens <= 0 ? firstEnd : ((closer.exec(text) || { index: text.length }).index + 1);
    const end = opens <= 0 ? firstEnd : text.indexOf('\n', endAt) < 0 ? text.length : text.indexOf('\n', endAt);
    return { rel, src: text.slice(start, end), line: lineAt(text, start), id: id || (/(\w+)\s*[=(:]/.exec(first.trim()) || [])[1] || 'block' };
}
const method = (rel, name) => block(rel, methodRe(name), name);
const bm = name => method('src/bundle.js', name);                                  // a method of the game (GameState or App)
function between(rel, fromRe, toRe, id) {
    const text = read(rel), m = fromRe.exec(text); if (!m) { console.warn(`not found in ${rel}: ${fromRe}`); return { rel, src: '', line: 1, id }; }
    const start = text.lastIndexOf('\n', m.index) + 1, rest = text.slice(start), m2 = toRe ? toRe.exec(rest.slice(1)) : null;
    const end = m2 ? start + 1 + rest.slice(1).lastIndexOf('\n', m2.index) + 1 : text.indexOf('\n', m.index);
    return { rel, src: text.slice(start, end < start ? text.length : end), line: lineAt(text, start), id };
}
const whole = (rel, id) => ({ rel, src: read(rel), line: 1, id: id || path.basename(rel, '.js') });
const fnPiece = (fn, rel, id) => ({ rel, src: typeof fn === 'function' ? `(${fn.toString()})` : '', line: null, id });
const span = p => [p.line, p.line + p.src.split('\n').length - 1];
const inside = (...ranges) => t => ranges.some(([a, b]) => t.line >= a && t.line <= b);
const outside = (...ranges) => t => !inside(...ranges)(t);
/** Lines of a method that only run at the light (sector 6): `if (…isStructure…) {…}` blocks, or one-line ifs. */
function lightRanges(piece) {
    const lines = piece.src.split('\n'), out = [];
    lines.forEach((l, k) => {
        if (!/isStructure|=== 'STRUCTURE'|>= FINAL_SECTOR/.test(l) || /!\(?[\w.]*isStructure|isLandable/.test(l)) return;
        const indent = /^\s*/.exec(l)[0].length; let e = k;
        if (/\{\s*(\/\/.*)?$/.test(l)) { e = k + 1; while (e < lines.length && !(/^\s*\}/.test(lines[e]) && /^\s*/.exec(lines[e])[0].length <= indent)) e++; }
        out.push([piece.line + k, piece.line + e]);
    });
    return out;
}

const HIDDEN_KEYS = /^(id|art|tone|color|icon|portraitId|reason)$/;   // values the player never reads
const ROLE_SPEAKER = { ENGINEER: 'Eng. Jaxon', MEDIC: 'Dr. Aris', SECURITY: 'Spc. Vance', SPECIALIST: 'Tech Mira', AURA: 'A.U.R.A.', LEADER: 'Commander' };
const STRUCTURAL = /^(choices|dialogue|beats|draw|style|text|speaker|detail)$/, LABEL_KEYS = /^(title|kicker|label|heading|close|button|name|word|text)$/;   // keys not worth printing; keys whose single word is still text
/** Markdown bullets for every line of text in a piece of source, each tagged with the line it is on. */
function bulletsOf(piece, keep = () => true) {
    const file = path.basename(piece.rel);
    const items = scanRaw(piece.src).map(t => ({ ...t, line: piece.line ? piece.line + lineAt(piece.src, t.at) - 1 : null })).filter(t => t.text && !HIDDEN_KEYS.test(t.key || '') && keep(t));
    const byFrame = new Map(); items.forEach(t => byFrame.set(t.frame, (byFrame.get(t.frame) || []).concat(t)));
    const isId = k => /^[A-Z][A-Z0-9_]+$|^\d+$/.test(k);
    const isListy = f => { const texts = byFrame.get(f).map(t => t.text), allEnum = texts.every(t => /^[A-Z0-9_]+$/.test(t)), name = f.name || '';
        return f.open === '[' && f.other === 0 && (/name|sign/i.test(name) || (!allEnum && (isId(name) || /word|label|phrase|hazard/i.test(name)))); };
    const label = t => { const keys = [...t.path.filter(k => !STRUCTURAL.test(k)), t.key && !/^(text|speaker)$/.test(t.key) ? t.key : null].filter(Boolean); return keys.length ? `**${keys.join(' · ')}** — ` : ''; };
    const at = t => tag(file, t.line ? `line ${t.line}` : piece.id), out = [];
    for (let k = 0; k < items.length; k++) {
        const t = items[k], next = items[k + 1];
        if (/^(speaker|name)$/.test(t.key) && next && next.frame === t.frame && next.key === 'text') { out.push(`- ${lineOf(printed(t.text), printed(next.text))}${at(t)}`); k++; continue; }
        const listy = isListy(t.frame);
        if (listy) {
            const group = byFrame.get(t.frame).filter(g => isText(g.text, true)), isShort = group.every(g => g.text.split(' ').length <= 7 && !/[.!?"”]$/.test(g.text));   // phrases and names share a line; sentences do not
            if (isShort && group.length) { out.push(`- ${label(t)}${group.map(g => printed(g.text)).join(' · ')}${at(t)}`); k = items.lastIndexOf(byFrame.get(t.frame).slice(-1)[0]); continue; }
        }
        const isPair = t.frame.open === '[' && byFrame.get(t.frame).length === 2 && ROLE_SPEAKER[t.text] && next && next.frame === t.frame;
        if (isPair) { out.push(`- ${label(t)}${lineOf(ROLE_SPEAKER[t.text], printed(next.text))}${at(t)}`); k++; continue; }   // ['ENGINEER', 'line']
        if (!isText(t.text, listy || LABEL_KEYS.test(t.key || '')) || NAMES.has(t.text)) continue;
        out.push(`- ${label(t)}${printed(t.text)}${at(t)}`);
    }
    return out;
}
/** A heading, a line on when it plays, and the bullets. */
function textSection(level, title, piece, where, keep) {
    const bullets = bulletsOf(piece, keep);
    return [`${'#'.repeat(level)} ${title}${tag(path.basename(piece.rel), piece.id)}`, ...(where ? [`_${where}_`] : []), '', ...(bullets.length ? bullets : ['_(no text)_']), ''];
}

/** Lines a choice's code can print that the stand-in run did not: other rolls of the dice, other states of the ship. */
function otherOutcomes(fn, heard) {
    const seen = heard.join(' ');
    const isCovered = t => t.split(/\[[^\]]*\]/).map(s => s.trim()).filter(s => s.length > 3).every(s => seen.includes(s));
    return [...new Set(scanText(fnPiece(fn).src))].filter(t => !isCovered(t));
}
/** One scene: title, the situation, the talk, and each choice with what it costs and what it says happened. */
function sceneMd(enc, file, opts = {}) {
    const out = [], sector = opts.sector || 3;
    out.push(`### ${clean(enc.title || enc.name || enc.id)}${tag(file, enc.id)}`);
    if (opts.where) out.push(`_${opts.where}_`);
    const ctx = enc.context != null ? ctxOf(enc.context, opts.ctxArg) : enc.desc ? clean(enc.desc) : '';
    if (ctx) out.push('', `> ${ctx}`);
    let talk = enc.dialogue;
    try { if (typeof talk === 'function') talk = talk(opts.ctxArg !== undefined ? opts.ctxArg : mockState(sector).state); } catch (e) { talk = []; }
    if (Array.isArray(talk) && talk.length) { out.push(''); talk.forEach(d => out.push(lineOf(d.speaker, d.text) + '  ')); }
    if (typeof enc.dialogue === 'function') otherOutcomes(enc.dialogue, talk.map(d => d.text)).forEach(t => out.push(`↳ or: ${t}  `));
    const outcome = (effect, indent) => {
        const result = runEffect(effect, sector, opts.crewPick), heard = result ? [result.said, ...result.logs].filter(Boolean).map(clean) : [];
        if (heard.length) out.push(`${indent}→ ${heard.join(' / ')}  `);
        otherOutcomes(effect, heard).forEach(t => out.push(`${indent}↳ or: ${t}  `));
    };
    const choices = enc.choices || [];
    if (choices.length) {
        out.push('', 'Choices:');
        choices.forEach((c, i) => {
            out.push(`${i + 1}. **${clean(c.text)}** — ${clean(c.desc || (c.reward ? `risk +${c.riskMod || 0}` : ''))}${c.requiresLabel ? ` _(locked: ${clean(c.requiresLabel)})_` : ''}`);
            outcome(c.effect, '   ');
        });
    } else if (typeof enc.effect === 'function') { out.push('', 'What happens:'); outcome(enc.effect, ''); }
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
    let m; while ((m = re.exec(src))) out.push(`- ${clean(m[2].replace(/\\(["'])/g, '$1').replace(/\$\{([^}]*)\}/g, (_, e) => `[${placeholderFor(e)}]`))}`);
    return out;
}
const kickerOf = src => scanRaw(src).filter(t => t.key === 'kicker' && isText(t.text, true)).map(t => printed(t.text)).join(' / ');
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
const REELS = (sandbox.window.StoryReel && sandbox.window.StoryReel.REELS) || {};
const reelCaptions = name => REELS[name] ? REELS[name].beats.map(b => `*${clean(b[1])}*  `) : [];
const reelSource = name => REELS[name] && REELS[name].source ? `_Source on screen: ${REELS[name].source}_` : '';

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
const sectorsWhere = key => [1, 2, 3, 4, 5, 6].filter(s => (SECTORS[s] || {})[key] > 0);
/** Which random pools can turn up in each sector: from SectorConfig chances, PlanetGenerator and App.tidySites. */
const POOL_SECTORS = {
    'Exodus wrecks (one of our ships)': sectorsWhere('exodusWreckChance'), 'Wreckage in orbit': sectorsWhere('derelictChance'), 'Colony ruins': sectorsWhere('failedColonyChance'),
    'Strange places': [1, 2, 3, 4, 5, 6], 'The Wrong Place': [3, 4, 5, 6], 'Late places': [4, 5, 6], 'Old stations': [1, 2, 3, 4, 5, 6], 'Asteroid fields': [1, 2, 3, 4, 5, 6],
    'Distress calls': [1, 2, 3, 4, 5, 6], 'Ship problems': [1, 2, 3, 4, 5, 6], 'Surface finds': [1, 2, 3, 4, 5, 6],
};
const POOL_NOTES = { 'Strange places': 'one is always placed in every sector; THE FOLD and THE DOOR only from sector 3', 'The Wrong Place': 'only through THE FOLD',
    'Late places': 'the beacon and the dome from sector 4, the graves from sector 5', 'Ship problems': 'on warps and jumps, never on the approach to the light' };
const sectorList = list => list.length === 6 ? 'any sector' : `sector${list.length > 1 ? 's' : ''} ${list.join(', ')}`;
const poolAnchor = title => title.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim().replace(/ +/g, '-');

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
const HOW = '_Generated by `node tools/export_script.js` from the game itself. Each line is tagged «file · id» or «file · line N» so edits can be copied back exactly. Words in [brackets] are filled in by the game; [a | b] means one of them is shown. Edit freely: mark changes, cut lines, add notes in [brackets]._';
const LIGHT_METHODS = [['handleWarp', 'Warping to the light'], ['handleSectorJump', 'Trying to jump past it'], ['handleScanAction', 'Scanning it'], ['handleProbeAction', 'Sending a probe'], ['handleEvaAction', 'Sending the team']];
const BREAK_ORBIT = between('src/bundle.js', /addEventListener\('req-break-orbit'/, /\n\s*\}\);/, 'init · req-break-orbit');
const COACH_TIPS = block('src/systems/Coach.js', /function tipFor/, 'tipFor'), COACH_SECTOR_1 = span(block('src/systems/Coach.js', /if \(sector === 1\) \{/));

// the opening
{
    const b = [HOW, '', '## Title screen', ''];
    const tagline = /EXODUS PROGRAM \/\/ VESSEL 9[\s\S]*?SILENT EXODUS[\s\S]*?<div[^>]*>\s*([^<]+?)\s*<\/div>/.exec(BUNDLE);
    b.push(`*SILENT EXODUS — ${tagline ? tagline[1] : ''}*${tag('bundle.js', 'start menu')}`, '', 'Everything else on the title screen:', ...bulletsOf(bm('showStartMenu'), t => !/EIGHT WENT BEFORE YOU/.test(t.text)));
    b.push('', `## The briefing film${tag('StoryReel.js', 'program')}`, reelSource('program'), '', ...reelCaptions('program'));
    const opening = methodSource('showOpeningBriefing');
    b.push('', `## Good morning, Commander${tag('bundle.js', 'showOpeningBriefing')}`, `_Card kicker: ${kickerOf(opening)}_`, '', `> ${clean((/context:\s*'((?:\\'|[^'])*)'/.exec(opening) || [])[1] || '').replace(/\\'/g, "'")}`, '', ...dialogueFrom(opening), '', 'Choice:', ...choicesFrom(opening));
    b.push('', 'Then in the log:', ...logsFrom(opening));
    write('00-opening.md', 'The opening', b);
}

// what only happens in one sector, beyond the story beats
const HAZARD_HOOKS = ['onWarp', 'onScan', 'onSectorEnter'];
function hazardMd(sector) {
    const hz = (SECTORS[sector] || {}).hazard; if (!hz) return [];
    const b = [`## The sector's own trouble: ${hz.id}${tag('SectorConfig.js', `${sector}.hazard`)}`, `_${clean(hz.description)}_`, ''];
    HAZARD_HOOKS.filter(h => typeof hz[h] === 'function').forEach(h => {
        const lines = bulletsOf(fnPiece(hz[h], 'src/data/SectorConfig.js', `${sector}.hazard.${h}`));
        if (lines.length) b.push(`${{ onWarp: 'On a warp inside this sector', onScan: 'On a long-range scan', onSectorEnter: 'On arrival' }[h]}:`, ...lines, '');
    });
    if (b.length === 3) b.push('It has no lines of its own; it only changes the rules of the sector.', '');
    return b;
}
function extrasMd(sector) {
    const b = [];
    if (sector === 1) {
        b.push(...textSection(3, 'How every found page is shown (all sectors)', whole('src/systems/FoundPage.js'), 'The card around each found page; the ledger rows are built from the wrecks you boarded (sector 5).'));
        b.push(...textSection(2, 'If you try to settle a planet here (sectors 1 and 2)', bm('showColonyWarningModal'), 'The crew warn you off. Sector 2 uses the same card.'));
    }
    if (sector === 2) b.push('## If you try to settle a planet here', '', 'The same crew warning card as sector 1 — see [sector-1.md](sector-1.md).', '');
    if (sector === 3) {
        b.push(...textSection(2, 'A planet that is not there', between('src/views/NavView.js', /SIGNAL INTERFERENCE: /, /this\.handlePlanetSelect\(data\)/, 'phantom planet click'), 'The arrival can add a ghost planet (see the sector\'s own trouble, below). Clicking it:'));
        b.push(`## Never played: the corridor film${tag('StoryReel.js', 'corridor')}`, '_Written for this sector, but no code plays it._', reelSource('corridor'), '_Counter on screen: HULLS ON THIS HEADING_', '', ...reelCaptions('corridor'), '');
    }
    if (sector === 6) {
        b.push('## The light', '');
        b.push(...textSection(3, 'On the sector map', method('src/views/NavView.js', 'handleStructureSelect'), 'The panel when you click the light.'));
        b.push(...textSection(3, 'The jump button', between('src/views/NavView.js', /isFinalSector \? 'END OF THE CORRIDOR'/, null, 'render · jump button'), 'In the last sector the jump button is disabled.'));
        b.push(...textSection(3, 'In orbit at the light', method('src/views/OrbitView.js', 'renderStructure'), ''));
        b.push(...textSection(3, 'The final button', between('src/views/OrbitView.js', /planet\.isStructure && !planet\.structureApproached/, /\$\{planet\._isWrongPlace/, 'updateCommandDeck · btn-structure'), ''));
        LIGHT_METHODS.forEach(([name, title]) => { const p = bm(name); b.push(...textSection(3, title, p, 'Only these lines of it play at the light.', inside(...lightRanges(p)))); });
        b.push(...textSection(3, 'Trying to leave', BREAK_ORBIT, 'Breaking orbit at the light.', inside(...lightRanges(BREAK_ORBIT))));
    }
    return b;
}

// the sectors
for (let sector = 1; sector <= 6; sector++) {
    const cfg = SECTORS[sector] || {}, intent = INTENT[sector], b = [HOW, ''];
    b.push(`**What this sector is for.** ${intent.idea}`, '', `**What is wrong.** ${intent.wrong}`, '', `**What the player learns.** ${intent.learn}`, '');
    b.push(`Map text: *${clean(cfg.ambientDesc)}*${tag('SectorConfig.js', `${sector}.ambientDesc`)}  `);
    if (sector === 1) b.push('', 'Objective lines (the tip above the log, one at a time, whichever fits what you are doing):', ...bulletsOf(COACH_TIPS, inside(COACH_SECTOR_1)));
    else b.push(`Objective line: *${clean(coachLines()[sector] || '')}*${tag('Coach.js', `SECTOR_LINE.${sector}`)}`);
    if (sector === 2) b.push('', 'When the page is found or the stops run out (sectors 2 to 6):', ...bulletsOf(COACH_TIPS, t => t.line > COACH_SECTOR_1[1]));
    if (sector >= 2) {
        b.push('', '## Arriving', '');
        if (sector === 3) b.push(`### The jump that does not finish${tag('TheThrow.js', 'BEATS')}`, '', ...throwBeats(), '', ...textSection(4, 'The card when it ends', method('src/systems/TheThrow.js', 'play'), 'Also the log lines. Mira says the line; A.U.R.A. says hers if Mira is dead.'));
        b.push(`Arrival card: *${clean(arrivalLines()[sector] || '')}*${tag('bundle.js', `SECTOR_ARRIVAL_LINES.${sector}`)}  `, '', ...arrivalCrew(sector));
        if (sector === 2) b.push('', ...textSection(4, 'A.U.R.A. on who has been flying', bm('getRelianceVoice'), 'Added to every arrival card from here on, once you have plotted four or more jumps: one line if you let her fly most of them, the other if you flew them yourself.'));
        const shot = sector === 3 ? null : `jump${sector}`;
        if (shot && reelCaptions(shot).length) b.push('', `Closing shot${tag('StoryReel.js', shot)}: ${reelCaptions(shot).join(' ')}  `, reelSource(shot));
    }
    b.push('', '## The story beats (always here)', '');
    if (sector === 1) {
        b.push(`### The marked beacon — the first wreck${tag('bundle.js', 'findDiscDrawing')}`, '_The first wreck is an ordinary Exodus wreck from the pool (see [pools.md](pools.md)), named like every wreck: EXODUS-[number] "[CALLSIGN]". Whatever you choose inside it, this is in its logbook:_', '', ...bulletsOf(bm('findDiscDrawing')), '');
        b.push(`#### The drawing of the gold disc${tag('DiscDocument.js', 'NOTES')}`, '_A card with the drawing. Point at each label to read its note._', '', ...bulletsOf(block('src/systems/DiscDocument.js', /const o = Object\.assign/, 'open · defaults')), '');
        ((sandbox.window.DiscDocument || {}).NOTES || []).forEach(n => b.push(`- **${n.label}** — ${clean(n.text)}${tag('DiscDocument.js', `NOTES.${n.key}`)}`));
        b.push('', 'In the cargo hold afterwards:', ...bulletsOf(block('src/data/Items.js', /^\s{4}DISC_DRAWING: \{/m, 'DISC_DRAWING')), '');
        const count = methodSource('showCountScene');
        b.push(`### Head count${tag('bundle.js', 'showCountScene')}`, `_On the first return to the map in sector 1. Card kicker: ${kickerOf(count)}_`, '', `> ${clean((/context:\s*'((?:\\'|[^'])*)'/.exec(count) || [])[1] || '').replace(/\\'/g, "'")}`, '', ...dialogueFrom(count), '', 'Choices:', ...choicesFrom(count), '', 'What each choice says in the log:', ...logsFrom(count), '');
    }
    if (sector === 2) {
        const tape = methodSource('findBriefingTape');
        b.push(`### The uncut briefing tape${tag('StoryReel.js', 'uncut')}`, '_In one of the wrecks. Plays as a film, then:_', reelSource('uncut'), '', ...reelCaptions('uncut'), '', ...logsFrom(tape), '', 'In the cargo hold afterwards:', ...bulletsOf(block('src/data/Items.js', /^\s{4}BRIEFING_TAPE: \{/m, 'BRIEFING_TAPE')), '');
    }
    PAGES.filter(p => p.sector === sector).forEach(page => {
        b.push(`### Found page: ${page.logTitle}${tag('ExodusLogs.js', page.id)}`, `_In one wreck in this sector. ${clean(page.desc)} In the cargo hold it is called: ${clean(page.name)}._`, '');
        page.lines.forEach(l => b.push(`${clean(l)}  `));
        if (page.names) b.push('', `Names on it: ${page.names.map(n => n || '(blank)').join(' · ')}`);
        if (page.after) b.push('', lineOf(page.after.speaker, page.after.text));
        b.push('');
    });
    b.push(...extrasMd(sector), ...hazardMd(sector));
    const moments = CREW_EVENTS.filter(ev => crewSectors(ev).includes(sector));
    if (moments.length) {
        b.push('## Crew moments that can happen here', `_Card kicker: ${kickerOf(methodSource('showCrewPersonalEvent'))}_`, '');
        moments.forEach(ev => b.push(sceneMd(ev, 'CrewEvents.js', { sector, where: `Sectors ${crewSectors(ev).join(', ')}`, crewPick: WHO[ev.crewId] }), ''));
    }
    b.push(`## The talk when you jump out of sector ${sector}`);
    if (sector === 2) b.push('', 'Nothing plays here: the jump from sector 2 into sector 3 is the jump that does not finish (sector-3.md), and it skips the talk.', '');
    else if (sector === 6) b.push('', 'Nothing plays here: there is no jump out of sector 6. The jump button reads END OF THE CORRIDOR; the light and the finale come next ([07-finale.md](07-finale.md)).', '');
    else {
        b.push('_One plays: the highest priority that applies._', '');
        campfireFor(sector).forEach(t => b.push(sceneMd(t, 'CampfireEvents.js', { sector, where: `Priority ${t.priority || 1}, sectors ${t.sectorRange.join('–')}` }), ''));
    }
    b.push('## What else can happen here', '', 'From the shared pools ([pools.md](pools.md)):', ...Object.entries(POOL_SECTORS).filter(([, s]) => s.includes(sector)).map(([name]) => `- [${name}](pools.md#${poolAnchor(name)})${POOL_NOTES[name] ? ` — ${POOL_NOTES[name]}` : ''}`),
        '', 'Anywhere: what A.U.R.A. and the crew say in the log, warps, food, stress and game over ([09-ship-and-crew.md](09-ship-and-crew.md)); orbit, scans, probes and away teams ([10-away-team.md](10-away-team.md)); cargo, fabricator and map names ([11-cargo-and-map.md](11-cargo-and-map.md)).');
    write(`sector-${sector}.md`, `Sector ${sector} — ${clean(cfg.name)}`, b);
}

// the finale
{
    const fin = G('STRUCTURE_ENCOUNTER'), modal = bm('showStructureModal'), b = [HOW, ''];
    b.push(...textSection(2, 'Going in', bm('handleStructureAction'), 'Pressing GO INTO THE LIGHT.'));
    b.push(`## The reading${tag('StoryReel.js', 'reading')}`, reelSource('reading'), '', ...reelCaptions('reading'), '');
    const discCard = between('src/bundle.js', /kicker: 'INSIDE THE LIGHT/, null, 'showStructureModal');   // the one line of options passed to DiscDocument.open
    b.push(`## The disc, inside the light${tag('bundle.js', 'showStructureModal')}`, '_The disc page from sector 1 again, with these words around it:_', '', ...bulletsOf(discCard), '', 'The four notes, the same as in sector 1:');
    ((sandbox.window.DiscDocument || {}).NOTES || []).forEach(n => b.push(`- **${n.label}** — ${clean(n.text)}${tag('DiscDocument.js', `NOTES.${n.key}`)}`));
    b.push('');
    if (fin) {
        b.push(`## ${fin.approach.title}${tag('StructureEncounter.js', 'approach')}`, fin.approach.kicker ? `_Card kicker: ${clean(fin.approach.kicker)}_` : '', '', `> ${clean(fin.approach.context)}`, '', ...fin.approach.dialogue.map(d => lineOf(d.speaker, d.text) + '  '), '', '## The choice', '');
        b.push('_A locked choice shows its reason with this added:_', ...bulletsOf(modal, t => /backed them/.test(t.text)), '');
        fin.choices.forEach(c => {
            b.push(`### ${c.text}${tag('StructureEncounter.js', c.id)}`, `_${clean(c.desc)}_${c.requiresLabel ? `  \nLocked when: ${c.requiresLabel}` : ''}`, '');
            const r = c.effect({ _sleepers: 3 });
            b.push(`**${r.title}**`, '', ...[].concat(r.text).map(t => `${clean(t)}  `), '', `*In the vault on Earth: ${clean(r.vault)}*`, '');
        });
    }
    b.push(...textSection(2, 'The ending card', block('src/systems/EndScreens.js', /function endingHtml/), 'The kicker shows the ending\'s code name (for example BREAK_MAP) as it is.'));
    b.push(...textSection(3, 'Who made it', block('src/systems/EndScreens.js', /function rosterHtml/), 'The crew list on the ending and colony cards.'));
    b.push(...textSection(3, 'In the log', bm('showEndingScreen'), 'The last three lines sit after a return in the code and never print.'));
    write('07-finale.md', 'The finale — the light', b);
}

// settling a planet: every colony ending, read straight from EndingSystem.js
{
    const FILE = 'EndingSystem.js', lines = read('src/systems/EndingSystem.js').split('\n');
    const b = [HOW, '', '_What the player reads after choosing to settle. The game stitches several of these together: how the landing went, then lines about the crew, then what the colony became, then "fifty years later". The italic "when" line shows, in code, when the next lines are used._', ''];
    b.push(...textSection(2, 'Pressing SETTLE HERE', bm('_executeColony'), 'A.U.R.A. refuses an unscanned world; otherwise the flight-recorder card comes up before the colony card.'));
    const HEADS = [[/static generateOutcome\(/, 'The second chance (from colony notes)'], [/static generateOutcomeRaw\(/, 'Before anything else: can this world work at all?'], [/static generateEpilogue\(/, 'Fifty years later']];
    const start = lines.findIndex(l => /static generateOutcome\(/.test(l));
    // Group lines by the `if` that guards them: each group prints as its title, then when it applies, then its lines.
    let group = { when: '', titles: [], texts: [] }, lastUntitled = [];
    const flush = () => {
        if (group.titles.length && !group.texts.length && lastUntitled.length) group.texts = lastUntitled.map(t => t.replace(/ «/, ' _(the line above, then this title)_ «'));
        if (group.texts.length || group.titles.length) {
            group.titles.forEach(t => b.push(`### ${t}`));
            if (group.when) b.push(`_when: ${group.when.replace(/_/g, '\\_')}_`);
            b.push(...group.texts, '');
            if (!group.titles.length) lastUntitled = group.texts;
        }
        group = { when: '', titles: [], texts: [] };
    };
    for (let i = start; i < lines.length; i++) {
        const line = lines[i], at = tag(FILE, `line ${i + 1}`);
        const head = HEADS.find(([re]) => re.test(line)), section = /\/\/ ---\s*(.+?)\s*---/.exec(line);
        if (head || section) { flush(); lastUntitled = []; b.push(`## ${head ? head[1] : section[1]}`, ''); continue; }
        const cond = /^\s*(?:\}\s*else\s+)?if\s*\((.+)\)\s*\{?\s*$/.exec(line);
        if (cond) { flush(); group.when = cond[1]; continue; }
        if (/^\s*\}\s*else\s*\{\s*$/.test(line)) { const before = group.when; flush(); group.when = before ? `otherwise (not: ${before})` : 'otherwise'; continue; }
        if (/^\s*(\/\/|\*|console\.)/.test(line)) continue;
        const named = /title\s*=\s*(["'])((?:\\.|(?!\1).)+)\1|title:\s*(["'])((?:\\.|(?!\3).)+)\3|\{\s*t:\s*(["'])((?:\\.|(?!\5).)+)\5/.exec(line);
        const title = named && (named[2] || named[4] || named[6]);
        if (title && title !== 'UNKNOWN') { if (named[6]) flush(); group.titles.push(`${title.replace(/\\(.)/g, '$1')}${at}`); }
        const key = /^\s*'([A-Z_]+)':/.exec(line);
        scanText(line).filter(t => t.split(/\s+/).length >= 5).forEach(t => group.texts.push(`- ${key ? `**${key[1]}** — ` : ''}${t}${at}`));
    }
    flush();
    b.push(...textSection(2, 'The colony card', block('src/systems/EndScreens.js', /function colony/), 'The card these lines are printed on. The crew list under it says "a founder" or "lost with the colony" (see 07-finale.md, Who made it).'));
    write('08-settling.md', 'Settling a planet — every colony ending', b);
}

// the pools
{
    const b = [HOW, '', 'Random encounters. Each pool says which sectors it can turn up in. Card words around each pool (kickers, labels, log lines) come first, then the encounters.', ''];
    const wrap = (...names) => names.flatMap(n => textSection(4, `Card words: ${n}`, bm(n), ''));
    const POOLS = [['Exodus wrecks (one of our ships)', 'EXODUS_ENCOUNTERS', 'ExodusDerelicts.js', { ctxArg: SAMPLE.ship }, () => [...wrap('handleExodusAction'), ...textSection(4, 'Names on the hulls', bm('getWreckName'), 'Every wreck card is titled EXODUS-[number] "[CALLSIGN]". The number range grows with the sector; the callsign is picked from this list.'),
            ...textSection(4, 'A second list of ship names', block('src/data/ExodusDerelicts.js', /const EXODUS_SHIP_NAMES/, 'EXODUS_SHIP_NAMES'), 'Defined in the wreck file; the wreck titles use the list above.')]],
        ['Wreckage in orbit', 'DERELICT_ENCOUNTERS', 'DerelictEncounters.js', { ctxArg: 'The wreck' }, () => wrap('handleDerelictAction')],
        ['Old stations', 'SPACE_STATION_ENCOUNTERS', 'SpaceStations.js', { ctxArg: SAMPLE.station }, () => wrap('showStationEncounter', 'handleStationAction')],
        ['Colony ruins', 'FAILED_COLONY_ENCOUNTERS', 'FailedColonyEncounters.js', { ctxArg: 'the planet' }, () => wrap('handleFailedColonyAction')],
        ['Strange places', 'ANOMALY_ENCOUNTERS', 'AnomalyEncounters.js', {}, () => wrap('handleAnomalyAction')],
        ['Asteroid fields', 'ASTEROID_FIELD_ENCOUNTERS', 'AsteroidFields.js', { ctxArg: 'The field' }, () => wrap('showAsteroidEncounter', 'handleAsteroidAction')],
        ['Distress calls', 'DISTRESS_SIGNAL_ENCOUNTERS', 'DistressSignals.js', { ctxArg: SAMPLE.age }, () => wrap('showDistressSignal')],
        ['Ship problems', 'SHIP_MALFUNCTION_EVENTS', 'ShipEvents.js', {}, () => wrap('showShipMalfunctionModal')]];
    const poolHead = (title, count) => [`## ${title}${count != null ? ` (${count})` : ''}`, `_Can turn up in: ${sectorList(POOL_SECTORS[title])}${POOL_NOTES[title] ? ` (${POOL_NOTES[title]})` : ''}._`, ''];
    POOLS.forEach(([title, name, file, opts, around]) => {
        const pool = G(name) || [];
        b.push(...poolHead(title, pool.length), ...around());
        pool.forEach(enc => b.push(sceneMd(enc, file, opts), ''));
        if (name === 'ANOMALY_ENCOUNTERS') {
            b.push(...poolHead('The Wrong Place'), '_THE FOLD can throw the ship here. A sector of copies; two ways out._', '');
            b.push(...textSection(3, 'Arriving', bm('handleAnomalyTeleport'), 'The sector header, and the old names the code still has for sectors.'));
            b.push(...textSection(3, 'In orbit', between('src/views/OrbitView.js', /\$\{planet\._isWrongPlace/, /: `<button class="cmd-btn danger" id="btn-leave"/, 'updateCommandDeck · wrong place'), 'The two buttons instead of BREAK ORBIT.'));
            b.push(...textSection(3, 'Fight to escape', bm('handleWrongPlaceEscape'), ''), ...textSection(3, 'Accept your fate (an ending)', bm('handleWrongPlaceAccept'), ''));
        }
    });
    const pois = G('LATE_GAME_POIS') || {};
    b.push(...poolHead('Late places'), ...wrap('handleLateGamePOI'));
    Object.values(pois).forEach(poi => b.push(sceneMd(poi, 'LateGamePOIs.js', { sector: 5 }), ''));
    const events = G('EVENTS') || [];
    b.push(...poolHead('Surface finds', events.length), '_What the team finds when there is no site. Two choices each: the safe one and the risky one. The card they are shown on, and how the trip ends, are in [10-away-team.md](10-away-team.md)._', '');
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

// anywhere: the ship, the crew and A.U.R.A.
{
    const AURA = 'src/systems/AuraSystem.js', talk = block(AURA, /const AURA_COMMENTARY/, 'AURA_COMMENTARY');
    const UNUSED = ['SHIP_DAMAGE', 'FIRST_LANDING', 'FEW_CREW', 'ETHICS_RESET'], isUnused = t => UNUSED.includes(t.path[0]);
    const b = [HOW, '', 'Lines that can play in any sector: what A.U.R.A. and the crew say in the log, stress and breakdowns, food, damage, flying, and losing.', ''];
    b.push('## A.U.R.A.', '');
    b.push(...textSection(3, 'What she says after things happen', talk, 'In the log after orbit, scans, warps, probes, team trips, deaths and jumps. Which line plays depends on how much she trusts you: COOPERATIVE, NEUTRAL, SUSPICIOUS or ADVERSARIAL.', t => !isUnused(t)));
    b.push(...['adjustEthics', 'checkAdversarialAction', 'applyTechFragment', 'jaxonOverride', '_unlockDecks'].flatMap(n => textSection(3, `When her trust changes or she turns: ${n}`, method(AURA, n), '')));
    b.push(...textSection(3, 'Premonitions', method(AURA, 'generatePremonition'), 'When she trusts you NEUTRAL or less: a 30% chance on entering orbit. The follow-up lines play on the next orbit.'));
    b.push(...textSection(3, 'The air vent card', bm('showAuraVentModal'), 'When she turns hostile. The third time is game over.'));
    b.push(...textSection(3, 'The data chip', block('src/data/Items.js', /^\s{4}TECH_FRAGMENT: \{/m, 'TECH_FRAGMENT'), 'A Tech Fragment used from the cargo hold.'));
    b.push(...textSection(3, 'Never shown: lines nothing calls', talk, `${UNUSED.join(', ')}: no code triggers these.`, isUnused));
    b.push('## The crew under strain', '', ...textSection(3, 'The card around every crew moment', bm('showCrewPersonalEvent'), 'The moments themselves are in each sector file.'));
    b.push(...textSection(3, 'Stress', bm('applyStressTraits'), 'When someone reaches stress 2; the first time is a tutorial.'));
    b.push(...textSection(3, 'Breakdowns', bm('triggerBreakdown'), 'When someone reaches stress 3. The commander breaking is game over.'), ...textSection(3, 'Mutiny', bm('showMutinyEvent'), 'Vance at stress 3.'));
    b.push(...textSection(3, 'Bringing someone back', bm('handleRevivalAction'), 'Using Pulsing Spores or an Ancient Neural Link from the cargo hold.'));
    b.push('## Food, damage and data', '', ...textSection(3, 'Food', bm('consumeRation'), 'Each warp, team trip and jump eats a ration.'), ...textSection(3, 'Deck damage', bm('damageRandomDeck'), 'The first time is a tutorial.'));
    b.push(...textSection(3, 'What the data adds up to', bm('addColonyKnowledge'), 'At 1, 3 and 5 data.'));
    b.push('## Flying', '');
    [['handleWarp', 'Warping to a planet'], ['handleSectorJump', 'Jumping to the next sector']].forEach(([n, title]) => { const p = bm(n); b.push(...textSection(3, title, p, 'The lines for the light are in sector-6.md.', outside(...lightRanges(p)))); });
    b.push(...textSection(3, 'Breaking orbit', BREAK_ORBIT, '', outside(...lightRanges(BREAK_ORBIT))), ...textSection(3, 'After the burn', bm('applyPlotResult'), 'After every warp and jump plot.'));
    b.push(...textSection(3, 'Plotting the burn (the mini-game)', whole('src/systems/WarpPlot.js'), 'Before every warp and jump: the crew and A.U.R.A. react to how it went.'));
    b.push('## Game over', '', ...textSection(3, 'All hands lost, hull breach', bm('checkLoseConditions'), ''), ...textSection(3, 'Stranded', bm('checkStranded'), 'No energy and no way out.'));
    b.push(...textSection(3, 'The game-over screen', block('src/systems/EndScreens.js', /function gameOver/), ''), ...textSection(3, 'The dead, on that screen', block('src/systems/EndScreens.js', /function memorialHtml/), ''));
    b.push(...textSection(3, 'The numbers, on that screen', block('src/systems/EndScreens.js', /function statsHtml/), ''));
    write('09-ship-and-crew.md', 'The ship, the crew and A.U.R.A. — any sector', b);
}

// anywhere: orbit, scans, probes and away teams
{
    const orbit = 'src/views/OrbitView.js', deck = method(orbit, 'updateCommandDeck');
    const special = [span(between(orbit, /planet\.isStructure && !planet\.structureApproached/, /\$\{planet\._isWrongPlace/)), span(between(orbit, /\$\{planet\._isWrongPlace/, /: `<button class="cmd-btn danger" id="btn-leave"/))];
    const b = [HOW, '', 'What the player reads in orbit around any planet, and on every trip down or aboard.', '', '## In orbit', ''];
    b.push(...textSection(3, 'The command buttons', deck, 'The buttons for the light are in sector-6.md, the Wrong Place ones in pools.md.', outside(...special)));
    b.push(...textSection(3, 'The planet readout', method(orbit, 'render'), 'After a deep scan.'), ...textSection(3, 'Danger', method(orbit, 'dangerHtml'), ''));
    b.push(...textSection(3, 'What the scan found', block(orbit, /static FINDINGS = \{/, 'FINDINGS'), 'One line per thing found: name, what it means, and how it is marked.'));
    b.push(...textSection(3, 'The one site a team can visit', bm('siteOf'), 'Shown on the orbit card; also used in "The lander crosses to [site]".'));
    b.push(...textSection(3, 'An old station', method(orbit, 'renderStation'), ''), ...textSection(3, 'An asteroid field', method(orbit, 'renderAsteroidField'), ''));
    b.push('## Scanning', '');
    [['handleScanAction', 'Deep scan'], ['handleProbeAction', 'Launching a probe'], ['handleEvaAction', 'Sending the team down']].forEach(([n, title], k) => {
        const p = bm(n);
        if (k === 1) b.push('## Probes', '');
        if (k === 2) b.push('## Away teams', '');
        b.push(...textSection(3, title, p, 'The lines for the light are in sector-6.md.', outside(...lightRanges(p))));
        if (k === 0) b.push(...textSection(3, 'Tuning the scan by hand', whole('src/systems/SignalTune.js'), ''), ...textSection(3, 'Long-range scan from the map', bm('handleRemoteScan'), 'Includes A.U.R.A.\'s lying scan when she has turned.'));
        if (k === 1) b.push(...textSection(3, 'Long-range probe from the map', bm('handleRemoteProbe'), ''), ...textSection(3, 'What the probe reports', method('src/systems/ProbeSystem.js', 'performProbe'), ''),
            ...textSection(3, 'What the probe reports, by planet', method('src/systems/ProbeSystem.js', 'getThematicMessage'), ''), ...textSection(3, 'What the probe brings back', whole('src/data/LootTables.js'), 'Data logs and finds ("DATA LOG: …").'));
    });
    b.push(...textSection(3, 'Who goes, and the radio', whole('src/systems/AwayTeam.js'), 'The crew picker, their chatter on the way down, and the return screen.'));
    b.push(...textSection(3, 'Landing (the mini-game)', whole('src/systems/LanderGame.js'), ''), ...textSection(3, 'How the landing went', bm('applyLanding'), ''));
    b.push(...textSection(3, 'The choice card on the surface', bm('showEventModal'), 'The card around every surface find (pools.md, Surface finds).'), ...textSection(3, 'How the trip went', bm('resolveEvaOutcome'), 'Dangers and results by planet type, deaths, injuries and rewards.'));
    b.push(...textSection(3, 'Paradise found', bm('showEdenEvaModal'), 'A team trip to an EDEN world: sectors 3, 4 and 6 (sector 6 always has one).'));
    b.push('## Boarding a station', '', ...textSection(3, 'Docking (the mini-game)', whole('src/systems/DockingGame.js'), ''));
    b.push(...textSection(3, 'Inside', whole('src/systems/BoardingParty.js'), 'Rooms, crew perks, results. The diary on the crew deck depends on the station\'s age: the first list is for sectors 1-3, then 4, 5 and 6.'));
    write('10-away-team.md', 'Orbit, scans and away teams — any sector', b);
}

// anywhere: cargo, fabricator and map names
{
    const STORY_ITEMS = ['BRIEFING_TAPE', 'DISC_DRAWING', 'TECH_FRAGMENT'];
    const b = [HOW, '', 'Names and descriptions: things in the cargo hold, parts in the fabricator, and what the sector map says about each place.', ''];
    b.push(...textSection(2, 'The cargo hold', whole('src/data/Items.js', 'ITEMS'), `Every item: its name, its description, and what using it says. The tape, the disc drawing and the data chip are with their story (sector-2.md, sector-1.md, 09-ship-and-crew.md).`, t => !STORY_ITEMS.includes(t.path[0])));
    b.push(...textSection(3, 'Reading a found page again', bm('pageItem'), ''));
    b.push(...textSection(2, 'The fabricator', whole('src/data/Upgrades.js', 'UPGRADES'), 'Each part: name, description, what it changes, where it shows on the ship.'));
    b.push(...textSection(2, 'Planets on the map', block('src/generators/PlanetGenerator.js', /const PLANET_DATA = \{/, 'PLANET_DATA'), 'The description of each kind of world.'));
    b.push(...textSection(2, 'Stations on the map', method('src/generators/PlanetGenerator.js', 'generateStation'), ''));
    b.push(...textSection(2, 'Asteroid fields on the map', block('src/data/AsteroidFields.js', /const ASTEROID_FIELD_NAMES/, 'ASTEROID_FIELD_NAMES'), ''), ...bulletsOf(block('src/data/AsteroidFields.js', /^function generateAsteroidField/m, 'generateAsteroidField')), '');
    write('11-cargo-and-map.md', 'Cargo, fabricator and map names — any sector', b);
}

// the index
const index = [HOW, '', 'Read in this order:', '', ...files.map(([name, title]) => `- [${title}](${name})`), '',
    'The story these files tell is in [../CANON.md](../CANON.md). How lines should sound is in [../STYLE.md](../STYLE.md).'];
fs.writeFileSync(path.join(OUT, 'README.md'), `# The script\n\n${index.join('\n')}\n`);
console.log(`wrote ${files.length + 1} files to ${path.relative(ROOT, OUT)}`);
