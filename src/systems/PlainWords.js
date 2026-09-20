/**
 * PlainWords — status ids stay as they are in the logic (HEALTHY, CATATONIC, SEDATED…);
 * this is the only place that decides how the player reads them.
 */
(function () {
    'use strict';

    const STATUS_WORDS = { HEALTHY: 'fine', INJURED: 'hurt', CATATONIC: 'not responding', DEAD: 'dead' };
    const TAG_WORDS = { SEDATED: 'kept asleep', CONFINED: 'locked in quarters' };

    /** How a crew member is doing, in a word or two. Being held (asleep / locked up) wins over health. */
    function status(member) {
        if (!member) return '';
        if (member.status === 'DEAD') return STATUS_WORDS.DEAD;
        const heldTag = Object.keys(TAG_WORDS).find(tag => (member.tags || []).includes(tag));
        return heldTag ? TAG_WORDS[heldTag] : (STATUS_WORDS[member.status] || String(member.status || '').toLowerCase());
    }

    window.PlainWords = { status, STATUS_WORDS, TAG_WORDS };
})();
