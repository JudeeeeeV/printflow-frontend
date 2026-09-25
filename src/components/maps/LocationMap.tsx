import { useEffect, useRef, useState } from "react";
import {
  GeolocateControl,
  Map,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { hasCoordinates } from "./coordinates";
import { attachShopPhotoPopup } from "./shopPhotoPopup";
import styles from "./Maps.module.css";
import type { WalkingRoute } from "../../services/directionsService";
import { attachWalkingRoute } from "./walkingRouteLayer";

// MapLibre v6 needs an explicit worker URL when bundled. Vite must bundle
// the worker's shared imports too; a plain ?url leaves them missing in dist.
setWorkerUrl(workerUrl);

interface LocationMapProps {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange?: (latitude: number, longitude: number) => void;
  disabled?: boolean;
  address?: string | null;
  photoUrl?: string | null;
  route?: WalkingRoute | null;
}

export default function LocationMap({
  name,
  latitude,
  longitude,
  onLocationChange,
  disabled = false,
  address,
  photoUrl,
  route,
}: LocationMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const changeRef = useRef(onLocationChange);
  const disabledRef = useRef(disabled);
  const [mapError, setMapError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [loading, setLoading] = useState(true);
  const editable = Boolean(onLocationChange);

  useEffect(() => {
    changeRef.current = onLocationChange;
  }, [onLocationChange]);
  useEffect(() => {
    disabledRef.current = disabled;
    markerRef.current?.setDraggable(editable && !disabled);
  }, [disabled, editable]);

  useEffect(() => {
    if (!container.current) return;
    let map: Map;
    try {
      map = new Map({
        container: container.current,
        style:
          import.meta.env.VITE_MAP_STYLE_URL ||
          "https://tiles.openfreemap.org/styles/liberty",
        center: [122, 12],
        zoom: 5,
        cooperativeGestures: false,
        scrollZoom: true,
      });
    } catch {
      // Defer to avoid synchronous state updates during effect setup.
      queueMicrotask(() => {
        setLoading(false);
        setMapError(
          "The interactive map is unavailable in this browser. You can still use the address or coordinates.",
        );
      });
      return;
    }
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");
    const geolocate = new GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 15000 },
      trackUserLocation: !editable,
      showAccuracyCircle: true,
    });
    map.addControl(geolocate, "top-right");
    geolocate.on("error", (event) => {
      setLocationError(
        event.code === 1
          ? "Location permission was denied. You can still explore the shop map."
          : "Your location is unavailable. Check device location settings and try again.",
      );
    });
    geolocate.on("geolocate", (event) => {
      setLocationError("");
      if (editable && !disabledRef.current) {
        changeRef.current?.(
          Number(event.coords.latitude.toFixed(6)),
          Number(event.coords.longitude.toFixed(6)),
        );
      }
    });
    map.on("load", () => {
      setLoading(false);
    });
    map.on("error", (e) => {
      console.warn("Map resource failed to load:", e.error);
      setLoading(false);
      setMapError(
        "Some map details could not load. Reopen the map to retry.",
      );
    });
    if (editable) {
      map.on("click", (event) => {
        if (disabledRef.current) return;
        if (
          event.originalEvent.target instanceof Element &&
          event.originalEvent.target.closest(
            ".maplibregl-marker, .maplibregl-popup",
          )
        )
          return;
        const point = event.lngLat.wrap();
        changeRef.current?.(
          Number(point.lat.toFixed(6)),
          Number(point.lng.toFixed(6)),
        );
      });
    }
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    const timeout = window.setTimeout(() => {
      if (!map.loaded()) {
        setLoading(false);
        setMapError(
          "The map is taking longer than expected. Check your connection or reopen it to retry.",
        );
      }
    }, 20000);
    return () => {
      window.clearTimeout(timeout);
      resize.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove(); // Also stops the geolocation watch.
      mapRef.current = null;
    };
  }, [editable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!hasCoordinates(latitude, longitude)) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const point: [number, number] = [longitude!, latitude!];
    const firstMarker = !markerRef.current;
    if (!markerRef.current) {
      const marker = new Marker({
        color: "#0f62fe",
        draggable: editable && !disabledRef.current,
      })
        .setLngLat(point)
        .addTo(map);
      marker.getElement().setAttribute("aria-label", `${name} pickup location`);
      marker.on("dragend", () => {
        if (disabledRef.current) return;
        const position = marker.getLngLat().wrap();
        changeRef.current?.(
          Number(position.lat.toFixed(6)),
          Number(position.lng.toFixed(6)),
        );
      });
      markerRef.current = marker;
    }
    markerRef.current.setLngLat(point);
    if (!editable || firstMarker) map.jumpTo({ center: point, zoom: 16 });
  }, [latitude, longitude, name, editable]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    return attachShopPhotoPopup(
      mapRef.current,
      markerRef.current,
      name,
      address,
      photoUrl,
    );
  }, [latitude, longitude, name, address, photoUrl, editable]);

  useEffect(() => {
    if (!mapRef.current || !route) return;
    return attachWalkingRoute(mapRef.current, route);
  }, [route]);

  return (
    <div className="min-w-0 space-y-3">
      <div className={styles.mapFrame}>
        <div
          ref={container}
          role="region"
          aria-label={`${name} interactive location map`}
          className={styles.mapCanvas}
        />
        {loading && (
          <p
            role="status"
            className="pointer-events-none absolute left-3 top-3 bg-white px-3 py-2 text-sm shadow"
          >
            Loading map…
          </p>
        )}
      </div>
      {(mapError || locationError) && (
        <p role="status" className="text-sm text-amber-800">
          {mapError || locationError}
        </p>
      )}
      {mapError && hasCoordinates(latitude, longitude) && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.textButton}
        >
          Open pickup location in Google Maps
        </a>
      )}
      {editable && (
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => {
            const point = mapRef.current?.getCenter().wrap();
            if (point)
              changeRef.current?.(
                Number(point.lat.toFixed(6)),
                Number(point.lng.toFixed(6)),
              );
          }}
          className={`${styles.secondaryButton} w-full sm:w-auto`}
        >
          Place pin at map center
        </button>
      )}
      <p className="text-xs leading-relaxed text-gray-500">
        {editable
          ? "Click the map, drag the pin, or use the location arrow to find your current position. Apply your location, then Save Changes to publish it."
          : "Hover over or tap the pin to see the shop photo. Use the location arrow to show your live position with your permission. Your position is not saved by PrintFlow."}
      </p>
    </div>
  );
}
