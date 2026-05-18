import { useTranslation } from "react-i18next";
import { YEARS } from "../utils/data.js";

export default function YearSlider({ year, onChange, disabled }) {
  const { t } = useTranslation();
  const min = YEARS[0];
  const max = YEARS[YEARS.length - 1];

  return (
    <div className={`year-slider ${disabled ? "disabled" : ""}`}>
      <label>
        {t("slider.year")}: <strong>{disabled ? "2025" : year}</strong>
        {disabled && <span className="year-note"> ({t("slider.spainNote")})</span>}
      </label>
      <div className="slider-row">
        <span>{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={disabled ? 2025 : year}
          onChange={(e) => !disabled && onChange(Number(e.target.value))}
          disabled={disabled}
        />
        <span>{max}</span>
      </div>
      {year === 2026 && !disabled && (
        <p className="year-note">{t("slider.partialYear")}</p>
      )}
    </div>
  );
}
