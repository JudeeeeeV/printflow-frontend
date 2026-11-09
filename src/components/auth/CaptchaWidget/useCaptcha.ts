import { useState } from 'react';
import { TURNSTILE_SITE_KEY } from '../../../config/runtime';

// Without a site key the forms work as before, so the code can deploy first.
export const captchaEnabled = Boolean(TURNSTILE_SITE_KEY);

export function useCaptcha() {
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  return {
    ready: !captchaEnabled || Boolean(token),
    widgetKey,
    setToken,
    // Tokens work once, so every request needs a fresh widget afterwards.
    take() {
      setToken(null);
      setWidgetKey(key => key + 1);
      return token ?? undefined;
    },
  };
}
