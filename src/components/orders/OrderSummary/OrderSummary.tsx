import React from 'react';

interface OrderSummaryProps {
    estimate: { total: number; rushFee: number; estimatedDelivery: string } | null;
    isSubmitting: boolean;
    onSubmit: () => void;
    isReady: boolean;
}

export const OrderSummary: React.FC<OrderSummaryProps> = ({ estimate, isSubmitting, onSubmit, isReady }) => {
    return (
        <div className="bg-white border-2 border-gray-100 p-6 flex flex-col h-full">
            <h3 className="text-xl font-bold text-black mb-6">Order Summary</h3>

            {estimate ? (
                <div className="flex-grow">
                    <div className="flex justify-between mb-3 text-gray-600">
                        <span>A4 Poster Print</span>
                        <span>₱{(estimate.total - estimate.rushFee).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mb-6 text-gray-600">
                        <span>Rush Fee</span>
                        <span>₱{estimate.rushFee.toFixed(2)}</span>
                    </div>
                    <div className="border-t-2 border-black pt-4 mb-2 flex justify-between items-end">
                        <span className="font-bold text-lg">Total</span>
                        <span className="font-extrabold text-2xl text-black">₱{estimate.total.toFixed(2)}</span>
                    </div>
                    <p className="text-right text-xs text-gray-500 mb-8">
                        Estimated delivery: {estimate.estimatedDelivery}
                    </p>
                </div>
            ) : (
                <div className="flex-grow flex items-center justify-center text-gray-400 text-sm">
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
                    disabled={!isReady || isSubmitting}
                    className="w-full border-2 border-black text-black font-bold py-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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