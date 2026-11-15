import React, { useState, useEffect } from "react";
import { auth, sendOtpNative, verifyOtpNative, getNativeIdToken } from "../services/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from "firebase/auth";
import { Capacitor } from '@capacitor/core';
import { Button } from "../components/ui/Button";
import { useLanguage } from "../contexts/LanguageContext";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

const ARAB_COUNTRIES = [
  { code: '+20', flag: '🇪🇬', key: 'egypt' },
  { code: '+966', flag: '🇸🇦', key: 'saudi_arabia' },
  { code: '+971', flag: '🇦🇪', key: 'uae' },
  { code: '+965', flag: '🇰🇼', key: 'kuwait' },
  { code: '+974', flag: '🇶🇦', key: 'qatar' },
  { code: '+973', flag: '🇧🇭', key: 'bahrain' },
  { code: '+968', flag: '🇴🇲', key: 'oman' },
  { code: '+962', flag: '🇯🇴', key: 'jordan' },
  { code: '+961', flag: '🇱🇧', key: 'lebanon' },
  { code: '+964', flag: '🇮🇶', key: 'iraq' },
  { code: '+963', flag: '🇸🇾', key: 'syria' },
  { code: '+970', flag: '🇵🇸', key: 'palestine' },
  { code: '+967', flag: '🇾🇪', key: 'yemen' },
  { code: '+218', flag: '🇱🇾', key: 'libya' },
  { code: '+249', flag: '🇸🇩', key: 'sudan' },
  { code: '+212', flag: '🇲🇦', key: 'morocco' },
  { code: '+213', flag: '🇩🇿', key: 'algeria' },
  { code: '+216', flag: '🇹🇳', key: 'tunisia' },
  { code: '+222', flag: '🇲🇷', key: 'mauritania' },
  { code: '+252', flag: '🇸🇴', key: 'somalia' },
  { code: '+253', flag: '🇩🇯', key: 'djibouti' },
  { code: '+269', flag: '🇰🇲', key: 'comoros' },
];

export default function PhoneLogin() {
  const { t, isRTL } = useLanguage();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirm, setConfirm] = useState<ConfirmationResult | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [expirationCountdown, setExpirationCountdown] = useState(0);
  const [isNativeFlow, setIsNativeFlow] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [countryCode, setCountryCode] = useState("+20");

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (expirationCountdown > 0) {
      timer = setTimeout(() => setExpirationCountdown(expirationCountdown - 1), 1000);
    } else if (expirationCountdown === 0 && (confirm || verificationId)) {
      // Code expired
      setConfirm(null);
      setVerificationId(null);
      setOtp("");
      setError("Verification code expired. Please request a new one.");
    }
    return () => clearTimeout(timer);
  }, [expirationCountdown, confirm, verificationId]);

  const setupRecaptcha = () => {
    if (Capacitor.isNativePlatform()) return; // Not needed on native
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {
        console.warn("Error clearing recaptcha:", e);
      }
    }
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        console.log("reCAPTCHA solved");
      },
      'expired-callback': () => {
        console.log("reCAPTCHA expired");
        setupRecaptcha();
      }
    });
  };

  const normalizeE164Phone = (value: string, fallbackCountryCode = countryCode) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('+')) {
      const matchedCountry = ARAB_COUNTRIES.find(c => trimmed.startsWith(c.code));
      if (matchedCountry) {
        const local = trimmed.slice(matchedCountry.code.length).replace(/\D/g, '').replace(/^0+/, '');
        return `${matchedCountry.code}${local}`;
      }
      return `+${trimmed.slice(1).replace(/\D/g, '')}`;
    }

    const local = trimmed.replace(/\D/g, '').replace(/^0+/, '');
    return `${fallbackCountryCode}${local}`;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const phoneParam = params.get('phone');
    const nativeParam = params.get('native');
    const embeddedParam = params.get('embedded');
    
    if (embeddedParam === 'true') {
      setIsEmbedded(true);
    }

    setupRecaptcha();

    if (phoneParam) {
      // Try to parse country code from phoneParam
      const matchedCountry = ARAB_COUNTRIES.find(c => phoneParam.startsWith(c.code));
      if (matchedCountry) {
        setCountryCode(matchedCountry.code);
        setPhone(phoneParam.replace(matchedCountry.code, ''));
      } else {
        setPhone(phoneParam);
      }
      
      // Auto-send if phone is in URL
      const timer = setTimeout(() => {
        const sendAutoOtp = async () => {
          setIsLoading(true);
          setError(null);
          try {
            const normalizedPhone = normalizeE164Phone(phoneParam);
            if (Capacitor.isNativePlatform()) {
              const result = await sendOtpNative(normalizedPhone);
              setVerificationId(result.verificationId);
            } else {
              if (!window.recaptchaVerifier) setupRecaptcha();
              const result = await signInWithPhoneNumber(auth, normalizedPhone, window.recaptchaVerifier);
              setConfirm(result);
            }
            setResendCountdown(60);
            setExpirationCountdown(300);
          } catch (err: any) {
            console.error("Auto OTP Send Error:", err);
            setError(err.message || "Failed to send OTP");
            setupRecaptcha();
          } finally {
            setIsLoading(false);
          }
        };
        sendAutoOtp();
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    if (nativeParam === 'true') {
      setIsNativeFlow(true);
    }

    return () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        } catch (e) {}
      }
    };
  }, []);

  const sendOtp = async () => {
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      setError(t('err_invalid_phone'));
      return;
    }
    if (isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setConfirm(null);
    setVerificationId(null);
    setOtp("");
    
    const fullPhone = normalizeE164Phone(phone, countryCode);
    
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await sendOtpNative(fullPhone);
        setVerificationId(result.verificationId);
      } else {
        if (!window.recaptchaVerifier) setupRecaptcha();
        const result = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
        setConfirm(result);
      }
      setResendCountdown(60);
      setExpirationCountdown(300);
    } catch (err: any) {
      console.error("Error sending OTP:", err);
      setError(err.message || t('err_otp_send_failed'));
      setupRecaptcha();
    } finally {
      setIsLoading(false);
    }
  };

  const [isSuccess, setIsSuccess] = useState(false);
  const [nativeToken, setNativeToken] = useState<string | null>(null);

  const verifyOtp = async () => {
    if (!otp) return;
    if (!confirm && !verificationId) return;

    setIsLoading(true);
    setError(null);
    try {
      let idToken = "";
      if (Capacitor.isNativePlatform()) {
        await verifyOtpNative(verificationId!, otp);
        const tokenResult = await getNativeIdToken();
        idToken = tokenResult.token;
      } else {
        const result = await confirm!.confirm(otp);
        idToken = await result.user.getIdToken();
      }
      
      setNativeToken(idToken);
      setIsSuccess(true);
      
      if (isEmbedded) {
        window.parent.postMessage({ type: 'PHONE_LOGIN_SUCCESS', token: idToken }, '*');
      }

      // Attempt automatic redirect
      console.log("Redirecting to app with token...");
      window.location.href = `waslny://login-success?token=${idToken}`;
      
    } catch (err: any) {
      console.error("Error verifying OTP:", err);
      setError(err.message || t('err_invalid_otp'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualRedirect = () => {
    if (nativeToken) {
      window.location.href = `waslny://login-success?token=${nativeToken}`;
    }
  };

  if (isSuccess) {
    return (
      <div className={`${isEmbedded ? 'p-4' : 'min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6'}`} dir={isRTL ? "rtl" : "ltr"}>
        <div className={`w-full max-w-md ${isEmbedded ? '' : 'bg-white rounded-[32px] shadow-xl p-8'} text-center`}>
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600">
              <i className="fas fa-check-circle text-3xl"></i>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">
            {isRTL ? "تم التحقق بنجاح!" : "Verified Successfully!"}
          </h2>
          <p className="text-gray-500 font-medium mb-8">
            {isRTL ? "يتم الآن العودة إلى التطبيق..." : "Returning to the app..."}
          </p>
          
          {!isEmbedded && (
            <>
              <Button onClick={handleManualRedirect} className="w-full h-14 bg-gray-900 text-white rounded-2xl font-black text-lg">
                {isRTL ? "العودة للتطبيق يدوياً" : "Return to App Manually"}
              </Button>
              
              <p className="mt-6 text-xs text-gray-400">
                {isRTL ? "إذا لم يتم فتح التطبيق تلقائياً، اضغط على الزر أعلاه." : "If the app didn't open automatically, click the button above."}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  const isOtpStep = Boolean(confirm || verificationId);
  const formattedTargetPhone = normalizeE164Phone(phone, countryCode);

  return (
    <div className={`${isEmbedded ? 'p-4' : 'h-[100dvh] overflow-y-auto bg-slate-50 flex flex-col items-center p-5'} ${isOtpStep ? 'justify-start pt-4' : 'justify-center'}`} dir={isRTL ? "rtl" : "ltr"}>
      <div className={`w-full max-w-md ${isEmbedded ? '' : 'bg-white rounded-[28px] border border-slate-200/80 shadow-xl p-6 sm:p-7'} text-center`}>
        <div className="w-12 h-12 bg-[#FFC90E]/20 border border-[#FFC90E]/40 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-900">
            <i className={`fas ${isOtpStep ? 'fa-shield-alt' : 'fa-phone-alt'} text-lg`}></i>
        </div>
        {isOtpStep ? (
          <>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-1">
              {isRTL ? "تأكيد رمز التحقق" : "Verify OTP Code"}
            </h2>
            <p className="text-slate-500 font-medium text-xs sm:text-sm mb-1.5">
              {t('enter_code_sent_to')}
            </p>
            <div className="mb-4 flex items-center justify-center gap-2 text-sm">
              <span className="font-black text-slate-900 text-base tracking-wide tabular-nums" dir="ltr">
                ({formattedTargetPhone})
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => {
                  setConfirm(null);
                  setVerificationId(null);
                  setOtp("");
                  setResendCountdown(0);
                  setExpirationCountdown(0);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 underline underline-offset-4 transition-colors cursor-pointer"
              >
                {t('change_phone')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-black text-slate-900 mb-1.5">{t('phone_login_title')}</h2>
            <p className="text-slate-500 font-medium text-sm mb-6">{t('enter_phone_desc')}</p>
          </>
        )}

        {error && (
          <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm font-bold">
            {error}
          </div>
        )}

        {!confirm && !verificationId ? (
          <div className="space-y-4">
            <div className="flex bg-white rounded-2xl border border-slate-200 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-[#FFC90E]/30 transition-all overflow-hidden h-16" dir="ltr">
              <div className="relative flex items-center border-r border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors max-w-[140px]">
                  <select 
                    value={countryCode} 
                    onChange={e => setCountryCode(e.target.value)} 
                    className="h-full pl-4 pr-10 bg-transparent outline-none font-bold text-xl appearance-none cursor-pointer z-10 w-full"
                  >
                    {ARAB_COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {t(c.key)} ({c.code})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 pointer-events-none text-slate-400">
                      <i className="fas fa-chevron-down text-xs"></i>
                  </div>
              </div>
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="1000000000"
                maxLength={15}
                value={phone}
                onChange={e => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (val.startsWith('0')) val = val.substring(1);
                  setPhone(val);
                }}
                className="w-full h-full px-4 bg-transparent outline-none text-2xl font-bold tracking-wide tabular-nums"
                dir="ltr"
              />
            </div>
            <Button onClick={sendOtp} isLoading={isLoading} className="w-full h-14 bg-[#FFC90E] text-slate-950 rounded-2xl font-black text-lg">
              {t('send_code')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative" dir="ltr">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="grid grid-cols-6 gap-2 sm:gap-2.5 w-full">
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const isActive = otp.length === index || (otp.length === 6 && index === 5);
                  const isFilled = otp.length > index;
                  return (
                    <div
                      key={index}
                      className={`h-14 sm:h-[60px] flex items-center justify-center rounded-2xl border-2 text-2xl font-black tabular-nums transition-all duration-150 ${
                        isActive
                          ? "border-slate-900 bg-white ring-4 ring-[#FFC90E]/30 text-slate-900 shadow-sm"
                          : isFilled
                          ? "border-[#FFC90E] bg-amber-50/40 text-slate-900"
                          : "border-slate-200 bg-slate-50/80 text-slate-300"
                      }`}
                    >
                      {otp[index] ? (
                        <span>{otp[index]}</span>
                      ) : (
                        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-slate-900 animate-pulse' : 'bg-slate-300'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs font-bold text-slate-500 tabular-nums">
              {resendCountdown > 0 ? (
                <span>{t('resend_code_in')} <strong className="text-slate-800">{resendCountdown}s</strong></span>
              ) : (
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={isLoading}
                  className="text-slate-900 font-black underline underline-offset-4 hover:text-amber-600 transition-colors cursor-pointer"
                >
                  {t('resend_code')}
                </button>
              )}
              {expirationCountdown > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span>
                    {t('code_expires')} <strong className="text-slate-800">{Math.floor(expirationCountdown / 60)}:{(expirationCountdown % 60).toString().padStart(2, '0')}</strong>
                  </span>
                </>
              )}
            </div>

            <Button 
              onClick={verifyOtp} 
              isLoading={isLoading} 
              disabled={otp.length !== 6}
              className={`w-full h-14 rounded-2xl font-black text-lg transition-all ${
                otp.length === 6 ? 'bg-[#FFC90E] text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20' : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              {t('verify')}
            </Button>

            {/* On-screen Numeric Keypad */}
            <div className="pt-2 border-t border-slate-100" dir="ltr">
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (otp.length < 6) setOtp(prev => prev + num);
                    }}
                    className="h-12 sm:h-13 min-h-[48px] bg-slate-50 hover:bg-slate-100 active:bg-slate-200 active:scale-[0.97] border border-slate-200/80 rounded-2xl text-2xl font-black text-slate-900 tabular-nums transition-all flex items-center justify-center select-none cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={async () => {
                    if (otp.length > 0) {
                      setOtp("");
                      return;
                    }
                    try {
                      const clip = await navigator.clipboard?.readText?.();
                      const digits = (clip || '').replace(/\D/g, '').slice(0, 6);
                      if (digits) setOtp(digits);
                    } catch {}
                  }}
                  aria-label={otp.length > 0 ? (isRTL ? 'مسح الكل' : 'Clear all') : (isRTL ? 'لصق الرمز' : 'Paste code')}
                  className="h-12 sm:h-13 min-h-[48px] bg-slate-100/80 hover:bg-slate-200/80 active:scale-[0.97] border border-slate-200/70 rounded-2xl text-xs font-black text-slate-600 transition-all flex items-center justify-center select-none cursor-pointer"
                >
                  {otp.length > 0 ? (isRTL ? 'مسح' : 'Clear') : <i className="fas fa-paste text-base"></i>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (otp.length < 6) setOtp(prev => prev + "0");
                  }}
                  className="h-12 sm:h-13 min-h-[48px] bg-slate-50 hover:bg-slate-100 active:bg-slate-200 active:scale-[0.97] border border-slate-200/80 rounded-2xl text-2xl font-black text-slate-900 tabular-nums transition-all flex items-center justify-center select-none cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOtp(prev => prev.slice(0, -1));
                  }}
                  aria-label={isRTL ? 'حذف رقم' : 'Delete digit'}
                  className="h-12 sm:h-13 min-h-[48px] bg-slate-100/80 hover:bg-slate-200/80 active:scale-[0.97] border border-slate-200/70 rounded-2xl text-lg text-slate-700 transition-all flex items-center justify-center select-none cursor-pointer"
                >
                  <i className="fas fa-backspace"></i>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
