import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { Driver, DriverLevel } from '../types';

interface DriverRewardsPanelProps {
    driver: Driver;
    onClose: () => void;
}

export const DriverRewardsPanel: React.FC<DriverRewardsPanelProps> = ({ driver, onClose }) => {
    const { t, isRTL } = useLanguage();
    
    // Derived level (defaults to BRONZE if undefined)
    const level = driver.level || DriverLevel.BRONZE;
    
    // Simulated progress metrics
    const weeklyTrips = driver.totalRides || 42;
    const weeklyTarget = 50;
    
    const monthlyTrips = driver.totalRides || 142;
    const monthlyTarget = 200;

    const levelDetails: Record<DriverLevel, { color: string, bg: string, next: string, icon: string }> = {
        [DriverLevel.BRONZE]: { color: 'text-amber-700', bg: 'bg-amber-100', next: 'SILVER', icon: 'fa-medal' },
        [DriverLevel.SILVER]: { color: 'text-gray-500', bg: 'bg-gray-200', next: 'GOLD', icon: 'fa-medal' },
        [DriverLevel.GOLD]: { color: 'text-yellow-600', bg: 'bg-yellow-100', next: 'PLATINUM', icon: 'fa-trophy' },
        [DriverLevel.VIP]: { color: 'text-purple-600', bg: 'bg-purple-100', next: 'MAX', icon: 'fa-crown' },
    };

    const details = levelDetails[level as DriverLevel] || levelDetails[DriverLevel.BRONZE];

    return (
        <div className="fixed inset-0 z-[250] bg-gray-50 flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="pt-safe-top pb-6 px-6 bg-gradient-to-br from-gray-900 to-black text-white rounded-b-[40px] shadow-xl shrink-0 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mt-4 mb-6">
                        <h2 className="text-2xl font-black">{isRTL ? 'برنامج المكافآت' : 'Rewards Program'}</h2>
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={`w-16 h-16 rounded-full ${details.bg} flex items-center justify-center border-2 border-white/20`}>
                            <i className={`fas ${details.icon} text-3xl ${details.color}`}></i>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">{isRTL ? 'المستوى الحالي' : 'Current Level'}</p>
                            <h3 className="text-3xl font-black text-white">{level}</h3>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h4 className="font-bold text-gray-900 text-lg">{isRTL ? 'الهدف الأسبوعي' : 'Weekly Target'}</h4>
                            <p className="text-xs text-gray-500 font-medium">
                                {isRTL ? `أكمل ${weeklyTarget} رحلة أسبوعياً لاكتساب أولوية الظهور` : `Complete ${weeklyTarget} trips weekly to earn priority matching`}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-[#0F2B5B]">{weeklyTrips}</span>
                            <span className="text-gray-400 text-sm font-bold"> / {weeklyTarget}</span>
                        </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-gradient-to-r from-blue-500 to-[#0F2B5B]"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((weeklyTrips / weeklyTarget) * 100, 100)}%` }}
                            transition={{ duration: 1, delay: 0.2 }}
                        />
                    </div>
                </div>

                <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <h4 className="font-bold text-gray-900 text-lg">{isRTL ? 'الهدف الشهري' : 'Monthly Target'}</h4>
                            <p className="text-xs text-gray-500 font-medium">
                                {isRTL ? `تبقى ${Math.max(0, monthlyTarget - monthlyTrips)} رحلات للوصول إلى المستوى الذهبي` : `${Math.max(0, monthlyTarget - monthlyTrips)} trips left to reach Gold Level`}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-[#D4AF37]">{monthlyTrips}</span>
                            <span className="text-gray-400 text-sm font-bold"> / {monthlyTarget}</span>
                        </div>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-gradient-to-r from-yellow-400 to-[#D4AF37]"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((monthlyTrips / monthlyTarget) * 100, 100)}%` }}
                            transition={{ duration: 1, delay: 0.4 }}
                        />
                    </div>
                </div>

                <div className="pt-4">
                    <h3 className="font-black text-xl text-gray-900 mb-4 px-2">{isRTL ? 'المزايا القادمة' : 'Upcoming Benefits'}</h3>
                    <div className="space-y-3">
                        <div className="bg-white rounded-2xl p-4 flex gap-4 items-center shadow-sm border border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-green-50 text-green-500 flex items-center justify-center shrink-0">
                                <i className="fas fa-bolt"></i>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-sm">{isRTL ? 'أولوية الظهور' : 'Priority Matching'}</h4>
                                <p className="text-xs text-gray-500">{isRTL ? 'تستقبل الطلبات قبل السائقين الآخرين' : 'Receive requests before other drivers'}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 flex gap-4 items-center shadow-sm border border-gray-100">
                            <div className="w-10 h-10 rounded-full bg-yellow-50 text-[#D4AF37] flex items-center justify-center shrink-0">
                                <i className="fas fa-crown"></i>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 text-sm">{isRTL ? 'شارة التميز' : 'Excellence Badge'}</h4>
                                <p className="text-xs text-gray-500">{isRTL ? 'يظهر للركاب كمزود خدمة مميز' : 'Shown to passengers as a premium provider'}</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};
