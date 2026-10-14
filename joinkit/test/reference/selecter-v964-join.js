// VERBATIM excerpts of selecter/index.html v964 (pre-JoinKit), wrapped for testing.
// Do not edit: this is the behavior JoinKit must reproduce.
'use strict';
let allFeatures = [], _joinStore = null, _jrpCols = [];
function normVal(v) {
    if (!v) return '';
    const stripped = String(v).trim().replace(/,/g, '');
    return isNaN(stripped) || stripped === '' ? String(v).trim() : stripped;
}

function _computeJoinAgg(rows, numericCols, catCols) {
    const agg = { count: rows.length };

    // Parse numeric value from a cell, handling currency strings like "$45,000"
    function _parseNum(v) {
        if (v === null || v === undefined || v === '') return null;
        const s = String(v).trim();
        if (!isNaN(Number(s)) && isFinite(Number(s))) return Number(s);
        const stripped = s.replace(/^\$/, '').replace(/,/g, '').trim();
        const n = Number(stripped);
        return (!isNaN(n) && isFinite(n)) ? n : null;
    }

    numericCols.forEach(col => {
        const vals = rows.map(r => _parseNum(r[col])).filter(v => v !== null);
        if (!vals.length) {
            ['sum','avg','min','max','median','stddev'].forEach(a => agg[`${a}_${col}`] = null);
            agg[`count_${col}`] = 0; return;
        }
        vals.sort((a, b) => a - b);
        const n = vals.length, sum = vals.reduce((a, b) => a + b, 0), mean = sum / n;
        const median = n % 2 === 0 ? (vals[n/2-1] + vals[n/2]) / 2 : vals[Math.floor(n/2)];
        const stddev = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / n);
        agg[`count_${col}`] = n;
        agg[`sum_${col}`]    = parseFloat(sum.toFixed(4));
        agg[`avg_${col}`]    = parseFloat(mean.toFixed(4));
        agg[`min_${col}`]    = vals[0];
        agg[`max_${col}`]    = vals[n - 1];
        agg[`median_${col}`] = parseFloat(median.toFixed(4));
        agg[`stddev_${col}`] = parseFloat(stddev.toFixed(4));
    });
    catCols.forEach(col => {
        const counts = {};
        rows.forEach(r => { const v = String(r[col] ?? '').trim(); if (v) counts[v] = (counts[v] || 0) + 1; });
        agg[`mode_${col}`] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    });
    return agg;
}

function _buildJoinStore(rows, headers, csvCol, propKey, filename, statsCol, sourceFeatures) {
    // Currency column hints — names suggesting dollar amounts
    const _CURRENCY_NAME_HINTS = ['amount','cost','price','budget','fee','payment','revenue',
        'salary','wage','income','spend','spending','expense','grant','award','funded','funding','total'];

    // Parse a value as a number, stripping currency symbols and thousands commas
    function parseCurrencyVal(v) {
        if (v === null || v === undefined || v === '') return null;
        const s = String(v).trim();
        // Try plain number first
        if (!isNaN(Number(s)) && isFinite(Number(s))) return Number(s);
        // Strip leading $, trailing currency codes, thousands separators
        const stripped = s.replace(/^\$/, '').replace(/,/g, '').trim();
        const n = Number(stripped);
        return (!isNaN(n) && isFinite(n)) ? n : null;
    }

    function isCurrencyVal(v) {
        if (v === null || v === undefined || v === '') return false;
        return String(v).trim().startsWith('$');
    }

    // Classify columns as numeric, currency, or categorical (skip the join key)
    // Column names that look numeric but are always identifiers — force to categorical
    const _FORCE_CAT_NAMES = [
        'zip','zipcode','zip_code','postal','postalcode',  // zip codes
        'geoid','geo_id','fips','fips_code',               // census FIPS
        'tractce','tract','blkgrpce','blockce','blockgrp', // census tract/block
        'countyfp','statefp','stateabbr','state_fips',     // state/county FIPS
        'objectid','object_id','globalid','global_id',     // GIS IDs
        'phone','tel','telephone','mobile','fax',           // phone numbers
        'ssn','ein','tax_id',                              // tax/gov IDs
        'year','yr',                                       // years (not amounts)
        'district','dist','ward','precinct','zone','sector','region','area','quad', // political/admin IDs
        'supdist','sup_dist','supervisorial',              // SF supervisor districts
    ];
    // Column name hints for identifier-like columns — require word-boundary match
    // (e.g. "district" matches "sup_district" but NOT "awarded", "ward" matches "ward_num" but NOT "awarded")
    const _FORCE_CAT_PARTIAL = ['district','ward','precinct','zone','sector'];
    // Also detect by value pattern
    function _isForcecat(col, vals) {
        const low = col.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        if (_FORCE_CAT_NAMES.some(n => low === n || low === n + '_' || low.endsWith('_' + n) || low.startsWith(n + '_'))) return true;
        // Partial match only at word boundaries (separated by _ or at start/end)
        // "awarded" → tokens: ["awarded"] — does NOT match "ward"
        const tokens = low.split('_').filter(Boolean);
        if (_FORCE_CAT_PARTIAL.some(n => tokens.includes(n))) return true;
        // Zero-padded numeric strings (5-digit zips, FIPS codes) → categorical
        const zeropadded = vals.filter(v => /^0\d{3,}$/.test(String(v).trim())).length;
        if (zeropadded / vals.length > 0.3) return true;
        // Small-integer identifiers: all values are integers 1-99, ≤20 distinct values
        // e.g. district numbers 1-11, ward numbers 1-50
        const numericVals = vals.map(v => Number(v)).filter(n => !isNaN(n) && isFinite(n));
        if (numericVals.length / vals.length > 0.9) {
            const allSmallInt = numericVals.every(n => Number.isInteger(n) && n >= 1 && n <= 99);
            const distinctCount = new Set(numericVals).size;
            if (allSmallInt && distinctCount <= 20) return true;
        }
        return false;
    }

    const otherCols = headers.filter(h => h !== csvCol);
    let numericCols = [], currencyCols = new Set(), catCols = [];
    otherCols.forEach(col => {
        const vals = rows.map(r => r[col]).filter(v => v !== null && v !== undefined && v !== '');
        if (!vals.length) { catCols.push(col); return; }

        // Force-categorical check before any numeric test
        if (_isForcecat(col, vals)) {
            catCols.push(col);
            console.log(`[join] cat col (forced): "${col}" — zip/census/id/phone column`);
            return;
        }
        const currencyCount = vals.filter(v => isCurrencyVal(v)).length;
        const isCurrencyCol = currencyCount > 0 && currencyCount / vals.length >= 0.5;

        // Count parseable numeric values (including stripped currency)
        const parseableCount = vals.filter(v => parseCurrencyVal(v) !== null).length;
        if (!parseableCount) { catCols.push(col); return; }
        const parseableRatio = parseableCount / vals.length;
        const colLower = col.toLowerCase();
        const nameHint = _CURRENCY_NAME_HINTS.some(h => colLower.includes(h));

        // For currency columns: min 1 value, 25% ratio threshold (free-text mixed in is common)
        // For plain numeric columns: min 3 values, 50% ratio threshold
        const minRequired  = (isCurrencyCol || (nameHint && currencyCount > 0)) ? 1   : 3;
        const minRatio     = (isCurrencyCol || (nameHint && currencyCount > 0)) ? 0.1 : 0.5;

        if (parseableCount >= minRequired && parseableRatio >= minRatio) {
            numericCols.push(col);
            if (isCurrencyCol || (nameHint && currencyCount > 0)) currencyCols.add(col);
            console.log(`[join] numeric col: "${col}" currency=${isCurrencyCol} parseable=${parseableCount}/${vals.length}`);
        } else {
            catCols.push(col);
            console.log(`[join] cat col: "${col}" parseable=${parseableCount}/${vals.length} minReq=${minRequired} ratio=${parseableRatio.toFixed(2)} sample="${vals[0]}"`);
        }
    });
    // If user selected a specific column for stats, filter to just that one
    if (statsCol && statsCol !== '__all__') {
        catCols = [...catCols, ...numericCols.filter(c => c !== statsCol)];
        numericCols = numericCols.filter(c => c === statsCol);
    }

    // Build byGvid: match CSV rows to features via propKey
    const byGvid = {};
    const propValToGvid = {};
    allFeatures.forEach(f => {
        const v = normVal(String(f.properties[propKey] ?? ''));
        if (!v) return;
        if (!propValToGvid[v]) propValToGvid[v] = [];
        propValToGvid[v].push(f.properties._gvid);
    });

    rows.forEach(row => {
        const v = normVal(row[csvCol] ?? '');
        if (!v) return;
        const gvids = propValToGvid[v] || [];
        gvids.forEach(gvid => {
            if (!byGvid[gvid]) byGvid[gvid] = { rows: [] };
            byGvid[gvid].rows.push(row);
        });
    });

    // Compute per-feature aggregations
    Object.values(byGvid).forEach(entry => {
        entry.agg = _computeJoinAgg(entry.rows, numericCols, catCols);
    });

    // Compute global stats for the full dataset
    const globalAgg = _computeJoinAgg(rows, numericCols, catCols);

    // Numeric stats per column (for palette range)
    const aggColumns = {};
    numericCols.forEach(col => {
        const perFeatureVals = Object.values(byGvid)
            .map(e => e.agg[`avg_${col}`]).filter(v => v !== null);
        if (perFeatureVals.length) {
            perFeatureVals.sort((a, b) => a - b);
            const n = perFeatureVals.length, sum = perFeatureVals.reduce((a, b) => a + b, 0), mean = sum / n;
            aggColumns[col] = {
                min: perFeatureVals[0], max: perFeatureVals[n-1], mean: parseFloat(mean.toFixed(3)),
                count: n, nullCount: Object.keys(byGvid).length - n
            };
        }
    });

    // Categorical column distinct counts
    const catColumns = {};
    catCols.forEach(col => {
        const counts = {};
        rows.forEach(r => { const v = String(r[col] ?? '').trim(); if (v) counts[v] = (counts[v] || 0) + 1; });
        if (Object.keys(counts).length <= 40) catColumns[col] = counts;
    });

    _joinStore = { file: filename, csvCol, propKey, headers, rows, numericCols, catCols,
        currencyCols,
        byGvid, globalAgg, aggColumns, catColumns,
        sourceType: sourceFeatures ? 'geojson' : 'csv',
        sourceFeatures: sourceFeatures || null,
        // CSV totals: all rows in the filtered set (used as % denominator)
        csvTotals: Object.fromEntries(numericCols.map(col => {
            const sum = rows.reduce((acc, r) => {
                const v = String(r[col]??'').trim().replace(/^\$/,'').replace(/,/g,'');
                const n = parseFloat(v);
                return isNaN(n) ? acc : acc + n;
            }, 0);
            return [col, sum];
        })),
        // Joined totals: only rows that matched a map feature — what we actually show
        joinedTotals: Object.fromEntries(numericCols.map(col => {
            let sum = 0;
            Object.values(byGvid).forEach(entry => {
                const v = entry.agg[`sum_${col}`];
                if (v != null) sum += v;
            });
            return [col, parseFloat(sum.toFixed(4))];
        }))
    };

    // Back-fill pct_X using csvTotals as denominator
    const csvTotals = _joinStore.csvTotals;
    numericCols.forEach(col => {
        const total = csvTotals[col];
        if (!total || total <= 0) return;
        Object.values(byGvid).forEach(entry => {
            const sum = entry.agg[`sum_${col}`];
            entry.agg[`pct_${col}`] = (sum !== null && sum !== undefined)
                ? parseFloat((sum / total * 100).toFixed(2))
                : null;
        });
    });

    // ── 1:1 lookup detection ────────────────────────────────────────────────
    const joinedWithMultiple = Object.values(byGvid).filter(e => e.rows.length > 1).length;
    const isLookup = joinedWithMultiple === 0 && Object.keys(byGvid).length > 0;
    _joinStore.isLookup = isLookup;
    _joinStore.joinedWithMultiple = joinedWithMultiple;

    // ── Display name auto-detection ─────────────────────────────────────────
    const _NAME_HINTS = ['name','title','label','school','site','building','address','street','facility','location','description','place'];
    // Derive target GeoJSON props from allFeatures
    const _geoProps = [...new Set(allFeatures.flatMap(f =>
        Object.keys(f.properties || {}).filter(k => !k.startsWith('_') && !k.startsWith(':'))
    ))];
    // Score a column by how well its unique-value count matches the join key count
    // (i.e. a good name col has ~1 distinct value per joined feature, not 1 value total)
    const _joinedKeyCount = Object.keys(byGvid).length || 1;
    const _scoreNameCol = (vals) => {
        const uniq = new Set(vals.filter(v => v && v !== '')).size;
        // Ideal: uniq close to _joinedKeyCount, name-like column
        return uniq >= Math.min(_joinedKeyCount * 0.5, 3) ? uniq : 0;
    };
    const geoNameProp = _geoProps
        .filter(k => _NAME_HINTS.some(h => k.toLowerCase().replace(/[^a-z]/g,'').includes(h)))
        .map(k => ({ k, score: _scoreNameCol(allFeatures.map(f => String(f.properties[k] ?? ''))) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.k || null;
    const csvNameCol = geoNameProp ? null : (headers
        .filter(h => _NAME_HINTS.some(hn => h.toLowerCase().replace(/[^a-z]/g,'').includes(hn)) && h !== csvCol)
        .map(h => ({ h, score: _scoreNameCol(rows.map(r => String(r[h] ?? ''))) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.h || null);
    _joinStore.displayNameProp = geoNameProp;
    _joinStore.displayNameCol  = csvNameCol;

    // Reset right panel columns so new join shows fresh defaults
    _jrpCols = [];

    console.log(`[join] store built: ${Object.keys(byGvid).length} features matched, isLookup=${isLookup}, joinedWithMultiple=${joinedWithMultiple}`);
    console.log(`[join] numeric cols (${numericCols.length}):`, numericCols);
    if (currencyCols.size) console.log(`[join] currency cols:`, [...currencyCols]);
    console.log(`[join] categorical cols (${catCols.length}):`, catCols);
    console.log(`[join] display name: geoJSON="${geoNameProp}" csv="${csvNameCol}"`);

    // Log joined vs CSV totals so users can spot unmatched-row inflation
    numericCols.forEach(col => {
        const csv    = _joinStore.csvTotals[col];
        const joined = _joinStore.joinedTotals[col];
        const unmatched = csv - joined;
        console.log(`[join] ${col}: joined=${joined.toLocaleString()} csv=${csv.toLocaleString()}${unmatched > 0.001 ? ` (${unmatched.toLocaleString()} in unmatched rows — district/aggregate rows?)` : ''}`);
    });

    // Log and store unmatched CSV rows
    const unmatchedVals = new Set();
    rows.forEach(row => {
        const v = normVal(row[csvCol] ?? '');
        if (v && !propValToGvid[v]) unmatchedVals.add(v);
    });
    const totalRows = rows.length;
    const matchedRows = rows.filter(r => propValToGvid[normVal(r[csvCol] ?? '')]).length;
    const nullRows = rows.filter(r => { const v = normVal(r[csvCol] ?? ''); return !v; }).length;
    console.log(`[join] CSV rows: ${totalRows} total, ${matchedRows} matched, ${totalRows - matchedRows - nullRows} unmatched, ${nullRows} null`);
    if (unmatchedVals.size && unmatchedVals.size <= 20)
        console.log(`[join] unmatched CSV values (${unmatchedVals.size}):`, [...unmatchedVals].sort());
    else if (unmatchedVals.size > 20)
        console.log(`[join] unmatched CSV values (${unmatchedVals.size} — showing first 20):`, [...unmatchedVals].sort().slice(0, 20));

    // Store CSV row match stats for the status panel
    _joinStore.totalRows    = totalRows;
    _joinStore.matchedRows  = matchedRows;
    _joinStore.nullRows     = nullRows;
    _joinStore.unmatchedGeomVals = [...unmatchedVals].sort();
    _joinStore.rowFilter    = _joinStore.rowFilter || null; // preserved from _runJoinFlow
}

function _origScore(rows, headers, propIndex, geoJsonProps) {
// PRIORITY 1: column-name match — CSV column name matches GeoJSON property name (case-insensitive)
const namePriorityMatches = [];
for (const csvCol of headers) {
    const csvLow = csvCol.toLowerCase();
    for (const propKey of geoJsonProps) {
        if (propKey.toLowerCase() === csvLow) {
            const csvVals = rows.map(r => normVal(r[csvCol])).filter(v => v);
            const csvSet = new Set(csvVals);
            const hits = [...csvSet].filter(v => propIndex[propKey]?.has(v));
            if (hits.length > 0) {
                const matchedGvids = new Set();
                for (const v of hits) propIndex[propKey].get(v)?.forEach(id => matchedGvids.add(id));
                namePriorityMatches.push({ csvCol, propKey, hits, csvMatchCount: hits.length,
                    featureMatchCount: matchedGvids.size, matchedGvids,
                    isOneToOne: hits.length === matchedGvids.size, byName: true });
            }
        }
    }
}

// PRIORITY 2: value-intersection match — only if no name match found
const valueMatches = [];
if (namePriorityMatches.length === 0) {
    for (const csvCol of headers) {
        const csvVals = rows.map(r => normVal(r[csvCol])).filter(v => v);
        if (!csvVals.length) continue;
        const csvSet = new Set(csvVals);
        for (const [propKey, valMap] of Object.entries(propIndex)) {
            const hits = [...csvSet].filter(v => valMap.has(v));
            if (hits.length >= Math.min(3, csvVals.length * 0.5)) {
                const matchedGvids = new Set();
                for (const v of hits) valMap.get(v)?.forEach(id => matchedGvids.add(id));
                valueMatches.push({ csvCol, propKey, hits, csvMatchCount: hits.length,
                    featureMatchCount: matchedGvids.size, matchedGvids,
                    isOneToOne: hits.length === matchedGvids.size, byName: false });
            }
        }
    }
    valueMatches.sort((a, b) => b.hits.length - a.hits.length);
}

const allMatches = namePriorityMatches.length > 0 ? namePriorityMatches : valueMatches;

// Preferred join field names — sorted first within name matches
const _PREFERRED_JOIN_FIELDS = ['cnn','objectid','geoid','fips','zip','zipcode',
    'tractce','tract','block','supdist','nhood','neighborhood'];

// Add match score (% of CSV unique values found in GeoJSON)
for (const m of allMatches) {
    const csvUnique = new Set(rows.map(r => normVal(r[m.csvCol])).filter(v => v)).size;
    m.score = csvUnique > 0 ? Math.round(m.csvMatchCount / csvUnique * 100) : 0;
}
allMatches.sort((a, b) => {
    const aLow = a.csvCol.toLowerCase(), bLow = b.csvCol.toLowerCase();
    const aPref = _PREFERRED_JOIN_FIELDS.indexOf(aLow), bPref = _PREFERRED_JOIN_FIELDS.indexOf(bLow);
    if (aPref >= 0 || bPref >= 0) {
        if (aPref < 0) return 1; if (bPref < 0) return -1; return aPref - bPref;
    }
    return b.score - a.score;
});

// Compute value-intersection matches for display even when name matches exist
let valueMatchesForDisplay = namePriorityMatches.length > 0 ? [] : [...valueMatches];
if (namePriorityMatches.length > 0) {
    for (const csvCol of headers) {
        const csvVals = rows.map(r => normVal(r[csvCol])).filter(v => v);
        if (!csvVals.length) continue;
        const csvSet = new Set(csvVals);
        for (const [propKey, valMap] of Object.entries(propIndex)) {
            if (namePriorityMatches.some(m => m.csvCol === csvCol && m.propKey === propKey)) continue;
            const hits = [...csvSet].filter(v => valMap.has(v));
            if (hits.length >= Math.min(3, csvVals.length * 0.3)) {
                const matchedGvids = new Set();
                for (const v of hits) valMap.get(v)?.forEach(id => matchedGvids.add(id));
                const score = Math.round(hits.length / csvSet.size * 100);
                valueMatchesForDisplay.push({ csvCol, propKey, hits, csvMatchCount: hits.length,
                    featureMatchCount: matchedGvids.size, byName: false, score });
            }
        }
    }
    valueMatchesForDisplay.sort((a, b) => b.score - a.score);
}

return { allMatches, valueMatchesForDisplay, byName: namePriorityMatches.length > 0 };
}
function _origMultiRow(rows, headers, best) {
const _rowsPerKey = (() => {
    const counts = {};
    rows.forEach(r => {
        const k = normVal(String(r[best.csvCol] ?? ''));
        if (k) counts[k] = (counts[k] || 0) + 1;
    });
    const vals = Object.values(counts);
    return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 1;
})();
const _isMultiRow = _rowsPerKey > 1.5;

// Find the best "category column" — a column that classifies rows within each key.
// Good category col: few unique values, high fill rate, and each value appears across many keys
// (not just one key) — which means it's a true cross-cutting category, not a per-row attribute.
let _catCol = null;
let _catVals = [];
if (_isMultiRow) {
    const distinctKeys = new Set(rows.map(r => normVal(String(r[best.csvCol] ?? '')))).size;
    let bestScore = -1;
    for (const h of headers) {
        if (h === best.csvCol) continue;
        const vals = rows.map(r => String(r[h] ?? '')).filter(v => v && v !== '');
        const uniq = new Set(vals);
        const fillRate = vals.length / rows.length;
        if (uniq.size < 2 || uniq.size > 60 || fillRate < 0.8) continue;
        // Check that each distinct value appears across multiple keys (cross-cutting category)
        const valKeyCoverage = [...uniq].map(v => {
            const keySet = new Set(rows.filter(r => String(r[h] ?? '') === v)
                .map(r => normVal(String(r[best.csvCol] ?? ''))));
            return keySet.size;
        });
        const avgKeyCoverage = valKeyCoverage.reduce((a,b) => a+b, 0) / valKeyCoverage.length;
        // Score: high fill, few unique values, and each value covers many keys
        // avgKeyCoverage close to distinctKeys / uniq.size means even distribution
        const idealCoverage = distinctKeys / uniq.size;
        const coverageScore = Math.min(avgKeyCoverage / idealCoverage, 1);
        const score = fillRate * coverageScore * (1 - Math.log(uniq.size) / Math.log(60));
        if (score > bestScore) {
            bestScore = score;
            _catCol = h;
            _catVals = [...uniq].sort();
        }
    }
}

return { rowsPerKey: _rowsPerKey, isMultiRow: _isMultiRow, catCol: _catCol, catVals: _catVals };
}
function _origPropIndex(targetFeatures) {
    const propIndex = {};
    const geoJsonProps = [...new Set(targetFeatures.flatMap(f =>
        Object.keys(f.properties || {}).filter(k => !k.startsWith('_'))
    ))];
    for (const f of targetFeatures) {
        for (const k of geoJsonProps) {
            const v = f.properties[k];
            if (v == null || v === '') continue;
            const nv = normVal(String(v));
            if (!propIndex[k]) propIndex[k] = new Map();
            if (!propIndex[k].has(nv)) propIndex[k].set(nv, new Set());
            propIndex[k].get(nv).add(f.properties._gvid);
        }
    }

return { propIndex, geoJsonProps };
}
module.exports = { normVal, _computeJoinAgg, _origScore, _origMultiRow, _origPropIndex,
  buildStore(features, ...args) { allFeatures = features; _joinStore = null; _buildJoinStore(...args); return _joinStore; } };
