# Socrata + MapLibre connector

A small, dependency-free JS module that loads any [Socrata Open Data](https://dev.socrata.com/)
portal (SODA 2.1 / SoQL) - `data.sf.gov`, `data.cityofchicago.org`, any city on the platform -
as a live GeoJSON source for [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/).

## Usage

```html
<script src="socrata-connector.js"></script>
<script>
  const connector = new SocrataConnector('https://data.sf.gov');

  addSocrataLayer(map, connector, 'g8m3-pdis', {
    where: 'location IS NOT NULL',
    limit: 500,
  });
</script>
```

`addSocrataLayer` adds a `geojson` source + `circle` layer, and by default refetches
bounded to the current viewport on every `moveend` - panning the map re-queries just
what's visible instead of pulling an entire dataset up front.

For portals that need an [app token](https://dev.socrata.com/docs/app-tokens) (recommended
for anything beyond casual use, to get out of the shared per-IP rate-limit pool):

```js
const connector = new SocrataConnector('https://data.sf.gov', { appToken: 'YOUR_TOKEN' });
```

Lower-level building blocks are exposed too:

```js
connector.buildUrl('g8m3-pdis', { where: '...', bbox: [west, south, east, north] });
await connector.fetchRows('g8m3-pdis', { limit: 100 });
await connector.fetchGeoJSON('g8m3-pdis', { limit: 100 });
```

Rows without a recognized point value are dropped rather than failing the whole request -
handles a GeoJSON Point, Socrata's legacy `{latitude, longitude}` "Location" dict, and WKT
text (`"POINT(lon lat)"`), covering all three shapes seen across real portals. It's a fit
for point-of-interest datasets (businesses, trees, incidents), not polygon/line datasets
(parcels, boundaries).

**`bbox`/viewport auto-refresh needs a real spatial column.** `within_box` only works when
the portal's geometry column is actually typed as Point - some datasets store it as plain
text (WKT), which throws a `type-mismatch` error from `within_box`. If `addSocrataLayer`'s
`moveend` refetch throws immediately, drop `refreshOnMoveEnd: false` and fetch the dataset
without a `bbox` instead.

## Demo

`index.html` renders San Francisco's [registered business locations](https://data.sf.gov/d/g8m3-pdis)
dataset - no app token needed, it's a public read.

Also verified against a much larger, differently-shaped dataset: SF's 144k-row
[Street Tree Inventory](https://data.sf.gov/City-Infrastructure/San-Francisco-Street-Tree-Inventory/tkzw-k3nq)
(WKT `point` column, not spatially typed) loaded successfully into
[burritojustice/maplibre's `selecter`](../selecter) tool via this module.
