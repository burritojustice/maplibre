# Selecter — project notes

## What this is

`map-viewer.html` is a **single-file** MapLibre GL JS web app for loading, exploring, styling, and exporting GeoJSON. No build step, no server, no dependencies to install — open in any modern browser.

## Build conventions

- **Version string:** `<!-- build: vNNN -->` near the top of the file. Bump the number with every substantive change.
- **Single file:** all HTML, CSS, and JS lives in `map-viewer.html`. Do not split into separate files or add a bundler.
- **No external runtime dependencies** beyond MapLibre CDN. Keep it drag-and-drop usable.

## Architecture notes

### Welcome panel (`#welcome-modal`)
The startup dialog has three sections stacked vertically:
1. `#welcome-header` — title and tagline
2. `#welcome-cards` — scrollable feature overview cards (v965+; was `#welcome-modes` 2-column grid in v964)
3. `#welcome-drop-zone` + `#welcome-actions` — drop target and four action buttons (sticky at bottom)

The four action buttons must stay as-is — they wire to JS event listeners by ID:
- `#welcome-file-btn` — triggers file picker
- `#welcome-browse-btn` — enters Map Tiles mode
- `#welcome-url-btn` — opens URL loader modal
- `#welcome-geojson-btn` — opens sample files menu (`#welcome-geojson-menu`)

### CRS reprojection
Selecter auto-reprojects any CRS to WGS84 on load. Files in e.g. California Albers (EPSG:3310) just work. Coordinates are truncated to 6 decimal places (~11 cm precision) to reduce file size.

### Safari ArrayBuffer workaround
Safari has a known issue with `ArrayBuffer` transfer in certain file-reading paths. There is a workaround in the file load code — do not remove it without testing on Safari.

### Cache-busting
If you serve `map-viewer.html` from a web server and make changes, add a query-string suffix to force re-fetch in browsers with aggressive caching (e.g. `map-viewer.html?v=965`).

### Join system
The right panel join system (`_jrpCols`, `_renderJoinRightPanel`) supports both CSV→GeoJSON and GeoJSON→GeoJSON joins in 1:1 and 1:many modes. Key invariant: `_jrpCols[0]` is always forced to `displayNameProp` at render time regardless of what `_jrpDefaultCols()` returned.

## Living documentation

Full user-facing docs live as Claude Docs (editable, shareable):

- **Quick Start** — https://claude.ai/code/artifact/513cb823-f5f8-4e3e-ac65-31dd9d0c61de
- **Shapes** — https://claude.ai/code/artifact/09b860a0-543a-4179-a32c-8e74d4dc6143
- **Joins** — https://claude.ai/code/artifact/40f4a5dd-8826-4338-8be9-561f329d7366

Markdown exports of Quick Start and Shapes are in this repo as `selecter-quick-start.md` and `selecter-shapes.md`. Re-export from the Claude Docs links above when you update them.

## Known issues / roadmap (as of v965)

From the join system work (v964):
1. **Bidirectional highlight** — hover a row in the right panel → highlight feature on map, and vice versa
2. **Pivot wide mode** — proper reshape of multi-row CSV data (e.g. `ReportingCategory × value`) into one row per GeoJSON feature with percentage calculations
3. **Second filter condition** — right panel refilter popover only supports one condition; `AND AggregateLevel = S` would fix district-row contamination in school datasets
4. **Join library** — save join configurations as named presets that re-run automatically when the same GeoJSON is reloaded
5. **Export joined data** — download GeoJSON with join properties baked in, or as CSV with joined stats as additional columns

## Session history

Work is tracked across Claude sessions. To continue in a new session, paste the relevant Claude Docs URLs and the current `map-viewer.html` file. The docs survive session changes; the code does not — always re-upload the latest HTML.
