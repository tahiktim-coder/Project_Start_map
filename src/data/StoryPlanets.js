// STORY_PLANETS: one hand-made planet per sector. One of our ships lies on it, with that sector's found page (EXODUS_LOGS).
// PlanetGenerator makes it first, at its fixed place on the map, and spaces the random planets round it. It starts as a faint
// contact with no name that cannot be warped to. Dating another of our wrecks with the disc (DiscDating) shows where that crew
// was going: here. Then it is named and can be reached. If nobody dates a wreck, A.U.R.A. names it when one stop is left.
//   sector   1..6                    name, type   as the map shows them (type: one of PlanetGenerator's PLANET_TYPES)
//   desc     one plain line on the map panel      page   the EXODUS_LOGS id found in its wreck
//   hull     the wreck's hull number, inside docs/CANON.md §2's range for the sector (never 9: that is us)
//   at       its place on the map, in percent; the same spot the disc's sector map puts it (DiscDating PLACES)
//   reward   what the disc shows: kind 'beacon' (a moon with a lamp), 'graves', or 'light' (the end of the heading);
//            label: the name on the disc's map, if not the planet's; line: said once the course is set
//            (who: Aris, Mira, Vance, Jaxon or A.U.R.A.; the dead say nothing)

const STORY_PLANET_SPOTS = { beacon: { x: 62, y: 20 }, graves: { x: 76, y: 25 }, nearLight: { x: 66, y: 34 } };

const STORY_PLANETS = [
    {
        sector: 1, name: 'Rhea-4 Minor', type: 'ROCKY', page: 'PAGE_PLATE', hull: 6, at: STORY_PLANET_SPOTS.beacon,
        desc: 'A small grey moon. One of our ships came down on it. Its emergency lamp still flashes.',
        reward: { kind: 'beacon', line: { who: 'Mira', text: 'They saw a lamp on that moon and went to help. They never got there.' } },
    },
    {
        sector: 2, name: 'Dione-2 Prime', type: 'ROGUE', page: 'PAGE_VAULT', hull: 8, at: STORY_PLANET_SPOTS.graves,
        desc: 'A cold world with no sun. Rows of graves, and one of our ships beside them.',
        reward: { kind: 'graves', line: { who: 'Aris', text: 'Someone was left alive to bury them.' } },
    },
    {
        sector: 3, name: 'Mimas-31 X', type: 'ICE_WORLD', page: 'PAGE_THROW', hull: 640, at: STORY_PLANET_SPOTS.beacon,
        desc: 'An ice moon. One of our ships landed here a hundred years ago.',
        reward: { kind: 'beacon', line: { who: 'Vance', text: "They were heading for that moon. Let's find out what they knew." } },
    },
    {
        sector: 4, name: 'Pallas-17 Major', type: 'ROCKY', page: 'PAGE_MEMO', hull: 2210, at: STORY_PLANET_SPOTS.graves,
        desc: 'A quiet grey world. A ship landed here and its crew never left.',
        reward: { kind: 'graves', line: { who: 'Jaxon', text: "They landed there and stayed. I can't say I blame them." } },
    },
    {
        sector: 5, name: 'Iapetus-60 Minor', type: 'CRYSTALLINE', page: 'PAGE_LEDGER', hull: 17207, at: STORY_PLANET_SPOTS.beacon,
        desc: 'A dark moon. Someone built a shelter here from the hull of one of our ships.',
        reward: { kind: 'beacon', line: { who: 'Mira', text: 'That lamp was set up by hand. Someone lived on that moon.' } },
    },
    {
        sector: 6, name: 'Tethys-1 Prime', type: 'ICE_WORLD', page: 'PAGE_LIGHT', hull: 40963, at: STORY_PLANET_SPOTS.nearLight,
        desc: "A cold world a day's flight from the light. One of our ships stopped here.",
        reward: { kind: 'light', label: 'The light', line: { who: 'Aris', text: 'One ship stopped a day short of it. I want to read its log.' } },
    },
];

if (typeof window !== 'undefined') window.STORY_PLANETS = STORY_PLANETS;
