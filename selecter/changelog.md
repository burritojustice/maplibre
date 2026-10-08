# What Is This?

A single-file MapLibre GL web app for loading, inspecting, styling, and selecting GeoJSON features — points, lines, and polygons. Works offline, no server required. Three primary modes: **File** (GeoJSON data), **Tiles** (live vector tiles from the basemap), and **Working** (features pinned across sessions).

## Changelog — GeoJSON Viewer / Selecter (map-viewer.html)

Reverse chronological. Build/revision numbers (`vNNN`) are included from the point
they started being tracked in-file; earlier sessions predate that convention and
are described by date and feature area only.

---

## Join Right Panel (Step 3) · Sep 15–16, 2026 · v908–v911

### v911
`_jrpFieldsExpanded` set (keyed `"gvid:rowIndex"`) tracks per-row field expansion independently of `_jrpDetailShowAll` (row count expansion). "+N more fields" expands a single row's fields; "Show all N rows" expands only the count. Both sets reset on panel open. `_clearJoin` and `_clearFileData` reset all JRP state and call `_renderJoinRightPanel()`.

### v910
Bidirectional map ↔ table sync: hovering a map feature highlights its table row and scrolls it into view (`_jrpHighlightRow`); clicking a map feature expands its accordion row (`_jrpExpandRow`). Hovering a table row calls `setHoveredFeature()` to highlight the feature on the map. "Show all N rows" button in expanded accordion detail.

### v909
Fixed missing `<div id="map">` — accidentally consumed by str_replace inserting join panel HTML, causing MapLibre "Container 'map' not found" error.

### v908
Join right data panel (Step 3) built. Toggle button "⤵ Data" on right map edge, appears when join active on File tab. 400px fixed panel, resizable. Header: filename + join key + feature count. Column pills with × to remove. Sort header bar (click to sort asc/desc with ↑↓). Table rows: one per joined geometry, ▸ expand arrow. Accordion detail: CSV rows for that geometry with key:value pairs, 3 rows / 8 fields by default. Footer CSV totals. `+` picker for adding columns. Default columns: geometry key prop + count + sum/pct per numeric col.

---

## Join Pipeline — Cleanup & Working Tab · Sep 14–15, 2026 · v902–v907

### v907
Pluralization: "5 rows do not match, and 2 rows are missing data." Export visible now offers "GeoJSON + joined properties" option (was only available on export selected).

### v906
Fixed `nullRows` undefined ReferenceError crashing join dialog — should have been `nullCount`.

### v905
Join dialog match summary rewritten: "In the 'Zip Code' column, 18 of 21 unique values (86%) within 76 of 80 CSV rows (95%) match 21 of 32 map features (66%). 3 rows do not match, and 1 row is missing data." Working popup no longer shows stale File join data — `_getJoinEntries` checks `activeTab` and reads from embedded feature properties in Working tab. `join_data_source` property added.

### v904
Join panel geometry line hover fixed (title= on correct element). CSV rows line font matches geometry line (11px bold). Null row count shown ("· 5 null"). Per-value unmatched counts in hover tooltip. `_joinStore.nullRows` stored.

### v903
`serializeGeoJSON()`: pretty-prints properties, compact coordinates (no newline per coordinate pair). "GeoJSON + joined properties" export now works — features passed with `_gvid` intact, cleaned in `clean()`. `join_data_source` + `join_join_key` added to exports and Working pin.

### v902
`_moveToWorking` no longer includes join-highlighted features when pinning selected — only uses `highlightedIds` when no `selectedIds` AND no `_joinStore`. Clearing Working no longer wipes File selection state (conditional on `activeTab === 'working'`). `_getJoinEntries` handles Working tab by looking up `_gvid` from feature properties.

---

## Join Pipeline — Stats, UI & Labels · Sep 11–15, 2026 · v867–v901

### v901
"Join data" no longer triggers `fitBounds`. "Highlight only" still fits to matched features.

### v900
`ingestGeoJSON` now respects top-level GeoJSON `bbox` property (RFC 7946) for `fitBounds`. Falls back to coordinate scan. SF Supervisor Districts GeoJSON updated with mainland-only bbox excluding Farallons.

### v899
Join palette restored after basemap switch: `_applyJoinFeatureStates()` called in `map.once('idle')` callback after `setStyle`.

### v898
Prefix zoom slider moved inline with checkbox label: "Prefix stats labels (above zoom 12.0)". `.toFixed(1)` prevents jumping between 12 and 12.0.

### v897
Join dialog layout: `1fr 64px 1fr` grid consistent across header, match rows, samples, and join field dropdowns. Score bar is a proportional-width fill div contained in the center cell.

### v896
Join dialog header: two-column grid (CSV filename + row/col count | GeoJSON filename + feature/prop count). Match summary shows geometry percentage. Join sidebar panel: file/key moved into toggle bar badge, Color by inline label+select.

### v895
`$` prefix no longer added to `% of Awarded` labels — pct props excluded from currency prefix via `!isPct` check.

### v894
`join_pct_X` labels now work: pct values back-filled into each feature's `agg` immediately after `csvTotals` computed, so `_writeJoinLabelProp` can find them via `agg["pct_Awarded"]`.

### v893
`join_pct_X` and `join_pct_Y` added to Label as multiselect and Color by dropdown (were missing from the stat aggregation iteration).

### v892
`_isForcecat` partial match switched from `String.includes()` to token split on `_`: `"awarded".includes("ward")` was incorrectly force-categorizing "Awarded Amount". Now `tokens.includes("ward")` — "awarded" splits to `["awarded"]`, no false match.

### v891
Sidebar title shows join: "SF Supervisor Districts joined to Leader View.csv" at all four `sidebar-subtitle` update sites. Stats column picker in dialog excludes zip/district via `_isForcecatQuick`. `join_pct_X` logging added.

### v890
`_isForcecat` extended: district/ward/zone/sector names + small-integer identifier heuristic (values 1–99, ≤20 distinct → categorical). Copy ⎘ buttons on unmatched geometry and CSV value lines in join panel. Hover tooltip on CSV rows line shows per-value unmatched counts sorted by frequency.

### v889
Join dialog: two-column header with file names and counts. Match summary updated: "18 of 21 CSV values match (86%) · 10 of 11 features (91%)". Label as multiselect: CSV stats first, join key prop italicized at top.

### v888
Label as shows only numeric stats (count, avg, sum, min, max, median, % of). Categorical modes (`join_mode_*`) removed from label menu, prop list, and popups — deferred to right panel (Step 3).

### v887
Fixed MapLibre error: `['zoom']` must be top-level in `step`/`interpolate`. Zoom threshold now wraps the complete `text-field` expression in `updateLabels()` — builds no-prefix and with-prefix expressions, wraps in `['step', ['zoom'], noPrefix, threshold, withPrefix]`.

### v886
Prefix stats labels zoom threshold: slider in Join section controls zoom below which labels show plain values, above which they show prefixed values ("avg: $45K"). Default z12.

### v885
Join props in hover and pinned popups: `_getJoinEntries(gvid)` appends count + formatted numeric agg entries. Join entries render in teal italic with "⤵" prefix. RFC 4180 CSV parser: handles quoted fields containing newlines (fixes phantom extra rows from multi-line cell values).

### v884
`gv-labels-poly` added to `_tabGvLayers` — centroid labels hidden in Working tab. Palette breakage on tab switch fixed: `switchDataset('file')` rebuilds `propData` and reapplies join feature states. `_joinLabelPrefix` checkbox with zoom threshold slider added to Join section.

### v883
Zip codes and census IDs force-categorized: `_isForcecat()` checks name list (zip, geoid, fips, tractce, countyfp, phone, year, etc.) and zero-padded string pattern. Two-line join summary: geometries joined and rows joined shown separately. Hover on geometry line shows unmatched feature IDs.

### v882
Label as multiselect optgroups: "⤵ CSV stats" first, "📍 Geometry" second. `buildFrozenHTML` and hover popup both call `_getJoinEntries()` to show join data.

### v881
MultiPolygon centroid: **vertex count** used to pick representative sub-polygon instead of bbox area. Farallons fixed — mainland SF has 571 vertices vs 93 for the islands. Sidebar title shows join filename.

### v880
`updateLayerFilters()` fixed: was resetting `gv-labels` filter back to include Polygons on every palette/filter operation. Now always `['Point','MultiPoint']` only; polygon labels handled via `_updatePolyLabelCentroids()`. Hidden features excluded from centroid source. Auto-apply `join_count` as palette and label after join.

### v879
Diagnostic logging in `addLabelLayer` and `updateLabels` confirming layer existence, placement, filter, and text-field.

### v878
Currency detection threshold: ratio lowered from 50% to 10% for name-hinted columns (amount/award/grant/etc.) — fixes "Awarded Amount" at 35% parseable ratio.

### v877
Currency minimum count: columns with `$` values require only 1 parseable value (not 3). Fixes sparse columns. `numericHeaders` in dialog uses same threshold.

### v876
Currency support in join pipeline: `parseCurrencyVal()` strips `$` and thousands commas. Name hints detect currency columns. Labels formatted with `toLocaleString` ($45K, $1.2M). `_writeJoinLabelProp` formats pct as "12.3%" and currency as "$45K".

### v875
Join section in sidebar below Background: collapsible, matching Background header style. File/key in badge. Color by inline dropdown. Label as click-to-toggle multiselect. Stats column picker in dialog. Filename labels above join field dropdowns.

### v874
Join section panel added to sidebar. `_clearJoin` clears labels, centroid source, palette. Clear file dialog mentions active join. Join panel auto-expands after join completes.

### v873
Auto-apply `join_count` as palette (quantile) and label after "Join data". `renderSidebar()` called after to sync label checkboxes immediately.

### v872
Root fix for double polygon labels: `updateLayerFilters()` was resetting `gv-labels` to include Polygon on every palette/filter call. Now always Points-only; polygon labels via centroid source.

### v871
Centroid labels: `_updatePolyLabelCentroids` filters `hiddenIds` before populating centroid source. Hidden polygons produce no centroid point.

### v870
`symbol-placement: 'polygon'` not supported in MapLibre 5.x → switched to separate `geojson-poly-labels` GeoJSON source. `_updatePolyLabelCentroids()` computes one point per polygon at blended bbox-center/vertex-centroid. One point = one label, no tile-boundary duplication.

### v869
Diagnostic logging in label layers: placement, filter, text-field logged on creation and on each `updateLabels()` call.

### v868
`symbol-placement: 'polygon'` attempted with `symbol-avoid-edges: true` and `symbol-spacing: 5000` (later discovered unsupported in MapLibre 5.x).

### v867
Join pipeline Steps 1–2 complete. `_joinStore` data model with `byGvid`, `numericCols`, `catCols`, `aggColumns`. `_computeJoinAgg`: count, avg, sum, min, max, median, stddev per feature. `_applyJoinFeatureStates` injects into feature state for palette use. Join dialog: match scoring, column-name + value-based matching, `_displayJoinPropName`. Highway shields hidden by default. Polygon centroid labels via `gv-labels-poly`.

---

## Join Dialog & Matching · Sep 4–11, 2026 · v839–v866

### v866
Join UI: join section collapsible below Background, status panel with geometry/row counts, hide unmatched checkbox, clear join button. `_displayJoinPropName` formats display names.

### v865
Filter/select/highlight/exclude work on join props via `_getFeatureVal(f, key)` reading from `_joinStore.byGvid[gvid].agg`.

### v864
Filter/hide works for join props: `applyPaletteToLayers` detects join props and reads from feature-state. `buildQuantitativePaletteColorExpr` uses `['feature-state', prop]`.

### v863
Sample values in join dialog: each match row shows CSV samples → GeoJSON samples aligned in grid. Score bar proportional to match quality.

### v862
Palette activation fixed: `isColorProp: true` on join props caused wrong palette branch.

### v861
Categorical join prop palette: `buildPaletteColorExpr` uses `['feature-state', prop]` in match expressions.

### v860
Palette restoration: session restore clears stale join palette props when `_joinStore` is null.

### v859
`join_count` palette when all values = 1: `injectJoinProp` checks `range > 0` before skipping numeric injection.

### v858
Label error fixed: `feature-state` not allowed in `text-field` (MapLibre hard restriction). `_writeJoinLabelProp` writes join values into `_jl_*` feature properties for label access.

### v857
`loSlider` null crash on second join prop: safe element IDs via `key.replace(/[^a-zA-Z0-9]/g, '_')`.

### v856
`computeNumericStatsFiltered` reads join values from `_joinStore.byGvid[gvid].agg`.

### v855
`filterLoInput` null crash fixed. Numeric filter panel uses safe element IDs.

### v854
Join pipeline Steps 1–2: `_joinStore` data model, `_buildJoinStore`, `_computeJoinAgg`, feature-state injection. Palette expressions detect join props via `_isJoinProp` flag.

### v853
`working-fill` inserts before `address_label` matching polygon layer ordering.

### v852
Draw order pill added to Working polygons (Under/Over roads).

### v850–v851
Basemap layer ordering confirmed from live layer dump. `GV_FILL_BEFORE = 'roads_tunnels_other_casing'`, `GV_LINE_BEFORE = 'address_label'` constants established.

### v849
Diagnostic logging: `[layers] full basemap order:` logs all non-gv layer IDs on data load.

### v848
Layer insertion logic: `gv-fill` before first road layer; `gv-outline`/`gv-line` before `address_label`.

### v847
`firstRoadLabelId` was matching `roads_oneway` (arrow symbols) instead of text labels — fixed.

### v846
Layer ordering console logs: `firstRoadId`, `firstRoadLabelId`, `firstLabelId`.

### v845
Local server directory listing: nginx autoindex detection, file browser improvements.

### v844
Welcome screen closes before opening Samples modal.

### v843
Unified `openSamplesModal()`: centered overlay matching URL dialog style.

### v842
Samples item in action bar opens centered modal.

### v841
Samples button delegation chain fixed.

### v840
`menu.style` null crash fixed; `#sidebar-samples-menu` added to static HTML.

### v839
Join dialog: two scored sections ("✓ Column-name matches" green, "~ Value matches" yellow). Click row to select join fields.

---

## CSV Import, WKT, Explode & Elevation Fixes · Aug 31–Sep 4, 2026 · v820–v838

### v838
`_COORD_PAIR_RE` tightened: requires decimal point in matched numbers to reduce false positives.

### v837
Column-name match priority: exact > prefix > suffix > contains. `_PREFERRED_JOIN_FIELDS` list for common geo keys (district, zip, cnn, etc.).

### v836
TDZ fix: `const hasTwoPoints` declared after reference — moved before use.

### v835
Full WKT support in CSV import: POINT, LINESTRING, MULTILINESTRING, POLYGON, MULTIPOLYGON, GEOMETRYCOLLECTION.

### v834
CSV selecter export detection: reads `# _selecter_export=selection` header and routes to ID-list import.

### v833
CSV ID-list import: property value index built across all features, matches by any property value.

### v832
Radio button alignment fixed in join/import dialogs.

### v831
CSV import column detection rewritten: lat/lng columns first, then geometry column, then coordinate pair parsing.

### v830
CSV import auto-detection: column names, coordinate formats, WKT geometry columns. Drag-and-drop CSV support.

### v829
Elevation batch concurrency restored to 8.

### v828
Elevation CORS cache poisoning root cause identified. DEM fetches use `?src=selecter` query param to prevent cache sharing with MapLibre's internal tile fetches.

### v827
CORS cache poisoning fix documented. Elevation fetches bypass browser cache via `cache: 'no-store'`.

### v826
Elevation batch concurrency reduced to 1 (sequential) to diagnose 429 rate limits.

### v825
Hidden feature elevation points fixed. `debugElevation` console command added.

### v824
DEM tile cache race condition fixed: canvas cached only after image fully loads, not before.

### v823
DEM tile cache race condition fixed in batch calculation. Retry logic for failed tiles.

### v822
Elevation labels: white text with dark halo, rounded meters, zoom-faded between z14–15.

### v821
Point sampling cap removed. `_computeElevationForFeature` samples every vertex for shorter features.

### v820
Unified explode dialog: both point and segment options with advisory notes. Dense geometry warning.

---

## Elevation Profiles & Visualize · Aug 15–31, 2026 · v775–v819

### v819
`calculateElevationBatch` store-aware: detects File vs Working tab context, uses correct feature store. Elevation results stored in `_selecter_elevations` on file store features.

### v818
`_ttW = 306` undefined fixed (dropped during header rebuild). Elevation hover in Working tab. 💥 Explode button added to selection bar. All elevation calculations use `_fileStore` regardless of active tab.

### v817
Working line outline fixed. Sidebar panel structure documented as authoritative reference.

### v816
Tab visibility controls: each of File/Working/Tiles tabs shows its correct panels.

### v815
Aqua bar: CSS rule on tab content panels instead of JS-toggled visibility.

### v814
DOM structure rebuilt from v796: `working-panel` inside `settings-panels`, tab visibility JS corrected.

### v813
Panel DOM order matches v796: Elevation → Basemap → Style → Background.

### v811
`switchTab` hides `settings-panels` for Working tab via `requestAnimationFrame`.

### v810
Structural fix: DOM order and tab visibility without JS changes.

### v809
Globe + terrain in `unfreeze()`: detects globe projection + `_terrainEnabled` and adapts approach.

### v808
Explode button checks `highlightedIds` when `selectedIds` is empty — works with search/filter results.

### v807
`unfreeze()` targets MapLibre's internal render loop: clears `map._renderTaskQueue` and `map._frameId`.

### v806
Working features now visible: `working-line-casing` added to layer teardown list in `setupWorkingLayer`.

### v805
Explode: consecutive vertex pairs become segments. A 12-vertex street becomes 11 segments.

### v804
💥 Explode button added to selection bar (orange, beside 📌). Full vertex-based segment explode with slope coloring. Guard against already-exploded features.

### v803
`_ttW = 306` undefined fixed (elevation hover path).

### v802
Visualize pill: Off / Net slope / Max slope / Mid elevation options.

### v799
File tab panel order corrected: Elevation → Basemap → Style → Background.

### v798
Label cross-tab leaks fixed: `updateLabels()` explicitly hides the other tab's label layers on every call.

### v797
Elevation panel hidden on Tiles tab. Working tab elevation cursor fixed.

### v796
`calculateElevationBatch` stores elevation data in `_selecter_elevations` feature property.

### v795
Visualize pill appears after elevation computed.

### v794
Hover chart reads `_selecter_elevations` instead of fetching fresh DEM tiles each hover.

### v793
Fixed-interval elevation sampling strategy: interval varies by feature length (5–100m range).

### v792
Elevation chart pinned by default. Corner panel appears immediately on first hover.

### v791
Net rise bullet added. Tunnel warning. Rise/run axis labels.

### v790
Missing computed properties dialog: Calculate / Skip / Don't ask again.

### v789
Corner panel hides when elevation inspect turned off. Missing computed properties handled gracefully.

### v788
Popup positioning improvements for elevation hover tooltip.

### v787
Elevation chart suppressed from moving tooltip when chart is pinned.

### v786
Bottom-aligned elevation charts: fixed total SVG height (170px = 14 + 80 + 76).

### v785
Fixed 306px tooltip width throughout elevation hover path.

### v784
Elevation tooltip hides when pointer enters sidebar.

### v783
Elevation chart buckets: inner width and height vary by run/rise range.

### v782
Chart scaling fixes and dimension adjustments.

### v781
Chart order pill (Under/Over roads) for elevation layers.

### v780
Chart distance labels: 0 · ¼ · ½ · ¾ · 1.

### v779
Hover tooltip shows full elevation profile chart (SVG, 280px wide, locked to tooltip).

### v778
Popup dismiss timer extended to 8s when elevation cursor is active.

### v777
Hover popup suppressed when elevation cursor is active.

### v776
Five-point elevation sampling: start, ¼, mid, ¾, end of each feature.

### v775
Explicit `type="button"` on elevation control buttons to prevent accidental form submission.

## 2026-08-24 - 2026-08-29 (v700–v774)

### v774 · 2026-08-29 — Contour DataCloneError Fix
**Bug fix:** MapLibre v5's custom protocol system tries to `structuredClone` tile response data across the worker boundary. Safari's structured clone fails on `ArrayBuffer` objects that have been transferred (neutered) during fetch. Fixed by wrapping `mlcontour`'s `addProtocol` handler to `slice(0)` the ArrayBuffer before returning, creating a fresh cloneable copy. Contours are now stable without console errors.

### v773 · 2026-08-29 — Contour Protocol Normalization
Normalized mlcontour protocol return values to `{ data: ArrayBuffer }` — the format MapLibre v5 expects on Safari. Intermediate attempt before the slice fix.

### v771 · 2026-08-29 — Contour Debounce
Added 150ms debounce on `_scheduleContours()` to prevent rapid pill changes from tearing down and rebuilding the contour source while tile requests are in-flight. Added style-loaded guard in `_applyContours()`.

### v770 · 2026-08-29 — Magnet Select + Search Deselect
Dwell-deselecting a feature that was selected by search now correctly clears `filtered`, `highlighted`, and `hidden` feature states, and adds the feature to `filterHiddenIds` so it disappears from the filtered view. Fixed `toggleMapRotate` missing `_setRotateActive(!_rotateActive)` (second occurrence of this bug).

### v769 · 2026-08-29 — Dwell Timer 400ms
Dwell select timer reduced to 400ms on all three tabs.

### v768 · 2026-08-28 — Magnet Select: Tiles + Working Tabs
Extended dwell select to Tile and Working tabs. `_startDwell` and `_dwellBlink` now accept a `source` parameter. Tile dwell uses the same `geoKey` fingerprint as tile click for accurate deselect.

### v767 · 2026-08-28 — Line Defaults
Lines now load fully opaque (Solid, 1.0) by default. Outline mode defaults to None. Width pill hidden until an outline color is chosen.

### v766 · 2026-08-28 — 🧲 Magnet Select Mode
New **Magnet Select** mode (action bar button). Hover any feature for 400ms → 3 magenta blink pulses → feature added to selection (teal). Hover a selected feature → blink → deselected. Works on all geometry types. Uses existing `hovered` feature state for the blink animation. Toggle with 🧲 button in action bar.

### v765 · 2026-08-27 — Symbol Outline Visibility
Reduced SDF sprite padding from 15% to 8%, giving the halo room to render outside the shape boundary. Halo width fixed at 5px.

### v764 · 2026-08-27 — Symbol Halos (SDF)
Shape sprites regenerated as **SDF (signed distance field)** via `sdf: true` in `map.addImage()`. This enables `icon-color` and `icon-halo-color` paint properties, allowing palette colors to apply to symbol shapes and outlines to render via `icon-halo-width`.

### v763 · 2026-08-27 — Palette Pin + Shape Popover Fixes
Pinned palette toast shows when opening any other property. Palette picker blocked with toast when palette is pinned for another property. Shape assignment popover stays open when changing symbols (stopPropagation fix). `gv-point-shape` added to click stack query for deselect.

### v762 · 2026-08-27 — Pin Guard + No-Symbol Labels
Pinned palette correctly blocks property name click path (nameBtn). Only one pin allowed at a time (`pinnedPalettes.clear()` before set). Dwell-deselect now hides feature when a filter is active. Hidden symbols (∅) suppress their labels via feature-state `hidden`.

### v761 · 2026-08-27 — Palette Pinning UI
Palette dot (◉) now cycles through three states on click: **None** (dim) → **Active** (teal, unpinned) → **Pinned** (filled, survives property switching). Toast fires on pin. Opening another property while pinned shows a reminder toast but doesn't switch the palette.

### v760 · 2026-08-27 — Symbol Interaction Fixes
Circles suppressed correctly when shape mode active (guarded in `updateLayerFilters` and `applyPointStyle`). Filter/click operations no longer un-hide circles. `gv-point-shape` included in tile stack query.

### v759 · 2026-08-27 — Shape Palette Colors
Shape sprites use `icon-color` driven by the same `colorExpr` as the circle layer. Switching palettes immediately recolors shapes. Palette on elevation → shapes show elevation gradient. Outline via `icon-halo-color` / `icon-halo-width`.

### v758 · 2026-08-27 — Shape Indicator Improvements
Removed duplicate ◆ from right side of property row. Indicators sized better (palette dot 8px, ◆ 12px). Off button added to shape popover. Shape fill changed to neutral `#e8e8f0` so other-property palettes are readable.

### v757 · 2026-08-27 — Shape Assignment via Property List
Shape assignment moved from Style panel into a **floating popover** triggered by ◆ in the property list. Clicking ◆ on any categorical property immediately assigns shapes and opens the popover. Style › Points › Shapes now only contains Size and Outline. Shapes survive basemap changes.

### v756 · 2026-08-27 — Property Row Indicators
Property rows now show two stacked indicators on the left: ◉ (palette dot, clickable) and ◆ (shape indicator, categorical properties only). The ◆ indicator is accent-colored when that property drives shapes.

### v755 · 2026-08-27 — Shape Style Persistence + Click Fixes
Shape state (`shapeMode`, `shapeProp`, `shapeMap`, `shapeSize`, `shapeOutlineMode`) saved to style JSON and restored on session reload. Symbol layer click now works for hover popup and pinned popup. Shape property shows in popup priority sorting.

### v754 · 2026-08-27 — Shape System Fixes
Circles suppressed when shapes active. Sprite sizes corrected (16–72px at pixelRatio 2). Async race condition fixed with `_shapeApplyInFlight` guard. Auto/Manual modes collapsed into single mode with Reset button.

### v753 · 2026-08-27 — Point Shape System
New **data-driven point shapes** in Style › Points › Shapes. 11 shapes generated as canvas sprites: Circle, Triangle, Inv. Triangle, Square, Diamond, Star, Pentagon, Hex-flat, Hex-point, Plus (+), X. Shapes assigned by categorical property frequency (auto) or manually per value. ∅ (no symbol) hides a value. `gv-point-shape` symbol layer added above `gv-point`.

### v752 · 2026-08-27 — Point Size Split
Size pill split into two rows: Auto / Zoom (adaptive) and Tiny / Small / Medium / Large / Huge (fixed: 2–13px). Separate `point-fixed-size-pill` with `flex-wrap`. Fixed sizes and adaptive modes clear each other's active state.

### v751 · 2026-08-27 — Point Fixed Sizes
Fixed size options added to point radius pill. Density function minimum extended: 10,000+ points → 1px radius. `densityRadiusThresholds` exposed as a mutable `var` for console experimentation.

### v750 · 2026-08-27 — Density Radius
Added 1px tier for 10,000+ points. `densityRadiusThresholds` made mutable for console tuning.

### v749 · 2026-08-27 — Line Outline Width Pill
Added **Hairline / Thin / Medium / Thick** outline width pill. `_outlineExtra()` helper: Hairline=1px, Thin=2px, Medium=4px, Thick=6px per side. Width pill appears/hides based on outline color selection.

### v748 · 2026-08-27 — Line Style Defaults
Line opacity pill: **Solid | Soft (75%) | Translucent (50%) | Ghost (15%)**. Solid is new default. Casing uses `_outlineExtra()` for visible hairline outlines.

### v747 · 2026-08-27 — Pinned Popup Fix
`buildFrozenHTML` was missing `const diffCls` declaration after an edit, causing `ReferenceError` that silently broke all pinned popups. Restored.

### v746 · 2026-08-27 — Elevation Value Units
`_displayPropValue(key, value)` formats `_selecter_*` properties with units in hover/pinned popups: elevation shows `23.8m (78ft)`, slopes show `8.3%`, distances show `km`. Map labels for elevation/slope get unit suffixes. `_selecter_units` metadata written to every feature after batch calculation, hidden from sidebar.

### v745 · 2026-08-26 — Settings Panel Height Cap + Popup Colors
All settings panels (Elevation, Basemap, Style, Background) wrapped in `#settings-panels` with `max-height: 55vh`. Property list hover collapses all three panels. Popup property names white (was muted). Elevation tooltip uses `#c8c8e0` for dim text.

### v744 · 2026-08-26 — Pinned Popup Values
`buildFrozenHTML` now calls `_displayPropValue` for elevation/slope formatting. Fixed missing `diffCls` declaration.

### v743 · 2026-08-26 — Hillshade Mirror + Terrain Mirror Fixes
Hillshade mirror dispatches `change` event on `chk-hillshade-on` correctly. Terrain mirror updates `active` class on mirror label.

### v742 · 2026-08-26 — Elevation Panel First
Elevation accordion panel moved to be first below the green divider (above Basemap). Gets the green accent border. Basemap gets a subtle border.

### v741 · 2026-08-26 — Panel Order Fix
Elevation panel correctly positioned below Basemap after initial placement error.

### v740 · 2026-08-26 — Elevation Accordion Panel
Elevation promoted to a collapsible panel like Basemap/Style/Background. Contains: Elevation data (inspect/calculate/stats), Terrain On/Off mirror, Hillshade On/Off mirror, Contours (moved from Basemap).

### v739 · 2026-08-26 — Elevation Tab (Reverted)
Attempted to make Elevation a sidebar tab — reverted. Correct approach is accordion panel.

### v738 · 2026-08-27 — Contour Export Fix
Fixed geometry nesting bug: MapLibre-contour wraps coordinates as `[subline1, subline2, ...]` (MultiLineString-style) even for LineString. Each sub-line is now pushed as its own segment, fixing the "no geometry" error in QGIS.

### v737 · 2026-08-27 — Contour Export Debug
Added debug logging to identify coordinate nesting depth in exported contours.

### v736 · 2026-08-27 — Contour Export Safety Check
Fixed safety check in contour export — `!Array.isArray(coords[0])` was backwards, now skips only genuinely malformed entries.

### v735 · 2026-08-27 — Contour Merge Export
Tile-boundary contour merging implemented: segments grouped by elevation, endpoint matching via spatial bucket index (TOL=1e-5°, BUCKET=1e-3°). Each merged chain becomes a separate Feature. Console reports merge ratio.

### v734 · 2026-08-27 — Export Visible Contours
**⬇ Export visible contours** button in Elevation panel. Exports contour lines from the current viewport as GeoJSON with `ele`, `ele_ft`, `level`, `source`, `unit`, `detail` properties. Filename includes bbox: `contours-fine-ft-[-122.50,37.75,-122.35,37.85].geojson`.

### v733 · 2026-08-27 — Contour Color Palette
RdYlBu elevation palette for contours: blue (sea level) → yellow (mid) → red (high). **Color** pill in Contour controls: Default | Elevation (RdYlBu).

### v732 · 2026-08-26 — Contour Detail + Rotate Fix
Contour "Auto" renamed to **Medium**, **Fine** is new default. `_setRotateActive` was missing `_rotateActive = on` assignment — rotate button broken since v700, now fixed. Logging removed from subtitle system.

### v731 · 2026-08-26 — Subtitle Clear on Data Clear
`_clearFileData` directly sets `sidebar-subtitle` to "No file loaded" — `renderSidebar` never updated it because the subtitle is set in a separate code path after `addTileSelectionToLayer`.

### v729–v730 · 2026-08-26 — Subtitle Debug + Fix
Added debug logging to all subtitle-setting code paths. Found `addTileSelectionToLayer` was re-setting `currentSourceName = 'map-selection'` after `_clearFileData` cleared it.

### v728 · 2026-08-26 — Sidebar Subtitle Guard
`renderSidebar` shows "No file loaded" when `allFeatures` is empty and `currentSourceName` is empty. Fixed by adding early return before the stats line.

### v727 · 2026-08-26 — Export Filename Suffixes
Export filename appends `-slopes` when `_selecter_slope_pct` is present, `-elevation` for point datasets with `_selecter_elev`.

### v726 · 2026-08-26 — Elevation Stats Table Units
Stats table `elev_m` / `elev_ft` and `pt_elev_m` / `pt_elev_ft` pills now use independent fixed formatters. Global m/ft pill only affects hover tooltip, not the stats table.

### v725 · 2026-08-26 — m/ft Pill
**[m | ft]** pill in Elevation section controls the hover tooltip display unit. Switching updates tooltip immediately. Stats table pills remain independent.

### v724 · 2026-08-26 — Point Elevation Palette + Sync
Point datasets auto-apply RdBu palette on `_selecter_elev` after batch calculation. `_syncElevationButtonState()` called after file load — detects pre-computed elevation, shows Recalculate button and enables Stats.

### v723 · 2026-08-26 — Calculate/Stats Button Row
Calculate elevation and Stats ▸ buttons now side by side. Stats greyed (opacity 0.4, pointer-events none) until calculation completes. Resets on data clear.

### v722 · 2026-08-26 — Button State on Clear
`_clearFileData` resets "Calculate elevation" button text and hides Stats button.

### v721 · 2026-08-26 — Elevation Subsection Label
Elevation controls wrapped in a named "Elevation" subsection between Terrain and Hillshade in Basemap panel (before Elevation was promoted to its own accordion).

### v720 · 2026-08-26 — Elevation Stats: Points vs Lines
Stats panel dynamically rebuilds pills based on geometry types present. Lines: Slope % / Slope ° / Line elev m / Line elev ft. Points: Point elev m / Point elev ft. Summary row stable (no wrapping).

### v719 · 2026-08-26 — Style History Button Removed from Action Bar
`showStyleHistory()` still available via console and export dialog, but 🕐 button removed from action bar.

### v718 · 2026-08-26 — Filter State in Style JSON
`_captureStyleState` now includes `activeFilter`, `hiddenIds`, `filterHiddenIds`. Restored by `_applyStyleState` which calls `doHighlight`/`doFilterSelect`/`doExclude` as appropriate.

### v717 · 2026-08-26 — Palette Filter State in Style JSON
`paletteFilterLo`, `paletteFilterHi`, `paletteFilterHide`, `numericRangeFilter` added to style capture/restore.

### v716 · 2026-08-26 — Style Banner: Session Filename Only
Style restore banner now reads `sourceName` from `sessionStorage._selecter_session`. Only shows banner for the file from the previous session — not any file in the cache. "Clear all" link added to banner.

### v715 · 2026-08-26 — Style Restore Fixes
`_styleCustomized` flag — only saves style to localStorage on unload when user made meaningful changes. Dismiss clears the localStorage entry. "Start fresh" clears style cache. `_showStyleRestoreBanner` called from `_offerSessionRestore` after features are loaded (so Reapply button shows correctly).

### v714 · 2026-08-26 — Style Restore Banner
Style restore banner shows at bottom of screen when previous session had a customized style. Shows filename, age, style summary. Buttons: Reapply style (when file is loaded), Open file…, Save style.json, Dismiss.

### v713 · 2026-08-26 — Style History Panel
`showStyleHistory()` — modal listing all cached styles with filename, summary, age. Apply (current file only), Save .json, × delete per entry. Clear all button.

### v712 · 2026-08-26 — Export/Import Style JSON
`exportStyleJSON()` / `importStyleJSON()` — export and import `.style.json` files. Style files intercepted in drop zone. Export dialog offers: GeoJSON | GeoJSON + style | Style only | Feature IDs… | Cancel.

### v711 · 2026-08-26 — Style Save/Restore to localStorage
`_captureStyleState()` captures palette, labels, line/point/polygon style, filter state. Saved to `localStorage._selecter_style_FILENAME` on unload. Restored on file reload via `_applyStyleState()`.

### v708 · 2026-08-26 — Working Tab Persistence
Working tab features saved to `localStorage._selecter_working_data` (up to 8MB). Auto-restored on startup if session didn't have working features. Toast: "Restored N features from Xm ago".

### v700–v707 · 2026-08-24 — Freeze Hardening
`unfreeze()` reloads from Protomaps style URL, calls `restoreBgLayers()` after. `moveend` guard: returns if style not loaded. `_fetchElevTile` 8s timeout. Auto-pause animation after 30 minutes.


## 2026-08-08 - 2026-08-24 (v655–v699)

### v699 · 2026-08-24 — Freeze Hardening (Round 1)
Three fixes: **`unfreeze()`** now reloads from the actual Protomaps style URL (not `map.getStyle()` which returns null when broken), then calls `restoreBgLayers()` to re-apply satellite/terrain/hillshade/contours. Accepts `unfreeze(true)` for a hard page reload with hash preserved. **`moveend` guard** — `if (!map.isStyleLoaded?.()) return` stops `updateDotsLayer`, `updatePointRadius`, `applyLineStyle`, `applyPolyStyle` from running on a broken style. **`updatePointRadius` double-guarded** with `isStyleLoaded`.

### v698 · 2026-08-23 — Elevation Stats Panel Polish
Stats table layout — 5 columns: bin label (D1/B1) | From | To (right-aligned) | Count | %. **Stats pills** — Slope % / Slope ° / Elevation m / Elevation ft. Elevation ft converts `_selecter_elev_start` × 3.28084 at display time. **Hover popup** — `_selecter_` prefix suppressed from all property name display sites via `_displayPropName(k)`.

### v697 · 2026-08-23 — Display Property Name Formatting
`_displayPropName(key)` strips `_selecter_` prefix from known elevation/slope properties and adds unit suffixes: `_slope %`, `_slope °`, `_elev_start m`, etc. Applied to all popup row renderers.

### v696 · 2026-08-23 — Elevation Stats Panel (First Pass)
Fixed-bottom stats panel with equal-count decile bins and equal-value bins. Console logging shows processing rate, percentiles (p10–p99), and both bin types for slope and elevation. Pills: Slope % / Slope ° / Elevation m / Elevation ft.

### v695 · 2026-08-22 — Auto-Slope Palette Fix
`paletteScheme = 'quantile'` (was `'quantitative'` — invalid). Added `buildPropData()` inside `_applyElevationPalette` so numeric stats are fresh. After batch elevation: auto-applies RdBu reversed quantile palette on `_selecter_slope_pct` (red=steep, blue=flat).

### v694 · 2026-08-22 — Elevation Stats Logging
Statistics logging after batch: rate (features/sec), per-property min/max/mean/median, p10–p99 percentiles, decile bins with counts. Logged to a collapsed console group.

### v693 · 2026-08-22 — Batch Elevation Calculation
**"Calculate elevation" button** in the Basemap panel. Computes `_selecter_elev_start/mid/end`, `_selecter_rise`, `_selecter_run`, `_selecter_slope_pct`, `_selecter_slope_deg`, `_selecter_slope_a_pct/b_pct`, `_selecter_slope_max_pct`, `_selecter_bearing`, `_selecter_elevations[]`, `_selecter_slopes[]` for all features. 20 concurrent DEM fetches. Progress bar with rate display. Button relabels to "Recalculate elevation (YYYY-MM-DD)" after completion. Signed slopes: positive = uphill in draw direction.

### v692 · 2026-08-22 — Elevation Cursor Hardening
Tile fetch 8s timeout — stalled requests no longer lock `_pending` forever. Mouse leave resets `_pending` immediately. `unfreeze()` stops the elevation cursor as step 2.

### v691 · 2026-08-22 — Elevation Cursor: Line Hover Segment Breakdown
Seg A/B % values shown for all lines including 2-coordinate segments (geographic midpoint computed via interpolation, DEM elevation fetched at that point). `_bearing()` destructuring fixed for Safari (explicit index access instead of parameter destructuring).

### v690 · 2026-08-21 — Caret Offset Fix
Caret offset formula corrected: `offset = [cos(bearing) * -3, sin(bearing) * -3]` derived from console testing. The negative value and corrected trig place the caret tip precisely on the midpoint.

### v689 · 2026-08-21 — Caret Console Tuning
`nudgeCaret(halfPx)` console utility for live-tuning caret position while hovering a line.

### v688 · 2026-08-21 — Caret MapLibre Offset
Switched from CSS `translateX(-40%)` (operates in rotated local space) to MapLibre marker `offset` option: `[x, y]` in world-space pixels. Offset computed from bearing: `offsetX = -sin(bearing) * halfGlyph`, `offsetY = cos(bearing) * halfGlyph` — places the tip (not center) on the midpoint.

### v687 · 2026-08-21 — Caret Bearing Offset
Bearing correction changed from `translateY` to a direct bearing offset: `bearing - 90 - 7`. Subtracts 7° counterclockwise to compensate for glyph baseline asymmetry.

### v685 · 2026-08-21 — Caret Position Tune
Caret `translateY` set to `+8%`, popup blur reduced to 1px on both hover and pinned popups.

### v684 · 2026-08-21 — Caret Position Tune 2
`translateY(-18%)` on caret, blur reduced from 4px to 2px.

### v683 · 2026-08-21 — Caret Centering
`translateY(-10%)` shifts the `›` glyph upward in rotated coordinate frame to compensate for typographic baseline being below optical center.

### v681 · 2026-08-20 — Caret Rotation Fix
MapLibre applies `transform: translate(X,Y)` on the marker root element, overwriting any CSS `transform` we set there. Fix: two-element structure — outer `div` for MapLibre positioning, inner `span` for our `rotate()`. Standard pattern for MapLibre custom markers needing rotation.

### v679 · 2026-08-19 — Caret Safari Fix
`_bearing()` destructuring crash on Safari fixed (explicit index access). Marker switched from `cssText` to `setAttribute('style', ...)`. Glyph uses `innerHTML = '&#x203A;'` instead of `textContent`. Explicit `width`/`height` and `display:flex` centering for correct anchor point.

### v678 · 2026-08-18 — Caret Size and Rotation
Caret `font-size: 32px`, `font-weight: bold`, double shadow for legibility. Rotation formula: `rotate(bearing - 90deg)` — `›` points east at 0° CSS rotation; north bearing = `rotate(-90deg)`.

### v677 · 2026-08-17 — Caret Midpoint Marker
`›` marker at geographic midpoint of hovered line, pointing toward the higher endpoint. Tooltip order: Start / Mid / End / Rise / Run. `fmtDist(m)` formats distances as feet/imperial first. Marker disappears when cursor leaves the line.

### v676 · 2026-08-17 — Tooltip Styling + Midpoint Row
Light tooltip background (`rgba(255,255,255,0.95)`) with teal left border — visually distinct from dark property popup. Popup-aware positioning — detects `.maplibregl-popup` overlap and flips/nudges. Mid elevation row added between End and Rise.

### v675 · 2026-08-16 — Segment Breakdown for 2-coord Lines
"Horiz" → "Run" in tooltip. Segment A/B breakdown now works for 2-coordinate lines — geographic midpoint `[(lng1+lng2)/2, (lat1+lat2)/2]` is fetched from terrain tiles, capturing actual terrain shape regardless of vertex count.

### v674 · 2026-08-16 — Slope Segment Breakdown
Midpoint deviation warning replaced by segment breakdown row: seg A (start→midpoint) and seg B (midpoint→end) slopes shown in every line tooltip. Turns orange with ⚠ if they differ by more than 3%. Suppressed for 2-coordinate lines.

### v673 · 2026-08-16 — Tooltip Elevation Units
All measurements in ft and m: `fmt(m)` renders every elevation as `NNN′ / NNNm`. Distances over 1km show `km/mi`. Midpoint deviation also shows both units. 2-coordinate lines handled explicitly — geographic midpoint interpolated, deviation warning suppressed.

### v672 · 2026-08-16 — Slope Tooltip Fixes
Rise shows absolute value (`Math.abs`). Screen-edge clipping fixed via `_positionTooltip` — measures tooltip size and flips to the other side of cursor if it would overflow. MultiLineString logging added. Midpoint deviation check added.

### v671 · 2026-08-15 — Elevation Line Hover: Stage 1
When hovering a line feature: shows slope %, degrees, start/end elevation (ft/m), rise, run, seg A/B breakdown. The two endpoint tiles are fetched in parallel. Tile cache expanded to 128 entries. MultiLineString features supported.

### v670 · 2026-08-14 — Elevation Cursor + Hide Below Sea Level
**"Show elevation" checkbox** in Basemap panel. Floating tooltip follows cursor with terrain elevation (ft/m) and lat/lon coordinates. Tile cache (64 entries), async fetch with `_pending` flag to avoid queuing redundant requests. **Hide below sea level** filter changed from `≠ 0` to `> 0` — catches all bathymetry, not just exactly zero.

### v669 · 2026-08-14 — Contour UI Polish + Console Elevation Query
Contour controls UI updated. Console function `getElevation(lat, lng, zoom=12)` for querying Terrarium DEM tiles.

### v668 · 2026-08-13 — Dual Contour Sources: Terrarium + OSM.us
**Source pill** — Terrain (default, generated from DEM) | OSM.us (pre-generated vector tiles). Source-specific controls shown/hidden per selection. Both share Major, Labels, Opacity, Hide bathymetry controls. OSM.us: feet only, no DataCloneErrors, US-focused coverage.

### v667 · 2026-08-12 — Contour Rewrite: OSM.us Vector Tiles (First Pass)
Switched from maplibre-contour (browser-generated) to OSM.us vector contour tile service — no custom protocol, no DataCloneError. mlcontour library removed. Later reverted to supporting both.

### v666 · 2026-08-12 — Contour Major Labels
Major contour label layer added. Label text shows elevation in configured units.

### v665 · 2026-08-12 — Contour Opacity + Bathymetry Hide
Opacity pill (25%/50%/75%/100%). **Hide bathymetry** checkbox filters out `ele <= 0` contours.

### v664 · 2026-08-11 — Contour Lines (maplibre-contour)
**Contour lines** added — maplibre-contour v0.1.0 inlined (31KB, BSD-3-Clause), `worker: false`. Source: Terrarium DEM tiles. Unit: Feet | Meters. Detail: Coarse | Auto | Fine | V. Fine. Line and major contour layers. Minor/major distinction via `level` field (0=minor, 1=major).

### v663 · 2026-08-11 — Label Pitch Alignment
`applyLineLabelPitchAlignment()` applies `text-pitch-alignment: 'viewport'` + `text-rotation-alignment: 'map'` to all symbol layers with line placement. Road, waterway, and transit labels stay readable when the map is tilted.

### v662 · 2026-08-10 — Pinch-Zoom Animation Fix
Real fix for animation vs. pinch-zoom conflict: inside `_animFrame`, check `map.isZooming() || map.isRotating()` and skip the `jumpTo` call for that frame. MapLibre's `jumpTo` calls `map.stop()` internally, which cancelled pinch gestures. Now pinch runs uninterrupted.

### v661 · 2026-08-10 — Touch Handler Refinement
Touch handlers moved to `canvas.addEventListener`. `touchstart`: 1 finger = pause animation; 2 fingers (pinch) = clear pause. `touchend`: only clear pause when all fingers lifted (`e.touches.length === 0`), so lifting one finger during pinch doesn't prematurely resume.

### v660 · 2026-08-09 — Tilt + Animation Coordination
`toggleMapTilt` pauses animation via `_userInteracting = true` before calling `easeTo`. `map.once('moveend', ...)` resumes animation after 800ms ease completes. Tilt animates smoothly, then orbit/fly resumes.

### v659 · 2026-08-09 — Rotate Button Fix (Round 1)
`_setRotateActive(!_rotateActive)` was dropped during a previous edit. `toggleMapRotate` was toggling animation without flipping the flag, so it always evaluated as false and went straight to `_stopAnimation()`. One line restored.

### v658 · 2026-08-08 — `unfreeze()` + Tilt Button + Interaction Pause
**`unfreeze()`** console function — stops animation, clears progress overlay, calls `map.stop()`/`resize()`/`triggerRepaint()`, attempts style reload if `isStyleLoaded()` is false. **⛰ Tilt button** — third button in map control group. Toggles 0° ↔ 60° pitch with 800ms `easeTo`. Teal when tilted. **Pause animation during user interaction** — `mousedown`/`touchstart` sets `_userInteracting = true`, animation loop skips `jumpTo` while flag is set, `mouseup`/`touchend` resumes.

### v657 · 2026-08-08 — Visibility Change Auto-Pause
`document.addEventListener('visibilitychange', ...)` stops animation when tab goes hidden (laptop close, tab switch, screen lock). `_stopAnimation()` cancels RAF, clears `_mapAnimating`, resets button states, fires `pushHashState`.

### v656 · 2026-08-08 — Tile Interaction Source Guard Fix
Root cause: `setupTileInteraction` called on every basemap style reload. `map.addSource`/`map.addLayer` had no existence guards, so the second call threw `Source already exists` — silently caught, but `_tileHandlers` was populated with unregistered handlers. Fix: `_addSrcIfMissing` and `_addLayerIfMissing` guard all setup calls.

### v655 · 2026-08-07 — Animation Speed Tuning
Rotation halved to 2.25°/sec (~160s per revolution). Pan base reduced to `0.018/8 = 0.00225°/sec` at zoom 12 (~250m/sec). Pan speed scales with `2^(12 - zoom)` — read fresh each frame so zooming while flying auto-adjusts pace. Tunable in console: `_FLY_BASE_DEG_PER_SEC`, `_FLY_REF_ZOOM`.

## 2026-08-07 — Satellite/terrain, basemap UX, rotate/fly · v629–v655

### Rotate and Fly animation buttons (v652–v655)
- **↻** (rotate) and **↑** (fly/pan) buttons in the toolbar and as a native MapLibre `IControl` below the +/− navigation controls
- Uses `map.jumpTo({ bearing, center })` with timestamp-based `dt` stepping — avoids `Attempting to run(), but is already running` errors from MapLibre's animation queue
- `pushHashState` suppressed during animation (`_mapAnimating` flag) to avoid `history.replaceState` rate limit (>100 calls/10s = SecurityError)
- Fly speed scales with zoom: `baseDeg × 2^(refZoom - currentZoom)` — halves with each zoom level in, so street-level and regional zoom feel appropriately paced
- Rotation: 2.25°/sec (~160s per revolution); pan base: 0.00225°/sec at zoom 12
- Both toggles keep toolbar and map control buttons in sync via `_setRotateActive`/`_setFlyActive`

### Terrain + hillshade (v639–v655)
- **AWS Terrarium** DEM tiles (no key, global, CC0) as default terrain source
- **Maptiler Terrain RGB v2** as alternative — higher quality, requires API key
- `Terrarium / Maptiler` source pill in the Basemap panel — independent of basemap choice; switching provider removes all dependent layers before removing the source
- `map.setTerrain({ exaggeration })` with Off / 0.5× / 1× / 1.5× / 2× pill
- Terrain restored after basemap style reloads via `restoreBgLayers()` inside `onStyleLoad`
- **Hillshade layer** (`hillshade` type) added above satellite raster but below GeoJSON data layers
  - On/Off checkbox; hides Style and Opacity controls when off
  - Style presets: `Subtle` (scale 0.2, shadow #666, highlight #ddd), `Natural` (0.3, #333, #eee), `Strong` (0.45, #111, #fff)
  - Opacity pill (25%/50%/75%/100%) folded into `hillshade-exaggeration` (MapLibre hillshade layers have no `raster-opacity` property)
  - `hillshade-exaggeration = terrainExag × preset.scale × opacity`, capped at 0.95
- **Terrain raw view** (`Terrain` button in basemap pill): hides all vector layers, shows full-intensity greyscale hillshade only — diagnostic view for confirming DEM coverage and illumination; restores all layers on exit

### Session restore fix (v644–v646)
- `labelOverlap`, `labelVarPlacement`, `labelFmtDecimals`, `labelFmtAbbreviate`, `labelFmtYears` now declared as top-level `let` variables with defaults — previously only assigned inside a reset block, causing `ReferenceError` when `setupGeoJsonLayers` was called from session restore before any reset had run
- Session restore now calls `setupGeoJsonLayers`, `applyLineStyle`, `applyPointStyle`, `applyPolyStyle`, `applyLineCasing`, and `switchTab('file')` so features appear immediately with correct styles

### Terrain race condition fix (v644)
- `_applyTerrain()` in `map.once('load')` now only runs when `currentBasemapStyle === 'white'` (no `setStyle` pending); other basemaps apply terrain via `restoreBgLayers` inside `onStyleLoad` after the style finishes loading — prevents `Error: Style is not done loading`

### Basemap panel promoted + UI restructure (v629–v646)
- **Basemap** promoted from a subsection inside Background to its own top-level panel
- Panel sits below the green teal divider line alongside Style and Background — collapses with them when hovering the property list
- Panel header shows active basemap name: `· Satellite, 1× terrain` etc., updates on every basemap or terrain change
- All three panel toggle labels (Basemap, Style, Background) now use `var(--accent)` green
- Basemap pill restructured into two rows: vector styles (White/Light/Gray/Dark/Black) on row 1, satellite/terrain/none on row 2
- `Hide` renamed to `None`
- Default basemap changed from `black` to `white` to match the actual initial style URL; `bm=black` now correctly appears in the hash; `bm=white` is omitted as the default
- `pushHashState` called immediately on basemap switch (not only on `moveend`) so hash updates without requiring a pan

### Satellite basemap (v630–v638)
- **Esri World Imagery** raster source added as `Sat` option — no API key, no style reload
- **Maptiler Satellite** added as `MT Sat` / `ESRI Satellite` — uses Maptiler API key, 512px tiles
- Satellite entry: hides Protomaps fill/background layers, hides roads, water, POI; keeps street name labels; hides highway shields specifically; unchecks and syncs all affected checkboxes
- Pre-satellite state (road/water/POI/landuse/buildings checkboxes, File+Working line styles) snapshotted on entry and restored on exit
- Satellite line defaults on entry: `medium` width, `solid` style, `dark` outline — applied to both File and Working tabs
- Satellite label style: white text, black glow applied to all Protomaps symbol layers
- Satellite hash restore: `bm=satellite` in URL deferred until after `onStyleLoad` so `discoverBasemapGroups()` has populated before road-hiding runs
- `_satelliteTogglePolygonGroup()`: in satellite mode, checking Water/Landuse/Buildings shows outlines only (not fills); synthetic line layers added for groups with no native line equivalent
- Switching between Esri and Maptiler removes the previous provider's source/layer cleanly


### Water checkbox (v633–v635)
- New **Water** checkbox in Basemap Layers alongside Roads/Places/Streets/Buildings/Landuse/POI
- `discoverBasemapGroups()` now splits water layers out of the general landuse group
- In satellite mode, toggling Water shows boundary line layers only (no fills)

### Line defaults on satellite entry respect reload (v636)
- `ingestGeoJSON` fresh-load reset block now checks `currentBasemapStyle === 'satellite'` and applies `medium`/`dark`/`solid` defaults instead of the standard `thin`/`none`/`translucent` — dragging files onto satellite no longer resets to thin transparent lines


### Favicon (v629)
- `<link rel="icon">` tags added to `<head>` with relative paths so they resolve correctly on GitHub Pages subdirectory deploys
- Paths later updated to `favicon/` subdirectory (v641)

---

## 2026-07-31 — Shapefile import: WKT projection parsing, metadata stamping · v613–v628

**Shapefile import** (v618–v628) — full import pipeline for `.shp` files with two
entry paths and shared reprojection/ingest logic:

*Import paths:*
- **Multi-file drag or multi-select open** — drag `.shp` + `.dbf` + `.prj` together
  (or use the new 📂 Folder menu item); files are grouped by base name automatically
- **Zip drag or open** — `.zip` is extracted with JSZip; if multiple shapefiles are
  found, a checkbox dialog lets the user pick which to import (Import all / Import
  selected / Cancel)
- **Folder drag** — Chrome/Edge: files read recursively via `webkitGetAsEntry()`.
  Safari: falls through to multi-file drag (Safari's FileSystem API is incomplete)
- Libraries inlined: shapefile.js v0.6.6 (8KB) and JSZip v3.10.1 (98KB), making
  the app fully self-contained with no additional CDN dependencies

*Projection handling* (`_detectPrjCRS`, `_wktToProj4`) (v623–v628):
- Outer CRS name extracted from WKT first (prevents `GCS_WGS_1984` substring inside
  a projected CRS WKT from incorrectly matching before the actual projection name)
- AUTHORITY["EPSG"/"ESRI","NNNN"] block extraction as second pass
- **WKT parameter parser** (`_wktToProj4`) for PROJCS blocks without AUTHORITY —
  handles Albers Equal Area, Lambert Conformal Conic, Transverse Mercator, Mercator,
  Stereographic by parsing `PROJECTION["type"]` and key PARAMETER values directly
- Common CRS pre-registered in proj4js at startup (EPSG:3857, EPSG:4269, EPSG:4326,
  ESRI:102003/102039) — no network fetch for the most common projections
- `ensureProj4Def` handles raw proj4 strings (from `_wktToProj4`) via a synthetic
  key, falling back to epsg.io fetch (with 12s timeout) only when all else fails
- Full-text substring fallback **removed** — it caused `GCS_WGS_1984` embedded
  inside Albers/Web Mercator WKT to incorrectly return EPSG:4326, silently skipping
  reprojection and leaving coordinates in meters
- Bug fixed: `WGS_1984_Web_Mercator_Auxiliary_Sphere` was mapped to EPSG:4326 (wrong);
  corrected to EPSG:3857. Web Mercator uses meters, not degrees.

*Source naming* — directory/zip base name used as `_selecter_source` when the
shapefile base name looks generic (e.g. `historicl1.shp` in per-period folders
named `CA37A02_1850`). Zip base name serves as the "directory" analog.

*Missing `.dbf` handling* — modal offering Geometry only / Cancel.

*Metadata stamping* — `_selecter_format: 'shapefile'` and `_selecter_sourcecrs`
(the detected CRS string) stamped on every shapefile feature. All GeoJSON features
also receive `_selecter_format: 'geojson'` and `_selecter_sourcecrs` through
`ingestGeoJSON`. Both properties in `INTERNAL_PROPS` (hidden from sidebar/popup
property rows) but visible in the **popup footer** (small monospace line showing
⌸ format and ⌖ source CRS when non-WGS84) and accessible on `feature.properties`
for programmatic use.

*Import toast* — `📐 Shapefile imported: name` + `🔄 proj → WGS84` shown after each
successful import when reprojection ran, matching the GeoJSON reprojection toast style.

*Reprojection logging* — `[reproject]` lines now always appear in the console
(detected CRS, reprojection ran/skipped and why) for both GeoJSON and shapefile paths.

**Welcome modal UX** (v622):
- Background opacity reduced (`rgba(15,15,17,0.55)` with `blur(3px)`) — map visible underneath
- **×** close button added to top-right of welcome box
- **Click-outside** dismisses the modal (click on backdrop, not the box)
- `closeWelcome()` called earlier in shapefile dispatch so the modal clears as soon
  as valid shapefiles are detected, not after full ingest

**`map.getStyle().layers` null-guarded** (v613) — nine unguarded calls replaced with
`_styleLayers()` helper that catches `undefined` during `setStyle()` transitions, which
was producing `TypeError: undefined is not an object` during basemap switches.

**Session persistence** (v615–v616) — locally-loaded files (drag-and-drop) now
survive an overnight tab kill:
- After every successful ingest (and flag/note/format edits), processed features
  serialized to `sessionStorage` (skipped if >4.5MB)
- On next load, if no URL hash data is found, offers to restore: "Restore N features
  from filename.geojson (saved Xh ago)?"  with Restore / Start fresh
- Working layer saved separately and offered as part of the same restore dialog
- Deliberate `_clearFileData()` clears the session so restore isn't offered after
  an intentional clear
- `_loadedAt` timestamp + `sessionStorage` heartbeat allow distinguishing a tab
  reload from a crash/kill; `[session] Previous session detected` warning in console

**Freeze resilience improvements** (v613–v616):
- `resetAll` and `_clearFileData` now emit `console.trace()` on every call so
  unexpected triggers surface immediately in the log
- `window.addEventListener('unhandledrejection')` and `window.addEventListener('error')`
  added — async failures that previously vanished silently now always log
- `showProgress`/`hideProgress` log open/close timestamps; 30-second watchdog fires
  a `console.error` if the overlay is still open (with inline removal command)
- `_fetchWithTimeout` (12s AbortController) wraps the epsg.io fetch in `ensureProj4Def`

**Share selection export** (v614–v617) — Shift+click on the 💾 Save button opens a
panel for exporting selected/highlighted feature IDs as JSON or CSV for sharing. A
second user drops the file onto a map with the same data to highlight the selection.
- ID property picker (CNN first, then OBJECTID/id/etc by priority)
- JSON export includes source filename, URL, ID property name, and timestamp
- CSV has matching comment-header metadata
- On import: detects the file format, finds matching features in the current file,
  and highlights them; if the filename differs, confirms before applying
- Panel positions above the button if it would clip the viewport bottom

## 2026-07-23 — Deselect regression fix · v612

**Deselect-on-second-click broken since ~June 3.** Root cause: the generic
`map.on('click')` handler (which fires before any layer-specific click handler)
unconditionally set `frozenFeatureProps = null` on every map click. The layer-
specific `onFeatureClick` handler then checked `frozenFeatureProps._gvid === f._gvid`
to detect a second click on the same feature — but by the time it ran, the generic
handler had already nulled it, making this check always false. Result: second click
always re-selected the feature instead of deselecting it.

Fix: the generic handler now only removes the popup DOM element, leaving
`frozenFeatureProps` intact so `onFeatureClick` can read it. `frozenFeatureProps`
is cleared in the generic handler only when clicking empty map (no feature hit),
and in `onFeatureClick` itself on both the deselect path and the re-pin path where
it was already correctly handled.

---

## 2026-06-24 — Freeze investigation + resilience fixes · v609–v611

Investigated an overnight freeze (all clicks intercepted, console still responsive).
Diagnostics run via browser console:

**What we found:**
- `document.elementFromPoint(200, 200)` returned the progress overlay div (`position:
  fixed; inset:0; z-index:500`) — it was stuck open, intercepting every click
- After removing the overlay, the map was still frozen; `map.stop()` cleared a stuck
  camera ease (`_moving/_zooming/_pitching: true` with an orphaned `_easeFrameId`)
- After those two fixes, a second freeze was found: `activeTab` was `'working'` despite
  being on File tab, `allFeatures.length === 0`, `switchTab('file')` silently did
  nothing. This second freeze resolved itself after a few days (likely Safari/system
  memory recovery); exact cause not fully determined but consistent with Safari
  backgrounded-tab compositor suspension

**Root cause of the progress overlay getting stuck:**
`loadFile` called `ingestGeoJSON(geojson, file.name)` without `await` or `.catch()`,
inside a chain of nested `setTimeout`/`requestAnimationFrame` callbacks. If
`ingestGeoJSON` threw synchronously (e.g. during CRS detection), the `hideProgress()`
call two lines later was skipped entirely, leaving the overlay permanently open with
no console error. Additionally, `ensureProj4Def` (CRS reprojection via epsg.io) had
no fetch timeout, so a network hang could leave it pending indefinitely.

**Fixes (v609–v611):**
- `map.setStyle()` now passes `{ diff: false }` to skip MapLibre's buggy diff
  path (was emitting "Unable to perform style diff: undefined is not an object"
  on every basemap switch and silently falling back to a full rebuild anyway)
- `loadFile`: wrapped `ingestGeoJSON` call in `Promise.resolve().then().catch()
  .finally()` so `hideProgress()` always runs regardless of sync throw or async
  rejection inside `ingestGeoJSON`
- URL-load path: added `await` before `ingestGeoJSON` so async failures are caught
  by the surrounding `try/catch` which already called `hideProgress()`
- `showProgress`/`hideProgress`: now log `[progress] opened`/`closed after Xs` with
  timestamps; a 30-second watchdog fires a `console.error` if the overlay is still
  open (stuck), with the removal command inline
- `ensureProj4Def`: fetch wrapped in `_fetchWithTimeout(url, 12000)` using
  `AbortController`; timeout throws, is caught, logs a warning, returns `false`
  (skip reprojection) rather than hanging forever
- `detectGeoJSONCRS`: now explicitly recognizes `CRS84`/`OGC:1.3:CRS84` as
  `EPSG:4326` (was silently falling through the EPSG regex with no match, which
  accidentally produced the correct no-reprojection result but for wrong reasons)
- Global `window.addEventListener('unhandledrejection')` and `window.addEventListener
  ('error')` added — future unhandled async failures will now always produce a
  console trace instead of silently vanishing

**Useful console commands for next time:**
```js
// Is the progress overlay stuck?
document.querySelector('div[style*="z-index: 500"][style*="backdrop-filter"]')?.remove();
// Stuck camera ease?
map.stop(); map.triggerRepaint();
// What's actually under the cursor?
document.elementFromPoint(200, 200);
// Core state check
console.log('activeTab:', activeTab, 'allFeatures:', allFeatures?.length, 'mapLoaded:', map.loaded());
// WebGL context health
map.painter?.context?.gl?.isContextLost();
```

---



Full mirror of the File tab's Style panel into the Working tab, built in eight
verifiable stages, followed by a long bug-fixing and consistency pass.

**Stage 1–8 implementation**
- `wStyle` object holding all Working style state (points/lines/polygons/labels),
  parallel to File's flat globals
- Working style panel HTML (collapsible, amber-accented) with line width/style/
  outline/dash/offset/direction, point style/radius, polygon outline/fill/width/size
- `applyWorkingLineStyle`, `applyWorkingPointStyle`, `applyWorkingPolyStyle`,
  `_applyWorkingArrows` — Working-specific equivalents of the File apply functions
- Direction arrows (Draw/Compass) with their own `working-midpoints` source and
  scored compass-property auto-detection (`_compassScore`, reused from File)
- Label formatting (Decimals/Abbreviate/Years/Overlap/Variable) synced bidirectionally
  with File's checkboxes
- `syncWorkingPillUI()` — restores pill active-states from `wStyle` on every tab switch
- `resetWorkingStyleState()` and a **✕ Clear** / **🗑 Clear** path that fully empties
  the Working layer and resets its style

**Bugs found and fixed during the build**
- Polygon outline had no dedicated layer (`working-outline` added, mirroring `gv-outline`)
- Palette colors not applying until a tab switch (`_applyWorkingPalette` was setting
  `circle-color` directly, overwriting the hollow-point style)
- Tile features dropping out when basemap roads hidden — `queryRenderedFeatures` skips
  hidden layers; fixed with always-visible zero-opacity "probe" layers per source-layer
- Numeric range **Hide** filter and point size-by-property not working in Working
  (both were missing from `applyPaletteToLayers`'s Working branch)
- Deselect button leaving features highlighted (stale `hovered` feature-state never
  cleared) and not clearing search boxes
- Context menu single-feature actions (`delete-one`, `hide-one`, `unhide-one`,
  `duplicate`) silently broken on Working — hardcoded `_gvid` instead of tab-aware ID key
- Quantitative palette legend showing the categorical swatch list instead of the
  histogram on File (root cause: `paletteMap` was being populated even for quantile
  schemes, when it should stay empty and rely on `paletteStops`)
- Sponge (🧽 reset) not clearing point-size-by-property, and not resetting Working
  at all; `resetWorkingStyleState` was accidentally nested inside `resetAll`'s function
  body, making it uncallable from outside
- Added a documentation block (search "FILE / WORKING TAB SYNC") explaining the
  `_src()`/`_idKey()` pattern and the self-audit grep commands, to prevent this class
  of bug recurring as new features are added

**UI consistency pass (File / Tiles / Working headers)**
- Unified header structure across all three tabs: `H2 title + sort buttons` row,
  subtitle/stats row, search row, Labels row — same padding, same row order
- Tab-accent colors: File → blue (`#60a5fa`), Tiles → yellow (`#eab308`, changed from
  orange to avoid clashing with Working), Working → amber (`#f59e0b`)
- Fixed a div-nesting corruption introduced mid-restructure that caused File's prop
  list to render outside its tab container (visible on Tiles/Working) — traced and
  repaired via a programmatic depth audit rather than manual inspection
- Search boxes standardized: two-level wrapper (padding div + relative-positioned
  inner div), consistent icon (17px, left:8px) and **×** clear button (right:8px)
  across all three tabs; Deselect now clears all three search boxes
- Multi-file support: File subtitle aggregates `_selecter_source` into "N files"
  with an instant custom tooltip (not the native `title=`, which has a browser-imposed
  hover delay) listing each file's name, feature count, and byte size
- Working subtitle mirrors File's pattern: "N sources" title (hover for breakdown),
  features · props · vertices stats line
- Tiles subtitle: row 1 now reads "N Protomap zoom Z tiles in view" (computed via
  standard slippy-tile math, no MapLibre internals); row 2 shows features · props
- Vertex count and geometry/attribute byte-split estimate extended to file *appends*
  (previously only computed on the first/fresh load)

---

## 2026-06-11 — Tiles / Working fixes, density tuning · v14 session

- Tiles tab improvements, Working tab fixes
- Popup and selection-bar behavior changes
- Density mode tuning for point/line rendering at scale
- Background panel restructure
- OSM ID handling and tile-feature provenance tracking

## 2026-06-04 — Working Layer refinements · v13 session

- Selection bar refactoring and stack detection
- Direction arrows (Draw/Compass) introduced on the File tab
- Line offset tool
- Feature format panel (per-feature color/width/dash override)
- Popup timing fixes, overlap review improvements
- Background panel restructure, action row cleanup
- Popup diff highlighting (compare two stacked/overlapping features)

## 2026-05-30 — Working Layer tab, three-store model · v12 session

- Working Layer tab introduced as a first-class third tab alongside File and Tiles
- Three-store data model (`_fileStore` / `_workingStore` / tile state) established
- Selection bar made tab-aware (no longer assumed File-only)
- Button layout rationalization
- Palette/label fixes, stack detection, feature format panel

## 2026-05-22 — Working Layer foundation · v11 session

- Working Layer tab implementation (early version)
- Three-store data model groundwork
- Tile-row consolidation into a unified selection row
- Palette/label fixes
- Count bleed fixes between tabs (an early instance of the File/Working sync bug class)

## 2026-05-19 — Overlap detection, dedup workflow · v10 session

- Overlap detection and review panel
- Blink animation for highlighting matched features
- Flag markers, format panel
- Split mode (cutting a line at a point)
- Context menu, simplestyle support
- Popup improvements, deduplication workflow

## 2026-05-14 — Split/delete/undo, context menu · v9 session

- Tile mode selection refinements
- Overlap detection/review panel (early version)
- Format/flag panels
- Split mode, context menu, simplestyle
- Popup improvements, deduplication workflow

## 2026-05-11 — Multi-file append, CRS reprojection · v8 session

- Split/delete/undo
- Context menu introduced
- Format/flag panels
- Simplestyle (`marker-color`, `stroke`, `fill`) support
- Pinned popup improvements

## 2026-05-03 — Background layers, SVG export · v7 session

- Tile mode selection fixes
- Label formatting, palette URL hash persistence
- Background layers (reference layers below the main data)
- SVG export
- CRS auto-detection and reprojection to WGS84
- Multi-file append mode (first version)
- Creek/waterway filtering, prop display improvements

## 2026-04-30 — Tile mode selection, label formatting · two sessions, v6

- Tile mode click/shift-click selection bug fixes
- Label formatting improvements
- Palette URL hash
- Sidebar layout fixes
- Data-driven line/point effects (width/color by property)
- Layer ordering fixes, progress bar improvements
- Tile mode interaction debugging

## 2026-04-22 — Polygon density outlines, popup sorting · v6 session

- Polygon density-based outline width (thinner outlines for dense polygon layers)
- Basemap switching race-condition fix
- Feature state restoration after basemap reload
- Popup active-property sorting
- Mobile layout fixes
- Histogram improvements, filter/hide mechanics refinements

## 2026-04-14 — Histogram panel, legend mode · v5 session

- Quantitative palette system (continuous color ramps, not just categorical)
- Numeric histogram panel with stats and range filters
- Vertical/horizontal histogram display modes, popout histogram window
- Style panel reorganized into Points/Lines/Polygons/Basemap subsections
- Polygon density outlines (first version)
- Mobile fixes
- Basemap switching race condition (first fix attempt)
- Feature state restoration, popup active-property sorting (first versions)

## 2026-04-10 — Quantitative palettes, legend mode · v4 session

- Quantitative palette system (initial build)
- Numeric histogram panel with stats/filters (initial build)
- Style panel reorganization
- Legend mode (collapsible card showing title + stats + palette swatches)
- Basemap switching

## 2026-04-08 — Palette overhaul, globe projection · v3 session

- Palette system overhaul: ColorBrewer schemes matched by category count,
  native color-property detection (simplestyle, etc.)
- Style panel reorganized into collapsible subsections
- Action bar tightened
- Filter-aware counts (counts update to reflect active filters)
- Globe projection option
- Many bug fixes

## 2026-04-06 — Dots/midpoints, style panel, URL hash · v2 session

- Dots/midpoints overlay using Turf.js (density visualization for small/overlapping features)
- Palette coloring system (first version)
- Style panel introduced
- Filter status row
- Popup interactions
- URL hash state persistence (shareable links encoding view + filters)
- Basemap controls

## 2026-03-31 — Dots/midpoints, Turf.js · "selecter" rename

- Dots/midpoints feature built with Turf.js
- Zoom-based display thresholds
- Color fixes
- Project renamed from generic "viewer" to "viewer/selecter," reflecting the
  selection-and-export workflow that became the app's core purpose

## 2026-03-30 — Map tile mode

- Map tile mode introduced: road selection directly from Protomaps vector tiles
  (as opposed to only working with uploaded GeoJSON)
- Sub-segment picking (selecting part of a line, not just the whole feature)
- Property filtering for tile-sourced features

## 2026-03-26 — Initial build

- MapLibre GL JS GeoJSON viewer: file upload, property sidebar, filtering, labeling
- Tile interaction for road selection
- Save/share functionality
