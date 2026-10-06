import type { PrintShop } from './orderService';

const toMinutes = (value: string | undefined, fallback: number) => {
  const match = value?.match(/^(\d{2}):(\d{2})/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
};

export function isShopOpen(shop: PrintShop, now = new Date()): boolean {
  if (shop.availability_override) return true;
  if (!shop.opens_at || !shop.closes_at) return shop.status === 'OPEN';

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: shop.timezone || 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  const opensAt = toMinutes(shop.opens_at, 8 * 60);
  const closesAt = toMinutes(shop.closes_at, 20 * 60);
  if (opensAt === closesAt) return false;
  return opensAt < closesAt
    ? current >= opensAt && current < closesAt
    : current >= opensAt || current < closesAt;
}
