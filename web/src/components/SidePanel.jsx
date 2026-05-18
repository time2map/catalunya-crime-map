import { CRIME_KEYS, CRIME_LABELS, SPAIN_EXCLUDED } from "../utils/data.js";
import InfoTooltip from "./InfoTooltip.jsx";

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
  if (!stats) return null;
  const yearStr = String(year);
  const yearData = stats.years?.[yearStr] || {};
  const idxCat = yearData.safety_index_cat;
  const idxSpain = stats.safety_index_spain;
  const rankCat = yearData.safety_rank_cat;

  return (
    <div className="side-panel">
      <button className="close-btn" onClick={onClose} aria-label="Close">×</button>

      <h2>{stats.abp_d}</h2>
      <p className="abp-meta">
        Population: <strong>{Number(stats.abp_pob).toLocaleString()}</strong>
      </p>

      <div className="index-cards">
        <div className="index-card">
          <div className="index-label">
            Safety vs Catalonia ({year}) <InfoTooltip />
          </div>
          <div className={`index-value ${idxCat > 1.2 ? "bad" : idxCat < 0.8 ? "good" : ""}`}>
            {fmt(idxCat, 3)}
          </div>
          {rankCat && (
            <div className="index-rank">Rank #{rankCat} of 59</div>
          )}
        </div>
        <div className="index-card">
          <div className="index-label">
            Safety vs Spain (2025) <InfoTooltip />
          </div>
          <div className={`index-value ${idxSpain > 1.2 ? "bad" : idxSpain < 0.8 ? "good" : ""}`}>
            {fmt(idxSpain, 3)}
          </div>
          <div className="index-rank index-note">9 of 12 types · 2025 only</div>
        </div>
      </div>

      <h3>Crime rates per 1,000 residents — {year}</h3>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Rate</th>
            <th>Cat avg</th>
            <th>Spain avg</th>
            <th>vs Cat</th>
            <th>vs Spain</th>
          </tr>
        </thead>
        <tbody>
          {CRIME_KEYS.map((key) => {
            const d = yearData[key] || {};
            return (
              <tr key={key}>
                <td>{CRIME_LABELS[key]}</td>
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
      <p className="table-note">
        Rate = crimes per 1,000 residents · ratio &gt; 1.0 = above average
      </p>
    </div>
  );
}
