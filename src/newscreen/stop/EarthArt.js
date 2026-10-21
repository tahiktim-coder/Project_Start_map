/* ═══ Silent Exodus · new screen (?new=1) · stop/EarthArt.js: the copy of Earth, painted ══════════════════════════════
   What it is: Earth as the Blue Marble photo shows it (Africa, Europe and Arabia facing us, the poles white, white cloud
   swirls over a deep blue sea), in the bridge glass's own pixel language (art/Worlds.js: ramps from the ink, the 8 x 8 Bayer
   dither, one light, a thin air on the lit limb). It is the trap at the Wrong Place: something copied home and got it
   slightly wrong. The land is a hand-made coarse mask from simplified lon/lat outlines (nothing downloaded), rasterised
   once; the clouds are seeded noise with a few storms. Also the copy's own sky (stars in perfect rows), what a scan finds
   under its skin (a bare grey lattice, hollow), and its back (a flat disc of unfinished grey struts).
   No randomness: every pattern is seeded. Loaded only when the new-screen switch is on, after art/Paint.js.

   window.NSEarthArt (frozen)
     VIEW                         { lon, lat }  the Blue Marble view: the longitude and latitude that face us at rest
     prepare(step?) → bool        builds the maps a band at a time (true once ready); paint() finishes them if needed
     paint(p, o)                  Earth into an NSPaint painter p. o: { cx, cy, r, L, lon, lat, clouds (degrees the
                                  clouds have drifted east), dim (0..1), lattice(nx, ny, nz) → 0..1 | null (how much of the
                                  bare lattice shows here: the scan) }. Leaves the hollow lattice's cells clear (empty)
     back(p, o)                   the flat disc's back: unfinished grey struts. o: { cx, cy, r, L }
     sky(W, H, o) → canvas        stars in perfect rows. o: { gx, gy (spacing), ox, oy (phase), dim }
     RAMPS                        the ramps (for the ending's pictures)
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!window.NEW_SCREEN || !P) return;
    const { INK, ramp, level, threshold, fbm, vnoise, hash, clamp01, smooth } = P;
    const DEG = Math.PI / 180;
    const VIEW = Object.freeze({ lon: 22, lat: 4 });

    // ── the ramps, all from the ink ──
    const R = {
        SEA: ramp(INK, '#07122a', '#0b1d3e', '#102a56', '#173a6e', '#1f4c88', '#2c64a2'),
        SHELF: ramp(INK, '#0a1f38', '#11345a', '#1a4a78', '#256496', '#3a80b0'),
        GREEN: ramp(INK, '#0b150c', '#142614', '#203a1a', '#2f5022', '#43662a', '#5e7c36'),
        DRY: ramp(INK, '#1c150d', '#362818', '#56402a', '#7a5f3c', '#9f8052', '#c2a26e', '#dcc392', '#efdcb2'),
        ICE: ramp(INK, '#26323c', '#53626e', '#8a9ba8', '#c0ccd4', '#e6eef2', '#fbfdfe'),
        CLOUD: ramp(INK, '#2e3944', '#5f6d79', '#97a5b0', '#c9d3da', '#eaf0f3', '#ffffff'),
        AIR: ramp(INK, '#0c2038', '#173a62', '#2a5e94', '#5a96cc', '#9cc8ec'),
        LATTICE: ramp(INK, '#171b1f', '#30363b', '#535a5f', '#7d8488', '#aab0b2', '#d2d6d6'),
        STAR: ramp(INK, '#141b20', '#36434a', '#76868a', '#b8c4c2', '#eef0ea'),
    };

    // ════════════════════════════════════════ 1. the land: coarse outlines, lon/lat degrees ════════════════════════════════
    // Simplified coasts, enough to read at a glance from orbit. Each ring is closed; lakes are cut back out.
    const LAND = {
        africa: [[-5.9, 35.8], [-1, 35.3], [3, 36.8], [10.2, 37.3], [11, 33.6], [15.2, 32.3], [19.6, 30.4], [20.1, 32.2], [24.9, 31.8], [29.9, 31.2], [32.3, 31.2],
            [32.5, 29.9], [33.6, 27.2], [35.6, 23.9], [37.3, 19.2], [38.6, 18], [39.8, 15.5], [41.7, 13.4], [43.3, 11.6], [44.6, 10.4], [51.2, 11.8], [51, 10.4],
            [49.6, 6.4], [48, 4.4], [45.3, 2], [42, -1], [40.1, -3.2], [39.2, -6.8], [40.4, -10.5], [40.6, -15.1], [36.9, -18], [35.1, -21.2], [35.5, -24.1],
            [32.6, -26], [31.1, -29.8], [27.9, -33], [25.6, -33.9], [20, -34.8], [18.4, -34.3], [17.9, -31.6], [15.3, -26.6], [14.5, -22.9], [11.8, -17.3],
            [12.3, -13], [13.3, -8.8], [12.2, -5.9], [9.3, -1.3], [9.3, 0.6], [9.8, 3.9], [8.4, 4.5], [6, 4.3], [3.4, 6.4], [-0.2, 5.6], [-3.9, 5.2], [-7.5, 4.4],
            [-10.8, 6.3], [-13.2, 8.5], [-15.6, 11.9], [-17.5, 14.7], [-16.5, 19.4], [-17.1, 20.9], [-15, 24], [-13.2, 27.7], [-9.8, 29.8], [-9.6, 30.5],
            [-8.5, 33.3], [-6.8, 34.1]],
        madagascar: [[49.3, -12], [50.5, -15.5], [49.5, -17.5], [48.3, -21.5], [47.1, -24.8], [45.2, -25.5], [43.6, -23.5], [43.3, -21.5], [44.4, -19.5], [44, -17], [46.3, -15.7], [48, -13.5]],
        eurasia: [[-5.6, 36], [-6.3, 36.8], [-7.4, 37.2], [-8.9, 37], [-8.8, 38.7], [-9.5, 39.4], [-8.7, 41.5], [-9.3, 42.9], [-8, 43.7], [-3.8, 43.5], [-1.8, 43.4],
            [-1.2, 44.6], [-1.2, 46.2], [-2.2, 47.3], [-4.6, 48.4], [-1.6, 48.7], [-1.6, 49.7], [0.1, 49.5], [1.6, 50.9], [3.2, 51.3], [4.5, 52.4], [6.8, 53.4],
            [8.6, 53.9], [8.1, 55.5], [8.6, 57.1], [10.6, 57.7], [10.2, 56], [10.9, 54.4], [14.3, 53.9], [18.6, 54.7], [21.1, 55.7], [21, 57.5], [24.1, 57.2],
            [23.5, 59.3], [28, 59.7], [30.5, 60.5], [33, 66], [40, 66.5], [44, 68.5], [53, 68.3], [60, 69.5], [68, 72.5], [80, 73.5], [100, 77], [125, 73],
            [125, 22], [110, 21], [106, 20], [109, 12], [105, 8.6], [103.5, 1.3], [100.3, 6], [98.3, 8], [97.6, 16.5], [94.3, 18], [91.6, 22.5], [88.5, 21.8],
            [86.5, 20], [82.3, 16.6], [80.2, 13.1], [79.8, 10], [77.5, 8.1], [76.3, 9.6], [74.8, 13], [73.3, 17], [72.8, 19], [72.6, 21.2], [70, 22.5],
            [68.3, 23.6], [66.7, 25], [61.6, 25.2], [58, 25.6], [56.4, 27.1], [54, 26.7], [51.2, 28.4], [49.9, 30.1], [48.1, 29.4], [49.6, 27.1], [50.8, 25.7],
            [51.6, 25.9], [51.4, 24.6], [54.4, 24.3], [56.1, 26.1], [56.4, 24.8], [58.6, 23.6], [59.8, 22.4], [57.8, 18.9], [55.1, 17], [52.2, 15.6], [48.7, 14],
            [45, 12.8], [43.4, 12.6], [42.7, 15.5], [41.2, 18.2], [39.2, 21.5], [37.3, 24.5], [35.1, 28.1], [34.7, 29.5], [34.3, 27.9], [32.6, 29.9], [32.3, 31.3],
            [34.2, 31.3], [34.8, 32.1], [35.5, 33.9], [35.8, 35.5], [36.2, 36.6], [35, 36.7], [32.8, 36.1], [30.6, 36.8], [28, 36.7], [27.2, 37.9], [26.3, 38.5],
            [26.7, 39.5], [26.2, 40.1], [26, 40.8], [24.5, 40.9], [22.9, 40.6], [23.8, 39], [24, 38], [22.9, 37.3], [22.5, 36.4], [21.7, 36.8], [21.1, 37.8],
            [21.1, 39.4], [19.5, 40.5], [19.4, 41.9], [18.6, 42.4], [16.4, 43.5], [15.2, 44.2], [13.8, 44.9], [13.8, 45.6], [12.3, 45.4], [12.3, 44.3],
            [13.6, 43.6], [14.2, 42.5], [16.1, 41.4], [18.5, 40.1], [17.2, 40.4], [16.6, 38.9], [16.1, 38], [15.6, 38.2], [15.8, 40], [14.3, 40.8], [12.2, 41.8],
            [10.5, 42.9], [10.3, 43.9], [8.9, 44.4], [7.5, 43.8], [5.3, 43.3], [3.1, 43.1], [3.2, 41.9], [2.2, 41.4], [0.9, 41], [-0.3, 39.5], [0.2, 38.7],
            [-1.3, 37.6], [-2.1, 36.7], [-4.4, 36.7]],
        scandinavia: [[30, 60.2], [25, 60.2], [23, 59.8], [22.2, 60.4], [21.3, 61.5], [21.5, 63], [24.5, 64.9], [25.5, 65.4], [22, 65.6], [21, 64.7], [19, 63.5],
            [17.5, 62.4], [17.2, 61], [18.8, 60.1], [18.1, 59.3], [16.6, 57.7], [16.4, 56.6], [14.2, 55.4], [12.9, 55.6], [12.6, 56.2], [11.9, 57.7], [11.2, 59.1],
            [10.6, 59.9], [8, 58.1], [5.7, 58.9], [5.3, 60.4], [5, 62], [6.5, 62.7], [8.5, 63.5], [12.5, 65.5], [14.4, 67.3], [16, 68.5], [18.9, 69.6],
            [23.7, 70.9], [25.8, 71.1], [28.5, 70.9], [31, 70.3], [33, 69.3], [33, 66], [30.5, 60.5]],
        britain: [[-5.7, 50.1], [-3.5, 50.3], [-1, 50.8], [1.4, 51.2], [1.7, 52.7], [0.3, 53.4], [-0.2, 54.5], [-1.6, 55.6], [-2.1, 57.1], [-3, 58.6], [-5, 58.6],
            [-5.7, 57.5], [-5.6, 56.2], [-4.9, 55], [-3.2, 54], [-3, 53.3], [-4.5, 53.3], [-4.2, 52.5], [-5.3, 51.8], [-4, 51.6], [-3, 51.4], [-4.2, 51.2]],
        ireland: [[-6, 52.2], [-6.1, 53.4], [-5.6, 54.6], [-6.9, 55.3], [-8.3, 55.2], [-8.6, 54.3], [-10.1, 54.2], [-9.8, 53.3], [-10.3, 51.8], [-9.5, 51.5], [-8.3, 51.8]],
        iceland: [[-24, 65.5], [-22, 66.4], [-16, 66.5], [-13.5, 65.2], [-15, 64.2], [-18.7, 63.4], [-22.7, 63.8]],
        sicily: [[12.4, 38.1], [15.6, 38.3], [15.1, 37], [12.4, 37.6]],
        sardinia: [[8.4, 41.2], [9.8, 41], [9.6, 39.1], [8.4, 39]],
        corsica: [[9.4, 43], [9.5, 41.4], [8.6, 41.7]],
        crete: [[23.6, 35.6], [26.3, 35.3], [24, 34.9]],
        cyprus: [[32.3, 35.1], [34.6, 35.6], [33, 34.6]],
        srilanka: [[79.8, 9.8], [81.9, 7.5], [80.6, 5.9], [79.8, 7]],
        southamerica: [[-35.2, -5.8], [-34.9, -8.1], [-38.5, -13], [-39, -17.9], [-40.3, -20.3], [-43.2, -22.9], [-48.5, -26.2], [-48.7, -28.5], [-51.2, -30.5],
            [-53.4, -33.7], [-55, -34.9], [-58.4, -34.6], [-57.5, -38], [-62.3, -38.8], [-65, -42.5], [-67.5, -46], [-69, -51.6], [-68.3, -54.8], [-72, -53],
            [-75, -46], [-73.5, -37], [-71.6, -33], [-70.4, -23.6], [-75, -14], [-81.3, -4.9], [-80, 1], [-77, 7.6], [-75.5, 10.4], [-71.6, 10.7], [-68, 10.6],
            [-63, 10.7], [-61, 8.6], [-58.2, 6.8], [-55.2, 5.9], [-52.3, 4.9], [-50, 1.8], [-49.3, -0.2], [-44.3, -2.5], [-40, -2.9], [-38.5, -3.7]],
        greenland: [[-73, 78], [-60, 82], [-30, 83.5], [-18, 81.5], [-20, 75], [-22, 70.5], [-27, 68.2], [-35, 65.8], [-43.5, 60], [-48.5, 61], [-51.5, 64.5],
            [-53.5, 67.5], [-54.5, 70.5], [-58, 75.5], [-66, 76.5]],
    };
    const LAKES = {
        black: [[28, 41.6], [29, 41.2], [31, 41.1], [33.5, 42], [36, 41.7], [38.5, 40.9], [41.5, 41.5], [39.7, 43.6], [37.8, 44.7], [36.6, 45.4], [35, 45],
            [33.5, 44.5], [32.5, 45.4], [33.5, 46], [31.6, 46.6], [30.7, 46.5], [29.7, 45.3], [28.6, 44.2], [28, 43.2]],
        caspian: [[47, 44.8], [49, 46.5], [51.5, 47], [53, 45.5], [51.4, 45.3], [52.8, 41.5], [53.9, 40.5], [54, 37.3], [51, 36.7], [49, 37.6], [48.9, 38.4],
            [49.6, 40.3], [48, 42], [47.5, 43]],
    };

    // ── the maps: 2 cells per degree; land 0 sea / 1 land / 2 ice sheet; the sea's depth near a coast; the clouds ──
    const MW = 720, MH = 360;
    let land = null, kind = null, tone = null, dryAt = null, cloud = null, built = 0, kindRows = 0, cloudRows = 0;
    const cellOf = (lon, lat) => { let i = Math.floor((lon + 180) * 2); i = ((i % MW) + MW) % MW; const j = Math.max(0, Math.min(MH - 1, Math.floor((90 - lat) * 2))); return j * MW + i; };
    /** Even-odd scanline fill of one ring into the map (value v). */
    function fill(ring, v) {
        for (let j = 0; j < MH; j++) {
            const lat = 90 - (j + 0.5) / 2, xs = [];
            for (let k = 0; k < ring.length; k++) {
                const a = ring[k], b = ring[(k + 1) % ring.length];
                if ((a[1] > lat) === (b[1] > lat)) continue;
                xs.push(a[0] + (lat - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
            }
            xs.sort((p, q) => p - q);
            for (let k = 0; k + 1 < xs.length; k += 2) {
                for (let i = Math.ceil((xs[k] + 180) * 2 - 0.5); i <= Math.floor((xs[k + 1] + 180) * 2 - 0.5); i++) land[j * MW + ((i % MW) + MW) % MW] = v;
            }
        }
    }
    /** How dry the land is at (lon, lat), 0 green .. 1 desert: the great deserts as soft boxes, broken by noise. */
    function dryness(lon, lat) {
        const box = (l0, l1, a0, a1, soft, k) => k * smooth(-soft, soft, Math.min(lon - l0, l1 - lon)) * smooth(-soft, soft, Math.min(lat - a0, a1 - lat));
        const d = Math.max(
            box(-18, 34, 15, 33, 3.5, 1), box(34, 60, 12, 32, 3, 0.95), box(44, 72, 25, 45, 4, 0.72), box(10, 27, -30, -16, 3, 0.78),
            box(40, 52, -1, 12, 3, 0.55), box(-10, 45, 34, 42, 2.5, 0.42), box(28, 45, 36, 42, 3, 0.5), box(66, 76, 22, 30, 2, 0.6),
            box(-42, -35, -12, -3, 2, 0.5), box(-72, -64, -45, -20, 3, 0.6), box(18, 32, -34, -24, 2, 0.4));
        return clamp01(d + 0.22 * (fbm(lon * 0.09 + 3, lat * 0.09, 211, 3) - 0.5));
    }
    /** A storm: a spiral of cloud round (lon, lat) radius r (degrees), turning with `turn` (+1 north, -1 south). */
    function storm(lon, lat, c) {
        const dx = (lon - c[0]) * Math.cos(lat * DEG), dy = lat - c[1], d = Math.hypot(dx, dy);
        if (d > c[2] * 1.9) return 0;
        const a = Math.atan2(dy, dx), arm = 0.5 + 0.5 * Math.sin(c[3] * 2 * a - d / c[2] * 5.4);
        return smooth(c[2] * 1.9, c[2] * 0.25, d) * (0.35 + 0.65 * arm) * (d < c[2] * 0.18 ? 0.4 : 1);
    }
    const STORMS = [[-36, 49, 8, 1], [-44, 33, 5, -1], [6, -47, 10, -1], [50, -43, 8, -1], [-8, -31, 7, -1], [70, -29, 8, -1], [88, -48, 9, 1], [-55, -46, 8, 1], [62, 58, 6, 1]];
    function cloudAt(lon, lat) {
        const w1 = fbm(lon * 0.05 + 7, lat * 0.07, 301, 3), w2 = fbm(lon * 0.05, lat * 0.07 + 11, 302, 3);
        const q = fbm(lon * 0.045 + w1 * 2.2, lat * 0.085 + w2 * 2.2, 303, 4);
        const onLand = cellLand(lon, lat);
        const cells = smooth(0.42, 0.68, fbm(lon * 0.11 + w1 * 1.5, lat * 0.2, 304, 3));            // the equator's storms: clusters, never a band
        const itcz = Math.exp(-(((lat - 5) / 6.5) ** 2)) * cells;
        const mid = smooth(30, 46, Math.abs(lat)) * (1 - smooth(70, 82, Math.abs(lat))) * (onLand && lat > 0 ? 0.5 : 1);   // Europe mostly clear: it must read
        const clear = 1 - 0.8 * Math.max(dryness(lon, lat) * (onLand ? 1 : 0.35), smooth(12, 20, Math.abs(lat)) * (1 - smooth(26, 33, Math.abs(lat))));
        let c = Math.max(smooth(0.48, 0.72, q) * (0.22 + 0.95 * mid), itcz * 0.95) * clear;
        STORMS.forEach(s => { c = Math.max(c, storm(lon, lat, s) * 0.95); });
        return clamp01(c);
    }
    const cellLand = (lon, lat) => land[cellOf(lon, lat)] === 1;
    const isIce = (lon, lat) => { const n = fbm(lon * 0.05, lat * 0.1, 401, 2); return lat > 78 + 6 * (n - 0.5) || lat < -67 + 5 * (n - 0.5); };
    /** Builds the maps a band of rows at a time (step rows per call, or everything at once), so nothing ever stalls a frame
        for long: the outlines first (one call), then what each cell shows, then the clouds. True once everything is ready.
        The land is read through coasts that wander (each cell samples the outline a little off), so no edge looks drawn. */
    function prepare(step) {
        if (built >= 3) return true;
        let rows = step == null ? Infinity : Math.max(1, step);
        if (built === 0) {
            land = new Uint8Array(MW * MH);
            Object.values(LAND).forEach(ring => fill(ring, 1));
            fill(LAND.greenland, 2);
            Object.values(LAKES).forEach(ring => fill(ring, 0));
            kind = new Uint8Array(MW * MH); tone = new Uint8Array(MW * MH); dryAt = new Uint8Array(MW * MH); cloud = new Float32Array(MW * MH);
            built = 1;
            if (step != null) return false;
        }
        // what each cell shows: 0 sea, 1 shelf, 2 near shelf, 3 green, 4 dry, 5 ice; a tone (0..255) for its grain; how dry
        for (; built === 1 && rows > 0; rows--, kindRows++) {
            if (kindRows >= MH) { built = 2; break; }
            const j = kindRows, lat = 90 - (j + 0.5) / 2;
            for (let i = 0; i < MW; i++) {
                const lon = (i + 0.5) / 2 - 180, k = j * MW + i;
                const jx = 0.9 * (vnoise(lon * 0.32, lat * 0.32, 17) - 0.5), jy = 0.9 * (vnoise(lon * 0.32 + 9, lat * 0.32, 18) - 0.5);
                const src = cellOf(lon + jx, lat + jy), l = land[src];
                if (l === 2 || isIce(lon + jx, lat + jy)) { kind[k] = 5; tone[k] = Math.round(255 * fbm(lon * 0.2, lat * 0.2, 41, 2)); continue; }
                if (l === 1) {
                    const d = dryness(lon, lat);
                    dryAt[k] = Math.round(255 * d);
                    kind[k] = d > 0.42 ? 4 : 3;
                    tone[k] = Math.round(255 * fbm(lon * 0.35, lat * 0.35, 51, 3));
                    continue;
                }
                const sj = Math.floor(src / MW), si = src - sj * MW;
                let near = 0;
                for (let dj = -2; dj <= 2 && near < 2; dj++) {
                    const row = sj + dj;
                    if (row < 0 || row >= MH) continue;
                    for (let di = -2; di <= 2; di++) if (land[row * MW + ((si + di + MW) % MW)] === 1) near = Math.max(near, Math.abs(di) + Math.abs(dj) <= 2 ? 2 : 1);
                }
                kind[k] = near;
                tone[k] = Math.round(255 * fbm(lon * 0.08, lat * 0.08, 61, 2));
            }
        }
        for (; built === 2 && rows > 0; rows--, cloudRows++) {
            if (cloudRows >= MH) { built = 3; break; }
            const lat = 90 - (cloudRows + 0.5) / 2;
            for (let i = 0; i < MW; i++) cloud[cloudRows * MW + i] = cloudAt((i + 0.5) / 2 - 180, lat);
        }
        if (built === 2 && cloudRows >= MH) built = 3;
        return built >= 3;
    }
    function cloudSample(lon, lat) {                                               // bilinear: soft edges, no stair steps
        const x = (lon + 180) * 2 - 0.5, y = (90 - lat) * 2 - 0.5, i = Math.floor(x), j = Math.max(0, Math.min(MH - 2, Math.floor(y))), fx = x - i, fy = y - j;
        const i0 = ((i % MW) + MW) % MW, i1 = (i0 + 1) % MW, a = cloud[j * MW + i0], b = cloud[j * MW + i1], c = cloud[(j + 1) * MW + i0], d = cloud[(j + 1) * MW + i1];
        return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }

    // ════════════════════════════════════════ 2. the globe ════════════════════════════════════════
    const NIGHT = P.hexRgb('#081124');                                            // the dark side, flat: the disc reads whole against the sky
    const GRID = 15;                                                               // the lattice: a line every 15 degrees
    function onGrid(lon, lat, w) {
        const a = Math.abs(lat - GRID * Math.round(lat / GRID)), b = Math.abs(lon - GRID * Math.round(lon / GRID)) * Math.max(0.2, Math.cos(lat * DEG));
        return Math.min(a, b) < w;
    }
    /** Each pixel's place on the globe for one size and tilt, worked out once: a repaint (the turn) is only lookups. */
    const geoms = new Map();
    function geomOf(r, lat0d, L) {
        const key = r + ':' + lat0d + ':' + L.join(',');
        if (geoms.has(key)) return geoms.get(key);
        const aw = Math.max(1.6, r / 30), half = Math.ceil(r + aw + 1), n = half * 2, lat0 = lat0d * DEG, sT = Math.sin(lat0), cT = Math.cos(lat0);
        const g = { half, n, aw, type: new Uint8Array(n * n), q: new Float32Array(n * n), dlon: new Float32Array(n * n), lat: new Float32Array(n * n), lam: new Float32Array(n * n), nz: new Float32Array(n * n) };
        for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) {
            const k = yy * n + xx, nx = (xx + 0.5 - half) / r, ny = (yy + 0.5 - half) / r, q = nx * nx + ny * ny;
            g.q[k] = q;
            if (q >= 1) { g.type[k] = (Math.sqrt(q) - 1) * r / aw < 1 ? 1 : 0; g.lam[k] = (nx * L[0] + ny * L[1]) / Math.sqrt(q); continue; }
            const nz = Math.sqrt(1 - q), Y = -ny, y2 = Y * cT + nz * sT, z2 = -Y * sT + nz * cT;
            g.type[k] = 2; g.nz[k] = nz;
            g.dlon[k] = Math.atan2(nx, z2) / DEG; g.lat[k] = Math.asin(Math.max(-1, Math.min(1, y2))) / DEG;
            g.lam[k] = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2] + 0.05) / 1.05);
        }
        if (geoms.size > 24) geoms.clear();
        geoms.set(key, g);
        return g;
    }
    /** Earth into p (an NSPaint painter). See the top of this file for o. */
    function paint(p, o) {
        prepare();
        const r = Math.max(2, Math.round(o.r)), cx = Math.round(o.cx), cy = Math.round(o.cy), L = o.L || P.norm3(0.42, -0.36, 0.83), dim = o.dim == null ? 1 : o.dim;
        const lon0 = o.lon == null ? VIEW.lon : o.lon, lat0d = o.lat == null ? VIEW.lat : o.lat, lat0 = lat0d * DEG, sT = Math.sin(lat0), cT = Math.cos(lat0);
        const drift = o.clouds || 0, lattice = typeof o.lattice === 'function' ? o.lattice : null;
        const g = geomOf(r, lat0d, L), wGrid = Math.max(0.55, 46 / r), edge = Math.max(0, 1 - 1.7 / r) ** 2;
        const RMP = [R.SEA, R.SHELF, R.SHELF, R.GREEN, R.DRY, R.ICE], night = dim > 0.5;
        for (let yy = 0; yy < g.n; yy++) for (let xx = 0; xx < g.n; xx++) {
            const k = yy * g.n + xx, ty = g.type[k];
            if (!ty) continue;
            const x = cx - g.half + xx, y = cy - g.half + yy;
            if (x < 0 || y < 0 || x >= p.W || y >= p.H) continue;
            if (ty === 1) {                                                         // the air: a thin blue haze off the lit limb (none off the dark one)
                const out = (Math.sqrt(g.q[k]) - 1) * r / g.aw, facing = g.lam[k];
                if (facing > 0.1) p.cover(x, y, R.AIR, (0.62 * (1 - out) + 0.1) * (0.4 + 0.6 * clamp01(facing + 0.15)) * dim, (1 - out) * 0.9);
                continue;
            }
            const lam = g.lam[k], lat = g.lat[k], lon = lon0 + g.dlon[k];
            if (lattice) {
                const nx = (xx + 0.5 - g.half) / r, ny = (yy + 0.5 - g.half) / r, nz = g.nz[k], w = lattice(nx, ny, nz);
                if (w > 0 && w > threshold(x + 3, y + 1)) {                         // under the sweep: the bare lattice, nothing inside
                    if (onGrid(lon, lat, wGrid / Math.max(0.35, nz))) { p.solid(x, y, R.LATTICE, (0.42 + 0.5 * lam) * dim); continue; }
                    const Y = -ny, y2 = Y * cT - nz * sT, z2 = -Y * sT - nz * cT;    // through the holes: the far side's struts
                    if (onGrid(lon0 + Math.atan2(nx, z2) / DEG, Math.asin(Math.max(-1, Math.min(1, y2))) / DEG, wGrid / Math.max(0.35, nz))) p.solid(x, y, R.LATTICE, 0.22 * dim);
                    continue;
                }
            }
            const cell = cellOf(lon, lat), kd = kind[cell], tn = tone[cell] / 255;
            let rmp = RMP[kd], a;
            if (kd === 5) a = 0.86 + 0.1 * (tn - 0.5);
            else if (kd === 4 || kd === 3) {
                const d = dryAt[cell] / 255, dry = d > 0.42 + 0.16 * (threshold(x, y) - 0.5);
                rmp = dry ? R.DRY : R.GREEN;
                a = dry ? 0.62 + 0.42 * d + 0.12 * (tn - 0.5) : 0.6 + 0.2 * d + 0.14 * (tn - 0.5);
            } else a = kd === 2 ? 0.62 : kd === 1 ? 0.56 : 0.5 + 0.1 * (tn - 0.5);
            const ca = smooth(0.14, 0.7, cloudSample(lon - drift, lat));            // a cloud over it: its own white ramp, thin at its edge
            if (ca > 0.03 && ca > threshold(x, y)) { rmp = R.CLOUD; a = 0.52 + 0.58 * ca; }
            if (g.q[k] > edge && lam > 0.1 && rmp !== R.CLOUD) { p.solid(x, y, R.AIR, Math.min(0.95, 0.3 + 0.75 * lam) * dim); continue; }   // the lit limb: the air, a pixel thick
            if (g.q[k] > edge && lam <= 0.1) { p.set(x, y, night ? R.AIR.rgb[1] : R.AIR.rgb[0]); continue; }   // the dark limb: a faint line of air, the edge crisp
            const lv = level(rmp, Math.pow(lam, 1.05) * 0.95 * a * dim, x, y);
            p.set(x, y, lv === 0 && night ? NIGHT : rmp.rgb[lv]);                  // in the dark: one flat navy (never loose dots on the sky's own ink)
        }
    }

    /** The flat disc's back: grey struts on a round frame, unfinished on one side (struts stop short, a few hang loose). */
    function back(p, o) {
        const { cx, cy, r } = o, L = o.L || P.norm3(0.42, -0.36, 0.83), u = 1 / r;     // u: one pixel, in radii
        const SPOKES = 12, RINGS = 5, CELL = r / 3.4;
        p.region(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy) / r;
            if (d >= 1) return;
            const a = Math.atan2(dy, dx);
            const reach = 0.22 + 0.78 * smooth(-0.75, 0.55, Math.cos(a + 2.3) + 0.4 * (fbm(a * 1.6 + 3, 2.5, 71, 2) - 0.5));   // built out from the upper left; it stops short, ragged
            const lit = clamp01(0.55 + 0.45 * (-dx / r * L[0] - dy / r * L[1]));
            if (d > 1 - 2.2 * u) { p.solid(x, y, R.LATTICE, 0.5 + 0.35 * lit); return; }                  // the frame that holds the painted face
            const ring = Math.abs(d * RINGS - Math.round(d * RINGS)) / RINGS < 0.9 * u && d < reach + 0.03;
            const k = Math.round(a / (Math.PI * 2 / SPOKES)), loose = 0.1 + 0.25 * hash(k & 255, 3, 72);
            const spoke = Math.abs(a - k * Math.PI * 2 / SPOKES) * d < 1.1 * u && d < reach + loose && d > 0.06;   // a few run on past the rest, unfinished
            const gx = Math.abs(((dx % CELL) + CELL) % CELL - CELL / 2), gy = Math.abs(((dy % CELL) + CELL) % CELL - CELL / 2);
            const grid = (gx > CELL / 2 - 0.8 || gy > CELL / 2 - 0.8) && d < reach * 0.82;
            const plate = !grid && d < reach * 0.7 && fbm(Math.floor(dx / CELL) * 1.7, Math.floor(dy / CELL) * 1.7, 73, 2) > 0.6;   // here and there a plate is fitted
            if (ring || spoke) { p.solid(x, y, R.LATTICE, 0.42 + 0.38 * lit); return; }
            if (grid) { p.solid(x, y, R.LATTICE, 0.28 + 0.24 * lit); return; }
            if (plate) p.solid(x, y, R.LATTICE, 0.13 + 0.1 * lit);
        });
    }

    /** The copy's sky: stars in perfect rows, quiet (one dim size, a brighter one every few), nothing drifting. */
    function sky(W, H, o) {
        const opt = o || {}, gx = opt.gx || 23, gy = opt.gy || 19, ox = opt.ox || 7, oy = opt.oy || 6, dim = opt.dim == null ? 1 : opt.dim;
        const p = P.painter(W, H, true);
        for (let y = oy, row = 0; y < H; y += gy, row++) for (let x = ox, col = 0; x < W; x += gx, col++) {
            const bright = (col + row * 2) % 7 === 0, v = (bright ? 0.66 : 0.4) * dim;
            p.solid(x, y, R.STAR, v);
            if (bright && dim > 0.6) { p.solid(x - 1, y, R.STAR, v * 0.45); p.solid(x + 1, y, R.STAR, v * 0.45); }
        }
        return p.canvas();
    }

    window.NSEarthArt = Object.freeze({ VIEW, prepare, paint, back, sky, RAMPS: R, ready: () => built >= 3 });
})();
