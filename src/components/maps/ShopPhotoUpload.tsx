import { useEffect, useRef, useState } from "react";
import { apiClient } from "../../services/apiClient";
import { Image as ImageIcon, Upload } from "@carbon/icons-react";
import styles from "./Maps.module.css";

interface Props {
  photoUrl: string | null;
  onUploaded: (url: string | null) => void;
}

export function ShopPhotoUpload({ photoUrl, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const shownImage = file ? preview : photoUrl;

  const upload = async () => {
    if (!file || busyRef.current) return;
    busyRef.current = true;
    setUploading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.append("photo", file);
      const result = await apiClient<{ shop_photo_url: string | null }>(
        "/shops/me/photo",
        { method: "POST", body: form },
      );
      onUploaded(result.shop_photo_url);
      setFile(null);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage(
        result.shop_photo_url
          ? "Shop photo uploaded. Students can see it on your map pin."
          : "Photo saved, but the preview is unavailable. Reload this page to try again.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not upload the shop photo.",
      );
    } finally {
      busyRef.current = false;
      setUploading(false);
    }
  };

  return (
    <section
      aria-label="Shop storefront photo"
      className="min-w-0 border border-[#e0e0e0] bg-white"
    >
      <div className="flex items-center gap-3 border-b border-[#e0e0e0] px-5 py-4">
        <ImageIcon size={20} className="text-gray-600" />
        <h2 className="text-base font-semibold">Shop photo</h2>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-sm leading-relaxed text-gray-600">
          Help students recognize your storefront when they open your map pin.
        </p>
        <div className={styles.photoPreview}>
          {shownImage && shownImage !== failedImage ? (
            <img
              src={shownImage}
              alt={
                file
                  ? "Selected storefront photo preview"
                  : "Current shop storefront"
              }
              onError={() => setFailedImage(shownImage)}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="px-5 py-6 text-center text-gray-500">
              <ImageIcon size={32} className="mx-auto mb-3" />
              <p className="text-sm">
                {shownImage
                  ? "Preview unavailable. Choose another photo or refresh."
                  : "Add a storefront photo"}
              </p>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          id="shop-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          aria-label="Choose a storefront photo"
          aria-describedby="shop-photo-help"
          className="hidden"
          onChange={(event) => {
            const selected = event.target.files?.[0];
            setMessage("");
            setPreview(null);
            setFile(null);
            if (!selected) return;
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(
                selected.type,
              ) ||
              selected.size > 5 * 1024 * 1024 ||
              selected.size === 0
            ) {
              setMessage("Choose a JPEG, PNG or WebP image up to 5 MB.");
              event.target.value = "";
              return;
            }
            setFile(selected);
            setPreview(URL.createObjectURL(selected));
          }}
        />
        <p
          id="shop-photo-help"
          className="text-xs leading-relaxed text-gray-500"
        >
          JPEG, PNG or WebP · Up to 5 MB and 20 megapixels.
        </p>
        {file && (
          <p className="break-all text-xs font-medium text-gray-700">
            Selected: {file.name}
          </p>
        )}
        <div className={styles.photoActions}>
          <button
            type="button"
            disabled={uploading}
            aria-describedby="shop-photo-help"
            onClick={() => inputRef.current?.click()}
            className={styles.secondaryButton}
          >
            {shownImage ? "Change photo" : "Choose photo"}
          </button>
          <button
            type="button"
            disabled={!file || uploading}
            onClick={upload}
            className={styles.primaryButton}
          >
            <Upload size={18} />
            {uploading ? "Uploading…" : "Upload Photo"}
          </button>
        </div>
        <p className="text-xs leading-relaxed text-gray-500">
          Uploading publishes your photo immediately and replaces the previous
          one.
        </p>
        {message && (
          <p
            role="status"
            className="border-l-2 border-carbon-blue-60 bg-carbon-gray-10 p-3 text-sm text-gray-700"
          >
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
