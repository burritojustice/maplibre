#!/usr/bin/env node
// Build a DuckDB file that duckdb-tileserver can serve, from one or more
// GeoJSON (or GeoPackage, Shapefile, Parquet with geometry) files.
//
//   node scripts/build-tiles-db.js out.db ../selecter/geojson/SF_city_data/SF_Analysis_Neighborhoods.geojson [more files…]
//   duckdb-tileserver --database-path out.db      # then http://localhost:9000/layers
//
// Each file becomes a table named after it (lower-cased, non-word characters
// to underscores) with every property column, a `fid` integer, and a `geom`
// GEOMETRY column in EPSG:4326, plus an R-tree index. The tileserver reads
// the file read-only, so stop it before rebuilding.
//
// Needs @duckdb/node-api (`npm install` in duckdb-spike/) and network access
// the first time, to INSTALL the spatial extension.
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { DuckDBInstance } = require('@duckdb/node-api');

const [, , out, ...inputs] = process.argv;
if (!out || !inputs.length) {
    console.error('usage: node scripts/build-tiles-db.js <out.db> <file.geojson> [more files…]');
    process.exit(2);
}
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";
const ident = s => '"' + String(s).replace(/"/g, '""') + '"';
const tableName = f => path.basename(f).replace(/\.[^.]+$/, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();

(async () => {
    for (const f of [out, out + '.wal']) if (fs.existsSync(f)) fs.unlinkSync(f);
    const instance = await DuckDBInstance.create(out);
    const con = await instance.connect();
    await con.run('INSTALL spatial; LOAD spatial;');

    for (const input of inputs) {
        const table = tableName(input);
        const src = lit(path.resolve(input).replace(/\\/g, '/'));
        const t0 = Date.now();
        // ST_Read gives every property plus `geom`; row_number() becomes fid.
        await con.run(`CREATE OR REPLACE TABLE ${ident(table)} AS
            SELECT CAST(row_number() OVER () AS INTEGER) AS fid, * FROM ST_Read(${src})`);
        await con.run(`CREATE INDEX ${ident(table + '_geom_idx')} ON ${ident(table)} USING RTREE (geom)`);
        const [info] = (await con.runAndReadAll(`SELECT count(*) AS n, ST_GeometryType(ANY_VALUE(geom)) AS gt FROM ${ident(table)}`)).getRowObjects();
        const cols = (await con.runAndReadAll(`DESCRIBE ${ident(table)}`)).getRowObjects();
        console.log(`${table}: ${info.n} rows, ${cols.length} columns, ${String(info.gt)}, ${Date.now() - t0} ms`);
        console.log('  ' + cols.map(c => c.column_name + ' ' + c.column_type).join(', '));
    }
    await con.run('CHECKPOINT');
    con.closeSync();
    instance.closeSync();
    console.log(`wrote ${out} (${(fs.statSync(out).size / 1048576).toFixed(2)} MB)`);
})().catch(e => { console.error(e.message); process.exit(1); });
