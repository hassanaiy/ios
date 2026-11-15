import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

const vibrateSafe = (duration: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(duration);
    } catch {
      // Ignored in desktop browsers or sandboxed iframes without permission
    }
  }
};

export const HapticsService = {
  async light() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        // Ignored on unsupported devices
      }
    } else {
      vibrateSafe(15);
    }
  },
  async medium() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch {
        // Ignored on unsupported devices
      }
    } else {
      vibrateSafe(30);
    }
  },
  async heavy() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
      } catch {
        // Ignored on unsupported devices
      }
    } else {
      vibrateSafe(60);
    }
  },
  async success() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.notification({ type: NotificationType.Success });
      } catch {
        // Ignored on unsupported devices
      }
    } else {
      vibrateSafe([40, 40, 40]);
    }
  },
  async error() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.notification({ type: NotificationType.Error });
      } catch {
        // Ignored on unsupported devices
      }
    } else {
      vibrateSafe([80, 50, 80]);
    }
  },
  async warning() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.notification({ type: NotificationType.Warning });
      } catch {
        // Ignored on unsupported devices
      }
    } else {
      vibrateSafe([60, 40, 60]);
    }
  },
  async selection() {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        await Haptics.selectionEnd();
      } catch {
        // Ignored on unsupported devices
      }
    } else {
      vibrateSafe(10);
    }
  }
};
