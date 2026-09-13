import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface AlertModalProps {
  isOpen: boolean;
  message: string;
  title?: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  onClose: () => void;
  onCloseAction?: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ 
  isOpen, 
  message, 
  title, 
  type = 'info', 
  onClose,
  onCloseAction
}) => {
  const handleClose = () => {
    onClose();
    if (onCloseAction) {
      onCloseAction();
    }
  };
  // Determine icon and colors based on type
  let Icon = null;
  let colorClass = '';
  
  switch(type) {
    case 'success':
      colorClass = 'text-green-500';
      Icon = (
        <svg className="w-10 h-10 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
      break;
    case 'error':
      colorClass = 'text-red-500';
      Icon = (
        <svg className="w-10 h-10 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
      break;
    case 'warning':
      colorClass = 'text-yellow-500';
      Icon = (
        <svg className="w-10 h-10 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
      break;
    case 'info':
    default:
      colorClass = 'text-blue-500';
      Icon = (
        <svg className="w-10 h-10 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
      break;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden p-6 text-center border border-gray-100"
          >
            <div className={colorClass}>
              {Icon}
            </div>
            
            {title && (
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {title}
              </h3>
            )}
            
            <p className="text-gray-600 mb-6 font-medium">
              {message}
            </p>
            
            <button
              onClick={handleClose}
              className="w-full bg-carbon-gray-100 hover:bg-black text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-sm"
            >
              Close
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
