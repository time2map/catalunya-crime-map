import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { buildFillExpression } from "../utils/colors.js";
import { CRIME_LABELS, YEARS } from "../utils/data.js";

function getBBoxCenter(geometry) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const rings = geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat(1);
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function getSparklineValues(statsData, abpCode, metric) {
  const abp = statsData?.[abpCode];
  if (!abp) return YEARS.map(() => null);
  return YEARS.map(year => {
    if (metric === "safety_index_cat") return abp.years?.[year]?.safety_index_cat ?? null;
    return abp.years?.[year]?.[metric]?.rate ?? null;
  });
}

function buildSparklineSVG(values) {
  const W = 54, H = 22, pad = 3;
  const indexed = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (indexed.length < 2) return null;
  const nums = indexed.map(([, v]) => v);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  const n = values.length;
  const w = W - pad * 2;
  const h = H - pad * 2;
  const toX = i => pad + (i / (n - 1)) * w;
  const toY = v => pad + h - ((v - min) / range) * h;
  const points = indexed.map(([i, v]) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="3" fill="rgba(0,0,0,0.62)"/><polyline points="${points}" fill="none" stroke="rgba(255,255,255,0.88)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function computeTrendSlope(values) {
  const pairs = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const sumX = pairs.reduce((s, [x]) => s + x, 0);
  const sumY = pairs.reduce((s, [, y]) => s + y, 0);
  const sumXY = pairs.reduce((s, [x, y]) => s + x * y, 0);
  const sumX2 = pairs.reduce((s, [x]) => s + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const meanY = sumY / n;
  return meanY !== 0 ? slope / meanY : 0;
}

function trendArrow(slope) {
  if (slope === null) return null;
  if (slope > 0.10)  return { dir: "up",         color: "#d95c50" };
  if (slope > 0.03)  return { dir: "up-right",   color: "#e8a898" };
  if (slope > -0.03) return { dir: "right",      color: "#94a3b8" };
  if (slope > -0.10) return { dir: "down-right", color: "#7ec8d3" };
                     return { dir: "down",        color: "#5aaab8" };
}

function buildArrowSVG(dir, color) {
  const W = 26, H = 26;
  const attrs = `stroke="${color}" fill="none" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"`;
  const shapes = {
    "up":         `<line x1="13" y1="20" x2="13" y2="7" ${attrs}/><polyline points="9,11 13,7 17,11" ${attrs}/>`,
    "up-right":   `<line x1="8" y1="19" x2="19" y2="8" ${attrs}/><polyline points="11,8 19,8 19,16" ${attrs}/>`,
    "right":      `<line x1="6" y1="13" x2="20" y2="13" ${attrs}/><polyline points="15,9 20,13 15,17" ${attrs}/>`,
    "down-right": `<line x1="8" y1="8" x2="19" y2="19" ${attrs}/><polyline points="11,19 19,19 19,11" ${attrs}/>`,
    "down":       `<line x1="13" y1="7" x2="13" y2="20" ${attrs}/><polyline points="9,16 13,20 17,16" ${attrs}/>`,
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><circle cx="13" cy="13" r="13" fill="rgba(0,0,0,0.65)"/>${shapes[dir] ?? ""}</svg>`;
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

function parseMapHash() {
  const m = window.location.hash.match(/^#map=([\d.]+)\/([-\d.]+)\/([-\d.]+)/);
  if (!m) return null;
  return { zoom: parseFloat(m[1]), center: [parseFloat(m[3]), parseFloat(m[2])] };
}

function updateMapHash(map) {
  const { lat, lng } = map.getCenter();
  const zoom = map.getZoom();
  history.replaceState(null, "", `#map=${zoom.toFixed(2)}/${lat.toFixed(4)}/${lng.toFixed(4)}`);
}
const SOURCE_ID = "abp";
const FILL_LAYER = "abp-fill";
const OUTLINE_LAYER = "abp-outline";
const HOVER_LAYER = "abp-hover";
const SELECTED_LAYER = "abp-selected";
const LABEL_LAYER = "abp-labels";

export default function Map({ geoData, globalBreaks, selectedAbp, hoveredAbp, onHover, onClick, selectedMetric, sparklineMode, rawGeoData, statsData }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const sourceReadyRef = useRef(false);
  const sparklineMarkersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);

  const geoDataRef = useRef(geoData);
  const globalBreaksRef = useRef(globalBreaks);
  const selectedMetricRef = useRef(selectedMetric);
  geoDataRef.current = geoData;
  globalBreaksRef.current = globalBreaks;
  selectedMetricRef.current = selectedMetric;

  useEffect(() => {
    const saved = parseMapHash();
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: saved?.center ?? [1.7, 41.7],
      zoom: saved?.zoom ?? 7,
      maxBounds: [[-1, 40], [5, 43.5]],
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 8,
    });

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: geoData || { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE_ID,
        paint: {
          "fill-color": "#ccc",
          "fill-opacity": 0.75,
        },
      });

      map.addLayer({
        id: OUTLINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "rgba(255,255,255,0.2)",
          "line-width": 0.5,
        },
      });

      // Hover highlight
      map.addLayer({
        id: HOVER_LAYER,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "abp_c"], ""],
        paint: {
          "line-color": "rgba(255,255,255,0.85)",
          "line-width": 2,
        },
      });

      // Selected polygon highlight
      map.addLayer({
        id: SELECTED_LAYER,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "abp_c"], ""],
        paint: {
          "line-color": "#ffffff",
          "line-width": 3,
        },
      });

      // Zone labels
      map.addLayer({
        id: LABEL_LAYER,
        type: "symbol",
        source: SOURCE_ID,
        layout: {
          "text-field": ["get", "abp_d"],
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 7,
          "text-anchor": "center",
          "text-padding": 2,
        },
        paint: {
          "text-color": "rgba(255,255,255,0.82)",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1.2,
        },
      });

      // Lift place-name labels above the choropleth fill
      map.getStyle().layers
        .filter(l => l.type === "symbol" && (
          l["source-layer"] === "place" ||
          (l.id && l.id.toLowerCase().includes("place"))
        ))
        .forEach(l => {
          map.moveLayer(l.id, HOVER_LAYER);
          map.setPaintProperty(l.id, "text-halo-width", 0);
        });

      // Lift street-name labels above the choropleth fill
      map.getStyle().layers
        .filter(l => l.type === "symbol" && (
          l["source-layer"] === "transportation_name" ||
          (l.id && l.id.toLowerCase().includes("road")) ||
          (l.id && l.id.toLowerCase().includes("street"))
        ))
        .forEach(l => {
          map.moveLayer(l.id, HOVER_LAYER);
          map.setPaintProperty(l.id, "text-halo-width", 0.5);
          map.setPaintProperty(l.id, "text-halo-color", "rgba(80,80,80,0.6)");
          map.setPaintProperty(l.id, "text-color", "rgba(255,255,255,0.4)");
        });

      // Lift building layers: transparent fill, hairline white outline only
      map.getStyle().layers
        .filter(l => l.type === "fill" && (
          l["source-layer"] === "building" ||
          (l.id && l.id.toLowerCase().includes("building"))
        ))
        .forEach(l => {
          map.moveLayer(l.id, HOVER_LAYER);
          map.setPaintProperty(l.id, "fill-color", "rgba(0,0,0,0)");
          map.setPaintProperty(l.id, "fill-opacity", 1);
          map.setPaintProperty(l.id, "fill-outline-color", "rgba(255,255,255,0.1)");
        });

      sourceReadyRef.current = true;
      setMapReady(true);

      if (geoDataRef.current) {
        map.getSource(SOURCE_ID).setData(geoDataRef.current);
      }
      if (globalBreaksRef.current) {
        map.setPaintProperty(FILL_LAYER, "fill-color", buildFillExpression(globalBreaksRef.current));
      }

      map.on("mousemove", FILL_LAYER, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const props = e.features[0]?.properties;
        if (!props) return;
        const abp_c = props.abp_c;
        onHover(abp_c);
        map.setFilter(HOVER_LAYER, ["==", ["get", "abp_c"], abp_c]);

        const metric = selectedMetricRef.current;
        const metricLabel = CRIME_LABELS[metric] || metric;
        const val = props._value;
        const catIdx = props._cat_idx;
        const spainIdx = props._spain_idx;

        const fmt = (v) => (v != null ? Number(v).toFixed(3) : "<span class='popup-na'>n/a</span>");
        const isShowingMetric = metric !== "safety_index_cat" && metric !== "safety_index_spain";
        const rank = props._cat_rank;
        const rankStr = rank ? `<span class="popup-rank">#${rank} of 59</span>` : "";

        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="popup-title">${props.abp_d}</div>` +
            `<div class="popup-pop">Pop: ${Number(props.abp_pob).toLocaleString()}</div>` +
            (isShowingMetric
              ? `<div class="popup-row"><span class="popup-label">${metricLabel} <span class="popup-unit">per 1,000</span></span><span class="popup-val">${fmt(val)}</span></div>`
              : "") +
            `<div class="popup-sep"></div>` +
            `<div class="popup-row"><span class="popup-label">Safety (vs Catalunya)</span><span class="popup-val-stack">${rankStr}<span class="popup-val">${fmt(catIdx)}</span></span></div>` +
            `<div class="popup-row"><span class="popup-label">Safety (vs Spain, 2025)</span><span class="popup-val">${fmt(spainIdx)}</span></div>`
          )
          .addTo(map);
      });

      map.on("mouseleave", FILL_LAYER, () => {
        map.getCanvas().style.cursor = "";
        onHover(null);
        map.setFilter(HOVER_LAYER, ["==", ["get", "abp_c"], ""]);
        popup.remove();
      });

      map.on("click", FILL_LAYER, (e) => {
        const abp_c = e.features[0]?.properties?.abp_c;
        if (abp_c) onClick(abp_c);
      });
    });

    map.on("moveend", () => updateMapHash(map));

    mapRef.current = map;
    return () => map.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceReadyRef.current || !geoData) return;
    const src = map.getSource(SOURCE_ID);
    if (src) src.setData(geoData);
  }, [geoData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceReadyRef.current || !globalBreaks) return;
    if (map.getLayer(FILL_LAYER)) {
      map.setPaintProperty(FILL_LAYER, "fill-color", buildFillExpression(globalBreaks));
    }
  }, [globalBreaks]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceReadyRef.current) return;
    if (map.getLayer(SELECTED_LAYER)) {
      map.setFilter(SELECTED_LAYER, ["==", ["get", "abp_c"], selectedAbp || ""]);
    }
  }, [selectedAbp]);

  useEffect(() => {
    sparklineMarkersRef.current.forEach(m => m.remove());
    sparklineMarkersRef.current = [];

    if (!mapReady || !mapRef.current || !sparklineMode || !rawGeoData || !statsData) return;
    if (selectedMetric === "safety_index_spain") return;

    const map = mapRef.current;
    const trendWindow = sparklineMode === "trend5" ? YEARS.slice(-5) : sparklineMode === "trend2" ? YEARS.slice(-2) : null;

    rawGeoData.features.forEach(feature => {
      const abp_c = feature.properties?.abp_c;
      if (!abp_c) return;

      let svgHtml;
      if (trendWindow) {
        const abp = statsData[abp_c];
        if (!abp) return;
        const values = trendWindow.map(year =>
          selectedMetric === "safety_index_cat"
            ? abp.years?.[year]?.safety_index_cat ?? null
            : abp.years?.[year]?.[selectedMetric]?.rate ?? null
        );
        const arrow = trendArrow(computeTrendSlope(values));
        if (!arrow) return;
        svgHtml = buildArrowSVG(arrow.dir, arrow.color);
      } else {
        svgHtml = buildSparklineSVG(getSparklineValues(statsData, abp_c, selectedMetric));
      }

      if (!svgHtml) return;
      const center = getBBoxCenter(feature.geometry);
      const el = document.createElement("div");
      el.innerHTML = svgHtml;
      el.style.pointerEvents = "none";
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(center)
        .addTo(map);
      sparklineMarkersRef.current.push(marker);
    });
  }, [sparklineMode, rawGeoData, statsData, selectedMetric, mapReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="map-container" />;
}
