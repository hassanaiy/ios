import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock } from 'lucide-react';
import { Button } from './ui/Button';

export interface AnimatedAcceptButtonProps {
  createdAt: any; // timestamp or ms
  durationSeconds?: number;
  onAccept: () => void;
  onExpire?: () => void;
  processing?: boolean;
  disabled?: boolean;
  text: string;
  expiredText: string;
  isRTL: boolean;
  className?: string;
  style?: React.CSSProperties;
  startTimerOnClick?: boolean;
}

export const AnimatedAcceptButton: React.FC<AnimatedAcceptButtonProps> = ({
  createdAt,
  durationSeconds = 12,
  onAccept,
  onExpire,
  processing = false,
  disabled = false,
  text,
  expiredText,
  isRTL,
  className = "",
  style = {},
  startTimerOnClick = false,
}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [isExpired, setIsExpired] = useState(false);
  const [hasStarted, setHasStarted] = useState(!startTimerOnClick);

  const { initialProgress, remainingDuration } = useMemo(() => {
    let startTime = Date.now();
    if (createdAt && !startTimerOnClick) {
      if (typeof createdAt === 'number') startTime = createdAt;
      else if (createdAt.toMillis) startTime = createdAt.toMillis();
      else if (createdAt.seconds) startTime = createdAt.seconds * 1000;
      else if (typeof createdAt.getTime === 'function') startTime = createdAt.getTime();
      
      if (isNaN(startTime) || !startTime) startTime = Date.now();
    }
    const elapsed = Math.max(0, (Date.now() - startTime) / 1000) || 0;
    return {
      initialProgress: Math.max(0, Math.min(100, (elapsed / durationSeconds) * 100)) || 0,
      remainingDuration: Math.max(0, durationSeconds - elapsed) || 0,
    };
  }, [createdAt, startTimerOnClick, durationSeconds]);

  useEffect(() => {
    setIsExpired(false);
    if (!hasStarted) {
       setTimeLeft(durationSeconds);
       return;
    }

    let intervalId: NodeJS.Timeout;
    let localHasExpired = false;

    let startTime = Date.now();
    if (createdAt && !startTimerOnClick) {
       if (typeof createdAt === 'number') startTime = createdAt;
       else if (createdAt.toMillis) startTime = createdAt.toMillis();
       else if (createdAt.seconds) startTime = createdAt.seconds * 1000;
       else if (typeof createdAt.getTime === 'function') startTime = createdAt.getTime();
       
       if (isNaN(startTime) || !startTime) startTime = Date.now();
    }

    const updateTimer = () => {
      if (localHasExpired) return;

      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const remaining = Math.max(0, durationSeconds - elapsed);
      
      setTimeLeft(remaining);

      if (remaining <= 0) {
        setIsExpired(true);
        localHasExpired = true;
        if (onExpire) setTimeout(onExpire, 0);
      }
    };

    updateTimer();
    intervalId = setInterval(updateTimer, 500); // 2 FPS is plenty for a text countdown, saves tons of battery

    return () => clearInterval(intervalId);
  }, [createdAt, durationSeconds, onExpire, hasStarted, startTimerOnClick]);

  const isWarning = timeLeft <= 5 && timeLeft > 3 && hasStarted;
  const isCritical = timeLeft <= 3 && timeLeft > 0 && hasStarted;

  if (isExpired) {
    return (
      <Button
        disabled
        className={`relative overflow-hidden bg-gray-200 text-gray-500 font-bold border-none transition-all ${className}`}
        style={{ borderRadius: style.borderRadius || '30px' }}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
           <Clock className="w-5 h-5 opacity-50" />
           {expiredText}
        </span>
      </Button>
    );
  }

  return (
    <Button
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        if (startTimerOnClick && !hasStarted) {
           setHasStarted(true);
        }
        onAccept();
      }}
      disabled={processing || disabled}
      className={`relative overflow-hidden font-bold border-none transition-all ${isCritical ? 'animate-pulse shadow-[0_0_30px_rgba(220,38,38,0.8)]' : isWarning ? 'shadow-[0_4px_15px_rgba(234,179,8,0.3)]' : 'shadow-[0_4px_15px_rgba(37,99,235,0.3)]'} ${className}`}
      style={{
        backgroundColor: isCritical ? '#991b1b' : '#1f44df', // Darker red background base for critical text contrast
        color: '#ffffff',
        ...style
      }}
    >
      {/* Progress Bar Background */}
      <motion.div
        className={`absolute top-0 bottom-0 ${isRTL ? 'right-0' : 'left-0'} z-0`}
        style={{
          background: isCritical 
            ? 'linear-gradient(90deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 1) 100%)' // Red
            : 'linear-gradient(90deg, rgba(245, 158, 11, 0.9) 0%, rgba(217, 119, 6, 1) 100%)', // Orange/Yellow
        }}
        initial={{ width: `${initialProgress}%` }}
        animate={{ width: hasStarted ? '100%' : `${initialProgress}%` }}
        transition={{ duration: hasStarted ? remainingDuration : 0, ease: 'linear' }}
      />
      
      {/* Button Content */}
      <span className="relative z-10 flex items-center justify-center gap-2 w-full">
        {processing && (!startTimerOnClick || (startTimerOnClick && !hasStarted)) ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            {!hasStarted && startTimerOnClick ? (
               <span>{text}</span>
            ) : (
               <>
                 <Check className={`w-5 h-5 ${isCritical ? 'animate-bounce' : ''}`} />
                 <span className="whitespace-nowrap">{text} ({Math.ceil(timeLeft)})</span>
               </>
            )}
          </>
        )}
      </span>
    </Button>
  );
};
