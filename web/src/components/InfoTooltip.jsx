import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

function InfoModal({ onClose }) {
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
      </div>
    </div>,
    document.body
  );
}

export default function InfoTooltip() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="info-btn" onClick={() => setOpen(true)} aria-label={t("tooltip.indexMethodology")}>i</button>
      {open && <InfoModal onClose={() => setOpen(false)} />}
    </>
  );
}
