import { useTranslation } from "react-i18next";
import { CRIME_KEYS, CRIME_LABELS } from "../utils/data.js";

const METRIC_KEYS = [
  { key: "safety_index_cat", group: "index" },
  { key: "safety_index_spain", group: "index" },
  ...CRIME_KEYS.map((k) => ({ key: k, group: "crime" })),
];

export default function PillSelector({ selectedMetric, onChange }) {
  const { t } = useTranslation();

  return (
    <div className="pill-selector">
      {METRIC_KEYS.map(({ key, group }, i) => (
        <>
          {i > 0 && METRIC_KEYS[i - 1].group !== group && (
            <span key={`sep-${key}`} className="pill-sep" />
          )}
          <button
            key={key}
            className={`pill ${selectedMetric === key ? "active" : ""} group-${group}`}
            onClick={() => onChange(key)}
            title={
              key === "safety_index_spain"
                ? t("pill.spainTooltip")
                : undefined
            }
          >
            {t(`crimes.${key}`, { defaultValue: CRIME_LABELS[key] })}
          </button>
        </>
      ))}
    </div>
  );
}
