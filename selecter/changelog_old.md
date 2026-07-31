# GeoJSON Viewer — Feature Changelog

---

## April 16–22, 2026 

- Line casing: per-feature `hidden` state expression replaces scalar opacity, fixes casing on filtered items
- `isQuantitativeScheme` check in Hide block gates correctly on cleared `filterHiddenIds`
- Legend filter section: shows both categorical filter and numeric palette range simultaneously
- Stat label hover tooltips: position clamped to viewport, fallback `<title>` for screen readers
- `syncPopoutHistogram(key)` helper keeps popout in sync with all filter/squish interactions
- Filter reset: explicitly restores hidden feature states before clearing Set
- Line casing opacity expression correct after `applyLineStyle` overwrite bug fixed
- Basemap switch: fully restores `filterHiddenIds`-hidden features after style reload
- `updateSelectionBar` called after Hide to show correct hidden count in bottom panel
- `applyPaletteToLayers` called after source `setData` on new file load (fixes grey features on drag-drop)
- Legend: shows palette property name and active filter range (numeric and categorical)
- Filename includes numeric filter range (`range_lo-hi`)
- Filename and screenshot name include active palette property (`by_PROPNAME`)
- Screenshot: black background composited for Hide basemap mode
- Screenshot resolution: 3× pixel ratio via `map.setPixelRatio(3)` before capture, restored after
- Style panel auto-collapses when hovering property list
- Dense line threshold: 5M vertices/deg² with >500 features (calibrated to road grids vs bike networks)
- `autoDetectLineDensity`: vertex-density metric (vertices/deg²) auto-activates density line mode for dense networks
- fitBounds: uses reduce loop instead of `Math.min(...array)` (avoids stack overflow on large datasets)
- New file drag-drop: fully resets palette, filters, squish, line style, and `filterHiddenIds`
- Progress bar: shows feature count, file size, and estimated memory
- Progress bar overlay: shown during file load with reading (0–40%), parsing (40–65%), building (65–75%)
- Line casing respects `geomVisible.line` when lines are globally hidden
- `gv-line-casing` opacity uses per-feature `hidden` feature-state expression (not scalar) so filtered lines hide their casing
- Filter × button: clears `filterHiddenIds` and restores hidden features
- Clear button: resets palette Hide checkbox and restores filter-hidden features
- Reset button: fully resets all style pills, palette filter, squish, and basemap to defaults
- `clearAllFilterStates`: uses `featureById` Map for O(1) lookup (was `allFeatures[id]` array index bug)
- `gv-outline-interact` nested zoom interpolate fixed (MapLibre `case` inside `interpolate` stops)
- `line-dasharray` solid mode: removes property entirely (avoids MapLibre expression evaluate error)
- Line Dash pill: — / – – / - - / · · / – · – / – · · – (solid/dash/shortdash/dot/dashdot/dashdotdot)
- Stat label hover tooltips: floating tooltip for MEAN / MED / Q1 / Q3 / ±σ values
- Popout histogram syncs with panel histogram on filter/squish changes
- `updateFilterHideCountDisplay` uses `getElementById` + `.isConnected` guard (avoids detached DOM)
- `filterHiddenIds` separate Set tracks filter-hidden features vs user-hidden features
- Filter reset (✕): restores hidden features before clearing `filterHiddenIds`
- Filter undo: changing lo/hi inputs restores previously hidden features correctly
- Squish percentile sliders saved in URL hash
- Palette filter range saved in URL hash (`numfilter=lo,hi,hide,cl,ch`)
- Diverging and Sequential palettes available for numeric properties (not just quantitative schemes)
- Squish renamed from "Clip"
- Out-of-range features: dim grey color (`rgba(120,120,130,0.35)`) from palette expression
- Hide checkbox: hides out-of-range features; count shown in label as "Hide N" with strikethrough
- Filter inputs: lo/hi numeric range with Reset (✕) button
- Null bar hover text: "null / non-numeric / filtered out"
- Null bar click: same 3-state cycle as regular bars
- Histogram bar click 3-state cycle: highlight → bar-color filter → exclude

## April 15, 2026

---
- `doHighlight` atomically clears and resets highlighted state
- Every-other-click selection bug fixed (stale `activeFilter` guard removed)
- Highlighted feature count shows correctly in bottom bar
- Teal divider line in popup between active and inactive properties
- LABEL section: property names on same row, no color tinting
- Filter status row redesigned: FILTER label is a section header, not a value prefix
- Highlight/select outlines: zoom-dependent width, thinner than before


## April 13–14, 2026

---
- Dots: only show on visible/filtered features (not all)
- Mobile: style panel auto-collapses when hovering property list
- Mobile: sidebar fully hides with floating ☰ restore button
- Mobile: style panel flex order fixed (tabs → style → file panel)
- Polygon fill: auto-opacity by basemap brightness (dark / light / bright modes)
- Point style: white border option added to style pill


## April 12, 2026

---
- `fill-outline-color: transparent` suppresses MapLibre built-in 1px GPU fill edge
- Popup: palette property gets color dot; label property gets grey dot
- Popup teal divider below last active property row
- Popup active-property sorting: palette=0, label=1, filter=2, normal=3
- Named event handlers for reliable `map.off()` deregistration
- Basemap switch race condition fixed: generation counter + `_styleLoadFired` guard
- Feature state (selected/hidden) restored after basemap switch
- `gv-outline-interact` uses zoom-interpolated width for hover/select/highlight
- Polygon outline: split into static `gv-outline` + interactive `gv-outline-interact` layers


## April 10–11, 2026

---
- Vertex count display: "vertices" label, geom/prop % split
- Histogram in legend mode
- colorbrewer ramp picker with color swatches
- Numeric filter inputs (lo/hi) to set hard min/max range
- Number of stops slider for quantitative palette
- Flip (reverse) ramp direction button
- Log scale toggle for quantitative palette
- Squish (percentile clamp) sliders for palette range
- Histogram: hidden bin count shown in title
- Histogram: null/non-numeric grey bar with hover highlight
- Histogram: bar click → 3-state cycle (highlight → filter → exclude)
- Histogram: color bars match palette ramp
- Histogram: bin count slider (2–50 bins)
- Histogram: MEAN / MED / Q1 / Q3 / ±σ reference lines
- Histogram popout panel (floating, larger view)
- Histogram: vertical and horizontal orientations, toggle button
- Numeric histogram panel with bar chart, scrollable
- Quantitative palette system: Quantile / Linear / Jenks binning modes


## April 9, 2026

---
- Basemap suggestion toast: suggest White when loading polygon-only files on dark basemaps
- Label placement fixed to feature centroid for polygons (not bottom edge)
- Label text color: white with black halo on Dark/Black basemaps (all geometry types)


## April 8, 2026

---
- Legend: active filter shown with mode color
- Legend: label properties listed
- Legend: categorical color swatches with hover-highlight
- Legend: histogram shown for quantitative properties
- Legend shareable via URL (`view=legend`)
- Legend mode (`</>` button): compact map + color legend view
- Globe/mercator saved in URL hash
- Projection pill: Mercator / Globe (default Globe)
- Landuse and POI visibility checkboxes in basemap section
- Default basemap: Black
- Basemap switcher pill: White / Light / Gray / Dark / Black / Hide


## April 6–7, 2026

---
- Open second property while filtering by first: both panels visible simultaneously
- Zoom-dependent nested interpolate bug fixed (MapLibre constraint)
- Dynamic point radius: slightly larger on highlight/select
- Layer filter for hidden features: excludes them from label collision
- Vertex count and geom/attr split in sidebar subtitle
- Dataset memory size in sidebar subtitle
- Visible feature count in sidebar subtitle
- Density mode for polygons: scale width and opacity by viewport feature count
- Polygon Size pill (Zoom / Density / Fixed)
- Polygon Width pill (Hair / Thin / Mid / Thick)
- Polygon Outline pill (None / White / Grey / Black / Palette)
- Polygon fill opacity auto-adjusts to basemap (dark → 0.75, light → 0.35)
- Lines: Outline pill (None / Light / Grey / Dark)
- Lines: Size pill (Zoom / Density / Fixed)
- Lines: Width pill (Thin / Mid / Thick)
- Lines: subtle casing layer (dark outline behind lines for contrast)
- Points: Size pill (density / zoom)
- Points: Style pill (hollow / filled / outlined / outline)
- Style panel: collapsible subsections (Points, Lines, Polygons, Basemap)


## April 3, 2026

---
- Long-tail values (beyond palette size) share fallback color, not assigned palette colors
- Shuffle uses full maximum color range, not clamped to value count
- Colorbrewer match-by-count: pick the palette class that best matches number of distinct values


## April 1–2, 2026

---
- Cardinality ratio shown per property
- Count badge labels renamed to "Values" and "Count"
- Percentage display: floor, show `<1%` not `0%` for small values
- Property counts show percentage of features with each value
- Palette state saved in URL hash
- Filter-while-palette: filter by prop A, colorize by prop B simultaneously
- Palette × button to remove coloring
- Native color support: if property named `color`/`colour` has CSS/hex values, use them automatically
- Palette randomize/permute button (shuffle color order)
- Palette shuffle button (rotate through color assignments)
- colorbrewer palette picker with swatches
- Palette coloring: click property name to color features by value using colorbrewer


## March 31, 2026

---
- "click to" changed to icon-only in UI hints
- Progress indicators → right-arrow between highlight · filter · exclude · clear
- Dots appear in tile mode as well as file mode
- Dots respect filter state (only visible/filtered features get dots)
- Dots use Turf.js midpoints; size/zoom thresholds auto-adjust
- Dots mode pill (Off / Auto / Size / All) for midpoint dots on short lines and small polygons


## March 30, 2026

---
- Screenshot button in bottom bar, naming matches save-file logic
- Count badge toggles: Values count / Feature count
- Property sort options: by Keys, Values, Count (both file and tile modes)
- Tile mode: don't highlight hidden features on hover
- GeoJSON samples menu in file panel
- URL hash: lat/lng/zoom always updated; skip intro when hash present
- Tile labels persist across pan/zoom
- Tile mode: label checkboxes for tiled feature properties


## March 27, 2026

---
- Popup offset: 28pt when popup appears below selection
- Tile mode: filter and exclude features by property value (same 3-state as file mode)
- Suppress intro dialog when URL hash contains data/filters
- Welcome/intro dialog on load with mode descriptions


## March 25–26, 2026

---
- Gap between sidebar and bottom bar
- Zoom/pan buttons brightened
- Two-tab sidebar: File tab and Map Tiles tab
- Tile mode: property popup for selected road features
- Tile mode: save selected tile features as GeoJSON
- Shift-click to deselect individual sub-segments
- Shift-click casing highlight while hovering for sub-segment selection
- Map tile mode: shift-click to select sub-segments of MultiLineStrings
- Map tile mode: hover highlight and click-select road features
- Filename includes property/value filter state when saving


## March 23–24, 2026

---
- Bottom bar: consolidate buttons, left/right alignment
- URL hash: map position (zoom/lat/lng) persisted
- Label layer with configurable property name
- Feature count in subtitle: visible / total
- Clear button to reset all selections and filters
- Filter tag in bottom bar showing active prop/value/mode
- Save Visible button (appears only when features are hidden)
- Select multiple features; count shown in bottom bar
- Click to highlight (teal), filter (yellow), exclude (red) by property value — 3-state cycle
- Hover popup showing feature properties
- Property sidebar with collapsible value lists


## March 16, 2026

---
- Buttons: colored outline default, filled on hover
- Bottom bar layout: filter tag on top, buttons aligned right
- Save Selected button in bottom bar
- Hidden feature count in bottom bar
- Red/exclude state for excluded features
- Yellow filter state for property-filtered features
- Brighter muted/grey text in sidebar and popup
- Reduce popup flicker when moving between features
- Console: swap label text and halo colors


## March 2, 2026

---
- Console: simplify visible lines with Turf.js
- Console: export visible features as GeoJSON
- Console: export screenshot of visible map
- Console: find and hide lines by label text
- Console: set fill-outline width
- Console: hide labels by layer name
- Console: change polygon fill color and outline
- Initial MapLibre GL viewer setup with globe projection
