import { useRef, useState } from "react";
import { Image as ImageIcon } from "@carbon/icons-react";
import styles from "./Maps.module.css";

interface Props {
  photoUrl: string | null;
  selectedFile: File | null;
  localUrl: string | null;
  disabled: boolean;
  error?: string;
  onSelect: (file: File) => void;
  onCancel: () => void;
}

export function ShopPhotoUpload({ photoUrl, selectedFile, localUrl, disabled, error, onSelect, onCancel }: Props) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shownImage = selectedFile ? localUrl : photoUrl;

  return (
    <section id="settings-photo" aria-labelledby="shop-photo-title" className="min-w-0 border border-black bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
        <ImageIcon size={20} aria-hidden="true" className="text-gray-600" />
        <h2 id="shop-photo-title" className="text-base font-semibold">Shop photo</h2>
      </div>
      <div className="space-y-4 p-4">
        <p className="text-sm leading-relaxed text-gray-600">Help students recognize your storefront when they open your map pin.</p>
        <div className={styles.photoPreview}>
          {shownImage && shownImage !== failedImage ? (
            <img key={shownImage} src={shownImage} alt={selectedFile ? "Selected storefront photo preview" : "Current shop storefront"}
              onError={() => setFailedImage(shownImage)} referrerPolicy="no-referrer" />
          ) : (
            <div className="px-4 py-5 text-center text-gray-600">
              <ImageIcon size={28} aria-hidden="true" className="mx-auto mb-2" />
              <p role={shownImage ? "alert" : "status"} className="text-sm">{shownImage ? "Preview unavailable. Choose another photo or reload settings." : "Add a storefront photo"}</p>
            </div>
          )}
        </div>
        <input ref={inputRef} id="shop-photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled}
          aria-label="Choose a storefront photo" aria-describedby="shop-photo-help" className="hidden" onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file && !disabled) onSelect(file);
          }} />
        <p id="shop-photo-help" className="text-xs leading-relaxed text-gray-600">JPEG, PNG or WebP · Up to 5 MB and 20 megapixels. Changes are published when you save.</p>
        {selectedFile && <p className="break-all text-xs font-medium text-gray-700">Selected: {selectedFile.name}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={disabled} aria-describedby="shop-photo-help" onClick={() => inputRef.current?.click()} className={styles.secondaryButton}>
            {shownImage ? "Change photo" : "Choose photo"}
          </button>
          {selectedFile && <button type="button" disabled={disabled} onClick={onCancel} className={styles.secondaryButton}>Cancel change</button>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </div>
    </section>
  );
}
