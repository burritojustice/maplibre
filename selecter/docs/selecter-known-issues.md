# Selecter · Known Issues

*2026-10-08 · John Oram*

Active bugs, limitations, and environmental quirks. Updated as issues are found and fixed.

## Active bugs

**Leading-zero key mismatch** — GeoJSON numeric property `1` and CSV string key `"01"` both normalize to different strings (`"1"` vs `"01"`) after `.toString()`, so they don't match. Affects FIPS codes, census tract IDs, ZIP codes, and any identifier where a leading zero is meaningful. No fix yet; workaround is to pre-process the CSV to strip leading zeros, or pre-process the GeoJSON to store IDs as strings with leading zeros preserved. JoinKit's `makeKeyNormalizer({ stripLeadingZeros: true })` or `padStart` handles this; not yet exposed in Selecter's join dialog.

**`_jrpCols` stale after column rename** — If the user adds a column, then a new join replaces the existing one with different property names, `_jrpCols` may still contain the old column name. The column chooser will show the old name as "active" but render nothing. Fix: clear `_jrpCols` in `_clearJoin()` before applying a new join.

**Shape badge not clearing on layer reload** — `#shapes-badge` shows `· N shapes on <layer>` when shape mode is active. If the user loads a new GeoJSON without explicitly clearing shape mode, the badge text persists even though the old shape layer is gone. `_loadGeoJSON` should reset the badge, but currently doesn't always.

**Popup flickers on rapid hover** — on layers with many features, moving the mouse quickly across feature boundaries causes the popup to flicker as it opens and closes. The hover debounce is currently 0ms. A 30–50ms debounce would fix it without making the popup feel sluggish.

**Numeric `0` join key treated as empty** — `normVal(0)` returns `''`, so a row or feature whose key is the number 0 (not the string `"0"`) never matches. CSV keys are always strings so this only affects GeoJSON-to-GeoJSON joins. Kept in JoinKit's `normVal` for parity; `makeKeyNormalizer()` treats 0 as a real key.

**Two copies of the numeric-column heuristic** — the stats-column picker in `_runJoinFlow` uses `_isForcecatQuick`, a shorter version of the forced-categorical list in `JoinKit.isForcedCategorical`. They disagree on a few column names (e.g. `region`, `area`, `mobile`), so a column can be offered for stats and then classified categorical. Fix: switch the picker to `JoinKit.classifyColumns`.

## Browser / environment quirks

**Firefox drag-and-drop** — Firefox fires `dragover` and `drop` events correctly, but the `dataTransfer.files` list is sometimes empty on the first drag event after page load. Subsequent drags work. No repro pattern identified; likely a Firefox security restriction around file access timing.

**Safari large GeoJSON** — Files above ~50 MB stall on the `JSON.parse` step in Safari, which doesn't yield to the UI thread during parse. The map appears frozen for several seconds. Chrome handles the same file without noticeable pause. No fix; Safari users should use smaller files or clip before loading.

**Terrain on HTTP** — MapLibre's terrain feature requires `SharedArrayBuffer`, which requires HTTPS + COOP/COEP headers. Loading `map-viewer.html` from a local `file://` URL or plain HTTP disables terrain silently. No error is shown. If terrain controls appear but do nothing, this is likely the cause.

## Performance limitations

**Join aggregation for large CSVs** — resolved: matching is indexed (`JoinKit.buildFeatureIndex` builds a `Map` keyed on the normalized property value), so a join is O(rows + features).

**`_jrpRender()` full innerHTML rebuild** — the right panel table is rebuilt from scratch on every sort, filter, or expand operation. For layers with thousands of features this causes a visible repaint delay. A virtual scroll or incremental render would fix it but adds significant complexity.

**Label suppression heuristic** — labels are suppressed for layers above `MAX_LABEL_FEATURES = 2000` features to avoid MapLibre performance issues with dense label expressions. The threshold is conservative; in practice, simple labels on polygon centroids can handle 5000+ features without issue. The limit should be configurable.

## Missing guards

**No file type validation on drag-drop** — any file can be dragged onto the map. If it's not a valid GeoJSON or CSV, the error surfaces deep in the parse pipeline with a generic message. Should check file extension and MIME type before parsing.

**No join cleanup on layer reload** — `_loadGeoJSON` does not call `_clearJoin()`. If a join is active when the user loads a new file, `_joinStore` retains stale state from the previous join. The new layer renders correctly, but the join table may show old data until a new join is run or the panel is closed and reopened.

**No MapLibre style error surface** — if `map.setStyle()` fails (bad URL, network error), MapLibre logs to console but Selecter shows no user-facing error. Should listen for the `error` event on the map and surface a toast.

**`properties: null` features throw** — GeoJSON features with `properties: null` (valid per spec) cause a null-reference error in `_loadGeoJSON` when building `_gvid` and in `_jrpRender()` when reading property values. Guard: `feature.properties = feature.properties || {}` at load time.
