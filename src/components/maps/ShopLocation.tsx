import { useState } from "react";
import { ArrowRight, Location } from "@carbon/icons-react";
import type { PrintShop } from "../../services/orderService";
import { hasCoordinates } from "./coordinates";

import { LocationMapModal } from "./LocationMapModal";
import styles from "./Maps.module.css";

export function ShopLocation({ shop }: { shop: PrintShop }) {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const hasPin = hasCoordinates(shop.latitude, shop.longitude);
  return (
    <section
      aria-label="Selected shop location"
      className={`${styles.locationSection} mt-4`}
    >
      <div className={styles.locationCard}>
        <div className={styles.locationIcon}>
          <Location size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={styles.eyebrow}>Pickup location</p>
          <h4 className="break-words text-sm font-semibold text-carbon-gray-100">
            {shop.name}
          </h4>
          <p className="mt-1 break-words text-sm text-gray-600">
            {shop.location || "No street address provided."}
          </p>
          {!hasPin && (
            <p className="mt-2 text-xs text-gray-500">
              The shop has not added a map pin yet.
            </p>
          )}
        </div>
        {hasPin && (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setIsMapOpen(true)}
            className={`${styles.secondaryButton} ${styles.cardAction}`}
          >
            View on map
            <ArrowRight size={18} />
          </button>
        )}
      </div>
      {isMapOpen && hasPin && (
        <LocationMapModal
          name={shop.name}
          latitude={shop.latitude}
          longitude={shop.longitude}
          address={shop.location}
          photoUrl={shop.shop_photo_url}
          onClose={() => setIsMapOpen(false)}
        />
      )}
    </section>
  );
}
