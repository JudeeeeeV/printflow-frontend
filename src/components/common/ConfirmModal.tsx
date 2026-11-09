import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isBusy = false,
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const latest = useRef({ isBusy, onCancel });
  latest.current = { isBusy, onCancel };

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (isBusy) dialogRef.current?.focus();
    else cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !latest.current.isBusy) {
        event.preventDefault();
        latest.current.onCancel();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])",
        ) || [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      else document.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    };
  }, [isBusy, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        className="w-full max-w-md border-t-4 border-carbon-blue-60 bg-white shadow-2xl"
      >
        <div className="p-6 sm:p-7">
          <h2
            id="confirm-modal-title"
            className="text-xl font-black tracking-tight text-carbon-gray-100"
          >
            {title}
          </h2>
          <p
            id="confirm-modal-message"
            className="mt-3 break-words text-sm leading-relaxed text-gray-600"
          >
            {message}
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-gray-200">
          <button
            ref={cancelRef}
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            className="min-h-12 border-r border-gray-200 bg-white px-4 text-sm font-bold text-carbon-gray-100 transition-colors hover:bg-carbon-gray-10 disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={onConfirm}
            className="min-h-12 bg-carbon-gray-100 px-4 text-sm font-bold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isBusy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
