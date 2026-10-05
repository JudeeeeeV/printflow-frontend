interface OrderCardTitleData {
  assets?: readonly ({ original_filename?: unknown } | null)[] | null;
  client_name?: unknown;
  created_at?: unknown;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: '2-digit',
  day: '2-digit',
  year: '2-digit',
});

export function getOrderCardTitleParts(order: OrderCardTitleData) {
  const originalFilename = Array.isArray(order.assets)
    ? order.assets[0]?.original_filename
    : undefined;
  let filename = typeof originalFilename === 'string' ? originalFilename.trim() : '';
  const extensionIndex = filename.lastIndexOf('.');
  if (extensionIndex > 0) filename = filename.slice(0, extensionIndex).trim();

  const customer = typeof order.client_name === 'string' ? order.client_name.trim() : '';
  const timestamp = typeof order.created_at === 'string' ? order.created_at.trim() : '';
  const date = timestamp ? new Date(timestamp) : null;
  const formattedDate = date && Number.isFinite(date.getTime())
    ? dateFormatter.format(date)
    : 'Date unavailable';

  return {
    filename: filename || 'Filename unavailable',
    customer: customer || 'Name unavailable',
    date: formattedDate,
  };
}
