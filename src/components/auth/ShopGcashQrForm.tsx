import { useEffect, useRef, useState } from 'react';
import { shopService } from '../../services/shopService';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const BUTTON_FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60';

export function ShopGcashQrForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [savedQrUrl, setSavedQrUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    shopService.getGcashQr().then(qr => {
      if (active) setSavedQrUrl(qr.gcash_qr_url);
    }).catch(error => {
      if (active) setLoadError(error instanceof Error ? error.message : 'Unable to load your GCash QR code.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);

  useEffect(() => () => {
    if (localUrl) URL.revokeObjectURL(localUrl);
  }, [localUrl]);

  const previewUrl = selectedFile ? localUrl : pendingRemoval ? null : savedQrUrl;
  const changed = selectedFile !== null || pendingRemoval;

  return (
    <section className="mb-6 border-b border-gray-200 pb-6" aria-labelledby="shop-gcash-qr-title">
      <h4 id="shop-gcash-qr-title" className="mb-2 font-bold text-carbon-gray-100">GCash QR code</h4>
      <p id="shop-gcash-qr-help" className="mb-4 text-sm text-gray-600">Students use this QR code to pay your shop. Choose a JPEG, PNG, or WebP image up to 10 MB, then save your changes.</p>
      {loading ? <p role="status" className="text-sm text-gray-600">Loading your GCash QR code...</p> : loadError ? (
        <div>
          <p role="alert" className="text-sm text-red-700">{loadError}</p>
          <button type="button" className={`mt-2 min-h-11 px-3 text-sm font-bold text-carbon-blue-60 ${BUTTON_FOCUS}`} onClick={() => {
            setLoading(true); setLoadError(''); setAttempt(value => value + 1);
          }}>Retry</button>
        </div>
      ) : (
        <form onSubmit={async event => {
          event.preventDefault();
          if (saving || !changed) return;
          setError(''); setSuccess(false); setSaving(true);
          try {
            const qr = selectedFile
              ? await shopService.uploadGcashQr(selectedFile)
              : await shopService.removeGcashQr();
            setSavedQrUrl(qr.gcash_qr_url);
            setSelectedFile(null); setLocalUrl(null); setPendingRemoval(false);
            setFailedPreviewUrl(null); setSuccess(true);
          } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to save your GCash QR code.');
          } finally { setSaving(false); }
        }}>
          <div className="mb-4 flex h-44 w-44 max-w-full items-center justify-center border border-gray-300 bg-white p-2">
            {previewUrl ? failedPreviewUrl === previewUrl ? (
              <p role="alert" className="p-2 text-center text-sm text-red-700">Unable to display this image. Choose another image or reopen settings to reload the saved QR code.</p>
            ) : (
              <img key={previewUrl} src={previewUrl} alt="Your shop's GCash payment QR code" className="h-full w-full object-contain" onError={() => setFailedPreviewUrl(previewUrl)} />
            ) : <p role="status" className="p-2 text-center text-sm text-gray-600">{pendingRemoval ? 'QR code will be removed when you save.' : 'No GCash QR code saved.'}</p>}
          </div>
          <input ref={inputRef} id="shop-gcash-qr-image" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={saving}
            aria-label="Choose GCash QR image" aria-describedby="shop-gcash-qr-help" onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              setSuccess(false);
              if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) {
                setError('Choose a JPEG, PNG, or WebP image no larger than 10 MB.');
                return;
              }
              setError(''); setFailedPreviewUrl(null);
              setSelectedFile(file); setLocalUrl(URL.createObjectURL(file)); setPendingRemoval(false);
            }} />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={saving} onClick={() => inputRef.current?.click()} aria-describedby="shop-gcash-qr-help"
              className={`min-h-11 border border-carbon-blue-60 bg-white px-4 py-3 text-sm font-bold text-carbon-blue-60 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_FOCUS}`}>
              {previewUrl ? 'Change image' : 'Choose image'}
            </button>
            {previewUrl && <button type="button" disabled={saving} onClick={() => {
              setSelectedFile(null); setLocalUrl(null); setPendingRemoval(savedQrUrl !== null);
              setError(''); setSuccess(false); setFailedPreviewUrl(null);
            }} className={`min-h-11 bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_FOCUS}`}>Remove</button>}
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          {success && <p role="status" className="mt-3 text-sm text-green-700">Your GCash QR code has been saved.</p>}
          <button type="submit" disabled={saving || !changed}
            className={`mt-4 min-h-11 bg-carbon-blue-60 px-5 py-3 text-sm font-bold text-white hover:bg-carbon-blue-70 disabled:cursor-not-allowed disabled:bg-gray-400 ${BUTTON_FOCUS}`}>
            {saving ? 'Saving...' : 'Save QR code'}
          </button>
        </form>
      )}
    </section>
  );
}
