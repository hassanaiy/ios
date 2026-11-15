import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface SOSButtonProps {
  onActivate: () => void;
  isActivated: boolean;
}

const SOSButton: React.FC<SOSButtonProps> = ({ onActivate, isActivated }) => {
  const { t } = useLanguage();
  const [isHolding, setIsHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<any>(null);
  const progressRef = useRef<any>(null);

  const HOLD_DURATION = 3000; // 3 seconds

  const startHold = () => {
    if (isActivated) return;
    setIsHolding(true);
    setProgress(0);

    progressRef.current = setInterval(() => {
      setProgress(p => p + (100 / (HOLD_DURATION / 100)));
    }, 100);

    timerRef.current = setTimeout(() => {
      onActivate();
      clearInterval(progressRef.current);
    }, HOLD_DURATION);
  };

  const cancelHold = () => {
    setIsHolding(false);
    setProgress(0);
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearInterval(progressRef.current);
    };
  }, []);

  return (
    <div className="fixed bottom-safe mb-4 right-4 z-50" dir="ltr">
      <button
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 focus:outline-none overflow-hidden
          ${isActivated ? 'bg-green-500 animate-pulse' : (isHolding ? 'bg-red-600 scale-110' : 'bg-red-500')}
        `}
      >
        {/* Progress Circle */}
        {isHolding && !isActivated && (
          <div className="absolute inset-0">
            <div 
              className="absolute top-0 left-0 w-full h-full bg-black/30" 
              style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
            ></div>
          </div>
        )}
        
        <div className="relative text-white text-center">
            {isActivated ? (
                <i className="fas fa-check-circle text-3xl"></i>
            ) : (
                <>
                    <span className="font-black text-2xl tracking-wider">SOS</span>
                    <span className="block text-[8px] font-bold opacity-80 mt-[-4px]">
                        {t('hold_to_sos')}
                    </span>
                </>
            )}
        </div>
      </button>
    </div>
  );
};

export default SOSButton;
