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
          <div className="flex shrink-0 flex-col items-center leading-tight text-gray-600">
            <svg width="32" height="15" viewBox="0 6 24 11.6" aria-hidden="true">
              <path fill="#F38020" d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268z" />
              <path fill="#FAAE40" d="M19.2656 11.2813c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727z" />
            </svg>
            <div className="text-[9px] font-bold uppercase tracking-[0.12em]">Cloudflare</div>
          </div>
        </div>
      )}
    </div>
  );
}
