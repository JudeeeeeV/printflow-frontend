import React, { useEffect, useRef, useState } from "react";
import { useBlocker, useOutletContext } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Location, Save, Store, Time } from "@carbon/icons-react";
import { shopService, type ShopSettingsValues } from "../../services/shopService";
import { ShopPhotoUpload } from "../../components/maps/ShopPhotoUpload";
import { ShopGcashQrForm } from "../../components/settings/ShopGcashQrForm";
import { LocationMapModal } from "../../components/maps/LocationMapModal";
import { hasCoordinates } from "../../components/maps/coordinates";
import styles from "../../components/maps/Maps.module.css";
import pageStyles from "./ShopSettingsPage.module.css";
import { UnsavedSettingsModal } from "./UnsavedSettingsModal";
import type { ShopSettingsNavigation } from "../../components/layout/ShopLayout";
import { useDataEvents } from "../../hooks/useDataEvents";

const SECTION_LABELS = { details: "Shop details", pickup: "Pickup location", availability: "Shop availability", photo: "Shop photo", qr: "GCash QR code" };
type Section = keyof typeof SECTION_LABELS;
type Errors = Partial<Record<Section, string>>;
type PendingImage = { file: File; url: string };
const EMPTY_VALUES: ShopSettingsValues = { name: "", location: "", description: "", latitude: null, longitude: null, availability_override: false, opens_at: "08:00", closes_at: "20:00" };
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function normalizeValues(shop: Partial<ShopSettingsValues>): ShopSettingsValues {
  return { name: shop.name || "", location: shop.location || "", description: shop.description || "", latitude: shop.latitude ?? null, longitude: shop.longitude ?? null,
    availability_override: shop.availability_override === true, opens_at: (shop.opens_at || "08:00").slice(0, 5), closes_at: (shop.closes_at || "20:00").slice(0, 5) };
}

export const ShopSettingsPage: React.FC = () => {
  const [values, setValues] = useState<ShopSettingsValues>(EMPTY_VALUES);
  const [baseline, setBaseline] = useState<ShopSettingsValues | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<PendingImage | null>(null);
  const [pendingQr, setPendingQr] = useState<PendingImage | null>(null);
  const [pendingQrRemoval, setPendingQrRemoval] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isEffectivelyOpen, setIsEffectivelyOpen] = useState(false);
  const [pendingLogout, setPendingLogout] = useState<(() => void) | null>(null);
  const skipNavigationGuardRef = useRef(false);
  const leavingRef = useRef(false);
  const { registerLogoutGuard } = useOutletContext<ShopSettingsNavigation>();
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  useEffect(() => {
    let active = true;
    shopService.getMyShop().then(shop => {
      if (!active) return;
      const loaded = normalizeValues(shop);
      setValues(loaded); setBaseline(loaded);
      setPhotoUrl(shop.shop_photo_url || null); setQrUrl(shop.gcash_qr_url || null);
      setIsEffectivelyOpen(shop.status === "OPEN");
    }).catch(error => {
      if (active) setLoadError(error instanceof Error ? error.message : "Could not load shop settings.");
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [loadAttempt]);
  const photoPreviewUrl = pendingPhoto?.url;
  const qrPreviewUrl = pendingQr?.url;
  useEffect(() => () => { if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl); }, [photoPreviewUrl]);
  useEffect(() => () => { if (qrPreviewUrl) URL.revokeObjectURL(qrPreviewUrl); }, [qrPreviewUrl]);

  const changed = {
    details: Boolean(baseline && (values.name !== baseline.name || values.location !== baseline.location || values.description !== baseline.description)),
    pickup: Boolean(baseline && (values.latitude !== baseline.latitude || values.longitude !== baseline.longitude)),
    availability: Boolean(baseline && (values.availability_override !== baseline.availability_override || values.opens_at !== baseline.opens_at || values.closes_at !== baseline.closes_at)),
    photo: pendingPhoto !== null,
    qr: pendingQr !== null || pendingQrRemoval,
  };
  const dirty = Object.values(changed).some(Boolean);
  useDataEvents(["shops"], () => {
    if (!dirty && !isSaving && !busyRef.current) setLoadAttempt(attempt => attempt + 1);
  });
  const disabled = isLoading || Boolean(loadError) || isSaving;
  const hasPin = hasCoordinates(values.latitude, values.longitude);
  const errorSections = (Object.keys(SECTION_LABELS) as Section[]).filter(section => errors[section]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !skipNavigationGuardRef.current && (dirty || isSaving || busyRef.current) && currentLocation.pathname !== nextLocation.pathname);
  const confirmingNavigation = blocker.state === "blocked" || pendingLogout !== null;

  useEffect(() => {
    registerLogoutGuard(dirty || isSaving ? logout => setPendingLogout(() => logout) : null);
    return () => registerLogoutGuard(null);
  }, [dirty, isSaving, registerLogoutGuard]);

  useEffect(() => {
    if (!dirty && !isSaving) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (skipNavigationGuardRef.current) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, isSaving]);

  const clearFeedback = (section: Section) => {
    setMessage("");
    setErrors(current => { const next = { ...current }; delete next[section]; return next; });
  };
  const edit = (section: Section, patch: Partial<ShopSettingsValues>) => {
    if (disabled || busyRef.current) return;
    clearFeedback(section); setValues(current => ({ ...current, ...patch }));
  };
  const stageImage = (section: "photo" | "qr", file: File) => {
    if (disabled || busyRef.current) return;
    clearFeedback(section);
    const maxMegabytes = section === "photo" ? 5 : 10;
    if (!IMAGE_TYPES.includes(file.type) || file.size === 0 || file.size > maxMegabytes * 1024 * 1024) {
      setErrors(current => ({ ...current, [section]: `Choose a JPEG, PNG, or WebP image no larger than ${maxMegabytes} MB.` }));
      return;
    }
    const selected = { file, url: URL.createObjectURL(file) };
    if (section === "photo") setPendingPhoto(selected);
    else { setPendingQr(selected); setPendingQrRemoval(false); }
  };
  const focusSummary = () => requestAnimationFrame(() => { if (mountedRef.current) summaryRef.current?.focus(); });

  const saveSettings = async (fromNavigation = false): Promise<boolean> => {
    if (disabled || busyRef.current) return false;
    if (!dirty) return true;
    const validation: Errors = {};
    if (!values.name.trim() || values.name.length > 200 || (values.location?.length || 0) > 500 || (values.description?.length || 0) > 2000) {
      validation.details = "Enter a shop name up to 200 characters, an address up to 500 characters, and a description up to 2,000 characters.";
    }
    if ((values.latitude === null) !== (values.longitude === null) || (values.latitude !== null && !hasPin)) {
      validation.pickup = "Choose valid latitude and longitude together, or clear both coordinates.";
    }
    const time = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!time.test(values.opens_at) || !time.test(values.closes_at) || values.opens_at === values.closes_at) {
      validation.availability = "Enter valid, different opening and closing times.";
    }
    setErrors(validation); setMessage("");
    if (Object.keys(validation).length) { if (!fromNavigation) focusSummary(); return false; }
    const restoreFocus = !fromNavigation && document.activeElement === saveRef.current;
    busyRef.current = true; setIsSaving(true);
    const operations: { section: Section; run: () => Promise<void> }[] = [];
    const saveValues = async (section: "details" | "pickup" | "availability", payload: Partial<ShopSettingsValues>) => {
      const saved = await shopService.updateSettings(payload);
      if (!mountedRef.current) return;
      const normalized = normalizeValues(saved);
      const committed = section === "details" ? { name: normalized.name, location: normalized.location, description: normalized.description }
        : section === "pickup" ? { latitude: normalized.latitude, longitude: normalized.longitude }
        : { availability_override: normalized.availability_override, opens_at: normalized.opens_at, closes_at: normalized.closes_at };
      setValues(current => ({ ...current, ...committed }));
      setBaseline(current => current ? { ...current, ...committed } : current);
      if (section === "availability") setIsEffectivelyOpen(saved.status === "OPEN");
      if (section === "details") window.dispatchEvent(new CustomEvent("shop-settings-updated", { detail: { name: saved.name } }));
    };
    if (changed.details) operations.push({ section: "details", run: () => saveValues("details", { name: values.name, location: values.location, description: values.description }) });
    if (changed.pickup) operations.push({ section: "pickup", run: () => saveValues("pickup", { latitude: values.latitude, longitude: values.longitude }) });
    if (changed.availability) operations.push({ section: "availability", run: () => saveValues("availability", { availability_override: values.availability_override, opens_at: values.opens_at, closes_at: values.closes_at }) });
    if (pendingPhoto) operations.push({ section: "photo", run: async () => {
      const saved = await shopService.uploadShopPhoto(pendingPhoto.file);
      if (mountedRef.current) { setPhotoUrl(saved.shop_photo_url); setPendingPhoto(null); }
    } });
    if (changed.qr) operations.push({ section: "qr", run: async () => {
      const saved = pendingQr ? await shopService.uploadGcashQr(pendingQr.file) : await shopService.removeGcashQr();
      if (mountedRef.current) { setQrUrl(saved.gcash_qr_url); setPendingQr(null); setPendingQrRemoval(false); }
    } });
    try {
      const results = await Promise.allSettled(operations.map(operation => operation.run()));
      if (!mountedRef.current) return false;
      const failures: Errors = {};
      const successes: string[] = [];
      results.forEach((result, index) => {
        const section = operations[index].section;
        if (result.status === "fulfilled") successes.push(SECTION_LABELS[section]);
        else failures[section] = result.reason instanceof Error ? result.reason.message : "Could not save this section. Please try again.";
      });
      setErrors(failures);
      if (Object.keys(failures).length) {
        setMessage(successes.length ? `Saved: ${successes.join(", ")}.` : "Your changes could not be saved.");
        if (!fromNavigation) focusSummary();
        return false;
      } else {
        setMessage("Settings saved successfully!");
        if (restoreFocus) requestAnimationFrame(() => { if (mountedRef.current) headingRef.current?.focus(); });
        return true;
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setIsSaving(false);
    }
  };

  const dismissNavigation = () => {
    if (isSaving || busyRef.current) return;
    setPendingLogout(null);
    if (blocker.state === "blocked") blocker.reset();
  };
  const leaveSettings = () => {
    if (isSaving || busyRef.current || leavingRef.current) return;
    leavingRef.current = true;
    if (pendingLogout) {
      skipNavigationGuardRef.current = true;
      setPendingLogout(null);
      pendingLogout();
    } else if (blocker.state === "blocked") blocker.proceed();
  };

  return (
    <div className={`${pageStyles.page} mx-auto w-full min-w-0 max-w-5xl p-4 pb-24 font-sans sm:p-6 sm:pb-24 lg:p-8 lg:pb-24`}>
      <header className="mb-5">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-carbon-gray-100 focus:outline-none">Shop Settings</h1>
        <p className="mt-2 text-sm text-gray-600">Manage your shop details, pickup location, and payment setup. Changes are published when you save.</p>
      </header>
      {(message || errorSections.length > 0 || loadError) && (
        <div ref={summaryRef} tabIndex={-1} role={errorSections.length || loadError ? "alert" : "status"}
          className={`mb-4 border p-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 ${errorSections.length || loadError ? "border-red-700 bg-red-50 text-red-800" : "border-green-700 bg-green-50 text-green-800"}`}>
          {message && <p>{message}</p>}
          {loadError && <><p>Could not load shop settings: {loadError}</p><button type="button" className={`${styles.secondaryButton} mt-2`} onClick={() => { setLoadError(""); setIsLoading(true); setLoadAttempt(current => current + 1); }}>Retry</button></>}
          {errorSections.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{errorSections.map(section => (
            <li key={section}><a href={`#settings-${section}`} className="font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">{SECTION_LABELS[section]}</a>: {errors[section]}</li>
          ))}</ul>}
        </div>
      )}
      <form id="shop-settings-form" onSubmit={async event => { event.preventDefault(); await saveSettings(); }} noValidate aria-busy={isSaving}>
        <fieldset disabled={disabled} className="min-w-0 disabled:opacity-60">
          {isLoading && <p role="status" className="mb-4 text-sm text-gray-600">Loading shop settings…</p>}
          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
            <div className="min-w-0 space-y-4">
              <section id="settings-details" aria-labelledby="shop-details-title" className="min-w-0 border border-black bg-white">
                <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3"><Store size={20} aria-hidden="true" className="text-gray-600" /><h2 id="shop-details-title" className="text-base font-semibold">Shop details</h2></div>
                <div className="space-y-4 p-4">
                  <div><label htmlFor="settings-shop-name" className="mb-1 block text-sm font-medium text-gray-700">Print Shop Name</label>
                    <input type="text" id="settings-shop-name" maxLength={200} value={values.name} onChange={event => edit("details", { name: event.target.value })} className={styles.input} required /></div>
                  <div><label htmlFor="settings-location" className="mb-1 block text-sm font-medium text-gray-700">Location / Address</label>
                    <input type="text" id="settings-location" maxLength={500} value={values.location || ""} onChange={event => edit("details", { location: event.target.value })} className={styles.input} /></div>
                  <div><label htmlFor="settings-description" className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                    <textarea id="settings-description" maxLength={2000} rows={3} value={values.description || ""} onChange={event => edit("details", { description: event.target.value })} className={`${styles.input} resize-y`} />
                    <p className="mt-2 text-xs leading-relaxed text-gray-600">Add a nearby landmark or pickup instructions to help students find your entrance.</p></div>
                  {errors.details && <p role="alert" className="text-sm text-red-700">{errors.details}</p>}
                </div>
              </section>
              <section id="settings-pickup" aria-labelledby="pickup-location-title" className="min-w-0 border border-black bg-white">
                <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3"><Location size={20} aria-hidden="true" className="text-gray-600" /><h2 id="pickup-location-title" className="text-base font-semibold">Pickup location</h2></div>
                <div className="space-y-4 p-4">
                  <p className="text-sm leading-relaxed text-gray-600">Place a pin at your shop entrance. Students can open the map to find you.</p>
                  <div className="border-l-2 border-carbon-blue-60 bg-carbon-gray-10 p-3">
                    <p className="break-words text-sm font-medium">{values.location || "Add your shop address in Shop details."}</p>
                    <p role="status" className="mt-1 text-xs text-gray-600">{changed.pickup ? "Location changed — save your settings to publish." : hasPin ? "Your pickup pin is saved." : "No pickup pin saved yet."}</p>
                  </div>
                  <button type="button" aria-haspopup="dialog" onClick={() => setIsMapOpen(true)} className={`${styles.secondaryButton} w-full justify-between`}>{hasPin ? "Edit location" : "Set location on map"}<ArrowRight size={18} aria-hidden="true" /></button>
                  {errors.pickup && <p role="alert" className="text-sm text-red-700">{errors.pickup}</p>}
                </div>
              </section>
              <ShopPhotoUpload photoUrl={photoUrl} selectedFile={pendingPhoto?.file || null} localUrl={pendingPhoto?.url || null} disabled={disabled} error={errors.photo}
                onSelect={file => stageImage("photo", file)} onCancel={() => { if (!disabled && !busyRef.current) { clearFeedback("photo"); setPendingPhoto(null); } }} />
            </div>
            <div className="min-w-0 space-y-4">
              <section id="settings-availability" aria-labelledby="shop-availability-title" className="min-w-0 border border-black bg-white">
                <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3"><Time size={20} aria-hidden="true" className="text-gray-600" /><h2 id="shop-availability-title" className="text-base font-semibold">Shop availability</h2></div>
                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div><p className="text-sm font-bold text-carbon-gray-100">Manual open override</p><p className="mt-1 text-xs leading-relaxed text-gray-600">ON keeps your shop open after closing time. OFF follows your schedule.</p></div>
                    <button type="button" role="switch" aria-checked={values.availability_override} onClick={() => edit("availability", { availability_override: !values.availability_override })}
                      className={`relative h-8 w-16 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none ${values.availability_override ? "bg-carbon-blue-60" : "bg-gray-400"}`}>
                      <span className="sr-only">Manual open override</span><span aria-hidden="true" className={`absolute left-0 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${values.availability_override ? "translate-x-9" : "translate-x-1"}`} />
                    </button>
                  </div>
                  <div className="grid min-w-0 grid-cols-2 gap-4">
                    <div className="min-w-0"><label htmlFor="shop-opens-at" className="mb-1 block text-sm font-medium text-gray-700">Opens</label><input id="shop-opens-at" type="time" step="1800" value={values.opens_at} onChange={event => edit("availability", { opens_at: event.target.value })} className={styles.input} required /></div>
                    <div className="min-w-0"><label htmlFor="shop-closes-at" className="mb-1 block text-sm font-medium text-gray-700">Closes</label><input id="shop-closes-at" type="time" step="1800" value={values.closes_at} onChange={event => edit("availability", { closes_at: event.target.value })} className={styles.input} required /></div>
                  </div>
                  <div className={`border-l-2 p-3 text-sm ${isEffectivelyOpen || values.availability_override ? "border-green-600 bg-green-50 text-green-800" : "border-gray-500 bg-carbon-gray-10 text-gray-700"}`}>
                    <span className="font-bold">{values.availability_override ? "OPEN (manual)" : isEffectivelyOpen ? "OPEN (scheduled)" : "CLOSED"}</span><span className="block text-xs">Schedule uses Philippine time (Asia/Manila).</span>
                  </div>
                  {errors.availability && <p role="alert" className="text-sm text-red-700">{errors.availability}</p>}
                </div>
              </section>
              <ShopGcashQrForm savedUrl={qrUrl} selectedFile={pendingQr?.file || null} localUrl={pendingQr?.url || null} pendingRemoval={pendingQrRemoval} disabled={disabled} error={errors.qr}
                onSelect={file => stageImage("qr", file)} onRemove={() => { if (!disabled && !busyRef.current) { clearFeedback("qr"); setPendingQr(null); setPendingQrRemoval(qrUrl !== null); } }} />
            </div>
          </div>
        </fieldset>
      </form>
      <AnimatePresence>
        {(dirty || isSaving) && !isLoading && !loadError && (
          <motion.div key="settings-save" data-settings-save className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-20 sm:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:right-6"
            initial={reduceMotion ? false : { x: "calc(100% + 24px)", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: reduceMotion ? 0 : "calc(100% + 24px)", opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}>
            <button ref={saveRef} type="submit" form="shop-settings-form" disabled={isSaving} className={`${styles.primaryButton} shadow-lg`}>
              <Save size={18} aria-hidden="true" /><span role={isSaving ? "status" : undefined}>{isSaving ? "Saving..." : "Save Changes"}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {isMapOpen && <LocationMapModal name={values.name || "Your shop"} address={values.location} photoUrl={photoUrl} latitude={values.latitude} longitude={values.longitude}
        onClose={() => setIsMapOpen(false)} onConfirm={(latitude, longitude) => edit("pickup", { latitude, longitude })} />}
      {confirmingNavigation && <UnsavedSettingsModal busy={isSaving}
        feedback={errorSections.length ? `${message ? `${message} ` : ""}${errorSections.map(section => `${SECTION_LABELS[section]}: ${errors[section]}`).join(" ")} Retry Save Changes or close this dialog to keep editing.` : ""}
        onDismiss={dismissNavigation} onLeave={leaveSettings} onSave={async () => { if (await saveSettings(true)) leaveSettings(); }} />}
    </div>
  );
};
