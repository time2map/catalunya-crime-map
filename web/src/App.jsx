import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18next from "./i18n.js";
import Map from "./components/Map.jsx";
import PillSelector from "./components/PillSelector.jsx";
import YearSlider from "./components/YearSlider.jsx";
import SidePanel from "./components/SidePanel.jsx";
import LogoBar from "./components/LogoBar.jsx";
import Legend from "./components/Legend.jsx";
import { getValueForFeature, computeGlobalBreaks, getReferences } from "./utils/data.js";

function LangSwitcher() {
  const { i18n } = useTranslation();

  function handleChange(e) {
    const lang = e.target.value;
    i18n.changeLanguage(lang);
    localStorage.setItem("lang", lang);
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url.toString());
  }

  return (
    <select className="lang-select" value={i18n.language} onChange={handleChange}>
      <option value="en">EN</option>
      <option value="es">ES</option>
    </select>
  );
}

export default function App() {
  const { t } = useTranslation();
  const [geoData, setGeoData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedMetric, setSelectedMetric] = useState("safety_index_cat");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedAbp, setSelectedAbp] = useState(null);
  const [hoveredAbp, setHoveredAbp] = useState(null);
  const [panelExpanded, setPanelExpanded] = useState(
    typeof window !== "undefined" ? window.innerWidth > 640 : true
  );

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/abp.geojson`).then((r) => r.json()),
      fetch(`${base}data/stats.json`).then((r) => r.json()),
    ])
      .then(([geo, stats]) => {
        setGeoData(geo);
        setStatsData(stats);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const enrichedGeoData = useMemo(() => {
    if (!geoData || !statsData) return null;
    return {
      ...geoData,
      features: geoData.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          _value: getValueForFeature(statsData, f.properties.abp_c, selectedMetric, selectedYear),
          _cat_idx: getValueForFeature(statsData, f.properties.abp_c, "safety_index_cat", selectedYear),
          _spain_idx: getValueForFeature(statsData, f.properties.abp_c, "safety_index_spain", 2025),
          _cat_rank: statsData[f.properties.abp_c]?.years?.[String(selectedYear)]?.safety_rank_cat ?? null,
        },
      })),
    };
  }, [geoData, statsData, selectedMetric, selectedYear]);

  const globalBreaks = useMemo(
    () => computeGlobalBreaks(statsData, selectedMetric),
    [statsData, selectedMetric]
  );

  const references = useMemo(
    () => getReferences(statsData, selectedMetric),
    [statsData, selectedMetric]
  );

  const yearDisabled = selectedMetric === "safety_index_spain";

  if (loading) {
    return <div className="loading">{t("app.loading")}</div>;
  }

  if (error) {
    return (
      <div className="loading error">
        <strong>{t("app.errorTitle") || "Failed to load data"}</strong><br />
        <code>{error}</code>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="main">
        <div className="map-area">
          <Map
            geoData={enrichedGeoData}
            globalBreaks={globalBreaks}
            selectedAbp={selectedAbp}
            hoveredAbp={hoveredAbp}
            onHover={setHoveredAbp}
            onClick={setSelectedAbp}
            selectedMetric={selectedMetric}
          />

          {/* Top-left panel: title + pills + legend */}
          <div className="top-panel">
            <div className="app-brand">
              <LogoBar />
              <h1 className="app-title">{t("app.title")}</h1>
              <LangSwitcher />
              <button
                className="panel-toggle"
                onClick={() => setPanelExpanded((v) => !v)}
                aria-label={panelExpanded ? t("app.collapsePanel") : t("app.expandPanel")}
              >
                <svg
                  width="14" height="14" viewBox="0 0 14 14" fill="none"
                  style={{ transform: panelExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                >
                  <path d="M3 5L7 9L11 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {panelExpanded && (
              <>
                <PillSelector
                  selectedMetric={selectedMetric}
                  onChange={(m) => {
                    setSelectedMetric(m);
                    if (m === "safety_index_spain") setSelectedYear(2025);
                  }}
                />
                {globalBreaks && (
                  <Legend
                    breaks={globalBreaks}
                    metric={selectedMetric}
                    references={references}
                  />
                )}
              </>
            )}
          </div>

          {/* Bottom slider */}
          <div className="slider-bar">
            <YearSlider
              year={selectedYear}
              onChange={setSelectedYear}
              disabled={yearDisabled}
            />
          </div>

          {selectedAbp && statsData && (
            <SidePanel
              abpCode={selectedAbp}
              stats={statsData[selectedAbp]}
              metric={selectedMetric}
              year={selectedYear}
              onClose={() => setSelectedAbp(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
