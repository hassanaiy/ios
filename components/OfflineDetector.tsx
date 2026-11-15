import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { Network } from '@capacitor/network';

export const OfflineDetector: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Initial check
    Network.getStatus().then((status) => {
      setIsOffline(!status.connected);
    }).catch(() => {
      setIsOffline(!navigator.onLine);
    });

    const handleWebOnline = () => setIsOffline(false);
    const handleWebOffline = () => setIsOffline(true);

    window.addEventListener('online', handleWebOnline);
    window.addEventListener('offline', handleWebOffline);

    let networkListener: any;
    Network.addListener('networkStatusChange', status => {
      setIsOffline(!status.connected);
    }).then(listener => {
      networkListener = listener;
    }).catch(e => console.warn('Capacitor Network Plugin error:', e));

    return () => {
      window.removeEventListener('online', handleWebOnline);
      window.removeEventListener('offline', handleWebOffline);
      if (networkListener) networkListener.remove();
    };
  }, []);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-red-600/90 backdrop-blur-md text-white px-4 py-3 shadow-lg flex items-center justify-center space-x-3"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="relative">
              <i className="fas fa-wifi text-xl opacity-50"></i>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 border-b-2 border-white -rotate-45"></div>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-wide">
                {isRTL ? 'لا يوجد اتصال بالإنترنت' : 'No Internet Connection'}
              </span>
              <span className="text-xs text-white/80">
                {isRTL ? 'في انتظار عودة الاتصال...' : 'Waiting for connection to return...'}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
