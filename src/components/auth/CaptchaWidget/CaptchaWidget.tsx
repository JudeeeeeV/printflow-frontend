import { useEffect, useRef, useState } from 'react';
import { TURNSTILE_SITE_KEY } from '../../../config/runtime';
import { captchaEnabled } from './useCaptcha';

const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface Turnstile {
  render(element: HTMLElement, options: {
    sitekey: string;
    size: 'flexible';
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: Turnstile }
}

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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!captchaEnabled) return;
    let active = true;
    let widgetId: string | undefined;
    loadTurnstile().then(() => {
      if (!active || !container.current || !window.turnstile) return;
      widgetId = window.turnstile.render(container.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size: 'flexible',
        callback: token => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      });
    }).catch(() => { if (active) setFailed(true); });
    return () => {
      active = false;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [onToken]);

  if (!captchaEnabled) return null;
  return (
    <div className="mb-4">
      <div ref={container} />
      {failed && <p role="alert" className="mt-2 text-sm text-gray-600">The security check could not load. Refresh the page and try again.</p>}
    </div>
  );
}
