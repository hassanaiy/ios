import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export const nativeSignOut = async () => {
  await FirebaseAuthentication.signOut();
};

export const nativeGoogleSignIn = async () => {
  return await FirebaseAuthentication.signInWithGoogle();
};

export const nativeSendOtp = async (phoneNumberE164: string): Promise<string> => {
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
        phoneNumber: phoneNumberE164,
        timeout: 15,
      });
    } catch (error) {
      clearTimeout(watchdog);
      await cleanup();
      reject(error);
    }
  });
};

export const nativeVerifyOtp = async (
  verificationId: string,
  verificationCode: string
) => {
  await FirebaseAuthentication.confirmVerificationCode({
    verificationId,
    verificationCode,
  });
};
