import { useState, useEffect, useCallback, useRef } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export type LocationErrorType = null | 'permission_denied' | 'gps_disabled';

export function useLocationMonitor() {
  const [locationError, setLocationError] = useState<LocationErrorType>(null);
  const [isChecking, setIsChecking] = useState(true);
  const consecutiveFailuresList = useRef(0);

  const checkStatus = useCallback(async (silent = false) => {
    if (!silent) setIsChecking(true);
    if (!Capacitor.isNativePlatform()) {
      setIsChecking(false);
      return;
    }

    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'denied') {
        consecutiveFailuresList.current += 1;
        if (consecutiveFailuresList.current > 1 || !silent) {
          setLocationError('permission_denied');
        }
        setIsChecking(false);
        return;
      }
      
      if (perm.location === 'prompt') {
        try {
          const req = await Geolocation.requestPermissions();
          if (req.location !== 'granted') {
            consecutiveFailuresList.current += 1;
            if (consecutiveFailuresList.current > 1 || !silent) {
              setLocationError('permission_denied');
            }
            setIsChecking(false);
            return;
          }
        } catch (_) { 
          consecutiveFailuresList.current += 1;
          if (consecutiveFailuresList.current > 1 || !silent) setLocationError('permission_denied');
          setIsChecking(false);
          return;
        }
      }

      // Check GPS by trying to get position
      try {
        await Geolocation.getCurrentPosition({ timeout: 5000, maximumAge: 10000 });
        setLocationError(null);
        consecutiveFailuresList.current = 0;
      } catch (err: unknown) { 
        console.error("GPS disabled:", err);
        consecutiveFailuresList.current += 1;
        if (consecutiveFailuresList.current > 1 || !silent) {
           setLocationError('gps_disabled');
        }
      }
    } catch (err: unknown) { 
      console.error("Permission check failed:", err);
      consecutiveFailuresList.current += 1;
      if (consecutiveFailuresList.current > 1 || !silent) setLocationError('permission_denied');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Initial check is silent to give it time, then re-check
    checkStatus(true);
    
    const timeoutId = setTimeout(() => {
        if (consecutiveFailuresList.current > 0) {
            checkStatus(false);
        }
    }, 6000); // Wait 6 seconds before forcing the error state

    const intervalId = setInterval(() => {
      checkStatus(true); // Silent retries in background
    }, 10000); // 10 seconds

    const initListener = async () => {
      if (!Capacitor.isNativePlatform()) return null;
      return await App.addListener('appStateChange', (state) => {
        if (state.isActive) {
          checkStatus(true);
        }
      });
    };

    let listener: { remove: () => void } | null = null;
    initListener().then(l => listener = l as any);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      if (listener) listener.remove();
    };
  }, [checkStatus]);

  return { locationError, isChecking, checkStatus };
}
