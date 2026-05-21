// src/components/auth/SubmitButton/SubmitButton.tsx
import React from 'react';

interface SubmitButtonProps {
  label: string;
  isLoading: boolean;
  disabled?: boolean;
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  label,
  isLoading,
  disabled = false,
}) => {
  return (
    <button
      type="submit"
      className={`w-full py-4 px-6 text-base font-bold transition-all duration-300 ease-out flex justify-center items-center ring-inset ring-2 ring-black ${
        isLoading 
          ? 'bg-white text-black' 
          : 'bg-black text-white hover:bg-white hover:text-black active:scale-95'
      } disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:bg-black disabled:hover:text-white`}
      disabled={isLoading || disabled}
    >
      {isLoading ? (
        <span className="flex items-center gap-3">
          <span className="w-5 h-5 border-2 border-black border-r-transparent rounded-full animate-spin"></span>
          <span className="animate-pulse">Processing...</span>
        </span>
      ) : (
        label
      )}
    </button>
  );
};
