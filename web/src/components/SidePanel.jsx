import { useTranslation } from "react-i18next";
import { CRIME_KEYS, CRIME_LABELS, SPAIN_EXCLUDED } from "../utils/data.js";
import LegendInfoButton from "./LegendInfoButton.jsx";

function fmt(v, digits = 2) {
  if (v == null) return "n/a";
  return Number(v).toFixed(digits);
}

function RatioCell({ ratio }) {
  if (ratio == null) return <td className="td-ratio na">n/a</td>;
  const cls = ratio > 1.2 ? "high" : ratio < 0.8 ? "low" : "mid";
  return <td className={`td-ratio ${cls}`}>{ratio.toFixed(2)}×</td>;
}

export default function SidePanel({ abpCode, stats, metric, year, onClose }) {
  const { t } = useTranslation();
  if (!stats) return null;
  const yearStr = String(year);
  const yearData = stats.years?.[yearStr] || {};
  const idxCat = yearData.safety_index_cat;
  const idxSpain = stats.safety_index_spain;
  const rankCat = yearData.safety_rank_cat;

  return (
    <div className="side-panel">
      <button className="close-btn" onClick={onClose} aria-label={t("panel.close")}>×</button>

      <h2>{stats.abp_d}</h2>
      <p className="abp-meta">
        {t("panel.population")}: <strong>{Number(stats.abp_pob).toLocaleString()}</strong>
      </p>

      <div className="index-cards">
        <div className="index-card">
          <div className="index-label">
            {t("panel.safetyVsCat", { year })} <LegendInfoButton isIndex={true} />
          </div>
          <div className={`index-value ${idxCat > 1.2 ? "bad" : idxCat < 0.8 ? "good" : ""}`}>
            {fmt(idxCat, 3)}
          </div>
          {rankCat && (
            <div className="index-rank">{t("panel.rank", { rank: rankCat })}</div>
          )}
        </div>
        <div className="index-card">
          <div className="index-label">
            {t("panel.safetyVsSpain")} <LegendInfoButton isIndex={true} />
          </div>
          <div className={`index-value ${idxSpain > 1.2 ? "bad" : idxSpain < 0.8 ? "good" : ""}`}>
            {fmt(idxSpain, 3)}
          </div>
          <div className="index-rank index-note">{t("panel.spainNote")}</div>
        </div>
      </div>

      <h3>{t("panel.crimeRates", { year })}</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th>{t("panel.colType")}</th>
            <th>{t("panel.colRate")}</th>
            <th>{t("panel.colCatAvg")}</th>
            <th>{t("panel.colSpainAvg")}</th>
            <th>{t("panel.colVsCat")}</th>
            <th>{t("panel.colVsSpain")}</th>
          </tr>
        </thead>
        <tbody>
          {CRIME_KEYS.map((key) => {
            const d = yearData[key] || {};
            return (
              <tr key={key}>
                <td>{t(`crimes.${key}`, { defaultValue: CRIME_LABELS[key] })}</td>
                <td>{fmt(d.rate, d.rate < 0.1 ? 4 : 2)}</td>
                <td>{fmt(d.cat_avg, d.cat_avg < 0.1 ? 4 : 2)}</td>
                <td className={SPAIN_EXCLUDED.has(key) ? "td-na" : ""}>
                  {SPAIN_EXCLUDED.has(key) ? "n/a" : fmt(d.spain_avg, d.spain_avg < 0.1 ? 5 : 3)}
                </td>
                <RatioCell ratio={d.ratio_cat} />
                <RatioCell ratio={SPAIN_EXCLUDED.has(key) ? null : d.ratio_spain} />
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="table-note">{t("panel.tableNote")}</p>
    </div>
  );
}
