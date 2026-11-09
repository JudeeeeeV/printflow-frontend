import React, { useState } from 'react';

export const CheckNowButton: React.FC<{
  onRetry: () => Promise<void>;
  label?: string;
  className?: string;
}> = ({ onRetry, label = 'Check now', className = '' }) => {
  const [isChecking, setIsChecking] = useState(false);
  const check = () => {
    setIsChecking(true);
    void onRetry().finally(() => setIsChecking(false));
  };
  return (
    <button
      type="button"
      onClick={check}
      disabled={isChecking}
      className={`min-h-11 cursor-pointer bg-carbon-gray-100 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${className}`}
    >
      {isChecking ? 'Checking…' : label}
    </button>
  );
};

export const StaleStatusNotice: React.FC<{
  confirmedAt: number | null;
  isOffline?: boolean;
  onRetry: () => Promise<void>;
}> = ({ confirmedAt, isOffline = false, onRetry }) => (
  <div className="flex flex-col gap-3 border-l-4 border-amber-600 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status">
    <p className="min-w-0 break-words text-sm font-semibold text-amber-900">
      {isOffline ? "You're offline." : "We couldn't refresh this page."}
      {confirmedAt !== null &&
        ` Showing what we last confirmed at ${new Date(confirmedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}, which may be outdated.`}
    </p>
    <CheckNowButton onRetry={onRetry} className="shrink-0" />
  </div>
);
