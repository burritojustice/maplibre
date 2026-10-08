# What Is This?

A single-file MapLibre GL web app for loading, inspecting, styling, and selecting GeoJSON features — points, lines, and polygons. Can run locally. Uses Protomaps vector tiles. You should use your own token if self-hosting, this one is locked to this domain.

## Getting Started

Drop a GeoJSON file onto the map, or use the file picker in the File tab. The app accepts `.geojson`, `.json`, `.zip` (shapefile), and `.style.json` (saved styles).

---

## Three Tabs

### 📁 File
Your loaded GeoJSON data. The property list on the left shows all properties with counts and value distributions. Click a property to expand it and apply a color palette.

### 🗺 Tiles
Live vector tiles from the basemap. Click or shift-click road segments to select them. Use the filter row to select by attribute. Send selected segments to Working via 📌.

### 📌 Working
A persistent layer that survives page reloads. Pin features from File or Tiles here to build a curated collection. Has its own independent style panel.

---

## Property List

Each property row shows:

- **◉** (left) — palette indicator. Click once to apply a color palette. Click again to **pin** it (survives exploring other properties). Click a third time to unpin and clear.
- **◆** (left, categorical props only) — shape indicator. Click to assign point shapes by this property. Opens the shape assignment popover.
- **Type badge** — `123` (numeric), `ABC` (categorical), `T/F` (boolean).
- **Count badge** — unique values or numeric summary.
- **▶** — click to expand and see value distribution.

### Expanding a Property

Click **▶** to open the value list. For categorical properties, each value shows its count and color swatch. For numeric properties, a histogram appears with filter controls.

**Categorical actions (click a value row):**
- First click → **Highlight** (◎ magenta ring around matching features)
- Second click → **Filter** (show only matching features)
- Third click → **Exclude** (hide matching features)
- Fourth click → clear

**Numeric histogram:**
- Click a bin → cycle through select/hide states
- Drag the range handles to filter by range
- Toggle Hide to hide out-of-range features

---

## Color Palettes

Apply a palette by clicking ◉ next to any property, or by opening the property and clicking the scheme picker (▾ button).

**Categorical:** Set1, Set2, Set3, Paired, Pastel. Colors assigned to values by frequency.

**Quantitative:** Sequential (YlOrRd, Blues, etc.) and diverging (RdBu, RdYlBu) ColorBrewer schemes. Choose linear, quantile, or log scale.

**Pinning:** Pin a palette by clicking ◉ a second time. Pinned palettes stay active when you open other properties. A toast reminds you when a palette is pinned. Click ◉ a third time to unpin.

---

## Point Shapes

Click **◆** next to any categorical property in the property list. A popover opens showing each value's current shape assignment.

**Shapes available:** ○ Circle, ▲ Triangle, ▽ Inv. Triangle, ■ Square, ◆ Diamond, ★ Star, ⬠ Pentagon, ⬡ Hex-flat, ◈ Hex-point, ✚ Plus, ✕ X

**∅ (no symbol):** Hides features with that value from the shape layer (and their labels).

**Outline:** None / Outline only / White / Dark — set in the popover or Style › Points › Shapes.

**Size:** Tiny / Small / Medium / Large / Huge — set in Style › Points › Shapes.

Shapes are colored by whatever palette is currently active (including elevation palettes).

---

## Map Labels

In Style › Labels (or the label section of the expanded property), toggle labels on for any property. Multiple properties can be labeled simultaneously.

Labels on elevation/slope properties automatically include units:
- `_selecter_elev_*` → appends `m` or `ft` depending on the m/ft pill
- `_selecter_slope_pct` → appends `%`
- `_selecter_slope_deg` → appends `°`

---

## Selection

**Click** any feature to select it (turns teal). **Shift+click** to add more.

**🧲 Magnet Select** (action bar): hover a feature for 0.4 seconds → magenta blink → selected. Hover a selected feature → blink → deselected. Works on File, Tiles, and Working features. Useful for removing individual features from a search result.

**Search/filter deselect:** When features are selected via a filter, magnet-deselecting one correctly hides it from the filtered view.

**Selection bar** (bottom of map) shows:
- Feature count
- 💾 Save selected as GeoJSON
- 🗑 Clear selection
- 📌 Pin to Working tab
- Deselect all

---

## Elevation & Slope

### Calculate Elevation
In the **Elevation** accordion panel, click **Calculate elevation**. The app fetches terrain DEM tiles and writes these properties to every line feature:

| Property | Description |
|----------|-------------|
| `_selecter_elev_start` | Elevation at start point (m) |
| `_selecter_elev_mid` | Elevation at midpoint (m) |
| `_selecter_elev_end` | Elevation at end point (m) |
| `_selecter_rise` | Signed vertical change (m) |
| `_selecter_run` | Horizontal distance (m) |
| `_selecter_slope_pct` | Slope percentage |
| `_selecter_slope_deg` | Slope in degrees |
| `_selecter_slope_a_pct` | First-half slope |
| `_selecter_slope_b_pct` | Second-half slope |
| `_selecter_bearing` | Uphill bearing (°) |

For point features: `_selecter_elev` (elevation at point location).

After calculation, a RdBu reversed palette is automatically applied (red = steep, blue = flat for lines; red = high, blue = low for points).

### Display Units
The **[m | ft]** pill controls how elevation values appear in:
- Hover tooltip
- Property popups
- Map feature labels

Exports always use meters; `_selecter_units` metadata documents this.

### Inspect on Hover
Toggle **Inspect on hover** to show a floating tooltip with terrain elevation at the cursor. Hovering a line shows slope %, start/mid/end elevation, rise, run, and segment A/B breakdown with a caret marker pointing uphill.

### Elevation Stats
After batch calculation, **Stats ▸** opens a panel with decile tables and equal-value bins for slope and elevation.

---

## Contour Lines

In the **Elevation** panel, enable **Contours**.

- **Source:** Terrarium (generated on-the-fly) or OSM.us (pre-generated vector tiles)
- **Unit:** Feet or Meters
- **Detail:** Coarse | Medium | Fine (default) | V. Fine
- **Major:** emphasize major contours — None / Subtle / Strong
- **Labels:** on/off
- **Color:** Default (grey) or Elevation (RdYlBu — blue=low, red=high)

### Export Visible Contours
Click **⬇ Export visible contours** to download the currently visible contour lines as GeoJSON. Contours crossing tile boundaries are merged. Filename includes the viewport bbox.

---

## Basemap

**Styles:** White, Light, Gray, Dark, Black, Satellite (ESRI and Maptiler)

**Satellite:** ESRI and Maptiler (key required). Note that ESRI tiles seem slightly offset at city block zoom levels, at least for SF. Maptiler lines up better with public data sources but seems lower resolution and imagery updates lag.

**Terrain:** 3D elevation with exaggeration from Off to 3×. Full settings in the Basemap accordion.

**Hillshade:** Natural, dramatic, or flat presets. Full settings in Basemap.

The Elevation panel has On/Off mirrors for Terrain and Hillshade — changes sync bidirectionally.

**Globe:** Toggle between Mercator and globe projection in Basemap.

---

## Animation

Action bar buttons:

- **↻ Rotate** — continuous orbit around the map center
- **🌀 Fly** — pendulum-style bearing sweep
- **↕ Tilt** — pitch toggle (0° ↔ 60°)

Animations auto-pause after 30 minutes with a resume toast.

---

## Style Save & Restore

Style decisions (palette, labels, line/point/polygon formatting, filter state, hidden features, shape assignments) are automatically saved to `localStorage` when you close the page — but only if you've made changes.

On next load, a banner offers to **Reapply style** if the same file is detected. You can:
- **Reapply** — restores the full style
- **Save style.json** — downloads the style for sharing or backup
- **Dismiss** — clears the cached style (won't reappear)
- **Clear all** — removes all cached styles

**Import style:** Drag a `.style.json` file onto the map to apply a saved style.

**Style history:** `showStyleHistory()` in the browser console lists all cached styles.

---

## Working Tab Persistence

Features in the Working tab are saved to `localStorage` on page close and restored on next load. A toast confirms restoration: "Restored N features from Xm ago."

---

## Session Recovery

If the map freezes, try in the browser console:

```js
unfreeze()        // soft recovery: reloads style, restores layers
unfreeze(true)    // hard reload: preserves URL hash state
```

---

## Console Utilities

```js
// Style
showStyleHistory()           // list all cached styles
clearStyleCache()            // remove all cached styles
exportStyleJSON('filename')  // download current style

// Elevation
densityRadiusThresholds      // view/edit point size thresholds
densityRadiusThresholds[6][1] = 1.5; updatePointRadius()  // tune live

// Memory
logMemory('label')           // print memory snapshot

// Map state
map.getZoom()
map.getBearing()
map.getPitch()
map.getCenter()
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Escape | Clear selection / dismiss popup |
| ← → | Step through features in stack |

---

## File Formats

**Input:** `.geojson`, `.json`, `.zip` (shapefile with .prj), `.style.json`

**Output:**
- `.geojson` — selected features, with optional style embedded
- `.style.json` — style only (palette, labels, formatting)
- Feature ID list for URL sharing

---

## Tips & Tricks

**Multi-file append:** Drop a second file onto the map — it appends to the existing data. The title shows "2 files" with combined feature count.

**Tune density radius live:**
```js
densityRadiusThresholds = [[20,7],[80,6],[300,5],[1200,4],[5000,3],[10000,2],[Infinity,1]];
updatePointRadius();
```

**Test symbol outlines:**
```js
map.setPaintProperty('gv-point-shape', 'icon-halo-width', 5)
map.setPaintProperty('gv-point-shape', 'icon-halo-color', '#ffffff')
```

**Force map repaint:**
```js
map.triggerRepaint()
map.resize()
```

**Check contour protocol:**
```js
map.getPaintProperty('contour-line', 'line-color')  // check contour color expression
```

## Technical Notes

### MapLibre + mlcontour DataCloneError Fix

**Problem:** MapLibre v5's tile loading pipeline sends requests to a web worker via `structuredClone`. When `mlcontour` registers a custom protocol via `addProtocol`, the DEM tile fetch completes and the browser may **transfer** (neuter) the `ArrayBuffer` as an optimization, setting its `byteLength` to 0. MapLibre then tries to clone this neutered buffer to send it to the worker — which throws `DataCloneError` because transferred `ArrayBuffer`s can't be serialized.

**Fix:** Wrap `maplibregl.addProtocol` before calling `mlcontour.DemSource.setupMaplibre()`. The wrapper intercepts the handler result and calls `.slice(0)` on any `ArrayBuffer`, creating a fresh copy that can be structured-cloned:

```javascript
const _origAddProtocol = maplibregl.addProtocol.bind(maplibregl);
maplibregl.addProtocol = function(name, handler) {
    const wrappedHandler = async (params, abortController) => {
        const result = await handler(params, abortController);
        if (result instanceof ArrayBuffer) return { data: result.slice(0) };
        if (result?.data instanceof ArrayBuffer) return { data: result.data.slice(0) };
        // ... handle other return shapes
        return result;
    };
    return _origAddProtocol(name, wrappedHandler);
};
source.setupMaplibre(maplibregl);
maplibregl.addProtocol = _origAddProtocol; // restore
```

**Why `.slice(0)` works:** `ArrayBuffer.prototype.slice()` always creates a new, non-transferred buffer. The original buffer may be neutered (zero byteLength), but `slice(0)` of a neutered buffer returns an empty buffer — which at least doesn't throw. For non-neutered buffers it returns a full copy that the worker can receive safely.

**Note:** `Response` objects are also not serializable via `structuredClone` in Safari — wrapping in `new Response(arrayBuffer)` causes `"can't serialize object of unregistered class Response"`. The `{ data: ArrayBuffer }` shape is the correct target format for MapLibre v5 custom protocols.
