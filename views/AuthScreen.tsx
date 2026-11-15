
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserRole, User, Driver } from '../types';
import {  
  signInWithGoogle, 
  getRedirectResult,
  getUserProfile, 
  createUserProfile, 
  updateUserProfile,
  auth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  normalizePhone,
  resetPassword,
  signOut,
  verifyOtpNative,
  sendOtpNative,
  syncNativeAuthToWeb,
  waitForStableAuth,
  retryAuthCheck,
  createActiveSession,
  checkIsAdmin,
  db
} from '../services/firebaseBridge';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '../components/ui/Button';
import PassengerRegistration from './PassengerRegistration';
import PasskeySetup from '../components/PasskeySetup';
import PhoneBottomSheet from '../components/PhoneBottomSheet';
import { useLanguage } from '../contexts/LanguageContext';
import { signInWithCustomToken } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { useFeatureToggles } from '../hooks/useFeatureToggles';
import { CapacitorService } from '../services/capacitorService';
import { BiometricService } from '../services/biometricService';

interface AuthScreenProps {
  onLoginSuccess: (user: User | Driver) => void;
  onBackToStart?: () => void;
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

// Custom Branded Logo Component (New 3D Style)
const MowaslaLogo = ({ className = "w-48 h-48" }: { className?: string }) => (
  <div className={`${className} relative flex flex-col items-center justify-center`}>
    <img src="/logo.png" alt="Mowasla Logo" className="w-full h-full object-contain drop-shadow-xl" />
  </div>
);


export default function AuthScreen({ onLoginSuccess, onBackToStart }: AuthScreenProps) {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { phoneAuthEnabled } = useFeatureToggles();
  
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true); 
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const [authMethod, setAuthMethod] = useState<'landing' | 'main' | 'phone' | 'email' | 'forgot_password'>('main');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+20');
  const [otp, setOtp] = useState('');
  
  const [showPhoneBottomSheet, setShowPhoneBottomSheet] = useState(false);
  const [phoneForBottomSheet, setPhoneForBottomSheet] = useState('');
  const [showEmailFields, setShowEmailFields] = useState(false);
  
  const [verificationId, setVerificationId] = useState<string | null>(null); // For native auth flow
  
  const [isRegisteringPassenger, setIsRegisteringPassenger] = useState(false);
  const [showPasskeySetup, setShowPasskeySetup] = useState(false);
  const [tempAuthUser, setTempAuthUser] = useState<any>(null);

  const [resendCountdown, setResendCountdown] = useState(0);
  const [expirationCountdown, setExpirationCountdown] = useState(0);

  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const formCardRef = useRef<HTMLDivElement | null>(null);

  // Android Phone Biometric Email Login State
  const [hasSavedBiometric, setHasSavedBiometric] = useState<boolean>(() => BiometricService.hasSavedCredentials());
  const [savedBiometricEmail, setSavedBiometricEmail] = useState<string>(() => BiometricService.getSavedEmail());
  const [enableBiometricOnEmail, setEnableBiometricOnEmail] = useState<boolean>(true);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState<boolean>(false);
  const [fallbackBioModal, setFallbackBioModal] = useState<{
    title: string;
    subtitle: string;
    cancelText: string;
    email?: string;
    resolve: (confirmed: boolean) => void;
  } | null>(null);
  const autoPromptedBioRef = useRef<boolean>(false);

  useEffect(() => {
    BiometricService.registerFallbackPromptHandler((opts) => {
      return new Promise<boolean>((resolve) => {
        setFallbackBioModal({
          ...opts,
          resolve,
        });
      });
    });
    return () => {
      BiometricService.registerFallbackPromptHandler(null);
    };
  }, []);

  const refreshSavedBiometricState = useCallback(() => {
    const hasCreds = BiometricService.hasSavedCredentials();
    const savedMail = BiometricService.getSavedEmail();
    setHasSavedBiometric(hasCreds);
    setSavedBiometricEmail(savedMail);
    if (savedMail && !email) {
      setEmail(savedMail);
    }
  }, [email]);

  useEffect(() => {
    refreshSavedBiometricState();
  }, [refreshSavedBiometricState]);

  useEffect(() => {
    const checkNativeAuth = async () => {
      try {
        if (Capacitor.getPlatform() !== 'web') {
           const { user } = await FirebaseAuthentication.getCurrentUser();
           if (user) {
              await syncNativeAuthToWeb();
              await processLogin(user);
           }
        }
      } catch (e) {
        console.warn("Initial native auth check failed:", e);
      }
    };
    checkNativeAuth();

    // App Resume Lifecycle listener to refresh auth state
    const appStatelistener = CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
      if (isActive) {
        console.log("[APP RESUME]");
        try {
           const stableAuth = await waitForStableAuth(10000);
           if (stableAuth && !tempAuthUser) {
              await processLogin(stableAuth);
           }
        } catch (e) {
           console.warn("App resume auth refresh failed:", e);
        }
      }
    });

    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'PHONE_LOGIN_SUCCESS' && event.data?.token) {
        setShowPhoneBottomSheet(false);
        setIsLoading(true);
        try {
          const userCredential = await signInWithCustomToken(auth, event.data.token);
          await processLogin(userCredential.user);
        } catch (err) {
          console.error("Error signing in with custom token:", err);
          setError("Failed to sign in after phone verification.");
        } finally {
          setIsLoading(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Protect OTP / Phone Login routes
  useEffect(() => {
    if (phoneAuthEnabled === false) {
      if (authMethod === 'phone') {
        setAuthMethod('main');
        setError(t('phone_registration_disabled'));
      }
      if (showPhoneBottomSheet) {
        setShowPhoneBottomSheet(false);
        setError(t('phone_registration_disabled'));
      }
    }
  }, [phoneAuthEnabled, authMethod, showPhoneBottomSheet, t]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (expirationCountdown > 0) {
      timer = setTimeout(() => setExpirationCountdown(prev => prev - 1), 1000);
    } else if (expirationCountdown === 0 && verificationId) {
      setError(t('code_expired_error'));
      setVerificationId(null);
      setOtp('');
    }
    return () => clearTimeout(timer);
  }, [expirationCountdown, verificationId, t]);

  useEffect(() => {
    const handleOnline = () => {
      if (error === t('network_connection_failed_error')) setError(null);
    };
    const handleOffline = () => {
      setError(t('network_connection_failed_error'));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [error, t]);

  const getErrorMessage = (error: any) => {
    const code = (typeof error === 'string' ? error : (error?.code || error?.message || JSON.stringify(error))).toLowerCase();
    
    if (code.includes('permission-denied') || code.includes('auth/permission-denied')) return t('permission_denied');
    if (code.includes('invalid-verification-code') || code.includes('auth/invalid-verification-code')) return t('invalid_verif_code');
    if (code.includes('session-expired') || code.includes('auth/session-expired') || code.includes('auth/code-expired')) return t('session_expired');
    if (code.includes('timeout') || code.includes('auth/timeout')) return t('connection_timeout');
    
    if (code.includes('auth/invalid-email')) return t('err_invalid_email');
    if (code.includes('auth/user-not-found')) return t('err_user_not_found');
    if (code.includes('auth/wrong-password')) return t('err_wrong_pass');
    if (code.includes('auth/email-already-in-use')) return t('err_email_in_use');
    if (code.includes('auth/weak-password')) return t('err_weak_pass');
    if (code.includes('auth/too-many-requests')) return t('err_too_many');
    if (code.includes('auth/invalid-credential')) return t('err_invalid_cred'); 
    if (code.includes('auth/invalid-login-credentials')) return t('err_invalid_cred'); 
    
    if (code.includes('auth/code-expired')) return t('code_expired_error');
    if (code.includes('auth/invalid-verification-code')) return t('err_invalid_code');
    if (code.includes('auth/invalid-phone-number')) return t('invalid_phone_number_error');
    if (code.includes('auth/missing-phone-number')) return t('missing_phone_number_error');
    if (code.includes('auth/captcha-check-failed')) return t('captcha_check_failed_error');
    if (code.includes('auth/api-key-expired')) return t('api_key_expired');
    if (code.includes('auth/network-request-failed')) return t('network_connection_failed_error') + t('ensure_domain');
    
    // Explicit hint for SHA-1 error on native
    if (code.includes('auth/invalid-app-credential') || code.includes('configuration error')) return t('app_configuration_error');

    return error?.message || code;
  };

  const handleFieldFocus = useCallback(() => {
    window.setTimeout(() => {
      formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  }, []);

  const isProcessingLoginRef = useRef(false);

  const processLogin = useCallback(async (firebaseUser: any) => {
    if (!firebaseUser) {
        setIsLoading(false);
        setLoadingAction(null);
        return;
    }

    if (isProcessingLoginRef.current) {
        return;
    }
    isProcessingLoginRef.current = true;
    
    setIsLoading(true);
    try {
      const uid = firebaseUser.uid || firebaseUser.id;
      if (!uid) throw new Error("Missing User ID");

      const userEmail = firebaseUser.email;
      const userPhone = firebaseUser.phoneNumber;
      
      const isAdminUser = checkIsAdmin(userEmail, userPhone);

      if (isAdminUser) {
        console.log("👑 Admin verified in AuthScreen:", userEmail || userPhone);
        const adminProfile: User = {
          id: uid,
          name: 'WondersCo Admin',
          email: userEmail || 'wondersco@gmail.com',
          phone: userPhone || '+201024419931',
          role: UserRole.ADMIN,
          avatar: firebaseUser.photoURL || 'https://ui-avatars.com/api/?name=Admin',
          rating: 5.0,
          profileCompleted: true,
          hasPasskey: false,
          isApproved: true,
          status: 'approved'
        };

        try {
          await setDoc(doc(db, 'users', uid), {
            ...adminProfile,
            role: UserRole.ADMIN,
            isAdmin: true,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn("Admin setDoc warning:", e);
        }

        await createActiveSession(uid);
        onLoginSuccess(adminProfile);
        setIsLoading(false);
        setLoadingAction(null);
        return;
      }

      // Avoid a forced token refresh here; it adds noticeable latency on native OTP flows.
      try { await firebaseUser.getIdToken?.(); } catch(e) { console.warn("Initial token check failed", e); }

      // Try to fetch profile
      const existingProfile = await getUserProfile(uid);

      if (existingProfile) {
        existingProfile.id = existingProfile.id || uid;
        const isDriverApproved =
          existingProfile.role === UserRole.DRIVER ||
          (existingProfile as any).driverStatus === 'approved' ||
          (existingProfile as any).status === 'approved' ||
          existingProfile.kycStatus === 'APPROVED' ||
          existingProfile.isApproved === true;

        if (
          existingProfile.role === UserRole.ADMIN &&
          !checkIsAdmin(userEmail || existingProfile.email, userPhone)
        ) {
          existingProfile.role = (isDriverApproved || (existingProfile as any).vehicle) ? UserRole.DRIVER : UserRole.PASSENGER;
          delete (existingProfile as any).isAdmin;
        } else if (isDriverApproved && existingProfile.role !== UserRole.ADMIN) {
          existingProfile.role = UserRole.DRIVER;
        }

        const isExistingValidProfile = Boolean(
          existingProfile.profileCompleted ||
          existingProfile.name ||
          existingProfile.phone ||
          existingProfile.role === UserRole.DRIVER ||
          (existingProfile as any).driverStatus === 'approved' ||
          (existingProfile as any).driverStatus === 'pending' ||
          (existingProfile as any).vehicle
        );

        if (isExistingValidProfile) {
          if (!existingProfile.profileCompleted) {
            existingProfile.profileCompleted = true;
            updateUserProfile(uid, { profileCompleted: true }).catch(() => {});
          }
          await createActiveSession(uid);
          onLoginSuccess(existingProfile);
          return;
        }
      }

      setTempAuthUser(firebaseUser);
      setIsRegisteringPassenger(true);
      
    } catch (err) {
      console.warn("Profile check warning:", err);
      if (firebaseUser && !tempAuthUser) {
          setTempAuthUser(firebaseUser);
          setIsRegisteringPassenger(true);
      } else {
          setError(t('err_profile_check'));
      }
    } finally {
      isProcessingLoginRef.current = false;
      setIsLoading(false);
      setLoadingAction(null);
    }
  }, [onLoginSuccess, t, tempAuthUser]);

  useEffect(() => {
    let unsubscribe: () => void;

    const handleAuthCheck = async () => {
      try {
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult?.user) {
          await processLogin(redirectResult.user);
          return;
        }
      } catch (e: any) {
        const ignoredCodes = ['auth/popup-closed-by-user', 'auth/null-user', 'auth/operation-not-supported-in-this-environment'];
        if (!ignoredCodes.includes(e.code)) console.warn("Redirect check warning:", e);
      }

      unsubscribe = auth.onAuthStateChanged(async (user) => {
          console.log("[AUTH STATE] user changed:", user?.uid);
          if (user && !tempAuthUser) {
              await processLogin(user);
          } else if (!user) {
              setIsLoading(false);
          }
      });
    };

    handleAuthCheck();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [processLogin, tempAuthUser]);

  // Pre-warm GPS location while user is on the login/registration screen so Home Screen has instant coordinates
  useEffect(() => {
    const prewarmLocation = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const pos = await CapacitorService.getCurrentPosition();
          if (pos?.coords) {
            localStorage.setItem(
              'passenger_last_loc',
              JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
            );
          }
        } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              localStorage.setItem(
                'passenger_last_loc',
                JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
              );
            },
            () => {},
            { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 }
          );
        }
      } catch {}
    };
    prewarmLocation();
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setLoadingAction('google');
    setError(null);
    try {
      const user = await signInWithGoogle();
      if (user) await processLogin(user);
    } catch (err: any) {
      console.error("Google Login Error:", err);
      if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(err.code) || err.message?.includes('cancelled')) {
         setIsLoading(false);
         setLoadingAction(null);
         return;
      }
      setError(getErrorMessage(err));
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password) return setError(t('err_fill_all'));
    setIsLoading(true);
    setLoadingAction('email');
    setError(null);
    setSuccessMessage(null);
    try {
      const cleanEmail = email.trim();
      const cred = authMode === 'signup' 
        ? await createUserWithEmailAndPassword(auth, cleanEmail, password)
        : await signInWithEmailAndPassword(auth, cleanEmail, password);

      if (enableBiometricOnEmail) {
        await BiometricService.saveCredentials(cleanEmail, password, cred.user.uid);
        setHasSavedBiometric(true);
        setSavedBiometricEmail(cleanEmail);
      }

      await processLogin(cred.user);
    } catch (err: any) {
      setError(getErrorMessage(err)); 
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleBiometricEmailLogin = useCallback(async (isAutoTrigger: boolean = false) => {
    if (isLoading || isBiometricAuthenticating) return;

    const hasStored = BiometricService.hasSavedCredentials();
    const storedEmail = BiometricService.getSavedEmail();

    // If no credentials stored yet and user hasn't typed email & password
    if (!hasStored && (!email.trim() || !password)) {
      if (!isAutoTrigger) {
        setError(
          isRTL
            ? 'يرجى إنشاء حساب أو تسجيل الدخول بالبريد الإلكتروني أولاً لتفعيل الدخول المباشر ببصمة الهاتف.'
            : 'Please create an account or sign in with email once to activate direct phone biometric login.'
        );
      }
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsBiometricAuthenticating(true);

    try {
      const targetEmail = storedEmail || email.trim();
      const bioResult = await BiometricService.authenticateForEmailLogin({
        title: isRTL ? 'تسجيل الدخول ببصمة الهاتف' : 'Phone Biometric Login',
        subtitle: targetEmail
          ? (isRTL ? `المتابعة بحساب ${targetEmail}` : `Sign in as ${targetEmail}`)
          : (isRTL ? 'ضع بصمة إصبعك لتسجيل الدخول المباشر' : 'Touch fingerprint sensor to sign in directly'),
        cancelText: isRTL ? 'إدخال كلمة المرور' : 'Use Password',
      });

      if (!bioResult.success) {
        if (!bioResult.cancelled && bioResult.error && !isAutoTrigger) {
          setError(bioResult.error);
        }
        setIsBiometricAuthenticating(false);
        return;
      }

      const loginEmail = (bioResult.email || email).trim();
      const loginPassword = bioResult.password || password;

      if (!loginEmail || !loginPassword) {
        if (!isAutoTrigger) {
          setError(
            isRTL
              ? 'يرجى إدخال كلمة المرور لربط الحساب ببصمة الهاتف لأول مرة.'
              : 'Please enter your password once to link your account with phone biometrics.'
          );
        }
        setIsBiometricAuthenticating(false);
        return;
      }

      setEmail(loginEmail);
      setIsLoading(true);
      setLoadingAction('biometric');

      const cred = authMode === 'signup' && !hasStored
        ? await createUserWithEmailAndPassword(auth, loginEmail, loginPassword)
        : await signInWithEmailAndPassword(auth, loginEmail, loginPassword);

      await BiometricService.saveCredentials(loginEmail, loginPassword, cred.user.uid);
      setHasSavedBiometric(true);
      setSavedBiometricEmail(loginEmail);

      await processLogin(cred.user);
    } catch (err: any) {
      console.error('Biometric Email Login Error:', err);
      setError(getErrorMessage(err));
      setIsLoading(false);
      setLoadingAction(null);
    } finally {
      setIsBiometricAuthenticating(false);
    }
  }, [authMode, email, isBiometricAuthenticating, isLoading, isRTL, password, processLogin]);

  // Auto-trigger phone biometric prompt when user opens "Continue with Email" in login mode and has saved credentials
  useEffect(() => {
    if (showEmailFields && authMode === 'login' && BiometricService.hasSavedCredentials()) {
      const savedMail = BiometricService.getSavedEmail();
      if (savedMail && !email) {
        setEmail(savedMail);
      }
      if (!autoPromptedBioRef.current) {
        autoPromptedBioRef.current = true;
        const timer = setTimeout(() => {
          handleBiometricEmailLogin(true);
        }, 220);
        return () => clearTimeout(timer);
      }
    } else if (!showEmailFields) {
      autoPromptedBioRef.current = false;
    }
  }, [showEmailFields, authMode, email, handleBiometricEmailLogin]);

  const handleSendOtp = () => {
    if (isLoading) return;
    
    handleConfirmOtpMethod();
  };



  const handleConfirmOtpMethod = async () => {
    // If no phone number yet, just switch to phone entry view
    if (!phoneNumber) {
        setAuthMethod('phone');
        return;
    }

    // Simple phone length validation
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
        setError(t('err_invalid_phone'));
        return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    
    // Clear old state before new session
    setVerificationId(null);
    setOtp('');
    
    // STRICT FORMATTING: Remove all non-digits, then prepend country code
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    let finalPhone = digitsOnly;
    
    // Remove leading zero if present
    if (finalPhone.startsWith('0')) {
        finalPhone = finalPhone.substring(1);
    }
    
    const fullPhone = `${countryCode}${finalPhone}`;
    console.debug(`Attempting NATIVE SMS OTP for:`, fullPhone);

    try {
        if (Capacitor.getPlatform() !== 'web') {
            const result = await sendOtpNative(fullPhone);
            
            if (result && result.verificationId) {
                if (result.verificationId === 'AUTO_VERIFIED') {
                    console.log("Phone number auto-verified. Fetching user...");
                    const { user } = await FirebaseAuthentication.getCurrentUser();
                    if (user) {
                        await processLogin(user);
                    } else {
                        throw new Error(t('err_otp_send_failed') || "Failed to retrieve user after auto-verification.");
                    }
                    return;
                }
                
                console.log("[AUTH] OTP sent:", result.verificationId);
                setVerificationId(result.verificationId);
                setAuthMethod('phone'); 
                setResendCountdown(60);
                setExpirationCountdown(300);
                setSuccessMessage(t('otp_sent_success'));
            } else {
                console.error("فشل في استلام الـ ID بعد رجوع المتصفح:", result);
                throw new Error(t('err_otp_send_failed') || "Failed to receive verification ID.");
            }
        } else {
            // WEB FALLBACK: If we are on web, we might still want the bottom sheet or a direct redirect
            // But since user wants "native", let's prioritize native. 
            // For web, if they click this, we can show an error or use the bottom sheet.
            setPhoneForBottomSheet(fullPhone);
            setShowPhoneBottomSheet(true);
        }
    } catch (err: any) {
      console.error("OTP Send Error:", err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || !verificationId || isVerifyingOtp) return;

    setIsVerifyingOtp(true);
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      console.log("[AUTH] verifying credential");
      // Use the bridged verifyOtpNative which handles syncing Native and Web SDKs
      const result = await verifyOtpNative(verificationId, otp);

      if (result && result.user) {
        const bridgedUser = auth.currentUser || await syncNativeAuthToWeb().catch(() => null);
        const syncedUser = bridgedUser || await retryAuthCheck(6) || result.user;
        console.log("[AUTH] currentUser ready", syncedUser?.uid || syncedUser?.id);
        await processLogin(syncedUser);
      } else {
        throw new Error("User not found after verification");
      }
    } catch (err: any) {
      console.error("OTP Verification Error:", err);
      setError(getErrorMessage(err));
      setOtp(''); 
    } finally {
      setIsLoading(false);
      setIsVerifyingOtp(false);
    }
  };


  const handlePasswordReset = async () => {
    if (!email) {
      setError(t('err_invalid_email'));
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await resetPassword(email);
      setSuccessMessage(t('reset_link_sent_desc'));
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePassengerRegistrationComplete = async (details: any) => {
    let uid = auth.currentUser?.uid || tempAuthUser?.uid || tempAuthUser?.id;
    if (!uid) {
        const stableUser = await waitForStableAuth(2500);
        uid = stableUser?.uid;
    }
    
    if (!uid) {
        console.error("Auth session not found. Cannot write to Firestore.");
        setError(t('auth_error_retry') || "Your session has expired or not fully synced. Please try logging in again.");
        throw new Error("Missing UID");
    }
    const final: User = { 
        ...details, 
        id: uid, 
        role: UserRole.PASSENGER, 
        profileCompleted: true,
        onboardingCompleted: true,
        driverStatus: 'none',
        hasPasskey: false,
        privacySettings: {
          requirePinOnStartup: false,
          autoLockTimeout: '5m',
          biometricUnlockEnabled: BiometricService.hasSavedCredentials() || enableBiometricOnEmail,
          maskPhoneNumber: true,
          shareLocationOnlyDuringRide: true,
          hideWalletBalance: false,
          loginAlertsEnabled: true,
          rideVerificationPinEnabled: true,
          incognitoRideHistory: false,
        }
    };
    try {
      console.log("[FIRESTORE] writing user profile for:", uid);
      await createUserProfile(final);
      await createActiveSession(uid);
      setTempAuthUser(final);
      setIsRegisteringPassenger(false);
      onLoginSuccess(final);
    } catch (e: any) { 
      console.error("Error saving passenger profile:", e);
      setError(t('err_save_pax') || (e.message?.includes('permission') ? "Permission denied. Please log in again." : "Failed to save profile.")); 
      throw e;
    }
  };
  
  const finishAuth = async (hasAppPinSet: boolean = false) => {
    if (tempAuthUser) {
        setIsLoading(true);
        try {
            const uid = tempAuthUser.uid || tempAuthUser.id;
            const profilePatch = {
                hasPasskey: hasAppPinSet,
                onboardingCompleted: true
            };
            const updatedUser = { 
                ...tempAuthUser,
                id: uid,
                ...profilePatch
            };
            console.log("Finishing auth for user:", uid);
            await updateUserProfile(uid, profilePatch);
            setShowPasskeySetup(false);
            setTempAuthUser(updatedUser);
            onLoginSuccess(updatedUser);
        } catch (e: any) {
            console.error("Error in finishAuth:", e);
            setError(t('err_profile_check') || "An error occurred while finishing setup.");
        } finally {
            setIsLoading(false);
        }
    }
  };

  if (showPasskeySetup) return <PasskeySetup onComplete={() => finishAuth(true)} onSkip={() => finishAuth(false)} />;

  if (isRegisteringPassenger && tempAuthUser) return (
    <PassengerRegistration 
      baseUser={{ 
        name: tempAuthUser.displayName || tempAuthUser.name || '', 
        phone: tempAuthUser.phoneNumber || tempAuthUser.phone || '',
        email: tempAuthUser.email || '' 
      }} 
      onComplete={handlePassengerRegistrationComplete} 
    />
  );

  return (
    <div className="h-[100dvh] w-full relative bg-gradient-to-b from-slate-50 via-[#f8fafc] to-[#eef2f6] flex flex-col justify-between overflow-hidden font-sans select-none" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Ambient Glows & Mobility Map Pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[340px] bg-gradient-to-b from-amber-400/20 via-amber-200/10 to-transparent blur-3xl rounded-full"></div>
        <div className="absolute top-1/4 -right-24 w-80 h-80 bg-blue-400/10 blur-3xl rounded-full"></div>
        <div className="absolute bottom-10 -left-24 w-80 h-80 bg-amber-300/10 blur-3xl rounded-full"></div>
        
        {/* Stylized Transit Route Vector */}
        <svg className="absolute inset-0 w-full h-full opacity-35 stroke-slate-300/60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
            </linearGradient>
            <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
              <path d="M 44 0 L 0 0 0 44" fill="none" stroke="rgba(148, 163, 184, 0.12)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <path d="M -50,140 C 120,170 200,70 340,130 C 480,190 520,310 650,270" fill="none" stroke="url(#routeGradient)" strokeWidth="3" strokeDasharray="6 6" />
          <path d="M 80,450 C 220,390 280,550 450,470 C 580,410 620,540 720,510" fill="none" stroke="url(#routeGradient)" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
      </div>

      {/* Top Header Section (Logo + Lang) */}
      <div className="relative z-20 w-full max-w-[500px] mx-auto flex justify-between items-center pt-[calc(env(safe-area-inset-top,16px)+12px)] px-5">
          <div className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 p-1.5 shadow-xs flex items-center justify-center">
              <img src="/logo.png" alt="Mowasla" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col text-start rtl:text-right">
              <span className="font-black text-slate-900 text-sm tracking-tight leading-none">مواصلة<span className="text-[#FFC90E]">.</span></span>
              <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase mt-0.5">Mowasla</span>
            </div>
          </div>

          <button 
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')} 
            className="bg-white/90 backdrop-blur-md border border-slate-200/90 px-3.5 py-1.5 rounded-full font-black text-xs shadow-xs flex items-center gap-2 text-slate-700 hover:text-slate-950 hover:bg-white transition-all active:scale-95 cursor-pointer"
          >
            <i className="fas fa-globe text-amber-500 text-xs"></i>
            <span>{language === 'en' ? t('lang_toggle_short_ar') : t('lang_toggle_short_en')}</span>
          </button>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 w-full max-w-[500px] mx-auto flex flex-col px-5 pb-[calc(env(safe-area-inset-bottom,16px)+16px)] z-10 relative overflow-y-auto ${authMethod === 'phone' && verificationId ? 'justify-start pt-3' : 'justify-end'}`}>
         
         {authMethod === 'landing' ? (
            <div className="w-full flex flex-col animate-fade-in">
              {/* Hero Title & Status */}
              <div className="mb-5 text-start rtl:text-right w-full">
                <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-50/90 backdrop-blur-md px-3.5 py-1 text-xs font-black text-amber-900 shadow-xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>{t('ready_to_ride')}</span>
                </div>
                
                <h1 className="text-[34px] sm:text-[40px] font-black leading-[1.08] text-slate-900 tracking-tight">
                  {t('city_rides_title')}
                </h1>
                <p className="mt-2 text-[15px] sm:text-[17px] font-medium leading-relaxed text-slate-600 max-w-[95%]">
                  {t('city_rides_desc')}
                </p>
              </div>

              {/* Modern Mobility Showcase Card */}
              <div className="w-full relative mb-6 rounded-[28px] border border-slate-200/80 bg-white/95 backdrop-blur-xl p-5 sm:p-6 shadow-lg shadow-slate-200/60 overflow-hidden">
                {/* Top Badge & Mode */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-[#FFD026] to-[#F59E0B] text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20">
                      <i className="fas fa-location-arrow text-sm"></i>
                    </div>
                    <div className="text-left rtl:text-right min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">
                        {t('ride_mode_label')}
                      </div>
                      <div className="text-[13px] font-bold text-slate-800 truncate">
                        {t('fast_direct_clear')}
                      </div>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[10px] font-black flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{isRTL ? "متاح الآن" : "Available"}</span>
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-1 leading-snug">
                  {t('onboarding_title_1')}<span className="text-[#FFC90E]">.</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  {t('onboarding_desc_1')}
                </p>

                {/* Micro Perks Highlights */}
                <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <i className="fas fa-coins text-amber-500 text-xs shrink-0"></i>
                    <span className="truncate">{isRTL ? "سعر عادل" : "Fair Fare"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <i className="fas fa-shield-alt text-emerald-500 text-xs shrink-0"></i>
                    <span className="truncate">{isRTL ? "أمان تام" : "Verified"}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <i className="fas fa-bolt text-blue-500 text-xs shrink-0"></i>
                    <span className="truncate">{isRTL ? "وصول فوري" : "Instant"}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 w-full">
                <button 
                  onClick={() => { setAuthMode('signup'); setAuthMethod('main'); }} 
                  className="w-full min-h-[68px] sm:min-h-[72px] rounded-[24px] bg-gradient-to-r from-[#FFC90E] via-[#FFD026] to-[#F59E0B] text-slate-950 hover:brightness-105 active:scale-[0.985] shadow-lg shadow-amber-500/25 border border-amber-300/60 flex items-center justify-between px-6 transition-all duration-200 group cursor-pointer"
                >
                  <div className="text-start rtl:text-right">
                    <div className="text-lg font-black tracking-tight">{t('get_started')}</div>
                    <div className="text-xs font-bold text-slate-900/75 mt-0.5">{t('create_account_go')}</div>
                  </div>
                  <span className="w-11 h-11 rounded-full bg-slate-950 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform">
                    <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'} text-sm`}></i>
                  </span>
                </button>
                
                <button 
                  onClick={() => { setAuthMode('login'); setAuthMethod('main'); }} 
                  className="w-full min-h-[66px] sm:min-h-[70px] rounded-[24px] bg-white/95 hover:bg-white border border-slate-200/90 hover:border-slate-300 text-slate-900 font-bold shadow-sm hover:shadow-md active:scale-[0.985] flex items-center justify-between px-6 transition-all duration-200 group cursor-pointer"
                >
                  <div className="text-start rtl:text-right">
                    <div className="text-lg font-black tracking-tight">{t('login_btn')}</div>
                    <div className="text-xs font-bold text-slate-500 mt-0.5">{t('access_current_account')}</div>
                  </div>
                  <span className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                    <i className="fas fa-user-circle text-lg"></i>
                  </span>
                </button>
              </div>

              {/* Trust Badge Footer */}
              <div className="mt-3.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <i className="fas fa-shield-alt text-emerald-500 text-xs"></i>
                  {isRTL ? "رحلات موثوقة ومؤمنة" : "Safe & verified rides"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1.5">
                  <i className="fas fa-bolt text-amber-500 text-xs"></i>
                  {isRTL ? "تسعير فوري ومباشر" : "Instant direct pricing"}
                </span>
                <span className="text-slate-300">•</span>
                <a
                  href="/privacy-policy"
                  className="text-slate-500 hover:text-slate-900 underline underline-offset-4 transition-colors"
                >
                  {t('privacy_policy')}
                </a>
              </div>
            </div>
         ) : (
            <div 
                className={`w-full bg-white/98 backdrop-blur-2xl rounded-[28px] border border-slate-200/90 shadow-xl relative overflow-hidden ${authMethod === 'phone' && verificationId ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}`}
                ref={formCardRef}
            >
                   {/* Header of Auth Flow */}
                   {!showEmailFields && authMethod !== 'forgot_password' && (
                     <div className={`${authMethod === 'phone' && verificationId ? 'mb-4' : 'mb-7'} text-center flex flex-col items-center relative`}>
                         <button
                           type="button"
                           onClick={() => {
                             setError(null);
                             if (authMethod !== 'main' || showEmailFields) {
                               setAuthMethod('main');
                               setShowEmailFields(false);
                               setVerificationId(null);
                             } else if (onBackToStart) {
                               onBackToStart();
                             } else {
                               setAuthMethod('landing');
                             }
                           }}
                           aria-label={t('close')}
                           className="absolute -top-1 right-0 rtl:left-0 rtl:right-auto w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
                         >
                             <i className="fas fa-times text-sm"></i>
                         </button>

                         {authMethod === 'main' && (
                             <>
                                 <div className="w-16 h-16 rounded-[20px] bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 shadow-sm mt-4">
                                     <i className="fas fa-fingerprint text-3xl text-slate-800"></i>
                                 </div>
                                 <h3 className="text-[28px] font-black text-slate-900 tracking-tight">{t('welcome_back_title')}</h3>
                                 <p className="text-slate-500 font-medium mt-1">{t('slogan')}</p>
                             </>
                         )}

                         {authMethod === 'phone' && !verificationId && (
                             <>
                                 <div className="w-14 h-14 rounded-2xl bg-[#facc15]/20 border border-[#facc15]/40 flex items-center justify-center mb-3.5 text-slate-900 mt-3 shadow-xs">
                                     <i className="fas fa-phone-alt text-xl"></i>
                                 </div>
                                 <h3 className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight">{t('enter_phone_title')}</h3>
                                 <p className="text-slate-500 font-medium text-sm mt-1">{t('send_verification_desc')}</p>
                             </>
                         )}

                         {authMethod === 'phone' && verificationId && (
                             <div className="w-full pt-1 flex flex-col items-center">
                                 <div className="w-11 h-11 rounded-2xl bg-[#FFC90E]/20 border border-[#FFC90E]/40 flex items-center justify-center mb-2.5 text-slate-900">
                                     <i className="fas fa-shield-alt text-lg"></i>
                                 </div>
                                 <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                                     {isRTL ? 'تأكيد رمز التحقق' : 'Verify OTP Code'}
                                 </h3>
                                 <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1 leading-relaxed max-w-[300px]">
                                     {t('enter_code_sent_to')}
                                 </p>
                                 <div className="mt-1.5 flex items-center justify-center gap-2 text-sm">
                                     <span className="font-black text-slate-900 text-base tracking-wide tabular-nums" dir="ltr">
                                         ({normalizePhone(phoneNumber, countryCode)})
                                     </span>
                                     <span aria-hidden="true" className="text-slate-300">·</span>
                                     <button
                                       type="button"
                                       onClick={() => { setVerificationId(null); setOtp(''); setError(null); setResendCountdown(0); setExpirationCountdown(0); }}
                                       className="text-xs font-bold text-slate-500 hover:text-slate-900 underline underline-offset-4 transition-colors cursor-pointer"
                                     >
                                         {t('change_phone')}
                                     </button>
                                 </div>
                             </div>
                         )}
                     </div>
                   )}

                   {/* Error State */}
                   {error && (
                        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-[20px] text-sm mb-6 flex flex-col items-center gap-3">
                            <div className="flex items-start gap-3 w-full">
                                <i className="fas fa-exclamation-circle text-lg mt-0.5"></i>
                                <p className="font-bold leading-relaxed flex-1">{error}</p>
                            </div>
                        </div>
                   )}

                   {authMethod === 'main' && (
                       <div className="space-y-4">
                              {!showEmailFields ? (
                                  <>
                                      <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full h-[68px] rounded-[24px] bg-white border border-slate-200 text-slate-900 font-black text-lg flex items-center px-4 relative overflow-hidden transition-transform active:scale-[0.98] shadow-sm hover:shadow-md">
                                          <div className="w-12 h-12 rounded-[18px] bg-slate-50 flex items-center justify-center shrink-0 mr-4 rtl:ml-4 rtl:mr-0 border border-slate-100">
                                              {isLoading && loadingAction === 'google' ? <i className="fas fa-circle-notch fa-spin text-blue-600"></i> : <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" />}
                                          </div>
                                          <span className="flex-1 text-start">{t('continue_google')}</span>
                                          <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-slate-300 text-sm`}></i>
                                      </button>

                                      {phoneAuthEnabled !== false && (
                                          <button onClick={handleSendOtp} disabled={isLoading} className="w-full h-[68px] rounded-[24px] bg-[#facc15] text-[#0f172a] font-black text-lg flex items-center px-4 relative overflow-hidden transition-transform active:scale-[0.98] shadow-sm hover:shadow-md">
                                              <div className="w-12 h-12 rounded-[18px] bg-white/20 flex items-center justify-center shrink-0 mr-4 rtl:ml-4 rtl:mr-0">
                                                  {isLoading && loadingAction === 'phone' ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-phone-alt"></i>}
                                              </div>
                                              <span className="flex-1 text-start">{t('continue_phone')}</span>
                                              <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-[#0f172a]/40 text-sm`}></i>
                                          </button>
                                      )}

                                      <div className="relative flex py-4 items-center">
                                          <div className="flex-grow border-t border-slate-200"></div>
                                          <span className="mx-4 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em]">{t('or_email')}</span>
                                          <div className="flex-grow border-t border-slate-200"></div>
                                      </div>

                                      <button onClick={() => { setError(null); setShowEmailFields(true); }} className="w-full h-[68px] rounded-[24px] bg-white border border-slate-200 text-slate-700 font-black text-lg flex items-center px-4 relative overflow-hidden transition-transform active:scale-[0.98] shadow-sm hover:shadow-md">
                                          <div className="w-12 h-12 rounded-[18px] bg-slate-50 flex items-center justify-center shrink-0 mr-4 rtl:ml-4 rtl:mr-0 border border-slate-100">
                                              <i className="fas fa-envelope text-slate-400"></i>
                                          </div>
                                          <div className="flex-1 text-start min-w-0">
                                              <div className="truncate">{t('continue_email')}</div>
                                              {hasSavedBiometric && savedBiometricEmail && (
                                                  <div className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 truncate mt-0.5">
                                                      <i className="fas fa-fingerprint text-[10px]"></i>
                                                      <span className="truncate" dir="ltr">{savedBiometricEmail}</span>
                                                  </div>
                                              )}
                                          </div>
                                          {hasSavedBiometric ? (
                                              <span className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-600 flex items-center justify-center shrink-0">
                                                  <i className="fas fa-fingerprint text-base"></i>
                                              </span>
                                          ) : (
                                              <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-slate-300 text-sm`}></i>
                                          )}
                                      </button>
                                  </>
                              ) : (
                                  <div className="space-y-3.5">
                                      <div className="flex items-center gap-3 mb-1">
                                          <button type="button" onClick={() => { setShowEmailFields(false); setError(null); }} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer">
                                              <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'}`}></i>
                                          </button>
                                          <h3 className="text-xl font-black text-slate-900">{t('continue_email')}</h3>
                                      </div>

                                      <div className="relative group">
                                          <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-5' : 'left-5'} text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none z-10`}>
                                              <i className="fas fa-envelope text-lg"></i>
                                          </div>
                                          <input
                                              type="email"
                                              value={email}
                                              onChange={e => setEmail(e.target.value)}
                                              onFocus={handleFieldFocus}
                                              className={`w-full h-[64px] bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-[20px] outline-none font-black text-lg text-slate-900 transition-all shadow-sm ${isRTL ? 'pr-16 pl-4' : 'pl-16 pr-4'}`}
                                              placeholder={t('placeholder_email')}
                                              dir="auto"
                                          />
                                      </div>

                                      <div className="relative group">
                                          <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-5' : 'left-5'} text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none z-10`}>
                                              <i className="fas fa-lock text-lg"></i>
                                          </div>
                                          <input
                                              type={showPassword ? "text" : "password"}
                                              value={password}
                                              onChange={e => setPassword(e.target.value)}
                                              onFocus={handleFieldFocus}
                                              className={`w-full h-[64px] bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-[20px] outline-none font-black text-lg text-slate-900 transition-all shadow-sm ${isRTL ? 'pr-16 pl-12' : 'pl-16 pr-12'}`}
                                              placeholder={t('placeholder_password')}
                                              dir="auto"
                                          />
                                          <button type="button" onClick={() => setShowPassword(!showPassword)} className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'left-4' : 'right-4'} text-slate-400 hover:text-slate-600 transition-colors w-10 h-10 flex items-center justify-center cursor-pointer`}>
                                              <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                          </button>
                                      </div>

                                      {/* Toggle to enable biometric login on account creation or first sign-in */}
                                      {(authMode === 'signup' || !hasSavedBiometric) && (
                                          <div
                                              onClick={() => setEnableBiometricOnEmail(!enableBiometricOnEmail)}
                                              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-100/80 transition-colors"
                                          >
                                              <div className="flex items-center gap-2.5 min-w-0">
                                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${enableBiometricOnEmail ? 'bg-amber-400/20 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                                                      <i className="fas fa-fingerprint text-sm"></i>
                                                  </div>
                                                  <div className="text-start min-w-0">
                                                      <div className="text-xs font-black text-slate-800 truncate">
                                                          {isRTL ? 'تفعيل الدخول المباشر ببصمة الهاتف' : 'Enable direct phone biometric login'}
                                                      </div>
                                                      <div className="text-[10px] font-bold text-slate-500 truncate">
                                                          {isRTL ? 'تسجيل دخول فوري بالبصمة بعد إنشاء الحساب' : 'Sign in instantly with fingerprint next time'}
                                                      </div>
                                                  </div>
                                              </div>
                                              <div className={`w-10 h-5.5 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${enableBiometricOnEmail ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                                  <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform ${enableBiometricOnEmail ? (isRTL ? '-translate-x-4.5' : 'translate-x-4.5') : ''}`} />
                                              </div>
                                          </div>
                                      )}

                                      <div className="flex items-center gap-2.5 pt-1">
                                          <Button
                                              onClick={handleEmailAuth}
                                              isLoading={isLoading && loadingAction === 'email'}
                                              disabled={isLoading || isBiometricAuthenticating}
                                              className="flex-1 h-[62px] bg-[#facc15] text-[#0f172a] hover:bg-amber-400 border border-[#facc15] rounded-[20px] shadow-sm font-black text-xl tracking-wide transition-all"
                                          >
                                              {authMode === 'login' ? t('login_btn') : t('signup_btn')}
                                          </Button>

                                          {authMode === 'login' && (
                                              <button
                                                  type="button"
                                                  onClick={() => handleBiometricEmailLogin(false)}
                                                  disabled={isLoading || isBiometricAuthenticating}
                                                  aria-label={isRTL ? 'تسجيل الدخول بالبصمة' : 'Sign in with Biometrics'}
                                                  className={`w-[62px] h-[62px] rounded-[20px] border-2 flex flex-col items-center justify-center shrink-0 transition-all active:scale-95 cursor-pointer shadow-sm ${
                                                      hasSavedBiometric
                                                          ? 'bg-slate-900 border-slate-900 text-[#facc15] hover:bg-slate-800'
                                                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                                  }`}
                                              >
                                                  {isBiometricAuthenticating || (isLoading && loadingAction === 'biometric') ? (
                                                      <i className="fas fa-circle-notch fa-spin text-xl"></i>
                                                  ) : (
                                                      <i className="fas fa-fingerprint text-2xl"></i>
                                                  )}
                                              </button>
                                          )}
                                      </div>

                                      {/* Direct One-Tap Biometric Card when user has saved email credentials */}
                                      {authMode === 'login' && hasSavedBiometric && savedBiometricEmail && (
                                          <button
                                              type="button"
                                              onClick={() => handleBiometricEmailLogin(false)}
                                              disabled={isLoading || isBiometricAuthenticating}
                                              className="w-full p-3.5 rounded-[20px] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-800 shadow-md flex items-center justify-between gap-3 active:scale-[0.985] transition-all cursor-pointer group"
                                          >
                                              <div className="flex items-center gap-3 min-w-0">
                                                  <div className="w-11 h-11 rounded-2xl bg-[#facc15]/20 border border-[#facc15]/40 text-[#facc15] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                                      {isBiometricAuthenticating || (isLoading && loadingAction === 'biometric') ? (
                                                          <i className="fas fa-circle-notch fa-spin text-lg"></i>
                                                      ) : (
                                                          <i className="fas fa-fingerprint text-xl"></i>
                                                      )}
                                                  </div>
                                                  <div className="text-start min-w-0">
                                                      <div className="text-sm font-black text-white leading-tight">
                                                          {isRTL ? 'دخول مباشر ببصمة الهاتف' : 'Direct Login with Biometrics'}
                                                      </div>
                                                      <div className="text-[11px] font-bold text-slate-300 truncate mt-0.5" dir="ltr">
                                                          {savedBiometricEmail}
                                                      </div>
                                                  </div>
                                              </div>
                                              <span className="px-3 py-1.5 rounded-xl bg-[#facc15] text-slate-950 text-xs font-black shrink-0">
                                                  {isRTL ? 'بصمة' : 'Touch ID'}
                                              </span>
                                          </button>
                                      )}

                                      <div className="pt-3 flex items-center justify-between px-2">
                                          <button
                                              type="button"
                                              onClick={() => {
                                                  setError(null);
                                                  setAuthMode(authMode === 'login' ? 'signup' : 'login');
                                              }}
                                              className="text-slate-500 font-bold text-sm hover:text-slate-800 transition-colors cursor-pointer"
                                          >
                                              {authMode === 'login' ? t('no_account') + ' ' + t('signup_btn') : t('has_account') + ' ' + t('login_btn')}
                                          </button>
                                          {authMode === 'login' && (
                                              <button
                                                  type="button"
                                                  onClick={() => {
                                                      setError(null);
                                                      setAuthMethod('forgot_password');
                                                  }}
                                                  className="text-blue-600 font-bold text-sm hover:text-blue-800 transition-colors cursor-pointer"
                                              >
                                                  {t('forgot_password')}
                                              </button>
                                          )}
                                      </div>
                                  </div>
                              )}
                          </div>
                       )}

                       {authMethod === 'phone' && (
                          <div className="space-y-4">
                              {!verificationId ? (
                                  <>
                                      <div className="flex bg-white rounded-2xl border border-slate-200 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-[#FFC90E]/30 transition-all shadow-xs h-[64px] overflow-hidden" dir="ltr">
                                          <div className="relative flex items-center justify-center border-r border-slate-200 bg-slate-50 shrink-0 px-3">
                                              <div className="flex items-center justify-center pointer-events-none gap-1.5">
                                                  <span className="text-sm font-bold text-slate-900 flex items-center tabular-nums">
                                                    {ARAB_COUNTRIES.find(c => c.code === countryCode)?.flag}
                                                    <span className="ml-1.5" dir="ltr">{countryCode}</span>
                                                  </span>
                                                  <i className="fas fa-chevron-down text-[10px] text-slate-400"></i>
                                              </div>
                                              <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="absolute inset-0 opacity-0 outline-none cursor-pointer z-10 w-full h-full">
                                                {ARAB_COUNTRIES.map(c => (
                                                  <option key={c.code} value={c.code}>{c.flag} {t(c.key)} ({c.code})</option>
                                                ))}
                                              </select>
                                          </div>
                                          <input type="tel" inputMode="numeric" pattern="[0-9]*" maxLength={15} value={phoneNumber} onChange={e => { let val = e.target.value.replace(/\D/g, ''); if (val.startsWith('0')) val = val.substring(1); setPhoneNumber(val); }} className="flex-1 w-full min-w-0 h-full px-4 bg-transparent outline-none text-xl font-bold tracking-wider tabular-nums placeholder-slate-300 text-slate-900" placeholder="10 2441 9931" dir="ltr" />
                                      </div>
                                      <Button onClick={handleSendOtp} isLoading={isLoading} className="w-full h-[60px] bg-[#FFC90E] text-slate-950 hover:bg-amber-400 rounded-2xl shadow-sm font-black text-lg tracking-wide transition-all active:scale-[0.98]" disabled={!phoneNumber || isLoading}>{t('send_code')}</Button>
                                  </>
                              ) : (
                                  <div className="flex flex-col items-center">
                                      {/* 6 Individual OTP Digit Boxes at the top */}
                                      <div className="relative w-full mb-4" dir="ltr">
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            autoComplete="one-time-code"
                                            value={otp}
                                            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            maxLength={6}
                                            aria-label={t('enter_code_sent_to')}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                          />
                                          <div className="grid grid-cols-6 gap-2 sm:gap-2.5 w-full">
                                              {[0, 1, 2, 3, 4, 5].map((index) => {
                                                  const isActive = otp.length === index || (otp.length === 6 && index === 5);
                                                  const isFilled = otp.length > index;
                                                  return (
                                                      <div
                                                        key={index}
                                                        className={`h-14 sm:h-[60px] rounded-2xl border-2 flex items-center justify-center text-2xl sm:text-[26px] font-black tabular-nums transition-all duration-150 ${
                                                          isActive
                                                            ? 'border-slate-900 bg-white ring-4 ring-[#FFC90E]/30 text-slate-900 shadow-sm'
                                                            : isFilled
                                                            ? 'border-[#FFC90E] bg-amber-50/40 text-slate-900'
                                                            : 'border-slate-200 bg-slate-50/80 text-slate-300'
                                                        }`}
                                                      >
                                                          {otp[index] ? (
                                                            <span>{otp[index]}</span>
                                                          ) : (
                                                            <span className={`w-2 h-2 rounded-full transition-colors ${isActive ? 'bg-slate-900 animate-pulse' : 'bg-slate-300'}`} />
                                                          )}
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      </div>

                                      {/* Resend & Expiry Metadata Row */}
                                      <div className="w-full flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs font-bold text-slate-500 mb-4 tabular-nums">
                                          {resendCountdown > 0 ? (
                                              <span>{t('resend_code_in')} <strong className="text-slate-800">{resendCountdown}s</strong></span>
                                          ) : (
                                              <button
                                                type="button"
                                                onClick={handleSendOtp}
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

                                      {/* Verify CTA */}
                                      <Button
                                        onClick={handleVerifyOtp}
                                        isLoading={isLoading}
                                        className={`w-full h-14 rounded-2xl font-black text-lg tracking-wide transition-all active:scale-[0.98] mb-4 ${
                                          otp.length === 6
                                            ? 'bg-[#FFC90E] text-slate-950 hover:bg-amber-400 shadow-md shadow-amber-500/20'
                                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                                        }`}
                                        disabled={otp.length < 6 || isLoading}
                                      >
                                          {t('verify')}
                                      </Button>

                                      {/* Modern On-Screen Digits Keyboard */}
                                      <div className="w-full pt-3 border-t border-slate-100" dir="ltr">
                                          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full">
                                              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                                                  <button
                                                    key={digit}
                                                    type="button"
                                                    onClick={() => {
                                                      CapacitorService.impact().catch(() => {});
                                                      setOtp((prev) => (prev.length < 6 ? prev + digit : prev));
                                                    }}
                                                    className="h-12 sm:h-13 min-h-[48px] rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 active:scale-[0.97] border border-slate-200/80 text-xl sm:text-2xl font-black text-slate-900 tabular-nums transition-all duration-100 flex items-center justify-center select-none cursor-pointer"
                                                  >
                                                      {digit}
                                                  </button>
                                              ))}
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  CapacitorService.impact().catch(() => {});
                                                  if (otp.length > 0) {
                                                    setOtp('');
                                                    return;
                                                  }
                                                  try {
                                                    const clip = await navigator.clipboard?.readText?.();
                                                    const digits = (clip || '').replace(/\D/g, '').slice(0, 6);
                                                    if (digits) setOtp(digits);
                                                  } catch {}
                                                }}
                                                aria-label={otp.length > 0 ? (isRTL ? 'مسح الكل' : 'Clear all') : (isRTL ? 'لصق الرمز' : 'Paste code')}
                                                className="h-12 sm:h-13 min-h-[48px] rounded-2xl bg-slate-100/80 hover:bg-slate-200/80 active:scale-[0.97] border border-slate-200/70 text-xs font-black text-slate-600 transition-all duration-100 flex items-center justify-center select-none cursor-pointer"
                                              >
                                                  {otp.length > 0 ? (isRTL ? 'مسح' : 'Clear') : <i className="fas fa-paste text-base"></i>}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  CapacitorService.impact().catch(() => {});
                                                  setOtp((prev) => (prev.length < 6 ? prev + '0' : prev));
                                                }}
                                                className="h-12 sm:h-13 min-h-[48px] rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 active:scale-[0.97] border border-slate-200/80 text-xl sm:text-2xl font-black text-slate-900 tabular-nums transition-all duration-100 flex items-center justify-center select-none cursor-pointer"
                                              >
                                                  0
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  CapacitorService.impact().catch(() => {});
                                                  setOtp((prev) => prev.slice(0, -1));
                                                }}
                                                aria-label={isRTL ? 'حذف رقم' : 'Delete digit'}
                                                className="h-12 sm:h-13 min-h-[48px] rounded-2xl bg-slate-100/80 hover:bg-slate-200/80 active:scale-[0.97] border border-slate-200/70 text-lg text-slate-700 transition-all duration-100 flex items-center justify-center select-none cursor-pointer"
                                              >
                                                  <i className="fas fa-backspace"></i>
                                              </button>
                                          </div>
                                      </div>
                                  </div>
                              )}
                          </div>
                       )}

                       {authMethod === 'forgot_password' && (
                          <div className="space-y-6">
                              <div className="text-center mb-2 mt-4">
                                  <div className="w-16 h-16 rounded-[20px] bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 mx-auto text-slate-800 shadow-sm">
                                      <i className="fas fa-unlock-alt text-2xl"></i>
                                  </div>
                                  <h2 className="text-2xl font-black text-slate-900">{t('reset_password_title')}</h2>
                                  {!successMessage && <p className="text-slate-500 font-medium mt-2">{t('reset_password_desc')}</p>}
                              </div>

                              {successMessage ? (
                                  <div className="p-5 bg-green-500/10 border border-green-500/20 text-green-700 rounded-[20px] text-center font-bold">
                                      <h3 className="font-black mb-1">{t('reset_link_sent_title')}</h3>
                                      <p className="font-medium text-sm text-green-600/80">{successMessage}</p>
                                  </div>
                              ) : (
                                  <>
                                      <div className="relative group">
                                          <div className={`absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-5' : 'left-5'} text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none z-10`}>
                                              <i className="fas fa-envelope text-lg"></i>
                                          </div>
                                          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={`w-full h-[64px] bg-white border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-[20px] outline-none font-black text-lg text-slate-900 transition-all shadow-sm ${isRTL ? 'pr-16 pl-4' : 'pl-16 pr-4'}`} placeholder={t('email_label')} autoFocus />
                                      </div>
                                      <Button onClick={handlePasswordReset} isLoading={isLoading} className="w-full h-[64px] bg-[#facc15] text-[#0f172a] hover:bg-white border border-[#facc15] hover:border-slate-200 rounded-[20px] shadow-sm font-black text-xl tracking-wide">
                                          {t('send_reset_link')}
                                      </Button>
                                  </>
                              )}
                              
                              <button onClick={() => { setAuthMethod('main'); setShowEmailFields(true); setError(null); setSuccessMessage(null); }} className="w-full text-center mt-4 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                                  {t('back_to_login')}
                              </button>
                          </div>
                       )}
                </div>
             )}
        </div>

      <PhoneBottomSheet 
        isOpen={showPhoneBottomSheet} 
        onClose={() => setShowPhoneBottomSheet(false)} 
        phone={phoneForBottomSheet}
      />

      {/* Interactive Android Biometric Prompt Sheet (used when testing in WebView/Preview without native bridge) */}
      {fallbackBioModal && (
        <div
          className="fixed inset-0 z-[250] bg-slate-950/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
          dir={isRTL ? 'rtl' : 'ltr'}
          onClick={() => {
            const resolver = fallbackBioModal.resolve;
            setFallbackBioModal(null);
            resolver(false);
          }}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] p-6 pb-[calc(env(safe-area-inset-bottom,16px)+20px)] shadow-2xl border border-slate-200 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-black uppercase tracking-wider mb-3">
              <i className="fab fa-android text-emerald-600 text-sm"></i>
              <span>{isRTL ? 'التحقق البيومتري للهاتف' : 'Android Biometric Prompt'}</span>
            </div>
            <h3 className="text-xl font-black text-slate-900">{fallbackBioModal.title}</h3>
            {fallbackBioModal.subtitle && (
              <p className="text-xs font-bold text-slate-500 mt-1 break-all">{fallbackBioModal.subtitle}</p>
            )}

            <div className="my-7 flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  const resolver = fallbackBioModal.resolve;
                  setFallbackBioModal(null);
                  resolver(true);
                }}
                className="relative w-24 h-24 rounded-full bg-gradient-to-b from-emerald-500 to-teal-600 text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center active:scale-95 transition-transform cursor-pointer group"
              >
                <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
                <i className="fas fa-fingerprint text-5xl relative z-10 group-hover:scale-105 transition-transform"></i>
              </button>
              <span className="mt-3 text-xs font-black text-slate-700">
                {isRTL ? 'المس مستشعر البصمة لتسجيل الدخول المباشر' : 'Touch the fingerprint sensor to sign in'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                const resolver = fallbackBioModal.resolve;
                setFallbackBioModal(null);
                resolver(false);
              }}
              className="w-full h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm transition-colors cursor-pointer"
            >
              {fallbackBioModal.cancelText || (isRTL ? 'إلغاء' : 'Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
