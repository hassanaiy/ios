import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export const SmallInfoBanner: React.FC = () => {
  const { isRTL, t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);

  const features = [
    {
      id: 'promo',
      icon: 'fa-bullhorn',
      title: t('daily_promos'),
      desc: t('ride_fast_safe'),
      color: 'bg-[#FFC90E]'
    },
    {
      id: 'safety',
      icon: 'fa-shield-halved',
      title: t('safety_sos'),
      desc: t('secure_live_tracking'),
      color: 'bg-[#FFC90E]'
    },
    {
      id: 'schedule',
      icon: 'fa-clock',
      title: t('scheduled_trips'),
      desc: t('always_arrive_on_time'),
      color: 'bg-blue-600',
      iconColor: 'text-white'
    },
    {
      id: 'speed',
      icon: 'fa-bolt',
      title: t('fast_response'),
      desc: t('nearest_captain_arrives'),
      color: 'bg-green-600',
      iconColor: 'text-white'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % features.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const feature = features[currentIndex];

  return (
    <div
      className="
        w-full
        max-w-[95%]
        mx-auto
        mt-2
        rounded-[24px]
        bg-white/90
        backdrop-blur-md
        shadow-sm
        border
        border-gray-100
        p-3
        flex
        items-center
        gap-3
        animate-fade-in
        transition-all
        duration-500
      "
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Icon Container */}
      <div className={`w-11 h-11 rounded-[18px] ${feature.color} flex items-center justify-center shrink-0 shadow-sm transition-transform duration-500`}>
        <i className={`fas ${feature.icon} ${feature.iconColor || 'text-black'} text-sm`}></i>
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <div key={`title-${currentIndex}`} className="text-[12px] font-black text-gray-900 leading-tight truncate animate-slide-up">
          {feature.title}
        </div>
        <div key={`desc-${currentIndex}`} className="text-[10px] font-bold text-gray-400 truncate animate-slide-up" style={{ animationDelay: '100ms' }}>
          {feature.desc}
        </div>
      </div>

      {/* Progress Indicators */}
      <div className="flex flex-col gap-1 px-1">
        {features.map((_, idx) => (
          <div 
            key={idx} 
            className={`w-1 h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-yellow-500 h-2' : 'bg-gray-200'}`}
          />
        ))}
      </div>
    </div>
  );
};