import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { buildFillExpression } from "../utils/colors.js";

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const SOURCE_ID = "abp";
const FILL_LAYER = "abp-fill";
const OUTLINE_LAYER = "abp-outline";
const SELECTED_LAYER = "abp-selected";

export default function Map({ geoData, globalBreaks, selectedAbp, hoveredAbp, onHover, onClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const sourceReadyRef = useRef(false);
  // Always hold the latest prop values so the load handler can apply them
  const geoDataRef = useRef(geoData);
  const globalBreaksRef = useRef(globalBreaks);
  geoDataRef.current = geoData;
  globalBreaksRef.current = globalBreaks;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [1.7, 41.7],
      zoom: 7,
      maxBounds: [[-1, 40], [5, 43.5]],
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({
        customAttribution: "Crime data: <a href='https://mossos.gencat.cat' target='_blank'>Mossos d'Esquadra</a> · Generalitat de Catalunya · CC BY 4.0",
      }),
      "bottom-right"
    );

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
          "fill-opacity": 0.7,
        },
      });

      map.addLayer({
        id: OUTLINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        paint: {
          "line-color": "#666",
          "line-width": 0.5,
        },
      });

      // Selected polygon highlight
      map.addLayer({
        id: SELECTED_LAYER,
        type: "line",
        source: SOURCE_ID,
        filter: ["==", ["get", "abp_c"], ""],
        paint: {
          "line-color": "#1d4ed8",
          "line-width": 2.5,
        },
      });

      sourceReadyRef.current = true;

      // Apply any data/breaks that arrived before the map finished loading
      if (geoDataRef.current) {
        map.getSource(SOURCE_ID).setData(geoDataRef.current);
      }
      if (globalBreaksRef.current) {
        map.setPaintProperty(FILL_LAYER, "fill-color", buildFillExpression(globalBreaksRef.current));
      }

      // Cursor and hover tooltip
      map.on("mousemove", FILL_LAYER, (e) => {
        map.getCanvas().style.cursor = "pointer";
        const props = e.features[0]?.properties;
        if (!props) return;
        onHover(props.abp_c);
        const val = props._value;
        const label = val != null ? val.toFixed(3) : "n/a";
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${props.abp_d}</strong><br/>` +
            `Pop: ${Number(props.abp_pob).toLocaleString()}<br/>` +
            `Value: <strong>${label}</strong>`
          )
          .addTo(map);
      });

      map.on("mouseleave", FILL_LAYER, () => {
        map.getCanvas().style.cursor = "";
        onHover(null);
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

  // Update GeoJSON data (values change with year/metric)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceReadyRef.current || !geoData) return;
    const src = map.getSource(SOURCE_ID);
    if (src) src.setData(geoData);
  }, [geoData]);

  // Update fill color expression only when metric changes (globalBreaks are stable per metric)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceReadyRef.current || !globalBreaks) return;
    if (map.getLayer(FILL_LAYER)) {
      map.setPaintProperty(FILL_LAYER, "fill-color", buildFillExpression(globalBreaks));
    }
  }, [globalBreaks]);

  // Highlight selected polygon
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sourceReadyRef.current) return;
    if (map.getLayer(SELECTED_LAYER)) {
      map.setFilter(SELECTED_LAYER, ["==", ["get", "abp_c"], selectedAbp || ""]);
    }
  }, [selectedAbp]);

  return <div ref={containerRef} className="map-container" />;
}
