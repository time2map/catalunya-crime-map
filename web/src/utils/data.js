export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

export const CRIME_KEYS = [
  "homicide",
  "lesions",
  "sexual",
  "robbery_violence",
  "burglary",
  "home_intrusion",
  "theft",
  "car_breakin",
  "car_theft",
  "vandalism",
  "drugs",
  "disorder",
];

export const CRIME_LABELS = {
  safety_index_cat: "Safety Index (vs Catalonia)",
  safety_index_spain: "Safety Index (vs Spain)",
  homicide: "Homicide",
  lesions: "Assault",
  sexual: "Sexual crimes",
  robbery_violence: "Robbery (violent)",
  burglary: "Burglary",
  home_intrusion: "Home intrusion",
  theft: "Theft",
  car_breakin: "Car break-in",
  car_theft: "Car theft",
  vandalism: "Vandalism",
  drugs: "Drug offences",
  disorder: "Public disorder",
};

// Keys excluded from Spain comparison
export const SPAIN_EXCLUDED = new Set(["home_intrusion", "disorder", "drugs"]);

/**
 * Get the numeric value for a given feature/metric/year combination.
 * Returns null when data is unavailable.
 */
export function getValueForFeature(statsData, abpCode, metric, year) {
  const abp = statsData?.[abpCode];
  if (!abp) return null;

  if (metric === "safety_index_cat") {
    return abp.years?.[year]?.safety_index_cat ?? null;
  }
  if (metric === "safety_index_spain") {
    return abp.safety_index_spain ?? null;
  }
  return abp.years?.[year]?.[metric]?.rate ?? null;
}

/**
 * Compute n quantile break points from an array of values.
 * Returns array of n+1 values [min, q1, q2, q3, q4, max].
 */
export function computeBreaks(values, n) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const breaks = [];
  for (let i = 0; i <= n; i++) {
    const idx = Math.floor((i / n) * (sorted.length - 1));
    breaks.push(sorted[idx]);
  }
  return breaks;
}

/**
 * Compute global quantile breaks across ALL ABPs and ALL years for a metric.
 * Always returns 8 strictly-ascending values (7 classes).
 * Zero-inflated data (e.g. home_intrusion) is handled by computing quantile
 * breaks on non-zero values and prepending 0 as the first boundary.
 */
export function computeGlobalBreaks(statsData, metric) {
  if (!statsData) return null;
  const values = [];

  for (const abpData of Object.values(statsData)) {
    if (metric === "safety_index_spain") {
      const v = abpData.safety_index_spain;
      if (v != null) values.push(v);
    } else {
      for (const [yearStr, yearData] of Object.entries(abpData.years || {})) {
        if (Number(yearStr) > 2025) continue;
        const v =
          metric === "safety_index_cat"
            ? yearData.safety_index_cat
            : yearData[metric]?.rate;
        if (v != null) values.push(v);
      }
    }
  }

  const N = 7;
  const raw = computeBreaks(values, N);
  if (!raw) return null;

  // Check for duplicate break points (zero-inflated distributions)
  const hasDupes = raw.slice(1).some((v, i) => v === raw[i]);
  if (!hasDupes) return raw;

  // Fall back to non-zero quantiles + 0 as first boundary
  const sorted = [...values].sort((a, b) => a - b);
  const nonZero = sorted.filter((v) => v > 0);
  if (nonZero.length >= N - 1) {
    const nzBreaks = [];
    for (let i = 0; i < N; i++) {
      const idx = Math.floor((i / (N - 1)) * (nonZero.length - 1));
      nzBreaks.push(nonZero[idx]);
    }
    // Ensure strictly ascending after prepending 0
    if (nzBreaks[0] > 0) return [0, ...nzBreaks];
  }

  // Last resort: deduplicate by adding tiny epsilon
  const deduped = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    deduped.push(Math.max(raw[i], deduped[i - 1] + 1e-9));
  }
  return deduped;
}

/**
 * Return reference values shown in the legend:
 *   cat_avg  — Catalonia-wide rate for this metric (2025)
 *   spain_avg — Spain-wide rate (2025, or null if unavailable)
 *   unit     — display unit string
 *
 * For safety indices the "average" is 1.0 by definition.
 */
export function getReferences(statsData, metric) {
  if (!statsData) return null;

  if (metric === "safety_index_cat") {
    return { cat_avg: 1.0, spain_avg: null, unit: "index" };
  }
  if (metric === "safety_index_spain") {
    return { cat_avg: null, spain_avg: 1.0, unit: "index" };
  }

  // Pull from the first ABP's 2025 data (cat_avg is the same for all ABPs)
  const crimeData = Object.values(statsData)[0]?.years?.["2025"]?.[metric];
  if (!crimeData) return null;

  return {
    cat_avg: crimeData.cat_avg,
    spain_avg: crimeData.spain_avg,
    unit: "/1k",
  };
}
