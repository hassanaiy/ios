import { WebPlugin } from '@capacitor/core';
import type { NativeLocationPlugin, LocationData } from './definitions';

export class NativeLocationWeb extends WebPlugin implements NativeLocationPlugin {
  async startTracking(): Promise<{ success: boolean }> {
    console.warn('NativeLocation check: startTracking not fully implemented on web.');
    return { success: true };
  }

  async stopTracking(): Promise<{ success: boolean }> {
    console.warn('NativeLocation check: stopTracking not fully implemented on web.');
    return { success: true };
  }

  async getCurrentLocation(): Promise<LocationData> {
    console.warn('NativeLocation check: returning mock location on web.');
    return {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      heading: 0,
      speed: 0,
      timestamp: Date.now()
    };
  }

  async watchDriverLocation(options: { driverId?: string }): Promise<{ success: boolean }> {
    console.warn('NativeLocation check: watchDriverLocation not implemented on web.');
    return { success: true };
  }

  async getHeading(): Promise<{ heading: number }> {
    return { heading: 0 };
  }

  async getSpeed(): Promise<{ speed: number }> {
    return { speed: 0 };
  }
}
