import React, { useState } from 'react';
import { View, ViewOff, Checkmark } from '@carbon/icons-react';
import { EmailInput } from '../EmailInput/EmailInput';
import { SubmitButton } from '../SubmitButton/SubmitButton';
import { authService } from '../../../services/authService';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToLogin }) => {
  const [step, setStep] = useState<'email' | 'reset' | 'success'>('email');
  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isEmailValid) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.sendPasswordReset(email);
      setStep('reset');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Could not send reset code.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isSubmitting || cooldown > 0) return;
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      await authService.sendPasswordReset(email);
      setCooldown(60);
      setMessage('A new code has been sent to your email.');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Could not resend code.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
  
  const isPasswordStrong = hasLength && hasUpper && hasLower && hasNumber && hasSymbol;

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (code.length !== 8) {
      setError('Please enter the 8-digit verification code.');
      return;
    }

    if (!isPasswordStrong) {
      setError('Please meet all the new password requirements.');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword({ email, code, passwordHash: password });
      setStep('success');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Could not reset password.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="flex flex-col text-center">
        <svg className="w-14 h-14 mx-auto mb-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-3xl font-bold text-carbon-gray-100 mb-2">Password reset!</h2>
        <p className="text-base text-gray-600 mb-8">
          Your password has been successfully updated.
        </p>
        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full py-4 bg-carbon-gray-100 hover:bg-black text-white font-bold transition-all active:scale-95"
        >
          Return to sign in
        </button>
      </div>
    );
  }

  if (step === 'reset') {
    return (
      <form className="flex flex-col w-full" onSubmit={handleResetPassword}>
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-carbon-gray-100 mb-2">Reset password</h2>
          <p className="text-base text-gray-600 mb-2">
            We sent an 8-digit reset code to <span className="font-bold">{email}</span>.
          </p>
          <p className="text-sm font-bold text-carbon-gray-100">
            (If you don't see it, check your spam or junk folder)
          </p>
        </div>

        {message && (
          <div className="mb-4 p-4 bg-green-50 ring-1 ring-green-500 text-green-900 font-semibold text-sm">
            {message}
          </div>
        )}

        <div className="mb-5">
          <label htmlFor="reset-code" className="block text-sm mb-2 font-semibold text-carbon-gray-100">
            Verification code
          </label>
          <input
            autoFocus
            id="reset-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]{8}"
            minLength={8}
            maxLength={8}
            className={`w-full px-4 py-4 text-3xl font-bold tracking-[0.3em] text-center text-carbon-gray-100 bg-white outline-none transition-all duration-200 ease-out ring-inset ${
              error ? 'ring-4 ring-black animate-shake' : 'ring-1 ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60 placeholder:text-gray-300 placeholder:font-normal'
            }`}
            placeholder="00000000"
            value={code}
            disabled={isSubmitting}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
            aria-label="8-digit reset code"
          />
        </div>

        <div className="mb-6">
          <label className={`block text-sm mb-2 ${error ? 'font-bold text-carbon-gray-100' : 'font-semibold text-carbon-gray-100'}`} htmlFor="new-password">New Password</label>
          <div className="relative flex items-center">
            <input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              className={`w-full pl-4 pr-12 py-3 text-base text-carbon-gray-100 bg-white outline-none transition-all duration-200 ease-out ring-inset ${
                error ? 'ring-4 ring-black font-bold animate-shake' : 'ring-1 ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60'
              }`}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 bg-transparent border-none text-carbon-gray-100 cursor-pointer flex items-center justify-center p-1 transition-transform hover:scale-110 active:scale-95"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <ViewOff size={20} strokeWidth={2.5} /> : <View size={20} strokeWidth={2.5} />}
            </button>
          </div>
          
          {/* Password Strength Checker */}
          <div className="mt-3 bg-gray-50 p-3 text-sm space-y-1.5 border border-gray-100">
            <p className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wider">Password Requirements:</p>
            <div className={`flex items-center space-x-2 ${hasLength ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
               <Checkmark size={16} className={hasLength ? 'opacity-100' : 'opacity-30'} />
               <span>At least 8 characters long</span>
            </div>
            <div className={`flex items-center space-x-2 ${hasUpper ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
               <Checkmark size={16} className={hasUpper ? 'opacity-100' : 'opacity-30'} />
               <span>Contains an uppercase letter</span>
            </div>
            <div className={`flex items-center space-x-2 ${hasLower ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
               <Checkmark size={16} className={hasLower ? 'opacity-100' : 'opacity-30'} />
               <span>Contains a lowercase letter</span>
            </div>
            <div className={`flex items-center space-x-2 ${hasNumber ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
               <Checkmark size={16} className={hasNumber ? 'opacity-100' : 'opacity-30'} />
               <span>Contains a number</span>
            </div>
            <div className={`flex items-center space-x-2 ${hasSymbol ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
               <Checkmark size={16} className={hasSymbol ? 'opacity-100' : 'opacity-30'} />
               <span>Contains a special character</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-white ring-4 ring-black text-carbon-gray-100 font-bold text-sm animate-shake">
            {error}
          </div>
        )}

        <div className="mt-6">
          <SubmitButton
            label="Reset Password"
            isLoading={isSubmitting}
            disabled={!isPasswordStrong || code.length !== 8 || isSubmitting}
          />
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm mt-4">
            <button
              type="button"
              onClick={handleResend}
              disabled={isSubmitting || cooldown > 0}
              className="font-bold text-carbon-gray-100 hover:text-carbon-blue-60 disabled:text-gray-400 transition-colors"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            <button
              type="button"
              onClick={onBackToLogin}
              disabled={isSubmitting}
              className="font-bold text-gray-500 hover:text-carbon-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form className="flex flex-col w-full" onSubmit={handleSendCode}>
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-carbon-gray-100 mb-2">Forgot password?</h2>
        <p className="text-base text-gray-600">
          Enter your email and we'll send you a code to reset your password.
        </p>
      </div>

      <div className="mb-6">
        <EmailInput value={email} onChange={(val, valid) => {
          setEmail(val);
          setIsEmailValid(valid);
        }} />
      </div>

      {error && (
        <div className="mb-4 p-4 bg-white ring-4 ring-black text-carbon-gray-100 font-bold text-sm animate-shake">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-4 p-4 bg-green-50 ring-1 ring-green-500 text-green-900 font-semibold text-sm">
          {message}
        </div>
      )}

      <div className="mt-2 flex flex-col gap-3">
        <SubmitButton
          label="Send Reset Code"
          isLoading={isSubmitting}
          disabled={!email || !isEmailValid}
        />
        <button
          type="button"
          onClick={onBackToLogin}
          disabled={isSubmitting}
          className="w-full py-3 bg-transparent text-carbon-gray-100 font-bold transition-all hover:underline disabled:opacity-50"
        >
          Back to sign in
        </button>
      </div>
    </form>
  );
};
