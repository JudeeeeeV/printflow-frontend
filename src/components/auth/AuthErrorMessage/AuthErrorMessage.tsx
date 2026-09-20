import React from 'react';

interface AuthErrorMessageProps {
  message: string | null;
}

export const AuthErrorMessage: React.FC<AuthErrorMessageProps> = ({ message }) => (
  <div
    role="alert"
    aria-atomic="true"
    className="flex h-8 items-center overflow-x-hidden overflow-y-auto"
  >
    {message && (
      <p className="w-full text-xs font-semibold leading-4 text-red-600 animate-shake">
        {message}
      </p>
    )}
  </div>
);
