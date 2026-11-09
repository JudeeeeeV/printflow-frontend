interface OrderCardTitleData {
  assets?: readonly ({ original_filename?: unknown } | null)[] | null;
  client_name?: unknown;
  created_at?: unknown;
  order_name?: unknown;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: '2-digit',
  day: '2-digit',
  year: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true,
});

export function displayOrderStatus(state: string) {
  return state ? state.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'Status unavailable';
}

export function getOrderSpecifications(order: {
  paper_size?: string | null; print_color_mode?: string | null; orientation?: string | null;
  page_count?: number | null; copies?: number | null; total?: number | null;
}) {
  const positiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
  return {
    paper: order.paper_size || 'Paper unavailable',
    color: order.print_color_mode === 'COLOR' ? 'COLOR' : order.print_color_mode === 'BLACK_AND_WHITE' ? 'B&W' : 'Color unavailable',
    orientation: order.orientation === 'LANDSCAPE' || order.orientation === 'PORTRAIT' ? order.orientation : 'Orientation unavailable',
    pages: positiveInteger(order.page_count) ? `${order.page_count} ${order.page_count === 1 ? 'page' : 'pages'}` : 'Page count unavailable',
    copies: positiveInteger(order.copies) ? `${order.copies} ${order.copies === 1 ? 'COPY' : 'COPIES'}` : 'Copies unavailable',
    total: typeof order.total === 'number' && Number.isFinite(order.total) && order.total >= 0
      ? `₱${order.total.toFixed(2)}` : 'Total unavailable',
  };
}

export function getOrderCardTitleParts(order: OrderCardTitleData) {
  const originalFilename = Array.isArray(order.assets)
    ? order.assets[0]?.original_filename
    : undefined;
  let filename = typeof originalFilename === 'string' ? originalFilename.trim() : '';
  const extensionIndex = filename.lastIndexOf('.');
  if (extensionIndex > 0) filename = filename.slice(0, extensionIndex).trim();

  const customer = typeof order.client_name === 'string' ? order.client_name.trim() : '';
  const orderName = typeof order.order_name === 'string' ? order.order_name.trim() : '';
  const timestamp = typeof order.created_at === 'string' ? order.created_at.trim() : '';
  const date = timestamp ? new Date(timestamp) : null;
  const formattedDate = date && Number.isFinite(date.getTime())
    ? dateFormatter.format(date)
    : 'Date unavailable';

  return {
    filename: orderName || filename || 'Filename unavailable',
    customer: customer || 'Name unavailable',
    date: formattedDate,
    time: date && Number.isFinite(date.getTime()) ? timeFormatter.format(date) : 'Time unavailable',
    originalFilename: typeof originalFilename === 'string' && originalFilename.trim()
      ? originalFilename.trim() : 'Filename unavailable',
  };
}
