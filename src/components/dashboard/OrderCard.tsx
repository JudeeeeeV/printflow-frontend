import React from 'react';
import { motion } from 'framer-motion';

interface OrderCardProps {
    order: any;
    onClick: () => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onClick }) => {
    const isPaymentPending = order.state === 'AWAITING_PAYMENT_VERIFICATION';
    
    // Determine the state badge configuration
    let badgeText = order.state;
    let badgeColor = 'bg-gray-100 text-gray-800';
    let isDisputed = false;
    
    switch (order.state) {
        case 'AWAITING_PAYMENT_VERIFICATION':
            badgeText = 'Payment Review Pending';
            badgeColor = 'bg-yellow-100 text-yellow-800 border border-yellow-300';
            break;
        case 'AWAITING_PAYMENT':
            badgeText = 'Awaiting Payment';
            badgeColor = 'bg-red-100 text-red-800';
            break;
        case 'OPEN_INQUIRY':
            badgeText = 'Pending Checkout';
            badgeColor = 'bg-blue-100 text-blue-800';
            break;
        case 'PROOF_APPROVED':
            badgeText = 'Proof Approved';
            badgeColor = 'bg-indigo-100 text-indigo-800';
            break;
        case 'IN_PRODUCTION':
            badgeText = 'In Production';
            badgeColor = 'bg-purple-100 text-purple-800';
            break;
        case 'READY_FOR_PICKUP':
            badgeText = 'Ready For Pickup';
            badgeColor = 'bg-green-100 text-green-800';
            break;
        case 'COMPLETED':
            badgeText = 'Completed';
            badgeColor = 'bg-gray-100 text-gray-800';
            break;
        case 'ESCALATED_DISPUTE':
            badgeText = 'Dispute Under Review';
            badgeColor = 'bg-blue-100 text-blue-800 border border-blue-300';
            isDisputed = true;
            break;
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            whileHover={{ scale: 1.01 }}
            onClick={onClick}
            className={`bg-white border rounded-sm p-3 shadow-none hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
                isPaymentPending ? 'border-yellow-300' : isDisputed ? 'border-blue-300' : 'border-gray-200'
            }`}
        >
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h4 className="font-black text-gray-900">Order #{order.id.slice(0, 8)}</h4>
                    <p className="text-xs text-gray-500 font-medium">Client ID: {order.client_id.slice(0, 8)}</p>
                </div>
                <div className={`px-2 py-1 text-[10px] font-bold rounded-sm ${badgeColor}`}>
                    {badgeText}
                </div>
            </div>
            
            <div className="flex gap-2 mb-3">
                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-[10px] font-bold rounded-sm border border-gray-200">
                    {order.paper_size || 'A4'}
                </span>
                {order.print_color_mode === 'COLOR' ? (
                    <span className="px-2 py-1 bg-indigo-500 text-white text-[10px] font-bold rounded-sm">
                        COLOR
                    </span>
                ) : (
                    <span className="px-2 py-1 bg-black text-white text-[10px] font-bold rounded-sm">
                        B&W
                    </span>
                )}
            </div>
            
            <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Total Amount:</span>
                    <span className="font-bold text-gray-900">₱{order.total || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium">Created:</span>
                    <span className="font-semibold text-gray-700">{new Date(order.created_at).toLocaleDateString()}</span>
                </div>
            </div>
            
            {order.assets && order.assets.length > 0 && (
                <div className="mb-4 text-sm flex justify-end">
                    <a 
                        href={order.assets[0].file_url} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Preview Document
                    </a>
                </div>
            )}

            {isPaymentPending && (
                <div className="mt-4 pt-3 border-t border-yellow-100">
                    <button className="w-full py-2 bg-yellow-50 text-yellow-700 font-bold text-xs rounded-sm hover:bg-yellow-100 transition-colors">
                        Review Payment
                    </button>
                </div>
            )}

            {isDisputed && (
                <div className="mt-4 pt-3 border-t border-blue-100">
                    <p className="w-full py-2 bg-blue-50 text-blue-700 font-bold text-[10px] text-center rounded-sm">
                        Platform Administration is reviewing this payment.
                    </p>
                </div>
            )}
        </motion.div>
    );
};
