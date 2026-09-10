import React from 'react';

interface SubmitVerificationButtonProps {
 onSubmit: () => void;
 isSubmitting: boolean;
 disabled: boolean;
}

export const SubmitVerificationButton: React.FC<SubmitVerificationButtonProps> = ({ onSubmit, isSubmitting, disabled }) => {
 return (
 <button
 onClick={onSubmit}
 disabled={disabled || isSubmitting}
 className="w-full bg-carbon-blue-60 text-white font-bold py-4 hover:bg-carbon-blue-70 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
 >
 {isSubmitting ? (
 <>
 <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin"></div>
 VERIFYING...
 </>
 ) : (
 'SUBMIT FOR VERIFICATION'
 )}
 </button>
 );
};
