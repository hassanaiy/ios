
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// --- GLOBAL STORAGE QUOTA PROTECTION ---
// Prevents QuotaExceededError when user profiles or ride objects contain base64 document/avatar images
const stripHeavyDataUrls = (obj: any, depth = 0): any => {
  if (!obj || typeof obj !== 'object' || depth > 4) return obj;
  if (Array.isArray(obj)) {
    return obj
      .map((item) =>
        typeof item === 'string' && item.startsWith('data:') && item.length > 2048
          ? ''
          : stripHeavyDataUrls(item, depth + 1)
      )
      .filter(Boolean);
  }
  const clone: Record<string, any> = {};
  const heavyDocKeys = new Set([
    'licenseUrl',
    'nationalIdUrl',
    'nationalIdBackUrl',
    'vehicleRegFrontUrl',
    'vehicleRegBackUrl',
    'vehicleImageUrl',
    'criminalRecordUrl',
    'receiptUrl',
  ]);
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'documents' && v && typeof v === 'object') {
      clone[k] = { _cached: true };
      continue;
    }
    if (heavyDocKeys.has(k) && typeof v === 'string' && v.startsWith('data:')) {
      clone[k] = '';
      continue;
    }
    if (typeof v === 'string' && v.startsWith('data:') && v.length > 15000) {
      clone[k] = '';
      continue;
    }
    if (v && typeof v === 'object') {
      clone[k] = stripHeavyDataUrls(v, depth + 1);
    } else {
      clone[k] = v;
    }
  }
  return clone;
};

const createMinimalCachedUser = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  return {
    id: obj.id,
    name: obj.name || '',
    email: obj.email || '',
    phone: obj.phone || '',
    role: obj.role,
    isAdmin: obj.isAdmin,
    isApproved: obj.isApproved,
    driverStatus: obj.driverStatus,
    status: obj.status,
    kycStatus: obj.kycStatus,
    profileCompleted: obj.profileCompleted ?? true,
    hasPasskey: Boolean(obj.hasPasskey),
    walletBalance: obj.walletBalance ?? 0,
    rating: obj.rating ?? 5,
    vehicle: obj.vehicle ? stripHeavyDataUrls(obj.vehicle, 1) : undefined,
  };
};

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const rawSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      let safeValue = value;
      if (
        (key === 'mowasla_cached_user' ||
          key === 'mowasla_ride_data' ||
          key === 'mowasla_driver_ride_data') &&
        typeof value === 'string' &&
        value.length > 20000
      ) {
        try {
          const parsed = JSON.parse(value);
          safeValue = JSON.stringify(stripHeavyDataUrls(parsed));
          if (key === 'mowasla_cached_user' && safeValue.length > 35000) {
            safeValue = JSON.stringify(createMinimalCachedUser(parsed));
          }
        } catch {
          // ignore parse error
        }
      }
      try {
        rawSetItem.call(this, key, safeValue);
      } catch (err: any) {
        console.warn(`[Storage Quota Guard] Evicting non-auth cache to save key "${key}":`, err?.name || err);
        try {
          this.removeItem('mowasla_ride_data');
          this.removeItem('mowasla_driver_ride_data');
          this.removeItem('places_history');
          if (key !== 'mowasla_cached_user') {
            const existingUser = this.getItem('mowasla_cached_user');
            if (existingUser && existingUser.length > 15000) {
              try {
                const parsedUser = JSON.parse(existingUser);
                const slimmed = JSON.stringify(createMinimalCachedUser(parsedUser));
                rawSetItem.call(this, 'mowasla_cached_user', slimmed);
              } catch {
                // Never delete mowasla_cached_user on quota fallback
              }
            }
          } else {
            try {
              const parsedUser = JSON.parse(value);
              safeValue = JSON.stringify(createMinimalCachedUser(parsedUser));
            } catch {}
          }
          if (safeValue.length < 150000) {
            rawSetItem.call(this, key, safeValue);
          }
        } catch {
          // Swallow QuotaExceededError so the app never crashes or logs out
        }
      }
    };

    // Immediate boot-time cleanup of any previously bloated cache entries without ever deleting mowasla_cached_user
    ['mowasla_cached_user', 'mowasla_ride_data', 'mowasla_driver_ride_data'].forEach((k) => {
      try {
        const existing = window.localStorage.getItem(k);
        if (existing && existing.length > 25000) {
          const parsed = JSON.parse(existing);
          const slimmed =
            k === 'mowasla_cached_user'
              ? JSON.stringify(createMinimalCachedUser(stripHeavyDataUrls(parsed)))
              : JSON.stringify(stripHeavyDataUrls(parsed));
          rawSetItem.call(window.localStorage, k, slimmed);
        }
      } catch {
        if (k !== 'mowasla_cached_user') {
          try {
            window.localStorage.removeItem(k);
          } catch {}
        }
      }
    });
  } catch {}
}

import App from './App';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';
import { Capacitor } from '@capacitor/core';

// Global error handlers
window.addEventListener('error', async (event) => {
  try {
    if (Capacitor.isNativePlatform()) {
      await FirebaseCrashlytics.recordException({
        message: String(event.error || event.message)
      });
    }
  } catch (e) {
    console.warn('Failed to log to Crashlytics', e);
  }
});

window.addEventListener('unhandledrejection', async (event) => {
  const reasonStr = String(event.reason || '');
  if (reasonStr.includes('Missing or insufficient permissions') || reasonStr.includes('permission')) {
    event.preventDefault();
    console.log('[Silenced Permission Error from unhandledrejection]', event.reason);
    return;
  }
  if (reasonStr.includes('Could not reach Cloud Firestore backend') || reasonStr.includes('unavailable') || reasonStr.includes('client is offline')) {
    event.preventDefault();
    console.info('[Handled Firestore offline transition]', event.reason);
    return;
  }
  try {
    if (Capacitor.isNativePlatform()) {
      await FirebaseCrashlytics.recordException({
        message: String(event.reason)
      });
    }
  } catch (e) {
    console.warn('Failed to log to Crashlytics', e);
  }
});

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  async componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
    try {
      if (Capacitor.isNativePlatform()) {
        await FirebaseCrashlytics.recordException({
          message: String(error) + "\n" + JSON.stringify(errorInfo)
        });
      }
    } catch (e) {
      console.warn('Failed to log to Crashlytics', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', backgroundColor: 'white', height: '100vh', overflow: 'auto' }}>
          <h1>Something went wrong.</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
