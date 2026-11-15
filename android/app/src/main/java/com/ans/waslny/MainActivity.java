package com.ans.waslny;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String PUSH_CHANNEL_ID = "push_notifications_audio2";
    private static final String PREFS_NAME = "mowasla_biometric_vault";
    private static final String KEY_ALIAS = "mowasla_biometric_aes_key";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannel();
        
        // Print App Hash for SMS Retriever API
        AppSignatureHelper.printHash(this);

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
            webView.setVerticalScrollBarEnabled(false);
            webView.setHorizontalScrollBarEnabled(false);
            WebSettings settings = webView.getSettings();
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDomStorageEnabled(true);
            webView.addJavascriptInterface(new AndroidBiometricBridge(this, webView), "AndroidBiometric");
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // This ID must match the manifest default channel and the Capacitor push setup.
            String channelId = PUSH_CHANNEL_ID;
            CharSequence name = "Push Notifications";
            String description = "General push notifications";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(channelId, name, importance);
            channel.setDescription(description);

            // Push notifications should use res/raw/audio2.mp3.
            Uri soundUri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/raw/audio2");
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
            
            channel.setSound(soundUri, audioAttributes);
            channel.enableVibration(true);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    public static class AndroidBiometricBridge {
        private final MainActivity activity;
        private final WebView webView;

        public AndroidBiometricBridge(MainActivity activity, WebView webView) {
            this.activity = activity;
            this.webView = webView;
        }

        private SecretKey getOrCreateSecretKey() throws Exception {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            if (keyStore.containsAlias(KEY_ALIAS)) {
                KeyStore.SecretKeyEntry entry = (KeyStore.SecretKeyEntry) keyStore.getEntry(KEY_ALIAS, null);
                if (entry != null) {
                    return entry.getSecretKey();
                }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                KeyGenerator keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    "AndroidKeyStore"
                );
                KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build();
                keyGenerator.init(spec);
                return keyGenerator.generateKey();
            }
            return null;
        }

        private String encryptValue(String plainText) {
            if (plainText == null) return "";
            try {
                SecretKey secretKey = getOrCreateSecretKey();
                if (secretKey != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                    cipher.init(Cipher.ENCRYPT_MODE, secretKey);
                    byte[] iv = cipher.getIV();
                    byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
                    return Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(encrypted, Base64.NO_WRAP);
                }
            } catch (Exception ignored) {}
            return "b64:" + Base64.encodeToString(plainText.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
        }

        private String decryptValue(String stored) {
            if (stored == null || stored.isEmpty()) return "";
            try {
                if (stored.startsWith("b64:")) {
                    byte[] decoded = Base64.decode(stored.substring(4), Base64.NO_WRAP);
                    return new String(decoded, StandardCharsets.UTF_8);
                }
                String[] parts = stored.split(":");
                if (parts.length == 2 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    SecretKey secretKey = getOrCreateSecretKey();
                    if (secretKey != null) {
                        byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
                        byte[] cipherBytes = Base64.decode(parts[1], Base64.NO_WRAP);
                        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                        GCMParameterSpec spec = new GCMParameterSpec(128, iv);
                        cipher.init(Cipher.DECRYPT_MODE, secretKey, spec);
                        byte[] plain = cipher.doFinal(cipherBytes);
                        return new String(plain, StandardCharsets.UTF_8);
                    }
                }
            } catch (Exception ignored) {}
            return "";
        }

        @JavascriptInterface
        public boolean isAvailable() {
            try {
                BiometricManager manager = BiometricManager.from(activity);
                int strongOrWeak = manager.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK
                );
                if (strongOrWeak == BiometricManager.BIOMETRIC_SUCCESS) {
                    return true;
                }
                int withDeviceCred = manager.canAuthenticate(
                    BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                );
                return withDeviceCred == BiometricManager.BIOMETRIC_SUCCESS;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean hasSavedCredentials() {
            try {
                SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String email = decryptValue(prefs.getString("enc_email", ""));
                String password = decryptValue(prefs.getString("enc_password", ""));
                return !email.isEmpty() && !password.isEmpty();
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public String getSavedEmail() {
            try {
                SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                return decryptValue(prefs.getString("enc_email", ""));
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public boolean saveCredentials(String email, String password) {
            try {
                if (email == null || password == null || email.trim().isEmpty() || password.isEmpty()) {
                    return false;
                }
                SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit()
                    .putString("enc_email", encryptValue(email.trim()))
                    .putString("enc_password", encryptValue(password))
                    .putLong("updated_at", System.currentTimeMillis())
                    .apply();
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void clearCredentials() {
            try {
                SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().clear().apply();
            } catch (Exception ignored) {}
        }

        private void dispatchResult(final String callbackId, final JSONObject payload) {
            activity.runOnUiThread(() -> {
                try {
                    String js = "window.__handleAndroidBiometricCallback && window.__handleAndroidBiometricCallback("
                        + JSONObject.quote(callbackId) + ", " + payload.toString() + ");";
                    webView.evaluateJavascript(js, null);
                } catch (Exception ignored) {}
            });
        }

        @JavascriptInterface
        public void authenticate(final String title, final String subtitle, final String cancelText, final String callbackId) {
            activity.runOnUiThread(() -> {
                try {
                    Executor executor = ContextCompat.getMainExecutor(activity);
                    BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                            super.onAuthenticationError(errorCode, errString);
                            try {
                                JSONObject res = new JSONObject();
                                res.put("success", false);
                                res.put("errorCode", errorCode);
                                res.put("error", errString.toString());
                                dispatchResult(callbackId, res);
                            } catch (Exception ignored) {}
                        }

                        @Override
                        public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                            super.onAuthenticationSucceeded(result);
                            try {
                                SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                                String savedEmail = decryptValue(prefs.getString("enc_email", ""));
                                String savedPassword = decryptValue(prefs.getString("enc_password", ""));
                                JSONObject res = new JSONObject();
                                res.put("success", true);
                                res.put("email", savedEmail);
                                res.put("password", savedPassword);
                                dispatchResult(callbackId, res);
                            } catch (Exception e) {
                                try {
                                    JSONObject res = new JSONObject();
                                    res.put("success", true);
                                    dispatchResult(callbackId, res);
                                } catch (Exception ignored) {}
                            }
                        }

                        @Override
                        public void onAuthenticationFailed() {
                            super.onAuthenticationFailed();
                        }
                    });

                    BiometricManager manager = BiometricManager.from(activity);
                    int strongWeak = manager.canAuthenticate(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK
                    );

                    BiometricPrompt.PromptInfo.Builder builder = new BiometricPrompt.PromptInfo.Builder()
                        .setTitle(title != null && !title.isEmpty() ? title : "Biometric Login")
                        .setSubtitle(subtitle != null ? subtitle : "")
                        .setConfirmationRequired(false);

                    if (strongWeak == BiometricManager.BIOMETRIC_SUCCESS) {
                        builder.setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK
                        );
                        builder.setNegativeButtonText(cancelText != null && !cancelText.isEmpty() ? cancelText : "Cancel");
                    } else {
                        builder.setAllowedAuthenticators(
                            BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL
                        );
                    }

                    biometricPrompt.authenticate(builder.build());
                } catch (Exception e) {
                    try {
                        JSONObject res = new JSONObject();
                        res.put("success", false);
                        res.put("error", e.getMessage() != null ? e.getMessage() : "Biometric prompt error");
                        dispatchResult(callbackId, res);
                    } catch (Exception ignored) {}
                }
            });
        }
    }
}
