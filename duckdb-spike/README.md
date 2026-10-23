# DuckDB split spike

*2026-10-23*

A spike of one idea: when a user uploads data, **split the shapes from the attributes**. The shapes stay in browser memory (a MapLibre source, JoinKit for spatial work). The attributes go into DuckDB, local or MotherDuck, where SQL does the analysis. The only thing the two halves share is `fid`, a sequential integer.

Open [index.html](index.html) from any static server at the repo root, for example:

```bash
python -m http.server 8765
```

then <http://localhost:8765/duckdb-spike/>. No build step; the only ES modules are the two DuckDB clients, which ship as ESM only.

## What the page does

1. **Engine.** *Local DuckDB-WASM* loads `@duckdb/duckdb-wasm` from jsDelivr into a worker. *MotherDuck* loads `@motherduck/wasm-client`, which fetches its own DuckDB-WASM from app.motherduck.com and runs queries against your MotherDuck account (token from app.motherduck.com → Settings → Access tokens).
2. **Upload.** A GeoJSON file goes through `Split.splitGeoJSON`: every feature gets `id = fid`, its properties are stripped down to `{ _gvid: fid }` (JoinKit's id property), and the properties become a typed table with `fid` first. Six derived columns (`_minx … _maxy`, `_cx`, `_cy`) ride along so SQL can filter by extent without a spatial extension. CSV, Parquet and JSON files with no geometry go straight into DuckDB as plain tables (local engine only).
3. **Query → paint.** Any SQL runs against the engine. A result with `fid` and `value` columns is painted onto the chosen layer with `map.setFeatureState`, classed with `JoinKit.classBreaks`. Geometry is never re-uploaded. Hovering a feature runs `SELECT * FROM table WHERE fid = ?`, because the feature itself carries nothing but its id.
4. **Chart.** Mosaic vgplot draws a histogram on the **same** DuckDB-WASM instance (`vg.wasmConnector({ duckdb, connection })`), so the binning runs in DuckDB, not in JS. Local engine only for now.
5. **duckdb-tileserver.** Lists a server's layers (`GET /layers`), adds one as a MapLibre vector source from its TileJSON (`GET /tiles/{layer}.json`), and lets the same SQL-to-feature-state path paint it.

Console access for poking: `window.map`, `window.spike` (`state`, `loadGeoJSON`, `loadTabular`, `paint`).

## Files

| File | What |
| --- | --- |
| [split.js](split.js) | The splitter and SQL helpers. Plain script, no DOM, Node-testable like JoinKit. |
| [engine.js](engine.js) | One interface over the two engines: `query`, `exec`, `loadSplit`, `loadFile`. |
| [app.js](app.js) | Page wiring: map, upload, feature state, Mosaic, tileserver. |
| [index.html](index.html) | The page. |
| [coi-serviceworker.js](coi-serviceworker.js) | Vendored [coi-serviceworker 0.1.7](https://github.com/gzuidhof/coi-serviceworker) (MIT); opt-in with `?coi`, see below. |
| [test/split.test.js](test/split.test.js) | `node --test duckdb-spike/test/split.test.js` |

## Measured (local engine, this laptop, Chrome in the Claude desktop browser)

| Step | Time |
| --- | --- |
| Open local engine (download + instantiate, `eh` bundle) | ~1.9 s |
| Split + load 117 MultiPolygons, 13 columns | 0.5 s |
| Split + load 240 LineStrings (Slow streets) | similar |
| `SELECT fid, x AS value FROM t` | ~40 ms |
| Paint 240 features via `setFeatureState` | 1–2 ms |
| Mosaic histogram (first load of vgplot from CDN included) | a few seconds, then instant |

Not measured yet: anything large. The next test is a 100k-feature file to see where `JSON.stringify` of the rows and `read_json` stop being free. If that hurts, build an Arrow table in the worker and use `insertArrowTable` instead.

## How rows get into each engine

* **Local:** `db.registerFileText('t.json', JSON.stringify(rows))` then `CREATE TABLE t AS SELECT * FROM read_json('t.json', columns = {...})` with the types the splitter inferred. Files with no geometry use `registerFileBuffer` plus `read_csv_auto` / `read_parquet` / `read_json_auto`.
* **MotherDuck:** the wasm client has no file registration, so `Split.insertSQLChunks` emits `INSERT … SELECT unnest(from_json($j$[…]$j$::JSON, '[{"fid":"INTEGER",…}]'))` in chunks of 2,000 rows. Slow for big tables; the right path there is to upload the file to MotherDuck and only send the `fid` mapping. **Untested with a real token**: no token was available in this session. The module loads from jsDelivr and the code follows the documented `MDConnection.create({ mdToken })` / `evaluateQuery` / `data.toRows()` API.

## duckdb-tileserver, as it actually is

Read from [tobilg/duckdb-tileserver](https://github.com/tobilg/duckdb-tileserver) (Go, Apache-2.0):

* It opens **one local DuckDB file, read-only** (`--database-path` / `DUCKDBTS_DATABASE_PATH`), and serves every table with a geometry column as a layer. There is no MotherDuck (`md:`) support in the code, so it cannot serve straight from the MotherDuck instance. To publish a table from MotherDuck, export it (`COPY … TO 'x.parquet'`), load it into the tileserver's file with DuckDB spatial, add an R-tree index, restart.
* Endpoints: `GET /layers` → `{ layers: [{ name, table, geometry_column, geometry_type, srid, bounds, properties }] }`; `GET /tiles/{layer}.json` (TileJSON with `tiles`, `bounds`, `vector_layers[].fields`); `GET /tiles/{layer}/{z}/{x}/{y}.mvt`; `/health`; cache admin under `/cache`.
* Tiles come from `ST_AsMVT` with every non-geometry column as a property and **no MVT feature id**. So painting from SQL needs `promoteId` on a property; the page auto-picks one named like `id`, `fid`, `objectid`, `gid`, or anything ending in `id`. Then `SELECT <that column> AS fid, x AS value FROM <your table>` paints the tiles.
* CORS is `*` by default, so the page can call it from any origin without the service worker below.

Verified here against a mock of those two JSON endpoints (no running Go server): listing, id-property pick, TileJSON → vector source with `promoteId`, style layers, fit to bounds.

## Cross-origin isolation

`SharedArrayBuffer` needs COOP/COEP headers, which GitHub Pages cannot send. coi-serviceworker fakes them. It is **off by default** here (`?coi` turns it on), because:

* the jsDelivr DuckDB-WASM bundles are `mvp` and `eh`, neither of which uses threads, so the local engine gains nothing;
* with the worker on, every fetch from the page to the (mock) tileserver on `http://127.0.0.1:9000` failed with `net::ERR_FAILED`, while fetches to jsDelivr and OpenFreeMap over HTTPS kept working. Adding `Cross-Origin-Resource-Policy: cross-origin` to the tileserver's responses did **not** fix it, so the cause is the worker's handling of plain-HTTP cross-origin requests rather than the missing header. Not chased further; the rule for now is do not combine `?coi` with a local tileserver.

The MotherDuck client may need isolation; its docs do not say. If connecting fails with a SharedArrayBuffer error, add `?coi` to the URL.

## JS libraries for analysis and charts on DuckDB-WASM

Looked at for the "understands the schema, analyze and visualize" question. Versions are what npm reported on 2026-10-23.

| Library | What it is | Fit |
| --- | --- | --- |
| [Mosaic / vgplot](https://idl.uw.edu/mosaic/) 0.34 (UW IDL) | Grammar of graphics on Observable Plot; marks are DuckDB clients, so binning, hexbins, M4 line reduction and cross-filtering run as SQL. `wasmConnector` takes an existing DuckDB-WASM instance; `restConnector` / `socketConnector` talk to a server. | **Best fit.** Used in this spike. Interactive selections (brush, crossfilter) are a few lines. Also the library MotherDuck's own wasm-client examples use. |
| [Observable Plot](https://observablehq.com/plot/) | The chart layer under vgplot; use it directly for a one-off chart from query rows. | Good for simple charts with no interactivity. |
| [SQLRooms](https://sqlrooms.org/) (Foursquare) | React framework for browser-first analytics apps on DuckDB-WASM: schema tree, SQL editor, Mosaic integration (`@sqlrooms/mosaic` 0.15). | Right if a React app is on the table. Too much for Selecter's no-build rule. |
| [Perspective](https://perspective.finos.org/) (FINOS) | WASM pivot grid + charts with its own engine; does not query DuckDB, takes Arrow in. | Good data grid; duplicate engine. |
| [Arquero](https://idl.uw.edu/arquero/) | Pure-JS columnar dataframes with a dplyr-like verb API, Arrow in/out. | Fallback for a no-wasm deployment; loses SQL and Parquet. |
| [duckdb-wasm-kit](https://github.com/holdenmatt/duckdb-wasm-kit) | React hooks and file-import helpers around DuckDB-WASM. | Thin; React only. |
| [Malloy](https://www.malloydata.dev/), [Evidence](https://evidence.dev/) | Semantic modelling / reporting on DuckDB. | Server or build-step tools, not in-page libraries. |

## Open questions and next steps

* **Scale.** Run a 100k-feature file; switch to Arrow if `read_json` is the bottleneck.
* **Fuzzy joins.** JoinKit's normalizers produce a `(raw_key, fid)` crosswalk; insert it as a table and do the aggregate join in SQL. Not wired yet.
* **Point in polygon.** `assignPointsToPolygonsChunked` → `(row_id, fid)` table → SQL. Not wired yet.
* **Persistence.** DuckDB-WASM can persist to OPFS; the geometry needs its own store (OPFS or IndexedDB) keyed by the same layer id.
* **MotherDuck end to end** with a real token, including `ATTACH`-ing shared databases and the upload-then-send-only-fids path.
* **Tileserver data path.** A script that takes a MotherDuck table (or a browser Parquet export) and refreshes the tileserver's DuckDB file.
