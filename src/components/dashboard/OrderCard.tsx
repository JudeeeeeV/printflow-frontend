import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface OrderCardProps {
 order: any;
 onClick: () => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onClick }) => {
 const [isPreviewOpen, setIsPreviewOpen] = useState(false);
 const isPaymentPending = order.state === 'AWAITING_PAYMENT_VERIFICATION';
 
 // Determine the state badge configuration
 let badgeText = order.state;
 let badgeColor = 'bg-gray-100 text-gray-800';
 let isDisputed = false;
 
 switch (order.state) {
 case 'AWAITING_PAYMENT_VERIFICATION':
 badgeText = 'Payment Review Pending';
 badgeColor = 'bg-gray-200 text-carbon-gray-100 font-bold';
 break;
 case 'AWAITING_PAYMENT':
 badgeText = 'Awaiting Payment';
 badgeColor = 'bg-gray-100 text-gray-600';
 break;
 case 'OPEN_INQUIRY':
 badgeText = 'Pending Checkout';
 badgeColor = 'bg-gray-100 text-gray-600';
 break;
 case 'PROOF_APPROVED':
 badgeText = 'Proof Approved';
 badgeColor = 'bg-gray-200 text-carbon-gray-100';
 break;
 case 'IN_PRODUCTION':
 badgeText = 'In Production';
 badgeColor = 'bg-gray-200 text-carbon-gray-100';
 break;
 case 'READY_FOR_PICKUP':
 badgeText = 'Ready For Pickup';
 badgeColor = 'bg-carbon-gray-100 text-white';
 break;
 case 'COMPLETED':
 badgeText = 'Completed';
 badgeColor = 'bg-gray-100 text-gray-500';
 break;
 case 'ESCALATED_DISPUTE':
 badgeText = 'Dispute Under Review';
 badgeColor = 'bg-gray-200 text-carbon-gray-100 border border-gray-400';
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
 className={`bg-white border border-[#e0e0e0] p-4 hover:border-[#8d8d8d] hover:shadow-md cursor-pointer transition-all duration-200`}
 >
 <div className="flex justify-between items-start mb-3">
 <div>
 <h4 className="font-black text-carbon-gray-100">Order #{order.id.slice(0, 8)}</h4>
 <p className="text-xs text-gray-500 font-medium">Client ID: {order.client_id.slice(0, 8)}</p>
 </div>
 <div className={`px-2 py-1 text-[10px] font-bold ${badgeColor}`}>
 {badgeText}
 </div>
 </div>
 
 <div className="flex gap-2 mb-3">
 <span className="px-2 py-1 bg-gray-100 text-gray-800 text-[10px] font-bold border border-[#e0e0e0]">
 {order.paper_size || 'A4'}
 </span>
 {order.print_color_mode === 'COLOR' ? (
 <span className="px-2 py-1 bg-gray-200 text-carbon-gray-100 text-[10px] font-bold border border-gray-300">
 COLOR
 </span>
 ) : (
 <span className="px-2 py-1 bg-carbon-gray-100 text-white text-[10px] font-bold">
 B&W
 </span>
 )}
 </div>
 
 <div className="space-y-2 mb-4">
 <div className="flex justify-between text-sm">
 <span className="text-gray-500 font-medium">Total Amount:</span>
 <span className="font-bold text-carbon-gray-100">₱{order.total || 0}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-gray-500 font-medium">Created:</span>
 <span className="font-semibold text-gray-700">{new Date(order.created_at).toLocaleDateString()}</span>
 </div>
 </div>
 
 {order.assets && order.assets.length > 0 && (
 <div className="mb-4 text-sm flex justify-end">
 <button 
 onClick={(e) => {
 e.stopPropagation();
 setIsPreviewOpen(true);
 }}
 className="text-gray-600 hover:text-carbon-gray-100 font-bold flex items-center gap-1 transition-colors"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
 Preview Document
 </button>
 </div>
 )}

 {isPaymentPending && (
 <div className="mt-4 pt-3 border-t border-[#e0e0e0]">
 <button className="w-full py-2.5 bg-carbon-gray-100 text-white font-bold text-xs hover:bg-black transition-colors">
 Review Payment
 </button>
 </div>
 )}

 {isDisputed && (
 <div className="mt-4 pt-3 border-t border-[#e0e0e0]">
 <p className="w-full py-2 bg-gray-100 text-gray-600 font-bold text-[10px] text-center uppercase tracking-wider">
 Administration Reviewing Payment
 </p>
 </div>
 )}

 {/* Document Preview Modal */}
 {isPreviewOpen && order.assets && order.assets.length > 0 && (
 <div 
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
 onClick={(e) => {
 e.stopPropagation();
 setIsPreviewOpen(false);
 }}
 >
 <div 
 className="bg-white w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex justify-between items-center p-4 border-b border-[#e0e0e0]">
 <h3 className="font-bold text-carbon-gray-100">Document Preview</h3>
 <button 
 onClick={(e) => {
 e.stopPropagation();
 setIsPreviewOpen(false);
 }}
 className="text-gray-500 hover:text-carbon-gray-100"
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
 </button>
 </div>
 <div className="flex-1 bg-carbon-gray-10 relative">
 <iframe 
 src={order.assets[0].file_url} 
 className="w-full h-full border-none"
 title="Document Preview"
 />
 </div>
 </div>
 </div>
 )}
 </motion.div>
 );
};
