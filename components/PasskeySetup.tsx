import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface PasskeySetupProps {
  onComplete: (passcode: string) => void;
  onSkip: () => void;
  initialStep?: 'INTRO' | 'SETUP';
}

export default function PasskeySetup({ onComplete, onSkip, initialStep = 'SETUP' }: PasskeySetupProps) {
  const { language, t, isRTL } = useLanguage();

  const [step, setStep] = useState<'INTRO' | 'SETUP' | 'CONFIRM'>(initialStep);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Hash using Web Crypto API
  const hashPin = async (rawPin: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(rawPin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleNumPress = (num: string) => {
    if (step === 'SETUP') {
      if (pin.length < 4) {
        const newPin = pin + num;
        setPin(newPin);
        if (newPin.length === 4) {
          setTimeout(() => setStep('CONFIRM'), 250);
        }
      }
    } else if (step === 'CONFIRM') {
      if (confirmPin.length < 4) {
        const newConfirm = confirmPin + num;
        setConfirmPin(newConfirm);
        if (newConfirm.length === 4) {
          if (newConfirm === pin) {
            handleSave(newConfirm);
          } else {
            setError(true);
            setTimeout(() => {
              setConfirmPin('');
              setPin('');
              setStep('SETUP');
              setError(false);
            }, 450);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    if (step === 'SETUP') setPin((prev) => prev.slice(0, -1));
    else setConfirmPin((prev) => prev.slice(0, -1));
  };

  const handleSave = async (finalPin: string) => {
    setIsLoading(true);
    try {
      const hashed = await hashPin(finalPin);
      localStorage.setItem('app_pin_hash', hashed);
      onComplete(hashed);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const renderKeypad = () => (
    <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-3.5 gap-x-4 mx-auto" dir="ltr">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => handleNumPress(num.toString())}
          disabled={isLoading}
          className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 shadow-xs text-2xl font-bold text-slate-900 hover:bg-slate-100 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
        >
          {num}
        </button>
      ))}

      <div className="flex items-center justify-center">
        {step === 'CONFIRM' ? (
          <button
            type="button"
            onClick={() => {
              setStep('SETUP');
              setConfirmPin('');
              setPin('');
            }}
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all flex items-center justify-center font-bold text-xs"
          >
            {language === 'ar' ? 'إعادة' : t('back') || 'Reset'}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSkip}
            className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center font-bold text-xs"
          >
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => handleNumPress('0')}
        disabled={isLoading}
        className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 shadow-xs text-2xl font-bold text-slate-900 hover:bg-slate-100 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
      >
        0
      </button>

      <button
        type="button"
        onClick={handleDelete}
        disabled={isLoading}
        className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-slate-50 border border-slate-100 shadow-xs text-xl text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center disabled:opacity-50"
      >
        <i className="fas fa-backspace"></i>
      </button>
    </div>
  );

  const renderDots = (value: string) => (
    <div className={`flex gap-5 mb-10 ${error ? 'animate-shake' : ''}`} dir="ltr">
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
      className="fixed inset-0 bg-white z-[160] flex flex-col items-center justify-between py-8 px-6 animate-fade-in overflow-y-auto min-h-[100dvh]"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="w-full flex items-center justify-between max-w-md">
        <button
          type="button"
          onClick={onSkip}
          className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center active:scale-95 transition-colors"
        >
          <i className="fas fa-times text-slate-600"></i>
        </button>
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          {step === 'SETUP'
            ? language === 'ar'
              ? 'الخطوة 1 من 2'
              : 'Step 1 of 2'
            : language === 'ar'
            ? 'الخطوة 2 من 2'
            : 'Step 2 of 2'}
        </span>
        <div className="w-10" />
      </div>

      <div className="flex flex-col items-center my-auto">
        <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-3xl flex items-center justify-center mb-5 shadow-xs">
          <i className="fas fa-shield-alt text-3xl text-blue-600"></i>
        </div>
        <h1 className="text-2xl font-black mb-2 text-slate-900 text-center">
          {step === 'SETUP'
            ? language === 'ar'
              ? 'إنشاء رمز أمان للتطبيق'
              : 'Create App Security PIN'
            : language === 'ar'
            ? 'تأكيد رمز الأمان'
            : 'Confirm Security PIN'}
        </h1>
        <p className="text-slate-500 text-sm font-medium mb-8 text-center max-w-xs">
          {error
            ? language === 'ar'
              ? 'الرمزان غير متطابقين، يرجى المحاولة مرة أخرى'
              : 'PIN codes did not match. Please try again.'
            : step === 'SETUP'
            ? language === 'ar'
              ? 'اختر رمزاً مكوناً من 4 أرقام لحماية حسابك داخل التطبيق (4 محاولات عند الفتح).'
              : 'Choose a 4-digit PIN to protect your account (4 tries allowed on unlock).'
            : language === 'ar'
            ? 'أعد إدخال الرمز المكون من 4 أرقام للتأكيد'
            : 'Re-enter your 4-digit PIN to confirm'}
        </p>

        {renderDots(step === 'SETUP' ? pin : confirmPin)}
        {isLoading && (
          <div className="mb-4 text-blue-600 font-bold text-sm flex items-center gap-2">
            <i className="fas fa-spinner fa-spin"></i>
            <span>{language === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span>
          </div>
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
