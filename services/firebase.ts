import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithRedirect as firebaseSignInWithRedirect,
  getRedirectResult as firebaseGetRedirectResult,
  signInWithEmailAndPassword as firebaseSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as firebaseCreateUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  PhoneAuthProvider,
  signInWithCredential,
  User as FirebaseUser,
  deleteUser as firebaseDeleteUser,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp,
  getDocs,
  deleteDoc,
  increment,
  runTransaction,
  arrayUnion,
  arrayRemove,
  deleteField,
  setLogLevel
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { 
  getRemoteConfig, 
  fetchAndActivate, 
  getString, 
  getNumber, 
  getBoolean
} from 'firebase/remote-config';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { User, Driver, Ride, RideStatus, UserRole, OfferDetails, ManualTopup, SupportTicket, PricingConfig, AppSettings, AppAudioSettings, Place, PaymentStatus, PaymentMethod, Coordinates, HomeAdBannerConfig } from '../types';
import { Device } from '@capacitor/device';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { FirebaseRemoteConfig, GetValueSource } from '@capacitor-firebase/remote-config';
import { Capacitor } from '@capacitor/core';
import firebaseAppletConfig from '../firebase-applet-config.json';

// Configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || "AIzaSyCehtRJUKVVkXZYMLtv7dqFZOWItgxOlJE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || "waslny-7791e.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || "waslny-7791e",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || "waslny-7791e.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || "851969305124",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || "1:851969305124:web:868643f9a848fefb2a86b1"
};

const INVALID_DB_IDS = new Set([
  'ai-studio-waslny-f4f32e33-c8e0-4c8f-9906-38a6a367b48f'
]);

const getConfiguredDatabaseId = (): string => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const override = window.localStorage.getItem('mowasla_override_firestore_db_id');
      if (override && override.trim()) {
        const cleaned = override.trim();
        if (INVALID_DB_IDS.has(cleaned)) {
          window.localStorage.setItem('mowasla_override_firestore_db_id', '(default)');
          return '(default)';
        }
        return cleaned;
      }
    }
  } catch {}
  const cfgId = firebaseAppletConfig.firestoreDatabaseId;
  if (!cfgId || INVALID_DB_IDS.has(cfgId)) {
    return "(default)";
  }
  return cfgId;
};

export const firestoreDatabaseId = getConfiguredDatabaseId();

// Initialize Firebase
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with Persistence
export const auth = getAuth(app);
// Initialize browser persistence to avoid IndexedDB corruption issues
setPersistence(auth, browserLocalPersistence).catch(e => { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); }; } });

export const waitForStableAuth = async (timeoutMs = 3500): Promise<FirebaseUser | null> => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const user = auth.currentUser;

    if (user?.uid) {
      try {
        const token = await user.getIdToken();
        if (token) {
          return user;
        }
      } catch (e) {
        console.warn('[AUTH RETRY]', e);
      }
      return user;
    }

    await new Promise(r => setTimeout(r, 200));
  }

  return auth.currentUser;
};

export const retryAuthCheck = async (maxRetries = 5): Promise<FirebaseUser | null> => {
  let attempt = 0;
  while (attempt < maxRetries) {
    if (auth.currentUser?.uid) {
      return auth.currentUser;
    }
    await new Promise(res => setTimeout(res, 500 * Math.pow(2, attempt)));
    attempt++;
  }
  return auth.currentUser;
};

// Suppress noisy internal offline transport notices from polluting console
try {
  setLogLevel('error');
} catch {}

// Clean up any stale IndexedDB persistence leases with future timestamps from previous sessions
if (typeof window !== 'undefined' && window.indexedDB) {
  try {
    const knownDbNames = [
      `firestore/[DEFAULT]/${firestoreDatabaseId}/main`,
      'firestore/[DEFAULT]/(default)/main',
      'firestore/[DEFAULT]/ai-studio-waslny-f4f32e33-c8e0-4c8f-9906-38a6a367b48f/main',
    ];
    knownDbNames.forEach((name) => {
      try { window.indexedDB.deleteDatabase(name); } catch {}
    });
  } catch {}
}

// Initialize Firestore with robust memory caching and auto-detect long-polling for iframe/proxy stability
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalAutoDetectLongPolling: true,
  }, firestoreDatabaseId);
} catch {
  firestoreDb = getFirestore(app, firestoreDatabaseId);
}
export const db = firestoreDb;

export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();

export const DEFAULT_COMMISSION_RATE = 0.1;

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, _isListener = false) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isPermission = errMessage.toLowerCase().includes('permission') || 
                       (error as any)?.code === 'permission-denied';

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  const isOptionalConfigRead =
    operationType === OperationType.GET &&
    (path === 'settings/pricing' || path === 'settings/app' || path === 'settings/features');

  if (isPermission && !_isListener && !isOptionalConfigRead) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    console.warn(`[Firestore ${operationType} at ${path}]:`, errMessage);
  }
}

// --- AUTHENTICATION ---

export const signOut = async () => {
  await firebaseSignOut(auth);
  if (Capacitor.getPlatform() !== 'web') {
    try {
      await FirebaseAuthentication.signOut();
    } catch (e) {
      console.warn("Native signOut failed:", e);
    }
  }
};

export const onAuthStateChanged = (authInstance: any, callback: (user: FirebaseUser | null) => void) => {
  return firebaseOnAuthStateChanged(authInstance, callback);
};

export const signInWithGoogle = async () => {
  if (Capacitor.getPlatform() !== 'web') {
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();
      if (!result.credential?.idToken) {
          throw new Error("No ID Token found from Native Google Sign In");
      }
      const credential = GoogleAuthProvider.credential(result.credential.idToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    } catch (error) {
        console.error("Native Google Sign In Error:", error);
        throw error;
    }
  } else {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error: any) {
      if (error.code === 'auth/popup-blocked') {
        console.warn("Popup blocked, falling back to redirect...");
        await firebaseSignInWithRedirect(auth, googleProvider);
        return null;
      }
      throw error;
    }
  }
};

export const signInWithRedirect = (authInstance: any, provider: any) => firebaseSignInWithRedirect(authInstance, provider);

export const getRedirectResult = (authInstance: any) => firebaseGetRedirectResult(authInstance);

export const signInWithCustomToken = (authInstance: any, token: string) => {
  return firebaseSignInWithCustomToken(authInstance, token);
};

export const createUserWithEmailAndPassword = (authInstance: any, email: string, pass: string) => {
  return firebaseCreateUserWithEmailAndPassword(authInstance, email, pass);
};

export const signInWithEmailAndPassword = (authInstance: any, email: string, pass: string) => {
  return firebaseSignInWithEmailAndPassword(authInstance, email, pass);
};

export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);

let activeCodeSentListener: any = null;
let activeFailedListener: any = null;
let activeCompletedListener: any = null;

const removeNativePhoneListeners = async () => {
  try {
    if (activeCodeSentListener) {
      await activeCodeSentListener.remove();
      activeCodeSentListener = null;
    }
    if (activeFailedListener) {
      await activeFailedListener.remove();
      activeFailedListener = null;
    }
    if (activeCompletedListener) {
      await activeCompletedListener.remove();
      activeCompletedListener = null;
    }
  } catch(e) {
    console.warn("Error removing Native Auth listeners", e);
  }
};

export const sendOtpNative = async (phone: string): Promise<{verificationId: string}> => {
  await removeNativePhoneListeners();

  return new Promise(async (resolve, reject) => {
    // Auto timeout for the session
    const watchdog = setTimeout(() => {
       removeNativePhoneListeners();
       reject(new Error("Timeout: No response from Firebase phone authentication"));
    }, 45000); // Surface native OTP failures sooner instead of hanging for two minutes.

    const cleanup = () => {
      clearTimeout(watchdog);
      removeNativePhoneListeners();
    };

    activeCodeSentListener = await FirebaseAuthentication.addListener('phoneCodeSent', (event: any) => {
      console.log("phoneCodeSent event:", event);
      cleanup();
      resolve({ verificationId: event.verificationId });
    });

    activeFailedListener = await FirebaseAuthentication.addListener('phoneVerificationFailed', (event: any) => {
      console.error("phoneVerificationFailed event:", event);
      cleanup();
      reject(new Error(event?.message || "Phone verification failed"));
    });

    activeCompletedListener = await FirebaseAuthentication.addListener('phoneVerificationCompleted', (event: any) => {
      console.log("phoneVerificationCompleted event:", event);
      cleanup();
      resolve({ verificationId: 'AUTO_VERIFIED', credential: event.credential } as any);
    });

    try {
      await FirebaseAuthentication.signInWithPhoneNumber({
        phoneNumber: phone,
        timeout: 15
      });
    } catch(err) {
      cleanup();
      reject(err);
    }
  });
};

export const verifyOtpNative = async (verificationId: string, code: string) => {
  try {
    await FirebaseAuthentication.confirmVerificationCode({
      verificationId,
      verificationCode: code,
    });

    // Get the user after successful verification
    const { user } = await FirebaseAuthentication.getCurrentUser();
    
    if (user) {
      try {
        await syncNativeAuthToWeb();
        await waitForStableAuth(8000);
        console.log("Native to Web SDK sync successful. UID:", auth.currentUser?.uid);
      } catch (syncError) {
        console.warn("Web SDK sync timeout after verification. Proceeding with native user.", syncError);
      }
    }

    return { user: auth.currentUser || user };
  } catch (error: any) {
    console.error("Native OTP Verification Exception:", error);
    throw error;
  }
};

export const getNativeUser = async () => {
  return await FirebaseAuthentication.getCurrentUser();
};

export const getNativeIdToken = async () => {
  return await FirebaseAuthentication.getIdToken();
};

export const syncNativeAuthToWeb = async () => {
  if (Capacitor.getPlatform() === 'web') {
    return auth.currentUser;
  }

  if (auth.currentUser?.uid) {
    return auth.currentUser;
  }

  const nativeUser = await FirebaseAuthentication.getCurrentUser();
  if (!nativeUser?.user?.uid) {
    return null;
  }

  const nativeTokenResult = await FirebaseAuthentication.getIdToken();
  const nativeIdToken = nativeTokenResult?.token;
  if (!nativeIdToken) {
    throw new Error('Native auth token unavailable');
  }

  const exchangeFn = httpsCallable(functions, 'exchangeNativeAuthToken');
  const result = await exchangeFn({ idToken: nativeIdToken });
  const customToken = (result.data as any)?.customToken;

  if (!customToken) {
    throw new Error('Custom token exchange failed');
  }

  const credential = await firebaseSignInWithCustomToken(auth, customToken);
  return credential.user;
};

export const normalizePhone = (phone: string, countryCode: string) => {
  let p = phone.replace(/\D/g, '');
  if (countryCode === '+20' && p.startsWith('0')) p = p.slice(1);
  return `${countryCode}${p}`;
};

export const openPhoneLogin = async (phone: string) => {
  const url =
    `https://waslny-7791e.web.app/phone-login?phone=${encodeURIComponent(phone)}&native=true`;

  await Browser.open({ url });
};

// --- USER MANAGEMENT ---


export const createActiveSession = async (uid: string, platform = 'web') => {
  if (!uid) return '';
  const sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  try {
    localStorage.setItem('mowasla_session_id', sessionId);
    localStorage.setItem('mowasla_session_created_at', Date.now().toString());
  } catch {}
  try {
    const deviceId = await getDeviceFingerprint();
    const sessionRef = doc(db, 'users', uid, 'session', 'current');
    await setDoc(sessionRef, {
      sessionId,
      deviceId,
      platform,
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      active: true
    });
  } catch (e) {
    console.warn('Could not persist active session:', e);
  }
  return sessionId;
};

export const validateSession = async (uid) => {
  const localSessionId = localStorage.getItem('mowasla_session_id');
  if (!localSessionId) return false;
  
  try {
    const sessionRef = doc(db, 'users', uid, 'session', 'current');
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) return false;
    
    const data = sessionSnap.data();
    return data.sessionId === localSessionId && data.active === true;
  } catch (e) {
    console.error("Session validation error", e);
    return true; // Allow on network error
  }
};

export const ADMIN_EMAILS = [
  "wondersco@gmail.com",
  "wonderscoco10@gmail.com"
];

export const isNormalizedAdminPhone = (phone?: string | null): boolean => {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  // Specifically matches Egyptian mobile 01024419931 with or without country code 20
  return digits === '201024419931' || digits === '01024419931' || digits.endsWith('1024419931');
};

export const isNormalizedAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

export const checkIsAdmin = (email?: string | null, phone?: string | null): boolean => {
  if (isNormalizedAdminEmail(email)) return true;
  // If the account has a non-admin email address (e.g., a regular passenger who signed up with email/Google
  // and entered the support phone number in their profile), it is NOT an admin account.
  if (email && email.trim() !== '') return false;
  return isNormalizedAdminPhone(phone);
};

export const getUserProfile = async (uid: string): Promise<User | Driver | null> => {
  if (!uid) return null;

  const path = `users/${uid}`;
  for (let i = 0; i < 3; i++) {
    try {
      const stableUser = auth.currentUser || await waitForStableAuth(2500);
      const isCurrentAuthAdmin = stableUser
        ? checkIsAdmin(stableUser.email, stableUser.phoneNumber)
        : false;

      // Check if this user's Auth account was purged by Admin
      if (stableUser && uid === stableUser.uid && !isCurrentAuthAdmin) {
        try {
          const purgeSnap = await getDoc(doc(db, 'deleted_auth_accounts', uid));
          if (purgeSnap.exists() && purgeSnap.data()?.purgedByAdmin) {
            await deleteDoc(doc(db, 'deleted_auth_accounts', uid)).catch(() => {});
            await firebaseDeleteUser(stableUser).catch(() => {});
            await signOut().catch(() => {});
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.removeItem('mowasla_cached_user');
              window.localStorage.removeItem('mowasla_is_driver_mode');
            }
            return null;
          }
        } catch {}
      }

      const userDocRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = { ...userDoc.data(), id: userDoc.id } as User | Driver;
        const isUserAdmin =
          isNormalizedAdminEmail(data.email) ||
          (stableUser && uid === stableUser.uid && isCurrentAuthAdmin);
        if (isUserAdmin) {
          data.role = UserRole.ADMIN;
          (data as any).isAdmin = true;
        } else {
          // Strictly protect normal accounts: remove any accidental ADMIN role or flag
          if (data.role === UserRole.ADMIN || (data as any).isAdmin) {
            const hasDriverProfile = Boolean((data as any).vehicle || (data as any).licenseNumber || (data as any).driverStatus === 'approved' || (data as any).status === 'approved' || data.kycStatus === 'APPROVED' || data.isApproved === true);
            data.role = hasDriverProfile ? UserRole.DRIVER : UserRole.PASSENGER;
            delete (data as any).isAdmin;
            updateDoc(userDocRef, { role: data.role, isAdmin: false }).catch(() => {});
          } else if (
            ((data as any).driverStatus === 'approved' || (data as any).status === 'approved' || data.kycStatus === 'APPROVED' || data.isApproved === true) &&
            data.role !== UserRole.DRIVER
          ) {
            data.role = UserRole.DRIVER;
          }
        }
        return data;
      }

      // If document doesn't exist yet in Firestore but authenticated user is an Admin, synthesize and persist
      if (stableUser && uid === stableUser.uid && isCurrentAuthAdmin) {
        const adminProfile: User = {
          id: uid,
          name: 'WondersCo Admin',
          email: stableUser.email || 'wondersco@gmail.com',
          phone: stableUser.phoneNumber || '+201024419931',
          role: UserRole.ADMIN,
          avatar: stableUser.photoURL || 'https://ui-avatars.com/api/?name=Admin',
          rating: 5.0,
          profileCompleted: true,
          hasPasskey: false,
          isApproved: true,
          status: 'approved'
        };
        await setDoc(userDocRef, { ...adminProfile, createdAt: serverTimestamp() }, { merge: true });
        return adminProfile;
      }

      // Fallback to locally cached user if matching uid (prevents transient network or auth sync hiccups from dropping session)
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const cachedRaw = window.localStorage.getItem('mowasla_cached_user');
          if (cachedRaw) {
            const cachedUser = JSON.parse(cachedRaw);
            if (cachedUser && cachedUser.id === uid && (cachedUser.name || cachedUser.phone || cachedUser.email)) {
              return cachedUser as User | Driver;
            }
          }
        } catch {}
      }

      return null;
    } catch (error: any) {
      const errMsg = error?.message || String(error);
      const isRecoverable = errMsg.includes('Auth not ready') || 
                            errMsg.includes('offline') || 
                            errMsg.includes('unavailable') ||
                            errMsg.includes('permission-denied') || 
                            error?.code?.includes('permission-denied');

      if (i < 2 && isRecoverable) {
        console.warn(`[FIRESTORE RETRY] getUserProfile attempt ${i + 1}`);
        await new Promise(r => setTimeout(r, 800 * (i + 1)));
        continue;
      }
      handleFirestoreError(error, OperationType.GET, path);
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const cachedRaw = window.localStorage.getItem('mowasla_cached_user');
          if (cachedRaw) {
            const cachedUser = JSON.parse(cachedRaw);
            if (cachedUser && cachedUser.id === uid && (cachedUser.name || cachedUser.phone || cachedUser.email)) {
              return cachedUser as User | Driver;
            }
          }
        } catch {}
      }
      return null;
    }
  }
  return null;
};

export const createUserProfile = async (user: User | Driver) => {
  const path = `users/${user.id}`;
  for (let i = 0; i < 3; i++) {
    try {
      await waitForStableAuth(1500);
      console.log('[FIRESTORE WRITE] writing user profile for:', user.id);
      await setDoc(doc(db, 'users', user.id), {
        ...user,
        id: user.id,
        profileCompleted: user.profileCompleted ?? true,
        createdAt: user.createdAt || serverTimestamp(),
        walletBalance: user.walletBalance || 0,
        rating: user.rating || 5
      }, { merge: true });
      return;
    } catch (error: any) {
      if (i < 2 && (error.message?.includes('Auth not ready') || error.message?.includes('permission-denied') || error.code?.includes('permission-denied'))) {
        console.warn(`[FIRESTORE RETRY] createUserProfile attempt ${i + 1}`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
};

export const updateUserProfile = async (uid: string, data: Partial<User | Driver>) => {
  if (!uid) return;
  const path = `users/${uid}`;
  for (let i = 0; i < 3; i++) {
    try {
      await waitForStableAuth(1500);
      await setDoc(doc(db, 'users', uid), { ...data, id: uid }, { merge: true });
      return;
    } catch (error: any) {
      if (i < 2 && (error.message?.includes('Auth not ready') || error.message?.includes('permission-denied') || error.code?.includes('permission-denied'))) {
        console.warn(`[FIRESTORE RETRY] updateUserProfile attempt ${i + 1}`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
};

export const saveDeviceToken = async (uid: string) => {
  if (!uid) return null;
  if (Capacitor.getPlatform() !== 'web') {
    // Native handles this via CapacitorService.setupPushNotifications
    return null;
  }

  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      console.log('Firebase Messaging is not supported in this environment');
      return null;
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default' && typeof Notification.requestPermission === 'function') {
        const perm = await Notification.requestPermission().catch(() => 'denied');
        if (perm !== 'granted') return null;
      } else if (Notification.permission === 'denied') {
        return null;
      }
    }

    const messaging = getMessaging(app);
    // Ensure service worker is registered and active before calling getToken
    let registration;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js').catch(() => undefined);
      if (!registration) {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(() => undefined);
      }
      if (registration && !registration.active) {
        await navigator.serviceWorker.ready.catch(() => undefined);
      }
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    const tokenOptions: any = {};
    if (registration) tokenOptions.serviceWorkerRegistration = registration;
    if (vapidKey) tokenOptions.vapidKey = vapidKey;

    const token = await getToken(messaging, tokenOptions).catch((tokErr) => {
      console.warn("Could not get FCM token:", tokErr);
      return null;
    });
    
    if (token) {
      await updateUserToken(uid, token);
      return token;
    }
  } catch (error) {
    console.warn("Web Push Token Warning:", error);
  }
  
  return null;
};

export const updateUserToken = async (uid: string, token: string) => {
  if (!uid || !token) return;
  await updateUserProfile(uid, {
    fcmToken: token,
    fcmTokenUpdatedAt: Date.now(),
    fcmPlatform: Capacitor.getPlatform(),
  } as any);
};

export const checkDeviceBlacklist = async (deviceId: string) => {
  const docRef = doc(db, 'blacklisted_devices', deviceId);
  const snap = await getDoc(docRef);
  return snap.exists();
};

export const logUserDevice = async (uid: string) => {
  const deviceId = await getDeviceFingerprint();
  if (deviceId) {
    await setDoc(doc(db, 'users', uid, 'devices', deviceId), {
      lastSeen: serverTimestamp()
    }, { merge: true });
  }
};

export const getDeviceFingerprint = async (): Promise<string> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await Device.getId();
      const id = (info as any)?.identifier || (info as any)?.uuid;
      if (id) {
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem('_mowasla_device_id', id);
            window.localStorage.setItem('_capuid', id);
          } catch {}
        }
        return id;
      }
    } catch (e) {
      console.warn("Native Device.getId skipped:", e);
    }
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    let uid = window.localStorage.getItem('_capuid') || window.localStorage.getItem('_mowasla_device_id');
    if (!uid) {
      uid = 'web_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now().toString(36);
      window.localStorage.setItem('_mowasla_device_id', uid);
      window.localStorage.setItem('_capuid', uid);
    }
    return uid;
  }
  return 'web_fallback_' + Date.now();
};

export const subscribeToUser = (uid: string, callback: (user: User | Driver | null) => void) => {
  if (!uid) return () => {};
  const path = `users/${uid}`;
  return onSnapshot(doc(db, 'users', uid), async (snap) => {
    if (!snap.exists()) {
      if (auth.currentUser && auth.currentUser.uid === uid && !checkIsAdmin(auth.currentUser.email, auth.currentUser.phoneNumber)) {
        try {
          const purgeSnap = await getDoc(doc(db, 'deleted_auth_accounts', uid));
          if (purgeSnap.exists() && purgeSnap.data()?.purgedByAdmin) {
            await deleteDoc(doc(db, 'deleted_auth_accounts', uid)).catch(() => {});
            await firebaseDeleteUser(auth.currentUser).catch(() => {});
            await signOut().catch(() => {});
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.removeItem('mowasla_cached_user');
              window.localStorage.removeItem('mowasla_is_driver_mode');
            }
          }
        } catch {}
      }
      callback(null);
      return;
    }
    const data = { ...snap.data(), id: snap.id } as User | Driver;
    const isAuthAdmin =
      auth.currentUser && auth.currentUser.uid === uid
        ? checkIsAdmin(auth.currentUser.email, auth.currentUser.phoneNumber)
        : false;
    const isUserAdmin = isNormalizedAdminEmail(data.email) || isAuthAdmin;
    if (!isUserAdmin && (data.role === UserRole.ADMIN || (data as any).isAdmin)) {
      const hasDriverProfile = Boolean((data as any).vehicle || (data as any).licenseNumber || (data as any).driverStatus === 'approved' || (data as any).status === 'approved' || data.kycStatus === 'APPROVED' || data.isApproved === true);
      data.role = hasDriverProfile ? UserRole.DRIVER : UserRole.PASSENGER;
      delete (data as any).isAdmin;
      updateDoc(doc(db, 'users', uid), { role: data.role, isAdmin: false }).catch(() => {});
    } else if (
      !isUserAdmin &&
      ((data as any).driverStatus === 'approved' || (data as any).status === 'approved' || data.kycStatus === 'APPROVED' || data.isApproved === true) &&
      data.role !== UserRole.DRIVER
    ) {
      data.role = UserRole.DRIVER;
    }
    callback(data);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path, true);
  });
};

export const getAllUsers = async () => {
  const q = query(collection(db, 'users'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as User | Driver));
};

export const subscribeToAllUsers = (callback: (users: (User | Driver)[]) => void) => {
  const q = query(collection(db, 'users'));
  return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User | Driver));
      callback(users);
  }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users', true);
  });
};

export const getAllDrivers = async () => {
  const q = query(collection(db, 'users'), where('role', '==', UserRole.DRIVER));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Driver));
};

export const getUsersByIds = async (ids: string[]) => {
  if (ids.length === 0) return [];
  const promises = ids.map(id => getDoc(doc(db, 'users', id)));
  const snaps = await Promise.all(promises);
  return snaps.map(s => s.exists() ? (s.data() as User | Driver) : null).filter(u => u !== null) as (User | Driver)[];
};

export const deleteUser = async (uid: string) => {
  await deleteDoc(doc(db, 'users', uid));
};

export const deleteUserAccount = async (uid: string) => {
  await deleteDoc(doc(db, 'users', uid));
  if (auth.currentUser) {
    await firebaseDeleteUser(auth.currentUser);
  }
};

export interface PurgeUserSummary {
  deletedProfile: boolean;
  deletedRides: number;
  deletedTickets: number;
  deletedTopups: number;
  deletedSettlements: number;
  deletedAdminChat: boolean;
  authRevoked: boolean;
}

export const adminPurgeUserCompletely = async (
  uid: string,
  options: { purgeRelatedRecords?: boolean } = { purgeRelatedRecords: true }
): Promise<PurgeUserSummary> => {
  const summary: PurgeUserSummary = {
    deletedProfile: false,
    deletedRides: 0,
    deletedTickets: 0,
    deletedTopups: 0,
    deletedSettlements: 0,
    deletedAdminChat: false,
    authRevoked: false
  };

  if (!uid) return summary;

  // 1. Mark Auth account for immediate destruction & attempt server-side Auth deletion
  try {
    await setDoc(doc(db, 'deleted_auth_accounts', uid), {
      uid,
      deletedAt: Date.now(),
      purgedByAdmin: true
    });
    summary.authRevoked = true;
  } catch (e) {
    console.warn('Could not write deleted_auth_accounts marker:', e);
  }

  try {
    await fetch('/api/admin/delete-user-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid })
    });
  } catch {}

  // 2. Delete user subcollections (devices, session, recentPlaces, savedPlaces, notifications)
  const userSubcollections = ['devices', 'session', 'recentPlaces', 'savedPlaces', 'notifications'];
  for (const sub of userSubcollections) {
    try {
      const subSnap = await getDocs(collection(db, 'users', uid, sub));
      await Promise.all(subSnap.docs.map((d) => deleteDoc(d.ref).catch(() => {})));
    } catch {}
  }

  // 3. Delete main user profile document
  await deleteDoc(doc(db, 'users', uid));
  summary.deletedProfile = true;

  if (options.purgeRelatedRecords !== false) {
    // 4. Delete direct admin chat & its messages
    try {
      const adminChatId = `admin_chat_${uid}`;
      const chatMsgs = await getDocs(collection(db, 'rides', adminChatId, 'messages'));
      await Promise.all(chatMsgs.docs.map((m) => deleteDoc(m.ref).catch(() => {})));
      await deleteDoc(doc(db, 'rides', adminChatId));
      summary.deletedAdminChat = true;
    } catch {}

    // 5. Delete support tickets & their messages
    try {
      const ticketsQ = query(collection(db, 'supportTickets'), where('userId', '==', uid));
      const ticketsSnap = await getDocs(ticketsQ);
      for (const tDoc of ticketsSnap.docs) {
        try {
          const tMsgs = await getDocs(collection(db, 'supportTickets', tDoc.id, 'messages'));
          await Promise.all(tMsgs.docs.map((m) => deleteDoc(m.ref).catch(() => {})));
        } catch {}
        await deleteDoc(tDoc.ref).catch(() => {});
        summary.deletedTickets++;
      }
    } catch {}

    // 6. Delete manual wallet topups
    try {
      const topupsQ = query(collection(db, 'manualTopups'), where('userId', '==', uid));
      const topupsSnap = await getDocs(topupsQ);
      for (const topDoc of topupsSnap.docs) {
        await deleteDoc(topDoc.ref).catch(() => {});
        summary.deletedTopups++;
      }
    } catch {}

    // 7. Delete driver settlements
    try {
      const settlementsQ = query(collection(db, 'settlements'), where('driverId', '==', uid));
      const settlementsSnap = await getDocs(settlementsQ);
      for (const sDoc of settlementsSnap.docs) {
        await deleteDoc(sDoc.ref).catch(() => {});
        summary.deletedSettlements++;
      }
    } catch {}

    // 8. Delete rides where passengerId == uid or driverId == uid
    try {
      const paxRidesQ = query(collection(db, 'rides'), where('passengerId', '==', uid));
      const paxRidesSnap = await getDocs(paxRidesQ);
      for (const rDoc of paxRidesSnap.docs) {
        await deleteDoc(rDoc.ref).catch(() => {});
        summary.deletedRides++;
      }
    } catch {}

    try {
      const drvRidesQ = query(collection(db, 'rides'), where('driverId', '==', uid));
      const drvRidesSnap = await getDocs(drvRidesQ);
      for (const rDoc of drvRidesSnap.docs) {
        await deleteDoc(rDoc.ref).catch(() => {});
        summary.deletedRides++;
      }
    } catch {}
  }

  return summary;
};

export const deactivateUserAccount = async (uid: string) => {
  await updateDoc(doc(db, 'users', uid), {
    status: 'deactivated',
    isOnline: false
  });
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem('mowasla_cached_user');
      window.localStorage.removeItem('mowasla_is_driver_mode');
      window.localStorage.removeItem('mowasla_session_id');
    } catch {}
  }
  await signOut();
};

export const updateDriverApprovalStatus = async (uid: string, status: 'approved' | 'rejected', rejectionReason?: string) => {
  const nowTs = Date.now();
  const notifType = status === 'approved' ? 'DRIVER_APPROVED' : 'DRIVER_REJECTED';
  const eventId = `${uid}_${notifType}_${nowTs}`;

  const notifTitle = status === 'approved' 
    ? "تهانينا! تمت الموافقة على حسابك 🎉" 
    : "تحديث بخصوص طلب انضمامك ككابتن ⚠️";
  const notifBody = status === 'approved'
    ? "تمت الموافقة على مستنداتك وحسابك جاهز لاستقبال الرحلات والعمل الآن!"
    : (rejectionReason 
        ? `نعتذر، لم يتم قبول طلبك للأسباب التالية: ${rejectionReason}`
        : "نعتذر، لم يتم قبول مستندات انضمامك ككابتن. يرجى مراجعة المستندات وإعادة التقديم.");

  const updateData: any = { 
    status,
    isApproved: status === 'approved',
    driverStatus: status, // for rule compatibility
    kycStatus: status === 'approved' ? 'APPROVED' : 'REJECTED',
    driverApplicationStatusChangedAt: nowTs,
    lastApprovalNotificationId: eventId
  };

  if (status === 'approved') {
    updateData.role = UserRole.DRIVER;
    updateData.approvedAt = nowTs;
    updateData.approvalGreetingSeen = false;
    updateData.approvalNoticeShown = false;
    updateData.approvedNotice = {
      title: notifTitle,
      body: notifBody,
      timestamp: nowTs
    };
    updateData.rejectionNotice = null;
    updateData.rejectionReason = null;
    updateData.hasPendingDriverApplication = false;
  }

  if (status === 'rejected') {
    updateData.rejectedAt = nowTs;
    updateData.rejectionReason = rejectionReason || 'لم يتم استيفاء شروط التسجيل';
    updateData.rejectionNoticeShown = false;
    updateData.rejectionNotice = {
      title: notifTitle,
      body: notifBody,
      reason: rejectionReason || '',
      timestamp: nowTs
    };
    updateData.approvedNotice = null;
    updateData.hasPendingDriverApplication = false;
  }

  if (status === 'approved') {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const userData = userDoc.data();
    if (userData && !userData.hasTrialExpired && !userData.isTrialActive && !userData.trialStartDate) {
      const settingsDoc = await getDoc(doc(db, 'settings', 'app'));
      const settings = settingsDoc.exists() ? settingsDoc.data() : {};
      const trialDays = settings.driverFreeTrialDays !== undefined ? settings.driverFreeTrialDays : 30;
      
      const endTime = nowTs + (trialDays * 24 * 60 * 60 * 1000);
      
      updateData.isTrialActive = true;
      updateData.trialStartDate = nowTs;
      updateData.trialEndDate = endTime;
      updateData.hasTrialExpired = false;
      if (settings.defaultCommissionPercentage !== undefined) {
         updateData.commissionPercentage = settings.defaultCommissionPercentage;
      }
    }
  }

  // 1. Write deterministic record to user's notifications subcollection BEFORE/ALONGSIDE user update
  //    so Cloud Function triggers & callable share the exact same idempotent notification document.
  try {
    await setDoc(doc(db, 'users', uid, 'notifications', eventId), {
      type: notifType,
      title: notifTitle,
      body: notifBody,
      rejectionReason: rejectionReason || null,
      status,
      timestamp: nowTs,
      createdAt: serverTimestamp(),
      read: false,
      fcmDispatched: false
    }, { merge: true });
  } catch (notifErr) {
    console.warn("Could not write notification subcollection record:", notifErr);
  }

  // 2. Commit update to user document (fires notifyDriverOnApprovalStatusChange Cloud Function)
  await setDoc(doc(db, 'users', uid), updateData, { merge: true });

  // 3. Also invoke sendTargetedNotification with matching eventId for immediate dispatch;
  //    server-side transaction on eventId ensures only one FCM push is sent without duplicates.
  try {
    const sendTargeted = httpsCallable(functions, 'sendTargetedNotification');
    await sendTargeted({
      userId: uid,
      eventId,
      title: notifTitle,
      body: notifBody,
      data: {
        type: notifType,
        status,
        rejectionReason: rejectionReason || '',
        eventId,
        timestamp: String(nowTs),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    });
  } catch (pushErr) {
    console.warn("sendTargetedNotification client call warning (Firestore trigger will also process):", pushErr);
  }
};

export const banDevice = async (deviceId: string) => {
  await setDoc(doc(db, 'blacklisted_devices', deviceId), { bannedAt: serverTimestamp() });
};

export const toggleFavoriteDriver = async (userId: string, driverId: string) => {
  const userRef = doc(db, 'users', userId);
  await runTransaction(db, async (t) => {
    const userDoc = await t.get(userRef);
    if (!userDoc.exists()) return;
    const favs = userDoc.data().favoriteDrivers || [];
    if (favs.includes(driverId)) {
      t.update(userRef, { favoriteDrivers: favs.filter((id: string) => id !== driverId) });
    } else {
      t.update(userRef, { favoriteDrivers: [...favs, driverId] });
    }
  });
};

export const addSafetyContact = async (userId: string, contact: any) => {
  await updateDoc(doc(db, 'users', userId), {
    safetyContacts: arrayUnion(contact)
  });
};

export const removeSafetyContact = async (userId: string, contact: any) => {
  await updateDoc(doc(db, 'users', userId), {
    safetyContacts: arrayRemove(contact)
  });
};

export const addSavedCard = async (userId: string, card: any) => {
  await updateDoc(doc(db, 'users', userId), {
    savedCards: arrayUnion(card)
  });
};

export const removeSavedCard = async (userId: string, card: any) => {
  await updateDoc(doc(db, 'users', userId), {
    savedCards: arrayRemove(card)
  });
};

// --- RIDES ---

export const subscribeToOnlineDrivers = (callback: (drivers: Driver[]) => void) => {
  const q = query(
    collection(db, 'users'), 
    where('role', '==', UserRole.DRIVER),
    where('isOnline', '==', true)
  );
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Driver))
      .filter(d => d.isOnline === true && d.status !== 'rejected' && (d as any).driverStatus !== 'rejected');
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'users', true);
  });
};

export interface PhoneValidationResult {
  valid: boolean;
  isValid: boolean;
  normalized: string;
  normalizedPhone: string;
  display: string;
  e164?: string;
  errorAr?: string;
  errorEn?: string;
}

export const sanitizeEgyptianPhoneInput = (raw: string): string => {
  const westernized = (raw || '').replace(/[٠-٩]/g, (d) =>
    String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  );
  let digits = westernized.replace(/\D/g, '');
  if (digits.startsWith('0020') && digits.length >= 14) {
    digits = '0' + digits.slice(4);
  } else if (digits.startsWith('201') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  } else if (/^1[0125]\d{8}$/.test(digits)) {
    digits = '0' + digits;
  }
  return digits.slice(0, 11);
};

export const validateAndNormalizePassengerPhone = (
  rawPhone: string,
  _defaultCountryCode: string = ''
): PhoneValidationResult => {
  const trimmed = (rawPhone || '').trim();
  if (!trimmed) {
    return {
      valid: false,
      isValid: false,
      normalized: '',
      normalizedPhone: '',
      display: '',
      errorAr: 'يرجى إدخال رقم موبايل الراكب (11 رقم مثل 01024419931)',
      errorEn: 'Please enter the 11-digit passenger mobile number (e.g. 01024419931)',
    };
  }

  const local11 = sanitizeEgyptianPhoneInput(trimmed);

  // Valid Egyptian 11-digit mobile number: starts with 010, 011, 012, or 015 followed by 8 digits
  if (/^01[0125]\d{8}$/.test(local11)) {
    return {
      valid: true,
      isValid: true,
      normalized: local11,
      normalizedPhone: local11,
      display: local11,
      e164: `+2${local11}`,
    };
  }

  return {
    valid: false,
    isValid: false,
    normalized: '',
    normalizedPhone: '',
    display: local11 || trimmed,
    errorAr: 'يرجى إدخال رقم موبايل مصري صحيح مكون من 11 رقم يبدأ بـ 010 أو 011 أو 012 أو 015 (مثال: 01024419931)',
    errorEn: 'Please enter a valid 11-digit Egyptian mobile number starting with 010, 011, 012, or 015 (e.g. 01024419931)',
  };
};


export const generateSecureTrackingToken = (): string => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let token = '';
  for (let i = 0; i < bytes.length; i++) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;
};

export const generateRideVerificationPin = (): string => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return String(1000 + (arr[0] % 9000));
  }
  return String(Math.floor(1000 + Math.random() * 9000));
};

export const hashVerificationCode = async (salt: string, pin: string): Promise<string> => {
  const input = `mowasla_pin_v1:${(salt || '').trim()}:${(pin || '').trim()}`;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoded = new TextEncoder().encode(input);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Deterministic fallback hash if WebCrypto subtle is unavailable in non-HTTPS test context
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0, ch; i < input.length; i++) {
    ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};

export const saveRideVerificationPinLocally = (rideId: string, pin: string) => {
  if (!rideId || !pin) return;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(`mowasla_ride_pin_${rideId}`, pin);
    }
  } catch {}
};

export const getStoredRideVerificationPin = (rideId?: string | null): string | null => {
  if (!rideId) return null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(`mowasla_ride_pin_${rideId}`);
    }
  } catch {}
  return null;
};

export interface SavedOtherPassengerContact {
  id: string;
  name: string;
  phone: string;
  note?: string;
  lastBookedAt: number;
}

export const getSavedOtherPassengers = (userId: string): SavedOtherPassengerContact[] => {
  if (!userId) return [];
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(`mowasla_other_passengers_${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {}
  return [];
};

export const saveOtherPassengerContactLocally = (
  userId: string,
  contact: { name: string; phone: string; note?: string | null }
) => {
  if (!userId || !contact.name || !contact.phone) return;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = getSavedOtherPassengers(userId);
      const filtered = existing.filter((c) => c.phone !== contact.phone);
      const updated: SavedOtherPassengerContact[] = [
        {
          id: `other_${Date.now()}`,
          name: contact.name.trim(),
          phone: contact.phone.trim(),
          note: contact.note ? contact.note.trim() : undefined,
          lastBookedAt: Date.now(),
        },
        ...filtered,
      ].slice(0, 10);
      window.localStorage.setItem(`mowasla_other_passengers_${userId}`, JSON.stringify(updated));
    }
  } catch {}
};

export const createRideRequest = async (
  rideData: Partial<Ride> & { rawVerificationPin?: string }
) => {
  const path = 'rides';
  try {
    const stableUser = auth.currentUser || (await waitForStableAuth(1500));
    const verifiedOwnerUid = stableUser?.uid || rideData.passengerId;
    if (!verifiedOwnerUid) {
      throw new Error('Authentication required to create a ride booking');
    }

    // Fetch owner profile if needed to ensure accurate bookedBy metadata
    let ownerName = (rideData.bookedBy?.name || rideData.passengerName || stableUser?.displayName || '').trim();
    let ownerPhone = (rideData.bookedBy?.phone || stableUser?.phoneNumber || '').trim();
    if (!ownerName || !ownerPhone) {
      try {
        const ownerSnap = await getDoc(doc(db, 'users', verifiedOwnerUid));
        if (ownerSnap.exists()) {
          const oData = ownerSnap.data();
          if (!ownerName) ownerName = (oData.name || 'Passenger').trim();
          if (!ownerPhone) ownerPhone = (oData.phone || '').trim();
        }
      } catch {}
    }

    const bookingType: 'SELF' | 'FOR_OTHER' =
      rideData.bookingType === 'FOR_OTHER' ? 'FOR_OTHER' : 'SELF';

    const bookedBy = {
      userId: verifiedOwnerUid,
      name: ownerName || 'Passenger',
      phone: ownerPhone || '',
    };

    let actualPassenger: Ride['actualPassenger'] = null;
    if (bookingType === 'FOR_OTHER') {
      const rawPaxName = (rideData.actualPassenger?.name || '').trim();
      const rawPaxPhone = (rideData.actualPassenger?.phone || '').trim();
      const rawPaxNote = rideData.actualPassenger?.note
        ? String(rideData.actualPassenger.note).trim().slice(0, 300)
        : null;

      if (rawPaxName.length < 2) {
        throw new Error('INVALID_ACTUAL_PASSENGER_NAME');
      }
      const phoneCheck = validateAndNormalizePassengerPhone(rawPaxPhone);
      if (!phoneCheck.valid) {
        throw new Error('INVALID_ACTUAL_PASSENGER_PHONE');
      }

      // Check if the actual passenger has an existing Mowasla account by phone
      let matchedUserId: string | null = rideData.actualPassenger?.userId || null;
      if (!matchedUserId) {
        try {
          const candidatePhones = Array.from(
            new Set([phoneCheck.normalized, phoneCheck.display, rawPaxPhone].filter(Boolean))
          );
          for (const candidate of candidatePhones) {
            const uQuery = query(
              collection(db, 'users'),
              where('phone', '==', candidate),
              limit(1)
            );
            const uSnap = await getDocs(uQuery);
            if (!uSnap.empty) {
              matchedUserId = uSnap.docs[0].id;
              break;
            }
          }
        } catch {}
      }

      actualPassenger = {
        name: rawPaxName,
        phone: phoneCheck.normalized,
        note: rawPaxNote || null,
        userId: matchedUserId || null,
      };

      saveOtherPassengerContactLocally(verifiedOwnerUid, {
        name: actualPassenger.name,
        phone: phoneCheck.display || actualPassenger.phone,
        note: actualPassenger.note,
      });
    }

    const trackingToken = rideData.trackingToken || generateSecureTrackingToken();
    const baseExpiryRef =
      rideData.scheduledTime && rideData.scheduledTime > Date.now()
        ? rideData.scheduledTime
        : Date.now();
    const trackingTokenExpiresAt =
      rideData.trackingTokenExpiresAt || baseExpiryRef + 12 * 60 * 60 * 1000; // 12 hours max

    const rideVerificationEnabled = Boolean(
      bookingType === 'FOR_OTHER' && rideData.rideVerificationEnabled
    );
    let verificationCodeHash: string | null = null;
    let verificationExpiresAt: number | null = null;
    let plainPin: string | null = null;

    if (rideVerificationEnabled) {
      plainPin =
        rideData.rawVerificationPin && /^\d{4}$/.test(rideData.rawVerificationPin)
          ? rideData.rawVerificationPin
          : generateRideVerificationPin();
      verificationCodeHash = await hashVerificationCode(trackingToken, plainPin);
      verificationExpiresAt = baseExpiryRef + 6 * 60 * 60 * 1000;
    }

    let pointsDeductedUpfront = false;
    const pointsToRedeem = Number(rideData.pointsRedeemed || 50);

    if (rideData.promoApplied && verifiedOwnerUid && pointsToRedeem > 0) {
      try {
        const passengerRef = doc(db, 'users', verifiedOwnerUid);
        await runTransaction(db, async (t) => {
          const paxSnap = await t.get(passengerRef);
          if (!paxSnap.exists()) return;
          const currentPts = Number(paxSnap.data()?.rewardPoints || 0);
          if (currentPts >= pointsToRedeem) {
            t.update(passengerRef, {
              rewardPoints: Math.max(0, currentPts - pointsToRedeem),
            });
            pointsDeductedUpfront = true;
          }
        });
      } catch (err) {
        console.warn('Could not deduct reward points upfront, will process on completion:', err);
      }
    }

    const sanitizedPayload: Record<string, any> = { ...rideData };
    delete sanitizedPayload.rawVerificationPin;

    const scheduledTimestamp = Number(
      rideData.scheduledPickupAt || rideData.scheduledTime || 0
    );
    const isScheduledBooking = Boolean(
      rideData.isScheduled ||
        rideData.status === RideStatus.SCHEDULED ||
        scheduledTimestamp > 0
    );

    const scheduledExtraFields: Record<string, any> = isScheduledBooking
      ? {
          isScheduled: true,
          scheduledTime: scheduledTimestamp,
          scheduledPickupAt: scheduledTimestamp,
          scheduleStatus: rideData.scheduleStatus || 'SCHEDULED',
          bookingTimezone: rideData.bookingTimezone || 'Africa/Cairo',
          estimatedFare: rideData.estimatedFare ?? rideData.fare ?? 0,
          fareLocked: Boolean(rideData.fareLocked),
          lockedFare: rideData.lockedFare ?? null,
          passengerCount: rideData.passengerCount || 1,
          driverNote: rideData.driverNote || null,
          dispatchStartedAt: rideData.dispatchStartedAt ?? null,
          driverAssignedAt: rideData.driverAssignedAt ?? null,
          assignmentType: rideData.assignmentType ?? null,
          recurringScheduleId: rideData.recurringScheduleId ?? null,
          occurrenceKey: rideData.occurrenceKey ?? null,
          passengerReminderSentAt: null,
          driverReminderSentAt: null,
          previousDriverIds: [],
        }
      : {};

    const docRef = await addDoc(collection(db, path), {
      ...sanitizedPayload,
      ...scheduledExtraFields,
      passengerId: verifiedOwnerUid,
      passengerName:
        bookingType === 'FOR_OTHER' && actualPassenger
          ? actualPassenger.name
          : bookedBy.name,
      bookingType,
      bookedBy,
      actualPassenger: bookingType === 'FOR_OTHER' ? actualPassenger : null,
      trackingToken,
      trackingTokenExpiresAt,
      rideVerificationEnabled,
      verificationCodeHash,
      verificationExpiresAt,
      verificationAttempts: 0,
      verificationVerified: false,
      verificationVerifiedAt: null,
      ...(rideData.promoApplied
        ? {
            pointsRedeemed: pointsToRedeem,
            pointsDeductedUpfront,
            pointsRefunded: false,
          }
        : {}),
      rewardsProcessed: false,
      createdAt: serverTimestamp(),
      timestamp: Date.now(),
      lastActiveAt: Date.now(),
    });

    if (plainPin) {
      saveRideVerificationPinLocally(docRef.id, plainPin);
    }

    if (isScheduledBooking) {
      import('./scheduledRidesService')
        .then(({ notifyEligibleDriversForEarlyAcceptance, logDispatchEvent }) => {
          logDispatchEvent({
            rideId: docRef.id,
            recurringScheduleId: rideData.recurringScheduleId || null,
            eventType: 'SCHEDULED_CREATED',
            actorId: verifiedOwnerUid,
            actorRole: 'PASSENGER',
            message: `Scheduled ride created via createRideRequest for timestamp ${scheduledTimestamp}`,
          }).catch(() => {});
          notifyEligibleDriversForEarlyAcceptance(docRef.id, {
            ...(sanitizedPayload as Ride),
            ...scheduledExtraFields,
            id: docRef.id,
            passengerId: verifiedOwnerUid,
          }).catch(() => {});
        })
        .catch(() => {});
    }

    // Record in-app notification for booking owner on ride creation
    try {
      await addDoc(collection(db, 'users', verifiedOwnerUid, 'notifications'), {
        type: 'RIDE_CREATED',
        rideId: docRef.id,
        bookingType,
        title:
          bookingType === 'FOR_OTHER' && actualPassenger
            ? `تم إنشاء حجز لـ ${actualPassenger.name} 🚕`
            : 'تم استلام طلب رحلتك 🚕',
        body:
          bookingType === 'FOR_OTHER' && actualPassenger
            ? `جاري البحث عن كابتن لرحلة ${actualPassenger.name} من ${rideData.pickup?.address || ''}.`
            : `جاري البحث عن أقرب كابتن لرحلتك.`,
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch {}

    return docRef.id;
  } catch (error: any) {
    if (
      error?.message === 'INVALID_ACTUAL_PASSENGER_NAME' ||
      error?.message === 'INVALID_ACTUAL_PASSENGER_PHONE'
    ) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
    return '';
  }
};

export const verifyRideStartCode = async (
  rideId: string,
  inputCode: string
): Promise<{
  success: boolean;
  reason?: 'INVALID_CODE' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'NOT_FOUND';
  attemptsLeft?: number;
}> => {
  if (!rideId) return { success: false, reason: 'NOT_FOUND' };
  const cleanCode = (inputCode || '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (!/^\d{4}$/.test(cleanCode)) {
    return { success: false, reason: 'INVALID_CODE' };
  }

  const rideRef = doc(db, 'rides', rideId);
  return await runTransaction(db, async (t) => {
    const snap = await t.get(rideRef);
    if (!snap.exists()) {
      return { success: false, reason: 'NOT_FOUND' as const };
    }
    const rData = snap.data() as Ride;
    if (!rData.rideVerificationEnabled || rData.verificationVerified) {
      return { success: true };
    }

    const now = Date.now();
    if (rData.verificationExpiresAt && now > rData.verificationExpiresAt) {
      return { success: false, reason: 'EXPIRED' as const, attemptsLeft: 0 };
    }

    const currentAttempts = Number(rData.verificationAttempts || 0);
    const MAX_ATTEMPTS = 5;
    if (currentAttempts >= MAX_ATTEMPTS) {
      return { success: false, reason: 'TOO_MANY_ATTEMPTS' as const, attemptsLeft: 0 };
    }

    const computedHash = await hashVerificationCode(rData.trackingToken || '', cleanCode);
    if (rData.verificationCodeHash && computedHash === rData.verificationCodeHash) {
      t.update(rideRef, {
        verificationVerified: true,
        verificationVerifiedAt: now,
        verificationCodeHash: null, // Prevent code reuse
      });
      return { success: true };
    }

    const nextAttempts = currentAttempts + 1;
    t.update(rideRef, {
      verificationAttempts: nextAttempts,
    });
    return {
      success: false,
      reason: nextAttempts >= MAX_ATTEMPTS ? ('TOO_MANY_ATTEMPTS' as const) : ('INVALID_CODE' as const),
      attemptsLeft: Math.max(0, MAX_ATTEMPTS - nextAttempts),
    };
  });
};

export const subscribeToRide = (rideId: string, callback: (ride: Ride | null) => void) => {
  const path = `rides/${rideId}`;
  return onSnapshot(doc(db, 'rides', rideId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Ride) : null);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path, true);
  });
};

export const subscribeToPublicTrackedRide = (
  rideIdOrToken: string,
  tokenParam: string | null,
  callback: (result: {
    ride: Ride | null;
    expired: boolean;
    invalidToken: boolean;
  }) => void
) => {
  const cleanParam = (rideIdOrToken || '').trim();
  if (!cleanParam) {
    callback({ ride: null, expired: false, invalidToken: true });
    return () => {};
  }

  // First subscribe directly by doc ID; if not found, query by trackingToken
  let tokenUnsub: (() => void) | null = null;
  const docUnsub = onSnapshot(
    doc(db, 'rides', cleanParam),
    async (snap) => {
      if (snap.exists()) {
        const rawRide = { id: snap.id, ...snap.data() } as Ride;
        // If ride has a trackingToken and tokenParam was supplied, verify it matches
        if (tokenParam && rawRide.trackingToken && rawRide.trackingToken !== tokenParam) {
          callback({ ride: null, expired: false, invalidToken: true });
          return;
        }
        const isTerminal =
          rawRide.status === RideStatus.COMPLETED ||
          rawRide.status === RideStatus.CANCELLED ||
          rawRide.status === RideStatus.EXPIRED;
        const isTimeExpired = Boolean(
          rawRide.trackingTokenExpiresAt && Date.now() > rawRide.trackingTokenExpiresAt
        );
        // Sanitize ride for public viewer: never expose verification hash or live driver coords after completion
        const sanitizedRide: Ride = {
          ...rawRide,
          verificationCodeHash: null,
          driverLocation: isTerminal || isTimeExpired ? undefined : rawRide.driverLocation,
        };
        callback({
          ride: sanitizedRide,
          expired: isTimeExpired,
          invalidToken: false,
        });
      } else if (!tokenUnsub) {
        // Fallback: query by trackingToken == cleanParam
        const q = query(
          collection(db, 'rides'),
          where('trackingToken', '==', cleanParam),
          limit(1)
        );
        tokenUnsub = onSnapshot(
          q,
          (qSnap) => {
            if (qSnap.empty) {
              callback({ ride: null, expired: false, invalidToken: true });
              return;
            }
            const docSnap = qSnap.docs[0];
            const rawRide = { id: docSnap.id, ...docSnap.data() } as Ride;
            const isTerminal =
              rawRide.status === RideStatus.COMPLETED ||
              rawRide.status === RideStatus.CANCELLED ||
              rawRide.status === RideStatus.EXPIRED;
            const isTimeExpired = Boolean(
              rawRide.trackingTokenExpiresAt && Date.now() > rawRide.trackingTokenExpiresAt
            );
            const sanitizedRide: Ride = {
              ...rawRide,
              verificationCodeHash: null,
              driverLocation: isTerminal || isTimeExpired ? undefined : rawRide.driverLocation,
            };
            callback({
              ride: sanitizedRide,
              expired: isTimeExpired,
              invalidToken: false,
            });
          },
          () => {
            callback({ ride: null, expired: false, invalidToken: true });
          }
        );
      }
    },
    () => {
      callback({ ride: null, expired: false, invalidToken: true });
    }
  );

  return () => {
    docUnsub();
    if (tokenUnsub) tokenUnsub();
  };
};

export const updateRideStatus = async (rideId: string, status: RideStatus, extraData: any = {}) => {
  const path = `rides/${rideId}`;
  try {
    const rideRef = doc(db, 'rides', rideId);
    if (status === RideStatus.CANCELLED || status === RideStatus.EXPIRED) {
      await runTransaction(db, async (t) => {
        const rideSnap = await t.get(rideRef);
        if (!rideSnap.exists()) return;
        const rData = rideSnap.data() as Ride;
        const ownerId = rData.bookedBy?.userId || rData.passengerId;
        const shouldRefund =
          rData.promoApplied &&
          rData.pointsDeductedUpfront &&
          !rData.pointsRefunded &&
          !rData.rewardsProcessed &&
          ownerId;
        if (shouldRefund) {
          const paxRef = doc(db, 'users', ownerId);
          const paxSnap = await t.get(paxRef);
          if (paxSnap.exists()) {
            const currentPts = Number(paxSnap.data()?.rewardPoints || 0);
            const refundPts = Number(rData.pointsRedeemed || 50);
            t.update(paxRef, { rewardPoints: currentPts + refundPts });
          }
        }
        t.update(rideRef, {
          ...extraData,
          status,
          ...(shouldRefund ? { pointsRefunded: true } : {}),
          trackingTokenExpiresAt: Date.now(), // Expire live tracking immediately upon cancellation
          driverLocation: deleteField(),
          lastActiveAt: Date.now()
        });
      });
      return;
    }
    await updateDoc(rideRef, { ...extraData, status, lastActiveAt: Date.now() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const driverCancelAndReassignRide = async (rideId: string, driverId: string) => {
  const path = `rides/${rideId}`;
  try {
    const rideRef = doc(db, 'rides', rideId);
    await updateDoc(rideRef, {
      status: RideStatus.SEARCHING,
      driverId: deleteField(),
      driverPhone: deleteField(),
      vehicleDetails: deleteField(),
      driverParams: deleteField(),
      assignedAt: deleteField(),
      driverLocation: deleteField(),
      rejectedBy: arrayUnion(driverId)
    });

    const driverRef = doc(db, 'users', driverId);
    const dSnap = await getDoc(driverRef);
    if (dSnap.exists()) {
      const cancellations = (dSnap.data().cancellations || 0) + 1;
      await updateDoc(driverRef, { cancellations });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateRideDriverLocation = async (rideId: string, location: any, heading?: number | null) => {
  const data: any = { driverLocation: location, lastActiveAt: Date.now() };
  if (heading !== undefined && heading !== null && !isNaN(heading)) data.driverHeading = heading;
  await updateDoc(doc(db, 'rides', rideId), data);
};

export const updateRideFare = async (rideId: string, fare: number) => {
  await updateDoc(doc(db, 'rides', rideId), {
    fare,
    price: fare,
    priceBoosted: true,
    lastPriceUpdate: Date.now(),
    priceChanged: true,
    timestamp: Date.now(),
    rejectedBy: [],
    offeringDriverIds: [],
    notifiedDriverIds: []
  });
};

export const initiateInstapayPayment = async (rideId: string, reference: string = '') => {
  const path = `rides/${rideId}`;
  try {
    await updateDoc(doc(db, 'rides', rideId), {
      paymentStatus: PaymentStatus.AWAITING_CONFIRMATION,
      paymentReference: reference,
      paymentMethod: PaymentMethod.INSTAPAY
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const confirmInstapayPayment = async (rideId: string, driverId: string) => {
  const path = `rides/${rideId}`;
  try {
    const rideRef = doc(db, 'rides', rideId);
    const rideSnap = await getDoc(rideRef);
    if (!rideSnap.exists()) return;
    const ride = rideSnap.id ? { id: rideSnap.id, ...rideSnap.data() } as Ride : null;
    if (!ride) return;

    await completeRide(ride.id, ride.fare, driverId, ride.passengerId, PaymentMethod.INSTAPAY);
    await updateDoc(rideRef, {
      paymentStatus: PaymentStatus.PAID,
      paymentConfirmedAt: serverTimestamp(),
      paymentConfirmedBy: driverId
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const completeRide = async (rideId: string, fare: number, driverId: string, passengerId: string, _paymentMethod: PaymentMethod) => {
  const path = `rides/${rideId} (Transaction)`;
  try {
    await runTransaction(db, async (t) => {
      const rideRef = doc(db, 'rides', rideId);
      const driverRef = doc(db, 'users', driverId);
      const passengerRef = doc(db, 'users', passengerId);
      const settingsRef = doc(db, 'settings', 'app');

      // 1. ALL READS FIRST
      const [settingsSnap, rideSnap, driverSnap, passengerSnap] = await Promise.all([
        t.get(settingsRef),
        t.get(rideRef),
        t.get(driverRef),
        t.get(passengerRef),
      ]);
      const settingsData = settingsSnap.exists() ? settingsSnap.data() : null;
      const rideData = rideSnap.exists() ? (rideSnap.data() as Ride) : null;
      const driverData = driverSnap.data();
      
      // 2. CALCULATIONS
      let commRate = DEFAULT_COMMISSION_RATE;
      if (driverData) {
        if (driverData.isTrialActive && driverData.trialEndDate && driverData.trialEndDate > Date.now()) {
          commRate = 0;
        } else if (driverData.commissionPercentage !== undefined) {
          commRate = driverData.commissionPercentage / 100;
        }
      }
      const comm = fare * commRate;
      const net = fare - comm;

      const isRewardsEnabled = settingsData ? settingsData.isRewardsEnabled !== false : true;
      const pointsPerTrip = Number(settingsData?.rewardPointsPerTrip ?? 5);
      const thresholdPoints = Number(settingsData?.rewardThresholdPoints ?? 50);
      const alreadyProcessed = Boolean(rideData?.rewardsProcessed);
      const earnedPts = isRewardsEnabled && pointsPerTrip > 0 ? pointsPerTrip : 0;

      // 3. ALL WRITES LAST
      t.update(rideRef, { 
        status: RideStatus.COMPLETED, 
        driverNet: net, 
        commission: comm,
        rewardsProcessed: true,
        pointsEarned: alreadyProcessed ? (rideData?.pointsEarned ?? earnedPts) : earnedPts,
        completedAt: serverTimestamp() 
      });
      
      t.update(driverRef, { 
        earnings: increment(net), 
        totalRides: increment(1),
        walletBalance: increment(net),
        pendingFees: increment(comm)
      });

      if (passengerSnap.exists() && !alreadyProcessed) {
        const paxData = passengerSnap.data();
        let nextPoints = Number(paxData?.rewardPoints || 0);
        if (rideData?.promoApplied && !rideData?.pointsDeductedUpfront) {
          const redeemCount = Number(rideData?.pointsRedeemed || thresholdPoints);
          nextPoints = Math.max(0, nextPoints - redeemCount);
        }
        if (earnedPts > 0) {
          nextPoints += earnedPts;
        }
        t.update(passengerRef, {
          rewardPoints: Math.max(0, nextPoints),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const ensureRideRewardsProcessed = async (rideId: string, passengerId: string) => {
  if (!rideId || !passengerId) return;
  try {
    await runTransaction(db, async (t) => {
      const rideRef = doc(db, 'rides', rideId);
      const passengerRef = doc(db, 'users', passengerId);
      const settingsRef = doc(db, 'settings', 'app');

      const [rideSnap, paxSnap, settingsSnap] = await Promise.all([
        t.get(rideRef),
        t.get(passengerRef),
        t.get(settingsRef),
      ]);

      if (!rideSnap.exists() || !paxSnap.exists()) return;
      const rideData = rideSnap.data() as Ride;
      if (rideData.status !== RideStatus.COMPLETED || rideData.rewardsProcessed) return;

      const settingsData = settingsSnap.exists() ? settingsSnap.data() : null;
      const isRewardsEnabled = settingsData ? settingsData.isRewardsEnabled !== false : true;
      const pointsPerTrip = Number(settingsData?.rewardPointsPerTrip ?? 5);
      const thresholdPoints = Number(settingsData?.rewardThresholdPoints ?? 50);
      const earnedPts = isRewardsEnabled && pointsPerTrip > 0 ? pointsPerTrip : 0;

      let nextPoints = Number(paxSnap.data()?.rewardPoints || 0);
      if (rideData.promoApplied && !rideData.pointsDeductedUpfront) {
        const redeemCount = Number(rideData.pointsRedeemed || thresholdPoints);
        nextPoints = Math.max(0, nextPoints - redeemCount);
      }
      if (earnedPts > 0) {
        nextPoints += earnedPts;
      }

      t.update(passengerRef, { rewardPoints: Math.max(0, nextPoints) });
      t.update(rideRef, {
        rewardsProcessed: true,
        pointsEarned: earnedPts,
      });
    });
  } catch (err) {
    console.warn('Failed to ensure ride rewards processed:', err);
  }
};

export const checkActiveRide = async (userId: string, role: UserRole) => {
  if (!userId || !auth.currentUser) return null;
  const path = 'rides (Query active)';
  try {
    const activeStatuses = role === UserRole.PASSENGER 
      ? [RideStatus.SEARCHING, RideStatus.OFFER_RECEIVED, RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS]
      : [RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS];

    const q = query(
      collection(db, 'rides'),
      where(role === UserRole.PASSENGER ? 'passengerId' : 'driverId', '==', userId),
      where('status', 'in', activeStatuses)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, ...snap.docs[0].data() } as Ride;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const requestRideCancellation = async (rideId: string) => {
  await updateDoc(doc(db, 'rides', rideId), {
    'cancellationRequest.status': 'pending',
    'cancellationRequest.requestedAt': Date.now()
  });
};

export const resolveCancellationRequest = async (rideId: string, resolution: 'approved' | 'rejected') => {
  if (resolution === 'approved') {
    await updateRideStatus(rideId, RideStatus.CANCELLED);
  }
  await updateDoc(doc(db, 'rides', rideId), {
    'cancellationRequest.status': resolution
  });
};

export const triggerSOS = async (rideId: string, location: any, role: string) => {
  const trigger = httpsCallable(functions, 'triggerSOS');
  await trigger({ rideId, location, userRole: role });
};

export const getUserRides = async (userId: string, role: UserRole | string) => {
  const isPassenger = String(role).toUpperCase() === 'PASSENGER';
  const q = query(
    collection(db, 'rides'),
    where(isPassenger ? 'passengerId' : 'driverId', '==', userId),
    orderBy('timestamp', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Ride))
    .filter(r => isPassenger ? !r.deletedByPassenger : !r.deletedByDriver);
};

export const subscribeToAllRides = (callback: (rides: Ride[]) => void) => {
  const q = query(collection(db, 'rides'), orderBy('timestamp', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ride)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'rides', true);
  });
};

export const deleteRide = async (rideId: string) => {
  await deleteDoc(doc(db, 'rides', rideId));
};

export const hideRideFromHistory = async (rideId: string, role: UserRole | string) => {
  const isPassenger = String(role).toUpperCase() === 'PASSENGER';
  const field = isPassenger ? 'deletedByPassenger' : 'deletedByDriver';
  await updateDoc(doc(db, 'rides', rideId), { [field]: true });
};

export const acceptRideRequest = async (rideId: string, driverId: string, finalFare?: number) => {
  const driver = await getUserProfile(driverId);
  const rideSnap = await getDoc(doc(db, 'rides', rideId));
  
  if (!driver) throw new Error("Driver not found");
  if (!rideSnap.exists()) throw new Error("Ride not found");
  
  const ride = rideSnap.data() as Ride;

  const updateData: any = {
    driverId: driverId,
    status: RideStatus.ACCEPTED,
    driverLocation: (driver as Driver).currentLocation || null,
    driverHeading: 0,
    acceptedAt: Date.now()
  };

  const actualFare = finalFare !== undefined && finalFare !== null ? finalFare : ride.fare;
  if (actualFare) {
      updateData.fare = actualFare;
  }

  await updateDoc(doc(db, 'rides', rideId), updateData);

  // Send the system welcome message with trip details
  const pickupStr = ride.pickup?.address || 'الموقع الحالي';
  const dropoffStr = ride.dropoff?.address ? ` إلى ${ride.dropoff.address}` : '';
  const isForOther = ride.bookingType === 'FOR_OTHER' && ride.actualPassenger?.name;
  const paxNoteSuffix = isForOther && ride.actualPassenger?.note ? ` (ملاحظة الراكب: ${ride.actualPassenger.note})` : '';
  let msgText = '';
  
  if (isForOther) {
      msgText = `مرحباً! معك كابتن ${driver.name.split(' ')[0]}. تم قبول الرحلة المحجوزة للراكب (${ride.actualPassenger?.name}). تفاصيل الرحلة: من ${pickupStr}${dropoffStr}. الأجرة المتفق عليها هي ${actualFare} ج.م.${paxNoteSuffix} أنا في طريقي لنقطة الاستلام!`;
  } else if (finalFare !== undefined && finalFare !== null) {
      msgText = `مرحباً! معك كابتن ${driver.name.split(' ')[0]}. تم قبول العرض. تفاصيل الرحلة: من ${pickupStr}${dropoffStr}. الأجرة المتفق عليها هي ${actualFare} ج.م. أراك قريباً!`;
  } else {
      msgText = `مرحباً! معك كابتن ${driver.name.split(' ')[0]}. أنا في طريقي إليك. تفاصيل الرحلة: من ${pickupStr}${dropoffStr}.${actualFare ? ` الأجرة هي ${actualFare} ج.م.` : ''} أراك قريباً!`;
  }

  await addDoc(collection(db, 'rides', rideId, 'messages'), {
    rideId,
    senderId: 'system',
    text: msgText,
    isSystem: true,
    timestamp: serverTimestamp()
  });

  await updateDoc(doc(db, 'rides', rideId), {
    lastMessage: msgText,
    lastMessageAt: serverTimestamp(),
    hasMessages: true
  });

  // Notify actual passenger if they have a registered Mowasla account different from booking owner
  if (
    isForOther &&
    ride.actualPassenger?.userId &&
    ride.actualPassenger.userId !== ride.passengerId
  ) {
    try {
      const notifTitle = 'تم حجز رحلة لك عبر مواصلة 🚗';
      const notifBody = `قام ${ride.bookedBy?.name || 'صديقك'} بحجز رحلة لك. الكابتن ${driver.name} (${(driver as Driver).vehicleBrand || ''} ${(driver as Driver).vehicleModel || ''} - ${(driver as Driver).vehiclePlate || ''}) في طريقه لنقطة الاستلام.`;
      await addDoc(collection(db, 'users', ride.actualPassenger.userId, 'notifications'), {
        type: 'RIDE_ASSIGNED_FOR_YOU',
        rideId,
        title: notifTitle,
        body: notifBody,
        timestamp: Date.now(),
        createdAt: serverTimestamp(),
        read: false,
      });
      const sendTargeted = httpsCallable(functions, 'sendTargetedNotification');
      await sendTargeted({
        userId: ride.actualPassenger.userId,
        title: notifTitle,
        body: notifBody,
        data: {
          type: 'RIDE_STATUS_UPDATE',
          rideId,
          status: RideStatus.ACCEPTED,
          bookingType: 'FOR_OTHER',
        },
      }).catch(() => {});
    } catch {}
  }

  // Increment driver acceptances metric
  const driverRef = doc(db, 'users', driverId);
  const dSnap = await getDoc(driverRef);
  if (dSnap.exists()) {
    const acceptances = (dSnap.data().acceptances || 0) + 1;
    await updateDoc(driverRef, { acceptances });
  }
};

export const rejectRideRequestByDriver = async (rideId: string, driverId: string) => {
  await updateDoc(doc(db, 'rides', rideId), {
    rejectedBy: arrayUnion(driverId)
  });
};

export const subscribeToDriverRequests = (driver: Driver, callback: (rides: Ride[]) => void) => {
  const q = query(
      collection(db, 'rides'), 
      where('status', 'in', [RideStatus.SEARCHING, RideStatus.OFFER_RECEIVED])
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ride)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'rides', true);
  });
};

export const subscribeToScheduledRides = (callback: (rides: Ride[]) => void) => {
  const q = query(
      collection(db, 'rides'), 
      where('status', '==', RideStatus.SCHEDULED)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ride)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'rides', true);
  });
};

export const subscribeToDriverActiveOffers = (driverId: string, callback: (rides: Ride[]) => void) => {
  const q = query(
      collection(db, 'rides'), 
      where('status', '==', RideStatus.OFFER_RECEIVED),
      where('offeringDriverIds', 'array-contains', driverId)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ride)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'rides/offers', true);
  });
};



export const subscribeToHeatmapActivity = (callback: (points: Coordinates[]) => void) => {
  const q = query(
      collection(db, 'rides'), 
      where('status', 'in', [RideStatus.SEARCHING, RideStatus.OFFER_RECEIVED, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS])
  );
  return onSnapshot(q, (snap) => {
    const points: Coordinates[] = [];
    snap.docs.forEach(d => {
        const ride = d.data() as Ride;
        if (ride.pickup?.coords) {
            points.push(ride.pickup.coords);
        }
    });
    callback(points);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'rides', true);
  });
};

export const subscribeToPassengerScheduledRides = (userId: string, callback: (rides: Ride[]) => void) => {
  const q = query(collection(db, 'rides'), where('passengerId', '==', userId), where('status', '==', RideStatus.SCHEDULED));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ride)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'rides/passenger-scheduled', true);
  });
};

export const subscribeToDriverTasks = (driverId: string, callback: (rides: Ride[]) => void) => {
  const q = query(collection(db, 'rides'), where('driverId', '==', driverId), where('status', '==', RideStatus.SCHEDULED));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ride)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'rides/driver-tasks', true);
  });
};

export const subscribeToAssignedRide = (driverId: string, callback: (ride: Ride | null) => void) => {
  const q = query(
    collection(db, 'rides'), 
    where('driverId', '==', driverId), 
    where('status', 'in', [RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS])
  );
  return onSnapshot(q, (snap) => {
    if (!snap.empty) {
      callback({ id: snap.docs[0].id, ...snap.docs[0].data() } as Ride);
    } else {
      callback(null);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'rides/assigned', true);
  });
};

export const acceptScheduledRide = async (rideId: string, driverId: string) => {
  const { acceptScheduledRideAtomic } = await import('./scheduledRidesService');
  return acceptScheduledRideAtomic(rideId, driverId);
};

export const updateDriverStatus = async (uid: string, isOnline: boolean, location?: any) => {
  const data: any = { isOnline };
  if (location) data.currentLocation = location;
  await updateDoc(doc(db, 'users', uid), data);
};

export const updateUserLocation = async (uid: string, location: any) => {
  await updateDoc(doc(db, 'users', uid), { currentLocation: location });
};

export const rateUser = async (rideId: string, targetId: string, reviewerId: string, reviewerName: string, rating: number, comment?: string | null) => {
  await addDoc(collection(db, 'reviews'), {
    rideId,
    targetUserId: targetId,
    reviewerId,
    reviewerName,
    rating,
    comment: comment || null,
    timestamp: serverTimestamp()
  });
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const calculateDynamicFareRange = async (distanceKm: number, vehicleType: string, durationMin: number, includeAirportFee: boolean = false, airportFeeValue: number = 30, surgeMultiplierArg: number = 1.0, pickupAddress?: string) => {
  let baseFare = 30;
  let pricePerKm = 7;
  let pricePerMinute = 1;
  let minFare = 25;
  let commissionPercent = 10;

  try {
    const config = await getPricingSettings();
    if (config) {
      let activeConfig: Omit<PricingConfig, 'city' | 'cities' | 'lastUpdatedAt'> = config;
      
      if (pickupAddress && config.cities) {
        // Try to match the pickup address with any defined city in the config
        const addressLower = pickupAddress.toLowerCase();
        for (const [cityName, cityConfig] of Object.entries(config.cities)) {
          if (addressLower.includes(cityName.toLowerCase())) {
            activeConfig = cityConfig;
            break;
          }
        }
      }

      baseFare = activeConfig.baseFare ?? 30;
      pricePerKm = activeConfig.pricePerKm ?? 7;
      pricePerMinute = activeConfig.pricePerMinute ?? 1;
      minFare = activeConfig.minimumFare ?? 25;
      commissionPercent = activeConfig.driverCommissionPercent ?? 10;

      // Adjust for vehicle type
      switch (vehicleType) {
        case 'MOTO':
          baseFare = Math.max(15, baseFare * 0.6);
          pricePerKm = pricePerKm * 0.6;
          pricePerMinute = pricePerMinute * 0.8;
          minFare = Math.max(15, minFare * 0.6);
          break;
        case 'COMFORT':
          baseFare = baseFare * 1.5;
          pricePerKm = pricePerKm * 1.5;
          pricePerMinute = pricePerMinute * 1.2;
          minFare = minFare * 1.5;
          break;
      }

      let total = baseFare + (distanceKm * pricePerKm) + (durationMin * pricePerMinute);

      // Airport / Area Fees
      if (includeAirportFee || (pickupAddress && pickupAddress.toLowerCase().includes('airport'))) {
         total += activeConfig.airportFee || airportFeeValue || 30;
      }
      if (pickupAddress && activeConfig.areaFees) {
          const lowerAddr = pickupAddress.toLowerCase();
          for (const [area, fee] of Object.entries(activeConfig.areaFees)) {
              if (lowerAddr.includes(area.toLowerCase())) {
                  total += fee;
              }
          }
      }

      // Night Surcharge
      if (activeConfig.nightSurchargeEnabled) {
          const hour = new Date().getHours();
          const start = activeConfig.nightSurchargeStartHour || 0;
          const end = activeConfig.nightSurchargeEndHour || 6;
          let isNight = false;
          if (start > end) {
              isNight = hour >= start || hour < end;
          } else {
              isNight = hour >= start && hour < end;
          }
          if (isNight) {
              total += activeConfig.nightSurchargeValue || 0;
          }
      }

      const surgeMultiplier = surgeMultiplierArg !== 1.0 ? surgeMultiplierArg : ((activeConfig.surgeEnabled && activeConfig.surgeMultiplier) ? activeConfig.surgeMultiplier : 1.0);
      total = total * surgeMultiplier;

      const driverNetFromTotal = total * (1 - (commissionPercent / 100));
      const MIN_DRIVER_NET = 20;
      if (driverNetFromTotal < MIN_DRIVER_NET) {
          total = MIN_DRIVER_NET / (1 - (commissionPercent / 100));
      }

      total = Math.max(minFare, total);

      return {
        min: Math.max(minFare, Math.floor(total * 0.8)),
        recommended: Math.max(minFare, Math.ceil(total)),
        max: Math.ceil(total * 1.5),
        breakdown: {
           baseFare,
           distanceFare: distanceKm * pricePerKm,
           timeFare: durationMin * pricePerMinute,
           surge: surgeMultiplier,
           total
        }
      };
    }
  } catch(e) {
    console.error("Failed to fetch dynamic pricing", e);
  }

  // Fallback
  switch (vehicleType) {
    case 'MOTO':
      baseFare = 15;
      pricePerKm = 4;
      pricePerMinute = 0.5;
      minFare = 15;
      break;
    case 'COMFORT':
      baseFare = 45;
      pricePerKm = 10;
      pricePerMinute = 1.5;
      minFare = 35;
      break;
  }

  const fallbackTotal = Math.max(minFare, baseFare + (distanceKm * pricePerKm) + (durationMin * pricePerMinute));
  return {
    min: Math.max(minFare, Math.floor(fallbackTotal * 0.8)),
    recommended: Math.ceil(fallbackTotal),
    max: Math.ceil(fallbackTotal * 1.5),
    breakdown: { baseFare, distanceFare: distanceKm * pricePerKm, timeFare: durationMin * pricePerMinute, surge: 1.0, total: fallbackTotal }
  };
};

// --- OFFERS ---

// --- DRIVER LEVELS ---
import { DriverLevel } from '../types';

export const calculateDriverLevel = async (driver: Driver) => {
  if (driver.levelOverride) return; // Don't auto-calculate if overridden
  
  let newLevel = DriverLevel.BRONZE;
  const rides = driver.totalRides || 0;
  const rating = driver.rating || 5.0;
  const cancelRate = driver.cancellationRate || 0;

  if (rides >= 500 && rating >= 4.8 && cancelRate < 0.05) {
    newLevel = DriverLevel.VIP;
  } else if (rides >= 200 && rating >= 4.7) {
    newLevel = DriverLevel.GOLD;
  } else if (rides >= 50 && rating >= 4.5) {
    newLevel = DriverLevel.SILVER;
  }

  if (newLevel !== driver.level) {
    await updateDoc(doc(db, 'users', driver.id), { level: newLevel });
  }
};

export const proposeRideOffer = async (rideId: string, driver: Driver, price: number) => {
  const offerData: Record<string, any> = {
    driverId: driver.id || '',
    driverName: driver.name || 'Captain',
    driverAvatar: driver.avatar || driver.personalPhotoUrl || null,
    driverRating: typeof driver.rating === 'number' ? driver.rating : 5.0,
    driverLevel: driver.level || null,
    driverLocation: driver.currentLocation ? {
      lat: Number(driver.currentLocation.lat),
      lng: Number(driver.currentLocation.lng)
    } : null,
    vehicleBrand: driver.vehicleBrand || '',
    vehicleModel: driver.vehicleModel || 'Standard',
    vehiclePlate: driver.vehiclePlate || '',
    vehicleColor: driver.vehicleColor || '',
    isVerified: Boolean(driver.isVerified),
    driverTrips: driver.totalRides || 0,
    price: Number(price) || 0,
    status: 'pending',
    createdAt: Date.now(),
    timestamp: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'rides', rideId, 'offers'), offerData);
  try {
    await updateDoc(doc(db, 'rides', rideId), { 
        status: RideStatus.OFFER_RECEIVED,
        offeringDriverIds: arrayUnion(driver.id),
        lastOfferAt: Date.now()
    });
  } catch (err) {
    console.warn("Could not update ride document status for offer:", err);
  }
  return docRef.id;
};

export const expireRideOfferTimeout = async (rideId: string, offerId: string, driverId: string) => {
  try {
    const offerRef = doc(db, 'rides', rideId, 'offers', offerId);
    const offerSnap = await getDoc(offerRef);
    if (offerSnap.exists() && offerSnap.data().status === 'pending') {
      await updateDoc(offerRef, { status: 'rejected' });
      const offersSnap = await getDocs(collection(db, 'rides', rideId, 'offers'));
      const hasRemainingPending = offersSnap.docs.some((d) => {
        if (d.id === offerId) return false;
        const st = d.data()?.status;
        return st === 'pending' || st === 'countered';
      });
      const rideRef = doc(db, 'rides', rideId);
      const rideSnap = await getDoc(rideRef);
      const rideUpdate: any = {
        rejectedBy: arrayUnion(driverId),
        offeringDriverIds: arrayRemove(driverId)
      };
      if (!hasRemainingPending && rideSnap.exists() && rideSnap.data()?.status === RideStatus.OFFER_RECEIVED) {
        rideUpdate.status = RideStatus.SEARCHING;
      }
      await updateDoc(rideRef, rideUpdate);
    }
  } catch(e) {
    console.error("Expire offer error:", e);
  }
};

export const acceptRideOffer = async (rideId: string, offer: OfferDetails) => {
  await updateDoc(doc(db, 'rides', rideId, 'offers', offer.id!), { status: 'accepted' });
  await acceptRideRequest(rideId, offer.driverId, offer.price);
};

export const driverAcceptsCounterOffer = async (rideId: string, offerId: string, driverId: string, finalFare: number) => {
  await updateDoc(doc(db, 'rides', rideId, 'offers', offerId), { status: 'accepted', price: finalFare });
  await acceptRideRequest(rideId, driverId, finalFare);
};

export const rejectRideOffer = async (rideId: string, offerId: string) => {
  const offerRef = doc(db, 'rides', rideId, 'offers', offerId);
  const offerSnap = await getDoc(offerRef);
  if (offerSnap.exists()) {
    const driverId = offerSnap.data().driverId;
    await updateDoc(offerRef, { status: 'rejected' });
    const rideRef = doc(db, 'rides', rideId);
    const rideUpdate: any = {};
    if (driverId) {
      rideUpdate.rejectedBy = arrayUnion(driverId);
      rideUpdate.offeringDriverIds = arrayRemove(driverId);
    }
    const offersSnap = await getDocs(collection(db, 'rides', rideId, 'offers'));
    const hasRemainingPending = offersSnap.docs.some((d) => {
      if (d.id === offerId) return false;
      const st = d.data()?.status;
      return st === 'pending' || st === 'countered';
    });
    const rideSnap = await getDoc(rideRef);
    if (!hasRemainingPending && rideSnap.exists() && rideSnap.data()?.status === RideStatus.OFFER_RECEIVED) {
      rideUpdate.status = RideStatus.SEARCHING;
    }
    if (Object.keys(rideUpdate).length > 0) {
      await updateDoc(rideRef, rideUpdate);
    }
  }
};

export const sendPassengerCounterOffer = async (rideId: string, offerId: string, price: number) => {
  await updateDoc(doc(db, 'rides', rideId, 'offers', offerId), {
    status: 'countered',
    passengerCounterPrice: price
  });
};

export const subscribeToRideOffers = (rideId: string, callback: (offers: OfferDetails[]) => void) => {
  const path = `rides/${rideId}/offers`;
  const q = collection(db, 'rides', rideId, 'offers');
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as OfferDetails));
    list.sort((a, b) => {
      const timeA = a.createdAt || (a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp ? new Date(a.timestamp).getTime() : 0));
      const timeB = b.createdAt || (b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp ? new Date(b.timestamp).getTime() : 0));
      return timeB - timeA;
    });
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path, true);
  });
};

export const subscribeToDriverRideOffer = (rideId: string, driverId: string, callback: (offer: OfferDetails | null) => void) => {
  const path = `rides/${rideId}/offers`;
  const q = query(collection(db, 'rides', rideId, 'offers'), where('driverId', '==', driverId));
  return onSnapshot(q, (snap) => {
    const activeOffers = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as OfferDetails))
      .filter(o => o.status === 'pending' || o.status === 'countered')
      .sort((a, b) => {
        const timeA = a.createdAt || (a.timestamp?.toMillis ? a.timestamp.toMillis() : 0);
        const timeB = b.createdAt || (b.timestamp?.toMillis ? b.timestamp.toMillis() : 0);
        return timeB - timeA;
      });
    callback(activeOffers.length > 0 ? activeOffers[0] : null);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path, true);
  });
};

// --- MESSAGES ---

export const sendMessage = async (rideId: string, senderId: string, text: string, isSystem = false, audioUrl?: string) => {
  await addDoc(collection(db, 'rides', rideId, 'messages'), {
    rideId,
    senderId,
    text,
    isSystem,
    audioUrl: audioUrl || null,
    timestamp: serverTimestamp()
  });
  const isAdminChat = rideId.startsWith('admin_chat_');
  const fromAdmin = senderId === 'SYSTEM_ADMIN' || senderId === 'admin' || isSystem;
  const previewText = audioUrl ? (text || '🎤 Voice Message') : text;
  await setDoc(doc(db, 'rides', rideId), {
    lastMessage: previewText,
    lastMessageAt: serverTimestamp(),
    lastSenderId: senderId,
    hasMessages: true,
    ...(isAdminChat ? {
      userId: rideId.replace('admin_chat_', ''),
      unreadByAdmin: !fromAdmin,
      adminUnreadCount: fromAdmin ? 0 : increment(1),
      ...(fromAdmin ? {} : { status: 'open' })
    } : {})
  }, { merge: true });
};

export const subscribeToRideMessages = (rideId: string, callback: (msgs: any[]) => void) => {
  const path = `rides/${rideId}/messages`;
  const q = query(collection(db, 'rides', rideId, 'messages'), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path, true);
  });
};

export const subscribeToChatHistory = (userId: string, role: UserRole, callback: (rides: Ride[]) => void) => {
  const path = 'rides/chat-history';
  const q = query(
    collection(db, 'rides'), 
    where(role === UserRole.PASSENGER ? 'passengerId' : 'driverId', '==', userId),
    where('hasMessages', '==', true),
    orderBy('lastMessageAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ride)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path, true);
  });
};

// --- SUPPORT ---

export const createSupportTicket = async (userId: string, subject: string, message: string, rideId?: string | null) => {
  const ref = await addDoc(collection(db, 'supportTickets'), {
    userId,
    subject,
    rideId: rideId || null,
    status: 'open',
    lastMessage: message,
    lastSenderId: userId,
    unreadByAdmin: true,
    adminUnreadCount: 1,
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp()
  });
  await sendSupportMessage(ref.id, message, userId, false);
  return ref.id;
};

export const sendSupportMessage = async (ticketId: string, text: string, senderId: string, isAdmin: boolean, audioUrl?: string) => {
  await addDoc(collection(db, 'supportTickets', ticketId, 'messages'), {
    text,
    senderId,
    isAdmin,
    audioUrl: audioUrl || null,
    timestamp: serverTimestamp()
  });
  const fromUser = !isAdmin && senderId !== 'support_bot' && senderId !== 'ai';
  const fromHumanAdmin = isAdmin && senderId !== 'support_bot' && senderId !== 'ai';
  const previewText = audioUrl ? (text || '🎤 Voice Message') : text;
  await setDoc(doc(db, 'supportTickets', ticketId), {
    lastMessage: previewText,
    lastMessageAt: serverTimestamp(),
    lastSenderId: senderId,
    ...(fromUser ? {
      unreadByAdmin: true,
      adminUnreadCount: increment(1),
      status: 'open'
    } : {}),
    ...(fromHumanAdmin ? {
      unreadByAdmin: false,
      adminUnreadCount: 0
    } : {})
  }, { merge: true });
};

export const markSupportConversationRead = async (type: 'ticket' | 'chat', id: string) => {
  try {
    const colName = type === 'ticket' ? 'supportTickets' : 'rides';
    await setDoc(doc(db, colName, id), {
      unreadByAdmin: false,
      adminUnreadCount: 0
    }, { merge: true });
  } catch (e) {
    console.warn('Failed to mark support conversation read:', e);
  }
};

export const updateSupportConversationStatus = async (
  type: 'ticket' | 'chat',
  id: string,
  status: 'open' | 'pending' | 'resolved' | 'closed'
) => {
  const colName = type === 'ticket' ? 'supportTickets' : 'rides';
  const isResolved = status === 'resolved' || status === 'closed';
  await setDoc(doc(db, colName, id), {
    status,
    ...(isResolved ? { unreadByAdmin: false, adminUnreadCount: 0, resolvedAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp()
  }, { merge: true });
};

export const subscribeToAllSupportTickets = (callback: (tickets: SupportTicket[]) => void) => {
  const q = query(collection(db, 'supportTickets'), orderBy('lastMessageAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const tickets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
    callback(tickets);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'supportTickets', true);
  });
};

export const subscribeToAllAdminChats = (callback: (chats: any[]) => void) => {
  const adminChatsQuery = query(
    collection(db, 'rides'),
    where('__name__', '>=', 'admin_chat_'),
    where('__name__', '<=', 'admin_chat_\uf8ff')
  );
  return onSnapshot(adminChatsQuery, (snap) => {
    callback(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'rides', true);
  });
};

export const subscribeToUserTickets = (userId: string, callback: (tickets: SupportTicket[]) => void) => {
  const q = query(collection(db, 'supportTickets'), where('userId', '==', userId), orderBy('lastMessageAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const tickets = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupportTicket));
    callback(tickets);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'supportTickets', true);
  });
};

export const subscribeToSupportMessages = (ticketId: string, callback: (msgs: any[]) => void) => {
  const q = query(collection(db, 'supportTickets', ticketId, 'messages'), orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `supportTickets/${ticketId}/messages`, true);
  });
};

// --- MANUAL TOPUP ---

export const createManualTopupRequest = async (userId: string, userName: string, amount: number) => {
  const ref = await addDoc(collection(db, 'manualTopups'), {
    userId,
    userName,
    amount,
    status: 'AWAITING_CONFIRMATION',
    referenceCode: Math.floor(10000000 + Math.random() * 90000000).toString(),
    createdAt: serverTimestamp()
  });
  return { id: ref.id, amount, referenceCode: 'REF123', status: 'AWAITING_CONFIRMATION', userId, userName, createdAt: Date.now() } as ManualTopup;
};

export const submitManualTopupProof = async (topupId: string, userId: string, file: File | null) => {
  let receiptUrl = '';
  if (file) {
    const timestamp = Date.now();
    const path = `manual_topups/${userId}/${topupId}/receipt_${timestamp}`;
    receiptUrl = await uploadFile(file, path);
  }
  await updateDoc(doc(db, 'manualTopups', topupId), {
    receiptUrl,
    status: 'AWAITING_CONFIRMATION'
  });
};

export const subscribeToUserManualTopups = (userId: string, callback: (topups: ManualTopup[]) => void) => {
  const q = query(collection(db, 'manualTopups'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ManualTopup)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'manualTopups', true);
  });
};

export const subscribeToAllManualTopups = (callback: (topups: ManualTopup[]) => void) => {
  const q = query(collection(db, 'manualTopups'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as ManualTopup)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'manualTopups/all', true);
  });
};

export const approveDriverFees = async (driverId: string) => {
  await updateDoc(doc(db, 'users', driverId), {
    pendingFees: 0,
    isBlockedByFees: false
  });
};

export const getOrCreateAdminSupportTicket = async (userId: string, userName: string) => {
  const q = query(
    collection(db, 'supportTickets'),
    where('userId', '==', userId),
    where('subject', '==', 'Driver Fees Payment'),
    where('status', '==', 'open'),
    limit(1)
  );
  
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs[0].id;
  }
  
  return await createSupportTicket(userId, 'Driver Fees Payment', `Payment request for ${userName}`, undefined);
};

export const confirmManualTopupAdmin = async (topupId: string) => {
  try {
    await runTransaction(db, async (t) => {
      const topupRef = doc(db, 'manualTopups', topupId);
      const topupDoc = await t.get(topupRef);
      if (!topupDoc.exists()) throw new Error("Top-up request not found.");
      
      const data = topupDoc.data();
      if (data.status === "PAID") return; 

      const userRef = doc(db, 'users', data.userId);
      
      t.update(topupRef, { 
        status: "PAID", 
        confirmedAt: serverTimestamp(),
        confirmedBy: auth.currentUser?.uid || 'admin'
      });

      t.update(userRef, { 
        walletBalance: increment(Number(data.amount) || 0) 
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'confirmManualTopupAdmin');
  }
};

export const rejectManualTopupAdmin = async (topupId: string, reason?: string) => {
  try {
    const topupRef = doc(db, 'manualTopups', topupId);
    await updateDoc(topupRef, { 
      status: "REJECTED", 
      rejectionReason: reason || "Admin rejected the request",
      rejectedAt: serverTimestamp(),
      rejectedBy: auth.currentUser?.uid || 'admin'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'rejectManualTopupAdmin');
  }
};

export const addDemoBalance = async (userId: string, amount: number) => {
  await updateDoc(doc(db, 'users', userId), {
    walletBalance: increment(amount)
  });
};

// --- MISC ---

export const processDriverSubscription = async (driverId: string, plan: 'weekly' | 'monthly') => {
  await updateDoc(doc(db, 'users', driverId), {
    subscriptionStatus: 'active',
    subscriptionPlan: plan,
    subscriptionExpiry: Date.now() + (plan === 'weekly' ? 7 : 30) * 24 * 60 * 60 * 1000
  });
};

export const getPricingSettings = async (): Promise<PricingConfig | null> => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'pricing'));
    return snap.exists() ? (snap.data() as PricingConfig) : null;
  } catch (error) {
    console.warn('[Firestore getPricingSettings fallback]:', error instanceof Error ? error.message : String(error));
    return null;
  }
};

export const updatePricingSettings = async (settings: PricingConfig) => {
  await setDoc(doc(db, 'settings', 'pricing'), settings);
};

export const subscribeToPricingSettings = (callback: (settings: PricingConfig | null) => void) => {
  const path = 'settings/pricing';
  return onSnapshot(doc(db, path), (snap) => {
    callback(snap.exists() ? (snap.data() as PricingConfig) : null);
  }, (error) => {
    console.warn('[Firestore subscribeToPricingSettings fallback]:', error instanceof Error ? error.message : String(error));
    callback(null);
  });
};

export const subscribeToActiveBroadcasts = (callback: (broadcasts: any[]) => void) => {
  const path = 'broadcasts';
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(q, (snap) => {
    const items: any[] = [];
    snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
    callback(items);
  }, (error) => {
    console.warn('[Firestore subscribeToActiveBroadcasts fallback]:', error instanceof Error ? error.message : String(error));
    callback([]);
  });
};

export const fetchActiveBroadcastsOnce = async (): Promise<any[]> => {
  try {
    const q = query(collection(db, 'broadcasts'), where('isActive', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn('[Firestore fetchActiveBroadcastsOnce fallback]:', error instanceof Error ? error.message : String(error));
    return [];
  }
};

export const DEFAULT_SIDE_MENU_CONFIG = {
  isSectionEnabled: true,
  facebookUrl: 'https://facebook.com',
  isFacebookEnabled: true,
  websiteUrl: 'https://waslny.com',
  isWebsiteEnabled: true,
  tiktokUrl: 'https://tiktok.com',
  isTiktokEnabled: true,
  instagramUrl: 'https://instagram.com',
  isInstagramEnabled: true,
  appVersion: '1.0.2',
  isVersionEnabled: true,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  isPaymentsEnabled: false,
  promoBanner: {
    isEnabled: true,
    textEn: 'Safe & Fast Rides',
    textAr: 'رحلات آمنة وسريعة',
  },
  mapProvider: 'google',
  mapboxPublicToken: '',
  isRewardsEnabled: true,
  rewardPointsPerTrip: 5,
  rewardThresholdPoints: 50,
  rewardDiscountAmount: 20,
  isInstaPayEnabled: false,
  driverFreeTrialDays: 30,
  defaultCommissionPercentage: 15,
  sideMenuConfig: { ...DEFAULT_SIDE_MENU_CONFIG },
};

export const subscribeToAppSettings = (callback: (settings: AppSettings | null) => void) => {
  const path = 'settings/app';
  return onSnapshot(doc(db, path), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as Partial<AppSettings>;
      callback({
        ...DEFAULT_APP_SETTINGS,
        ...data,
        isRewardsEnabled: data.isRewardsEnabled !== undefined ? Boolean(data.isRewardsEnabled) : DEFAULT_APP_SETTINGS.isRewardsEnabled,
        rewardPointsPerTrip: Number(data.rewardPointsPerTrip ?? DEFAULT_APP_SETTINGS.rewardPointsPerTrip),
        rewardThresholdPoints: Number(data.rewardThresholdPoints ?? DEFAULT_APP_SETTINGS.rewardThresholdPoints),
        rewardDiscountAmount: Number(data.rewardDiscountAmount ?? DEFAULT_APP_SETTINGS.rewardDiscountAmount),
        sideMenuConfig: {
          ...DEFAULT_SIDE_MENU_CONFIG,
          ...(data.sideMenuConfig || {}),
        },
      });
    } else {
      callback({ ...DEFAULT_APP_SETTINGS });
    }
  }, (error) => {
    console.warn('[Firestore subscribeToAppSettings fallback]:', error instanceof Error ? error.message : String(error));
    callback({ ...DEFAULT_APP_SETTINGS });
  });
};

export const getAppSettings = async (): Promise<AppSettings | null> => {
  const path = 'settings/app';
  try {
    const snap = await getDoc(doc(db, path));
    if (snap.exists()) {
      const data = snap.data() as Partial<AppSettings>;
      return {
        ...DEFAULT_APP_SETTINGS,
        ...data,
        isRewardsEnabled: data.isRewardsEnabled !== undefined ? Boolean(data.isRewardsEnabled) : DEFAULT_APP_SETTINGS.isRewardsEnabled,
        rewardPointsPerTrip: Number(data.rewardPointsPerTrip ?? DEFAULT_APP_SETTINGS.rewardPointsPerTrip),
        rewardThresholdPoints: Number(data.rewardThresholdPoints ?? DEFAULT_APP_SETTINGS.rewardThresholdPoints),
        rewardDiscountAmount: Number(data.rewardDiscountAmount ?? DEFAULT_APP_SETTINGS.rewardDiscountAmount),
        sideMenuConfig: {
          ...DEFAULT_SIDE_MENU_CONFIG,
          ...(data.sideMenuConfig || {}),
        },
      };
    }
    return { ...DEFAULT_APP_SETTINGS };
  } catch (error) {
    console.warn('[Firestore getAppSettings fallback]:', error instanceof Error ? error.message : String(error));
    return { ...DEFAULT_APP_SETTINGS };
  }
};

export const DEFAULT_SUPPORT_WHATSAPP = '+201024419931';

export const formatWhatsAppUrl = (rawPhone?: string, customMessage?: string): string => {
  const fallback = DEFAULT_SUPPORT_WHATSAPP;
  const source = (rawPhone && rawPhone.trim()) ? rawPhone.trim() : fallback;
  let digits = source.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('01') && digits.length === 11) {
    digits = `2${digits}`;
  }
  if (!digits) {
    digits = '201024419931';
  }
  const baseUrl = `https://wa.me/${digits}`;
  return customMessage ? `${baseUrl}?text=${encodeURIComponent(customMessage)}` : baseUrl;
};

export const DEFAULT_HOME_AD_BANNER: HomeAdBannerConfig = {
  isEnabled: true,
  isSectionHidden: false,
  isQuickDestinationsEnabled: true,
  topicAr: 'عرض خاص للكباتن',
  topicEn: 'SPECIAL OFFER',
  subTopicAr: 'دخل يومي يصل لـ 15,000 ج.م',
  subTopicEn: 'Earn up to 15,000 EGP',
  titleAr: 'انضم ككابتن مع وصلني',
  titleEn: 'DRIVE WITH WASLNY',
  textAr: 'عمولة 0% لأول شهر • تفعيل فوري في 15 دقيقة',
  textEn: '0% fee 1st month • 15 min fast approval',
  badgeTextAr: '0% عمولة',
  badgeTextEn: '0% Fee',
  imageUrl: '/assets/driver_banner_art_1791386105464.jpg',
  isButtonEnabled: true,
  buttonTextAr: 'سجل ككابتن الآن',
  buttonTextEn: 'APPLY NOW',
  buttonActionType: 'explainer_modal' as const,
  buttonActionUrl: '',
};

export const updateAppSettings = async (settings: AppSettings) => {
  const path = 'settings/app';
  try {
    await setDoc(doc(db, path), settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateAppAudioSettings = async (audioSettings: AppAudioSettings) => {
  const path = 'settings/app';
  try {
    await setDoc(doc(db, path), { audioSettings }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};


export const updateHomeAdBanner = async (homeAdBanner: Partial<HomeAdBannerConfig>) => {
  const path = 'settings/app';
  const merged = {
    ...DEFAULT_HOME_AD_BANNER,
    ...homeAdBanner,
    updatedAt: Date.now(),
  };
  try {
    await setDoc(doc(db, path), { homeAdBanner: merged }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const updateSupportWhatsappNumber = async (supportWhatsappNumber: string) => {
  const path = 'settings/app';
  const normalized = supportWhatsappNumber.trim() || DEFAULT_SUPPORT_WHATSAPP;
  try {
    await setDoc(doc(db, path), { supportWhatsappNumber: normalized }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const sendGlobalNotification = async (title: string, body: string) => {
  const send = httpsCallable(functions, 'sendBroadcastNotification');
  return await send({ title, body });
};

export const sendSystemBroadcastPush = async (payload: {
  title: string;
  body: string;
  titleAr?: string;
  bodyAr?: string;
  type?: string;
  audience?: 'all' | 'drivers' | 'passengers';
  targetPlatform?: 'android' | 'all';
  playStoreUrl?: string;
  broadcastId?: string;
  requiredVersion?: string;
}) => {
  const send = httpsCallable(functions, 'sendSystemBroadcastPush');
  return await send(payload);
};

const compressImageToDataUrl = (file: File | Blob, maxDimension = 900, quality = 0.62): Promise<{ blob: Blob; dataUrl: string }> => {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith('image/') || typeof document === 'undefined') {
      const reader = new FileReader();
      reader.onloadend = () => resolve({ blob: file, dataUrl: (reader.result as string) || '' });
      reader.onerror = () => resolve({ blob: file, dataUrl: '' });
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context unavailable');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        canvas.toBlob(
          (compressedBlob) => {
            resolve({
              blob: compressedBlob || file,
              dataUrl,
            });
          },
          'image/jpeg',
          quality
        );
      } catch {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ blob: file, dataUrl: (reader.result as string) || '' });
        reader.onerror = () => resolve({ blob: file, dataUrl: '' });
        reader.readAsDataURL(file);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      const reader = new FileReader();
      reader.onloadend = () => resolve({ blob: file, dataUrl: (reader.result as string) || '' });
      reader.onerror = () => resolve({ blob: file, dataUrl: '' });
      reader.readAsDataURL(file);
    };
    img.src = objUrl;
  });
};

export const uploadFile = async (file: File | Blob, path: string): Promise<string> => {
  const isImage = Boolean(file.type && file.type.startsWith('image/'));
  const prepared = isImage
    ? await compressImageToDataUrl(file, 900, 0.62)
    : { blob: file, dataUrl: '' };

  try {
    const storageRef = ref(storage, path);
    const uploadTask = (async () => {
      await uploadBytes(storageRef, prepared.blob, {
        contentType: isImage ? 'image/jpeg' : file.type || 'application/octet-stream',
      });
      return await getDownloadURL(storageRef);
    })();

    const timeoutTask = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timeout')), 7000)
    );

    return await Promise.race([uploadTask, timeoutTask]);
  } catch (storageErr) {
    console.warn(`[STORAGE UPLOAD] Falling back to compressed DataURL for ${path}:`, storageErr);
    if (prepared.dataUrl) {
      return prepared.dataUrl;
    }
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve((reader.result as string) || '');
      };
      reader.onerror = () => {
        resolve('');
      };
      reader.readAsDataURL(prepared.blob);
    });
  }
};

// --- LOCATIONS & HISTORY ---

export const saveRecentDestination = async (userId: string, place: Place) => {
  const safeId = String(place.id || `hist_${Date.now()}`).replace(/[\/.#$\[\]]+/g, '_');
  const safePlace: Place = {
    id: safeId,
    name: String(place.name || ''),
    address: String(place.address || ''),
    coords: {
      lat: Number(place.coords?.lat || 0),
      lng: Number(place.coords?.lng || 0),
    },
    type: place.type || 'history',
    isGooglePlace: Boolean(place.isGooglePlace),
    updatedAt: typeof place.updatedAt === 'number' ? place.updatedAt : Date.now(),
  };
  await setDoc(doc(db, 'users', userId, 'recentPlaces', safeId), safePlace, { merge: true });
};

const getPlaceRecencyTime = (p: Place): number => {
  if (typeof p.updatedAt === 'number' && !isNaN(p.updatedAt)) return p.updatedAt;
  const match = String(p.id || '').match(/(\d{10,13})/);
  if (match) {
    const num = Number(match[1]);
    return match[1].length === 10 ? num * 1000 : num;
  }
  return 0;
};

export const subscribeToRecentDestinations = (userId: string, callback: (places: Place[]) => void) => {
  const path = `users/${userId}/recentPlaces`;
  const q = query(collection(db, 'users', userId, 'recentPlaces'), limit(200));
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<Place, 'id'>) } as Place))
      .filter(p => p && p.name && p.coords && typeof p.coords.lat === 'number' && typeof p.coords.lng === 'number' && (p.coords.lat !== 0 || p.coords.lng !== 0))
      .sort((a, b) => getPlaceRecencyTime(b) - getPlaceRecencyTime(a));
    callback(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path, true);
  });
};

export const clearRecentDestinations = async (userId: string) => {
  const q = query(collection(db, 'users', userId, 'recentPlaces'));
  const snap = await getDocs(q);
  const batch = runTransaction(db, async (t) => {
      snap.docs.forEach(d => t.delete(d.ref));
  });
  await batch;
};

// --- REMOTE CONFIG ---

const RC_DEFAULTS = {
  maintenance_mode: false,
  min_version: '1.0.0',
  welcome_msg_en: 'Welcome to Mowasla',
  welcome_msg_ar: 'مرحباً بك في مواصلة',
  enable_promo: true,
  min_supported_version: 1, // Safe numeric default; real minimum versionCode comes from Remote Config
};

const RC_CACHE_KEY_MIN_SUPPORTED_VERSION = 'mowasla_rc_min_supported_version_v1';
const RC_FETCH_TIMEOUT_SECONDS = 10;
const RC_PRODUCTION_MIN_FETCH_INTERVAL_SECONDS = 300; // 5 minutes in production

export type RemoteConfigFetchStatus =
  | 'success'
  | 'failed_using_cache'
  | 'timeout_using_cache'
  | 'skipped_non_android';

export interface ForceUpdateCheckResult {
  updateRequired: boolean;
  installedBuild: number | null;
  installedVersionName: string | null;
  minSupportedVersion: number;
  valueSource: 'remote' | 'cached' | 'default';
  fetchStatus: RemoteConfigFetchStatus;
  trigger: 'startup' | 'resume' | 'manual';
}

export const getRemoteConfigMinFetchIntervalSeconds = (): number => {
  const overrideRaw = import.meta.env.VITE_REMOTE_CONFIG_MIN_FETCH_INTERVAL_SECONDS;
  if (overrideRaw !== undefined && overrideRaw !== '') {
    const parsedOverride = Number(overrideRaw);
    if (Number.isFinite(parsedOverride) && parsedOverride >= 0) {
      return Math.floor(parsedOverride);
    }
  }
  const isDevOrTesting = Boolean(import.meta.env.DEV || import.meta.env.MODE !== 'production');
  return isDevOrTesting ? 0 : RC_PRODUCTION_MIN_FETCH_INTERVAL_SECONDS;
};

const readCachedMinSupportedVersion = (): number | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(RC_CACHE_KEY_MIN_SUPPORTED_VERSION);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedMinSupportedVersion = (versionCode: number): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (!Number.isFinite(versionCode) || versionCode <= 0) return;
  try {
    window.localStorage.setItem(RC_CACHE_KEY_MIN_SUPPORTED_VERSION, String(Math.floor(versionCode)));
  } catch {
    // Ignore storage quota errors
  }
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
};

let inFlightRemoteFetchPromise: Promise<RemoteConfigFetchStatus> | null = null;

export const fetchAndActivateRemoteConfig = async (
  trigger: 'startup' | 'resume' | 'manual' = 'manual'
): Promise<RemoteConfigFetchStatus> => {
  if (inFlightRemoteFetchPromise) {
    return inFlightRemoteFetchPromise;
  }

  inFlightRemoteFetchPromise = (async (): Promise<RemoteConfigFetchStatus> => {
    const minFetchIntervalSeconds = getRemoteConfigMinFetchIntervalSeconds();
    const platform = Capacitor.getPlatform();
    const isNative = Capacitor.isNativePlatform();

    console.log('[RemoteConfig] Fetching and activating config...', {
      trigger,
      platform,
      isNative,
      minFetchIntervalSeconds,
    });

    try {
      if (isNative) {
        await withTimeout(
          FirebaseRemoteConfig.setSettings({
            fetchTimeoutInSeconds: RC_FETCH_TIMEOUT_SECONDS,
            minimumFetchIntervalInSeconds: minFetchIntervalSeconds,
          }),
          3000,
          'Native Remote Config setSettings'
        );

        await withTimeout(
          FirebaseRemoteConfig.fetchConfig({
            minimumFetchIntervalInSeconds: minFetchIntervalSeconds,
          }),
          8000,
          'Native Remote Config fetchConfig'
        );

        await withTimeout(
          FirebaseRemoteConfig.activate(),
          3000,
          'Native Remote Config activate'
        );

        console.log('[RemoteConfig] Native fetch & activate status: SUCCESS', {
          trigger,
          minFetchIntervalSeconds,
        });
        return 'success';
      } else {
        const rc = getRemoteConfig(app);
        rc.settings.minimumFetchIntervalMillis = minFetchIntervalSeconds * 1000;
        rc.settings.fetchTimeoutMillis = RC_FETCH_TIMEOUT_SECONDS * 1000;
        rc.defaultConfig = RC_DEFAULTS;

        await withTimeout(
          fetchAndActivate(rc),
          6000,
          'Web Remote Config fetchAndActivate'
        );

        console.log('[RemoteConfig] Web fetch & activate status: SUCCESS', {
          trigger,
          minFetchIntervalSeconds,
        });
        return 'success';
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isTimeout = errMsg.toLowerCase().includes('timed out') || errMsg.toLowerCase().includes('timeout');
      const status: RemoteConfigFetchStatus = isTimeout ? 'timeout_using_cache' : 'failed_using_cache';

      console.warn('[RemoteConfig] Fetch & activate failed; using safe cached/default values.', {
        trigger,
        platform,
        status,
        error: errMsg,
      });
      return status;
    }
  })().finally(() => {
    inFlightRemoteFetchPromise = null;
  });

  return inFlightRemoteFetchPromise;
};

export const initRemoteConfig = async (
  trigger: 'startup' | 'resume' | 'manual' = 'startup'
): Promise<RemoteConfigFetchStatus> => {
  return fetchAndActivateRemoteConfig(trigger);
};

export const getRemoteString = async (key: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { value, source } = await FirebaseRemoteConfig.getString({ key });
      if (source !== GetValueSource.Static && typeof value === 'string') {
        return value;
      }
      return (RC_DEFAULTS as Record<string, any>)[key] ?? value;
    } catch {
      return (RC_DEFAULTS as any)[key] as string;
    }
  }
  try {
    return getString(getRemoteConfig(app), key);
  } catch {
    return (RC_DEFAULTS as any)[key] as string;
  }
};

export const getRemoteBoolean = async (key: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { value, source } = await FirebaseRemoteConfig.getBoolean({ key });
      if (source !== GetValueSource.Static) {
        return value;
      }
      return (RC_DEFAULTS as Record<string, any>)[key] ?? value;
    } catch {
      return (RC_DEFAULTS as any)[key] as boolean;
    }
  }
  try {
    return getBoolean(getRemoteConfig(app), key);
  } catch {
    return (RC_DEFAULTS as any)[key] as boolean;
  }
};

export const getRemoteNumber = async (key: string): Promise<number> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { value, source } = await FirebaseRemoteConfig.getNumber({ key });
      const parsed = Number(value);
      if (source !== GetValueSource.Static && Number.isFinite(parsed)) {
        return parsed;
      }
      const fallback = (RC_DEFAULTS as Record<string, any>)[key];
      return typeof fallback === 'number' ? fallback : 0;
    } catch {
      const fallback = (RC_DEFAULTS as Record<string, any>)[key];
      return typeof fallback === 'number' ? fallback : 0;
    }
  }
  try {
    return getNumber(getRemoteConfig(app), key);
  } catch {
    return (RC_DEFAULTS as any)[key] as number;
  }
};

// --- Financial System ---

export const getDriverSettlements = async (driverId: string) => {
  const q = query(
    collection(db, 'settlements'),
    where('driverId', '==', driverId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
};

export const getAllSettlements = async () => {
  const q = query(collection(db, 'settlements'), orderBy('createdAt', 'desc'), limit(500));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
};

export const generateWeeklySettlement = async (driverId: string, commissionOwed: number, totalRides: number, grossEarnings: number) => {
  // Reset pending fees and update last settlement date
  // Wait, generation happens when the week ends. Admin manually triggers or cron.
  await runTransaction(db, async (t) => {
    const driverRef = doc(db, 'users', driverId);
    const driverDoc = await t.get(driverRef);
    if (!driverDoc.exists()) return;
    const driverData = driverDoc.data();

    const settlementRef = doc(collection(db, 'settlements'));
    t.set(settlementRef, {
      driverId,
      driverName: driverData.name || 'Unknown',
      startDate: Date.now() - 7 * 24 * 60 * 60 * 1000,
      endDate: Date.now(),
      totalRides,
      grossEarnings,
      commissionOwed,
      status: 'unpaid',
      createdAt: serverTimestamp()
    });

    t.update(driverRef, {
      pendingFees: 0, 
      lastSettlementDate: Date.now(),
      financialStatus: commissionOwed > 0 ? 'warning' : 'active',
      gracePeriodEndTime: commissionOwed > 0 ? Date.now() + 2 * 24 * 60 * 60 * 1000 : null // 2 Days grace
    });
  });
};

export const submitSettlementPayment = async (settlementId: string, receiptUrl: string) => {
  await updateDoc(doc(db, 'settlements', settlementId), {
    status: 'pending_verification',
    receiptUrl
  });
};

export const approveSettlementPayment = async (settlementId: string, driverId: string) => {
  await runTransaction(db, async (t) => {
    const settlementRef = doc(db, 'settlements', settlementId);
    const driverRef = doc(db, 'users', driverId);

    t.update(settlementRef, {
      status: 'paid',
      paidAt: serverTimestamp()
    });

    // Check if driver has other unpaid/pending settlements to see if we should fully reactivate
    t.update(driverRef, {
      financialStatus: 'active',
      gracePeriodEndTime: null
    });
  });
};

export const updateDriverFinancialStatus = async (driverId: string, status: 'active' | 'warning' | 'soft_restricted' | 'blocked') => {
  await updateDoc(doc(db, 'users', driverId), { financialStatus: status });
};


let inFlightForceUpdateCheckPromise: Promise<ForceUpdateCheckResult> | null = null;

const resolveActivatedMinSupportedVersion = async (
  fetchStatus: RemoteConfigFetchStatus
): Promise<{ minSupportedVersion: number; valueSource: 'remote' | 'cached' | 'default' }> => {
  try {
    const { value, source } = await FirebaseRemoteConfig.getNumber({
      key: 'min_supported_version',
    });
    const numericVal = Math.floor(Number(value));
    const isValidPositive = Number.isFinite(numericVal) && numericVal > 0;

    if (source === GetValueSource.Remote && isValidPositive) {
      if (fetchStatus === 'success') {
        writeCachedMinSupportedVersion(numericVal);
        return { minSupportedVersion: numericVal, valueSource: 'remote' };
      }
      return { minSupportedVersion: numericVal, valueSource: 'cached' };
    }

    if (source === GetValueSource.Default && isValidPositive) {
      return { minSupportedVersion: numericVal, valueSource: 'default' };
    }

    const cachedVal = readCachedMinSupportedVersion();
    if (cachedVal !== null) {
      return { minSupportedVersion: cachedVal, valueSource: 'cached' };
    }
  } catch (err) {
    console.warn('[RemoteConfig] Failed to read min_supported_version from native plugin:', err);
    const cachedVal = readCachedMinSupportedVersion();
    if (cachedVal !== null) {
      return { minSupportedVersion: cachedVal, valueSource: 'cached' };
    }
  }

  return {
    minSupportedVersion: RC_DEFAULTS.min_supported_version,
    valueSource: 'default',
  };
};

/**
 * Fetches & activates Firebase Remote Config and compares the native Android
 * build number (versionCode) against numeric `min_supported_version`.
 */
export const checkForceUpdateDetails = async (
  trigger: 'startup' | 'resume' | 'manual' = 'manual'
): Promise<ForceUpdateCheckResult> => {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return {
      updateRequired: false,
      installedBuild: null,
      installedVersionName: null,
      minSupportedVersion: RC_DEFAULTS.min_supported_version,
      valueSource: 'default',
      fetchStatus: 'skipped_non_android',
      trigger,
    };
  }

  if (inFlightForceUpdateCheckPromise) {
    return inFlightForceUpdateCheckPromise;
  }

  inFlightForceUpdateCheckPromise = (async (): Promise<ForceUpdateCheckResult> => {
    try {
      const [fetchStatus, appInfo] = await Promise.all([
        fetchAndActivateRemoteConfig(trigger),
        withTimeout(CapacitorApp.getInfo(), 3000, 'CapacitorApp.getInfo').catch((err) => {
          console.warn('[ForceUpdate] CapacitorApp.getInfo failed:', err);
          return null;
        }),
      ]);

      const { minSupportedVersion, valueSource } = await resolveActivatedMinSupportedVersion(fetchStatus);

      if (!appInfo) {
        console.warn('[ForceUpdate] Native AppInfo unavailable; failing safe without blocking user.', {
          trigger,
          fetchStatus,
          minSupportedVersion,
          valueSource,
        });
        return {
          updateRequired: false,
          installedBuild: null,
          installedVersionName: null,
          minSupportedVersion,
          valueSource,
          fetchStatus,
          trigger,
        };
      }

      const installedBuild = Number.parseInt(String(appInfo.build ?? '').trim(), 10);
      const installedVersionName = String(appInfo.version ?? '').trim() || null;

      if (!Number.isFinite(installedBuild) || installedBuild <= 0) {
        console.warn('[ForceUpdate] Invalid native versionCode; failing safe without blocking user.', {
          trigger,
          rawBuild: appInfo.build,
          installedVersionName,
          minSupportedVersion,
          valueSource,
        });
        return {
          updateRequired: false,
          installedBuild: null,
          installedVersionName,
          minSupportedVersion,
          valueSource,
          fetchStatus,
          trigger,
        };
      }

      const updateRequired = installedBuild < minSupportedVersion;

      console.log('[ForceUpdate] Version comparison result:', {
        trigger,
        packageId: appInfo.id || 'com.ans.waslny',
        fetchStatus,
        activatedMinSupportedVersion: minSupportedVersion,
        valueSource,
        installedVersionCode: installedBuild,
        installedVersionName,
        comparison: `${installedBuild} < ${minSupportedVersion}`,
        updateRequired,
      });

      return {
        updateRequired,
        installedBuild,
        installedVersionName,
        minSupportedVersion,
        valueSource,
        fetchStatus,
        trigger,
      };
    } catch (error) {
      console.error('[ForceUpdate] Unexpected error during update check (fail-safe):', error);
      return {
        updateRequired: false,
        installedBuild: null,
        installedVersionName: null,
        minSupportedVersion: RC_DEFAULTS.min_supported_version,
        valueSource: 'default',
        fetchStatus: 'failed_using_cache',
        trigger,
      };
    }
  })().finally(() => {
    inFlightForceUpdateCheckPromise = null;
  });

  return inFlightForceUpdateCheckPromise;
};

/**
 * Checks if the current Android app versionCode is lower than `min_supported_version`
 * defined in Firebase Remote Config.
 */
export const checkForceUpdate = async (
  trigger: 'startup' | 'resume' | 'manual' = 'manual'
): Promise<boolean> => {
  const result = await checkForceUpdateDetails(trigger);
  return result.updateRequired;
};

export * from './scheduledRidesService';

