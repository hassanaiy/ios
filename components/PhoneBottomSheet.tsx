
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface PhoneBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  phone?: string;
}

export default function PhoneBottomSheet({ isOpen, onClose, phone }: PhoneBottomSheetProps) {
  const url = phone 
    ? `/phone-login?phone=${encodeURIComponent(phone)}&embedded=true`
    : `/phone-login?embedded=true`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]"
          />
          
          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-[120] overflow-hidden flex flex-col shadow-2xl"
            style={{ height: '85vh' }}
          >
            {/* Handle */}
            <div className="w-full flex justify-center py-4 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Header */}
            <div className={`px-6 pb-4 flex items-center justify-between border-b border-gray-100`}>
              <button 
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
              <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Content - Iframe to PhoneLogin */}
            <div className="flex-1 w-full bg-gray-50 relative">
              <iframe 
                src={url}
                className="w-full h-full border-none"
                title="Phone Login"
                allow="camera; microphone; geolocation"
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
