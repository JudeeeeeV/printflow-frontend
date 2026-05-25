import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PaymentReviewPanelProps {
    isOpen: boolean;
    order: any | null;
    onClose: () => void;
    onVerify: (orderId: string, action: 'APPROVE' | 'REJECT', reason?: string) => Promise<void>;
    isVerifying: boolean;
}

export const PaymentReviewPanel: React.FC<PaymentReviewPanelProps> = ({ isOpen, order, onClose, onVerify, isVerifying }) => {
    const [rejectReason, setRejectReason] = React.useState('');

    // Reset reason when panel opens
    React.useEffect(() => {
        if (isOpen) {
            setRejectReason('');
        }
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && order && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/20 z-40"
                    />

                    {/* Slide-over Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="fixed top-0 right-0 h-full w-full max-w-sm bg-white z-50 overflow-y-auto flex flex-col border-l border-gray-200 shadow-xl"
                    >
                        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
                            <div>
                                <h3 className="text-2xl font-black text-gray-900">Review Payment</h3>
                                <p className="text-sm font-medium text-gray-500">Order #{order.id.slice(0, 8)}</p>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="flex-1 p-4 space-y-4">
                            <div className="bg-gray-50 p-3 border border-gray-200 rounded-sm flex justify-between items-center">
                                <p className="font-bold text-sm text-gray-500">Amount Due</p>
                                <p className="text-xl font-black text-gray-900">₱{order.total || 0}</p>
                            </div>

                            <div>
                                <p className="font-bold text-sm text-gray-900 mb-2">GCash Reference Number</p>
                                <div className="bg-white p-2 border border-gray-300 text-gray-800 font-mono text-base rounded-sm">
                                    {order.payment_receipts?.[0]?.reference_number || 'Not provided'}
                                </div>
                            </div>

                            <div>
                                <p className="font-bold text-sm text-gray-900 mb-3 flex items-center">
                                    <svg className="w-4 h-4 mr-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    Uploaded Receipt
                                </p>
                                {order.payment_receipts?.[0]?.receipt_url ? (
                                    <div className="border border-gray-200 rounded-sm overflow-hidden bg-gray-50">
                                        <img 
                                            src={order.payment_receipts[0].receipt_url} 
                                            alt="Payment Receipt" 
                                            className="w-full h-auto object-contain max-h-[400px]"
                                        />
                                    </div>
                                ) : (
                                    <div className="border border-dashed border-gray-300 p-4 text-center bg-gray-50 rounded-sm">
                                        <p className="text-sm text-gray-500 italic font-medium">No receipt image found.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200 mt-auto">
                            <button
                                onClick={() => onVerify(order.id, 'APPROVE')}
                                disabled={isVerifying}
                                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:pointer-events-none mb-4 rounded-sm flex items-center justify-center"
                            >
                                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                                Verify & Send to Production
                            </button>

                            <div className="space-y-2">
                                <label className="font-bold text-xs text-gray-700 flex items-center">
                                    <svg className="w-3.5 h-3.5 mr-1 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                    Reject Payment
                                </label>
                                <input 
                                    type="text" 
                                    placeholder="Optional reason (e.g. Blurry, Wrong Amount)" 
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    className="w-full p-2 border border-gray-300 rounded-sm focus:ring-1 focus:ring-black focus:border-transparent transition-all text-xs"
                                />
                                <button
                                    onClick={() => onVerify(order.id, 'REJECT', rejectReason)}
                                    disabled={isVerifying}
                                    className="w-full py-2 bg-white hover:bg-red-50 text-red-600 font-bold border border-red-200 hover:border-red-600 transition-colors disabled:opacity-50 disabled:pointer-events-none rounded-sm text-sm"
                                >
                                    Reject & Request New Receipt
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
