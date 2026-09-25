import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { View, ViewOff } from '@carbon/icons-react';
import { AuthErrorMessage } from '../AuthErrorMessage/AuthErrorMessage';
import { EmailInput } from '../EmailInput/EmailInput';
import { SubmitButton } from '../SubmitButton/SubmitButton';
import { authService, type LoginPayload } from '../../../services/authService';
import { API_URL } from '../../../config/runtime';
import { ApiError } from '../../../services/apiClient';

interface LoginFormProps {
  onForgotPassword?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onForgotPassword }) => {
  const navigate = useNavigate(); // Initialize the router navigation hook

  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isEmailValid && !password) {
      setError('Please provide a password');
      return;
    }

    if (!isEmailValid || !password) {
      setError('Please provide a valid email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: LoginPayload = {
        email,
        passwordHash: password,
      };

      const response = await authService.login(payload);
      localStorage.setItem('user_role', response.user.roleTag);

      if (response.user.roleTag === 'Print Shop') {
        navigate('/shop-dashboard');
      } else {
        navigate('/new-order');
      }
    } catch (err: unknown) {
      if (
        !navigator.onLine ||
        (err instanceof ApiError && (err.status === 0 || err.status === 503))
      ) {
        setError('Connection unavailable. Check your internet and try again.');
      } else if (err instanceof Error) {
        setError(err.message || 'Invalid login credentials');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInvalidCredentials =
    error === 'Invalid login credentials' ||
    Boolean(error && /invalid (login )?credentials/i.test(error)) ||
    error === 'Invalid email or password.';

  const hasEmailError = isInvalidCredentials || (!isEmailValid && error !== null);
  const hasPasswordError = isInvalidCredentials || (!password && error !== null);

  return (
    <form className="flex flex-col w-full" onSubmit={handleSubmit}>
      <button
        type="button"
        disabled={isSubmitting || isMicrosoftLoading}
        onClick={() => {
          setIsMicrosoftLoading(true);
          localStorage.removeItem('user_role');
          window.location.assign(`${API_URL}/auth/microsoft`);
        }}
        className="flex min-h-12 w-full items-center justify-center gap-3 border border-gray-400 bg-white px-4 py-3 text-sm font-semibold text-carbon-gray-100 transition-colors hover:bg-carbon-gray-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-wait disabled:opacity-60"
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 21 21">
          <path fill="#f25022" d="M1 1h9v9H1z" />
          <path fill="#7fba00" d="M11 1h9v9h-9z" />
          <path fill="#00a4ef" d="M1 11h9v9H1z" />
          <path fill="#ffb900" d="M11 11h9v9h-9z" />
        </svg>
        {isMicrosoftLoading ? 'Opening Microsoft…' : 'Continue with Microsoft'}
      </button>
      <div className="my-5 flex items-center gap-3 text-xs text-gray-500">
        <span className="h-px flex-1 bg-gray-200" />
        <span>or sign in with email</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="mb-5">
        <EmailInput
          value={email}
          hasError={hasEmailError}
          onChange={(val, valid) => {
            setEmail(val);
            setIsEmailValid(valid);
            if (error) setError(null);
          }}
        />
      </div>

      <div>
        <label
          className={`block text-sm mb-2 ${hasPasswordError ? 'font-bold text-carbon-gray-100' : 'font-semibold text-carbon-gray-100'}`}
          htmlFor="login-password"
        >
          Password
        </label>
        <div className="relative flex items-center">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            className={`w-full pl-4 pr-12 py-3 text-base text-carbon-gray-100 bg-white outline-none transition-all duration-200 ease-out ring-inset ${
              hasPasswordError
                ? 'ring-4 ring-black font-bold animate-shake'
                : 'ring-1 ring-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-carbon-blue-60'
            }`}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
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
        {onForgotPassword && (
          <div className="mt-2 flex justify-start">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm font-semibold text-carbon-blue-60 hover:text-carbon-blue-70 transition-colors"
            >
              Forgot password?
            </button>
          </div>
        )}
      </div>

      <AuthErrorMessage message={error} />

      <div className="mt-4">
        <SubmitButton
          label="Sign In"
          isLoading={isSubmitting || isMicrosoftLoading}
        />
      </div>
    </form>
  );
};

