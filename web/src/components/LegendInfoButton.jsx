import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const ARROWS = [
  { sym: "↑", color: "#d95c50", thresh: "> +10 %",    descKey: "worse2" },
  { sym: "↗", color: "#e8a898", thresh: "+3 – +10 %", descKey: "worse1" },
  { sym: "→", color: "#94a3b8", thresh: "±3 %",        descKey: "stable" },
  { sym: "↘", color: "#7ec8d3", thresh: "−3 – −10 %", descKey: "better1" },
  { sym: "↓", color: "#5aaab8", thresh: "< −10 %",     descKey: "better2" },
];

function LegendModal({ isIndex, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal" onClick={(e) => e.stopPropagation()}>
        <button className="info-modal-close" onClick={onClose}>×</button>

        {isIndex && (
          <>
            <div className="info-modal-title">{t("tooltip.title")}</div>
            <div className="info-modal-formula">{t("tooltip.formula")}</div>
            <div className="info-modal-scale">{t("tooltip.scale")}</div>
            <div className="info-modal-head">{t("tooltip.weightsTitle")}</div>
            <div className="info-modal-weights">
              <span><b>{t("tooltip.homicide")}</b> ×5</span>
              <span><b>{t("tooltip.sexual")}</b> ×4</span>
              <span><b>{t("tooltip.robberyViolent")}</b> ×3</span>
              <span><b>{t("tooltip.assault")}</b> ×3</span>
              <span><b>{t("tooltip.burglary")}</b> ×2</span>
              <span><b>{t("tooltip.homeIntrusion")}</b> ×2</span>
              <span><b>{t("tooltip.carTheft")}</b> ×1.5</span>
              <span><b>{t("tooltip.drugs")}</b> ×1.5</span>
              <span><b>{t("tooltip.carBreakin")}</b> ×1</span>
              <span><b>{t("tooltip.theft")}</b> ×1</span>
              <span><b>{t("tooltip.vandalism")}</b> ×1</span>
              <span><b>{t("tooltip.disorder")}</b> ×1</span>
            </div>
            <hr className="info-modal-divider" />
          </>
        )}

        <div className={isIndex ? "info-modal-head" : "info-modal-title"}>{t("trendTooltip.title")}</div>
        <div className="info-modal-formula">{t("trendTooltip.method")}</div>
        <div className="info-modal-scale">{t("trendTooltip.windows")}</div>
        <div className="info-modal-head">{t("trendTooltip.scaleTitle")}</div>
        <div className="trend-arrow-table">
          {ARROWS.map(({ sym, color, thresh, descKey }) => (
            <div key={sym} className="trend-arrow-row">
              <span className="trend-arrow-sym" style={{ color }}>{sym}</span>
              <span className="trend-arrow-thresh">{thresh}</span>
              <span className="trend-arrow-desc">{t(`trendTooltip.${descKey}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function LegendInfoButton({ isIndex }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="info-btn"
        onClick={() => setOpen(true)}
        aria-label={t("tooltip.indexMethodology")}
      >i</button>
      {open && <LegendModal isIndex={isIndex} onClose={() => setOpen(false)} />}
    </>
  );
}
