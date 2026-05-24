import React from 'react';

interface OrderSummaryProps {
    estimate: { total: number; pageCount: number; basePrice: number; colorAdditive: number; } | null;
    isSubmitting: boolean;
    onSubmit: () => void;
    onSaveDraft: () => void;
    isReady: boolean;
    paperSize: string;
    pageCount: number;
    printColorMode: string;
    setPrintColorMode: (mode: string) => void;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({ estimate, isSubmitting, onSubmit, onSaveDraft, isReady, paperSize, pageCount, printColorMode, setPrintColorMode }) => {
    return (
        <div className="bg-white border-2 border-gray-100 p-6 flex flex-col min-h-[500px] h-fit">
            <h3 className="text-xl font-bold text-black mb-6">Order Summary</h3>

            <div className="mb-6 space-y-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Detected Paper Size</label>
                    <div className="w-full border-2 border-gray-200 p-2 rounded-sm bg-gray-50 text-gray-500 font-bold">
                        {paperSize === 'SHORT' ? 'Short (Letter)' : paperSize === 'LONG' ? 'Long (Legal)' : 'A4'}
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Color Mode</label>
                    <div className="flex bg-gray-100 p-1 rounded-sm">
                        <button
                            onClick={() => setPrintColorMode('BLACK_AND_WHITE')}
                            disabled={isSubmitting}
                            className={`flex-1 py-2 text-sm font-bold rounded-sm transition-all ${printColorMode === 'BLACK_AND_WHITE' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            B&W
                        </button>
                        <button
                            onClick={() => setPrintColorMode('COLOR')}
                            disabled={isSubmitting}
                            className={`flex-1 py-2 text-sm font-bold rounded-sm transition-all ${printColorMode === 'COLOR' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Color
                        </button>
                    </div>
                </div>
            </div>

            {estimate ? (
                <div className="flex-grow">
                    <div className="flex justify-between mb-2 text-sm text-gray-600 gap-2">
                        <span className="truncate">Base ({paperSize === 'SHORT' ? 'Short' : paperSize === 'LONG' ? 'Long' : 'A4'})</span>
                        <span className="whitespace-nowrap font-medium text-right">₱{estimate.basePrice.toFixed(2)} / pg</span>
                    </div>
                    <div className="flex justify-between mb-2 text-sm text-gray-600 gap-2">
                        <span className="truncate">Color ({printColorMode === 'COLOR' ? 'Color' : 'B&W'})</span>
                        <span className="whitespace-nowrap font-medium text-right">+ ₱{estimate.colorAdditive.toFixed(2)} / pg</span>
                    </div>
                    <div className="flex justify-between mb-4 text-sm text-gray-600 gap-2">
                        <span className="truncate">Pages</span>
                        <span className="whitespace-nowrap font-medium text-right">x {estimate.pageCount}</span>
                    </div>
                    <div className="border-t-2 border-black pt-4 mb-2 flex justify-between items-end">
                        <span className="font-bold text-lg">Total</span>
                        <span className="font-extrabold text-2xl text-black">₱{estimate.total.toFixed(2)}</span>
                    </div>
                </div>
            ) : (
                <div className="flex-grow flex items-center justify-center text-gray-400 text-sm text-center">
                    Select a shop and upload a file to view pricing.
                </div>
            )}

            <div className="mt-auto">
                <button
                    onClick={onSubmit}
                    disabled={!isReady || isSubmitting}
                    className="w-full bg-black text-white font-bold py-4 mb-3 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSubmitting ? 'PROCESSING...' : 'SUBMIT ORDER'}
                </button>
                <button
                    onClick={onSaveDraft}
                    disabled={!isReady || isSubmitting}
                    className="w-full border-2 border-black text-black font-bold py-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Save as Draft
                </button>

                <div className="mt-6 text-xs text-gray-500 flex flex-col gap-2 font-medium">
                    <p>✓ PrintFlow Quality Guarantee</p>
                    <p>🔒 Secure Payment Processing</p>
                </div>
            </div>
        </div>
    );
};