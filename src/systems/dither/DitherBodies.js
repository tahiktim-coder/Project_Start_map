/* DitherBodies — 1-bit canvas replacement for BodyRenderer (same API, same layout box).
   Each call returns a <canvas> string; hydrate() finds those canvases once they are in the DOM
   and paints them on DitherCore's shared stepped clock. When dither mode is on this module takes
   over window.BodyRenderer, so the views need no changes; the SVG one stays at BodyRendererClassic. */

(function () {
    'use strict';
    const Core = window.DitherCore;
    if (!Core || !Core.isOn || !window.BodyRenderer) return;

    const { vnoise, rng, quantize } = Core;
    const { TYPES, FALLBACK, STATION_RAMP, ASTEROID_RAMP } = window.DitherRecipes;
    const Classic = window.BodyRenderer;

    const PAD_RATIO = 0.46;       // matches the SVG globe's padding so layouts don't shift
    const RING_SCALE = 0.66;      // ringed bodies shrink so the ring fits the same box
    const RING_TILT = -0.35;
    const RETICLE = 'rgb(217,162,74)';
    const STATION_ACCENT = [216, 90, 78];
    const live = new Map();       // canvas → render state
    const Art = window.StructureArt || null, ART_HELPERS = { vnoise: Core.vnoise, fbm: Core.fbm, ridge: Core.ridge, rng: Core.rng };

    // fine grain: below ~100px chunky pixels turn a planet into an unreadable blob
    const pixelSize = size => (size >= 200 ? 2 : 1);

    function canvasHtml(kind, size, attrs) {
        const full = Math.round(size * (1 + PAD_RATIO));
        const px = Math.ceil(full / pixelSize(size));
        const data = Object.keys(attrs).map(k => `data-${k}="${attrs[k]}"`).join(' ');
        return `<canvas class="dither-body" data-kind="${kind}" data-size="${size}" ${data} width="${px}" height="${px}" `
            + `style="width:${full}px;height:${full}px;display:block;image-rendering:pixelated"></canvas>`;
    }

    function seededCraters(seed) {
        const r = rng(seed * 7 + 3), out = [];
        for (let i = 0; i < 12; i++) out.push({ u: r(), v: 0.15 + r() * 0.7, r: 0.03 + r() * 0.06 });
        return out;
    }

    // ── globe ──
    function shadeDisc(s, T, i, dx, dy, t, L) {
        const R = s.R, nz = Math.sqrt(R * R - dx * dx - dy * dy) / R, nx = dx / R, ny = dy / R;
        const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        const u = Math.atan2(nx, nz) / (Math.PI * 2) + t / (T.spin * 1000) + s.p.so;
        const v = Math.asin(Math.max(-1, Math.min(1, ny))) / Math.PI + 0.5;
        const surf = T.surf(u, v, t, s.p);
        const hot = surf.hot || 0, lit = T.lit == null ? 1 : T.lit;
        let g = lam * surf.g * 1.15 * lit + Math.pow(1 - nz, 3) * 0.5 * lam + 0.02 + hot;
        let a = surf.a * lam + Math.min(1, hot);
        if (T.spec) { // Blinn highlight: half-vector between the light and the viewer (0,0,1)
            const hx = L[0], hy = L[1], hz = L[2] + 1, hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
            g += T.spec * Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), 90);
        }
        if (T.ring) {
            const ry = dx * Math.sin(RING_TILT) + dy * Math.cos(RING_TILT);
            if (ry < -R * 0.18 && ry > -R * 0.3 && (dx * L[0] + dy * L[1]) < 0) g *= 0.6; // soft ring shadow; a hard one reads as a black bar at title-screen size
        }
        if (T.nightLights && lam < 0.12 && surf.land && !(surf.cloud > 0.2) && vnoise(u * 90, v * 90) > 0.72) { g = 0.9; a = 1; }
        s.gray[i] = g; s.acc[i] = a; s.mask[i] = 1;
    }

    function shadeRing(s, i, dx, dy, dd, L) {
        const R = s.R, ca = Math.cos(RING_TILT), sa = Math.sin(RING_TILT);
        const rx = dx * ca - dy * sa, ryFlat = dx * sa + dy * ca, rr = Math.sqrt(rx * rx + ryFlat * ryFlat * 6.76);
        if (rr <= R * 1.3 || rr >= R * 2.2 || Math.sin(rr * 0.7) <= -0.3) return;
        if (ryFlat <= 0 && dd <= R * R) return; // back half hidden behind the body
        const along = dx * L[0] + dy * L[1], perp = Math.abs(dx * L[1] - dy * L[0]);
        const shadow = (along < -R * 0.3 && perp < R * 0.95 && dd < R * R * 7) ? 0.08 : 1;
        s.gray[i] = (0.62 + 0.2 * Math.sin(rr * 1.1)) * shadow; s.mask[i] = 1;
    }

    function plot(s, x, y, g) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= s.w || y >= s.h) return;
        s.gray[y * s.w + x] = g; s.mask[y * s.w + x] = 1;
    }

    function drawSatellites(s, T, t, L) {
        const R = s.R, r = rng(s.seed * 13 + 1);
        for (let k = 0; k < (T.debris || 0); k++) {
            const ang = r() * 6.28 + t / 50000, dist = R * (1.2 + r() * 0.22);
            const y = s.cy + Math.sin(ang) * dist * 0.45;
            if (Math.sin(ang) > 0 || Math.abs(Math.cos(ang) * dist) > R) plot(s, s.cx + Math.cos(ang) * dist, y, 0.75);
        }
        for (let k = 0; k < (T.wrecks || 0); k++) { // dead hulls: short bright slabs tumbling in a wider orbit
            const ang = r() * 6.28 + t / 70000, dist = R * (1.25 + r() * 0.18), len = Math.max(2, Math.round(R * 0.09)), tilt = r() * 3.14;
            if (Math.sin(ang) <= 0 && Math.abs(Math.cos(ang) * dist) <= R) continue;
            const wx = s.cx + Math.cos(ang) * dist, wy = s.cy + Math.sin(ang) * dist * 0.45;
            for (let j = -len; j <= len; j++) plot(s, wx + Math.cos(tilt) * j, wy + Math.sin(tilt) * j, j === 0 ? 1 : 0.6);
        }
        for (let m = 0; m < (T.moons || 0); m++) {
            const ang = t / (9000 + m * 5000) + r() * 6.28, mr = Math.max(1.2, R * (0.1 - m * 0.025));
            const mx = s.cx + Math.cos(ang) * R * (1.28 - m * 0.06), my = s.cy + Math.sin(ang) * R * 0.25 + (m ? -R * 0.2 : 0);
            if (Math.sin(ang) <= 0 && Math.abs(mx - s.cx) <= R + mr) continue; // behind the disc
            for (let y = Math.floor(my - mr); y <= my + mr; y++) for (let x = Math.floor(mx - mr); x <= mx + mr; x++) {
                const ddx = x - mx, ddy = y - my, q = ddx * ddx + ddy * ddy;
                if (q >= mr * mr) continue;
                const nz = Math.sqrt(mr * mr - q) / mr;
                plot(s, x, y, 0.1 + 0.7 * Math.max(0, (ddx / mr) * L[0] + (ddy / mr) * L[1] + nz * L[2]));
            }
        }
    }

    function renderGlobe(s, t) {
        const T = s.recipe, R = s.R, R2 = R * R, L = [T.light[0] * s.flip, T.light[1], T.light[2]];
        const glow = T.glow || 0.14;
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
            const i = y * s.w + x, dx = x - s.cx, dy = y - s.cy, dd = dx * dx + dy * dy;
            if (dd < R2) shadeDisc(s, T, i, dx, dy, t, L);
            if (T.ring) shadeRing(s, i, dx, dy, dd, L); // after the disc so the front half overlaps it
            if (dd >= R2 && dd < R2 * 1.4 && !s.mask[i]) {
                const f = 1 - (Math.sqrt(dd) - R) / (R * 0.18);
                if (f > 0) s.gray[i] = f * f * glow * Math.max(0, (dx * L[0] + dy * L[1]) / R + 0.6);
            }
        }
        drawSatellites(s, T, t, L);
        if (s.scanning) {
            const ys = Math.round(s.cy - R + ((t % 1100) / 1100) * 2 * R);
            for (let x = 0; x < s.w; x++) { const i = ys * s.w + x; if (s.mask[i]) { s.gray[i] = 1; s.acc[i] = 1; } }
        }
    }

    // ── station: a dead wheel. Torn habitat ring, solar wings (one snapped), a few windows still lit, scrap drifting off the wound ──
    function renderStation(s, t) {
        const R = s.R, ax = R * 0.86, ay = R * 0.34, ca = Math.cos(-0.28), sa = Math.sin(-0.28);
        const r = rng(s.seed * 31 + 7), tear = r() * 6.28, tearWidth = 0.35 + r() * 0.25, turn = t / 9000;
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
            const i = y * s.w + x, dx = x - s.cx, dy = y - s.cy;
            const rx = dx * ca - dy * sa, ry = dx * sa + dy * ca;
            const e = Math.sqrt((rx / ax) * (rx / ax) + (ry / ay) * (ry / ay));
            const around = Math.atan2(ry / ay, rx / ax) + turn, side = 0.6 - 0.4 * (rx / ax);
            const gap = Math.abs(((around - tear) % 6.283 + 9.425) % 6.283 - 3.1416);      // distance round the ring from the tear
            let g = -1, a = 0;
            if (e > 0.8 && e < 1.08 && gap > tearWidth) {                                  // habitat ring, in hull plates
                const plate = Math.floor(around * 14 / 6.283), seam = (around * 14 / 6.283) % 1;
                g = (0.35 + 0.5 * side) * (seam < 0.08 ? 0.45 : 1) + (gap < tearWidth + 0.12 ? -0.2 : 0);
                const hasLight = (plate * 7 + s.seed) % 5 === 0 && e > 0.9 && e < 0.98 && seam > 0.3 && seam < 0.7;
                if (hasLight && Math.floor(t / 900 + plate) % 7 !== 0) { g = 1; a = 1; }     // the odd window still lit, flickering
            } else if (e < 0.8 && (Math.abs(rx) < R * 0.03 || Math.abs(ry) < R * 0.025)) g = 0.4;   // spokes
            const wing = Math.abs(ry) < R * 0.085 && Math.abs(rx) > ax * 1.12 && Math.abs(rx) < ax * (rx > 0 ? 1.28 : 1.5);
            if (wing) g = ((Math.floor(rx / 3) + Math.floor(ry / 3)) % 2 ? 0.3 : 0.55) * (rx > 0 ? 0.6 : 1); // solar wings; the right one snapped short
            if (Math.abs(ry) < 1 && Math.abs(rx) >= ax * 1.04 && Math.abs(rx) <= ax * 1.12) g = 0.5;        // wing booms
            const hub = dx * dx + dy * dy;
            if (hub < R * R * 0.035) g = 0.3 + 0.65 * side * (1 - hub / (R * R * 0.05));
            if (Math.abs(dx) < 1.5 && dy < 0 && dy > -R * 0.42) g = 0.55;                   // docking spire
            if (g >= 0) { s.gray[i] = Math.max(0.05, g); s.acc[i] = a; s.mask[i] = 1; }
        }
        for (let k = 0; k < 9; k++) {                                                       // scrap drifting out of the tear
            const drift = (t / 14000 + r()) % 1, spread = (r() - 0.5) * 0.9, at = tear - turn + spread;
            const dist = 1.05 + drift * 0.5, rx = Math.cos(at) * ax * dist, ry = Math.sin(at) * ay * dist;
            const px = Math.round(s.cx + rx * ca + ry * sa), py = Math.round(s.cy - rx * sa + ry * ca);
            if (px < 0 || py < 0 || px >= s.w || py >= s.h) continue;
            const i = py * s.w + px; s.gray[i] = 0.75 * (1 - drift); s.mask[i] = 1;
        }
        if (Math.floor(t / 800) % 2 === 0) {                                                // the beacon on the spire still blinks
            const bi = Math.round(s.cy - R * 0.44) * s.w + Math.round(s.cx);
            s.gray[bi] = 1; s.acc[bi] = 3; s.mask[bi] = 1;
        }
    }

    // ── asteroid cluster: lumpy side-lit rocks on a slow common drift ──
    function renderAsteroid(s, t) {
        const R = s.R, r = rng(s.seed * 53 + 9), spin = t / 50000;
        for (let k = 0; k < 10; k++) {
            const a = r() * 6.28 + spin, dist = Math.sqrt(r()) * R * 0.82, size = R * (0.06 + r() * 0.15), lump = r() * 10;
            const ox = s.cx + Math.cos(a) * dist, oy = s.cy + Math.sin(a) * dist;
            for (let y = Math.floor(oy - size * 1.3); y <= oy + size * 1.3; y++) for (let x = Math.floor(ox - size * 1.3); x <= ox + size * 1.3; x++) {
                const dx = x - ox, dy = y - oy, rad = size * (0.75 + 0.5 * vnoise(Math.atan2(dy, dx) * 1.5 + lump, lump));
                const q = dx * dx + dy * dy;
                if (q >= rad * rad) continue;
                const nz = Math.sqrt(1 - q / (rad * rad));
                plot(s, x, y, 0.06 + 0.8 * Math.max(0, (dx / rad) * -0.9 + (dy / rad) * -0.25 + nz * 0.3) + 0.15 * vnoise(x * 0.9, y * 0.9));
            }
        }
    }

    // ── THE STRUCTURE: nothing natural is this straight. A black slab, lit along one edge, inside
    //    thin rings that turn the wrong way round. The only body in the game with no noise in it. ──
    function renderStructure(s, t) {
        if (Art) { Art.render(s, t, ART_HELPERS); return; }                // the real one lives in StructureArt.js; below is the plain fallback
        const R = s.R, halfW = Math.max(3, R * 0.24), halfH = R * 0.92, pulse = 0.5 + 0.5 * Math.sin(t / 1400);
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
            const i = y * s.w + x, dx = x - s.cx, dy = y - s.cy, dist = Math.sqrt(dx * dx + dy * dy * 5.3);
            const inSlab = Math.abs(dx) < halfW && Math.abs(dy) < halfH;
            if (inSlab) {
                const lit = dx < -halfW + Math.max(1.5, halfW * 0.22);       // one lit edge; the face only just separates from space
                const face = 0.2 + 0.1 * (1 - (dx + halfW) / (2 * halfW)) + (Math.abs(dy) > halfH - 1.5 ? 0.25 : 0);
                s.gray[i] = lit ? 0.97 : face; s.acc[i] = lit ? 1 : 0; s.mask[i] = 1;
                continue;
            }
            const ring = dist / R, band = Math.abs(((ring * 5 - t / 9000) % 1 + 1) % 1 - 0.5);
            if (ring > 0.45 && ring < 1.4 && band < 0.035) {                 // rings, behind the slab's column only where dy < 0
                if (Math.abs(dx) < halfW && dy < 0) continue;
                s.gray[i] = 0.35 + 0.45 * pulse * (1 - (ring - 0.45)); s.acc[i] = 0.8; s.mask[i] = 1;
            } else if (Math.abs(dx) < halfW + 6 && Math.abs(dy) < halfH + 6) {
                s.gray[i] = 0.16 * pulse;                                     // faint halo hugging the slab
            }
        }
    }

    // ── THE WRONG PLACE: a world drawn inside out. The light comes from the middle, the surface spirals
    //    inward, and it does not hold still between two frames. ──
    function renderWrongPlace(s, t) {
        const R = s.R, R2 = R * R, step = Math.floor(t / 125);
        for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
            const i = y * s.w + x, dx = x - s.cx, dy = y - s.cy, dd = dx * dx + dy * dy;
            if (dd >= R2) continue;
            const r = Math.sqrt(dd) / R, ang = Math.atan2(dy, dx);
            const spiral = 0.5 + 0.5 * Math.sin(ang * 5 + r * 14 - t / 900);
            const tear = vnoise(x * 0.35 + step * 3.7, y * 0.35) > 0.8 ? 0.5 : 0; // patches that flicker out of place
            const pupil = r < 0.2 ? 0 : 1;
            s.gray[i] = pupil * ((1 - r) * 0.85 * spiral + 0.12 + tear);
            s.acc[i] = pupil * spiral * (1 - r);
            s.mask[i] = 1;
        }
    }

    function drawReticle(s, t) {
        const r = s.reticleR, n = Math.floor(Math.PI * r), step = Math.floor(t / 400);
        s.ctx.fillStyle = RETICLE;
        for (let k = 0; k < n; k++) {
            if ((k + step) % 4 > 1) continue;
            const a = k / n * Math.PI * 2;
            s.ctx.fillRect(Math.round(s.cx + Math.cos(a) * r), Math.round(s.cy + Math.sin(a) * r), 1, 1);
        }
    }

    const RENDERERS = { globe: renderGlobe, station: renderStation, asteroid: renderAsteroid, structure: renderStructure, wrongplace: renderWrongPlace };
    const SPECIAL_LOOK = {
        structure: Art ? { ramp: Core.ramp(...Art.look.ramp), accent: Art.look.accent }
            : { ramp: Core.ramp('#06070a', '#140a24', '#3a1f66', '#8844ff', '#e6dcff'), accent: [200, 170, 255] },
        wrongplace: { ramp: Core.ramp('#06070a', '#2a0608', '#7a1414', '#d85a4e', '#ffd0b0'), accent: [255, 120, 60] },
    };

    function paint(s, t) {
        s.gray.fill(0); s.acc.fill(0); s.mask.fill(0);
        RENDERERS[s.kind](s, t);
        quantize(s.img, s.w, s.h, s.gray, s.acc, s.mask, s.look);
        s.ctx.putImageData(s.img, 0, 0);
        if (s.sel) drawReticle(s, t);
    }

    function createState(canvas) {
        const d = canvas.dataset, w = canvas.width, h = canvas.height, size = +d.size || 120, seed = +d.seed || 1;
        const kind = RENDERERS[d.kind] ? d.kind : 'globe';
        const recipe = kind === 'globe' ? (TYPES[d.type] || FALLBACK) : null;
        const baseR = (size / 2) / pixelSize(size);
        const ctx = canvas.getContext('2d');
        return {
            kind, recipe, seed, w, h, ctx, img: ctx.createImageData(w, h),
            gray: new Float32Array(w * h), acc: new Float32Array(w * h), mask: new Uint8Array(w * h),
            cx: w / 2, cy: h / 2, R: baseR * (recipe && recipe.ring ? RING_SCALE : 1),
            reticleR: Math.min(w / 2 - 1, baseR * (1 + PAD_RATIO * 0.5)),
            flip: seed % 2 ? 1 : -1, sel: d.sel === '1', scanning: d.scan === '1',
            look: SPECIAL_LOOK[kind] ? SPECIAL_LOOK[kind]
                : kind === 'station' ? { ramp: STATION_RAMP, accent: STATION_ACCENT }
                : kind === 'asteroid' ? { ramp: ASTEROID_RAMP, accent: null }
                : { ramp: recipe.ramp, accent: recipe.accent },
            p: { so: (seed % 97) * 1.37, craters: seededCraters(seed) },
        };
    }

    function hydrate(root) {
        (root || document).querySelectorAll('canvas.dither-body:not([data-live])').forEach(canvas => {
            canvas.dataset.live = '1';
            const state = createState(canvas);
            live.set(canvas, state);
            paint(state, performance.now());
        });
    }

    Core.onTick(now => {
        live.forEach((state, canvas) => {
            if (!canvas.isConnected) live.delete(canvas);
            else paint(state, now);
        });
    });

    // ── BodyRenderer-compatible API ──
    const cleanType = type => String(type || 'ROCKY').replace(/[^A-Za-z_]/g, '');
    const globe = o => canvasHtml('globe', o.size || 120, { type: cleanType(o.type), seed: o.seed || 1, sel: o.sel ? 1 : 0, scan: o.scanning ? 1 : 0 });
    const station = o => canvasHtml('station', o.size || 120, { seed: o.seed || 1, sel: o.sel ? 1 : 0 });
    const asteroid = o => canvasHtml('asteroid', o.size || 120, { seed: o.seed || 3, sel: o.sel ? 1 : 0 });

    function body(planet, size, opts) {
        if (!planet) return null;
        const o = opts || {}, seed = Classic.seedFromId(planet.id);
        if (planet.isStructure || planet.type === 'STRUCTURE') return canvasHtml('structure', size, { seed, sel: o.sel ? 1 : 0 });
        if (planet._isWrongPlace || planet.type === 'WRONG_PLACE') return canvasHtml('wrongplace', size, { seed, sel: o.sel ? 1 : 0 });
        if (planet.isStation || planet.type === 'STATION') return station({ size, seed, sel: o.sel });
        if (planet.isAsteroidField || planet.type === 'ASTEROID_FIELD') return asteroid({ size, seed, sel: o.sel });
        return globe({ type: planet.type, size, seed, sel: o.sel, scanning: o.scanning });
    }

    window.BodyRendererClassic = Classic;
    window.BodyRenderer = { body, globe, station, asteroid, seedFromId: Classic.seedFromId };
    window.DitherBodies = { hydrate };
})();
