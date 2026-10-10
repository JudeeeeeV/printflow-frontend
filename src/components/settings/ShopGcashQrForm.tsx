import { useRef, useState } from 'react';
import { QrCode } from '@carbon/icons-react';
import buttonStyles from '../maps/Maps.module.css';

interface Props {
  gcashNumber: string;
  savedUrl: string | null;
  selectedFile: File | null;
  localUrl: string | null;
  pendingRemoval: boolean;
  disabled: boolean;
  error?: string;
  onNumberChange: (value: string) => void;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

export function ShopGcashQrForm({ gcashNumber, savedUrl, selectedFile, localUrl, pendingRemoval, disabled, error, onNumberChange, onSelect, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [failedPreviewUrl, setFailedPreviewUrl] = useState<string | null>(null);
  const previewUrl = selectedFile ? localUrl : pendingRemoval ? null : savedUrl;

  return (
    <section id="settings-qr" className="min-w-0 border border-black bg-white" aria-labelledby="shop-gcash-qr-title">
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
        <QrCode size={20} aria-hidden="true" className="text-gray-600" />
        <h2 id="shop-gcash-qr-title" className="text-base font-semibold text-carbon-gray-100">GCash QR code</h2>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <label htmlFor="shop-gcash-number" className="mb-1 block text-sm font-medium text-gray-700">GCash mobile number</label>
          <input
            id="shop-gcash-number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={11}
            disabled={disabled}
            value={gcashNumber}
            onChange={event => onNumberChange(event.target.value.replace(/\D/g, '').slice(0, 11))}
            placeholder="09XXXXXXXXX"
            aria-describedby="shop-gcash-number-help"
            className={buttonStyles.input}
          />
          <p id="shop-gcash-number-help" className="mt-2 text-xs leading-relaxed text-gray-600">Enter the 11-digit number registered to your GCash account, starting with 09.</p>
        </div>
        <p id="shop-gcash-qr-help" className="text-sm text-gray-600">You can also upload a QR code. Choose a JPEG, PNG, or WebP image up to 10 MB, then save your changes.</p>
        <div className="mx-auto flex h-44 w-44 max-w-full items-center justify-center border border-gray-300 bg-white p-2">
          {previewUrl ? failedPreviewUrl === previewUrl ? (
            <p role="alert" className="p-2 text-center text-sm text-red-700">Unable to display this image. Choose another image or reload settings to try again.</p>
          ) : (
            <img key={previewUrl} src={previewUrl} alt="Your shop's GCash payment QR code" className="h-full w-full object-contain" onError={() => setFailedPreviewUrl(previewUrl)} />
          ) : <p role="status" className="p-2 text-center text-sm text-gray-600">{pendingRemoval ? 'QR code will be removed when you save.' : 'No GCash QR code saved.'}</p>}
        </div>
        <input ref={inputRef} id="shop-gcash-qr-image" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={disabled}
          aria-label="Choose GCash QR image" aria-describedby="shop-gcash-qr-help" onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file && !disabled) onSelect(file);
          }} />
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} aria-describedby="shop-gcash-qr-help" className={buttonStyles.secondaryButton}>
            {previewUrl ? 'Change image' : 'Choose image'}
          </button>
          {previewUrl && <button type="button" disabled={disabled} onClick={onRemove} className={buttonStyles.secondaryButton}>Remove</button>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </section>
  );
}
