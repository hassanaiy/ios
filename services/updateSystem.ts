import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { AppLauncher } from '@capacitor/app-launcher';
import { Browser } from '@capacitor/browser';
import { AppSettings, Broadcast, Driver, User, UserRole } from '../types';

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.ans.waslny';
export const PLAY_STORE_MARKET_URI = 'market://details?id=com.ans.waslny';

const FLEXIBLE_UPDATE_SNOOZE_MS = 12 * 60 * 60 * 1000; // 12 hours
const FLEXIBLE_UPDATE_SNOOZE_KEY = 'mowasla_flexible_update_snooze';
const DISMISSED_BROADCASTS_KEY = 'mowasla_dismissed_broadcasts_v2';

export interface InstalledAppInfo {
  version: string;
  build: number;
}

export interface UpdateEvaluationResult {
  needed: boolean;
  mode: 'force' | 'flexible';
  reason: 'version' | 'build' | 'remote_config' | 'enabled_without_target' | null;
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  playStoreUrl: string;
  requiredVersion: string;
  minBuildNumber: number;
  updateKey: string;
}

/**
 * Returns true when running on an Android device or inside the native Android Capacitor app.
 * Desktop browsers (Windows/Mac/Linux) and iOS devices return false.
 */
export const isAndroidNativePlatform = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

/**
 * Safely parses version strings like "v1.2.3", "1.2.3-rc1", " 1.0 " into numeric segments.
 */
export const parseVersionParts = (versionStr?: string | number | null): number[] => {
  if (versionStr === null || versionStr === undefined) return [];
  const cleaned = String(versionStr)
    .trim()
    .replace(/^v/i, '')
    .split(/[-_+]/)[0];
  if (!cleaned) return [];
  const parts = cleaned
    .split('.')
    .map((seg) => {
      const match = seg.match(/\d+/);
      return match ? parseInt(match[0], 10) : NaN;
    })
    .filter((n) => Number.isFinite(n));
  return parts;
};

/**
 * Compares two semantic version strings.
 * Returns -1 if current < target, 0 if equal (or invalid target), 1 if current > target.
 */
export const compareSemver = (current?: string | null, target?: string | null): number => {
  const currParts = parseVersionParts(current);
  const targetParts = parseVersionParts(target);
  if (targetParts.length === 0) return 0;
  if (currParts.length === 0) return -1;

  const len = Math.max(currParts.length, targetParts.length);
  for (let i = 0; i < len; i++) {
    const c = currParts[i] || 0;
    const t = targetParts[i] || 0;
    if (c < t) return -1;
    if (c > t) return 1;
  }
  return 0;
};

export const getTimestampMillis = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts === 'number') return Number.isFinite(ts) ? ts : 0;
  if (typeof ts?.toMillis === 'function') {
    try {
      return ts.toMillis();
    } catch {
      return 0;
    }
  }
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  const parsed = Date.parse(String(ts));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Fetches installed Android app version & build number with a strict timeout
 * so slow devices or WebView bridges never hang app startup.
 */
export const getInstalledAndroidAppInfo = async (): Promise<InstalledAppInfo> => {
  const fallback: InstalledAppInfo = { version: '1.0.0', build: 1 };
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return fallback;

  try {
    const infoPromise = CapacitorApp.getInfo();
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const info = await Promise.race([infoPromise, timeoutPromise]);
    if (!info) return fallback;

    const version = (info.version || '1.0.0').trim();
    const parsedBuild = parseInt(String(info.build || '1'), 10);
    return {
      version,
      build: Number.isFinite(parsedBuild) && parsedBuild > 0 ? parsedBuild : 1,
    };
  } catch (err) {
    console.warn('[UpdateSystem] CapacitorApp.getInfo failed:', err);
    return fallback;
  }
};

/**
 * Opens the Google Play Store listing for com.ans.waslny.
 * Uses native market:// intent via Capacitor AppLauncher with Browser HTTPS fallback.
 */
export async function openPlayStoreUpdate(_customUrl?: string): Promise<void> {
  const packageName = 'com.ans.waslny';
  const marketUrl = `market://details?id=${packageName}`;
  const webUrl = `https://play.google.com/store/apps/details?id=${packageName}`;

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    try {
      const { value: canOpen } = await AppLauncher.canOpenUrl({ url: marketUrl });
      if (canOpen) {
        const result = await AppLauncher.openUrl({ url: marketUrl });
        if (result?.completed !== false) {
          return;
        }
      }
    } catch (marketErr) {
      console.warn('[UpdateSystem] Failed to open market:// via AppLauncher, falling back to Browser:', marketErr);
    }

    try {
      const { value: canOpenPlayApp } = await AppLauncher.canOpenUrl({ url: 'com.android.vending' });
      if (canOpenPlayApp) {
        const result = await AppLauncher.openUrl({ url: marketUrl });
        if (result?.completed !== false) {
          return;
        }
      }
    } catch {
      // Fall through to Browser fallback
    }
  }

  try {
    await Browser.open({ url: webUrl });
  } catch (browserErr) {
    console.warn('[UpdateSystem] Browser.open failed, falling back to location redirect:', browserErr);
    if (typeof window !== 'undefined') {
      window.location.assign(webUrl);
    }
  }
}

export const isFlexibleUpdateSnoozed = (updateKey: string): boolean => {
  if (!updateKey || typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(FLEXIBLE_UPDATE_SNOOZE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed?.key !== updateKey) return false;
    return typeof parsed?.until === 'number' && Date.now() < parsed.until;
  } catch {
    return false;
  }
};

export const snoozeFlexibleUpdate = (updateKey: string): void => {
  if (!updateKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      FLEXIBLE_UPDATE_SNOOZE_KEY,
      JSON.stringify({ key: updateKey, until: Date.now() + FLEXIBLE_UPDATE_SNOOZE_MS })
    );
  } catch {
    // ignore storage quota errors
  }
};

/**
 * Evaluates whether an Android native user needs to update based on Firestore settings + Remote Config.
 * Strictly returns needed=false for Admin accounts and Web users.
 */
export const evaluateAppUpdateRequirement = ({
  appSettings,
  installedInfo,
  remoteMinBuildExceeded,
  isAdminUser,
}: {
  appSettings: AppSettings | null;
  installedInfo: InstalledAppInfo;
  remoteMinBuildExceeded: boolean;
  isAdminUser: boolean;
}): UpdateEvaluationResult => {
  const defaultTitleEn = 'Update Available';
  const defaultTitleAr = 'تحديث جديد متاح';
  const defaultMsgEn =
    'A new version of Mowasla is available on Google Play with performance improvements and important fixes. Please update to continue.';
  const defaultMsgAr =
    'يتوفر إصدار جديد من تطبيق وصلني على جوجل بلاي يتضمن تحسينات مهمة للأداء وإصلاحات أساسية. يرجى التحديث الآن للمتابعة.';

  const base: UpdateEvaluationResult = {
    needed: false,
    mode: 'force',
    reason: null,
    titleEn: appSettings?.forceUpdate?.titleEn || defaultTitleEn,
    titleAr: appSettings?.forceUpdate?.titleAr || defaultTitleAr,
    messageEn: appSettings?.forceUpdate?.messageEn || defaultMsgEn,
    messageAr: appSettings?.forceUpdate?.messageAr || defaultMsgAr,
    playStoreUrl: PLAY_STORE_URL,
    requiredVersion: appSettings?.forceUpdate?.requiredVersion || '',
    minBuildNumber: Number(appSettings?.forceUpdate?.minBuildNumber || 0),
    updateKey: '',
  };

  // Never trigger on Web or for Admin accounts
  if (!isAndroidNativePlatform() || isAdminUser) {
    return base;
  }

  const fu = appSettings?.forceUpdate;
  if (fu?.isEnabled) {
    const reqVer = (fu.requiredVersion || '').trim();
    const minBuild = Number(fu.minBuildNumber || 0);
    const mode: 'force' | 'flexible' = fu.updateMode === 'flexible' ? 'flexible' : 'force';
    const updatedMs = getTimestampMillis(fu.updatedAt);
    const updateKey = `${reqVer || 'any'}_${minBuild}_${updatedMs}`;

    let versionOutdated = false;
    let buildOutdated = false;

    if (reqVer && parseVersionParts(reqVer).length > 0) {
      versionOutdated = compareSemver(installedInfo.version, reqVer) < 0;
    }
    if (Number.isFinite(minBuild) && minBuild > 0) {
      buildOutdated = installedInfo.build < minBuild;
    }

    // If admin turned on forceUpdate without specifying either version or build,
    // still prompt unless they explicitly only targeted a version the user already meets.
    const noTargetSpecified = !reqVer && (!Number.isFinite(minBuild) || minBuild <= 0);

    if (versionOutdated || buildOutdated || noTargetSpecified) {
      const reason = versionOutdated
        ? 'version'
        : buildOutdated
          ? 'build'
          : 'enabled_without_target';
      if (mode === 'flexible' && isFlexibleUpdateSnoozed(updateKey)) {
        return base;
      }
      return {
        ...base,
        needed: true,
        mode,
        reason,
        updateKey,
      };
    }
  }

  if (remoteMinBuildExceeded) {
    return {
      ...base,
      needed: true,
      mode: 'force',
      reason: 'remote_config',
      updateKey: `rc_${installedInfo.build}`,
    };
  }

  return base;
};

export const getDismissedBroadcastsMap = (): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DISMISSED_BROADCASTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    }
    // Migrate legacy array format if present
    const legacy = window.localStorage.getItem('mowasla_dismissed_broadcasts');
    if (legacy) {
      const arr = JSON.parse(legacy);
      if (Array.isArray(arr)) {
        const map: Record<string, number> = {};
        arr.forEach((id) => {
          if (typeof id === 'string') map[id] = Date.now();
        });
        return map;
      }
    }
  } catch {
    // ignore
  }
  return {};
};

export const markBroadcastDismissed = (id: string): Record<string, number> => {
  const current = getDismissedBroadcastsMap();
  const next = { ...current, [id]: Date.now() };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DISMISSED_BROADCASTS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
};

export const getBroadcastPriority = (b: Broadcast): number => {
  const isUpdate = b.type === 'update' || b.type === 'Forced Update';
  if (isUpdate && b.forceClose) return 100;
  if (isUpdate) return 90;
  if (b.type === 'alert') return 80;
  if (b.type === 'maintenance') return 70;
  if (b.type === 'warning') return 60;
  return 50;
};

export const isBroadcastEligible = ({
  broadcast,
  appSettings,
  isAdminUser,
  currentUser,
  installedInfo,
  dismissedMap,
}: {
  broadcast: Broadcast;
  appSettings: AppSettings | null;
  isAdminUser: boolean;
  currentUser: User | Driver | null;
  installedInfo: InstalledAppInfo;
  dismissedMap: Record<string, number>;
}): boolean => {
  // 1. Admins NEVER receive broadcast or update popups
  if (isAdminUser) return false;

  // 2. Strictly Android Native App only (never Web)
  if (!isAndroidNativePlatform()) return false;

  if (!broadcast || broadcast.isActive === false) return false;
  if (broadcast.title === 'fixed' || broadcast.message === 'fixed') return false;

  const isUpdate = broadcast.type === 'update' || broadcast.type === 'Forced Update';
  if (!isUpdate && appSettings && appSettings.broadcastsEnabled === false) return false;

  // 3. Platform guard (if explicitly set to something non-android in future)
  if (broadcast.targetPlatform && broadcast.targetPlatform !== 'android' && broadcast.targetPlatform !== 'all') {
    return false;
  }

  // 4. Expiry guard
  const expiresAtMs = getTimestampMillis(broadcast.expiresAt);
  if (expiresAtMs > 0 && Date.now() > expiresAtMs) return false;

  // 5. Smart version guard for update broadcasts so updated users never get trapped
  if (isUpdate) {
    if (broadcast.targetVersion && parseVersionParts(broadcast.targetVersion).length > 0) {
      if (compareSemver(installedInfo.version, broadcast.targetVersion) >= 0) {
        return false;
      }
    }
    if (broadcast.minBuildNumber && Number(broadcast.minBuildNumber) > 0) {
      if (installedInfo.build >= Number(broadcast.minBuildNumber)) {
        return false;
      }
    }
  }

  // 6. Audience guard (both auth and non-auth users receive updates, maintenance, alerts, and 'all' broadcasts)
  const audience = broadcast.targetAudience || 'all';
  if (!isUpdate && broadcast.type !== 'maintenance' && broadcast.type !== 'alert' && audience !== 'all') {
    if (currentUser) {
      const isDriver =
        currentUser.role === UserRole.DRIVER ||
        currentUser.driverStatus === 'approved' ||
        currentUser.isApproved === true ||
        currentUser.kycStatus === 'APPROVED';
      if (audience === 'drivers' && !isDriver) return false;
      if (audience === 'passengers' && (isDriver || currentUser.role !== UserRole.PASSENGER)) return false;
    }
  }

  // 7. Dismissal guard (re-show if broadcast was updated/reactivated after dismissal)
  const dismissedAt = dismissedMap[broadcast.id];
  if (dismissedAt) {
    const updatedMs = Math.max(
      getTimestampMillis(broadcast.updatedAt),
      getTimestampMillis(broadcast.createdAt)
    );
    if (!updatedMs || dismissedAt >= updatedMs) {
      return false;
    }
  }

  return true;
};
