import { getRetrySeconds, useRetryCountdown } from '../../../hooks/useRetryCountdown';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { authService, type RegisterPayload } from '../../../services/authService';
import { SubmitButton } from '../SubmitButton/SubmitButton';

export function EmailVerification({ registration, onBack, onSignIn, onVerified }: { registration: RegisterPayload; onBack: () => void; onSignIn: () => void; onVerified: () => void }) {
  const email = registration.email;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Enter the 8-digit code sent to your email. Check your spam folder too.');
  const { seconds: cooldown, start: startCooldown } = useRetryCountdown(60);
  const [rateLimited, setRateLimited] = useState(false);
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !/^[0-9]{8}$/.test(code)) return;
    setBusy(true); setError('');
    try {
      await authService.verifyEmail(registration, code);
      onVerified();
      setVerified(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Verification failed.'); }
    finally { setBusy(false); }
  }
  async function resend() {
    if (busy || cooldown > 0) return;
    setBusy(true); setError('');
    try {
      const result = await authService.resendCode(email);
      setMessage(result.message); setCode(''); startCooldown(60); setRateLimited(false);
    } catch (err) {
      const wait = getRetrySeconds(err);
      if (wait !== null) {
        startCooldown(wait); setRateLimited(true);
      } else {
        setError(err instanceof Error ? err.message : 'Could not send a code.');
      }
    }
    finally { setBusy(false); }
  }
  return (
    <>
      {verified && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-pointer" onClick={onSignIn} title="Click anywhere to continue" />
          <div className="relative bg-white w-full max-w-md shadow-2xl p-8 text-center ring-1 ring-inset ring-gray-300">
            <svg className="w-14 h-14 mx-auto mb-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-3xl font-bold text-carbon-gray-100 mb-2">You're all set!</h2>
            <p className="text-base text-gray-600 mb-8">
              Your email is verified and your PrintFlow account is ready.
            </p>
            <button type="button" onClick={onSignIn} className="w-full py-4 bg-carbon-gray-100 hover:bg-black text-white font-bold transition-all active:scale-95">
              Continue to sign in
            </button>
          </div>
        </div>,
        document.body
      )}
      <form onSubmit={verify} className="flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-bold text-carbon-gray-100 mb-2">Check your inbox</h2>
          <p className="text-base text-gray-600 mb-2">
            We sent an 8-digit code to <span className="font-bold">{email}</span>.
          </p>
          <p className="text-sm font-bold text-carbon-gray-100 mb-6">
            (If you don't see it, check your spam or junk folder)
          </p>
        </div>

        <div>
          <label htmlFor="email-code" className="block text-sm mb-2 font-semibold text-carbon-gray-100">
            Verification code
          </label>
          <input autoFocus id="email-code" type="text" inputMode="numeric" autoComplete="one-time-code" required
            pattern="[0-9]{8}" minLength={8} maxLength={8} value={code} disabled={busy}
            onChange={e => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
            aria-label="8-digit verification code"
            className="w-full py-4 text-center text-3xl font-bold tracking-[0.3em] text-carbon-gray-100 bg-white outline-none transition-all duration-200 ease-out ring-1 ring-inset ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 placeholder:text-gray-300 placeholder:font-normal" placeholder="00000000" />
          <p role="status" className="text-sm mt-3 text-gray-500">{message}</p>
        </div>

        {rateLimited && cooldown > 0 && <div role="timer" className="p-3 bg-white ring-1 ring-inset ring-gray-300 text-sm text-gray-500 font-medium">
          You can request another code in {cooldown} {cooldown === 1 ? 'second' : 'seconds'}.
        </div>}

        {error && <div role="alert" className="p-4 bg-white ring-4 ring-black text-carbon-gray-100 font-bold text-sm animate-shake">
          {error}
        </div>}

        <div className="flex flex-col gap-4 mt-2">
          <SubmitButton label="Verify Email" isLoading={busy} disabled={code.length !== 8 || busy} />

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm mt-2">
            <button type="button" disabled={busy || cooldown > 0} onClick={resend} className="font-bold text-carbon-gray-100 hover:text-carbon-blue-60 disabled:text-gray-400 transition-colors">
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            <button type="button" disabled={busy} onClick={onBack} className="font-bold text-carbon-gray-100 hover:text-carbon-blue-60 disabled:text-gray-400 transition-colors">
              Use different email
            </button>
          </div>
        </div>
      </form>
    </>);
}
