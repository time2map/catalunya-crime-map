import { useTranslation } from "react-i18next";
import { buildClasses, NO_DATA, valueToColor } from "../utils/colors.js";
import { CRIME_LABELS } from "../utils/data.js";
import InfoTooltip from "./InfoTooltip.jsx";

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

function ColorScale({ breaks, isIndex }) {
  const { t } = useTranslation();
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
        <span className="legend-range muted">{t("legend.noData")}</span>
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

export default function Legend({ breaks, metric, references }) {
  const { t } = useTranslation();
  if (!breaks) return null;

  const isIndex = metric.startsWith("safety_index");
  const isCatIndex = metric === "safety_index_cat";
  const isSpainIndex = metric === "safety_index_spain";
  const label = t(`crimes.${metric}`, { defaultValue: CRIME_LABELS[metric] || metric });
  const unit = references?.unit ?? "/1k";

  const hasRefs = references && (references.cat_avg != null || references.spain_avg != null);

  return (
    <div className="legend">
      <div className="legend-title">
        {label}
        {isIndex && <InfoTooltip />}
      </div>
      {!isIndex && <div className="legend-unit muted">{t("legend.perThousand")}</div>}

      {isCatIndex && (
        <div className="legend-desc">
          {t("legend.catIndexDesc").split("\n").map((line, i) => (
            <span key={i}>{line}{i === 0 && <br />}</span>
          ))}
          <span className="legend-formula">{t("legend.catFormula")}</span>
        </div>
      )}
      {isSpainIndex && (
        <div className="legend-desc">
          {t("legend.spainIndexDesc").split("\n").map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          ))}
          <span className="legend-formula">{t("legend.spainFormula")}</span>
        </div>
      )}

      {hasRefs && (
        <div className="legend-refs">
          <RefRow
            label={isCatIndex ? t("legend.catAvg") : t("legend.catAvg2025")}
            value={references.cat_avg}
            breaks={breaks}
            unit={unit}
          />
          <RefRow
            label={isSpainIndex ? t("legend.spainAvg") : t("legend.spainAvg2025")}
            value={references.spain_avg}
            breaks={breaks}
            unit={unit}
          />
        </div>
      )}

      <div className="legend-sep" />
      <ColorScale breaks={breaks} isIndex={isIndex} />

      <div className="legend-footer muted">
        {isSpainIndex ? t("legend.spainDataNote") : t("legend.historicalRange")}
      </div>

      <div className="legend-attribution">
        <a href="https://mossos.gencat.cat" target="_blank" rel="noopener noreferrer">Mossos d'Esquadra</a>
        {" · "}
        <a href="https://www.icgc.cat" target="_blank" rel="noopener noreferrer">ICGC</a>
        {" · "}
        <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>
        {" · "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OSM</a>
      </div>
    </div>
  );
}
