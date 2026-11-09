import { useEffect, useState } from 'react';

export type ProtectedFile =
  | { status: 'loading' | 'failed' }
  | { status: 'ready'; kind: 'pdf' | 'image'; objectUrl: string };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/**
 * Identifies previewable files from their contents. A blob URL runs on the
 * app's origin, so HTML or SVG uploads must never reach the preview frame.
 */
export function detectPreviewType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(bytes, [0x42, 0x4d])) return 'image/bmp';
  return null;
}

/** Loads a signed file into a local blob URL so the storage link never reaches the page's links or frames. */
export function useProtectedFile(url: string | null | undefined): ProtectedFile {
  const [loaded, setLoaded] = useState<{ url: string; file: ProtectedFile } | null>(null);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    const load = async () => {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('File unavailable');
      const blob = await response.blob();
      const type = detectPreviewType(new Uint8Array(await blob.slice(0, 12).arrayBuffer()));
      if (!type) throw new Error('Unsupported file');
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(new Blob([blob], { type }));
      setLoaded({ url, file: { status: 'ready', kind: type === 'application/pdf' ? 'pdf' : 'image', objectUrl } });
    };
    load().catch(() => {
      if (!controller.signal.aborted) setLoaded({ url, file: { status: 'failed' } });
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return loaded && loaded.url === url ? loaded.file : { status: 'loading' };
}
