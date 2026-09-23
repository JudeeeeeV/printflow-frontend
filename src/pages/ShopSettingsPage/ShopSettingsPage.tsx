import React, { useState, useEffect } from "react";
import { ArrowRight, Location, Save, Store } from "@carbon/icons-react";
import { apiClient } from "../../services/apiClient";
import type { PrintShop } from "../../services/orderService";
import { ShopPhotoUpload } from "../../components/maps/ShopPhotoUpload";
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
      }>("/shops/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: shopName,
          location: address,
          description: description,
          latitude: lat,
          longitude: lng,
        }),
      });
      const savedCoordinates = {
        latitude: saved.latitude == null ? "" : String(saved.latitude),
        longitude: saved.longitude == null ? "" : String(saved.longitude),
      };
      setLatitude(savedCoordinates.latitude);
      setLongitude(savedCoordinates.longitude);
      setSavedPin(savedCoordinates);
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
              Save your shop details and pickup location.
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
