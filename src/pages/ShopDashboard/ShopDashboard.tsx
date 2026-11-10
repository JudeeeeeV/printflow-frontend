import { useState } from "react";
import { useLiveResource } from "../../hooks/useLiveResource";
import { shopService } from "../../services/shopService";
import { LiveShopQueue } from "../../components/dashboard/LiveShopQueue";
import { DashboardSkeleton } from "../../components/dashboard/skeletons/DashboardSkeleton";
import { useLiveQueueLayout } from "../../components/dashboard/useLiveQueueLayout";

const ShopDashboardLoading = () => {
  const { layout, gridRef } = useLiveQueueLayout("new");
  return <DashboardSkeleton layout={layout} gridRef={gridRef} />;
};

export const ShopDashboard = () => {
  const live = useLiveResource(
    "shop-dashboard",
    () => shopService.getMyShop(),
    ["shops"],
  );
  const [permit, setPermit] = useState<File | null>(null);
  const [qr, setQr] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!live.data && !live.error) return <ShopDashboardLoading />;
  if (!live.data)
    return (
      <div className="p-6">
        <p role="alert">The shop could not be loaded.</p>
        <button
          type="button"
          className="min-h-11 border border-black px-4"
          onClick={() => void live.refresh()}
        >
          Retry
        </button>
      </div>
    );
  const shop = live.data;
  if (
    shop.verification_status === "VERIFIED" ||
    shop.verification_status === "OPEN"
  )
    return <LiveShopQueue key={shop.id} shopId={shop.id} />;
  if (shop.verification_status === "PENDING_REVIEW")
    return (
      <div className="p-6">
        <h1 className="text-2xl font-black">Verification Under Review</h1>
        <p>
          Your business permit and GCash QR code are under review. Please check
          back later.
        </p>
      </div>
    );
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-black">Shop Verification Required</h1>
      <p>Submit your official business permit and GCash QR code.</p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!permit || !qr || busy) return;
          setBusy(true);
          setError("");
          void (async () => {
            try {
              await shopService.uploadGcashQr(qr);
              await shopService.verifyPermit(permit);
              await live.refresh();
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Documents could not be submitted.",
              );
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <label className="block">
          Business permit
          <input
            type="file"
            accept="application/pdf,image/*"
            required
            disabled={busy}
            onChange={(event) => setPermit(event.target.files?.[0] || null)}
            className="block min-h-11 w-full"
          />
        </label>
        <label className="block">
          GCash QR code
          <input
            type="file"
            accept="image/*"
            required
            disabled={busy}
            onChange={(event) => setQr(event.target.files?.[0] || null)}
            className="block min-h-11 w-full"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          type="submit"
          disabled={busy || !permit || !qr}
          className="min-h-11 bg-carbon-blue-60 px-4 text-white disabled:opacity-50"
        >
          {busy ? "Submitting..." : "Submit for Verification"}
        </button>
      </form>
    </div>
  );
};
