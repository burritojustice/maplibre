// Split: separate an uploaded GeoJSON into shapes (kept in browser memory)
// and a properties table (sent to DuckDB). The only thing the two halves
// share is `fid`, a sequential integer.
//
// Plain JavaScript, no dependencies, no DOM. Loads as a script tag
// (window.Split) or in Node (require), same as JoinKit.
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Split = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ---- type inference -------------------------------------------------
    // Reads every value of a column and decides the narrowest DuckDB type
    // that holds all of them. Nulls and empty strings are ignored.
    function inferType(values) {
        let seen = 0, ints = 0, nums = 0, bools = 0, bigints = 0;
        for (const v of values) {
            if (v === null || v === undefined || v === '') continue;
            seen++;
            if (typeof v === 'boolean') { bools++; continue; }
            if (typeof v === 'number') {
                if (Number.isFinite(v)) { nums++; if (Number.isInteger(v)) { ints++; if (Math.abs(v) > 2147483647) bigints++; } }
                continue;
            }
            if (typeof v === 'string') {
                const s = v.trim();
                if (s === 'true' || s === 'false') { bools++; continue; }
                if (/^-?\d+$/.test(s)) { nums++; ints++; if (Math.abs(Number(s)) > 2147483647) bigints++; continue; }
                if (/^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) { nums++; continue; }
            }
            return 'VARCHAR';   // objects, arrays, mixed text
        }
        if (seen === 0) return 'VARCHAR';
        if (bools === seen) return 'BOOLEAN';
        if (nums === seen) {
            if (ints === seen) return bigints ? 'BIGINT' : 'INTEGER';
            return 'DOUBLE';
        }
        return 'VARCHAR';
    }

    function coerce(v, type) {
        if (v === null || v === undefined || v === '') return null;
        switch (type) {
            case 'BOOLEAN': return typeof v === 'boolean' ? v : String(v).trim() === 'true';
            case 'INTEGER': case 'BIGINT': case 'DOUBLE': return typeof v === 'number' ? v : Number(String(v).trim());
            default: return typeof v === 'string' ? v : JSON.stringify(v);
        }
    }

    // ---- geometry helpers ------------------------------------------------
    function walkCoords(geom, fn) {
        if (!geom) return;
        if (geom.type === 'GeometryCollection') { for (const g of geom.geometries || []) walkCoords(g, fn); return; }
        const rec = c => { if (typeof c[0] === 'number') fn(c); else for (const d of c) rec(d); };
        if (geom.coordinates) rec(geom.coordinates);
    }

    function bboxOf(geom) {
        let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity, n = 0;
        walkCoords(geom, c => { n++; if (c[0] < minx) minx = c[0]; if (c[0] > maxx) maxx = c[0]; if (c[1] < miny) miny = c[1]; if (c[1] > maxy) maxy = c[1]; });
        return n ? [minx, miny, maxx, maxy] : null;
    }

    const DERIVED = ['_minx', '_miny', '_maxx', '_maxy', '_cx', '_cy'];

    // ---- the split -------------------------------------------------------
    // splitGeoJSON(fc, opts) -> { geometry, rows, columns, stats }
    //   geometry : FeatureCollection; each feature has id = fid and
    //              properties = { _gvid: fid } (JoinKit's id property)
    //   rows     : array of plain objects, fid first, typed per `columns`
    //   columns  : [{ name, type, source }]  type is a DuckDB type;
    //              source is 'id', 'property' or 'derived'
    //   stats    : counts, geometry types, overall bbox
    // opts.startId    first fid (default 1)
    // opts.derived    add bbox and centre columns (default true)
    // opts.keepProps  property names to also keep on the geometry side
    //                 (e.g. a display name), default none
    function splitGeoJSON(fc, opts) {
        opts = opts || {};
        const startId = opts.startId || 1;
        const derived = opts.derived !== false;
        const keep = new Set(opts.keepProps || []);
        const features = fc && fc.type === 'FeatureCollection' ? fc.features
            : fc && fc.type === 'Feature' ? [fc] : [];

        // column order: first appearance across all features
        const names = [];
        const nameSet = new Set();
        for (const f of features) {
            for (const k in (f.properties || {})) if (!nameSet.has(k)) { nameSet.add(k); names.push(k); }
        }

        const geometry = { type: 'FeatureCollection', features: new Array(features.length) };
        const raw = names.map(() => new Array(features.length));
        const geomTypes = {};
        const bb = [Infinity, Infinity, -Infinity, -Infinity];
        const derivedCols = derived ? DERIVED.map(() => new Array(features.length)) : null;

        features.forEach((f, i) => {
            const fid = startId + i;
            const props = f.properties || {};
            const gprops = { _gvid: fid };
            for (const k of keep) if (k in props) gprops[k] = props[k];
            geometry.features[i] = { type: 'Feature', id: fid, geometry: f.geometry, properties: gprops };
            const gt = f.geometry ? f.geometry.type : 'null';
            geomTypes[gt] = (geomTypes[gt] || 0) + 1;
            names.forEach((k, c) => { raw[c][i] = k in props ? props[k] : null; });
            if (derived) {
                const b = bboxOf(f.geometry);
                if (b) {
                    derivedCols[0][i] = b[0]; derivedCols[1][i] = b[1]; derivedCols[2][i] = b[2]; derivedCols[3][i] = b[3];
                    derivedCols[4][i] = (b[0] + b[2]) / 2; derivedCols[5][i] = (b[1] + b[3]) / 2;
                    if (b[0] < bb[0]) bb[0] = b[0]; if (b[1] < bb[1]) bb[1] = b[1];
                    if (b[2] > bb[2]) bb[2] = b[2]; if (b[3] > bb[3]) bb[3] = b[3];
                } else for (let d = 0; d < 6; d++) derivedCols[d][i] = null;
            }
        });

        const columns = [{ name: 'fid', type: 'INTEGER', source: 'id' }];
        const types = names.map((k, c) => inferType(raw[c]));
        names.forEach((k, c) => columns.push({ name: k, type: types[c], source: 'property' }));
        if (derived) for (const d of DERIVED) columns.push({ name: d, type: 'DOUBLE', source: 'derived' });

        const rows = new Array(features.length);
        for (let i = 0; i < features.length; i++) {
            const r = { fid: startId + i };
            names.forEach((k, c) => { r[k] = coerce(raw[c][i], types[c]); });
            if (derived) DERIVED.forEach((d, j) => { r[d] = derivedCols[j][i]; });
            rows[i] = r;
        }

        return {
            geometry, rows, columns,
            stats: {
                features: features.length,
                propertyColumns: names.length,
                geometryTypes: geomTypes,
                bbox: isFinite(bb[0]) ? bb : null,
            },
        };
    }

    // ---- SQL helpers ----------------------------------------------------
    function quoteIdent(name) { return '"' + String(name).replace(/"/g, '""') + '"'; }

    function createTableSQL(table, columns) {
        return 'CREATE OR REPLACE TABLE ' + quoteIdent(table) + ' (' +
            columns.map(c => quoteIdent(c.name) + ' ' + c.type).join(', ') + ')';
    }

    // DuckDB turns a JSON array of objects into rows with from_json. This
    // builds INSERT statements of `chunk` rows each, with the JSON as a
    // dollar-quoted string literal, so it works on engines with no file
    // registration (the MotherDuck client) as well as locally.
    function insertSQLChunks(table, columns, rows, chunk) {
        chunk = chunk || 2000;
        const structure = '[' + JSON.stringify(Object.fromEntries(columns.map(c => [c.name, c.type]))) + ']';
        const cols = columns.map(c => quoteIdent(c.name)).join(', ');
        const out = [];
        for (let i = 0; i < rows.length; i += chunk) {
            const json = JSON.stringify(rows.slice(i, i + chunk));
            let tag = '$j$';
            while (json.includes(tag)) tag = '$j' + Math.random().toString(36).slice(2, 6) + '$';
            out.push('INSERT INTO ' + quoteIdent(table) + ' (' + cols + ') ' +
                'SELECT ' + columns.map(c => 'r.' + quoteIdent(c.name)).join(', ') +
                ' FROM (SELECT unnest(from_json(' + tag + json + tag + '::JSON, ' +
                "'" + structure.replace(/'/g, "''") + "')) AS r)");
        }
        return out;
    }

    // ---- sizes ----------------------------------------------------------
    // How many bytes each half of the split takes, measured as the JSON text
    // that would carry it: the geometry side is what the browser keeps (and
    // sends to MapLibre), the attribute side is what goes to DuckDB.
    // measure(split, fileBytes) -> { fileBytes, geometryBytes, attributeBytes,
    //   coordinates, columns: [{ name, type, source, bytes, nulls }], overhead }
    // `overhead` is file bytes not accounted for by either side (whitespace,
    // the original property names repeated per feature, etc).
    function utf8Bytes(s) {
        let n = 0;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            n += c < 0x80 ? 1 : c < 0x800 ? 2 : (c >= 0xd800 && c < 0xdc00) ? (i++, 4) : 3;
        }
        return n;
    }

    function measure(split, fileBytes) {
        let coordinates = 0;
        for (const f of split.geometry.features) walkCoords(f.geometry, () => { coordinates++; });
        const geometryBytes = utf8Bytes(JSON.stringify(split.geometry));
        const rows = split.rows || [];
        const columns = split.columns.map(c => {
            let bytes = 0, nulls = 0;
            for (const r of rows) {
                const v = r[c.name];
                if (v === null || v === undefined) { nulls++; bytes += 4; }
                else bytes += utf8Bytes(JSON.stringify(v));
            }
            return { name: c.name, type: c.type, source: c.source, bytes, nulls };
        });
        const attributeBytes = utf8Bytes(JSON.stringify(rows));
        const propertyBytes = columns.filter(c => c.source === 'property').reduce((a, c) => a + c.bytes, 0);
        return {
            fileBytes: fileBytes || null, geometryBytes, attributeBytes, propertyBytes, coordinates, columns,
            overhead: fileBytes ? Math.max(0, fileBytes - geometryBytes - propertyBytes) : null,
        };
    }

    function formatBytes(b) {
        if (b === null || b === undefined) return '';
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(b < 10240 ? 1 : 0) + ' KB';
        return (b / 1048576).toFixed(b < 10485760 ? 2 : 1) + ' MB';
    }

    // Column names that are safe to sum or average: numeric and not an id.
    function numericColumns(columns) {
        return columns.filter(c => c.source === 'property' && /INTEGER|BIGINT|DOUBLE/.test(c.type)
            && !/^(id|fid|objectid|gid|zip|fips|geoid|year|phone)$/i.test(c.name)).map(c => c.name);
    }

    return { splitGeoJSON, inferType, coerce, bboxOf, quoteIdent, createTableSQL, insertSQLChunks, numericColumns, measure, formatBytes, utf8Bytes, DERIVED };
}));
