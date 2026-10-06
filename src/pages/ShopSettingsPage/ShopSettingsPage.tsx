import React, { useState, useEffect } from "react";
import { ArrowRight, Location, Save, Store, Time } from "@carbon/icons-react";
import { apiClient } from "../../services/apiClient";
import type { PrintShop } from "../../services/orderService";
import { ShopPhotoUpload } from "../../components/maps/ShopPhotoUpload";
import { ShopGcashQrForm } from "../../components/settings/ShopGcashQrForm";
import { LocationMapModal } from "../../components/maps/LocationMapModal";
import { hasCoordinates } from "../../components/maps/coordinates";
import styles from "../../components/maps/Maps.module.css";

export const ShopSettingsPage: React.FC = () => {
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [savedPin, setSavedPin] = useState({ latitude: "", longitude: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [availabilityOverride, setAvailabilityOverride] = useState(false);
  const [opensAt, setOpensAt] = useState("08:00");
  const [closesAt, setClosesAt] = useState("20:00");
  const [isEffectivelyOpen, setIsEffectivelyOpen] = useState(false);
  const hasPin = hasCoordinates(
    latitude.trim() === "" ? null : Number(latitude),
    longitude.trim() === "" ? null : Number(longitude),
  );

  useEffect(() => {
    const fetchShop = async () => {
      try {
        const data = await apiClient<PrintShop & { description?: string }>(
          "/shops/me",
          { method: "GET" },
        );
        if (data) {
          setShopName(data.name || "");
          setAddress(data.location || "");
          setDescription(data.description || "");
          setPhotoUrl(data.shop_photo_url || null);
          setLatitude(data.latitude == null ? "" : String(data.latitude));
          setLongitude(data.longitude == null ? "" : String(data.longitude));
          setSavedPin({
            latitude: data.latitude == null ? "" : String(data.latitude),
            longitude: data.longitude == null ? "" : String(data.longitude),
          });
          setAvailabilityOverride(data.availability_override === true);
          setOpensAt((data.opens_at || "08:00").slice(0, 5));
          setClosesAt((data.closes_at || "20:00").slice(0, 5));
          setIsEffectivelyOpen(data.status === "OPEN");
        }
      } catch (err) {
        console.error("Failed to fetch shop settings:", err);
        setLoadFailed(true);
        setMessage(
          "Could not load shop settings. Reload this page to try again.",
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchShop();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || loadFailed || isSaving) return;
    const lat = latitude.trim() === "" ? null : Number(latitude);
    const lng = longitude.trim() === "" ? null : Number(longitude);
    if (
      (lat === null) !== (lng === null) ||
      (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
      (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180))
    ) {
      setMessage(
        "Enter valid latitude and longitude together, or clear both to remove the pin.",
      );
      return;
    }
    setIsSaving(true);
    setMessage("");
    try {
      const saved = await apiClient<{
        name: string;
        latitude: number | null;
        longitude: number | null;
        status: string;
      }>("/shops/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: shopName,
          location: address,
          description: description,
          latitude: lat,
          longitude: lng,
          availability_override: availabilityOverride,
          opens_at: opensAt,
          closes_at: closesAt,
        }),
      });
      const savedCoordinates = {
        latitude: saved.latitude == null ? "" : String(saved.latitude),
        longitude: saved.longitude == null ? "" : String(saved.longitude),
      };
      setLatitude(savedCoordinates.latitude);
      setLongitude(savedCoordinates.longitude);
      setSavedPin(savedCoordinates);
      setIsEffectivelyOpen(saved.status === "OPEN");
      setMessage("Settings saved successfully!");
      window.dispatchEvent(
        new CustomEvent("shop-settings-updated", {
          detail: { name: saved.name },
        }),
      );
    } catch (err: unknown) {
      setMessage(
        err instanceof Error ? err.message : "Failed to save settings.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl p-4 font-sans sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-carbon-gray-100">
          Shop Settings
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your shop details and help students find you.
        </p>
      </header>

      {message && (
        <div
          role="status"
          className={`mb-4 p-4 text-sm font-medium ${message.includes("success") ? "bg-green-50 text-green-700" : "bg-gray-100 text-carbon-gray-100"}`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSave}>
        <fieldset
          disabled={isLoading || loadFailed || isSaving}
          className="min-w-0 disabled:opacity-60"
        >
          {isLoading && (
            <p role="status" className="text-sm text-gray-500">
              Loading shop settings…
            </p>
          )}
          <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
            <section
              aria-labelledby="shop-details-title"
              className="min-w-0 border border-[#e0e0e0] bg-white"
            >
              <div className="flex items-center gap-3 border-b border-[#e0e0e0] px-5 py-4">
                <Store size={20} className="text-gray-600" />
                <h2 id="shop-details-title" className="text-base font-semibold">
                  Shop details
                </h2>
              </div>
              <div className="space-y-6 p-5 sm:p-6">
                <div>
                  <label
                    htmlFor="settings-shop-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Print Shop Name
                  </label>
                  <input
                    type="text"
                    id="settings-shop-name"
                    maxLength={200}
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className={styles.input}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-location"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Location / Address
                  </label>
                  <input
                    type="text"
                    id="settings-location"
                    maxLength={500}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div>
                  <label
                    htmlFor="settings-description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="settings-description"
                    maxLength={2000}
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`${styles.input} resize-y`}
                  />
                  <p className="mt-2 text-xs leading-relaxed text-gray-500">
                    Add a nearby landmark or pickup instructions to help
                    students find your entrance.
                  </p>
                </div>
              </div>
            </section>
            <div className="min-w-0 space-y-5">
              <section
                aria-labelledby="shop-availability-title"
                className="min-w-0 border border-[#e0e0e0] bg-white"
              >
                <div className="flex items-center gap-3 border-b border-[#e0e0e0] px-5 py-4">
                  <Time size={20} className="text-gray-600" />
                  <h2 id="shop-availability-title" className="text-base font-semibold">
                    Shop availability
                  </h2>
                </div>
                <div className="space-y-5 p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-carbon-gray-100">Manual open override</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">
                        ON keeps your shop open after closing time. OFF follows your schedule.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={availabilityOverride}
                      onClick={() => setAvailabilityOverride((current) => !current)}
                      className={`relative h-8 w-16 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 ${availabilityOverride ? "bg-carbon-blue-60" : "bg-gray-400"}`}
                    >
                      <span className="sr-only">Manual open override</span>
                      <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${availabilityOverride ? "translate-x-9" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="shop-opens-at" className="mb-1 block text-sm font-medium text-gray-700">Opens</label>
                      <input id="shop-opens-at" type="time" step="1800" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} className={styles.input} required />
                    </div>
                    <div>
                      <label htmlFor="shop-closes-at" className="mb-1 block text-sm font-medium text-gray-700">Closes</label>
                      <input id="shop-closes-at" type="time" step="1800" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} className={styles.input} required />
                    </div>
                  </div>
                  <div className={`border-l-2 p-3 text-sm ${isEffectivelyOpen || availabilityOverride ? "border-green-600 bg-green-50 text-green-800" : "border-gray-500 bg-carbon-gray-10 text-gray-700"}`}>
                    <span className="font-bold">{availabilityOverride ? "OPEN (manual)" : isEffectivelyOpen ? "OPEN (scheduled)" : "CLOSED"}</span>
                    <span className="block text-xs">Schedule uses Philippine time (Asia/Manila).</span>
                  </div>
                </div>
              </section>
              <ShopPhotoUpload photoUrl={photoUrl} onUploaded={setPhotoUrl} />
              <section
                aria-labelledby="pickup-location-title"
                className="min-w-0 border border-[#e0e0e0] bg-white"
              >
                <div className="flex items-center gap-3 border-b border-[#e0e0e0] px-5 py-4">
                  <Location size={20} className="text-gray-600" />
                  <h2
                    id="pickup-location-title"
                    className="text-base font-semibold"
                  >
                    Pickup location
                  </h2>
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                  <p className="text-sm leading-relaxed text-gray-600">
                    Place a pin at your shop entrance. Students can open the map
                    to find you.
                  </p>
                  <div className="border-l-2 border-carbon-blue-60 bg-carbon-gray-10 p-3">
                    <p className="break-words text-sm font-medium">
                      {address || "Add your shop address in Shop details."}
                    </p>
                    <p role="status" className="mt-1 text-xs text-gray-600">
                      {latitude !== savedPin.latitude ||
                      longitude !== savedPin.longitude
                        ? "Location changed — save your settings to publish."
                        : hasPin
                          ? "Your pickup pin is saved."
                          : "No pickup pin saved yet."}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => setIsMapOpen(true)}
                    className={`${styles.secondaryButton} w-full justify-between`}
                  >
                    {hasPin ? "Edit location" : "Set location on map"}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </section>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-4 border border-[#e0e0e0] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Save your shop details, availability, and pickup location.
            </p>
            <button
              disabled={isSaving}
              type="submit"
              className={`${styles.primaryButton} w-full shrink-0 sm:w-auto`}
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </fieldset>
      </form>
      <ShopGcashQrForm />
      {isMapOpen && (
        <LocationMapModal
          name={shopName || "Your shop"}
          address={address}
          photoUrl={photoUrl}
          latitude={latitude.trim() === "" ? null : Number(latitude)}
          longitude={longitude.trim() === "" ? null : Number(longitude)}
          onClose={() => setIsMapOpen(false)}
          onConfirm={(lat, lng) => {
            setLatitude(lat == null ? "" : String(lat));
            setLongitude(lng == null ? "" : String(lng));
            setMessage("");
          }}
        />
      )}
    </div>
  );
};
