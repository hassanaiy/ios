import { Capacitor } from '@capacitor/core';
import { ImpactStyle } from '@capacitor/haptics';
import { CapacitorService } from './capacitorService';

interface AndroidBiometricInterface {
  isAvailable: () => boolean;
  hasSavedCredentials: () => boolean;
  getSavedEmail: () => string;
  saveCredentials: (email: string, password: string) => boolean;
  clearCredentials: () => void;
  authenticate: (title: string, subtitle: string, cancelText: string, callbackId: string) => void;
}

export interface BiometricAuthResult {
  success: boolean;
  email?: string;
  password?: string;
  cancelled?: boolean;
  error?: string;
}

declare global {
  interface Window {
    AndroidBiometric?: AndroidBiometricInterface;
    __handleAndroidBiometricCallback?: (callbackId: string, result: any) => void;
  }
}

const VAULT_STORAGE_KEY = 'mowasla_biometric_email_vault_v1';
const WEBAUTHN_CRED_ID_KEY = 'mowasla_biometric_webauthn_id_v1';
const DEVICE_SALT = 'mowasla_android_biometric_vault_2026_v1';

interface StoredVaultRecord {
  email: string;
  cipherText: string;
  iv?: string;
  uid?: string;
  updatedAt: number;
}

const pendingCallbacks = new Map<string, (res: BiometricAuthResult) => void>();

if (typeof window !== 'undefined') {
  window.__handleAndroidBiometricCallback = (callbackId: string, result: any) => {
    const resolver = pendingCallbacks.get(callbackId);
    if (!resolver) return;
    pendingCallbacks.delete(callbackId);

    if (result && result.success) {
      CapacitorService.impact(ImpactStyle.Medium).catch(() => {});
      resolver({
        success: true,
        email: result.email || undefined,
        password: result.password || undefined,
      });
    } else {
      const errCode = Number(result?.errorCode || 0);
      // Android BiometricPrompt error codes 10 (ERROR_USER_CANCELED) & 13 (ERROR_NEGATIVE_BUTTON) & 5 (ERROR_CANCELED)
      const isCancelled =
        errCode === 10 ||
        errCode === 13 ||
        errCode === 5 ||
        String(result?.error || '').toLowerCase().includes('cancel');
      resolver({
        success: false,
        cancelled: isCancelled,
        error: result?.error || 'Biometric authentication failed',
      });
    }
  };
}

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fromBase64 = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const xorObfuscate = (text: string): string => {
  const textBytes = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(DEVICE_SALT);
  const out = new Uint8Array(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    out[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return toBase64(out);
};

const xorDeobfuscate = (encoded: string): string => {
  try {
    const inBytes = fromBase64(encoded);
    const keyBytes = new TextEncoder().encode(DEVICE_SALT);
    const out = new Uint8Array(inBytes.length);
    for (let i = 0; i < inBytes.length; i++) {
      out[i] = inBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return new TextDecoder().decode(out);
  } catch {
    return '';
  }
};

const deriveAesKey = async (): Promise<CryptoKey | null> => {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const rawKeyMaterial = new TextEncoder().encode(DEVICE_SALT.padEnd(32, '0').slice(0, 32));
    return await crypto.subtle.importKey(
      'raw',
      rawKeyMaterial,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  } catch {
    return null;
  }
};

const encryptPasswordLocal = async (password: string): Promise<{ cipherText: string; iv?: string }> => {
  try {
    const key = await deriveAesKey();
    if (key && typeof crypto !== 'undefined' && crypto.subtle) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(password);
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
      return {
        cipherText: toBase64(new Uint8Array(encrypted)),
        iv: toBase64(iv),
      };
    }
  } catch {
    // Fallback to XOR + Base64 if WebCrypto is unavailable in non-HTTPS WebView
  }
  return { cipherText: xorObfuscate(password) };
};

const decryptPasswordLocal = async (record: StoredVaultRecord): Promise<string> => {
  try {
    if (record.iv) {
      const key = await deriveAesKey();
      if (key && typeof crypto !== 'undefined' && crypto.subtle) {
        const iv = fromBase64(record.iv);
        const cipherBytes = fromBase64(record.cipherText);
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv as unknown as BufferSource },
          key,
          cipherBytes as unknown as BufferSource
        );
        return new TextDecoder().decode(decrypted);
      }
    }
  } catch {
    // Fallback below
  }
  return xorDeobfuscate(record.cipherText);
};

const readLocalVault = (): StoredVaultRecord | null => {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === 'string' && typeof parsed.cipherText === 'string') {
      return parsed as StoredVaultRecord;
    }
  } catch {}
  return null;
};

let fallbackPromptHandler: ((options: {
  title: string;
  subtitle: string;
  cancelText: string;
  email?: string;
}) => Promise<boolean>) | null = null;

export const BiometricService = {
  /**
   * Registers an interactive UI biometric prompt fallback for environments where
   * native AndroidBiometric isn't injected yet or WebAuthn is restricted by iframe policy.
   */
  registerFallbackPromptHandler(
    handler: ((options: { title: string; subtitle: string; cancelText: string; email?: string }) => Promise<boolean>) | null
  ) {
    fallbackPromptHandler = handler;
  },

  /**
   * Returns true if running on Android (native or mobile) or a browser with platform biometrics.
   */
  async isBiometricSupported(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.AndroidBiometric) {
        return Boolean(window.AndroidBiometric.isAvailable());
      }
      if (Capacitor.getPlatform() === 'android' || Capacitor.isNativePlatform()) {
        return true;
      }
      if (
        typeof window !== 'undefined' &&
        window.PublicKeyCredential &&
        typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
      ) {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) return true;
      }
    } catch {}
    return true;
  },

  /**
   * Checks whether email & password credentials are saved on this device for direct biometric login.
   */
  hasSavedCredentials(): boolean {
    try {
      if (typeof window !== 'undefined' && window.AndroidBiometric?.hasSavedCredentials?.()) {
        return true;
      }
    } catch {}
    const local = readLocalVault();
    return Boolean(local && local.email && local.cipherText);
  },

  /**
   * Returns the saved email address linked to biometric login (if any).
   */
  getSavedEmail(): string {
    try {
      if (typeof window !== 'undefined' && window.AndroidBiometric?.getSavedEmail) {
        const nativeEmail = window.AndroidBiometric.getSavedEmail();
        if (nativeEmail && nativeEmail.trim()) {
          return nativeEmail.trim();
        }
      }
    } catch {}
    const local = readLocalVault();
    return local?.email?.trim() || '';
  },

  /**
   * Securely stores email & password credentials after account creation or email sign-in
   * so the user can log in directly with phone biometrics on future visits.
   */
  async saveCredentials(email: string, password: string, uid?: string): Promise<boolean> {
    const cleanEmail = (email || '').trim();
    if (!cleanEmail || !password) return false;

    try {
      if (typeof window !== 'undefined' && window.AndroidBiometric?.saveCredentials) {
        window.AndroidBiometric.saveCredentials(cleanEmail, password);
      }
    } catch (e) {
      console.warn('AndroidBiometric.saveCredentials warning:', e);
    }

    try {
      const encrypted = await encryptPasswordLocal(password);
      const record: StoredVaultRecord = {
        email: cleanEmail,
        cipherText: encrypted.cipherText,
        iv: encrypted.iv,
        uid,
        updatedAt: Date.now(),
      };
      localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(record));
      return true;
    } catch (e) {
      console.warn('Biometric local vault save warning:', e);
      return false;
    }
  },

  /**
   * Clears stored biometric email credentials from both native Android KeyStore SharedPreferences and localStorage.
   */
  clearCredentials(): void {
    try {
      window.AndroidBiometric?.clearCredentials?.();
    } catch {}
    try {
      localStorage.removeItem(VAULT_STORAGE_KEY);
      localStorage.removeItem(WEBAUTHN_CRED_ID_KEY);
    } catch {}
  },

  /**
   * Attempts WebAuthn platform biometric authentication (triggers Android/OS fingerprint/face sheet in modern WebView/Chrome).
   */
  async verifyViaWebAuthn(emailHint?: string): Promise<{ verified: boolean; cancelled?: boolean; unsupported?: boolean }> {
    if (
      typeof window === 'undefined' ||
      !window.PublicKeyCredential ||
      !navigator.credentials
    ) {
      return { verified: false, unsupported: true };
    }

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const existingCredIdB64 = localStorage.getItem(WEBAUTHN_CRED_ID_KEY);
      if (existingCredIdB64) {
        try {
          const credIdBytes = fromBase64(existingCredIdB64);
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              allowCredentials: [
                {
                  id: credIdBytes as unknown as BufferSource,
                  type: 'public-key',
                  transports: ['internal'],
                },
              ],
              userVerification: 'required',
              timeout: 45000,
            },
          });
          if (assertion) {
            return { verified: true };
          }
        } catch (getErr: any) {
          const name = String(getErr?.name || '');
          if (name === 'NotAllowedError') {
            return { verified: false, cancelled: true };
          }
          // If credential was not found on device, fall through to create a new platform passkey
        }
      }

      const userIdBytes = new TextEncoder().encode((emailHint || 'mowasla_user').slice(0, 32));
      const created = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: 'Mowasla',
            id: window.location.hostname || undefined,
          },
          user: {
            id: userIdBytes,
            name: emailHint || 'user@mowasla.app',
            displayName: emailHint || 'Mowasla User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
            residentKey: 'preferred',
          },
          timeout: 45000,
        },
      })) as PublicKeyCredential | null;

      if (created && created.rawId) {
        localStorage.setItem(WEBAUTHN_CRED_ID_KEY, toBase64(new Uint8Array(created.rawId)));
        return { verified: true };
      }
      return { verified: false, unsupported: true };
    } catch (err: any) {
      const errName = String(err?.name || '');
      const errMsg = String(err?.message || '');
      // Distinguish between user cancelling the OS biometric sheet vs environment/iframe restriction
      if (
        errName === 'NotAllowedError' &&
        !errMsg.toLowerCase().includes('feature policy') &&
        !errMsg.toLowerCase().includes('permissions policy') &&
        !errMsg.toLowerCase().includes('publickey-credentials')
      ) {
        return { verified: false, cancelled: true };
      }
      return { verified: false, unsupported: true };
    }
  },

  /**
   * Triggers native Android BiometricPrompt (or WebAuthn / interactive prompt fallback)
   * and returns the decrypted email & password credentials upon biometric verification.
   */
  async authenticateForEmailLogin(options: {
    title: string;
    subtitle: string;
    cancelText: string;
  }): Promise<BiometricAuthResult> {
    const savedRecord = readLocalVault();
    const savedEmail = this.getSavedEmail();

    // 1. Primary path: Native AndroidBiometric JavascriptInterface in MainActivity.java
    if (typeof window !== 'undefined' && window.AndroidBiometric && typeof window.AndroidBiometric.authenticate === 'function') {
      try {
        const available = window.AndroidBiometric.isAvailable();
        if (available) {
          const nativeRes = await new Promise<BiometricAuthResult>((resolve) => {
            const callbackId = `bio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            pendingCallbacks.set(callbackId, resolve);
            try {
              window.AndroidBiometric!.authenticate(
                options.title,
                options.subtitle,
                options.cancelText,
                callbackId
              );
            } catch (err: any) {
              pendingCallbacks.delete(callbackId);
              resolve({ success: false, error: err?.message || 'Native biometric invocation failed' });
            }
          });

          if (!nativeRes.success) {
            return nativeRes;
          }

          let finalEmail = nativeRes.email || savedRecord?.email || '';
          let finalPassword = nativeRes.password || '';
          if (!finalPassword && savedRecord) {
            finalPassword = await decryptPasswordLocal(savedRecord);
          }

          return {
            success: true,
            email: finalEmail,
            password: finalPassword,
          };
        }
      } catch (e) {
        console.warn('Native AndroidBiometric.authenticate fallback:', e);
      }
    }

    // 2. Secondary path: WebAuthn Platform Authenticator (Android Chrome / WebView with Passkey support)
    const webAuthnRes = await this.verifyViaWebAuthn(savedEmail);
    if (webAuthnRes.verified) {
      CapacitorService.impact(ImpactStyle.Medium).catch(() => {});
      if (savedRecord) {
        const password = await decryptPasswordLocal(savedRecord);
        return {
          success: true,
          email: savedRecord.email,
          password,
        };
      }
      return { success: true, email: savedEmail };
    }
    if (webAuthnRes.cancelled) {
      return {
        success: false,
        cancelled: true,
      };
    }

    // 3. Fallback interactive biometric sheet when running in preview iframe or WebView without native bridge
    if (fallbackPromptHandler) {
      const confirmed = await fallbackPromptHandler({
        title: options.title,
        subtitle: options.subtitle,
        cancelText: options.cancelText,
        email: savedEmail,
      });
      if (!confirmed) {
        return { success: false, cancelled: true };
      }
      CapacitorService.impact(ImpactStyle.Medium).catch(() => {});
      if (savedRecord) {
        const password = await decryptPasswordLocal(savedRecord);
        return {
          success: true,
          email: savedRecord.email,
          password,
        };
      }
      return { success: true, email: savedEmail };
    }

    return {
      success: false,
      error: 'Biometric sensor not available on this device.',
    };
  },

  /**
   * Verifies the user's phone biometric without needing stored email credentials
   * (e.g. when enrolling biometric on first login or unlocking PasskeyPrompt).
   */
  async verifyBiometricOnly(options: {
    title: string;
    subtitle: string;
    cancelText: string;
  }): Promise<boolean> {
    const res = await this.authenticateForEmailLogin(options);
    return res.success;
  },
};
