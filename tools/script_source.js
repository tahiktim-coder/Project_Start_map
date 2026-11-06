/* script_source.js — pieces of source for tools/export_script.js: a method, a declaration, or the lines between two markers,
   each { rel, src, line, id }, and the line ranges inside them. Moved out of export_script.js unchanged (look pass merge).
   usage:  const { block, method, between, … } = require('./script_source.js')(read);   read(rel) → that file's text */
'use strict';
const path = require('path');

module.exports = function makeSource(read) {
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
    return { lineAt, methodRe, block, method, between, whole, fnPiece, span, inside, outside, lightRanges };
};
