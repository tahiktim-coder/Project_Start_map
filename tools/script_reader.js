/* script_reader.js — the export's small JS reader (tools/export_script.js): it walks a stretch of source, keeps every string
   a player could see, notes the object key it sits under, fills ${…} with [placeholders] (or [a | b] when the choice is
   between two pieces of text), and splits HTML into its visible pieces. Moved out of export_script.js unchanged (look pass B02:
   that file was over 800 lines). */
'use strict';
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
const PLACEHOLDERS = [[/=== 1 \?/, 's'], [/wrongNames|deadNames|names\.join/, 'their names'], [/commander\./, "commander's surname"], [/\bsite\./, 'site'], [/shipDecks|deck|\.label\b/i, 'deck'], [/\.type\b/, 'type'],
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
const NAMES = new Set(['Cora', 'Jaxon', 'Aris', 'Vance', 'Mira', 'A.U.R.A.']);   // the crew by first name only (docs/GAME_FLOW.md 2.0)
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
const SILENT_CALLS = /^(setAttribute|querySelector|querySelectorAll|getElementById|closest|matches|addEventListener|removeEventListener|dispatchEvent|CustomEvent|Event|createElement|getItem|setItem|removeItem|toggle|contains|includes|startsWith|endsWith|indexOf|split|join|replace|test|tryBark|tryComment|toLocaleString|toLocaleDateString|adjustEthics|noteStanding|hasStanding|console)$/;   // their strings are never shown (console: console.error and the rest, the developer's own messages)
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
            const named = fromKey ? top().key : ch === '(' && /\bconsole\.\w+\s*$/.test(before) ? 'console' : ((/([A-Za-z_$][\w$]*)\s*=\s*$/.exec(before) || /([A-Za-z_$][\w$]*)\s*$/.exec(before) || [])[1] || null);
            frames.push({ name: named, fromKey: fromKey && named != null, open: ch, other: 0, key: null });
            i++; prevSig = ch; prevWord = ''; continue;
        }
        if ('}])'.includes(ch)) { if (frames.length > 1) frames.pop(); top().other++; i++; prevSig = ch; prevWord = ''; continue; }
        if (ch === ',') top().key = null; else if (ch !== ';') top().other++;
        prevSig = ch; prevWord = ''; i++;
    }
    return out.sort((a, b) => a.at - b.at);
}
const scanText = src => scanRaw(src).filter(t => !/^(id|art|tone|color|icon|portraitId|reason|seenKey)$/.test(t.key || '')).map(t => t.text).filter(t => isText(t) && !NAMES.has(t)).map(printed);

module.exports = { placeholderFor, NAMES, isText, printed, scanRaw, scanText };
