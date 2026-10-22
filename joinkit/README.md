# JoinKit

*2026-10-14 · John Oram*

The join logic behind [Selecter](../selecter/) and [Joiner](https://github.com/civic-joy-fund/joiner), pulled out of Selecter's `index.html` so both tools share one tested copy.

JoinKit matches table rows (CSV, Airtable, GeoJSON properties) to map features by a shared key, then computes per-feature counts and statistics. It is plain JavaScript with no dependencies, no DOM and no map code.

## Loading it

In a page, one script tag; it defines `window.JoinKit`:

```html
<script src="../joinkit/joinkit.js"></script>
```

From another site, pin a commit or tag through jsDelivr:

```html
<script src="https://cdn.jsdelivr.net/gh/burritojustice/maplibre@<tag-or-sha>/joinkit/joinkit.js"></script>
```

In Node: `const JoinKit = require('./joinkit/joinkit.js')`.

This keeps Selecter's rules: no build step, no ES modules, nothing to install.

## A join in one call

```js
const join = JoinKit.buildJoin({
    rows,                 // array of plain objects
    headers,              // column names, in display order
    keyCol: 'District',   // row column holding the key
    features,             // GeoJSON features (each needs a stable id)
    propKey: 'supdist',   // feature property to match
    normalize: JoinKit.makeKeyNormalizer({ stripPrefix: /^d/i }),  // optional
    types: { 'Budget Requested': 'currency', Score: 'numeric' },     // optional
});

join.byId['g12'].agg.count                 // rows matched to feature g12
join.byId['g12'].agg['sum_Budget Requested']
join.unmatchedVals                         // keys that matched no feature
```

`buildJoin` returns `byId` (per-feature rows and stats), `numericCols`, `catCols`, `currencyCols`, `globalAgg`, `aggColumns` (palette ranges), `catColumns`, `csvTotals`, `joinedTotals`, `isLookup` (1 : 1 vs 1 : many), `displayNameProp` / `displayNameCol`, and match counts (`totalRows`, `matchedRows`, `nullRows`, `unmatchedVals`).

Per-feature stats in `agg` use Selecter's names: `count`, and for each numeric column `sum_X`, `avg_X`, `min_X`, `max_X`, `median_X`, `stddev_X`, `count_X`, `pct_X`; for each categorical column `mode_X`.

## Functions

| Area | Function | What it does |
| --- | --- | --- |
| Values | `normVal(v)` | Selecter's key normalizer: trims, strips thousands commas from numbers |
| | `parseNum(v)` | Number from a cell, accepting `$1,200`; `null` if not numeric |
| | `cellText(v)`, `cellValues(v, delimiter)` | Flatten Airtable selects `{name}`, multi-selects and linked records |
| | `makeKeyNormalizer(opts)` | Build a normalizer: `stripPrefix`, `aliases` (crosswalk), `caseInsensitive`, `collapseSpace`, `stripLeadingZeros`, `padStart` |
| Columns | `classifyColumns(rows, headers, opts)` | Numeric / currency / categorical; `types` overrides guessing |
| | `isForcedCategorical(col, vals)` | Zip, FIPS, district, phone, year… are never summed |
| Joining | `buildJoin(params)` | The whole join (above) |
| | `buildFeatureIndex`, `buildPropIndex` | Value → feature id lookups |
| | `scoreKeyCandidates({rows, headers, propIndex, geoJsonProps})` | Guess which column joins to which property, with % match scores |
| | `detectMultiRow(rows, headers, keyCol)` | Several rows per key? Suggests a category column to filter on |
| Aggregation | `computeAgg(rows, numericCols, catCols)` | Stats for one group of rows |
| Filtering | `filterRows(rows, conditions, {mode})` | Any number of conditions, `and` / `or` |
| Spatial | `pointInPolygon([lng, lat], geometry)` | Polygon and MultiPolygon, with holes |
| | `assignPointsToPolygons(points, features)` | Containing polygon id for each point |
| Matching (0.3) | `makeLooseNormalizer(keys, base)` | Forgiving names: case, spaces, punctuation; slash parts (“Treasure Island” → “Treasure Island/YBI”); one or two letters off for names of 8+ letters |
| | `detectDelimiter(rows, col)`, `MULTI_DELIMITER` | Columns listing several values per cell (commas, semicolons, pipes, line breaks; not slashes) |
| | `looseKey(s)`, `editDistance(a, b, max)`, `sampleRows(rows, n)` | Helpers |
| Classes (0.3) | `classBreaks(values, {method, k, log})` | Natural breaks (`jenks`), equal width (`equal`) or quantiles, optionally on log10; ranges, `classOf`, min/max/median/mean |
| | `ckmeans(sorted, k)`, `summaryStats(sorted)` | Natural breaks on runs of equal values (fast with thousands of areas) |
| Big tables (0.3) | `buildJoinChunked(params)` | The join in chunks with `onProgress(done, total)`: counts, sums, averages, shares; by key column or by `areaOf` (a feature id per row); `rowAreas` and `unmatched` too |
| | `assignPointsToPolygonsChunked(points, features, opts)` | Point-in-polygon in chunks with progress |
| Dissolve (0.3) | `dissolve(fc, prop)`, `dissolveGeometries(geoms)` | Merge polygons sharing a property (precincts → districts) into clean outlines |
| Hexbins (0.3) | `hex.autoResolution(h3, zoom, lat, opts)` | H3 resolution whose hexagons are ~`targetPx` (32) across at this zoom and latitude; `zoomShift`, `bump`, `min`, `max` |
| | `hex.switchZoom`, `hex.widthPx`, `hex.metersPerPixel` | Where Auto changes level; hexagon size on screen |
| | `hex.cellsForPoints`, `hex.cover`, `hex.shortCodes`, `hex.feature` | Cells for points, cells covering polygons (named by the polygon covering most of each), short codes (“#82c7”), cell → GeoJSON |

### Key normalizers and crosswalks

Different sources spell the same key differently. A normalizer runs on both sides of the join:

```js
// "D5", "District 5" and "5" all match supdist 5
JoinKit.makeKeyNormalizer({ stripPrefix: /^(district|d)\s*/i });

// Neighborhood crosswalk: source spelling → name in the polygon set
JoinKit.makeKeyNormalizer({
    caseInsensitive: true, collapseSpace: true,
    aliases: { 'Inner Sunet': 'Inner Sunset', 'SOMA': 'South of Market' },
});
```

### Multi-valued keys

If the key cell is an array (an Airtable multi-select like District `["1", "3"]`), or `delimiter` is set for strings like `"1, 3"`, the row counts once toward **each** matching feature. Totals across features can then exceed the row total — that's expected.

### Filters

```js
JoinKit.filterRows(rows, [
    { col: 'Organizations', op: '=', value: 'Green Street Guild' },  // any linked org
    { col: 'Phase', op: 'in', value: ['Draft', 'Page Published'] },
    { col: 'Budget Requested', op: '>=', value: 1000 },
]);
```

Ops: `=` `!=` `in` `notIn` `contains` `notContains` `>` `>=` `<` `<=` `between` `empty` `notEmpty`. On multi-valued cells, positive ops pass if any value passes; negative ops pass only if no value fails. Selecter's single row filter `{col, val}` is `{ col, op: '=', value: val }`.

## Tests

```sh
node --test 'joinkit/test/*.test.js'
```

- `test/parity.test.js` runs the original Selecter v964 code (`test/reference/selecter-v964-join.js`, copied verbatim) and JoinKit on 120 randomized datasets and requires identical results — stats, column types, matches, log lines. Any change that alters Selecter's output fails here; if the change is intended, say so in the commit and update the test.
- `test/features.test.js` covers behavior Selecter didn't have.

## Differences from Selecter v964

- A row never counts twice toward the same feature — e.g. multi-select keys `"D3"` and `"3"`, or a layer that contains the same `_gvid` twice. v964 could double-count in the second case.
- `makeKeyNormalizer()` treats the number `0` as a key; `normVal(0)` returns `''` (kept for parity — see Selecter known issues).

## 0.3: big tables, classes, hexbins

Added for Joiner (2026-10-22), all new functions; nothing older changed.

- **Big tables.** `buildJoinChunked` does the join in one pass over the rows, in chunks, calling `onProgress(done, total)` and yielding between chunks so a page can show a progress bar. With 367,000 rows it takes about 0.4 s where `buildJoin` takes about 3 s. It gives `count`, and per numeric column `count_X`, `sum_X`, `avg_X`, `pct_X` (share of the column's total over all rows), but not the median, stddev or mode; column types come from a 5,000-row sample.
- **Classes.** `classBreaks` for color ramps: natural breaks, equal width or quantiles, with an optional log scale. `ckmeans` treats runs of equal values as one unit (and pools neighbors past 1,500 distinct values), so it stays fast with thousands of areas.
- **Forgiving matching.** `makeLooseNormalizer` and `detectDelimiter`, for spreadsheets that list several areas in a cell or spell them loosely.
- **Hexbins.** `JoinKit.hex.*` takes the h3-js (v4) module as its first argument, so JoinKit still has no dependencies.
- **Dissolve.** `dissolve(fc, prop)` builds districts from precincts that share a district number.

Tests: `node --test test/*.test.js` (the hexbin test runs when `h3-js` can be required, and is skipped otherwise).
