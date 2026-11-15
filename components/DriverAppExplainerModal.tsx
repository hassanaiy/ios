import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DriverAppExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyAsDriver: () => void;
  isRTL?: boolean;
}

export const DriverAppExplainerModal: React.FC<DriverAppExplainerModalProps> = ({
  isOpen,
  onClose,
  onApplyAsDriver,
  isRTL = true,
}) => {
  const [activeTab, setActiveTab] = useState<'driver' | 'requirements' | 'app'>('driver');
  const [workingHours, setWorkingHours] = useState<number>(8);

  if (!isOpen) return null;

  // Monthly income estimate based on working hours
  const calculateEstimate = (hours: number) => {
    // Average 1.6 trips per hour, 75 EGP net per trip, 26 working days
    const dailyTrips = Math.round(hours * 1.6);
    const dailyIncome = dailyTrips * 75;
    const monthlyIncome = Math.round(dailyIncome * 26);
    const bonus = hours >= 8 ? 2000 : hours >= 6 ? 1200 : 500;
    return {
      monthly: (monthlyIncome + bonus).toLocaleString('ar-EG'),
      monthlyEn: (monthlyIncome + bonus).toLocaleString('en-US'),
      dailyTrips,
      bonus: bonus.toLocaleString(isRTL ? 'ar-EG' : 'en-US'),
    };
  };

  const estimate = calculateEstimate(workingHours);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
        {/* Backdrop click */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col z-10 border border-gray-100"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Top Decorative Header */}
          <div className="relative bg-gradient-to-r from-[#4C1D95] via-[#6D28D9] to-[#7C3AED] p-5 text-white overflow-hidden shrink-0">
            {/* SVG Fluid Wave Accents (Matching Banner Aesthetic) */}
            <svg
              className="absolute -right-10 -bottom-10 w-64 h-64 text-white/10 pointer-events-none"
              viewBox="0 0 200 200"
              fill="currentColor"
            >
              <path d="M45.7,-64.1C58.3,-54.3,67,-40.4,72.2,-25.1C77.4,-9.7,79.1,7.2,74.5,22.7C69.9,38.2,59,52.3,45.3,62.2C31.6,72.2,15.8,78,-0.9,79.2C-17.6,80.5,-35.1,77.2,-49.3,67.7C-63.5,58.2,-74.3,42.5,-78.9,25.2C-83.6,7.8,-82,-11.2,-74.6,-27.1C-67.2,-43,-53.9,-55.8,-39.7,-65C-25.5,-74.3,-10.4,-80,3,-84.1C16.4,-88.3,33.1,-73.9,45.7,-64.1Z" transform="translate(100 100)" />
            </svg>

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
                  <i className="fas fa-taxi text-lg"></i>
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-pink-300">
                    {isRTL ? 'فرص كابتن وصلني' : 'WASLNY CAPTAIN OPPORTUNITY'}
                  </div>
                  <h2 className="text-xl font-black text-white leading-tight">
                    {isRTL ? 'انضم ككابتن & دليل التطبيق' : 'Join as Captain & App Guide'}
                  </h2>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors active:scale-95"
                aria-label="Close"
              >
                <i className="fas fa-times text-sm"></i>
              </button>
            </div>

            {/* Quick Highlight Pill */}
            <div className="mt-3 inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-yellow-300 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>{isRTL ? 'عمولة 0% أول 30 يوماً • سحب فوري عبر إنستاباي' : '0% Commission First 30 Days • Instant InstaPay Payouts'}</span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-100 bg-gray-50/80 p-1.5 gap-1.5 shrink-0">
            <button
              onClick={() => setActiveTab('driver')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'driver'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <i className="fas fa-id-card text-purple-600"></i>
              <span>{isRTL ? 'مزايا الكابتن' : 'Captain Perks'}</span>
            </button>

            <button
              onClick={() => setActiveTab('requirements')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'requirements'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <i className="fas fa-clipboard-check text-purple-600"></i>
              <span>{isRTL ? 'شروط التقديم' : 'How to Apply'}</span>
            </button>

            <button
              onClick={() => setActiveTab('app')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'app'
                  ? 'bg-white text-purple-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <i className="fas fa-mobile-alt text-purple-600"></i>
              <span>{isRTL ? 'عن التطبيق' : 'About App'}</span>
            </button>
          </div>

          {/* Modal Content Body */}
          <div className="p-5 overflow-y-auto space-y-5 text-gray-800 text-sm flex-1 hide-scrollbar">
            {/* TAB 1: DRIVER PERKS & EARNINGS */}
            {activeTab === 'driver' && (
              <div className="space-y-5 animate-fade-in">
                {/* Hero Illustration Image */}
                <div className="relative rounded-2xl overflow-hidden shadow-md aspect-[16/9] bg-purple-950">
                  <img
                    src="/assets/driver_banner_art_1791386105464.jpg"
                    alt="Waslny Driver Hero"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback if asset path is relative
                      (e.currentTarget as HTMLImageElement).src = '/driver_banner_art_1791386105464.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 text-white">
                    <span className="text-[11px] font-black tracking-wider uppercase text-yellow-300">
                      {isRTL ? 'كن شريك نجاح' : 'BE YOUR OWN BOSS'}
                    </span>
                    <h3 className="text-base sm:text-lg font-black leading-snug">
                      {isRTL
                        ? 'اربح دخلاً مجزياً مع مرونة كاملة في ساعات العمل'
                        : 'Earn flexible daily income with zero hassle'}
                    </h3>
                  </div>
                </div>

                {/* 4 Value Proposition Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-3.5 flex flex-col gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center text-sm shadow-sm">
                      <i className="fas fa-percentage"></i>
                    </div>
                    <div className="font-black text-gray-900 text-sm">
                      {isRTL ? 'عمولة 0% لأول شهر' : '0% Commission'}
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed">
                      {isRTL
                        ? 'كل ما تكسبه من رحلاتك يذهب لك بالكامل دون أي استقطاعات.'
                        : 'Keep 100% of trip fares for your first 30 days.'}
                    </div>
                  </div>

                  <div className="bg-pink-50/70 border border-pink-100 rounded-2xl p-3.5 flex flex-col gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-[#FF2E75] text-white flex items-center justify-center text-sm shadow-sm">
                      <i className="fas fa-wallet"></i>
                    </div>
                    <div className="font-black text-gray-900 text-sm">
                      {isRTL ? 'سحب فوري إنستاباي' : 'Instant Cashouts'}
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed">
                      {isRTL
                        ? 'استلم أرباحك يومياً بضغطة زر على محفظتك أو حساب إنستاباي.'
                        : 'Cash out daily to InstaPay, bank, or mobile wallet.'}
                    </div>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 flex flex-col gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shadow-sm">
                      <i className="fas fa-clock"></i>
                    </div>
                    <div className="font-black text-gray-900 text-sm">
                      {isRTL ? 'حرية وساعات مرنة' : 'Flexible Hours'}
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed">
                      {isRTL
                        ? 'افتح التطبيق وابدأ العمل في أي وقت يناسبك بدون التزام.'
                        : 'Drive whenever you want, part-time or full-time.'}
                    </div>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-3.5 flex flex-col gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shadow-sm">
                      <i className="fas fa-shield-alt"></i>
                    </div>
                    <div className="font-black text-gray-900 text-sm">
                      {isRTL ? 'دعم وأمان 24/7' : '24/7 Safety & SOS'}
                    </div>
                    <div className="text-xs text-gray-600 leading-relaxed">
                      {isRTL
                        ? 'فريق دعم فني مخصص للكباتن وزر استغاثة طوارئ مباشر.'
                        : 'Dedicated hotline and in-app SOS emergency shield.'}
                    </div>
                  </div>
                </div>

                {/* Interactive Monthly Earnings Calculator */}
                <div className="bg-gradient-to-br from-gray-900 to-purple-950 rounded-2xl p-4 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-purple-300">
                        {isRTL ? 'حاسبة الدخل التقديري' : 'ESTIMATED EARNINGS'}
                      </span>
                      <h4 className="font-black text-base text-white">
                        {isRTL ? 'كم تتوقع أن تربح شهرياً؟' : 'Expected Monthly Earnings'}
                      </h4>
                    </div>
                    <div className="text-right">
                      <div className="text-xl sm:text-2xl font-black text-yellow-400">
                        {isRTL ? `${estimate.monthly} ج.م` : `${estimate.monthlyEn} EGP`}
                      </div>
                      <div className="text-[10px] text-gray-400 font-semibold">
                        {isRTL ? `+ ${estimate.bonus} ج.م بونص` : `+ ${estimate.bonus} EGP Bonus`}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs font-semibold text-gray-300">
                      <span>{isRTL ? 'ساعات العمل اليومية:' : 'Daily hours:'}</span>
                      <span className="text-yellow-400 font-bold">
                        {isRTL ? `${workingHours} ساعات / يوم` : `${workingHours} hrs / day`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="3"
                      max="12"
                      step="1"
                      value={workingHours}
                      onChange={(e) => setWorkingHours(parseInt(e.target.value, 10))}
                      className="w-full accent-[#FF2E75] h-2 bg-gray-700 rounded-lg cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>3 {isRTL ? 'ساعات' : 'hrs'}</span>
                      <span>8 {isRTL ? 'ساعات (دوام كامل)' : 'hrs (Full-time)'}</span>
                      <span>12 {isRTL ? 'ساعة' : 'hrs'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: REQUIREMENTS & HOW TO APPLY */}
            {activeTab === 'requirements' && (
              <div className="space-y-5 animate-fade-in">
                <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                  <h3 className="font-black text-purple-950 text-base mb-1">
                    {isRTL ? 'خطوات التقديم البسيطة' : '3 Simple Steps to Start'}
                  </h3>
                  <p className="text-xs text-purple-700">
                    {isRTL
                      ? 'لا تستغرق عملية التقديم سوى 3 دقائق، ويتم تفعيل حسابك في 15 دقيقة!'
                      : 'Application takes 3 minutes, account approved in 15 mins!'}
                  </p>
                </div>

                {/* 3 Step Flow */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 text-sm">
                        {isRTL ? 'تجهيز المستندات الشخصية' : 'Personal Documents'}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {isRTL
                          ? 'بطاقة الرقم القومي سارية + رخصة قيادة خاصة أو مهنية سارية.'
                          : 'Valid National ID card + Valid driver’s license.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-pink-500 text-white font-black text-sm flex items-center justify-center shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 text-sm">
                        {isRTL ? 'بيانات وفحص المركبة' : 'Vehicle Details'}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {isRTL
                          ? 'رخصة السيارة (موديل 2012 فما فوق، نظيفة ومكيفة) أو سكوتر / موتوسيكل.'
                          : 'Vehicle registration (2012+ model, clean & AC) or scooter/motorcycle.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-black text-sm flex items-center justify-center shrink-0">
                      3
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 text-sm">
                        {isRTL ? 'التفعيل واستقبال أول رحلة' : 'Approval & First Ride'}
                      </h4>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {isRTL
                          ? 'مراجعة فورية من فريق العمل وتفعيل حسابك خلال دقائق، لتنطلق في أول رحلة!'
                          : 'Quick verification by support and instant activation to start earning!'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Vehicle Types Accepted */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2">
                  <div className="font-black text-gray-900 text-xs uppercase tracking-wide">
                    {isRTL ? 'الفئات المقبولة في وصلني:' : 'ACCEPTED VEHICLE CATEGORIES:'}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="bg-white px-3 py-1.5 rounded-xl border border-gray-200 font-bold text-gray-800 flex items-center gap-1.5">
                      <i className="fas fa-car text-blue-600"></i>
                      {isRTL ? 'سيدان اقتصادي' : 'Economy Sedan'}
                    </span>
                    <span className="bg-white px-3 py-1.5 rounded-xl border border-gray-200 font-bold text-gray-800 flex items-center gap-1.5">
                      <i className="fas fa-car-side text-purple-600"></i>
                      {isRTL ? 'كومفورت مريح' : 'Comfort Rides'}
                    </span>
                    <span className="bg-white px-3 py-1.5 rounded-xl border border-gray-200 font-bold text-gray-800 flex items-center gap-1.5">
                      <i className="fas fa-motorcycle text-amber-600"></i>
                      {isRTL ? 'سكوتر وموتوسيكل' : 'Scooter / Moto'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ABOUT WASLNY APP */}
            {activeTab === 'app' && (
              <div className="space-y-5 animate-fade-in">
                {/* App Features Illustration Image */}
                <div className="relative rounded-2xl overflow-hidden shadow-md aspect-[16/9] bg-purple-950">
                  <img
                    src="/assets/app_features_art_1791386122814.jpg"
                    alt="Waslny App Features"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/app_features_art_1791386122814.jpg';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 text-white">
                    <span className="text-[11px] font-black tracking-wider uppercase text-pink-400">
                      {isRTL ? 'تقنية تنقل ذكية' : 'SMART MOBILITY TECH'}
                    </span>
                    <h3 className="text-base sm:text-lg font-black leading-snug">
                      {isRTL
                        ? 'تطبيق وصلني: تجربة تنقل عصرية، آمنة ومريحة في مصر'
                        : 'Waslny: Modern, safe, and transparent rides across Egypt'}
                    </h3>
                  </div>
                </div>

                {/* Key App Highlights */}
                <div className="space-y-3">
                  <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                      <i className="fas fa-route"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 text-sm">
                        {isRTL ? 'توجيه ذكي وتتبع فوري' : 'Smart GPS Routing'}
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {isRTL
                          ? 'خوارزميات تحدد أسرع المسارات وتجنب الزحام، مع مشاركة الموقع مع الأسرة.'
                          : 'Live trip tracking with traffic-optimized routes and family share.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-600 flex items-center justify-center shrink-0">
                      <i className="fas fa-tags"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 text-sm">
                        {isRTL ? 'أسعار شفافة وعادلة' : 'Fair Transparent Fares'}
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {isRTL
                          ? 'تسعير واضح ومحدد مسبقاً بدون أي رسوم خفية، مع خصومات وعروض يومية.'
                          : 'Upfront pricing with zero hidden fees and continuous promotions.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <i className="fas fa-plane-departure"></i>
                    </div>
                    <div>
                      <h4 className="font-black text-gray-900 text-sm">
                        {isRTL ? 'خدمة المطار والمحافظات' : 'Airport & Long Distance'}
                      </h4>
                      <p className="text-xs text-gray-600 mt-0.5">
                        {isRTL
                          ? 'حجز سريع لرحلات مطار القاهرة وبرج العرب، وسيارات مخصصة للحقائب.'
                          : 'Dedicated airport transfers with luggage assistance and comfort cars.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Footer with Direct Apply CTA Button */}
          <div className="p-4 bg-white border-t border-gray-100 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            {/* Primary Action: Direct Driver Registration CTA */}
            <button
              onClick={() => {
                onClose();
                onApplyAsDriver();
              }}
              className="w-full sm:flex-1 py-3 px-6 bg-gradient-to-r from-[#FF2E75] to-[#FF4B8B] hover:from-[#E11D5F] hover:to-[#FF2E75] text-white font-black text-sm rounded-2xl shadow-lg shadow-pink-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-bolt"></i>
              <span>{isRTL ? 'ابدأ التقديم ككابتن الآن (تفعيل فوري)' : 'Apply as Captain Now (Instant)'}</span>
              <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} text-xs`}></i>
            </button>

            {/* Secondary Action: Close */}
            <button
              onClick={onClose}
              className="w-full sm:w-auto py-3 px-5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-2xl transition-colors active:scale-95"
            >
              {isRTL ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
