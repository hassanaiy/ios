import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, ExternalLink, Check, Info, HelpCircle, ArrowRight, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Ride, Driver } from '../types';

interface InstaPayPaymentSheetProps {
  ride: Ride;
  driver: Driver;
  onConfirm: () => void;
  onClose: () => void;
  onHelp: () => void;
}

export const InstaPayPaymentSheet: React.FC<InstaPayPaymentSheetProps> = ({
  ride,
  driver,
  onConfirm,
  onClose,
  onHelp
}) => {
  const { t, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const instapayNumber = driver.instapayNumber || driver.phone || '';
  const qrValue = `instapay://pay?mobile=${instapayNumber}&amount=${ride.fare}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(instapayNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if ('vibrate' in navigator) navigator.vibrate(50);
  };

  const handleOpenInstaPay = () => {
    window.open(qrValue, '_blank');
  };

  const handlePaid = () => {
    setIsPaying(true);
    // Simulate a bit of processing then call onConfirm
    setTimeout(() => {
      setIsPaying(false);
      setShowSuccess(true);
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      setTimeout(() => {
        onConfirm();
      }, 2000);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFC90E] rounded-2xl flex items-center justify-center">
              <img src="https://img.icons8.com/color/48/bank-transfer.png" alt="InstaPay" className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">InstaPay Payment</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Premium Mobile Payment</p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Amount Card */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[28px] p-6 flex flex-col items-center border border-gray-100 dark:border-gray-800">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Amount</span>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-black text-gray-900 dark:text-white">{(ride.fare || 0).toLocaleString()}</span>
              <span className="text-lg font-bold text-gray-500">EGP</span>
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="absolute -inset-4 bg-gradient-to-r from-[#FFC90E]/20 to-[#FFD700]/20 rounded-[40px] blur-xl opacity-50 transition-opacity group-hover:opacity-100" />
              <div className="relative bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
                <QRCodeSVG 
                  value={qrValue} 
                  size={200}
                  level="H"
                  includeMargin={false}
                  imageSettings={{
                    src: "https://img.icons8.com/color/48/bank-transfer.png",
                    x: undefined,
                    y: undefined,
                    height: 40,
                    width: 40,
                    excavate: true,
                  }}
                />
              </div>
            </div>
            <p className="mt-4 text-xs font-bold text-gray-400 text-center max-w-[200px]">
              Scan this QR code using your InstaPay app to pay
            </p>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <Check size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Driver Name</p>
                  <p className="font-bold text-gray-900 dark:text-white">{driver.name}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Trip ID</p>
                <p className="font-mono text-[10px] font-bold text-gray-700 dark:text-gray-300">#{ride.id.slice(-8).toUpperCase()}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600">
                  <Info size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">InstaPay Number</p>
                  <p className="font-black text-gray-900 dark:text-white tracking-widest">{instapayNumber}</p>
                </div>
              </div>
              <button 
                onClick={handleCopy}
                className={`p-2 rounded-xl transition-all ${copied ? 'bg-green-50 text-green-600' : 'bg-gray-50 dark:bg-gray-700 text-gray-400 hover:text-gray-900'}`}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <button 
              onClick={handleOpenInstaPay}
              className="w-full h-14 bg-black dark:bg-white dark:text-black text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-black/10 active:scale-[0.98] transition-transform"
            >
              <ExternalLink size={18} />
              Open InstaPay App
            </button>
            
            <button 
              onClick={handlePaid}
              disabled={isPaying || showSuccess}
              className="w-full h-16 bg-[#FFC90E] text-black rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-lg shadow-yellow-400/20 active:scale-[0.98] transition-transform relative overflow-hidden disabled:opacity-70"
            >
              <AnimatePresence mode="wait">
                {isPaying ? (
                  <motion.div 
                    key="paying"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-5 h-5 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                    Processing Payment...
                  </motion.div>
                ) : showSuccess ? (
                  <motion.div 
                    key="success"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-2 text-green-700"
                  >
                    <Check className="w-6 h-6" strokeWidth={4} />
                    Payment Confirmed!
                  </motion.div>
                ) : (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3"
                  >
                    I Have Paid
                    <ArrowRight size={22} className={isRTL ? "rotate-180" : ""} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-center gap-6 pb-2">
            <button onClick={onHelp} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-500 transition-colors">
              <HelpCircle size={14} />
              Need Help?
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
