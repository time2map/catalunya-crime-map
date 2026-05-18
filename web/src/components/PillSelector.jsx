import { CRIME_KEYS, CRIME_LABELS } from "../utils/data.js";

const METRICS = [
  { key: "safety_index_cat", label: "Safety Index (vs Catalunya)", group: "index" },
  { key: "safety_index_spain", label: "Safety Index (vs Spain)", group: "index" },
  ...CRIME_KEYS.map((k) => ({ key: k, label: CRIME_LABELS[k], group: "crime" })),
];

export default function PillSelector({ selectedMetric, onChange }) {
  return (
    <div className="pill-selector">
      {METRICS.map(({ key, label, group }, i) => (
        <>
          {i > 0 && METRICS[i - 1].group !== group && (
            <span key={`sep-${key}`} className="pill-sep" />
          )}
          <button
            key={key}
            className={`pill ${selectedMetric === key ? "active" : ""} group-${group}`}
            onClick={() => onChange(key)}
            title={
              key === "safety_index_spain"
                ? "2025 only · 9 of 12 crime types"
                : undefined
            }
          >
            {label}
          </button>
        </>
      ))}
    </div>
  );
}
