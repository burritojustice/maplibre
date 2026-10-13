# Selecter · Quick Start

*2026-10-06 · John Oram*

## What is Selecter?

Selecter is a single-file web app for loading, exploring, and styling GeoJSON on an interactive map. Open `map-viewer.html` in any modern browser — no server, no install, no account required.

## Load your first file

Drag one or more files onto the map — GeoJSON, shapefiles, or CSVs with WKT geometry — and drop them anywhere. Selecter reprojects coordinates from any CRS automatically, fits the map to the features, and renders them immediately.

- **Points** render as circles.
- **Lines** render as strokes.
- **Polygons** render as filled shapes.

You can also load **files via the Open button in the toolbar. Drop multiple files at once to layer several datasets**. Selecter supports both feature collections and bare feature arrays.

Layer names default to file names. Selecter reprojects coordinates from any CRS automatically.

## Files, Tiles and Working panels

Selecter organises your workspace into three panels:

- **Files panel** — lists every dataset you have loaded. Click a layer name to make it active; double-click to zoom to fit. Click the pin icon next to a layer to promote it to the Working Panel.
- **Tiles panel** — lets you select features directly from OpenStreetMap vector tiles without loading a file. Choose a feature type (roads, paths, POIs…), draw a bounding box on the map, and the matching features are pulled in for you to style, join, or export.
- **Working panel** — your curated selection. Pin individual features from the map (click a feature, then Pin in the action bar) or pin an entire layer from the Files panel. Features here are ready for closer inspection, comparison, or export.

To select and pin features from the map: click any feature to open the info panel, then click **Pin** in the bottom action bar. The feature moves to the Working Panel and stays there even if you load other data on top.

## Load from the sample library

The sample library gives you instant access to commonly used reference datasets — city street networks, transit lines, administrative boundaries, and more — without hunting for files.

To open it, click **Library** in the toolbar. Browse by category or search by name, then click a dataset to load it onto the map. Library datasets behave like any other loaded file: you can style, join, select from, and export them.

## Load from a URL

You can load GeoJSON directly from a URL instead of a local file. Click **Open → From URL** in the toolbar, paste the URL, and click Load. Selecter fetches the file and adds it to your workspace like any dropped file. This works with public GeoJSON endpoints, GitHub raw links, and any URL that returns a valid GeoJSON response.

## Select and export

Selecter lets you save your data as GeoJSON at any point.

- **Save all features** — use **File → Save** to export the entire active layer as a GeoJSON file.
- **Save selected features** — select the features you want (click to select, keep clicking to add more), make any edits in the info panel, then click **Save selection** in the action bar. Only the pinned or selected features are written to the file.

This is useful for extracting a subset from a large dataset, or for saving the result of a join or style session as a clean new file.

## Explore the map

**Pan and zoom** with your mouse or trackpad as usual. Double-click to zoom in on a spot.

**Click any feature** to open the info panel on the right. It shows all the GeoJSON properties for that feature. If you have a join active, join-derived columns appear here too.

Keep clicking features to select them. Click a feature again to deselect, or use the Deselect button in the bottom action bar.

**Hover** over features to see a quick tooltip with key properties.

## Style your data

The left toolbar has four styling panels:

**Color** — pick a property and a color ramp. Categorical properties get a distinct color per value; numeric properties can use a stepped or graduated ramp. The legend updates automatically.

**Size** — scale point radius or line width by a numeric property. Drag the min/max sliders to set the size range.

**Labels** — display a property as a text label on each feature. Set the font size and offset. Labels are suppressed automatically if there are too many features to render legibly.

**Shapes** — for point layers, assign a basemap icon to each category value. See [Selecter · Shapes](https://claude.ai/code/artifact/09b860a0-543a-4179-a32c-8e74d4dc6143) for full details.

All four panels can be active at once.

## Join data from a CSV

Joins let you bring in external data and attach it to your GeoJSON features by a shared key column. The source can be a CSV file or another GeoJSON file — handy for merging properties from a second dataset.

1. Click the **Join** button in the toolbar.
2. In the dialog, select the **CSV file** you want to join and which column is the key.
3. Select which GeoJSON property is the matching key on the map side.
4. Click **Run join**.

Selecter matches rows from the CSV to GeoJSON features. Matched values are injected as new properties on each feature and immediately available for styling and popups.

For full details on join modes, the results table, filtering, and using join data on the map, see [Selecter · Joins](https://claude.ai/code/artifact/40f4a5dd-8826-4338-8be9-561f329d7366).

## Basemaps, elevation, and other options

**Basemaps** — switch vector basemap styles on the fly (light, white, grey, dark, black, or none) depending on your dataviz requirements, or choose satellite imagery. Toggle basemap labels as needed. Your data layer stays in place.

**Elevation** — add 3D terrain relief and dynamic elevation contours on top of the basemap. Tilt, orbit and fly over the 3D map, and exaggerate terrain height.

**Filter** — the filter bar in the right panel lets you type a search term to narrow which features are highlighted on the map and listed in the panel.

**Export** — you can copy selected feature properties from the info panel, or use your browser's built-in save-page feature to save the current state.

## Quick reference

| Action | How |
| --- | --- |
| Load a file | Drag one or more files onto the map, or click Open |
| Pan the map | Click and drag |
| Zoom in/out | Scroll wheel or trackpad pinch |
| Zoom to fit | Double-click the layer name |
| Select a feature | Click it |
| Deselect a feature | Click it again, or click Deselect in the action bar |
| Open styling panel | Click Color / Size / Labels / Shapes in toolbar |
| Open join dialog | Click Join in toolbar |
