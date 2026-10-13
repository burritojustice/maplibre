# Selecter · Joins

*2026-10-06 · John Oram*

Join a CSV or GeoJSON file to your map layer to explore aggregated stats, value lookups, and per-feature data — without leaving Selecter.

## What is a join?

A join links an external data file — a CSV spreadsheet or a second GeoJSON — to the features already on your map, matching rows to features by a shared key. Once joined, every feature carries the external data as properties you can color by, label with, size by, filter on, and inspect in the right-panel table. Nothing is written back to your original files; the join lives in memory for the session.

Use a join when your map layer has identifiers (census tract IDs, street segment codes, neighborhood names) and your data lives in a separate file — enrollment figures by school, incident counts by district, turn restrictions by street.

## Starting a join

Open the right panel, scroll to the **Join** section, and click **Join CSV** or **Join GeoJSON**. You can also drag a `.csv` or `.geojson` file directly onto the map — Selecter detects that a layer is already loaded and opens the join dialog automatically.

The join button appears in the panel whenever a layer is active. If no layer is loaded, load one first via **File → Open GeoJSON** or by dragging a file onto the map.

## The join dialog

**CSV joins** — Selecter reads the header row and scores each CSV column against every GeoJSON property to find the best key match. The top candidate is pre-selected; you can override it with the column and property dropdowns. A preview row shows the match rate before you commit.

**GeoJSON joins** — When your second file is a GeoJSON, Selecter uses value intersection scoring: it finds the property pair with the most shared values across both feature sets. Particularly useful for joining two layers that share neighborhood names, district codes, or street IDs but have different property names.

**Multi-row data (the filter section)** — If Selecter detects that multiple CSV rows map to the same feature (e.g. one row per school grade level per school site), it shows an amber filter section. Pick a **category column** and a **value** to keep only the rows you want before aggregating. The dropdown shows each value with its row count, key coverage, and percentage of total rows and keys — a value at 100% keys covers every feature.

## Join modes

Selecter detects the join mode automatically from your data.

**1 : 1 lookup** — Exactly one CSV row per feature. Selecter injects the raw column values directly as properties, named `join_val_<column>`. Use this to display enrollment for each school, or a score for each parcel.

**1 : many** — Multiple CSV rows per feature (after filtering, if a filter is set). Selecter aggregates numeric columns and injects summary statistics:

| Property | Meaning |
| --- | --- |
| `join_count` | Number of rows matched to this feature |
| `join_sum_X` | Sum of column X |
| `join_avg_X` | Mean of column X |
| `join_min_X` | Minimum of column X |
| `join_max_X` | Maximum of column X |
| `join_median_X` | Median of column X |
| `join_stddev_X` | Standard deviation of column X |
| `join_pct_X` | X as a percentage of the column total across all matched features |

The mode is shown as a pill in the join status bar: **1 : 1 lookup** or **1 : many**. Features with no matching row receive no join properties and appear as null in color and label expressions.

## The join table

After a join, the right panel shows a scrollable table — one row per GeoJSON feature. Clicking a row selects that feature on the map and opens its popup.

**Re-filter bar** — At the top of the table. When a row filter is active (from multi-row data), it shows the filter condition, matched row count, key coverage, and percentages. Click **✒ Change** to pick a different filter value or clear the filter. When no filter is set, the bar shows total row and key counts with an **✒ Add filter** button.

**Name picker** — The leftmost column header is a dropdown that lets you choose which GeoJSON property to display as the row label. Defaults to the display name property detected at join time.

**Column chooser** — Click **+** in the sort bar to add or remove columns. In 1 : 1 mode the first three value columns appear by default. In 1 : many mode, `join_count` appears by default. All injected join properties are available to add.

**Sorting** — Click any column header to sort ascending; click again for descending. A third click clears the sort.

**Expanding rows** — In 1 : many mode, click the ▾ expander on a row to see all the individual CSV rows that matched that feature.

## Using join data on the map

All injected join properties appear alongside the layer's native properties throughout Selecter. Once a join is active:

- **Color** — In the Style panel, pick a join property as the color source. `join_count`, `join_avg_X`, `join_pct_X`, and `join_val_X` all work with the choropleth color ramp. Selecter auto-detects the value range from the joined data.
- **Labels** — In the Labels section, choose any join property as the label expression. Combine it with native properties using the expression editor, e.g. a feature name on line 1 and `join_count` on line 2.
- **Size** — For point layers, the circle radius can be driven by a join property using the size-by expression, producing a proportional symbol map.
- **Filter** — The feature filter accepts join properties. Filter to features where `join_count > 10`, or where `join_val_Status = Active`.

Join properties appear in feature popups automatically alongside native properties.

## What's coming

- **Bidirectional hover highlight** — Hover a row in the join table → highlight that feature on the map; hover a feature on the map → scroll to and highlight its row.
- **Pivot wide mode** — Reshape multi-row data into one row per feature — e.g. enrollment by grade level becomes columns `enr_K`, `enr_1`, `enr_2` — enabling derived expressions like `enr_K / total`.
- **Second filter condition** — Add a second AND filter to the row filter, e.g. `ReportingCategory = School` AND `AggregateLevel = S` to exclude district-level rows.
- **Join library** — Save join presets (file + key column + filter) that re-run automatically when you reload the map.
- **Export joined data** — Download a GeoJSON with join properties baked in, or a CSV with join stats appended as extra columns.
- **Point-in-polygon spatial join** — Join a point layer to a polygon layer by containment: count points per polygon, sum their values, etc. (Turf.js is already loaded).
