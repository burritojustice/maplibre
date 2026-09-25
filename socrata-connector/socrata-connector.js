/**
 * SocrataConnector - load any Socrata Open Data portal (SODA 2.1 / SoQL), e.g.
 * https://data.sf.gov, as a GeoJSON source for MapLibre GL JS. No build step,
 * no dependencies beyond `fetch`.
 *
 * const connector = new SocrataConnector('https://data.sf.gov');
 * addSocrataLayer(map, connector, 'g8m3-pdis', { where: 'location IS NOT NULL' });
 */

class SocrataConnector {
  constructor(portalBaseUrl, { appToken } = {}) {
    this.portalBaseUrl = portalBaseUrl.replace(/\/+$/, '');
    this.appToken = appToken || null;
  }

  // 'west,south,east,north' bbox -> SoQL within_box args are (field, north, west, south, east)
  static bboxClause(geometryField, [west, south, east, north]) {
    return `within_box(${geometryField}, ${north}, ${west}, ${south}, ${east})`;
  }

  buildUrl(resourceId, { select, where, order, limit = 1000, offset = 0, bbox, geometryField = 'location' } = {}) {
    const params = new URLSearchParams({ $limit: String(limit), $offset: String(offset) });
    if (select) params.set('$select', select);
    let clause = where || null;
    if (bbox) {
      const bboxClause = SocrataConnector.bboxClause(geometryField, bbox);
      clause = clause ? `(${clause}) AND ${bboxClause}` : bboxClause;
    }
    if (clause) params.set('$where', clause);
    if (order) params.set('$order', order);
    return `${this.portalBaseUrl}/resource/${resourceId}.json?${params.toString()}`;
  }

  async fetchRows(resourceId, options = {}) {
    const url = this.buildUrl(resourceId, options);
    const headers = this.appToken ? { 'X-App-Token': this.appToken } : {};
    const response = await fetch(url, { headers });
    if (response.status === 403) {
      throw new Error(`Socrata rejected app token: ${await response.text()}`);
    }
    if (!response.ok) {
      throw new Error(`Socrata request failed: HTTP ${response.status}`);
    }
    return response.json();
  }

  // Converts rows to a GeoJSON FeatureCollection; rows without a Point-typed
  // geometryField column are dropped rather than failing the whole request.
  async fetchGeoJSON(resourceId, options = {}) {
    const geometryField = options.geometryField || 'location';
    const rows = await this.fetchRows(resourceId, options);
    const features = rows
      .map((row) => SocrataConnector.rowToFeature(row, geometryField))
      .filter((feature) => feature !== null);
    return { type: 'FeatureCollection', features };
  }

  static rowToFeature(row, geometryField = 'location') {
    const point = row[geometryField];
    if (!point || point.type !== 'Point' || !Array.isArray(point.coordinates)) return null;
    const properties = { ...row };
    delete properties[geometryField];
    return { type: 'Feature', geometry: point, properties };
  }
}

/**
 * Wire a SocrataConnector resource into a MapLibre GeoJSON source + circle layer.
 * With refreshOnMoveEnd (default), refetches bounded to the current viewport on
 * every `moveend` - a live, panning-aware version of the source.
 */
function addSocrataLayer(map, connector, resourceId, {
  sourceId = 'socrata-source',
  layerId = 'socrata-layer',
  paint = { 'circle-radius': 5, 'circle-color': '#1d72b8', 'circle-opacity': 0.8 },
  geometryField = 'location',
  select,
  where,
  order,
  limit = 1000,
  refreshOnMoveEnd = true,
} = {}) {
  const load = async () => {
    const options = { select, where, order, limit, geometryField };
    if (refreshOnMoveEnd) {
      const bounds = map.getBounds();
      options.bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    }
    const geojson = await connector.fetchGeoJSON(resourceId, options);
    const source = map.getSource(sourceId);
    if (source) {
      source.setData(geojson);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: geojson });
      map.addLayer({ id: layerId, type: 'circle', source: sourceId, paint });
    }
    return geojson;
  };

  const initialLoad = load();
  if (refreshOnMoveEnd) {
    map.on('moveend', () => { load().catch((err) => console.error('SocrataConnector refresh failed:', err)); });
  }
  return initialLoad;
}
