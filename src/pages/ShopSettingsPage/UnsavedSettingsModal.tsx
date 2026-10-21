import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Close } from '@carbon/icons-react';
import styles from '../../components/maps/Maps.module.css';

interface Props {
  busy: boolean;
  feedback: string;
  onDismiss: () => void;
  onLeave: () => void;
  onSave: () => void;
}

export function UnsavedSettingsModal({ busy, feedback, onDismiss, onLeave, onSave }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    const scroller = document.querySelector<HTMLElement>('[data-shop-scroll]');
    const previousBodyOverflow = document.body.style.overflow;
    const previousScrollOverflow = scroller?.style.overflow;
    document.body.style.overflow = 'hidden';
    if (scroller) scroller.style.overflow = 'hidden';
    dialog.showModal();
    saveRef.current?.focus();
    return () => {
      dialog.close();
      const anotherDialog = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
      document.body.style.overflow = previousBodyOverflow === 'hidden' && !anotherDialog ? '' : previousBodyOverflow;
      if (scroller) scroller.style.overflow = previousScrollOverflow || '';
      const restoreTarget = trigger instanceof HTMLElement && trigger.isConnected && !trigger.closest('[inert]')
        ? trigger : document.querySelector<HTMLElement>('button[aria-label="Open navigation"], #shop-main-content');
      restoreTarget?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (busy) dialogRef.current?.focus();
    else (feedback ? feedbackRef : saveRef).current?.focus();
  }, [feedback, busy]);

  return createPortal(
    <dialog ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto border border-black bg-white p-0 text-carbon-gray-100 shadow-xl backdrop:bg-black/50"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) onDismiss(); return; }
        if (event.key !== 'Tab') return;
        event.stopPropagation();
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); dialogRef.current?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      onCancel={event => { event.preventDefault(); if (!busy) onDismiss(); }}
      onClick={event => {
        if (busy || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onDismiss();
      }}>
      <header className="flex items-center justify-between gap-3 border-b border-gray-200 p-4">
        <h2 id={titleId} className="text-xl font-bold">Unsaved changes</h2>
        <button type="button" disabled={busy} aria-label="Keep editing shop settings" onClick={onDismiss} className={styles.iconButton}><Close size={20} aria-hidden="true" /></button>
      </header>
      <div className="space-y-3 p-4">
        <p id={descriptionId} className="text-sm leading-relaxed text-gray-600">You have unsaved changes to your shop settings. Save your changes before leaving?</p>
        {feedback && <p ref={feedbackRef} tabIndex={-1} role="alert" className="text-sm text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-carbon-blue-60">{feedback}</p>}
        {busy && <p role="status" className="text-sm text-gray-600">Saving changes before leaving...</p>}
      </div>
      <footer className="flex flex-col gap-2 border-t border-gray-200 p-4 sm:flex-row">
        <button type="button" disabled={busy} onClick={onLeave} className={`${styles.secondaryButton} sm:flex-1`}>Leave without Saving</button>
        <button ref={saveRef} type="button" disabled={busy} onClick={onSave} className={`${styles.primaryButton} sm:flex-1`}>Save Changes</button>
      </footer>
    </dialog>, document.body,
  );
}
