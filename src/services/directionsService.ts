import { hasCoordinates } from "../components/maps/coordinates.ts";

export type RoutePoint = [number, number]; // longitude, latitude
export interface WalkingRoute {
  geometry: { type: "LineString"; coordinates: RoutePoint[] };
  distance: number;
  duration: number;
  origin: RoutePoint;
  destination: RoutePoint;
}

export const DEFAULT_WALKING_ROUTE_URL =
  "https://routing.openstreetmap.de/routed-foot/route/v1/driving";
let lastRequestAt = 0;

export function locateForDirections(
  signal: AbortSignal,
  geolocation: Geolocation | undefined = globalThis.navigator?.geolocation,
  secureContext = globalThis.isSecureContext,
): Promise<GeolocationPosition> {
  if (!secureContext)
    return Promise.reject(
      new Error(
        "Location access requires HTTPS. Open the secure version of this site.",
      ),
    );
  if (!geolocation)
    return Promise.reject(
      new Error("This browser does not support location access."),
    );
  return new Promise((resolve, reject) => {
    let watchId: number | undefined;
    let finished = false;
    const finish = (error?: Error, position?: GeolocationPosition) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (watchId !== undefined) geolocation.clearWatch(watchId);
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve(position!);
    };
    const abort = () =>
      finish(new DOMException("Directions cancelled", "AbortError"));
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "Location lookup timed out. Check location settings and try again.",
          ),
        ),
      25000,
    );
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    try {
      watchId = geolocation.watchPosition(
        (position) => {
          if (
            !hasCoordinates(position.coords.latitude, position.coords.longitude)
          ) {
            finish(
              new Error(
                "Your device returned an invalid location. Please try again.",
              ),
            );
          } else finish(undefined, position);
        },
        (error) =>
          finish(
            new Error(
              error.code === 1
                ? "Location permission was denied. Allow location for this site in your browser settings, then try again."
                : error.code === 3
                  ? "Location lookup timed out. Check location settings and try again."
                  : "Your location is unavailable. Enable device location services and try again.",
            ),
          ),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
      if (finished) geolocation.clearWatch(watchId);
    } catch {
      finish(
        new Error(
          "Location access is unavailable. Check your browser settings.",
        ),
      );
    }
  });
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function parseWalkingRoute(
  payload: unknown,
  origin: RoutePoint,
  destination: RoutePoint,
): WalkingRoute {
  const response = record(payload);
  if (response.code === "NoRoute" || response.code === "NoSegment") {
    throw new Error(
      "No walking route was found between your location and this shop. Try an external map for alternatives.",
    );
  }
  const route = record(
    Array.isArray(response.routes) ? response.routes[0] : null,
  );
  const geometry = record(route.geometry);
  const points = geometry.coordinates;
  if (
    response.code !== "Ok" ||
    geometry.type !== "LineString" ||
    !Array.isArray(points) ||
    points.length < 2 ||
    points.length > 100000 ||
    !points.every(
      (point) =>
        Array.isArray(point) &&
        point.length >= 2 &&
        hasCoordinates(point[1], point[0]),
    ) ||
    typeof route.distance !== "number" ||
    !Number.isFinite(route.distance) ||
    route.distance < 0 ||
    typeof route.duration !== "number" ||
    !Number.isFinite(route.duration) ||
    route.duration < 0
  ) {
    throw new Error(
      "The route service returned an invalid route. Please try again.",
    );
  }
  return {
    geometry: {
      type: "LineString",
      coordinates: points.map((point) => [point[0], point[1]]),
    },
    distance: route.distance,
    duration: route.duration,
    origin,
    destination,
  };
}

export async function getWalkingRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  signal: AbortSignal,
  endpoint = DEFAULT_WALKING_ROUTE_URL,
): Promise<WalkingRoute> {
  if (
    !hasCoordinates(origin[1], origin[0]) ||
    !hasCoordinates(destination[1], destination[0])
  )
    throw new Error("The start or shop location is invalid.");
  signal.throwIfAborted();
  const base = new URL(endpoint);
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(base.hostname)
    )
  )
    throw new Error("The route service must use a secure connection.");
  if (Date.now() - lastRequestAt < 1100)
    throw new Error("Please wait a moment before requesting another route.");
  lastRequestAt = Date.now();
  const url = new URL(
    `${base.href.replace(/\/$/, "")}/${origin.join(",")};${destination.join(",")}`,
  );
  url.search = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "false",
    alternatives: "false",
    radiuses: "200;200",
  }).toString();
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, timeout.signal]),
      credentials: "omit",
      referrerPolicy: "strict-origin-when-cross-origin",
    });
    if (!response.ok)
      throw new Error(
        "The route service is unavailable. Try again shortly or open an external map.",
      );
    return parseWalkingRoute(await response.json(), origin, destination);
  } catch (error) {
    if (signal.aborted)
      throw new DOMException("Directions cancelled", "AbortError");
    if (timeout.signal.aborted)
      throw new Error("The route request timed out. Please try again.", {
        cause: error,
      });
    if (error instanceof TypeError)
      throw new Error(
        "Could not connect to the route service. Check your connection and try again.",
        { cause: error },
      );
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
