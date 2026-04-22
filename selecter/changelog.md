# GeoJSON Viewer — Feature Changelog

Numbers count up to #191 (most recent).

---

## April 16–22, 2026 (this session)

191. Histogram bar click 3-state cycle: highlight → bar-color filter → exclude
190. Null bar click: same 3-state cycle as regular bars
189. Null bar hover text: "null / non-numeric / filtered out"
188. Filter inputs: lo/hi numeric range with Reset (✕) button
187. Hide checkbox: hides out-of-range features; count shown in label as "Hide N" with strikethrough
186. Out-of-range features: dim grey color (`rgba(120,120,130,0.35)`) from palette expression
185. Squish renamed from "Clip"
184. Diverging and Sequential palettes available for numeric properties (not just quantitative schemes)
183. Palette filter range saved in URL hash (`numfilter=lo,hi,hide,cl,ch`)
182. Squish percentile sliders saved in URL hash
181. Filter undo: changing lo/hi inputs restores previously hidden features correctly
180. Filter reset (✕): restores hidden features before clearing `filterHiddenIds`
179. `filterHiddenIds` separate Set tracks filter-hidden features vs user-hidden features
178. `updateFilterHideCountDisplay` uses `getElementById` + `.isConnected` guard (avoids detached DOM)
177. Popout histogram syncs with panel histogram on filter/squish changes
176. Stat label hover tooltips: floating tooltip for MEAN / MED / Q1 / Q3 / ±σ values
175. Line Dash pill: — / – – / - - / · · / – · – / – · · – (solid/dash/shortdash/dot/dashdot/dashdotdot)
174. `line-dasharray` solid mode: removes property entirely (avoids MapLibre expression evaluate error)
173. `gv-outline-interact` nested zoom interpolate fixed (MapLibre `case` inside `interpolate` stops)
172. `clearAllFilterStates`: uses `featureById` Map for O(1) lookup (was `allFeatures[id]` array index bug)
171. Reset button: fully resets all style pills, palette filter, squish, and basemap to defaults
170. Clear button: resets palette Hide checkbox and restores filter-hidden features
169. Filter × button: clears `filterHiddenIds` and restores hidden features
168. `gv-line-casing` opacity uses per-feature `hidden` feature-state expression (not scalar) so filtered lines hide their casing
167. Line casing respects `geomVisible.line` when lines are globally hidden
166. Progress bar overlay: shown during file load with reading (0–40%), parsing (40–65%), building (65–75%)
165. Progress bar: shows feature count, file size, and estimated memory
164. New file drag-drop: fully resets palette, filters, squish, line style, and `filterHiddenIds`
163. fitBounds: uses reduce loop instead of `Math.min(...array)` (avoids stack overflow on large datasets)
162. `autoDetectLineDensity`: vertex-density metric (vertices/deg²) auto-activates density line mode for dense networks
161. Dense line threshold: 5M vertices/deg² with >500 features (calibrated to road grids vs bike networks)
160. Style panel auto-collapses when hovering property list
159. Screenshot resolution: 3× pixel ratio via `map.setPixelRatio(3)` before capture, restored after
158. Screenshot: black background composited for Hide basemap mode
157. Filename and screenshot name include active palette property (`by_PROPNAME`)
156. Filename includes numeric filter range (`range_lo-hi`)
155. Legend: shows palette property name and active filter range (numeric and categorical)
154. `applyPaletteToLayers` called after source `setData` on new file load (fixes grey features on drag-drop)
153. `updateSelectionBar` called after Hide to show correct hidden count in bottom panel
152. Basemap switch: fully restores `filterHiddenIds`-hidden features after style reload
151. Line casing opacity expression correct after `applyLineStyle` overwrite bug fixed
150. Filter reset: explicitly restores hidden feature states before clearing Set
149. `syncPopoutHistogram(key)` helper keeps popout in sync with all filter/squish interactions
148. Stat label hover tooltips: position clamped to viewport, fallback `<title>` for screen readers
147. Legend filter section: shows both categorical filter and numeric palette range simultaneously
146. `isQuantitativeScheme` check in Hide block gates correctly on cleared `filterHiddenIds`
145. Line casing: per-feature `hidden` state expression replaces scalar opacity, fixes casing on filtered items

## April 15, 2026

144. Highlight/select outlines: zoom-dependent width, thinner than before
143. Filter status row redesigned: FILTER label is a section header, not a value prefix
142. LABEL section: property names on same row, no color tinting
141. Teal divider line in popup between active and inactive properties
140. Highlighted feature count shows correctly in bottom bar
139. Every-other-click selection bug fixed (stale `activeFilter` guard removed)
138. `doHighlight` atomically clears and resets highlighted state

---

## April 13–14, 2026

137. Point style: white border option added to style pill
136. Polygon fill: auto-opacity by basemap brightness (dark / light / bright modes)
135. Mobile: style panel flex order fixed (tabs → style → file panel)
134. Mobile: sidebar fully hides with floating ☰ restore button
133. Mobile: style panel auto-collapses when hovering property list
132. Dots: only show on visible/filtered features (not all)

---

## April 12, 2026

131. Polygon outline: split into static `gv-outline` + interactive `gv-outline-interact` layers
130. `gv-outline-interact` uses zoom-interpolated width for hover/select/highlight
129. Feature state (selected/hidden) restored after basemap switch
128. Basemap switch race condition fixed: generation counter + `_styleLoadFired` guard
127. Named event handlers for reliable `map.off()` deregistration
126. Popup active-property sorting: palette=0, label=1, filter=2, normal=3
125. Popup teal divider below last active property row
124. Popup: palette property gets color dot; label property gets grey dot
123. `fill-outline-color: transparent` suppresses MapLibre built-in 1px GPU fill edge

---

## April 10–11, 2026

122. Quantitative palette system: Quantile / Linear / Jenks binning modes
121. Numeric histogram panel with bar chart, scrollable
120. Histogram: vertical and horizontal orientations, toggle button
119. Histogram popout panel (floating, larger view)
118. Histogram: MEAN / MED / Q1 / Q3 / ±σ reference lines
117. Histogram: bin count slider (2–50 bins)
116. Histogram: color bars match palette ramp
115. Histogram: bar click → 3-state cycle (highlight → filter → exclude)
114. Histogram: null/non-numeric grey bar with hover highlight
113. Histogram: hidden bin count shown in title
112. Squish (percentile clamp) sliders for palette range
111. Log scale toggle for quantitative palette
110. Flip (reverse) ramp direction button
109. Number of stops slider for quantitative palette
108. Numeric filter inputs (lo/hi) to set hard min/max range
107. colorbrewer ramp picker with color swatches
106. Histogram in legend mode
105. Vertex count display: "vertices" label, geom/prop % split

---

## April 9, 2026

104. Label text color: white with black halo on Dark/Black basemaps (all geometry types)
103. Label placement fixed to feature centroid for polygons (not bottom edge)
102. Basemap suggestion toast: suggest White when loading polygon-only files on dark basemaps

---

## April 8, 2026

101. Basemap switcher pill: White / Light / Gray / Dark / Black / Hide
100. Default basemap: Black
99. Landuse and POI visibility checkboxes in basemap section
98. Projection pill: Mercator / Globe (default Globe)
97. Globe/mercator saved in URL hash
96. Legend mode (`</>` button): compact map + color legend view
95. Legend shareable via URL (`view=legend`)
94. Legend: histogram shown for quantitative properties
93. Legend: categorical color swatches with hover-highlight
92. Legend: label properties listed
91. Legend: active filter shown with mode color

---

## April 6–7, 2026

90. Style panel: collapsible subsections (Points, Lines, Polygons, Basemap)
89. Points: Style pill (hollow / filled / outlined / outline)
88. Points: Size pill (density / zoom)
87. Lines: subtle casing layer (dark outline behind lines for contrast)
86. Lines: Width pill (Thin / Mid / Thick)
85. Lines: Size pill (Zoom / Density / Fixed)
84. Lines: Outline pill (None / Light / Grey / Dark)
83. Polygon fill opacity auto-adjusts to basemap (dark → 0.75, light → 0.35)
82. Polygon Outline pill (None / White / Grey / Black / Palette)
81. Polygon Width pill (Hair / Thin / Mid / Thick)
80. Polygon Size pill (Zoom / Density / Fixed)
79. Density mode for polygons: scale width and opacity by viewport feature count
78. Visible feature count in sidebar subtitle
77. Dataset memory size in sidebar subtitle
76. Vertex count and geom/attr split in sidebar subtitle
75. Layer filter for hidden features: excludes them from label collision
74. Dynamic point radius: slightly larger on highlight/select
73. Zoom-dependent nested interpolate bug fixed (MapLibre constraint)
72. Open second property while filtering by first: both panels visible simultaneously

---

## April 3, 2026

71. Colorbrewer match-by-count: pick the palette class that best matches number of distinct values
70. Shuffle uses full maximum color range, not clamped to value count
69. Long-tail values (beyond palette size) share fallback color, not assigned palette colors

---

## April 1–2, 2026

68. Palette coloring: click property name to color features by value using colorbrewer
67. colorbrewer palette picker with swatches
66. Palette shuffle button (rotate through color assignments)
65. Palette randomize/permute button (shuffle color order)
64. Native color support: if property named `color`/`colour` has CSS/hex values, use them automatically
63. Palette × button to remove coloring
62. Filter-while-palette: filter by prop A, colorize by prop B simultaneously
61. Palette state saved in URL hash
60. Property counts show percentage of features with each value
59. Percentage display: floor, show `<1%` not `0%` for small values
58. Count badge labels renamed to "Values" and "Count"
57. Cardinality ratio shown per property

---

## March 31, 2026

56. Dots mode pill (Off / Auto / Size / All) for midpoint dots on short lines and small polygons
55. Dots use Turf.js midpoints; size/zoom thresholds auto-adjust
54. Dots respect filter state (only visible/filtered features get dots)
53. Dots appear in tile mode as well as file mode
52. Progress indicators → right-arrow between highlight · filter · exclude · clear
51. "click to" changed to icon-only in UI hints

---

## March 30, 2026

50. Tile mode: label checkboxes for tiled feature properties
49. Tile labels persist across pan/zoom
48. URL hash: lat/lng/zoom always updated; skip intro when hash present
47. GeoJSON samples menu in file panel
46. Tile mode: don't highlight hidden features on hover
45. Property sort options: by Keys, Values, Count (both file and tile modes)
44. Count badge toggles: Values count / Feature count
43. Screenshot button in bottom bar, naming matches save-file logic

---

## March 27, 2026

42. Welcome/intro dialog on load with mode descriptions
41. Suppress intro dialog when URL hash contains data/filters
40. Tile mode: filter and exclude features by property value (same 3-state as file mode)
39. Popup offset: 28pt when popup appears below selection

---

## March 25–26, 2026

38. Filename includes property/value filter state when saving
37. Map tile mode: hover highlight and click-select road features
36. Map tile mode: shift-click to select sub-segments of MultiLineStrings
35. Shift-click casing highlight while hovering for sub-segment selection
34. Shift-click to deselect individual sub-segments
33. Tile mode: save selected tile features as GeoJSON
32. Tile mode: property popup for selected road features
31. Two-tab sidebar: File tab and Map Tiles tab
30. Zoom/pan buttons brightened
29. Gap between sidebar and bottom bar

---

## March 23–24, 2026

28. Property sidebar with collapsible value lists
27. Hover popup showing feature properties
26. Click to highlight (teal), filter (yellow), exclude (red) by property value — 3-state cycle
25. Select multiple features; count shown in bottom bar
24. Save Visible button (appears only when features are hidden)
23. Filter tag in bottom bar showing active prop/value/mode
22. Clear button to reset all selections and filters
21. Feature count in subtitle: visible / total
20. Label layer with configurable property name
19. URL hash: map position (zoom/lat/lng) persisted
18. Bottom bar: consolidate buttons, left/right alignment

---

## March 16, 2026

17. Console: swap label text and halo colors
16. Reduce popup flicker when moving between features
15. Brighter muted/grey text in sidebar and popup
14. Yellow filter state for property-filtered features
13. Red/exclude state for excluded features
12. Hidden feature count in bottom bar
11. Save Selected button in bottom bar
10. Bottom bar layout: filter tag on top, buttons aligned right
9. Buttons: colored outline default, filled on hover

---

## March 2, 2026

8. Initial MapLibre GL viewer setup with globe projection
7. Console: change polygon fill color and outline
6. Console: hide labels by layer name
5. Console: set fill-outline width
4. Console: find and hide lines by label text
3. Console: export screenshot of visible map
2. Console: export visible features as GeoJSON
1. Console: simplify visible lines with Turf.js

---
