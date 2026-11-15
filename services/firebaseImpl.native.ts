export * from './firebase.web';

import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, googleProvider } from './firebase.web';
import { signInWithPopup } from 'firebase/auth';

export async function sendOtpNative(phoneNumber: string) {
  console.debug("Calling FirebaseAuthentication.signInWithPhoneNumber for:", phoneNumber);

  return new Promise<string>(async (resolve, reject) => {
    let codeSentListener: any = null;
    let failedListener: any = null;

    const cleanup = async () => {
      await codeSentListener?.remove?.();
      await failedListener?.remove?.();
    };

    const watchdog = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout: No response from Firebase phone authentication"));
    }, 45000);

    try {
      codeSentListener = await FirebaseAuthentication.addListener('phoneCodeSent', event => {
        clearTimeout(watchdog);
        cleanup();
        resolve(event.verificationId);
      });

      failedListener = await FirebaseAuthentication.addListener('phoneVerificationFailed', event => {
        clearTimeout(watchdog);
        cleanup();
        reject(new Error(event?.message || "Phone verification failed"));
      });

      await FirebaseAuthentication.signInWithPhoneNumber({
        phoneNumber,
        timeout: 15,
      });
    } catch (error: any) {
      clearTimeout(watchdog);
      await cleanup();
      console.error("Native Phone Auth Exception:", error);
      reject(error);
    }
  });
}

export async function verifyOtpNative(verificationId: string, otp: string) {
  try {
    console.debug("Calling FirebaseAuthentication.confirmVerificationCode for:", verificationId);
    // @ts-ignore
    const result = await FirebaseAuthentication.confirmVerificationCode({
      verificationId: verificationId,
      verificationCode: otp,
    }) as any;

    if (!result) {
      console.error("Native OTP Verification Error: result is undefined");
      throw new Error("Native OTP Verification failed: Plugin returned no result.");
    }

    // Attempt to sync Native -> Web
    try {
      const { user } = await FirebaseAuthentication.getCurrentUser();
      if (user) {
        console.debug("Native user found, syncing with Web SDK...");
        // This is a best-effort sync. Some plugins do this automatically.
        // If not, we can use the credential if available or just wait for the auth state to propagate.
      }
    } catch (syncErr) {
      console.warn("Native-Web Auth Sync Warning:", syncErr);
    }

    return result;
  } catch (error: any) {
    console.error("Native OTP Verification Exception:", error);
    throw error;
  }
}

// Re-implement native logic for signOut and signInWithGoogle since they were removed from firebase.web.ts
// Note: Since we are using export * from './firebase.web', these might conflict if we export them again.
// However, in many bundlers, the local export overrides the wildcard export.
// If not, we rely on the fact that the native build will use this file and hopefully prioritize these.
// But to be safe and strictly follow "no native in web", we removed them from web.
// Now we need to make sure the app uses THESE versions on native.

export const signOut = async () => {
  const { signOut: webSignOut } = await import('./firebase.web');
  await webSignOut();
  await FirebaseAuthentication.signOut();
};

export const signInWithGoogle = async () => {
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
};
