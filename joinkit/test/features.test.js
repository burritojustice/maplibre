// Tests for JoinKit behavior that Selecter v964 didn't have.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const JK = require('../joinkit.js');

const square = (id, x, y, props = {}) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] },
    properties: { _gvid: id, ...props },
});

test('default normalizer is normVal, except numeric 0 is a real key', () => {
    const n = JK.makeKeyNormalizer();
    for (const v of ['', ' 12 ', '1,234', 'Mission', 7, null, '0']) assert.equal(n(v), JK.normVal(v));
    assert.equal(JK.normVal(0), '');   // Selecter quirk, kept for parity
    assert.equal(n(0), '0');
});

test('stripPrefix turns D5 / District 5 into 5', () => {
    const n = JK.makeKeyNormalizer({ stripPrefix: /^(district|d)\s*/i });
    assert.equal(n('D5'), '5');
    assert.equal(n('district 11'), '11');
    assert.equal(n('5'), '5');
    assert.equal(n('SFO'), 'SFO');
    assert.equal(JK.makeKeyNormalizer({ stripPrefix: 'D' })('D10'), '10');
});

test('aliases crosswalk, case folding and whitespace', () => {
    const n = JK.makeKeyNormalizer({
        caseInsensitive: true, collapseSpace: true,
        aliases: { 'Inner Sunet': 'Inner Sunset', 'SOMA': 'South of Market', 'Haight': 'Haight Ashbury' },
    });
    assert.equal(n('Chinatown '), 'chinatown');
    assert.equal(n('inner  sunet'), 'inner sunset');
    assert.equal(n('SoMa'), 'south of market');
    assert.equal(n('Haight Ashbury'), 'haight ashbury');
});

test('leading zeros and padding', () => {
    assert.equal(JK.makeKeyNormalizer({ stripLeadingZeros: true })('007'), '7');
    assert.equal(JK.makeKeyNormalizer({ stripLeadingZeros: true })('0'), '0');
    assert.equal(JK.makeKeyNormalizer({ padStart: [5, '0'] })(2134), '02134');
});

test('Airtable-shaped cells', () => {
    assert.equal(JK.cellText({ id: 'sel1', name: 'D8', color: 'x' }), 'D8');
    assert.equal(JK.cellText([{ id: 'r1', name: 'Wiggle Fest' }, { id: 'r2', name: 'Green Street Guild' }]), 'Wiggle Fest, Green Street Guild');
    assert.deepEqual(JK.cellValues(['1', '3']), ['1', '3']);
    assert.deepEqual(JK.cellValues('1; 3', ';'), ['1', '3']);
    assert.deepEqual(JK.cellValues(''), []);
});

test('multi-valued keys count a row toward each feature once', () => {
    const features = [square('a', 0, 0, { dist: 1 }), square('b', 1, 0, { dist: 2 }), square('c', 2, 0, { dist: 3 })];
    const rows = [
        { District: [{ name: '1' }, { name: '2' }], Budget: 100 },
        { District: ['2'], Budget: 50 },
        { District: ['D3', '3'], Budget: 10 },  // both normalize to 3 → counted once
        { District: [], Budget: 5 },
        { District: ['9'], Budget: 1 },
    ];
    const j = JK.buildJoin({
        rows, headers: ['District', 'Budget'], keyCol: 'District', features, propKey: 'dist',
        normalize: JK.makeKeyNormalizer({ stripPrefix: /^d/i }), types: { Budget: 'currency' },
    });
    assert.equal(j.byId.a.agg.count, 1);
    assert.equal(j.byId.b.agg.count, 2);
    assert.equal(j.byId.b.agg.sum_Budget, 150);
    assert.equal(j.byId.c.agg.count, 1);
    assert.equal(j.matchedRows, 3);
    assert.equal(j.nullRows, 1);
    assert.deepEqual(j.unmatchedVals, ['9']);
    assert.deepEqual([...j.currencyCols], ['Budget']);
});

test('delimiter splits string keys', () => {
    const features = [square('a', 0, 0, { z: '94110' }), square('b', 1, 0, { z: '94112' })];
    const rows = [{ zip: '94110, 94112' }, { zip: '94110' }];
    const j = JK.buildJoin({ rows, headers: ['zip'], keyCol: 'zip', features, propKey: 'z', delimiter: ',' });
    assert.equal(j.byId.a.rows.length, 2);
    assert.equal(j.byId.b.rows.length, 1);
});

test('explicit types override guessing', () => {
    const rows = [{ Score: '1' }, { Score: '3' }, { Score: '5' }, { Score: '2' }];
    // 1–5 small integers would otherwise be forced categorical like district numbers.
    assert.deepEqual(JK.classifyColumns(rows, ['Score']).catCols, ['Score']);
    assert.deepEqual(JK.classifyColumns(rows, ['Score'], { types: { Score: 'numeric' } }).numericCols, ['Score']);
});

test('filterRows: several conditions, and/or, multi-valued cells', () => {
    const rows = [
        { org: [{ name: 'Wiggle Fest' }], phase: 'Draft', budget: '$1,200', district: ['1', '2'] },
        { org: [{ name: 'Green Street Guild' }, { name: 'Wiggle Fest' }], phase: 'Hold', budget: 800, district: ['5'] },
        { org: [], phase: 'Draft', budget: '', district: ['2'] },
    ];
    const names = rs => rs.map(r => rows.indexOf(r));
    assert.deepEqual(names(JK.filterRows(rows, [{ col: 'org', op: '=', value: 'Wiggle Fest' }])), [0, 1]);
    assert.deepEqual(names(JK.filterRows(rows, [
        { col: 'org', op: '=', value: 'Wiggle Fest' }, { col: 'phase', op: '=', value: 'Draft' }])), [0]);
    assert.deepEqual(names(JK.filterRows(rows, [
        { col: 'phase', op: '=', value: 'Hold' }, { col: 'org', op: 'empty' }], { mode: 'or' })), [1, 2]);
    assert.deepEqual(names(JK.filterRows(rows, [{ col: 'budget', op: '>=', value: 1000 }])), [0]);
    assert.deepEqual(names(JK.filterRows(rows, [{ col: 'budget', op: 'between', value: [500, 900] }])), [1]);
    assert.deepEqual(names(JK.filterRows(rows, [{ col: 'district', op: 'in', value: ['2', '5'] }])), [0, 1, 2]);
    assert.deepEqual(names(JK.filterRows(rows, [{ col: 'district', op: 'notIn', value: ['2'] }])), [1]);
    assert.deepEqual(names(JK.filterRows(rows, [{ col: 'org', op: 'contains', value: 'street' }])), [1]);
    assert.deepEqual(JK.filterRows(rows, []), rows);
    assert.throws(() => JK.filterRows(rows, [{ col: 'x', op: '~' }]));
});

test('pointInPolygon handles holes and multipolygons', () => {
    const donut = { type: 'Polygon', coordinates: [
        [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
        [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
    assert.equal(JK.pointInPolygon([1, 1], donut), true);
    assert.equal(JK.pointInPolygon([5, 5], donut), false);
    assert.equal(JK.pointInPolygon([11, 5], donut), false);
    const multi = { type: 'MultiPolygon', coordinates: [donut.coordinates, [[[20, 20], [21, 20], [21, 21], [20, 21], [20, 20]]]] };
    assert.equal(JK.pointInPolygon([20.5, 20.5], multi), true);
    assert.equal(JK.pointInPolygon([1, 1], { type: 'LineString', coordinates: [] }), false);
});

test('assignPointsToPolygons', () => {
    const features = [square('a', 0, 0), square('b', 1, 0), { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: { _gvid: 'p' } }];
    assert.deepEqual(JK.assignPointsToPolygons([[0.5, 0.5], [1.5, 0.2], [5, 5], null, [NaN, 1]], features), ['a', 'b', null, null, null]);
});

test('buildPolygonIndex agrees with pointInPolygon on real-world shapes', () => {
    // Star-shaped polygons with holes and a multipolygon, plus many random points.
    const star = (cx, cy, r1, r2, n) => { const ring = []; for (let i = 0; i <= 2 * n; i++) { const a = Math.PI * i / n, r = i % 2 ? r2 : r1; ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } ring[ring.length - 1] = ring[0]; return ring; };
    const features = [
        { type: 'Feature', properties: { _gvid: 'a' }, geometry: { type: 'Polygon', coordinates: [star(0, 0, 4, 2, 37), star(0, 0, 1, 0.5, 11).reverse()] } },
        { type: 'Feature', properties: { _gvid: 'b' }, geometry: { type: 'MultiPolygon', coordinates: [[star(10, 0, 3, 1, 23)], [star(10, 8, 2, 1, 9)]] } },
        { type: 'Feature', properties: { _gvid: 'c' }, geometry: { type: 'Polygon', coordinates: [[[5, -6], [7, -6], [7, -4], [5, -4], [5, -6]]] } },
    ];
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const pts = Array.from({ length: 20000 }, () => [-5 + r() * 20, -8 + r() * 20]);
    const naive = pts.map(p => { for (const f of features) if (JK.pointInPolygon(p, f.geometry)) return f.properties._gvid; return null; });
    const idx = JK.buildPolygonIndex(features);
    assert.deepEqual(idx.locateAll(pts), naive);
    assert.deepEqual(JK.assignPointsToPolygons(pts, features), naive);
    assert.ok(naive.filter(x => x === 'a').length > 100 && naive.filter(x => x === 'b').length > 100);
    assert.equal(idx.locate(null), null);
    assert.equal(idx.locate([NaN, 1]), null);
    assert.equal(idx.locate([100, 100]), null);
});
