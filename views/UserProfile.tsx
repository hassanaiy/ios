import React, { useState, useEffect } from 'react';
import { User, Driver, UserRole, PaymentMethod, SavedCard, SafetyContact, AppSettings, PrivacySettings } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { CapacitorService } from '../services/capacitorService';
import { BiometricService } from '../services/biometricService';
import { Capacitor } from '@capacitor/core';
import { ImpactStyle } from '@capacitor/haptics';
import { Button } from '../components/ui/Button';
import { 
    uploadFile, 
    saveDeviceToken, 
    getUsersByIds, 
    toggleFavoriteDriver, 
    deleteUserAccount, 
    deactivateUserAccount,
    signOut,
    updateUserProfile, 
    addSavedCard, 
    removeSavedCard,
    addSafetyContact,
    removeSafetyContact,
    subscribeToAppSettings,
    createActiveSession
} from '../services/firebase';
import VerificationStatus from './VerificationStatus';
import { DriverInstructions } from '../components/DriverInstructions';
import { DriverBadge } from '../components/DriverBadge';
import PasskeySetup from '../components/PasskeySetup';
import { SupportOptionsModal } from '../components/SupportOptionsModal';

interface UserProfileProps {
  user: User | Driver;
  onBack: () => void;
  onNavigate: (view: string) => void;
}

const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        
        if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 100) {
             return <h3 key={i} className="text-lg font-black text-gray-900 mt-6 mb-3">{trimmed.replace(/\*\*/g, '')}</h3>;
        }
        
        if (trimmed.startsWith('* ')) {
            const text = trimmed.substring(2);
            const parts = text.split(/(\*\*.*?\*\*)/g);
            return (
                <li key={i} className="flex gap-2 text-sm text-gray-600 mb-2 ml-4">
                    <span className="text-gray-400 mt-1">•</span>
                    <span>
                        {parts.map((part, j) => 
                            part.startsWith('**') 
                            ? <strong key={j} className="text-gray-800 font-bold">{part.replace(/\*\*/g, '')}</strong> 
                            : part
                        )}
                    </span>
                </li>
            );
        }

        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
            <p key={i} className="text-sm text-gray-600 mb-1 leading-relaxed">
                {parts.map((part, j) => 
                    part.startsWith('**') 
                    ? <strong key={j} className="text-gray-800 font-bold">{part.replace(/\*\*/g, '')}</strong> 
                    : part
                )}
            </p>
        );
    });
};

export default function UserProfile({ user, onBack, onNavigate }: UserProfileProps) {
  const { t, isRTL, language, setLanguage } = useLanguage();
  const isDriver = user.role === UserRole.DRIVER;
  const driverData = user as Driver;

  // Global settings for deployment compliance
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [instapayHandle, setInstapayHandle] = useState((user as any).instapayHandle || '');
  const [instapayNumber, setInstapayNumber] = useState((user as any).instapayNumber || '');
  
  // Settings State
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [notifEnabledInDb, setNotifEnabledInDb] = useState(!!user.fcmToken);

  // Driver Settings State
  const [searchRadius, setSearchRadius] = useState<number>(driverData.searchRadius || 50);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(user.defaultPaymentMethod || PaymentMethod.CASH);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(user.defaultCardId || null);

  // Safety & Privacy State
  const [showSafetyCenter, setShowSafetyCenter] = useState(false);
  const [showPrivacySettingsModal, setShowPrivacySettingsModal] = useState(false);
  const [showAppPinSetup, setShowAppPinSetup] = useState(false);
  const [showNativeInfo, setShowNativeInfo] = useState(false);
  const [showSupportOptions, setShowSupportOptions] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [autoShareTrip, setAutoShareTrip] = useState((user as any).autoShareTrip || false);
  const [privacyToast, setPrivacyToast] = useState<string | null>(null);
  const [revokingSessions, setRevokingSessions] = useState(false);

  const defaultRidePin = user.privacySettings?.rideVerificationPin || String(1000 + (user.id.charCodeAt(0) * 37 + user.id.charCodeAt(user.id.length - 1) * 19) % 9000);
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    requirePinOnStartup: user.privacySettings?.requirePinOnStartup ?? true,
    autoLockTimeout: user.privacySettings?.autoLockTimeout ?? '5m',
    biometricUnlockEnabled: user.privacySettings?.biometricUnlockEnabled ?? false,
    maskPhoneNumber: user.privacySettings?.maskPhoneNumber ?? true,
    shareLocationOnlyDuringRide: user.privacySettings?.shareLocationOnlyDuringRide ?? true,
    hideWalletBalance: user.privacySettings?.hideWalletBalance ?? false,
    loginAlertsEnabled: user.privacySettings?.loginAlertsEnabled ?? true,
    rideVerificationPinEnabled: user.privacySettings?.rideVerificationPinEnabled ?? true,
    rideVerificationPin: defaultRidePin,
    incognitoRideHistory: user.privacySettings?.incognitoRideHistory ?? false,
  });

  // Modal States
  const [showAddCard, setShowAddCard] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showFAQ, setShowFAQ] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showVerificationStatus, setShowVerificationStatus] = useState(false);
  const [showDriverGuide, setShowDriverGuide] = useState(false);
  const [showInstapayPopup, setShowInstapayPopup] = useState(false);
  const [showFeesModal, setShowFeesModal] = useState(false);

  // Card Data State
  const [newCardNumber, setNewCardNumber] = useState('');
  const [newCardExpiry, setNewCardExpiry] = useState('');
  const [newCardCVC, setNewCardCVC] = useState('');
  const [newCardHolder, setNewCardHolder] = useState('');

  const SHOW_WALLET = false;

  useEffect(() => {
      if (typeof Notification !== 'undefined') {
          setNotifPermission(Notification.permission);
      }
      const unsub = subscribeToAppSettings(setAppSettings);
      
      if (Capacitor.isNativePlatform()) {
          CapacitorService.getDeviceInfo().then(setDeviceInfo);
      }
      
      return () => unsub();
  }, [user.id]);

  const handleSave = async () => {
      // Simple phone length validation
      const cleanPhone = phone.replace(/\D/g, '');
      
      if (cleanPhone.length < 7) {
          alert(t('err_invalid_phone'));
          return;
      }

      setIsSaving(true);
      try {
          const updateData: Partial<User | Driver> = { 
            name, 
            phone: cleanPhone,
            instapayHandle: instapayHandle,
            instapayNumber: instapayNumber
          };
          if (isDriver) {
              (updateData as any).searchRadius = searchRadius;
          }
          await updateUserProfile(user.id, updateData);
          setIsEditing(false);
          alert(t('profile_updated'));
      } catch (e) {
          console.error("Update failed", e);
          alert("Error updating profile");
      } finally {
          setIsSaving(false);
      }
  };

  const handleToggleAutoShare = async () => {
      const newValue = !autoShareTrip;
      setAutoShareTrip(newValue);
      try {
          await updateUserProfile(user.id, { autoShareTrip: newValue } as any);
      } catch (e) { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; }
  };

  const handleAddContact = async () => {
      if (!newContactName.trim() || !newContactPhone.trim()) return;
      
      // Simple phone length validation
      const cleanPhone = newContactPhone.replace(/\D/g, '');
      
      if (cleanPhone.length < 7) {
          alert(t('err_invalid_phone'));
          return;
      }

      setIsSaving(true);
      try {
          const contact: SafetyContact = {
              id: `contact_${Date.now()}`,
              name: newContactName,
              phone: cleanPhone
          };
          await addSafetyContact(user.id, contact);
          setNewContactName('');
          setNewContactPhone('');
          setIsAddingContact(false);
      } catch (e) { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; } finally { setIsSaving(false); }
  };

  const handleRemoveContact = async (contact: SafetyContact) => {
      if (confirm(isRTL ? "حذف جهة الاتصال؟" : "Remove contact?")) {
          try {
              await removeSafetyContact(user.id, contact);
          } catch (e) { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; }
      }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          setIsSaving(true);
          try {
              const file = e.target.files[0];
              const path = `users/${user.id}/avatars/profile_${Date.now()}`;
              const url = await uploadFile(file, path);
              await updateUserProfile(user.id, { avatar: url });
          } catch (error) {
              console.error("Avatar upload failed", error);
          } finally {
              setIsSaving(false);
          }
      }
  };

  const toggleNotifications = async () => {
      if (notifPermission === 'denied') return;
      if (notifEnabledInDb) {
          if(confirm("Disable notifications for this account?")) {
             await updateUserProfile(user.id, { fcmToken: null });
             setNotifEnabledInDb(false);
          }
      } else {
          const token = await saveDeviceToken(user.id);
          if (token) {
              setNotifEnabledInDb(true);
              setNotifPermission('granted');
          }
      }
  };

  const toggleLanguage = () => setLanguage(language === 'en' ? 'ar' : 'en');

  const showQuickPrivacyFeedback = (msgAr: string, msgEn: string) => {
    setPrivacyToast(language === 'ar' ? msgAr : msgEn);
    setTimeout(() => setPrivacyToast(null), 2600);
  };

  const handleUpdatePrivacySetting = async <K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K]
  ) => {
    const nextSettings: PrivacySettings = {
      ...privacySettings,
      [key]: value,
    };
    setPrivacySettings(nextSettings);
    try {
      await updateUserProfile(user.id, { privacySettings: nextSettings });
      showQuickPrivacyFeedback('تم تحديث إعدادات الخصوصية والأمان', 'Privacy & security setting saved');
    } catch (e) {
      if (String(e).includes('permission')) {
        console.log('Permission error caught:', e);
      } else {
        console.error(e);
      }
    }
  };

  const handleRegenerateRidePin = async () => {
    const newCode = String(Math.floor(1000 + Math.random() * 9000));
    await handleUpdatePrivacySetting('rideVerificationPin', newCode);
  };

  const handleRevokeOtherSessions = async () => {
    setRevokingSessions(true);
    try {
      await createActiveSession(user.id);
      showQuickPrivacyFeedback(
        'تم تسجيل الخروج من جميع الأجهزة الأخرى وتأمين جلستك الحالية',
        'Signed out of all other devices and secured current session'
      );
    } catch (e) {
      console.error(e);
    } finally {
      setRevokingSessions(false);
    }
  };

  const handleDisableAppPin = async () => {
    try {
        localStorage.removeItem('app_pin_hash');
        await updateUserProfile(user.id, { hasPasskey: false, passcode: '' });
        showQuickPrivacyFeedback('تم تعطيل رمز أمان التطبيق', 'App Security PIN disabled');
    } catch (e) {
        if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
    }
  };

  const handleAppPinComplete = async (hashedPin?: string) => {
      try {
          const pinHash = hashedPin || localStorage.getItem('app_pin_hash') || '';
          await updateUserProfile(user.id, {
            hasPasskey: true,
            passcode: pinHash,
            privacySettings: {
              ...privacySettings,
              requirePinOnStartup: true,
            },
          });
          setShowAppPinSetup(false);
          showQuickPrivacyFeedback('تم تفعيل رمز الأمان (4 محاولات) بنجاح', 'App Security PIN enabled (4 tries)');
      } catch (e) {
          if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      }
  };

  const handlePaymentMethodChange = async (method: PaymentMethod, cardId?: string) => {
    setPaymentMethod(method);
    if (cardId) setSelectedCardId(cardId);
    try {
        const updateData: any = { defaultPaymentMethod: method };
        if (cardId) updateData.defaultCardId = cardId;
        await updateUserProfile(user.id, updateData);
    } catch (e) { console.error("Error updating payment method", e); }
  };

  const formatCardNumber = (val: string) => val.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim().substring(0, 19);
  const formatExpiry = (val: string) => val.replace(/\D/g, '').replace(/(\d{2})(?=\d)/g, '$1/').substring(0, 5);

  const handleSaveCard = async () => {
      if (newCardNumber.length < 16 || newCardExpiry.length < 5 || newCardCVC.length < 3) {
          alert("Please fill in valid card details.");
          return;
      }
      setIsSaving(true);
      try {
          const brand = newCardNumber.startsWith('4') ? 'visa' : 'mastercard';
          const newCard: SavedCard = {
              id: `card_${Date.now()}`,
              brand: brand,
              last4: newCardNumber.replace(/\s/g, '').slice(-4),
              expiry: newCardExpiry
          };
          await addSavedCard(user.id, newCard);
          setShowAddCard(false);
          setNewCardNumber(''); setNewCardExpiry(''); setNewCardCVC(''); setNewCardHolder('');
          setPaymentMethod(PaymentMethod.CARD); setSelectedCardId(newCard.id);
      } catch (e) { alert("Failed to save card"); } finally { setIsSaving(false); }
  };

  const handleDeleteCard = async (card: SavedCard) => {
      if (confirm("Remove this card?")) {
          try {
              await removeSavedCard(user.id, card);
              if (selectedCardId === card.id) {
                 handlePaymentMethodChange(PaymentMethod.CASH);
                 setSelectedCardId(null);
              }
          } catch(e) { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; }
      }
  };

  const handleDeleteAccount = async () => {
    setIsSaving(true);
    try {
      await deleteUserAccount(user.id);
      try {
        BiometricService.clearCredentials();
        localStorage.removeItem('mowasla_cached_user');
        localStorage.removeItem('mowasla_is_driver_mode');
        localStorage.removeItem('mowasla_session_id');
      } catch {}
      await signOut();
      window.location.href = '/';
    } catch (e) {
      if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      alert("Failed to delete account. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivateAccount = async () => {
    setIsSaving(true);
    try {
      await deactivateUserAccount(user.id);
      // deactivateUserAccount already calls signOut() in services/firebase.ts
      window.location.href = '/';
    } catch (e) {
      if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
      alert("Failed to deactivate account. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyPrivacyLink = () => {
      const url = window.location.hostname === 'localhost'
        ? 'https://waslny.ai.studio/privacy-policy'
        : `${window.location.origin}/privacy-policy`;
      navigator.clipboard?.writeText(url).catch(() => {});
      setPrivacyToast(t('privacy_link_copied'));
      setTimeout(() => setPrivacyToast(null), 2600);
  };

  if (showVerificationStatus) {
      return <VerificationStatus user={user} onBack={() => setShowVerificationStatus(false)} />;
  }

  return (
    <div className="h-full w-full bg-white flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="p-3 pt-safe flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3">
            <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 bg-white shadow-sm border border-gray-100 transition-colors">
            <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'} text-base`}></i>
            </button>
            <h1 className="text-lg font-bold">{t('personal_details')}</h1>
        </div>
        {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="text-[#FFC90E] font-bold text-xs px-3 py-1.5 bg-yellow-50 rounded-full hover:bg-yellow-100 transition-colors">
                {t('edit_profile')}
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-20">
        <div className="flex flex-col items-center mb-4 animate-fade-in-up stagger-1">
          <div className="relative group cursor-pointer">
            <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`} className="w-12 h-12 rounded-full shadow-lg border-4 border-white object-cover" alt="Profile" />
            <div className="absolute bottom-0 right-0 bg-[#FFC90E] text-black w-5 h-5 rounded-full flex items-center justify-center border-4 border-white shadow-sm overflow-hidden">
               <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-camera'} text-[8px]`}></i>
               <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleAvatarChange} disabled={isSaving} />
            </div>
          </div>
          {!isEditing ? (
              <>
                <div className="flex items-center gap-2 justify-center mt-2 flex-wrap">
                    <h2 className="text-xl font-black">{user.name}</h2>
                    {isDriver && <DriverBadge level={(user as Driver).level} />}
                </div>
                <div className="flex items-center justify-center gap-2 text-gray-400 font-black text-sm"><span>{user.phone}</span></div>
              </>
          ) : (
              <div className="mt-2 w-full max-w-xs space-y-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full text-center text-xl font-black border-b-2 border-gray-200 focus:border-[#FFC90E] outline-none pb-1 bg-transparent" placeholder={t('full_name')} />
                  <input 
                    type="tel"
                    inputMode="numeric"
                    maxLength={15}
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} 
                    className="w-full text-center text-gray-500 font-black text-base border-b-2 border-gray-200 focus:border-[#FFC90E] outline-none pb-1 bg-transparent" 
                    placeholder={t('phone_label')} 
                    dir="ltr" 
                  />
                  {appSettings?.isInstaPayEnabled && (
                    <div className="space-y-4">
                        <input value={instapayHandle} onChange={(e) => setInstapayHandle(e.target.value)} className="w-full text-center text-blue-600 font-bold text-xs border-b-2 border-gray-200 focus:border-[#FFC90E] outline-none pb-1 bg-transparent" placeholder={t('instapay_placeholder')} dir="ltr" />
                        <input value={instapayNumber} onChange={(e) => setInstapayNumber(e.target.value)} className="w-full text-center text-green-600 font-bold text-xs border-b-2 border-gray-200 focus:border-[#FFC90E] outline-none pb-1 bg-transparent" placeholder="InstaPay Number" dir="ltr" />
                    </div>
                  )}
              </div>
          )}
        </div>

        {isDriver && (
            <>
                {/* Fees Modal */}
                {showFeesModal && (
                    <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowFeesModal(false)}>
                        <div className="bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[32px] p-6 pb-safe animate-slide-up" onClick={e => e.stopPropagation()}>
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 opacity-50"></div>
                            
                            <div className={`rounded-[32px] p-6 mb-4 relative overflow-hidden shadow-sm border-2 ${
                                (driverData.pendingFees || 0) > 0 
                                ? 'bg-red-50 border-red-100' 
                                : 'bg-white border-gray-100'
                            }`}>
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h3 className={`text-lg font-black uppercase tracking-widest mb-1 ${
                                            (driverData.pendingFees || 0) > 0
                                            ? 'text-red-600'
                                            : 'text-gray-900'
                                        }`}>
                                            {t('admin_fees_title')}
                                        </h3>
                                        <p className="text-xs font-bold text-gray-400">{t('admin_fees_desc')}</p>
                                    </div>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${
                                        (driverData.pendingFees || 0) > 0
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-gray-50 text-gray-400'
                                    }`}>
                                        <i className="fas fa-file-invoice-dollar text-xl"></i>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <div className="text-xs font-bold uppercase text-gray-400 mb-1">{t('total_pending_fees')}</div>
                                        <div className={`text-3xl font-black ${
                                            (driverData.pendingFees || 0) > 0 ? 'text-gray-900' : 'text-green-500'
                                        }`}>
                                            {Number(driverData.pendingFees || 0).toFixed(2)} <span className="text-sm text-gray-400">{t('currency')}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold uppercase text-gray-400 mb-1">{t('next_payment_date')}</div>
                                        <div className={`text-lg font-black ${
                                            (new Date().getDay() === 6 || new Date().getDay() === 5) ? 'text-red-600' : 'text-gray-900'
                                        }`}>
                                            {(() => {
                                                const d = new Date();
                                                const day = d.getDay();
                                                if (day === 6) return isRTL ? 'اليوم' : 'Today';
                                                if (day === 5) return isRTL ? 'غداً' : 'Tomorrow';
                                                const nextSat = new Date();
                                                nextSat.setDate(d.getDate() + ((6 - day + 7) % 7));
                                                return nextSat.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' });
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {(driverData.pendingFees || 0) > 0 && (
                                    <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
                                        <div className="flex items-center gap-3 mb-2">
                                            <img src="https://instapay.eg/assets/images/logo.png" className="h-4 object-contain" alt="InstaPay" onError={(e) => e.currentTarget.style.display = 'none'} />
                                            <span className="font-black text-gray-900 text-xs">{t('pay_via_instapay')}</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-200" onClick={() => {
                                            navigator.clipboard.writeText("01024419931");
                                            alert(t('instapay_number_copied'));
                                        }}>
                                            <span className="font-mono font-bold text-lg text-gray-800 tracking-wider">01024419931</span>
                                            <i className="fas fa-copy text-gray-400"></i>
                                        </div>
                                        <div className="mt-3 flex items-center gap-2 text-red-600 text-xs font-bold">
                                            <i className="fas fa-exclamation-circle"></i>
                                            <span>{t('payment_due_desc')}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <Button onClick={() => setShowFeesModal(false)} className="w-full">{isRTL ? "إغلاق" : "Close"}</Button>
                        </div>
                    </div>
                )}
            </>
        )}

        {/* Wallet hidden for now as per request */}
        {SHOW_WALLET && appSettings?.isPaymentsEnabled && (
            <div className="bg-[#FFC90E] text-black rounded-[32px] shadow-lg shadow-[#FFC90E]/30 overflow-hidden mb-8 p-8 relative animate-fade-in-up stagger-2">
                 <div className="absolute top-0 right-0 p-6 opacity-10"><i className="fas fa-wallet text-9xl"></i></div>
                 <div className="relative z-10">
                     <div className="flex justify-between items-end mb-6">
                        <div>
                            <div className="text-sm font-bold uppercase mb-1 opacity-60">{t('wallet_balance')}</div>
                            <div className="text-4xl font-bold">EGP {(user.walletBalance || 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</div>
                        </div>
                        {appSettings?.isRewardsEnabled !== false && (
                            <div className="text-right">
                                <div className="text-xs font-bold uppercase opacity-60 mb-1">{t('points_label')}</div>
                                <div className="text-xl font-black">{user.rewardPoints || 0}</div>
                            </div>
                        )}
                     </div>
                     <div className="flex gap-3">
                         <button onClick={() => onNavigate('WALLET')} className="flex-1 h-12 bg-blue-700 text-white hover:bg-blue-800 border-none font-bold shadow-md rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform">{isDriver ? t('request_payout') : t('add_funds')}</button>
                         <button onClick={() => onNavigate('HISTORY')} className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center hover:bg-blue-600/30 text-blue-900 transition-colors active:scale-95"><i className="fas fa-history"></i></button>
                     </div>
                 </div>
            </div>
        )}

        {!isDriver && (
          <div 
            onClick={() => setShowSafetyCenter(true)}
            className="p-4 rounded-[24px] mb-6 flex items-center justify-between cursor-pointer border bg-blue-50 border-blue-100 transition-all active:scale-[0.98] animate-fade-in-up stagger-3"
          >
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-lg text-blue-600">
                      <i className="fas fa-shield-heart"></i>
                  </div>
                  <div>
                      <div className="text-[9px] font-black uppercase tracking-widest leading-none mb-1 opacity-60">{t('safety_center')}</div>
                      <div className="font-black text-base text-blue-700">{t('manage_contacts')}</div>
                  </div>
              </div>
              <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-blue-300 text-sm`}></i>
          </div>
        )}

        <div className="space-y-3 mb-6 animate-fade-in-up stagger-4">
            <div className={`bg-gray-50 rounded-xl p-3 flex items-center justify-between ${isEditing ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-500 shadow-sm text-sm"><i className="fas fa-user"></i></div>
                    <span className="font-bold text-gray-700 text-sm">{t('full_name')}</span>
                </div>
                <span className="font-medium text-sm">{name}</span>
            </div>
            <div className={`bg-gray-50 rounded-xl p-3 flex items-center justify-between ${isEditing ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-500 shadow-sm text-sm"><i className="fas fa-phone"></i></div>
                    <span className="font-bold text-gray-700 text-sm">{t('phone_label')}</span>
                </div>
                <span className="font-black text-base" dir="ltr">{phone}</span>
            </div>
        </div>

        {isEditing && (
            <div className="flex gap-2 mb-6 animate-fade-in-up">
                <button onClick={() => setIsEditing(false)} className="flex-1 h-12 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm active:scale-95 transition-transform">{t('cancel')}</button>
                <Button onClick={handleSave} isLoading={isSaving} className="flex-1 h-12 text-sm">{t('save_changes')}</Button>
            </div>
        )}

        <div className="mb-6 animate-fade-in-up stagger-5">
            <h3 className="text-base font-bold mb-3 px-2">{t('settings_title')}</h3>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-1.5 space-y-0.5">
                <button onClick={toggleLanguage} className="w-full p-3 flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors active:scale-[0.98]">
                    <div className="flex items-center gap-3"><div className="w-9 h-9 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-sm text-sm"><i className="fas fa-globe"></i></div><span className="font-bold text-gray-700 text-sm">{t('language_label')}</span></div>
                    <span className="text-xs font-bold text-gray-400">{language === 'en' ? 'English' : 'العربية'}</span>
                </button>
                <button onClick={() => onNavigate('NOTIFICATION_SETTINGS')} className="w-full p-3 flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors active:scale-[0.98]">
                    <div className="flex items-center gap-3"><div className="w-9 h-9 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center shadow-sm text-sm"><i className="fas fa-bell"></i></div><span className="font-bold text-gray-700 text-sm">{t('notifications_label')}</span></div>
                    <div className="flex items-center rtl:flex-row-reverse">
                        <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-gray-400 text-sm`}></i>
                    </div>
                </button>
                <button onClick={() => setShowPrivacySettingsModal(true)} className="w-full p-3 flex items-center justify-between hover:bg-gray-50 rounded-xl transition-colors active:scale-[0.98]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-sm text-sm">
                            <i className="fas fa-user-lock"></i>
                        </div>
                        <div className="text-start">
                            <span className="font-bold text-gray-800 text-sm block">
                                {language === 'ar' ? 'الخصوصية والأمان المتقدم' : 'Privacy & Security Settings'}
                            </span>
                            <span className="text-[11px] font-medium text-gray-400">
                                {language === 'ar'
                                  ? 'رمز PIN، إخفاء الرقم، حماية الموقع، تأمين الجلسات'
                                  : 'App PIN, phone masking, location & session security'}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {user.hasPasskey && (
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {language === 'ar' ? 'محمي بـ PIN' : 'PIN Active'}
                            </span>
                        )}
                        <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-gray-400 text-sm`}></i>
                    </div>
                </button>
                <button onClick={() => setShowPrivacy(true)} className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors active:scale-[0.98]">
                    <div className="w-9 h-9 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center shadow-sm text-sm"><i className="fas fa-shield-halved"></i></div>
                    <span className="font-bold text-gray-700 text-sm">{t('privacy_policy')}</span>
                </button>
                <div className="w-full p-3 flex flex-col hover:bg-gray-50 rounded-xl transition-colors border-t border-gray-100 mt-2 pt-4">
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center shadow-sm text-sm">
                                <i className="fas fa-shield-alt"></i>
                            </div>
                            <div>
                                <span className="font-bold text-gray-700 text-sm block">
                                    {language === 'ar' ? 'رمز أمان التطبيق (PIN)' : 'App Security PIN'}
                                </span>
                                <span className="text-[10px] text-gray-400 font-medium">
                                    {language === 'ar' ? 'اختياري • 4 أرقام • 4 محاولات مسموحة' : 'Optional • 4 digits • 4 attempts allowed'}
                                </span>
                            </div>
                        </div>
                        {user.hasPasskey ? (
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-md">{language === 'ar' ? 'مفعل' : 'Enabled'}</span>
                        ) : (
                            <span className="text-xs font-bold text-gray-400">{language === 'ar' ? 'غير مفعل' : 'Optional'}</span>
                        )}
                    </div>
                    <div className="flex gap-2 mt-2 ms-12">
                        {user.hasPasskey ? (
                            <>
                                <button onClick={() => setShowAppPinSetup(true)} className="flex-1 text-xs font-bold text-blue-600 border border-blue-100 bg-white py-2 rounded-lg active:scale-95 transition-all">
                                    {language === 'ar' ? 'تغيير الرمز' : 'Change PIN'}
                                </button>
                                <button onClick={handleDisableAppPin} className="flex-1 text-xs font-bold text-red-500 border border-red-100 bg-white py-2 rounded-lg active:scale-95 transition-all">
                                    {language === 'ar' ? 'تعطيل' : 'Disable'}
                                </button>
                            </>
                        ) : (
                            <button onClick={() => setShowAppPinSetup(true)} className="w-full text-xs font-bold text-gray-900 border border-gray-200 bg-white hover:bg-gray-50 py-2 rounded-lg active:scale-95 transition-all">
                                {language === 'ar' ? 'إعداد رمز أمان (اختياري)' : 'Set Up Security PIN (Optional)'}
                            </button>
                        )}
                    </div>
                </div>
                <button onClick={() => {
                    if (Capacitor.isNativePlatform()) {
                        CapacitorService.impact(ImpactStyle.Medium);
                        setShowNativeInfo(true);
                    } else {
                        alert(isRTL ? "هذه الميزة متاحة فقط على التطبيق الأصلي" : "This feature is only available on the native app");
                    }
                }} className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors active:scale-[0.98]">
                    <div className="w-9 h-9 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-sm text-sm"><i className="fas fa-mobile-alt"></i></div>
                    <span className="font-bold text-gray-700 text-sm">{isRTL ? "معلومات الجهاز" : "Device Info"}</span>
                </button>
                <button onClick={() => setShowFAQ(true)} className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors active:scale-[0.98]">
                    <div className="w-9 h-9 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center shadow-sm text-sm"><i className="fas fa-question-circle"></i></div>
                    <span className="font-bold text-gray-700 text-sm">{t('faq')}</span>
                </button>
                <button onClick={() => setShowSupportOptions(true)} className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors active:scale-[0.98]">
                    <div className="w-9 h-9 bg-green-50 text-green-500 rounded-full flex items-center justify-center shadow-sm text-sm"><i className="fas fa-headset"></i></div>
                    <span className="font-bold text-gray-700 text-sm">{isRTL ? "تحدث معنا" : "Support"}</span>
                </button>

                {isDriver && (
                    <button onClick={() => setShowFeesModal(true)} className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition-colors active:scale-[0.98]">
                        <div className="w-9 h-9 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-sm text-sm"><i className="fas fa-file-invoice-dollar"></i></div>
                        <div className="flex-1 text-left rtl:text-right">
                            <span className="font-bold text-gray-700 block text-sm">{t('admin_fees_title')}</span>
                            {(driverData.pendingFees || 0) > 0 && (
                                <span className="text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full mt-0.5 inline-block">
                                    {Number(driverData.pendingFees || 0).toFixed(2)} {t('currency')} {isRTL ? 'مستحق' : 'Due'}
                                </span>
                            )}
                        </div>
                        <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-gray-300 text-xs`}></i>
                    </button>
                )}
            </div>
        </div>

        <div className="pt-2 px-2 space-y-2">
            <button onClick={() => setShowDeactivateConfirm(true)} className="w-full py-3.5 text-orange-500 font-bold text-xs bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors flex items-center justify-center gap-2 active:scale-95">
                <i className="fas fa-pause-circle"></i> {isRTL ? 'إلغاء تنشيط الحساب' : 'Deactivate Account'}
            </button>
            <button onClick={() => setShowDeleteConfirm(true)} className="w-full py-3.5 text-red-500 font-bold text-xs bg-red-50 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 active:scale-95">
                <i className="fas fa-user-slash"></i> {t('delete_account')}
            </button>
        </div>

        {/* --- Safety Center Modal (MATCHING PROVIDED IMAGE) --- */}
        {showSafetyCenter && (
            <div className="fixed inset-0 z-[150] bg-white flex flex-col pt-safe animate-fade-in" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="p-3 flex items-center justify-between border-b border-gray-50">
                    <button onClick={() => setShowSafetyCenter(false)} className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                        <i className="fas fa-times text-sm"></i>
                    </button>
                    <h2 className="text-lg font-black text-gray-900">{t('safety_center')}</h2>
                    <div className="w-9"></div> {/* Spacer for symmetry */}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-[#F8F9FA]">
                    {/* Share Trip Card */}
                    <div className="bg-white rounded-[24px] p-4 shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                        <div className="flex items-center gap-4 z-10">
                            <div 
                                onClick={handleToggleAutoShare} 
                                className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors duration-300 flex items-center ${autoShareTrip ? 'bg-green-500' : 'bg-gray-200'}`}
                            >
                                <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${autoShareTrip ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`}></div>
                            </div>
                            <div className="text-left rtl:text-right">
                                <div className="font-black text-base text-gray-900 mb-0.5">{t('auto_share_trip')}</div>
                                <div className="text-[10px] text-gray-400 font-bold leading-relaxed max-w-[180px]">{t('auto_share_desc')}</div>
                            </div>
                        </div>
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shadow-sm relative z-10 shrink-0 text-sm">
                            <i className="fas fa-location-arrow"></i>
                        </div>
                    </div>

                    {/* Emergency Contacts Section */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <button onClick={() => setIsAddingContact(true)} className="text-blue-600 font-black text-xs hover:underline">{t('add_contact')}</button>
                            <h3 className="font-black text-gray-900 text-[10px] uppercase tracking-widest">{t('emergency_contacts')}</h3>
                        </div>

                        {isAddingContact && (
                            <div className="bg-white p-4 rounded-[24px] border-2 border-blue-100 mb-4 animate-fade-in-up shadow-lg">
                                <div className="space-y-3 mb-4">
                                    <input value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder={t('contact_name')} className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none border border-transparent focus:border-blue-500 transition-all" />
                                    <input 
                                        type="tel"
                                        inputMode="numeric"
                                        maxLength={15}
                                        value={newContactPhone} 
                                        onChange={e => setNewContactPhone(e.target.value.replace(/\D/g, ''))} 
                                        placeholder={t('contact_phone')} 
                                        className="w-full p-3 bg-gray-50 rounded-xl font-bold text-sm outline-none border border-transparent focus:border-blue-500 transition-all" 
                                        dir="ltr" 
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsAddingContact(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-black text-xs text-gray-400">{t('cancel')}</button>
                                    <button onClick={handleAddContact} className="flex-[2] py-3 bg-blue-600 rounded-xl font-black text-xs text-white shadow-xl shadow-blue-100">{t('confirm')}</button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {user.safetyContacts && user.safetyContacts.length > 0 ? (
                                user.safetyContacts.map(contact => (
                                    <div key={contact.id} className="bg-white p-4 rounded-[20px] flex items-center justify-between shadow-sm border border-gray-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-sm text-sm"><i className="fas fa-user-shield"></i></div>
                                            <div>
                                                <div className="font-black text-gray-900 text-sm">{contact.name}</div>
                                                <div className="text-[10px] text-gray-400 font-bold" dir="ltr">{contact.phone}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => handleRemoveContact(contact)} className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors">
                                            <i className="fas fa-trash-alt text-xs"></i>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 bg-white rounded-[24px] border-2 border-dashed border-gray-200">
                                    <p className="text-gray-300 font-black text-xs">{t('no_safety_contacts')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Safety Messages Section (Black Card Matching Image) */}
                    <div className="bg-[#1A1A1A] p-6 rounded-[28px] text-white relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 p-6 opacity-10"><i className="fas fa-shield-halved text-6xl"></i></div>
                        <div className="relative z-10 flex flex-col items-end rtl:items-end ltr:items-start text-right rtl:text-right ltr:text-left">
                            <h3 className="font-black text-xl mb-1">{t('safety_messages')}</h3>
                            <p className="text-[10px] text-gray-400 font-bold mb-6 leading-relaxed max-w-[200px]">{t('chat_saved_desc')}</p>
                            
                            <div className="w-full space-y-3">
                                <div className="bg-[#2A2A2A] p-4 rounded-[18px] border border-white/5 shadow-inner">
                                    <p className="text-[10px] font-black italic text-gray-200 text-center leading-relaxed">
                                        {t('safety_tip_1')}
                                    </p>
                                </div>
                                <div className="bg-[#2A2A2A] p-4 rounded-[18px] border border-white/5 shadow-inner">
                                    <p className="text-[10px] font-black italic text-gray-200 text-center leading-relaxed">
                                        {t('safety_tip_2')}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Privacy & Security Settings Full Screen Modal */}
        {showPrivacySettingsModal && (
            <div className="fixed inset-0 z-[150] bg-[#F8FAFC] flex flex-col pt-safe animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="px-4 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between shadow-2xs">
                    <button
                        onClick={() => setShowPrivacySettingsModal(false)}
                        className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'} text-sm`}></i>
                    </button>
                    <div className="text-center">
                        <h2 className="text-base font-black text-slate-900">
                            {language === 'ar' ? 'مركز الخصوصية والأمان' : 'Privacy & Security Center'}
                        </h2>
                        <p className="text-[11px] font-bold text-slate-400">
                            {language === 'ar' ? 'تحكم كامل في حماية حسابك وبياناتك' : 'Full control over your account & data protection'}
                        </p>
                    </div>
                    <div className="w-10" />
                </div>

                {privacyToast && (
                    <div className="mx-4 mt-3 px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md animate-fade-in">
                        <i className="fas fa-check-circle text-emerald-400"></i>
                        <span>{privacyToast}</span>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-12">
                    {/* 1. App Security PIN Card */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 text-lg">
                                    <i className="fas fa-lock"></i>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-slate-900 text-sm">
                                            {language === 'ar' ? 'رمز أمان التطبيق (PIN)' : 'App Security PIN'}
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-500">
                                            · {language === 'ar' ? '4 محاولات' : '4 Tries'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                                        {language === 'ar'
                                            ? 'حماية التطبيق برمز سري من 4 أرقام عند الفتح. لا يظهر بعد التسجيل إلا عند تفعيله من هنا.'
                                            : 'Protect your app with an optional 4-digit PIN on launch (4 attempts before 30s cooldown).'}
                                    </p>
                                </div>
                            </div>
                            <span className={`text-xs font-black px-2.5 py-1 rounded-lg shrink-0 ${user.hasPasskey ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                {user.hasPasskey
                                    ? (language === 'ar' ? 'مفعل' : 'Active')
                                    : (language === 'ar' ? 'غير مفعل' : 'Off')}
                            </span>
                        </div>

                        <div className="flex gap-2">
                            {user.hasPasskey ? (
                                <>
                                    <button
                                        onClick={() => setShowAppPinSetup(true)}
                                        className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-all active:scale-95"
                                    >
                                        <i className="fas fa-key me-1.5"></i>
                                        {language === 'ar' ? 'تغيير رمز PIN' : 'Change PIN'}
                                    </button>
                                    <button
                                        onClick={handleDisableAppPin}
                                        className="flex-1 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs transition-all active:scale-95"
                                    >
                                        <i className="fas fa-unlock me-1.5"></i>
                                        {language === 'ar' ? 'إيقاف الرمز' : 'Disable PIN'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setShowAppPinSetup(true)}
                                    className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <i className="fas fa-shield-alt text-[#FFC90E]"></i>
                                    <span>{language === 'ar' ? 'تفعيل رمز أمان التطبيق (4 أرقام)' : 'Enable 4-Digit App Security PIN'}</span>
                                </button>
                            )}
                        </div>

                        {user.hasPasskey && (
                            <div className="pt-3 border-t border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">
                                        {language === 'ar' ? 'طلب الرمز عند فتح التطبيق' : 'Require PIN on App Launch'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleUpdatePrivacySetting('requirePinOnStartup', !privacySettings.requirePinOnStartup)}
                                        className={`w-11 h-6 rounded-full p-0.5 transition-colors flex items-center ${privacySettings.requirePinOnStartup !== false ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacySettings.requirePinOnStartup !== false ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-slate-700">
                                        {language === 'ar' ? 'مهلة القفل التلقائي' : 'Auto-Lock Timer'}
                                    </span>
                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                        {[
                                            { id: 'immediate', ar: 'فوراً', en: 'Instant' },
                                            { id: '1m', ar: '1 د', en: '1m' },
                                            { id: '5m', ar: '5 د', en: '5m' },
                                            { id: '15m', ar: '15 د', en: '15m' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => handleUpdatePrivacySetting('autoLockTimeout', opt.id as any)}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                                    privacySettings.autoLockTimeout === opt.id
                                                        ? 'bg-white text-slate-900 shadow-2xs'
                                                        : 'text-slate-500 hover:text-slate-800'
                                                }`}
                                            >
                                                {language === 'ar' ? opt.ar : opt.en}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 2. Ride Verification PIN */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                    <i className="fas fa-car-side"></i>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-sm">
                                        {language === 'ar' ? 'كود التحقق من بدء الرحلة' : 'Ride Start Verification Code'}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {language === 'ar'
                                            ? 'مشاركة كود من 4 أرقام مع الكابتن للتأكد من المركبة الصحيحة قبل الانطلاق'
                                            : 'Require a 4-digit verification code before starting any trip'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleUpdatePrivacySetting('rideVerificationPinEnabled', !privacySettings.rideVerificationPinEnabled)}
                                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${privacySettings.rideVerificationPinEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <span className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacySettings.rideVerificationPinEnabled ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`} />
                            </button>
                        </div>

                        {privacySettings.rideVerificationPinEnabled && (
                            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                                        {language === 'ar' ? 'كود التحقق الحالي للرحلات' : 'Current Ride Security Code'}
                                    </span>
                                    <span className="font-mono font-black text-xl tracking-[0.25em] text-slate-900">
                                        {privacySettings.rideVerificationPin}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRegenerateRidePin}
                                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 active:scale-95 transition-all"
                                >
                                    <i className="fas fa-sync-alt text-amber-500"></i>
                                    <span>{language === 'ar' ? 'توليد كود جديد' : 'Regenerate'}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 3. Communication & Data Privacy Controls */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                            {language === 'ar' ? 'حماية البيانات والخصوصية أثناء الرحلة' : 'Data & Trip Privacy Controls'}
                        </h3>

                        {/* Phone Number Masking */}
                        <div className="flex items-center justify-between gap-3 py-1">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 text-sm">
                                    <i className="fas fa-phone-slash"></i>
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        {language === 'ar' ? 'إخفاء رقم الهاتف الشخصي' : 'Mask Personal Phone Number'}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        {language === 'ar'
                                            ? 'تفضيل المحادثة والرسائل الصوتية المشفرة داخل التطبيق بدلاً من إظهار رقمك'
                                            : 'Prioritize encrypted in-app chat & voice notes over exposing your number'}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleUpdatePrivacySetting('maskPhoneNumber', !privacySettings.maskPhoneNumber)}
                                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${privacySettings.maskPhoneNumber ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <span className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacySettings.maskPhoneNumber ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`} />
                            </button>
                        </div>

                        {/* Share Location Only During Active Ride */}
                        <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 pt-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0 text-sm">
                                    <i className="fas fa-map-marker-alt"></i>
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        {language === 'ar' ? 'مشاركة الموقع أثناء الرحلة فقط' : 'Live Location Only During Rides'}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        {language === 'ar'
                                            ? 'إيقاف مشاركة الموقع الجغرافي تلقائياً فور انتهاء الرحلة'
                                            : 'Automatically stop sharing GPS coordinates as soon as a trip ends'}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleUpdatePrivacySetting('shareLocationOnlyDuringRide', !privacySettings.shareLocationOnlyDuringRide)}
                                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${privacySettings.shareLocationOnlyDuringRide ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <span className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacySettings.shareLocationOnlyDuringRide ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`} />
                            </button>
                        </div>

                        {/* Hide Wallet & Balance */}
                        <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 pt-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 text-sm">
                                    <i className="fas fa-eye-slash"></i>
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        {language === 'ar' ? 'إخفاء الرصيد والمبالغ المالية' : 'Hide Wallet & Earnings Balance'}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        {language === 'ar'
                                            ? 'تمويه الرصيد (****) على الشاشة لحماية خصوصيتك في الأماكن العامة'
                                            : 'Mask financial balances on screen in public places'}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleUpdatePrivacySetting('hideWalletBalance', !privacySettings.hideWalletBalance)}
                                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${privacySettings.hideWalletBalance ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <span className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacySettings.hideWalletBalance ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`} />
                            </button>
                        </div>

                        {/* Incognito Ride History */}
                        <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 pt-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 text-sm">
                                    <i className="fas fa-user-secret"></i>
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        {language === 'ar' ? 'خصوصية سجل الرحلات' : 'Private Ride History Addresses'}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        {language === 'ar'
                                            ? 'إخفاء تفاصيل الشوارع الدقيقة في المعاينة السريعة لسجل الرحلات'
                                            : 'Hide exact street details in quick trip history previews'}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleUpdatePrivacySetting('incognitoRideHistory', !privacySettings.incognitoRideHistory)}
                                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${privacySettings.incognitoRideHistory ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <span className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacySettings.incognitoRideHistory ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* 4. Account & Session Protection */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                            {language === 'ar' ? 'حماية الحساب والجلسات النشطة' : 'Account & Session Security'}
                        </h3>

                        {/* New Device Login Alerts */}
                        <div className="flex items-center justify-between gap-3 py-1">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 text-sm">
                                    <i className="fas fa-bell-shield"></i>
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        {language === 'ar' ? 'تنبيهات الدخول من جهاز جديد' : 'New Device Login Alerts'}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        {language === 'ar'
                                            ? 'إشعار فوري عند محاولة فتح حسابك من هاتف أو متصفح آخر'
                                            : 'Instant alert whenever your account is accessed from another device'}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleUpdatePrivacySetting('loginAlertsEnabled', !privacySettings.loginAlertsEnabled)}
                                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${privacySettings.loginAlertsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <span className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacySettings.loginAlertsEnabled ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`} />
                            </button>
                        </div>

                        {/* Biometric Quick Unlock & Direct Email Login */}
                        <div className="flex items-center justify-between gap-3 py-1 border-t border-slate-100 pt-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 text-sm">
                                    <i className="fas fa-fingerprint"></i>
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 text-sm">
                                        {language === 'ar' ? 'الدخول المباشر وفتح القفل بالبصمة' : 'Biometric Direct Login & Quick Unlock'}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                        {language === 'ar'
                                            ? 'تسجيل الدخول المباشر بالبريد الإلكتروني وفتح القفل ببصمة الهاتف'
                                            : 'Sign in directly with email and unlock app using phone biometrics'}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    const nextVal = !privacySettings.biometricUnlockEnabled;
                                    if (!nextVal) {
                                        BiometricService.clearCredentials();
                                    }
                                    await handleUpdatePrivacySetting('biometricUnlockEnabled', nextVal);
                                }}
                                className={`w-11 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${privacySettings.biometricUnlockEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                            >
                                <span className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${privacySettings.biometricUnlockEnabled ? (isRTL ? '-translate-x-5' : 'translate-x-5') : ''}`} />
                            </button>
                        </div>

                        {/* Sign Out of All Other Devices */}
                        <div className="pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={handleRevokeOtherSessions}
                                disabled={revokingSessions}
                                className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <i className={`fas ${revokingSessions ? 'fa-spinner fa-spin' : 'fa-laptop-medical'} text-rose-500`}></i>
                                <span>
                                    {language === 'ar'
                                        ? 'تسجيل الخروج من جميع الأجهزة الأخرى وتأمين الحساب'
                                        : 'Sign Out of All Other Devices & Secure Session'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Other Modals */}
        {showAppPinSetup && (
            <PasskeySetup 
                onComplete={async (hashedPin) => {
                    await handleAppPinComplete(hashedPin);
                }} 
                onSkip={() => setShowAppPinSetup(false)} 
            />
        )}
        {showNativeInfo && deviceInfo && (
            <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setShowNativeInfo(false)}>
                <div className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[24px] p-6 pb-safe animate-slide-up" onClick={e => e.stopPropagation()}>
                    <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6 opacity-50"></div>
                    <h2 className="text-xl font-black mb-4">{isRTL ? "معلومات الجهاز" : "Device Info"}</h2>
                    <div className="space-y-3 mb-6">
                        <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-500 font-bold text-sm">{isRTL ? "الموديل" : "Model"}</span>
                            <span className="font-black text-sm">{deviceInfo.model}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-500 font-bold text-sm">{isRTL ? "نظام التشغيل" : "OS"}</span>
                            <span className="font-black text-sm">{deviceInfo.operatingSystem} {deviceInfo.osVersion}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-500 font-bold text-sm">{isRTL ? "المنصة" : "Platform"}</span>
                            <span className="font-black text-sm">{deviceInfo.platform}</span>
                        </div>
                        <div className="flex justify-between p-3 bg-gray-50 rounded-xl">
                            <span className="text-gray-500 font-bold text-sm">{isRTL ? "الشركة المصنعة" : "Manufacturer"}</span>
                            <span className="font-black text-sm">{deviceInfo.manufacturer}</span>
                        </div>
                    </div>
                    <Button onClick={() => setShowNativeInfo(false)} className="w-full h-12 text-sm">{isRTL ? "إغلاق" : "Close"}</Button>
                </div>
            </div>
        )}

        {(showPrivacy || showFAQ || showDeleteConfirm || showAddCard || showDeactivateConfirm) && (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => {
                setShowPrivacy(false); setShowFAQ(false); setShowDeleteConfirm(false); setShowAddCard(false); setShowDeactivateConfirm(false);
            }}>
                <div className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[24px] p-5 pb-safe animate-slide-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-5 opacity-50"></div>
                    
                    {showPrivacy && (
                        <div>
                            <h2 className="text-xl font-black mb-3">{t('privacy_policy')}</h2>
                            <div className="prose prose-sm max-h-[50vh] overflow-y-auto pr-2 pb-3">
                                {renderContent(t('privacy_content'))}
                            </div>
                            <button onClick={handleCopyPrivacyLink} className="w-full mt-3 py-3.5 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-100 active:scale-95 transition-all">
                                <i className="fas fa-link"></i> {t('copy_privacy_link')}
                            </button>
                        </div>
                    )}

                    {showFAQ && (
                        <div>
                            <h2 className="text-xl font-black mb-4">{t('faq')}</h2>
                            <div className="max-h-[50vh] overflow-y-auto pr-2">
                                <FAQItem q={t('faq_q1')} a={t('faq_a1')} />
                                <FAQItem q={t('faq_q2')} a={t('faq_a2')} />
                                <FAQItem q={t('faq_q3')} a={t('faq_a3')} />
                                <FAQItem q={t('faq_q4')} a={t('faq_a4')} />
                            </div>
                        </div>
                    )}

                    {showDeactivateConfirm && (
                        <div className="text-center p-2">
                            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm border border-orange-100"><i className="fas fa-pause-circle"></i></div>
                            <h2 className="text-xl font-black text-gray-900 mb-1">{isRTL ? 'إلغاء تنشيط الحساب؟' : 'Deactivate Account?'}</h2>
                            <p className="text-gray-500 mb-6 font-medium text-sm leading-relaxed">
                                {isRTL 
                                    ? 'سيتم إيقاف حسابك مؤقتاً. يمكنك إعادة تفعيله في أي وقت بالتواصل مع الدعم.' 
                                    : 'Your account will be paused. You can reactivate it anytime by contacting support.'}
                            </p>
                            <div className="flex flex-col gap-2">
                                <Button onClick={handleDeactivateAccount} isLoading={isSaving} className="w-full h-14 bg-orange-600 hover:bg-orange-700 shadow-orange-200 text-sm">
                                    {isRTL ? 'إلغاء التنشيط الآن' : 'Deactivate Now'}
                                </Button>
                                <button onClick={() => setShowDeactivateConfirm(false)} className="py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                            </div>
                        </div>
                    )}

                    {showDeleteConfirm && (
                        <div className="text-center p-2">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm border border-red-100"><i className="fas fa-user-times"></i></div>
                            <h2 className="text-xl font-black text-gray-900 mb-1">{t('delete_confirm_title')}</h2>
                            <p className="text-gray-500 mb-6 font-medium text-sm leading-relaxed">{t('delete_confirm_desc')}</p>
                            <div className="flex flex-col gap-2">
                                <Button onClick={handleDeleteAccount} isLoading={isSaving} className="w-full h-14 bg-red-600 hover:bg-red-700 shadow-red-200 text-sm">{t('delete_button')}</Button>
                                <button onClick={() => setShowDeleteConfirm(false)} className="py-3 text-gray-400 font-bold uppercase text-[10px] tracking-widest">{t('cancel')}</button>
                            </div>
                        </div>
                    )}

                    {showAddCard && (
                        <div className="p-1 animate-fade-in-up">
                            <h2 className="text-xl font-black mb-6">{t('add_card')}</h2>
                            <div className="space-y-3 mb-8">
                                <div><label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">{t('card_number')}</label><input value={newCardNumber} onChange={e => setNewCardNumber(formatCardNumber(e.target.value))} className="w-full p-3.5 bg-gray-50 rounded-xl font-bold text-sm border border-transparent focus:border-[#FFC90E] outline-none transition-all" placeholder="0000 0000 0000 0000" /></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">{t('expiry')}</label><input value={newCardExpiry} onChange={e => setNewCardExpiry(formatExpiry(e.target.value))} className="w-full p-3.5 bg-gray-50 rounded-xl font-bold text-sm border border-transparent focus:border-[#FFC90E] outline-none transition-all" placeholder="MM/YY" /></div>
                                    <div><label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1 block">CVC</label><input value={newCardCVC} onChange={e => setNewCardCVC(e.target.value.substring(0,3))} className="w-full p-3.5 bg-gray-50 rounded-xl font-bold text-sm border border-transparent focus:border-[#FFC90E] outline-none transition-all" placeholder="000" type="password" /></div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowAddCard(false)} className="flex-1 py-3.5 bg-gray-100 rounded-xl font-bold text-sm text-gray-400">{t('cancel')}</button>
                                <Button onClick={handleSaveCard} isLoading={isSaving} className="flex-[2] h-14 text-sm">{t('save_card')}</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}
        <SupportOptionsModal
          isOpen={showSupportOptions}
          onClose={() => setShowSupportOptions(false)}
          onSelectCustomerServiceChat={() => onNavigate('ADMIN_CHAT')}
          userName={user.name}
          userPhone={user.phone}
        />
      </div>
    </div>
  );
}

const FAQItem = ({ q, a }: { q: string, a: string }) => (
    <div className="mb-4">
      <h4 className="font-bold text-gray-900 mb-0.5 text-sm">{q}</h4>
      <p className="text-xs text-gray-600 leading-relaxed">{a}</p>
    </div>
);