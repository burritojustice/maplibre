# Elevation Feature Changelog
## map-viewer.html · v670–v829

---

## Architecture Overview

Elevation data comes from **AWS Terrarium RGB-encoded DEM tiles** at zoom 12
(~38m/pixel ground resolution). The decode formula is:

```
elevation_m = (R × 256 + G + B / 256) − 32768
```

Tiles are fetched via `_fetchElevTile(z, x, y)`, decoded by
`_getElevationAt(lat, lng)`, and cached in `_elevTileCache` (128-entry LRU).

**⚠ Critical CORS note — do not remove `?src=selecter`:**
MapLibre loads Terrarium tiles for terrain rendering *without*
`crossOrigin='anonymous'`, causing the browser to cache those responses without
CORS headers. If our code then requests the same URL *with*
`crossOrigin='anonymous'`, Safari serves it from the non-CORS cache entry and
`getImageData()` returns silently wrong pixel values — not zeroed, just garbled.
Appending `?src=selecter` gives our requests a separate browser cache key,
ensuring we always get a properly CORS-headered response. This fixed the most
significant source of bad elevation values (v827).

---

## Feature History

### v670 · Elevation cursor (terrain mode)
- "Show elevation" checkbox in Basemap panel
- Floating tooltip follows cursor: terrain elevation (ft/m) + lat/lon
- Tile cache (64 entries), `_pending` flag to debounce rapid requests
- "Hide below sea level" contour filter changed from `≠ 0` to `> 0`

### v671 · Line hover — slope and elevation
- When hovering a line: slope %, degrees, start/end elevation, rise, run
- Two endpoint tiles fetched in parallel
- Tile cache expanded to 128 entries
- MultiLineString support

### v672–v676 · Tooltip refinements
- Absolute rise value (`Math.abs`)
- Screen-edge clipping: `_positionTooltip` flips tooltip left/up when near edge
- Popup-aware positioning: detects `.maplibregl-popup` overlap, nudges away
- Midpoint elevation row (Mid: NNNm) added between Start and End
- Light tooltip styling: white background, teal left border accent
- `fmtDist(m)` helper for distance formatting (ft/imperial first)

### v677–v691 · Midpoint caret marker
- `›` marker at geographic midpoint of hovered line, pointing toward higher endpoint
- Multiple rounds of bearing math, CSS transform, and Safari fixes
- Root cause: MapLibre applies `transform: translate(X,Y)` on marker root element,
  overwriting any CSS `transform` set there → fixed with two-element structure
  (outer div for MapLibre positioning, inner span for our `rotate()`)
- Offset computed in world-space pixels: `[-sin(bearing)×halfGlyph, cos(bearing)×halfGlyph]`

### v692 · Elevation cursor hardening
- 8-second timeout on tile fetches — stalled requests no longer freeze `_pending`
- Mouse leave resets `_pending` immediately
- `unfreeze()` stops elevation cursor as step 2

### v693 · Batch elevation calculation
- "Calculate elevation" button in Basemap panel
- Computes per-feature: `_selecter_elev_start/mid/end`, `_selecter_rise`,
  `_selecter_run`, `_selecter_slope_pct`, `_selecter_slope_deg`,
  `_selecter_slope_a/b_pct`, `_selecter_slope_max_pct`, `_selecter_bearing`,
  `_selecter_elevations[]`, `_selecter_slopes[]`
- 20 concurrent features processed, each with parallel tile fetches
- Progress bar with rate display (features/sec)
- Button relabels to "Recalculate elevation (YYYY-MM-DD)" after completion
- Signed slopes: positive = uphill in draw direction

### v694–v698 · Stats panel and auto-palette
- Statistics logging after batch: rate, min/max/mean/median, p10–p99, decile bins
- Auto-applies RdBu quantile palette on `_selecter_slope_pct` after calculation
- Fixed `paletteScheme = 'quantile'` (was `'quantitative'` — invalid value)
- `_displayPropName(k)` strips `_selecter_` prefix in all popup displays

### v699 · `unfreeze()` hardening
- Reloads from actual Protomaps style URL (not `map.getStyle()` which returns
  null when broken)
- Calls `restoreBgLayers()` after reload
- `unfreeze(true)` for hard page reload with hash preserved

### v776 · Five-point elevation sampling
- Batch calculation upgraded from 3 points (start/mid/end) to 5
  (start / ¼ / mid / ¾ / end)
- Sample positions use chord-length interpolation along the full coordinate array
- `_interpCoord(coords, t)` function: walks cumulative segment distances to find
  the true fractional position along a multi-vertex line
- New stored properties: `_selecter_elev_q1` (¼), `_selecter_elev_q3` (¾)
- `_selecter_slopes` array expanded from [A, B] to [A, B, C, D]
- `_selecter_slope_max_pct` reflects steepest of all four segments
- Hover tooltip shows all five elevations and four signed segment slopes

### v776 · Elevation profile chart in pinned popup
- SVG profile chart with:
  - Blue filled area under elevation curve
  - Colored segment markers (RdYlGn: red=steep, green=flat)
  - Grid lines, axis labels (distance + elevation)
  - Street name in title, tunnel warning (orange bar)
- Pin chart checkbox: keeps chart visible in corner panel while hovering other features
- SVG and PNG export buttons
- Hover popup suppressed when elevation inspect is active (tooltips conflict with geometry)

### v795 · Long-line elevation sampling overhaul
- For lines ≤ 200m: 5-point system (start/¼/mid/¾/end)
- For lines 200m–2km: sample every 50m
- For lines > 2km: sample every 100m
- Originally capped at 60 samples (introduced bug — see Bug History below)
- `_selecter_elevations` and `_selecter_slopes` arrays store all samples

### v821 · Elevation point layer on hover
- `geojson-elev-points` source and `gv-elev-points` circle layer added
- When hovering a line with elevation data: colored dots appear at each DEM
  sample point along the line
- Color: RdYlBu normalized to that feature's own elevation range
- Points cleared on mouse leave (unless "Elev points" visualize mode is active)

### v821 · "Elev points" visualize mode
- Added to Visualize pill (Off / Net slope / Max slope / Mid elev / Elev points)
- Shows elevation sample points for all calculated features simultaneously
- Labels show rounded meters (e.g. "47m"), fade in at zoom 13–13.5
- Label color: black text, white halo

### v822 · Elevation label styling
- Labels: black text, white halo (changed from white text, dark halo)

---

## Bug History

### Bug 1: Tile cache race condition (v823, partially)
**Symptom:** Elevation values wrong when multiple samples fall on the same
uncached tile, especially visible as "staircase" patterns or identical adjacent
values.

**Root cause:** `_fetchElevTile` cached the resolved canvas (not the Promise).
Multiple concurrent callers all saw a cache miss for the same tile, all started
independent fetches, each creating a separate canvas and calling `drawImage` +
`getImageData` independently. Under concurrent load this produced inconsistent
pixel reads.

**Fix:** Cache the Promise itself, not the resolved value. Every subsequent
caller for the same in-flight tile gets `await`-ed on the same Promise and
receives the same canvas. One fetch per tile, no races.

**Status:** Fixed in v823 (Promise caching). Later revealed to be the lesser
of two bugs — see Bug 2.

---

### Bug 2: CORS cache poisoning — the main culprit (v827)
**Symptom:** Stored `_selecter_elevations` values were systematically wrong
for large portions of long routes. The pattern: early samples looked correct,
then values diverged significantly from real terrain, then the final sample was
correct again. The "wrong" values were smooth and internally consistent (not
random noise) but corresponded to completely different terrain.

**Discovery process:**
1. `debugElevation()` console utility built (v825) to compare stored vs. live
   re-fetched values at identical coordinates
2. First runs showed stored ≠ live by large amounts — appeared to confirm a
   sampling bug
3. But the `debugElevation` utility was sampling at wrong positions (using
   `t = i/(n-1)` uniform fractions instead of the distance-interval positions
   used by `_computeElevationForFeature`) — making the comparison meaningless
4. After fixing the comparison: stored and live values matched perfectly,
   proving the stored data was consistent. This ruled out any JavaScript
   concurrency or coordinate mutation bug.
5. The tile coordinate log in `debugElevation` showed: same tile coords,
   same pixel coords, different values on different calls. Identical pixel
   coordinates returning different data = CORS taint.

**Root cause:** MapLibre loads Terrarium tiles for terrain rendering WITHOUT
`crossOrigin='anonymous'` (for performance). The browser caches these responses
without CORS headers. When our elevation code requests the same URL WITH
`crossOrigin='anonymous'`, Safari serves it from the cached non-CORS entry.
The canvas becomes tainted. `getImageData()` on a tainted canvas in Safari does
NOT throw a SecurityError — it returns pixel data that appears plausible but
is wrong. The values are not zeroed (which would be obvious) but garbled in
a way that produces smooth, internally consistent but geographically incorrect
elevation readings.

**Why the last sample was always correct:** By the time the final sample was
fetched (in sequential-ish processing), the browser's HTTP cache entry for that
tile had either expired or a fresh CORS-enabled request had replaced it.

**Why exploded Working points were correct:** `_samplePointsToWorking` used
batched sequential fetches (10 at a time), introducing enough delay that HTTP
cache entries were populated with proper CORS responses before subsequent
batches hit them.

**Fix:** Append `?src=selecter` to all Terrarium tile URLs in `_fetchElevTile`.
This gives our requests a distinct browser cache key from MapLibre's requests,
ensuring we always get a fresh, properly CORS-headered response.

**⚠ Do not remove the `?src=selecter` suffix.** The tile server ignores it,
but the browser cache treats it as a different resource. Removing it will
reintroduce corrupted elevation data.

---

### Bug 3: 60-sample cap leaving routes half-sampled (v828)
**Symptom:** After fixing the CORS bug, elevation profiles for long routes
still looked wrong: flat terrain for most of the route, then a sudden spike at
the end. The chart showed ~59 samples all near sea level followed by one correct
final value.

**Root cause:** `_computeElevationForFeature` had `const maxSamples = 60`.
An 11km route at 100m intervals needs 115 samples but was capped at 60.
The 60th sample was forced to `t=1.0` (the endpoint). So samples 0–58 covered
t=0.000 to t=0.510 — only the first half of the route — and sample 59 jumped
to t=1.000. The chart connected these 60 dots, showing flat coastal terrain for
59 points then one final spike.

**Fix:** Remove the 60-sample cap entirely. An 11km route at 100m = 115 samples;
a 20km route = 201 samples. Batch calculation is slightly slower for long lines
but the data covers the full route. `_samplePointsToWorking` had no such cap
and was already correct — the batch calculator now matches it.

---

### Bug 4: `_BATCH_CONCURRENCY` false lead (v823–v826)
**Symptom:** Concurrent feature processing appeared to cause coordinate
interference — stored elevations for one feature contained the elevation
profile of a different feature.

**Root cause hypothesis (wrong):** 20 concurrent `_computeElevationForFeature`
calls sharing coordinate arrays, with possible mutation from MapLibre's
`setData` normalization.

**What actually happened:** The "wrong feature's profile" appearance was caused
by Bug 2 (CORS poisoning) producing values that happened to resemble the terrain
along a different route. The coordinate arrays were never actually shared or
mutated.

**Attempted fix (unnecessary):** `_BATCH_CONCURRENCY` reduced from 20 to 1,
coordinates defensively copied with `.map(c => [c[0], c[1]])`.

**Resolution:** After the CORS fix (Bug 2) and cap removal (Bug 3), concurrency
was restored to 8 in v829. The coordinate copy was retained as defensive
practice but is not functionally necessary.

---

### Bug 5: `debugElevation()` comparison was invalid (v825–v827)
**Symptom:** `debugElevation()` showed large differences between stored and
live values, seemingly confirming a sampling bug — but the comparison was
comparing values at the wrong positions.

**Root cause:** `debugElevation` iterated using `t = i / (n-1)` (uniform
t-fractions across 0 to 1), while `_computeElevationForFeature` uses
`t = (i × INTERVAL_M) / totalM` (uniform distance intervals). For a route
with variable segment lengths, `t=0.5` in `debugElevation` landed at a
completely different coordinate than sample 30 in the stored array.

**Fix:** `debugElevation` updated to reconstruct the same `sampleTs` array
that `_computeElevationForFeature` would have produced, using the same
interval logic and no cap.

---

## Properties Stored Per Feature

| Property | Type | Description |
|---|---|---|
| `_selecter_elev` | number | Elevation (m) — points only |
| `_selecter_elev_start` | number | Start elevation (m) |
| `_selecter_elev_q1` | number | ¼-point elevation (m) |
| `_selecter_elev_mid` | number | Midpoint elevation (m) |
| `_selecter_elev_q3` | number | ¾-point elevation (m) |
| `_selecter_elev_end` | number | End elevation (m) |
| `_selecter_elevations` | JSON array | All sample elevations (m) |
| `_selecter_slopes` | JSON array | Per-interval signed slopes (%) |
| `_selecter_slope_pct` | number | Net slope start→end (%) |
| `_selecter_slope_max_pct` | number | Max absolute slope across all intervals (%) |
| `_selecter_slope_deg` | number | Net slope in degrees |
| `_selecter_rise` | number | Absolute elevation change (m) |
| `_selecter_run` | number | Chord length start→end (m) |
| `_selecter_bearing` | number | Bearing start→end (degrees) |
| `_selecter_elev_computed` | ISO string | Timestamp of calculation |

## Sampling Intervals

| Line length | Interval | Sample count |
|---|---|---|
| ≤ 200m | 5 fixed points (0, ¼, ½, ¾, 1) | 5 |
| 200m – 2km | 50m | 5–41 |
| > 2km | 100m | 21+ (no cap) |

DEM resolution at zoom 12 is ~38m/pixel. Sampling finer than 38m hits the same
pixel repeatedly; 50m and 100m intervals are both meaningful.
