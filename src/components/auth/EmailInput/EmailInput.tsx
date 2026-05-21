// src/components/auth/EmailInput/EmailInput.tsx
import React, { useState } from 'react';

interface EmailInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
}

export const EmailInput: React.FC<EmailInputProps> = ({ value, onChange }) => {
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string) => {
    // Basic RFC standard-like email regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return 'Email is required.';
    }
    if (!emailRegex.test(email)) {
      return 'Please enter a valid university or personal email.';
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const validationError = validateEmail(newValue);
    setError(validationError);
    // Pass value and validation status up to the parent
    onChange(newValue, validationError === null && newValue.length > 0);
  };

  return (
    <div className="flex flex-col mb-4">
      <label className={`text-sm mb-2 ${error ? 'font-bold text-black' : 'font-semibold text-black'}`} htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        className={`px-4 py-3 text-base text-black bg-white rounded-none outline-none transition-all duration-200 ease-out ring-inset ${
          error ? 'ring-4 ring-black font-bold animate-shake' : 'ring-1 ring-gray-300 focus:ring-2 focus:ring-black'
        }`}
        placeholder="University or Personal Email"
        value={value}
        onChange={handleChange}
        onBlur={handleChange} // validate on blur as well
      />
      {error && <span className="mt-2 text-xs font-bold text-black">{error}</span>}
    </div>
  );
};
