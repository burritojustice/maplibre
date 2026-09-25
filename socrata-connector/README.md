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

Rows without a `Point`-typed geometry column are dropped rather than failing the whole
request - only tested against Point columns so far, so it's a fit for point-of-interest
datasets (businesses, trees, incidents), not polygon/line datasets (parcels, boundaries).

## Demo

`index.html` renders San Francisco's [registered business locations](https://data.sf.gov/d/g8m3-pdis)
dataset - no app token needed, it's a public read.
