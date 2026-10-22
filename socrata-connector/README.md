# Socrata + MapLibre connector

A small, dependency-free JS module that loads any [Socrata Open Data](https://dev.socrata.com/)
portal (SODA 2.1 or SODA3 / SoQL) - `data.sf.gov`, `data.cityofchicago.org`, any city on the platform -
as a live GeoJSON source for [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/).

## Usage

```html
<script src="socrata-connector.js"></script>
<script>
  const { portal, id } = SocrataConnector.parseUrl('https://data.sf.gov/d/tkzw-k3nq');
  const connector = new SocrataConnector(portal);
  const schema = await connector.fetchSchema(id);   // columns + detected geometry

  const layer = addSocrataLayer(map, connector, id, {
    geometry: schema.geometry,   // or 'location', or { lat: 'latitude', lon: 'longitude' }
    limit: 1000,
    mode: 'viewport',            // 'viewport' | 'all' | 'once'
    onUpdate: ({ shown, total }) => console.log(`${shown} of ${total}`),
  });
  await layer.ready;
</script>
```

`addSocrataLayer` adds one `geojson` source with `circle`, `line` and `fill` layers (filtered
by geometry type, so point, line and polygon datasets all draw) and returns
`{ ready, reload(), destroy(), mode }`.

- **`viewport`** (default) refetches bounded to the visible map on `moveend`, debounced, and
  aborts any in-flight request so a slow old response can't overwrite a newer one. Each
  refresh also runs a `count(*)` so the UI can say "1,000 of 8,963 in view".
- **`all`** pages through every matching row once (ordered by `:id`, `pageSize` 50,000 by
  default) and then leaves panning to MapLibre.
- **`once`** is a single request of `limit` rows. `viewport` falls back to this automatically
  when the geometry column can't be filtered server-side (WKT stored as text).

### Geometry

Socrata datasets put location in one of several places, so `fetchSchema` reads
`/api/views/{id}.json` and ranks candidates:

1. **Typed spatial column** (`point`, `location`, `line`, `polygon`, multi-*) - bbox via
   `within_box()`. Any GeoJSON geometry type is passed through.
2. **Numeric latitude/longitude pair** (`latitude`/`longitude`, `lat`/`lon`, ...) - bbox via
   `BETWEEN`. Plain `x`/`y` is only accepted if the sample row looks like degrees, since it's
   often state plane.
3. **Text column holding WKT** (`POINT(...)`, `LINESTRING`, `POLYGON`, multi-*) - parsed
   client-side, but Socrata can't spatially filter text, so no viewport refresh.

The `geometry` option takes any of: a field name string, `'lat,lon'`, `{ field, spatial }`, or
`{ lat, lon }`. The old `geometryField` option still works.

The SF Street Tree Inventory (`tkzw-k3nq`) is a good example of why this matters: its `point`
column is WKT **text**, so the old default (`within_box(location, ...)` plus
`location IS NOT NULL`) failed twice over - wrong column name, and `within_box` on text is a
`type-mismatch`. It also has numeric `latitude`/`longitude`, which detection now prefers.

### Lower-level pieces

```js
SocrataConnector.parseUrl(anySocrataUrl);  // { portal, id, query: { where, select, order, limit } }
connector.buildUrl(id, { where, bbox: [w, s, e, n], geometry, limit });
await connector.fetchRows(id, { limit: 100 });
await connector.count(id, { where, bbox, geometry });
await connector.fetchGeoJSON(id, { geometry, limit: 100 });
await connector.fetchAllGeoJSON(id, { geometry }, { pageSize: 50000 });
SocrataConnector.parseWkt('POINT(-122.4 37.7)');
```

**App tokens.** For portals that need an [app token](https://dev.socrata.com/docs/app-tokens)
(recommended for anything beyond casual use, to get out of the shared per-IP rate-limit pool):
`new SocrataConnector(portal, { appToken: 'YOUR_TOKEN' })`. Only the app-token string works
from a browser. Socrata's newer API key ID/secret pair is meant for HTTP Basic Auth, and
Socrata's CORS policy doesn't allow the `Authorization` header cross-origin, so that pair
only works server-side (see the Python `SocrataClient` in
[Vibemap-Analysis](https://github.com/Vibemap/Vibemap-Analysis), `etl/scrapers/socrata/client.py`).

**SODA3.** Socrata's newer API is `POST /api/v3/views/{id}/query.json` with one SoQL string
in a JSON body, and portals that enforce it require an app token or user credentials on every
request. Opt in with `new SocrataConnector(portal, { appToken, apiVersion: '3' })`. Everything
else (`fetchRows`, `count`, `fetchAllGeoJSON`, `addSocrataLayer`) works unchanged. A browser
POST with `Content-Type` and `X-App-Token` passes Socrata's CORS preflight, so it needs no
proxy. SODA 2.1 stays the default, and `data.sf.gov` currently answers both without a token.

**A `limit` smaller than the true match count returns Socrata's arbitrary scan order, not a
representative sample** - with no `$order`, "first 2,000 of 13,629 matching rows" can come
back geographically clustered. The demo shows the true count next to what's drawn so this
is visible; use `mode: 'all'` / `fetchAllGeoJSON` when you need everything.

## Demo

`index.html` loads any Socrata dataset from the URL, on Selecter's white Protomaps basemap.
With no URL it shows SF's [registered business locations](https://data.sf.gov/d/g8m3-pdis).

```
socrata-connector/#url=https://data.sf.gov/d/tkzw-k3nq&limit=500
socrata-connector/#https://data.sf.gov/City-Infrastructure/San-Francisco-Street-Tree-Inventory/tkzw-k3nq/about_data
socrata-connector/https://data.sf.gov/City-Infrastructure/San-Francisco-Street-Tree-Inventory/tkzw-k3nq/about_data
```

Any Socrata URL form works (dataset page, `/d/`, `/resource/...json`, `/api/views/`), from
any portal. SoQL params on a pasted `/resource/` URL (`$where`, `$select`, `$order`, `$limit`)
are carried over. The last form - the URL pasted straight onto the path - goes through the
repo-root `404.html`, which moves it into the hash.

Hash keys: `url`, `limit`, `geom` (`point` or `latitude,longitude`), `mode` (`viewport` |
`all`), `where`, `select`, `order`, `token`, `soda` (`3` to use SODA3), `map` (`zoom/lat/lng`,
same as Selecter). The
page rewrites the hash as you change settings or pan, so the address bar is always a
shareable link. If detection guesses wrong, or finds nothing, the geometry menu lists the
candidates plus "pick latitude / longitude columns".
