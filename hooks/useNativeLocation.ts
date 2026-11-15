import { useEffect, useState } from 'react';
// @ts-ignore
import { NativeLocation } from 'capacitor-native-location';

export function useNativeLocation(driverId?: string) {
  const [location, setLocation] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    let listener: any;

    const setupListener = async () => {
      listener = await NativeLocation.addListener('onLocationUpdate', (locData) => {
        setLocation(locData);
        // Here you can send locData directly to Firebase from the React layer
        // e.g., updateDriverLocation(driverId, locData);
        if (driverId) {
          console.log(`Sending new location to Firebase for driver ${driverId}`, locData);
        }
      });
    };

    if (isTracking) {
      setupListener();
    }

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [isTracking, driverId]);

  const startLiveTracking = async () => {
    await NativeLocation.startTracking();
    if (driverId) {
      await NativeLocation.watchDriverLocation({ driverId });
    }
    setIsTracking(true);
  };

  const stopLiveTracking = async () => {
    await NativeLocation.stopTracking();
    setIsTracking(false);
  };

  const fetchCurrentLocation = async () => {
    return await NativeLocation.getCurrentLocation();
  };

  const fetchHeading = async () => {
    const res = await NativeLocation.getHeading();
    return res.heading;
  };

  const fetchSpeed = async () => {
    const res = await NativeLocation.getSpeed();
    return res.speed;
  };

  return {
    location,
    isTracking,
    startLiveTracking,
    stopLiveTracking,
    fetchCurrentLocation,
    fetchHeading,
    fetchSpeed,
  };
}
