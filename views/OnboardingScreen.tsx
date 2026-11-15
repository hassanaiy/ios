import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import {
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Car,
  Navigation,
  Gift,
  Compass,
  Banknote,
  Package,
  Plus,
  Minus,
} from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { isRTL, language, setLanguage } = useLanguage();
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);
  const [simulatedFare, setSimulatedFare] = useState<number>(65);
  const [simulatedEta, setSimulatedEta] = useState<number>(3);
  const [simulatedPoints, setSimulatedPoints] = useState<number>(150);

  // Cycle active spotlight card-by-card automatically
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCardIndex((prev) => (prev + 1) % 3);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  // Internal micro-animations inside cards (fare negotiation, live ETA, reward points)
  useEffect(() => {
    const fareValues = [65, 70, 75, 70];
    let step = 0;
    const timer = setInterval(() => {
      step = (step + 1) % fareValues.length;
      setSimulatedFare(fareValues[step]);
      setSimulatedEta((prev) => (prev === 2 ? 3 : 2));
      setSimulatedPoints((prev) => (prev >= 250 ? 150 : prev + 25));
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const handleNavigateToAuth = () => {
    try {
      localStorage.setItem('mowasla_onboarding_completed', 'true');
      sessionStorage.setItem('mowasla_start_dismissed', 'true');
    } catch {}
    onComplete();
  };

  const ChevronIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <div
      className="fixed inset-0 z-[999] overflow-hidden flex flex-col justify-between w-full h-[100dvh] select-none font-sans"
      style={{
        background: 'linear-gradient(165deg, #0b1930 0%, #0e2240 52%, #081223 100%)',
        paddingTop: 'max(1rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
      }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.18, 1],
            opacity: [0.22, 0.36, 0.22],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-16 -left-16 w-72 h-72 rounded-full blur-[90px]"
          style={{ background: 'linear-gradient(135deg, #FF1E68, #9333EA)' }}
        />
        <motion.div
          animate={{
            scale: [1, 1.22, 1],
            opacity: [0.18, 0.32, 0.18],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-1/3 -right-20 w-80 h-80 rounded-full blur-[100px]"
          style={{ background: 'linear-gradient(135deg, #26C6DA, #3B82F6)' }}
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.16, 0.3, 0.16],
          }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute -bottom-20 left-1/4 w-72 h-72 rounded-full blur-[95px]"
          style={{ background: 'linear-gradient(135deg, #FFB300, #F97316)' }}
        />
      </div>

      {/* Top Bar: Language Toggle, Title & Skip Button */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 w-full max-w-md mx-auto px-5 pt-2 flex items-center justify-between"
      >
        {/* Language Toggle */}
        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="h-9 px-3.5 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 backdrop-blur-md border border-white/15 text-white/90 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <span>{language === 'en' ? 'العربية' : 'EN'}</span>
        </button>

        {/* Center App Title */}
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-black text-base sm:text-lg tracking-tight">
              {isRTL ? 'مزايا مواصلة' : 'Mowasla Smart'}
            </span>
            <span className="w-2 h-2 rounded-full bg-[#26C6DA] animate-ping" />
          </div>
          <span className="text-[11px] font-semibold text-white/55">
            {isRTL ? 'كل ما تحتاجه في تطبيق واحد' : 'All App Features in One Place'}
          </span>
        </div>

        {/* Top Skip Button -> Navigates to Auth Page */}
        <button
          type="button"
          onClick={handleNavigateToAuth}
          className="h-9 px-4 rounded-full bg-white/12 hover:bg-white/20 active:scale-95 backdrop-blur-md border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-1 transition-all shadow-sm cursor-pointer"
        >
          <span>{isRTL ? 'تخطي' : 'Skip'}</span>
          <ChevronIcon className="w-3.5 h-3.5 opacity-80" />
        </button>
      </motion.div>

      {/* Center Stack: Single-Page Animated Gradient Feature Cards (Show Card by Card) */}
      <div className="relative z-20 flex-1 w-full max-w-md mx-auto px-6 pr-8 rtl:pr-6 rtl:pl-8 flex flex-col justify-center gap-4 my-auto">
        {/* CARD 1: Animated Rose -> Magenta -> Violet Gradient - Smart Fare Negotiation */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: activeCardIndex === 0 ? 1.02 : 0.985,
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{
            opacity: { duration: 0.5, delay: 0.1 },
            y: { type: 'spring', stiffness: 260, damping: 22, delay: 0.1 },
            scale: { duration: 0.35 },
            backgroundPosition: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
          }}
          onClick={() => setActiveCardIndex(0)}
          className="relative w-full rounded-[26px] p-4 sm:p-5 text-white cursor-pointer select-none border border-white/20"
          style={{
            backgroundImage: 'linear-gradient(125deg, #FF1E68 0%, #EC4899 28%, #9333EA 56%, #F43F5E 80%, #FF1E68 100%)',
            backgroundSize: '300% 300%',
            boxShadow:
              activeCardIndex === 0
                ? '0 20px 42px -8px rgba(236, 72, 153, 0.58), inset 0 1px 1px rgba(255, 255, 255, 0.4)'
                : '0 10px 24px -6px rgba(236, 72, 153, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
          }}
        >
          {/* Floating liquid aurora gradient blobs + light sheen inside card */}
          <div className="overflow-hidden rounded-[26px] absolute inset-0 pointer-events-none">
            <motion.div
              animate={{
                x: ['-15%', '45%', '-15%'],
                y: ['-20%', '25%', '-20%'],
                scale: [1, 1.25, 1],
              }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-10 -left-10 w-44 h-44 rounded-full blur-2xl opacity-55"
              style={{ background: 'radial-gradient(circle, #FB7185 0%, #A855F7 65%, transparent 100%)' }}
            />
            <motion.div
              animate={{
                x: ['20%', '-35%', '20%'],
                y: ['15%', '-25%', '15%'],
                scale: [1.1, 0.9, 1.1],
              }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-10 right-4 w-40 h-40 rounded-full blur-2xl opacity-50"
              style={{ background: 'radial-gradient(circle, #22D3EE 0%, #EC4899 70%, transparent 100%)' }}
            />
            <motion.div
              animate={{ x: ['-120%', '220%'] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.4 }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/22 to-transparent -skew-x-12"
            />
          </div>

          {/* Top Row: Live Animated Price & Dual-Circle Chip */}
          <div className="relative z-10 flex items-start justify-between mb-2.5">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/85">
                {isRTL ? 'حدد سعرك بنفسك' : 'Name Your Own Fare'}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={simulatedFare}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.22 }}
                    className="text-2xl sm:text-[26px] font-black tracking-tight tabular-nums"
                  >
                    {simulatedFare} {isRTL ? 'ج.م' : 'EGP'}
                  </motion.span>
                </AnimatePresence>

                {/* Animated +/- mini controls inside card */}
                <div className="flex items-center gap-1 bg-black/20 backdrop-blur-xs px-2 py-0.5 rounded-full border border-white/20">
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center"
                  >
                    <Minus className="w-2.5 h-2.5 text-white" />
                  </motion.span>
                  <span className="text-[10px] font-extrabold px-0.5">
                    {isRTL ? 'تفاوض حر' : 'Flexible'}
                  </span>
                  <motion.span
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: 0.9 }}
                    className="w-4 h-4 rounded-full bg-[#26C6DA] flex items-center justify-center"
                  >
                    <Plus className="w-2.5 h-2.5 text-slate-950" />
                  </motion.span>
                </div>
              </div>
            </div>

            {/* Dual Overlapping Circles Badge (matching reference image) */}
            <div className="flex items-center shrink-0 mt-0.5" dir="ltr">
              <motion.div
                animate={{ x: [0, 2, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#06B6D4] to-[#67E8F9] opacity-95 shadow-sm"
              />
              <motion.div
                animate={{ x: [0, -2, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-6 h-6 rounded-full bg-[#26C6DA]/70 -ml-2.5 border border-white/35"
              />
            </div>
          </div>

          {/* Middle Row: Animated Dotted Track & Feature Chips */}
          <div className="relative z-10 my-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-xs rounded-full px-3 py-1 border border-white/20">
              <Banknote className="w-3.5 h-3.5 text-[#67E8F9]" />
              <span className="text-[11px] font-bold">
                {isRTL ? 'عروض فورية من الكباتن' : 'Instant Captain Offers'}
              </span>
            </div>
            <div className="flex items-center gap-1 opacity-85 tracking-widest text-xs font-mono" dir="ltr">
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
              >
                ••••
              </motion.span>
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
              >
                ••••
              </motion.span>
            </div>
          </div>

          {/* Bottom Row: Card Footer Metadata */}
          <div className="relative z-10 flex items-center justify-between text-[11px] font-semibold text-white/90 pt-1">
            <span>{isRTL ? 'بدون أوقات ذروة إجبارية' : 'No Forced Surge Pricing'}</span>
            <span className="font-mono font-bold bg-black/20 px-2 py-0.5 rounded-md border border-white/10">
              {isRTL ? 'وفر 30%' : 'SAVE 30%'}
            </span>
          </div>

          {/* Protruding Side Circular Button (Animated Cyan-Blue gradient) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.94 }}
            onClick={(e) => {
              e.stopPropagation();
              handleNavigateToAuth();
            }}
            aria-label={isRTL ? 'استكشف' : 'Explore'}
            className={`absolute top-1/2 -translate-y-1/2 ${
              isRTL ? '-left-4' : '-right-4'
            } w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-[#0e2240] z-20 cursor-pointer`}
            style={{
              background: 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
              boxShadow: '0 6px 18px rgba(34, 211, 238, 0.6)',
            }}
          >
            <ChevronIcon className="w-5 h-5 stroke-[2.5]" />
          </motion.button>
        </motion.div>

        {/* CARD 2: Animated Cyan -> Electric Blue -> Emerald Aurora Gradient - Safe Rides & Live GPS */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: activeCardIndex === 1 ? 1.02 : 0.985,
            backgroundPosition: ['100% 50%', '0% 50%', '100% 50%'],
          }}
          transition={{
            opacity: { duration: 0.5, delay: 0.32 },
            y: { type: 'spring', stiffness: 260, damping: 22, delay: 0.32 },
            scale: { duration: 0.35 },
            backgroundPosition: { duration: 6.5, repeat: Infinity, ease: 'easeInOut' },
          }}
          onClick={() => setActiveCardIndex(1)}
          className="relative w-full rounded-[26px] p-4 sm:p-5 text-white cursor-pointer select-none border border-white/25"
          style={{
            backgroundImage: 'linear-gradient(125deg, #22D3EE 0%, #06B6D4 28%, #3B82F6 56%, #14B8A6 80%, #22D3EE 100%)',
            backgroundSize: '300% 300%',
            boxShadow:
              activeCardIndex === 1
                ? '0 20px 42px -8px rgba(34, 211, 238, 0.58), inset 0 1px 1px rgba(255, 255, 255, 0.45)'
                : '0 10px 24px -6px rgba(6, 182, 212, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
          }}
        >
          {/* Floating liquid aurora gradient blobs + light sheen inside card */}
          <div className="overflow-hidden rounded-[26px] absolute inset-0 pointer-events-none">
            <motion.div
              animate={{
                x: ['10%', '-40%', '10%'],
                y: ['-15%', '30%', '-15%'],
                scale: [1, 1.25, 1],
              }}
              transition={{ duration: 6.8, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-10 right-2 w-44 h-44 rounded-full blur-2xl opacity-55"
              style={{ background: 'radial-gradient(circle, #60A5FA 0%, #6366F1 70%, transparent 100%)' }}
            />
            <motion.div
              animate={{
                x: ['-20%', '35%', '-20%'],
                y: ['20%', '-20%', '20%'],
                scale: [1.05, 0.9, 1.05],
              }}
              transition={{ duration: 7.2, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-10 -left-4 w-44 h-44 rounded-full blur-2xl opacity-50"
              style={{ background: 'radial-gradient(circle, #34D399 0%, #06B6D4 70%, transparent 100%)' }}
            />
            <motion.div
              animate={{ x: ['-120%', '220%'] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 1.1, repeatDelay: 1.4 }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/24 to-transparent -skew-x-12"
            />
          </div>

          {/* Top Row: Live GPS ETA & Dual-Circle Chip */}
          <div className="relative z-10 flex items-start justify-between mb-2.5">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                {isRTL ? 'رحلات آمنة وتتبع مباشر' : 'Safe Rides & Live GPS'}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-2xl sm:text-[26px] font-black tracking-tight tabular-nums">
                  {simulatedEta} {isRTL ? 'دقائق' : 'Mins'}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/20 border border-white/25 text-[10px] font-extrabold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FF1E68] animate-ping" />
                  <span>{isRTL ? 'تتبع حي' : 'Live Map'}</span>
                </span>
              </div>
            </div>

            {/* Dual Overlapping Circles Badge (Rose Pink on Cyan card, matching reference image) */}
            <div className="flex items-center shrink-0 mt-0.5" dir="ltr">
              <motion.div
                animate={{ x: [0, 2, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#FF1E68] to-[#FB7185] opacity-95 shadow-sm"
              />
              <motion.div
                animate={{ x: [0, -2, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                className="w-6 h-6 rounded-full bg-[#FF1E68]/75 -ml-2.5 border border-white/35"
              />
            </div>
          </div>

          {/* Middle Row: Animated Moving Car along Route Track */}
          <div className="relative z-10 my-2.5 flex items-center gap-3 bg-black/15 backdrop-blur-xs rounded-full px-3.5 py-1.5 border border-white/25">
            <ShieldCheck className="w-4 h-4 text-white shrink-0" />
            <div className="flex-1 relative h-3 flex items-center" dir="ltr">
              <div className="w-full border-b-2 border-dashed border-white/50" />
              <motion.div
                animate={{ left: ['5%', '82%', '5%'] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -top-1.5 w-6 h-6 rounded-full bg-white text-[#0284C7] shadow-md flex items-center justify-center"
              >
                <Car className="w-3.5 h-3.5" />
              </motion.div>
            </div>
            <span className="text-[11px] font-extrabold shrink-0">★ 4.9</span>
          </div>

          {/* Bottom Row: Card Footer Metadata */}
          <div className="relative z-10 flex items-center justify-between text-[11px] font-semibold text-white/95 pt-1">
            <span>{isRTL ? 'كباتن موثقون ومشاركة المسار' : 'Verified Captains & Trip Share'}</span>
            <span className="font-mono font-bold bg-black/20 px-2 py-0.5 rounded-md border border-white/10">
              24/7 SOS
            </span>
          </div>

          {/* Protruding Side Circular Button (Animated Rose-Magenta gradient) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.94 }}
            onClick={(e) => {
              e.stopPropagation();
              handleNavigateToAuth();
            }}
            aria-label={isRTL ? 'استكشف' : 'Explore'}
            className={`absolute top-1/2 -translate-y-1/2 ${
              isRTL ? '-left-4' : '-right-4'
            } w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-[#0e2240] z-20 cursor-pointer`}
            style={{
              background: 'linear-gradient(135deg, #FF1E68 0%, #E11D48 100%)',
              boxShadow: '0 6px 18px rgba(255, 30, 104, 0.6)',
            }}
          >
            <ChevronIcon className="w-5 h-5 stroke-[2.5]" />
          </motion.button>
        </motion.div>

        {/* CARD 3: Animated Amber -> Gold -> Sunset Orange -> Coral Gradient - Delivery & Rewards */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{
            opacity: 1,
            y: 0,
            scale: activeCardIndex === 2 ? 1.02 : 0.985,
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{
            opacity: { duration: 0.5, delay: 0.54 },
            y: { type: 'spring', stiffness: 260, damping: 22, delay: 0.54 },
            scale: { duration: 0.35 },
            backgroundPosition: { duration: 6.2, repeat: Infinity, ease: 'easeInOut' },
          }}
          onClick={() => setActiveCardIndex(2)}
          className="relative w-full rounded-[26px] p-4 sm:p-5 text-white cursor-pointer select-none border border-white/25"
          style={{
            backgroundImage: 'linear-gradient(125deg, #FBBF24 0%, #F59E0B 26%, #F97316 54%, #EC4899 80%, #FBBF24 100%)',
            backgroundSize: '300% 300%',
            boxShadow:
              activeCardIndex === 2
                ? '0 20px 42px -8px rgba(249, 115, 22, 0.58), inset 0 1px 1px rgba(255, 255, 255, 0.45)'
                : '0 10px 24px -6px rgba(245, 158, 11, 0.28), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
          }}
        >
          {/* Floating liquid aurora gradient blobs + light sheen inside card */}
          <div className="overflow-hidden rounded-[26px] absolute inset-0 pointer-events-none">
            <motion.div
              animate={{
                x: ['-10%', '40%', '-10%'],
                y: ['-20%', '20%', '-20%'],
                scale: [1, 1.25, 1],
              }}
              transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-10 -left-6 w-44 h-44 rounded-full blur-2xl opacity-55"
              style={{ background: 'radial-gradient(circle, #FDE047 0%, #F97316 70%, transparent 100%)' }}
            />
            <motion.div
              animate={{
                x: ['20%', '-35%', '20%'],
                y: ['15%', '-20%', '15%'],
                scale: [1.1, 0.9, 1.1],
              }}
              transition={{ duration: 7.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -bottom-10 right-2 w-44 h-44 rounded-full blur-2xl opacity-50"
              style={{ background: 'radial-gradient(circle, #FB7185 0%, #EA580C 70%, transparent 100%)' }}
            />
            <motion.div
              animate={{ x: ['-120%', '220%'] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 2.2, repeatDelay: 1.4 }}
              className="w-1/2 h-full bg-gradient-to-r from-transparent via-white/24 to-transparent -skew-x-12"
            />
          </div>

          {/* Top Row: Rewards / Multi-Service & Dual-Circle Chip */}
          <div className="relative z-10 flex items-start justify-between mb-2.5">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                {isRTL ? 'توصيل طلبات، كابتن ومكافآت' : 'Delivery, Earn & Rewards'}
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={simulatedPoints}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="text-2xl sm:text-[26px] font-black tracking-tight tabular-nums"
                  >
                    +{simulatedPoints} {isRTL ? 'نقطة' : 'PTS'}
                  </motion.span>
                </AnimatePresence>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/20 border border-white/25 text-[10px] font-extrabold">
                  <Gift className="w-3 h-3 text-white animate-bounce" />
                  <span>{isRTL ? 'هدايا وخصومات' : 'Perks'}</span>
                </span>
              </div>
            </div>

            {/* Dual Overlapping Circles Badge (Cyan on Gold card, matching reference image) */}
            <div className="flex items-center shrink-0 mt-0.5" dir="ltr">
              <motion.div
                animate={{ x: [0, 2, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#06B6D4] to-[#67E8F9] opacity-95 shadow-sm"
              />
              <motion.div
                animate={{ x: [0, -2, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                className="w-6 h-6 rounded-full bg-[#26C6DA]/75 -ml-2.5 border border-white/35"
              />
            </div>
          </div>

          {/* Middle Row: Animated Feature Pills */}
          <div className="relative z-10 my-2.5 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-black/15 backdrop-blur-xs rounded-full px-3 py-1 border border-white/25 text-[11px] font-bold">
              <Package className="w-3.5 h-3.5 text-white" />
              <span>{isRTL ? 'توصيل سريع' : 'Fast Delivery'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/15 backdrop-blur-xs rounded-full px-3 py-1 border border-white/25 text-[11px] font-bold">
              <Navigation className="w-3.5 h-3.5 text-white" />
              <span>{isRTL ? 'قد واكسب ككابتن' : 'Drive & Earn'}</span>
            </div>
          </div>

          {/* Bottom Row: Card Footer Metadata */}
          <div className="relative z-10 flex items-center justify-between text-[11px] font-semibold text-white/95 pt-1">
            <span>{isRTL ? 'كاش أو محفظة إلكترونية' : 'Cash or Digital Wallet'}</span>
            <span className="font-mono font-bold bg-black/20 px-2 py-0.5 rounded-md border border-white/10">
              {isRTL ? 'الكل في واحد' : 'ALL-IN-ONE'}
            </span>
          </div>

          {/* Protruding Side Circular Button (Animated Cyan-Blue gradient) */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.94 }}
            onClick={(e) => {
              e.stopPropagation();
              handleNavigateToAuth();
            }}
            aria-label={isRTL ? 'استكشف' : 'Explore'}
            className={`absolute top-1/2 -translate-y-1/2 ${
              isRTL ? '-left-4' : '-right-4'
            } w-11 h-11 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-[#0e2240] z-20 cursor-pointer`}
            style={{
              background: 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
              boxShadow: '0 6px 18px rgba(34, 211, 238, 0.6)',
            }}
          >
            <ChevronIcon className="w-5 h-5 stroke-[2.5]" />
          </motion.button>
        </motion.div>
      </div>

      {/* Bottom Explore Action Button -> Navigates to Auth Page */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.72, type: 'spring', stiffness: 240, damping: 20 }}
        className="relative z-20 w-full max-w-md mx-auto px-6 pb-2 flex flex-col items-center"
      >
        <motion.button
          type="button"
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
          onClick={handleNavigateToAuth}
          className="group relative flex items-center justify-center gap-3 px-8 h-14 rounded-full text-white font-black text-base sm:text-lg tracking-wide shadow-xl hover:brightness-110 active:scale-95 transition-transform cursor-pointer"
          style={{
            backgroundImage: 'linear-gradient(115deg, #26C6DA 0%, #3B82F6 50%, #06B6D4 100%)',
            backgroundSize: '220% 220%',
            boxShadow: '0 10px 30px rgba(38, 198, 218, 0.48), 0 0 0 4px rgba(38, 198, 218, 0.16)',
          }}
        >
          <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <Compass className="w-4 h-4 text-white group-hover:rotate-45 transition-transform duration-300" />
          </span>
          <span>{isRTL ? 'استكشف الآن' : 'Explore'}</span>
          <ChevronIcon className="w-5 h-5 opacity-90 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
        </motion.button>
      </motion.div>
    </div>
  );
}
