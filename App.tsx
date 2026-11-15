import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Driver, Ride, NotificationSettings } from './types';
import {
  auth,
  signOut,
  getUserProfile,
  saveDeviceToken,
  onAuthStateChanged,
  checkDeviceBlacklist,
  logUserDevice,
  getDeviceFingerprint,
  subscribeToUser,
  updateUserProfile,
  subscribeToAppSettings,
  subscribeToActiveBroadcasts,
  initRemoteConfig,
  checkForceUpdateDetails,
  app,
  db,
  checkIsAdmin,
  getNativeUser,
  syncNativeAuthToWeb,
  getAppSettings,
  fetchActiveBroadcastsOnce
} from './services/firebase';
import {
  PLAY_STORE_URL,
  isAndroidNativePlatform,
  getInstalledAndroidAppInfo,
  openPlayStoreUpdate,
  evaluateAppUpdateRequirement,
  isBroadcastEligible,
  getDismissedBroadcastsMap,
  markBroadcastDismissed,
  getBroadcastPriority,
  getTimestampMillis,
  snoozeFlexibleUpdate,
  InstalledAppInfo
} from './services/updateSystem';
import { getMessaging, onMessage, isSupported } from 'firebase/messaging';
import { onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

import { CapacitorService } from './services/capacitorService';
import { AudioService } from './services/audioService';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { ImpactStyle } from '@capacitor/haptics';
import { PushNotifications } from '@capacitor/push-notifications';

import { Toaster, toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

import PassengerApp from './views/PassengerApp';
import DriverApp from './views/DriverApp';
import AdminPanel from './views/AdminPanel';
import AuthScreen from './views/AuthScreen';
import PasskeyPrompt from './components/PasskeyPrompt';
import { SideMenu } from './components/SideMenu';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { Button } from './components/ui/Button';
import { SplashScreen } from './components/SplashScreen';
import { MandatoryUpdateScreen } from './components/MandatoryUpdateScreen';
import WalletTopUp from './views/WalletTopUp';
import PaymentSuccess from './views/PaymentSuccess';
import RideHistory from './views/RideHistory';
import UserProfile from './views/UserProfile';
import NotificationSettingsView from './views/NotificationSettingsView';
import DriverRegistration from './views/DriverRegistration';
import DriverAnalytics from './views/DriverAnalytics';
import SupportView from './views/SupportView';
import AdminChatView from './views/AdminChatView';
import { MapProviderService } from './services/MapProviderService';
import MessagesListView from './views/MessagesListView';
import VerificationStatus from './views/VerificationStatus';
import PrivacyPolicy from './views/PrivacyPolicy';
import ExternalAuth from './views/ExternalAuth';
import { SafetyView } from './views/SafetyView';

import PhoneLogin from './views/PhoneLogin';
import LandingPage from './views/LandingPage';
import TrackRideView from './views/TrackRideView';
import { OfflineDetector } from './components/OfflineDetector';
import OnboardingScreen from './views/OnboardingScreen';

const PUSH_CHANNEL_ID = 'push_notifications_audio2';

declare global {
  interface Window {
    saveDeviceToken: (token: string) => void;
    handleGoogleSignIn: (token: string) => void;
  }
}

const isQuietModeActive = (settings?: NotificationSettings) => {
    if (!settings || !settings.quietModeEnabled) return false;
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const currentTotal = h * 60 + m;
    
    const parseTime = (timeStr: string) => {
        const parts = timeStr.split(':');
        return parseInt(parts[0] || '0') * 60 + parseInt(parts[1] || '0');
    };
    const startFormat = parseTime(settings.quietHoursStart);
    const endFormat = parseTime(settings.quietHoursEnd);
    
    if (startFormat <= endFormat) {
        return currentTotal >= startFormat && currentTotal <= endFormat;
    } else {
        return currentTotal >= startFormat || currentTotal <= endFormat;
    }
};

const sanitizeUserForCache = (user: User | Driver | null): any => {
  if (!user) return null;
  const clone: Record<string, any> = { ...user };
  const heavyDocFields = [
    'licenseUrl',
    'nationalIdUrl',
    'nationalIdBackUrl',
    'vehicleRegFrontUrl',
    'vehicleRegBackUrl',
    'vehicleImageUrl',
    'criminalRecordUrl',
  ];
  for (const field of heavyDocFields) {
    if (typeof clone[field] === 'string' && clone[field].startsWith('data:')) {
      clone[field] = '';
    }
  }
  if (clone.documents && typeof clone.documents === 'object') {
    clone.documents = { _cached: true };
  }
  if (clone.vehicle && typeof clone.vehicle === 'object') {
    clone.vehicle = { ...clone.vehicle };
    if (typeof clone.vehicle.image === 'string' && clone.vehicle.image.startsWith('data:')) {
      clone.vehicle.image = '';
    }
  }
  if (typeof clone.personalPhotoUrl === 'string' && clone.personalPhotoUrl.startsWith('data:') && clone.personalPhotoUrl.length > 15000) {
    clone.personalPhotoUrl = '';
  }
  if (typeof clone.avatar === 'string' && clone.avatar.startsWith('data:') && clone.avatar.length > 15000) {
    clone.avatar = '';
  }
  return clone;
};

function AppContent() {
  const { isRTL, t } = useLanguage();

  const [showTopHeader, setShowTopHeader] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | Driver | null>(() => {
    try {
      const cached = localStorage.getItem('mowasla_cached_user');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.role === UserRole.ADMIN || parsed.isAdmin) && !checkIsAdmin(parsed.email, null)) {
        parsed.role = parsed.vehicle ? UserRole.DRIVER : UserRole.PASSENGER;
        delete parsed.isAdmin;
        try {
          localStorage.setItem('mowasla_cached_user', JSON.stringify(sanitizeUserForCache(parsed)));
        } catch {}
      }
      return parsed;
    } catch { return null; }
  });
  const currentUserRef = useRef<User | Driver | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  const [isLoading, setIsLoading] = useState(true);

  // Splash screen: display cleanly (1200ms cold, or 800ms if cached)
  useEffect(() => {
    const cached = localStorage.getItem('mowasla_cached_user');
    const displayDuration = cached ? 800 : 1200;
    const splashTimer = setTimeout(() => {
      setIsLoading(false);
    }, displayDuration);
    return () => clearTimeout(splashTimer);
  }, []);
  const [isRestoringSession, setIsRestoringSession] = useState(() => {
    const cached = localStorage.getItem('mowasla_cached_user');
    const lastActive = localStorage.getItem('mowasla_last_active');
    return !!(cached && lastActive && (Date.now() - parseInt(lastActive, 10) < 30 * 60 * 1000));
  });
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isDriverMode, setIsDriverMode] = useState(() => localStorage.getItem('mowasla_is_driver_mode') === 'true');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isDeviceBanned, setIsDeviceBanned] = useState(false);
  const [isUpdateRequired, setIsUpdateRequired] = useState(false);
  const [remoteUpdateDetails, setRemoteUpdateDetails] = useState<{
    installedBuild: number | null;
    requiredBuild: number | null;
  }>({ installedBuild: null, requiredBuild: null });
  const lastRemoteUpdateCheckAtRef = useRef<number>(0);
  const [installedAppInfo, setInstalledAppInfo] = useState<InstalledAppInfo>({ version: '1.0.0', build: 1 });
  const [flexibleUpdateTick, setFlexibleUpdateTick] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isManualLogoutRef = useRef(false);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [activeBroadcasts, setActiveBroadcasts] = useState<any[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(() => !sessionStorage.getItem('mowasla_start_dismissed') && !localStorage.getItem('mowasla_cached_user'));
  
  const [dismissedBroadcastsMap, setDismissedBroadcastsMap] = useState<Record<string, number>>(() => getDismissedBroadcastsMap());

  const isAndroidNative = isAndroidNativePlatform();

  const runRemoteConfigUpdateCheck = React.useCallback(async (trigger: 'startup' | 'resume') => {
    if (!isAndroidNative) return;

    const now = Date.now();
    if (trigger === 'resume' && now - lastRemoteUpdateCheckAtRef.current < 1500) {
      console.log('[ForceUpdate] Skipping duplicate resume check shortly after previous check.');
      return;
    }

    const result = await checkForceUpdateDetails(trigger);
    lastRemoteUpdateCheckAtRef.current = Date.now();

    if (result.installedBuild) {
      setInstalledAppInfo((prev) => ({
        version: result.installedVersionName || prev.version,
        build: result.installedBuild || prev.build,
      }));
    }
    setRemoteUpdateDetails({
      installedBuild: result.installedBuild,
      requiredBuild: result.minSupportedVersion,
    });
    setIsUpdateRequired(result.updateRequired);
  }, [isAndroidNative]);
  const isAdminUser = Boolean(
    (currentUser && (
      currentUser.role === UserRole.ADMIN ||
      (currentUser as any).isAdmin === true ||
      checkIsAdmin(currentUser.email, currentUser.phone)
    )) ||
    (auth.currentUser && checkIsAdmin(auth.currentUser.email, auth.currentUser.phoneNumber))
  );

  const prevUserApprovalStatusRef = useRef<boolean>(
    Boolean(
      currentUser?.role === UserRole.DRIVER &&
      ((currentUser as any)?.status === 'approved' || (currentUser as any)?.isApproved === true || (currentUser as any)?.kycStatus === 'APPROVED')
    )
  );

  const prevUserRejectionStatusRef = useRef<boolean>(
    Boolean(
      (currentUser as any)?.status === 'rejected' || 
      (currentUser as any)?.kycStatus === 'REJECTED' || 
      (currentUser as any)?.driverStatus === 'rejected'
    )
  );

  const lastProcessedNoticeTimestampRef = useRef<number>(0);

  const eligibleBroadcasts = React.useMemo(() => {
    const filtered = activeBroadcasts.filter((broadcast) =>
      isBroadcastEligible({
        broadcast,
        appSettings,
        isAdminUser,
        currentUser,
        installedInfo: installedAppInfo,
        dismissedMap: dismissedBroadcastsMap,
      })
    );
    return filtered.sort((a, b) => {
      const prioDiff = getBroadcastPriority(b) - getBroadcastPriority(a);
      if (prioDiff !== 0) return prioDiff;
      return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
    });
  }, [activeBroadcasts, appSettings, isAdminUser, currentUser, installedAppInfo, dismissedBroadcastsMap]);

  const activeSystemBroadcast = eligibleBroadcasts[0] || null;

  const handleDismissBroadcast = (id: string) => {
      const updated = markBroadcastDismissed(id);
      setDismissedBroadcastsMap(updated);
  };

  // Rebooking State
  const [rebookData, setRebookData] = useState<any>(null);
  const [supportRideId, setSupportRideId] = useState<string | null>(null);
  const [trackRideId, setTrackRideId] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<'HOME' | 'PROFILE' | 'HISTORY' | 'DRIVER_REGISTRATION' | 'WALLET' | 'PAYMENT_SUCCESS' | 'DRIVER_CHECKOUTS' | 'DRIVER_EARNINGS' | 'DRIVER_CANCELED' | 'DRIVER_PENDING' | 'SUPPORT' | 'SAFETY' | 'ADMIN_CHAT' | 'MESSAGES_LIST' | 'VERIFICATION_STATUS' | 'PRIVACY_PAGE' | 'EXTERNAL_AUTH' | 'PHONE_LOGIN' | 'PREVIEW' | 'DUTY_SCHEDULE' | 'TRACK_RIDE' | 'NOTIFICATION_SETTINGS'>(() => {
      if (typeof window !== 'undefined') {
        const cleanPath = window.location.pathname.replace(/\/+$/, '').toLowerCase();
        const searchParams = new URLSearchParams(window.location.search);
        if (cleanPath === '/privacy-policy' || cleanPath === '/privacy-policy.html' || cleanPath === '/privacy' || searchParams.get('page') === 'privacy') {
          return 'PRIVACY_PAGE';
        }
      }
      const saved = localStorage.getItem('mowasla_current_view');
      return (saved && saved !== 'PREVIEW' && saved !== 'PHONE_LOGIN' && saved !== 'PRIVACY_PAGE') ? (saved as any) : 'HOME';
  });

  // Sync state to local storage safely without overflowing quota.
  // Never wipe mowasla_cached_user automatically unless the user explicitly clicked Sign Out.
  useEffect(() => {
    try {
      if (currentUser) {
        isManualLogoutRef.current = false;
        localStorage.setItem('mowasla_cached_user', JSON.stringify(sanitizeUserForCache(currentUser)));
        localStorage.setItem('mowasla_is_driver_mode', isDriverMode.toString());
      } else if (isManualLogoutRef.current) {
        localStorage.removeItem('mowasla_cached_user');
        localStorage.removeItem('mowasla_is_driver_mode');
      }
    } catch (e) {
      console.warn('Could not sync user cache to localStorage:', e);
    }
  }, [currentUser, isDriverMode]);

  useEffect(() => {
    if (currentView !== 'PREVIEW' && currentView !== 'PHONE_LOGIN' && currentView !== 'PRIVACY_PAGE') {
      try {
        localStorage.setItem('mowasla_current_view', currentView);
      } catch {}
    }
  }, [currentView]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (currentUser.role === UserRole.ADMIN || (currentUser as any)?.isAdmin || checkIsAdmin(currentUser.email, currentUser.phone)) {
      return;
    }

    // Keep local session ID synchronized with Firestore without ever auto-logging out the user
    const unsub = onSnapshot(doc(db, 'users', currentUser.id, 'session', 'current'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const localSessionId = localStorage.getItem('mowasla_session_id');
        if (data?.sessionId && data.sessionId !== localSessionId) {
          try {
            localStorage.setItem('mowasla_session_id', data.sessionId);
          } catch {}
        }
      }
    }, (error) => {
      console.warn("Session listener warning:", error);
    });
    return () => unsub();
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    let appStateListener: any;
    if (Capacitor.isNativePlatform()) {
        import('@capacitor/app').then(({ App }) => {
            App.addListener('appStateChange', ({ isActive }) => {
                if (!isActive) {
                    localStorage.setItem('mowasla_last_active', Date.now().toString());
                }
            }).then(listener => appStateListener = listener);
        });
    }
    return () => {
        if (appStateListener) appStateListener.remove();
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pathName = window.location.pathname;
    const track = params.get('track');
    const liveMatch = pathName.match(/^\/live\/(.+)$/);
    
    if (liveMatch) {
      setTrackRideId(liveMatch[1]);
      setCurrentView('TRACK_RIDE');
    } else if (track) {
      setTrackRideId(track);
      setCurrentView('TRACK_RIDE');
    }

    import('./services/audioService').then(({ AudioService }) => {
        AudioService.preloadAll();
    }).catch(e => console.warn('Could not preload audio', e));
  }, []);

  // Rewards Modal State
  const [showRewardsSheet, setShowRewardsSheet] = useState(false);
  const [pointsAnimation, setPointsAnimation] = useState(false);
  const [showPointsToast, setShowPointsToast] = useState(false);
  const [earnedPointsDelta, setEarnedPointsDelta] = useState<number>(5);
  const [isNextRideRewardActive, setIsNextRideRewardActive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mowasla_use_reward_discount') === 'true';
    } catch {
      return false;
    }
  });
  const prevPointsRef = useRef<number>(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const syncRewardFlag = () => {
      try {
        setIsNextRideRewardActive(localStorage.getItem('mowasla_use_reward_discount') === 'true');
      } catch {}
    };
    window.addEventListener('mowasla-reward-discount-change', syncRewardFlag);
    window.addEventListener('storage', syncRewardFlag);
    return () => {
      window.removeEventListener('mowasla-reward-discount-change', syncRewardFlag);
      window.removeEventListener('storage', syncRewardFlag);
    };
  }, []);

  const toggleNextRideRewardDiscount = (forceValue?: boolean) => {
    const nextVal = typeof forceValue === 'boolean' ? forceValue : !isNextRideRewardActive;
    setIsNextRideRewardActive(nextVal);
    try {
      if (nextVal) {
        localStorage.setItem('mowasla_use_reward_discount', 'true');
      } else {
        localStorage.removeItem('mowasla_use_reward_discount');
      }
      window.dispatchEvent(new CustomEvent('mowasla-reward-discount-change', { detail: { active: nextVal } }));
    } catch {}
  };

  useEffect(() => {
    if (currentUser) {
      const settings = currentUser.notificationSettings;
      if (settings) {
        let isQuietHours = isQuietModeActive(settings);

        const allowSounds = settings.enableAllSounds && settings.inAppSounds && !isQuietHours;
        const allowVibrations = settings.enableAllVibrations && !isQuietHours;

        import('./services/audioService').then(({ AudioService }) => {
          AudioService.setInAppSoundsEnabled(allowSounds);
        });
        import('./services/capacitorService').then(({ CapacitorService }) => {
          CapacitorService.setVibrationEnabled(allowVibrations);
        });
      }
    }
  }, [currentUser?.notificationSettings]);

  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role === UserRole.PASSENGER) {
      const currentPoints = currentUser.rewardPoints || 0;
      const threshold = Number(appSettings?.rewardThresholdPoints ?? 50);
      if (currentPoints < threshold && isNextRideRewardActive) {
        toggleNextRideRewardDiscount(false);
      }
      
      if (isFirstRender.current) {
        prevPointsRef.current = currentPoints;
        isFirstRender.current = false;
        return;
      }

      if (currentPoints > prevPointsRef.current && appSettings?.isRewardsEnabled !== false) {
        setEarnedPointsDelta(currentPoints - prevPointsRef.current);
        setPointsAnimation(true);
        setShowPointsToast(true);
        const settings = currentUser?.notificationSettings;
        if (!settings || (settings.enableAllSounds && settings.inAppSounds && !isQuietModeActive(settings))) {
            if (notificationAudioRef.current) {
                notificationAudioRef.current.play().catch(() => {});
            }
        }
        setTimeout(() => {
            setPointsAnimation(false);
            setShowPointsToast(false);
        }, 4000);
      }
      prevPointsRef.current = currentPoints;
    }
  }, [currentUser?.rewardPoints, appSettings?.isRewardsEnabled, appSettings?.rewardThresholdPoints]);

  useEffect(() => {
    const unsubscribeSettings = subscribeToAppSettings((settings) => {
        setAppSettings(settings);
        if (settings?.isRewardsEnabled === false) {
            setShowRewardsSheet(false);
            toggleNextRideRewardDiscount(false);
        }
        if (settings?.audioSettings) {
            AudioService.updateSettings(settings.audioSettings);
        }
    });
    const unsubscribeBroadcasts = subscribeToActiveBroadcasts((broadcasts) => {
        setActiveBroadcasts(broadcasts);
    });

    // Immediate one-shot fetch so slow mobile WebSockets never delay the update/broadcast sheet
    getAppSettings().then((s) => {
      if (s) setAppSettings((prev: any) => prev || s);
    }).catch(() => {});
    fetchActiveBroadcastsOnce().then((b) => {
      if (Array.isArray(b) && b.length > 0) {
        setActiveBroadcasts((prev) => (prev.length > 0 ? prev : b));
      }
    }).catch(() => {});

    const handleSystemPushEvent = (evt: Event) => {
      const detail = (evt as CustomEvent)?.detail || {};
      getAppSettings().then((s) => {
        if (s) setAppSettings(s);
      }).catch(() => {});
      fetchActiveBroadcastsOnce().then((b) => {
        if (Array.isArray(b)) setActiveBroadcasts(b);
      }).catch(() => {});
      if (detail.type === 'SYSTEM_UPDATE' || detail.type === 'FORCE_UPDATE') {
        setAppSettings((prev: any) => ({
          ...(prev || {}),
          forceUpdate: {
            ...(prev?.forceUpdate || {}),
            isEnabled: true,
            requiredVersion: detail.requiredVersion || prev?.forceUpdate?.requiredVersion || '99.0.0',
            titleAr: detail.titleAr || detail.title || prev?.forceUpdate?.titleAr || 'تحديث مطلوب',
            titleEn: detail.title || prev?.forceUpdate?.titleEn || 'Update Required',
            messageAr: detail.bodyAr || detail.body || prev?.forceUpdate?.messageAr || 'يتوفر إصدار جديد من التطبيق على جوجل بلاي. يرجى التحديث الآن.',
            messageEn: detail.body || prev?.forceUpdate?.messageEn || 'A new version of the app is available on Google Play. Please update now.',
          },
        }));
      }
    };

    window.addEventListener('mowasla-system-push-received', handleSystemPushEvent);
    return () => {
        unsubscribeSettings();
        unsubscribeBroadcasts();
        window.removeEventListener('mowasla-system-push-received', handleSystemPushEvent);
    };
  }, []);

  /* =====================================================
      PERMISSIONS HELPERS (Native)
  ===================================================== */
  const requestGPSPermissions = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const pos = await CapacitorService.getCurrentPosition();
        if (pos?.coords) {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          localStorage.setItem('passenger_last_loc', JSON.stringify(loc));
          console.log("⏱️ Startup Timing: Native GPS Updated", performance.now(), 'ms');
        }
      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            localStorage.setItem('passenger_last_loc', JSON.stringify(loc));
            console.log("⏱️ Startup Timing: Web GPS Pre-warmed", performance.now(), 'ms');
          },
          () => {},
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 }
        );
      }
    } catch (e) {
      console.warn(CapacitorService.formatLocationError(e));
    }
  };

  const ensureNotificationSettings = async (user: User) => {
    if (!user.notificationSettings) {
        console.log("[Push Notification] Auto-saving default settings...");
        const defaultSettings = {
            notificationsEnabled: true,
            rideRequests: true,
            rideUpdates: true,
            offers: true,
            adminAlerts: true,
            soundEnabled: true,
            vibrationEnabled: true,
            enableAllSounds: true,
            enableAllVibrations: true,
            inAppSounds: true,
            pushSounds: true,
            driverAcceptedSound: true,
            driverNearingAlert: true,
            rideCancelledAlert: true,
            passengerChatAlerts: true,
            generalAppNotifs: true,
            rideRequestSound: true,
            rideRequestVibration: true,
            driverChatAlerts: true,
            tripStatusAlerts: true,
            driverApproachingAlert: true,
            quietModeEnabled: false,
            quietHoursStart: '00:00',
            quietHoursEnd: '08:00',
        };
        await updateUserProfile(user.id, { notificationSettings: defaultSettings as any });
        user.notificationSettings = defaultSettings as any;
    }
  };

  const setupPushChannels = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const channels = [
        { id: 'ride_requests', name: 'Ride Requests', sound: 'default' },
        { id: 'ride_updates', name: 'Ride Updates', sound: 'default' },
        { id: 'offers', name: 'Offers', sound: 'default' },
        { id: 'admin_alerts', name: 'Admin Alerts', sound: 'default' },
        { id: 'ride_status', name: 'Ride Status', sound: 'default' },
        { id: 'chat', name: 'Chat Messages', sound: 'default' },
        { id: PUSH_CHANNEL_ID, name: 'Default Alerts', sound: 'default' }
      ];
      for (const ch of channels) {
          await PushNotifications.createChannel({
            id: ch.id,
            name: ch.name,
            description: `Notifications for ${ch.name}`,
            importance: 5,
            visibility: 1,
            sound: ch.sound,
            vibration: true,
          });
      }
      console.log(`Notification Channels created.`);
    } catch (e) {
      console.error("Error creating push channel:", e);
    }
  };

  const initializedPushUidRef = useRef<string | null>(null);

  const initializeNotifications = async (user: User) => {
    try {
        await ensureNotificationSettings(user);
        if (Capacitor.isNativePlatform()) {
             console.log("[Push Notification] Auto Initializing...");
             await CapacitorService.setupPushNotifications(user.id);
             await setupPushChannels();
        } else {
             if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                 setShowNotificationPrompt(true);
             } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                 saveDeviceToken(user.id).catch((e) => console.warn("saveDeviceToken err:", e));
             }
        }
    } catch (e) {
        console.error("Initialization error:", e);
    }
  };

  // Ensure both non-auth users and auth users register native push listeners on Android
  useEffect(() => {
    if (!currentUser?.id) {
      initializedPushUidRef.current = null;
      if (Capacitor.isNativePlatform()) {
        CapacitorService.setupPushNotifications().catch(() => {});
        setupPushChannels().catch(() => {});
      }
      return;
    }
    if (initializedPushUidRef.current !== currentUser.id) {
      initializedPushUidRef.current = currentUser.id;
      initializeNotifications(currentUser).catch(() => {});
      try {
        const cachedToken = localStorage.getItem('mowasla_native_fcm_token');
        if (cachedToken) {
          import('./services/firebase').then(({ updateUserToken }) => {
            updateUserToken(currentUser.id, cachedToken).catch(() => {});
          }).catch(() => {});
        }
      } catch {}
    }
  }, [currentUser?.id]);

  /* =====================================================
      REAL-TIME BAN ENFORCEMENT
  ===================================================== */
  useEffect(() => {
    if (!isAndroidNative) return;
    getInstalledAndroidAppInfo().then(setInstalledAppInfo).catch(() => {});

    const resumeListener = CapacitorApp.addListener('resume', async () => {
      console.log('App resumed from background');
      if (auth.currentUser) {
         auth.currentUser.getIdToken(true).catch(e => console.warn('Resume token refresh error', e));
      }
      if (currentUserRef.current?.id) {
         CapacitorService.setupPushNotifications(currentUserRef.current.id).catch(() => {});
      }
      // Refresh Remote Config, settings, and broadcasts on resume so backgrounded users never miss updates
      try {
        const [, freshSettings, freshBroadcasts] = await Promise.all([
          runRemoteConfigUpdateCheck('resume').catch(() => {}),
          getAppSettings().catch(() => null),
          fetchActiveBroadcastsOnce().catch(() => null),
        ]);
        if (freshSettings) setAppSettings(freshSettings);
        if (Array.isArray(freshBroadcasts)) setActiveBroadcasts(freshBroadcasts);
      } catch (e) {
        console.warn('Resume update sync warning:', e);
      }
    });
    return () => {
      resumeListener.then(l => l.remove()).catch(() => {});
    };
  }, [isAndroidNative, runRemoteConfigUpdateCheck]);

  // Prevent Android hardware Back button from dismissing or bypassing mandatory update screen
  useEffect(() => {
    if (!isAndroidNative || !isUpdateRequired) return;
    let backListener: any;
    CapacitorApp.addListener('backButton', () => {
      // Intentionally consume back button while mandatory update is enforced
    }).then((listener) => {
      backListener = listener;
    }).catch(() => {});
    return () => {
      if (backListener) {
        backListener.remove().catch(() => {});
      }
    };
  }, [isAndroidNative, isUpdateRequired]);

  useEffect(() => {
    if (!currentUser?.id) return;

    // Synchronize initial approval state
    const currentIsApproved = Boolean(
      currentUser.role === UserRole.DRIVER &&
      ((currentUser as any)?.status === 'approved' || (currentUser as any)?.isApproved === true || (currentUser as any)?.kycStatus === 'APPROVED')
    );
    if (currentIsApproved) {
      prevUserApprovalStatusRef.current = true;
    }
    const currentIsRejected = Boolean(
      (currentUser as any)?.status === 'rejected' || (currentUser as any)?.kycStatus === 'REJECTED' || (currentUser as any)?.driverStatus === 'rejected'
    );
    if (currentIsRejected) {
      prevUserRejectionStatusRef.current = true;
    }

    const unsubscribe = subscribeToUser(currentUser.id, async (userProfile) => {
        if (userProfile) {
            if (userProfile.isBanned) {
                isManualLogoutRef.current = true;
                setIsDeviceBanned(true);
                setIsLoading(false);
                try {
                  localStorage.removeItem('mowasla_cached_user');
                  localStorage.removeItem('mowasla_is_driver_mode');
                  localStorage.removeItem('mowasla_session_id');
                } catch {}
                setCurrentUser(null);
                await signOut();
                window.location.href = '/';
                return;
            }

            const wasApproved = prevUserApprovalStatusRef.current;
            const isNowApproved = Boolean(
              userProfile.role === UserRole.DRIVER &&
              ((userProfile as any).status === 'approved' || 
               (userProfile as any).isApproved === true || 
               (userProfile as any).kycStatus === 'APPROVED' || 
               (userProfile as any).driverStatus === 'approved')
            );

            const pendingFlag = Boolean(
              userProfile.id && localStorage.getItem('mowasla_driver_approval_pending_' + userProfile.id) === 'true'
            );

            const seenApprovedTs = (() => {
              try {
                return Number((userProfile.id && localStorage.getItem('mowasla_approved_notice_seen_' + userProfile.id)) || 0);
              } catch {
                return 0;
              }
            })();
            const approvalNoticeAlreadyShown = Boolean((userProfile as any).approvalNoticeShown);
            const approvedNoticeTime = Number((userProfile as any).approvedNotice?.timestamp || 0);
            const isNewApprovedNotice = Boolean(
              !approvalNoticeAlreadyShown &&
              approvedNoticeTime > 0 &&
              approvedNoticeTime > lastProcessedNoticeTimestampRef.current &&
              approvedNoticeTime > seenApprovedTs &&
              (Date.now() - approvedNoticeTime < 24 * 60 * 60 * 1000)
            );

            // Triggered when driver is approved by admin:
            // Replaces passenger screen directly with driver screen without refresh, and triggers push notification strictly once.
            if (
              (!wasApproved && isNowApproved && !approvalNoticeAlreadyShown) ||
              (pendingFlag && isNowApproved && !approvalNoticeAlreadyShown) ||
              isNewApprovedNotice
            ) {
                const noticeMarkTs = approvedNoticeTime || Date.now();
                if (userProfile.id) {
                    try {
                        localStorage.removeItem('mowasla_driver_approval_pending_' + userProfile.id);
                        localStorage.setItem('mowasla_approved_notice_seen_' + userProfile.id, String(noticeMarkTs));
                        if ((userProfile as any).approvalGreetingSeen !== true) {
                            localStorage.setItem('mowasla_pending_approval_modal_' + userProfile.id, 'true');
                        }
                    } catch (_e) {}
                    updateUserProfile(userProfile.id, {
                        approvalNoticeShown: true,
                        approvedNotice: null,
                    } as any).catch(() => {});
                }
                prevUserApprovalStatusRef.current = true;
                prevUserRejectionStatusRef.current = false;
                lastProcessedNoticeTimestampRef.current = Math.max(lastProcessedNoticeTimestampRef.current, noticeMarkTs);

                // 1. Direct switch to Driver Mode and Driver screen with NO refresh
                setIsDriverMode(true);
                try {
                    localStorage.setItem('mowasla_is_driver_mode', 'true');
                } catch (_e) {}
                setCurrentView('HOME');

                // 2. Notification copy
                const notifTitle = (userProfile as any).approvedNotice?.title || (isRTL ? 'تهانينا! تمت الموافقة على حسابك 🎉' : 'Congratulations! Account Approved 🎉');
                const notifBody = (userProfile as any).approvedNotice?.body || (isRTL 
                  ? 'تمت الموافقة على مستنداتك وحسابك جاهز لاستقبال الرحلات والعمل الآن!' 
                  : 'Your documents have been approved. You are ready to accept rides now!');

                // 3. System Push / Local Notification
                CapacitorService.scheduleNotification(notifTitle, notifBody, 99999, true);

                // 4. Web Browser Notification API
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification(notifTitle, {
                      body: notifBody,
                      icon: '/favicon.ico',
                      tag: 'driver-approval',
                    });
                  } catch (_e) {}
                }

                // 5. Sound & Haptics
                try {
                  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
                  audio.play().catch(() => {});
                } catch (_e) {}
                import('./services/audioService').then(({ AudioService }) => {
                  AudioService.play('notification').catch(() => {});
                });
                CapacitorService.impact(ImpactStyle.Heavy).catch(() => {});
                CapacitorService.vibrate().catch(() => {});

                // 6. Visual Celebration Toast
                toast.success(notifTitle, {
                  description: notifBody,
                  duration: 9000,
                  position: 'top-center',
                });
            } else if (isNowApproved) {
                if (userProfile.id && pendingFlag) {
                    try {
                        localStorage.removeItem('mowasla_driver_approval_pending_' + userProfile.id);
                    } catch (_e) {}
                }
                prevUserApprovalStatusRef.current = true;
                prevUserRejectionStatusRef.current = false;
            } else {
                prevUserApprovalStatusRef.current = false;
            }

            // Triggered when driver application is REJECTED by admin:
            const wasRejected = prevUserRejectionStatusRef.current;
            const isNowRejected = Boolean(
              (userProfile as any).status === 'rejected' ||
              (userProfile as any).kycStatus === 'REJECTED' ||
              (userProfile as any).driverStatus === 'rejected'
            );

            const seenRejectedTs = (() => {
              try {
                return Number((userProfile.id && localStorage.getItem('mowasla_rejected_notice_seen_' + userProfile.id)) || 0);
              } catch {
                return 0;
              }
            })();
            const rejectionNoticeAlreadyShown = Boolean((userProfile as any).rejectionNoticeShown);
            const rejectionNoticeTime = Number((userProfile as any).rejectionNotice?.timestamp || (userProfile as any).rejectedAt || 0);
            const isNewRejectionNotice = Boolean(
              !rejectionNoticeAlreadyShown &&
              rejectionNoticeTime > 0 &&
              rejectionNoticeTime > lastProcessedNoticeTimestampRef.current &&
              rejectionNoticeTime > seenRejectedTs &&
              (Date.now() - rejectionNoticeTime < 24 * 60 * 60 * 1000)
            );

            if ((!wasRejected && isNowRejected && !rejectionNoticeAlreadyShown) || isNewRejectionNotice) {
                const rejMarkTs = rejectionNoticeTime || Date.now();
                prevUserRejectionStatusRef.current = true;
                prevUserApprovalStatusRef.current = false;
                lastProcessedNoticeTimestampRef.current = Math.max(lastProcessedNoticeTimestampRef.current, rejMarkTs);
                if (userProfile.id) {
                    try {
                        localStorage.setItem('mowasla_rejected_notice_seen_' + userProfile.id, String(rejMarkTs));
                    } catch (_e) {}
                    updateUserProfile(userProfile.id, {
                        rejectionNoticeShown: true,
                        rejectionNotice: null,
                    } as any).catch(() => {});
                }

                // 1. Exit driver mode
                setIsDriverMode(false);
                try {
                    localStorage.removeItem('mowasla_is_driver_mode');
                } catch (_e) {}

                // 2. Notification copy
                const rejReason = (userProfile as any).rejectionReason || (userProfile as any).rejectionNotice?.reason;
                const notifTitle = (userProfile as any).rejectionNotice?.title || (isRTL ? 'تحديث بخصوص طلب انضمامك ككابتن ⚠️' : 'Driver Application Update ⚠️');
                const notifBody = (userProfile as any).rejectionNotice?.body || (rejReason
                  ? (isRTL ? `نعتذر، لم يتم قبول طلبك: ${rejReason}` : `Your application was not approved: ${rejReason}`)
                  : (isRTL ? 'نعتذر، لم يتم قبول مستندات انضمامك ككابتن. يرجى مراجعة المستندات وإعادة التقديم.' : 'Your driver documents were not approved. Please review and reapply.'));

                // 3. System Push / Local Notification
                CapacitorService.scheduleNotification(notifTitle, notifBody, 99998, true);

                // 4. Web Browser Notification API
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  try {
                    new Notification(notifTitle, {
                      body: notifBody,
                      icon: '/favicon.ico',
                      tag: 'driver-rejection',
                    });
                  } catch (_e) {}
                }

                // 5. Sound & Haptics
                try {
                  const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                  audio.play().catch(() => {});
                } catch (_e) {}
                CapacitorService.impact(ImpactStyle.Heavy).catch(() => {});
                CapacitorService.vibrate().catch(() => {});

                // 6. Visual Error Toast
                toast.error(notifTitle, {
                  description: notifBody,
                  duration: 10000,
                  position: 'top-center',
                });

                // 7. Route user to VerificationStatus so they can immediately see the reason and re-submit
                setCurrentView('VERIFICATION_STATUS');
            } else if (isNowRejected) {
                prevUserRejectionStatusRef.current = true;
            } else {
                prevUserRejectionStatusRef.current = false;
            }

            if (
              userProfile.role === UserRole.ADMIN &&
              !checkIsAdmin(auth.currentUser?.email || userProfile.email, auth.currentUser?.phoneNumber)
            ) {
                userProfile.role = ((userProfile as any).vehicle || (userProfile as any).driverStatus === 'approved' || (userProfile as any).status === 'approved' || userProfile.kycStatus === 'APPROVED' || userProfile.isApproved === true) ? UserRole.DRIVER : UserRole.PASSENGER;
                delete (userProfile as any).isAdmin;
            } else if (
              userProfile.role !== UserRole.ADMIN &&
              ((userProfile as any).driverStatus === 'approved' || (userProfile as any).status === 'approved' || userProfile.kycStatus === 'APPROVED' || userProfile.isApproved === true)
            ) {
                userProfile.role = UserRole.DRIVER;
            }
            if (!userProfile.id) {
                userProfile.id = currentUser.id;
            }
            setCurrentUser(userProfile); // Keep profile in sync
        } else if (!checkIsAdmin(auth.currentUser?.email || currentUser.email, auth.currentUser?.phoneNumber)) {
            // Only sign out if the user was explicitly purged by Admin in deleted_auth_accounts
            try {
                const purgeSnap = await getDoc(doc(db, 'deleted_auth_accounts', currentUser.id));
                if (purgeSnap.exists() && purgeSnap.data()?.purgedByAdmin) {
                    setCurrentUser(null);
                    localStorage.removeItem('mowasla_cached_user');
                    localStorage.removeItem('mowasla_is_driver_mode');
                    await signOut().catch(() => {});
                }
            } catch {}
        }
    });
    return () => unsubscribe();
  }, [currentUser?.id, isRTL]);

  /* =====================================================
      🔐 DEEP LINK HANDLING
  ===================================================== */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let appListener: any;

    const initializeDeepLinks = async () => {
      try {
        const processNativeToken = async (token: string) => {
          console.log("🔑 [DeepLink] Processing native token...");
          setIsLoading(true);
          try {
            const { signInWithCustomToken } = await import('firebase/auth');
            const { httpsCallable } = await import('firebase/functions');
            const { functions } = await import('./services/firebase');
            
            const exchangeFn = httpsCallable(functions, 'exchangeNativeAuthToken');
            const result = await exchangeFn({ idToken: token });
            const customToken = (result.data as any).customToken;
            
            console.log("✅ [DeepLink] Token exchanged successfully");
            await signInWithCustomToken(auth, customToken);
            setCurrentView('HOME');
          } catch (exchangeError: any) {
            console.error("❌ [DeepLink] Token exchange failed:", exchangeError);
            alert(isRTL ? "فشل تسجيل الدخول: " + exchangeError.message : "Login failed: " + exchangeError.message);
          } finally {
            setIsLoading(false);
          }
        };

        const handleDeepLink = async (urlStr: string) => {
          try {
            console.log("🚀 [DeepLink] Received URL:", urlStr);
            
            // Use URL parsing but handle potential issues with custom schemes
            let url: URL;
            try {
              url = new URL(urlStr);
            } catch (_urlError) {
              console.warn("⚠️ [DeepLink] URL parsing failed, trying manual parse for waslny://");
              // Fallback for non-standard URL formats if browser URL fails
              if (urlStr.startsWith('waslny://login-success')) {
                const queryPart = urlStr.split('?')[1];
                const params = new URLSearchParams(queryPart);
                const token = params.get('token');
                if (token) {
                  await processNativeToken(token);
                }
              }
              return;
            }

            // Check for waslny://login-success or waslny:login-success
            const isLoginSuccess = (url.protocol === 'waslny:' && (url.hostname === 'login-success' || url.pathname === '//login-success' || url.pathname === 'login-success'));
            
            if (isLoginSuccess) {
              const token = url.searchParams.get("token");
              if (token) {
                await processNativeToken(token);
              }
            }
          } catch (e) {
            console.error("❌ [DeepLink] Error handling deep link:", e);
          }
        };

        // Handle app opened from deep link while running
        appListener = await CapacitorApp.addListener('appUrlOpen', (data) => {
          handleDeepLink(data.url);
        });

        // Handle app started from deep link (cold start)
        const launchUrl = await CapacitorApp.getLaunchUrl();
        if (launchUrl?.url) {
          console.log("❄️ [DeepLink] Cold start URL detected:", launchUrl.url);
          handleDeepLink(launchUrl.url);
        }
      } catch (err) {
        console.error("❌ [DeepLink] Initialization error:", err);
      }
    };

    initializeDeepLinks();

    return () => {
      if (appListener) {
        appListener.remove();
      }
    };
  }, [isRTL]);

  /* =====================================================
      🔐 AUTH STATE & INIT
  ===================================================== */
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Initialize Remote Config and check for forced updates
    const init = async () => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        try {
            if (isAndroidNativePlatform()) {
              await runRemoteConfigUpdateCheck('startup').catch(() => {});
            } else {
              await Promise.race([
                initRemoteConfig('startup'),
                new Promise((resolve) => setTimeout(resolve, 3500))
              ]);
            }
            try {
              await Promise.race([
                MapProviderService.initialize(),
                new Promise((resolve) => setTimeout(resolve, 3500))
              ]);
            } catch(_e) { /* ignore */ }

            // Register Service Worker for Web Push safely
            if (!Capacitor.isNativePlatform() && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                try {
                    const supported = await isSupported().catch(() => false);
                    if (supported) {
                        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((swErr) => {
                            console.warn('FCM Service Worker registration warning:', swErr);
                            return null;
                        });
                        if (registration) {
                            console.log('FCM Service Worker registered with scope:', registration.scope);
                        }
                        
                        // Handle foreground messages safely
                        try {
                            const messaging = getMessaging(app);
                            onMessage(messaging, (payload) => {
                                console.log('Foreground message received:', payload);
                                const data = payload.data || {};
                                const activeUser = currentUserRef.current;
                                
                                // Let Capacitor Native handle its own foreground display
                                if (Capacitor.isNativePlatform()) return;

                                if (data.type === 'CHAT_MESSAGE') {
                                     const settings = activeUser?.notificationSettings;
                                     const canPlay = !settings || (
                                         settings.enableAllSounds && 
                                         settings.inAppSounds && 
                                         !isQuietModeActive(settings) &&
                                         (activeUser?.role === UserRole.DRIVER ? settings.driverChatAlerts : settings.passengerChatAlerts)
                                     );
                                     
                                     if (canPlay && notificationAudioRef.current) {
                                         notificationAudioRef.current.src = "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3";
                                         notificationAudioRef.current.play().catch(() => {});
                                     }
                                     toast.info(payload.notification?.title || data.title || t('messages_label'), {
                                       description: payload.notification?.body || data.body || '',
                                     });
                                } else if (payload.notification || data.title || data.body) {
                                     const settings = activeUser?.notificationSettings;
                                     const canPlay = !settings || (settings.enableAllSounds && settings.inAppSounds && !isQuietModeActive(settings) && settings.generalAppNotifs !== false);
                                     const msgTitle = payload.notification?.title || data.title || '';
                                     const msgBody = payload.notification?.body || data.body || '';

                                     if (canPlay && notificationAudioRef.current) {
                                         notificationAudioRef.current.src = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";
                                         notificationAudioRef.current.play().catch(() => {});
                                     }
                                     if (data.type === 'DRIVER_APPROVED') {
                                         toast.success(msgTitle, { description: msgBody });
                                     } else if (data.type === 'DRIVER_REJECTED') {
                                         toast.error(msgTitle, { description: msgBody });
                                     } else {
                                         toast.info(msgTitle, { description: msgBody });
                                     }
                                }
                            });
                        } catch (msgErr) {
                            console.warn("FCM getMessaging warning:", msgErr);
                        }
                    } else {
                        console.log("Firebase Messaging is not supported in this environment");
                    }
                } catch (err) {
                    console.warn('FCM Service Worker registration skipped:', err);
                }
            }
        } catch (e) {
            console.error("Initialization error:", e);
        }
    };
    init();

    if (isDeviceBanned) return;

    const urlParams = new URLSearchParams(window.location.search);
    const pathName = window.location.pathname;
    const normalizedPath = pathName.replace(/\/+$/, '').toLowerCase();
    
    // Privacy Policy Route Check
    if (
      urlParams.get('page') === 'privacy' ||
      normalizedPath === '/privacy-policy' ||
      normalizedPath === '/privacy-policy.html' ||
      normalizedPath === '/privacy'
    ) {
        setCurrentView('PRIVACY_PAGE');
        setIsLoading(false);
        return;
    }

    if (pathName === '/external-auth') {
        setCurrentView('EXTERNAL_AUTH');
        setIsLoading(false);
        return;
    }

    if (pathName === '/preview' || pathName === '/preview/') {
        setCurrentView('PREVIEW');
        setIsLoading(false);
        return;
    }

    if (pathName === '/phone-login' || pathName === '/phone-login/') {
        setCurrentView('PHONE_LOGIN');
        setIsLoading(false);
        return;
    }

    if (urlParams.get('success') === 'true' || pathName === '/payment-success') {
        setCurrentView('PAYMENT_SUCCESS');
        window.history.replaceState({}, '', '/');
    }

    notificationAudioRef.current = new Audio(
      'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
    );

    if (Capacitor.isNativePlatform()) {
        // Haptic feedback on app load
        CapacitorService.impact(ImpactStyle.Light);
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: any) => {

      if (firebaseUser) {
        console.log("⏱️ Startup Timing: Auth Ready", performance.now(), 'ms');
        // 1. Stabilization Delay & Token Refresh
        try {
           firebaseUser.getIdToken(true).catch((e: any) => console.warn("Token refresh warning:", e));
        } catch(e) {
           console.warn("Token refresh warning:", e);
        }

        // 2. Admin Check: Identify administrators immediately and bypass driver/passenger profile checks
        const userEmail = firebaseUser.email;
        const userPhone = firebaseUser.phoneNumber;
        const isAdminUser = checkIsAdmin(userEmail, userPhone);

        if (isAdminUser) {
          console.log("👑 Admin authenticated in App:", userEmail || userPhone);
          const adminProfile: User = {
            id: firebaseUser.uid,
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
            await setDoc(doc(db, 'users', firebaseUser.uid), {
              ...adminProfile,
              role: UserRole.ADMIN,
              isAdmin: true,
              updatedAt: serverTimestamp()
            }, { merge: true });
          } catch (e) {
            console.warn("Admin profile sync warning:", e);
          }

          setCurrentUser(adminProfile);
          setIsDriverMode(false);
          setIsLocked(false);
          setIsLoading(false);
          setIsRestoringSession(false);
          return;
        }

        // 3. Security Check (Device Blacklist) - for non-admins
        try {
            const deviceId = await getDeviceFingerprint();
            if (deviceId) {
                const isBanned = await checkDeviceBlacklist(deviceId);
                if (isBanned) {
                  isManualLogoutRef.current = true;
                  setIsDeviceBanned(true);
                  setIsLoading(false);
                  try {
                    localStorage.removeItem('mowasla_cached_user');
                    localStorage.removeItem('mowasla_is_driver_mode');
                  } catch {}
                  await signOut(); 
                  return;
                }
            }
        } catch (e) {
            console.warn("Security Check Skipped (non-fatal):", e);
        }

        // 4. Profile Fetch & Handling
        try {
            const profile = await getUserProfile(firebaseUser.uid);
            
            if (profile) {
              if (profile.isBanned) {
                  isManualLogoutRef.current = true;
                  setIsDeviceBanned(true);
                  setIsLoading(false);
                  try {
                    localStorage.removeItem('mowasla_cached_user');
                    localStorage.removeItem('mowasla_is_driver_mode');
                  } catch {}
                  await signOut();
                  return;
              }

              // If user previously deactivated their account and is now logging back in, reactivate automatically instead of signing out
              if ('status' in profile && (profile as any).status === 'deactivated') {
                  (profile as any).status = 'approved';
                  updateUserProfile(profile.id || firebaseUser.uid, { status: 'approved' } as any).catch(() => {});
              }

              // Fallback Safety Check (Issue #9) - only set PENDING_REVIEW if not already approved
              const isAlreadyApprovedDriver =
                profile.role === UserRole.DRIVER ||
                (profile as any).driverStatus === 'approved' ||
                (profile as any).status === 'approved' ||
                profile.kycStatus === 'APPROVED' ||
                profile.isApproved === true;

              if (profile.documents && !profile.kycStatus && !isAlreadyApprovedDriver) {
                  profile.kycStatus = 'PENDING_REVIEW';
                  updateUserProfile(profile.id || firebaseUser.uid, { kycStatus: 'PENDING_REVIEW' }).catch(() => {});
              }

              // --- EXISTING USER ---
              console.log("⏱️ Startup Timing: Firestore Synced", performance.now(), 'ms');
              profile.id = profile.id || firebaseUser.uid;
              if (
                profile.role === UserRole.ADMIN &&
                !checkIsAdmin(firebaseUser.email || profile.email, firebaseUser.phoneNumber)
              ) {
                  profile.role = isAlreadyApprovedDriver || Boolean((profile as any).vehicle) ? UserRole.DRIVER : UserRole.PASSENGER;
                  delete (profile as any).isAdmin;
              } else if (isAlreadyApprovedDriver && profile.role !== UserRole.ADMIN) {
                  profile.role = UserRole.DRIVER;
              }
              setCurrentUser(profile);
              setIsDriverMode(profile.role === UserRole.DRIVER);

              logUserDevice(profile.id).catch(() => {});

              if (
                profile.hasPasskey &&
                profile.privacySettings?.requirePinOnStartup !== false &&
                Boolean(localStorage.getItem('app_pin_hash') || profile.passcode)
              ) {
                 setIsLocked(true);
              }

              initializeNotifications(profile).catch(() => {});
              requestGPSPermissions().catch(() => {});
            } else {
              // --- NEW USER OR TRANSIENT OFFLINE ---
              // Keep cached/in-memory user if already logged in so transient Firestore misses never sign out an active user
              const cachedFallback = (() => {
                if (currentUserRef.current && (currentUserRef.current.name || currentUserRef.current.phone || currentUserRef.current.email)) {
                  return currentUserRef.current;
                }
                try {
                  const raw = localStorage.getItem('mowasla_cached_user');
                  if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.id && (parsed.name || parsed.phone || parsed.email)) {
                      return parsed as User | Driver;
                    }
                  }
                } catch {}
                return null;
              })();

              if (cachedFallback) {
                console.log("Preserving cached/in-memory profile for:", cachedFallback.id);
                if (!currentUserRef.current) {
                  setCurrentUser(cachedFallback);
                  setIsDriverMode(cachedFallback.role === UserRole.DRIVER);
                }
              } else {
                console.log("New user detected, redirecting to profile setup...");
                setCurrentUser(null);
              }
            }
        } catch (err: any) {
            console.warn("Profile fetch warning:", err);
            // Never sign out on profile fetch errors if we have an active or cached user
            if (!currentUserRef.current) {
              try {
                const raw = localStorage.getItem('mowasla_cached_user');
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (parsed && parsed.id) {
                    setCurrentUser(parsed);
                    setIsDriverMode(parsed.role === UserRole.DRIVER);
                  }
                }
              } catch {}
            }
        }
      } else {
        // If user explicitly initiated logout, clear state cleanly
        if (isManualLogoutRef.current) {
          setCurrentUser(null);
          setIsLoading(false);
          setIsRestoringSession(false);
          return;
        }

        // --- CHECK NATIVE AUTH BEFORE LOGGING OUT ---
        if (Capacitor.isNativePlatform()) {
          try {
            const synced = await syncNativeAuthToWeb().catch(() => null);
            if (synced?.uid) {
              setIsLoading(false);
              setIsRestoringSession(false);
              return;
            }
            const nativeRes = await getNativeUser().catch(() => null);
            if (nativeRes?.user?.uid) {
              const nativeProfile = await getUserProfile(nativeRes.user.uid).catch(() => null);
              if (nativeProfile) {
                nativeProfile.id = nativeProfile.id || nativeRes.user.uid;
                setCurrentUser(nativeProfile);
                setIsDriverMode(nativeProfile.role === UserRole.DRIVER);
                setIsLoading(false);
                setIsRestoringSession(false);
                return;
              }
              if (currentUserRef.current?.id) {
                setIsLoading(false);
                setIsRestoringSession(false);
                return;
              }
            }
          } catch {}
        }

        // Preserve existing logged-in session from memory or localStorage so WebView/IndexedDB token reloads never sign the user out automatically
        const persistedUser = (() => {
          if (currentUserRef.current && currentUserRef.current.id && (currentUserRef.current.name || currentUserRef.current.phone || currentUserRef.current.email)) {
            return currentUserRef.current;
          }
          try {
            const raw = localStorage.getItem('mowasla_cached_user');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && parsed.id && (parsed.name || parsed.phone || parsed.email)) {
                return parsed as User | Driver;
              }
            }
          } catch {}
          return null;
        })();

        if (persistedUser) {
          if (!currentUserRef.current) {
            setCurrentUser(persistedUser);
            setIsDriverMode(persistedUser.role === UserRole.DRIVER || localStorage.getItem('mowasla_is_driver_mode') === 'true');
          }
          setIsLoading(false);
          setIsRestoringSession(false);
          return;
        }

        // --- LOGGED OUT (No cached session & no Firebase user) ---
        setCurrentUser(null);
      }
      setIsLoading(false);
      setIsRestoringSession(false);
    });

    return () => unsubscribe();
  }, []); 

  const handleRequestNotificationPermission = async () => {
    if (!currentUser) return;
    await saveDeviceToken(currentUser.id);
    setShowNotificationPrompt(false);
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    isManualLogoutRef.current = true;
    setIsLoggingOut(true);

    try {
      localStorage.removeItem('mowasla_cached_user');
      localStorage.removeItem('mowasla_is_driver_mode');
      localStorage.removeItem('mowasla_session_id');
    } catch {}

    if (Capacitor.isNativePlatform()) {
        try {
           PushNotifications.removeAllListeners();
        } catch (error) {
           console.debug("Push listener removal failed", error);
        }
    }

    // Let React unmount components and clear Firebase listeners
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        if (currentUser) {
            const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
            const { db } = await import('./services/firebase');
            const userRef = doc(db, 'users', currentUser.id);

            await updateDoc(userRef, {
                isOnline: false,
                fcmToken: null,
                lastSeen: serverTimestamp(),
                driverStatus: 'OFFLINE'
            });
        }
    } catch (e) {
        console.warn("User status update failed", e);
    }

    try {
        await signOut();
    } catch (e) {
        console.error("Sign out error", e);
    } finally {
        try {
          localStorage.removeItem('mowasla_cached_user');
          localStorage.removeItem('mowasla_is_driver_mode');
          localStorage.removeItem('mowasla_session_id');
        } catch {}
        setCurrentUser(null);
        setIsDriverMode(false);
        setIsDrawerOpen(false);
        setCurrentView('HOME');
        setIsLocked(false);
        setIsLoggingOut(false);
        setIsLoading(false);
    }
  };

  const handleNavigate = (view: any) => {
    setCurrentView(view);
    setIsDrawerOpen(false);
  };

  const handleRebook = (ride: Ride, preferSameDriver: boolean) => {
      setRebookData({ ride, preferSameDriver });
      setCurrentView('HOME');
  };

  const updateEvaluation = React.useMemo(() => {
    void flexibleUpdateTick;
    return evaluateAppUpdateRequirement({
      appSettings,
      installedInfo: installedAppInfo,
      remoteMinBuildExceeded: false,
      isAdminUser,
    });
  }, [appSettings, installedAppInfo, isAdminUser, flexibleUpdateTick]);

  // Unified global sheet overlay rendered for BOTH authenticated and unauthenticated Android users (never Admin)
  const renderSystemSheetOverlay = () => {
    if (!isAndroidNative || isAdminUser) return null;

    // 1. Maintenance Mode Sheet
    if (appSettings?.maintenanceMode?.isEnabled) {
      return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-end justify-center p-0 sm:p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 pb-safe animate-slide-up relative overflow-hidden shadow-2xl">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-red-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border-4 border-white shadow-red-100">
              <i className="fas fa-tools text-2xl text-red-600 animate-pulse"></i>
            </div>
            <div className="text-center relative z-10">
              <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight" dir="auto">{isRTL ? "تحديث النظام" : "Maintenance Mode"}</h1>
              <p className="text-sm font-medium text-gray-500 mb-8 leading-relaxed max-w-xs mx-auto" dir="auto">
                {isRTL ? appSettings.maintenanceMode.messageAr || "نحن نقوم حالياً بتحديث النظام. يرجى المحاولة لاحقاً." : appSettings.maintenanceMode.messageEn || "We are currently improving the app experience. Please try again later."}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // 2. Smart App Update Sheet
    if (updateEvaluation.needed) {
      return (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-end justify-center p-0 sm:p-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 pb-safe animate-slide-up relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border-4 border-white shadow-blue-100">
              <i className="fas fa-download text-2xl text-blue-600 animate-bounce"></i>
            </div>
            <div className="text-center relative z-10">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 tracking-tight" dir="auto">
                {isRTL ? updateEvaluation.titleAr : updateEvaluation.titleEn}
              </h1>
              <p className="text-sm font-medium text-gray-500 mb-8 leading-relaxed max-w-xs mx-auto" dir="auto">
                {isRTL ? updateEvaluation.messageAr : updateEvaluation.messageEn}
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    openPlayStoreUpdate();
                  }}
                  className="w-full h-14 rounded-2xl bg-[#FFC90E] text-gray-900 hover:bg-yellow-400 font-black text-lg shadow-xl shadow-yellow-100 flex items-center justify-center gap-2"
                >
                  <i className="fab fa-google-play"></i>
                  <span>{isRTL ? "تحديث من جوجل بلاي" : "Update on Google Play"}</span>
                </Button>
                {updateEvaluation.mode === 'flexible' && (
                  <button
                    type="button"
                    onClick={() => {
                      snoozeFlexibleUpdate(updateEvaluation.updateKey);
                      setFlexibleUpdateTick((prev) => prev + 1);
                    }}
                    className="w-full h-12 flex items-center justify-center rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                  >
                    {isRTL ? "لاحقاً" : "Not Now"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3. Active System Broadcast / Emergency / Update Sheet
    if (activeSystemBroadcast) {
      const broadcast = activeSystemBroadcast;
      const isUpdate = broadcast.type === 'update' || broadcast.type === 'Forced Update';
      const isCritical = broadcast.type === 'alert' || broadcast.type === 'Critical';
      const isMaintenanceNotice = broadcast.type === 'maintenance';
      const displayTitle = isRTL
        ? (broadcast.titleAr || broadcast.title || (isUpdate ? 'تحديث جديد متاح!' : ''))
        : (broadcast.titleEn || broadcast.title || (isUpdate ? 'New Update Available!' : ''));
      const displayMessage = isRTL
        ? (broadcast.messageAr || broadcast.message || (isUpdate ? 'لقد أطلقنا إصداراً جديداً يتضمن ميزات محسّنة وتجربة أسرع لضمان أقصى درجات الأمان واستقرار التطبيق. يرجى التحديث الآن لضمان حصولك على أفضل أداء وأحدث الميزات.' : ''))
        : (broadcast.messageEn || broadcast.message || (isUpdate ? 'We have released a new version with improved features and a faster experience to ensure maximum security and app stability. Please update now to get the best performance and latest features.' : ''));

      return (
        <div
          key={broadcast.id}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-end justify-center p-0 sm:p-4"
          onClick={() => {
            if (!broadcast.forceClose && !isUpdate) {
              handleDismissBroadcast(broadcast.id);
            }
          }}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 pb-safe animate-slide-up relative overflow-hidden shadow-2xl"
            dir={isRTL ? "rtl" : "ltr"}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`absolute top-0 left-0 w-full h-1 ${
              isCritical ? 'bg-red-500' :
              isMaintenanceNotice ? 'bg-orange-500' :
              broadcast.type === 'warning' ? 'bg-yellow-500' :
              broadcast.type === 'promo' ? 'bg-green-500' : 'bg-blue-500'
            }`}></div>
            {!broadcast.forceClose && (
              <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8"></div>
            )}
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-6 shadow-sm border-4 border-white ${
              isCritical ? 'bg-red-100 text-red-600' :
              isMaintenanceNotice ? 'bg-orange-100 text-orange-600' :
              broadcast.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
              broadcast.type === 'promo' ? 'bg-green-100 text-green-600' :
              isUpdate ? 'bg-blue-50 text-blue-600 shadow-blue-100' : 'bg-blue-100 text-blue-600'
            }`}>
              <i className={`fas text-2xl ${
                isCritical ? 'fa-exclamation-triangle animate-pulse' :
                isMaintenanceNotice ? 'fa-tools' :
                broadcast.type === 'warning' ? 'fa-exclamation-circle' :
                broadcast.type === 'promo' ? 'fa-star' :
                isUpdate ? 'fa-download animate-bounce' : 'fa-bullhorn'
              }`}></i>
            </div>
            <div className="text-center relative z-10">
              <h3 className="text-2xl font-black text-gray-900 mb-2 tracking-tight" dir="auto">
                {isUpdate && (!displayTitle || displayTitle.toLowerCase() === 'update')
                  ? (isRTL ? 'تحديث جديد متاح!' : 'New Update Available!')
                  : displayTitle}
              </h3>
              <p className="text-sm font-medium text-gray-500 mb-8 leading-relaxed max-w-xs mx-auto" dir="auto">
                {isUpdate && (!displayMessage || displayMessage.toLowerCase() === 'update')
                  ? (isRTL ? 'لقد أطلقنا إصداراً جديداً يتضمن ميزات محسّنة وتجربة أسرع لضمان أقصى درجات الأمان واستقرار التطبيق. يرجى التحديث الآن لضمان حصولك على أفضل أداء وأحدث الميزات.' : 'We have released a new version with improved features and a faster experience to ensure maximum security and app stability. Please update now to get the best performance and latest features.')
                  : displayMessage}
              </p>
              <div className="space-y-3">
                {isUpdate ? (
                  <button
                    type="button"
                    onClick={() => {
                      openPlayStoreUpdate();
                    }}
                    className="w-full h-14 flex items-center justify-center rounded-2xl bg-[#FFC90E] text-gray-900 hover:bg-yellow-400 font-black text-lg transition-transform active:scale-95 shadow-lg shadow-yellow-100"
                  >
                    <i className="fab fa-google-play mr-2 rtl:ml-2"></i> {isRTL ? 'تحديث من جوجل بلاي' : 'Update on Google Play'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleDismissBroadcast(broadcast.id)}
                    className={`w-full h-14 flex items-center justify-center rounded-2xl font-black text-lg transition-transform active:scale-95 ${
                      isCritical ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-200' :
                      'bg-gray-900 text-white hover:bg-black shadow-xl shadow-gray-200'
                    }`}
                  >
                    {isRTL ? 'موافق' : 'I Understand'}
                  </button>
                )}
                {(!broadcast.forceClose && isUpdate) && (
                  <button
                    type="button"
                    onClick={() => handleDismissBroadcast(broadcast.id)}
                    className="w-full h-12 flex items-center justify-center rounded-xl text-gray-500 font-bold hover:bg-gray-50 transition-colors"
                  >
                    {isRTL ? 'لاحقاً' : 'Not Now'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  if (isAndroidNative && isUpdateRequired) {
    return (
      <MandatoryUpdateScreen
        installedBuild={remoteUpdateDetails.installedBuild}
        requiredBuild={remoteUpdateDetails.requiredBuild}
      />
    );
  }

  if (currentView === 'PRIVACY_PAGE') {
    return (
      <>
        <PrivacyPolicy isStandalone onBack={() => setCurrentView('HOME')} />
        {renderSystemSheetOverlay()}
      </>
    );
  }

  if (showOnboarding && !currentUser) {
      return (
        <>
          <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
          {renderSystemSheetOverlay()}
        </>
      );
  }

  if (currentView === 'PHONE_LOGIN') {
    return (
      <>
        <PhoneLogin />
        {renderSystemSheetOverlay()}
      </>
    );
  }

  if (currentView === 'PREVIEW') {
    return (
      <>
        <LandingPage />
        {renderSystemSheetOverlay()}
      </>
    );
  }

  if (currentView === 'EXTERNAL_AUTH') {
      return (
        <>
          <ExternalAuth />
          {renderSystemSheetOverlay()}
        </>
      );
  }

  if (isDeviceBanned) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 px-6 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
         <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <i className="fas fa-ban text-5xl text-white"></i>
         </div>
         <h1 className="text-3xl font-black text-white mb-4">Account Suspended</h1>
         <p className="text-gray-400 font-medium mb-8">Your account or device has been banned due to policy violations.</p>
         <button onClick={handleLogout} className="px-6 py-3 bg-gray-800 text-white rounded-xl font-bold">Close App</button>
      </div>
    );
  }

  if (isLoggingOut) {
      return (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900 px-6 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
             <div className="w-16 h-16 border-4 border-t-yellow-500 border-gray-700 rounded-full animate-spin mb-6"></div>
             <h1 className="text-2xl font-bold text-white mb-2">{isRTL ? "جاري تسجيل الخروج..." : "Logging out..."}</h1>
             <p className="text-gray-400 font-medium">{isRTL ? "يرجى الانتظار" : "Please wait"}</p>
          </div>
      );
  }

  if (isLoading) {
    return (
      <>
        <SplashScreen isRTL={isRTL} onDismiss={() => setIsLoading(false)} />
        {renderSystemSheetOverlay()}
      </>
    );
  }

  if (currentView === 'TRACK_RIDE' && trackRideId) {
      return (
          <div className="h-[100dvh] w-full bg-white relative font-sans">
             <TrackRideView rideId={trackRideId} onClose={() => window.location.href = '/'} />
             {renderSystemSheetOverlay()}
          </div>
      );
  }

  if (!currentUser) {
    return (
      <>
        <AuthScreen
          onLoginSuccess={(u) => { setCurrentUser(u); setIsDriverMode(u.role === UserRole.DRIVER); }}
          onBackToStart={() => {
            try { sessionStorage.removeItem('mowasla_start_dismissed'); } catch {}
            setShowOnboarding(true);
          }}
        />
        {renderSystemSheetOverlay()}
      </>
    );
  }

  if (isLocked && currentUser.hasPasskey && Boolean(localStorage.getItem('app_pin_hash') || currentUser.passcode)) {
      return (
          <>
            <PasskeyPrompt 
                user={currentUser} 
                onSuccess={() => setIsLocked(false)}
                onLogout={handleLogout}
            />
            {renderSystemSheetOverlay()}
          </>
      );
  }

  return (
    <div className="h-full h-[100dvh] w-full overflow-hidden bg-[#1f2025] font-sans">
      <SideMenu 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        user={currentUser}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onToggleDriverMode={() => {
            if (isDriverMode) {
               setIsDriverMode(false);
            } else if (currentUser.role === UserRole.DRIVER) {
               setIsDriverMode(true);
            } else {
               const status = currentUser.kycStatus === 'PENDING_REVIEW' ? 'pending' 
                            : currentUser.kycStatus === 'REJECTED' ? 'rejected' 
                            : currentUser.kycStatus === 'APPROVED' ? 'approved' 
                            : currentUser.driverStatus;
                            
               if (status === 'pending' || status === 'rejected') {
                  setCurrentView('VERIFICATION_STATUS');
               } else {
                  setCurrentView('DRIVER_REGISTRATION');
               }
            }
            setIsDrawerOpen(false);
        }}
        isDriverMode={isDriverMode}
        appSettings={appSettings}
      />

      <div 
        className={`h-full h-[100dvh] w-full flex flex-col relative bg-gray-100 transform-gpu will-change-transform transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isDrawerOpen 
            ? `transform scale-[0.84] ${isRTL ? '-translate-x-[70%]' : 'translate-x-[70%]'} rounded-[32px] overflow-hidden pointer-events-none` 
            : 'transform-none rounded-none'
        }`}
      >
        {isDrawerOpen && <div className="absolute inset-0 z-[60] bg-black/10" onClick={() => setIsDrawerOpen(false)}></div>}

        {showNotificationPrompt && !Capacitor.isNativePlatform() && (
            <div className="fixed inset-0 z-[110] bg-black/60 flex items-end justify-center p-4">
                <div className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center animate-slide-up">
                    <h2 className="text-2xl font-black mb-4">تفعيل الإشعارات</h2>
                    <p className="text-gray-500 text-sm mb-6">تابع حالة رحلتك وعروض السائقين في وقتها الحقيقي.</p>
                    <div className="flex flex-col gap-3">
                        <Button onClick={handleRequestNotificationPermission} className="h-14">تفعيل الآن</Button>
                        <button onClick={() => setShowNotificationPrompt(false)} className="text-gray-400 text-sm">ليس الآن</button>
                    </div>
                </div>
            </div>
        )}

        <div className="flex-1 relative h-full w-full overflow-hidden bg-gray-100">
          {/* Persistent Home Layer - keeps Map & GPS mounted when navigating to secondary pages */}
          <div
            className={`h-full w-full transform-gpu transition-[transform,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              currentView === 'HOME' || currentView === 'DUTY_SCHEDULE'
                ? 'opacity-100 scale-100 pointer-events-auto visible'
                : 'opacity-0 scale-[0.94] pointer-events-none invisible absolute inset-0'
            }`}
          >
            {/* SIDEBAR BUTTON & HEADER - Updated to justify-between */}
            <div className={`absolute top-safe mt-4 z-[60] flex pointer-events-none w-full px-4 justify-between items-start transition-opacity duration-200 ${!showTopHeader ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
              <button 
                onClick={() => setIsDrawerOpen(true)} 
                className={`pointer-events-auto w-10 h-10 bg-white shadow-md rounded-full flex items-center justify-center hover:bg-gray-50 active:scale-90 transition-all ${!showTopHeader ? 'hidden' : ''}`}
              >
                <i className="fas fa-sliders-h text-gray-700"></i>
              </button>

              {/* Gift Icon for Passengers */}
              {!isDriverMode && currentUser && showTopHeader && (
                  <button 
                    onClick={() => {
                      if (appSettings?.isRewardsEnabled !== false) {
                        setShowRewardsSheet(true);
                      } else {
                        setCurrentView('PROFILE');
                      }
                    }}
                    className="pointer-events-auto bg-white shadow-md rounded-full p-1.5 pr-4 flex items-center gap-2 transition-transform active:scale-95 border border-gray-100"
                  >
                      {currentUser.avatar ? (
                          <img src={currentUser.avatar} alt="User" className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0" />
                      ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                              {currentUser.name?.charAt(0).toUpperCase() || <i className="fas fa-user"></i>}
                          </div>
                      )}
                      <div className="flex flex-col items-start mx-1 rtl:mr-1.5 flex">
                          <span className="text-xs font-bold text-gray-800 leading-tight line-clamp-1 max-w-[70px]">
                              {currentUser.name ? currentUser.name.split(' ')[0] : t('user_title')}
                          </span>
                      </div>
                      
                      {appSettings?.isRewardsEnabled !== false && (
                        <>
                          <div className="w-px h-5 bg-gray-200 mx-0.5"></div>

                          <div className="flex flex-col items-start ml-1 rtl:ml-0 rtl:mr-1">
                              <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider leading-none mb-0.5">{t('points_label')}</span>
                              <span className="text-xs font-black text-gray-900 leading-none">{currentUser.rewardPoints || 0}</span>
                          </div>
                          <div className={`relative w-7 h-7 bg-[#FFC90E] rounded-full flex items-center justify-center text-black shadow-sm shrink-0 ${pointsAnimation ? 'animate-bounce' : ''}`}>
                               <i className="fas fa-gift text-xs"></i>
                               {(currentUser.rewardPoints || 0) >= Number(appSettings?.rewardThresholdPoints ?? 50) && (
                                 <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-white ${isNextRideRewardActive ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`}></span>
                               )}
                          </div>
                        </>
                      )}
                  </button>
              )}
            </div>

            {(currentUser.role === UserRole.ADMIN &&
              checkIsAdmin(auth.currentUser?.email || currentUser.email, auth.currentUser?.phoneNumber)) ? (
               <AdminPanel
                  onExitAdmin={() => {
                    setCurrentUser((prev) => {
                      if (!prev) return prev;
                      const normalizedRole = (prev as any).vehicle ? UserRole.DRIVER : UserRole.PASSENGER;
                      const healed = { ...prev, role: normalizedRole };
                      delete (healed as any).isAdmin;
                      try {
                        localStorage.setItem('mowasla_cached_user', JSON.stringify(sanitizeUserForCache(healed)));
                      } catch {}
                      return healed;
                    });
                    setCurrentView('HOME');
                  }}
               />
            ) : isDriverMode ? (
               <DriverApp 
                  driver={currentUser as Driver} 
                  onNavigateToProfile={() => setCurrentView('PROFILE')} 
                  onLogout={handleLogout}
                  showDutySchedule={currentView === 'DUTY_SCHEDULE'}
                  onCloseDutySchedule={() => setCurrentView('HOME')}
               />
            ) : (
               <PassengerApp 
                  user={currentUser} 
                  rebookData={rebookData} 
                  clearRebookData={() => setRebookData(null)}
                  onNavigate={handleNavigate}
                  setSupportRideId={setSupportRideId}
                  onHeaderVisibilityChange={setShowTopHeader}
               />
            )}
          </div>

          {/* Fast Scale Transition Overlay for Secondary Pages */}
          <AnimatePresence mode="sync">
            {currentView !== 'HOME' && currentView !== 'DUTY_SCHEDULE' && (
              <motion.div
                key={currentView}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 z-[70] h-full w-full bg-gray-100 overflow-hidden transform-gpu will-change-transform"
              >
                {currentView === 'DRIVER_REGISTRATION' && (
                    <DriverRegistration 
                      userId={currentUser.id} 
                      baseUser={currentUser} 
                      onComplete={(data) => { 
                          try {
                              localStorage.setItem('mowasla_driver_approval_pending_' + currentUser.id, 'true');
                          } catch (_e) {}
                          setCurrentUser(prev => ({ ...prev, ...data } as User | Driver));
                          setIsDriverMode(false); // Do not force driver mode
                          setCurrentView('VERIFICATION_STATUS'); 
                      }} 
                      onBack={() => setCurrentView('HOME')} 
                    />
                )}

                {currentView === 'VERIFICATION_STATUS' && (
                    <VerificationStatus 
                      user={currentUser} 
                      onNavigate={(view) => {
                        if (view === 'HOME' && ((currentUser as any)?.status === 'approved' || currentUser?.isApproved || (currentUser as any)?.kycStatus === 'APPROVED')) {
                          setIsDriverMode(true);
                          try {
                              localStorage.setItem('mowasla_is_driver_mode', 'true');
                          } catch (_e) {}
                        }
                        setCurrentView(view);
                      }}
                      onStartWork={() => {
                        setIsDriverMode(true);
                        try {
                            localStorage.setItem('mowasla_is_driver_mode', 'true');
                        } catch (_e) {}
                        setCurrentView('HOME');
                      }}
                    />
                )}
                
                {currentView === 'TRACK_RIDE' && trackRideId && (
                    <TrackRideView rideId={trackRideId} onClose={() => { setCurrentView('HOME'); setTrackRideId(null); window.history.replaceState({}, document.title, "/"); }} />
                )}

                {currentView === 'DRIVER_CHECKOUTS' && <DriverAnalytics user={currentUser} initialTab="CHECKOUTS" onBack={() => setCurrentView('HOME')} onNavigate={(view) => setCurrentView(view as any)} />}
                {currentView === 'DRIVER_EARNINGS' && <DriverAnalytics user={currentUser} initialTab="CHECKOUTS" onBack={() => setCurrentView('HOME')} onNavigate={(view) => setCurrentView(view as any)} />}
                {currentView === 'DRIVER_CANCELED' && <DriverAnalytics user={currentUser} initialTab="CANCELED" onBack={() => setCurrentView('HOME')} onNavigate={(view) => setCurrentView(view as any)} />}
                {currentView === 'DRIVER_PENDING' && <DriverAnalytics user={currentUser} initialTab="PENDING" onBack={() => setCurrentView('HOME')} onNavigate={(view) => setCurrentView(view as any)} />}

                {currentView === 'PROFILE' && <UserProfile user={currentUser} onBack={() => setCurrentView('HOME')} onNavigate={(view) => setCurrentView(view as any)} />}
                {currentView === 'NOTIFICATION_SETTINGS' && <NotificationSettingsView user={currentUser} onBack={() => setCurrentView('PROFILE')} />}
                {currentView === 'WALLET' && <WalletTopUp user={currentUser} onBack={() => setCurrentView('PROFILE')} />}
                {currentView === 'PAYMENT_SUCCESS' && <PaymentSuccess onContinue={() => setCurrentView('HOME')} />}
                {currentView === 'HISTORY' && <RideHistory user={currentUser} onBack={() => setCurrentView('HOME')} onRebook={handleRebook} />}
                {currentView === 'SUPPORT' && <SupportView user={currentUser} onBack={() => { setCurrentView('HOME'); setSupportRideId(null); }} rideId={supportRideId} />}
                {currentView === 'SAFETY' && <SafetyView user={currentUser} onBack={() => setCurrentView('HOME')} onOpenMenu={() => setIsDrawerOpen(true)} onNavigate={(view) => setCurrentView(view as any)} />}
                {currentView === 'ADMIN_CHAT' && <AdminChatView user={currentUser} onBack={() => setCurrentView('HOME')} />}
                {currentView === 'MESSAGES_LIST' && <MessagesListView user={currentUser} onBack={() => setCurrentView('HOME')} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Rewards Popup Sheet */}
        {isRestoringSession && (
            <div className="fixed top-safe mt-4 left-1/2 transform -translate-x-1/2 z-[150] animate-fade-in pointer-events-none">
                <div className="bg-black/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="text-xs font-bold">{isRTL ? "جارٍ استعادة الجلسة..." : "Restoring session..."}</span>
                </div>
            </div>
        )}
        {showPointsToast && appSettings?.isRewardsEnabled !== false && (
            <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-[150] animate-bounce-short pointer-events-none">
                <div className="bg-[#FFC90E] text-black px-6 py-3 rounded-full shadow-2xl border-2 border-white flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                        <i className="fas fa-gift text-[#FFC90E] text-lg animate-pulse"></i>
                    </div>
                    <div className="flex flex-col text-left rtl:text-right">
                        <span className="font-black text-sm leading-none uppercase tracking-wider">{isRTL ? "تم إضافة نقاط!" : "Points Added!"}</span>
                        <span className="text-xs font-bold opacity-80">+{earnedPointsDelta} {t('points_label')}</span>
                    </div>
                </div>
            </div>
        )}
        {showRewardsSheet && appSettings?.isRewardsEnabled !== false && (() => {
            const userPoints = Number(currentUser?.rewardPoints || 0);
            const pointsPerTrip = Number(appSettings?.rewardPointsPerTrip ?? 5);
            const thresholdPoints = Number(appSettings?.rewardThresholdPoints ?? 50);
            const discountAmount = Number(appSettings?.rewardDiscountAmount ?? 20);
            const isEligibleForDiscount = userPoints >= thresholdPoints;
            const availableRewardsCount = Math.floor(userPoints / thresholdPoints);
            const progressPercent = isEligibleForDiscount
              ? 100
              : Math.min(100, Math.round((userPoints / thresholdPoints) * 100));
            const remainingPoints = Math.max(0, thresholdPoints - userPoints);

            return (
              <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4" onClick={() => setShowRewardsSheet(false)}>
                  <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-7 pb-safe animate-sheet-scale relative overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                      
                      {/* Decorative Background */}
                      <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#FFC90E] rounded-full blur-[80px] opacity-10 pointer-events-none"></div>
                      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-5 pointer-events-none"></div>

                      {/* Handle */}
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-6"></div>

                      <div className="text-center relative z-10">
                          <div className="w-20 h-20 bg-gradient-to-br from-yellow-100 to-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-yellow-100/50 border-4 border-white">
                              <i className="fas fa-gift text-4xl text-[#FFC90E] drop-shadow-sm animate-bounce-short"></i>
                          </div>
                          
                          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-1 tracking-tight">{t('rewards_title')}</h2>
                          
                          <div className="flex items-baseline justify-center gap-1.5 mb-6">
                              <span className="text-5xl font-black text-[#FFC90E] tracking-tighter drop-shadow-sm">{userPoints}</span>
                              <span className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('points_label')}</span>
                          </div>

                          {/* Progress Bar Area */}
                          <div className="bg-gray-50 rounded-3xl p-5 border border-gray-100 mb-5">
                              <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5 px-1">
                                  <span>0</span>
                                  <span>{thresholdPoints} {t('points_label')}</span>
                              </div>
                              <div className="h-5 bg-white rounded-full overflow-hidden border border-gray-100 shadow-inner p-1">
                                  <div 
                                      className={`h-full rounded-full transition-all duration-500 ease-out relative shadow-sm ${
                                        isEligibleForDiscount
                                          ? 'bg-gradient-to-r from-emerald-400 via-[#FFC90E] to-amber-500'
                                          : 'bg-gradient-to-r from-yellow-300 to-[#FFC90E]'
                                      }`} 
                                      style={{ width: `${progressPercent}%` }}
                                  >
                                      <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>
                                  </div>
                              </div>
                              <p className={`text-center mt-3 text-xs font-black ${isEligibleForDiscount ? 'text-emerald-600' : 'text-gray-500'}`}>
                                  {isEligibleForDiscount
                                    ? (isRTL
                                        ? `🎉 لديك ${availableRewardsCount} مكافأة متاحة! (خصم ${discountAmount} ج.م على رحلتك)`
                                        : `🎉 You have ${availableRewardsCount} reward(s) unlocked! (-${discountAmount} EGP off)`)
                                    : (isRTL
                                        ? `متبقي ${remainingPoints} نقطة للحصول على خصم ${discountAmount} ج.م`
                                        : `${remainingPoints} more points to unlock ${discountAmount} EGP discount`)}
                              </p>

                              {isEligibleForDiscount && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextState = !isNextRideRewardActive;
                                    toggleNextRideRewardDiscount(nextState);
                                    toast.success(
                                      nextState
                                        ? (isRTL
                                            ? `تم تفعيل خصم ${discountAmount} ج.م لرحلتك القادمة! سيتم خصم ${thresholdPoints} نقطة عند طلب الرحلة.`
                                            : `${discountAmount} EGP discount activated for your next ride!`)
                                        : (isRTL
                                            ? 'تم إلغاء تفعيل خصم النقاط للرحلة القادمة'
                                            : 'Reward discount deactivated for next ride')
                                    );
                                  }}
                                  className={`mt-4 w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 shadow-md cursor-pointer ${
                                    isNextRideRewardActive
                                      ? 'bg-emerald-600 text-white shadow-emerald-200'
                                      : 'bg-[#FFC90E] hover:bg-yellow-400 text-gray-900 shadow-yellow-200'
                                  }`}
                                >
                                  <i className={`fas ${isNextRideRewardActive ? 'fa-check-circle' : 'fa-bolt'}`}></i>
                                  <span>
                                    {isNextRideRewardActive
                                      ? (isRTL
                                          ? `تم تفعيل خصم ${discountAmount} ج.م للرحلة القادمة (اضغط للإلغاء)`
                                          : `${discountAmount} EGP Discount Active for Next Ride (Tap to cancel)`)
                                      : (isRTL
                                          ? `استخدم ${thresholdPoints} نقطة للحصول على خصم ${discountAmount} ج.م الآن`
                                          : `Use ${thresholdPoints} Points for ${discountAmount} EGP Off Next Ride`)}
                                  </span>
                                </button>
                              )}
                          </div>

                          {/* Rules List */}
                          <div className="space-y-3 mb-6 text-left rtl:text-right">
                              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white border border-gray-50 shadow-sm">
                                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                                    +{pointsPerTrip}
                                  </div>
                                  <div className="flex-1">
                                      <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-0.5">{t('per_trip')}</div>
                                      <div className="text-sm font-bold text-gray-800">
                                        {isRTL
                                          ? `اكسب ${pointsPerTrip} نقاط عن كل رحلة مكتملة!`
                                          : `Earn ${pointsPerTrip} points for every ride you complete!`}
                                      </div>
                                  </div>
                              </div>
                              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white border border-gray-50 shadow-sm">
                                  <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                                    {discountAmount}
                                  </div>
                                  <div className="flex-1">
                                      <div className="text-xs font-black text-gray-400 uppercase tracking-wider mb-0.5">{t('discount')}</div>
                                      <div className="text-sm font-bold text-gray-800">
                                        {isRTL
                                          ? `اجمع ${thresholdPoints} نقطة للحصول على خصم ${discountAmount} ج.م`
                                          : `Collect ${thresholdPoints} points to get ${discountAmount} EGP discount`}
                                      </div>
                                  </div>
                              </div>
                          </div>

                          <Button onClick={() => setShowRewardsSheet(false)} className="w-full h-14 bg-gray-900 text-white rounded-2xl font-black text-lg shadow-xl shadow-gray-200 hover:bg-black transition-all active:scale-95">
                              {t('ok_btn')}
                          </Button>
                      </div>
                  </div>
              </div>
            );
        })()}
        
        {/* Global System & Update Sheet (Android non-Admin only, rendered on all views) */}
        {renderSystemSheetOverlay()}
      </div>
    </div>
  );
}

const isStandalonePrivacyPath = () => {
  if (typeof window === 'undefined') return false;
  const normalizedPath = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const params = new URLSearchParams(window.location.search);
  return (
    normalizedPath === '/privacy-policy' ||
    normalizedPath === '/privacy-policy.html' ||
    normalizedPath === '/privacy' ||
    params.get('page') === 'privacy'
  );
};

const App = () => {
  if (isStandalonePrivacyPath()) {
    return (
      <LanguageProvider>
        <PrivacyPolicy isStandalone />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <Toaster position="top-center" richColors theme="light" closeButton />
      <OfflineDetector />
      <AppContent />
    </LanguageProvider>
  );
};

export default App;
