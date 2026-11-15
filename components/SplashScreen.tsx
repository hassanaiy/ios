import React from 'react';
import { motion } from 'framer-motion';

interface SplashScreenProps {
  isRTL?: boolean;
  onDismiss?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isRTL = true, onDismiss }) => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
      onClick={onDismiss}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between px-6 pt-12 pb-8 sm:pb-10 overflow-hidden bg-gradient-to-b from-[#FFC72C] via-[#FFBA08] to-[#FFA800] select-none cursor-pointer"
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top))',
        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
      }}
      dir="rtl"
    >
      {/* Subtle organic light sheen for premium finish */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div 
          className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none opacity-40 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, #FFE484 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Top spacer to balance vertical layout */}
      <div className="w-full h-8" />

      {/* Center: Expressive, bold Arabic slogan matching inDrive poster style */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center justify-center my-auto text-center px-4 max-w-lg"
      >
        <h1 
          className="text-4xl xs:text-5xl sm:text-6xl md:text-7xl font-black text-[#111827] tracking-tight leading-[1.18]"
          style={{ 
            fontFamily: "'Alexandria', 'Cairo', system-ui, -apple-system, sans-serif",
            textShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}
        >
          <span className="block">مشوارك بقى أسهل</span>
          <span className="block mt-2 sm:mt-3">وعلى طريقتك</span>
        </h1>
      </motion.div>

      {/* Bottom: App Name and Native Activity Spinner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center justify-center mt-auto"
        style={{ direction: 'ltr' }}
      >
        {/* App Name */}
        <div 
          className="text-3xl sm:text-4xl font-black tracking-tight text-[#111827]"
          style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}
        >
          Mowasla
        </div>

        {/* Circular Spinner directly below app name */}
        <div className="mt-4 mb-2 flex items-center justify-center">
          <div 
            className="w-7 h-7 rounded-full border-[3px] border-[#111827]/20 border-t-[#111827] animate-spin"
            role="status"
            aria-label="Loading"
          />
        </div>
      </motion.div>
    </motion.div>
  );
};
