import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { buildFillExpression } from "../utils/colors.js";
import { CRIME_LABELS } from "../utils/data.js";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const SOURCE_ID = "abp";
const FILL_LAYER = "abp-fill";
const OUTLINE_LAYER = "abp-outline";
const HOVER_LAYER = "abp-hover";
const SELECTED_LAYER = "abp-selected";
const LABEL_LAYER = "abp-labels";

export default function Map({ geoData, globalBreaks, selectedAbp, hoveredAbp, onHover, onClick, selectedMetric }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const sourceReadyRef = useRef(false);

  const geoDataRef = useRef(geoData);
  const globalBreaksRef = useRef(globalBreaks);
  const selectedMetricRef = useRef(selectedMetric);
  geoDataRef.current = geoData;
  globalBreaksRef.current = globalBreaks;
  selectedMetricRef.current = selectedMetric;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [1.7, 41.7],
      zoom: 7,
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
          "line-color": "rgba(0,0,0,0.35)",
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

      sourceReadyRef.current = true;

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
            `<div class="popup-row"><span class="popup-label">Safety (vs Catalonia)</span><span class="popup-val-stack">${rankStr}<span class="popup-val">${fmt(catIdx)}</span></span></div>` +
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

  return <div ref={containerRef} className="map-container" />;
}
