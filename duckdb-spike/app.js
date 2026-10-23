// app.js: wires the page together. Shapes live in MapLibre sources; every
// attribute lives in a DuckDB table; `fid` is the only link between them.
import { openLocal, openMotherDuck } from './engine.js';

const $ = id => document.getElementById(id);
const PALETTE = ['#f1eef6', '#bdc9e1', '#74a9cf', '#2b8cbe', '#045a8d', '#023858', '#01223d'];
const NO_DATA = '#d9d9d9';

const state = {
    engine: null,
    layers: {},          // id -> { id, kind: 'geojson'|'tiles', table, sourceId, sourceLayer, idProp, columns, geomTypes }
    mosaic: null,
    nextLayer: 1,
};

// ---- status -----------------------------------------------------------
const statusEl = $('status');
let t0 = 0;
function status(msg, err) {
    statusEl.textContent = msg + (t0 ? '  (' + (performance.now() - t0).toFixed(0) + ' ms)' : '');
    statusEl.classList.toggle('err', !!err);
    if (err) console.error(err);
}
async function timed(label, fn) {
    t0 = performance.now();
    try { const r = await fn(); status(label + ' done'); t0 = 0; return r; }
    catch (e) { status(label + ' failed: ' + (e.message || e), e); t0 = 0; throw e; }
}

// ---- map --------------------------------------------------------------
const map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/positron',   // free, no key
    center: [-122.44, 37.76], zoom: 11,
});
map.addControl(new maplibregl.NavigationControl(), 'top-right');
window.map = map;   // for poking at it from the console

const fillColor = ['coalesce', ['feature-state', 'color'], NO_DATA];
function addStyleLayers(L) {
    const src = L.sourceId, sl = L.sourceLayer ? { 'source-layer': L.sourceLayer } : {};
    map.addLayer({ id: L.id + '-fill', type: 'fill', source: src, ...sl, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': fillColor, 'fill-opacity': 0.65 } });
    map.addLayer({ id: L.id + '-outline', type: 'line', source: src, ...sl, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': '#fff', 'line-width': 0.6 } });
    map.addLayer({ id: L.id + '-line', type: 'line', source: src, ...sl, filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': fillColor, 'line-width': 2.5 } });
    map.addLayer({ id: L.id + '-point', type: 'circle', source: src, ...sl, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': fillColor, 'circle-radius': 5, 'circle-stroke-color': '#fff', 'circle-stroke-width': 0.8 } });
    for (const suffix of ['-fill', '-line', '-point']) {
        map.on('mousemove', L.id + suffix, e => hover(L, e.features[0]));
        map.on('mouseleave', L.id + suffix, () => { $('hover').style.display = 'none'; hoverLast = null; });
    }
}

function registerLayer(L) {
    state.layers[L.id] = L;
    const sel = $('target');
    if (sel.options[0].value === '') sel.innerHTML = '';
    sel.add(new Option(L.id + (L.table ? ' → ' + L.table : ''), L.id));
    sel.value = L.id;
    $('btn-run').disabled = !state.engine;
}

// ---- hover: the feature carries only its id; attributes come from SQL ----
let hoverTimer = null, hoverLast = null;
function hover(L, f) {
    const box = $('hover');
    const id = f.id;
    if (L.kind === 'tiles') {
        box.style.display = 'block';
        box.textContent = Object.entries(f.properties).map(([k, v]) => k + ': ' + v).join('\n');
        return;
    }
    if (hoverLast === id) return;
    hoverLast = id;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(async () => {
        if (!state.engine) return;
        try {
            const r = await state.engine.query(`SELECT * FROM "${L.table}" WHERE fid = ${Number(id)}`);
            if (hoverLast !== id) return;   // a newer hover started while this query ran
            box.style.display = 'block';
            const st = f.state || {};
            box.textContent = (st.value !== undefined ? 'value: ' + st.value + '\n' : '') +
                (r.rows[0] ? Object.entries(r.rows[0]).map(([k, v]) => k + ': ' + v).join('\n') : 'fid ' + id + ' not in table');
        } catch (e) { box.textContent = e.message; }
    }, 60);
}

// ---- engine -----------------------------------------------------------
function setEngine(engine) {
    state.engine = engine;
    state.mosaic = null;
    $('chart').innerHTML = '';
    $('engine-label').textContent = engine.label;
    $('btn-run').disabled = !Object.keys(state.layers).length;
    $('btn-chart').disabled = engine.kind !== 'local';
}

$('btn-local').onclick = () => timed('open local engine', async () => setEngine(await openLocal({ onStatus: status })));

$('md-token').value = sessionStorage.getItem('md-token') || '';
$('btn-md').onclick = () => timed('connect MotherDuck', async () => {
    const token = $('md-token').value.trim();
    if (!token) throw new Error('paste a MotherDuck access token first');
    sessionStorage.setItem('md-token', token);
    const engine = await openMotherDuck(token, { onStatus: status });
    setEngine(engine);
    const dbs = await engine.query('SHOW DATABASES');
    $('engine-label').textContent = engine.label + ' · ' + dbs.rows.map(r => r.database_name).join(', ');
});

// ---- upload -----------------------------------------------------------
// A second upload with the same name gets t_2, so an older layer keeps its own table.
function tableName(f) {
    const base = f.replace(/\.[^.]+$/, '').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'upload';
    const used = new Set(Object.values(state.layers).map(L => L.table));
    let name = base, n = 1;
    while (used.has(name)) name = base + '_' + (++n);
    return name;
}

async function loadGeoJSON(name, fc, fileBytes) {
    if (!state.engine) throw new Error('open an engine first (step 1)');
    const table = tableName(name);
    const split = await timed('split ' + name, async () => Split.splitGeoJSON(fc));
    const s = split.stats;
    const sizes = Split.measure(split, fileBytes);
    $('split-stats').textContent = `${s.features} features (${Object.entries(s.geometryTypes).map(([k, v]) => k + ' ' + v).join(', ')}), ${s.propertyColumns} property columns → table "${table}"`;

    const id = 'L' + state.nextLayer++;
    map.addSource(id, { type: 'geojson', data: split.geometry });   // geometry + fid only
    const L = { id, kind: 'geojson', table, sourceId: id, columns: split.columns, geomTypes: s.geometryTypes };
    addStyleLayers(L);
    registerLayer(L);
    if (s.bbox) map.fitBounds([[s.bbox[0], s.bbox[1]], [s.bbox[2], s.bbox[3]]], { padding: 30, duration: 0 });

    await timed('load ' + split.rows.length + ' rows into ' + state.engine.kind, () => state.engine.loadSplit(table, split, Split));
    split.rows = null;   // the table owns the attributes now
    await showSchema(table);
    await renderSizes(sizes, table);
    const numeric = Split.numericColumns(L.columns);
    $('sql').value = numeric.length
        ? `SELECT fid, "${numeric[0]}" AS value FROM "${table}"`
        : `-- no numeric property; bbox area from the derived columns\nSELECT fid, (_maxx - _minx) * (_maxy - _miny) AS value FROM "${table}"`;
}

async function loadTabular(file) {
    if (!state.engine) throw new Error('open an engine first (step 1)');
    const table = tableName(file.name);
    await timed('load ' + file.name, () => state.engine.loadFile(table, file));
    $('split-stats').textContent = `no geometry: "${table}" is a plain table. Join it to a layer by key, e.g. SELECT t.key AS fid, t.x AS value FROM "${table}" t`;
    await showSchema(table);
    await renderSizes({ fileBytes: file.size, geometryBytes: 0, attributeBytes: file.size, propertyBytes: file.size, coordinates: 0, columns: [], overhead: 0 }, table);
}

// ---- where the bytes went: file → shapes in the browser | attributes in DuckDB ----
async function duckdbMemory(table) {
    try {
        const [db] = (await state.engine.query('PRAGMA database_size')).rows;
        const [t] = (await state.engine.query(`SELECT estimated_size FROM duckdb_tables() WHERE table_name = '${table.replace(/'/g, "''")}'`)).rows;
        return { memory: db && db.memory_usage, rows: t && t.estimated_size };
    } catch (e) { return { error: e.message }; }
}

async function renderSizes(m, table) {
    const fb = Split.formatBytes;
    // The bar partitions the file: shapes + attribute values + overhead = file bytes.
    // The JSON rows sent to DuckDB are bigger than the values (keys repeat per row).
    const total = m.fileBytes || (m.geometryBytes + m.propertyBytes);
    const parts = [
        { key: 'shapes', label: 'shapes, in the browser', bytes: m.geometryBytes, color: 'var(--series-1)', detail: m.coordinates.toLocaleString() + ' coordinates as GeoJSON, id only' },
        { key: 'attrs', label: 'attribute values, to DuckDB', bytes: m.propertyBytes, color: 'var(--series-2)', detail: m.columns.filter(c => c.source === 'property').length + ' property columns' },
        { key: 'overhead', label: 'file overhead', bytes: m.overhead || 0, color: 'var(--overhead)', detail: 'whitespace and property names repeated per feature' },
    ].filter(p => p.bytes > 0);
    $('sizes').style.display = 'block';
    $('sz-hero').innerHTML = `<b>${fb(m.fileBytes || total)}</b> ${m.fileBytes ? 'file' : 'split'} → <b style="color:var(--series-1)">${fb(m.geometryBytes)}</b> of shapes stay in the browser, <b style="color:var(--series-2)">${fb(m.propertyBytes)}</b> of attribute values go to DuckDB` +
        (m.columns.length ? ` <span style="color:var(--text-secondary)">(${fb(m.attributeBytes)} as JSON rows with keys and derived columns)</span>` : '');
    $('sz-bar').innerHTML = parts.map(p => `<div class="sz-seg" style="flex:${p.bytes} 0 0;background:${p.color}" title="${p.label}: ${fb(p.bytes)} (${(100 * p.bytes / total).toFixed(0)}%) · ${p.detail}"></div>`).join('');
    $('sz-bar').setAttribute('aria-label', parts.map(p => p.label + ' ' + fb(p.bytes)).join(', '));
    $('sz-legend').innerHTML = parts.map(p => `<span><span class="sw" style="background:${p.color}"></span>${p.label} ${fb(p.bytes)} (${(100 * p.bytes / total).toFixed(0)}%)</span>`).join('');

    const cols = m.columns.slice().sort((a, b) => b.bytes - a.bytes);
    const max = Math.max(1, ...cols.map(c => c.bytes));
    $('sz-cols').innerHTML = cols.map(c => {
        const cls = c.source === 'derived' ? ' derived' : '';
        return `<div class="nm${cls}" title="${c.type}${c.nulls ? ', ' + c.nulls + ' nulls' : ''}">${c.name}</div>` +
            `<div class="tr${cls}" title="${c.name}: ${fb(c.bytes)}"><div class="bar" style="width:${(100 * c.bytes / max).toFixed(1)}%"></div></div>` +
            `<div class="val">${fb(c.bytes)}</div>`;
    }).join('');

    const d = await duckdbMemory(table);
    $('sz-note').textContent = d.error ? 'DuckDB size: ' + d.error
        : `DuckDB reports ${d.memory || '?'} in memory for the whole database after loading "${table}" (${d.rows ?? '?'} rows). ` +
          `Bytes above are the JSON text of each half; MapLibre keeps its own tiled copy of the shapes in a worker.`;
}

async function showSchema(table) {
    const d = await state.engine.query(`DESCRIBE "${table}"`);
    const n = await state.engine.query(`SELECT count(*) AS n FROM "${table}"`);
    $('schema').innerHTML = grid(d.columns.slice(0, 2), d.rows, 200) ;
    $('schema').insertAdjacentHTML('afterbegin', `<div><span class="pill">${table}</span> <span class="pill">${n.rows[0].n} rows</span> <span class="pill">${d.rows.length} columns</span></div>`);
    const cc = $('chart-col');
    cc.innerHTML = '';
    for (const r of d.rows) if (/INT|DOUBLE|FLOAT|DECIMAL|HUGEINT/.test(r.column_type)) cc.add(new Option(r.column_name, table + '\u0000' + r.column_name));
}

$('file').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
        if (/\.(geojson|json)$/i.test(file.name)) {
            const text = await file.text();
            const fc = JSON.parse(text);
            if (fc.type === 'FeatureCollection' || fc.type === 'Feature') await loadGeoJSON(file.name, fc, file.size);
            else await loadTabular(file);
        } else await loadTabular(file);
    } catch (err) { status(err.message, err); }
    e.target.value = '';
};

for (const b of document.querySelectorAll('button.sample')) b.onclick = async () => {
    try {
        const url = b.dataset.url;
        const text = await timed('fetch sample', async () => (await fetch(url)).text());
        await loadGeoJSON(url.split('/').pop(), JSON.parse(text), Split.utf8Bytes(text));
    } catch (err) { status(err.message, err); }
};

// ---- query → feature state -------------------------------------------
function grid(columns, rows, max) {
    const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    return '<table class="grid"><tr>' + columns.map(c => '<th>' + esc(c) + '</th>').join('') + '</tr>' +
        rows.slice(0, max).map(r => '<tr>' + columns.map(c => '<td>' + esc(r[c]) + '</td>').join('') + '</tr>').join('') + '</table>' +
        (rows.length > max ? `<div style="color:var(--muted)">… ${rows.length} rows</div>` : '');
}

$('btn-run').onclick = async () => {
    const sql = $('sql').value.trim();
    const L = state.layers[$('target').value];
    if (!sql || !state.engine) return;
    try {
        const r = await timed('query', () => state.engine.query(sql));
        $('result').innerHTML = grid(r.columns, r.rows, 50);
        if (r.columns.includes('fid') && r.columns.includes('value') && L) paint(L, r.rows);
        else $('legend').innerHTML = '';
    } catch (err) { /* status already set */ }
};

function paint(L, rows) {
    const values = rows.map(r => r.value).filter(v => typeof v === 'number' && isFinite(v));
    const cb = JoinKit.classBreaks(values, { method: $('breaks').value, k: 6 });
    const colors = PALETTE.slice(Math.max(0, PALETTE.length - cb.k));
    const src = { source: L.sourceId, ...(L.sourceLayer ? { sourceLayer: L.sourceLayer } : {}) };

    map.removeFeatureState(src);
    const t = performance.now();
    let painted = 0;
    for (const r of rows) {
        const id = L.kind === 'geojson' ? Number(r.fid) : r.fid;
        if (id === null || id === undefined || id === '') continue;
        const cls = cb.classOf(r.value);
        map.setFeatureState({ ...src, id }, { value: r.value, cls, color: cls >= 0 ? colors[cls] : NO_DATA });
        painted++;
    }
    const fmt = v => Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toLocaleString(undefined, { maximumSignificantDigits: 3 });
    $('legend').innerHTML = cb.ranges.map(g => `<div><span class="sw" style="background:${colors[g.cls]}"></span>${fmt(g.lo)} – ${fmt(g.hi)} <span style="color:var(--muted)">(${g.n})</span></div>`).join('') +
        `<div style="color:var(--muted)">${painted} features painted via setFeatureState in ${(performance.now() - t).toFixed(0)} ms; ${cb.method}${cb.log ? ' (log)' : ''}</div>`;
}

// ---- chart: Mosaic vgplot on the same DuckDB-WASM instance ---------------
$('btn-chart').onclick = async () => {
    const v = $('chart-col').value;
    if (!v || !state.engine || state.engine.kind !== 'local') return;
    const [table, col] = v.split('\u0000');
    try {
        const vg = await timed('load vgplot', () => import('https://cdn.jsdelivr.net/npm/@uwdata/vgplot@0.34.0/+esm'));
        if (!state.mosaic) {
            vg.coordinator().databaseConnector(vg.wasmConnector({ duckdb: state.engine.db, connection: state.engine.conn }));
            state.mosaic = vg;
        }
        const el = vg.plot(
            vg.rectY(vg.from(table), { x: vg.bin(col), y: vg.count(), fill: '#2b8cbe', inset: 0.5 }),
            vg.width(340), vg.height(170), vg.marginLeft(50),
        );
        $('chart').innerHTML = '';
        $('chart').appendChild(el);
        status('histogram of ' + col + ' (Mosaic ran the binning in DuckDB)');
    } catch (err) { status('chart failed: ' + err.message, err); }
};

// ---- duckdb-tileserver --------------------------------------------------
const tsBase = () => $('ts-base').value.trim().replace(/\/+$/, '');

$('btn-ts-layers').onclick = async () => {
    try {
        const layers = await timed('GET /layers', async () => (await fetch(tsBase() + '/layers')).json());
        const sel = $('ts-layer');
        sel.innerHTML = '';
        // duckdb-tileserver: { layers: [{ name, table, geometry_column, geometry_type, srid, bounds, properties }] }
        const list = Array.isArray(layers) ? layers : layers.layers || Object.values(layers);
        state.tsLayers = {};
        for (const l of list) {
            const name = typeof l === 'string' ? l : l.name || l.id || l.layer;
            state.tsLayers[name] = l;
            sel.add(new Option(name + (l.geometry_type ? ' (' + l.geometry_type + ')' : ''), name));
        }
        $('btn-ts-add').disabled = !list.length;
        sel.onchange = () => {
            const l = state.tsLayers[sel.value] || {};
            const props = l.properties || [];
            $('ts-idprop').value = props.find(p => /^(id|fid|objectid|gid|_gvid)$/i.test(p)) || props.find(p => /id$/i.test(p)) || '';
            $('ts-info').textContent = `${l.table || sel.value}: ${props.length ? props.join(', ') : 'no properties listed'}`;
        };
        sel.onchange();
    } catch (err) { status('tileserver unreachable at ' + tsBase() + ': ' + err.message, err); }
};

$('btn-ts-add').onclick = async () => {
    const layer = $('ts-layer').value, idProp = $('ts-idprop').value.trim();
    if (!layer) return;
    try {
        const tj = await timed('GET /tiles/' + layer + '.json', async () => (await fetch(`${tsBase()}/tiles/${layer}.json`)).json());
        const id = 'T' + state.nextLayer++;
        const sourceLayer = (tj.vector_layers && tj.vector_layers[0] && tj.vector_layers[0].id) || layer;
        map.addSource(id, {
            type: 'vector',
            tiles: tj.tiles && tj.tiles.length ? tj.tiles : [`${tsBase()}/tiles/${layer}/{z}/{x}/{y}.mvt`],
            minzoom: tj.minzoom ?? 0, maxzoom: tj.maxzoom ?? 22,
            ...(idProp ? { promoteId: idProp } : {}),
        });
        const L = { id, kind: 'tiles', table: null, sourceId: id, sourceLayer, idProp };
        addStyleLayers(L);
        registerLayer(L);
        if (tj.bounds) map.fitBounds([[tj.bounds[0], tj.bounds[1]], [tj.bounds[2], tj.bounds[3]]], { padding: 30, duration: 0 });
        const fields = tj.vector_layers && tj.vector_layers[0] && tj.vector_layers[0].fields;
        $('ts-info').textContent = `source-layer "${sourceLayer}"` + (fields ? '; fields: ' + Object.keys(fields).join(', ') : '') +
            (idProp ? `; paint it with SELECT <key> AS fid, <x> AS value FROM <table>` : '; set an id property to paint from SQL');
    } catch (err) { status('could not add layer: ' + err.message, err); }
};

window.spike = { state, loadGeoJSON, loadTabular, paint };   // console access for poking and tests
status('ready. Open an engine, then upload or pick a sample.' + (window.crossOriginIsolated ? ' (cross-origin isolated)' : ' (not cross-origin isolated)'));
