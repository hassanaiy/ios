import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPinOff, AlertTriangle, Settings, RefreshCw, Loader2 } from 'lucide-react';
import { useLocationMonitor } from '../hooks/useLocationMonitor';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { useLanguage } from '../contexts/LanguageContext';

interface LocationGuardProps {
    children: React.ReactNode;
    type: 'driver' | 'passenger';
    onOfflineForce?: () => void;
}

export const LocationGuard: React.FC<LocationGuardProps> = ({ children, type, onOfflineForce }) => {
    const { locationError, isChecking, checkStatus } = useLocationMonitor();
    const { isRTL } = useLanguage();
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        if (locationError) {
            Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
            if (type === 'driver' && onOfflineForce) {
                onOfflineForce();
            }
        }
    }, [locationError, type, onOfflineForce]);

    const handleOpenSettings = async () => {
        await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
        try {
            await NativeSettings.open({
                optionAndroid: AndroidSettings.Location,
                optionIOS: IOSSettings.App,
            });
            setTimeout(checkStatus, 3000);
        } catch (e) {
            console.error("Failed to open settings", e);
        }
    };

    const handleRetry = async () => {
        await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        setIsRetrying(true);
        await checkStatus();
        setTimeout(() => setIsRetrying(false), 800);
    };

    return (
        <>
            {children}

            <AnimatePresence>
                {/* Error State */}
                {locationError && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4"
                        dir={isRTL ? 'rtl' : 'ltr'}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 20, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-white/95 dark:bg-gray-900/95 shadow-2xl rounded-[32px] p-8 w-full max-w-sm relative overflow-hidden border border-white/20"
                        >
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-red-500/20 rounded-full blur-3xl pointer-events-none"></div>

                            <div className="relative z-10 flex flex-col items-center text-center">
                                <motion.div 
                                    className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 mb-6 relative"
                                    animate={ locationError === 'gps_disabled' ? {
                                        scale: [1, 1.05, 1],
                                        boxShadow: ["0px 0px 0px 0px rgba(220, 38, 38, 0)", "0px 0px 0px 20px rgba(220, 38, 38, 0.1)", "0px 0px 0px 0px rgba(220, 38, 38, 0)"]
                                    } : {
                                        x: [-5, 5, -5, 5, 0],
                                        transition: { duration: 0.4 }
                                    }}
                                    transition={{ repeat: locationError === 'gps_disabled' ? Infinity : 0, duration: 2 }}
                                >
                                    {locationError === 'gps_disabled' ? (
                                        <MapPinOff size={36} strokeWidth={2.5} />
                                    ) : (
                                        <AlertTriangle size={36} strokeWidth={2.5} />
                                    )}
                                </motion.div>

                                <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                                    {locationError === 'permission_denied' 
                                        ? (isRTL ? 'إذن الموقع مطلوب' : 'Location Permission Required')
                                        : (isRTL ? 'تفعيل خدمة الموقع (GPS)' : 'Enable Location Services (GPS)')}
                                </h2>
                                
                                <p className="text-gray-500 dark:text-gray-400 font-medium mb-8 leading-relaxed text-[15px]">
                                    {type === 'driver' 
                                        ? (isRTL 
                                            ? 'الموقع الجغرافي ضروري جداً لتفعيل وضع الاتصال، استقبال الطلبات ومشاركة مسارك الحي مع الركاب.'
                                            : 'Location access is strictly required to go online, receive ride requests, and share your live route with passengers.')
                                        : (isRTL
                                            ? 'لكي نتمكن من إرسال السائق إليك بكل دقة وتتبع مسار رحلتك بشكل مباشر، يرجى تفعيل الموقع.'
                                            : 'To accurately guide drivers to you and provide live tracking for your safety, please enable your location.')}
                                </p>

                                <div className="w-full space-y-3">
                                    <button
                                        onClick={handleOpenSettings}
                                        className="w-full h-14 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shadow-lg active:scale-95"
                                    >
                                        <Settings size={20} />
                                        {isRTL ? 'فتح الإعدادات' : 'Enable Location'}
                                    </button>
                                    
                                    <button
                                        onClick={handleRetry}
                                        disabled={isRetrying}
                                        className="w-full h-14 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-95 disabled:opacity-50"
                                    >
                                        <RefreshCw size={20} className={isRetrying ? 'animate-spin' : ''} />
                                        {isRTL ? 'المحاولة مرة أخرى' : 'Retry'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Loading State */}
                {!locationError && isChecking && (
                     <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[40] flex items-center gap-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-5 py-3 rounded-full shadow-lg border border-gray-200 dark:border-gray-800"
                        dir={isRTL ? 'rtl' : 'ltr'}
                    >
                        <Loader2 className="animate-spin text-[#1A73E8]" size={18} />
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {isRTL ? 'يتم تحديد الموقع...' : 'Detecting your location...'}
                        </span>
                     </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
