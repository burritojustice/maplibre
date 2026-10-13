# Selecter · Code Guide

*2026-10-08 · John Oram*

Reference for working inside `map-viewer.html` — conventions, module boundaries, and the non-obvious fixes that took time to figure out.

## File structure

`map-viewer.html` is a single file. Top to bottom:

1. `<head>` — charset, viewport, title
2. CDN `<link>` tags — MapLibre GL CSS, any icon font
3. CDN `<script>` tags — MapLibre GL JS, Turf.js, Papa Parse, others
4. `<style>` block — all CSS, including panel layout, join table, welcome screen
5. `<body>` — DOM skeleton: `#map`, `#right-panel`, `#welcome`, dialogs, status bar
6. `CONFIG` block — named constants at the top of the `<script>`
7. State variables — `_map`, `_geojsonData`, `_joinStore`, `_shapeMap`, etc.
8. Utility functions — formatters, `_gvid` assignment, expression helpers
9. Map init — `new maplibregl.Map(…)`, `map.on('load', …)`
10. File load pipeline — drag-drop, `<input>`, URL fetch → `_loadGeoJSON()`
11. Join pipeline — `_runJoin()`, `_applyJoin()`, `_joinStore` management
12. Right panel — `_jrpRender()`, `_jrpCols`, sort/filter/expand logic
13. Style panel — color ramp, label expression, size-by
14. Shape mode — `_applyShapeLayer()`, `_shapeMap`, `_SHAPE_NONE`
15. Welcome screen — card list, action buttons, drag-drop target
16. Event wiring — all `addEventListener` calls at the bottom

## CONFIG keys

| Key | Default | Purpose |
| --- | --- | --- |
| `_BUILD_VERSION` | `'v965'` | Shown in UI status bar; bump on every ship |
| `_BUILD_TIMESTAMP` | ISO string | Set at build time |
| `DEFAULT_CENTER` | `[-122.43, 37.77]` | SF — map loads here |
| `DEFAULT_ZOOM` | `12` | Initial zoom |
| `DEFAULT_BASEMAP` | `'streets'` | Which basemap tile set loads first |
| `COL_W` | `140` | Pixel width of every join table data column |
| `EXPANDER_W` | `16` | Width of the ▾ expander column in 1:many mode |
| `MAX_LABEL_FEATURES` | `2000` | Label expression suppressed above this feature count |
| `JOIN_SAMPLE_ROWS` | `5` | Rows shown in join dialog preview |
| `_SHAPE_NONE` | `'none'` | Sentinel value meaning "no shape active" |

## Build workflow

1. Edit `map-viewer.html` directly — no transpile, no bundle step.
2. Bump `_BUILD_VERSION` and `_BUILD_TIMESTAMP` at the top of the `<script>`.
3. Run `node --check map-viewer.html` — catches syntax errors before opening in browser.
4. Open in browser and smoke-test the change.

**Never ship without `node --check`.** A syntax error in a 5000-line file is painful to locate by hand.

## Naming conventions

- **`_underscore` prefix** — module-level state variables and private functions. Not a class; just a convention to distinguish them from local variables.
- **`_jrp` prefix** — join right panel: `_jrpRender()`, `_jrpCols`, `_jrpDefaultCols()`, `_jrpSort`, `_jrpFilter`.
- **`_joinStore`** — the single join state object. All join data lives here: `rows`, `allRows`, `byGvid`, `csvCol`, `propKey`, `headers`, `numericCols`, `isLookup`, `rowFilter`, `displayNameProp`, `csvTotals`, `joinedTotals`.
- **`gvid` / `_gvid`** — stable string ID assigned to every GeoJSON feature at load time. All join, hover, and selection state keys on `_gvid`, never on array index.
- **Element ID prefixes** — `jrp-` for join right panel elements, `sp-` for style panel, `bs-` for basemap switcher, `dlg-` for dialogs.

## Key modules

**`_loadGeoJSON(geojson)`** — entry point for all file loads. Assigns `_gvid` to every feature, sets `_geojsonData`, calls `_applyLayer()`, resets join and shape state.

**`_runJoin(file)`** — reads a CSV or GeoJSON join source, scores key candidates, opens the join dialog.

**`_applyJoin()`** — takes confirmed key pair + filter from the dialog, builds `_joinStore.byGvid`, injects join properties into `_geojsonData` features, triggers `_jrpRender()`.

**`_jrpRender()`** — full rebuild of the right-panel table from `_joinStore` state. Always forces `_jrpCols[0]` to `displayNameProp` before rendering.

**`applyLineLabelPitchAlignment()`** — post-style-load fix; see Non-obvious fixes below.

**`_applyShapeLayer(shapeGeoJSON, targetLayerId)`** — loads a second GeoJSON as a shape overlay, links it to the active layer, updates `#shapes-badge`.

## Non-obvious fixes

**`applyLineLabelPitchAlignment()`** — MapLibre renders line labels flat by default when terrain is on, which distorts them at pitch. Call this after every `style.load` event (including basemap switches) to set `text-pitch-alignment: map` on all symbol layers that follow a line layer. Without it, street labels tilt on tilted maps.

**Fixed-width join table columns** — every column `<div>` gets `width: ${COL_W}px; flex-shrink: 0; flex-grow: 0` as inline style. Do not rely on CSS alone: `<select>` elements and `<button>` elements have different intrinsic sizing, and without explicit fixed widths the columns drift.

**`_jrpCols[0]` guard** — `_jrpDefaultCols()` can return the display-name property as the first col or not, depending on what data came back. At render time, always force `_jrpCols[0] = _joinStore.displayNameProp` before building rows. This prevents the name column from being displaced when the picker re-renders.

**`.toString()` normalization** — in `_applyJoin()`, both the GeoJSON property value and the CSV key value must be converted with `.toString()` before comparison. GeoJSON numeric properties and CSV strings won't match otherwise. (Known edge case: leading-zero keys like `"01"` match integer `1` after toString — no fix yet, tracked in Known Issues.)

**Basemap switch order** — when switching basemap, set a `_pendingBasemap` flag, call `map.setStyle(newStyle)`, then in the `style.load` handler re-add all layers (GeoJSON source, paint layers, shape layer) from current state. If you try to add layers before `style.load` fires you get "source does not exist" errors.

**`_gvid` assignment** — done once at `_loadGeoJSON` time, stored as `feature.properties._gvid`. Never reassign. If a reload resets `_geojsonData`, `_gvid` values start over — which is fine because join and hover state is also cleared at that point.
