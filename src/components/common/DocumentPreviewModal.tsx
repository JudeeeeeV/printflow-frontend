import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Close } from '@carbon/icons-react';
import { useDialogFocus } from './useDialogFocus';
import { useProtectedFile } from './useProtectedFile';

interface DocumentPreviewModalProps {
  /** Null while the caller is still fetching a fresh signed URL. */
  url: string | null;
  title: string;
  error?: string;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ url, title, error, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const file = useProtectedFile(url);
  useDialogFocus(dialogRef, true, onClose);
  const failure = error || (file.status === 'failed' ? 'This file could not be previewed. Close and try again.' : '');

  // React bubbles portal clicks to the owning card, which would activate it.
  return createPortal(
    <div
      className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4"
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-document-preview
        className="flex h-[85dvh] w-full max-w-5xl flex-col overflow-hidden bg-white text-carbon-gray-100 shadow-2xl focus:outline-hidden"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-300 p-4">
          <h2 className="min-w-0 break-words text-base font-bold">{title}</h2>
          <button type="button" aria-label="Close preview" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-600 transition-colors hover:bg-carbon-gray-10 hover:text-carbon-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none">
            <Close size={24} aria-hidden="true" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-carbon-gray-10">
          {failure ? (
            <p role="alert" className="p-6 text-center text-sm text-gray-600">{failure}</p>
          ) : file.status !== 'ready' ? (
            <p role="status" className="p-6 text-center text-sm text-gray-600">Loading preview…</p>
          ) : file.kind === 'image' ? (
            <img src={file.objectUrl} alt={title} className="h-full w-full object-contain" />
          ) : (
            <iframe src={file.objectUrl} title={title} tabIndex={-1} className="h-full w-full border-none" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
