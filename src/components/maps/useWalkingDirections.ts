import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_WALKING_ROUTE_URL,
  getWalkingRoute,
  locateForDirections,
  type WalkingRoute,
} from "../../services/directionsService";

const endpoint =
  import.meta.env.VITE_WALKING_ROUTE_URL || DEFAULT_WALKING_ROUTE_URL;
export const routingProvider = (() => {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return "the route provider";
  }
})();
export const routingProviderUrl = (() => {
  try {
    return new URL(endpoint).origin;
  } catch {
    return "https://routing.openstreetmap.de/about.html";
  }
})();

export function useWalkingDirections(
  latitude?: number | null,
  longitude?: number | null,
) {
  const [status, setStatus] = useState<
    "idle" | "locating" | "routing" | "ready" | "error"
  >("idle");
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [error, setError] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [latitude, longitude],
  );

  const getDirections = async () => {
    if (latitude == null || longitude == null || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setStatus("locating");
    setError("");
    setRoute(null);
    setAccuracy(null);
    try {
      const position = await locateForDirections(controller.signal);
      if (controller.signal.aborted) return;
      setAccuracy(position.coords.accuracy);
      setStatus("routing");
      const nextRoute = await getWalkingRoute(
        [position.coords.longitude, position.coords.latitude],
        [longitude, latitude],
        controller.signal,
        endpoint,
      );
      if (controller.signal.aborted) return;
      setRoute(nextRoute);
      setStatus("ready");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not get directions. Please try again.",
      );
      setStatus("error");
    } finally {
      if (active.current === controller) active.current = null;
    }
  };
  const clearDirections = () => {
    active.current?.abort();
    active.current = null;
    setRoute(null);
    setError("");
    setAccuracy(null);
    setStatus("idle");
  };
  return {
    status,
    route,
    error,
    accuracy,
    getDirections,
    clearDirections,
    busy: status === "locating" || status === "routing",
  };
}
