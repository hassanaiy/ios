export * from './firebase.web';

export async function sendOtpNative(phoneNumber: string): Promise<string> {
  throw new Error('sendOtpNative is native-only');
}

export async function verifyOtpNative(verificationId: string, otp: string): Promise<any> {
  throw new Error('verifyOtpNative is native-only');
}
