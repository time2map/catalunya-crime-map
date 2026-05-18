// Teal → Cream → Coral: low (safe) = teal, high (dangerous) = deep red
const RAMP = [
  "#1b7a8a", // deep teal   — safest
  "#5aaab8", // mid teal
  "#a3d4da", // light teal
  "#f0ebe3", // warm cream  — average
  "#f2b09e", // light salmon
  "#e67b6e", // mid coral
  "#c9463b", // deep red    — most dangerous
];
const NO_DATA = "#94a3b8"; // slate-400, visible on dark basemap

/**
 * Build class definitions [{lo, hi, color}] from a breaks array.
 * Skips zero-width classes as a safeguard; maps RAMP proportionally
 * so all available colors are used regardless of how many classes survive.
 */
export function buildClasses(breaks) {
  if (!breaks || breaks.length < 2) return [];

  const valid = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    if (breaks[i] < breaks[i + 1]) {
      valid.push({ lo: breaks[i], hi: breaks[i + 1] });
    }
  }

  if (valid.length === 0) {
    return [{ lo: breaks[0], hi: breaks[breaks.length - 1], color: RAMP[3] }];
  }

  return valid.map((cls, i) => ({
    ...cls,
    color: RAMP[Math.round((i * (RAMP.length - 1)) / Math.max(valid.length - 1, 1))],
  }));
}

export function valueToColor(value, breaks) {
  if (value == null || breaks == null) return NO_DATA;
  const classes = buildClasses(breaks);
  if (!classes.length) return NO_DATA;

  let result = NO_DATA;
  for (const { lo, color } of classes) {
    if (value >= lo) result = color;
    else break;
  }
  return result;
}

export function buildFillExpression(breaks) {
  if (!breaks) return NO_DATA;
  const classes = buildClasses(breaks);
  if (!classes.length) return NO_DATA;

  const steps = [];
  for (const { lo, color } of classes) {
    steps.push(lo, color);
  }

  return ["step", ["coalesce", ["get", "_value"], -1], NO_DATA, ...steps];
}

export { RAMP, NO_DATA };
