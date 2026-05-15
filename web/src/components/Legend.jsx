import { buildClasses, NO_DATA, valueToColor } from "../utils/colors.js";
import { CRIME_LABELS } from "../utils/data.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtBreak(v, isIndex) {
  if (v == null) return "—";
  if (isIndex) return v.toFixed(2);
  if (v === 0) return "0";
  if (v < 0.01) return v.toFixed(5);
  if (v < 0.1) return v.toFixed(3);
  if (v < 10) return v.toFixed(2);
  return v.toFixed(1);
}

function fmtRef(v, isIndex) {
  if (v == null) return null;
  if (isIndex) return v.toFixed(2);
  if (v < 0.01) return v.toFixed(5);
  if (v < 0.1) return v.toFixed(3);
  if (v < 10) return v.toFixed(2);
  return v.toFixed(1);
}

// ── sub-components ───────────────────────────────────────────────────────────

function ColorScale({ breaks, isIndex }) {
  const classes = buildClasses(breaks);
  return (
    <div className="legend-scale">
      {classes.map(({ lo, hi, color }, i) => (
        <div key={i} className="legend-row">
          <span className="legend-swatch" style={{ background: color }} />
          <span className="legend-range">
            {fmtBreak(lo, isIndex)} – {fmtBreak(hi, isIndex)}
          </span>
        </div>
      ))}
      <div className="legend-row">
        <span className="legend-swatch" style={{ background: NO_DATA }} />
        <span className="legend-range muted">No data</span>
      </div>
    </div>
  );
}

function RefRow({ label, value, breaks, unit }) {
  if (value == null) return null;
  const color = valueToColor(value, breaks);
  const display = fmtRef(value, unit === "index");
  return (
    <div className="legend-row legend-ref-row">
      <span className="legend-swatch" style={{ background: color, border: "1.5px solid #fff4" }} />
      <span className="legend-ref-label">{label}</span>
      <span className="legend-ref-val">
        {display}{unit !== "index" ? <span className="muted"> {unit}</span> : null}
      </span>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function Legend({ breaks, metric, references }) {
  if (!breaks) return null;

  const isIndex = metric.startsWith("safety_index");
  const isCatIndex = metric === "safety_index_cat";
  const isSpainIndex = metric === "safety_index_spain";
  const label = CRIME_LABELS[metric] || metric;
  const unit = references?.unit ?? "/1k";

  const hasRefs = references && (references.cat_avg != null || references.spain_avg != null);

  return (
    <div className="legend">
      {/* Title */}
      <div className="legend-title">{label}</div>
      {!isIndex && <div className="legend-unit muted">per 1,000 residents</div>}

      {/* Index explanation */}
      {isCatIndex && (
        <div className="legend-desc">
          Weighted average of 12 crime<br />
          rates vs Catalonia mean per year.<br />
          <span className="legend-formula">1.0 = Catalan avg · &lt;1 safer · &gt;1 riskier</span>
        </div>
      )}
      {isSpainIndex && (
        <div className="legend-desc">
          Weighted avg of 8 crime types<br />
          vs Spain (MdI 2025 only).<br />
          Excl: home intrusion, disorder, drugs.<br />
          <span className="legend-formula">1.0 = Spain avg · &lt;1 safer · &gt;1 riskier</span>
        </div>
      )}

      {/* Reference markers */}
      {hasRefs && (
        <div className="legend-refs">
          <RefRow
            label={isCatIndex ? "Catalan average" : "Cat avg 2025"}
            value={references.cat_avg}
            breaks={breaks}
            unit={unit}
          />
          <RefRow
            label={isSpainIndex ? "Spain average" : "Spain avg 2025"}
            value={references.spain_avg}
            breaks={breaks}
            unit={unit}
          />
        </div>
      )}

      <div className="legend-sep" />

      {/* Color scale */}
      <ColorScale breaks={breaks} isIndex={isIndex} />

      {/* Footer */}
      <div className="legend-footer muted">
        {isSpainIndex ? "Spain data: 2025 only" : "Historical range · 2019–2026"}
      </div>
    </div>
  );
}
