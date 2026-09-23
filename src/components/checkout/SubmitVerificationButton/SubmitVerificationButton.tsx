import React from 'react';

interface SubmitVerificationButtonProps {
 onSubmit: () => void;
 isSubmitting: boolean;
 disabled: boolean;
}

export const SubmitVerificationButton: React.FC<SubmitVerificationButtonProps> = ({ onSubmit, isSubmitting, disabled }) => {
 return (
 <button
 type="button"
 onClick={onSubmit}
 disabled={disabled || isSubmitting}
 aria-busy={isSubmitting}
 className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 bg-carbon-blue-60 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-carbon-blue-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-carbon-blue-60 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
 >
 {isSubmitting && <span aria-hidden="true" className="h-5 w-5 animate-spin border-2 border-white border-t-transparent motion-reduce:animate-none" />}
 {isSubmitting ? 'Submitting receipt...' : 'Submit for verification'}
 </button>
 );
};
