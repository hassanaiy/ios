import { Device } from '@capacitor/device';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

const RIDE_ALERT_CHANNEL_ID = 'rides-channel';
const PUSH_CHANNEL_ID = 'push_notifications_audio2';
const ADMIN_ALERTS_CHANNEL_ID = 'admin_alerts';

let globalVibrationEnabled = true;
let activePushUid: string | undefined;

const toSafeAndroidNotificationId = (rawId?: number): number => {
  const num = Number(rawId);
  if (!Number.isFinite(num) || num === 0) {
    return (Date.now() % 2147483000) + 1;
  }
  const normalized = Math.abs(Math.floor(num)) % 2147483000;
  return normalized === 0 ? 1 : normalized;
};

const ensureAndroidChannels = async () => {
  if (!Capacitor.isNativePlatform()) return;
  const channels = [
    {
      id: PUSH_CHANNEL_ID,
      name: 'Mowasla Alerts',
      description: 'High priority alerts for account approval and important updates',
    },
    {
      id: ADMIN_ALERTS_CHANNEL_ID,
      name: 'Admin Alerts',
      description: 'Account status updates from admin',
    },
    {
      id: RIDE_ALERT_CHANNEL_ID,
      name: 'Ride Alerts',
      description: 'High priority alerts for incoming and updated rides',
    },
    {
      id: 'offers',
      name: 'Offers Notifications',
      description: 'Updates about driver and passenger offers',
    },
    {
      id: 'ride_requests',
      name: 'New Ride Requests',
      description: 'Alerts for new incoming rides',
    },
    {
      id: 'ride_status',
      name: 'Ride Status',
      description: 'Real-time ride status updates',
    },
    {
      id: 'ride_updates',
      name: 'Ride Updates',
      description: 'Ride updates and trip notifications',
    },
    {
      id: 'chat',
      name: 'Chat Messages',
      description: 'Incoming chat messages',
    },
  ];

  for (const ch of channels) {
    try {
      await PushNotifications.createChannel({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        importance: 5,
        vibration: true,
        visibility: 1,
        sound: 'default',
      });
    } catch {
      // Ignore if channel already exists or PushNotifications unavailable
    }
    try {
      await LocalNotifications.createChannel({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        importance: 5,
        vibration: true,
        visibility: 1,
        sound: 'default',
      });
    } catch {
      // Ignore if LocalNotifications channel creation unavailable
    }
  }
};

export const CapacitorService = {
  setVibrationEnabled(enabled: boolean) {
    globalVibrationEnabled = enabled;
  },

  // Device Info
  async getDeviceInfo() {
    if (Capacitor.isNativePlatform()) {
      try {
        return await Device.getInfo();
      } catch (e) {
        console.warn("Device.getInfo error", e);
      }
    }
    return {
      name: 'Web Browser',
      model: typeof navigator !== 'undefined' ? navigator.userAgent : 'web',
      platform: 'web',
      operatingSystem: 'unknown',
      osVersion: '',
      manufacturer: 'browser',
      isVirtual: false,
      webViewVersion: ''
    } as any;
  },

  async getBatteryInfo() {
    if (Capacitor.isNativePlatform()) {
      try {
        return await Device.getBatteryInfo();
      } catch (e) {
        console.warn("Device.getBatteryInfo error", e);
      }
    }
    return { batteryLevel: 1.0, isCharging: true };
  },

  // Haptics
  async vibrate() {
    if (!globalVibrationEnabled) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.vibrate();
      } catch {
        // Ignore haptics errors on unsupported devices
      }
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(200);
      } catch {
        // Ignore in sandboxed iframes or unsupported browsers
      }
    }
  },

  async impact(style: ImpactStyle = ImpactStyle.Medium) {
    if (!globalVibrationEnabled) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style });
      } catch {
        // Ignore haptics errors on unsupported devices
      }
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        const ms = style === ImpactStyle.Heavy ? 50 : style === ImpactStyle.Light ? 15 : 30;
        navigator.vibrate(ms);
      } catch {
        // Ignore in sandboxed iframes or unsupported browsers
      }
    }
  },

  // Local Notifications
  async requestNotificationPermissions() {
    if (!Capacitor.isNativePlatform()) return false;
    try {
      const current = await LocalNotifications.checkPermissions();
      let display = current.display;
      if (display === 'prompt' || display === 'prompt-with-rationale') {
        const req = await LocalNotifications.requestPermissions();
        display = req.display;
      }
      if (display === 'granted') {
        await ensureAndroidChannels();
      }
      return display === 'granted';
    } catch {
      return false;
    }
  },

  async scheduleNotification(title: string, body: string, id: number = Math.floor(Math.random() * 100000), force: boolean = false) {
    void force;
    const safeId = toSafeAndroidNotificationId(id);
    try {
      if (Capacitor.isNativePlatform()) {
        try {
          await this.requestNotificationPermissions();
          await ensureAndroidChannels();
          await LocalNotifications.schedule({
            notifications: [
              {
                title,
                body,
                id: safeId,
                schedule: { at: new Date(Date.now() + 100) },
                channelId: PUSH_CHANNEL_ID,
                sound: 'default',
              },
            ],
          });
          await this.vibrate();
          return;
        } catch (nativeErr) {
          console.warn("Native LocalNotifications schedule error:", nativeErr);
        }
      }

      // Browser Web Notification
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          try {
            new Notification(title, {
              body,
              icon: '/favicon.ico',
            });
            import('./audioService').then(({ AudioService }) => {
              AudioService.play('push_notification');
            }).catch(() => {});
          } catch (e) {
            console.warn("Browser Notification constructor error:", e);
          }
        } else if (Notification.permission === 'default') {
          Notification.requestPermission?.().then((p) => {
            if (p === 'granted') {
              try {
                new Notification(title, { body, icon: '/favicon.ico' });
                import('./audioService').then(({ AudioService }) => {
                  AudioService.play('push_notification');
                }).catch(() => {});
              } catch (_err) {
                void _err;
              }
            }
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Schedule notif error", e);
    }
  },

  // Geolocation
  async ensureLocationPermission(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'granted' || perm.coarseLocation === 'granted') {
        return true;
      }
      const req = await Geolocation.requestPermissions();
      return req.location === 'granted' || req.coarseLocation === 'granted';
    } catch {
      return true;
    }
  },

  async getCurrentPosition() {
    await this.ensureLocationPermission();
    try {
      // Race fast network/cell location against high-accuracy GPS so cold start never hangs
      return await Promise.any([
        Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 15000,
        }),
        Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 2500,
          maximumAge: 300000,
        }),
      ]);
    } catch {
      return await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 4500,
        maximumAge: 600000,
      });
    }
  },

  async watchPosition(callback: (position: any, err?: any) => void) {
    await this.ensureLocationPermission();
    return await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
      },
      callback
    );
  },

  // Push Notifications
  async setupPushNotifications(uid?: string) {
    if (!Capacitor.isNativePlatform()) return;
    if (uid) {
      activePushUid = uid;
    }

    let permStatus = await PushNotifications.checkPermissions();
    console.log('[Push Notification] Permission state:', permStatus.receive);

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      permStatus = await PushNotifications.requestPermissions();
      console.log('[Push Notification] New permission state after prompt:', permStatus.receive);
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Push Notification] User denied permissions!');
      return;
    }

    await this.requestNotificationPermissions();
    await ensureAndroidChannels();

    // CRITICAL: Register all listeners BEFORE calling PushNotifications.register()
    // so immediate token emission is never dropped or wiped by removeAllListeners().
    await PushNotifications.removeAllListeners();

    await PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token:', token.value);
      if (token?.value) {
        try {
          localStorage.setItem('mowasla_native_fcm_token', token.value);
        } catch {}
      }
      const targetUid = activePushUid || uid;
      if (targetUid && token?.value) {
        try {
          const { updateUserToken } = await import('./firebase');
          await updateUserToken(targetUid, token.value);
        } catch (err) {
          console.error('Failed to persist native FCM token:', err);
        }
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration:', JSON.stringify(error));
    });

    await LocalNotifications.removeAllListeners().catch(() => {});
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const data = event?.notification?.extra || {};
      const title = event?.notification?.title || data.title || '';
      const body = event?.notification?.body || data.body || '';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mowasla-system-push-received', { detail: { ...data, title, body } }));
      }
      if (data.type === 'SYSTEM_UPDATE' || data.type === 'FORCE_UPDATE' || data.playStoreUrl) {
        import('./updateSystem').then(({ openPlayStoreUpdate }) => {
          openPlayStoreUpdate().catch(() => {});
        }).catch(() => {});
      }
    });

    await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
      console.log('Push received:', JSON.stringify(notification));
      try {
        await this.impact(ImpactStyle.Heavy);
        const data = (notification as any)?.data || {};
        const title = notification.title || data.title || 'Mowasla';
        const body = notification.body || data.body || '';

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('mowasla-system-push-received', { detail: { ...data, title, body } }));
        }

        const channelId =
          data.type === 'RIDE_STATUS_UPDATE' ? 'ride_status'
          : data.type === 'OFFER_RECEIVED' || data.type === 'COUNTER_OFFER' ? 'offers'
          : data.type === 'NEW_RIDE_REQUEST' ? 'ride_requests'
          : (data.type === 'SYSTEM_UPDATE' || data.type === 'FORCE_UPDATE' || data.type === 'SYSTEM_BROADCAST') ? ADMIN_ALERTS_CHANNEL_ID
          : PUSH_CHANNEL_ID;

        await LocalNotifications.schedule({
          notifications: [
            {
              title,
              body,
              id: toSafeAndroidNotificationId(),
              schedule: { at: new Date(Date.now() + 100) },
              channelId,
              sound: 'default',
              extra: data,
            },
          ],
        });
      } catch (e) {
        console.error('Error showing foreground notification:', e);
      }
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed:', JSON.stringify(notification));
      const data = notification?.notification?.data || {};
      const title = notification?.notification?.title || data.title || '';
      const body = notification?.notification?.body || data.body || '';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mowasla-system-push-received', { detail: { ...data, title, body } }));
      }
      if (data.type === 'SYSTEM_UPDATE' || data.type === 'FORCE_UPDATE' || data.playStoreUrl) {
        import('./updateSystem').then(({ openPlayStoreUpdate }) => {
          openPlayStoreUpdate().catch(() => {});
        }).catch(() => {});
      }
    });

    await PushNotifications.register();
  },

  // Browser
  async openUrl(url: string) {
    await Browser.open({ url });
  },

  // App State
  onAppStateChange(callback: (state: { isActive: boolean }) => void) {
    if (Capacitor.isNativePlatform()) {
      App.addListener('appStateChange', callback);
    }
  },

  async getAppInfo() {
    if (Capacitor.isNativePlatform()) {
      return await App.getInfo();
    }
    return { name: 'Web App', id: 'web', build: '1', version: '1.0' };
  },

  // Helper to format geolocation errors which are often empty objects when stringified
  formatLocationError(err: any): string {
    if (!err) return "Unknown location error";
    
    // GeolocationPositionError properties are not enumerable, so we extract them manually
    const code = err.code;
    const message = err.message;
    
    let descriptiveMessage = "";
    switch (code) {
      case 1: // PERMISSION_DENIED
        descriptiveMessage = "Permission denied. Please enable location access in your settings.";
        break;
      case 2: // POSITION_UNAVAILABLE
        descriptiveMessage = "Location unavailable. Ensure your GPS is active and has a signal.";
        break;
      case 3: // TIMEOUT
        descriptiveMessage = "Location request timed out. Please try again.";
        break;
      default:
        descriptiveMessage = message || "An unexpected error occurred while retrieving location.";
    }

    return `Location error (code ${code || '?' }): ${descriptiveMessage}`;
  }
};
