# Selecter · Shapes

*2026-10-06 · John Oram*

## What shapes do

The Shapes panel lets you assign map symbols to categories in your data. Instead of every point appearing as the same dot, you can give hospitals a cross, schools a building icon, parks a leaf — whatever symbols your basemap's sprite sheet includes.

Shapes work alongside colors and sizes. You can style a layer with all three at once: color by one property, size by another, and shape by a third.

Under the hood, Selecter builds a MapLibre `match` expression for `icon-image` using your assignments. The available symbols depend on the basemap you're using — Streets and Dataviz have the widest sets; Satellite has fewer.

## Opening the Shapes panel

With a point layer loaded, click **Shapes** in the left toolbar. The panel opens and shows:

- A **Property** dropdown — pick the GeoJSON property whose distinct values you want to map to symbols.
- A list of **categories** (the unique values of that property), each with a symbol picker next to it.
- An **All others** row at the bottom for values not explicitly assigned.

Once you've picked a property, Selecter reads the distinct values from the loaded features and builds the list. Select a symbol from the dropdown next to each category. The map updates live as you assign.

## How shape mapping works

Each category gets one icon name from the basemap's sprite. A few things to know:

**The shape map.** Selecter maintains a `_shapeMap` object that records your assignments: `{ "hospital": "hospital", "school": "school", "park": "park" }`. This map is rebuilt from scratch whenever you change the shape property or reload the layer.

**The "none" value.** Setting a category to **(none)** tells Selecter to render those features without an icon — they still appear on the map but use the default circle or have no symbol rendered, depending on your layer type. This is useful when you want some categories invisible in the symbol layer while keeping them selectable.

**All others.** The fallback row in the panel assigns a symbol to any value not in your explicit map. If you leave it as none, unrecognized values render without a symbol.

**Shape mode.** Internally, Selecter tracks whether shape mapping is active via `_shapeMode` (a boolean) and which property drives it via `_shapeProp`. Reloading the layer clears both and resets the shape map.

## Shapes on the map

When shape mode is active, Selecter renders point features as a **symbol layer** rather than a circle layer. This means:

- Features appear as icons instead of dots.
- The icon size is set by the **Size** panel, same as before.
- Color styling still applies to the icon's halo or text, but icon color is controlled by the basemap sprite's own color unless you're on a basemap that supports `icon-color` with SDF icons.
- The **legend** in the bottom-left of the map updates to show each category's icon alongside its label.

If your basemap doesn't include a particular icon name you assigned, that feature will appear blank (MapLibre silently skips unknown sprite references). If you see missing icons, try a different basemap — Streets is the most complete for place and facility icons.

Shapes only apply to **point** layers. Line and polygon layers do not use the Shapes panel.

## Tips and limitations

**Sprite availability varies by basemap.** If you switch basemaps after assigning shapes, your icon names may not exist in the new sprite and features will go blank. Re-open the Shapes panel and reassign after switching.

**More than ~20 categories gets unwieldy.** The panel lists every distinct value, so high-cardinality fields (like a full address column) will generate a very long list. Pick a property with a small, meaningful set of values.

**Shapes survive layer reload — except when they don't.** If you drag a new file onto the map, the layer is replaced and `_shapeMode` resets. You'll need to re-open Shapes and reassign.

**No multi-property shapes yet.** You can only drive `icon-image` from one property at a time. Combining two properties into a shape key is on the roadmap.
