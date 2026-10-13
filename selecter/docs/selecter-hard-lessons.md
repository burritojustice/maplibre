# Selecter · Hard Lessons

*2026-10-08 · John Oram*

Things that seemed obvious, weren't, and cost real time to fix.

## MapLibre layer ordering

**The rule:** insert new layers with `beforeId` set to the first symbol layer (usually `settlement-label` or similar). Don't hardcode the layer ID — query `map.getStyle().layers` and find the first layer with `type: 'symbol'`.

**Why it matters:** if you insert a fill layer after symbol layers, it paints over labels. If you insert it at the end with no `beforeId`, same problem. Always insert fills and lines before symbols.

**The slot system (MapLibre v3+):** v3 introduced slot-based layer ordering (`"slot": "bottom"` / `"middle"` / `"top"` in the layer spec). If the basemap style uses slots, `beforeId` may be ignored. Check whether the active style defines slots before deciding which insertion method to use.

**Never remove and re-add layers.** Use `setPaintProperty()` and `setLayoutProperty()` to change visible properties. Remove+re-add causes a flash, loses ordering position, and is unnecessary. Exception: swapping the data source entirely (e.g. basemap switch) — in that case re-add everything from scratch in the `style.load` handler.

## Flex column alignment in the join table

The join table uses a flex row per record with fixed-width column divs. Getting columns to stay aligned across header and data rows took three attempts.

**What didn't work:**
- CSS `flex: 0 0 ${COL_W}px` on a class — overridden by `<select>` intrinsic sizing
- `min-width` / `max-width` without `flex-shrink: 0` — columns still stretched

**What works:** inline styles on every cell: `width: ${COL_W}px; flex-shrink: 0; flex-grow: 0`. Apply to both header and data cells. The header uses `<button>` elements (for sort clicks) and data cells use `<div>` or `<select>` — all three need the same explicit inline treatment.

The expander column (`EXPANDER_W = 16px`) is a separate fixed column on the left in 1:many mode. Don't try to make it part of the same flex row logic as data columns — keep it isolated with its own width.

## Join key type normalization

GeoJSON feature properties can be numbers or strings depending on how the file was produced. CSV values are always strings (from Papa Parse). When matching a CSV key value to a GeoJSON property, you must normalize both to strings:

```js
String(feature.properties[propKey]) === String(csvRow[csvCol])
```

**The leading-zero edge case:** a GeoJSON property with value `1` (number) and a CSV key of `"01"` (string with leading zero). Both normalize to `"1"` and `"01"` respectively — they don't match. There is no clean fix without knowing domain intent (is `01` the same as `1` or not?). Currently unresolved; it surfaces with FIPS codes and census tract IDs.

## Single-file HTML constraints

No build step means real constraints:

- **No ES modules.** No `import`/`export`. Everything is in one `<script>` block, global scope.
- **No top-level await.** Use `.then()` chains or wrap in an IIFE.
- **CDN only for dependencies.** No npm, no bundler. Lock CDN versions where possible to avoid surprise breakage.
- **`node --check` is the linter.** It catches syntax errors (missing brackets, bad template literals) before the browser does. Run it every time.
- **DOM as state.** There's no reactive framework. When state changes, re-render the affected panel section by rebuilding its innerHTML. Keep render functions idempotent — they should be safe to call multiple times.

The upside: one file, no dependencies to install, works offline after CDN resources are cached, trivially shareable.

## MapLibre expression edge cases

**Null properties:** features with no value for a property return `null` in expressions. `["get", "join_count"]` on a feature with no join returns `null`, not `0`. Use `["coalesce", ["get", "join_count"], 0]` wherever null would break a numeric expression.

**`match` expressions require string or number:** if the match input might be a non-string type, wrap it: `["to-string", ["get", "prop"]]`. A boolean or null input causes a runtime expression error with no helpful message.

**`interpolate` requires a non-null numeric input:** always guard: `["case", ["!=", ["get", "join_val_score"], null], ["interpolate", ...], fallback_color]`. Without the guard, a single null feature silently breaks the entire color expression for the layer.

**Expression errors are silent in production.** MapLibre logs them to console but doesn't throw. The layer just renders with its fallback color. Always test with `console` open when debugging color/label expressions.

## Other caveats

**Terrain label distortion:** when terrain (3D elevation) is enabled, text labels on line layers pitch with the terrain by default, which looks wrong. Fix: after every `style.load`, iterate symbol layers and set `text-pitch-alignment: map`. Encapsulated in `applyLineLabelPitchAlignment()`.

**Basemap switch loses all layer state:** `map.setStyle()` destroys all sources and layers. Re-add everything from `_geojsonData` and `_joinStore` in the `style.load` handler. Use a `_pendingBasemap` flag to signal "a switch is in progress" so other `style.load` handlers don't double-fire.

**Style load race with async operations:** if the user drags a file while a basemap switch is in progress, `_loadGeoJSON` may fire before `style.load`. Guard with `map.isStyleLoaded()` and defer via a one-shot `style.load` listener if not.

**`_shapeMap` must be reset on layer reload.** When `_loadGeoJSON` runs for a new file, `_shapeMap` (the shape→base-layer binding) must be cleared. Otherwise a stale shape overlay stays linked to the old layer ID and subsequent shape operations error.

**GeoJSON hint system:** Selecter detects probable display name properties (`name`, `NAME`, `label`, `title`, etc.) at load time and stores the guess as `_displayNameProp`. This is heuristic — it can pick the wrong property if a file uses an unusual schema. The right-panel name picker lets the user override it.
