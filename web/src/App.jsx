import { useEffect, useState, useMemo } from "react";
import Map from "./components/Map.jsx";
import PillSelector from "./components/PillSelector.jsx";
import YearSlider from "./components/YearSlider.jsx";
import SidePanel from "./components/SidePanel.jsx";
import LogoBar from "./components/LogoBar.jsx";
import Legend from "./components/Legend.jsx";
import { getValueForFeature, computeGlobalBreaks, getReferences } from "./utils/data.js";

export default function App() {
  const [geoData, setGeoData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedMetric, setSelectedMetric] = useState("safety_index_cat");
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedAbp, setSelectedAbp] = useState(null);
  const [hoveredAbp, setHoveredAbp] = useState(null);

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

  // Enrich GeoJSON features with current metric value
  const enrichedGeoData = useMemo(() => {
    if (!geoData || !statsData) return null;
    return {
      ...geoData,
      features: geoData.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          _value: getValueForFeature(statsData, f.properties.abp_c, selectedMetric, selectedYear),
        },
      })),
    };
  }, [geoData, statsData, selectedMetric, selectedYear]);

  // Global breaks — stable across years, change only when metric changes
  const globalBreaks = useMemo(
    () => computeGlobalBreaks(statsData, selectedMetric),
    [statsData, selectedMetric]
  );

  // Reference values for legend annotations (cat_avg, spain_avg)
  const references = useMemo(
    () => getReferences(statsData, selectedMetric),
    [statsData, selectedMetric]
  );

  // Disable year slider when viewing Spain-only metric
  const yearDisabled = selectedMetric === "safety_index_spain";

  if (loading) {
    return (
      <div className="loading">
        Loading data… <br />
        <small>Make sure build_safety_gpkg.py has been run first.</small>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading error">
        <strong>Failed to load data</strong>
        <br />
        <code>{error}</code>
        <br />
        <small>Run build_safety_gpkg.py then restart the dev server.</small>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Catalunya Crime Map</h1>
      </header>

      <div className="main">
        <div className="map-area">
          <Map
            geoData={enrichedGeoData}
            globalBreaks={globalBreaks}
            selectedAbp={selectedAbp}
            hoveredAbp={hoveredAbp}
            onHover={setHoveredAbp}
            onClick={setSelectedAbp}
          />

          <div className="bottom-area">
            <div className="logo-float">
              <LogoBar />
            </div>
            <div className="controls">
              <div className="controls-left">
                <PillSelector
                  selectedMetric={selectedMetric}
                  onChange={(m) => {
                    setSelectedMetric(m);
                    if (m === "safety_index_spain") setSelectedYear(2025);
                  }}
                />
                <YearSlider
                  year={selectedYear}
                  onChange={setSelectedYear}
                  disabled={yearDisabled}
                />
              </div>
            </div>
          </div>

          {globalBreaks && (
            <Legend
              breaks={globalBreaks}
              metric={selectedMetric}
              references={references}
            />
          )}
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
  );
}
