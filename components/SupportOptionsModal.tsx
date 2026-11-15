import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import {
  subscribeToAppSettings,
  DEFAULT_SUPPORT_WHATSAPP,
  formatWhatsAppUrl,
} from '../services/firebase';

interface SupportOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomerServiceChat: () => void;
  userName?: string;
  userPhone?: string;
}

export const SupportOptionsModal: React.FC<SupportOptionsModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomerServiceChat,
  userName,
  userPhone,
}) => {
  const { isRTL } = useLanguage();
  const [whatsappNumber, setWhatsappNumber] = useState<string>(DEFAULT_SUPPORT_WHATSAPP);

  useEffect(() => {
    const unsub = subscribeToAppSettings((settings) => {
      if (settings?.supportWhatsappNumber && settings.supportWhatsappNumber.trim()) {
        setWhatsappNumber(settings.supportWhatsappNumber.trim());
      } else {
        setWhatsappNumber(DEFAULT_SUPPORT_WHATSAPP);
      }
    });
    return () => unsub();
  }, []);

  const defaultGreeting = isRTL
    ? `مرحباً فريق دعم وصلني، معكم ${userName || 'عميل'}${userPhone ? ` (${userPhone})` : ''} وأحتاج للمساعدة.`
    : `Hello Waslny Support, this is ${userName || 'a user'}${userPhone ? ` (${userPhone})` : ''} and I need assistance.`;

  const whatsappUrl = formatWhatsAppUrl(whatsappNumber, defaultGreeting);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs"
          />

          {/* Modal / Sheet Card */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 w-full sm:max-w-md bg-white rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 sm:pb-6 shadow-2xl border border-gray-100"
          >
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg shadow-xs">
                  <i className="fas fa-headset"></i>
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">
                    {isRTL ? 'تحدث معنا - خدمة العملاء' : 'Contact Support'}
                  </h3>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    {isRTL
                      ? 'اختر طريقة التواصل المفضلة لديك مع فريق الدعم'
                      : 'Choose how you would like to reach our support team'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors active:scale-90"
              >
                <i className="fas fa-times text-sm"></i>
              </button>
            </div>

            {/* Two Support Options */}
            <div className="space-y-3">
              {/* Option 1: In-App Customer Service Live Chat */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectCustomerServiceChat();
                }}
                className="w-full p-4 rounded-2xl bg-gray-50 hover:bg-blue-50/70 border border-gray-200/80 hover:border-blue-300 transition-all flex items-center justify-between group active:scale-[0.99] text-start"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-xl shadow-md shadow-blue-600/20 shrink-0 group-hover:scale-105 transition-transform">
                    <i className="fas fa-comments"></i>
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-gray-900 text-sm sm:text-base group-hover:text-blue-700 transition-colors">
                      {isRTL ? 'محادثة خدمة العملاء' : 'Customer Service Chat'}
                    </div>
                    <div className="text-xs font-bold text-gray-500 mt-0.5 truncate">
                      {isRTL
                        ? 'محادثة فورية مباشرة داخل التطبيق مع الدعم الفني'
                        : 'Instant live chat with support inside the app'}
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors shrink-0">
                  <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-xs`}></i>
                </div>
              </button>

              {/* Option 2: Message on WhatsApp */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  setTimeout(() => onClose(), 150);
                }}
                className="w-full p-4 rounded-2xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200/80 hover:border-emerald-400 transition-all flex items-center justify-between group active:scale-[0.99] text-start"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center text-2xl shadow-md shadow-emerald-500/25 shrink-0 group-hover:scale-105 transition-transform">
                    <i className="fab fa-whatsapp"></i>
                  </div>
                  <div className="min-w-0">
                    <div className="font-black text-gray-900 text-sm sm:text-base group-hover:text-emerald-800 transition-colors">
                      {isRTL ? 'تواصل عبر واتساب' : 'Message on WhatsApp'}
                    </div>
                    <div
                      className="text-xs font-black text-emerald-700 mt-0.5 font-mono tracking-wide"
                      dir="ltr"
                    >
                      {whatsappNumber}
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                  <i className={`fas ${isRTL ? 'fa-external-link-alt' : 'fa-external-link-alt'} text-xs`}></i>
                </div>
              </a>
            </div>

            {/* Cancel Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs transition-colors active:scale-[0.99]"
            >
              {isRTL ? 'إغلاق' : 'Close'}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
