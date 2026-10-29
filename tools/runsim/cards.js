/* tools/runsim/cards.js — which kind of card is up (tools/runsim/hands.js picks by kind).
   The jump's cards are known by the function that opened them, never by their words (the designer edits the words):
   watch.js wraps App.askBeforeJump, offerReserveJump, showShipMalfunctionModal and handleWrongPlaceEscape, and sets
   cur.opening while each opens its card. A card that reads like a jump card but came from none of them is a rule error.
   cardKind(cfg, cur, onError) → 'askJump' | 'reserve' | 'alert' | 'escape' | 'moment' | 'call' | 'station' | 'mine' | 'page' | 'campfire' | 'wreck' | 'site' | 'strange' | 'other'
*/
'use strict';

/** The functions that open the jump's cards, and the kind each one's card is. */
const OPENERS = Object.freeze({ askBeforeJump: 'askJump', offerReserveJump: 'reserve', showShipMalfunctionModal: 'alert', handleWrongPlaceEscape: 'escape' });

function cardKind(cfg, cur, onError) {
    if (cur.opening) return cur.opening;
    const k = String(cfg.kicker || ''), t = String(cfg.title || ''), art = String(cfg.art || '');
    if (k === 'SECTOR JUMP' || /energy to jump/i.test(t)) {
        if (onError) onError(new Error(`a jump card opened outside the jump's own functions: "${t}"`), 'cardKind');
        return k === 'SECTOR JUMP' ? 'askJump' : 'reserve';
    }
    if (k === 'SHIP ALERT') return 'alert';
    if (cfg.tone === 'crew') return 'moment';
    if (cfg.tone === 'distress') return 'call';
    if (k === 'INSIDE THE STATION') return 'station';
    if (cfg.tone === 'rock') return 'mine';
    if (/^FOUND IN/.test(k)) return 'page';
    if (cur.campfire) return 'campfire';
    if (art.startsWith('EXODUS_WRECK')) return 'wreck';
    if (['FAILED_COLONY', 'DERELICT', 'LIGHTHOUSE', 'GARDEN', 'GRAVE'].includes(art)) return 'site';
    if (cur.strange) return 'strange';
    return 'other';
}

/** Wraps the app's card openers so that their cards are known by who opened them. */
function watchOpeners(app, cur) {
    Object.entries(OPENERS).forEach(([name, kind]) => {
        const real = app[name];
        if (typeof real !== 'function') throw new Error(`runsim: App.${name} is gone; tools/runsim/cards.js needs updating`);
        app[name] = function (...a) {
            const was = cur.opening;
            cur.opening = kind;
            try { return real.apply(this, a); } finally { cur.opening = was; }
        };
    });
}

module.exports = { cardKind, watchOpeners };
