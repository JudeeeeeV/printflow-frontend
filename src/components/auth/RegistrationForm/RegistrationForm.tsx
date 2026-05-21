// src/components/auth/RegistrationForm/RegistrationForm.tsx
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { EmailInput } from '../EmailInput/EmailInput';
import { AccountTypeSelector, type AccountRole } from '../AccountTypeSelector/AccountTypeSelector';
import { SubmitButton } from '../SubmitButton/SubmitButton';
import { authService, type RegisterPayload } from '../../../services/authService';

export const RegistrationForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isEmailValid, setIsEmailValid] = useState(false);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [accountType, setAccountType] = useState<AccountRole>('Student');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isEmailValid) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: RegisterPayload = {
        email,
        passwordHash: password, // The backend handles bcrypt hashing
        role: accountType,
      };

      await authService.register(payload);

      // Setup successful
      setSuccess('Account created successfully! You can now log in.');

      // Optional: Store token and redirect
      // localStorage.setItem('jwt_token', response.token);
      // window.location.href = '/dashboard';

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Registration failed. Please try again.');
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col w-full" onSubmit={handleSubmit}>
      <div className="mb-5">
        <EmailInput value={email} onChange={(val, valid) => {
          setEmail(val);
          setIsEmailValid(valid);
        }} />
      </div>

      <div className="mb-5">
        <label className={`block text-sm mb-2 ${error && password.length < 8 ? 'font-bold text-black' : 'font-semibold text-black'}`} htmlFor="password">Password</label>
        <div className="relative flex items-center">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className={`w-full pl-4 pr-12 py-3 text-base text-black bg-white rounded-none outline-none transition-all duration-200 ease-out ring-inset ${
              error && password.length < 8 ? 'ring-4 ring-black font-bold animate-shake' : 'ring-1 ring-gray-300 focus:ring-2 focus:ring-black'
            }`}
            placeholder="Strong Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="absolute right-3 bg-transparent border-none text-black cursor-pointer flex items-center justify-center p-1 rounded-none transition-transform hover:scale-110 active:scale-95"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={20} strokeWidth={2.5} /> : <Eye size={20} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      <AccountTypeSelector
        selectedType={accountType}
        onChange={setAccountType}
      />

      {error && (
        <div className="mb-4 p-4 bg-white ring-4 ring-black text-black font-bold text-sm animate-shake">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-black text-white font-bold text-sm">
          {success}
        </div>
      )}

      <div className="mt-2">
        <SubmitButton
          label="Register Account"
          isLoading={isSubmitting}
          disabled={!email || !password || !isEmailValid}
        />
      </div>
    </form>
  );
};
