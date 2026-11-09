import React, { useEffect, useState } from 'react';

const TEXT_ENTRY = 'input:not([type=file],[type=checkbox],[type=radio],[type=button],[type=submit]),textarea';
const KEYBOARD_VIEWPORT_RATIO = 0.75;

interface MobileActionBarProps {
  total: number | null;
  summaryRef: React.RefObject<HTMLElement | null>;
  headingRef: React.RefObject<HTMLElement | null>;
  hidden?: boolean;
}

/** Below the two-column layout, keeps the order summary one tap away. */
export const MobileActionBar: React.FC<MobileActionBarProps> = ({ total, summaryRef, headingRef, hidden = false }) => {
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const summary = summaryRef.current;
    if (!summary || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setSummaryVisible(entry.isIntersecting), { threshold: 0.15 });
    observer.observe(summary);
    return () => observer.disconnect();
  }, [summaryRef]);

  useEffect(() => {
    const viewport = window.visualViewport;
    let focusedOnText = false;
    const update = () => {
      const shrunk = viewport ? viewport.height / window.innerHeight < KEYBOARD_VIEWPORT_RATIO : false;
      setKeyboardOpen(focusedOnText || shrunk);
    };
    const onFocusIn = (event: FocusEvent) => {
      focusedOnText = event.target instanceof Element && event.target.matches(TEXT_ENTRY);
      update();
    };
    const onFocusOut = () => {
      focusedOnText = false;
      update();
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    viewport?.addEventListener('resize', update);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      viewport?.removeEventListener('resize', update);
    };
  }, []);

  if (hidden || summaryVisible || keyboardOpen) return null;

  const reviewOrder = () => {
    const heading = headingRef.current;
    if (!heading) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-black bg-white px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(22,22,22,0.12)] xl:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-600">Estimated total</p>
          <p className="text-lg font-black text-carbon-gray-100">{total === null ? 'Add a file to see it' : `₱${total.toFixed(2)}`}</p>
        </div>
        <button
          type="button"
          onClick={reviewOrder}
          className="min-h-11 shrink-0 cursor-pointer bg-carbon-blue-60 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 motion-reduce:transition-none"
        >
          Review order
        </button>
      </div>
    </div>
  );
};
