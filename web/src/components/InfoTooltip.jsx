import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

function InfoModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="info-modal-backdrop" onClick={onClose}>
      <div className="info-modal" onClick={(e) => e.stopPropagation()}>
        <button className="info-modal-close" onClick={onClose}>×</button>
        <div className="info-modal-title">How the Safety Index is calculated</div>
        <div className="info-modal-formula">Index = Σ(w · rate/avg) / Σw</div>
        <div className="info-modal-scale">1.0 = reference avg · &lt;1 safer · &gt;1 riskier</div>
        <div className="info-modal-head">Severity weights (manually set):</div>
        <div className="info-modal-weights">
          <span><b>Homicide</b> ×5</span>
          <span><b>Sexual crimes</b> ×4</span>
          <span><b>Robbery (violent)</b> ×3</span>
          <span><b>Assault</b> ×3</span>
          <span><b>Burglary</b> ×2</span>
          <span><b>Home intrusion</b> ×2</span>
          <span><b>Car theft</b> ×1.5</span>
          <span><b>Drug offences</b> ×1.5</span>
          <span><b>Car break-in</b> ×1</span>
          <span><b>Theft</b> ×1</span>
          <span><b>Vandalism</b> ×1</span>
          <span><b>Public disorder</b> ×1</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function InfoTooltip() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="info-btn" onClick={() => setOpen(true)} aria-label="Index methodology">i</button>
      {open && <InfoModal onClose={() => setOpen(false)} />}
    </>
  );
}
