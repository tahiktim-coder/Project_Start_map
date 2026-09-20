/* BodyRenderer — seeded phosphor SVG celestial bodies.
   Vanilla-JS port of the design handoff's psm/bodies.jsx.
   Doctrine: UI chrome stays monochrome phosphor; only the imagery carries hue.
   The game's 30 planet types map onto 8 visual families, each with its own palette.
   STRUCTURE / WRONG_PLACE are NOT rendered here — they keep their bespoke CSS art. */

(function () {
    'use strict';

    function hexA(hex, a) {
        const h = hex.replace('#', '');
        const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
        return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }
    function RNG(seed) {
        let s = ((seed || 1) * 2654435761 + 7) >>> 0;
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }
    function blob(cx, cy, rad, rng) {
        const n = 7, pts = [];
        for (let i = 0; i < n; i++) {
            const a = i / n * 2 * Math.PI, rr = rad * (0.62 + rng() * 0.5);
            pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
        }
        let d = `M ${((pts[0][0] + pts[n - 1][0]) / 2).toFixed(1)} ${((pts[0][1] + pts[n - 1][1]) / 2).toFixed(1)} `;
        for (let i = 0; i < n; i++) {
            const p = pts[i], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
            d += `Q ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)} `;
        }
        return d + 'Z';
    }
    function rxVals(phase, R, N) {
        const a = [];
        for (let s = 0; s <= N; s++) { const ang = 2 * Math.PI * (s / N + phase); a.push((Math.abs(Math.cos(ang)) * R).toFixed(2)); }
        return a.join(';');
    }
    function opVals(phase, base, N) {
        const a = [];
        for (let s = 0; s <= N; s++) { const ang = 2 * Math.PI * (s / N + phase); a.push((base * (0.18 + 0.82 * Math.abs(Math.cos(ang)))).toFixed(3)); }
        return a.join(';');
    }

    // Deterministic integer seed from a planet id string
    function seedFromId(id) {
        let h = 7;
        const s = String(id || 'x');
        for (let i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0;
        return (h % 100000) + 1;
    }

    // ── 8 family palettes (col=wire, br=highlight, c0=lit, c1=mid, c2=shadow) ──
    const FAMILY_CFG = {
        VERDANT: { col: '#8fe6ab', br: '#d6ffe4', c0: '#74c98f', c1: '#357d54', c2: '#0c2c1d', land: '#3f7d3a', mer: 5, ring: 0, moons: 1 },
        ICE:     { col: '#9fe4f2', br: '#eafdff', c0: '#aee6f0', c1: '#5b9fb8', c2: '#123845', mer: 5, ring: 0, moons: 0 },
        ROCK:    { col: '#cabfa8', br: '#efe8d6', c0: '#b3a886', c1: '#6f6650', c2: '#241f17', mer: 4, ring: 0, moons: 1 },
        DESERT:  { col: '#f0b465', br: '#ffe6ad', c0: '#dd9f46', c1: '#9c6325', c2: '#311c0b', mer: 5, ring: 0, moons: 0 },
        LAVA:    { col: '#ff9a5a', br: '#ffe0b0', c0: '#6b2418', c1: '#3d130c', c2: '#180605', ember: '#ff7038', mer: 5, ring: 0, moons: 0 },
        OCEAN:   { col: '#7fbcf5', br: '#dcefff', c0: '#5a9fe8', c1: '#2f5fa8', c2: '#0b1d3a', land: '#c2a25f', mer: 5, ring: 0, moons: 1 },
        GAS:     { col: '#d4b0f5', br: '#f0dcff', c0: '#bf9be8', c1: '#8a5fbd', c2: '#2c1a44', band: '#e8c08a', storm: '#e0884a', mer: 0, ring: 1, moons: 2 },
        TOXIC:   { col: '#d6f08a', br: '#f3ffb6', c0: '#bcd96a', c1: '#7a9636', c2: '#222f10', mer: 5, ring: 0, moons: 0 },
    };

    // ── game-type → family + palette overrides ──
    const GAME_TYPES = {
        VITAL:          { fam: 'VERDANT' },
        EDEN:           { fam: 'VERDANT', cfg: { col: '#a8f0ba', br: '#e8ffe9', c0: '#8fdca0', c1: '#3f9660', c2: '#0d3320', land: '#4f9c46', moons: 2 } },
        SYMBIOTE_WORLD: { fam: 'VERDANT', cfg: { col: '#7fe8c0', br: '#defff0', c0: '#5fd0a8', c1: '#2a7a5e', c2: '#082a20', land: '#2f8a6a' } },
        FUNGAL:         { fam: 'VERDANT', cfg: { col: '#a8d998', br: '#eaffd8', c0: '#8cc47a', c1: '#587a3f', c2: '#1a2a10', land: '#7a5f9e' } },
        TERRAFORMED:    { fam: 'VERDANT', cfg: { col: '#7fe0d0', br: '#dcfff8', c0: '#66c9b8', c1: '#2f7d70', c2: '#0b2c28', land: '#3f7d5a' } },

        OCEANIC:        { fam: 'OCEAN' },
        SINGING:        { fam: 'OCEAN', cfg: { col: '#96a8f0', br: '#e0e6ff', c0: '#7a8fe0', c1: '#4152a0', c2: '#101838', land: '#8a9ac2' } },

        ICE_WORLD:      { fam: 'ICE' },
        FROZEN_OCEAN:   { fam: 'ICE', cfg: { col: '#a8d4f5', br: '#eaf6ff', c0: '#9cc6ea', c1: '#4a7cb0', c2: '#0e2a42' } },
        CRYSTALLINE:    { fam: 'ICE', cfg: { col: '#d8f6ff', br: '#ffffff', c0: '#c8ecf5', c1: '#7ab0c2', c2: '#1c4652', mer: 6 } },
        MIRROR:         { fam: 'ICE', cfg: { col: '#e0e0e0', br: '#ffffff', c0: '#d0d0d0', c1: '#8a8a8a', c2: '#2a2a2a' } },

        ROCKY:          { fam: 'ROCK' },
        CARBON:         { fam: 'ROCK', cfg: { col: '#9a9a9a', br: '#d6d6d6', c0: '#5a5a5a', c1: '#2e2e2e', c2: '#0c0c0c' } },
        TOMB_WORLD:     { fam: 'ROCK', cfg: { col: '#b09878', br: '#e0d0b8', c0: '#8a7458', c1: '#4e3f2e', c2: '#161008' } },
        GRAVEYARD:      { fam: 'ROCK', cfg: { col: '#a8a8a8', br: '#d8d8d8', c0: '#787878', c1: '#464646', c2: '#141414' } },
        MECHA:          { fam: 'ROCK', cfg: { col: '#c0ccd0', br: '#eef6f8', c0: '#93a3aa', c1: '#54646c', c2: '#141c20' } },
        MACHINE_WORLD:  { fam: 'ROCK', cfg: { col: '#9ab4c4', br: '#d8ecf5', c0: '#7292a6', c1: '#3c5666', c2: '#0e1a22' } },
        ROGUE:          { fam: 'ROCK', cfg: { col: '#8a7ab8', br: '#c8b8f0', c0: '#4a3f70', c1: '#241c40', c2: '#080614' } },

        DESERT:         { fam: 'DESERT' },
        SULFUR:         { fam: 'DESERT', cfg: { col: '#e6dc5a', br: '#fff8ac', c0: '#c8bc3e', c1: '#84781e', c2: '#28230a' } },

        VOLCANIC:       { fam: 'LAVA' },
        SHATTERED:      { fam: 'LAVA', cfg: { col: '#ff7a5a', br: '#ffd0b0', c0: '#5c1c12', c1: '#33100a', c2: '#140504', ember: '#ff5030' } },
        TIDALLY_LOCKED: { fam: 'LAVA', cfg: { col: '#ff9a5a', br: '#ffe0b0', c0: '#7a3418', c1: '#40200c', c2: '#180a05', ember: '#ff8838' } },
        HOLLOW:         { fam: 'LAVA', cfg: { col: '#ffcc70', br: '#ffeebb', c0: '#6b4a18', c1: '#3d290c', c2: '#180f05', ember: '#ffc040' } },

        GAS_GIANT:      { fam: 'GAS' },
        STORM_WORLD:    { fam: 'GAS', cfg: { col: '#8ba8c4', br: '#d4e6f5', c0: '#7492ae', c1: '#41586e', c2: '#101c28', band: '#a8bcd0', storm: '#e0e8f0', ring: 0, moons: 1 } },

        TOXIC:          { fam: 'TOXIC' },
        BIO_MASS:       { fam: 'TOXIC', cfg: { col: '#e88ad0', br: '#ffd0f0', c0: '#c46aae', c1: '#7a3a6a', c2: '#280f22' } },
        RADIATION_BELT: { fam: 'TOXIC', cfg: { col: '#8af08a', br: '#d0ffd0', c0: '#66d066', c1: '#2f7a2f', c2: '#0c260c' } },
        GHOST_WORLD:    { fam: 'TOXIC', cfg: { col: '#b0b0d8', br: '#e6e6ff', c0: '#9a9ac4', c1: '#5a5a86', c2: '#16162a' } },
    };

    function resolveCfg(gameType) {
        const entry = GAME_TYPES[gameType] || { fam: 'ROCK' };
        const base = FAMILY_CFG[entry.fam] || FAMILY_CFG.ROCK;
        return { fam: entry.fam, cfg: Object.assign({}, base, entry.cfg || {}) };
    }

    // ── per-family surface features (returned as an SVG string, drawn clipped inside the disc) ──
    function surfaceFeatures(fam, cfg, R, cx, cy, rng) {
        const A = hexA;
        let out = '';
        if (fam === 'GAS') {
            const bands = 9;
            for (let i = 0; i < bands; i++) {
                const y = cy - R + (i / bands) * 2 * R, h = (2 * R) / bands + 0.6;
                out += `<rect x="${cx - R}" y="${y.toFixed(1)}" width="${2 * R}" height="${h.toFixed(1)}" fill="${A(i % 2 ? cfg.c1 : cfg.band, i % 2 ? 0.5 : 0.32)}"/>`;
            }
            for (let i = 0; i < 5; i++) {
                const yy = cy - R * 0.78 + i * R * 0.4;
                out += `<path d="M ${cx - R} ${yy.toFixed(1)} Q ${(cx - R * 0.3).toFixed(1)} ${(yy - R * 0.05).toFixed(1)} ${(cx + R * 0.2).toFixed(1)} ${yy.toFixed(1)} T ${cx + R} ${yy.toFixed(1)}" fill="none" stroke="${A(cfg.br, 0.26)}" stroke-width="1"/>`;
            }
            out += `<ellipse cx="${(cx + R * 0.32).toFixed(1)}" cy="${(cy + R * 0.26).toFixed(1)}" rx="${(R * 0.27).toFixed(1)}" ry="${(R * 0.15).toFixed(1)}" fill="${A(cfg.storm, 0.7)}" stroke="${A('#ffd6a8', 0.7)}" stroke-width="1"/>`;
            out += `<ellipse cx="${(cx + R * 0.32).toFixed(1)}" cy="${(cy + R * 0.26).toFixed(1)}" rx="${(R * 0.15).toFixed(1)}" ry="${(R * 0.08).toFixed(1)}" fill="none" stroke="${A('#fff0d8', 0.6)}" stroke-width="0.8"/>`;
        } else if (fam === 'LAVA') {
            for (let i = 0; i < 7; i++) {
                const a = rng() * Math.PI * 2;
                let x = cx + Math.cos(a) * R * 0.08, y = cy + Math.sin(a) * R * 0.08, ca = a, d = `M ${x.toFixed(1)} ${y.toFixed(1)} `;
                for (let s = 0; s < 4; s++) {
                    ca += (rng() - 0.5) * 1.3;
                    const len = R * (0.16 + rng() * 0.12);
                    x += Math.cos(ca) * len; y += Math.sin(ca) * len;
                    d += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
                }
                out += `<path d="${d}" fill="none" stroke="${cfg.ember}" stroke-width="${Math.max(0.8, R * 0.022).toFixed(2)}" opacity="0.92" style="filter:drop-shadow(0 0 ${(R * 0.05).toFixed(1)}px ${cfg.br})"/>`;
            }
            for (let i = 0; i < 5; i++) {
                const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * R * 0.7;
                out += `<circle cx="${(cx + Math.cos(a) * rr).toFixed(1)}" cy="${(cy + Math.sin(a) * rr).toFixed(1)}" r="${Math.max(1, R * 0.03).toFixed(2)}" fill="${cfg.br}" opacity="0.9" style="filter:drop-shadow(0 0 3px ${cfg.br})"/>`;
            }
        } else if (fam === 'OCEAN' || fam === 'VERDANT') {
            for (let i = 0; i < 3; i++) {
                const a = rng() * Math.PI * 2, rr = R * (0.15 + rng() * 0.4);
                out += `<path d="${blob(cx + Math.cos(a) * rr * 0.72, cy + Math.sin(a) * rr * 0.66, R * (0.2 + rng() * 0.16), rng)}" fill="${A(cfg.land, 0.72)}" stroke="${A(cfg.land, 0.95)}" stroke-width="0.6"/>`;
            }
            for (let i = 0; i < 2; i++) {
                const yy = cy - R * 0.35 + i * R * 0.55;
                out += `<path d="M ${(cx - R * 0.7).toFixed(1)} ${yy.toFixed(1)} Q ${cx} ${(yy - R * 0.16).toFixed(1)} ${(cx + R * 0.7).toFixed(1)} ${yy.toFixed(1)}" fill="none" stroke="${A('#ffffff', 0.26)}" stroke-width="${Math.max(1, R * 0.05).toFixed(1)}" stroke-linecap="round"/>`;
            }
        } else if (fam === 'DESERT') {
            for (let i = 0; i < 7; i++) {
                const yy = cy - R * 0.85 + i * R * 0.28;
                out += `<path d="M ${cx - R} ${yy.toFixed(1)} Q ${(cx - R * 0.35).toFixed(1)} ${(yy - R * 0.07).toFixed(1)} ${(cx + R * 0.2).toFixed(1)} ${yy.toFixed(1)} T ${cx + R} ${yy.toFixed(1)}" fill="none" stroke="${A(cfg.c1, 0.5)}" stroke-width="1.1"/>`;
            }
        } else if (fam === 'ROCK') {
            for (let i = 0; i < 8; i++) {
                const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * R * 0.76;
                const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.94, cr = R * (0.06 + rng() * 0.11);
                out += `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${cr.toFixed(1)}" fill="none" stroke="${A(cfg.c2, 0.75)}" stroke-width="1"/>`
                    + `<ellipse cx="${(x - cr * 0.22).toFixed(1)}" cy="${(y - cr * 0.22).toFixed(1)}" rx="${(cr * 0.62).toFixed(1)}" ry="${(cr * 0.5).toFixed(1)}" fill="${A(cfg.br, 0.14)}"/></g>`;
            }
        } else if (fam === 'ICE') {
            for (let i = 0; i < 6; i++) {
                const a = rng() * Math.PI * 2;
                let x = cx, y = cy, ca = a, d = `M ${cx} ${cy} `;
                for (let s = 0; s < 3; s++) {
                    ca += (rng() - 0.5) * 0.9;
                    const len = R * 0.3;
                    x += Math.cos(ca) * len; y += Math.sin(ca) * len;
                    d += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
                }
                out += `<path d="${d}" fill="none" stroke="${A('#ffffff', 0.4)}" stroke-width="0.8"/>`;
            }
        } else if (fam === 'TOXIC') {
            for (let i = 0; i < 4; i++) {
                const yy = cy - R * 0.5 + i * R * 0.34;
                out += `<path d="M ${(cx - R * 0.82).toFixed(1)} ${yy.toFixed(1)} Q ${(cx - R * 0.2).toFixed(1)} ${(yy - R * 0.2).toFixed(1)} ${(cx + R * 0.3).toFixed(1)} ${yy.toFixed(1)} T ${(cx + R * 0.85).toFixed(1)} ${(yy - R * 0.05).toFixed(1)}" fill="none" stroke="${A(cfg.br, 0.32)}" stroke-width="${Math.max(1, R * 0.06).toFixed(1)}" stroke-linecap="round"/>`;
            }
        }
        return out;
    }

    // ── the globe ──
    function globe(opts) {
        const type = opts.type || 'ROCKY';
        const size = opts.size || 120;
        const seed = opts.seed || 1;
        const sel = !!opts.sel;
        const scanning = !!opts.scanning;
        const dur = opts.dur || (size > 200 ? 16 : size > 80 ? 11 : 15);

        const { fam, cfg } = resolveCfg(type);
        const R = size / 2, PAD = R * 0.46, cx = R + PAD, cy = R + PAD, full = size + PAD * 2, N = 24;
        const br = cfg.br, small = size < 60;
        const merCount = small ? Math.min(3, cfg.mer) : cfg.mer;
        const uid = 'bg' + seed + 'x' + size;
        const seedBase = Math.floor(seed * 131 + type.length * 977 + size);
        const rng = RNG(seedBase);

        const caps = (fam === 'ICE' || fam === 'OCEAN');
        const feats = surfaceFeatures(fam, cfg, R, cx, cy, rng);
        const moons = [];
        const nMoon = small ? Math.min(cfg.moons, 1) : cfg.moons;
        for (let i = 0; i < nMoon; i++) {
            moons.push({
                orb: R + PAD * (0.5 + i * 0.34), a0: rng() * 360,
                dur: (small ? 22 : 36) + i * 12 + rng() * 8,
                mr: Math.max(1.6, R * (0.075 - i * 0.012)), tilt: 12 + rng() * 20,
            });
        }

        let s = `<svg width="${full}" height="${full}" style="overflow:visible;display:block;filter:drop-shadow(0 0 ${small ? 6 : 16}px ${hexA(cfg.col, sel ? 0.5 : 0.32)})">`;
        s += `<defs>`
            + `<clipPath id="${uid}c"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>`
            + `<radialGradient id="${uid}surf" cx="35%" cy="30%" r="82%">`
            + `<stop offset="0%" stop-color="${cfg.br}"/><stop offset="30%" stop-color="${cfg.c0}"/>`
            + `<stop offset="66%" stop-color="${cfg.c1}"/><stop offset="100%" stop-color="${cfg.c2}"/>`
            + `</radialGradient>`
            + `<radialGradient id="${uid}atm" cx="50%" cy="50%" r="50%">`
            + `<stop offset="78%" stop-color="rgba(0,0,0,0)"/><stop offset="92%" stop-color="${hexA(br, 0.32)}"/><stop offset="100%" stop-color="rgba(0,0,0,0)"/>`
            + `</radialGradient>`
            + `<radialGradient id="${uid}shade" cx="36%" cy="30%" r="78%">`
            + `<stop offset="52%" stop-color="rgba(0,0,0,0)"/><stop offset="100%" stop-color="rgba(2,4,6,0.6)"/>`
            + `</radialGradient>`
            + `<radialGradient id="${uid}spec" cx="33%" cy="26%" r="26%">`
            + `<stop offset="0%" stop-color="${hexA('#ffffff', 0.55)}"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/>`
            + `</radialGradient>`
            + `<pattern id="${uid}scan" width="4" height="3" patternUnits="userSpaceOnUse">`
            + `<rect width="4" height="3" fill="rgba(0,0,0,0)"/><rect width="4" height="1" y="2" fill="rgba(0,0,0,0.38)"/>`
            + `</pattern>`
            + `<clipPath id="${uid}rb"><rect x="${cx - R * 2}" y="${cy - R * 2}" width="${R * 4}" height="${R * 2}"/></clipPath>`
            + `<clipPath id="${uid}rf"><rect x="${cx - R * 2}" y="${cy}" width="${R * 4}" height="${R * 2}"/></clipPath>`
            + `</defs>`;

        if (fam !== 'ROCK' && fam !== 'LAVA') s += `<circle cx="${cx}" cy="${cy}" r="${R * 1.15}" fill="url(#${uid}atm)"/>`;
        if (fam === 'LAVA') s += `<circle cx="${cx}" cy="${cy}" r="${R * 1.18}" fill="none" stroke="${hexA(cfg.ember, 0.22)}" stroke-width="${R * 0.12}" style="filter:blur(${(R * 0.06).toFixed(1)}px)"/>`;

        // rings — back half
        if (cfg.ring) {
            s += `<g clip-path="url(#${uid}rb)">`
                + `<ellipse cx="${cx}" cy="${cy}" rx="${R * 1.72}" ry="${R * 0.5}" fill="none" stroke="${hexA(br, 0.42)}" stroke-width="${R * 0.17}" transform="rotate(-17 ${cx} ${cy})"/>`
                + `<ellipse cx="${cx}" cy="${cy}" rx="${R * 1.46}" ry="${R * 0.42}" fill="none" stroke="${hexA(cfg.col, 0.34)}" stroke-width="${R * 0.05}" transform="rotate(-17 ${cx} ${cy})"/>`
                + `</g>`;
        }

        // body
        s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${uid}surf)"/>`;
        s += `<g clip-path="url(#${uid}c)">` + feats;
        if (caps) {
            [-1, 1].forEach(d => {
                s += `<ellipse cx="${cx}" cy="${cy - d * R * 0.76}" rx="${R * 0.52}" ry="${R * 0.17}" fill="${hexA('#ffffff', 0.55)}" stroke="${br}" stroke-width="1" opacity="0.82"/>`;
            });
        }
        s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${uid}shade)"/>`;
        for (let i = 0; i < merCount; i++) {
            const phase = i / Math.max(1, merCount);
            s += `<ellipse cx="${cx}" cy="${cy}" rx="${R}" ry="${R}" fill="none" stroke="${hexA(br, 0.5)}" stroke-width="1">`
                + `<animate attributeName="rx" dur="${dur}s" repeatCount="indefinite" values="${rxVals(phase, R, N)}"/>`
                + `<animate attributeName="opacity" dur="${dur}s" repeatCount="indefinite" values="${opVals(phase, 0.45, N)}"/>`
                + `</ellipse>`;
        }
        s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${uid}spec)"/>`;
        s += `<rect x="${cx - R}" y="${cy - R}" width="${R * 2}" height="${R * 2}" fill="url(#${uid}scan)" opacity="0.45"/>`;
        s += `<rect x="${cx - R}" width="${R * 2}" height="${small ? 1.5 : 2.8}" y="${cy - R}" fill="${br}" opacity="0" style="filter:drop-shadow(0 0 5px ${br})">`
            + `<animate attributeName="y" values="${cy - R};${cy + R}" dur="${scanning ? '1.1s' : '5.5s'}" repeatCount="indefinite"/>`
            + `<animate attributeName="opacity" values="${scanning ? '0;1;0' : '0;0.4;0'}" dur="${scanning ? '1.1s' : '5.5s'}" repeatCount="indefinite"/>`
            + `</rect>`;
        s += `</g>`;

        s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${hexA(br, 0.9)}" stroke-width="${small ? 1 : 1.4}"/>`;

        // rings — front half
        if (cfg.ring) {
            s += `<g clip-path="url(#${uid}rf)">`
                + `<ellipse cx="${cx}" cy="${cy}" rx="${R * 1.72}" ry="${R * 0.5}" fill="none" stroke="${hexA(br, 0.62)}" stroke-width="${R * 0.17}" transform="rotate(-17 ${cx} ${cy})"/>`
                + `<ellipse cx="${cx}" cy="${cy}" rx="${R * 1.46}" ry="${R * 0.42}" fill="none" stroke="${hexA(cfg.col, 0.5)}" stroke-width="${R * 0.05}" transform="rotate(-17 ${cx} ${cy})"/>`
                + `</g>`;
        }

        // moons
        moons.forEach(m => {
            s += `<g transform="rotate(${m.tilt.toFixed(1)} ${cx} ${cy})">`
                + `<g><animateTransform attributeName="transform" type="rotate" from="${m.a0.toFixed(1)} ${cx} ${cy}" to="${(m.a0 + 360).toFixed(1)} ${cx} ${cy}" dur="${m.dur.toFixed(1)}s" repeatCount="indefinite"/>`
                + `<circle cx="${cx + m.orb}" cy="${cy}" r="${m.mr.toFixed(2)}" fill="${hexA(br, 0.85)}" stroke="${cfg.col}" stroke-width="0.6" style="filter:drop-shadow(0 0 3px ${hexA(cfg.col, 0.6)})"/>`
                + `</g></g>`;
        });

        if (sel) {
            s += `<circle cx="${cx}" cy="${cy}" r="${R + PAD * 0.5}" fill="none" stroke="#d9a24a" stroke-width="1" stroke-dasharray="4 5">`
                + `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="14s" repeatCount="indefinite"/>`
                + `</circle>`;
            [0, 90, 180, 270].forEach(a => {
                const rad = a * Math.PI / 180, r0 = R + PAD * 0.28, r1 = R + PAD * 0.66;
                s += `<line x1="${(cx + Math.cos(rad) * r0).toFixed(1)}" y1="${(cy + Math.sin(rad) * r0).toFixed(1)}" x2="${(cx + Math.cos(rad) * r1).toFixed(1)}" y2="${(cy + Math.sin(rad) * r1).toFixed(1)}" stroke="#d9a24a" stroke-width="1.2"/>`;
            });
        }

        return s + `</svg>`;
    }

    // ── ring habitat station ──
    const ST_COL = '#cfd8cf', ST_BR = '#f0f5f0', ST_DK = '#7f8a82';
    function station(opts) {
        const size = opts.size || 120, sel = !!opts.sel, seed = opts.seed || 1;
        const R = size / 2, PAD = R * 0.3, cx = R + PAD, cy = R + PAD, full = size + PAD * 2;
        const rx = R * 0.82, ry = R * 0.3, tilt = -16, small = size < 70;
        const uid = 'st' + seed + 'x' + size;
        const nm = small ? 6 : 10;
        const path = `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
        const spin = small ? 26 : 40;
        const spokes = [[0, -ry], [0, ry], [-rx, 0], [rx, 0]];

        let s = `<svg width="${full}" height="${full}" style="overflow:visible;display:block;filter:drop-shadow(0 0 12px ${hexA(ST_COL, 0.25)})">`;
        s += `<defs><linearGradient id="${uid}m" x1="0" y1="0" x2="1" y2="1">`
            + `<stop offset="0%" stop-color="${ST_BR}"/><stop offset="50%" stop-color="${ST_COL}"/><stop offset="100%" stop-color="${ST_DK}"/>`
            + `</linearGradient><path id="${uid}p" d="${path}"/></defs>`;
        s += `<circle cx="${cx}" cy="${cy}" r="${R + PAD * 0.55}" fill="none" stroke="${hexA(ST_COL, 0.3)}" stroke-width="1" stroke-dasharray="2 7">`
            + `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="22s" repeatCount="indefinite"/></circle>`;
        s += `<g transform="rotate(${tilt} ${cx} ${cy})">`
            + `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="url(#${uid}m)" stroke-width="${R * 0.14}"/>`
            + `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${hexA(ST_BR, 0.8)}" stroke-width="1"/>`
            + `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.74}" ry="${ry * 0.74}" fill="none" stroke="${hexA(ST_DK, 0.5)}" stroke-width="1"/>`;
        spokes.forEach(sp => {
            s += `<line x1="${cx}" y1="${cy}" x2="${cx + sp[0]}" y2="${cy + sp[1]}" stroke="${hexA(ST_COL, 0.75)}" stroke-width="${R * 0.04}"/>`;
        });
        s += `<circle cx="${cx}" cy="${cy}" r="${R * 0.16}" fill="url(#${uid}m)" stroke="${ST_BR}" stroke-width="1"/>`
            + `<circle cx="${cx}" cy="${cy}" r="${R * 0.07}" fill="none" stroke="${hexA(ST_DK, 0.8)}" stroke-width="1"/>`;
        for (let i = 0; i < nm; i++) {
            s += `<g><animateMotion dur="${spin}s" repeatCount="indefinite" begin="-${(i / nm * spin).toFixed(2)}s" rotate="auto"><mpath href="#${uid}p"/></animateMotion>`
                + `<rect x="${-R * 0.07}" y="${-R * 0.05}" width="${R * 0.14}" height="${R * 0.1}" fill="url(#${uid}m)" stroke="${hexA(ST_BR, 0.7)}" stroke-width="0.5"/>`;
            if (i % 3 === 0) {
                s += `<circle cx="0" cy="0" r="${Math.max(0.8, R * 0.018).toFixed(2)}" fill="#9bf0bd" style="filter:drop-shadow(0 0 2px #9bf0bd)">`
                    + `<animate attributeName="opacity" values="1;0.2;1" dur="${(1.4 + i * 0.2).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
            }
            s += `</g>`;
        }
        s += `</g>`;
        s += `<circle cx="${cx}" cy="${cy - R - PAD * 0.3}" r="${Math.max(1.5, R * 0.035).toFixed(2)}" fill="#d85a4e" style="filter:drop-shadow(0 0 4px #d85a4e)">`
            + `<animate attributeName="opacity" values="1;0.15;1" dur="1.6s" repeatCount="indefinite"/></circle>`;
        if (sel) {
            s += `<circle cx="${cx}" cy="${cy}" r="${R + PAD * 0.8}" fill="none" stroke="#d9a24a" stroke-width="1" stroke-dasharray="4 5">`
                + `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="-360 ${cx} ${cy}" dur="16s" repeatCount="indefinite"/></circle>`;
        }
        return s + `</svg>`;
    }

    // ── asteroid cluster ──
    function asteroid(opts) {
        const size = opts.size || 120, sel = !!opts.sel, seed = opts.seed || 3;
        const R = size / 2, PAD = R * 0.2, cx = R + PAD, cy = R + PAD, full = size + PAD * 2;
        const rng = RNG(seed * 53 + 9);
        let rocks = '';
        for (let i = 0; i < 10; i++) {
            const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * R * 0.82;
            const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, sz = R * (0.05 + rng() * 0.13);
            rocks += `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${sz.toFixed(1)}" fill="${hexA('#6f6650', 0.5)}" stroke="#cabfa8" stroke-width="1"/>`
                + `<ellipse cx="${(x - sz * 0.28).toFixed(1)}" cy="${(y - sz * 0.28).toFixed(1)}" rx="${(sz * 0.5).toFixed(1)}" ry="${(sz * 0.4).toFixed(1)}" fill="${hexA('#efe8d6', 0.4)}"/></g>`;
        }
        let s = `<svg width="${full}" height="${full}" style="overflow:visible;display:block;filter:drop-shadow(0 0 8px rgba(202,191,168,0.2))">`
            + `<g><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="50s" repeatCount="indefinite"/>${rocks}</g>`;
        if (sel) {
            s += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#d9a24a" stroke-width="1" stroke-dasharray="4 5">`
                + `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="14s" repeatCount="indefinite"/></circle>`;
        }
        return s + `</svg>`;
    }

    /**
     * Main dispatcher. Returns an SVG string, or null when this body keeps its
     * bespoke CSS art (THE STRUCTURE, THE WRONG PLACE).
     */
    function body(planet, size, opts) {
        if (!planet) return null;
        const o = opts || {};
        const seed = seedFromId(planet.id);
        if (planet.isStructure || planet.type === 'STRUCTURE') return null;
        if (planet._isWrongPlace || planet.type === 'WRONG_PLACE') return null;
        if (planet.isStation || planet.type === 'STATION') return station({ size, seed, sel: o.sel });
        if (planet.isAsteroidField || planet.type === 'ASTEROID_FIELD') return asteroid({ size, seed, sel: o.sel });
        return globe({ type: planet.type, size, seed, sel: o.sel, scanning: o.scanning });
    }

    window.BodyRenderer = { body, globe, station, asteroid, seedFromId };
})();
