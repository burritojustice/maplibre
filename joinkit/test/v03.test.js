// Tests for JoinKit 0.3: forgiving matching, classes, chunked joins, dissolve, hexbins.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const JK = require('../joinkit.js');
let h3 = null;
try { h3 = require('h3-js'); } catch { /* hexbin tests skip without h3-js installed */ }

const square = (id, x, y, props = {}) => ({
    type: 'Feature', id,
    geometry: { type: 'Polygon', coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] },
    properties: { _gvid: id, ...props },
});

test('loose normalizer: punctuation, slash parts, typos; short names exact', () => {
    const names = ['Downtown/Civic Center', 'Castro/Upper Market', 'Treasure Island/YBI', 'Seacliff', 'Outer Sunset', 'Marina'];
    const n = JK.makeLooseNormalizer(names, JK.makeKeyNormalizer({ caseInsensitive: true, collapseSpace: true }));
    const want = JK.makeKeyNormalizer({ caseInsensitive: true, collapseSpace: true });
    assert.equal(n('Downtown / Civic Center'), want('Downtown/Civic Center'));
    assert.equal(n('Downtown Civic Center'), want('Downtown/Civic Center'));
    assert.equal(n('Downton/Civic Center'), want('Downtown/Civic Center'));
    assert.equal(n('Sea Cliff'), want('Seacliff'));
    assert.equal(n('Treasure Island'), want('Treasure Island/YBI'));
    assert.equal(n('Upper Market'), want('Castro/Upper Market'));
    assert.equal(n('Outer Susnet'), want('Outer Sunset'));
    assert.equal(n('Marin'), 'marin');          // not Marina: under 8 letters must match exactly
    assert.equal(n('Citywide'), 'citywide');
    assert.ok(n.names.has(want('Marina')));
});

test('detectDelimiter finds list columns, not plain ones', () => {
    const rows = [{ a: 'Mission, SoMa', b: 'Mission' }, { a: 'Bayview', b: 'Bayview' }, { a: 'Nob Hill; Chinatown', b: 'Castro/Upper Market' }];
    assert.equal(JK.detectDelimiter(rows, 'a'), JK.MULTI_DELIMITER);
    assert.equal(JK.detectDelimiter(rows, 'b'), null);
    assert.deepEqual('Mission, SoMa;Bayview|X\nY'.split(JK.MULTI_DELIMITER), ['Mission', 'SoMa', 'Bayview', 'X', 'Y']);
});

test('ckmeans groups around gaps and is fast on many values', () => {
    const g = JK.ckmeans([1, 1, 2, 2, 3, 10, 11, 12, 50, 52], 3);
    assert.deepEqual(g, [[1, 1, 2, 2, 3], [10, 11, 12], [50, 52]]);
    const many = Array.from({ length: 20000 }, (_, i) => (i * 7919) % 10007).sort((a, b) => a - b);
    const t = Date.now(); const gg = JK.ckmeans(many, 5);
    assert.equal(gg.flat().length, many.length);
    assert.ok(Date.now() - t < 2000);
});

test('classBreaks: natural breaks, equal width, quantiles, log', () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
    const j = JK.classBreaks(vals, { k: 3 });
    assert.equal(j.classOf(100), j.k - 1);
    assert.equal(j.stats.median, 5.5); assert.equal(j.stats.mean, 14.5);
    const e = JK.classBreaks(vals, { k: 3, method: 'equal' });
    assert.equal(e.ranges.length, 3);                       // empty middle class kept
    assert.deepEqual(e.ranges.map(r => r.n), [9, 0, 1]);
    const q = JK.classBreaks(vals, { k: 5, method: 'quantile' });
    assert.ok(q.ranges.every(r => r.n === 2));
    const l = JK.classBreaks(vals, { k: 3, method: 'equal', log: true });
    assert.ok(l.log && l.ranges[0].n < 9);                  // log spreads the small values out
    assert.equal(JK.classBreaks([], {}).classOf(3), -1);
});

test('buildJoinChunked matches buildJoin on counts, sums, averages and shares', async () => {
    const features = [square('a', 0, 0, { k: 'A' }), square('b', 1, 0, { k: 'B' })];
    const rows = [{ k: 'A', n: '1' }, { k: 'a', n: '2' }, { k: 'B, A', n: '$3' }, { k: 'Z', n: '4' }, { k: '', n: '5' }];
    const normalize = JK.makeKeyNormalizer({ caseInsensitive: true });
    const p = { rows, headers: ['k', 'n'], keyCol: 'k', features, propKey: 'k', normalize, delimiter: ',' };
    const a = JK.buildJoin(p), b = await JK.buildJoinChunked({ ...p, chunkSize: 2 });
    for (const id of ['a', 'b']) for (const s of ['count', 'sum_n', 'avg_n', 'pct_n']) assert.equal(b.byId[id].agg[s], a.byId[id].agg[s], `${id} ${s}`);
    assert.equal(b.matchedRows, a.matchedRows); assert.equal(b.nullRows, a.nullRows);
    assert.deepEqual(b.rowAreas[2], ['b', 'a']);
    assert.deepEqual(b.unmatched, [{ label: 'Z', n: 1 }]);
    const steps = [];
    const c = await JK.buildJoinChunked({ rows, headers: ['k', 'n'], features, areaOf: ['a', 'a', 'b', null, null], chunkSize: 2, onProgress: (d, t) => steps.push(d) });
    assert.equal(c.byId.a.agg.count, 2); assert.equal(c.nullRows, 2);
    assert.deepEqual(steps, [0, 2, 4, 5]);
});

test('assignPointsToPolygonsChunked equals assignPointsToPolygons', async () => {
    const features = [square('a', 0, 0), square('b', 1, 0)];
    const pts = [[0.5, 0.5], [1.5, 0.5], [3, 3], null].filter(Boolean);
    assert.deepEqual(await JK.assignPointsToPolygonsChunked(pts, features, { chunkSize: 1, idOf: f => f.id }), JK.assignPointsToPolygons(pts, features, { idOf: f => f.id }));
});

test('dissolve merges neighbors into one outline', () => {
    const fc = { type: 'FeatureCollection', features: [square('1', 0, 0, { d: '7' }), square('2', 1, 0, { d: '7' }), square('3', 5, 5, { d: '8' })] };
    const out = JK.dissolve(fc, 'd');
    assert.equal(out.features.length, 2);
    const g = out.features[0].geometry;
    assert.equal(g.type, 'Polygon');
    assert.equal(g.coordinates[0].length, 7);   // 2×1 rectangle: 6 corners (the shared edge's ends stay as vertices) + closing point
    assert.equal(out.features[0].properties.parts, 2);
});

test('hexbins: auto resolution, short codes, cover', { skip: !h3 && 'h3-js not installed' }, () => {
    assert.equal(JK.hex.autoResolution(h3, 12, 37.76), 9);
    assert.equal(JK.hex.autoResolution(h3, 12, 37.76, { bump: -1 }), 8);
    assert.equal(JK.hex.autoResolution(h3, 3.3, 38), 2);
    const z = JK.hex.switchZoom(h3, 9, 37.76);
    assert.ok(z > 12.9 && z < 13.4);
    const cells = JK.hex.cellsForPoints(h3, [[-122.42, 37.76], [-122.41, 37.77], null], 9);
    assert.equal(cells[2], null);
    const codes = JK.hex.shortCodes(h3, cells.filter(Boolean));
    assert.ok([...codes.values()].every(c => /^#[0-9a-f]+$/.test(c) && c.length === [...codes.values()][0].length));
    const cover = JK.hex.cover(h3, [square('sq', -122.43, 37.75, {})].map(f => ({ ...f, geometry: { type: 'Polygon', coordinates: [[[-122.43, 37.75], [-122.42, 37.75], [-122.42, 37.76], [-122.43, 37.76], [-122.43, 37.75]]] } })), 9, { nameOf: () => 'Box' });
    assert.ok(cover.size > 0 && [...cover.values()].every(v => v === 'Box'));
    assert.equal(JK.hex.cover(h3, [square('big', -123, 37, {})], 9, { maxCells: 10 }), null);
});
