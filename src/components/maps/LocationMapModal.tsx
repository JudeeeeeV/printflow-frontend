import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Checkmark, Close, Location } from "@carbon/icons-react";
import { hasCoordinates } from "./coordinates";
import styles from "./Maps.module.css";
import {
  routingProvider,
  routingProviderUrl,
  useWalkingDirections,
} from "./useWalkingDirections";

const LocationMap = lazy(() => import("./LocationMap"));

interface Props {
  name: string;
  address?: string | null;
  photoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  onClose: () => void;
  onConfirm?: (latitude: number | null, longitude: number | null) => void;
}

// Mount only on request; closing discards draft edits and stops location watches.
export function LocationMapModal({
  name,
  address,
  photoUrl,
  latitude,
  longitude,
  onClose,
  onConfirm,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [draftLat, setDraftLat] = useState(
    latitude == null ? "" : String(latitude),
  );
  const [draftLng, setDraftLng] = useState(
    longitude == null ? "" : String(longitude),
  );
  const editable = Boolean(onConfirm);
  const lat = editable
    ? draftLat.trim() === ""
      ? null
      : Number(draftLat)
    : latitude;
  const lng = editable
    ? draftLng.trim() === ""
      ? null
      : Number(draftLng)
    : longitude;
  const validPin = hasCoordinates(lat, lng);
  const emptyPin = lat == null && lng == null;
  const directions = useWalkingDirections(latitude, longitude);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    closeRef.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && trigger.isConnected)
        trigger.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <header className={styles.dialogHeader}>
        <div className="min-w-0">
          <p className={styles.eyebrow}>Pickup location</p>
          <h2
            id={titleId}
            className="break-words text-xl font-bold sm:text-2xl"
          >
            {editable ? "Set your shop location" : name}
          </h2>
          <p
            id={descriptionId}
            className="mt-2 break-words text-sm text-gray-600"
          >
            {editable
              ? "Place the pin at your entrance so students know where to collect their prints."
              : address || "Find the shop using its pickup pin."}
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close location map"
          onClick={onClose}
          className={styles.iconButton}
        >
          <Close size={24} />
        </button>
      </header>
      <div className={styles.dialogBody}>
        <Suspense
          fallback={
            <div
              role="status"
              className={`${styles.mapCanvas} flex items-center justify-center gap-2 bg-carbon-gray-10 text-sm text-gray-600`}
            >
              <Location size={20} />
              Loading map…
            </div>
          }
        >
          <LocationMap
            name={name}
            address={address}
            photoUrl={photoUrl}
            latitude={lat}
            longitude={lng}
            route={directions.route}
            onLocationChange={
              editable
                ? (nextLat, nextLng) => {
                    setDraftLat(String(nextLat));
                    setDraftLng(String(nextLng));
                  }
                : undefined
            }
          />
        </Suspense>
        {!editable && directions.status !== "idle" && (
          <div className={styles.routeStatus} role="status" aria-live="polite">
            {directions.status === "locating" && (
              <p className="text-sm font-semibold">
                Finding your location… Allow location access when your browser
                asks.
              </p>
            )}
            {directions.status === "routing" && (
              <p className="text-sm font-semibold">
                Finding a walking route to {name}…
              </p>
            )}
            {directions.error && <p className="text-sm">{directions.error}</p>}
            {directions.route && (
              <>
                <p className="text-sm font-semibold">
                  Walking route ·{" "}
                  {directions.route.distance >= 1000
                    ? `${(directions.route.distance / 1000).toFixed(1)} km`
                    : `${Math.round(directions.route.distance)} m`}{" "}
                  · About{" "}
                  {Math.max(1, Math.round(directions.route.duration / 60))} min
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-600">
                  Green dot: your starting location. Blue pin: shop entrance.
                  Dotted links show gaps to the nearest mapped path, not a
                  verified walkway.
                </p>
                {directions.accuracy != null && directions.accuracy > 100 && (
                  <p className="mt-1 text-xs text-gray-600">
                    Your device location is approximate (±
                    {Math.round(directions.accuracy)} m). The route may start
                    away from your actual position.
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-600">
                  Routing:{" "}
                  <a
                    href={routingProviderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {routingProvider}
                  </a>{" "}
                  / OSRM · ©{" "}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    OpenStreetMap
                  </a>{" "}
                  ·{" "}
                  <a
                    href="https://www.openstreetmap.org/fixthemap"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Fix the map
                  </a>
                </p>
              </>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={styles.textButton}
                onClick={directions.clearDirections}
              >
                {directions.busy ? "Cancel directions" : "Clear directions"}
              </button>
              {!directions.busy && (
                <a
                  className={styles.textButton}
                  href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                  <ArrowUpRight size={16} />
                </a>
              )}
            </div>
          </div>
        )}
        {editable && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <details>
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold">
                Enter exact coordinates
              </summary>
              <div className="grid gap-4 pt-2 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-gray-600">
                  <span className="block">Latitude</span>
                  <input
                    type="number"
                    min={-90}
                    max={90}
                    step="any"
                    value={draftLat}
                    onChange={(e) => setDraftLat(e.target.value)}
                    className={styles.input}
                  />
                </label>
                <label className="space-y-2 text-sm text-gray-600">
                  <span className="block">Longitude</span>
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step="any"
                    value={draftLng}
                    onChange={(e) => setDraftLng(e.target.value)}
                    className={styles.input}
                  />
                </label>
              </div>
            </details>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p role="status" className="text-sm text-gray-600">
                {validPin
                  ? "Pin selected. Apply it, then save your settings."
                  : emptyPin
                    ? "No pin selected yet."
                    : "Enter a valid latitude and longitude together."}
              </p>
              <button
                type="button"
                disabled={emptyPin}
                className={styles.textButton}
                onClick={() => {
                  setDraftLat("");
                  setDraftLng("");
                }}
              >
                Remove pin
              </button>
            </div>
          </div>
        )}
      </div>
      <footer className={styles.dialogFooter}>
        {!editable && validPin && (
          <p className={styles.directionsNotice}>
            Get directions uses your device location and shares the starting
            point and shop pin with {routingProvider} to calculate a walking
            route. PrintFlow does not save your position.
          </p>
        )}
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onClose}
        >
          {editable ? "Cancel" : "Close"}
        </button>
        {onConfirm ? (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!validPin && !emptyPin}
            onClick={() => {
              onConfirm(lat ?? null, lng ?? null);
              onClose();
            }}
          >
            <Checkmark size={18} />
            Apply location
          </button>
        ) : (
          validPin && (
            <button
              type="button"
              className={styles.primaryButton}
              disabled={directions.busy}
              onClick={directions.getDirections}
            >
              {directions.status === "locating"
                ? "Finding location…"
                : directions.status === "routing"
                  ? "Finding route…"
                  : directions.route
                    ? "Refresh directions"
                    : "Get directions"}
              <Location size={18} />
            </button>
          )
        )}
      </footer>
    </dialog>,
    document.body,
  );
}
