import { LngLatBounds, Marker, type Map } from "maplibre-gl";
import type { WalkingRoute } from "../../services/directionsService";

export function attachWalkingRoute(map: Map, route: WalkingRoute) {
  const sourceId = "shop-walking-route";
  const layerIds = ["shop-route-halo", "shop-route-line", "shop-route-links"];
  let startMarker: Marker | undefined;
  let disposed = false;
  const draw = () => {
    if (disposed || map.getSource(sourceId)) return;
    const coordinates = route.geometry.coordinates;
    map.addSource(sourceId, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { kind: "route" },
            geometry: route.geometry,
          },
          {
            type: "Feature",
            properties: { kind: "link" },
            geometry: {
              type: "LineString",
              coordinates: [route.origin, coordinates[0]],
            },
          },
          {
            type: "Feature",
            properties: { kind: "link" },
            geometry: {
              type: "LineString",
              coordinates: [
                coordinates[coordinates.length - 1],
                route.destination,
              ],
            },
          },
        ],
      },
    });
    map.addLayer({
      id: layerIds[0],
      type: "line",
      source: sourceId,
      filter: ["==", "kind", "route"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 10, "line-opacity": 0.9 },
    });
    map.addLayer({
      id: layerIds[1],
      type: "line",
      source: sourceId,
      filter: ["==", "kind", "route"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#0f62fe", "line-width": 6 },
    });
    map.addLayer({
      id: layerIds[2],
      type: "line",
      source: sourceId,
      filter: ["==", "kind", "link"],
      paint: {
        "line-color": "#525252",
        "line-width": 3,
        "line-dasharray": [1, 2],
      },
    });
    const dot = document.createElement("div");
    dot.style.cssText =
      "width:20px;height:20px;border:3px solid white;border-radius:50%;background:#198038;box-shadow:0 0 0 2px #198038";
    dot.setAttribute("role", "img");
    dot.setAttribute("aria-label", "Your starting location");
    dot.title = "Your starting location";
    startMarker = new Marker({ element: dot })
      .setLngLat(route.origin)
      .addTo(map);
    const bounds = new LngLatBounds(route.origin, route.destination);
    coordinates.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, {
      padding: { top: 55, bottom: 40, left: 40, right: 60 },
      maxZoom: 17,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 700,
    });
  };
  // Directions may arrive before tiles/style finish loading.
  if (map.isStyleLoaded()) draw();
  map.on("load", draw);
  return () => {
    disposed = true;
    map.off("load", draw);
    startMarker?.remove();
    if (map.getStyle()) {
      [...layerIds].reverse().forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  };
}
