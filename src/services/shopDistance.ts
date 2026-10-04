import { hasCoordinates } from '../components/maps/coordinates';

export interface ShopPosition {
  latitude: number;
  longitude: number;
}

type ShopPin = { latitude?: number | null; longitude?: number | null };

/** Approximate straight-line distance, in metres, between two map coordinates. */
export function distanceToShop(origin: ShopPosition, shop: ShopPin): number | null {
  if (!hasCoordinates(origin.latitude, origin.longitude) || !hasCoordinates(shop.latitude, shop.longitude)) return null;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(origin.latitude);
  const lat2 = radians(shop.latitude!);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(shop.longitude! - origin.longitude);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function sortShopsByDistance<T extends ShopPin>(shops: T[], origin: ShopPosition | null) {
  const ranked = shops.map(shop => ({ shop, distance: origin ? distanceToShop(origin, shop) : null }));
  // Sort a copy, keep equal-distance shops stable, and put missing pins last.
  if (origin) ranked.sort((a, b) => {
    if (a.distance === null) return b.distance === null ? 0 : 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });
  return ranked;
}

export function formatShopDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${metres.toFixed(1)} m`;
}
