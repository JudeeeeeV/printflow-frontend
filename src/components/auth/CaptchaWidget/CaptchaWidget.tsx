import { useEffect, useRef, useState } from 'react';
import { CheckmarkOutline, WarningAlt } from '@carbon/icons-react';
import { TURNSTILE_SITE_KEY } from '../../../config/runtime';
import { captchaEnabled } from './useCaptcha';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface Turnstile {
  render(element: HTMLElement, options: {
    sitekey: string;
    theme: 'light';
    appearance: 'interaction-only';
    size: 'normal' | 'compact';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
    'timeout-callback': () => void;
    'before-interactive-callback': () => void;
    'after-interactive-callback': () => void;
  }): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: Turnstile }
}

type CaptchaStatus = 'verifying' | 'verified' | 'interactive' | 'failed';

const STATUS_TEXT: Record<Exclude<CaptchaStatus, 'interactive'>, string> = {
  verifying: 'Verifying…',
  verified: 'Verification successful',
  failed: 'The security check failed. Refresh the page and try again.',
};

let loadingScript: Promise<void> | null = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  loadingScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadingScript = null;
      script.remove();
      reject(new Error('The security check could not load.'));
    };
    document.head.appendChild(script);
  });
  return loadingScript;
}

export function CaptchaWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<CaptchaStatus>('verifying');

  useEffect(() => {
    if (!captchaEnabled) return;
    let active = true;
    let widgetId: string | undefined;
    const clearToken = (next: CaptchaStatus) => {
      onToken(null);
      setStatus(next);
    };
    loadTurnstile().then(() => {
      if (!active || !container.current || !window.turnstile) return;
      // Cloudflare's own box only appears when a visitor must interact with it.
      widgetId = window.turnstile.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'light',
        appearance: 'interaction-only',
        // The normal widget is a fixed 300px, which overflows the smallest phones.
        size: container.current.clientWidth < 300 ? 'compact' : 'normal',
        callback: token => {
          onToken(token);
          setStatus('verified');
        },
        'expired-callback': () => clearToken('verifying'),
        'error-callback': () => clearToken('failed'),
        'timeout-callback': () => clearToken('failed'),
        'before-interactive-callback': () => setStatus('interactive'),
        'after-interactive-callback': () => setStatus('verifying'),
      });
    }).catch(() => { if (active) setStatus('failed'); });
    return () => {
      active = false;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [onToken]);

  if (!captchaEnabled) return null;
  return (
    <div className="mb-4">
      <div ref={container} />
      {status !== 'interactive' && (
        <div role="status" className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2 shadow-sm">
          <div className="flex min-w-0 items-center gap-3 text-sm text-carbon-gray-100">
            {status === 'verified' && <CheckmarkOutline size={24} className="shrink-0 text-[#24a148]" aria-hidden="true" />}
            {status === 'failed' && <WarningAlt size={24} className="shrink-0 text-gray-600" aria-hidden="true" />}
            {status === 'verifying' && <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-carbon-blue-60 motion-reduce:animate-none" aria-hidden="true" />}
            <span>{STATUS_TEXT[status]}</span>
          </div>
          <div className="shrink-0 text-right leading-tight text-gray-600">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em]">Cloudflare</div>
            <div className="text-xs">Turnstile</div>
          </div>
        </div>
      )}
    </div>
  );
}
