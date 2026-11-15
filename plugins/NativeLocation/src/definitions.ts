import type { PluginListenerHandle } from '@capacitor/core';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number;
  speed: number;
  timestamp: number;
}

export interface NativeLocationPlugin {
  /**
   * Initializes the foreground service and starts watching location.
   */
  startTracking(): Promise<{ success: boolean }>;
  
  /**
   * Stops the foreground service and location updates.
   */
  stopTracking(): Promise<{ success: boolean }>;
  
  /**
   * Gets the last known location synchronously.
   */
  getCurrentLocation(): Promise<LocationData>;

  /**
   * Listen to location updates (fired via foreground service)
   */
  addListener(
    eventName: 'onLocationUpdate',
    listenerFunc: (location: LocationData) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Wrapper around location listening to explicitly watch driver
   */
  watchDriverLocation(options: { driverId?: string }): Promise<{ success: boolean }>;

  getHeading(): Promise<{ heading: number }>;

  getSpeed(): Promise<{ speed: number }>;
}
