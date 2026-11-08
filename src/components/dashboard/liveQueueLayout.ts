export const MIN_QUEUE_CARD_HEIGHT = 208;
export const QUEUE_GRID_GAP = 12;

export interface LiveQueueLayout {
  pageSize: number;
  rows: number;
  contained: boolean;
}

export function getLiveQueueLayout(width: number, contentHeight: number, cardHeight = MIN_QUEUE_CARD_HEIGHT, gap = QUEUE_GRID_GAP): LiveQueueLayout {
  return {
    pageSize: 6,
    rows: width < 768 ? 6 : width < 1280 ? 3 : 2,
    contained: width >= 1280 && contentHeight >= cardHeight * 2 + gap,
  };
}

export function getQueuePage(page: number, previousSize: number, pageSize: number, total: number) {
  const anchoredPage = Math.floor(((page - 1) * previousSize) / pageSize) + 1;
  return Math.max(1, Math.min(anchoredPage, Math.max(1, Math.ceil(total / pageSize))));
}

export const queueGridClassName = 'grid min-w-0 grid-cols-1 items-stretch gap-3 p-3 md:grid-cols-2 xl:grid-cols-3';
