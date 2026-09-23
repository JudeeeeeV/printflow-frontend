import { Popup, type Map, type Marker } from 'maplibre-gl';

export function attachShopPhotoPopup(map: Map, marker: Marker, name: string, address?: string | null, photoUrl?: string | null) {
  const content = document.createElement('div');
  content.style.cssText = 'width:220px;max-width:100%;font-family:inherit;overflow-wrap:anywhere';
  const title = document.createElement('h3');
  title.textContent = name;
  title.style.cssText = 'font-size:15px;font-weight:700;margin:0 20px 8px 0';
  content.append(title);
  const fallback = document.createElement('p');
  fallback.textContent = 'No storefront photo yet.';
  fallback.style.cssText = 'margin:8px 0;color:#525252;font-size:13px';
  let safeUrl = false;
  try {
    const url = new URL(photoUrl || '');
    safeUrl = url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  } catch { /* Missing or invalid photo: show the fallback. */ }
  if (safeUrl && photoUrl) {
    const image = document.createElement('img');
    image.alt = `${name} storefront`;
    image.width = 220;
    image.height = 140;
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.style.cssText = 'display:block;width:100%;height:140px;object-fit:cover;background:#f4f4f4';
    image.onerror = () => {
      fallback.textContent = 'Photo unavailable. Refresh the page to try again.';
      image.replaceWith(fallback);
    };
    image.src = photoUrl;
    content.append(image);
  } else content.append(fallback);
  if (address) {
    const detail = document.createElement('p');
    detail.textContent = address;
    detail.style.cssText = 'font-size:13px;margin:8px 0 0;color:#525252';
    content.append(detail);
  }
  // Build DOM nodes, never interpolate shop-provided text into HTML.
  const popup = new Popup({ anchor: 'bottom', offset: 30, maxWidth: '260px', focusAfterOpen: false })
    .setDOMContent(content);
  const element = marker.getElement();
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', `View ${name} storefront photo and location`);
  element.setAttribute('aria-expanded', 'false');
  element.style.cursor = 'pointer';
  let pinned = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelClose = () => { clearTimeout(closeTimer); };
  const show = () => {
    cancelClose();
    popup.setLngLat(marker.getLngLat());
    if (!popup.isOpen()) popup.addTo(map);
    element.setAttribute('aria-expanded', 'true');
  };
  const closeLater = () => {
    cancelClose();
    if (!pinned) closeTimer = setTimeout(() => popup.remove(), 180);
  };
  const hover = (event: PointerEvent) => { if (event.pointerType === 'mouse') show(); };
  const click = (event: MouseEvent) => { event.stopPropagation(); pinned = true; show(); };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopPropagation(); pinned = true; show();
    } else if (event.key === 'Escape') popup.remove();
  };
  const close = () => { pinned = false; element.setAttribute('aria-expanded', 'false'); };
  element.addEventListener('pointerenter', hover);
  element.addEventListener('pointerleave', closeLater);
  element.addEventListener('click', click);
  element.addEventListener('keydown', keydown);
  element.addEventListener('focus', show);
  element.addEventListener('blur', closeLater);
  content.addEventListener('pointerenter', cancelClose);
  content.addEventListener('pointerleave', closeLater);
  const dragstart = () => popup.remove();
  marker.on('dragstart', dragstart);
  popup.on('close', close);
  return () => {
    cancelClose();
    popup.remove();
    marker.off('dragstart', dragstart);
    element.removeEventListener('pointerenter', hover);
    element.removeEventListener('pointerleave', closeLater);
    element.removeEventListener('click', click);
    element.removeEventListener('keydown', keydown);
    element.removeEventListener('focus', show);
    element.removeEventListener('blur', closeLater);
  };
}
