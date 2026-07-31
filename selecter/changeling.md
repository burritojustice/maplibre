# Changelog — GeoJSON Viewer / Selecter (map-viewer.html)

Reverse chronological. Build/revision numbers (`vNNN`) are included from the point
they started being tracked in-file; earlier sessions predate that convention and
are described by date and feature area only.

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
