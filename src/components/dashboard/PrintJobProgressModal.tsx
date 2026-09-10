import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface PrintJobProgressModalProps {
 isOpen: boolean;
 onClose: () => void;
 jobs: { orderId: string; status: string }[];
}

export const PrintJobProgressModal: React.FC<PrintJobProgressModalProps> = ({
 isOpen,
 onClose,
 jobs,
}) => {
 if (!isOpen) return null;

 return (
 <AnimatePresence>
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
 <motion.div
 initial={{ opacity: 0, scale: 0.95, y: 10 }}
 animate={{ opacity: 1, scale: 1, y: 0 }}
 exit={{ opacity: 0, scale: 0.95, y: 10 }}
 className="bg-white w-full max-w-md overflow-hidden flex flex-col"
 >
 <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-carbon-gray-10">
 <h3 className="text-xl font-black text-carbon-gray-100">Batch Spooling Progress</h3>
 <button
 onClick={onClose}
 className="text-gray-400 hover:text-gray-600 transition-colors p-1"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <div className="p-6 max-h-[60vh] overflow-y-auto flex flex-col gap-3">
 {jobs.length === 0 ? (
 <p className="text-gray-500 text-center font-medium">No jobs in current batch.</p>
 ) : (
 jobs.map((job) => (
 <div key={job.orderId} className="flex justify-between items-center p-3 bg-white border border-[#e0e0e0] ">
 <span className="font-bold text-gray-700 text-sm">Order #{job.orderId.substring(0, 8)}...</span>
 <span className={`text-xs font-bold px-2 py-1 ${
 job.status === 'COMPLETED' || job.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
 job.status === 'FAILED' ? 'bg-gray-200 text-carbon-gray-100' :
 'bg-blue-100 text-blue-700 animate-pulse'
 }`}>
 {job.status}
 </span>
 </div>
 ))
 )}
 </div>
 
 <div className="p-4 border-t border-gray-100 bg-carbon-gray-10">
 <button
 onClick={onClose}
 className="w-full py-2.5 bg-gray-200 text-gray-800 font-bold hover:bg-gray-300 transition-colors"
 >
 Dismiss
 </button>
 </div>
 </motion.div>
 </div>
 </AnimatePresence>
 );
};
