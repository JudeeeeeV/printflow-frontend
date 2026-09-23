import React from 'react';
import { Checkmark } from '@carbon/icons-react';

interface ProgressTimelineProps {
 currentStep: number;
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ currentStep }) => {
 const steps = [
 { label: 'Order placed', number: 1 },
 { label: 'Payment', number: 2 },
 { label: 'Printing', number: 3 },
 { label: 'Ready', number: 4 },
 ];
 const progress = Math.min(((currentStep - 1) / (steps.length - 1)) * 100, 100);

 return (
 <section aria-labelledby="order-progress-heading" className="border-y border-gray-300 bg-carbon-gray-10 px-4 py-5 sm:px-7">
 <div className="mb-4 flex items-center justify-between gap-4">
 <h3 id="order-progress-heading" className="text-xs font-bold uppercase tracking-[0.16em] text-carbon-gray-100">Order progress</h3>
 <span className="text-xs font-semibold text-gray-600">Step {currentStep} of {steps.length}</span>
 </div>
 <div className="relative">
 <div aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-4 h-1 bg-gray-300" />
 <div
 aria-hidden="true"
 className="absolute left-[12.5%] top-4 h-1 bg-carbon-blue-60 transition-[width] duration-300 motion-reduce:transition-none"
 style={{ width: `${progress * 0.75}%` }}
 />
 <ol className="relative grid grid-cols-4">
 {steps.map((step) => {
 const isComplete = step.number < currentStep;
 const isCurrent = step.number === currentStep;
 const isActive = step.number <= currentStep;

 return (
 <li key={step.number} aria-current={isCurrent ? 'step' : undefined} className="flex min-w-0 flex-col items-center text-center">
 <span className={`relative flex h-8 w-8 items-center justify-center border-2 text-xs font-black ${
 isCurrent
 ? 'border-carbon-blue-60 bg-carbon-blue-60 text-white shadow-[0_0_0_4px_rgba(15,98,254,0.16)]'
 : isComplete
 ? 'border-carbon-gray-100 bg-carbon-gray-100 text-white'
 : 'border-gray-400 bg-white text-gray-600'
 }`}>
 {isComplete ? <Checkmark aria-hidden="true" className="h-4 w-4" /> : step.number}
 </span>
 <span className={`mt-2 max-w-20 text-[11px] font-bold leading-tight sm:text-xs ${isActive ? 'text-carbon-gray-100' : 'text-gray-500'}`}>
 {step.label}
 </span>
 </li>
 );
 })}
 </ol>
 </div>
 </section>
 );
};
