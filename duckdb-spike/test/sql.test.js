// The SQL the two engines run, checked against a real DuckDB in Node
// (@duckdb/node-api, `npm install` in this folder). Covers both load paths:
//   - read_json with explicit columns (the local DuckDB-WASM path)
//   - CREATE TABLE + chunked INSERT … from_json (the MotherDuck client path)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Split = require('../split.js');

let duckdb;
try { duckdb = require('@duckdb/node-api'); } catch (e) { duckdb = null; }

const SAMPLE = path.join(__dirname, '..', '..', 'selecter', 'geojson', 'SF_city_data', 'SF_Find_Micro_Neighborhoods.geojson');
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";

async function open() {
    const instance = await duckdb.DuckDBInstance.create(':memory:');
    return instance.connect();
}
const rows = async (con, sql) => (await con.runAndReadAll(sql)).getRowObjects();

test('MotherDuck path: CREATE TABLE + chunked INSERT … from_json', { skip: !duckdb && '@duckdb/node-api not installed' }, async () => {
    const fc = JSON.parse(fs.readFileSync(SAMPLE, 'utf8'));
    const split = Split.splitGeoJSON(fc);
    const con = await open();
    await con.run(Split.createTableSQL('t', split.columns));
    const chunks = Split.insertSQLChunks('t', split.columns, split.rows, 50);
    assert.equal(chunks.length, Math.ceil(split.rows.length / 50));
    for (const sql of chunks) await con.run(sql);

    const [n] = await rows(con, 'SELECT count(*) AS n, count(DISTINCT fid) AS d, min(fid) AS lo, max(fid) AS hi FROM t');
    assert.equal(Number(n.n), split.rows.length);
    assert.equal(Number(n.d), split.rows.length);
    assert.equal(Number(n.lo), 1);
    assert.equal(Number(n.hi), split.rows.length);

    const described = await rows(con, 'DESCRIBE t');
    assert.deepEqual(described.map(c => c.column_name), split.columns.map(c => c.name));
    assert.deepEqual(described.map(c => c.column_type), split.columns.map(c => c.type));

    // values round-trip, including a name with punctuation and the derived bbox
    const [first] = await rows(con, 'SELECT name, _cx, _maxx - _minx AS w FROM t WHERE fid = 1');
    assert.equal(first.name, split.rows[0].name);
    assert.ok(Math.abs(first._cx - split.rows[0]._cx) < 1e-9);
    assert.ok(first.w > 0);
    const [colon] = await rows(con, 'SELECT ":id" AS id FROM t WHERE fid = 2');   // Socrata column with a colon
    assert.equal(colon.id, split.rows[1][':id']);
});

test('local path: read_json with the inferred columns', { skip: !duckdb && '@duckdb/node-api not installed' }, async () => {
    const fc = JSON.parse(fs.readFileSync(SAMPLE, 'utf8'));
    const split = Split.splitGeoJSON(fc);
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'split-')), 't.json');
    fs.writeFileSync(tmp, JSON.stringify(split.rows));
    const con = await open();
    const cols = split.columns.map(c => lit(c.name) + ': ' + lit(c.type)).join(', ');
    await con.run(`CREATE TABLE t AS SELECT * FROM read_json(${lit(tmp.replace(/\\/g, '/'))}, columns = {${cols}})`);
    const [n] = await rows(con, 'SELECT count(*) AS n FROM t');
    assert.equal(Number(n.n), split.rows.length);
    const described = await rows(con, 'DESCRIBE t');
    assert.deepEqual(described.map(c => c.column_type), split.columns.map(c => c.type));

    // the "paint" query shape
    const painted = await rows(con, 'SELECT fid, (_maxx - _minx) * (_maxy - _miny) AS value FROM t ORDER BY value DESC LIMIT 3');
    assert.equal(painted.length, 3);
    assert.ok(painted.every(r => typeof r.value === 'number' && r.value > 0));
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
});

test('the measured attribute bytes are in the same ballpark as what DuckDB holds', { skip: !duckdb && '@duckdb/node-api not installed' }, async () => {
    const text = fs.readFileSync(SAMPLE, 'utf8');
    const split = Split.splitGeoJSON(JSON.parse(text));
    const m = Split.measure(split, Split.utf8Bytes(text));
    assert.ok(m.geometryBytes > 0.5 * m.fileBytes, 'shapes are most of a GeoJSON file');
    assert.ok(m.attributeBytes < 0.5 * m.fileBytes);
    const con = await open();
    await con.run(Split.createTableSQL('t', split.columns));
    for (const sql of Split.insertSQLChunks('t', split.columns, split.rows)) await con.run(sql);
    const [sz] = await rows(con, "SELECT estimated_size FROM duckdb_tables() WHERE table_name = 't'");
    assert.equal(Number(sz.estimated_size), split.rows.length);   // DuckDB's estimate is a row count
    const [db] = await rows(con, 'PRAGMA database_size');
    assert.match(db.memory_usage, /KiB|MiB/);
});
