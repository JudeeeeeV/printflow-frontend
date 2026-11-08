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

// Hashed so a shared computer does not keep a readable list of email addresses.
function emailCooldownKey(purpose: string, email: string) {
  let hash = 0x811c9dc5;
  for (const character of email.trim().toLowerCase()) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 0x01000193);
  }
  return `printflow:email-cooldown:${purpose}:${(hash >>> 0).toString(36)}`;
}

// A convenience that survives reloads. Supabase enforces the real limit.
export function rememberEmailSent(purpose: string, email: string) {
  try {
    localStorage.setItem(emailCooldownKey(purpose, email), String(Date.now() + EMAIL_RESEND_SECONDS * 1000));
  } catch {
    // Storage can be blocked; the page timer still applies until a reload.
  }
}

export function getRemainingEmailCooldown(purpose: string, email: string): number {
  try {
    const key = emailCooldownKey(purpose, email);
    const remaining = Math.ceil((Number(localStorage.getItem(key)) - Date.now()) / 1000);
    if (remaining > 0) return Math.min(remaining, EMAIL_RESEND_SECONDS);
    localStorage.removeItem(key);
  } catch {
    // Storage can be blocked; treat this as no saved timer.
  }
  return 0;
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
