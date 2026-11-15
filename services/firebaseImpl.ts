import { Capacitor } from '@capacitor/core';
import * as web from './firebaseImpl.web';

// Re-export everything from web by default
export * from './firebase.web';

// Platform-aware functions
export const sendOtpNative = async (phoneNumber: string): Promise<string> => {
  return web.sendOtpNative(phoneNumber);
};

export const verifyOtpNative = async (verificationId: string, otp: string): Promise<any> => {
  return web.verifyOtpNative(verificationId, otp);
};

export const signOut = async () => {
  if (Capacitor.isNativePlatform()) {
    const native = await import('./firebaseImpl.native');
    return native.signOut();
  }
  return web.signOut();
};

export const signInWithGoogle = async () => {
  return web.signInWithGoogle();
};
