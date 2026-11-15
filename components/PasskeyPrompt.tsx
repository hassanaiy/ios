import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { User, Driver } from '../types';
import { BiometricService } from '../services/biometricService';

interface PasskeyPromptProps {
  user: User | Driver;
  onSuccess: () => void;
  onLogout: () => void;
}

const MAX_ATTEMPTS = 4;
const LOCKOUT_DURATION_MS = 30000; // 30 seconds

export default function PasskeyPrompt({ user, onSuccess, onLogout }: PasskeyPromptProps) {
  const { language, t, isRTL } = useLanguage();

  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const isCheckingRef = useRef(false);
  const hasAutoPromptedBioRef = useRef(false);

  const canUseBiometricUnlock = Boolean(
    user?.privacySettings?.biometricUnlockEnabled || BiometricService.hasSavedCredentials()
  );

  const handleBiometricUnlock = useCallback(async () => {
    try {
      const verified = await BiometricService.verifyBiometricOnly({
        title: language === 'ar' ? 'فتح قفل التطبيق بالبصمة' : 'Biometric App Unlock',
        subtitle: language === 'ar' ? 'استخدم بصمة الهاتف لفتح التطبيق' : 'Verify phone biometrics to unlock app',
        cancelText: language === 'ar' ? 'استخدام رمز PIN' : 'Use PIN',
      });
      if (verified) {
        onSuccess();
      }
    } catch {}
  }, [language, onSuccess]);

  // If neither localStorage nor user profile has a stored PIN hash, unlock automatically
  useEffect(() => {
    const storedHash = localStorage.getItem('app_pin_hash') || user?.passcode;
    if (!storedHash) {
      onSuccess();
      return;
    }
    if (canUseBiometricUnlock && !hasAutoPromptedBioRef.current) {
      hasAutoPromptedBioRef.current = true;
      handleBiometricUnlock();
    }
  }, [user, onSuccess, canUseBiometricUnlock, handleBiometricUnlock]);

  useEffect(() => {
    if (lockoutUntil && Date.now() < lockoutUntil) {
      const updateTimer = () => {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockoutUntil(null);
          setAttempts(0);
          setTimeLeft(0);
          setError(false);
        } else {
          setTimeLeft(remaining);
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutUntil]);

  // Hash using Web Crypto API to compare
  const hashPin = async (rawPin: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawPin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    if (pin.length !== 4 || isCheckingRef.current) return;
    if (lockoutUntil && Date.now() < lockoutUntil) return;

    const verifyPin = async () => {
      isCheckingRef.current = true;
      try {
        const storedHash = localStorage.getItem('app_pin_hash') || user?.passcode;
        if (!storedHash) {
          onSuccess();
          return;
        }

        const currentHash = await hashPin(pin);

        if (storedHash === currentHash || storedHash === pin) {
          // Sync hash locally if it came from Firestore profile
          if (!localStorage.getItem('app_pin_hash') && user?.passcode) {
            localStorage.setItem('app_pin_hash', user.passcode);
          }
          setAttempts(0);
          setError(false);
          setTimeout(() => {
            isCheckingRef.current = false;
            onSuccess();
          }, 200);
        } else {
          setError(true);
          setAttempts((prevAttempts) => {
            const nextAttempts = prevAttempts + 1;
            if (nextAttempts >= MAX_ATTEMPTS) {
              setLockoutUntil(Date.now() + LOCKOUT_DURATION_MS);
              setTimeLeft(Math.ceil(LOCKOUT_DURATION_MS / 1000));
            }
            return nextAttempts;
          });

          setTimeout(() => {
            setPin('');
            setError(false);
            isCheckingRef.current = false;
          }, 420);
        }
      } catch {
        setPin('');
        isCheckingRef.current = false;
      }
    };

    verifyPin();
  }, [pin, lockoutUntil, onSuccess, user]);

  const isLockedOut = Boolean(lockoutUntil && Date.now() < lockoutUntil);
  const remainingTries = Math.max(0, MAX_ATTEMPTS - attempts);

  const handleNumPress = (num: string) => {
    if (pin.length < 4 && !isLockedOut && !isCheckingRef.current) {
      setPin((prev) => prev + num);
    }
  };

  const handleDelete = () => {
    if (!isLockedOut && !isCheckingRef.current) {
      setPin((prev) => prev.slice(0, -1));
    }
  };

  const renderKeypad = () => (
    <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-3.5 gap-x-4 mx-auto" dir="ltr">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => handleNumPress(num.toString())}
          disabled={isLockedOut}
          className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 text-2xl sm:text-3xl font-bold text-slate-900 hover:bg-slate-100 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center disabled:opacity-40 shadow-xs"
        >
          {num}
        </button>
      ))}

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onLogout}
          className="px-3 py-2 rounded-xl text-xs font-black text-rose-500 hover:bg-rose-50 uppercase tracking-wider transition-colors"
        >
          {t('logout') || (language === 'ar' ? 'خروج' : 'LOGOUT')}
        </button>
      </div>

      <button
        type="button"
        onClick={() => handleNumPress('0')}
        disabled={isLockedOut}
        className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 text-2xl sm:text-3xl font-bold text-slate-900 hover:bg-slate-100 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center disabled:opacity-40 shadow-xs"
      >
        0
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={isLockedOut}
        className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 text-xl text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center disabled:opacity-40 shadow-xs"
      >
        <i className="fas fa-backspace"></i>
      </button>
    </div>
  );

  const renderDots = (value: string) => (
    <div className={`flex gap-5 mb-8 ${error ? 'animate-shake' : ''}`} dir="ltr">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
            error
              ? 'bg-rose-500 border-rose-500 scale-110'
              : i < value.length
              ? 'bg-slate-900 border-slate-900 scale-110'
              : 'bg-transparent border-slate-300'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-white z-[150] flex flex-col items-center justify-between py-10 px-6 animate-fade-in overflow-y-auto min-h-[100dvh]"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full flex flex-col items-center pt-4 sm:pt-8">
        <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-3xl flex items-center justify-center mb-5 shrink-0 shadow-xs">
          <i className={`fas ${isLockedOut ? 'fa-hourglass-half text-rose-500' : 'fa-lock text-blue-600'} text-3xl`}></i>
        </div>

        <h1 className="text-2xl font-black mb-2 text-slate-900 text-center">
          {language === 'ar' ? 'رمز أمان التطبيق' : 'App Security PIN'}
        </h1>

        {isLockedOut ? (
          <div className="mb-6 text-center px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 max-w-xs">
            <p className="text-rose-600 font-black text-sm animate-pulse">
              {language === 'ar'
                ? `محاولات كثيرة (4/4). حاول لاحقاً بعد ${timeLeft} ثانية`
                : `Too many failed tries (4/4). Try again in ${timeLeft}s`}
            </p>
          </div>
        ) : attempts > 0 ? (
          <div className="mb-6 text-center">
            <p className="text-rose-600 font-bold text-sm">
              {language === 'ar'
                ? `الرمز غير صحيح — متبقي ${remainingTries} من ${MAX_ATTEMPTS} محاولات`
                : `Incorrect PIN — ${remainingTries} of ${MAX_ATTEMPTS} tries remaining`}
            </p>
          </div>
        ) : (
          <p className="text-slate-500 font-medium text-sm mb-6 text-center">
            {language === 'ar'
              ? `أدخل الرمز المكون من 4 أرقام (${MAX_ATTEMPTS} محاولات متاحة)`
              : `Enter your 4-digit security PIN (${MAX_ATTEMPTS} tries allowed)`}
          </p>
        )}

        {/* Attempt indicator bars */}
        <div className="flex items-center gap-1.5 mb-6" dir="ltr">
          {Array.from({ length: MAX_ATTEMPTS }).map((_, idx) => {
            const isUsed = idx < attempts;
            return (
              <span
                key={idx}
                className={`h-1.5 w-6 rounded-full transition-all ${
                  isUsed ? 'bg-rose-500' : 'bg-emerald-400/70'
                }`}
              />
            );
          })}
        </div>

        {renderDots(pin)}

        {canUseBiometricUnlock && !isLockedOut && (
          <button
            type="button"
            onClick={handleBiometricUnlock}
            className="mb-3 px-4 py-2 rounded-2xl bg-slate-900 text-[#FFC90E] font-black text-xs flex items-center gap-2 shadow-sm active:scale-95 transition-transform cursor-pointer"
          >
            <i className="fas fa-fingerprint text-base"></i>
            <span>{language === 'ar' ? 'فتح ببصمة الهاتف' : 'Unlock with Phone Biometrics'}</span>
          </button>
        )}
      </div>

      <div className="w-full pb-4">{renderKeypad()}</div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
      `}</style>
    </div>
  );
}
