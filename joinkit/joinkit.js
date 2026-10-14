/*!
 * JoinKit — table-to-geometry join logic shared by Selecter and Joiner.
 *
 * Pure functions only: no DOM, no MapLibre, no globals. Works as a plain
 * <script> (exposes window.JoinKit) and under Node (module.exports), so it
 * keeps Selecter's no-build, no-modules rule and can be unit tested.
 *
 * Extracted from selecter/index.html (v964). Functions marked "Selecter
 * parity" must produce byte-identical results to the code they replaced —
 * joinkit/test/parity.test.js checks this against the original source.
 *
 * https://github.com/burritojustice/maplibre/tree/main/joinkit
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.JoinKit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const VERSION = '0.1.0';
const noop = () => {};

// ═════════════════════════════════════════════════════════════════════════
// Value normalization
// ═════════════════════════════════════════════════════════════════════════

// Selecter parity (normVal). Strips thousands-separator commas from numeric
// strings so "3,495,000" matches the integer property 3495000.
function normVal(v) {
    if (!v) return '';
    const stripped = String(v).trim().replace(/,/g, '');
    return isNaN(stripped) || stripped === '' ? String(v).trim() : stripped;
}

// Selecter parity (_parseNum / parseCurrencyVal). Number from a cell,
// accepting "$45,000" style currency strings. Returns null when not numeric.
function parseNum(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const s = String(v).trim();
    if (!isNaN(Number(s)) && isFinite(Number(s))) return Number(s);
    const stripped = s.replace(/^\$/, '').replace(/,/g, '').trim();
    const n = Number(stripped);
    return (!isNaN(n) && isFinite(n)) ? n : null;
}

function isCurrencyVal(v) {
    if (v === null || v === undefined || v === '') return false;
    return String(v).trim().startsWith('$');
}

// Text form of a cell. Airtable returns selects as {name}, multi-selects and
// linked records as arrays; flatten those to their display names.
function cellText(v) {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(cellText).filter(s => s !== '').join(', ');
    if (typeof v === 'object') return v.name != null ? String(v.name) : (v.label != null ? String(v.label) : JSON.stringify(v));
    return String(v);
}

// Split a cell into its individual values. Arrays (Airtable multi-select,
// linked records) are always split; strings only when a delimiter is given.
function cellValues(v, delimiter) {
    if (v === null || v === undefined || v === '') return [];
    if (Array.isArray(v)) return v.flatMap(x => cellValues(x, delimiter));
    if (typeof v === 'object') return [cellText(v)];
    if (delimiter) {
        const parts = delimiter instanceof RegExp ? String(v).split(delimiter) : String(v).split(delimiter);
        return parts.map(s => s.trim()).filter(Boolean);
    }
    return [v];
}

// Build a key normalizer. Defaults match normVal, except that numeric 0 is
// kept as the key "0" (normVal treats it as empty — a Selecter quirk that
// buildJoin's default keeps for parity).
//   stripPrefix        RegExp or string removed from the start ("D5" → "5")
//   caseInsensitive    lowercase both sides
//   collapseSpace      squeeze internal whitespace runs to one space
//   stripLeadingZeros  "007" → "7"  (Selecter known issue: "01" vs 1)
//   padStart           [width, char] e.g. [5, '0'] for zips stored as numbers
//   aliases            { rawValue: canonicalValue } crosswalk, applied first
function makeKeyNormalizer(opts) {
    const o = opts || {};
    const fold = s => o.caseInsensitive ? s.toLowerCase() : s;
    const squeeze = s => o.collapseSpace ? s.replace(/\s+/g, ' ') : s;
    const aliasMap = new Map();
    if (o.aliases) {
        for (const [k, v] of Object.entries(o.aliases)) aliasMap.set(fold(squeeze(String(k).trim())), v);
    }
    const prefix = typeof o.stripPrefix === 'string'
        ? new RegExp('^' + o.stripPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), o.caseInsensitive ? 'i' : '')
        : o.stripPrefix || null;
    return function normalizeKey(v) {
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'object') v = cellText(v);
        let s = squeeze(String(v).trim());
        const aliasKey = fold(s);
        if (aliasMap.has(aliasKey)) s = squeeze(String(aliasMap.get(aliasKey)).trim());
        if (prefix) s = s.replace(prefix, '').trim();
        s = normVal(s);
        if (o.stripLeadingZeros && /^0+\d/.test(s)) s = s.replace(/^0+(?=\d)/, '');
        if (o.padStart && /^\d+$/.test(s)) s = s.padStart(o.padStart[0], o.padStart[1] || '0');
        return fold(s);
    };
}

// Normalized, de-duplicated keys for one row.
function rowKeys(row, keyCol, normalize, delimiter) {
    const raw = row[keyCol];
    const vals = (Array.isArray(raw) || delimiter) ? cellValues(raw, delimiter) : [raw ?? ''];
    const out = [];
    for (const v of vals) {
        const k = normalize(v);
        if (k && !out.includes(k)) out.push(k);
    }
    return out;
}

// ═════════════════════════════════════════════════════════════════════════
// Column classification (numeric / currency / categorical)
// ═════════════════════════════════════════════════════════════════════════

const CURRENCY_NAME_HINTS = ['amount','cost','price','budget','fee','payment','revenue',
    'salary','wage','income','spend','spending','expense','grant','award','funded','funding','total'];

// Column names that look numeric but are identifiers — always categorical.
const FORCE_CAT_NAMES = [
    'zip','zipcode','zip_code','postal','postalcode',
    'geoid','geo_id','fips','fips_code',
    'tractce','tract','blkgrpce','blockce','blockgrp',
    'countyfp','statefp','stateabbr','state_fips',
    'objectid','object_id','globalid','global_id',
    'phone','tel','telephone','mobile','fax',
    'ssn','ein','tax_id',
    'year','yr',
    'district','dist','ward','precinct','zone','sector','region','area','quad',
    'supdist','sup_dist','supervisorial',
];
// Matched as whole "_"-separated tokens only ("awarded" does not match "ward").
const FORCE_CAT_PARTIAL = ['district','ward','precinct','zone','sector'];

// Selecter parity (_isForcecat in _buildJoinStore).
function isForcedCategorical(col, vals) {
    const low = col.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (FORCE_CAT_NAMES.some(n => low === n || low === n + '_' || low.endsWith('_' + n) || low.startsWith(n + '_'))) return true;
    const tokens = low.split('_').filter(Boolean);
    if (FORCE_CAT_PARTIAL.some(n => tokens.includes(n))) return true;
    const zeropadded = vals.filter(v => /^0\d{3,}$/.test(String(v).trim())).length;
    if (zeropadded / vals.length > 0.3) return true;
    const numericVals = vals.map(v => Number(v)).filter(n => !isNaN(n) && isFinite(n));
    if (numericVals.length / vals.length > 0.9) {
        const allSmallInt = numericVals.every(n => Number.isInteger(n) && n >= 1 && n <= 99);
        const distinctCount = new Set(numericVals).size;
        if (allSmallInt && distinctCount <= 20) return true;
    }
    return false;
}

// Selecter parity (column loop in _buildJoinStore).
//   exclude   columns to skip entirely (the join key)
//   types     { col: 'numeric' | 'currency' | 'categorical' } — explicit types
//             win over guessing. Use this for sources with a schema (Airtable)
//             so 0–5 score fields aren't mistaken for district numbers.
//   statsCol  restrict numeric stats to one column ('__all__' = no restriction)
//   log       optional logger, e.g. console.log
function classifyColumns(rows, headers, opts) {
    const o = opts || {};
    const log = o.log || noop;
    const exclude = new Set(o.exclude || []);
    const types = o.types || {};
    let numericCols = [], catCols = [];
    const currencyCols = new Set();

    headers.filter(h => !exclude.has(h)).forEach(col => {
        const t = types[col];
        if (t === 'numeric' || t === 'currency') {
            numericCols.push(col);
            if (t === 'currency') currencyCols.add(col);
            return;
        }
        if (t === 'categorical') { catCols.push(col); return; }

        const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
        if (!vals.length) { catCols.push(col); return; }

        if (isForcedCategorical(col, vals)) {
            catCols.push(col);
            log(`[join] cat col (forced): "${col}" — zip/census/id/phone column`);
            return;
        }
        const currencyCount = vals.filter(v => isCurrencyVal(v)).length;
        const isCurrencyCol = currencyCount > 0 && currencyCount / vals.length >= 0.5;

        const parseableCount = vals.filter(v => parseNum(v) !== null).length;
        if (!parseableCount) { catCols.push(col); return; }
        const parseableRatio = parseableCount / vals.length;
        const colLower = col.toLowerCase();
        const nameHint = CURRENCY_NAME_HINTS.some(h => colLower.includes(h));

        // Currency columns: ≥1 value, ≥10% parseable (free text mixed in is common).
        // Plain numeric columns: ≥3 values, ≥50% parseable.
        const loose = isCurrencyCol || (nameHint && currencyCount > 0);
        const minRequired = loose ? 1 : 3;
        const minRatio = loose ? 0.1 : 0.5;

        if (parseableCount >= minRequired && parseableRatio >= minRatio) {
            numericCols.push(col);
            if (loose) currencyCols.add(col);
            log(`[join] numeric col: "${col}" currency=${isCurrencyCol} parseable=${parseableCount}/${vals.length}`);
        } else {
            catCols.push(col);
            log(`[join] cat col: "${col}" parseable=${parseableCount}/${vals.length} minReq=${minRequired} ratio=${parseableRatio.toFixed(2)} sample="${vals[0]}"`);
        }
    });

    if (o.statsCol && o.statsCol !== '__all__') {
        catCols = [...catCols, ...numericCols.filter(c => c !== o.statsCol)];
        numericCols = numericCols.filter(c => c === o.statsCol);
    }
    return { numericCols, catCols, currencyCols };
}

// ═════════════════════════════════════════════════════════════════════════
// Aggregation
// ═════════════════════════════════════════════════════════════════════════

// Selecter parity (_computeJoinAgg).
function computeAgg(rows, numericCols, catCols) {
    const agg = { count: rows.length };
    numericCols.forEach(col => {
        const vals = rows.map(r => parseNum(r[col])).filter(v => v !== null);
        if (!vals.length) {
            ['sum','avg','min','max','median','stddev'].forEach(a => agg[`${a}_${col}`] = null);
            agg[`count_${col}`] = 0; return;
        }
        vals.sort((a, b) => a - b);
        const n = vals.length, sum = vals.reduce((a, b) => a + b, 0), mean = sum / n;
        const median = n % 2 === 0 ? (vals[n/2-1] + vals[n/2]) / 2 : vals[Math.floor(n/2)];
        const stddev = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
        agg[`count_${col}`]  = n;
        agg[`sum_${col}`]    = parseFloat(sum.toFixed(4));
        agg[`avg_${col}`]    = parseFloat(mean.toFixed(4));
        agg[`min_${col}`]    = vals[0];
        agg[`max_${col}`]    = vals[n - 1];
        agg[`median_${col}`] = parseFloat(median.toFixed(4));
        agg[`stddev_${col}`] = parseFloat(stddev.toFixed(4));
    });
    catCols.forEach(col => {
        const counts = {};
        rows.forEach(r => { const v = cellText(r[col]).trim(); if (v) counts[v] = (counts[v] || 0) + 1; });
        agg[`mode_${col}`] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    });
    return agg;
}

// Category value counts across rows; multi-valued cells count each value.
function countValues(rows, col, opts) {
    const o = opts || {};
    const counts = {};
    rows.forEach(r => {
        const raw = r[col];
        const vals = Array.isArray(raw) ? cellValues(raw).map(cellText) : [cellText(raw)];
        vals.forEach(v => { v = String(v).trim(); if (v) counts[v] = (counts[v] || 0) + 1; });
    });
    if (o.max && Object.keys(counts).length > o.max) return null;
    return counts;
}

// Selecter csvTotals: parseFloat after stripping "$" and ","; kept separate from
// parseNum because parseFloat accepts trailing text ("12 units" → 12).
function columnTotal(rows, col) {
    return rows.reduce((acc, r) => {
        const v = cellText(r[col]).trim().replace(/^\$/, '').replace(/,/g, '');
        const n = parseFloat(v);
        return isNaN(n) ? acc : acc + n;
    }, 0);
}

// ═════════════════════════════════════════════════════════════════════════
// Indexes and the join itself
// ═════════════════════════════════════════════════════════════════════════

const defaultIdOf = f => f.properties._gvid;

// Map of normalized property value → [feature ids], for one property.
function buildFeatureIndex(features, propKey, opts) {
    const o = opts || {};
    const normalize = o.normalize || normVal;
    const idOf = o.idOf || defaultIdOf;
    const index = new Map();
    features.forEach(f => {
        const v = normalize(String(f.properties?.[propKey] ?? ''));
        if (!v) return;
        if (!index.has(v)) index.set(v, []);
        index.get(v).push(idOf(f));
    });
    return index;
}

// Selecter parity (propIndex in _joinFromGeoJSON / _loadCSV).
// { propKey: Map(normalizedValue → Set(featureId)) } across many properties.
function buildPropIndex(features, props, opts) {
    const o = opts || {};
    const normalize = o.normalize || normVal;
    const idOf = o.idOf || defaultIdOf;
    const propIndex = {};
    for (const f of features) {
        for (const k of props) {
            const v = f.properties[k];
            if (v == null || v === '') continue;
            const nv = normalize(String(v));
            if (!propIndex[k]) propIndex[k] = new Map();
            if (!propIndex[k].has(nv)) propIndex[k].set(nv, new Set());
            propIndex[k].get(nv).add(idOf(f));
        }
    }
    return propIndex;
}

const NAME_HINTS = ['name','title','label','school','site','building','address','street','facility','location','description','place'];

// Selecter parity (_buildJoinStore minus UI state).
// Joins rows to features on rows[keyCol] ↔ feature.properties[propKey].
//   normalize   key normalizer (default normVal) — applied to both sides
//   delimiter   split string keys ("1, 3") into several; arrays always split
//   idOf        feature → stable id (default properties._gvid)
//   types, statsCol, log — see classifyColumns
// A row whose cell holds several keys counts once toward each matched feature.
function buildJoin(params) {
    const { rows, headers, keyCol, features, propKey } = params;
    const normalize = params.normalize || normVal;
    const idOf = params.idOf || defaultIdOf;
    const log = params.log || noop;

    const { numericCols, catCols, currencyCols } = classifyColumns(rows, headers, {
        exclude: [keyCol], types: params.types, statsCol: params.statsCol, log,
    });

    const index = buildFeatureIndex(features, propKey, { normalize, idOf });
    const keysOf = r => rowKeys(r, keyCol, normalize, params.delimiter);

    const byId = {};
    let matchedRows = 0, nullRows = 0;
    const unmatchedVals = new Set();
    rows.forEach(row => {
        const keys = keysOf(row);
        if (!keys.length) { nullRows++; return; }
        const ids = [];
        let matched = false;
        keys.forEach(k => {
            const hit = index.get(k);
            if (!hit) { unmatchedVals.add(k); return; }
            matched = true;
            hit.forEach(id => { if (!ids.includes(id)) ids.push(id); });
        });
        if (matched) matchedRows++;
        ids.forEach(id => {
            if (!byId[id]) byId[id] = { rows: [] };
            byId[id].rows.push(row);
        });
    });

    Object.values(byId).forEach(entry => { entry.agg = computeAgg(entry.rows, numericCols, catCols); });
    const globalAgg = computeAgg(rows, numericCols, catCols);

    // Per-column range of per-feature averages — drives palette breaks.
    const aggColumns = {};
    numericCols.forEach(col => {
        const vals = Object.values(byId).map(e => e.agg[`avg_${col}`]).filter(v => v !== null);
        if (!vals.length) return;
        vals.sort((a, b) => a - b);
        const n = vals.length, sum = vals.reduce((a, b) => a + b, 0), mean = sum / n;
        aggColumns[col] = { min: vals[0], max: vals[n-1], mean: parseFloat(mean.toFixed(3)),
            count: n, nullCount: Object.keys(byId).length - n };
    });

    const catColumns = {};
    catCols.forEach(col => {
        const counts = countValues(rows, col, { max: 40 });
        if (counts) catColumns[col] = counts;
    });

    // Totals: all rows (denominator for pct_) vs rows that matched a feature.
    const csvTotals = Object.fromEntries(numericCols.map(col => [col, columnTotal(rows, col)]));
    const joinedTotals = Object.fromEntries(numericCols.map(col => {
        let sum = 0;
        Object.values(byId).forEach(e => { const v = e.agg[`sum_${col}`]; if (v != null) sum += v; });
        return [col, parseFloat(sum.toFixed(4))];
    }));
    numericCols.forEach(col => {
        const total = csvTotals[col];
        if (!total || total <= 0) return;
        Object.values(byId).forEach(e => {
            const s = e.agg[`sum_${col}`];
            e.agg[`pct_${col}`] = (s !== null && s !== undefined) ? parseFloat((s / total * 100).toFixed(2)) : null;
        });
    });

    const joinedWithMultiple = Object.values(byId).filter(e => e.rows.length > 1).length;
    const isLookup = joinedWithMultiple === 0 && Object.keys(byId).length > 0;

    const { displayNameProp, displayNameCol } = detectDisplayName({
        rows, headers, keyCol, features, joinedCount: Object.keys(byId).length,
    });

    return {
        keyCol, propKey, headers, rows, numericCols, catCols, currencyCols,
        byId, globalAgg, aggColumns, catColumns, csvTotals, joinedTotals,
        isLookup, joinedWithMultiple, displayNameProp, displayNameCol,
        totalRows: rows.length, matchedRows, nullRows,
        unmatchedVals: [...unmatchedVals].sort(),
    };
}

// Selecter parity (display-name detection in _buildJoinStore).
// Prefers a name-like feature property; falls back to a name-like row column.
function detectDisplayName({ rows, headers, keyCol, features, joinedCount }) {
    const geoProps = [...new Set(features.flatMap(f =>
        Object.keys(f.properties || {}).filter(k => !k.startsWith('_') && !k.startsWith(':'))))];
    const keyCount = joinedCount || 1;
    const scoreCol = vals => {
        const uniq = new Set(vals.filter(v => v && v !== '')).size;
        return uniq >= Math.min(keyCount * 0.5, 3) ? uniq : 0;
    };
    const nameLike = s => NAME_HINTS.some(h => s.toLowerCase().replace(/[^a-z]/g, '').includes(h));
    const displayNameProp = geoProps.filter(nameLike)
        .map(k => ({ k, score: scoreCol(features.map(f => String(f.properties[k] ?? ''))) }))
        .filter(x => x.score > 0).sort((a, b) => b.score - a.score)[0]?.k || null;
    const displayNameCol = displayNameProp ? null : (headers
        .filter(h => nameLike(h) && h !== keyCol)
        .map(h => ({ h, score: scoreCol(rows.map(r => cellText(r[h]))) }))
        .filter(x => x.score > 0).sort((a, b) => b.score - a.score)[0]?.h || null);
    return { displayNameProp, displayNameCol };
}

// ═════════════════════════════════════════════════════════════════════════
// Key candidate scoring (which row column joins to which feature property)
// ═════════════════════════════════════════════════════════════════════════

const PREFERRED_JOIN_FIELDS = ['cnn','objectid','geoid','fips','zip','zipcode',
    'tractce','tract','block','supdist','nhood','neighborhood'];

// Selecter parity (match search at the top of _runJoinFlow).
// Priority 1: column name equals property name (case-insensitive) and shares values.
// Priority 2 (only if none): value intersection, ≥ min(3, 50% of rows) shared values.
// Returns { matches, byName, valueMatchesForDisplay }; matches[0] is the best guess.
function scoreKeyCandidates({ rows, headers, propIndex, geoJsonProps, normalize }) {
    const norm = normalize || normVal;
    const colVals = new Map();
    const valsOf = col => {
        if (!colVals.has(col)) colVals.set(col, rows.map(r => norm(r[col])).filter(v => v));
        return colVals.get(col);
    };
    const gvidsFor = (valMap, hits) => {
        const s = new Set();
        for (const v of hits) valMap.get(v)?.forEach(id => s.add(id));
        return s;
    };

    const nameMatches = [];
    for (const csvCol of headers) {
        const csvLow = csvCol.toLowerCase();
        for (const propKey of geoJsonProps) {
            if (propKey.toLowerCase() !== csvLow) continue;
            const csvSet = new Set(valsOf(csvCol));
            const hits = [...csvSet].filter(v => propIndex[propKey]?.has(v));
            if (!hits.length) continue;
            const matchedGvids = gvidsFor(propIndex[propKey], hits);
            nameMatches.push({ csvCol, propKey, hits, csvMatchCount: hits.length,
                featureMatchCount: matchedGvids.size, matchedGvids,
                isOneToOne: hits.length === matchedGvids.size, byName: true });
        }
    }

    const valueMatches = [];
    if (!nameMatches.length) {
        for (const csvCol of headers) {
            const csvVals = valsOf(csvCol);
            if (!csvVals.length) continue;
            const csvSet = new Set(csvVals);
            for (const [propKey, valMap] of Object.entries(propIndex)) {
                const hits = [...csvSet].filter(v => valMap.has(v));
                if (hits.length >= Math.min(3, csvVals.length * 0.5)) {
                    const matchedGvids = gvidsFor(valMap, hits);
                    valueMatches.push({ csvCol, propKey, hits, csvMatchCount: hits.length,
                        featureMatchCount: matchedGvids.size, matchedGvids,
                        isOneToOne: hits.length === matchedGvids.size, byName: false });
                }
            }
        }
        valueMatches.sort((a, b) => b.hits.length - a.hits.length);
    }

    const matches = nameMatches.length ? nameMatches : valueMatches;
    for (const m of matches) {
        const uniq = new Set(valsOf(m.csvCol)).size;
        m.score = uniq > 0 ? Math.round(m.csvMatchCount / uniq * 100) : 0;
    }
    matches.sort((a, b) => {
        const aPref = PREFERRED_JOIN_FIELDS.indexOf(a.csvCol.toLowerCase());
        const bPref = PREFERRED_JOIN_FIELDS.indexOf(b.csvCol.toLowerCase());
        if (aPref >= 0 || bPref >= 0) {
            if (aPref < 0) return 1; if (bPref < 0) return -1; return aPref - bPref;
        }
        return b.score - a.score;
    });

    // Alternatives shown in the dialog even when a name match won.
    let valueMatchesForDisplay = nameMatches.length ? [] : [...valueMatches];
    if (nameMatches.length) {
        for (const csvCol of headers) {
            const csvVals = valsOf(csvCol);
            if (!csvVals.length) continue;
            const csvSet = new Set(csvVals);
            for (const [propKey, valMap] of Object.entries(propIndex)) {
                if (nameMatches.some(m => m.csvCol === csvCol && m.propKey === propKey)) continue;
                const hits = [...csvSet].filter(v => valMap.has(v));
                if (hits.length >= Math.min(3, csvVals.length * 0.3)) {
                    const matchedGvids = gvidsFor(valMap, hits);
                    valueMatchesForDisplay.push({ csvCol, propKey, hits, csvMatchCount: hits.length,
                        featureMatchCount: matchedGvids.size, byName: false,
                        score: Math.round(hits.length / csvSet.size * 100) });
                }
            }
        }
        valueMatchesForDisplay.sort((a, b) => b.score - a.score);
    }
    return { matches, byName: nameMatches.length > 0, valueMatchesForDisplay };
}

// ═════════════════════════════════════════════════════════════════════════
// Multi-row detection (several rows per key, e.g. one per grade per school)
// ═════════════════════════════════════════════════════════════════════════

// Selecter parity (_rowsPerKey / _isMultiRow / _catCol block in _runJoinFlow).
function detectMultiRow(rows, headers, keyCol, normalize) {
    const norm = normalize || normVal;
    const keyOf = r => norm(String(r[keyCol] ?? ''));
    const counts = {};
    rows.forEach(r => { const k = keyOf(r); if (k) counts[k] = (counts[k] || 0) + 1; });
    const cv = Object.values(counts);
    const rowsPerKey = cv.length ? cv.reduce((a, b) => a + b, 0) / cv.length : 1;
    const isMultiRow = rowsPerKey > 1.5;

    let catCol = null, catVals = [];
    if (isMultiRow) {
        const distinctKeys = new Set(rows.map(keyOf)).size;
        let bestScore = -1;
        for (const h of headers) {
            if (h === keyCol) continue;
            const vals = rows.map(r => String(r[h] ?? '')).filter(v => v && v !== '');
            const uniq = new Set(vals);
            const fillRate = vals.length / rows.length;
            if (uniq.size < 2 || uniq.size > 60 || fillRate < 0.8) continue;
            const coverage = [...uniq].map(v => new Set(rows.filter(r => String(r[h] ?? '') === v).map(keyOf)).size);
            const avgCoverage = coverage.reduce((a, b) => a + b, 0) / coverage.length;
            const coverageScore = Math.min(avgCoverage / (distinctKeys / uniq.size), 1);
            const score = fillRate * coverageScore * (1 - Math.log(uniq.size) / Math.log(60));
            if (score > bestScore) { bestScore = score; catCol = h; catVals = [...uniq].sort(); }
        }
    }
    return { rowsPerKey, isMultiRow, catCol, catVals };
}

// ═════════════════════════════════════════════════════════════════════════
// Row filters — any number of conditions
// ═════════════════════════════════════════════════════════════════════════

// condition: { col, op, value }
//   op: '=' '!=' 'in' 'notIn' 'contains' 'notContains'
//       '>' '>=' '<' '<=' 'between' ([lo, hi])  'empty' 'notEmpty'
// Multi-valued cells (arrays) pass '=' / 'in' / 'contains' if ANY value passes,
// and '!=' / 'notIn' / 'notContains' only if NO value fails.
// Selecter's single rowFilter {col, val} is { col, op: '=', value: val }.
function matchCondition(row, cond) {
    const raw = row[cond.col];
    const op = cond.op || '=';
    const vals = Array.isArray(raw) ? cellValues(raw).map(cellText) : [cellText(raw)];
    const str = v => String(v ?? '');
    const lower = v => str(v).toLowerCase();
    const want = cond.value;
    const wantList = Array.isArray(want) ? want.map(str) : [str(want)];
    const isEmpty = vals.every(v => v === '');
    switch (op) {
        case '=':        return vals.some(v => v === str(want));
        case '!=':       return !vals.some(v => v === str(want));
        case 'in':       return vals.some(v => wantList.includes(v));
        case 'notIn':    return !vals.some(v => wantList.includes(v));
        case 'contains': return vals.some(v => lower(v).includes(lower(want)));
        case 'notContains': return !vals.some(v => lower(v).includes(lower(want)));
        case 'empty':    return isEmpty;
        case 'notEmpty': return !isEmpty;
        case '>': case '>=': case '<': case '<=': case 'between': {
            const n = parseNum(Array.isArray(raw) ? null : raw);
            if (n === null) return false;
            if (op === '>') return n > Number(want);
            if (op === '>=') return n >= Number(want);
            if (op === '<') return n < Number(want);
            if (op === '<=') return n <= Number(want);
            return n >= Number(want[0]) && n <= Number(want[1]);
        }
        default: throw new Error(`JoinKit: unknown filter op "${op}"`);
    }
}

// mode 'and' (default) or 'or'. Empty conditions keep every row.
function filterRows(rows, conditions, opts) {
    const conds = (conditions || []).filter(Boolean);
    if (!conds.length) return rows;
    const any = (opts && opts.mode) === 'or';
    return rows.filter(r => any ? conds.some(c => matchCondition(r, c)) : conds.every(c => matchCondition(r, c)));
}

// ═════════════════════════════════════════════════════════════════════════
// Spatial join — assign points to the polygon that contains them
// ═════════════════════════════════════════════════════════════════════════

function ringContains(ring, x, y) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
}

function polygonContains(rings, x, y) {
    if (!rings.length || !ringContains(rings[0], x, y)) return false;
    for (let i = 1; i < rings.length; i++) if (ringContains(rings[i], x, y)) return false; // hole
    return true;
}

// true if [lng, lat] lies inside a Polygon or MultiPolygon geometry.
function pointInPolygon(lngLat, geometry) {
    if (!geometry) return false;
    const [x, y] = lngLat;
    if (geometry.type === 'Polygon') return polygonContains(geometry.coordinates, x, y);
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(p => polygonContains(p, x, y));
    return false;
}

function geomBbox(geometry) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const walk = c => {
        if (typeof c[0] === 'number') {
            if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
            if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
        } else c.forEach(walk);
    };
    walk(geometry.coordinates);
    return [minX, minY, maxX, maxY];
}

// For each [lng, lat], the id of the first polygon feature containing it (or null).
// Bounding boxes are checked first, so this is fine for thousands of points
// against city-scale polygon sets.
function assignPointsToPolygons(points, features, opts) {
    const idOf = (opts && opts.idOf) || defaultIdOf;
    const polys = features
        .filter(f => f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'))
        .map(f => ({ id: idOf(f), geometry: f.geometry, bbox: geomBbox(f.geometry) }));
    return points.map(p => {
        if (!p || p[0] == null || p[1] == null || isNaN(p[0]) || isNaN(p[1])) return null;
        const [x, y] = p;
        for (const poly of polys) {
            const b = poly.bbox;
            if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
            if (pointInPolygon(p, poly.geometry)) return poly.id;
        }
        return null;
    });
}

return {
    VERSION,
    // values
    normVal, parseNum, isCurrencyVal, cellText, cellValues, makeKeyNormalizer, rowKeys,
    // columns
    CURRENCY_NAME_HINTS, FORCE_CAT_NAMES, FORCE_CAT_PARTIAL, isForcedCategorical, classifyColumns,
    // aggregation
    computeAgg, countValues, columnTotal,
    // joining
    buildFeatureIndex, buildPropIndex, buildJoin, detectDisplayName,
    PREFERRED_JOIN_FIELDS, scoreKeyCandidates, detectMultiRow,
    // filtering
    matchCondition, filterRows,
    // spatial
    pointInPolygon, assignPointsToPolygons,
};
});
