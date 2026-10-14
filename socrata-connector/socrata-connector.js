/**
 * SocrataConnector - load any Socrata Open Data portal (SODA 2.1 / SoQL), e.g.
 * https://data.sf.gov, as a GeoJSON source for MapLibre GL JS. No build step,
 * no dependencies beyond `fetch`.
 *
 *   const { portal, id } = SocrataConnector.parseUrl('https://data.sf.gov/d/tkzw-k3nq');
 *   const connector = new SocrataConnector(portal);
 *   const schema = await connector.fetchSchema(id);          // columns + detected geometry
 *   addSocrataLayer(map, connector, id, { geometry: schema.geometry });
 *
 * Geometry spec (the `geometry` option everywhere below) is one of:
 *   'location'                                  field name; value sniffed per row
 *   { field: 'location', spatial: true }        Socrata point/line/polygon column (bbox via within_box)
 *   { field: 'point', spatial: false }          text column holding WKT (no server-side bbox)
 *   { lat: 'latitude', lon: 'longitude' }       two numeric columns (bbox via BETWEEN)
 * The old `geometryField` option is still accepted as an alias for a field-name spec.
 */

const SPATIAL_TYPES = new Set(['point', 'location', 'multipoint', 'line', 'multiline', 'polygon', 'multipolygon']);
// GeoJSON geometry type names (what a sample row's value says) -> Socrata dataTypeName
const GEOJSON_TO_SOCRATA = {
  point: 'point', multipoint: 'multipoint', linestring: 'line', multilinestring: 'multiline',
  polygon: 'polygon', multipolygon: 'multipolygon',
};
const LAT_NAMES = ['latitude', 'lat', 'y_lat', 'lat_y', 'point_y', 'y'];
const LON_NAMES = ['longitude', 'lon', 'lng', 'long', 'x_long', 'long_x', 'point_x', 'x'];

class SocrataConnector {
  // Only the classic X-App-Token string works from a browser. Socrata's newer API key
  // ID/secret pair (HTTP Basic Auth) is CORS-blocked cross-origin - its preflight omits
  // Access-Control-Allow-Headers for Authorization, unlike X-App-Token - so it only works
  // from server-side code (see the Python client in the same PR).
  // `log`: true for console.info output prefixed [socrata], a function to receive
  // (message, ...details), or false/omitted for silence.
  constructor(portalBaseUrl, { appToken, log } = {}) {
    let base = String(portalBaseUrl).trim();
    if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
    this.portalBaseUrl = base.replace(/\/+$/, '');
    this.appToken = appToken || null;
    this.log = typeof log === 'function' ? log
      : log ? (msg, ...rest) => console.info(`[socrata] ${msg}`, ...rest)
      : () => {};
  }

  // ── URL parsing ────────────────────────────────────────────────────────────

  /**
   * Pull the portal + dataset id (the "4x4", e.g. tkzw-k3nq) out of any Socrata URL:
   *   https://data.sf.gov/City-Infrastructure/San-Francisco-Street-Tree-Inventory/tkzw-k3nq/about_data
   *   https://data.sf.gov/d/tkzw-k3nq
   *   https://data.sf.gov/resource/tkzw-k3nq.json?$where=...&$limit=500
   *   https://data.sf.gov/api/views/tkzw-k3nq
   *   data.cityofchicago.org/resource/ijzp-q8t2.geojson   (scheme optional)
   * SoQL params on a /resource/ URL ($where, $select, $order, $limit) are carried over.
   * Returns null if no dataset id is found.
   */
  static parseUrl(input) {
    if (!input) return null;
    let s = String(input).trim();
    s = s.replace(/^(https?):\/+/i, '$1://'); // repair "https:/host" (paths can collapse //)
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    let u;
    try { u = new URL(s); } catch { return null; }
    const ids = u.pathname.match(/\b[a-z0-9]{4}-[a-z0-9]{4}\b/gi);
    if (!ids) return null;
    const query = {};
    for (const key of ['where', 'select', 'order', 'limit']) {
      const v = u.searchParams.get(`$${key}`);
      if (v) query[key] = key === 'limit' ? Number(v) : v;
    }
    return { portal: `${u.protocol}//${u.host}`, id: ids[ids.length - 1].toLowerCase(), query };
  }

  // ── Schema + geometry detection ────────────────────────────────────────────

  /**
   * Fetch column metadata from /api/views/{id}.json, merge in whatever a few sample rows
   * actually contain, and detect geometry candidates. Metadata can be missing (CORS,
   * private), or present but useless: map and derived views often list no columns, or
   * columns whose names differ from what /resource/ returns. So the sample rows are the
   * ground truth for which fields exist; metadata only adds types and display names.
   * Returns { name, columns: [{field, type, name}], candidates: [spec...], geometry, permalink, meta }.
   */
  async fetchSchema(resourceId, { signal } = {}) {
    let name = resourceId;
    let metaColumns = [];
    const meta = { status: null, viewType: null, displayType: null, columnCount: 0 };
    try {
      const res = await fetch(`${this.portalBaseUrl}/api/views/${resourceId}.json`, { headers: this._headers(), signal });
      meta.status = res.status;
      if (res.ok) {
        const m = await res.json();
        name = m.name || name;
        meta.viewType = m.viewType || null;
        meta.displayType = m.displayType || null;
        metaColumns = (m.columns || [])
          .filter((c) => c.fieldName && !c.fieldName.startsWith(':'))
          .map((c) => ({ field: c.fieldName, type: SocrataConnector.normalizeType(c.dataTypeName), name: c.name || c.fieldName }));
        meta.columnCount = metaColumns.length;
      }
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      meta.status = `failed: ${err.message}`;
    }
    this.log(`metadata ${resourceId}: HTTP ${meta.status}, ${meta.columnCount} columns`
      + (meta.displayType ? `, displayType ${meta.displayType}` : ''), metaColumns);

    // Several rows, because Socrata omits null fields from each row object.
    const samples = await this.fetchRows(resourceId, { limit: 5, signal });
    const merged = SocrataConnector.mergeColumns(metaColumns, samples);
    const sample = SocrataConnector.mergeRows(samples);
    const candidates = SocrataConnector.detectGeometry(merged, sample);
    const schema = {
      name,
      columns: merged,
      candidates,
      geometry: candidates[0] || null,
      permalink: `${this.portalBaseUrl}/d/${resourceId}`,
      meta,
    };
    this.log(`schema ${resourceId}: ${merged.length} columns from ${samples.length} sample rows; `
      + `geometry candidates: ${candidates.map(SocrataConnector.geometryToString).join(' | ') || 'none'}`,
      { columns: merged, sample, candidates });
    return schema;
  }

  static normalizeType(t) {
    const k = String(t || '').toLowerCase();
    return GEOJSON_TO_SOCRATA[k] || k;
  }

  // First non-null value of each field across the sample rows.
  static mergeRows(rows) {
    const out = {};
    for (const r of rows) for (const [k, v] of Object.entries(r)) if (out[k] == null && v != null) out[k] = v;
    return out;
  }

  // Columns that really come back from /resource/, typed by metadata where it agrees.
  // A metadata column absent from every sample is kept only if samples were empty
  // (it may just be null in those rows, but with no rows there's nothing better).
  static mergeColumns(metaColumns, samples) {
    const sample = SocrataConnector.mergeRows(samples);
    const fromRows = SocrataConnector.columnsFromRow(sample);
    const byField = new Map(metaColumns.map((c) => [c.field, c]));
    const out = fromRows.map((c) => {
      const m = byField.get(c.field);
      if (!m) return c;
      // trust the row's own GeoJSON over a metadata type that says otherwise
      const type = SPATIAL_TYPES.has(c.type) ? c.type : m.type;
      return { field: c.field, type, name: m.name };
    });
    const seen = new Set(out.map((c) => c.field));
    for (const m of metaColumns) if (!seen.has(m.field)) out.push(m);
    return out;
  }

  // Best-effort column typing from one row when /api/views isn't reachable.
  static columnsFromRow(row) {
    return Object.keys(row).filter((k) => !k.startsWith(':')).map((field) => {
      const v = row[field];
      let type = 'text';
      if (v && typeof v === 'object') type = v.type ? SocrataConnector.normalizeType(v.type) : ('latitude' in v ? 'location' : 'text');
      else if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) type = 'number';
      return { field, type, name: field };
    });
  }

  /**
   * Ranked geometry candidates: typed spatial columns first (fast server-side bbox,
   * any geometry type), then numeric lat/lon pairs (bbox via BETWEEN), then text
   * columns whose sample value parses as WKT (works, but no server-side bbox).
   */
  static detectGeometry(columns, sampleRow = {}) {
    const out = [];
    for (const c of columns) {
      if (SPATIAL_TYPES.has(c.type)) out.push({ field: c.field, spatial: true, type: c.type });
    }
    const numeric = columns.filter((c) => c.type === 'number' || c.type === 'double');
    const findNum = (names) => {
      for (const n of names) {
        const hit = numeric.find((c) => c.field.toLowerCase() === n);
        if (hit) return hit.field;
      }
      return null;
    };
    const lat = findNum(LAT_NAMES);
    const lon = findNum(LON_NAMES);
    // Plain x/y is often a state-plane projection, so only accept it if the sample looks like degrees.
    if (lat && lon && SocrataConnector._looksLikeLatLon(sampleRow[lat], sampleRow[lon])) {
      out.push({ lat, lon });
    }
    for (const c of columns) {
      if (c.type === 'text' && typeof sampleRow[c.field] === 'string'
          && SocrataConnector.parseWkt(sampleRow[c.field])) {
        out.push({ field: c.field, spatial: false, type: 'wkt' });
      }
    }
    return out;
  }

  static _looksLikeLatLon(lat, lon) {
    if (lat === undefined || lon === undefined) return true; // null in the sample row; trust the names
    const a = Number(lat), o = Number(lon);
    return Number.isFinite(a) && Number.isFinite(o) && Math.abs(a) <= 90 && Math.abs(o) <= 180;
  }

  // Normalize the many accepted shapes of the geometry option into one spec object.
  static normalizeGeometry(geometry, geometryField) {
    const g = geometry ?? geometryField ?? 'location';
    if (typeof g === 'string') {
      const [a, b] = g.split(',').map((s) => s.trim());
      return b ? { lat: a, lon: b } : { field: a, spatial: null };
    }
    return g;
  }

  // Short string form used in the URL hash: "location" or "latitude,longitude".
  static geometryToString(spec) {
    if (!spec) return '';
    return spec.lat ? `${spec.lat},${spec.lon}` : spec.field;
  }

  // ── Query building ─────────────────────────────────────────────────────────

  // 'west,south,east,north' bbox -> SoQL within_box args are (field, north, west, south, east)
  static bboxClause(geometry, [west, south, east, north]) {
    const g = SocrataConnector.normalizeGeometry(geometry);
    if (g.lat) {
      return `${g.lat} between ${south} and ${north} AND ${g.lon} between ${west} and ${east}`;
    }
    if (g.spatial === false) return null; // text/WKT columns can't be spatially filtered server-side
    return `within_box(${g.field}, ${north}, ${west}, ${south}, ${east})`;
  }

  // Can this geometry be filtered to a bbox on the server?
  static supportsBbox(geometry) {
    const g = SocrataConnector.normalizeGeometry(geometry);
    return Boolean(g.lat) || g.spatial !== false;
  }

  static notNullClause(geometry) {
    const g = SocrataConnector.normalizeGeometry(geometry);
    return g.lat ? `${g.lat} IS NOT NULL AND ${g.lon} IS NOT NULL` : `${g.field} IS NOT NULL`;
  }

  _where({ where, bbox, geometry, geometryField, skipNotNull } = {}) {
    const g = SocrataConnector.normalizeGeometry(geometry, geometryField);
    const parts = [];
    if (where) parts.push(`(${where})`);
    if (!skipNotNull) parts.push(SocrataConnector.notNullClause(g));
    if (bbox) {
      const b = SocrataConnector.bboxClause(g, bbox);
      if (b) parts.push(b);
    }
    return parts.join(' AND ');
  }

  buildUrl(resourceId, { select, where, order, limit = 1000, offset = 0, bbox, geometry, geometryField, skipNotNull } = {}) {
    const params = new URLSearchParams({ $limit: String(limit), $offset: String(offset) });
    if (select) params.set('$select', select);
    const clause = this._where({ where, bbox, geometry, geometryField, skipNotNull });
    if (clause) params.set('$where', clause);
    if (order) params.set('$order', order);
    return `${this.portalBaseUrl}/resource/${resourceId}.json?${params.toString()}`;
  }

  _headers() {
    return this.appToken ? { 'X-App-Token': this.appToken } : {};
  }

  // ── Fetching ───────────────────────────────────────────────────────────────

  async _get(url, signal) {
    const t0 = performance.now();
    const response = await fetch(url, { headers: this._headers(), signal });
    if (response.status === 403) {
      throw new Error(`Socrata rejected app token: ${await response.text()}`);
    }
    if (!response.ok) {
      // SODA puts the useful bit (e.g. "No such column: location") in the JSON body
      let detail = '';
      try { const body = await response.json(); detail = body.message || body.error || ''; } catch {}
      this.log(`HTTP ${response.status} ${decodeURIComponent(url)}`, detail);
      throw new Error(`Socrata request failed: HTTP ${response.status}${detail ? ` - ${detail}` : ''}`);
    }
    const body = await response.json();
    this.log(`${Array.isArray(body) ? body.length : '?'} rows in ${Math.round(performance.now() - t0)} ms  ${decodeURIComponent(url)}`);
    return body;
  }

  async fetchRows(resourceId, options = {}) {
    // Bare row fetch (schema sniffing) shouldn't add a NOT NULL clause for a guessed field.
    const opts = options.geometry || options.geometryField ? options : { ...options, skipNotNull: true };
    return this._get(this.buildUrl(resourceId, opts), options.signal);
  }

  // Total matching rows for the same where/bbox - lets the UI say "500 of 8,963".
  async count(resourceId, options = {}) {
    const params = new URLSearchParams({ $select: 'count(*) AS n' });
    const clause = this._where(options);
    if (clause) params.set('$where', clause);
    const [row] = await this._get(`${this.portalBaseUrl}/resource/${resourceId}.json?${params}`, options.signal);
    return Number(row?.n ?? 0);
  }

  async fetchGeoJSON(resourceId, options = {}) {
    const rows = await this.fetchRows(resourceId, options);
    return this._toGeoJSON(rows, options);
  }

  _toGeoJSON(rows, options) {
    const geometry = SocrataConnector.normalizeGeometry(options.geometry, options.geometryField);
    const gj = SocrataConnector.rowsToGeoJSON(rows, geometry);
    const dropped = rows.length - gj.features.length;
    if (dropped) {
      const bad = rows.find((r) => !SocrataConnector.rowToFeature(r, geometry));
      this.log(`${dropped} of ${rows.length} rows had no usable geometry in "${SocrataConnector.geometryToString(geometry)}"; first one:`, bad);
    }
    return gj;
  }

  // Pages through every row matching options (ignores options.limit/offset). Orders by
  // the system :id so pages are stable - SODA doesn't guarantee a consistent order across
  // $offset pages otherwise, which can duplicate or skip rows. SODA 2.1 has no hard $limit
  // cap, so a large pageSize (e.g. 50000) is usually faster than many small pages.
  async fetchAllRows(resourceId, options = {}, { pageSize = 1000, maxPages = null, onPage } = {}) {
    const rows = [];
    let offset = 0;
    let page = 0;
    while (maxPages === null || page < maxPages) {
      const pageRows = await this.fetchRows(resourceId, { order: ':id', ...options, limit: pageSize, offset });
      if (!pageRows.length) break;
      rows.push(...pageRows);
      if (onPage) onPage(rows.length);
      if (pageRows.length < pageSize) break;
      offset += pageSize;
      page += 1;
    }
    return rows;
  }

  async fetchAllGeoJSON(resourceId, options = {}, pagingOptions = {}) {
    const rows = await this.fetchAllRows(resourceId, options, pagingOptions);
    return this._toGeoJSON(rows, options);
  }

  // ── Row → GeoJSON ──────────────────────────────────────────────────────────

  static rowsToGeoJSON(rows, geometry) {
    const features = [];
    for (const row of rows) {
      const f = SocrataConnector.rowToFeature(row, geometry);
      if (f) features.push(f);
    }
    return { type: 'FeatureCollection', features };
  }

  static rowToFeature(row, geometry = 'location') {
    const g = SocrataConnector.normalizeGeometry(geometry);
    let geom;
    const properties = { ...row };
    if (g.lat) {
      const lat = parseFloat(row[g.lat]);
      const lon = parseFloat(row[g.lon]);
      geom = Number.isFinite(lat) && Number.isFinite(lon) ? { type: 'Point', coordinates: [lon, lat] } : null;
    } else {
      geom = SocrataConnector.parseGeometry(row[g.field]);
      delete properties[g.field];
    }
    if (!geom) return null;
    for (const k of Object.keys(properties)) if (k.startsWith(':')) delete properties[k];
    return { type: 'Feature', geometry: geom, properties };
  }

  // Socrata returns a GeoJSON geometry for typed spatial columns (any type), a legacy
  // {latitude, longitude} dict for old "Location" columns, or WKT text for columns that
  // were published as plain text.
  static parseGeometry(value) {
    if (typeof value === 'string') return SocrataConnector.parseWkt(value);
    if (!value || typeof value !== 'object') return null;
    if (typeof value.type === 'string' && Array.isArray(value.coordinates)) return value;
    if ('latitude' in value && 'longitude' in value) {
      const lat = parseFloat(value.latitude);
      const lon = parseFloat(value.longitude);
      return Number.isFinite(lat) && Number.isFinite(lon) ? { type: 'Point', coordinates: [lon, lat] } : null;
    }
    return null;
  }

  // Minimal WKT reader: POINT, LINESTRING, POLYGON and their MULTI* forms (2D; Z/M dropped).
  static parseWkt(text) {
    const m = /^\s*(MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|POINT|LINESTRING|POLYGON)\s*(?:Z|M|ZM)?\s*(\(.*\))\s*$/is.exec(text);
    if (!m) return null;
    const type = m[1].toUpperCase();
    let body = m[2];
    if (type === 'MULTIPOINT' && !/\(\s*\(/.test(body)) body = body.replace(/(-?[\d.eE+-]+\s+-?[\d.eE+-]+)(?=\s*[,)])/g, '($1)'); // "1 2, 3 4" -> "(1 2), (3 4)"
    let json = body
      .replace(/(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)(?:\s+-?[\d.eE+-]+)*/g, '[$1,$2]')
      .replace(/\(/g, '[').replace(/\)/g, ']');
    let coords;
    try { coords = JSON.parse(json); } catch { return null; }
    const names = { POINT: 'Point', LINESTRING: 'LineString', POLYGON: 'Polygon', MULTIPOINT: 'MultiPoint', MULTILINESTRING: 'MultiLineString', MULTIPOLYGON: 'MultiPolygon' };
    if (type === 'POINT') coords = coords[0];
    if (type === 'MULTIPOINT') coords = coords.map((c) => (Array.isArray(c[0]) ? c[0] : c));
    if (!Array.isArray(coords) || coords.flat(Infinity).some((n) => !Number.isFinite(n))) return null;
    return { type: names[type], coordinates: coords };
  }
}

/**
 * Wire a SocrataConnector resource into a MapLibre GeoJSON source with circle, line and
 * fill layers (each filtered by geometry type, so points, lines and polygons all draw).
 *
 * mode 'viewport' (default): refetch bounded to the visible map on every pan/zoom, debounced,
 *   with in-flight requests aborted so a slow old response can't overwrite a newer one.
 *   Falls back to 'once' automatically when the geometry can't be bbox-filtered (WKT text).
 * mode 'all': page through every matching row once (no limit), then let MapLibre handle it.
 * mode 'once': one request of `limit` rows, no refetching.
 *
 * Returns a controller: { ready: Promise<{shown,total}>, reload(), destroy(), mode }.
 * `onUpdate({ shown, total, loading, error, mode })` fires on every state change.
 */
function addSocrataLayer(map, connector, resourceId, {
  sourceId = 'socrata-source',
  layerId = 'socrata-layer',
  color = '#d6336c',
  paint,
  geometry,
  geometryField,
  select,
  where,
  order,
  limit = 1000,
  mode,
  refreshOnMoveEnd,
  pageSize = 50000,
  debounceMs = 250,
  onUpdate = () => {},
} = {}) {
  const geom = SocrataConnector.normalizeGeometry(geometry, geometryField);
  if (!mode) mode = refreshOnMoveEnd === false ? 'once' : 'viewport';
  if (mode === 'viewport' && !SocrataConnector.supportsBbox(geom)) mode = 'once';

  const layerIds = [`${layerId}-fill`, `${layerId}-line`, layerId];
  const ensureLayers = (data) => {
    if (map.getSource(sourceId)) { map.getSource(sourceId).setData(data); return; }
    map.addSource(sourceId, { type: 'geojson', data });
    map.addLayer({
      id: layerIds[0], type: 'fill', source: sourceId,
      filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
      paint: { 'fill-color': color, 'fill-opacity': 0.2 },
    });
    map.addLayer({
      id: layerIds[1], type: 'line', source: sourceId,
      filter: ['!=', ['geometry-type'], 'Point'],
      paint: { 'line-color': color, 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 16, 3] },
    });
    map.addLayer({
      id: layerIds[2], type: 'circle', source: sourceId,
      filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
      paint: paint || {
        'circle-color': color,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 4, 18, 8],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 0, 14, 1],
        'circle-opacity': 0.85,
      },
    });
  };

  let controller = null;
  let timer = null;
  const base = { select, where, order, geometry: geom };

  const load = async () => {
    if (controller) controller.abort();
    controller = new AbortController();
    const { signal } = controller;
    onUpdate({ loading: true, mode });
    try {
      let geojson;
      let total;
      if (mode === 'all') {
        geojson = await connector.fetchAllGeoJSON(resourceId, { ...base, signal }, {
          pageSize, onPage: (n) => onUpdate({ loading: true, mode, progress: n }),
        });
        total = geojson.features.length;
      } else {
        const opts = { ...base, limit, signal };
        if (mode === 'viewport') {
          const b = map.getBounds();
          opts.bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
        }
        const [gj, n] = await Promise.all([
          connector.fetchGeoJSON(resourceId, opts),
          connector.count(resourceId, opts).catch(() => null),
        ]);
        geojson = gj;
        total = n;
      }
      if (signal.aborted) return null;
      ensureLayers(geojson);
      const state = { shown: geojson.features.length, total, loading: false, mode, geojson };
      onUpdate(state);
      return state;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      onUpdate({ loading: false, mode, error: err });
      throw err;
    }
  };

  const onMove = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { load().catch((err) => console.error('SocrataConnector refresh failed:', err)); }, debounceMs);
  };
  if (mode === 'viewport') map.on('moveend', onMove);

  return {
    mode,
    layerIds,
    ready: load(),
    reload: load,
    destroy() {
      clearTimeout(timer);
      if (controller) controller.abort();
      map.off('moveend', onMove);
      for (const id of layerIds) if (map.getLayer(id)) map.removeLayer(id);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    },
  };
}

if (typeof module !== 'undefined') module.exports = { SocrataConnector, addSocrataLayer };
