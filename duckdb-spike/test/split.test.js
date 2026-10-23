'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Split = require('../split.js');

const square = (x, y, props) => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] },
    properties: props,
});

const fc = {
    type: 'FeatureCollection',
    features: [
        square(0, 0, { name: 'A', pop: '1,200', score: 3.5, flag: 'true', zip: '94110' }),
        square(2, 0, { name: 'B', pop: 800, score: '4', flag: false, extra: { x: 1 } }),
        square(4, 0, { name: 'C', pop: null, score: '', flag: 'false' }),
    ],
};

test('inferType picks the narrowest DuckDB type', () => {
    assert.equal(Split.inferType([1, 2, '3']), 'INTEGER');
    assert.equal(Split.inferType([1, 2.5]), 'DOUBLE');
    assert.equal(Split.inferType(['1e3', '2']), 'DOUBLE');
    assert.equal(Split.inferType([3000000000, 1]), 'BIGINT');
    assert.equal(Split.inferType(['true', false, null]), 'BOOLEAN');
    assert.equal(Split.inferType(['a', 1]), 'VARCHAR');
    assert.equal(Split.inferType([null, '', undefined]), 'VARCHAR');
    assert.equal(Split.inferType(['1,200']), 'VARCHAR');   // thousands commas stay text here
});

test('splitGeoJSON separates shapes from a typed table keyed by fid', () => {
    const s = Split.splitGeoJSON(fc);
    assert.equal(s.stats.features, 3);
    assert.deepEqual(s.stats.geometryTypes, { Polygon: 3 });
    assert.deepEqual(s.stats.bbox, [0, 0, 5, 1]);

    // shapes carry only the id
    assert.deepEqual(s.geometry.features.map(f => f.id), [1, 2, 3]);
    assert.deepEqual(s.geometry.features[0].properties, { _gvid: 1 });
    assert.equal(s.geometry.features[1].geometry.type, 'Polygon');

    // table columns: fid, then properties in first-seen order, then derived
    assert.deepEqual(s.columns.map(c => c.name), ['fid', 'name', 'pop', 'score', 'flag', 'zip', 'extra', ...Split.DERIVED]);
    const types = Object.fromEntries(s.columns.map(c => [c.name, c.type]));
    assert.equal(types.fid, 'INTEGER');
    assert.equal(types.name, 'VARCHAR');
    assert.equal(types.pop, 'VARCHAR');     // '1,200' forces text
    assert.equal(types.score, 'DOUBLE');
    assert.equal(types.flag, 'BOOLEAN');
    assert.equal(types.zip, 'INTEGER');
    assert.equal(types.extra, 'VARCHAR');   // nested object is stringified
    assert.equal(types._cx, 'DOUBLE');

    // rows are coerced to those types
    assert.equal(s.rows[0].fid, 1);
    assert.equal(s.rows[1].score, 4);
    assert.equal(s.rows[2].score, null);
    assert.equal(s.rows[0].flag, true);
    assert.equal(s.rows[1].flag, false);
    assert.equal(s.rows[1].extra, '{"x":1}');
    assert.equal(s.rows[2].extra, null);
    assert.deepEqual([s.rows[1]._minx, s.rows[1]._maxx, s.rows[1]._cx], [2, 3, 2.5]);
});

test('keepProps and startId', () => {
    const s = Split.splitGeoJSON(fc, { keepProps: ['name'], startId: 100, derived: false });
    assert.deepEqual(s.geometry.features[0].properties, { _gvid: 100, name: 'A' });
    assert.equal(s.rows[2].fid, 102);
    assert.ok(!s.columns.some(c => c.source === 'derived'));
});

test('SQL helpers quote identifiers and chunk inserts', () => {
    const s = Split.splitGeoJSON(fc, { derived: false });
    assert.equal(Split.createTableSQL('my"t', s.columns.slice(0, 2)), 'CREATE OR REPLACE TABLE "my""t" ("fid" INTEGER, "name" VARCHAR)');
    const chunks = Split.insertSQLChunks('t', s.columns, s.rows, 2);
    assert.equal(chunks.length, 2);
    assert.match(chunks[0], /^INSERT INTO "t" \("fid", "name"/);
    assert.match(chunks[0], /from_json\(\$j\$\[\{"fid":1,/);
    assert.match(chunks[0], /'\[\{"fid":"INTEGER","name":"VARCHAR"/);
    assert.match(chunks[1], /"fid":3/);
});

test('numericColumns skips ids and codes', () => {
    const s = Split.splitGeoJSON(fc);
    assert.deepEqual(Split.numericColumns(s.columns), ['score']);
});
