// Parity: JoinKit must reproduce Selecter v964's join behavior exactly.
// Runs the verbatim original code (reference/selecter-v964-join.js) and JoinKit
// on the same randomized datasets and compares every output.
//   node --test joinkit/test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const JK = require('../joinkit.js');
const REF = require('./reference/selecter-v964-join.js');

// Deterministic PRNG so failures reproduce.
function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

function makeFeatures(r, n) {
    const nhoods = ['Mission', 'Castro', 'Noe Valley', 'Bernal Heights', 'SoMa', 'Tenderloin', 'Excelsior', 'Sunset'];
    return Array.from({ length: n }, (_, i) => {
        const x = i % 10, y = Math.floor(i / 10);
        return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]] },
            properties: {
                _gvid: 'g' + i,
                id: i,                                   // numeric property
                name: nhoods[i % nhoods.length] + ' ' + i,
                zip: '0' + (9400 + i),                   // leading-zero string
                district: 1 + (i % 11),
                code: (1000 + i * 37).toLocaleString('en-US'), // "1,000", "1,037" …
                nhood: nhoods[i % nhoods.length],
                ...(r() < 0.1 ? { blank: '' } : {}),
            },
        };
    });
}

function makeRows(r, features, n, multiRow) {
    const grades = ['K', '1', '2', '3', '4', '5'];
    const rows = [];
    for (let i = 0; i < n; i++) {
        const f = pick(r, features).properties;
        const roll = r();
        const row = {
            id: roll < 0.08 ? '' : roll < 0.15 ? String(9000 + i) : (r() < 0.5 ? String(f.id) : f.id),
            zip: roll < 0.1 ? '' : f.zip,
            District: String(f.district),
            Code: r() < 0.5 ? f.code : f.code.replace(/,/g, ''),
            Neighborhood: r() < 0.9 ? f.nhood : 'Nowhere',
            'Budget Requested': r() < 0.2 ? '' : r() < 0.6 ? '$' + Math.floor(r() * 5000).toLocaleString('en-US') : String(Math.floor(r() * 5000)),
            Attendance: r() < 0.1 ? 'about 50' : String(Math.floor(r() * 300)),
            Score: String(Math.floor(r() * 6)),
            Notes: pick(r, ['great', 'ok', '', 'needs follow-up', '42 people']),
            Amount: r() < 0.7 ? 'TBD' : '$' + Math.floor(r() * 100),
            School_Name: 'School ' + Math.floor(r() * 30),
            Year: String(2020 + Math.floor(r() * 6)),
        };
        if (multiRow) {
            grades.forEach(g => rows.push({ ...row, Grade: g, Enrollment: String(Math.floor(r() * 100)) }));
        } else rows.push(row);
    }
    return rows;
}

function captureLogs(fn) {
    const lines = [], orig = console.log;
    console.log = (...a) => lines.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
    try { return { result: fn(), lines }; } finally { console.log = orig; }
}

const SEEDS = Array.from({ length: 120 }, (_, i) => i * 7919 + 1);
const KEY_PAIRS = [['id', 'id'], ['zip', 'zip'], ['District', 'district'], ['Code', 'code'], ['Neighborhood', 'nhood']];

test('normVal matches', () => {
    for (const v of [null, undefined, '', 0, 1, '0', ' 12 ', '1,234', '1,2,3', 'a,b', 'NaN', ' x ', '00123', 3.5, '-4', '$5']) {
        assert.equal(JK.normVal(v), REF.normVal(v), `normVal(${JSON.stringify(v)})`);
    }
});

test('computeAgg matches', () => {
    for (const seed of SEEDS.slice(0, 40)) {
        const r = rng(seed);
        const rows = makeRows(r, makeFeatures(r, 30), 50, false);
        const num = ['Budget Requested', 'Attendance', 'Score', 'Amount'], cat = ['Notes', 'Year', 'Neighborhood'];
        assert.deepEqual(JK.computeAgg(rows, num, cat), REF._computeJoinAgg(rows, num, cat));
        assert.deepEqual(JK.computeAgg([], num, cat), REF._computeJoinAgg([], num, cat));
    }
});

test('buildJoin matches _buildJoinStore', () => {
    let compared = 0;
    for (const seed of SEEDS) {
        const r = rng(seed);
        const features = makeFeatures(r, 10 + Math.floor(r() * 60));
        const rows = makeRows(r, features, 5 + Math.floor(r() * 200), false);
        const headers = Object.keys(rows[0]);
        const [keyCol, propKey] = pick(r, KEY_PAIRS);
        const statsCol = pick(r, ['__all__', undefined, 'Attendance', 'Budget Requested']);

        const ref = captureLogs(() => REF.buildStore(features, rows, headers, keyCol, propKey, 'f.csv', statsCol, null));
        const jk = captureLogs(() => JK.buildJoin({ rows, headers, keyCol, features, propKey, statsCol, log: console.log }));
        const a = ref.result, b = jk.result;

        assert.deepEqual(b.numericCols, a.numericCols, `seed ${seed} numericCols`);
        assert.deepEqual(b.catCols, a.catCols, `seed ${seed} catCols`);
        assert.deepEqual([...b.currencyCols], [...a.currencyCols], `seed ${seed} currencyCols`);
        assert.deepEqual(b.byId, a.byGvid, `seed ${seed} byId`);
        assert.deepEqual(b.globalAgg, a.globalAgg);
        assert.deepEqual(b.aggColumns, a.aggColumns);
        assert.deepEqual(b.catColumns, a.catColumns);
        assert.deepEqual(b.csvTotals, a.csvTotals);
        assert.deepEqual(b.joinedTotals, a.joinedTotals);
        assert.equal(b.isLookup, a.isLookup);
        assert.equal(b.joinedWithMultiple, a.joinedWithMultiple);
        assert.equal(b.displayNameProp, a.displayNameProp);
        assert.equal(b.displayNameCol, a.displayNameCol);
        assert.equal(b.totalRows, a.totalRows);
        assert.equal(b.matchedRows, a.matchedRows, `seed ${seed} matchedRows`);
        assert.equal(b.nullRows, a.nullRows);
        assert.deepEqual(b.unmatchedVals, a.unmatchedGeomVals);
        // Classification log lines are identical (they come first in both).
        const cls = l => /^\[join\] (numeric|cat) col( \(forced\))?:/.test(l);
        assert.deepEqual(jk.lines.filter(cls), ref.lines.filter(cls));
        compared++;
    }
    assert.equal(compared, SEEDS.length);
});

test('scoreKeyCandidates and buildPropIndex match _runJoinFlow', () => {
    for (const seed of SEEDS) {
        const r = rng(seed);
        const features = makeFeatures(r, 10 + Math.floor(r() * 40));
        let rows = makeRows(r, features, 5 + Math.floor(r() * 120), false);
        // Rename some columns so the value-intersection path is exercised too.
        if (r() < 0.5) rows = rows.map(({ id, zip, ...rest }) => ({ ID_X: id, ZIP_X: zip, ...rest }));
        const headers = Object.keys(rows[0]);

        const ref = REF._origPropIndex(features);
        const geoJsonProps = [...new Set(features.flatMap(f => Object.keys(f.properties).filter(k => !k.startsWith('_'))))];
        const propIndex = JK.buildPropIndex(features, geoJsonProps);
        assert.deepEqual(geoJsonProps, ref.geoJsonProps);
        assert.deepEqual(propIndex, ref.propIndex);

        const a = REF._origScore(rows, headers, ref.propIndex, ref.geoJsonProps);
        const b = JK.scoreKeyCandidates({ rows, headers, propIndex, geoJsonProps });
        assert.deepEqual(b.matches, a.allMatches, `seed ${seed} matches`);
        assert.deepEqual(b.valueMatchesForDisplay, a.valueMatchesForDisplay);
        assert.equal(b.byName, a.byName);
    }
});

test('detectMultiRow matches', () => {
    for (const seed of SEEDS.slice(0, 50)) {
        const r = rng(seed);
        const features = makeFeatures(r, 20);
        const rows = makeRows(r, features, 15, r() < 0.7);
        const headers = Object.keys(rows[0]);
        for (const keyCol of ['id', 'zip', 'School_Name']) {
            const a = REF._origMultiRow(rows, headers, { csvCol: keyCol });
            const b = JK.detectMultiRow(rows, headers, keyCol);
            assert.deepEqual(b, a, `seed ${seed} key ${keyCol}`);
        }
    }
});

test('single-condition filterRows matches Selecter rowFilter', () => {
    const r = rng(42);
    const rows = makeRows(r, makeFeatures(r, 20), 60, true);
    for (const [col, val] of [['Grade', 'K'], ['Grade', '3'], ['Notes', ''], ['Year', '2022'], ['Score', '0']]) {
        const want = rows.filter(row => String(row[col] ?? '') === val);
        assert.deepEqual(JK.filterRows(rows, [{ col, op: '=', value: val }]), want);
    }
});
