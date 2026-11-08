import { useEffect, useState } from 'react';

// Matches the minimum interval between emails to one address in Supabase Auth.
export const EMAIL_RESEND_SECONDS = 60;

export function getEmailSendError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  if (/email rate limit exceeded/i.test(error.message)) {
    return 'Too many emails have been sent recently. Please wait a few minutes and try again.';
  }
  return error.message || fallback;
}

// Supabase includes the remaining wait in its email rate-limit message.
export function getRetrySeconds(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/only request this after (\d+) seconds?/i);
  return match ? Number(match[1]) : null;
}

export function useRetryCountdown(initialSeconds = 0) {
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000);
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    // Calculate from a deadline so suspended/background tabs do not slow the countdown.
    const update = () => setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    const timer = window.setInterval(update, 250);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [deadline]);

  function start(secondsToWait: number) {
    setDeadline(Date.now() + secondsToWait * 1000);
    setSeconds(secondsToWait);
  }

  return { seconds, start };
}
