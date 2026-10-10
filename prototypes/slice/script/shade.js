/* Silent Exodus · sector 1 slice · the reading layer's world, and canvas#shade (docs/SLICE_SPEC.md §10.2, §10.3).
   OWNER: the state-and-script builder. Load before script.js; script.js calls the factory once in init():
     const sh = window.Slice.ScriptShade(api)   api = { st, now, live, beat, reading() → GameReading, lastXY() → [x, y] }
     sh.WorldAdapter    what GameReading.create() is given: now/after/cancel on the slice clock, anchors (the 'stop:' ones
                        while stopped), luma (busy on any world, our Lander, the light, the tower, the last click), shade, dim,
                        state (the record grouped by sector), pages, art (V3Paint's helpers), geom, view, recordInOrder
     sh.render(t)       canvas#shade: the stockpile film, the dim, one dither shade per word box (v3's shadeSprite recipe);
                        never over a world or our Lander. Its pixel follows the picture: A's art pixel, D's while stopped, the film's
     sh.resize()        sh.playFilm(scene, cb)   sh.shades (Map)   sh.clear()   sh.isStopped() */
(function () {
    'use strict';
    const Slice = window.Slice, DATA = window.V3Data, P = window.V3Paint;
    Slice.ScriptShade = function (api) {
        const { st, now, live, beat } = api;
        let shadeCv = document.getElementById('shade'), sg = shadeCv.getContext('2d');
        const shades = new Map(), sprites = new Map(), SHADE_PAD = 14, patterns = [];
        let shadeKey = '', shadeScale = 1, dimAmt = 0, film = null, filmCv = null;
        const isStopped = () => st().mode === 'stop';
        function anchorList(name) {
            const stopped = isStopped(), tries = [];
            if (stopped) {
                if (['aura', 'ship', 'orbit-ship', 'orbit-beacon'].includes(name)) tries.push('stop:aura');
                else if (name === 'radio') tries.push('stop:glass', 'stop:aura');
                else if (name.startsWith('person:')) tries.push('stop:' + name, 'stop:aura');
                else tries.push(name.startsWith('stop:') ? name : 'stop:' + name, 'stop:aura');
            } else if (name === 'aura' || name === 'radio' || name.startsWith('orbit')) tries.push('ship');
            else tries.push(name, 'ship');
            for (const n of tries) {
                const f = Slice.anchors.get(n); if (!f) continue;
                let list = null; try { list = f(); } catch (err) { list = null; }
                if (list && list.length) return list.filter(Boolean);
            }
            return [{ x: innerWidth * (stopped ? 0.5 : 0.72), y: innerHeight * 0.14, side: 'below', align: 'center' }];
        }
        /** How busy the picture is under a CSS rect: words never sit on a world, our Lander, the light, the tower, the last click. */
        function luma(r) {
            const G = Slice.G, s = st(), dpr = G.dpr || 1, k = G.k || 1, world = Slice.mods.world, stop = Slice.mods.stop;
            const travel = !['stop', 'dive-in', 'dive-out'].includes(s.mode) && s.mode !== 'corridor';
            let discs = [], cssDiscs = [], tower = false;
            try {
                if (travel && world) {
                    discs = (world.discs() || []).slice();
                    const lp = world.landerPose && world.landerPose(); if (lp) discs.push([lp.x, lp.y, lp.len * 0.6]);
                    const lg = world.placeAt && world.placeAt('light'); if (lg && lg.shown !== false && lg.r) discs.push([lg.x, lg.y, lg.r + 10]);
                    tower = true;
                } else if (stop && stop.discs) cssDiscs = stop.discs() || [];
            } catch (err) { discs = []; }
            let hits = 0, n = 0;
            const nx = Math.min(40, Math.ceil(r.w / 10)), ny = Math.min(12, Math.ceil(r.h / 8));
            for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
                const x = r.x + r.w * i / nx, y = r.y + r.h * j / ny, ax = x * dpr / k, ay = y * dpr / k; n++;
                if ((tower && ax < G.hull) || discs.some(([cx, cy, rr]) => Math.hypot(ax - cx, ay - cy) < rr + 2) || cssDiscs.some(([cx, cy, rr]) => Math.hypot(x - cx, y - cy) < rr + 4)) hits++;
            }
            let v = 0.02 + (hits ? 0.3 + 0.6 * hits / n : 0);
            if (tower && r.x * dpr / k < G.hull - 2 && (r.x + r.w) * dpr / k > G.hull + 2) v += 1;   // never one line across the hull edge (look playtest, 720)
            const lastXY = api.lastXY();
            if (lastXY && lastXY[0] >= r.x - 12 && lastXY[0] <= r.x + r.w + 12 && lastXY[1] >= r.y - 12 && lastXY[1] <= r.y + r.h + 12) v += 0.5;
            if (r.x < 0 || r.y < 0 || r.x + r.w > innerWidth || r.y + r.h > innerHeight) v += 0.1;
            return v;
        }
        function recordGroups() {
            const groups = [];
            st().record.forEach(it => {
                const head = `Sector ${it.sector} · ${DATA.SECTORS[it.sector] ? DATA.SECTORS[it.sector].title : ''}`;
                let g = groups.find(x => x.head === head); if (!g) { g = { head, items: [] }; groups.push(g); }
                g.items.push({ t: it.text, stop: it.stop, who: it.who, story: it.story, routine: it.routine, page: it.page, chips: it.chips });
            });
            return groups;
        }
        function pattern(level) {
            const Lv = Math.max(0, Math.min(64, Math.round(level)));
            if (!patterns[Lv]) {
                const c = document.createElement('canvas'); c.width = 8; c.height = 8; const g = c.getContext('2d'); g.fillStyle = P.INK;
                for (let i = 0; i < 64; i++) if (P.BAYER_RAW[i] < Lv) g.fillRect(i & 7, i >> 3, 1, 1);
                patterns[Lv] = sg.createPattern(c, 'repeat');
            }
            return patterns[Lv];
        }
        const WorldAdapter = {
            now, after: (ms, fn) => Slice.after(ms, fn), cancel: id => Slice.cancel(id),
            anchor: name => anchorList(name)[0], anchors: anchorList,
            luma,
            shade(key, rect) { if (rect) shades.set(key, rect); else shades.delete(key); },
            dim(a) { dimAmt = Math.max(0, Math.min(1, a || 0)); },
            state: () => ({ sector: st().sector, title: (DATA.SECTORS[st().sector] || {}).title, view: isStopped() ? 'orbit' : 'sector', res: Object.assign({}, st().res), record: recordGroups(), pages: st().pages.slice() }),
            pages: { disc: DATA.PAGE_DISC, plate: DATA.PAGE_PLATE },
            art: { INK: P.INK, TICK: P.TICK, RP: P.RP, BAYER_RAW: P.BAYER_RAW, threshold: P.threshold, level: P.level, hash: P.hash, vnoise: P.vnoise, fbm: P.fbm, seeded: P.seeded,
                clamp01: P.clamp01, smooth: P.smooth, lerp: P.lerp, ramp: P.ramp, hexRgb: P.hexRgb, painter: P.painter, framer: P.framer, glyphText: P.pixelText, glyphWidth: P.pixelTextWidth,
                pattern, dimWith: (c, a) => { if (a > 0) { c.fillStyle = pattern(a * 64); c.fillRect(0, 0, c.canvas.width, c.canvas.height); } }, darken: () => {} },
            geom: () => { const G = Slice.G, s = (G.k || 1) / (G.dpr || 1); return { k: s, s, dpr: G.dpr, W: G.W, H: G.H, ox: 0, oy: 0, left: 0, top: 0 }; },
            view: () => (isStopped() ? 'orbit' : 'sector'),
            isEarly: () => false, openShip() {}, openRecord: () => api.reading() && api.reading().openRecord(), recordInOrder: true,
        };

        /** The shade canvas follows the picture under it: A's art pixel in travel, D's while stopped, the film's own during a film. */
        function sizeShade() {
            const G = Slice.G, dpr = G.dpr || 1, devW = Math.round(innerWidth * dpr), devH = Math.round(innerHeight * dpr);
            const scale = film ? film.k : isStopped() ? G.bk || 1 : G.k || 1, key = `${scale}:${devW}x${devH}`;
            if (key === shadeKey) return;
            shadeKey = key; shadeScale = scale;
            shadeCv.width = Math.ceil(devW / scale); shadeCv.height = Math.ceil(devH / scale);
            shadeCv.style.width = (shadeCv.width * scale / dpr) + 'px'; shadeCv.style.height = (shadeCv.height * scale / dpr) + 'px';
            patterns.length = 0;
        }
        /** v3's shadeSprite recipe: an ink dither that fades out at a ragged edge round a word box. */
        function shadeSprite(w, hgt, ax, ay, strength) {
            const key = `${w}x${hgt}:${ax}:${ay}:${strength}`; let c = sprites.get(key); if (c) return c;
            const W2 = w + SHADE_PAD * 2, H2 = hgt + SHADE_PAD * 2, a0 = strength / 20, ink = P.hexRgb(P.INK), hw = w / 2, hh = hgt / 2, round = Math.min(hw, hh);
            c = document.createElement('canvas'); c.width = W2; c.height = H2;
            const g = c.getContext('2d'), img = g.createImageData(W2, H2);
            for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
                const qx = Math.abs(x + 0.5 - SHADE_PAD - hw) - (hw - round), qy = Math.abs(y + 0.5 - SHADE_PAD - hh) - (hh - round);
                const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round + (P.fbm(x / 7, y / 4, 17, 2) - 0.5) * 16;
                if (a0 * (1 - P.smooth(-12, SHADE_PAD, sd)) > P.threshold(x + ax, y + ay)) { const o = (y * W2 + x) * 4; img.data[o] = ink[0]; img.data[o + 1] = ink[1]; img.data[o + 2] = ink[2]; img.data[o + 3] = 255; }
            }
            g.putImageData(img, 0, 0);
            if (sprites.size > 240) sprites.clear();
            sprites.set(key, c);
            return c;
        }
        function drawShades() {
            const dpr = Slice.G.dpr || 1, f = dpr / shadeScale;
            shades.forEach(r => {
                const x0 = Math.floor(r.x * f), y0 = Math.floor(r.y * f), w = Math.max(1, Math.ceil((r.x + r.w) * f) - x0), hgt = Math.max(1, Math.ceil((r.y + r.h) * f) - y0);
                const strength = Math.round((r.strength || 0.62) * 20), sx = x0 - SHADE_PAD, sy = y0 - SHADE_PAD;
                if (strength > 0) sg.drawImage(shadeSprite(w, hgt, sx & 7, sy & 7, strength), sx, sy);
            });
            if (film || isStopped() || st().mode === 'corridor') return;
            const world = Slice.mods.world;                                                   // never shade over a world or our Lander
            let discs = []; try { discs = world ? (world.discs() || []).slice() : []; const lp = world && world.landerPose(); if (lp) discs.push([lp.x, lp.y, lp.len * 0.6]); } catch (err) { discs = []; }
            if (!discs.length || shadeScale !== Slice.G.k) return;
            sg.save(); sg.globalCompositeOperation = 'destination-out'; sg.fillStyle = '#000';
            discs.forEach(([x, y, r]) => { sg.beginPath(); sg.arc(x, y, r + 2, 0, Math.PI * 2); sg.fill(); });
            sg.restore();
        }
        function filmGeom() {
            const dpr = Slice.G.dpr || 1, devW = Math.round(innerWidth * dpr), devH = Math.round(innerHeight * dpr);
            const k = Math.max(1, Math.floor(Math.min(devW / P.FILM_W, (innerHeight - 400) * dpr / P.FILM_H) + 1e-6));
            const cw = Math.ceil(devW / k), ch = Math.ceil(devH / k), fx = Math.floor((cw - P.FILM_W) / 2), fy = Math.floor((ch - P.FILM_H) / 2);
            const top = fy * k / dpr, bottom = (fy + P.FILM_H) * k / dpr;
            return { k, fx, fy, bands: { top: { y: 0, h: Math.floor(top) }, bottom: { y: Math.ceil(bottom), h: innerHeight - Math.ceil(bottom) } } };
        }
        /** A scene as film: the reused reading layer's bands, and v3's film picture (the wreck on the dusk ground) drawn here. */
        function playFilm(scene, cb) {
            const g = filmGeom();
            film = Object.assign({ t0: now() }, g);
            if (!filmCv) { filmCv = document.createElement('canvas'); filmCv.width = P.FILM_W; filmCv.height = P.FILM_H; }
            document.body.classList.add('slice-film');
            beat('film');
            const end = live(i => { film = null; document.body.classList.remove('slice-film'); cb(i); });
            if (api.reading()) api.reading().playScene(scene, g.bands).then(end); else Slice.after(0, () => end(-1));
        }
        function drawFilm(t) {
            const fg = filmCv.getContext('2d');
            P.filmFrame(fg, t - film.t0);
            const k = Math.min(1, (t - film.t0) / 700);
            if (k < 1) { fg.fillStyle = fg.createPattern(patternCanvas(Math.round((1 - Math.floor(k * 8) / 8) * 64)), 'repeat'); fg.fillRect(0, 0, P.FILM_W, P.FILM_H); }
            sg.fillStyle = P.INK; sg.fillRect(0, 0, shadeCv.width, shadeCv.height);
            sg.drawImage(filmCv, film.fx, film.fy);
        }
        const patternCanvases = [];
        function patternCanvas(Lv) {
            if (patternCanvases[Lv]) return patternCanvases[Lv];
            const c = document.createElement('canvas'); c.width = 8; c.height = 8; const g = c.getContext('2d'); g.fillStyle = P.INK;
            for (let i = 0; i < 64; i++) if (P.BAYER_RAW[i] < Lv) g.fillRect(i & 7, i >> 3, 1, 1);
            return (patternCanvases[Lv] = c);
        }

        /** While a real minigame is open the live scene stays behind it, dithered down to about 45 % (look playtest: the
            minigames were bordered boxes on near-black and the ship vanished). */
        let veilAmt = 0;
        const veil = a => { veilAmt = Math.max(0, Math.min(1, a || 0)); };
        function render(t) {
            if (!Slice.G.W) return;
            sizeShade();
            sg.clearRect(0, 0, shadeCv.width, shadeCv.height);
            if (film) drawFilm(t);
            const dimNow = Math.max(dimAmt, veilAmt);
            if (dimNow > 0) { sg.fillStyle = pattern(dimNow * 64); sg.fillRect(0, 0, shadeCv.width, shadeCv.height); }
            if (shades.size) drawShades();
        }
        function clear() { shades.clear(); dimAmt = 0; film = null; document.body.classList.remove('slice-film', 'is-reading'); }
        return { WorldAdapter, render, resize: () => { shadeKey = ''; }, playFilm, shades, clear, isStopped, veil };
    };
})();
