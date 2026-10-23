// engine.js: one interface over two DuckDB engines.
//
//   openLocal()            DuckDB-WASM in a worker in this tab (jsDelivr)
//   openMotherDuck(token)  @motherduck/wasm-client, assets from app.motherduck.com
//
// Both return { kind, label, query(sql), exec(sql), loadSplit(table, split),
// loadFile(table, file) }. query() resolves to { columns, rows } with plain
// JS values (BigInt and DuckDB date objects become Number / String).
//
// This is the only ES module in the spike. DuckDB-WASM and the MotherDuck
// client ship as ES modules only, so a `<script type="module">` is the
// price of no build step.

const DUCKDB_VERSION = '1.33.1-dev57.0';   // same build Mosaic 0.34 pins, so the chart can share the instance
const DUCKDB_ESM = `https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${DUCKDB_VERSION}/+esm`;
const MD_ESM = 'https://cdn.jsdelivr.net/npm/@motherduck/wasm-client@1.5.6-r.1/+esm';

const quote = s => '"' + String(s).replace(/"/g, '""') + '"';
const lit = s => "'" + String(s).replace(/'/g, "''") + "'";

function plain(v) {
    if (typeof v === 'bigint') return Number(v);
    if (v === null || v === undefined || typeof v !== 'object') return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v.toString === 'function' && v.toString !== Object.prototype.toString) return v.toString();
    return JSON.stringify(v);
}

function fromArrow(table) {
    const columns = table.schema.fields.map(f => f.name);
    const rows = [];
    for (const r of table) {
        const o = {};
        for (const c of columns) o[c] = plain(r[c]);
        rows.push(o);
    }
    return { columns, rows };
}

const sizeMB = text => (new Blob([text]).size / 1048576).toFixed(1) + ' MB';

export async function openLocal({ log = false, onStatus = () => {} } = {}) {
    onStatus('loading DuckDB-WASM ' + DUCKDB_VERSION);
    const duckdb = await import(DUCKDB_ESM);
    const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
    const workerUrl = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    const db = new duckdb.AsyncDuckDB(log ? new duckdb.ConsoleLogger() : new duckdb.VoidLogger(), worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    URL.revokeObjectURL(workerUrl);
    const conn = await db.connect();
    const bundleName = bundle.mainModule.split('/').pop().replace(/^duckdb-|\.wasm$/g, '');
    onStatus('DuckDB-WASM ready (' + bundleName + ' bundle)');

    return {
        kind: 'local', label: 'DuckDB-WASM ' + DUCKDB_VERSION + ' / ' + bundleName,
        duckdb, db, conn,
        async query(sql) { return fromArrow(await conn.query(sql)); },
        async exec(sql) { await conn.query(sql); },

        // The fast path: register the rows as a JSON file and let read_json
        // build the table with the types the split inferred.
        async loadSplit(table, split) {
            const name = table + '.json';
            const text = JSON.stringify(split.rows);
            onStatus('registering ' + name + ' (' + sizeMB(text) + ')');
            await db.registerFileText(name, text);
            const cols = split.columns.map(c => lit(c.name) + ': ' + lit(c.type)).join(', ');
            await conn.query(`CREATE OR REPLACE TABLE ${quote(table)} AS SELECT * FROM read_json(${lit(name)}, columns = {${cols}}, maximum_object_size = 268435456)`);
            await db.dropFile(name).catch(() => {});
        },

        // CSV, Parquet or JSON without geometry: DuckDB reads the bytes directly.
        async loadFile(table, file) {
            const name = file.name.replace(/[^\w.-]/g, '_');
            onStatus('registering ' + name + ' (' + (file.size / 1048576).toFixed(1) + ' MB)');
            await db.registerFileBuffer(name, new Uint8Array(await file.arrayBuffer()));
            const reader = /\.parquet$/i.test(name) ? 'read_parquet' : /\.json(l|ld)?$/i.test(name) ? 'read_json_auto' : 'read_csv_auto';
            await conn.query(`CREATE OR REPLACE TABLE ${quote(table)} AS SELECT * FROM ${reader}(${lit(name)})`);
            await db.dropFile(name).catch(() => {});
        },
    };
}

export async function openMotherDuck(token, { onStatus = () => {} } = {}) {
    onStatus('loading MotherDuck client');
    const { MDConnection } = await import(MD_ESM);
    const connection = MDConnection.create({ mdToken: token });
    await connection.isInitialized();
    onStatus('MotherDuck ready');

    async function evaluate(sql) {
        const r = await connection.evaluateQuery(sql);
        const d = r.data;
        const columns = d.columnNames();
        const rows = d.toRows().map(row => { const o = {}; for (const c of columns) o[c] = plain(row[c]); return o; });
        return { columns, rows };
    }

    return {
        kind: 'motherduck', label: 'MotherDuck (wasm-client 1.5.6)',
        connection,
        query: evaluate,
        async exec(sql) { await connection.evaluateQuery(sql); },

        // No file registration here, so rows go up as JSON literals, a few
        // thousand per INSERT. Slower than the local path; fine for a spike.
        async loadSplit(table, split, Split) {
            await connection.evaluateQuery(Split.createTableSQL(table, split.columns));
            const chunks = Split.insertSQLChunks(table, split.columns, split.rows, 2000);
            for (let i = 0; i < chunks.length; i++) {
                onStatus(`inserting rows into MotherDuck, chunk ${i + 1} / ${chunks.length}`);
                await connection.evaluateQuery(chunks[i]);
            }
        },

        async loadFile() {
            throw new Error('The MotherDuck client cannot read a local file. Upload GeoJSON (split in the browser), or load the file into MotherDuck from app.motherduck.com and query it here.');
        },
    };
}
