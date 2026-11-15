import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { Coordinates } from '../types';

interface DriverInsightsPanelProps {
    onClose: () => void;
    currentLocation: Coordinates;
}

export const DriverInsightsPanel: React.FC<DriverInsightsPanelProps> = ({ onClose, currentLocation }) => {
    const { t, isRTL } = useLanguage();
    const [insights, setInsights] = useState<any[]>([]);

    useEffect(() => {
        // Simulated AI insights generation
        const generateInsights = () => {
            return [
                {
                    id: 1,
                    type: 'priority',
                    icon: 'fa-fire',
                    color: 'text-red-500',
                    bg: 'bg-red-50',
                    title: isRTL ? 'طلب مرتفع جداً' : 'Very High Demand',
                    desc: isRTL ? 'يوجد طلب مرتفع على بعد ٢ كم. تحرك إلى هذه المنطقة لزيادة فرص الحصول على رحلات.' : 'High demand 2km away. Move to this area to increase ride opportunities.'
                },
                {
                    id: 2,
                    type: 'info',
                    icon: 'fa-chart-line',
                    color: 'text-blue-500',
                    bg: 'bg-blue-50',
                    title: isRTL ? 'وقت الذروة' : 'Peak Time',
                    desc: isRTL ? 'المنطقة الحالية تشهد زيادة ٣٥٪ في الطلب. أفضل وقت للعمل اليوم بين ٥ مساءً و ١٠ مساءً.' : 'Current area sees 35% more demand. Best working hours today are 5 PM to 10 PM.'
                },
                {
                    id: 3,
                    type: 'success',
                    icon: 'fa-wallet',
                    color: 'text-green-500',
                    bg: 'bg-green-50',
                    title: isRTL ? 'فرصة لزيادة الأرباح' : 'Earnings Opportunity',
                    desc: isRTL ? 'يمكنك زيادة أرباحك بنسبة ٢٠٪ بالتحرك إلى المنطقة المقترحة شرقاً.' : 'Increase your earnings by 20% by moving eastward to the suggested zone.'
                }
            ];
        };

        setInsights(generateInsights());
        
        const interval = setInterval(() => {
            setInsights(generateInsights());
        }, 120000);
        
        return () => clearInterval(interval);
    }, [isRTL]);

    return (
        <div className="fixed inset-0 z-[250] bg-white flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="pt-safe-top pb-4 px-6 bg-[#0F2B5B] text-white rounded-b-[40px] shadow-lg shrink-0">
                <div className="flex justify-between items-center mt-4">
                    <h2 className="text-2xl font-black">{isRTL ? 'رؤى الذكاء الاصطناعي' : 'Smart Insights'}</h2>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <p className="text-sm text-blue-200 mt-2 font-medium">
                    {isRTL ? 'توصيات مبنية على تحليل البيانات' : 'Data-driven recommendations'}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
                {insights.map((insight, idx) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        key={insight.id}
                        className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex gap-4"
                    >
                        <div className={`w-12 h-12 rounded-full ${insight.bg} flex items-center justify-center shrink-0`}>
                            <i className={`fas ${insight.icon} ${insight.color} text-xl`}></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg mb-1">{insight.title}</h3>
                            <p className="text-gray-500 text-sm leading-relaxed">{insight.desc}</p>
                        </div>
                    </motion.div>
                ))}

                <div className="mt-8 bg-blue-50/50 border border-blue-100 rounded-[24px] p-6 text-center">
                    <div className="text-blue-500 text-3xl mb-3"><i className="fas fa-robot"></i></div>
                    <h4 className="font-bold text-gray-800 mb-2">{isRTL ? 'يتم تحديث الرؤى تلقائياً' : 'Insights update automatically'}</h4>
                    <p className="text-xs text-gray-500 font-medium">
                        {isRTL ? 'نحن نراقب حركة الطلب لحظياً لنقدم لك أفضل التوصيات.' : 'We monitor demand in real-time to provide the best recommendations.'}
                    </p>
                </div>
            </div>
        </div>
    );
};
