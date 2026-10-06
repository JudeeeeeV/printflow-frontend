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
      className={styles.locationSection}
    >
      <div className={styles.locationCard}>
        <div className={styles.locationIcon}>
          <Location size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className={styles.eyebrow}>Pickup location</p>
          <p className="break-words text-sm leading-5 text-gray-600">
            {shop.location || "No street address provided."}
          </p>
          {!hasPin && (
            <p className="mt-1 text-xs leading-4 text-gray-600">
              The shop has not added a map pin yet.
            </p>
          )}
        </div>
        {hasPin && (
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => setIsMapOpen(true)}
            className={`${styles.primaryButton} ${styles.cardAction}`}
          >
            View on map
            <ArrowRight size={14} aria-hidden="true" />
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
