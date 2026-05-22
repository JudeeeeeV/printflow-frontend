import React from 'react';

interface ProgressTimelineProps {
    currentStep: number;
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ currentStep }) => {
    const steps = [
        { label: 'Order Placed', number: 1 },
        { label: 'Awaiting Payment', number: 2 },
        { label: 'Printing', number: 3 },
        { label: 'Ready', number: 4 }
    ];

    return (
        <div className="w-full py-4 relative">
            <div className="absolute left-0 top-8 w-full h-1 bg-gray-200 z-0"></div>
            <div 
                className="absolute left-0 top-8 h-1 bg-black z-0 transition-all duration-500"
                style={{ width: `${Math.min(((currentStep - 1) / (steps.length - 1)) * 100, 100)}%` }}
            ></div>
            
            <div className="flex items-center justify-between relative z-10">
                {steps.map((step) => {
                    const isActive = step.number <= currentStep;
                    const isCurrent = step.number === currentStep;
                    
                    return (
                        <div key={step.number} className="flex flex-col items-center w-24">
                            <div className="relative w-8 h-8 mb-2">
                                {isCurrent && (
                                    <div className="absolute inset-0 rounded-full bg-black/20 animate-ping"></div>
                                )}
                                <div 
                                    className={`relative z-10 w-full h-full rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${
                                        isActive ? 'bg-black text-white shadow-md' : 'bg-gray-200 text-gray-500'
                                    }`}
                                >
                                    {step.number}
                                </div>
                            </div>
                            <span className={`text-xs font-bold text-center mt-1 ${isActive ? 'text-black' : 'text-gray-400'}`}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
